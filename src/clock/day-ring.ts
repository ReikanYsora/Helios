//Day-ring data: today's per-slot solar + grid-import shares (the share of each slot's home load met by local
//solar vs the grid). The slot count follows the card's display-update-frequency-per-hour setting (24 * freq), so a
//finer cadence draws a finer ring; the change-series is fetched at the matching recorder period.

import { fetchChangeSeries, outlierCapKwh, type ChangeBucket } from '../data/sources/energy-stats';
import { consumptionLoad } from '../core/energy';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import { displayUpdateFrequencyPerHour, type HeliosConfig } from '../core/config/helios-config';
import { serverHourFrac } from '../core/time/timezone';
import { HOUR_MS, HOURS_PER_DAY } from '../core/config/constants';

//Per-slot ring shares: solar (gold) + grid import (import colour), summing to ~1 under load, both 0 when empty.
export interface DayRingData
{
    solar: number[];
    grid:  number[];
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
        const s = Math.min(slots - 1, Math.max(0, Math.floor(serverHourFrac(b.startMs) * slots)));
        out[s] += Math.max(0, b.kwh);
    }
    return out;
}

//Per-slot solar + grid-import shares of the ring cell, from the slot's energy sums. Pure (testable): solar =
//self-consumed solar / load, grid = grid import / load; both 0 for a slot with no load (future or idle).
export function ringShares(pv: number[], imp: number[], exp: number[], battNet: number[]): DayRingData
{
    const n = pv.length;
    const solar = new Array<number>(n).fill(0);
    const grid  = new Array<number>(n).fill(0);
    for (let s = 0; s < n; s++)
    {
        const load = consumptionLoad(pv[s] ?? 0, imp[s] ?? 0, exp[s] ?? 0, battNet[s] ?? 0);
        if (load <= 0) { continue; }
        const gridShare = Math.max(0, Math.min(1, (imp[s] ?? 0) / load));
        grid[s]  = gridShare;
        solar[s] = Math.max(0, 1 - gridShare);
    }
    return { solar, grid };
}

//Slots-per-day + the recorder period that resolves them: hourly at freq 1, else 5-minute (binned down to slots).
function daySlotting(config: HeliosConfig | undefined): { slots: number; period: '5minute' | 'hour' }
{
    const freq = Math.max(1, Math.min(6, Math.round(displayUpdateFrequencyPerHour(config))));
    return { slots: HOURS_PER_DAY * freq, period: freq <= 1 ? 'hour' : '5minute' };
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
    //Quantise the end to the whole hour so the key doesn't churn every frame (Date.now() advances each render).
    const endMs = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    if (startMs >= endMs) { return; }

    const key = `${startMs}|${endMs}|${slots}|${period}|${d.solarStatEnergyFroms}|${d.gridStatEnergyFroms}|${d.gridStatEnergyTos}|${d.batteryStatEnergyTos}|${d.batteryStatEnergyFroms}`;
    if (key === host._dayRingKey) { return; }
    host._dayRingKey = key;

    const chg = (ids: string[]): Promise<ChangeBucket[] | null> =>
        ids.length ? fetchChangeSeries(host.hass, [...ids].sort(), startMs, endMs, period) : Promise.resolve(null);
    const [solarB, impB, expB, bChgB, bDisB] = await Promise.all([
        chg(d.solarStatEnergyFroms), chg(d.gridStatEnergyFroms), chg(d.gridStatEnergyTos),
        chg(d.batteryStatEnergyTos), chg(d.batteryStatEnergyFroms),
    ]);
    //Ignore a resolution whose window/cadence moved on while it was in flight.
    if (host._dayRingKey !== key) { return; }
    const pv  = binSlots(solarB, slots);
    const imp = binSlots(impB, slots);
    const exp = binSlots(expB, slots);
    const bc  = binSlots(bChgB, slots);
    const bd  = binSlots(bDisB, slots);
    host._dayRing = ringShares(pv, imp, exp, bc.map((c, s) => c - bd[s]));
    host.requestUpdate();
}
