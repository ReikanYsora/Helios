//Day-ring data: today's per-slot solar + grid-import shares (the share of each slot's home load met by local
//solar vs the grid). The slot count follows the card's display-update-frequency-per-hour setting (24 * freq), so a
//finer cadence draws a finer ring; the change-series is fetched at the matching recorder period.

import { fetchChangeSeries, fetchChangeById, outlierCapKwh, type ChangeBucket } from '../data/sources/energy-stats';
import { consumptionLoad } from '../core/energy';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import { displayUpdateFrequencyPerHour, type HeliosConfig } from '../core/config/helios-config';
import { serverHourFrac } from '../core/time/timezone';
import { HOURS_PER_DAY } from '../core/config/constants';

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
}

//One device's run(s) over the day: contiguous on-slots as arcs (episodic) or the whole day (continuous). `index`
//is the dashboard position, so the ring reuses HA's per-index device colour.
export interface DeviceRun
{
    index:      number;
    name:       string;
    //Per-slot energy (kWh). The ring's radial extent scales each slot by values[slot] / peak-slot, so the outer
    //edge shows how hard the device drew at that moment (inner edge = 0).
    values:     number[];
    segments:   { start: number; end: number }[];
    continuous: boolean;
    //Tooltip figures: the day's total and the share of it that fell on solar-covered vs grid-covered slots.
    dailyKwh:   number;
    solarPct:   number;
    gridPct:    number;
}

//Below this daily total (kWh) a device gets no ring (noise cut). Run tunables: a slot counts as "on" above this
//fraction of the device's peak slot; a device on for at least CONTINUOUS_FRAC of slots reads as a full ring; short
//gaps up to BRIDGE_SLOTS are bridged so sparse data does not shred a cycle into fragments.
const DEVICE_THRESHOLD_KWH = 0.1;
const RUN_ACTIVE_FRAC     = 0.15;
const RUN_CONTINUOUS_FRAC = 0.8;
const RUN_BRIDGE_SLOTS    = 2;

//Detect a device's run(s) from its per-slot energy (kWh). Null when the daily total is below the noise threshold.
export function detectDeviceRuns(kwh: number[], index: number, name: string): DeviceRun | null
{
    let total = 0;
    let peak  = 0;
    for (const v of kwh) { const x = Math.max(0, v); total += x; if (x > peak) { peak = x; } }
    if (total < DEVICE_THRESHOLD_KWH || peak <= 0) { return null; }
    const slots = kwh.length;
    const onCut = peak * RUN_ACTIVE_FRAC;
    const on    = kwh.map(v => v > onCut);
    let onCount = 0;
    for (const b of on) { if (b) { onCount++; } }
    if (onCount >= slots * RUN_CONTINUOUS_FRAC)
    {
        return { index, name, values: kwh, segments: [{ start: 0, end: slots }], continuous: true, dailyKwh: total, solarPct: 0, gridPct: 0 };
    }
    const segments: { start: number; end: number }[] = [];
    let i = 0;
    while (i < slots)
    {
        if (!on[i]) { i++; continue; }
        let end = i + 1;
        let j   = i + 1;
        let gap = 0;
        while (j < slots && gap <= RUN_BRIDGE_SLOTS)
        {
            if (on[j]) { end = j + 1; gap = 0; }
            else { gap++; }
            j++;
        }
        segments.push({ start: i, end });
        i = end;
    }
    return { index, name, values: kwh, segments, continuous: false, dailyKwh: total, solarPct: 0, gridPct: 0 };
}

export interface DayRingHost
{
    hass:            any;
    config:          HeliosConfig | undefined;
    _energyDefaults: EnergyDefaults;
    _viewMode?:      'scene' | 'clock' | 'trend' | 'day';
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
    const startMs = midnight.getTime();
    const endMs = Math.floor(Date.now() / LIVE_QUANTUM_MS) * LIVE_QUANTUM_MS;
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
    const devices: DeviceRun[] = [];
    for (const dev of d.devices)
    {
        if (!dev.statConsumption) { continue; }
        const run = detectDeviceRuns(binSlots(deviceById?.[dev.statConsumption] ?? null, slots), dev.index, dev.name || dev.statConsumption);
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
    host._dayRing = { solar: shares.solar, battery: shares.battery, grid: shares.grid, devices, hasSolar, hasGrid, hasBattery };
    host.requestUpdate();
}
