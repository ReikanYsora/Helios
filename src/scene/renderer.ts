//SceneRenderer: the card-agnostic 2.5D renderer. It owns sibling elements inside the host container: a
//ground holder (the tilted basemap tile canvas + edge fade, driven by a CSS 3D transform), an optional
//ground overlay, and a screen-space scene <svg> repainted each frame with the occluding geometry
//(cast shadows, extruded buildings). The host drives data (location, buildings, sun, palette) and pose
//(bearing/pitch), then calls redraw(); per-frame work is rAF-coalesced.
//
//It does not own the HUD (chips, leaders, sun arc, timeline): the host owns those in its own SVG layer
//above this one, projected through `camera`.

import { SceneCamera } from './projection';
import { pxPerMetreFor, type Ground } from './tiles';
import { buildVectorGround, GROUND_LAYER_KEYS, type GroundStyle, type GroundPalette } from './ground-render';
import { renderBuildings, renderShadows, type Building, type ScenePalette, type HomeAppearance } from './buildings';
import { gradeColor } from '../core/render-kit/colors';
import {
    SVG_NS,
    GROWTH_RISE_MS,
    HOME_SQUASH_MS,
    HOME_GROW_MS,
    GROUND_RADIUS,
    TILE_PX,
} from '../core/config/constants';

//Edge of the square basemap canvas (px): (2*radius+1) tiles across. On the normal path this canvas is CSS
//3D-transformed, so the compositor backs it as one layer of this size.
const GROUND_CANVAS_EDGE_PX = (2 * GROUND_RADIUS + 1) * TILE_PX;

//The GPU's max texture edge (px) and its renderer string, from a throwaway WebGL context. Both 0 / '' when they
//can't be read. The renderer is the GPU's own identity: the standard RENDERER when the browser fills it (Firefox),
//else the unmasked WEBGL_debug_renderer_info extension (Chrome masks RENDERER); '' when both are masked for privacy.
interface GpuProbe { maxTex: number; renderer: string; }

function probeGpu(): GpuProbe
{
    if (typeof document === 'undefined')
    {
        return { maxTex: 0, renderer: '' };
    }
    try
    {
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (!gl)
        {
            return { maxTex: 0, renderer: '' };
        }
        const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as unknown;
        //Prefer the standard RENDERER: Firefox exposes the real GPU there and DEPRECATES WEBGL_debug_renderer_info,
        //so touching that extension logs a console warning. Only fall back to the (deprecated) unmasked extension
        //when the standard value names no known GPU family, which is Chrome's case (it masks RENDERER) - so Chrome
        //still identifies the chip while Firefox never hits the deprecated path.
        let renderer = String(gl.getParameter(gl.RENDERER) ?? '');
        if (!/\b(?:Adreno|Mali|PowerVR|VideoCore|V3D|Apple|NVIDIA|GeForce|AMD|Radeon|Intel|Iris|ANGLE)\b/i.test(renderer))
        {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg)
            {
                renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? renderer);
            }
        }
        //No WEBGL_lose_context/loseContext(): it logs a "WebGL context was lost" console warning, and this throwaway
        //context (created once per renderer, never per frame) is reclaimed by the GC.
        return { maxTex: typeof max === 'number' && Number.isFinite(max) ? max : 0, renderer };
    }
    catch
    {
        return { maxTex: 0, renderer: '' };
    }
}

//Entry / mid embedded GPUs that mis-composite the 3D basemap tilt (whole-view flicker, black kiosk screenshots).
//There is no numeric WebGL cap that separates them — the composited-layer behaviour is deliberately not exposed to
//JS (the same opacity that blacks out a kiosk screenshot of the layer) — so we key on the GPU string, exactly like
//Chromium's own gpu_driver_bug_list.json (matched against GL_RENDERER). Chromium blocklists whole families for
//severe bugs ("Mali.*", "Adreno.*", "PowerVR .*"); there is no per-model list, and a false positive is cheap (the
//projected path is near-equivalent), so we match by family and only carve out the current flagships:
//  - Imagination PowerVR (all): entry Android / MediaTek.
//  - Broadcom VideoCore / V3D: common on the small single-board computers used as Home Assistant wall displays.
//  - Qualcomm Adreno 2xx-6xx: entry / mid; 7xx flagships stay on the fast path.
//  - ARM Mali (all but the G7xx flagship line): entry/mid parts report an ample texture cap, so only the
//    string separates it.
function isEntryAndroidGpu(renderer: string): boolean
{
    if (/\bPowerVR\b/i.test(renderer))
    {
        return true;
    }
    if (/\b(?:VideoCore|V3D)\b/i.test(renderer))
    {
        return true;
    }
    if (/\bAdreno\b/i.test(renderer))
    {
        return /\bAdreno[^0-9]*[2-6]\d\d\b/i.test(renderer);
    }
    if (/\bMali\b/i.test(renderer))
    {
        return !/\bMali-?G7\d\d\b/i.test(renderer);
    }
    return false;
}

