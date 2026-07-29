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
import { buildVectorGround, type GroundStyle } from './ground-render';
import { renderBuildings, renderShadows, type Building, type ScenePalette, type HomeAppearance } from './buildings';
import {
    SVG_NS,
    GROWTH_RISE_MS,
    HOME_SQUASH_MS,
    HOME_GROW_MS,
} from '../core/config/constants';

//Old iOS/iPadOS WebKit half-composites a flat layer over a CSS 3D-transformed one, clipping the whole scene to
//its top half. Those devices render the ground on the projected compat path instead of a 3D
//transform. It cannot be feature-detected (no API reads composited pixels), so we sniff: an Apple touch device
//(including iPadOS masquerading as macOS Safari) on Safari <= 16, the WebKit generation that carries the bug and
//the ceiling for the old hardware it runs on. A miss on a newer device keeps the (perfect) normal path; a false
//positive only swaps in the near-equivalent compat render, so erring is cheap.
function needsProjectedGround(): boolean
{
    if (typeof navigator === 'undefined') { return false; }
    const ua = navigator.userAgent || '';
    const appleTouch = /iPad|iPhone|iPod/.test(ua)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!appleTouch) { return false; }
    //Safari carries "Version/NN"; an in-app WKWebView (the Home Assistant app, the Kiosk app) usually does NOT,
    //but still carries the OS token "CPU OS 16_x". Read whichever is present, so the compat path also reaches the
    //HA apps on old hardware and not just Safari (the earlier fix only checked "Version/", so it never
    //fired inside the in-app WebViews).
    const safari = ua.match(/Version\/(\d+)/);
    const os     = ua.match(/(?:CPU|iPhone) OS (\d+)/);
    const major  = (safari ? parseInt(safari[1], 10) : 0) || (os ? parseInt(os[1], 10) : 0);
    if (major > 0) { return major <= 16; }
    //No readable version at all on an Apple touch device: a stripped in-app WebView UA. The HAkiosk app reports a
    //truncated desktop-Safari UA ("Macintosh; Intel Mac OS X 10_15_7", no Version/, no "CPU OS"), so both reads
    //above come up empty. We cannot tell the iOS version, so err toward the compat path: it is near-equivalent and
    //fixes the old devices that land here, while Safari, the HA app and iOS Chrome all expose a version and decide
    //precisely.
    return true;
}

