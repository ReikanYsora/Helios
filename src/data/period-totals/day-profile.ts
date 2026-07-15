//ONE day of a metric, as one value per hour-of-day slot: the data behind the day curve. Metric-agnostic, so any
//chip with a period aggregation can be drawn round the home.
//
//The day is the one being scrubbed, whatever the period. It used to be the period AVERAGED - seven days of a week
//folded onto one - and that was incoherent with its own base: the curve stands on the sun's ground track for a
//SINGLE day, so laying a seven-day average on it made one piece of geometry describe two different things. One
//scrubbed day, one sun track, one curve.
//
//Each slot divides by the hours of data that actually landed IN IT (kWh / h = kW), so a partial day, a DST fold or
//a store grid that does not line up with midnight need no special case. And coverage says where the curve STOPS: a
//slot no data reached is null, not zero, so today runs from midnight to now rather than diving to the floor.

import { HOUR_MS, DAY_MS, DAY_CURVE_MIN_RUN } from '../../core/config/constants';
import { serverMsOfDay } from '../../core/time/timezone';
import { forEachBucketSlot } from './slot-walk';
import { displayUpdateFrequencyPerHour, type HeliosConfig } from '../../core/config/helios-config';
import type { ChartTarget } from '../../charts/charts';
import { buildPeriodData, type PeriodHost, type PeriodData } from './period-totals';
import type { PeriodWindow } from './slot-walk';

export interface DayProfile
{
    //One value per hour-of-day slot, in the metric's OWN unit; null where nothing covered the slot, which breaks
    //the curve. The geometry normalises against `peak`, so the unit never has to leave this module.
    values:    (number | null)[];
    //Which slots are a FORECAST rather than something that happened. Same curve, drawn dashed: the shape of the
    //day should run unbroken from the morning into the evening, and only its certainty changes at `now`.
    predicted: boolean[];
    //The day's own peak, which the geometry normalises against. Forecast included, or an afternoon predicted higher
    //than the morning delivered would be clipped flat at the top. 0 when there is nothing to draw.
    peak:      number;
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

//Metrics whose stacked layers simply add up to the one curve a day shows: production splits per solar source, and
//consumption is single-layer.
//
//Grid and battery are deliberately absent. Their layers are OPPOSING (import/export, charge/discharge), so adding
//them would sum a kilowatt going out to a kilowatt coming in and call it a reading. What their curve should SAY is
//a design question, not an arithmetic one, so it is left open rather than guessed at. Irradiance and the
//monitoring groups have no layers in the period aggregation at all, and would each need their own source.
const ADDITIVE: readonly ChartTarget[] = ['production', 'consumption'];

//Hours of real data each slot received, spread across the slots a bucket covers exactly as the aggregation spreads
//its energy, so coverage and value always describe the same buckets. Only the day asked for counts, and only up to
//`now`: buckets beyond it never happened, which is what leaves today's later slots null.
function coverageHours(host: PeriodHost, nowMs: number, slots: number, win: PeriodWindow): number[]
{
    const store = host._unifiedStore;
    const cov   = new Array<number>(slots).fill(0);
    if (!store) { return cov; }
    //Clamped at now: buckets beyond it never happened, and that is what leaves today's later slots with nothing,
    //which is what lets the curve stop there instead of lying flat along the ground to midnight.
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
//is nothing to move across: they are simply added up.
function stackLayers(data: PeriodData, slots: number): number[]
{
    const out = new Array<number>(slots).fill(0);
    for (const layer of data.layers)
    {
        for (let s = 0; s < slots; s++) { out[s] += Math.max(0, layer.values[s] ?? 0); }
    }
    return out;
}

//One scrubbed day of a metric. `dayMs` is any instant of the day wanted; its own local midnight is derived here,
//from the same integer clock the slots are cut with, so the day the values are read from and the day the slots
//describe are the same day by construction.
export function buildDayProfile(host: PeriodHost, target: ChartTarget, dayMs: number, nowMs: number = Date.now()): DayProfile
{
    const slots = daySlots(host.config);
    const empty: DayProfile = { values: new Array<number | null>(slots).fill(null), predicted: new Array<boolean>(slots).fill(false), peak: 0 };
    if (!host._timeRange || !ADDITIVE.includes(target)) { return empty; }

    const dayStartMs = dayMs - serverMsOfDay(dayMs);
    const win: PeriodWindow = { fromMs: dayStartMs, toMs: dayStartMs + DAY_MS };
    //Binned straight onto this curve's own grid. It used to come back on the aggregation's fixed 4-slots-an-hour
    //grid and be re-gridded here, so the data was binned TWICE: at 5 or 6 points an hour the second pass was
    //interpolating a 15-minute quantisation, not resolving anything. The graph-detail setting promises to resolve
    //every cloud at 6, and only asking for 6 in the first place makes that true.
    const data = buildPeriodData(host, target, win, slots);
    if (!data.layers.length) { return empty; }
    const stacked = stackLayers(data, slots);

    //kWh over the hours that really landed in the slot: kW, and the metric's own unit rather than merely the right
    //SHAPE. The normalisation cancels a uniform scale error, so a wrong unit here would draw a perfectly correct
    //curve and stay invisible until something read the values as an absolute. `peak` is exactly that reading.
    const values: (number | null)[] = coverageHours(host, nowMs, slots, win)
        .map((h, s) => (h > 0 ? stacked[s] / h : null));

    //Where the day has not happened yet, the forecast carries the curve on. It fills only what the meters left
    //null, so a recorded slot is never overwritten by a prediction of itself.
    const predicted = new Array<boolean>(slots).fill(false);
    if (target === 'production')
    {
        const fc = forecastKw(host, slots, win, nowMs);
        for (let s = 0; s < slots; s++)
        {
            if (values[s] !== null || fc[s] === null) { continue; }
            values[s]    = fc[s];
            predicted[s] = true;
        }
    }

    dropShortRuns(values);
    //A run the floor swept away takes its forecast flag with it, or a span could read dashed with nothing under it.
    for (let s = 0; s < slots; s++) { if (values[s] === null) { predicted[s] = false; } }

    let peak = 0;
    for (const v of values) { if (v !== null && isFinite(v) && v > peak) { peak = v; } }
    if (peak <= 0) { return empty; }
    return { values, predicted, peak };
}