//Old iOS/iPadOS WebKit half-composites a flat layer over a CSS 3D-transformed one, clipping the whole scene to
//its top half. Those devices render the ground on the projected compat path instead of a 3D
//transform. It cannot be feature-detected (no API reads composited pixels), so we sniff: an Apple touch device
//(including iPadOS masquerading as macOS Safari) on Safari <= 16, the WebKit generation that carries the bug and
//the ceiling for the old hardware it runs on. A miss on a newer device keeps the (perfect) normal path; a false
//positive only swaps in the near-equivalent compat render, so erring is cheap.
//How the basemap is drawn, decided once per device.
//  'normal'    : GPU-rasterized canvas + CSS 3D transform (fast, correct) - capable devices.
//  'transform' : CPU-rasterized canvas (willReadFrequently) STILL under the CSS 3D transform. Entry Android GPUs
//                (Mali/Adreno) corrupt a GPU-rasterized canvas into colored noise, but the CPU raster has correct
//                pixels and a plain texture composites fine on them (the 3D-transformed SVG scene already does). So
//                the rotation stays a cheap GPU transform instead of a per-frame CPU reprojection.
//  'projected' : CPU canvas repainted already-projected when the pose changes, no 3D layer - for devices where the
//                3D transform itself is broken (texture cap too small to back the layer; old iOS half-3D compositor).
//A debug flag (localStorage 'helios-ground' = normal|transform|projected) forces any mode for A/B on a real device.
type GroundMode = 'normal' | 'transform' | 'projected';

function groundMode(degraded = false): GroundMode
{
    if (typeof localStorage !== 'undefined')
    {
        const forced = localStorage.getItem('helios-ground');
        if (forced === 'normal' || forced === 'transform' || forced === 'projected')
        {
            return forced;
        }
    }
    //User opt-in compatibility mode (config `degraded-render`): force the projected path, which drops the CSS 3D
    //transform entirely and is the most compatible render, for a device whose WebView flickers on the 3D layer.
    if (degraded)
    {
        return 'projected';
    }
    const { maxTex, renderer } = probeGpu();
    //Texture cap smaller than the canvas: the 3D-transformed layer can't be backed at all (old 2048-cap GPUs) -> reproject.
    if (maxTex > 0 && maxTex < GROUND_CANVAS_EDGE_PX)
    {
        return 'projected';
    }
    //Entry / mid Android GPU (ample texture cap): corrupts a GPU canvas -> CPU raster, keep the transform.
    if (isEntryAndroidGpu(renderer))
    {
        return 'transform';
    }
    //Renderer masked (Android WebView: the HA app, kiosk apps hide the GPU name): can't tell entry from flagship, so
    //on Android treat it as the corruption class and take the CPU-raster transform path.
    if (renderer === '' && typeof navigator !== 'undefined')
    {
        if (/\bAndroid\b/i.test(navigator.userAgent || ''))
        {
            return 'transform';
        }
        //Non-Android masked + low memory (<= 4 GB, coarse Chrome-only signal): unknown weakness, stay on the safe reproject.
        const mem = (navigator as { deviceMemory?: number }).deviceMemory;
        if (typeof mem === 'number' && mem <= 4)
        {
            return 'projected';
        }
    }

    if (typeof navigator === 'undefined')
    {
        return 'normal';
    }
    const ua = navigator.userAgent || '';
    const appleTouch = /iPad|iPhone|iPod/.test(ua)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!appleTouch)
    {
        return 'normal';
    }
    //Old iOS/iPadOS WebKit (Safari <= 16, or an in-app WKWebView on that hardware) half-composites the 3D layer and
    //clips the scene to its top half, so the transform itself is broken there -> reproject. Read "Version/NN" or the
    //"CPU OS NN" token; a stripped WebView UA with neither errs to the reprojected path.
    const safari = ua.match(/Version\/(\d+)/);
    const os     = ua.match(/(?:CPU|iPhone) OS (\d+)/);
    const major  = (safari ? parseInt(safari[1], 10) : 0) || (os ? parseInt(os[1], 10) : 0);
    if (major > 0)
    {
        return major <= 16 ? 'projected' : 'normal';
    }
    return 'projected';
}

