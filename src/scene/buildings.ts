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

import * as polygonClipping from 'polygon-clipping';
import type { SceneCamera, ProjectedPoint } from './projection';
import { PERSPECTIVE, NEAR_PLANE } from './projection';
import { tintedRgba, buildingColor } from '../core/render-kit/colors';
import { mixHex, hexByte, rgbaHex } from '../core/render-kit/hex';
import { pointsAttr, clipPolygon, cardClipRect, type Point, type ClipRect } from '../core/render-kit/geometry';
import { fetchOfmBuildingRings, type OfmRing } from './openfreemap';
import { DEG, SHADOW_FADE_DEG, MAX_SHADOW_M,
    FIXED_BUILDING_HEIGHT_M,
    MAX_BUILDING_COUNT,
    MAX_DISPLAY_RADIUS_M,
    FALLBACK_HOUSE_HALF_W,
    FALLBACK_HOUSE_HALF_D,
    BUILDING_CACHE_TTL_MS,
    REAL_HEIGHT_CAP_M,
    REAL_HEIGHT_FALLBACK_M,
    METRES_PER_DEGREE } from '../core/config/constants';

//---------------------------------------------------------------------------------------------------------
//Types
//---------------------------------------------------------------------------------------------------------

export interface Building
{
    footprint: Point[]; //metres east/north relative to the home; the OUTER ring
    height:    number;
    isHome:    boolean;
    centerX:   number;  //centroid east, for the back-to-front draw order + shadow cull
    centerY:   number;  //centroid north
    //Inner rings (courtyards). A merged block keeps its holes, or the union would fill the yard in.
    holes?:    Point[][];
    //Outlines of the ORIGINAL buildings this volume merged, drawn flat on the roof so a terrace still reads as
    //separate houses. They live on the roof plane, so they carry no depth conflict of their own.
    detail?:   Point[][];
}

