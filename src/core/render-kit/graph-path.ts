//Curve helpers that mirror Home Assistant's built-in graph cards, so Helios line charts read as native. `getPath`
//is a straight port of HA's own smoothing (a quadratic Bezier through segment midpoints); `GRAPH_STROKE_WIDTH` and
//`parseCssDuration` match the stroke weight and the data-morph timing HA uses. Coordinates are [x, y] pairs in the
//target coordinate space (viewBox units are fine when the stroke uses vector-effect="non-scaling-stroke").

//The line weight HA draws its graph curves at.
export const GRAPH_STROKE_WIDTH = 2;

const midPoint = (ax: number, ay: number, bx: number, by: number): [number, number] => [(ax - bx) / 2 + bx, (ay - by) / 2 + by];

//Smooth open path through the points, identical in shape to HA's graph curve.
export function getPath(coords: number[][]): string
{
    const pts = coords.filter(Boolean);
    if (!pts.length) { return ''; }
    let last = pts[0];
    let next = last;
    let path = `M ${last[0]},${last[1]}`;
    for (const coord of pts)
    {
        next = coord;
        const [zx, zy] = midPoint(last[0], last[1], next[0], next[1]);
        path += ` ${zx},${zy} Q${next[0]},${next[1]}`;
        last = next;
    }
    path += ` ${next[0]},${next[1]}`;
    return path;
}

//Parse a CSS duration ("350ms", "0.35s") to milliseconds; 0 when unset/invalid (callers then skip the animation).
export function parseCssDuration(value: string): number
{
    const t = value.trim();
    if (!t) { return 0; }
    const ms = t.endsWith('ms');
    const n = parseFloat(ms ? t.slice(0, -2) : t.endsWith('s') ? t.slice(0, -1) : t);
    if (!Number.isFinite(n) || n < 0) { return 0; }
    return ms || !t.endsWith('s') ? n : n * 1000;
}
