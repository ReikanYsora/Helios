//Common interface and registry for country-specific LiDAR providers.
//
//Adding a country = drop a new file under ./lidar/providers/ that exports a
//LidarSource and register it in LIDAR_SOURCES below; no engine-side changes needed.
//
//Pipeline: with shadows enabled and a provider covering the home, the engine calls
//fetchShadowRegions() with the home position and a radius. The provider fetches a
//height raster, runs a size-capped 8-connected flood fill on cells above the height
//threshold, and emits one convex-hull Polygon per capped clump with `render_height`
//set to the clump's mean height. Those polygons feed projectExtrusionShadows() just
//like the OpenFreeMap building footprints do when LiDAR is unavailable. Capping the
//clump area keeps a dense forest from collapsing into one giant blanket shadow while
//preserving the organic, non-grid-aligned shape of a convex hull.

export interface LidarSource
{
    //Stable identifier, lowercased and country-prefixed. Goes into logs.
    id:    string;
    //Human-readable label, currently logs-only.
    name:  string;

    //Native cell pitch (metres) of the upstream raster as published by the data
    //owner. The engine sizes the requested rasterSize off this so the grid matches
    //real source samples instead of forcing server interpolation: "high" asks one
    //cell per native sample, "medium" one per 2, "low" one per 4.
    nativeCellPitchMeters: number;

    //Cheap synchronous coverage probe. Must bail fast (a couple of bbox comparisons)
    //since the engine calls it on every home-position change.
    covers(lat: number, lon: number): boolean;

    //Fetch shadow regions around the home as a FeatureCollection of bin polygons
    //(render_height set per bin) plus a diagnostics bag surfaced via
    //`window.heliosStats()`. Returns an empty collection on network failure,
    //out-of-coverage bbox or empty raster, so the caller can use the result
    //unconditionally.
    fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>;
}

export interface LidarShadowResult
{
    features:    GeoJSON.FeatureCollection;
    diagnostics:
    {
        //Cells that passed the height threshold and circular crop. 0 when the home
        //is outside coverage or the WMS round-trip failed.
        cellsKept:   number;
        //Cells-per-clump cap actually used (derived from precision); surfaced so the
        //user can confirm it matches expectations.
        cellsPerClumpCap: number;
        //Min / max kept height in metres. null when no cell passed.
        heightRangeM: [number, number] | null;
    };
    //Raw height raster + geo, forwarded by every provider so the engine can keep it
    //for the LiDAR View overlay (which projects every cell, threshold-bypassed, to
    //screen). Always populated on a successful fetch; consumers that only care about
    //cast shadows can ignore it.
    raster?:
    {
        heights:    Float32Array;
        //Optional DTM band (ground elevation in the source vertical datum, NaN where
        //no-data). Populated by the local-nDSM provider when it reads a 2-band COG;
        //absent on legacy single-band COGs and on every public provider (their WCS
        //layers only expose the nDSM). The pv-shading.ts ray-march falls back to
        //flat-ground geometry when this is undefined, so the two paths coexist
        //without a flag.
        terrain?:   Float32Array;
        rasterSize: number;
        minLat:     number;
        maxLat:     number;
        minLon:     number;
        maxLon:     number;
    };
}

export interface LidarShadowFetchOptions
{
    homeLat:                  number;
    homeLon:                  number;
    //Radius (metres) around the home from which heights are sampled. The provider
    //over-fetches slightly so edge trees still cast their shadow inward.
    radiusMeters:             number;
    //Pixel count per side requested from the upstream raster; engine picks it from
    //the user's `lidar-precision`.
    rasterSize:               number;
    //Optional circular crop: cells beyond this distance from the home are dropped so
    //shadow zones stay inside the visible disc. When unset, the bbox is the only bound.
    cropRadiusMeters?:        number;
    signal?:                  AbortSignal;
}

import { franceLidarHd }              from './lidar/providers/fr';
import { englandLidarComposite }       from './lidar/providers/uk';
import { spainPnoaLidar }              from './lidar/providers/es';
import { netherlandsAhn4 }             from './lidar/providers/nl';
import { norwayKartverketNhm }         from './lidar/providers/no';
import { nrwLidarNdom }                from './lidar/providers/de-nrw';
import { polandGugikNmpt }             from './lidar/providers/pl';
import { canadaHrdem }                 from './lidar/providers/ca';
import { brandenburgBerlinDom }        from './lidar/providers/de-bb-be';
import { vermontVcgiNdsm }             from './lidar/providers/us-vt';
//Baden-Württemberg, Austria Tirol, Austria Steiermark and Belgium Flanders source
//files (de-bw, at-tirol, at-stmk, be-fl) live under ./lidar/providers/ and remain
//functional but are NOT registered: their DSM-DTM subtraction quality was judged
//below the nDSM providers' bar (per-pixel subtraction amplifies noise on building
//edges and over vegetation, rendering shadows as blobs instead of recognisable
//footprints). Re-enable by importing + appending to LIDAR_SOURCES once a cleaner
//data path exists.
import {
    createLocalNdsmSource,
    type LocalNdsmConfig
} from './lidar/local-ndsm';
import type { HeliosConfig } from '../helios-config';

