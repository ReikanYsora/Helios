//Card init subsystem: home-coord resolution, visual-config hashing, engine bootstrap (debounce + construction), and the
//visibility observer that pauses animations off-screen.
//
//LitElement lifecycle hooks stay on the card class (HA + Lit invoke them directly on the element); they delegate the work here.

import type { HassLike } from '../core/ha-types';
import { homeColor, mapColorKey, mapShowKey, type HeliosConfig } from '../core/config/helios-config';
import { resolveUiColor } from '../core/format/format';
import { GROUND_LAYER_KEYS } from '../scene/ground-render';
import { HeliosEngine } from '../scene/helios-engine';
import { refreshHud, setAnimationsPaused, type HudHost } from '../hud/hud';
import type { ChartSeries } from '../charts/charts';


//A card that publishes the home colour as a CSS var and memoises the last-resolved token.
interface ConsumptionColorHost extends HTMLElement
{
    readonly config: HeliosConfig | undefined;
    _homeColorToken: string;
}


//Publish the home (consumption) colour as a :host CSS var so every consumption readout reads it. Resolves the
//configured ui_color token to a hex once per token change (getComputedStyle forces a reflow), so it no-ops while
//the token is unchanged. The card calls this from updated().
export function publishConsumptionColor(host: ConsumptionColorHost): void
{
    const homeToken = homeColor(host.config);
    if (homeToken !== host._homeColorToken)
    {
        host._homeColorToken = homeToken;
        host.style.setProperty('--helios-consumption-color', resolveUiColor(host, homeToken, '#4caf50', 'green'));
    }
}


//The fixed part of the visual-config key list (the per-layer basemap keys are appended below).
const STATIC_VISUAL_CONFIG_KEYS = [
    //When set, feeds the engine sensor samples that override the weather model for live + past irradiance; a change must
    //refresh so the override (or its absence) is picked up immediately.
    'solar-irradiance-entity',
    //Building option keys: a change triggers updateConfig -> _ensureBuildings -> _applyBuildings, which re-interprets the
    //cached raw footprints in memory (no re-fetch, the location key is unchanged).
    'display-radius',
    //Scene zoom: updateConfig rescales the renderer's camera and drops the arc caches (helios-engine).
    'scene-zoom',
    'building-cluster-radius',
    'building-count',
    'building-real-size',
    'building-height',
    'building-opacity',
    'auto-rotate-enabled',
    //Lock toggle: a change triggers updateConfig, which freezes/frees the camera at its current (drag-set) pose and
    //resyncs the stored pose. The buildings re-interpret updateConfig also runs is cheap (cached footprints, no refetch).
    'camera-locked',
    //Basemap style: the theme mode and the surrounding-building tint. A change re-resolves the scene palette and
    //repaints the vector ground from its cached features (no re-fetch), so an edit previews live instead of waiting
    //for the next engine creation.
    'building-color',
    'map-theme-mode',
] as const;

//The per-layer basemap colour + visibility keys, generated from the canonical layer list so they can never drift
//from it. Same live-repaint path as the two keys above.
const MAP_LAYER_CONFIG_KEYS = GROUND_LAYER_KEYS.flatMap((layer) => [mapColorKey(layer), mapShowKey(layer)]);

//Visual config keys the engine reacts to via updateConfig(): editor/YAML edits to these push into the live engine in
//place. Exhaustive on purpose: a missing key would leave a slider-dragged value stale until the next engine creation.
//Card-only state and identity inputs (home coords) are out.
export const VISUAL_CONFIG_KEYS: readonly string[] = [...STATIC_VISUAL_CONFIG_KEYS, ...MAP_LAYER_CONFIG_KEYS];


//Defensive parser for `home-latitude`/`home-longitude` raw config values (typed `unknown`). Bare Number() is unsafe: Number(''),
//Number(false), Number([]), Number(null) all yield 0, a finite in-range latitude that would silently win getHomeCoords's range
//check. Accept numbers, parse decimal-looking strings, reject everything else.
function parseConfigCoord(raw: unknown): number | null
{
    if (typeof raw === 'number')
    {
        return isFinite(raw) ? raw : null;
    }
    if (typeof raw === 'string')
    {
        const trimmed = raw.trim();
        if (trimmed === '')
        {
            return null;
        }
        const n = Number(trimmed);
        return isFinite(n) ? n : null;
    }
    return null;
}


