//IGN España PNOA-LiDAR shadow source for Spain.
//
//IGN España's PNOA-LiDAR derivatives via a WCS 2.0.1 endpoint. Unlike the UK/Dutch
//services, IGN already publishes pre-computed normalised surface models (MDSn) per LiDAR
//class: mdsn_v025 (vegetation) and mdsn_e025 (building), both 2.5 m height above ground.
//
//Both cover mainland + Balearics. We fetch both and merge with element-wise MAX: each cell
//is at most one of {vegetation, building, ground}, so the higher of the two is correct.
//
//Excludes Canarias (separate IGN service); those users fall back to MapTiler footprints.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { fetchFloat32GeoTiff, maxRasters } from '../geotiff';

const WCS_URL = 'https://wcs-mds.idee.es/mds';
const COVERAGE_VEG  = 'mdsn_v025';
const COVERAGE_BLD  = 'mdsn_e025';

//Peninsular Spain + Balearics bbox, padded slightly. Canarias is intentionally excluded
//(separate IGN service we don't consume).
const ES_BBOX = { minLat: 35.8, maxLat: 44.0, minLon: -9.6, maxLon: 4.4 };

export const spainPnoaLidar: LidarSource =
{
    id:   'es-ign-pnoa-mdsn',
    name: 'IGN España PNOA-LiDAR MDSn (Spain)',
    //IGN España PNOA-LiDAR MDSn coverages are published on a 2.5 m grid.
    nativeCellPitchMeters: 2.5,

    covers(lat: number, lon: number): boolean
    {
        return lat >= ES_BBOX.minLat && lat <= ES_BBOX.maxLat
            && lon >= ES_BBOX.minLon && lon <= ES_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        if (bbox.maxLat < ES_BBOX.minLat || bbox.minLat > ES_BBOX.maxLat
         || bbox.maxLon < ES_BBOX.minLon || bbox.minLon > ES_BBOX.maxLon)
        {
            return emptyResult();
        }

        //WCS 2.0.1 GetCoverage. Native CRS is EPSG:25830 but EPSG:4326 is supported, so we
        //pin to 4326 to stay in degrees. Subset axes are Lat / Long.
        const buildUrl = (coverage: string): string =>
        {
            const params = new URLSearchParams({
                SERVICE: 'WCS',
                VERSION: '2.0.1',
                REQUEST: 'GetCoverage',
                COVERAGEID: coverage,
                FORMAT:  'image/tiff',
                SUBSETTINGCRS: 'http://www.opengis.net/def/crs/EPSG/0/4326',
                OUTPUTCRS:    'http://www.opengis.net/def/crs/EPSG/0/4326'
            });
            //SUBSET repeats the same key, so we append it manually.
            return `${WCS_URL}?${params.toString()}`
                + `&SUBSET=Lat(${bbox.minLat},${bbox.maxLat})`
                + `&SUBSET=Long(${bbox.minLon},${bbox.maxLon})`
                + `&SCALESIZE=Lat(${rasterSize}),Long(${rasterSize})`;
        };

        const [veg, bld] = await Promise.all([
            fetchFloat32GeoTiff(buildUrl(COVERAGE_VEG), rasterSize, opts.signal),
            fetchFloat32GeoTiff(buildUrl(COVERAGE_BLD), rasterSize, opts.signal)
        ]);
        if (!veg && !bld)
        {
            return emptyResult();
        }

        //If one coverage is missing (transient WCS hiccup) still consume the other; the
        //merge handles a missing operand.
        const heights = (veg && bld)
            ? maxRasters(veg, bld)
            : (veg ?? bld!);

        return processHeightRaster(heights, {
            rasterSize,
            minLat:           bbox.minLat,
            maxLat:           bbox.maxLat,
            minLon:           bbox.minLon,
            maxLon:           bbox.maxLon,
            homeLat:          opts.homeLat,
            homeLon:          opts.homeLon,
            cropRadiusMeters: opts.cropRadiusMeters
        });
    }
};
