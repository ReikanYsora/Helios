//WebGL custom MapLibre layer for the LiDAR View dot cloud.
//
//Replaces the previous 2D-canvas pipeline (CPU re-projection of every cell each transform), which
//capped out around a few hundred thousand points. The custom layer uploads cell positions to the GPU
//once per raster fetch; each frame is one drawArrays(POINTS) with the camera matrix handled by the
//shader, so it scales to millions of points and auto-rotate costs nothing on the CPU.
//
//The buffer holds Mercator x/y/z per cell. Heights stay in metres source-side and are scaled by
//meterInMercatorCoordinateUnits at upload time. Only finite cells are uploaded; NaNs dropped at build.

import maplibregl from '../maplibre';
import type {
    CustomLayerInterface,
    CustomRenderMethodInput,
    Map as MapLibreMap
} from 'maplibre-gl';

//Vertex shader. One Mercator-offset triplet per point (cell position relative to home), emitting a
//fall-off factor v_alpha from the cell's metric distance to home: 1 within u_fadeFullMeters,
//smoothstep down to 0 at u_fadeOutMeters. The fragment shader multiplies the layer colour by v_alpha
//so near points read full opacity and the outer disc dissolves into the basemap; lines spanning the
//band inherit a gradient via varying interpolation.
//
//The matrix is already shifted home-relative: the host pre-multiplies MapLibre's projection matrix by
//a translation to home in float64 and sends the combined mat4. That keeps per-vertex math precise --
//absolute Mercator coords (~0.5 + tiny deltas) would jitter under float32; offsets (~1e-6) have headroom.
const VERT_SRC = `
precision highp float;
attribute vec3  a_pos;
attribute float a_exposure;
uniform mat4  u_matrix;
uniform float u_mercPerMeter;
uniform float u_fadeFullMeters;
uniform float u_fadeOutMeters;
uniform float u_pointSizePx;
varying float v_alpha;
varying float v_exposure;

void main() {
    float dxM = a_pos.x / u_mercPerMeter;
    float dyM = a_pos.y / u_mercPerMeter;
    float d2  = dxM * dxM + dyM * dyM;
    float fullR2 = u_fadeFullMeters * u_fadeFullMeters;
    float fadeR2 = u_fadeOutMeters * u_fadeOutMeters;
    v_alpha    = 1.0 - smoothstep(fullR2, fadeR2, d2);
    v_exposure = a_exposure;
    gl_Position  = u_matrix * vec4(a_pos, 1.0);
    //Collapse the primitive once the alpha is essentially zero so
    //fully-faded points don't waste rasteriser time. The 0.001
    //threshold is below the perceptual floor (1/255 = 0.0039) so
    //nothing visible is dropped.
    gl_PointSize = u_pointSizePx * step(0.001, v_alpha);
}
`;

//Fragment shader. Discards outside the radius (redundant given gl_PointSize=0 already collapses the
//primitive, but robust to drivers that still issue a fragment for a 0-sized point). Solid colour
//modulated by the fade alpha; blending is set up host-side so the colour stays premultiplied here.
const FRAG_SRC = `
precision mediump float;
uniform vec4  u_color;
uniform float u_alphaFade;
//Solar-exposure modulation. The vertex shader normalises a per-cell exposure byte to [0, 1]; this controls a brightness multiplier + a warm
//tint applied to the base colour. 1 = sun-lit (full brightness, slight warm shift), 0 = in shadow (dimmed). The defaults are tuned so a
//missing exposure buffer (attribute disabled, vertexAttrib1f(1.0)) produces visuals identical to the pre-exposure render: full lit, neutral
//tint. When the engine starts feeding real exposure data the dimmed cells immediately read as shadow without changing the lit baseline.
uniform float u_exposureLitBoost;
uniform float u_exposureShadowFloor;
uniform vec3  u_exposureWarmTint;
varying float v_alpha;
varying float v_exposure;

void main() {
    //v_alpha is the home-distance fall-off, 1 inside the full radius
    //and dropping to 0 at the fade-out radius. Cells fully past the
    //fade are still discarded so we don't waste blend bandwidth on
    //invisible fragments (and for lines this clips the segment past
    //the boundary cleanly).
    if (v_alpha <= 0.0)
    {
        discard;
    }
    float lit  = mix(u_exposureShadowFloor, u_exposureLitBoost, v_exposure);
    vec3  warm = mix(vec3(1.0), u_exposureWarmTint, v_exposure);
    vec3  col  = u_color.rgb * lit * warm;
    gl_FragColor = vec4(col, u_color.a * u_alphaFade * v_alpha);
}
`;

