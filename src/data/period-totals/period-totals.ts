//Period-aggregation for the scene detail panel: bins the store + histories by hour-of-day into stacked metric
//layers (production split per source, grid into import/export, battery into charge/discharge). Each hour
//aggregates the metric over the whole rolling window (a single day shows that day's shape; a longer range
//averages it). Data comes from the store + histories already loaded, no extra fetch.

import { HOUR_MS, HOURS_PER_DAY } from '../../core/config/constants';
import type { ChartTarget, ChartHost } from '../../charts/charts';
import { changeSeriesToWatts } from '../sources/energy-stats';
import { consumptionLoad } from '../../core/energy';
import type { UnifiedDataStore } from '../unifiedStore';
import type { PeriodHourly } from './period-hourly';
import { modeBucketsPerHour, type TimelineMode } from '../../timeline/timeline-modes';
import type { EnergyDefaults } from '../sources/energy-prefs';
import { serverHourFrac } from '../../core/time/timezone';

//Structural surface the aggregation reads off the card.
export type PeriodHost = ChartHost & {
    _timelineMode: TimelineMode;
    _energyDefaults: EnergyDefaults;
    //Decoupled hourly profile, present only in month/year mode (daily store). When set, buildPeriodData reads it
    //instead of the store so the aggregation still resolves an hour-of-day shape.
    _periodHourly: PeriodHourly | null;
};

//One stacked layer of a metric: a per-slot series (TOTAL_SLOTS values) aggregated to 24 hourly bars. Layers
//stack cumulatively.
export interface PeriodLayer
{
    values:     number[];     //TOTAL_SLOTS per-slot magnitudes (W or %)
}

export interface PeriodData
{
    layers: PeriodLayer[];
    //Aggregation. 'energy' metrics (production/consumption/grid/battery) SUM kWh over the window per hour-of-day
    //(a total); 'percent' (state of charge) AVERAGES.
    unit:   'energy' | 'percent';
}


//Resolution: sub-hourly slots binning the metric finer than hourly (the aggregation re-sums to 24 hourly bars).
//Fixed at 4 slots/hour: per-hour totals are independent of the slot count.
const SLOTS_PER_HOUR = 4;
const TOTAL_SLOTS = 24 * SLOTS_PER_HOUR;

//Slot-of-day [0..TOTAL_SLOTS) for an instant, in the HOME time zone (see ../../core/time/timezone) so it groups
//by the home's real hour of day, not the browser's.
function slotOf(ms: number): number
{
    return Math.min(TOTAL_SLOTS - 1, Math.floor(serverHourFrac(ms) * SLOTS_PER_HOUR));
}

//Fill NaN gaps by linear interpolation between nearest real samples, wrapping the day, so an HOURLY-sourced
//metric (sparse sub-hour slots: battery SoC) reads as a smooth ramp instead of a spike once per hour. Sub-hour-
//dense store metrics have no gaps (no-op). All-NaN collapses to zeros.
function fillGaps(v: number[]): number[]
{
    const n = v.length;
    if (!v.some(x => Number.isFinite(x))) { return new Array<number>(n).fill(0); }
    const out = v.slice();
    for (let i = 0; i < n; i++)
    {
        if (Number.isFinite(out[i])) { continue; }
        let db = 1; while (!Number.isFinite(v[((i - db) % n + n) % n])) { db++; }
        let df = 1; while (!Number.isFinite(v[(i + df) % n])) { df++; }
        const a = v[((i - db) % n + n) % n];
        const b = v[(i + df) % n];
        out[i] = a + (b - a) * (db / (db + df));
    }
    return out;
}

//Expand a 24-value hour-of-day profile to the per-slot resolution. For `sum` (energy) the hour's TOTAL splits
//evenly across its slots, so re-summing recovers the total; otherwise the hourly value is HELD across its slots,
//and averaging back recovers it.
function expandHourly(hourly: number[], sum: boolean): number[]
{
    const slots = TOTAL_SLOTS;
    const out = new Array<number>(slots);
    for (let i = 0; i < slots; i++)
    {
        const v = Math.max(0, hourly[Math.floor(i / SLOTS_PER_HOUR)] ?? 0);
        out[i] = sum ? v / SLOTS_PER_HOUR : v;
    }
    return out;
}

