import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { getSunPosition, computePvPower, computeIrradianceWm2 } from './engine/sun';
import { fetchHomePointData, clearWeatherCache, getWeatherFetchStats, RATE_LIMIT_BACKOFF_MS, OTHER_ERROR_BACKOFF_MS, type SampleHourly } from './engine/weather';
import { fetchBuildingsAroundHome, type BuildingsResult } from './engine/buildings';
import { projectExtrusionShadows } from './engine/shadows';
import { resolveLidarSource } from './engine/lidar';
import { RASTER_DEFAULTS } from './engine/lidar/pipeline';
import { LidarViewLayer } from './engine/lidar-view-layer';
import { WeatherCloudLayer } from './engine/weather-cloud-layer';
import { computeLidarCellExposureRows } from './engine/pv-shading';
import { startAutoRotateLoop } from './engine/auto-rotate';
import { setDetailMode as _setDetailMode } from './engine/detail-mode';
import { CAMERA_PITCH_MIN_DEG, CAMERA_PITCH_MAX_DEG, CAMERA_PITCH_REST_DEG } from './engine/camera-bounds';
import
{
    shadowRasterSizeFor,
    BLANK_SHADOW_DATA_URL,
    shadowBoundsCornersLL,
    paintShadowRaster,
    type ShadowBoundsCorners
} from './engine/shadow-raster';
import
{
    nightShadeForAltitude,
    buildingColorForAltitude,
    sunLightPolarFromAltitude
} from './engine/lighting';
import
{
    type HeliosConfig,
    type LidarPrecisionLevel,
    DISPLAY_FADE_DELTA_M,
    displayRadiusM,
    DEFAULT_BUILDING_OPACITY,
    DEFAULT_BUILDING_CLUSTER_RADIUS_M,
    DEFAULT_BUILDING_COLOR_HEX,
    DEFAULT_LIDAR_PRECISION,
    LIDAR_PRECISION_PITCH_MULT,
    DEFAULT_SHADOW_OPACITY,
    DEFAULT_LIDAR_VIEW_OPACITY,
} from './helios-config';


//Single ground-shadow layer, rendered as an image source rather
//than a fill layer. The shadow projector produces one polygon per
//casting region; the engine rasterises them onto an offscreen
//canvas at full black, the canvas becomes a MapLibre image source,
//and a raster layer paints it at `raster-opacity = shadow-opacity`.
//Per-pixel rendering avoids the alpha-compositing saturation that
//many overlapping fill polygons would produce in a dense forest
//(every pixel is either covered or not, never stacked twice).
export const SHADOW_LAYER_IDS: readonly string[] = [
    'helios-building-shadows'
];

//Lifecycle instrumentation. Counters live on window.__heliosStats
//so a user can inspect them at any point ("did this engine actually
//get torn down? how many setStyle calls did my last edit trigger?").
//Cheap, no I/O, only mutates a small object. Comparing the diff
//between a fresh page load and an after-edit snapshot is the
//cleanest path to identify which lifecycle path is accumulating
//under heavy editor activity.
interface HeliosStats
{
    enginesCreated:           number;
    enginesCleanedUp:         number;
    updateConfigCalls:        number;
    styleReloads:             number;
    addBuildingsCalls:        number;
    buildingFetchStarts:      number;
    contextLostEvents:        number;
}
function bumpStat(key: keyof HeliosStats): void
{
    if (typeof window === 'undefined')
    {
        return;
    }
    const w = window as unknown as { __heliosStats?: HeliosStats };
    if (!w.__heliosStats)
    {
        w.__heliosStats = {
            enginesCreated:      0,
            enginesCleanedUp:    0,
            updateConfigCalls:   0,
            styleReloads:        0,
            addBuildingsCalls:   0,
            buildingFetchStarts: 0,
            contextLostEvents:   0
        };
    }
    w.__heliosStats[key] = (w.__heliosStats[key] ?? 0) + 1;
}


//Module-level cap on the number of HeliosEngine instances alive at the same time.
//
//Home Assistant's dashboard editor creates a fresh preview card on every config edit and does not reliably fire `disconnectedCallback` on the
//previous preview, orphaned engines accumulate, each still holding a WebGL context. Safari mobile caps active contexts at ~8 and starts recycling
//once the cap is hit, which causes FPS drift and the iOS black-screen lockup.
//
//We track every live engine in a module-level Set and force-clean the oldest one whenever a new engine is about to push the count over the limit.
//
//Cap raised from 2 to 4 because a typical editing session needs room for the live card + an HA editor preview + 1-2 transient previews while HA
//rebuilds the editor UI. At 2 the cap fired on the very first edit and evicted the live card, the user's "carte foutue jusqu'au refresh"
//symptom. Browser per-origin caps are ~8-16, so 4 leaves comfortable headroom for the page's other WebGL consumers.
const MAX_LIVE_ENGINES = 4;

const _liveEngines = new Set<HeliosEngine>();


//-----------------------------------------------------------------
//Shared fetch caches: HA's editor preview pane destroys and re-creates the helios-card element on every config-changed commit
//(slider release, picker write and `hui-card.ts:195`). The map's WebGL context is unavoidably re-allocated each time
//because the cycle is hard-coded in HA, but the expensive PARSED fetch payloads (buildings GeoJSON, LiDAR raster) do not need to
//be re-downloaded and re-parsed. Stashing them at module scope lets the fresh engine pick them up synchronously and skip the
//network round-trip entirely.
//
//The browser already caches the underlying HTTP responses (MapTiler tile JSONs, OFM basemap tiles, IGN LiDAR tiles) under its
//normal cache headers, so reuse here only saves the parsing + projection cost. For buildings that is a 10-50 ms hit. For LiDAR
//raster that is several megabytes of binary decoded into typed arrays, between 100 ms and 1 s depending on the resolution. Both
//show up as a noticeable flash in the preview when not cached; with the shared cache the flash disappears.
//
//TTL is wide (30 minutes) because the underlying physical data does not change. The cache key encodes home position + radius +
//raster size so any meaningful change (user moves home, edits radius, switches precision) invalidates the entry naturally.

const SHARED_FETCH_CACHE_TTL_MS = 30 * 60_000;

interface SharedBuildingsCacheEntry
{
    data: BuildingsResult;
    ts:   number;
}

interface SharedLidarCacheEntry
{
    features:    GeoJSON.FeatureCollection;
    diagnostics: {
        cellsKept:         number;
        cellsPerClumpCap:  number;
        heightRangeM:      [number, number] | null;
    };
    raster:      unknown;
    ts:          number;
}

const _sharedBuildingsCache: Map<string, SharedBuildingsCacheEntry> = new Map();
const _sharedLidarCache:     Map<string, SharedLidarCacheEntry>     = new Map();


function sharedBuildingsCacheGet(key: string): BuildingsResult | null
{
    const entry = _sharedBuildingsCache.get(key);
    if (!entry)
    {
        return null;
    }
    if (Date.now() - entry.ts > SHARED_FETCH_CACHE_TTL_MS)
    {
        _sharedBuildingsCache.delete(key);
        return null;
    }
    return entry.data;
}


function sharedLidarCacheGet(key: string): SharedLidarCacheEntry | null
{
    const entry = _sharedLidarCache.get(key);
    if (!entry)
    {
        return null;
    }
    if (Date.now() - entry.ts > SHARED_FETCH_CACHE_TTL_MS)
    {
        _sharedLidarCache.delete(key);
        return null;
    }
    return entry;
}


export type CloudIntensity = 'clear' | 'light' | 'moderate' | 'heavy' | 'storm' | 'fog';

//Sources of the irradiance value displayed in the PV legend.
//
//  haurwitz  , local computation using Haurwitz (1945) clear-sky GHI
//               and Kasten-Czeplak (1980) cloud attenuation. Always
//               available since it only needs the solar position and
//               cloud_cover. Used as the fallback past the forecast
//               horizon or when the model omits shortwave_radiation.
//  shortwave , direct read of `shortwave_radiation_instant` from the
//               weather model (median across the active models in
//               'high' precision mode). Considered more accurate
//               because the model integrates aerosols, humidity
//               profile and multi-layer cloud effects that a purely
//               analytical formula can't reproduce.
//  sensor    , value pushed in from a Home Assistant entity via
//               setLiveIrradianceOverride. Beats both model paths
//               because it's a measurement at the home itself; only
//               used while the card is in live mode, scrubbing past
//               or forecast still falls back to shortwave/haurwitz.
export type IrradianceSource = 'haurwitz' | 'shortwave' | 'sensor';

export interface WeatherData
{
    cloudCover:     number;
    cloudLow:       number;        //%, low-level clouds (≤ 3 km)
    cloudMid:       number;        //%, mid-level clouds (3–8 km)
    cloudHigh:      number;        //%, high-level clouds (≥ 8 km)
    cloudIntensity: CloudIntensity;
    timeRange:      { start: Date; end: Date } | null;
    isLiveTime:     boolean;
    pvPower:        number;        //primary value, normalised 0..100 (≈ GHI/10 W/m²)
    pvPowerHaurwitz:  number;      //always populated (analytical fallback)
    pvPowerShortwave: number;      //-1 if shortwave_radiation is unavailable
    irradianceSource: IrradianceSource;
    //Live ambient context the card-side PV prediction uses to
    //refine its forecast: temperature drives the thermal-derating
    //multiplier, wind feeds the convective cooling term. NaN
    //means "model didn't surface the value at this hour", the
    //downstream predictor falls back to the legacy "cool cell"
    //assumption (derating = 1) without erroring out.
    temperatureC:   number;
    windMs:         number;
}

type RGB = [number, number, number];

//Mobile detection, used to scale grid density and pixel ratio so older phones keep usable framerates. Computed once at module load.
const IS_MOBILE = (() =>
{
    if (typeof navigator === 'undefined')
    {
        return false;
    }
    const ua = navigator.userAgent || '';
    if (/Mobi|Android|iPhone|iPad|iPod|IEMobile|BlackBerry/i.test(ua))
    {
        return true;
    }
    //Treat narrow viewports as mobile too, covers desktop in mobile mode
    if (typeof window !== 'undefined' && window.innerWidth <= 768)
    {
        return true;
    }
    return false;
})();


const DEFAULT_CLOUD_RGB: RGB = [0x5A, 0x8D, 0xC4];


