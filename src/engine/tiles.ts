//Basemap ground plane for the 2.5D scene renderer. Stitches CARTO raster tiles into one seam-free
//<canvas>, which the renderer tilts + turns via a CSS 3D transform (see SceneCamera.groundTransform). ONE
//style (Voyager) is fetched; the renderer tints it dark in dark mode with a CSS filter (DARK_FILTER),
//which reads better than a separate dark tile set.
//
//Attribution (CARTO, OpenStreetMap) is satisfied in the README / HACS info pane.

import { TILE_PX, GROUND_RADIUS, GROUND_ZOOM, EARTH_CIRCUMFERENCE_M, DEG } from '../constants';
//Re-exported so the scene CSS can read the ground fade start from './tiles' alongside the tile helpers.
export { GROUND_FADE_START } from '../constants';

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

//CARTO Voyager (no labels), one style for both themes; the renderer applies DARK_FILTER in dark mode.
//CORS-friendly subdomain rotation; referrerPolicy keeps the HA instance URL off the tile CDN.
function tileUrl(x: number, y: number, zoom: number): string
{
    const sub = 'abcd'[(x + y) % 4];
    return `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/${zoom}/${x}/${y}.png`;
}

//Build the ground plane: stitch the CARTO tile grid into one canvas. Resolves once every tile has loaded
//or errored so the first transform has real pixels. Helios is online-only, so there's no offline fallback.
export async function buildGround(
    lat:  number,
    lng:  number,
    zoom: number = GROUND_ZOOM
): Promise<Ground>
{
    const [tileX, tileY] = lonLatToTile(lng, lat, zoom);
    const radius = GROUND_RADIUS;
    const firstX = Math.floor(tileX) - radius;
    const firstY = Math.floor(tileY) - radius;
    const across = 2 * radius + 1;
    const size   = across * TILE_PX;
    const homeX  = (tileX - firstX) * TILE_PX;
    const homeY  = (tileY - firstY) * TILE_PX;

    const el = document.createElement('canvas');
    el.width  = size;
    el.height = size;
    el.className = 'ground';
    const ctx = el.getContext('2d');
    if (ctx)
    {
        const loads: Promise<void>[] = [];
        for (let col = 0; col < across; col++)
        {
            for (let row = 0; row < across; row++)
            {
                const x = firstX + col;
                const y = firstY + row;
                loads.push(new Promise<void>((resolve) =>
                {
                    const img = new Image();
                    img.onload = (): void =>
                    {
                        ctx.drawImage(img, col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX);
                        resolve();
                    };
                    img.onerror = (): void => resolve();
                    img.referrerPolicy = 'no-referrer';
                    img.src = tileUrl(x, y, zoom);
                }));
            }
        }
        await Promise.all(loads);
    }

    //Edge fade: same size + transform as the ground, dissolving its borders into the scene background.
    const fade = document.createElement('div');
    fade.className = 'ground-fade';
    fade.style.width  = `${size}px`;
    fade.style.height = `${size}px`;

    return { el, fade, homeX, homeY, size };
}
