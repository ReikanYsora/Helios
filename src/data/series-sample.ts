//Series sampling helpers shared across the timeline charts: generic linear interpolation and the PV
//value-at-instant resolver (recorder change series -> forecast, with a below-horizon floor on the
//forecast branch only).

import type { ChartHost } from '../charts/charts';
import { getHomeCoords } from '../card/init';
import { getSunPosition } from '../core/time/sun';
import { valueAt } from './unifiedStore';
import { wattsAtFromChangeSeries } from './sources/energy-stats';


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
    //Optional per-source meter id (multi-source tooltip rows, stacked bands, clock rings): reads that
    //meter's own recorder change series; rows read a dash until the per-source fetch lands.
    sourceMeterId?: string,
): { value: number; unit: string; isPredicted: boolean }
{
    //Observed past (and the live edge): the recorder `change` metric of the solar meter(s), the exact
    //data the HA Energy dashboard consumes, expressed as the bucket's average watts. Never a
    //client-side differentiation of counter states.
    const series = sourceMeterId
        ? host._pvChangeSeriesPerEntity.get(sourceMeterId) ?? null
        : host._pvChangeSeries;
    const w = wattsAtFromChangeSeries(series, targetMs);
    if (w !== null)
    {
        return { value: Math.max(0, w), unit: 'W', isPredicted: false };
    }
    //Per-source rows carry no forecast: a future (or not-yet-fetched) cursor reads a dash.
    if (sourceMeterId)
    {
        return { value: NaN, unit: 'W', isPredicted: false };
    }

    //Forecast for future hours: read the store's corrected forecast at the cursor instant (same series
    //the dotted curve draws), so the tooltip never disagrees with its line. Already cap-clipped and
    //correction-applied.
    const store = host._unifiedStore;
    if (store)
    {
        const fw = valueAt(store.forecast, store, targetMs);
        if (fw !== null && fw > 0)
        {
            //Forecast-only sun floor: a predicted pair straddling sunrise/sunset can leak a few watts
            //below the horizon. Zero it so the dashed curve doesn't glow at night; recorded data above
            //is left untouched.
            const coords = getHomeCoords(host.config, host.hass);
            if (coords && getSunPosition(new Date(targetMs), coords.lat, coords.lon).altitude <= 0)
            {
                return { value: 0, unit: 'W', isPredicted: true };
            }
            return { value: Math.max(0, fw), unit: 'W', isPredicted: true };
        }
    }

    return { value: NaN, unit: 'W', isPredicted: false };
}
