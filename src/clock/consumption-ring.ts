//Day-ring data: today's per-slot solar + grid-import shares (the share of each slot's home load met by local
//solar vs the grid). The slot count follows the card's display-update-frequency-per-hour setting (24 * freq), so a
//finer cadence draws a finer ring; the change-series is fetched at the matching recorder period.

import { fetchChangeSeries, fetchChangeById, outlierCapKwh, type ChangeBucket } from '../data/sources/energy-stats';
import { activeGroups, groupDevices, groupColorHex, deviceName } from '../data/sources/device-consumption';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import { consumptionLoad } from '../core/energy';
import { displayUpdateFrequencyPerHour, consumptionRingHidden, monitoringGroupName, type HeliosConfig } from '../core/config/helios-config';
import { pickTranslations } from '../core/i18n';
import { serverHourFrac, localMidnightMinusDays } from '../core/time/timezone';
import { modePastDays, type TimelineMode } from '../timeline/timeline-modes';
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
    //Historical peak average power (kW) across all consumption meters: the device ribbons' width reference. A slot at
    //this power fills the ring; a lighter slot is proportionally thinner. 0 when no history is known.
    maxKw:      number;
}

//One device's day on the ring. `index` is the dashboard position, so the ring reuses HA's per-index device colour;
//`statId` is the recorder meter, the stable key the hidden / order config lists match on.
export interface DeviceRun
{
    index:      number;
    name:       string;
    statId:     string;
    //Resolved ring colour. Set for monitoring-group rings (the group's colour); device rings leave it unset and
    //fall back to the per-index dashboard colour.
    color?:     string;
    //Per-slot energy (kWh); the ring's variable-width ribbon is derived from this at draw time.
    values:     number[];
    //Selection-panel figures: the day's total and how it split across the three sources (solar + grid + battery ~ 1).
    dailyKwh:    number;
    solarPct:    number;
    gridPct:     number;
    batteryPct:  number;
    //Group rings only: the per-device runs of the group, for the drill-down level (one ring per member device).
    members?:    DeviceRun[];
}

//Summarise a device for the day ring from its per-slot energy (kWh): its day total plus the per-slot series the
//ribbon is drawn from. Visibility is the editor's call alone (hidden list); a low-consumption device just draws a
//thin ribbon.
export function detectDeviceRuns(kwh: number[], index: number, name: string, statId: string): DeviceRun
{
    let total = 0;
    for (const v of kwh) { total += Math.max(0, v); }
    return { index, name, statId, values: kwh, dailyKwh: total, solarPct: 0, gridPct: 0, batteryPct: 0 };
}

export interface DayRingHost
{
    hass:            any;
    config:          HeliosConfig | undefined;
    _energyDefaults: EnergyDefaults;
    _viewMode?:      'scene' | 'clock' | 'day';
    _timelineMode?:  TimelineMode;   //the active period; the ring aggregates its days by hour-of-day
    _dayRing:        DayRingData | null;
    _dayRingKey:     string;
    //Cached ring-width reference (kW). Fetched once (barely moves day to day); `undefined` until the first day build.
    _dayMaxKw?:      number;
    requestUpdate(): void;
}

