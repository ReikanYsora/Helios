//Time-of-day scene tints (night shade, building altitude tint, sun-arc colour) over the shared hex
//primitives. Pure.

import { lerp, hexByte, mixHex } from './hex';

//Full-frame night/twilight wash by sun altitude (deg): astronomical night -> deep navy, twilight -> blue,
//dawn/dusk -> warm amber, daylight -> transparent.
export function nightShade(altitude: number): { color: string; opacity: number }
{
    if (altitude < -12) { return { color: '#02040c', opacity: 0.68 }; }
    if (altitude < -6)  { return { color: '#040824', opacity: lerp(0.5, 0.68, (-altitude - 6) / 6) }; }
    if (altitude < 0)   { return { color: '#0a1240', opacity: lerp(0.5, 0.3, (altitude + 6) / 6) }; }
    if (altitude < 6)   { return { color: '#3a1408', opacity: lerp(0.3, 0.1, altitude / 6) }; }
    if (altitude < 20)  { return { color: '#3a1408', opacity: lerp(0.1, 0, (altitude - 6) / 14) }; }
    return { color: '#000000', opacity: 0 };
}

//Altitude-tint a building base colour to match the sky: indigo at night, purple at dusk, warm near the
//horizon, original colour in daylight.
export function buildingColor(base: string, altitude: number): string
{
    if (altitude < -6) { return mixHex(base, '#0a0e1a', 0.85); }
    const night = mixHex(base, '#0a0e1a', 0.85);
    const dusk  = mixHex(base, '#2a2540', 0.55);
    const warm  = mixHex(base, '#5a3220', 0.35);
    if (altitude < 0)  { return mixHex(night, dusk, (altitude + 6) / 6); }
    if (altitude < 6)  { return mixHex(dusk, warm, altitude / 6); }
    if (altitude < 20) { return mixHex(warm, base, (altitude - 6) / 14); }
    return base;
}

//Altitude-tinted building colour as an rgba() string at a given opacity.
export function tintedRgba(base: string, altitude: number, opacity: number): string
{
    const hex = buildingColor(base, altitude);
    return `rgba(${hexByte(hex, 1)},${hexByte(hex, 3)},${hexByte(hex, 5)},${opacity})`;
}

//Sun colour along the day: grey underground, warm near the horizon, amber high up.
export const arcColor = (altitude: number, amber: string): string =>
    altitude <= 0
        ? '#3a4a63'
        : altitude < 12
            ? mixHex(amber, '#ff6a00', 0.5)
            : amber;
