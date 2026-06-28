//Hourly source for the energy-clock on long windows. In month/year the timeline store goes daily (one bucket per
//day), which carries no hour-of-day shape, so the clock can't bin its "average day" from it. This builds a dedicated
//hourly profile (24 hour-of-day averages per metric) over the window, fetched only when needed (clock mode + a
//sub-hourly store). Now/week keep using the store (already >= hourly), so there's no redundant fetch in the common
//case.

import { fetchChangeSeries, outlierCapKwh, type ChangeBucket } from './energy-stats';
import { callWSWithTimeout } from './ws-timeout';
import { modeBucketsPerHour, type TimelineMode } from './timeline-modes';
import { customEntityId, type HeliosConfig } from '../helios-config';
import type { EnergyDefaults } from './energy-prefs';
import { HOUR_MS } from '../constants';

//24 hour-of-day values per metric: energy meters are kWh totals summed over the window; soc is an average %, custom
//an average (watts); consumption is derived from the energy totals. `pv` is per solar source (one 24-vector each, in
//source order), so the dial can split production by string like the short-window path.
export interface ClockHourly
{
    pv:               number[][];
    gridImport:       number[];
    gridExport:       number[];
    batteryCharge:    number[];
    batteryDischarge: number[];
    consumption:      number[];
    soc:              number[];
    custom:           number[];
}

export interface ClockHourlyHost
{
    hass:            any;
    config:          HeliosConfig | undefined;
    _timeRange:      { start: Date; end: Date } | null;
    _energyDefaults: EnergyDefaults;
    _timelineMode:   TimelineMode;
    _viewMode?:      'scene' | 'clock';
    _clockHourly:    ClockHourly | null;
    _clockHourlyKey: string;
    requestUpdate(): void;
}

//True when the clock needs its own hourly source: clock mode AND a store coarser than hourly (month/year).
export function clockNeedsHourly(host: ClockHourlyHost): boolean
{
    return host._viewMode === 'clock' && modeBucketsPerHour(host._timelineMode, host.config) < 1;
}

//Bin a recorder change-series into 24 hour-of-day energy totals (kWh), summed over the window. Single-direction
//meters (stat_energy_from/to), so a negative change is a meter-reset artefact floored at 0. Summing the kWh directly
//(no division by bucket duration) gives the "total per period" the clock shows and avoids the DST-folded / partial
//buckets that a /duration average blows up into a spike at 23h/13h.
function binChangeByHour(buckets: ChangeBucket[] | null): number[]
{
    const sum = new Array<number>(24).fill(0);
    if (!buckets) { return sum; }
    //Same shared outlier rule as the store curves: a reset/rollover dumps the accumulated total into one bucket.
    const cap = outlierCapKwh(buckets);
    for (const b of buckets)
    {
        if (!isFinite(b.kwh) || Math.abs(b.kwh) > cap) { continue; }
        sum[new Date(b.startMs).getHours()] += Math.max(0, b.kwh);
    }
    return sum;
}

//Fetch hourly statistics and bin one value by hour-of-day. `power`: energy/power meters resolved to watts (mean
//preferred, else change/duration); otherwise the raw mean (SoC %).
async function statByHour(hass: any, ids: string[], startMs: number, endMs: number, power: boolean): Promise<number[]>
{
    const sum = new Array<number>(24).fill(0);
    const cnt = new Array<number>(24).fill(0);
    if (!ids.length) { return sum; }
    try
    {
        const res: any = await callWSWithTimeout<any>(hass, {
            type:          'recorder/statistics_during_period',
            start_time:    new Date(startMs).toISOString(),
            end_time:      new Date(endMs).toISOString(),
            statistic_ids: [...ids].sort(),
            period:        'hour',
            types:         power ? ['mean', 'change'] : ['mean'],
            ...(power ? { units: { energy: 'kWh', power: 'W' } } : {}),
        });
        for (const id of ids)
        {
            const buckets: any[] = Array.isArray(res?.[id]) ? res[id] : [];
            for (const b of buckets)
            {
                const tMs = typeof b?.start === 'number' ? b.start : Date.parse(b?.start);
                if (!isFinite(tMs)) { continue; }
                let v: number | null = null;
                if (typeof b?.mean === 'number' && isFinite(b.mean)) { v = b.mean; }
                else if (power && typeof b?.change === 'number' && isFinite(b.change))
                {
                    const endB  = typeof b?.end === 'number' ? b.end : Date.parse(b?.end);
                    const hours = (endB - tMs) / HOUR_MS;
                    v = hours > 0 ? (b.change / hours) * 1000 : null;
                }
                if (v === null || !isFinite(v)) { continue; }
                const h = new Date(tMs).getHours();
                sum[h] += power ? Math.abs(v) : v;
                cnt[h] += 1;
            }
        }
    }
    catch (_) { /* leave zeros */ }
    return sum.map((s, h) => (cnt[h] ? s / cnt[h] : 0));
}