//Honour the OS "reduce motion" setting: the rise + squash/grow animations resolve instantly when set.
const prefersReducedMotion = (): boolean =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export interface SceneRendererOptions
{
    //Shadow colour/opacity for the painted geometry, merged into the palette.
    shadow?:        string;
    shadowOpacity?: number;
    //Force the compatibility ("degraded") ground path (projected, no CSS 3D transform). User opt-in for a device
    //the auto-detection missed. The localStorage debug flag still wins over it.
    degraded?:      boolean;
}

export interface ScenePaletteFull extends ScenePalette
{
    shadow:          string;
    shadowOpacity:   number;
    //0..1 how solid the surrounding (non-home) buildings read.
    neighborOpacity: number;
}

export class SceneRenderer
{
    public readonly camera = new SceneCamera();

    private readonly _container:    HTMLElement;
    private readonly _groundHolder: HTMLDivElement;
    private readonly _sceneSvg:     SVGSVGElement;

    private _ground?:     Ground;
    //Repaints the current ground canvas from its cached vector features with a new style + sun altitude (theme
    //flip / colour config / day-night grade), so it never re-fetches tiles.
    private _groundRepaint?: (style: GroundStyle, altitude: number) => void;
    //Compat path: repaint the ground already projected, so its canvas carries no CSS 3D
    //transform. Memoised on the pose so it only repaints when the camera (or size/altitude) actually moved.
    private _groundRepaintProjected?: (
        camera: SceneCamera, w: number, h: number, style: GroundStyle, altitude: number,
    ) => void;
    private _projectedPose = '';
    //Pose signature of the last buildings+shadows SVG rebuild, so an unchanged scene skips the reparse (see _draw).
    private _lastScenePose = '';
    //Bumped by setBuildings/setPalette so the pose guard rebuilds when the scene DATA (not just the pose) changes.
    private _sceneRev = 0;
    //Ground render path, decided once per device (see groundMode): 'normal' / 'transform' both use the CSS 3D
    //transform; 'projected' repaints the ground already-projected each frame.
    private _groundMode: GroundMode = groundMode();
    //Current ground style + sun altitude, kept so an altitude step or style change can repaint from the cache.
    private _groundStyleCur?: GroundStyle;
    private _groundAltitude  = 45;
    //"Your real sky" weather grade, baked into the ground + building colours instead of a CSS filter on the whole
    //map layer (which re-flattens the 3D-transformed scene every frame -> flicker on Android WebViews). saturate
    //then brightness, 1/1 = neutral. Only the paint carries it, so rotation stays a pure GPU transform.
    private _wxSat    = 1;
    private _wxBright = 1;
    //Increments per build so a slower in-flight tile fetch can't overwrite a newer one (guards a rapid
    //home-position change landing while the previous tile grid is still fetching).
    private _groundToken = 0;
    private _buildings: Building[] = [];
    private _sun = { azimuth: 0, altitude: 0 };
    private _growth = 1;
    //Home prism appearance (colour, squash multiplier). Empty colour falls back to palette.home.
    private _home: HomeAppearance = { growth: 1 };
    private _homeRaf = 0;
    private _palette: ScenePaletteFull = {
        home:            '#488fc2',
        neighbor:        '#cccccc',
        shadow:          '#000000',
        shadowOpacity:   0.32,
        neighborOpacity: 0.25,
    };

    private _redrawScheduled = false;
    private _rafToken = 0;
    private _growthRaf = 0;
    private _alive = true;
    private _resizeObserver?: ResizeObserver;
    //Last container size the observer acted on, so a no-op resize notification can't loop into a redraw.
    private _obsW = -1;
    private _obsH = -1;
    //Called after each redraw so the host can re-project its HUD on the same frame.
    public onAfterDraw?: () => void;

