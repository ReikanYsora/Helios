//Local-nDSM decode + shadow casters for the 2.5D scene. Decodes a browser-reachable nDSM (normalised Digital
//Surface Model) GeoTIFF into a height raster, then consolidates it into ground-shadow casters.
//
//Reusable stages so the LiDAR view (wireframe + points) shares the decode:
//  fetchNdsmRaster  -> reads ONLY the display-radius window of the GeoTIFF (so every cell lands inside the
//                      visible disc at ~native pitch instead of being spread thin across a large bbox) and
//                      returns the height grid + that window's geo frame.
//  rasterToCasters  -> flood-fills the above-threshold cells into size-capped components and wraps each into a
//                      convex-hull footprint (LOCAL METRES east/north from the home) with the component's mean
//                      height — the same frame building footprints use, so they feed the SAME shadow projector
//                      (renderShadows). Buildings still render as prisms; only the SHADOW casters change.
//  renderWireframe  -> projects the SAME raster as a grid mesh + node dots in the primary-text colour, drawn
//                      on top in the LiDAR view (whole surface, no height threshold).
//
//Self-contained engine module: no card imports, and buildings.ts never imports this (one-way dependency).
//geotiff is loaded via a dynamic import so it executes only for LiDAR users.

import { convexHull, type ShadowCaster } from './buildings';
import type { SceneCamera } from './projection';
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

//A decoded nDSM grid covering the display window, with that window's geo frame (north = row 0). heights are
//metres above ground (NaN = no-data / skip). Reused by the shadow casters and the LiDAR view.
export interface NdsmRaster
{
    heights: Float32Array;
    size:    number;
    minLat:  number;
    maxLat:  number;
    minLon:  number;
    maxLon:  number;
    homeLat: number;
    homeLon: number;
}

export interface NdsmFetchOptions
{
    url:     string;
    //Configured EPSG:4326 bbox = the GeoTIFF's geo frame.
    minLat:  number;
    maxLat:  number;
    minLon:  number;
    maxLon:  number;
    homeLat:    number;
    homeLon:    number;
    radiusM:    number;
    //Square grid edge (cells/side) the window is resampled to. Resolved from the LiDAR shadow quality.
    rasterSize: number;
    signal?: AbortSignal;
}

//Decode the GeoTIFF, reading only the display-radius window. Throws on a failed fetch/decode or a window that
//doesn't intersect the bbox; the caller swallows it and falls back to footprint shadows.
export async function fetchNdsmRaster(opts: NdsmFetchOptions): Promise<NdsmRaster>
{
    const { url, minLat, maxLat, minLon, maxLon, homeLat, homeLon, radiusM, rasterSize, signal } = opts;

    const response = await fetch(url, { signal });
    if (!response.ok)
    {
        throw new Error(String(response.status));
    }
    const buf = await response.arrayBuffer();

    const { fromArrayBuffer } = await import('geotiff');
    const tiff  = await fromArrayBuffer(buf);
    const image = await tiff.getImage();
    const imgW  = image.getWidth();
    const imgH  = image.getHeight();
    const noData = image.getGDALNoData?.();

    //Display window around the home (radius -> degrees), clamped to the bbox so we never read outside the file.
    const cosHome = Math.cos(homeLat * DEG);
    const dLat = radiusM / M_PER_DEG_LAT;
    const dLon = radiusM / (M_PER_DEG_LAT * cosHome);
    const wMinLon = Math.max(minLon, homeLon - dLon);
    const wMaxLon = Math.min(maxLon, homeLon + dLon);
    const wMinLat = Math.max(minLat, homeLat - dLat);
    const wMaxLat = Math.min(maxLat, homeLat + dLat);
    if (wMaxLon <= wMinLon || wMaxLat <= wMinLat)
    {
        throw new Error('lidar bbox does not cover the home');
    }

    //Window edges -> image pixels (x: lon min->max left->right; y: lat max->min top->bottom), snapped to whole
    //pixels. The snapped pixel rect is converted back to its exact geo frame so each cell's lat/lon is accurate.
    const lonToPx = (lon: number): number => (lon - minLon) / (maxLon - minLon) * imgW;
    const latToPx = (lat: number): number => (maxLat - lat) / (maxLat - minLat) * imgH;
    const left   = clamp(Math.floor(lonToPx(wMinLon)), 0, imgW - 1);
    const right  = clamp(Math.ceil(lonToPx(wMaxLon)),  left + 1, imgW);
    const top    = clamp(Math.floor(latToPx(wMaxLat)), 0, imgH - 1);
    const bottom = clamp(Math.ceil(latToPx(wMinLat)),  top + 1, imgH);

    const frameMinLon = minLon + (left   / imgW) * (maxLon - minLon);
    const frameMaxLon = minLon + (right  / imgW) * (maxLon - minLon);
    const frameMaxLat = maxLat - (top    / imgH) * (maxLat - minLat);
    const frameMinLat = maxLat - (bottom / imgH) * (maxLat - minLat);

    const size = rasterSize;
    const rasters = await image.readRasters({
        window:     [left, top, right, bottom],
        width:      size,
        height:     size,
        interleave: false,
        samples:    [0],
    });
    const band = (rasters as unknown as ArrayLike<number>[])[0];

    //Normalise to metres-above-ground: no-data / non-finite -> NaN; negatives clamped to 0 (sub-ground noise).
    const heights = new Float32Array(size * size);
    for (let k = 0; k < heights.length; k++)
    {
        const v = band[k];
        if (v === noData || !Number.isFinite(v)) { heights[k] = NaN; }
        else if (v < 0)                          { heights[k] = 0; }
        else                                     { heights[k] = v; }
    }

    return {
        heights, size,
        minLat: frameMinLat, maxLat: frameMaxLat, minLon: frameMinLon, maxLon: frameMaxLon,
        homeLat, homeLon,
    };
}

