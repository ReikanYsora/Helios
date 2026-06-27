//Local-nDSM shadow casters: decode a single browser-reachable nDSM (normalised Digital Surface Model)
//GeoTIFF into ground-shadow casters for the 2.5D scene. The config bbox IS the raster frame — geotiff.js
//force-resamples the band to a square grid (nearest-neighbour), so the TIFF's own georeferencing is ignored
//and every cell maps straight to a lat/lon from the bbox.
//
//Pipeline (decode -> clump -> casters): read band 1 (height above ground), normalise to metres with NaN for
//no-data, flood-fill the above-threshold cells into size-capped 8-connected components, and wrap each
//component's cells into one convex-hull footprint with the component's mean height. The footprints are in
//LOCAL METRES east/north relative to the home — the same frame building footprints use — so they feed the
//SAME shadow projector (renderShadows) the buildings do. Buildings still render as prisms; only the SHADOW
//casters change when a local LiDAR is configured.
//
//Self-contained engine module: no card imports, and buildings.ts never imports this (one-way dependency).
//geotiff is loaded via a dynamic import so it executes only for LiDAR users.

import { convexHull, type ShadowCaster } from './buildings';
import { DEG } from '../constants';

const M_PER_DEG_LAT = 111_320;

//Clump-stage tunables. A cell joins a component only above HEIGHT_THRESH_M and below HEIGHT_MAX_M (drops
//ground noise + decode spikes); components grow to at most maxCellsPerComponent cells (so one big roof or
//tree canopy breaks into several local casters rather than one sprawling hull) and are dropped below
//MIN_COMPONENT_CELLS (specks).
const HEIGHT_THRESH_M           = 5;
const HEIGHT_MAX_M              = 100;
const TARGET_COMPONENT_AREA_M2  = 16;
const MIN_COMPONENT_CELLS       = 3;

function clamp(v: number, lo: number, hi: number): number
{
    return Math.max(lo, Math.min(hi, v));
}

export interface NdsmCasterOptions
{
    url:     string;
    minLat:  number;
    maxLat:  number;
    minLon:  number;
    maxLon:  number;
    homeLat:    number;
    homeLon:    number;
    radiusM:    number;
    //Square nDSM grid edge (cells/side). Resolved from the LiDAR shadow quality by the caller.
    rasterSize: number;
    signal?: AbortSignal;
}

