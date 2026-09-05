//Ground-plane projection helpers for the 2.5D scene renderer: screen px per metre, and lon/lat -> Web Mercator
//tile coordinates. The basemap canvas itself is painted from OpenFreeMap vector tiles (see ground-render.ts);
//this module owns only the projection math + the Ground contract the renderer transforms.
//
//Attribution (OpenStreetMap / OpenFreeMap) is satisfied in the README / HACS info pane.

import { TILE_PX, GROUND_ZOOM, EARTH_CIRCUMFERENCE_M, DEG } from '../core/config/constants';
//Re-exported so the scene CSS can read the ground fade start from './tiles' alongside the tile helpers.
export { GROUND_FADE_START } from '../core/config/constants';

//Screen px per real metre at the ground plane for a given latitude + tile zoom. Drives SceneCamera.pxPerMetre.
export function pxPerMetreFor(latitude: number, zoom: number = GROUND_ZOOM): number
{
    return (TILE_PX * 2 ** zoom) / (EARTH_CIRCUMFERENCE_M * Math.cos(latitude * DEG));
}

//Web Mercator: lon/lat -> fractional tile coordinates at the given zoom.
export function lonLatToTile(lon: number, lat: number, zoom: number): [number, number]
{
    const world  = 2 ** zoom;
    const latRad = lat * DEG;
    const y      = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
    return [((lon + 180) / 360) * world, y * world];
}

//One level of the painted ground: a square canvas centred on the home, covering `scale` base px per canvas px.
export interface GroundLevel
{
    el:    HTMLCanvasElement;
    //Home position in canvas px (the transform-origin the renderer pins the home to): the canvas centre.
    homeX: number;
    homeY: number;
    //Canvas side length in canvas px.
    size:  number;
    //Base px per canvas px; the renderer's transform magnifies the canvas by this, innermost.
    scale: number;
}

export interface Ground
{
    //The levels of detail, coarsest first, so appended in order the finest sits on top (see GROUND_LOD_LEVELS).
    //The compat projected path builds exactly one.
    levels:  GroundLevel[];
    //Edge-fade overlay, transformed like a level at scale 1 so the disc dissolves into the scene background.
    fade:    HTMLDivElement;
    //How far the ground reaches from the home, in base px: the fade disc's half side.
    reachPx: number;
}
