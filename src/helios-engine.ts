import maplibregl from './maplibre';
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
import {
    CAMERA_PITCH_MIN_DEG, CAMERA_PITCH_MAX_DEG, CAMERA_PITCH_REST_DEG, CAMERA_TARGET_HEIGHT_M,
    SUN_ARC_RADIUS_M, SUN_ARC_SAMPLES, SUN_ARC_NIGHT_OPACITY,
    CLOUD_DISC_RADIUS_M, CLOUD_CIRCLE_SEGMENTS, PV_CHIP_OFFSET_PX, DEFAULT_CLOUD_RGB,
} from './constants';
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
    periodPastDays,
    periodFutureDays,
} from './helios-config';


//Single ground-shadow layer rendered as a rasterised image source (not fill polygons): the projector's
//polygons are painted full-black onto an offscreen canvas, then a raster layer draws it at shadow-opacity.
//Per-pixel coverage avoids the alpha saturation that overlapping fill polygons cause in dense forest.
export const SHADOW_LAYER_IDS: readonly string[] = [
    'helios-building-shadows'
];

//Lifecycle instrumentation on window.__heliosStats so lifecycle leaks (engines not torn down, excess
//setStyle calls) can be diagnosed by diffing a snapshot before/after editor activity. Cheap, no I/O.
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


//Cap on simultaneously-live HeliosEngine instances. HA's editor spawns a fresh preview card per config
//edit without reliably firing disconnectedCallback, so orphaned engines accumulate and exhaust WebGL
//contexts (Safari mobile caps ~8, causing FPS drift / iOS black-screen). We track live engines in a Set
//and evict the oldest before exceeding the cap. 4 leaves room for live card + HA preview + transients
//without evicting the live card (2 fired on the first edit); browser per-origin caps are ~8-16.
const MAX_LIVE_ENGINES = 4;

const _liveEngines = new Set<HeliosEngine>();


//-----------------------------------------------------------------
//Shared module-scope caches for parsed fetch payloads (buildings GeoJSON, LiDAR raster). HA re-creates the
//card element on every config commit, re-allocating the WebGL context, but a fresh engine can pick up the
//already-parsed data synchronously and skip the parse+projection cost (10-50 ms buildings, 100 ms-1 s
//LiDAR) that otherwise shows as a preview flash. TTL is wide since the data is static; the key encodes
//home position + radius + raster size, so any meaningful change invalidates the entry naturally.
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

//Source of the irradiance shown in the PV legend, in precedence order:
//  haurwitz  - analytical clear-sky GHI (Haurwitz 1945) + cloud attenuation (Kasten-Czeplak 1980);
//              always available, used as fallback past the forecast horizon or when shortwave is missing.
//  shortwave - shortwave_radiation_instant from the weather model (median of active models in 'high');
//              more accurate as it accounts for aerosols/humidity/multi-layer cloud.
//  sensor    - value from a HA entity via setLiveIrradianceOverride; a real measurement at the home, so
//              it wins, but only in live mode (scrubbing past/forecast falls back to shortwave/haurwitz).
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
    //Ambient context for the card-side PV prediction: temperature drives thermal derating, wind the
    //convective cooling term. NaN means the model lacked the value; predictor falls back to derating = 1.
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




//Parse a CSS colour ("#rrggbb", "rgb(...)", "rgba(...)", or a getComputedStyle-resolved var) into a
//0..1 RGB triplet for WebGL uniforms. Returns white on failure (LiDAR view falls back to pre-theme look).
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

//Build a closed-ring polygon approximating a metre-sized geographic circle (MapLibre's `circle` layer is
//pixel-sized markers, not real discs). 64 segments read as a true circle at our zoom for no measurable
//cost. Uses the equirectangular metres-per-degree approximation (1° lat ≈ 111320 m, 1° lon ≈ that × cos
//lat), valid at our few-hundred-metre scale. First point is repeated at the end to close per GeoJSON spec.
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

