//Generic local nDSM GeoTIFF / COG shadow source. Not in the static LIDAR_SOURCES list: built on
//demand from card config (via resolveLidarSource()) once every `lidar-local-ndsm-*` key validates
//(provider enabled, raster URL present, full ordered EPSG:4326 bbox within legal ranges).
//
//Raster is "height above ground in metres" (nDSM = DSM - DTM, prepared offline); a bare-earth DEM/DTM
//is not valid input. Decoding uses fetchFloat32GeoTiffWithNoData(), a thin extension of
//fetchFloat32GeoTiff() that also returns the GDAL_NODATA sentinel; the original helper is untouched so
//existing providers keep the same byte path.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../lidar';
import {
    processHeightRaster,
    emptyResult,
    RASTER_DEFAULTS
} from './pipeline';
import { fetchFloat32GeoTiffWithNoData } from './geotiff';

//Fully-validated local nDSM configuration (from validateLocalNdsmConfig() in ../lidar.ts). The
//factory below treats every field as already vetted.
export interface LocalNdsmConfig
{
    url:    string;
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

//Normalise the resampled nDSM band in place (exported for unit testing):
//  - nodata sentinel / NaN / +/-Infinity -> NaN
//  - finite negative                     -> 0 (valid ground)
//  - finite non-negative                 -> unchanged
//Run once on the resampled raster before processHeightRaster() consumes it.
export function normaliseLocalNdsmRaster(
    band:   Float32Array,
    noData: number | null
): Float32Array
{
    const hasNoData = noData !== null && Number.isFinite(noData);
    for (let i = 0; i < band.length; i++)
    {
        const v = band[i];
        if (hasNoData && v === noData)            { band[i] = NaN; continue; }
        if (!Number.isFinite(v))                  { band[i] = NaN; continue; }
        if (v < 0)                                { band[i] = 0;   continue; }
        //finite, non-negative: leave untouched
    }
    return band;
}

//Normalise the optional DTM (terrain) band in place. Same nodata handling as the nDSM, but no
//negative-floor: terrain elevation is absolute and can legitimately sit below sea level (Dead Sea
//-430 m), and the ray-march's `sampleDtm - panelDtm` slope needs the real value. Non-finite cells
//still map to NaN.
export function normaliseLocalDtmRaster(
    band:   Float32Array,
    noData: number | null
): Float32Array
{
    const hasNoData = noData !== null && Number.isFinite(noData);
    for (let i = 0; i < band.length; i++)
    {
        const v = band[i];
        if (hasNoData && v === noData) { band[i] = NaN; continue; }
        if (!Number.isFinite(v))       { band[i] = NaN; continue; }
        //finite: leave untouched (negatives are real below-sea elevations, not no-data)
    }
    return band;
}

//Build a per-config LidarSource. Each call returns a fresh object so multiple configs cannot share
//mutable state.
export function createLocalNdsmSource(cfg: LocalNdsmConfig): LidarSource
{
    const { url, minLat, maxLat, minLon, maxLon } = cfg;

    return {
        id:   'local-ndsm',
        name: 'Local nDSM GeoTIFF',
        //Local rasters have no advertised pitch; default to 1 m (common for offline-prepped LiDAR
        //grids). The engine still scales rasterSize off this via the precision knob, so a finer
        //source can be exercised by picking "high" precision in the editor.
        nativeCellPitchMeters: 1.0,

        covers(lat: number, lon: number): boolean
        {
            return lat >= minLat && lat <= maxLat
                && lon >= minLon && lon <= maxLon;
        },

        async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
        {
            //Clamp the requested raster size to the same bounds every other provider uses. The
            //configured bbox is the geographic frame at runtime; the GeoTIFF is resampled to
            //rasterSize x rasterSize regardless of its own georeferencing.
            const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
                Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

            let band:    Float32Array | null;
            let terrain: Float32Array | null;
            let noData:  number | null;
            try
            {
                const r = await fetchFloat32GeoTiffWithNoData(url, rasterSize, opts.signal);
                band    = r ? r.data    : null;
                terrain = r ? r.terrain : null;
                noData  = r ? r.noData  : null;
            }
            catch (err)
            {
                console.warn('[HELIOS] local-nDSM fetch threw at', url, err);
                return emptyResult();
            }
            if (!band)
            {
                console.warn('[HELIOS] local-nDSM fetch returned no data for', url, '(check the URL is reachable from the browser and serves a Float32 GeoTIFF / COG).');
                return emptyResult();
            }
            if (band.length < rasterSize * rasterSize)
            {
                console.warn('[HELIOS] local-nDSM raster too small at', url, '(got', band.length, 'cells, expected', rasterSize * rasterSize, '). The GeoTIFF is likely below the minimum resolution for the requested precision.');
                return emptyResult();
            }

            normaliseLocalNdsmRaster(band, noData);
            //Same nodata sentinel for both bands: noData reads from band 1's GDAL_NODATA tag, which
            //the pipeline writes identically on band 2.
            if (terrain && terrain.length >= rasterSize * rasterSize)
            {
                normaliseLocalDtmRaster(terrain, noData);
            }
            else
            {
                terrain = null;
            }

            return processHeightRaster(band, {
                rasterSize,
                minLat,
                maxLat,
                minLon,
                maxLon,
                homeLat:          opts.homeLat,
                homeLon:          opts.homeLon,
                cropRadiusMeters: opts.cropRadiusMeters
            }, {}, terrain ?? undefined);
        }
    };
}
