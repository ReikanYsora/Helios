//Buildings for the 2.5D scene: the Building/ScenePalette/HomeAppearance types, the OpenFreeMap data fetch, and
//the faux-3D building + shadow painters. Pure functions over a SceneCamera + local-metric footprints.
//
//Data flow splits into fetch-once-at-max + interpret-on-read so a building-option tweak (radius, count,
//height, cluster) re-interprets cached raw data in memory instead of re-fetching.
//  - fetchRawBuildings(): fetch the OpenFreeMap vector tiles covering the max radius, decode their `building`
//    layer, convert each footprint ring to local metres (east/north) relative to the home, dedupe the buildings
//    that tile buffers repeat across tile edges, and keep the nearest MAX_BUILDING_COUNT footprints as
//    option-independent RawBuilding[]. Cached in localStorage keyed on home location only, so options never re-fetch.
//  - interpretBuildings(): apply the options to cached raw data: filter to radius, slice count, resolve
//    per-building height, mark the home (containing/nearest the position) plus any building whose centroid
//    lies within the cluster radius (attached outbuildings join the home set). Empty raw set falls back to a
//    single standard house at the origin so the scene always has a home to draw.
//
//Painters: buildings are extruded prisms drawn with a per-face painter's algorithm (depth-sorted,
//screen-space back-face culled); shadows are each footprint's cast envelope flattened by one group-opacity.

import type { SceneCamera} from './projection';
import { PERSPECTIVE, NEAR_PLANE } from './projection';
import { mixHex, hexByte, tintedRgba, pointsAttr, type Point } from './colors';
import { fetchOfmBuildingRings, type OfmRing } from './ofm';
import { DEG, SHADOW_FADE_DEG, MAX_SHADOW_M,
    FIXED_BUILDING_HEIGHT_M,
    MAX_BUILDING_COUNT,
    MAX_DISPLAY_RADIUS_M,
    FALLBACK_HOUSE_HALF_W,
    FALLBACK_HOUSE_HALF_D,
    BUILDING_CACHE_TTL_MS,
    REAL_HEIGHT_CAP_M,
    REAL_HEIGHT_FALLBACK_M,
    METRES_PER_DEGREE } from '../constants';

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

//Subset renderShadows reads from a caster: footprint, height, and centroid (for the near-plane cull).
//Building satisfies it, so buildings feed the projector directly.
export interface ShadowCaster
{
    footprint: Point[];
    height:    number;
    centerX:   number;
    centerY:   number;
}

export interface ScenePalette
{
    home:     string; //#rrggbb
    neighbor: string; //#rrggbb
}

//Per-frame appearance of the HOME prism only (neighbours unaffected). All optional; an empty object
//renders a solid `palette.home` block at full `growth`.
export interface HomeAppearance
{
    //Solid fill colour. Defaults to palette.home.
    color?:  string;
    //Stacked histogram: one band per producing PV string, `frac` summing to ~1, bottom to top. With 2+
    //bands the home paints as a vertical stack instead of a solid block.
    bands?:  { frac: number; color: string }[];
    //Extra height multiplier (0..1) for the squash/grow animation; multiplies `growth`.
    growth?: number;
    //Focal highlight: a coloured glow halo, white edge, and brighter roof, matching the focused histogram bar.
    highlight?: boolean;
}

//---------------------------------------------------------------------------------------------------------
//OpenFreeMap data fetch: OSM footprints around the home, via vector tiles.
//---------------------------------------------------------------------------------------------------------

//Option-independent, JSON-serialisable raw building parsed once at the max radius. Nothing here depends on
//radius/count/height/cluster, so it's cached by location only; interpretBuildings() applies the options.
export interface RawBuilding
{
    footprint:  Point[];        //metres east/north relative to the home, CCW, open ring
    centerX:    number;         //centroid east
    centerY:    number;         //centroid north
    distanceM:  number;         //distance from the home to the footprint (0 if it contains the home)
    osmHeightM: number | null;  //raw uncapped OSM render height (m), null when untagged
}

