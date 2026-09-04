import { describe, it, expect, vi } from 'vitest';
import {
    evaluateBatteryHours,
    nextBankVerdict,
    buildBatteryHours,
    createBankVerdict,
    createBatteryGuard,
    batteryInvertedRates,
    effectiveInvertedRates,
    guardableBanks,
    refreshBatteryGuard,
    type BatteryHour,
    type BatteryGuardHost,
} from '../src/data/sources/battery-guard';
import { freshEnergyDefaults, type EnergyDefaults } from '../src/data/sources/energy-prefs';
import { sumLiveWatts } from '../src/data/source-fetch';

describe('effectiveInvertedRates + the live sum (the #422 two-battery case)', () =>
{
    //Both sensors on the standard slot (the card flips both). Bank A's sensor is really charge-positive (backwards
    //for that slot), bank B's is discharge-positive as assumed. Both banks charging at 1.5 kW right now.
    const slotInverted = ['sensor.a_power', 'sensor.b_power'];
    const states = {
        'sensor.a_power': { state: '1500',  attributes: { unit_of_measurement: 'W' } },   //charge-positive raw
        'sensor.b_power': { state: '-1500', attributes: { unit_of_measurement: 'W' } },   //discharge-positive raw
    };
    const hass = { states } as any;

    it('with no verdict, the slot flips alone get bank A backwards and the two banks cancel out', () =>
    {
        const { watts } = sumLiveWatts(hass, slotInverted, effectiveInvertedRates(slotInverted, []));
        expect(watts).toBe(0);   //-1500 (A, wrongly flipped) + 1500 (B, correctly flipped)
    });

    it('with bank A proven backwards, only A is un-flipped: the sum reads the true +3 kW of charging', () =>
    {
        const inverted = effectiveInvertedRates(slotInverted, ['sensor.a_power']);
        expect([...inverted].sort()).toEqual(['sensor.b_power']);
        const { watts } = sumLiveWatts(hass, slotInverted, inverted);
        expect(watts).toBe(3000);
    });

    it('the old whole-sum negation would have got it wrong once B also flows (the reason for per-rate flips)', () =>
    {
        //Old behaviour: sum with slot flips, then negate the total because "the" sensor was proven inverted.
        const { watts } = sumLiveWatts(hass, slotInverted, slotInverted);
        expect(Math.abs(-watts)).toBe(0);   //cancels out: the good bank B is turned around with the bad one
    });

    it('a proven-backwards inverted-slot sensor gets flipped (the other direction of the symmetric difference)', () =>
    {
        expect(effectiveInvertedRates([], ['sensor.x'])).toEqual(['sensor.x']);
        expect(effectiveInvertedRates(['sensor.x'], ['sensor.x'])).toEqual([]);
    });
});

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

