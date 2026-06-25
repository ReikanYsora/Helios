//Sky painter for the 2.5D scene renderer: the full-frame night/twilight wash, the sun's path on a dome
//around the home (depth-split into back/far/near layers so it sits correctly behind + in front of the
//home), and the four-layer sun disc. Pure over a SceneCamera + the day's precomputed sun samples. The
//host (each card) supplies the samples (via its own astronomy) and draws card-specific HUD — sunrise/
//sunset time labels, the sun→PV ray — on top, using the sun screen position this returns. Ported from
//the Home Assistant frontend Solar scene card.

import { SceneCamera } from './projection';
import { nightShade, arcColor } from './colors';

const DEG = Math.PI / 180;
//Don't draw the path below this altitude (deg): deep night, off-dome.
const DRAW_ALT = -12;
//Base celestial radius (m); scaled on-screen by the viewport so the arc frames the home at any zoom.
const ARC_R_M = 40;

export interface SunSample { azimuth: number; altitude: number }

export interface SkyResult
{
    //Arc segments split by depth: back = below-horizon (behind home), far/near = above-horizon.
    arcBack: string;
    arcFar:  string;
    arcNear: string;
    //Four-layer sun disc (halo + body + outline) SVG.
    sunDisc: string;
    //True when the sun sits in front of the home (near half) so the host can layer the disc accordingly.
    sunNear: boolean;
    //Sun + home screen positions + the on-screen arc scale, for the host's HUD (ray, labels).
    sunX:  number;
    sunY:  number;
    homeX: number;
    homeY: number;
    scale: number;
    //Normalised 0..1 sun brightness (sin of altitude, sqrt-shaped) — drives the disc fill + ray speed.
    fill:  number;
}

//Full-frame night/twilight wash rect for the current sun altitude. Empty in daylight.
export function renderNightShade(altitude: number, width: number, height: number): string
{
    const shade = nightShade(altitude);
    return shade.opacity > 0
        ? `<rect width="${width}" height="${height}" fill="${shade.color}" opacity="${shade.opacity.toFixed(3)}"/>`
        : '';
}

//Project the sun path + disc. `samples` is the day's sun positions (e.g. every 15 min, 0..1440); `sun`
//is the current position. The dome radius scales so the arc stays well-framed across zoom levels.
export function renderSky(
    cam:     SceneCamera,
    samples: SunSample[],
    sun:     SunSample,
    palette: { sun: string },
    width:   number,
    height:  number
): SkyResult
{
    const home = cam.project3(0, 0, 0);

    //Recover the actual on-screen px/m from the camera (project a 60 m ring, take the max radius) so the
    //arc scale tracks pitch/perspective rather than the raw ground px/m.
    let pxPerM = cam.pxPerMetre;
    let maxDist = 0;
    for (let k = 0; k < 8; k++)
    {
        const a = (k / 8) * 2 * Math.PI;
        const p = cam.project3(60 * Math.sin(a), 60 * Math.cos(a), 0);
        maxDist = Math.max(maxDist, Math.hypot(p.x - home.x, p.y - home.y));
    }
    if (maxDist > 0) { pxPerM = maxDist / 60; }
    const scale = Math.max(0.72, Math.min((0.47 * Math.min(width, height)) / pxPerM / ARC_R_M, 6));
    const R = ARC_R_M * scale;

    const dome = (azimuth: number, altitude: number): { x: number; y: number; depth: number } =>
        cam.project3(
            R * Math.cos(altitude * DEG) * Math.sin(azimuth * DEG),
            R * Math.cos(altitude * DEG) * Math.cos(azimuth * DEG),
            R * Math.sin(altitude * DEG)
        );

    const pts = samples.map((at) => ({ ...dome(at.azimuth, at.altitude), alt: at.altitude }));
    const s = dome(sun.azimuth, sun.altitude);

    let dMin = Infinity;
    let dMax = -Infinity;
    for (const p of pts) { dMin = Math.min(dMin, p.depth); dMax = Math.max(dMax, p.depth); }
    dMin = Math.min(dMin, s.depth);
    dMax = Math.max(dMax, s.depth);
    const dRange = dMax - dMin || 1;
    const near = (d: number): number => (d - dMin) / dRange;

    let backOut = '', backSeg = '', farOut = '', farSeg = '', nearOut = '', nearSeg = '';
    for (let i = 1; i < pts.length; i++)
    {
        const a = pts[i - 1];
        const b = pts[i];
        if (a.alt < DRAW_ALT || b.alt < DRAW_ALT) { continue; }
        const n      = (near(a.depth) + near(b.depth)) / 2;
        const night  = a.alt <= 0 && b.alt <= 0;
        const factor = night ? 0.5 : 1;
        const ow     = (1.5 + 3.5 * n) * factor;
        const sw     = (1 + 3 * n) * factor;
        const cls    = night ? ' solar-arc-night' : '';
        const coords = `x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"`;
        const outline = `<line class="solar-arc-outline${cls}" ${coords} stroke-width="${ow.toFixed(2)}"/>`;
        const segment = `<line class="solar-arc-segment${cls}" ${coords} stroke="${arcColor((a.alt + b.alt) / 2, palette.sun)}" stroke-width="${sw.toFixed(2)}"/>`;
        if (night)        { backOut += outline; backSeg += segment; }
        else if (n >= 0.5) { nearOut += outline; nearSeg += segment; }
        else               { farOut += outline; farSeg += segment; }
    }

    //Disc brightness + halo scale with the sun's height — a VISUAL cue only (no irradiance value).
    const fill = Math.sqrt(Math.min(1, Math.max(0, Math.sin(Math.max(0, sun.altitude) * DEG))));
    const r    = (10 + 10 * near(s.depth)) * scale;
    const c    = `cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}"`;
    const sunDisc = `
      <defs><radialGradient id="solar-halo-now">
        <stop offset="0%" stop-color="${palette.sun}" stop-opacity="${(fill * 0.55).toFixed(3)}"/>
        <stop offset="100%" stop-color="${palette.sun}" stop-opacity="0"/>
      </radialGradient></defs>
      <circle ${c} r="${(r * 3).toFixed(1)}" fill="url(#solar-halo-now)"/>
      <circle ${c} r="${r.toFixed(1)}" fill="${palette.sun}" fill-opacity="0.2"/>
      <circle ${c} r="${(r * fill).toFixed(1)}" fill="${palette.sun}"/>
      <circle ${c} r="${r.toFixed(1)}" fill="none" stroke="${palette.sun}" stroke-width="1.5"/>`;

    return {
        arcBack: backOut + backSeg,
        arcFar:  farOut + farSeg,
        arcNear: nearOut + nearSeg,
        sunDisc,
        sunNear: near(s.depth) >= 0.5,
        sunX:  s.x,
        sunY:  s.y,
        homeX: home.x,
        homeY: home.y,
        scale,
        fill,
    };
}
