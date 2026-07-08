//Day-ring data: today's per-slot solar + grid-import shares (the share of each slot's home load met by local
//solar vs the grid). The slot count follows the card's display-update-frequency-per-hour setting (24 * freq), so a
//finer cadence draws a finer ring; the change-series is fetched at the matching recorder period.

import { fetchChangeSeries, fetchChangeById, outlierCapKwh, type ChangeBucket } from '../data/sources/energy-stats';
import { consumptionLoad } from '../core/energy';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import { displayUpdateFrequencyPerHour, type HeliosConfig } from '../core/config/helios-config';
import { serverHourFrac } from '../core/time/timezone';
import { HOURS_PER_DAY, DAY_MS } from '../core/config/constants';

//Quantum the window end snaps to (HA's finest statistics cadence). Snapping to 5 min instead of the whole hour
//shows the current period live, while keeping the fetch key stable within each 5-min window (no refetch loop).
const LIVE_QUANTUM_MS = 5 * 60_000;

//Per-slot ring shares (solar gold + grid-import colour, summing to ~1 under load) plus the day's qualifying device
//runs, drawn as concentric device rings over the base ring.
export interface DayRingData
{
    solar:   number[];
    battery: number[];
    grid:    number[];
    devices: DeviceRun[];
    //Each source ring is drawn only when that source is actually configured (panels / grid / battery), not just
    //when it happened to produce today.
    hasSolar:   boolean;
    hasGrid:    boolean;
    hasBattery: boolean;
    //Day totals (kWh) for the source-ring tooltips: solar produced, grid imported, battery discharged.
    solarKwh:   number;
    gridKwh:    number;
    batteryKwh: number;
    //Per-slot solar production (kWh) -- the available sun the optimiser schedules shiftable devices into.
    pv:         number[];
    //Per-slot battery charging (kWh) -- sun already committed to the battery, so it isn't free to move a device onto.
    charge:     number[];
}

//One device's run(s) over the day: contiguous on-slots as arcs (episodic) or the whole day (continuous). `index`
//is the dashboard position, so the ring reuses HA's per-index device colour.
export interface DeviceRun
{
    index:      number;
    name:       string;
    //Per-slot energy (kWh); the ring's run arcs are derived from this at draw time (dayRunArcs).
    values:     number[];
    //True when the device ran essentially all day (a permanent load the optimiser can't shift).
    continuous: boolean;
    //Tooltip figures: the day's total and the share of it that fell on solar-covered vs grid-covered slots.
    dailyKwh:   number;
    solarPct:   number;
    gridPct:    number;
}

//Below this daily total (kWh) a device gets no ring (noise cut). A slot counts as "on" above RUN_ACTIVE_FRAC of the
//device's peak slot; a device on for at least RUN_CONTINUOUS_FRAC of slots is a permanent load.
const DEVICE_THRESHOLD_KWH = 0.1;
const RUN_ACTIVE_FRAC     = 0.15;
const RUN_CONTINUOUS_FRAC = 0.8;

//Summarise a device for the day ring from its per-slot energy (kWh): null below the noise threshold, otherwise its
//day total + whether it ran essentially all day. The per-run arc geometry is derived at draw time from `values`.
export function detectDeviceRuns(kwh: number[], index: number, name: string): DeviceRun | null
{
    let total = 0;
    let peak  = 0;
    for (const v of kwh) { const x = Math.max(0, v); total += x; if (x > peak) { peak = x; } }
    if (total < DEVICE_THRESHOLD_KWH || peak <= 0) { return null; }
    const onCut = peak * RUN_ACTIVE_FRAC;
    let onCount = 0;
    for (const v of kwh) { if (v > onCut) { onCount++; } }
    const continuous = onCount >= kwh.length * RUN_CONTINUOUS_FRAC;
    return { index, name, values: kwh, continuous, dailyKwh: total, solarPct: 0, gridPct: 0 };
}

