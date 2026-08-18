import { SceneRenderer } from './renderer';
import { renderDayCurve, type DayCurveInput as CurveInput, type DayCurveScene } from './day-curve';
import type { Building, RawBuilding } from './buildings';
import { getSunPosition, computePvPercent, computeIrradianceWm2 } from '../core/time/sun';
import { fetchHomePointData, clearWeatherCache, type SampleHourly } from '../data/weather';
import { fetchRawBuildings, interpretBuildings, clearBuildingsLocationCache } from './buildings';
import { defaultGroundPalette, GROUND_LAYER_KEYS, type GroundStyle, type GroundLayerKey } from './ground-render';
import { resolveWeatherAtTime } from '../data/weather-resolve';
import { clusterScaleRamp, steppedArcScale } from './hud-layout';
import { sunSpherePoint, daylightRamp, horizonSpherePoint } from './sun-arc';
import { buildTimeSamples, timeSamplesEqual, nearestSampleAt, type TimeSample } from '../core/nearest-series';
import { fetchHorizonProfile, horizonAltAt, horizonPeak, HORIZON_MIN_PEAK_DEG, type HorizonProfile } from '../data/sources/horizon';
import {
    CAMERA_PITCH_MIN_DEG, CAMERA_PITCH_MAX_DEG, CAMERA_PITCH_REST_DEG,
    SUN_ARC_RADIUS_M, SUN_ARC_SAMPLES, SUN_ARC_NIGHT_OPACITY, SUNRISE_SUNSET_ALTITUDE_DEG,
    SHARED_FETCH_CACHE_TTL_MS, AUTO_ROTATE_DEG_PER_SEC, AUTO_ROTATE_INACTIVITY_MS,
    BUILDINGS_REFETCH_DELAY_MS, METRES_PER_DEGREE, DAY_MS,
    RATE_LIMIT_BACKOFF_MS, OTHER_ERROR_BACKOFF_MS} from '../core/config/constants';
import
{
    type HeliosConfig,
    displayRadiusM,
    DEFAULT_BUILDING_OPACITY,
    DEFAULT_BUILDING_CLUSTER_RADIUS_M,
    DEFAULT_SHADOW_OPACITY,
    buildingCount,
    buildingRealSize,
    buildingFixedHeightM,
    buildingColorToken,
    mapThemeMode,
    mapLayerColor,
    mapLayerVisible,
} from '../core/config/helios-config';
import { isDarkFromCss, cssHex, resolveUiColor } from '../core/format/format';


//Module-scope cache for the RAW (option-independent) building footprints. HA re-creates the card element
//on every config commit; a fresh engine picks up the already-fetched raw data synchronously, skipping the
//fetch + parse. TTL is wide (data is static); keyed on home LOCATION only, so a building-option change
//reuses the same entry (interpret applies options in memory). SHARED_FETCH_CACHE_TTL_MS lives in constants.

interface SharedBuildingsCacheEntry
{
    data: RawBuilding[];
    ts:   number;
}

const _sharedBuildingsCache = new Map<string, SharedBuildingsCacheEntry>();

//Live-mode weather poll cadence (ms). 10 min: Open-Meteo updates forecasts every 15 min, so this stays
//near-fresh without lagging a model cycle, well within free-tier quotas.
const WEATHER_REFRESH_INTERVAL_MS = 600_000;

//Terrain horizon is visual-only and cached for months, so it is kicked a beat after the scene first paints (its
//elevation requests must not burst into the cold-start weather + tile + building fetches), and retried a bounded
//few times on failure (a cold-start Open-Meteo 429) instead of leaving the flat horizon until the next reload.
const HORIZON_INITIAL_DELAY_MS = 2500;
const HORIZON_RETRY_DELAY_MS   = 60_000;
const HORIZON_MAX_RETRIES      = 3;


function sharedBuildingsCacheGet(key: string): RawBuilding[] | null
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



//Source of the irradiance shown in the PV legend, in precedence order:
//  haurwitz  - analytical clear-sky GHI (Haurwitz 1945) + cloud attenuation (Kasten-Czeplak 1980);
//              always available, used as fallback past the forecast horizon or when shortwave is missing.
//  shortwave - shortwave_radiation_instant from the weather model (median of active models in 'high');
//              more accurate as it accounts for aerosols/humidity/multi-layer cloud.
//  sensor    - value from a HA entity via setSolarIrradianceSamples; a real measurement at the home, so
//              it wins, but only in live mode (scrubbing past/forecast falls back to shortwave/haurwitz).
export type IrradianceSource = 'haurwitz' | 'shortwave' | 'sensor';

//Weather variables a local sensor can override (keys match the resolved-weather fields). A configured sensor beats
//the Open-Meteo model for the live + past portions; the forecast (future) always falls back to the model, since a
//sensor has no future data (the nearest-neighbour window below returns null past its reach).
export type WeatherOverrideVar = 'cloudCover' | 'precip' | 'snowfall' | 'temperature' | 'humidity' | 'code';

export interface WeatherData
{
    cloudCover:     number;
    cloudLow:       number;        //%, low-level clouds (<= 3 km)
    cloudMid:       number;        //%, mid-level clouds (3 to 8 km)
    cloudHigh:      number;        //%, high-level clouds (>= 8 km)
    precip:         number;        //mm of precipitation this hour ("Your real sky" rain layer)
    snowfall:       number;        //cm of snowfall this hour (snow layer)
    weatherCode:    number;        //WMO weather code (thunderstorm 95/96/99 drives the storm layer)
    temperature:    number;        //°C outdoor temperature (temperature chip); NaN when unavailable
    humidity:       number;        //% relative humidity; NaN when unavailable
    timeRange:      { start: Date; end: Date } | null;
    isLiveTime:     boolean;
    pvPower:        number;        //primary value, normalised 0..100 (~ GHI/10 W/m²)
    pvPowerHaurwitz:  number;      //always populated (analytical fallback)
    pvPowerShortwave: number;      //-1 if shortwave_radiation is unavailable
    irradianceSource: IrradianceSource;
}

//Cloud disc, chip cluster, camera target and sun-arc tunables live in constants.ts.


//Engine

export class HeliosEngine
{
    //Renderer: owns its own DOM inside #map-container and the SceneCamera every projection routes through.
    _renderer?: SceneRenderer;
    //Last curve the card handed over, kept so a resize can restamp its radius without the card involved.
    private _curveInput: CurveInput | null = null;
    homeLat:  number;
    homeLon:  number;
    //Home altitude (m above sea level), forwarded to Open-Meteo via &elevation= for sharper boundary
    //conditions. Undefined falls back to the API's global DEM.
    private homeElevation?: number;
    cfg:      HeliosConfig;

    private _fetchLat = 0;
    private _fetchLon = 0;

    private _mapReady     = false;
    //Single source of truth for hourly forecast data; null until the first successful fetch.
    private _homeHourlyData: SampleHourly | null = null;
    private _selectedTime:  Date | null       = null;

    //Skip atmosphere repaint when the sun moved less than 1.5° since last call (~6 min).
    private _lastAtmosphereAlt = -999;
    //Sun altitude at the last ground re-tint. Coarser step than the wash (the vector ground re-raster is heavier
    //than the cheap full-frame wash), so the day/night grade on the map updates every few degrees.
    private _lastGroundAlt = -999;

    //Consecutive HTTP 429 count, drives exponential back-off. Resets on any successful fetch.
    private _rateLimitStreak = 0;
    //Consecutive non-429 failure count (5xx, network, JSON parse). Drives a graduated back-off so an
    //outage doesn't retry at a flat cadence and pile up IP-rate-limit traffic. Resets on success.
    private _otherErrorStreak = 0;

    private _fetchAbortController?: AbortController;

    //Terrain horizon (visual only): the ridge elevation per azimuth, so the sun hides behind relief. Null until
    //resolved or on flat terrain. Its own abort controller since it fetches independently of the weather. The
    //profile ALWAYS refines the sun gate (realism); `_horizonLineVisible` only toggles the drawn ridge line.
    private _horizonProfile: HorizonProfile | null = null;
    private _horizonLineVisible = true;
    private _horizonAbort?: AbortController;
    //Deferred initial kick + bounded retry share one timer; the counter resets on a real new request (setHome).
    private _horizonTimer?: number;
    private _horizonRetryCount = 0;

    //Last container size the observer acted on, so a no-op resize notification can't loop into a repaint.
    private _obsW = -1;
    private _obsH = -1;
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

    public onWeatherUpdate?: (data: WeatherData) => void;

    //Irradiance samples from a HA irradiance sensor (history + live state), sorted ascending by time.
    //Null = no entity or no usable samples (model irradiance used unchanged). Each is W/m², treated as
    //ground-truth shortwave irradiance at the home in the same units as the model's shortwave field, so it
    //slots into the pipeline unscaled. Lookup is nearest-neighbour within a strict +/-30 min window; outside
    //it (and always for forecast time) fall through to the model rather than extrapolate stale values.
    private _sensorIrradianceSamples: TimeSample[] | null = null;
    private static readonly SENSOR_IRRADIANCE_WINDOW_MS = 30 * 60 * 1000;
    public setSolarIrradianceSamples(
        samples: { time: Date; wm2: number }[] | null
    ): void
    {
        //Drop non-finite and negative readings; build -> null when empty, so the equality guard below covers both
        //the "cleared" and "unchanged" cases. The card re-pushes every Lit cycle; without the guard each push
        //fires onWeatherUpdate -> updated() -> push again, an infinite loop that freezes the dashboard the moment
        //an irradiance entity is selected.
        const next = buildTimeSamples(samples, (s) => s.time.getTime(), (s) => s.wm2, (v) => v >= 0);
        if (timeSamplesEqual(this._sensorIrradianceSamples, next)) { return; }
        this._sensorIrradianceSamples = next;
        //Invalidate the arc cache so the next projectSunScene rebuilds with the new sensor ground truth.
        this._arcInputsCache = undefined;
        this._renderForCurrentSelection();
    }

