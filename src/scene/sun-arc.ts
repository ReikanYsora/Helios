//Pure sun-arc geometry: the celestial-hemisphere point for an instant and the daylight opacity ramp. No
//DOM, map, renderer, or engine state; the engine projects the returned lon/lat/altitude through its camera
//and owns the per-frame caches.

import { getSunPosition } from '../core/time/sun';
import { SUN_ARC_RADIUS_M, METRES_PER_DEGREE, DEG } from '../core/config/constants';

//date -> 3D point on the celestial hemisphere (radius SUN_ARC_RADIUS_M x scale, centred on home) as
//(lon, lat, altitude_m) for the scene projection. Azimuth clockwise from North; ENU offsets
//east=R·cosα·sinφ, north=R·cosα·cosφ, up=R·sinα, converted to lon/lat via local metres-per-degree.
export function sunSpherePoint(
    date: Date, homeLat: number, homeLon: number, scale: number
): { lon: number; lat: number; altitudeM: number; altitudeDeg: number; azimuthDeg: number }
{
    const sun = getSunPosition(date, homeLat, homeLon);
    return {
        ...spherePoint(homeLat, homeLon, scale, sun.azimuth, sun.altitude),
        altitudeDeg: sun.altitude,
        azimuthDeg:  sun.azimuth
    };
}

//A point on the same celestial hemisphere as the sun arc, for an arbitrary azimuth/altitude in degrees. The
//terrain-horizon ridge is drawn from these so it shares the arc's projection and the sun meets it exactly.
export function horizonSpherePoint(
    homeLat: number, homeLon: number, scale: number, azimuthDeg: number, altitudeDeg: number
): { lon: number; lat: number; altitudeM: number }
{
    return spherePoint(homeLat, homeLon, scale, azimuthDeg, altitudeDeg);
}

//ENU point on the celestial hemisphere (radius SUN_ARC_RADIUS_M x scale, centred on home) for an azimuth
//(clockwise from North) and altitude, as (lon, lat, altitude_m): east=R.cosa.sinz, north=R.cosa.cosz, up=R.sina.
function spherePoint(
    homeLat: number, homeLon: number, scale: number, azimuthDeg: number, altitudeDeg: number
): { lon: number; lat: number; altitudeM: number }
{
    const a = altitudeDeg * DEG;
    const z = azimuthDeg * DEG;
    const R = SUN_ARC_RADIUS_M * scale;
    const east  = R * Math.cos(a) * Math.sin(z);
    const north = R * Math.cos(a) * Math.cos(z);
    const up    = R * Math.sin(a);

    const mPerDegLat = METRES_PER_DEGREE;
    const mPerDegLon = METRES_PER_DEGREE * Math.cos(homeLat * DEG);

    return {
        lon:       homeLon + east  / mPerDegLon,
        lat:       homeLat + north / mPerDegLat,
        altitudeM: up
    };
}

//daylight: smooth 0..1 ramp on solar altitude. Below -6° it bottoms at `nightOpacity`, above +6° full; the
//band between blends so dawn/dusk doesn't pop.
export function daylightRamp(altitudeDeg: number, nightOpacity: number): number
{
    if (altitudeDeg >= 6) { return 1; }
    if (altitudeDeg <= -6) { return nightOpacity; }
    const t01 = (altitudeDeg + 6) / 12;
    return nightOpacity + (1 - nightOpacity) * t01;
}