//Ray-casting point-in-polygon (local metres).
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

//Distance from the home (origin) to a footprint, 0 when the origin is INSIDE it. Ranks buildings and picks
//the home: a large building containing the point ranks first even though its centroid may be far (which
//would otherwise drop it or hand "home" to a closer-centroid neighbour).
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

//localStorage cache key: rounded home position only, so one entry serves every option set. The bld3 version tag
//isolates the current geometry format, so entries written by an older format are never mixed in.
function cacheKey(lat: number, lng: number): string
{
    return `helios-bld3:${lat.toFixed(4)}:${lng.toFixed(4)}`;
}



//Drop the persisted raw footprints for a location, so the next fetch hits OpenFreeMap again. Editor
//"force building download" support.
export function clearBuildingsLocationCache(lat: number, lng: number): void
{
    try
    {
        localStorage.removeItem(cacheKey(lat, lng));
    }
    catch (_)
    {
        //Storage unavailable (private mode): nothing persisted, nothing to drop.
    }
}

//Parse OpenFreeMap footprint rings into option-independent RawBuilding[]: each ring's lon/lat to local metres
//east/north relative to the home, with centroid, distance-to-footprint, and raw render height. Buildings that a
//tile buffer repeats across adjacent tiles are de-duplicated, and anything outside `radiusM` is dropped (a z14 tile
//spans ~2.4 km, far past the display radius). Ranked by distance, nearest MAX_BUILDING_COUNT kept. No height cap,
//count slice, or home flag (interpret's job).
export function parseOfmBuildings(
    rings:   OfmRing[],
    lat:     number,
    lng:     number,
    radiusM: number
): RawBuilding[]
{
    const perLat = METRES_PER_DEGREE;
    const perLon = METRES_PER_DEGREE * Math.cos(lat * DEG);
    const buildings: RawBuilding[] = [];
    //De-dup: a footprint sitting in a tile's buffer is repeated whole in the neighbouring tile, at the same world
    //coordinates. Key on the rounded centroid + height + vertex count, so identical repeats collapse while two
    //genuinely distinct buildings (different position, height or outline) stay separate.
    const seen = new Set<string>();
    //Coarse centroid pre-filter before the O(vertices) distance/winding work: skip anything whose centroid is well
    //past the radius, keeping a margin so a large building whose centroid sits outside but whose edge reaches inside
    //still gets the exact distance test below.
    const centroidCutoff = radiusM + 250;

    for (const { lonLat, heightM } of rings)
    {
        let cx0 = 0;
        let cy0 = 0;
        for (const [lon, la] of lonLat)
        {
            cx0 += (lon - lng) * perLon;
            cy0 += (la - lat) * perLat;
        }
        if (Math.hypot(cx0 / lonLat.length, cy0 / lonLat.length) > centroidCutoff)
        {
            continue;
        }

        const footprint: Point[] = lonLat.map(([lon, la]) => [
            (lon - lng) * perLon,
            (la - lat) * perLat,
        ]);

        //Vector-tile rings are already open, but a source may still repeat the first vertex; drop a closing vertex
        //that matches on BOTH axes so the painter never draws a degenerate wall looping back to the start.
        const last = footprint.length - 1;
        if (footprint.length > 1
            && footprint[0][0] === footprint[last][0]
            && footprint[0][1] === footprint[last][1])
        {
            footprint.pop();
        }
        if (footprint.length < 3)
        {
            continue;
        }

        //Force CCW winding so the painter's screen-space back-face cull has a consistent sign (tile rings mix
        //CW + CCW, which would otherwise flip walls inside-out).
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
        centerX /= footprint.length;
        centerY /= footprint.length;

        const distanceM = distanceToHome(footprint);
        //Exact radius test on the footprint edge (0 when it contains the home): keeps buildings only partly inside
        //the radius, like the old query, but drops the rest of the ~2.4 km tile.
        if (distanceM > radiusM)
        {
            continue;
        }

        const dedupKey = `${centerX.toFixed(1)}|${centerY.toFixed(1)}|${heightM ?? 'n'}|${footprint.length}`;
        if (seen.has(dedupKey))
        {
            continue;
        }
        seen.add(dedupKey);

        buildings.push({
            footprint,
            centerX,
            centerY,
            distanceM,
            osmHeightM: heightM,
        });
    }

    //Keep the nearest MAX_BUILDING_COUNT buildings, ranked by distance to the FOOTPRINT (0 when it contains the
    //home), so a large building wrapping the home is never dropped. Bounds the cached payload.
    buildings.sort((a, b) => a.distanceM - b.distanceM);
    return buildings.slice(0, MAX_BUILDING_COUNT);
}