//Optimisation replay: reschedule the SHIFTABLE devices (not always-on) into the day's real solar production, so
//they don't just pile up at one moment -- you can only run so many appliances on the sun you actually made. Greedy:
//continuous devices are fixed and eat their share of the sun first; then, biggest device first, each is slid to the
//run-length window with the most REMAINING sun and that sun is spent, so later devices flow into the next-best slot.
//A device the sun can't cover (nothing left) stays where it really ran. Returns per-slot values aligned to `devices`.
const OPT_RUN_PCT = 0.08;
//Meal/cooking loads are bound to meal times (you don't run the oven at 10am to shift it onto the sun), so the
//optimiser treats them as FIXED like an always-on load. Matched loosely by name (EN + FR), best-effort.
const TIME_BOUND = /oven|four|stove|cuisin|cook(top|er|ing)?|hob|hotplate|plaque|po[eê]le|grill|micro.?onde|microwave|kettle|bouilloire|toaster|grille.?pain|cuisson|hotte|range\b/i;
//A device is FIXED (not shiftable) when it runs all day: flagged continuous, meal-time-bound by name, or spread
//across most of the day (a fridge cycles on/off but its activity spans ~24h -- you can't shift a permanent load).
function isFixedLoad(d: DeviceRun): boolean
{
    if (d.continuous || TIME_BOUND.test(d.name)) { return true; }
    let peak = 0;
    for (const v of d.values) { if (v > peak) { peak = v; } }
    if (peak <= 0) { return false; }
    const thr = peak * OPT_RUN_PCT;
    let first = -1;
    let last  = -1;
    for (let i = 0; i < d.values.length; i++) { if ((d.values[i] ?? 0) > thr) { if (first < 0) { first = i; } last = i; } }
    return first >= 0 && (last - first + 1) > d.values.length * 0.6;
}
export function optimizeDevices(pv: number[], charge: number[], devices: DeviceRun[]): number[][]
{
    const slots    = pv.length;
    //Solar still available to schedule into = production minus what already went to charging the battery (you
    //can't run a device on sun that charged the battery), before the fixed loads take their share below.
    const residual = pv.map((v, s) => Math.max(0, Math.max(0, v) - Math.max(0, charge[s] ?? 0)));
    const out: number[][] = devices.map(() => new Array<number>(slots).fill(0));
    //Fixed loads (always-on OR meal-time-bound) keep their real profile and consume their part of the sun up front.
    devices.forEach((d, i) =>
    {
        if (!isFixedLoad(d)) { return; }
        out[i] = d.values.slice();
        for (let s = 0; s < slots; s++) { residual[s] = Math.max(0, residual[s] - Math.max(0, d.values[s])); }
    });
    //Shiftable loads, biggest first, each placed in the best-sun window of its own run length.
    const shiftable = devices.map((d, i) => ({ d, i })).filter(x => !isFixedLoad(x.d) && x.d.dailyKwh > 0).sort((a, b) => b.d.dailyKwh - a.d.dailyKwh);
    for (const { d, i } of shiftable)
    {
        let peak = 0;
        for (const v of d.values) { if (v > peak) { peak = v; } }
        let dur = 0;
        for (const v of d.values) { if (v > peak * OPT_RUN_PCT) { dur++; } }
        if (dur <= 0 || dur > slots) { out[i] = d.values.slice(); continue; }
        const draw = d.dailyKwh / dur;   //average draw while running
        let bestStart = 0;
        let bestScore = -1;
        for (let s = 0; s + dur <= slots; s++)
        {
            let score = 0;
            for (let k = s; k < s + dur; k++) { score += Math.min(residual[k], draw); }
            if (score > bestScore) { bestScore = score; bestStart = s; }
        }
        if (bestScore <= 1e-6) { out[i] = d.values.slice(); continue; }   //no sun to move it into -> leave it real
        for (let k = bestStart; k < bestStart + dur; k++) { out[i][k] = draw; residual[k] = Math.max(0, residual[k] - draw); }
    }
    return out;
}

export interface DayRingHost
{
    hass:            any;
    config:          HeliosConfig | undefined;
    _energyDefaults: EnergyDefaults;
    _viewMode?:      'scene' | 'clock' | 'day';
    _timelineMode?:  string;   //'yesterday' shows the previous day; anything else = today (live)
    _dayRing:        DayRingData | null;
    _dayRingKey:     string;
    requestUpdate(): void;
}

