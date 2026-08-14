//Reads HA's native solar-production forecast instead of computing its own: one defensive WS round-trip cached on the
//host, a throttle / in-flight guard so duplicate cards don't hammer the call, and a requestUpdate once the parsed
//result lands.

import type { HassLike } from '../core/ha-types';
import type { EnergyDefaults } from './sources/energy-prefs';
import { FORECAST_THROTTLE_MS, HOUR_MS } from '../core/config/constants';
import { localMidnightMinusDays } from '../core/time/timezone';
import { callWS } from './ha-gateway';


//The Forecast period shows +2 days. The fetch always reaches at least this far ahead, whatever the active period,
//so a re-fetch while on a no-future period (Today/Week/Month/Year all have futureDays 0) can't overwrite the
//cached future days the Forecast view needs. The forecast is period-independent, so caching extra is harmless.
const FORECAST_HORIZON_DAYS = 2;


//One forecast point. `w` holds the AVERAGE WATTS across the point's bucket: the fetch layer normalises each
//provider bucket's energy by its duration, so consumers read watts directly regardless of the feed cadence.
export interface SolarForecastPoint
{
    tMs: number;
    w:   number;
}


export interface EnergyForecastHost
{
    readonly hass: HassLike;
    //Read for the solar-forecast provider config entry ids (config_entry_solar_forecast).
    readonly _energyDefaults: EnergyDefaults;
    //Rolling-window span (same seed the store uses), so the detail fetch covers the whole visible range instead of a
    //fixed 5-day slice that would truncate the curve on wider periods.
    readonly _periodPastDays: number;
    readonly _periodFutureDays: number;
    //Merged, time-sorted hourly forecast across every config entry. Empty when no solar forecast is configured (or the
    //call failed): the store then leaves its forecast series all-null so no curve/label renders.
    _haSolarForecast: SolarForecastPoint[];
    //Flips true once a fetch settles (including the empty case), so boot gating doesn't block on a never-arriving fetch.
    _haSolarForecastLoaded: boolean;
    _haSolarForecastFetching: boolean;
    //Date.now() of the last fetch attempt, for throttling.
    _haSolarForecastFetchedAt: number;
    requestUpdate(): void;
}


//Fetch the HA solar forecast and update the host's cached snapshot. Safe to call repeatedly; any failure (RBAC
//denied, nothing configured, older HA core) collapses silently to an empty forecast so the card never errors.
export async function fetchHaSolarForecast(host: EnergyForecastHost): Promise<void>
{
    if (!host.hass?.callWS)
    {
        return;
    }
    if (host._haSolarForecastFetching)
    {
        return;
    }
    //Throttle: once settled, skip further attempts until the window elapses.
    if (host._haSolarForecastLoaded && (Date.now() - (host._haSolarForecastFetchedAt ?? 0)) < FORECAST_THROTTLE_MS)
    {
        return;
    }
    host._haSolarForecastFetchedAt = Date.now();
    host._haSolarForecastFetching = true;
    try
    {
        //Preferred: the detail series (sub-hourly future + hourly past). Falls back to HA's generic
        //`energy/solar_forecast` (hourly, future-only) when that provider is not configured.
        const detail = await fetchHeliosSeries(host);
        if (detail !== null)
        {
            host._haSolarForecast = detail;
        }
        else
        {
            //HA returns { [configEntryId]: { wh_hours: { [iso]: number } } }; an unconfigured install returns {}.
            const raw = await callWS(host.hass, { type: 'energy/solar_forecast' }) as Record<string, { wh_hours?: Record<string, number> }>;
            host._haSolarForecast = mergeSolarForecast(raw);
        }
        host._haSolarForecastLoaded = true;
        host.requestUpdate();
    }
    catch (_)
    {
        //Transient WS error, RBAC denied, or nothing configured: leave the forecast empty but flip loaded so the boot
        //spinner doesn't block on a payload that may never arrive.
        host._haSolarForecastLoaded = true;
    }
    finally
    {
        host._haSolarForecastFetching = false;
    }
}


