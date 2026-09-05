import { describe, it, expect } from 'vitest';
import { sceneZoom } from '../src/core/config/helios-config';
import { SceneCamera } from '../src/scene/projection';

describe('sceneZoom', () =>
{
    it('defaults to 1 with no config, an unknown value, or a bad type', () =>
    {
        expect(sceneZoom(undefined)).toBe(1);
        expect(sceneZoom({} as any)).toBe(1);
        expect(sceneZoom({ 'scene-zoom': 3 } as any)).toBe(1);
        expect(sceneZoom({ 'scene-zoom': 'big' } as any)).toBe(1);
        expect(sceneZoom({ 'scene-zoom': null } as any)).toBe(1);
    });

    it('accepts the three levels as numbers or as the editor\'s strings', () =>
    {
        expect(sceneZoom({ 'scene-zoom': 1.5 } as any)).toBe(1.5);
        expect(sceneZoom({ 'scene-zoom': 2 } as any)).toBe(2);
        expect(sceneZoom({ 'scene-zoom': '1.5' } as any)).toBe(1.5);
        expect(sceneZoom({ 'scene-zoom': '2' } as any)).toBe(2);
        expect(sceneZoom({ 'scene-zoom': '1' } as any)).toBe(1);
    });
});

describe('SceneCamera under a zoom', () =>
{
    function cam(zoom: number): SceneCamera
    {
        const c = new SceneCamera();
        c.pxPerMetre = 2 * zoom;
        c.zoom = zoom;
        c.setPose(0, 0);
        c.setViewport(800, 600);
        return c;
    }

    it('projects ground offsets proportionally to the zoomed px-per-metre', () =>
    {
        const a = cam(1).project3(10, 0, 0);
        const b = cam(2).project3(10, 0, 0);
        expect(b.x - 400).toBeCloseTo(2 * (a.x - 400), 6);
    });

    it('leaves the default ground transform string untouched at zoom 1', () =>
    {
        const t = cam(1).groundTransform(100, 100).transform;
        expect(t).not.toContain('scale(');
    });

    it('appends the matching scale() innermost at zoom 1.5 / 2', () =>
    {
        expect(cam(1.5).groundTransform(100, 100).transform.endsWith(' scale(1.5)')).toBe(true);
        expect(cam(2).groundTransform(100, 100).transform.endsWith(' scale(2)')).toBe(true);
    });
});
