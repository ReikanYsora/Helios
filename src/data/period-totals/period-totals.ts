//Period-aggregation for the scene detail panel: bins the store + histories by hour-of-day into stacked metric
//layers (production split per source, grid into import/export, battery into charge/discharge). Each hour SUMS the
//metric over the whole window it is given - seven noons of a week are seven noons' energy added up, which is what
//the panel means by a period total. A caller wanting one day asks for one day (PeriodWindow). Data comes from the
//store + histories already loaded, no extra fetch: every mode's store is hourly or finer, so a shape of the day is
//always there to bin.

import { HOUR_MS, HOURS_PER_DAY } from '../../core/config/constants';
import { forEachBucketSlot, slotOf, type PeriodWindow } from './slot-walk';
import type { ChartTarget, ChartHost } from '../../charts/charts';
import { changeSeriesToWatts, type ChangeBucket } from '../sources/energy-stats';
import { consumptionLoad } from '../../core/energy';
import type { UnifiedDataStore } from '../unifiedStore';
import type { TimelineMode } from '../../timeline/timeline-modes';
import type { EnergyDefaults } from '../sources/energy-prefs';

//Re-exported so a caller asking for a slice does not have to know which module owns the walk.
export type { PeriodWindow } from './slot-walk';

//Structural surface the aggregation reads off the card.
export type PeriodHost = ChartHost & {
    _timelineMode: TimelineMode;
    _energyDefaults: EnergyDefaults;
};

//Flow direction a grid/battery layer belongs to, for grouping the per-source split and picking its colour.
export type LayerDir = 'import' | 'export' | 'charge' | 'discharge';

//One stacked layer of a metric: a per-slot series over the day, at whatever resolution the caller asked
//buildPeriodData for. Layers stack cumulatively.
export interface PeriodLayer
{
    values:     number[];     //TOTAL_SLOTS per-slot magnitudes (W or %)
    dir?:       LayerDir;     //grid/battery flow the layer belongs to; absent for production/consumption
    sourceIdx?: number;       //per-source index within its direction (config order); absent on the aggregate fallback
}

export interface PeriodData
{
    layers: PeriodLayer[];
    //Aggregation. 'energy' metrics (production/consumption/grid/battery) SUM kWh over the window per hour-of-day
    //(a total); 'percent' (state of charge) AVERAGES.
    unit:   'energy' | 'percent';
}


//Default resolution: sub-hourly slots binning the metric finer than hourly (the aggregation re-sums to 24 hourly
//bars). 4 slots/hour for the detail panel, whose per-hour TOTALS do not depend on how finely each hour is chopped.
//A caller that draws a CURVE off these layers cares very much, and passes its own count.
const DEFAULT_SLOTS_PER_HOUR = 4;
const TOTAL_SLOTS = 24 * DEFAULT_SLOTS_PER_HOUR;

//Fill NaN gaps by linear interpolation between nearest real samples, wrapping the day, so an HOURLY-sourced
//metric (sparse sub-hour slots: battery SoC) reads as a smooth ramp instead of a spike once per hour. Sub-hour-
//dense store metrics have no gaps (no-op). All-NaN collapses to zeros.
function fillGaps(v: number[]): number[]
{
    const n = v.length;
    if (!v.some(x => Number.isFinite(x)))
    {
        return new Array<number>(n).fill(0);
    }
    const out = v.slice();
    for (let i = 0; i < n; i++)
    {
        if (Number.isFinite(out[i]))
        {
            continue;
        }
        let db = 1; while (!Number.isFinite(v[((i - db) % n + n) % n]))
        {
            db++;
        }
        let df = 1; while (!Number.isFinite(v[(i + df) % n]))
        {
            df++;
        }
        const a = v[((i - db) % n + n) % n];
        const b = v[(i + df) % n];
        out[i] = a + (b - a) * (db / (db + df));
    }
    return out;
}

//Sum one store WATTS series into per-slot ENERGY (kWh) by hour-of-day. Each bucket's energy is SPREAD across
//the slots it covers, so a coarse store (e.g. hourly buckets in month mode) fills every slot evenly instead of
//dumping a whole hour into one slot (the sawtooth). Summing kWh directly (not watts/duration) keeps DST-folded
//buckets from inflating. This is the "total per period".
export function binSlotSum(store: UnifiedDataStore, series: (number | null)[], slots: number, win?: PeriodWindow): number[]
{
    const sum   = new Array<number>(slots).fill(0);
    const stepH = store.stepMs / HOUR_MS;
    forEachBucketSlot(store, slots, win, undefined, (i, slot, segMs) =>
    {
        const v = series[i];
        if (v === null || !isFinite(v))
        {
            return;
        }
        const energy = (Math.max(0, v) * stepH) / 1000;   //kWh for this bucket
        sum[slot] += energy * (segMs / store.stepMs);
    });
    return sum;
}


