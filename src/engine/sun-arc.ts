//Pure sun-arc geometry: the celestial-hemisphere point for an instant and the daylight opacity ramp. No
//DOM, map, renderer, or engine state — the engine projects the returned lon/lat/altitude through its
//camera and owns the per-frame caches.

import { getSunPosition } from './sun';
import { SUN_ARC_RADIUS_M } from '../constants';

//date -> 3D point on the celestial hemisphere (radius SUN_ARC_RADIUS_M × scale, centred on home) as
//(lon, lat, altitude_m) for the scene projection. Azimuth clockwise from North; ENU offsets
//east=R·cosα·sinφ, north=R·cosα·cosφ, up=R·sinα, converted to lon/lat via local metres-per-degree.
export function sunSpherePoint(
    date: Date, homeLat: number, homeLon: number, scale: number
): { lon: number; lat: number; altitudeM: number; altitudeDeg: number }
{
    const sun = getSunPosition(date, homeLat, homeLon);
    const D   = Math.PI / 180;
    const a   = sun.altitude * D;
    const z   = sun.azimuth  * D;

    //Scale the celestial radius on kiosk layouts so the arc doesn't sit at its grid-tuned size.
    const R = SUN_ARC_RADIUS_M * scale;
    const east  = R * Math.cos(a) * Math.sin(z);
    const north = R * Math.cos(a) * Math.cos(z);
    const up    = R * Math.sin(a);

    //Local metres-per-degree.
    const mPerDegLat = 111_320;
    const mPerDegLon = 111_320 * Math.cos(homeLat * D);

    return {
        lon:         homeLon + east  / mPerDegLon,
        lat:         homeLat + north / mPerDegLat,
        altitudeM:   up,
        altitudeDeg: sun.altitude
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
