//MapLibre GL custom layer for the weather-mode cloud overlay. Three full-bbox quads (low / mid /
//high cloud-cover bands) rendered with a fragment shader that samples a tiny RGBA data texture
//(R = low, G = mid, B = high coverage) at the fragment's geographic position, multiplies the
//bilinear-interpolated coverage by 4 octaves of simplex FBM noise for the "shredded cloud" look,
//and emits a soft-edged shape in --primary-text-color modulated by per-band opacity (low 0.20,
//mid 0.40, high 0.60). All three bands share the same texture so re-uploading on a timeline
//scrub is one ~400-byte transfer, and per-band visibility is a per-quad branch in CPU (no
//uniform branching in the shader).
//
//Integration: the engine instantiates the layer + adds it to the MapLibre map on weather-mode
//entry, calls updateData() on grid refresh + timeline scrub, sets bandsVisible() on chip toggle,
//and removes the layer on weather-mode exit. The layer saves / restores enough WebGL state on
//each render() call that the basemap rendering stays uncorrupted.

import type { CustomLayerInterface, Map as MaplibreMap, CustomRenderMethodInput } from 'maplibre-gl';


export interface WeatherCloudLayerOptions
{
    color:        [number, number, number];   //--primary-text-color RGB, 0..1
    gridSide:     number;                     //N
    bbox:         { west: number; south: number; east: number; north: number };
    cloudLow:     Float32Array;               //N*N values, 0..100 (% cloud cover)
    cloudMid:     Float32Array;
    cloudHigh:    Float32Array;
    bandsVisible: [boolean, boolean, boolean]; //low, mid, high
}


//Per-band alpha multiplier applied on top of the shaped cloud density. 20 / 40 / 60 % gives growing
//visual weight from low to high so a fully overcast stack reads as a heavy ceiling rather than three
//identical greys.
const BAND_OPACITY = [0.20, 0.40, 0.60] as const;


//Vertex shader. Mercator coordinates [0..1]^2 + altitude in the same unit system; MapLibre's
//mainMatrix transforms straight to clip space. The geographic lon / lat is passed as a separate
//attribute so the fragment shader can sample the data texture by location (zoom / pan / rotate
//invariant) and feed the noise function in degrees so the cloud features stay the same size
//on the ground regardless of camera zoom.
const VERT_SRC = `
precision highp float;
attribute vec3 a_pos;
attribute vec2 a_geo;
uniform mat4 u_matrix;
varying vec2 v_geo;
void main()
{
    gl_Position = u_matrix * vec4(a_pos, 1.0);
    v_geo = a_geo;
}
`;


