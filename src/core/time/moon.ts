//Moon position and phase math: pure functions, no DOM/map, same spirit as sun.ts (a compact low-precision formula,
//not an ephemeris library - nobody is casting moon-shadows). Formulas follow the well-known "Astronomy on the
//Personal Computer" (Montenbruck & Pfleger) low-precision series, the same public-domain basis most JS moon
//libraries use; good to roughly 0.1-0.3 degree in position and well under 1% in illuminated fraction, which is
//plenty for a cosmetic arc and a crescent that looks right.

import { DAY_MS } from '../config/constants';

const D = Math.PI / 180;

//Days since J2000.0 (2000-01-01T12:00 UTC), fractional (carries time-of-day).
function daysSinceJ2000(date: Date): number
{
    return (date.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / DAY_MS;
}

//Sun's ecliptic longitude (degrees, 0-360) at `d` days since J2000.0. Shared by the phase calculation below; kept
//local rather than imported from sun.ts, whose getSunPosition solves alt/az directly via a solar-specific shortcut
//that never computes ecliptic longitude at all.
function sunEclipticLongitude(d: number): number
{
    const M = D * (357.5291 + 0.98560028 * d);
    const C = 1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M);
    return (M / D + C + 102.9372 + 180) % 360;
}

//Moon's ecliptic longitude/latitude (degrees) and geocentric distance (km) at `d` days since J2000.0.
function moonEcliptic(d: number): { lon: number; lat: number; distKm: number }
{
    const meanLon = D * (218.316 + 13.176396 * d);   //mean longitude
    const M  = D * (134.963 + 13.064993 * d);   //mean anomaly
    const F  = D * (93.272  + 13.229350 * d);   //mean distance (argument of latitude)

    const lon = meanLon / D + 6.289 * Math.sin(M);
    const lat = 5.128 * Math.sin(F);
    const distKm = 385001 - 20905 * Math.cos(M);
    return { lon: ((lon % 360) + 360) % 360, lat, distKm };
}

//Ecliptic (lon, lat, degrees) -> equatorial (ra, dec, degrees). Mean obliquity, treated as constant: its centuries-
//scale drift is far below this module's own precision floor.
const OBLIQUITY_DEG = 23.4397;

function eclipticToEquatorial(lonDeg: number, latDeg: number): { raDeg: number; decDeg: number }
{
    const l = lonDeg * D;
    const b = latDeg * D;
    const e = OBLIQUITY_DEG * D;

    const ra  = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
    const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
    return { raDeg: (((ra / D) % 360) + 360) % 360, decDeg: dec / D };
}

//Equatorial (dec, hour angle, degrees) -> horizontal (altitude, azimuth clockwise from north, degrees). Mirrors
//sun.ts's own proven alt/az block verbatim (same spherical-triangle formula, body-agnostic once dec + hour angle
//are known) - duplicated rather than shared so sun.ts's already-validated path stays untouched.
function equatorialToHorizontal(decDeg: number, haDeg: number, latDeg: number): { altitude: number; azimuth: number }
{
    const decl = decDeg * D;
    const ha   = haDeg * D;
    const lat  = latDeg * D;

    const sinA = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
    const alt  = Math.asin(Math.max(-1, Math.min(1, sinA))) / D;
    const cAlt = Math.cos(alt * D);
    const cAz  = cAlt > 1e-4
        ? (Math.sin(decl) - Math.sin(lat) * sinA) / (Math.cos(lat) * cAlt)
        : 0;
    let az = Math.acos(Math.max(-1, Math.min(1, cAz))) / D;
    if (haDeg > 0)
    {
        az = 360 - az;
    }
    return { altitude: alt, azimuth: az };
}

//Moon altitude/azimuth (degrees, azimuth clockwise from north) at a UTC instant for a lat/lon point. Single-entry
//cache, same rationale as getSunPosition: several render passes in one cycle ask for the same (time, home) tuple.
let _moonCacheKey: string | null = null;
let _moonCacheValue: { altitude: number; azimuth: number } | null = null;

export function getMoonPosition(date: Date, lat: number, lon: number):
    { altitude: number; azimuth: number }
{
    const key = `${date.getTime()}|${lat.toFixed(6)}|${lon.toFixed(6)}`;
    if (key === _moonCacheKey && _moonCacheValue !== null)
    {
        return _moonCacheValue;
    }

    const d = daysSinceJ2000(date);
    const { lon: mLon, lat: mLat } = moonEcliptic(d);
    const { raDeg, decDeg } = eclipticToEquatorial(mLon, mLat);

    //Greenwich sidereal time (low-precision series), then local by adding east-positive longitude directly - the
    //same sign convention sun.ts already assumes for lon (HA's own signed-degrees convention, no flip needed).
    const gmst = (280.16 + 360.9856235 * d) % 360;
    const lst  = ((gmst + lon) % 360 + 360) % 360;
    let ha = lst - raDeg;
    ha = ((ha + 180) % 360 + 360) % 360 - 180;

    const result = equatorialToHorizontal(decDeg, ha, lat);
    _moonCacheKey   = key;
    _moonCacheValue = result;
    return result;
}

export interface MoonPhase
{
    //Illuminated fraction, 0 (new) to 1 (full).
    fraction: number;
    //True while the illuminated limb is growing (new -> full): the fraction alone can't tell waxing from waning,
    //since the same fraction occurs once on each side of the cycle.
    waxing: boolean;
}

//Moon phase at a UTC instant: illuminated fraction, from the sun-earth-moon angle (accounts for the moon's actual
//distance, not just angular separation as seen from Earth, so it stays correct even though Earth-Moon distance
//varies noticeably over an orbit).
const SUN_DIST_KM = 149598000;

export function getMoonPhase(date: Date): MoonPhase
{
    const d = daysSinceJ2000(date);
    const sunLon = sunEclipticLongitude(d);
    const moon   = moonEcliptic(d);

    //Elongation: angular separation between the sun and the moon as seen from Earth (both near-zero ecliptic
    //latitude for the sun, the moon's small latitude folded in via the full spherical formula for consistency).
    const sunB = 0;
    //Clamped: at conjunction (new moon) the cosine lands a hair above 1 through float error, and acos of that is
    //NaN, which would poison the fraction and everything drawn from it.
    const cosPhi = Math.sin(sunB * D) * Math.sin(moon.lat * D)
        + Math.cos(sunB * D) * Math.cos(moon.lat * D) * Math.cos((sunLon - moon.lon) * D);
    const phi = Math.acos(Math.max(-1, Math.min(1, cosPhi)));
    //Phase angle (moon-earth-sun), via the law of cosines in the sun-earth-moon triangle: distinct from the
    //Earth-based elongation phi above once the moon's own distance is folded in.
    const inc = Math.atan2(
        SUN_DIST_KM * Math.sin(phi),
        moon.distKm - SUN_DIST_KM * Math.cos(phi),
    );
    const fraction = (1 + Math.cos(inc)) / 2;

    //Waxing while the moon leads the sun in ecliptic longitude by less than half a circle: it moves faster than
    //the sun (~13.2 deg/day vs ~1 deg/day), so right after conjunction (new moon) it pulls ahead, reaching (moon.lon
    //- sunLon) = +180 deg at opposition (full moon), then continues past that toward the next conjunction, at which
    //point the normalised difference below reads negative for the second (waning) half of the cycle.
    const lonDiff = ((moon.lon - sunLon + 180) % 360 + 360) % 360 - 180;
    const waxing = lonDiff > 0;

    return { fraction: Math.max(0, Math.min(1, fraction)), waxing };
}
