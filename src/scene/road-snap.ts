//Road-snap for vehicle mode: given the drivable-road geometry already fetched for the basemap (see
//ground-vector.ts's GroundFeature[], filtered by ground-render.ts's isDrivableRoad), find the nearest point
//on the nearest road centreline to the van's current position, gated on how close it is and how fast the van
//is moving. Pure, no DOM/state -- mirrors the segment-projection technique buildings.ts already uses for
//distanceToHome().

import type { GroundFeature } from './ground-vector';
import { DEG, METRES_PER_DEGREE } from '../core/config/constants';

export interface RoadSegment
{
    ax: number;
    ay: number;
    bx: number;
    by: number;
}

//Flatten every drivable road feature's lon/lat paths to local-metre segments relative to `originLat/originLon`
//(the same east/north convention every other scene module uses). Features are usually short polylines; each
//consecutive vertex pair becomes one segment.
export function roadFeaturesToSegments(
    features:  GroundFeature[],
    originLat: number,
    originLon: number,
): RoadSegment[]
{
    const perLat = METRES_PER_DEGREE;
    const perLon = METRES_PER_DEGREE * Math.cos(originLat * DEG);
    const segments: RoadSegment[] = [];
    for (const f of features)
    {
        for (const path of f.lonLat)
        {
            for (let i = 0; i < path.length - 1; i++)
            {
                const [lon0, lat0] = path[i];
                const [lon1, lat1] = path[i + 1];
                segments.push({
                    ax: (lon0 - originLon) * perLon,
                    ay: (lat0 - originLat) * perLat,
                    bx: (lon1 - originLon) * perLon,
                    by: (lat1 - originLat) * perLat,
                });
            }
        }
    }
    return segments;
}

export interface SnapResult
{
    e:          number; //snapped position, local metres east
    n:          number; //snapped position, local metres north
    headingDeg: number; //the road segment's own direction, degrees from north clockwise
    distanceM:  number; //distance from the raw point to the snapped point
}

//Nearest point on a single segment to (px, py), plus the squared distance to it.
function nearestOnSegment(px: number, py: number, s: RoadSegment): { x: number; y: number; d2: number }
{
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / len2)) : 0;
    const x = s.ax + t * dx;
    const y = s.ay + t * dy;
    const ddx = px - x;
    const ddy = py - y;
    return { x, y, d2: ddx * ddx + ddy * ddy };
}

//Snap (eastM, northM) onto the nearest road segment, or return null when the van isn't moving fast enough to
//trust a snap (parked/stationary near a road should show its real position, not jump onto the road) or no
//segment lies within `maxDistanceM`. Heading is the winning segment's own direction, flipped (if needed)
//toward `rawHeadingDeg` so the van never visually snaps backwards relative to where it's actually heading.
export function snapToRoad(
    point:          { eastM: number; northM: number },
    segments:       RoadSegment[],
    maxDistanceM:   number,
    speedMps:       number,
    minSpeedKmh:    number,
    rawHeadingDeg:  number | null,
): SnapResult | null
{
    if (speedMps * 3.6 < minSpeedKmh) { return null; }
    if (segments.length === 0) { return null; }

    let best: { x: number; y: number; d2: number; seg: RoadSegment } | null = null;
    for (const seg of segments)
    {
        const cand = nearestOnSegment(point.eastM, point.northM, seg);
        if (!best || cand.d2 < best.d2) { best = { ...cand, seg }; }
    }
    if (!best) { return null; }
    const distanceM = Math.sqrt(best.d2);
    if (distanceM > maxDistanceM) { return null; }

    const dx = best.seg.bx - best.seg.ax;
    const dy = best.seg.by - best.seg.ay;
    let headingDeg = (Math.atan2(dx, dy) * (1 / DEG) + 360) % 360;
    if (rawHeadingDeg !== null)
    {
        //A road segment's direction is ambiguous (A->B reads the same as B->A); pick whichever end keeps the
        //van's own heading within 90 deg of it, so it never appears to snap onto oncoming-traffic orientation.
        let delta = Math.abs(headingDeg - rawHeadingDeg) % 360;
        if (delta > 180) { delta = 360 - delta; }
        if (delta > 90) { headingDeg = (headingDeg + 180) % 360; }
    }

    return { e: best.x, n: best.y, headingDeg, distanceM };
}