//Fragment shader. Threshold-based cloud carving: the FBM simplex noise field defines WHERE
//clouds could be, the bilinear-sampled coverage from the data texture shifts the threshold +
//the smoothstep band so the noise variation stays visible at any coverage level (the previous
//formula collapsed to a flat fill at 100 % coverage). Output is premultiplied alpha so
//MapLibre's framebuffer blends correctly.
//
//Per-band scale + phase so the three altitudes paint visibly different cloud signatures: high
//bands get broader features (cirrus-like sheets), low bands get tighter features (cumulus
//puffs). All three bands tint with --primary-text-color, the band identity comes from the
//shape + opacity stack.
//
//Mobile-driver hardening: u_bandIndex is a float (some Adreno / Mali drivers misbehave on int
//ternary inside fragments), u_time is wrapped to [0, 3600) host-side to keep FP24 precision
//on long sessions, and the geographic UV computation discards out-of-bounds + edge-faded-to-
//zero fragments before the expensive FBM call so the per-frame cost stays low even when the
//quad geometry overshoots the data bbox.
//
//Simplex noise: Ashima Arts' canonical 2D implementation, public domain.
const FRAG_SRC = `
precision highp float;

uniform sampler2D u_dataTexture;
uniform float     u_bandIndex;   //0.0 = low, 1.0 = mid, 2.0 = high (float for driver safety)
uniform vec3      u_color;
uniform float     u_opacity;
uniform float     u_time;        //seconds since layer mount, wrapped mod 3600 host-side
uniform vec4      u_bbox;        //west, south, east, north
uniform float     u_latCos;      //cos(radians(centre_lat)), undoes Mercator lon stretching
varying vec2      v_geo;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v)
{
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                        + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x  = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

float fbm(vec2 p, float t)
{
    float v = 0.0;
    float a = 0.5;
    vec2  shift = vec2(100.0);
    for (int i = 0; i < 4; i++)
    {
        v += a * snoise(p + t * 0.02);
        p  = p * 2.0 + shift;
        a *= 0.5;
        t *= 0.7;
    }
    return v;
}

void main()
{
    //Geographic UV inside the bbox. CLAMP_TO_EDGE on the data texture extends the edge cells
    //past the bbox so the quad can overshoot the data extent without a hard cut.
    vec2 uv = vec2(
        (v_geo.x - u_bbox.x) / (u_bbox.z - u_bbox.x),
        (v_geo.y - u_bbox.y) / (u_bbox.w - u_bbox.y)
    );

    //Early discard outside the quad bbox: skip the FBM compute when the fragment can't
    //contribute (CLAMP_TO_EDGE would still feed an edge value, but the edge fade below kills
    //the alpha anyway).
    if (uv.x < -0.01 || uv.x > 1.01 || uv.y < -0.01 || uv.y > 1.01) { discard; }

    //Quad edge fade. Computed up front so a near-zero edge factor can short-circuit the FBM.
    float edgeFade = smoothstep(0.0, 0.10, uv.x) * smoothstep(1.0, 0.90, uv.x)
                   * smoothstep(0.0, 0.10, uv.y) * smoothstep(1.0, 0.90, uv.y);
    if (edgeFade <= 0.001) { discard; }

    vec4 dataSample = texture2D(u_dataTexture, uv);
    float coverage = (u_bandIndex < 0.5) ? dataSample.r
                   : (u_bandIndex < 1.5) ? dataSample.g
                                         : dataSample.b;

    //Latitude correction: Web Mercator stretches longitude by 1 / cos(lat); scaling x by
    //cos(lat) here lets the noise sample at "round" geographic units so the cloud features
    //look the same in both axes instead of being elongated east-west.
    vec2 noiseSpace = vec2(v_geo.x * u_latCos, v_geo.y);

    //Per-band noise scale: low clouds break into tighter puffs (high frequency), high clouds
    //spread as broad sheets (low frequency). The per-band phase offset decorrelates the three
    //altitude layers so a fully overcast point shows three distinct cloud shapes rather than
    //three identical greys stacking.
    float scale = mix(28.0, 14.0, u_bandIndex * 0.5);   //low=28, mid=21, high=14 cycles / deg
    float phase = u_bandIndex * 137.5;

    float noise = fbm(noiseSpace * scale + vec2(phase), u_time);
    noise = clamp(noise * 0.5 + 0.5, 0.0, 1.0);

    //Threshold-driven cloud carving with a wide smoothstep band so the noise variation stays
    //visible even at the extremes:
    //  coverage = 0   -> threshold = 0.90 -> almost everything dark (only the highest peaks)
    //  coverage = 0.5 -> threshold = 0.50 -> noise cleanly carves organic shapes
    //  coverage = 1   -> threshold = 0.10 -> mostly full, but noise still carves visible relief
    //The 0.45-wide smoothstep keeps a transition from "carved hole" to "thick cloud" across
    //the full noise range at every coverage level, so overcast skies still look textured.
    float threshold = 1.0 - coverage * 0.8 - 0.10;
    float density   = smoothstep(threshold - 0.10, threshold + 0.35, noise);

    float alpha = density * u_opacity * edgeFade;

    //Premultiplied alpha for MapLibre's framebuffer. The blend func is gl.ONE / gl.ONE_MINUS_
    //SRC_ALPHA in the host (see render()), so the rgb channel must already carry alpha.
    gl_FragColor = vec4(u_color * alpha, alpha);
}
`;


//Web Mercator projection used by MapLibre internally: longitude / latitude -> [0, 1]^2 unit
//square. The output is what mainMatrix transforms straight to clip space.
function lngLatToMercator(lng: number, lat: number): [number, number]
{
    const x = lng / 360 + 0.5;
    const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / (2 * Math.PI);
    return [x, y];
}


export class WeatherCloudLayer implements CustomLayerInterface
{
    public id   = 'helios-weather-cloud';
    public type = 'custom' as const;
    public renderingMode: '2d' = '2d';

    private map:           MaplibreMap            | null = null;
    private gl:            WebGLRenderingContext  | null = null;
    private program:       WebGLProgram           | null = null;
    private vertexBuffer:  WebGLBuffer            | null = null;
    private dataTexture:   WebGLTexture           | null = null;

    private aPos = -1;
    private aGeo = -1;
    private uMatrix:      WebGLUniformLocation | null = null;
    private uDataTexture: WebGLUniformLocation | null = null;
    private uBandIndex:   WebGLUniformLocation | null = null;
    private uColor:       WebGLUniformLocation | null = null;
    private uOpacity:     WebGLUniformLocation | null = null;
    private uTime:        WebGLUniformLocation | null = null;
    private uBbox:        WebGLUniformLocation | null = null;
    private uLatCos:      WebGLUniformLocation | null = null;

    private opts:    WeatherCloudLayerOptions;
    private startMs: number = performance.now();
    //cos(centre_lat) cached host-side so the per-frame render() loop is one uniform write per
    //draw instead of recomputing the trig on every call. Refreshed on every bbox update.
    private latCosCached: number = 1;

