//Live counter slope: near-real-time watts from cumulative kWh counters, with the safety rules that keep it
//honest (reset restart, unproven cadence, quantisation span, idle-counter zero).

import { describe, it, expect, beforeEach } from 'vitest';
import { sampleCounter, counterSlopeWatts, clearCounterSlopeSamples } from '../src/card/counter-slope';

const T0 = Date.UTC(2026, 6, 3, 12, 0, 0);

function hassWith(entityId: string, kwh: number, changedMs: number, unit = 'kWh'): any
{
    return {
        states: {
            [entityId]: {
                state:        String(kwh),
                last_changed: new Date(changedMs).toISOString(),
                attributes:   { unit_of_measurement: unit },
            },
        },
    };
}

function feed(entityId: string, points: [number, number][], unit = 'kWh'): void
{
    for (const [tMs, kwh] of points)
    {
        sampleCounter(hassWith(entityId, kwh, tMs, unit), entityId);
    }
}

beforeEach(() =>
{
    clearCounterSlopeSamples();
});

describe('counterSlopeWatts', () =>
{
    it('fine counter: steady 1200 W read from the change pair', () =>
    {
        //0.01 kWh every 30 s = 1.2 kW.
        feed('sensor.exp', [[T0, 100.00], [T0 + 30_000, 100.01], [T0 + 60_000, 100.02], [T0 + 90_000, 100.03]]);
        const w = counterSlopeWatts(['sensor.exp'], T0 + 100_000);
        expect(w).not.toBeNull();
        expect(w!).toBeCloseTo(1200, 0);
    });

    it('normalises Wh counters to kWh', () =>
    {
        feed('sensor.exp', [[T0, 100_000], [T0 + 60_000, 100_020]], 'Wh');
        //0.02 kWh over 60 s = 1200 W.
        expect(counterSlopeWatts(['sensor.exp'], T0 + 70_000)).toBeCloseTo(1200, 0);
    });

    it('a pair spanning less than the minimum is rejected (quantisation noise)', () =>
    {
        feed('sensor.exp', [[T0, 100.00], [T0 + 10_000, 100.001]]);
        expect(counterSlopeWatts(['sensor.exp'], T0 + 15_000)).toBeNull();
    });

    it('a single recent change is unproven cadence, not a zero', () =>
    {
        feed('sensor.exp', [[T0, 100.00]]);
        expect(counterSlopeWatts(['sensor.exp'], T0 + 30_000)).toBeNull();
    });

    it('a counter silent for the whole window reads 0 W (idle direction)', () =>
    {
        feed('sensor.exp', [[T0, 100.00], [T0 + 60_000, 100.02]]);
        //10 minutes later, no further change: the direction is idle.
        expect(counterSlopeWatts(['sensor.exp'], T0 + 660_000)).toBe(0);
    });

    it('an idle tariff meter never blocks the active one in a dual-meter direction', () =>
    {
        feed('sensor.tarif_hp', [[T0, 500.00], [T0 + 40_000, 500.01], [T0 + 80_000, 500.02]]);
        feed('sensor.tarif_hc', [[T0 - 3_600_000, 900.00]]);   //last change an hour ago
        const w = counterSlopeWatts(['sensor.tarif_hp', 'sensor.tarif_hc'], T0 + 90_000);
        expect(w).not.toBeNull();
        expect(w!).toBeCloseTo(900, 0);   //0.01 kWh / 40 s
    });

    it('an unknown meter in the set disables the whole direction (never a partial sum)', () =>
    {
        feed('sensor.known', [[T0, 100.00], [T0 + 60_000, 100.02]]);
        expect(counterSlopeWatts(['sensor.known', 'sensor.never_seen'], T0 + 70_000)).toBeNull();
    });

    it('a counter reset restarts the ring instead of producing a negative slope', () =>
    {
        feed('sensor.exp', [[T0, 100.00], [T0 + 30_000, 100.01]]);
        //Daily reset: the counter drops to zero.
        feed('sensor.exp', [[T0 + 60_000, 0.00]]);
        expect(counterSlopeWatts(['sensor.exp'], T0 + 70_000)).toBeNull();
        //Fresh pair after the reset works again.
        feed('sensor.exp', [[T0 + 90_000, 0.01], [T0 + 150_000, 0.03]]);
        const w = counterSlopeWatts(['sensor.exp'], T0 + 160_000);
        expect(w).not.toBeNull();
        expect(w!).toBeGreaterThan(0);
    });

    it('re-sampling the same state is a no-op (dedupe on last_changed)', () =>
    {
        const hass = hassWith('sensor.exp', 100.01, T0 + 30_000);
        sampleCounter(hassWith('sensor.exp', 100.00, T0), 'sensor.exp');
        sampleCounter(hass, 'sensor.exp');
        sampleCounter(hass, 'sensor.exp');
        sampleCounter(hass, 'sensor.exp');
        //Still only one pair spanning 30 s: below the minimum span, so still null.
        expect(counterSlopeWatts(['sensor.exp'], T0 + 40_000)).toBeNull();
    });

    it('empty direction has no slope', () =>
    {
        expect(counterSlopeWatts([], T0)).toBeNull();
    });
});
