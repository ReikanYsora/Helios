//Card init subsystem: home-coord resolution, visual-config hashing, engine bootstrap (debounce + construction), and the
//visibility observer that pauses animations off-screen.
//
//LitElement lifecycle hooks (setConfig, connectedCallback, disconnectedCallback, updated) stay on the card class because HA + Lit
//invoke them directly on the element; they delegate the work to the helpers here.

import type { HeliosConfig } from '../helios-config';
import { HeliosEngine } from '../helios-engine';
import { refreshHud, setAnimationsPaused, type HudHost } from './hud';
import type { ChartSeries } from './charts';


//Visual config keys the engine reacts to via updateConfig(): editor/YAML edits to these push into the live engine in place.
//Exhaustive on purpose - a missing key would leave a slider-dragged value stale until the next engine creation. Card-only
//state and identity inputs (home coords) are out. Colours come from the HA Energy palette.
export const VISUAL_CONFIG_KEYS = [
    //When set, feeds the engine sensor samples that override Open-Meteo for live + past irradiance; a change must refresh so the
    //override (or its absence) is picked up immediately.
    'solar-irradiance-entity',
    //Building option keys: a change triggers updateConfig -> _ensureBuildings -> _applyBuildings, which
    //re-interprets the cached raw footprints in memory (no Overpass re-fetch — the location key is unchanged).
    'display-radius',
    'building-cluster-radius',
    'building-count',
    'building-real-size',
    'building-height',
    'building-opacity',
    'auto-rotate-enabled',
    //camera-pitch-deg/bearing-deg/locked are deliberately NOT here: the editor pushes live previews through engine.setCamera* and
    //bakes the values into config; a fresh engine reads them from _initialBearing / _initialPitch.
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


//Structural surface the host card exposes to this module. Extends HudHost so refreshHud(host) lands cleanly inside the
//engine callbacks; the rest is the engine + init lifecycle state the bootstrap mutates.
export interface InitHost extends HudHost
{
    readonly config: HeliosConfig | undefined;
    readonly hass:   any;

    _engine?:            HeliosEngine;
    _cloudCover:         number;
    _timeRange:          { start: Date; end: Date } | null;
    _isLiveMode:         boolean;
    _chartSeries:        ChartSeries | null;

    _lastHomeKey:        string;
    _initInflight:       boolean;
    _visibilityObserver?: IntersectionObserver;
    //Document visibilitychange listener, stored on the host so disconnectedCallback can removeEventListener cleanly (per-card instance).
    _onVisibilityChange?: () => void;

    //Current HA theme polarity, used to seed a new engine so its basemap builds at the right style first time.
    themeIsDark(): boolean;
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
    initEngineNow(host);
}


//Build the engine + wire its callbacks back into card state. Bails (clearing the inflight flag so the caller
//retries next Lit cycle) if the card detached or the container / hass.config / coords aren't ready yet.
export function initEngineNow(host: InitHost): void
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
        //User-defined home altitude (m ASL) from HA General settings; may be undefined on older/unconfigured
        //installs - the engine and aux fetch then omit &elevation= and let Open-Meteo fall back to its own DEM.
        const elevation = host.hass.config.elevation;

        host._engine = new HeliosEngine(container, host.config, [lon, lat], elevation, host.themeIsDark());
        wireEngineCallbacks(host);
        //Seed the timeline window from the engine's synthetic fallback so the time-bar renders from the first
        //frame instead of staying hidden until the first weather push (which can be delayed on a slow load).
        if (!host._timeRange)
        {
            host._timeRange = host._engine.getTimelineRange();
        }
        host._initInflight = false;
    });
}


//Wires every engine-side callback into card state. Assumes host._engine was just assigned and is non-null.
function wireEngineCallbacks(host: InitHost): void
{
    if (!host._engine)
    {
        return;
    }

    //Ping Lit so engine-readiness-gated chrome enables as soon as the engine lands instead of on the next clock tick.
    //The engine isn't a @state property, so this nudge is the only signal Lit gets that it became truthy.
    host.requestUpdate();

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
        refreshHud(host);
    };
    //Cloud-disc hover is wired directly on the SVG via @mousemove/@mouseleave (render path's solar-svg), so no engine callback for it.
    //rAF-coalesced overlay refresh: the engine fires transform events in bursts of 5-10/frame during inertial pan; without coalescing,
    //refreshHud + dome re-projection ran several times per frame (sun arc 96 samples, home silhouettes all footprints, dome
    //648 cells * 4 corners + 96 ribbon samples). The gate caps it at one full pass per frame.
    let overlayRaf: number | null = null;
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
            refreshHud(host);
        });
    };
}
