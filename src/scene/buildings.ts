//Faux-3D building + shadow painters for the 2.5D scene renderer — replaces MapLibre's fill-extrusion +
//raster shadow layers. Buildings are extruded prisms drawn with a per-face painter's algorithm (depth-
//sorted, screen-space back-face culled); shadows are each footprint's cast envelope flattened by one
//group-opacity. Pure functions over a SceneCamera + local-metric footprints. Ported from the Home
//Assistant frontend Solar scene card.

import { SceneCamera, PERSPECTIVE, NEAR_PLANE } from './projection';
import { type Point, simplifyFootprint, convexHull, pointsAttr } from './geo';
import { mixHex, hexByte, tintedRgba } from './colors';

const DEG = Math.PI / 180;
//Shadows fade in near the horizon (full at SHADOW_FADE_DEG above it) so they don't pop at dawn/dusk.
export const SHADOW_FADE_DEG = 10;
//Cap a cast shadow at 50 m so a low sun doesn't streak a shadow across the whole disc.
const MAX_SHADOW_M = 50;

export interface Building
{
    footprint: Point[]; //metres east/north relative to the home
    height:    number;
    isHome:    boolean;
    centerX:   number;  //centroid east, for the back-to-front draw order + shadow cull
    centerY:   number;  //centroid north
}

export interface ScenePalette
{
    home:     string; //#rrggbb
    neighbor: string; //#rrggbb
    dark:     boolean;
}

//Every footprint casts a shadow; one group-opacity flattens overlaps into a single even shade. `sun` is
//{azimuth (deg from N, CW), altitude (deg)}. shadowColor is a solid colour; shadowOpacity its peak alpha.
export function renderShadows(
    cam:          SceneCamera,
    buildings:    Building[],
    sun:          { azimuth: number; altitude: number },
    shadowColor:  string,
    shadowOpacity: number
): string
{
    const fade = Math.min(1, sun.altitude / SHADOW_FADE_DEG);
    if (fade <= 0)
    {
        return '';
    }
    const away     = (sun.azimuth + 180) * DEG;
    const nearCull = PERSPECTIVE * (1 - NEAR_PLANE);
    let inner = '';
    for (const b of buildings)
    {
        //Skip shadows of buildings at/behind the camera (same near-plane cull as the buildings).
        if (cam.project3(b.centerX, b.centerY, 0).depth >= nearCull)
        {
            continue;
        }
        const length = Math.min(b.height / Math.tan(sun.altitude * DEG), MAX_SHADOW_M);
        const oe = Math.sin(away) * length;
        const on = Math.cos(away) * length;
        const base = b.footprint.map((p) => cam.project(p[0], p[1], 0));
        const cast = b.footprint.map((p) => cam.project(p[0] + oe, p[1] + on, 0));
        inner += `<polygon points="${pointsAttr(convexHull([...base, ...cast]))}" fill="${shadowColor}"/>`;
    }
    return inner
        ? `<g opacity="${(shadowOpacity * fade).toFixed(3)}">${inner}</g>`
        : '';
}

//Extrude + paint the buildings far→near. `altitude` is the sun altitude (deg) for the time-of-day tint;
//`growth` ∈ [0,1] animates the prisms rising on first load. `neighborOpacity` (0..1, from the card's
//building-opacity config) sets how solid the surrounding (non-home) prisms read; the home is always solid.
export function renderBuildings(
    cam:             SceneCamera,
    buildings:       Building[],
    altitude:        number,
    palette:         ScenePalette,
    growth:          number,
    neighborOpacity: number = 0.25
): string
{
    const nearCull = PERSPECTIVE * (1 - NEAR_PLANE);
    const order = buildings
        .map((b, index) =>
        {
            const c = cam.project3(b.centerX, b.centerY, 0);
            return { index, depth: c.y, cameraZ: c.depth };
        })
        //Near-plane cull: skip buildings at/behind the camera, else their walls smear over the card.
        .filter((o) => o.cameraZ < nearCull)
        .sort((a, b) => a.depth - b.depth);

    //Home highlight: brightened edges on the home's own faces make it stand out.
    const eg        = mixHex(palette.home, '#ffffff', 0.5);
    const edgeColor = `rgba(${hexByte(eg, 1)},${hexByte(eg, 3)},${hexByte(eg, 5)},0.1)`;
    //Neighbours use the raw colour (NOT altitude-tinted): the night shading would darken it to near the
    //dark-theme background and make them vanish. Opacity is driven by the card's building-opacity config
    //(neighborOpacity) so the user controls how solid the surrounding context reads.
    const nb     = palette.neighbor;
    const nbRgba = (op: number): string =>
        `rgba(${hexByte(nb, 1)},${hexByte(nb, 3)},${hexByte(nb, 5)},${Math.max(0, Math.min(1, op)).toFixed(3)})`;

    let svg = '';
    for (const { index } of order)
    {
        const b         = buildings[index];
        const homeColor = palette.home;
        const fp        = simplifyFootprint(b.footprint);
        const base      = fp.map((p) => cam.project(p[0], p[1], 0));
        const roof      = fp.map((p) => cam.project(p[0], p[1], b.height * growth));
        const roofFill  = b.isHome
            ? tintedRgba(mixHex(homeColor, '#ffffff', 0.18), altitude, 0.92)
            : nbRgba(neighborOpacity);
        const wallFill  = b.isHome
            ? tintedRgba(mixHex(homeColor, '#000000', 0.22), altitude, 0.9)
            : nbRgba(neighborOpacity * 0.7);
        const stroke    = b.isHome ? edgeColor : nbRgba(Math.min(1, neighborOpacity * 1.1));
        const strokeW   = b.isHome ? 1 : 0.4;

        const h = b.height * growth;
        //All visible faces (walls + roof) painted strictly far→near by their centroid camera depth, so a
        //nearer wing's wall correctly occludes a farther wing's roof (right even for concave footprints).
        const faces: { depth: number; svg: string }[] = [];
        for (let i = 0; i < base.length; i++)
        {
            const next = (i + 1) % base.length;
            const p0 = base[i];
            const p1 = base[next];
            const p2 = roof[next];
            const p3 = roof[i];
            //Screen-space back-face cull: a wall facing the camera winds negative (shoelace) once
            //projected. Using the PROJECTED quad (not a global bearing) stays correct for buildings off
            //to the sides where perspective makes the view angle differ from bearing.
            const facing =
                p0[0] * p1[1] - p1[0] * p0[1] +
                (p1[0] * p2[1] - p2[0] * p1[1]) +
                (p2[0] * p3[1] - p3[0] * p2[1]) +
                (p3[0] * p0[1] - p0[0] * p3[1]);
            if (facing >= 0)
            {
                continue;
            }
            const midE = (fp[i][0] + fp[next][0]) / 2;
            const midN = (fp[i][1] + fp[next][1]) / 2;
            faces.push({
                depth: cam.project3(midE, midN, h / 2).depth,
                svg: `<polygon points="${pointsAttr([p0, p1, p2, p3])}" fill="${wallFill}" stroke="${stroke}" stroke-width="${strokeW}"/>`,
            });
        }
        faces.push({
            depth: cam.project3(b.centerX, b.centerY, h).depth,
            svg: `<polygon points="${pointsAttr(roof)}" fill="${roofFill}" stroke="${stroke}" stroke-width="${b.isHome ? 1 : 0.6}"/>`,
        });
        faces.sort((a, c) => a.depth - c.depth);
        svg += faces.map((f) => f.svg).join('');
    }
    return svg;
}
