//Reads HA's native solar-production forecast instead of computing its own. Mirrors the energy-prefs pattern: one
//defensive WS round-trip cached on the host, a throttle / in-flight guard so duplicate cards don't hammer the call, and
//a requestUpdate once the parsed result lands.

import type { EnergyDefaults } from './energy-prefs';
import { FORECAST_THROTTLE_MS } from '../constants';


const HOUR_MS = 3_600_000;
const DAY_MS  = 86_400_000;


//One hourly forecast point. For an hourly wh value the average power across the hour in watts equals the wh number
//(Wh over 1 h), so consumers read watts directly without conversion.
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


//Fetch the HA solar forecast and update the host's cached snapshot. Safe to call repeatedly; any failure (RBAC denied,
//nothing configured, older HA core) collapses silently to an empty forecast so the card never errors.
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
        //Preferred: Helios-Forecast's detail series (sub-hourly future + hourly past). Falls back to HA's generic
        //`energy/solar_forecast` (hourly, future-only) when Helios-Forecast is not the configured provider.
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
        //Transient WS error, RBAC denied, or nothing configured. Leave the forecast empty but flip loaded so the boot
        //spinner doesn't block on a payload that may never arrive.
        host._haSolarForecastLoaded = true;
    }
    finally
    {
        host._haSolarForecastFetching = false;
    }
}


//Try Helios-Forecast's detail websocket for each configured provider entry over the card's J-2..J+2 window. Returns the
//merged points of the first entry that answers, or null when none is a Helios-Forecast entry (caller then falls back to
//HA's generic surface). Each `pv_w` is watts, kept in the .wh slot (hourly: watts == Wh, read as watts either way).
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
            //An empty (but valid) answer means a Helios-Forecast entry with no points in range; still prefer it over the
            //generic surface to avoid double-fetching. A non-Helios entry rejects the command and is skipped.
            return out;
        }
        catch (_)
        {
            //Not a Helios-Forecast entry (unknown command / not_found) or transient error: try the next candidate.
            continue;
        }
    }
    return null;
}


//Merge the per-config-entry wh_hours maps into one hourly forecast: sum wh across every entry reporting the same
//timestamp, then emit a time-sorted array (multi-source installs land one combined curve). Bad rows are skipped.
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


//Read the forecast WATTS at a bucket time. The forecast is hourly; we linearly interpolate between consecutive points
//so the 15-minute store buckets draw a smooth curve instead of flat steps. Returns null when no point covers the time.
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
