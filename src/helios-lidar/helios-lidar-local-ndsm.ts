//Generic local nDSM GeoTIFF / COG shadow source.
//
//Unlike the country-specific providers, this one is not registered in
//the static LIDAR_SOURCES list. The engine builds it on demand from
//the user's card config (via resolveLidarSource()) when, and only
//when, every `lidar-local-ndsm-*` key in the config validates:
//provider enabled, raster URL present, full EPSG:4326 bbox with
//min < max on both axes and both axes inside legal ranges.
//
//The raster is interpreted as "height above ground in metres" (an
//nDSM = DSM - DTM, prepared offline). A bare-earth DEM/DTM is not
//valid input. Cells whose source value matches the file's
//GDAL_NODATA tag are mapped to NaN so the shared pipeline skips
//them; non-finite source values stay NaN; finite negatives are
//clamped to 0 (valid ground); finite non-negatives pass through
//unchanged.
//
//Decoding goes through fetchFloat32GeoTiffWithNoData(), which is a
//thin extension of the existing fetchFloat32GeoTiff() that also
//returns the parsed GDAL_NODATA sentinel from the GeoTIFF metadata
//(or null when the tag is absent). The original helper is left
//untouched so every existing provider keeps the exact same byte
//path.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../helios-lidar';
import {
    processHeightRaster,
    emptyResult,
    RASTER_DEFAULTS
} from './helios-lidar-pipeline';
import { fetchFloat32GeoTiffWithNoData } from './helios-lidar-geotiff';

//Fully-validated local nDSM configuration. Produced by
//validateLocalNdsmConfig() in helios-lidar.ts. The factory below
//treats every field as already vetted (URL non-empty, bbox finite
//and ordered, inside EPSG:4326 ranges).
export interface LocalNdsmConfig
{
    url:    string;
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

//Normalise the resampled Float32Array in place. Exported so the
//behaviour is verifiable from a unit-level test:
//
//  - source value == nodata sentinel        -> NaN
//  - source value is NaN / +/-Infinity      -> NaN
//  - finite negative                        -> 0 (valid ground)
//  - finite non-negative                    -> unchanged
//
//Run exactly once on the resampled raster before processHeightRaster()
//consumes it; resampling does not happen after normalisation.
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
        //finite, non-negative: leave untouched.
    }
    return band;
}

//Build a per-config LidarSource. Each call returns a fresh object so
//multiple configs (today: at most one, but the seam is generic)
//cannot share mutable state.
export function createLocalNdsmSource(cfg: LocalNdsmConfig): LidarSource
{
    const { url, minLat, maxLat, minLon, maxLon } = cfg;

    return {
        id:   'local-ndsm',
        name: 'Local nDSM GeoTIFF',

        covers(lat: number, lon: number): boolean
        {
            return lat >= minLat && lat <= maxLat
                && lon >= minLon && lon <= maxLon;
        },

        async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
        {
            //Clamp the requested raster size to the same bounds the
            //pipeline uses for every other provider; the configured
            //bbox is the geographic frame at runtime (the GeoTIFF is
            //resampled to rasterSize x rasterSize regardless of its
            //own georeferencing).
            const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
                Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

            let band: Float32Array | null;
            let noData: number | null;
            try
            {
                const r = await fetchFloat32GeoTiffWithNoData(url, rasterSize, opts.signal);
                band   = r ? r.data   : null;
                noData = r ? r.noData : null;
            }
            catch (_)
            {
                return emptyResult();
            }
            if (!band || band.length < rasterSize * rasterSize) return emptyResult();

            normaliseLocalNdsmRaster(band, noData);

            return processHeightRaster(band, {
                rasterSize,
                minLat,
                maxLat,
                minLon,
                maxLon,
                homeLat:          opts.homeLat,
                homeLon:          opts.homeLon,
                cropRadiusMeters: opts.cropRadiusMeters
            });
        }
    };
}
