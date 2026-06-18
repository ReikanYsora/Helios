//Vermont Center for Geographic Information (VCGI) nDSM shadow source, the first US-state
//native provider in Helios.
//
//VCGI's statewide nDSM (metres-above-ground, from the 2013-2017 QL2 0.7 m LiDAR) via a
//public ArcGIS Image Server. Single-fetch, no subtraction, no auth, no API key. Returns
//Float32 pixels and reprojects from any input SR (we send and receive EPSG:4326).
//
//Coverage: state of Vermont, 0.7 m pixel pitch on the upstream cache.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { fetchFloat32GeoTiff } from '../geotiff';

const IMG_URL   = 'https://maps.vcgi.vermont.gov/arcgis/rest/services/EGC_services/IMG_VCGI_LIDARNDSM_WM_CACHE_v1/ImageServer/exportImage';

//Vermont bbox, padded into neighbouring borders. The service returns no-data outside the
//state mosaic, so over-fetching is free.
const VT_BBOX = { minLat: 42.65, maxLat: 45.10, minLon: -73.50, maxLon: -71.40 };

export const vermontVcgiNdsm: LidarSource =
{
    id:   'us-vt-vcgi-ndsm',
    name: 'VCGI nDSM (Vermont, USA)',
    //VCGI's statewide nDSM cache is published at 0.7 m pixel pitch.
    nativeCellPitchMeters: 0.7,

    covers(lat: number, lon: number): boolean
    {
        return lat >= VT_BBOX.minLat && lat <= VT_BBOX.maxLat
            && lon >= VT_BBOX.minLon && lon <= VT_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        if (bbox.maxLat < VT_BBOX.minLat || bbox.minLat > VT_BBOX.maxLat
         || bbox.maxLon < VT_BBOX.minLon || bbox.minLon > VT_BBOX.maxLon)
        {
            return emptyResult();
        }

        //ArcGIS exportImage. bbox in lon-lat order (xmin, ymin, xmax, ymax) with bboxSR=4326.
        //Upstream is cached in Web Mercator but reprojects transparently for imageSR=4326.
        //format=tiff + pixelType=F32 returns a Float32 GeoTIFF. The nDSM is already
        //metres-above-ground, so the pipeline gets the height raster directly (no subtraction).
        const params = new URLSearchParams({
            bbox:          `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
            bboxSR:        '4326',
            imageSR:       '4326',
            size:          `${rasterSize},${rasterSize}`,
            format:        'tiff',
            pixelType:     'F32',
            interpolation: 'RSP_BilinearInterpolation',
            f:             'image'
        });

        const heights = await fetchFloat32GeoTiff(
            `${IMG_URL}?${params.toString()}`,
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
