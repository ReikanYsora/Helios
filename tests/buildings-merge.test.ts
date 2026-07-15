//Merging same-height blocks. The real failure this guards: two houses standing shoulder to shoulder each get
//their own wall along the party line, and those two faces are COPLANAR, so they carry the identical depth. The
//painter's sort meets a tie it cannot break, and the internal face surfaces or vanishes with the camera angle. No
//sort key, no paint order and no clipping can settle a tie: merging deletes the face instead of ordering it.
//
//The detail is kept, which is what sank the first attempt: every original outline survives in `detail` and is
//drawn flat on the roof, where nothing can conflict with it.

import { describe, it, expect } from 'vitest';
import { interpretBuildings, type RawBuilding } from '../src/scene/buildings';

function raw(footprint: [number, number][], distanceM: number, heightM: number | null = 5): RawBuilding {
    let cx = 0;
    let cy = 0;
    for (const p of footprint) { cx += p[0]; cy += p[1]; }
    return { footprint, centerX: cx / footprint.length, centerY: cy / footprint.length, distanceM, osmHeightM: heightM };
}

const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] =>
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

//realSize false => every building takes fixedHeightM, so heights are equal unless a test says otherwise.
const opts = { radiusM: 500, count: 100, realSize: false, fixedHeightM: 5, clusterRadiusM: 0 };

//interpretBuildings marks the NEAREST building as the home, and the home merges on its own (it must keep its own
//prism). So every test plants a real home at the origin, leaving the buildings under test as plain neighbours.
const HOME = raw(rect(-3, -3, 3, 3), 0);

describe('same-height block merging', () => {
    it('merges two terraced houses into ONE volume, so the party wall stops existing', () => {
        //Touching along x=32: the exact coplanar tie.
        const out = interpretBuildings([HOME, raw(rect(20, 0, 32, 10), 20), raw(rect(32, 0, 44, 10), 30)], opts);
        const block = out.filter((b) => !b.isHome);
        expect(block.length).toBe(1);
        const xs = block[0].footprint.map((p) => p[0]);
        expect(Math.min(...xs)).toBeCloseTo(20, 6);
        expect(Math.max(...xs)).toBeCloseTo(44, 6);
    });

    it('keeps BOTH original outlines for the roof, so the terrace still reads as two houses', () => {
        const out = interpretBuildings([HOME, raw(rect(20, 0, 32, 10), 20), raw(rect(32, 0, 44, 10), 30)], opts);
        //This is the objection that killed the first attempt: merging must not flatten the roofline.
        expect(out.filter((b) => !b.isHome)[0].detail?.length).toBe(2);
    });

    it('never merges across different heights', () => {
        const out = interpretBuildings(
            [HOME, raw(rect(20, 0, 32, 10), 20, 5), raw(rect(32, 0, 44, 10), 30, 12)],
            { ...opts, realSize: true },
        );
        expect(out.filter((b) => !b.isHome).length).toBe(2);
    });

    it('leaves separate buildings separate', () => {
        const out = interpretBuildings([HOME, raw(rect(20, 0, 30, 10), 20), raw(rect(60, 0, 70, 10), 60)], opts);
        expect(out.filter((b) => !b.isHome).length).toBe(2);
    });

    it('keeps a courtyard as a HOLE instead of filling it in', () => {
        //Four wings around a yard: the union is one ring with a hole, and the yard must survive.
        const out = interpretBuildings([
            HOME,
            raw(rect(20, 0, 50, 6), 20),    //south wing
            raw(rect(20, 24, 50, 30), 25),  //north wing
            raw(rect(20, 6, 26, 24), 21),   //west wing
            raw(rect(44, 6, 50, 24), 24),   //east wing
        ], opts);
        const block = out.filter((b) => !b.isHome);
        expect(block.length).toBe(1);
        expect(block[0].holes?.length).toBe(1);
        //The hole is the yard: x 26..44, y 6..24.
        const hx = block[0].holes![0].map((p) => p[0]);
        expect(Math.min(...hx)).toBeCloseTo(26, 6);
        expect(Math.max(...hx)).toBeCloseTo(44, 6);
    });

    it('merges the home separately, so it never swallows a neighbour', () => {
        //Home at the origin, touching a neighbour of the same height. The home must keep its own prism, or the
        //amber block would spread across the terrace.
        const out = interpretBuildings([raw(rect(-6, -5, 6, 5), 0), raw(rect(6, -5, 18, 5), 8)], opts);
        expect(out.length).toBe(2);
        expect(out.filter((b) => b.isHome).length).toBe(1);
        //The home keeps its own footprint, it did not spread over the neighbour.
        const homeXs = out.find((b) => b.isHome)!.footprint.map((p) => p[0]);
        expect(Math.max(...homeXs)).toBeCloseTo(6, 6);
    });
});
