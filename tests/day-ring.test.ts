//ringShares: per-slot solar + grid-import shares of each ring cell, from the slot's energy sums. solar =
//self-consumed solar / load, grid = grid import / load (summing to ~1 under load), both 0 for an empty slot.
//Load follows the consumption identity (production + import - export - net battery), so battery charging counts.

import { describe, it, expect } from 'vitest';
import { ringShares } from '../src/clock/day-ring';

describe('ringShares', () =>
{
    it('splits each slot into solar + grid shares summing to 1 under load', () =>
    {
        const r = ringShares(
            [0, 2, 4, 0],   //pv
            [2, 0, 1, 0],   //grid import
            [0, 0, 1, 0],   //grid export
            [0, 0, 0, 0],   //net battery
        );
        expect(r.grid[0]).toBe(1);            expect(r.solar[0]).toBe(0);            //load 2, all grid
        expect(r.solar[1]).toBe(1);           expect(r.grid[1]).toBe(0);            //load 2, all sun
        expect(r.solar[2]).toBeCloseTo(0.75); expect(r.grid[2]).toBeCloseTo(0.25);  //load 4, 1 from grid
        expect(r.solar[3]).toBe(0);           expect(r.grid[3]).toBe(0);            //no load -> empty
    });

    it('folds battery charge into the load', () =>
    {
        //pv 3, no grid, charging 2 -> load = 3 - 2 = 1, fully solar-covered.
        const r = ringShares([3], [0], [0], [2]);
        expect(r.solar[0]).toBe(1);
        expect(r.grid[0]).toBe(0);
    });
});
