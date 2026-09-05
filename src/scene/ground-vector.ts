//Vector ground data source: fetches the OpenFreeMap vector tiles covering the ground area around the home and
//decodes the paintable ground layers (water, greenery, land use, roads, boundaries, building footprints) into
//lon/lat geometry, tagged by layer + class. The painter (ground-render.ts) turns these into the basemap canvas.
//Shares the tile plumbing with the 3D buildings.
//
//OpenFreeMap tops out at z14; the geometry is resolution-independent, so z14 detail (the same the buildings use)
//is painted at the ground canvas's own scale. Pure aside from the fetch.

import { OFM_TILE_ZOOM, METRES_PER_DEGREE, DEG } from '../core/config/constants';
import { decodeVectorTile } from './vector-tile';
import { resolveTemplate, fetchWithWatchdog, lonLatToTile, tilePixelToLonLat } from './openfreemap';

//OpenMapTiles polygon/line layers worth painting on the ground. Everything else (labels, POIs, place/house
//numbers, peaks) is point data with no ground presence and is skipped.
const GROUND_LAYERS = new Set([
    'water', 'waterway', 'landcover', 'landuse', 'park', 'transportation', 'aeroway', 'boundary', 'building',
]);

//One decoded ground feature: its source layer + class tag, whether it is a line (stroke) or polygon (fill), and
//its rings/paths in [lon, lat]. Polygon features keep all rings (exterior + holes) so the painter can fill
//even-odd; line features keep each path.
export interface GroundFeature
{
    layer:  string;
    cls:    string;
    line:   boolean;
    lonLat: [number, number][][];
}

//Fetch + decode every paintable ground feature within `radiusM` of the home. Returns null on a total outage
//(no template or no tile answered) so the caller can fall back; [] means the area genuinely has no ground data.
//The caller's abort (a location change) propagates; a per-tile watchdog timeout just skips that tile.
export async function fetchGroundVector(
    homeLat: number,
    homeLon: number,
    radiusM: number,
    signal?: AbortSignal,
): Promise<GroundFeature[] | null>
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
    //Tile index range spanning the home +/- radius bounding box (1-4 tiles at z14).
    const nw = lonLatToTile(homeLon - dLon, homeLat + dLat, z);
    const se = lonLatToTile(homeLon + dLon, homeLat - dLat, z);
    const x0 = Math.floor(nw.x);
    const x1 = Math.floor(se.x);
    const y0 = Math.floor(nw.y);
    const y1 = Math.floor(se.y);

    const out: GroundFeature[] = [];
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
                const buf = new Uint8Array(await res.arrayBuffer());
                //Only count the tile as decoded once decodeVectorTile returns: a garbage 200 (captive portal, proxy
                //error page) throws here, and must leave anyOk false so the caller gets null, not an empty [].
                const layers = decodeVectorTile(buf);
                anyOk = true;
                for (const layer of layers)
                {
                    if (!GROUND_LAYERS.has(layer.name))
                    {
                        continue;
                    }
                    for (const feature of layer.features)
                    {
                        if (feature.type === 1)
                        {
                            continue;
                        } //points have no ground presence
                        const line   = feature.type === 2;
                        const minPts = line ? 2 : 3;
                        const lonLat = feature.rings
                            .filter((ring) => ring.length >= minPts)
                            .map((ring) => ring.map(([px, py]): [number, number] =>
                            {
                                const ll = tilePixelToLonLat(tx, ty, px, py, layer.extent, z);
                                return [ll.lon, ll.lat];
                            }));
                        if (lonLat.length)
                        {
                            out.push({ layer: layer.name, cls: String(feature.tags.class ?? ''), line, lonLat });
                        }
                    }
                }
            }
            catch (err)
            {
                //Caller's abort (location change) propagates; a watchdog timeout raises the same AbortError name
                //but falls through to the next tile.
                if ((err as { name?: string })?.name === 'AbortError' && signal?.aborted)
                {
                    throw err;
                }
            }
        }
    }
    /* eslint-enable no-await-in-loop */

    return anyOk ? out : null;
}
