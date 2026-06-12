//Self-sourced building footprints around the home.
//
//Rendering buildings through OpenFreeMap's full vector basemap as a
//single fill-extrusion layer forces MapLibre to draw every building
//in the viewport at every frame. In dense urban areas that's
//several thousand extrusions per frame, visible jank on mobile and
//heavy battery drain. Filtering after-the-fact via MapLibre paint
//expressions (distance, feature-state) produces flicker and
//inconsistent opacities at tile boundaries because the geometry is
//clipped per tile, so a building that spans two tiles renders as
//two features with independently-evaluated paint properties.
//
//The fix is architectural: we fetch the OpenFreeMap planet vector
//tiles ourselves once at startup (only the 1–4 tiles that cover
//the radius around the home), decode them with @mapbox/vector-tile,
//filter features by distance, identify the polygon(s) that make up
//the home, and emit TWO GeoJSON FeatureCollections that the engine
//feeds into two distinct fill-extrusion layers:
//
//  - helios-buildings-home          : home polygon(s) at full opacity
//  - helios-buildings-surroundings  : neighbours at configured opacity
//
//Tiles are fetched once per (home, radius, cluster) tuple: the home
//doesn't move during a session, so there is no listener on pan/zoom.
//Style reloads (theme switches) reuse the cached GeoJSON without
//re-hitting OpenFreeMap.
//
//OpenFreeMap exposes the OpenMapTiles schema, which carries the `building` source-layer with `render_height` and `render_min_height` properties. The
//parsing pipeline only needs those two attributes plus the polygon geometry.

import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

export interface BuildingsResult
{
    home:         GeoJSON.FeatureCollection;
    surroundings: GeoJSON.FeatureCollection;
}

export interface FetchBuildingsOptions
{
    homeLon:              number;
    homeLat:              number;
    radiusMeters:         number;
    //Cluster radius (m). Every building whose centroid sits within
    //this radius, OR which contains the home point, is grouped
    //into the "home" feature collection at full opacity. Allows
    //attached verandas / outbuildings to read as one with the main
    //house. 0 = legacy single-polygon home behaviour.
    clusterRadiusMeters?: number;
    //Tile zoom level to fetch. OpenMapTiles (the schema OpenFreeMap
    //serves) carries the `building` source-layer with `render_height`
    //from z=13 upward, capped at z=14 for the planet tileset. z=14
    //keeps the tile count to 1 (rarely 2) for radii under ~500 m,
    //the smallest network footprint while still giving us proper
    //extrusion heights.
    zoom?:                number;
    signal?:              AbortSignal;
}

const EARTH_RADIUS_M    = 6_371_008.8;
const HOME_FALLBACK_M   = 30;   //If no polygon contains the home point, pick
                                //the nearest one within this radius. Covers the common case where HA's home latitude lands in a garden a few metres
                                //off the actual building.


function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number }
{
    const n      = Math.pow(2, z);
    const latRad = lat * Math.PI / 180;
    const x      = Math.floor((lon + 180) / 360 * n);
    const y      = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number
{
    const toRad = Math.PI / 180;
    const dLat  = (lat2 - lat1) * toRad;
    const dLon  = (lon2 - lon1) * toRad;
    const a     = Math.sin(dLat / 2) ** 2
                + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad)
                * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

//Convert a degree delta in latitude / longitude to metres at a given latitude. Used to expand the home point into a bbox before mapping it to tile
//indices.
function metersToDegLat(m: number): number
{
    return m / 111_320;
}

function metersToDegLon(m: number, atLat: number): number
{
    return m / (111_320 * Math.cos(atLat * Math.PI / 180));
}


//Ray-casting point-in-polygon for a single ring (lon,lat pairs).
//Returns true if (lon, lat) is strictly inside or on the boundary.
function pointInRing(lon: number, lat: number, ring: number[][]): boolean
{
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > lat) !== (yj > lat))
                       && (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi);
        if (intersect)
        {
            inside = !inside;
        }
    }
    return inside;
}

//A GeoJSON Polygon is [outer, hole1, hole2, ...]; a MultiPolygon is
//an array of those. We treat the home check as "point is in the
//outer ring of any polygon". Holes are ignored, a building polygon
//with a courtyard still counts as containing the home point if the
//home sits anywhere within the outer footprint.
function polygonContains(geom: GeoJSON.Geometry, lon: number, lat: number): boolean
{
    if (geom.type === 'Polygon')
    {
        return geom.coordinates.length > 0 && pointInRing(lon, lat, geom.coordinates[0] as number[][]);
    }
    if (geom.type === 'MultiPolygon')
    {
        return geom.coordinates.some(poly => poly.length > 0 && pointInRing(lon, lat, poly[0] as number[][]));
    }
    return false;
}