//Try the detail websocket for EVERY configured provider entry over the card's active period window, and SUM their curves:
//a multi-string install wires one forecast config entry per array (east roof + west roof, ...), and the card must
//show their combined output, not just the first. Each `pv_w` is already watts, so summing watts per timestamp is
//correct. Entries that reject the command (not the Helios provider) are skipped; null only when NONE answered, so
//the caller falls back to HA's generic surface.
async function fetchHeliosSeries(host: EnergyForecastHost): Promise<SolarForecastPoint[] | null>
{
    const candidates = host._energyDefaults?.solarForecastEntryIds ?? [];
    if (candidates.length === 0)
    {
        return null;
    }
    //Past extent follows the active period (a wider period gets its whole past curve); the future extent is fixed
    //to at least the forecast horizon, independent of the period, so a re-fetch on a no-future period doesn't drop
    //the future days the Forecast view needs (see FORECAST_HORIZON_DAYS).
    const futureDays = Math.max(host._periodFutureDays, FORECAST_HORIZON_DAYS);
    const startIso = new Date(localMidnightMinusDays(host._periodPastDays)).toISOString();
    const endIso   = new Date(localMidnightMinusDays(-(futureDays + 1))).toISOString();

    //Fetch every entry in parallel, then sum the answering ones per timestamp. A rejecting entry (not the Helios
    //provider) resolves to null and drops out; an empty-but-valid answer counts as answered but adds nothing.
    const results = await Promise.all(candidates.map((entryId) =>
        callWS<{ points?: { t: string; pv_w: number }[] }>(host.hass, {
            type:     'helios_forecast/series',
            entry_id: entryId,
            start:    startIso,
            end:      endIso,
        })
            .then((res: { points?: { t: string; pv_w: number }[] }) => res?.points ?? null)
            .catch(() => null)));

    const byMs = new Map<number, number>();
    let anyAnswered = false;
    for (const raw of results)
    {
        if (!Array.isArray(raw)) { continue; }
        anyAnswered = true;
        for (const p of raw)
        {
            const tMs = Date.parse(p.t);
            if (Number.isFinite(tMs) && typeof p.pv_w === 'number' && Number.isFinite(p.pv_w))
            {
                byMs.set(tMs, (byMs.get(tMs) ?? 0) + p.pv_w);
            }
        }
    }
    if (!anyAnswered)
    {
        return null;
    }
    return [...byMs.entries()]
        .map(([tMs, w]) => ({ tMs, w }))
        .sort((a, b) => a.tMs - b.tMs);
}


//Merge the per-config-entry wh_hours maps into one combined forecast, then normalise each point to AVERAGE WATTS.
//HA's energy/solar_forecast reports ENERGY per bucket (Wh), and providers differ in bucket width (Forecast.Solar is
//hourly, Solcast is 30-minute, ...). Consumers read `w` as watts, so we divide each bucket's summed energy by the
//bucket duration in hours. The duration is derived from the median spacing of the merged timeline, so a 30-minute
//feed scales x2, an hourly feed is unchanged, and any other cadence is handled generically.
export function mergeSolarForecast(raw: Record<string, { wh_hours?: Record<string, number> }> | null | undefined): SolarForecastPoint[]
{
    if (!raw || typeof raw !== 'object')
    {
        return [];
    }
    const byMs = new Map<number, number>();
    for (const entryId of Object.keys(raw))
    {
        const entry = raw[entryId];
        const whHours = entry?.wh_hours;
        if (!whHours || typeof whHours !== 'object')
        {
            continue;
        }
        for (const iso of Object.keys(whHours))
        {
            const tMs = Date.parse(iso);
            if (!Number.isFinite(tMs))
            {
                continue;
            }
            const v = whHours[iso];
            if (typeof v !== 'number' || !Number.isFinite(v))
            {
                continue;
            }
            byMs.set(tMs, (byMs.get(tMs) ?? 0) + v);
        }
    }
    const sorted = [...byMs.entries()]
        .map(([tMs, wh]) => ({ tMs, wh }))
        .sort((a, b) => a.tMs - b.tMs);

    //Detect the native bucket width from the median positive gap between consecutive points, so per-point anomalies
    //(overnight jumps, missing samples) don't distort the conversion. Fall back to one hour when it can't be measured.
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++)
    {
        const d = sorted[i].tMs - sorted[i - 1].tMs;
        if (Number.isFinite(d) && d > 0)
        {
            gaps.push(d);
        }
    }
    let bucketMs = HOUR_MS;
    if (gaps.length > 0)
    {
        gaps.sort((a, b) => a - b);
        const medianGap = gaps[Math.floor(gaps.length / 2)];
        if (Number.isFinite(medianGap) && medianGap > 0)
        {
            bucketMs = medianGap;
        }
    }
    const wattFactor = HOUR_MS / bucketMs;

    //Energy per bucket -> average watts (Wh * hour/bucket): a 30-minute feed scales x2, an hourly feed is unchanged.
    return sorted.map((p) => ({ tMs: p.tMs, w: p.wh * wattFactor }));
}


