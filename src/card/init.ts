//Card init subsystem: home-coord resolution, visual-config hashing, engine bootstrap (debounce + construction), and the
//visibility observer that pauses animations off-screen.
//
//LitElement lifecycle hooks (setConfig, connectedCallback, disconnectedCallback, updated) stay on the card class because HA + Lit
//invoke them directly on the element; they delegate the work to the helpers here.

import type { HeliosConfig } from '../helios-config';
import { HeliosEngine } from '../helios-engine';
import { refreshOverlays, setAnimationsPaused, type OverlaysHost } from './overlays';
import type { ChartSeries } from './charts';
import { beginLoadingPhase, endLoadingPhase, type LoadingTrackerHost } from './loading-tracker';
import { ENGINE_SPAWN_COOLDOWN_MS, GLOBAL_SPAWN_COOLDOWN_MS } from '../constants';


//Visual config keys the engine reacts to via updateConfig(): editor/YAML edits to these push into the live engine without a full
//respawn. Exhaustive on purpose - a missing key would leave a slider-dragged value stale until the next natural respawn. Card-only
//state and identity inputs (home coords flip identity via `_engineIdentitySig`) are out. Colours are fixed by the HA Energy palette.
export const VISUAL_CONFIG_KEYS = [
    'show-labels',
    'map-style', //triggers MapLibre setStyle(); engine reloads cloud disc, buildings and labels on the resulting `style.load`.
    //When set, feeds the engine sensor samples that override Open-Meteo for live + past irradiance; a change must refresh so the
    //override (or its absence) is picked up immediately.
    'solar-radiation-entity',
    //display-radius / cluster-radius invalidate cache and refetch; opacity is a cheap paint-property update.
    'display-radius',
    'building-cluster-radius',
    'building-opacity',
    'auto-rotate-enabled',
    //camera-pitch-deg/bearing-deg/locked are deliberately NOT here: a slider drag would respawn (teardown + rebuild WebGL) every
    //frame. The editor instead pushes live previews through engine.setCamera* and bakes values into config; the next natural respawn
    //reads them from _initialBearing / _initialPitch.
] as const;


//Defensive parser for `home-latitude`/`home-longitude` raw config values (typed `unknown`). Bare Number() is unsafe: Number(''),
//Number(false), Number([]), Number(null) all yield 0 - a finite in-range latitude that would silently win getHomeCoords's range
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
//`home-latitude`/`home-longitude` - only when BOTH are finite and in range (lat -90..90, lon -180..180), else rejected so a
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
    hass:   any
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
//allocated a fresh ~300-char string per call, adding GC churn during rotation.
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


//Structural surface the host card exposes to this module. Extends OverlaysHost so refreshOverlays(host) lands cleanly inside the
//engine callbacks; the rest is the engine + init lifecycle state the bootstrap mutates.
export interface InitHost extends OverlaysHost, LoadingTrackerHost
{
    readonly config: HeliosConfig | undefined;
    readonly hass:   any;

    _engine?:            HeliosEngine;
    _cloudCover:         number;
    _timeRange:          { start: Date; end: Date } | null;
    _isLiveMode:         boolean;
    _chartSeries:        ChartSeries | null;
    _shadowBusy:         boolean;
    _weatherRateLimited: boolean;

    _lastHomeKey:        string;
    _initInflight:       boolean;
    //performance.now() of the most recent spawn. onContextLost bails when losses arrive faster than the engine stabilises (browser
    //thrashing its WebGL context pool); respawning at that cadence cascades, so the throttle breaks the loop and lets it settle.
    _lastEngineSpawnAt:  number;
    _visibilityObserver?: IntersectionObserver;
    //Document visibilitychange listener, stored on the host so disconnectedCallback can removeEventListener cleanly (per-card instance).
    _onVisibilityChange?: () => void;

    requestUpdate(): void;
}