//Centroid approximation: average of outer-ring vertices. Used only
//for the radius filter, exact centroids aren't necessary, we just
//need a "representative" point per building. For MultiPolygon we
//take the centroid of the first polygon's outer ring; close enough
//for filter purposes (a building rendered as a MultiPolygon is rare
//and the parts are always adjacent).
function representativePoint(geom: GeoJSON.Geometry): [number, number] | null
{
    let ring: number[][] | null = null;
    if (geom.type === 'Polygon' && geom.coordinates.length > 0)
    {
        ring = geom.coordinates[0] as number[][];
    }
    else if (geom.type === 'MultiPolygon' && geom.coordinates.length > 0 && geom.coordinates[0].length > 0)
    {
        ring = geom.coordinates[0][0] as number[][];
    }
    if (!ring || ring.length === 0)
    {
        return null;
    }
    let sx = 0, sy = 0;
    for (const p of ring) { sx += p[0]; sy += p[1]; }
    return [sx / ring.length, sy / ring.length];
}


//OpenFreeMap publishes its planet vector tiles under a versioned
//snapshot path that rotates every few weeks. The TileJSON at
///planet exposes the current snapshot's tile URL template; we fetch
//it once per page lifetime and cache the result so subsequent
//building pulls (radius / cluster changes) skip the round-trip.
const OFM_TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
let _ofmTileTemplate:        string | null = null;
let _ofmTileTemplateInflight: Promise<string | null> | null = null;

async function getOpenFreeMapTileTemplate(signal?: AbortSignal): Promise<string | null>
{
    if (_ofmTileTemplate)
    {
        return _ofmTileTemplate;
    }
    if (_ofmTileTemplateInflight)
    {
        return _ofmTileTemplateInflight;
    }

    _ofmTileTemplateInflight = (async (): Promise<string | null> =>
    {
        try
        {
            const resp = await fetch(OFM_TILEJSON_URL, { signal });
            if (!resp.ok)
            {
                return null;
            }
            const tj   = await resp.json() as { tiles?: string[] };
            const url  = Array.isArray(tj.tiles) && tj.tiles.length > 0 ? tj.tiles[0] : null;
            if (!url)
            {
                return null;
            }
            _ofmTileTemplate = url;
            return url;
        }
        catch (_)
        {
            return null;
        }
        finally
        {
            _ofmTileTemplateInflight = null;
        }
    })();
    return _ofmTileTemplateInflight;
}


