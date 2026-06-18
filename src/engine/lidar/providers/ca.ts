//NRCan HRDEM Mosaic shadow source for Canada.
//
//Natural Resources Canada's HRDEM via a GeoServer WCS 1.1.1 endpoint, free open data, no
//API key. Same single-coverage shape as France / NRW / Poland: we pull the "dsm" coverage
//which already holds absolute surface heights, so we skip the DSM-minus-DTM round-trip and
//let the pipeline derive a height threshold from the home's local terrain.
//
//Resolution is 1 m in the LiDAR-sourced populated south, coarser further north; the
//upstream interpolates when the requested grid is denser than the source.
//
//NRCan's GeoServer only exposes WCS 1.1.1, which uses BoundingBox + GridOrigin +
//GridOffsets rather than 2.0.1's SUBSET / SCALESIZE. Same math, different envelope.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { fetchFloat32GeoTiff } from '../geotiff';

const WCS_URL    = 'https://datacube.services.geo.ca/ows/elevation';
const COVERAGE   = 'dsm';

//Canada bbox padded into Alaska + the Atlantic to catch coastal homes. WCS returns no-data
//outside actual coverage (and HRDEM is patchy in the far north), so over-fetching is free.
const CA_BBOX = { minLat: 41.5, maxLat: 84.0, minLon: -141.5, maxLon: -52.0 };

export const canadaHrdem: LidarSource =
{
    id:   'ca-nrcan-hrdem',
    name: 'NRCan HRDEM (Canada)',
    //Declare 1 m (the LiDAR-derived south) so high-precision requests don't downsample
    //where the source is finer.
    nativeCellPitchMeters: 1.0,

    covers(lat: number, lon: number): boolean
    {
        return lat >= CA_BBOX.minLat && lat <= CA_BBOX.maxLat
            && lon >= CA_BBOX.minLon && lon <= CA_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        if (bbox.maxLat < CA_BBOX.minLat || bbox.minLat > CA_BBOX.maxLat
         || bbox.maxLon < CA_BBOX.minLon || bbox.minLon > CA_BBOX.maxLon)
        {
            return emptyResult();
        }

        //WCS 1.1.1 GetCoverage. This GeoServer expects BoundingBox in (lat_min, lon_min,
        //lat_max, lon_max) order for EPSG:4326, not the usual lon-first convention; mixing
        //them yields a 500 "ExtentRangeError: xmin must be less than xmax". Format must be
        //`image/geotiff` (the server rejects `image/tiff`). GridOrigin is the top-left
        //corner in the same lat,lon order; GridOffsets is "delta_lat delta_lon" with
        //delta_lat negative because the grid scans top-to-bottom.
        const deltaLat = (bbox.maxLat - bbox.minLat) / rasterSize;
        const deltaLon = (bbox.maxLon - bbox.minLon) / rasterSize;

        const params = new URLSearchParams({
            SERVICE:      'WCS',
            VERSION:      '1.1.1',
            REQUEST:      'GetCoverage',
            IDENTIFIER:   COVERAGE,
            FORMAT:       'image/geotiff',
            BOUNDINGBOX:  `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon},urn:ogc:def:crs:EPSG::4326`,
            GRIDBASECRS:  'urn:ogc:def:crs:EPSG::4326',
            GRIDCS:       'urn:ogc:def:cs:OGC:0.0:Grid2dSquareCS',
            GRIDTYPE:     'urn:ogc:def:method:WCS:1.1:2dSimpleGrid',
            GRIDORIGIN:   `${bbox.maxLat},${bbox.minLon}`,
            GRIDOFFSETS:  `${-deltaLat},${deltaLon}`
        });

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
