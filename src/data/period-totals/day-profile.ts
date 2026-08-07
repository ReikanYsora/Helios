//ONE day of a metric, as strands: one drawn line, or several. Each strand is one value per hour-of-day slot in its
//own unit, ready for the day curve to stand round the home. Metric-agnostic below the per-target split, so any
//chip with a period aggregation is drawn the same way whatever it measures: PV draws one strand (+ forecast), grid
//two (import / export), battery two (power + SoC), a monitoring group one per device.
//
//The day is the one being scrubbed, whatever the period. It used to be the period AVERAGED - seven days of a week
//folded onto one - and that was incoherent with its own base: the curve stands on the sun's ground track for a
//SINGLE day, so laying a seven-day average on it made one piece of geometry describe two different things. One
//scrubbed day, one sun track, one set of strands.
//
//Each slot divides by the hours of data that actually landed IN IT (kWh / h = kW), so a partial day, a DST fold or
//a store grid that does not line up with midnight need no special case. And coverage says where a strand STOPS: a
//slot no data reached is null, not zero, so today runs from midnight to now rather than diving to the floor.
//
//Colours are DESCRIPTORS, not hex (StrandColour): the card resolves them live against the theme, so a theme flip
//is never frozen into the memo the card keeps of this result.

import { HOUR_MS, DAY_MS, DAY_CURVE_MIN_RUN } from '../../core/config/constants';
import { serverMsOfDay } from '../../core/time/timezone';
import { forEachBucketSlot } from './slot-walk';
import { displayUpdateFrequencyPerHour, type HeliosConfig } from '../../core/config/helios-config';
import { type ChartTarget, type StrandColour, type StrandFlowDir, isGroupTarget, groupOfTarget } from '../../charts/charts';
import { TIMELINE_MODES } from '../../timeline/timeline-modes';
import { buildPeriodData, binSlotSum, type PeriodHost, type PeriodLayer } from './period-totals';
import { changeSeriesToWatts } from '../sources/energy-stats';
import { groupDevices } from '../sources/device-consumption';
import type { PeriodWindow } from './slot-walk';

//One drawn line of the day, unit-agnostic. `colour` is a descriptor the card resolves; everything else is the data
//the geometry normalises and draws. This is exactly a DayStrand minus the resolved colour.
export interface ProfileStrand
{
    values:    (number | null)[];
    predicted: boolean[];
    peak:      number;
    dashed?:   boolean;
    colour:    StrandColour;
}

//Slots per day = the card's "graph detail" setting, the same knob that sets how densely every other curve is
//plotted. The slot count IS this curve's resolution, so honouring it smooths the curve out at 1 point/hour and
//resolves every cloud at 6, exactly as the setting promises - and it is the lever people on slow devices already
//reach for. (The period aggregation next door fixes its own slot count on purpose: it TOTALS each hour, and a
//total does not depend on how finely you chop it. A curve does.)
export function daySlots(config: HeliosConfig | undefined): number
{
    return 24 * displayUpdateFrequencyPerHour(config);
}

//The store's solar forecast, binned onto the curve's slots as average power, for the slots the day has not reached.
//Only production has one - it is the only metric anything predicts - so every other target simply stops at `now`.
function forecastKw(host: PeriodHost, slots: number, win: PeriodWindow, nowMs: number): (number | null)[]
{
    const store = host._unifiedStore;
    const out = new Array<number | null>(slots).fill(null);
    //No forecast source configured leaves the series empty, and the curve simply stops where the readings do.
    if (!store || !store.forecast) { return out; }
    //Weighted by overlap and divided back out: the value is a POWER, so a slot reads the average power over its
    //own span, not a share of an energy.
    const sum = new Array<number>(slots).fill(0);
    const cov = new Array<number>(slots).fill(0);
    forEachBucketSlot(store, slots, win, undefined, (i, slot, segMs) =>
    {
        //Only the part of the day still ahead: before now the meters have the answer, and a prediction of the past
        //is not a reading of it.
        const tMid = store.storeStartMs + (i + 0.5) * store.stepMs;
        if (tMid <= nowMs) { return; }
        const w = store.forecast[i];
        if (w === null || !isFinite(w)) { return; }
        sum[slot] += (w / 1000) * segMs;
        cov[slot] += segMs;
    });
    for (let s = 0; s < slots; s++) { if (cov[s] > 0) { out[s] = sum[s] / cov[s]; } }
    return out;
}

