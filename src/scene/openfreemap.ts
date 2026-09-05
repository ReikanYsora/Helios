//OpenFreeMap buildings source: fetches the vector tiles covering a radius around the home, decodes their `building`
//layer, and returns every footprint ring in lon/lat plus its real height. The caller (buildings.ts) converts these
//to the option-independent RawBuilding[] contract, so this module owns only the network + tile geometry.
//
//Tiles are Web Mercator at OFM_TILE_ZOOM; a point at tile-local pixel (px, py) in [0, extent] maps back to lon/lat
//through the standard slippy-map inverse. The planet snapshot rotates, so the versioned tile URL template is read
//once from the TileJSON and cached.

import { decodeVectorTile } from './vector-tile';
import { lonLatToTile as lonLatToTileTuple } from './tiles';
import { DEG, METRES_PER_DEGREE, OFM_TILEJSON_URL, OFM_TILE_ZOOM, OFM_FETCH_TIMEOUT_MS, BUILDING_CACHE_TTL_MS } from '../core/config/constants';

//One footprint ring from a tile: vertices in [lon, lat], plus the OSM render height (m) or null when untagged.
export interface OfmRing
{
    lonLat:  [number, number][];
    heightM: number | null;
}


//Cached versioned tile URL template from the TileJSON (`.../planet/<snapshot>/{z}/{x}/{y}.pbf`). Refreshed on the
//same 30-day cadence as the building cache, so a rotated snapshot is picked up without ever blocking a fetch.
let _template   = '';
let _templateAt = 0;

//fetch has no native timeout; a local controller carries both the caller's abort (location change) and a deadline.
export async function fetchWithWatchdog(url: string, signal?: AbortSignal): Promise<Response>
{
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    if (signal?.aborted)
    {
        controller.abort();
    }
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => controller.abort(), OFM_FETCH_TIMEOUT_MS);
    try
    {
        return await fetch(url, { referrerPolicy: 'no-referrer', signal: controller.signal });
    }
    finally
    {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
    }
}

export async function resolveTemplate(signal?: AbortSignal): Promise<string | null>
{
    if (_template && Date.now() - _templateAt < BUILDING_CACHE_TTL_MS)
    {
        return _template;
    }
    const res = await fetchWithWatchdog(OFM_TILEJSON_URL, signal);
    if (!res.ok)
    {
        return null;
    }
    const tj = (await res.json()) as { tiles?: unknown };
    const t  = Array.isArray(tj.tiles) ? tj.tiles[0] : undefined;
    if (typeof t === 'string' && t.includes('{z}'))
    {
        _template   = t;
        _templateAt = Date.now();
        return t;
    }
    return null;
}


//Longitude/latitude to fractional tile coordinates at zoom z (slippy-map forward transform). The projection math
//lives in tiles.ts; this just wraps its tuple into the {x, y} shape this module's callers use.
export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number }
{
    const [x, y] = lonLatToTileTuple(lon, lat, z);
    return { x, y };
}

//Tile-local pixel (0..extent) in tile (tx, ty) back to lon/lat (slippy-map inverse). Buffered vertices sit slightly
//outside [0, extent]; the maths still holds, they just resolve just past the tile edge.
export function tilePixelToLonLat(tx: number, ty: number, px: number, py: number, extent: number, z: number): { lon: number; lat: number }
{
    const n  = 2 ** z;
    const wx = tx + px / extent;
    const wy = ty + py / extent;
    return {
        lon: (wx / n) * 360 - 180,
        lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * wy) / n))) * 180) / Math.PI,
    };
}

//Real building height from the tile tags: OFM pre-computes `render_height` (m). Null when absent or non-positive so
//the caller applies its own fallback.
function ringHeight(tags: Record<string, string | number>): number | null
{
    const h = tags.render_height;
    return typeof h === 'number' && Number.isFinite(h) && h > 0 ? h : null;
}

//Does this tile OWN the ring, i.e. does the ring's centroid fall inside the tile's own cell rather than in the
//buffer? Tile-local coordinates run 0..extent across the cell, and buffered geometry sits outside that span.
function tileOwnsRing(ring: number[][], extent: number): boolean
{
    let cx = 0;
    let cy = 0;
    for (const [px, py] of ring)
    {
        cx += px;
        cy += py;
    }
    cx /= ring.length;
    cy /= ring.length;
    return cx >= 0 && cx < extent && cy >= 0 && cy < extent;
}