export interface LidarViewLayerOpts
{
    homeLat: number;
    homeLon: number;
}

//Raw raster shape forwarded from the LiDAR providers.
export interface LidarRaster
{
    heights:    Float32Array;
    rasterSize: number;
    minLat:     number;
    maxLat:     number;
    minLon:     number;
    maxLon:     number;
}

export class LidarViewLayer implements CustomLayerInterface
{
    public readonly id: string = 'helios-lidar-view';
    public readonly type: 'custom' = 'custom';
    public readonly renderingMode: '2d' = '2d';

    private _map?:    MapLibreMap;
    private _gl?:     WebGLRenderingContext | WebGL2RenderingContext;
    private _program?: WebGLProgram;
    //Vertex buffer (Mercator offsets from home, one triplet per finite cell) and its line-topology
    //index buffer (pairs of vertex indices, one per grid edge with data at both ends). Both uploaded
    //once per setData and reused every frame: drawArrays(POINTS) for the cloud, drawElements(LINES)
    //for the wireframe.
    private _buffer?:      WebGLBuffer;
    private _indexBuffer?: WebGLBuffer;
    //Triangle index buffer for the irradiance fill pass: two triangles per cell with four finite
    //corners. Rendered under the wireframe so the lines stay crisp on top. Empty until setData runs.
    private _triIndexBuffer?: WebGLBuffer;
    private _triIdxCount: number = 0;
    //Per-vertex exposure bytes (0 = shadow, 255 = lit) from computeLidarCellExposureRows(), refreshed
    //via setExposure() when the sun moves enough to recompute. When disabled (no compute yet, sun
    //below horizon) the shader reads constant 1.0 via vertexAttrib1f -> pre-exposure baseline.
    private _exposureBuffer?: WebGLBuffer;
    private _hasExposure: boolean = false;
    private _vertexCount: number = 0;
    private _lineIdxCount: number = 0;
    //32-bit indices are needed because high-precision rasters reach a few million finite cells (16-bit
    //caps at 65536). WebGL2 has UNSIGNED_INT natively; on WebGL1 we probe OES_element_index_uint at onAdd.
    private _indexType: number = 0;

    private _aPos:      number = -1;
    private _aExposure: number = -1;
    private _uMatrix?:           WebGLUniformLocation;
    private _uMercPerMeter?:     WebGLUniformLocation;
    private _uFadeFull?:         WebGLUniformLocation;
    private _uFadeOut?:          WebGLUniformLocation;
    private _uPointSize?:        WebGLUniformLocation;
    private _uColor?:            WebGLUniformLocation;
    private _uAlphaFade?:        WebGLUniformLocation;
    private _uExposureLit?:      WebGLUniformLocation;
    private _uExposureShadow?:   WebGLUniformLocation;
    private _uExposureWarmTint?: WebGLUniformLocation;
    //Reusable scratch for the per-frame matrix shift, allocated once to avoid per-render garbage.
    private _shiftedMatrix:  Float32Array = new Float32Array(16);

    //Tunables pushed by the engine on config / fade ticks. The fade range (full inside _fadeFullMeters,
    //smoothstep to 0 at _fadeOutMeters) keeps the cloud opaque around home and dissolving further out.
    private _fadeFullMeters: number = 100;
    private _fadeOutMeters:  number = 100;
    private _pointSizePx:  number = 1.5;
    private _alphaFade:    number = 0;
    //Single opacity knob for the whole view. Points and the irradiance fill render at this value; the
    //wireframe gets a +0.15 bump (clamped) to stay readable above the fill. Colour is locked to white
    //so the irradiance heat-map carries the visual weight and the layer reads as one composite asset.
    private _opacity: number = 0.6;

    //Home position in Mercator. Recomputed on setHome so the radius filter stays anchored on the
    //rendered home; used per-frame as the translation injected into the projection matrix (see render()).
    private _homeMerc: maplibregl.MercatorCoordinate;
    private _mercPerMeter: number;