//Historical peak average power (kW) across every consumption meter: the device-ribbon width reference (a slot at
//this power fills the ring; 0 is a hairline). One hourly recorder pass over the retained history, outlier-capped so
//a meter reset can't blow the scale. Hourly kWh already equals that hour's average kW.
const MAX_KW_HISTORY_DAYS = 366;
async function fetchConsumptionMaxKw(host: DayRingHost, deviceIds: string[]): Promise<number>
{
    if (!deviceIds.length || !host.hass?.callWS) { return 0; }
    const end   = Date.now();
    const byId  = await fetchChangeById(host.hass, deviceIds, end - MAX_KW_HISTORY_DAYS * DAY_MS, end, 'hour');
    if (!byId) { return 0; }
    let max = 0;
    for (const id of deviceIds)
    {
        const buckets = byId[id];
        if (!buckets) { continue; }
        const cap = outlierCapKwh(buckets);
        for (const b of buckets) { if (Number.isFinite(b.kwh) && b.kwh <= cap && b.kwh > max) { max = b.kwh; } }
    }
    return max;
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

//The 24-hour dial's window + cadence for the active period. Every day in the window aggregates by hour-of-day
//(binSlots sums each source's buckets into their hour-of-day slot), so a multi-day period shows the summed daily
//profile. A single-day window keeps the fine per-freq cadence; a multi-day window drops to hourly (24 slots) so a
//long span never pulls sub-hour rows and each hourly bucket still lands in exactly one slot.
function ringWindow(host: DayRingHost): { startMs: number; endMs: number; slots: number; period: '5minute' | 'hour'; nDays: number }
{
    const mode     = host._timelineMode ?? 'today';
    const liveEdge = Math.floor(Date.now() / LIVE_QUANTUM_MS) * LIVE_QUANTUM_MS;
    //Yesterday is exactly the previous whole day; every other mode ends at the live edge and spans its past days.
    const startMs = mode === 'yesterday' ? localMidnightMinusDays(1) : localMidnightMinusDays(modePastDays(mode));
    const endMs   = mode === 'yesterday' ? localMidnightMinusDays(0) : liveEdge;
    const nDays   = Math.max(1, Math.round((endMs - startMs) / DAY_MS));
    const freq    = Math.max(1, Math.min(6, Math.round(displayUpdateFrequencyPerHour(host.config))));
    if (nDays <= 1 && freq > 1) { return { startMs, endMs, slots: HOURS_PER_DAY * freq, period: '5minute', nDays }; }
    return { startMs, endMs, slots: HOURS_PER_DAY, period: 'hour', nDays };
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
    const { startMs, endMs, slots, period, nDays } = ringWindow(host);
    if (startMs >= endMs) { return; }

    //Group assignment (per group, its visible device ids) is part of the key so re-grouping / hiding a device
    //rebuilds the ring instead of serving a stale one.
    const groupSig = activeGroups(host.config, d)
        .map(g => `${g}:${groupDevices(host.config, d, g).map(dev => dev.statConsumption).join('+')}`)
        .join('|');
    const key = `${startMs}|${endMs}|${slots}|${period}|${d.solarStatEnergyFroms}|${d.gridStatEnergyFroms}|${d.gridStatEnergyTos}|${d.batteryStatEnergyTos}|${d.batteryStatEnergyFroms}|${groupSig}`;
    if (key === host._dayRingKey) { return; }
    host._dayRingKey = key;

    //The meters the user hid from the ring entirely.
    const hidden = consumptionRingHidden(host.config);

    const chg = (ids: string[]): Promise<ChangeBucket[] | null> =>
        ids.length ? fetchChangeSeries(host.hass, [...ids].sort(), startMs, endMs, period) : Promise.resolve(null);
    //Every non-hidden device meter in one recorder call (per-id), then binned + run-detected each.
    const deviceIds = d.devices.map(dev => dev.statConsumption).filter(id => id && !hidden.has(id));
    //The width reference spans EVERY configured consumption meter (hidden ones included), so hiding a device from the
    //ring doesn't rescale the others. Fetched once, then reused from the host cache.
    const allDeviceIds = d.devices.map(dev => dev.statConsumption).filter(Boolean);
    const [solarB, impB, expB, bChgB, bDisB, deviceById, maxKw] = await Promise.all([
        chg(d.solarStatEnergyFroms), chg(d.gridStatEnergyFroms), chg(d.gridStatEnergyTos),
        chg(d.batteryStatEnergyTos), chg(d.batteryStatEnergyFroms),
        deviceIds.length ? fetchChangeById(host.hass, deviceIds, startMs, endMs, period) : Promise.resolve(null),
        host._dayMaxKw === undefined ? fetchConsumptionMaxKw(host, allDeviceIds) : Promise.resolve(host._dayMaxKw),
    ]);
    host._dayMaxKw = maxKw;
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
    //~50 W average for the slot's hour-of-day, summed across the window's days (each slot holds nDays contributions).
    const solarFloorKwh = 0.05 * (HOURS_PER_DAY / slots) * nDays;
    for (let s = 0; s < slots; s++) { if ((pv[s] ?? 0) < solarFloorKwh) { shares.solar[s] = 0; pv[s] = 0; } }
    //One ring per active monitoring group: sum the group's visible devices' per-slot energy into a single run in
    //the group's colour. activeGroups returns 1..GROUP_COUNT in order, so the outer ring is group 1, nesting inward.
    const el = host as unknown as Element;
    //Split a run's daily energy across the three sources by each slot's share (the three sum to ~1), for the panel.
    const attributeShares = (run: DeviceRun): void =>
    {
        let sol = 0; let gr = 0; let bat = 0;
        for (let s = 0; s < slots; s++) { const v = Math.max(0, run.values[s]); sol += v * shares.solar[s]; gr += v * shares.grid[s]; bat += v * shares.battery[s]; }
        if (run.dailyKwh > 0) { run.solarPct = sol / run.dailyKwh; run.gridPct = gr / run.dailyKwh; run.batteryPct = bat / run.dailyKwh; }
    };
    const devices: DeviceRun[] = [];
    for (const g of activeGroups(host.config, d))
    {
        const values = new Array<number>(slots).fill(0);
        //One member run per visible device of the group (drill-down level), plus the summed group ring.
        const members: DeviceRun[] = [];
        for (const dev of groupDevices(host.config, d, g))
        {
            const dv = binSlots(deviceById?.[dev.statConsumption] ?? null, slots);
            for (let s = 0; s < slots; s++) { values[s] += Math.max(0, dv[s]); }
            const mRun = detectDeviceRuns(dv, dev.index, deviceName(host.hass, dev), dev.statConsumption);
            attributeShares(mRun);
            members.push(mRun);
        }
        const name = monitoringGroupName(host.config, g) || `${pickTranslations(host.hass?.language).editor.group ?? 'Group'} ${g}`;
        const run  = detectDeviceRuns(values, g, name, `group-${g}`);
        run.color  = groupColorHex(el, host.config, g);
        attributeShares(run);
        run.members = members;
        devices.push(run);
    }
    const hasSolar   = d.solarStatEnergyFroms.length > 0;
    const hasGrid    = d.gridStatEnergyFroms.length > 0 || d.gridStatEnergyTos.length > 0;
    const hasBattery = d.batteryStatEnergyFroms.length > 0 || d.batteryStatEnergyTos.length > 0;
    const sum = (a: number[]): number => a.reduce((t, v) => t + Math.max(0, v), 0);
    host._dayRing = {
        solar: shares.solar, battery: shares.battery, grid: shares.grid, devices, hasSolar, hasGrid, hasBattery,
        solarKwh: sum(pv), gridKwh: sum(imp), batteryKwh: sum(bd), maxKw,
    };
    host.requestUpdate();
}