//Hours of real data each slot received, spread across the slots a bucket covers exactly as the aggregation spreads
//its energy, so coverage and value always describe the same buckets. Only the day asked for counts, and only up to
//`now`: buckets beyond it never happened, which is what leaves today's later slots null.
function coverageHours(host: PeriodHost, nowMs: number, slots: number, win: PeriodWindow): number[]
{
    const store = host._unifiedStore;
    const cov   = new Array<number>(slots).fill(0);
    if (!store) { return cov; }
    //Clamped at now: buckets beyond it never happened, and that is what leaves today's later slots with nothing,
    //which is what lets a strand stop there instead of lying flat along the ground to midnight.
    forEachBucketSlot(store, slots, win, nowMs, (_i, slot, segMs) => { cov[slot] += segMs / HOUR_MS; });
    return cov;
}

//Drop runs of covered slots too short to be a curve. Wraps midnight, so a run spanning 23:00->01:00 counts once.
function dropShortRuns(values: (number | null)[]): void
{
    const n = values.length;
    const covered = (i: number): boolean => values[((i % n) + n) % n] !== null;
    if (values.every((v) => v !== null)) { return; }
    for (let i = 0; i < n; i++)
    {
        //Only start measuring at a run's first slot, so each run is walked once.
        if (!covered(i) || covered(i - 1)) { continue; }
        let k = 0;
        while (k < n && covered(i + k)) { k++; }
        if (k >= DAY_CURVE_MIN_RUN) { continue; }
        for (let j = 0; j < k; j++) { values[(i + j) % n] = null; }
    }
}

//Stack a metric's layers into one per-slot series. The aggregation binned them onto THIS curve's grid, so there
//is nothing to move across: they are simply added up. Consumption is single-layer today; this stays the one place
//that would fold a multi-layer metric into a single curve.
function stackLayers(values: readonly { values: number[] }[], slots: number): number[]
{
    const out = new Array<number>(slots).fill(0);
    for (const layer of values)
    {
        for (let s = 0; s < slots; s++) { out[s] += Math.max(0, layer.values[s] ?? 0); }
    }
    return out;
}

//Cumulative per-source strands for a set of layers (source 0 alone, then source 0+1, ...), each converted to kW, so
//the outermost line tops the stack at the direction total - the same stacked reading the timeline draws as areas.
//Uncovered slots stay null (they add nothing and carry no line). Returns bottom-source-first, each with its config
//index for colouring. Consumes buildPeriodData layers, so the arc, panel and timeline all split identically.
function cumulativeStrands(layers: PeriodLayer[], toKw: (energy: number[]) => (number | null)[], slots: number): { values: (number | null)[]; sourceIdx: number }[]
{
    const running = new Array<number>(slots).fill(0);
    return layers.map((layer, i) =>
    {
        const kw   = toKw(layer.values);
        const vals = new Array<number | null>(slots).fill(null);
        for (let s = 0; s < slots; s++)
        {
            const v = kw[s];
            if (v === null) { continue; }
            running[s] += v;
            vals[s]     = running[s];
        }
        return { values: vals, sourceIdx: layer.sourceIdx ?? i };
    });
}

//A strand's own peak (its 100%), ignoring nulls. 0 when there is nothing to draw.
function peakOf(values: (number | null)[]): number
{
    let p = 0;
    for (const v of values) { if (v !== null && isFinite(v) && v > p) { p = v; } }
    return p;
}

//Does a strand carry any reading at all? An all-null strand is dropped rather than handed on as an empty line.
function anyValue(values: (number | null)[]): boolean
{
    return values.some((v) => v !== null);
}

