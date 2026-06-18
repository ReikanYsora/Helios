//Shared post-processing pipeline for every LiDAR provider.
//
//Input: a row-major Float32Array of "height above ground in metres" per cell
//(north edge first, image-y convention), plus the raster bbox and home anchor.
//Output: a FeatureCollection of Polygon features carrying a render_height
//(mean cell height of the clump), fed to projectExtrusionShadows() like the
//MapTiler footprints are when LiDAR is unavailable.
//
//Providers differ only in HOW they obtain the height-above-ground values
//(IGN: single nDSM raster; UK/NL/NO: fetch DSM + DTM and subtract; ES: merges
//two normalised layers). Consolidation is identical, so it lives here to avoid
//drift between providers.

import { convexHull } from '../shadows';
import type { LidarShadowResult } from '../lidar';

//Tuning constants (same defaults as the legacy FR-only implementation):
//  HEIGHT_THRESH_M          keep cells at/above this height (skip grass and
//                           bare-ground noise).
//  HEIGHT_MAX_M             sanity clamp; above this is garbage (tallest trees
//                           top out ~95 m).
//  TARGET_COMPONENT_AREA_M2 physical target area of one flood-fill component;
//                           the cell cap is derived from this and the actual
//                           pixel pitch so component size stays consistent
//                           across precisions. ~16 m² (4 m × 4 m) is one tree
//                           crown or one wing of a small building; smaller
//                           clumps trace irregular shapes (L-shaped roofs,
//                           zigzag tree rows) closer to their real outline once
//                           the per-clump convex hull is taken in pass 3.
//                           (Tuned down from a wider cap after the cast shadow
//                           blob looked too "smudged".)
//  MIN_COMPONENT_CELLS      floor on cells per component before emitting a
//                           polygon; drops single-cell speckle.
const DEFAULT_HEIGHT_THRESH_M    = 5;
const DEFAULT_HEIGHT_MAX_M       = 100;
const DEFAULT_TARGET_AREA_M2     = 16;
const DEFAULT_MIN_COMPONENT_CELLS = 3;

const M_PER_DEG_LAT = 111_320;
const EARTH_RADIUS_M = 6_371_008.8;

export interface RasterGeo
{
    rasterSize: number;
    minLat:     number;
    maxLat:     number;
    minLon:     number;
    maxLon:     number;
    //Optional circular crop (metres) around (homeLat, homeLon): cells beyond
    //the radius are dropped so shadow zones stay inside the visible disc.
    homeLat:    number;
    homeLon:    number;
    cropRadiusMeters?: number;
}

export interface PipelineOptions
{
    heightThreshM?: number;
    heightMaxM?:    number;
    //Override the per-component physical target area (m²) when a provider's
    //cell pitch differs meaningfully from the IGN baseline (1 m). Most callers
    //leave this default.
    targetAreaM2?:  number;
    minComponentCells?: number;
    //Opt-in 3x3 median pre-filter, BEFORE thresholding. Recommended for
    //providers that publish DSM + DTM separately and subtract client-side
    //(AT-Tirol, AT-Steiermark, DE-BW, NL, UK): the subtraction amplifies
    //single-cell noise at building edges + vegetation, which would pass the
    //threshold and saturate the flood fill with junk. The median keeps
    //building roofs (multi-cell plateaux) while killing isolated spikes.
    //nDSM providers shipping a pre-smoothed normalised height (FR, PL, CA, VT,
    //NRW) typically don't need it.
    medianSmooth?: boolean;
}

