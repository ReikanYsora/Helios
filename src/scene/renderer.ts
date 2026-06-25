//SceneRenderer — the card-agnostic 2.5D renderer that replaces MapLibre. It owns two sibling elements
//inside the host container: a ground holder (the tilted basemap tile canvas + edge fade, driven by a CSS
//3D transform) and a screen-space scene <svg> it repaints each frame with the occluding geometry
//(night-shade wash, cast shadows, extruded buildings). The host drives data (location, buildings, sun,
//palette) and pose (bearing/pitch), then calls redraw(); per-frame work is rAF-coalesced.
//
//What it deliberately does NOT own: the HUD (chips, leaders, sun arc, timeline). Those are card-specific
//and sit in their own SVG layer above this one — the host projects them through `camera` (and the sky.ts
//helper for the arc). Both 2026.7.1 cards share this renderer; each adds its own HUD.

import { SceneCamera } from './projection';
import { metresPerDegree } from './geo';
import { buildGround, pxPerMetreFor, type Ground } from './tiles';
import { renderBuildings, renderShadows, type Building, type ScenePalette } from './buildings';
import { renderNightShade } from './sky';

const SVG_NS = 'http://www.w3.org/2000/svg';
//Camera aim point above the home (m): lifts the home lower in the frame with headroom for the HUD arc.
const DEFAULT_TARGET_HEIGHT_M = 3;

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
    sun:           string;
    shadow:        string;
    shadowOpacity: number;
}

export class SceneRenderer
{
    public readonly camera = new SceneCamera();

    private readonly _container:    HTMLElement;
    private readonly _groundHolder: HTMLDivElement;
    private readonly _sceneSvg:     SVGSVGElement;
    private readonly _targetHeightM: number;

    private _ground?:   Ground;
    private _lat = 0;
    private _lon = 0;
    private _buildings: Building[] = [];
    private _sun = { azimuth: 0, altitude: 0 };
    private _growth = 1;
    private _palette: ScenePaletteFull = {
        home:          '#488fc2',
        neighbor:      '#cccccc',
        dark:          false,
        sun:           '#ffc107',
        shadow:        '#000000',
        shadowOpacity: 0.32,
    };

    private _redrawScheduled = false;
    private _rafToken = 0;
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

    //Resolve + build the basemap for a home position. `live` fetches CARTO tiles; otherwise a flat plane.
    public async setLocation(lat: number, lon: number, live: boolean): Promise<void>
    {
        this._lat = lat;
        this._lon = lon;
        this.camera.pxPerMetre = pxPerMetreFor(lat);
        const ground = await buildGround(lat, lon, live);
        if (!this._alive) { return; }
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

    public setPalette(p: Partial<ScenePaletteFull>): void
    {
        this._palette = { ...this._palette, ...p };
        this.scheduleRedraw();
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

    //lon/lat → screen px via the local-metre conversion + the camera. Null if no location is set.
    public projectLonLat(lon: number, lat: number): { x: number; y: number } | null
    {
        if (!this._ground) { return null; }
        const { perLon, perLat } = metresPerDegree(this._lat);
        const [x, y] = this.camera.project((lon - this._lon) * perLon, (lat - this._lat) * perLat, 0);
        return { x, y };
    }

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
        this._sceneSvg.innerHTML =
            renderNightShade(alt, width, height) +
            renderShadows(this.camera, this._buildings, this._sun, this._palette.shadow, this._palette.shadowOpacity) +
            renderBuildings(this.camera, this._buildings, alt, this._palette, this._growth);

        this.onAfterDraw?.();
    }

    public cleanup(): void
    {
        this._alive = false;
        if (this._rafToken) { cancelAnimationFrame(this._rafToken); this._rafToken = 0; }
        this._groundHolder.remove();
        this._sceneSvg.remove();
    }
}