//The scrubbed day's battery state of charge, one value per slot, linearly interpolated from the SoC history at
//each slot's centre. null outside the history's coverage, so a slot with no bracketing samples breaks the line
//rather than inventing a level. Percent (0..100); the strand normalises against 100, so 100 % reaches the same top
//the power peak does. Day-scoped on purpose: the period aggregation's own SoC path folds every day together, which
//is wrong for a curve that stands on one day's sun track.
function socDay(hist: { times: Date[]; values: number[] } | null, slots: number, dayStartMs: number): (number | null)[]
{
    const out = new Array<number | null>(slots).fill(null);
    const n = hist ? hist.times.length : 0;
    if (!hist || n === 0) { return out; }
    const slotMs = DAY_MS / slots;
    const first  = hist.times[0].getTime();
    const last   = hist.times[n - 1].getTime();
    let lo = 0;
    for (let s = 0; s < slots; s++)
    {
        const t = dayStartMs + (s + 0.5) * slotMs;
        //Outside the history: no reading, so the line breaks rather than clamping to an end sample.
        if (t < first || t > last) { continue; }
        //Advance the bracket forward with the slots (both ascending), so the walk stays linear overall.
        while (lo + 1 < n && hist.times[lo + 1].getTime() <= t) { lo++; }
        const a = hist.times[lo].getTime();
        const b = hist.times[Math.min(lo + 1, n - 1)].getTime();
        const va = hist.values[lo];
        const vb = hist.values[Math.min(lo + 1, n - 1)];
        if (!isFinite(va) || !isFinite(vb)) { continue; }
        out[s] = b > a ? va + (vb - va) * ((t - a) / (b - a)) : va;
    }
    return out;
}

//Average a store series per slot, weighted by how much of each bucket lands in the slot. For an INTENSITY (W/m2),
//not an energy: a slot reads the mean over its own span, so there is no kWh-then-back-to-kW round trip. NOT clamped
//at now - irradiance is a weather-model series that runs on into the forecast, so the day curve shows the rest of
//the day ahead too, exactly as the timeline does. null where nothing covered the slot.
function binSlotAvg(store: NonNullable<PeriodHost['_unifiedStore']>, series: (number | null)[], slots: number, win: PeriodWindow): (number | null)[]
{
    const sum = new Array<number>(slots).fill(0);
    const cov = new Array<number>(slots).fill(0);
    forEachBucketSlot(store, slots, win, undefined, (i, slot, segMs) =>
    {
        const v = series[i];
        if (v === null || !isFinite(v)) { return; }
        sum[slot] += v * segMs;
        cov[slot] += segMs;
    });
    return sum.map((s, k) => (cov[k] > 0 ? s / cov[k] : null));
}

//Per-slot battery flow direction from the store's signed net power, for tinting a strand when no power strand was
//built to hand its own direction over (an SoC-only install). +/-5 W deadband so recorder noise reads as idle.
function socFlow(host: PeriodHost, slots: number, win: PeriodWindow): (StrandFlowDir | null)[]
{
    const store = host._unifiedStore;
    const dir   = new Array<StrandFlowDir | null>(slots).fill(null);
    if (!store) { return dir; }
    const net = new Array<number>(slots).fill(0);
    const cov = new Array<number>(slots).fill(0);
    forEachBucketSlot(store, slots, win, undefined, (i, slot, segMs) =>
    {
        const v = store.battery[i];
        if (v === null || !isFinite(v)) { return; }
        net[slot] += v * segMs;
        cov[slot] += segMs;
    });
    for (let s = 0; s < slots; s++)
    {
        if (cov[s] <= 0) { continue; }
        const a = net[s] / cov[s];
        dir[s] = Math.abs(a) < 5 ? 'idle' : (a > 0 ? 'charge' : 'discharge');
    }
    return dir;
}