    //Nearest-neighbour reading closest to `t` within the +/-30 min window, else null (caller falls back to the model).
    private _sensorIrradianceAt(t: Date): number | null
    {
        return nearestSampleAt(this._sensorIrradianceSamples, t.getTime(), HeliosEngine.SENSOR_IRRADIANCE_WINDOW_MS);
    }

    //Local-sensor weather overrides: per-variable sample series (sorted ascending), pushed by the card from a
    //configured entity's history + live state. Nearest-neighbour within the window replaces the model value at
    //resolve time; empty/absent = model unchanged.
    private _weatherOverrideSamples = new Map<WeatherOverrideVar, TimeSample[]>();
    private static readonly SENSOR_WEATHER_WINDOW_MS = 30 * 60 * 1000;

    public setWeatherOverrideSamples(
        variable: WeatherOverrideVar,
        samples: { time: Date; value: number }[] | null
    ): void
    {
        const prev = this._weatherOverrideSamples.get(variable) ?? null;
        //Overrides keep every finite value (a temperature override is legitimately negative).
        const next = buildTimeSamples(samples, (s) => s.time.getTime(), (s) => s.value, () => true);
        //Same re-render guard as the irradiance setter (the card pushes every Lit cycle).
        if (timeSamplesEqual(prev, next)) { return; }
        if (next === null) { this._weatherOverrideSamples.delete(variable); }
        else               { this._weatherOverrideSamples.set(variable, next); }
        this._arcInputsCache = undefined;
        this._renderForCurrentSelection();
    }

    //"Your real sky" scene grade (saturate/brightness from the resolved weather). Baked into the ground + building
    //paint by the renderer, not a CSS filter on the map layer - the card computes it, the renderer carries it.
    public setWeatherGrade(sat: number, bright: number): void
    {
        this._renderer?.setWeatherGrade(sat, bright);
    }

    //Nearest-neighbour override value for `variable` at `t`, or null (outside the window / no samples), in which
    //case the caller keeps the model value.
    private _weatherOverrideAt(variable: WeatherOverrideVar, t: Date): number | null
    {
        return nearestSampleAt(this._weatherOverrideSamples.get(variable) ?? null, t.getTime(), HeliosEngine.SENSOR_WEATHER_WINDOW_MS);
    }

    //Map transform changed: card recomputes screen-space projections (arc, chips, leaders) from this hook.
    public onMapTransform?:  () => void;

