//Project low-poly triangles into the same face list as the surrounding SVG prisms.
import type { HouseMesh } from './house-model';
import type { SceneCamera } from './projection';
import { PERSPECTIVE, NEAR_PLANE } from './projection';
import type { SceneShape } from './buildings';
import { pointsAttr, clipPolygon, cardClipRect, type Point } from '../core/render-kit/geometry';
import { tintedRgba } from '../core/render-kit/colors';
import { mixHex } from '../core/render-kit/hex';
import { SHADOW_FADE_DEG } from '../core/config/constants';

export interface HouseFace
{
    depth: number;
    shape: SceneShape;
}

export function renderHouseMesh(
    cam: SceneCamera, mesh: HouseMesh, altitude: number, color: string,
    growth: number, sunAzimuth: number
): HouseFace[]
{
    if (growth <= 0)
    {
        return [];
    }
    const projected = mesh.vertices.map(([e, n, u]) => cam.project3(e, n, u * growth));
    const rect = cardClipRect(cam.width, cam.height);
    const nearCull = PERSPECTIVE * (1 - NEAR_PLANE);
    const az = sunAzimuth * Math.PI / 180;
    const alt = Math.max(0, altitude) * Math.PI / 180;
    const sun = [Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt)];
    const fade = Math.max(0, Math.min(1, altitude / SHADOW_FADE_DEG));
    const faces: HouseFace[] = [];
    for (let k = 0; k < mesh.triangles.length; k++)
    {
        const tri = mesh.triangles[k];
        const [a, b, c] = tri.map((idx) => projected[idx]);
        //A small asset must stay in front of the near plane. Do not smear clamped vertices across the card.
        if (a.depth >= nearCull || b.depth >= nearCull || c.depth >= nearCull)
        {
            continue;
        }
        //ENU is right-handed; the camera's screen y is downward, so visible outward faces wind negative.
        const facing = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        if (facing >= -1e-8)
        {
            continue;
        }
        const polygon: Point[] = [[a.x, a.y], [b.x, b.y], [c.x, c.y]];
        const clipped = clipPolygon(polygon, rect);
        if (clipped.length < 3)
        {
            continue;
        }
        //Inverse-transpose of the vertical squash, to keep pitched-roof lighting physically consistent.
        const [ne, nn, nu0] = mesh.normals[k];
        const nu = nu0 / growth;
        const len = Math.hypot(ne, nn, nu) || 1;
        const lit = Math.max(0, (ne * sun[0] + nn * sun[1] + nu * sun[2]) / len) * fade;
        const shade = mixHex(mixHex(color, '#000000', 0.38), mixHex(color, '#ffffff', 0.18), lit);
        faces.push({
            depth: Math.max(a.depth, b.depth, c.depth),
            //No triangle edge stroke: triangulated flat roofs should not look like a wireframe.
            shape: { tag: 'polygon', geom: pointsAttr(clipped), fill: tintedRgba(shade, altitude, 1),
                stroke: 'none', strokeWidth: '0' },
        });
    }
    return faces;
}