    public constructor(container: HTMLElement, opts: SceneRendererOptions = {})
    {
        this._container = container;
        if (opts.shadow)
        {
            this._palette.shadow = opts.shadow;
        }
        if (opts.shadowOpacity != null)
        {
            this._palette.shadowOpacity = opts.shadowOpacity;
        }
        //Compatibility mode re-decides the ground path as 'projected' (the localStorage debug flag still wins).
        if (opts.degraded === true)
        {
            this._groundMode = groundMode(true);
        }

        this._groundHolder = document.createElement('div');
        this._groundHolder.className = 'scene-ground-holder';
        this._sceneSvg = document.createElementNS(SVG_NS, 'svg');
        this._sceneSvg.setAttribute('class', 'scene-svg');
        container.appendChild(this._groundHolder);
        container.appendChild(this._sceneSvg);

        //The camera centres on width/2 x height/2, so a draw taken before the container has its final size
        //lands the whole scene in the top-left. The container often starts at 0x0 (the first draw bails) or a
        //transient size (edit-mode relayout, first paint) and settles a frame or two later, with no data/sun
        //change to trigger another draw. Owning resize -> redraw here re-projects the scene at the true size
        //the moment the container reaches it, every layout.
        //
        //Only redraw on a REAL size change: a draw repaints the HUD, which the host re-projects, and that DOM
        //write can fire the observer again. Without this guard the no-op notification re-draws, re-projects,
        //re-fires: an infinite ResizeObserver loop (visible as the scene flickering every frame).
        //Feature-detected like the same API in the weather layer: a device without ResizeObserver just keeps the
        //size it was seeded with instead of throwing out of the constructor.
        if (typeof ResizeObserver !== 'undefined')
        {
            this._resizeObserver = new ResizeObserver((entries) =>
            {
                const cr = entries[entries.length - 1]?.contentRect;
                if (!cr)
                {
                    return;
                }
                const w = Math.round(cr.width);
                const h = Math.round(cr.height);
                if (w === this._obsW && h === this._obsH)
                {
                    return;
                }
                this._obsW = w;
                this._obsH = h;
                this.scheduleRedraw();
            });
            this._resizeObserver.observe(container);
        }

        //Seed the camera from the container's current size. The container is already laid out when the
        //renderer is built, so the camera projects against a real viewport from the first frame instead of
        //the (0,0) seed, which would flash the whole HUD into the top-left corner for a frame.
        const w0 = container.clientWidth;
        const h0 = container.clientHeight;
        if (w0 > 0 && h0 > 0)
        {
            this.camera.setViewport(w0, h0);
        }
    }

    //Build the ground basemap for a home position. One style serves both themes; dark mode is a CSS
    //filter on the canvas, so a theme flip never re-tiles.
    public async setLocation(lat: number, lon: number, style: GroundStyle): Promise<void>
    {
        this.camera.pxPerMetre = pxPerMetreFor(lat);
        const token = ++this._groundToken;
        //Any compat mode ('transform' or 'projected') backs the ground canvas on the CPU (willReadFrequently) to
        //dodge the entry-GPU driver's GPU-canvas corruption; only 'normal' uses the GPU-rasterized canvas.
        const built = await buildVectorGround(lat, lon, style, this._groundAltitude, undefined, this._groundMode !== 'normal');
        if (!this._alive || token !== this._groundToken)
        {
            return;
        }
        this._groundStyleCur = style;
        this._ground         = built.ground;
        //Layer-promotion hint for the CPU-raster transform path: stabilizes the tilted canvas's compositing layer on
        //the entry GPUs that would otherwise be prone to mis-compositing it.
        if (this._groundMode === 'transform')
        {
            built.ground.el.style.backfaceVisibility = 'hidden';
        }
        this._groundRepaint  = built.repaint;
        this._groundRepaintProjected = built.repaintProjected;
        this._projectedPose = '';
        //buildVectorGround painted the ground ungraded; if a weather grade is already active, repaint it graded.
        if (this._wxSat !== 1 || this._wxBright !== 1)
        {
            this._repaintGroundFromCache();
        }
        this._groundHolder.replaceChildren(built.ground.el, built.ground.fade);
        //The ground is a canvas painted ONCE and thereafter only CSS-transformed: the draw loop never touches its
        //pixels. A browser may drop a canvas's backing store while the page sits idle, and nothing here would put
        //it back, so the basemap came back blank with the SVG buildings (being DOM) floating over nothing. The
        //visibility hook covers a tab going away; this covers the case that has no visibility change at all, which
        //is the wall-tablet one: the card stays "visible" while the screen sleeps. `contextrestored` is the
        //browser saying exactly "I dropped your pixels, here is a fresh surface" -- repaint on the spot, from the
        //cached features, no network.
        built.ground.el.addEventListener('contextrestored', () =>
        {
            if (this._alive && this._groundStyleCur)
            {
                this.setGroundStyle(this._groundStyleCur);
            }
        });
        this.scheduleRedraw();
    }

