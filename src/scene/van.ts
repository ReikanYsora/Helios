//Vehicle-mode van painter: a self-contained silhouette (a taller rear/living box + a lower front cab box,
//with a darker wheel-well band along the base of each side wall), reusing the same per-face Lambert shading,
//screen-space back-face culling and camera projection buildings.ts uses -- but its own painter over its own
//VanPose, not a Building. Deliberately does not import from or touch buildings.ts: vehicle mode's visuals
//live entirely in this file so a house-side change there can never conflict with a van-side change here.
//
//Pure function of a SceneCamera + pose; no DOM, no state.

import type { SceneCamera } from './projection';
import { PERSPECTIVE, NEAR_PLANE } from './projection';
import { tintedRgba } from '../core/render-kit/colors';
import { mixHex, hexByte } from '../core/render-kit/hex';
import { pointsAttr, clipPolygon, cardClipRect, type Point, type ClipRect } from '../core/render-kit/geometry';
import { DEG, SHADOW_FADE_DEG } from '../core/config/constants';

export interface VanPose
{
    e:          number; //centre, local metres east
    n:          number; //centre, local metres north
    headingDeg: number; //degrees from north, clockwise (direction of travel)
    lengthM:    number;
    widthM:     number;
    heightM:    number;
}

//Fraction of the overall length given to the (lower) front cab box; the rest is the (taller) rear/living box
//-- the classic camper-van silhouette (a stock cab up front, a raised roof over the living space behind it).
const CAB_LENGTH_FRAC  = 0.3;
const CAB_HEIGHT_FRAC  = 0.62;
const BODY_HEIGHT_FRAC = 0.92; //leaves a slight roof lip below the nominal heightM
//Wheel-well band height, as a fraction of its box's own height: a darker strip along the base of every side
//wall, standing in for wheel arches with no curves, matching the flat-facet style buildings.ts uses.
const WHEEL_BAND_FRAC = 0.22;

interface Face { depth: number; svg: string; }

//One box's footprint in the van's own (forward, right) local axes, as a CCW ring (rear-left, front-left,
//front-right, rear-right) -- CCW so the shared back-face cull below (copied from buildings.ts, which forces
//the same winding on every footprint it draws) reads it the same way.
function boxFootprintUV(uFrom: number, uTo: number, halfW: number): [number, number][]
{
    return [
        [uFrom, -halfW],
        [uTo,   -halfW],
        [uTo,    halfW],
        [uFrom,  halfW],
    ];
}

//A (forward, right) local offset to world local metres (east, north), given the van's centre + heading.
function toWorld(pose: VanPose, u: number, v: number): Point
{
    const h  = pose.headingDeg * DEG;
    const fe = Math.sin(h); const fn = Math.cos(h);  //forward unit vector
    const re = Math.cos(h); const rn = -Math.sin(h); //right unit vector
    return [pose.e + u * fe + v * re, pose.n + u * fn + v * rn];
}