    //Vertices + indices cached when the engine sets data BEFORE the layer is added. Uploaded on onAdd.
    private _pendingVerts?:    Float32Array;
    private _pendingLineIdx?:  Uint32Array;
    private _pendingTriIdx?:   Uint32Array;
    private _pendingExposure?: Uint8Array;
    //Signature of the last raster successfully rebuilt + uploaded: (rasterSize, bbox, homeMerc, length),
    //the inputs the build path depends on. Used as a memo key so a re-toggle with the same signature
    //skips the ~65k-260k Mercator conversions + three GPU uploads (100+ ms on mid-range hardware).
    private _builtSignature: string | null = null;
    //Maps a raster-cell index (j * rasterSize + i) to its vertex index in the GPU buffer, or -1 for a
    //NaN cell. Lets setExposure() translate a per-cell exposure array into the per-vertex packing the
    //GPU expects without the engine knowing our internal layout.
    private _cellToVert: Int32Array | null = null;
    //Raster kept so setHome can rebuild the buffer against the new origin; otherwise switching homes
    //would leave the cloud anchored at the previous Mercator centre.
    private _raster: LidarRaster | null = null;

    constructor(opts: LidarViewLayerOpts)
    {
        this._homeMerc     = maplibregl.MercatorCoordinate.fromLngLat([opts.homeLon, opts.homeLat], 0);
        this._mercPerMeter = this._homeMerc.meterInMercatorCoordinateUnits();
    }