//Run the shared consolidation pipeline on a height-above-ground Float32Array.
//The caller handles any DSM-DTM subtraction or no-data scrubbing; pass NaN for
//cells to skip.
//
//Optional `terrain` parallel buffer (same shape/indexing as `heights`) carries
//the DTM band when the source COG ships one (helios-lidar.org 2-band
//pipeline). It is forwarded verbatim onto result.raster.terrain so the shading
//ray-march can lift its comparison into absolute Z. Pure pass-through: the
//consolidation logic stays nDSM-only.
export function processHeightRaster(
    heights: Float32Array,
    geo:     RasterGeo,
    opts:    PipelineOptions = {},
    terrain?: Float32Array,
): LidarShadowResult
{
    const heightThresh = opts.heightThreshM    ?? DEFAULT_HEIGHT_THRESH_M;
    const heightMax    = opts.heightMaxM       ?? DEFAULT_HEIGHT_MAX_M;
    const targetArea   = opts.targetAreaM2     ?? DEFAULT_TARGET_AREA_M2;
    const minCells     = opts.minComponentCells ?? DEFAULT_MIN_COMPONENT_CELLS;

    const { rasterSize, minLat, maxLat, minLon, maxLon } = geo;
    const N = rasterSize * rasterSize;

    if (heights.length < N)
    {
        return emptyResult();
    }

    if (opts.medianSmooth)
    {
        heights = median3x3(heights, rasterSize);
    }

    const pxLon  = (maxLon - minLon) / rasterSize;
    const pxLat  = (maxLat - minLat) / rasterSize;
    const halfLon = pxLon / 2;
    const halfLat = pxLat / 2;
    const pxLatM  = pxLat * M_PER_DEG_LAT;
    const cellAreaM2 = pxLatM * pxLatM;

    //Cell cap derived from physical target area so component size is consistent
    //across providers regardless of native pixel pitch. Clamped so very low
    //precision still yields multi-cell components and very high precision
    //doesn't blow the cap loose. Upper bound 80 cells caps the worst-case hull
    //extension to one building wing / tree group, keeping the shadow polygon a
    //recognisable shape rather than a smudged blob.
    const maxCellsPerComponent = Math.max(4, Math.min(80,
        Math.round(targetArea / Math.max(0.01, cellAreaM2))));

    const cropM = geo.cropRadiusMeters && geo.cropRadiusMeters > 0
        ? geo.cropRadiusMeters
        : null;

    //Pass 1: identify valid cells (above threshold + inside crop). Row j = 0 is
    //the NORTH edge of the bbox (image convention); latitude decreases as j grows.
    const validArr = new Uint8Array(N);
    const hOk      = new Float32Array(N);
    let keptCells  = 0;
    let hMin = Infinity, hMax = -Infinity;

    for (let j = 0; j < rasterSize; j++)
    {
        const cLat = maxLat - (j + 0.5) * pxLat;
        for (let i = 0; i < rasterSize; i++)
        {
            const idx = j * rasterSize + i;
            const h   = heights[idx];
            if (!isFinite(h) || h < heightThresh || h > heightMax)
            {
                continue;
            }

            if (cropM !== null)
            {
                const cLon = minLon + (i + 0.5) * pxLon;
                if (haversineMeters(geo.homeLat, geo.homeLon, cLat, cLon) > cropM)
                {
                    continue;
                }
            }

            validArr[idx] = 1;
            hOk[idx]      = h;
            keptCells++;
            if (h < hMin)
            {
                hMin = h;
            }
            if (h > hMax)
            {
                hMax = h;
            }
        }
    }

    //Pass 2: size-capped 8-connected flood fill (legacy FR logic, lifted here
    //so every provider gets the same dappled-shadow look).
    const labels = new Int32Array(N);
    const stack: number[] = [];
    const components: Array<{ cells: number[]; heightSum: number }> = [];
    let nextLabel = 0;

    for (let seed = 0; seed < N; seed++)
    {
        if (!validArr[seed] || labels[seed])
        {
            continue;
        }

        nextLabel++;
        const cells: number[] = [];
        let heightSum = 0;
        stack.length = 0;
        stack.push(seed);

        while (stack.length && cells.length < maxCellsPerComponent)
        {
            const idx = stack.pop()!;
            if (labels[idx] || !validArr[idx])
            {
                continue;
            }
            labels[idx] = nextLabel;
            cells.push(idx);
            heightSum += hOk[idx];

            const x = idx % rasterSize;
            const y = (idx / rasterSize) | 0;
            for (let dy = -1; dy <= 1; dy++)
            {
                for (let dx = -1; dx <= 1; dx++)
                {
                    if (dx === 0 && dy === 0)
                    {
                        continue;
                    }
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= rasterSize || ny < 0 || ny >= rasterSize)
                    {
                        continue;
                    }
                    const nIdx = ny * rasterSize + nx;
                    if (!labels[nIdx] && validArr[nIdx])
                    {
                        stack.push(nIdx);
                    }
                }
            }
        }

        if (cells.length >= minCells)
        {
            components.push({ cells, heightSum });
        }
    }

    //Pass 3: one convex-hull Polygon per component. Hull vertices are the 4
    //corners of every cell; breaking the grid alignment lets cast shadows
    //alpha-composite into a continuous-but-dappled pattern rather than a
    //tile-aligned grid texture.
    const out: GeoJSON.Feature[] = [];
    for (const comp of components)
    {
        const corners: Array<[number, number]> = [];
        for (const idx of comp.cells)
        {
            const x = idx % rasterSize;
            const y = (idx / rasterSize) | 0;
            const cLon = minLon + (x + 0.5) * pxLon;
            const cLat = maxLat - (y + 0.5) * pxLat;
            corners.push([cLon - halfLon, cLat - halfLat]);
            corners.push([cLon + halfLon, cLat - halfLat]);
            corners.push([cLon + halfLon, cLat + halfLat]);
            corners.push([cLon - halfLon, cLat + halfLat]);
        }
        const hull = convexHull(corners);
        if (hull.length < 3)
        {
            continue;
        }
        hull.push([hull[0][0], hull[0][1]]);

        const avg = comp.heightSum / comp.cells.length;
        out.push({
            type:       'Feature',
            geometry:   { type: 'Polygon', coordinates: [hull] },
            properties:
            {
                render_height:     avg,
                render_min_height: 0
            }
        });
    }

    return {
        features:
        {
            type:     'FeatureCollection',
            features: out
        },
        diagnostics:
        {
            cellsKept:        keptCells,
            cellsPerClumpCap: maxCellsPerComponent,
            heightRangeM:     keptCells > 0
                ? [Number(hMin.toFixed(1)), Number(hMax.toFixed(1))]
                : null
        },
        //Forward the raw raster + geo for the LiDAR View overlay. Zero-copy:
        //the pipeline never mutates `heights` after the validity pass and the
        //engine treats the buffer as read-only. The terrain band, when given,
        //is forwarded under the same contract.
        raster:
        {
            heights:    heights,
            terrain,
            rasterSize,
            minLat,
            maxLat,
            minLon,
            maxLon
        }
    };
}

