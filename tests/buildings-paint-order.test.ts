//Paint order between prisms. The real failure this guards: two separate blocks, one plainly in front of the other,
//and a face of the FAR one painting over the near one as the camera turned. Ranking each prism on ONE number
//cannot express "in front of that end, behind this one", so a long block pointing at the camera owns a very near
//vertex, scores near AS A WHOLE, and covers a small building standing in front of its far end. Two prisms a
//vertical plane separates can never interleave, so the pairwise test settles it exactly.

import { describe, it, expect } from 'vitest';
import { paintOrder, type Building } from '../src/scene/buildings';
import { SceneCamera } from '../src/scene/projection';

function box(x0: number, y0: number, x1: number, y1: number, height = 6): Building {
    return {
        footprint: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
        height,
        isHome: false,
        centerX: (x0 + x1) / 2,
        centerY: (y0 + y1) / 2,
    };
}

function camera(bearing: number, tilt = 55): SceneCamera {
    const cam = new SceneCamera();
    cam.pxPerMetre = 3;
    cam.setPose(bearing, tilt);
    cam.setViewport(800, 600);
    return cam;
}

//What renderBuildings hands paintOrder: every prism, with its nearest-vertex depth.
function visibleOf(cam: SceneCamera, buildings: Building[]): { index: number; depth: number }[] {
    return buildings.map((b, index) => {
        let near = -Infinity;
        for (const p of b.footprint) {
            const d = cam.project3(p[0], p[1], 0).depth;
            if (d > near) { near = d; }
        }
        return { index, depth: near };
    });
}

describe('paint order', () => {
    //The trap: `long` runs x=-30..6 and reaches toward the camera; `small` sits at x=10..18. A vertical plane at
    //x≈8 separates them, so the answer is not a matter of opinion.
    const long  = box(-30, -2, 6, 2);
    const small = box(10, -2, 18, 2);

    it('paints the prism on the camera side LAST, even when the far one owns a nearer vertex', () => {
        const cam = camera(90);
        expect(paintOrder(cam, [long, small], visibleOf(cam, [long, small])).map((o) => o.index)).toEqual([0, 1]);
    });

    it('flips when the camera goes round to the other side', () => {
        const cam = camera(270);
        expect(paintOrder(cam, [long, small], visibleOf(cam, [long, small])).map((o) => o.index)).toEqual([1, 0]);
    });

    it('agrees with the eye at every bearing', () => {
        for (let bearing = 0; bearing < 360; bearing += 10) {
            const cam = camera(bearing);
            const order = paintOrder(cam, [long, small], visibleOf(cam, [long, small]));
            const t = (cam.tiltDeg * Math.PI) / 180;
            const b = (cam.bearingDeg * Math.PI) / 180;
            //Eye dropped on the ground, from the camera's own basis. Plane x≈8: eye east of it => `small` in front.
            const eyeE = (1200 * Math.sin(t) * Math.sin(b)) / cam.pxPerMetre;
            expect(order[order.length - 1].index).toBe(eyeE > 8 ? 1 : 0);
        }
    });

    it('orders TOUCHING prisms: a shared wall IS the separating plane', () => {
        //Demanding a strict gap rejected every terraced pair, which is the pair that needs an order most.
        const west = box(-10, -5, 0, 5);
        const east = box(0, -5, 10, 5);
        let cam = camera(90);
        expect(paintOrder(cam, [west, east], visibleOf(cam, [west, east])).at(-1)?.index).toBe(1);
        cam = camera(270);
        expect(paintOrder(cam, [west, east], visibleOf(cam, [west, east])).at(-1)?.index).toBe(0);
    });

    it('orders a terraced row correctly from both sides', () => {
        const a = box(-15, -5, -5, 5);
        const b = box(-5, -5, 5, 5);
        const c = box(5, -5, 15, 5);
        let cam = camera(90);
        expect(paintOrder(cam, [a, b, c], visibleOf(cam, [a, b, c])).map((o) => o.index)).toEqual([0, 1, 2]);
        cam = camera(270);
        expect(paintOrder(cam, [a, b, c], visibleOf(cam, [a, b, c])).map((o) => o.index)).toEqual([2, 1, 0]);
    });

    it('emits every prism exactly once, whatever the bearing', () => {
        //A prism dropped or doubled would be far worse than a mis-ordered one, and a cycle must never break this.
        const many = [box(-20, -20, -10, -10), box(10, 10, 20, 20), box(-5, 30, 5, 40), box(0, -30, 12, -18)];
        for (let bearing = 0; bearing < 360; bearing += 15) {
            const cam = camera(bearing);
            const order = paintOrder(cam, many, visibleOf(cam, many));
            expect(order.length).toBe(many.length);
            expect(new Set(order.map((o) => o.index)).size).toBe(many.length);
        }
    });
});