describe('nextBankVerdict', () =>
{
    it('flags inverted after enough contradicting hours', () =>
    {
        const hours = [charging(2000), charging(2000), charging(2000)];
        expect(nextBankVerdict(createBankVerdict(), hours, STANDARD).status).toBe('inverted');
    });

    it('never flags a correctly-declared inverted-slot sensor', () =>
    {
        //The regression: the same raw readings that contradict on the standard slot AGREE on the inverted slot.
        const hours = [charging(2000), charging(2000), charging(2000), charging(2000), charging(2000)];
        expect(nextBankVerdict(createBankVerdict(), hours, INVERTED).status).toBe('normal');
    });

    it('stays normal below the threshold', () =>
    {
        const hours = [charging(2000), charging(2000)];  //only 2
        expect(nextBankVerdict(createBankVerdict(), hours, STANDARD).status).toBe('normal');
    });

    it('does not flag when agreeing hours outnumber contradictions', () =>
    {
        const hours = [
            charging(2000), charging(2000), charging(2000),
            charging(-2000), charging(-2000), charging(-2000), charging(-2000),
        ];
        expect(nextBankVerdict(createBankVerdict(), hours, STANDARD).status).toBe('normal');
    });

    it('self-clears back to normal after three agreeing evaluations', () =>
    {
        let s = nextBankVerdict(createBankVerdict(), [charging(2000), charging(2000), charging(2000)], STANDARD);
        expect(s.status).toBe('inverted');
        const agreeing = [charging(-2000)];
        s = nextBankVerdict(s, agreeing, STANDARD); expect(s.status).toBe('inverted');
        s = nextBankVerdict(s, agreeing, STANDARD); expect(s.status).toBe('inverted');
        s = nextBankVerdict(s, agreeing, STANDARD); expect(s.status).toBe('normal');
    });

    it('a contradiction resets the self-clear progress', () =>
    {
        let s = nextBankVerdict(createBankVerdict(), [charging(2000), charging(2000), charging(2000)], STANDARD);
        s = nextBankVerdict(s, [charging(-2000)], STANDARD);        //cleanEvals -> 1
        s = nextBankVerdict(s, [charging(2000)], STANDARD);         //contradiction -> reset
        expect(s.status).toBe('inverted');
        expect(s.cleanEvals).toBe(0);
    });

    it('leaves an inverted verdict untouched when a window carries no activity', () =>
    {
        const inverted = nextBankVerdict(createBankVerdict(), [charging(2000), charging(2000), charging(2000)], STANDARD);
        const after = nextBankVerdict(inverted, [], STANDARD);
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

//Two batteries, each with its own net rate on the standard slot (so the card negates both) and its own meters.
function twoBankDefaults(): EnergyDefaults
{
    const d = freshEnergyDefaults();
    d.batteryStatRates       = ['sensor.a_power', 'sensor.b_power'];
    d.invertedRateEntities   = ['sensor.a_power', 'sensor.b_power'];
    d.batteryStatEnergyTos   = ['sensor.a_charge', 'sensor.b_charge'];
    d.batteryStatEnergyFroms = ['sensor.a_discharge', 'sensor.b_discharge'];
    d.batteryBanks = [
        { rates: ['sensor.a_power'], tos: ['sensor.a_charge'], froms: ['sensor.a_discharge'] },
        { rates: ['sensor.b_power'], tos: ['sensor.b_charge'], froms: ['sensor.b_discharge'] },
    ];
    return d;
}

describe('guardableBanks', () =>
{
    it('keeps every bank with one rate and both meters, drops two-sensor and meterless banks', () =>
    {
        const d = twoBankDefaults();
        d.batteryBanks.push({ rates: ['sensor.c_in', 'sensor.c_out'], tos: ['sensor.c_charge'], froms: ['sensor.c_discharge'] });
        d.batteryBanks.push({ rates: ['sensor.d_power'], tos: [], froms: ['sensor.d_discharge'] });
        expect(guardableBanks(d).map((b) => b.rate)).toEqual(['sensor.a_power', 'sensor.b_power']);
    });
});

describe('refreshBatteryGuard (two batteries, #422)', () =>
{
    //Hourly recorder rows: bank A's sensor is charge-positive but sits on the standard slot (backwards for the
    //card), bank B's is discharge-positive as the slot assumes (fine). Three qualifying hours each.
    const h0 = 1_700_000_000_000;
    const energyRes = {
        'sensor.a_charge':    [0, 1, 2].map((i) => ({ start: h0 + i * 3_600_000, change: 1.5 })),
        'sensor.a_discharge': [0, 1, 2].map((i) => ({ start: h0 + i * 3_600_000, change: 0.0 })),
        'sensor.b_charge':    [0, 1, 2].map((i) => ({ start: h0 + i * 3_600_000, change: 1.5 })),
        'sensor.b_discharge': [0, 1, 2].map((i) => ({ start: h0 + i * 3_600_000, change: 0.0 })),
    };
    const rateRes = {
        'sensor.a_power': [0, 1, 2].map((i) => ({ start: h0 + i * 3_600_000, mean: 1500, min: 1000, max: 2000 })),   //positive while charging
        'sensor.b_power': [0, 1, 2].map((i) => ({ start: h0 + i * 3_600_000, mean: -1500, min: -2000, max: -1000 })), //negative while charging
    };

    function host(): BatteryGuardHost & { requestUpdate: ReturnType<typeof vi.fn> }
    {
        const callWS = vi.fn().mockImplementation((msg: { statistic_ids: string[]; types: string[] }) =>
            Promise.resolve(msg.types.includes('change') ? energyRes : rateRes));
        return {
            hass: { callWS, connection: {}, states: {} } as any,
            _energyDefaults: twoBankDefaults(),
            _batteryGuard: createBatteryGuard(),
            requestUpdate: vi.fn(),
        };
    }

    async function settle(): Promise<void>
    {
        for (let i = 0; i < 5; i++)
        {
            await Promise.resolve();
        }
    }

    it('judges each bank against its own meters and flags only the backwards one', async () =>
    {
        const h = host();
        refreshBatteryGuard(h);            //first call: installs the wiring key, no fetch yet
        refreshBatteryGuard(h);            //second call: fetches
        await settle();
        expect(batteryInvertedRates(h._batteryGuard)).toEqual(['sensor.a_power']);
        expect(h._batteryGuard.banks['sensor.b_power'].status).toBe('normal');
        expect(h.requestUpdate).toHaveBeenCalledTimes(1);
        //One batched pair of recorder calls for both banks, not one pair per bank.
        expect((h.hass.callWS as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
        const meterCall = (h.hass.callWS as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0].types.includes('change'))![0];
        expect([...meterCall.statistic_ids].sort()).toEqual(['sensor.a_charge', 'sensor.a_discharge', 'sensor.b_charge', 'sensor.b_discharge']);
    });

    it('a single-battery install behaves exactly as before (one bank, one verdict)', async () =>
    {
        const h = host();
        h._energyDefaults!.batteryBanks = [h._energyDefaults!.batteryBanks[0]];
        refreshBatteryGuard(h);
        refreshBatteryGuard(h);
        await settle();
        expect(batteryInvertedRates(h._batteryGuard)).toEqual(['sensor.a_power']);
        expect(Object.keys(h._batteryGuard.banks)).toEqual(['sensor.a_power']);
    });

    it('resets every verdict when the wiring changes', async () =>
    {
        const h = host();
        refreshBatteryGuard(h);
        refreshBatteryGuard(h);
        await settle();
        expect(batteryInvertedRates(h._batteryGuard)).toEqual(['sensor.a_power']);
        h._energyDefaults!.batteryBanks[0].tos = ['sensor.a_charge_new'];
        refreshBatteryGuard(h);
        expect(batteryInvertedRates(h._batteryGuard)).toEqual([]);
    });
});
