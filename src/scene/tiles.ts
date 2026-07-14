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

export interface Ground
{
    //The basemap tile canvas to transform.
    el:    HTMLCanvasElement;
    //Edge-fade overlay, transformed identically so the disc dissolves into the scene background.
    fade:  HTMLDivElement;
    //Home position in canvas px (the transform-origin the renderer pins the home to).
    homeX: number;
    homeY: number;
    //Canvas side length in px.
    size:  number;
}
