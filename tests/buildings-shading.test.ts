//Facade shading. What this guards: every wall used to take ONE flat tint whatever way it pointed, so a block read
//the same from all sides and the scene had no direction to it even with the sun sitting right there in the sky.
//A wall now reads between AMBIENT (turned away, lit only by the sky) and LIT (square on to the sun).

import { describe, it, expect } from 'vitest';
import { renderBuildings, type Building, type ScenePalette } from '../src/scene/buildings';
import { SceneCamera } from '../src/scene/projection';

const palette: ScenePalette = { home: '#ffc107', neighbor: '#9e9e9e' };

//Looking in on a corner, so TWO of the square's walls survive the back-face cull and can be compared. Straight on,
//only one is visible and there is nothing to tell apart.
function camera(): SceneCamera {
    const cam = new SceneCamera();
    cam.pxPerMetre = 4;
    cam.setPose(45, 55);
    cam.setViewport(800, 600);
    return cam;
}

//A square, wound counter-clockwise like the pipeline delivers footprints. Its four walls face S, E, N and W.
function square(): Building {
    return {
        footprint: [[-8, -8], [8, -8], [8, 8], [-8, 8]],
        height: 6,
        isHome: false,
        centerX: 0,
        centerY: 0,
    };
}

//Every wall fill in the SVG, in emission order, as a brightness (walls are grey, so one channel is enough).
function wallShades(svg: string): number[] {
    return [...svg.matchAll(/<polygon [^>]*fill="(#[0-9a-f]{6})"[^>]*stroke-width="0\.4"/g)]
        .map((m) => parseInt(m[1].slice(1, 3), 16));
}

describe('facade shading', () => {
    it('lights the wall facing the sun more than the one turned away', () => {
        //Sun due south: the south wall takes it square on, the east wall is edge-on and gets only the sky. (A
        //south-EAST sun would be a poor test: both walls sit 45 degrees off it and are rightly lit the same.)
        const shades = wallShades(renderBuildings(camera(), [square()], 45, palette, 1, 1, {}, 180));
        expect(shades.length).toBe(2);
        expect(Math.max(...shades)).toBeGreaterThan(Math.min(...shades));
    });

    it('follows the sun round, so the lit side moves with it', () => {
        //The same wall cannot stay the brightest under opposite suns: that was exactly the old flat behaviour.
        const at = (az: number): number[] => wallShades(renderBuildings(camera(), [square()], 45, palette, 1, 1, {}, az));
        const east = at(90);
        const south = at(180);
        expect(east.length).toBe(2);
        //Whichever wall wins under an eastern sun must lose under a southern one.
        expect(east.indexOf(Math.max(...east))).not.toBe(south.indexOf(Math.max(...south)));
    });

    it('drops every wall to ambient once the sun is down', () => {
        //No sun, no direction: walls fall to one tint together, exactly as the shadows stop being cast.
        const shades = wallShades(renderBuildings(camera(), [square()], 0, palette, 1, 1, {}, 180));
        expect(new Set(shades).size).toBe(1);
    });

    it('never lets a wall turned away from the sun go DARKER than ambient', () => {
        //Lambert clamped at zero: a back wall gets no sun, it must not get negative light either.
        const lowSun = wallShades(renderBuildings(camera(), [square()], 0, palette, 1, 1, {}, 180));
        const ambient = lowSun[0];
        for (const az of [0, 45, 90, 135, 180, 225, 270, 315]) {
            for (const s of wallShades(renderBuildings(camera(), [square()], 45, palette, 1, 1, {}, az))) {
                expect(s).toBeGreaterThanOrEqual(ambient);
            }
        }
    });

    it('shades continuously, with no jump as the sun crosses a wall', () => {
        //A wall's light must ease in and out. A step here would flicker as the sun moves, the way the shadow fade
        //used to swing when it hung off a vertex.
        let prev = wallShades(renderBuildings(camera(), [square()], 45, palette, 1, 1, {}, 0));
        for (let az = 1; az <= 360; az += 1) {
            const now = wallShades(renderBuildings(camera(), [square()], 45, palette, 1, 1, {}, az));
            expect(now.length).toBe(prev.length);
            for (let i = 0; i < now.length; i++) {
                expect(Math.abs(now[i] - prev[i])).toBeLessThan(4);
            }
            prev = now;
        }
    });
});