//Sum one store WATTS series into per-slot ENERGY (kWh) by hour-of-day. Each bucket's energy is SPREAD across
//the slots it covers, so a coarse store (e.g. hourly buckets in month mode) fills every slot evenly instead of
//dumping a whole hour into one slot (the sawtooth). Summing kWh directly (not watts/duration) keeps DST-folded
//buckets from inflating. This is the "total per period".
function binSlotSum(store: UnifiedDataStore, series: (number | null)[]): number[]
{
    const sum    = new Array<number>(TOTAL_SLOTS).fill(0);
    const stepH  = store.stepMs / HOUR_MS;
    const slotMs = HOUR_MS / SLOTS_PER_HOUR;
    for (let i = 0; i < store.bucketsTotal; i++)
    {
        const v = series[i];
        if (v === null || !isFinite(v)) { continue; }
        const energy = (Math.max(0, v) * stepH) / 1000;   //kWh for this bucket
        const bStart = store.storeStartMs + i * store.stepMs;
        const bEnd   = bStart + store.stepMs;
        for (let t = bStart; t < bEnd; )
        {
            const slotEnd = Math.floor(t / slotMs) * slotMs + slotMs;
            const segEnd  = Math.min(bEnd, slotEnd);
            sum[slotOf(t)] += energy * ((segEnd - t) / store.stepMs);
            t = segEnd;
        }
    }
    return sum;
}


//Build layers from the decoupled hourly profile (month/year daily store): each metric expands its 24
//hour-of-day totals to the slots. Production splits per solar source like the short-window path.
function buildPeriodDataHourly(target: ChartTarget, h: PeriodHourly): PeriodData
{
    const data = (unit: PeriodData['unit'], layers: PeriodLayer[]): PeriodData => ({ unit, layers });
    //Energy metrics expand their hour TOTALS (split across slots); soc holds its hourly average.
    const oneE = (v: number[]): PeriodLayer => ({ values: expandHourly(v, true) });
    const oneA = (v: number[]): PeriodLayer => ({ values: expandHourly(v, false) });
    switch (target)
    {
        case 'production':  return data('energy', h.pv.map(vals => oneE(vals)));
        case 'consumption': return data('energy', [oneE(h.consumption)]);
        case 'grid':        return data('energy', [oneE(h.gridImport), oneE(h.gridExport)]);
        case 'battery':     return data('energy', [oneE(h.batteryDischarge), oneE(h.batteryCharge)]);
        case 'battery-soc': return data('percent', [oneA(h.soc)]);
        default:            return data('energy', []);
    }
}

