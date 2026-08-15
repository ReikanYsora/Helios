//Battery-sign guard: detect a live `stat_rate` whose sign convention is the opposite of the card's assumption.
//
//The card assumes HA's documented battery convention (stat_rate discharge-positive) and flips the live rate to its
//own charge-positive convention (see energy-prefs.ts). Some integrations report the opposite (charge-positive), so
//the flip makes the live power, the chip and the flow direction run backwards even though the Energy dashboard is
//right (the dashboard reads the directional charge/discharge energy meters, whose sign is structural).
//
//This guard cross-checks the raw rate against that structural truth. Over a rolling window it fetches, per hour, the
//charge meter `change`, the discharge meter `change`, and the rate sensor's raw `min`/`max`. For each hour with real
//battery activity it asks whether the rate's dominant raw sign agrees with the assumption (negative while charging,
//positive while discharging). If it is systematically the other way round, the sensor is charge-positive, the
//assumption is wrong, and the guard flags it inverted; battery.ts then negates the live read to restore the correct
//direction and flow. It self-clears if later evidence agrees (a reconfigured sensor). `battery-sign` stays a
//display-only preference and is untouched by any of this.
//
//Only a single-net-rate install with BOTH directional meters is evaluated (the structural truth needs both); every
//other wiring keeps the current behaviour.

import type { HassLike } from '../../core/ha-types';
import type { EnergyDefaults } from './energy-prefs';
import {
    GUARD_REFRESH_MS, GUARD_WINDOW_MS,
    BATTERY_GUARD_MIN_KWH, BATTERY_GUARD_INVERT_HOURS, BATTERY_GUARD_CLEAN_EVALS,
} from '../../core/config/constants';
import { callWS } from '../ha-gateway';
import { parseStatBoundary } from './energy-stats';


export type BatteryGuardStatus = 'unknown' | 'normal' | 'inverted';

export interface BatteryGuardState
{
    status:     BatteryGuardStatus;
    //Consecutive agreeing evaluations (with real activity) while inverted; returns to normal at CLEAN_EVALS.
    cleanEvals: number;
    fetchKey:   string;
    fetching:   boolean;
    //Wiring signature (rate + directional meter ids); a prefs edit that changes it resets the whole state.
    entityKey:  string;
}


export function createBatteryGuard(): BatteryGuardState
{
    return { status: 'unknown', cleanEvals: 0, fetchKey: '', fetching: false, entityKey: '' };
}


//True once the guard has proven the live rate inverted vs the assumption; battery.ts negates the live read.
export function batteryLiveInverted(state: BatteryGuardState): boolean
{
    return state.status === 'inverted';
}


//One hour of evidence: net battery energy (charge - discharge, kWh) and the raw rate sensor's min/max (W) that hour.
export interface BatteryHour
{
    netKwh: number | null;
    minW:   number | null;
    maxW:   number | null;
}


interface BatteryEvaluation
{
    //Hours whose raw rate sign contradicts the discharge-positive assumption (positive while charging, or negative
    //while discharging): evidence the sensor is charge-positive.
    invertedHours: number;
    //Hours whose raw rate sign agrees with the assumption: evidence it is correctly discharge-positive.
    okHours:       number;
}


//Pure evidence evaluation over the window's hours. Exported for tests.
export function evaluateBatteryHours(hours: BatteryHour[]): BatteryEvaluation
{
    let invertedHours = 0;
    let okHours = 0;
    for (const h of hours)
    {
        if (h.netKwh === null || h.minW === null || h.maxW === null) { continue; }
        if (Math.abs(h.netKwh) < BATTERY_GUARD_MIN_KWH) { continue; }
        //Which sign dominated the raw rate this hour: the larger excursion wins. A flat/ambiguous hour (neither
        //excursion meaningful) carries no evidence.
        const posExc = Math.max(0, h.maxW);
        const negExc = Math.max(0, -h.minW);
        if (posExc === 0 && negExc === 0) { continue; }
        const ratePositive = posExc >= negExc;
        const charging = h.netKwh > 0;
        //Assumption = discharge-positive: a charging hour should read negative, a discharging hour positive.
        const contradicts = charging ? ratePositive : !ratePositive;
        if (contradicts) { invertedHours++; }
        else { okHours++; }
    }
    return { invertedHours, okHours };
}


//Pure state transition from one evaluation. Exported for tests.
export function nextBatteryGuardState(prev: BatteryGuardState, hours: BatteryHour[]): BatteryGuardState
{
    const ev = evaluateBatteryHours(hours);
    if (prev.status !== 'inverted')
    {
        if (ev.invertedHours >= BATTERY_GUARD_INVERT_HOURS && ev.invertedHours > ev.okHours)
        {
            return { ...prev, status: 'inverted', cleanEvals: 0 };
        }
        return { ...prev, status: 'normal' };
    }
    //Inverted: only an evaluation that carries real, agreeing activity votes to clear.
    if (ev.invertedHours > 0)
    {
        return { ...prev, cleanEvals: 0 };
    }
    if (ev.okHours === 0)
    {
        return prev;
    }
    const cleanEvals = prev.cleanEvals + 1;
    if (cleanEvals >= BATTERY_GUARD_CLEAN_EVALS)
    {
        return { ...prev, status: 'normal', cleanEvals: 0 };
    }
    return { ...prev, cleanEvals };
}


