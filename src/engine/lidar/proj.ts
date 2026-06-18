//Tiny client-side cartographic projection for the few WCS providers that refuse
//EPSG:4326 axis-label subsetting and require their native national projection
//(Belgian Lambert 72, Austrian MGI Gauss-Krüger, German UTM zones, etc.).
//
//Forward-only (lat/lon -> easting/northing in metres): we never need the inverse
//since the WCS raster aligned to our projected bbox is reinterpreted as covering
//the original lat/lon bbox. At ~200 m query radii the corner distortion is
//sub-metre, below the raster pitch, so the approximation is invisible.
//
//Uses EPSG-recommended formulas for Transverse Mercator (UTM + Austrian
//Gauss-Krüger) and Lambert Conformal Conic 2SP (Belgian Lambert 72). Datum
//shifts are applied where they matter (see below); for MGI an unhandled
//Bessel-vs-WGS84 residual of ~10 m just offsets the home from the raster centre
//without losing data, fine at metre scale.
//
//Adding a projection = define an EpsgEntry in EPSG_REGISTRY below.

const DEG = Math.PI / 180;

//----------------------------------------------------------------- ellipsoids

interface Ellipsoid
{
    //Semi-major axis in metres.
    a: number;
    //Flattening 1/f as a fraction (not the inverse). e.g. WGS84 ~0.0034.
    f: number;
}

const WGS84:    Ellipsoid = { a: 6378137.0,    f: 1 / 298.257223563 };
//Bessel 1841 (used by Austrian MGI datum and German DHDN).
const BESSEL:   Ellipsoid = { a: 6377397.155,  f: 1 / 299.1528128   };
//GRS80 (ETRS89 / UTM ETRS); identical to WGS84 for our purposes but kept
//distinct for self-documentation.
const GRS80:    Ellipsoid = { a: 6378137.0,    f: 1 / 298.257222101 };
//International 1924 (Hayford), used by Belgian BD72 datum.
const HAYFORD:  Ellipsoid = { a: 6378388.0,    f: 1 / 297.0          };


//----------------------------------------------------------------- datum

//3-parameter (Bursa-Wolf simplified) datum shift applied BEFORE projecting WGS84
//lat/lon to a national projection on a different datum. For BD72, skipping it
//introduces an 80-190 m offset (home drifts off the raster); with it we land
//within ~3 m, invisible at our 0.5-1 m pitch.
//
//Values are the WGS84 -> target_datum translation in metres, i.e. the negation
//of the conventional target_datum -> WGS84 shift published by national agencies.
interface DatumShift
{
    tx: number;
    ty: number;
    tz: number;
}

//BD72 (Belgian Datum 72). Inverse of the conventional BD72 -> WGS84 shift
//(-106.869, +52.297, -103.724).
const SHIFT_BD72:  DatumShift = { tx:  106.869, ty: -52.297, tz:  103.724 };
//MGI (Austrian National). Inverse 3-param translation of the conventional MGI ->
//WGS84 7-param; the dropped rotation residual (~5 m) stays below the Austrian
//services' 5 m pitch.
const SHIFT_MGI:   DatumShift = { tx: -577.326, ty: -90.129, tz: -463.919 };


//Geographic (lat, lon, h=0) on a given ellipsoid -> geocentric Cartesian
//(X, Y, Z) in metres. First leg of a datum shift.
function geoToEcef(latDeg: number, lonDeg: number, ell: Ellipsoid): [number, number, number]
{
    const phi = latDeg * DEG;
    const lam = lonDeg * DEG;
    const e2  = 2 * ell.f - ell.f * ell.f;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const N = ell.a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
    return [
        N * cosPhi * Math.cos(lam),
        N * cosPhi * Math.sin(lam),
        N * (1 - e2) * sinPhi
    ];
}

