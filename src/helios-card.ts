import { LitElement, html, svg, PropertyValues, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HeliosEngine } from './helios-engine';
import
{
    type HeliosConfig,
    DEFAULT_SUN_COLOR_HEX,
    DEFAULT_PV_COLOR_HEX,
    DEFAULT_LIDAR_VIEW_OPACITY
} from './helios-config';
import { pickTranslations } from './i18n';
import { heliosCardStyles } from './css/helios-card-css';
import { formatDate, darkenHex } from './card/format';
import
{
    refreshPv,
    currentPvRate,
    pvRateAtTime,
    pvNormalizeToWatts,
    pvCalibK,
    pvInverterMaxW,
    computePvPowerWeighted,
    wipeLegacyPvCalibStorage,
    formatPvValue
} from './card/pv';
import
{
    refreshBattery,
    batterySampleAtTime,
    formatBatteryPower,
    effectiveBatteryBanks,
    type BatteryBank
} from './card/battery';
import { refreshSolarRadiation } from './card/radiation';
import { computeForecastCalibration } from './card/calibration';
import
{
    renderChart,
    renderPvChart,
    renderTimelineTicks,
    renderTimelineDayLabels,
    renderTimelineNightZones,
    renderTimelineFutureMask,
    renderTimelineHoverTooltip,
    handleChartHoverMove,
    handleChartHoverLeave
} from './card/charts';
import
{
    renderDashboard,
    handleHomeClick
} from './card/dashboard';
import
{
    buildArcSegments,
    flowDuration,
    type ArcSegment,
    type SunScene,
    type CloudScene,
    type LabelLayout,
    type HomeSilhouette
} from './card/overlays';
import
{
    tick,
    onTimelinePointerDown,
    onTimelinePointerMove,
    onTimelinePointerUp,
    resetToLive,
    timelineEnabled,
    timelineWidthPct
} from './card/timeline';
import { toggleLidarView, renderLidarViewOpacityPicker } from './card/lidar-view';
import { refreshGrid, formatGridValue, gridWattsAtTime, isGridCombined, gridCombinedWattsAtTime } from './card/grid';
import {
    subscribeEnergyPrefs,
    unsubscribeEnergyPrefs,
    EMPTY_ENERGY_DEFAULTS,
    type EnergyDefaults,
} from './card/energy-prefs';
import {
    renderShadingDomeOverlay,
    renderShadingDomeCloudPicker,
    toggleShadingDome,
    refreshShadingDomeScene,
} from './card/shadingDome';
import {
    cloudCoverIcon,
    cloudLayerIcon,
} from './card/cloudDome';
import
{
    computeConfigSig,
    getHomeCoords,
    initEngine,
    cancelPendingRespawn,
    initVisibilityObserver
} from './card/init';
//Side-effect import: registers <helios-color-picker> and <helios-card-editor> as custom elements.
import './card/editor';


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

