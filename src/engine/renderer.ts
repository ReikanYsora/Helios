//SceneRenderer — the card-agnostic 2.5D renderer. It owns two sibling elements inside the host
//container: a ground holder (the tilted basemap tile canvas + edge fade, driven by a CSS 3D transform)
//and a screen-space scene <svg> it repaints each frame with the occluding geometry (night-shade wash,
//cast shadows, extruded buildings). The host drives data (location, buildings, sun, palette) and pose
//(bearing/pitch), then calls redraw(); per-frame work is rAF-coalesced.
//
//It does not own the HUD (chips, leaders, sun arc, timeline): those are card-specific and sit in their own
//SVG layer above this one, projected through `camera`.

import { SceneCamera } from './projection';
import { buildGround, pxPerMetreFor, type Ground } from './tiles';
import { renderBuildings, renderShadows, type Building, type ShadowCaster, type ScenePalette, type HomeAppearance } from './buildings';
import { drawWireframe, type NdsmRaster } from './lidar-ndsm';
import { nightShade } from './colors';
import {
    SVG_NS,
    GROWTH_RISE_MS,
    HOME_SQUASH_MS,
    HOME_GROW_MS,
} from '../constants';

//Wireframe sampling cap (max mesh nodes per side); the raster is sub-sampled to keep the edge count bounded.
const WIREFRAME_MAX_NODES = 200;
//Half-size (metres) of the central square the wireframe draws — a zoom-19 view doesn't need the full display
//radius, and capping it keeps the mesh dense and cheap.
const WIREFRAME_RADIUS_M = 100;

//Honour the OS "reduce motion" setting: the rise + squash/grow animations resolve instantly when set.
const prefersReducedMotion = (): boolean =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export interface SceneRendererOptions
{
    //Sun colour + shadow colour/opacity for the painted geometry; merged into the palette.
    sun?:           string;
    shadow?:        string;
    shadowOpacity?: number;
}

export interface ScenePaletteFull extends ScenePalette
{
    sun:             string;
    shadow:          string;
    shadowOpacity:   number;
    //0..1 how solid the surrounding (non-home) buildings read; from the card's building-opacity config.
    neighborOpacity: number;
}

export class SceneRenderer
{
    public readonly camera = new SceneCamera();

    private readonly _container:    HTMLElement;
    private readonly _groundHolder: HTMLDivElement;
    private readonly _groundOverlay: SVGSVGElement;
    private readonly _sceneSvg:     SVGSVGElement;
    //Topmost layer: the LiDAR wireframe mesh, drawn as one batched canvas stroke (sits above the scene SVG by
    //DOM order, so no z-index needed).
    private readonly _wireframeCanvas: HTMLCanvasElement;
    private readonly _wireframeCtx:    CanvasRenderingContext2D | null;

