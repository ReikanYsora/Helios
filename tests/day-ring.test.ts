//computeRingShares: per-hour solar + grid-import shares of each ring cell. solar = self-consumed solar / load,
//grid = grid import / load, summing to ~1 under load and both 0 for an empty hour. Drives the day ring's two-tone
//fill (gold solar inner, import colour outer).

import { describe, it, expect } from 'vitest';
import { computeRingShares } from '../src/clock/day-ring';
import type { ClockHourly } from '../src/clock/clock-hourly';

function hourly(consumption: number[], gridImport: number[]): ClockHourly
{
    const z = (): number[] => new Array<number>(24).fill(0);
    return { pv: [], gridImport, gridExport: z(), batteryCharge: z(), batteryDischarge: z(), consumption, soc: z(), custom: z() };
}

describe('computeRingShares', () =>
{
    it('splits each hour into solar + grid shares that sum to 1 under load', () =>
    {
        const c = new Array<number>(24).fill(0);
        const g = new Array<number>(24).fill(0);
        c[8]  = 2; g[8]  = 2;   //all grid -> solar 0, grid 1
        c[13] = 2; g[13] = 0;   //all sun  -> solar 1, grid 0
        c[10] = 4; g[10] = 1;   //3/4 sun  -> solar 0.75, grid 0.25
        const { solar, grid } = computeRingShares(hourly(c, g));
        expect(solar[8]).toBe(0);    expect(grid[8]).toBe(1);
        expect(solar[13]).toBe(1);   expect(grid[13]).toBe(0);
        expect(solar[10]).toBeCloseTo(0.75); expect(grid[10]).toBeCloseTo(0.25);
    });

    it('leaves empty (no-load / null) hours at 0 for both shares', () =>
    {
        const c = new Array<number>(24).fill(0);
        const g = new Array<number>(24).fill(0);
        c[9] = 1; g[9] = 5;   //import over-reported -> grid clamps to 1, solar 0
        const r = computeRingShares(hourly(c, g));
        expect(r.solar[9]).toBe(0);  expect(r.grid[9]).toBe(1);
        expect(r.solar[0]).toBe(0);  expect(r.grid[0]).toBe(0);   //no load -> empty cell
        const nul = computeRingShares(null);
        expect(nul.solar.every(v => v === 0)).toBe(true);
        expect(nul.grid.every(v => v === 0)).toBe(true);
    });
});
