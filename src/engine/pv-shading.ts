//LiDAR-aware shading check for the PV prediction.
//
//At every time-step we know the sun position (getSunPosition), each PV array's coordinates (per-entry lon/lat or home
//fallback), and the loaded nDSM raster within building-radius. We ray-march from each panel along panel→sun, sample the
//nDSM, and decide whether the line-of-sight is blocked by terrain, a building, or a tree.
//
//A shaded panel loses only the direct beam component of POA (~75-85 % on a clear day); the isotropic-sky diffuse and
//ground-reflected components are unaffected, so isPanelShaded returns a boolean and the caller modulates only the beam term.
//
//Ray sampling uses bilinear interpolation so the shading edge is sub-cell smooth (no flicker as the sun crosses a corner
//pixel boundary).

//LiDAR working raster. `heights` is the nDSM (height above local ground per cell), always populated. `terrain` is the
//optional DTM band (ground elevation in the source vertical datum) — present only for 2-band COGs; on legacy single-band
//files it is undefined and the ray-march falls back to flat-ground.
export interface NdsmRaster
{
    heights:    Float32Array;
    terrain?:   Float32Array;
    rasterSize: number;       //square: rasterSize × rasterSize cells
    minLat:     number;
    maxLat:     number;
    minLon:     number;
    maxLon:     number;
}

const D = Math.PI / 180;
const M_PER_DEG_LAT = 111_320;     //mean meridional metres per degree

//Bilinear sample of one Float32 band. Returns null when the point is outside the bbox or any of the four bracketing cells
//is non-finite (no-data). Shared by both bands so nDSM and DTM sample with identical semantics.
function bilinearSample(
    band: Float32Array,
    raster: NdsmRaster,
    lon:    number,
    lat:    number,
): number | null
{
    if (lon <= raster.minLon || lon >= raster.maxLon)
    {
        return null;
    }
    if (lat <= raster.minLat || lat >= raster.maxLat)
    {
        return null;
    }

    const N = raster.rasterSize;
    //Image convention: row 0 is the NORTH edge, so we flip latitude.
    const u = (lon - raster.minLon) / (raster.maxLon - raster.minLon);
    const v = (raster.maxLat - lat) / (raster.maxLat - raster.minLat);
    const x = u * (N - 1);
    const y = v * (N - 1);
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= N - 1 || iy < 0 || iy >= N - 1)
    {
        return null;
    }

    const h00 = band[iy       * N + ix];
    const h10 = band[iy       * N + ix + 1];
    const h01 = band[(iy + 1) * N + ix];
    const h11 = band[(iy + 1) * N + ix + 1];
    if (!isFinite(h00) || !isFinite(h10) || !isFinite(h01) || !isFinite(h11))
    {
        return null;
    }

    const dx = x - ix;
    const dy = y - iy;
    const top = h00 * (1 - dx) + h10 * dx;
    const bot = h01 * (1 - dx) + h11 * dx;
    return top * (1 - dy) + bot * dy;
}


//Bilinear sample of the nDSM. Null outside the bbox or on a no-data neighbourhood.
export function sampleNdsmAt(
    raster: NdsmRaster,
    lon:    number,
    lat:    number,
): number | null
{
    return bilinearSample(raster.heights, raster, lon, lat);
}


//Bilinear sample of the DTM (ground elevation). Null when there is no terrain band (legacy single-band COG) or outside the
//bbox / on no-data. Used to lift the ray-march into absolute Z so terrain slope between panel and obstacle counts.
export function sampleDtmAt(
    raster: NdsmRaster,
    lon:    number,
    lat:    number,
): number | null
{
    if (!raster.terrain)
    {
        return null;
    }
    return bilinearSample(raster.terrain, raster, lon, lat);
}