//Decode the nDSM at the bbox and return ground-shadow casters in local metres. Throws on a failed fetch /
//decode; the caller swallows the error and falls back to footprint shadows.
export async function fetchNdsmCasters(opts: NdsmCasterOptions): Promise<ShadowCaster[]>
{
    const { url, minLat, maxLat, minLon, maxLon, homeLat, homeLon, radiusM, rasterSize, signal } = opts;

    //The raster frame is the bbox, force-resampled to a square grid; the caller sizes it from the LiDAR
    //shadow quality (higher = finer shadows, heavier).
    const size = rasterSize;

    const response = await fetch(url, { signal });
    if (!response.ok)
    {
        throw new Error(String(response.status));
    }
    const buf = await response.arrayBuffer();

    const { fromArrayBuffer } = await import('geotiff');
    const tiff  = await fromArrayBuffer(buf);
    const image = await tiff.getImage();
    const noData = image.getGDALNoData?.();
    const rasters = await image.readRasters({
        width:      size,
        height:     size,
        interleave: false,
        samples:    [0],
    });
    const band = (rasters as unknown as ArrayLike<number>[])[0];

    //Normalise into metres-above-ground: no-data / non-finite -> NaN; negatives clamped to 0 (sub-ground
    //decode noise); everything else kept.
    const heights = new Float32Array(size * size);
    for (let k = 0; k < heights.length; k++)
    {
        const v = band[k];
        if (v === noData || !Number.isFinite(v))
        {
            heights[k] = NaN;
        }
        else if (v < 0)
        {
            heights[k] = 0;
        }
        else
        {
            heights[k] = v;
        }
    }

    //Per-cell geography. Row j = 0 is the NORTH edge. Cell pitch in degrees -> the centre lat/lon -> local
    //metres east/north from the home (matches how building footprints are built), so the casters land in the
    //same frame the projector expects.
    const pxLat   = (maxLat - minLat) / size;
    const pxLon   = (maxLon - minLon) / size;
    const cosHome = Math.cos(homeLat * DEG);
    const halfE   = (pxLon * M_PER_DEG_LAT * cosHome) / 2;
    const halfN   = (pxLat * M_PER_DEG_LAT) / 2;

    const localE = new Float32Array(size * size);
    const localN = new Float32Array(size * size);
    for (let j = 0; j < size; j++)
    {
        const cLat = maxLat - (j + 0.5) * pxLat;
        const n    = (cLat - homeLat) * M_PER_DEG_LAT;
        for (let i = 0; i < size; i++)
        {
            const cLon = minLon + (i + 0.5) * pxLon;
            const idx  = j * size + i;
            localE[idx] = (cLon - homeLon) * M_PER_DEG_LAT * cosHome;
            localN[idx] = n;
        }
    }

    //Component size cap from the cell area, so a coarser raster keeps a comparable physical clump size.
    const cellAreaM2          = (pxLat * M_PER_DEG_LAT) ** 2;
    const maxCellsPerComponent = clamp(Math.round(TARGET_COMPONENT_AREA_M2 / cellAreaM2), 4, 80);
    const r2                  = radiusM * radiusM;

    const valid = (idx: number): boolean =>
    {
        const h = heights[idx];
        return Number.isFinite(h) && h >= HEIGHT_THRESH_M && h <= HEIGHT_MAX_M
            && (localE[idx] * localE[idx] + localN[idx] * localN[idx]) <= r2;
    };

    //8-connected, size-capped flood fill (iterative stack). Each component grows until it hits the cell cap;
    //sub-MIN_COMPONENT_CELLS specks are dropped. visited gates every cell so the next seed never re-enters a
    //claimed component.
    const visited = new Uint8Array(size * size);
    const stack: number[] = [];
    const casters: ShadowCaster[] = [];

    for (let seed = 0; seed < heights.length; seed++)
    {
        if (visited[seed] || !valid(seed))
        {
            continue;
        }
        const cells: number[] = [];
        let heightSum = 0;
        visited[seed] = 1;
        stack.length = 0;
        stack.push(seed);
        while (stack.length && cells.length < maxCellsPerComponent)
        {
            const idx = stack.pop() as number;
            cells.push(idx);
            heightSum += heights[idx];
            const ci = idx % size;
            const cj = (idx - ci) / size;
            for (let dj = -1; dj <= 1; dj++)
            {
                const nj = cj + dj;
                if (nj < 0 || nj >= size)
                {
                    continue;
                }
                for (let di = -1; di <= 1; di++)
                {
                    if (di === 0 && dj === 0)
                    {
                        continue;
                    }
                    const ni = ci + di;
                    if (ni < 0 || ni >= size)
                    {
                        continue;
                    }
                    const nIdx = nj * size + ni;
                    if (!visited[nIdx] && valid(nIdx))
                    {
                        visited[nIdx] = 1;
                        stack.push(nIdx);
                    }
                }
            }
        }
        if (cells.length < MIN_COMPONENT_CELLS)
        {
            continue;
        }

        //One caster per component: the convex hull of every cell's 4 corners (local metres), the mean
        //above-ground height, and the mean cell centre for the projector's near-plane cull.
        const points: [number, number][] = [];
        let cx = 0;
        let cy = 0;
        for (const idx of cells)
        {
            const e = localE[idx];
            const nn = localN[idx];
            cx += e;
            cy += nn;
            points.push([e - halfE, nn - halfN]);
            points.push([e + halfE, nn - halfN]);
            points.push([e + halfE, nn + halfN]);
            points.push([e - halfE, nn + halfN]);
        }
        casters.push({
            footprint: convexHull(points),
            height:    heightSum / cells.length,
            centerX:   cx / cells.length,
            centerY:   cy / cells.length,
        });
    }

    return casters;
}
