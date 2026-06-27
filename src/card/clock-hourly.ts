//Decoupled hourly source for the energy-clock on long windows. The timeline store goes DAILY in month/year
//(one bucket per day), which carries no hour-of-day shape — so the clock can't bin its "average day" from it.
//This builds a dedicated HOURLY profile (24 hour-of-day averages per metric) over the window, fetched only
//when it's actually needed (clock mode + a sub-hourly store). Now/week keep using the store (already >= hourly),
//so there's no redundant fetch in the common case.

import { fetchChangeSeries, type ChangeBucket } from './energy-stats';
import { callWSWithTimeout } from './ws-timeout';
import { modeBucketsPerHour, type TimelineMode } from './timeline-modes';
import { customEntityId, type HeliosConfig } from '../helios-config';
import type { EnergyDefaults } from './energy-prefs';
import { HOUR_MS } from '../constants';

//A change bucket above this multiple of the median positive bucket is a meter reset/rollover artefact, not real
//flow, and is dropped from the hour-of-day sums.
const OUTLIER_CAP_FACTOR = 20;

//24 hour-of-day values per metric: energy meters are kWh TOTALS summed over the window; soc is an average %,
//custom an average (watts). consumption is derived from the energy totals.
export interface ClockHourly
{
    pv:               number[];
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
    _viewMode?:      'scene' | 'clock' | 'lidar';
    _clockHourly:    ClockHourly | null;
    _clockHourlyKey: string;
    requestUpdate(): void;
}

//True when the clock needs its own hourly source: clock mode AND a store coarser than hourly (month/year).
export function clockNeedsHourly(host: ClockHourlyHost): boolean
{
    return host._viewMode === 'clock' && modeBucketsPerHour(host._timelineMode, host.config) < 1;
}

//Bin a recorder change-series into 24 hour-of-day ENERGY TOTALS (kWh), SUMMED over the window. Single-direction
//meters (stat_energy_from/to), so a negative change is a meter-reset artefact floored at 0. Summing the kWh
//directly (no division by the bucket duration) is both the "total per period" the clock shows AND the fix for
//the DST-folded / partial buckets that the old /duration average blew up into the 190 kW spike at 23h/13h.
function binChangeByHour(buckets: ChangeBucket[] | null): number[]
{
    const sum = new Array<number>(24).fill(0);
    if (!buckets) { return sum; }
    //Reject extreme positive outliers: a meter reset/rollover emits one bucket whose change is the whole
    //accumulated total (hundreds of kWh), survives the >=0 floor, and would spike a single hour. Cap at a
    //generous multiple of the median positive bucket — well above any real hour, far below a rollover.
    const positives = buckets.map(b => b.kwh).filter(k => isFinite(k) && k > 0).sort((a, b) => a - b);
    const median = positives.length ? positives[Math.floor(positives.length / 2)] : 0;
    const cap    = median > 0 ? median * OUTLIER_CAP_FACTOR : Infinity;
    for (const b of buckets)
    {
        if (!isFinite(b.kwh)) { continue; }
        const kwh = Math.max(0, b.kwh);
        if (kwh > cap) { continue; }
        sum[new Date(b.startMs).getHours()] += kwh;
    }
    return sum;
}

//Fetch hourly statistics and bin one value by hour-of-day. `power` => energy/power meters resolved to watts
//(mean preferred, else change/duration); otherwise the raw mean (SoC %).
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
    const endMs   = Math.min(Date.now(), host._timeRange.end.getTime());
    if (startMs >= endMs) { return; }

    const key = `${startMs}|${endMs}|${d.solarStatEnergyFroms}|${d.gridStatEnergyFroms}|${d.gridStatEnergyTos}|${d.batteryStatEnergyTos}|${d.batteryStatEnergyFroms}|${d.batteryStatSocs}|${cid}`;
    if (key === host._clockHourlyKey) { return; }
    //Window changed: drop the stale profile up front so consumers (the reload grow gate) see _clockHourly as
    //null through the await and only treat it as ready once the NEW window's data below has actually landed.
    if (host._clockHourly !== null) { host._clockHourly = null; host.requestUpdate(); }
    host._clockHourlyKey = key;

    const chg = (ids: string[]): Promise<ChangeBucket[] | null> =>
        ids.length ? fetchChangeSeries(host.hass, [...ids].sort(), startMs, endMs, 'hour') : Promise.resolve(null);

    const [solar, gImp, gExp, bChg, bDis, soc, custom] = await Promise.all([
        chg(d.solarStatEnergyFroms), chg(d.gridStatEnergyFroms), chg(d.gridStatEnergyTos),
        chg(d.batteryStatEnergyTos), chg(d.batteryStatEnergyFroms),
        statByHour(host.hass, d.batteryStatSocs, startMs, endMs, false),
        cid ? statByHour(host.hass, [cid], startMs, endMs, true) : Promise.resolve(new Array<number>(24).fill(0)),
    ]);

    const pv               = binChangeByHour(solar);
    const gridImport       = binChangeByHour(gImp);
    const gridExport       = binChangeByHour(gExp);
    const batteryCharge    = binChangeByHour(bChg);
    const batteryDischarge = binChangeByHour(bDis);
    //Consumption from the same identity the timeline uses: production + import − export − net battery, clamped.
    const consumption = pv.map((p, h) => Math.max(0, p + gridImport[h] - gridExport[h] - (batteryCharge[h] - batteryDischarge[h])));

    host._clockHourly = { pv, gridImport, gridExport, batteryCharge, batteryDischarge, consumption, soc, custom };
    host.requestUpdate();
}
