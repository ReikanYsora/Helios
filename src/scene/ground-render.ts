//Paints the decoded OpenFreeMap ground features (ground-vector.ts) onto the basemap canvas the renderer tilts.
//Colours come from a palette, any layer can be hidden, and the sun altitude grades the whole map, so a theme /
//config / time change repaints from the cached features with no re-fetch. Features are [lon, lat], mapped via
//Web Mercator at GROUND_ZOOM so the home anchor + camera scale match the overlays. Road widths are metric.

import { pxPerMetreFor, lonLatToTile, type Ground } from './tiles';
import type { SceneCamera } from './projection';
import { GROUND_FADE_START, GROUND_RADIUS, GROUND_ZOOM, TILE_PX } from '../core/config/constants';
import { fetchGroundVector, type GroundFeature } from './ground-vector';
import { mixHex } from '../core/render-kit/hex';

//One colour per map element. The keys are also the user-facing layer keys (config + editor blocks).
export interface GroundPalette
{
    land:       string;
    water:      string;
    wood:       string;
    grass:      string;
    sand:       string;
    wetland:    string;
    ice:        string;
    landuse:    string;
    roadMajor:  string;
    roadMinor:  string;
    roadCasing: string;
    path:       string;
    rail:       string;
    building:   string;
    boundary:   string;
}

export type GroundLayerKey = keyof GroundPalette;

//Canonical order of the configurable layers (drives the editor blocks + the config seed).
export const GROUND_LAYER_KEYS: GroundLayerKey[] = [
    'land', 'water', 'wood', 'grass', 'sand', 'wetland', 'ice', 'landuse',
    'roadMajor', 'roadMinor', 'roadCasing', 'path', 'rail', 'building', 'boundary',
];

//A resolved ground style: the colours + the set of layer keys to skip (hidden). Passed to the painter.
export interface GroundStyle
{
    palette: GroundPalette;
    hidden:  ReadonlySet<GroundLayerKey>;
}

//Liberty-inspired light and Fiord-inspired dark starting palettes. The custom mode seeds from one of these.
export function defaultGroundPalette(isDark: boolean): GroundPalette
{
    return isDark
        ? {
            land: '#2a2f3a', water: '#33445f', wood: '#2c3730', grass: '#313d33', sand: '#3a3730',
            wetland: '#2d3838', ice: '#39404a', landuse: '#2e3340',
            roadMajor: '#454c5e', roadMinor: '#3a4152', roadCasing: '#20242e', path: '#3c4354',
            rail: '#4a5060', building: '#333a48', boundary: '#5a4a63',
        }
        : {
            land: '#f3f0e9', water: '#a3c9ef', wood: '#c6d8b4', grass: '#d7e7c4', sand: '#e9e1c9',
            wetland: '#d2dec9', ice: '#e7eef1', landuse: '#ece7dd',
            roadMajor: '#ffffff', roadMinor: '#ffffff', roadCasing: '#cbc3b2', path: '#e2d4b6',
            rail: '#b6b6bf', building: '#e2dacd', boundary: '#c1a3c1',
        };
}

//Metric road widths (m) by transportation class; casing adds a rim under the fill. Tunable.
const ROAD_WIDTH_M: Record<string, number> = {
    motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 8,
    minor: 6, residential: 6, unclassified: 6, living_street: 5, pedestrian: 5,
    service: 4, track: 3, path: 2, footway: 2, cycleway: 2, steps: 2,
};

//A drivable road centreline (not rail, not a path/footway/cycleway/steps/track). Shared with vehicle mode's
//road-snap, so "what counts as a road to paint" and "what counts as a road to snap onto" never drift apart.
export function isDrivableRoad(f: GroundFeature): boolean
{
    return f.line && f.layer === 'transportation' && f.cls !== 'rail' && !/^path|footway|cycleway|steps|track/.test(f.cls);
}
const ROAD_CASING_M = 1.4;
//Global multiplier on every road width, so the whole network thins/thickens in one knob while we tune the look.
const ROAD_SCALE = 0.4;

function landcoverKey(cls: string): GroundLayerKey
{
    if (/wood|forest|tree/.test(cls)) { return 'wood'; }
    if (/sand|beach|dune/.test(cls)) { return 'sand'; }
    if (/wetland|marsh|mangrove|bog|swamp/.test(cls)) { return 'wetland'; }
    if (/ice|glacier|snow/.test(cls)) { return 'ice'; }
    return 'grass';
}

function landuseKey(cls: string): GroundLayerKey
{
    if (/wood|forest/.test(cls)) { return 'wood'; }
    if (/park|pitch|playground|recreation|golf|garden|grass|meadow|cemetery|farm|orchard|vineyard/.test(cls)) { return 'grass'; }
    return 'landuse';
}