    constructor(opts: WeatherCloudLayerOptions)
    {
        this.opts = {
            ...opts,
            bandsVisible: [...opts.bandsVisible] as [boolean, boolean, boolean],
        };
        this._cacheLatitudeCos();
    }

    private _cacheLatitudeCos(): void
    {
        const centreLat = (this.opts.bbox.south + this.opts.bbox.north) / 2;
        this.latCosCached = Math.cos(centreLat * Math.PI / 180);
    }

    public onAdd(map: MaplibreMap, gl: WebGLRenderingContext): void
    {
        this.map = map;
        this.gl  = gl;
        this._compileProgram();
        this._uploadGeometry();
        this._uploadDataTexture();
    }

    public onRemove(): void
    {
        const gl = this.gl;
        if (gl)
        {
            if (this.program)      { gl.deleteProgram(this.program); }
            if (this.vertexBuffer) { gl.deleteBuffer(this.vertexBuffer); }
            if (this.dataTexture)  { gl.deleteTexture(this.dataTexture); }
        }
        this.program      = null;
        this.vertexBuffer = null;
        this.dataTexture  = null;
        this.gl           = null;
        this.map          = null;
    }

    //MapLibre 5 hands us either a Float32Array (legacy) or an object carrying defaultProjectionData.
    //mainMatrix. We sniff for the typed array shape and fall back to the object path.
    public render(gl: WebGLRenderingContext, args: Float32Array | CustomRenderMethodInput): void
    {
        if (!this.program || !this.vertexBuffer || !this.dataTexture) { return; }
        //MapLibre's `mat4` typing is wider than what gl.uniformMatrix4fv accepts directly, so we
        //pull the raw values out into a fresh Float32Array; allocating 16 floats per frame is
        //negligible compared to the rest of the per-frame cost.
        let matrix: Float32Array | null = null;
        if (ArrayBuffer.isView(args))
        {
            matrix = args as Float32Array;
        }
        else
        {
            const m = (args as CustomRenderMethodInput)?.defaultProjectionData?.mainMatrix as
                       ArrayLike<number> | undefined;
            if (m) { matrix = Float32Array.from(m); }
        }
        if (!matrix) { return; }

        gl.useProgram(this.program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
        gl.uniform1i(this.uDataTexture, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.enableVertexAttribArray(this.aPos);
        gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 5 * 4, 0);
        gl.enableVertexAttribArray(this.aGeo);
        gl.vertexAttribPointer(this.aGeo, 2, gl.FLOAT, false, 5 * 4, 3 * 4);

        gl.uniformMatrix4fv(this.uMatrix, false, matrix);
        gl.uniform3f(this.uColor, this.opts.color[0], this.opts.color[1], this.opts.color[2]);
        gl.uniform4f(this.uBbox,  this.opts.bbox.west, this.opts.bbox.south,
                                  this.opts.bbox.east, this.opts.bbox.north);
        gl.uniform1f(this.uLatCos, this.latCosCached);
        //Wrap the elapsed seconds at 3600 (1 h) so the time uniform stays within FP24 precision
        //even on mobile GPUs that demote highp float in the fragment shader. The drift step is
        //small enough that the wrap is invisible to the user.
        const elapsedSec = (performance.now() - this.startMs) / 1000;
        gl.uniform1f(this.uTime, elapsedSec % 3600);

        gl.enable(gl.BLEND);
        //Premultiplied alpha matches MapLibre's framebuffer; the fragment shader already
        //multiplies u_color by alpha so the rgb channel carries the colour scaled by coverage.
        //Using SRC_ALPHA / ONE_MINUS_SRC_ALPHA against a premultiplied source would double-blend
        //and saturate to flat colour.
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);

        //Paint order low -> mid -> high so the higher (more opaque) band sits on top, matching
        //the dot-cloud composition from previous betas. The band index is passed as a float so
        //the fragment shader can run ternaries against it without int-precision pitfalls on
        //mobile drivers.
        const order = [0, 1, 2] as const;
        for (const band of order)
        {
            if (!this.opts.bandsVisible[band]) { continue; }
            gl.uniform1f(this.uBandIndex, band);
            gl.uniform1f(this.uOpacity,   BAND_OPACITY[band]);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        //Schedule the next frame for the slow drift. MapLibre coalesces repaint requests so
        //even at 60 fps the cost is one map redraw per frame; the drift speed in the shader
        //(t * 0.04 / 0.05) is tuned for that cadence.
        this.map?.triggerRepaint();
    }

    public updateData(patch: Partial<WeatherCloudLayerOptions>): void
    {
        let needTexture  = false;
        let needGeometry = false;
        if (patch.cloudLow)     { this.opts.cloudLow  = patch.cloudLow;  needTexture  = true; }
        if (patch.cloudMid)     { this.opts.cloudMid  = patch.cloudMid;  needTexture  = true; }
        if (patch.cloudHigh)    { this.opts.cloudHigh = patch.cloudHigh; needTexture  = true; }
        if (patch.gridSide)     { this.opts.gridSide  = patch.gridSide;  needTexture  = true; }
        if (patch.bbox)         { this.opts.bbox      = patch.bbox;      needGeometry = true;
                                  this._cacheLatitudeCos(); }
        if (patch.color)        { this.opts.color     = patch.color; }
        if (patch.bandsVisible)
        {
            this.opts.bandsVisible = [...patch.bandsVisible] as [boolean, boolean, boolean];
        }
        if (this.gl)
        {
            if (needTexture)  { this._uploadDataTexture(); }
            if (needGeometry) { this._uploadGeometry(); }
        }
        this.map?.triggerRepaint();
    }

    //----------------------------------------------------------- internals

    private _compileProgram(): void
    {
        const gl = this.gl!;
        const vs = this._compileShader(gl.VERTEX_SHADER,   VERT_SRC);
        const fs = this._compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
        const program = gl.createProgram();
        if (!program) { throw new Error('weather-cloud-layer: failed to create program'); }
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`weather-cloud-layer: link failed: ${log}`);
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        this.program      = program;
        this.aPos         = gl.getAttribLocation(program, 'a_pos');
        this.aGeo         = gl.getAttribLocation(program, 'a_geo');
        this.uMatrix      = gl.getUniformLocation(program, 'u_matrix');
        this.uDataTexture = gl.getUniformLocation(program, 'u_dataTexture');
        this.uBandIndex   = gl.getUniformLocation(program, 'u_bandIndex');
        this.uColor       = gl.getUniformLocation(program, 'u_color');
        this.uOpacity     = gl.getUniformLocation(program, 'u_opacity');
        this.uTime        = gl.getUniformLocation(program, 'u_time');
        this.uBbox        = gl.getUniformLocation(program, 'u_bbox');
        this.uLatCos      = gl.getUniformLocation(program, 'u_latCos');
    }

