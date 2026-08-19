// Vehicle-mode GPS tracking subsystem.
//
// Reads a device_tracker/person entity's live latitude/longitude each refresh cycle and pushes it into the
// engine via setVanPosition(). Speed (m/s) and heading (deg from north) come from, in order: a configured
// dedicated sensor, the tracker's own `speed`/`course` attributes, or -- when neither is available -- derived
// from a short buffer of recent GPS fixes (oldest vs newest, not consecutive pairs, to damp single-fix
// jitter). No recorder history, no durable cache: unlike irradiance.ts the engine only ever needs the van's
// CURRENT position, never a past series.
//
// Same host-driven pattern as irradiance.ts: the card owns `_vanFixBuffer`; this module reads/writes it
// through the structural VanTrackerHost interface.

import type { HassLike } from '../../core/ha-types';
import type { HeliosConfig } from '../../core/config/helios-config';
import { structureMode, vanTrackerEntity, vanSpeedEntity, vanHeadingEntity } from '../../core/config/helios-config';
import type { HeliosEngine, VanFixInput } from '../../scene/helios-engine';
import { warnOnce } from '../log';
import { DEG, EARTH_CIRCUMFERENCE_M, VAN_GPS_FIX_BUFFER_SIZE } from '../../core/config/constants';

export interface VanFix
{
    lat: number;
    lon: number;
    tMs: number;
}

export interface VanTrackerHost
{
    readonly config: HeliosConfig | undefined;
    readonly hass:   HassLike;
    readonly _engine?: HeliosEngine;
    _vanFixBuffer: VanFix[];
}

//Great-circle distance (m) between two lat/lon points (haversine), using the same equatorial-circumference
//earth model as METRES_PER_DEGREE elsewhere in the scene, so a derived speed agrees with the scene's own grid.
export function haversineDistanceM(lat0: number, lon0: number, lat1: number, lon1: number): number
{
    const R = EARTH_CIRCUMFERENCE_M / (2 * Math.PI);
    const phi1 = lat0 * DEG;
    const phi2 = lat1 * DEG;
    const dPhi = (lat1 - lat0) * DEG;
    const dLambda = (lon1 - lon0) * DEG;
    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

//Initial bearing (deg from north, clockwise) travelling from (lat0,lon0) to (lat1,lon1).
export function bearingDeg(lat0: number, lon0: number, lat1: number, lon1: number): number
{
    const phi1 = lat0 * DEG;
    const phi2 = lat1 * DEG;
    const dLambda = (lon1 - lon0) * DEG;
    const y = Math.sin(dLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
    return (Math.atan2(y, x) / DEG + 360) % 360;
}

//Speed (m/s) from the oldest vs newest buffered fix, or null when there isn't enough of a time gap (< 2s) to
//trust a derived rate -- consecutive-pair deltas would otherwise amplify single-fix GPS jitter into noise.
export function deriveSpeedMps(fixes: VanFix[]): number | null
{
    if (fixes.length < 2) { return null; }
    const oldest = fixes[0];
    const newest = fixes[fixes.length - 1];
    const dtMs = newest.tMs - oldest.tMs;
    if (dtMs < 2000) { return null; }
    return haversineDistanceM(oldest.lat, oldest.lon, newest.lat, newest.lon) / (dtMs / 1000);
}

//Heading (deg from north) from the oldest vs newest buffered fix, or null when the van hasn't moved far
//enough (< 2m) for the bearing between them to mean anything.
export function deriveHeadingDeg(fixes: VanFix[]): number | null
{
    if (fixes.length < 2) { return null; }
    const oldest = fixes[0];
    const newest = fixes[fixes.length - 1];
    if (haversineDistanceM(oldest.lat, oldest.lon, newest.lat, newest.lon) < 2) { return null; }
    return bearingDeg(oldest.lat, oldest.lon, newest.lat, newest.lon);
}

function pushFix(buffer: VanFix[], fix: VanFix): void
{
    buffer.push(fix);
    while (buffer.length > VAN_GPS_FIX_BUFFER_SIZE) { buffer.shift(); }
}

//Parse a sensor entity's state as a plain finite number (m/s for speed, degrees for heading); null when
//missing/unavailable/non-finite.
function readNumericEntity(hass: HassLike, entityId: string): number | null
{
    const state = hass.states?.[entityId];
    if (!state) { return null; }
    const v = parseFloat(state.state);
    return Number.isFinite(v) ? v : null;
}

//De-dupe on (entity, last_updated) so a Lit cycle with no new fix doesn't push a duplicate buffer entry;
//module-scope WeakMap, mirrors irradiance.ts's `_pushedIrradianceKey` pattern.
const _vanDedupe = new WeakMap<VanTrackerHost, { entity: string; lastUpdated: string | undefined }>();

//Live refresh, called every lifecycle cycle. No-op outside vehicle mode. A missing/unavailable tracker (or no
//entity configured) freezes the van at its last-known position rather than hiding it or falling back to a
//default location, which would be actively misleading.
export function refreshVanTracker(host: VanTrackerHost): void
{
    if (structureMode(host.config) !== 'van')
    {
        return;
    }
    const entity = vanTrackerEntity(host.config);
    if (!entity || !host.hass)
    {
        host._engine?.setVanPosition(null);
        return;
    }
    const state = host.hass.states?.[entity];
    if (!state || state.state === 'unavailable' || state.state === 'unknown')
    {
        host._engine?.setVanPosition(null);
        warnOnce(`van-tracker-${entity}`, `van tracker entity "${entity}" is unavailable`);
        return;
    }
    const lat = Number(state.attributes?.latitude);
    const lon = Number(state.attributes?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
    {
        host._engine?.setVanPosition(null);
        warnOnce(`van-tracker-attrs-${entity}`, `van tracker entity "${entity}" has no usable latitude/longitude`);
        return;
    }

    const dedupe = _vanDedupe.get(host);
    if (!dedupe || dedupe.entity !== entity)
    {
        //Switched trackers (or first run): the buffer's fixes belong to a different entity/position history.
        host._vanFixBuffer = [];
    }
    const lastUpdated = state.last_updated;
    if (!dedupe || dedupe.entity !== entity || dedupe.lastUpdated !== lastUpdated)
    {
        const tMs = lastUpdated ? new Date(lastUpdated).getTime() : NaN;
        pushFix(host._vanFixBuffer, { lat, lon, tMs: Number.isFinite(tMs) ? tMs : Date.now() });
        _vanDedupe.set(host, { entity, lastUpdated });
    }

    const speedEntityId   = vanSpeedEntity(host.config);
    const headingEntityId = vanHeadingEntity(host.config);

    const attrSpeed   = typeof state.attributes?.speed  === 'number' ? state.attributes.speed  : null;
    const attrHeading = typeof state.attributes?.course === 'number' ? state.attributes.course  : null;

    const resolvedSpeed = (speedEntityId ? readNumericEntity(host.hass, speedEntityId) : null)
        ?? attrSpeed
        ?? deriveSpeedMps(host._vanFixBuffer);
    const resolvedHeading = (headingEntityId ? readNumericEntity(host.hass, headingEntityId) : null)
        ?? attrHeading
        ?? deriveHeadingDeg(host._vanFixBuffer);

    const fix: VanFixInput = { lat, lon, headingDeg: resolvedHeading, speedMps: resolvedSpeed };
    host._engine?.setVanPosition(fix);
}