//Bin a change-series (kWh) into `slots` slots-of-day, summed, in the home time zone (so the ring lines up with the
//dial's hours). Same outlier rule as the store curves; a negative change is a meter-reset artefact floored at 0.
function binSlots(buckets: ChangeBucket[] | null, slots: number): number[]
{
    const out = new Array<number>(slots).fill(0);
    if (!buckets) { return out; }
    const cap = outlierCapKwh(buckets);
    for (const b of buckets)
    {
        if (!Number.isFinite(b.kwh) || Math.abs(b.kwh) > cap) { continue; }
        //serverHourFrac is the hour-of-day [0, 24); scale to a slot index [0, slots).
        const s = Math.min(slots - 1, Math.max(0, Math.floor(serverHourFrac(b.startMs) / HOURS_PER_DAY * slots)));
        out[s] += Math.max(0, b.kwh);
    }
    return out;
}

//Per-slot solar + grid-import shares of the ring cell, from the slot's energy sums. Pure (testable): solar =
//self-consumed solar / load, grid = grid import / load; both 0 for a slot with no load (future or idle).
export function ringShares(pv: number[], imp: number[], exp: number[], charge: number[], discharge: number[]): { solar: number[]; battery: number[]; grid: number[] }
{
    const n = pv.length;
    const solar   = new Array<number>(n).fill(0);
    const battery = new Array<number>(n).fill(0);
    const grid    = new Array<number>(n).fill(0);
    for (let s = 0; s < n; s++)
    {
        const load = consumptionLoad(pv[s] ?? 0, imp[s] ?? 0, exp[s] ?? 0, (charge[s] ?? 0) - (discharge[s] ?? 0));
        if (load <= 0) { continue; }
        //Three sources cover the slot's load: grid import, battery discharge, and (the rest) local solar.
        const g = Math.max(0, Math.min(1, (imp[s] ?? 0) / load));
        const b = Math.max(0, Math.min(1 - g, (discharge[s] ?? 0) / load));
        grid[s]    = g;
        battery[s] = b;
        solar[s]   = Math.max(0, 1 - g - b);
    }
    return { solar, battery, grid };
}

//Slots-per-day + the recorder period that resolves them: hourly at freq 1, else 5-minute (binned down to slots).
function daySlotting(config: HeliosConfig | undefined): { slots: number; period: '5minute' | 'hour' }
{
    const freq = Math.max(1, Math.min(6, Math.round(displayUpdateFrequencyPerHour(config))));
    return { slots: HOURS_PER_DAY * freq, period: freq <= 1 ? 'hour' : '5minute' };
}

//Fill short INTERIOR data holes (a slot with no source share, flanked by data on both sides) by carrying the
//previous slot, so a single missing recorder bucket doesn't slice a wedge through the ring. Trailing holes (the
//not-yet-lived part of the day) are left empty. Safe because a lived slot always has baseline load (always-on
//devices), so a zero-share slot inside the day is a data gap, not a genuine idle moment.
function bridgeShareGaps(solar: number[], battery: number[], grid: number[], maxGap: number): void
{
    const n = solar.length;
    const has = (i: number): boolean => (solar[i] + battery[i] + grid[i]) > 1e-6;
    let i = 0;
    while (i < n)
    {
        if (has(i)) { i++; continue; }
        let j = i;
        while (j < n && !has(j)) { j++; }
        if (i > 0 && j < n && (j - i) <= maxGap)
        {
            for (let k = i; k < j; k++) { solar[k] = solar[i - 1]; battery[k] = battery[i - 1]; grid[k] = grid[i - 1]; }
        }
        i = j;
    }
}