//Build the stacked layers for the active metric. Production keeps a per-source breakdown; every other metric
//reuses the store series the timeline draws, binned by hour-of-day (same numbers). Every mode's store is hourly
//or finer, so the store always carries a shape of the day and there is nothing else to fall back to.
export function buildPeriodData(host: PeriodHost, target: ChartTarget, win?: PeriodWindow, slots: number = TOTAL_SLOTS): PeriodData
{
    const store  = host._unifiedStore;

    const data = (unit: PeriodData['unit'], layers: PeriodLayer[]): PeriodData => ({ unit, layers });

    if (target === 'production')
    {
        if (!store)
        {
            return data('energy', []);
        }
        const nowMs = Date.now();
        const stepH  = store.stepMs / HOUR_MS;
        //Per-source production from the recorder `change` metric (reset-corrected, exact HA Energy energy,
        //no sun floor), so each string matches the dashboard and recorded night production from non-solar
        //sources fed in as PV shows. The split needs EVERY meter to carry its own buckets; short of that (one
        //source, pre-fetch, or a meter the recorder has nothing for) one layer reads the aggregate, which is
        //already their sum. Source order (NOT sorted): parallel to solarStatEnergyFroms.
        const meters = host._energyDefaults.solarStatEnergyFroms;
        const usePerSourceChange = meters.length >= 2 && meters.every((m) => host._pvChangeSeriesPerEntity.has(m));
        const ids = usePerSourceChange ? meters : meters.slice(0, 1);
        const perSourceWatts = usePerSourceChange
            ? meters.map((m) => changeSeriesToWatts(host._pvChangeSeriesPerEntity.get(m) ?? null, store.storeStartMs, store.stepMs, store.bucketsTotal, nowMs))
            : [changeSeriesToWatts(host._pvChangeSeries, store.storeStartMs, store.stepMs, store.bucketsTotal, nowMs)];
        //Per-source energy (kWh) SUMMED by hour-of-day: each bucket's power * its hours, SPREAD across the slots
        //it covers, so a coarse store fills every slot instead of one (as in binSlotSum).
        const wsum = ids.map(() => new Array<number>(slots).fill(0));
        //Clamped at now: a bucket the sun has not reached yet holds no production, and reading it as zero would
        //drag the day's total down with a measurement of nothing.
        forEachBucketSlot(store, slots, win, nowMs, (i, slot, segMs) =>
        {
            for (let s = 0; s < ids.length; s++)
            {
                const w = perSourceWatts[s]?.[i];
                if (w === null || w === undefined || !(w > 0))
                {
                    continue;
                }
                wsum[s][slot] += ((w * stepH) / 1000) * (segMs / store.stepMs);
            }
        });
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
        const sum = new Array<number>(slots).fill(0);
        const cnt = new Array<number>(slots).fill(0);
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const v = hist.values[i];
                if (!isFinite(v))
                {
                    continue;
                }
                const h = slotOf(hist.times[i].getTime(), slots);
                sum[h] += v; cnt[h] += 1;
            }
        }
        return data('percent', [{ values: fillGaps(sum.map((v, i) => (cnt[i] ? v / cnt[i] : NaN))) }]);
    }

    //Remaining metrics (grid, battery, consumption), binned by hour-of-day as energy totals. Grid and battery split
    //into direction layers, EACH further split per source when 2+ sources carry their own recorder series (for the
    //stacked breakdown); consumption is one layer. Every grid/battery layer carries its `dir` so the arc, panel and
    //timeline group + colour it identically. Single-source falls back to the aggregate store series.
    if (!store)
    {
        return data('energy', []);
    }

    const nowMs = Date.now();
    const sourceWatts = (m: Map<string, ChangeBucket[]>, id: string): (number | null)[] =>
        changeSeriesToWatts(m.get(id) ?? null, store.storeStartMs, store.stepMs, store.bucketsTotal, nowMs);
    const perSource = (ids: string[], m: Map<string, ChangeBucket[]>): boolean => ids.length >= 2 && ids.every(id => m.has(id));

    let specs: { series: (number | null)[]; dir?: LayerDir; sourceIdx?: number }[];
    if (target === 'grid')
    {
        const ed = host._energyDefaults;
        specs = [
            ...(perSource(ed.gridStatEnergyFroms, host._gridImportChangeSeriesPerEntity)
                ? ed.gridStatEnergyFroms.map((id, s) => ({ series: sourceWatts(host._gridImportChangeSeriesPerEntity, id), dir: 'import' as LayerDir, sourceIdx: s }))
                : [{ series: store.gridImport, dir: 'import' as LayerDir }]),
            ...(perSource(ed.gridStatEnergyTos, host._gridExportChangeSeriesPerEntity)
                ? ed.gridStatEnergyTos.map((id, s) => ({ series: sourceWatts(host._gridExportChangeSeriesPerEntity, id), dir: 'export' as LayerDir, sourceIdx: s }))
                : [{ series: store.gridExport, dir: 'export' as LayerDir }]),
        ];
    }
    else if (target === 'battery')
    {
        //Signed net power (positive = charging). Discharge first (layers[0]) to match the aggregate fallback order.
        const ed = host._energyDefaults;
        const aggCharge:    (number | null)[] = store.battery.map(v => (v === null ? null : Math.max(0, v)));
        const aggDischarge: (number | null)[] = store.battery.map(v => (v === null ? null : Math.max(0, -v)));
        specs = [
            ...(perSource(ed.batteryStatEnergyFroms, host._batteryDischargeChangeSeriesPerEntity)
                ? ed.batteryStatEnergyFroms.map((id, s) => ({ series: sourceWatts(host._batteryDischargeChangeSeriesPerEntity, id), dir: 'discharge' as LayerDir, sourceIdx: s }))
                : [{ series: aggDischarge, dir: 'discharge' as LayerDir }]),
            ...(perSource(ed.batteryStatEnergyTos, host._batteryChargeChangeSeriesPerEntity)
                ? ed.batteryStatEnergyTos.map((id, s) => ({ series: sourceWatts(host._batteryChargeChangeSeriesPerEntity, id), dir: 'charge' as LayerDir, sourceIdx: s }))
                : [{ series: aggCharge, dir: 'charge' as LayerDir }]),
        ];
    }
    else
    {
        //Consumption derived per bucket: production + import - export - net battery, clamped at 0.
        const cons: (number | null)[] = new Array(store.bucketsTotal).fill(null);
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const p = store.production[i]; const gi = store.gridImport[i];
            const ge = store.gridExport[i]; const b = store.battery[i];
            if (p === null && gi === null && ge === null && b === null)
            {
                continue;
            }
            cons[i] = consumptionLoad(p ?? 0, gi ?? 0, ge ?? 0, b ?? 0);
        }
        specs = [{ series: cons }];
    }

    return data('energy', specs.map(s => ({ values: binSlotSum(store, s.series, slots, win), dir: s.dir, sourceIdx: s.sourceIdx })));
}