//Honour the OS "reduce motion" setting: the rise + squash/grow animations resolve instantly when set.
const prefersReducedMotion = (): boolean =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export interface SceneRendererOptions
{
    //Shadow colour/opacity for the painted geometry, merged into the palette.
    shadow?:        string;
    shadowOpacity?: number;
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
    //Ground render path, decided once per device: false = normal CSS-3D transform, true = projected compat path
    //for the old iOS/iPadOS WebKit that would otherwise clip the scene to its top half.
    private _projectedGround = needsProjectedGround();
    //Current ground style + sun altitude, kept so an altitude step or style change can repaint from the cache.
    private _groundStyleCur?: GroundStyle;
    private _groundAltitude  = 45;
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
        if (opts.shadow)        { this._palette.shadow = opts.shadow; }
        if (opts.shadowOpacity != null) { this._palette.shadowOpacity = opts.shadowOpacity; }

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
        this._resizeObserver = new ResizeObserver((entries) =>
        {
            const cr = entries[entries.length - 1]?.contentRect;
            if (!cr) { return; }
            const w = Math.round(cr.width);
            const h = Math.round(cr.height);
            if (w === this._obsW && h === this._obsH) { return; }
            this._obsW = w;
            this._obsH = h;
            this.scheduleRedraw();
        });
        this._resizeObserver.observe(container);

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
        const built = await buildVectorGround(lat, lon, style, this._groundAltitude);
        if (!this._alive || token !== this._groundToken) { return; }
        this._groundStyleCur = style;
        this._ground         = built.ground;
        this._groundRepaint  = built.repaint;
        this._groundRepaintProjected = built.repaintProjected;
        this._projectedPose = '';
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
            if (this._alive && this._groundStyleCur) { this.setGroundStyle(this._groundStyleCur); }
        });
        this.scheduleRedraw();
    }

    //Repaint the ground with a new style (theme flip / colour config) from the cached vector features, no fetch.
    public setGroundStyle(style: GroundStyle): void
    {
        this._groundStyleCur = style;
        if (this._groundRepaint)
        {
            this._groundRepaint(style, this._groundAltitude);
            this.scheduleRedraw();
        }
    }

    //Repaint the ground for a new sun altitude (the day/night colour grade), from the cached features, no fetch.
    public setGroundAltitude(altitude: number): void
    {
        this._groundAltitude = altitude;
        if (this._groundRepaint && this._groundStyleCur)
        {
            this._groundRepaint(this._groundStyleCur, altitude);
            this.scheduleRedraw();
        }
    }

    public setBuildings(buildings: Building[]): void
    {
        this._buildings = buildings;
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
    //matching the HA energy dashboard graph animation. Instant under prefers-reduced-motion. The host
    //replays it whenever buildings (re)arrive, so it stays in step with the graphs.
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
        if (this._homeRaf) { cancelAnimationFrame(this._homeRaf); this._homeRaf = 0; }
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
            if (!this._alive) { this._homeRaf = 0; return; }
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

    //Compat path: paint the basemap in screen space, sized to the card, with no transform on the element.
    //Skipped unless the pose actually changed, so a static scene costs nothing.
    private _paintProjectedGround(w: number, h: number): void
    {
        if (!this._ground || !this._groundRepaintProjected || !this._groundStyleCur) { return; }
        const pose = `${w}x${h}|${this.camera.bearingDeg.toFixed(2)}|${this.camera.tiltDeg.toFixed(2)}|${this._groundAltitude.toFixed(1)}`;
        if (pose === this._projectedPose) { return; }
        this._projectedPose = pose;
        this._groundRepaintProjected(this.camera, w, h, this._groundStyleCur, this._groundAltitude);
        //Compat path carries no CSS transform; clear any left over from the normal path (matters when toggling).
        this._ground.el.style.transform = '';
        this._ground.el.style.transformOrigin = '';
        //The edge fade is baked into the projected canvas (in the plane), so the face-on .ground-fade disc that
        //would otherwise sit flat against the camera stays hidden on this path.
        this._ground.fade.style.display = 'none';
    }


    private _draw(): void
    {
        if (!this._alive) { return; }
        //Read the live size at draw time. The draw is rAF-coalesced, so by the time it runs the layout pass
        //has settled: clientWidth is the final size, not the transient the ResizeObserver may have captured
        //mid-relayout (which would centre the scene on ~(0,0) for a frame). Bail while the container has no
        //size yet (hidden tab, pre-layout); the observer re-fires the draw once it gains one.
        const width  = this._container.clientWidth  || 0;
        const height = this._container.clientHeight || 0;
        if (width === 0 || height === 0) { return; }

        this.camera.setViewport(width, height);

        //Tilt + turn the basemap about the home, then translate the home onto the screen-space centre.
        //On the compat path there is no transform at all: the ground is repainted already projected.
        if (this._ground)
        {
            if (this._projectedGround) { this._paintProjectedGround(width, height); }
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
        const alt = this._sun.altitude;
        const drawn = this._buildings;
        //No full-frame night/twilight wash: the day/night atmosphere comes from the graded ground palette + the
        //altitude-tinted buildings, so there is no flat translucent veil fogging the map.
        //Each pass in its own group. A <g> changes nothing about the picture, and it makes the two passes
        //addressable from a stylesheet - which is the only way to hold one of them off, since this innerHTML is
        //rebuilt on every frame and anything done to the nodes themselves is gone by the next one.
        this._sceneSvg.innerHTML =
            `<g class="scene-shadows">`
            + renderShadows(this.camera, drawn, this._sun, this._palette.shadow, this._palette.shadowOpacity)
            + `</g><g class="scene-buildings">`
            + renderBuildings(this.camera, drawn, alt, this._palette, this._growth, this._palette.neighborOpacity, this._home, this._sun.azimuth)
            + `</g>`;

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
    }
}