//Paint one flat-roofed box (rectangular prism) into `faces`: wall quads (Lambert-shaded, with a darker
//wheel-well band along the base) + a flat roof. A rigid one/two-box body never needs buildings.ts's
//multi-prism separating-plane solver -- per-face nearest-corner depth alone sorts it correctly.
function paintBox(
    faces:       Face[],
    cam:         SceneCamera,
    pose:        VanPose,
    footprintUV: [number, number][],
    heightM:     number,
    color:       string,
    altitude:    number,
    sunE:        number,
    sunN:        number,
    sunFade:     number,
    rect:        ClipRect,
): void
{
    const ring: Point[] = footprintUV.map(([u, v]) => toWorld(pose, u, v));
    const wheelBandM = heightM * WHEEL_BAND_FRAC;
    const ambient    = mixHex(color, '#000000', 0.38);
    const lit        = mixHex(color, '#000000', 0.06);
    const wheelWell  = mixHex(color, '#000000', 0.72);
    const roofFill   = tintedRgba(mixHex(color, '#ffffff', 0.18), altitude, 0.94);
    const edge       = mixHex(color, '#ffffff', 0.5);
    const stroke     = `rgba(${hexByte(edge, 1)},${hexByte(edge, 3)},${hexByte(edge, 5)},0.15)`;

    const rBase = ring.map((p) => cam.project(p[0], p[1], 0));
    const rBand = ring.map((p) => cam.project(p[0], p[1], wheelBandM));
    const rRoof = ring.map((p) => cam.project(p[0], p[1], heightM));

    for (let i = 0; i < ring.length; i++)
    {
        const next = (i + 1) % ring.length;
        const p0 = rBase[i]; const p1 = rBase[next]; const p2 = rRoof[next]; const p3 = rRoof[i];
        //Screen-space back-face cull, exactly buildings.ts's formula: a wall facing the camera winds
        //negative (shoelace) once projected.
        const facing =
            p0[0] * p1[1] - p1[0] * p0[1] +
            (p1[0] * p2[1] - p2[0] * p1[1]) +
            (p2[0] * p3[1] - p3[0] * p2[1]) +
            (p3[0] * p0[1] - p0[0] * p3[1]);
        if (facing >= 0) { continue; }

        const ex = ring[next][0] - ring[i][0];
        const ey = ring[next][1] - ring[i][1];
        const el = Math.hypot(ex, ey) || 1;
        const litAmt    = Math.max(0, (ey / el) * sunE + (-ex / el) * sunN) * sunFade;
        const wallShade = tintedRgba(mixHex(ambient, lit, litAmt), altitude, 0.95);

        const wallDepth = Math.max(
            cam.project3(ring[i][0], ring[i][1], 0).depth,
            cam.project3(ring[next][0], ring[next][1], 0).depth,
            cam.project3(ring[i][0], ring[i][1], heightM).depth,
            cam.project3(ring[next][0], ring[next][1], heightM).depth,
        );

        if (wheelBandM > 0 && wheelBandM < heightM)
        {
            const bandQ = clipPolygon([rBase[i], rBase[next], rBand[next], rBand[i]], rect);
            if (bandQ.length >= 3)
            {
                faces.push({ depth: wallDepth, svg: `<polygon points="${pointsAttr(bandQ)}" fill="${wheelWell}" stroke="${stroke}" stroke-width="0.6"/>` });
            }
            const upperQ = clipPolygon([rBand[i], rBand[next], rRoof[next], rRoof[i]], rect);
            if (upperQ.length >= 3)
            {
                faces.push({ depth: wallDepth, svg: `<polygon points="${pointsAttr(upperQ)}" fill="${wallShade}" stroke="${stroke}" stroke-width="0.6"/>` });
            }
        }
        else
        {
            const wq = clipPolygon([p0, p1, p2, p3], rect);
            if (wq.length >= 3)
            {
                faces.push({ depth: wallDepth, svg: `<polygon points="${pointsAttr(wq)}" fill="${wallShade}" stroke="${stroke}" stroke-width="0.6"/>` });
            }
        }
    }

    let roofDepth = -Infinity;
    for (const p of ring) { const d = cam.project3(p[0], p[1], heightM).depth; if (d > roofDepth) { roofDepth = d; } }
    const roofQ = clipPolygon(rRoof, rect);
    if (roofQ.length >= 3)
    {
        faces.push({ depth: roofDepth, svg: `<polygon points="${pointsAttr(roofQ)}" fill="${roofFill}" stroke="${stroke}" stroke-width="0.8"/>` });
    }
}

//Paint the van: a taller rear/living box + a lower front cab box, sorted far-to-near by per-face depth.
export function renderVan(
    cam:        SceneCamera,
    pose:       VanPose,
    altitude:   number,
    color:      string,
    sunAzimuth = 180,
): string
{
    const nearCull = PERSPECTIVE * (1 - NEAR_PLANE);
    if (cam.project3(pose.e, pose.n, 0).depth >= nearCull) { return ''; } //behind/at the camera

    const sunE    = Math.sin(sunAzimuth * DEG);
    const sunN    = Math.cos(sunAzimuth * DEG);
    const sunFade = Math.max(0, Math.min(1, altitude / SHADOW_FADE_DEG));
    const rect    = cardClipRect(cam.width, cam.height);

    const halfLen = pose.lengthM / 2;
    const halfWid = pose.widthM  / 2;
    const cabLen  = pose.lengthM * CAB_LENGTH_FRAC;

    const faces: Face[] = [];

    //Rear/living box: from the rear to the front of the cab section, at the taller height.
    paintBox(
        faces, cam, pose,
        boxFootprintUV(-halfLen, halfLen - cabLen, halfWid),
        pose.heightM * BODY_HEIGHT_FRAC,
        color, altitude, sunE, sunN, sunFade, rect,
    );
    //Front cab box: the front section, lower -- a touch lighter so the two boxes read as distinct.
    paintBox(
        faces, cam, pose,
        boxFootprintUV(halfLen - cabLen, halfLen, halfWid),
        pose.heightM * CAB_HEIGHT_FRAC,
        mixHex(color, '#ffffff', 0.08), altitude, sunE, sunN, sunFade, rect,
    );

    faces.sort((a, b) => a.depth - b.depth);
    return faces.map((f) => f.svg).join('');
}