export interface BatteryGuardHost
{
    readonly hass: HassLike;
    readonly _energyDefaults?: EnergyDefaults;
    _batteryGuard: BatteryGuardState;
    requestUpdate(): void;
}


//Evaluation driver, called from refreshBattery every cycle: a cheap no-op between GUARD_REFRESH_MS re-arms and outside
//its preconditions (exactly one rate sensor + both directional meters, so the structural truth exists).
export function refreshBatteryGuard(host: BatteryGuardHost): void
{
    const ed           = host._energyDefaults;
    const rates        = ed?.batteryStatRates       ?? [];
    const chargeIds    = ed?.batteryStatEnergyTos   ?? [];
    const dischargeIds = ed?.batteryStatEnergyFroms ?? [];
    const entityKey    = `${[...rates].sort().join(',')}|${[...chargeIds].sort().join(',')}|${[...dischargeIds].sort().join(',')}`;
    const state        = host._batteryGuard;
    if (entityKey !== state.entityKey)
    {
        host._batteryGuard = { ...createBatteryGuard(), entityKey };
        return;
    }
    if (rates.length !== 1 || chargeIds.length === 0 || dischargeIds.length === 0 || !host.hass?.callWS) { return; }
    if (state.fetching) { return; }
    const anchor = Math.floor(Date.now() / GUARD_REFRESH_MS) * GUARD_REFRESH_MS;
    const key    = `${entityKey}|${anchor}`;
    if (key === state.fetchKey) { return; }
    state.fetchKey = key;
    state.fetching = true;

    const endMs   = Date.now();
    const startMs = endMs - GUARD_WINDOW_MS;
    const rateId  = rates[0];
    void Promise.all([
        callWS(host.hass, {
            type:          'recorder/statistics_during_period',
            start_time:    new Date(startMs).toISOString(),
            end_time:      new Date(endMs).toISOString(),
            statistic_ids: [...chargeIds, ...dischargeIds],
            period:        'hour',
            types:         ['change'],
            units:         { energy: 'kWh' },
        }),
        callWS(host.hass, {
            type:          'recorder/statistics_during_period',
            start_time:    new Date(startMs).toISOString(),
            end_time:      new Date(endMs).toISOString(),
            statistic_ids: [rateId],
            period:        'hour',
            types:         ['min', 'max'],
            units:         { power: 'W' },
        }),
    ])
        .then(([energyRes, rateRes]) =>
        {
            //A prefs edit mid-fetch resets host._batteryGuard for the NEW wiring; drop this late result rather than
            //apply stale evidence over it (mirrors the grid-guard bail).
            if (host._batteryGuard.entityKey !== entityKey) { return; }
            const hours = buildBatteryHours(
                energyRes as Record<string, { start?: unknown; change?: number | null }[]>,
                rateRes   as Record<string, { start?: unknown; min?: number | null; max?: number | null }[]>,
                chargeIds, dischargeIds, rateId,
            );
            const next = nextBatteryGuardState(host._batteryGuard, hours);
            if (next !== host._batteryGuard)
            {
                const changed = next.status !== host._batteryGuard.status;
                next.fetchKey = key;
                next.entityKey = entityKey;
                host._batteryGuard = next;
                if (changed) { host.requestUpdate(); }
            }
        })
        .catch(() =>
        {
            //Recorder under load or RBAC denied: no evidence, no transition; the next re-arm retries.
        })
        .finally(() =>
        {
            //Only release the flag if this fetch still owns the live guard (a mid-fetch reset installed a fresh one).
            if (host._batteryGuard.entityKey === entityKey) { host._batteryGuard.fetching = false; }
        });
}


//Align the energy and rate payloads on hour starts: netKwh = charge - discharge, rate min/max are the raw sensor's.
//Exported for tests.
export function buildBatteryHours(
    energyRes:    Record<string, { start?: unknown; change?: number | null }[]>,
    rateRes:      Record<string, { start?: unknown; min?: number | null; max?: number | null }[]>,
    chargeIds:    string[],
    dischargeIds: string[],
    rateId:       string,
): BatteryHour[]
{
    const byStart = new Map<number, BatteryHour>();
    const slot = (startMs: number): BatteryHour =>
    {
        let h = byStart.get(startMs);
        if (!h)
        {
            h = { netKwh: null, minW: null, maxW: null };
            byStart.set(startMs, h);
        }
        return h;
    };
    const addEnergy = (ids: string[], sign: number): void =>
    {
        for (const id of ids)
        {
            for (const b of energyRes?.[id] ?? [])
            {
                const startMs = parseStatBoundary(b?.start);
                const change  = typeof b?.change === 'number' && Number.isFinite(b.change) ? b.change : null;
                if (startMs === null || change === null) { continue; }
                const h = slot(startMs);
                h.netKwh = (h.netKwh ?? 0) + sign * change;
            }
        }
    };
    addEnergy(chargeIds, 1);       //stat_energy_to = charge (positive)
    addEnergy(dischargeIds, -1);   //stat_energy_from = discharge (negative)
    for (const b of rateRes?.[rateId] ?? [])
    {
        const startMs = parseStatBoundary(b?.start);
        if (startMs === null) { continue; }
        const h = slot(startMs);
        if (typeof b?.min === 'number' && Number.isFinite(b.min)) { h.minW = b.min; }
        if (typeof b?.max === 'number' && Number.isFinite(b.max)) { h.maxW = b.max; }
    }
    return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([, h]) => h);
}
