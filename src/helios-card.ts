import { LitElement, html, svg, PropertyValues, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import
{
    HeliosEngine,
    type HeliosConfig,
    DEFAULT_SUN_COLOR_HEX,
    DEFAULT_CLOUD_COLOR_HEX,
    DEFAULT_PV_COLOR_HEX,
    DEFAULT_BATTERY_COLOR_HEX
} from './helios-engine';
import { computePvPower } from './helios-sun';
import { pickTranslations } from './i18n';
import { heliosCardStyles } from './helios-card-css';
//Side-effect import: registers <helios-color-picker> and
//<helios-card-editor> as custom elements, plus exposes the cfgHex /
//formatDate helpers used by the card.
import { cfgHex, formatDate } from './helios-config';
import './helios-config';


//Custom-card registration

declare global
{
    interface Window
    {
        customCards?: Array<{
            type:        string;
            name:        string;
            description: string;
            preview?:    boolean;
        }>;
    }
}

//Card name and description in the HA card picker, shown before any
//hass instance is available, so we read the language from navigator.
const _bootI18n = pickTranslations(typeof navigator !== 'undefined' ? navigator.language : 'en');

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'helios-card'))
{
    window.customCards.push(
    {
        type:        'helios-card',
        name:        _bootI18n.cardName,
        description: _bootI18n.cardDescription,
        preview:     true
    });
}

//Install banner. Same shape as the styled "X-CARD vY.Z IS INSTALLED"
//lines other HACS frontends print, two adjacent chips with the card
//name on the left and the build version on the right. Guarded so a
//bundle reload (HMR, several Helios cards on the same dashboard, ...)
//does not print it twice. The version is inlined at build time from
//package.json by vite.config.ts.
{
    const flagKey = '__heliosBannerPrinted';
    const w = window as unknown as Record<string, unknown>;
    if (!w[flagKey])
    {
        w[flagKey] = true;
        const labelStyle   = 'background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px 0 0 4px;font-weight:bold;';
        const versionStyle = 'background:#1f2937;color:#f59e0b;padding:2px 8px;border-radius:0 4px 4px 0;font-weight:bold;';
        console.info(
            `%c☀ HELIOS%c v${__HELIOS_VERSION__}`,
            labelStyle,
            versionStyle
        );
        console.info(
            `%c☀ HELIOS%c run window.heliosStats() in the console for a live config + engine dump`,
            labelStyle,
            'color:#6b7280;font-style:italic;'
        );
    }
}


//Module-level registry of every live `<helios-card>` instance. Hooked
//by the card's connectedCallback / disconnectedCallback so that
//`window.heliosStats()` can enumerate every card currently on screen,
//dump its (sanitised) config and ask each engine for its live state.
//Defined here rather than as a static on the class so the global
//`heliosStats()` function below can close over it without forcing the
//class to be fully constructed first.
const _liveCards = new Set<HeliosCard>();

//Public diagnostic command, exposed once on first bundle load. Returns
//a JSON-safe snapshot AND prints a grouped, human-readable dump to the
//console. The dump includes the build version, the lifecycle counters
//tracked by the engine, and one section per card (config + engine
//state). All config values are JSON-safe and OK to paste publicly
//when filing an issue (no API keys are stored, the basemap is
//OpenFreeMap which needs none). Re-invoking from
//the console refreshes the snapshot.
{
    interface HeliosWin extends Window
    {
        heliosStats?: () => Record<string, unknown>;
        __heliosStats?: Record<string, unknown>;
    }
    const w = window as HeliosWin;
    if (!w.heliosStats)
    {
        w.heliosStats = () =>
        {
            const cards = Array.from(_liveCards).map((c, i) =>
            ({
                index:  i,
                snapshot: c.getStatsSnapshot()
            }));

            const out: Record<string, unknown> =
            {
                version:   __HELIOS_VERSION__,
                cards:     cards.length,
                lifecycle: w.__heliosStats ?? null,
                details:   cards
            };

            const label    = 'background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px;font-weight:bold;';
            const heading  = 'color:#f59e0b;font-weight:bold;';
            console.groupCollapsed(`%c☀ HELIOS stats%c v${__HELIOS_VERSION__}, ${cards.length} card${cards.length === 1 ? '' : 's'} alive`,
                label, 'color:#6b7280;font-weight:normal;');
            console.log('%cLifecycle counters', heading, w.__heliosStats ?? '(none yet)');
            cards.forEach((c, i) =>
            {
                const snap = c.snapshot;
                console.groupCollapsed(`%cCard #${i + 1}`, heading);
                console.log('config:', snap.config);
                console.log('engine:', snap.engine);
                console.log('pv:',     snap.pv);
                console.groupEnd();
            });
            console.groupEnd();
            return out;
        };
    }
}


//Debug-only home-location override. Set from the browser console via
//`setHeliosLocation(lat, lon)` to render every live card as if HA's
//home coordinates were elsewhere; `clearHeliosLocation()` reverts.
//Stored on `window` only (no localStorage), so a page refresh always
//restores hass.config. Each card reads through _getHomeCoords() which
//prefers the override, and we kick a reinit on every live card so the
//engine, weather fetch and PV calibration cache all swap to the new
//bucket immediately.
{
    interface HeliosWin extends Window
    {
        setHeliosLocation?:        (lat: number, lon: number) => void;
        clearHeliosLocation?:      () => void;
        __heliosLocationOverride?: { lat: number; lon: number };
    }
    const w = window as HeliosWin;

    const label = 'background:#f59e0b;color:#1f2937;padding:2px 8px;border-radius:4px;font-weight:bold;';

    if (!w.setHeliosLocation)
    {
        w.setHeliosLocation = (lat: number, lon: number) =>
        {
            if (typeof lat !== 'number' || typeof lon !== 'number'
                || !isFinite(lat)        || !isFinite(lon)
                || lat < -90  || lat > 90
                || lon < -180 || lon > 180)
            {
                console.warn('☀ HELIOS: setHeliosLocation expected (lat[-90..90], lon[-180..180]), got', lat, lon);
                return;
            }
            w.__heliosLocationOverride = { lat, lon };
            console.info(
                `%c☀ HELIOS%c location override → ${lat.toFixed(5)}, ${lon.toFixed(5)} (refresh page to revert)`,
                label, 'color:#6b7280;');
            for (const card of _liveCards) card.invalidateLocation();
        };
    }

    if (!w.clearHeliosLocation)
    {
        w.clearHeliosLocation = () =>
        {
            if (!w.__heliosLocationOverride)
            {
                console.info('☀ HELIOS: no location override active');
                return;
            }
            w.__heliosLocationOverride = undefined;
            console.info(
                `%c☀ HELIOS%c location override cleared, reverting to hass.config`,
                label, 'color:#6b7280;');
            for (const card of _liveCards) card.invalidateLocation();
        };
    }
}


//Main card


@customElement('helios-card')
export class HeliosCard extends LitElement
{
    //Depth-modulation bounds for the solar overlay. Each pair is the
    //FAR end (back of the day's loop) and the NEAR end (front), with
    //per-element values linearly interpolated using the engine's
    //nearness factor in [0..1].
    private static readonly OUTLINE_FAR  = 1.5;
    private static readonly OUTLINE_NEAR = 5.0;
    private static readonly SEGMENT_FAR  = 1.0;
    private static readonly SEGMENT_NEAR = 4.0;
    //Sun-disc radii in px. The inner irradiance fill needs ~9 px of
    //diameter at apex to read as an annulus rather than a dot.
    private static readonly SUN_R_FAR    = 10.0;
    private static readonly SUN_R_NEAR   = 20.0;
    private static readonly SUN_RIM_WIDTH = 1.5;
    //Faint tint inside the rim so the "empty sun" at sunrise/sunset
    //still reads as a disc, not a coloured spot.
    private static readonly SUN_FILL_OPACITY_BG = 0.20;

    //Below-horizon segments are dots whose diameter IS the stroke
    //width. Scaled down vs daytime so the night portion of the loop
    //reads as a quieter trace, it indicates where the sun goes
    //without competing with the lit half.
    private static readonly NIGHT_STROKE_FACTOR = 0.5;

    @property({ attribute: false }) public hass!: any;
    @property({ attribute: false }) private config!: HeliosConfig;

    @state() private _engine?:        HeliosEngine;
    @state() private _now             = new Date();
    //Cloud-cover values shown in the on-ground disc hover popup.
    @state() private _cloudCover      = -1;
    //Screen-space layout of the always-visible labels and leader lines,
    //recomputed via engine.projectHomeLabelLayout() on every map
    //transform. null while the map is still loading.
    @state() private _labelLayout:    {
        cloudLabel:        { x: number; y: number };
        pvLabel:           { x: number; y: number };
        batterySocLabel:   { x: number; y: number };
        batteryPowerLabel: { x: number; y: number };
        ringEdge:          { x: number; y: number };
        home:              { x: number; y: number };
    } | null = null;
    //Photovoltaic production state, populated when `pv-power-entity`
    //is configured. Live value from hass.states + historical series
    //from HA's history API for the dedicated chart.
    @state() private _pvCurrent: number | null = null;
    @state() private _pvUnit:    string        = '';
    @state() private _pvHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    private _pvFetchKey  = '';
    private _pvFetching  = false;
    //Most recent PV history fetch outcome, surfaced via
    //`window.heliosStats()`. Replaces what we used to print as
    //`[HELIOS] PV history sensor.xxx: N raw -> M samples over H h`.
    private _pvHistoryDiagnostics: { rawEntries: number; samples: number; windowH: number } | null = null;
    //Idempotency flag for the one-time wipe of legacy PV calibration
    //buffers (see _wipeLegacyPvCalibStorage). Per-instance so we
    //attempt the cleanup at most once per card mount; the persisted
    //flag in localStorage protects across reloads.
    private _pvCalibWiped = false;
    //Rolling buffer of state samples. For cumulative-energy sensors
    //this gives a "last minute" instantaneous rate, fresher than the
    //historical fetch which only refreshes per timeline range.
    private _pvSampleBuffer: Array<{ t: number; v: number }> = [];
    //Home-battery state, populated when at least one of
    //`battery-soc-entity` / `battery-power-entity` is configured.
    //Live readings; historical series lives in the *History fields
    //below. Units are kept alongside the values so the chip can
    //format kW vs W without re-reading the state.
    @state() private _batterySoc:        number | null = null;
    @state() private _batteryPower:      number | null = null;
    @state() private _batteryPowerUnit:  string        = '';
    //Historical series for the active timeline range. Both battery
    //entities are fetched in a single `history/history_during_period`
    //WebSocket call when both are set.
    @state() private _batterySocHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    @state() private _batteryPowerHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    private _batteryFetchKey  = '';
    private _batteryFetching  = false;
    //Screen-space layout of the solar arc, sun, and incidence ray.
    //Recomputed via engine.projectSunScene() on every map transform
    //and every clock tick (sun position moves with time, refreshed
    //at 1 Hz in live mode).
    @state() private _sunScene: {
        arc:      Array<{
            x: number; y: number;
            irradiance: number; nearness: number; belowHorizon: boolean;
        }>;
        sun:      { x: number; y: number; irradiance: number; altitude: number; nearness: number };
        home:     { x: number; y: number };
        daylight: number;
        sunrise:  { x: number; y: number; angleRad: number; time: Date } | null;
        sunset:   { x: number; y: number; angleRad: number; time: Date } | null;
    } | null = null;
    //Screen-space layout of the cloud-cover disc + 100 % reference
    //ring, projected through engine.projectCloudScene() on every map
    //transform and clock tick. The disc no longer lives as a
    //MapLibre fill layer (terrain bent it out of shape with LiDAR
    //precision on); it's now a pair of SVG polygons drawn alongside
    //the sun arc, anchored at the home's terrain elevation so it
    //stays a true circle whatever the ground does beneath it.
    @state() private _cloudScene: {
        discLow:    Array<{ x: number; y: number }>;
        discMid:    Array<{ x: number; y: number }>;
        discHigh:   Array<{ x: number; y: number }>;
        ring:       Array<{ x: number; y: number }>;
        cloudHex:   string;
        cloudPct:   number;
        cloudLow:   number;
        cloudMid:   number;
        cloudHigh:  number;
    } | null = null;
    //Per-polygon silhouettes of the home building(s) in screen
    //space: each entry has the projected base ring and the
    //projected top ring of one home polygon. The card paints
    //both rings plus a quad per outer-ring edge into the cloud-
    //disc SVG mask, the union covers the exact extruded prism
    //even for concave footprints. Re-projected on every map
    //transform so rotation tracks.
    @state() private _homeSilhouettes: Array<{
        base: Array<{ x: number; y: number }>;
        top:  Array<{ x: number; y: number }>;
    }> = [];
    //Hover state on the home hitbox. Drives a sun-coloured glow halo
    //around the home silhouette so the user reads the focal building
    //as interactive before clicking.
    @state() private _homeHover = false;
    //Hover state for the today-cumulative chart in the dashboard. ms
    //epoch of the cursor position on the X axis; null when the pointer
    //is outside the chart or the chart isn't shown.
    @state() private _dashChartHoverTs: number | null = null;
    @state() private _chartSeries: {
        times:      Date[];
        irradiance: number[];
        cloud:      number[];
    } | null = null;
    @state() private _fetching        = false;
    @state() private _timeRange:    { start: Date; end: Date } | null = null;
    @state() private _selectedTime: Date | null = null;
    @state() private _isLiveMode    = true;
    //True while the engine is fetching the LiDAR shadow payload from
    //the upstream provider and rasterising it for the image source.
    //Drives the spinner chip pinned top-right of the map so the user
    //knows the shadow layer they're about to see is still computing.
    @state() private _shadowBusy    = false;
    //True while the home is "focused": the existing overlay HUD is
    //hidden, the camera is eased to a closer / more pitched pose,
    //and a detail dashboard panel takes over. Toggled by clicking
    //the home hitbox (off → on) or clicking anywhere on the panel
    //(on → off). Engine.setDetailMode drives the camera lerp;
    //CSS class .detail-active on ha-card fades out every overlay.
    @state() private _detailMode    = false;

    private _timer?:           number;
    private _lastHomeKey       = '';
    private _lastConfigSig     = '';
    private _initInflight      = false;

    //Visual config keys that the engine reacts to via updateConfig().
    //Anything outside this list (e.g. home coords, which is an
    //identity input handled separately) is irrelevant for live
    //updates.
    private static readonly _VISUAL_CONFIG_KEYS = [
        'show-labels',
        'sun-color',
        'cloud-color',
        //pv-color is card-level; included so the sig changes and Lit
        //re-renders the chart. pv-power-entity triggers a fresh fetch.
        'pv-color',
        'pv-power-entity',
        //map-style triggers a MapLibre setStyle(), the engine reloads
        //the cloud disc, buildings and labels on the resulting
        //`style.load`.
        'map-style',
        'battery-soc-entity',
        'battery-power-entity',
        'battery-color',
        //card-theme is card-level (light/dark skin) but must be in the
        //sig so Lit re-renders when the user toggles it.
        'card-theme',
        //building-radius / cluster-radius invalidate cache and refetch;
        //opacity / color are cheap paint-property updates.
        'building-radius',
        'building-cluster-radius',
        'building-opacity',
        'building-color',
        'pixel-ratio'
    ] as const;

    //Cheap stable signature of the visual config, used to skip
    //updateConfig() when nothing the engine cares about has changed.
    private _computeConfigSig(): string
    {
        if (!this.config)
        {
            return '';
        }
        return HeliosCard._VISUAL_CONFIG_KEYS
            .map(k => `${k}=${this.config[k] ?? ''}`)
            .join('|');
    }


    //HA card lifecycle

    public setConfig(config: HeliosConfig): void
    {
        if (!config)
        {
            throw new Error('Invalid HELIOS configuration');
        }
        this.config = { ...config };
    }

    static getConfigElement(): HTMLElement
    {
        return document.createElement('helios-card-editor');
    }

    static getStubConfig(): HeliosConfig
    {
        return {};
    }

    //Diagnostic snapshot returned to `window.heliosStats()`. Includes
    //the live config, the engine state snapshot when the engine is
    //up, and a small PV block summarising the most recent history
    //fetch outcome. JSON-safe, no DOM references, no PII: the engine
    //snapshot strips its own hass.config-sourced lat/lon, and the loop
    //below additionally omits the `home-latitude` / `home-longitude`
    //card-config override so user-supplied home coordinates never leak
    //into the diagnostics output either.
    public getStatsSnapshot(): {
        config: Record<string, unknown>;
        engine: Record<string, unknown> | null;
        pv:     Record<string, unknown>;
    }
    {
        const cfg: Record<string, unknown> = {};
        if (this.config)
        {
            for (const [k, v] of Object.entries(this.config))
            {
                //Skip user-supplied home coordinates so the snapshot
                //stays PII-free, matching the engine-side stripping.
                if (k === 'home-latitude' || k === 'home-longitude') continue;
                cfg[k] = v;
            }
        }
        return {
            config: cfg,
            engine: this._engine ? this._engine.getStatsSnapshot() : null,
            pv:
            {
                entityConfigured: typeof this.config?.['pv-power-entity'] === 'string'
                    && (this.config['pv-power-entity'] as string).length > 0,
                unit:             this._pvUnit || null,
                lastHistory:      this._pvHistoryDiagnostics,
                calibrationK:     this._pvCalibK()
            }
        };
    }

    //Called by the global `setHeliosLocation` / `clearHeliosLocation`
    //debug helpers. Clears the cached home key so the next `updated()`
    //pass sees `identityChanged` and re-inits the engine against the
    //new coordinates, then schedules a re-render to trigger that pass.
    //
    //The visual editor does NOT route through here when the user edits
    //`home-latitude` / `home-longitude`: it dispatches `config-changed`,
    //HA calls `setConfig()`, Lit re-renders, and `updated()` notices
    //that `_getHomeCoords()` now resolves to a different key. The
    //engine re-init falls out of that natural identity-drift path.
    public invalidateLocation(): void
    {
        this._lastHomeKey = '';
        this.requestUpdate();
    }

    //Resolves the home coordinates. Three-tier precedence, in order:
    //  1. `window.__heliosLocationOverride` , the debug helper set via
    //     the global `setHeliosLocation()` console function. Highest
    //     priority so a developer can always force a location regardless
    //     of card config.
    //  2. The card config keys `home-latitude` / `home-longitude`.
    //     Applied only when BOTH parse as numbers (or numeric strings)
    //     that are finite and in valid range (lat -90..90, lon
    //     -180..180). Anything else , including missing, partial, the
    //     empty string, booleans or arrays which `Number()` would
    //     happily coerce to 0 , is silently rejected so a half-edited
    //     YAML never warps the card to {0,0}.
    //  3. Home Assistant's configured home at
    //     hass.config.{latitude,longitude}.
    //Returns null only when none of the three has a usable pair.
    private _getHomeCoords(): { lat: number; lon: number } | null
    {
        const w = window as unknown as { __heliosLocationOverride?: { lat: number; lon: number } };
        const o = w.__heliosLocationOverride;
        if (o && typeof o.lat === 'number' && typeof o.lon === 'number'
              && isFinite(o.lat) && isFinite(o.lon))
        {
            return { lat: o.lat, lon: o.lon };
        }

        const cfgLat = this._parseConfigCoord(this.config?.['home-latitude']);
        const cfgLon = this._parseConfigCoord(this.config?.['home-longitude']);
        if (cfgLat !== null && cfgLon !== null
            && cfgLat >= -90  && cfgLat <= 90
            && cfgLon >= -180 && cfgLon <= 180)
        {
            return { lat: cfgLat, lon: cfgLon };
        }

        const lat = this.hass?.config?.latitude;
        const lon = this.hass?.config?.longitude;
        if (typeof lat !== 'number' || typeof lon !== 'number') return null;
        return { lat, lon };
    }

    //Defensive parser for `home-latitude` / `home-longitude` raw values
    //coming out of the card config. The config is typed `unknown`, so
    //bare `Number()` is unsafe: `Number('')`, `Number(false)`, `Number([])`,
    //`Number(null)` all return 0, which is a finite, in-range latitude
    //(Atlantic Ocean off the Gulf of Guinea) and would silently win the
    //range check in `_getHomeCoords`. Accept numbers as-is and parse
    //strings that look like a decimal number; reject everything else.
    private _parseConfigCoord(raw: unknown): number | null
    {
        if (typeof raw === 'number')
        {
            return isFinite(raw) ? raw : null;
        }
        if (typeof raw === 'string')
        {
            const trimmed = raw.trim();
            if (trimmed === '') return null;
            const n = Number(trimmed);
            return isFinite(n) ? n : null;
        }
        return null;
    }

    //Sizing for masonry view. 1 unit = 50 px so 12 ≈ 600 px.
    public getCardSize(): number
    {
        return 12;
    }

    //Sizing for sections view (current). 1 row ≈ 56 px and 1 col ≈ 30 px
    //(at section width 360 px). Default 9 columns x 11 rows ≈ 540 x 624 px.
    //
    //min_columns is kept at 6 (not 9) because Home Assistant will
    //refuse to render the card with an "Invalid configuration"
    //placeholder when the containing section happens to have fewer
    //than min_columns slots available. 6 is the sweet spot: still a
    //multiple of 3 (HA's recommended granularity), small enough to
    //fit any section, large enough that the 11-day timeline labels
    //stay readable when the user resizes down to that minimum.
    public getGridOptions(): {
        rows:        number;
        columns:     number;
        min_rows:    number;
        max_rows:    number;
        min_columns: number;
        max_columns: number;
    }
    {
        return {
            rows:        11,
            columns:     9,
            min_rows:    6,
            max_rows:    24,
            min_columns: 6,
            max_columns: 12
        };
    }

    public connectedCallback(): void
    {
        super.connectedCallback();
        _liveCards.add(this);
        this._tick();
        this._timer = window.setInterval(() => this._tick(), 1000);
        this._initVisibilityObserver();
        //Detect early whether we're rendered inside HA's dashboard
        //editor preview. The editor instantiates a fresh helios-card
        //on every config change and each engine takes a WebGL
        //context, Safari mobile caps at ~8 and starts recycling
        //past that, which is the root cause of the FPS drift and
        //iOS black-screen lockup. We skip the engine entirely for
        //preview cards (the dashboard card on the actual page keeps
        //its full rendering).
        this._isInEditorPreview = this._detectEditorPreview();
    }

