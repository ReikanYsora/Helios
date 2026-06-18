//Vlaanderen DHMVII OpenLiDAR shadow source for Flanders, Belgium.
//
//Digitaal Vlaanderen DHMVII (2013-2015, 1 m) via a GeoServer WCS: DSM_1M and DEM_1M (DTM),
//both heights above sea level, so subtracting yields the metres-above-ground raster the
//pipeline needs. Native CRS is EPSG:31370 (Belgian Lambert 72); the service rejects
//EPSG:4326 axis-label subsetting so we project the bbox client-side via proj.ts.
//
//Wallonia is a known gap: its geoportal only exposes RGB hillshade ArcGIS MapServers, no
//Float32 elevation endpoint. Open data, CC-BY-equivalent, no API key.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { fetchFloat32GeoTiff, subtractRasters } from '../geotiff';
import { getEpsg, projectBbox } from '../proj';

const WCS_URL = 'https://remotesensing.vlaanderen.be/services/openlidar/wcs';
const DSM_COV = 'openlidar__LiDAR_DHMV_II_DSM_1M';
const DTM_COV = 'openlidar__LiDAR_DHMV_II_DEM_1M';

//Flanders bbox, padded into neighbouring borders so edge homes still fetch. WCS returns
//no-data outside the regional mosaic, so over-fetching is cheap; the layer is
//Flanders-only server-side, so no risk of covering Wallonia.
const FL_BBOX = { minLat: 50.65, maxLat: 51.55, minLon: 2.50, maxLon: 5.95 };

export const flandersDhmv2: LidarSource =
{
    id:   'be-fl-dhmv2',
    name: 'Digitaal Vlaanderen DHMVII (Flanders, Belgium)',
    //DSM_1M and DEM_1M are published on a 1 m grid.
    nativeCellPitchMeters: 1.0,

    covers(lat: number, lon: number): boolean
    {
        return lat >= FL_BBOX.minLat && lat <= FL_BBOX.maxLat
            && lon >= FL_BBOX.minLon && lon <= FL_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        if (bbox.maxLat < FL_BBOX.minLat || bbox.minLat > FL_BBOX.maxLat
         || bbox.maxLon < FL_BBOX.minLon || bbox.minLon > FL_BBOX.maxLon)
        {
            return emptyResult();
        }

        const epsg = getEpsg(31370);
        if (!epsg)
        {
            return emptyResult();
        }
        const proj = projectBbox(bbox, epsg);

        //This GeoServer advertises spatial axes "X Y" (uppercase) and grid axes "i j".
        const buildUrl = (cov: string): string =>
        {
            const params = new URLSearchParams({
                SERVICE:       'WCS',
                VERSION:       '2.0.1',
                REQUEST:       'GetCoverage',
                COVERAGEID:    cov,
                FORMAT:        'image/tiff',
                SUBSETTINGCRS: epsg.urn
            });
            params.append('SUBSET',    `X(${proj.minX.toFixed(2)},${proj.maxX.toFixed(2)})`);
            params.append('SUBSET',    `Y(${proj.minY.toFixed(2)},${proj.maxY.toFixed(2)})`);
            params.append('SCALESIZE', `i(${rasterSize}),j(${rasterSize})`);
            return `${WCS_URL}?${params.toString()}`;
        };

        const [dsm, dtm] = await Promise.all([
            fetchFloat32GeoTiff(buildUrl(DSM_COV), rasterSize, opts.signal),
            fetchFloat32GeoTiff(buildUrl(DTM_COV), rasterSize, opts.signal)
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
        }, {
            //Same DSM-DTM noise profile as the Austrian and BW pipelines. Median pre-filter
            //+ 7 m threshold matches the other subtraction-based providers for consistency.
            medianSmooth:  true,
            heightThreshM: 7,
        });
    }
};
