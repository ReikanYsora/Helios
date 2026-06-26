//Everything "buildings" for the 2.5D scene: the shared Building/ScenePalette/HomeAppearance types, the
//self-sourced Overpass data fetch that turns the home's surroundings into ready-to-extrude footprints, and
//the faux-3D building + shadow PAINTERS that draw those footprints.
//
//Data fetch: we ask the OpenStreetMap Overpass API for every `way["building"]` and multipolygon
//`relation["building"]` within the radius, convert each ring lat/lon -> local metres (east/north) relative
//to the home, keep the nearest MAX_BUILDINGS COMPLETE footprints, and flag the building that contains the
//home GPS (else the nearest) as isHome. When Overpass yields nothing — offline, both mirrors down, or
//genuinely no mapped buildings — we fall back to a single standard house at the origin so the scene always
//has a home to draw. Fetched once per (home, radius) tuple and cached in localStorage (the home doesn't
//move), so a reload doesn't re-hit Overpass. Heights are real OSM heights (capped) under realSize, else a
//uniform fixed prism.
//
//Painters: buildings are extruded prisms drawn with a per-face painter's algorithm (depth-sorted,
//screen-space back-face culled); shadows are each footprint's cast envelope flattened by one group-opacity.
//Pure functions over a SceneCamera + local-metric footprints.

import { SceneCamera, PERSPECTIVE, NEAR_PLANE } from './projection';
import { mixHex, hexByte, tintedRgba, pointsAttr, type Point } from './colors';
import { DEG, SHADOW_FADE_DEG, MAX_SHADOW_M } from './constants';
import {
    FIXED_BUILDING_HEIGHT_M,
    MAX_BUILDINGS,
    FALLBACK_HOUSE_HALF_W,
    FALLBACK_HOUSE_HALF_D,
    BUILDING_CACHE_TTL_MS,
    OVERPASS_RETRY_DELAY_MS,
    OVERPASS_ENDPOINTS,
    REAL_HEIGHT_CAP_M,
    REAL_HEIGHT_FALLBACK_M,
} from '../constants';
//Re-exported so existing importers of SHADOW_FADE_DEG from './buildings' keep resolving.
export { SHADOW_FADE_DEG } from './constants';

//---------------------------------------------------------------------------------------------------------
//Types
//---------------------------------------------------------------------------------------------------------

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

//Per-frame appearance of the HOME prism only (neighbours unaffected). All optional; an empty object
//renders a solid `palette.home` block at full `growth`.
export interface HomeAppearance
{
    //Solid fill colour — the active chip's colour. Defaults to palette.home.
    color?:  string;
    //Stacked histogram: one band per producing PV string, `frac` summing to ~1, bottom→top. With 2+ bands
    //the home paints as a vertical stack instead of a solid block.
    bands?:  { frac: number; color: string }[];
    //Extra height multiplier (0..1) for the squash/grow-on-retarget animation; multiplies `growth`.
    growth?: number;
}

//---------------------------------------------------------------------------------------------------------
//Overpass data fetch — self-sourced footprints around the home.
//---------------------------------------------------------------------------------------------------------

export interface FetchBuildingsOptions
{
    homeLon:      number;
    homeLat:      number;
    radiusMeters: number;
    maxBuildings?: number;
    realSize?:    boolean;
    fixedHeightM?: number;
    signal?:      AbortSignal;
}

//One Overpass element: a `way` carries its ring in `.geometry`; a multipolygon `relation` carries its
//rings in `.members[].geometry` (we keep the outer ones).
interface OverpassWay
{
    type:     string; //'way' | 'relation'
    geometry?: { lat: number; lon: number }[];           //ways
    members?: {
        role:     string;
        geometry?: { lat: number; lon: number }[];
    }[];                                                  //multipolygon relations
    tags?:    Record<string, string>;
}

//Read a building's height (m) from its OSM `tags`: prefer `height` (leading float, e.g. "12", "12 m",
//"12.5"), else `building:levels` x 3 m/level. Returns null when neither parses or yields a positive value.
function osmHeightM(tags: Record<string, string> | undefined): number | null
{
    if (!tags)
    {
        return null;
    }
    const h = parseFloat(tags.height);
    if (Number.isFinite(h) && h > 0)
    {
        return h;
    }
    const levels = parseFloat(tags['building:levels']);
    if (Number.isFinite(levels) && levels > 0)
    {
        return levels * 3;
    }
    return null;
}

//Ray-casting point-in-polygon for one footprint (local metres); true if (x, y) is inside.
function pointInPolygon(x: number, y: number, polygon: Point[]): boolean
{
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++)
    {
        const [ax, ay] = polygon[i];
        const [bx, by] = polygon[j];
        if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax)
        {
            inside = !inside;
        }
    }
    return inside;
}