//Aggregate a per-slot series to 24 hourly values (each bar = one hour H..H+1). `sum` (energy) totals the hour's
//slots; otherwise (percent) it averages them.
export function hourlyOf(values: number[], sum: boolean): number[]
{
    //Read the resolution off the series rather than assume it: the caller chose it, and a wrong guess here would
    //silently read a fraction of each hour and call it the hour.
    const per = Math.max(1, Math.round(values.length / HOURS_PER_DAY));
    const out = new Array<number>(HOURS_PER_DAY).fill(0);
    for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        let s = 0;
        for (let j = 0; j < per; j++)
        {
            s += Math.max(0, values[h * per + j] ?? 0);
        }
        out[h] = sum ? s : s / per;
    }
    return out;
}

//One layer's aggregate over the whole window, for the panel total: energy SUMS the 24 hourly kWh totals (the
//window's energy), percent AVERAGES them (a representative percent over the window).
export function layerPeriodTotal(layer: PeriodLayer, data: PeriodData): number
{
    const energy = data.unit === 'energy';
    const hv = hourlyOf(layer.values, energy);
    let t = 0; for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        t += Math.max(0, hv[h]);
    }
    return energy ? t : t / HOURS_PER_DAY;
}

//A metric's window aggregate across all its layers (the grand total a single-layer metric shows).
export function periodTotal(data: PeriodData): number
{
    return data.layers.reduce((s, L) => s + layerPeriodTotal(L, data), 0);
}
