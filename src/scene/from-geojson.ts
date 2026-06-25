//Adapter: Helios's building data (GeoJSON FeatureCollections in lat/lng, from engine/buildings.ts) →
//the scene renderer's Building[] (local-metre footprints). This is the bridge that lets the existing
//Overpass/OpenMapTiles fetch + cluster pipeline feed the new 2.5D renderer instead of MapLibre's
//fill-extrusion sources. Pure.

import { type Point, ringToLocalMetres } from './geo';
import type { Building } from './buildings';

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
