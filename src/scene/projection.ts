//Faux-3D ("2.5D") camera + projection for the scene renderer. A tilted ground plane (CSS rotateX/rotateZ
//on the basemap tile canvas) with every overlay (buildings, shadows, sun arc, chips) projected on top by a
//bearing -> pitch -> perspective transform, so the SVG content stays glued to the rotating basemap.
//
//All coordinates are LOCAL METRES relative to the home origin: +east, +north, +up. The lat/lng to
//local-metre conversion (and tile math) lives in ./tiles. Pure and card-agnostic.

import { CAMERA_PITCH_MIN_DEG, CAMERA_PITCH_MAX_DEG, DEFAULT_BEARING, DEFAULT_TILT, NEAR_PLANE, PERSPECTIVE, DEG } from '../core/config/constants';
//Re-exported so buildings.ts reads the projection constants it shares from './projection'.
export { NEAR_PLANE, PERSPECTIVE } from '../core/config/constants';

export interface ProjectedPoint
{
    x:     number;
    y:     number;
    //Camera-space Z. Larger = nearer the camera; used for depth-sorting (painter's algorithm) and culling.
    depth: number;
}

export interface GroundTransform
{
    transform:       string;
    transformOrigin: string;
}

//Stateful per-frame camera. The host sets the pose + scale, calls setViewport() once per frame to bake
//the trig basis + screen-space home anchor, then projects any number of points cheaply.
export class SceneCamera
{
    //Pose, in degrees.
    public bearingDeg = DEFAULT_BEARING;
    public tiltDeg    = DEFAULT_TILT;
    //Scale: screen px per real metre at the ground plane (set from the tile zoom + latitude by the host).
    public pxPerMetre = 1;
    //Scene magnification folded into pxPerMetre by the host (`scene-zoom`). Kept here as well because the basemap
    //canvas is painted at the base scale and only CSS-transformed: groundTransform scales it by this so the raster
    //keeps matching the buildings/shadows projected through pxPerMetre.
    public zoom = 1;
    //Screen-space anchor of the home (local origin), recomputed by setViewport each frame.
    public centreX = 0;
    public centreY = 0;
    //Card size in px, from the last setViewport. The scene SVG's viewBox is `0 0 width height`, so these
    //also bound the clip rectangle the painters trim their geometry to.
    public width  = 0;
    public height = 0;
    //False until the first setViewport with a real size. Consumers gate on it so nothing projects against
    //the seed centre (0,0), which would briefly throw the whole HUD into the top-left corner.
    public hasViewport = false;

    //Cached trig basis, recomputed by setViewport. Seeded to the default pose so a project() before the
    //first setViewport() still returns a sane value rather than NaN.
    private _cosB = Math.cos(DEFAULT_BEARING * DEG);
    private _sinB = Math.sin(DEFAULT_BEARING * DEG);
    private _cosT = Math.cos(DEFAULT_TILT * DEG);
    private _sinT = Math.sin(DEFAULT_TILT * DEG);

    //Set the camera pose. Tilt is clamped to [CAMERA_PITCH_MIN_DEG, CAMERA_PITCH_MAX_DEG]; bearing is free (0..360 by convention).
    public setPose(bearingDeg: number, tiltDeg: number): void
    {
        this.bearingDeg = bearingDeg;
        this.tiltDeg    = Math.min(CAMERA_PITCH_MAX_DEG, Math.max(CAMERA_PITCH_MIN_DEG, tiltDeg));
    }

    //Recompute the centre + trig basis for one frame. The camera aims at the home origin, so the home
    //anchors at the exact centre of the viewport.
    public setViewport(width: number, height: number): void
    {
        const tilt    = this.tiltDeg * DEG;
        const bearing = this.bearingDeg * DEG;
        this.centreX = width / 2;
        this.centreY = height / 2;
        this.width  = width;
        this.height = height;
        this.hasViewport = true;
        this._cosB = Math.cos(bearing);
        this._sinB = Math.sin(bearing);
        this._cosT = Math.cos(tilt);
        this._sinT = Math.sin(tilt);
    }

    //Project a local-metric point (east, north, up) to screen px. `depth` is the camera-space Z.
    public project3(eastM: number, northM: number, upM: number): ProjectedPoint
    {
        const x = eastM  * this.pxPerMetre;
        const y = -northM * this.pxPerMetre;
        const z = upM    * this.pxPerMetre;
        const rx = x * this._cosB - y * this._sinB;
        const ry = x * this._sinB + y * this._cosB;
        const cameraZ = ry * this._sinT + z * this._cosT;
        //Clamp the denominator to avoid the near-plane singularity (a point at/behind the camera would
        //otherwise project to infinity or flip across the centre). `depth` keeps the true cameraZ.
        const p = PERSPECTIVE / Math.max(PERSPECTIVE - cameraZ, PERSPECTIVE * NEAR_PLANE);
        return {
            x: this.centreX + rx * p,
            y: this.centreY + (ry * this._cosT - z * this._sinT) * p,
            depth: cameraZ,
        };
    }

    //Project to a bare [x, y] tuple (the common case for SVG point lists).
    public project(eastM: number, northM: number, upM: number): [number, number]
    {
        const p = this.project3(eastM, northM, upM);
        return [p.x, p.y];
    }

    //CSS transform for the basemap tile canvas, given the home's pixel position within that canvas. Turned
    //(rotateZ = bearing) then tilted (rotateX = pitch) about the home, projected by a self-contained
    //perspective() FUNCTION, then translated so the home lands on the screen-space centre.
    //
    //The perspective is a transform FUNCTION here, not a CSS `perspective` PROPERTY on the container: the property
    //would project the ground on a different footing than project3 (the SVG overlays' pinhole) and drift the
    //buildings/shadows off the basemap under tilt. Read right-to-left (rotateZ, rotateX, perspective, translate)
    //the function reproduces project3 exactly for a ground point: rx*p and ry*cosT*p about the home,
    //p = P/(P - ry*sinT). No element then carries a `perspective` property, so the flat scene SVG never joins a
    //3D layer.
    public groundTransform(homeX: number, homeY: number): GroundTransform
    {
        const origin = `${homeX}px ${homeY}px`;
        return {
            transformOrigin: origin,
            transform:
                `translate(${(this.centreX - homeX).toFixed(2)}px, ${(this.centreY - homeY).toFixed(2)}px) ` +
                `perspective(${PERSPECTIVE}px) ` +
                `rotateX(${this.tiltDeg}deg) rotateZ(${this.bearingDeg}deg)` +
                //Innermost (applied first, about the home origin): canvas px -> zoomed px, exactly what pxPerMetre
                //does for the projected layers. Omitted at 1 so the default pose carries no redundant scale().
                (this.zoom !== 1 ? ` scale(${this.zoom})` : ''),
        };
    }
}