//Build the stacked layers for the active metric. Production keeps a per-source breakdown; every other metric
//reuses the store series the timeline draws, binned by hour-of-day (same numbers). On a long window the daily
//store carries no intraday shape, so the decoupled hourly profile (host._periodHourly) takes over.
export function buildPeriodData(host: PeriodHost, target: ChartTarget): PeriodData
{
    if (host._periodHourly) { return buildPeriodDataHourly(target, host._periodHourly); }

    const store  = host._unifiedStore;

    const data = (unit: PeriodData['unit'], layers: PeriodLayer[]): PeriodData => ({ unit, layers });

    //Month/year need the decoupled hourly profile; until it lands, render empty rather than the daily store,
    //which has no hour-of-day shape and would draw a flat full-height bar.
    if (modeBucketsPerHour(host._timelineMode, host.config) < 1)
    {
        return data('energy', []);
    }

    if (target === 'production')
    {
        if (!store) { return data('energy', []); }
        const nowMs = Date.now();
        const stepH  = store.stepMs / HOUR_MS;
        const slotMs = HOUR_MS / SLOTS_PER_HOUR;
        //Per-source production from the recorder `change` metric (reset-corrected, exact HA Energy energy,
        //no sun floor), so each string matches the dashboard and recorded night production from non-solar
        //sources fed in as PV shows. Multi-source layers wait for the per-source fetch (a beat after load);
        //a single source reads the aggregate series, which IS its meter. Source order (NOT sorted):
        //parallel to solarStatEnergyFroms.
        const meters = host._energyDefaults.solarStatEnergyFroms;
        const usePerSourceChange = meters.length >= 2 && meters.every((m) => host._pvChangeSeriesPerEntity.has(m));
        const ids = usePerSourceChange ? meters : meters.slice(0, 1);
        const perSourceWatts = usePerSourceChange
            ? meters.map((m) => changeSeriesToWatts(host._pvChangeSeriesPerEntity.get(m) ?? null, store.storeStartMs, store.stepMs, store.bucketsTotal, nowMs))
            : (meters.length === 1 ? [changeSeriesToWatts(host._pvChangeSeries, store.storeStartMs, store.stepMs, store.bucketsTotal, nowMs)] : []);
        //Per-source energy (kWh) SUMMED by hour-of-day: each bucket's power * its hours, SPREAD across the slots
        //it covers, so a coarse store fills every slot instead of one (as in binSlotSum).
        const wsum = ids.map(() => new Array<number>(TOTAL_SLOTS).fill(0));
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs > nowMs) { break; }
            const bStart = store.storeStartMs + i * store.stepMs;
            const bEnd   = bStart + store.stepMs;
            for (let s = 0; s < ids.length; s++)
            {
                const w = perSourceWatts[s]?.[i];
                if (w === null || w === undefined || !(w > 0)) { continue; }
                const v = w;
                const energy = (v * stepH) / 1000;
                for (let t = bStart; t < bEnd; )
                {
                    const slotEnd = Math.floor(t / slotMs) * slotMs + slotMs;
                    const segEnd  = Math.min(bEnd, slotEnd);
                    wsum[s][slotOf(t)] += energy * ((segEnd - t) / store.stepMs);
                    t = segEnd;
                }
            }
        }
        //Actuals only: recorded energy, no forecast layer (a translucent forecast layer reads as real production
        //and misleads; the timeline carries the forecast instead).
        const layers: PeriodLayer[] = ids.map((_id, s) => ({ values: wsum[s] }));
        return data('energy', layers);
    }

    if (target === 'battery-soc')
    {
        //Average a sum/count pair into a per-slot series, interpolating empty slots (hourly sources land in 1 of
        //every 4 slots; fillGaps ramps between them instead of spiking).
        const hist = host._batterySocHistory;
        const sum = new Array<number>(TOTAL_SLOTS).fill(0);
        const cnt = new Array<number>(TOTAL_SLOTS).fill(0);
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const v = hist.values[i];
                if (!isFinite(v)) { continue; }
                const h = slotOf(hist.times[i].getTime());
                sum[h] += v; cnt[h] += 1;
            }
        }
        return data('percent', [{ values: fillGaps(sum.map((v, i) => (cnt[i] ? v / cnt[i] : NaN))) }]);
    }

    //Remaining metrics (grid, battery, consumption) are single- or dual-layer store series, binned by
    //hour-of-day as energy totals.
    if (!store) { return data('energy', []); }

    let specs: { series: (number | null)[] }[];
    if (target === 'grid')
    {
        specs = [{ series: store.gridImport }, { series: store.gridExport }];
    }
    else if (target === 'battery')
    {
        //Signed net power (positive = charging), split into two non-negative layers.
        const charge:    (number | null)[] = store.battery.map(v => (v === null ? null : Math.max(0, v)));
        const discharge: (number | null)[] = store.battery.map(v => (v === null ? null : Math.max(0, -v)));
        specs = [{ series: discharge }, { series: charge }];
    }
    else
    {
        //Consumption derived per bucket: production + import - export - net battery, clamped at 0.
        const cons: (number | null)[] = new Array(store.bucketsTotal).fill(null);
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const p = store.production[i]; const gi = store.gridImport[i];
            const ge = store.gridExport[i]; const b = store.battery[i];
            if (p === null && gi === null && ge === null && b === null) { continue; }
            cons[i] = consumptionLoad(p ?? 0, gi ?? 0, ge ?? 0, b ?? 0);
        }
        specs = [{ series: cons }];
    }

    return data('energy', specs.map(s => ({ values: binSlotSum(store, s.series) })));
}


//Aggregate a per-slot series to 24 hourly values (each bar = one hour H..H+1). `sum` (energy) totals the hour's
//slots; otherwise (percent) it averages them.
export function hourlyOf(values: number[], sum: boolean): number[]
{
    const out = new Array<number>(HOURS_PER_DAY).fill(0);
    for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        let s = 0;
        for (let j = 0; j < SLOTS_PER_HOUR; j++) { s += Math.max(0, values[h * SLOTS_PER_HOUR + j] ?? 0); }
        out[h] = sum ? s : s / SLOTS_PER_HOUR;
    }
    return out;
}

//One layer's aggregate over the whole window, for the panel total: energy SUMS the 24 hourly kWh totals (the
//window's energy), percent AVERAGES them (a representative percent over the window).
export function layerPeriodTotal(layer: PeriodLayer, data: PeriodData): number
{
    const energy = data.unit === 'energy';
    const hv = hourlyOf(layer.values, energy);
    let t = 0; for (let h = 0; h < HOURS_PER_DAY; h++) { t += Math.max(0, hv[h]); }
    return energy ? t : t / HOURS_PER_DAY;
}

//A metric's window aggregate across all its layers (the grand total a single-layer metric shows).
export function periodTotal(data: PeriodData): number
{
    return data.layers.reduce((s, L) => s + layerPeriodTotal(L, data), 0);
}
