//Baden-Württemberg LGL DOM5 + DGM1 shadow source.
//
//Two INSPIRE-themed WCS coverages (DLDE-BY-2.0) on `owsproxy.lgl-bw.de`: DOM5 (surface,
//5 m) and DGM1 (terrain, 1 m), both Float32 GeoTIFF. Both publish through the INSPIRE
//elevation theme, so the CoverageId is the generic `EL.ElevationGridCoverage` on each
//endpoint (the URL differentiates DOM from DGM, not the id).
//
//The service rejects EPSG:4326 axis-label subsetting and requires native UTM 32N
//(EPSG:25832), so we project the bbox client-side via proj.ts. The pipeline resamples
//both onto the same SCALESIZE grid before subtracting; effective resolution is bounded
//by the coarser DOM (5 m).

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { fetchFloat32GeoTiff, subtractRasters } from '../geotiff';
import { getEpsg, projectBbox } from '../proj';

const DOM_URL   = 'https://owsproxy.lgl-bw.de/owsproxy/wcs/WCS_INSP_BW_Hoehe_Coverage_DOM5';
const DGM_URL   = 'https://owsproxy.lgl-bw.de/owsproxy/wcs/WCS_INSP_BW_Hoehe_Coverage_DGM1';
//Both INSPIRE-themed coverages use the generic theme coverage id.
const COVERAGE  = 'EL.ElevationGridCoverage';

//Baden-Württemberg bbox, padded into neighbouring borders so edge homes still fetch.
//WCS returns no-data outside the state mosaic.
const BW_BBOX = { minLat: 47.50, maxLat: 49.85, minLon: 7.45, maxLon: 10.55 };

export const badenWurttembergLgl: LidarSource =
{
    id:   'de-bw-lgl',
    name: 'LGL BW DOM5 + DGM1 (Baden-Württemberg)',
    //Subtracted output is bounded by the coarser DOM grid, so declare 5 m as the pitch.
    nativeCellPitchMeters: 5.0,

    covers(lat: number, lon: number): boolean
    {
        return lat >= BW_BBOX.minLat && lat <= BW_BBOX.maxLat
            && lon >= BW_BBOX.minLon && lon <= BW_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        if (bbox.maxLat < BW_BBOX.minLat || bbox.minLat > BW_BBOX.maxLat
         || bbox.maxLon < BW_BBOX.minLon || bbox.minLon > BW_BBOX.maxLon)
        {
            return emptyResult();
        }

        const epsg = getEpsg(25832);
        if (!epsg)
        {
            return emptyResult();
        }
        const proj = projectBbox(bbox, epsg);

        //Spatial axes "E N" (UTM easting/northing), grid axes "X Y" (uppercase). Hardcoded
        //per server; no two national INSPIRE proxies agree on axis conventions.
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
            params.append('SUBSET',    `E(${proj.minX.toFixed(2)},${proj.maxX.toFixed(2)})`);
            params.append('SUBSET',    `N(${proj.minY.toFixed(2)},${proj.maxY.toFixed(2)})`);
            params.append('SCALESIZE', `X(${rasterSize}),Y(${rasterSize})`);
            return `${base}?${params.toString()}`;
        };

        const [dom, dgm] = await Promise.all([
            fetchFloat32GeoTiff(buildUrl(DOM_URL), rasterSize, opts.signal),
            fetchFloat32GeoTiff(buildUrl(DGM_URL), rasterSize, opts.signal)
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
        }, {
            //Coarse DOM grid puts 2-5 m noise on building edges and low vegetation. Median
            //pre-filter kills isolated spikes; 7 m threshold skips tall scrub and garden sheds.
            medianSmooth:  true,
            heightThreshM: 7,
        });
    }
};
