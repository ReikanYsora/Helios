//Time-of-day scene tints (building altitude tint, sun-arc colour) over the shared hex primitives. Pure.

import { hexByte, mixHex } from './hex';

//Altitude-tint a building base colour to match the sky: indigo at night, purple at dusk, warm near the
//horizon, original colour in daylight.
export function buildingColor(base: string, altitude: number): string
{
    if (altitude < -6)
    {
        return mixHex(base, '#0a0e1a', 0.85);
    }
    const night = mixHex(base, '#0a0e1a', 0.85);
    const dusk  = mixHex(base, '#2a2540', 0.55);
    const warm  = mixHex(base, '#5a3220', 0.35);
    if (altitude < 0)
    {
        return mixHex(night, dusk, (altitude + 6) / 6);
    }
    if (altitude < 6)
    {
        return mixHex(dusk, warm, altitude / 6);
    }
    if (altitude < 20)
    {
        return mixHex(warm, base, (altitude - 6) / 14);
    }
    return base;
}

//Altitude-tinted building colour as an rgba() string at a given opacity.
export function tintedRgba(base: string, altitude: number, opacity: number): string
{
    const hex = buildingColor(base, altitude);
    return `rgba(${hexByte(hex, 1)},${hexByte(hex, 3)},${hexByte(hex, 5)},${opacity})`;
}

//CSS `saturate(s) brightness(b)` baked into a hex colour. The weather grade used to be a CSS `filter` on
//#map-container, but a filter on an element wrapping the CSS 3D-transformed basemap forces the whole scene to
//re-flatten every frame while rotating - heavy flicker on Android WebViews. Painting the grade into the colours
//instead keeps rotation a pure GPU transform. `saturate` uses the SVG feColorMatrix coefficients (the exact CSS
//definition); `brightness` is a per-channel multiply. Identity (1,1) returns the colour untouched.
export function gradeColor(hex: string, sat: number, bright: number): string
{
    if (sat === 1 && bright === 1)
    {
        return hex;
    }
    const r = hexByte(hex, 1);
    const g = hexByte(hex, 3);
    const b = hexByte(hex, 5);
    const rr = (0.213 + 0.787 * sat) * r + (0.715 - 0.715 * sat) * g + (0.072 - 0.072 * sat) * b;
    const gg = (0.213 - 0.213 * sat) * r + (0.715 + 0.285 * sat) * g + (0.072 - 0.072 * sat) * b;
    const bb = (0.213 - 0.213 * sat) * r + (0.715 - 0.715 * sat) * g + (0.072 + 0.928 * sat) * b;
    const cl = (v: number): string =>
        Math.max(0, Math.min(255, Math.round(v * bright))).toString(16).padStart(2, '0');
    return `#${cl(rr)}${cl(gg)}${cl(bb)}`;
}

//Sun colour along the day: grey underground, warm near the horizon, amber high up.
export const arcColor = (altitude: number, amber: string): string =>
    altitude <= 0
        ? '#3a4a63'
        : altitude < 12
            ? mixHex(amber, '#ff6a00', 0.5)
            : amber;
