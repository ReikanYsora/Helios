//Faux-3D building + shadow painters for the 2.5D scene renderer — replaces MapLibre's fill-extrusion +
//raster shadow layers. Buildings are extruded prisms drawn with a per-face painter's algorithm (depth-
//sorted, screen-space back-face culled); shadows are each footprint's cast envelope flattened by one
//group-opacity. Pure functions over a SceneCamera + local-metric footprints. Ported from the Home
//Assistant frontend Solar scene card.

import { SceneCamera, PERSPECTIVE, NEAR_PLANE } from './projection';
import { metresPerDegree } from './tiles';
import { mixHex, hexByte, tintedRgba, pointsAttr, type Point } from './colors';

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

//---------------------------------------------------------------------------------------------------------
//Footprint geometry helpers + the GeoJSON→Building adapter. Kept local to the building painters: they are
//the only consumers of these footprint utilities. Ported from the Home Assistant frontend Solar scene card.
//---------------------------------------------------------------------------------------------------------

//Convert a lat/lng ring to local metres (east, north) relative to the home origin.
function ringToLocalMetres(
    ring:    Array<[number, number]>, //[lng, lat] pairs (GeoJSON order)
    homeLat: number,
    homeLng: number
): Point[]
{
    const { perLon, perLat } = metresPerDegree(homeLat);
    return ring.map(([lng, lat]) => [(lng - homeLng) * perLon, (lat - homeLat) * perLat] as Point);
}

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

//Minimal structural view of the GeoJSON we consume — avoids depending on @types/geojson here.
interface Ring extends Array<[number, number]> {}
//`coordinates` is optional so @types/geojson's Geometry union (which includes GeometryCollection, with no
//coordinates) is structurally assignable; outerRing() narrows on `type` before reading it.
interface Geom { type: string; coordinates?: unknown }
interface Feat { geometry?: Geom | null; properties?: Record<string, unknown> | null }
interface FeatureCollectionLike { features?: Feat[] }

export interface FromGeoJsonOptions
{
    //Fixed prism height in metres. When set, every building is drawn at this height (the source card's
    //approach — tall OSM buildings break the faux-3D framing). When undefined, the per-feature
    //render_height − render_min_height is used (clamped to [minHeightM, maxHeightM]).
    fixedHeightM?: number;
    minHeightM?:   number;
    maxHeightM?:   number;
}

//Extract a feature's outer ring as [lng, lat] pairs. Handles Polygon + MultiPolygon (first polygon).
function outerRing(geom: Geom | null | undefined): Ring | null
{
    if (!geom) { return null; }
    if (geom.type === 'Polygon')
    {
        const rings = geom.coordinates as Ring[];
        return rings?.[0] ?? null;
    }
    if (geom.type === 'MultiPolygon')
    {
        const polys = geom.coordinates as Ring[][];
        return polys?.[0]?.[0] ?? null;
    }
    return null;
}

function centroid(footprint: Point[]): { x: number; y: number }
{
    let x = 0;
    let y = 0;
    for (const [px, py] of footprint) { x += px; y += py; }
    const n = footprint.length || 1;
    return { x: x / n, y: y / n };
}

function featureToBuilding(
    feat:    Feat,
    homeLat: number,
    homeLng: number,
    isHome:  boolean,
    opts:    FromGeoJsonOptions
): Building | null
{
    const ring = outerRing(feat.geometry);
    if (!ring || ring.length < 3) { return null; }
    const footprint = ringToLocalMetres(ring, homeLat, homeLng);

    //GeoJSON rings are CLOSED (last vertex repeats the first); drop it so the painter doesn't draw a
    //degenerate wall looping back on itself.
    if (footprint.length > 1
        && footprint[0][0] === footprint[footprint.length - 1][0]
        && footprint[0][1] === footprint[footprint.length - 1][1])
    {
        footprint.pop();
    }
    if (footprint.length < 3) { return null; }

    //Enforce counter-clockwise winding so the painter's screen-space back-face cull has a consistent
    //sign (OSM mixes CW + CCW footprints, which would otherwise flip walls inside-out).
    let area2 = 0;
    for (let i = 0; i < footprint.length; i++)
    {
        const n = (i + 1) % footprint.length;
        area2 += footprint[i][0] * footprint[n][1] - footprint[n][0] * footprint[i][1];
    }
    if (area2 < 0) { footprint.reverse(); }

    let height: number;
    if (opts.fixedHeightM != null)
    {
        height = opts.fixedHeightM;
    }
    else
    {
        const top  = Number(feat.properties?.render_height) || 0;
        const base = Number(feat.properties?.render_min_height) || 0;
        const min  = opts.minHeightM ?? 3;
        const max  = opts.maxHeightM ?? 24;
        height = Math.max(min, Math.min(max, top - base || min));
    }

    const c = centroid(footprint);
    return { footprint, height, isHome, centerX: c.x, centerY: c.y };
}

//Convert Helios's { home, surroundings } building collections to the renderer's Building[]. Home
//features are flagged isHome (painted in the brand colour); surroundings are the faint ghost context.
export function buildingsFromGeoJson(
    home:        FeatureCollectionLike | null | undefined,
    surroundings: FeatureCollectionLike | null | undefined,
    homeLat:     number,
    homeLng:     number,
    opts:        FromGeoJsonOptions = {}
): Building[]
{
    const out: Building[] = [];
    for (const f of home?.features ?? [])
    {
        const b = featureToBuilding(f, homeLat, homeLng, true, opts);
        if (b) { out.push(b); }
    }
    for (const f of surroundings?.features ?? [])
    {
        const b = featureToBuilding(f, homeLat, homeLng, false, opts);
        if (b) { out.push(b); }
    }
    return out;
}
