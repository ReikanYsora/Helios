import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { houseModelOptions, HOUSE_MODEL_CONFIG_KEYS } from '../src/core/config/house-model-config';
import { parseObj, transformHouseModel, replaceHomeWithModel, houseRoofHeightAt,
    MAX_OBJ_BYTES, MAX_OBJ_TRIANGLES, MAX_OBJ_VERTICES } from '../src/scene/house-model';
import { renderHouseMesh } from '../src/scene/house-model-render';
import { renderBuildings, renderShadows } from '../src/scene/buildings';
import type { Building } from '../src/scene/buildings';
import { arrayStandHeight } from '../src/scene/array-markers';
import { SceneCamera } from '../src/scene/projection';

const OBJ = readFileSync(new URL('../examples/low-poly-house.obj', import.meta.url), 'utf8');
const OPTIONS = houseModelOptions({ 'house-model-url': '/local/house.obj' })!;
const mesh = () => transformHouseModel(parseObj(OBJ), OPTIONS);
const vertexText = 'v 0 0 0\nv 1 0 0\nv 0 1 0\n';

describe('custom house config', () =>
{
    it('is opt-in and rejects non-string/empty URLs', () =>
    {
        for (const value of [undefined, null, false, 42, '', '   '])
        {
            expect(houseModelOptions({ 'house-model-url': value })).toBeNull();
        }
        expect(houseModelOptions(undefined)).toBeNull();
        expect(HOUSE_MODEL_CONFIG_KEYS).toContain('house-model-url');
    });

    it('uses safe defaults and accepts numeric strings', () =>
    {
        expect(OPTIONS).toEqual({ url: '/local/house.obj', sizeM: 12, scale: 1,
            rotationDeg: 0, upAxis: 'y', offsetEastM: 0, offsetNorthM: 0 });
        expect(houseModelOptions({ 'house-model-url': ' /local/house.obj ',
            'house-model-size-m': '20', 'house-model-rotation-deg': '-90' }))
            .toMatchObject({ url: '/local/house.obj', sizeM: 20, rotationDeg: 270 });
    });

    it('does not coerce booleans/null/empty strings into numeric values', () =>
    {
        for (const value of [null, false, true, '', '  ', [], {}, 'bad', Infinity])
        {
            expect(houseModelOptions({ 'house-model-url': 'a.obj', 'house-model-scale': value })!.scale).toBe(1);
        }
    });

    it('clamps extreme options and supports Z up', () =>
    {
        expect(houseModelOptions({ 'house-model-url': 'a.obj', 'house-model-up-axis': 'z',
            'house-model-scale': 100, 'house-model-size-m': -1, 'house-model-offset-east-m': 999 }))
            .toMatchObject({ upAxis: 'z', scale: 10, sizeM: 0.1, offsetEastM: 100 });
    });
});

