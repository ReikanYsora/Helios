//Float32 GeoTIFF fetch + decode helper for providers that expose LiDAR as
//image/tiff (UK, NL, NO, ES). The French IGN provider stays on the BIL float32
//fast path because its WMS advertises that format directly.
//
//Resample to exactly `rasterSize × rasterSize` via nearest-neighbour: upstream
//WCS/WMS may return an off-by-one grid (some servers round bbox to native pixel
//edges instead of honouring requested width/height). Nearest-neighbour is
//correct for height samples; averaging would bleed building edges over ground.

import { fromArrayBuffer } from 'geotiff';

import { lidarFetchUrl } from './proxy';


//Extract the image/tiff binary part from a WCS 2.0 multipart/related response;
//null when no TIFF magic found. We scan for the TIFF magic (II*\0 or MM\0*) and
//take from the first match to just before the trailing boundary marker. Covers
//every multipart flavour seen (GeoServer two-part, ArcGIS WCSServer header-less,
//INSPIRE proxies with extra parts) without parsing per-part MIME headers, whose
//conventions vary too much between OGC implementations to chase.
function extractMultipartTiff(buf: ArrayBuffer, contentType: string): ArrayBuffer | null
{
    const bytes = new Uint8Array(buf);

    //Find TIFF magic anywhere in the buffer.
    let magic = -1;
    for (let i = 0; i < bytes.length - 4; i++)
    {
        if ((bytes[i] === 0x49 && bytes[i + 1] === 0x49
             && bytes[i + 2] === 0x2A && bytes[i + 3] === 0x00)
         || (bytes[i] === 0x4D && bytes[i + 1] === 0x4D
             && bytes[i + 2] === 0x00 && bytes[i + 3] === 0x2A))
        {
            magic = i;
            break;
        }
    }
    if (magic < 0)
    {
        return null;
    }

    //Find the trailing boundary marker to drop the closing preamble + footer.
    //Fall back to end-of-buffer when the content-type omits the boundary param
    //(some servers use multipart-ish framing without declaring it).
    const m = contentType.match(/boundary=("?)([^";]+)\1/);
    let bodyEnd = bytes.length;
    if (m)
    {
        const boundary = '--' + m[2];
        const boundaryBytes = new TextEncoder().encode(boundary);
        //Search after the TIFF magic; the last boundary (typically `--wcs--`)
        //sits just past the binary body.
        for (let i = magic + 4; i <= bytes.length - boundaryBytes.length; i++)
        {
            let match = true;
            for (let j = 0; j < boundaryBytes.length; j++)
            {
                if (bytes[i + j] !== boundaryBytes[j]) { match = false; break; }
            }
            if (match) { bodyEnd = i; break; }
        }
    }

    //Trim trailing CRLF/LF before the closing boundary.
    while (bodyEnd > magic && (bytes[bodyEnd - 1] === 0x0d || bytes[bodyEnd - 1] === 0x0a))
    {
        bodyEnd--;
    }
    return buf.slice(magic, bodyEnd);
}

export async function fetchFloat32GeoTiff(
    url:        string,
    rasterSize: number,
    signal?:    AbortSignal
): Promise<Float32Array | null>
{
    let resp: Response;
    try
    {
        resp = await fetch(lidarFetchUrl(url), { signal });
    }
    catch (_)
    {
        return null;
    }
    if (!resp.ok)
    {
        return null;
    }

    let buf: ArrayBuffer;
    try { buf = await resp.arrayBuffer(); }
    catch (_) { return null; }

    //A short response is likely an XML error page (ServiceException), not a
    //binary GeoTIFF; bail rather than feed garbage to the parser.
    if (buf.byteLength < 200)
    {
        return null;
    }

    //WCS 2.0 servers (Austrian ALS, some ArcGIS WCSServer) wrap the GeoTIFF in
    //a multipart/related envelope alongside a GML part. The content-type carries
    //the boundary token; slice the binary part out before handing it to
    //geotiff.js, which only understands standalone TIFFs.
    const contentType = resp.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/'))
    {
        const tiffSlice = extractMultipartTiff(buf, contentType);
        if (!tiffSlice)
        {
            return null;
        }
        buf = tiffSlice;
    }

    let tiff;
    try
    {
        tiff = await fromArrayBuffer(buf);
    }
    catch (_)
    {
        return null;
    }

    let image;
    try
    {
        image = await tiff.getImage();
    }
    catch (_)
    {
        return null;
    }

    let rasters;
    try
    {
        //Force-resample to the requested grid so the caller can index by
        //(j × rasterSize + i) without tracking the upstream's returned size.
        rasters = await image.readRasters({
            width:  rasterSize,
            height: rasterSize,
            interleave: false,
            samples: [0]
        });
    }
    catch (_)
    {
        return null;
    }

    //readRasters returns a typed array (single sample) or an array of them.
    //Normalise to a single Float32Array.
    let band: ArrayLike<number>;
    if (Array.isArray(rasters))
    {
        if (rasters.length === 0)
        {
            return null;
        }
        band = rasters[0] as ArrayLike<number>;
    }
    else
    {
        band = rasters as unknown as ArrayLike<number>;
    }

    if (band instanceof Float32Array)
    {
        return band;
    }

    //Convert any other numeric typed array (Float64, Int16, UInt16) to Float32
    //so downstream math is uniform.
    const out = new Float32Array(band.length);
    for (let i = 0; i < band.length; i++)
    {
        out[i] = band[i];
    }
    return out;
}