    //Camera pose persists via localStorage: Lovelace doesn't persist config-changed from a live card (only
    //the editor preview), so a YAML round-trip isn't an option. cacheKey is the per-card storage
    //discriminator (card's effective cache id, including any duplicate `#N` suffix), set by the card; empty
    //keys the pose on home coordinates, rounded to 3 decimals (~111 m) to separate neighbours yet tolerate
    //GPS jitter.
    public cacheKey = '';
    private _cameraPoseStorageKey(): string
    {
        const id = this.cacheKey.trim();
        if (id)
        {
            return `helios:camera-pose:${id}`;
        }
        const lat = Math.round(this.homeLat * 1000) / 1000;
        const lon = Math.round(this.homeLon * 1000) / 1000;
        return `helios:camera-pose:${lat}:${lon}`;
    }
    private _readStoredPose(): { bearing?: number; pitch?: number } | null
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
                return parsed as { bearing?: number; pitch?: number };
            }
        }
        catch
        {
            //Quota/disabled-storage/private-window errors degrade to "no stored pose, use defaults".
        }
        return null;
    }
    private _writeStoredPose(pose: { bearing: number; pitch: number }): void
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
    //Resting pose at init: the stored bearing/pitch from localStorage (the drag-set angle) first, then the YAML
    //camera-*-deg keys, then the hemisphere-aware default (south up in NH, north up in SH). Wrapped/clamped
    //against stale reads.
    //Locked + a configured angle: the config pose WINS over the per-device localStorage pose, so a locked view is
    //identical on every device/browser. Unlocked (or no config angle): the drag-set localStorage pose leads, then
    //config, then the hemisphere default, keeping the per-device behaviour for free-rotating cards.
    private _initialBearing(): number
    {
        const stored = this._readStoredPose();
        const rawStored = stored && typeof stored.bearing === 'number' ? stored.bearing : NaN;
        const rawCfg    = Number((this.cfg as Record<string, unknown>)['camera-bearing-deg']);
        const raw = (this.isCameraLocked() && Number.isFinite(rawCfg))
            ? rawCfg
            : (Number.isFinite(rawStored) ? rawStored : rawCfg);
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
        const raw = (this.isCameraLocked() && Number.isFinite(rawCfg))
            ? rawCfg
            : (Number.isFinite(rawStored) ? rawStored : rawCfg);
        if (Number.isFinite(raw))
        {
            return Math.max(CAMERA_PITCH_MIN_DEG, Math.min(CAMERA_PITCH_MAX_DEG, raw));
        }
        return CAMERA_PITCH_REST_DEG;
    }
    //True when drag-rotate/pitch and idle auto-orbit are all suppressed (locked pose). The editor/YAML
    //`camera-locked` toggle is the sole authority: a stale localStorage flag must never override it.
    public isCameraLocked(): boolean
    {
        return (this.cfg as Record<string, unknown>)['camera-locked'] === true;
    }
    //Persist the camera's CURRENT bearing/pitch to localStorage, so reopening the dashboard restores the exact
    //view. Called on drag-end and by the card on teardown (captures an auto-rotated bearing too). No-op before
    //the renderer exists.
    //Current camera pose (bearing/pitch in degrees), or null before the renderer exists. Used by the editor's
    //"use current view" helper to capture the framed angle into the config.
    public getCameraPose(): { bearing: number; pitch: number } | null
    {
        if (!this._renderer) { return null; }
        return { bearing: this._renderer.getCameraBearing(), pitch: this._renderer.getCameraPitch() };
    }

    public persistCameraPose(): void
    {
        if (!this._renderer)
        {
            return;
        }
        this._writeStoredPose({
            bearing: this._renderer.getCameraBearing(),
            pitch:   this._renderer.getCameraPitch(),
        });
    }

    //Day curve, or null to hide it. The card owns the data and the renderer owns the projection, but the RADIUS is
    //neither's: the curve stands on the sun arc projected down, and the arc scale lives here. So the card hands over
    //everything but the radius, and this stamps it on.
    public setDayCurve(curve: CurveInput | null): void
    {
        this._curveInput = curve;
    }

    //Screen-space curve for one instant, as the two depth passes the card layers around its chips. Projected here
    //rather than in the renderer because the curve is a READING, not scene geometry: like the sun arc it has to
    //reach above the chips, and nothing the renderer draws can - #map-container is its own stacking context, so its
    //whole subtree is pinned below the HUD. Being a HUD layer also puts it clear of the buildings, which it used to
    //cut straight through.
    public projectDayCurve(t: Date): DayCurveScene | null
    {
        if (!this._curveInput || !this._renderer) { return null; }
        const sun = getSunPosition(t, this.homeLat, this.homeLon);
        //The radius is the arc's own, restamped every call, so a resize can never leave the track off the arc.
        const curve = { ...this._curveInput, radiusM: SUN_ARC_RADIUS_M * this._sunArcScale() };
        return renderDayCurve(this._renderer.camera, curve, sun);
    }

    //Home prism colour, driven by the card's active chip: `color` is the chip's accent. `animate` plays the
    //squash/grow on a chip change; an instant set is used for same-chip scrubs.
    public setHomeAppearance(color: string, animate: boolean): void
    {
        if (!this._renderer)
        {
            return;
        }
        if (animate)
        {
            this._renderer.animateHomeTo(color);
        }
        else
        {
            this._renderer.setHome(color);
        }
    }

    //No zoom in the 2.5D renderer (the camera sits at one fixed altitude); return a fixed constant so the
    //sun-arc-scale memo key keeps a stable value.
    public getCameraZoom():    number { return 18; }


    _autoRotateRaf?:           number;
    _autoRotateLastFrame = 0;
    _autoRotateLastUserAction = 0;
    //Bearing integrated in our own float; round-tripping through getCameraBearing() would quantise the
    //sub-degree increment into jitter.
    private _autoRotateBearing?: number;

    //Time-based auto-orbit around the home, counter to the sun's apparent motion so camera and sun visually
    //counter-orbit. Idempotent rAF loop integrating in seconds (delta-time) so speed is constant across
    //refresh rates; pauses for AUTO_ROTATE_INACTIVITY_MS after every user gesture, then resumes from the
    //camera's current bearing. Self-terminates when the renderer goes away or rotation is disabled;
    //updateConfig re-arms it when the toggle/lock flips back.
    private _startAutoRotateLoop(): void
    {
        if (this._autoRotateRaf !== undefined || !this._renderer)
        {
            return;
        }
        this._autoRotateLastFrame      = performance.now();
        this._autoRotateLastUserAction = 0;
        this._autoRotateBearing        = this._renderer.getCameraBearing();

        const tick = (t: number): void =>
        {
            const renderer = this._renderer;
            if (!renderer)
            {
                this._autoRotateRaf = undefined;
                return;
            }
            //Stop integrating while paused: an off-screen card is not throttled by rAF (only hidden tabs are),
            //so the loop would keep forcing full repaints. setPaused(false) restarts the loop.
            if (this._paused)
            {
                this._autoRotateRaf = undefined;
                return;
            }
            const dt = Math.max(0, t - this._autoRotateLastFrame) / 1000;
            this._autoRotateLastFrame = t;

            const sinceUser = Date.now() - this._autoRotateLastUserAction;
            //Defaults OFF: rotation is opt-in (it can distract and, in scrub mode, blurs "did the camera
            //move or did time pass?"). camera-locked also suppresses it.
            const autoRotateEnabled = this.cfg['auto-rotate-enabled'] === true;
            const cameraLocked      = this.isCameraLocked();
            if (!autoRotateEnabled || cameraLocked)
            {
                this._autoRotateRaf = undefined;
                return;
            }
            if (sinceUser >= AUTO_ROTATE_INACTIVITY_MS)
            {
                //Negative delta: bearing decreases (camera CCW), map content drifts CW, opposite the sun.
                //Re-sync from the live camera right when the user stops, else a mid-loop drag snaps back.
                if (this._autoRotateBearing === undefined || sinceUser - AUTO_ROTATE_INACTIVITY_MS < 16)
                {
                    this._autoRotateBearing = renderer.getCameraBearing();
                }
                this._autoRotateBearing -= AUTO_ROTATE_DEG_PER_SEC * dt;
                renderer.setCameraBearing(this._autoRotateBearing);
            }
            else
            {
                //While paused, track the live camera so a resume picks up from the edited pose.
                this._autoRotateBearing = renderer.getCameraBearing();
            }
            this._autoRotateRaf = requestAnimationFrame(tick);
        };
        this._autoRotateRaf = requestAnimationFrame(tick);
    }

    //Single-pointer drag-rotate (left-click on desktop, one-finger drag on touch). Bound to the renderer's
    //container element.
    private _dragRotateHandlers?: {
        canvas:      HTMLElement;
        onDown:      (e: PointerEvent) => void;
        onMove:      (e: PointerEvent) => void;
        onEnd:       (e: PointerEvent) => void;
        onDragStart: (e: Event) => void;
    };


    //Building lifecycle: LOCATION drives the FETCH, OPTIONS drive the INTERPRET. _buildingsRaw holds the
    //option-independent footprints fetched once at the max radius (the home doesn't move during a session,
    //so fetch once and reuse across style reloads); _buildingsLocKey is the location key they were fetched
    //for. _buildingsData is the INTERPRETED Building[] the renderer draws, recomputed in memory on every
    //option change with no re-fetch.
    private _buildingsData:   Building[] | null    = null;
    private _buildingsRaw:    RawBuilding[] | null = null;
    //True once a fetch for the current location has settled (data, empty, or outage). Before that, the scene shows
    //no buildings at all rather than the fallback house: the fallback is for a genuine "no data" outcome, not the
    //brief loading window before OpenFreeMap answers.
    private _buildingsFetchDone            = false;
    private _buildingsLocKey               = '';
    //One-shot prism-rise guard (plays once the first time footprints land).
    private _grown = false;
    //Editor-preview mode: HA rebuilds the preview card on every keystroke, so intro animations are skipped.
    private readonly _editMode: boolean;
    private _buildingsAbort?: AbortController;

    //Pending re-attempt after a total buildings-fetch outage (cleared on re-fetch and teardown).
    private _buildingsRetryTimer?: number;

    //Cache of the 96 per-day sun-arc samples. Sun position + clear-sky irradiance depend only on the day
    //and cloud cover, not the map matrix, so the heavy trig recomputes only when those change; every
    //transform tick just re-projects the cached tuples. Invalidated on day-roll or >1% cloud shift.
    private _arcInputsCache?: {
        dayStartMs: number;
        cloudPctInt: number;
        //Sun-arc scale baked into the points below (x100, rounded). In the key so a resize/zoom rebuilds
        //the arc at the new size.
        scaleKey: number;
        samples: ({
            lon: number;
            lat: number;
            altitudeM: number;
            altitudeDeg: number;
            azimuthDeg: number;
            wm2: number;
            belowHorizon: boolean;
        } | null)[];
    };
    //Per-(canvas, zoom) memo for _sunArcScale so the 8-direction projection probe runs once per size/zoom
    //change, not per arc sample per frame. Bearing/pitch invariant, so auto-rotation never refreshes it.
    private _arcScaleMemo?: { w: number; h: number; zoom: number; scale: number };

    constructor(
        container:    HTMLElement,
        config:       HeliosConfig,
        haCoords:     [number, number],
        haElevation?: number,
        editMode      = false,
        cacheKey      = ''
    )
    {
        this.homeLat = haCoords[1];
        this.homeLon = haCoords[0];
        this.homeElevation = (typeof haElevation === 'number' && Number.isFinite(haElevation))
            ? haElevation
            : undefined;
        this.cfg      = { ...config };
        this._editMode = editMode;
        //Set before _initMapInstance: the renderer reads the stored camera pose (keyed on cacheKey) at boot.
        this.cacheKey = cacheKey;

        this._fetchLat = this.homeLat;
        this._fetchLon = this.homeLon;

        //Create the map immediately regardless of container size: in some layouts (Masonry) neither the
        //ResizeObserver nor the IntersectionObserver fires, so deferring until one reports "ready" would
        //leave the map null. The post-load resize handling covers any 0x0-at-init case.
        this._initMapInstance(container);
    }

    private _initMapInstance(container: HTMLElement): void
    {
        //Spin up the renderer. It builds its own DOM (ground holder + scene SVG) inside the container, owns
        //the SceneCamera every projection routes through, and paints cast shadows + extruded buildings itself.
        //The shadow colour/opacity is merged into its palette.
        this._container = container;
        this._renderer = new SceneRenderer(container, {
            shadow:        '#000000',
            shadowOpacity: this._shadowOpacity(),
        });
        this._renderer.setCameraBearing(this._initialBearing());
        this._renderer.setCameraPitch(this._initialPitch());
        this._resolvePalette();

        //Re-project the card's HUD (arc, chips, leaders) on every renderer paint so the overlays stay glued
        //to the rotating basemap. The renderer fires onAfterDraw after each frame's paint.
        this._renderer.onAfterDraw = () =>
        {
            this.onMapTransform?.();
        };

        //Keep the cached CSS dims (they feed _heliosScale()/_sunArcScale() + the HUD layout) and the arc-scale
        //memo fresh on a real size change. The renderer owns the resize->redraw itself, so we don't redraw
        //here. Guarded on size change: a redraw repaints the HUD, which writes DOM, which can re-fire the
        //observer, and without the guard that no-op notification would loop.
        this._resizeObserver = new ResizeObserver(entries =>
        {
            const cr = entries[entries.length - 1]?.contentRect;
            if (!cr) { return; }
            const w = Math.round(cr.width);
            const h = Math.round(cr.height);
            if (w === this._obsW && h === this._obsH) { return; }
            this._obsW = w;
            this._obsH = h;
            this._cachedCanvasCssW = cr.width  || this._cachedCanvasCssW;
            this._cachedCanvasCssH = cr.height || this._cachedCanvasCssH;
            this._arcScaleMemo = undefined;
        });
        this._resizeObserver.observe(container);
        //Seed the cached dims so the first HUD layout isn't zero before the observer fires.
        this._cachedCanvasCssW = container.clientWidth  || this._cachedCanvasCssW;
        this._cachedCanvasCssH = container.clientHeight || this._cachedCanvasCssH;

        //Bootstrap the basemap + initial scene asynchronously, then mark ready and feed sun/buildings.
        this._bootstrapRenderer();

        //Custom drag-rotate. Bound to the container (the renderer's host). touch-action stays pan-y so a ONE-finger
        //swipe still scrolls the dashboard page over the card, untouched and instant.
        //
        //Rotation is left-click on a pointer device, and ONE finger on touch, locked to its direction.
        //
        //A finger going down means nothing on its own: rotate and scroll start identically. Two earlier answers
        //both failed on that. A press-hold timer could not tell them apart either - hold too briefly and the card
        //scrolled away under you, hold long enough and the scroll you wanted was swallowed. Two fingers were
        //unambiguous but asked for a gesture nobody makes over a dashboard.
        //
        //The finger already says which, by its DIRECTION: sideways is a turn, up and down is the page. So the
        //first few pixels decide, and after that the gesture is committed and cannot flip. pan-y makes the
        //browser the referee rather than us: it keeps vertical panning for itself and hands us the horizontal, so
        //a scroll is instant and untouched, and a turn never has to be stolen back with preventDefault.
        //
        //The lock says who OWNS the gesture, not which axis may move. Once a turn has won it, dy tilts as it does
        //on the mouse: the vertical was only ever ambiguous at the first pixel.
        container.style.touchAction = 'pan-y';
        //Firefox starts a native text/image drag on a left-mouse press over the canvas, which swallows the follow-up
        //pointermove stream so the scene never rotates (Chrome is lenient). Suppressing selection + the drag default
        //(preventDefault in onDown below) keeps the gesture ours.
        container.style.userSelect = 'none';
        (container.style as unknown as { webkitUserSelect: string }).webkitUserSelect = 'none';

        const ROTATE_SENSITIVITY_DEG_PER_PX = 0.35;
        //Vertical drag drives pitch (down = flatter, up = bird's-eye). Bounds from the module CAMERA_PITCH_*
        //constants so this stays in sync with every other pitch entry point.
        const PITCH_SENSITIVITY_DEG_PER_PX = 0.30;

        //Pixels of travel before a touch gesture is judged. Long enough that a fingertip's wobble on touchdown
        //cannot decide it, short enough that the turn starts before the movement reads as ignored.
        const TOUCH_DIRECTION_LOCK_PX = 8;

        let dragRotating = false;
        let lastX        = 0;
        let lastY        = 0;
        //Pointer device (mouse / pen): the single pointer that owns the drag.
        let activeId: number | null = null;
        //Touch: the finger down and where it landed, until its direction is judged. `verdict` is null while still
        //undecided; once it is in, it holds for the rest of the gesture - a turn that drifts upward must not stall,
        //and a scroll that drifts sideways must not snatch the page back.
        let touchId: number | null = null;
        let touchStartX = 0;
        let touchStartY = 0;
        let verdict: 'rotate' | 'page' | null = null;

        //One drag step, from wherever the gesture last was to where it is now. Shared by mouse and touch, so the
        //two can never drift apart in direction or sensitivity.
        //One drag step, from wherever the gesture last was to where it is now. Shared by mouse and touch, so the
        //two can never drift apart in direction or sensitivity. `pitch` is off only while a touch gesture is still
        //being judged.
        const applyDrag = (x: number, y: number, pitch: boolean): void =>
        {
            if (!this._renderer) { return; }
            const dx = x - lastX;
            const dy = y - lastY;
            lastX = x;
            lastY = y;
            this._autoRotateLastUserAction = Date.now();
            //Drag right turns the scene with the gesture (negate dx: +dx read inverted on the canvas plane).
            this._renderer.setCameraBearing(this._renderer.getCameraBearing() - dx * ROTATE_SENSITIVITY_DEG_PER_PX);
            if (!pitch) { return; }
            //Subtract dy so drag up flattens pitch, drag down goes bird's-eye; clamped to session bounds.
            const nextPitch = Math.max(CAMERA_PITCH_MIN_DEG, Math.min(CAMERA_PITCH_MAX_DEG,
                this._renderer.getCameraPitch() - dy * PITCH_SENSITIVITY_DEG_PER_PX));
            this._renderer.setCameraPitch(nextPitch);
        };

        const onDown = (e: PointerEvent) =>
        {
            //The camera lock pins the scene pose. Re-checked per pointerdown so a toggle disengages immediately.
            if (this.isCameraLocked())
            {
                return;
            }
            if (e.pointerType === 'touch')
            {
                //A second finger is not ours: leave the first one's verdict alone rather than fight over it.
                if (touchId !== null) { return; }
                touchId     = e.pointerId;
                touchStartX = e.clientX;
                touchStartY = e.clientY;
                lastX       = e.clientX;
                lastY       = e.clientY;
                //Nothing is claimed yet, and no preventDefault: the page keeps its scroll until the direction says
                //otherwise.
                verdict = null;
                return;
            }
            //Mouse: left button only.
            if (e.pointerType === 'mouse' && e.button !== 0)
            {
                return;
            }
            if (activeId !== null)
            {
                return;
            }
            activeId = e.pointerId;
            lastX    = e.clientX;
            lastY    = e.clientY;
            this._autoRotateLastUserAction = Date.now();
            //Rotate immediately. Claim the gesture: stop Firefox's native drag/selection so the pointermove stream
            //keeps coming.
            e.preventDefault();
            dragRotating = true;
            try { container.setPointerCapture(e.pointerId); }
            catch (_) { /* pointer capture unsupported on this element */ }
        };

        const onMove = (e: PointerEvent) =>
        {
            if (e.pointerType === 'touch')
            {
                if (e.pointerId !== touchId) { return; }
                if (verdict === null)
                {
                    const dx = e.clientX - touchStartX;
                    const dy = e.clientY - touchStartY;
                    if (Math.hypot(dx, dy) < TOUCH_DIRECTION_LOCK_PX) { return; }
                    verdict = Math.abs(dx) > Math.abs(dy) ? 'rotate' : 'page';
                    if (verdict === 'page')
                    {
                        //The page's gesture. Stand down for the rest of it, and let pan-y scroll as if the card
                        //were not interactive at all.
                        touchId = null;
                        return;
                    }
                    //Seat the drag on the point the verdict was reached, not on the touchdown: the lock distance
                    //has already been travelled and replaying it would jump the scene.
                    lastX = e.clientX;
                    lastY = e.clientY;
                    dragRotating = true;
                    this._autoRotateLastUserAction = Date.now();
                    return;
                }
                if (!dragRotating) { return; }
                //Both axes, now that the verdict is in. The vertical is only ambiguous at the START of a gesture,
                //where a turn and a scroll look alike; past the lock the browser has passed on this one and it is
                //ours, so there is nothing left for dy to fight over. It it changes its mind, pointercancel lands
                //on onEnd and we stand down.
                applyDrag(e.clientX, e.clientY, true);
                return;
            }
            if (e.pointerId !== activeId || !dragRotating) { return; }
            e.preventDefault();
            applyDrag(e.clientX, e.clientY, true);
        };

        const onEnd = (e: PointerEvent) =>
        {
            if (e.pointerType === 'touch')
            {
                if (e.pointerId !== touchId) { return; }
                touchId = null;
                verdict = null;
                //Also covers pointercancel, which is how the browser tells us it has taken the gesture for its own
                //scroll: the finger is no longer ours either way.
                if (dragRotating)
                {
                    dragRotating = false;
                    this.persistCameraPose();
                }
                return;
            }
            if (e.pointerId !== activeId) { return; }
            const wasRotating = dragRotating;
            dragRotating = false;
            activeId     = null;
            try { container.releasePointerCapture(e.pointerId); }
            catch (_) { /* pointer capture may already be released */ }
            //Persist the pose only if a rotation actually happened, so a plain click leaves storage untouched.
            if (wasRotating)
            {
                this.persistCameraPose();
            }
        };

        //Firefox starts a native drag on a left-mouse press over the canvas/SVG and, once it does, stops delivering
        //the pointermove stream, so the scene freezes mid-drag. preventDefault in onDown is not always enough there;
        //cancelling `dragstart` outright (it bubbles up from whatever child the press landed on) is what reliably
        //keeps the gesture ours. Harmless in Chromium, which never starts the drag here anyway.
        const onDragStart = (e: Event): void => { e.preventDefault(); };
        container.addEventListener('pointerdown',   onDown);
        container.addEventListener('pointermove',   onMove);
        container.addEventListener('pointerup',     onEnd);
        container.addEventListener('pointercancel', onEnd);
        container.addEventListener('dragstart',     onDragStart);
        this._dragRotateHandlers = { canvas: container, onDown, onMove, onEnd, onDragStart };

        this._refreshWeather();
        //The terrain horizon gets its own initial kick (weather has several triggers, the horizon only re-fetches
        //on a real home change), but deferred to _onRendererReady so it lands after the first paint, off the
        //cold-start burst.
    }

    //Async bootstrap: resolve the basemap for the home, then mark ready, feed buildings + sun, and kick off
    //the periodic atmosphere refresh + auto-rotate loop.
    private async _bootstrapRenderer(): Promise<void>
    {
        const renderer = this._renderer;
        if (!renderer)
        {
            return;
        }
        try
        {
            await renderer.setLocation(this.homeLat, this.homeLon, this._groundStyle());
        }
        catch (_err)
        {
            //Basemap load failed (tiles or network): the scene still renders without the tiled ground.
        }
        //The engine may have been torn down while the basemap resolved.
        if (this._renderer !== renderer)
        {
            return;
        }
        this._onRendererReady();
    }

    //Arm the 60 s sky/atmosphere refresh, clearing any existing timer first so it never double-arms.
    //_refreshShadowsAndAtmosphere short-circuits when the sun barely moved, so the cost is negligible; the
    //paused skip avoids even that signature check while the card is invisible.
    private _startSkyTimer(): void
    {
        window.clearInterval(this._skyTimer);
        this._skyTimer = window.setInterval(() =>
        {
            if (this._paused)
            {
                return;
            }
            this._refreshShadowsAndAtmosphere();
        }, 60_000);
    }

    //Called once the renderer's basemap has resolved: feeds the (possibly already-cached) buildings, paints
    //the first atmosphere pass, arms the sky refresh + auto-rotate loop, and renders the current selection.
    private _onRendererReady(): void
    {
        if (!this._renderer)
        {
            return;
        }
        this._mapReady = true;

        //Push any buildings already in hand (shared cache) and start the background fetch otherwise.
        this._applyBuildings();
        this._ensureBuildings();

        this._lastAtmosphereAlt = -999;
        this._refreshShadowsAndAtmosphere();
        this._startSkyTimer();

        this._startAutoRotateLoop();

        //Paint the scene as soon as the renderer is ready, weather or not: the sun arc, home, buildings and the day
        //curve need none of it, and _renderForCurrentSelection already falls back to Haurwitz when the forecast is
        //absent. Waiting on _homeHourlyData left the whole scene blank through a slow / rate-limited weather fetch
        //whenever auto-rotate was off (nothing else repaints). Weather repaints on arrival, gated by sunSceneEq.
        this._renderForCurrentSelection();

        //Deferred horizon kick: a beat past the first paint so its elevation requests never burst into the
        //cold-start weather + tile + building fetches. Skipped if a profile already resolved (cache hit).
        if (!this._horizonProfile)
        {
            window.clearTimeout(this._horizonTimer);
            this._horizonTimer = window.setTimeout(
                () => { if (this._renderer) { this._refreshHorizon(this.homeLat, this.homeLon); } },
                HORIZON_INITIAL_DELAY_MS);
        }
    }

    //The card-side host element (#map-container) the renderer mounts into; carries the cascaded HA theme CSS
    //custom properties the scene palette resolves from. The basemap's light/dark is handled by card CSS, so
    //the engine itself does not track theme polarity.
    private _container?: HTMLElement;

    //Resolve a stored map colour (a ui_color token or a raw #hex / rgb()) to a paintable colour.
    private _resolveMapColor(value: string, fallback: string): string
    {
        return resolveUiColor(this._container, value, fallback);
    }

    //The vector basemap style for the active config: 'auto' follows the HA theme, 'dark'/'light' force a
    //polarity, 'custom' takes the per-layer colours + visibility (seeded off the theme default for unset keys).
    private _groundStyle(): GroundStyle
    {
        const isDark = this._container ? isDarkFromCss(this._container) : false;
        const mode   = mapThemeMode(this.cfg);
        if (mode === 'custom')
        {
            const base    = defaultGroundPalette(isDark);
            const palette  = { ...base };
            const hidden   = new Set<GroundLayerKey>();
            for (const key of GROUND_LAYER_KEYS)
            {
                const raw = mapLayerColor(this.cfg, key);
                if (raw) { palette[key] = this._resolveMapColor(raw, base[key]); }
                if (!mapLayerVisible(this.cfg, key)) { hidden.add(key); }
            }
            return { palette, hidden };
        }
        const dark = mode === 'dark' ? true : mode === 'light' ? false : isDark;
        return { palette: defaultGroundPalette(dark), hidden: new Set<GroundLayerKey>() };
    }

    //Push the full scene palette to the renderer from the live HA theme tokens + the building-opacity
    //config. Re-run on init and on every theme flip.
    private _resolvePalette(): void
    {
        this._renderer?.setPalette({
            home:            cssHex(this._container, '--energy-grid-consumption-color', '#488fc2'),
            neighbor:        this._buildingColor(),
            shadow:          cssHex(this._container, '--shadow-color', '#000000'),
            shadowOpacity:   this._shadowsEnabled() ? this._shadowOpacity() : 0,
            neighborOpacity: this._buildingOpacity(),
        });
        //Repaint the vector ground for the current theme (cached features, no re-fetch).
        this._renderer?.setGroundStyle(this._groundStyle());
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


    //Resolve weather variables at a given time from the home location. Source: _homeHourlyData; the pure
    //lookup lives in engine/weather-resolve (null returns the empty sentinel so timeline ramps render flat,
    //shortwave = -1 means no model value this hour and the caller falls back to Haurwitz).
    private _getWeatherAtTime(t: Date): {
        cloudCover:     number;
        cloudLow:       number;
        cloudMid:       number;
        cloudHigh:      number;
        shortwave:      number;
        precip:         number;
        snowfall:       number;
        weatherCode:    number;
        temperature:    number;
        humidity:       number;
    }
    {
        const w = resolveWeatherAtTime(this._homeHourlyData, t);
        //Local-sensor overrides beat the model for the live + past window; forecast time falls through (the
        //nearest-neighbour lookup returns null beyond its window). Cloud also feeds the Haurwitz irradiance/PV
        //fallback, so a local cloud sensor sharpens that too.
        if (this._weatherOverrideSamples.size > 0)
        {
            const cloud = this._weatherOverrideAt('cloudCover',  t); if (cloud !== null) { w.cloudCover  = Math.max(0, Math.min(100, cloud)); }
            const prec  = this._weatherOverrideAt('precip',      t); if (prec  !== null) { w.precip      = Math.max(0, prec); }
            const snow  = this._weatherOverrideAt('snowfall',    t); if (snow  !== null) { w.snowfall    = Math.max(0, snow); }
            const temp  = this._weatherOverrideAt('temperature', t); if (temp  !== null) { w.temperature = temp; }
            const hum   = this._weatherOverrideAt('humidity',    t); if (hum   !== null) { w.humidity    = Math.max(0, Math.min(100, hum)); }
            const code  = this._weatherOverrideAt('code',        t); if (code  !== null) { w.weatherCode = Math.round(code); }
        }
        return w;
    }

    //Public wrapper for _getTimeRange so the card's 30 s tick can re-fetch the window after midnight rollover.
    public getTimelineRange(): { start: Date; end: Date } | null
    {
        return this._getTimeRange();
    }

    //Active rolling-window span (days past/future around today). Undefined until setPeriodDays() pushes the
    //card's mode-resolved values; _getTimeRange falls back to a safe default so the window is sane before then.
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
        const pastDays   = this._periodPastDays   ?? 2;
        const futureDays = this._periodFutureDays ?? 1;
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const visibleStartMs = today0.getTime() - pastDays * DAY_MS;
        //End at the midnight after the last future day so the axis spans futureDays full days plus today.
        const visibleEndMs   = today0.getTime() + (futureDays + 1) * DAY_MS;

        //The axis is exactly the configured span. Weather traces may not reach the far past, but the
        //recorder-backed curves span the whole window so a 30-day period really shows 30 days.
        return { start: new Date(visibleStartMs), end: new Date(visibleEndMs) };
    }

    private _renderForCurrentSelection(): void
    {
        //Only the renderer is required: _getWeatherAtTime returns zero defaults when _homeHourlyData is null,
        //so sun position/arc/tooltip still update when Open-Meteo is down (cloud/irradiance fall back to Haurwitz).
        if (!this._renderer)
        {
            return;
        }

        const t = this._selectedTime ?? new Date();
        const w = this._getWeatherAtTime(t);

        //Compute every irradiance candidate; priority sensor > shortwave > Haurwitz (see IrradianceSource).
        //These are ground-horizontal (GHI): the scene shows irradiance, not per-panel production (that comes
        //measured from the recorder, and modelled by the Helios-Forecast integration).
        const pvPowerHaurwitz = computePvPercent(t, this.homeLat, this.homeLon, w.cloudCover);

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
            precip:           w.precip,
            snowfall:         w.snowfall,
            weatherCode:      w.weatherCode,
            temperature:      w.temperature,
            humidity:         w.humidity,
            timeRange:        this._getTimeRange(),
            isLiveTime:       this._selectedTime === null,
            pvPower,
            pvPowerHaurwitz,
            pvPowerShortwave,
            irradianceSource,
        });
    }

    //Global display radius from the display-radius slider (50-500 m, default 200); the buildings fetch +
    //shadow fade band both derive their boundary from it, so geometry stops at one consistent edge.
    private _buildingRadiusMeters(): number
    {
        return displayRadiusM(this.cfg);
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

    //Building base tint: the configured ui_color token resolved to #rrggbb off the live theme (canvas
    //drawing needs a concrete hex, not a CSS var). Shared by the renderer palette and the diagnostics
    //snapshot, so a building-colour change re-tints via _resolvePalette without a refetch.
    private _buildingColor(): string
    {
        return resolveUiColor(this._container, buildingColorToken(this.cfg), '#9e9e9e', 'grey');
    }

    //Location-keyed key for the raw fetch + shared cache. Options are deliberately absent: a building-option
    //change keeps the same key, so it never triggers a re-fetch, only a re-interpret.
    private _buildingsLocationKey(): string
    {
        return `${this.homeLat.toFixed(6)}|${this.homeLon.toFixed(6)}`;
    }

    //Ensure the raw footprints for the current LOCATION are in hand, then interpret + render them. Re-fetches
    //the tiles only when the home location changed; a pure option change finds the raw data already present
    //and just re-interprets via _applyBuildings (no network).
    private _ensureBuildings(): void
    {
        if (!this._renderer)
        {
            return;
        }
        const locKey = this._buildingsLocationKey();

        //Same location, raw already in hand: just re-interpret with the current options (no fetch).
        if (this._buildingsRaw && this._buildingsLocKey === locKey)
        {
            this._applyBuildings();
            return;
        }

        //Shared-cache short-circuit: a fresh engine after an editor commit reuses the raw footprints another
        //engine already fetched for this location (the localStorage cache lives in engine/buildings.ts).
        const sharedRaw = sharedBuildingsCacheGet(locKey);
        if (sharedRaw)
        {
            this._buildingsRaw       = sharedRaw;
            this._buildingsFetchDone = true;
            this._buildingsLocKey    = locKey;
            this._applyBuildings();
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
            return;
        }

        //Abort any in-flight request so a rapid location change doesn't race a stale fetch into the
        //sources, and drop any pending outage re-attempt: this call IS the fresh attempt.
        this._buildingsAbort?.abort();
        this._clearBuildingsRetry();
        const ac = new AbortController();
        this._buildingsAbort = ac;

        fetchRawBuildings(this.homeLat, this.homeLon, ac.signal)
        .then(result =>
        {
            if (ac.signal.aborted || !this._renderer)
            {
                return;
            }
            //Null = the tile fetch failed entirely. The location stays UNCLAIMED (no raw, no shared cache) so a
            //later pass re-fetches. Mark the fetch settled and interpret, so the fallback house now shows (a
            //genuine outage) until a re-attempt heals it, instead of an empty scene.
            if (result === null)
            {
                this._buildingsFetchDone = true;
                this._scheduleBuildingsRetry();
                this._applyBuildings();
                return;
            }
            this._buildingsRaw       = result;
            this._buildingsFetchDone = true;
            this._buildingsLocKey    = locKey;
            _sharedBuildingsCache.set(locKey, { data: result, ts: Date.now() });
            this._applyBuildings();
            //Buildings just arrived; bypass the "sun hardly moved" guard so the next call repaints a full
            //pass (the renderer re-extrudes + re-casts shadows from the new footprints).
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
        })
        .catch(() =>
        {
            //Buildings fetch failed or was aborted on teardown: the scene renders without 3D buildings.
        });
    }


    //Editor "force building download": drop every cache layer for the current location (persisted raw,
    //shared module cache, in-memory raw) and re-fetch right away, bypassing any pending outage retry.
    public forceBuildingsRefetch(): void
    {
        clearBuildingsLocationCache(this.homeLat, this.homeLon);
        _sharedBuildingsCache.delete(this._buildingsLocationKey());
        this._buildingsRaw       = null;
        this._buildingsFetchDone = false;
        this._buildingsLocKey    = '';
        this._clearBuildingsRetry();
        this._ensureBuildings();
    }


    private _scheduleBuildingsRetry(): void
    {
        if (this._buildingsRetryTimer !== undefined)
        {
            return;
        }
        this._buildingsRetryTimer = window.setTimeout(() =>
        {
            this._buildingsRetryTimer = undefined;
            if (this._renderer)
            {
                this._ensureBuildings();
            }
        }, BUILDINGS_REFETCH_DELAY_MS);
    }


    private _clearBuildingsRetry(): void
    {
        if (this._buildingsRetryTimer !== undefined)
        {
            window.clearTimeout(this._buildingsRetryTimer);
            this._buildingsRetryTimer = undefined;
        }
    }

    //Interpret the raw footprints with the CURRENT options (radius/count/real-size/height/cluster) and hand
    //the result to the renderer (it extrudes home + surroundings and casts their shadows itself). Pure +
    //cheap, so this is the re-render path for every building-option change (no tile round-trip).
    private _applyBuildings(): void
    {
        if (!this._renderer)
        {
            return;
        }
        //Loading window: no fetch has settled yet, so draw NO buildings rather than the fallback house. Once a
        //fetch resolves (data, empty, or outage) the normal interpret runs and the fallback appears only if there
        //genuinely is no data.
        if (this._buildingsRaw === null && !this._buildingsFetchDone)
        {
            this._buildingsData = [];
            this._pushRenderableSources();
            return;
        }
        this._buildingsData = interpretBuildings(this._buildingsRaw ?? [], {
            radiusM:        this._buildingRadiusMeters(),
            count:          buildingCount(this.cfg),
            realSize:       buildingRealSize(this.cfg),
            fixedHeightM:   buildingFixedHeightM(this.cfg),
            clusterRadiusM: this._buildingClusterRadiusMeters(),
        });
        this._pushRenderableSources();
    }

    //Hand the interpreted footprints to the renderer. `buildings` is empty during the loading window (no fetch
    //settled yet) and otherwise carries at least the fallback house.
    private _pushRenderableSources(): void
    {
        if (!this._renderer)
        {
            return;
        }
        const buildings = this._buildingsData ?? [];
        this._renderer.setBuildings(buildings);
        //Play the prism rise once, the first time footprints land. Skipped in edit/preview mode (the renderer
        //defaults to full height) so the editor's per-keystroke card rebuild doesn't replay it.
        if (buildings.length && !this._grown)
        {
            this._grown = true;
            if (!this._editMode)
            {
                this._renderer.animateGrowth();
            }
        }
    }


    //Drive the renderer's sun position for the current (live or scrubbed) time. The renderer paints the
    //building face shading and cast shadows itself from this azimuth/altitude via one setter, and the ground
    //re-tints through the graded day/night palette. The >=1.5° altitude throttle (~6 min of motion) avoids needless redraws.
    private _refreshShadowsAndAtmosphere(): void
    {
        if (!this._renderer)
        {
            return;
        }

        const t   = this._selectedTime ?? new Date();
        const sun = getSunPosition(t, this.homeLat, this.homeLon);
        const { altitude, azimuth } = sun;

        if (Math.abs(altitude - this._lastAtmosphereAlt) < 1.5)
        {
            return;
        }
        this._lastAtmosphereAlt = altitude;

        //Master shadow toggle: collapse shadow opacity to 0 when shadows are disabled, else the configured
        //value. The renderer multiplies this into every cast-shadow polygon.
        this._renderer.setPalette({
            shadowOpacity: this._shadowsEnabled() ? this._shadowOpacity() : 0,
        });
        this._renderer.setSun(azimuth, altitude);

        //Day/night colour grade on the vector ground, in coarser altitude steps than the wash above: re-tinting
        //the whole basemap re-rasterises it, so it updates every few degrees while the cheap wash stays smooth.
        if (Math.abs(altitude - this._lastGroundAlt) >= 4)
        {
            this._lastGroundAlt = altitude;
            this._renderer.setGroundAltitude(altitude);
        }
    }

    private async _refreshWeather(lat?: number, lon?: number): Promise<void>
    {
        const fLat = lat ?? this.homeLat;
        const fLon = lon ?? this.homeLon;

        this._fetchAbortController?.abort();
        this._fetchAbortController = new AbortController();
        const signal = this._fetchAbortController.signal;

        this._clearWeatherTimer();

        try
        {
            //Single home-point fetch (with elevation): the only weather source; surroundings reuse the series.
            //Precision is fixed to 'high' (multi-model median); no config toggle selects 'standard'.
            const precision = 'high' as const;
            this._homeHourlyData = await fetchHomePointData(
                fLat, fLon, this.homeElevation, precision, signal
            );
            this._renderForCurrentSelection();

            //Success: reset both back-off streaks.
            this._rateLimitStreak  = 0;
            this._otherErrorStreak = 0;

            //Never re-arm while paused: a fetch launched before setPaused(true) can resolve after it, and an
            //unconditional re-arm here would resurrect the interval an off-screen card just stopped.
            if (this._selectedTime === null && !this._paused)
            {
                this._weatherTimer = window.setInterval(
                    () => this._refreshWeather(this._fetchLat, this._fetchLon),
                    WEATHER_REFRESH_INTERVAL_MS
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
                precip:           0,
                snowfall:         0,
                weatherCode:      0,
                temperature:      NaN,
                humidity:         NaN,
                timeRange:        this._getTimeRange(),
                isLiveTime:       this._selectedTime === null,
                pvPower:          0,
                pvPowerHaurwitz:  0,
                pvPowerShortwave: -1,
                irradianceSource: 'haurwitz',
            });

            //Paused mid-flight: emit the one fallback frame but schedule no retry timer (the finally still
            //runs). Un-pausing calls _refreshWeather again, which restarts the cycle from a clean slate.
            if (this._paused) { return; }

            let retryDelay: number;
            if (e.status === 429)
            {
                //Back-off slot for the current streak, capped at the last entry. setTimeout (not setInterval)
                //so exactly one retry fires: success resets the streak, another failure bumps it.
                const idx = Math.min(this._rateLimitStreak, RATE_LIMIT_BACKOFF_MS.length - 1);
                retryDelay = RATE_LIMIT_BACKOFF_MS[idx];
                this._rateLimitStreak++;

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
    }

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
    //Repaint the vector ground from its cached features. No network, no re-tiling: the geometry is already in
    //memory, this only re-runs the painter.
    //
    //Needed because the ground is a CANVAS painted ONCE, then only moved about by a CSS transform; the draw loop
    //never touches its pixels. Browsers are free to drop a canvas's backing store while a tab sits in the
    //background, and nothing here would ever put it back: the map came back blank while the SVG buildings, being
    //DOM, survived untouched. That is the exact shape of the "left it on a wall tablet and the basemap vanished"
    //report, and a wall tablet is precisely where a card sits idle for hours.
    public repaintGround(): void
    {
        this._renderer?.setGroundStyle(this._groundStyle());
    }

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
            //Restart the auto-rotate loop the tick stopped on pause (no-op via its own guard if still running).
            this._startAutoRotateLoop();
            this._startSkyTimer();
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

    //True once the camera has measured a real viewport. The HUD gates on it so its projections never centre
    //on the (0,0) seed (which would flash the whole HUD into the top-left for a frame).
    public isViewportReady(): boolean
    {
        return this._renderer?.camera.hasViewport ?? false;
    }

    //Move the home to new coordinates: re-tile the basemap, re-fetch the buildings + weather for the new
    //location, and re-cast shadows.
    public setHome(lat: number, lon: number): void
    {
        if (lat === this.homeLat && lon === this.homeLon)
        {
            return;
        }
        this.homeLat   = lat;
        this.homeLon   = lon;
        this._fetchLat = lat;
        this._fetchLon = lon;
        //Both arc caches bake the projection around the home: the scale probe and the per-sample sun points.
        //Drop them so the arc rebuilds at the new position instead of reusing the old location's geometry.
        this._arcScaleMemo   = undefined;
        this._arcInputsCache = undefined;
        void this._renderer?.setLocation(lat, lon, this._groundStyle());
        this._ensureBuildings();
        this._lastAtmosphereAlt = -999;
        this._refreshShadowsAndAtmosphere();
        void this._refreshWeather(lat, lon);
        //New location: fresh retry budget, and drop any pending initial/retry kick for the old one.
        window.clearTimeout(this._horizonTimer);
        this._horizonRetryCount = 0;
        this._refreshHorizon(lat, lon);
    }

    //Show / hide the drawn horizon ridge line (visual only). The sun gate keeps using the terrain either way, so
    //this just repaints with or without the crest.
    public setHorizonLineVisible(visible: boolean): void
    {
        if (visible === this._horizonLineVisible) { return; }
        this._horizonLineVisible = visible;
        this._renderForCurrentSelection();
    }

    //Resolve the terrain horizon for the home, off the render path. On success it stores the profile, drops the
    //arc-sample cache so belowHorizon recomputes against the relief, and repaints. Failure leaves the flat horizon.
    private _refreshHorizon(lat: number, lon: number): void
    {
        this._horizonAbort?.abort();
        this._horizonAbort = new AbortController();
        void fetchHorizonProfile(lat, lon, this._horizonAbort.signal).then((profile) =>
        {
            if (!profile)
            {
                //Cold-start Open-Meteo 429 or a network blip: retry a bounded few times, spaced out, so a transient
                //failure does not leave the flat horizon until the next home change / reload.
                if (this._renderer && this._horizonRetryCount < HORIZON_MAX_RETRIES)
                {
                    this._horizonRetryCount++;
                    window.clearTimeout(this._horizonTimer);
                    this._horizonTimer = window.setTimeout(
                        () => { if (this._renderer) { this._refreshHorizon(this.homeLat, this.homeLon); } },
                        HORIZON_RETRY_DELAY_MS);
                }
                return;
            }
            this._horizonRetryCount = 0;
            this._horizonProfile = profile;
            this._arcInputsCache = undefined;
            this._renderForCurrentSelection();
        });
    }

    //Local horizon elevation (deg) at an azimuth, or 0 (flat) when unresolved.
    private _horizonAt(azimuthDeg: number): number
    {
        return horizonAltAt(this._horizonProfile, azimuthDeg);
    }

    //Screen-space layout of the on-map readout chips and their leader lines. Returns positions (CSS px
    //relative to the canvas) for the cloud chip (outside the ring), PV chip, battery SoC/Power chips, the
    //grid chip, the ring edge (hemisphere-aware anchor direction for the cloud fill interp), and
    //the projected home point (chip-leader anchor / disc centre). Null when the map isn't ready (card skips
    //the overlay that frame).
    public projectHomeLabelLayout(): {
        pvLabel:      { x: number; y: number };
        //Battery chip anchor, top of the right column.
        batteryLabel: { x: number; y: number };
        //Grid chip anchor: top-left, mirroring the battery chip on the right.
        gridLabel:    { x: number; y: number };
        //Four candidate group-chip anchors below the home: [top-left, bottom-left, top-right, bottom-right]. The
        //HUD controller uses these as geometry primitives (the two side columns + the two rows) and re-arranges
        //the actual chips dynamically by how many groups are active (see SceneHudController.render).
        groupLabels:  { x: number; y: number }[];
        home:         { x: number; y: number };
    } | null
    {
        if (!this._renderer)
        {
            return null;
        }

        const home = this._projectScenePoint(this.homeLon, this.homeLat, 0);
        if (!home)
        {
            return null;
        }

        //Chip cluster, organised into columns: PV anchored above the home, battery (SoC/Power) stacked on
        //the right, the grid chip on the left, so "what's in" and "what's stored/consumed" split.
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

        //The cluster centres on the home pill (the chips' orbit hub), lifted modestly off the ground point
        //so it sits over the building body; liftScale lets a kiosk canvas breathe.
        const CLUSTER_LIFT_PX = 28 * liftScale;
        const clusterY = home.y - CLUSTER_LIFT_PX;
        const pvX = home.x;
        //PV sits at exactly twice the home->battery vertical gap (battery is at CHIP_STACK_GAP_PX / 2 above the
        //home hub), so the PV->battery and battery->home leaders span proportional heights and their 90-degree
        //fillets open at the same angle.
        const pvY = clusterY - CHIP_STACK_GAP_PX;
        //Right column: the battery chip sits on top, pairing with PV overhead and owning the lead to the home.
        const batteryXRight     = home.x + CHIP_SIDE_X_OFFSET_PX;
        const batteryY          = clusterY - CHIP_STACK_GAP_PX / 2;
        //Left column: the grid chip sits on TOP, mirroring the battery chip on the right.
        const leftX             = home.x - CHIP_SIDE_X_OFFSET_PX;
        const gridY             = clusterY - CHIP_STACK_GAP_PX / 2;
        //Group-chip candidate anchors in the two rows below the home. Row 1 sits the SAME distance below the home
        //hub as grid/battery sit above it (CHIP_STACK_GAP_PX / 2), and row 2 is another half-gap below row 1. Same
        //left/right columns as grid/battery. The controller picks among these by active-group count.
        const groupRow1Y        = clusterY + CHIP_STACK_GAP_PX / 2;
        const groupRow2Y        = clusterY + CHIP_STACK_GAP_PX;

        return {
            pvLabel:      { x: pvX,           y: pvY      },
            batteryLabel: { x: batteryXRight, y: batteryY },
            gridLabel:    { x: leftX,         y: gridY    },
            groupLabels:  [
                { x: leftX,         y: groupRow1Y },  //slot 0: top-left
                { x: leftX,         y: groupRow2Y },  //slot 1: bottom-left
                { x: batteryXRight, y: groupRow1Y },  //slot 2: top-right
                { x: batteryXRight, y: groupRow2Y },  //slot 3: bottom-right
            ],
            home:         { x: home.x,        y: clusterY },
        };
    }

    //Cached container CSS dimensions, fed by the ResizeObserver. Drives _heliosScale()/_sunArcScale() and
    //the HUD layout without re-reading clientWidth (which would force a layout flush mid-frame).
    private _cachedCanvasCssW = 0;
    private _cachedCanvasCssH = 0;


    //Horizontal chip-cluster spread ramp (MAX 1.6); the pure ramp math lives in engine/hud-layout.
    private _heliosScale(): number
    {
        const minDim = Math.min(this._cachedCanvasCssW || Infinity, this._cachedCanvasCssH || Infinity);
        return clusterScaleRamp(minDim, 1.6);
    }
    //Steeper vertical-lift ramp (MAX 2.4 vs _heliosScale's 1.6) so the chip->home leader keeps pace with
    //canvas growth and the home stays anchored low. Same FLOOR/TOP breakpoints so transitions hinge together.
    private _clusterLiftScale(): number
    {
        const minDim = Math.min(this._cachedCanvasCssW || Infinity, this._cachedCanvasCssH || Infinity);
        return clusterScaleRamp(minDim, 2.4);
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
        //No zoom under the 2.5D renderer; the constant getCameraZoom() keeps the memo key stable.
        const zoom = this._renderer ? this.getCameraZoom() : -1;

        const memo = this._arcScaleMemo;
        if (memo && memo.w === w && memo.h === h && memo.zoom === zoom)
        {
            return memo.scale;
        }

        let scale = steppedArcScale(minDim);
        if (this._renderer && Number.isFinite(minDim) && minDim > 0)
        {
            const D          = Math.PI / 180;
            const mPerDegLat = METRES_PER_DEGREE;
            const mPerDegLon = METRES_PER_DEGREE * Math.cos(this.homeLat * D);
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

    //Keystone projection: lon/lat/altitude -> screen px via the SceneCamera. Every card-facing projection
    //method (projectSunScene, projectHomeLabelLayout, getSunArcScale) routes through here. Coordinates are converted to local metres relative to
    //the home, then the camera's project3() returns {x, y, depth}. The camera basis is refreshed each frame
    //by the renderer's _draw (setViewport), so this is a cheap per-point transform with no per-frame cache.
    private _projectScenePoint(
        lon: number, lat: number, altitudeM: number
    ): { x: number; y: number; depth: number } | null
    {
        if (!this._renderer)
        {
            return null;
        }
        const perLat = METRES_PER_DEGREE;
        const perLon = METRES_PER_DEGREE * Math.cos(this.homeLat * Math.PI / 180);
        const east  = (lon - this.homeLon) * perLon;
        const north = (lat - this.homeLat) * perLat;
        return this._renderer.camera.project3(east, north, altitudeM);
    }

    //Screen-space layout of the solar arc, the sun's current position, and the incidence ray. Null until
    //ready. Each arc point carries the irradiance (W/m², live cloud applied uniformly across the day, a
    //simplification that stays reactive without a per-hour forecast) and a `nearness` in [0..1] (1 =
    //nearest depth) the card uses to scale segment thickness + sun-disc radius for a perspective ribbon.
    public projectSunScene(now: Date): {
        arc:      {
            x: number; y: number;
            altitude: number; nearness: number; belowHorizon: boolean;
        }[];
        sun:      { x: number; y: number; irradiance: number; altitude: number; azimuth: number; nearness: number };
        home:     { x: number; y: number };
        daylight: number;
        //Terrain-horizon ridge polyline (screen px), the relief silhouette under the sun path. Empty on flat
        //terrain or when the feature is off.
        ridge:    { x: number; y: number }[];
        //Horizon crossings on the day's arc, with local tangent angle (rad) so the card draws a ring
        //perpendicular to the arc. Either may be null at high latitudes (polar summer/winter).
        sunrise:  { x: number; y: number; angleRad: number; time: Date } | null;
        sunset:   { x: number; y: number; angleRad: number; time: Date } | null;
    } | null
    {
        if (!this._renderer)
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
        const stepMs = DAY_MS / SUN_ARC_SAMPLES;

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
            const samples: ({
                lon: number;
                lat: number;
                altitudeM: number;
                altitudeDeg: number;
                azimuthDeg: number;
                wm2: number;
                belowHorizon: boolean;
            } | null)[] = [];
            for (let i = 0; i < SUN_ARC_SAMPLES; i++)
            {
                const t = new Date(dayStartMs + i * stepMs);
                const sun3D = this._sunSpherePoint(t);
                if (!sun3D)
                {
                    samples.push(null);
                    continue;
                }
                //Per-sample: sensor reading within the window, else the analytical clear-sky x cloud model.
                //Mixing along the arc is fine since sensor samples are sparse and the gradient is smooth.
                const sensorWm2 = this._sensorIrradianceAt(t);
                const wm2 = sensorWm2 !== null
                    ? sensorWm2
                    : computeIrradianceWm2(t, this.homeLat, this.homeLon, liveCloud);
                samples.push({
                    lon:          sun3D.lon,
                    lat:          sun3D.lat,
                    altitudeM:    sun3D.altitudeM,
                    altitudeDeg:  sun3D.altitudeDeg,
                    azimuthDeg:   sun3D.azimuthDeg,
                    wm2,
                    //Below the LOCAL horizon: the terrain elevation at this azimuth (0 = flat, so this reduces
                    //to altitude < 0 when no relief profile). Surface a flag, not the value, since the card only
                    //switches render mode (solid vs dotted).
                    belowHorizon: sun3D.altitudeDeg <= this._horizonAt(sun3D.azimuthDeg)
                });
            }
            cache = { dayStartMs, cloudPctInt, scaleKey: arcScaleKey, samples };
            this._arcInputsCache = cache;
        }

        //Per-frame: re-project the cached samples, recording depth to normalise into nearness below.
        interface RawArcPoint {
            x: number; y: number; depth: number;
            altitude: number; belowHorizon: boolean;
        }
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
                depth:        px.depth,
                altitude:     s.altitudeDeg,
                belowHorizon: s.belowHorizon
            });
        }

        //Sun at "now", same spherical projection as the arc points.
        const sunNow3D = this._sunSpherePoint(now);
        const sunNowPos = getSunPosition(now, this.homeLat, this.homeLon);
        const sunNowAlt = sunNowPos.altitude;
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
            //Keep a defined sun position even at night so the incidence ray has an anchor and downstream
            //maths stays finite (the ray just isn't drawn). Borrow home's depth so nearness degrades
            //gracefully.
            sunScreen = { ...homeScreen };
        }

        //Depth range across the full arc + the sun, so every element shares one perspective scale. Spans the
        //24 h arc, from the sun behind the camera at noon to the far horizon at dusk. (nearness defined below.)
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
        //SceneCamera.project3 returns depth = cameraZ, where LARGER = nearer the camera (it magnifies in the
        //perspective divide). So nearness peaks at dMax (closest); no `1 -` inversion.
        const nearnessOf = (d: number) => (d - dMin) / dRange;

        const arc = raw.map(p => ({
            x:            p.x,
            y:            p.y,
            altitude:     p.altitude,
            nearness:     nearnessOf(p.depth),
            belowHorizon: p.belowHorizon
        }));

        //Terrain-horizon ridge: the relief silhouette as a CLOSED ring around the home (full 360°, not just the
        //sun's path, so it encircles the house). Same celestial projection as the arc (horizonSpherePoint) so the
        //sun meets the crest exactly. Empty on flat terrain or when the feature is off; the card closes the loop.
        const ridge: { x: number; y: number }[] = [];
        if (this._horizonLineVisible && horizonPeak(this._horizonProfile) >= HORIZON_MIN_PEAK_DEG)
        {
            const ridgeScale = this._sunArcScale();
            //Fine enough for a smooth ring once projected (the profile itself is interpolated between its buckets).
            const HORIZON_RIDGE_STEP_DEG = 5;
            for (let az = 0; az < 360; az += HORIZON_RIDGE_STEP_DEG)
            {
                const hp = horizonSpherePoint(this.homeLat, this.homeLon, ridgeScale, az, this._horizonAt(az));
                const px = this._projectScenePoint(hp.lon, hp.lat, hp.altitudeM);
                if (px) { ridge.push({ x: px.x, y: px.y }); }
            }
        }

        //daylight: smooth 0..1 ramp on solar altitude, but snap to night once the sun drops behind the local
        //terrain horizon (visual only, the glow fades behind the ridge; production is never touched).
        const daylight = sunNowAlt <= this._horizonAt(sunNowPos.azimuth)
            ? SUN_ARC_NIGHT_OPACITY
            : daylightRamp(sunNowAlt, SUN_ARC_NIGHT_OPACITY);

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

            //Rise/set at the standard apparent-altitude threshold (refraction + semi-diameter), not the
            //geometric-centre 0° used for the arc's above/below render split, so the times match HA's sun.
            const prevBelow = prev.altitudeDeg < SUNRISE_SUNSET_ALTITUDE_DEG;
            const currBelow = curr.altitudeDeg < SUNRISE_SUNSET_ALTITUDE_DEG;
            if (prevBelow === currBelow)
            {
                continue;
            }

            //Lerp on (altitudeDeg - threshold): t=0 at prev, t=1 at curr, crossing where apparent altitude = threshold.
            const aPrev = prev.altitudeDeg - SUNRISE_SUNSET_ALTITUDE_DEG;
            const aCurr = curr.altitudeDeg - SUNRISE_SUNSET_ALTITUDE_DEG;
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
                azimuth:    sunNowPos.azimuth,
                nearness:   nearnessOf(sunScreen.depth)
            },
            home:     { x: homeScreen.x, y: homeScreen.y },
            daylight,
            ridge,
            sunrise,
            sunset
        };
    }

    //date -> 3D point on the celestial hemisphere (centred on home) for _projectScenePoint; the pure
    //geometry lives in engine/sun-arc, fed the current kiosk arc scale.
    private _sunSpherePoint(date: Date): {
        lon: number; lat: number; altitudeM: number; altitudeDeg: number; azimuthDeg: number
    } | null
    {
        return sunSpherePoint(date, this.homeLat, this.homeLon, this._sunArcScale());
    }

    //Set the scrub time (null = live). Swaps the weather refresh cadence and re-renders.
    public setSelectedTime(time: Date | null): void
    {
        this._selectedTime = time;

        if (time === null)
        {
            this._clearWeatherTimer();
            //Returning to live mode resumes the standard refresh cadence, unless the card is paused
            //(off-screen): un-pausing re-arms via _refreshWeather, so arming here too would defeat setPaused.
            if (!this._paused)
            {
                this._weatherTimer = window.setInterval(
                    () => this._refreshWeather(this._fetchLat, this._fetchLon),
                    WEATHER_REFRESH_INTERVAL_MS
                );
            }
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
            //Update shadows + atmosphere in lockstep with the scrub. setSun/setPalette schedule an rAF-coalesced
            //redraw, so the costly shadow raster still runs at most once per frame, but the sky and shadows now
            //follow the scrub continuously instead of snapping after a debounce.
            this._refreshShadowsAndAtmosphere();
        }
    }

    //Hourly series for the chart (one entry per hour over the forecast window): irradiance (W/m², sensor ->
    //shortwave -> Haurwitz fallback so the curve stays continuous past the model horizon), effective cloud
    //and the per-altitude bands. Null until the first fetch. The card re-renders the chart on every onWeatherUpdate.
    public getTimelineSeries(): {
        times:        Date[];
        irradiance:   number[];
        //Per-hour low/mid/high cloud cover %, so the timeline draws the three altitude bands separately.
        cloudLow:     number[];
        cloudMid:     number[];
        cloudHigh:    number[];
        //Per-hour temperature (°C) + humidity (%), local sensor override applied where present, else the model.
        temperature:  number[];
        humidity:     number[];
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
            //Haurwitz returns a normalised irradiance %; rescale to W/m² (x10, since 1000 = STC) for one chart unit.
            const pct = computePvPercent(home.times[i], this.homeLat, this.homeLon, home.cloudCover[i] ?? 0);
            return pct * 10;
        });

        const cloudLow  = home.times.map((_, i) => home.cloudLow[i]  ?? 0);
        const cloudMid  = home.times.map((_, i) => home.cloudMid[i]  ?? 0);
        const cloudHigh = home.times.map((_, i) => home.cloudHigh[i] ?? 0);

        //Local sensor override beats the model for the live + past hours; forecast hours carry no sample and fall
        //through to the model value (NaN where the model itself has none).
        const temperature = home.times.map((_, i) => this._weatherOverrideAt('temperature', home.times[i]) ?? (home.temperature[i] ?? NaN));
        const humidity    = home.times.map((_, i) => this._weatherOverrideAt('humidity',    home.times[i]) ?? (home.humidity[i]    ?? NaN));

        return {
            times:       home.times.slice(),
            irradiance,
            cloudLow,
            cloudMid,
            cloudHigh,
            temperature,
            humidity,
        };
    }

    public updateConfig(cfg: HeliosConfig): void
    {
        const prevRadius      = this._buildingRadiusMeters();
        const prevShadowOpa   = this._shadowOpacity();
        const prevShadowsOn   = this._shadowsEnabled();
        const prevAutoRotateOn = this.cfg['auto-rotate-enabled'] === true;
        const prevCameraLocked = this.isCameraLocked();
        this.cfg = { ...cfg };

        //Re-arm the auto-rotate rAF loop when the flags transition back to rotation-permitting (the loop
        //suspends itself when disabled to avoid a 60 Hz no-op tick).
        const nextAutoRotateOn = this.cfg['auto-rotate-enabled'] === true;
        const nextCameraLocked = this.isCameraLocked();
        const nowPermitsRotation  = nextAutoRotateOn && !nextCameraLocked;
        const prevPermitsRotation = prevAutoRotateOn && !prevCameraLocked;
        if (nowPermitsRotation && !prevPermitsRotation && this._renderer)
        {
            this._startAutoRotateLoop();
        }

        //When the camera-lock toggle flips, freeze/free the camera AT ITS CURRENT pose: rewrite the stored
        //pose (which _initial*/isCameraLocked read first) with the live bearing/pitch + the new lock, so the
        //angle the user set by dragging the preview is kept.
        if (prevCameraLocked !== nextCameraLocked && this._renderer)
        {
            this._writeStoredPose({
                bearing: this._renderer.getCameraBearing(),
                pitch:   this._renderer.getCameraPitch(),
            });
            this._renderer.scheduleRedraw();
        }

        if (!this._renderer)
        {
            return;
        }

        //Building option updates (radius/count/real-size/height/cluster): re-interpret the cached raw
        //footprints in memory via _ensureBuildings -> _applyBuildings. The location key is unchanged, so this
        //never re-fetches the tiles; the renderer re-extrudes from the freshly interpreted Building[]. We always
        //re-interpret (cheap) rather than diffing every option key; _applyBuildings is pure and idempotent.
        const nextRadius = this._buildingRadiusMeters();
        this._ensureBuildings();
        if (nextRadius !== prevRadius)
        {
            //Radius also drives the shadow fade band: force a refresh so the whole disc resizes in step.
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
        }

        //Shadow opacity / master toggle / building opacity: re-resolve the whole palette (cheap) so the
        //renderer repaints with the new values, and force one atmosphere pass so shadows land immediately.
        const nextShadowOpa = this._shadowOpacity();
        const nextShadowsOn = this._shadowsEnabled();
        this._resolvePalette();
        if (nextShadowOpa !== prevShadowOpa || nextShadowsOn !== prevShadowsOn)
        {
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
        }
        this._renderer.scheduleRedraw();

        if (this._homeHourlyData && this._mapReady)
        {
            this._renderForCurrentSelection();
        }
    }


    public cleanup(): void
    {
        this._clearWeatherTimer();
        window.clearInterval(this._skyTimer);
        this._fetchAbortController?.abort();
        this._buildingsAbort?.abort();
        this._horizonAbort?.abort();
        window.clearTimeout(this._horizonTimer);
        this._clearBuildingsRetry();
        this._arcInputsCache         = undefined;
        this._resizeObserver?.disconnect();
        if (this._autoRotateRaf !== undefined)
        {
            cancelAnimationFrame(this._autoRotateRaf);
            this._autoRotateRaf = undefined;
        }
        //Detach the drag-rotate pointer listeners from the renderer's container before the renderer tears
        //down its own DOM, so a lingering closure can't pin the dead engine.
        if (this._dragRotateHandlers)
        {
            const h = this._dragRotateHandlers;
            h.canvas.removeEventListener('pointerdown',   h.onDown);
            h.canvas.removeEventListener('pointermove',   h.onMove);
            h.canvas.removeEventListener('pointerup',     h.onEnd);
            h.canvas.removeEventListener('pointercancel', h.onEnd);
            h.canvas.removeEventListener('dragstart',     h.onDragStart);
        }

        //Drop heavy instance state.
        this._buildingsData     = null;
        this._buildingsRaw      = null;
        this._buildingsFetchDone = false;
        this._buildingsLocKey   = '';
        this._homeHourlyData    = null;
        this._dragRotateHandlers    = undefined;

        //Renderer teardown: cancels its rAF, removes its ground holder + scene SVG from the container.
        try { this._renderer?.cleanup(); }
        catch (_) { /* renderer may already be torn down */ }
        this._renderer      = undefined;
        this._mapReady      = false;
    }
}