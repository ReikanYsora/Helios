import { describe, it, expect } from 'vitest';
import { arrayTileCorners, arrayIncidence, arrayStandHeight, parseForecastLayout } from '../src/scene/array-markers';

const close = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

describe('arrayTileCorners', () =>
{
    it('a south-facing tilted tile has its low edge to the south and its high edge north and raised', () =>
    {
        const c = arrayTileCorners(180, 30, 1, 1, false);
        //Bottom corners (first two): south of centre, on the ground; top corners: north, higher.
        expect(c[0][1]).toBeLessThan(0); expect(c[1][1]).toBeLessThan(0);
        expect(c[2][1]).toBeGreaterThan(0); expect(c[3][1]).toBeGreaterThan(0);
        expect(close(c[0][2], -Math.sin(30 * Math.PI / 180))).toBe(true);
        expect(close(c[2][2],  Math.sin(30 * Math.PI / 180))).toBe(true);
        //Across-axis level: the bottom pair shares its height, the top pair too.
        expect(close(c[0][2], c[1][2])).toBe(true);
        expect(close(c[2][2], c[3][2])).toBe(true);
        //Foreshortened along the slope by cos(tilt).
        expect(close(c[2][1] - c[1][1], 2 * Math.cos(30 * Math.PI / 180))).toBe(true);
    });

    it('a flat tile (tilt 0) lies on the ground and a west-facing one runs its across-axis north-south', () =>
    {
        for (const p of arrayTileCorners(200, 0, 1.5, 1, false))
        {
            expect(close(p[2], 0)).toBe(true);
        }
        const w = arrayTileCorners(270, 20, 1, 1, false);
        //Facing west: the bottom edge sits west (east < 0) of the top edge.
        expect(w[0][0]).toBeLessThan(w[3][0]);
        //Across axis is north-south: the two bottom corners differ in north, not in east.
        expect(close(w[0][0], w[1][0])).toBe(true);
        expect(w[0][1]).not.toBe(w[1][1]);
    });

    it('a tracker lies flat whatever tilt the line declares', () =>
    {
        for (const p of arrayTileCorners(180, 45, 1, 1, true))
        {
            expect(close(p[2], 0)).toBe(true);
        }
    });
});

describe('arrayIncidence', () =>
{
    it('is 1 when the sun sits on the panel normal, 0 below the horizon or behind the panel', () =>
    {
        expect(close(arrayIncidence(180, 30, 180, 60, false), 1)).toBe(true);
        expect(arrayIncidence(180, 30, 180, 0, false)).toBe(0);
        expect(arrayIncidence(180, 30, 180, -5, false)).toBe(0);
        //Sun due north, low: behind a steep south-facing panel.
        expect(arrayIncidence(180, 80, 0, 5, false)).toBe(0);
    });

    it('a flat panel reads the sine of the sun altitude', () =>
    {
        expect(close(arrayIncidence(0, 0, 123, 30, false), 0.5)).toBe(true);
        expect(close(arrayIncidence(90, 40, 123, 30, true), 0.5)).toBe(true);
    });
});

describe('parseForecastLayout', () =>
{
    it('keeps well-formed lines, coordinates only in pairs, trackers as strings', () =>
    {
        const lines = parseForecastLayout('e1', { lines: [
            { index: 0, azimuth: 180, tilt: 30, tracker: null, lat: 48.1, lon: 2.2, share: 0.5 },
            { index: 1, azimuth: 90, tilt: 20, tracker: 'horizontal', lat: null, lon: null },
            { index: 2, azimuth: 270, tilt: 25, tracker: '', lat: 48.1, lon: null },
            { index: 3, azimuth: 'x', tilt: 25 },
        ], home: { lat: 48, lon: 2 } });
        expect(lines).toEqual([
            { entryId: 'e1', index: 0, azimuth: 180, tilt: 30, tracker: null, lat: 48.1, lon: 2.2 },
            { entryId: 'e1', index: 1, azimuth: 90,  tilt: 20, tracker: 'horizontal', lat: null, lon: null },
            { entryId: 'e1', index: 2, azimuth: 270, tilt: 25, tracker: null, lat: null, lon: null },
        ]);
    });

    it('returns nothing for a malformed answer', () =>
    {
        expect(parseForecastLayout('e1', null)).toEqual([]);
        expect(parseForecastLayout('e1', {})).toEqual([]);
        expect(parseForecastLayout('e1', { lines: 'no' })).toEqual([]);
    });
});

describe('arrayStandHeight', () =>
{
    const square = (cx: number, cy: number, half: number): [number, number][] =>
        [[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]];
    const home   = { footprint: square(0, 0, 6),  height: 7, isHome: true };
    const garage = { footprint: square(12, 0, 3), height: 3, isHome: false };

    it('a line inside the home footprint stands on the home roof, at the height it is drawn', () =>
    {
        expect(arrayStandHeight(2, -3, [home, garage], 1, 0.4)).toBeCloseTo(7.4);
        //The home rises with its animation; the tile rides it.
        expect(arrayStandHeight(2, -3, [home, garage], 0.5, 0.4)).toBeCloseTo(3.9);
    });

    it('a line on an outbuilding stands on that roof, and one in the open stays on the ground', () =>
    {
        expect(arrayStandHeight(12, 1, [home, garage], 1, 0.4)).toBeCloseTo(3.4);
        expect(arrayStandHeight(40, 40, [home, garage], 1, 0.4)).toBeCloseTo(0.4);
        expect(arrayStandHeight(0, 0, [], 1, 0.4)).toBeCloseTo(0.4);
    });

    it('two overlapping prisms: the taller one wins', () =>
    {
        const annex = { footprint: square(0, 0, 4), height: 10, isHome: false };
        expect(arrayStandHeight(1, 1, [home, annex], 1, 0)).toBeCloseTo(10);
    });
});
