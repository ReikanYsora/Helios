//Common interface and registry for country-specific LiDAR providers.
//
//Adding a country = drop a new file under ./helios-lidar/ that exports
//a LidarSource and register it in LIDAR_SOURCES below. No engine-side
//changes needed.
//
//Pipeline overview: when the user has shadows enabled AND a provider
//covers the home, the engine calls fetchShadowRegions() with the home
//position and a radius. The provider fetches a height raster around
//the home, runs a size-capped 8-connected flood fill on the cells
//above the height threshold, and emits one convex-hull Polygon per
//capped clump with `render_height` set to the clump's mean cell
//height. Those polygons feed projectExtrusionShadows() exactly like
//the OpenFreeMap building footprints do when LiDAR is unavailable.
//Capping the
//clump area keeps a dense forest from collapsing into one giant
//blanket shadow while preserving the organic, non-grid-aligned
//shape of a convex hull.

export interface LidarSource
{
    //Stable identifier, lowercased and country-prefixed. Goes into
    //logs.
    id:    string;
    //Human-readable label, currently logs-only.
    name:  string;

    //Cheap synchronous coverage probe. Implementations should bail
    //fast (a couple of bbox comparisons) so the engine can call this
    //on every home-position change without measurable cost.
    covers(lat: number, lon: number): boolean;

    //Fetch shadow regions around the home as a FeatureCollection of
    //bin polygons with render_height set per bin, together with a
    //small diagnostics bag the engine surfaces through
    //`window.heliosStats()`. Returns an empty collection on network
    //failure, out-of-coverage bbox or empty raster, so the caller
    //can always use the result unconditionally.
    fetchShadowRegions(opts: LidarShadowFetchOptions): Promise<LidarShadowResult>;
}

export interface LidarShadowResult
{
    features:    GeoJSON.FeatureCollection;
    diagnostics:
    {
        //Number of LiDAR cells that passed the height threshold and
        //the circular crop. 0 when the home is outside coverage or
        //the WMS round-trip failed.
        cellsKept:   number;
        //Cells-per-clump cap actually used (derived from the chosen
        //precision). Surfaced so the user can confirm the size cap
        //matches expectations.
        cellsPerClumpCap: number;
        //Min / max kept height in metres. null when no cell passed.
        heightRangeM: [number, number] | null;
    };
}

export interface LidarShadowFetchOptions
{
    homeLat:                  number;
    homeLon:                  number;
    //Radius in metres around the home from which heights are sampled.
    //The provider over-fetches slightly so trees on the edge still
    //cast their shadow inward.
    radiusMeters:             number;
    //Pixel count per side requested from the upstream raster. The
    //engine picks this based on the user's `lidar-precision`.
    rasterSize:               number;
    //Optional circular crop. Cells beyond this distance from the
    //home are dropped so the shadow zones stay inside the visible
    //disc. When unset, the bbox is the only bound.
    cropRadiusMeters?:        number;
    signal?:                  AbortSignal;
}

import { franceLidarHd }       from './helios-lidar/providers/helios-lidar-fr';
import { englandLidarComposite } from './helios-lidar/providers/helios-lidar-uk';
import { spainPnoaLidar }       from './helios-lidar/providers/helios-lidar-es';
import { netherlandsAhn4 }      from './helios-lidar/providers/helios-lidar-nl';
import { norwayKartverketNhm }  from './helios-lidar/providers/helios-lidar-no';
import {
    createLocalNdsmSource,
    type LocalNdsmConfig
} from './helios-lidar/helios-lidar-local-ndsm';
import type { HeliosConfig } from './helios-engine';

//Registered providers, ordered by preference. The first provider
//whose covers() probe accepts the home position wins. Bbox checks
//are non-overlapping today (one country per provider) but the
//ordering is conservative: France first because that's the only
//provider with a single-fetch normalised raster (BIL float32, no
//GeoTIFF parse, no DSM-DTM subtraction round-trip).
export const LIDAR_SOURCES: LidarSource[] = [
    franceLidarHd,
    englandLidarComposite,
    spainPnoaLidar,
    netherlandsAhn4,
    norwayKartverketNhm
];

export function findLidarSource(lat: number, lon: number): LidarSource | null
{
    for (const src of LIDAR_SOURCES)
    {
        if (src.covers(lat, lon)) return src;
    }
    return null;
}

//Read the six `lidar-local-ndsm-*` keys off a HeliosConfig and either
//return a fully-typed LocalNdsmConfig (when every required field is
//valid) or null (when the provider is disabled, the URL is missing,
//or any bbox value is missing / non-finite / out of EPSG:4326 range /
//ordered wrong). Never throws; invalid local-provider config never
//invalidates the rest of the card config.
export function validateLocalNdsmConfig(cfg: HeliosConfig | undefined | null): LocalNdsmConfig | null
{
    if (!cfg) return null;
    if (cfg['lidar-local-ndsm-enabled'] !== true) return null;

    const rawUrl = cfg['lidar-local-ndsm-url'];
    if (typeof rawUrl !== 'string') return null;
    const url = rawUrl.trim();
    if (url.length === 0) return null;

    const minLat = numFromCfg(cfg['lidar-local-ndsm-min-lat']);
    const maxLat = numFromCfg(cfg['lidar-local-ndsm-max-lat']);
    const minLon = numFromCfg(cfg['lidar-local-ndsm-min-lon']);
    const maxLon = numFromCfg(cfg['lidar-local-ndsm-max-lon']);
    if (minLat === null || maxLat === null || minLon === null || maxLon === null) return null;

    if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) return null;
    if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180) return null;
    if (!(minLat < maxLat)) return null;
    if (!(minLon < maxLon)) return null;

    return { url, minLat, maxLat, minLon, maxLon };
}

function numFromCfg(v: unknown): number | null
{
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string')
    {
        const s = v.trim();
        if (s.length === 0) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

//One-shot warning latch. When the user enables the local provider
//but leaves the config incomplete or invalid, log exactly once per
//session so the silent fall-through is diagnosable without spamming
//the console on every shadow refresh.
let _warnedInvalidLocalNdsm = false;

//Config-aware provider resolver. Behaviour:
//
//  1. When the local-nDSM config validates, construct a per-config
//     LocalNdsmSource and return it if it covers (lat, lon). This
//     takes precedence over any public provider that would otherwise
//     match the same point.
//  2. Otherwise (no local config, or local config does not cover the
//     point) fall back to the existing static LIDAR_SOURCES chain
//     via findLidarSource().
//
//findLidarSource() and the static LIDAR_SOURCES list are unchanged
//and still exported for any caller that does not need config-aware
//resolution.
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
        if (local.covers(lat, lon)) return local;
    }

    return findLidarSource(lat, lon);
}
