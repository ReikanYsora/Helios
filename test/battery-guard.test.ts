import { describe, it, expect } from 'vitest';
import {
    evaluateBatteryHours,
    nextBatteryGuardState,
    buildBatteryHours,
    createBatteryGuard,
    batteryLiveInverted,
    type BatteryHour,
} from '../src/data/sources/battery-guard';

//Hours are described by the raw rate sensor's hourly mean (W). `charging` nets positive energy, `discharging`
//negative. The guard judges the EFFECTIVE sign (raw negated when the slot flips it), so the same raw reading means
//opposite things on the standard slot (flipped) vs the inverted slot (not flipped).
const charging    = (meanW: number): BatteryHour => ({ netKwh: 1.2,  meanW, minW: null, maxW: null });
const discharging = (meanW: number): BatteryHour => ({ netKwh: -1.2, meanW, minW: null, maxW: null });

const STANDARD = true;   //standard slot: the card negates the rate
const INVERTED = false;  //inverted slot: the card keeps the rate as-is

describe('evaluateBatteryHours', () =>
{
    it('standard slot: a discharge-positive sensor agrees (charge reads negative)', () =>
    {
        expect(evaluateBatteryHours([charging(-2000), discharging(2000)], STANDARD))
            .toEqual({ invertedHours: 0, okHours: 2 });
    });

    it('standard slot: a charge-positive sensor contradicts', () =>
    {
        expect(evaluateBatteryHours([charging(2000)], STANDARD)).toEqual({ invertedHours: 1, okHours: 0 });
    });

    it('inverted slot: a charge-positive sensor agrees (the FoxP regression case)', () =>
    {
        //Correctly declared inverted (positive = charge): must NOT be read as a contradiction.
        expect(evaluateBatteryHours([charging(2000), discharging(-2000)], INVERTED))
            .toEqual({ invertedHours: 0, okHours: 2 });
    });

    it('inverted slot: a discharge-positive sensor contradicts', () =>
    {
        expect(evaluateBatteryHours([charging(-2000)], INVERTED)).toEqual({ invertedHours: 1, okHours: 0 });
    });

    it('uses the mean, so a brief opposite spike in a mixed hour is not a false positive', () =>
    {
        //Net charge, discharge-positive sensor (standard): the mean is negative (real flow) even though a short
        //discharge spike pushes max positive. Min/max alone would mis-vote; the mean keeps it correct.
        expect(evaluateBatteryHours([{ netKwh: 1.2, meanW: -300, minW: -300, maxW: 2000 }], STANDARD))
            .toEqual({ invertedHours: 0, okHours: 1 });
    });

    it('falls back to the dominant min/max excursion when no mean is recorded', () =>
    {
        //Charge-positive raw on the standard slot, mean absent: the positive excursion dominates -> contradiction.
        expect(evaluateBatteryHours([{ netKwh: 1.2, meanW: null, minW: -30, maxW: 3000 }], STANDARD))
            .toEqual({ invertedHours: 1, okHours: 0 });
    });

    it('skips idle hours (net below the activity floor), null net, and a zero/flat rate', () =>
    {
        const hours: BatteryHour[] = [
            { netKwh: 0.01, meanW: -3000, minW: null, maxW: null },   //below BATTERY_GUARD_MIN_KWH
            { netKwh: null, meanW: -3000, minW: null, maxW: null },    //missing net
            { netKwh: 1.2, meanW: 0, minW: null, maxW: null },         //zero mean
            { netKwh: 1.2, meanW: null, minW: 0, maxW: 0 },            //flat / ambiguous fallback
        ];
        expect(evaluateBatteryHours(hours, STANDARD)).toEqual({ invertedHours: 0, okHours: 0 });
    });
});

describe('nextBatteryGuardState', () =>
{
    it('flags inverted after enough contradicting hours', () =>
    {
        const hours = [charging(2000), charging(2000), charging(2000)];
        const next = nextBatteryGuardState(createBatteryGuard(), hours, STANDARD);
        expect(next.status).toBe('inverted');
        expect(batteryLiveInverted(next)).toBe(true);
    });

    it('never flags a correctly-declared inverted-slot sensor', () =>
    {
        //The regression: the same raw readings that contradict on the standard slot AGREE on the inverted slot.
        const hours = [charging(2000), charging(2000), charging(2000), charging(2000), charging(2000)];
        expect(nextBatteryGuardState(createBatteryGuard(), hours, INVERTED).status).toBe('normal');
    });

    it('stays normal below the threshold', () =>
    {
        const hours = [charging(2000), charging(2000)];  //only 2
        expect(nextBatteryGuardState(createBatteryGuard(), hours, STANDARD).status).toBe('normal');
    });

    it('does not flag when agreeing hours outnumber contradictions', () =>
    {
        const hours = [
            charging(2000), charging(2000), charging(2000),
            charging(-2000), charging(-2000), charging(-2000), charging(-2000),
        ];
        expect(nextBatteryGuardState(createBatteryGuard(), hours, STANDARD).status).toBe('normal');
    });

    it('self-clears back to normal after three agreeing evaluations', () =>
    {
        let s = nextBatteryGuardState(createBatteryGuard(), [charging(2000), charging(2000), charging(2000)], STANDARD);
        expect(s.status).toBe('inverted');
        const agreeing = [charging(-2000)];
        s = nextBatteryGuardState(s, agreeing, STANDARD); expect(s.status).toBe('inverted');
        s = nextBatteryGuardState(s, agreeing, STANDARD); expect(s.status).toBe('inverted');
        s = nextBatteryGuardState(s, agreeing, STANDARD); expect(s.status).toBe('normal');
    });

    it('a contradiction resets the self-clear progress', () =>
    {
        let s = nextBatteryGuardState(createBatteryGuard(), [charging(2000), charging(2000), charging(2000)], STANDARD);
        s = nextBatteryGuardState(s, [charging(-2000)], STANDARD);        //cleanEvals -> 1
        s = nextBatteryGuardState(s, [charging(2000)], STANDARD);         //contradiction -> reset
        expect(s.status).toBe('inverted');
        expect(s.cleanEvals).toBe(0);
    });

    it('leaves an inverted verdict untouched when a window carries no activity', () =>
    {
        const inverted = nextBatteryGuardState(createBatteryGuard(), [charging(2000), charging(2000), charging(2000)], STANDARD);
        const after = nextBatteryGuardState(inverted, [], STANDARD);
        expect(after).toBe(inverted);  //same reference: no transition
    });
});

describe('buildBatteryHours', () =>
{
    it('nets charge minus discharge per hour and carries the raw rate mean + min/max', () =>
    {
        const h0 = 1_700_000_000_000;
        const h1 = h0 + 3_600_000;
        const energy = {
            'sensor.batt_charge':    [{ start: h0, change: 2.0 }, { start: h1, change: 0.1 }],
            'sensor.batt_discharge': [{ start: h0, change: 0.3 }, { start: h1, change: 1.5 }],
        };
        const rate = {
            'sensor.batt_power': [
                { start: h0, mean: 1400, min: -20, max: 2500 },
                { start: h1, mean: -1300, min: -2500, max: 20 },
            ],
        };
        const hours = buildBatteryHours(energy, rate, ['sensor.batt_charge'], ['sensor.batt_discharge'], 'sensor.batt_power');
        expect(hours).toEqual([
            { netKwh: 1.7, meanW: 1400, minW: -20, maxW: 2500 },   //2.0 - 0.3
            { netKwh: -1.4, meanW: -1300, minW: -2500, maxW: 20 },  //0.1 - 1.5
        ]);
    });
});