//Consolidate a decoded raster into ground-shadow casters (local metres). Cells outside the radius (the window
//corners) are dropped by the circular crop.
export function rasterToCasters(raster: NdsmRaster, radiusM: number): ShadowCaster[]
{
    const { heights, size, minLat, maxLat, minLon, maxLon, homeLat, homeLon } = raster;

    //Per-cell geography. Row j = 0 is the NORTH edge. Cell centre lat/lon -> local metres east/north from the
    //home (matches how building footprints are built), so the casters land in the frame the projector expects.
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

    //Component cap from the cell area, so a coarser raster keeps a comparable physical clump size.
    const cellAreaM2          = (pxLat * M_PER_DEG_LAT) ** 2;
    const maxCellsPerComponent = clamp(Math.round(TARGET_COMPONENT_AREA_M2 / Math.max(0.01, cellAreaM2)), 4, 80);
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
            const e  = localE[idx];
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

//Draw the nDSM surface as a projected grid mesh + node dots for the LiDAR view, in the theme's primary-text
//colour (SVG inherits the card's CSS vars). The WHOLE surface is drawn (ground ~0, features bump up) so the
//relief reads; no height threshold here (that's shadow-only). Sampled every `step` cells from maxLines, node
//metres/height projected through the shared camera; a mesh edge is emitted only when both its endpoints exist
//(finite height), and a dot at every existing node. One allocation-conscious string, wrapped in a group so
//it reads as a wireframe rather than a solid fill.
export function renderWireframe(cam: SceneCamera, raster: NdsmRaster, maxLines: number): string
{
    const { heights, size, minLat, maxLat, minLon, maxLon, homeLat, homeLon } = raster;
    const step  = Math.max(1, Math.ceil(size / maxLines));
    const pxLat = (maxLat - minLat) / size;
    const pxLon = (maxLon - minLon) / size;
    const cosHome = Math.cos(homeLat * DEG);

    //Sampled grid of projected points ([x, y] | null = missing-height node, skipped along with its edges).
    const cols: number[] = [];
    for (let i = 0; i < size; i += step) { cols.push(i); }
    const rows: number[] = [];
    for (let j = 0; j < size; j += step) { rows.push(j); }

    const pts: ([number, number] | null)[] = new Array(rows.length * cols.length);
    for (let rj = 0; rj < rows.length; rj++)
    {
        const j    = rows[rj];
        const cLat = maxLat - (j + 0.5) * pxLat;
        const localN = (cLat - homeLat) * M_PER_DEG_LAT;
        for (let ci = 0; ci < cols.length; ci++)
        {
            const i = cols[ci];
            const h = heights[j * size + i];
            if (!Number.isFinite(h))
            {
                pts[rj * cols.length + ci] = null;
                continue;
            }
            const cLon   = minLon + (i + 0.5) * pxLon;
            const localE = (cLon - homeLon) * M_PER_DEG_LAT * cosHome;
            pts[rj * cols.length + ci] = cam.project(localE, localN, h);
        }
    }

    const color = 'var(--primary-text-color, #e1e1e1)';
    let lines = '';
    let dots  = '';
    for (let rj = 0; rj < rows.length; rj++)
    {
        for (let ci = 0; ci < cols.length; ci++)
        {
            const a = pts[rj * cols.length + ci];
            if (!a) { continue; }
            dots += `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="1" fill="${color}"/>`;
            const right = ci + 1 < cols.length ? pts[rj * cols.length + ci + 1] : null;
            if (right)
            {
                lines += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${right[0].toFixed(1)}" y2="${right[1].toFixed(1)}"/>`;
            }
            const down = rj + 1 < rows.length ? pts[(rj + 1) * cols.length + ci] : null;
            if (down)
            {
                lines += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${down[0].toFixed(1)}" y2="${down[1].toFixed(1)}"/>`;
            }
        }
    }

    return `<g opacity="0.7"><g stroke="${color}" stroke-width="0.6" fill="none">${lines}</g>${dots}</g>`;
}