//Subset renderShadows reads from a caster: footprint, height, and centroid (for the near-plane cull).
//Building satisfies it, so buildings feed the projector directly.
export interface ShadowCaster
{
    footprint: Point[];
    height:    number;
    centerX:   number;
    centerY:   number;
    //Courtyards. They are not solid, so they cast nothing and must not be punched out of the shadow either: a
    //yard DOES catch the shade of the walls around it.
    holes?:    Point[][];
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
    //Extra height multiplier (0..1) for the squash/grow animation; multiplies `growth`.
    growth?: number;
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

//Shoelace signed area: positive for a counter-clockwise ring. Shared by every winding-normalisation pass below,
//so parsed OFM rings and painter paths agree on which sign means CCW.
function signedArea(points: Point[]): number
{
    let area = 0;
    for (let i = 0; i < points.length; i++)
    {
        const next = (i + 1) % points.length;
        area += points[i][0] * points[next][1] - points[next][0] * points[i][1];
    }
    return area;
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

//localStorage cache key: rounded home position only, so one entry serves every option set. Includes a format
//tag so entries written by an older cached-geometry format are never mixed in.
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
//spans ~2.4 km, and the fetch reaches a tile grid wide enough for the radius). Ranked by distance, nearest
//MAX_BUILDING_COUNT kept. No height cap,
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
        if (signedArea(footprint) < 0)
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
        //Exact radius test on the footprint edge (0 when it contains the home): a building only partly inside the
        //radius is kept, the rest of the ~2.4 km tile dropped.
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
//Merge same-height footprints that touch into ONE volume, keeping each original outline for the roof.
//
//This is what breaks the deadlock. Two houses standing shoulder to shoulder are not two volumes, they are one
//block: the wall between them exists only because two outlines get extruded apart. That wall is COPLANAR with its
//neighbour's, so both faces carry the identical depth, the painter's sort meets a tie it cannot break, and the
//internal face surfaces or vanishes with the camera angle. Merging deletes the face instead of trying to order it,
//and it deletes the whole class of them at once: a merged block has no inside.
//
//The detail is kept: every original outline is drawn flat ON the roof, where it cannot conflict with anything. Home and neighbours merge separately, so the home keeps
//its own prism, and only equal heights merge, so nothing ever loses its height.
function mergeSameHeight(list: Building[]): Building[]
{
    const groups = new Map<string, Building[]>();
    for (const b of list)
    {
        const key = `${b.height.toFixed(3)}|${b.isHome ? 'h' : 'n'}`;
        const g = groups.get(key);
        if (g)
        {
            g.push(b);
        }
        else
        {
            groups.set(key, [b]);
        }
    }

    const out: Building[] = [];
    for (const group of groups.values())
    {
        if (group.length === 1)
        {
            out.push({ ...group[0], detail: [group[0].footprint] });
            continue;
        }
        let merged: number[][][][];
        try
        {
            const polys = group.map((b) => [[...b.footprint, b.footprint[0]] as [number, number][]]);
            merged = polygonClipping.union(polys[0], ...polys.slice(1)) as unknown as number[][][][];
        }
        catch (_)
        {
            //Degenerate outline: keep the originals rather than lose the buildings.
            for (const b of group)
            {
                out.push({ ...b, detail: [b.footprint] });
            }
            continue;
        }

        for (const poly of merged)
        {
            const rings = poly
                //polygon-clipping closes its rings; the rest of the pipeline works on open ones.
                .map((r) => r.slice(0, -1).map(([x, y]) => [x, y] as Point))
                .filter((r) => r.length >= 3);
            if (rings.length === 0)
            {
                continue;
            }
            const outer = rings[0];
            let cx = 0;
            let cy = 0;
            for (const p of outer)
            {
                cx += p[0]; cy += p[1];
            }
            const centerX = cx / outer.length;
            const centerY = cy / outer.length;
            out.push({
                footprint: outer,
                holes:     rings.slice(1),
                //Only the originals that landed in THIS block: a group can merge into several blocks.
                detail:    group.filter((b) => pointInPolygon(b.centerX, b.centerY, outer)).map((b) => b.footprint),
                height:    group[0].height,
                isHome:    group[0].isHome,
                centerX,
                centerY,
            });
        }
    }
    return out;
}

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

    //Touching same-height prisms become one block, so their coplanar internal walls stop existing.
    return mergeSameHeight(buildings);
}

//---------------------------------------------------------------------------------------------------------
//Painters: extrude + shade the footprints into SVG.
//---------------------------------------------------------------------------------------------------------

//A closed sub-path through projected points, always wound the same way.
//
//Non-zero fill ADDS sub-paths wound alike and CANCELS ones wound against each other. The sweep's pieces overlap on
//purpose, and projection flips winding (screen y runs down), so an unnormalised outline and its edge quads would
//cancel where they meet and leave only the scraps that overlap nothing. Normalising here means no caller can forget.
function pathOf(pts: [number, number][], hole = false): string
{
    const ccw  = signedArea(pts) < 0 ? [...pts].reverse() : pts;
    //`hole` uses that cancelling on purpose: a ring wound AGAINST the rest subtracts instead of adding.
    const ring = hole ? [...ccw].reverse() : ccw;
    return ring.map((q, k) => `${k === 0 ? 'M' : 'L'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('') + 'Z';
}

//Build an even-odd path (`M...L...Z` per ring) from projected rings, each clipped to the card box. Rings that fall
//fully off-card are dropped; returns '' when nothing survives.
function ringsPath(rings: Point[][], r: ClipRect): string
{
    let d = '';
    for (const ring of rings)
    {
        const c = clipPolygon(ring, r);
        if (c.length < 3)
        {
            continue;
        }
        d += c.map((q, k) => `${k === 0 ? 'M' : 'L'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('') + 'Z';
    }
    return d;
}

//What the painters hand the renderer: shapes, not markup. The scene SVG keeps its nodes from frame to frame and
//only rewrites the attributes that moved (see scene-dom.ts), so the painters describe each face by its attribute
//text. shapesSvg/shadowLayerSvg serialise them as markup, one attribute per field in order, for the
//characterisation snapshots.
export interface SceneShape
{
    tag:         'polygon' | 'path';
    //`points` of a polygon, `d` of a path.
    geom:        string;
    fill:        string;
    fillRule?:   'evenodd';
    stroke:      string;
    strokeWidth: string;
}

//One frame of cast shade: the stencil that cuts the buildings out of it, the group alpha, and per caster the swept
//envelope plus its along-axis fade gradient (all casts share the shade colour).
export interface ShadowLayer
{
    opacity: string;
    color:   string;
    clip:    string;
    casts:   { d: string; x1: string; y1: string; x2: string; y2: string }[];
}

export function shapesSvg(shapes: SceneShape[]): string
{
    let out = '';
    for (const s of shapes)
    {
        out += s.tag === 'polygon'
            ? `<polygon points="${s.geom}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"/>`
            : `<path d="${s.geom}" fill="${s.fill}"${s.fillRule ? ` fill-rule="${s.fillRule}"` : ''}`
              + ` stroke="${s.stroke}" stroke-width="${s.strokeWidth}"/>`;
    }
    return out;
}

export function shadowLayerSvg(layer: ShadowLayer | null): string
{
    if (!layer)
    {
        return '';
    }
    let defs   = '';
    let shapes = '';
    layer.casts.forEach((c, k) =>
    {
        const id = `hsh${k}`;
        defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" `
              + `x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}">`
              + `<stop offset="0" stop-color="${layer.color}" stop-opacity="1"/>`
              + `<stop offset="1" stop-color="${layer.color}" stop-opacity="0"/></linearGradient>`;
        shapes += `<path d="${c.d}" fill="url(#${id})" fill-rule="nonzero"/>`;
    });
    defs += `<clipPath id="hsh-clip" clipPathUnits="userSpaceOnUse">`
          + `<path d="${layer.clip}" clip-rule="evenodd"/></clipPath>`;
    return `<defs>${defs}</defs>`
         + `<g opacity="${layer.opacity}" clip-path="url(#hsh-clip)">${shapes}</g>`;
}

//Every footprint casts a shadow; one group-opacity flattens overlaps into a single even shade. `sun` is
//{azimuth (deg from N, CW), altitude (deg)}. shadowOpacity is the peak alpha.
export function renderShadows(
    cam:          SceneCamera,
    casters:      ShadowCaster[],
    sun:          { azimuth: number; altitude: number },
    shadowColor:  string,
    shadowOpacity: number
): ShadowLayer | null
{
    const fade = Math.min(1, sun.altitude / SHADOW_FADE_DEG);
    if (fade <= 0)
    {
        return null;
    }
    const away     = (sun.azimuth + 180) * DEG;
    const nearCull = PERSPECTIVE * (1 - NEAR_PLANE);
    const rect     = cardClipRect(cam.width, cam.height);
    const casts: ShadowLayer['casts'] = [];
    //The stencil that cuts every building out of the shade layer (see the clipPath below). Built here, in the same
    //pass, from the same projected rings the sweep uses, so a footprint is projected once per frame rather than once
    //each for the sweep, the edge quads and the stencil.
    let clip = 'M-9999,-9999L9999,-9999L9999,9999L-9999,9999Z';
    for (const b of casters)
    {
        const holes     = b.holes ?? [];
        const base      = b.footprint.map((p) => cam.project(p[0], p[1], 0));
        const holesBase = holes.map((ring) => ring.map((p) => cam.project(p[0], p[1], 0)));
        clip += pathOf(base);
        for (const hb of holesBase)
        {
            clip += pathOf(hb);
        }
        //Skip casters at/behind the camera (same near-plane cull as the buildings). They still stencil: their
        //footprint clamps to the near plane like any other point, and the cut stays wherever it lands.
        if (cam.project3(b.centerX, b.centerY, 0).depth >= nearCull)
        {
            continue;
        }
        const length = Math.min(b.height / Math.tan(sun.altitude * DEG), MAX_SHADOW_M);
        const oe = Math.sin(away) * length;
        const on = Math.cos(away) * length;
        const cast = b.footprint.map((p) => cam.project(p[0] + oe, p[1] + on, 0));

        //Distance fade, but anchored OUTSIDE the building. The screen-space shadow direction is base-centroid ->
        //cast-centroid; the gradient is full at the base's FAR edge (where the shadow leaves the building, so its
        //visible part starts fully opaque) and fades to 0 at the cast's far edge (the tip). The part under the
        //building (before the far edge) reads the clamped full-opacity stop, but the prism covers it anyway.
        let bcx = 0; let bcy = 0; for (const p of base)
        {
            bcx += p[0]; bcy += p[1];
        }
        let ccx = 0; let ccy = 0; for (const p of cast)
        {
            ccx += p[0]; ccy += p[1];
        }
        const n = base.length || 1;
        let ax = ccx / n - bcx / n;
        let ay = ccy / n - bcy / n;
        const alen = Math.hypot(ax, ay) || 1;
        ax /= alen; ay /= alen;

        //Anchor the gradient ON the axis, at the FAR extent of each ring, never on a vertex: a vertex anchor makes
        //the direction depend on which corner wins the argmax, which flips to a neighbour under a tenth of a degree
        //of rotation and swings the fade sideways. The max projection is continuous even where the argmax jumps,
        //so the gradient stays parallel to the shadow through any rotation.
        const ox = bcx / n;
        const oy = bcy / n;
        let sMax = -Infinity;
        for (const p of base)
        {
            const d = (p[0] - ox) * ax + (p[1] - oy) * ay; if (d > sMax)
            {
                sMax = d;
            }
        }
        let eMax = -Infinity;
        for (const p of cast)
        {
            const d = (p[0] - ox) * ax + (p[1] - oy) * ay; if (d > eMax)
            {
                eMax = d;
            }
        }
        const start: [number, number] = [ox + ax * sMax, oy + ay * sMax];
        const end:   [number, number] = [ox + ax * eMax, oy + ay * eMax];

        //The EXACT swept envelope, not its convex hull: a hull fills the notch of an L (a merged terrace), spilling
        //shade across courtyards and neighbours. The true sweep is the outline translated to the shadow's tip plus
        //the quad every edge sweeps on its way; the pieces overlap on purpose, the group's single opacity flattens
        //them into their union with no boolean work. One path per caster.
        //Each piece is clipped to the card box first, so off-card ink never enlarges the scene layer (see
        //.scene-svg); the non-zero union still reads the same within the card (a clip cannot change an interior
        //point's winding).
        let d = '';
        const cc = clipPolygon(cast, rect);
        if (cc.length >= 3)
        {
            d += pathOf(cc);
        }
        for (let r = -1; r < holes.length; r++)
        {
            const rb = r < 0 ? base : holesBase[r];
            const rc = r < 0 ? cast : holes[r].map((p) => cam.project(p[0] + oe, p[1] + on, 0));
            for (let i = 0; i < rb.length; i++)
            {
                const j = (i + 1) % rb.length;
                const q = clipPolygon([rb[i], rb[j], rc[j], rc[i]], rect);
                if (q.length >= 3)
                {
                    d += pathOf(q);
                }
            }
        }
        //Whole shadow off-card: emit neither the sweep nor its gradient, and do not burn a slot.
        if (!d)
        {
            continue;
        }
        casts.push({ d, x1: start[0].toFixed(1), y1: start[1].toFixed(1), x2: end[0].toFixed(1), y2: end[1].toFixed(1) });
    }
    if (casts.length === 0)
    {
        return null;
    }
    //Cut every building out of the whole shade layer at once.
    //
    //Shade cannot lie on ground a building stands on, and the prisms cannot be relied on to cover it (a translucent
    //building shows it straight through). A reversed ring per shape cannot subtract it either: non-zero fill counts
    //a WINDING NUMBER, and the sweep's pieces overlap most over the footprint (translated roof plus several edge
    //quads), so the count there is +2 or +3 and a single -1 leaves it filled.
    //
    //A clip settles it in one operation for the layer: a binary stencil, unlike a mask, which blends alpha over the
    //whole layer and is far too slow here. Even-odd does the rest for free: rect (1), a footprint makes 2 (even ->
    //cut), a courtyard ring makes 3 (odd -> kept), so yards still catch the shade of the walls around them.
    return { opacity: (shadowOpacity * fade).toFixed(3), color: shadowColor, clip, casts };
}

//A vertical plane separating two prisms, as `n . p = c`, with prism i on the low side and j on the high side.
interface SepPlane
{
    i:  number;
    j:  number;
    nx: number;
    ny: number;
    c:  number;
}

//Two outlines count as separated even when they MEET on the plane, and even when hand-drawn data laps them over it
//by this much. Demanding a strict gap would reject every terraced pair (they touch, so maxA == minB), which is
//exactly the pair that needs an order most.
const SEP_TOL_M = 0.25;
//Past this, a pair's depths are far enough apart that the depth key already orders them right, so testing them
//would only cost time. Only NEIGHBOURS interleave.
const SEP_RANGE_M = 150;

//Separating axis between two outlines, normalised so A sits on `n . p <= c` and B on `n . p >= c`. Null when none
//exists, which is the one case where no order can be right.
//
//Candidate axes come from the REAL outlines, not their convex hulls: a hull projects onto an axis exactly like the
//polygon it wraps, so it adds nothing to the test and only offers fewer axes to try.
function findSeparatingAxis(a: Point[], b: Point[]): { nx: number; ny: number; c: number } | null
{
    for (const ring of [a, b])
    {
        for (let k = 0; k < ring.length; k++)
        {
            const p0 = ring[k];
            const p1 = ring[(k + 1) % ring.length];
            let nx = -(p1[1] - p0[1]);
            let ny = p1[0] - p0[0];
            const len = Math.hypot(nx, ny);
            if (len < 1e-9)
            {
                continue;
            }
            nx /= len;
            ny /= len;
            let minA = Infinity; let maxA = -Infinity;
            let minB = Infinity; let maxB = -Infinity;
            for (const q of a)
            {
                const d = q[0] * nx + q[1] * ny; if (d < minA)
                {
                    minA = d;
                } if (d > maxA)
                {
                    maxA = d;
                }
            }
            for (const q of b)
            {
                const d = q[0] * nx + q[1] * ny; if (d < minB)
                {
                    minB = d;
                } if (d > maxB)
                {
                    maxB = d;
                }
            }
            if (maxA <= minB + SEP_TOL_M)
            {
                return { nx, ny, c: (maxA + minB) / 2 };
            }
            if (maxB <= minA + SEP_TOL_M)
            {
                return { nx: -nx, ny: -ny, c: -(minA + maxB) / 2 };
            }
        }
    }
    return null;
}

//Vertical planes separating each neighbouring pair of prisms.
//
//Ranking prisms by ONE number cannot be right: a long block pointing at the camera owns a very near vertex, so it
//scores near AS A WHOLE and paints over a small building standing in front of its far end. No single key can say
//"in front of that end, behind this one". But two prisms a vertical plane separates can never interleave: they
//stand on one ground plane and rise straight up, so the one on the camera's side is in front, full stop.
//
//The plane depends only on the FOOTPRINTS, never on the camera, so it is found once and cached; each frame only
//asks which side the eye falls on.
const _sepCache = new WeakMap<Building[], SepPlane[]>();

function separatingPlanes(buildings: Building[]): SepPlane[]
{
    const cached = _sepCache.get(buildings);
    if (cached)
    {
        return cached;
    }
    const out: SepPlane[] = [];
    for (let i = 0; i < buildings.length; i++)
    {
        for (let j = i + 1; j < buildings.length; j++)
        {
            if (Math.hypot(buildings[i].centerX - buildings[j].centerX,
                buildings[i].centerY - buildings[j].centerY) > SEP_RANGE_M)
            {
                continue;
            }
            const axis = findSeparatingAxis(buildings[i].footprint, buildings[j].footprint);
            if (axis)
            {
                out.push({ i, j, nx: axis.nx, ny: axis.ny, c: axis.c });
            }
        }
    }
    _sepCache.set(buildings, out);
    return out;
}

//The eye, dropped onto the ground, in local metres. project3 is a pinhole at cameraZ = PERSPECTIVE, so inverting
//its bearing/tilt basis puts the eye back in world terms, which is all a plane needs to be asked about.
function eyeGroundPoint(cam: SceneCamera): { e: number; n: number }
{
    const t = cam.tiltDeg * DEG;
    const b = cam.bearingDeg * DEG;
    const s = cam.pxPerMetre || 1;
    return {
        e:  (PERSPECTIVE * Math.sin(t) * Math.sin(b)) / s,
        n: -(PERSPECTIVE * Math.sin(t) * Math.cos(b)) / s,
    };
}

//Order the visible prisms far-to-near: a topological sort of "who must be painted before whom", seeded by the
//separating planes and falling back to the depth key wherever they say nothing (or contradict each other, which a
//ring of three prisms can still do). Order only: no geometry is touched, so the worst case is the plain depth-key order.
export function paintOrder(cam: SceneCamera, buildings: Building[], visible: { index: number; depth: number }[]): { index: number }[]
{
    if (visible.length < 2)
    {
        return visible;
    }
    const slot = new Map<number, number>();
    visible.forEach((v, k) => slot.set(v.index, k));

    const after: number[][] = visible.map(() => []);
    const indeg: number[]   = visible.map(() => 0);
    const eye = eyeGroundPoint(cam);

    for (const plane of separatingPlanes(buildings))
    {
        const a = slot.get(plane.i);
        const b = slot.get(plane.j);
        if (a === undefined || b === undefined)
        {
            continue;
        }
        //Whichever side the eye is on is in front, so it paints LAST.
        const side = eye.e * plane.nx + eye.n * plane.ny;
        const far  = side < plane.c ? b : a;
        const near = side < plane.c ? a : b;
        after[far].push(near);
        indeg[near] += 1;
    }

    //Kahn, always taking the FARTHEST of the currently unblocked prisms, so the natural depth order survives
    //wherever the planes leave a choice.
    const out: { index: number }[] = [];
    const done = visible.map(() => false);
    while (out.length < visible.length)
    {
        let pick = -1;
        for (let k = 0; k < visible.length; k++)
        {
            if (done[k] || indeg[k] > 0)
            {
                continue;
            }
            if (pick < 0 || visible[k].depth < visible[pick].depth)
            {
                pick = k;
            }
        }
        if (pick < 0)
        {
            //A cycle: three prisms can each be in front of the next. Nothing can order them, so take the farthest
            //still standing and carry on rather than dropping the rest.
            for (let k = 0; k < visible.length; k++)
            {
                if (done[k])
                {
                    continue;
                }
                if (pick < 0 || visible[k].depth < visible[pick].depth)
                {
                    pick = k;
                }
            }
        }
        if (pick < 0)
        {
            break;
        }
        done[pick] = true;
        out.push({ index: visible[pick].index });
        for (const nx of after[pick])
        {
            indeg[nx] -= 1;
        }
    }
    return out;
}

//Extrude + paint the buildings far to near. `altitude` is the sun altitude (deg) for the time-of-day tint;
//`growth` in [0,1] animates the prisms rising. `neighborOpacity` (0..1) sets how solid the surrounding
//(non-home) prisms read. `home` customises the home prism only (colour, growth multiplier).
export function renderBuildings(
    cam:             SceneCamera,
    buildings:       Building[],
    altitude:        number,
    palette:         ScenePalette,
    growth:          number,
    neighborOpacity = 0.25,
    home:            HomeAppearance = {},
    //Degrees from north, clockwise. Without it a wall cannot know whether it faces the light.
    sunAzimuth       = 180
): SceneShape[]
{
    //Horizontal direction TOWARDS the sun, and how much sun there is to give. The fade tracks the shadows' own, so
    //facades stop catching light exactly as the shade stops being cast: at dawn and dusk everything falls to
    //ambient together instead of the walls staying lit over shadowless ground.
    const sunE    = Math.sin(sunAzimuth * DEG);
    const sunN    = Math.cos(sunAzimuth * DEG);
    const sunFade = Math.max(0, Math.min(1, altitude / SHADOW_FADE_DEG));
    const nearCull = PERSPECTIVE * (1 - NEAR_PLANE);
    const rect     = cardClipRect(cam.width, cam.height);
    const visible = buildings
        .map((b, index) =>
        {
            const c = cam.project3(b.centerX, b.centerY, 0);
            //Order by the building's NEAREST footprint vertex (max cameraZ), not its centre: a big building
            //behind a small one in front has a nearer centre yet must draw FIRST, which a centroid sort breaks.
            let near = -Infinity;
            for (const p of b.footprint)
            {
                const d = cam.project3(p[0], p[1], 0).depth; if (d > near)
                {
                    near = d;
                }
            }
            return { index, depth: near, cameraZ: c.depth };
        })
        //Near-plane cull: skip buildings at/behind the camera, else their walls smear over the scene.
        .filter((o) => o.cameraZ < nearCull);

    //Far-to-near, settled pairwise rather than by ranking each prism on one number (see separatingPlanes).
    const order = paintOrder(cam, buildings, visible);

    //Neighbours are altitude-tinted like the home + the ground, so the whole scene grades through the day/night
    //cycle together. They paint a touch darker on the walls than the roof for shading, at the user-set
    //neighborOpacity baked into each face's own fill/stroke as rgba (see faces below): not a wrapping <g opacity>,
    //because the home paints in true depth order interleaved with neighbours, so no single contiguous group can
    //hold every neighbour face.
    const nb       = buildingColor(palette.neighbor, altitude);
    //A wall reads between AMBIENT (turned away from the sun, lit only by the sky) and LIT (square on to it): one
    //flat tint would make a block look the same from every side, with no direction to the scene.
    const nbAmbient = mixHex(nb, '#000000', 0.34);
    const nbLit     = mixHex(nb, '#000000', 0.04);
    const nbStroke  = mixHex(nb, '#000000', 0.30);
    const neighborOp = Math.max(0, Math.min(1, neighborOpacity));

    //One face list for EVERY building, home included: the scene paints by true depth, so a neighbour nearer the
    //camera than the home occludes it exactly as it would occlude another neighbour, and a farther one still
    //sits behind. `order` (paintOrder, already a global far-to-near topological sort) decides insertion order;
    //the stable sort below only re-settles it by the finer per-face depth, so a tie between two faces (touching
    //buildings sharing a wall depth exactly) keeps the topological order's answer instead of an arbitrary one.
    const faces: { depth: number; shape: SceneShape; detail?: SceneShape }[] = [];
    for (const { index } of order)
    {
        const b  = buildings[index];
        //Every ring of the block: the outline plus any courtyard. A hole's walls face into the yard, and the cull
        //below reads the PROJECTED quad, so their opposite winding sorts itself out.
        const rings = simplifiedRings(b);
        const fp    = rings[0];
        //Home prism height carries the extra squash/grow multiplier.
        const h  = b.height * growth * (b.isHome ? (home.growth ?? 1) : 1);

        //Single solid prism: one base ring and one roof ring, one full-height wall quad per edge.
        const homeBase    = home.color ?? palette.home;
        const wallAmbient = b.isHome ? mixHex(homeBase, '#000000', 0.38) : nbAmbient;
        const wallLit     = b.isHome ? mixHex(homeBase, '#000000', 0.06) : nbLit;
        //Roof + edge stroke follow the solid colour; the home keeps a brightened edge so it reads as the focal building.
        const topColor = home.color ?? palette.home;
        const roofFill = b.isHome
            ? tintedRgba(mixHex(topColor, '#ffffff', 0.18), altitude, 0.92)
            : rgbaHex(nb, neighborOp);
        let stroke = rgbaHex(nbStroke, neighborOp);
        if (b.isHome)
        {
            const eg = mixHex(home.color ?? palette.home, '#ffffff', 0.5);
            stroke   = `rgba(${hexByte(eg, 1)},${hexByte(eg, 3)},${hexByte(eg, 5)},0.1)`;
        }
        const strokeW   = b.isHome ? '1' : '0.4';
        const roofStrokeW = b.isHome ? '1' : '0.6';

        //Emit each visible wall into the shared face list (sorted globally below), for every ring of the block.
        //Every vertex is projected ONCE per frame, base and roof, and the depth comes along with the pixel: the
        //wall sort key and the roof (ring, depth) read the same projections rather than running them again.
        const roofRings: Point[][] = [];
        let roofDepth = -Infinity;
        for (const ring of rings)
        {
            const n     = ring.length;
            const pBase: ProjectedPoint[] = new Array(n);
            const pRoof: ProjectedPoint[] = new Array(n);
            const rBase: Point[] = new Array(n);
            const rRoof: Point[] = new Array(n);
            for (let i = 0; i < n; i++)
            {
                const pb = cam.project3(ring[i][0], ring[i][1], 0);
                const pr = cam.project3(ring[i][0], ring[i][1], h);
                pBase[i] = pb; rBase[i] = [pb.x, pb.y];
                pRoof[i] = pr; rRoof[i] = [pr.x, pr.y];
            }
            roofRings.push(rRoof);
            if (ring === fp)
            {
                for (const pr of pRoof)
                {
                    if (pr.depth > roofDepth)
                    {
                        roofDepth = pr.depth;
                    }
                }
            }
            for (let i = 0; i < n; i++)
            {
                const next = (i + 1) % rBase.length;
                const p0 = rBase[i];
                const p1 = rBase[next];
                const p2 = rRoof[next];
                const p3 = rRoof[i];
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
                //How square-on to the sun does this wall stand? The outward normal falls out of the winding: rings run
                //counter-clockwise with the solid on their left (a courtyard runs the other way, and so its normal
                //turns into the yard, which is exactly right). Lambert, clamped: a wall turned away gets no sun, never
                //negative light.
                const ex = ring[next][0] - ring[i][0];
                const ey = ring[next][1] - ring[i][1];
                const el = Math.hypot(ex, ey) || 1;
                const lit = Math.max(0, (ey / el) * sunE + (-ex / el) * sunN) * sunFade;
                const shade = mixHex(wallAmbient, wallLit, lit);
                const wallFill = b.isHome ? tintedRgba(shade, altitude, 0.9) : rgbaHex(shade, neighborOp);
                //One full-height wall quad per edge, clipped to the card box so an off-card wall never enlarges the
                //scene layer (see .scene-svg). The back-face cull above reads the true quad.
                const wq = clipPolygon([p0, p1, p2, p3], rect);
                if (wq.length < 3)
                {
                    continue;
                }
                const wall: SceneShape = { tag: 'polygon', geom: pointsAttr(wq), fill: wallFill, stroke, strokeWidth: strokeW };
                //Sort key = the wall's NEAREST corner (max cameraZ, larger = nearer). On a concave footprint an
                //edge-midpoint depth mis-orders two facing walls; the nearest-point does not.
                const wallDepth = Math.max(pBase[i].depth, pBase[next].depth, pRoof[i].depth, pRoof[next].depth);
                faces.push({ depth: wallDepth, shape: wall });
            }
        }
        //Flat roof at its own nearest-corner depth (the outer ring's, gathered above). It sits at the top so in any
        //above-horizon view it never overlaps a wall in screen space, so its order against walls is cosmetic;
        //depth-placing it just keeps a nearer building's roof correctly over a farther one.
        //Roof as ONE path over every ring, even-odd, so a courtyard stays a hole instead of being filled in.
        //Rings are clipped to the card box; even-odd keeps the same parity for any point within it.
        const roofPath = ringsPath(roofRings, rect);
        //The outlines of the buildings this block merged, laid flat ON the roof. They sit on the roof plane, so
        //they can never fight it for depth: the terrace reads as separate houses at no cost.
        const detailPath = ringsPath((b.detail ?? []).map((ring) => ring.map((p) => cam.project(p[0], p[1], h))), rect);
        const roof: SceneShape | undefined = roofPath
            ? { tag: 'path', geom: roofPath, fill: roofFill, fillRule: 'evenodd', stroke, strokeWidth: roofStrokeW }
            : undefined;
        const detail: SceneShape | undefined = detailPath
            ? { tag: 'path', geom: detailPath, fill: 'none', stroke, strokeWidth: roofStrokeW }
            : undefined;
        //The detail rides the roof's depth slot (right after it); a roofless block off the card can still
        //keep an on-card outline.
        if (roof)
        {
            faces.push({ depth: roofDepth, shape: roof, detail });
        }
        else if (detail)
        {
            faces.push({ depth: roofDepth, shape: detail });
        }
    }
    //One stable sort, far-to-near, over every face from every building, so a nearer neighbour occludes the home
    //and a farther one stays behind it. Stable, so exact ties fall back to `order`'s insertion sequence.
    faces.sort((a, c) => a.depth - c.depth);
    const out: SceneShape[] = [];
    for (const f of faces)
    {
        out.push(f.shape);
        if (f.detail)
        {
            out.push(f.detail);
        }
    }
    return out;
}

//---------------------------------------------------------------------------------------------------------
//Footprint geometry helpers. Kept local to the building painters, their only consumers.

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

//A building's footprint/holes are invariant between data re-interprets, but renderBuildings runs every camera
//frame during pan/orbit; mirrors separatingPlanes' own WeakMap cache (above) for the same reason: simplify each
//building's rings once, not every frame.
const _simplifyCache = new WeakMap<Building, Point[][]>();

function simplifiedRings(b: Building): Point[][]
{
    const cached = _simplifyCache.get(b);
    if (cached)
    {
        return cached;
    }
    const rings = [simplifyFootprint(b.footprint), ...(b.holes ?? []).map(simplifyFootprint)];
    _simplifyCache.set(b, rings);
    return rings;
}