//Inverse of geoToEcef via Bowring iteration (sub-mm in 1 pass for sensible
//inputs). We only use the lat/lon; height comes out near zero (sub-cm) after a
//datum translation between two sea-level-fitted ellipsoids.
function ecefToGeo(x: number, y: number, z: number, ell: Ellipsoid): [number, number]
{
    const e2 = 2 * ell.f - ell.f * ell.f;
    const lon = Math.atan2(y, x);
    const p   = Math.sqrt(x * x + y * y);
    //Initial latitude estimate assuming spherical.
    let phi = Math.atan2(z, p * (1 - e2));
    for (let i = 0; i < 4; i++)
    {
        const sinPhi = Math.sin(phi);
        const N      = ell.a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
        const h      = p / Math.cos(phi) - N;
        phi          = Math.atan2(z, p * (1 - e2 * N / (N + h)));
    }
    return [phi / DEG, lon / DEG];
}

//WGS84 lat/lon -> target-datum lat/lon via 3-param Cartesian shift; output feeds
//straight into the projection formula for the target datum's ellipsoid.
function shiftDatum(
    latDeg:   number,
    lonDeg:   number,
    srcEll:   Ellipsoid,
    dstEll:   Ellipsoid,
    shift:    DatumShift
): [number, number]
{
    const [x, y, z] = geoToEcef(latDeg, lonDeg, srcEll);
    return ecefToGeo(x + shift.tx, y + shift.ty, z + shift.tz, dstEll);
}

//----------------------------------------------------------------- methods

//Transverse Mercator forward (EPSG method 9807). Returns [easting, northing] in
//metres; sub-cm within a UTM zone, which covers everything we care about.
function tmForward(
    latDeg: number,
    lonDeg: number,
    params:
    {
        lat0Deg: number;
        lon0Deg: number;
        k0:      number;
        fe:      number;
        fn:      number;
        ell:     Ellipsoid;
    }
): { x: number; y: number }
{
    const { lat0Deg, lon0Deg, k0, fe, fn, ell } = params;
    const { a, f } = ell;
    const e2  = 2 * f - f * f;

    const phi    = latDeg * DEG;
    const phi0   = lat0Deg * DEG;
    const dLam   = (lonDeg - lon0Deg) * DEG;

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const tanPhi = Math.tan(phi);

    const T = tanPhi * tanPhi;
    const C = (e2 / (1 - e2)) * cosPhi * cosPhi;
    const A = dLam * cosPhi;

    const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);

    //Meridian arc length M at latitude phi, and at the origin phi0.
    const arc = (p: number): number =>
    {
        return a * (
            (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * p
            - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * p)
            + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024)           * Math.sin(4 * p)
            - (35 * e2 * e2 * e2 / 3072)                                 * Math.sin(6 * p)
        );
    };
    const M  = arc(phi);
    const M0 = arc(phi0);

    const A2 = A * A;
    const A3 = A2 * A;
    const A4 = A2 * A2;
    const A5 = A4 * A;
    const A6 = A3 * A3;

    const x = fe + k0 * N * (
        A
        + (1 - T + C)                                                * A3 / 6
        + (5 - 18 * T + T * T + 72 * C - 58 * e2)                    * A5 / 120
    );
    const y = fn + k0 * (
        M - M0 + N * tanPhi * (
            A2 / 2
            + (5 - T + 9 * C + 4 * C * C)                            * A4 / 24
            + (61 - 58 * T + T * T + 600 * C - 330 * e2)             * A6 / 720
        )
    );

    return { x, y };
}


