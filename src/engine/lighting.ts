// Day-night colour and lighting math: pure functions of sun altitude (and a base
// building colour). The engine drives timing and applies these values to MapLibre paint
// and the directional light; this module owns only the formulas, keeping the phase
// transitions (astronomical night, civil twilight, sunrise/sunset wash, low sun, daylight)
// co-located.


function lerp(a: number, b: number, t: number): number
{
    return a + (b - a) * t;
}

// Lerp between two #rrggbb hex strings.
function lerpHex(a: string, b: string, t: number): string
{
    const pa = parseInt(a.replace('#', ''), 16);
    const pb = parseInt(b.replace('#', ''), 16);
    const ar = (pa >> 16) & 0xff, ag = (pa >> 8) & 0xff, ab = pa & 0xff;
    const br = (pb >> 16) & 0xff, bg = (pb >> 8) & 0xff, bb = pb & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const b2 = Math.round(ab + (bb - ab) * t);
    return '#' + r.toString(16).padStart(2, '0')
               + g.toString(16).padStart(2, '0')
               + b2.toString(16).padStart(2, '0');
}


// Night-shade overlay for a sun altitude. Opacity ramps 0 (daylight) to ~0.68 (deep night),
// with a warm tinted pass through sunrise/sunset so the satellite stays readable but
// visibly amber-shifted near the horizon.
export function nightShadeForAltitude(
    altitudeDeg: number
): { color: string; opacity: number }
{
    if (altitudeDeg < -12)
    {
        // Astronomical night
        return { color: '#02040c', opacity: 0.68 };
    }
    if (altitudeDeg < -6)
    {
        // Nautical twilight → astronomical
        const u = (-altitudeDeg - 6) / 6;
        return { color: '#040824', opacity: lerp(0.50, 0.68, u) };
    }
    if (altitudeDeg < 0)
    {
        // Civil twilight, deep blue
        const u = (altitudeDeg + 6) / 6;
        return { color: '#0a1240', opacity: lerp(0.50, 0.30, u) };
    }
    if (altitudeDeg < 6)
    {
        // Sunrise/sunset warm amber wash; light opacity keeps imagery readable while the
        // time-of-day cue stays unambiguous.
        const u = altitudeDeg / 6;
        return { color: '#3a1408', opacity: lerp(0.30, 0.10, u) };
    }
    if (altitudeDeg < 20)
    {
        // Low sun, fading wash
        const u = (altitudeDeg - 6) / 14;
        return { color: '#3a1408', opacity: lerp(0.10, 0.0, u) };
    }
    // Full daylight, overlay invisible
    return { color: '#000000', opacity: 0 };
}


// Building extrusion colour modulated by sun altitude: blends the configured daylight
// reference towards cool dark ink at night and a warm tint around sunrise/sunset, so
// buildings reflect the time-of-day mood without losing the user's chosen base hue.
export function buildingColorForAltitude(
    baseHex:     string,
    altitudeDeg: number
): string
{
    if (altitudeDeg < -6)
    {
        // Deep night, buildings as dark indigo silhouettes
        return lerpHex(baseHex, '#0a0e1a', 0.85);
    }
    if (altitudeDeg < 0)
    {
        // Civil twilight, fade in/out of night
        const u    = (altitudeDeg + 6) / 6;
        const dark = lerpHex(baseHex, '#0a0e1a', 0.85);
        const dusk = lerpHex(baseHex, '#2a2540', 0.55);
        return lerpHex(dark, dusk, u);
    }
    if (altitudeDeg < 6)
    {
        // Sunrise/sunset, warm wash
        const u    = altitudeDeg / 6;
        const dusk = lerpHex(baseHex, '#2a2540', 0.55);
        const warm = lerpHex(baseHex, '#5a3220', 0.35);
        return lerpHex(dusk, warm, u);
    }
    if (altitudeDeg < 20)
    {
        // Low sun, fade warm tint back to base
        const u    = (altitudeDeg - 6) / 14;
        const warm = lerpHex(baseHex, '#5a3220', 0.35);
        return lerpHex(warm, baseHex, u);
    }
    // Full daylight, exact user-defined colour
    return baseHex;
}


// Polar angle (0..89 deg) for MapLibre's directional light from a sun altitude. MapLibre
// uses 0 = directly above, 90 = horizon, 180 = below. Clamp at 89 below the horizon so
// face shading on buildings still visible at twilight never inverts (a below-horizon polar
// would light faces from underneath, which looks wrong).
export function sunLightPolarFromAltitude(altitudeDeg: number): number
{
    return altitudeDeg > 0
        ? Math.max(0, Math.min(89, 90 - altitudeDeg))
        : 89;
}
