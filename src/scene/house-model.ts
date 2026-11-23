//Geometry-only Wavefront OBJ support. No Three.js, WebGL, materials or texture requests.
//Only vertex/face records are consumed; normals are derived from the actual geometry.
import type { HouseModelOptions } from '../core/config/house-model-config';
import type { Building } from './buildings';
import type { Point } from '../core/render-kit/geometry';

export type Vertex3 = [number, number, number];
export type Triangle = [number, number, number];
export interface ObjGeometry
{
    vertices: Vertex3[];
    triangles: Triangle[];
}
export interface HouseMesh extends ObjGeometry
{
    //Coordinates are now local metres: east, north, up.
    normals: Vertex3[];
    footprint: Point[];
    height: number;
    centerX: number;
    centerY: number;
}

export const MAX_OBJ_BYTES = 2 * 1024 * 1024;
export const MAX_OBJ_VERTICES = 10000;
export const MAX_OBJ_TRIANGLES = 2000;
const MAX_FACE_VERTICES = 128;
const EPS = 1e-10;

function cross2(a: Point, b: Point, c: Point): number
{
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function triangleNormal(a: Vertex3, b: Vertex3, c: Vertex3): Vertex3
{
    const u = b.map((v, i) => v - a[i]);
    const v = c.map((value, i) => value - a[i]);
    const n: Vertex3 = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    ];
    const len = Math.hypot(...n);
    return len > EPS ? [n[0] / len, n[1] / len, n[2] / len] : [0, 0, 0];
}

