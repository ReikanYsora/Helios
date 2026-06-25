//Ground-projected shadow polygons. MapLibre 5 has no native cast-shadow for
//fill-extrusion layers, so we compute them in JS each timeline tick: offset each
//footprint's vertices by (h / tan(alt)) in the opposite-of-sun direction and emit the
//convex hull of (original, projected) as a flat Polygon. The 3D extrusion hides the
//under-feature part at render time, leaving only the ground shadow visible.

const M_PER_DEG_LAT = 111_320;

export interface ProjectShadowsOptions
{
    //Compass azimuth, degrees clockwise from north (matches getSunPosition).
    sunAzimuthDeg:    number;
    //Altitude above horizon (deg). Below minAltitudeDeg the projector returns an empty FeatureCollection.
    sunAltitudeDeg:   number;
    //Reference latitude for metres-to-degrees-of-longitude; cos(lat) is constant over a card's bbox.
    homeLat:          number;
    //Drop features whose effective height is below this. Default 2 m.
    minHeightM?:      number;
    //Sun-altitude cut-off below which we emit nothing. Default 1.5 deg (below that, shadows
    //run hundreds of metres and the night-shade overlay already conveys "it's dark").
    minAltitudeDeg?:  number;
    //Optional clip-to-disc. When all three are set, every polygon is clipped against a
    //circle of clipRadiusMeters around (clipCenterLat, clipCenterLon), to keep cast
    //shadows within the building visibility radius (consistent with the extrusion clip).
    clipCenterLat?:   number;
    clipCenterLon?:   number;
    clipRadiusMeters?: number;
}

export function projectExtrusionShadows(
    extrusions: GeoJSON.FeatureCollection,
    opts:       ProjectShadowsOptions
): GeoJSON.FeatureCollection
{
    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

    const minAlt = opts.minAltitudeDeg ?? 1.5;
    if (opts.sunAltitudeDeg <= minAlt)
    {
        return empty;
    }

    const D    = Math.PI / 180;
    const azR  = opts.sunAzimuthDeg  * D;
    const altR = opts.sunAltitudeDeg * D;

    //Shadow direction = opposite of the sun on the ground plane (compass: x = east, y = north).
    const shadowDx = -Math.sin(azR);
    const shadowDy = -Math.cos(azR);

    const tanAlt     = Math.tan(altR);
    const mPerDegLon = M_PER_DEG_LAT * Math.cos(opts.homeLat * D);
    const minH       = opts.minHeightM ?? 2;

    //Build the clip polygon once per (clip center, radius) tuple, cached across calls: the
    //disc and Sutherland-Hodgman edge vectors don't depend on sun position (see getClipBundle).
    const clipBundle = (
        typeof opts.clipCenterLat   === 'number'
     && typeof opts.clipCenterLon   === 'number'
     && typeof opts.clipRadiusMeters === 'number'
     && opts.clipRadiusMeters > 0
    )
        ? getClipBundle(opts.clipCenterLat, opts.clipCenterLon, opts.clipRadiusMeters)
        : null;

    const out: GeoJSON.Feature[] = [];

    for (const feat of extrusions.features)
    {
        const geom = feat.geometry;
        if (!geom)
        {
            continue;
        }

        const props = (feat.properties ?? {}) as Record<string, unknown>;
        const top   = typeof props['render_height']     === 'number' ? props['render_height']     as number : 0;
        const base  = typeof props['render_min_height'] === 'number' ? props['render_min_height'] as number : 0;
        const h     = Math.max(0, top - base);
        if (h < minH)
        {
            continue;
        }

        const lenM    = h / tanAlt;
        const dLatDeg = shadowDy * lenM / M_PER_DEG_LAT;
        const dLonDeg = shadowDx * lenM / mPerDegLon;

        //Defend against MultiPolygon for portability even though our pipelines only emit single-polygon Features.
        let polygons: number[][][][] | null = null;
        if (geom.type === 'Polygon')
        {
            polygons = [geom.coordinates as number[][][]];
        }
        else if (geom.type === 'MultiPolygon')
        {
            polygons = geom.coordinates as number[][][][];
        }
        if (!polygons)
        {
            continue;
        }

        for (const poly of polygons)
        {
            if (!poly.length)
            {
                continue;
            }
            const outer = poly[0] as number[][];
            if (outer.length < 3)
            {
                continue;
            }

            //One flat-opacity shadow polygon per casting region: the convex hull of
            //(original vertices + opposite-of-sun projections). The 3D extrusion covers the
            //under-feature part at render time, leaving only the ground spillover visible.
            const cloud: Array<[number, number]> = [];
            for (const p of outer)
            {
                const lon = p[0], lat = p[1];
                cloud.push([lon,            lat]);
                cloud.push([lon + dLonDeg,  lat + dLatDeg]);
            }
            const hull = convexHull(cloud);
            if (hull.length < 3)
            {
                continue;
            }

            //Optional clip-to-disc: a tall region near the edge can trail past the building
            //visibility radius, so confine visible shadows to the same disc as the buildings.
            let ring: Array<[number, number]> = hull;
            if (clipBundle)
            {
                const clipped = clipConvexPolygon(hull, clipBundle);
                if (clipped.length < 3)
                {
                    continue;
                }
                ring = clipped;
            }
            ring = ring.slice();
            ring.push([ring[0][0], ring[0][1]]);

            out.push({
                type:       'Feature',
                geometry:   { type: 'Polygon', coordinates: [ring] },
                properties: { render_height: h }
            });
        }
    }

    return { type: 'FeatureCollection', features: out };
}