//Lambert Conformal Conic 2SP forward (EPSG method 9802). Returns [easting,
//northing] in metres, <1 m within the standard zone. Used by Belgian Lambert 72
//(lat1=49.833, lat2=51.167, lat0=90, lon0=4.367, FE=150000.013, FN=5400088.438).
function lccForward(
    latDeg: number,
    lonDeg: number,
    params:
    {
        lat1Deg: number;
        lat2Deg: number;
        lat0Deg: number;
        lon0Deg: number;
        fe:      number;
        fn:      number;
        ell:     Ellipsoid;
    }
): { x: number; y: number }
{
    const { lat1Deg, lat2Deg, lat0Deg, lon0Deg, fe, fn, ell } = params;
    const { a, f } = ell;
    const e2  = 2 * f - f * f;
    const e   = Math.sqrt(e2);

    const phi1 = lat1Deg * DEG;
    const phi2 = lat2Deg * DEG;
    const phi0 = lat0Deg * DEG;
    const lam0 = lon0Deg * DEG;

    const phi  = latDeg * DEG;
    const lam  = lonDeg * DEG;

    const m = (p: number): number => Math.cos(p) / Math.sqrt(1 - e2 * Math.sin(p) * Math.sin(p));
    const t = (p: number): number =>
    {
        const esinp = e * Math.sin(p);
        return Math.tan(Math.PI / 4 - p / 2) / Math.pow((1 - esinp) / (1 + esinp), e / 2);
    };

    const m1 = m(phi1);
    const m2 = m(phi2);
    const t0 = t(phi0);
    const t1 = t(phi1);
    const t2 = t(phi2);
    const tp = t(phi);

    const n  = (Math.log(m1) - Math.log(m2)) / (Math.log(t1) - Math.log(t2));
    const F  = m1 / (n * Math.pow(t1, n));
    const r  = a * F * Math.pow(tp, n);
    const r0 = a * F * Math.pow(t0, n);

    const theta = n * (lam - lam0);

    const x = fe + r * Math.sin(theta);
    const y = fn + r0 - r * Math.cos(theta);

    return { x, y };
}


//----------------------------------------------------------------- registry