//A single standard detached house centred on the home, for offline / no-result fallback.
function fallbackHouse(): Building
{
    const w = FALLBACK_HOUSE_HALF_W;
    const d = FALLBACK_HOUSE_HALF_D;
    return {
        //CCW winding (positive signed area), like parsed OSM footprints, for consistent back-face culling.
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

//Fetch the option-independent raw footprints around the home at the max display radius. Serves a fresh
//localStorage cache (keyed on location only) first, else fetches the OpenFreeMap tiles covering the radius.
//Return contract: an array on success ([] = the area genuinely has no mapped buildings), NULL on a total
//outage (offline, tile server down), so the caller can schedule a re-attempt instead of treating the outage
//as a final answer; the cache never holds either empty shape. Aborts propagate as an AbortError the caller swallows.
export async function fetchRawBuildings(
    homeLat: number,
    homeLon: number,
    signal?: AbortSignal
): Promise<RawBuilding[] | null>
{
    const lat    = homeLat;
    const lng    = homeLon;
    //Always query the widest radius the user can pick; interpret narrows it per option on read.
    const radius = Math.round(MAX_DISPLAY_RADIUS_M);
    const key    = cacheKey(lat, lng);

    //Cache hit: reuse the stored raw footprints directly (only real results, never the fallback).
    try
    {
        const raw    = localStorage.getItem(key);
        const cached = raw
            ? (JSON.parse(raw) as { time: number; buildings: RawBuilding[] })
            : null;
        if (cached?.buildings?.length && Date.now() - cached.time < BUILDING_CACHE_TTL_MS)
        {
            return cached.buildings;
        }
    }
    catch (_)
    {
        //Corrupt cache entry: ignore and re-fetch.
    }

    //Total outage (no tile answered / TileJSON unreachable): NULL so the engine schedules a retry. The caller's
    //abort (a rapid location change) propagates out of the fetch as an AbortError the engine swallows.
    const rings = await fetchOfmBuildingRings(lat, lng, radius, signal);
    if (rings === null)
    {
        return null;
    }

    const buildings = parseOfmBuildings(rings, lat, lng, radius);
    if (buildings.length)
    {
        try
        {
            localStorage.setItem(key, JSON.stringify({ time: Date.now(), buildings }));
        }
        catch (_)
        {
            //Storage quota: not fatal, the footprints still render this session.
        }
        return buildings;
    }

    //Building-free area: never cached; interpretBuildings() renders the fallback house.
    return [];
}

//Options interpretBuildings() applies to cached raw data on read. All cheap and in-memory, no re-fetch.
export interface InterpretBuildingsOptions
{
    radiusM:        number;
    count:          number;
    realSize:       boolean;
    fixedHeightM:   number;
    clusterRadiusM: number;
}

//Turn option-independent RawBuilding[] into render-ready Building[] per the options. Pure and cheap: filter
//to radius, slice count, resolve per-building height, mark the home + its cluster.
export function interpretBuildings(
    raw:  RawBuilding[],
    opts: InterpretBuildingsOptions
): Building[]
{
    //No raw data (offline, tile fetch failed, or no mapped buildings): the single fallback house.
    if (raw.length === 0)
    {
        return [fallbackHouse()];
    }

    //Filter to the display radius (raw is distance-sorted, so this is a prefix). Radius 0 leaves nothing, so
    //keep the single nearest raw building so the home itself always shows.
    let kept = raw.filter((b) => b.distanceM <= opts.radiusM);
    if (kept.length === 0)
    {
        kept = [raw[0]];
    }

    //Take the nearest `count` (raw is already distance-sorted).
    kept = kept.slice(0, Math.max(0, opts.count));
    if (kept.length === 0)
    {
        kept = [raw[0]];
    }

    //Per-building height: real OSM heights (capped, with a fallback for untagged buildings) when realSize is
    //on, else a uniform fixed prism. isHome resolved below.
    const buildings: Building[] = kept.map((b) => ({
        footprint: b.footprint,
        height:    opts.realSize
            ? Math.min(REAL_HEIGHT_CAP_M, b.osmHeightM ?? REAL_HEIGHT_FALLBACK_M)
            : opts.fixedHeightM,
        isHome:    false,
        centerX:   b.centerX,
        centerY:   b.centerY,
    }));

    //Mark the home: the smallest-distanceM building (first after the sort), then every other kept building
    //whose centroid is within clusterRadiusM of it (attached outbuildings join the home set). 0 = home only.
    const homeIdx = 0;
    buildings[homeIdx].isHome = true;
    const home    = buildings[homeIdx];
    const cluster = Math.max(0, opts.clusterRadiusM);
    if (cluster > 0)
    {
        for (let i = 0; i < buildings.length; i++)
        {
            if (i === homeIdx)
            {
                continue;
            }
            const dx = buildings[i].centerX - home.centerX;
            const dy = buildings[i].centerY - home.centerY;
            if (Math.hypot(dx, dy) <= cluster)
            {
                buildings[i].isHome = true;
            }
        }
    }

    return buildings;
}

//---------------------------------------------------------------------------------------------------------
//Painters: extrude + shade the footprints into SVG.
//---------------------------------------------------------------------------------------------------------

//Every footprint casts a shadow; one group-opacity flattens overlaps into a single even shade. `sun` is
//{azimuth (deg from N, CW), altitude (deg)}. shadowOpacity is the peak alpha.
export function renderShadows(
    cam:          SceneCamera,
    casters:      ShadowCaster[],
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
    for (const b of casters)
    {
        //Skip casters at/behind the camera (same near-plane cull as the buildings).
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
    if (!inner)
    {
        return '';
    }
    return `<g opacity="${(shadowOpacity * fade).toFixed(3)}">${inner}</g>`;
}

//Extrude + paint the buildings far to near. `altitude` is the sun altitude (deg) for the time-of-day tint;
//`growth` in [0,1] animates the prisms rising. `neighborOpacity` (0..1) sets how solid the surrounding
//(non-home) prisms read. `home` customises the home prism only (colour, growth multiplier, band histogram).
export function renderBuildings(
    cam:             SceneCamera,
    buildings:       Building[],
    altitude:        number,
    palette:         ScenePalette,
    growth:          number,
    neighborOpacity = 0.25,
    home:            HomeAppearance = {}
): string
{
    const nearCull = PERSPECTIVE * (1 - NEAR_PLANE);
    const order = buildings
        .map((b, index) =>
        {
            const c = cam.project3(b.centerX, b.centerY, 0);
            //Order by the building's NEAREST footprint vertex (max cameraZ), not its centre: a big building
            //behind a small one in front has a nearer centre yet must draw FIRST, which a centroid sort breaks.
            let near = -Infinity;
            for (const p of b.footprint) { const d = cam.project3(p[0], p[1], 0).depth; if (d > near) { near = d; } }
            return { index, depth: near, cameraZ: c.depth };
        })
        //Near-plane cull: skip buildings at/behind the camera, else their walls smear over the scene.
        .filter((o) => o.cameraZ < nearCull)
        .sort((a, b) => a.depth - b.depth);

    //Neighbours use the raw colour (NOT altitude-tinted): night shading would darken them to near the
    //dark-theme background and make them vanish. They paint OPAQUE (walls a touch darker than the roof for
    //shading); the user-set neighborOpacity is applied ONCE to the whole neighbour group below, so back faces
    //and stacked prisms never show through each other (only the visible silhouette reads, then fades as a unit).
    const nb       = palette.neighbor;
    const nbWall   = mixHex(nb, '#000000', 0.18);
    const nbStroke = mixHex(nb, '#000000', 0.30);
    const homeBands = home.bands && home.bands.length >= 2 ? home.bands : null;

    //Faces split by group: neighbours (faded together) and the home (always full opacity, drawn on top). Each
    //group is painted far-to-near by nearest-corner depth, so within a group two touching prisms interleave
    //correctly at their shared wall.
    const neighborFaces: { depth: number; svg: string }[] = [];
    const homeFaces:     { depth: number; svg: string }[] = [];
    for (const { index } of order)
    {
        const b  = buildings[index];
        const faces = b.isHome ? homeFaces : neighborFaces;
        const fp = simplifyFootprint(b.footprint);
        //Home prism height carries the extra squash/grow multiplier.
        const h  = b.height * growth * (b.isHome ? (home.growth ?? 1) : 1);

        //Vertical bands as cumulative height fractions [0..1] with a fill per band. A solid prism is one
        //band spanning the full height; the home histogram is one band per producing PV string.
        const cum:  number[] = [0];
        const fill: string[] = [];
        if (b.isHome && homeBands)
        {
            for (const band of homeBands)
            {
                cum.push(Math.min(1, cum[cum.length - 1] + band.frac));
                fill.push(tintedRgba(mixHex(band.color, '#000000', 0.22), altitude, 0.9));
            }
            cum[cum.length - 1] = 1; //pin the top against rounding drift
        }
        else
        {
            cum.push(1);
            fill.push(b.isHome
                ? tintedRgba(mixHex(home.color ?? palette.home, '#000000', 0.22), altitude, 0.9)
                : nbWall);
        }
        const rings    = cum.map((c) => fp.map((p) => cam.project(p[0], p[1], h * c)));
        const base     = rings[0];
        const roof     = rings[rings.length - 1];
        //Roof + edge stroke follow the top band (histogram) or the solid colour; the home keeps a brightened
        //edge so it reads as the focal building.
        const topColor = homeBands ? homeBands[homeBands.length - 1].color : (home.color ?? palette.home);
        //Focused home: roof lifted harder toward white, near-opaque white edge, and the glow halo (below).
        const hl = !!(b.isHome && home.highlight);
        const roofFill = b.isHome
            ? tintedRgba(mixHex(topColor, '#ffffff', hl ? 0.4 : 0.18), altitude, 0.92)
            : nb;
        let stroke = nbStroke;
        if (hl)
        {
            stroke = 'rgba(255,255,255,0.9)';
        }
        else if (b.isHome)
        {
            const eg = mixHex(home.color ?? palette.home, '#ffffff', 0.5);
            stroke   = `rgba(${hexByte(eg, 1)},${hexByte(eg, 3)},${hexByte(eg, 5)},0.1)`;
        }
        const strokeW = b.isHome ? 1 : 0.4;

        //Emit each visible wall band into the shared face list (sorted globally below).
        for (let i = 0; i < base.length; i++)
        {
            const next = (i + 1) % base.length;
            const p0 = base[i];
            const p1 = base[next];
            const p2 = roof[next];
            const p3 = roof[i];
            //Screen-space back-face cull: a wall facing the camera winds negative (shoelace) once projected.
            //Using the PROJECTED quad (not a global bearing) stays correct for buildings off to the sides,
            //where perspective makes the view angle differ from bearing.
            const facing =
                p0[0] * p1[1] - p1[0] * p0[1] +
                (p1[0] * p2[1] - p2[0] * p1[1]) +
                (p2[0] * p3[1] - p3[0] * p2[1]) +
                (p3[0] * p0[1] - p0[0] * p3[1]);
            if (facing >= 0)
            {
                continue;
            }
            //One quad per band, stacked up the wall; a solid prism is one full-height band.
            let wall = '';
            for (let k = 0; k < fill.length; k++)
            {
                const lo = rings[k];
                const hi = rings[k + 1];
                wall += `<polygon points="${pointsAttr([lo[i], lo[next], hi[next], hi[i]])}" fill="${fill[k]}" stroke="${stroke}" stroke-width="${strokeW}"/>`;
            }
            //Histogram separations: a crisp horizontal edge at each colour boundary, so the stacked bands
            //read as distinct layers on the home prism.
            if (homeBands && fill.length > 1)
            {
                for (let k = 1; k < fill.length; k++)
                {
                    const r   = rings[k];
                    const sep = tintedRgba(mixHex(homeBands[k - 1].color, '#000000', 0.45), altitude, 0.95);
                    wall += `<line x1="${r[i][0].toFixed(2)}" y1="${r[i][1].toFixed(2)}" x2="${r[next][0].toFixed(2)}" y2="${r[next][1].toFixed(2)}" stroke="${sep}" stroke-width="0.9"/>`;
                }
            }
            //Sort key = the wall's NEAREST corner (max cameraZ, larger = nearer). On a concave footprint an
            //edge-midpoint depth mis-orders two facing walls; the nearest-point does not.
            const wallDepth = Math.max(
                cam.project3(fp[i][0], fp[i][1], 0).depth,
                cam.project3(fp[next][0], fp[next][1], 0).depth,
                cam.project3(fp[i][0], fp[i][1], h).depth,
                cam.project3(fp[next][0], fp[next][1], h).depth,
            );
            faces.push({ depth: wallDepth, svg: wall });
        }
        //Flat roof at its own nearest-corner depth. It sits at the top so in any above-horizon view it never
        //overlaps a wall in screen space, so its order against walls is cosmetic; depth-placing it just keeps a
        //nearer building's roof correctly over a farther one.
        let roofDepth = -Infinity;
        for (const p of fp) { const d = cam.project3(p[0], p[1], h).depth; if (d > roofDepth) { roofDepth = d; } }
        faces.push({
            depth: roofDepth,
            svg:   `<polygon points="${pointsAttr(roof)}" fill="${roofFill}" stroke="${stroke}" stroke-width="${b.isHome ? 1 : 0.6}"/>`,
        });
    }
    //Neighbours: opaque silhouette painted far-to-near, then faded as ONE group so layers never bleed through.
    neighborFaces.sort((a, c) => a.depth - c.depth);
    const op = Math.max(0, Math.min(1, neighborOpacity)).toFixed(3);
    const neighborsSvg = neighborFaces.length
        ? `<g opacity="${op}">${neighborFaces.map((f) => f.svg).join('')}</g>`
        : '';

    //Home on top at full opacity (the focal building). Far-to-near within its own parts.
    homeFaces.sort((a, c) => a.depth - c.depth);
    let homeSvg = homeFaces.map((f) => f.svg).join('');
    //Focused-home glow halo: a drop-shadow tinted to the home colour, matching the focused histogram bar (only
    //fires in the clock dial, where there are no neighbours).
    if (home.highlight && homeSvg)
    {
        const glow = `<defs><filter id="home-glow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${home.color ?? palette.home}" flood-opacity="0.95"/></filter></defs>`;
        homeSvg = `${glow}<g filter="url(#home-glow)">${homeSvg}</g>`;
    }
    return neighborsSvg + homeSvg;
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

//Andrew's monotone-chain convex hull, returning vertices CCW and NOT closed. Wraps a building's base +
//cast-shadow points into one shadow envelope.
export function convexHull(pts: Point[]): Point[]
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
