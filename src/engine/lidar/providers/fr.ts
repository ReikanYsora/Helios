//IGN LiDAR HD shadow source for metropolitan France + Corsica.
//
//IGN's Geoplateforme exposes the LiDAR HD survey via an OGC WMS-Raster endpoint. We fetch
//the MNH product (heights of objects above bare terrain): a pixel of 8.5 means something
//8.5 m tall sits there, lumping trees, hedges and buildings together.
//
//Unique among our providers: IGN's WMS-R supports FORMAT=image/x-bil;bits=32, streaming the
//raster as raw little-endian float32 with no header or parser. The others serve image/tiff
//via the GeoTIFF helper.

import type {
    LidarSource,
    LidarShadowFetchOptions,
    LidarShadowResult
} from '../../lidar';
import { processHeightRaster, homeBbox, emptyResult, RASTER_DEFAULTS } from '../pipeline';
import { lidarFetchUrl } from '../proxy';

const WMS_URL    = 'https://data.geopf.fr/wms-r';
const LAYER_MNH  = 'IGNF_LIDAR-HD_MNH_ELEVATION.ELEVATIONGRIDCOVERAGE.WGS84G';

//Metropolitan France + Corsica bbox, padded ~0.3 deg so coastal home points still fetch.
const FR_BBOX = { minLat: 41.0, maxLat: 51.5, minLon: -5.5, maxLon: 9.8 };

export const franceLidarHd: LidarSource =
{
    id:   'fr-ign-lidarhd',
    name: 'IGN LiDAR HD (France)',
    //IGN LiDAR HD MNH is published on a 0.5 m grid.
    nativeCellPitchMeters: 0.5,

    covers(lat: number, lon: number): boolean
    {
        return lat >= FR_BBOX.minLat && lat <= FR_BBOX.maxLat
            && lon >= FR_BBOX.minLon && lon <= FR_BBOX.maxLon;
    },

    async fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>
    {
        const rasterSize = Math.min(RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, Math.round(opts.rasterSize)));

        const bbox = homeBbox(opts.homeLat, opts.homeLon, opts.radiusMeters,
            RASTER_DEFAULTS.bboxPadFactor);

        //Bail if the fetch bbox sits entirely outside coverage.
        if (bbox.maxLat < FR_BBOX.minLat || bbox.minLat > FR_BBOX.maxLat
         || bbox.maxLon < FR_BBOX.minLon || bbox.minLon > FR_BBOX.maxLon)
        {
            return emptyResult();
        }

        //WMS 1.3.0 + EPSG:4326 wants axis order (lat, lon) (1.1.1 would want lon, lat). We pin
        //to 1.3.0 so the convention is unambiguous.
        const params = new URLSearchParams({
            SERVICE: 'WMS',
            VERSION: '1.3.0',
            REQUEST: 'GetMap',
            LAYERS:  LAYER_MNH,
            STYLES:  '',
            CRS:     'EPSG:4326',
            BBOX:    `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`,
            WIDTH:   String(rasterSize),
            HEIGHT:  String(rasterSize),
            FORMAT:  'image/x-bil;bits=32'
        });

        let resp: Response;
        try
        {
            resp = await fetch(lidarFetchUrl(`${WMS_URL}?${params.toString()}`), { signal: opts.signal });
        }
        catch (_)
        {
            return emptyResult();
        }
        if (!resp.ok)
        {
            return emptyResult();
        }

        let buf: ArrayBuffer;
        try { buf = await resp.arrayBuffer(); }
        catch (_) { return emptyResult(); }

        //A short response means a ServiceException XML, not the binary raster (typical when
        //the layer name drifts); bail rather than read garbage as floats.
        const expectedBytes = rasterSize * rasterSize * 4;
        if (buf.byteLength < expectedBytes)
        {
            return emptyResult();
        }

        const heights = new Float32Array(buf, 0, rasterSize * rasterSize);

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