    private _ground?:     Ground;
    //Increments per build so a slower in-flight tile fetch can't overwrite a newer one — guards a rapid
    //home-position change landing while the previous tile grid is still fetching.
    private _groundToken = 0;
    private _buildings: Building[] = [];
    //When set, ground shadows are cast from these (LiDAR clump casters) instead of the building footprints,
    //with their own max length so tall tree/roof shadows aren't clipped to the building cap. Null = footprints.
    private _shadowCasters: ShadowCaster[] | null = null;
    private _shadowMaxM: number | undefined;
    //LiDAR view wireframe: the decoded nDSM surface, drawn as a projected mesh on top of the scene when on.
    private _wireframeRaster: NdsmRaster | null = null;
    private _wireframeOn = false;
    //True while the canvas holds a mesh, so a draw with the wireframe off clears it once rather than every frame.
    private _wireframeDrawn = false;
    private _sun = { azimuth: 0, altitude: 0 };
    private _growth = 1;
    //Home prism appearance (the active chip's colour, optional stacked PV-string bands, and the squash
    //multiplier for the on-retarget animation). Empty colour falls back to palette.home (solid block).
    private _home: HomeAppearance = { growth: 1 };
    private _homeRaf = 0;
    //Home-only mode (clock view): draw just the home prism (no neighbours, no night wash) as the dial anchor.
    private _homeOnly = false;
    private _palette: ScenePaletteFull = {
        home:            '#488fc2',
        neighbor:        '#cccccc',
        sun:             '#ffc107',
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
    //Fired after each redraw so the host can re-project its HUD on the same frame.
    public onAfterDraw?: () => void;

    public constructor(container: HTMLElement, opts: SceneRendererOptions = {})
    {
        this._container = container;
        if (opts.sun)           { this._palette.sun = opts.sun; }
        if (opts.shadow)        { this._palette.shadow = opts.shadow; }
        if (opts.shadowOpacity != null) { this._palette.shadowOpacity = opts.shadowOpacity; }

        this._groundHolder = document.createElement('div');
        this._groundHolder.className = 'scene-ground-holder';
        //Screen-space overlay BETWEEN the basemap and the home prism, for the card's clock-mode ground guide
        //(hub + hour spokes). Sits here so the guide reads above the map yet UNDER the home, which the basemap
        //+ home being one stacking unit can't achieve with z-index alone.
        this._groundOverlay = document.createElementNS(SVG_NS, 'svg');
        this._groundOverlay.setAttribute('class', 'scene-ground-overlay');
        this._sceneSvg = document.createElementNS(SVG_NS, 'svg');
        this._sceneSvg.setAttribute('class', 'scene-svg');
        this._wireframeCanvas = document.createElement('canvas');
        this._wireframeCanvas.className = 'scene-wireframe-canvas';
        this._wireframeCtx = this._wireframeCanvas.getContext('2d');
        container.appendChild(this._groundHolder);
        container.appendChild(this._groundOverlay);
        container.appendChild(this._sceneSvg);
        container.appendChild(this._wireframeCanvas);

        //The camera centres on width/2 × height/2, so a draw taken before the container has its final size
        //lands the whole scene in the top-left. The container often starts at 0×0 (the first draw bails) or a
        //transient size (dashboard edit-mode relayout, first paint) and settles a frame or two later, with no
        //data/sun change to trigger another draw. Owning the resize → redraw here guarantees the scene
        //re-projects at the true size the moment the container reaches it, every layout.
        //
        //Only redraw on a REAL size change: a draw repaints the HUD, which the host re-projects (refreshHud),
        //and that DOM write can fire the observer again. Without this guard the no-op notification re-draws,
        //re-projects, re-fires — an infinite ResizeObserver loop (visible as the scene flickering every frame).
        this._resizeObserver = new ResizeObserver((entries) =>
        {
            const cr = entries[entries.length - 1]?.contentRect;
            if (!cr) { return; }
            const w = Math.round(cr.width);
            const h = Math.round(cr.height);
            if (w === this._obsW && h === this._obsH) { return; }
            this._obsW = w;
            this._obsH = h;
            this._sizeWireframeCanvas(w, h);
            this.scheduleRedraw();
        });
        this._resizeObserver.observe(container);

        //Seed the camera from the container's current size. The container is already laid out when the
        //renderer is built (the card element is reused; the engine is created once), so the camera projects
        //against a real viewport from the first frame instead of the (0,0) seed — which would flash the whole
        //HUD into the top-left corner for a frame.
        const w0 = container.clientWidth;
        const h0 = container.clientHeight;
        if (w0 > 0 && h0 > 0)
        {
            this.camera.setViewport(w0, h0);
            this._sizeWireframeCanvas(w0, h0);
        }
    }

    //Back the wireframe canvas at devicePixelRatio so the mesh stays crisp on HiDPI; the CSS box stays the
    //container size (the canvas projects in CSS px, scaled up by dpr in drawWireframe).
    private _sizeWireframeCanvas(w: number, h: number): void
    {
        const dpr = window.devicePixelRatio || 1;
        this._wireframeCanvas.width  = Math.round(w * dpr);
        this._wireframeCanvas.height = Math.round(h * dpr);
        this._wireframeCanvas.style.width  = `${w}px`;
        this._wireframeCanvas.style.height = `${h}px`;
        //Resizing a canvas clears it; mark it empty so the next draw repaints (and an off-state draw skips clearing).
        this._wireframeDrawn = false;
    }

    //Resolve + build the CARTO basemap for a home position. One Voyager style serves both themes; dark mode
    //is a CSS filter on the canvas, so a theme flip never re-tiles.
    public async setLocation(lat: number, lon: number): Promise<void>
    {
        this.camera.pxPerMetre = pxPerMetreFor(lat);
        const token  = ++this._groundToken;
        const ground = await buildGround(lat, lon);
        if (!this._alive || token !== this._groundToken) { return; }
        this._ground = ground;
        this._groundHolder.replaceChildren(ground.el, ground.fade);
        this.scheduleRedraw();
    }

    //Card-supplied screen-space SVG painted between the basemap and the home prism (the clock-mode ground guide).
    //Empty string clears it (scene mode).
    public setGroundOverlay(svg: string): void
    {
        this._groundOverlay.innerHTML = svg;
    }

    public setBuildings(buildings: Building[]): void
    {
        this._buildings = buildings;
        this.scheduleRedraw();
    }

    //Override the ground-shadow casters (LiDAR clumps) and their max shadow length. Null restores the
    //building-footprint shadows.
    public setShadowCasters(casters: ShadowCaster[] | null, maxShadowM?: number): void
    {
        this._shadowCasters = casters;
        this._shadowMaxM    = maxShadowM;
        this.scheduleRedraw();
    }

    //LiDAR view: the nDSM surface to draw as a wireframe (null clears it).
    public setWireframeRaster(raster: NdsmRaster | null): void
    {
        this._wireframeRaster = raster;
        this.scheduleRedraw();
    }

    //Toggle the wireframe layer (on only in the LiDAR view).
    public setWireframeEnabled(on: boolean): void
    {
        if (this._wireframeOn === on) { return; }
        this._wireframeOn = on;
        this.scheduleRedraw();
    }

    public setSun(azimuth: number, altitude: number): void
    {
        this._sun = { azimuth, altitude };
        this.scheduleRedraw();
    }

    public setGrowth(growth: number): void
    {
        this._growth = Math.max(0, Math.min(1, growth));
    }

    //Play the one-off building rise: prisms grow from the ground to full height (0 -> 1, cubic-out),
    //matching the energy dashboard graph animation. Instant under prefers-reduced-motion. The host replays
    //it whenever buildings (re)arrive or the tab is re-entered, so it stays in step with the graphs.
    public animateGrowth(): void
    {
        if (this._growthRaf) { cancelAnimationFrame(this._growthRaf); this._growthRaf = 0; }
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
            if (!this._alive) { this._growthRaf = 0; return; }
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
        this.scheduleRedraw();
    }

    //Set the home prism's colour + optional PV-string histogram bands instantly (a same-chip recolour or
    //scrub). Keeps the current squash multiplier so it doesn't interrupt an in-flight animation.
    public setHome(color: string, bands: { frac: number; color: string }[] = [], highlight = false): void
    {
        this._home = { color, bands, growth: this._home.growth ?? 1, highlight };
        this.scheduleRedraw();
    }

    //Toggle home-only rendering (clock mode shows the home prism alone, as the dial's centre anchor).
    public setHomeOnly(on: boolean): void
    {
        if (this._homeOnly === on) { return; }
        this._homeOnly = on;
        this.scheduleRedraw();
    }

    //Animate the home to a new colour/bands on chip retarget: squash to the ground (220 ms, old appearance),
    //swap colour + bands at the bottom, then grow back up (300 ms, new appearance). Instant under reduced
    //motion or when no prior colour exists (first paint).
    public animateHomeTo(color: string, bands: { frac: number; color: string }[] = []): void
    {
        if (this._homeRaf) { cancelAnimationFrame(this._homeRaf); this._homeRaf = 0; }
        if (!this._home.color || prefersReducedMotion())
        {
            this._home = { color, bands, growth: 1 };
            this.scheduleRedraw();
            return;
        }
        const DOWN = HOME_SQUASH_MS;
        const UP   = HOME_GROW_MS;
        const start = performance.now();
        const tick = (now: number): void =>
        {
            if (!this._alive) { this._homeRaf = 0; return; }
            const t = now - start;
            if (t < DOWN)
            {
                const x = t / DOWN;
                this._home = { ...this._home, growth: 1 - x * x * x }; //ease-in squash 1 -> 0, old appearance
            }
            else if (t < DOWN + UP)
            {
                const x = (t - DOWN) / UP;
                this._home = { color, bands, growth: 1 - (1 - x) ** 3 }; //swapped at the bottom, ease-out grow
            }
            else
            {
                this._home = { color, bands, growth: 1 };
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

    public getCameraBearing(): number { return this.camera.bearingDeg; }
    public getCameraPitch():   number { return this.camera.tiltDeg; }

    //rAF-coalesced redraw: many setters per frame collapse to one paint.
    public scheduleRedraw(): void
    {
        if (this._redrawScheduled || !this._alive) { return; }
        this._redrawScheduled = true;
        this._rafToken = requestAnimationFrame(() =>
        {
            this._redrawScheduled = false;
            this._draw();
        });
    }

    private _draw(): void
    {
        if (!this._alive) { return; }
        //Read the live size at draw time. The draw is rAF-coalesced, so by the time it runs the layout pass
        //has settled — clientWidth is the final size, not the transient the ResizeObserver may have captured
        //mid-relayout (which would centre the scene on ~(0,0) for a frame). Bail while the container has no
        //size yet (hidden tab, pre-layout); the observer re-fires the draw once it gains one.
        const width  = this._container.clientWidth  || 0;
        const height = this._container.clientHeight || 0;
        if (width === 0 || height === 0) { return; }

        this.camera.setViewport(width, height);

        //Tilt + turn the basemap about the home, then translate the home onto the screen-space centre.
        if (this._ground)
        {
            const { transform, transformOrigin } = this.camera.groundTransform(this._ground.homeX, this._ground.homeY);
            this._ground.el.style.transformOrigin = transformOrigin;
            this._ground.el.style.transform = transform;
            this._ground.fade.style.transformOrigin = transformOrigin;
            this._ground.fade.style.transform = transform;
        }

        this._sceneSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        const alt = this._sun.altitude;
        //Home-only (clock mode): just the home prism, no neighbours, no night wash — it's the dial's anchor.
        const drawn = this._homeOnly ? this._buildings.filter(b => b.isHome) : this._buildings;
        //Full-frame night/twilight wash for the current sun altitude (empty in daylight / home-only).
        const shade = this._homeOnly ? { opacity: 0, color: '' } : nightShade(alt);
        const shadeSvg = shade.opacity > 0
            ? `<rect width="${width}" height="${height}" fill="${shade.color}" opacity="${shade.opacity.toFixed(3)}"/>`
            : '';
        //LiDAR ground shadows when set (cast from nDSM clumps, with their own max length), else the building
        //footprints. Home-only (clock) mode never uses the LiDAR casters — only the home prism is drawn.
        const shadowCasters = this._homeOnly ? drawn : (this._shadowCasters ?? drawn);
        const lidarShadows  = !this._homeOnly && !!this._shadowCasters;
        const shadowMaxM    = lidarShadows ? this._shadowMaxM : undefined;
        this._sceneSvg.innerHTML =
            shadeSvg +
            renderShadows(this.camera, shadowCasters, this._sun, this._palette.shadow, this._palette.shadowOpacity, shadowMaxM, lidarShadows) +
            renderBuildings(this.camera, drawn, alt, this._palette, this._growth, this._palette.neighborOpacity, this._home);

        //LiDAR-view wireframe on its own canvas (topmost layer), so the dense nDSM mesh sits over the scene
        //geometry as one batched stroke. Off / no raster / home-only: clear the canvas once (tracked) rather
        //than every frame. Colour follows the live theme each draw — cheap, auto-follows dark/light.
        if (this._wireframeOn && this._wireframeRaster && !this._homeOnly)
        {
            const color = getComputedStyle(this._container).getPropertyValue('--primary-text-color').trim() || '#e1e1e1';
            drawWireframe(this._wireframeCtx, this.camera, this._wireframeRaster, {
                radiusCap: WIREFRAME_RADIUS_M,
                maxNodes:  WIREFRAME_MAX_NODES,
                color,
                dpr:       window.devicePixelRatio || 1,
            });
            this._wireframeDrawn = true;
        }
        else if (this._wireframeDrawn && this._wireframeCtx)
        {
            this._wireframeCtx.clearRect(0, 0, this._wireframeCanvas.width, this._wireframeCanvas.height);
            this._wireframeDrawn = false;
        }

        this.onAfterDraw?.();
    }

    public cleanup(): void
    {
        this._alive = false;
        this._resizeObserver?.disconnect();
        this._resizeObserver = undefined;
        if (this._rafToken) { cancelAnimationFrame(this._rafToken); this._rafToken = 0; }
        if (this._growthRaf) { cancelAnimationFrame(this._growthRaf); this._growthRaf = 0; }
        if (this._homeRaf) { cancelAnimationFrame(this._homeRaf); this._homeRaf = 0; }
        this._groundHolder.remove();
        this._sceneSvg.remove();
        this._wireframeCanvas.remove();
    }
}