//IntersectionObserver hook: when the card scrolls off-screen, pause CSS/SVG-SMIL animations plus the engine's 60s shadow timer and
//dome re-projection. The rotation rAF is left running (the browser auto-throttles rAF on hidden tabs, and the card looks alive on
//scroll-back). Page Visibility API is layered on top so a card in a hidden HA tab also goes quiet, not just one scrolled out of view.
export function initVisibilityObserver(host: InitHost): void
{
    if (host._visibilityObserver || typeof IntersectionObserver === 'undefined')
    {
        return;
    }
    //Combined paused state: off-screen (IntersectionObserver) OR tab hidden (Page Visibility). Either kills the heavy work; the
    //engine's own pause flag is updated when it exists (cheap, no teardown).
    let intersecting = true;
    let wasTabHidden = false;
    const applyState = () =>
    {
        const tabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        const paused    = !intersecting || tabHidden;
        setAnimationsPaused(host, paused);
        host._engine?.setPaused(paused);
        //Tab just became visible. While hidden, refreshGrid/Pv/Battery can clear live values to null if hass momentarily disconnected
        //(HA does this on focus loss in some setups), and HeliosCard's reference-equality refresh gate then short-circuits the next
        //refresh (unchanged pointers). Force-invalidate the cache refs so the next render runs refreshAll and repopulates the chips.
        if (wasTabHidden && !tabHidden)
        {
            const h = host as unknown as {
                _lastRefreshHassRef?:           unknown;
                _lastRefreshConfigRef?:         unknown;
                _lastRefreshTimeRangeRef?:      unknown;
                _lastRefreshEnergyDefaultsRef?: unknown;
            };
            h._lastRefreshHassRef           = undefined;
            h._lastRefreshConfigRef         = undefined;
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


//Construct an engine. shouldHaveEngine() has already absorbed visibility/editor-preview/tab-hidden debouncing upstream, so go
//straight to initEngineNow() (a second debounce would just add a 500ms stall to first paints). Sets _initInflight so updated()
//doesn't fire a second initEngine() while the rAF inside initEngineNow() is in flight.
//Hard throttle: refuse to respawn if the previous spawn is younger than ENGINE_SPAWN_COOLDOWN_MS. HA's editor preview fires
//setConfig() bursts (10+/s), each respawn allocating a fresh MapLibre WebGL context that the browser's 8-16 slots can't keep up with
//("too many active WebGL contexts"). 600ms safely covers one MapLibre teardown + GL slot release while still feeling instant.
const _pendingRespawnTimers = new WeakMap<InitHost, number>();

//Global spawn rate limit across ALL helios-card instances: dashboard edit mode can hold many cards alive, each starting up
//independently still bursts past the WebGL slot pool. Anything beyond one fresh engine per 800ms is rejected.
let _globalLastSpawnAt = 0;

//Called from disconnectedCallback so a pending deferred respawn can't fire after teardown (which would spawn an engine for a card
//with no shadow root).
export function cancelPendingRespawn(host: InitHost): void
{
    const t = _pendingRespawnTimers.get(host);
    if (t !== undefined)
    {
        window.clearTimeout(t);
        _pendingRespawnTimers.delete(host);
    }
}


export function initEngine(host: InitHost): void
{
    const now    = performance.now();
    const lastAt = host._lastEngineSpawnAt ?? 0;
    const delta  = now - lastAt;
    const sinceGlobalSpawn = now - _globalLastSpawnAt;
    //Per-card cooldown OR global rate limit can force a deferral; the global limit wins when several cards race during an edit-mode transition.
    const needDefer = (delta < ENGINE_SPAWN_COOLDOWN_MS && lastAt > 0)
                   || sinceGlobalSpawn < GLOBAL_SPAWN_COOLDOWN_MS;
    if (needDefer)
    {
        //Coalesce rapid respawn requests into ONE deferred spawn after the cooldown; clear any prior pending one so we never enqueue
        //more than one wake-up (latest config wins).
        const prev = _pendingRespawnTimers.get(host);
        if (prev !== undefined)
        {
            window.clearTimeout(prev);
        }
        host._initInflight = true;
        const perCardWait = lastAt > 0 ? ENGINE_SPAWN_COOLDOWN_MS - delta : 0;
        const globalWait  = GLOBAL_SPAWN_COOLDOWN_MS - sinceGlobalSpawn;
        const wait        = Math.max(perCardWait, globalWait, 0) + 16;
        const t = window.setTimeout(() =>
        {
            _pendingRespawnTimers.delete(host);
            //If the card unmounted while the cooldown ran, release the inflight flag and bail before the heavy spawn path.
            const hostEl = host as unknown as { isConnected?: boolean };
            if (hostEl.isConnected === false)
            {
                host._initInflight = false;
                return;
            }
            initEngineNow(host);
        }, wait);
        _pendingRespawnTimers.set(host, t);
        return;
    }
    host._initInflight = true;
    _globalLastSpawnAt = now;
    initEngineNow(host);
}


//Build the MapLibre engine and wire engine-side callbacks back into card state. Runs once per (home, identity) tuple and replaces
//any previous engine. Bails early if the container or hass.config isn't ready; the caller retries on the next Lit cycle.
export function initEngineNow(host: InitHost): void
{
    requestAnimationFrame(() =>
    {
        //isConnected gate: the rAF gap can land after a dashboard edit-mode unmount. Spawning for a card no longer in the DOM
        //allocates a WebGL context with no visible canvas and feeds the editor-mode cascade.
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
        //User-defined home altitude (m ASL) from HA General settings; may be undefined on older/unconfigured installs - the engine
        //and aux fetch then simply omit &elevation= and let Open-Meteo fall back to its own DEM.
        const elevation = host.hass.config.elevation;

        const hadPreviousEngine = host._engine !== undefined;
        host._engine?.cleanup();
        host._engine = undefined;
        //Defensive: clear anything MapLibre left in the container (canvas, telemetry div, marker root). Old MapLibre revisions
        //occasionally left a dead canvas that stacked a second 3D context on the new one.
        while (container.firstChild)
        {
            container.removeChild(container.firstChild);
        }

        const spawnNewEngine = (): void =>
        {
            //Re-check defensively: the inter-frame gap could land after a card disconnect, so a torn-down card never spawns.
            if (!host.config || !host.hass?.config)
            {
                host._initInflight = false;
                return;
            }
            host._engine = new HeliosEngine(container, host.config, [lon, lat], elevation);
            host._lastEngineSpawnAt = performance.now();
            wireEngineCallbacks(host);
            //Seed the timeline window from the engine's synthetic fallback so the time-bar renders from the first frame instead of
            //staying hidden until the first weather push - which can be delayed/skipped on a slow or rate-limited load (an aborted
            //fetch returns without firing onWeatherUpdate). onWeatherUpdate upgrades this to the real data-derived window on arrival.
            if (!host._timeRange)
            {
                host._timeRange = host._engine.getTimelineRange();
            }
            host._initInflight = false;
        };

        if (hadPreviousEngine)
        {
            //Firefox's WebGL context release isn't synchronous: after WEBGL_lose_context.loseContext() in cleanup() the context lingers
            //in the pool one more frame, so allocating the next engine in the same tick can fail to bind and render black. Skipping one
            //frame gives Firefox time to release. Chrome doesn't need it but the ~16ms is invisible (editor preview already debounced).
            requestAnimationFrame(spawnNewEngine);
            return;
        }

        spawnNewEngine();
    });
}


//Wires every engine-side callback into card state. Extracted so both spawn paths (immediate, and rAF-deferred after a previous
//cleanup) share identical wiring. Assumes host._engine was just assigned and is non-null.
function wireEngineCallbacks(host: InitHost): void
{
    if (!host._engine)
    {
        return;
    }

    //Ping Lit so engine-readiness-gated chrome enables as soon as the engine lands instead of on the next clock tick.
    //The engine isn't a @state property, so this nudge is the only signal Lit gets that it became truthy.
    host.requestUpdate();

    host._engine.onFetchStart = () =>
    {
        beginLoadingPhase(host, 'weather-forecast');
    };
    host._engine.onFetchEnd = () =>
    {
        endLoadingPhase(host, 'weather-forecast');
    };
    host._engine.onBuildingsFetchStart = () =>
    {
        beginLoadingPhase(host, 'buildings');
    };
    host._engine.onBuildingsFetchEnd = () =>
    {
        endLoadingPhase(host, 'buildings');
    };
    host._engine.onWeatherUpdate = data =>
    {
        //Per-layer cloud breakdown is owned by the engine (it stashes low/mid/high and projectCloudScene reads them back to size the
        //three bands); the card only needs the aggregate for the cloud chip label.
        host._cloudCover         = data.cloudCover;
        host._timeRange          = data.timeRange;
        host._isLiveMode         = data.isLiveTime;
        host._chartSeries        = host._engine?.getTimelineSeries() ?? null; //hourly series the chart canvas plots
        //First weather update is also our cue for the initial label layout: by now the map style has loaded and the projection matrix
        //is available. Subsequent transforms refresh via onMapTransform.
        refreshOverlays(host);
    };
    //Cloud-disc hover is wired directly on the SVG via @mousemove/@mouseleave (render path's solar-svg), so no engine callback for it.
    //rAF-coalesced overlay refresh: MapLibre fires move events in bursts of 5-10/frame during inertial pan; without coalescing,
    //refreshOverlays + dome re-projection ran several times per frame (sun arc 96 samples, home silhouettes all footprints, dome
    //648 cells * 4 corners + 96 ribbon samples). The gate caps it at one full pass per frame.
    let overlayRaf: number | null = null;
    //Weather mode hides the HUD via CSS (opacity:0 + pointer-events:none). While there the projected sun arc, silhouettes
    //and chip anchors are invisible but refreshOverlays still re-projects them on every transform under auto-rotate.
    host._engine.onMapTransform = () =>
    {
        //If paused (off-screen or hidden tab) the browser still fires move events for tile-load completions, but nothing's visible -
        //skip the per-frame work. Resumes on the next render once the IntersectionObserver re-enables the engine.
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
            refreshOverlays(host);
        });
    };
    //WebGL context-loss handler. Does NOT auto-respawn: when the browser kills our context (typically the per-origin 8-16 cap hit in
    //editor preview), respawning here fires another getContext that kills another live context, looping until the session drowns in
    //errors. MapLibre's own context-restored path brings it back on leave/scroll/refocus; otherwise the next user config edit hits the
    //identity-change branch in updated() and spawns a fresh engine with no cascade in flight.
    host._engine.onContextLost = () =>
    {
        console.warn('[HELIOS] WebGL context lost. Auto-respawn disabled to avoid cascade in editor preview; the canvas will recover on the next user-driven config change.');
    };

    //Shadow compute (footprint projection + raster paint): the card shows a spinner chip top-right as a "shadows are
    //coming" signal while the cold-start recompute runs.
    host._engine.onShadowComputeStart = () =>
    {
        host._shadowBusy = true;
    };
    host._engine.onShadowComputeEnd = () =>
    {
        host._shadowBusy = false;
    };

    //Rate-limit banner trigger: fires when the Open-Meteo home-point fetch transitions in/out of HTTP 429 back-off. The card paints
    //an alert under the loading banner explaining why weather isn't refreshing.
    host._engine.onWeatherRateLimitChange = (rateLimited: boolean): void =>
    {
        host._weatherRateLimited = rateLimited;
    };

}
