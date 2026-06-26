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
import { renderBuildings, renderShadows, type Building, type ScenePalette, type HomeAppearance } from './buildings';
import { nightShade } from './colors';
import {
    SVG_NS,
    DEFAULT_TARGET_HEIGHT_M,
    GROWTH_RISE_MS,
    HOME_SQUASH_MS,
    HOME_GROW_MS,
} from '../constants';

//Honour the OS "reduce motion" setting: the rise + squash/grow animations resolve instantly when set.
const prefersReducedMotion = (): boolean =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export interface SceneRendererOptions
{
    //Sun colour + shadow colour/opacity for the painted geometry; merged into the palette.
    sun?:           string;
    shadow?:        string;
    shadowOpacity?: number;
    targetHeightM?: number;
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
    private readonly _sceneSvg:     SVGSVGElement;
    private readonly _targetHeightM: number;

    private _ground?:     Ground;
    private _groundLat?:  number;
    private _groundLon?:  number;
    //Increments per build so a slower in-flight tile fetch can't overwrite a newer one (the boot build and
    //a theme-flip rebuild race otherwise, and whichever resolves last would win).
    private _groundToken = 0;
    private _buildings: Building[] = [];
    private _sun = { azimuth: 0, altitude: 0 };
    private _growth = 1;
    //Home prism appearance (the active chip's colour, optional stacked PV-string bands, and the squash
    //multiplier for the on-retarget animation). Empty colour falls back to palette.home (solid block).
    private _home: HomeAppearance = { growth: 1 };
    private _homeRaf = 0;
    private _palette: ScenePaletteFull = {
        home:            '#488fc2',
        neighbor:        '#cccccc',
        dark:            false,
        sun:             '#ffc107',
        shadow:          '#000000',
        shadowOpacity:   0.32,
        neighborOpacity: 0.25,
    };

    private _redrawScheduled = false;
    private _rafToken = 0;
    private _growthRaf = 0;
    private _alive = true;
    //Fired after each redraw so the host can re-project its HUD on the same frame.
    public onAfterDraw?: () => void;

    public constructor(container: HTMLElement, opts: SceneRendererOptions = {})
    {
        this._container = container;
        this._targetHeightM = opts.targetHeightM ?? DEFAULT_TARGET_HEIGHT_M;
        if (opts.sun)           { this._palette.sun = opts.sun; }
        if (opts.shadow)        { this._palette.shadow = opts.shadow; }
        if (opts.shadowOpacity != null) { this._palette.shadowOpacity = opts.shadowOpacity; }

        this._groundHolder = document.createElement('div');
        this._groundHolder.className = 'scene-ground-holder';
        this._sceneSvg = document.createElementNS(SVG_NS, 'svg');
        this._sceneSvg.setAttribute('class', 'scene-svg');
        container.appendChild(this._groundHolder);
        container.appendChild(this._sceneSvg);
    }

    //Resolve + build the CARTO basemap for a home position. The position is retained so a theme flip can
    //re-tile with the matching light/dark style.
    public async setLocation(lat: number, lon: number): Promise<void>
    {
        this._groundLat = lat;
        this._groundLon = lon;
        this.camera.pxPerMetre = pxPerMetreFor(lat);
        const token  = ++this._groundToken;
        const ground = await buildGround(lat, lon, this._palette.dark);
        if (!this._alive || token !== this._groundToken) { return; }
        this._ground = ground;
        this._groundHolder.replaceChildren(ground.el, ground.fade);
        this.scheduleRedraw();
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
        const darkFlipped = p.dark !== undefined && p.dark !== this._palette.dark;
        this._palette = { ...this._palette, ...p };
        //A theme flip swaps the CARTO basemap style, so re-tile the ground at the retained position.
        if (darkFlipped && this._groundLat !== undefined && this._groundLon !== undefined)
        {
            void this.setLocation(this._groundLat, this._groundLon);
        }
        this.scheduleRedraw();
    }

    //Set the home prism's colour + optional PV-string histogram bands instantly (a same-chip recolour or
    //scrub). Keeps the current squash multiplier so it doesn't interrupt an in-flight animation.
    public setHome(color: string, bands: { frac: number; color: string }[] = []): void
    {
        this._home = { color, bands, growth: this._home.growth ?? 1 };
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
        const width  = this._container.clientWidth  || 0;
        const height = this._container.clientHeight || 0;
        if (width === 0 || height === 0) { return; }

        this.camera.setViewport(width, height, this._targetHeightM);

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
        //Full-frame night/twilight wash for the current sun altitude (empty in daylight).
        const shade = nightShade(alt);
        const shadeSvg = shade.opacity > 0
            ? `<rect width="${width}" height="${height}" fill="${shade.color}" opacity="${shade.opacity.toFixed(3)}"/>`
            : '';
        this._sceneSvg.innerHTML =
            shadeSvg +
            renderShadows(this.camera, this._buildings, this._sun, this._palette.shadow, this._palette.shadowOpacity) +
            renderBuildings(this.camera, this._buildings, alt, this._palette, this._growth, this._palette.neighborOpacity, this._home);

        this.onAfterDraw?.();
    }

    public cleanup(): void
    {
        this._alive = false;
        if (this._rafToken) { cancelAnimationFrame(this._rafToken); this._rafToken = 0; }
        if (this._growthRaf) { cancelAnimationFrame(this._growthRaf); this._growthRaf = 0; }
        if (this._homeRaf) { cancelAnimationFrame(this._homeRaf); this._homeRaf = 0; }
        this._groundHolder.remove();
        this._sceneSvg.remove();
    }
}