//Append a feature's rings/paths to a Path2D in canvas space. Polygons are closed for filling.
function addPath(path: Path2D, f: GroundFeature, toPx: (lon: number, lat: number) => [number, number]): void
{
    for (const ring of f.lonLat)
    {
        const [x0, y0] = toPx(ring[0][0], ring[0][1]);
        path.moveTo(x0, y0);
        for (let i = 1; i < ring.length; i++)
        {
            const [x, y] = toPx(ring[i][0], ring[i][1]);
            path.lineTo(x, y);
        }
        if (!f.line) { path.closePath(); }
    }
}

//Grade one colour by sun altitude - the scene's whole day/night atmosphere (there is no wash): cool +
//dark-but-readable at night, violet twilight, warm golden hour, sunlit lift at midday. Milder than the buildings.
function groundTint(base: string, altitude: number): string
{
    const night = mixHex(base, '#0e1420', 0.62);
    const dusk  = mixHex(base, '#2a2445', 0.45);
    const warm  = mixHex(base, '#7a3f1e', 0.28);
    const sunny = mixHex(base, '#fff2d8', 0.16);
    if (altitude < -8) { return night; }
    if (altitude < 0)  { return mixHex(night, dusk, (altitude + 8) / 8); }
    if (altitude < 6)  { return mixHex(dusk,  warm, altitude / 6); }
    if (altitude < 25) { return mixHex(warm,  sunny, (altitude - 6) / 19); }
    return sunny;
}

//Grade the whole palette by the sun altitude, so the map lives through the day/night cycle like the buildings.
function tintPalette(palette: GroundPalette, altitude: number): GroundPalette
{
    const out = {} as GroundPalette;
    for (const key of GROUND_LAYER_KEYS) { out[key] = groundTint(palette[key], altitude); }
    return out;
}

function paint(
    ctx:        CanvasRenderingContext2D,
    cw:         number,
    ch:         number,
    features:   GroundFeature[],
    toPx:       (lon: number, lat: number) => [number, number],
    pxPerMetre: number,
    style:      GroundStyle,
    altitude:   number,
    //Screen-space outline of the ground when painting already-projected (the compat path). Without it the
    //land colour would flood the whole canvas, including the sky above the horizon.
    landPath?:  Path2D,
): void
{
    const p    = tintPalette(style.palette, altitude);
    const hide = (key: GroundLayerKey): boolean => style.hidden.has(key);

    ctx.clearRect(0, 0, cw, ch);
    if (!hide('land'))
    {
        ctx.fillStyle = p.land;
        if (landPath) { ctx.fill(landPath); }
        else { ctx.fillRect(0, 0, cw, ch); }
    }
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';

    const fillFeature = (f: GroundFeature, colour: string): void =>
    {
        const path = new Path2D();
        addPath(path, f, toPx);
        ctx.fillStyle = colour;
        ctx.fill(path, 'evenodd');
    };
    const strokeFeature = (f: GroundFeature, colour: string, widthPx: number): void =>
    {
        const path = new Path2D();
        addPath(path, f, toPx);
        ctx.strokeStyle = colour;
        ctx.lineWidth   = widthPx;
        ctx.stroke(path);
    };

    //Areas, bottom to top: greenery, land use, water on top of land.
    for (const f of features)
    {
        if (f.line || f.layer !== 'landcover') { continue; }
        const key = landcoverKey(f.cls);
        if (!hide(key)) { fillFeature(f, p[key]); }
    }
    for (const f of features)
    {
        if (f.line || f.layer !== 'landuse') { continue; }
        const key = landuseKey(f.cls);
        if (!hide(key)) { fillFeature(f, p[key]); }
    }
    if (!hide('grass'))
    {
        for (const f of features) { if (!f.line && f.layer === 'park') { fillFeature(f, p.grass); } }
    }
    if (!hide('roadCasing'))
    {
        for (const f of features) { if (!f.line && f.layer === 'aeroway') { fillFeature(f, p.roadCasing); } }
    }
    if (!hide('water'))
    {
        for (const f of features) { if (!f.line && f.layer === 'water') { fillFeature(f, p.water); } }
        for (const f of features)
        {
            if (!f.line || f.layer !== 'waterway') { continue; }
            const w = (f.cls === 'stream' || f.cls === 'ditch' || f.cls === 'drain' ? 1.4 : 3) * pxPerMetre * ROAD_SCALE;
            strokeFeature(f, p.water, Math.max(1, w));
        }
    }

    //Roads: rank so minor draws under major; a casing pass under a fill pass gives the classic outlined road.
    const roads = features.filter(isDrivableRoad);
    const rank  = (c: string): number => ROAD_WIDTH_M[c] ?? 6;
    roads.sort((a, b) => rank(a.cls) - rank(b.cls));
    const roadWidth = (c: string): number => (ROAD_WIDTH_M[c] ?? 6) * pxPerMetre * ROAD_SCALE;

    if (!hide('roadCasing'))
    {
        for (const f of roads) { strokeFeature(f, p.roadCasing, roadWidth(f.cls) + ROAD_CASING_M * pxPerMetre * ROAD_SCALE); }
    }
    for (const f of roads)
    {
        const key: GroundLayerKey = rank(f.cls) >= 8 ? 'roadMajor' : 'roadMinor';
        if (!hide(key)) { strokeFeature(f, p[key], roadWidth(f.cls)); }
    }

    //Paths + tracks (thin, dashed) and rails (dashed).
    ctx.setLineDash([Math.max(2, pxPerMetre), Math.max(2, pxPerMetre)]);
    if (!hide('path'))
    {
        for (const f of features)
        {
            if (!f.line || f.layer !== 'transportation' || !/^path|footway|cycleway|steps|track/.test(f.cls)) { continue; }
            strokeFeature(f, p.path, Math.max(1, 2 * pxPerMetre * ROAD_SCALE));
        }
    }
    if (!hide('rail'))
    {
        for (const f of features)
        {
            if (!f.line || f.layer !== 'transportation' || f.cls !== 'rail') { continue; }
            strokeFeature(f, p.rail, Math.max(1, 3 * pxPerMetre * ROAD_SCALE));
        }
    }
    ctx.setLineDash([]);

    //Building footprints under the 3D prisms.
    if (!hide('building'))
    {
        for (const f of features) { if (!f.line && f.layer === 'building') { fillFeature(f, p.building); } }
    }

    //Admin boundaries (dashed, thin).
    if (!hide('boundary'))
    {
        ctx.setLineDash([Math.max(3, 2 * pxPerMetre), Math.max(3, 2 * pxPerMetre)]);
        for (const f of features)
        {
            if (!f.line || f.layer !== 'boundary') { continue; }
            strokeFeature(f, p.boundary, Math.max(1, 1.2 * pxPerMetre * ROAD_SCALE));
        }
        ctx.setLineDash([]);
    }
}