    public setHome(lat: number, lon: number): void
    {
        this._homeMerc     = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0);
        this._mercPerMeter = this._homeMerc.meterInMercatorCoordinateUnits();
        //New home -> cached offsets are now relative to the wrong origin; invalidate the build memo.
        this._builtSignature = null;
        //Buffer encodes offsets from the previous home; refit against the new origin to stay anchored.
        if (this._raster)
        {
            this.setData(this._raster);
        }
        this._map?.triggerRepaint();
    }

    public setFadeRange(fullMeters: number, fadeOutMeters: number): void
    {
        if (fullMeters === this._fadeFullMeters
         && fadeOutMeters === this._fadeOutMeters) return;
        this._fadeFullMeters = fullMeters;
        this._fadeOutMeters  = fadeOutMeters;
        this._map?.triggerRepaint();
    }

    //Point + wireframe colour, theme-aware. Caller pushes the resolved primary-text-color as a 0..1
    //RGB triplet (black on light theme, white on dark). The fill-by-exposure pass is unaffected (it
    //always paints in the irradiance palette); only points + wireframe + flat pre-exposure fill use this.
    private _viewColorR = 1;
    private _viewColorG = 1;
    private _viewColorB = 1;
    public setViewColor(r: number, g: number, b: number): void
    {
        if (r === this._viewColorR && g === this._viewColorG && b === this._viewColorB) return;
        this._viewColorR = r;
        this._viewColorG = g;
        this._viewColorB = b;
        this._map?.triggerRepaint();
    }

    public setPointSizePx(px: number): void
    {
        if (px === this._pointSizePx)
        {
            return;
        }
        this._pointSizePx = px;
        this._map?.triggerRepaint();
    }

    //Single opacity knob in [0..1]. Drives points and fill directly; the wireframe uses
    //min(opacity + 0.15, 1) to stay readable above the fill.
    public setOpacity(opacity: number): void
    {
        const clamped = Math.max(0, Math.min(1, opacity));
        if (clamped === this._opacity)
        {
            return;
        }
        this._opacity = clamped;
        this._map?.triggerRepaint();
    }

    //Fade multiplier in [0..1]. 0 = invisible (shortcut: no draw call).
    public setAlphaFade(a: number): void
    {
        const clamped = Math.max(0, Math.min(1, a));
        if (clamped === this._alphaFade)
        {
            return;
        }
        this._alphaFade = clamped;
        this._map?.triggerRepaint();
    }

    //Rebuild the GPU buffer from a fresh height raster. Only finite cells are uploaded; NaN no-data
    //sentinels are dropped at build time. Each cell is a Mercator OFFSET from home computed in float64
    //then truncated to float32: offsets (~1e-6) have ample mantissa, whereas absolute Mercator coords
    //(~0.5 + small delta) quantise adjacent cells to the same float32 and produce diagonal moiré bands.
    public setData(raster: LidarRaster | null): void
    {
        this._raster = raster;

        if (!raster || raster.rasterSize <= 0)
        {
            this._vertexCount = 0;
            this._pendingVerts = undefined;
            this._builtSignature = null;
            if (this._gl && this._buffer)
            {
                this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._buffer);
                this._gl.bufferData(this._gl.ARRAY_BUFFER, 0, this._gl.STATIC_DRAW);
            }
            this._map?.triggerRepaint();
            return;
        }

        //Memo guard (see _builtSignature): same raster + same home short-circuits the build + uploads.
        //Heights identity rides along via raster object identity -- a fresh fetch makes a new typed
        //array; a cache hit reuses the same one in URL-caching providers.
        const signature = `${raster.rasterSize}|${raster.minLat}|${raster.maxLat}|${raster.minLon}|${raster.maxLon}|${this._homeMerc.x}|${this._homeMerc.y}|${raster.heights.length}`;
        if (signature === this._builtSignature && this._vertexCount > 0)
        {
            this._map?.triggerRepaint();
            return;
        }

        const { heights, rasterSize, minLat, maxLat, minLon, maxLon } = raster;
        const pxLon = (maxLon - minLon) / rasterSize;
        const pxLat = (maxLat - minLat) / rasterSize;
        //Home Mercator as float64; the per-cell subtraction below runs in float64 so each offset
        //reaches the buffer at full double precision before float32 truncation.
        const homeX = this._homeMerc.x;
        const homeY = this._homeMerc.y;
        const homeZ = this._homeMerc.z ?? 0;

        //Worst-case all-cells-finite allocations; the unused tail is sliced off before upload.
        const verts = new Float32Array(rasterSize * rasterSize * 3);
        //cellToVert maps a (j*R + i) cell to its vertex-stream index, or -1 when NaN. Needed so the
        //line-topology pass can connect adjacent finite cells.
        const cellToVert = new Int32Array(rasterSize * rasterSize);
        let n = 0;

        for (let j = 0; j < rasterSize; j++)
        {
            const cLat = maxLat - (j + 0.5) * pxLat;
            for (let i = 0; i < rasterSize; i++)
            {
                const idx = j * rasterSize + i;
                const h = heights[idx];
                if (!isFinite(h))
                {
                    cellToVert[idx] = -1;
                    continue;
                }
                const cLon = minLon + (i + 0.5) * pxLon;
                const mc   = maplibregl.MercatorCoordinate.fromLngLat([cLon, cLat], h);
                verts[n * 3    ] = mc.x       - homeX;
                verts[n * 3 + 1] = mc.y       - homeY;
                verts[n * 3 + 2] = (mc.z ?? 0) - homeZ;
                cellToVert[idx]  = n;
                n++;
            }
        }
        this._vertexCount = n;
        const used = n > 0 ? verts.subarray(0, n * 3) : new Float32Array(0);

        //Wireframe topology: for each finite cell emit an edge to its right (i+1, j) and below
        //(i, j+1) neighbour when those are finite too. Each edge appears once, so at most ~2*N entries.
        const maxEdges = Math.max(0, n * 2);
        const lineIdx  = new Uint32Array(maxEdges * 2);
        let li = 0;
        for (let j = 0; j < rasterSize; j++)
        {
            for (let i = 0; i < rasterSize; i++)
            {
                const v = cellToVert[j * rasterSize + i];
                if (v < 0)
                {
                    continue;
                }
                if (i + 1 < rasterSize)
                {
                    const vR = cellToVert[j * rasterSize + (i + 1)];
                    if (vR >= 0)
                    {
                        lineIdx[li++] = v;
                        lineIdx[li++] = vR;
                    }
                }
                if (j + 1 < rasterSize)
                {
                    const vD = cellToVert[(j + 1) * rasterSize + i];
                    if (vD >= 0)
                    {
                        lineIdx[li++] = v;
                        lineIdx[li++] = vD;
                    }
                }
            }
        }
        this._lineIdxCount = li;
        const lineUsed = li > 0 ? lineIdx.subarray(0, li) : new Uint32Array(0);

        //Triangle fill for the irradiance pass: 2 triangles per cell with four finite corners, sized
        //worst-case and trimmed before upload. Rendered under the wireframe so the lines stay crisp.
        const maxTris = Math.max(0, (rasterSize - 1) * (rasterSize - 1));
        const triIdx  = new Uint32Array(maxTris * 6);
        let ti = 0;
        for (let j = 0; j < rasterSize - 1; j++)
        {
            for (let i = 0; i < rasterSize - 1; i++)
            {
                const v00 = cellToVert[j * rasterSize + i];
                const v10 = cellToVert[j * rasterSize + i + 1];
                const v01 = cellToVert[(j + 1) * rasterSize + i];
                const v11 = cellToVert[(j + 1) * rasterSize + i + 1];
                if (v00 < 0 || v10 < 0 || v01 < 0 || v11 < 0)
                {
                    continue;
                }
                triIdx[ti++] = v00; triIdx[ti++] = v10; triIdx[ti++] = v11;
                triIdx[ti++] = v00; triIdx[ti++] = v11; triIdx[ti++] = v01;
            }
        }
        this._triIdxCount = ti;
        const triUsed = ti > 0 ? triIdx.subarray(0, ti) : new Uint32Array(0);

        //Cache cellToVert for the next setExposure(). Reset _hasExposure (the old exposure is sized to
        //the previous vertex count, so stale) and clear pending exposure (a stash made before the swap
        //is sized to the OLD count and would mismatch the new buffer on onAdd).
        this._cellToVert      = cellToVert;
        this._hasExposure     = false;
        this._pendingExposure = undefined;

        if (this._gl && this._buffer)
        {
            const gl = this._gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
            gl.bufferData(gl.ARRAY_BUFFER, used, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            if (this._indexBuffer)
            {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lineUsed, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            }
            if (this._triIndexBuffer)
            {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._triIndexBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triUsed, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            }
            //Shrink the exposure buffer to the new vertex count so a render before the next compute
            //can't read stale bytes from a longer buffer (and so flipping _hasExposure on later needs
            //no re-allocation; the attribute is constant-fallback while _hasExposure is false anyway).
            if (this._exposureBuffer)
            {
                gl.bindBuffer(gl.ARRAY_BUFFER, this._exposureBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, n, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
            }
        }
        else
        {
            //Layer not yet onAdd'd; stash so the upload runs once we get a GL context.
            this._pendingVerts   = used;
            this._pendingLineIdx = lineUsed;
            this._pendingTriIdx  = triUsed;
        }
        //Cache the signature LAST so a partial-build failure doesn't falsely mark the layer as built.
        this._builtSignature = signature;
        this._map?.triggerRepaint();
    }


    //Accept a per-raster-cell exposure byte array (length = rasterSize²) from computeLidarCellExposureRows(),
    //map it through cellToVert into per-vertex order, upload, and flip _hasExposure so the next render
    //reads a_exposure instead of the constant fallback. null clears the override.
    public setExposure(perCellExposure: Uint8Array | null): void
    {
        if (!perCellExposure || !this._cellToVert || this._vertexCount === 0)
        {
            this._hasExposure  = false;
            this._pendingExposure = undefined;
            this._map?.triggerRepaint();
            return;
        }
        //Size guard against a mid-sweep raster swap: if the engine posts a buffer sized for the OLD
        //raster after setData rebuilt _cellToVert for the NEW one, index-mapping would paint nonsense
        //(and read off the end on a smaller raster, producing fake-lit halos via `?? 255`). Refuse it;
        //the next sun delta produces a correctly-sized exposure.
        const c2v = this._cellToVert;
        const N   = c2v.length;
        if (perCellExposure.length !== N)
        {
            this._hasExposure = false;
            this._map?.triggerRepaint();
            return;
        }
        const vertExposure = new Uint8Array(this._vertexCount);
        for (let i = 0; i < N; i++)
        {
            const v = c2v[i];
            if (v >= 0)
            {
                vertExposure[v] = perCellExposure[i] ?? 255;
            }
        }
        if (this._gl && this._exposureBuffer)
        {
            this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._exposureBuffer);
            this._gl.bufferData(this._gl.ARRAY_BUFFER, vertExposure, this._gl.STATIC_DRAW);
            this._gl.bindBuffer(this._gl.ARRAY_BUFFER, null);
            this._hasExposure = true;
        }
        else
        {
            this._pendingExposure = vertExposure;
        }
        this._map?.triggerRepaint();
    }

    public onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void
    {
        this._map = map;
        this._gl  = gl;

        //onAdd must leave GL clean on every exit. A partial compile/link that throws with a buffer
        //bound or an attribute enabled pollutes the painter and the basemap renders to garbage until
        //refresh. Catch our own errors, free what we allocated, and re-throw so _initLidarViewLayer's
        //try/catch reports it without breaking the rest of map setup.
        let vs: WebGLShader | null = null;
        let fs: WebGLShader | null = null;
        let program: WebGLProgram | null = null;
        try
        {
            vs = this._compileShader(gl, gl.VERTEX_SHADER,   VERT_SRC);
            fs = this._compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
            program = gl.createProgram();
            if (!program)
            {
                throw new Error('LidarViewLayer: createProgram failed');
            }
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            {
                const log = gl.getProgramInfoLog(program) ?? '';
                throw new Error(`LidarViewLayer: link failed: ${log}`);
            }
            this._program = program;

            this._aPos              = gl.getAttribLocation(program, 'a_pos');
            this._aExposure         = gl.getAttribLocation(program, 'a_exposure');
            this._uMatrix           = gl.getUniformLocation(program, 'u_matrix')           ?? undefined;
            this._uMercPerMeter     = gl.getUniformLocation(program, 'u_mercPerMeter')     ?? undefined;
            this._uFadeFull         = gl.getUniformLocation(program, 'u_fadeFullMeters')   ?? undefined;
            this._uFadeOut          = gl.getUniformLocation(program, 'u_fadeOutMeters')    ?? undefined;
            this._uPointSize        = gl.getUniformLocation(program, 'u_pointSizePx')      ?? undefined;
            this._uColor            = gl.getUniformLocation(program, 'u_color')            ?? undefined;
            this._uAlphaFade        = gl.getUniformLocation(program, 'u_alphaFade')        ?? undefined;
            this._uExposureLit      = gl.getUniformLocation(program, 'u_exposureLitBoost') ?? undefined;
            this._uExposureShadow   = gl.getUniformLocation(program, 'u_exposureShadowFloor') ?? undefined;
            this._uExposureWarmTint = gl.getUniformLocation(program, 'u_exposureWarmTint') ?? undefined;

            this._buffer = gl.createBuffer() ?? undefined;
            if (this._pendingVerts && this._buffer)
            {
                gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
                gl.bufferData(gl.ARRAY_BUFFER, this._pendingVerts, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                this._pendingVerts = undefined;
            }

            this._exposureBuffer = gl.createBuffer() ?? undefined;
            if (this._pendingExposure && this._exposureBuffer)
            {
                gl.bindBuffer(gl.ARRAY_BUFFER, this._exposureBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, this._pendingExposure, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                this._hasExposure  = this._pendingExposure.length === this._vertexCount;
                this._pendingExposure = undefined;
            }

            //Wireframe index buffer needs 32-bit indices (rasters reach a few million finite cells,
            //past the 16-bit cap). WebGL2 has it natively; WebGL1 needs OES_element_index_uint. When
            //the extension is missing (rare), the wireframe stays off (setLines short-circuits on
            //_indexType === 0) but points keep working.
            const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined'
                          && gl instanceof WebGL2RenderingContext;
            const has32Idx = isWebGL2
                          || !!gl.getExtension('OES_element_index_uint');
            this._indexType = has32Idx ? gl.UNSIGNED_INT : 0;
            if (has32Idx)
            {
                this._indexBuffer = gl.createBuffer() ?? undefined;
                if (this._pendingLineIdx && this._indexBuffer)
                {
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._pendingLineIdx, gl.STATIC_DRAW);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                    this._pendingLineIdx = undefined;
                }
                this._triIndexBuffer = gl.createBuffer() ?? undefined;
                if (this._pendingTriIdx && this._triIndexBuffer)
                {
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._triIndexBuffer);
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._pendingTriIdx, gl.STATIC_DRAW);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                    this._pendingTriIdx = undefined;
                }
            }
        }
        catch (err)
        {
            //Tear down whatever allocated before the throw, so MapLibre's next layer sees clean GL state.
            try { gl.bindBuffer(gl.ARRAY_BUFFER, null); } catch (_) {}
            try { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); } catch (_) {}
            if (this._buffer)
            {
                try { gl.deleteBuffer(this._buffer); } catch (_) {}
                this._buffer = undefined;
            }
            if (this._indexBuffer)
            {
                try { gl.deleteBuffer(this._indexBuffer); } catch (_) {}
                this._indexBuffer = undefined;
            }
            if (program)
            {
                try { gl.deleteProgram(program); } catch (_) {}
            }
            if (vs) try { gl.deleteShader(vs); } catch (_) {}
            if (fs) try { gl.deleteShader(fs); } catch (_) {}
            this._program = undefined;
            throw err;
        }
    }

    public render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput): void
    {
        if (!this._program || !this._buffer)
        {
            return;
        }
        if (this._vertexCount === 0)
        {
            return;
        }
        //Skip the draw when fully transparent (view toggled off): saves a pipeline setup per frame.
        if (this._alphaFade <= 0)
        {
            return;
        }

        //MapLibre passes a projection matrix mapping Mercator [0..1] world coords to clip space. The
        //buffer stores home-relative offsets, so we inject a translation by home Mercator into the
        //matrix before uploading. The math runs in float64 so the home shift survives precise to the
        //float32 uniform.
        const rawMatrix = args.defaultProjectionData?.mainMatrix as ArrayLike<number> | undefined;
        if (!rawMatrix)
        {
            return;
        }
        this._buildShiftedMatrix(rawMatrix);

        gl.useProgram(this._program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(this._aPos);
        gl.vertexAttribPointer(this._aPos, 3, gl.FLOAT, false, 0, 0);

        //a_exposure: byte attribute normalised to [0, 1], or constant 1.0 when no compute has run.
        //Wrap the constant set in disableVertexAttribArray so later layers can't inherit our enabled
        //state and read garbage from an unrelated buffer.
        if (this._aExposure >= 0)
        {
            if (this._hasExposure && this._exposureBuffer)
            {
                gl.bindBuffer(gl.ARRAY_BUFFER, this._exposureBuffer);
                gl.enableVertexAttribArray(this._aExposure);
                gl.vertexAttribPointer(this._aExposure, 1, gl.UNSIGNED_BYTE, true, 0, 0);
                gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
            }
            else
            {
                gl.disableVertexAttribArray(this._aExposure);
                gl.vertexAttrib1f(this._aExposure, 1.0);
            }
        }

        if (this._uMatrix)
        {
            gl.uniformMatrix4fv(this._uMatrix, false, this._shiftedMatrix);
        }
        if (this._uMercPerMeter)
        {
            gl.uniform1f(this._uMercPerMeter, this._mercPerMeter);
        }
        if (this._uFadeFull)
        {
            gl.uniform1f(this._uFadeFull, this._fadeFullMeters);
        }
        if (this._uFadeOut)
        {
            gl.uniform1f(this._uFadeOut,  this._fadeOutMeters);
        }
        //Exposure tone controls. Lit cells use a saturated amber (1.0 / 0.6 / 0.15). Shadow floor is
        //0.55 (was 0.25, which crushed the whole mesh to ~25% luminance once the sun dropped below the
        //horizon and every cell saw zero exposure); 0.55 keeps a fully-shadowed mesh legible while the
        //day-time lit-vs-shadow contrast stays clear (0.45 gap). These are the "real" values used by
        //the triangle fill; the points + wireframe passes overwrite them to neutral (1/1/white) so
        //those primitives paint pure white regardless of exposure.
        const U_LIT_REAL    = 1.0;
        const U_SHADOW_REAL = 0.55;
        const U_WARM_R = 1.0, U_WARM_G = 0.6, U_WARM_B = 0.15;
        //gl_PointSize is in framebuffer pixels. MapLibre sizes its framebuffer at getPixelRatio() x CSS
        //(engine clamps it: desktop 2, mobile 1.25). window.devicePixelRatio diverges where the cap
        //bites (iOS DPR 3 vs framebuffer 1.25x), making dots 2-3x too big -- so ask MapLibre directly.
        const pixelRatio = this._map?.getPixelRatio?.()
                        ?? ((typeof window !== 'undefined' && window.devicePixelRatio) || 1);
        if (this._uPointSize)
        {
            gl.uniform1f(this._uPointSize, this._pointSizePx * pixelRatio);
        }
        //Wireframe sits +0.15 above the slider opacity to stay readable above the fill, clamped to 1 so
        //the slider can still go all the way without overshooting.
        const fillA = this._opacity;
        const wireA = Math.min(1, this._opacity + 0.15);
        if (this._uAlphaFade)
        {
            gl.uniform1f(this._uAlphaFade, this._alphaFade);
        }

        //Reset the GL state we depend on. Other MapLibre layers can leave stencil/depth tests enabled
        //and a non-default blendFunc behind; inheriting them would flicker the points or clip the
        //overlay near the screen edges.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.CULL_FACE);

        //Irradiance fill pass (triangulated cells), only when fresh exposure exists. Pre-compute frames
        //show just points + wireframe (white) as a loading skeleton instead of a fully-lit amber
        //stand-in. Drawn FIRST so the white wireframe paints on top.
        if (this._hasExposure
         && this._triIndexBuffer
         && this._indexType !== 0
         && this._triIdxCount > 0
         && this._uColor)
        {
            if (this._uExposureLit)
            {
                gl.uniform1f(this._uExposureLit,    U_LIT_REAL);
            }
            if (this._uExposureShadow)
            {
                gl.uniform1f(this._uExposureShadow, U_SHADOW_REAL);
            }
            if (this._uExposureWarmTint)
            {
                gl.uniform3f(this._uExposureWarmTint, U_WARM_R, U_WARM_G, U_WARM_B);
            }
            gl.uniform4f(this._uColor, this._viewColorR, this._viewColorG, this._viewColorB, fillA);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._triIndexBuffer);
            gl.drawElements(gl.TRIANGLES, this._triIdxCount, this._indexType, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }

        //Points + wireframe always render pure white regardless of exposure: neutralise the uniforms
        //(lit=1, shadow=1, warm=white) so col = u_color * 1 * 1 collapses to white. Gives immediate
        //"cells are loading" feedback before the irradiance fill arrives.
        if (this._uExposureLit)
        {
            gl.uniform1f(this._uExposureLit, 1.0);
        }
        if (this._uExposureShadow)
        {
            gl.uniform1f(this._uExposureShadow, 1.0);
        }
        if (this._uExposureWarmTint)
        {
            gl.uniform3f(this._uExposureWarmTint, 1.0, 1.0, 1.0);
        }

        //Points pass. Skipped when point size is 0 (wireframe-only setup).
        if (this._uColor && this._pointSizePx > 0)
        {
            gl.uniform4f(this._uColor, this._viewColorR, this._viewColorG, this._viewColorB, fillA);
            gl.drawArrays(gl.POINTS, 0, this._vertexCount);
        }

        //Wireframe pass, always on top so the line topology stays crisp above the (possibly shaded) fill.
        if (this._indexBuffer
         && this._indexType !== 0
         && this._lineIdxCount > 0
         && this._uColor)
        {
            gl.uniform4f(this._uColor, this._viewColorR, this._viewColorG, this._viewColorB, wireA);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
            gl.drawElements(gl.LINES, this._lineIdxCount, this._indexType, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
    }

    //Build `mainMatrix * translation(homeMerc)` directly into the pre-allocated uniform target. The
    //product simplifies because translation(t) only touches the last column, so only mat[12..15] need
    //recomputing; the rotation/scale block (mat[0..11]) carries over. Done in JS so the home shift is
    //added in float64 before float32 truncation -- otherwise neighbouring cells quantise to the same
    //float and produce diagonal moiré bands at high precision.
    private _buildShiftedMatrix(src: ArrayLike<number>): void
    {
        const tx = this._homeMerc.x;
        const ty = this._homeMerc.y;
        const tz = this._homeMerc.z ?? 0;
        const out = this._shiftedMatrix;
        out[ 0] = src[ 0]; out[ 1] = src[ 1]; out[ 2] = src[ 2]; out[ 3] = src[ 3];
        out[ 4] = src[ 4]; out[ 5] = src[ 5]; out[ 6] = src[ 6]; out[ 7] = src[ 7];
        out[ 8] = src[ 8]; out[ 9] = src[ 9]; out[10] = src[10]; out[11] = src[11];
        out[12] = src[ 0] * tx + src[ 4] * ty + src[ 8] * tz + src[12];
        out[13] = src[ 1] * tx + src[ 5] * ty + src[ 9] * tz + src[13];
        out[14] = src[ 2] * tx + src[ 6] * ty + src[10] * tz + src[14];
        out[15] = src[ 3] * tx + src[ 7] * ty + src[11] * tz + src[15];
    }

    public onRemove(_map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void
    {
        if (this._buffer)
        {
            gl.deleteBuffer(this._buffer);
        }
        if (this._indexBuffer)
        {
            gl.deleteBuffer(this._indexBuffer);
        }
        if (this._triIndexBuffer)
        {
            gl.deleteBuffer(this._triIndexBuffer);
        }
        if (this._exposureBuffer)
        {
            gl.deleteBuffer(this._exposureBuffer);
        }
        if (this._program)
        {
            gl.deleteProgram(this._program);
        }
        this._buffer         = undefined;
        this._indexBuffer    = undefined;
        this._triIndexBuffer = undefined;
        this._exposureBuffer = undefined;
        this._program        = undefined;
        this._indexType      = 0;
        this._gl             = undefined;
        this._map            = undefined;
    }

    private _compileShader(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, src: string): WebGLShader
    {
        const sh = gl.createShader(type);
        if (!sh)
        {
            throw new Error('LidarViewLayer: createShader failed');
        }
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        {
            const log = gl.getShaderInfoLog(sh) ?? '';
            gl.deleteShader(sh);
            throw new Error(`LidarViewLayer: compile failed: ${log}`);
        }
        return sh;
    }
}
