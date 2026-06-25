//Geographic + 2D-geometry primitives for the scene renderer: Web-Mercator tile math, lat/lng ↔ local
//metre conversion (the renderer works in metres east/north of the home), and the footprint helpers used
//to rank buildings and clean OSM polygons. All pure and card-agnostic. Ported from the Home Assistant
//frontend Solar scene card.

//A 2D point in whatever space the caller is using ([x, y] or [east, north] metres).
export type Point = [number, number];

const DEG = Math.PI / 180;
//Metres per degree of latitude (WGS84 mean). Longitude scales this by cos(lat). Constant factor is good
//to ~1 m over the few-hundred-metre scene radius — well under OSM footprint resolution.
const METRES_PER_DEG_LAT = 111_320;

//Web Mercator: lon/lat → fractional tile coordinates at the given zoom.
export function lonLatToTile(lon: number, lat: number, zoom: number): Point
{
    const world  = 2 ** zoom;
    const latRad = lat * DEG;
    const y      = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
    return [((lon + 180) / 360) * world, y * world];
}

//Metres-per-degree scale at a given home latitude: [perLon, perLat]. A point (lat, lng) becomes local
//metres via east = (lng - homeLng) * perLon, north = (lat - homeLat) * perLat.
export function metresPerDegree(homeLat: number): { perLon: number; perLat: number }
{
    return {
        perLon: METRES_PER_DEG_LAT * Math.cos(homeLat * DEG),
        perLat: METRES_PER_DEG_LAT,
    };
}

//Convert a lat/lng ring to local metres (east, north) relative to the home origin.
export function ringToLocalMetres(
    ring:    Array<[number, number]>, //[lng, lat] pairs (GeoJSON order)
    homeLat: number,
    homeLng: number
): Point[]
{
    const { perLon, perLat } = metresPerDegree(homeLat);
    return ring.map(([lng, lat]) => [(lng - homeLng) * perLon, (lat - homeLat) * perLat] as Point);
}

//Standard even-odd point-in-polygon test.
export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean
{
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++)
    {
        const [ax, ay] = polygon[i];
        const [bx, by] = polygon[j];
        if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
        {
            inside = !inside;
        }
    }
    return inside;
}

//Distance from the home (local origin) to a footprint — 0 when the origin is INSIDE it. Used to rank
//buildings and pick the home: a large building containing the point ranks first even if its centroid is
//far (which would otherwise drop it or hand "home" to a closer-centroid neighbour).
export function distanceToHome(polygon: Point[]): number
{
    if (pointInPolygon(0, 0, polygon))
    {
        return 0;
    }
    let nearest = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++)
    {
        const [ax, ay] = polygon[j];
        const dx   = polygon[i][0] - ax;
        const dy   = polygon[i][1] - ay;
        const len2 = dx * dx + dy * dy;
        const t    = len2 ? Math.max(0, Math.min(1, (-ax * dx - ay * dy) / len2)) : 0;
        nearest    = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return nearest;
}

//Signed area of a ring (shoelace). >0 = counter-clockwise in screen space (y-down). Used to enforce a
//consistent winding for back-face culling, and to cull screen-space wall quads facing away.
export function signedArea(polygon: Point[]): number
{
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++)
    {
        area += (polygon[j][0] - polygon[i][0]) * (polygon[j][1] + polygon[i][1]);
    }
    return area / 2;
}

//Drop only TRULY collinear (redundant) vertices — common in OSM footprints where a straight wall is
//split by extra points — so a wall stays ONE quad with no false vertical edge bisecting it. The 0.05 m
//threshold (perpendicular distance off the line through the neighbours) keeps every real corner.
export function simplifyFootprint(points: Point[]): Point[]
{
    const n = points.length;
    if (n < 4)
    {
        return points;
    }
    const out: Point[] = [];
    for (let i = 0; i < n; i++)
    {
        const prev  = points[(i + n - 1) % n];
        const cur   = points[i];
        const next  = points[(i + 1) % n];
        const bx    = next[0] - prev[0];
        const by    = next[1] - prev[1];
        const cross = (cur[0] - prev[0]) * by - (cur[1] - prev[1]) * bx;
        if (Math.abs(cross) / (Math.hypot(bx, by) || 1) > 0.05)
        {
            out.push(cur);
        }
    }
    return out.length >= 3 ? out : points;
}

//Andrew's monotone-chain convex hull. Returns vertices counter-clockwise, NOT closed. Used to wrap a
//building's base + cast-shadow points into one shadow envelope.
export function convexHull(pts: Point[]): Point[]
{
    if (pts.length < 3)
    {
        return pts.slice();
    }
    const sorted = pts.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    const cross = (o: Point, a: Point, b: Point): number =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: Point[] = [];
    for (const p of sorted)
    {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
        {
            lower.pop();
        }
        lower.push(p);
    }
    const upper: Point[] = [];
    for (let i = sorted.length - 1; i >= 0; i--)
    {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
        {
            upper.pop();
        }
        upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
}

//Format a point list as an SVG points attribute (1-decimal px).
export function pointsAttr(points: Point[]): string
{
    return points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}
