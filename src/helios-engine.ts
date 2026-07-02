import { SceneRenderer } from './engine/renderer';
import type { Building, RawBuilding } from './engine/buildings';
import { getSunPosition, computePvPower, computeIrradianceWm2 } from './engine/sun';
import { fetchHomePointData, clearWeatherCache, RATE_LIMIT_BACKOFF_MS, OTHER_ERROR_BACKOFF_MS, type SampleHourly } from './engine/weather';
import { fetchRawBuildings, interpretBuildings } from './engine/buildings';
import {
    type CloudIntensity,
    resolveWeatherAtTime,
} from './engine/weather-resolve';
import { clusterScaleRamp, steppedArcScale } from './engine/hud-layout';
import { sunSpherePoint, daylightRamp } from './engine/sun-arc';
import {
    CAMERA_PITCH_MIN_DEG, CAMERA_PITCH_MAX_DEG, CAMERA_PITCH_REST_DEG,
    SUN_ARC_RADIUS_M, SUN_ARC_SAMPLES, SUN_ARC_NIGHT_OPACITY, PV_CHIP_OFFSET_PX,
    SHARED_FETCH_CACHE_TTL_MS, AUTO_ROTATE_DEG_PER_SEC, AUTO_ROTATE_INACTIVITY_MS,
    SUN_COLOR_HEX,
} from './constants';
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
} from './helios-config';
import { uiColorVar } from './card/format';


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