    //Cached at connectedCallback time; does not change for the
    //lifetime of the card instance.
    private _isInEditorPreview = false;

    private _detectEditorPreview(): boolean
    {
        //Tag list collected from inspecting HA's dashboard editor
        //DOM: the modal dialog wrapping each preview, the element
        //editor, plus a couple of generic fallbacks. We walk every
        //ancestor (including across shadow-root boundaries via
        //node.host) until we hit one matching, or run out of hops.
        const EDITOR_TAGS = new Set([
            'hui-dialog-edit-card',
            'hui-card-element-editor',
            'hui-edit-card',
            'hui-card-editor'
        ]);
        let node: Node | null = this;
        let hops = 0;
        while (node && hops++ < 40)
        {
            if (node instanceof ShadowRoot)
            {
                node = node.host;
                continue;
            }
            if (node instanceof Element)
            {
                const tag = node.tagName?.toLowerCase();
                if (tag && EDITOR_TAGS.has(tag)) return true;
            }
            node = (node as Node).parentNode;
        }
        return false;
    }

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        _liveCards.delete(this);
        window.clearInterval(this._timer);
        this._visibilityObserver?.disconnect();
        this._visibilityObserver = undefined;
        //If the card dies before the debounce fires, drop the pending
        //init, short-lived editor preview cards never get an engine.
        if (this._initDebounceTimer !== undefined)
        {
            window.clearTimeout(this._initDebounceTimer);
            this._initDebounceTimer = undefined;
            this._initInflight      = false;
        }
        this._engine?.cleanup();
        this._engine = undefined;
    }

    //IntersectionObserver, pause every CSS animation and every SVG
    //SMIL animation when the card scrolls out of the viewport. The
    //rotation loop (a requestAnimationFrame in the engine) is left
    //running because (a) the browser auto-throttles rAF on hidden
    //tabs and (b) the card looks alive when the user scrolls back.
    //Only the SVG overlay animations are paused, they're the ones
    //that run continuously regardless of map state.
    private _visibilityObserver?: IntersectionObserver;

    private _initVisibilityObserver(): void
    {
        if (this._visibilityObserver || typeof IntersectionObserver === 'undefined')
        {
            return;
        }
        this._visibilityObserver = new IntersectionObserver(entries =>
        {
            for (const entry of entries)
            {
                this._setAnimationsPaused(!entry.isIntersecting);
            }
        }, { threshold: 0 });
        this._visibilityObserver.observe(this);
    }

    private _setAnimationsPaused(paused: boolean): void
    {
        this.classList.toggle('helios-paused', paused);
        //SMIL animations are not controlled by CSS animation-play-state.
        //Walk the shadow tree and call (un)pauseAnimations() on every
        //SVG root we find. Both methods are no-ops on browsers that
        //don't support them, so we don't need to feature-detect.
        const root = this.shadowRoot;
        if (!root) return;
        const svgs = root.querySelectorAll('svg');
        for (const svg of Array.from(svgs))
        {
            const s = svg as SVGSVGElement & {
                pauseAnimations?:  () => void;
                unpauseAnimations?: () => void;
            };
            try
            {
                if (paused) s.pauseAnimations?.();
                else        s.unpauseAnimations?.();
            }
            catch (_) {}
        }
    }

    //Engine init policy: re-init only when one of the *identity inputs*
    //changes (API key, home coordinates, map style). We resize the
    //existing engine when the container reflows, we never tear down
    //the MapLibre stack just because a sibling fragment re-rendered.
    //Doing so would trash the user's in-progress edits in the
    //dashboard editor.
    protected updated(_changedProperties: PropertyValues): void
    {
        if (!this.hass?.config || !this.config)
        {
            return;
        }

        const coords = this._getHomeCoords();
        if (!coords) return;

        const { lat, lon } = coords;

        //One-time wipe of the obsolete auto-calibration buffer left
        //by older releases (localStorage + HA frontend.user_data).
        //Idempotent via a flag in localStorage.
        if (!this._pvCalibWiped)
        {
            this._pvCalibWiped = true;
            this._wipeLegacyPvCalibStorage();
        }

        const homeKey  = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        const identityChanged = homeKey !== this._lastHomeKey;

        if (!this._engine || identityChanged)
        {
            if (this._initInflight)
            {
                return;
            }
            this._lastHomeKey   = homeKey;
            this._lastConfigSig = this._computeConfigSig();
            this._initEngine();
            return;
        }

        //Identity stable, only push config tweaks down if the visual
        //config has actually changed. Without this guard we'd call
        //updateConfig() on every Lit re-render (e.g. every second from
        //the clock tick, or every time a @state changes), which would
        //rebuild the GeoJSON of thousands of points and freeze the page.
        const sig = this._computeConfigSig();
        if (sig !== this._lastConfigSig)
        {
            this._lastConfigSig = sig;
            this._engine.updateConfig(this.config);
        }

        this._refreshPv();
        this._refreshBattery();
    }


    //Photovoltaic production
    //
    //When the user configures `pv-power-entity`, the card pulls two
    //flavours of data from Home Assistant:
    //  - the entity's current state (read synchronously from
    //    hass.states on every render cycle), shown as a chip below
    //    the home with a leader line back to the marker.
    //  - the entity's historical state changes over the active time
    //    range (fetched asynchronously via the history WebSocket
    //    command), plotted on the dedicated graph above the main
    //    timeline. Only past + current data is fetched, the future
    //    half of the timeline range is intentionally left blank
    //    because production data simply doesn't exist yet.

    private _refreshPv(): void
    {
        const entity = String(this.config?.['pv-power-entity'] ?? '').trim();

        if (!entity || !this.hass)
        {
            //Reset everything when the user clears the entity field
            //so the chip and graph immediately disappear instead of
            //sticking around with stale data.
            if (this._pvCurrent !== null || this._pvHistory !== null)
            {
                this._pvCurrent = null;
                this._pvHistory = null;
                this._pvUnit    = '';
            }
            this._pvFetchKey = '';
            return;
        }

        //Live state read, always cheap, runs on every Lit cycle.
        const stateObj = this.hass.states?.[entity];
        if (stateObj)
        {
            const v = parseFloat(stateObj.state);
            const next = isFinite(v) ? v : null;
            if (next !== this._pvCurrent)
            {
                this._pvCurrent = next;
            }
            const unit = stateObj.attributes?.unit_of_measurement ?? '';
            if (unit !== this._pvUnit)
            {
                this._pvUnit = unit;
            }

            //Append the freshly-read state to the rolling buffer if
            //the entity timestamp moved forward since last cycle.
            //We trim entries older than 5 min so the buffer stays
            //tiny even on entities that update many times per
            //second.
            if (next !== null)
            {
                const ts = stateObj.last_updated
                    ? new Date(stateObj.last_updated).getTime()
                    : Date.now();
                const buf = this._pvSampleBuffer;
                const last = buf.length > 0 ? buf[buf.length - 1] : null;
                if (!last || ts > last.t)
                {
                    buf.push({ t: ts, v: next });
                    const cutoff = Date.now() - 5 * 60 * 1000;
                    while (buf.length > 1 && buf[0].t < cutoff)
                    {
                        buf.shift();
                    }
                }
            }
        }
        else
        {
            if (this._pvCurrent !== null)
            {
                this._pvCurrent = null;
            }
            //Drop the buffer when the entity disappears so we don't
            //serve stale samples after the user clears the config.
            if (this._pvSampleBuffer.length > 0)
            {
                this._pvSampleBuffer = [];
            }
        }

        //History fetch, only when the (entity, range) tuple changes.
        //Without this guard we'd reissue the WebSocket command on
        //every Lit cycle (e.g. every clock tick) and the dashboard
        //would queue thousands of identical requests.
        if (!this._timeRange || this._pvFetching)
        {
            return;
        }
        const rangeKey = `${this._timeRange.start.getTime()}|${this._timeRange.end.getTime()}`;
        const fetchKey = `${entity}@${rangeKey}`;
        if (fetchKey === this._pvFetchKey)
        {
            return;
        }
        this._pvFetchKey = fetchKey;
        this._fetchPvHistory(entity, this._timeRange.start, this._timeRange.end);
    }

    //Battery overlay, pulls live state from hass.states on every Lit
    //cycle (no rolling buffer like PV, battery entities are typically
    //power sensors that already expose an instantaneous reading) and,
    //when at least one entity is configured AND the timeline range is
    //set, fetches a historical series so the chip can show what the
    //battery was doing at any past instant the user scrubs to. The
    //fetch is gated on a `(socEntity, powerEntity, range)` tuple so
    //we don't reissue the WS call on every render cycle.
    private _refreshBattery(): void
    {
        if (!this.hass)
        {
            return;
        }
        const socEntity   = String(this.config?.['battery-soc-entity']   ?? '').trim();
        const powerEntity = String(this.config?.['battery-power-entity'] ?? '').trim();

        //SoC, clamp to [0, 100] because some BMS entities momentarily
        //report 100.5 % during the absorption phase or briefly drop
        //negative around the calibration cycle, neither of which is
        //meaningful to the user.
        let nextSoc: number | null = null;
        if (socEntity)
        {
            const so = this.hass.states?.[socEntity];
            const v  = so ? parseFloat(so.state) : NaN;
            if (isFinite(v))
            {
                nextSoc = Math.max(0, Math.min(100, v));
            }
        }
        if (nextSoc !== this._batterySoc)
        {
            this._batterySoc = nextSoc;
        }

        //Power, keep the sign (positive = charging, negative =
        //discharging) verbatim from the entity. Unit is captured so
        //the chip renderer can format kW vs W; we don't normalise
        //here because the entity's own unit IS the source of truth
        //(some BMS expose W, others kW).
        let nextPower: number | null = null;
        let nextUnit:  string        = '';
        if (powerEntity)
        {
            const so = this.hass.states?.[powerEntity];
            const v  = so ? parseFloat(so.state) : NaN;
            if (isFinite(v))
            {
                nextPower = v;
                nextUnit  = so.attributes?.unit_of_measurement ?? '';
            }
        }
        if (nextPower !== this._batteryPower)
        {
            this._batteryPower = nextPower;
        }
        if (nextUnit !== this._batteryPowerUnit)
        {
            this._batteryPowerUnit = nextUnit;
        }

        //Drop history series and reset the fetch key when the user
        //clears all battery entity fields, so a stale graph doesn't
        //linger after the config goes blank.
        if (!socEntity && !powerEntity)
        {
            if (this._batterySocHistory !== null)   { this._batterySocHistory   = null; }
            if (this._batteryPowerHistory !== null) { this._batteryPowerHistory = null; }
            this._batteryFetchKey = '';
            return;
        }

        //History fetch, only when the (entities, range) tuple changed.
        //Without this guard we'd reissue the WS command on every Lit
        //cycle (e.g. every clock tick).
        if (!this._timeRange || this._batteryFetching)
        {
            return;
        }
        const rangeKey = `${this._timeRange.start.getTime()}|${this._timeRange.end.getTime()}`;
        const fetchKey = `${socEntity}+${powerEntity}@${rangeKey}`;
        if (fetchKey === this._batteryFetchKey)
        {
            return;
        }
        this._batteryFetchKey = fetchKey;
        this._fetchBatteryHistory(socEntity, powerEntity, this._timeRange.start, this._timeRange.end);
    }

    //Single-call history fetch for the battery overlay. Both entities
    //(when configured) are bundled into one `entity_ids` array so we
    //pay one WS roundtrip instead of two. Either side of the result
    //may end up empty (entity not yet existing, no state changes in
    //range, etc.) and that's fine, the chip will show only the side
    //that did return data.
    private async _fetchBatteryHistory(
        socEntity: string, powerEntity: string, start: Date, end: Date
    ): Promise<void>
    {
        if (!this.hass?.callWS)
        {
            return;
        }
        this._batteryFetching = true;
        try
        {
            //History only exists up to "now", the future half of the
            //timeline has no battery data. Clamp the fetch end so we
            //don't waste a roundtrip on empty future buckets.
            const now = new Date();
            const fetchEnd = end > now ? now : end;
            if (start >= fetchEnd)
            {
                if (socEntity)   { this._batterySocHistory   = { times: [], values: [] }; }
                if (powerEntity) { this._batteryPowerHistory = { times: [], values: [] }; }
                return;
            }

            const ids: string[] = [];
            if (socEntity)   { ids.push(socEntity);   }
            if (powerEntity) { ids.push(powerEntity); }

            const result: any = await this.hass.callWS({
                type:             'history/history_during_period',
                start_time:       start.toISOString(),
                end_time:         fetchEnd.toISOString(),
                entity_ids:       ids,
                minimal_response: true,
                no_attributes:    true
            });

            const parseSeries = (arr: any[]): { times: Date[]; values: number[] } =>
            {
                const times:  Date[]   = [];
                const values: number[] = [];
                for (const item of arr ?? [])
                {
                    const stateStr =
                        typeof item?.s     === 'string' ? item.s :
                        typeof item?.state === 'string' ? item.state :
                        null;
                    if (stateStr === null
                        || stateStr === 'unavailable'
                        || stateStr === 'unknown'
                        || stateStr === '')
                    {
                        continue;
                    }
                    const v = parseFloat(stateStr);
                    if (!isFinite(v))
                    {
                        continue;
                    }
                    let ts: Date | null = null;
                    if (typeof item?.lu === 'number')
                    {
                        ts = new Date(item.lu * 1000);
                    }
                    else if (typeof item?.last_updated === 'string')
                    {
                        ts = new Date(item.last_updated);
                    }
                    else if (typeof item?.last_changed === 'string')
                    {
                        ts = new Date(item.last_changed);
                    }
                    if (!ts || isNaN(ts.getTime()))
                    {
                        continue;
                    }
                    times.push(ts);
                    values.push(v);
                }
                return { times, values };
            };

            if (socEntity)
            {
                const series = parseSeries(result?.[socEntity] ?? []);
                //Clamp SoC samples to [0, 100] in the history too, same
                //out-of-range tolerance as the live read.
                series.values = series.values.map(v => Math.max(0, Math.min(100, v)));
                this._batterySocHistory = series;
            }
            else
            {
                this._batterySocHistory = null;
            }
            if (powerEntity)
            {
                this._batteryPowerHistory = parseSeries(result?.[powerEntity] ?? []);
            }
            else
            {
                this._batteryPowerHistory = null;
            }
        }
        catch (e)
        {
            console.warn('[HELIOS] battery history fetch failed:', e);
            this._batterySocHistory   = { times: [], values: [] };
            this._batteryPowerHistory = { times: [], values: [] };
        }
        finally
        {
            this._batteryFetching = false;
        }
    }

    //Locate the history sample at or before `time` and return its
    //value, or null if the time falls outside the fetched window. A
    //60 s grace at the tail keeps "scrub to live" resolving cleanly
    //(same convention as the PV chip).
    private _batterySampleAtTime(
        hist: { times: Date[]; values: number[] } | null, time: Date
    ): number | null
    {
        if (!hist || hist.times.length === 0)
        {
            return null;
        }
        const tMs = time.getTime();
        const firstMs = hist.times[0].getTime();
        const lastMs  = hist.times[hist.times.length - 1].getTime();
        if (tMs < firstMs || tMs > lastMs + 60_000)
        {
            return null;
        }
        let idx = hist.times.length - 1;
        for (let i = 0; i < hist.times.length; i++)
        {
            if (hist.times[i].getTime() > tMs)
            {
                idx = i - 1;
                break;
            }
        }
        if (idx < 0) { idx = 0; }
        return hist.values[idx];
    }

    //Locale-aware number formatter for the user-facing chips.
    //Honours the Home Assistant user's language (e.g. `fr-FR` →
    //`1,29` with a comma decimal, `en-US` → `1.29` with a period)
    //via Intl.NumberFormat. Falls back to plain .toFixed / round
    //on the rare browser that lacks Intl (very old WebViews).
    //
    //We don't honour hass.locale.number_format here on purpose:
    //that key exposes user overrides ("comma_decimal", "decimal_
    //comma", "language_defaults", ...) which would require their
    //own mapping table; the language tag covers ~99 % of cases
    //correctly because the browser's CLDR data tracks each
    //locale's conventions.
    private _formatLocalisedNumber(value: number, fractionDigits: number, integer = false): string
    {
        const locale = (this.hass?.locale?.language as string | undefined)
            ?? (this.hass?.language as string | undefined)
            ?? undefined;
        const opts: Intl.NumberFormatOptions = integer
            ? { maximumFractionDigits: 0 }
            : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
        try
        {
            return new Intl.NumberFormat(locale, opts).format(value);
        }
        catch (_)
        {
            return integer ? Math.round(value).toString() : value.toFixed(fractionDigits);
        }
    }

    //Format a signed battery power value for the chip. Mirrors
    //_formatPvValue's W ↔ kW switching but always prefixes a sign so
    //the user can tell charging from discharging at a glance.
    private _formatBatteryPower(value: number, unit: string): string
    {
        const lu = (unit || '').trim().toLowerCase();
        const sign = value > 0 ? '+' : (value < 0 ? '−' : '');
        const abs  = Math.abs(value);

        if (lu === 'w' && abs >= 1000)
        {
            return `${sign}${this._formatLocalisedNumber(abs / 1000, 2)} kW`;
        }
        if (lu === 'w')
        {
            return `${sign}${this._formatLocalisedNumber(abs, 0, true)} W`;
        }
        if (lu === 'kw')
        {
            return `${sign}${this._formatLocalisedNumber(abs, 2)} kW`;
        }
        //Unknown unit, format the value with one decimal of
        //precision and keep the configured entity's own unit
        //string. Still locale-aware so the decimal mark matches
        //the rest of the card.
        return `${sign}${this._formatLocalisedNumber(abs, 1)}${unit ? ' ' + unit : ''}`;
    }

    private async _fetchPvHistory(entityId: string, start: Date, end: Date): Promise<void>
    {
        if (!this.hass?.callWS)
        {
            return;
        }
        this._pvFetching = true;
        try
        {
            //History only exists up to "now", anything past that is
            //the forecast half of the timeline and has no production
            //data. Clamp the fetch end so we don't waste a roundtrip
            //asking HA for empty future buckets.
            const now = new Date();
            const fetchEnd = end > now ? now : end;
            if (start >= fetchEnd)
            {
                this._pvHistory = { times: [], values: [] };
                return;
            }

            const result: any = await this.hass.callWS({
                type:             'history/history_during_period',
                start_time:       start.toISOString(),
                end_time:         fetchEnd.toISOString(),
                entity_ids:       [entityId],
                minimal_response: true,
                no_attributes:    true
            });

            const arr: any[] = (result && result[entityId]) ?? [];
            const times:  Date[]   = [];
            const values: number[] = [];
            let lastTsMs: number | null = null;

            for (const item of arr)
            {
                //HA's history payload uses several field layouts
                //depending on the requested options, the recorder
                //version and the entity. We accept anything that can
                //be coerced to a finite number for the value and a
                //valid Date for the timestamp, rather than gating on
                //a specific JS type, because some integrations write
                //the state as a number (not a string) and some HA
                //versions omit `lu` on entries where the timestamp
                //matches the previous one.
                const sRaw = item?.s ?? item?.state;
                if (sRaw === null
                    || sRaw === undefined
                    || sRaw === 'unavailable'
                    || sRaw === 'unknown'
                    || sRaw === '')
                {
                    continue;
                }
                const v = parseFloat(String(sRaw));
                if (!isFinite(v))
                {
                    continue;
                }

                //Timestamp resolution order: epoch-seconds float
                //(`lu` / `lc`, minimal_response default), then ISO
                //strings (`last_updated` / `last_changed`, full
                //response). When none is set we re-use the previous
                //entry's timestamp, the common case for HA's
                //"only-state-changed" compaction where unchanged
                //timestamps are simply omitted.
                let ts: Date | null = null;
                const tsRaw =
                    item?.lu             ??
                    item?.lc             ??
                    item?.last_updated   ??
                    item?.last_changed   ??
                    null;
                if (typeof tsRaw === 'number')
                {
                    //epoch seconds (minimal_response) or epoch ms
                    //(some integrations). Distinguish by magnitude:
                    //a value above 10^12 is already in ms.
                    ts = new Date(tsRaw > 1e12 ? tsRaw : tsRaw * 1000);
                }
                else if (typeof tsRaw === 'string')
                {
                    //Could be an ISO date string or a stringified
                    //epoch; try both.
                    const asNum = Number(tsRaw);
                    if (Number.isFinite(asNum) && asNum > 1e9)
                    {
                        ts = new Date(asNum > 1e12 ? asNum : asNum * 1000);
                    }
                    else
                    {
                        ts = new Date(tsRaw);
                    }
                }
                if ((!ts || isNaN(ts.getTime())) && lastTsMs !== null)
                {
                    ts = new Date(lastTsMs);
                }
                if (!ts || isNaN(ts.getTime()))
                {
                    continue;
                }

                lastTsMs = ts.getTime();
                times.push(ts);
                values.push(v);
            }

            this._pvHistory = { times, values };
            //Snapshot the fetch outcome so `window.heliosStats()` can
            //surface it without us logging on every fetch.
            this._pvHistoryDiagnostics =
            {
                rawEntries: arr.length,
                samples:    times.length,
                windowH:    Number(((fetchEnd.getTime() - start.getTime()) / 3_600_000).toFixed(1))
            };
        }
        catch (e)
        {
            console.warn('[HELIOS] PV history fetch failed:', e);
            this._pvHistory = { times: [], values: [] };
        }
        finally
        {
            this._pvFetching = false;
        }
    }


    //Engine setup

    //Debounce window before an engine is actually constructed. The
    //Home Assistant dashboard editor creates a fresh helios-card
    //preview instance on every config edit, often spawning many
    //short-lived instances per editing session. Each one would
    //instantiate a MapLibre engine and claim a WebGL context;
    //Safari mobile caps active contexts at ~8 and starts recycling
    //past that, causing FPS drift and the iOS black-screen lockup.
    //
    //The fix: defer the actual engine construction by 500 ms.
    //  - A card that's destroyed inside that window never spawns
    //    an engine and never holds a WebGL context.
    //  - A card that survives the window (the user's actual
    //    dashboard card, or the stable editor preview the user is
    //    looking at) gets its engine after a barely-perceptible
    //    half-second delay.
    private static readonly INIT_DEBOUNCE_MS = 500;
    private _initDebounceTimer?: number;

    private _initEngine(): void
    {
        //Hard skip: cards rendered inside HA's dashboard editor
        //preview never spawn an engine, each one would claim a
        //WebGL context Safari mobile can't release fast enough.
        //The live dashboard card keeps its full rendering.
        if (this._isInEditorPreview)
        {
            //Bump a counter so we can see in __heliosStats how many
            //preview cards the detection actually caught.
            try
            {
                const w = window as unknown as { __heliosStats?: { enginesSkippedAsPreview?: number } };
                if (w.__heliosStats)
                {
                    w.__heliosStats.enginesSkippedAsPreview =
                        (w.__heliosStats.enginesSkippedAsPreview ?? 0) + 1;
                }
            }
            catch (_) {}
            return;
        }
        this._initInflight = true;

        //Cancel any pending debounce, a fresh _initEngine() call
        //means the identity / config has just changed and we want
        //the timer to restart its 500 ms clock.
        if (this._initDebounceTimer !== undefined)
        {
            window.clearTimeout(this._initDebounceTimer);
        }
        this._initDebounceTimer = window.setTimeout(() =>
        {
            this._initDebounceTimer = undefined;
            this._initEngineNow();
        }, HeliosCard.INIT_DEBOUNCE_MS);
    }

    private _initEngineNow(): void
    {
        requestAnimationFrame(() =>
        {
            const container = this.shadowRoot?.getElementById('map-container') as HTMLElement | null;
            if (!container || !this.config || !this.hass?.config)
            {
                this._initInflight = false;
                return;
            }
            const coords = this._getHomeCoords();
            if (!coords)
            {
                this._initInflight = false;
                return;
            }
            const { lat, lon } = coords;
            //hass.config.elevation is the user-defined home altitude
            //(metres above sea level) from HA's General settings. It
            //may be undefined on older HA installs or unconfigured
            //instances; the engine and the auxiliary fetch both
            //handle that case by simply not sending &elevation= and
            //letting Open-Meteo fall back to its own DEM.
            const elevation = this.hass.config.elevation;

            this._engine?.cleanup();
            //Defensive: clear anything MapLibre left in the container
            //(canvas, telemetry div, marker root). Older revisions of
            //MapLibre occasionally left a dead canvas behind, which
            //would stack a second 3D context on top of the new one.
            while (container.firstChild)
            {
                container.removeChild(container.firstChild);
            }
            this._engine = new HeliosEngine(container, this.config, [lon, lat], elevation);

            this._engine.onFetchStart = () =>
            {
                this._fetching = true;
            };
            this._engine.onFetchEnd = () =>
            {
                this._fetching = false;
            };
            this._engine.onWeatherUpdate = data =>
            {
                //Per-layer cloud breakdown is now owned by the
                //engine — it stashes low / mid / high alongside the
                //effective coverage and projectCloudScene reads them
                //back to size the three concentric bands. The card
                //only needs the aggregate for the cloud chip label.
                this._cloudCover         = data.cloudCover;
                this._timeRange          = data.timeRange;
                this._isLiveMode         = data.isLiveTime;
                //Pull the hourly series the chart canvas plots. Same
                //cadence as the gradients above, since both consume
                //the engine's hourly data refresh.
                this._chartSeries        = this._engine?.getTimelineSeries() ?? null;
                //First weather update is also our cue to ask the
                //engine for the initial label layout, by this point
                //the map has loaded its style and the projection
                //matrix is available. Subsequent transforms refresh
                //via onMapTransform.
                this._refreshOverlays();
            };
            //Cloud-disc hover is now wired directly on the SVG
            //element via @mousemove / @mouseleave (see the render
            //path's solar-svg). The engine no longer surfaces a
            //hover callback for the disc since it's no longer a
            //MapLibre layer.
            this._engine.onMapTransform = () =>
            {
                this._refreshOverlays();
            };
            //WebGL context loss recovery, iOS Safari recycles
            //contexts under memory pressure. The engine emits this
            //hook from its webglcontextlost listener; we tear down
            //the dead engine and re-init from scratch on the next
            //animation frame so the user never sees a stuck black
            //canvas. _lastHomeKey is reset so the identity-change
            //branch of updated() takes the re-init path.
            this._engine.onContextLost = () =>
            {
                this._lastHomeKey = '';
                if (!this._initInflight) this._initEngine();
            };

            //LiDAR shadow compute: the engine fires these around its
            //WMS round-trip + raster paint pass. The card surfaces a
            //small spinner chip top-right so the user has a clear
            //"shadows are coming" signal during the few seconds the
            //fetch takes on a cold start.
            this._engine.onShadowComputeStart = () =>
            {
                this._shadowBusy = true;
            };
            this._engine.onShadowComputeEnd = () =>
            {
                this._shadowBusy = false;
            };

            this._initInflight = false;
        });
    }

    //Pull fresh screen-space layouts from the engine for both the
    //cloud-cover percentage label and the solar-arc / sun / ray.
    //Called on every map transform broadcast by the engine, plus
    //once at first weather update (the engine's projection matrix
    //is only ready after the style has loaded), plus on every clock
    //tick when in live mode (the sun position depends on the time).
    private _refreshOverlays(): void
    {
        const layout = this._engine?.projectHomeLabelLayout() ?? null;
        this._labelLayout = layout;

        const t = this._selectedTime ?? this._now;
        this._sunScene        = this._engine ? this._engine.projectSunScene(t)   : null;
        this._cloudScene      = this._engine ? this._engine.projectCloudScene()  : null;
        this._homeSilhouettes = this._engine ? this._engine.projectHomeFootprints() : [];
    }

    //Segments now share one fixed colour (the configured sun
    //colour). Depth perception comes entirely from the per-segment
    //stroke width modulated by `nearness`, kept untouched: it is the
    //2D-on-3D cue we explicitly chose not to overload with another
    //dimension. Irradiance is still kept on the segment shape, the
    //caller doesn't use it any more, but removing it would broaden
    //the change surface unnecessarily; we just stop *colouring* with
    //it.
    private _buildArcSegments(
        arc:   ReadonlyArray<{
            x: number; y: number;
            irradiance: number; nearness: number; belowHorizon: boolean;
        }>,
        sunColor: string
    ): Array<{
        x1: number; y1: number; x2: number; y2: number;
        color: string; nearness: number; belowHorizon: boolean;
    }>
    {
        const out: Array<{
            x1: number; y1: number; x2: number; y2: number;
            color: string; nearness: number; belowHorizon: boolean;
        }> = [];
        for (let i = 0; i < arc.length - 1; i++)
        {
            const a = arc[i];
            const b = arc[i + 1];
            out.push({
                x1: a.x, y1: a.y,
                x2: b.x, y2: b.y,
                color:        sunColor,
                nearness:     0.5 * (a.nearness + b.nearness),
                belowHorizon: a.belowHorizon || b.belowHorizon
            });
        }
        return out;
    }

    //Re-renders the card every second.
    //  - In live mode this advances both the clock display and the live
    //    cursor on the timeline (positioned from Date.now() on every render).
    //  - In scrubbed mode the clock shows the selected instant and the
    //    live cursor still continues to move underneath as wall-clock
    //    time progresses.
    private _tick(): void
    {
        this._now = new Date();
        //The sun moves with time, so refresh its screen-space
        //position too. The other parts of _refreshOverlays
        //(percentage label) are camera-driven and won't change
        //here, but recomputing them is cheap and keeps the code
        //path uniform.
        this._refreshOverlays();
    }


    //Timeline pointer interaction

    private _trackElement:   HTMLElement | null = null;
    private _trackPointerId: number | null      = null;

    private _onTimelinePointerDown(e: PointerEvent): void
    {
        if (!this._timeRange)
        {
            return;
        }
        //Swallow scrubs during the post-exit cooldown so the click
        //that dismissed the dashboard panel can't bleed into an
        //immediate scrub on the timeline behind it.
        if (this._engine?.isUserGestureSuppressed())
        {
            return;
        }
        const track = e.currentTarget as HTMLElement;
        track.setPointerCapture(e.pointerId);
        this._trackElement   = track;
        this._trackPointerId = e.pointerId;
        track.addEventListener('pointermove',   this._boundPointerMove);
        track.addEventListener('pointerup',     this._boundPointerUp);
        track.addEventListener('pointercancel', this._boundPointerUp);
        this._applyTimelinePointer(e);
    }

    private _boundPointerMove = (e: PointerEvent): void => this._onTimelinePointerMove(e);
    private _boundPointerUp   = (e: PointerEvent): void => this._onTimelinePointerUp(e);

    private _onTimelinePointerMove(e: PointerEvent): void
    {
        if (e.pointerId !== this._trackPointerId)
        {
            return;
        }
        this._applyTimelinePointer(e);
    }

    private _onTimelinePointerUp(e: PointerEvent): void
    {
        if (e.pointerId !== this._trackPointerId)
        {
            return;
        }
        const track = this._trackElement;
        if (track)
        {
            try
            {
                track.releasePointerCapture(e.pointerId);
            }
            catch (_) {}
            track.removeEventListener('pointermove',   this._boundPointerMove);
            track.removeEventListener('pointerup',     this._boundPointerUp);
            track.removeEventListener('pointercancel', this._boundPointerUp);
        }
        this._trackElement   = null;
        this._trackPointerId = null;
    }

    private _applyTimelinePointer(e: PointerEvent): void
    {
        if (!this._timeRange)
        {
            return;
        }
        const track   = e.currentTarget as HTMLElement;
        const rect    = track.getBoundingClientRect();
        const frac    = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const rangeMs = this._timeRange.end.getTime() - this._timeRange.start.getTime();
        const t       = new Date(this._timeRange.start.getTime() + frac * rangeMs);

        if (t.getMinutes() >= 30)
        {
            t.setHours(t.getHours() + 1);
        }
        t.setMinutes(0, 0, 0);

        if (this._selectedTime && this._selectedTime.getTime() === t.getTime())
        {
            return;
        }

        this._selectedTime = t;
        this._isLiveMode   = false;
        this._engine?.setSelectedTime(t);
    }

    private _resetToLive(): void
    {
        this._selectedTime = null;
        this._isLiveMode   = true;
        this._engine?.setSelectedTime(null);
    }

    //Timeline rendering

    //Build the SVG chart of the chart card: irradiance W/m² as a
    //gradient-filled area, cloud cover as a translucent grey area
    //layered on top, plus a scrub cursor line that mirrors the
    //selected instant (or "now" in live mode).
    //
    //The chart uses a fixed-resolution viewBox (1000 × 100) with
    //preserveAspectRatio="none", so it stretches horizontally
    //with the container while keeping vertical proportions intact.
    //All path coordinates are computed against this viewBox and
    //the browser handles the actual scaling.
    //Mirror chart.
    //
    //Two areas sharing a horizontal midline:
    //  - top half: irradiance W/m², "the sun pushes upward". Filled
    //    with the configured sun colour, gradient-faded toward the
    //    midline so the chart never feels flat.
    //  - bottom half: cloud cover %, "the clouds press down". Filled
    //    with the configured cloud colour, mirrored gradient.
    //
    //The metaphor maps the user's mental model: when the sun pushes
    //past what the clouds press in, production is high; when the
    //clouds reach further than the sun's push, production is low.
    //The two areas inhabit non-overlapping pixel rows, so we never
    //have to worry about z-order or transparency stacking.
    private _renderChart(): TemplateResult
    {
        const series = this._chartSeries;
        const range  = this._timeRange;
        if (!series || !range || series.times.length < 2)
        {
            return html`<svg class="hc-chart-svg" viewBox="0 0 1000 100" preserveAspectRatio="none"></svg>`;
        }

        const W      = 1000;
        const H      = 100;
        //Midline sits exactly halfway. The two halves get H/2 = 50
        //pixels of vertical resolution each, enough to read the
        //shape of a typical day at a glance.
        const MID    = H / 2;
        const HALF   = H / 2;

        const startMs = range.start.getTime();
        const rangeMs = range.end.getTime() - startMs;
        if (rangeMs <= 0)
        {
            return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
        }

        const xOf = (t: Date): number =>
            ((t.getTime() - startMs) / rangeMs) * W;

        //Top area Y: 0 W/m² sits on the midline, 1000 W/m² sits at
        //the top edge of the SVG. Anything above clamps to the top.
        const yIrr = (w: number): number =>
            MID - Math.max(0, Math.min(1, w / 1000)) * HALF;

        //Bottom area Y: 0 % sits on the midline, 100 % sits at the
        //bottom edge. Pure linear (cloud cover is already 0..100).
        const yCloud = (pct: number): number =>
            MID + Math.max(0, Math.min(1, pct / 100)) * HALF;

        const irrPoints = series.times.map((t, i) =>
            `${xOf(t).toFixed(2)},${yIrr(series.irradiance[i] ?? 0).toFixed(2)}`);
        const cloudPoints = series.times.map((t, i) =>
            `${xOf(t).toFixed(2)},${yCloud(series.cloud[i] ?? 0).toFixed(2)}`);

        //Both areas close back to the midline (not the SVG edge),
        //so each half stays anchored to its own baseline.
        const x0 = xOf(series.times[0]);
        const xN = xOf(series.times[series.times.length - 1]);
        const irrArea = `M ${x0},${MID} L ${irrPoints.join(' L ')} L ${xN},${MID} Z`;
        const cloudArea = `M ${x0},${MID} L ${cloudPoints.join(' L ')} L ${xN},${MID} Z`;

        //Stroke-only paths layered on top of the filled areas to
        //accentuate the curve outline. Same point sequence as the
        //areas, minus the closing segment back to the midline so
        //we don't draw a horizontal line across the baseline.
        const irrLine   = `M ${irrPoints.join(' L ')}`;
        const cloudLine = `M ${cloudPoints.join(' L ')}`;

        const sunColor   = cfgHex(this.config?.['sun-color'],   DEFAULT_SUN_COLOR_HEX);
        const cloudColor = cfgHex(this.config?.['cloud-color'], DEFAULT_CLOUD_COLOR_HEX);

        //Day-boundary X positions in viewBox units (midnight of each
        //local day inside the time range). Drawn as faint dotted
        //vertical lines spanning the full chart height, same role
        //as the day chips on the midline, just visual separators.
        const startMsAbs = range.start.getTime();
        const endMsAbs   = range.end.getTime();
        const dayXs: number[] = [];
        const dCursor = new Date(range.start);
        dCursor.setHours(0, 0, 0, 0);
        while (dCursor.getTime() <= endMsAbs)
        {
            const next = new Date(dCursor);
            next.setDate(next.getDate() + 1);
            if (dCursor.getTime() > startMsAbs && dCursor.getTime() < endMsAbs)
            {
                dayXs.push(xOf(dCursor));
            }
            dCursor.setTime(next.getTime());
        }

        //Hour-boundary X positions, used to draw small vertical
        //ticks centred on the midline (one per hour). Midnights are
        //skipped, those already get a full-height day separator.
        const hourXs: number[] = [];
        const hCursor = new Date(range.start);
        hCursor.setMinutes(0, 0, 0);
        hCursor.setHours(hCursor.getHours() + 1);
        while (hCursor.getTime() <= endMsAbs)
        {
            if (hCursor.getTime() > startMsAbs && hCursor.getHours() !== 0)
            {
                hourXs.push(xOf(hCursor));
            }
            hCursor.setHours(hCursor.getHours() + 1);
        }
        const HOUR_TICK_HALF = 3;

        return html`
            <svg
                class="hc-chart-svg"
                viewBox="0 0 ${W} ${H}"
                preserveAspectRatio="none"
            >
                <path
                    d="${irrArea}"
                    fill="${sunColor}"
                    fill-opacity="0.5"
                ></path>
                <path
                    d="${cloudArea}"
                    fill="${cloudColor}"
                    fill-opacity="0.5"
                ></path>
                <path
                    class="hc-chart-line"
                    d="${irrLine}"
                    stroke="${sunColor}"
                ></path>
                <path
                    class="hc-chart-line"
                    d="${cloudLine}"
                    stroke="${cloudColor}"
                ></path>
                ${dayXs.map(x => svg`
                    <line
                        class="hc-day-sep"
                        x1="${x.toFixed(2)}" y1="0"
                        x2="${x.toFixed(2)}" y2="${H}"
                    ></line>
                `)}
                <line
                    class="hc-chart-mid"
                    x1="0" y1="${MID}"
                    x2="${W}" y2="${MID}"
                ></line>
                ${hourXs.map(x => svg`
                    <line
                        class="hc-hour-tick"
                        x1="${x.toFixed(2)}" y1="${MID - HOUR_TICK_HALF}"
                        x2="${x.toFixed(2)}" y2="${MID + HOUR_TICK_HALF}"
                    ></line>
                `)}
            </svg>
        `;
    }

    //Render the optional photovoltaic production graph that sits
    //above the main timeline chart. Same X axis as the main chart
    //(time range pulled from this._timeRange) so day boundaries and
    //the scrub cursor line up vertically across both blocks. The
    //curve is plotted from this._pvHistory (fetched via the HA
    //history WebSocket command); future data is intentionally left
    //blank, the curve naturally stops at the last recorded sample
    //since there's no production data after "now".
    private _renderPvChart(): TemplateResult
    {
        const range = this._timeRange;
        const hist  = this._pvHistory;
        const W     = 1000;
        const H     = 100;

        if (!range)
        {
            return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
        }

        const startMs = range.start.getTime();
        const rangeMs = range.end.getTime() - startMs;
        if (rangeMs <= 0)
        {
            return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
        }

        const pvColor = cfgHex(this.config?.['pv-color'], DEFAULT_PV_COLOR_HEX);

        //Day-boundary X positions, same computation as the main
        //chart so the dotted separators line up across the two.
        const endMsAbs = range.end.getTime();
        const dayXs: number[] = [];
        const dCursor = new Date(range.start);
        dCursor.setHours(0, 0, 0, 0);
        while (dCursor.getTime() <= endMsAbs)
        {
            const next = new Date(dCursor);
            next.setDate(next.getDate() + 1);
            if (dCursor.getTime() > startMs && dCursor.getTime() < endMsAbs)
            {
                dayXs.push(((dCursor.getTime() - startMs) / rangeMs) * W);
            }
            dCursor.setTime(next.getTime());
        }

        //If we have no history yet, render the empty frame (axis
        //grid + day separators) so the graph card never looks
        //"broken" while data is being fetched.
        //
        //If the entity reports a cumulative energy (Wh / kWh / MWh)
        //we differentiate it into a power-rate series so the curve
        //reflects production at each instant rather than the
        //ever-climbing daily total. The user said it best: "produc-
        //tion par minute, pas totale". Negative deltas (a daily
        //"energy today" sensor flipping back to 0 at midnight) are
        //treated as resets and dropped, and abnormally large gaps
        //are skipped to avoid smearing one big jump across an hour
        //of empty time.
        const lu = (this._pvUnit || '').toLowerCase();
        const isCumulativeEnergy = lu === 'wh' || lu === 'kwh' || lu === 'mwh';

        let rawTimes:  Date[]   = hist?.times  ?? [];
        let rawValues: number[] = hist?.values ?? [];

        if (isCumulativeEnergy && rawTimes.length >= 2)
        {
            const dTimes:  Date[]   = [];
            const dValues: number[] = [];
            for (let i = 1; i < rawTimes.length; i++)
            {
                const dtH = (rawTimes[i].getTime() - rawTimes[i - 1].getTime()) / 3_600_000;
                if (dtH <= 0 || dtH > 6)
                {
                    continue;
                }
                const dv = rawValues[i] - rawValues[i - 1];
                if (dv < 0)
                {
                    //Counter reset (typical for "energy today"
                    //sensors that zero out at midnight).
                    continue;
                }
                dTimes.push(rawTimes[i]);
                dValues.push(dv / dtH);
            }
            rawTimes  = dTimes;
            rawValues = dValues;
        }

        const samples: Array<{ t: Date; v: number }> = [];
        for (let i = 0; i < rawTimes.length; i++)
        {
            const t = rawTimes[i];
            const v = rawValues[i];
            if (t.getTime() < startMs || t.getTime() > endMsAbs)
            {
                continue;
            }
            if (!isFinite(v))
            {
                continue;
            }
            samples.push({ t, v });
        }

        const xOf = (t: Date): number =>
            ((t.getTime() - startMs) / rangeMs) * W;

        //Observed samples are in the entity's native power unit
        //(kW / W / MW for a power entity, or differentiated to that
        //unit / hour for a cumulative-energy entity). Calibration k
        //is "W per percent of STC", so a raw `pct * k` predicted
        //value is in WATTS. Mixing units on the same Y axis would
        //flatten the observed curve into invisibility when the
        //entity is in kW and the predicted is in W (yMax pegged to
        //thousands while observed sits at single digits). Compute
        //the W → native scale once and apply it to the predicted
        //series so both feed yMax on the same axis.
        const nativeFromW = (() => {
            const native = isCumulativeEnergy
                ? (lu === 'kwh' ? 'kw' : lu === 'mwh' ? 'mw' : lu === 'wh' ? 'w' : '')
                : lu;
            if (native === 'kw') return 1 / 1000;
            if (native === 'mw') return 1 / 1_000_000;
            return 1;
        })();

        //Predicted PV for hours from "now" forward, scales the
        //clear-sky percentage by the user-configured peak power
        //(kWp -> W per percent of STC). Skipped silently when the
        //peak power isn't set in the editor.
        const k = this._pvCalibK();
        const coords = this._getHomeCoords();
        const lat = coords?.lat;
        const lon = coords?.lon;
        const series = this._chartSeries;
        const predictedSamples: Array<{ t: Date; v: number }> = [];
        if (k !== null && series && typeof lat === 'number' && typeof lon === 'number')
        {
            const nowMs = Date.now();
            for (let i = 0; i < series.times.length; i++)
            {
                const tMs = series.times[i].getTime();
                if (tMs <  nowMs)   continue;             //future only
                if (tMs <  startMs) continue;
                if (tMs >  endMsAbs) continue;
                const pct = computePvPower(series.times[i], lat, lon, series.cloud[i] ?? 0, this._pvPanelOrientation());
                if (pct <= 0) continue;
                predictedSamples.push({ t: series.times[i], v: pct * k * nativeFromW });
            }
        }

        //Auto-scale: the Y axis maps 0 to the bottom edge and the
        //series' running max to the top edge. With a min of 1 we
        //avoid division-by-zero when the series is all-zero (early
        //morning, prolonged outage) and keep the curve visibly
        //pinned to the baseline rather than silently disappearing.
        //Predicted samples also feed into yMax so the forecast line
        //doesn't clip when expected production exceeds anything
        //the user has produced lately.
        let yMax = 1;
        for (const s of samples)          { if (s.v > yMax) yMax = s.v; }
        for (const s of predictedSamples) { if (s.v > yMax) yMax = s.v; }
        const yOf = (v: number): number =>
            H - Math.max(0, Math.min(1, v / yMax)) * H;

        const points = samples.map(s =>
            `${xOf(s.t).toFixed(2)},${yOf(s.v).toFixed(2)}`);

        let area  = '';
        let line  = '';
        if (points.length >= 2)
        {
            const x0 = xOf(samples[0].t);
            const xN = xOf(samples[samples.length - 1].t);
            area = `M ${x0},${H} L ${points.join(' L ')} L ${xN},${H} Z`;
            line = `M ${points.join(' L ')}`;
        }

        let predictedLine = '';
        if (predictedSamples.length >= 2)
        {
            const pPoints = predictedSamples.map(s =>
                `${xOf(s.t).toFixed(2)},${yOf(s.v).toFixed(2)}`);
            predictedLine = `M ${pPoints.join(' L ')}`;
        }

        return html`
            <svg
                class="hc-chart-svg"
                viewBox="0 0 ${W} ${H}"
                preserveAspectRatio="none"
            >
                ${dayXs.map(x => svg`
                    <line
                        class="hc-day-sep"
                        x1="${x.toFixed(2)}" y1="0"
                        x2="${x.toFixed(2)}" y2="${H}"
                    ></line>
                `)}
                ${area ? svg`
                    <path
                        d="${area}"
                        fill="${pvColor}"
                        fill-opacity="0.5"
                    ></path>
                    <path
                        class="hc-chart-line"
                        d="${line}"
                        stroke="${pvColor}"
                    ></path>
                ` : nothing}
                ${predictedLine ? svg`
                    <path
                        class="hc-chart-line hc-chart-predicted"
                        d="${predictedLine}"
                        stroke="${pvColor}"
                    ></path>
                ` : nothing}
            </svg>
        `;
    }

    //The thin track now carries only the cursors. Day
    //separators live inside the chart card SVG (dotted vertical
    //lines) and the scrub time label has been promoted to a chip
    //above the chart card.
    private _renderTimelineTicks(): TemplateResult
    {
        if (!this._timeRange)
        {
            return html``;
        }

        const { start, end } = this._timeRange;
        const rangeMs = end.getTime() - start.getTime();
        const now     = new Date();
        const toPct   = (d: Date): number =>
            Math.max(0, Math.min(100, (d.getTime() - start.getTime()) / rangeMs * 100));

        const nowPct        = toPct(now);
        const showSelected  = !this._isLiveMode && this._selectedTime !== null;
        const selPct        = showSelected ? toPct(this._selectedTime!) : 0;

        return html`
            <div class="tb-cursor-now" style="left:${nowPct}%"></div>
            ${showSelected ? html`
                <div class="tb-cursor-sel" style="left:${selPct}%"></div>
            ` : nothing}
        `;
    }

    //Day labels rendered as small white chips overlaying the chart
    //card on its midline (between the irradiance and cloud halves).
    //Same chip styling as the on-map cloud and W/m² readouts, so all
    //three feel like the same family. Each chip is centred on the
    //middle of its day's segment in the time range.
    private _renderTimelineDayLabels(): TemplateResult
    {
        if (!this._timeRange)
        {
            return html``;
        }

        const { start, end } = this._timeRange;
        const rangeMs = end.getTime() - start.getTime();
        const now     = new Date();
        const toPct   = (d: Date): number =>
            Math.max(0, Math.min(100, (d.getTime() - start.getTime()) / rangeMs * 100));

        const today0 = new Date(now);
        today0.setHours(0, 0, 0, 0);

        //Pre-compute the daily kWh totals once per render (cheap; the
        //helper itself caches the observed bucketing). Past + today-
        //so-far is integrated from the actual PV history; today-
        //remainder + future days come from the kWp × clear-sky
        //model. The map is keyed by the day's local-midnight ms.
        const dailyKwh = this._computeDailyKwhTotals();

        const labels: TemplateResult[] = [];
        const cursor = new Date(start);
        cursor.setHours(0, 0, 0, 0);

        while (cursor.getTime() <= end.getTime())
        {
            const next = new Date(cursor);
            next.setDate(next.getDate() + 1);

            const segStart = Math.max(start.getTime(), cursor.getTime());
            const segEnd   = Math.min(end.getTime(),   next.getTime());

            if (segEnd > segStart)
            {
                const pStart   = toPct(new Date(segStart));
                const pEnd     = toPct(new Date(segEnd));
                const w        = pEnd - pStart;
                const dayDelta = Math.round((cursor.getTime() - today0.getTime()) / 86_400_000);
                const isToday  = dayDelta === 0;

                const label    = formatDate(cursor, this.config?.['date-format']);
                const centre   = pStart + w / 2;
                const labelPct = Math.min(Math.max(centre, 6), 94);

                const kwh   = dailyKwh.get(cursor.getTime());
                //Forecast days (future + today's not-yet-produced
                //share) are flagged so the chip styling can hint
                //"this is an estimate" with a touch of italic. Past
                //days are always concrete.
                const isForecast = kwh !== undefined && cursor.getTime() > today0.getTime();
                const kwhText = (kwh !== undefined && isFinite(kwh) && kwh >= 0.05)
                    ? this._formatLocalisedNumber(kwh, 1) + ' kWh'
                    : '';

                labels.push(html`
                    <div
                        class="tb-day-label ${isToday ? 'tb-day-label-today' : ''}"
                        style="left:${labelPct}%"
                    >
                        <span class="tb-day-label-date">${label}</span>
                        ${kwhText ? html`
                            <span class="tb-day-label-kwh ${isForecast ? 'is-forecast' : ''}">${kwhText}</span>
                        ` : nothing}
                    </div>
                `);
            }

            cursor.setTime(next.getTime());
        }

        return html`<div class="tb-day-labels">${labels}</div>`;
    }

    //Compute kWh-per-day totals over the active timeline range. The
    //helper integrates two sources:
    //
    //  - Past + today-so-far: sum of the observed PV history (from
    //    `_pvHistory`), respecting the entity's unit (W/kW power
    //    sensors are integrated by trapezoidal rule; cumulative
    //    energy sensors are differenced and summed).
    //  - Today-remainder + future: integration of the kWp × clear-
    //    sky × cloud model, hour by hour, using the engine's
    //    weather series.
    //
    //Returns a Map keyed by each day's local-midnight ms, with
    //values in kWh. Days that fall outside the active range or
    //carry no usable data are omitted.
    private _computeDailyKwhTotals(): Map<number, number>
    {
        const out = new Map<number, number>();
        if (!this._timeRange) return out;
        const { start, end } = this._timeRange;
        const startMs  = start.getTime();
        const endMsAbs = end.getTime();

        const dayKey = (ms: number): number =>
        {
            const d = new Date(ms);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        };

        //Pass 1: past + today-so-far from the observed history.
        const hist = this._pvHistory;
        if (hist && hist.times.length >= 2)
        {
            const unit = (this._pvUnit || '').toLowerCase();
            const isCumulativeEnergy = unit === 'wh' || unit === 'kwh' || unit === 'mwh';

            if (isCumulativeEnergy)
            {
                //Cumulative energy sensor: difference consecutive
                //samples and sum the deltas per day. Counter resets
                //(dv < 0) are dropped, same convention the chart uses.
                for (let i = 1; i < hist.times.length; i++)
                {
                    const tMs = hist.times[i].getTime();
                    if (tMs < startMs || tMs > endMsAbs) continue;
                    const dv = hist.values[i] - hist.values[i - 1];
                    if (!isFinite(dv) || dv < 0) continue;
                    const kwh = unit === 'mwh' ? dv * 1000
                              : unit === 'wh'  ? dv / 1000
                              : dv;
                    const k = dayKey(tMs);
                    out.set(k, (out.get(k) ?? 0) + kwh);
                }
            }
            else
            {
                //Power sensor: trapezoidal integration of the
                //instantaneous reading over each consecutive pair.
                //Skip gaps > 6 h (likely sensor outage, integrating
                //across them would invent energy).
                for (let i = 1; i < hist.times.length; i++)
                {
                    const tCurrMs = hist.times[i].getTime();
                    if (tCurrMs < startMs || tCurrMs > endMsAbs) continue;
                    const tPrevMs = hist.times[i - 1].getTime();
                    const dtH = (tCurrMs - tPrevMs) / 3_600_000;
                    if (dtH <= 0 || dtH > 6) continue;
                    const wPrev = this._pvNormalizeToWatts(hist.values[i - 1], this._pvUnit);
                    const wCurr = this._pvNormalizeToWatts(hist.values[i],     this._pvUnit);
                    if (!isFinite(wPrev) || !isFinite(wCurr)) continue;
                    const kwh = ((wPrev + wCurr) / 2) * dtH / 1000;
                    const k = dayKey(tCurrMs);
                    out.set(k, (out.get(k) ?? 0) + kwh);
                }
            }
        }

        //Pass 2: future + today-remainder from the forecast model.
        //Skipped silently when peak power is unset (no model, no
        //forecast, only past observation contributes).
        const k        = this._pvCalibK();   //W per percent of STC
        const series   = this._chartSeries;
        const coords   = this._getHomeCoords();
        if (k !== null && k > 0 && series && coords)
        {
            //Index hourly forecast samples by hour-floor ms so we
            //can integrate them by 1-hour rectangles per day. The
            //series timestamps are already at hour boundaries from
            //the engine's resampling.
            const nowMs    = Date.now();
            for (let i = 0; i < series.times.length; i++)
            {
                const tMs   = series.times[i].getTime();
                if (tMs < startMs || tMs > endMsAbs) continue;
                if (tMs < nowMs) continue;   //past covered by Pass 1
                const cloud = series.cloud[i] ?? 0;
                const pct   = computePvPower(series.times[i], coords.lat, coords.lon, cloud, this._pvPanelOrientation());
                if (pct <= 0) continue;
                //pct × k = watts at this hour midpoint × 1h = Wh.
                //Divide by 1000 to land in kWh.
                const kwh = (pct * k) / 1000;
                const dk = dayKey(tMs);
                out.set(dk, (out.get(dk) ?? 0) + kwh);
            }
        }

        return out;
    }

    //Compute the production rate at an arbitrary historical time
    //(used when the user scrubs the timeline into the past). For
    //a cumulative entity we differentiate the two history samples
    //bracketing the requested instant; for a power entity we just
    //return the value of the closest historical sample. Returns
    //null when the requested time falls outside the fetched
    //history window, the chip is then hidden by the caller, which
    //is the right behaviour for the future half of the timeline
    //(no production data exists there yet).
    private _pvRateAtTime(time: Date): { value: number; unit: string } | null
    {
        const hist = this._pvHistory;
        if (!hist || hist.times.length === 0)
        {
            return null;
        }

        const tMs = time.getTime();
        const firstMs = hist.times[0].getTime();
        const lastMs  = hist.times[hist.times.length - 1].getTime();
        if (tMs < firstMs || tMs > lastMs + 60_000)
        {
            //Outside the history window. Allow a 60 s grace at the
            //tail so a "live" scrub to "now" still resolves.
            return null;
        }

        //Classification, same logic as _currentPvRate. Repeated
        //inline so each helper is self-contained.
        const entity   = String(this.config?.['pv-power-entity'] ?? '').trim();
        const stateObj = this.hass?.states?.[entity];
        const sc       = String(stateObj?.attributes?.state_class  ?? '').toLowerCase();
        const dc       = String(stateObj?.attributes?.device_class ?? '').toLowerCase();
        const u        = (this._pvUnit || '').trim();
        const lu       = u.toLowerCase();

        let isCumulative: boolean;
        if (sc === 'total_increasing' || sc === 'total') isCumulative = true;
        else if (sc === 'measurement') isCumulative = false;
        else if (dc === 'energy') isCumulative = true;
        else if (dc === 'power') isCumulative = false;
        else isCumulative = lu === 'wh' || lu === 'kwh' || lu === 'mwh';

        let rateUnit: string;
        if (lu === 'wh')       rateUnit = 'W';
        else if (lu === 'kwh') rateUnit = 'kW';
        else if (lu === 'mwh') rateUnit = 'MW';
        else                   rateUnit = u ? `${u}/h` : '';

        //Locate the index of the sample at or before `time`, linear
        //scan is fine for the ~96 samples a typical 4-day window
        //carries.
        let idx = hist.times.length - 1;
        for (let i = 0; i < hist.times.length; i++)
        {
            if (hist.times[i].getTime() > tMs)
            {
                idx = i - 1;
                break;
            }
        }
        if (idx < 0)
        {
            idx = 0;
        }

        if (!isCumulative)
        {
            //Power sensor: just return the historical value.
            return { value: hist.values[idx], unit: u };
        }

        //Cumulative: differentiate around the located index.
        let lo = idx;
        let hi = idx + 1 < hist.times.length ? idx + 1 : idx;
        if (lo === hi)
        {
            //At the boundary, fall back to the previous pair.
            lo = Math.max(0, idx - 1);
            hi = idx;
        }
        if (lo === hi)
        {
            //Single-sample history, no rate possible.
            return { value: 0, unit: rateUnit };
        }
        const dtH = (hist.times[hi].getTime() - hist.times[lo].getTime()) / 3_600_000;
        if (dtH <= 0)
        {
            return { value: 0, unit: rateUnit };
        }
        const dv = hist.values[hi] - hist.values[lo];
        if (dv < 0)
        {
            //Counter reset between the two samples → no production
            //(rate is meaningless across a midnight reset).
            return { value: 0, unit: rateUnit };
        }
        return { value: dv / dtH, unit: rateUnit };
    }

    //Compute the instantaneous PV production rate for "now".
    //
    //  - Cumulative entity (state_class total_increasing|total,
    //    device_class energy, or unit Wh/kWh/MWh) → differentiate
    //    over the rolling sample buffer (which is filled live each
    //    Lit cycle), anchored on the sample closest to ~60 s ago
    //    so the readout reflects the last minute of production.
    //  - Instantaneous entity (anything else) → the entity's own
    //    state value already IS the rate.
    //
    //Returns null when no usable rate can be derived (no entity,
    //no buffer yet, counter reset). The caller falls back to the
    //raw current state in that case so the chip stays populated.
    private _currentPvRate(): { value: number; unit: string } | null
    {
        if (this._pvCurrent === null)
        {
            return null;
        }

        const entity   = String(this.config?.['pv-power-entity'] ?? '').trim();
        const stateObj = this.hass?.states?.[entity];
        const sc       = String(stateObj?.attributes?.state_class  ?? '').toLowerCase();
        const dc       = String(stateObj?.attributes?.device_class ?? '').toLowerCase();
        const u        = (this._pvUnit || '').trim();
        const lu       = u.toLowerCase();

        //HA's classification taxonomy is authoritative when set;
        //fall back to the unit string for entities (custom
        //template sensors mostly) that omit state_class /
        //device_class.
        let isCumulative: boolean;
        if (sc === 'total_increasing' || sc === 'total')
        {
            isCumulative = true;
        }
        else if (sc === 'measurement')
        {
            isCumulative = false;
        }
        else if (dc === 'energy')
        {
            isCumulative = true;
        }
        else if (dc === 'power')
        {
            isCumulative = false;
        }
        else
        {
            isCumulative = lu === 'wh' || lu === 'kwh' || lu === 'mwh';
        }

        if (!isCumulative)
        {
            //Instantaneous sensor, the live state IS the rate.
            return { value: this._pvCurrent, unit: u };
        }

        //Choose the rate unit so the formatted readout reads as
        //power, not as energy-per-something. When the source unit
        //is unknown, append "/h" so the user still sees a sensible
        //label (e.g. "12 units/h") instead of a bare number.
        let rateUnit: string;
        if (lu === 'wh')       rateUnit = 'W';
        else if (lu === 'kwh') rateUnit = 'kW';
        else if (lu === 'mwh') rateUnit = 'MW';
        else                   rateUnit = u ? `${u}/h` : '';

        //Cumulative path: from this point on we MUST return a rate
        //object, never null. Showing the raw cumulative state on
        //the chip would be flat-out wrong for an "energy total"
        //sensor (e.g. lifetime kWh). When no rate can be derived
        //(entity static all night, no recent samples, no history),
        //we default to 0, that's the truthful answer for a sensor
        //that hasn't moved.

        //Preferred path: use the rolling buffer of live samples. We
        //walk back from the newest to find the sample closest to
        //~60 s ago, that anchors the rate to a "last minute"
        //window the user explicitly asked for. If the buffer
        //doesn't cover a full minute (entity updates rarely), we
        //fall back to the oldest available sample.
        const buf = this._pvSampleBuffer;
        if (buf.length >= 2)
        {
            const last = buf[buf.length - 1];
            const target = last.t - 60_000;
            let prev = buf[0];
            for (const s of buf)
            {
                if (s.t <= target)
                {
                    prev = s;
                }
                else
                {
                    break;
                }
            }
            const dtH = (last.t - prev.t) / 3_600_000;
            if (dtH > 0)
            {
                const dv = last.v - prev.v;
                if (dv < 0)
                {
                    //Counter reset (e.g. "energy today" flipping to
                    //0 at midnight), no meaningful rate. Drop the
                    //pre-reset samples so the next call works on a
                    //clean window.
                    this._pvSampleBuffer = [last];
                    return { value: 0, unit: rateUnit };
                }
                return { value: dv / dtH, unit: rateUnit };
            }
        }

        //Static-entity heuristic: if the entity hasn't moved for
        //a minute or more, the live state is the same as it was
        //60 s ago by definition, production rate is zero. This
        //resolves the "lifetime kWh sensor at night" case: the
        //cumulative value sits unchanged for hours, so any rate
        //we'd compute against the buffer's single sample would be
        //meaningless; the truthful answer is 0 W.
        const lastUpdatedMs = stateObj?.last_updated
            ? new Date(stateObj.last_updated).getTime()
            : null;
        if (lastUpdatedMs !== null && Date.now() - lastUpdatedMs >= 60_000)
        {
            return { value: 0, unit: rateUnit };
        }

        //Cold-start: the buffer hasn't accumulated two samples
        //yet (we just opened the dashboard) AND the entity has
        //changed in the last minute (otherwise the static check
        //above would have already returned). Diff the last two
        //historical samples so the chip is populated immediately
        //instead of waiting a full minute for a buffer to form.
        const hist = this._pvHistory;
        if (hist && hist.times.length >= 2)
        {
            const lastIdx = hist.times.length - 1;
            const prevIdx = lastIdx - 1;
            const dtH = (hist.times[lastIdx].getTime()
                       - hist.times[prevIdx].getTime()) / 3_600_000;
            if (dtH > 0)
            {
                const dv = hist.values[lastIdx] - hist.values[prevIdx];
                if (dv < 0)
                {
                    return { value: 0, unit: rateUnit };
                }
                return { value: dv / dtH, unit: rateUnit };
            }
        }

        //Default for a cumulative entity with no derivable rate
        //yet, better than misleading the user with the lifetime
        //total. Will quickly transition to a real rate as soon as
        //the buffer accumulates two samples (typically < 1 min on
        //a healthy production sensor).
        return { value: 0, unit: rateUnit };
    }

    //Convert a PV rate into watts. Used to drive animation speeds on
    //a unit-agnostic scale, the leader-line dash flow saturates at a
    //fixed wattage no matter what unit the user's sensor is in.
    private _pvNormalizeToWatts(value: number, unit: string): number
    {
        const lu = (unit || '').toLowerCase();
        if (lu === 'kw') return value * 1000;
        if (lu === 'mw') return value * 1_000_000;
        if (lu === 'w')  return value;
        //Other units (e.g. raw cumulative kWh that we couldn't
        //differentiate), treat as 0 so the animation pauses
        //instead of mis-scaling.
        return 0;
    }


    //Manual PV peak power.
    //
    //The user enters their installed array's peak power (kWp) in the
    //card editor. We convert that to a calibration scalar k (W per
    //percent of STC) by k = kWp * 1000 / 100 = kWp * 10, then
    //multiply by the clear-sky percentage to draw the dotted forecast
    //line on the PV chart. No history scan, no auto-fit, no rolling
    //buffer, the user knows their install best.
    //
    //Returns null when `pv-peak-kwp` is unset or invalid; callers
    //then skip the prediction line and the peak-of-day highlights
    //for future days.
    private _pvCalibK(): number | null
    {
        const raw = this.config?.['pv-peak-kwp'];
        const kwp = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
        if (!isFinite(kwp) || kwp <= 0) return null;
        return kwp * 10;
    }

    //Panel orientation derived from the editor config. Returns
    //undefined when no tilt is set, which keeps the prediction model
    //on the original horizontal-panel fast path. Setting tilt > 0
    //enables the tilt/azimuth transposition in computePvPower so
    //balcony / steeply-pitched roof installs stop seeing a flat-roof
    //forecast that's wildly optimistic.
    private _pvPanelOrientation(): { tiltDeg: number; azimuthDeg: number } | undefined
    {
        const rawTilt = this.config?.['pv-tilt'];
        const tilt = typeof rawTilt === 'number' ? rawTilt : parseFloat(String(rawTilt ?? ''));
        if (!isFinite(tilt) || tilt <= 0) return undefined;
        const rawAz = this.config?.['pv-azimuth'];
        const az = typeof rawAz === 'number' ? rawAz : parseFloat(String(rawAz ?? ''));
        return {
            tiltDeg:    Math.max(0, Math.min(90, tilt)),
            azimuthDeg: isFinite(az) ? ((az % 360) + 360) % 360 : 180
        };
    }

    //One-time cleanup of the obsolete auto-calibration buffers (an
    //earlier release maintained a rolling 14-day fit in localStorage
    //and HA's frontend.user_data). Runs at boot, idempotent thanks
    //to the cleanup-flag key. Safe to keep forever, drops a few
    //bytes per coords pair we ever wrote samples for.
    private static readonly PV_CALIB_WIPE_FLAG_KEY = 'helios-pv-calib:wiped-v1';

    private _wipeLegacyPvCalibStorage(): void
    {
        try
        {
            if (window.localStorage?.getItem(HeliosCard.PV_CALIB_WIPE_FLAG_KEY) === '1')
            {
                return;
            }
        }
        catch (_) { return; }

        try
        {
            const ls = window.localStorage;
            if (ls)
            {
                const stale: string[] = [];
                for (let i = 0; i < ls.length; i++)
                {
                    const k = ls.key(i);
                    if (k && k.startsWith('helios-pv-calib:') && k !== HeliosCard.PV_CALIB_WIPE_FLAG_KEY)
                    {
                        stale.push(k);
                    }
                }
                for (const k of stale) ls.removeItem(k);
                ls.setItem(HeliosCard.PV_CALIB_WIPE_FLAG_KEY, '1');
            }
        }
        catch (_) {}

        const coords = this._getHomeCoords();
        if (coords && this.hass?.callWS)
        {
            const haKey = `helios-pv-calib:${coords.lat.toFixed(3)}_${coords.lon.toFixed(3)}`;
            this.hass.callWS({ type: 'frontend/set_user_data', key: haKey, value: null })
                .catch(() => {});
        }
    }

    //Map a "rate" magnitude to an animation duration in seconds.
    //  rate <= 0           → 30 s        (paused, night / no production)
    //  rate  = saturation  → minDuration (fastest, full power)
    //
    //Ease-out cubic ramp: half-saturation already feels meaningfully
    //faster than the night baseline, which gives the user the
    //feeling of raw power pushing through the line. The minDuration
    //is exposed so callers can tune the saturated-end pace per
    //channel, the sun ray spans the full map and benefits from a
    //slightly slower flow than the PV leader, which is short and
    //local.
    private static _flowDuration(rate: number, saturation: number, minDuration: number = 0.4): number
    {
        if (!isFinite(rate) || rate <= 0)
        {
            return 30;
        }
        const f = Math.min(1, rate / saturation);
        const eased = 1 - Math.pow(1 - f, 3);
        return 30 - (30 - minDuration) * eased;
    }

    //Format a PV reading for the chip below the home. The display
    //auto-rescales W → kW when the magnitude crosses a threshold so
    //a 4500 W reading prints as "4.5 kW" rather than the noisier
    //"4500 W". Energy units (kWh / Wh) keep their native unit and
    //get a single decimal, daily totals usually sit in the 0–50 kWh
    //band where one decimal is the right amount of precision.
    private _formatPvValue(value: number, unit: string): string
    {
        const u = (unit || '').trim();
        const lu = u.toLowerCase();

        if (lu === 'w' && Math.abs(value) >= 1000)
        {
            return `${this._formatLocalisedNumber(value / 1000, 2)} kW`;
        }
        if (lu === 'w')
        {
            return `${this._formatLocalisedNumber(value, 0, true)} W`;
        }
        if (lu === 'kw')
        {
            return `${this._formatLocalisedNumber(value, 2)} kW`;
        }
        if (lu === 'wh')
        {
            if (Math.abs(value) >= 1000)
            {
                return `${this._formatLocalisedNumber(value / 1000, 1)} kWh`;
            }
            return `${this._formatLocalisedNumber(value, 0, true)} Wh`;
        }
        if (lu === 'kwh' || lu === 'mwh')
        {
            return `${this._formatLocalisedNumber(value, 1)} ${u}`;
        }
        //Fallback for arbitrary units, keep one decimal of precision
        //and let the entity's own unit string carry through.
        const formatted = Math.abs(value) >= 100
            ? this._formatLocalisedNumber(value, 0, true)
            : this._formatLocalisedNumber(value, 1);
        return u ? `${formatted} ${u}` : formatted;
    }


    //Render

    protected render(): TemplateResult
    {
        //We used to gate the whole render on a configured MapTiler API
        //key. Since v1.4.1 we ship with OpenFreeMap as the basemap,
        //which needs no key, so the precondition is now just "we have
        //home coordinates and we're not stuck inside a dashboard
        //editor preview". Kept under the same `hasApiKey` name so the
        //sea of `${hasApiKey ? html\`...\` : nothing}` calls below
        //read the same; only the meaning of the flag changed.
        const hasApiKey = this._getHomeCoords() !== null;


        //Date+time shown bottom-right: tracks the timeline cursor.
        //  - In live mode it follows wall-clock time (re-rendered every
        //    second by _tick).
        //  - In scrubbed mode it shows the selected instant exactly.
        //Both date and time follow the user-defined date format.
        const displayDate = !this._isLiveMode && this._selectedTime
            ? this._selectedTime
            : this._now;
        const displayDateLabel = formatDate(displayDate, this.config?.['date-format']);
        //time-format: '12h' or '24h' (default). hourCycle is more
        //authoritative than hour12, which some locales silently
        //ignore (fr-FR falls back to 24h regardless of hour12).
        const is12h = String(this.config?.['time-format'] ?? '24h').toLowerCase() === '12h';
        const displayTimeLabel = displayDate.toLocaleTimeString([], {
            hour:      '2-digit',
            minute:    '2-digit',
            second:    '2-digit',
            hourCycle: is12h ? 'h12' : 'h23'
        } as Intl.DateTimeFormatOptions);

        //The on-ground disc now self-encodes the low/mid/high
        //breakdown via three concentric bands (proportional radial
        //widths, three shades of the cloud colour), so the hover
        //tooltip we used to surface for the same data is gone.
        const cloudPctRound    = Math.max(0, Math.round(this._cloudCover));

        //Always-visible cloud-cover percentage label, overlaid in HTML
        //above the home marker, with an SVG leader line tying it to
        //the on-ground 100 % ring. Both anchors come pre-projected
        //from the engine, see HeliosEngine.projectHomeLabelLayout().
        //The label is suppressed until both the layout (map ready)
        //and a cloud-cover value (data ready) are available.
        const layout         = this._labelLayout;
        const showLabel      = hasApiKey && layout !== null && this._cloudCover >= 0;

        //Photovoltaic production chip, pinned above the home, tinted
        //in the configured production colour and tied to the home
        //with an animated leader line whose dashes flow from the
        //house up to the chip. Only renders when the user has set
        //the optional `pv-power-entity` config and the live state
        //read produced a finite numeric value.
        const pvEntityId   = String(this.config?.['pv-power-entity'] ?? '').trim();
        const pvColor      = cfgHex(this.config?.['pv-color'], DEFAULT_PV_COLOR_HEX);
        //When the user scrubs the timeline into the past, the chip
        //should reflect what the PV system actually produced at
        //that instant, same behaviour as the cloud / irradiance
        //chips. For future scrubs there's no PV data (production
        //hasn't happened yet); we hide the chip rather than
        //showing a stale or fake number.
        const pvScrubbing  = !this._isLiveMode && this._selectedTime !== null;
        const pvScrubFuture = pvScrubbing
            && this._selectedTime!.getTime() > Date.now() + 60_000;

        //The chip displays the *instantaneous* production at the
        //active timeline instant, live "now" by default, or the
        //scrub target when the user is exploring the past. For a
        //power sensor (W/kW) we plot the entity's own state /
        //historical sample; for a cumulative-energy sensor
        //(Wh/kWh) we differentiate over the rolling buffer (live)
        //or the bracketing pair of history samples (scrub). Either
        //way the chip never shows the lifetime cumulative total ,
        //that figure is meaningless on a "current production"
        //readout.
        const pvRate = (pvEntityId !== '' && layout !== null)
            ? (pvScrubbing
                ? this._pvRateAtTime(this._selectedTime!)
                : (this._pvCurrent !== null ? this._currentPvRate() : null))
            : null;

        //Predicted PV at the scrub instant when scrubbing into the
        //future. Uses the same kWp × computePvPower(t, lat, lon, cloud)
        //path the chart's dotted forecast line uses. Falls back to
        //null when peak power is unset or no weather is available
        //yet, in which case the chip stays hidden as before.
        let pvPredictedRate: { value: number; unit: string } | null = null;
        if (pvScrubFuture && pvEntityId !== '' && layout !== null)
        {
            const k      = this._pvCalibK();
            const coords = this._getHomeCoords();
            const series = this._chartSeries;
            if (k !== null && coords && series && series.times.length > 0)
            {
                //Pick the series sample closest to _selectedTime.
                const targetMs = this._selectedTime!.getTime();
                let best = 0;
                let bestDiff = Math.abs(series.times[0].getTime() - targetMs);
                for (let i = 1; i < series.times.length; i++)
                {
                    const d = Math.abs(series.times[i].getTime() - targetMs);
                    if (d < bestDiff) { bestDiff = d; best = i; }
                }
                const cloud = series.cloud[best] ?? 0;
                const pct   = computePvPower(this._selectedTime!, coords.lat, coords.lon, cloud, this._pvPanelOrientation());
                if (pct > 0)
                {
                    //k is W per percent of STC, so pct × k is watts.
                    pvPredictedRate = { value: pct * k, unit: 'W' };
                }
            }
        }

        const isPvPredicted = pvScrubFuture && pvPredictedRate !== null;
        const pvActiveRate  = isPvPredicted ? pvPredictedRate : pvRate;

        const showPvLabel = hasApiKey
            && layout !== null
            && pvEntityId !== ''
            && pvActiveRate !== null
            && (!pvScrubFuture || isPvPredicted);

        const pvDisplayValue = showPvLabel
            ? (isPvPredicted ? '≈ ' : '') + this._formatPvValue(pvActiveRate!.value, pvActiveRate!.unit)
            : '';

        //PV → home animated leader. Same vocabulary as the existing
        //battery leaders (dashed line + arrow), painted in the
        //configured PV colour. Speed is normalised against the user's
        //configured peak power (kWp -> W), so the flow saturates
        //exactly at the install's nameplate. Without a configured
        //peak we fall back to a 5 kW reference matching the battery
        //leader's saturation so the visual cadence stays consistent.
        //Idle (no flow, no arrow) when current production is zero or
        //negative.
        const pvWattsNow = (pvRate !== null)
            ? this._pvNormalizeToWatts(pvRate.value, pvRate.unit)
            : 0;
        const pvCalibKVal = this._pvCalibK();
        const pvPeakRefW  = (pvCalibKVal !== null && pvCalibKVal > 0)
            ? pvCalibKVal * 100
            : 5000;
        const pvFlowDuration = HeliosCard._flowDuration(pvWattsNow, pvPeakRefW, 0.5);
        const pvIdle         = !(pvWattsNow > 0);
        //Animation duration of the leader-line dash flow, fast when
        //production is high, slow when production is low. Mapped on
        //the same scale as the sun ray below so the two streams feel
        //like one coherent visual language: 0 → 30 s/cycle (almost
        //still), saturated → 3 s/cycle (visible motion without being
        //annoying). For PV we saturate at ~5 kW which is a typical
        //residential peak.
        //Battery overlay, two independent chips flanking the PV
        //chip in screen-space: SoC % on the LEFT, signed Power on
        //the RIGHT, mirroring each other around the PV chip's
        //vertical axis. Each chip is wired back to the PV chip via
        //a static dotted hairline (no animation, no arrow), the
        //sign of the power value is the only encoding for charging
        //vs discharging.
        //
        //Scrub semantics mirror PV: live mode reads from
        //hass.states; past-scrub mode reads from the historical
        //series fetched via WS; future-scrub hides both chips
        //because no battery data exists past "now".
        const batterySocEntity   = String(this.config?.['battery-soc-entity']   ?? '').trim();
        const batteryPowerEntity = String(this.config?.['battery-power-entity'] ?? '').trim();
        const batteryColor       = cfgHex(this.config?.['battery-color'], DEFAULT_BATTERY_COLOR_HEX);
        const batteryScrubbing   = !this._isLiveMode && this._selectedTime !== null;
        const batteryScrubFuture = batteryScrubbing
            && this._selectedTime!.getTime() > Date.now() + 60_000;

        //Active SoC / power values for this render, historical
        //samples in scrub mode, live state otherwise.
        const activeBatterySoc: number | null = batteryScrubbing
            ? this._batterySampleAtTime(this._batterySocHistory, this._selectedTime!)
            : this._batterySoc;
        const activeBatteryPower: number | null = batteryScrubbing
            ? this._batterySampleAtTime(this._batteryPowerHistory, this._selectedTime!)
            : this._batteryPower;
        //The power unit doesn't change between live and history
        //samples (same entity, same configuration), so we read it
        //from the live state cache regardless of mode.
        const activeBatteryUnit = this._batteryPowerUnit;

        const showSocChip = (hasApiKey && layout !== null)
            && !batteryScrubFuture
            && batterySocEntity !== ''
            && activeBatterySoc !== null;
        const showPowerChip = (hasApiKey && layout !== null)
            && !batteryScrubFuture
            && batteryPowerEntity !== ''
            && activeBatteryPower !== null;

        const batterySocText = showSocChip
            ? `${Math.round(activeBatterySoc!)} %`
            : '';
        const batteryPowerText = showPowerChip
            ? this._formatBatteryPower(activeBatteryPower!, activeBatteryUnit)
            : '';

        //Charging / discharging direction drives the SVG arrow
        //path direction on the PV↔Power leader. Sign comes straight
        //from the entity (positive = charging by convention).
        //Charging: arrow flows PV → Power (energy moving INTO the
        //battery). Discharging: arrow flows Power → PV (energy
        //moving OUT). The dashes flow at a speed proportional to
        //|P|, saturating at the same ~5 kW threshold as the PV
        //leader so all energy-flow streams read on the same scale.
        const batteryCharging  = showPowerChip && (activeBatteryPower! > 0);
        const batteryWattsForFlow = showPowerChip
            ? Math.abs(this._pvNormalizeToWatts(activeBatteryPower!, activeBatteryUnit))
            : 0;
        //"Idle", measured power within sensor-noise margin of zero
        //(±5 W). The leader is still drawn so the user keeps the
        //spatial relationship, but the dash flow is frozen and the
        //arrow head is hidden, nothing is moving in either
        //direction, so any motion would be misleading.
        const batteryIdle = showPowerChip && batteryWattsForFlow < 5;
        const batteryFlowDuration = HeliosCard._flowDuration(batteryWattsForFlow, 5000);

        //Battery leader L-shape geometry, computed once and reused
        //for the visible <path> elements (SoC and Power) and for
        //the animated arrow's <animateMotion> path. Only meaningful
        //when a layout is available; gated by the same flag as the
        //chip rendering so we don't dereference a null layout below.
        //
        //  PV_LEG_OFFSET_PX (12) is the horizontal distance from
        //  the PV chip's centre to each L-leg's vertical drop.
        //  The SoC L hangs to the LEFT of centre by this amount,
        //  the Power L to the RIGHT, bringing both legs slightly
        //  inboard of the chip's quarter-width so the bends sit
        //  closer to the chip's middle. Constant rather than
        //  measured because the chips are min-width-clamped to
        //  76 px in the common case, see helios-card-css.ts.
        //  PV_HALF_HEIGHT_PX (11) places the top of the vertical
        //  leg flush against PV's bottom edge so the line emerges
        //  from the chip rather than from inside it.
        //  CHIP_NUDGE_PX (32) is the horizontal distance from each
        //  battery chip's centre to the inside of its left/right
        //  edge, so the chip background covers the very tip of
        //  the leader and the visible dash sequence terminates
        //  cleanly at the chip border.
        //  FILLET_R (6) rounds the corner of the L with a quadratic
        //  Bézier. The visible line and the arrow's <animateMotion>
        //  path share the same fillet, so the arrow's tangent
        //  rotates smoothly through the bend instead of snapping
        //  90° at the corner. SMIL parametrises the path at
        //  constant linear velocity, so the time spent on the
        //  fillet shrinks proportionally with `flowDuration`.
        //L-leg starting points. The PV chip is 76 px wide (min-width
        //set on .pv-pct-label); pinning the legs at 25 % and 75 % of
        //that width drops each foot 19 px off the chip's centre, well
        //inside the chip body so the L's vertical leg visibly emerges
        //from a clear PV anchor instead of crowding the chip's centre.
        const PV_LEG_OFFSET_PX     = 19;
        const PV_HALF_HEIGHT_PX    = 11;
        //Half-width of the PV chip, min-width:76 in .pv-pct-label,
        //so 38 px from centre to either side. Used for the solar-ray
        //target snap (left/right side of the chip) when the sun sits
        //roughly horizontal to the chip.
        const PV_HALF_WIDTH_PX     = 38;
        const BAT_CHIP_NUDGE_PX    = 32;
        const FILLET_R             = 6;
        //PV chip sits BELOW the SoC / Power shelf, so each L-leader
        //runs from PV's TOP edge upward to the shelf, then
        //horizontally to the SoC / Power chip.
        const lPvEdgeY      = layout ? layout.pvLabel.y - PV_HALF_HEIGHT_PX           : 0;
        const lShelfY       = layout ? layout.batterySocLabel.y                       : 0;
        const lSocLegX      = layout ? layout.pvLabel.x - PV_LEG_OFFSET_PX            : 0;
        const lPowerLegX    = layout ? layout.pvLabel.x + PV_LEG_OFFSET_PX            : 0;
        const lSocEndX      = layout ? layout.batterySocLabel.x   + BAT_CHIP_NUDGE_PX : 0;
        const lPowerEndX    = layout ? layout.batteryPowerLabel.x - BAT_CHIP_NUDGE_PX : 0;
        //Forward L: PV edge → vertical leg → fillet → horizontal leg
        //→ end. Direction-agnostic, the vertical leg can travel up
        //or down because the fillet approach point follows the sign
        //of (shelfY - pvEdgeY).
        const buildLPath = (verticalX: number, pvEdgeY: number, shelfY: number, endX: number): string =>
        {
            const dirH  = endX  > verticalX ? 1 : -1;
            const dirV  = shelfY > pvEdgeY  ? 1 : -1;
            //Clamp the radius so the fillet never overshoots a short
            //leg, the rounded corner has to fit inside both legs.
            const r     = Math.min(FILLET_R, Math.abs(shelfY - pvEdgeY) / 2, Math.abs(endX - verticalX) / 2);
            const preY  = shelfY - dirV * r;
            const postX = verticalX + dirH * r;
            return `M ${verticalX},${pvEdgeY} L ${verticalX},${preY} Q ${verticalX},${shelfY} ${postX},${shelfY} L ${endX},${shelfY}`;
        };
        //Reversed L: end of horizontal leg → fillet → vertical leg →
        //PV edge. Used for the discharging arrow only.
        const buildLPathReverse = (verticalX: number, pvEdgeY: number, shelfY: number, endX: number): string =>
        {
            const dirH  = endX  > verticalX ? 1 : -1;
            const dirV  = shelfY > pvEdgeY  ? 1 : -1;
            const r     = Math.min(FILLET_R, Math.abs(shelfY - pvEdgeY) / 2, Math.abs(endX - verticalX) / 2);
            const preY  = shelfY - dirV * r;
            const postX = verticalX + dirH * r;
            return `M ${endX},${shelfY} L ${postX},${shelfY} Q ${verticalX},${shelfY} ${verticalX},${preY} L ${verticalX},${pvEdgeY}`;
        };
        const socLeaderPath   = buildLPath(lSocLegX,   lPvEdgeY, lShelfY, lSocEndX);
        const powerLeaderPath = buildLPath(lPowerLegX, lPvEdgeY, lShelfY, lPowerEndX);
        const powerArrowPath  = batteryCharging
            ? buildLPath(lPowerLegX, lPvEdgeY, lShelfY, lPowerEndX)
            : buildLPathReverse(lPowerLegX, lPvEdgeY, lShelfY, lPowerEndX);

        //Solar-arc overlay, sun trajectory across the sky, sun's
        //current position, and incidence ray to the home. All
        //pre-projected to screen space by the engine via
        //projectSunScene(). Hidden until the engine is ready.
        const sunScene  = this._sunScene;
        const showSun   = hasApiKey && sunScene !== null && sunScene.arc.length >= 2;

        //Fixed colour design system. The configured sun
        //colour paints the arc, the outer rim of the sun disc,
        //and the inner irradiance fill. The on-ground cloud disc
        //is painted in MapLibre paint properties from the engine
        //(see _updateCloudCoverDisc) so we don't need the cloud
        //hex in this render block.
        const sunColor      = cfgHex(this.config?.['sun-color'],   DEFAULT_SUN_COLOR_HEX);
        const sunRimColor   = this._darkenHex(sunColor, 0.20);
        const arcSegments   = showSun ? this._buildArcSegments(sunScene!.arc, sunColor) : [];
        //Z-order split: below-horizon (dotted) segments render BEHIND
        //the home chip cluster so the home reads cleanly through the
        //night portion of the loop, while above-horizon segments, the
        //sun ray, the sun disc and the W/m² readout render AFTER all
        //chips so the live sun stays visually dominant, no chip ever
        //occludes the body of the day.
        const arcSegmentsBack  = arcSegments.filter(s =>  s.belowHorizon);
        const arcSegmentsFront = arcSegments.filter(s => !s.belowHorizon);

        //The incidence ray only renders when the sun is actually
        //above the horizon, drawing a ray from below the ground
        //towards the home would be visually nonsensical.
        const showRay = showSun && sunScene!.sun.altitude > 0;

        //Live irradiance for the on-map W/m² label that floats
        //above the sun disc. We also derive the inner-disc fill
        //ratio from it: at STC (1000 W/m²) the fill reaches the
        //rim; at zero (night, but masked anyway) the fill vanishes.
        //The square-root mapping linearises the *area* perception
        //(area ∝ r²), so a 50% reading shows a fill that visually
        //covers half the rim's area, not half the rim's radius.
        const sunWm2          = sunScene?.sun.irradiance ?? 0;
        const sunWm2Round     = Math.round(sunWm2);
        const sunFillRatio    = Math.sqrt(Math.max(0, Math.min(1, sunWm2 / 1000)));
        const showSunLabel    = showSun && sunScene!.sun.altitude > 0;
        //Animation duration of the solar-ray dash flow. Same scale as
        //the PV leader (see _flowDuration / _pvNormalizeToWatts) so
        //both streams pulse at coherent rates: the sun ray saturates
        //at 1000 W/m² (clear-sky noon).
        //Sun ray spans the whole card, keep the saturated-end pace
        //a touch slower than the PV leader (0.8 s vs the default
        //0.4 s) so peak-irradiance flow stays readable rather than
        //feeling frantic at the top of the day.
        const sunFlowDuration = HeliosCard._flowDuration(sunWm2, 1000, 0.8);

        //Solar-ray target, snaps to one of the 4 sides of the PV
        //chip based on which side faces the sun. The compass angle
        //is measured from the PV chip's centre to the sun, with 0°
        //pointing up; ±45° windows around each cardinal direction
        //pick the matching chip side:
        //    [-45°,  45°] → TOP
        //    [ 45°, 135°] → RIGHT
        //   |angle|>135°  → BOTTOM
        //    [-135°,-45°] → LEFT
        //Without this snap, a sun sitting below the chip pulled the
        //ray through the chip's top, which looked broken.
        let sunRayTargetX = sunScene?.home.x ?? 0;
        let sunRayTargetY = sunScene?.home.y ?? 0;
        if (layout && sunScene)
        {
            const dx       = sunScene.sun.x - layout.pvLabel.x;
            const dy       = sunScene.sun.y - layout.pvLabel.y;
            const compass  = Math.atan2(dx, -dy);   // 0 = up, +π/2 = right
            const Q        = Math.PI / 4;           // 45°
            const absC     = Math.abs(compass);
            if (absC <= Q)
            {
                //Sun is above → attach to top-centre.
                sunRayTargetX = layout.pvLabel.x;
                sunRayTargetY = layout.pvLabel.y - PV_HALF_HEIGHT_PX;
            }
            else if (absC >= 3 * Q)
            {
                //Sun is below → attach to bottom-centre.
                sunRayTargetX = layout.pvLabel.x;
                sunRayTargetY = layout.pvLabel.y + PV_HALF_HEIGHT_PX;
            }
            else if (compass > 0)
            {
                //Sun is to the right → attach to right-centre.
                sunRayTargetX = layout.pvLabel.x + PV_HALF_WIDTH_PX;
                sunRayTargetY = layout.pvLabel.y;
            }
            else
            {
                //Sun is to the left → attach to left-centre.
                sunRayTargetX = layout.pvLabel.x - PV_HALF_WIDTH_PX;
                sunRayTargetY = layout.pvLabel.y;
            }
        }

        const cardTheme = String(this.config?.['card-theme'] ?? 'light').toLowerCase();
        const cardThemeClass = cardTheme === 'dark' ? 'theme-dark' : 'theme-light';

        //showPlaceholder collapses two cases that share the same
        //render: (a) HA hasn't published home coordinates yet (the
        //card is in a fresh dashboard before the location is set),
        //(b) the card is rendered inside HA's dashboard editor
        //preview, where we deliberately skip the WebGL engine to
        //avoid context exhaustion. Both fall back to the same
        //illustrated placeholder.
        const showPlaceholder = !hasApiKey || this._isInEditorPreview;

        return html`
            <ha-card class="${cardThemeClass} ${showPlaceholder ? 'placeholder-mode' : ''} ${this._detailMode ? 'detail-active' : ''}">

                ${showPlaceholder ? this._renderPlaceholder() : nothing}

                <div id="map-container" class="${showPlaceholder ? 'hidden' : ''}"></div>

                ${hasApiKey && this._timeRange ? html`
                    <div
                        class="time-bar"
                        @pointerdown="${this._onTimelinePointerDown}"
                    >
                        <!--  Optional PV production graph, only
                              rendered when the user has set the
                              pv-power-entity config. Same chip
                              styling as the main chart card; sits
                              just above it with a 4 px gap so the
                              two read as a stacked instrument. The
                              graph's height is the same as one half
                              of the main chart so the irradiance
                              area and the PV area visually balance
                              each other.  -->
                        ${pvEntityId ? html`
                            <div class="tb-chart-card tb-pv-card">
                                ${this._renderPvChart()}
                                ${this._renderTimelineTicks()}
                            </div>
                        ` : nothing}

                        <!--  Chart card: hosts the area chart, the
                              dotted day separators, the day-label
                              chips on the midline, and the live +
                              scrub cursors as HTML overlays.  -->
                        <div class="tb-chart-card">
                            ${this._renderChart()}
                            ${this._renderTimelineDayLabels()}
                            ${this._renderTimelineTicks()}
                        </div>
                    </div>
                ` : nothing}

                ${hasApiKey ? html`
                    <div class="spinner-center ${this._fetching ? 'spinning' : ''}">
                        <div class="spinner"></div>
                    </div>
                ` : nothing}

                <!--  Top-right column. Hosts the back-to-live button
                      (shown only while the user has scrubbed away from
                      now) on top, and the LiDAR shadow busy chip below
                      it. When both are visible they stack vertically;
                      when only one is visible the column still sits at
                      the same 8 px edge margin as the clock and timeline.  -->
                <!--  Top-right column carries only the LiDAR shadow
                      busy chip; the back-to-live button lives next
                      to the clock (top-left) since both relate to
                      "where am I in time".  -->
                ${hasApiKey && this._shadowBusy ? html`
                    <div class="overlay-top-right">
                        <div
                            class="shadow-busy-chip"
                            title="LiDAR"
                            aria-label="LiDAR"
                        >
                            <ha-icon icon="mdi:weather-sunny" class="shadow-busy-sun"></ha-icon>
                        </div>
                    </div>
                ` : nothing}

                <!--  Top-left cluster: clock chip showing the active
                      timeline instant + (in scrub mode) a back-to-
                      live button right beside it. The clock takes a
                      blue / white "is-scrub" theme when scrubbing
                      so the same chip doubles as the mode signal,
                      no separate scrub-time chip needed lower on
                      the card.  -->
                ${hasApiKey ? html`
                    <div class="overlay-top-left">
                        <div class="clock ${!this._isLiveMode ? 'is-scrub' : ''}">
                            <span class="clock-date">${displayDateLabel}</span>
                            <span class="clock-time">${displayTimeLabel}</span>
                        </div>
                        ${!this._isLiveMode ? html`
                            <button
                                class="live-return-btn"
                                @click="${this._resetToLive}"
                                aria-label="Back to live"
                            >
                                <ha-icon icon="mdi:restore"></ha-icon>
                            </button>
                        ` : nothing}
                    </div>
                ` : nothing}

                ${hasApiKey && this._cloudScene ? (() => {
                    //SVG-projected cloud disc + 100 % ring. The
                    //screen-space points come from the engine via
                    //projectCloudScene() (anchor-at-home), so the
                    //rendered shape stays a true circle whatever the
                    //terrain mesh does underneath.
                    //
                    //The disc is split into three concentric bands
                    //sized by each layer's share of (low+mid+high)
                    //and shaded with three derivatives of the
                    //configured cloud colour: light (low, innermost),
                    //normal (mid), dark (high, outermost). We stack
                    //outer → inner so each smaller polygon visually
                    //"covers" the centre of the larger one to create
                    //the band appearance — no SVG mask / clip needed.
                    const cs        = this._cloudScene!;
                    const lowPts    = cs.discLow.length  >= 3 ? cs.discLow .map(p => `${p.x},${p.y}`).join(' ') : '';
                    const midPts    = cs.discMid.length  >= 3 ? cs.discMid .map(p => `${p.x},${p.y}`).join(' ') : '';
                    const highPts   = cs.discHigh.length >= 3 ? cs.discHigh.map(p => `${p.x},${p.y}`).join(' ') : '';
                    const ringPts   = cs.ring.length     >= 3 ? cs.ring    .map(p => `${p.x},${p.y}`).join(' ') : '';
                    //Light (low) and dark (high) shades: lerp the
                    //cloud hex toward white / black. Mid uses the
                    //configured cloud colour as-is.
                    const cloudLight = this._lerpHexToward(cs.cloudHex, '#ffffff', 0.55);
                    const cloudDark  = this._lerpHexToward(cs.cloudHex, '#000000', 0.40);
                    //SVG mask: white background = cloud visible
                    //everywhere, black home silhouettes punch a hole
                    //so the actual MapLibre extrusion (walls, roof,
                    //outline glow) shows through. Re-projected each
                    //transform via projectHomeFootprints so the cut-
                    //out tracks rotation. Empty array until the
                    //buildings GeoJSON has landed; the mask then
                    //degrades to "all visible" and the disc covers
                    //the home as before.
                    const silhouettes = this._homeSilhouettes;
                    const maskId = 'helios-cloud-home-mask';
                    return html`
                        <svg class="cloud-svg">
                            <defs>
                                <mask id="${maskId}" maskUnits="userSpaceOnUse">
                                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                    ${silhouettes.map(sil => {
                                        const N = Math.min(sil.base.length, sil.top.length);
                                        if (N < 3) return nothing;
                                        const basePts = sil.base.map(p => `${p.x},${p.y}`).join(' ');
                                        const topPts  = sil.top .map(p => `${p.x},${p.y}`).join(' ');
                                        const walls   = [];
                                        for (let i = 0; i < N; i++)
                                        {
                                            const j = (i + 1) % N;
                                            walls.push(
                                                `${sil.base[i].x},${sil.base[i].y} ` +
                                                `${sil.base[j].x},${sil.base[j].y} ` +
                                                `${sil.top [j].x},${sil.top [j].y} ` +
                                                `${sil.top [i].x},${sil.top [i].y}`
                                            );
                                        }
                                        //Tiny 1 px stroke pads the mask
                                        //outward by half a pixel so SVG
                                        //sub-pixel anti-aliasing on the
                                        //silhouette edge can never leave
                                        //a visible cloud sliver. Just
                                        //breathing room, no visible halo.
                                        return svg`
                                            <polygon points="${basePts}" fill="black" stroke="black" stroke-width="1" stroke-linejoin="round" />
                                            <polygon points="${topPts}"  fill="black" stroke="black" stroke-width="1" stroke-linejoin="round" />
                                            ${walls.map(w => svg`
                                                <polygon points="${w}" fill="black" stroke="black" stroke-width="1" stroke-linejoin="round" />
                                            `)}
                                        `;
                                    })}
                                </mask>
                            </defs>
                            ${ringPts ? svg`
                                <polygon class="cloud-ring" points="${ringPts}" />
                            ` : nothing}
                            <g mask="url(#${maskId})">
                                ${highPts ? svg`
                                    <polygon
                                        class="cloud-disc cloud-disc-high"
                                        points="${highPts}"
                                        fill="${cloudDark}"
                                        fill-opacity="0.5"
                                    />
                                ` : nothing}
                                ${midPts ? svg`
                                    <polygon
                                        class="cloud-disc cloud-disc-mid"
                                        points="${midPts}"
                                        fill="${cs.cloudHex}"
                                        fill-opacity="0.5"
                                    />
                                ` : nothing}
                                ${lowPts ? svg`
                                    <polygon
                                        class="cloud-disc cloud-disc-low"
                                        points="${lowPts}"
                                        fill="${cloudLight}"
                                        fill-opacity="0.5"
                                    />
                                ` : nothing}
                                <!--  Thin separator outlines on the band
                                      boundaries. The reference ring at
                                      100 % already paints the outermost
                                      edge, so we only need the two inner
                                      separators (mid ↔ high and low ↔
                                      mid). Stroke-only, no fill, drawn
                                      on top so the boundary reads
                                      cleanly without flattening the
                                      band colours behind them.  -->
                                ${highPts ? svg`
                                    <polygon
                                        class="cloud-band-sep"
                                        points="${highPts}"
                                    />
                                ` : nothing}
                                ${midPts ? svg`
                                    <polygon
                                        class="cloud-band-sep"
                                        points="${midPts}"
                                    />
                                ` : nothing}
                            </g>
                        </svg>
                    `;
                })() : nothing}

                <!--  Solar arc, BACK pass. Renders only the dotted
                      below-horizon segments (the sun's path through
                      the underside of the celestial sphere), so the
                      home and its chips read in front of the night
                      half of the loop. Above-horizon segments, the
                      ray, the disc and the W/m² readout move to the
                      FRONT pass at the end of the overlay stack.  -->
                ${showSun && arcSegmentsBack.length > 0 ? html`
                    <svg
                        class="solar-svg solar-svg-back"
                        style="--solar-daylight:${sunScene!.daylight}"
                    >
                        ${arcSegmentsBack.map(s => svg`
                            <line
                                class="solar-arc-outline solar-arc-night"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke-width="${(HeliosCard.OUTLINE_FAR
                                    + (HeliosCard.OUTLINE_NEAR - HeliosCard.OUTLINE_FAR) * s.nearness)
                                    * HeliosCard.NIGHT_STROKE_FACTOR}"
                            ></line>
                        `)}
                        ${arcSegmentsBack.map(s => svg`
                            <line
                                class="solar-arc-segment solar-arc-night"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke="${s.color}"
                                stroke-width="${(HeliosCard.SEGMENT_FAR
                                    + (HeliosCard.SEGMENT_NEAR - HeliosCard.SEGMENT_FAR) * s.nearness)
                                    * HeliosCard.NIGHT_STROKE_FACTOR}"
                            ></line>
                        `)}
                    </svg>
                ` : nothing}

                ${showLabel ? (() =>
                {
                    //Endpoint = fill-disc edge in the chip-to-home
                    //direction. The fill disc shares the ring's
                    //centre (= home) and scales linearly with cloud
                    //cover %; at 0 % the radius is zero and the line
                    //terminates at home, at 100 % it reaches the
                    //full ring edge. Pinning the endpoint to the
                    //live fill, rather than to a static ring or
                    //the home centre, keeps the leader "hugging"
                    //the disc as it grows and shrinks.
                    const pct  = Math.max(0, Math.min(100, this._cloudCover));
                    const tFill = pct / 100;
                    const endX  = layout!.home.x + (layout!.ringEdge.x - layout!.home.x) * tFill;
                    const endY  = layout!.home.y + (layout!.ringEdge.y - layout!.home.y) * tFill;
                    return html`
                        <svg class="cloud-leader-svg">
                            <line
                                x1="${layout!.cloudLabel.x + 10}"
                                y1="${layout!.cloudLabel.y}"
                                x2="${endX}"
                                y2="${endY}"
                            ></line>
                        </svg>`;
                })() : nothing}
                ${showLabel ? html`
                    <div
                        class="cloud-pct-label"
                        style="left:${layout!.cloudLabel.x}px; top:${layout!.cloudLabel.y}px"
                    >
                        <ha-icon icon="mdi:weather-cloudy"></ha-icon>
                        <span>${cloudPctRound}%</span>
                    </div>
                ` : nothing}

                <!--  PV → home animated leader. Vertical dashed line
                      from the PV chip's bottom edge down to the home
                      marker, painted in the configured PV colour and
                      flowing toward the home at a pace proportional
                      to live production over theoretical peak. Same
                      dash vocabulary as the battery leader, no L bend
                      because PV and the home share the same X anchor
                      so a straight segment is the right vocabulary.
                      Hidden when no PV entity is configured.  -->
                ${showPvLabel ? html`
                    <svg class="pv-home-leader-svg">
                        <line
                            class="pv-home-leader-line"
                            style="--pv-leader-color:${pvColor}"
                            x1="${layout!.pvLabel.x}"
                            y1="${layout!.pvLabel.y + PV_HALF_HEIGHT_PX}"
                            x2="${layout!.home.x}"
                            y2="${layout!.home.y}"
                        ></line>
                        ${!pvIdle ? svg`
                            <!--  Moving bead, a small filled disc rides
                                  the leader from the PV chip to the
                                  home, at a speed proportional to live
                                  production (same vocabulary as the
                                  Home Assistant energy-distribution
                                  card). No rotate="auto" needed since
                                  a disc has no orientation.  -->
                            <circle
                                class="pv-home-leader-bead"
                                r="4"
                                fill="${pvColor}"
                            >
                                <animateMotion
                                    dur="${pvFlowDuration}s"
                                    repeatCount="indefinite"
                                    path="M ${layout!.pvLabel.x},${layout!.pvLabel.y + PV_HALF_HEIGHT_PX} L ${layout!.home.x},${layout!.home.y}"
                                ></animateMotion>
                            </circle>
                        ` : nothing}
                        <!--  Anchor bead at the home end of the leader,
                              same colour as the line so the two read
                              as one continuous element. Sized slightly
                              larger than the moving bead (r 5 vs 4)
                              so the destination reads as the "target"
                              rather than another in-flight particle.
                              When production is non-zero we synchronise
                              an SVG <animate> pulse on the r attribute
                              with the bead's animateMotion cycle: the
                              anchor swells from r 5 to r 9 during the
                              last ~15 % of the cycle (i.e. as the bead
                              approaches) and snaps back at the cycle
                              boundary. Visual effect, the anchor
                              "absorbs" each incoming bead.  -->
                        <circle
                            class="pv-home-leader-anchor"
                            cx="${layout!.home.x}"
                            cy="${layout!.home.y}"
                            r="5"
                            fill="${pvColor}"
                        >
                            ${!pvIdle ? svg`
                                <animate
                                    attributeName="r"
                                    values="5;5;9;5"
                                    keyTimes="0;0.80;0.97;1"
                                    dur="${pvFlowDuration}s"
                                    repeatCount="indefinite"
                                ></animate>
                            ` : nothing}
                        </circle>
                    </svg>
                ` : nothing}

                ${showPvLabel ? html`
                    <div
                        class="pv-pct-label ${isPvPredicted ? 'is-predicted' : ''}"
                        style="left:${layout!.pvLabel.x}px; top:${layout!.pvLabel.y}px; --pv-leader-color:${pvColor}"
                    >
                        <ha-icon icon="mdi:solar-power-variant"></ha-icon>
                        <span>${pvDisplayValue}</span>
                    </div>
                ` : nothing}

                ${(showSocChip || showPowerChip) ? html`
                    <svg class="battery-leader-svg">
                        <!--
                            SoC ↔ PV, solid, inverted-L path with a
                            rounded corner. No animation: SoC is a
                            level, not a flow direction.
                        -->
                        ${showSocChip ? svg`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${batteryColor}"
                                d="${socLeaderPath}"
                            ></path>
                        ` : nothing}
                        <!--
                            PV ↔ Power, solid L-shaped path with a
                            small filled bead riding along it at a
                            speed proportional to |P|. The bead's
                            animateMotion path is flipped inline by
                            the renderer when discharging so the
                            travel direction matches the energy flow
                            (PV → Power when charging, Power → PV
                            when discharging).
                        -->
                        ${showPowerChip ? svg`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${batteryColor}"
                                d="${powerLeaderPath}"
                            ></path>
                            ${!batteryIdle ? svg`
                                <circle
                                    class="battery-leader-bead"
                                    r="4"
                                    fill="${batteryColor}"
                                >
                                    <animateMotion
                                        dur="${batteryFlowDuration}s"
                                        repeatCount="indefinite"
                                        path="${powerArrowPath}"
                                    ></animateMotion>
                                </circle>
                            ` : nothing}
                        ` : nothing}
                    </svg>
                    ${showSocChip ? html`
                        <div
                            class="battery-pct-label"
                            style="left:${layout!.batterySocLabel.x}px; top:${layout!.batterySocLabel.y}px; --battery-leader-color:${batteryColor}"
                        >
                            <ha-icon icon="mdi:battery"></ha-icon>
                            <span>${batterySocText}</span>
                        </div>
                    ` : nothing}
                    ${showPowerChip ? html`
                        <div
                            class="battery-pct-label"
                            style="left:${layout!.batteryPowerLabel.x}px; top:${layout!.batteryPowerLabel.y}px; --battery-leader-color:${batteryColor}"
                        >
                            <ha-icon icon="mdi:lightning-bolt"></ha-icon>
                            <span>${batteryPowerText}</span>
                        </div>
                    ` : nothing}
                ` : nothing}

                <!--  Solar arc, FRONT pass. Renders the above-horizon
                      portion of the sun's loop, the incidence ray to
                      the PV chip, and the sun disc itself, placed AFTER
                      every home-anchored chip so the live sun always
                      reads on top. The card is named Helios, the sun
                      must dominate the stack visually.  -->
                ${showSun && arcSegmentsFront.length > 0 ? html`
                    <svg
                        class="solar-svg solar-svg-front"
                        style="--solar-daylight:${sunScene!.daylight}"
                    >
                        ${arcSegmentsFront.map(s => svg`
                            <line
                                class="solar-arc-outline"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke-width="${HeliosCard.OUTLINE_FAR
                                    + (HeliosCard.OUTLINE_NEAR - HeliosCard.OUTLINE_FAR) * s.nearness}"
                            ></line>
                        `)}
                        ${arcSegmentsFront.map(s => svg`
                            <line
                                class="solar-arc-segment"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke="${s.color}"
                                stroke-width="${HeliosCard.SEGMENT_FAR
                                    + (HeliosCard.SEGMENT_NEAR - HeliosCard.SEGMENT_FAR) * s.nearness}"
                            ></line>
                        `)}
                        ${showRay ? svg`
                            <line
                                class="solar-ray"
                                style="--sun-flow-duration:${sunFlowDuration}s"
                                x1="${sunScene!.sun.x}"  y1="${sunScene!.sun.y}"
                                x2="${sunRayTargetX}"    y2="${sunRayTargetY}"
                                stroke="${sunColor}"
                            ></line>
                            <polygon
                                class="solar-ray-arrow"
                                points="-6,-4 0,0 -6,4"
                                fill="${sunColor}"
                            >
                                <animateMotion
                                    dur="${sunFlowDuration}s"
                                    repeatCount="indefinite"
                                    rotate="auto"
                                    path="M ${sunScene!.sun.x},${sunScene!.sun.y} L ${sunRayTargetX},${sunRayTargetY}"
                                ></animateMotion>
                            </polygon>
                        ` : nothing}
                        ${(() => {
                            //Sun disc, four concentric layers, painted
                            //in render order (back to front):
                            //  0. Halo, soft glow whose radius (3 ×
                            //     disc) and centre opacity both scale
                            //     with irradiance, so a clear-sky noon
                            //     sun radiates a visible aura while a
                            //     cloudy or low-altitude sun stays
                            //     compact. The fill uses a radial
                            //     gradient that drops cleanly from the
                            //     irradiance-driven opacity at the
                            //     centre to fully transparent at the
                            //     rim, so the glow feathers into the
                            //     basemap without any hard edge.
                            //  1. Background fill (configured colour at
                            //     SUN_FILL_OPACITY_BG) so the empty disc
                            //     reads as faintly tinted glass.
                            //  2. Inner fill (configured colour, fully
                            //     opaque) whose radius = sunFillRatio
                            //     × outer radius; conveys irradiance.
                            //     Sub-pixel radii are rounded out by the
                            //     SVG renderer; below ~1 px the inner
                            //     disc is invisible anyway, which is the
                            //     correct visual for "no sun".
                            //  3. Outer rim (slightly darkened sun
                            //     colour) so the disc has a clear edge
                            //     against the basemap regardless of
                            //     contrast.
                            const r = HeliosCard.SUN_R_FAR
                                    + (HeliosCard.SUN_R_NEAR - HeliosCard.SUN_R_FAR) * sunScene!.sun.nearness;
                            const rInner = r * sunFillRatio;
                            //Halo proportional to live irradiance,
                            //saturating at 1000 W/m² (clear-sky noon).
                            //Same square-root mapping as sunFillRatio so
                            //a 50 % reading visually halves the AREA of
                            //the glow rather than its radius.
                            const haloR        = r * 3;
                            const haloAlphaMax = sunFillRatio * 0.55;
                            return svg`
                                <defs>
                                    <radialGradient id="solar-halo-grad">
                                        <stop offset="0%"   stop-color="${sunColor}" stop-opacity="${haloAlphaMax}"></stop>
                                        <stop offset="100%" stop-color="${sunColor}" stop-opacity="0"></stop>
                                    </radialGradient>
                                </defs>
                                <circle
                                    class="solar-sun-halo"
                                    cx="${sunScene!.sun.x}" cy="${sunScene!.sun.y}"
                                    r="${haloR}"
                                    fill="url(#solar-halo-grad)"
                                ></circle>
                                <circle
                                    class="solar-sun-bg"
                                    cx="${sunScene!.sun.x}" cy="${sunScene!.sun.y}"
                                    r="${r}"
                                    fill="${sunColor}"
                                    fill-opacity="${HeliosCard.SUN_FILL_OPACITY_BG}"
                                ></circle>
                                <circle
                                    class="solar-sun-fill"
                                    cx="${sunScene!.sun.x}" cy="${sunScene!.sun.y}"
                                    r="${rInner}"
                                    fill="${sunColor}"
                                    stroke="${sunRimColor}"
                                    stroke-width="0.5"
                                ></circle>
                                <circle
                                    class="solar-sun-rim"
                                    cx="${sunScene!.sun.x}" cy="${sunScene!.sun.y}"
                                    r="${r}"
                                    fill="none"
                                    stroke="${sunColor}"
                                    stroke-width="${HeliosCard.SUN_RIM_WIDTH}"
                                ></circle>
                            `;
                        })()}
                    </svg>
                ` : nothing}

                <!--  W/m² label, pinned above the sun disc. Same
                      visual language as the cloud-cover label, both
                      read as a matched pair of cartographic readouts.
                      Lands after the front-pass arc so the readout
                      sits on top of the sun glyph as well.  -->
                ${showSunLabel ? html`
                    <div
                        class="solar-pct-label"
                        style="left:${sunScene!.sun.x}px; top:${sunScene!.sun.y - 22}px"
                    >
                        <ha-icon icon="mdi:white-balance-sunny"></ha-icon>
                        <span>${sunWm2Round} W/m²</span>
                    </div>
                ` : nothing}

                <!--  Sunrise / sunset markers. ha-icon glyphs centred
                      on the horizon crossings of the day's solar arc,
                      coloured in the configured sun colour. The icon
                      shape itself signals the meaning (sun rising /
                      setting) so no label or rotation is needed.
                      Skipped on polar days where the sun never
                      crosses the horizon.  -->
                ${showSun && sunScene!.sunrise ? html`
                    <ha-icon
                        class="solar-horizon-icon solar-horizon-sunrise"
                        icon="mdi:weather-sunset-up"
                        style="left:${sunScene!.sunrise.x}px; top:${sunScene!.sunrise.y}px; color:${sunColor}"
                    ></ha-icon>
                ` : nothing}
                ${showSun && sunScene!.sunset ? html`
                    <ha-icon
                        class="solar-horizon-icon solar-horizon-sunset"
                        icon="mdi:weather-sunset-down"
                        style="left:${sunScene!.sunset.x}px; top:${sunScene!.sunset.y}px; color:${sunColor}"
                    ></ha-icon>
                ` : nothing}

                <!--  Home hover glow, sun-coloured halo around the
                      projected home silhouette. Reuses the same base
                      ring + top ring + side quads as the cloud-disc
                      mask (so it tracks rotation and matches the
                      extrusion exactly), painted as fill + stroke in
                      the configured sun colour with a CSS drop-
                      shadow filter for the bloom. The opacity is
                      flipped via a class so the appearance / fade is
                      a pure CSS transition, no per-frame work.  -->
                ${hasApiKey && this._homeSilhouettes.length > 0 && !this._detailMode ? (() => {
                    const sunColor = cfgHex(this.config?.['sun-color'], DEFAULT_SUN_COLOR_HEX);
                    return html`
                        <svg class="home-glow-svg ${this._homeHover ? 'is-hovered' : ''}"
                             style="--helios-sun-color:${sunColor}">
                            ${this._homeSilhouettes.map(sil => {
                                const N = Math.min(sil.base.length, sil.top.length);
                                if (N < 3) return nothing;
                                const basePts = sil.base.map(p => `${p.x},${p.y}`).join(' ');
                                const topPts  = sil.top .map(p => `${p.x},${p.y}`).join(' ');
                                const walls   = [];
                                for (let i = 0; i < N; i++)
                                {
                                    const j = (i + 1) % N;
                                    walls.push(
                                        `${sil.base[i].x},${sil.base[i].y} ` +
                                        `${sil.base[j].x},${sil.base[j].y} ` +
                                        `${sil.top [j].x},${sil.top [j].y} ` +
                                        `${sil.top [i].x},${sil.top [i].y}`
                                    );
                                }
                                return svg`
                                    <polygon class="home-glow-shape" points="${basePts}" />
                                    <polygon class="home-glow-shape" points="${topPts}"  />
                                    ${walls.map(w => svg`
                                        <polygon class="home-glow-shape" points="${w}" />
                                    `)}
                                `;
                            })}
                        </svg>
                    `;
                })() : nothing}

                <!--  Home hitbox, an invisible circular click target
                      centred on the home's projected screen position.
                      Visible (interactive) only when the map layout is
                      ready AND we're not already in detail mode.
                      Clicking it eases the camera into the detail
                      pose and triggers the dashboard overlay.  -->
                ${hasApiKey && layout !== null && !this._detailMode ? html`
                    <div
                        class="home-hitbox"
                        style="left:${layout!.home.x}px; top:${layout!.home.y}px"
                        @click="${this._onHomeClick}"
                        @mouseenter="${this._onHomeEnter}"
                        @mouseleave="${this._onHomeLeave}"
                    ></div>
                ` : nothing}

                <!--  Detail dashboard overlay, takes over the card
                      while _detailMode is on. The CSS class
                      .detail-active on ha-card fades out every
                      pre-existing overlay so the panel reads as
                      the sole content while open. The panel itself
                      no longer dismisses on a content click (that
                      would fire on every internal scroll / tap),
                      a dedicated close button in the corner handles
                      exit.  -->
                ${this._detailMode ? this._renderDashboard() : nothing}

            </ha-card>
        `;
    }

    //Darken a #rrggbb hex by a factor in [0, 1] (0 = unchanged,
    //1 = pure black). Multiplicative on each channel, keeps the
    //hue intact, just lowers the value. Used to derive the slightly
    //darker rim colour around the sun disc from the configured sun
    //colour, so the rim stays visible against the disc fill without
    //the user having to configure two colours.
    private _darkenHex(hex: string, factor: number): string
    {
        const f = 1 - Math.max(0, Math.min(1, factor));
        const r = Math.round(parseInt(hex.slice(1, 3), 16) * f);
        const g = Math.round(parseInt(hex.slice(3, 5), 16) * f);
        const b = Math.round(parseInt(hex.slice(5, 7), 16) * f);
        const h = (n: number) => n.toString(16).padStart(2, '0');
        return `#${h(r)}${h(g)}${h(b)}`;
    }

    //Linear blend between two #rrggbb hex colours. `t` = 0 returns
    //`a` unchanged, `t` = 1 returns `b`. Used by the cloud disc to
    //derive the light (low) and dark (high) band shades from the
    //configured cloud colour without needing a second / third
    //config key.
    private _lerpHexToward(a: string, b: string, t: number): string
    {
        const u = Math.max(0, Math.min(1, t));
        const ar = parseInt(a.slice(1, 3), 16);
        const ag = parseInt(a.slice(3, 5), 16);
        const ab = parseInt(a.slice(5, 7), 16);
        const br = parseInt(b.slice(1, 3), 16);
        const bg = parseInt(b.slice(3, 5), 16);
        const bb = parseInt(b.slice(5, 7), 16);
        const r = Math.round(ar + (br - ar) * u);
        const g = Math.round(ag + (bg - ag) * u);
        const bl = Math.round(ab + (bb - ab) * u);
        const h = (n: number) => n.toString(16).padStart(2, '0');
        return `#${h(r)}${h(g)}${h(bl)}`;
    }

    //Detail-mode toggles. Driven by the home click (off → on) and a
    //click anywhere on the detail panel (on → off). The engine
    //handles the eased camera transition; we just flip the state
    //and let the CSS .detail-active class fade out the overlays.
    private _onHomeClick(e: Event): void
    {
        //Stop propagation so the underlying map doesn't also process
        //the click as a pan / drag start, and so a nested layer
        //(e.g. the placeholder) doesn't double-handle it.
        e.stopPropagation();
        if (this._detailMode) { return; }
        //Clear the hover flag immediately, the hitbox un-renders
        //once detail mode opens so mouseleave never fires; without
        //this the glow would flash back on as soon as the user
        //exits detail mode and the hitbox re-appears.
        this._homeHover  = false;
        this._detailMode = true;
        this._engine?.setDetailMode(true);
    }

    //----------------------------------------------------------------- Dashboard

    //Renders the detail-mode panel: 4 stacked sections (today, week,
    //tomorrow, battery) plus a close button. Each section uses one
    //big SVG illustration that IS the data; numbers are annotations
    //around the illustration, not the centerpiece. Battery section is
    //skipped silently when neither battery entity is configured.
    //
    //The panel uses the configured colour palette (sun / cloud / pv /
    //battery) so the dashboard reads as the same product the user
    //already knows from the card itself.
    private _renderDashboard(): TemplateResult
    {
        const t            = pickTranslations(this.hass?.language);
        const sunColor     = cfgHex(this.config?.['sun-color'],     DEFAULT_SUN_COLOR_HEX);
        const cloudColor   = cfgHex(this.config?.['cloud-color'],   DEFAULT_CLOUD_COLOR_HEX);
        const pvColor      = cfgHex(this.config?.['pv-color'],      DEFAULT_PV_COLOR_HEX);
        const batteryColor = cfgHex(this.config?.['battery-color'], DEFAULT_BATTERY_COLOR_HEX);

        const hasBattery =
            String(this.config?.['battery-soc-entity']   ?? '').trim() !== ''
         || String(this.config?.['battery-power-entity'] ?? '').trim() !== '';

        return html`
            <div class="detail-panel">
                <button
                    class="detail-close-btn"
                    @click="${this._onExitDetail}"
                    aria-label="${t.detail.exitHint}"
                >
                    <ha-icon icon="mdi:close"></ha-icon>
                </button>
                <div class="detail-panel-inner">
                    ${this._renderDashTodaySection(t, pvColor, sunColor)}
                    ${this._renderDashTomorrowSection(t, sunColor, cloudColor)}
                    ${hasBattery ? this._renderDashBatterySection(t, batteryColor) : nothing}
                </div>
            </div>
        `;
    }

    //--------------------------------------- Section: Aujourd'hui (today)

    //Computes hourly production for today, splitting observed (past
    //+ now) from forecast (now → midnight). Returns one bin per hour
    //of the day [0..23], with watts at the hour's midpoint. Bins
    //missing observed data fall back to the forecast value where
    //available; truly empty bins (no kWp configured + before sensor
    //has started) get 0 W.
    private _computeTodayHourly(): {
        bins:        Array<{ hourTs: number; observedW: number | null; forecastW: number | null }>;
        peakHourTs:  number | null;
        peakW:       number;
        producedKwh: number;
        forecastKwh: number;   //today's projected total at end-of-day
    }
    {
        const HOUR_MS = 3_600_000;
        const today0  = new Date();
        today0.setHours(0, 0, 0, 0);
        const startMs = today0.getTime();
        const endMs   = startMs + 24 * HOUR_MS;
        const nowMs   = Date.now();

        const bins: Array<{
            hourTs: number;
            observedW: number | null;
            forecastW: number | null;
        }> = [];
        for (let h = 0; h < 24; h++)
        {
            bins.push({
                hourTs:    startMs + h * HOUR_MS,
                observedW: null,
                forecastW: null
            });
        }

        //Pass 1: observed. Aggregate _pvHistory into hourly buckets.
        //Same approach the chart uses (cumulative-energy sensors get
        //differentiated, power sensors are averaged).
        const hist = this._pvHistory;
        if (hist && hist.times.length > 0)
        {
            const unit = (this._pvUnit || '').toLowerCase();
            const isCumulativeEnergy = unit === 'wh' || unit === 'kwh' || unit === 'mwh';
            let times:  Date[]   = hist.times;
            let values: number[] = hist.values;
            if (isCumulativeEnergy && times.length >= 2)
            {
                const dT: Date[] = [];
                const dV: number[] = [];
                for (let i = 1; i < times.length; i++)
                {
                    const dtH = (times[i].getTime() - times[i - 1].getTime()) / 3_600_000;
                    if (dtH <= 0 || dtH > 6) continue;
                    const dv  = values[i] - values[i - 1];
                    if (dv < 0) continue;
                    dT.push(times[i]);
                    dV.push(dv / dtH);
                }
                times = dT;
                values = dV;
            }
            const sums   = new Map<number, number>();
            const counts = new Map<number, number>();
            for (let i = 0; i < times.length; i++)
            {
                const tMs = times[i].getTime();
                if (tMs < startMs || tMs >= endMs) continue;
                //After differentiation the values are average power in
                //kW (kWh/hour), so go straight to watts. The original
                //unit ('kWh' / 'MWh' / 'Wh') isn't handled by
                //_pvNormalizeToWatts and would silently return 0,
                //which would zero out producedKwh and over-count
                //forecastKwh by skipping the observed contribution.
                const w = isCumulativeEnergy
                    ? values[i] * 1000
                    : this._pvNormalizeToWatts(values[i], this._pvUnit);
                if (!isFinite(w)) continue;
                const hourTs = Math.floor(tMs / HOUR_MS) * HOUR_MS;
                sums  .set(hourTs, (sums  .get(hourTs) ?? 0) + w);
                counts.set(hourTs, (counts.get(hourTs) ?? 0) + 1);
            }
            for (let h = 0; h < 24; h++)
            {
                const sum = sums  .get(bins[h].hourTs);
                const cnt = counts.get(bins[h].hourTs);
                if (sum !== undefined && cnt && cnt > 0)
                {
                    bins[h].observedW = sum / cnt;
                }
            }
        }

        //Pass 2: forecast. Only when peak power is configured. Fill
        //in every hour bin (so we can show the full curve), but the
        //caller will combine observed + forecast for the area split.
        const k      = this._pvCalibK();
        const series = this._chartSeries;
        const coords = this._getHomeCoords();
        if (k !== null && k > 0 && series && coords)
        {
            for (let i = 0; i < series.times.length; i++)
            {
                const tMs = series.times[i].getTime();
                if (tMs < startMs || tMs >= endMs) continue;
                const cloud = series.cloud[i] ?? 0;
                const pct   = computePvPower(series.times[i], coords.lat, coords.lon, cloud, this._pvPanelOrientation());
                if (pct < 0) continue;
                const watts = pct * k;
                const hourTs = Math.floor(tMs / HOUR_MS) * HOUR_MS;
                const idx = (hourTs - startMs) / HOUR_MS;
                if (idx >= 0 && idx < 24)
                {
                    bins[idx].forecastW = watts;
                }
            }
        }

        //Aggregate: peak (across all bins, taking observed > forecast),
        //produced kWh (sum of observed × 1h), forecast end-of-day
        //(observed past + forecast future).
        let peakW = 0;
        let peakHourTs: number | null = null;
        let producedKwh = 0;
        let forecastKwh = 0;
        for (const b of bins)
        {
            const w = b.observedW ?? b.forecastW ?? 0;
            if (w > peakW) { peakW = w; peakHourTs = b.hourTs; }

            if (b.observedW !== null) producedKwh += b.observedW / 1000;

            if (b.hourTs + HOUR_MS <= nowMs)
            {
                //Past hour: count observed if available, else nothing
                //(no forecast for the past).
                if (b.observedW !== null) forecastKwh += b.observedW / 1000;
            }
            else if (b.hourTs > nowMs)
            {
                //Future hour: count forecast if available.
                if (b.forecastW !== null) forecastKwh += b.forecastW / 1000;
            }
            else
            {
                //Hour straddling "now": count observed if available,
                //fall back to forecast (so the running total covers
                //the whole hour).
                forecastKwh += (b.observedW ?? b.forecastW ?? 0) / 1000;
            }
        }

        return { bins, peakHourTs, peakW, producedKwh, forecastKwh };
    }

    //Time-ordered cumulative production samples for today's chart.
    //Past portion comes from the raw PV history (cumulative-energy
    //sensors: subtract the day's baseline; power sensors: trapezoidal
    //integration), future portion extends with the hourly forecast
    //model. Hour marks are interpolated at every full hour so the
    //chart can render a dot per hour without snapping the curve.
    private _computeTodayCumulative(): {
        samples:   Array<{ tMs: number; kwh: number }>;
        hourMarks: Array<{ tMs: number; kwh: number }>;
        pastEndMs: number;
        maxKwh:    number;
    }
    {
        const HOUR_MS = 3_600_000;
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const startMs = today0.getTime();
        const endMs   = startMs + 24 * HOUR_MS;
        const nowMs   = Date.now();

        const samples: Array<{ tMs: number; kwh: number }> = [];
        samples.push({ tMs: startMs, kwh: 0 });

        let cumKwh    = 0;
        let pastEndMs = startMs;

        //Past: integrate observed history. Cumulative-energy sensors
        //get a baseline-subtracted reading per sample; power sensors
        //get trapezoidal integration over consecutive pairs.
        const hist = this._pvHistory;
        if (hist && hist.times.length > 0)
        {
            const unit = (this._pvUnit || '').toLowerCase();
            const isCumulativeEnergy = unit === 'wh' || unit === 'kwh' || unit === 'mwh';
            const energyFactor = unit === 'wh' ? 1 / 1000
                               : unit === 'mwh' ? 1000
                               : 1;
            let baseline: number | null = null;
            let prevT:    number | null = null;
            let prevW:    number | null = null;

            for (let i = 0; i < hist.times.length; i++)
            {
                const tMs = hist.times[i].getTime();
                if (tMs < startMs || tMs >= endMs) continue;

                if (isCumulativeEnergy)
                {
                    const v = hist.values[i] * energyFactor;
                    if (baseline === null) baseline = v;
                    const kwh = Math.max(0, v - baseline);
                    samples.push({ tMs, kwh });
                    cumKwh = kwh;
                }
                else
                {
                    const w = this._pvNormalizeToWatts(hist.values[i], this._pvUnit);
                    if (!isFinite(w)) continue;
                    if (prevT !== null && prevW !== null)
                    {
                        const dh = (tMs - prevT) / HOUR_MS;
                        if (dh > 0 && dh <= 6)
                        {
                            cumKwh += ((prevW + w) / 2) / 1000 * dh;
                        }
                    }
                    samples.push({ tMs, kwh: cumKwh });
                    prevT = tMs;
                    prevW = w;
                }
                pastEndMs = tMs;
            }
        }

        //Anchor at "now" so the solid past line ends precisely at the
        //present moment, instead of stopping at the last sample which
        //could be a minute or two stale.
        if (pastEndMs < nowMs && nowMs < endMs)
        {
            samples.push({ tMs: nowMs, kwh: cumKwh });
            pastEndMs = nowMs;
        }

        //Future: cumulate hourly forecast. Each hour contributes its
        //full bin amount, except the bin straddling "now" which only
        //contributes its remaining fraction so the boundary stitches
        //cleanly with the past curve.
        const k      = this._pvCalibK();
        const series = this._chartSeries;
        const coords = this._getHomeCoords();
        if (k !== null && k > 0 && series && coords)
        {
            for (let i = 0; i < series.times.length; i++)
            {
                const tMs = series.times[i].getTime();
                if (tMs < startMs || tMs >= endMs) continue;
                const binStart = Math.floor(tMs / HOUR_MS) * HOUR_MS;
                const binEnd   = binStart + HOUR_MS;
                if (binEnd <= nowMs) continue;
                const cloud = series.cloud[i] ?? 0;
                const pct   = computePvPower(series.times[i], coords.lat, coords.lon, cloud, this._pvPanelOrientation());
                if (pct < 0) continue;
                const futureStart = Math.max(binStart, nowMs);
                const fraction    = Math.min(1, (binEnd - futureStart) / HOUR_MS);
                cumKwh += (pct * k) / 1000 * fraction;
                samples.push({ tMs: binEnd, kwh: cumKwh });
            }
        }

        //Linearly interpolate the cumulative kWh at every full hour
        //so each dot lands exactly on the curve. Done in one pass via
        //a binary search since `samples` is time-ordered.
        const lookup = (t: number): number =>
        {
            if (samples.length === 0)                          return 0;
            if (t <= samples[0].tMs)                           return samples[0].kwh;
            if (t >= samples[samples.length - 1].tMs)          return samples[samples.length - 1].kwh;
            let lo = 0, hi = samples.length - 1;
            while (lo < hi - 1)
            {
                const mid = (lo + hi) >> 1;
                if (samples[mid].tMs <= t) lo = mid; else hi = mid;
            }
            const a = samples[lo], b = samples[hi];
            if (b.tMs === a.tMs) return a.kwh;
            return a.kwh + ((t - a.tMs) / (b.tMs - a.tMs)) * (b.kwh - a.kwh);
        };

        const hourMarks: Array<{ tMs: number; kwh: number }> = [];
        for (let h = 0; h <= 24; h++)
        {
            const tMs = startMs + h * HOUR_MS;
            hourMarks.push({ tMs, kwh: lookup(tMs) });
        }

        let maxKwh = 0;
        for (const s of samples) if (s.kwh > maxKwh) maxKwh = s.kwh;

        return { samples, hourMarks, pastEndMs, maxKwh };
    }

    private _renderDashTodaySection(
        t:        ReturnType<typeof pickTranslations>,
        pvColor:  string,
        sunColor: string
    ): TemplateResult
    {
        const data    = this._computeTodayHourly();
        const HOUR_MS = 3_600_000;

        const peakTimeLabel = data.peakHourTs !== null
            ? new Date(data.peakHourTs + HOUR_MS / 2).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
            })
            : '';
        const peakValueLabel = this._formatPvWatts(data.peakW);

        //Align the forecast number with the one the timeline shows so
        //both views agree. The hourly-bin aggregation used by
        //_computeTodayHourly is fine for the peak chart but loses
        //sub-hour granularity; _computeDailyKwhTotals integrates raw
        //history + per-hour forecast the same way the timeline does,
        //so reading today's bucket from it guarantees a single number
        //across both surfaces.
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const todayMs   = today0.getTime();
        const dailyKwh  = this._computeDailyKwhTotals();
        const forecastKwh = dailyKwh.get(todayMs) ?? data.forecastKwh;

        const showForecast   = forecastKwh > data.producedKwh + 0.05;
        const showPeak       = data.peakHourTs !== null && data.peakW > 50;

        //Distinguish "no data yet" from "no production yet". When a PV
        //entity is configured and the history hasn't returned yet,
        //show a skeleton in place of the produced value, so users
        //don't read a transient 0,0 kWh as fact. Once the fetch lands
        //(empty or not), we fall back to rendering the number.
        const pvConfigured = String(this.config?.['pv-power-entity'] ?? '').trim() !== '';
        const historyLoading = pvConfigured && this._pvHistory === null;

        //"Not started yet" hint: produced is effectively zero but the
        //forecast knows a peak is still ahead. Avoids the confusing
        //"0,0 kWh / 12,1 kWh PRÉVU" reading by spelling out that the
        //counter is idle, not broken.
        const notStartedYet =
            !historyLoading
         && data.producedKwh < 0.05
         && data.peakHourTs !== null
         && data.peakHourTs > Date.now();

        return html`
            <section class="dash-section dash-card dash-today">
                <header class="dash-card-header">
                    <ha-icon class="dash-card-icon" icon="mdi:weather-sunny" style="color:${sunColor}"></ha-icon>
                    <span class="dash-card-label">${t.detail.todayLabel}</span>
                </header>
                <div class="dash-today-body">
                    <div class="dash-today-produced" style="color:${pvColor}">
                        ${historyLoading ? html`
                            <span class="dash-stat-skeleton" aria-hidden="true"></span>
                        ` : html`
                            <span class="dash-stat-value">${this._formatLocalisedNumber(data.producedKwh, 1)}</span>
                            <span class="dash-stat-unit">kWh</span>
                        `}
                    </div>
                    <div class="dash-today-side">
                        ${showForecast ? html`
                            <div class="dash-today-line dash-today-forecast">
                                <span class="dash-line-arrow">→</span>
                                <span class="dash-line-value">${this._formatLocalisedNumber(forecastKwh, 1)} kWh</span>
                                <span class="dash-line-label">${t.detail.todayForecast}</span>
                            </div>
                        ` : nothing}
                        ${showPeak ? html`
                            <div class="dash-today-line dash-today-peak">
                                <ha-icon icon="mdi:white-balance-sunny" style="color:${sunColor}"></ha-icon>
                                <span class="dash-line-value">${peakTimeLabel} · ${peakValueLabel}</span>
                                <span class="dash-line-label">${t.detail.todayPeak}</span>
                            </div>
                        ` : nothing}
                    </div>
                    ${historyLoading ? nothing : this._renderDashTodayChart(pvColor)}
                </div>
                ${notStartedYet ? html`
                    <div class="dash-today-status">${t.detail.todayNotStartedYet}</div>
                ` : nothing}
            </section>
        `;
    }

    //Cumulative production sparkline for the today card. Hidden via
    //a container query when the card isn't wide enough to render the
    //curve without squashing it (see helios-card-css.ts). When the
    //user hovers, a vertical guideline + travelling dot reveal a
    //tooltip showing the cumulative kWh at that exact minute.
    private _renderDashTodayChart(pvColor: string): TemplateResult | typeof nothing
    {
        const cum = this._computeTodayCumulative();
        if (cum.maxKwh < 0.05) return nothing;

        const HOUR_MS  = 3_600_000;
        const today0   = new Date();
        today0.setHours(0, 0, 0, 0);
        const startMs  = today0.getTime();
        const endMs    = startMs + 24 * HOUR_MS;

        const W = 240, H = 60;
        const PAD_X = 4, PAD_T = 4, PAD_B = 6;
        const yMax  = Math.max(cum.maxKwh, 0.1) * 1.05;

        const xFor = (t: number): number =>
            PAD_X + ((t - startMs) / (endMs - startMs)) * (W - 2 * PAD_X);
        const yFor = (kwh: number): number =>
            H - PAD_B - (kwh / yMax) * (H - PAD_T - PAD_B);

        const buildPath = (pts: Array<{ tMs: number; kwh: number }>): string =>
        {
            if (pts.length < 2) return '';
            return 'M ' + pts.map(p =>
                `${xFor(p.tMs).toFixed(2)} ${yFor(p.kwh).toFixed(2)}`
            ).join(' L ');
        };

        const pastSamples   = cum.samples.filter(s => s.tMs <= cum.pastEndMs);
        const futureSamples = cum.samples.filter(s => s.tMs >= cum.pastEndMs);
        const pastPath      = buildPath(pastSamples);
        const futurePath    = buildPath(futureSamples);

        //Hover lookup: interpolate cumulative kWh at the cursor's
        //time. Same binary search as _computeTodayCumulative so the
        //tooltip lines up exactly with the curve.
        const hoverTs = this._dashChartHoverTs;
        let hoverKwh:        number | null = null;
        let hoverX:          number        = 0;
        let hoverFracX:      number        = 0;
        let hoverTimeLabel:  string        = '';
        if (hoverTs !== null && hoverTs >= startMs && hoverTs < endMs)
        {
            const samples = cum.samples;
            if (samples.length > 0)
            {
                if (hoverTs <= samples[0].tMs)
                {
                    hoverKwh = samples[0].kwh;
                }
                else if (hoverTs >= samples[samples.length - 1].tMs)
                {
                    hoverKwh = samples[samples.length - 1].kwh;
                }
                else
                {
                    let lo = 0, hi = samples.length - 1;
                    while (lo < hi - 1)
                    {
                        const mid = (lo + hi) >> 1;
                        if (samples[mid].tMs <= hoverTs) lo = mid; else hi = mid;
                    }
                    const a = samples[lo], b = samples[hi];
                    hoverKwh = a.tMs === b.tMs
                        ? a.kwh
                        : a.kwh + ((hoverTs - a.tMs) / (b.tMs - a.tMs)) * (b.kwh - a.kwh);
                }
                hoverX         = xFor(hoverTs);
                hoverFracX     = (hoverX / W) * 100;
                hoverTimeLabel = new Date(hoverTs).toLocaleTimeString([], {
                    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
                });
            }
        }

        return html`
            <div class="dash-today-chart">
                <svg class="dash-today-chart-svg"
                     viewBox="0 0 ${W} ${H}"
                     preserveAspectRatio="none"
                     @pointermove="${this._onDashChartPointerMove}"
                     @pointerleave="${this._onDashChartPointerLeave}"
                >
                    ${pastPath !== '' ? svg`
                        <path class="dash-today-chart-past"
                              d="${pastPath}"
                              stroke="${pvColor}"/>
                    ` : nothing}
                    ${futurePath !== '' ? svg`
                        <path class="dash-today-chart-future"
                              d="${futurePath}"
                              stroke="${pvColor}"/>
                    ` : nothing}
                    ${cum.hourMarks.map(m => svg`
                        <circle class="dash-today-chart-dot"
                                cx="${xFor(m.tMs).toFixed(2)}"
                                cy="${yFor(m.kwh).toFixed(2)}"
                                r="1.4"
                                fill="${pvColor}"/>
                    `)}
                    ${hoverKwh !== null ? svg`
                        <line class="dash-today-chart-hover-line"
                              x1="${hoverX.toFixed(2)}" x2="${hoverX.toFixed(2)}"
                              y1="${PAD_T}" y2="${H - PAD_B}"/>
                        <circle class="dash-today-chart-hover-dot"
                                cx="${hoverX.toFixed(2)}"
                                cy="${yFor(hoverKwh).toFixed(2)}"
                                r="2.2"
                                fill="${pvColor}"/>
                    ` : nothing}
                </svg>
                ${hoverKwh !== null ? html`
                    <div class="dash-today-chart-tooltip"
                         style="left: ${hoverFracX.toFixed(2)}%;"
                    >
                        ${hoverTimeLabel} · ${this._formatLocalisedNumber(hoverKwh, 1)} kWh
                    </div>
                ` : nothing}
            </div>
        `;
    }

    private _onDashChartPointerMove = (e: PointerEvent): void =>
    {
        const svg = e.currentTarget as SVGSVGElement | null;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        if (rect.width <= 0) return;
        const W = 240, PAD_X = 4;
        const fracPx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const xLogical = fracPx * W;
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const startMs = today0.getTime();
        const endMs   = startMs + 24 * 3_600_000;
        const tFrac = (xLogical - PAD_X) / (W - 2 * PAD_X);
        this._dashChartHoverTs = startMs
            + Math.max(0, Math.min(1, tFrac)) * (endMs - startMs);
    };

    private _onDashChartPointerLeave = (): void =>
    {
        this._dashChartHoverTs = null;
    };

    //Helper: format a wattage value as a short label (W or kW).
    private _formatPvWatts(w: number): string
    {
        if (!isFinite(w) || w < 0) return '0 W';
        if (w >= 1000) return this._formatLocalisedNumber(w / 1000, 2) + ' kW';
        return Math.round(w) + ' W';
    }

    //--------------------------------------- Section: Demain (tomorrow)

    private _computeTomorrow(): {
        totalKwh:   number;
        peakHourTs: number | null;
        peakW:      number;
        avgCloud:   number;       //0..100, weighted by daylight hours
    }
    {
        const HOUR_MS = 3_600_000;
        const today0  = new Date();
        today0.setHours(0, 0, 0, 0);
        const tomorrowMs = today0.getTime() + 24 * HOUR_MS;
        const endMs      = tomorrowMs + 24 * HOUR_MS;

        const series = this._chartSeries;
        const coords = this._getHomeCoords();
        const k      = this._pvCalibK();

        let totalKwh = 0;
        let peakHourTs: number | null = null;
        let peakW = 0;
        let cloudSum = 0;
        let cloudWeight = 0;

        if (series && coords)
        {
            for (let i = 0; i < series.times.length; i++)
            {
                const tMs = series.times[i].getTime();
                if (tMs < tomorrowMs || tMs >= endMs) continue;
                const cloud = series.cloud[i] ?? 0;
                const pct   = computePvPower(series.times[i], coords.lat, coords.lon, cloud, this._pvPanelOrientation());
                if (pct > 0 && k !== null)
                {
                    const watts = pct * k;
                    totalKwh += watts / 1000;
                    if (watts > peakW)
                    {
                        peakW = watts;
                        peakHourTs = Math.floor(tMs / HOUR_MS) * HOUR_MS;
                    }
                    cloudSum    += cloud * pct;
                    cloudWeight += pct;
                }
            }
        }

        const avgCloud = cloudWeight > 0 ? cloudSum / cloudWeight : 0;

        return { totalKwh, peakHourTs, peakW, avgCloud };
    }

    private _renderDashTomorrowSection(
        t:          ReturnType<typeof pickTranslations>,
        sunColor:   string,
        _cloudColor: string
    ): TemplateResult
    {
        const data = this._computeTomorrow();
        const HOUR_MS = 3_600_000;

        const peakTimeLabel = data.peakHourTs !== null
            ? new Date(data.peakHourTs + HOUR_MS / 2).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
            })
            : '';

        return html`
            <section class="dash-section dash-card dash-tomorrow">
                <header class="dash-card-header">
                    <ha-icon class="dash-card-icon" icon="mdi:weather-partly-cloudy" style="color:${sunColor}"></ha-icon>
                    <span class="dash-card-label">${t.detail.tomorrowLabel}</span>
                    <span class="dash-card-trailing dash-card-trailing-forecast">
                        <span class="dash-stat-value-sm">≈ ${this._formatLocalisedNumber(data.totalKwh, 1)}</span>
                        <span class="dash-stat-unit-sm">kWh</span>
                    </span>
                </header>
                ${data.peakHourTs !== null ? html`
                    <div class="dash-tomorrow-peak">
                        <ha-icon icon="mdi:white-balance-sunny" style="color:${sunColor}"></ha-icon>
                        <span class="dash-line-label">${t.detail.tomorrowPeak}</span>
                        <span class="dash-line-value">${peakTimeLabel}</span>
                    </div>
                ` : nothing}
            </section>
        `;
    }

    //--------------------------------------- Section: Batterie (battery)

    private _computeBatteryToday(): {
        socNow:        number | null;
        chargedKwh:    number;
        dischargedKwh: number;
    }
    {
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const startMs = today0.getTime();
        const endMs   = Date.now();

        let chargedKwh    = 0;
        let dischargedKwh = 0;

        const hist = this._batteryPowerHistory;
        if (hist && hist.times.length >= 2)
        {
            for (let i = 1; i < hist.times.length; i++)
            {
                const tMs = hist.times[i].getTime();
                if (tMs < startMs || tMs > endMs) continue;
                const dtH = (tMs - hist.times[i - 1].getTime()) / 3_600_000;
                if (dtH <= 0 || dtH > 6) continue;
                const wAvg = (this._pvNormalizeToWatts(hist.values[i - 1], this._batteryPowerUnit)
                            + this._pvNormalizeToWatts(hist.values[i],     this._batteryPowerUnit)) / 2;
                const kwh = (wAvg * dtH) / 1000;
                if (kwh > 0)      chargedKwh    += kwh;
                else              dischargedKwh += -kwh;
            }
        }

        return {
            socNow: this._batterySoc,
            chargedKwh,
            dischargedKwh
        };
    }

    private _renderDashBatterySection(
        t:            ReturnType<typeof pickTranslations>,
        batteryColor: string
    ): TemplateResult
    {
        const data = this._computeBatteryToday();
        const soc  = data.socNow ?? 0;

        //Vessel canvas: 200 × 240, drawn as a stylised vertical
        //Compact vessel for the chip-card layout. The battery cap +
        //cell are drawn relative to the SVG viewBox and scale with
        //the card width via CSS.
        const W = 60;
        const H = 100;
        const capW = 18, capH = 6;
        const cellX = 8, cellY = 12;
        const cellW = W - 2 * cellX, cellH = H - cellY - 6;
        const liquidH = (Math.max(0, Math.min(100, soc)) / 100) * (cellH - 4);
        const liquidY = cellY + cellH - 2 - liquidH;
        const liquidX = cellX + 2;
        const liquidW = cellW - 4;

        return html`
            <section class="dash-section dash-card dash-battery">
                <header class="dash-card-header">
                    <ha-icon class="dash-card-icon" icon="mdi:battery" style="color:${batteryColor}"></ha-icon>
                    <span class="dash-card-label">${t.detail.batteryLabel}</span>
                    <span class="dash-card-trailing">
                        <span class="dash-stat-value-sm">${Math.round(soc)}</span>
                        <span class="dash-stat-unit-sm">%</span>
                    </span>
                </header>
                <div class="dash-battery-body">
                    <svg class="dash-battery-vessel" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
                        <defs>
                            <linearGradient id="dash-batt-grad-${this._instanceId}" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stop-color="${batteryColor}" stop-opacity="0.95"/>
                                <stop offset="100%" stop-color="${batteryColor}" stop-opacity="0.6"/>
                            </linearGradient>
                        </defs>
                        ${(() => {
                            //Battery cap drawn as an open path: top + two
                            //sides, no bottom edge. The shell rect just
                            //below provides the shared horizontal line,
                            //so we avoid the two strokes stacking and
                            //showing as a double thickness at the join.
                            const capLx = (W - capW) / 2;
                            const capRx = (W + capW) / 2;
                            const capTy = cellY - capH;
                            const capBy = cellY;
                            const r = 1.5;
                            const capPath = [
                                `M ${capLx} ${capBy}`,
                                `L ${capLx} ${capTy + r}`,
                                `Q ${capLx} ${capTy} ${capLx + r} ${capTy}`,
                                `L ${capRx - r} ${capTy}`,
                                `Q ${capRx} ${capTy} ${capRx} ${capTy + r}`,
                                `L ${capRx} ${capBy}`
                            ].join(' ');
                            return svg`<path class="dash-batt-cap" d="${capPath}"/>`;
                        })()}
                        <rect class="dash-batt-shell"
                              x="${cellX}" y="${cellY}"
                              width="${cellW}" height="${cellH}" rx="3"/>
                        ${liquidH > 0 ? svg`
                            <rect class="dash-batt-liquid"
                                  x="${liquidX}" y="${liquidY}"
                                  width="${liquidW}" height="${liquidH}"
                                  rx="2"
                                  fill="url(#dash-batt-grad-${this._instanceId})"/>
                        ` : nothing}
                    </svg>
                    <div class="dash-battery-flows">
                        <div class="dash-battery-flow dash-battery-flow-charge">
                            <ha-icon icon="mdi:arrow-up-bold"></ha-icon>
                            <span class="dash-flow-value">${this._formatLocalisedNumber(data.chargedKwh, 1)} kWh</span>
                            <span class="dash-flow-label">${t.detail.batteryCharged}</span>
                        </div>
                        <div class="dash-battery-flow dash-battery-flow-discharge">
                            <ha-icon icon="mdi:arrow-down-bold"></ha-icon>
                            <span class="dash-flow-value">${this._formatLocalisedNumber(data.dischargedKwh, 1)} kWh</span>
                            <span class="dash-flow-label">${t.detail.batteryDischarged}</span>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    //Per-card unique id used to namespace SVG <defs> ids so multiple
    //Helios cards on the same dashboard don't clash on gradient /
    //filter references.
    private _instanceId = `h${Math.floor(Math.random() * 1e9).toString(36)}`;

    private _onExitDetail(e: Event): void
    {
        e.stopPropagation();
        if (!this._detailMode) { return; }
        this._detailMode = false;
        this._engine?.setDetailMode(false);
    }

    //Hover handlers on the home hitbox. Toggle the sun-coloured
    //glow halo around the home silhouette so the focal building
    //reads as interactive before the user clicks. Cleared on exit
    //so the glow doesn't get stuck on if the cursor leaves while
    //the detail overlay is fading in.
    private _onHomeEnter = (): void =>
    {
        this._homeHover = true;
    };
    private _onHomeLeave = (): void =>
    {
        this._homeHover = false;
    };

    //Placeholder (no API key configured)

    private _renderPlaceholder(): TemplateResult
    {
        //Minimal catalogue thumbnail: only the stylised iso scene
        //(low-poly buildings + ground cloud disc) and the solar arc
        //+ sun overhead, no chips, no leaders, no subtitle. The
        //"HELIOS" wordmark sits centred on top via .ph-content. The
        //sun is positioned at t = 0.75 along the arc Bezier
        //(M 50,230 Q 215,60 360,230 → (286, 166)) so it visually
        //rides ON the curve rather than floating above it. The
        //placeholder is now only rendered while HA has not yet
        //published home coordinates, or inside HA's dashboard
        //editor preview where the engine is intentionally not
        //instantiated.
        return html`
            <div class="placeholder">

                <svg
                    class="ph-scene"
                    viewBox="0 0 400 320"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <radialGradient id="ph-cloud-disc-grad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%"   stop-color="rgba(90,141,196,0.55)" />
                            <stop offset="80%"  stop-color="rgba(90,141,196,0.20)" />
                            <stop offset="100%" stop-color="rgba(90,141,196,0)"    />
                        </radialGradient>
                        <radialGradient id="ph-sun-glow-grad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%"   stop-color="rgba(239,159,39,0.85)" />
                            <stop offset="50%"  stop-color="rgba(239,159,39,0.30)" />
                            <stop offset="100%" stop-color="rgba(239,159,39,0)"    />
                        </radialGradient>
                    </defs>

                    <!-- Cloud disc on the ground; rendered first so
                         buildings emerge through it as islands. -->
                    <ellipse cx="215" cy="215" rx="110" ry="30"
                        fill="url(#ph-cloud-disc-grad)" />
                    <ellipse cx="215" cy="215" rx="110" ry="30"
                        fill="none"
                        stroke="rgba(90,141,196,0.50)"
                        stroke-width="0.6" />

                    <!-- Far-back-left neighbour. -->
                    <g>
                        <polygon points="110,168 132,180 110,192 88,180"  fill="#dadade" />
                        <polygon points="132,180 110,192 110,212 132,200" fill="#cbcbcf" />
                        <polygon points="88,180 110,192 110,212 88,200"   fill="#bcbcc1" />
                    </g>

                    <!-- Far-back-right neighbour, slightly taller. -->
                    <g>
                        <polygon points="300,162 324,176 300,190 276,176" fill="#dadade" />
                        <polygon points="324,176 300,190 300,212 324,198" fill="#cbcbcf" />
                        <polygon points="276,176 300,190 300,212 276,198" fill="#bcbcc1" />
                    </g>

                    <!-- Home: bigger and brighter than its neighbours,
                         centred on the cloud disc. -->
                    <g>
                        <polygon points="215,178 253,198 215,218 177,198" fill="#ebebef" />
                        <polygon points="253,198 215,218 215,260 253,240" fill="#dededf" />
                        <polygon points="177,198 215,218 215,260 177,240" fill="#ccccd0" />
                    </g>

                    <!-- Solar arc, drawn over the buildings so it
                         visually inhabits the sky. -->
                    <path
                        d="M 50 230 Q 215 60 360 230"
                        fill="none"
                        stroke="#EF9F27"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-opacity="0.85" />

                    <!-- Sun disc + halo, riding on the arc at t=0.75
                         (3/4 of the way from the left) so it sits ON
                         the path. The glow circle pulses; the inner
                         disc stays still so the brand colour reads
                         clearly. -->
                    <g transform="translate(286, 166)">
                        <circle class="ph-sun-glow" r="22" fill="url(#ph-sun-glow-grad)" />
                        <circle r="9" fill="#EF9F27" />
                        <circle r="8.5" fill="none"
                            stroke="#a36617" stroke-width="0.7" stroke-opacity="0.55" />
                    </g>
                </svg>

                <div class="ph-content">
                    <div class="ph-title">HELIOS</div>
                </div>

            </div>
        `;
    }

    static styles = heliosCardStyles;
}