//Ear clipping, rather than a triangle fan: an L-shaped face must not fill its missing corner.
//Wavefront polygon faces must be simple and planar. Repeated/collinear corners are removed.
function triangulateFace(indices: number[], vertices: Vertex3[]): Triangle[]
{
    const ring = indices.filter((v, i) => v !== indices[(i + indices.length - 1) % indices.length]);
    if (ring.length < 3)
    {
        return [];
    }
    //Newell's normal picks the least-distorted 2D plane for triangulation.
    const normal = [0, 0, 0];
    for (let i = 0; i < ring.length; i++)
    {
        const a = vertices[ring[i]];
        const b = vertices[ring[(i + 1) % ring.length]];
        normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
        normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
        normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    let drop = 0;
    for (let i = 1; i < 3; i++)
    {
        if (Math.abs(normal[i]) > Math.abs(normal[drop]))
        {
            drop = i;
        }
    }
    if (Math.abs(normal[drop]) < EPS)
    {
        return [];
    }
    const pts: Point[] = ring.map((idx) =>
    {
        const v = vertices[idx];
        return drop === 0 ? [v[1], v[2]] : drop === 1 ? [v[0], v[2]] : [v[0], v[1]];
    });
    let area = 0;
    for (let i = 0; i < pts.length; i++)
    {
        const b = pts[(i + 1) % pts.length];
        area += pts[i][0] * b[1] - b[0] * pts[i][1];
    }
    const sign = area >= 0 ? 1 : -1;
    const remaining = ring.map((_, i) => i);
    const result: Triangle[] = [];
    while (remaining.length > 3)
    {
        let removed = false;
        for (let k = 0; k < remaining.length; k++)
        {
            const ai = remaining[(k + remaining.length - 1) % remaining.length];
            const bi = remaining[k];
            const ci = remaining[(k + 1) % remaining.length];
            const a = pts[ai]; const b = pts[bi]; const c = pts[ci];
            const turn = cross2(a, b, c) * sign;
            if (Math.abs(turn) < EPS)
            {
                remaining.splice(k, 1);
                removed = true;
                break;
            }
            if (turn < 0)
            {
                continue;
            }
            const blocked = remaining.some((pi) =>
                pi !== ai && pi !== bi && pi !== ci
                && cross2(a, b, pts[pi]) * sign >= -EPS
                && cross2(b, c, pts[pi]) * sign >= -EPS
                && cross2(c, a, pts[pi]) * sign >= -EPS);
            if (blocked)
            {
                continue;
            }
            result.push([ring[ai], ring[bi], ring[ci]]);
            remaining.splice(k, 1);
            removed = true;
            break;
        }
        if (!removed)
        {
            throw new Error('OBJ face cannot be triangulated. Export simple planar faces or triangles.');
        }
    }
    if (remaining.length === 3)
    {
        const [a, b, c] = remaining;
        if (Math.abs(cross2(pts[a], pts[b], pts[c])) > EPS)
        {
            result.push([ring[a], ring[b], ring[c]]);
        }
    }
    return result;
}

export function parseObj(text: string): ObjGeometry
{
    if (text.length > MAX_OBJ_BYTES || new TextEncoder().encode(text).byteLength > MAX_OBJ_BYTES)
    {
        throw new Error('OBJ exceeds the 2 MiB limit. Use a low-poly export.');
    }
    const vertices: Vertex3[] = [];
    const triangles: Triangle[] = [];
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    for (let lineNo = 0; lineNo < lines.length; lineNo++)
    {
        const line = lines[lineNo].split('#', 1)[0].trim();
        if (!line)
        {
            continue;
        }
        const fields = line.split(/\s+/);
        const kind = fields.shift();
        if (kind === 'v')
        {
            const xyz = fields.slice(0, 3).map(Number);
            if (xyz.length !== 3 || !xyz.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e9))
            {
                throw new Error(`Invalid OBJ vertex on line ${lineNo + 1}.`);
            }
            if (vertices.length >= MAX_OBJ_VERTICES)
            {
                throw new Error(`OBJ exceeds ${MAX_OBJ_VERTICES} vertices.`);
            }
            vertices.push([xyz[0], xyz[1], xyz[2]]);
        }
        else if (kind === 'f')
        {
            if (fields.length < 3 || fields.length > MAX_FACE_VERTICES)
            {
                throw new Error(`OBJ face on line ${lineNo + 1} needs 3-${MAX_FACE_VERTICES} corners.`);
            }
            //Accept v, v/vt, v//vn and v/vt/vn. UVs/normals/materials are intentionally ignored.
            const ids = fields.map((field) =>
            {
                const token = field.split('/')[0];
                const n = /^[+-]?\d+$/.test(token) ? Number(token) : NaN;
                const idx = n > 0 ? n - 1 : vertices.length + n;
                if (!Number.isSafeInteger(n) || n === 0 || idx < 0 || idx >= vertices.length)
                {
                    throw new Error(`Invalid OBJ face index on line ${lineNo + 1}.`);
                }
                return idx;
            });
            if (ids[0] === ids[ids.length - 1])
            {
                ids.pop();
            }
            if (triangles.length + ids.length - 2 > MAX_OBJ_TRIANGLES)
            {
                throw new Error(`OBJ exceeds ${MAX_OBJ_TRIANGLES} triangles. Decimate the model first.`);
            }
            triangles.push(...triangulateFace(ids, vertices));
        }
    }
    //Remove unused vertices (export helpers must not change the house's bounding box).
    const used = new Map<number, number>();
    const compact: Vertex3[] = [];
    const remapped: Triangle[] = triangles.map((tri) => tri.map((idx) =>
    {
        let next = used.get(idx);
        if (next === undefined)
        {
            next = compact.length;
            used.set(idx, next);
            compact.push(vertices[idx]);
        }
        return next;
    }) as Triangle);
    if (!remapped.length)
    {
        throw new Error('OBJ contains no usable polygon faces.');
    }
    return { vertices: compact, triangles: remapped };
}

//Conservative ground outline for the existing prism-shadow and building-ordering pipeline.
//This is deliberately a convex hull, NOT a claim of exact mesh-shadow geometry.
function groundHull(vertices: Vertex3[]): Point[]
{
    const sorted: Point[] = vertices.map((v) => [v[0], v[1]]);
    sorted.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const points = sorted.filter((p, i) => !i || p[0] !== sorted[i - 1][0] || p[1] !== sorted[i - 1][1]);
    const chain = (list: Point[]): Point[] =>
    {
        const out: Point[] = [];
        for (const p of list)
        {
            while (out.length > 1 && cross2(out[out.length - 2], out[out.length - 1], p) <= EPS)
            {
                out.pop();
            }
            out.push(p);
        }
        out.pop();
        return out;
    };
    return [...chain(points), ...chain([...points].reverse())];
}

