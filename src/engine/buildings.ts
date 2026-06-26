//Self-sourced building footprints around the home, via the OpenStreetMap Overpass API.
//
//Earlier this module fetched OpenFreeMap planet basemap tiles and decoded their binary building layer,
//which dragged in a tile decoder + a polygon intermediate. The 2.5D renderer only ever needs local-metre
//footprints, so we now query Overpass directly (the same path as the reference "Snapshot" Solar scene
//card) and hand back ready-to-extrude scene Building[].
//
//We ask Overpass for every `way["building"]` and multipolygon `relation["building"]` within the radius,
//convert each ring lat/lon -> local metres (east/north) relative to the home, keep the nearest
//MAX_BUILDINGS COMPLETE footprints, and flag the building that contains the home GPS (else the nearest)
//as isHome. When Overpass yields nothing — offline, both mirrors down, or genuinely no mapped buildings —
//we fall back to a single standard house at the origin so the scene always has a home to draw.
//
//Fetched once per (home, radius) tuple and cached in localStorage (the home doesn't move), so a reload
//doesn't re-hit Overpass. Heights are fixed at FIXED_BUILDING_HEIGHT_M — OSM heights are ignored because
//tall buildings dominate the faux-3D framing and read as walls, not homes.

import { type Building } from '../scene/buildings';
import { type Point } from '../scene/colors';
import {
    FIXED_BUILDING_HEIGHT_M,
    MAX_BUILDINGS,
    FALLBACK_HOUSE_HALF_W,
    FALLBACK_HOUSE_HALF_D,
    BUILDING_CACHE_TTL_MS,
    OVERPASS_RETRY_DELAY_MS,
    OVERPASS_ENDPOINTS,
    DEG,
} from '../constants';

export interface FetchBuildingsOptions
{
    homeLon:      number;
    homeLat:      number;
    radiusMeters: number;
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
function parseBuildings(ways: OverpassWay[], lat: number, lng: number): Building[]
{
    const perLat = 111_320;
    const perLon = 111_320 * Math.cos(lat * DEG);
    const buildings: Building[] = [];

    //Collect outer rings: simple `way` buildings + the outer ring(s) of multipolygon `relation` buildings.
    //Dense cities map whole blocks as relations — without these the home can be missing.
    const rings: { lat: number; lon: number }[][] = [];
    for (const el of ways)
    {
        if (el.type === 'way' && el.geometry)
        {
            rings.push(el.geometry);
        }
        else if (el.type === 'relation' && el.members)
        {
            for (const m of el.members)
            {
                if (m.geometry && (m.role === 'outer' || !m.role))
                {
                    rings.push(m.geometry);
                }
            }
        }
    }

    for (const geometry of rings)
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
        buildings.push({
            footprint,
            height:  FIXED_BUILDING_HEIGHT_M, //OSM heights ignored (tall ones break the framing)
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
    const kept = buildings.slice(0, MAX_BUILDINGS);
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
            const buildings = parseBuildings(data.elements ?? [], lat, lng);
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
