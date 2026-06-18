//Land Steiermark ALS shadow source for Styria, Austria.
//
//Styria's ALS-derived elevation via a pair of ArcGIS-backed WCS services, free open data,
//no API key: ALSHoeheninformation_1m_UTM33N (DSM) and ALSGelaendeinformation_1m_UTM33N
//(DTM). Each exposes four coverages; "Coverage4" is the state-wide Gesamtmodell mosaic (the
//first three are project-scoped subsets and hillshades). We fetch Coverage4 from each and
//subtract to derive metres-above-ground, the same DSM-DTM pattern as UK / NL / NO.
//
//Native CRS is EPSG:32633 (UTM 33N); the service rejects EPSG:4326 axis-label subsetting so
//we project the bbox client-side via proj.ts.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { fetchFloat32GeoTiff, subtractRasters } from '../geotiff';
import { getEpsg, projectBbox } from '../proj';

const DOM_URL   = 'https://gis.stmk.gv.at/arcgis/services/OGD/ALSHoeheninformation_1m_UTM33N/MapServer/WCSServer';
const DTM_URL   = 'https://gis.stmk.gv.at/arcgis/services/OGD/ALSGelaendeinformation_1m_UTM33N/MapServer/WCSServer';
const COVERAGE  = 'Coverage4';

//Styria bbox, padded so border homes still fetch. WCS returns no-data outside the state's
//mosaic, so over-fetching is free.
const AT_STMK_BBOX = { minLat: 46.55, maxLat: 47.85, minLon: 13.50, maxLon: 16.20 };

export const austriaSteiermarkAls: LidarSource =
{
    id:   'at-stmk-als',
    name: 'Land Steiermark ALS (Styria, Austria)',
    //ALS Höhen-/Geländeinformation are published on a 1 m grid.
    nativeCellPitchMeters: 1.0,

    covers(lat: number, lon: number): boolean
    {
        return lat >= AT_STMK_BBOX.minLat && lat <= AT_STMK_BBOX.maxLat
            && lon >= AT_STMK_BBOX.minLon && lon <= AT_STMK_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        if (bbox.maxLat < AT_STMK_BBOX.minLat || bbox.minLat > AT_STMK_BBOX.maxLat
         || bbox.maxLon < AT_STMK_BBOX.minLon || bbox.minLon > AT_STMK_BBOX.maxLon)
        {
            return emptyResult();
        }

        const epsg = getEpsg(32633);
        if (!epsg)
        {
            return emptyResult();
        }
        const proj = projectBbox(bbox, epsg);

        //ArcGIS WCSServer advertises lowercase "x y" for both spatial and grid axes, regardless of the projection family.
        const buildUrl = (base: string): string =>
        {
            const params = new URLSearchParams({
                SERVICE:       'WCS',
                VERSION:       '2.0.1',
                REQUEST:       'GetCoverage',
                COVERAGEID:    COVERAGE,
                FORMAT:        'image/tiff',
                SUBSETTINGCRS: epsg.urn
            });
            params.append('SUBSET',    `x(${proj.minX.toFixed(2)},${proj.maxX.toFixed(2)})`);
            params.append('SUBSET',    `y(${proj.minY.toFixed(2)},${proj.maxY.toFixed(2)})`);
            params.append('SCALESIZE', `x(${rasterSize}),y(${rasterSize})`);
            return `${base}?${params.toString()}`;
        };

        const [dom, dtm] = await Promise.all([
            fetchFloat32GeoTiff(buildUrl(DOM_URL), rasterSize, opts.signal),
            fetchFloat32GeoTiff(buildUrl(DTM_URL), rasterSize, opts.signal)
        ]);
        if (!dom || !dtm)
        {
            return emptyResult();
        }

        const heights = subtractRasters(dom, dtm);

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
            //The Steiermark mosaic carries low residuals over forest and farmland that
            //saturate the default 5 m threshold (>80 % of cells passing). Median pre-filter
            //+ 7 m threshold recovers building-tree separation without losing real roofs.
            medianSmooth:  true,
            heightThreshM: 7,
        });
    }
};
