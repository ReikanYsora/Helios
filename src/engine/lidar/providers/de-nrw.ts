//Geobasis NRW nDOM shadow source for Nordrhein-Westfalen.
//
//NRW publishes its nDOM (surface model normalised to height-above-ground) as a free WCS
//coverage (DLDE-Zero-2.0), no API key. Same shape as France's IGN provider: a single layer
//already holding heights above ground, so no DSM-DTM round-trip. Routes through the GeoTIFF
//helper (not IGN's BIL fast path) since the upstream serves single-band Float32 GeoTIFF.
//
//We use the WCS endpoint, not WMS: the NRW WMS returns RGB-rendered TIFF (visualisation,
//not data). WCS GetCoverage with SCALESIZE controls raster size while preserving floats.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { fetchFloat32GeoTiff } from '../geotiff';

const WCS_URL    = 'https://www.wcs.nrw.de/geobasis/wcs_nw_ndom';
const COVERAGE   = 'nw_ndom';

//Nordrhein-Westfalen bbox, padded slightly so border homes still fetch. WCS returns an
//empty/clipped raster outside coverage, so the worst case is no polygons, not a misread.
const NRW_BBOX = { minLat: 50.30, maxLat: 52.55, minLon: 5.85, maxLon: 9.50 };

export const nrwLidarNdom: LidarSource =
{
    id:   'de-nrw-ndom',
    name: 'Geobasis NRW nDOM (Nordrhein-Westfalen)',
    //Geobasis NRW nDOM is published on a 1 m grid.
    nativeCellPitchMeters: 1.0,

    covers(lat: number, lon: number): boolean
    {
        return lat >= NRW_BBOX.minLat && lat <= NRW_BBOX.maxLat
            && lon >= NRW_BBOX.minLon && lon <= NRW_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        if (bbox.maxLat < NRW_BBOX.minLat || bbox.minLat > NRW_BBOX.maxLat
         || bbox.maxLon < NRW_BBOX.minLon || bbox.minLon > NRW_BBOX.maxLon)
        {
            return emptyResult();
        }

        //WCS 2.0.1 SUBSET axis labels are Long / Lat for EPSG:4326 here. SCALESIZE pins the
        //output to rasterSize x rasterSize so downstream indexing is uniform across providers.
        const params = new URLSearchParams({
            SERVICE:       'WCS',
            VERSION:       '2.0.1',
            REQUEST:       'GetCoverage',
            COVERAGEID:    COVERAGE,
            FORMAT:        'image/tiff',
            SUBSETTINGCRS: 'http://www.opengis.net/def/crs/EPSG/0/4326'
        });
        //Two distinct SUBSET= params (one per axis), appended explicitly so URLSearchParams
        //keeps them as duplicates rather than collapsing them.
        params.append('SUBSET',    `Long(${bbox.minLon},${bbox.maxLon})`);
        params.append('SUBSET',    `Lat(${bbox.minLat},${bbox.maxLat})`);
        params.append('SCALESIZE', `Long(${rasterSize}),Lat(${rasterSize})`);

        const heights = await fetchFloat32GeoTiff(
            `${WCS_URL}?${params.toString()}`,
            rasterSize,
            opts.signal
        );
        if (!heights)
        {
            return emptyResult();
        }

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
