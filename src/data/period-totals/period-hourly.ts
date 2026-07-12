//Hourly source for the period aggregation on long windows. In month/year the timeline store goes daily (one bucket
//per day), which carries no hour-of-day shape, so the aggregation can't bin its "average day" from it. This builds a
//dedicated hourly profile (24 hour-of-day averages per metric) over the window, fetched only when needed (the detail
//panel open on a sub-hourly store). Now/week keep using the store (already >= hourly), so there's no redundant fetch
//in the common case.

import { fetchChangeSeries, outlierCapKwh, type ChangeBucket } from '../sources/energy-stats';
import { callWS } from '../ha-gateway';
import { modeBucketsPerHour, type TimelineMode } from '../../timeline/timeline-modes';
import type { HeliosConfig } from '../../core/config/helios-config';
import { consumptionLoad } from '../../core/energy';
import type { EnergyDefaults } from '../sources/energy-prefs';
import { serverHour } from '../../core/time/timezone';
import { HOUR_MS, HOURS_PER_DAY} from '../../core/config/constants';

//24 hour-of-day values per metric: energy meters are kWh totals summed over the window; soc is an average %;
//consumption is derived from the energy totals. `pv` is per solar source (one 24-vector each, in source order),
//so production splits by string like the short-window path.
export interface PeriodHourly
{
    pv:               number[][];
    gridImport:       number[];
    gridExport:       number[];
    batteryCharge:    number[];
    batteryDischarge: number[];
    consumption:      number[];
    soc:              number[];
}

interface PeriodHourlyHost
{
    hass:            any;
    config:          HeliosConfig | undefined;
    _timeRange:      { start: Date; end: Date } | null;
    _energyDefaults: EnergyDefaults;
    _timelineMode:   TimelineMode;
    //Detail panel open: it aggregates period totals from this profile, so on a coarse window it needs it fetched.
    _infoPanelOpen?: boolean;
    _periodHourly:    PeriodHourly | null;
    _periodHourlyKey: string;
    requestUpdate(): void;
}

//True when the hourly source is needed: a store coarser than hourly (month/year) AND the detail panel is open (it
//aggregates period totals from this profile).
function periodNeedsHourly(host: PeriodHourlyHost): boolean
{
    if (modeBucketsPerHour(host._timelineMode, host.config) >= 1) { return false; }
    return host._infoPanelOpen === true;
}

//Bin a recorder change-series into 24 hour-of-day energy totals (kWh), summed over the window. Single-direction
//meters (stat_energy_from/to), so a negative change is a meter-reset artefact floored at 0. Summing the kWh directly
//(no division by bucket duration) gives the "total per period" the panel shows and avoids the DST-folded / partial
//buckets that a /duration average blows up into a spike at 23h/13h.
function binChangeByHour(buckets: ChangeBucket[] | null): number[]
{
    const sum = new Array<number>(HOURS_PER_DAY).fill(0);
    if (!buckets) { return sum; }
    //Same shared outlier rule as the store curves: a reset/rollover dumps the accumulated total into one bucket.
    const cap = outlierCapKwh(buckets);
    for (const b of buckets)
    {
        if (!isFinite(b.kwh) || Math.abs(b.kwh) > cap) { continue; }
        sum[serverHour(b.startMs)] += Math.max(0, b.kwh);
    }
    return sum;
}

//Fetch hourly statistics and bin one value by hour-of-day. `power`: energy/power meters resolved to watts (mean
//preferred, else change/duration); otherwise the raw mean (SoC %).
async function statByHour(hass: any, ids: string[], startMs: number, endMs: number, power: boolean): Promise<number[]>
{
    const sum = new Array<number>(HOURS_PER_DAY).fill(0);
    const cnt = new Array<number>(HOURS_PER_DAY).fill(0);
    if (!ids.length) { return sum; }
    try
    {
        const res: any = await callWS<any>(hass, {
            type:          'recorder/statistics_during_period',
            start_time:    new Date(startMs).toISOString(),
            end_time:      new Date(endMs).toISOString(),
            statistic_ids: [...ids].sort(),
            period:        'hour',
            //Power slots read the recorded per-bucket mean ONLY (measured watts): a mis-picked energy
            //meter yields nothing rather than watts derived from its kWh deltas.
            types:         ['mean'],
            ...(power ? { units: { power: 'W' } } : {}),
        });
        for (const id of ids)
        {
            const buckets: any[] = Array.isArray(res?.[id]) ? res[id] : [];
            for (const b of buckets)
            {
                const tMs = typeof b?.start === 'number' ? b.start : Date.parse(b?.start);
                if (!isFinite(tMs)) { continue; }
                const v = typeof b?.mean === 'number' && isFinite(b.mean) ? b.mean : null;
                if (v === null) { continue; }
                const h = serverHour(tMs);
                sum[h] += power ? Math.abs(v) : v;
                cnt[h] += 1;
            }
        }
    }
    catch (_) { /* leave zeros */ }
    return sum.map((s, h) => (cnt[h] ? s / cnt[h] : 0));
}