//Distance from the home (origin) to a footprint — 0 when the origin is INSIDE it. Used to rank buildings
//and pick the home: a large building that contains the point ranks first even though its centroid may be
//far (which would otherwise drop it or hand "home" to a closer-centroid neighbour).
function distanceToHome(polygon: Point[]): number
{
    if (pointInPolygon(0, 0, polygon))
    {
        return 0;
    }
    let nearest = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++)
    {
        const [ax, ay] = polygon[j];
        const dx    = polygon[i][0] - ax;
        const dy    = polygon[i][1] - ay;
        const len2  = dx * dx + dy * dy;
        const t     = len2 ? Math.max(0, Math.min(1, (-ax * dx - ay * dy) / len2)) : 0;
        nearest = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return nearest;
}

//localStorage cache key — rounded home position + radius, so any meaningful move invalidates the entry.
function cacheKey(lat: number, lng: number, radius: number): string
{
    return `helios-bld:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}`;
}

//Parse Overpass `elements` into ranked scene Building[]. Each ring lat/lon -> local metres east/north
//relative to the home, centroid computed, ranked by distance-to-footprint, nearest MAX_BUILDINGS kept.
function parseBuildings(
    ways: OverpassWay[],
    lat:  number,
    lng:  number,
    opts: { maxBuildings?: number; realSize?: boolean; fixedHeightM?: number } = {}
): Building[]
{
    const perLat = 111_320;
    const perLon = 111_320 * Math.cos(lat * DEG);
    const buildings: Building[] = [];

    //Collect outer rings: simple `way` buildings + the outer ring(s) of multipolygon `relation` buildings.
    //Dense cities map whole blocks as relations — without these the home can be missing. Each ring carries its
    //element's `tags` so the per-building height can read the OSM height/levels.
    const rings: { geometry: { lat: number; lon: number }[]; tags?: Record<string, string> }[] = [];
    for (const el of ways)
    {
        if (el.type === 'way' && el.geometry)
        {
            rings.push({ geometry: el.geometry, tags: el.tags });
        }
        else if (el.type === 'relation' && el.members)
        {
            for (const m of el.members)
            {
                if (m.geometry && (m.role === 'outer' || !m.role))
                {
                    rings.push({ geometry: m.geometry, tags: el.tags });
                }
            }
        }
    }

    //Per-building height: real OSM heights (capped, with a fallback for untagged buildings) when realSize is
    //on, otherwise a uniform fixed prism. realSize defaults true when undefined; the caller always passes it.
    const realSize     = opts.realSize !== false;
    const fixedHeightM = opts.fixedHeightM ?? FIXED_BUILDING_HEIGHT_M;

    for (const { geometry, tags } of rings)
    {
        const footprint: Point[] = geometry.map((n) => [
            (n.lon - lng) * perLon,
            (n.lat - lat) * perLat,
        ]);

        //OSM rings are CLOSED (last vertex repeats the first); drop it so the painter doesn't draw a
        //degenerate wall looping back on itself.
        if (footprint.length > 1 && footprint[0][0] === footprint[footprint.length - 1][0])
        {
            footprint.pop();
        }
        if (footprint.length < 3)
        {
            continue;
        }

        //Counter-clockwise winding so the painter's screen-space back-face cull has a consistent sign
        //(OSM mixes CW + CCW footprints, which would otherwise flip walls inside-out).
        let signedArea = 0;
        for (let i = 0; i < footprint.length; i++)
        {
            const next = (i + 1) % footprint.length;
            signedArea += footprint[i][0] * footprint[next][1] - footprint[next][0] * footprint[i][1];
        }
        if (signedArea < 0)
        {
            footprint.reverse();
        }

        let centerX = 0;
        let centerY = 0;
        for (const [x, y] of footprint)
        {
            centerX += x;
            centerY += y;
        }
        const height = realSize
            ? Math.min(REAL_HEIGHT_CAP_M, osmHeightM(tags) ?? REAL_HEIGHT_FALLBACK_M)
            : fixedHeightM;
        buildings.push({
            footprint,
            height,
            isHome:  false,
            centerX: centerX / footprint.length,
            centerY: centerY / footprint.length,
        });
    }

    //Keep the nearest MAX_BUILDINGS, COMPLETE buildings only (whole footprints, never clipped — OSM returns
    //full geometry even for buildings only partly inside the radius). Rank by distance to the FOOTPRINT
    //(0 when it contains the home), so a large building wrapping the home is never dropped.
    const dist = new Map<Building, number>();
    for (const bld of buildings)
    {
        dist.set(bld, distanceToHome(bld.footprint));
    }
    buildings.sort((a, b) => dist.get(a)! - dist.get(b)!);
    const kept = buildings.slice(0, opts.maxBuildings ?? MAX_BUILDINGS);
    markHome(kept);
    return kept;
}

//"The home" = the building that CONTAINS the GPS point (distance 0), else the nearest footprint. Recomputed
//on every load — including from cache — so a stale cached isHome can't persist.
function markHome(buildings: Building[]): void
{
    let nearest = -1;
    let best    = Infinity;
    for (let i = 0; i < buildings.length; i++)
    {
        buildings[i].isHome = false;
        const d = distanceToHome(buildings[i].footprint);
        if (d < best)
        {
            best    = d;
            nearest = i;
        }
    }
    if (nearest >= 0)
    {
        buildings[nearest].isHome = true;
    }
}

