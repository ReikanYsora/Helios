import { describe, it, expect } from 'vitest';
import { groundLevelGeometry } from '../src/scene/ground-render';
import { pxPerMetreFor } from '../src/scene/tiles';
import { GROUND_LOD_LEVELS, GROUND_LOD_FLAT, GROUND_REACH_M, MAX_DISPLAY_RADIUS_M } from '../src/core/config/constants';

//The ladder is checked as geometry, without a canvas: what each level allocates, that its pixel grid nests in the
//finest one, and that the far edge is never short of what the card lets a user display.

const bytes = (lat: number): number =>
    GROUND_LOD_LEVELS.reduce((sum, l) => { const g = groundLevelGeometry(lat, l); return sum + g.size * g.size * 4; }, 0);

describe('ground levels of detail', () =>
{
    it('is ordered coarsest first, so the finest canvas lands on top in DOM order', () =>
    {
        const scales = GROUND_LOD_LEVELS.map((l) => l.scale);
        expect(scales).toEqual([...scales].sort((a, b) => b - a));
        expect(GROUND_LOD_LEVELS[GROUND_LOD_LEVELS.length - 1].scale).toBe(1);
        expect(GROUND_LOD_FLAT).toHaveLength(1);
        expect(GROUND_LOD_FLAT[0].scale).toBe(1);
    });

    it('centres the home on a pixel corner of every level, so the grids nest under their scales', () =>
    {
        for (const lat of [0, 44.1, 60, 70])
        {
            for (const level of GROUND_LOD_LEVELS)
            {
                const g = groundLevelGeometry(lat, level);
                expect(g.size % 2).toBe(0);
                expect(g.homeX).toBe(g.size / 2);
                expect(g.homeY).toBe(g.size / 2);
                expect(Number.isInteger(g.homeX)).toBe(true);
                //A canvas px of this level spans `scale` base px starting on a base px boundary.
                expect(g.reachPx).toBe(g.homeX * g.scale);
            }
        }
    });

    it('never falls short of its reach, and dissolves inside it', () =>
    {
        for (const lat of [0, 44.1, 60, 70])
        {
            const ppm = pxPerMetreFor(lat);
            for (const level of GROUND_LOD_LEVELS)
            {
                const g = groundLevelGeometry(lat, level);
                expect(g.reachPx).toBeGreaterThanOrEqual(level.reachM * ppm);
                expect(g.reachPx - level.reachM * ppm).toBeLessThan(level.scale);
                if (level.fadeFromM > 0)
                {
                    expect(g.fadeFromPx).toBeGreaterThan(0);
                    expect(g.fadeFromPx).toBeLessThan(g.reachPx);
                }
            }
        }
    });

    it('reaches past the widest display radius at every latitude, unlike the fixed tile square it replaces', () =>
    {
        expect(GROUND_REACH_M).toBeGreaterThan(MAX_DISPLAY_RADIUS_M);
        for (const lat of [0, 44.1, 60, 70])
        {
            const outer = groundLevelGeometry(lat, GROUND_LOD_LEVELS[0]);
            expect(outer.reachPx / pxPerMetreFor(lat)).toBeGreaterThanOrEqual(GROUND_REACH_M);
        }
    });

    it('allocates about a third of the single 11-tile canvas it replaces', () =>
    {
        const former = 2816 * 2816 * 4;
        //Mid latitude: the ladder comes in well under a third. Oslo: the former square covered only 210 m there,
        //the ladder covers 300 and still spends less.
        expect(bytes(44.1)).toBeLessThan(former / 3);
        expect(bytes(60)).toBeLessThan(former * 0.7);
    });
});
