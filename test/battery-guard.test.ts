import { describe, it, expect } from 'vitest';
import {
    evaluateBatteryHours,
    nextBatteryGuardState,
    buildBatteryHours,
    createBatteryGuard,
    batteryLiveInverted,
    type BatteryHour,
} from '../src/data/sources/battery-guard';

//A charging hour whose raw rate reads POSITIVE = the sensor is charge-positive = contradicts the assumption.
const chargingRatePositive = (): BatteryHour => ({ netKwh: 1.2, minW: -30, maxW: 3000 });
//A charging hour whose raw rate reads NEGATIVE = discharge-positive = agrees with the assumption.
const chargingRateNegative = (): BatteryHour => ({ netKwh: 1.2, minW: -3000, maxW: 30 });
//A discharging hour whose raw rate reads POSITIVE = discharge-positive = agrees.
const dischargingRatePositive = (): BatteryHour => ({ netKwh: -1.2, minW: -30, maxW: 3000 });

describe('evaluateBatteryHours', () =>
{
    it('counts a charging hour with a positive raw rate as inverted evidence', () =>
    {
        expect(evaluateBatteryHours([chargingRatePositive()])).toEqual({ invertedHours: 1, okHours: 0 });
    });

    it('counts a charging hour with a negative raw rate as agreeing (discharge-positive)', () =>
    {
        expect(evaluateBatteryHours([chargingRateNegative()])).toEqual({ invertedHours: 0, okHours: 1 });
    });

    it('counts a discharging hour with a positive raw rate as agreeing', () =>
    {
        expect(evaluateBatteryHours([dischargingRatePositive()])).toEqual({ invertedHours: 0, okHours: 1 });
    });

    it('counts a discharging hour with a negative raw rate as inverted evidence', () =>
    {
        expect(evaluateBatteryHours([{ netKwh: -1.2, minW: -3000, maxW: 30 }])).toEqual({ invertedHours: 1, okHours: 0 });
    });

    it('skips idle hours (net below the activity floor), null fields, and flat rate hours', () =>
    {
        const hours: BatteryHour[] = [
            { netKwh: 0.01, minW: -3000, maxW: 30 },  //below BATTERY_GUARD_MIN_KWH
            { netKwh: 1.2, minW: null, maxW: 30 },     //missing datum
            { netKwh: 1.2, minW: 0, maxW: 0 },         //flat / ambiguous
        ];
        expect(evaluateBatteryHours(hours)).toEqual({ invertedHours: 0, okHours: 0 });
    });
});

describe('nextBatteryGuardState', () =>
{
    it('flags inverted after enough contradicting hours', () =>
    {
        const hours = [chargingRatePositive(), chargingRatePositive(), chargingRatePositive()];
        const next = nextBatteryGuardState(createBatteryGuard(), hours);
        expect(next.status).toBe('inverted');
        expect(batteryLiveInverted(next)).toBe(true);
    });

    it('stays normal below the threshold', () =>
    {
        const hours = [chargingRatePositive(), chargingRatePositive()];  //only 2
        expect(nextBatteryGuardState(createBatteryGuard(), hours).status).toBe('normal');
    });

    it('does not flag when agreeing hours outnumber contradictions', () =>
    {
        const hours = [
            chargingRatePositive(), chargingRatePositive(), chargingRatePositive(),
            chargingRateNegative(), chargingRateNegative(), chargingRateNegative(), chargingRateNegative(),
        ];
        expect(nextBatteryGuardState(createBatteryGuard(), hours).status).toBe('normal');
    });

    it('self-clears back to normal after three agreeing evaluations', () =>
    {
        let s = nextBatteryGuardState(createBatteryGuard(), [chargingRatePositive(), chargingRatePositive(), chargingRatePositive()]);
        expect(s.status).toBe('inverted');
        const agreeing = [chargingRateNegative()];
        s = nextBatteryGuardState(s, agreeing); expect(s.status).toBe('inverted');
        s = nextBatteryGuardState(s, agreeing); expect(s.status).toBe('inverted');
        s = nextBatteryGuardState(s, agreeing); expect(s.status).toBe('normal');
    });

    it('a contradiction resets the self-clear progress', () =>
    {
        let s = nextBatteryGuardState(createBatteryGuard(), [chargingRatePositive(), chargingRatePositive(), chargingRatePositive()]);
        s = nextBatteryGuardState(s, [chargingRateNegative()]);           //cleanEvals -> 1
        s = nextBatteryGuardState(s, [chargingRatePositive()]);           //contradiction -> reset
        expect(s.status).toBe('inverted');
        expect(s.cleanEvals).toBe(0);
    });

    it('leaves an inverted verdict untouched when a window carries no activity', () =>
    {
        const inverted = nextBatteryGuardState(createBatteryGuard(), [chargingRatePositive(), chargingRatePositive(), chargingRatePositive()]);
        const after = nextBatteryGuardState(inverted, []);
        expect(after).toBe(inverted);  //same reference: no transition
    });
});

describe('buildBatteryHours', () =>
{
    it('nets charge minus discharge per hour and carries the raw rate min/max', () =>
    {
        const h0 = 1_700_000_000_000;
        const h1 = h0 + 3_600_000;
        const energy = {
            'sensor.batt_charge':    [{ start: h0, change: 2.0 }, { start: h1, change: 0.1 }],
            'sensor.batt_discharge': [{ start: h0, change: 0.3 }, { start: h1, change: 1.5 }],
        };
        const rate = {
            'sensor.batt_power': [
                { start: h0, min: -20, max: 2500 },
                { start: h1, min: -2500, max: 20 },
            ],
        };
        const hours = buildBatteryHours(energy, rate, ['sensor.batt_charge'], ['sensor.batt_discharge'], 'sensor.batt_power');
        expect(hours).toEqual([
            { netKwh: 1.7, minW: -20, maxW: 2500 },   //2.0 - 0.3
            { netKwh: -1.4, minW: -2500, maxW: 20 },  //0.1 - 1.5
        ]);
    });
});
