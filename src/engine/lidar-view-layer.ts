//WebGL custom MapLibre layer for the LiDAR View dot cloud.
//
//Replaces the previous 2D-canvas pipeline (CPU projection of every
//cell each transform + Path2D bake + drawImage per frame), which hit
//its ceiling around a few hundred thousand points. The custom layer
//uploads the cell positions to the GPU once per raster fetch; each
//frame is then one drawArrays(POINTS) call with the camera matrix
//handled by the shader. Scales to millions of points without breaking
//a sweat, and auto-rotate stops being expensive because no per-frame
//CPU re-projection happens at all.
//
//The buffer holds Mercator x / y / z per cell. Heights stay in metres
//on the source side and are scaled by meterInMercatorCoordinateUnits
//at upload time so the vertex shader can multiply by MapLibre's
//projection matrix directly. Only finite cells are uploaded; NaNs are
//dropped at build-time rather than discarded in the shader.

import maplibregl from '../maplibre';
import type {
    CustomLayerInterface,
    CustomRenderMethodInput,
    Map as MapLibreMap
} from 'maplibre-gl';

//Vertex shader. Takes one Mercator-offset triplet per point (each
//cell's position relative to the home, in Mercator units) and emits
//a continuous fall-off factor v_alpha based on the cell's metric
//distance to the home: 1 within u_fadeFullMeters, fading down to 0
//at u_fadeOutMeters via a smoothstep. The fragment shader uses
//v_alpha as a multiplier on the layer colour so points near the
//home read at full opacity while the outer disc dissolves into the
//basemap. Lines whose endpoints span the fade band inherit a
//gradient automatically through varying interpolation.
//
//The matrix is *already* shifted to be home-relative: the host JS
//pre-multiplies MapLibre's projection matrix by a translation to the
//home in float64, then sends the combined mat4 as the uniform. That
//shift is what keeps the per-vertex math precise: storing absolute
//Mercator coords (~0.5 + tiny per-cell deltas) puts the deltas at the
//edge of float32's mantissa and the per-frame matrix-times-vec4
//product jitters by a pixel or two each rotation step. With offsets
//(~1e-6 worst case), float32 has plenty of headroom and the cloud
//stays rock-solid as the camera moves.
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