//A single standard detached house centred on the home, for offline / no-result fallback.
function fallbackHouse(): Building
{
    const w = FALLBACK_HOUSE_HALF_W;
    const d = FALLBACK_HOUSE_HALF_D;
    return {
        //CCW winding (positive signed area), like parsed OSM footprints, for consistent culling.
        footprint: [
            [-w, -d],
            [w, -d],
            [w, d],
            [-w, d],
        ],
        height:  FIXED_BUILDING_HEIGHT_M,
        isHome:  true,
        centerX: 0,
        centerY: 0,
    };
}

//Fetch building footprints around the home and return ready-to-extrude scene Building[]. Serves a fresh
//localStorage cache first, then tries each Overpass mirror in turn; on total failure (offline, both mirrors
//down, no mapped buildings) returns the single fallback house so the scene always has a home. Respects
//opts.signal — an abort propagates as an AbortError the caller already swallows.
export async function fetchBuildingsAroundHome(opts: FetchBuildingsOptions): Promise<Building[]>
{
    const lat    = opts.homeLat;
    const lng    = opts.homeLon;
    const radius = Math.max(1, Math.round(opts.radiusMeters));
    const key    = cacheKey(lat, lng, radius);

    //Cache hit: reuse the stored footprints (re-marking the home from current logic, so a stale cached
    //isHome can't persist). The cache never holds the fallback house — only real Overpass results.
    try
    {
        const raw    = localStorage.getItem(key);
        const cached = raw
            ? (JSON.parse(raw) as { time: number; buildings: Building[] })
            : null;
        if (cached?.buildings?.length && Date.now() - cached.time < BUILDING_CACHE_TTL_MS)
        {
            markHome(cached.buildings);
            return cached.buildings;
        }
    }
    catch (_)
    {
        //Corrupt cache entry — ignore and re-fetch.
    }

    const overpassQuery =
        `[out:json][timeout:25];(way["building"](around:${radius},${lat},${lng});`
        + `relation["building"](around:${radius},${lat},${lng}););out geom;`;

    /* eslint-disable no-await-in-loop -- retries are intentionally sequential */
    for (const endpoint of OVERPASS_ENDPOINTS)
    {
        try
        {
            const response = await fetch(
                endpoint + '?data=' + encodeURIComponent(overpassQuery),
                {
                    referrerPolicy: 'no-referrer', //don't leak the HA instance URL to Overpass
                    signal:         opts.signal,
                }
            );
            if (!response.ok)
            {
                throw new Error(String(response.status));
            }
            const data      = (await response.json()) as { elements?: OverpassWay[] };
            const buildings = parseBuildings(data.elements ?? [], lat, lng, {
                maxBuildings: opts.maxBuildings,
                realSize:     opts.realSize,
                fixedHeightM: opts.fixedHeightM,
            });
            if (buildings.length)
            {
                try
                {
                    localStorage.setItem(key, JSON.stringify({ time: Date.now(), buildings }));
                }
                catch (_)
                {
                    //Storage quota: not fatal — the footprints still render this session.
                }
                return buildings;
            }
        }
        catch (err)
        {
            //Propagate aborts so a rapid radius change cancels cleanly (the caller swallows AbortError).
            if ((err as { name?: string })?.name === 'AbortError')
            {
                throw err;
            }
            //Mirror failed: wait, then try the next endpoint.
            await new Promise<void>((resolve) =>
            {
                setTimeout(resolve, OVERPASS_RETRY_DELAY_MS);
            });
        }
    }
    /* eslint-enable no-await-in-loop */

    //Every mirror failed or returned nothing: fall back to the standard house, NOT cached (a later retry
    //or config change can still recover the real buildings).
    return [fallbackHouse()];
}

//---------------------------------------------------------------------------------------------------------
//Painters — extrude + shade the footprints into SVG.
//---------------------------------------------------------------------------------------------------------

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
//`growth` ∈ [0,1] animates the prisms rising on first load. `neighborOpacity` (0..1) sets how solid the
//surrounding (non-home) prisms read. `home` customises the home prism only (colour, growth multiplier,
//and optional 2+ band histogram).
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

    //Neighbours use the raw colour (NOT altitude-tinted): the night shading would darken them to near the
    //dark-theme background and make them vanish. Opacity (neighborOpacity) is user-controlled.
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
//Footprint geometry helpers. Kept local to the building painters, their only consumers.
//---------------------------------------------------------------------------------------------------------

//Drop only TRULY collinear vertices (common in OSM footprints) so a straight wall stays ONE quad with no
//false vertical edge bisecting it. The 0.05 m threshold (perpendicular distance off the line through the
//neighbours) keeps every real corner.
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
