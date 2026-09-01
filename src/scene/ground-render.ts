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
const ROAD_CASING_M = 1.4;
//Global multiplier on every road width, so the whole network thins/thickens in one knob while we tune the look.
const ROAD_SCALE = 0.4;

function landcoverKey(cls: string): GroundLayerKey
{
    if (/wood|forest|tree/.test(cls))
    {
        return 'wood';
    }
    if (/sand|beach|dune/.test(cls))
    {
        return 'sand';
    }
    if (/wetland|marsh|mangrove|bog|swamp/.test(cls))
    {
        return 'wetland';
    }
    if (/ice|glacier|snow/.test(cls))
    {
        return 'ice';
    }
    return 'grass';
}

function landuseKey(cls: string): GroundLayerKey
{
    if (/wood|forest/.test(cls))
    {
        return 'wood';
    }
    if (/park|pitch|playground|recreation|golf|garden|grass|meadow|cemetery|farm|orchard|vineyard/.test(cls))
    {
        return 'grass';
    }
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
        if (!f.line)
        {
            path.closePath();
        }
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
    if (altitude < -8)
    {
        return night;
    }
    if (altitude < 0)
    {
        return mixHex(night, dusk, (altitude + 8) / 8);
    }
    if (altitude < 6)
    {
        return mixHex(dusk,  warm, altitude / 6);
    }
    if (altitude < 25)
    {
        return mixHex(warm,  sunny, (altitude - 6) / 19);
    }
    return sunny;
}

//Grade the whole palette by the sun altitude, so the map lives through the day/night cycle like the buildings.
function tintPalette(palette: GroundPalette, altitude: number): GroundPalette
{
    const out = {} as GroundPalette;
    for (const key of GROUND_LAYER_KEYS)
    {
        out[key] = groundTint(palette[key], altitude);
    }
    return out;
}

//Bucket the fetched features by their source layer, once per fetch: paint() runs on every repaint (a theme
//change, or every camera move on the projected compat path), and re-scanning the full array per layer/class
//on each of those calls was the actual repeated cost. Grouped once here, each layer lookup below is a Map hit
//over just that layer's own features instead of a full-array filter.
export type GroundFeaturesByLayer = Map<string, GroundFeature[]>;

function groupByLayer(features: GroundFeature[]): GroundFeaturesByLayer
{
    const byLayer: GroundFeaturesByLayer = new Map();
    for (const f of features)
    {
        const bucket = byLayer.get(f.layer);
        if (bucket)
        {
            bucket.push(f);
        }
        else
        {
            byLayer.set(f.layer, [f]);
        }
    }
    return byLayer;
}

//Per-ground-build Path2D cache, passed by the normal/transform `repaint` closure only - NEVER by
//`repaintProjected`, whose geometry changes every frame under a moving camera and must always be rebuilt
//fresh. `toPx` and the decoded feature set are both invariant for the lifetime of one buildVectorGround()
//call, so on that path every feature's (or stroke bucket's) Path2D is the exact same shape on every repaint();
//only fillStyle/strokeStyle/lineWidth (driven by style + altitude) change per call. Scoped to the closure that
//creates it (see buildVectorGround), so a location change / re-fetch discards it with nothing to invalidate
//by hand.
interface PaintCache
{
    fills:         Map<GroundFeature, Path2D>;
    strokes:       Map<string, Path2D>;
    strokeBuckets: Map<string, Map<number, Path2D>>;
}