//Card name and description in the HA card picker, shown before any hass instance is available, so we read the language from navigator.
const _bootI18n = pickTranslations(typeof navigator !== 'undefined' ? navigator.language : 'en');

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'helios-card'))
{
    window.customCards.push(
    {
        type:        'helios-card',
        name:        _bootI18n.cardName,
        description: _bootI18n.cardDescription,
        //preview:false: tells HA NOT to mount a live helios-card
        //instance in the "Add card" picker thumbnail. Each live
        //preview was spawning a full MapLibre engine + WebGL context
        //of its own; combined with HA's hui-card-edit-mode re-parent
        //cycle, the picker was the entry-point for the infinite
        //load/unload loop reported in the editor mode of the
        //dashboard. Trading the thumbnail for a static name + icon
        //(HA falls back to that automatically) stops the cascade
        //at the source.
        preview:     false
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



//Window-level reset bus: the editor's "reset data cache" button
//fires this event so every live card on the page (potentially
//several dashboards open in the same tab) drops its cached data
//in one sweep. Wired once at module load so we don't add/remove
//the listener per card.
window.addEventListener('helios-data-cache-reset', () =>
{
    for (const card of _liveCards) card.resetDataCache();
});

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
    //Sun-disc radii in px. The inner irradiance fill needs ~9 px of diameter at apex to read as an annulus rather than a dot.
    private static readonly SUN_R_FAR    = 10.0;
    private static readonly SUN_R_NEAR   = 20.0;
    private static readonly SUN_RIM_WIDTH = 1.5;
    //Outer radius of the central "home pill" icon, the circular
    //node painted at layout.home. The pill itself is 28 px wide
    //with a 2 px border (=> outermost radius 16 px); a 18 px
    //leader nudge leaves the hairline just OUTSIDE the pill so the
    //leader visibly docks against the disc edge instead of slicing
    //through it.
    private static readonly HOME_PILL_RADIUS_PX = 18;
    //Faint tint inside the rim so the "empty sun" at sunrise/sunset still reads as a disc, not a coloured spot.
    private static readonly SUN_FILL_OPACITY_BG = 0.20;

    //Below-horizon segments are dots whose diameter IS the stroke width. Scaled down vs daytime so the night portion of the loop reads as a quieter
    //trace, it indicates where the sun goes without competing with the lit half.
    private static readonly NIGHT_STROKE_FACTOR = 0.5;

    @property({ attribute: false }) public hass!: any;
    @property({ attribute: false }) config!: HeliosConfig;

    @state() _engine?:        HeliosEngine;
    @state() _now             = new Date();
    //Cloud-cover values shown in the on-ground disc hover popup.
    @state() _cloudCover      = -1;
    //Screen-space layout of the always-visible labels and leader lines,
    //recomputed via engine.projectHomeLabelLayout() on every map
    //transform. null while the map is still loading.
    @state() _labelLayout: LabelLayout | null = null;
    //Photovoltaic production state, populated when `pv-power-entity` is configured. Live value from hass.states + historical series from HA's history
    //API for the dedicated chart.
    @state() _pvCurrent: number | null = null;
    @state() _pvUnit:    string        = '';
    @state() _pvHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    _pvFetchKey  = '';
    _pvFetching  = false;
    //Most recent PV history fetch outcome, surfaced via
    //`window.heliosStats()` (raw entries returned, samples kept after
    //unit / unavailable filtering, window covered in hours).
    _pvHistoryDiagnostics: { rawEntries: number; samples: number; windowH: number } | null = null;
    //Per-bank companion battery SoC histories fetched alongside PV history when the user has at least one battery configured AND armed
    //the inverter-cutoff guard (`inverter-cutoff-soc-pct`). One entry per bank, parallel to parseBatteryBanks(config). Empty when the
    //guard is off or no battery is configured; the shading trainer reads it to skip buckets where ALL banks were at or above the cutoff
    //(min across banks). Not reactive: the trainer pulls it directly and we never need to re-render on a SoC sample change.
    _batteryHistories: { times: Date[]; values: number[] }[] = [];
    //Idempotency flag for the one-time wipe of legacy PV calibration
    //buffers (see _wipeLegacyPvCalibStorage). Per-instance so we
    //attempt the cleanup at most once per card mount; the persisted
    //flag in localStorage protects across reloads.
    private _pvCalibWiped = false;
    //Rolling buffer of state samples. For cumulative-energy sensors this gives a "last minute" instantaneous rate, fresher than the historical fetch
    //which only refreshes per timeline range.
    _pvSampleBuffer: Array<{ t: number; v: number }> = [];
    //Home-battery state, populated when at least one of
    //`battery-soc-entity` / `battery-power-entity` is configured.
    //Live readings; historical series lives in the *History fields
    //below. Units are kept alongside the values so the chip can
    //format kW vs W without re-reading the state.
    @state() _batterySoc:        number | null = null;
    @state() _batteryPower:      number | null = null;
    @state() _batteryPowerUnit:  string        = '';
    //Grid import / export live values, populated by refreshGrid()
    //from the configured grid-import-entity / grid-export-entity.
    //Unit is captured alongside the value so the chip formats the
    //correct W / kWh / m³ suffix without re-reading hass.states.
    @state() _gridImportValue:   number | null = null;
    @state() _gridImportUnit:    string        = '';
    @state() _gridExportValue:   number | null = null;
    @state() _gridExportUnit:    string        = '';
    //Rolling buffers used by refreshGrid when the wired entity is a
    //cumulative energy sensor (Wh / kWh): we derive a live W value
    //from the slope over the last ~5 min instead of surfacing the
    //meter's running total to the chip.
    //Per-entity rolling buffers keyed by entity_id. Multi-entity
    //grid wires (heures pleines / creuses, peak / off-peak) keep one
    //buffer per source.
    _gridImportSamples: Map<string, Array<{ t: number; v: number }>> = new Map();
    _gridExportSamples: Map<string, Array<{ t: number; v: number }>> = new Map();
    //Last derived watts per entity, tagged with the wall-clock at
    //which the underlying state changed. The chip displays the watts
    //of whichever entity moved most recently, so HP / HC indexes
    //don't fight each other when only one is currently incrementing.
    _gridImportLastDerived: Map<string, { watts: number; t: number }> = new Map();
    _gridExportLastDerived: Map<string, { watts: number; t: number }> = new Map();
    //Unit per grid entity (kwh / wh / mwh / w / kw) so the
    //past-scrub derivation can convert raw buffer values to watts
    //independently of the slot's overall normalised unit.
    _gridImportUnits: Map<string, string> = new Map();
    _gridExportUnits: Map<string, string> = new Map();
    //Combined signed grid-power slot (grid-power-entity). When wired,
    //refreshGrid derives the net signed watts from these buffers and
    //routes the sign to the import / export chips; the directional
    //slots above stay empty.
    _gridCombinedSamples: Map<string, Array<{ t: number; v: number }>> = new Map();
    _gridCombinedUnits:   Map<string, string> = new Map();
    //Historical series for the active timeline range. Both battery entities are fetched in a single `history/history_during_period` WebSocket call
    //when both are set.
    @state() _batterySocHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    @state() _batteryPowerHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    _batteryFetchKey  = '';
    _batteryFetching  = false;
    //Solar-radiation entity history, populated when
    //`solar-radiation-entity` is configured. We pull the recorder's
    //samples over the active timeline range and merge them with the
    //live state, then push the merged set down to the engine via
    //setSolarRadiationSamples. Held as a plain field (no @state)
    //because nothing in the card render reads it directly; the
    //engine owns the lookup logic.
    _solarRadiationHistory: { times: Date[]; values: number[] } | null = null;
    _solarRadiationFetchKey = '';
    _solarRadiationFetching = false;
    //Screen-space layout of the solar arc, sun, and incidence ray.
    //Recomputed via engine.projectSunScene() on every map transform
    //and every clock tick (sun position moves with time, refreshed
    //at 1 Hz in live mode).
    @state() _sunScene: SunScene | null = null;
    //Screen-space layout of the cloud-cover disc + 100 % reference
    //ring, projected through engine.projectCloudScene() on every map
    //transform and clock tick. Rendered as a pair of SVG polygons
    //drawn alongside the sun arc, anchored at the home's terrain
    //elevation so the disc stays a true circle whatever the ground
    //does beneath it (a MapLibre fill layer would warp with the
    //terrain mesh under high-precision LiDAR shadows).
    @state() _cloudScene: CloudScene | null = null;
    //Per-polygon silhouettes of the home building(s) in screen
    //space: each entry has the projected base ring and the
    //projected top ring of one home polygon. The card paints
    //both rings plus a quad per outer-ring edge into the cloud-
    //disc SVG mask, the union covers the exact extruded prism
    //even for concave footprints. Re-projected on every map
    //transform so rotation tracks.
    @state() _homeSilhouettes: HomeSilhouette[] = [];

    //Energy dashboard preferences snapshot. Subscribed at
    //connectedCallback and updated on every HA event
    //`energy_preferences_updated`. Every chip refresh helper reads
    //the fallback entity from here when the user-configured slot
    //in the card YAML / editor is empty.
    @state() _energyDefaults: EnergyDefaults = EMPTY_ENERGY_DEFAULTS;
    _energyPrefsUnsub?: () => void;
    //Projected screen-space positions of each configured PV array
    //marker. Refreshed on every map transform via projectPvArray
    //Markers(); the SVG overlay renders one lollipop per entry.
    //Hover state on the home hitbox. Drives a sun-coloured glow halo around the home silhouette so the user reads the focal building as interactive
    //before clicking.
    @state() _homeHover = false;
    //Hover state for the today-cumulative chart in the dashboard. ms
    //epoch of the cursor position on the X axis; null when the pointer
    //is outside the chart or the chart isn't shown.
    @state() _dashChartHoverTs: number | null = null;
    //Hover position on the timeline chart cards, expressed as a
    //percent of the visible time range. Null when the pointer is
    //outside the cards; drives the hover guide line, the per-curve
    //dots and the tooltip chip rendered above the cards.
    @state() _chartHoverPct: number | null = null;
    @state() _chartSeries: {
        times:        Date[];
        irradiance:   number[];
        cloud:        number[];
        //Hourly ambient temperature in °C + wind speed in m/s, NaN-padded where the model didn't return a value. Both arrays mirror the `times`
        //length and feed the PV prediction's thermal-derating term.
        temperature:  number[];
        windSpeed:    number[];
    } | null = null;
    @state() _fetching        = false;
    @state() _timeRange:    { start: Date; end: Date } | null = null;
    @state() _selectedTime: Date | null = null;
    @state() _isLiveMode    = true;
    //True while the engine is fetching the LiDAR shadow payload from the upstream provider and rasterising it for the image source. Drives the
    //spinner chip pinned top-right of the map so the user knows the shadow layer they're about to see is still computing.
    @state() _shadowBusy    = false;
    //True while the per-cell irradiance exposure sweep is in flight
    //(idle handle scheduled or chunked rAF mid-pass). Drives the
    //mode-bar LiDAR icon swap (icon -> spinner) and the mode-switch
    //lock so the user cannot change modes mid-compute.
    @state() _lidarExposureBusy = false;
    //True while the home is "focused": the existing overlay HUD is
    //hidden, the camera is eased to a closer / more pitched pose,
    //and a detail dashboard panel takes over. Toggled by clicking
    //the home hitbox (off → on) or clicking anywhere on the panel
    //(on → off). Engine.setDetailMode drives the camera lerp;
    //CSS class .detail-active on ha-card fades out every overlay.
    @state() _detailMode    = false;
    //Count-up animation state for the dashboard headline kWh figures.
    //Timestamp the panel last opened at; the dashboard helpers tick
    //requestUpdate() until the phase saturates so the figures animate
    //from 0 to their real value over 700 ms each time the user enters
    //detail mode. Reset to null on exit so a re-open replays the
    //animation. _dashCountUpRaf holds the rAF token of the in-flight
    //tick loop, also set by the dashboard helpers.
    _dashOpenedAtMs: number | null = null;
    _dashCountUpRaf?: number;
    //True while the LiDAR View overlay is showing: the map UI fades
    //out, the engine's WebGL custom layer paints every loaded LiDAR
    //cell as a dot, and the same toggle button (top-right) brings the
    //regular UI back when clicked again. Independent of detail mode;
    //both can't be on at once (the button is hidden in detail).
    @state() _lidarViewMode = false;
    //Fade timestamps. On enter the dot cloud eases in from alpha 0 to
    //1 over LIDAR_FADE_IN_MS; on exit it eases back out before the
    //regular HUD fade-in. Null when no fade is in flight; the layer
    //alpha then stays at its resting value (1 while active, 0 while
    //inactive).
    _lidarFadeInStartMs:  number | null = null;
    _lidarFadeOutStartMs: number | null = null;
    _lidarFadeRaf?:       number;
    //Overall LiDAR View opacity, driven by the bottom slider painted
    //while the view is active. Plain field (NOT @state) on purpose:
    //the slider drag fires ~50 input events / s and a @state coupling
    //would cascade the full 1000+ line render() on each one (parse-
    //BatteryBanks, projection math, leader paths, etc.) for zero
    //visual benefit because the slider's own .value already tracks
    //the drag and the engine push goes straight to the WebGL layer.
    //Defaults to DEFAULT_LIDAR_VIEW_OPACITY each card lifetime so
    //the user always lands on a sensible-looking opacity.
    _lidarViewOpacity = DEFAULT_LIDAR_VIEW_OPACITY;

    //Shading-dome overlay state. Mutually exclusive with the LiDAR
    //view (the click handlers below close one before opening the
    //other). _shadingDomeCloudBin persists the user's bin pick
    //inside the card lifetime so a toggle off/on keeps the slice.
    @state() _shadingDomeMode = false;
    //Mirrors _shadingDomeMode at toggle-on time but flips OFF the
    //instant the user clicks to exit dome mode. Decouples the CSS
    //chip / timeline hide rule from the dome SVG render gating so
    //the HUD transitions fire from the same paint as the click.
    @state() _shadingDomeChipMask = false;
    _shadingDomeFadeInStartMs:  number | null = null;
    _shadingDomeFadeOutStartMs: number | null = null;
    _shadingDomeFadeRaf?:       number;
    //Cloud cover percentage selected by the continuous slider in
    //the bottom-left of the dome view. 0 = clear sky, 100 = full
    //overcast. The engine's lookup is bin-based; the bin is
    //derived from this pct so the user reads the slider as a
    //continuous knob even though the underlying data is binned.
    _shadingDomeCloudPct = 0;
    _shadingDomeScene: import('./card/shadingDome').ShadingDomeScene | null = null;

    //Cloud-cover dome overlay state. Mutually exclusive with the
    //LiDAR view and the shading dome (click handlers below close
    //any other active mode before opening this one).
    @state() _cloudDomeMode = false;
    _cloudDomeFadeInStartMs:  number | null = null;
    _cloudDomeFadeOutStartMs: number | null = null;
    _cloudDomeFadeRaf?:       number;
    _cloudDomeScene: unknown = null;

    private _timer?:           number;
    _lastHomeKey       = '';
    _lastConfigSig     = '';
    _initInflight      = false;
    //Timestamp of the last engine spawn. onContextLost uses this to bail out when context losses arrive faster than ~2 s apart, which only happens
    //when the browser is thrashing the WebGL pool, respawning at that cadence just feeds the fire.
    _lastEngineSpawnAt = 0;

    //Cached theme polarity. The fallback path (getComputedStyle +
    //regex parse) forces a style flush, prohibitive to run on every
    //render. The result only changes when hass.themes flips polarity
    //or when the page styles are reloaded, so we cache it on the
    //themesObj identity and recompute lazily.
    private _cachedIsDarkThemesRef: unknown = undefined;
    private _cachedIsDark = false;

    //Refresh-chain gate. updated() re-runs the PV/Battery/Grid/
    //Radiation refreshers only when hass, config or the timeline
    //range change identity. Lit re-renders for every overlay @state
    //mutation otherwise would re-run the chain on every map move
    //during auto-rotate, which churned hundreds of allocations per
    //frame for zero new data.
    private _lastRefreshHassRef:           unknown = undefined;
    private _lastRefreshConfigRef:         unknown = undefined;
    private _lastRefreshTimeRangeRef:      unknown = undefined;
    private _lastRefreshEnergyDefaultsRef: unknown = undefined;

    //Clock-label memoisation. The date+time strings in the top-left
    //change at most once per minute, but render() ran formatDate +
    //toLocaleTimeString on every cycle (every overlay @state move
    //during auto-rotate). Cached on epoch-minute + format flags.
    private _cachedClockLabelKey:  string = '';
    private _cachedClockDateLabel: string = '';
    private _cachedClockTimeLabel: string = '';

    //Arc-segment scratch buffers. The sun arc is split by altitude
    //(below-horizon goes BEHIND the chip cluster, above-horizon goes
    //in FRONT) on every render. Naive filter() pair allocated two
    //fresh arrays per cycle; the buffers below are reused in place,
    //length reset to zero on each render before being repopulated.
    private _arcBackBuf:      ArcSegment[] = [];
    private _arcFrontBuf:     ArcSegment[] = [];
    private _arcFrontNearBuf: ArcSegment[] = [];

    //Cached SVG point strings for the home silhouettes. The home
    //silhouette is a stable feature of the (lon, lat, building shape)
    //triple but the cards used to re-serialize every vertex to a
    //"x,y" string on every render via Array.map + join. The cache
    //below mirrors host._homeSilhouettes by reference, so when
    //refreshOverlays substitutes a fresh array the cache rebuilds;
    //otherwise the same pre-built strings are returned untouched.
    private _silhouetteCacheKey: unknown = null;
    private _silhouettePtsCache: Array<{ base: string; top: string; walls: string[] } | null> = [];



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
                //Skip user-supplied home coordinates so the snapshot stays PII-free, matching the engine-side stripping.
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
                calibrationK:     pvCalibK(this.config)
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


    //Wipe all card-side cached production / forecast data and trigger a fresh fetch from HA and Open-Meteo. Used by the editor's "reset data cache"
    //button so users can recover from a stuck calibration or a stale weather payload without touching localStorage manually.
    public resetDataCache(): void
    {
        //Drop in-memory PV state so the next refreshPv() refetches
        //from scratch instead of pulling from the cached fetch key.
        this._pvHistory             = null;
        this._pvSampleBuffer        = [];
        this._pvFetchKey            = '';
        this._pvHistoryDiagnostics  = null;
        //Engine-side: clears localStorage weather cache, drops the in-memory hourly snapshot and triggers a refetch.
        this._engine?.resetDataCache();
        this.requestUpdate();
    }


    //Sizing for masonry view. 1 unit = 50 px so 15 ≈ 750 px, giving
    //the basemap area room to breathe (~480 px once the timeline
    //takes its ~150 px below). 12 ≈ 600 px was a 16:9 letterbox
    //that read as cramped on the default Lovelace column width.
    public getCardSize(): number
    {
        return 15;
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
            //Default to the section editor's actual ceiling (12 cols
            //wide, 8 rows tall) so the slot HA carves out matches
            //what its layout UI lets the user resize to. Asking for
            //11 rows by default (the old value) lands a slider handle
            //past the editor's max-row limit, which reads as a buggy
            //"the card wants more space than I can give it" mismatch.
            //Min rows lowered to 4 so the card still fits inside a
            //compact two-row "info strip" layout if a power user
            //really wants that.
            rows:        8,
            columns:     12,
            min_rows:    4,
            max_rows:    24,
            min_columns: 6,
            max_columns: 12
        };
    }

    //Wall-clock timestamp captured on the last connect. The engine
    //spawn defers a short delay after the connect so a HA dashboard
    //edit-mode transition (which destroys + recreates the helios-card
    //rapidly while the editor UI animates) doesn't allocate a fresh
    //WebGL context for every transient mount. Without the defer,
    //entering the dashboard edit mode looped through 50+ context
    //allocations in under a second and hit the browser's per-page
    //WebGL cap, producing the "too many active WebGL contexts" flood.
    private _connectedAt = 0;
    //Handle for the deferred requestUpdate() the connect-settle
    //branch in updated() arms. MUST be cleared in disconnectedCallback
    //so a card that gets unmounted before the timer fires can't post
    //a stale requestUpdate that would re-spawn an engine for a
    //detached card; that was the secondary leak path on top of the
    //HA dashboard edit-mode wrapping cycle.
    private _connectSettleTimer: number | undefined;

    public connectedCallback(): void
    {
        super.connectedCallback();
        _liveCards.add(this);
        this._connectedAt = performance.now();
        tick(this);
        //30 s tick: the clock displays HH:MM only (seconds dropped),
        //the sun moves ~0.13° per refresh (visually smooth at that
        //cadence), and the live cursor on a 5-day timeline advances
        //~6 px per 30 s on a 1000 px wide chart. PV and battery live
        //readings update on hass state changes, not on this tick, so
        //they remain real-time regardless. Cuts the per-second wake-
        //ups by 30× compared to the previous 1 Hz cadence.
        this._timer = window.setInterval(() => tick(this), 30_000);
        initVisibilityObserver(this);
        if (typeof document !== 'undefined')
        {
            document.addEventListener('visibilitychange', this._onPageVisibilityForTheme);
        }
        subscribeEnergyPrefs(this);
    }

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        _liveCards.delete(this);
        window.clearInterval(this._timer);
        this._visibilityObserver?.disconnect();
        this._visibilityObserver = undefined;
        if (this._onVisibilityChange)
        {
            document.removeEventListener('visibilitychange', this._onVisibilityChange);
            this._onVisibilityChange = undefined;
        }
        if (typeof document !== 'undefined')
        {
            document.removeEventListener('visibilitychange', this._onPageVisibilityForTheme);
        }
        unsubscribeEnergyPrefs(this);
        if (this._lidarFadeRaf !== undefined)
        {
            cancelAnimationFrame(this._lidarFadeRaf);
            this._lidarFadeRaf = undefined;
        }
        //Same treatment for the dome fade and the dashboard count-up
        //loops: both self-resubmit via requestAnimationFrame and close
        //over `this`, so a detached card would otherwise keep ticking
        //and calling requestUpdate() against the disconnected element.
        if (this._shadingDomeFadeRaf !== undefined)
        {
            cancelAnimationFrame(this._shadingDomeFadeRaf);
            this._shadingDomeFadeRaf = undefined;
        }
        if (this._cloudDomeFadeRaf !== undefined)
        {
            cancelAnimationFrame(this._cloudDomeFadeRaf);
            this._cloudDomeFadeRaf = undefined;
        }
        if (this._lidarOpacityRaf)
        {
            cancelAnimationFrame(this._lidarOpacityRaf);
            this._lidarOpacityRaf = 0;
            this._pendingLidarOpacity = null;
        }
        if (this._dashCountUpRaf !== undefined)
        {
            cancelAnimationFrame(this._dashCountUpRaf);
            this._dashCountUpRaf = undefined;
        }
        cancelPendingRespawn(this);
        if (this._connectSettleTimer !== undefined)
        {
            window.clearTimeout(this._connectSettleTimer);
            this._connectSettleTimer = undefined;
        }
        if (this._engine)
        {
            this._engine.cleanup();
            this._engine = undefined;
        }
        this._lastHomeKey   = '';
        this._initInflight  = false;
    }

    //IntersectionObserver, pause every CSS animation and every SVG
    //SMIL animation when the card scrolls out of the viewport. The
    //rotation loop (a requestAnimationFrame in the engine) is left
    //running because (a) the browser auto-throttles rAF on hidden
    //tabs and (b) the card looks alive when the user scrolls back.
    //Only the SVG overlay animations are paused, they're the ones
    //that run continuously regardless of map state.
    _visibilityObserver?: IntersectionObserver;
    //Document-level visibilitychange listener; set up by
    //initVisibilityObserver() and torn down in disconnectedCallback
    //so a card removed from the DOM doesn't leak a global handler
    //(and a re-mounted card doesn't double-subscribe).
    _onVisibilityChange?: () => void;


    //Engine init policy: re-init only when one of the *identity inputs*
    //changes (API key, home coordinates, map style). We resize the
    //existing engine when the container reflows, we never tear down
    //the MapLibre stack just because a sibling fragment re-rendered.
    //Doing so would trash the user's in-progress edits in the
    //dashboard editor.
    protected updated(_changedProperties: PropertyValues): void
    {
        //Lazy Energy WS subscribe: HA can attach hass AFTER
        //connectedCallback, in which case our connect-time
        //subscribeEnergyPrefs call bailed out without callWS. The
        //subscribe helper itself is idempotent (it checks
        //_energyPrefsUnsub), so re-calling here as soon as hass is
        //ready is safe.
        if (this.hass && !this._energyPrefsUnsub)
        {
            subscribeEnergyPrefs(this);
        }

        if (!this.hass?.config || !this.config)
        {
            return;
        }

        const coords = getHomeCoords(this.config, this.hass);
        if (!coords) return;

        const { lat, lon } = coords;

        //One-time wipe of the obsolete auto-calibration buffer left
        //by older releases (localStorage + HA frontend.user_data).
        //Idempotent via a flag in localStorage.
        if (!this._pvCalibWiped)
        {
            this._pvCalibWiped = true;
            wipeLegacyPvCalibStorage(this.hass, getHomeCoords(this.config, this.hass));
        }

        const homeKey  = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        const identityChanged = homeKey !== this._lastHomeKey;

        if (!this._engine || identityChanged)
        {
            //Disconnected guard: HA's hui-card-edit-mode wrapping
            //fires disconnectedCallback + reconnect in the same Lit
            //tick on every dashboard edit mode entry. Without this
            //gate, an updated() pass that lands on a detached element
            //would still spawn a fresh engine for a card the DOM
            //already discarded, and the cycle could repeat once HA
            //re-attaches.
            if (!this.isConnected) return;
            if (this._initInflight)
            {
                return;
            }
            //Mount-debounce: when HA enters dashboard edit mode the
            //card is destroyed + recreated several times in the
            //first few hundred ms while the editor UI animates in.
            //Allocating a fresh WebGL context per mount cycle floods
            //the browser's per-page WebGL cap. Defer the very first
            //engine spawn so a card that mounts and unmounts in <
            //CONNECT_SETTLE_MS never allocates a context at all.
            const sinceConnect = performance.now() - this._connectedAt;
            const CONNECT_SETTLE_MS = 1000;
            if (sinceConnect < CONNECT_SETTLE_MS)
            {
                //Reuse a single deferred wake-up so rapid Lit updates
                //don't enqueue several timers. Cancelled in
                //disconnectedCallback so a card that gets unmounted
                //mid-defer never re-spawns.
                if (this._connectSettleTimer !== undefined)
                {
                    window.clearTimeout(this._connectSettleTimer);
                }
                this._connectSettleTimer = window.setTimeout(() =>
                {
                    this._connectSettleTimer = undefined;
                    if (!this.isConnected) return;
                    this.requestUpdate();
                }, CONNECT_SETTLE_MS - sinceConnect + 16);
                return;
            }
            //Reset mode flags on identity change. Mode state lives on
            //the card (`_lidarViewMode`, `_shadingDomeMode`, `_detailMode`)
            //and survives the engine respawn, but the engine's
            //corresponding active flags reset to false on every fresh
            //instance. Without this reset, a card that was in
            //LiDAR-View mode at the previous home would carry the
            //`is-on` chrome over to the new home while the new engine
            //quietly skips the LiDAR fetch, the user then clicks the
            //LiDAR button expecting a refresh and instead toggles the
            //view off because the card-side flag was already "on".
            //Resetting to defaults forces a clean re-enter when the
            //user clicks the mode they want at the new location.
            if (identityChanged)
            {
                this._lidarViewMode   = false;
                this._shadingDomeMode = false;
                this._cloudDomeMode   = false;
                this._detailMode      = false;
            }
            this._lastHomeKey   = homeKey;
            this._lastConfigSig = computeConfigSig(this.config);
            initEngine(this);
            return;
        }

        //Identity stable, only push config tweaks down if the visual
        //config has actually changed. Without this guard we'd call
        //updateConfig() on every Lit re-render (e.g. every second from
        //the clock tick, or every time a @state changes), which would
        //rebuild the GeoJSON of thousands of points and freeze the page.
        const sig = computeConfigSig(this.config);
        if (sig !== this._lastConfigSig)
        {
            this._lastConfigSig = sig;
            this._engine.updateConfig(this.config);
        }

        //Refresh chain gate: the per-entity refresh helpers read
        //hass.states + config and are pure functions of those two
        //inputs plus the live time range. Lit calls updated() on
        //every @state mutation (so every overlay reprojection during
        //auto-rotate fires updated() again), which used to re-run
        //the whole chain at 60+ Hz for zero new data. Skip it when
        //neither hass nor config moved since the previous pass.
        if (this.hass === this._lastRefreshHassRef
            && this.config === this._lastRefreshConfigRef
            && this._timeRange === this._lastRefreshTimeRangeRef
            && this._energyDefaults === this._lastRefreshEnergyDefaultsRef)
        {
            return;
        }
        this._lastRefreshHassRef           = this.hass;
        this._lastRefreshConfigRef         = this.config;
        this._lastRefreshTimeRangeRef      = this._timeRange;
        this._lastRefreshEnergyDefaultsRef = this._energyDefaults;

        refreshPv(this);
        refreshBattery(this);
        refreshGrid(this);
        refreshSolarRadiation(this);
    }


    //Timeline pointer interaction

    _trackElement:   HTMLElement | null = null;
    _trackPointerId: number | null      = null;


    _boundPointerMove = (e: PointerEvent): void => onTimelinePointerMove(this, e);
    _boundPointerUp   = (e: PointerEvent): void => onTimelinePointerUp(this, e);


    //Page-visibility listener that invalidates the cached theme
    //probe whenever the tab returns to the foreground. Mobile HA
    //users have reported the card staying on its previous polarity
    //after a theme flip done while the app was backgrounded: HA
    //occasionally pushes a hass with stale themes for one frame
    //after resume, so we drop our own cache and force a re-render
    //to pick up the fresh value as soon as it arrives.
    private _onPageVisibilityForTheme = (): void =>
    {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible')
        {
            this._cachedIsDarkThemesRef = undefined;
            this.requestUpdate();
        }
    };


    //Resolve the active theme polarity. Authoritative source is
    //hass.themes.darkMode (boolean) which HA flips at runtime for
    //every theme swap. The getComputedStyle fallback is for ancient
    //HA builds that predate hass.themes.darkMode AND for custom
    //themes that scope --primary-background-color below :host.
    //
    //Only the fallback gets cached: the primary path is a cheap
    //typeof + property read so caching it adds risk for no gain.
    //setCardThemeIsDark is invoked on every call so the engine
    //stays in sync even when the engine spawns mid-session.
    private _resolveIsDark(themesObj: { darkMode?: boolean } | undefined): boolean
    {
        let isDark: boolean;
        if (themesObj && typeof themesObj.darkMode === 'boolean')
        {
            isDark = themesObj.darkMode;
        }
        else if (this._cachedIsDarkThemesRef === themesObj)
        {
            isDark = this._cachedIsDark;
        }
        else
        {
            isDark = this._probeIsDarkFromCss();
            this._cachedIsDarkThemesRef = themesObj;
            this._cachedIsDark = isDark;
        }
        this._engine?.setCardThemeIsDark(isDark);
        return isDark;
    }


    //Fallback luminance probe. Reads --primary-background-color off
    //the helios-card element and decides dark vs light from the
    //relative luminance. Costly (forces a style recompute), so the
    //caller above only reaches this when hass.themes.darkMode is
    //undefined.
    private _probeIsDarkFromCss(): boolean
    {
        try
        {
            const bg = getComputedStyle(this).getPropertyValue('--primary-background-color').trim();
            if (!bg) return false;
            const hexMatch = bg.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
            let r = 0, g = 0, b = 0;
            if (hexMatch)
            {
                const hex = hexMatch[1].length === 3
                    ? hexMatch[1].split('').map(c => c + c).join('')
                    : hexMatch[1];
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            }
            else
            {
                const rgbMatch = bg.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                if (rgbMatch) { r = +rgbMatch[1]; g = +rgbMatch[2]; b = +rgbMatch[3]; }
            }
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return lum < 0.5;
        }
        catch (_) {}
        return false;
    }


    //Nudge a leader endpoint to the border of the central home
    //circle (the `helios-home-pill` icon painted at layout.home).
    //All chip leaders (PV, battery, grid) dock against this single
    //pill so the home reads as the focal energy node, mirroring HA's
    //own Energy distribution card.
    private _nudgeToHomeCircle(
        chipX: number, chipY: number,
        homeX: number, homeY: number,
    ): { x: number; y: number }
    {
        const dx = chipX - homeX;
        const dy = chipY - homeY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return {
            x: homeX + (dx / len) * HeliosCard.HOME_PILL_RADIUS_PX,
            y: homeY + (dy / len) * HeliosCard.HOME_PILL_RADIUS_PX,
        };
    }


    //Build (or return cached) the SVG point strings for the home
    //silhouette layer. _homeSilhouettes is replaced (new array
    //identity) only when the engine detects the projected vertices
    //moved enough to redraw; between those updates we reuse the
    //pre-serialized strings.
    private _getSilhouettePoints(): Array<{ base: string; top: string; walls: string[] } | null>
    {
        const sils = this._homeSilhouettes;
        if (this._silhouetteCacheKey === sils) return this._silhouettePtsCache;

        const out: Array<{ base: string; top: string; walls: string[] } | null> = [];
        for (const sil of sils)
        {
            const N = Math.min(sil.base.length, sil.top.length);
            if (N < 3) { out.push(null); continue; }
            let basePts = '';
            let topPts  = '';
            for (let i = 0; i < N; i++)
            {
                if (i > 0) { basePts += ' '; topPts += ' '; }
                basePts += sil.base[i].x + ',' + sil.base[i].y;
                topPts  += sil.top [i].x + ',' + sil.top [i].y;
            }
            const walls: string[] = new Array(N);
            for (let i = 0; i < N; i++)
            {
                const j = (i + 1) % N;
                walls[i] =
                    sil.base[i].x + ',' + sil.base[i].y + ' ' +
                    sil.base[j].x + ',' + sil.base[j].y + ' ' +
                    sil.top [j].x + ',' + sil.top [j].y + ' ' +
                    sil.top [i].x + ',' + sil.top [i].y;
            }
            out.push({ base: basePts, top: topPts, walls });
        }
        this._silhouetteCacheKey = sils;
        this._silhouettePtsCache = out;
        return out;
    }


    //Render

    protected render(): TemplateResult
    {
        //Precondition for rendering the live card chrome: home
        //coordinates resolved (HA config or the lat/lon override).
        //The basemap itself is OpenFreeMap and needs no credentials.
        //Variable name kept as `hasApiKey` because every conditional
        //branch below already keys off it; only the meaning is "we
        //have what we need to project the home onto the map".
        const hasApiKey = getHomeCoords(this.config, this.hass) !== null;


        //Date+time shown bottom-right: tracks the timeline cursor.
        //  - In live mode it follows wall-clock time (re-rendered every
        //    second by _tick).
        //  - In scrubbed mode it shows the selected instant exactly.
        //Both date and time follow the user-defined date format.
        const displayDate = !this._isLiveMode && this._selectedTime
            ? this._selectedTime
            : this._now;
        //time-format: '12h' or '24h' (default). hourCycle is more
        //authoritative than hour12, which some locales silently
        //ignore (fr-FR falls back to 24h regardless of hour12).
        const is12h = String(this.config?.['time-format'] ?? '24h').toLowerCase() === '12h';
        //Memoise the date+time labels keyed on (epoch-minute, format
        //flags) so a rotation that only mutates camera state does
        //not re-run Intl.DateTimeFormat (2-5 ms per call on Safari)
        //or our formatDate helper. Both labels only change once per
        //minute in live mode and once per scrub-step in scrub mode.
        const dateFmt = String(this.config?.['date-format'] ?? '');
        const labelKey = `${Math.floor(displayDate.getTime() / 60_000)}|${is12h ? '12' : '24'}|${dateFmt}`;
        let displayDateLabel: string;
        let displayTimeLabel: string;
        if (this._cachedClockLabelKey === labelKey)
        {
            displayDateLabel = this._cachedClockDateLabel;
            displayTimeLabel = this._cachedClockTimeLabel;
        }
        else
        {
            displayDateLabel = formatDate(displayDate, this.config?.['date-format']);
            displayTimeLabel = displayDate.toLocaleTimeString([], {
                hour:      '2-digit',
                minute:    '2-digit',
                hourCycle: is12h ? 'h12' : 'h23'
            } as Intl.DateTimeFormatOptions);
            this._cachedClockLabelKey   = labelKey;
            this._cachedClockDateLabel  = displayDateLabel;
            this._cachedClockTimeLabel  = displayTimeLabel;
        }

        //The on-ground disc self-encodes the low/mid/high breakdown
        //via three concentric bands (proportional radial widths,
        //three shades of the cloud colour); no hover tooltip
        //needed.
        const cloudPctRound    = Math.max(0, Math.round(this._cloudCover));

        //Always-visible cloud-cover percentage label, overlaid in HTML
        //above the home marker, with an SVG leader line tying it to
        //the on-ground 100 % ring. Both anchors come pre-projected
        //from the engine, see HeliosEngine.projectHomeLabelLayout().
        //The label is suppressed until both the layout (map ready)
        //and a cloud-cover value (data ready) are available.
        const layout         = this._labelLayout;

        //Photovoltaic production chip, pinned above the home, tinted in the configured production colour and tied to the home with an animated leader
        //line whose dashes flow from the house up to the chip. Only renders when the user has set the optional `pv-power-entity` config and the live
        //state read produced a finite numeric value.
        const pvEntityId   = String(this.config?.['pv-power-entity'] ?? '').trim();
        //Colour configs (pv-color / battery-color / sun-color / cloud-color / building-color) are no longer
        //consulted, the card inherits the active HA theme's Energy palette via CSS tokens. Defaults below
        //are the matching hex for any inline SVG attribute that still expects a string colour, the YAML
        //keys stay in the config type for backward compat but the renderer ignores them.
        const pvColor      = DEFAULT_PV_COLOR_HEX;
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
                ? pvRateAtTime(this, this._selectedTime!)
                : (this._pvCurrent !== null ? currentPvRate(this) : null))
            : null;

        //Predicted PV at the scrub instant when scrubbing into the
        //future. Uses the same kWp × computePvPower(t, lat, lon, cloud)
        //path the chart's dotted forecast line uses. Falls back to
        //null when peak power is unset or no weather is available
        //yet, in which case the chip stays hidden as before.
        let pvPredictedRate: { value: number; unit: string } | null = null;
        if (pvScrubFuture && pvEntityId !== '' && layout !== null)
        {
            const k      = pvCalibK(this.config);
            const coords = getHomeCoords(this.config, this.hass);
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
                const pct   = computePvPowerWeighted(this.config, this._selectedTime!, coords.lat, coords.lon, cloud, {
                    airTempC: series.temperature[best],
                    windMs:   series.windSpeed[best],
                    raster:   this._engine?.getLidarRaster() ?? null,
                });
                if (pct > 0)
                {
                    //k is W per percent of STC, so pct × k is watts.
                    //Apply the 5-day rolling calibration ratio so the
                    //chip agrees with the dotted forecast curve + the
                    //tooltip value at the same scrub instant; clip at
                    //the inverter's PMax so a bright forecast hour
                    //doesn't overshoot the install's hardware ceiling.
                    //Infinity cap = no clipping.
                    const cal  = computeForecastCalibration(this);
                    const calR = cal ? cal.ratio : 1;
                    const w    = Math.min(pvInverterMaxW(this.config), pct * k * calR);
                    pvPredictedRate = { value: w, unit: 'W' };
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
            ? (isPvPredicted ? '≈ ' : '') + formatPvValue(this.hass, pvActiveRate!.value, pvActiveRate!.unit)
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
            ? pvNormalizeToWatts(pvRate.value, pvRate.unit)
            : 0;
        const pvCalibKVal = pvCalibK(this.config);
        const pvPeakRefW  = (pvCalibKVal !== null && pvCalibKVal > 0)
            ? pvCalibKVal * 100
            : 5000;
        const pvFlowDuration = flowDuration(pvWattsNow, pvPeakRefW, 0.5);
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
        //Bank-aware gates. A chip is allowed to render when AT LEAST one configured bank exposes the corresponding entity (SoC for the
        //SoC chip, power for the Power chip), so a multi-bank install with one bank reporting still gets the aggregated chip painted.
        //Falls back transparently to legacy single-bank configs because parseBatteryBanks wraps the flat keys into a one-row list when
        //the `batteries:` array is absent.
        const batteryBanks       = this._getBatteryBanks();
        const hasAnyBankSoc      = batteryBanks.some(b => b.socEntity   !== '');
        const hasAnyBankPower    = batteryBanks.some(b => b.powerEntity !== '');
        const batteryScrubbing   = !this._isLiveMode && this._selectedTime !== null;
        const batteryScrubFuture = batteryScrubbing
            && this._selectedTime!.getTime() > Date.now() + 60_000;

        //Grid IN / OUT past-scrub: derive the watts from the rolling
        //buffer around the scrub instant so the chip reflects what
        //was actually flowing at that moment, not the live now. Skip
        //in future scrub (no data) and in live mode (live values
        //already in _gridImportValue / _gridExportValue).
        const gridScrubTimeMs = batteryScrubbing && !batteryScrubFuture
            ? this._selectedTime!.getTime()
            : null;
        //Scrub path runs through gridWattsAtTime which sums slopes
        //across every wired entity, the sum can dip below zero
        //around the moment a tariff switches or when a meter
        //quantises in the "wrong" direction by one Wh. A negative
        //IMPORT at scrub time is an EXPORT moment that the export
        //chip already reports; clamping to 0 keeps the slot honest.
        //
        //Combined mode (grid-power-entity) derives ONE signed net
        //from a single buffer set and splits the sign across the two
        //chips, exactly mirroring the live readCombined split: a
        //non-negative net shows on import only, a negative net on
        //export only. Live values already carry that split in
        //_gridImportValue / _gridExportValue.
        let gridImportDisplayWatts: number | null;
        let gridExportDisplayWatts: number | null;
        if (isGridCombined(this.config))
        {
            if (gridScrubTimeMs !== null)
            {
                const signed = gridCombinedWattsAtTime(this, gridScrubTimeMs);
                gridImportDisplayWatts = signed === null ? null : (signed >= 0 ? signed : null);
                gridExportDisplayWatts = signed === null ? null : (signed <  0 ? -signed : null);
            }
            else
            {
                gridImportDisplayWatts = this._gridImportValue;
                gridExportDisplayWatts = this._gridExportValue;
            }
        }
        else
        {
            const rawImport = gridScrubTimeMs !== null
                ? gridWattsAtTime(this._gridImportSamples, this._gridImportUnits, gridScrubTimeMs)
                : this._gridImportValue;
            const rawExport = gridScrubTimeMs !== null
                ? gridWattsAtTime(this._gridExportSamples, this._gridExportUnits, gridScrubTimeMs)
                : this._gridExportValue;
            gridImportDisplayWatts = rawImport === null ? null : Math.max(0, rawImport);
            gridExportDisplayWatts = rawExport === null ? null : Math.max(0, rawExport);
        }
        const gridImportDisplayUnit = gridScrubTimeMs !== null ? 'W' : this._gridImportUnit;
        const gridExportDisplayUnit = gridScrubTimeMs !== null ? 'W' : this._gridExportUnit;

        //Active SoC / power values for this render, historical samples in scrub mode, live state otherwise.
        const activeBatterySoc: number | null = batteryScrubbing
            ? batterySampleAtTime(this._batterySocHistory, this._selectedTime!)
            : this._batterySoc;
        const activeBatteryPower: number | null = batteryScrubbing
            ? batterySampleAtTime(this._batteryPowerHistory, this._selectedTime!)
            : this._batteryPower;
        //The power unit doesn't change between live and history
        //samples (same entity, same configuration), so we read it
        //from the live state cache regardless of mode.
        const activeBatteryUnit = this._batteryPowerUnit;

        const showSocChip = (hasApiKey && layout !== null)
            && !batteryScrubFuture
            && hasAnyBankSoc
            && activeBatterySoc !== null;
        const showPowerChip = (hasApiKey && layout !== null)
            && !batteryScrubFuture
            && hasAnyBankPower
            && activeBatteryPower !== null;

        const batterySocText = showSocChip
            ? `${Math.round(activeBatterySoc!)} %`
            : '';
        const batteryPowerText = showPowerChip
            ? formatBatteryPower(this.hass, activeBatteryPower!, activeBatteryUnit)
            : '';

        //Charging / discharging direction drives the SVG arrow
        //path direction on the PV↔Power leader. Sign comes straight
        //from the entity (positive = charging by convention).
        //Charging: arrow flows PV → Power (energy moving INTO the
        //battery). Discharging: arrow flows Power → PV (energy
        //moving OUT). The dashes flow at a speed proportional to
        //|P|, saturating at the same ~5 kW threshold as the PV
        //leader so all energy-flow streams read on the same scale.
        //Battery direction sign: positive = charging (energy IN),
        //negative = discharging (OUT). Drives the dual-tone leader
        //color (pink for charging, teal for discharging, the HA
        //Energy palette identity).
        const batteryCharging = showPowerChip && (activeBatteryPower! > 0);
        const batteryLeaderColor = batteryCharging
            ? 'var(--energy-battery-in-color, #f06292)'
            : 'var(--energy-battery-out-color, #4db6ac)';
        const batteryWattsForFlow = showPowerChip
            ? Math.abs(pvNormalizeToWatts(activeBatteryPower!, activeBatteryUnit))
            : 0;
        //"Idle", measured power within sensor-noise margin of zero
        //(±5 W). The leader is still drawn so the user keeps the
        //spatial relationship, but the dash flow is frozen and the
        //arrow head is hidden, nothing is moving in either
        //direction, so any motion would be misleading.
        const batteryIdle = showPowerChip && batteryWattsForFlow < 5;
        const batteryFlowDuration = flowDuration(batteryWattsForFlow, 5000);

        //Battery leader L-shape geometry, computed once and reused
        //for the visible <path> elements (SoC and Power) and for
        //the animated arrow's <animateMotion> path. Only meaningful
        //when a layout is available; gated by the same flag as the
        //chip rendering so we don't dereference a null layout below.
        //
        //  PV_HALF_HEIGHT_PX (11) places the top of the vertical
        //  leg flush against PV's bottom edge so the line emerges
        //  from the chip rather than from inside it.
        //  CHIP_NUDGE_PX (32) is the horizontal distance from each
        //  battery chip's centre to the inside of its left/right
        //  edge, so the chip background covers the very tip of the
        //  leader and the visible dash sequence terminates cleanly
        //  at the chip border.
        //  FILLET_R (6) rounds the corner of the L with a quadratic
        //  Bezier. The visible line and the arrow's <animateMotion>
        //  path share the same fillet, so the arrow's tangent
        //  rotates smoothly through the bend instead of snapping
        //  90 deg at the corner. SMIL parametrises the path at
        //  constant linear velocity, so the time spent on the
        //  fillet shrinks proportionally with `flowDuration`.
        const PV_HALF_HEIGHT_PX    = 11;
        //Half-width of the PV chip, used by the solar-ray target snap.
        //Sized to the NARROWEST realistic PV chip text ("0 W" -> ~55 px
        //wide, half ~27). Picking the small half-width guarantees the
        //solar-ray snap point lands at-or-just-before the chip border
        //even on short text, so the ray no longer overshoots and
        //draws on top of the chip body. Wider chip strings still get
        //the snap inside their pill but that's covered by the chip's
        //own background.
        const PV_HALF_WIDTH_PX  = 28;
        //Chip cluster around the home: Battery (SoC + Power) on the
        //RIGHT, Grid (Import + Export) on the LEFT. Each chip uses
        //a straight hairline leader to the home centre rather than
        //the old L-shape, since the horizontal stack no longer needs
        //the bent geometry and the
        //straight line matches the HA Energy distribution card's
        //hairline vocabulary.
        //Build a rounded L: horizontal segment from the chip side
        //towards the home's vertical axis, fillet, vertical segment
        //down (or up) to the home pill border. chipX/chipY is the
        //chip centre; the leader starts at the chip edge nudged by
        //chipNudgePx along the home direction, and ends at the home
        //pill border.
        const buildLPathToHome = (chipX: number, chipY: number, chipNudgePx: number): string =>
        {
            if (!layout) return '';
            const homeX = layout.home.x;
            const homeY = layout.home.y;
            //Chip-side start: nudge horizontally toward home.
            const dirH = homeX > chipX ? 1 : -1;
            const dirV = homeY > chipY ? 1 : -1;
            const sx = chipX + dirH * chipNudgePx;
            const sy = chipY;
            //Land the vertical leg at 25 % of the home pill width
            //(7 px = 28 / 4) on the chip's side of centre, so the
            //two leaders meeting on the same row do NOT collide on
            //the pill's central axis. Vertical leg then docks
            //against the pill border at the matching circle
            //intersection.
            const HOME_PILL_VISIBLE_RADIUS = 16;
            const HOME_PILL_QUARTER_X      = 7;
            const ex = homeX - dirH * HOME_PILL_QUARTER_X;
            //The vertical leg crosses the pill outline at
            //y = home.y ± sqrt(R² - offsetX²).
            const yIntersect = Math.sqrt(
                Math.max(0,
                    HOME_PILL_VISIBLE_RADIUS * HOME_PILL_VISIBLE_RADIUS
                    - HOME_PILL_QUARTER_X    * HOME_PILL_QUARTER_X)
            );
            const ey = homeY - dirV * yIntersect;
            //Fillet radius, clamped so the curve fits inside both
            //legs of the L.
            const FILLET_R = 12;
            const r = Math.min(FILLET_R, Math.abs(ex - sx) / 2, Math.abs(ey - sy) / 2);
            const preX  = ex - dirH * r;
            const postY = sy + dirV * r;
            return `M ${sx.toFixed(1)},${sy.toFixed(1)} L ${preX.toFixed(1)},${sy.toFixed(1)} Q ${ex.toFixed(1)},${sy.toFixed(1)} ${ex.toFixed(1)},${postY.toFixed(1)} L ${ex.toFixed(1)},${ey.toFixed(1)}`;
        };
        const socLeaderPath        = buildLPathToHome(layout?.batterySocLabel.x   ?? 0, layout?.batterySocLabel.y   ?? 0, 22);
        const powerLeaderPath      = buildLPathToHome(layout?.batteryPowerLabel.x ?? 0, layout?.batteryPowerLabel.y ?? 0, 22);
        const powerArrowPath       = powerLeaderPath;
        const gridImportLeaderPath = buildLPathToHome(layout?.gridImportLabel.x   ?? 0, layout?.gridImportLabel.y   ?? 0, 22);
        const gridExportLeaderPath = buildLPathToHome(layout?.gridExportLabel.x   ?? 0, layout?.gridExportLabel.y   ?? 0, 22);

        //Grid bead cadence, frequency (= 1 / dur) is proportional to
        //live power so the perceived bead speed tracks the chip
        //value linearly. The previous mapping was linear in
        //DURATION which made a 1 kW reading look almost as fast as
        //a 4 kW reading (8 s -> 6 s vs 8 s -> 2 s), nothing like
        //"twice the power = twice the speed". The new formula:
        //  dur = MIN_DUR * CAP / watts
        //gives MIN_DUR at the cap, 2 x MIN_DUR at half the cap,
        //4 x MIN_DUR at a quarter, clamped to MAX_DUR_S so very
        //small readings still produce a visible bead.
        //Below ~5 W the chip is idle (recorder rounding noise) and
        //the bead is dropped entirely. Caps are opinionated round
        //residential thresholds: 5 kW import covers most French
        //single-phase contracts, 1 kW export covers a typical
        //surplus on a home installation.
        const GRID_BEAD_IMPORT_CAP_W = 5000;
        const GRID_BEAD_EXPORT_CAP_W = 1000;
        const GRID_BEAD_MIN_DUR_S = 1.2;
        const GRID_BEAD_MAX_DUR_S = 8.0;
        const GRID_BEAD_IDLE_W    = 5;
        const importWattsAbs = this._gridImportValue !== null
            ? Math.abs(pvNormalizeToWatts(this._gridImportValue, this._gridImportUnit))
            : 0;
        const exportWattsAbs = this._gridExportValue !== null
            ? Math.abs(pvNormalizeToWatts(this._gridExportValue, this._gridExportUnit))
            : 0;
        const proportionalBeadDur = (watts: number, capW: number): number =>
        {
            const w = Math.max(watts, 1);
            return Math.min(GRID_BEAD_MAX_DUR_S, Math.max(GRID_BEAD_MIN_DUR_S, GRID_BEAD_MIN_DUR_S * capW / w));
        };
        const gridImportBeadDur = importWattsAbs < GRID_BEAD_IDLE_W ? null
            : proportionalBeadDur(importWattsAbs, GRID_BEAD_IMPORT_CAP_W);
        const gridExportBeadDur = exportWattsAbs < GRID_BEAD_IDLE_W ? null
            : proportionalBeadDur(exportWattsAbs, GRID_BEAD_EXPORT_CAP_W);

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
        const sunColor      = DEFAULT_SUN_COLOR_HEX;
        const sunRimColor   = darkenHex(sunColor, 0.20);
        const arcSegments   = showSun ? buildArcSegments(sunScene!.arc, sunColor) : [];
        //Z-order split: below-horizon (dotted) segments render BEHIND
        //the home chip cluster, above-horizon segments render in front
        //so the live sun always dominates. Single-pass split into two
        //scratch buffers reused across renders so the filter() pair
        //does not allocate two fresh arrays on every cycle.
        const arcSegmentsBack     = this._arcBackBuf;
        const arcSegmentsFrontFar  = this._arcFrontBuf;
        const arcSegmentsFrontNear = this._arcFrontNearBuf;
        arcSegmentsBack.length      = 0;
        arcSegmentsFrontFar.length  = 0;
        arcSegmentsFrontNear.length = 0;
        //Above-horizon segments get a 2nd split by camera nearness so
        //the part of the arc closest to the eye renders ABOVE the home
        //chips (overlapping the leaders + pill), while the part that
        //arches away from the eye renders BEHIND the chips. The
        //threshold is the per-segment nearness midpoint: anything
        //within the closer half is painted on the near SVG.
        for (let i = 0; i < arcSegments.length; i++)
        {
            const s = arcSegments[i];
            if (s.belowHorizon)            arcSegmentsBack.push(s);
            else if (s.nearness >= 0.50)   arcSegmentsFrontNear.push(s);
            else                           arcSegmentsFrontFar.push(s);
        }

        //The incidence ray only renders when the sun is actually above the horizon, drawing a ray from below the ground towards the home would be
        //visually nonsensical.
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
        const sunFlowDuration = flowDuration(sunWm2, 1000, 0.8);

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
        //Anchor the sun ray to the NEAREST point of the PV chip's
        //pill outline rather than snapping to one of the four
        //cardinal centres. The pill is centred at pvLabel.x / y,
        //has a straight rectangular middle of width
        //(PV_HALF_WIDTH_PX - PV_HALF_HEIGHT_PX) * 2 and two
        //semicircular end-caps of radius PV_HALF_HEIGHT_PX. The
        //resulting attachment point glides smoothly along the
        //outline as the sun arcs across the sky instead of
        //jumping between four discrete spots; matches the
        //"leader docks at the closest border point" behaviour the
        //HA Energy distribution card uses.
        if (layout && sunScene && pvEntityId)
        {
            const cx = layout.pvLabel.x;
            const cy = layout.pvLabel.y;
            const halfW = PV_HALF_WIDTH_PX;
            const halfH = PV_HALF_HEIGHT_PX;
            const ex = sunScene.sun.x - cx;
            const ey = sunScene.sun.y - cy;
            //Width of the rectangular middle of the pill (between
            //the two end-cap semicircles).
            const straightHalfW = Math.max(0, halfW - halfH);

            if (Math.abs(ex) <= straightHalfW)
            {
                //Sun above or below the straight middle. The nearest
                //point sits on the top or bottom edge directly under
                //the sun (clamped horizontally to the straight zone
                //in case the sun is far off-axis).
                sunRayTargetX = sunScene.sun.x;
                sunRayTargetY = cy + (ey >= 0 ? 1 : -1) * halfH;
            }
            else
            {
                //Sun off to one of the rounded ends. The nearest
                //point sits on the matching end-cap arc, along the
                //line from the end-cap centre to the sun.
                const cornerX = cx + (ex >= 0 ? 1 : -1) * straightHalfW;
                const cornerY = cy;
                const dx = sunScene.sun.x - cornerX;
                const dy = sunScene.sun.y - cornerY;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                sunRayTargetX = cornerX + halfH * dx / dist;
                sunRayTargetY = cornerY + halfH * dy / dist;
            }
        }

        //Detect the active HA theme. Authoritative source is
        //hass.themes.darkMode (boolean) which HA flips at runtime
        //for every theme swap (user profile toggle, time-of-day
        //auto-theme, external integration). A CSS-luminance probe
        //via getComputedStyle stays around as a last-resort fallback
        //for older HA builds that predate hass.themes.darkMode.
        const themesObj = (this.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes;
        const isDark = this._resolveIsDark(themesObj);
        const cardThemeClass = isDark ? 'theme-dark' : 'theme-light';

        //LiDAR View gating: the button stays visible (so its location
        //is predictable across homes) but goes disabled when no LiDAR
        //provider covers the active home. Read off the engine, falls
        //back to null until the engine has resolved its first home.
        const lidarSourceId    = this._engine?.getActiveLidarSourceId() ?? null;
        const cardClasses = [
            cardThemeClass,
            this._detailMode      ? 'detail-active'        : '',
            this._lidarViewMode   ? 'lidar-view-active'    : '',
            this._shadingDomeChipMask ? 'shading-dome-active'  : '',
            this._cloudDomeMode   ? 'cloud-dome-active'    : '',
        ].filter(Boolean).join(' ');

        return html`
            <ha-card class="${cardClasses}">

                <div id="map-container"></div>

                ${hasApiKey && this._timeRange && timelineEnabled(this.config) ? html`
                    <div
                        class="time-bar"
                        style="--timeline-width-frac:${timelineWidthPct(this.config) / 100}"
                        @pointerdown="${(e: PointerEvent) => onTimelinePointerDown(this, e)}"
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
                        ${renderTimelineHoverTooltip(this)}
                        ${pvEntityId ? html`
                            <div
                                class="tb-chart-card tb-pv-card"
                                @pointermove="${(e: PointerEvent) => handleChartHoverMove(this, e)}"
                                @pointerleave="${() => handleChartHoverLeave(this)}"
                            >
                                ${renderPvChart(this)}
                                ${renderTimelineNightZones(this)}
                                ${renderTimelineFutureMask(this)}
                                ${renderTimelineTicks(this)}
                            </div>
                        ` : nothing}

                        <!--  Chart card: hosts the area chart, the
                              dotted day separators, the night-zone
                              diagonal hatch overlay (one rect per
                              sunset, next sunrise window) and the
                              live + scrub cursors as HTML overlays.
                              The day-label chip row used to overlay
                              the midline of this card; it's now a
                              sibling block below so the chips never
                              cover the curves they describe.  -->
                        <div
                            class="tb-chart-card"
                            @pointermove="${(e: PointerEvent) => handleChartHoverMove(this, e)}"
                            @pointerleave="${() => handleChartHoverLeave(this)}"
                        >
                            ${renderChart(this)}
                            ${renderTimelineNightZones(this)}
                            ${renderTimelineFutureMask(this)}
                            ${renderTimelineTicks(this)}
                        </div>
                        ${renderTimelineDayLabels(this)}
                    </div>
                ` : nothing}

                ${hasApiKey ? html`
                    <div class="spinner-center ${this._fetching ? 'spinning' : ''}">
                        <svg class="spinner-sun" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <!--  Rotating ray bundle, 12 spokes around the disc.
                                  Painted in the configured sun colour via the
                                  CSS variable so the spinner stays on-brand
                                  even when the user themes the sun. -->
                            <g class="spinner-sun-rays">
                                ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => svg`
                                    <line
                                        x1="32" y1="6"
                                        x2="32" y2="14"
                                        stroke="var(--helios-sun-color, #f59e0b)"
                                        stroke-width="3"
                                        stroke-linecap="round"
                                        transform="rotate(${deg} 32 32)"
                                    />
                                `)}
                            </g>
                            <!--  Steady inner disc, doesn't spin (otherwise the
                                  rotation reads "the sun is wobbly", not
                                  "we're loading"). -->
                            <circle cx="32" cy="32" r="10" fill="var(--helios-sun-color, #f59e0b)" />
                        </svg>
                    </div>
                ` : nothing}

                <!--  Top-right mode bar: three glued segments picking
                      which canvas state the card is in. The default
                      Layer UI is the regular HUD (sun arc, clouds,
                      leader lines, chips), LiDAR View paints the
                      cell cloud over a quiet basemap, Ombres paints
                      the celestial dome of learned residuals above
                      the home. The three modes are mutually
                      exclusive; the bar shows which one is active
                      and lets the user switch in a single click.
                      Each segment is icon-only with a title
                      tooltip; the active segment takes the same
                      scrub-blue plate the clock chip uses while
                      scrubbing, for visual consistency with the
                      other mode-indicating chips.                   -->
                ${hasApiKey ? (() => {
                    const isLocal     = lidarSourceId === 'local-ndsm';
                    const hasProvider = lidarSourceId !== null;
                    //LiDAR readiness: an online provider needs its
                    //first fetch to land before the view is meaningful;
                    //the local nDSM resolves synchronously so it never
                    //goes through the loading state. While the engine
                    //is fetching shadows, the button shows the spinner
                    //and is disabled; once data is ready, the icon
                    //flips to satellite (online) or harddisk (local).
                    //Loading state covers BOTH the raster fetch (shadow
                    //busy) and the per-cell irradiance compute (exposure
                    //busy). Either keeps the spinner up.
                    const lidarLoading = hasProvider
                                       && ((!isLocal && this._shadowBusy)
                                           || (this._lidarViewMode && this._lidarExposureBusy));
                    const lidarReady   = hasProvider && (isLocal || !this._shadowBusy);
                    const lidarIcon   = !hasProvider ? 'mdi:cloud-off-outline'
                                       : lidarLoading ? 'mdi:loading'
                                       : isLocal      ? 'mdi:harddisk'
                                                      : 'mdi:satellite-variant';
                    const lidarTitle  = !hasProvider ? 'No LiDAR coverage at this location'
                                       : lidarLoading ? 'LiDAR view, loading shadows...'
                                       : isLocal      ? 'LiDAR view, local nDSM'
                                                      : 'LiDAR view, online provider';
                    const isLayer = !this._lidarViewMode && !this._shadingDomeMode && !this._cloudDomeMode;
                    //Lock mode-switching while the exposure sweep is in
                    //flight: the user cannot exit / re-enter / swap
                    //modes until the LiDAR view has finished computing.
                    //Same guard applied to all 3 mode-bar buttons so a
                    //race between "user clicks home" and "sweep midway"
                    //can't leave the layer in a half-built state.
                    const modeLocked = this._lidarViewMode && this._lidarExposureBusy;
                    //Mode-bar click handlers bound once as class fields
                    //(see _onModeLayer etc.) so Lit does not see a fresh
                    //closure identity on every render and re-attach the
                    //@click handler four times per cycle.
                    const onLidar    = (lidarReady && !modeLocked) ? this._onModeLidar        : undefined;
                    const onLayer    = !modeLocked                  ? this._onModeLayer        : undefined;
                    const onShading  = !modeLocked                  ? this._onModeShadingDome  : undefined;
                    //Live cloud-cover icon for the cloud-dome button:
                    //sun, partly-cloudy, cloudy or pouring depending on
                    //the current home reading. The user reads the sky
                    //state at a glance without opening the dome.
                    return html`
                        <div class="overlay-top-right">
                            <div class="mode-bar" role="radiogroup" aria-label="View mode">
                                <button
                                    type="button"
                                    class="mode-bar-seg ${isLayer ? 'is-on' : ''} ${modeLocked ? 'is-disabled' : ''}"
                                    role="radio"
                                    aria-checked="${isLayer ? 'true' : 'false'}"
                                    ?disabled="${modeLocked}"
                                    aria-label="Default layer UI"
                                    @click="${onLayer}"
                                >
                                    <ha-icon icon="mdi:home"></ha-icon>
                                </button>
                                <button
                                    type="button"
                                    class="mode-bar-seg ${this._lidarViewMode ? 'is-on' : ''} ${(!lidarReady || modeLocked) ? 'is-disabled' : ''} ${lidarLoading ? 'is-loading' : ''}"
                                    role="radio"
                                    aria-checked="${this._lidarViewMode ? 'true' : 'false'}"
                                    ?disabled="${!lidarReady || modeLocked}"
                                    aria-label="${lidarTitle}"
                                    @click="${onLidar}"
                                >
                                    <ha-icon icon="${lidarIcon}"></ha-icon>
                                </button>
                                <button
                                    type="button"
                                    class="mode-bar-seg ${this._shadingDomeMode ? 'is-on' : ''} ${modeLocked ? 'is-disabled' : ''}"
                                    role="radio"
                                    aria-checked="${this._shadingDomeMode ? 'true' : 'false'}"
                                    ?disabled="${modeLocked}"
                                    aria-label="Adaptive shading dome"
                                    @click="${onShading}"
                                >
                                    <ha-icon icon="mdi:radar"></ha-icon>
                                </button>
                            </div>
                        </div>
                    `;
                })() : nothing}

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
                                @click="${() => resetToLive(this)}"
                                aria-label="Back to live"
                            >
                                <ha-icon icon="mdi:restore"></ha-icon>
                            </button>
                        ` : nothing}
                    </div>
                ` : nothing}

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

                ${hasApiKey && this._cloudCover >= 0 ? html`
                    <button class="cloud-pct-label${this._cloudDomeMode ? ' is-on' : ''}"
                            type="button"
                            @click="${this._onCloudChipToggle}"
                            aria-pressed="${this._cloudDomeMode ? 'true' : 'false'}"
                            aria-label="Per-layer cloud cover">
                        <ha-icon icon="${cloudCoverIcon(this._cloudCover)}"></ha-icon>
                        <span>${cloudPctRound}%</span>
                    </button>
                ` : nothing}
                ${hasApiKey && this._cloudScene ? html`
                    <svg class="cloud-layer-leaders${this._cloudDomeMode ? ' is-on' : ''}"
                         viewBox="0 0 180 22" preserveAspectRatio="xMidYMid meet">
                        <!--  Four-segment leader system:
                              - Trunk: a single vertical from the toggle
                                bottom (x=90 y=0) down to a central
                                junction point (x=90 y=11), the halfway
                                line between the toggle and the layer
                                chips.
                              - From the junction, three branches reach
                                each chip: an L (with Q fillet) toward
                                the low chip on the left, a straight
                                vertical to the mid chip, and a mirrored
                                L toward the high chip on the right.
                              Chip-center x positions: low at 27, mid at
                              90, high at 153 (fixed-width chips, see
                              .cloud-layer-chip min-width).             -->
                        <path d="M 90,0 L 90,11"                          class="cloud-layer-leader cloud-layer-leader--trunk" fill="none" stroke="currentColor"/>
                        <path d="M 90,11 L 35,11 Q 27,11 27,19 L 27,22"   class="cloud-layer-leader cloud-layer-leader--low"   fill="none" stroke="currentColor"/>
                        <path d="M 90,11 L 90,22"                          class="cloud-layer-leader cloud-layer-leader--mid"   fill="none" stroke="currentColor"/>
                        <path d="M 90,11 L 145,11 Q 153,11 153,19 L 153,22" class="cloud-layer-leader cloud-layer-leader--high" fill="none" stroke="currentColor"/>
                    </svg>
                    <div class="cloud-layer-chips${this._cloudDomeMode ? ' is-on' : ''}">
                        <div class="cloud-layer-chip cloud-layer-chip--low">
                            <ha-icon icon="${cloudLayerIcon('low')}"></ha-icon>
                            <span>${Math.round(this._cloudScene.cloudLow)}%</span>
                        </div>
                        <div class="cloud-layer-chip cloud-layer-chip--mid">
                            <ha-icon icon="${cloudLayerIcon('mid')}"></ha-icon>
                            <span>${Math.round(this._cloudScene.cloudMid)}%</span>
                        </div>
                        <div class="cloud-layer-chip cloud-layer-chip--high">
                            <ha-icon icon="${cloudLayerIcon('high')}"></ha-icon>
                            <span>${Math.round(this._cloudScene.cloudHigh)}%</span>
                        </div>
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
                <!--  No ground ring around the home: the previous
                      projected disc fought with the cloud-cover
                      overlay and the HA-Energy-blue home silhouette
                      below already carries the footprint identity.
                      Slot kept so the home stack stays vertically
                      anchored for the leaders below. -->
                ${nothing}

                ${showPvLabel ? (() => {
                    //Leader endpoint = edge of the home circle on the
                    //chip-to-home axis. The home node icon (a small
                    //circular disc painted right where layout.home
                    //sits) is the shared docking point for every
                    //chip leader, so the line stops at the disc's
                    //border via a fixed radius nudge.
                    const pvX1 = layout!.pvLabel.x;
                    const pvY1 = layout!.pvLabel.y + PV_HALF_HEIGHT_PX;
                    const pvHomeEnd = this._nudgeToHomeCircle(
                        pvX1, pvY1,
                        layout!.home.x, layout!.home.y,
                    );
                    return html`
                    <svg class="pv-home-leader-svg">
                        <line
                            class="pv-home-leader-line"
                            style="--pv-leader-color:${pvColor}"
                            x1="${pvX1}"
                            y1="${pvY1}"
                            x2="${pvHomeEnd.x}"
                            y2="${pvHomeEnd.y}"
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
                                    path="M ${pvX1},${pvY1} L ${pvHomeEnd.x},${pvHomeEnd.y}"
                                ></animateMotion>
                            </circle>
                        ` : nothing}
                    </svg>`;
                })() : nothing}

                ${showPvLabel ? html`
                    <div
                        class="pv-pct-label ${isPvPredicted ? 'is-predicted' : ''}"
                        style="left:${layout!.pvLabel.x}px; top:${layout!.pvLabel.y}px; --pv-leader-color:${pvColor}"
                    >
                        <ha-icon icon="mdi:solar-power"></ha-icon>
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
                                style="--battery-leader-color:${batteryLeaderColor}"
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
                                style="--battery-leader-color:${batteryLeaderColor}"
                                d="${powerLeaderPath}"
                            ></path>
                            ${!batteryIdle ? svg`
                                <circle
                                    class="battery-leader-bead"
                                    r="4"
                                    style="fill:${batteryLeaderColor}"
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
                            style="left:${layout!.batterySocLabel.x}px; top:${layout!.batterySocLabel.y}px; --battery-leader-color:${batteryLeaderColor}"
                        >
                            <ha-icon icon="mdi:battery"></ha-icon>
                            <span>${batterySocText}</span>
                        </div>
                    ` : nothing}
                    ${showPowerChip ? html`
                        <div
                            class="battery-pct-label"
                            style="left:${layout!.batteryPowerLabel.x}px; top:${layout!.batteryPowerLabel.y}px; --battery-leader-color:${batteryLeaderColor}"
                        >
                            <ha-icon icon="mdi:lightning-bolt"></ha-icon>
                            <span>${batteryPowerText}</span>
                        </div>
                    ` : nothing}
                ` : nothing}

                <!--  Grid Import / Export column on the LEFT side of
                      the home. Import = HA energy consumption blue,
                      Export = HA energy return purple. Same straight
                      hairline leader vocabulary as the battery
                      column on the right. Renders only when the
                      matching entity is configured AND has a finite
                      reading.                                       -->
                ${hasApiKey && layout !== null && gridImportDisplayWatts !== null && !batteryScrubFuture ? html`
                    <svg class="grid-leader-svg">
                        <path class="grid-import-leader-line" d="${gridImportLeaderPath}" />
                        <!--  Moving bead, same vocabulary as the PV
                              leader: a small disc rides the leader
                              from the home pill out to the grid chip
                              at a fixed cadence. Direction = OUT from
                              home for IMPORT? No, semantically the
                              import flows FROM the grid INTO the home,
                              so the bead travels chip → home. -->
                        ${gridImportBeadDur !== null ? svg`
                            <circle class="grid-import-leader-bead" r="3.5">
                                <animateMotion dur="${gridImportBeadDur.toFixed(2)}s" repeatCount="indefinite"
                                               path="${gridImportLeaderPath}" />
                            </circle>
                        ` : nothing}
                    </svg>
                    <div
                        class="grid-import-label"
                        style="left:${layout!.gridImportLabel.x}px; top:${layout!.gridImportLabel.y}px"
                    >
                        <ha-icon icon="mdi:transmission-tower-import"></ha-icon>
                        <span>${formatGridValue(gridImportDisplayWatts, gridImportDisplayUnit)}</span>
                    </div>
                ` : nothing}
                ${hasApiKey && layout !== null && gridExportDisplayWatts !== null && !batteryScrubFuture ? html`
                    <svg class="grid-leader-svg">
                        <path class="grid-export-leader-line" d="${gridExportLeaderPath}" />
                        <!--  Export bead: travels FROM the home OUT to
                              the grid chip, matching the semantic
                              direction (energy leaving the home).
                              keyPoints 1->0 reverses the animateMotion
                              traversal so the bead starts at the home
                              end of the path and ends at the chip.  -->
                        ${gridExportBeadDur !== null ? svg`
                            <circle class="grid-export-leader-bead" r="3.5">
                                <animateMotion dur="${gridExportBeadDur.toFixed(2)}s" repeatCount="indefinite"
                                               keyPoints="1;0" keyTimes="0;1"
                                               path="${gridExportLeaderPath}" />
                            </circle>
                        ` : nothing}
                    </svg>
                    <div
                        class="grid-export-label"
                        style="left:${layout!.gridExportLabel.x}px; top:${layout!.gridExportLabel.y}px"
                    >
                        <ha-icon icon="mdi:transmission-tower-export"></ha-icon>
                        <span>${formatGridValue(gridExportDisplayWatts, gridExportDisplayUnit)}</span>
                    </div>
                ` : nothing}

                <!--  Solar arc, FAR-FRONT pass. Above-horizon
                      segments whose nearness is below the 0.5 mid-
                      point: the arc has already arched away from the
                      eye but is still in front of the sky dome's
                      back wall. These render BEHIND the home-anchored
                      chips so a chip cluster doesn't get crossed by
                      an arc segment that visually sits "in the back
                      half" of the sky. -->
                ${showSun && arcSegmentsFrontFar.length > 0 ? html`
                    <svg
                        class="solar-svg solar-svg-front-far"
                        style="--solar-daylight:${sunScene!.daylight}"
                    >
                        ${arcSegmentsFrontFar.map(s => svg`
                            <line
                                class="solar-arc-outline"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke-width="${HeliosCard.OUTLINE_FAR
                                    + (HeliosCard.OUTLINE_NEAR - HeliosCard.OUTLINE_FAR) * s.nearness}"
                            ></line>
                        `)}
                        ${arcSegmentsFrontFar.map(s => svg`
                            <line
                                class="solar-arc-segment"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke="${s.color}"
                                stroke-width="${HeliosCard.SEGMENT_FAR
                                    + (HeliosCard.SEGMENT_NEAR - HeliosCard.SEGMENT_FAR) * s.nearness}"
                            ></line>
                        `)}
                    </svg>
                ` : nothing}

                <!--  Solar arc, NEAR-FRONT pass. Above-horizon
                      segments whose nearness is at or above 0.5: the
                      part of the arc that is closer to the camera
                      than the home. These render IN FRONT of the
                      home-anchored chips + leaders so the live arc
                      always reads on top of the HUD on its near side.
                      The card is named Helios, the sun must dominate
                      visually wherever it is. -->
                ${showSun && arcSegmentsFrontNear.length > 0 ? html`
                    <svg
                        class="solar-svg solar-svg-front-near"
                        style="--solar-daylight:${sunScene!.daylight}"
                    >
                        ${arcSegmentsFrontNear.map(s => svg`
                            <line
                                class="solar-arc-outline"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke-width="${HeliosCard.OUTLINE_FAR
                                    + (HeliosCard.OUTLINE_NEAR - HeliosCard.OUTLINE_FAR) * s.nearness}"
                            ></line>
                        `)}
                        ${arcSegmentsFrontNear.map(s => svg`
                            <line
                                class="solar-arc-segment"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke="${s.color}"
                                stroke-width="${HeliosCard.SEGMENT_FAR
                                    + (HeliosCard.SEGMENT_NEAR - HeliosCard.SEGMENT_FAR) * s.nearness}"
                            ></line>
                        `)}
                    </svg>
                ` : nothing}

                <!--  Ray + bead live in their own SVG below the chip
                      family (z 7 < pv-pct-label z 8) so the PV chip's
                      background always occludes the ray endpoint at
                      the chip border. The sun disc itself stays in
                      the depth-split SVG below so it still passes in
                      front of / behind the home cluster depending on
                      camera bearing, but the ray no longer rides
                      OVER the production chip when the sun's near
                      half of the sky brings the disc above the chip
                      stack. -->
                ${showSun && showRay ? html`
                    <svg class="solar-svg solar-ray-svg"
                         style="--solar-daylight:${sunScene!.daylight}">
                        <line
                            class="solar-ray"
                            style="--sun-flow-duration:${sunFlowDuration}s"
                            x1="${sunScene!.sun.x}"  y1="${sunScene!.sun.y}"
                            x2="${sunRayTargetX}"    y2="${sunRayTargetY}"
                            stroke="${sunColor}"
                        ></line>
                        <!--  Bead uses an absolute-coordinate path
                              with cx / cy left at the default 0
                              origin, same vocabulary as the PV
                              leader bead. Single-attribute updates
                              keep the SMIL animation continuous
                              during camera rotation. -->
                        <circle
                            class="solar-ray-bead"
                            r="5"
                            fill="${sunColor}"
                        >
                            <animateMotion
                                dur="${sunFlowDuration}s"
                                repeatCount="indefinite"
                                path="M ${sunScene!.sun.x},${sunScene!.sun.y} L ${sunRayTargetX},${sunRayTargetY}"
                            ></animateMotion>
                        </circle>
                    </svg>
                ` : nothing}

                ${showSun ? html`
                    <svg
                        class="solar-svg solar-svg-sun ${sunScene!.sun.nearness >= 0.50 ? 'solar-svg-sun-near' : 'solar-svg-sun-far'}"
                        style="--solar-daylight:${sunScene!.daylight}"
                    >
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

                <!--  Sunrise / sunset markers were drawn here as
                      sun-coloured ha-icon glyphs anchored at the
                      arc's horizon crossings. Removed: the arc
                      shape itself already communicates "the sun
                      rises here, sets there", the icons added
                      visual noise and competed with the LiDAR
                      shadow blobs sitting on the same
                      horizon line.                                  -->


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
                    const sunColor = DEFAULT_SUN_COLOR_HEX;
                    const silhouettePts = this._getSilhouettePoints();
                    //Pulse on bead arrival retired in alpha.18: the
                    //flash carved a hot spot on the home silhouette
                    //that competed with the steady HA-Energy-blue
                    //identity, hard to read against the cloud-cover
                    //wash. Glow is now a static hover-only halo.
                    const glowClasses = [
                        'home-glow-svg',
                        this._homeHover ? 'is-hovered' : '',
                    ].filter(Boolean).join(' ');
                    return html`
                        <svg class="${glowClasses}"
                             style="--helios-sun-color:${sunColor};--pv-leader-color:${pvColor};--pv-flow-duration:${pvFlowDuration}s"
                             @click="${(e: Event) => handleHomeClick(this, e)}"
                             @mouseenter="${this._onHomeEnter}"
                             @mouseleave="${this._onHomeLeave}">
                            ${silhouettePts.map(sil => sil === null ? nothing : svg`
                                <polygon class="home-glow-shape" points="${sil.base}" />
                                <polygon class="home-glow-shape" points="${sil.top}" />
                                ${sil.walls.map(w => svg`
                                    <polygon class="home-glow-shape" points="${w}" />
                                `)}
                            `)}
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
                        @click="${(e: Event) => handleHomeClick(this, e)}"
                        @mouseenter="${this._onHomeEnter}"
                        @mouseleave="${this._onHomeLeave}"
                    ></div>
                ` : nothing}

                <!--  Home pill: a small circular node painted exactly
                      at the projected home centre. Every chip leader
                      docks against its border so the cluster reads as
                      a single energy hub, the same vocabulary HA's
                      Energy distribution card uses for its central
                      home node.                                       -->
                ${hasApiKey && layout !== null && !this._detailMode ? html`
                    <!--  Solid drop-leader from the home pill DOWN to
                          the projected ground at the home (lat, lon).
                          Same vocabulary as the other home-anchored
                          leaders (stroke-width 2, round caps), painted
                          in the HA primary colour so it reads as the
                          family signature of the home cluster.        -->
                    <svg class="home-drop-leader-svg">
                        <line class="home-drop-leader-line"
                              x1="${layout!.home.x}" y1="${layout!.home.y + 14}"
                              x2="${layout!.home.x}" y2="${layout!.home.y + 60}" />
                    </svg>
                    <div
                        class="home-pill"
                        style="left:${layout!.home.x}px; top:${layout!.home.y}px"
                    >
                        <ha-icon icon="mdi:home"></ha-icon>
                    </div>
                ` : nothing}


                <!--  Detail dashboard overlay, takes over the card
                      while _detailMode is on. The CSS class
                      .detail-active on ha-card fades out every
                      pre-existing overlay so the panel reads as
                      the sole content while open. Dismissal goes
                      through a dedicated close button in the corner
                      rather than a content click, otherwise every
                      internal scroll / tap would close the panel.  -->
                ${this._detailMode ? renderDashboard(this) : nothing}

                <!--  Adaptive shading-dome overlay. SVG is full-card,
                      absolutely positioned, pointer-events disabled
                      so it never intercepts clicks meant for the
                      map. Fades in via inline opacity driven by the
                      fade RAF loop. The cloud-bin picker rides
                      flush against the top-right chip cluster so
                      the slice selector is right next to the chip
                      that opened the view.                          -->
                ${renderShadingDomeOverlay(this)}
                ${this._shadingDomeMode ? renderShadingDomeCloudPicker(this, (pct) => {
                    this._shadingDomeCloudPct = pct;
                    refreshShadingDomeScene(this);
                    this.requestUpdate();
                }) : nothing}
                ${renderLidarViewOpacityPicker(this, this._onLidarOpacityChange)}

            </ha-card>
        `;
    }


    //Per-card unique id used to namespace SVG <defs> ids so multiple Helios cards on the same dashboard don't clash on gradient / filter references.
    _instanceId = `h${Math.floor(Math.random() * 1e9).toString(36)}`;

    //Memoised parseBatteryBanks result, keyed on the config object identity. parseBatteryBanks walks the YAML, allocates a fresh array
    //and N objects, and re-trims every entity string on each call, expensive when the Lit render fires at 60-120 Hz during scrub.
    //Hass swaps the config reference whenever the user edits it, so identity equality is the right invalidation signal.
    private _cachedBatteryBanks?: BatteryBank[];
    private _cachedBatteryBanksCfg?: HeliosConfig;
    private _cachedBatteryBanksDefaults?: EnergyDefaults;
    private _getBatteryBanks(): BatteryBank[]
    {
        if (this.config !== this._cachedBatteryBanksCfg
            || this._energyDefaults !== this._cachedBatteryBanksDefaults
            || !this._cachedBatteryBanks)
        {
            this._cachedBatteryBanks         = effectiveBatteryBanks(this.config, this._energyDefaults);
            this._cachedBatteryBanksCfg      = this.config;
            this._cachedBatteryBanksDefaults = this._energyDefaults;
        }
        return this._cachedBatteryBanks;
    }

    //Hover handlers on the home hitbox. Toggle the sun-coloured glow halo around the home silhouette so the focal building reads as interactive
    //before the user clicks. Cleared on exit so the glow doesn't get stuck on if the cursor leaves while the detail overlay is fading in.
    private _onHomeEnter = (): void =>
    {
        this._homeHover = true;
    };
    private _onHomeLeave = (): void =>
    {
        this._homeHover = false;
    };

    //LiDAR opacity slider, rAF-coalesced. The native <input
    //type="range"> fires @input on every pointer step (up to ~50
    //Hz on hi-rate devices). Each call hit setLidarViewOpacity
    //which triggers a full MapLibre repaint, basemap tiles plus
    //building extrusions plus night-shade plus the LiDAR custom
    //layer. Coalescing to one rAF reduces the repaint storm to one
    //per frame at most, no perceived slider lag.
    private _pendingLidarOpacity: number | null = null;
    private _lidarOpacityRaf:     number       = 0;
    private _onLidarOpacityChange = (opacity: number): void =>
    {
        this._pendingLidarOpacity = opacity;
        if (this._lidarOpacityRaf) return;
        this._lidarOpacityRaf = requestAnimationFrame(() =>
        {
            this._lidarOpacityRaf = 0;
            const v = this._pendingLidarOpacity;
            if (v === null) return;
            this._lidarViewOpacity = v;
            this._engine?.setLidarViewOpacity(v);
        });
    };


    //Bound mode-bar handlers. Class fields rather than inline arrow
    //expressions inside render() so Lit sees a stable identity and
    //does not re-attach the four @click handlers on every render
    //cycle (template re-attach cost + closure allocation).
    private _onModeLayer = (): void =>
    {
        if (this._lidarViewMode)   toggleLidarView(this);
        if (this._shadingDomeMode) toggleShadingDome(this);
        //Cloud detail toggle is a simple ON/OFF, not a full-screen
        //mode: leaving it on while the user switches back to the
        //default layer keeps the 3 layer chips visible.
    };
    //Cloud cover detail toggle. ON reveals 3 chips (low / mid /
    //high) under the central cloud chip; OFF leaves only the
    //aggregate cloud chip. The aggregate chip itself doubles as the
    //toggle button (see render block + _onCloudChipToggle below).
    private _onCloudChipToggle = (): void =>
    {
        this._cloudDomeMode = !this._cloudDomeMode;
    };
    private _onModeLidar = (): void =>
    {
        if (this._shadingDomeMode) toggleShadingDome(this);
        //LiDAR and Shading replace the whole HUD; force the per-layer
        //cloud expansion back to OFF so the 3 layer chips don't leak
        //through. The aggregate cloud chip itself is already hidden
        //by the .cloud-dome-active CSS family.
        this._cloudDomeMode = false;
        if (!this._lidarViewMode)  toggleLidarView(this);
    };
    private _onModeShadingDome = (): void =>
    {
        if (this._lidarViewMode)   toggleLidarView(this);
        this._cloudDomeMode = false;
        if (!this._shadingDomeMode) toggleShadingDome(this);
    };

    static styles = heliosCardStyles;
}
