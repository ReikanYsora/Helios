import { describe, it, expect } from 'vitest';
import { moonCrescentLocalPoints, moonCrescentPath } from '../src/scene/moon-crescent';

//Shoelace-formula polygon area, to check the crescent's visible area without depending on point count/order beyond
//"a simple closed loop", which is what moonCrescentLocalPoints actually produces.
function polygonArea(pts: [number, number][]): number
{
    let a = 0;
    for (let i = 0; i < pts.length; i++)
    {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a) / 2;
}

describe('moonCrescentLocalPoints', () =>
{
    const R = 10;

    it('new moon (f=0): zero-area, no visible crescent', () =>
    {
        expect(polygonArea(moonCrescentLocalPoints(R, 0))).toBeCloseTo(0, 5);
    });

    it('first quarter (f=0.5): exactly a half-disc', () =>
    {
        const area = polygonArea(moonCrescentLocalPoints(R, 0.5, 200));
        expect(area).toBeCloseTo((Math.PI * R * R) / 2, 0);
    });

    it('full moon (f=1): the whole disc', () =>
    {
        const area = polygonArea(moonCrescentLocalPoints(R, 1, 200));
        expect(area).toBeCloseTo(Math.PI * R * R, 0);
    });

    it('area grows monotonically with the illuminated fraction', () =>
    {
        const fractions = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1];
        const areas = fractions.map((f) => polygonArea(moonCrescentLocalPoints(R, f, 100)));
        for (let i = 1; i < areas.length; i++)
        {
            expect(areas[i]).toBeGreaterThan(areas[i - 1] - 1e-6);
        }
    });

    it('every point stays on or inside the disc radius', () =>
    {
        for (const f of [0, 0.2, 0.5, 0.8, 1])
        {
            for (const [x, y] of moonCrescentLocalPoints(R, f, 60))
            {
                expect(Math.hypot(x, y)).toBeLessThanOrEqual(R + 1e-6);
            }
        }
    });

    it('clamps an out-of-range fraction instead of producing a nonsense shape', () =>
    {
        expect(polygonArea(moonCrescentLocalPoints(R, -0.3))).toBeCloseTo(0, 5);
        expect(polygonArea(moonCrescentLocalPoints(R, 1.7, 200))).toBeCloseTo(Math.PI * R * R, 0);
    });
});

describe('moonCrescentPath', () =>
{
    it('starts with M and closes with Z', () =>
    {
        const path = moonCrescentPath(50, 50, 10, 0.5, 1, 0);
        expect(path.startsWith('M ')).toBe(true);
        expect(path.endsWith('Z')).toBe(true);
    });

    it('is centred on (cx, cy) regardless of the lit direction', () =>
    {
        //A full moon is a full circle: every sampled point should sit exactly r away from the given centre,
        //whatever direction the crescent is (nominally) lit toward - the disc itself does not move.
        const cx = 120, cy = 80, r = 15;
        for (const [litDx, litDy] of [[1, 0], [0, 1], [-1, -1], [0.3, -0.9]] as [number, number][])
        {
            const path = moonCrescentPath(cx, cy, r, 1, litDx, litDy, 40);
            const coords = [...path.matchAll(/(-?\d+\.\d+),(-?\d+\.\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
            for (const [x, y] of coords)
            {
                expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(r, 1);
            }
        }
    });

    it('falls back to a stable direction when the lit vector is degenerate', () =>
    {
        expect(() => moonCrescentPath(0, 0, 10, 0.3, 0, 0)).not.toThrow();
    });
});
