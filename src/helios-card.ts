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
import { darkenHex } from './card/format';
import
{
    refreshPv,
    currentPvRate,
    pvRateAtTime,
    pvNormalizeToWatts,
    pvCalibK,
    formatPvValue,
    resolvePvLiveEntity,
    clearPvModuleCaches
} from './card/pv';
import
{
    refreshBattery,
    batterySampleAtTime,
    formatBatteryPower,
    resolveBatteryEntities,
    clearBatteryModuleCaches
} from './card/battery';
import { refreshSolarRadiation, clearRadiationModuleCaches } from './card/radiation';
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
    handleHomeClick,
    handleDashGlobalKey
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
    onTimelinePointerUp
} from './card/timeline';
import { enterLidarView, exitLidarView, renderLidarViewOpacityPicker } from './card/lidar-view';
import type { CardMode } from './card/card-mode';
import { renderLoadingBanner, renderWeatherRateLimitBanner, type LoadingPhaseId, type LoadingPhaseState } from './card/loading-tracker';
import { refreshGrid, formatGridValue } from './card/grid';
import {
    subscribeEnergyPrefs,
    unsubscribeEnergyPrefs,
    refreshHaDailyTotals,
    EMPTY_ENERGY_DEFAULTS,
    type EnergyDefaults,
} from './card/energy-prefs';
import {
    renderWeatherOverlay,
    enterWeatherMode,
    exitWeatherMode,
    syncWeatherShaderState,
} from './card/weatherMode';
import { cloudCoverIcon, cloudLayerIcon } from './card/cloud-icons';
import { clearEnergyStatsCache, wattsAtFromChangeSeries } from './card/energy-stats';
import { refreshSkyForecast, clearSkyForecastCache } from './card/forecast-sky';
import { refreshTiltedIrradiance, clearGtiCache } from './card/gti';
import { buildUnifiedStore, isStoreFresh, valueAt, type UnifiedStoreHost } from './card/unifiedStore';
import
{
    computeConfigSig,
    getHomeCoords,
    initEngine,
    cancelPendingRespawn,
    initVisibilityObserver
} from './card/init';
//Side-effect import: registers <helios-card-editor> as a custom element.
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