//Cloud disc, chip cluster, camera target and sun-arc tunables now live in constants.ts.


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

    //Last sun (alt, az) the LiDAR-View exposure compute ran against. Compute is expensive (50-150 ms), so
    //it's gated on the same 0.5° delta as the atmosphere plus azimuth (faster near sunrise/sunset). Sentinel
    //init guarantees the first compute fires when LiDAR View turns on.
    private _lastLidarExposureAlt: number = -999;
    private _lastLidarExposureAz:  number = -999;
    //Handle for the deferred exposure compute (requestIdleCallback, setTimeout fallback on older Safari).
    //Stored so an in-flight schedule can be cancelled if the sun moves again before it fires.
    private _exposureIdleHandle:   number | undefined;

    //Consecutive HTTP 429 count, drives exponential back-off. Resets on any successful fetch.
    private _rateLimitStreak = 0;
    //Host callback fired when the home-point fetch enters/leaves the rate-limited state, so the card can
    //show an alert explaining why weather stopped refreshing.
    public onWeatherRateLimitChange?: (rateLimited: boolean) => void;
    private _emittedRateLimited = false;
    private _setRateLimited(rateLimited: boolean): void
    {
        if (this._emittedRateLimited === rateLimited) { return; }
        this._emittedRateLimited = rateLimited;
        try { this.onWeatherRateLimitChange?.(rateLimited); }
        catch (_) { /* host callback errors must not break the fetch path */ }
    }
    //Consecutive non-429 failure count (5xx, network, JSON parse). Drives a graduated back-off so an
    //outage no longer retries at a flat 60 s cadence and piles up IP-rate-limit traffic. Resets on success.
    private _otherErrorStreak = 0;

    private _fetchAbortController?: AbortController;
    private _resizeDebounceTimer?:  number;
    private _weatherTimer?:         number;
    private _skyTimer?:             number;
    private _resizeObserver?:       ResizeObserver;
    //When true, the shadow-refresh timer and dome re-projection short-circuit. Toggled by the card's
    //IntersectionObserver so an off-screen or hidden-tab card pays nothing until it returns.
    private _paused = false;

    //_weatherTimer holds either a setInterval id (refresh) or a setTimeout id (back-off); the ID spaces
    //aren't guaranteed disjoint by spec, so clear both.
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
    //Buildings GeoJSON fetch lifecycle (around fetchBuildingsAroundHome) for the loading banner.
    public onBuildingsFetchStart?: () => void;
    public onBuildingsFetchEnd?:   () => void;

    //Irradiance samples from a HA solar-radiation sensor (history + live state), sorted ascending by time.
    //Null = no entity or no usable samples (model irradiance used unchanged). Each is W/m², treated as
    //ground-truth shortwave irradiance at the home in the same units as shortwave_radiation_instant, so it
    //slots into the pipeline unscaled. Lookup is nearest-neighbour within a strict ±30 min window; outside
    //it (and always for forecast time) we fall through to the model rather than extrapolate stale values.
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

        //Skip the re-render when the dataset is unchanged. The card pushes samples every Lit cycle; without
        //this guard each push fires onWeatherUpdate -> updated() -> push again, an infinite loop that
        //freezes the dashboard the moment a solar-radiation entity is selected.
        if (this._sensorSamplesEqual(this._sensorIrradianceSamples, next))
        {
            return;
        }
        this._sensorIrradianceSamples = next;
        //Invalidate the arc cache so the next projectSunScene rebuilds with the new sensor ground truth.
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

    //Nearest-neighbour lookup over the sensor history; returns the W/m² reading closest to `t` within the
    //window, else null (caller falls back to the model). Linear scan is fine for ~hourly few-day samples.
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
    //Map transform changed: card recomputes screen-space projections (arc, chips, leaders) from this hook.
    public onMapTransform?:  () => void;

    //False once cleanup() has run. The card polls this so it can detect when its engine was force-evicted
    //by the MAX_LIVE_ENGINES cap; otherwise it calls updateConfig() on a destroyed map.
    public isAlive(): boolean
    {
        return this.map !== undefined;
    }

    //Camera pose persistence via localStorage keyed on home coords. Lovelace doesn't persist config-changed
    //from a live card (only the editor preview), so YAML round-trip isn't an option. 3-decimal rounding
    //(~111 m) separates neighbouring homes while tolerating GPS jitter.
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
            //Quota/disabled-storage/private-window errors degrade to "no stored pose, use defaults".
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
            //Silent-degrade like the reader; only cross-reload persistence is lost, live state is intact.
        }
    }
    //Resting pose at map init: localStorage (runtime lock chip) first, then legacy YAML camera-*-deg keys,
    //then the hemisphere-aware default (south up in NH, north up in SH). Wrapped/clamped against stale reads.
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
    //True when drag-rotate/pitch and idle auto-orbit are all suppressed (locked pose). localStorage flag
    //(live lock chip) first, then legacy YAML key.
    public isCameraLocked(): boolean
    {
        const stored = this._readStoredPose();
        if (stored && typeof stored.locked === 'boolean')
        {
            return stored.locked;
        }
        return (this.cfg as Record<string, unknown>)['camera-locked'] === true;
    }
    //Live setter so the editor slider previews a bearing without a config commit. Wraps to [0, 360).
    public setCameraBearing(deg: number): void
    {
        if (!this.map || !Number.isFinite(deg))
        {
            return;
        }
        const wrapped = ((deg % 360) + 360) % 360;
        this.map.setBearing(wrapped);
    }
    //Live setter for the editor's pitch slider, clamped to the drag-pitch bounds.
    public setCameraPitch(deg: number): void
    {
        if (!this.map || !Number.isFinite(deg))
        {
            return;
        }
        const clamped = Math.max(CAMERA_PITCH_MIN_DEG, Math.min(CAMERA_PITCH_MAX_DEG, deg));
        this.map.setPitch(clamped);
    }
    //Toggle the lock at runtime (no respawn). Flips the pinch-rotate handler; drag-rotate re-checks
    //isCameraLocked() per pointerdown. Mutates cfg in-place and refreshes localStorage for the next boot.
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
    //Defaults the editor's reset button restores: always the hemisphere-aware boot pose, never the user's
    //customised values (reading _initialBearing/_initialPitch would echo back what they just changed).
    public getDefaultBearing(): number { return this.homeLat >= 0 ? 180 : 0; }
    public getDefaultPitch():   number { return CAMERA_PITCH_REST_DEG; }
    //Live pose readers so the editor pre-fills its sliders with the current view, not the committed YAML.
    public getCameraBearing(): number { return this.map ? this.map.getBearing() : this.getDefaultBearing(); }
    public getCameraPitch():   number { return this.map ? this.map.getPitch()   : this.getDefaultPitch(); }
    public getCameraZoom():    number { return this.map ? this.map.getZoom()    : 18; }

    //Pre-weather-mode pose snapshot, captured on enterWeatherCamera so exitWeatherCamera restores exactly
    //the pose, lock state, and zoom min/max the user had (rather than snapping back to the boot pose).
    private _preWeatherPose: {
        bearing:   number;
        pitch:     number;
        zoom:      number;
        center:    [number, number];
        locked:    boolean;
        minZoom:   number;
        maxZoom:   number;
        //Captured maxBounds so the exit restores the tight building-radius clamp; otherwise _applyMapBounds
        //races the easeTo and clamps the camera mid-animation.
        maxBoundsWest:  number | null;
        maxBoundsSouth: number | null;
        maxBoundsEast:  number | null;
        maxBoundsNorth: number | null;
        //Camera-target top padding at enter time, so the exit animates back to the framed point in
        //lock-step with the zoom-in rather than snapping at moveend.
        paddingTop:     number;
    } | null = null;
    //Pending setTimeout re-tightening the zoom envelope after an exit's easeTo lands. Held so a rapid
    //UI->Weather->UI->Weather sequence can cancel a stale tighten before it re-clamps mid-ease.
    private _weatherZoomTighten: number | null = null;

    //Weather-mode camera transition: tilt top-down + zoom out so the cloud overlay reads as a satellite
    //plan. Three knobs give:
    //  1. Zoom min/max are locked to 18 at map init; we temporarily widen to [10, 18] and restore on exit.
    //  2. Rotation gets locked the moment we enter so a stray drag doesn't pan the overhead view
    //     out of frame. The pre-enter lock state is captured so the exit restores it verbatim.
    //  3. easeTo carries the pose change on a 1200 ms cubic easing so the transition reads as a
    //     deliberate "stepping back" rather than a jump cut.
    //Camera-target padding state. _appliedPaddingTop is the last padding we pushed (also the
    //re-entrancy ledger the weather enter/exit pre-set); the last pitch/zoom gate the recompute so
    //bearing-only rotation never moves the target and setPadding's own moveend can't loop.
    private _appliedPaddingTop = -1;
    private _lastPaddingPitch  = -1;
    private _lastPaddingZoom    = -1;
    private _applyingPadding    = false;

    //Frame a point CAMERA_TARGET_HEIGHT_M above the home: size the MapLibre top padding to that
    //height's on-screen projection so the house sits lower with headroom above for the arc. Called
    //only on moveend (never frame-by-frame) so it can't interrupt the programmatic weather eases.
    //Gated on pitch/zoom (the only inputs) so rotation never moves it; collapses to ~0 top-down.
    private _applyCameraTargetPadding(): void
    {
        if (!this.map || this._applyingPadding) { return; }
        const pitch = this.map.getPitch();
        const zoom  = this.map.getZoom();
        if (Math.abs(pitch - this._lastPaddingPitch) < 0.5
         && Math.abs(zoom  - this._lastPaddingZoom)  < 0.01)
        {
            return;
        }
        this._lastPaddingPitch = pitch;
        this._lastPaddingZoom  = zoom;
        const ground   = this._projectScenePoint(this.homeLon, this.homeLat, 0);
        const elevated = this._projectScenePoint(this.homeLon, this.homeLat, CAMERA_TARGET_HEIGHT_M);
        if (!ground || !elevated) { return; }
        const targetTop = Math.max(0, Math.round((ground.y - elevated.y) * 2));
        if (Math.abs(targetTop - this._appliedPaddingTop) <= 1) { return; }
        this._appliedPaddingTop = targetTop;
        this._applyingPadding   = true;
        try { this.map.setPadding({ top: targetTop, bottom: 0, left: 0, right: 0 }); }
        finally { this._applyingPadding = false; }
    }

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
            paddingTop:     this._appliedPaddingTop > 0 ? this._appliedPaddingTop : 0,
        };
        //Clear the maxBounds clamp before the easeTo: the boot bbox forces an effective minimum zoom (it
        //must fit the viewport) that would clamp the weather dezoom regardless of setMinZoom. The exit
        //restores it. undefined (not null) avoids MapLibre 5.x's "expected number, got null" log spam.
        this.map.setMaxBounds(undefined);
        //Widen the zoom envelope; buffer below the target avoids edge-clamping the ease in flight.
        this.map.setMinZoom(8);
        this.map.setMaxZoom(18);
        //Force the rotation lock on; exit restores the user's original preference exactly.
        if (!prevLocked) { this.setCameraLocked(true); }
        this.map.stop();
        //Animate camera-target padding to zero alongside the dezoom so the top-down view is centred.
        //_appliedPaddingTop is pre-set so the settling moveend recompute is a no-op.
        this._appliedPaddingTop = 0;
        this.map.easeTo({
            center:   [this.homeLon, this.homeLat],
            bearing:  0,
            pitch:    0,
            zoom:     11,
            padding:  { top: 0, bottom: 0, left: 0, right: 0 },
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
        //Restore camera-target padding in lock-step with the zoom-in (no end-of-ease snap).
        //_appliedPaddingTop is pre-set so the settling moveend recompute is a no-op.
        this._appliedPaddingTop = pose.paddingTop;
        this.map.easeTo({
            center:   pose.center,
            bearing:  pose.bearing,
            pitch:    pose.pitch,
            zoom:     pose.zoom,
            padding:  { top: pose.paddingTop, bottom: 0, left: 0, right: 0 },
            duration: 1200,
        });
        //Restore the user's pre-entry rotation-lock state (also persisted to localStorage).
        if (this.isCameraLocked() !== pose.locked) { this.setCameraLocked(pose.locked); }
        //Re-tighten the zoom envelope + restore maxBounds after the easeTo lands (1200 ms + buffer). The
        //handle is kept so a subsequent enter (fast mode swap) can cancel it before it fires.
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

    //Weather-mode cloud grid: a coarse lat/lon grid of Open-Meteo cloud_cover_low/mid/high over the
    //weather viewport. Open-Meteo bills per location, so the grid counts against the per-IP quota; a
    //localStorage cache + a shared in-flight Promise keep re-entries and concurrent refreshes cheap.
    //Rendered client-side as a GPU overlay.

    //Grid side: 10x10 = 100 points. At zoom 11 the bbox is ~22 km, so cell pitch ~2.2 km, over-sampling
    //the model (ICON-EU 7 km / IFS 9 km) on purpose so bilinear + FBM noise carry the texture.
    private static readonly _WEATHER_GRID_SIDE        = 10;
    //Half-extent in latitude degrees. 0.20 deg ~= 22 km; the grid is wider than the zoom-11 viewport so
    //the shader's edge fade completes off-screen (full-bleed, not a centre patch). Wider bbox is free
    //(Open-Meteo bills per location, not per km²).
    private static readonly _WEATHER_GRID_HALF_LAT_DEG = 0.20;
    //Refresh cadence inside weather mode; hits cache or network per the TTL below.
    private static readonly _WEATHER_GRID_REFRESH_MS   = 5 * 60_000;
    //localStorage cache TTL. Models tick every 15 min server-side, so 30 min stays fresh without burning
    //fetches on repeated toggling. Cache key rounds coords to 3 decimals (~110 m) so neighbours share it.
    private static readonly _WEATHER_GRID_CACHE_TTL_MS = 30 * 60_000;
    private static readonly _WEATHER_GRID_CACHE_PREFIX = 'helios-weather-grid:v3:';

    private _weatherCloudGrid: {
        bounds:    { south: number; north: number; west: number; east: number };
        nLat:      number;
        nLon:      number;
        lats:      Float32Array;
        lons:      Float32Array;
        //Hourly time axis the cloud arrays index along. One fetch covers the full timeline so scrub
        //picks the right slice from cache without another round-trip.
        times:     Date[];
        //Cloud % row-major: point outer (latIdx * nLon + lonIdx), time inner. Read via
        //values[pointIdx * nTimes + timeIdx].
        cloudLow:  Float32Array;
        cloudMid:  Float32Array;
        cloudHigh: Float32Array;
        //Resolved model from Open-Meteo (best_match picks the regional model); surfaced in the UI so the
        //user can judge grid pitch against the model's native resolution.
        modelName: string;
        //Epoch ms of last fetch (network or cache). Drives the TTL guard in ensureWeatherCloudGrid.
        storedAt:  number;
    } | null = null;
    //In-flight Promise shared between concurrent callers (entry call + refresh tick). Cleared in finally.
    private _weatherCloudGridPending: Promise<void> | null = null;
    private _weatherCloudGridAbort: AbortController | null = null;
    private _weatherCloudGridRefreshTimer: number | undefined = undefined;
    //Live GPU overlay over the cloud grid: the custom layer + card-driven render state (time index,
    //per-band visibility, colour). Null while weather mode is off.
    private _weatherCloudLayer: WeatherCloudLayer | null = null;
    private _weatherCloudShownTimeIdx: number = -1;
    private _weatherCloudBandsVisible: [boolean, boolean, boolean] = [true, true, true];
    private _weatherCloudColor: [number, number, number] = [1, 1, 1];

    public getWeatherCloudGrid(): typeof this._weatherCloudGrid
    {
        return this._weatherCloudGrid;
    }

    //Time-axis index closest to `t`. Cheap (~120 entries), runs every renderer pass. -1 if grid empty.
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

    //localStorage key for the cloud grid. Coords rounded to 3 decimals (~110 m) so neighbours share it;
    //grid side + half-extent are in the key so a constant change invalidates stale geometry.
    private _weatherCloudGridCacheKey(): string
    {
        const lat = this.homeLat.toFixed(3);
        const lon = this.homeLon.toFixed(3);
        const N   = HeliosEngine._WEATHER_GRID_SIDE;
        const hl  = HeliosEngine._WEATHER_GRID_HALF_LAT_DEG;
        return `${HeliosEngine._WEATHER_GRID_CACHE_PREFIX}${lat},${lon}:${N}:${hl}`;
    }

    //Read a fresh grid from localStorage (null on miss/stale/corrupt). Rehydrates the typed arrays so the
    //renderer's indexed reads keep their fast path.
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

    //Fetch the cloud grid, resolution order: in-memory under TTL -> localStorage hit -> in-flight Promise
    //-> cold POST. Errors leave the previous grid in place; AbortController lets exit cut a pending fetch.
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
            //Push the cached payload into the active shader layer so it picks up the grid immediately.
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
                //Compress lon span by cos(lat) to keep the grid roughly square in km; abs+floor guards
                //the division near the poles.
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

                //Flatten to (lat, lon) string pairs row-major (lat outer, lon inner); Open-Meteo's POST
                //body uses the same comma-separated format as the GET query.
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

                //Multi-day hourly window in one round-trip (2 past + today + 2 forecast) so scrub picks
                //the right slice from cache without another HTTP round-trip.
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

                //Pack the per-point hourly series row-major (point outer, time inner) so the renderer
                //reads one indexed lookup per band with no slice copy per scrub.
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

                //Resolved `model` is the same across the grid (one regional footprint), so the first
                //sample labels the overlay.
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
        //Abort any in-flight grid fetch so leaving weather mode mid-fetch doesn't keep the POST alive.
        this._weatherCloudGridAbort?.abort();
        this._weatherCloudGridAbort = null;
    }

    //Attach the GPU cloud overlay. Idempotent: a second call refreshes data/visibility instead of mounting
    //a duplicate. Reads --primary-text-color off the host to match the HA theme (white fallback).
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

    //Re-upload the data texture for a different hour. Called on every scrub move; one ~400-byte upload,
    //cheap next to the repaint it triggers anyway.
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

    //Toggle altitude bands without re-uploading the texture. Card buttons call straight through.
    public setCloudShaderBands(bandsVisible: [boolean, boolean, boolean]): void
    {
        this._weatherCloudBandsVisible = [...bandsVisible] as [boolean, boolean, boolean];
        this._weatherCloudLayer?.updateData({ bandsVisible: this._weatherCloudBandsVisible });
    }

    //After a fresh grid lands, push the new payload into the layer and reset the shown time index.
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

    //Extract one hour from the packed [pointIdx * nTimes + timeIdx] storage into three flat N x N arrays
    //the shader uploads as the R/G/B channels of its data texture.
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

    //Resolve --primary-text-color off the host into a normalised RGB triplet for the shader. White
    //fallback keeps the overlay visible against any basemap when the var is unset/unparseable.
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

    //Minimal CSS colour parser (#rgb / #rrggbb / rgb(...) / rgba(...)); null on anything else.
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

    //Lat/lon -> screen pixel via MapLibre's camera transform (used by the SVG cloud overlay). Null when
    //the map isn't ready.
    public projectLonLat(lon: number, lat: number): { x: number; y: number } | null
    {
        if (!this.map) { return null; }
        const p = this.map.project([lon, lat]);
        return { x: p.x, y: p.y };
    }

    //Auto-rotation: when idle a few seconds the map slowly orbits the home counter to the sun's motion
    //(~1.5°/s). Any interaction resets the inactivity timer, pausing then resuming from the new bearing.
    _autoRotateRaf?:           number;
    _autoRotateLastFrame:      number = 0;
    _autoRotateLastUserAction: number = 0;

    //MapLibre canvas captured at init so cleanup() can detach our WebGL listeners against the same node
    //(map.getCanvas() returns null after map.remove()).
    private _mapCanvas?: HTMLCanvasElement;

    //Single-pointer drag-rotate: replaces MapLibre's right-click dragRotate with pointer-driven rotation
    //(left-click on desktop, one-finger drag on touch). Two-finger pinch-rotate (touchZoomRotate) is kept.
    private _dragRotateHandlers?: {
        canvas:  HTMLCanvasElement;
        onDown:  (e: PointerEvent) => void;
        onMove:  (e: PointerEvent) => void;
        onEnd:   (e: PointerEvent) => void;
    };

    //Stored refs for every map.on()/canvas.addEventListener we register, so cleanup() can detach them
    //explicitly before map.remove() (a buggy map.remove() on iOS Safari otherwise leaks the dead engine).
    private _mapPinHandler?:       (e: { originalEvent?: unknown }) => void;
    private _mapStyleLoadHandler?: () => void;
    private _mapLoadHandler?:      () => void;
    private _mapMoveHandler?:      () => void;
    private _mapMoveEndHandler?:   () => void;
    //Stored ref to the styleimagemissing handler so cleanup() can map.off() it (an inlined lambda pinned
    //`this` past cleanup on the iOS Safari path where map.remove() doesn't tear down listeners).
    private _mapStyleImageMissingHandler?: (e: { id?: string }) => void;
    private _mapErrorHandler?:     (e: { error?: { message?: string } }) => void;
    private _webglLostHandler?:    (e: Event) => void;
    private _webglRestoredHandler?: () => void;

    //Card-level hook fired on WebGL context loss (iOS Safari recycles contexts under memory pressure);
    //the card triggers a clean re-init.
    public onContextLost?: () => void;

    //Cached building fetch around the home. The home doesn't move during a session, so fetch once and
    //reuse across style reloads instead of re-hitting MapTiler. Invalidated when building-radius changes.
    private _buildingsData:     BuildingsResult | null = null;
    private _buildingsFetchKey: string = '';
    private _buildingsAbort?:   AbortController;

    //Last cloud-cover % applied to the disc, cached so projectCloudScene() can re-project on every
    //transform without round-tripping through _renderForCurrentSelection.
    private _currentCloudPct: number = 0;
    //Per-layer breakdown captured at the same instant; sizes the three concentric bands (low->mid->high,
    //centre to edge) proportionally to each layer's contribution.
    private _currentCloudLow:  number = 0;
    private _currentCloudMid:  number = 0;
    private _currentCloudHigh: number = 0;

    //Consolidated LiDAR shadow regions for the current home+radius+precision. Null until the first fetch;
    //the shadow projector reads this on every sun-position refresh.
    private _lidarShadowFeatures: GeoJSON.FeatureCollection | null = null;
    //Diagnostics from the latest LiDAR shadow fetch, surfaced via window.heliosStats() (cells kept,
    //per-clump cap, height range).
    private _lidarShadowDiagnostics:
        { cellsKept: number; cellsPerClumpCap: number; heightRangeM: [number, number] | null }
        | null = null;
    //Fetch-key for the cached shadow features; skips a refetch when the camera nudges but
    //home/radius/precision are unchanged.
    private _lidarShadowKey: string = '';
    //In-flight LiDAR shadow fetch, aborted on home/radius/precision change so a slow IGN response can't
    //overwrite a fresher request.
    private _lidarShadowAbort?: AbortController;
    //Exponential backoff for the LiDAR fetch. Persistent provider errors (CORS, 4xx, network) would
    //otherwise re-download several MB per sky tick and discard it, hurting framerate. Backoff suppresses
    //retries against the SAME failed key for a growing window (60 s -> 5 -> 15 -> 30 -> 60 min cap). Any
    //key change (moved home, edited radius/precision, toggled shadows) bypasses it and retries immediately.
    private _lidarShadowFailedKey:    string = '';
    private _lidarShadowFailureCount: number = 0;
    private _lidarShadowBackoffUntil: number = 0;
    //Raw height raster + geo for the LiDAR View overlay (projects every cell, threshold-bypassed). Cleared
    //alongside _lidarShadowFeatures so the two stay in lockstep. Reference to the provider's buffer, no copy.
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

    //Custom GPU layer rendering the LiDAR View dot cloud. Owns one Float32 buffer of Mercator triplets per
    //finite cell, rebuilt only on a new raster; per frame the shader projects + radius-filters in a single
    //drawArrays(POINTS) call. Replaces the old CPU-bake path that stalled past a few hundred thousand cells.
    private _lidarViewLayer?: LidarViewLayer;

    //Offscreen canvas for rasterising cast shadows before upload to the image source. Lives the whole
    //engine lifetime (no realloc per tick); sized at SHADOW_RASTER_SIZE, bounds recomputed per refresh.
    private _shadowCanvas?: HTMLCanvasElement;

    //Debounce timer for the shadow/atmosphere refresh during rapid scrub: each setSelectedTime() resets it
    //and the refresh runs once on expiry. Curves+chips still update every move; only the costly shadow
    //raster paint (at lidar-precision: high) is coalesced.
    private _selectedTimeShadowTimer: number | null = null;

    //Cache of the 96 per-day sun-arc samples. Sun position + clear-sky irradiance depend only on the day
    //and cloud cover, not the map matrix, so the heavy trig recomputes only when those change; every
    //transform tick just re-projects the cached tuples. Invalidated on day-roll or >1% cloud shift.
    private _arcInputsCache?: {
        dayStartMs: number;
        cloudPctInt: number;
        //Sun-arc scale baked into the points below (×100, rounded). In the key so a resize/zoom rebuilds
        //the arc at the new size.
        scaleKey: number;
        samples: Array<{
            lon: number;
            lat: number;
            altitudeM: number;
            wm2: number;
            belowHorizon: boolean;
        } | null>;
    };
    //Per-(canvas, zoom) memo for _sunArcScale so the 8-direction projection probe runs once per size/zoom
    //change, not per arc sample per frame. Bearing/pitch invariant, so auto-rotation never refreshes it.
    private _arcScaleMemo?: { w: number; h: number; zoom: number; scale: number };

    //Last signature of the shadow raster inputs (rounded sun position, home, radius, source-feature
    //identity+length). Unchanged -> skip the project+paint+PNG-encode round-trip, the costliest recurring
    //op on a refresh not driven by sun movement.
    private _lastShadowSig?: string;

    //Optional card-side hooks for a busy indicator during the LiDAR shadow compute (WMS + raster paint);
    //the engine computes silently if unset.
    public onShadowComputeStart?: () => void;
    public onShadowComputeEnd?:   () => void;
    //Same idea: card swaps the LiDAR mode-bar icon to a spinner and locks mode-switching during an
    //exposure sweep.
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

        //Evict the oldest live engine at the cap. Set iteration is insertion order, so the first value is
        //the longest-lived, typically an orphaned editor-preview engine the user can no longer see.
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
            //cleanup() removes it from the set; defensive delete in case it threw first.
            _liveEngines.delete(oldest);
        }
        _liveEngines.add(this);

        this._fetchLat = this.homeLat;
        this._fetchLon = this.homeLon;

        //Create the map immediately regardless of container size: deferring until a ResizeObserver/
        //IntersectionObserver reported "ready" left the map null forever in some layouts (Masonry) where
        //neither observer fired. The post-load triple-resize + 5 s tile watchdog cover any 0x0-at-init case.
        this._initMapInstance(container, haCoords);
    }

    private _initMapInstance(container: HTMLElement, haCoords: [number, number]): void
    {
        //Pixel-ratio caps (2 desktop / 1.25 mobile): at pitch + auto-rotation each pixel is sampled several
        //times (extrusion, basemap, shadow), so capping slashes fragment work without visible regression.
        const pixelRatio = this._pixelRatio();

        const styleInfo = this._resolveMapStyle();
        //Track the URL handed to the map at every setStyle. _onStyleLoad compares it to the desired URL for
        //the active _cardIsDark and re-triggers setStyle on divergence, catching up a pre-style.load polarity flip.
        this._currentStyleUrl = styleInfo.url;

        //Camera is locked on the home for zoom/pan/pitch (the data only reads from this viewpoint). Rotation
        //is the only direct input. Bearing auto-flips per hemisphere so noon sits at the top (NH south up, SH north up).
        this.map = new maplibregl.Map(
        {
            container,
            style:           styleInfo.url,
            center:          haCoords,
            zoom:            18,
            pitch:           this._initialPitch(),
            bearing:         this._initialBearing(),
            //Push pitch bounds in past MapLibre's 0-60 defaults so its internals (easing, pinch-rotate,
            //jumpTo/easeTo fallbacks) can't bypass the floor/ceiling when callers forget to clamp.
            minPitch:        CAMERA_PITCH_MIN_DEG,
            maxPitch:        CAMERA_PITCH_MAX_DEG,
            //Zoom locked to the resting pose: the 3D camera + LiDAR overlay are tuned for this one altitude.
            //detail-mode separately raises maxZoom for its dive and resets on exit.
            minZoom:         18,
            maxZoom:         18,
            dragPan:         false,
            scrollZoom:      false,
            doubleClickZoom: false,
            //Disable MapLibre's right-click dragRotate; our pointer handlers below do left-click/one-finger.
            dragRotate:      false,
            touchZoomRotate: true,
            touchPitch:      false,
            boxZoom:         false,
            keyboard:        false,
            pixelRatio,
            //Collapse attribution to a compact "i" disc: license terms require it stay accessible, so we
            //can't hide it, but compact makes it a click-to-expand icon instead of the full bar.
            attributionControl: { compact: true }
        });

        //ResizeObserver fires aggressively on iOS during orientation changes. We coalesce bursts into a single resize at the end.
        this._resizeObserver = new ResizeObserver(entries =>
        {
            //A resize invalidates the cached canvas dims in _projCache; drop it and refresh
            //_cachedCanvasCssW/H so the projection path never re-reads canvas.clientWidth (layout flush).
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

        //Expose the map on window for in-browser debugging (__heliosMap.getStyle().layers).
        try { (window as unknown as { __heliosMap?: MapLibreMap }).__heliosMap = this.map; }
        catch (_) {}

        //Sibling global for the editor UI: camera setters live on the engine, not the bare map.
        try { (window as unknown as { __heliosEngine?: HeliosEngine }).__heliosEngine = this; }
        catch (_) {}

        //Lock the pinch-rotate pivot to the canvas centre: the default rotates around the finger centroid,
        //so the home orbits the pinch point on small cards. around: 'center' keeps the home pinned (it
        //projects to centre). camera-locked disables pinch-rotate entirely so the configured pose is fixed.
        if (this.isCameraLocked())
        {
            this.map.touchZoomRotate.disable();
        }
        else
        {
            this.map.touchZoomRotate.enable({ around: 'center' });
        }

        //Hard-pin the map centre on every user-driven transform so the home never drifts off dead-centre
        //during a rotate. Gated on `originalEvent` so programmatic eases (recenter()) still animate freely.
        //Bound to `move` only (every centre-shifting rotation fires `move` too). The `pinning` flag guards
        //the re-entrant `move` that setCenter() fires, so exactly one corrective setCenter runs per frame.
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
            //Belt-and-suspenders for Masonry: the HA dashboard may settle a frame or two after load fires,
            //so resize again next frame and on a short timeout to reach MapLibre's tile manager.
            requestAnimationFrame(() => this.map?.resize());
            window.setTimeout(() => this.map?.resize(), 400);
            //Clamp the camera to a display-radius bbox. Helios never pans/zooms anyway, but the bounds tell
            //MapLibre not to treat areas outside the disc as reachable, cutting speculative edge tile fetches.
            this._applyMapBounds();
            //Watchdog: 5 s after load, if no tile loaded despite a fully-loaded style (basemap decided the
            //viewport was empty at a bad micro-instant), force a setStyle re-fetch; custom layers re-register
            //in the existing style.load handler.
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
                //No tile in 5 s despite a loaded style: soft-reload the style URL to re-walk sources and
                //re-issue tile fetches.
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

        //OpenFreeMap's Liberty style references fill-pattern sprites missing from the published atlas
        //(wood-pattern, swimming_pool, ...), each logging a warning. Register a 1×1 transparent stub per
        //missing id so the layer falls through to its base colour silently. hasImage() guards re-registration.
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

        //Transform broadcaster: relays `move` (not `moveend`) to the card so HTML overlays track the camera
        //frame-by-frame. Invalidating the projection cache here lets _projectScenePoint() reuse one proj
        //matrix + canvas snapshot across its 200-500 per-frame calls (rebuilt on the first call each frame).
        this._mapMoveHandler = () =>
        {
            this._invalidateProjCache();
            this.onMapTransform?.();
        };
        this.map.on('move', this._mapMoveHandler);

        //Re-aim the camera target only on moveend: setPadding mid-`move` interrupts the weather eases. The
        //target depends on pitch/zoom only, so bearing-only rotation leaves it untouched.
        this._mapMoveEndHandler = () =>
        {
            this._invalidateProjCache();
            this._applyCameraTargetPadding();
        };
        this.map.on('moveend', this._mapMoveEndHandler);

        //Auto-rotation pause is bumped ONLY by the single-pointer drag below; wheel, pinch-rotate and
        //incidental touches leave the orbit running.
        const canvas = this.map.getCanvas();
        this._mapCanvas = canvas;

        //Custom drag-rotate (left-click / one-finger); two-finger pinch-rotate stays with touchZoomRotate.
        //Override the canvas's default touch-action: pan-x pan-y (which would reserve single-finger drags
        //for browser scrolling) to none, so every canvas gesture is a card interaction (dashboard scroll
        //happens by touching outside the card, like Google Maps on mobile).
        canvas.style.touchAction = 'none';

        const ROTATE_SENSITIVITY_DEG_PER_PX = 0.35;
        //Vertical drag drives pitch (down = flatter, up = bird's-eye). Bounds from the module CAMERA_PITCH_*
        //constants so this stays in sync with every other pitch entry point.
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
            //Swallow gestures during the post-exit cooldown so the dismissing click can't bleed into a
            //fresh drag-rotate on the canvas behind.
            if (this.isUserGestureSuppressed())
            {
                return;
            }
            //camera-locked: manual drag is inert. Re-checked per pointerdown so a live-preview toggle
            //disengages immediately without a respawn.
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
            //Drag right (+dx) bumps bearing up so content follows the gesture (subtract read inverted).
            this.map.setBearing(this.map.getBearing() + dx * ROTATE_SENSITIVITY_DEG_PER_PX);
            //Subtract dy so drag up flattens pitch, drag down goes bird's-eye; clamped to session bounds.
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

        //WebGL context-loss recovery (iOS Safari recycles contexts under memory pressure, else the canvas
        //freezes black). preventDefault lets the browser retry restore; we flip _mapReady false and emit
        //onContextLost so the card tears down and re-inits next frame.
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

        //Surface MapLibre errors (auth, tile fetch, WebGL) to the console; without this an invalid API key
        //is a silent 403 and a frozen card.
        this._mapErrorHandler = (e: { error?: { message?: string } }) =>
        {
            const msg = e?.error?.message ?? 'unknown error';
            //Suppress "non-existing layer" from our own building-layer suppression sweep (we style layers
            //that may already be removed); harmless and intended.
            if (msg.includes('non-existing layer'))
            {
                return;
            }
            console.warn('[HELIOS] MapLibre error:', msg);
        };
        this.map.on('error', this._mapErrorHandler);

        this._refreshWeather();
    }

    //Resolve the OpenFreeMap style URL from `map-style` + theme polarity. OFM publishes fixed styles:
    //liberty (full-colour, streets), positron (muted grey, minimal), fiord (dark, replaces both above when
    //the theme is dark; chosen over OFM `dark` which clamps to near-black and is too oppressive at card size).
    //Resolution: streets+light->liberty, streets+dark->fiord, minimal+light->positron, minimal+dark->fiord.
    //All share the same vector tile source, so style swaps keep the buildings GeoJSON cache intact.
    //_cardIsDark is pushed by the card every Lit update so the basemap follows the HA theme.
    private _cardIsDark: boolean = false;
    //URL of the last setStyle. _onStyleLoad compares it to the desired style and re-fires setStyle on
    //divergence (e.g. a polarity change before the first style.load); also gates redundant setStyle calls.
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
        //Defer setStyle until the first style.load fired; setStyle during cold-start races so the building
        //layers never re-add ("buildings rarely show up" after a theme flip during spawn). _onStyleLoad's
        //tail re-triggers setStyle once the loaded URL differs from the desired one.
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

    //WebGL canvas pixel ratio: device-native, capped at 2 desktop / 1.25 mobile to keep retina within budget.
    private _pixelRatio(): number
    {
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
        return IS_MOBILE
            ? Math.min(Math.max(dpr, 1), 1.25)
            : Math.min(Math.max(dpr, 1.5), 2);
    }

    //Read the configured shadow precision, normalising off-spec values to the default.
    private _lidarPrecisionLevel(): LidarPrecisionLevel
    {
        const v = String(this.cfg['lidar-precision'] ?? DEFAULT_LIDAR_PRECISION).toLowerCase();
        if (v === 'low' || v === 'medium' || v === 'high')
        {
            return v as LidarPrecisionLevel;
        }
        return DEFAULT_LIDAR_PRECISION;
    }

    //Master shadow toggle. False = no cast shadows; true = source picked by LiDAR coverage of the home.
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

    //Resolve weather variables at a given time from the home location. Source: _homeHourlyData; null
    //(initial/failed/in-flight) returns the empty sentinel so timeline ramps render flat. shortwave = -1
    //means the model gave no value this hour (caller falls back to Haurwitz).
    private _getWeatherAtTime(t: Date): {
        cloudCover:     number;
        cloudLow:       number;
        cloudMid:       number;
        cloudHigh:      number;
        shortwave:      number;
        //2 m air temperature °C. NaN = missing; callers fall back to no thermal derating.
        temperatureC:   number;
        //10 m wind speed m/s. NaN = missing; same fallback as temperature.
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

    //Public wrapper for _getTimeRange so the card's 30 s tick can re-fetch the window after midnight rollover.
    public getTimelineRange(): { start: Date; end: Date } | null
    {
        return this._getTimeRange();
    }

    //Active rolling-window span (days past/future around today). Undefined until setPeriodDays() pushes
    //resolved values; _getTimeRange falls back to config keys so the window is correct before the first push.
    private _periodPastDays?:   number;
    private _periodFutureDays?: number;

    //Card -> engine: set the active rolling window. Card owns the source of truth; engine just renders it.
    public setPeriodDays(pastDays: number, futureDays: number): void
    {
        this._periodPastDays   = pastDays;
        this._periodFutureDays = futureDays;
    }

    //Visible timeline window: pastDays before today through futureDays after, from local midnight,
    //inclusive of today. The Open-Meteo payload may stretch further (calibration), but the axis is clipped.
    private _getTimeRange(): { start: Date; end: Date } | null
    {
        const pastDays   = this._periodPastDays   ?? periodPastDays(this.cfg);
        const futureDays = this._periodFutureDays ?? periodFutureDays(this.cfg);
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const visibleStartMs = today0.getTime() - pastDays * 24 * 3_600_000;
        //End at the midnight after the last future day so the axis spans futureDays full days plus today.
        const visibleEndMs   = today0.getTime() + (futureDays + 1) * 24 * 3_600_000;

        //The axis is exactly the configured span. Weather traces may not reach the far past, but the
        //recorder-backed curves span the whole window so a 30-day period really shows 30 days.
        return { start: new Date(visibleStartMs), end: new Date(visibleEndMs) };
    }

    //Resolved cloud colour as RGB (callers build opaque or translucent strings).
    private _resolvedCloudRgb(): RGB
    {
        //Colour configs are no longer consulted; the WebGL cloud disc can't read CSS vars directly, so it
        //uses the DEFAULT_CLOUD_RGB fallback. Dynamic theme tracking would resolve a CSS var on style.load.
        return DEFAULT_CLOUD_RGB;
    }

    private _renderForCurrentSelection(): void
    {
        //Only the map is required: _getWeatherAtTime returns zero defaults when _homeHourlyData is null, so
        //sun position/arc/tooltip still update when Open-Meteo is down (cloud/irradiance fall back to Haurwitz).
        if (!this.map)
        {
            return;
        }

        const t = this._selectedTime ?? new Date();
        const w = this._getWeatherAtTime(t);

        //Compute every irradiance candidate; priority sensor > shortwave > Haurwitz (see IrradianceSource).
        //These are GHI (horizontal); the tilt/azimuth transposition lives in the card-side PV helpers.
        const pvPowerHaurwitz = computePvPower(t, this.homeLat, this.homeLon, w.cloudCover);

        let pvPowerShortwave = -1;
        if (w.shortwave >= 0)
        {
            //Normalise W/m² against STC (1000) and clamp to [0,100] so downstream is source-agnostic.
            pvPowerShortwave = Math.max(0, Math.min(100, w.shortwave / 1000 * 100));
        }

        const sensorWm2 = this._sensorIrradianceAt(t);
        const pvPowerSensor = sensorWm2 !== null
            ? Math.max(0, Math.min(100, sensorWm2 / 1000 * 100))
            : -1;

        //Pick the primary: sensor > shortwave > Haurwitz (a thermopile at the home beats a gridded forecast).
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

        //Refresh the on-ground cloud-cover disc (radius = coverage %, inside a 100% ring); the per-layer
        //breakdown feeds the three-band split in projectCloudScene.
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

        //Catch-up setStyle: a polarity change pushed before the first style.load stored _cardIsDark but
        //skipped setStyle (cold-start race). Now that a style loaded, switch if polarity wants a different
        //basemap. Skipped on the very first style.load to avoid a redundant reload of the URL just set up.
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

        //Layer order: night-shade (ground tint), then cloud disc (under buildings so they emerge as
        //islands), then buildings. The solar overlays (arc, sun, ray) are HTML/SVG above the canvas (a
        //Three.js custom layer was rejected, MapLibre's compositor overpainted it unpredictably).
        this._initNightShade();
        this._initCloudCoverDisc();
        this._addBuildings();
        this._initLidarViewLayer();
        this._applyLabelVisibility();

        window.clearInterval(this._skyTimer);
        this._lastAtmosphereAlt = -999;
        this._refreshShadowsAndAtmosphere();
        //60 s sky/atmosphere refresh. _refreshShadowsAndAtmosphere short-circuits when the sun barely
        //moved, so the cost is negligible; the paused skip avoids even the signature check while invisible.
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

    //Night-shade overlay: a full-world fill above the raster but below buildings/marker/labels. Opacity 0
    //by day; as the sun drops it fades to a deep navy/black (a clearer night cue than the raster pipeline's
    //clamped brightness/contrast). Sunrise/sunset mix in a low-opacity warm tint, keeping imagery readable.
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

    //Cloud-cover disc setup. The disc + 100% ring now live as a screen-space SVG overlay in the card (see
    //projectCloudScene), not map layers. This only sweeps any leftover map sources/layers from a hot-reload
    //so the SVG-only pipeline runs clean.
    private _initCloudCoverDisc(): void
    {
        if (!this.map)
        {
            return;
        }

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

    //Stash cloud cover (pct + per-layer) for projectCloudScene(). Called from _renderForCurrentSelection so
    //it ticks with both live progression and scrubbing. Disc radius scales linearly with pct (0% invisible,
    //100% full ring); per-layer values drive the proportional band sizing (low->mid->high, centre to edge).
    private _updateCloudCoverDisc(
        cloudPct: number,
        cloudLow:  number = 0,
        cloudMid:  number = 0,
        cloudHigh: number = 0
    ): void
    {
        this._currentCloudPct  = Math.max(0, Math.min(100, cloudPct));
        this._currentCloudLow  = Math.max(0, Math.min(100, cloudLow));
        this._currentCloudMid  = Math.max(0, Math.min(100, cloudMid));
        this._currentCloudHigh = Math.max(0, Math.min(100, cloudHigh));
    }

    //Project the cloud disc + 100% ring into screen space (null when not ready). Vertices are projected with
    //anchor at the home's terrain elevation so the polygons stay true circles regardless of terrain. The
    //disc is split into three concentric bands (low->mid->high outward), each band's width proportional to
    //its layer's share of the total; the total radius still tracks effective cloud cover. Returns three
    //concentric polygons plus the ring; the card stacks them outer-first.
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

        //Each band's outer radius is the cumulative layer share. All-zero layers collapse to the home anchor
        //(degenerate weather sample); the guard below keeps the polygons non-degenerate.
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

        //Every vertex projects at the home's elevation (not its own), keeping the polygon a true circle even
        //when terrain bends between the home and the disc edge.
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

    //Project the home building(s) into screen-space silhouettes. Each polygon yields a base ring (at
    //render_min_height) and top ring (at render_height); the card paints both plus a quad per outer edge
    //into the SVG mask, covering the exact extruded prism even for concave (L/U) footprints. Per-vertex
    //elevation matches MapLibre's fill-extrusion shader. Empty until the buildings GeoJSON has landed.
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
                    //Drop the vertex pair if either point is behind the camera, else the side-wall quad shears.
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

    //LiDAR View active flag, pushed by the card on toggle so the raster fetch path runs even when cast
    //shadows are disabled (otherwise the View overlay would show an empty canvas).
    private _lidarViewActive: boolean = false;
    public setLidarViewActive(on: boolean): void
    {
        if (on === this._lidarViewActive)
        {
            return;
        }
        this._lidarViewActive = on;
        //off->on kicks the fetch so the raster lands; on->off is a no-op (raster stays cached for reuse).
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


    //rAF token for the LiDAR-View exposure compute. Kicked off via idle callback (so the chunk loop avoids
    //interactive frames) and chunked through requestAnimationFrame (each frame yields between row-bands), so
    //wall time matches a single-shot compute but the main thread stays responsive.
    private _exposureChunkRaf: number | undefined;

    //True while a LiDAR exposure sweep is in flight (idle-queued or rAF-chunked); the card polls it to
    //show a spinner and lock mode switches mid-compute.
    public isLidarExposureBusy(): boolean
    {
        return this._exposureIdleHandle !== undefined
            || this._exposureChunkRaf  !== undefined;
    }

    private _scheduleLidarExposureRecompute(): void
    {
        //Pre-compute in idle as soon as the raster lands, regardless of whether LiDAR-View is active. The
        //compute is long (~200 ms-2 s at high precision); doing it eagerly means the exposure buffer is
        //already on the layer when the user opens the mode (fade-in shows the finished render, not scaffold).
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
                //Gate hit, nothing scheduled, release the optimistically-set busy flag.
                try { this.onLidarExposureBusyChange?.(false); } catch { /* */ }
                return;
            }
            const r = this._lidarRaster;
            //NdsmRaster shape (heights + rasterSize + bbox + optional terrain), matching _lidarRaster.
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
            //Pin the captured raster identity so a mid-sweep provider/precision swap (which moves
            //this._lidarRaster) lets the tick bail before posting an exposure sized to the dead raster.
            const capturedRaster = r;
            //8-row chunks stay under 16 ms even at high precision (~5 M ops/chunk, 4-8 ms), keeping 60 fps;
            //32-row chunks overran the budget and stuttered to 3-4 fps. rAF overhead per tick is negligible.
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
                    //Raster swapped under us; drop this sweep and let the next schedule pick up the new one
                    //(busy flag stays true for it).
                    this._exposureChunkRaf = undefined;
                    this._scheduleLidarExposureRecompute();
                    return;
                }
                //Stale-sun bail: aggressive scrubbing during a sweep drifts the closure's sun from the cursor.
                //Re-sample each tick; past the 0.5° gate, abort so the next schedule produces a fresh exposure
                //aligned with the cursor instead of locking on a stale frame.
                const currentSun = getSunPosition(this._selectedTime ?? new Date(), this.homeLat, this.homeLon);
                if (currentSun
                 && (Math.abs(currentSun.altitude - sun.altitude) >= 0.5
                  || Math.abs(currentSun.azimuth  - sun.azimuth)  >= 0.5))
                {
                    this._exposureChunkRaf = undefined;
                    //Reset the gate so the next schedule recomputes on the new sun (this aborted sweep never
                    //advanced _lastLidarExposureAlt/Az). Stays busy for the next schedule.
                    this._lastLidarExposureAlt = -999;
                    this._lastLidarExposureAz  = -999;
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

    //Wire (or rewire after a style reload) the WebGL layer painting the LiDAR View dot cloud. The instance
    //is created once and reused: setStyle wipes layers but the JS object survives, so we re-add it and
    //replay the cached buffer + tunables. Every MapLibre call is try/caught because a throwing custom-layer
    //onAdd can pollute GL state and kill the basemap; we'd rather just disable our overlay. The addLayer is
    //deferred to the next frame: style.load can fire before the painter bound its buffers, and onAdd against
    //a half-init context is the "map renders black until refresh" symptom.
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

    //Runtime opacity for the LiDAR View overlay [0..1], from the in-card slider (not config); resets to
    //DEFAULT per engine. Point size is config-controlled; colours are hard-locked to white in the layer.
    private _lidarViewOpacity: number = DEFAULT_LIDAR_VIEW_OPACITY;

    //Push LiDAR View tuning to the layer (init, point-size config change, slider move). The slider is
    //halved (100% -> 50% alpha): full-alpha fill carpets the basemap and hides building topology, so the
    //0.5 ceiling keeps it readable at max slider.
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

    //Push the theme's --primary-text-color into the LiDAR View layer (black on light, white on dark). Reads
    //the computed CSS var off the map container into a 0..1 RGB triplet for the uniform.
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
            //Fallback to document root for the variable from a higher scope.
            raw = getComputedStyle(document.documentElement).getPropertyValue('--primary-text-color').trim();
        }
        const rgb = parseCssColorToUnitRgb(raw);
        this._lidarViewLayer.setViewColor(rgb[0], rgb[1], rgb[2]);
    }

    //Push the LiDAR view fade range to the layer (init + on display-radius change, since the fade band is
    //derived from the live radius).
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
        //Direct push, skipping _pushLidarViewConfig: nothing else changes during a slider drag.
        this._lidarViewLayer?.setOpacity(clamped * 0.5);
    }

    public getLidarViewOpacity(): number
    {
        return this._lidarViewOpacity;
    }

    //Fade alpha multiplier [0..1] from the card's enter/exit animation; the engine forwards it. 0 (View off)
    //short-circuits the layer's draw.
    public setLidarViewFadeAlpha(alpha: number): void
    {
        this._lidarViewLayer?.setAlphaFade(alpha);
    }

    //Distance fall-off bounds for the LiDAR view: full opacity up to one fade-band inside the display
    //radius, fading out at the radius. Derived from the live radius so all layers stop at the same boundary.
    private _lidarViewFadeRange(): [fullMeters: number, fadeMeters: number]
    {
        const radius = this._buildingRadiusMeters();
        return [Math.max(0, radius - DISPLAY_FADE_DELTA_M), radius];
    }

    private _lidarViewPointSizePx(): number
    {
        return 1.5;
    }

    //Id of the LiDAR provider covering the home, or null. Resolved on-demand via resolveLidarSource (not
    //the cached _lidarSourceId) so it's correct from the first render, regardless of the shadow fetch path.
    //Memoised on (cfg, lat, lon): the resolver allocates a fresh provider per call and the card calls this
    //every render, so without caching a ~120 Hz scrub would create 120 provider objects/second.
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

    //Toggle the basemap's symbol layers (labels, POIs, place names) per the show-labels config. Symbol
    //layers hold all text/icon rendering, so flipping their visibility hides text without touching geometry.
    //Our own helios-* layers are skipped defensively.
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

    //Global display radius shared by basemap bbox, buildings, LiDAR overlay, raster shadows, projection
    //clip and MapLibre bounds, so every layer stops at the same boundary. From the display-radius slider
    //(50-500 m, default 200); lowering it shrinks all geometry in lockstep, the main perf lever on old phones.
    private _buildingRadiusMeters(): number
    {
        return displayRadiusM(this.cfg);
    }

    //Clamp camera bounds to a bbox at 2x the display radius. Pan/zoom are disabled anyway, but the bounds
    //tell MapLibre the area outside the disc is unreachable, dampening speculative tile fetches during
    //rotation. Re-called on a radius change so the bounds track the live display radius.
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

    //Cluster radius (m): every building whose centroid is within it (or that contains the home) joins the
    //home group at full opacity, so attached outbuildings read as one with the house. 0 = single-polygon home.
    private _buildingClusterRadiusMeters(): number
    {
        const v = Number(this.cfg['building-cluster-radius']);
        if (!Number.isFinite(v) || v < 0)
        {
            return DEFAULT_BUILDING_CLUSTER_RADIUS_M;
        }
        return Math.min(100, v);
    }

    //Building base colour. Colour configs are no longer consulted; falls back to DEFAULT_BUILDING_COLOR_HEX.
    private _buildingColor(): string
    {
        return DEFAULT_BUILDING_COLOR_HEX;
    }

    //Add the two custom building layers: helios-buildings-surroundings (every building within radius, at
    //the configured opacity) and helios-buildings-home (the polygon containing the home, full opacity,
    //focal). GeoJSON is fetched once per (home, radius); style rebuilds (theme switch) reuse the cached data.
    private _addBuildings(): void
    {
        bumpStat('addBuildingsCalls');
        if (!this.map)
        {
            return;
        }

        //Drop stale helios-buildings* layers so re-runs (style reload, theme switch) are idempotent.
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

        //Suppress the style's native building layers so they don't Z-fight helios-buildings-* extrusions.
        //MapLibre 5 styles can come from "imports" where visibility:none and removeLayer on the bare id are
        //silent no-ops; the robust path is, per import, set config flags off AND remove/paint-zero under the
        //scoped id `${importId}\\${layerId}`. Paint and layout pipelines guard independently, so opacity:0
        //may land where visibility:none didn't, hence both.
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

        //Strategy A: toggle the v4 schema building flags off per import (best-effort, wrong keys throw+ignored).
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

        //Strategy B: per building layer, attempt removal AND paint-zeroing under the bare id and every
        //scoped variant `${importId}\\${layerId}`.
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
                //Skip candidates with no real layer in the merged style: set* on a missing layer fires an
                //"error" event the engine echoes, so gating here removes the noise and wasted dispatch.
                if (!this.map.getLayer(cand))
                {
                    continue;
                }

                try { this.map.removeLayer(cand); }
                catch (_) {}

                //If removeLayer worked we're done; the paint/layout fallbacks below cover imported layers
                //where removeLayer is a silent no-op.
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

        //Ground shadows: a single black-mask image source drawn before the extrusions so buildings hide the
        //under-building part of their own shadow (the visible shadow is the ground spillover). Per-pixel
        //rendering avoids alpha saturation; the source bounds match the building bbox.
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

        //Surroundings first, then home, so the home draws on top if polygons overlap.
        this.map.addLayer(
        {
            id:     'helios-buildings-surroundings',
            source: 'helios-buildings-surroundings-src',
            type:   'fill-extrusion',
            paint:
            {
                'fill-extrusion-color':   baseColor,
                //coalesce so features missing render_height/render_min_height fall back to 0 instead of
                //null, which MapLibre would log as "expected number, got null" per feature per paint.
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
                //Home buildings take the HA Energy grid-consumption blue so the focal structure reads as the
                //"home node"; surroundings keep the neutral baseColor.
                'fill-extrusion-color':   '#488fc2',
                'fill-extrusion-height':  ['coalesce', ['get', 'render_height'],     0],
                'fill-extrusion-base':    ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': 1
            }
        });

        //Kick off the background buildings fetch; the wired shadow source populates once GeoJSON lands.
        this._ensureBuildingsFetched();

        //Wire the LiDAR shadow pipeline. No-op when shadows are off or the home has no provider coverage.
        this._ensureLidarFetched();
    }

    //Idempotent fetch helper: reuses _buildingsData across style reloads, re-hitting MapTiler only when the
    //home position or radius changed.
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

        //Shared-cache short-circuit: a fresh engine after an editor commit would re-parse the buildings
        //GeoJSON unless served from here (the browser HTTP cache only covers the tile request).
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

        //Abort any in-flight request so a rapid radius change doesn't race a stale fetch into the sources.
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
            //Buildings just arrived but the shadow source is empty; bypass the "sun hardly moved" guard so
            //the next call paints a full pass and populates the shadow polygons.
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

    //LiDAR shadow pipeline for the current home + precision. Idempotent. Resolves the provider covering the
    //home; when shadows are on AND a provider matches, fires one radius-based fetch yielding consolidated
    //shadow polygons; otherwise clears cached features so the next refresh falls back to MapTiler footprints.

    //Reset the whole LiDAR fetch state (key, features, raster, abort, backoff) when the provider becomes
    //irrelevant (no coverage / shadows off / view off) or on teardown, so a re-enable starts clean.
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
        //Bail inside the backoff window for the SAME failed key; a key change is a fresh request and bypasses it.
        if (this._lidarShadowFailedKey === key && Date.now() < this._lidarShadowBackoffUntil)
        {
            return;
        }

        //Shared-cache short-circuit: the LiDAR fetch is the heaviest network+parse step in boot; a fresh
        //engine after an editor commit re-pays it end-to-end unless served from here.
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
            //This key is now known-good; reset failure/backoff state.
            this._lidarShadowFailedKey    = '';
            this._lidarShadowFailureCount = 0;
            this._lidarShadowBackoffUntil = 0;
            //Pump the fresh raster to the LiDAR View layer (no-op until the View is opened: it sits at
            //alphaFade=0 with the buffer ready). Then pre-compute exposure in idle (zeroing the sun delta
            //to force it) so the dot cloud is finished when the user opens the mode.
            this._lidarViewLayer?.setData(this._lidarRaster);
            this._lastLidarExposureAlt = -999;
            this._lastLidarExposureAz  = -999;
            this._scheduleLidarExposureRecompute();
            //New shadow source: force a full refresh next call rather than waiting for the sun threshold.
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
        })
        .catch(err =>
        {
            if ((err as { name?: string })?.name === 'AbortError')
            {
                return;
            }
            //Persistent provider failure: keep _lidarShadowKey as-is (so the cache check doesn't flap) and
            //record the failed key + a backoff window separately, so the next call bails until the window
            //expires or the key changes. Otherwise every sky tick / sun-gate cross re-downloads and discards
            //the whole payload, compounding into a framerate hit on busy pages.
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

    //Push the MapTiler footprints into the building sources. Buildings are always MapTiler-driven; LiDAR is
    //used only for shadow projection.
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


    //Repaint night-shade, building tints and sun lighting to match the current sun altitude, blending
    //continuously across altitude bands (deep night -> twilight -> sunrise/sunset -> low sun -> daylight ->
    //zenith) so the time-of-day mood is smooth. Short-circuits when the sun barely moved (setPaintProperty
    //isn't free on mobile).
    private _refreshShadowsAndAtmosphere(): void
    {
        if (!this.map)
        {
            return;
        }

        const t   = this._selectedTime ?? new Date();
        const sun = getSunPosition(t, this.homeLat, this.homeLon);
        const { altitude, azimuth } = sun;

        //Only refresh when altitude moved >= 1.5 deg (~6 min): the shadow shifts a metre but the eye can't
        //tell a 6-min-stale shadow from fresh, and the old 0.5 deg threshold caused ~3x the raster passes.
        if (Math.abs(altitude - this._lastAtmosphereAlt) < 1.5)
        {
            return;
        }
        this._lastAtmosphereAlt = altitude;

        //Sun moved past the threshold: recompute LiDAR-View exposure so lit/shadowed colouring keeps up
        //(no-op when View is off, raster unloaded, or a compute is queued).
        this._scheduleLidarExposureRecompute();

        //Night-shade overlay (primary day/night cue): opacity ramps 0 (day) to ~0.65 (deep night), with a
        //warm tint through sunrise/sunset.
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

        //Modulate building colour by sun altitude: blend the daylight reference toward cool ink at night
        //and a warm tint near sunrise/sunset.
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

        //Sun-driven face shading on the extrusions. MapLibre's light is [radial, azimuth, polar]: azimuth
        //clockwise from north (matches getSunPosition), polar 0 (above) to 180 (below). anchor='map' ties
        //the light to the ground so camera rotation doesn't rotate it. Below the horizon the polar is
        //clamped just under 90 deg, else the face shading inverts on the few buildings still visible.
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

        //Cast-shadow source: off -> empty; LiDAR features -> consolidated regions; else MapTiler footprints.
        try
        {
            const shadowsOn = this._shadowsEnabled();
            const radius    = this._buildingRadiusMeters();
            //Signature of every shadow-raster input; same sig = same image, so skip the project+paint+encode.
            //Alt/az round to 0.1 deg (~6 min) so a scrub doesn't trigger a 20 ms encode every half-second.
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
                    //Clip shadows to the building disc so they never extend past the rendered surroundings.
                    clipCenterLat:    this.homeLat,
                    clipCenterLon:    this.homeLon,
                    clipRadiusMeters: radius
                });
                if (this.map)
                {
                    //Canvas size from lidar-precision (low/medium = 1024, high = 2048). Recreate only on a
                    //level change, else reuse across refreshes to avoid allocating 16 MB per minute.
                    const rasterSize = shadowRasterSizeFor(this._lidarPrecisionLevel());
                    if (!this._shadowCanvas || this._shadowCanvas.width !== rasterSize)
                    {
                        this._shadowCanvas = document.createElement('canvas');
                        this._shadowCanvas.width  = rasterSize;
                        this._shadowCanvas.height = rasterSize;
                    }
                    //Shadow fade matches the LiDAR view fade radii so all three layers share the same outer
                    //boundary and the shadow disc isn't a hard circular cut.
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

    //Precision fixed to 'high' (multi-model median); kept so the engine stays precision-aware for a future tier.
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
            //Single home-point fetch (with elevation): the only weather source; surroundings reuse the series.
            const precision = this._resolvedPrecision();
            this._homeHourlyData = await fetchHomePointData(
                fLat, fLon, this.homeElevation, precision, signal
            );
            this._renderForCurrentSelection();

            //Success: reset both back-off streaks and drop the rate-limit banner immediately.
            this._rateLimitStreak  = 0;
            this._otherErrorStreak = 0;
            this._setRateLimited(false);

            if (this._selectedTime === null)
            {
                //Refresh every 10 min: Open-Meteo updates forecasts every 15 min, so this stays near-fresh
                //without lagging a model cycle, well within free-tier quotas.
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
                //Surface the rate-limit state to the card for an alert banner (helper dedups the callback).
                this._setRateLimited(true);

                this._weatherTimer = window.setTimeout(
                    () => this._refreshWeather(this._fetchLat, this._fetchLon),
                    retryDelay
                );
            }
            else
            {
                //Non-rate-limit error (network, 500, parse): graduated back-off (1/5/15/60 min cap) via
                //setTimeout, so one retry is scheduled; success resets the streak, failure picks the next slot.
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

    //"Reset view": re-anchor on the home and restore the default pitch/bearing. Animation-only entry point
    //(resting target for scripted motions, one-tap reset if any leaves the camera off-pose).
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
            //Configured resting pose when set, else the hemisphere-aware boot defaults.
            pitch:    this._initialPitch(),
            bearing:  this._initialBearing(),
            duration: dur
        });
    }

    //Wall-clock until which fresh gestures are ignored. Read via isUserGestureSuppressed() to filter scrubs
    //and drag-rotate; for view transitions needing a post-animation input cooldown.
    _postExitCooldownUntil = 0;

    //Wipe cached Open-Meteo payloads, drop the in-memory snapshot, and re-fetch (editor's "reset data
    //cache" button). Returns the count removed for a UI confirmation.
    public resetDataCache(): number
    {
        const cleared = clearWeatherCache();
        this._homeHourlyData = null;
        this._refreshWeather(this._fetchLat, this._fetchLon);
        return cleared;
    }


    //IntersectionObserver gate: an off-screen/hidden-tab card calls setPaused(true) to stop the periodic
    //refresh and dome re-projection. Un-pause does one immediate refresh so the sun matches now, not where
    //it was when the card scrolled away.
    public setPaused(paused: boolean): void
    {
        if (this._paused === paused)
        {
            return;
        }
        this._paused = paused;
        if (paused)
        {
            //Drop the 60 s sky timer entirely while paused: the callback already early-returns, but the
            //timer itself woke the page every minute for no work. Re-armed on un-pause.
            if (this._skyTimer !== undefined)
            {
                window.clearInterval(this._skyTimer);
                this._skyTimer = undefined;
            }
            //Drop the weather timer too: an off-screen card otherwise hit Open-Meteo every 10 min forever
            //(hundreds of requests/day per stale tab). _refreshWeather re-arms on un-pause via its success path.
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
            //Re-arm weather: one immediate fetch (served from the localStorage cache inside its TTL, so a
            //quick flip costs nothing); the success path schedules the 10 min interval.
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

    //True during the post-exit cooldown. Card gates scrubs, engine gates drag-rotate; both read the same
    //clock so the suppression window is symmetric.
    public isUserGestureSuppressed(): boolean
    {
        return Date.now() < this._postExitCooldownUntil;
    }

    //Screen-space layout of the on-map readout chips and their leader lines. Returns positions (CSS px
    //relative to the canvas) for the cloud chip (outside the ring), PV chip, battery SoC/Power chips, grid
    //and low-carbon chips, the ring edge (hemisphere-aware anchor direction for the cloud fill interp), and
    //the projected home point (chip-leader anchor / disc centre). Null when the map isn't ready (card skips
    //the overlay that frame).
    public projectHomeLabelLayout(): {
        cloudLabel:        { x: number; y: number };
        pvLabel:           { x: number; y: number };
        batterySocLabel:   { x: number; y: number };
        batteryPowerLabel: { x: number; y: number };
        gridLabel:         { x: number; y: number };
        lowCarbonLabel:    { x: number; y: number };
        ringEdge:          { x: number; y: number };
        home:              { x: number; y: number };
        //Projected roof-top of the home building (home at render_height), the drop-leader's bottom endpoint
        //so the line lands on the roof at any size/pitch/zoom. Falls back to ground home when unresolved.
        homeRoof:          { x: number; y: number };
        //SVG polygon `points` for the PV home-anchor ground disc: 48 points on a circle of
        //PV_HOME_ANCHOR_RADIUS_M around the home, projected and expressed relative to home so the SVG can
        //wrap it in a translate-to-home group and pulse by scaling around the origin.
        homeAnchorPoints:  string;
    } | null
    {
        if (!this.map)
        {
            return null;
        }

        //project() exists at runtime but not on our shipped .d.ts; cast to bypass (as with getCanvas).
        const m = this.map as any;
        const home = m.project([this.homeLon, this.homeLat]);

        //Hemisphere-aware fixed anchor on the disc edge (NE of home in NH, SW in SH). Both project to
        //screen-lower-left at the resting bearing, keeping the cloud chip clear of the irradiance chip's
        //top-of-arc. Anchoring to one lon/lat lets the chip orbit smoothly under rotation.
        const lat0   = this.homeLat;
        const cosLat = Math.cos(lat0 * Math.PI / 180);
        const baseDE = lat0 >= 0 ? CLOUD_DISC_RADIUS_M : -CLOUD_DISC_RADIUS_M;
        //Rotate the base (east NH, west SH) +45° CCW in the (east, north) frame: lands NH at NE, SH at SW.
        const ROT      = Math.PI / 4;
        const anchorDE = baseDE * Math.cos(ROT);
        const anchorDN = baseDE * Math.sin(ROT);
        const anchorDLng = anchorDE / (111_320 * cosLat);
        const anchorDLat = anchorDN / 111_320;
        const anchor = m.project([this.homeLon + anchorDLng, this.homeLat + anchorDLat]);
        const ringEdgeX = anchor.x;
        const ringEdgeY = anchor.y;

        //Push the chip outward along the home->anchor radial so it stays outside the projected disc (with a
        //short leader gap) even when rotation moves the anchor off the left side.
        const CLOUD_CHIP_NUDGE_PX = 30;
        const radDX = ringEdgeX - home.x;
        const radDY = ringEdgeY - home.y;
        const radLen = Math.sqrt(radDX * radDX + radDY * radDY) || 1;
        const cloudLabelX = ringEdgeX + (radDX / radLen) * CLOUD_CHIP_NUDGE_PX;
        const cloudLabelY = ringEdgeY + (radDY / radLen) * CLOUD_CHIP_NUDGE_PX;

        //Chip cluster, organised into columns: PV anchored above the home, battery (SoC/Power) stacked on
        //the right, grid/low-carbon stacked on the left, so "what's in" and "what's stored/consumed" split.
        //All offsets scale by _heliosScale() so the cluster spreads on a kiosk layout (= 1.0 at standard
        //Lovelace sizes, unchanged).
        const scale = this._heliosScale();
        //Steeper vertical-lift ramp than the horizontal one: leaders down to the home need more height on a
        //fullscreen canvas. 1.0 at <= 600 px (no change); larger on kiosk so chips float higher.
        const liftScale = this._clusterLiftScale();
        //Side chips sit this far off the home's x (a touch wide so they don't crowd the home pill/leaders).
        const CHIP_SIDE_X_OFFSET_PX = 84 * scale;
        //Vertical gap between the top and bottom chip rows; 60 leaves room for the L-leaders' fillet.
        const CHIP_STACK_GAP_PX     = 60 * scale;
        //Home roof Y = home lat/lon projected at the tallest render_height. Used as the drop-leader endpoint
        //and to anchor the cluster above the roof so it follows the silhouette as the canvas grows. Falls
        //back to ground home before _buildingsData lands.
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

        //The cluster centres on the home pill (the chips' orbit hub), lifted modestly off the ground point
        //so it sits over the building body; liftScale lets a kiosk canvas breathe.
        const CLUSTER_LIFT_PX = 28 * liftScale;
        const clusterY = home.y - CLUSTER_LIFT_PX;
        const pvX = home.x;
        const pvY = clusterY - PV_CHIP_OFFSET_PX * liftScale;
        //Battery column on the RIGHT: SoC on top, Power on the bottom.
        const batteryXRight     = home.x + CHIP_SIDE_X_OFFSET_PX;
        //Power chip on top (pairs with PV overhead, owns the lead to the home); SoC below, its leader docks
        //on the Power chip, not the home.
        const batteryPowerY     = clusterY - CHIP_STACK_GAP_PX / 2;
        const batterySocY       = clusterY + CHIP_STACK_GAP_PX / 2;
        //Left column mirrors the right: low-carbon on top, grid on the bottom, with a straight vertical
        //leader down into the grid chip.
        const gridXLeft         = home.x - CHIP_SIDE_X_OFFSET_PX;
        const gridY             = clusterY + CHIP_STACK_GAP_PX / 2;
        const lowCarbonY        = clusterY - CHIP_STACK_GAP_PX / 2;

        //PV home-anchor ground disc as a polygon: sample N points on a circle of PV_HOME_ANCHOR_RADIUS_M
        //around the home, project each, and express relative to the home so the SVG can translate-to-home.
        //Flat on the ground, it projects to an ellipse under pitch like the rest of the map. 4 m matches the
        //visual weight of the HA Energy distribution card's home node.
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
            gridLabel:         { x: gridXLeft,      y: gridY        },
            lowCarbonLabel:    { x: gridXLeft,      y: lowCarbonY   },
            ringEdge:          { x: ringEdgeX,      y: ringEdgeY    },
            home:              { x: home.x,         y: clusterY     },
            homeRoof:          { x: home.x,         y: roofY        },
            homeAnchorPoints:  anchorPts.join(' '),
        };
    }

    //Per-frame projection caches and scratch buffers for _projectScenePoint(), which runs hundreds of
    //times per transform (96 arc samples, ~190 cloud points, 49 label anchors). Naive allocation here was
    //the dominant GC pressure (30k+ small arrays/second under auto-rotate). _projCache caches the
    //camera-side data (proj matrix, canvas dims) per frame, invalidated by _invalidateProjCache(); _mvpBuf
    //is the reused 16-slot mvp matrix; _llBuf is the reused 2-slot [lon, lat] for getMatrixForModel().
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

    //Linear ramp on the card's min CSS dimension so the chip cluster expands on a kiosk layout: 1.0 below
    //FLOOR (standard grid cell), ramping to MAX at TOP.
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
    //Steeper vertical-lift ramp (MAX 2.4 vs _heliosScale's 1.6) so the chip->home leader keeps pace with
    //canvas growth and the home stays anchored low. Same FLOOR/TOP breakpoints so transitions hinge together.
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
    //Stepped canvas-size ramp for the sun arc, used as a fallback before the map projection is ready so the
    //first paint has a sane radius. The dynamic _sunArcScale below takes over once projection works.
    private _steppedArcScale(minDim: number): number
    {
        if (!Number.isFinite(minDim) || minDim <= 0) { return 1.0; }
        const SMALL = 360, FLOOR = 600, TOP = 1200, MIN = 0.72, MAX = 2.2;
        if (minDim <= SMALL) { return MIN; }
        if (minDim <  FLOOR) { return MIN + (1.0 - MIN) * (minDim - SMALL) / (FLOOR - SMALL); }
        if (minDim >= TOP)   { return MAX; }
        return 1.0 + (MAX - 1.0) * (minDim - FLOOR) / (TOP - FLOOR);
    }

    //Dynamic sun-arc radius scale: size the arc so its widest on-screen reach is a fixed fraction of the
    //card's smaller side at any size/zoom/home. Measure ground px-per-metre at the home via an 8-direction
    //probe circle, taking the max home->point distance (the projected ellipse's semi-major axis, invariant
    //to bearing/pitch) so the arc holds steady through auto-rotation. Memoised per (canvas, zoom).
    private _sunArcScale(): number
    {
        const w = this._cachedCanvasCssW;
        const h = this._cachedCanvasCssH;
        const minDim = Math.min(w || Infinity, h || Infinity);
        const zoom = this.map ? this.map.getZoom() : -1;

        const memo = this._arcScaleMemo;
        if (memo && memo.w === w && memo.h === h && memo.zoom === zoom)
        {
            return memo.scale;
        }

        let scale = this._steppedArcScale(minDim);
        if (this.map && Number.isFinite(minDim) && minDim > 0)
        {
            const D          = Math.PI / 180;
            const mPerDegLat = 111_320;
            const mPerDegLon = 111_320 * Math.cos(this.homeLat * D);
            const PROBE_M    = 60;
            const home = this._projectScenePoint(this.homeLon, this.homeLat, 0);
            if (home)
            {
                let maxDistPx = 0;
                for (let k = 0; k < 8; k++)
                {
                    const ang   = (k / 8) * 2 * Math.PI;
                    const east  = PROBE_M * Math.sin(ang);
                    const north = PROBE_M * Math.cos(ang);
                    const p = this._projectScenePoint(
                        this.homeLon + east  / mPerDegLon,
                        this.homeLat + north / mPerDegLat,
                        0
                    );
                    if (!p) { continue; }
                    const dist = Math.hypot(p.x - home.x, p.y - home.y);
                    if (dist > maxDistPx) { maxDistPx = dist; }
                }
                const pxPerM = maxDistPx / PROBE_M;
                if (pxPerM > 0)
                {
                    //Target arc radius as a fraction of the card's smaller side; clamp keeps the disc/halo
                    //sane and leaves headroom above the apex for the chips on the sun.
                    const TARGET_FRAC = 0.41;
                    const desiredR    = (TARGET_FRAC * minDim) / pxPerM;
                    scale = Math.max(0.72, Math.min(desiredR / SUN_ARC_RADIUS_M, 6));
                }
            }
        }

        this._arcScaleMemo = { w, h, zoom, scale };
        return scale;
    }
    //Public accessor so the card scales the sun disc + halo with the arc radius (else the disc stays its
    //grid-tuned pixel size and reads as a tiny dot on a giant curve on a fullscreen canvas).
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

        //Per-frame cache: the projection matrix is identical across all _projectScenePoint() calls in a
        //frame, so resolve it once (invalidated on every move/resize). Canvas dims come from a
        //ResizeObserver-fed cache, not canvas.clientWidth, so the first projection doesn't force a layout flush.
        let pc = this._projCache;
        if (!pc)
        {
            const projM = t.getProjectionDataForCustomLayer().mainMatrix as number[];
            //First-time fallback before the ResizeObserver fired: read clientWidth once, paying one flush.
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

        //Reuse the [lon, lat] scratch buffer (MapLibre reads it synchronously, so no aliasing risk).
        this._llBuf[0] = lon;
        this._llBuf[1] = lat;
        const modelM: number[] = t.getMatrixForModel(this._llBuf, altitudeM);

        //mvp = projM · modelM into the reused _mvpBuf. Both inputs are column-major, so mvp[col*4+row] is
        //the (row, col) element.
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

        //Apply mvp to the origin (0,0,0,1): the last column is the projected origin.
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

    //Screen-space layout of the solar arc, the sun's current position, and the incidence ray. Null until
    //ready. Each arc point carries the irradiance (W/m², live cloud applied uniformly across the day, a
    //simplification that stays reactive without a per-hour forecast) and a `nearness` in [0..1] (1 =
    //nearest depth) the card uses to scale segment thickness + sun-disc radius for a perspective ribbon.
    public projectSunScene(now: Date): {
        arc:      Array<{
            x: number; y: number;
            irradiance: number; nearness: number; belowHorizon: boolean;
        }>;
        sun:      { x: number; y: number; irradiance: number; altitude: number; nearness: number };
        home:     { x: number; y: number };
        daylight: number;
        //Horizon crossings on the day's arc, with local tangent angle (rad) so the card draws a ring
        //perpendicular to the arc. Either may be null at high latitudes (polar summer/winter).
        sunrise:  { x: number; y: number; angleRad: number; time: Date } | null;
        sunset:   { x: number; y: number; angleRad: number; time: Date } | null;
    } | null
    {
        if (!this.map)
        {
            return null;
        }

        //Ground-level home projection: the SVG anchor for the incidence ray.
        const homeScreen = this._projectScenePoint(this.homeLon, this.homeLat, 0);
        if (!homeScreen)
        {
            return null;
        }

        //Sample the day at 15-min intervals from local midnight (civil time, not UTC, so the arc starts/ends
        //at the user's actual midnight regardless of timezone).
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayMs = 24 * 60 * 60 * 1000;
        const stepMs = dayMs / SUN_ARC_SAMPLES;

        //Live cloud cover colours the whole arc; with no reading yet treat as clear (0%) so the arc still
        //shows clear-sky intensity before the first weather fetch.
        const liveCloud = this._homeHourlyData
            ? (() => {
                const w = this._getWeatherAtTime(now);
                return w?.cloudCover ?? 0;
            })()
            : 0;

        //Reuse the cached arc inputs while day + rounded cloud + scale are unchanged. The heavy trig (96
        //getSunPosition + 96 computeIrradianceWm2 per pass) fires only on a cache miss; per frame we just
        //re-project the cached tuples.
        const dayStartMs  = dayStart.getTime();
        const cloudPctInt = Math.round(liveCloud);
        const arcScaleKey = Math.round(this._sunArcScale() * 100);
        let cache = this._arcInputsCache;
        if (
            !cache
         || cache.dayStartMs  !== dayStartMs
         || cache.cloudPctInt !== cloudPctInt
         || cache.scaleKey    !== arcScaleKey
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
                //Per-sample: sensor reading within the window, else the analytical clear-sky × cloud model.
                //Mixing along the arc is fine since sensor samples are sparse and the gradient is smooth.
                const sensorWm2 = this._sensorIrradianceAt(t);
                const wm2 = sensorWm2 !== null
                    ? sensorWm2
                    : computeIrradianceWm2(t, this.homeLat, this.homeLon, liveCloud);
                samples.push({
                    lon:          sun3D.lon,
                    lat:          sun3D.lat,
                    altitudeM:    sun3D.altitudeM,
                    wm2,
                    //altitudeM is R·sin(α), same sign as α, so < 0 means below the horizon. Surface a flag,
                    //not the value, since the card only switches render mode (solid vs dotted).
                    belowHorizon: sun3D.altitudeM < 0
                });
            }
            cache = { dayStartMs, cloudPctInt, scaleKey: arcScaleKey, samples };
            this._arcInputsCache = cache;
        }

        //Per-frame: re-project the cached samples, recording depth to normalise into nearness below.
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

        //daylight: smooth 0..1 ramp on solar altitude. Below -6° it bottoms at SUN_ARC_NIGHT_OPACITY,
        //above +6° full; the band between blends so dawn/dusk doesn't pop.
        const daylight = (() =>
        {
            if (sunNowAlt >= 6) { return 1; }
            if (sunNowAlt <= -6) { return SUN_ARC_NIGHT_OPACITY; }
            const t01 = (sunNowAlt + 6) / 12;
            return SUN_ARC_NIGHT_OPACITY + (1 - SUN_ARC_NIGHT_OPACITY) * t01;
        })();

        //Horizon crossings: walk the cached samples for below->above (sunrise) and above->below (sunset)
        //transitions, interpolating linearly between brackets. The tangent comes from the bracketing points
        //so the card rotates the ring perpendicular to the arc. Days with no crossing leave both null.
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

            //Lerp on altitudeM (+ above horizon, - below): t=0 at prev, t=1 at curr, altitudeM=0 at crossing.
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

            //Tangent: angle of (curr - prev) in screen space; the ring is drawn perpendicular to it.
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

    //date -> 3D point on the celestial hemisphere (radius SUN_ARC_RADIUS_M, centred on home) as
    //(lon, lat, altitude_m) for _projectScenePoint. Azimuth clockwise from North; ENU offsets
    //east=R·cosα·sinφ, north=R·cosα·cosφ, up=R·sinα, converted to lon/lat via local metres-per-degree.
    private _sunSpherePoint(date: Date): {
        lon: number; lat: number; altitudeM: number
    } | null
    {
        const sun = getSunPosition(date, this.homeLat, this.homeLon);
        const D   = Math.PI / 180;
        const a   = sun.altitude * D;
        const z   = sun.azimuth  * D;

        //Scale the celestial radius on kiosk layouts so the arc doesn't sit at its grid-tuned size.
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

    //Set the scrub time (null = live). Swaps the weather refresh cadence and re-renders.
    public setSelectedTime(time: Date | null): void
    {
        this._selectedTime = time;

        if (time === null)
        {
            this._clearWeatherTimer();
            //Returning to live mode resumes the standard 10-min refresh cadence.
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
            //Force atmosphere refresh: the user just scrubbed, so the "moved enough" guard would short-circuit.
            this._lastAtmosphereAlt = -999;
            this._renderForCurrentSelection();
            //Coalesce rapid scrubs into one shadow paint every ~100 ms. The light visuals (arc, chips, disc)
            //already updated above; only the costly shadow raster paint is deferred to the pause.
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

    //Read-only view of the currently loaded LiDAR nDSM raster: the same buffer the LiDAR View overlay
    //paints, plus its bbox, handed as a live reference (caller treats it immutable). Null when no provider
    //covers the home or the last fetch failed. The optional `terrain` field carries the DTM band when the
    //source COG ships one (helios-lidar.org 2-band), letting the shading ray-march compare absolute Z so
    //sloped ground between panel and obstacle counts; absent on every public provider and legacy COGs.
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

    //Hourly temperature + wind series aligned with getTimelineSeries' `times`. NaN entries where the model
    //gave no value (callers skip them). Null until a weather payload lands.
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


    //Hourly series for the chart (one entry per hour over the forecast window): irradiance (W/m², sensor ->
    //shortwave -> Haurwitz fallback so the curve stays continuous past the model horizon), effective cloud
    //and the per-altitude bands, beam/diffuse, snow depth, temperature, wind. Null until the first fetch.
    //The card re-renders the chart on every onWeatherUpdate.
    public getTimelineSeries(): {
        times:        Date[];
        irradiance:   number[];
        cloud:        number[];
        //Per-hour low/mid/high cloud cover %, so the timeline draws the three altitude bands separately.
        cloudLow:     number[];
        cloudMid:     number[];
        cloudHigh:    number[];
        //Per-hour beam + diffuse radiation W/m² (-1 where unsupplied), so card/pv.ts can transpose a tilted
        //array on the real direct/diffuse split instead of the cloud-derived fraction.
        directRad:    number[];
        diffuseRad:   number[];
        //Per-hour snow depth m (NaN where unsupplied); feeds the winter snow-cover derate on PV output.
        snowDepth:    number[];
        //Per-hour temperature °C and 10 m wind m/s (NaN-padded), so card/pv.ts can apply thermal derating
        //without re-deriving the weather-hour-to-cursor alignment.
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
            //Per-hour priority sensor -> shortwave -> Haurwitz. Forecast hours carry no sensor sample, so
            //the future half falls through to the model.
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
            //Haurwitz returns a normalised PV %; rescale to W/m² (×10, since 1000 = STC) for one chart unit.
            const pct = computePvPower(home.times[i], this.homeLat, this.homeLon, home.cloudCover[i] ?? 0);
            return pct * 10;
        });

        const cloud     = home.times.map((_, i) => home.cloudCover[i] ?? 0);
        const cloudLow  = home.times.map((_, i) => home.cloudLow[i]  ?? 0);
        const cloudMid  = home.times.map((_, i) => home.cloudMid[i]  ?? 0);
        const cloudHigh = home.times.map((_, i) => home.cloudHigh[i] ?? 0);

        //Beam + diffuse pass straight from the model with the -1 sentinel preserved (no sensor/Haurwitz
        //fallback): an undecomposed hour reads -1 and the transposition reverts to the cloud split there.
        const directRad  = home.times.map((_, i) => home.directRad[i]  ?? -1);
        const diffuseRad = home.times.map((_, i) => home.diffuseRad[i] ?? -1);

        return {
            times:       home.times.slice(),
            irradiance,
            cloud,
            cloudLow,
            cloudMid,
            cloudHigh,
            directRad,
            diffuseRad,
            snowDepth:   home.snowDepth.slice(),
            temperature: home.temperature.slice(),
            windSpeed:   home.windSpeed.slice(),
        };
    }

    //Snapshot of the engine's live state for window.heliosStats() debugging. JSON-safe so a user can paste
    //it into an issue. No PII: home lat/lon/elevation are stripped (only the hemisphere is kept, for
    //sun-arc orientation) and the API key never reaches here.
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
            //Home position omitted; lidarProvider + hemisphere cover the debug cases without leaking the address.
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
                //Module-level counters shared across every Helios card on the page, so these reflect the
                //combined Open-Meteo traffic of the session (useful for rate-limit debugging).
                openMeteoStats:   getWeatherFetchStats()
            },
            timeline:
            {
                //ISO strings (not Date) so the snapshot round-trips through JSON.stringify.
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

        //Re-arm the auto-rotate rAF loop when the flags transition back to rotation-permitting (the loop
        //suspends itself when disabled to avoid a 60 Hz no-op tick).
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

        //Map-style change: reload the basemap. setStyle() wipes sources/layers; the _onStyleLoad handler
        //re-adds ours. Drop _mapReady while in flight so nothing operates on a half-loaded style.
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

        //Building updates: radius/cluster changes invalidate the GeoJSON and refetch via _addBuildings;
        //opacity/colour are cheap paint updates.
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
                //Radius also drives camera bounds, LiDAR extent and the fade band: re-clamp bounds, re-push
                //fade range and invalidate the LiDAR fetch so the whole disc resizes in lockstep.
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

        //Precision change invalidates the cached shadow features (key includes raster size) and refetches.
        //Also clear failure/backoff so a precision change after a failure retries immediately.
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

        //Master shadow toggle: on -> fetch LiDAR if covered; off -> reset the LiDAR state.
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

        //LiDAR View knobs are cheap uniform updates; push unconditionally (the layer no-ops on no change).
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
        //Centralised reset also clears failed-key + backoff so a re-init doesn't inherit a stale window.
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
        //Cancel the exposure pipeline: the idle callback can fire after cleanup and the rAF loop captures
        //`this`, so a live token would pin the dead engine + context for an extra frame per chunk.
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

        //Tear-down strategy: explicit + defensive + force-lose. map.remove() alone can't be trusted to
        //release every listener/source/context (iOS Safari leaves closures pinning the dead engine and the
        //context slot occupied; browsers cap at 8-16). Order: detach DOM listeners, unhook our map.on()
        //handlers, remove our custom sources/layers, then map.remove(), then force-lose the context.

        const canvas = this._mapCanvas;

        //Step 1: canvas DOM listeners (drag-rotate, WebGL lost/restored).
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

        //Grab the WebGL context before map.remove() destroys it; force-lost at the end to release the slot.
        let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
        try
        {
            gl = (canvas?.getContext('webgl2') as WebGL2RenderingContext | null)
              ?? (canvas?.getContext('webgl')  as WebGLRenderingContext  | null)
              ?? null;
        }
        catch (_) {}

        //Step 2: every map.on() listener we hold a ref for, severed before the engine is dropped.
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
                if (this._mapMoveEndHandler)
                {
                    this.map.off('moveend',            this._mapMoveEndHandler);
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

        //Step 3: explicit removal of every helios-* layer and source. removeLayer must precede removeSource
        //(MapLibre rejects removing a source still backing live layers).
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
                //LiDAR-View custom layer: removeLayer triggers its onRemove() (frees the GPU buffers +
                //program). On the iOS Safari path where map.remove() skips custom layers, this is the only
                //thing preventing a leak per respawn.
                'helios-lidar-view',
                //Weather-mode cloud shader: same rationale (onRemove frees program, quad VBO, data texture).
                'helios-weather-cloud'
            ])
            {
                try { if (this.map.getLayer(lid)) this.map.removeLayer(lid); }
                catch (_) {}
            }
            //setTerrain(null) before removing DEM sources: MapLibre refuses to remove a source still bound
            //to live terrain.
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

        //Step 4: drop heavy instance state before map.remove() so the unreachable engine holds only
        //already-released handles.
        this._buildingsData     = null;
        this._buildingsFetchKey = '';
        this._homeHourlyData    = null;
        //Drop our LidarViewLayer pointer too (map.remove() frees its GL handles), else a stale instance
        //pins the dead handles per killed engine and multiplies context pressure on respawn bursts.
        this._lidarViewLayer        = undefined;
        this._lidarRaster           = null;
        this._mapCanvas             = undefined;
        this._dragRotateHandlers    = undefined;
        this._mapPinHandler         = undefined;
        this._mapStyleLoadHandler   = undefined;
        this._mapLoadHandler        = undefined;
        this._mapMoveHandler        = undefined;
        this._mapMoveEndHandler     = undefined;
        this._mapErrorHandler       = undefined;
        this._mapStyleImageMissingHandler = undefined;
        this._webglLostHandler      = undefined;
        this._webglRestoredHandler  = undefined;
        this.onContextLost          = undefined;

        //Step 5: MapLibre teardown. Detach the canvas from its parent before map.remove() so a lingering
        //reference can't keep the host (helios-card shadow root + descendants) alive.
        if (canvas && canvas.parentNode)
        {
            try { canvas.parentNode.removeChild(canvas); }
            catch (_) {}
        }
        this.map?.remove();
        this.map       = undefined;
        this._mapReady = false;

        //Step 6: force the WebGL context slot to release. Canvas GC alone doesn't always reclaim it, and the
        //8-16 context cap is the dominant cause of perf drift / random refresh / iOS black screen on re-init.
        try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); }
        catch (_) {}

        //Step 7: clear the debug global so it doesn't pin the dead map.
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