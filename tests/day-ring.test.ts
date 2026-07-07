//computeSelfSufficiency: per-hour share of the home load met by local solar, (consumption - gridImport)/consumption
//clamped 0..1. Drives the day ring's gold tint (0 = grid, 1 = sun).

import { describe, it, expect } from 'vitest';
import { computeSelfSufficiency } from '../src/clock/day-ring';
import type { ClockHourly } from '../src/clock/clock-hourly';

function hourly(consumption: number[], gridImport: number[]): ClockHourly
{
    const z = (): number[] => new Array<number>(24).fill(0);
    return { pv: [], gridImport, gridExport: z(), batteryCharge: z(), batteryDischarge: z(), consumption, soc: z(), custom: z() };
}

describe('computeSelfSufficiency', () =>
{
    it('is 0 fully on grid, 1 fully on sun, and the fraction in between', () =>
    {
        const c = new Array<number>(24).fill(0);
        const g = new Array<number>(24).fill(0);
        c[8]  = 2; g[8]  = 2;   //all grid -> 0
        c[13] = 2; g[13] = 0;   //all sun -> 1
        c[10] = 4; g[10] = 1;   //3/4 sun -> 0.75
        const s = computeSelfSufficiency(hourly(c, g));
        expect(s[8]).toBe(0);
        expect(s[13]).toBe(1);
        expect(s[10]).toBeCloseTo(0.75);
    });

    it('clamps to 0..1 and treats no-load / null as 0', () =>
    {
        const c = new Array<number>(24).fill(0);
        const g = new Array<number>(24).fill(0);
        c[9] = 1; g[9] = 5;   //import exceeds load -> clamp to 0
        const s = computeSelfSufficiency(hourly(c, g));
        expect(s[9]).toBe(0);
        expect(s[0]).toBe(0);   //no load
        expect(computeSelfSufficiency(null).every(v => v === 0)).toBe(true);
    });
});