//Cached approximation of the clip disc: the 64-vertex ring and per-edge dx/dy deltas
//never depend on the sun position, so we rebuild only when the center or radius changes.
interface ClipBundle
{
    ring: Array<[number, number]>;
    //Pre-baked edge vectors, indexed by edge i:
    //  dx[i] = ring[(i+1) % N].x - ring[i].x, dy[i] = ring[(i+1) % N].y - ring[i].y
    dx:   Float64Array;
    dy:   Float64Array;
}

let _clipBundleKey:    string | null = null;
let _clipBundleCache:  ClipBundle | null = null;

function getClipBundle(
    centerLat:     number,
    centerLon:     number,
    radiusMeters:  number
): ClipBundle
{
    const key = `${centerLat.toFixed(6)}|${centerLon.toFixed(6)}|${radiusMeters}`;
    if (key === _clipBundleKey && _clipBundleCache !== null)
    {
        return _clipBundleCache;
    }

    const segs    = 64;
    const D       = Math.PI / 180;
    const dLatDsc = radiusMeters / M_PER_DEG_LAT;
    const dLonDsc = radiusMeters / (M_PER_DEG_LAT * Math.cos(centerLat * D));
    const ring: Array<[number, number]> = new Array(segs);
    for (let i = 0; i < segs; i++)
    {
        const a = (i / segs) * 2 * Math.PI;
        ring[i] = [
            centerLon + Math.cos(a) * dLonDsc,
            centerLat + Math.sin(a) * dLatDsc
        ];
    }
    const dx = new Float64Array(segs);
    const dy = new Float64Array(segs);
    for (let i = 0; i < segs; i++)
    {
        const n = (i + 1) % segs;
        dx[i] = ring[n][0] - ring[i][0];
        dy[i] = ring[n][1] - ring[i][1];
    }
    _clipBundleKey   = key;
    _clipBundleCache = { ring, dx, dy };
    return _clipBundleCache;
}

//Sutherland-Hodgman polygon clip. `subject` is a non-closed CCW ring; `clip` is the
//pre-baked bundle from getClipBundle (CCW ring + per-edge direction vectors). Returns the
//intersection ring (non-closed, possibly empty). "Inside" = left-of-edge sign of the 2D cross.
function clipConvexPolygon(
    subject: Array<[number, number]>,
    clip:    ClipBundle
): Array<[number, number]>
{
    const ring = clip.ring;
    if (subject.length < 3 || ring.length < 3)
    {
        return [];
    }
    let output: Array<[number, number]> = subject.slice();

    const dxArr = clip.dx;
    const dyArr = clip.dy;

    for (let e = 0; e < ring.length; e++)
    {
        if (output.length === 0)
        {
            return [];
        }
        const e1x = ring[e][0];
        const e1y = ring[e][1];
        const edx = dxArr[e];
        const edy = dyArr[e];

        const input = output;
        output = [];

        for (let i = 0; i < input.length; i++)
        {
            const curr = input[i];
            const next = input[(i + 1) % input.length];
            //Cross of (edge_dir, point - e1). Positive = left of edge = inside for our CCW ring.
            const cCross = edx * (curr[1] - e1y) - edy * (curr[0] - e1x);
            const nCross = edx * (next[1] - e1y) - edy * (next[0] - e1x);
            const cIn = cCross >= 0;
            const nIn = nCross >= 0;
            if (cIn)
            {
                if (nIn)
                {
                    output.push(next);
                }
                else
                {
                    //Intersection of (curr,next) with the edge via the ratio cCross/(cCross-nCross).
                    const t = cCross / (cCross - nCross);
                    output.push([
                        curr[0] + t * (next[0] - curr[0]),
                        curr[1] + t * (next[1] - curr[1])
                    ]);
                }
            }
            else if (nIn)
            {
                const t = cCross / (cCross - nCross);
                output.push([
                    curr[0] + t * (next[0] - curr[0]),
                    curr[1] + t * (next[1] - curr[1])
                ]);
                output.push(next);
            }
        }
    }

    return output;
}

//Andrew's monotone chain. Returns vertices CCW, NOT closed. Used to wrap each consolidated shadow region.
export function convexHull(pts: Array<[number, number]>): Array<[number, number]>
{
    if (pts.length < 3)
    {
        return pts.slice();
    }

    const arr   = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

    const lower: Array<[number, number]> = [];
    for (const p of arr)
    {
        while (lower.length >= 2
            && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
        {
            lower.pop();
        }
        lower.push(p);
    }

    const upper: Array<[number, number]> = [];
    for (let i = arr.length - 1; i >= 0; i--)
    {
        const p = arr[i];
        while (upper.length >= 2
            && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
        {
            upper.pop();
        }
        upper.push(p);
    }

    lower.pop();
    upper.pop();
    return lower.concat(upper);
}
