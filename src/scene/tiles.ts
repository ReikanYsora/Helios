//Basemap ground plane for the 2.5D scene renderer — replaces MapLibre's raster/vector basemap. Stitches
//CARTO Voyager raster tiles into one seam-free <canvas>, which the renderer then tilts + turns via a CSS
//3D transform (see SceneCamera.groundTransform). In privacy/offline mode (or a total tile failure) it
//degrades to a flat themed plane. Ported from the Home Assistant frontend Solar scene card.
//
//Attribution (CARTO, OpenStreetMap) is satisfied in the README / HACS info pane, mirroring how the
//MapLibre attribution rail was handled.

import { lonLatToTile } from './geo';

const DEG = Math.PI / 180;
const EARTH_CIRCUMFERENCE_M = 40075016.686;
export const TILE_PX = 256;
//Tiles each side of the home: the canvas is (2*R+1)*TILE_PX, so KEEP ≤ 3 (7×7×256 = 1792px, under the
//2048px GPU texture limit of old devices). GROUND_ZOOM = CARTO tile zoom (street detail).
export const GROUND_RADIUS = 3;
export const GROUND_ZOOM   = 19;

//Screen px per real metre at the ground plane for a given latitude + tile zoom. Drives SceneCamera.pxPerMetre.
export function pxPerMetreFor(latitude: number, zoom: number = GROUND_ZOOM): number
{
    return (TILE_PX * 2 ** zoom) / (EARTH_CIRCUMFERENCE_M * Math.cos(latitude * DEG));
}

export interface Ground
{
    //The basemap element to transform: a <canvas> in live mode, a themed <div> in flat/fallback mode.
    el:    HTMLElement;
    //Edge-fade overlay, transformed identically so the disc dissolves into the card background.
    fade:  HTMLDivElement;
    //Home position in canvas px (the transform-origin the renderer pins the home to).
    homeX: number;
    homeY: number;
    //Canvas side length in px.
    size:  number;
}

//CORS-friendly CARTO subdomain rotation; referrerPolicy keeps the HA instance URL off the tile CDN.
function tileUrl(x: number, y: number, zoom: number): string
{
    const sub = 'abcd'[(x + y) % 4];
    return `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/${zoom}/${x}/${y}.png`;
}

function buildFlatGround(size: number): HTMLDivElement
{
    const flat = document.createElement('div');
    flat.className = 'ground ground-flat';
    flat.style.width  = `${size}px`;
    flat.style.height = `${size}px`;
    return flat;
}

//Build the ground plane. `live` fetches CARTO tiles; otherwise (or on total failure) returns the flat
//themed plane. Resolves once every tile has loaded or errored so the first transform has real pixels.
export async function buildGround(
    lat:  number,
    lng:  number,
    live: boolean,
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

    let el: HTMLElement | undefined;
    if (live)
    {
        const canvas = document.createElement('canvas');
        canvas.width  = size;
        canvas.height = size;
        canvas.className = 'ground';
        const ctx = canvas.getContext('2d');
        if (ctx)
        {
            let loaded = 0;
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
                            loaded += 1;
                            resolve();
                        };
                        img.onerror = (): void => resolve();
                        img.referrerPolicy = 'no-referrer';
                        img.src = tileUrl(x, y, zoom);
                    }));
                }
            }
            await Promise.all(loads);
            //Every tile failed (offline / blocked): fall back to the flat plane, not a blank canvas.
            if (loaded > 0) { el = canvas; }
        }
    }
    if (!el) { el = buildFlatGround(size); }

    //Edge fade: same size + transform as the ground, dissolving its borders into the card background.
    const fade = document.createElement('div');
    fade.className = 'ground-fade';
    fade.style.width  = `${size}px`;
    fade.style.height = `${size}px`;

    return { el, fade, homeX, homeY, size };
}