function paint(
    ctx:        CanvasRenderingContext2D,
    cw:         number,
    ch:         number,
    featuresByLayer: GroundFeaturesByLayer,
    toPx:       (lon: number, lat: number) => [number, number],
    pxPerMetre: number,
    style:      GroundStyle,
    altitude:   number,
    //Screen-space outline of the ground when painting already-projected (the compat path). Without it the
    //land colour would flood the whole canvas, including the sky above the horizon.
    landPath?:  Path2D,
    cache?:     PaintCache,
): void
{
    const p    = tintPalette(style.palette, altitude);
    const hide = (key: GroundLayerKey): boolean => style.hidden.has(key);
    const layerFeatures = (layer: string): GroundFeature[] => featuresByLayer.get(layer) ?? [];

    ctx.clearRect(0, 0, cw, ch);
    if (!hide('land'))
    {
        ctx.fillStyle = p.land;
        if (landPath)
        {
            ctx.fill(landPath);
        }
        else
        {
            ctx.fillRect(0, 0, cw, ch);
        }
    }
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';

    //A feature's own Path2D never changes shape across repeated repaint() calls (see PaintCache above), so
    //when a cache is given, build it once and replay it - only fillStyle (the one thing style/altitude can
    //change) is reapplied per call.
    const fillFeature = (f: GroundFeature, colour: string): void =>
    {
        let path = cache?.fills.get(f);
        if (!path)
        {
            path = new Path2D();
            addPath(path, f, toPx);
            cache?.fills.set(f, path);
        }
        ctx.fillStyle = colour;
        ctx.fill(path, 'evenodd');
    };
    //Strokes carry no winding/hole semantics, so unlike a fill, disjoint line features sharing one width can
    //merge into a single Path2D and a single stroke() call with no visual difference. Cuts Path2D allocation
    //and canvas draw-call count on the projected ground mode, which repaints every rotation frame with no
    //camera-driven change to skip - measured to meaningfully reduce GC pressure there, though NOT to move
    //observed repaint throughput or main-thread busy time, since canvas stroke() rasterization cost (pixels
    //painted, not call count) dominates that mode's per-frame cost. `features` order is preserved into the
    //merged path, so stacking (e.g. minor road under major) only depends on the CALLER already grouping by
    //width the same way the un-batched code drew them. `cacheKey` (only meaningful together with a cache) lets
    //repeated calls for the same named group reuse one merged path.
    const strokeBatch = (features: GroundFeature[], colour: string, widthPx: number, cacheKey?: string): void =>
    {
        if (!features.length)
        {
            return;
        }
        let path = cacheKey ? cache?.strokes.get(cacheKey) : undefined;
        if (!path)
        {
            path = new Path2D();
            for (const f of features)
            {
                addPath(path, f, toPx);
            }
            if (cacheKey)
            {
                cache?.strokes.set(cacheKey, path);
            }
        }
        ctx.strokeStyle = colour;
        ctx.lineWidth   = widthPx;
        ctx.stroke(path);
    };
    //Same as strokeBatch, but for a feature set whose per-feature width varies (roads, their casing): buckets
    //by the exact width so the draw-call count still drops from O(features) to O(distinct widths present),
    //while every feature keeps its own correct width. Bucket insertion follows `features`'s own order, so
    //passing an already rank-sorted array (as the roads below are) preserves the original stacking order.
    const strokeBatchByWidth = (features: GroundFeature[], colour: string, widthOf: (f: GroundFeature) => number, cacheKey?: string): void =>
    {
        let buckets = cacheKey ? cache?.strokeBuckets.get(cacheKey) : undefined;
        if (!buckets)
        {
            buckets = new Map<number, Path2D>();
            for (const f of features)
            {
                const w = widthOf(f);
                let path = buckets.get(w);
                if (!path)
                {
                    path = new Path2D();
                    buckets.set(w, path);
                }
                addPath(path, f, toPx);
            }
            if (cacheKey)
            {
                cache?.strokeBuckets.set(cacheKey, buckets);
            }
        }
        ctx.strokeStyle = colour;
        for (const [w, path] of buckets)
        {
            ctx.lineWidth = w;
            ctx.stroke(path);
        }
    };

    //Areas, bottom to top: greenery, land use, water on top of land.
    for (const f of layerFeatures('landcover'))
    {
        if (f.line)
        {
            continue;
        }
        const key = landcoverKey(f.cls);
        if (!hide(key))
        {
            fillFeature(f, p[key]);
        }
    }
    for (const f of layerFeatures('landuse'))
    {
        if (f.line)
        {
            continue;
        }
        const key = landuseKey(f.cls);
        if (!hide(key))
        {
            fillFeature(f, p[key]);
        }
    }
    if (!hide('grass'))
    {
        for (const f of layerFeatures('park'))
        {
            if (!f.line)
            {
                fillFeature(f, p.grass);
            }
        }
    }
    if (!hide('roadCasing'))
    {
        for (const f of layerFeatures('aeroway'))
        {
            if (!f.line)
            {
                fillFeature(f, p.roadCasing);
            }
        }
    }
    if (!hide('water'))
    {
        for (const f of layerFeatures('water'))
        {
            if (!f.line)
            {
                fillFeature(f, p.water);
            }
        }
        const waterways = layerFeatures('waterway').filter((f) => f.line);
        strokeBatchByWidth(waterways, p.water, (f) =>
            Math.max(1, (f.cls === 'stream' || f.cls === 'ditch' || f.cls === 'drain' ? 1.4 : 3) * pxPerMetre * ROAD_SCALE), 'waterway');
    }

    //Roads: rank so minor draws under major; a casing pass under a fill pass gives the classic outlined road.
    const roads = layerFeatures('transportation').filter((f) => f.line && f.cls !== 'rail' && !/^path|footway|cycleway|steps|track/.test(f.cls));
    const rank  = (c: string): number => ROAD_WIDTH_M[c] ?? 6;
    roads.sort((a, b) => rank(a.cls) - rank(b.cls));
    const roadWidth = (c: string): number => (ROAD_WIDTH_M[c] ?? 6) * pxPerMetre * ROAD_SCALE;

    if (!hide('roadCasing'))
    {
        strokeBatchByWidth(roads, p.roadCasing, (f) => roadWidth(f.cls) + ROAD_CASING_M * pxPerMetre * ROAD_SCALE, 'roadCasing');
    }
    //roads is already rank-sorted ascending; minor's widest class (6) is still below major's narrowest (8), so
    //splitting into these two filtered passes (instead of one interleaved loop) draws the exact same
    //minor-under-major stacking, just batched to one stroke() call per distinct width instead of one per road.
    if (!hide('roadMinor'))
    {
        strokeBatchByWidth(roads.filter((f) => rank(f.cls) < 8), p.roadMinor, (f) => roadWidth(f.cls), 'roadMinor');
    }
    if (!hide('roadMajor'))
    {
        strokeBatchByWidth(roads.filter((f) => rank(f.cls) >= 8), p.roadMajor, (f) => roadWidth(f.cls), 'roadMajor');
    }

    //Paths + tracks (thin, dashed) and rails (dashed) - both a single fixed width, so a plain batch suffices.
    ctx.setLineDash([Math.max(2, pxPerMetre), Math.max(2, pxPerMetre)]);
    if (!hide('path'))
    {
        const paths = layerFeatures('transportation').filter((f) => f.line && /^path|footway|cycleway|steps|track/.test(f.cls));
        strokeBatch(paths, p.path, Math.max(1, 2 * pxPerMetre * ROAD_SCALE), 'path');
    }
    if (!hide('rail'))
    {
        const rails = layerFeatures('transportation').filter((f) => f.line && f.cls === 'rail');
        strokeBatch(rails, p.rail, Math.max(1, 3 * pxPerMetre * ROAD_SCALE), 'rail');
    }
    ctx.setLineDash([]);

    //Building footprints under the 3D prisms.
    if (!hide('building'))
    {
        for (const f of layerFeatures('building'))
        {
            if (!f.line)
            {
                fillFeature(f, p.building);
            }
        }
    }

    //Admin boundaries (dashed, thin).
    if (!hide('boundary'))
    {
        ctx.setLineDash([Math.max(3, 2 * pxPerMetre), Math.max(3, 2 * pxPerMetre)]);
        const boundaries = layerFeatures('boundary').filter((f) => f.line);
        strokeBatch(boundaries, p.boundary, Math.max(1, 1.2 * pxPerMetre * ROAD_SCALE), 'boundary');
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
    //which is the degraded mode certain Android GPUs fall into: their GPU-accelerated 2D canvas renders
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
    //Grouped once for this fetch's lifetime, reused by every repaint (theme change, or every camera move on
    //the projected compat path) below.
    const featuresByLayer = groupByLayer(features);

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
    //toPx above is fixed for this ground build's whole lifetime, so every feature's Path2D geometry through it
    //is too - only the paint cache created below actually reuses that fact. NEVER passed to repaintProjected,
    //whose own toScreen (via the camera) changes every frame.
    const paintCache: PaintCache = { fills: new Map(), strokes: new Map(), strokeBuckets: new Map() };
    const repaint = (st: GroundStyle, alt: number): void =>
    {
        if (ctx)
        {
            paint(ctx, size, size, featuresByLayer, toPx, pxPerMetre, st, alt, undefined, paintCache);
        }
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
        if (!ctx)
        {
            return;
        }
        if (el.width !== w || el.height !== h)
        {
            el.width = w; el.height = h;
        }

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
                if (c === 0 && s === 0)
                {
                    landPath.moveTo(q[0], q[1]);
                }
                else
                {
                    landPath.lineTo(q[0], q[1]);
                }
            }
        }
        landPath.closePath();

        paint(ctx, w, h, featuresByLayer, toScreen, pxPerMetre, st, alt, landPath);

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

    return { ground: { el, fade, homeX, homeY, size }, repaint, repaintProjected };
}