//Per-cell solar exposure across the whole raster, chunked across rAF ticks. Output is a Uint8Array indexed by
//(j * rasterSize + i): 0 = shadowed, 255 = lit; NaN cells and below-horizon sun both yield 0. Wired into the LiDAR-View
//overlay for a live, camera-independent "who's currently in sunlight" map.
//
//Same raymarch recipe as isPanelShaded, lifted out to run over the full grid. The caller owns the output buffer (allocated
//once) and walks j-row ranges per chunk; rows outside [jStart, jEnd) are left untouched so one allocation survives the
//multi-chunk sweep, and the user sees the map fill row-by-row instead of a 200-1500 ms freeze. Below-horizon sun and an
//empty range are fast no-ops.
export function computeLidarCellExposureRows(
    raster:         NdsmRaster,
    sunAltitudeDeg: number,
    sunAzimuthDeg:  number,
    jStart:         number,
    jEnd:           number,
    out:            Uint8Array,
    stepM:          number = 2,
    maxDistM:       number = 200,
): void
{
    if (sunAltitudeDeg <= 0)
    {
        return;
    }
    if (jStart >= jEnd)
    {
        return;
    }

    const altR  = sunAltitudeDeg * D;
    const azR   = sunAzimuthDeg  * D;
    const dxM   = Math.sin(azR);
    const dyM   = Math.cos(azR);
    const tanAlt = Math.tan(altR);

    const { rasterSize, minLat, maxLat, minLon, maxLon, heights, terrain } = raster;
    const pxLon = (maxLon - minLon) / rasterSize;
    const pxLat = (maxLat - minLat) / rasterSize;
    const hasTerrain = !!terrain;

    const j0 = Math.max(0, jStart);
    const j1 = Math.min(rasterSize, jEnd);

    for (let j = j0; j < j1; j++)
    {
        const cLat = maxLat - (j + 0.5) * pxLat;
        //metres-per-degree-longitude varies with latitude; per-row constant is good to <1 m over the 200 m reach, well below pitch.
        const mPerDegLon = M_PER_DEG_LAT * Math.cos(cLat * D);
        const dLatPerM   = dyM / M_PER_DEG_LAT;
        const dLonPerM   = dxM / mPerDegLon;

        for (let i = 0; i < rasterSize; i++)
        {
            const idx   = j * rasterSize + i;
            const cellH = heights[idx];
            if (!isFinite(cellH)) { out[idx] = 0; continue; }
            const cLon    = minLon + (i + 0.5) * pxLon;
            const cellDtm = hasTerrain ? terrain![idx] : 0;
            let shadowed  = false;
            for (let d = stepM; d <= maxDistM; d += stepM)
            {
                const lat = cLat + dLatPerM * d;
                const lon = cLon + dLonPerM * d;
                const sampleObstacle = sampleNdsmAt(raster, lon, lat);
                if (sampleObstacle === null)
                {
                    continue;
                }
                let relGround = 0;
                if (hasTerrain)
                {
                    //DTM-gap fallback: valid nDSM but no-data DTM at this step → keep relGround 0 (flat-ground) rather than
                    //skip, which let the ray see through real obstacles near coverage edges.
                    const sampleDtm = sampleDtmAt(raster, lon, lat);
                    if (sampleDtm !== null)
                    {
                        relGround = sampleDtm - cellDtm;
                    }
                }
                const obstacleZ = relGround + sampleObstacle;
                const rayZ      = cellH + d * tanAlt;
                if (obstacleZ > rayZ) { shadowed = true; break; }
            }
            out[idx] = shadowed ? 0 : 255;
        }
    }
}


//Walk from the panel toward the sun; return true the first time the obstacle (nDSM, lifted by DTM slope) projects above the
//sun ray's altitude at that distance. False if the sun is reached unobstructed, the raster is missing, or the sun is below
//the horizon (already handled upstream). With a DTM band, ray and obstacle are compared in absolute Z anchored at the
//panel's ground; sloped ground between panel and obstacle then counts. Legacy single-band COGs fall through to flat-ground.
//Defaults: 2 m step (typical down-sampled nDSM pitch), 200 m reach (a city block plus canopy, dropping the negligible
//low-altitude grazing tail).
export function isPanelShaded(
    raster:         NdsmRaster | null,
    panelLat:       number,
    panelLon:       number,
    panelHeightM:   number,
    sunAltitudeDeg: number,
    sunAzimuthDeg:  number,
    stepM:          number = 2,
    maxDistM:       number = 200,
): boolean
{
    if (!raster)
    {
        return false;
    }
    if (sunAltitudeDeg <= 0) return false;       //below-horizon: caller's job

    const altR = sunAltitudeDeg * D;
    const azR  = sunAzimuthDeg  * D;
    //Horizontal direction toward the sun. Azimuth is clockwise from north, so east = +sin, north = +cos.
    const dxM = Math.sin(azR);
    const dyM = Math.cos(azR);
    const tanAlt = Math.tan(altR);

    //metres-per-degree at the panel latitude; constant factor good to ~1 m over the 200 m reach, under nDSM resolution.
    const mPerDegLon = M_PER_DEG_LAT * Math.cos(panelLat * D);
    const dLatPerM = dyM / M_PER_DEG_LAT;
    const dLonPerM = dxM / mPerDegLon;

    //Panel's own DTM reference, looked up once. Null on legacy single-band rasters → relGround defaults to 0 and the march
    //collapses to flat-ground (obstacle_z = nDSM, ray_z = panel_height + d × tan).
    const panelDtm = sampleDtmAt(raster, panelLon, panelLat);

    for (let d = stepM; d <= maxDistM; d += stepM)
    {
        const lat = panelLat + dLatPerM * d;
        const lon = panelLon + dLonPerM * d;
        const obstacleAboveGround = sampleNdsmAt(raster, lon, lat);
        if (obstacleAboveGround === null) continue;     //outside coverage, skip
        let relGround = 0;
        if (panelDtm !== null)
        {
            const sampleDtm = sampleDtmAt(raster, lon, lat);
            //DTM-gap fallback: valid nDSM but no-data DTM (water, artifact, coverage edge) → flat-ground (relGround = 0)
            //rather than skip the step. Skipping let the ray see through the obstacle, under-detecting shading near edges;
            //the small terrain bias is acceptable next to a false-negative.
            if (sampleDtm !== null)
            {
                relGround = sampleDtm - panelDtm;
            }
        }
        const obstacleZ = relGround + obstacleAboveGround;
        const rayZ      = panelHeightM + d * tanAlt;
        if (obstacleZ > rayZ)
        {
            return true;
        }
    }
    return false;
}
