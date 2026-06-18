//PDOK AHN4 shadow source for the Netherlands.
//
//Rijkswaterstaat's AHN4 (surveyed 2020-2022) via a WCS 2.0.1 endpoint, two coverages at
//0.5 m: dsm_05m (surface) and dtm_05m (terrain). Like the UK, this is separate DSM / DTM
//rasters rather than a pre-computed normalised height, so we fetch both, subtract per pixel,
//and feed the height-above-ground array to the pipeline.
//
//Coverage: mainland Netherlands; BES islands aren't on AHN and the bbox-clip excludes them.
//EPSG:4326 and EPSG:28992 are advertised; we pin to 4326 to keep the builder uniform.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { fetchFloat32GeoTiff, subtractRasters } from '../geotiff';

const WCS_URL = 'https://service.pdok.nl/rws/ahn/wcs/v1_0';
const COVERAGE_DSM = 'dsm_05m';
const COVERAGE_DTM = 'dtm_05m';

//Mainland NL bbox, padded for Wadden Islands and the Maas estuary.
//BES islands (Bonaire, Saba, Sint Eustatius) are intentionally
//excluded, AHN doesn't cover them.
const NL_BBOX = { minLat: 50.7, maxLat: 53.8, minLon: 3.1, maxLon: 7.3 };

export const netherlandsAhn4: LidarSource =
{
    id:   'nl-pdok-ahn4',
    name: 'PDOK AHN4 (Netherlands)',
    //AHN4 dsm_05m / dtm_05m are published on a 0.5 m grid.
    nativeCellPitchMeters: 0.5,

    covers(lat: number, lon: number): boolean
    {
        return lat >= NL_BBOX.minLat && lat <= NL_BBOX.maxLat
            && lon >= NL_BBOX.minLon && lon <= NL_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        if (bbox.maxLat < NL_BBOX.minLat || bbox.minLat > NL_BBOX.maxLat
         || bbox.maxLon < NL_BBOX.minLon || bbox.minLon > NL_BBOX.maxLon)
        {
            return emptyResult();
        }

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
            return `${WCS_URL}?${params.toString()}`
                + `&SUBSET=Lat(${bbox.minLat},${bbox.maxLat})`
                + `&SUBSET=Long(${bbox.minLon},${bbox.maxLon})`
                + `&SCALESIZE=Lat(${rasterSize}),Long(${rasterSize})`;
        };

        const [dsm, dtm] = await Promise.all([
            fetchFloat32GeoTiff(buildUrl(COVERAGE_DSM), rasterSize, opts.signal),
            fetchFloat32GeoTiff(buildUrl(COVERAGE_DTM), rasterSize, opts.signal)
        ]);
        if (!dsm || !dtm)
        {
            return emptyResult();
        }

        const heights = subtractRasters(dsm, dtm);

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