    //Repaint the ground with a new style (theme flip / colour config) from the cached vector features, no fetch.
    public setGroundStyle(style: GroundStyle): void
    {
        this._groundStyleCur = style;
        this._repaintGroundFromCache();
        this.scheduleRedraw();
    }

    //Repaint the ground for a new sun altitude (the day/night colour grade), from the cached features, no fetch.
    public setGroundAltitude(altitude: number): void
    {
        this._groundAltitude = altitude;
        this._repaintGroundFromCache();
        this.scheduleRedraw();
    }

    //Set the "your real sky" weather grade (saturate/brightness). Baked into the ground + building colours, not a
    //CSS filter, so a static scene rotates as a pure GPU transform. A no-op when unchanged; a change repaints the
    //ground from its cache and rebuilds the scene SVG (both pose-guarded on the grade below).
    public setWeatherGrade(sat: number, bright: number): void
    {
        if (sat === this._wxSat && bright === this._wxBright)
        {
            return;
        }
        this._wxSat    = sat;
        this._wxBright = bright;
        this._repaintGroundFromCache();
        this.scheduleRedraw();
    }

    //The current ground style with the weather grade baked into its palette (the same style object when neutral, so
    //the common path allocates nothing). Grading the palette before the altitude tint keeps the ground consistent
    //with the buildings, which grade the same way.
    private _gradedGroundStyle(): GroundStyle | undefined
    {
        if (!this._groundStyleCur)
        {
            return undefined;
        }
        if (this._wxSat === 1 && this._wxBright === 1)
        {
            return this._groundStyleCur;
        }
        const src     = this._groundStyleCur.palette;
        const palette = {} as GroundPalette;
        for (const key of GROUND_LAYER_KEYS)
        {
            palette[key] = gradeColor(src[key], this._wxSat, this._wxBright);
        }
        return { palette, hidden: this._groundStyleCur.hidden };
    }

    //Repaint the ground canvas from its cached vector features at the current style + grade + altitude.
    private _repaintGroundFromCache(): void
    {
        const style = this._gradedGroundStyle();
        if (this._groundRepaint && style)
        {
            this._groundRepaint(style, this._groundAltitude);
        }
    }

    public setBuildings(buildings: Building[]): void
    {
        this._buildings = buildings;
        this._sceneRev++;
        this.scheduleRedraw();
    }

    public setSun(azimuth: number, altitude: number): void
    {
        this._sun = { azimuth, altitude };
        this.scheduleRedraw();
    }

    //Play the one-off building rise: prisms grow from the ground to full height (0 -> 1, cubic-out),
    //matching the HA energy dashboard graph animation. Instant under prefers-reduced-motion. The host
    //replays it whenever buildings (re)arrive, so it stays in step with the graphs.
    public animateGrowth(): void
    {
        if (this._growthRaf)
        {
            cancelAnimationFrame(this._growthRaf); this._growthRaf = 0;
        }
        if (prefersReducedMotion())
        {
            this._growth = 1;
            this.scheduleRedraw();
            return;
        }
        //Drop to the ground synchronously so the buildings never flash at full height for a frame before
        //the first animation tick lands.
        this._growth = 0;
        this.scheduleRedraw();
        const start = performance.now();
        const tick = (now: number): void =>
        {
            if (!this._alive)
            {
                this._growthRaf = 0; return;
            }
            const t = Math.min(1, (now - start) / GROWTH_RISE_MS);
            this._growth = 1 - (1 - t) ** 3;
            this.scheduleRedraw();
            this._growthRaf = t < 1 ? requestAnimationFrame(tick) : 0;
        };
        this._growthRaf = requestAnimationFrame(tick);
    }

