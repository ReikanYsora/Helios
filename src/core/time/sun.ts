//Solar position and irradiance math: pure functions, no DOM/map. Validated against NOAA SPA over a year x 8 latitudes
//(mean alt error 0.30°, az 0.36°, max alt ~1°), well under the fidelity needed for shadow direction and the W/m² estimate.

import { DAY_MS } from '../config/constants';

//Sun altitude/azimuth (degrees, azimuth clockwise from north) at a UTC instant for a lat/lon point.
//Single-entry cache: many render passes in one cycle (atmosphere, shadows, PV legend) ask for the same (time, home)
//tuple in succession. Key includes 6-decimal lat/lon so two distinct homes don't poison each other.
let _sunCacheKey: string | null = null;
let _sunCacheValue: { altitude: number; azimuth: number } | null = null;

export function getSunPosition(date: Date, lat: number, lon: number):
    { altitude: number; azimuth: number }
{
    const key = `${date.getTime()}|${lat.toFixed(6)}|${lon.toFixed(6)}`;
    if (key === _sunCacheKey && _sunCacheValue !== null)
    {
        return _sunCacheValue;
    }

    const D    = Math.PI / 180;
    const H    = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const doy  = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / DAY_MS);
    const decl = 23.45 * Math.sin(D * (360 / 365) * (doy - 81));
    const B    = D * (360 / 365) * (doy - 81);
    const eot  = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

    //Normalise hour angle to [-180°, 180°] so sign(ha) reliably gives AM/PM; without it, longitudes far from Greenwich
    //(NYC, Tokyo, Sydney) push ha out of range and flip the azimuth by up to 180°.
    let ha = 15 * (H + lon / 15 + eot / 60 - 12);
    ha = ((ha + 180) % 360 + 360) % 360 - 180;

    const sinA = Math.sin(D * lat) * Math.sin(D * decl)
               + Math.cos(D * lat) * Math.cos(D * decl) * Math.cos(D * ha);
    const alt  = Math.asin(Math.max(-1, Math.min(1, sinA))) / D;
    const cAlt = Math.cos(alt * D);
    const cAz  = cAlt > 1e-4
        ? (Math.sin(D * decl) - Math.sin(D * lat) * sinA) / (Math.cos(D * lat) * cAlt)
        : 0;
    let az = Math.acos(Math.max(-1, Math.min(1, cAz))) / D;
    if (ha > 0)
    {
        az = 360 - az;
    }
    const result = { altitude: alt, azimuth: az };
    _sunCacheKey   = key;
    _sunCacheValue = result;
    return result;
}


//Ground-horizontal irradiance as a percentage of STC (1000 W/m2), clamped [0, 100]; 0 below the horizon.
//This is the simple analytical indicator (Haurwitz GHI x Kasten-Czeplak cloud, via computeIrradianceWm2) that
//drives the scene arc and the timeline irradiance fallback - NOT the integration's tilted per-panel PV model
//(compute_pv_power there); the name is deliberately distinct to avoid conflating the two.
export function computePvPercent(
    date:          Date,
    lat:           number,
    lon:           number,
    cloudCoverPct: number,
): number
{
    return Math.min(100, computeIrradianceWm2(date, lat, lon, cloudCoverPct) / 10);
}


//Same physics as computePvPercent but returns effective ground-horizontal irradiance in W/m² instead of the clamped 0-100%
//figure. Drives the solar-arc W/m² label and line-flow speed; returns 0 below the horizon as a "night" sentinel.
export function computeIrradianceWm2(date: Date, lat: number, lon: number, cloudCoverPct: number): number
{
    const sun = getSunPosition(date, lat, lon);
    const alt = sun.altitude;
    if (alt <= 0)
    {
        return 0;
    }

    const D    = Math.PI / 180;
    const cosZ = Math.sin(alt * D);
    const ghiClear = 1098 * cosZ * Math.exp(-0.059 / cosZ);

    const cc     = Math.max(0, Math.min(100, cloudCoverPct)) / 100;
    const kCloud = 1 - 0.75 * cc**3.4;

    return Math.max(0, ghiClear * kCloud);
}
