import { describe, it, expect } from 'vitest';
import {
    renderBuildings,
    renderShadows,
    shapesSvg,
    shadowLayerSvg,
    type Building,
    type ScenePalette,
    type HomeAppearance,
} from '../src/scene/buildings';
import { SceneCamera } from '../src/scene/projection';

//Characterization snapshot: pins the exact SVG output of the buildings + shadows painters for a fixed scene, so the
//painters' output reaching the DOM as persistent nodes (scene-dom.ts) provably changed not a single path.
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
        expect(shapesSvg(renderBuildings(cam, buildings, sun.altitude, palette, 1, 0.25, home, sun.azimuth))).toMatchSnapshot();
    });

    it('renderShadows output is stable for a fixed scene', () =>
    {
        const { cam, buildings, sun } = scene();
        expect(shadowLayerSvg(renderShadows(cam, buildings, sun, '#101014', 0.35))).toMatchSnapshot();
    });

    it('a neighbour nearer the camera than the home paints on top of it (#413)', () =>
    {
        const cam = new SceneCamera();
        cam.setPose(35, 62);
        cam.setViewport(640, 420);
        const homeFootprint: [number, number][] = [[-4, -4], [4, -4], [4, 4], [-4, 4]];
        //Nearer than every home corner (checked against cam.project3: home's own nearest corner sits at
        //depth 4.92, this footprint's nearest corner at 9.84), and overlapping the home in screen space, so
        //an un-depth-sorted renderer (paint neighbours as one block, then the home on top regardless) would
        //visibly fail this the same way #413 reported it.
        const nearNeighbor: [number, number][] = [[4, -8], [8, -8], [8, -4], [4, -4]];
        const buildings: Building[] = [
            { footprint: homeFootprint, height: 6, isHome: true,  centerX: 0, centerY: 0 },
            { footprint: nearNeighbor,  height: 4, isHome: false, centerX: 6, centerY: -6 },
        ];
        const palette: ScenePalette = { home: '#e0a020', neighbor: '#8a8f98' };
        const home: HomeAppearance = { color: '#e0a020', growth: 1 };
        const svg = shapesSvg(renderBuildings(cam, buildings, 40, palette, 1, 0.25, home, 135));

        //Home's fill is the palette gold (#e0a020 -> rgb 224,160,32); the neighbour's is the palette grey
        //(#8a8f98 -> rgb 138,143,152, this scene's wall shade before the ambient/lit mix darkens it further,
        //so match on the shared rgb prefix the walls and roof both carry: "120,124,133" is the wall tone,
        //present on every neighbour face regardless of which wall). Every neighbour face must land AFTER
        //every home face once the nearer building is free to interleave.
        const lastHome = svg.lastIndexOf('rgba(190,135,27');
        const firstNeighbor = svg.indexOf('rgba(120,124,133');
        expect(lastHome).toBeGreaterThan(-1);
        expect(firstNeighbor).toBeGreaterThan(-1);
        expect(firstNeighbor).toBeGreaterThan(lastHome);
    });
});
