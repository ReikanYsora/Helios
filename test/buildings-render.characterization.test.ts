import { describe, it, expect } from 'vitest';
import {
    renderBuildings,
    renderShadows,
    type Building,
    type ScenePalette,
    type HomeAppearance,
} from '../src/scene/buildings';
import { SceneCamera } from '../src/scene/projection';

//Characterization snapshot: pins the exact SVG output of the buildings + shadows painters for a fixed scene, so the
//upcoming performance refactor (how the painted shapes reach the DOM) can prove it did not change a single path.
//Deterministic: the painters are pure projection, no randomness.
function scene(): {
    cam: SceneCamera;
    buildings: Building[];
    palette: ScenePalette;
    home: HomeAppearance;
    sun: { azimuth: number; altitude: number };
}
{
    const cam = new SceneCamera();
    cam.setPose(35, 62);
    cam.setViewport(640, 420);
    const buildings: Building[] = [
        { footprint: [[-4, -4], [4, -4], [4, 4], [-4, 4]] as [number, number][], height: 6, isHome: true,  centerX: 0,   centerY: 0 },
        { footprint: [[10, 8], [18, 8], [18, 16], [10, 16]] as [number, number][], height: 8, isHome: false, centerX: 14,  centerY: 12 },
        { footprint: [[-22, 4], [-12, 4], [-12, 14], [-22, 14]] as [number, number][], height: 5, isHome: false, centerX: -17, centerY: 9 },
    ];
    const palette: ScenePalette = { home: '#e0a020', neighbor: '#8a8f98' };
    const home: HomeAppearance = { color: '#e0a020', growth: 1 };
    const sun = { azimuth: 135, altitude: 40 };
    return { cam, buildings, palette, home, sun };
}

describe('buildings / shadows render (characterization)', () =>
{
    it('renderBuildings output is stable for a fixed scene', () =>
    {
        const { cam, buildings, palette, home, sun } = scene();
        expect(renderBuildings(cam, buildings, sun.altitude, palette, 1, 0.25, home, sun.azimuth)).toMatchSnapshot();
    });

    it('renderShadows output is stable for a fixed scene', () =>
    {
        const { cam, buildings, sun } = scene();
        expect(renderShadows(cam, buildings, sun, '#101014', 0.35)).toMatchSnapshot();
    });
});
