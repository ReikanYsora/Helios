//Faux-3D building + shadow painters for the 2.5D scene renderer — replaces MapLibre's fill-extrusion +
//raster shadow layers. Buildings are extruded prisms drawn with a per-face painter's algorithm (depth-
//sorted, screen-space back-face culled); shadows are each footprint's cast envelope flattened by one
//group-opacity. Pure functions over a SceneCamera + local-metric footprints. Ported from the Home
//Assistant frontend Solar scene card.

import { SceneCamera, PERSPECTIVE, NEAR_PLANE } from './projection';
import { mixHex, hexByte, tintedRgba, pointsAttr, type Point } from './colors';
import { DEG, SHADOW_FADE_DEG, MAX_SHADOW_M } from './constants';
//Re-exported so existing importers of SHADOW_FADE_DEG from './buildings' keep resolving.
export { SHADOW_FADE_DEG } from './constants';

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

//Per-frame appearance of the HOME prism only (neighbours are unaffected). All optional: an empty object
//renders the home as a solid `palette.home` block at full `growth`, i.e. the default behaviour.
export interface HomeAppearance
{
    //Solid fill colour for the home prism — the active chip's colour. Defaults to palette.home.
    color?:  string;
    //Stacked histogram: one band per producing PV string, `frac` summing to ~1, ordered bottom→top. With
    //2+ bands the home paints as a vertical stack instead of a solid block (tallest band = top producer).
    bands?:  { frac: number; color: string }[];
    //Extra height multiplier (0..1) for the squash/grow-on-retarget animation; multiplies `growth`.
    growth?: number;
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
//building-opacity config) sets how solid the surrounding (non-home) prisms read. `home` customises the
//home prism only: its solid colour follows the active chip, an extra growth multiplier drives the
//squash/grow on retarget, and 2+ bands turn it into a vertical stacked histogram (one per PV string).
export function renderBuildings(
    cam:             SceneCamera,
    buildings:       Building[],
    altitude:        number,
    palette:         ScenePalette,
    growth:          number,
    neighborOpacity: number = 0.25,
    home:            HomeAppearance = {}
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

    //Neighbours use the raw colour (NOT altitude-tinted): the night shading would darken it to near the
    //dark-theme background and make them vanish. Opacity is driven by the card's building-opacity config
    //(neighborOpacity) so the user controls how solid the surrounding context reads.
    const nb     = palette.neighbor;
    const nbRgba = (op: number): string =>
        `rgba(${hexByte(nb, 1)},${hexByte(nb, 3)},${hexByte(nb, 5)},${Math.max(0, Math.min(1, op)).toFixed(3)})`;
    const homeBands = home.bands && home.bands.length >= 2 ? home.bands : null;

    let svg = '';
    for (const { index } of order)
    {
        const b  = buildings[index];
        const fp = simplifyFootprint(b.footprint);
        //Home prism height carries the extra squash/grow multiplier; the home colour follows the chip.
        const h  = b.height * growth * (b.isHome ? (home.growth ?? 1) : 1);

        //Vertical bands as cumulative height fractions [0 .. 1] with a fill per band. A solid prism is just
        //one band spanning the full height; the home histogram is one band per producing PV string.
        const cum:  number[] = [0];
        const fill: string[] = [];
        if (b.isHome && homeBands)
        {
            for (const band of homeBands)
            {
                cum.push(Math.min(1, cum[cum.length - 1] + band.frac));
                fill.push(tintedRgba(mixHex(band.color, '#000000', 0.22), altitude, 0.9));
            }
            cum[cum.length - 1] = 1; //pin against rounding drift
        }
        else
        {
            cum.push(1);
            fill.push(b.isHome
                ? tintedRgba(mixHex(home.color ?? palette.home, '#000000', 0.22), altitude, 0.9)
                : nbRgba(neighborOpacity * 0.7));
        }
        const rings    = cum.map((c) => fp.map((p) => cam.project(p[0], p[1], h * c)));
        const base     = rings[0];
        const roof     = rings[rings.length - 1];
        //Roof + edge stroke follow the top band (histogram) or the solid colour; the home keeps a brightened
        //edge so it reads as the focal building.
        const topColor = homeBands ? homeBands[homeBands.length - 1].color : (home.color ?? palette.home);
        const roofFill = b.isHome
            ? tintedRgba(mixHex(topColor, '#ffffff', 0.18), altitude, 0.92)
            : nbRgba(neighborOpacity);
        let stroke = nbRgba(Math.min(1, neighborOpacity * 1.1));
        if (b.isHome)
        {
            const eg = mixHex(home.color ?? palette.home, '#ffffff', 0.5);
            stroke   = `rgba(${hexByte(eg, 1)},${hexByte(eg, 3)},${hexByte(eg, 5)},0.1)`;
        }
        const strokeW = b.isHome ? 1 : 0.4;

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
            //One quad per band, stacked up the wall; a solid prism is the single full-height band.
            let wall = '';
            for (let k = 0; k < fill.length; k++)
            {
                const lo = rings[k];
                const hi = rings[k + 1];
                wall += `<polygon points="${pointsAttr([lo[i], lo[next], hi[next], hi[i]])}" fill="${fill[k]}" stroke="${stroke}" stroke-width="${strokeW}"/>`;
            }
            const midE = (fp[i][0] + fp[next][0]) / 2;
            const midN = (fp[i][1] + fp[next][1]) / 2;
            faces.push({ depth: cam.project3(midE, midN, h / 2).depth, svg: wall });
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

//---------------------------------------------------------------------------------------------------------
//Footprint geometry helpers. Kept local to the building painters: they are the only consumers of these
//footprint utilities. Ported from the Home Assistant frontend Solar scene card.
//---------------------------------------------------------------------------------------------------------

//Drop only TRULY collinear (redundant) vertices — common in OSM footprints where a straight wall is
//split by extra points — so a wall stays ONE quad with no false vertical edge bisecting it. The 0.05 m
//threshold (perpendicular distance off the line through the neighbours) keeps every real corner.
function simplifyFootprint(points: Point[]): Point[]
{
    const n = points.length;
    if (n < 4)
    {
        return points;
    }
    const out: Point[] = [];
    for (let i = 0; i < n; i++)
    {
        const prev  = points[(i + n - 1) % n];
        const cur   = points[i];
        const next  = points[(i + 1) % n];
        const bx    = next[0] - prev[0];
        const by    = next[1] - prev[1];
        const cross = (cur[0] - prev[0]) * by - (cur[1] - prev[1]) * bx;
        if (Math.abs(cross) / (Math.hypot(bx, by) || 1) > 0.05)
        {
            out.push(cur);
        }
    }
    return out.length >= 3 ? out : points;
}

//Andrew's monotone-chain convex hull. Returns vertices counter-clockwise, NOT closed. Used to wrap a
//building's base + cast-shadow points into one shadow envelope.
function convexHull(pts: Point[]): Point[]
{
    if (pts.length < 3)
    {
        return pts.slice();
    }
    const sorted = pts.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    const cross = (o: Point, a: Point, b: Point): number =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: Point[] = [];
    for (const p of sorted)
    {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
        {
            lower.pop();
        }
        lower.push(p);
    }
    const upper: Point[] = [];
    for (let i = sorted.length - 1; i >= 0; i--)
    {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
        {
            upper.pop();
        }
        upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
}