//Read the forecast watts at a bucket time. The forecast is hourly; linearly interpolate between consecutive points so
//the sub-hourly store buckets draw a smooth curve instead of flat steps. Null when no point covers the time.
export function forecastWattsAt(forecast: readonly SolarForecastPoint[], ms: number): number | null
{
    if (forecast.length === 0)
    {
        return null;
    }
    //Binary search for the last point whose tMs <= ms.
    let lo = 0;
    let hi = forecast.length - 1;
    let idx = -1;
    while (lo <= hi)
    {
        const midIdx = Math.trunc((lo + hi) / 2);
        if (forecast[midIdx].tMs <= ms)
        {
            idx = midIdx;
            lo = midIdx + 1;
        }
        else
        {
            hi = midIdx - 1;
        }
    }
    if (idx < 0)
    {
        return null;
    }
    const pt   = forecast[idx];
    const next = forecast[idx + 1];
    //Interpolate toward the next point when it is consecutive (no gap larger than 1.5 h).
    if (next && next.tMs - pt.tMs <= HOUR_MS * 1.5 && next.tMs > pt.tMs)
    {
        const f = (ms - pt.tMs) / (next.tMs - pt.tMs);
        const frac = f < 0 ? 0 : f > 1 ? 1 : f;
        return pt.w + (next.w - pt.w) * frac;
    }
    //No usable next point: the value only applies inside this point's own hour window.
    if (ms >= pt.tMs + HOUR_MS)
    {
        return null;
    }
    return pt.w;
}


//Average forecast watts across a whole bucket span [startMs, endMs). Production stores each bucket as the MEAN watts
//over its span (energy / bucket-hours), so on coarse (daily) buckets the forecast must be averaged the same way: a
//single midpoint sample would read noon's peak watts, not the day's mean, towering the year curve over the actuals.
//Hours with no forecast coverage count as 0 (night contributes 0 energy but still spans the denominator), matching
//production which averages the day's energy over the full 24 h. Null only when the span holds no samples at all.
export function forecastAverageWatts(forecast: readonly SolarForecastPoint[], startMs: number, endMs: number): number | null
{
    if (forecast.length === 0 || endMs <= startMs)
    {
        return null;
    }
    //Sub-sample at half-hour midpoints so 30-minute feeds (Solcast) aren't under-sampled; midpoint rule over an
    //hourly-native curve is exact enough for a daily mean.
    const subStepMs = HOUR_MS / 2;
    let sum = 0;
    let n = 0;
    for (let t = startMs + subStepMs / 2; t < endMs; t += subStepMs)
    {
        const w = forecastWattsAt(forecast, t);
        sum += w !== null && Number.isFinite(w) ? Math.max(0, w) : 0;
        n++;
    }
    return n > 0 ? sum / n : null;
}