//Shoelace signed area of a ring in tile-local coordinates. Positive = exterior ring, negative = interior (hole).
function ringSignedArea(ring: number[][]): number
{
    let area = 0;
    for (let i = 0; i < ring.length; i++)
    {
        const n = (i + 1) % ring.length;
        area += ring[i][0] * ring[n][1] - ring[n][0] * ring[i][1];
    }
    return area;
}


//Fetch every building footprint ring within `radiusM` of the home. Returns null on a total outage (no template, or
//no tile answered), the rings otherwise ([] = the area genuinely has no mapped buildings). The caller's AbortError
//(location change) propagates; per-tile watchdog timeouts do not, they just skip that tile.
export async function fetchOfmBuildingRings(
    homeLat: number,
    homeLon: number,
    radiusM: number,
    signal?: AbortSignal
): Promise<OfmRing[] | null>
{
    const template = await resolveTemplate(signal);
    if (!template)
    {
        return null;
    }

    const z      = OFM_TILE_ZOOM;
    const perLon = METRES_PER_DEGREE * Math.cos(homeLat * DEG);
    const dLat   = radiusM / METRES_PER_DEGREE;
    const dLon   = radiusM / perLon;
    //Tile index range spanning the home +/- radius bounding box. A z14 tile is ~2.4 km, so the 250 m maximum
    //takes 1-4 tiles, fetched sequentially.
    const nw = lonLatToTile(homeLon - dLon, homeLat + dLat, z);
    const se = lonLatToTile(homeLon + dLon, homeLat - dLat, z);
    const x0 = Math.floor(nw.x);
    const x1 = Math.floor(se.x);
    const y0 = Math.floor(nw.y);
    const y1 = Math.floor(se.y);

    const rings: OfmRing[] = [];
    let anyOk = false;

    /* eslint-disable no-await-in-loop -- tiles are fetched sequentially so one abort cancels the rest cleanly */
    for (let tx = x0; tx <= x1; tx++)
    {
        for (let ty = y0; ty <= y1; ty++)
        {
            const url = template.replace('{z}', String(z)).replace('{x}', String(tx)).replace('{y}', String(ty));
            try
            {
                const res = await fetchWithWatchdog(url, signal);
                if (!res.ok)
                {
                    throw new Error(String(res.status));
                }
                const buf   = new Uint8Array(await res.arrayBuffer());
                const layer = decodeVectorTile(buf).find((l) => l.name === 'building');
                anyOk = true;
                if (layer)
                {
                    for (const feature of layer.features)
                    {
                        const heightM = ringHeight(feature.tags);
                        for (const ring of feature.rings)
                        {
                            if (ring.length < 3)
                            {
                                continue;
                            }
                            //Keep exterior rings only. Per the MVT spec, an exterior ring has a positive tile-space
                            //signed area and an interior ring (a courtyard/atrium hole) a negative one; drawing the
                            //holes as prisms would litter the scene with phantom buildings.
                            if (ringSignedArea(ring) <= 0)
                            {
                                continue;
                            }
                            //Tile ownership: every tile repeats its neighbours' geometry inside a ~37 m buffer, so
                            //one building arrives from up to four tiles, whole from the one it sits in and clipped by
                            //the others. Keeping them all stacks coincident prisms (no valid painter order: flicker,
                            //a false wall across roofs at tile borders); keeping a ring only from the tile whose cell
                            //contains its centroid delivers every building once and whole. A buffer is for joins,
                            //not for drawing.
                            if (!tileOwnsRing(ring, layer.extent))
                            {
                                continue;
                            }
                            rings.push({
                                lonLat:  ring.map(([px, py]) =>
                                {
                                    const ll = tilePixelToLonLat(tx, ty, px, py, layer.extent, z);
                                    return [ll.lon, ll.lat];
                                }),
                                heightM,
                            });
                        }
                    }
                }
            }
            catch (err)
            {
                //Caller's abort (location change) propagates so a rapid move cancels cleanly; a watchdog timeout
                //raises the same AbortError name but falls through to the next tile.
                if ((err as { name?: string })?.name === 'AbortError' && signal?.aborted)
                {
                    throw err;
                }
                //Tile failed (timeout / HTTP error): skip it; the others still contribute their buildings.
            }
        }
    }
    /* eslint-enable no-await-in-loop */

    return anyOk ? rings : null;
}