//Fetch the 24 hour-of-day profile for an arbitrary window. Pure (no host state).
async function fetchHourlyProfile(
    hass: any, d: EnergyDefaults, startMs: number, endMs: number,
): Promise<PeriodHourly>
{
    const chg = (ids: string[]): Promise<ChangeBucket[] | null> =>
        ids.length ? fetchChangeSeries(hass, [...ids].sort(), startMs, endMs, 'hour') : Promise.resolve(null);
    //Each solar source separately, in HA Energy source order (not sorted), so source `s` lines up with the
    //store path.
    const solarIds = d.solarStatEnergyFroms;

    const [solarPerSource, gImp, gExp, bChg, bDis, soc] = await Promise.all([
        Promise.all(solarIds.map(id => fetchChangeSeries(hass, [id], startMs, endMs, 'hour'))),
        chg(d.gridStatEnergyFroms), chg(d.gridStatEnergyTos),
        chg(d.batteryStatEnergyTos), chg(d.batteryStatEnergyFroms),
        statByHour(hass, d.batteryStatSocs, startMs, endMs, false),
    ]);

    const pv               = solarPerSource.map(buckets => binChangeByHour(buckets));
    const pvTotal          = new Array<number>(HOURS_PER_DAY).fill(0);
    for (const src of pv) { for (let h = 0; h < HOURS_PER_DAY; h++) { pvTotal[h] += src[h]; } }
    const gridImport       = binChangeByHour(gImp);
    const gridExport       = binChangeByHour(gExp);
    const batteryCharge    = binChangeByHour(bChg);
    const batteryDischarge = binChangeByHour(bDis);
    //Consumption from the same identity the timeline uses: production + import - export - net battery, clamped.
    const consumption = pvTotal.map((p, h) => consumptionLoad(p, gridImport[h], gridExport[h], batteryCharge[h] - batteryDischarge[h]));

    return { pv, gridImport, gridExport, batteryCharge, batteryDischarge, consumption, soc };
}

//Build (or clear) the hourly profile for the active window. Keyed so an unchanged window never refetches.
export async function refreshPeriodHourly(host: PeriodHourlyHost): Promise<void>
{
    if (!periodNeedsHourly(host) || !host.hass?.callWS || !host._timeRange)
    {
        if (host._periodHourly !== null) { host._periodHourly = null; host.requestUpdate(); }
        host._periodHourlyKey = '';
        return;
    }
    const d   = host._energyDefaults;
    const startMs = host._timeRange.start.getTime();
    //Quantise the end to the whole hour: Date.now() advances every frame, and an unquantised end would churn the key
    //every render, refetching in a loop and (with the null-on-change below) flashing the panel.
    const endMs   = Math.floor(Math.min(Date.now(), host._timeRange.end.getTime()) / HOUR_MS) * HOUR_MS;
    if (startMs >= endMs) { return; }

    const key = `${startMs}|${endMs}|${d.solarStatEnergyFroms}|${d.gridStatEnergyFroms}|${d.gridStatEnergyTos}|${d.batteryStatEnergyTos}|${d.batteryStatEnergyFroms}|${d.batteryStatSocs}`;
    if (key === host._periodHourlyKey) { return; }
    //Drop the stale profile up front only when the window itself changed (start moved = a mode switch), so the reload
    //grow gate sees null until the new data lands. A benign end-of-window tick keeps the old profile so the panel
    //never flashes the daily-store fallback.
    const windowChanged = !host._periodHourlyKey.startsWith(`${startMs}|`);
    host._periodHourlyKey = key;
    if (windowChanged && host._periodHourly !== null) { host._periodHourly = null; host.requestUpdate(); }

    host._periodHourly = await fetchHourlyProfile(host.hass, d, startMs, endMs);
    host.requestUpdate();
}