//Resolves home coords, precedence: (1) `window.__heliosLocationOverride` (debug helper via setHeliosLocation()), (2) config
//`home-latitude`/`home-longitude`, only when BOTH are finite and in range (lat -90..90, lon -180..180), else rejected so a
//half-edited YAML never warps to {0,0}, (3) hass.config.{latitude,longitude}. Returns null if none yields a usable pair.
//
//Memoized on config identity, with hass.config + override pointers checked on read, so an unrelated hass update returns the same
//object reference (enables identity-based equality upstream).
interface HomeCoordsCacheEntry
{
    hassCfg:    unknown;
    overrideId: unknown;
    result:     { lat: number; lon: number } | null;
}
const _homeCoordsCache = new WeakMap<HeliosConfig, HomeCoordsCacheEntry>();
let   _homeCoordsNoConfigCache: HomeCoordsCacheEntry | null = null;

export function getHomeCoords(
    config: HeliosConfig | undefined,
    hass:   HassLike
): { lat: number; lon: number } | null
{
    const hassCfg    = hass?.config;
    const w          = window as unknown as { __heliosLocationOverride?: { lat: number; lon: number } };
    const overrideId = w.__heliosLocationOverride;

    if (config)
    {
        const cached = _homeCoordsCache.get(config);
        if (cached && cached.hassCfg === hassCfg && cached.overrideId === overrideId)
        {
            return cached.result;
        }
    }
    else if (_homeCoordsNoConfigCache
          && _homeCoordsNoConfigCache.hassCfg    === hassCfg
          && _homeCoordsNoConfigCache.overrideId === overrideId)
    {
        return _homeCoordsNoConfigCache.result;
    }

    const result = _resolveHomeCoords(config, hassCfg, overrideId);
    const entry: HomeCoordsCacheEntry = { hassCfg, overrideId, result };
    if (config)
    {
        _homeCoordsCache.set(config, entry);
    }
    else
    {
        _homeCoordsNoConfigCache = entry;
    }
    return result;
}


function _resolveHomeCoords(
    config:     HeliosConfig | undefined,
    hassCfg:    any,
    overrideId: { lat: number; lon: number } | undefined
): { lat: number; lon: number } | null
{
    if (overrideId && typeof overrideId.lat === 'number' && typeof overrideId.lon === 'number'
          && isFinite(overrideId.lat) && isFinite(overrideId.lon))
    {
        return { lat: overrideId.lat, lon: overrideId.lon };
    }

    const cfgLat = parseConfigCoord(config?.['home-latitude']);
    const cfgLon = parseConfigCoord(config?.['home-longitude']);
    if (cfgLat !== null && cfgLon !== null
        && cfgLat >= -90  && cfgLat <= 90
        && cfgLon >= -180 && cfgLon <= 180)
    {
        return { lat: cfgLat, lon: cfgLon };
    }

    const lat = hassCfg?.latitude;
    const lon = hassCfg?.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number')
    {
        return null;
    }
    return { lat, lon };
}


//Cheap stable signature of the visual config, used to skip updateConfig() when nothing the engine cares about changed. WeakMap-cached
//on config identity: called once per Lit cycle (once per overlay reprojection under auto-rotate); without the cache the join()
//allocates a fresh ~300-char string per call, adding GC churn during rotation.
const _configSigCache = new WeakMap<HeliosConfig, string>();

export function computeConfigSig(config: HeliosConfig | undefined): string
{
    if (!config)
    {
        return '';
    }
    const cached = _configSigCache.get(config);
    if (cached !== undefined)
    {
        return cached;
    }
    const sig = VISUAL_CONFIG_KEYS
        .map(k => `${k}=${config[k] ?? ''}`)
        .join('|');
    _configSigCache.set(config, sig);
    return sig;
}


//Structural surface the host card exposes to this module. Extends HudHost so refreshHud(host) lands cleanly inside the
//engine callbacks; the rest is the engine + init lifecycle state the bootstrap mutates.
export interface InitHost extends HudHost
{
    readonly config: HeliosConfig | undefined;
    readonly hass:   HassLike;
    readonly preview?: boolean;

    _engine?:            HeliosEngine;
    _cloudCover:         number;
    //"Your real sky" weather layers, resolved at the current live/scrub time (precip mm, snowfall cm, WMO code).
    _precip:             number;
    _snowfall:           number;
    _weatherCode:        number;
    //Temperature (°C) + humidity (%) at the current time, NaN when unavailable (temperature chip).
    _temperature:        number;
    _humidity:           number;
    //Active rolling window (days), so a fresh engine is seeded with the restored mode's span before its first
    //getTimelineRange().
    readonly _periodPastDays:   number;
    readonly _periodFutureDays: number;
    _timeRange:          { start: Date; end: Date } | null;
    _isLiveMode:         boolean;
    _chartSeries:        ChartSeries | null;