//OVERWRITE rather than insert-if-missing. The previous insert-if-missing pattern protected against a
//double registration in the same page lifetime but also meant that a stale entry already pushed by
//some other code (HACS placeholder, dev-tools mock, an older Helios bundle on the same page) would
//keep the catalog showing whatever name + flags it had set. Overwriting lets the freshly-loaded
//bundle's metadata always win, so 'Helios' + preview: true land regardless of what was there
//before.
window.customCards = window.customCards || [];
{
    const heliosEntry =
    {
        type:        'helios-card',
        name:        _bootI18n.cardName,
        description: _bootI18n.cardDescription,
        preview:     true,
    };
    const existingIdx = window.customCards.findIndex(c => c.type === 'helios-card');
    if (existingIdx >= 0)
    {
        window.customCards[existingIdx] = heliosEntry;
    }
    else
    {
        window.customCards.push(heliosEntry);
    }
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
    for (const card of _liveCards)
    {
        card.resetDataCache();
    }
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
            for (const card of _liveCards)
            {
                card.invalidateLocation();
            }
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
            for (const card of _liveCards)
            {
                card.invalidateLocation();
            }
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
    //Photovoltaic production state, populated when the HA Energy dashboard exposes at least one solar source. Live value from hass.states +
    //historical series from HA's history API for the dedicated chart.
    @state() _pvCurrent: number | null = null;
    @state() _pvUnit:    string        = '';
    @state() _pvHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    //Per-entity histories preserved alongside `_pvHistory` so the chart can render one curve per source (the
    //feature LBDG_ asked for after the multi-source agg pass) and the scrub tooltip can show a per-entity
    //breakdown. Keyed by entity id; cleared + repopulated in `fetchPvHistory` on every fresh fetch.
    _pvHistoryPerEntity: Map<string, { times: Date[]; values: number[] }> = new Map();
    _pvFetchKey  = '';
    _pvFetching  = false;
    //Most recent PV history fetch outcome, surfaced via
    //`window.heliosStats()` (raw entries returned, samples kept after
    //unit / unavailable filtering, window covered in hours).
    _pvHistoryDiagnostics: { rawEntries: number; samples: number; windowH: number } | null = null;
    //Hourly long-term-statistics series feeding the 5-day forecast
    //calibration. Same shape as `_pvHistory` but populated via
    //`recorder/statistics_during_period`, ~120 rows for 5 days vs
    //potentially millions on the raw path for high-frequency
    //sensors. Null while the first fetch is in flight; consumers
    //(calibration.ts) degrade to `_pvHistory` when this is null or
    //empty.
    @state() _pvCalibStats: { times: Date[]; values: number[] } | null = null;
    _pvCalibStatsFetchKey  = '';
    _pvCalibStatsFetching  = false;
    //Recorder `change` series for the solar energy meter(s): the canonical past-production source for
    //the unified store + chip scrub. Reset-corrected, unit-normalised kWh per 5-minute bucket, the
    //same metric the HA Energy dashboard consumes. Replaces the client-side counter differentiation.
    @state() _pvChangeSeries: import('./card/energy-stats').ChangeBucket[] | null = null;
    _pvChangeSeriesFetchKey  = '';
    _pvChangeSeriesFetching  = false;
    //Learned sky-residual forecast correction. The two histories (60-day hourly production from the
    //recorder, 60-day hourly cloud from Open-Meteo) feed buildSkyResidualMap; the resulting map
    //multiplies the forecast per sun position so it converges to the user's real shading + biases.
    @state() _skyResidualMap: import('./card/forecast-sky').SkyResidualMap | null = null;
    _skyProdSeries:    import('./card/energy-stats').ChangeBucket[] | null = null;
    _skyProdFetchKey   = '';
    _skyProdFetching   = false;
    _skyCloudTimes:    number[] = [];
    _skyCloud:         number[] = [];
    _skyShortwave:     number[] = [];
    _skyDirect:        number[] = [];
    _skyDiffuse:       number[] = [];
    _skyTemp:          number[] = [];
    _skyWind:          number[] = [];
    _skySnow:          number[] = [];
    _skySoc:           import('./card/energy-stats').MeanBucket[] | null = null;
    _skySocFetchKey    = '';
    _skySocFetching    = false;
    //Per-orientation Open-Meteo GTI store (src/card/gti.ts). Shared by the forecast + the 60-day
    //learning so both transpose on the same anisotropic POA. Not @state: read directly when the store
    //rebuilds, the requestUpdate inside refreshTiltedIrradiance drives the re-render.
    _gtiStore:         import('./card/gti').GtiStore | null = null;
    _gtiFetchKey       = '';
    _gtiFetching       = false;
    _skyCloudFetchKey  = '';
    _skyCloudFetching  = false;
    _skyMapVersion     = '';
    //Home-battery state, populated when the HA Energy dashboard exposes at least one battery source (`stat_rate`,
    //`stat_energy_from`, `stat_energy_to` or `stat_soc`). Live readings; historical series lives in the *History fields
    //below. Units are kept alongside the values so the chip can format kW vs W without re-reading the state.
    @state() _batterySoc:        number | null = null;
    @state() _batteryPower:      number | null = null;
    @state() _batteryPowerUnit:  string        = '';
    //Grid import / export live values, populated by refreshGrid() from the HA Energy dashboard grid source's
    //`stat_energy_from` (import) and `stat_energy_to` (export) slots. Unit is captured alongside the value so the chip
    //formats the correct W / kWh / m³ suffix without re-reading hass.states.
    @state() _gridImportValue:   number | null = null;
    @state() _gridImportUnit:    string        = '';
    @state() _gridExportValue:   number | null = null;
    @state() _gridExportUnit:    string        = '';
    //Recorder `change` series for the grid import / export energy meters: the canonical past-power
    //source for the unified store + scrub. Reset-corrected, unit-normalised kWh per 5-minute bucket,
    //the same metric the HA Energy dashboard consumes. Replaces the per-entity rolling slope buffers.
    @state() _gridImportChangeSeries: import('./card/energy-stats').ChangeBucket[] | null = null;
    @state() _gridExportChangeSeries: import('./card/energy-stats').ChangeBucket[] | null = null;
    _gridImportChangeFetchKey = '';
    _gridExportChangeFetchKey = '';
    _gridImportChangeFetching = false;
    _gridExportChangeFetching = false;
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
    //Recorder `change` series for the battery charge (stat_energy_to) + discharge (stat_energy_from)
    //meters: the canonical past-power source for the unified store + scrub. Net (charge - discharge)
    //gives a structural sign so charging is never lost (#216).
    @state() _batteryChargeChangeSeries:    import('./card/energy-stats').ChangeBucket[] | null = null;
    @state() _batteryDischargeChangeSeries: import('./card/energy-stats').ChangeBucket[] | null = null;
    _batteryChangeFetchKey = '';
    _batteryChangeFetching = false;
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
    //HA Energy daily-total alignment cache populated by `refreshHaDailyTotals()` against the recorder. Five headline
    //figures: PV produced today, grid imported today, grid exported today, battery charged today, battery discharged
    //today. Null while no HA stat is configured or the recorder call has not yet landed, the consumer chips collapse
    //silently in that case (the refonte dropped every local-integration fallback).
    @state() _haSolarTodayKwh:        number | null = null;
    @state() _haGridImportTodayKwh:   number | null = null;
    @state() _haGridExportTodayKwh:   number | null = null;
    @state() _haBatteryChargedKwh:    number | null = null;
    @state() _haBatteryDischargedKwh: number | null = null;
    //Projected screen-space positions of each configured PV array
    //marker. Refreshed on every map transform via projectPvArray
    //Markers(); the SVG overlay renders one lollipop per entry.
    //Hover state on the home hitbox. Drives a sun-coloured glow halo around the home silhouette so the user reads the focal building as interactive
    //before clicking.
    @state() _homeHover = false;
    //Hover state for the radial dial in the dashboard. Hour fraction in [0..24) when the cursor sits
    //over the SVG, null otherwise. Front card only, the rear cards never wire pointer handlers.
    @state() _dashRadialHoverHour: number | null = null;
    //Mouse wheel accumulator for the dashboard radial dial day-navigation gesture. Not a @state on
    //purpose: every wheel event mutates this slot and a @state would re-render on every tick.
    _dashRadialWheelAcc: number = 0;
    //Hover position on the timeline chart cards, expressed as a
    //percent of the visible time range. Null when the pointer is
    //outside the cards; drives the hover guide line, the per-curve
    //dots and the tooltip chip rendered above the cards.
    @state() _chartHoverPct: number | null = null;
    @state() _chartSeries: {
        times:        Date[];
        irradiance:   number[];
        cloud:        number[];
        //Hourly horizontal beam + diffuse radiation in W/m², -1 where the model didn't decompose. Feed the PV tilt transposition's direct / diffuse split.
        directRad:    number[];
        diffuseRad:   number[];
        //Hourly ground snow depth in metres, NaN where unknown. Feeds the winter snow-cover derate.
        snowDepth:    number[];
        //Hourly ambient temperature in °C + wind speed in m/s, NaN-padded where the model didn't return a value. Both arrays mirror the `times`
        //length and feed the PV prediction's thermal-derating term.
        temperature:  number[];
        windSpeed:    number[];
    } | null = null;
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

    //True while the Open-Meteo home-point fetch is stuck in HTTP 429 back-off. Driven by the
    //engine's onWeatherRateLimitChange callback (wired in init.ts). Flips back to false the
    //moment the next refresh tick succeeds; in the meantime the alert banner under the loading
    //banner tells the user why the weather data is not updating.
    @state() _weatherRateLimited = false;

    //Per-band visibility flags for the weather-mode SVG cloud overlay. The three chips under
    //the mode-bar double as toggle buttons: tapping a chip flips its flag, which gates the
    //matching `<g>` band's render output in renderWeatherOverlay. Default all-on so the user
    //sees every layer the moment they enter weather mode; flags reset on every mode entry.
    @state() _weatherShowHigh = true;
    @state() _weatherShowMid  = true;
    @state() _weatherShowLow  = true;

    //Flag flipped by `fetchEnergyPrefs` after the first parse lands. The card uses it to kick `refreshHaDailyTotals`
    //immediately when the HA Energy defaults snapshot first appears, instead of waiting up to 30 s for the next
    //tick. Boot-time loading overlay is gone (the raw 6 h `history/history_during_period` fetch, which was the
    //heavy round-trip the overlay was waiting on, is also gone, so the visible boot delay is now sub-second and
    //the overlay was just flashing for nothing).
    _energyDefaultsLoaded   = false;
    private _dailyTotalsKicked = false;
    //Loading-tracker state. _loadingPhases maps each registered phase id to its progress (started /
    //done). _loadingHasCompleted latches once every started phase reaches done for the FIRST time,
    //after that the banner stays hidden for the rest of the card lifetime so routine background
    //refreshes do not flash the "Fetching data..." card up again. See src/card/loading-tracker.ts
    //for the helpers that mutate these.
    @state() _loadingPhases:       ReadonlyMap<LoadingPhaseId, LoadingPhaseState> = new Map();
    @state() _loadingHasCompleted: boolean = false;
    //True while the home is "focused": the existing overlay HUD is
    //hidden, the camera is eased to a closer / more pitched pose,
    //and a detail dashboard panel takes over. Toggled by clicking
    //the home hitbox (off → on) or clicking anywhere on the panel
    //(on → off). Engine.setDetailMode drives the camera lerp;
    //CSS class .detail-active on ha-card fades out every overlay.
    @state() _detailMode    = false;
    //CoverFlow active day offset (0 = today, ±1 = ±1 day, etc.). Reset to 0 every time the dashboard opens via
    //`handleHomeClick`. Swipe gesture state captured between pointerdown / pointerup so the dashboard renderer
    //can navigate the stack without a stateful child component.
    @state() _dashDayOffset:        number       = 0;
    _dashSwipeStartX:               number | null = null;
    _dashSwipeStartTime:            number       = 0;
    //Enter / exit animation phase. Lasts 1 s; controls a class on the stage that drives the staged keyframe
    //animations per card.
    @state() _dashAnimPhase:        'idle' | 'entering' | 'exiting' = 'idle';
    _dashAnimTimer?:                number;
    //Shared view mode across every CoverFlow card. Flipped from the bandeau toggle on the front card,
    //the change applies to every card simultaneously. Radial default surfaces the chip strip + sundial
    //layout; the graph alternative trades the dial for the multi-day production curve.
    @state() _dashViewMode:         'radial' | 'graph' = 'radial';
    //Unified 5-day data store. Populated after the initial weather + PV + battery + grid fetches
    //land, rebuilt every time any of those refresh, sliced / interpolated by the radial dial, the
    //graph view AND the main UI timeline. Live numeric chips deliberately stay on the direct
    //hass.states path: the store carries bucketed historical and forecast curves, the chips show
    //sample-accurate live values that would lose precision if forced through a 15 min bucket
    //aggregation.
    @state() _unifiedStore: import('./card/unifiedStore').UnifiedDataStore | null = null;
    //Single source of truth for which mode the card is in. Drives every transition (slider slide-in
    /// slide-out, chip + leader + arc fade, timeline slide, WebGL dot-cloud fade-in / out, Weather mode
    //SVG fade-in / out). Set imperatively by the mode-bar click handlers, reacted to by
    //_handleCardModeChange in updated() which kicks the engine fades and toggles the overlay mask.
    //Modes are mutually exclusive (the mode-bar lets the user pick exactly one).
    @state() _cardMode: CardMode = 'base';
    //True while the chips / leaders / arcs / timeline are masked behind a non-base mode. Decoupled
    //from _cardMode on the EXIT path so the HUD doesn't pop back through still-visible LiDAR dots: on
    //LiDAR -> base, the mask stays ON until the WebGL fade-out completes (the LiDAR fade loop sets it
    //to false on completion); on Weather -> base, the mask flips OFF immediately because the
    //weather raster is faint enough that the HUD chips reading through it during the fade is fine.
    @state() _overlayMaskActive = false;
    //WebGL dot-cloud lifecycle. Set true on lidar enter, the LiDAR fade loop flips it back to false on
    //fade-out completion. Decoupled from _cardMode so the engine layer keeps drawing dots during the
    //exit fade after the user already clicked away.
    _lidarLayerActive:    boolean = false;
    //Fade timestamps. On enter the dot cloud eases in from alpha 0 to 1 over LIDAR_FADE_IN_MS; on exit
    //it eases back out over LIDAR_FADE_OUT_MS, then engine.setLidarViewActive(false) tears the layer
    //down. Null when no fade is in flight.
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

    //Weather mode overlay lifecycle. Lets the cloud-cover canvas keep painting through its exit fade
    //after _cardMode already moved off 'weather'. Flipped to false by the weather fade loop on
    //fade-out completion. Same role as _lidarLayerActive for the LiDAR view.
    _weatherOverlayVisible: boolean = false;
    _weatherFadeInStartMs:  number | null = null;
    _weatherFadeOutStartMs: number | null = null;
    _weatherFadeRaf?:       number;


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

    //Arc-segment scratch buffers. The sun arc is split by altitude
    //(below-horizon goes BEHIND the chip cluster, above-horizon goes
    //in FRONT) on every render. Naive filter() pair allocated two
    //fresh arrays per cycle; the buffers below are reused in place,
    //length reset to zero on each render before being repopulated.
    private _arcBackBuf:      ArcSegment[] = [];
    private _arcFrontBuf:     ArcSegment[] = [];
    private _arcFrontNearBuf: ArcSegment[] = [];

    //Cached SVG point strings for the home silhouettes. The silhouette is a stable feature of
    //the (lon, lat, building shape) triple; the cache mirrors host._homeSilhouettes by reference
    //so a fresh array from refreshOverlays rebuilds the cache, and the same pre-built strings
    //come back untouched otherwise. Saves the Array.map + join per vertex on every render.
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
        this._warnIfLegacyEntityKeys(config);
    }

    //Retired YAML entity keys. The card reads these entirely from the HA Energy dashboard global settings; any value
    //still set on the card config is silently ignored at runtime. Detected here only so the user gets a one-shot
    //persistent notification telling them what was retired and where the replacement lives, instead of staring at a chip
    //that no longer reacts to the entity they wired.
    private static readonly _LEGACY_ENTITY_KEYS: ReadonlyArray<string> =
    [
        'pv-power-entity',
        'grid-import-entity',
        'grid-export-entity',
        'grid-power-entity',
        'grid-power-invert',
        'battery-soc-entity',
        'battery-power-entity',
        'battery-power-invert',
        'batteries',
    ];
    private _legacyKeyWarningFired = false;

    //Fire a one-shot HA persistent notification when the card YAML carries any of the keys the entity refonte retired.
    //Silent when none are present, when hass is not yet attached (Lit's setConfig can land before the hass property
    //setter), or when the persistent_notification service is denied for RBAC reasons. The flag prevents repeated
    //notifications on subsequent setConfig calls during the same card lifetime; HA dedupes by notification_id anyway,
    //the flag is a belt-and-braces.
    private _warnIfLegacyEntityKeys(config: HeliosConfig): void
    {
        if (this._legacyKeyWarningFired)
        {
            return;
        }
        if (!this.hass?.callService)
        {
            return;
        }
        const detected: string[] = [];
        for (const key of HeliosCard._LEGACY_ENTITY_KEYS)
        {
            const v = (config as Record<string, unknown>)[key];
            if (v !== undefined && v !== null && v !== '')
            {
                detected.push(key);
            }
        }
        if (detected.length === 0)
        {
            return;
        }
        this._legacyKeyWarningFired = true;
        const message =
              `The Helios card no longer reads its PV, grid and battery entities from the card YAML. `
            + `The following key${detected.length > 1 ? 's are' : ' is'} silently ignored: ${detected.map(k => '`' + k + '`').join(', ')}. `
            + `Helios now resolves these directly from the official Home Assistant Energy dashboard `
            + `(Settings → Dashboards → Energy → your sources). The PV install configuration (peak kWp, `
            + `panel tilt and azimuth via \`pv-arrays\`, optional inverter cap, LiDAR providers, visual options) `
            + `still lives in the card YAML, only the entity slots were retired.`;
        try
        {
            this.hass.callService('persistent_notification', 'create', {
                notification_id: 'helios-legacy-entity-config',
                title:           'Helios card: deprecated entity keys ignored',
                message,
            });
        }
        catch (_)
        {
            //Service call denied or unavailable; the chips still light up from the HA Energy resolution and the user
            //will eventually find the deprecation note via the CHANGELOG or the README.
        }
    }

    static getConfigElement(): HTMLElement
    {
        return document.createElement('helios-card-editor');
    }

    //Signature documented by HA's <hui-card-picker>: (hass, entities, entitiesFallback). HA calls this
    //in two situations:
    //  - 'All cards' / 'Toutes les cartes' tab: entities is empty, we return an empty stub config and
    //    the card falls back to hass.config.latitude / longitude at runtime (zone.home implicitly).
    //  - 'By entity' / 'Par entité' tab: HA passes the entity the user clicked. If a zone entity is in
    //    the list, we lift its latitude + longitude attributes into the card config as
    //    home-latitude / home-longitude so the catalog shows Helios as a card that can be created
    //    for that zone, with the lat / lon pre-filled. The card already supports the two override
    //    keys at runtime so no schema change is needed.
    //hass is loosely typed because the rest of the codebase types it as any (HA has no public types
    //package for this surface).
    static getStubConfig(hass?: { states?: Record<string, { attributes?: Record<string, unknown> }> }, entities?: string[]): HeliosConfig
    {
        if (hass && Array.isArray(entities) && entities.length > 0)
        {
            for (const entityId of entities)
            {
                if (typeof entityId !== 'string' || !entityId.startsWith('zone.'))
                {
                    continue;
                }
                const state = hass.states?.[entityId];
                const lat   = state?.attributes?.latitude;
                const lon   = state?.attributes?.longitude;
                if (typeof lat === 'number' && Number.isFinite(lat)
                 && typeof lon === 'number' && Number.isFinite(lon))
                {
                    return {
                        'home-latitude':  lat,
                        'home-longitude': lon,
                    };
                }
            }
        }
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
                if (k === 'home-latitude' || k === 'home-longitude')
                {
                    continue;
                }
                cfg[k] = v;
            }
        }
        return {
            config: cfg,
            engine: this._engine ? this._engine.getStatsSnapshot() : null,
            pv:
            {
                entityConfigured: resolvePvLiveEntity(this._energyDefaults) !== '',
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
        this._pvHistory                   = null;
        this._pvCalibStats                = null;
        this._pvChangeSeries              = null;
        this._pvChangeSeriesFetchKey      = '';
        this._skyResidualMap              = null;
        this._skyProdSeries               = null;
        this._skyProdFetchKey             = '';
        this._skyCloudTimes               = [];
        this._skyCloud                    = [];
        this._skyShortwave                = [];
        this._skyDirect                   = [];
        this._skyDiffuse                  = [];
        this._skyTemp                     = [];
        this._skyWind                     = [];
        this._skySnow                     = [];
        this._skySoc                      = null;
        this._skySocFetchKey              = '';
        this._gtiStore                    = null;
        this._gtiFetchKey                 = '';
        this._skyCloudFetchKey            = '';
        this._skyMapVersion               = '';
        this._pvFetchKey                  = '';
        this._pvCalibStatsFetchKey        = '';
        this._pvHistoryDiagnostics        = null;
        this._gridImportChangeSeries      = null;
        this._gridExportChangeSeries      = null;
        this._gridImportChangeFetchKey    = '';
        this._gridExportChangeFetchKey    = '';
        this._batterySocHistory           = null;
        this._batteryPowerHistory         = null;
        this._batteryFetchKey             = '';
        this._batteryChargeChangeSeries   = null;
        this._batteryDischargeChangeSeries = null;
        this._batteryChangeFetchKey       = '';
        this._solarRadiationHistory       = null;
        this._solarRadiationFetchKey      = '';
        //Drop the module-level caches too. Without these calls the per-LitElement state above is reset but the next refresh hits the
        //cross-mount cache and rehydrates the slot from the exact stale entry the user just asked to clear.
        clearPvModuleCaches();
        clearBatteryModuleCaches();
        clearRadiationModuleCaches();
        clearEnergyStatsCache();
        clearSkyForecastCache();
        clearGtiCache();
        //Engine-side: clears localStorage weather cache, drops the in-memory hourly snapshot and triggers a refetch.
        this._engine?.resetDataCache();
        //Reset the loading tracker so the user gets the same hydration feedback they saw at first boot.
        this._loadingPhases       = new Map();
        this._loadingHasCompleted = false;
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
    //(at section width 360 px). Default 12 columns x 8 rows = the
    //section editor's actual ceiling, and ALSO the minimum the card
    //will accept now: the CoverFlow needs the full editor width to fan
    //its five cards without overlap, and the bandeau + 2x2 stats grid
    //+ chart placeholder need the full 8 rows of height to render
    //readably. Resizing below that produced unreadable squished cards.
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
            rows:        8,
            columns:     12,
            min_rows:    8,
            max_rows:    24,
            min_columns: 12,
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

    //Bound document-level keydown reference so the listener can be added at connect time and removed at
    //disconnect time without leaking a fresh closure on every mount.
    private _onDashGlobalKey = (e: KeyboardEvent) => handleDashGlobalKey(this, e);

    public connectedCallback(): void
    {
        super.connectedCallback();
        _liveCards.add(this);
        this._connectedAt = performance.now();
        if (typeof document !== 'undefined')
        {
            document.addEventListener('keydown', this._onDashGlobalKey);
        }
        //Reset the daily-totals kickoff flag so a remount re-fires `refreshHaDailyTotals` the moment the HA Energy
        //defaults snapshot lands again. The early kickoff was the load-bearing piece of the previous boot overlay,
        //and it stays around as a perf win even after the overlay was removed.
        this._dailyTotalsKicked = false;
        tick(this);
        //30 s tick: the clock displays HH:MM only (seconds dropped),
        //the sun moves ~0.13° per refresh (visually smooth at that
        //cadence), and the live cursor on a 5-day timeline advances
        //~6 px per 30 s on a 1000 px wide chart. PV and battery live
        //readings update on hass state changes, not on this tick, so
        //they remain real-time regardless. Cuts the per-second wake-
        //ups by 30× compared to the previous 1 Hz cadence.
        this._timer = window.setInterval(() =>
        {
            tick(this);
            //Same 30 s cadence as the timeline clock tick refreshes
            //the HA Energy daily-total cache. The recorder query is a
            //single WS round-trip per non-empty entity list and the
            //result moves by single-watt-hour increments on real
            //installs, so 30 s is plenty fast for the headline to
            //track the dashboard tile without piling on WS traffic.
            refreshHaDailyTotals(this);
        }, 30_000);
        initVisibilityObserver(this);
        if (typeof document !== 'undefined')
        {
            document.addEventListener('visibilitychange', this._onPageVisibilityForTheme);
        }
        subscribeEnergyPrefs(this);
        //One-shot refresh at connect time so the headline lights up
        //on the first render rather than waiting up to 30 s for the
        //tick. The helper short-circuits when no HA stat is wired,
        //so a standalone install pays a no-op.
        refreshHaDailyTotals(this);
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
            document.removeEventListener('keydown', this._onDashGlobalKey);
        }
        unsubscribeEnergyPrefs(this);
        if (this._lidarFadeRaf !== undefined)
        {
            cancelAnimationFrame(this._lidarFadeRaf);
            this._lidarFadeRaf = undefined;
        }
        //Same treatment for the weather overlay fade and the dashboard count-up loops: both
        //self-resubmit via requestAnimationFrame and close over `this`, so a detached card would
        //otherwise keep ticking and calling requestUpdate() against the disconnected element.
        if (this._weatherFadeRaf !== undefined)
        {
            cancelAnimationFrame(this._weatherFadeRaf);
            this._weatherFadeRaf = undefined;
        }
        if (this._lidarOpacityRaf)
        {
            cancelAnimationFrame(this._lidarOpacityRaf);
            this._lidarOpacityRaf = 0;
            this._pendingLidarOpacity = null;
        }
        cancelPendingRespawn(this);
        if (this._connectSettleTimer !== undefined)
        {
            window.clearTimeout(this._connectSettleTimer);
            this._connectSettleTimer = undefined;
        }
        //Engine cleanup on disconnect. Home Assistant's editor preview pane destroys + re-creates the helios-card element on every
        //`config-changed` commit (`hui-card.ts:195`, the rebuild is hard-coded and no opt-out hook exists). We accept the cost of
        //allocating a fresh MapLibre + WebGL context per commit, which is the same trade-off apexcharts-card, mini-graph-card and
        //Mushroom make. The live dashboard tile is NOT recreated (`hui-card` takes the `_updateElement` branch when
        //`preview === false`), so the user-facing surface stays smooth.
        if (this._engine !== undefined)
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
        //Unified data store refresh. Walks the lengths of every underlying source and rebuilds the
        //store whenever any of them changed since the last build, so the radial dial + graph view +
        //timeline always read the latest data without needing per-consumer cache invalidation. Cheap
        //when nothing changed (one hash compare returns early), measurable but bounded when a real
        //refresh lands (~50 ms for a full 480 × 7 bucketization + forecast pass).
        this._maybeRebuildUnifiedStore();

        //Mode-transition state machine. When the user clicks a different mode on the mode-bar,
        //_onModeLayer / _onModeLidar / _onModeWeather set _cardMode directly; the click handler
        //does nothing else. The rest of the transition (engine fade-in / fade-out kick, overlay mask
        //flip) is centralised here so a single switch on _cardMode drives every side effect, and the
        //picker .is-active classes are decoupled from the WebGL / SVG fade timestamps so they animate
        //reliably on the same render as the mode flip.
        if (_changedProperties.has('_cardMode'))
        {
            const prev = (_changedProperties.get('_cardMode') as CardMode | undefined) ?? 'base';
            if (prev !== this._cardMode)
            {
                this._handleCardModeChange(prev, this._cardMode);
            }
        }

        //Weather mode: forward band-toggle + scrub changes to the shader layer without an SVG
        //rebuild. No-op unless the card is currently in weather mode and the layer is mounted.
        if (this._cardMode === 'weather'
            && (_changedProperties.has('_weatherShowLow')
             || _changedProperties.has('_weatherShowMid')
             || _changedProperties.has('_weatherShowHigh')
             || _changedProperties.has('_selectedTime')
             || _changedProperties.has('_isLiveMode')))
        {
            syncWeatherShaderState(this);
        }

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

        //Daily-totals kickoff: `refreshHaDailyTotals` at connectedCallback time is a no-op because the parsed HA
        //Energy defaults have not landed yet (`subscribeEnergyPrefs` is async). The 30 s tick is too far in the
        //future for the user-perceived first paint, so the moment we see `_energyDefaultsLoaded` flip true here we
        //fire one immediate refresh so the three `*_today` slots land before the user has a chance to notice. The
        //flag prevents a second fire on subsequent cycles.
        if (this._energyDefaultsLoaded && !this._dailyTotalsKicked)
        {
            this._dailyTotalsKicked = true;
            refreshHaDailyTotals(this);
        }

        //Toggle the is-scrollable class on the FRONT CoverFlow card after each render so the bottom-fade
        //mask only shows when the card actually overflows. Done here rather than inside the render
        //function because Lit's render path runs before layout, scrollHeight/clientHeight are only valid
        //after the browser has flushed layout.
        if (this._detailMode)
        {
            const front = this.shadowRoot?.querySelector('.dash-cf-card-front') as HTMLElement | null;
            if (front)
            {
                const overflows = front.scrollHeight > front.clientHeight + 1;
                front.classList.toggle('is-scrollable', overflows);
            }
        }

        if (!this.hass?.config || !this.config)
        {
            return;
        }

        const coords = getHomeCoords(this.config, this.hass);
        if (!coords)
        {
            return;
        }

        const { lat, lon } = coords;

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
            if (!this.isConnected)
            {
                return;
            }
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
                    if (!this.isConnected)
                    {
                        return;
                    }
                    this.requestUpdate();
                }, CONNECT_SETTLE_MS - sinceConnect + 16);
                return;
            }
            //Reset mode flags on identity change. Mode state lives on the card (`_cardMode`,
            //`_detailMode`) and survives the engine respawn, but the engine's corresponding active
            //flags reset to false on every fresh instance. Without this reset, a card that was in
            //LiDAR mode at the previous home would carry the `is-on` chrome over to the new home while
            //the new engine quietly skips the LiDAR fetch, the user then clicks the LiDAR button
            //expecting a refresh and instead toggles the view off because the card-side flag was
            //already "on". Resetting to defaults forces a clean re-enter when the user clicks the mode
            //they want at the new location.
            if (identityChanged)
            {
                this._cardMode           = 'base';
                this._overlayMaskActive  = false;
                this._lidarLayerActive   = false;
                this._weatherOverlayVisible = false;
                this._detailMode         = false;
                //New home means a fresh hydration wave, surface the loading banner again.
                this._loadingPhases       = new Map();
                this._loadingHasCompleted = false;
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

        //Refresh chain gate: the per-entity refresh helpers read hass.states + config and are
        //pure functions of those two inputs plus the live time range. Lit calls updated() on
        //every @state mutation (every overlay reprojection during auto-rotate fires updated()
        //again), so without this gate the chain re-runs at 60+ Hz for zero new data. Skip it
        //when neither hass nor config moved since the previous pass.
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
        //Background forecast refinements (per-orientation GTI, 60-day cloud + production history). These
        //are DEFERRED until the critical engine weather has landed (_chartSeries populated). At load
        //several api.open-meteo.com requests would otherwise fire at once and, against the browser's
        //~6-connection-per-host limit plus Open-Meteo's rate limits, could starve or 429 the weather
        //fetch itself, leaving the card with no weather and no forecast. Weather first, refinements after.
        //onWeatherUpdate moves _timeRange when it lands, which re-trips this refresh chain, so the gated
        //fetches fire on the very next pass once weather is in.
        const skyCoords = getHomeCoords(this.config, this.hass);
        const weatherReady = (this._chartSeries?.times.length ?? 0) > 0;
        if (skyCoords && weatherReady)
        {
            //GTI must refresh before the sky map rebuilds: the learning reads _gtiStore, so landing it
            //first means the very next maybeRebuildSkyMap picks up the anisotropic POA in the same pass.
            refreshTiltedIrradiance(this, skyCoords.lat, skyCoords.lon);
            refreshSkyForecast(this, skyCoords.lat, skyCoords.lon);
        }
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
            if (!bg)
            {
                return false;
            }
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
        if (this._silhouetteCacheKey === sils)
        {
            return this._silhouettePtsCache;
        }

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
        //Precondition for rendering the live card chrome: home coordinates resolved (HA config or the
        //card-level lat / lon override). The basemap itself is OpenFreeMap and needs no credentials,
        //so this flag is purely about "do we have what we need to project the home onto the map".
        const hasHomeCoords = getHomeCoords(this.config, this.hass) !== null;


        //Always-visible cloud-cover percentage label, overlaid in HTML
        //above the home marker, with an SVG leader line tying it to
        //the on-ground 100 % ring. Both anchors come pre-projected
        //from the engine, see HeliosEngine.projectHomeLabelLayout().
        //The label is suppressed until both the layout (map ready)
        //and a cloud-cover value (data ready) are available.
        const layout         = this._labelLayout;

        //Photovoltaic production chip, pinned above the home, tinted in the configured production colour and tied to the home with an animated leader
        //line whose dashes flow from the house up to the chip. Only renders when the HA Energy dashboard exposes a solar source and the live state
        //read produced a finite numeric value.
        const pvEntityId   = resolvePvLiveEntity(this._energyDefaults);
        //DEFAULT_PV_COLOR_HEX matches the HA Energy palette's solar token; inline SVG attributes that
        //need a literal hex (rather than a CSS var) read it directly so the rendered colour stays in
        //sync with the CSS rules that consume the same token.
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

        //Predicted PV at the scrub instant when scrubbing into the future. Reads the unified store's
        //corrected forecast at that instant, the exact series the dotted timeline curve draws and the
        //dashboard "affiné" headline integrates, so the chip never disagrees with the line it sits on.
        //Stays null (chip hidden) when the store isn't built or the instant has no forecast.
        let pvPredictedRate: { value: number; unit: string } | null = null;
        if (pvScrubFuture && pvEntityId !== '' && layout !== null && this._unifiedStore)
        {
            const w = valueAt(this._unifiedStore.forecast, this._unifiedStore, this._selectedTime!.getTime());
            if (w !== null && w > 0)
            {
                pvPredictedRate = { value: w, unit: 'W' };
            }
        }

        const isPvPredicted = pvScrubFuture && pvPredictedRate !== null;
        const pvActiveRate  = isPvPredicted ? pvPredictedRate : pvRate;

        const showPvLabel = hasHomeCoords
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
        //Chip eligibility comes off the HA Energy defaults: a SoC source (`stat_soc`) lights the SoC chip, a power source (`stat_rate`,
        //or `stat_energy_from` / `stat_energy_to` when the source did not declare a power_config block) lights the Power chip. The
        //chips render independently so a SoC-only install still gets the vessel painted.
        const batteryEntities    = resolveBatteryEntities(this._energyDefaults);
        const hasAnyBankSoc      = batteryEntities.socEntity   !== null;
        const hasAnyBankPower    = batteryEntities.powerEntity !== null;
        const batteryScrubbing   = !this._isLiveMode && this._selectedTime !== null;
        const batteryScrubFuture = batteryScrubbing
            && this._selectedTime!.getTime() > Date.now() + 60_000;

        //Grid IN / OUT past-scrub: read the average watts at the scrub instant from the recorder
        //`change` series so the chip reflects what flowed at that moment, not live now. Skip in
        //future scrub (no data) and in live mode (live values already in _gridImportValue /
        //_gridExportValue).
        const gridScrubTimeMs = batteryScrubbing && !batteryScrubFuture
            ? this._selectedTime!.getTime()
            : null;
        const rawImport = gridScrubTimeMs !== null
            ? wattsAtFromChangeSeries(this._gridImportChangeSeries, gridScrubTimeMs)
            : this._gridImportValue;
        const rawExport = gridScrubTimeMs !== null
            ? wattsAtFromChangeSeries(this._gridExportChangeSeries, gridScrubTimeMs)
            : this._gridExportValue;
        const gridImportDisplayWatts = rawImport === null ? null : Math.max(0, rawImport);
        const gridExportDisplayWatts = rawExport === null ? null : Math.max(0, rawExport);
        const gridImportDisplayUnit = gridScrubTimeMs !== null ? 'W' : this._gridImportUnit;
        const gridExportDisplayUnit = gridScrubTimeMs !== null ? 'W' : this._gridExportUnit;

        //Active SoC / power values for this render, historical samples in scrub mode, live state otherwise.
        const activeBatterySoc: number | null = batteryScrubbing
            ? batterySampleAtTime(this._batterySocHistory, this._selectedTime!)
            : this._batterySoc;
        //Battery power scrub: net the charge / discharge `change` series at the scrub instant
        //(charge - discharge), structural sign. Live mode reads the live signed value.
        let activeBatteryPower: number | null;
        if (batteryScrubbing)
        {
            const tMs = this._selectedTime!.getTime();
            const c   = wattsAtFromChangeSeries(this._batteryChargeChangeSeries, tMs);
            const d   = wattsAtFromChangeSeries(this._batteryDischargeChangeSeries, tMs);
            activeBatteryPower = (c === null && d === null)
                ? null
                : Math.max(0, c ?? 0) - Math.max(0, d ?? 0);
        }
        else
        {
            activeBatteryPower = this._batteryPower;
        }
        //The power unit is watts on both the live and scrub paths (the change series resolves to W,
        //the live read normalises to W), so the chip formats consistently regardless of mode.
        const activeBatteryUnit = batteryScrubbing ? 'W' : this._batteryPowerUnit;

        const showSocChip = (hasHomeCoords && layout !== null)
            && !batteryScrubFuture
            && hasAnyBankSoc
            && activeBatterySoc !== null;
        const showPowerChip = (hasHomeCoords && layout !== null)
            && !batteryScrubFuture
            && hasAnyBankPower
            && activeBatteryPower !== null;

        const batterySocText = showSocChip
            ? `${Math.round(activeBatterySoc!)} %`
            : '';
        //Chip value uses HA's Energy Sources sign convention: discharge positive (the battery
        //supplies power), charge negative (it consumes / stores). `activeBatteryPower` is the
        //physical charge-positive net, so negate it for the displayed sign. The colour + leader flow
        //below stay on the physical value so charging still reads pink + flows INTO the battery.
        const batteryPowerText = showPowerChip
            ? formatBatteryPower(this.hass, -activeBatteryPower!, activeBatteryUnit)
            : '';

        //Charging / discharging direction drives the SVG arrow path direction on the PV↔Power
        //leader, off the PHYSICAL sign (positive = charging). Charging: arrow flows PV → Power
        //(energy moving INTO the battery), dashes at a speed proportional to |P| saturating at the
        //same ~5 kW threshold as the PV leader. The dual-tone leader colour tracks the physical
        //direction too (battery-in tint charging, battery-out tint discharging), independent of the
        //HA-sign flip applied to the chip text above.
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
            if (!layout)
            {
                return '';
            }
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
        const showSun   = hasHomeCoords && sunScene !== null && sunScene.arc.length >= 2;

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
            if (s.belowHorizon)
            {
                arcSegmentsBack.push(s);
            }
            else if (s.nearness >= 0.50)
            {
                arcSegmentsFrontNear.push(s);
            }
            else
            {
                arcSegmentsFrontFar.push(s);
            }
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
        //ha-card classes: theme + detail (dashboard dive) + one mode-* class derived directly from
        //_cardMode + an overlay-masked class for the chip / leader / arc / timeline hide rules. The
        //mask LAGS the _cardMode flip on lidar -> base so the HUD does not pop back through the still-
        //visible dot cloud (see _handleCardModeChange + the LiDAR fade loop completion handler), AND
        //is unconditionally ON while detail mode is on so the same chip + timeline transitions fire
        //when the user opens / closes the dashboard via a home click. The weather mode is an
        //exception: chips / leaders / arcs hide but the BOTTOM TIMELINE STAYS VISIBLE so the user
        //can scrub through the day and the weather overlay tracks the cursor. CSS opts the timeline
        //out of the mask via a `mode-weather` exception (see helios-card-css.ts).
        const overlayMasked = this._overlayMaskActive || this._detailMode;
        //camera-locked drives the CSS rule that swaps the MapLibre grab cursor for the default
        //arrow when the user has the camera pinned: drag pan + rotate are both disabled in that
        //state so the open-hand cursor was misleading. Re-evaluated every render so the cursor
        //flips the moment the user toggles the lock chip.
        const cameraLocked = this._isCameraLocked();
        const cardClasses = [
            cardThemeClass,
            this._detailMode  ? 'detail-active'  : '',
            `mode-${this._cardMode}`,
            overlayMasked     ? 'overlay-masked' : '',
            cameraLocked      ? 'camera-locked'  : '',
        ].filter(Boolean).join(' ');

        return html`
            <ha-card class="${cardClasses}">

                <div id="map-container"></div>

                ${renderLoadingBanner(this)}
                ${renderWeatherRateLimitBanner(this)}

                ${hasHomeCoords && this._timeRange ? html`
                    <div
                        class="time-bar"
                        @pointerdown="${(e: PointerEvent) => onTimelinePointerDown(this, e)}"
                    >
                        <!--  Optional PV production graph, only
                              rendered when the HA Energy dashboard
                              exposes a solar source. Same chip
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

                        <!--  Chart card: hosts the area chart, the dotted day separators, the
                              night-zone diagonal hatch overlay (one rect per sunset, next
                              sunrise window) and the live + scrub cursors as HTML overlays.
                              Day-label chip row sits as a sibling block below so the chips
                              never cover the curves they describe.  -->
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
                ${hasHomeCoords ? (() => {
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
                                           || (this._cardMode === 'lidar' && this._lidarExposureBusy));
                    const lidarReady   = hasProvider && (isLocal || !this._shadowBusy);
                    const lidarIcon   = !hasProvider ? 'mdi:cloud-off-outline'
                                       : lidarLoading ? 'mdi:loading'
                                       : isLocal      ? 'mdi:harddisk'
                                                      : 'mdi:satellite-variant';
                    const lidarTitle  = !hasProvider ? 'No LiDAR coverage at this location'
                                       : lidarLoading ? 'LiDAR view, loading shadows...'
                                       : isLocal      ? 'LiDAR view, local nDSM'
                                                      : 'LiDAR view, online provider';
                    //Cloud mode is a soft per-layer reveal, not a mutually-exclusive view mode: it does NOT replace the
                    //default Layer UI, the user can keep the layer on AND inspect the cloud breakdown. So the Layer
                    //button stays lit while the cloud chips are revealed.
                    const isLayer    = this._cardMode === 'base';
                    const isLidar    = this._cardMode === 'lidar';
                    const isWeather  = this._cardMode === 'weather';
                    //modeLocked is true while a LiDAR exposure sweep is in flight (sun crossed
                    //the 1.5 deg refresh gate, or the user just entered the mode). It gates the
                    //LiDAR button's `?disabled` so the user does not stack a second sweep on top
                    //of one already running, but the Layer + Weather EXIT buttons stay fully
                    //enabled: the user must always be able to leave the mode, even mid-sweep.
                    //
                    //Root cause of the long-running "stuck in LiDAR after touching the opacity
                    //slider" report: when ?disabled was wired on the Layer / Weather buttons
                    //too, the browser silently ignored every @click on them as soon as the
                    //atmosphere refresh timer kicked an exposure sweep (~every few minutes of
                    //solar motion). The user's slider drag was a red herring; the timer was
                    //firing in the background and locking the exit buttons. Dropping ?disabled
                    //on the exits lets the click always land; the exit fade + the engine's
                    //setLidarViewActive(false) cancel the in-flight sweep on the way out.
                    const modeLocked = isLidar && this._lidarExposureBusy;
                    //Mode-bar click handlers bound once as class fields
                    //(see _onModeLayer etc.) so Lit does not see a fresh
                    //closure identity on every render and re-attach the
                    //@click handler four times per cycle.
                    const onLidar    = (lidarReady && !modeLocked) ? this._onModeLidar   : undefined;
                    const onLayer    = this._onModeLayer;
                    const onWeather  = this._onModeWeather;
                    //Live cloud-cover icon for the cloud-dome button:
                    //sun, partly-cloudy, cloudy or pouring depending on
                    //the current home reading. The user reads the sky
                    //state at a glance without opening the dome.
                    //Camera lock chip sits top-left. Tapping the chip flips the lock state and asks the engine to persist the new
                    //pose (bearing + pitch + lock flag) to localStorage so the next reload restores it. No tooltip, no title, no
                    //localised label, the open/closed padlock glyph already carries the meaning and a tooltip on a touchscreen is
                    //useless.
                    const cameraLocked  = this._isCameraLocked();
                    const lockIcon      = cameraLocked ? 'mdi:lock' : 'mdi:lock-open-variant';
                    //Lock button is hidden entirely in weather mode: the engine force-locks the
                    //camera on weather-mode enter to keep the top-down satellite view framed, so
                    //the toggle would have no effect anyway. The pre-enter state is restored on
                    //exit, so the button returning when the user leaves weather mode shows the
                    //right state.
                    return html`
                        <div class="overlay-top-left">
                            ${isWeather ? nothing : html`
                                <button
                                    type="button"
                                    class="camera-lock-btn ${cameraLocked ? 'is-on' : ''}"
                                    aria-pressed="${cameraLocked ? 'true' : 'false'}"
                                    @click="${this._onCameraLockToggle}"
                                >
                                    <ha-icon icon="${lockIcon}"></ha-icon>
                                </button>
                            `}
                            ${isWeather ? html`
                                <!--  Per-altitude cloud band toggles. Same visual recipe as the mode bar in the top-
                                      right corner: vertical column of identical 40 px round icon-only buttons sharing
                                      the .mode-bar-seg style. State does not persist across mode entries,
                                      enterWeatherMode resets all three to ON so the user always lands on a complete
                                      view of every band the first time the mode opens.                                -->
                                <div class="mode-bar" role="group" aria-label="Cloud band toggles">
                                    <button
                                        type="button"
                                        class="mode-bar-seg ${this._weatherShowHigh ? 'is-on' : ''}"
                                        aria-pressed="${this._weatherShowHigh ? 'true' : 'false'}"
                                        aria-label="Toggle high cloud layer"
                                        @click="${() => { this._weatherShowHigh = !this._weatherShowHigh; }}"
                                    >
                                        <ha-icon icon="${cloudLayerIcon('high')}"></ha-icon>
                                    </button>
                                    <button
                                        type="button"
                                        class="mode-bar-seg ${this._weatherShowMid ? 'is-on' : ''}"
                                        aria-pressed="${this._weatherShowMid ? 'true' : 'false'}"
                                        aria-label="Toggle mid cloud layer"
                                        @click="${() => { this._weatherShowMid = !this._weatherShowMid; }}"
                                    >
                                        <ha-icon icon="${cloudLayerIcon('mid')}"></ha-icon>
                                    </button>
                                    <button
                                        type="button"
                                        class="mode-bar-seg ${this._weatherShowLow ? 'is-on' : ''}"
                                        aria-pressed="${this._weatherShowLow ? 'true' : 'false'}"
                                        aria-label="Toggle low cloud layer"
                                        @click="${() => { this._weatherShowLow = !this._weatherShowLow; }}"
                                    >
                                        <ha-icon icon="${cloudLayerIcon('low')}"></ha-icon>
                                    </button>
                                </div>
                            ` : nothing}
                        </div>
                        <div class="overlay-top-right">
                            <div class="mode-bar" role="radiogroup" aria-label="View mode">
                                <button
                                    type="button"
                                    class="mode-bar-seg ${isLayer ? 'is-on' : ''}"
                                    role="radio"
                                    aria-checked="${isLayer ? 'true' : 'false'}"
                                    aria-label="Default layer UI"
                                    @click="${onLayer}"
                                >
                                    <ha-icon icon="mdi:home"></ha-icon>
                                </button>
                                <button
                                    type="button"
                                    class="mode-bar-seg ${isLidar ? 'is-on' : ''} ${(!lidarReady || modeLocked) ? 'is-disabled' : ''} ${lidarLoading ? 'is-loading' : ''}"
                                    role="radio"
                                    aria-checked="${isLidar ? 'true' : 'false'}"
                                    ?disabled="${!lidarReady || modeLocked}"
                                    aria-label="${lidarTitle}"
                                    @click="${onLidar}"
                                >
                                    <ha-icon class="${lidarLoading ? 'is-spinning' : ''}" icon="${lidarIcon}"></ha-icon>
                                </button>
                                <button
                                    type="button"
                                    class="mode-bar-seg ${isWeather ? 'is-on' : ''}"
                                    role="radio"
                                    aria-checked="${isWeather ? 'true' : 'false'}"
                                    aria-label="Weather view"
                                    @click="${onWeather}"
                                >
                                    <ha-icon icon="${cloudCoverIcon(this._cloudCover)}"></ha-icon>
                                </button>
                            </div>
                        </div>
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
                                r="3"
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
                                    r="3"
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
                ${hasHomeCoords && layout !== null && gridImportDisplayWatts !== null && !batteryScrubFuture ? html`
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
                            <circle class="grid-import-leader-bead" r="3">
                                <animateMotion dur="${gridImportBeadDur.toFixed(2)}s" repeatCount="indefinite"
                                               path="${gridImportLeaderPath}" />
                            </circle>
                        ` : nothing}
                    </svg>
                    <div
                        class="grid-import-label"
                        style="left:${layout!.gridImportLabel.x}px; top:${layout!.gridImportLabel.y}px"
                    >
                        <ha-icon icon="mdi:transmission-tower-export"></ha-icon>
                        <span>${formatGridValue(gridImportDisplayWatts, gridImportDisplayUnit)}</span>
                    </div>
                ` : nothing}
                ${hasHomeCoords && layout !== null && gridExportDisplayWatts !== null && !batteryScrubFuture ? html`
                    <svg class="grid-leader-svg">
                        <path class="grid-export-leader-line" d="${gridExportLeaderPath}" />
                        <!--  Export bead: travels FROM the home OUT to
                              the grid chip, matching the semantic
                              direction (energy leaving the home).
                              keyPoints 1->0 reverses the animateMotion
                              traversal so the bead starts at the home
                              end of the path and ends at the chip.  -->
                        ${gridExportBeadDur !== null ? svg`
                            <circle class="grid-export-leader-bead" r="3">
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
                        <ha-icon icon="mdi:transmission-tower-import"></ha-icon>
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
                            r="3"
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
                            //Scale the disc + halo with the same ramp the
                            //sun arc consumes engine-side. Without this
                            //the disc stays at its grid-tuned pixel size
                            //while the arc grows on a fullscreen canvas,
                            //the sun reads as a tiny dot on a gigantic
                            //curve. Multiplying here keeps the disc-to-arc
                            //ratio constant across canvas sizes; at
                            //standard Lovelace grid sizes the scale is
                            //1.0 and the disc keeps its current size.
                            const sunArcScale = this._engine?.getSunArcScale() ?? 1;
                            const r = (HeliosCard.SUN_R_FAR
                                    + (HeliosCard.SUN_R_NEAR - HeliosCard.SUN_R_FAR) * sunScene!.sun.nearness)
                                    * sunArcScale;
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
                ${hasHomeCoords && this._homeSilhouettes.length > 0 && !this._detailMode ? (() => {
                    const sunColor = DEFAULT_SUN_COLOR_HEX;
                    const silhouettePts = this._getSilhouettePoints();
                    //Static hover-only halo. The earlier pulse-on-bead-
                    //arrival was carving a hot spot on the home
                    //silhouette that competed with the steady HA-Energy-
                    //blue identity and was hard to read against the
                    //cloud-cover wash.
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
                ${hasHomeCoords && layout !== null && !this._detailMode ? html`
                    <div
                        class="home-hitbox ${this._loadingHasCompleted ? '' : 'is-loading'}"
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
                ${hasHomeCoords && layout !== null && !this._detailMode ? html`
                    <!--  Solid drop-leader from the home pill DOWN to
                          the projected ground at the home (lat, lon).
                          Same vocabulary as the other home-anchored
                          leaders (stroke-width 2, round caps), painted
                          in the HA primary colour so it reads as the
                          family signature of the home cluster.        -->
                    <svg class="home-drop-leader-svg">
                        <line class="home-drop-leader-line"
                              x1="${layout!.home.x}" y1="${layout!.home.y + 14}"
                              x2="${layout!.homeRoof.x}" y2="${layout!.homeRoof.y}" />
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

                <!--  Weather overlay. Full-card HTML overlay above the MapLibre canvas, painted
                      with a per-altitude cloud-cover raster sampled from the multi-point Open-
                      Meteo grid at the SELECTED instant. Pointer-events disabled so it never
                      intercepts clicks meant for the map. Fades in via inline opacity driven by
                      the fade RAF loop, then the engine.enterWeatherCamera tilts the camera to
                      top-down + zooms out so the user reads the area like a satellite plan. -->
                ${renderWeatherOverlay(this)}
                ${renderLidarViewOpacityPicker(this, this._onLidarOpacityChange)}

            </ha-card>
        `;
    }


    //Per-card unique id used to namespace SVG <defs> ids so multiple Helios cards on the same dashboard don't clash on gradient / filter references.
    _instanceId = `h${Math.floor(Math.random() * 1e9).toString(36)}`;

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
        if (this._lidarOpacityRaf)
        {
            return;
        }
        this._lidarOpacityRaf = requestAnimationFrame(() =>
        {
            this._lidarOpacityRaf = 0;
            const v = this._pendingLidarOpacity;
            if (v === null)
            {
                return;
            }
            this._lidarViewOpacity = v;
            this._engine?.setLidarViewOpacity(v);
            //Kick a Lit render so the picker's `${pct}%` text node updates through the normal
            //Lit pipeline. The previous design did an imperative `span.textContent =` write to
            //skip the re-render cost, which DESTROYED Lit's marker comments inside the span
            //(textContent replaces every child node, including Lit's tracking markers). Once
            //the markers were gone, the next Lit render of the card crashed with
            //"null is not an object (evaluating 'this._$AA.nextSibling.data=ae')" and aborted
            //updated() partway through. The aborted updated() then never reached
            //_handleCardModeChange, which is why clicking the Layer / Weather button after
            //touching the slider visually flipped the mode bar (the click handler ran fine,
            //it's a separate code path) but never fired exitLidarView, so the dot cloud kept
            //drawing. requestUpdate is rAF-coalesced upstream by the slider's own throttle
            //so the render fires at most once per frame.
            this.requestUpdate();
        });
    };


    //Bound mode-bar handlers. Class fields rather than inline arrow
    //expressions inside render() so Lit sees a stable identity and
    //does not re-attach the four @click handlers on every render
    //cycle (template re-attach cost + closure allocation).
    //
    //Each handler drops the scrub state up front via `_exitScrubMode`:
    //a mode switch repositions the timeline visually (the dashboard
    //panel shifts when the mode changes) and the absolutely-positioned
    //scrub tooltip would otherwise stay pinned to the previous
    //timeline location, floating orphaned at the bottom of the card.
    //Returning to live before the mode swap hides the tooltip cleanly
    //in the same render cycle.
    private _onModeLayer = (): void =>
    {
        this._exitScrubMode();
        this._cardMode = 'base';
    };
    private _onModeLidar = (): void =>
    {
        this._exitScrubMode();
        this._cardMode = 'lidar';
    };
    private _onModeWeather = (): void =>
    {
        this._exitScrubMode();
        this._cardMode = 'weather';
    };
    //Mode-transition state machine. Called from updated() when _cardMode changed. Single switch on
    //the (prev, next) pair drives:
    //  1. _overlayMaskActive: ON the moment we leave base. OFF on weather -> base immediately
    //     (the dome SVG is faint, the HUD can fade in through it). OFF on lidar -> base only AFTER
    //     the WebGL dot-cloud fade-out completes (see the LiDAR fade loop completion handler) so the
    //     HUD chips do not pop back through the still-visible cloud.
    //  2. LiDAR enter / exit: enterLidarView() activates the engine layer + kicks the alpha ramp;
    //     exitLidarView() starts the fade-out, the engine layer is torn down at end-of-fade.
    //  3. Weather enter / exit: enterWeatherMode() kicks the fade-in + the camera ease + the
    //     multi-point grid fetch; exitWeatherMode() starts the fade-out + restores the camera.
    //
    //CSS animations (slider slide-in / slide-out, chip + leader + arc fade, timeline slide) run on
    //their own classes (.is-active on the sliders, .overlay-masked on ha-card) which derive directly
    //Unified store refresh check. Called from updated() on every Lit cycle: short-circuits when the
    //store already on the host matches the current data version (cheap hash compare of array lengths),
    //rebuilds otherwise and assigns to the @state so the next render picks up the new bucketization.
    //Setting the @state during updated() schedules a follow-up render but does NOT loop because the
    //rebuild result has the same dataVersion, so the next isStoreFresh check short-circuits.
    private _maybeRebuildUnifiedStore(): void
    {
        const host = this as unknown as UnifiedStoreHost;
        if (isStoreFresh(host, this._unifiedStore))
        {
            return;
        }
        this._unifiedStore = buildUnifiedStore(host);
    }

    //from _cardMode / _overlayMaskActive in the render output. No keyframes, no animation: forwards,
    //no rAF defers, just transitions on the CSS rule's base style that fire on class change.
    private _handleCardModeChange(prev: CardMode, next: CardMode): void
    {
        if (next !== 'base')
        {
            this._overlayMaskActive = true;
        }

        if (prev === 'lidar' && next !== 'lidar')
        {
            //Always run exitLidarView when leaving LiDAR mode, no _lidarLayerActive guard. The
            //old guard skipped the exit fade when the flag was false, which left the engine
            //layer drawing if the card-side flag ever desync'd from the engine layer's actual
            //alphaFade. exitLidarView is cheap to call when the layer was never activated: the
            //fade tick's alpha formula has _lidarLayerActive as a multiplier, so a false flag
            //collapses alpha to 0 on the first tick and the engine layer immediately
            //short-circuits its draw call.
            exitLidarView(this);
        }
        else if (prev !== 'lidar' && next === 'lidar')
        {
            const entered = enterLidarView(this);
            if (!entered)
            {
                //Engine reports no LiDAR provider covers the active home, bail back to base so the
                //mode-bar chrome does not stay lit on a mode the user cannot actually be in. Reset
                //the overlay mask too so the chips do not flash hidden for one render frame.
                this._overlayMaskActive = false;
                this._cardMode          = 'base';
                return;
            }
        }

        if (prev === 'weather' && next !== 'weather')
        {
            if (this._weatherOverlayVisible)
            {
                exitWeatherMode(this);
            }
            if (next === 'base')
            {
                //Weather overlay is faint, lift the overlay mask immediately so the chips +
                //timeline slide back in while the overlay fades out and the camera eases back to
                //the pre-enter pose.
                this._overlayMaskActive = false;
            }
        }
        else if (prev !== 'weather' && next === 'weather')
        {
            enterWeatherMode(this);
        }
    }
    //Reset the timeline scrub state so the absolutely-positioned
    //scrub tooltip element disappears in the next render. Called
    //from the mode-bar handlers because a mode swap shifts the
    //timeline geometry and the tooltip would otherwise stay
    //pinned to the previous on-screen position.
    private _exitScrubMode = (): void =>
    {
        if (this._selectedTime !== null)
        {
            this._selectedTime = null;
        }
        if (!this._isLiveMode)
        {
            this._isLiveMode = true;
        }
    };
    //Camera lock state used by the top-left lock button. Delegates
    //to the engine, which itself prefers localStorage over the legacy
    //YAML flag, so the button icon always matches what MapLibre is
    //actually doing.
    private _isCameraLocked(): boolean
    {
        if (this._engine)
        {
            return this._engine.isCameraLocked();
        }
        return false;
    }
    //Lock-button click handler. Asks the engine to flip its lock
    //state; the engine takes care of persisting the current bearing,
    //pitch and lock flag to localStorage (HA's lovelace does NOT
    //persist `config-changed` from a live card, so a YAML round-trip
    //would be silently dropped on disk). The next reload reads the
    //same localStorage entry and restores the pose.
    private _onCameraLockToggle = (): void =>
    {
        if (!this._engine)
        {
            return;
        }
        this._engine.setCameraLocked(!this._engine.isCameraLocked());
        this.requestUpdate();
    };

    static styles = heliosCardStyles;
}