//3x3 median filter over a Float32 raster; edges reuse the cell's own value when
//the kernel falls off the grid. NaN inputs are preserved (no-data stays
//no-data), keeping upstream "no-data" semantics for cells the WCS marked
//missing. Returns a fresh array; the input is not mutated.
//
//Use case: DSM-DTM subtraction providers (AT-Tirol, AT-Steiermark, DE-BW)
//where subtraction amplifies single-cell noise at building edges + vegetation.
//The median kills isolated spikes while preserving multi-cell roof plateaux.
function median3x3(src: Float32Array, size: number): Float32Array
{
    const out = new Float32Array(src.length);
    const buf = new Array<number>(9);
    for (let j = 0; j < size; j++)
    {
        for (let i = 0; i < size; i++)
        {
            const idx = j * size + i;
            const center = src[idx];
            if (!isFinite(center))
            {
                out[idx] = center;
                continue;
            }
            let n = 0;
            for (let dj = -1; dj <= 1; dj++)
            {
                const jj = j + dj;
                if (jj < 0 || jj >= size)
                {
                    continue;
                }
                for (let di = -1; di <= 1; di++)
                {
                    const ii = i + di;
                    if (ii < 0 || ii >= size)
                    {
                        continue;
                    }
                    const v = src[jj * size + ii];
                    if (isFinite(v))
                    {
                        buf[n++] = v;
                    }
                }
            }
            if (n === 0) { out[idx] = NaN; continue; }
            //In-place insertion sort, faster than Array.sort on a 9-element buffer.
            for (let k = 1; k < n; k++)
            {
                const v = buf[k];
                let m = k - 1;
                while (m >= 0 && buf[m] > v)
                {
                    buf[m + 1] = buf[m];
                    m--;
                }
                buf[m + 1] = v;
            }
            out[idx] = buf[(n - 1) >> 1];
        }
    }
    return out;
}

export function emptyResult(): LidarShadowResult
{
    return {
        features:
        {
            type:     'FeatureCollection',
            features: []
        },
        diagnostics:
        {
            cellsKept:        0,
            cellsPerClumpCap: 0,
            heightRangeM:     null
        }
    };
}

//Compute the lat/lon bbox around a home point, padded by `padFactor` so edge
//trees still cast their shadow inward.
export function homeBbox(
    homeLat: number, homeLon: number, radiusMeters: number, padFactor: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number }
{
    const r    = Math.max(1, radiusMeters);
    const dLat = (r * padFactor) / M_PER_DEG_LAT;
    const dLon = (r * padFactor)
               / (M_PER_DEG_LAT * Math.cos(homeLat * Math.PI / 180));
    return {
        minLat: homeLat - dLat,
        maxLat: homeLat + dLat,
        minLon: homeLon - dLon,
        maxLon: homeLon + dLon
    };
}

//Great-circle distance in metres for the circular crop. Cheap enough per-cell
//at our raster sizes.
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number
{
    const toRad = Math.PI / 180;
    const dLat  = (lat2 - lat1) * toRad;
    const dLon  = (lon2 - lon1) * toRad;
    const a     = Math.sin(dLat / 2) ** 2
                + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad)
                * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export const RASTER_DEFAULTS =
{
    bboxPadFactor:           1.15,
    minRasterSize:           64,
    maxRasterSize:           2048
} as const;
