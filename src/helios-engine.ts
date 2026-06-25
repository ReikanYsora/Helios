import maplibregl from './maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { getSunPosition, computePvPower, computeIrradianceWm2 } from './engine/sun';
import { fetchHomePointData, clearWeatherCache, getWeatherFetchStats, RATE_LIMIT_BACKOFF_MS, OTHER_ERROR_BACKOFF_MS, type SampleHourly } from './engine/weather';
import { fetchBuildingsAroundHome, type BuildingsResult } from './engine/buildings';
import { projectExtrusionShadows } from './engine/shadows';
import { startAutoRotateLoop } from './engine/auto-rotate';
import {
    CAMERA_PITCH_MIN_DEG, CAMERA_PITCH_MAX_DEG, CAMERA_PITCH_REST_DEG, CAMERA_TARGET_HEIGHT_M,
    SUN_ARC_RADIUS_M, SUN_ARC_SAMPLES, SUN_ARC_NIGHT_OPACITY, PV_CHIP_OFFSET_PX,
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
    DISPLAY_FADE_DELTA_M,
    displayRadiusM,
    DEFAULT_BUILDING_OPACITY,
    DEFAULT_BUILDING_CLUSTER_RADIUS_M,
    DEFAULT_BUILDING_COLOR_HEX,
    DEFAULT_SHADOW_OPACITY,
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
//Shared module-scope cache for parsed building GeoJSON. HA re-creates the card element on every config
//commit, re-allocating the WebGL context, but a fresh engine can pick up the already-parsed data
//synchronously and skip the parse+projection cost (10-50 ms) that otherwise shows as a preview flash. TTL
//is wide since the data is static; the key encodes home position + radius, so any meaningful change
//invalidates the entry naturally.
const SHARED_FETCH_CACHE_TTL_MS = 30 * 60_000;

interface SharedBuildingsCacheEntry
{
    data: BuildingsResult;
    ts:   number;
}

const _sharedBuildingsCache: Map<string, SharedBuildingsCacheEntry> = new Map();


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

    //Camera-target padding state. _appliedPaddingTop is the last padding we pushed; the last pitch/zoom gate
    //the recompute so bearing-only rotation never moves the target and setPadding's own moveend can't loop.
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

    //Offscreen canvas for rasterising cast shadows before upload to the image source. Lives the whole
    //engine lifetime (no realloc per tick); sized at SHADOW_RASTER_SIZE, bounds recomputed per refresh.
    private _shadowCanvas?: HTMLCanvasElement;

    //Debounce timer for the shadow/atmosphere refresh during rapid scrub: each setSelectedTime() resets it
    //and the refresh runs once on expiry. Curves+chips still update every move; only the costly shadow
    //raster paint is coalesced.
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

    //Optional card-side hooks for a busy indicator during the shadow raster paint; the engine computes
    //silently if unset.
    public onShadowComputeStart?: () => void;
    public onShadowComputeEnd?:   () => void;

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
            //Zoom locked to the resting pose: the 3D camera is tuned for this one altitude.
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

    //Master shadow toggle. False = no cast shadows; true = shadows cast from building footprints.
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

    //Distance fall-off bounds for the cast-shadow raster: full opacity up to one fade-band inside the display
    //radius, fading out at the radius. Derived from the live radius so all layers stop at the same boundary.
    private _shadowFadeRange(): [fullMeters: number, fadeMeters: number]
    {
        const radius = this._buildingRadiusMeters();
        return [Math.max(0, radius - DISPLAY_FADE_DELTA_M), radius];
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

    //Global display radius shared by basemap bbox, buildings, raster shadows, projection
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

    //Push the MapTiler footprints into the building sources.
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

        //Cast-shadow source: off -> empty; else MapTiler building footprints.
        try
        {
            const shadowsOn = this._shadowsEnabled();
            const radius    = this._buildingRadiusMeters();
            //Signature of every shadow-raster input; same sig = same image, so skip the project+paint+encode.
            //Alt/az round to 0.1 deg (~6 min) so a scrub doesn't trigger a 20 ms encode every half-second.
            const sig =
                `${shadowsOn ? '1' : '0'}` +
                `|${altitude.toFixed(1)}|${azimuth.toFixed(1)}` +
                `|${this.homeLat.toFixed(6)}|${this.homeLon.toFixed(6)}` +
                `|${radius}` +
                `|B${this._buildingsData
                    ? (this._buildingsData.home.features.length
                       + this._buildingsData.surroundings.features.length)
                    : -1}`;
            if (sig !== this._lastShadowSig)
            {
                this._lastShadowSig = sig;
                let input: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
                if (shadowsOn && this._buildingsData)
                {
                    input = {
                        type:     'FeatureCollection',
                        features: [
                            ...this._buildingsData.home.features,
                            ...this._buildingsData.surroundings.features
                        ]
                    };
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
                    //Canvas size for the shadow raster. Recreate only on a size change, else reuse across
                    //refreshes to avoid allocating 16 MB per minute.
                    const rasterSize = shadowRasterSizeFor();
                    if (!this._shadowCanvas || this._shadowCanvas.width !== rasterSize)
                    {
                        this._shadowCanvas = document.createElement('canvas');
                        this._shadowCanvas.width  = rasterSize;
                        this._shadowCanvas.height = rasterSize;
                    }
                    //Shadow fade matches the display radius so the building and shadow layers share the same
                    //outer boundary and the shadow disc isn't a hard circular cut.
                    const radiusM = this._buildingRadiusMeters();
                    const [fullR, fadeR] = this._shadowFadeRange();
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
        pvLabel:           { x: number; y: number };
        batterySocLabel:   { x: number; y: number };
        batteryPowerLabel: { x: number; y: number };
        gridLabel:         { x: number; y: number };
        lowCarbonLabel:    { x: number; y: number };
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
            pvLabel:           { x: pvX,            y: pvY          },
            batterySocLabel:   { x: batteryXRight,  y: batterySocY  },
            batteryPowerLabel: { x: batteryXRight,  y: batteryPowerY},
            gridLabel:         { x: gridXLeft,      y: gridY        },
            lowCarbonLabel:    { x: gridXLeft,      y: lowCarbonY   },
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
        const shadowsOn = this._shadowsEnabled();
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
        else if (this._buildingsData)
        {
            shadowSource = 'footprints';
        }
        else
        {
            shadowSource = 'pending';
        }

        return {
            mapReady:             this._mapReady,
            //Home position omitted; only the hemisphere is kept (for sun-arc orientation).
            hemisphere:           this.homeLat >= 0 ? 'N' : 'S',
            shadows:
            {
                enabled:          shadowsOn,
                source:           shadowSource,
                opacity:          this._shadowOpacity(),
                clipRadiusM:      this._buildingRadiusMeters(),
                lastSigCached:    this._lastShadowSig !== undefined
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
                //Radius also drives camera bounds and the shadow fade band: re-clamp bounds and force a
                //shadow refresh so the whole disc resizes in lockstep.
                this._applyMapBounds();
                this._lastShadowSig     = undefined;
                this._lastAtmosphereAlt = -999;
                this._refreshShadowsAndAtmosphere();
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

        //Master shadow toggle: force a shadow refresh so the raster repaints (on) or clears (off).
        const nextShadowsOn = this._shadowsEnabled();
        if (nextShadowsOn !== prevShadowsOn)
        {
            this._lastShadowSig     = undefined;
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
        }

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
        this._shadowCanvas           = undefined;
        this._arcInputsCache         = undefined;
        this._lastShadowSig          = undefined;
        this._resizeObserver?.disconnect();
        if (this._autoRotateRaf !== undefined)
        {
            cancelAnimationFrame(this._autoRotateRaf);
            this._autoRotateRaf = undefined;
        }

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
                'helios-building-shadows'
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