export function transformHouseModel(source: ObjGeometry, opts: HouseModelOptions): HouseMesh
{
    //Y-up OBJ uses +X east and +Z south; Z-up uses +X east, +Y north.
    //Both mappings preserve handedness, so outward face winding remains outward.
    const local: Vertex3[] = source.vertices.map(([x, y, z]) => opts.upAxis === 'y' ? [x, -z, y] : [x, y, z]);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const v of local)
    {
        for (let i = 0; i < 3; i++)
        {
            min[i] = Math.min(min[i], v[i]);
            max[i] = Math.max(max[i], v[i]);
        }
    }
    const span = Math.max(max[0] - min[0], max[1] - min[1]);
    if (span < EPS || max[2] - min[2] < EPS)
    {
        throw new Error('OBJ must have a non-zero footprint and height.');
    }
    const scale = opts.sizeM * opts.scale / span;
    const ce = (min[0] + max[0]) / 2;
    const cn = (min[1] + max[1]) / 2;
    const radians = opts.rotationDeg * Math.PI / 180;
    const cos = Math.cos(radians); const sin = Math.sin(radians);
    const vertices: Vertex3[] = local.map(([e, n, u]) =>
    {
        const east = (e - ce) * scale;
        const north = (n - cn) * scale;
        return [
            east * cos + north * sin + opts.offsetEastM,
            -east * sin + north * cos + opts.offsetNorthM,
            (u - min[2]) * scale,
        ];
    });
    const height = (max[2] - min[2]) * scale;
    if (!Number.isFinite(height) || height > 100)
    {
        throw new Error('Custom house height exceeds 100 m. Reduce its size or scale.');
    }
    const footprint = groundHull(vertices);
    if (footprint.length < 3)
    {
        throw new Error('OBJ must have a two-dimensional ground footprint.');
    }
    return {
        vertices,
        triangles: source.triangles,
        normals: source.triangles.map(([a, b, c]) => triangleNormal(vertices[a], vertices[b], vertices[c])),
        footprint, height,
        centerX: opts.offsetEastM,
        centerY: opts.offsetNorthM,
    };
}

export function replaceHomeWithModel(buildings: Building[], mesh: HouseMesh | null): Building[]
{
    if (!mesh)
    {
        return buildings; //Default path is unchanged, including array identity / painter caches.
    }
    //The custom asset replaces the ENTIRE opaque home cluster. Include garages in the OBJ if needed.
    return [
        ...buildings.filter((b) => !b.isHome),
        {
            footprint: mesh.footprint, height: mesh.height,
            centerX: mesh.centerX, centerY: mesh.centerY,
            isHome: true, mesh,
        },
    ];
}

//Highest mesh surface under a local-metre point, for forecast-array markers on a pitched roof.
export function houseRoofHeightAt(mesh: HouseMesh, east: number, north: number): number | null
{
    const point: Point = [east, north];
    let height: number | null = null;
    for (const [ai, bi, ci] of mesh.triangles)
    {
        const a = mesh.vertices[ai]; const b = mesh.vertices[bi]; const c = mesh.vertices[ci];
        const pa: Point = [a[0], a[1]]; const pb: Point = [b[0], b[1]]; const pc: Point = [c[0], c[1]];
        const denom = cross2(pa, pb, pc);
        if (Math.abs(denom) < EPS)
        {
            continue; //Vertical walls do not have a ground area.
        }
        const wa = cross2(point, pb, pc) / denom;
        const wb = cross2(pa, point, pc) / denom;
        const wc = 1 - wa - wb;
        if (wa >= -EPS && wb >= -EPS && wc >= -EPS)
        {
            const up = wa * a[2] + wb * b[2] + wc * c[2];
            height = height === null ? up : Math.max(height, up);
        }
    }
    return height;
}
