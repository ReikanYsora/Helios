//Self-sourced building footprints around the home.
//
//Drawing OpenFreeMap's full basemap as one fill-extrusion layer makes MapLibre redraw every building in the
//viewport each frame (thousands in dense areas: jank + battery drain), and post-filtering via paint expressions
//flickers because tile-clipped geometry evaluates paint per tile.
//
//So we fetch the OpenFreeMap planet vector tiles ourselves once at startup (just the 1–4 tiles covering the radius),
//decode with @mapbox/vector-tile, filter by distance, find the home polygon(s), and emit TWO GeoJSON
//FeatureCollections fed into two fill-extrusion layers:
//  - helios-buildings-home          : home polygon(s) at full opacity
//  - helios-buildings-surroundings  : neighbours at configured opacity
//
//Fetched once per (home, radius, cluster) tuple — the home doesn't move, so no pan/zoom listener. Style reloads
//(theme switches) reuse the cached GeoJSON.
//
//OpenFreeMap serves the OpenMapTiles schema: the `building` source-layer carries render_height / render_min_height,
//which plus the polygon geometry is all the parser needs.

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
    //Cluster radius (m). Buildings whose centroid sits within it, or which contain the home point, join the "home"
    //collection at full opacity so attached verandas/outbuildings read as one with the house. 0 = single-polygon home.
    clusterRadiusMeters?: number;
    //Tile zoom. OpenMapTiles carries render_height from z=13, capped at z=14 for the planet tileset. z=14 keeps the
    //tile count to 1 (rarely 2) for radii under ~500 m while still giving proper extrusion heights.
    zoom?:                number;
    signal?:              AbortSignal;
}

const EARTH_RADIUS_M    = 6_371_008.8;
//If no polygon contains the home point, pick the nearest within this radius — covers HA's home latitude landing in
//a garden a few metres off the actual building.
const HOME_FALLBACK_M   = 30;


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

//Degree delta per metre at a given latitude — used to expand the home point into a bbox before mapping to tiles.
function metersToDegLat(m: number): number
{
    return m / 111_320;
}

function metersToDegLon(m: number, atLat: number): number
{
    return m / (111_320 * Math.cos(atLat * Math.PI / 180));
}


//Ray-casting point-in-polygon for one ring (lon,lat pairs); true if inside or on the boundary.
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

//Home check = "point is in the outer ring of any polygon". Holes are ignored, so a building with a courtyard still
//counts if the home sits anywhere within the outer footprint.
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

//Centroid approximation (average of outer-ring vertices) — only for the radius filter, so exactness isn't needed.
//For MultiPolygon we use the first polygon's outer ring; its parts are always adjacent, so close enough.
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


//OpenFreeMap rotates its planet tiles under a versioned snapshot path every few weeks. The /planet TileJSON exposes
//the current snapshot's tile URL template; fetched once per page lifetime and cached so later pulls skip the trip.
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

    //Bbox around the home in degrees, over-estimated a few percent so a building whose centroid is just outside but
    //whose nearest corner is inside the radius still gets fetched; the slack is dropped at the haversine step below.
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

    //Defensive: small radii expect 1–4 tiles. More means radius/zoom is misconfigured; bail rather than hammer the API.
    if (tilesToFetch.length > 16)
    {
        throw new Error(`[HELIOS] fetchBuildingsAroundHome: ${tilesToFetch.length} tiles requested, radius/zoom misconfigured`);
    }

    //Resolve the OpenFreeMap tile template once (cached for the page lifetime); keeps us on the current snapshot
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
            //Network error → skip this tile silently; surroundings get sparser but the card stays usable. The browser
            //network panel already logs it, so flooding the HA console would just be noise.
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

            //Split MultiPolygons into independent Polygons: OpenMapTiles groups unrelated buildings into one
            //MultiPolygon (seen: 24 sub-polygons in a rural tile), so without splitting, home detection would capture
            //all of them at full opacity. Genuine multi-part buildings render identically since the parts share
            //render_height.
            if (geojson.geometry.type === 'Polygon')
            {
                //Rebuild as a plain feature: toGeoJSON returns null-prototype `properties`, and maplibre's worker
                //serializer reads `input.constructor._classRegistryKey`, which throws on a null-proto object. The
                //spread + fresh geometry restore a normal prototype so a lone Polygon building doesn't break the source.
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

    //Classify each feature:
    //  - home cluster: contains the home point OR within `cluster` m (attached verandas/outbuildings)
    //  - surroundings: within `r` m but outside the cluster
    //  - discarded: outside `r`
    //If nothing contains the home point or sits within the cluster, fall back to the closest building within
    //HOME_FALLBACK_M — covers HA coords landing on a garden/driveway a few metres off the house footprint.
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