describe('OBJ geometry', () =>
{
    it('imports the supplied closed gabled house', () =>
    {
        expect(parseObj(OBJ).vertices).toHaveLength(10);
        expect(parseObj(OBJ).triangles).toHaveLength(16);
    });

    it.each(['1 2 3', '-3 -2 -1', '1/1 2/2 3/3', '1//1 2//2 3//3', '1/1/1 2/2/2 3/3/3'])
        ('accepts face syntax %s', (face) =>
        {
            expect(parseObj(vertexText + `f ${face}`).triangles).toHaveLength(1);
        });

    it('ignores materials/texture records/comments without requesting assets', () =>
    {
        const source = '\uFEFFmtllib ignored.mtl\r\n' + vertexText + 'vt 0 0\nvn 0 0 1\nusemtl glass\nf 1 2 3 # roof';
        expect(parseObj(source).triangles).toHaveLength(1);
    });

    it.each(['0 2 3', '1 2 4', '-4 2 3', '1.5 2 3', 'NaN 2 3'])
        ('rejects invalid face indices %s', (face) =>
        {
            expect(() => parseObj(vertexText + `f ${face}`)).toThrow(/index/);
        });

    it('rejects non-finite vertices and empty geometry', () =>
    {
        expect(() => parseObj('v NaN 0 0\n')).toThrow(/vertex/);
        expect(() => parseObj('v 1e99 0 0\n')).toThrow(/vertex/);
        expect(() => parseObj('mtllib only.mtl\n')).toThrow(/no usable/);
    });

    it('does not use unreferenced helper vertices for sizing', () =>
    {
        const geometry = parseObj(vertexText + 'v 10000 10000 10000\nf 1 2 3');
        expect(geometry.vertices).toHaveLength(3);
    });

    it('triangulates a concave L-shaped polygon without filling the notch', () =>
    {
        const source = 'v 0 0 0\nv 2 0 0\nv 2 1 0\nv 1 1 0\nv 1 2 0\nv 0 2 0\nf 1 2 3 4 5 6';
        const geometry = parseObj(source);
        expect(geometry.triangles).toHaveLength(4);
        const area = geometry.triangles.reduce((sum, [ai, bi, ci]) =>
        {
            const a = geometry.vertices[ai]; const b = geometry.vertices[bi]; const c = geometry.vertices[ci];
            return sum + Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
        }, 0);
        expect(area).toBeCloseTo(3);
    });

    it('handles reversed winding and a repeated closing corner', () =>
    {
        expect(parseObj(vertexText + 'f 3 2 1 3').triangles).toHaveLength(1);
    });

    it('enforces file, vertex and triangle limits', () =>
    {
        expect(() => parseObj('#'.repeat(MAX_OBJ_BYTES + 1))).toThrow(/2 MiB/);
        expect(() => parseObj('v 0 0 0\n'.repeat(MAX_OBJ_VERTICES + 1))).toThrow(/vertices/);
        expect(() => parseObj(vertexText + 'f 1 2 3\n'.repeat(MAX_OBJ_TRIANGLES + 1))).toThrow(/triangles/);
    });
});

describe('house transforms and replacement', () =>
{
    it('grounds, centers and uniformly scales Y-up geometry', () =>
    {
        const house = mesh();
        expect(Math.min(...house.vertices.map((v) => v[2]))).toBeCloseTo(0);
        expect(Math.max(...house.vertices.map((v) => v[0]))).toBeCloseTo(6);
        expect(Math.min(...house.vertices.map((v) => v[0]))).toBeCloseTo(-6);
        expect(house.height).toBeCloseTo(8);
        expect(house.footprint).toHaveLength(4);
    });

    it('supports Z-up exports without flipping winding', () =>
    {
        const source = parseObj(OBJ);
        const zUp = { vertices: source.vertices.map(([x, y, z]) => [x, -z, y] as [number, number, number]),
            triangles: source.triangles };
        const house = transformHouseModel(zUp, { ...OPTIONS, upAxis: 'z' });
        expect(house.vertices).toEqual(mesh().vertices);
        expect(house.normals).toEqual(mesh().normals);
    });

    it('rotates clockwise, scales uniformly and applies metre offsets', () =>
    {
        const house = transformHouseModel(parseObj(OBJ), { ...OPTIONS, rotationDeg: 90,
            scale: 2, offsetEastM: 3, offsetNorthM: -2 });
        const corner = mesh().vertices.findIndex(([e, n, u]) => e === -6 && n === 4 && u === 0);
        expect(corner).toBeGreaterThanOrEqual(0);
        expect(house.vertices[corner][0]).toBeCloseTo(11);
        expect(house.vertices[corner][1]).toBeCloseTo(10);
        expect(house.height).toBeCloseTo(16);
        expect(house.centerX).toBe(3);
        expect(house.centerY).toBe(-2);
    });

    it('rejects flat and excessively tall assets', () =>
    {
        const flat = parseObj('v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3');
        expect(() => transformHouseModel(flat, OPTIONS)).toThrow(/height/);
        expect(() => transformHouseModel(parseObj(OBJ), { ...OPTIONS, sizeM: 100, scale: 10 })).toThrow(/100 m/);
    });

    it('leaves the default path unchanged and replaces only the home cluster', () =>
    {
        const buildings: Building[] = [
            { footprint: [[0,0],[5,0],[5,5],[0,5]], height: 6, isHome: true, centerX: 0, centerY: 0 },
            { footprint: [[6,0],[8,0],[8,2],[6,2]], height: 3, isHome: true, centerX: 7, centerY: 1 },
            { footprint: [[30,0],[35,0],[35,5],[30,5]], height: 6, isHome: false, centerX: 32, centerY: 2 },
        ];
        expect(replaceHomeWithModel(buildings, null)).toBe(buildings);
        const out = replaceHomeWithModel(buildings, mesh());
        expect(out).toHaveLength(2);
        expect(out[0]).toBe(buildings[2]);
        expect(out[1].mesh).toBeDefined();
        expect(out[1].placeholder).toBeUndefined();
        expect(replaceHomeWithModel([], mesh())).toHaveLength(1);
    });

    it('finds actual pitched-roof heights, including during squash', () =>
    {
        const house = mesh();
        expect(houseRoofHeightAt(house, 0, 0)).toBeCloseTo(8);
        expect(houseRoofHeightAt(house, 3, 0)).toBeCloseTo(6.5);
        expect(houseRoofHeightAt(house, 20, 20)).toBeNull();
        expect(arrayStandHeight(3, 0, replaceHomeWithModel([], house), 0.5, 0.2)).toBeCloseTo(3.45);
    });
});

