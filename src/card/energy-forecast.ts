//Reads HA's native solar-production forecast instead of computing its own: one defensive WS round-trip cached on the
//host, a throttle / in-flight guard so duplicate cards don't hammer the call, and a requestUpdate once the parsed
//result lands.

import type { EnergyDefaults } from './energy-prefs';
import { FORECAST_THROTTLE_MS, HOUR_MS, DAY_MS } from '../constants';


//One forecast point. The `wh` slot always holds AVERAGE WATTS for the point's bucket: the fetch layer normalises
//each provider bucket's energy by its duration, so consumers read watts directly regardless of the feed cadence.
export interface SolarForecastPoint
{
    tMs: number;
    wh:  number;
}


export interface EnergyForecastHost
{
    readonly hass: any;
    //Read for the solar-forecast provider config entry ids (config_entry_solar_forecast).
    readonly _energyDefaults: EnergyDefaults;
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
            const raw = await host.hass.callWS({ type: 'energy/solar_forecast' }) as Record<string, { wh_hours?: Record<string, number> }>;
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


//Try the detail websocket for each configured provider entry over the card's J-2..J+2 window. Returns the merged
//points of the first entry that answers, or null when no entry supports the command (caller then falls back to HA's
//generic surface). Each `pv_w` is watts, kept in the .wh slot (hourly: watts == Wh, read as watts either way).
async function fetchHeliosSeries(host: EnergyForecastHost): Promise<SolarForecastPoint[] | null>
{
    const candidates = host._energyDefaults?.solarForecastEntryIds ?? [];
    if (candidates.length === 0)
    {
        return null;
    }
    //Local midnight minus 2 days to plus 3 days, covering the visible J-2..J+2 with margin.
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const startIso = new Date(midnight.getTime() - 2 * DAY_MS).toISOString();
    const endIso   = new Date(midnight.getTime() + 3 * DAY_MS).toISOString();

    for (const entryId of candidates)
    {
        try
        {
            // eslint-disable-next-line no-await-in-loop -- sequential by design: return the first candidate that answers, skip the rest
            const res = await host.hass.callWS({
                type:     'helios_forecast/series',
                entry_id: entryId,
                start:    startIso,
                end:      endIso,
            }) as { points?: { t: string; pv_w: number }[] };
            const raw = res?.points;
            if (!Array.isArray(raw))
            {
                continue;
            }
            const out: SolarForecastPoint[] = [];
            for (const p of raw)
            {
                const tMs = Date.parse(p.t);
                if (Number.isFinite(tMs) && typeof p.pv_w === 'number' && Number.isFinite(p.pv_w))
                {
                    out.push({ tMs, wh: p.pv_w });
                }
            }
            out.sort((a, b) => a.tMs - b.tMs);
            //An empty (but valid) answer means an entry with no points in range; still prefer it over the generic
            //surface to avoid double-fetching. An entry that doesn't support the command rejects it and is skipped.
            return out;
        }
        catch (_)
        {
            //Entry doesn't support the command (unknown command / not_found) or transient error: try the next.
            continue;
        }
    }
    return null;
}


//Merge the per-config-entry wh_hours maps into one combined forecast, then normalise each point to AVERAGE WATTS.
//HA's energy/solar_forecast reports ENERGY per bucket (Wh), and providers differ in bucket width (Forecast.Solar is
//hourly, Solcast is 30-minute, ...). Consumers of this array read the .wh slot as watts, so we divide each bucket's
//summed energy by the bucket duration in hours. The duration is derived from the median spacing of the merged
//timeline, so a 30-minute feed scales x2, an hourly feed is unchanged, and any other cadence is handled generically.
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
    const sorted: SolarForecastPoint[] = [];
    for (const [tMs, wh] of byMs)
    {
        sorted.push({ tMs, wh });
    }
    sorted.sort((a, b) => a.tMs - b.tMs);

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

    //Convert each bucket's summed energy to average watts in place; consumers read the .wh slot as watts.
    for (const point of sorted)
    {
        point.wh *= wattFactor;
    }
    return sorted;
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
    //Interpolate toward the next hour when it is consecutive (no gap larger than ~1 h).
    if (next && next.tMs - pt.tMs <= HOUR_MS * 1.5 && next.tMs > pt.tMs)
    {
        const f = (ms - pt.tMs) / (next.tMs - pt.tMs);
        const frac = f < 0 ? 0 : f > 1 ? 1 : f;
        return pt.wh + (next.wh - pt.wh) * frac;
    }
    //No usable next point: the value only applies inside this point's own hour window.
    if (ms >= pt.tMs + HOUR_MS)
    {
        return null;
    }
    return pt.wh;
}
