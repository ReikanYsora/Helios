//Battery-sign guard: detect a live `stat_rate` whose sign convention is the opposite of the card's assumption.
//
//The card puts the live rate into its own charge-positive convention: it negates a standard-slot sensor (HA's
//discharge-positive assumption) and keeps an inverted-slot sensor as-is (see energy-prefs.ts, invertedRateEntities).
//Either way a sensor can still report the opposite of what its slot declares, making the live power, chip and flow
//run backwards even though the Energy dashboard is right (it reads the directional charge/discharge meters, whose
//sign is structural).
//
//This guard cross-checks the EFFECTIVE rate (what the card shows) against that structural truth over a rolling
//window of hourly recorder stats (charge/discharge `change` + rate `mean`, min/max as a fallback); see
//evaluateBatteryHours for the per-hour evidence rules. A sensor found systematically backwards is flagged
//inverted, and battery.ts negates the live read to restore the correct direction; it self-clears if later
//evidence agrees (a reconfigured sensor). `battery-sign` stays a display-only preference, untouched by this.
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


//One hour of evidence: net battery energy (charge - discharge, kWh) and the raw rate sensor's mean + min/max (W)
//that hour. The mean is an integral, directly comparable to the net energy; min/max is the fallback when a
//non-measurement sensor records no mean.
export interface BatteryHour
{
    netKwh: number | null;
    meanW:  number | null;
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


//Pure evidence evaluation over the window's hours. `flipped` is whether the card already negates this rate (the
//standard slot; the inverted slot keeps it as-is), so the guard judges the EFFECTIVE sign the card shows, not the
//raw sensor. Exported for tests.
export function evaluateBatteryHours(hours: BatteryHour[], flipped: boolean): BatteryEvaluation
{
    let invertedHours = 0;
    let okHours = 0;
    for (const h of hours)
    {
        if (h.netKwh === null)
        {
            continue;
        }
        if (Math.abs(h.netKwh) < BATTERY_GUARD_MIN_KWH)
        {
            continue;
        }
        //Effective rate sign this hour = the raw sensor, negated when the card flips it. Prefer the mean (an
        //integral, directly comparable to the net energy, so a brief opposite spike in a mixed hour can't outvote
        //the real flow); fall back to the dominant min/max excursion only when no mean is recorded. A flat /
        //ambiguous hour carries no evidence.
        let effectivePositive: boolean;
        if (h.meanW !== null)
        {
            if (h.meanW === 0)
            {
                continue;
            }
            effectivePositive = (flipped ? -h.meanW : h.meanW) > 0;
        }
        else
        {
            if (h.minW === null || h.maxW === null)
            {
                continue;
            }
            const posExc = Math.max(0, h.maxW);
            const negExc = Math.max(0, -h.minW);
            if (posExc === 0 && negExc === 0)
            {
                continue;
            }
            const rawPositive = posExc >= negExc;
            effectivePositive = flipped ? !rawPositive : rawPositive;
        }
        //The card's convention is charge-positive: the effective sign should be positive while charging.
        const charging = h.netKwh > 0;
        const contradicts = charging ? !effectivePositive : effectivePositive;
        if (contradicts)
        {
            invertedHours++;
        }
        else
        {
            okHours++;
        }
    }
    return { invertedHours, okHours };
}


//Pure state transition from one evaluation. Exported for tests.
export function nextBatteryGuardState(prev: BatteryGuardState, hours: BatteryHour[], flipped: boolean): BatteryGuardState
{
    const ev = evaluateBatteryHours(hours, flipped);
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
    if (rates.length !== 1 || chargeIds.length === 0 || dischargeIds.length === 0 || !host.hass?.callWS)
    {
        return;
    }
    if (state.fetching)
    {
        return;
    }
    const anchor = Math.floor(Date.now() / GUARD_REFRESH_MS) * GUARD_REFRESH_MS;
    const key    = `${entityKey}|${anchor}`;
    if (key === state.fetchKey)
    {
        return;
    }
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
            types:         ['mean', 'min', 'max'],
            units:         { power: 'W' },
        }),
    ])
        .then(([energyRes, rateRes]) =>
        {
            //A prefs edit mid-fetch resets host._batteryGuard for the NEW wiring; drop this late result rather than
            //apply stale evidence over it (mirrors the grid-guard bail).
            if (host._batteryGuard.entityKey !== entityKey)
            {
                return;
            }
            const hours = buildBatteryHours(
                energyRes as Record<string, { start?: unknown; change?: number | null }[]>,
                rateRes   as Record<string, { start?: unknown; mean?: number | null; min?: number | null; max?: number | null }[]>,
                chargeIds, dischargeIds, rateId,
            );
            //The card negates a standard-slot rate but keeps an inverted-slot one; judge the sign the card actually
            //shows, so a correctly-declared inverted sensor is not mistaken for a contradiction.
            const flipped = (ed?.invertedRateEntities ?? []).includes(rateId);
            const next = nextBatteryGuardState(host._batteryGuard, hours, flipped);
            if (next !== host._batteryGuard)
            {
                const changed = next.status !== host._batteryGuard.status;
                next.fetchKey = key;
                next.entityKey = entityKey;
                host._batteryGuard = next;
                if (changed)
                {
                    host.requestUpdate();
                }
            }
        })
        .catch(() =>
        {
            //Recorder under load or RBAC denied: no evidence, no transition; the next re-arm retries.
        })
        .finally(() =>
        {
            //Only release the flag if this fetch still owns the live guard (a mid-fetch reset installed a fresh one).
            if (host._batteryGuard.entityKey === entityKey)
            {
                host._batteryGuard.fetching = false;
            }
        });
}


//Align the energy and rate payloads on hour starts: netKwh = charge - discharge, rate min/max are the raw sensor's.
//Exported for tests.
export function buildBatteryHours(
    energyRes:    Record<string, { start?: unknown; change?: number | null }[]>,
    rateRes:      Record<string, { start?: unknown; mean?: number | null; min?: number | null; max?: number | null }[]>,
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
            h = { netKwh: null, meanW: null, minW: null, maxW: null };
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
                if (startMs === null || change === null)
                {
                    continue;
                }
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
        if (startMs === null)
        {
            continue;
        }
        const h = slot(startMs);
        if (typeof b?.mean === 'number' && Number.isFinite(b.mean))
        {
            h.meanW = b.mean;
        }
        if (typeof b?.min  === 'number' && Number.isFinite(b.min))
        {
            h.minW  = b.min;
        }
        if (typeof b?.max  === 'number' && Number.isFinite(b.max))
        {
            h.maxW  = b.max;
        }
    }
    return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([, h]) => h);
}
