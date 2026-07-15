//Ground shadows. Two failures this guards:
//
//  1. The cast envelope was the CONVEX HULL of the outline plus its shadow copy. Close enough while buildings were
//     small and roughly convex; the hull of an L, however, FILLS the notch, so once terraced houses merged into
//     big concave blocks the shade became shapeless blobs spilling over courtyards and neighbours.
//  2. The fade ran from the winning VERTEX of the base to the winning vertex of the cast, so its direction was
//     `end - start` and depended on which corners won. A tenth of a degree of rotation flipped the argmax to a
//     neighbouring corner and the fade swung sideways. The max value is continuous even where the argmax jumps.

import { describe, it, expect } from 'vitest';
import { renderShadows, type ShadowCaster } from '../src/scene/buildings';
import { SceneCamera } from '../src/scene/projection';

function camera(bearing = 0): SceneCamera {
    const cam = new SceneCamera();
    cam.pxPerMetre = 4;
    cam.setPose(bearing, 55);
    cam.setViewport(800, 600);
    return cam;
}

const sun = { azimuth: 180, altitude: 45 };

const box = (x0: number, y0: number, x1: number, y1: number): [number, number][] =>
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

function caster(footprint: [number, number][], holes?: [number, number][][]): ShadowCaster {
    let cx = 0;
    let cy = 0;
    for (const p of footprint) { cx += p[0]; cy += p[1]; }
    return { footprint, height: 6, centerX: cx / footprint.length, centerY: cy / footprint.length, holes };
}

//The sweep path, from INSIDE the group: the clip's own path sits earlier in the defs, so a naive match on the
//first <path> grabs that instead.
function sweepPath(svg: string): string {
    const group = /<g [^>]*clip-path="url\(#hsh-clip\)"[^>]*>(.*?)<\/g>/s.exec(svg)?.[1] ?? '';
    return /<path d="([^"]+)"/.exec(group)?.[1] ?? '';
}

//The gradient's direction, as an angle. This is what used to swing.
function gradientAngle(svg: string): number {
    const g = /<linearGradient[^>]*x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/.exec(svg);
    if (!g) { throw new Error('no gradient'); }
    return Math.atan2(Number(g[4]) - Number(g[2]), Number(g[3]) - Number(g[1]));
}