//Build (or clear) the hourly clock profile for the active window. Keyed so an unchanged window never refetches.
export async function refreshClockHourly(host: ClockHourlyHost): Promise<void>
{
    if (!clockNeedsHourly(host) || !host.hass?.callWS || !host._timeRange)
    {
        if (host._clockHourly !== null) { host._clockHourly = null; host.requestUpdate(); }
        host._clockHourlyKey = '';
        return;
    }
    const d   = host._energyDefaults;
    const cid = customEntityId(host.config);
    const startMs = host._timeRange.start.getTime();
    //Quantise the end to the whole hour: Date.now() advances every frame, and an unquantised end would churn the key
    //every render, refetching in a loop and (with the null-on-change below) flashing the dial.
    const endMs   = Math.floor(Math.min(Date.now(), host._timeRange.end.getTime()) / HOUR_MS) * HOUR_MS;
    if (startMs >= endMs) { return; }

    const key = `${startMs}|${endMs}|${d.solarStatEnergyFroms}|${d.gridStatEnergyFroms}|${d.gridStatEnergyTos}|${d.batteryStatEnergyTos}|${d.batteryStatEnergyFroms}|${d.batteryStatSocs}|${cid}`;
    if (key === host._clockHourlyKey) { return; }
    //Drop the stale profile up front only when the window itself changed (start moved = a mode switch), so the reload
    //grow gate sees null until the new data lands. A benign end-of-window tick keeps the old profile so the dial
    //never flashes the daily-store fallback.
    const windowChanged = !host._clockHourlyKey.startsWith(`${startMs}|`);
    host._clockHourlyKey = key;
    if (windowChanged && host._clockHourly !== null) { host._clockHourly = null; host.requestUpdate(); }

    const chg = (ids: string[]): Promise<ChangeBucket[] | null> =>
        ids.length ? fetchChangeSeries(host.hass, [...ids].sort(), startMs, endMs, 'hour') : Promise.resolve(null);
    //Each solar source separately, in HA Energy source order (not sorted), so source `s` lines up with
    //solarSourceName(host, s) + the store path.
    const solarIds = d.solarStatEnergyFroms;

    const [solarPerSource, gImp, gExp, bChg, bDis, soc, custom] = await Promise.all([
        Promise.all(solarIds.map(id => fetchChangeSeries(host.hass, [id], startMs, endMs, 'hour'))),
        chg(d.gridStatEnergyFroms), chg(d.gridStatEnergyTos),
        chg(d.batteryStatEnergyTos), chg(d.batteryStatEnergyFroms),
        statByHour(host.hass, d.batteryStatSocs, startMs, endMs, false),
        cid ? statByHour(host.hass, [cid], startMs, endMs, true) : Promise.resolve(new Array<number>(24).fill(0)),
    ]);

    const pv               = solarPerSource.map(buckets => binChangeByHour(buckets));
    const pvTotal          = new Array<number>(24).fill(0);
    for (const src of pv) { for (let h = 0; h < 24; h++) { pvTotal[h] += src[h]; } }
    const gridImport       = binChangeByHour(gImp);
    const gridExport       = binChangeByHour(gExp);
    const batteryCharge    = binChangeByHour(bChg);
    const batteryDischarge = binChangeByHour(bDis);
    //Consumption from the same identity the timeline uses: production + import − export − net battery, clamped.
    const consumption = pvTotal.map((p, h) => Math.max(0, p + gridImport[h] - gridExport[h] - (batteryCharge[h] - batteryDischarge[h])));

    host._clockHourly = { pv, gridImport, gridExport, batteryCharge, batteryDischarge, consumption, soc, custom };
    host.requestUpdate();
}
