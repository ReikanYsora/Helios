//Home Assistant native solar-production forecast reader. Helios no longer computes its own PV forecast: it reads the
//solar forecast straight from the HA Energy dashboard, the same surface the official Energy dashboard draws from its
//configured solar forecast sources (Forecast.Solar, Solcast, or our own Helios-Forecast integration). Mirrors the
//energy-prefs pattern: one defensive WS round-trip cached on the host, a small fetch-key / in-flight guard so two
//cards on the same dashboard don't hammer the call, and a requestUpdate once the parsed result lands.

import { beginLoadingPhase, endLoadingPhase, type LoadingTrackerHost } from './loading-tracker';
import type { EnergyDefaults } from './energy-prefs';


const HOUR_MS = 3_600_000;
const DAY_MS  = 86_400_000;
//The forecast only changes when the integration refreshes (every 30 min server-side), but the card's refresh chain can
//fire on every hass push. Throttle the round-trip so we refetch at most this often.
const FORECAST_THROTTLE_MS = 5 * 60_000;


//One parsed hourly forecast point: the wh value the HA forecast source reported for the hour starting at tMs. For an
//hourly wh value the average power across that hour in watts equals the wh number (Wh over 1 h), so the consumer reads
//watts directly without a unit conversion.
export interface SolarForecastPoint
{
    tMs: number;
    wh:  number;
}


export interface EnergyForecastHost extends LoadingTrackerHost
{
    readonly hass: any;
    //HA Energy defaults, read for the solar-forecast provider config entry ids (config_entry_solar_forecast).
    readonly _energyDefaults: EnergyDefaults;
    //Merged, time-sorted hourly forecast across every config entry the Energy dashboard exposes. Empty array when no
    //solar forecast is configured (or the call failed): the store then leaves its forecast series all-null so no curve
    //and no forecast label render.
    _haSolarForecast: SolarForecastPoint[];
    //Flips true the first time a fetch settles (including the empty / unconfigured case), so boot gating does not block
    //on a never-arriving forecast.
    _haSolarForecastLoaded: boolean;
    _haSolarForecastFetching: boolean;
    //Date.now() of the last fetch attempt, used to throttle the refresh chain.
    _haSolarForecastFetchedAt: number;
    requestUpdate(): void;
}


//Fetch the HA solar forecast and update the host's cached snapshot. Safe to call repeatedly: an in-flight guard drops
//concurrent calls, and any failure (RBAC denied, no forecast configured, older HA core) collapses silently to an empty
//forecast so the card never errors or nags.
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
    //Throttle: once a fetch has settled, skip further attempts until the window elapses.
    if (host._haSolarForecastLoaded && (Date.now() - (host._haSolarForecastFetchedAt ?? 0)) < FORECAST_THROTTLE_MS)
    {
        return;
    }
    host._haSolarForecastFetchedAt = Date.now();
    host._haSolarForecastFetching = true;
    beginLoadingPhase(host, 'solar-forecast');
    try
    {
        //Preferred: Helios-Forecast's detail series (sub-hourly future + hourly past archive), pulled over its
        //websocket for whichever configured solar-forecast provider answers it. Falls back to HA's generic
        //`energy/solar_forecast` (hourly, future-only) when Helios-Forecast is not the configured provider.
        const detail = await fetchHeliosSeries(host);
        if (detail !== null)
        {
            host._haSolarForecast = detail;
        }
        else
        {
            //HA returns an object keyed by config entry id: { [id]: { wh_hours: { [iso]: number } } }. An install with
            //no solar forecast configured returns an empty object, which parses to an empty forecast.
            const raw = await host.hass.callWS({ type: 'energy/solar_forecast' }) as Record<string, { wh_hours?: Record<string, number> }>;
            host._haSolarForecast = mergeSolarForecast(raw);
        }
        host._haSolarForecastLoaded = true;
        host.requestUpdate();
    }
    catch (_)
    {
        //Transient WS error, RBAC denied, or no forecast configured. Leave the forecast empty and flip the loaded flag
        //so the boot spinner does not block on a payload that may never arrive.
        host._haSolarForecastLoaded = true;
    }
    finally
    {
        host._haSolarForecastFetching = false;
        endLoadingPhase(host, 'solar-forecast');
    }
}


//Try Helios-Forecast's detail websocket for each configured solar-forecast provider entry, over the card's J-2..J+2
//window. Returns the merged points of the first entry that answers, or null when none is a Helios-Forecast entry (so
//the caller falls back to HA's generic surface). Each `pv_w` is watts; we keep it in the SolarForecastPoint.wh slot
//(for an hourly value, watts == Wh, and forecastWattsAt reads it as watts either way).
async function fetchHeliosSeries(host: EnergyForecastHost): Promise<SolarForecastPoint[] | null>
{
    const candidates = host._energyDefaults?.solarForecastEntryIds ?? [];
    if (candidates.length === 0)
    {
        return null;
    }
    //Window: today's local midnight minus 2 days to plus 3 days, covering the card's visible J-2..J+2 with margin.
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const startIso = new Date(midnight.getTime() - 2 * DAY_MS).toISOString();
    const endIso   = new Date(midnight.getTime() + 3 * DAY_MS).toISOString();

    for (const entryId of candidates)
    {
        try
        {
            const res = await host.hass.callWS({
                type:     'helios_forecast/series',
                entry_id: entryId,
                start:    startIso,
                end:      endIso,
            }) as { points?: Array<{ t: string; pv_w: number }> };
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
            //An empty (but valid) answer means this entry is Helios-Forecast with no points in range; still prefer it
            //over the generic surface so we do not double-fetch. A non-Helios entry rejects the command and is skipped.
            return out;
        }
        catch (_)
        {
            //Not a Helios-Forecast entry (command unknown / not_found) or a transient error: try the next candidate.
            continue;
        }
    }
    return null;
}


//Merge the per-config-entry wh_hours maps into one hourly forecast: sum the wh values across every entry that reports
//the same timestamp, then emit a time-sorted array. A multi-source install (e.g. two roof strings declared as separate
//forecast sources) lands one combined curve. Bad rows (unparseable timestamp, non-finite wh) are skipped.
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
    const out: SolarForecastPoint[] = [];
    for (const [tMs, wh] of byMs)
    {
        out.push({ tMs, wh });
    }
    out.sort((a, b) => a.tMs - b.tMs);
    return out;
}


//Read the forecast WATTS at a given bucket time. The HA forecast is hourly (each point's wh equals the average watts
//over that hour). Rather than a stepped hourly read, we linearly interpolate between consecutive hourly points so the
//15-minute store buckets draw a smooth curve instead of flat steps. Returns null when no point covers the time, so the
//store leaves that bucket null and no curve is drawn there.
export function forecastWattsAt(forecast: ReadonlyArray<SolarForecastPoint>, ms: number): number | null
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
        const midIdx = (lo + hi) >> 1;
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
    //Interpolate toward the next hour when it is the consecutive one (no gap larger than ~1 h). The curve passes
    //through each hourly value and transitions linearly between them, smoothing the 15-minute store cadence.
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
