//Day-ring data: today's hour-of-day energy profile reduced to a 24-slot self-sufficiency vector (the share of
//each hour's home load met by local solar rather than the grid). Reuses the clock's hourly-profile fetch over the
//[local midnight, now] window; the ring tints each hour gold by this share.

import { fetchHourlyProfile, type ClockHourly } from './clock-hourly';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import { HOUR_MS, HOURS_PER_DAY } from '../core/config/constants';

export interface DayRingHost
{
    hass:            any;
    _energyDefaults: EnergyDefaults;
    _viewMode?:      'scene' | 'clock' | 'trend' | 'day';
    _dayRingProfile: ClockHourly | null;
    _dayRingKey:     string;
    requestUpdate(): void;
}

//Per-hour ring shares: the fraction of each hour's ring cell to fill with solar (gold) and with grid import (import
//colour). solar = self-consumed solar / load, grid = grid import / load; they sum to ~1 under load. Both 0 for an
//hour with no load (future or idle), so its cell stays empty. Together they show where the hour's energy came from.
export function computeRingShares(profile: ClockHourly | null): { solar: number[]; grid: number[] }
{
    const solar = new Array<number>(HOURS_PER_DAY).fill(0);
    const grid  = new Array<number>(HOURS_PER_DAY).fill(0);
    if (!profile) { return { solar, grid }; }
    for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        const load = profile.consumption[h] ?? 0;
        if (load <= 0) { continue; }
        const imp = Math.max(0, Math.min(load, profile.gridImport[h] ?? 0));
        grid[h]  = imp / load;
        solar[h] = Math.max(0, 1 - grid[h]);
    }
    return { solar, grid };
}

//Fetch today's hour-of-day profile into the host, keyed so an unchanged window (within the hour) never refetches.
//Cleared out of day mode. Modelled on the clock's hourly refresh; single window = local midnight to the last whole
//hour (the current partial hour lags in HA's hourly stats anyway).
export async function refreshDayRing(host: DayRingHost): Promise<void>
{
    if (host._viewMode !== 'day' || !host.hass?.callWS)
    {
        if (host._dayRingProfile !== null) { host._dayRingProfile = null; host.requestUpdate(); }
        host._dayRingKey = '';
        return;
    }
    const d        = host._energyDefaults;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const startMs = midnight.getTime();
    //Quantise the end to the whole hour so the key doesn't churn every frame (Date.now() advances each render).
    const endMs   = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    if (startMs >= endMs) { return; }

    const key = `${startMs}|${endMs}|${d.solarStatEnergyFroms}|${d.gridStatEnergyFroms}|${d.gridStatEnergyTos}|${d.batteryStatEnergyTos}|${d.batteryStatEnergyFroms}`;
    if (key === host._dayRingKey) { return; }
    host._dayRingKey = key;

    //Custom entity is irrelevant to the ring (it only feeds ClockHourly.custom), so pass '' for the id.
    const profile = await fetchHourlyProfile(host.hass, d, '', startMs, endMs);
    //Ignore a resolution whose window moved on while it was in flight.
    if (host._dayRingKey !== key) { return; }
    host._dayRingProfile = profile;
    host.requestUpdate();
}