//The built ground canvas plus a repaint closure so a theme/config change redraws from the cached features.
export interface VectorGround
{
    ground:  Ground;
    repaint: (style: GroundStyle, altitude: number) => void;
    //Compatibility path. Paints the ground ALREADY PROJECTED into a card-sized canvas, so the
    //element carries no CSS 3D transform at all. Old iOS WebKit gives any flat layer composited over a
    //3D-transformed one a half-height backing store, dropping the bottom half of everything drawn above the
    //basemap; with the transform gone the whole scene composites correctly. Costs a repaint per camera move,
    //which is why it is not the default path.
    repaintProjected: (
        camera: SceneCamera,
        w: number,
        h: number,
        style: GroundStyle,
        altitude: number,
    ) => void;
    //Every decoded ground feature (not just roads), retained so vehicle mode can query road geometry for
    //snapping without a second fetch. Painting already holds this in a closure; this just also hands it out.
    features: GroundFeature[];
}

//Build the basemap canvas for a home position. Never rejects: a tile outage yields a blank themed fill (the home
//+ buildings still show). The caller's abort (a location change) propagates out of the fetch.
export async function buildVectorGround(
    lat:      number,
    lng:      number,
    style:    GroundStyle,
    altitude: number,
    signal?:  AbortSignal,
    //Force the basemap canvas onto the CPU raster backend (willReadFrequently). Set on the projected compat path,
    //which is the degraded mode entry-level GPUs (Mali/Adreno) fall into: their GPU-accelerated 2D canvas renders
    //corrupted memory (bands of RGB noise), and a CPU-backed canvas sidesteps that driver bug while keeping the
    //full map. No cost worth caring about here: the ground repaints only on a camera move or a theme change.
    cpuRaster = false,
): Promise<VectorGround>
{
    const zoom   = GROUND_ZOOM;
    const [tileX, tileY] = lonLatToTile(lng, lat, zoom);
    const radius = GROUND_RADIUS;
    const firstX = Math.floor(tileX) - radius;
    const firstY = Math.floor(tileY) - radius;
    const across = 2 * radius + 1;
    const size   = across * TILE_PX;
    const homeX  = (tileX - firstX) * TILE_PX;
    const homeY  = (tileY - firstY) * TILE_PX;
    const pxPerMetre    = pxPerMetreFor(lat, zoom);
    const groundRadiusM = (size / 2) / pxPerMetre * 1.15;

    const features = (await fetchGroundVector(lat, lng, groundRadiusM, signal)) ?? [];

    const el = document.createElement('canvas');
    el.width     = size;
    el.height    = size;
    el.className = 'ground';
    const ctx = el.getContext('2d', cpuRaster ? { willReadFrequently: true } : undefined);

    const toPx = (lon: number, la: number): [number, number] =>
    {
        const [wx, wy] = lonLatToTile(lon, la, zoom);
        return [(wx - firstX) * TILE_PX, (wy - firstY) * TILE_PX];
    };
    const repaint = (st: GroundStyle, alt: number): void =>
    {
        if (ctx) { paint(ctx, size, size, features, toPx, pxPerMetre, st, alt); }
    };
    repaint(style, altitude);

    //Compat path: same features, but every vertex goes through the camera's own projection (the one the
    //buildings use), so the canvas is already in screen space and needs no transform to sit under them.
    const toMetres = (tx: number, ty: number): [number, number] =>
        [(tx - tileX) * TILE_PX / pxPerMetre, -(ty - tileY) * TILE_PX / pxPerMetre];

    const repaintProjected = (
        camera: SceneCamera,
        w: number,
        h: number,
        st: GroundStyle,
        alt: number,
    ): void =>
    {
        if (!ctx) { return; }
        if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }

        const toScreen = (lon: number, la: number): [number, number] =>
        {
            const [wx, wy] = lonLatToTile(lon, la, zoom);
            const [e, n]   = toMetres(wx, wy);
            return camera.project(e, n, 0);
        };

        //The ground's own outline, so the land colour stops at the horizon instead of flooding the sky.
        //Edges are walked in steps: the projection clamps at the near plane, so a far edge is not reliably
        //straight once it approaches the horizon.
        const landPath = new Path2D();
        const x0 = firstX; const y0 = firstY; const x1 = firstX + across; const y1 = firstY + across;
        const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        const STEPS = 24;
        for (let c = 0; c < 4; c++)
        {
            const [ax, ay] = corners[c];
            const [bx, by] = corners[(c + 1) % 4];
            for (let s = 0; s < STEPS; s++)
            {
                const t = s / STEPS;
                const [e, n] = toMetres(ax + (bx - ax) * t, ay + (by - ay) * t);
                const q = camera.project(e, n, 0);
                if (c === 0 && s === 0) { landPath.moveTo(q[0], q[1]); }
                else { landPath.lineTo(q[0], q[1]); }
            }
        }
        landPath.closePath();

        paint(ctx, w, h, features, toScreen, pxPerMetre, st, alt, landPath);

        //Edge fade, baked into the projected canvas instead of the face-on .ground-fade disc. The
        //ground-space fade circle (radius = the basemap's closest-side, transparent until GROUND_FADE_START%,
        //dissolving by the rim) is drawn through the SAME projection as the scene, so it lies flat in the plane,
        //tilted AND turned with it, rather than a disc facing the camera. We map the unit circle onto the ellipse
        //via the projected +east / +north basis vectors, and erase to transparent (destination-out) so the real
        //card background shows through in either theme, nothing to plumb.
        const rM    = (size / 2) / pxPerMetre;
        const home  = camera.project(0, 0, 0);
        const east  = camera.project(rM, 0, 0);
        const north = camera.project(0, rM, 0);
        const ux = east[0]  - home[0]; const uy = east[1]  - home[1];   //+east, one semi-diameter
        const vx = north[0] - home[0]; const vy = north[1] - home[1];   //+north, the conjugate semi-diameter
        const det = ux * vy - uy * vx;                                   //~0 only if the plane is edge-on
        if (Number.isFinite(det) && Math.abs(det) > 1)
        {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            //Unit circle -> projected fade ellipse: (1,0)->+east, (0,1)->+north, (0,0)->home.
            ctx.transform(ux, uy, vx, vy, home[0], home[1]);
            const g = ctx.createRadialGradient(0, 0, GROUND_FADE_START / 100, 0, 0, 1);
            g.addColorStop(0, 'rgba(0,0,0,0)');   //keep the ground untouched inside the fade start
            g.addColorStop(1, 'rgba(0,0,0,1)');   //erase to transparent by the rim and beyond
            ctx.fillStyle = g;
            //Cover the whole canvas in this transformed space: inverse-map the four corners, bound them.
            const inv = 1 / det;
            let m = 1.5;
            for (const [px, py] of [[0, 0], [w, 0], [0, h], [w, h]] as [number, number][])
            {
                const dx = px - home[0]; const dy = py - home[1];
                const lx = (vy * dx - vx * dy) * inv;
                const ly = (-uy * dx + ux * dy) * inv;
                m = Math.max(m, Math.abs(lx) + 1, Math.abs(ly) + 1);
            }
            ctx.fillRect(-m, -m, 2 * m, 2 * m);
            ctx.restore();
        }
    };

    const fade = document.createElement('div');
    fade.className    = 'ground-fade';
    fade.style.width  = `${size}px`;
    fade.style.height = `${size}px`;

    return { ground: { el, fade, homeX, homeY, size }, repaint, repaintProjected, features };
}