//One scrubbed day of a metric, as its strands. `dayMs` is any instant of the day wanted; its own local midnight is
//derived here, from the same integer clock the slots are cut with, so the day the values are read from and the day
//the slots describe are the same day by construction. Empty array = nothing to draw (unconfigured, pre-fetch, or a
//target that builds no strands).
export function buildDayProfile(host: PeriodHost, target: ChartTarget, dayMs: number, nowMs: number = Date.now()): ProfileStrand[]
{
    const slots = daySlots(host.config);
    if (!host._timeRange) { return []; }

    const dayStartMs = dayMs - serverMsOfDay(dayMs);
    const win: PeriodWindow = { fromMs: dayStartMs, toMs: dayStartMs + DAY_MS };
    //Binned straight onto this curve's own grid (see the notes in period-totals: at 5 or 6 points an hour a second
    //re-grid would interpolate a 15-minute quantisation instead of resolving anything).
    const cov    = coverageHours(host, nowMs, slots, win);
    //kWh over the hours that really landed in the slot: kW, the metric's own unit. null where nothing covered it.
    const toKw   = (energy: number[]): (number | null)[] => energy.map((e, s) => (cov[s] > 0 ? e / cov[s] : null));
    const noPred = (): boolean[] => new Array<boolean>(slots).fill(false);

    if (target === 'production')
    {
        const data = buildPeriodData(host, 'production', win, slots);
        if (!data.layers.length) { return []; }
        //Per-source when the aggregation split the meters (2+ configured, each with its own recorder series); one
        //aggregate strand otherwise (single source, or pre-fetch when the split has nothing to work from).
        const perSource = data.layers.length >= 2;
        //The aggregate forecast, future only (store.forecast is a total, never split per source). null before now.
        const fc = forecastKw(host, slots, win, nowMs);

        if (!perSource)
        {
            //Single source: the aggregate strand, its future carried on by the forecast, exactly as before. It fills
            //only what the meters left null, so a recorded slot is never overwritten by a prediction of itself.
            const values    = toKw(data.layers[0].values);
            const predicted = noPred();
            for (let s = 0; s < slots; s++)
            {
                if (values[s] !== null || fc[s] === null) { continue; }
                values[s]    = fc[s];
                predicted[s] = true;
            }
            dropShortRuns(values);
            //A run the floor swept away takes its forecast flag with it, or a span could read dashed with nothing under it.
            for (let s = 0; s < slots; s++) { if (values[s] === null) { predicted[s] = false; } }
            const peak = peakOf(values);
            if (peak <= 0) { return []; }
            return [{ values, predicted, peak, colour: { kind: 'token', token: 'production' } }];
        }

        //One strand per source, CUMULATIVE (source 0 alone, then source 0+1, ...) so the outermost line tops the stack
        //at the total, exactly as the timeline stacks the per-source areas up to now. Each in its HA Energy dashboard
        //colour (energySolarColor by source index). The aggregate forecast carries on beyond now as its OWN dashed
        //strand. Shared peak over the stack top AND the forecast, so both read on one kW scale.
        const stacked = cumulativeStrands(data.layers, toKw, slots);
        let peak = peakOf(fc);
        for (const st of stacked) { peak = Math.max(peak, peakOf(st.values)); }
        if (peak <= 0) { return []; }

        const out: ProfileStrand[] = [];
        stacked.forEach((st) =>
        {
            dropShortRuns(st.values);
            if (anyValue(st.values)) { out.push({ values: st.values, predicted: noPred(), peak, colour: { kind: 'solar', index: st.sourceIdx } }); }
        });
        const fcVals = fc.slice();
        dropShortRuns(fcVals);
        if (anyValue(fcVals)) { out.push({ values: fcVals, predicted: new Array<boolean>(slots).fill(true), peak, colour: { kind: 'token', token: 'production' } }); }
        return out;
    }

    if (target === 'consumption')
    {
        const data = buildPeriodData(host, 'consumption', win, slots);
        if (!data.layers.length) { return []; }
        const values = toKw(stackLayers(data.layers, slots));
        dropShortRuns(values);
        const peak = peakOf(values);
        if (peak <= 0) { return []; }
        return [{ values, predicted: noPred(), peak, colour: { kind: 'token', token: 'home' } }];
    }

    if (target === 'grid')
    {
        //Import and export each stacked per source (cumulative), exactly as the timeline stacks them. Shared peak so
        //both flows read on one scale. Single-source keeps its chip colour (token); multi-source takes the HA energy
        //ramp by index (energyGridColor).
        const data = buildPeriodData(host, 'grid', win, slots);
        const imp  = data.layers.filter((L) => L.dir === 'import');
        const exp  = data.layers.filter((L) => L.dir === 'export');
        const impStacked = cumulativeStrands(imp, toKw, slots);
        const expStacked = cumulativeStrands(exp, toKw, slots);
        let peak = 0;
        for (const st of [...impStacked, ...expStacked]) { peak = Math.max(peak, peakOf(st.values)); }
        if (peak <= 0) { return []; }
        const out: ProfileStrand[] = [];
        const pushGrid = (stacked: { values: (number | null)[]; sourceIdx: number }[], layers: PeriodLayer[], dir: 'import' | 'export'): void =>
        {
            const perSource = layers.length > 0 && layers[0].sourceIdx !== undefined;
            const token     = dir === 'import' ? 'gridImport' as const : 'gridExport' as const;
            for (const st of stacked)
            {
                dropShortRuns(st.values);
                if (!anyValue(st.values)) { continue; }
                const colour: StrandColour = perSource ? { kind: 'grid', index: st.sourceIdx, dir } : { kind: 'token', token };
                out.push({ values: st.values, predicted: noPred(), peak, colour });
            }
        };
        pushGrid(impStacked, imp, 'import');
        pushGrid(expStacked, exp, 'export');
        return out;
    }

    if (target === 'battery')
    {
        //Discharge and charge each stacked per source (cumulative), matching the timeline's two directional areas.
        //Single-source keeps its chip colour; multi-source takes the HA energy ramp by index. SoC stays a separate
        //per-bank dashed overlay below.
        const data = buildPeriodData(host, 'battery', win, slots);
        const dis  = data.layers.filter((L) => L.dir === 'discharge');
        const chg  = data.layers.filter((L) => L.dir === 'charge');
        const disStacked = cumulativeStrands(dis, toKw, slots);
        const chgStacked = cumulativeStrands(chg, toKw, slots);
        let peak = 0;
        for (const st of [...disStacked, ...chgStacked]) { peak = Math.max(peak, peakOf(st.values)); }

        const out: ProfileStrand[] = [];
        if (peak > 0)
        {
            const pushBatt = (stacked: { values: (number | null)[]; sourceIdx: number }[], layers: PeriodLayer[], dir: 'charge' | 'discharge'): void =>
            {
                const perSource = layers.length > 0 && layers[0].sourceIdx !== undefined;
                const token     = dir === 'charge' ? 'batteryCharge' as const : 'batteryDischarge' as const;
                for (const st of stacked)
                {
                    dropShortRuns(st.values);
                    if (!anyValue(st.values)) { continue; }
                    const colour: StrandColour = perSource ? { kind: 'battery', index: st.sourceIdx, dir } : { kind: 'token', token };
                    out.push({ values: st.values, predicted: noPred(), peak, colour });
                }
            };
            pushBatt(disStacked, dis, 'discharge');
            pushBatt(chgStacked, chg, 'charge');
        }
        //SoC on its own 0..100 scale, dashed, so its 100 % reaches the same top the power peak does (that is what
        //"leans on the power curve's max for its 100 %" means once both fill their own height at their own peak). One
        //strand PER BANK, like the timeline: the banks are told apart by their level, not their colour, so every SoC
        //line takes the SAME tint - the store's signed net flow over the WHOLE day (socFlow). That whole-day flow,
        //not the power strand's own dir, because the SoC line is continuous where the power one is cut into short
        //runs, and the power dir would leave those stretches uncoloured, dropping them onto the discharge fallback.
        //Falls back to the merged SoC when the install has a single bank (perBank is empty there).
        const socDir = socFlow(host, slots, win);
        const banks  = host._batterySocPerBankHistory.length > 0
            ? host._batterySocPerBankHistory
            : (host._batterySocHistory ? [host._batterySocHistory] : []);
        for (const bank of banks)
        {
            const soc = socDay(bank, slots, dayStartMs);
            if (anyValue(soc)) { out.push({ values: soc, predicted: noPred(), peak: 100, dashed: true, colour: { kind: 'flow', dir: socDir } }); }
        }
        return out;
    }

    if (isGroupTarget(target))
    {
        const store = host._unifiedStore;
        if (!store) { return []; }
        const devs = groupDevices(host.config, host._energyDefaults, groupOfTarget(target));
        if (!devs.length) { return []; }
        //One strand per device, its recorder `change` series mapped onto the store grid as watts (magnitude), binned
        //to slot energy then back to average kW. Each device keeps its dashboard graph colour (by index).
        const built = devs.map((dev) =>
        {
            const watts = changeSeriesToWatts(
                host._deviceChangeSeries.get(dev.statConsumption) ?? null,
                store.storeStartMs, store.stepMs, store.bucketsTotal, nowMs);
            const values = toKw(binSlotSum(store, watts, slots, win));
            dropShortRuns(values);
            return { index: dev.index, values };
        });
        //Shared peak across the group's devices, so a device that drew more stands taller than one that drew less,
        //on one scale rather than each filling its own height.
        let peak = 0;
        for (const b of built) { const p = peakOf(b.values); if (p > peak) { peak = p; } }
        if (peak <= 0) { return []; }
        return built
            .filter((b) => anyValue(b.values))
            .map((b) => ({ values: b.values, predicted: noPred(), peak, colour: { kind: 'device', index: b.index } as StrandColour }));
    }

    if (target === 'irradiance')
    {
        const store = host._unifiedStore;
        if (!store) { return []; }
        //Only where the weather model reaches. Open-Meteo runs out around 16 days, and the month window is longer
        //and capped to hourly, so it carries no irradiance to draw - the same limit the irradiance chip honours by
        //dropping out of month mode. Gated on the mode's weather flag so the curve and the chip agree exactly.
        if (!TIMELINE_MODES[host._timelineMode].weather) { return []; }
        //Average W/m2 per slot, forecast included (binSlotAvg is not clamped at now), on the strand's own peak like
        //every other day curve: a cloudy day fills its height and reads by SHAPE, rather than crawling along the
        //ground under a fixed 0..1000 scale the way the flat chart uses.
        const values = binSlotAvg(store, store.irradiance, slots, win);
        dropShortRuns(values);
        const peak = peakOf(values);
        if (peak <= 0) { return []; }
        return [{ values, predicted: noPred(), peak, colour: { kind: 'token', token: 'irradiance' } }];
    }

    if (target === 'temperature')
    {
        const store = host._unifiedStore;
        if (!store) { return []; }
        if (!TIMELINE_MODES[host._timelineMode].weather) { return []; }
        //Signed, narrow-range metric: normalise the slot averages to the window's own min..max (peak 1) so the
        //strand reads by SHAPE, the same way the flat chart scales temperature. Flat/absent range -> no curve.
        const raw = binSlotAvg(store, store.temperature, slots, win);
        let mn = Infinity;
        let mx = -Infinity;
        for (const v of raw) { if (v !== null && isFinite(v)) { if (v < mn) { mn = v; } if (v > mx) { mx = v; } } }
        if (!isFinite(mn) || mx <= mn) { return []; }
        const values = raw.map(v => (v === null || !isFinite(v)) ? null : (v - mn) / (mx - mn));
        dropShortRuns(values);
        return [{ values, predicted: noPred(), peak: 1, colour: { kind: 'token', token: 'temperature' } }];
    }

    if (target === 'humidity')
    {
        const store = host._unifiedStore;
        if (!store) { return []; }
        if (!TIMELINE_MODES[host._timelineMode].weather) { return []; }
        //Fixed 0..100 % scale (peak 1 = 100 %), so a humid day sits high and a dry one low on one honest axis.
        const raw = binSlotAvg(store, store.humidity, slots, win);
        const values = raw.map(v => (v === null || !isFinite(v)) ? null : Math.max(0, Math.min(1, v / 100)));
        dropShortRuns(values);
        if (peakOf(values) <= 0) { return []; }
        return [{ values, predicted: noPred(), peak: 1, colour: { kind: 'token', token: 'humidity' } }];
    }

    //Anything else: no day curve yet.
    return [];
}
