//Cast-shadow raster painting. The shadow projector produces one polygon per casting region; this module
//rasterises them onto an offscreen canvas at full black and pushes the result to the MapLibre ImageSource
//backing the shadow layer. Per-pixel rendering avoids the alpha-compositing saturation that overlapping fill
//polygons would produce in dense forest (every pixel is covered or not, never stacked twice).

import type maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';


//Offscreen raster resolution for the shadow mask, indexed by the user's `lidar-precision` choice. Bigger raster =
//longer encode/upload/tile re-paint. Trade-offs per level:
//  - low    , 512x512.   ~4 m/px at worst-case 2 km bbox, chunky but readable. Default for mobile / explicit downgrade.
//  - medium , 1024x1024. ~2 m/px. Previous default.
//  - high   , 2048x2048. ~1 m/px, edges land on the LiDAR grid. ~40 ms encode, 4x medium memory; desktop dense scenes.
import type { LidarPrecisionLevel } from '../helios-config';
import { SHADOW_RASTER_SIZE_BY_PRECISION } from '../constants';

export function shadowRasterSizeFor(level: LidarPrecisionLevel): number
{
    return SHADOW_RASTER_SIZE_BY_PRECISION[level] ?? 1024;
}


//Fully-transparent 1x1 PNG used as the initial image so MapLibre has something valid to bind before the first paint.
export const BLANK_SHADOW_DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';


//Four lat/lon corners of the shadow image source in [NW, NE, SE, SW] order (MapLibre's convention). Sides are
//`radiusMeters` converted to degrees with the standard cos(lat) longitude correction.
export type ShadowBoundsCorners =
    [[number, number], [number, number], [number, number], [number, number]];

export function shadowBoundsCornersLL(
    homeLat:      number,
    homeLon:      number,
    radiusMeters: number
): ShadowBoundsCorners
{
    const cosLat  = Math.cos(homeLat * Math.PI / 180);
    const dLat    = radiusMeters / 111_320;
    const dLon    = radiusMeters / (111_320 * cosLat);
    const minLon  = homeLon - dLon;
    const maxLon  = homeLon + dLon;
    const minLat  = homeLat - dLat;
    const maxLat  = homeLat + dLat;
    return [
        [minLon, maxLat],  // NW
        [maxLon, maxLat],  // NE
        [maxLon, minLat],  // SE
        [minLon, minLat]   // SW
    ];
}


//Rasterise the cast-shadow polygons onto the offscreen canvas and push the resulting PNG to the image source.
//Painting every polygon solid black keeps overlaps black (no alpha stacking); the layer's `raster-opacity` then
//applies a single per-pixel opacity matching the user setting regardless of how many polygons overlapped.
//
//`fadeFullMeters` / `fadeOutMeters` add a radial alpha fall-off centred on home so the hard circular edge stops
//reading as a boundary: full alpha inside `fadeFullMeters`, ramping linearly to zero between the two radii. Aligned
//with the LiDAR view fade radii so the two layers share their visual extent.
export function paintShadowRaster(
    map:            MapLibreMap,
    canvas:         HTMLCanvasElement,
    features:       GeoJSON.FeatureCollection,
    corners:        ShadowBoundsCorners,
    radiusMeters:   number,
    fadeFullMeters: number,
    fadeOutMeters:  number,
): void
{
    const src = map.getSource('helios-building-shadows-src') as
                maplibregl.ImageSource | undefined;
    if (!src)
    {
        return;
    }

    const minLon = corners[0][0], maxLat = corners[0][1];
    const maxLon = corners[1][0], minLat = corners[2][1];

    const ctx = canvas.getContext('2d');
    if (!ctx)
    {
        return;
    }

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#000000';

    const lonSpan = maxLon - minLon;
    const latSpan = maxLat - minLat;
    const lonToPx = (lon: number): number =>
        (lon - minLon) / lonSpan * size;
    //Canvas Y is top-down, lat is bottom-up: north edge maps to pixel 0, south edge to the last pixel.
    const latToPx = (lat: number): number =>
        (maxLat - lat) / latSpan * size;

    for (const feat of features.features)
    {
        const geom = feat.geometry;
        if (!geom)
        {
            continue;
        }
        let polygons: number[][][][] | null = null;
        if (geom.type === 'Polygon')
        {
            polygons = [geom.coordinates as number[][][]];
        }
        else if (geom.type === 'MultiPolygon')
        {
            polygons = geom.coordinates as number[][][][];
        }
        if (!polygons)
        {
            continue;
        }

        for (const poly of polygons)
        {
            if (!poly.length)
            {
                continue;
            }
            const outer = poly[0] as number[][];
            if (outer.length < 3)
            {
                continue;
            }

            ctx.beginPath();
            ctx.moveTo(lonToPx(outer[0][0]), latToPx(outer[0][1]));
            for (let i = 1; i < outer.length; i++)
            {
                ctx.lineTo(lonToPx(outer[i][0]), latToPx(outer[i][1]));
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    //Radial fade-out so the hard circular boundary no longer reads as an edge. The source-over painting above
    //leaves alpha 1.0 inside shadow pixels and 0 elsewhere; this destination-in pass multiplies each pixel's alpha
    //by a gradient from 1 at the full-opacity radius to 0 at the outer fade radius. Canvas centre is home because
    //`shadowBoundsCornersLL` lays out the bounds symmetrically around (homeLat, homeLon).
    if (fadeOutMeters > fadeFullMeters && radiusMeters > 0)
    {
        const cx     = size / 2;
        const cy     = size / 2;
        const halfPx = size / 2;
        const fullPx = Math.max(0, Math.min(halfPx, (fadeFullMeters / radiusMeters) * halfPx));
        const fadePx = Math.max(fullPx, Math.min(halfPx, (fadeOutMeters / radiusMeters) * halfPx));
        if (fadePx > fullPx)
        {
            const prevOp  = ctx.globalCompositeOperation;
            const prevFill = ctx.fillStyle;
            const grad   = ctx.createRadialGradient(cx, cy, fullPx, cx, cy, fadePx);
            grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.globalCompositeOperation = 'destination-in';
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);
            ctx.globalCompositeOperation = prevOp;
            ctx.fillStyle = prevFill;
        }
    }

    //Keep bounds in sync in case home position or building radius changed since the source was created. Idempotent.
    try { src.setCoordinates(corners); }
    catch (_) {}
    //MapLibre 5's ImageSource.updateImage only takes a URL, so serialise the canvas as a PNG data URL each paint.
    //PNG encode of a mostly-transparent 1024 raster is ~10-20 ms on commodity hardware, well under the sun-movement
    //cadence that triggers shadow refreshes.
    try
    {
        const dataUrl = canvas.toDataURL('image/png');
        src.updateImage({ url: dataUrl });
    }
    catch (_) {}
}