    public setPalette(p: Partial<ScenePaletteFull>): void
    {
        this._palette = { ...this._palette, ...p };
        this._sceneRev++;
        this.scheduleRedraw();
    }

    //Set the home prism's colour instantly. Keeps the current squash multiplier so it doesn't interrupt an
    //in-flight animation.
    public setHome(color: string): void
    {
        this._home = { color, growth: this._home.growth ?? 1 };
        this.scheduleRedraw();
    }


    //Animate the home to a new colour: squash to the ground (old colour), swap colour at the bottom, then
    //grow back up (new colour). Instant under reduced motion or on first paint (no prior colour).
    public animateHomeTo(color: string): void
    {
        if (this._homeRaf)
        {
            cancelAnimationFrame(this._homeRaf); this._homeRaf = 0;
        }
        if (!this._home.color || prefersReducedMotion())
        {
            this._home = { color, growth: 1 };
            this.scheduleRedraw();
            return;
        }
        const DOWN = HOME_SQUASH_MS;
        const UP   = HOME_GROW_MS;
        const start = performance.now();
        const tick = (now: number): void =>
        {
            if (!this._alive)
            {
                this._homeRaf = 0; return;
            }
            const t = now - start;
            if (t < DOWN)
            {
                const x = t / DOWN;
                this._home = { ...this._home, growth: 1 - x * x * x }; //ease-in squash 1 -> 0, old colour
            }
            else if (t < DOWN + UP)
            {
                const x = (t - DOWN) / UP;
                this._home = { color, growth: 1 - (1 - x) ** 3 }; //swapped at the bottom, ease-out grow
            }
            else
            {
                this._home = { color, growth: 1 };
                this.scheduleRedraw();
                this._homeRaf = 0;
                return;
            }
            this.scheduleRedraw();
            this._homeRaf = requestAnimationFrame(tick);
        };
        this._homeRaf = requestAnimationFrame(tick);
    }

    public setCameraBearing(deg: number): void
    {
        this.camera.setPose(deg, this.camera.tiltDeg);
        this.scheduleRedraw();
    }

    public setCameraPitch(deg: number): void
    {
        this.camera.setPose(this.camera.bearingDeg, deg);
        this.scheduleRedraw();
    }

    public getCameraBearing(): number
    {
        return this.camera.bearingDeg;
    }
    public getCameraPitch():   number
    {
        return this.camera.tiltDeg;
    }

    //rAF-coalesced redraw: many setters per frame collapse to one paint.
    public scheduleRedraw(): void
    {
        if (this._redrawScheduled || !this._alive)
        {
            return;
        }
        this._redrawScheduled = true;
        this._rafToken = requestAnimationFrame(() =>
        {
            this._redrawScheduled = false;
            this._draw();
        });
    }

    //Compat path: paint the basemap in screen space, sized to the card, with no transform on the element.
    //Skipped unless the pose actually changed, so a static scene costs nothing.
    private _paintProjectedGround(w: number, h: number): void
    {
        if (!this._ground || !this._groundRepaintProjected || !this._groundStyleCur)
        {
            return;
        }
        const pose = `${w}x${h}|${this.camera.bearingDeg.toFixed(2)}|${this.camera.tiltDeg.toFixed(2)}|${this._groundAltitude.toFixed(1)}|${this._wxSat}|${this._wxBright}`;
        if (pose === this._projectedPose)
        {
            return;
        }
        this._projectedPose = pose;
        const style = this._gradedGroundStyle() ?? this._groundStyleCur;
        this._groundRepaintProjected(this.camera, w, h, style, this._groundAltitude);
        //Compat path carries no CSS transform; clear any left over from the normal path (matters when toggling).
        this._ground.el.style.transform = '';
        this._ground.el.style.transformOrigin = '';
        //The edge fade is baked into the projected canvas (in the plane), so the face-on .ground-fade disc that
        //would otherwise sit flat against the camera stays hidden on this path.
        this._ground.fade.style.display = 'none';
    }