//Re-exported from engine/weather-resolve so importers of CloudIntensity from this module keep resolving.
export type { CloudIntensity };

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
    cloudLow:       number;        //%, low-level clouds (<= 3 km)
    cloudMid:       number;        //%, mid-level clouds (3 to 8 km)
    cloudHigh:      number;        //%, high-level clouds (>= 8 km)
    cloudIntensity: CloudIntensity;
    timeRange:      { start: Date; end: Date } | null;
    isLiveTime:     boolean;
    pvPower:        number;        //primary value, normalised 0..100 (≈ GHI/10 W/m²)
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

    //Skip atmosphere repaint when the sun moved less than 0.5° since last call (≈ 2 min).
    private _lastAtmosphereAlt = -999;

    //Consecutive HTTP 429 count, drives exponential back-off. Resets on any successful fetch.
    private _rateLimitStreak = 0;
    //Consecutive non-429 failure count (5xx, network, JSON parse). Drives a graduated back-off so an
    //outage doesn't retry at a flat cadence and pile up IP-rate-limit traffic. Resets on success.
    private _otherErrorStreak = 0;

    private _fetchAbortController?: AbortController;
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

    public onFetchStart?:    () => void;
    public onFetchEnd?:      () => void;
    public onWeatherUpdate?: (data: WeatherData) => void;
    //Buildings fetch lifecycle (around fetchRawBuildings) for the loading banner.
    public onBuildingsFetchStart?: () => void;
    public onBuildingsFetchEnd?:   () => void;

    //Irradiance samples from a HA irradiance sensor (history + live state), sorted ascending by time.
    //Null = no entity or no usable samples (model irradiance used unchanged). Each is W/m², treated as
    //ground-truth shortwave irradiance at the home in the same units as the model's shortwave field, so it
    //slots into the pipeline unscaled. Lookup is nearest-neighbour within a strict +/-30 min window; outside
    //it (and always for forecast time) fall through to the model rather than extrapolate stale values.
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
        //freezes the dashboard the moment an irradiance entity is selected.
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
            //Samples are sorted: once delta grows again the rest is monotonically worse, so stop.
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
    //Resting pose at init: localStorage (runtime lock chip) first, then the YAML camera-*-deg keys, then
    //the hemisphere-aware default (south up in NH, north up in SH). Wrapped/clamped against stale reads.
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
    //(live lock chip) first, then the YAML key.
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
        if (!this._renderer || !Number.isFinite(deg))
        {
            return;
        }
        const wrapped = ((deg % 360) + 360) % 360;
        this._renderer.setCameraBearing(wrapped);
    }
    //Live setter for the editor's pitch slider, clamped to the drag-pitch bounds.
    public setCameraPitch(deg: number): void
    {
        if (!this._renderer || !Number.isFinite(deg))
        {
            return;
        }
        const clamped = Math.max(CAMERA_PITCH_MIN_DEG, Math.min(CAMERA_PITCH_MAX_DEG, deg));
        this._renderer.setCameraPitch(clamped);
    }
    //Persist the camera's CURRENT bearing/pitch (with the live lock flag) to localStorage, so reopening the
    //dashboard restores the exact view. Called on drag-end and by the card on teardown (captures an
    //auto-rotated bearing too). No-op before the renderer exists.
    public persistCameraPose(): void
    {
        if (!this._renderer)
        {
            return;
        }
        this._writeStoredPose({
            bearing: this._renderer.getCameraBearing(),
            pitch:   this._renderer.getCameraPitch(),
            locked:  this.isCameraLocked(),
        });
    }

    //Toggle the lock at runtime (no respawn). The custom drag handlers re-check isCameraLocked() per
    //pointerdown. Mutates cfg in-place and refreshes localStorage for the next boot.
    public setCameraLocked(locked: boolean): void
    {
        if (!this._renderer)
        {
            return;
        }
        (this.cfg as Record<string, unknown>)['camera-locked'] = locked;
        this._writeStoredPose({
            bearing: this._renderer.getCameraBearing(),
            pitch:   this._renderer.getCameraPitch(),
            locked,
        });
    }

    //Home prism appearance, driven by the card's active chip: `color` is the chip's accent, `bands` the
    //per-PV-string production split (empty = solid). `animate` plays the squash/grow on a chip change; an
    //instant set is used for same-chip scrubs. The card computes these (they're hass/energy-derived).
    public setHomeAppearance(color: string, bands: { frac: number; color: string }[], animate: boolean, highlight = false): void
    {
        if (!this._renderer)
        {
            return;
        }
        if (animate)
        {
            this._renderer.animateHomeTo(color, bands);
        }
        else
        {
            this._renderer.setHome(color, bands, highlight);
        }
    }

    //Clock mode renders the home prism alone (no neighbours) as the dial anchor; scene mode shows everything.
    public setHomeOnly(on: boolean): void
    {
        this._renderer?.setHomeOnly(on);
    }
    //Clock-mode ground guide, painted between the basemap and the home prism. '' clears it.
    public setGroundOverlay(svg: string): void
    {
        this._renderer?.setGroundOverlay(svg);
    }
    //Defaults the editor's reset button restores: always the hemisphere-aware boot pose, never the user's
    //customised values (reading _initialBearing/_initialPitch would echo back what they just changed).
    public getDefaultBearing(): number { return this.homeLat >= 0 ? 180 : 0; }
    public getDefaultPitch():   number { return CAMERA_PITCH_REST_DEG; }
    //Live pose readers so the editor pre-fills its sliders with the current view, not the committed YAML.
    public getCameraBearing(): number { return this._renderer ? this._renderer.getCameraBearing() : this.getDefaultBearing(); }
    public getCameraPitch():   number { return this._renderer ? this._renderer.getCameraPitch()   : this.getDefaultPitch(); }
    //No zoom in the 2.5D renderer (the camera sits at one fixed altitude); return a fixed constant so the
    //sun-arc-scale memo key + any zoom-aware callers keep a stable value.
    public getCameraZoom():    number { return 18; }

    //Cached CSS width of the scene viewport (px), maintained on resize so HUD layout can read it without
    //forcing a mid-frame layout flush. 0 until the first measure. Used by the card to decide which side of
    //the irradiance chip the cloud chip fits on.
    public getViewportWidth(): number { return this._cachedCanvasCssW; }


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
            const dt = Math.max(0, t - this._autoRotateLastFrame) / 1000;
            this._autoRotateLastFrame = t;

            const sinceUser = Date.now() - this._autoRotateLastUserAction;
            //Defaults OFF: rotation is opt-in (it can distract and, in scrub mode, blurs "did the camera
            //move or did time pass?"). camera-locked also suppresses it.
            const autoRotateEnabled = this.cfg['auto-rotate-enabled'] === true;
            const cameraLocked      = (this.cfg as Record<string, unknown>)['camera-locked'] === true;
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
        canvas:  HTMLElement;
        onDown:  (e: PointerEvent) => void;
        onMove:  (e: PointerEvent) => void;
        onEnd:   (e: PointerEvent) => void;
    };


    //Building lifecycle: LOCATION drives the FETCH, OPTIONS drive the INTERPRET. _buildingsRaw holds the
    //option-independent footprints fetched once at the max radius (the home doesn't move during a session,
    //so fetch once and reuse across style reloads); _buildingsLocKey is the location key they were fetched
    //for. _buildingsData is the INTERPRETED Building[] the renderer draws, recomputed in memory on every
    //option change with no re-fetch.
    private _buildingsData:   Building[] | null    = null;
    private _buildingsRaw:    RawBuilding[] | null = null;
    private _buildingsLocKey               = '';
    //One-shot prism-rise guard (plays once the first time footprints land).
    private _grown = false;
    //Editor-preview mode: HA rebuilds the preview card on every keystroke, so intro animations are skipped.
    private readonly _editMode: boolean;
    private _buildingsAbort?: AbortController;

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
        samples: ({
            lon: number;
            lat: number;
            altitudeM: number;
            altitudeDeg: number;
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
        //leave the map null. The post-load resize handling covers any 0×0-at-init case.
        this._initMapInstance(container, haCoords);
    }

    private _initMapInstance(container: HTMLElement, _haCoords: [number, number]): void
    {
        //Spin up the renderer. It builds its own DOM (ground holder + scene SVG) inside the container, owns
        //the SceneCamera every projection routes through, and paints night-shade + cast shadows + extruded
        //buildings itself. The home colour + shadow colour/opacity are merged into its palette.
        this._container = container;
        this._renderer = new SceneRenderer(container, {
            sun:           SUN_COLOR_HEX,
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

        //Sibling global for the editor UI: camera setters live on the engine.
        try { (window as unknown as { __heliosEngine?: HeliosEngine }).__heliosEngine = this; }
        catch (_) { /* window not writable: skip the optional editor global */ }

        //Bootstrap the basemap + initial scene asynchronously, then mark ready and feed sun/buildings.
        this._bootstrapRenderer();

        //Custom drag-rotate (left-click / one-finger). Bound to the container (the renderer's host), whose
        //touch-action is set to none so every gesture over the scene is a card interaction (dashboard scroll
        //happens by touching outside the card, like Google Maps on mobile).
        container.style.touchAction = 'none';

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
            //Single-pointer rotation; ignore additional touches.
            if (activeId !== null)
            {
                return;
            }
            //Swallow gestures during the post-exit cooldown so the dismissing click can't bleed into a
            //fresh drag-rotate on the scene behind.
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
            try { container.setPointerCapture(e.pointerId); }
            catch (_) { /* pointer capture unsupported on this element */ }
        };
        const onMove = (e: PointerEvent) =>
        {
            if (!dragRotating || !this._renderer || e.pointerId !== activeId)
            {
                return;
            }
            const dx = e.clientX - lastPointerX;
            const dy = e.clientY - lastPointerY;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
            this._autoRotateLastUserAction = Date.now();
            //Drag right turns the scene with the gesture (negate dx: +dx read inverted on the canvas plane).
            this._renderer.setCameraBearing(this._renderer.getCameraBearing() - dx * ROTATE_SENSITIVITY_DEG_PER_PX);
            //Subtract dy so drag up flattens pitch, drag down goes bird's-eye; clamped to session bounds.
            const nextPitch = Math.max(CAMERA_PITCH_MIN_DEG, Math.min(CAMERA_PITCH_MAX_DEG,
                this._renderer.getCameraPitch() - dy * PITCH_SENSITIVITY_DEG_PER_PX));
            this._renderer.setCameraPitch(nextPitch);
        };
        const onEnd = (e: PointerEvent) =>
        {
            if (e.pointerId !== activeId)
            {
                return;
            }
            dragRotating = false;
            activeId     = null;
            try { container.releasePointerCapture(e.pointerId); }
            catch (_) { /* pointer capture may already be released */ }
            //Persist the pose the user just dragged to, so a return restores the same view.
            this.persistCameraPose();
        };
        container.addEventListener('pointerdown',   onDown);
        container.addEventListener('pointermove',   onMove);
        container.addEventListener('pointerup',     onEnd);
        container.addEventListener('pointercancel', onEnd);
        this._dragRotateHandlers = { canvas: container, onDown, onMove, onEnd };

        this._refreshWeather();
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
            await renderer.setLocation(this.homeLat, this.homeLon);
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

        window.clearInterval(this._skyTimer);
        this._lastAtmosphereAlt = -999;
        this._refreshShadowsAndAtmosphere();
        //60 s sky/atmosphere refresh. _refreshShadowsAndAtmosphere short-circuits when the sun barely moved,
        //so the cost is negligible; the paused skip avoids even the signature check while invisible.
        this._skyTimer = window.setInterval(() =>
        {
            if (this._paused)
            {
                return;
            }
            this._refreshShadowsAndAtmosphere();
        }, 60_000);

        this._startAutoRotateLoop();

        if (this._homeHourlyData)
        {
            this._renderForCurrentSelection();
        }
    }

    //The card-side host element (#map-container) the renderer mounts into; carries the cascaded HA theme CSS
    //custom properties the scene palette resolves from. The basemap's light/dark is handled by card CSS, so
    //the engine itself does not track theme polarity.
    private _container?: HTMLElement;

    //Resolve a theme colour token to #rrggbb. Reads the CSS custom property off the host's computed style
    //(so it follows the active HA theme), accepting #rgb / #rrggbb / rgb()/rgba(); falls back when unset.
    private _cssHex(name: string, fallback: string): string
    {
        const raw = this._container ? getComputedStyle(this._container).getPropertyValue(name).trim() : '';
        if (/^#[0-9a-f]{6}$/i.test(raw)) { return raw; }
        if (/^#[0-9a-f]{3}$/i.test(raw)) { return '#' + raw.slice(1).split('').map(c => c + c).join(''); }
        const m = raw.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
        if (m)
        {
            const h = (n: string): string => Math.max(0, Math.min(255, Math.round(parseFloat(n)))).toString(16).padStart(2, '0');
            return '#' + h(m[1]) + h(m[2]) + h(m[3]);
        }
        return fallback;
    }

    //Push the full scene palette to the renderer from the live HA theme tokens + the building-opacity
    //config. Re-run on init and on every theme flip.
    private _resolvePalette(): void
    {
        this._renderer?.setPalette({
            home:            this._cssHex('--energy-grid-consumption-color', '#488fc2'),
            neighbor:        this._buildingColor(),
            sun:             SUN_COLOR_HEX,
            shadow:          this._cssHex('--shadow-color', '#000000'),
            shadowOpacity:   this._shadowsEnabled() ? this._shadowOpacity() : 0,
            neighborOpacity: this._buildingOpacity(),
        });
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
        cloudIntensity: CloudIntensity;
    }
    {
        return resolveWeatherAtTime(this._homeHourlyData, t);
    }

    //Ambient readout (WMO code, temperature C, wind km/h + bearing deg) at `t` for the top-right info panel.
    //Null until the first Open-Meteo payload lands so the card hides the rows instead of showing NaN.
    public getAmbientReadout(t: Date): { weatherCode: number; temperature: number; windSpeed: number; windDir: number } | null
    {
        if (!this._homeHourlyData)
        {
            return null;
        }
        const w = resolveWeatherAtTime(this._homeHourlyData, t);
        return { weatherCode: w.weatherCode, temperature: w.temperature, windSpeed: w.windSpeed, windDir: w.windDir };
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
        const visibleStartMs = today0.getTime() - pastDays * 24 * 3_600_000;
        //End at the midnight after the last future day so the axis spans futureDays full days plus today.
        const visibleEndMs   = today0.getTime() + (futureDays + 1) * 24 * 3_600_000;

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
        return this._cssHex(uiColorVar(buildingColorToken(this.cfg), 'grey'), '#9e9e9e');
    }

    //Location-keyed key for the raw fetch + shared cache. Options are deliberately absent: a building-option
    //change keeps the same key, so it never triggers a re-fetch, only a re-interpret.
    private _buildingsLocationKey(): string
    {
        return `${this.homeLat.toFixed(6)}|${this.homeLon.toFixed(6)}`;
    }

    //Ensure the raw footprints for the current LOCATION are in hand, then interpret + render them. Re-fetches
    //Overpass only when the home location changed; a pure option change finds the raw data already present
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
            this._buildingsRaw    = sharedRaw;
            this._buildingsLocKey = locKey;
            this._applyBuildings();
            this._lastAtmosphereAlt = -999;
            this._refreshShadowsAndAtmosphere();
            return;
        }

        //Abort any in-flight request so a rapid location change doesn't race a stale fetch into the sources.
        this._buildingsAbort?.abort();
        const ac = new AbortController();
        this._buildingsAbort = ac;

        try { this.onBuildingsFetchStart?.(); } catch (_) { /* host progress callback threw; fetch continues */ }

        fetchRawBuildings(this.homeLat, this.homeLon, ac.signal)
        .then(result =>
        {
            if (ac.signal.aborted || !this._renderer)
            {
                return;
            }
            this._buildingsRaw    = result;
            this._buildingsLocKey = locKey;
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
        })
        .finally(() =>
        {
            try { this.onBuildingsFetchEnd?.(); } catch (_) { /* host progress callback threw; nothing left to do */ }
        });
    }

    //Interpret the raw footprints with the CURRENT options (radius/count/real-size/height/cluster) and hand
    //the result to the renderer (it extrudes home + surroundings and casts their shadows itself). Pure +
    //cheap, so this is the re-render path for every building-option change (no Overpass round-trip).
    private _applyBuildings(): void
    {
        if (!this._renderer)
        {
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

    //Hand the interpreted footprints to the renderer. interpretBuildings always returns at least the
    //fallback house, so `buildings` is empty only before the first interpret pass.
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


    //Drive the renderer's sun position for the current (live or scrubbed) time. The renderer paints
    //night-shade, building face shading and cast shadows itself from this azimuth/altitude via one setter.
    //The ≥1.5° altitude throttle (~6 min of motion) avoids needless redraws.
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
    }

    //Precision fixed to 'high' (multi-model median).
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

            //Success: reset both back-off streaks.
            this._rateLimitStreak  = 0;
            this._otherErrorStreak = 0;

            if (this._selectedTime === null)
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
                cloudIntensity:   'clear',
                timeRange:        this._getTimeRange(),
                isLiveTime:       this._selectedTime === null,
                pvPower:          0,
                pvPowerHaurwitz:  0,
                pvPowerShortwave: -1,
                irradianceSource: 'haurwitz',
            });

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
        finally
        {
            this.onFetchEnd?.();
        }
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
        void this._renderer?.setLocation(lat, lon);
        this._ensureBuildings();
        this._lastAtmosphereAlt = -999;
        this._refreshShadowsAndAtmosphere();
        void this._refreshWeather(lat, lon);
    }

    //True during the post-exit cooldown. Card gates scrubs, engine gates drag-rotate; both read the same
    //clock so the suppression window is symmetric.
    public isUserGestureSuppressed(): boolean
    {
        return Date.now() < this._postExitCooldownUntil;
    }

    //Screen-space layout of the on-map readout chips and their leader lines. Returns positions (CSS px
    //relative to the canvas) for the cloud chip (outside the ring), PV chip, battery SoC/Power chips, the
    //grid chip, the ring edge (hemisphere-aware anchor direction for the cloud fill interp), and
    //the projected home point (chip-leader anchor / disc centre). Null when the map isn't ready (card skips
    //the overlay that frame).
    public projectHomeLabelLayout(): {
        pvLabel:           { x: number; y: number };
        batterySocLabel:   { x: number; y: number };
        batteryPowerLabel: { x: number; y: number };
        gridLabel:         { x: number; y: number };
        //Custom-entity chip anchor: top-left, above the grid chip (mirrors battery-power on the right).
        customLabel:       { x: number; y: number };
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
        if (!this._renderer)
        {
            return null;
        }

        const home = this._projectScenePoint(this.homeLon, this.homeLat, 0);
        if (!home)
        {
            return null;
        }

        //Hemisphere-aware fixed anchor on the disc edge (NE of home in NH, SW in SH). Both project to
        //screen-lower-left at the resting bearing, keeping the cloud chip clear of the irradiance chip's
        //top-of-arc. Anchoring to one lon/lat lets the chip orbit smoothly under rotation.
        const lat0   = this.homeLat;
        const cosLat = Math.cos(lat0 * Math.PI / 180);

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
        //Home roof Y = home lat/lon projected at the tallest render_height. Used as the drop-leader endpoint
        //and to anchor the cluster above the roof so it follows the silhouette as the canvas grows. Falls
        //back to ground home before _buildingsData lands.
        let roofY = home.y;
        const homeBuildings = this._buildingsData?.filter((b) => b.isHome) ?? [];
        if (homeBuildings.length > 0)
        {
            let maxH = 0;
            for (const b of homeBuildings)
            {
                if (b.height > maxH)
                {
                    maxH = b.height;
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
        //Left column: the grid chip sits low (bottom-left), mirroring the battery SoC chip on the right; the
        //custom-entity chip sits above it (top-left), mirroring the battery Power chip.
        const gridXLeft         = home.x - CHIP_SIDE_X_OFFSET_PX;
        const gridY             = clusterY + CHIP_STACK_GAP_PX / 2;
        const customXLeft       = home.x - CHIP_SIDE_X_OFFSET_PX;
        const customY           = clusterY - CHIP_STACK_GAP_PX / 2;

        //PV home-anchor ground disc as a polygon: sample N points on a circle of PV_HOME_ANCHOR_RADIUS_M
        //around the home, project each, and express relative to the home so the SVG can translate-to-home.
        //Flat on the ground, it projects to an ellipse under pitch like the rest of the map.
        const PV_HOME_ANCHOR_RADIUS_M = 4.0;
        const ANCHOR_SAMPLES          = 48;
        const anchorLatPerM = 1 / 111_320;
        const anchorLonPerM = anchorLatPerM / cosLat;
        //Reuse a single instance-level scratch array + string buffer instead of allocating a 48-entry array
        //per call; this function fires on every map move during auto-rotate.
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
            const p  = this._projectScenePoint(
                this.homeLon + dE * anchorLonPerM,
                this.homeLat + dN * anchorLatPerM,
                0
            );
            if (!p)
            {
                anchorPts[i] = '0,0';
                continue;
            }
            //Direct number-to-string concat with one decimal of precision (cheaper than toFixed per call).
            const dx = Math.trunc((p.x - home.x) * 100) / 100;
            const dy = Math.trunc((p.y - home.y) * 100) / 100;
            anchorPts[i] = dx + ',' + dy;
        }

        return {
            pvLabel:           { x: pvX,            y: pvY          },
            batterySocLabel:   { x: batteryXRight,  y: batterySocY  },
            batteryPowerLabel: { x: batteryXRight,  y: batteryPowerY},
            gridLabel:         { x: gridXLeft,      y: gridY        },
            customLabel:       { x: customXLeft,    y: customY      },
            home:              { x: home.x,         y: clusterY     },
            homeRoof:          { x: home.x,         y: roofY        },
            homeAnchorPoints:  anchorPts.join(' '),
        };
    }

    //Scratch array for the PV home-anchor SVG points, reused across projectHomeLabelLayout() calls.
    private _anchorPtsBuf: string[] = [];

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

    //Keystone projection: lon/lat/altitude -> screen px via the SceneCamera. Every card-facing projection
    //method (projectSunScene, projectHomeFootprints, projectHomeLabelLayout, getSunArcScale,
    //_applyCameraTargetPadding) routes through here. Coordinates are converted to local metres relative to
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
        const perLat = 111_320;
        const perLon = 111_320 * Math.cos(this.homeLat * Math.PI / 180);
        const east  = (lon - this.homeLon) * perLon;
        const north = (lat - this.homeLat) * perLat;
        return this._renderer.camera.project3(east, north, altitudeM);
    }

    //Screen-space rotation (deg, CSS clockwise) that points an up-pointing arrow icon along a real-world compass
    //bearing (deg CW from North) projected onto the tilted ground. Because it routes through the live camera, the
    //angle tracks camera orbit + pitch, so a panel arrow stays aligned with the true direction as the scene turns.
    //Null until the renderer is ready or when the projected vector is degenerate (bearing edge-on to the camera).
    public projectGroundBearing(bearingDeg: number): number | null
    {
        if (!this._renderer || !Number.isFinite(bearingDeg))
        {
            return null;
        }
        const rad = bearingDeg * Math.PI / 180;
        //Any positive radius works: only the projected direction (not the length) is used.
        const east  = Math.sin(rad) * 10;
        const north = Math.cos(rad) * 10;
        const origin = this._renderer.camera.project3(0, 0, 0);
        const tip    = this._renderer.camera.project3(east, north, 0);
        const dx = tip.x - origin.x;
        const dy = tip.y - origin.y;
        if (dx === 0 && dy === 0)
        {
            return null;
        }
        //mdi:navigation points up (screen -Y) at 0deg; rotate "up" onto (dx, dy).
        return Math.atan2(dx, -dy) * 180 / Math.PI;
    }

    //Screen-space layout of the solar arc, the sun's current position, and the incidence ray. Null until
    //ready. Each arc point carries the irradiance (W/m², live cloud applied uniformly across the day, a
    //simplification that stays reactive without a per-hour forecast) and a `nearness` in [0..1] (1 =
    //nearest depth) the card uses to scale segment thickness + sun-disc radius for a perspective ribbon.
    public projectSunScene(now: Date): {
        arc:      {
            x: number; y: number;
            irradiance: number; altitude: number; nearness: number; belowHorizon: boolean;
        }[];
        sun:      { x: number; y: number; irradiance: number; altitude: number; nearness: number };
        home:     { x: number; y: number };
        daylight: number;
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
            const samples: ({
                lon: number;
                lat: number;
                altitudeM: number;
                altitudeDeg: number;
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
                    altitudeDeg:  sun3D.altitudeDeg,
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
        interface RawArcPoint {
            x: number; y: number; irradiance: number; depth: number;
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
                irradiance:   s.wm2,
                depth:        px.depth,
                altitude:     s.altitudeDeg,
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
            //Keep a defined sun position even at night so the incidence ray has an anchor and downstream
            //maths stays finite (the ray just isn't drawn). Borrow home's depth so nearness degrades
            //gracefully.
            sunScreen = { ...homeScreen, depth: homeScreen.depth };
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
            irradiance:   p.irradiance,
            altitude:     p.altitude,
            nearness:     nearnessOf(p.depth),
            belowHorizon: p.belowHorizon
        }));

        //daylight: smooth 0..1 ramp on solar altitude (pure ramp in engine/sun-arc).
        const daylight = daylightRamp(sunNowAlt, SUN_ARC_NIGHT_OPACITY);

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

    //date -> 3D point on the celestial hemisphere (centred on home) for _projectScenePoint; the pure
    //geometry lives in engine/sun-arc, fed the current kiosk arc scale.
    private _sunSpherePoint(date: Date): {
        lon: number; lat: number; altitudeM: number; altitudeDeg: number
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

    //Hourly series for the chart (one entry per hour over the forecast window): irradiance (W/m², sensor ->
    //shortwave -> Haurwitz fallback so the curve stays continuous past the model horizon), effective cloud
    //and the per-altitude bands. Null until the first fetch. The card re-renders the chart on every onWeatherUpdate.
    public getTimelineSeries(): {
        times:        Date[];
        irradiance:   number[];
        cloud:        number[];
        //Per-hour low/mid/high cloud cover %, so the timeline draws the three altitude bands separately.
        cloudLow:     number[];
        cloudMid:     number[];
        cloudHigh:    number[];
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

        return {
            times:       home.times.slice(),
            irradiance,
            cloud,
            cloudLow,
            cloudMid,
            cloudHigh,
        };
    }

    public updateConfig(cfg: HeliosConfig): void
    {
        const prevRadius      = this._buildingRadiusMeters();
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
        if (nowPermitsRotation && !prevPermitsRotation && this._renderer)
        {
            this._startAutoRotateLoop();
        }

        if (!this._renderer)
        {
            return;
        }

        //Building option updates (radius/count/real-size/height/cluster): re-interpret the cached raw
        //footprints in memory via _ensureBuildings -> _applyBuildings. The location key is unchanged, so this
        //never re-hits Overpass; the renderer re-extrudes from the freshly interpreted Building[]. We always
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
        if (this._selectedTimeShadowTimer !== null)
        {
            window.clearTimeout(this._selectedTimeShadowTimer);
            this._selectedTimeShadowTimer = null;
        }
        window.clearInterval(this._skyTimer);
        this._fetchAbortController?.abort();
        this._buildingsAbort?.abort();
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
        }

        //Drop heavy instance state.
        this._buildingsData     = null;
        this._buildingsRaw      = null;
        this._buildingsLocKey   = '';
        this._homeHourlyData    = null;
        this._dragRotateHandlers    = undefined;

        //Renderer teardown: cancels its rAF, removes its ground holder + scene SVG from the container.
        try { this._renderer?.cleanup(); }
        catch (_) { /* renderer may already be torn down */ }
        this._renderer      = undefined;
        this._mapReady      = false;

        //Clear the debug global so it doesn't pin the dead engine.
        try
        {
            const w = window as unknown as { __heliosEngine?: unknown };
            if (w.__heliosEngine !== undefined)
            {
                delete w.__heliosEngine;
            }
        }
        catch (_) { /* window not writable: editor global cleanup not needed */ }
    }
}