//Parse a CSS colour string ("#rrggbb", "rgb(r, g, b)", "rgba(r, g, b, a)", "var(...)" already resolved
//by getComputedStyle) into a 0..1 RGB triplet for WebGL uniforms. Returns [1, 1, 1] (white) on parse
//failure so the LiDAR view falls back to the pre-theme behaviour on weird inputs.
function parseCssColorToUnitRgb(raw: string): [number, number, number]
{
    const s = (raw || '').trim().toLowerCase();
    if (!s) return [1, 1, 1];
    if (s.startsWith('#'))
    {
        const hex = s.slice(1);
        if (hex.length === 3 || hex.length === 4)
        {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            if (isFinite(r) && isFinite(g) && isFinite(b)) return [r / 255, g / 255, b / 255];
        }
        else if (hex.length === 6 || hex.length === 8)
        {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            if (isFinite(r) && isFinite(g) && isFinite(b)) return [r / 255, g / 255, b / 255];
        }
        return [1, 1, 1];
    }
    const m = s.match(/^rgba?\s*\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    if (m)
    {
        const r = parseFloat(m[1]);
        const g = parseFloat(m[2]);
        const b = parseFloat(m[3]);
        if (isFinite(r) && isFinite(g) && isFinite(b)) return [r / 255, g / 255, b / 255];
    }
    return [1, 1, 1];
}



//Haversine distance, used to compare two lat/lon pairs in metres.

function geoDistM(lat1: number, lon1: number, lat2: number, lon2: number): number
{
    const R  = 6_371_000;
    const D  = Math.PI / 180;
    const dφ = (lat2 - lat1) * D;
    const dλ = (lon2 - lon1) * D;
    const a  = Math.sin(dφ / 2) ** 2
             + Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.sin(dλ / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

//Build a closed-ring polygon approximating a geographic circle.
//
//MapLibre has no native "geographic circle" geometry, its `circle` layer type renders pixel-sized markers, not metre-sized discs. So for any "x
//metres around the home" overlay we generate a polygon of N segments around the centre. 64 segments are visually indistinguishable from a true circle
//at our zoom range and add no measurable cost.
//
//Formulae use the equirectangular metres-per-degree approximation,
//valid within the few-hundred-metres scale we work at:
//  - 1° latitude  ≈ 111 320 m anywhere on Earth
//  - 1° longitude ≈ 111 320 × cos(lat) m
//
//Returns a coordinate ring with the first point repeated at the end so the polygon closes, required by GeoJSON's Polygon spec.
function buildCirclePolygon(
    centerLon:     number,
    centerLat:     number,
    radiusMetres:  number,
    segments:      number = 64
): Array<[number, number]>
{
    const cosLat = Math.cos(centerLat * Math.PI / 180);
    const dLat   = radiusMetres / 111_320;
    const dLon   = radiusMetres / (111_320 * cosLat);

    const ring: Array<[number, number]> = [];
    for (let i = 0; i < segments; i++)
    {
        const a = (i / segments) * 2 * Math.PI;
        ring.push([
            centerLon + Math.cos(a) * dLon,
            centerLat + Math.sin(a) * dLat
        ]);
    }
    ring.push(ring[0]);
    return ring;
}

//Cloud-cover disc parameters.
//
//The card now expresses the current cloud coverage as a flat disc on
//the ground centred on the home, surrounded by a black outlined ring
//that materialises the 100 % reference. The disc's radius scales
//linearly with the cloud-cover percentage:
//  cloudPct =   0 %  →  radius = 0     (no disc, pristine sky)
//  cloudPct =  50 %  →  radius = R/2
//  cloudPct = 100 %  →  radius = R     (disc touches the outline)
//
//Radius is in real-world metres. At our locked neighbourhood zoom
//(18) one metre is ~2.5 px on screen, so a 30 m radius reads as
//a ~75 px disc, focal on the home itself, neither dwarfing it nor
//swallowing too much of the surrounding context.
const CLOUD_DISC_RADIUS_M       = 30;
//The disc + ring opacity / stroke styling lives in the .cloud-svg
//selectors over in helios-card-css. The radius constant above is
//still consumed by projectCloudScene to size the geographic circle
//vertices.
//Number of polygon vertices used to approximate the disc and ring.
//128 is overkill for the visual smoothness alone but the cost is
//still negligible (~128 trig ops per data update) and it future-
//proofs the look against tighter zooms or subtle lighting we may
//add in later phases.
const CLOUD_CIRCLE_SEGMENTS     = 128;

//Vertical screen-space offset (CSS px) used to anchor the PV /
//battery chip cluster relative to the projected home. The SoC and
//Power chips sit on a shared shelf this many pixels above the home
//(minus the battery vertical offset); the PV chip is mirrored
//below the shelf. Adjusting this single constant slides the whole
//cluster up or down without disturbing its internal geometry.
const PV_CHIP_OFFSET_PX         = 70;


//Solar-arc parameters. The arc traces the sun's full 24h trajectory across the local sky, projected onto the screen via the same camera matrices
//MapLibre uses for its own 3D content.
//
//Radius is in real-world metres, i.e. the radius of the imaginary
//hemisphere on which we paint the sun's path, centred on the home.
//40 m at zoom 18 keeps the entire arc inside a typical card-sized
//canvas (≈440×500 CSS px) even at low solar altitudes where the
//path stretches far east-west: with the home projected near the
//canvas centre, the noon apex sits comfortably below the top edge
//and the morning/evening extremes stay within the left/right
//margins. Earlier values (100 m) put roughly half the arc above
//the canvas top.
const SUN_ARC_RADIUS_M          = 40;
//Number of samples uniformly spaced over the 24h day (UTC), one per
//15 min. 96 is enough that the polyline reads as smooth even at
//tight zoom while still cheap to recompute on every map transform.
const SUN_ARC_SAMPLES           = 96;
//Opacity multiplier when the sun is below the horizon. The arc
//remains visible (so the user keeps a sense of where the sun will
//rise / has set) but is faded out so it doesn't compete visually
//with the daytime portion that's actually contributing power.
const SUN_ARC_NIGHT_OPACITY     = 0.25;


function weatherCodeToIntensity(code: number, pct: number): CloudIntensity
{
    if (code >= 95)
    {
        return 'storm';
    }
    if (code >= 45 && code <= 48)
    {
        return 'fog';
    }
    if ((code >= 61 && code <= 67) || (code >= 71 && code <= 77) || code >= 80)
    {
        return 'heavy';
    }
    if (code >= 51)
    {
        return 'moderate';
    }
    if (pct < 15)
    {
        return 'clear';
    }
    if (pct < 50)
    {
        return 'light';
    }
    return pct < 80 ? 'moderate' : 'heavy';
}


//Engine

export class HeliosEngine
{
    map?:     MapLibreMap;
    homeLat:  number;
    homeLon:  number;
    //Home altitude (metres above sea level), forwarded to Open-Meteo
    //via &elevation= for sharper boundary conditions. Undefined falls
    //back to the API's global 90 m DEM.
    private homeElevation?: number;
    cfg:      HeliosConfig;

    private _fetchLat = 0;
    private _fetchLon = 0;

    private _mapReady     = false;
    //Single source of truth for hourly forecast data. Populated by
    //fetchHomePointData(); null until the first successful fetch.
    private _homeHourlyData: SampleHourly | null = null;
    private _selectedTime:  Date | null       = null;

    //Skip atmosphere repaint when the sun moved less than 0.5° since
    //last call (≈ 2 min), setPaintProperty isn't free on mobile.
    private _lastAtmosphereAlt = -999;

    //Last sun (altitude, azimuth) the LiDAR-View exposure compute ran against. The compute is expensive (50-150 ms per pass) so we gate it on
    //the same 0.5° delta as the atmosphere refresh and additionally watch the azimuth, which moves faster than altitude near sunrise / sunset.
    //Init to a sentinel that guarantees the first compute fires the moment LiDAR View turns on.
    private _lastLidarExposureAlt: number = -999;
    private _lastLidarExposureAz:  number = -999;
    //Handle for the deferred exposure compute scheduled via requestIdleCallback (with a setTimeout fallback for environments where the API is
    //missing, e.g. older Safari). Stored so we can cancel an in-flight schedule when the sun moves again before the previous one fired.
    private _exposureIdleHandle:   number | undefined;

    //Consecutive HTTP 429 count, drives exponential back-off. Resets on any successful fetch.
    private _rateLimitStreak = 0;
    //Optional host callback fired whenever the Open-Meteo home-point fetch transitions in or
    //out of the rate-limited state. Lets the card draw an alert banner under the loading banner
    //so the user understands why the weather data has stopped refreshing for a few minutes.
    public onWeatherRateLimitChange?: (rateLimited: boolean) => void;
    private _emittedRateLimited = false;
    private _setRateLimited(rateLimited: boolean): void
    {
        if (this._emittedRateLimited === rateLimited) { return; }
        this._emittedRateLimited = rateLimited;
        try { this.onWeatherRateLimitChange?.(rateLimited); }
        catch (_) { /* host callback errors must not break the fetch path */ }
    }
    //Consecutive non-429 failure count (5xx, network, JSON parse). Drives a graduated back-off so
    //a server outage at the previous flat 60 s cadence (= 1440 retries / day per card, compounded
    //across multiple cards / tabs) can no longer pile up the kind of traffic that triggers an IP
    //rate limit even without a single 429 from the API. Resets on success.
    private _otherErrorStreak = 0;

    private _fetchAbortController?: AbortController;
    private _resizeDebounceTimer?:  number;
    private _weatherTimer?:         number;
    private _skyTimer?:             number;
    private _resizeObserver?:       ResizeObserver;
    //When true, the 60 s shadow-refresh timer skips its work and the card-level onMapTransform handler short-circuits the dome re-projection. Toggled
    //by the card based on the IntersectionObserver: a Helios card scrolled out of viewport or sitting in a hidden HA tab pays nothing for the engine
    //until it comes back.
    private _paused = false;

    //_weatherTimer holds either a setInterval id (regular refresh) or
    //a setTimeout id (rate-limit back-off). The two ID spaces overlap
    //in practice but not by spec, so we always clear both kinds.
    private _clearWeatherTimer(): void
    {
        if (this._weatherTimer !== undefined)
        {
            window.clearInterval(this._weatherTimer);
            window.clearTimeout(this._weatherTimer);
            this._weatherTimer = undefined;
        }
    }

    public onFetchStart?:    () => void;
    public onFetchEnd?:      () => void;
    public onWeatherUpdate?: (data: WeatherData) => void;
    //Buildings GeoJSON fetch lifecycle. Fired around fetchBuildingsAroundHome so the card can track
    //the buildings phase in the loading banner.
    public onBuildingsFetchStart?: () => void;
    public onBuildingsFetchEnd?:   () => void;

    //Irradiance samples pushed in by the card from a HA solar-radiation
    //sensor: the entity's history (recorder snapshots) up to "now",
    //merged with the live state. Stored sorted ascending by time so the
    //lookup at _sensorIrradianceAt can binary-search if the dataset
    //grows past linear-scan territory. Null means "no entity configured
    //or no usable samples yet", the model irradiance is used unchanged.
    //
    //Each sample is in W/m². The engine treats them as ground-truth point readings of global shortwave irradiance at the home, in the same units as
    //Open-Meteo's shortwave_radiation_instant, so they slot into the existing irradiance pipeline without rescaling.
    //
    //Lookup is nearest-neighbour with a strict time window (±30 min by
    //default): outside the window we fall through to the model rather
    //than extrapolate a stale value. Forecast time always falls
    //through since samples never sit in the future.
    private _sensorIrradianceSamples: { tMs: number; wm2: number }[] | null = null;
    private static readonly SENSOR_IRRADIANCE_WINDOW_MS = 30 * 60 * 1000;
    public setSolarRadiationSamples(
        samples: { time: Date; wm2: number }[] | null
    ): void
    {
        if (!samples || samples.length === 0)
        {
            if (this._sensorIrradianceSamples === null)
            {
                return;
            }
            this._sensorIrradianceSamples = null;
            this._arcInputsCache = undefined;
            this._renderForCurrentSelection();
            return;
        }
        const cleaned: { tMs: number; wm2: number }[] = [];
        for (const s of samples)
        {
            const ms = s.time.getTime();
            if (!isFinite(ms))
            {
                continue;
            }
            if (!isFinite(s.wm2) || s.wm2 < 0)
            {
                continue;
            }
            cleaned.push({ tMs: ms, wm2: s.wm2 });
        }
        cleaned.sort((a, b) => a.tMs - b.tMs);
        const next = cleaned.length > 0 ? cleaned : null;

        //Skip the (re-)render hop when the dataset matches what we
        //already hold. The card pushes samples on every Lit cycle to
        //keep the live state fresh, so without this guard each push
        //fires onWeatherUpdate, which rewrites @state references on
        //the card, which re-runs updated(), which pushes again, an
        //unterminated render loop that freezes the dashboard the
        //moment a solar-radiation entity is selected.
        if (this._sensorSamplesEqual(this._sensorIrradianceSamples, next))
        {
            return;
        }
        this._sensorIrradianceSamples = next;
        //Sun arc cache colours each daily sample from a single live-
        //cloud key; mixing sensor data into the lookup invalidates
        //the existing cache for that day so the next projectSunScene
        //rebuilds with the new ground truth.
        this._arcInputsCache = undefined;
        this._renderForCurrentSelection();
    }

    private _sensorSamplesEqual(
        a: { tMs: number; wm2: number }[] | null,
        b: { tMs: number; wm2: number }[] | null
    ): boolean
    {
        if (a === b)
        {
            return true;
        }
        if (a === null || b === null)
        {
            return false;
        }
        if (a.length !== b.length)
        {
            return false;
        }
        for (let i = 0; i < a.length; i++)
        {
            if (a[i].tMs !== b[i].tMs)
            {
                return false;
            }
            if (a[i].wm2 !== b[i].wm2)
            {
                return false;
            }
        }
        return true;
    }

    //Nearest-neighbour lookup over the pushed sensor history. Returns
    //the W/m² reading whose timestamp is closest to `t` provided the
    //gap is within the strict window; otherwise null so the caller
    //falls back to the model. Linear scan is fine for ~hourly samples
    //across a few-day window (a couple of hundred entries at most).
    private _sensorIrradianceAt(t: Date): number | null
    {
        const samples = this._sensorIrradianceSamples;
        if (!samples || samples.length === 0)
        {
            return null;
        }
        const tMs = t.getTime();
        let bestIdx = -1;
        let bestDelta = Number.POSITIVE_INFINITY;
        for (let i = 0; i < samples.length; i++)
        {
            const d = Math.abs(samples[i].tMs - tMs);
            if (d < bestDelta)
            {
                bestDelta = d;
                bestIdx   = i;
            }
            //Samples are sorted, once delta starts growing again we can short-circuit, the rest is monotonically worse.
            else if (d > bestDelta)
            {
                break;
            }
        }
        if (bestIdx < 0 || bestDelta > HeliosEngine.SENSOR_IRRADIANCE_WINDOW_MS)
        {
            return null;
        }
        return samples[bestIdx].wm2;
    }
    //Map transform changed, the card recomputes screen-space
    //projections (sun arc, chip positions, leaders) from this hook.
    public onMapTransform?:  () => void;

    //True until cleanup() has run. The card polls this on every
    //Lit cycle so it can detect when its engine was force-evicted by
    //the MAX_LIVE_ENGINES cap from inside another engine's
    //constructor (the orphan card otherwise keeps a stale reference
    //and silently calls updateConfig() on a destroyed map, which is
    //the "carte foutue jusqu'au refresh" symptom users hit after
    //heavy editing sessions).
    public isAlive(): boolean
    {
        return this.map !== undefined;
    }

    //Camera pose persistence. HA's lovelace does NOT persist
    //`config-changed` events emitted from a live card (only from the
    //editor preview), so a YAML round-trip is not an option for a
    //control that lives outside the editor. localStorage keyed on the
    //home coordinates is the right fit: instant write, instant read on
    //the next boot, scoped per-card by lat/lon. The 3-decimal rounding
    //gives ~111 m precision, enough to keep two homes on the same
    //street apart while tolerating tiny GPS jitter on the config side.
    private _cameraPoseStorageKey(): string
    {
        const lat = Math.round(this.homeLat * 1000) / 1000;
        const lon = Math.round(this.homeLon * 1000) / 1000;
        return `helios:camera-pose:${lat}:${lon}`;
    }
    private _readStoredPose(): { bearing?: number; pitch?: number; locked?: boolean } | null
    {
        try
        {
            const raw = window.localStorage.getItem(this._cameraPoseStorageKey());
            if (!raw)
            {
                return null;
            }
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object')
            {
                return parsed as { bearing?: number; pitch?: number; locked?: boolean };
            }
        }
        catch
        {
            //Quota errors, disabled storage, private windows: any of
            //these silently degrade to "no stored pose, use defaults".
        }
        return null;
    }
    private _writeStoredPose(pose: { bearing: number; pitch: number; locked: boolean }): void
    {
        try
        {
            window.localStorage.setItem(this._cameraPoseStorageKey(), JSON.stringify(pose));
        }
        catch
        {
            //Same silent-degrade rationale as the reader. The live
            //engine state is already mutated in setCameraLocked /
            //setCameraBearing / setCameraPitch, only persistence
            //across reloads is lost.
        }
    }
    //Resting pose, applied on map init. Reads localStorage first
    //(the runtime lock chip writes there), then the legacy YAML
    //`camera-bearing-deg` / `camera-pitch-deg` keys for older
    //installs, then the hemisphere-aware default (north up in SH,
    //south up in NH). All values are wrapped / clamped so a stale
    //read can never put the camera in an unrenderable pose.
    private _initialBearing(): number
    {
        const stored = this._readStoredPose();
        const rawStored = stored && typeof stored.bearing === 'number' ? stored.bearing : NaN;
        const rawCfg    = Number((this.cfg as Record<string, unknown>)['camera-bearing-deg']);
        const raw = Number.isFinite(rawStored) ? rawStored : rawCfg;
        if (Number.isFinite(raw))
        {
            return ((raw % 360) + 360) % 360;
        }
        return this.homeLat >= 0 ? 180 : 0;
    }
    private _initialPitch(): number
    {
        const stored = this._readStoredPose();
        const rawStored = stored && typeof stored.pitch === 'number' ? stored.pitch : NaN;
        const rawCfg    = Number((this.cfg as Record<string, unknown>)['camera-pitch-deg']);
        const raw = Number.isFinite(rawStored) ? rawStored : rawCfg;
        if (Number.isFinite(raw))
        {
            return Math.max(CAMERA_PITCH_MIN_DEG, Math.min(CAMERA_PITCH_MAX_DEG, raw));
        }
        return CAMERA_PITCH_REST_DEG;
    }
    //True when manual drag-rotate / drag-pitch + the idle auto-orbit
    //should all be suppressed because the user opted into a locked
    //camera pose. Reads the localStorage flag first (live lock chip),
    //then the legacy YAML key as fallback.
    public isCameraLocked(): boolean
    {
        const stored = this._readStoredPose();
        if (stored && typeof stored.locked === 'boolean')
        {
            return stored.locked;
        }
        return (this.cfg as Record<string, unknown>)['camera-locked'] === true;
    }
    //Live setter so the editor's slider can preview a new bearing
    //without waiting for the next config commit. Wraps to [0, 360).
    public setCameraBearing(deg: number): void
    {
        if (!this.map || !Number.isFinite(deg))
        {
            return;
        }
        const wrapped = ((deg % 360) + 360) % 360;
        this.map.setBearing(wrapped);
    }
    //Live setter for the editor's pitch slider, clamped to the same
    //bounds the drag-pitch handler enforces.
    public setCameraPitch(deg: number): void
    {
        if (!this.map || !Number.isFinite(deg))
        {
            return;
        }
        const clamped = Math.max(CAMERA_PITCH_MIN_DEG, Math.min(CAMERA_PITCH_MAX_DEG, deg));
        this.map.setPitch(clamped);
    }
    //Toggle the lock at runtime so the lock chip applies immediately
    //without a respawn. Flips the pinch-rotate handler; the pointer
    //drag-rotate gate re-evaluates isCameraLocked() on every
    //pointerdown so its branch picks up the new state too. The cfg
    //is mutated in-place AND the localStorage record refreshed so the
    //next boot restores the same state without a config round-trip.
    public setCameraLocked(locked: boolean): void
    {
        if (!this.map)
        {
            return;
        }
        (this.cfg as Record<string, unknown>)['camera-locked'] = locked;
        this._writeStoredPose({
            bearing: this.map.getBearing(),
            pitch:   this.map.getPitch(),
            locked,
        });
        if (locked)
        {
            this.map.touchZoomRotate.disable();
        }
        else
        {
            this.map.touchZoomRotate.enable({ around: 'center' });
        }
    }
    //Out-of-config defaults that the editor's reset button restores.
    //Always the hemisphere-aware boot pose, never the user's
    //customised values; reading from _initialBearing / _initialPitch
    //here would simply echo back whatever the user just changed.
    public getDefaultBearing(): number { return this.homeLat >= 0 ? 180 : 0; }
    public getDefaultPitch():   number { return CAMERA_PITCH_REST_DEG; }
    //Live camera pose readers so the editor can pre-fill its sliders
    //with whatever the user is currently looking at, not just the
    //value committed to the YAML config.
    public getCameraBearing(): number { return this.map ? this.map.getBearing() : this.getDefaultBearing(); }
    public getCameraPitch():   number { return this.map ? this.map.getPitch()   : this.getDefaultPitch(); }
    public getCameraZoom():    number { return this.map ? this.map.getZoom()    : 18; }

    //Pre-weather-mode camera pose snapshot. Captured when enterWeatherCamera() fires so the symmetric
    //exit (exitWeatherCamera) restores EXACTLY the pose the user was on, bypassing the default
    //easeTo target which would otherwise drag them back to the boot pose. Also stashes the
    //pre-enter camera-locked state so the exit returns to the rotation behaviour the user had set
    //(locked stays locked, free stays free), and the zoom min/max so the temporary expansion we
    //apply for the satellite-style overview reverts on the way back.
    private _preWeatherPose: {
        bearing:   number;
        pitch:     number;
        zoom:      number;
        center:    [number, number];
        locked:    boolean;
        minZoom:   number;
        maxZoom:   number;
        //Captured maxBounds box so the exit restores the tight building-radius clamp the rest of
        //the card relies on. Without saving + restoring this, the engine's _applyMapBounds would
        //race the easeTo back to UI mode and clamp the camera before the animation lands.
        maxBoundsWest:  number | null;
        maxBoundsSouth: number | null;
        maxBoundsEast:  number | null;
        maxBoundsNorth: number | null;
    } | null = null;
    //Pending setTimeout that re-tightens the zoom envelope after an exit's easeTo lands. Held as a
    //handle so a rapid UI -> Weather -> UI -> Weather sequence can CANCEL a stale tighten before it
    //fires during the next entry's animation, which would otherwise re-clamp min/maxZoom to 18 and
    //snap the camera back mid-ease.
    private _weatherZoomTighten: number | null = null;

    //Weather mode camera transition: tilt down to top-down + zoom out so the cloud-cover overlay
    //reads as a meteorological satellite plan. Three knobs have to give for this to work:
    //  1. Zoom min/max are locked to 18 in the base map init so the user can't wander off the
    //     designed altitude. We temporarily widen [minZoom, maxZoom] to [10, 18] for the duration of
    //     weather mode and restore the lock on exit.
    //  2. Rotation gets locked the moment we enter so a stray drag doesn't pan the overhead view
    //     out of frame. The pre-enter lock state is captured so the exit restores it verbatim.
    //  3. easeTo carries the pose change on a 1200 ms cubic easing so the transition reads as a
    //     deliberate "stepping back" rather than a jump cut.
    public enterWeatherCamera(): void
    {
        if (!this.map) { return; }
        //Cancel any pending zoom-tighten scheduled by a prior exit. Without this guard, a fast
        //UI -> Weather -> UI -> Weather sequence lets the previous exit's setTimeout fire mid-
        //ease here and re-clamp [minZoom, maxZoom] back to [18, 18], freezing the camera at 18
        //before the easeTo to 12 can settle.
        if (this._weatherZoomTighten !== null)
        {
            window.clearTimeout(this._weatherZoomTighten);
            this._weatherZoomTighten = null;
        }
        const prevLocked = this.isCameraLocked();
        const mb = this.map.getMaxBounds();
        this._preWeatherPose = {
            bearing: this.map.getBearing(),
            pitch:   this.map.getPitch(),
            zoom:    this.map.getZoom(),
            center:  [this.homeLon, this.homeLat],
            locked:  prevLocked,
            minZoom: this.map.getMinZoom(),
            maxZoom: this.map.getMaxZoom(),
            maxBoundsWest:  mb ? mb.getWest()  : null,
            maxBoundsSouth: mb ? mb.getSouth() : null,
            maxBoundsEast:  mb ? mb.getEast()  : null,
            maxBoundsNorth: mb ? mb.getNorth() : null,
        };
        //Clear the maxBounds clamp BEFORE the easeTo. _applyMapBounds at boot installs a tight
        //bbox (~2 x building-radius around the home) so the user can't pan past the rendered
        //surroundings; MapLibre enforces an effective minimum zoom such that the bounds always
        //fit the viewport, which would clamp the weather-mode easeTo back up to ~16 regardless
        //of setMinZoom. Dropping the bounds entirely lets the camera dezoom freely; the exit
        //restores the original bbox so the rest of the card recovers its pan clamp.
        //MapLibre accepts both null and undefined to clear the clamp; undefined avoids the
        //internal "expected number, got null" log spam MapLibre 5.x emits when null bubbles
        //through its bound validation path.
        this.map.setMaxBounds(undefined);
        //Widen the zoom envelope. Buffer of 1 below the target keeps MapLibre from edge-clamping
        //the ease in flight.
        this.map.setMinZoom(8);
        this.map.setMaxZoom(18);
        //Force the rotation lock on. setCameraLocked persists the new state to localStorage; we'll
        //restore the original on exit so the user's preference comes back exactly as it was.
        if (!prevLocked) { this.setCameraLocked(true); }
        this.map.stop();
        this.map.easeTo({
            center:   [this.homeLon, this.homeLat],
            bearing:  0,
            pitch:    0,
            zoom:     11,
            duration: 1200,
        });
    }

    public exitWeatherCamera(): void
    {
        if (!this.map) { return; }
        const pose = this._preWeatherPose;
        if (!pose) { return; }
        this._preWeatherPose = null;
        this.map.stop();
        this.map.easeTo({
            center:   pose.center,
            bearing:  pose.bearing,
            pitch:    pose.pitch,
            zoom:     pose.zoom,
            duration: 1200,
        });
        //Restore the rotation-lock state the user had before entering. setCameraLocked also writes
        //the state back to localStorage so the next reload still sees the user's preference.
        if (this.isCameraLocked() !== pose.locked) { this.setCameraLocked(pose.locked); }
        //Re-tighten the zoom envelope + restore the maxBounds clamp after the easeTo lands.
        //Deferred past the 1200 ms ease + a 50 ms buffer for MapLibre's onMoveEnd delivery. The
        //handle is kept on the engine so a subsequent enter (fast mode swap) can cancel it before
        //it fires.
        const tighten = (): void =>
        {
            this._weatherZoomTighten = null;
            if (!this.map) { return; }
            if (pose.maxBoundsWest !== null
             && pose.maxBoundsSouth !== null
             && pose.maxBoundsEast !== null
             && pose.maxBoundsNorth !== null)
            {
                this.map.setMaxBounds([
                    [pose.maxBoundsWest, pose.maxBoundsSouth],
                    [pose.maxBoundsEast, pose.maxBoundsNorth],
                ]);
            }
            this.map.setMinZoom(pose.minZoom);
            this.map.setMaxZoom(pose.maxZoom);
        };
        this._weatherZoomTighten = window.setTimeout(tighten, 1250);
    }

    //---------------------------------------------------------------------------------------------
    //Weather mode cloud-cover grid: a coarse lat / lon grid of Open-Meteo cloud_cover_low / mid /
    //high values covering the weather-mode camera viewport. Open-Meteo bills 1 API call per
    //location per day-bucket, so a multi-location POST counts each point against the per-IP
    //quota (600/min, 5 000/h, 10 000/day on the free tier). 15 x 15 = 225 points per fetch keeps
    //a single entry well under the per-minute ceiling even when stacked with the home-point
    //fetch, and the per-IP daily quota covers ~40 fresh fetches.
    //
    //localStorage cache + dedup soften the bill further: a re-entry within the cache TTL is a
    //cache hit (zero API calls), and concurrent calls from the 5 min refresh + an explicit
    //ensureWeatherCloudGrid() share the same in-flight Promise.
    //
    //Rendering happens client-side as an SVG overlay (see card/weatherMode.ts) anchored over the
    //map.
    //---------------------------------------------------------------------------------------------

    //Grid dimensions: 10 x 10 = 100 points per fetch. At weather-mode zoom 11 the visible bbox
    //is ~22 x 22 km, so cell pitch lands at ~2.2 km. That over-samples Open-Meteo's underlying
    //model (ICON-EU 7 km / IFS 9 km), which is the point: a tight grid feeds a tight bilinear
    //interpolation into the fragment shader, the FBM noise on top of it carries the texture.
    private static readonly _WEATHER_GRID_SIDE        = 10;
    //Half-extent of the grid in latitude degrees around the home. 0.20 deg ~= 22 km on the lat
    //axis, so the grid covers a ~44 x 44 km bbox after the cos(lat) compression on the lon axis
    //matches that envelope. Larger than the zoom-11 viewport so the shader's edge fade
    //completes off-screen and the visible part of the cloud field reads as full-bleed rather
    //than a small patch in the centre. API cost is invariant in the bbox size (Open-Meteo bills
    //per location, not per km²), so widening the envelope is free.
    private static readonly _WEATHER_GRID_HALF_LAT_DEG = 0.20;
    //Refresh cadence while inside weather mode. Hits the cache or the network depending on
    //freshness vs the cache TTL below.
    private static readonly _WEATHER_GRID_REFRESH_MS   = 5 * 60_000;
    //localStorage cache TTL. Open-Meteo's underlying models tick every 15 min server-side, so 30
    //min stays "fresh enough" without burning fetches when the user toggles weather mode on and
    //off repeatedly. Cache key precision is 3 decimal degrees (~110 m) on lat / lon: two homes on
    //the same street round to the same key and share the cached grid.
    private static readonly _WEATHER_GRID_CACHE_TTL_MS = 30 * 60_000;
    private static readonly _WEATHER_GRID_CACHE_PREFIX = 'helios-weather-grid:v3:';

    private _weatherCloudGrid: {
        bounds:    { south: number; north: number; west: number; east: number };
        nLat:      number;
        nLon:      number;
        lats:      Float32Array;
        lons:      Float32Array;
        //Hourly time axis the cloud arrays index along (8-day window: 5 past + today + 2
        //forecast). One fetch covers the full timeline so timeline scrub picks the right slice
        //from cache without firing another HTTP round-trip.
        times:     Date[];
        //Cloud-cover percentages stored row-major: point index outer (latIdx * nLon + lonIdx),
        //time index inner. Read via `values[pointIdx * nTimes + timeIdx]`. nTimes is times.length.
        cloudLow:  Float32Array;
        cloudMid:  Float32Array;
        cloudHigh: Float32Array;
        //Resolved numerical weather model fed back by Open-Meteo (`best_match` picks the most
        //accurate regional model for the home location). Surfaces in the UI so the user can
        //judge the displayed grid pitch against the model's native resolution.
        modelName: string;
        //Epoch ms when the grid was fetched (network or localStorage load). Drives the per-call
        //TTL guard: if Date.now() - storedAt < _WEATHER_GRID_CACHE_TTL_MS, ensureWeatherCloudGrid
        //skips both the in-flight Promise and the network entirely.
        storedAt:  number;
    } | null = null;
    //In-flight Promise shared between concurrent callers (the explicit ensureWeatherCloudGrid call
    //after weather-mode entry and the 5 min refresh tick). Cleared in a finally block so an error
    //path frees the slot for the next attempt.
    private _weatherCloudGridPending: Promise<void> | null = null;
    private _weatherCloudGridAbort: AbortController | null = null;
    private _weatherCloudGridRefreshTimer: number | undefined = undefined;
    //Live GPU-side overlay built on top of the cloud grid. Holds the active MapLibre custom layer
    //instance + the rendering state the card drives (selected time index, per-band visibility,
    //primary-text-color). Null while weather mode is off.
    private _weatherCloudLayer: WeatherCloudLayer | null = null;
    private _weatherCloudShownTimeIdx: number = -1;
    private _weatherCloudBandsVisible: [boolean, boolean, boolean] = [true, true, true];
    private _weatherCloudColor: [number, number, number] = [1, 1, 1];

    public getWeatherCloudGrid(): typeof this._weatherCloudGrid
    {
        return this._weatherCloudGrid;
    }

    //Resolve the time-axis index closest to the given timestamp. The grid covers a 5-day
    //window, so this is cheap (~120 entries) and runs on every renderer pass. Returns -1 when
    //the grid is empty.
    public getWeatherCloudGridTimeIndex(t: Date): number
    {
        const g = this._weatherCloudGrid;
        if (!g || g.times.length === 0) { return -1; }
        const tMs = t.getTime();
        let best = 0;
        let bestDt = Math.abs(g.times[0].getTime() - tMs);
        for (let i = 1; i < g.times.length; i++)
        {
            const dt = Math.abs(g.times[i].getTime() - tMs);
            if (dt < bestDt) { bestDt = dt; best = i; }
        }
        return best;
    }

    //Compose the localStorage key for the cloud grid at the current home + grid geometry. Rounding
    //home coords to 3 decimal degrees (~110 m) lets adjacent homes share the cache. The grid side
    //and half-extent are part of the key so a constant change automatically invalidates the
    //existing cached payloads instead of returning stale geometry to the renderer.
    private _weatherCloudGridCacheKey(): string
    {
        const lat = this.homeLat.toFixed(3);
        const lon = this.homeLon.toFixed(3);
        const N   = HeliosEngine._WEATHER_GRID_SIDE;
        const hl  = HeliosEngine._WEATHER_GRID_HALF_LAT_DEG;
        return `${HeliosEngine._WEATHER_GRID_CACHE_PREFIX}${lat},${lon}:${N}:${hl}`;
    }

    //Read a fresh grid out of localStorage, returns null on miss / stale / corrupt. Wraps the
    //Float32Array payload back into typed arrays so the renderer's indexed reads keep their fast
    //path without an extra Array.from on every paint.
    private _readWeatherCloudGridFromCache(): NonNullable<typeof this._weatherCloudGrid> | null
    {
        try
        {
            const raw = window.localStorage?.getItem(this._weatherCloudGridCacheKey());
            if (!raw) { return null; }
            const j: any = JSON.parse(raw);
            const storedAt = Number(j?.storedAt);
            if (!Number.isFinite(storedAt)) { return null; }
            if (Date.now() - storedAt > HeliosEngine._WEATHER_GRID_CACHE_TTL_MS) { return null; }
            const p = j?.payload;
            if (!p?.bounds || !p?.lats?.length || !p?.times?.length) { return null; }
            return {
                bounds:    p.bounds,
                nLat:      p.nLat,
                nLon:      p.nLon,
                lats:      new Float32Array(p.lats),
                lons:      new Float32Array(p.lons),
                times:     p.times.map((s: string) => new Date(s)),
                cloudLow:  new Float32Array(p.cloudLow),
                cloudMid:  new Float32Array(p.cloudMid),
                cloudHigh: new Float32Array(p.cloudHigh),
                modelName: String(p.modelName ?? 'best_match'),
                storedAt,
            };
        }
        catch { return null; }
    }

    private _writeWeatherCloudGridToCache(g: NonNullable<typeof this._weatherCloudGrid>): void
    {
        try
        {
            const payload =
            {
                bounds:    g.bounds,
                nLat:      g.nLat,
                nLon:      g.nLon,
                lats:      Array.from(g.lats),
                lons:      Array.from(g.lons),
                times:     g.times.map(t => t.toISOString()),
                cloudLow:  Array.from(g.cloudLow),
                cloudMid:  Array.from(g.cloudMid),
                cloudHigh: Array.from(g.cloudHigh),
                modelName: g.modelName,
            };
            window.localStorage?.setItem(this._weatherCloudGridCacheKey(),
                JSON.stringify({ storedAt: g.storedAt, payload }));
        }
        catch { /* quota exceeded / disabled storage: silently degrade, in-memory grid still works */ }
    }

    //Fetch the weather-mode cloud grid. Resolution order:
    //  1. In-memory grid still under TTL -> return immediately (no I/O, no API call).
    //  2. localStorage cache hit -> hydrate the in-memory grid (no API call).
    //  3. In-flight Promise -> await the same network round-trip a concurrent caller already kicked.
    //  4. Cold path: POST to Open-Meteo, cache the result, populate the in-memory grid.
    //Errors leave the previous grid in place so the overlay keeps showing the last known cloud
    //field until the next refresh tick succeeds. AbortController lets exitWeatherMode cut a
    //pending fetch off cleanly.
    public async ensureWeatherCloudGrid(): Promise<void>
    {
        const now = Date.now();
        if (this._weatherCloudGrid && now - this._weatherCloudGrid.storedAt < HeliosEngine._WEATHER_GRID_CACHE_TTL_MS)
        {
            return;
        }
        const cached = this._readWeatherCloudGridFromCache();
        if (cached)
        {
            this._weatherCloudGrid = cached;
            //Push the cached payload into the active shader layer (if any) so the renderer picks
            //up the freshly loaded grid without waiting for the next time-index change.
            this.reuploadCloudShaderFromGrid(this._weatherCloudShownTimeIdx >= 0
                ? this._weatherCloudShownTimeIdx : 0);
            return;
        }
        if (this._weatherCloudGridPending) { return this._weatherCloudGridPending; }

        this._weatherCloudGridAbort?.abort();
        this._weatherCloudGridAbort = new AbortController();
        const signal = this._weatherCloudGridAbort.signal;

        const fetchPromise = (async (): Promise<void> =>
        {
            try
            {
                const N       = HeliosEngine._WEATHER_GRID_SIDE;
                const halfLat = HeliosEngine._WEATHER_GRID_HALF_LAT_DEG;
                //Longitude span compresses by cos(lat) at higher latitudes; matching the lat
                //envelope keeps the grid roughly square in physical km regardless of where the
                //home sits. The abs(cos) guard keeps the division well-behaved near the poles.
                const cosLat  = Math.max(0.1, Math.abs(Math.cos(this.homeLat * Math.PI / 180)));
                const halfLon = halfLat / cosLat;
                const south = this.homeLat - halfLat;
                const north = this.homeLat + halfLat;
                const west  = this.homeLon - halfLon;
                const east  = this.homeLon + halfLon;

                const lats = new Float32Array(N);
                const lons = new Float32Array(N);
                for (let i = 0; i < N; i++)
                {
                    lats[i] = south + (i / (N - 1)) * (north - south);
                    lons[i] = west  + (i / (N - 1)) * (east  - west);
                }

                //Flatten to (lat, lon) string pairs in row-major (lat-outer, lon-inner) order.
                //Open-Meteo's POST endpoint expects the same comma-separated string format the GET
                //query uses, placed in the body with application/x-www-form-urlencoded.
                const total: number = N * N;
                const flatLats: string[] = new Array(total);
                const flatLons: string[] = new Array(total);
                for (let iLat = 0; iLat < N; iLat++)
                {
                    for (let iLon = 0; iLon < N; iLon++)
                    {
                        flatLats[iLat * N + iLon] = lats[iLat].toFixed(4);
                        flatLons[iLat * N + iLon] = lons[iLon].toFixed(4);
                    }
                }

                //Multi-day hourly window in a single round-trip (2 past + today + 2 forecast) so
                //timeline scrub picks the right slice from cache without firing another HTTP
                //round-trip on every cursor move.
                const body = 'latitude='   + flatLats.join(',')
                           + '&longitude=' + flatLons.join(',')
                           + '&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high'
                           + '&models=best_match'
                           + '&forecast_days=3&past_days=2&timezone=UTC';
                const resp = await fetch('https://api.open-meteo.com/v1/forecast', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body,
                    signal,
                });
                if (!resp.ok)
                {
                    throw new Error(`Open-Meteo cloud grid HTTP ${resp.status}`);
                }
                const j: any = await resp.json();
                const results: any[] = Array.isArray(j) ? j : [j];
                if (results.length === 0 || !results[0]?.hourly?.time)
                {
                    throw new Error('Open-Meteo cloud grid: empty payload');
                }
                const timeStrs: string[] = results[0].hourly.time;
                const times: Date[] = timeStrs.map(s => new Date(s + 'Z'));
                const nTimes = times.length;

                //Pack the per-point hourly cloud series row-major: point outer, time inner. Cuts
                //the renderer's per-cell read down to one indexed lookup per band without an
                //intermediate slice copy on every scrub cursor move.
                const cloudLow  = new Float32Array(total * nTimes);
                const cloudMid  = new Float32Array(total * nTimes);
                const cloudHigh = new Float32Array(total * nTimes);
                for (let p = 0; p < total; p++)
                {
                    const r  = results[p];
                    const lo = r?.hourly?.cloud_cover_low  ?? [];
                    const mi = r?.hourly?.cloud_cover_mid  ?? [];
                    const hi = r?.hourly?.cloud_cover_high ?? [];
                    const base = p * nTimes;
                    for (let t = 0; t < nTimes; t++)
                    {
                        cloudLow[base + t]  = lo[t] ?? 0;
                        cloudMid[base + t]  = mi[t] ?? 0;
                        cloudHigh[base + t] = hi[t] ?? 0;
                    }
                }

                //Open-Meteo's response carries the resolved `model` per location; same model
                //across the grid in practice (the entire bbox sits in one regional model's
                //footprint), so reading the first sample is enough to label the overlay.
                const modelName = String(results[0]?.model ?? 'best_match');

                const grid =
                {
                    bounds: { south, north, west, east },
                    nLat:   N,
                    nLon:   N,
                    lats,
                    lons,
                    times,
                    cloudLow,
                    cloudMid,
                    cloudHigh,
                    modelName,
                    storedAt: Date.now(),
                };
                this._weatherCloudGrid = grid;
                this._writeWeatherCloudGridToCache(grid);
                //Push the fresh payload into the active shader layer, if any. No-op when the
                //layer isn't mounted yet (the card will instantiate it once we return).
                this.reuploadCloudShaderFromGrid(this._weatherCloudShownTimeIdx >= 0
                    ? this._weatherCloudShownTimeIdx : 0);
            }
            catch (e: any)
            {
                if (e?.name !== 'AbortError')
                {
                    console.warn('[HELIOS] weather cloud grid fetch failed:', e);
                }
            }
        })();

        this._weatherCloudGridPending = fetchPromise;
        try { await fetchPromise; }
        finally
        {
            if (this._weatherCloudGridPending === fetchPromise) { this._weatherCloudGridPending = null; }
        }
    }

    //Start the periodic refresh that keeps the cloud grid current while the user lingers in
    //weather mode. Idempotent: a second call while the timer is already armed is a no-op.
    public startWeatherCloudRefresh(): void
    {
        if (this._weatherCloudGridRefreshTimer !== undefined) { return; }
        this._weatherCloudGridRefreshTimer = window.setInterval(() =>
        {
            void this.ensureWeatherCloudGrid();
        }, HeliosEngine._WEATHER_GRID_REFRESH_MS);
    }

    public stopWeatherCloudRefresh(): void
    {
        if (this._weatherCloudGridRefreshTimer !== undefined)
        {
            window.clearInterval(this._weatherCloudGridRefreshTimer);
            this._weatherCloudGridRefreshTimer = undefined;
        }
        //Abort any in-flight grid fetch so a user leaving weather mode mid-fetch doesn't keep the
        //POST alive against Open-Meteo. The cache write inside the catch path is guarded against
        //AbortError so a cancelled fetch leaves the previous cached grid untouched.
        this._weatherCloudGridAbort?.abort();
        this._weatherCloudGridAbort = null;
    }

    //Attach the GPU cloud overlay to the active MapLibre style. Idempotent: a second call while
    //the layer is already mounted refreshes the data + visibility state instead of mounting a
    //duplicate. Reads `--primary-text-color` off the supplied host element so the shader output
    //matches the active HA theme; falls back to white if the var is unresolved.
    public addCloudShaderLayer(host: HTMLElement | null,
                               bandsVisible: [boolean, boolean, boolean],
                               timeIdx: number): void
    {
        if (!this.map) { return; }
        const grid = this._weatherCloudGrid;
        if (!grid) { return; }
        this._weatherCloudColor = this._readPrimaryTextColor(host);
        this._weatherCloudBandsVisible = [...bandsVisible] as [boolean, boolean, boolean];
        this._weatherCloudShownTimeIdx = Math.max(0, Math.min(grid.times.length - 1, timeIdx));
        const slice = this._sliceCloudGridForTime(this._weatherCloudShownTimeIdx);
        if (this._weatherCloudLayer)
        {
            this._weatherCloudLayer.updateData({
                color:        this._weatherCloudColor,
                gridSide:     grid.nLat,
                bbox:         { west:  grid.bounds.west,  south: grid.bounds.south,
                                east:  grid.bounds.east,  north: grid.bounds.north },
                cloudLow:     slice.low,
                cloudMid:     slice.mid,
                cloudHigh:    slice.high,
                bandsVisible: this._weatherCloudBandsVisible,
            });
            return;
        }
        this._weatherCloudLayer = new WeatherCloudLayer({
            color:        this._weatherCloudColor,
            gridSide:     grid.nLat,
            bbox:         { west:  grid.bounds.west,  south: grid.bounds.south,
                            east:  grid.bounds.east,  north: grid.bounds.north },
            cloudLow:     slice.low,
            cloudMid:     slice.mid,
            cloudHigh:    slice.high,
            bandsVisible: this._weatherCloudBandsVisible,
        });
        try { this.map.addLayer(this._weatherCloudLayer); }
        catch (e) { console.warn('[HELIOS] weather cloud shader layer addLayer failed:', e); }
    }

    //Detach the GPU cloud overlay. Safe to call when the layer is already absent.
    public removeCloudShaderLayer(): void
    {
        if (!this._weatherCloudLayer) { return; }
        try { this.map?.removeLayer(this._weatherCloudLayer.id); }
        catch { /* style swapped underneath us, layer already gone */ }
        this._weatherCloudLayer = null;
        this._weatherCloudShownTimeIdx = -1;
    }

    //Re-upload the data texture for a different hour in the cached grid. Called on every timeline
    //scrub move; the cost is one ~400-byte texture upload, well below the cost of the map repaint
    //the call triggers anyway.
    public refreshCloudShaderTime(timeIdx: number): void
    {
        if (!this._weatherCloudLayer || !this._weatherCloudGrid) { return; }
        const clamped = Math.max(0, Math.min(this._weatherCloudGrid.times.length - 1, timeIdx));
        if (clamped === this._weatherCloudShownTimeIdx) { return; }
        this._weatherCloudShownTimeIdx = clamped;
        const slice = this._sliceCloudGridForTime(clamped);
        this._weatherCloudLayer.updateData({
            cloudLow:  slice.low,
            cloudMid:  slice.mid,
            cloudHigh: slice.high,
        });
    }

    //Toggle individual altitude bands without re-uploading the texture. Card-side button clicks
    //call straight through here.
    public setCloudShaderBands(bandsVisible: [boolean, boolean, boolean]): void
    {
        this._weatherCloudBandsVisible = [...bandsVisible] as [boolean, boolean, boolean];
        this._weatherCloudLayer?.updateData({ bandsVisible: this._weatherCloudBandsVisible });
    }

    //After a fresh grid lands (network or cache hit), push the new payload into the layer + reset
    //the shown time index since the grid timeline shifted underneath us.
    public reuploadCloudShaderFromGrid(timeIdx: number): void
    {
        const grid = this._weatherCloudGrid;
        if (!this._weatherCloudLayer || !grid) { return; }
        this._weatherCloudShownTimeIdx = Math.max(0, Math.min(grid.times.length - 1, timeIdx));
        const slice = this._sliceCloudGridForTime(this._weatherCloudShownTimeIdx);
        this._weatherCloudLayer.updateData({
            gridSide:  grid.nLat,
            bbox:      { west:  grid.bounds.west,  south: grid.bounds.south,
                         east:  grid.bounds.east,  north: grid.bounds.north },
            cloudLow:  slice.low,
            cloudMid:  slice.mid,
            cloudHigh: slice.high,
        });
    }

    //Extract a single hour from the packed [pointIdx * nTimes + timeIdx] storage into three flat
    //N x N arrays the shader uploads as the R / G / B channels of its data texture.
    private _sliceCloudGridForTime(timeIdx: number):
        { low: Float32Array; mid: Float32Array; high: Float32Array }
    {
        const grid = this._weatherCloudGrid!;
        const N      = grid.nLat;
        const total  = N * N;
        const nTimes = grid.times.length;
        const low    = new Float32Array(total);
        const mid    = new Float32Array(total);
        const high   = new Float32Array(total);
        for (let p = 0; p < total; p++)
        {
            const idx = p * nTimes + timeIdx;
            low [p] = grid.cloudLow [idx];
            mid [p] = grid.cloudMid [idx];
            high[p] = grid.cloudHigh[idx];
        }
        return { low, mid, high };
    }

    //Resolve --primary-text-color off the supplied host element (the live <helios-card> root) and
    //convert to a normalised RGB triplet for the shader. Falls back to white when the variable is
    //unset or unparseable, which keeps the overlay visible against any basemap rather than going
    //transparent.
    private _readPrimaryTextColor(host: HTMLElement | null): [number, number, number]
    {
        if (!host) { return [1, 1, 1]; }
        try
        {
            const raw = getComputedStyle(host).getPropertyValue('--primary-text-color')?.trim() ?? '';
            const parsed = this._parseCssColor(raw);
            if (parsed) { return parsed; }
        }
        catch { /* getComputedStyle on a detached node */ }
        return [1, 1, 1];
    }

    //Minimal CSS colour parser: accepts #rgb / #rrggbb / rgb(...) / rgba(...). Returns null on
    //anything else so the caller falls back to white.
    private _parseCssColor(s: string): [number, number, number] | null
    {
        if (!s) { return null; }
        const hex = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
        if (hex)
        {
            let h = hex[1];
            if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
            const r = parseInt(h.slice(0, 2), 16) / 255;
            const g = parseInt(h.slice(2, 4), 16) / 255;
            const b = parseInt(h.slice(4, 6), 16) / 255;
            return [r, g, b];
        }
        const rgb = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (rgb)
        {
            return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
        }
        return null;
    }

    //Lat / lon -> screen pixel projection via MapLibre's own camera transform. Used by the SVG
    //cloud overlay to position the per-cell polygons at the right on-screen coordinates without
    //re-implementing the Mercator math. Returns null when the map is not ready.
    public projectLonLat(lon: number, lat: number): { x: number; y: number } | null
    {
        if (!this.map) { return null; }
        const p = this.map.project([lon, lat]);
        return { x: p.x, y: p.y };
    }

    //Auto-rotation state. The map slowly orbits the home in the
    //opposite direction to the sun's apparent motion (decreasing
    //bearing, ~1.5°/s) when the user has been idle for a few
    //seconds. Any direct interaction resets the inactivity timer,
    //so the rotation pauses immediately on pinch / drag / wheel
    //and resumes from the user's bearing once they let go.
    _autoRotateRaf?:           number;
    _autoRotateLastFrame:      number = 0;
    _autoRotateLastUserAction: number = 0;

    //MapLibre canvas reference, captured at init so cleanup() can
    //detach our WebGL context listeners against the same node. Held
    //separately because map.getCanvas() returns null once map.remove()
    //has run.
    private _mapCanvas?: HTMLCanvasElement;

    //Single-pointer drag-rotate state. We disable MapLibre's default
    //right-click dragRotate and replace it with a pointer-driven
    //rotation that responds to left-click on desktop and to a single
    //finger drag on touch, what users intuitively expect on a 3D
    //card. The two-finger pinch-rotate path (touchZoomRotate) is
    //preserved so two-finger rotation still works on touch.
    private _dragRotateHandlers?: {
        canvas:  HTMLCanvasElement;
        onDown:  (e: PointerEvent) => void;
        onMove:  (e: PointerEvent) => void;
        onEnd:   (e: PointerEvent) => void;
    };

    //Stored references for every map.on() / canvas.addEventListener
    //we register on the MapLibre map and its canvas. cleanup() uses
    //these to call map.off() / removeEventListener explicitly before
    //map.remove(), so a buggy map.remove() (which we've seen on iOS
    //Safari) can't leave dangling closures that keep the dead engine
    //+ its GeoJSON + its WebGL context alive across re-inits.
    private _mapPinHandler?:       (e: { originalEvent?: unknown }) => void;
    private _mapStyleLoadHandler?: () => void;
    private _mapLoadHandler?:      () => void;
    private _mapMoveHandler?:      () => void;
    //Stored ref to the styleimagemissing handler so cleanup() can map.off() it. Anonymous lambda inlined in the original registration
    //meant the closure (which pins `this`) survived past cleanup whenever MapLibre's own map.remove() didn't fan out to listener
    //teardown, the iOS Safari path defensive-cleanup is wired around.
    private _mapStyleImageMissingHandler?: (e: { id?: string }) => void;
    private _mapErrorHandler?:     (e: { error?: { message?: string } }) => void;
    private _webglLostHandler?:    (e: Event) => void;
    private _webglRestoredHandler?: () => void;

    //Card-level hook fired when the WebGL context has been lost
    //(iOS Safari aggressively recycles WebGL contexts under memory
    //pressure). The card listens and triggers a clean re-init.
    public onContextLost?: () => void;

    //Cached result of the building fetch around the home. The home
    //doesn't move during a session, so we fetch once and reuse the
    //GeoJSON across style reloads (theme switches, basemap changes)
    //instead of hitting the MapTiler API again. Invalidated when the
    //building-radius config option changes.
    private _buildingsData:     BuildingsResult | null = null;
    private _buildingsFetchKey: string = '';
    private _buildingsAbort?:   AbortController;

    //Last cloud-cover percentage applied to the on-card cloud disc.
    //Cached here so projectCloudScene() can re-project the polygons
    //on every map transform without having to round-trip back
    //through _renderForCurrentSelection.
    private _currentCloudPct: number = 0;
    //Per-layer breakdown captured at the same instant, used by
    //projectCloudScene() to size the three concentric bands
    //(low → mid → high, from centre to edge) proportionally to
    //each layer's contribution to the total.
    private _currentCloudLow:  number = 0;
    private _currentCloudMid:  number = 0;
    private _currentCloudHigh: number = 0;

    //Consolidated LiDAR shadow regions for the current home + radius
    //+ precision combination. Null until the first fetch lands; the
    //shadow projector reads this on every sun-position refresh.
    private _lidarShadowFeatures: GeoJSON.FeatureCollection | null = null;
    //Diagnostics from the most recent LiDAR shadow fetch, surfaced via
    //`window.heliosStats()` (cells kept above the height threshold,
    //per-clump cell cap derived from the raster pitch, height range
    //of the surviving cells).
    private _lidarShadowDiagnostics:
        { cellsKept: number; cellsPerClumpCap: number; heightRangeM: [number, number] | null }
        | null = null;
    //Fetch-key for the cached LiDAR shadow features. Lets us skip a refetch when the user nudges the camera but home/radius/precision haven't
    //changed.
    private _lidarShadowKey: string = '';
    //In-flight LiDAR shadow fetch, aborted when home/radius/precision changes so a slow IGN response can't overwrite a fresher request.
    private _lidarShadowAbort?: AbortController;
    //Exponential-backoff state for the LiDAR fetch. When a provider returns persistent errors (CORS misconfig, 4xx, network down, the
    //Polish geoportal serving Status 200 without Access-Control-Allow-Origin headers, etc.), retrying every sky tick downloads several
    //MB of payload per attempt and discards it. On busy networks or pages where the browser's paint is occasionally throttled (macOS
    //menu open, background tab), the cumulative effect produces a visible framerate hit. The backoff guard suppresses retries against
    //the SAME failed key for an increasing window (60 s → 5 min → 15 min → 30 min → 60 min cap), then re-tries fresh. Any key change
    //(user moves home, edits radius / precision, toggles shadows-enabled) bypasses the guard and tries immediately because the
    //configuration is different.
    private _lidarShadowFailedKey:    string = '';
    private _lidarShadowFailureCount: number = 0;
    private _lidarShadowBackoffUntil: number = 0;
    //Raw height raster + geo kept around for the LiDAR View overlay
    //(projects every cell, threshold-bypassed, to screen).
    //Cleared whenever the fetch path resets `_lidarShadowFeatures`
    //so the two stay in lockstep, the View overlay never out-lives
    //the cast-shadow set it was sampled from. Held as a reference
    //to the buffer the provider returned; no copy, no extra mem.
    private _lidarRaster:
        {
            heights:    Float32Array;
            terrain?:   Float32Array;
            rasterSize: number;
            minLat:     number;
            maxLat:     number;
            minLon:     number;
            maxLon:     number;
        }
        | null = null;

    //Custom MapLibre layer rendering the LiDAR View dot cloud directly
    //on the GPU. Owns one Float32 buffer with the Mercator triplet of
    //each finite cell, rebuilt only when a new raster lands; per frame
    //the shader projects + radius-filters all points in a single
    //drawArrays(POINTS) call. Replaces the old CPU-bake / 2D canvas
    //path, which couldn't keep up past a few hundred thousand cells.
    private _lidarViewLayer?: LidarViewLayer;

    //Offscreen canvas used to rasterise cast shadows before uploading
    //them to the MapLibre image source. Lives for the whole engine
    //lifetime so we don't realloc on every sun tick. Sized at
    //SHADOW_RASTER_SIZE; bounds are recomputed per refresh from the
    //home + building-radius.
    private _shadowCanvas?: HTMLCanvasElement;

    //Debounce timer for the shadow / atmosphere refresh during a
    //rapid scrub. Each setSelectedTime() call resets the timer; the
    //actual refresh runs once when the timer expires. Keeps the
    //live scrub gesture responsive (the curves + chips still
    //update on every move; only the shadow raster paint, which is
    //the costly bit at lidar-precision: high, is coalesced).
    private _selectedTimeShadowTimer: number | null = null;

    //Cache of the 96 per-day sun arc samples. Sun position + clear-sky irradiance depend only on the calendar day and the cloud cover, not on the
    //live map matrix, so we recompute the heavy trig only when those inputs change. On every transform / rotation tick the cached lon/lat/altitudeM
    //tuples are re-projected through the current map matrix and that's it. Invalidated when day rolls or the live cloud cover shifts by more than a
    //whole percent.
    private _arcInputsCache?: {
        dayStartMs: number;
        cloudPctInt: number;
        samples: Array<{
            lon: number;
            lat: number;
            altitudeM: number;
            wm2: number;
            belowHorizon: boolean;
        } | null>;
    };

    //Last signature of the shadow raster inputs (sun position rounded,
    //home, radius, source-features identity + length). When unchanged
    //we skip the project + paint + PNG-encode round-trip entirely,
    //which is the single most expensive recurring op on a refresh
    //driven by something other than actual sun movement.
    private _lastShadowSig?: string;

    //Card-side hooks for the LiDAR shadow compute pass so the card
    //can surface a busy indicator while the WMS round-trip + raster
    //paint run. Both are optional; the engine still computes
    //silently if the card hasn't set them.
    public onShadowComputeStart?: () => void;
    public onShadowComputeEnd?:   () => void;
    //Same shape as the shadow compute callbacks: the card subscribes
    //so it can swap the LiDAR mode-bar icon to a spinner and lock
    //mode-switching while a fresh exposure sweep is in flight.
    public onLidarExposureBusyChange?: (busy: boolean) => void;

    constructor(
        container:    HTMLElement,
        config:       HeliosConfig,
        haCoords:     [number, number],
        haElevation?: number
    )
    {
        this.homeLat = haCoords[1];
        this.homeLon = haCoords[0];
        this.homeElevation = (typeof haElevation === 'number' && Number.isFinite(haElevation))
            ? haElevation
            : undefined;
        this.cfg     = { ...config };

        bumpStat('enginesCreated');

        //Evict the oldest live engine if we're at the cap. Set iteration follows insertion order so the first value is the longest-lived, typically
        //an orphaned editor-preview engine the user can no longer see.
        while (_liveEngines.size >= MAX_LIVE_ENGINES)
        {
            const oldest = _liveEngines.values().next().value;
            if (!oldest)
            {
                break;
            }
            console.warn('[HELIOS] WebGL context cap reached, force-cleaning the oldest engine');
            try { oldest.cleanup(); }
            catch (_) {}
            //cleanup() removes it from the set, but be defensive in
            //case it threw before reaching that line.
            _liveEngines.delete(oldest);
        }
        _liveEngines.add(this);

        this._fetchLat = this.homeLat;
        this._fetchLon = this.homeLon;

        //Create the map immediately, regardless of container
        //dimensions at this exact tick. Several previous attempts
        //to defer init until ResizeObserver / IntersectionObserver
        //reported a "ready" container made things worse: in some
        //HA dashboard layouts (notably Masonry), neither observer
        //ever fires with conditions met against the container we
        //received in the constructor, so _initMapInstance was
        //never called and the map stayed null forever. The
        //post-load triple-resize + the 5 s tile-fetch watchdog
        //inside _initMapInstance now carry the safety net for any
        //0 x 0-at-init edge case.
        this._initMapInstance(container, haCoords);
    }

    private _initMapInstance(container: HTMLElement, haCoords: [number, number]): void
    {
        //Pixel ratio caps. At pitch 55° + continuous auto-rotation,
        //each rendered pixel is sampled multiple times (extrusion,
        //basemap, shadow raster), so the desktop cap sits at 2 (not
        //the native 2-3 of Retina) and mobile at 1.25, slashing per-
        //frame fragment work without a visible quality regression on
        //the card-sized viewport.
        const pixelRatio = this._pixelRatio();

        const styleInfo = this._resolveMapStyle();
        //Track the URL we hand to the map at every setStyle (here +
        //inside setCardThemeIsDark). _onStyleLoad compares it to the
        //desired URL for the active _cardIsDark and re-triggers
        //setStyle when they diverge, which is how a polarity change
        //that landed before the first style.load gets caught up.
        this._currentStyleUrl = styleInfo.url;

        //Camera is locked on the home for zoom/pan/pitch, the data
        //only makes sense from this exact viewpoint. Rotation is the
        //only direct user input: spinning around the home lets them
        //read the sun trajectory from any compass angle. Bearing
        //auto-flips per hemisphere so noon always sits at the top
        //(NH: south up, SH: north up).
        this.map = new maplibregl.Map(
        {
            container,
            style:           styleInfo.url,
            center:          haCoords,
            zoom:            18,
            pitch:           this._initialPitch(),
            bearing:         this._initialBearing(),
            //MapLibre default maxPitch is 60, default minPitch is 0. Push our own bounds in so the
            //library's internals (animation easing, pinch-zoom-rotate, programmatic jumpTo / easeTo
            //fallbacks) can never bypass the floor / ceiling even when callers forget to clamp first.
            minPitch:        CAMERA_PITCH_MIN_DEG,
            maxPitch:        CAMERA_PITCH_MAX_DEG,
            //Zoom is locked to the resting pose. The 3D camera + LiDAR overlay are tuned for this single altitude, and letting the user wander
            //off-zoom only opened the door to "why does my card look different from the docs" screenshots. detail-mode separately raises maxZoom for
            //its dive animation and resets it on exit.
            minZoom:         18,
            maxZoom:         18,
            dragPan:         false,
            scrollZoom:      false,
            doubleClickZoom: false,
            //MapLibre's default dragRotate binds to right-click drag,
            //which is not what users expect on a 3D card. We disable
            //it and wire our own pointer handlers below so a left-click
            //drag (mouse) or single-finger drag (touch) rotates.
            dragRotate:      false,
            touchZoomRotate: true,
            touchPitch:      false,
            boxZoom:         false,
            keyboard:        false,
            pixelRatio,
            //Collapse the attribution control to a tiny "i" disc by
            //default. OSM / OpenFreeMap / OpenMapTiles require the
            //attribution to stay accessible (license terms), so we
            //can't hide it outright, but `compact: true` makes it a
            //single icon at the bottom-right of the canvas that
            //expands on click. Far less visual noise than the full
            //"MapLibre | OpenFreeMap © OpenMapTiles..." bar.
            attributionControl: { compact: true }
        });

        //ResizeObserver fires aggressively on iOS during orientation changes. We coalesce bursts into a single resize at the end.
        this._resizeObserver = new ResizeObserver(entries =>
        {
            //A resize invalidates the cached canvas dimensions stashed
            //in _projCache for the projection helper; drop it so the
            //next call samples the new size. Also refresh
            //_cachedCanvasCssW/H here so the projection path stays
            //on the cached values and never re-reads
            //canvas.clientWidth (which forces a layout flush).
            this._invalidateProjCache();
            const entry = entries[entries.length - 1];
            if (entry)
            {
                const cr = entry.contentRect;
                this._cachedCanvasCssW = cr.width  || this._cachedCanvasCssW;
                this._cachedCanvasCssH = cr.height || this._cachedCanvasCssH;
            }
            window.clearTimeout(this._resizeDebounceTimer);
            this._resizeDebounceTimer = window.setTimeout(() =>
            {
                if (this.map)
                {
                    requestAnimationFrame(() => this.map?.resize());
                }
            }, 80);
        });

        this._resizeObserver.observe(container);

        //Expose the map on the global window for in-browser
        //debugging. `__heliosMap.getStyle().layers` is the single
        //most useful thing when investigating layer / style issues.
        //Cheap to leave on; anyone with dev-tools open already has
        //full access to the page.
        try { (window as unknown as { __heliosMap?: MapLibreMap }).__heliosMap = this.map; }
        catch (_) {}

        //Sibling global for the editor's UI: the camera slider /
        //lock toggle needs setCameraBearing / setCameraPitch /
        //setCameraLocked, which live on this engine instance, not on
        //the bare map. Same cheap "anyone with dev-tools already has
        //the page" argument as __heliosMap above.
        try { (window as unknown as { __heliosEngine?: HeliosEngine }).__heliosEngine = this; }
        catch (_) {}

        //Lock the pinch-rotate pivot to the canvas centre. By default, TwoFingersTouchZoomRotateHandler rotates around the centroid of the two
        //fingers, visually, the home orbits around the pinch point during the gesture, very obvious on small cards. `around: 'center'` forces the
        //pivot to be the screen centre, which is exactly where the home projects, so the home stays pinned no matter where the fingers land.
        //
        //When camera-locked is true the pinch-rotate is disabled too so
        //the configured pose is the only pose the user ever sees.
        if (this.isCameraLocked())
        {
            this.map.touchZoomRotate.disable();
        }
        else
        {
            this.map.touchZoomRotate.enable({ around: 'center' });
        }

        //Hard pin the map centre on every user-driven transform: the
        //home must never leave the dead-centre of the card during a
        //rotate, and any sub-pixel drift accumulated by the bearing
        //handler at zoom 18 / pitch 55° gets corrected immediately.
        //We gate on `originalEvent` so future programmatic eases
        //(e.g. recenter()) can still animate freely without being
        //fought frame-by-frame by this snap.
        //
        //Bound to `move` only, never to `rotate`. Every rotation
        //gesture that shifts the centre fires `move` too, so the
        //rotate listener would only catch centre-preserving
        //rotations (a no-op for this handler) while doubling the
        //per-frame event count during drag.
        //
        //Re-entrancy guard: setCenter() synchronously fires another
        //`move` which would recurse back into this handler. The
        //`pinning` flag short-circuits the inner pass so we emit
        //exactly one corrective setCenter per user-driven frame.
        let pinning = false;
        this._mapPinHandler = (e: { originalEvent?: unknown }) =>
        {
            if (pinning)
            {
                return;
            }
            if (!this.map || !e?.originalEvent)
            {
                return;
            }
            const c = this.map.getCenter();
            if (c.lng === this.homeLon && c.lat === this.homeLat)
            {
                return;
            }
            pinning = true;
            try { this.map.setCenter([this.homeLon, this.homeLat]); }
            finally { pinning = false; }
        };
        this.map.on('move', this._mapPinHandler);

        this._mapStyleLoadHandler = () => this._onStyleLoad();
        this.map.on('style.load', this._mapStyleLoadHandler);

        this._mapLoadHandler = () =>
        {
            this.map?.resize();
            //Belt-and-suspenders against the Masonry layout: even though we delayed init until the container had real dimensions, the HA dashboard
            //may still settle one or two frames AFTER load fires. Force another resize on the next animation frame and on a short timeout so any
            //post-layout geometry change reaches MapLibre's tile manager and re-triggers tile fetches.
            requestAnimationFrame(() => this.map?.resize());
            window.setTimeout(() => this.map?.resize(), 400);
            //Clamp the camera to a bounding box scaled to the display radius around the home. No pan + no zoom in Helios so the camera never moves
            //anyway, but the bounds tell MapLibre's internal tile management not to consider areas outside the disc as "reachable", which reduces
            //speculative tile fetches at the edges of the pitched viewport during rotation.
            this._applyMapBounds();
            //Watchdog: 5 s after load, if MapLibre still has no
            //tile loaded for any of its sources (most likely cause:
            //the basemap source decided the viewport was empty at
            //fetch-decision time, which can happen if the container
            //was hidden/zero-sized at the wrong micro-instant), we
            //destroy + re-create the style. setStyle(currentUrl)
            //tears down custom layers, so the engine's setup logic
            //needs to re-run; cleanest is to fire a 'style.load'
            //event handler that re-registers them. Simpler for
            //this v1: just call setStyle which forces a full
            //re-fetch, the custom layers re-register inside the
            //existing style.load handler the engine already wires.
            window.setTimeout(() =>
            {
                if (!this.map)
                {
                    return;
                }
                if (this.map.areTilesLoaded())
                {
                    return;
                }
                if (!this.map.isStyleLoaded())
                {
                    return;
                }
                //No tile arrived in 5 s despite a fully-loaded style. Force a soft reload of the style URL, which makes MapLibre re-walk every source
                //and re-issue tile fetches for the current viewport.
                try
                {
                    const styleUrl = this._resolveMapStyle().url;
                    this.map.setStyle(styleUrl);
                }
                catch (_) { /* ignore, no recovery possible */ }
            }, 5000);
            startAutoRotateLoop(this);
        };
        this.map.on('load', this._mapLoadHandler);

        //OpenFreeMap's Liberty style references a couple of fill-
        //pattern sprites that aren't in the published sprite atlas
        //(`wood-pattern`, `swimming_pool`, ...). MapLibre logs a
        //noisy warning per missing image. Wire a styleimagemissing
        //handler that registers a 1×1 transparent stub for the
        //requested id so the layer falls through to its base color
        //without spamming the console. Cheap, idempotent because
        //hasImage() guards re-registration.
        this._mapStyleImageMissingHandler = (e: { id?: string }) =>
        {
            if (!this.map || !e?.id || this.map.hasImage(e.id))
            {
                return;
            }
            try
            {
                this.map.addImage(e.id, {
                    width:  1,
                    height: 1,
                    data:   new Uint8Array(4)   //RGBA, all zero = transparent
                });
            }
            catch (_) {}
        };
        this.map.on('styleimagemissing', this._mapStyleImageMissingHandler);

        //Map transform broadcaster, relays move events to the card so it can keep HTML overlays aligned with the underlying canvas. We listen on
        //`move` rather than `moveend` so the overlays track the camera frame-by-frame during programmatic animations rather than snapping at the end.
        //
        //Invalidating the per-frame projection cache here is what
        //lets _projectScenePoint() reuse a single proj matrix +
        //canvas-dimensions snapshot across all 200-500 calls it
        //sees per frame: every move ticks the cache, the next
        //projection rebuilds it, all subsequent projections in the
        //same frame reuse it.
        this._mapMoveHandler = () =>
        {
            this._invalidateProjCache();
            this.onMapTransform?.();
        };
        this.map.on('move', this._mapMoveHandler);

        //Auto-rotation pause is bumped ONLY by the single-pointer
        //drag-rotate handler below (onDown / onMove). Wheel zoom,
        //two-finger pinch-rotate and incidental touches leave the
        //orbit running, only an explicit single-finger drag (or
        //left-mouse drag on desktop) interrupts it.
        const canvas = this.map.getCanvas();
        this._mapCanvas = canvas;

        //Custom drag-rotate. Left-click drag on desktop, single-finger
        //drag on touch. Two-finger pinch-rotate still works via
        //MapLibre's touchZoomRotate handler (left enabled in init).
        //
        //MapLibre's canvas ships with touch-action: pan-x pan-y, which
        //reserves single-finger drags for native browser scrolling ,
        //pointer events for those gestures never reach our handler.
        //Overriding to touch-action: none means every gesture on the
        //canvas surface becomes a card interaction (the user scrolls
        //the dashboard by touching outside the card, the same way
        //Google Maps and other map widgets behave on mobile).
        canvas.style.touchAction = 'none';

        const ROTATE_SENSITIVITY_DEG_PER_PX = 0.35;
        //Vertical drag controls camera pitch. dy positive (drag down) tilts the camera flatter (less
        //top-down, more horizon-on), dy negative (drag up) tilts it back toward the bird's-eye. Bounds
        //pulled from the module-level CAMERA_PITCH_MIN_DEG / MAX so this handler stays in sync with
        //every other pitch entry point (MapLibre constructor, setCameraPitch, _initialPitch,
        //detail-mode dive target).
        const PITCH_SENSITIVITY_DEG_PER_PX = 0.30;
        let dragRotating  = false;
        let lastPointerX  = 0;
        let lastPointerY  = 0;
        let activeId: number | null = null;

        const onDown = (e: PointerEvent) =>
        {
            //Mouse: left button only. Touch / pen: always start.
            if (e.pointerType === 'mouse' && e.button !== 0)
            {
                return;
            }
            //Single-pointer rotation; ignore additional touches so the
            //two-finger pinch-rotate gesture stays with MapLibre.
            if (activeId !== null)
            {
                return;
            }
            //Swallow gestures during the post-exit cooldown so the click that dismissed the dashboard panel can't bleed into a fresh drag-rotate on
            //the canvas behind.
            if (this.isUserGestureSuppressed())
            {
                return;
            }
            //camera-locked: the user opted into a fixed pose so manual
            //drag-rotate / drag-pitch are inert. The toggle is exposed
            //in the editor UI section and is re-evaluated on every
            //pointerdown so flipping it in live preview disengages
            //immediately without an engine respawn.
            if (this.isCameraLocked())
            {
                return;
            }
            dragRotating = true;
            activeId     = e.pointerId;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
            this._autoRotateLastUserAction = Date.now();
            try { canvas.setPointerCapture(e.pointerId); }
            catch (_) {}
        };
        const onMove = (e: PointerEvent) =>
        {
            if (!dragRotating || !this.map || e.pointerId !== activeId)
            {
                return;
            }
            const dx = e.clientX - lastPointerX;
            const dy = e.clientY - lastPointerY;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
            this._autoRotateLastUserAction = Date.now();
            //Positive dx (drag right) bumps bearing up so the map
            //content under the finger / cursor follows the gesture
            //direction, what you'd intuitively expect on a touchable
            //3D widget. The negated form (subtract) read inverted on
            //both desktop and mobile.
            this.map.setBearing(this.map.getBearing() + dx * ROTATE_SENSITIVITY_DEG_PER_PX);
            //Vertical drag drives pitch. Subtract dy so drag UP tips
            //the horizon down (flatter pitch) and drag DOWN brings
            //the horizon up toward the bird's-eye. Clamp at the
            //session bounds so the camera can never look past the
            //ground.
            const nextPitch = Math.max(CAMERA_PITCH_MIN_DEG, Math.min(CAMERA_PITCH_MAX_DEG,
                this.map.getPitch() - dy * PITCH_SENSITIVITY_DEG_PER_PX));
            this.map.setPitch(nextPitch);
        };
        const onEnd = (e: PointerEvent) =>
        {
            if (e.pointerId !== activeId)
            {
                return;
            }
            dragRotating = false;
            activeId     = null;
            try { canvas.releasePointerCapture(e.pointerId); }
            catch (_) {}
        };
        canvas.addEventListener('pointerdown',   onDown);
        canvas.addEventListener('pointermove',   onMove);
        canvas.addEventListener('pointerup',     onEnd);
        canvas.addEventListener('pointercancel', onEnd);
        this._dragRotateHandlers = { canvas, onDown, onMove, onEnd };

        //WebGL context-loss recovery. iOS Safari recycles WebGL
        //contexts aggressively under memory pressure; without a
        //handler the canvas freezes on a black frame and the user
        //thinks the dashboard is broken. We preventDefault on the
        //lost event (which lets the browser try to restore), flip
        //_mapReady to false so dependent code path bails, and emit
        //onContextLost, the card uses that to fully tear down and
        //re-init the engine on the next animation frame.
        this._webglLostHandler = (e: Event) =>
        {
            e.preventDefault();
            bumpStat('contextLostEvents');
            this._mapReady = false;
            console.warn('[HELIOS] WebGL context lost, requesting card re-init');
            this.onContextLost?.();
        };
        this._webglRestoredHandler = () =>
        {
            console.info('[HELIOS] WebGL context restored');
        };
        canvas.addEventListener('webglcontextlost',     this._webglLostHandler,    false);
        canvas.addEventListener('webglcontextrestored', this._webglRestoredHandler, false);

        //Surface MapLibre internal errors (auth, tile fetch, WebGL) to
        //the browser console rather than letting them silently cascade.
        //Without this hook, an invalid API key just produces silent 403s
        //and the user sees a frozen card with no diagnostic.
        this._mapErrorHandler = (e: { error?: { message?: string } }) =>
        {
            const msg = e?.error?.message ?? 'unknown error';
            //Suppress noisy errors triggered by our own building-layer
            //suppression: we attempt setLayoutProperty / setPaintProperty
            //on layers that may already be removed during the suppression
            //sweep; MapLibre reports each as "Cannot style non-existing
            //layer X" but the outcome is the harmless intended one.
            if (msg.includes('non-existing layer'))
            {
                return;
            }
            console.warn('[HELIOS] MapLibre error:', msg);
        };
        this.map.on('error', this._mapErrorHandler);

        this._refreshWeather();
    }

    //Resolves the active OpenFreeMap style URL from `map-style` and
    //the active HA theme polarity. OpenFreeMap publishes a fixed set
    //of MapLibre styles at https://tiles.openfreemap.org/styles/<name>:
    //
    //  liberty  , full-colour OpenMapTiles look (default streets)
    //  positron , muted grey, very sober (minimal)
    //  fiord    , muted dark blue / slate-grey, used as the dark
    //             variant for both above. Chosen over OFM's `dark`
    //             style which clamps the background to near-black
    //             (rgb(12,12,12)) and is too oppressive at the small
    //             card viewport
    //             without losing the basemap content underneath.
    //
    //OFM has no separate light / dark pair per style; the dark style
    //is its own thing and replaces both Liberty and Positron when the
    //frontend theme is dark. Resolution matrix:
    //
    //   map-style: streets + theme light → liberty
    //   map-style: streets + theme dark  → fiord
    //   map-style: minimal + theme light → positron
    //   map-style: minimal + theme dark  → fiord
    //
    //All styles share the same vector tile source backing
    //engine/buildings.ts so style swaps keep the home + surroundings
    //GeoJSON cache intact.
    //
    //_cardIsDark is pushed by the card on every Lit update so the
    //basemap follows the active HA theme automatically.
    private _cardIsDark: boolean = false;
    //URL of the style that was passed to map.setStyle last. Compared
    //in _onStyleLoad against the desired style for the current
    //_cardIsDark + map-style; if they diverge (e.g. the card pushed
    //a polarity change before the first style.load fired) the engine
    //fires another setStyle so the basemap catches up. Also gates
    //against a redundant setStyle inside setCardThemeIsDark when the
    //style URL has not actually changed.
    private _currentStyleUrl?: string;

    public setCardThemeIsDark(isDark: boolean): void
    {
        if (this._cardIsDark === isDark)
        {
            return;
        }
        this._cardIsDark = isDark;
        if (!this.map)
        {
            return;
        }
        const next = this._resolveMapStyle().url;
        if (next === this._currentStyleUrl)
        {
            return;
        }
        //Defer the setStyle until the first style.load has fired;
        //setStyle during the cold-start window has surfaced as a
        //race where the buildings layers never get re-added, the
        //"buildings rarely show up" symptom users hit after a theme
        //flip lands during the engine spawn. _onStyleLoad's tail
        //compares the loaded URL to the desired one and re-triggers
        //setStyle in that case.
        if (!this._mapReady)
        {
            return;
        }
        this._currentStyleUrl = next;
        try { this.map.setStyle(next); }
        catch (_) {}
    }

    private _resolveMapStyle(): { url: string; styleName: string }
    {
        const raw    = String(this.cfg['map-style'] ?? 'streets').toLowerCase();
        const isDark = this._cardIsDark;

        let styleName: string;
        if (isDark)
        {
            styleName = 'fiord';
        }
        else if (raw === 'minimal')
        {
            styleName = 'positron';
        }
        else
        {
            styleName = 'liberty';
        }

        return {
            url:       `https://tiles.openfreemap.org/styles/${styleName}`,
            styleName
        };
    }

    //Resolve the WebGL canvas pixel ratio: device-native, capped at 2
    //on desktop and 1.25 on mobile so even retina screens stay within
    //the per-frame budget.
    private _pixelRatio(): number
    {
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
        return IS_MOBILE
            ? Math.min(Math.max(dpr, 1), 1.25)
            : Math.min(Math.max(dpr, 1.5), 2);
    }

    //Reads the user-configured shadow precision, normalises any off-spec value to the default and returns one of the canonical LidarPrecisionLevel
    //members.
    private _lidarPrecisionLevel(): LidarPrecisionLevel
    {
        const v = String(this.cfg['lidar-precision'] ?? DEFAULT_LIDAR_PRECISION).toLowerCase();
        if (v === 'low' || v === 'medium' || v === 'high')
        {
            return v as LidarPrecisionLevel;
        }
        return DEFAULT_LIDAR_PRECISION;
    }

    //Master shadow toggle. When false, no cast shadows are rendered
    //(neither LiDAR nor MapTiler). When true, the source is picked
    //based on whether a LiDAR provider covers the home.
    private _shadowsEnabled(): boolean
    {
        return this.cfg['shadows-enabled'] !== false;
    }

    private _shadowOpacity(): number
    {
        const raw = Number(this.cfg['shadow-opacity']);
        if (!Number.isFinite(raw))
        {
            return DEFAULT_SHADOW_OPACITY;
        }
        return Math.max(0, Math.min(1, raw));
    }


    private _findHourIndex(t: Date): number
    {
        const home = this._homeHourlyData;
        if (!home || !home.times.length)
        {
            return 0;
        }

        const target = t.getTime();
        const times  = home.times;
        let best     = 0;
        let bestDist = Math.abs(times[0].getTime() - target);

        for (let i = 1; i < times.length; i++)
        {
            const d = Math.abs(times[i].getTime() - target);
            if (d < bestDist)
            {
                bestDist = d;
                best     = i;
            }
            else if (d > bestDist)
            {
                break;
            }
        }

        return best;
    }

    //Resolve the weather variables at a given time as seen from the home location.
    //
    //Single source: _homeHourlyData, populated by fetchHomePointData.
    //If null (initial state, fetch failed, or fetch in flight) we
    //return the "empty" sentinel and let the timeline ramps render
    //as flat / hidden.
    //
    //Returns shortwave = -1 to mean "model didn't provide a value at
    //this hour", which the caller treats as "fall back to Haurwitz".
    private _getWeatherAtTime(t: Date): {
        cloudCover:     number;
        cloudLow:       number;
        cloudMid:       number;
        cloudHigh:      number;
        shortwave:      number;
        //2-metre air temperature in °C. NaN means the model didn't return one at this hour, callers fall back to "no thermal derating" rather than
        //guessing.
        temperatureC:   number;
        //10-metre wind speed in m/s. NaN means missing; same
        //fallback semantics as temperature.
        windMs:         number;
        cloudIntensity: CloudIntensity;
    }
    {
        const empty = {
            cloudCover:     0,
            cloudLow:       0,
            cloudMid:       0,
            cloudHigh:      0,
            shortwave:      -1,
            temperatureC:   NaN,
            windMs:         NaN,
            cloudIntensity: 'clear' as CloudIntensity
        };

        const home = this._homeHourlyData;
        if (!home || !home.times.length)
        {
            return empty;
        }

        const idx = this._findHourIndex(t);
        if (idx < 0 || idx >= home.times.length)
        {
            return empty;
        }

        const cc   = home.cloudCover[idx]  ?? 0;
        const cLow = home.cloudLow[idx]    ?? 0;
        const cMid = home.cloudMid[idx]    ?? 0;
        const cHi  = home.cloudHigh[idx]   ?? 0;
        const sw   = home.shortwave[idx]   ?? -1;
        const wc   = home.weatherCode[idx] ?? 0;
        const ta   = home.temperature[idx] ?? NaN;
        const ws   = home.windSpeed[idx]   ?? NaN;

        return {
            cloudCover:     cc,
            cloudLow:       cLow,
            cloudMid:       cMid,
            cloudHigh:      cHi,
            shortwave:      sw,
            temperatureC:   ta,
            windMs:         ws,
            cloudIntensity: weatherCodeToIntensity(wc, cc)
        };
    }

    //Same as the private _getTimeRange below but reachable from
    //the card so the 30 s clock tick can re-fetch the window after
    //a midnight day rollover. The internal callers go through the
    //private form so changes to the past-days budget stay one-stop.
    public getTimelineRange(): { start: Date; end: Date } | null
    {
        return this._getTimeRange();
    }

    //Visible timeline window. The Open-Meteo payload now stretches
    //7 past days so the dashboard forecast calibration has enough
    //room to average ratios, but the timeline UI itself clips to
    //the last 2 past days so the slider stays as scrubbable as
    //before. Calibration consumers reach the full payload through
    //`getTimelineSeries()`, which returns every hourly sample.
    private _getTimeRange(): { start: Date; end: Date } | null
    {
        const TIMELINE_PAST_DAYS    = 2;
        const TIMELINE_FORECAST_DAYS = 3;
        const home = this._homeHourlyData;

        //Open-Meteo path: derive the visible window from the live weather samples when they are available.
        //First sample at or after `today - past_days`, last available sample as the end.
        if (home && home.times.length)
        {
            const t = home.times;
            const last = t[t.length - 1];
            const today0 = new Date();
            today0.setHours(0, 0, 0, 0);
            const visibleStartMs = today0.getTime() - TIMELINE_PAST_DAYS * 24 * 3_600_000;
            let startIdx = 0;
            for (let i = 0; i < t.length; i++)
            {
                if (t[i].getTime() >= visibleStartMs) { startIdx = i; break; }
            }
            return { start: t[startIdx], end: last };
        }

        //Fallback when the Open-Meteo fetch failed (offline, CORS, 502, etc.). The timeline still has to
        //render so the user can scrub PV history / battery curves and read the live state; we just lose
        //the cloud / irradiance / forecast traces. Synthetic window: today midnight minus PAST_DAYS to
        //today midnight plus FORECAST_DAYS.
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const startMs = today0.getTime() - TIMELINE_PAST_DAYS * 24 * 3_600_000;
        const endMs   = today0.getTime() + TIMELINE_FORECAST_DAYS * 24 * 3_600_000;
        return { start: new Date(startMs), end: new Date(endMs) };
    }

    //Resolve the configured cloud colour, falling back to the design
    //system default. Returned as RGB so callers can build either an
    //opaque rgb() or a translucent rgba() string depending on the
    //surface being painted.
    private _resolvedCloudRgb(): RGB
    {
        //Colour configs are no longer consulted; the HA Energy palette
        //fallback flows from DEFAULT_CLOUD_RGB. The cloud disc lives
        //on the WebGL layer so it can't read CSS custom properties
        //directly; if a future iteration wants dynamic theme tracking
        //here we'll resolve `--secondary-text-color` via
        //getComputedStyle() on init and on style.load.
        return DEFAULT_CLOUD_RGB;
    }

    private _renderForCurrentSelection(): void
    {
        //Only the map is strictly required: _getWeatherAtTime returns sensible zero defaults when
        //_homeHourlyData is null, so the sun position + sun arc + scrub tooltip still update during a
        //scrub even when Open-Meteo is unreachable. Cloud / irradiance / forecast traces fall back to
        //their analytical defaults via the Haurwitz path and the (empty) cloud cover.
        if (!this.map)
        {
            return;
        }

        const t = this._selectedTime ?? new Date();
        const w = this._getWeatherAtTime(t);

        //Compute every irradiance candidate so the card can pick the
        //best available source. Priority order at render time:
        //  1. Sensor reading from the configured solar-radiation entity
        //     (when one was pushed and matches `t` within the window).
        //  2. shortwave_radiation_instant from Open-Meteo, when the
        //     model supplied it for this hour.
        //  3. Haurwitz (analytical clear-sky + Kasten-Czeplak cloud
        //     attenuation), the always-defined fallback used outside
        //     the model horizon.
        //Stays on the horizontal-panel path: these values are GHI
        //(global on horizontal). The tilt/azimuth transposition lives
        //in the card-side PV prediction helpers instead.
        const pvPowerHaurwitz = computePvPower(t, this.homeLat, this.homeLon, w.cloudCover);

        let pvPowerShortwave = -1;
        if (w.shortwave >= 0)
        {
            //shortwave is in W/m². Normalise against STC (1000 W/m²)
            //and clamp to [0, 100] so downstream code doesn't need
            //to know which source produced the value.
            pvPowerShortwave = Math.max(0, Math.min(100, w.shortwave / 1000 * 100));
        }

        const sensorWm2 = this._sensorIrradianceAt(t);
        const pvPowerSensor = sensorWm2 !== null
            ? Math.max(0, Math.min(100, sensorWm2 / 1000 * 100))
            : -1;

        //Pick the primary value to display, sensor beats model when
        //both exist (a thermopile at the home is closer to ground
        //truth than a gridded forecast), model beats analytical when
        //available, Haurwitz is always defined as the last resort.
        let pvPower:          number;
        let irradianceSource: IrradianceSource;
        if (pvPowerSensor >= 0)
        {
            pvPower          = pvPowerSensor;
            irradianceSource = 'sensor';
        }
        else if (pvPowerShortwave >= 0)
        {
            pvPower          = pvPowerShortwave;
            irradianceSource = 'shortwave';
        }
        else
        {
            pvPower          = pvPowerHaurwitz;
            irradianceSource = 'haurwitz';
        }

        this.onWeatherUpdate?.(
        {
            cloudCover:       w.cloudCover,
            cloudLow:         w.cloudLow,
            cloudMid:         w.cloudMid,
            cloudHigh:        w.cloudHigh,
            cloudIntensity:   w.cloudIntensity,
            timeRange:        this._getTimeRange(),
            isLiveTime:       this._selectedTime === null,
            pvPower,
            pvPowerHaurwitz,
            pvPowerShortwave,
            irradianceSource,
            temperatureC:     w.temperatureC,
            windMs:           w.windMs,
        });

        //Refresh the on-ground cloud-cover gauge: a coloured disc
        //whose radius reflects the current coverage percentage,
        //surrounded by a fixed 100 % reference ring. The per-layer
        //breakdown (low / mid / high) feeds the three-band split
        //inside the disc in projectCloudScene.
        this._updateCloudCoverDisc(w.cloudCover, w.cloudLow, w.cloudMid, w.cloudHigh);
    }

    private _onStyleLoad(): void
    {
        if (!this.map)
        {
            return;
        }
        const wasReady = this._mapReady;
        this._mapReady = true;

        //Catch-up setStyle: when the card pushed a polarity change
        //before the first style.load fired, setCardThemeIsDark stored
        //the new _cardIsDark but skipped the setStyle (the cold-start
        //race caused custom layers, especially the buildings, to not
        //get re-added reliably). Now that the map has loaded its
        //first style, re-evaluate and switch if the polarity wants
        //a different basemap. Skipped on the first style.load to
        //avoid an immediate redundant reload of the same URL we
        //just set up.
        if (!wasReady)
        {
            const desired = this._resolveMapStyle().url;
            if (this._currentStyleUrl && desired !== this._currentStyleUrl)
            {
                this._currentStyleUrl = desired;
                try { this.map.setStyle(desired); }
                catch (_) {}
                return;
            }
            this._currentStyleUrl = desired;
        }

        this.map.getStyle().layers?.forEach(l =>
        {
            if (l.type === 'raster')
            {
                try
                {
                    this.map!.setPaintProperty(l.id, 'raster-saturation', 0.10);
                    this.map!.setPaintProperty(l.id, 'raster-contrast',   0.05);
                }
                catch (_) {}
            }
        });

        //Layer order: night-shade first (it tints the ground), then
        //the cloud-cover disc (under the buildings so they emerge
        //through it as islands), then buildings on top. The 3D solar
        //overlays (arc, sun, incidence ray) live as HTML/SVG above
        //the canvas, a Three.js custom layer was tried and rejected
        //because MapLibre's compositor would overpaint it
        //unpredictably; HTML overlays sidestep the GL pipeline
        //entirely.
        this._initNightShade();
        this._initCloudCoverDisc();
        this._addBuildings();
        this._initLidarViewLayer();
        this._applyLabelVisibility();

        window.clearInterval(this._skyTimer);
        this._lastAtmosphereAlt = -999;
        this._refreshShadowsAndAtmosphere();
        //Sky/atmosphere refresh, every 60s. _refreshShadowsAndAtmosphere
        //internally short-circuits when the sun has not moved enough to
        //cause a visible change, so the cost on mobile is negligible.
        //Outer skip when paused (card invisible) so we don't even
        //enter the signature check + cache lookup until it's visible
        //again; saves the heaviest path (PNG re-encode on signature
        //miss) entirely while scrolled away.
        this._skyTimer = window.setInterval(() =>
        {
            if (this._paused)
            {
                return;
            }
            this._refreshShadowsAndAtmosphere();
        }, 60_000);

        if (this._homeHourlyData)
        {
            this._renderForCurrentSelection();
        }
    }

    //Night-shade overlay
    //
    //A full-world fill layer rendered above the satellite raster (and
    //above hillshade) but below buildings, dots, marker and labels.
    //
    //During daytime its opacity is 0 and it's visually inert. As the sun
    //drops below the horizon the layer fades in: increasing opacity and
    //shifting toward a deep navy / black colour. This gives the user a
    //clear visual cue that it is night, in a way that brightness/contrast
    //adjustments alone (which are clamped by MapLibre's raster paint
    //pipeline) cannot achieve. Sunrise and sunset get a warm tint mixed
    //in with low opacity so the satellite imagery stays readable while
    //subtly conveying the time of day.
    private _initNightShade(): void
    {
        if (!this.map)
        {
            return;
        }
        if (this.map.getLayer('helios-night-shade'))
        {
            this.map.removeLayer('helios-night-shade');
        }
        if (this.map.getSource('helios-night-shade'))
        {
            this.map.removeSource('helios-night-shade');
        }

        //Single polygon covering the whole web-mercator extent
        this.map.addSource('helios-night-shade',
        {
            type: 'geojson',
            data:
            {
                type: 'Feature',
                geometry:
                {
                    type: 'Polygon',
                    coordinates: [[
                        [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]
                    ]]
                },
                properties: {}
            }
        });

        this.map.addLayer(
        {
            id:     'helios-night-shade',
            type:   'fill',
            source: 'helios-night-shade',
            paint:
            {
                'fill-color':   '#020410',
                'fill-opacity': 0
            }
        });
    }

    //Cloud-cover disc setup.
    //
    //Two layers backed by a single GeoJSON source `helios-cloud-rings`.
    //The source carries two features identified by `properties.kind`:
    //  - 'disc' : a polygon whose radius is proportional to the
    //             current cloud-cover percentage (0..100). Painted
    //             via the `helios-cloud-disc` fill layer in the
    //             DEFAULT_CLOUD_COLOR_HEX tone (fixed, opacity-
    //             modulated through CLOUD_DISC_OPACITY).
    //  - 'ring' : a fixed-radius polygon at CLOUD_DISC_RADIUS_M, only
    //             ever rendered as an outline by `helios-cloud-ring`.
    //
    //Both features are inserted at startup with placeholder geometry
    //and refreshed by _updateCloudCoverDisc() whenever the cloud-cover
    //value changes (live tick or scrub).
    //
    //Z-order: this layer pair is added before the helios-buildings-*
    //layers, so buildings still emerge through the disc as opaque
    //islands. The home marker (added after buildings) stays on top
    //of everything.
    private _initCloudCoverDisc(): void
    {
        if (!this.map)
        {
            return;
        }

        //The cloud disc + 100 % ring live as a screen-space SVG overlay
        //in the card (see projectCloudScene + helios-card), projected
        //through _projectScenePoint with anchor at home so every vertex
        //shares the same ground-elevation reference and the rendered
        //shape stays a true circle regardless of terrain.
        //
        //Sweep any leftover map sources / layers that might still be in the style after a hot-reload, so the SVG-only pipeline runs clean.
        for (const lid of ['helios-cloud-disc', 'helios-cloud-disc-ring', 'helios-cloud-ring'])
        {
            if (this.map.getLayer(lid))
            {
                this.map.removeLayer(lid);
            }
        }
        if (this.map.getSource('helios-cloud-rings'))
        {
            this.map.removeSource('helios-cloud-rings');
        }
    }

    //Update the disc + ring geometry to reflect the given cloud cover percentage. Called from _renderForCurrentSelection so it ticks both with live
    //time progression and with manual scrubbing.
    //
    // cloudPct ∈ [0, 100]   , coverage at the home location now
    //
    //The ring (100 % reference) has fixed radius CLOUD_DISC_RADIUS_M.
    //The disc scales linearly: radius = CLOUD_DISC_RADIUS_M * pct/100.
    //At 0 % cloud cover the disc has zero radius, effectively
    //invisible, while the ring stays visible to anchor the gauge.
    //
    //Fixed cloud colour. The disc's *radius* already encodes the cloud-cover percentage (0 % =
    //invisible, 100 % = full ring); the tone stays solid so the cloud identity reads everywhere
    //identically. CLOUD_DISC_OPACITY (set on the layer's fill-opacity) handles the translucency
    //against the basemap so the disc never fully hides what's underneath.
    private _updateCloudCoverDisc(
        cloudPct: number,
        cloudLow:  number = 0,
        cloudMid:  number = 0,
        cloudHigh: number = 0
    ): void
    {
        //Stash the values; the SVG overlay in the card pulls them
        //back via projectCloudScene() on every map transform + clock
        //tick. Per-layer values feed the proportional band sizing
        //inside the disc (low → mid → high, centre to edge).
        this._currentCloudPct  = Math.max(0, Math.min(100, cloudPct));
        this._currentCloudLow  = Math.max(0, Math.min(100, cloudLow));
        this._currentCloudMid  = Math.max(0, Math.min(100, cloudMid));
        this._currentCloudHigh = Math.max(0, Math.min(100, cloudHigh));
    }

    //Project the cloud-cover disc + 100 % reference ring into screen
    //space. Returns null when the engine isn't ready yet (the card
    //then skips rendering this frame). Vertices are computed at sea-
    //level offsets around the home and projected with anchor at the
    //home's terrain elevation, so the resulting polygons stay true
    //circles regardless of the terrain mesh underneath.
    //
    //The disc is split into three concentric bands sized by the
    //per-layer cloud percentages: from the centre outward, low →
    //mid → high. Each band's radial width is proportional to its
    //layer's share of the total (low + mid + high), so a sky with
    //mostly high clouds shows a thick outer band and thin inner
    //ones, and vice versa. The TOTAL disc radius is still driven
    //by the effective cloud cover (unchanged), so the whole disc
    //grows / shrinks as the sky thickens.
    //
    //Geometrically we return three concentric polygons (rLow,
    //rMid = rLow + (mid/total) × R, rHigh = R) plus the existing
    //100 % reference ring. The card stacks them outer-first to
    //get the band appearance.
    public projectCloudScene(): {
        discLow:    Array<{ x: number; y: number }>;
        discMid:    Array<{ x: number; y: number }>;
        discHigh:   Array<{ x: number; y: number }>;
        ring:       Array<{ x: number; y: number }>;
        cloudHex:   string;
        cloudPct:   number;
        cloudLow:   number;
        cloudMid:   number;
        cloudHigh:  number;
    } | null
    {
        if (!this.map || !this._mapReady)
        {
            return null;
        }

        const pct  = this._currentCloudPct;
        const cLow = this._currentCloudLow;
        const cMid = this._currentCloudMid;
        const cHi  = this._currentCloudHigh;
        const R    = CLOUD_DISC_RADIUS_M * pct / 100;

        //Layer breakdown: each band's outer radius is the cumulative
        //share of low + mid (+ high) over the layer total. When all
        //three layers are zero the disc collapses to the home anchor
        //regardless of the effective percentage, that can only
        //happen with a degenerate weather sample, but the guard
        //below keeps the polygons non-degenerate.
        const total = cLow + cMid + cHi;
        const rLow  = total > 0 ? R * (cLow / total)                : 0;
        const rMid  = total > 0 ? R * ((cLow + cMid) / total)       : 0;
        const rHigh = R;
        const ringR = CLOUD_DISC_RADIUS_M;

        //Geographic circle vertices, not closed: the card emits SVG polygons which carry implicit closure.
        const lowGeo  = buildCirclePolygon(this.homeLon, this.homeLat,
                                           rLow,  CLOUD_CIRCLE_SEGMENTS);
        const midGeo  = buildCirclePolygon(this.homeLon, this.homeLat,
                                           rMid,  CLOUD_CIRCLE_SEGMENTS);
        const highGeo = buildCirclePolygon(this.homeLon, this.homeLat,
                                           rHigh, CLOUD_CIRCLE_SEGMENTS);
        const ringGeo = buildCirclePolygon(this.homeLon, this.homeLat,
                                           ringR, CLOUD_CIRCLE_SEGMENTS);

        //anchorAtHome: every vertex uses the home's queryTerrainElevation rather than its own. That keeps the projected polygon a true circle even
        //when the terrain bends between the home and the disc's edge.
        const projectGeo = (geo: Array<[number, number]>): Array<{ x: number; y: number }> =>
        {
            const out: Array<{ x: number; y: number }> = [];
            for (const [lon, lat] of geo)
            {
                const p = this._projectScenePoint(lon, lat, 0);
                if (p)
                {
                    out.push({ x: p.x, y: p.y });
                }
            }
            return out;
        };

        const discLow  = projectGeo(lowGeo);
        const discMid  = projectGeo(midGeo);
        const discHigh = projectGeo(highGeo);
        const ring     = projectGeo(ringGeo);

        if (discHigh.length < 3 && ring.length < 3)
        {
            return null;
        }

        const rgb      = this._resolvedCloudRgb();
        const cloudHex = '#'
            + rgb[0].toString(16).padStart(2, '0')
            + rgb[1].toString(16).padStart(2, '0')
            + rgb[2].toString(16).padStart(2, '0');

        return {
            discLow, discMid, discHigh, ring,
            cloudHex, cloudPct: pct,
            cloudLow: cLow, cloudMid: cMid, cloudHigh: cHi
        };
    }

    //Project the home building(s) into screen-space silhouettes.
    //Each home polygon contributes one entry containing the base
    //ring (projected at render_min_height) and the top ring
    //(projected at render_height). The card paints both rings plus
    //a quad per outer-ring edge into the cloud-disc SVG mask, the
    //union covers the exact extruded prism in screen space, even
    //for concave footprints (L, U) where a convex hull would cut
    //a too-large hole and expose terrain at the inner corners.
    //
    //Vertex elevation is queried per-vertex against the live terrain mesh, matching what MapLibre's fill-extrusion shader does internally so the
    //silhouette tracks the rendered extrusion exactly.
    //
    //Returns an empty array until the buildings GeoJSON has landed.
    public projectHomeFootprints(): Array<{
        base: Array<{ x: number; y: number }>;
        top:  Array<{ x: number; y: number }>;
    }>
    {
        if (!this.map || !this._mapReady)
        {
            return [];
        }
        const home = this._buildingsData?.home;
        if (!home || !home.features.length)
        {
            return [];
        }

        const out: Array<{
            base: Array<{ x: number; y: number }>;
            top:  Array<{ x: number; y: number }>;
        }> = [];
        for (const feat of home.features)
        {
            const geom = feat.geometry;
            if (!geom)
            {
                continue;
            }
            const props = (feat.properties ?? {}) as Record<string, unknown>;
            const topH  = typeof props['render_height']     === 'number' ? props['render_height']     as number : 0;
            const baseH = typeof props['render_min_height'] === 'number' ? props['render_min_height'] as number : 0;

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

                const baseRing: Array<{ x: number; y: number }> = [];
                const topRing:  Array<{ x: number; y: number }> = [];
                for (const p of outer)
                {
                    const lon = p[0], lat = p[1];
                    const pBase = this._projectScenePoint(lon, lat, baseH);
                    const pTop  = this._projectScenePoint(lon, lat, topH);
                    //Drop the whole vertex pair if either point is behind the camera, otherwise the side-wall quad would shear through the screen.
                    if (!pBase || !pTop)
                    {
                        continue;
                    }
                    baseRing.push({ x: pBase.x, y: pBase.y });
                    topRing .push({ x: pTop.x,  y: pTop.y  });
                }
                if (baseRing.length >= 3 && topRing.length >= 3)
                {
                    out.push({ base: baseRing, top: topRing });
                }
            }
        }
        return out;
    }

    //LiDAR View active flag. Pushed in by the card when the user toggles the View overlay on, so the LiDAR raster fetch path runs even when cast
    //shadows are disabled in the config. Without this, a user with shadows off would click the button and see an empty canvas because the raster
    //never gets fetched.
    private _lidarViewActive: boolean = false;
    public setLidarViewActive(on: boolean): void
    {
        if (on === this._lidarViewActive)
        {
            return;
        }
        this._lidarViewActive = on;
        //Going from off→on, kick the fetch path so the raster lands.
        //Going from on→off, no-op: the raster stays cached and the
        //next shadow refresh (if shadows come back on) reuses it.
        if (on)
        {
            this._ensureLidarFetched();
            //Force the next exposure compute to fire on the first sun refresh after the toggle, no matter how stale the cached last-known
            //sun is. The atmosphere loop runs on a 30 s tick so the user sees the lit / shadowed cells flip in within seconds of opening
            //LiDAR View.
            this._lastLidarExposureAlt = -999;
            this._lastLidarExposureAz  = -999;
            this._scheduleLidarExposureRecompute();
        }
        else
        {
            //Clear any pending compute and reset the layer's exposure override so a future re-enable starts from the constant-lit fallback
            //rather than ghosting the old shadows for a frame.
            const wasBusy = this._exposureIdleHandle !== undefined || this._exposureChunkRaf !== undefined;
            if (this._exposureIdleHandle !== undefined)
            {
                this._cancelIdleCb(this._exposureIdleHandle);
                this._exposureIdleHandle = undefined;
            }
            if (this._exposureChunkRaf !== undefined)
            {
                cancelAnimationFrame(this._exposureChunkRaf);
                this._exposureChunkRaf = undefined;
            }
            this._lidarViewLayer?.setExposure(null);
            if (wasBusy)
            {
                try { this.onLidarExposureBusyChange?.(false); } catch { /* */ }
            }
        }
    }


    //Cross-browser requestIdleCallback / cancelIdleCallback. Safari only shipped them in 2024, fall back to setTimeout(0) where the API is
    //missing so the compute still runs (it just doesn't get the deadline-friendly scheduling perk).
    private _requestIdleCb(cb: () => void): number
    {
        const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
        if (typeof w.requestIdleCallback === 'function')
        {
            return w.requestIdleCallback(cb, { timeout: 2000 });
        }
        return window.setTimeout(cb, 0);
    }
    private _cancelIdleCb(handle: number): void
    {
        const w = window as unknown as { cancelIdleCallback?: (h: number) => void };
        if (typeof w.cancelIdleCallback === 'function')
        {
            w.cancelIdleCallback(handle);
            return;
        }
        window.clearTimeout(handle);
    }


    //Schedule the LiDAR-View exposure compute. Kick-off via idle callback so the chunk loop never lands on a user-interactive frame; the
    //chunks themselves run inside requestAnimationFrame so each frame yields back to the browser between row-bands. Total wall time is the
    //same as the single-shot compute but the main thread stays responsive (chip fade-out plays smoothly, scrub keeps tracking the pointer).
    //No-op when LiDAR View is off, the raster isn't loaded yet, the layer instance isn't ready, or a compute is already in flight (either
    //queued in idle or mid-chunk via the rAF token).
    private _exposureChunkRaf: number | undefined;

    //True while a LiDAR exposure sweep is in flight (queued in idle
    //or chunked through rAF). The card polls this each render to swap
    //the mode-bar LiDAR icon for a spinner and to lock mode switches
    //so the user can't change modes mid-compute.
    public isLidarExposureBusy(): boolean
    {
        return this._exposureIdleHandle !== undefined
            || this._exposureChunkRaf  !== undefined;
    }

    private _scheduleLidarExposureRecompute(): void
    {
        //Pre-compute regardless of whether the LiDAR-View mode is
        //currently active. The compute is long (~200 ms-2 s on
        //high-precision rasters) and used to fire only on the
        //first user click into LiDAR-View, leaving the user staring
        //at a wireframe scaffold while the dot cloud filled in.
        //Running it in idle as soon as the raster lands means that
        //by the time the user opens the mode the exposure buffer
        //is already on the layer, the fade-in shows the finished
        //rendering.
        if (!this._lidarRaster || !this._lidarViewLayer)
        {
            return;
        }
        if (this._exposureIdleHandle !== undefined)
        {
            return;
        }
        if (this._exposureChunkRaf  !== undefined)
        {
            return;
        }
        try { this.onLidarExposureBusyChange?.(true); }
        catch { /* host callback errors must not break the schedule */ }
        this._exposureIdleHandle = this._requestIdleCb(() =>
        {
            this._exposureIdleHandle = undefined;
            if (!this._lidarRaster || !this._lidarViewLayer)
            {
                try { this.onLidarExposureBusyChange?.(false); } catch { /* */ }
                return;
            }
            const sun = getSunPosition(this._selectedTime ?? new Date(), this.homeLat, this.homeLon);
            if (!sun)
            {
                try { this.onLidarExposureBusyChange?.(false); } catch { /* */ }
                return;
            }
            const altDelta = Math.abs(sun.altitude - this._lastLidarExposureAlt);
            const azDelta  = Math.abs(sun.azimuth  - this._lastLidarExposureAz);
            if (altDelta < 0.5 && azDelta < 0.5)
            {
                //Gate hit, no compute scheduled, release the busy flag
                //we set optimistically above.
                try { this.onLidarExposureBusyChange?.(false); } catch { /* */ }
                return;
            }
            const r = this._lidarRaster;
            //NdsmRaster shape match: heights + rasterSize + bbox + optional terrain. The engine's _lidarRaster carries the same fields.
            const rasterRef = {
                heights:    r.heights,
                terrain:    r.terrain,
                rasterSize: r.rasterSize,
                minLat:     r.minLat,
                maxLat:     r.maxLat,
                minLon:     r.minLon,
                maxLon:     r.maxLon,
            };
            const out = new Uint8Array(rasterRef.rasterSize * rasterRef.rasterSize);
            //Pin the raster reference identity captured by the idle callback. If a provider / precision swap fires mid-sweep,
            //this._lidarRaster moves on while rasterRef stays pointing at the old data, so the tick can bail before posting an
            //exposure sized to the dead raster (which would otherwise paint nonsense for one frame).
            const capturedRaster = r;
            //8-row chunks fit comfortably under 16 ms even at high precision (rasterSize ~512: 8 × 512 × ~100 raymarch steps × ~12
            //ops per step ≈ 5 M ops per chunk, 4-8 ms on a hot core), so the browser keeps hitting 60 fps during the sweep. 32-row
            //chunks were overruning the frame budget at high precision and produced the visible 3-4 fps stutter on activation. rAF
            //overhead per tick is negligible (~0.1 ms), so the 4x extra ticks cost nothing relative to the gain.
            const CHUNK_ROWS = 8;
            let j = 0;
            const tick = (): void =>
            {
                if (!this._lidarRaster || !this._lidarViewLayer)
                {
                    this._exposureChunkRaf = undefined;
                    try { this.onLidarExposureBusyChange?.(false); } catch { /* */ }
                    return;
                }
                if (this._lidarRaster !== capturedRaster)
                {
                    //Raster swapped under us; drop this in-flight sweep and let the next schedule pick up the new one.
                    this._exposureChunkRaf = undefined;
                    //Don't drop the busy flag, the next schedule will keep it true.
                    this._scheduleLidarExposureRecompute();
                    return;
                }
                //Stale-sun bail: when the user scrubs the timeline aggressively while a sweep is in flight, the sun captured in this
                //closure can drift far from the current time-cursor. Re-sample the sun on the latest selectedTime each tick and, if
                //it diverged past the 0.5° gate, abort the chunk loop so the next schedule produces a fresh exposure aligned with
                //the cursor instead of locking the view on a stale frame for the rest of the sweep.
                const currentSun = getSunPosition(this._selectedTime ?? new Date(), this.homeLat, this.homeLon);
                if (currentSun
                 && (Math.abs(currentSun.altitude - sun.altitude) >= 0.5
                  || Math.abs(currentSun.azimuth  - sun.azimuth)  >= 0.5))
                {
                    this._exposureChunkRaf = undefined;
                    //Force a fresh recompute on the new sun, the gate would otherwise short-circuit because _lastLidarExposureAlt/Az
                    //haven't been advanced yet (this aborted sweep never landed).
                    this._lastLidarExposureAlt = -999;
                    this._lastLidarExposureAz  = -999;
                    //Stay busy, the next schedule keeps the spinner alive.
                    this._scheduleLidarExposureRecompute();
                    return;
                }
                const jEnd = Math.min(rasterRef.rasterSize, j + CHUNK_ROWS);
                computeLidarCellExposureRows(rasterRef, sun.altitude, sun.azimuth, j, jEnd, out);
                j = jEnd;
                if (j < rasterRef.rasterSize)
                {
                    this._exposureChunkRaf = requestAnimationFrame(tick);
                    return;
                }
                this._exposureChunkRaf = undefined;
                this._lidarViewLayer.setExposure(out);
                this._lastLidarExposureAlt = sun.altitude;
                this._lastLidarExposureAz  = sun.azimuth;
                try { this.onLidarExposureBusyChange?.(false); } catch { /* */ }
            };
            this._exposureChunkRaf = requestAnimationFrame(tick);
        });
    }

    //Wire (or rewire after a style reload) the WebGL custom layer that
    //paints the LiDAR View dot cloud on the map's own GL context. The
    //layer instance is created once per engine and reused across style
    //reloads; setStyle wipes layers but the JS object survives, so we
    //re-add it and replay the cached buffer + tunables.
    //
    //All steps that touch MapLibre are wrapped in try / catch: a
    //custom layer onAdd that throws can leave the painter with
    //polluted GL state (bound buffers, attrib enables) and silently
    //kill the basemap for the rest of the session. With the wrap, a
    //bad shader compile or a transient painter state just disables
    //our overlay instead of breaking the whole map.
    //
    //The addLayer call itself is deferred to the next animation frame.
    //style.load can fire before MapLibre's painter has finished
    //binding its default buffers; addLayer then synchronously invokes
    //our onAdd against a half-initialised context, which is exactly
    //the "map renders black until page refresh" symptom.
    private _initLidarViewLayer(): void
    {
        if (!this.map)
        {
            return;
        }
        try
        {
            if (!this._lidarViewLayer)
            {
                this._lidarViewLayer = new LidarViewLayer({
                    homeLat: this.homeLat,
                    homeLon: this.homeLon
                });
            }
            this._lidarViewLayer.setHome(this.homeLat, this.homeLon);
            this._pushLidarViewConfig();
            this._pushLidarViewFadeRange();

            const layer  = this._lidarViewLayer;
            const raster = this._lidarRaster;
            window.requestAnimationFrame(() =>
            {
                if (!this.map)
                {
                    return;
                }
                try
                {
                    if (!this.map.getLayer(layer.id))
                    {
                        this.map.addLayer(layer);
                    }
                    if (raster)
                    {
                        layer.setData(raster);
                    }
                }
                catch (err)
                {
                    console.warn('[HELIOS] LiDAR view layer attach failed:', err);
                }
            });
        }
        catch (err)
        {
            console.warn('[HELIOS] LiDAR view layer init failed:', err);
        }
    }

    //Runtime opacity for the LiDAR View overlay, [0..1]. Driven by the in-card bottom slider, not by config; resets to DEFAULT each engine
    //instance. Only the point size is still config-controlled; colours are hard-locked to white in the layer.
    private _lidarViewOpacity: number = DEFAULT_LIDAR_VIEW_OPACITY;

    //Push the current LiDAR View tuning to the layer. Called on init,
    //on updateConfig when point-size changes, and on setLidarViewOpacity
    //when the slider moves. The slider value is halved before being
    //handed to the layer (slider 100 % → layer 50 % alpha): the live
    //irradiance fill at full alpha carpets the basemap and swallows
    //the building topology underneath, so a 0.5 scale ceiling keeps
    //the layer readable even when the user dials the slider all the
    //way up.
    private _pushLidarViewConfig(): void
    {
        if (!this._lidarViewLayer)
        {
            return;
        }
        this._lidarViewLayer.setPointSizePx(this._lidarViewPointSizePx());
        this._lidarViewLayer.setOpacity(this._lidarViewOpacity * 0.5);
        this._pushLidarViewColor();
    }

    //Push the active theme's text colour into the LiDAR View layer so the points + wireframe render in
    //black on a light theme and white on a dark theme (or whatever the user themed their HA frontend
    //--primary-text-color to). Reads the computed CSS variable off the map container (which inherits the
    //ha-card theme) and parses the result into a 0..1 RGB triplet for the WebGL uniform.
    private _pushLidarViewColor(): void
    {
        if (!this._lidarViewLayer)
        {
            return;
        }
        const host = this.map?.getContainer() ?? document.body;
        let raw = getComputedStyle(host).getPropertyValue('--primary-text-color').trim();
        if (!raw)
        {
            //Fallback: walk up to ha-card / document to grab the variable from a higher scope.
            raw = getComputedStyle(document.documentElement).getPropertyValue('--primary-text-color').trim();
        }
        const rgb = parseCssColorToUnitRgb(raw);
        this._lidarViewLayer.setViewColor(rgb[0], rgb[1], rgb[2]);
    }

    //Push the LiDAR view fade range to the GL layer. Called once from _initLidarViewLayer and again
    //from updateConfig whenever the display radius changes, since the fade band is derived from the
    //live radius rather than a compile-time constant.
    private _pushLidarViewFadeRange(): void
    {
        if (!this._lidarViewLayer)
        {
            return;
        }
        const [fullR, fadeR] = this._lidarViewFadeRange();
        this._lidarViewLayer.setFadeRange(fullR, fadeR);
    }

    public setLidarViewOpacity(opacity: number): void
    {
        const clamped = Math.max(0, Math.min(1, opacity));
        if (clamped === this._lidarViewOpacity)
        {
            return;
        }
        this._lidarViewOpacity = clamped;
        //Direct push to skip even the _pushLidarViewConfig overhead, no other tunable changes during a slider drag.
        this._lidarViewLayer?.setOpacity(clamped * 0.5);
    }

    public getLidarViewOpacity(): number
    {
        return this._lidarViewOpacity;
    }

    //Fade alpha multiplier in [0..1]. Driven by the card's enter/exit
    //animation; the engine just forwards. When the View is off the
    //card keeps this at 0, the layer short-circuits its draw call.
    public setLidarViewFadeAlpha(alpha: number): void
    {
        this._lidarViewLayer?.setAlphaFade(alpha);
    }

    //Distance-based opacity fall-off bounds for the LiDAR view. Full opacity up to one fade-band
    //inside the display radius, smooth fade out at the radius itself. Derived from the live display
    //radius so buildings, raster shadows and the LiDAR overlay all stop at the same boundary and the
    //fade tracks a user-lowered radius instead of staying pinned to the 200 m default.
    private _lidarViewFadeRange(): [fullMeters: number, fadeMeters: number]
    {
        const radius = this._buildingRadiusMeters();
        return [Math.max(0, radius - DISPLAY_FADE_DELTA_M), radius];
    }

    private _lidarViewPointSizePx(): number
    {
        return 1.5;
    }

    //LiDAR View support, exposed to the card.
    //
    //getActiveLidarSourceId returns the id of the provider that
    //covers the home (e.g. 'de-nrw-ndom'), or null when no provider
    //covers it. Resolved on-demand against `resolveLidarSource`
    //rather than reading the cached `_lidarSourceId` field, so the
    //answer is correct from the very first render of the card,
    //independent of whether the shadow fetch path has had a chance
    //to run yet (or whether shadows are even enabled in the config).
    //
    //Memoised on (cfg, lat, lon) since the resolver allocates a
    //fresh provider object literal (including two closures for the
    //local nDSM source) on every call, and the card calls this on
    //every render. Without caching, scrubbing the timeline at
    //~120 Hz creates 120 provider objects per second.
    private _resolvedLidarIdCfg?:  HeliosConfig;
    private _resolvedLidarIdLat?:  number;
    private _resolvedLidarIdLon?:  number;
    private _resolvedLidarIdValue: string | null = null;
    public getActiveLidarSourceId(): string | null
    {
        if (this._resolvedLidarIdCfg === this.cfg
            && this._resolvedLidarIdLat === this.homeLat
            && this._resolvedLidarIdLon === this.homeLon)
        {
            return this._resolvedLidarIdValue;
        }
        const provider = resolveLidarSource(this.homeLat, this.homeLon, this.cfg);
        this._resolvedLidarIdCfg   = this.cfg;
        this._resolvedLidarIdLat   = this.homeLat;
        this._resolvedLidarIdLon   = this.homeLon;
        this._resolvedLidarIdValue = provider ? provider.id : null;
        return this._resolvedLidarIdValue;
    }

    //Toggle MapTiler's symbol layers (road names, house numbers,
    //POIs, place names) on or off based on the `show-labels` config.
    //Symbol-type layers are the canonical container for text + icon
    //rendering in MapLibre styles; flipping their `visibility` layout
    //property is enough to hide everything text-based without
    //touching the underlying geometry (roads, water, terrain). Our
    //own `helios-*` layers are skipped defensively in case a future
    //feature adds a symbol layer of our own.
    private _applyLabelVisibility(): void
    {
        if (!this.map)
        {
            return;
        }
        const showLabels = this.cfg['show-labels'] !== false;
        const visibility = showLabels ? 'visible' : 'none';
        const layers = this.map.getStyle().layers ?? [];
        for (const l of layers)
        {
            if (l.type !== 'symbol' || l.id.startsWith('helios-'))
            {
                continue;
            }
            try
            {
                this.map.setLayoutProperty(l.id, 'visibility', visibility);
            }
            catch (_) {}
        }
    }

    //Global display radius, shared by the basemap bbox, the building extent, the LiDAR overlay +
    //raster shadow extent, the projection clip and the MapLibre bounds so every layer stops at the
    //same boundary. Resolved from the `display-radius` editor slider (clamped 50-500 m, default 200);
    //lowering it shrinks every layer's geometry in lockstep, the primary perf lever on old phones.
    private _buildingRadiusMeters(): number
    {
        return displayRadiusM(this.cfg);
    }

    //Clamp MapLibre's camera bounds to a tight bbox around the home,
    //sized at 2x the display radius (small margin for the pitched
    //viewport corners). With pan + zoom disabled the camera never
    //moves anyway, but the bounds tell MapLibre the area outside
    //the disc is unreachable, which dampens speculative tile fetches
    //at the horizon of the pitched view during rotation. Re-called
    //after a config edit (building-radius change) re-runs the engine
    //init path so the bounds always match the live display radius.
    private _applyMapBounds(): void
    {
        if (!this.map)
        {
            return;
        }
        const radiusM   = this._buildingRadiusMeters();
        const halfBbox  = radiusM * 2;   //2 x radius keeps the pitched horizon inside
        const D         = Math.PI / 180;
        const mPerDegLat = 111_320;
        const mPerDegLon = 111_320 * Math.cos(this.homeLat * D);
        const dLat = halfBbox / mPerDegLat;
        const dLon = halfBbox / mPerDegLon;
        try
        {
            this.map.setMaxBounds([
                [this.homeLon - dLon, this.homeLat - dLat],
                [this.homeLon + dLon, this.homeLat + dLat],
            ]);
        }
        catch (_) { /* style not ready yet, retried via _mapLoadHandler */ }
    }

    //Resolves the configured surroundings opacity (0..1). Falls back
    //to DEFAULT_BUILDING_OPACITY for missing or invalid input.
    private _buildingOpacity(): number
    {
        const v = Number(this.cfg['building-opacity']);
        if (!Number.isFinite(v))
        {
            return DEFAULT_BUILDING_OPACITY;
        }
        return Math.min(1, Math.max(0, v));
    }

    //Resolves the cluster radius (metres), every building whose
    //centroid is within this radius (or which contains the home
    //point) becomes part of the home group at full opacity. Allows
    //attached verandas / outbuildings to read as one with the main
    //house. 0 = legacy "single-polygon home" behaviour.
    private _buildingClusterRadiusMeters(): number
    {
        const v = Number(this.cfg['building-cluster-radius']);
        if (!Number.isFinite(v) || v < 0)
        {
            return DEFAULT_BUILDING_CLUSTER_RADIUS_M;
        }
        return Math.min(100, v);
    }

    //Building base colour. Colour configs are no longer consulted,
    //the renderer falls back to the neutral grey baked into
    //DEFAULT_BUILDING_COLOR_HEX.
    private _buildingColor(): string
    {
        return DEFAULT_BUILDING_COLOR_HEX;
    }

    //Adds the two custom building layers around the home:
    //
    //  - helios-buildings-surroundings : every building within the
    //    configured radius of the home, painted at the configured
    //    opacity. Urban context without competing with the data overlays.
    //  - helios-buildings-home : the polygon containing the home
    //    coordinates, painted at full opacity in the same neutral grey.
    //    Reads as the focal point.
    //
    //The building GeoJSON is fetched once per (home, radius) combo
    //in engine/buildings.ts; subsequent calls (e.g. on theme switch,
    //which rebuilds the whole style) reuse the cached data.
    private _addBuildings(): void
    {
        bumpStat('addBuildingsCalls');
        if (!this.map)
        {
            return;
        }

        //Drop any stale helios-buildings* layer so re-runs of
        //_addBuildings (on style reload, theme switch, etc.) are
        //idempotent.
        for (const lid of [
            'helios-buildings',
            'helios-buildings-surroundings',
            'helios-buildings-home',
            'helios-buildings-home-outline',
            'helios-buildings-home-outline-glow'
        ])
        {
            if (this.map.getLayer(lid))
            {
                this.map.removeLayer(lid);
            }
        }

        //Suppress every native building layer the active style ships so they don't Z-fight against helios-buildings-* extrusions.
        //
        //MapLibre 5 styles can be assembled from style "imports". For
        //imported layers, `setLayoutProperty('visibility','none')` is
        //a silent no-op against the bare id and `removeLayer(bareId)`
        //may be too. The robust path: per import, set config flags off
        //(`3dBuildings`, `buildings3d`, etc.) AND attempt removal /
        //paint-zeroing under the scoped id `${importId}\\${layerId}`.
        //Paint pipelines and layout pipelines have independent guards
        //inside MapLibre, so opacity:0 may land even when visibility:
        //none didn't, we use both belt and suspenders.
        const styleObj = this.map.getStyle() as {
            layers?:  Array<{ id: string; type: string; 'source-layer'?: string }>;
            imports?: Array<{ id: string }>;
        };
        const allLayers = styleObj.layers ?? [];
        const imports   = styleObj.imports ?? [];
        const importIds = imports.map(i => i.id).filter(Boolean);

        //Identify every native building layer (3D or 2D).
        const buildingLayerIds: string[] = [];
        for (const l of allLayers)
        {
            if (l.id === 'helios-buildings-surroundings'
             || l.id === 'helios-buildings-home') continue;
            const sl = l['source-layer'];
            const isBuildingSrc = sl === 'building' || sl === 'building_3d';
            const isExtrusion   = l.type === 'fill-extrusion';
            const idMentions    = typeof l.id === 'string' && l.id.toLowerCase().includes('building');
            if (isBuildingSrc || isExtrusion || idMentions)
            {
                buildingLayerIds.push(l.id);
            }
        }

        //Strategy A, toggle the MapTiler v4 schema flags off, on every import. Each flag is best-effort: the wrong key just throws and is ignored.
        const buildingConfigKeys = [
            '3dBuildings',    'buildings3d',     'show3dBuildings',
            'show3DBuildings','building3D',      '2dBuildings',
            'buildings',      'showBuildings',   'show2dBuildings'
        ];
        for (const imp of imports)
        {
            for (const key of buildingConfigKeys)
            {
                try { (this.map as unknown as {
                    setConfigProperty: (id: string, k: string, v: unknown) => void
                }).setConfigProperty(imp.id, key, false); }
                catch (_) {}
            }
        }

        //Strategy B, for each building layer, attempt removal AND
        //paint-zeroing, using both the bare id and every scoped
        //variant `${importId}\\${layerId}`.
        const idCandidates = (layerId: string): string[] =>
        {
            const list = [layerId];
            for (const iid of importIds)
            {
                list.push(`${iid}\\${layerId}`);
            }
            return list;
        };

        for (const layerId of buildingLayerIds)
        {
            for (const cand of idCandidates(layerId))
            {
                //Skip candidates that don't correspond to a real layer in the merged style. Calling set* on a missing layer makes MapLibre fire an
                //"error" event the engine then echoes, gating at the source removes both the noise and the wasted dispatch.
                if (!this.map.getLayer(cand))
                {
                    continue;
                }

                try { this.map.removeLayer(cand); }
                catch (_) {}

                //If removeLayer worked, the layer is gone, done. The paint / layout fallbacks below are for the rare case of imported layers where
                //removeLayer is a silent no-op.
                if (!this.map.getLayer(cand))
                {
                    continue;
                }

                try { this.map.setLayoutProperty(cand, 'visibility', 'none'); }
                catch (_) {}
                try { this.map.setPaintProperty(cand, 'fill-extrusion-opacity', 0); }
                catch (_) {}
                try { this.map.setPaintProperty(cand, 'fill-extrusion-height',  0); }
                catch (_) {}
                try { this.map.setPaintProperty(cand, 'fill-opacity', 0); }
                catch (_) {}
            }
        }

        const opacity      = this._buildingOpacity();
        const baseColor    = this._buildingColor();
        const homeData     = this._buildingsData?.home
                          ?? { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
        const surrData     = this._buildingsData?.surroundings
                          ?? { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;

        if (!this.map.getSource('helios-buildings-surroundings-src'))
        {
            this.map.addSource('helios-buildings-surroundings-src',
            {
                type: 'geojson',
                data: surrData
            });
        }
        else
        {
            (this.map.getSource('helios-buildings-surroundings-src') as maplibregl.GeoJSONSource)
                .setData(surrData);
        }

        if (!this.map.getSource('helios-buildings-home-src'))
        {
            this.map.addSource('helios-buildings-home-src',
            {
                type: 'geojson',
                data: homeData
            });
        }
        else
        {
            (this.map.getSource('helios-buildings-home-src') as maplibregl.GeoJSONSource)
                .setData(homeData);
        }

        //Ground-projected shadows. Rendered as a single image source
        //(black mask painted from shadow polygons on an offscreen
        //canvas) drawn BEFORE the building extrusions so buildings
        //hide the under-building part of their own shadow; the
        //visible shadow is the spillover on the ground.
        //
        //Per-pixel rendering avoids the alpha-compositing saturation we'd get from many overlapping fill polygons in a dense forest. The image source
        //bounds match the building visibility bbox so the raster is exactly the same disc as the rendered surroundings.
        const shadowBounds: ShadowBoundsCorners = shadowBoundsCornersLL(this.homeLat, this.homeLon, this._buildingRadiusMeters());
        if (!this.map.getSource('helios-building-shadows-src'))
        {
            this.map.addSource('helios-building-shadows-src',
            {
                type:        'image',
                url:         BLANK_SHADOW_DATA_URL,
                coordinates: shadowBounds
            });
        }
        const shadowOpa = this._shadowOpacity();
        if (!this.map.getLayer('helios-building-shadows'))
        {
            this.map.addLayer(
            {
                id:     'helios-building-shadows',
                source: 'helios-building-shadows-src',
                type:   'raster',
                paint:
                {
                    'raster-opacity':       shadowOpa,
                    'raster-fade-duration': 0,
                    'raster-resampling':    'linear'
                }
            });
        }

        //Surroundings first, then home, so the home draws on top in
        //the rare case the polygons overlap (the home footprint
        //should also be absent from the surroundings collection, but
        //we don't rely on that for layering correctness).
        this.map.addLayer(
        {
            id:     'helios-buildings-surroundings',
            source: 'helios-buildings-surroundings-src',
            type:   'fill-extrusion',
            paint:
            {
                'fill-extrusion-color':   baseColor,
                //coalesce: features missing render_height / render_min_height fall back to 0
                //instead of evaluating the `get` to null, which MapLibre would otherwise log as
                //"expected number, got null" once per missing feature on every paint.
                'fill-extrusion-height':  ['coalesce', ['get', 'render_height'],     0],
                'fill-extrusion-base':    ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': opacity
            }
        });

        this.map.addLayer(
        {
            id:     'helios-buildings-home',
            source: 'helios-buildings-home-src',
            type:   'fill-extrusion',
            paint:
            {
                //Home buildings take the HA Energy grid-consumption
                //blue so the focal structure reads as the "home node"
                //of the dashboard rather than as another neutral
                //surrounding. Surroundings keep the configured /
                //default neutral baseColor.
                'fill-extrusion-color':   '#488fc2',
                'fill-extrusion-height':  ['coalesce', ['get', 'render_height'],     0],
                'fill-extrusion-base':    ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': 1
            }
        });

        //Home gets a black outline at the building's ground footprint
        //(see helios-buildings-home-outline below) so the focal
        //structure reads even when its colour matches the basemap.
        //Neighbouring buildings used to carry the same outline at a
        //lower opacity for cell-shaded depth, but the surrounding
        //lines piled up visually on dense streets and competed with
        //the LiDAR shadows for attention, so the surroundings stay
        //unstroked.
        //Kick off the MapTiler buildings fetch in the background.
        //The shadow source is wired and will populate as soon as the
        //buildings GeoJSON lands.
        this._ensureBuildingsFetched();

        //Wire the LiDAR shadow pipeline. No-op when shadows are off or the home is outside any provider's coverage.
        this._ensureLidarFetched();
    }

    //Idempotent fetch helper. Reuses _buildingsData across style
    //reloads; only re-hits the MapTiler API when the home position
    //or the configured radius actually changed.
    private _ensureBuildingsFetched(): void
    {
        if (!this.map)
        {
            return;
        }
        const radius        = this._buildingRadiusMeters();
        const clusterRadius = this._buildingClusterRadiusMeters();
        const key = `${this.homeLat.toFixed(6)}|${this.homeLon.toFixed(6)}|${radius}|${clusterRadius}`;

        if (this._buildingsData && this._buildingsFetchKey === key)
        {
            return;
        }

        //Shared module-level cache short-circuit. When HA destroys + re-creates the helios-card element on an editor commit, a
        //fresh engine instance pays the buildings parse cost again unless we serve from the shared cache here. The browser HTTP
        //cache covers the underlying tile request; this map skips the parsed result so we do not re-walk the GeoJSON either.
        const sharedBuildings = sharedBuildingsCacheGet(key);
        if (sharedBuildings)
        {
            this._buildingsFetchKey = key;
            this._buildingsData     = sharedBuildings;
            this._pushRenderableSources();
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
            return;
        }

        //Abort any in-flight request so a rapid radius change doesn't leave a slow tile from the previous fetch racing the new one to populate the
        //sources.
        this._buildingsAbort?.abort();
        const ac = new AbortController();
        this._buildingsAbort   = ac;
        this._buildingsFetchKey = key;
        bumpStat('buildingFetchStarts');

        try { this.onBuildingsFetchStart?.(); } catch (_) {}

        fetchBuildingsAroundHome(
        {
            homeLon:             this.homeLon,
            homeLat:             this.homeLat,
            radiusMeters:        radius,
            clusterRadiusMeters: clusterRadius,
            signal:              ac.signal
        })
        .then(result =>
        {
            if (ac.signal.aborted || !this.map)
            {
                return;
            }
            this._buildingsData = result;
            _sharedBuildingsCache.set(key, { data: result, ts: Date.now() });
            this._pushRenderableSources();
            //Buildings just arrived, the shadow source is still empty, bypass the "sun hardly moved" guard so the next call paints a full atmosphere
            //pass and populates the shadow polygons.
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
        })
        .catch(err =>
        {
            if ((err as { name?: string })?.name === 'AbortError')
            {
                return;
            }
            console.warn('[HELIOS] Buildings fetch failed:', err);
        })
        .finally(() =>
        {
            try { this.onBuildingsFetchEnd?.(); } catch (_) {}
        });
    }

    //Wire up the LiDAR shadow pipeline for the current home + precision setting. Idempotent: safe to call after any config / position change.
    //
    //  - Resolves the country provider that covers the home (France
    //    HD only for now, see engine/lidar.ts).
    //  - When shadows are enabled AND a provider matches, fires one
    //    radius-based fetch against the provider; the result is a
    //    FeatureCollection of consolidated shadow polygons fed to the
    //    shadow projector.
    //  - When shadows are disabled or no provider matches, clears any
    //    cached features so the next shadow refresh falls back to the
    //    MapTiler footprints (or to no shadows if disabled).
    //Reset the entire LiDAR fetch state (cache key, features, raster, abort, backoff). Used when the provider becomes irrelevant
    //(no coverage / shadows off / lidar view off) or on engine teardown, so a future re-enable starts from a clean slate.
    private _resetLidarFetchState(): void
    {
        this._lidarShadowFeatures    = null;
        this._lidarShadowDiagnostics = null;
        this._lidarShadowKey         = '';
        this._lidarShadowFailedKey   = '';
        this._lidarShadowFailureCount = 0;
        this._lidarShadowBackoffUntil = 0;
        this._lidarRaster            = null;
        this._lidarViewLayer?.setData(null);
        this._lidarShadowAbort?.abort();
        this._lidarShadowAbort       = undefined;
    }

    //Backoff schedule for persistent LiDAR fetch failures. 1 → 60 s, 2 → 5 min, 3 → 15 min, 4 → 30 min, 5+ → 60 min cap. Resets to 0
    //on success or on key change (user reconfiguration).
    private _lidarBackoffDelayMs(failureCount: number): number
    {
        const scheduleSec = [60, 300, 900, 1800, 3600];
        const i = Math.max(0, Math.min(scheduleSec.length - 1, failureCount - 1));
        return scheduleSec[i] * 1000;
    }

    private _ensureLidarFetched(): void
    {
        if (!this.map)
        {
            return;
        }

        const provider = resolveLidarSource(this.homeLat, this.homeLon, this.cfg);
        //Bail when nothing wants the data: no provider covers the home, OR the user has shadows off AND no LiDAR View open. The View toggle lets the
        //raster fetch happen even when cast shadows are off, so the View overlay can show data without requiring the user to re-enable shadows just
        //to inspect.
        if (!provider || (!this._shadowsEnabled() && !this._lidarViewActive))
        {
            this._resetLidarFetchState();
            return;
        }

        const level      = this._lidarPrecisionLevel();
        const radius     = this._buildingRadiusMeters();
        //rasterSize derives from the provider's native cell pitch, the precision multiplier and the requested radius, so each fetched cell maps to a
        //real upstream sample rather than a server-side interpolation. Clamped to the pipeline's own [min, max] so a tiny radius can't ask for fewer
        //cells than the flood fill needs and a huge radius can't blow the WMS payload.
        const effectivePitch = provider.nativeCellPitchMeters * LIDAR_PRECISION_PITCH_MULT[level];
        const rawCells       = Math.round((2 * radius) / Math.max(0.01, effectivePitch));
        const rasterSize     = Math.min(
            RASTER_DEFAULTS.maxRasterSize,
            Math.max(RASTER_DEFAULTS.minRasterSize, rawCells)
        );
        const key = `${this.homeLat.toFixed(6)}|${this.homeLon.toFixed(6)}|${radius}|${rasterSize}|${provider.id ?? ''}`;
        //Bail if we already have a fresh successful payload for this key.
        if (this._lidarShadowKey === key && this._lidarShadowFeatures)
        {
            return;
        }
        //Bail if we are inside the backoff window for the SAME failed key. A key change (user moved home / edited radius / etc.)
        //bypasses the backoff because it represents a fresh request the failed key knows nothing about.
        if (this._lidarShadowFailedKey === key && Date.now() < this._lidarShadowBackoffUntil)
        {
            return;
        }

        //Shared module-level cache short-circuit. The LiDAR fetch is the heaviest single network + parse step in the engine boot,
        //a fresh-engine path after an editor commit re-pays that cost end-to-end unless we serve from the shared cache here.
        const sharedLidar = sharedLidarCacheGet(key);
        if (sharedLidar)
        {
            this._lidarShadowKey          = key;
            this._lidarShadowFeatures     = sharedLidar.features;
            this._lidarShadowDiagnostics  = sharedLidar.diagnostics;
            this._lidarRaster             = (sharedLidar.raster as typeof this._lidarRaster) ?? null;
            this._lidarShadowFailedKey    = '';
            this._lidarShadowFailureCount = 0;
            this._lidarShadowBackoffUntil = 0;
            this._lidarViewLayer?.setData(this._lidarRaster);
            this._lastLidarExposureAlt    = -999;
            this._lastLidarExposureAz     = -999;
            this._scheduleLidarExposureRecompute();
            this._lastAtmosphereAlt       = -999;
            this._refreshShadowsAndAtmosphere();
            return;
        }

        this._lidarShadowAbort?.abort();
        const ac = new AbortController();
        this._lidarShadowAbort = ac;
        this._lidarShadowKey   = key;

        try { this.onShadowComputeStart?.(); }
        catch (_) {}

        provider.fetchShadowRegions({
            homeLat:          this.homeLat,
            homeLon:          this.homeLon,
            radiusMeters:     radius,
            rasterSize,
            cropRadiusMeters: radius,
            signal:           ac.signal
        })
        .then(res =>
        {
            if (ac.signal.aborted || !this.map)
            {
                return;
            }
            this._lidarShadowFeatures    = res.features;
            this._lidarShadowDiagnostics = res.diagnostics;
            this._lidarRaster            = res.raster ?? null;
            //Promote to the shared cache so a fresh engine after an editor commit can serve from memory.
            _sharedLidarCache.set(key, {
                features:    res.features,
                diagnostics: res.diagnostics,
                raster:      res.raster ?? null,
                ts:          Date.now()
            });
            //Reset the failure / backoff state, this key is now known-good.
            this._lidarShadowFailedKey    = '';
            this._lidarShadowFailureCount = 0;
            this._lidarShadowBackoffUntil = 0;
            //Pump the fresh raster to the WebGL LiDAR View layer so
            //the dot cloud refreshes as soon as the fetch lands. No-op
            //when the View has never been opened, the layer just sits
            //with alphaFade=0 and the buffer is ready when the user
            //eventually clicks the toggle.
            this._lidarViewLayer?.setData(this._lidarRaster);
            //Pre-compute the exposure buffer (lit vs shadowed cells)
            //in idle so the dot cloud reads finished the moment the
            //user opens LiDAR-View, no on-click wait. Force a fresh
            //compute by zeroing the cached sun delta first.
            this._lastLidarExposureAlt = -999;
            this._lastLidarExposureAz  = -999;
            this._scheduleLidarExposureRecompute();
            //New shadow source available, force a full atmosphere / shadow refresh on the next call rather than waiting for the sun to move past the
            //0.5 deg threshold.
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
        })
        .catch(err =>
        {
            if ((err as { name?: string })?.name === 'AbortError')
            {
                return;
            }
            //Persistent provider failure. Keep the _lidarShadowKey AS IS (so the cache check above doesn't keep flapping between
            //the failed key and empty) and record the failed key + a backoff window separately. The next _ensureLidarFetched call
            //will see the backoff window and bail without retrying, until the window expires or the user changes a config field
            //that produces a different key. Without this, every sky-timer tick + every onMapTransform that pushes the sun past
            //the 0.5° gate retriggers a fetch that downloads + discards the entire upstream payload, which on a busy page (lots
            //of HACS cards loaded, throttled rAF after a macOS menu open, etc.) compounds into a visible framerate hit.
            this._lidarShadowFeatures    = null;
            this._lidarShadowDiagnostics = null;
            this._lidarShadowFailedKey   = this._lidarShadowKey;
            this._lidarShadowFailureCount++;
            const delayMs = this._lidarBackoffDelayMs(this._lidarShadowFailureCount);
            this._lidarShadowBackoffUntil = Date.now() + delayMs;
            console.warn(`[HELIOS] LiDAR shadow fetch failed (attempt ${this._lidarShadowFailureCount}, next retry in ${Math.round(delayMs / 1000)} s):`, err);
        })
        .finally(() =>
        {
            if (ac.signal.aborted)
            {
                return;
            }
            try { this.onShadowComputeEnd?.(); }
            catch (_) {}
        });
    }

    //Pushes the MapTiler footprints into the building rendering
    //sources. Buildings are always MapTiler-driven; LiDAR data is
    //used exclusively for shadow projection (see _refreshShadowsAndAtmosphere).
    private _pushRenderableSources(): void
    {
        if (!this.map)
        {
            return;
        }
        const homeSrc = this.map.getSource('helios-buildings-home-src')         as maplibregl.GeoJSONSource | undefined;
        const surrSrc = this.map.getSource('helios-buildings-surroundings-src') as maplibregl.GeoJSONSource | undefined;
        const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
        homeSrc?.setData(this._buildingsData?.home         ?? empty);
        surrSrc?.setData(this._buildingsData?.surroundings ?? empty);
    }


    //Repaint hillshade direction, satellite raster, night-shade overlay, fog and building tints to match the current sun altitude. Phases blend
    //continuously rather than at hard thresholds so dawn/dusk, golden hour, mid-day and night feel like a smooth progression.
    //
    //Altitude bands (degrees above horizon):
    //  alt < -6   : deep night          (cold blue/black, low contrast)
    //  -6 ..  0   : civil twilight      (indigo → pink tinge)
    //   0 ..  6   : sunrise/sunset      (saturated warm satellite)
    //   6 .. 20   : low sun             (warm shift, long shadows)
    //  20 .. 50   : full daylight       (neutral white balance)
    //  alt >= 50  : near zenith         (bright, slight wash)
    //
    //Short-circuits when the sun has moved less than 0.5° since the
    //last call (≈ 2 min of motion). setPaintProperty isn't free on
    //mobile, repeating the full pass once a minute would burn frames
    //for no perceptible visual change.
    private _refreshShadowsAndAtmosphere(): void
    {
        if (!this.map)
        {
            return;
        }

        const t   = this._selectedTime ?? new Date();
        const sun = getSunPosition(t, this.homeLat, this.homeLon);
        const { altitude, azimuth } = sun;

        //Concession on fake-ground-shadow quality: only refresh when
        //the sun altitude moved at least 1.5 deg since the last
        //paint. That is ~6 minutes of solar motion; the cast
        //shadow shifts by a metre or so but the eye does not
        //register the difference between a 6 min stale shadow and
        //a fresh one. The old 0.5 deg threshold caused ~3x more
        //full raster reprojects + canvas paint + PNG encode passes
        //than necessary.
        if (Math.abs(altitude - this._lastAtmosphereAlt) < 1.5)
        {
            return;
        }
        this._lastAtmosphereAlt = altitude;

        //Sun moved past the atmosphere refresh threshold, recompute the LiDAR-View exposure so the lit / shadowed cell colouring keeps up
        //with the sun. No-op when LiDAR View is off, the raster isn't loaded, or another compute is already queued.
        this._scheduleLidarExposureRecompute();

        //Night-shade overlay, the primary day/night cue.
        //Opacity ramps from 0 (day) up to ~0.65 at deep night, with a tinted
        //warm pass through the sunrise/sunset window so the satellite stays
        //readable but visibly amber-shifted near the horizon.
        if (this.map.getLayer('helios-night-shade'))
        {
            try
            {
                const ns = nightShadeForAltitude(altitude);
                this.map.setPaintProperty('helios-night-shade', 'fill-color',   ns.color);
                this.map.setPaintProperty('helios-night-shade', 'fill-opacity', ns.opacity);
            }
            catch (_) {}
        }

        //Buildings, modulate their colour by sun altitude so they participate in the time-of-day mood. We blend the configured daylight reference
        //towards a cool dark ink at night and towards a warm tint around sunrise/sunset.
        try
        {
            const buildingHex = buildingColorForAltitude(this._buildingColor(), altitude);
            for (const lid of ['helios-buildings-surroundings', 'helios-buildings-home'])
            {
                if (this.map.getLayer(lid))
                {
                    this.map.setPaintProperty(lid, 'fill-extrusion-color', buildingHex);
                }
            }
        }
        catch (_) {}

        //Sun-driven face shading on the building extrusions. MapLibre
        //positions the light as [radial, azimuth, polar]: azimuth in
        //degrees clockwise from north (matches getSunPosition's
        //convention exactly), polar from 0 (directly above) to 180
        //(directly below). With anchor='map' the light follows the
        //ground orientation so rotating the camera does not rotate
        //the lighting, which is what we want when scrubbing time.
        //
        //At and below the horizon we clamp the polar angle just shy of 90 deg, the building tints above already convey night, a below-horizon polar
        //would invert the face shading and look wrong on the few buildings that remain visible at twilight.
        try
        {
            this.map.setLight(
            {
                anchor:    'map',
                position:  [1.15, azimuth, sunLightPolarFromAltitude(altitude)],
                color:     '#ffffff',
                intensity: 0.5
            });
        }
        catch (_) {}

        //Map cast-shadow polygons. Source selection:
        //  - shadow toggle off               -> empty
        //  - LiDAR features available        -> LiDAR-consolidated regions
        //                                       (bâtiments + végétation)
        //  - LiDAR unavailable / out of cov. -> MapTiler footprints
        try
        {
            const shadowsOn = this._shadowsEnabled();
            const radius    = this._buildingRadiusMeters();
            //Signature of every input the shadow raster depends on.
            //Same signature = same image; the project + canvas paint +
            //PNG encode round-trip can be skipped entirely. Altitude
            //and azimuth are rounded to 0.1 deg, ~6 minutes of sun
            //motion, well below the visual threshold for a shadow
            //shift but coarse enough that a timeline scrub no longer
            //triggers a 20 ms PNG encode every half-second.
            const lidarRef = this._lidarShadowFeatures;
            const sig =
                `${shadowsOn ? '1' : '0'}` +
                `|${altitude.toFixed(1)}|${azimuth.toFixed(1)}` +
                `|${this.homeLat.toFixed(6)}|${this.homeLon.toFixed(6)}` +
                `|${radius}` +
                `|L${lidarRef ? lidarRef.features.length : -1}` +
                `|B${this._buildingsData
                    ? (this._buildingsData.home.features.length
                       + this._buildingsData.surroundings.features.length)
                    : -1}`;
            if (sig !== this._lastShadowSig)
            {
                this._lastShadowSig = sig;
                let input: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
                if (shadowsOn)
                {
                    if (lidarRef && lidarRef.features.length > 0)
                    {
                        input = lidarRef;
                    }
                    else if (this._buildingsData)
                    {
                        input = {
                            type:     'FeatureCollection',
                            features: [
                                ...this._buildingsData.home.features,
                                ...this._buildingsData.surroundings.features
                            ]
                        };
                    }
                }
                const projected = projectExtrusionShadows(input,
                {
                    sunAzimuthDeg:    azimuth,
                    sunAltitudeDeg:   altitude,
                    homeLat:          this.homeLat,
                    //Clip shadows to the building visibility disc so they never extend past the rendered surroundings.
                    clipCenterLat:    this.homeLat,
                    clipCenterLon:    this.homeLon,
                    clipRadiusMeters: radius
                });
                if (this.map)
                {
                    //Canvas size derives from the user's lidar-precision
                    //(low / medium = 1024, high = 2048). Recreate the
                    //backing canvas if the level changed since the last
                    //paint, otherwise reuse the existing one across
                    //refreshes so we don't allocate 16 MB per minute.
                    const rasterSize = shadowRasterSizeFor(this._lidarPrecisionLevel());
                    if (!this._shadowCanvas || this._shadowCanvas.width !== rasterSize)
                    {
                        this._shadowCanvas = document.createElement('canvas');
                        this._shadowCanvas.width  = rasterSize;
                        this._shadowCanvas.height = rasterSize;
                    }
                    //Shadow raster fade matches the LiDAR view fade radii (full opacity up to one
                    //fade-band inside the display radius, ramped to 0 at the radius) so the three
                    //layers (buildings, LiDAR, shadow raster) share the same outer boundary and the shadow
                    //disc no longer reads as a hard circular cut. Both bounds track the live display radius.
                    const radiusM = this._buildingRadiusMeters();
                    const [fullR, fadeR] = this._lidarViewFadeRange();
                    paintShadowRaster(
                        this.map,
                        this._shadowCanvas,
                        projected,
                        shadowBoundsCornersLL(this.homeLat, this.homeLon, radiusM),
                        radiusM,
                        fullR,
                        fadeR,
                    );
                }
            }
        }
        catch (_) {}
    }

    //Precision is fixed to 'high' (multi-model median). The function
    //is kept so the rest of the engine stays precision-aware if a
    //tier is added later.
    private _resolvedPrecision(): 'standard' | 'high'
    {
        return 'high';
    }

    private async _refreshWeather(lat?: number, lon?: number): Promise<void>
    {
        const fLat = lat ?? this.homeLat;
        const fLon = lon ?? this.homeLon;

        this._fetchAbortController?.abort();
        this._fetchAbortController = new AbortController();
        const signal = this._fetchAbortController.signal;

        this._clearWeatherTimer();

        this.onFetchStart?.();

        try
        {
            //Single home-point fetch with elevation. The home point is the only weather source, surrounding context is rendered from the same hourly
            //series.
            const precision = this._resolvedPrecision();
            this._homeHourlyData = await fetchHomePointData(
                fLat, fLon, this.homeElevation, precision, signal
            );
            this._renderForCurrentSelection();

            //Successful fetch: reset both back-off streaks so the next failure (if any) starts again
            //at the shortest delay. Drop the rate-limit alert banner the moment a fetch lands so
            //the user sees the all-clear without waiting for the next refresh tick.
            this._rateLimitStreak  = 0;
            this._otherErrorStreak = 0;
            this._setRateLimited(false);

            if (this._selectedTime === null)
            {
                //Refresh every 10 min (was 1 h). Open-Meteo
                //updates its forecast every 15 min on the server,
                //so 10 min on the client gives us near-fresh data
                //without ever lagging more than a model cycle. Well
                //within free-tier quotas.
                this._weatherTimer = window.setInterval(
                    () => this._refreshWeather(this._fetchLat, this._fetchLon),
                    600_000
                );
            }
        }
        catch (e: any)
        {
            if (e.name === 'AbortError')
            {
                return;
            }

            //Open-Meteo unreachable (network down, CORS, 5xx). Push a fallback WeatherData so the card can
            //still build its timeline + scrub PV history / battery, just without the cloud / irradiance /
            //forecast traces. We emit a single update with neutral defaults; the retry below will replace
            //these fields with real values once the fetch succeeds.
            this.onWeatherUpdate?.(
            {
                cloudCover:       0,
                cloudLow:         0,
                cloudMid:         0,
                cloudHigh:        0,
                cloudIntensity:   'clear',
                timeRange:        this._getTimeRange(),
                isLiveTime:       this._selectedTime === null,
                pvPower:          0,
                pvPowerHaurwitz:  0,
                pvPowerShortwave: -1,
                irradianceSource: 'haurwitz',
                temperatureC:     NaN,
                windMs:           NaN,
            });

            let retryDelay: number;
            if (e.status === 429)
            {
                //Pick the back-off slot for the current streak, capped
                //at the last entry. setTimeout (not setInterval): we
                //only want one retry, then either we succeed and reset
                //the streak, or we fail again and bump the streak.
                const idx = Math.min(this._rateLimitStreak, RATE_LIMIT_BACKOFF_MS.length - 1);
                retryDelay = RATE_LIMIT_BACKOFF_MS[idx];
                this._rateLimitStreak++;
                //Surface the rate-limit state to the card so it can paint an alert banner under
                //the loading banner. Idempotent; only fires the card callback on the 0 -> 1
                //transition (the helper handles the dedup).
                this._setRateLimited(true);

                this._weatherTimer = window.setTimeout(
                    () => this._refreshWeather(this._fetchLat, this._fetchLon),
                    retryDelay
                );
            }
            else
            {
                //Non-rate-limit error (network blip, 500, JSON parse): graduated back-off table
                //(1 min, 5 min, 15 min, 60 min cap) instead of the previous flat 60 s setInterval.
                //setTimeout (not setInterval) so we only schedule ONE retry: if it succeeds the
                //streak resets, if it fails again we re-enter this branch and pick the next slot.
                const idx = Math.min(this._otherErrorStreak, OTHER_ERROR_BACKOFF_MS.length - 1);
                retryDelay = OTHER_ERROR_BACKOFF_MS[idx];
                this._otherErrorStreak++;
                this._weatherTimer = window.setTimeout(
                    () => this._refreshWeather(this._fetchLat, this._fetchLon),
                    retryDelay
                );
            }
        }
        finally
        {
            this.onFetchEnd?.();
        }
    }

    //"Reset view", re-anchor the camera on the home and restore the
    //default pitch/bearing. The interactive camera is locked, so this
    //is an animation-only entry point: resting target for scripted
    //motions (intro orbit, narrative tilt, sun-vs-shadow flyovers...)
    //and one-tap reset if any of those leaves the camera off-pose.
    public recenter(): void
    {
        if (!this.map)
        {
            return;
        }
        this.map.stop();
        const c    = this.map.getCenter();
        const dist = geoDistM(c.lat, c.lng, this.homeLat, this.homeLon);
        const dur  = Math.min(1200, Math.max(300, dist / 5));

        this.map.easeTo(
        {
            center:   [this.homeLon, this.homeLat],
            zoom:     18,
            //Restores the configured resting pose (camera-pitch-deg /
            //camera-bearing-deg) when set, otherwise falls back to the
            //hemisphere-aware defaults the initial map() init uses.
            pitch:    this._initialPitch(),
            bearing:  this._initialBearing(),
            duration: dur
        });
    }

    _detailMode          = false;
    //In-flight detail-mode dive tween. Cancelled on every fresh setDetailMode call so a rapid click-exit-click can't stack two animations driving the
    //same camera.
    _detailDiveRaf?: number;
    //Pre-dive pose snapshot, captured at the moment setDetailMode(true) fires so the symmetric exit
    //transition restores EXACTLY the pose the user was on before opening the dashboard. Without this
    //the exit ended at the hemisphere-aware default (CAMERA_PITCH_REST_DEG + initial bearing), which
    //quietly broke users who had a camera-locked pose dialled in and now had to repoint manually
    //every time they closed the dashboard. Undefined when no dive is in flight.
    _detailEntryPitch?:   number;
    _detailEntryBearing?: number;
    //Wall-clock timestamp until which fresh user gestures are
    //ignored. Bumped on detail-mode exit; the card reads it via
    //isUserGestureSuppressed() to filter timeline scrubs the same
    //way the canvas drag-rotate handler does.
    _postExitCooldownUntil = 0;

    public setDetailMode(on: boolean): void
    {
        _setDetailMode(this, on);
    }

    //Wipe every cached Open-Meteo payload from localStorage, drop
    //the engine's in-memory weather snapshot, and trigger a fresh
    //fetch. Used by the editor's "reset data cache" button.
    //Returns the count of cached payloads removed (purely
    //informational for the UI to show a quick confirmation).
    public resetDataCache(): number
    {
        const cleared = clearWeatherCache();
        this._homeHourlyData = null;
        this._refreshWeather(this._fetchLat, this._fetchLon);
        return cleared;
    }


    //Card-side gate based on the IntersectionObserver: when the
    //card is off-screen (scrolled out of view, hidden in a
    //collapsed conditional, sitting in a non-focused tab) the
    //card calls setPaused(true) and we stop the periodic shadow
    //refresh + skip the dome re-projection. Resume on visibility.
    //One immediate refresh on un-pause so the sun position the
    //user sees matches now, not "where the sun was when the card
    //scrolled out 10 minutes ago".
    public setPaused(paused: boolean): void
    {
        if (this._paused === paused)
        {
            return;
        }
        this._paused = paused;
        if (paused)
        {
            //Drop the 60 s sky refresh interval entirely while paused. The interior of the callback already early-
            //returns when `_paused` is true, but the timer itself still kept the page awake and showed up in profilers
            //as a wakeup every minute for no work. Re-arm on un-pause below.
            if (this._skyTimer !== undefined)
            {
                window.clearInterval(this._skyTimer);
                this._skyTimer = undefined;
            }
            //Drop the weather refresh timer too. Until this fix, a card sitting in a hidden tab or
            //scrolled off-screen kept hitting Open-Meteo every 10 min indefinitely, the timer
            //callback fired and `_refreshWeather` ran end-to-end (cache miss after the 45 min TTL =
            //a real network request). On a multi-monitor / multi-tab setup that could account for
            //hundreds of requests per day per stale tab. _refreshWeather will re-arm naturally on
            //un-pause via the normal success path.
            this._clearWeatherTimer();
        }
        else
        {
            this._refreshShadowsAndAtmosphere();
            if (this._skyTimer === undefined)
            {
                this._skyTimer = window.setInterval(() =>
                {
                    if (this._paused)
                    {
                        return;
                    }
                    this._refreshShadowsAndAtmosphere();
                }, 60_000);
            }
            //Re-arm the weather refresh: one immediate fetch (which reads from localStorage cache
            //inside its 45 min TTL so a quick visibility flip costs nothing) and the success path
            //schedules the 10 min interval.
            if (this._weatherTimer === undefined)
            {
                this._refreshWeather(this._fetchLat, this._fetchLon);
            }
        }
    }

    public isPaused(): boolean
    {
        return this._paused;
    }

    //True while the post-exit cooldown is active. The card consults
    //this to gate timeline scrubs; the engine consults it internally
    //for the canvas drag-rotate. Both surfaces read the same clock so
    //the suppression window is symmetric across input sources.
    public isUserGestureSuppressed(): boolean
    {
        return Date.now() < this._postExitCooldownUntil;
    }

    public isDetailMode(): boolean
    {
        return this._detailMode;
    }

    //Compute the screen-space layout of the on-map readout chips and the leader lines that tie them to the home / on-ground ring.
    //
    //  cloudLabel, where the cloud-cover chip should be drawn (in
    //               CSS pixels, relative to the map canvas). Sits to
    //               the screen-LEFT of the cloud disc, just outside
    //               the 100 % reference ring.
    //  pvLabel   , where the optional PV production chip should be
    //               drawn. Sits just below the home so the chip is
    //               read as the home's "production" badge. The SoC
    //               and Power chips sit on a shared shelf above it,
    //               so the cluster has the PV chip at the bottom,
    //               the home in the middle of the L-leaders, and
    //               the battery chips at the top.
    //  batterySocLabel  , battery State-of-Charge chip (icon + %).
    //               Sits on the shelf, to the LEFT of the home's
    //               vertical axis, connected to PV by an L polyline
    //               (PV top-left → up → left → SoC right edge).
    //               Static (no flow direction to encode).
    //  batteryPowerLabel, battery Power chip (icon + signed W/kW).
    //               Sits on the shelf, to the RIGHT of the home's
    //               vertical axis, connected to PV by an L polyline
    //               (PV top-right → up → right → Power left edge).
    //               Animated dashes + arrow tracking the sign of
    //               the live power.
    //  ringEdge  , projected position of the cloud disc's 100 %
    //               reference ring edge, in the hemisphere-aware
    //               anchor direction (east of home in NH, west in
    //               SH). The card uses (home, ringEdge) plus the
    //               live cloud-cover percentage to interpolate the
    //               actual fill-disc edge along the same direction.
    //  home      , the projected home point, used as the anchor for
    //               the PV / battery chip leader lines and as the
    //               centre of the cloud fill disc.
    //
    //Returns null when the map isn't ready yet, the card treats null as "don't render the overlay this frame".
    public projectHomeLabelLayout(): {
        cloudLabel:        { x: number; y: number };
        pvLabel:           { x: number; y: number };
        batterySocLabel:   { x: number; y: number };
        batteryPowerLabel: { x: number; y: number };
        gridImportLabel:   { x: number; y: number };
        gridExportLabel:   { x: number; y: number };
        ringEdge:          { x: number; y: number };
        home:              { x: number; y: number };
        //Projected screen position of the home building's roof top
        //(home lat/lon at altitude `render_height`). The card uses
        //this as the bottom endpoint of the drop leader so the line
        //always lands exactly on the roof regardless of canvas size,
        //pitch or zoom. Falls back to the ground home position when
        //no home building has been resolved yet.
        homeRoof:          { x: number; y: number };
        //SVG `polygon` `points` attribute for the PV home-anchor
        //ground disc. Built by projecting 48 points on a horizontal
        //circle of radius PV_HOME_ANCHOR_RADIUS_M metres around the
        //home into screen pixels, then expressing each point
        //relative to the home so the consuming SVG can wrap the
        //polygon in a `<g transform="translate(home.x, home.y)">`
        //and animate the pulse by scaling around the origin.
        homeAnchorPoints:  string;
    } | null
    {
        if (!this.map)
        {
            return null;
        }

        //project() exists on MapLibre's Map at runtime but is not on
        //the local .d.ts surface we ship; cast to bypass the type
        //narrowing (matches the existing pattern used for getCanvas).
        const m = this.map as any;
        const home = m.project([this.homeLon, this.homeLat]);

        //Hemisphere-aware fixed geographic anchor on the disc edge:
        //  NH (default bearing 180° → south-up) → north-east of home
        //  SH (default bearing   0° → north-up) → south-west of home
        //Both pick the side that projects to the LOWER-LEFT of screen
        //at the hemisphere's default bearing, putting the cloud chip
        //away from the irradiance chip's natural top-of-arc position
        //and giving each readout its own quadrant. Once anchored to a
        //single lon/lat the chip orbits the home smoothly under user
        //rotation rather than jumping between sampled estimates.
        const lat0   = this.homeLat;
        const cosLat = Math.cos(lat0 * Math.PI / 180);
        const baseDE = lat0 >= 0 ? CLOUD_DISC_RADIUS_M : -CLOUD_DISC_RADIUS_M;
        //Rotate the base (east in NH, west in SH) by +45° CCW in the
        //(east, north) world frame. Symmetrical signs land NH at NE
        //and SH at SW, both of which project to screen-lower-left at
        //the hemisphere's resting bearing.
        const ROT      = Math.PI / 4;
        const anchorDE = baseDE * Math.cos(ROT);
        const anchorDN = baseDE * Math.sin(ROT);
        const anchorDLng = anchorDE / (111_320 * cosLat);
        const anchorDLat = anchorDN / 111_320;
        const anchor = m.project([this.homeLon + anchorDLng, this.homeLat + anchorDLat]);
        const ringEdgeX = anchor.x;
        const ringEdgeY = anchor.y;

        //Push the chip outwards along the home→anchor direction so
        //it always sits OUTSIDE the projected disc, leaving a short
        //leader-line gap. Using the radial vector (rather than a
        //fixed -X offset) keeps the chip outside even when rotation
        //moves the projected anchor to a non-leftward screen side.
        const CLOUD_CHIP_NUDGE_PX = 30;
        const radDX = ringEdgeX - home.x;
        const radDY = ringEdgeY - home.y;
        const radLen = Math.sqrt(radDX * radDX + radDY * radDY) || 1;
        const cloudLabelX = ringEdgeX + (radDX / radLen) * CLOUD_CHIP_NUDGE_PX;
        const cloudLabelY = ringEdgeY + (radDY / radLen) * CLOUD_CHIP_NUDGE_PX;

        //Chip cluster around the home, reorganised so the two energy
        //families read as distinct columns:
        //  - PV stays anchored vertically on the home (above, slightly
        //    lifted), it is the central identity of the card.
        //  - Battery (SoC + Power) lives on the RIGHT side of the
        //    home, stacked vertically: SoC on top of Power.
        //  - Grid (Import + Export) lives on the LEFT side of the
        //    home, stacked vertically: Import on top of Export.
        //That keeps "what is in" (grid + sun) on one side and "what
        //is stored / consumed" on the other.
        //Pixel offsets driving the chip cluster around the home.
        //All four constants are scaled by `_heliosScale()` so the
        //cluster spreads on a fullscreen / kiosk layout instead of
        //clumping at the centre of an otherwise empty canvas. See
        // At standard Lovelace grid sizes scale = 1.0,
        //so the cluster geometry stays exactly as before.
        const scale = this._heliosScale();
        //Dedicated vertical-lift ramp, steeper than the horizontal
        //chip-cluster ramp because the leaders from PV / battery /
        //grid chips down to the home need more screen height on a
        //fullscreen canvas to keep the connection visually readable.
        //At standard Lovelace card sizes (<= 600 px) the lift ramp
        //stays at 1.0 so nothing moves; on a kiosk-sized canvas the
        //lift grows faster than the horizontal spread so the chips
        //float higher and the leader lines breathe.
        const liftScale = this._clusterLiftScale();
        const CHIP_SIDE_X_OFFSET_PX = 70 * scale;
        //Vertical distance between the top and bottom rows of chips.
        //Bumped to 60 so the L-shape leaders below have enough room
        //to render their rounded fillet without overlapping the
        //home pill.
        const CHIP_STACK_GAP_PX     = 60 * scale;
        //Resolve the home roof Y by projecting the home lat/lon at
        //the home building's tallest `render_height`. Used both for
        //the drop-leader endpoint AND to anchor the chip cluster a
        //fixed distance above the roof, so the cluster follows the
        //building silhouette as the canvas grows instead of drifting
        //up with a static screen-space lift. Falls back to the
        //ground home position when no home building has been
        //resolved yet (early frames before `_buildingsData` lands).
        let roofY = home.y;
        const homeFeatures = this._buildingsData?.home?.features;
        if (homeFeatures && homeFeatures.length > 0)
        {
            let maxH = 0;
            for (const feat of homeFeatures)
            {
                const props = (feat.properties ?? {}) as Record<string, unknown>;
                const h     = typeof props['render_height'] === 'number'
                    ? (props['render_height'] as number)
                    : 0;
                if (h > maxH)
                {
                    maxH = h;
                }
            }
            if (maxH > 0)
            {
                const projectedRoof = this._projectScenePoint(this.homeLon, this.homeLat, maxH);
                if (projectedRoof)
                {
                    roofY = projectedRoof.y;
                }
            }
        }

        //Cluster sits a fixed 28 px above the projected roof, with a
        //modest screen-density ramp so the spacing scales with the
        //rest of the cluster spread. Anchoring on the roof (instead
        //of a static lift from the ground home position) keeps the
        //home pill + chips visually attached to the building no
        //matter how the user resizes the card.
        const CLUSTER_ABOVE_ROOF_PX = 28 * liftScale;
        const clusterY = roofY - CLUSTER_ABOVE_ROOF_PX;
        const pvX = home.x;
        const pvY = clusterY - PV_CHIP_OFFSET_PX * liftScale;
        //Battery column on the right.
        const batteryXRight     = home.x + CHIP_SIDE_X_OFFSET_PX;
        const batterySocY       = clusterY - CHIP_STACK_GAP_PX / 2;
        const batteryPowerY     = clusterY + CHIP_STACK_GAP_PX / 2;
        //Grid column on the left.
        const gridXLeft         = home.x - CHIP_SIDE_X_OFFSET_PX;
        const gridImportY       = clusterY - CHIP_STACK_GAP_PX / 2;
        const gridExportY       = clusterY + CHIP_STACK_GAP_PX / 2;

        //PV home-anchor ground disc, expressed as a polygon. We
        //sample N points on a horizontal circle of radius
        //PV_HOME_ANCHOR_RADIUS_M metres around the home (lat/lon
        //offsets in the local tangent plane), project each through
        //the current camera matrices, then express the result
        //relative to the home so the SVG can wrap the polygon in a
        //translate-to-home group. The disc lies flat on the ground
        //plane, so at pitch=55° it projects to an ellipse with the
        //major axis perpendicular to the camera's bearing and the
        //minor axis along it, matching the perspective everywhere
        //else on the map.
        //Wider ground ring so the HA Energy non-fossil-coloured disc
        //around the home reads at the basemap zoom the card uses;
        //the previous 2.5 m matched the old thin PV-coloured ring,
        //the new 4 m matches the visual weight of the HA Energy
        //distribution card's home node.
        const PV_HOME_ANCHOR_RADIUS_M = 4.0;
        const ANCHOR_SAMPLES          = 48;
        const anchorLatPerM = 1 / 111_320;
        const anchorLonPerM = anchorLatPerM / cosLat;
        //Reuse a single instance-level scratch array + string buffer
        //instead of allocating a 48-entry array of template literals
        //per call. This function fires on every map move during
        //auto-rotate, and the cumulative string allocations were a
        //measurable freeze source under longer rotations.
        const anchorPts = this._anchorPtsBuf;
        if (anchorPts.length !== ANCHOR_SAMPLES)
        {
            anchorPts.length = ANCHOR_SAMPLES;
        }
        for (let i = 0; i < ANCHOR_SAMPLES; i++)
        {
            const a = (i / ANCHOR_SAMPLES) * Math.PI * 2;
            const dE = Math.cos(a) * PV_HOME_ANCHOR_RADIUS_M;
            const dN = Math.sin(a) * PV_HOME_ANCHOR_RADIUS_M;
            const p  = m.project([
                this.homeLon + dE * anchorLonPerM,
                this.homeLat + dN * anchorLatPerM,
            ]);
            //Direct number-to-string concat with one decimal of precision; toFixed allocates a fresh Number-stringification per call which compounds.
            const dx = ((p.x - home.x) * 100 | 0) / 100;
            const dy = ((p.y - home.y) * 100 | 0) / 100;
            anchorPts[i] = dx + ',' + dy;
        }

        return {
            cloudLabel:        { x: cloudLabelX,    y: cloudLabelY  },
            pvLabel:           { x: pvX,            y: pvY          },
            batterySocLabel:   { x: batteryXRight,  y: batterySocY  },
            batteryPowerLabel: { x: batteryXRight,  y: batteryPowerY},
            gridImportLabel:   { x: gridXLeft,      y: gridImportY  },
            gridExportLabel:   { x: gridXLeft,      y: gridExportY  },
            ringEdge:          { x: ringEdgeX,      y: ringEdgeY    },
            home:              { x: home.x,         y: clusterY     },
            homeRoof:          { x: home.x,         y: roofY        },
            homeAnchorPoints:  anchorPts.join(' '),
        };
    }

    //Project a 3D point (longitude, latitude, altitude_m) into
    //screen-space pixels using MapLibre's current camera matrices.
    //
    //Procedure (per the MapLibre v5 official 3D-model example):
    //  1. modelMatrix = transform.getMatrixForModel(LngLat, alt) ,
    //     translates / rotates a model from its local frame into
    //     Mercator world coordinates at the requested location and
    //     altitude.
    //  2. projMatrix = transform.getProjectionDataForCustomLayer()
    //     .mainMatrix, Mercator world to gl clip space.
    //  3. Multiply both matrices to get the full MVP.
    //  4. Apply MVP to (0, 0, 0, 1), the local-frame origin, which
    //     becomes our 3D point after step 1.
    //  5. Perspective-divide by w to get clip-space coordinates in
    //     [-1, +1].
    //  6. Map to canvas pixels.
    //
    //Returns null when the map isn't ready or when the point is
    //behind the camera (clip-space w <= 0). Callers treat null as
    //"don't render this point this frame".
    //
    //Returns x/y in CSS pixels relative to the map canvas, plus depth
    //(the post-projection w component, which is monotonic in distance
    //from the camera). Callers can use depth to scale visual elements
    //based on how far they are from the viewer, bigger when close,
    //smaller when far, to give the otherwise flat top-down-ish view
    //a sense of perspective beyond what pitch alone provides.
    //Per-frame projection caches and scratch buffers. These slots are mutated in place by
    //_projectScenePoint(), called hundreds of times per map transform (sun arc 96 samples,
    //cloud bands ~190 points, label anchors 49 points). Naive allocation in the hot path is
    //the dominant source of GC pressure: 30k+ small arrays per second under auto-rotate,
    //the pattern that progressively bricks the M4 Pro after ~10 s.
    //
    //_projCache caches the camera-side data (projection matrix,
    //canvas CSS dimensions) for the current frame; it is invalidated
    //by _invalidateProjCache() on every map move / render / resize.
    //_mvpBuf is a 16-slot scratch buffer reused as the temporary mvp
    //matrix on every _projectScenePoint() call.
    //_llBuf is a 2-slot scratch buffer reused for the [lon, lat]
    //argument passed to MapLibre's transform.getMatrixForModel().
    private _projCache: {
        projM: number[];
        W:     number;
        H:     number;
    } | null = null;
    private _mvpBuf: number[] = new Array(16);
    private _llBuf:  [number, number] = [0, 0];
    //Scratch array for the PV home-anchor SVG points. Reused across
    //projectHomeLabelLayout() calls so the 48-entry string array no
    //longer gets allocated on every move.
    private _anchorPtsBuf: string[] = [];

    //Cached canvas CSS dimensions, fed by the ResizeObserver below.
    //Read in _projectScenePoint() instead of canvas.clientWidth so
    //the first projection of each frame does not force a layout
    //flush (~5-30 ms ponctuel sync layout while CSS transitions
    //run on sibling chip elements).
    private _cachedCanvasCssW = 0;
    private _cachedCanvasCssH = 0;

    private _invalidateProjCache(): void
    {
        this._projCache = null;
    }

    //Linear ramp on the card's min CSS dimension so the home chip
    //cluster expands on a fullscreen / kiosk layout instead of
    //staying pinned to the tuned-for-grid pixel sizes. Below
    //FLOOR the scale is fixed at 1.0 (standard Lovelace grid
    //cell); above FLOOR it ramps linearly to MAX at TOP. See
    //
    private _heliosScale(): number
    {
        const minDim = Math.min(this._cachedCanvasCssW || Infinity, this._cachedCanvasCssH || Infinity);
        if (!Number.isFinite(minDim) || minDim <= 0)
        {
            return 1.0;
        }
        const FLOOR = 600;
        const TOP   = 1200;
        const MAX   = 1.6;
        if (minDim <= FLOOR)
        {
            return 1.0;
        }
        if (minDim >= TOP)
        {
            return MAX;
        }
        return 1.0 + (MAX - 1.0) * (minDim - FLOOR) / (TOP - FLOOR);
    }
    //Steeper vertical lift ramp for the chip cluster. The horizontal
    //chip-spread ramp (`_heliosScale()`) caps at 1.6x because beyond
    //that the chips spread off the centre of the canvas; the vertical
    //lift from chip to home benefits from a bigger multiplier so the
    //leader line keeps pace with the canvas growth and the home stays
    //visually anchored in the lower half of the scene. Same FLOOR /
    //TOP breakpoints as the chip scale so the transitions hinge
    //together.
    private _clusterLiftScale(): number
    {
        const minDim = Math.min(this._cachedCanvasCssW || Infinity, this._cachedCanvasCssH || Infinity);
        if (!Number.isFinite(minDim) || minDim <= 0)
        {
            return 1.0;
        }
        const FLOOR = 600;
        const TOP   = 1200;
        const MAX   = 2.4;
        if (minDim <= FLOOR)
        {
            return 1.0;
        }
        if (minDim >= TOP)
        {
            return MAX;
        }
        return 1.0 + (MAX - 1.0) * (minDim - FLOOR) / (TOP - FLOOR);
    }
    //Dedicated ramp for the sun arc + sun disc. The chip cluster
    //scale (1.6 max) is too conservative for the arc because the
    //arc is computed in world metres, projected by MapLibre at a
    //fixed zoom: at standard card sizes 40 m maps to ~120-160 CSS
    //px which fills the lower half of the canvas nicely, but on a
    //kiosk-sized canvas the same 40 m still reads as ~120-160 px,
    //lost in the empty space. The arc needs a bigger multiplier to
    //keep its visual share of the canvas constant. The sun disc
    //radius + halo gradient stops (rendered card-side) consume the
    //same value via `getSunArcScale()` so the disc-to-arc ratio
    //stays constant across canvas sizes.
    private _sunArcScale(): number
    {
        const minDim = Math.min(this._cachedCanvasCssW || Infinity, this._cachedCanvasCssH || Infinity);
        if (!Number.isFinite(minDim) || minDim <= 0)
        {
            return 1.0;
        }
        const FLOOR = 600;
        const TOP   = 1200;
        const MAX   = 2.2;
        if (minDim <= FLOOR)
        {
            return 1.0;
        }
        if (minDim >= TOP)
        {
            return MAX;
        }
        return 1.0 + (MAX - 1.0) * (minDim - FLOOR) / (TOP - FLOOR);
    }
    //Public accessor for the sun-arc scale so the card-side render
    //can scale the sun disc + halo together with the arc world-metres
    //radius. Without this the disc would stay at its grid-tuned pixel
    //size while the arc grows, the sun would read as a tiny dot on
    //a gigantic curve on a fullscreen canvas.
    public getSunArcScale(): number { return this._sunArcScale(); }

    private _projectScenePoint(
        lon: number, lat: number, altitudeM: number
    ): { x: number; y: number; depth: number } | null
    {
        if (!this.map)
        {
            return null;
        }

        const t: any = (this.map as any).transform;
        if (typeof t?.getMatrixForModel !== 'function' ||
            typeof t?.getProjectionDataForCustomLayer !== 'function')
        {
            return null;
        }

        //Per-frame cache: the projection matrix is identical across
        //every _projectScenePoint() call within the same frame, so
        //we resolve it once and reuse. Invalidated by
        //_invalidateProjCache() on every map move / resize.
        //
        //Canvas CSS dimensions are read from a ResizeObserver-fed
        //cache rather than `canvas.clientWidth` so the first
        //projection of each frame does not force a layout flush.
        //An ongoing CSS transition on a sibling chip would
        //otherwise pay a ~5-30 ms sync layout cost when the rotate
        //handler first touches the projection helper.
        let pc = this._projCache;
        if (!pc)
        {
            const projM = t.getProjectionDataForCustomLayer().mainMatrix as number[];
            //First-time fallback: if the ResizeObserver has not
            //fired yet, populate from canvas.clientWidth once and
            //pay the layout flush this single time.
            if (this._cachedCanvasCssW === 0 || this._cachedCanvasCssH === 0)
            {
                const canvas: HTMLCanvasElement = (this.map as any).getCanvas();
                this._cachedCanvasCssW = canvas.clientWidth  || canvas.width;
                this._cachedCanvasCssH = canvas.clientHeight || canvas.height;
            }
            pc = {
                projM,
                W: this._cachedCanvasCssW,
                H: this._cachedCanvasCssH,
            };
            this._projCache = pc;
        }
        const { projM, W, H } = pc;

        //Reuse the [lon, lat] scratch buffer to avoid allocating a
        //fresh 2-array on every call (MapLibre reads it immediately
        //inside getMatrixForModel so no aliasing risk).
        this._llBuf[0] = lon;
        this._llBuf[1] = lat;
        const modelM: number[] = t.getMatrixForModel(this._llBuf, altitudeM);

        //Combine the two 4×4 matrices into mvp = projM · modelM,
        //writing into the per-instance _mvpBuf scratch slot rather
        //than allocating a fresh 16-array per call. Both inputs are
        //stored column-major in MapLibre, so mvp[col*4+row] is the
        //element at (row, col).
        const mvp = this._mvpBuf;
        for (let col = 0; col < 4; col++)
        {
            for (let row = 0; row < 4; row++)
            {
                let sum = 0;
                for (let k = 0; k < 4; k++)
                {
                    sum += projM[k * 4 + row] * modelM[col * 4 + k];
                }
                mvp[col * 4 + row] = sum;
            }
        }

        //Apply mvp to the origin (0, 0, 0, 1), i.e. extract the
        //last column, which IS the projection of the origin.
        const cx = mvp[12];
        const cy = mvp[13];
        const cw = mvp[15];

        if (cw <= 0 || !isFinite(cw))
        {
            //Behind the camera or numerically degenerate.
            return null;
        }

        //Perspective divide → clip space in [-1, +1].
        const ndcX = cx / cw;
        const ndcY = cy / cw;

        //Map ndc (-1..+1) to (0..W) and (0..H) with Y flipped because
        //ndc Y points up while screen Y points down.
        return {
            x:     (ndcX + 1) * 0.5 * W,
            y:     (1 - ndcY) * 0.5 * H,
            depth: cw
        };
    }

    //Build the screen-space layout of the solar arc, the sun's current position on the arc, and the incidence ray.
    //
    //Returns null until the map is ready. The card uses null as "don't render the overlay this frame".
    //
    //Each arc point also carries the irradiance (W/m²) at that
    //instant, computed with the current cloud cover applied
    //uniformly across the day, that's a simplification (real cloud
    //cover varies hour-to-hour) but keeps the visualisation reactive
    //to the live weather without needing the per-hour forecast for
    //the arc itself. The sun position carries the same.
    //
    //Each arc point and the sun also carry a `nearness` value in
    //[0..1], 1 means closest to the camera (nearest depth in the
    //batch), 0 means furthest. The card uses this to scale segment
    //thickness and the sun disc radius so the trajectory reads with
    //a real sense of perspective rather than as a flat ribbon.
    public projectSunScene(now: Date): {
        arc:      Array<{
            x: number; y: number;
            irradiance: number; nearness: number; belowHorizon: boolean;
        }>;
        sun:      { x: number; y: number; irradiance: number; altitude: number; nearness: number };
        home:     { x: number; y: number };
        daylight: number;
        //Horizon crossings on the active day's arc, projected to
        //screen space along with the local tangent angle (radians)
        //so the card can render a small ring oriented perpendicular
        //to the arc at each. Either or both may be null at high
        //latitudes during polar summer / winter when the sun never
        //crosses the horizon.
        sunrise:  { x: number; y: number; angleRad: number; time: Date } | null;
        sunset:   { x: number; y: number; angleRad: number; time: Date } | null;
    } | null
    {
        if (!this.map)
        {
            return null;
        }

        //Ground-level home projection, the SVG anchor for the incidence ray and a reference for any future ground shadow.
        const homeScreen = this._projectScenePoint(this.homeLon, this.homeLat, 0);
        if (!homeScreen)
        {
            return null;
        }

        //Sample the day at evenly-spaced 15-min intervals starting
        //at local midnight. Building the day boundaries in local
        //civil time (rather than UTC) gives a sample at the user's
        //actual midnight, which is when the arc has its visual
        //"start" / "end" point regardless of timezone.
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayMs = 24 * 60 * 60 * 1000;
        const stepMs = dayMs / SUN_ARC_SAMPLES;

        //Use the live cloud cover for irradiance colouring along
        //the whole arc. If we have no live reading yet, treat as
        //clear (0%), the arc still gets coloured at its proper
        //clear-sky intensity so the user sees something meaningful
        //before the first weather fetch lands.
        const liveCloud = this._homeHourlyData
            ? (() => {
                const w = this._getWeatherAtTime(now);
                return w?.cloudCover ?? 0;
            })()
            : 0;

        //Reuse the cached arc inputs when both the calendar day and
        //the (integer-rounded) live cloud cover are unchanged. The
        //heavy trig (96 getSunPosition + 96 computeIrradianceWm2
        //calls per pass) fires only when the cache misses; on every
        //transform / rotation frame we just re-project the cached
        //lon/lat/altitudeM tuples through the current map matrix.
        const dayStartMs  = dayStart.getTime();
        const cloudPctInt = Math.round(liveCloud);
        let cache = this._arcInputsCache;
        if (
            !cache
         || cache.dayStartMs  !== dayStartMs
         || cache.cloudPctInt !== cloudPctInt
        )
        {
            const samples: Array<{
                lon: number;
                lat: number;
                altitudeM: number;
                wm2: number;
                belowHorizon: boolean;
            } | null> = [];
            for (let i = 0; i < SUN_ARC_SAMPLES; i++)
            {
                const t = new Date(dayStartMs + i * stepMs);
                const sun3D = this._sunSpherePoint(t);
                if (!sun3D)
                {
                    samples.push(null);
                    continue;
                }
                //Per-sample priority: sensor reading if one sits
                //within the lookup window, otherwise the analytical
                //clear-sky × cloud-cover model. Mixing the two along
                //the same arc is acceptable since the sensor's
                //samples are sparse (hourly at most) and the gradient
                //transitions smoothly between adjacent points.
                const sensorWm2 = this._sensorIrradianceAt(t);
                const wm2 = sensorWm2 !== null
                    ? sensorWm2
                    : computeIrradianceWm2(t, this.homeLat, this.homeLon, liveCloud);
                samples.push({
                    lon:          sun3D.lon,
                    lat:          sun3D.lat,
                    altitudeM:    sun3D.altitudeM,
                    wm2,
                    //altitudeM in _sunSpherePoint is R·sin(α), same
                    //sign as α, so a negative altitudeM means the sun
                    //is below the horizon at this sample. Surface that
                    //as a flag rather than the raw value because the
                    //card only needs to switch render modes (solid vs
                    //dotted), not the exact angle.
                    belowHorizon: sun3D.altitudeM < 0
                });
            }
            cache = { dayStartMs, cloudPctInt, samples };
            this._arcInputsCache = cache;
        }

        //Per-frame work: re-project the cached samples through the current map matrix, recording depth so we can normalise to a nearness factor
        //below.
        type RawArcPoint = {
            x: number; y: number; irradiance: number; depth: number;
            belowHorizon: boolean;
        };
        const raw: RawArcPoint[] = [];
        for (let i = 0; i < SUN_ARC_SAMPLES; i++)
        {
            const s = cache.samples[i];
            if (!s)
            {
                continue;
            }
            const px = this._projectScenePoint(s.lon, s.lat, s.altitudeM);
            if (!px)
            {
                continue;
            }
            raw.push({
                x:            px.x,
                y:            px.y,
                irradiance:   s.wm2,
                depth:        px.depth,
                belowHorizon: s.belowHorizon
            });
        }

        //Sun at "now", same spherical projection as the arc points.
        const sunNow3D = this._sunSpherePoint(now);
        const sunNowAlt = getSunPosition(now, this.homeLat, this.homeLon).altitude;
        const sunNowSensor = this._sensorIrradianceAt(now);
        const sunNowWm2 = sunNowSensor !== null
            ? sunNowSensor
            : computeIrradianceWm2(now, this.homeLat, this.homeLon, liveCloud);

        let sunScreen: { x: number; y: number; depth: number } | null = null;
        if (sunNow3D)
        {
            sunScreen = this._projectScenePoint(sunNow3D.lon, sunNow3D.lat, sunNow3D.altitudeM);
        }
        if (!sunScreen)
        {
            //Even at night we want a defined sun position so the
            //incidence ray has somewhere to anchor (offscreen below
            //the home is fine, the ray just won't be drawn). Fall
            //back to the home location so downstream maths stays
            //finite. Depth is borrowed from home so the sun's
            //nearness factor degrades gracefully (it's not visible
            //in this case anyway).
            sunScreen = { ...homeScreen, depth: homeScreen.depth };
        }

        //Establish the depth range across the full arc + the sun,
        //so every visible element shares one consistent perspective
        //scale. nearness = 1 at the smallest depth (nearest), 0 at
        //the largest (furthest). The arc spans 24 h so the depth
        //range usually covers everything from the sun behind the
        //camera at noon to the sun on the far horizon at dusk.
        let dMin = Infinity;
        let dMax = -Infinity;
        for (const p of raw)
        {
            if (p.depth < dMin) { dMin = p.depth; }
            if (p.depth > dMax) { dMax = p.depth; }
        }
        if (sunScreen.depth < dMin) { dMin = sunScreen.depth; }
        if (sunScreen.depth > dMax) { dMax = sunScreen.depth; }
        const dRange = (dMax - dMin) || 1;
        const nearnessOf = (d: number) => 1 - (d - dMin) / dRange;

        const arc = raw.map(p => ({
            x:            p.x,
            y:            p.y,
            irradiance:   p.irradiance,
            nearness:     nearnessOf(p.depth),
            belowHorizon: p.belowHorizon
        }));

        //daylight factor, a smooth 0..1 ramp keyed on solar
        //altitude. Below -6° (astronomical horizon) it bottoms out
        //at SUN_ARC_NIGHT_OPACITY; above +6° it's full intensity;
        //the band in between blends smoothly so dawn/dusk doesn't
        //pop visually.
        const daylight = (() =>
        {
            if (sunNowAlt >= 6) { return 1; }
            if (sunNowAlt <= -6) { return SUN_ARC_NIGHT_OPACITY; }
            const t01 = (sunNowAlt + 6) / 12;
            return SUN_ARC_NIGHT_OPACITY + (1 - SUN_ARC_NIGHT_OPACITY) * t01;
        })();

        //Horizon crossings on the active day's arc. We walk the cached
        //arc samples (one every 15 min) and look for the
        //belowHorizon → above transition (sunrise) and the above →
        //below transition (sunset). For visual placement we interpolate
        //linearly between the bracketing samples; 15 min granularity is
        //way over-precise for a screen marker. The screen-space tangent
        //at each crossing comes from the bracketing arc points and is
        //handed to the card so it can rotate the ring perpendicular to
        //the arc at that point. Polar summer / winter and other days
        //with no horizon crossing simply leave both null.
        let sunrise: { x: number; y: number; angleRad: number; time: Date } | null = null;
        let sunset:  { x: number; y: number; angleRad: number; time: Date } | null = null;
        for (let i = 1; i < cache.samples.length; i++)
        {
            const prev = cache.samples[i - 1];
            const curr = cache.samples[i];
            if (!prev || !curr)
            {
                continue;
            }

            const prevBelow = prev.belowHorizon;
            const currBelow = curr.belowHorizon;
            if (prevBelow === currBelow)
            {
                continue;
            }

            //Linear interpolation on altitudeM (positive above
            //horizon, negative below). t=0 lands on prev, t=1 on
            //curr. The interpolated altitudeM is exactly 0 at the
            //horizon crossing.
            const aPrev = prev.altitudeM;
            const aCurr = curr.altitudeM;
            const span  = aCurr - aPrev;
            const t     = (Math.abs(span) < 1e-6) ? 0.5 : (-aPrev / span);
            const tClamped = Math.max(0, Math.min(1, t));

            const lerpLon = prev.lon + (curr.lon - prev.lon) * tClamped;
            const lerpLat = prev.lat + (curr.lat - prev.lat) * tClamped;
            const px = this._projectScenePoint(lerpLon, lerpLat, 0);
            if (!px)
            {
                continue;
            }

            //Tangent: project both bracketing samples to screen and
            //take the angle of (curr - prev). The ring is drawn
            //rotated perpendicular to that tangent (so the arc looks
            //like it threads through the ring).
            const pxPrev = this._projectScenePoint(prev.lon, prev.lat, prev.altitudeM);
            const pxCurr = this._projectScenePoint(curr.lon, curr.lat, curr.altitudeM);
            const angleRad = (pxPrev && pxCurr)
                ? Math.atan2(pxCurr.y - pxPrev.y, pxCurr.x - pxPrev.x)
                : 0;

            const time = new Date(dayStartMs + (i - 1 + tClamped) * stepMs);
            const marker = { x: px.x, y: px.y, angleRad, time };

            if (prevBelow && !currBelow)
            {
                sunrise = marker;
            }
            else if (!prevBelow && currBelow)
            {
                sunset  = marker;
            }
        }

        return {
            arc,
            sun:      {
                x: sunScreen.x, y: sunScreen.y,
                irradiance: sunNowWm2,
                altitude:   sunNowAlt,
                nearness:   nearnessOf(sunScreen.depth)
            },
            home:     { x: homeScreen.x, y: homeScreen.y },
            daylight,
            sunrise,
            sunset
        };
    }

    //Convert (date) → 3D point on the imaginary celestial hemisphere
    //of radius SUN_ARC_RADIUS_M centred on the home, in (lon, lat,
    //altitude_m) form ready for _projectScenePoint.
    //
    //Convention: azimuth measured clockwise from North, altitude
    //above the horizon. ENU offsets relative to the home are then
    //  east  = R · cos(α) · sin(φ)
    //  north = R · cos(α) · cos(φ)
    //  up    = R · sin(α)
    //and the (east, north) offset is converted into a (lon, lat)
    //offset using local metres-per-degree (good enough for the few-
    //hundred-metre extents we care about).
    private _sunSpherePoint(date: Date): {
        lon: number; lat: number; altitudeM: number
    } | null
    {
        const sun = getSunPosition(date, this.homeLat, this.homeLon);
        const D   = Math.PI / 180;
        const a   = sun.altitude * D;
        const z   = sun.azimuth  * D;

        //Scale the celestial radius on fullscreen / kiosk layouts so the arc reads from across the room instead of sitting at its grid-tuned size. See
        const R = SUN_ARC_RADIUS_M * this._sunArcScale();
        const east  = R * Math.cos(a) * Math.sin(z);
        const north = R * Math.cos(a) * Math.cos(z);
        const up    = R * Math.sin(a);

        //Local metres-per-degree.
        const mPerDegLat = 111_320;
        const mPerDegLon = 111_320 * Math.cos(this.homeLat * D);

        return {
            lon:        this.homeLon + east  / mPerDegLon,
            lat:        this.homeLat + north / mPerDegLat,
            altitudeM:  up
        };
    }

    //Project an arbitrary (azimuth, altitude) angular position above
    //the home onto the same sphere the sun arc uses, then forward
    public setSelectedTime(time: Date | null): void
    {
        this._selectedTime = time;

        if (time === null)
        {
            this._clearWeatherTimer();
            //Same 10-min cadence as the post-fetch interval above , returning to live mode resumes the standard refresh rhythm rather than
            //re-anchoring on the original hourly pace.
            this._weatherTimer = window.setInterval(
                () => this._refreshWeather(this._fetchLat, this._fetchLon),
                600_000
            );
        }
        else
        {
            this._clearWeatherTimer();
        }

        if (this._mapReady)
        {
            //Force atmosphere refresh: the user just scrubbed time, so the "have we moved enough" guard would otherwise short-circuit.
            this._lastAtmosphereAlt = -999;
            this._renderForCurrentSelection();
            //Coalesce rapid scrub moves into a single shadow paint
            //every ~100 ms. The light-weight visuals (sun arc, PV
            //chip, cloud disc) already updated through
            //_renderForCurrentSelection() above; only the costly
            //shadow raster paint (LiDAR + atmosphere recompute) is
            //deferred. Snapshots align with the final pointer
            //position once the user pauses for 100 ms.
            if (this._selectedTimeShadowTimer !== null)
            {
                window.clearTimeout(this._selectedTimeShadowTimer);
            }
            this._selectedTimeShadowTimer = window.setTimeout(() =>
            {
                this._selectedTimeShadowTimer = null;
                this._refreshShadowsAndAtmosphere();
            }, 100);
        }
    }

    //Expose the hourly series the card needs to draw the chart.
    //
    //Returns one entry per hour over the full forecast window:
    //  - time:       the timestamp
    //  - irradiance: W/m², from the model's shortwave_radiation_instant
    //                when available (>= 0), otherwise the Haurwitz +
    //                Kasten-Czeplak fallback so the curve stays
    //                continuous past the model horizon
    //  - cloud:      effective cloud cover in %, the same layer-
    //                weighted figure used everywhere else
    //
    //Returns null until the first weather fetch completes, mirroring
    //the contract of projectSunScene / projectHomeLabelLayout. The
    //Read-only view of the currently loaded LiDAR nDSM raster.
    //Returns the same buffer the LiDAR View overlay paints, plus
    //its geographic bbox; the caller treats it as immutable
    //(reading only) so we hand the live reference rather than a
    //copy. Null when no LiDAR provider covers the home or the
    //last fetch failed.
    //
    //The optional `terrain` field carries the DTM band when the
    //source COG ships one (helios-lidar.org 2-band output); it
    //lets the shading ray-march lift its comparison into absolute
    //Z so sloped ground between the panel and a far obstacle is
    //taken into account. Absent on every public provider and on
    //legacy single-band local COGs.
    public getLidarRaster():
        | {
            heights:    Float32Array;
            terrain?:   Float32Array;
            rasterSize: number;
            minLat:     number;
            maxLat:     number;
            minLon:     number;
            maxLon:     number;
          }
        | null
    {
        return this._lidarRaster;
    }

    //Hourly air temperature + wind speed series aligned with
    //getTimelineSeries' `times` array. Both arrays may contain
    //NaN entries where the model didn't return a value; callers
    //skip those rather than rendering them. Null when no weather
    //payload has landed yet.
    public getAmbientSeries(): {
        times:        Date[];
        temperature:  number[];
        windSpeed:    number[];
    } | null
    {
        const home = this._homeHourlyData;
        if (!home || !home.times.length)
        {
            return null;
        }
        return {
            times:       home.times,
            temperature: home.temperature,
            windSpeed:   home.windSpeed,
        };
    }


    //card is expected to call this whenever onWeatherUpdate fires and re-render the chart.
    public getTimelineSeries(): {
        times:        Date[];
        irradiance:   number[];
        cloud:        number[];
        //Per-hour horizontal beam + diffuse radiation in W/m², -1 where the model didn't supply them.
        //Surfaced so the predictor in card/pv.ts can transpose a tilted array on the real direct / diffuse
        //split instead of the cloud-derived fraction.
        directRad:    number[];
        diffuseRad:   number[];
        //Per-hour ground snow depth in metres, NaN where the model didn't supply it. Feeds the winter snow-cover derate on the PV output.
        snowDepth:    number[];
        //Per-hour ambient temperature in °C and 10-metre wind speed in m/s, NaN-padded where the model didn't supply a value. Surfaced so the
        //predictor in card/pv.ts can apply the thermal-derating factor without each caller having to re-derive the alignment between the weather hour
        //and the timeline cursor.
        temperature:  number[];
        windSpeed:    number[];
    } | null
    {
        const home = this._homeHourlyData;
        if (!home || !home.times.length)
        {
            return null;
        }

        const irradiance = home.times.map((_, i) =>
        {
            //Per-hour priority: sensor → shortwave (model) → Haurwitz
            //(analytical). Forecast hours never carry a sensor sample
            //(it would lie in the future), so the future half of the
            //chart automatically falls through to the model.
            const sensorWm2 = this._sensorIrradianceAt(home.times[i]);
            if (sensorWm2 !== null)
            {
                return sensorWm2;
            }
            const sw = home.shortwave[i] ?? -1;
            if (sw >= 0)
            {
                return sw;
            }
            //Haurwitz fallback: returns a normalised PV percentage,
            //we re-scale to W/m² (1000 = STC) so the chart's Y axis
            //is a single unit across both data sources.
            const pct = computePvPower(home.times[i], this.homeLat, this.homeLon, home.cloudCover[i] ?? 0);
            return pct * 10;
        });

        const cloud = home.times.map((_, i) => home.cloudCover[i] ?? 0);

        //Beam + diffuse pass straight through from the model with the -1 sentinel preserved: unlike the
        //GHI above there is no sensor / Haurwitz fallback, so a hour the provider didn't decompose reads
        //-1 and the transposition reverts to the cloud-derived split for that hour only.
        const directRad  = home.times.map((_, i) => home.directRad[i]  ?? -1);
        const diffuseRad = home.times.map((_, i) => home.diffuseRad[i] ?? -1);

        return {
            times:       home.times.slice(),
            irradiance,
            cloud,
            directRad,
            diffuseRad,
            snowDepth:   home.snowDepth.slice(),
            temperature: home.temperature.slice(),
            windSpeed:   home.windSpeed.slice(),
        };
    }

    //Snapshot of the engine's live state. Consumed by the card's own
    //`getStatsSnapshot()` and surfaced through `window.heliosStats()`
    //for in-browser debugging. The shape is intentionally JSON-safe
    //so the user can `JSON.stringify(window.heliosStats())` and paste
    //the result publicly when filing an issue. No PII is returned
    //here: the home lat/lon and elevation are stripped (only the
    //hemisphere is kept, the sun-arc orientation depends on it), and
    //the API key never leaves the card-level snapshot anyway.
    public getStatsSnapshot(): Record<string, unknown>
    {
        const provider = resolveLidarSource(this.homeLat, this.homeLon, this.cfg);
        const shadowsOn = this._shadowsEnabled();
        const lidarFeatures = this._lidarShadowFeatures;
        const buildingsFootprints = this._buildingsData
            ? {
                home:         this._buildingsData.home.features.length,
                surroundings: this._buildingsData.surroundings.features.length
              }
            : null;
        let shadowSource: string;
        if (!shadowsOn)
        {
            shadowSource = 'disabled';
        }
        else if (lidarFeatures && lidarFeatures.features.length > 0)
                                                          shadowSource = 'lidar';
        else if (this._buildingsData)
        {
            shadowSource = 'maptiler';
        }
        else
        {
            shadowSource = 'pending';
        }

        return {
            mapReady:             this._mapReady,
            //Home position deliberately omitted. `lidarProvider` and
            //`hemisphere` cover every debug case we care about
            //(coverage check + sun-arc orientation) without leaking
            //the user's address.
            hemisphere:           this.homeLat >= 0 ? 'N' : 'S',
            lidarProvider:        provider ? provider.id : null,
            shadows:
            {
                enabled:          shadowsOn,
                source:           shadowSource,
                opacity:          this._shadowOpacity(),
                lidarClumps:      lidarFeatures?.features.length ?? 0,
                lidarPrecision:   this._lidarPrecisionLevel(),
                clipRadiusM:      this._buildingRadiusMeters(),
                lastSigCached:    this._lastShadowSig !== undefined,
                lidarDiagnostics: this._lidarShadowDiagnostics
            },
            buildings:
            {
                radiusM:          this._buildingRadiusMeters(),
                clusterRadiusM:   this._buildingClusterRadiusMeters(),
                opacity:          this._buildingOpacity(),
                color:            this._buildingColor(),
                footprints:       buildingsFootprints
            },
            weather:
            {
                samples:          this._homeHourlyData?.times.length ?? 0,
                rateLimitStreak:  this._rateLimitStreak,
                //Module-level counters shared across every Helios card on the page (the localStorage
                //cache + the inflight dedup map both live at module scope), so the figures reflect
                //the COMBINED Open-Meteo traffic of this browser session. Most useful to read when
                //debugging a rate-limit or audit complaint.
                openMeteoStats:   getWeatherFetchStats()
            },
            timeline:
            {
                //Range + selectedTime kept as ISO strings rather than Date instances so the snapshot round-trips through JSON.stringify cleanly.
                rangeStart:       this._getTimeRange()?.start?.toISOString() ?? null,
                rangeEnd:         this._getTimeRange()?.end?.toISOString()   ?? null,
                selectedTime:     this._selectedTime?.toISOString() ?? null
            },
            caches:
            {
                arcCacheDay:      this._arcInputsCache
                    ? new Date(this._arcInputsCache.dayStartMs).toISOString().slice(0, 10)
                    : null,
                arcCacheCloudPct: this._arcInputsCache?.cloudPctInt ?? null
            }
        };
    }

    public updateConfig(cfg: HeliosConfig): void
    {
        bumpStat('updateConfigCalls');
        const prevStyleUrl = this._resolveMapStyle().url;
        const prevPixelR   = this._pixelRatio();
        const prevRadius      = this._buildingRadiusMeters();
        const prevCluster     = this._buildingClusterRadiusMeters();
        const prevOpacity     = this._buildingOpacity();
        const prevColor       = this._buildingColor();
        const prevPrecision   = this._lidarPrecisionLevel();
        const prevShadowOpa   = this._shadowOpacity();
        const prevShadowsOn   = this._shadowsEnabled();
        const prevAutoRotateOn = this.cfg['auto-rotate-enabled'] === true;
        const prevCameraLocked = (this.cfg as Record<string, unknown>)['camera-locked'] === true;
        this.cfg = { ...cfg };

        //Re-arm the auto-rotate rAF loop when either long-lived flag transitions back to a rotation-permitting
        //state. The loop suspends itself when disabled to avoid burning 60 Hz of CPU on a no-op tick (see the early
        //return inside tick() in src/engine/auto-rotate.ts).
        const nextAutoRotateOn = this.cfg['auto-rotate-enabled'] === true;
        const nextCameraLocked = (this.cfg as Record<string, unknown>)['camera-locked'] === true;
        const nowPermitsRotation  = nextAutoRotateOn && !nextCameraLocked;
        const prevPermitsRotation = prevAutoRotateOn && !prevCameraLocked;
        if (nowPermitsRotation && !prevPermitsRotation && this.map)
        {
            startAutoRotateLoop(this);
        }

        if (!this.map)
        {
            return;
        }

        //Map-style change → reload the basemap. setStyle() replaces
        //sources, layers, sprites and glyphs; our custom sources get
        //wiped and re-added by the _onStyleLoad handler. Drop
        //_mapReady while the new style is in flight so other code
        //paths don't operate on a half-loaded style.
        const nextStyleInfo = this._resolveMapStyle();
        const styleNeedsReload = nextStyleInfo.url !== prevStyleUrl;
        if (styleNeedsReload)
        {
            bumpStat('styleReloads');
            this._mapReady = false;
            this.map.setStyle(nextStyleInfo.url);
            return;
        }

        //Pixel-ratio toggle: apply in-place, no style reload needed.
        const nextPixelR = this._pixelRatio();
        if (nextPixelR !== prevPixelR)
        {
            try { this.map.setPixelRatio(nextPixelR); } catch (_) {}
        }

        this._applyLabelVisibility();

        //Building updates. Radius or cluster-radius changes invalidate the cached GeoJSON and trigger a refetch via _addBuildings. Opacity / colour
        //changes are cheap paint-property updates.
        const nextRadius  = this._buildingRadiusMeters();
        const nextCluster = this._buildingClusterRadiusMeters();
        const nextOpacity = this._buildingOpacity();
        const nextColor   = this._buildingColor();
        if (nextRadius !== prevRadius || nextCluster !== prevCluster)
        {
            this._buildingsData     = null;
            this._buildingsFetchKey = '';
            this._addBuildings();
            if (nextRadius !== prevRadius)
            {
                //The display radius also drives the camera bounds, the LiDAR raster extent and the
                //LiDAR / shadow fade band. Re-clamp the bounds, re-push the fade range and invalidate
                //the LiDAR shadow fetch so the whole rendered disc resizes in lockstep when the user
                //drags the slider.
                this._applyMapBounds();
                this._pushLidarViewFadeRange();
                this._lidarShadowKey          = '';
                this._lidarShadowFailedKey    = '';
                this._lidarShadowFailureCount = 0;
                this._lidarShadowBackoffUntil = 0;
                this._lidarShadowFeatures     = null;
                this._lidarShadowDiagnostics  = null;
                this._ensureLidarFetched();
            }
        }
        else
        {
            if (nextOpacity !== prevOpacity
             && this.map.getLayer('helios-buildings-surroundings'))
            {
                this.map.setPaintProperty(
                    'helios-buildings-surroundings',
                    'fill-extrusion-opacity',
                    nextOpacity
                );
            }
            if (nextColor !== prevColor)
            {
                for (const lid of ['helios-buildings-surroundings', 'helios-buildings-home'])
                {
                    if (this.map.getLayer(lid))
                    {
                        this.map.setPaintProperty(lid, 'fill-extrusion-color', nextColor);
                    }
                }
            }
        }

        //LiDAR precision change invalidates the cached shadow features
        //(fetch key includes the raster size) and triggers a refetch
        //at the new sampling. _ensureLidarFetched handles the diff.
        //Also clear the failure / backoff state so a user changing
        //precision after a failure retries IMMEDIATELY rather than
        //waiting for the backoff window to expire.
        const nextPrecision = this._lidarPrecisionLevel();
        if (nextPrecision !== prevPrecision)
        {
            this._lidarShadowKey          = '';
            this._lidarShadowFailedKey    = '';
            this._lidarShadowFailureCount = 0;
            this._lidarShadowBackoffUntil = 0;
            this._lidarShadowFeatures     = null;
            this._lidarShadowDiagnostics  = null;
            this._ensureLidarFetched();
        }

        //Shadow opacity is a paint-level update on the raster layer.
        const nextShadowOpa = this._shadowOpacity();
        if (nextShadowOpa !== prevShadowOpa)
        {
            for (const lid of SHADOW_LAYER_IDS)
            {
                if (this.map.getLayer(lid))
                {
                    try { this.map.setPaintProperty(lid, 'raster-opacity', nextShadowOpa); }
                    catch (_) {}
                }
            }
        }

        //Master shadow toggle: when turning on, fetch LiDAR shadows
        //if a provider covers the home; when turning off, drop the
        //cached LiDAR features and clear the projected polygons.
        const nextShadowsOn = this._shadowsEnabled();
        if (nextShadowsOn !== prevShadowsOn)
        {
            if (nextShadowsOn)
            {
                this._ensureLidarFetched();
            }
            else
            {
                this._resetLidarFetchState();
            }
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
        }

        //LiDAR View visual knobs (radius / point size / colour /
        //opacity) are cheap uniform updates on the custom GL layer.
        //Pushed unconditionally; the layer no-ops when nothing actually
        //changed.
        this._pushLidarViewConfig();

        if (this._homeHourlyData && this._mapReady)
        {
            this._renderForCurrentSelection();
        }
    }


    public cleanup(): void
    {
        bumpStat('enginesCleanedUp');
        _liveEngines.delete(this);
        this._clearWeatherTimer();
        if (this._selectedTimeShadowTimer !== null)
        {
            window.clearTimeout(this._selectedTimeShadowTimer);
            this._selectedTimeShadowTimer = null;
        }
        window.clearInterval(this._skyTimer);
        window.clearTimeout(this._resizeDebounceTimer);
        this._fetchAbortController?.abort();
        this._buildingsAbort?.abort();
        //Use the centralised reset to also clear failed-key + backoff fields so a future re-init doesn't inherit a stale backoff
        //window from the dying engine.
        this._resetLidarFetchState();
        this._shadowCanvas           = undefined;
        this._arcInputsCache         = undefined;
        this._lastShadowSig          = undefined;
        this._resizeObserver?.disconnect();
        if (this._autoRotateRaf !== undefined)
        {
            cancelAnimationFrame(this._autoRotateRaf);
            this._autoRotateRaf = undefined;
        }
        if (this._detailDiveRaf !== undefined)
        {
            cancelAnimationFrame(this._detailDiveRaf);
            this._detailDiveRaf = undefined;
        }
        //Cancel the LiDAR-View exposure pipeline. The idle callback can
        //fire AFTER cleanup, and the chunked rAF loop captures `this`
        //in its closure, so leaving either token live would pin the
        //dead engine + its WebGL context for at least one extra frame
        //per chunk, which adds up across rapid config edits when
        //many engines respawn in quick succession.
        if (this._exposureIdleHandle !== undefined)
        {
            this._cancelIdleCb(this._exposureIdleHandle);
            this._exposureIdleHandle = undefined;
        }
        if (this._exposureChunkRaf !== undefined)
        {
            cancelAnimationFrame(this._exposureChunkRaf);
            this._exposureChunkRaf = undefined;
        }
        this._lidarViewActive = false;

        //Tear-down strategy: explicit + defensive + force-lose.
        //
        //We can't trust MapLibre's map.remove() alone to release
        //every listener / source / WebGL resource, on iOS Safari
        //in particular, a dirty remove() leaves closures pinning
        //the dead engine, GeoJSON sources lingering in the GPU,
        //and the WebGL context slot occupied (browsers cap at
        //8-16 active contexts). The drift after several editor
        //re-inits was the symptom; this multi-step cleanup is the
        //fix.
        //
        //Order matters: detach DOM listeners first (so MapLibre's
        //own teardown sees a clean canvas), then unhook every
        //map.on() we registered explicitly, then remove our custom
        //sources/layers (saves the GPU work even if remove() would
        //do it), THEN call map.remove(), THEN force-lose the WebGL
        //context to release the slot.

        const canvas = this._mapCanvas;

        //Step 1, DOM listeners on the canvas (single-pointer drag-
        //rotate, WebGL context lost/restored). The auto-rotate
        //inactivity bump now lives inside the drag-rotate handler
        //itself, no separate listeners to detach.
        if (this._dragRotateHandlers)
        {
            const h = this._dragRotateHandlers;
            h.canvas.removeEventListener('pointerdown',   h.onDown);
            h.canvas.removeEventListener('pointermove',   h.onMove);
            h.canvas.removeEventListener('pointerup',     h.onEnd);
            h.canvas.removeEventListener('pointercancel', h.onEnd);
        }
        if (canvas && this._webglLostHandler)
        {
            canvas.removeEventListener('webglcontextlost', this._webglLostHandler);
        }
        if (canvas && this._webglRestoredHandler)
        {
            canvas.removeEventListener('webglcontextrestored', this._webglRestoredHandler);
        }

        //Grab the WebGL context BEFORE map.remove() destroys it ,
        //we'll force-lose it at the end of cleanup to release the slot.
        let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
        try
        {
            gl = (canvas?.getContext('webgl2') as WebGL2RenderingContext | null)
              ?? (canvas?.getContext('webgl')  as WebGLRenderingContext  | null)
              ?? null;
        }
        catch (_) {}

        //Step 2, every map.on() listener we hold an explicit
        //reference for. map.remove() should clean these up but
        //doing it ourselves means any leftover closure that
        //captures `this` is severed BEFORE the engine is dropped.
        if (this.map)
        {
            try
            {
                if (this._mapPinHandler)
                {
                    this.map.off('move', this._mapPinHandler);
                }
                if (this._mapStyleLoadHandler)
                {
                    this.map.off('style.load',         this._mapStyleLoadHandler);
                }
                if (this._mapLoadHandler)
                {
                    this.map.off('load',               this._mapLoadHandler);
                }
                if (this._mapMoveHandler)
                {
                    this.map.off('move',               this._mapMoveHandler);
                }
                if (this._mapErrorHandler)
                {
                    this.map.off('error',              this._mapErrorHandler);
                }
                if (this._mapStyleImageMissingHandler)
                {
                    this.map.off('styleimagemissing',  this._mapStyleImageMissingHandler);
                }
            }
            catch (_) {}
        }

        //Step 3, explicit removal of every helios-* layer and
        //source so MapLibre doesn't have to walk them itself.
        //removeLayer must precede removeSource (MapLibre rejects
        //removing a source still backing live layers).
        if (this.map)
        {
            for (const lid of [
                'helios-hillshade',
                'helios-night-shade',
                'helios-cloud-disc',
                'helios-cloud-disc-ring',
                'helios-cloud-ring',
                'helios-buildings-surroundings',
                'helios-buildings-home',
                'helios-buildings-home-outline',
                'helios-buildings-home-outline-glow',
                'helios-building-shadows',
                //LiDAR-View custom layer: MapLibre invokes the layer's
                //onRemove() when we removeLayer it, which is what frees
                //the 4 GPU buffers + the WebGLProgram. On the iOS
                //Safari code path where `map.remove()` doesn't fan out
                //to custom layers, this explicit removeLayer is the
                //only thing preventing the buffers + program from
                //leaking through every engine respawn.
                'helios-lidar-view',
                //Weather-mode cloud shader: same rationale. onRemove() frees the program, the
                //quad VBO and the data texture.
                'helios-weather-cloud'
            ])
            {
                try { if (this.map.getLayer(lid)) this.map.removeLayer(lid); }
                catch (_) {}
            }
            //setTerrain(null) before removing the DEM sources, MapLibre
            //refuses to remove a source still referenced by a live
            //terrain binding.
            try { this.map.setTerrain(null); }
            catch (_) {}
            for (const sid of [
                'helios-terrain',
                'helios-night-shade',
                'helios-cloud-rings',
                'helios-buildings-surroundings-src',
                'helios-buildings-home-src',
                'helios-building-shadows-src'
            ])
            {
                try { if (this.map.getSource(sid)) this.map.removeSource(sid); }
                catch (_) {}
            }
        }

        //Step 4, drop heavy instance state BEFORE map.remove() so
        //the dead engine, once unreachable, holds nothing but
        //handles that have already been released.
        this._buildingsData     = null;
        this._buildingsFetchKey = '';
        this._homeHourlyData    = null;
        //Drop the custom WebGL layer reference too. MapLibre's
        //map.remove() will call onRemove() on it (which frees the GL
        //buffers + program), but we MUST drop our own pointer
        //afterwards so the layer instance doesn't linger and pin the
        //(already-deleted) GL handles via its closure. Editor preview
        //respawn bursts otherwise accumulate one stale LidarViewLayer
        //per killed engine, multiplying the WebGL context pressure.
        this._lidarViewLayer        = undefined;
        this._lidarRaster           = null;
        this._mapCanvas             = undefined;
        this._dragRotateHandlers    = undefined;
        this._mapPinHandler         = undefined;
        this._mapStyleLoadHandler   = undefined;
        this._mapLoadHandler        = undefined;
        this._mapMoveHandler        = undefined;
        this._mapErrorHandler       = undefined;
        this._mapStyleImageMissingHandler = undefined;
        this._webglLostHandler      = undefined;
        this._webglRestoredHandler  = undefined;
        this.onContextLost          = undefined;

        //Step 5, MapLibre teardown. Detach the canvas from its
        //parent BEFORE map.remove() so even if MapLibre or the
        //browser keeps an internal reference to the canvas
        //element, it is at least orphaned from the DOM tree and
        //cannot keep the surrounding host (helios-card shadow
        //root + every descendant) alive.
        if (canvas && canvas.parentNode)
        {
            try { canvas.parentNode.removeChild(canvas); }
            catch (_) {}
        }
        this.map?.remove();
        this.map       = undefined;
        this._mapReady = false;

        //Step 6, force the WebGL context slot to release. Browsers
        //don't always reclaim it from canvas GC alone, and the cap
        //(8-16 active contexts) is the dominant cause of perf drift
        //+ random page refresh + iOS Safari black screen after
        //several re-inits.
        try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); }
        catch (_) {}

        //Step 7, clear the debug global so it doesn't pin the dead map.
        try
        {
            const w = window as unknown as { __heliosMap?: unknown };
            if (w.__heliosMap !== undefined)
            {
                delete w.__heliosMap;
            }
        }
        catch (_) {}

    }
}