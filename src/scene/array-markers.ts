//Array markers: one small tile per Helios-Forecast line, standing in the scene at the line's own position, turned
//to its azimuth and raised to its tilt, so the card shows where each array looks. Pure geometry here (local
//metres about the tile's centre); the engine projects the corners through the camera each frame and the HUD
//paints them. Lines without coordinates sit on the home's roof.

import { DEG } from '../core/config/constants';

//One line of a Helios-Forecast entry as the layout websocket hands it: orientation in degrees (azimuth clockwise
//from north, tilt from horizontal), and the line's own coordinates when it carries some (null: on the home).
export interface ArrayLine
{
    entryId: string;
    index:   number;
    azimuth: number;
    tilt:    number;
    tracker: string | null;
    lat:     number | null;
    lon:     number | null;
}

//Local (east, north, up) offsets in metres of the tile's four corners about its centre, wound bottom-left,
//bottom-right, top-right, top-left as seen from the front. `halfW` runs across the panel (level), `halfL` up the
//slope: the bottom edge is the one facing `azimuth`, the top edge sits behind it and higher by the tilt. A
//tracker has no fixed orientation, so it lies flat (tilt 0) facing its azimuth.
export function arrayTileCorners(
    azimuthDeg: number, tiltDeg: number, halfW: number, halfL: number, tracker: boolean
): [number, number, number][]
{
    const az   = azimuthDeg * DEG;
    const tilt = tracker ? 0 : tiltDeg * DEG;
    //Facing direction on the ground (east, north) and the level across-axis to its right.
    const fe = Math.sin(az);
    const fn = Math.cos(az);
    const ae = fn;
    const an = -fe;
    //Up the slope: back (away from the facing direction) by cos(tilt), up by sin(tilt).
    const se = -fe * Math.cos(tilt);
    const sn = -fn * Math.cos(tilt);
    const su = Math.sin(tilt);
    const corner = (a: number, s: number): [number, number, number] =>
        [a * ae + s * se, a * an + s * sn, s * su];
    return [
        corner(-halfW, -halfL),
        corner( halfW, -halfL),
        corner( halfW,  halfL),
        corner(-halfW,  halfL),
    ];
}

//Cosine of the sun's incidence on the panel (0 when the sun is behind it or below the horizon): how squarely the
//line faces the light right now, which the HUD turns into the tile's glow.
export function arrayIncidence(azimuthDeg: number, tiltDeg: number, sunAzimuthDeg: number, sunAltitudeDeg: number, tracker: boolean): number
{
    if (sunAltitudeDeg <= 0)
    {
        return 0;
    }
    const tilt = tracker ? 0 : tiltDeg * DEG;
    const az   = azimuthDeg * DEG;
    const sAz  = sunAzimuthDeg * DEG;
    const sAlt = sunAltitudeDeg * DEG;
    //Panel normal: tilted from the zenith toward the facing direction.
    const ne = Math.sin(tilt) * Math.sin(az);
    const nn = Math.sin(tilt) * Math.cos(az);
    const nu = Math.cos(tilt);
    const se = Math.cos(sAlt) * Math.sin(sAz);
    const sn = Math.cos(sAlt) * Math.cos(sAz);
    const su = Math.sin(sAlt);
    return Math.max(0, ne * se + nn * sn + nu * su);
}

//Parse one `helios_forecast/layout` answer into lines. Anything malformed is dropped rather than drawn wrong.
export function parseForecastLayout(entryId: string, raw: unknown): ArrayLine[]
{
    const lines = (raw as { lines?: unknown } | null)?.lines;
    if (!Array.isArray(lines))
    {
        return [];
    }
    const out: ArrayLine[] = [];
    for (const item of lines)
    {
        const l = item as Record<string, unknown>;
        const azimuth = Number(l.azimuth);
        const tilt    = Number(l.tilt);
        if (!Number.isFinite(azimuth) || !Number.isFinite(tilt))
        {
            continue;
        }
        const lat = typeof l.lat === 'number' && Number.isFinite(l.lat) ? l.lat : null;
        const lon = typeof l.lon === 'number' && Number.isFinite(l.lon) ? l.lon : null;
        out.push({
            entryId,
            index:   typeof l.index === 'number' ? l.index : out.length,
            azimuth,
            tilt,
            tracker: typeof l.tracker === 'string' && l.tracker !== '' ? l.tracker : null,
            lat:     lat !== null && lon !== null ? lat : null,
            lon:     lat !== null && lon !== null ? lon : null,
        });
    }
    return out;
}