export interface ProjectedBbox
{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface EpsgEntry
{
    //EPSG numeric code, used as the lookup key.
    code: number;
    //EPSG URN suffix the WCS expects in SUBSETTINGCRS / OUTPUTCRS; always the
    //full http://www.opengis.net/def/crs/EPSG/0/<code>.
    urn:  string;
    //Forward projection: lat/lon in degrees -> projected coords in metres.
    project(latDeg: number, lonDeg: number): { x: number; y: number };
}

//Belgian Lambert 72 (EPSG:31370), used by Belgium and the Flanders WCS. The
//Wallonia WCS also exposes it but serves only rendered RGB rasters, so we don't
//dispatch through here for that province.
const epsg_31370: EpsgEntry =
{
    code:  31370,
    urn:   'http://www.opengis.net/def/crs/EPSG/0/31370',
    project: (lat, lon) =>
    {
        const [latBd, lonBd] = shiftDatum(lat, lon, WGS84, HAYFORD, SHIFT_BD72);
        return lccForward(latBd, lonBd,
        {
            lat1Deg: 49.8333339,
            lat2Deg: 51.1666672333,
            lat0Deg: 90.0,
            lon0Deg: 4.3674866666666666666,
            fe:      150000.013,
            fn:      5400088.438,
            ell:     HAYFORD
        });
    }
};

//ETRS89 / UTM zone N factory (Helios touches several zones; Germany uses 32N
//west/centre and 33N east). Central meridian lon = 6*N - 183, k0=0.9996, false
//easting 500000, false northing 0 (northern hemisphere).
function makeUtmEntry(zone: number, ell: Ellipsoid, code: number, urn: string): EpsgEntry
{
    const cm = 6 * zone - 183;
    return {
        code,
        urn,
        project: (lat, lon) => tmForward(lat, lon,
        {
            lat0Deg: 0,
            lon0Deg: cm,
            k0:      0.9996,
            fe:      500000,
            fn:      0,
            ell
        })
    };
}

//EPSG:25832 = ETRS89 / UTM zone 32N (GRS80). German states west of
//Thuringia/Saxony; Baden-Württemberg's WCS axis labels are E/N.
const epsg_25832: EpsgEntry = makeUtmEntry(32, GRS80, 25832,
    'http://www.opengis.net/def/crs/EPSG/0/25832');

//EPSG:25833 = ETRS89 / UTM zone 33N. Eastern German states.
const epsg_25833: EpsgEntry = makeUtmEntry(33, GRS80, 25833,
    'http://www.opengis.net/def/crs/EPSG/0/25833');

//EPSG:32633 = WGS84 / UTM zone 33N. Steiermark's terrain WCS (the legacy MGI
//Gauss-Krüger M34 zone was retired for UTM). Same math as 25833, different EPSG
//ID and ellipsoid.
const epsg_32633: EpsgEntry = makeUtmEntry(33, WGS84, 32633,
    'http://www.opengis.net/def/crs/EPSG/0/32633');

//EPSG:31254 = MGI / Austria GK West (M28, central meridian 10.333°), used by
//Tirol's terrain WCS. Native datum is MGI on Bessel; feeding WGS84 directly
//adds ~10 m horizontal offset, below the 5 m raster pitch.
const epsg_31254: EpsgEntry =
{
    code:  31254,
    urn:   'http://www.opengis.net/def/crs/EPSG/0/31254',
    project: (lat, lon) =>
    {
        const [latMgi, lonMgi] = shiftDatum(lat, lon, WGS84, BESSEL, SHIFT_MGI);
        return tmForward(latMgi, lonMgi,
        {
            lat0Deg: 0,
            lon0Deg: 10.333333333,
            k0:      1.0,
            fe:      0,
            fn:      -5000000,
            ell:     BESSEL
        });
    }
};

//EPSG:31256 = MGI / Austria GK Central (M31, central meridian 13.333°).
//Salzburg / Upper Austria. Reserved for future providers.
const epsg_31256: EpsgEntry =
{
    code:  31256,
    urn:   'http://www.opengis.net/def/crs/EPSG/0/31256',
    project: (lat, lon) =>
    {
        const [latMgi, lonMgi] = shiftDatum(lat, lon, WGS84, BESSEL, SHIFT_MGI);
        return tmForward(latMgi, lonMgi,
        {
            lat0Deg: 0,
            lon0Deg: 13.333333333,
            k0:      1.0,
            fe:      0,
            fn:      -5000000,
            ell:     BESSEL
        });
    }
};

const REGISTRY = new Map<number, EpsgEntry>();
for (const e of [epsg_31370, epsg_25832, epsg_25833, epsg_32633, epsg_31254, epsg_31256])
{
    REGISTRY.set(e.code, e);
}


//----------------------------------------------------------------- API

//Look up a registered EPSG entry; undefined if absent. Callers should fail soft
//(skip the fetch) so an outdated provider doesn't crash the engine.
export function getEpsg(code: number): EpsgEntry | undefined
{
    return REGISTRY.get(code);
}

//Project a lat/lon bbox to the target EPSG's native metric coords by projecting
//all four corners and taking the axis-aligned envelope. That envelope is
//slightly larger than the original lat/lon rectangle (the projected rectangle is
//rotated relative to the grid); the WCS raster covering it is then treated as
//covering the original bbox, the ~0.1% stretch being invisible in the output.
export function projectBbox(
    bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    entry: EpsgEntry
): ProjectedBbox
{
    const corners = [
        entry.project(bbox.minLat, bbox.minLon),
        entry.project(bbox.minLat, bbox.maxLon),
        entry.project(bbox.maxLat, bbox.minLon),
        entry.project(bbox.maxLat, bbox.maxLon)
    ];

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const c of corners)
    {
        if (c.x < minX)
        {
            minX = c.x;
        }
        if (c.x > maxX)
        {
            maxX = c.x;
        }
        if (c.y < minY)
        {
            minY = c.y;
        }
        if (c.y > maxY)
        {
            maxY = c.y;
        }
    }

    return { minX, minY, maxX, maxY };
}