    private _compileShader(type: number, src: string): WebGLShader
    {
        const gl = this.gl!;
        const sh = gl.createShader(type);
        if (!sh) { throw new Error('weather-cloud-layer: failed to create shader'); }
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        {
            const log = gl.getShaderInfoLog(sh);
            gl.deleteShader(sh);
            throw new Error(`weather-cloud-layer: shader compile failed: ${log}`);
        }
        return sh;
    }

    private _uploadGeometry(): void
    {
        const gl = this.gl!;
        const { west, south, east, north } = this.opts.bbox;
        //Quad as triangle strip: SW, SE, NW, NE. Each vertex stores 3 mercator coords + 2 lon/lat
        //attributes so the fragment shader can both sample the data texture (using lon/lat -> UV)
        //and feed the noise function at the geographic position.
        const mercSW = lngLatToMercator(west, south);
        const mercSE = lngLatToMercator(east, south);
        const mercNW = lngLatToMercator(west, north);
        const mercNE = lngLatToMercator(east, north);
        const buffer = new Float32Array([
            mercSW[0], mercSW[1], 0.0, west, south,
            mercSE[0], mercSE[1], 0.0, east, south,
            mercNW[0], mercNW[1], 0.0, west, north,
            mercNE[0], mercNE[1], 0.0, east, north,
        ]);
        if (!this.vertexBuffer)
        {
            this.vertexBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.STATIC_DRAW);
    }

    private _uploadDataTexture(): void
    {
        const gl = this.gl!;
        const N  = this.opts.gridSide;
        if (this.opts.cloudLow.length < N * N || this.opts.cloudMid.length < N * N
            || this.opts.cloudHigh.length < N * N)
        {
            return;
        }
        //Pack the 3 bands into the R / G / B channels of an N x N RGBA8 texture. Each cell stores
        //one cloud-cover percent quantised to 8 bits, which is plenty: the shader noise dominates
        //the visual signal at sub-percent scales anyway.
        const px = new Uint8Array(N * N * 4);
        for (let i = 0; i < N * N; i++)
        {
            const lo = this.opts.cloudLow[i];
            const mi = this.opts.cloudMid[i];
            const hi = this.opts.cloudHigh[i];
            px[i * 4 + 0] = Math.min(255, Math.max(0, lo * 2.55));
            px[i * 4 + 1] = Math.min(255, Math.max(0, mi * 2.55));
            px[i * 4 + 2] = Math.min(255, Math.max(0, hi * 2.55));
            px[i * 4 + 3] = 255;
        }
        if (!this.dataTexture)
        {
            this.dataTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
        else
        {
            gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
}