describe('ground shadows', () => {
    it('sweeps the real envelope rather than a convex hull', () => {
        //An L: a hull swallows its notch. The sweep emits the translated outline plus one quad per edge.
        const l: [number, number][] = [[-10, -10], [10, -10], [10, 0], [0, 0], [0, 10], [-10, 10]];
        const d = sweepPath(renderShadows(camera(), [caster(l)], sun, '#000', 0.4));
        expect((d.match(/M/g) ?? []).length).toBe(1 + l.length);
    });

    it('sweeps courtyard walls too, so a yard catches the shade around it', () => {
        const d = sweepPath(renderShadows(camera(), [caster(box(-10, -10, 10, 10), [box(-3, -3, 3, 3)])], sun, '#000', 0.4));
        //Translated outline + the outer ring's 4 edges + the yard's 4 edges.
        expect((d.match(/M/g) ?? []).length).toBe(1 + 4 + 4);
    });

    it('keeps ONE shape per caster, so a dense scene stays cheap', () => {
        const many = [caster(box(0, 0, 8, 8)), caster(box(20, 0, 28, 8)), caster(box(40, 0, 48, 8))];
        const group = /<g [^>]*clip-path="url\(#hsh-clip\)"[^>]*>(.*?)<\/g>/s.exec(renderShadows(camera(), many, sun, '#000', 0.4))?.[1] ?? '';
        expect((group.match(/<path /g) ?? []).length).toBe(3);
    });

    it('never swings the fade sideways under a small rotation', () => {
        //The reported bug: 0.1 degree flipped it. Walk a full turn in tenths and demand the gradient angle only
        //ever moves by a hair between steps.
        const b = caster(box(-6, -4, 6, 4));
        let prev = gradientAngle(renderShadows(camera(0), [b], sun, '#000', 0.4));
        for (let bearing = 0.1; bearing <= 360; bearing += 0.1) {
            const now = gradientAngle(renderShadows(camera(bearing), [b], sun, '#000', 0.4));
            //Shortest angular step between the two.
            let step = Math.abs(now - prev) % (2 * Math.PI);
            if (step > Math.PI) { step = 2 * Math.PI - step; }
            expect(step).toBeLessThan(0.02);
            prev = now;
        }
    });

    it('runs the fade ALONG the shadow, not across it', () => {
        //Gradient direction must match base-centroid -> cast-centroid, or the shade fades the wrong way.
        const b = caster(box(-6, -4, 6, 4));
        const cam = camera(35);
        const svg = renderShadows(cam, [b], sun, '#000', 0.4);
        const away = (sun.azimuth + 180) * (Math.PI / 180);
        const len = 6 / Math.tan(sun.altitude * (Math.PI / 180));
        const bc = cam.project(b.centerX, b.centerY, 0);
        const cc = cam.project(b.centerX + Math.sin(away) * len, b.centerY + Math.cos(away) * len, 0);
        const want = Math.atan2(cc[1] - bc[1], cc[0] - bc[0]);
        const got = gradientAngle(svg);
        let diff = Math.abs(got - want) % (2 * Math.PI);
        if (diff > Math.PI) { diff = 2 * Math.PI - diff; }
        expect(diff).toBeLessThan(0.05);
    });

    it('winds every sub-path of the sweep the same way, so none cancels another', () => {
        //The bug this pins: non-zero fill ADDS sub-paths wound alike and CANCELS ones wound against each other.
        //Projection flips winding (screen y runs down), so the translated outline came out clockwise while the edge
        //quads were counter-clockwise. They cancelled where they met, which punched the ROOF's shadow straight out
        //of the sweep and left only the scraps overlapping nothing: small stray triangles on the ground.

        const l: [number, number][] = [[-10, -10], [10, -10], [10, 0], [0, 0], [0, 10], [-10, 10]];
        for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
            const d = sweepPath(renderShadows(camera(bearing), [caster(l)], sun, '#000', 0.4));
            const areas = d.split('Z').filter(Boolean).map((sub) => {
                const pts = [...sub.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
                let a = 0;
                for (let i = 0; i < pts.length; i++) {
                    const j = (i + 1) % pts.length;
                    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
                }
                return a;
            });
            //Edges lying along the sun sweep a zero-WIDTH quad: it paints nothing, and its sign is pure rounding
            //noise (coordinates are emitted to 0.1 px, so a long degenerate quad still accumulates a few px2).
            //Every piece that actually covers ground pulls the same way, so the sweep reads as their union.
            const real = areas.filter((a) => Math.abs(a) > 50);
            expect(real.length).toBeGreaterThan(1);
            expect(real.every((a) => a > 0)).toBe(true);
        }
    });

    it('clips every building out of the shade layer, in ONE operation', () => {
        //Subtracting per shape with a reversed ring could not work: non-zero fill counts a WINDING NUMBER, and the
        //sweep's pieces overlap most over the footprint, so the count there is +2 or +3 and a single -1 left it
        //filled. A clip settles the whole layer at once, and is a binary stencil rather than a mask blending alpha.
        const a = caster(box(-6, -4, 6, 4));
        const b = caster(box(-4, 8, 4, 14));
        const svg = renderShadows(camera(0), [a, b], sun, '#000', 0.4);
        expect(svg).toContain('<clipPath id="hsh-clip"');
        expect(svg).toMatch(/<g [^>]*clip-path="url\(#hsh-clip\)"/);
        const clip = /<clipPath[^>]*><path d="([^"]+)"/.exec(svg)?.[1] ?? '';
        //The backdrop, plus BOTH buildings: a shadow must not lie on ground its neighbour stands on either.
        expect((clip.match(/M/g) ?? []).length).toBe(1 + 2);
        expect(svg).toContain('clip-rule="evenodd"');
    });

    it('clips the solid but leaves a courtyard catching the shade', () => {
        //Even-odd does this for free: backdrop 1, outline 2 (even -> cut), yard ring 3 (odd -> kept).
        const svg = renderShadows(camera(0), [caster(box(-10, -10, 10, 10), [box(-3, -3, 3, 3)])], sun, '#000', 0.4);
        const clip = /<clipPath[^>]*><path d="([^"]+)"/.exec(svg)?.[1] ?? '';
        //Backdrop + outline + yard.
        expect((clip.match(/M/g) ?? []).length).toBe(1 + 1 + 1);
    });

    it('draws nothing once the sun is down', () => {
        expect(renderShadows(camera(), [caster(box(-5, -5, 5, 5))], { azimuth: 180, altitude: 0 }, '#000', 0.4)).toBe('');
    });
});
