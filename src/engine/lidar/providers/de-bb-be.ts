//Land Brandenburg LGB bDOM + DGM shadow source.
//
//Brandenburg's LGB publishes two WCS 2.0.1 coverages on `isk.geobasis-bb.de/ows/` (DLDE-BY-
//2.0): bdom_wcs (image-based DSM, 1 m) and dgm_wcs (terrain, 1 m), both spanning Brandenburg
//+ Berlin. Both publish heights above sea level (Float32 GeoTIFF), so we fetch and subtract
//for metres-above-ground, same shape as UK / NL / NO / AT-Stmk.
//
//EPSG:4326 is supported natively, keeping the URL builder uniform with the OGC providers.
//One WCS covers both Lands, so a single integration serves Brandenburg + Berlin.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { fetchFloat32GeoTiff, subtractRasters } from '../geotiff';

const DOM_URL   = 'https://isk.geobasis-bb.de/ows/bdom_wcs';
const DGM_URL   = 'https://isk.geobasis-bb.de/ows/dgm_wcs';
const DOM_COV   = 'bb_bdom';
const DGM_COV   = 'bb_dgm';

//Brandenburg + Berlin bbox, padded so border homes still fetch. WCS clips silently outside
//the actual mosaic.
const BB_BE_BBOX = { minLat: 51.36, maxLat: 53.56, minLon: 11.27, maxLon: 14.77 };

export const brandenburgBerlinDom: LidarSource =
{
    id:   'de-bb-be-bdom',
    name: 'LGB bDOM + DGM (Brandenburg + Berlin)',
    //bDOM + DGM are both published on a 1 m grid.
    nativeCellPitchMeters: 1.0,

    covers(lat: number, lon: number): boolean
    {
        return lat >= BB_BE_BBOX.minLat && lat <= BB_BE_BBOX.maxLat
            && lon >= BB_BE_BBOX.minLon && lon <= BB_BE_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        if (bbox.maxLat < BB_BE_BBOX.minLat || bbox.minLat > BB_BE_BBOX.maxLat
         || bbox.maxLon < BB_BE_BBOX.minLon || bbox.minLon > BB_BE_BBOX.maxLon)
        {
            return emptyResult();
        }

        const buildUrl = (base: string, cov: string): string =>
        {
            const params = new URLSearchParams({
                SERVICE:       'WCS',
                VERSION:       '2.0.1',
                REQUEST:       'GetCoverage',
                COVERAGEID:    cov,
                FORMAT:        'image/tiff',
                SUBSETTINGCRS: 'http://www.opengis.net/def/crs/EPSG/0/4326'
            });
            params.append('SUBSET',    `Long(${bbox.minLon},${bbox.maxLon})`);
            params.append('SUBSET',    `Lat(${bbox.minLat},${bbox.maxLat})`);
            params.append('SCALESIZE', `Long(${rasterSize}),Lat(${rasterSize})`);
            return `${base}?${params.toString()}`;
        };

        const [dom, dgm] = await Promise.all([
            fetchFloat32GeoTiff(buildUrl(DOM_URL, DOM_COV), rasterSize, opts.signal),
            fetchFloat32GeoTiff(buildUrl(DGM_URL, DGM_COV), rasterSize, opts.signal)
        ]);
        if (!dom || !dgm)
        {
            return emptyResult();
        }

        const heights = subtractRasters(dom, dgm);

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
