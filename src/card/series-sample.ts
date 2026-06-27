//Series sampling helpers shared across the timeline charts: generic linear interpolation and the PV-specific
//value-at-instant resolver (observed history -> LTS calibration -> forecast, with a below-horizon floor).

import type { ChartHost } from './charts';
import { getHomeCoords } from './init';
import { getSunPosition } from '../engine/sun';
import { valueAt } from './unifiedStore';


//Linear-interpolate a (strictly time-ascending) series at a target timestamp. Out-of-range targets clamp to the
//nearest endpoint; NaN slots yield NaN so the caller skips rendering. Shared by the hover tooltip + dot positions
//across the irradiance, cloud and PV curves.
export function interpAt(times: Date[], values: number[], targetMs: number): number
{
    const n = Math.min(times.length, values.length);
    if (n === 0)
    {
        return NaN;
    }
    if (targetMs <= times[0].getTime())
    {
        return isFinite(values[0]) ? values[0] : NaN;
    }
    if (targetMs >= times[n - 1].getTime())
    {
        const v = values[n - 1];
        return isFinite(v) ? v : NaN;
    }
    //Binary search the bracketing pair in O(log n) (early returns above guarantee times[0] < targetMs < times[n-1]).
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1)
    {
        const mid = Math.trunc((lo + hi) / 2);
        if (times[mid].getTime() <= targetMs)
        {
            lo = mid;
        }
        else
        {
            hi = mid;
        }
    }
    const t0 = times[lo].getTime();
    const t1 = times[hi].getTime();
    const v0 = values[lo];
    const v1 = values[hi];
    if (!isFinite(v0) || !isFinite(v1))
    {
        return NaN;
    }
    const dt = t1 - t0;
    if (dt <= 0)
    {
        return v1;
    }
    return v0 + (v1 - v0) * (targetMs - t0) / dt;
}


export function pvValueAtTime(
    host: ChartHost,
    targetMs: number,
    //Optional per-source history override (multi-source tooltip rows). Reads this series instead of the aggregated
    //`_pvHistory`; the calibration/LTS and forecast fallbacks are skipped in override mode (no per-entity LTS yet),
    //so a per-entity row reads "—" past its history's tail.
    seriesOverride?: { times: Date[]; values: number[] },
): { value: number; unit: string; isPredicted: boolean }
{
    const luRaw = (host._pvUnit || '').trim();
    if (!luRaw)
    {
        return { value: NaN, unit: '', isPredicted: false };
    }
    const lu             = luRaw.toLowerCase();
    const isCumulative   = lu === 'wh' || lu === 'kwh' || lu === 'mwh';
    const displayUnit    = isCumulative
        ? (lu === 'kwh' ? 'kW' : lu === 'mwh' ? 'MW' : 'W')
        : luRaw;
    const duLow = displayUnit.toLowerCase();
    const nativeFromW    = duLow === 'kw' ? 1 / 1000
                         : duLow === 'mw' ? 1 / 1_000_000
                         : 1;

    //Hard zero when the sun is below the horizon at the cursor instant. Catches stale observed samples clamped
    //forward into the night, forecast pairs straddling sunrise/sunset leaking a few watts, and inverter standby
    //readings (0.5-2 W) all night. Panels can't produce without sun, so we enforce that physical floor.
    const coords = getHomeCoords(host.config, host.hass);
    if (coords && getSunPosition(new Date(targetMs), coords.lat, coords.lon).altitude <= 0)
    {
        return { value: 0, unit: displayUnit, isPredicted: false };
    }

    //Observed history. Cumulative entities differentiate the bracketing pair; power entities interpolate. Floor at
    //zero so sensor/net-meter noise never shows "-2 W". Instants beyond the last observed sample fall through to the
    //forecast pass: clamping interpAt would freeze the tooltip on yesterday's late-afternoon reading.
    const hist = seriesOverride ?? host._pvHistory;
    const rawFirstMs = (hist && hist.times.length >= 1)
        ? hist.times[0].getTime()
        : Infinity;
    const lastObsMs = (hist && hist.times.length >= 1)
        ? hist.times[hist.times.length - 1].getTime()
        : -Infinity;
    if (hist && hist.times.length >= 2 && targetMs >= rawFirstMs && targetMs <= lastObsMs)
    {
        if (isCumulative)
        {
            for (let i = 1; i < hist.times.length; i++)
            {
                const t1 = hist.times[i].getTime();
                if (targetMs > t1)
                {
                    continue;
                }
                const t0 = hist.times[i - 1].getTime();
                if (targetMs < t0)
                {
                    break;
                }
                const dtH = (t1 - t0) / 3_600_000;
                if (dtH <= 0 || dtH > 6)
                {
                    break;
                }
                const dv = hist.values[i] - hist.values[i - 1];
                if (!isFinite(dv) || dv < 0)
                {
                    break;
                }
                return { value: Math.max(0, dv / dtH), unit: displayUnit, isPredicted: false };
            }
        }
        else
        {
            const v = interpAt(hist.times, hist.values, targetMs);
            if (isFinite(v))
            {
                return { value: Math.max(0, v), unit: displayUnit, isPredicted: false };
            }
        }
    }
    //Older past, before the head of the raw 6-hour window: fall back to the hourly LTS slot calibration fetched.
    //LTS values are already in native power units, so interpolation is correct regardless of entity type. Skipped in
    //`seriesOverride` mode (no per-entity LTS yet, override carries only the 6 h raw window) -> per-entity rows read "—".
    if (!seriesOverride)
    {
        const calib = host._pvCalibStats;
        if (calib && calib.times.length >= 2 && targetMs <= lastObsMs)
        {
            if (isCumulative)
            {
                //_pvCalibStats carries the meter's cumulative `state` (kWh) per LTS bucket for energy sensors, NOT
                //power. Differentiate the bracketing pair into average power; reading cumulative straight through
                //inflates the readout ~1000x.
                for (let i = 1; i < calib.times.length; i++)
                {
                    const t1 = calib.times[i].getTime();
                    if (targetMs > t1)
                    {
                        continue;
                    }
                    const t0 = calib.times[i - 1].getTime();
                    if (targetMs < t0)
                    {
                        break;
                    }
                    const dtH = (t1 - t0) / 3_600_000;
                    if (dtH <= 0 || dtH > 6)
                    {
                        break;
                    }
                    const dv = calib.values[i] - calib.values[i - 1];
                    if (!isFinite(dv) || dv < 0)
                    {
                        break;
                    }
                    return { value: Math.max(0, dv / dtH), unit: displayUnit, isPredicted: false };
                }
            }
            else
            {
                const v = interpAt(calib.times, calib.values, targetMs);
                if (isFinite(v))
                {
                    return { value: Math.max(0, v), unit: displayUnit, isPredicted: false };
                }
            }
        }
    }

    //Override mode has no per-source forecast yet, so stop on a future cursor and let the caller show "—". The
    //aggregated path below stays unchanged for the headline forecast.
    if (seriesOverride)
    {
        return { value: NaN, unit: displayUnit, isPredicted: false };
    }

    //Forecast for future hours: read the store's CORRECTED forecast at the cursor instant (same series the dotted
    //curve draws), so the tooltip never disagrees with its line. Already cap-clipped and correction-applied.
    const store = host._unifiedStore;
    if (store)
    {
        const w = valueAt(store.forecast, store, targetMs);
        if (w !== null && w > 0)
        {
            return { value: Math.max(0, w) * nativeFromW, unit: displayUnit, isPredicted: true };
        }
    }

    return { value: NaN, unit: displayUnit, isPredicted: false };
}
