//Time-of-day scene tints (night shade, building altitude tint, sun-arc colour) over the shared hex
//primitives. Pure.

import { lerp, hexByte, mixHex } from './hex';

//Full-frame night/twilight wash by sun altitude (deg): astronomical night -> deep navy, twilight -> blue,
//dawn/dusk -> warm amber, daylight -> transparent. Interpolated through keyframes (the same palette as before)
//so BOTH colour and opacity ease continuously across the day<->night change, with no stepped colour jumps.
const NIGHT_STOPS: { alt: number; color: string; op: number }[] = [
    { alt: -12, color: '#02040c', op: 0.68 }, //deep night
    { alt: -6,  color: '#050a2c', op: 0.50 }, //astronomical -> nautical
    { alt:  0,  color: '#0a1240', op: 0.30 }, //civil twilight, sun on the horizon
    { alt:  4,  color: '#3a1408', op: 0.16 }, //warm ember eases in just above the horizon
    { alt: 12,  color: '#3a1408', op: 0.05 },
    { alt: 22,  color: '#3a1408', op: 0.0  }, //full daylight, transparent
];

export function nightShade(altitude: number): { color: string; opacity: number }
{
    const stops = NIGHT_STOPS;
    if (altitude <= stops[0].alt) { return { color: stops[0].color, opacity: stops[0].op }; }
    for (let i = 0; i < stops.length - 1; i++)
    {
        const a = stops[i];
        const b = stops[i + 1];
        if (altitude < b.alt)
        {
            const f = (altitude - a.alt) / (b.alt - a.alt);
            return { color: mixHex(a.color, b.color, f), opacity: lerp(a.op, b.op, f) };
        }
    }
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