//Fragment shader. discard when outside the radius (the v_inside guard
//is redundant given gl_PointSize=0 already collapses the primitive,
//but keeps the shader robust to driver quirks where a 0-sized point
//may still issue a fragment). Solid colour modulated by the fade
//alpha; blending is set up in the host JS so the colour can stay
//premultiplied here.
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
    //Vertex buffer (Mercator offsets from home, one triplet per
    //finite cell) and its companion line-topology index buffer
    //(pairs of vertex indices, one per grid edge whose endpoints
    //both have data). Both are uploaded once per setData and reused
    //for every frame: drawArrays(POINTS) for the dot cloud,
    //drawElements(LINES) for the wireframe mesh.
    private _buffer?:      WebGLBuffer;
    private _indexBuffer?: WebGLBuffer;
    //Triangle index buffer for the irradiance fill pass. Two triangles per cell whose four corners are all finite; rendered under the
    //wireframe so the lines stay visually crisp on top of the soft fill. Empty until setData runs, never uploaded when the raster is null.
    private _triIndexBuffer?: WebGLBuffer;
    private _triIdxCount: number = 0;
    //Parallel per-vertex byte buffer carrying the live solar exposure (0 = in shadow, 255 = lit). Sourced from computeLidarCellExposureRows() in
    //the engine, refreshed via setExposure() whenever the sun moves enough to recompute. When the attribute is disabled (no compute has run
    //yet, sun below horizon, etc.) the vertex shader reads a constant 1.0 via vertexAttrib1f, the fragment shader then renders at the
    //pre-exposure baseline (full lit, neutral tint).
    private _exposureBuffer?: WebGLBuffer;
    private _hasExposure: boolean = false;
    private _vertexCount: number = 0;
    private _lineIdxCount: number = 0;
    //WebGL2 supports UNSIGNED_INT indices natively; on a WebGL1
    //context we probe for OES_element_index_uint at onAdd time. We
    //need 32-bit indices because high-precision rasters reach a few
    //million finite cells and 65536 is too small.
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
    //Reusable scratch for the per-frame matrix shift, allocated once to avoid garbage on every render call.
    private _shiftedMatrix:  Float32Array = new Float32Array(16);

    //Tunables, pushed by the engine on config / fade ticks. The fade
    //range (full inside .._fadeFullMeters, smoothstep down to 0 at
    //.._fadeOutMeters) lets the cloud sit at full opacity around the
    //home and dissolve into the basemap further out.
    private _fadeFullMeters: number = 100;
    private _fadeOutMeters:  number = 100;
    private _pointSizePx:  number = 1.5;
    private _alphaFade:    number = 0;
    //Single user-tunable opacity that drives the entire view. Points
    //and the irradiance fill render at this value; the wireframe
    //sits on a +0.15 bump (clamped) so the line topology stays
    //readable above the soft fill. Colour is hard-locked to white
    //so the irradiance heat-map carries the visual weight on its
    //own and the LiDAR layer reads as one composite asset.
    private _opacity: number = 0.6;

    //Home position in Mercator. Recomputed when setHome is called so
    //the radius filter stays anchored on the rendered home, and used
    //per-frame as the translation injected into the projection matrix
    //(home-relative buffer trick, see render()).
    private _homeMerc: maplibregl.MercatorCoordinate;
    private _mercPerMeter: number;

    //Vertices + line indices cached when the engine sets data BEFORE the layer is added to the map. Uploaded to GL the moment onAdd runs.
    private _pendingVerts?:    Float32Array;
    private _pendingLineIdx?:  Uint32Array;
    private _pendingTriIdx?:   Uint32Array;
    private _pendingExposure?: Uint8Array;
    //Signature of the LAST raster that we successfully rebuilt + uploaded. Composed of (rasterSize, bbox, homeMerc) , the four inputs the
    //setData() build path actually depends on. Reused as the memo key: when setData() is called with the same signature (e.g. the user
    //toggles LiDAR off/on without moving the map), we skip the entire double-loop + GL upload pass and return immediately. With rasterSize
    //typically 256 to 512, the skipped work is ~65k to 260k Mercator conversions plus three GPU uploads, so the saved cost on a re-toggle
    //is measured in 100+ ms on mid-range hardware.
    private _builtSignature: string | null = null;
    //Maps a raster-cell index (j * rasterSize + i) to its vertex index in the GPU buffer, or -1 when the cell was NaN at setData time. Cached so
    //setExposure() can translate a per-raster-cell exposure array (engine concern) to the per-vertex order the GPU buffer expects, without
    //asking the engine to know our internal packing.
    private _cellToVert: Int32Array | null = null;
    //Raster reference kept around so setHome can rebuild the buffer against the new origin. Without this, switching homes would leave the cloud
    //anchored at the previous mercator centre.
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
        //New home -> all the cached offsets are now relative to the
        //wrong origin, invalidate the build memo so setData rebuilds.
        this._builtSignature = null;
        //Buffer encodes offsets from the previous home, refit it against the new origin so the cloud stays anchored.
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

    //Point + wireframe colour, theme-aware. Caller pushes the resolved HA frontend primary-text-color as a
    //0..1 RGB triplet (black ~ 0,0,0 on light theme, white ~ 1,1,1 on dark theme). The fill-by-exposure
    //pass is unaffected (it always paints in the irradiance palette); only the points + wireframe + the
    //flat-pre-exposure fill pull this colour.
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

    //Single opacity knob, in [0..1]. Drives the points and the fill
    //pass directly; the wireframe uses min(opacity + 0.15, 1) so the
    //lines stay readable above the soft fill.
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

    //Rebuild the GPU buffer from a fresh height raster. Only finite
    //cells are uploaded; NaN sentinels (no-data) are dropped at build
    //time so the shader never sees them.
    //
    //Each cell is encoded as a Mercator OFFSET from the home origin
    //in float64 first, then truncated to float32. With offsets in the
    //~1e-6 range (a few hundred metres at typical lats), float32 has
    //plenty of mantissa for sub-metre placement; storing absolute
    //Mercator coords (~0.5 + small delta) quantises adjacent cells to
    //the same float32 value and produces the diagonal moiré bands you
    //get on the ground layer at high precision.
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

        //Memo guard: re-toggling the LiDAR view, or any side path that
        //calls setData with the same raster + same home, hits this
        //short-circuit and skips the 65k-260k Mercator-conversion build
        //+ three GPU buffer uploads. The signature includes the home
        //Mercator so a setHome() mid-session correctly invalidates.
        //Heights identity is part of the signature via the raster
        //object identity: a fresh fetch produces a new typed array, a
        //re-fetch of the same tile from cache reuses the same one in
        //the providers that cache by URL.
        const signature = `${raster.rasterSize}|${raster.minLat}|${raster.maxLat}|${raster.minLon}|${raster.maxLon}|${this._homeMerc.x}|${this._homeMerc.y}|${raster.heights.length}`;
        if (signature === this._builtSignature && this._vertexCount > 0)
        {
            this._map?.triggerRepaint();
            return;
        }

        const { heights, rasterSize, minLat, maxLat, minLon, maxLon } = raster;
        const pxLon = (maxLon - minLon) / rasterSize;
        const pxLat = (maxLat - minLat) / rasterSize;
        //Home Mercator captured here as float64; the subtraction below
        //runs in float64 (JS Number) so each cell's offset reaches the
        //buffer with full double precision before float32 truncation.
        const homeX = this._homeMerc.x;
        const homeY = this._homeMerc.y;
        const homeZ = this._homeMerc.z ?? 0;

        //Worst-case all-cells-finite allocations. We slice the unused tail off before upload so the GPU buffers only carry real points + real edges.
        const verts = new Float32Array(rasterSize * rasterSize * 3);
        //cellToVert maps a (j*R + i) cell index to its index in the
        //vertex stream, or -1 when the cell was NaN. Needed so the
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

        //Wireframe topology: for every finite cell, emit an edge to
        //the cell on its right (i+1, j) and below (i, j+1) when those
        //neighbours are also finite. Each grid edge appears once, so
        //the dataset stays at most ~2*N entries.
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

        //Triangle fan for the irradiance fill pass: 2 triangles per cell whose four corners are all finite. Sized for the worst case (every
        //cell finite) and trimmed to the used range before upload. The fill renders under the wireframe so the lines stay crisp on top of
        //the soft per-cell shading.
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

        //Cache the cellToVert mapping for the next setExposure() call. Reset _hasExposure since the previous exposure (sized to the old
        //vertex count) is stale, the next compute pass will refit and re-upload. Pending exposure is also cleared, a stash made before
        //the swap is sized to the OLD vertex count and would mismatch the new buffer on onAdd.
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
            //Shrink the exposure buffer to the new vertex count so a render that lands before the next compute doesn't read stale bytes from
            //a longer buffer (the attribute is fall-back-constant via vertexAttrib1f when _hasExposure is false anyway, but keeping the buffer
            //sized to vertexCount means we can flip _hasExposure on without a re-allocation roundtrip).
            if (this._exposureBuffer)
            {
                gl.bindBuffer(gl.ARRAY_BUFFER, this._exposureBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, n, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
            }
        }
        else
        {
            //Layer not yet onAdd'd; stash so the upload runs the
            //moment we get a GL context.
            this._pendingVerts   = used;
            this._pendingLineIdx = lineUsed;
            this._pendingTriIdx  = triUsed;
        }
        //Cache the signature LAST so a partial-build failure (an early
        //return higher up) does not falsely mark the layer as built.
        this._builtSignature = signature;
        this._map?.triggerRepaint();
    }


    //Accept a per-raster-cell exposure byte array (length = rasterSize²) coming from computeLidarCellExposureRows(). Maps it through the cached
    //cellToVert into a per-vertex byte array, uploads to the GPU and flips _hasExposure so the next render reads from a_exposure instead of
    //the constant fallback. Passing null clears the override.
    public setExposure(perCellExposure: Uint8Array | null): void
    {
        if (!perCellExposure || !this._cellToVert || this._vertexCount === 0)
        {
            this._hasExposure  = false;
            this._pendingExposure = undefined;
            this._map?.triggerRepaint();
            return;
        }
        //Size guard against a raster swap mid-sweep: when the engine's chunked exposure loop posts a buffer sized for the OLD raster
        //after setData has rebuilt _cellToVert for the NEW raster, blindly mapping by index would paint nonsense (and on a smaller new
        //raster, read off the end of the per-cell array, producing fake-lit halos via the `?? 255` fallback). Refuse the swap, the next
        //schedule will produce a correctly-sized exposure for the new raster on the next sun delta.
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

        //onAdd must leave GL in a clean state on every exit path. A partial shader compile / link that throws while a buffer is bound or an attribute
        //is enabled pollutes the painter's assumptions and the basemap renders to garbage until the page is refreshed. Catch our own errors, free
        //anything we allocated, and re-throw so the surrounding try / catch in _initLidarViewLayer reports it without breaking the rest of the map
        //setup.
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

            //Index buffer for the wireframe overlay. WebGL2 has
            //native 32-bit index support; WebGL1 needs the
            //OES_element_index_uint extension. We always need 32-bit
            //because high-precision rasters reach a few million
            //finite cells, well past the 16-bit cap. When the
            //extension is unavailable (very rare today), the
            //wireframe stays disabled; points keep working as the
            //setLines path short-circuits on _indexType === 0.
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
            //Tear down whatever managed to allocate before the throw, so MapLibre's next layer sees a clean GL state.
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
        //Skip the draw when fully transparent. Saves a pipeline setup per frame while the user has the LiDAR View toggled off.
        if (this._alphaFade <= 0)
        {
            return;
        }

        //MapLibre passes a projection matrix that maps Mercator [0..1]
        //world coords into clip space. The buffer stores home-relative
        //offsets, so we inject a translation by the home Mercator
        //into the matrix before uploading. The math runs in float64
        //(JS Number) so the combined matrix carries the home shift
        //without losing precision on the way to the float32 uniform.
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

        //a_exposure: byte attribute normalised to [0, 1], or a constant 1.0 fallback when no compute has run yet. Wrap the constant set in a
        //disableVertexAttribArray so subsequent layers can't inherit our enabled state and read garbage out of an unrelated buffer.
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
        //Exposure tone controls.
        //  - Lit cells use a saturated amber (1.0 / 0.6 / 0.15)
        //    that stays readable on light dashboards.
        //  - Shadowed cells were at 0.25 brightness which crushed the
        //    whole mesh once the sun went below the horizon (every
        //    cell sees zero exposure at night, so the entire LiDAR
        //    view dropped to ~25 % luminance and read as "barely
        //    visible"). Bumped to 0.55 so a fully-shadowed mesh stays
        //    legible while the day-time shadow-vs-lit contrast
        //    remains clear (gap of 0.45 between floor and lit).     */
        //Top-level exposure uniforms = the "real" shading values used
        //by the triangle fill pass. The points + wireframe passes
        //re-write these to neutral (lit=1, shadow=1, warm=white) so
        //those primitives paint as pure white regardless of exposure.
        const U_LIT_REAL    = 1.0;
        const U_SHADOW_REAL = 0.55;
        const U_WARM_R = 1.0, U_WARM_G = 0.6, U_WARM_B = 0.15;
        //gl_PointSize is measured in framebuffer pixels. MapLibre sizes
        //its framebuffer at map.getPixelRatio() x CSS, which the engine
        //clamps (desktop 2, mobile 1.25). window.devicePixelRatio
        //diverges from the clamped value on any device where the cap
        //kicks in (iOS DPR 3 with framebuffer at 1.25x), so dots come
        //out 2-3x too big. Asking MapLibre directly keeps the dots at
        //the same CSS size across devices.
        const pixelRatio = this._map?.getPixelRatio?.()
                        ?? ((typeof window !== 'undefined' && window.devicePixelRatio) || 1);
        if (this._uPointSize)
        {
            gl.uniform1f(this._uPointSize, this._pointSizePx * pixelRatio);
        }
        //Wireframe sits +0.15 above the slider opacity so the lines stay readable above the soft fill; clamped to 1 at the top so the user can
        //still push the slider all the way without overshooting.
        const fillA = this._opacity;
        const wireA = Math.min(1, this._opacity + 0.15);
        if (this._uAlphaFade)
        {
            gl.uniform1f(this._uAlphaFade, this._alphaFade);
        }

        //Reset the GL state we depend on. MapLibre's other layers can
        //leave stencil + depth tests enabled and a non-default
        //blendFunc behind; without explicit resets we'd inherit them
        //and see flickering points or a clipped overlay near the
        //screen edges.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.CULL_FACE);

        //Irradiance fill pass. Triangulated cells, ONLY renders when
        //fresh exposure data has been computed. Pre-compute frames
        //show only the points + wireframe (white), so the user has a
        //"loading skeleton" instead of a fully-lit amber stand-in.
        //Drawn FIRST so the white wireframe below paints on top.
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

        //Points + wireframe passes ALWAYS render in pure white,
        //regardless of exposure state. The exposure modulation is
        //disabled by neutralising the shader uniforms (lit=1, shadow=
        //1, warm=white), which collapses col = u_color * 1 * 1 to a
        //flat white. This gives the user immediate visual feedback
        //("the cells are loading") before the irradiance fill arrives.
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

        //Points pass. Skipped when the user dialed point size to 0
        //(typical wireframe-only setup).
        if (this._uColor && this._pointSizePx > 0)
        {
            gl.uniform4f(this._uColor, this._viewColorR, this._viewColorG, this._viewColorB, fillA);
            gl.drawArrays(gl.POINTS, 0, this._vertexCount);
        }

        //Wireframe pass. Always drawn on top so the line topology
        //stays crisp above the (possibly shaded) fill.
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

    //Build `mainMatrix * translation(homeMerc)` directly in the
    //pre-allocated Float32Array uniform target. The product simplifies
    //because translation(t) only touches the last column of the
    //identity, so only mat[12..15] need recomputing; the rotation /
    //scale block (mat[0..11]) carries over unchanged. Done in JS so
    //the home shift is added in float64 before any float32 truncation
    //happens, which is what saves the per-cell precision near the
    //ground (otherwise neighbouring cells quantise to the same float
    //and you get diagonal moiré bands at high precision).
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