    _lastHomeKey:        string;
    _initInflight:       boolean;
    _visibilityObserver?: IntersectionObserver;
    //Document visibilitychange listener, stored on the host so disconnectedCallback can removeEventListener cleanly.
    _onVisibilityChange?: (() => void) | undefined;

    //Pause/resume the weather particle canvases (rain/snow/storm) alongside the engine when the card is off-screen
    //or its tab is hidden - their rAF loops are not covered by the CSS/SMIL animation pause.
    pauseWeather?(paused: boolean): void;

    //Current HA theme polarity, used to seed a new engine so its basemap builds at the right style first time.
    themeIsDark(): boolean;
    requestUpdate(): void;
    //Per-card storage discriminator (cache id + any duplicate suffix), fed to the engine for its pose key.
    effectiveCacheId?: (() => string) | undefined;
}


//IntersectionObserver hook: when the card scrolls off-screen, pause CSS/SVG-SMIL animations plus the engine's shadow timer and
//dome re-projection. The rotation rAF is left running (the browser auto-throttles rAF on hidden tabs, and the card looks alive on
//scroll-back). Page Visibility API is layered on top so a card in a hidden HA tab also goes quiet, not just one scrolled out of view.
export function initVisibilityObserver(host: InitHost): void
{
    if (host._visibilityObserver || typeof IntersectionObserver === 'undefined')
    {
        return;
    }
    //Combined paused state: off-screen (IntersectionObserver) OR tab hidden (Page Visibility). Either kills the heavy work.
    let intersecting = true;
    let wasTabHidden = false;
    let wasPaused    = false;
    const applyState = () =>
    {
        const tabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const paused    = !intersecting || tabHidden;
        setAnimationsPaused(host, paused);
        host._engine?.setPaused(paused);
        host.pauseWeather?.(paused);
        //Coming back from ANY pause, not just a tab returning: put the basemap back. It is a canvas painted once
        //and thereafter only CSS-transformed, so a backing store the browser dropped while we were away would stay
        //blank forever, leaving the SVG buildings floating over nothing. Cheap (cached features, no network) and
        //only on a real return.
        if (wasPaused && !paused)
        {
            host._engine?.repaintGround();
        }
        wasPaused = paused;
        //Tab just became visible. While hidden, refreshGrid/Pv/Battery can clear live values to null if hass momentarily
        //disconnected (HA does this on focus loss in some setups), and the card's reference-equality refresh gate then
        //short-circuits the next refresh (unchanged pointers). Force-invalidate the cache refs so the next render runs
        //refreshAll and repopulates the chips.
        if (wasTabHidden && !tabHidden)
        {
            const h = host as unknown as {
                _lastRefreshHassRef?:           unknown;
                _lastRefreshConfigSig?:         string;
                _lastRefreshTimeRangeRef?:      unknown;
                _lastRefreshEnergyDefaultsRef?: unknown;
            };
            h._lastRefreshHassRef           = undefined;
            h._lastRefreshConfigSig         = undefined;
            h._lastRefreshTimeRangeRef      = undefined;
            h._lastRefreshEnergyDefaultsRef = undefined;
            host.requestUpdate();
        }
        wasTabHidden = tabHidden;
    };
    host._visibilityObserver = new IntersectionObserver(entries =>
    {
        for (const entry of entries)
        {
            intersecting = entry.isIntersecting;
        }
        applyState();
    }, { threshold: 0 });
    host._visibilityObserver.observe(host as unknown as Element);
    if (typeof document !== 'undefined')
    {
        //One global listener per card; removed in disconnectedCallback via _onVisibilityChange.
        host._onVisibilityChange = applyState;
        document.addEventListener('visibilitychange', host._onVisibilityChange);
    }
}


//Create the engine on the next frame, once #map-container is in the shadow DOM and laid out (so the camera
//seeds from a real size). _initInflight stops updated() from firing a second initEngine() while the rAF is
//in flight. Called once per card; the engine is updated in place afterwards.
export function initEngine(host: InitHost): void
{
    host._initInflight = true;
    scheduleEngineInit(host);
}