    private _draw(): void
    {
        if (!this._alive)
        {
            return;
        }
        //Read the live size at draw time. The draw is rAF-coalesced, so by the time it runs the layout pass
        //has settled: clientWidth is the final size, not the transient the ResizeObserver may have captured
        //mid-relayout (which would centre the scene on ~(0,0) for a frame). Bail while the container has no
        //size yet (hidden tab, pre-layout); the observer re-fires the draw once it gains one.
        const width  = this._container.clientWidth  || 0;
        const height = this._container.clientHeight || 0;
        if (width === 0 || height === 0)
        {
            return;
        }

        this.camera.setViewport(width, height);

        //Tilt + turn the basemap about the home, then translate the home onto the screen-space centre. 'projected'
        //repaints already-projected (no transform); 'normal' and 'transform' both ride the cheap CSS 3D transform.
        if (this._ground)
        {
            if (this._groundMode === 'projected')
            {
                this._paintProjectedGround(width, height);
            }
            else
            {
                const { transform, transformOrigin } = this.camera.groundTransform(this._ground.homeX, this._ground.homeY);
                this._ground.el.style.transformOrigin = transformOrigin;
                this._ground.el.style.transform = transform;
                this._ground.fade.style.display = '';
                this._ground.fade.style.width  = `${this._ground.size}px`;
                this._ground.fade.style.height = `${this._ground.size}px`;
                this._ground.fade.style.transformOrigin = transformOrigin;
                this._ground.fade.style.transform = transform;
            }
        }

        this._sceneSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        //The buildings + shadows layer is a full innerHTML rebuild + reparse, the heaviest per-frame cost. Skip it
        //when nothing it reads changed since the last draw (camera pose, sun, growth, home, and a revision bumped by
        //setBuildings/setPalette), mirroring the ground compat path's own pose guard above. Anything below the SVG
        //that must run every frame (onAfterDraw) stays outside this gate.
        const scenePose = `${width}x${height}|${this.camera.bearingDeg.toFixed(2)}|${this.camera.tiltDeg.toFixed(2)}`
            + `|${this._sun.azimuth.toFixed(2)}|${this._sun.altitude.toFixed(2)}|${this._growth.toFixed(3)}`
            + `|${this._home.color ?? ''}|${(this._home.growth ?? 1).toFixed(3)}|${this._sceneRev}`
            + `|${this._wxSat}|${this._wxBright}`;
        if (scenePose !== this._lastScenePose)
        {
            this._lastScenePose = scenePose;
            const alt = this._sun.altitude;
            const drawn = this._buildings;
            //Bake the weather grade into the building + shadow colours (identity at 1/1, so the neutral path is
            //byte-identical to before). Opacities are untouched - the grade is a colour transform, like the CSS
            //filter it replaces, but without wrapping the 3D-transformed layer in a per-frame re-flatten.
            const s = this._wxSat;
            const br = this._wxBright;
            const gradedPalette: ScenePalette = {
                home:     gradeColor(this._palette.home, s, br),
                neighbor: gradeColor(this._palette.neighbor, s, br),
            };
            const gradedShadow = gradeColor(this._palette.shadow, s, br);
            const gradedHome: HomeAppearance = this._home.color
                ? { ...this._home, color: gradeColor(this._home.color, s, br) }
                : this._home;
            //No full-frame night/twilight wash: the day/night atmosphere comes from the graded ground palette + the
            //altitude-tinted buildings, so there is no flat translucent veil fogging the map.
            //Each pass in its own group. A <g> changes nothing about the picture, and it makes the two passes
            //addressable from a stylesheet - which is the only way to hold one of them off, since this innerHTML is
            //rebuilt whole and anything done to the nodes themselves is gone by the next rebuild.
            this._sceneSvg.innerHTML =
                `<g class="scene-shadows">`
                + renderShadows(this.camera, drawn, this._sun, gradedShadow, this._palette.shadowOpacity)
                + `</g><g class="scene-buildings">`
                + renderBuildings(this.camera, drawn, alt, gradedPalette, this._growth, this._palette.neighborOpacity, gradedHome, this._sun.azimuth)
                + `</g>`;
        }

        this.onAfterDraw?.();
    }

    public cleanup(): void
    {
        this._alive = false;
        this._resizeObserver?.disconnect();
        this._resizeObserver = undefined;
        if (this._rafToken)
        {
            cancelAnimationFrame(this._rafToken); this._rafToken = 0;
        }
        if (this._growthRaf)
        {
            cancelAnimationFrame(this._growthRaf); this._growthRaf = 0;
        }
        if (this._homeRaf)
        {
            cancelAnimationFrame(this._homeRaf); this._homeRaf = 0;
        }
        this._groundHolder.remove();
        this._sceneSvg.remove();
    }
}