//Fetch today's per-slot shares into the host, keyed so an unchanged window/cadence (within the hour) never
//refetches. Cleared out of day mode. Window = local midnight to the last whole hour.
export async function refreshDayRing(host: DayRingHost): Promise<void>
{
    if (host._viewMode !== 'day' || !host.hass?.callWS)
    {
        if (host._dayRing !== null) { host._dayRing = null; host.requestUpdate(); }
        host._dayRingKey = '';
        return;
    }
    const d = host._energyDefaults;
    const { slots, period } = daySlotting(host.config);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const todayMidnight = midnight.getTime();
    //Yesterday shows the whole previous day (a complete ring); Today runs from local midnight to the live 5-min edge.
    const yesterday = host._timelineMode === 'yesterday';
    const startMs = yesterday ? todayMidnight - DAY_MS : todayMidnight;
    const endMs   = yesterday ? todayMidnight : Math.floor(Date.now() / LIVE_QUANTUM_MS) * LIVE_QUANTUM_MS;
    if (startMs >= endMs) { return; }

    const key = `${startMs}|${endMs}|${slots}|${period}|${d.solarStatEnergyFroms}|${d.gridStatEnergyFroms}|${d.gridStatEnergyTos}|${d.batteryStatEnergyTos}|${d.batteryStatEnergyFroms}`;
    if (key === host._dayRingKey) { return; }
    host._dayRingKey = key;

    const chg = (ids: string[]): Promise<ChangeBucket[] | null> =>
        ids.length ? fetchChangeSeries(host.hass, [...ids].sort(), startMs, endMs, period) : Promise.resolve(null);
    //Every device meter in one recorder call (per-id), then binned + run-detected each.
    const deviceIds = d.devices.map(dev => dev.statConsumption).filter(Boolean);
    const [solarB, impB, expB, bChgB, bDisB, deviceById] = await Promise.all([
        chg(d.solarStatEnergyFroms), chg(d.gridStatEnergyFroms), chg(d.gridStatEnergyTos),
        chg(d.batteryStatEnergyTos), chg(d.batteryStatEnergyFroms),
        deviceIds.length ? fetchChangeById(host.hass, deviceIds, startMs, endMs, period) : Promise.resolve(null),
    ]);
    //Ignore a resolution whose window/cadence moved on while it was in flight.
    if (host._dayRingKey !== key) { return; }
    const pv  = binSlots(solarB, slots);
    const imp = binSlots(impB, slots);
    const exp = binSlots(expB, slots);
    const bc  = binSlots(bChgB, slots);
    const bd  = binSlots(bDisB, slots);
    const shares = ringShares(pv, imp, exp, bc, bd);
    bridgeShareGaps(shares.solar, shares.battery, shares.grid, 3);
    //Solar-production floor: panels trickle a few watts round the clock, and at night that tiny output is 100% of a
    //tiny load, so the solar SHARE reads 1.0 and a bogus solar run appears at 2am. Drop the solar share for any slot
    //whose actual production is below ~50 W (converted to kWh for this slot's length).
    const solarFloorKwh = 0.05 * (HOURS_PER_DAY / slots);
    for (let s = 0; s < slots; s++) { if ((pv[s] ?? 0) < solarFloorKwh) { shares.solar[s] = 0; pv[s] = 0; } }
    const devices: DeviceRun[] = [];
    for (const dev of d.devices)
    {
        if (!dev.statConsumption) { continue; }
        const name = dev.name || host.hass?.states?.[dev.statConsumption]?.attributes?.friendly_name || dev.statConsumption;
        //A device with no real consumption today gets no ring (detectDeviceRuns returns null below the noise floor).
        const run = detectDeviceRuns(binSlots(deviceById?.[dev.statConsumption] ?? null, slots), dev.index, name);
        if (!run) { continue; }
        //Attribute the device's own energy to the solar / grid share of each slot it ran, for the tooltip.
        let sol = 0;
        let gr  = 0;
        for (let s = 0; s < slots; s++) { const v = Math.max(0, run.values[s]); sol += v * shares.solar[s]; gr += v * shares.grid[s]; }
        if (run.dailyKwh > 0) { run.solarPct = sol / run.dailyKwh; run.gridPct = gr / run.dailyKwh; }
        devices.push(run);
    }
    //Order the device rings by daily total, biggest just inside the source rings down to the smallest at the hub.
    devices.sort((a, b) => b.dailyKwh - a.dailyKwh);
    const hasSolar   = d.solarStatEnergyFroms.length > 0;
    const hasGrid    = d.gridStatEnergyFroms.length > 0 || d.gridStatEnergyTos.length > 0;
    const hasBattery = d.batteryStatEnergyFroms.length > 0 || d.batteryStatEnergyTos.length > 0;
    const sum = (a: number[]): number => a.reduce((t, v) => t + Math.max(0, v), 0);
    host._dayRing = {
        solar: shares.solar, battery: shares.battery, grid: shares.grid, devices, hasSolar, hasGrid, hasBattery,
        solarKwh: sum(pv), gridKwh: sum(imp), batteryKwh: sum(bd), pv, charge: bc,
    };
    host.requestUpdate();
}