//Build the engine on the next frame + wire its callbacks back into card state. Bails (clearing the inflight flag
//so the caller retries next Lit cycle) if the card detached or the container / hass.config / coords aren't ready yet.
function scheduleEngineInit(host: InitHost): void
{
    requestAnimationFrame(() =>
    {
        const cardEl = host as unknown as {
            shadowRoot:  ShadowRoot | null;
            isConnected: boolean;
        };
        if (!cardEl.isConnected)
        {
            host._initInflight = false;
            return;
        }
        const container = cardEl.shadowRoot?.getElementById('map-container') as HTMLElement | null;
        if (!container || !host.config || !host.hass?.config)
        {
            host._initInflight = false;
            return;
        }
        const coords = getHomeCoords(host.config, host.hass);
        if (!coords)
        {
            host._initInflight = false;
            return;
        }
        const { lat, lon } = coords;
        //User-defined home altitude (m ASL) from HA General settings; may be undefined on unconfigured installs, in
        //which case the engine and aux fetch omit elevation and let the weather model fall back to its own terrain data.
        const elevation = host.hass.config.elevation;

        host._engine = new HeliosEngine(container, host.config, [lon, lat], elevation, host.preview === true, host.effectiveCacheId?.() ?? '');
        wireEngineCallbacks(host);
        //Seed the engine with the active (possibly restored) window before getTimelineRange(), so a card that
        //loads straight into a week/month frame the right span from the first paint.
        host._engine.setPeriodDays(host._periodPastDays, host._periodFutureDays);
        //Seed the timeline window from the engine's synthetic fallback so the time-bar renders from the first
        //frame instead of staying hidden until the first weather push (which can be delayed on a slow load).
        if (!host._timeRange)
        {
            host._timeRange = host._engine.getTimelineRange();
        }
        host._initInflight = false;
    });
}


//Wire every engine-side callback into card state. Assumes host._engine was just assigned and is non-null.
function wireEngineCallbacks(host: InitHost): void
{
    if (!host._engine)
    {
        return;
    }

    //Ping Lit so engine-readiness-gated chrome enables as soon as the engine lands instead of on the next periodic tick.
    //The engine isn't a @state property, so this nudge is the only signal Lit gets that it became truthy.
    host.requestUpdate();

    host._engine.onWeatherUpdate = data =>
    {
        //Per-layer cloud breakdown is owned by the engine (it stashes low/mid/high and projectCloudScene reads them back to size the
        //three bands); the card only needs the aggregate for the cloud chip label.
        host._cloudCover         = data.cloudCover;
        host._precip             = data.precip;
        host._snowfall           = data.snowfall;
        host._weatherCode        = data.weatherCode;
        host._temperature        = data.temperature;
        host._humidity           = data.humidity;
        host._timeRange          = data.timeRange;
        host._isLiveMode         = data.isLiveTime;
        host._chartSeries        = host._engine?.getTimelineSeries() ?? null; //hourly series the chart canvas plots
        //First weather update is also our cue for the initial label layout: by now the map style has loaded and the projection
        //matrix is available. Subsequent transforms refresh via onMapTransform.
        refreshHud(host);
    };
    //rAF-coalesced overlay refresh: the engine fires transform events in bursts during inertial pan; without coalescing, refreshHud
    //+ dome re-projection ran several times per frame (heavy: sun arc, home silhouettes, dome cells + ribbon). The gate caps it at
    //one full pass per frame.
    let overlayRaf: number | null = null;
    //On top of the single-flight gate above: during a sustained burst (auto-rotate, a long drag) refreshHud's own
    //cost is still heavy enough that every other frame reads just as smooth, so skip every second one. Starts
    //true so the flip below lands on "run" first: a real (non-burst) transform is a single isolated call, and
    //this way it's never the one that gets skipped.
    let overlaySkip = true;
    host._engine.onMapTransform = () =>
    {
        //If paused (off-screen or hidden tab) the browser still fires move events for tile-load completions, but nothing's
        //visible, so skip the per-frame work. Resumes on the next render once the IntersectionObserver re-enables the engine.
        if (host._engine?.isPaused())
        {
            return;
        }
        if (overlayRaf !== null)
        {
            return;
        }
        overlayRaf = requestAnimationFrame(() =>
        {
            overlayRaf = null;
            overlaySkip = !overlaySkip;
            if (!overlaySkip)
            {
                refreshHud(host);
            }
            //In the editor preview, publish the live camera pose so the editor's "use current view" helper can
            //capture the framed angle into the config. Composed + bubbling so it reaches the editor element.
            if (host.preview)
            {
                const pose = host._engine?.getCameraPose();
                if (pose)
                {
                    (host as unknown as HTMLElement).dispatchEvent(
                        new CustomEvent('helios-camera-pose', { detail: pose, bubbles: true, composed: true }));
                }
            }
        });
    };
}