//Registered providers, ordered by preference. findLidarSource() returns the FIRST
//provider whose covers() probe accepts the home; there is no fallback when the fetch
//turns up no-data, so order is load-bearing whenever two providers' bboxes overlap.
//Bbox checks today are non-overlapping (one country/region per provider, German
//Länder keyed by state bboxes). Single-fetch normalised-raster providers (France BIL,
//NRW nDOM, Poland NMPT, Canada HRDEM DSM, Vermont nDSM) come first because they skip
//the DSM-DTM subtraction round-trip; subtraction providers follow.
export const LIDAR_SOURCES: LidarSource[] = [
    franceLidarHd,
    nrwLidarNdom,
    polandGugikNmpt,
    canadaHrdem,
    vermontVcgiNdsm,
    englandLidarComposite,
    spainPnoaLidar,
    netherlandsAhn4,
    norwayKartverketNhm,
    brandenburgBerlinDom
];

export function findLidarSource(lat: number, lon: number): LidarSource | null
{
    for (const src of LIDAR_SOURCES)
    {
        if (src.covers(lat, lon))
        {
            return src;
        }
    }
    return null;
}

//Read the six `lidar-local-ndsm-*` keys off a HeliosConfig and return a fully-typed
//LocalNdsmConfig (every required field valid) or null (provider disabled, URL missing,
//or any bbox value missing / non-finite / out of EPSG:4326 range / mis-ordered).
//Never throws: invalid local-provider config never invalidates the rest of the config.
export function validateLocalNdsmConfig(cfg: HeliosConfig | undefined | null): LocalNdsmConfig | null
{
    if (!cfg)
    {
        return null;
    }
    if (cfg['lidar-local-ndsm-enabled'] !== true)
    {
        return null;
    }

    const rawUrl = cfg['lidar-local-ndsm-url'];
    if (typeof rawUrl !== 'string')
    {
        return null;
    }
    const url = rawUrl.trim();
    if (url.length === 0)
    {
        return null;
    }

    const minLat = numFromCfg(cfg['lidar-local-ndsm-min-lat']);
    const maxLat = numFromCfg(cfg['lidar-local-ndsm-max-lat']);
    const minLon = numFromCfg(cfg['lidar-local-ndsm-min-lon']);
    const maxLon = numFromCfg(cfg['lidar-local-ndsm-max-lon']);
    if (minLat === null || maxLat === null || minLon === null || maxLon === null)
    {
        return null;
    }

    if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90)
    {
        return null;
    }
    if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180)
    {
        return null;
    }
    if (!(minLat < maxLat))
    {
        return null;
    }
    if (!(minLon < maxLon))
    {
        return null;
    }

    return { url, minLat, maxLat, minLon, maxLon };
}

function numFromCfg(v: unknown): number | null
{
    if (typeof v === 'number' && Number.isFinite(v))
    {
        return v;
    }
    if (typeof v === 'string')
    {
        const s = v.trim();
        if (s.length === 0)
        {
            return null;
        }
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

//One-shot warning latches: log each silent fall-through exactly once per session so
//it stays diagnosable without spamming the console on every shadow refresh. Cases:
//invalid/incomplete local config, and bbox valid but not covering the home (typical
//lat/lon swap).
let _warnedInvalidLocalNdsm = false;
let _warnedBboxDoesNotCoverHome = false;

//Config-aware provider resolver:
//  1. When the local-nDSM config validates, build a per-config LocalNdsmSource and
//     return it if it covers (lat, lon). Takes precedence over any matching public
//     provider.
//  2. Otherwise fall back to the static LIDAR_SOURCES chain via findLidarSource().
//findLidarSource() and LIDAR_SOURCES stay unchanged and exported for callers that
//don't need config-aware resolution.
export function resolveLidarSource(
    lat: number,
    lon: number,
    cfg: HeliosConfig | undefined | null
): LidarSource | null
{
    const localCfg = validateLocalNdsmConfig(cfg);

    if (cfg && cfg['lidar-local-ndsm-enabled'] === true && localCfg === null)
    {
        if (!_warnedInvalidLocalNdsm)
        {
            _warnedInvalidLocalNdsm = true;
            console.warn(
                '[HELIOS] lidar-local-ndsm-enabled is true but the local nDSM '
              + 'config is incomplete or invalid; falling back to public LiDAR '
              + 'providers and the OpenFreeMap building-footprint mask. '
              + 'Required keys: lidar-local-ndsm-url plus the four '
              + 'lidar-local-ndsm-{min,max}-{lat,lon} bbox values in EPSG:4326.'
            );
        }
    }

    if (localCfg)
    {
        const local = createLocalNdsmSource(localCfg);
        if (local.covers(lat, lon))
        {
            return local;
        }
        //Bbox validates but the home is OUTSIDE the rectangle. Most common cause is a
        //lat/lon swap (longitudes pasted into *-lat keys and vice versa, both pass the
        //bare range check). Surface the actual numbers so the user can spot the swap
        //from the console.
        if (!_warnedBboxDoesNotCoverHome)
        {
            _warnedBboxDoesNotCoverHome = true;
            console.warn(
                '[HELIOS] local-nDSM bbox does not cover the home, falling back to public providers.\n'
              + '  home:     lat ' + lat.toFixed(5) + ', lon ' + lon.toFixed(5) + '\n'
              + '  bbox lat: [' + localCfg.minLat + ', ' + localCfg.maxLat + ']\n'
              + '  bbox lon: [' + localCfg.minLon + ', ' + localCfg.maxLon + ']\n'
              + '  If the lat / lon ranges look swapped (latitudes in the lon fields or vice versa), '
              + 'check the four lidar-local-ndsm-{min,max}-{lat,lon} keys.'
            );
        }
    }

    return findLidarSource(lat, lon);
}
