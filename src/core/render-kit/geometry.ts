//2D point geometry shared by the scene painters (buildings, dial columns). Pure, no deps.

//A 2D point in whatever space the caller is using ([x, y] or [east, north] metres).
export type Point = [number, number];

//Format a point list as an SVG points attribute (1-decimal px).
export function pointsAttr(points: Point[]): string
{
    return points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}
