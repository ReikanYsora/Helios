//Basemap ground plane for the 2.5D scene renderer. Stitches CARTO Voyager raster tiles into one
//seam-free <canvas>, which the renderer then tilts + turns via a CSS 3D transform (see
//SceneCamera.groundTransform). In privacy/offline mode (or a total tile failure) it degrades to a flat
//themed plane.
//
//Attribution (CARTO, OpenStreetMap) is satisfied in the README / HACS info pane.

import { TILE_PX, GROUND_RADIUS, GROUND_ZOOM, EARTH_CIRCUMFERENCE_M, METRES_PER_DEG_LAT, DEG } from './constants';
//Re-exported so existing importers (e.g. the card CSS imports GROUND_FADE_START from './tiles') keep resolving.
export { TILE_PX, GROUND_RADIUS, GROUND_ZOOM, GROUND_FADE_START } from './constants';

//Screen px per real metre at the ground plane for a given latitude + tile zoom. Drives SceneCamera.pxPerMetre.
export function pxPerMetreFor(latitude: number, zoom: number = GROUND_ZOOM): number
{
    return (TILE_PX * 2 ** zoom) / (EARTH_CIRCUMFERENCE_M * Math.cos(latitude * DEG));
}

//Web Mercator: lon/lat → fractional tile coordinates at the given zoom.
export function lonLatToTile(lon: number, lat: number, zoom: number): [number, number]
{
    const world  = 2 ** zoom;
    const latRad = lat * DEG;
    const y      = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
    return [((lon + 180) / 360) * world, y * world];
}

//Metres-per-degree scale at a given home latitude: [perLon, perLat]. A point (lat, lng) becomes local
//metres via east = (lng - homeLng) * perLon, north = (lat - homeLat) * perLat.
export function metresPerDegree(homeLat: number): { perLon: number; perLat: number }
{
    return {
        perLon: METRES_PER_DEG_LAT * Math.cos(homeLat * DEG),
        perLat: METRES_PER_DEG_LAT,
    };
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
