//ringShares: per-slot solar + grid-import shares of each ring cell, from the slot's energy sums. solar =
//self-consumed solar / load, grid = grid import / load (summing to ~1 under load), both 0 for an empty slot.
//Load follows the consumption identity (production + import - export - net battery), so battery charging counts.

import { describe, it, expect } from 'vitest';
import { ringShares, detectDeviceRuns, optimizeDevices, type DeviceRun } from '../src/clock/day-ring';

describe('ringShares', () =>
{
    it('splits each slot into solar + battery + grid shares under load', () =>
    {
        const r = ringShares(
            [0, 2, 4, 0, 2],   //pv
            [2, 0, 1, 0, 0],   //grid import
            [0, 0, 1, 0, 0],   //grid export
            [0, 0, 0, 0, 0],   //battery charge
            [0, 0, 0, 0, 1],   //battery discharge
        );
        expect(r.grid[0]).toBe(1);            expect(r.solar[0]).toBe(0);   expect(r.battery[0]).toBe(0);   //all grid
        expect(r.solar[1]).toBe(1);           expect(r.grid[1]).toBe(0);                                    //all sun
        expect(r.solar[2]).toBeCloseTo(0.75); expect(r.grid[2]).toBeCloseTo(0.25);                          //load 4, 1 grid
        expect(r.solar[3]).toBe(0);           expect(r.grid[3]).toBe(0);                                    //no load
        //pv 2 + discharge 1 -> load 3: 1/3 battery, 2/3 solar, 0 grid.
        expect(r.battery[4]).toBeCloseTo(1 / 3); expect(r.solar[4]).toBeCloseTo(2 / 3); expect(r.grid[4]).toBe(0);
    });

    it('folds battery charge into the load', () =>
    {
        //pv 3, no grid, charging 2, no discharge -> load = 3 - 2 = 1, fully solar-covered.
        const r = ringShares([3], [0], [0], [2], [0]);
        expect(r.solar[0]).toBe(1);
        expect(r.grid[0]).toBe(0);
        expect(r.battery[0]).toBe(0);
    });
});

describe('detectDeviceRuns', () =>
{
    it('returns null below the configured daily kWh threshold', () =>
    {
        expect(detectDeviceRuns([0.01, 0.02, 0, 0], 0, 'sensor.tiny', 'tiny', 0.1, false)).toBeNull();
    });

    it('threshold 0 keeps a device with any real energy', () =>
    {
        const r = detectDeviceRuns([0.01, 0.02, 0, 0], 0, 'sensor.tiny', 'tiny', 0, false);
        expect(r?.dailyKwh).toBeCloseTo(0.03, 5);
    });

    it('summarises a qualifying device with its day total and carries the fixed flag', () =>
    {
        const kwh = new Array<number>(24).fill(0);
        kwh[8] = 2; kwh[9] = 2; kwh[11] = 2;
        const r = detectDeviceRuns(kwh, 5, 'sensor.washer', 'washer', 0.1, true);
        expect(r?.statId).toBe('washer');
        expect(r?.fixed).toBe(true);
        expect(r?.dailyKwh).toBeCloseTo(6, 5);
    });
});

describe('optimizeDevices', () =>
{
    const mk = (values: number[], fixed: boolean): DeviceRun =>
        ({ index: 0, name: 'd', statId: 'd', values, fixed, dailyKwh: values.reduce((t, v) => t + v, 0), solarPct: 0, gridPct: 0 });

    it('shifts a shiftable device onto the sunniest window', () =>
    {
        //Ran at slot 0 (no sun); sun peaks at slot 3. The 1-slot run should move onto slot 3.
        const pv     = [0, 0, 0, 5];
        const charge = [0, 0, 0, 0];
        const out    = optimizeDevices(pv, charge, [mk([2, 0, 0, 0], false)]);
        expect(out[0]).toEqual([0, 0, 0, 2]);
    });

    it('leaves a user-fixed device exactly where it ran', () =>
    {
        const pv     = [0, 0, 0, 5];
        const charge = [0, 0, 0, 0];
        const out    = optimizeDevices(pv, charge, [mk([2, 0, 0, 0], true)]);
        expect(out[0]).toEqual([2, 0, 0, 0]);
    });
});