describe('SVG mesh integration', () =>
{
    function camera(bearing = 0): SceneCamera
    {
        const cam = new SceneCamera();
        cam.pxPerMetre = 4;
        cam.setPose(bearing, 50);
        cam.setViewport(400, 300);
        return cam;
    }

    it.each([0, 90, 180, 270])('projects finite, clipped faces at bearing %i', (bearing) =>
    {
        const faces = renderHouseMesh(camera(bearing), mesh(), 45, '#488fc2', 1, 180);
        expect(faces.length).toBeGreaterThan(0);
        for (const face of faces)
        {
            expect(Number.isFinite(face.depth)).toBe(true);
            expect(face.shape.stroke).toBe('none');
            for (const point of face.shape.geom.split(' '))
            {
                const [x, y] = point.split(',').map(Number);
                expect(x).toBeGreaterThanOrEqual(-32);
                expect(x).toBeLessThanOrEqual(432);
                expect(y).toBeGreaterThanOrEqual(-32);
                expect(y).toBeLessThanOrEqual(332);
            }
        }
    });

    it('does not draw fully squashed geometry', () =>
    {
        expect(renderHouseMesh(camera(), mesh(), 45, '#488fc2', 0, 180)).toEqual([]);
    });

    it('uses the existing building painter and shadow layer', () =>
    {
        const cam = camera();
        const buildings = replaceHomeWithModel([], mesh());
        const faces = renderBuildings(cam, buildings, 45, { home: '#488fc2', neighbor: '#cccccc' }, 1);
        expect(faces.length).toBeGreaterThan(0);
        expect(faces.every((f) => f.stroke === 'none')).toBe(true);
        expect(renderShadows(cam, buildings, { azimuth: 180, altitude: 45 }, '#000000', 0.32)?.casts.length).toBe(1);
    });

    it('keeps distant custom faces inside the same clipping pipeline', () =>
    {
        const house = transformHouseModel(parseObj(OBJ), { ...OPTIONS, offsetEastM: 100 });
        const faces = renderHouseMesh(camera(), house, 45, '#488fc2', 1, 180);
        expect(faces).toEqual([]);
    });
});