export async function fetchBuildingsAroundHome(opts: FetchBuildingsOptions): Promise<BuildingsResult>
{
    const z          = Math.max(0, Math.floor(opts.zoom ?? 14));
    const r          = Math.max(1, opts.radiusMeters);
    const cluster    = Math.max(0, opts.clusterRadiusMeters ?? 0);

    //Bounding box around the home in degrees, derived from the radius. We over-estimate by a few percent so a building whose centroid is *just*
    //outside the bbox but whose actual nearest corner is inside the radius still gets fetched. The wasted features are filtered out at the haversine
    //step below.
    const padFactor  = 1.15;
    const dLat       = metersToDegLat(r * padFactor);
    const dLon       = metersToDegLon(r * padFactor, opts.homeLat);
    const minLat     = opts.homeLat - dLat;
    const maxLat     = opts.homeLat + dLat;
    const minLon     = opts.homeLon - dLon;
    const maxLon     = opts.homeLon + dLon;

    //Tile range covering the bbox. Note Y is inverted (north-up).
    const tlTile = lonLatToTile(minLon, maxLat, z);
    const brTile = lonLatToTile(maxLon, minLat, z);
    const xMin   = Math.min(tlTile.x, brTile.x);
    const xMax   = Math.max(tlTile.x, brTile.x);
    const yMin   = Math.min(tlTile.y, brTile.y);
    const yMax   = Math.max(tlTile.y, brTile.y);

    const tilesToFetch: Array<{ x: number; y: number }> = [];
    for (let x = xMin; x <= xMax; x++)
    {
        for (let y = yMin; y <= yMax; y++)
        {
            tilesToFetch.push({ x, y });
        }
    }

    //Defensive: at very small radii on a tile corner we expect 1–4
    //tiles. Anything larger means radius or zoom is misconfigured;
    //bail rather than hammer the API.
    if (tilesToFetch.length > 16)
    {
        throw new Error(`[HELIOS] fetchBuildingsAroundHome: ${tilesToFetch.length} tiles requested, radius/zoom misconfigured`);
    }

    //Resolve the OpenFreeMap tile URL template once (cached for the
    //page lifetime). The TileJSON returns a versioned snapshot path
    //(.../planet/<YYYYMMDD_NNNNNN_pt>/{z}/{x}/{y}.pbf), and OFM
    //rotates that snapshot every few weeks; hitting the TileJSON at
    //runtime keeps us pointed at whatever the current snapshot is
    //without hard-coding a date that will rot.
    const tileTemplate = await getOpenFreeMapTileTemplate(opts.signal);
    if (!tileTemplate)
    {
        return { home: { type: 'FeatureCollection', features: [] },
                 surroundings: { type: 'FeatureCollection', features: [] } };
    }

    const features: GeoJSON.Feature[] = [];
    await Promise.all(tilesToFetch.map(async ({ x, y }) =>
    {
        const url = tileTemplate
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y));
        let resp: Response;
        try
        {
            resp = await fetch(url, { signal: opts.signal });
        }
        catch (e)
        {
            //Network error → silently skip this tile. Surroundings
            //will be sparser but the card stays usable. Errors are
            //already logged by the browser network panel; flooding
            //the HA console would be noise.
            return;
        }
        if (!resp.ok)
        {
            return;
        }
        let buf: ArrayBuffer;
        try
        {
            buf = await resp.arrayBuffer();
        }
        catch (_)
        {
            return;
        }
        if (buf.byteLength === 0)
        {
            return;
        }

        let tile: VectorTile;
        try
        {
            tile = new VectorTile(new PbfReader(new Uint8Array(buf)));
        }
        catch (_)
        {
            return;
        }
        const layer = tile.layers['building'];
        if (!layer)
        {
            return;
        }

        for (let i = 0; i < layer.length; i++)
        {
            let geojson: GeoJSON.Feature;
            try
            {
                geojson = layer.feature(i).toGeoJSON(x, y, z) as GeoJSON.Feature;
            }
            catch (_)
            {
                continue;
            }
            if (!geojson.geometry)
            {
                continue;
            }

            //Split MultiPolygons into independent Polygon features.
            //OpenMapTiles' vector-tile encoder groups multiple
            //unrelated buildings into a single MultiPolygon feature
            //(observed: 24 sub-polygons in one rural tile). Without
            //splitting, home detection would capture the whole
            //MultiPolygon and render every grouped building at full
            //opacity. Genuine multi-part buildings (L-shaped, multi-
            //wing) render identically because every part shares the
            //same `render_height`.
            if (geojson.geometry.type === 'Polygon')
            {
                //Rebuild as a plain feature. @mapbox/vector-tile's toGeoJSON returns
                //null-prototype `properties`, and maplibre's worker serializer reads
                //`input.constructor._classRegistryKey`, which throws on a null-proto
                //object. The spread + a fresh geometry give a normal prototype (as the
                //MultiPolygon branch below does), so a lone Polygon building, e.g. a
                //small freshly-mapped shed, doesn't blow up the whole buildings source.
                features.push({
                    type:       'Feature',
                    geometry:   { type: 'Polygon', coordinates: geojson.geometry.coordinates as number[][][] },
                    properties: { ...(geojson.properties ?? {}) }
                });
            }
            else if (geojson.geometry.type === 'MultiPolygon')
            {
                for (const polyCoords of geojson.geometry.coordinates)
                {
                    features.push({
                        type:       'Feature',
                        geometry:   { type: 'Polygon', coordinates: polyCoords as number[][][] },
                        properties: { ...(geojson.properties ?? {}) }
                    });
                }
            }
            //Lines / points are skipped silently, not buildings.
        }
    }));

    //Classify each feature into one of three buckets:
    //  - home cluster: contains the home point OR is within
    //    `cluster` metres of it (attached verandas / outbuildings)
    //  - surroundings: within `r` metres but outside the cluster
    //  - discarded: outside `r`
    //
    //If no feature contains the home point and no feature is within the cluster radius, fall back to the closest building within HOME_FALLBACK_M,
    //covers HA coordinates that land on a garden or driveway a few metres off the actual house footprint.
    const homeCluster: GeoJSON.Feature[] = [];
    const surroundings: GeoJSON.Feature[] = [];
    let homeFallback: { feature: GeoJSON.Feature; distance: number } | null = null;

    for (const f of features)
    {
        const contains = polygonContains(f.geometry, opts.homeLon, opts.homeLat);
        const rep      = representativePoint(f.geometry);
        const d        = rep
            ? haversineMeters(opts.homeLat, opts.homeLon, rep[1], rep[0])
            : Infinity;

        if (contains || (cluster > 0 && d <= cluster))
        {
            homeCluster.push(f);
            continue;
        }

        if (rep && d <= HOME_FALLBACK_M
            && (!homeFallback || d < homeFallback.distance))
        {
            homeFallback = { feature: f, distance: d };
        }

        if (d <= r)
        {
            surroundings.push(f);
        }
    }

    //Promote the fallback when no feature was in the cluster.
    if (homeCluster.length === 0 && homeFallback)
    {
        homeCluster.push(homeFallback.feature);
        const idx = surroundings.indexOf(homeFallback.feature);
        if (idx >= 0)
        {
            surroundings.splice(idx, 1);
        }
    }

    return {
        home:         { type: 'FeatureCollection', features: homeCluster },
        surroundings: { type: 'FeatureCollection', features: surroundings }
    };
}
