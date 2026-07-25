//2D point geometry shared by the scene painters (buildings). Pure, no deps.

//A 2D point in whatever space the caller is using ([x, y] or [east, north] metres).
export type Point = [number, number];

//Format a point list as an SVG points attribute (1-decimal px).
export function pointsAttr(points: Point[]): string
{
    return points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

//An axis-aligned clip rectangle, in screen/viewBox px.
export interface ClipRect
{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

//The card box grown by a margin. The margin keeps a clipped edge (and its stroke) off the visible
//card, which ha-card already hides, while still bounding the painted ink to near the card box. On
//old iOS WebKit the composited SVG layer's backing store is sized to its painted ink: unclipped it
//spans the whole projected neighbourhood, overflows the layer-size cap and paints only its top half
//(issue #304). Trimming the geometry also shrinks the per-frame SVG string on every device.
const CLIP_MARGIN = 32;

export function cardClipRect(width: number, height: number): ClipRect
{
    return { minX: -CLIP_MARGIN, minY: -CLIP_MARGIN, maxX: width + CLIP_MARGIN, maxY: height + CLIP_MARGIN };
}

//True when a point falls outside the rect. For primitives that cannot be polygon-clipped (a disc, a
//marker), the caller culls the whole thing when its centre is out, so it never enlarges the layer.
export function pointOutside(p: Point, r: ClipRect): boolean
{
    return p[0] < r.minX || p[0] > r.maxX || p[1] < r.minY || p[1] > r.maxY;
}

//Sutherland-Hodgman clip of a polygon against the rect. Winding is preserved, so a caller that
//normalises orientation afterwards keeps working, and non-zero / even-odd fills read the same inside
//the card: clipping only removes area outside it, which changes neither the winding number nor the
//crossing parity of any point within. A ring wholly inside is returned as the SAME array (no copy,
//no numeric drift) so on-card shapes stay byte-identical; a ring wholly outside returns [].
export function clipPolygon(ring: Point[], r: ClipRect): Point[]
{
    if (ring.length < 3)
    {
        return [];
    }
    let mnx = Infinity; let mny = Infinity; let mxx = -Infinity; let mxy = -Infinity;
    for (const p of ring)
    {
        if (p[0] < mnx) { mnx = p[0]; }
        if (p[0] > mxx) { mxx = p[0]; }
        if (p[1] < mny) { mny = p[1]; }
        if (p[1] > mxy) { mxy = p[1]; }
    }
    if (mxx < r.minX || mnx > r.maxX || mxy < r.minY || mny > r.maxY)
    {
        return [];
    }
    if (mnx >= r.minX && mxx <= r.maxX && mny >= r.minY && mxy <= r.maxY)
    {
        return ring;
    }
    let out = ring;
    out = clipPolygonEdge(out, 0, r.minX);
    if (out.length < 3) { return []; }
    out = clipPolygonEdge(out, 1, r.maxX);
    if (out.length < 3) { return []; }
    out = clipPolygonEdge(out, 2, r.minY);
    if (out.length < 3) { return []; }
    out = clipPolygonEdge(out, 3, r.maxY);
    return out.length < 3 ? [] : out;
}

//One Sutherland-Hodgman pass against a single edge. side: 0 x>=v, 1 x<=v, 2 y>=v, 3 y<=v.
function clipPolygonEdge(poly: Point[], side: number, v: number): Point[]
{
    const res: Point[] = [];
    const n = poly.length;
    for (let i = 0; i < n; i++)
    {
        const a = poly[i];
        const b = poly[(i + 1) % n];
        const ain = edgeInside(a, side, v);
        const bin = edgeInside(b, side, v);
        if (ain)
        {
            res.push(a);
            if (!bin) { res.push(edgeCross(a, b, side, v)); }
        }
        else if (bin)
        {
            res.push(edgeCross(a, b, side, v));
        }
    }
    return res;
}

function edgeInside(p: Point, side: number, v: number): boolean
{
    if (side === 0) { return p[0] >= v; }
    if (side === 1) { return p[0] <= v; }
    if (side === 2) { return p[1] >= v; }
    return p[1] <= v;
}

function edgeCross(a: Point, b: Point, side: number, v: number): Point
{
    if (side <= 1)
    {
        const t = (v - a[0]) / (b[0] - a[0]);
        return [v, a[1] + t * (b[1] - a[1])];
    }
    const t = (v - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), v];
}

//Liang-Barsky clip of a segment to the rect. Returns the trimmed endpoints, or null if the segment
//misses the rect entirely. Used for the open polylines (arc, leader lines, sun ray).
export function clipSegment(a: Point, b: Point, r: ClipRect): [Point, Point] | null
{
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const p = [-dx, dx, -dy, dy];
    const q = [a[0] - r.minX, r.maxX - a[0], a[1] - r.minY, r.maxY - a[1]];
    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < 4; i++)
    {
        if (p[i] === 0)
        {
            if (q[i] < 0) { return null; }
            continue;
        }
        const t = q[i] / p[i];
        if (p[i] < 0)
        {
            if (t > t1) { return null; }
            if (t > t0) { t0 = t; }
        }
        else
        {
            if (t < t0) { return null; }
            if (t < t1) { t1 = t; }
        }
    }
    return [
        [a[0] + t0 * dx, a[1] + t0 * dy],
        [a[0] + t1 * dx, a[1] + t1 * dy],
    ];
}