//Subtract two equally-sized rasters element-wise (DSM minus DTM →
//height-above-ground). NaN propagates, so a no-data cell on either input drops
//the corresponding output, which the pipeline then skips.
export function subtractRasters(
    dsm: Float32Array,
    dtm: Float32Array
): Float32Array
{
    const N = Math.min(dsm.length, dtm.length);
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++)
    {
        const d  = dsm[i];
        const g  = dtm[i];
        const dh = d - g;
        out[i] = (isFinite(dh) && dh >= 0) ? dh : NaN;
    }
    return out;
}

//Same byte path as fetchFloat32GeoTiff() but also returns the GDAL_NODATA
//sentinel from metadata (null when absent), band 1, AND band 2 when the source
//COG ships one (helios-lidar.org outputs a 2-band COG: band 1 = nDSM,
//band 2 = DTM). Used by the local-nDSM provider to map nodata cells to NaN
//before the shared pipeline runs; public providers stay on the simpler helper
//above and keep their byte-for-byte behaviour.
export async function fetchFloat32GeoTiffWithNoData(
    url:        string,
    rasterSize: number,
    signal?:    AbortSignal
): Promise<{ data: Float32Array; terrain: Float32Array | null; noData: number | null } | null>
{
    let resp: Response;
    try
    {
        resp = await fetch(lidarFetchUrl(url), { signal });
    }
    catch (_)
    {
        return null;
    }
    if (!resp.ok)
    {
        return null;
    }

    let buf: ArrayBuffer;
    try { buf = await resp.arrayBuffer(); }
    catch (_) { return null; }

    if (buf.byteLength < 200)
    {
        return null;
    }

    let tiff;
    try { tiff = await fromArrayBuffer(buf); }
    catch (_) { return null; }

    let image;
    try { image = await tiff.getImage(); }
    catch (_) { return null; }

    //getGDALNoData() returns the parsed GDAL_NODATA tag, or null when absent.
    //Some older geotiff.js versions omit it; guard the call.
    let noData: number | null = null;
    try
    {
        const anyImg = image as unknown as { getGDALNoData?: () => number | null };
        if (typeof anyImg.getGDALNoData === 'function')
        {
            const raw = anyImg.getGDALNoData();
            noData = (typeof raw === 'number' && Number.isFinite(raw)) ? raw : null;
        }
    }
    catch (_) { noData = null; }

    //Probe the band count so we read band 2 (DTM) only when present. Current
    //helios-lidar.org COGs ship 2 bands; legacy single-band COGs expose only
    //band 1 and getSamplesPerPixel returns 1.
    let sampleCount = 1;
    try
    {
        const anyImg = image as unknown as { getSamplesPerPixel?: () => number };
        if (typeof anyImg.getSamplesPerPixel === 'function')
        {
            const n = anyImg.getSamplesPerPixel();
            if (typeof n === 'number' && n >= 1)
            {
                sampleCount = n;
            }
        }
    }
    catch (_) { sampleCount = 1; }
    const wantBands = sampleCount >= 2 ? [0, 1] : [0];

    let rasters;
    try
    {
        rasters = await image.readRasters({
            width:  rasterSize,
            height: rasterSize,
            interleave: false,
            samples: wantBands
        });
    }
    catch (_) { return null; }

    //`interleave: false` always returns one typed array per sample. Normalise
    //each band to Float32.
    if (!Array.isArray(rasters) || rasters.length === 0)
    {
        return null;
    }

    const toF32 = (b: ArrayLike<number>): Float32Array =>
    {
        if (b instanceof Float32Array)
        {
            return b;
        }
        const out = new Float32Array(b.length);
        for (let i = 0; i < b.length; i++)
        {
            out[i] = b[i];
        }
        return out;
    };

    const data    = toF32(rasters[0] as ArrayLike<number>);
    const terrain = rasters.length >= 2
        ? toF32(rasters[1] as ArrayLike<number>)
        : null;

    return { data, terrain, noData };
}

//Element-wise MAX of two equally-sized rasters. Used by the Spanish provider to
//merge vegetation and building MDSn coverages into one height-above-ground
//raster (each cell is vegetation OR building OR ground; the higher of the two
//pre-normalised heights is the right value).
export function maxRasters(
    a: Float32Array,
    b: Float32Array
): Float32Array
{
    const N = Math.min(a.length, b.length);
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++)
    {
        const av = a[i];
        const bv = b[i];
        const aOk = isFinite(av);
        const bOk = isFinite(bv);
        if (aOk && bOk)
        {
            out[i] = Math.max(av, bv);
        }
        else if (aOk)
        {
            out[i] = av;
        }
        else if (bOk)
        {
            out[i] = bv;
        }
        else
        {
            out[i] = NaN;
        }
    }
    return out;
}
