import { LitElement, html, svg, PropertyValues, TemplateResult, nothing } from 'lit';
import { customElement, property, state, query, queryAll } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { HeliosEngine } from './helios-engine';
import
{
    type HeliosConfig,
    DEFAULT_PERIOD_PAST_DAYS,
    DEFAULT_PERIOD_FUTURE_DAYS,
    periodPastDays,
    periodFutureDays,
    valueDecimals,
    customEntityId,
    cacheId,
    hasLocalLidar
} from './helios-config';
import { resolveCustomEntityLive, resolveCustomEntityIcon, refreshCustomEntity } from './card/custom-entity';
import { CUSTOM_ENTITY_COLOR } from './constants';
import { pickTranslations } from './i18n';
import { heliosCardStyles } from './css/helios-card-scene-css';
import { heliosTimelineStyles } from './css/helios-timeline-css';
import { heliosCardEnergyClockCss } from './css/helios-card-energy-clock-css';
import { heliosCardLidarCss } from './css/helios-card-lidar-css';
import {
    type ClockData, type ClockHit, type ClockRingInput,
    availableClockTargets, buildClockData, clockTargetMeta, clockTargetLabel,
    projectClockFrame, clockHitTest, clockHourTotal, formatClockValue,
    CLOCK_GROW_MS,
} from './card/energy-clock';
import { darkenHex, ENERGY_COLOR, cloudCoverIcon, formatHaTime } from './card/format';
import
{
    refreshPv,
    currentPvRate,
    pvRateAtTime,
    pvNormalizeToWatts,
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
import { refreshIrradiance, clearIrradianceModuleCaches } from './card/irradiance';
import
{
    renderBottomChart,
    chartAccentColor,
    solarBands,
    type ChartTarget,
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
    buildArcSegments,
    flowDuration,
    type ArcSegment,
    type SunScene,
    type LabelLayout
} from './card/hud';
import
{
    tick,
    onTimelinePointerDown,
    onTimelinePointerMove,
    onTimelinePointerUp
} from './card/timeline';
import { refreshGrid, formatGridValue } from './card/grid';
import {
    subscribeEnergyPrefs,
    unsubscribeEnergyPrefs,
    refreshHaDailyTotals,
    EMPTY_ENERGY_DEFAULTS,
    type EnergyDefaults,
} from './card/energy-prefs';
import { clearEnergyStatsCache, wattsAtFromChangeSeries } from './card/energy-stats';
import { fetchHaSolarForecast, type SolarForecastPoint } from './card/energy-forecast';
import { buildUnifiedStore, isStoreFresh, valueAt, type UnifiedStoreHost } from './card/unifiedStore';
import
{
    computeConfigSig,
    getHomeCoords,
    initEngine,
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

//Card name/description for the HA picker, shown before any hass exists, so language comes from navigator.
const _bootI18n = pickTranslations(typeof navigator !== 'undefined' ? navigator.language : 'en');

//Overwrite (not insert-if-missing) so the freshly-loaded bundle's metadata always wins over any stale
//entry pushed by other code (HACS placeholder, dev-tools mock, an older Helios bundle on the same page).
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

//Install banner: two adjacent chips (card name + build version), like other HACS frontends. Guarded
//against double-print on bundle reload. Version is inlined at build time from package.json by vite.config.ts.
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


//Registry of every live <helios-card>, maintained by connected/disconnectedCallback so
//window.heliosStats() can enumerate on-screen cards and dump config + engine state. Module-level (not a
//static) so the heliosStats() function below can close over it without the class being fully constructed.
const _liveCards = new Set<HeliosCard>();

//Live cards grouped by their (auto-generated) cache id, in connection order. A pasted card carries a copy of
//the source's id; the registry hands each same-id card a distinct, order-stable storage slot so duplicates
//never share — without the user ever seeing or managing the id.
const _cacheIdRegistry = new Map<string, HeliosCard[]>();



//Window-level reset bus: the editor's "reset data cache" button fires this so every live card on the
//page drops its cached data in one sweep. Wired once at module load, not per card.
window.addEventListener('helios-data-cache-reset', () =>
{
    for (const card of _liveCards)
    {
        card.resetDataCache();
    }
});

//Public diagnostic command, exposed once on first bundle load. Returns a JSON-safe snapshot AND prints
//a grouped console dump (build version, engine lifecycle counters, one section per card). Config values
//are PII-free and safe to paste into an issue (no API keys; basemap is keyless CARTO raster tiles).
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


//Debug-only home-location override. setHeliosLocation(lat, lon) renders every live card as if HA's home
//were elsewhere; clearHeliosLocation() reverts. Stored on window only (no localStorage), so a refresh
//restores hass.config. _getHomeCoords() prefers the override; setting it reinits every live card so the
//engine, weather fetch and PV calibration cache all swap immediately.
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
    //Depth-modulation bounds for the solar overlay: each pair is the FAR (back of the loop) and NEAR
    //(front) end, lerped per-element by the engine's nearness factor in [0..1].
    private static readonly OUTLINE_FAR  = 1.5;
    private static readonly OUTLINE_NEAR = 5.0;
    private static readonly SEGMENT_FAR  = 1.0;
    private static readonly SEGMENT_NEAR = 4.0;
    //Sun-disc radii in px. The inner irradiance fill needs ~9 px of diameter at apex to read as an annulus rather than a dot.
    private static readonly SUN_R_FAR    = 10.0;
    private static readonly SUN_R_NEAR   = 20.0;
    private static readonly SUN_RIM_WIDTH = 1.5;
    //Chip geometry shared with the CSS (chips have a fixed 96px width): half-width docks the cloud chip past
    //the irradiance chip's edge, half-height centres the connecting leader on their shared mid-line.
    private static readonly CHIP_HALF_W_PX = 48;
    private static readonly CHIP_HALF_H_PX = 12;
    //Home pill is a horizontal stadium (like the other chips), not a circle. Half-extents of its outline;
    //leaders dock against this stadium so they all meet the same focal energy node.
    private static readonly HOME_PILL_HALF_WIDTH_PX  = 38;
    private static readonly HOME_PILL_HALF_HEIGHT_PX = 14;
    //Faint tint inside the rim so the "empty sun" at sunrise/sunset still reads as a disc, not a coloured spot.
    private static readonly SUN_FILL_OPACITY_BG = 0.20;

    //Below-horizon segments are dots whose diameter IS the stroke width, scaled down vs daytime so the
    //night portion of the loop reads as a quieter trace without competing with the lit half.
    private static readonly NIGHT_STROKE_FACTOR = 0.5;

    @property({ attribute: false }) public hass!: any;
    @property({ attribute: false }) config!: HeliosConfig;
    //Set by HA on the editor's live-preview card. HA rebuilds that card on every keystroke, so intro
    //animations (prism rise, timeline curve grow) are suppressed while it is true.
    @property({ attribute: false }) public preview = false;

    @state() _engine?:        HeliosEngine;
    @state() _now             = new Date();
    //Cloud-cover values shown in the on-ground disc hover popup.
    @state() _cloudCover      = -1;
    //Screen-space layout of the always-visible labels + leaders, recomputed via
    //engine.projectHomeLabelLayout() on every map transform. null while the map is loading.
    @state() _labelLayout: LabelLayout | null = null;
    //PV production state, set when the HA Energy dashboard exposes a solar source: live value from
    //hass.states + historical series from HA's history API for the dedicated chart.
    @state() _pvCurrent: number | null = null;
    @state() _pvUnit:    string        = '';
    @state() _pvHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    //Per-entity histories alongside _pvHistory so the chart can draw one curve per source and the scrub
    //tooltip can break down by entity. Keyed by entity id; cleared + repopulated in fetchPvHistory.
    _pvHistoryPerEntity: Map<string, { times: Date[]; values: number[] }> = new Map();
    //Most recent PV history fetch outcome, surfaced via window.heliosStats() (raw entries, samples kept
    //after unit/unavailable filtering, window in hours).
    _pvHistoryDiagnostics: { rawEntries: number; samples: number; windowH: number } | null = null;
    //Hourly long-term-statistics series feeding the 5-day forecast calibration. Same shape as _pvHistory
    //but via recorder/statistics_during_period (~120 rows/5 days vs potentially millions on the raw path
    //for high-frequency sensors). Null while first fetch is in flight; calibration.ts falls back to
    //_pvHistory when null/empty.
    @state() _pvCalibStats: { times: Date[]; values: number[] } | null = null;
    _pvCalibStatsFetchKey  = '';
    _pvCalibStatsFetching  = false;
    //Recorder change series for the solar meter(s): canonical past-production source for the unified
    //store + chip scrub. Reset-corrected, unit-normalised kWh per 5-min bucket, same as the HA Energy
    //dashboard.
    @state() _pvChangeSeries: import('./card/energy-stats').ChangeBucket[] | null = null;
    _pvChangeSeriesFetchKey  = '';
    _pvChangeSeriesFetching  = false;
    //HA Energy dashboard solar forecast (src/card/energy-forecast.ts), merged across config entries.
    //The unified store reads this into its forecast series. Empty when no forecast source is configured.
    @state() _haSolarForecast: SolarForecastPoint[] = [];
    _haSolarForecastLoaded    = false;
    _haSolarForecastFetching  = false;
    _haSolarForecastFetchedAt = 0;
    //Home-battery state, set when the HA Energy dashboard exposes a battery source (stat_rate,
    //stat_energy_from/to or stat_soc). Live readings; historical series in the *History fields below.
    //Units kept alongside values so the chip formats kW vs W without re-reading the state.
    @state() _batterySoc:        number | null = null;
    @state() _batteryPower:      number | null = null;
    @state() _batteryPowerUnit:  string        = '';
    //Grid import/export live values, set by refreshGrid() from the HA Energy grid source's stat_energy_from
    //(import) / stat_energy_to (export). Unit captured alongside so the chip formats W/kWh/m³ correctly.
    @state() _gridImportValue:   number | null = null;
    @state() _gridImportUnit:    string        = '';
    @state() _gridExportValue:   number | null = null;
    @state() _gridExportUnit:    string        = '';
    //Recorder change series for the grid import/export meters: canonical past-power source for the
    //unified store + scrub. Reset-corrected kWh per 5-min bucket, same as the HA Energy dashboard.
    @state() _gridImportChangeSeries: import('./card/energy-stats').ChangeBucket[] | null = null;
    @state() _gridExportChangeSeries: import('./card/energy-stats').ChangeBucket[] | null = null;
    _gridImportChangeFetchKey = '';
    _gridExportChangeFetchKey = '';
    _gridImportChangeFetching = false;
    _gridExportChangeFetching = false;
    //Historical series for the active timeline range. Both battery entities fetched in one
    //history/history_during_period WS call when both are set.
    @state() _batterySocHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    //Custom-entity hourly history over the window (values in W), feeding the timeline 'custom' curve + clock
    //ring. Null until the first fetch / when no entity is configured. _customEntityKey dedupes refetches.
    @state() _customEntityHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    _customEntityKey = '';
    @state() _batteryPowerHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    _batteryFetchKey  = '';
    _batteryFetching  = false;
    //Recorder change series for battery charge (stat_energy_to) + discharge (stat_energy_from) meters:
    //canonical past-power source for the unified store + scrub. Net (charge - discharge) gives a
    //structural sign so charging is never lost (#216).
    @state() _batteryChargeChangeSeries:    import('./card/energy-stats').ChangeBucket[] | null = null;
    @state() _batteryDischargeChangeSeries: import('./card/energy-stats').ChangeBucket[] | null = null;
    _batteryChangeFetchKey = '';
    _batteryChangeFetching = false;
    //Irradiance entity history, populated when solar-irradiance-entity is configured. Recorder
    //samples over the timeline range, merged with the live state, pushed to the engine via
    //setSolarRadiationSamples. Plain field (no @state): render never reads it, the engine owns lookup.
    _irradianceHistory: { times: Date[]; values: number[] } | null = null;
    _irradianceFetchKey = '';
    _irradianceFetching = false;
    //Screen-space layout of the solar arc, sun and incidence ray. Recomputed via engine.projectSunScene()
    //on every map transform and clock tick (sun moves with time).
    @state() _sunScene: SunScene | null = null;

    //Energy dashboard preferences snapshot. Subscribed at connectedCallback, updated on every HA
    //energy_preferences_updated event. Chip refresh helpers read their fallback entity from here.
    @state() _energyDefaults: EnergyDefaults = EMPTY_ENERGY_DEFAULTS;
    _energyPrefsUnsub?: () => void;
    //HA Energy daily-total cache from refreshHaDailyTotals() against the recorder: PV produced, grid
    //imported, grid exported, battery charged, battery discharged today. Null when no HA stat is
    //configured or the recorder call has not landed; consumer chips then collapse silently.
    @state() _haSolarTodayKwh:        number | null = null;
    @state() _haGridImportTodayKwh:   number | null = null;
    @state() _haGridExportTodayKwh:   number | null = null;
    @state() _haBatteryChargedKwh:    number | null = null;
    @state() _haBatteryDischargedKwh: number | null = null;
    //Hover state on the home hitbox. Drives a sun-coloured glow halo so the focal building reads as
    //interactive before clicking.
    @state() _homeHover = false;
    //Hover position on the timeline chart cards, as a percent of the visible range. Null when the pointer
    //is outside; drives the hover guide line, per-curve dots and the tooltip chip.
    @state() _chartHoverPct: number | null = null;
    //Active bottom-chart target: the single re-targetable chart draws this series-set; chips re-point it
    //(production by default, then grid/battery/irradiance/cloud as chips re-point it).
    @state() _chartTarget: ChartTarget = 'production';
    //Top-left mode selector: 'scene' is the 3D view; 'clock' fades every layer but the basemap and paints the
    //hourly cylinder ring on top instead. Scene is the default.
    @state() _viewMode: 'scene' | 'clock' | 'lidar' = 'scene';
    //Active clock-mode filters, ordered: each selected metric draws one concentric ring (first = outermost).
    //Persisted; the timeline (hidden in clock mode) follows the first when scene mode resumes.
    @state() _clockTargets: ChartTarget[] = [];
    //Energy-clock rings, one ClockData per active filter (outer -> inner). Rebuilt on a filter/data change.
    @state() private _clockData: ClockData[] = [];
    //Hovered hour slice; lights every ring's bar at that hour + drives the multi-metric tooltip. null = off.
    @state() private _clockHoverHour: number | null = null;
    //Screen-space hit segments (each cylinder's axis), refreshed every paint for the hover test.
    private _clockHits: ClockHit[] = [];
    private _clockHoverX = 0;
    private _clockHoverY = 0;
    //Touch: a tapped tooltip is sticky (hover doesn't fire on touch), cleared by tapping empty space or
    //another cylinder. _clockTapStart* anchor the move-threshold that tells a tap from a drag-rotate.
    private _clockTapSticky = false;
    private _clockTapStartX = 0;
    private _clockTapStartY = 0;
    //Per-ring animation, keyed by metric so rapid toggles never desync (no held rebuild, no shared index):
    //  _clockGrowStart  — when a ring was added (drives its 0..1 height grow); absent = at rest.
    //  _clockExiting    — removed rings fading + shrinking out, independent of the live list so a toggle never
    //                     blocks the rebuild; each carries the slot it held so survivors slide over it.
    //  _clockSlotFrom + _clockSlideStart — captured source slot per ring + when the recompaction slide began,
    //                     re-snapshotted from CURRENT animated positions on every toggle so nothing teleports.
    //  _clockAnimSeq    — gates the single shared animation rAF loop.
    private _clockGrowStart = new Map<ChartTarget, number>();
    private _clockExiting: Array<{ data: ClockData; slot: number; start: number; h0: number }> = [];
    private _clockSlotFrom = new Map<ChartTarget, number>();
    private _clockSlideStart = 0;
    private _clockAnimSeq = 0;
    //Slice-focus dim: _clockDim ramps 0..1 (others fade toward 0.5) while _clockDimHour is focused; it
    //persists through the fade-out so the dimmed bars + the focused spoke ramp back smoothly.
    private _clockDim = 0;
    private _clockDimHour: number | null = null;
    private _clockDimSeq  = 0;
    @query('ha-card') private _haCard?: HTMLElement;
    @query('.clock-svg') private _clockSvg?: SVGSVGElement;
    @queryAll('.clock-hour-label') private _clockLabels!: NodeListOf<HTMLElement>;
    @queryAll('.clock-compass-label') private _clockCompassLabels!: NodeListOf<HTMLElement>;
    @query('.clock-tip') private _clockTip?: HTMLElement;
    @state() _chartSeries: {
        times:        Date[];
        irradiance:   number[];
        cloud:        number[];
        //Hourly low/mid/high cloud cover in %, for the timeline's cloud target (three altitude bands).
        cloudLow:     number[];
        cloudMid:     number[];
        cloudHigh:    number[];
        //Hourly horizontal beam + diffuse irradiance in W/m², -1 where not decomposed. Feeds the PV tilt
        //transposition's direct/diffuse split.
        directRad:    number[];
        diffuseRad:   number[];
        //Hourly ground snow depth in metres, NaN where unknown. Feeds the winter snow-cover derate.
        snowDepth:    number[];
        //Hourly ambient temperature in °C + wind speed in m/s, NaN-padded where absent. Mirror `times`
        //length; feed the PV prediction's thermal-derating term.
        temperature:  number[];
        windSpeed:    number[];
    } | null = null;
    @state() _timeRange:    { start: Date; end: Date } | null = null;
    @state() _selectedTime: Date | null = null;
    @state() _isLiveMode    = true;
    //Active rolling-window span (days of history/forecast around today). Seeded from config period keys
    //in setConfig, pushed to the engine via setPeriodDays(), read by buildUnifiedStore. The in-card
    //selector overrides these at runtime via _setPeriod(); single runtime source of truth for the window.
    //Not @state: changes go through _applyPeriod(), which requestUpdate()s after dropping store + window.
    _periodPastDays   = DEFAULT_PERIOD_PAST_DAYS;
    _periodFutureDays = DEFAULT_PERIOD_FUTURE_DAYS;

    //Flipped by fetchEnergyPrefs after the first parse lands, so the card kicks refreshHaDailyTotals as
    //soon as the HA Energy defaults snapshot appears rather than waiting up to 30 s for the next tick.
    _energyDefaultsLoaded   = false;
    private _dailyTotalsKicked = false;
    //Unified 5-day data store. Built after the initial weather + PV + battery + grid fetches, rebuilt when
    //any refresh, sliced/interpolated by the radial dial, graph view and main timeline. Live numeric chips
    //stay on the direct hass.states path: the store carries bucketed curves, the chips need sample-accurate
    //values a 15 min bucket would lose.
    @state() _unifiedStore: import('./card/unifiedStore').UnifiedDataStore | null = null;


    private _timer?:           number;
    //Deferred engine teardown handle: lets the engine survive HA's edit-mode disconnect+reconnect thrash.
    private _engineTeardownTimer?: number;
    _lastHomeKey       = '';
    _lastConfigSig     = '';
    _initInflight      = false;

    //Cached theme polarity. The fallback path (getComputedStyle + regex) forces a style flush, too costly
    //per render. Result only changes on theme polarity flip / style reload, so cache by themesObj identity.
    private _cachedIsDarkThemesRef: unknown = undefined;
    private _cachedIsDark = false;

    //Refresh-chain gate: updated() re-runs the PV/Battery/Grid/Irradiance refreshers only when hass,
    //config or the timeline range change identity. Without it, every overlay @state mutation would re-run
    //the chain on every map move during auto-rotate (hundreds of allocations per frame for no new data).
    private _lastRefreshHassRef:           unknown = undefined;
    private _lastRefreshConfigSig:         string | undefined = undefined;
    private _lastRefreshTimeRangeRef:      unknown = undefined;
    private _lastRefreshEnergyDefaultsRef: unknown = undefined;

    //Arc-segment scratch buffers. The sun arc is split by altitude each render (below-horizon BEHIND the
    //chip cluster, above-horizon in FRONT). Reused in place (length reset to 0 per render) instead of
    //allocating fresh arrays via filter().
    private _arcBackBuf:      ArcSegment[] = [];
    private _arcFrontBuf:     ArcSegment[] = [];
    private _arcFrontNearBuf: ArcSegment[] = [];



    //HA card lifecycle

    public setConfig(config: HeliosConfig): void
    {
        if (!config)
        {
            throw new Error('Invalid HELIOS configuration');
        }
        this.config = { ...config };
        //Seed the rolling-window span from the config period keys. A change re-applies in place via
        //_applyPeriod (the period is a dedicated setter, not in VISUAL_CONFIG_KEYS).
        const past   = periodPastDays(this.config);
        const future = periodFutureDays(this.config);
        if (past !== this._periodPastDays || future !== this._periodFutureDays)
        {
            this._periodPastDays   = past;
            this._periodFutureDays = future;
            this._applyPeriod();
        }
        this._warnIfLegacyEntityKeys(config);
    }

    //Apply the active rolling-window span to engine, store and timeline. Called from setConfig and the
    //in-card selector. Pushes the resolved values, then drops the cached store + window so the next render
    //rebuilds against the new span. Safe before the engine exists (setter / range read are guarded).
    private _applyPeriod(): void
    {
        this._engine?.setPeriodDays(this._periodPastDays, this._periodFutureDays);
        this._unifiedStore = null;
        const tr = this._engine?.getTimelineRange();
        if (tr)
        {
            this._timeRange = tr;
            //Scrub cursor now outside the new window: snap back to live so the scene doesn't freeze on an
            //instant unreachable on the bar.
            if (this._selectedTime
                && (this._selectedTime.getTime() < tr.start.getTime()
                 || this._selectedTime.getTime() > tr.end.getTime()))
            {
                this._exitScrubMode();
            }
        }
        this.requestUpdate();
    }

    //In-card period selector -> set the rolling window and re-apply. No-op when the span is already active
    //so tapping the current preset doesn't churn a store rebuild.
    private _setPeriod(pastDays: number, futureDays: number): void
    {
        if (this._periodPastDays === pastDays && this._periodFutureDays === futureDays)
        {
            return;
        }
        this._periodPastDays   = pastDays;
        this._periodFutureDays = futureDays;
        this._applyPeriod();
    }

    //Chip -> bottom-chart re-targeting. Points the chart at the clicked metric; no-op when already there.
    private _setChartTarget = (target: ChartTarget): void =>
    {
        if (this._chartTarget !== target)
        {
            this._chartTarget = target;
            this._persistUiState();
        }
    };

    //Last target the home prism was painted for, so updated() can tell a chip CHANGE (play the squash/grow)
    //from a same-chip scrub/tick (instant recolour). Undefined until the first paint (no squash on load).
    private _lastHomeTarget?: ChartTarget;

    //Push the home prism's appearance for the active chip to the renderer (via the engine): the chip's
    //accent colour, plus the per-PV-string production histogram when the solar chip is active (a single
    //producing string falls back to a solid block). `animate` plays the squash/grow on a chip change.
    private _updateHomeAppearance(animate: boolean): void
    {
        if (!this._engine)
        {
            return;
        }
        const color = chartAccentColor(this);
        const atMs  = this._selectedTime?.getTime() ?? Date.now();
        const bands = this._chartTarget === 'production' ? solarBands(this, atMs) : [];
        //No squash on the very first paint (no prior target to grow away from).
        const play  = animate && this._lastHomeTarget !== undefined;
        this._lastHomeTarget = this._chartTarget;
        this._engine.setHomeAppearance(color, bands, play);
    }

    //Active-target indicator left of the timeline header: the current chart's icon, tinted with the active
    //accent. Keyed on the target so the glyph fades in on each re-target.
    private _renderChartIndicator(): TemplateResult
    {
        const icons: Record<ChartTarget, string> = {
            production:    'mdi:solar-power',
            consumption:   'mdi:home-lightning-bolt',
            grid:          'mdi:transmission-tower',
            battery:       'mdi:lightning-bolt',
            'battery-soc': 'mdi:battery',
            irradiance:    'mdi:white-balance-sunny',
            cloud:         'mdi:cloud',
            custom:        resolveCustomEntityIcon(this.hass, this.config),
        };
        const icon = icons[this._chartTarget] ?? 'mdi:chart-line';
        return html`
            <div class="tb-chart-indicator">
                ${keyed(this._chartTarget, html`<ha-icon icon="${icon}"></ha-icon>`)}
            </div>
        `;
    }

    //Compact rolling-period selector on the timeline: three presets (today, the configured default, last 7
    //days), active one highlighted by matching the live span. Pointer-down is swallowed so tapping a preset
    //never starts a scrub on the parent .time-bar.
    private _renderPeriodSelector(): TemplateResult
    {
        const t       = pickTranslations(this.hass?.language);
        const past    = this._periodPastDays;
        const future  = this._periodFutureDays;
        const cfgPast = periodPastDays(this.config);
        const cfgFut  = periodFutureDays(this.config);
        const presets: { label: string; past: number; future: number }[] = [
            { label: t.period?.today         ?? 'Today',   past: 0,       future: 0      },
            { label: t.period?.configDefault ?? 'Default', past: cfgPast, future: cfgFut },
            { label: t.period?.last7Days     ?? '7 d',     past: 6,       future: 1      },
        ];
        return html`
            <div
                class="tb-period-selector"
                role="group"
                aria-label="${t.period?.rangeLabel ?? 'Time range'}"
                @pointerdown="${(e: Event) => e.stopPropagation()}"
            >
                ${presets.map(p => html`
                    <button
                        type="button"
                        class="tb-period-seg ${past === p.past && future === p.future ? 'is-on' : ''}"
                        @click="${() => this._setPeriod(p.past, p.future)}"
                    >${p.label}</button>
                `)}
            </div>
        `;
    }

    //Retired YAML entity keys, now read entirely from the HA Energy dashboard; any still set on the card
    //config is ignored at runtime. Detected only to fire a one-shot persistent notification pointing the
    //user at the replacement.
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

    //Fire a one-shot HA persistent notification when the card YAML carries any retired entity key. Silent
    //when none are present, when hass is not yet attached (setConfig can land before the hass setter), or
    //when the service is RBAC-denied. The flag dedupes across setConfig calls (HA also dedupes by id).
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
            + `(Settings → Dashboards → Energy → your sources). The PV forecast is also read from the `
            + `Energy dashboard's configured solar forecast now, so the card no longer carries any PV `
            + `install configuration. Only the entity slots and the forecast config were retired; the `
            + `visual options still live in the card YAML.`;
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
            //Service denied/unavailable; chips still light up from HA Energy resolution and the deprecation
            //note is also in the CHANGELOG / README.
        }
    }

    static getConfigElement(): HTMLElement
    {
        return document.createElement('helios-card-editor');
    }

    //HA <hui-card-picker> signature: (hass, entities, entitiesFallback). Two cases:
    //  - 'All cards' tab: entities empty -> empty stub; the card falls back to hass.config lat/lon at
    //    runtime (zone.home).
    //  - 'By entity' tab: HA passes the clicked entity. For a zone entity we lift its lat/lon into
    //    home-latitude / home-longitude so the catalog offers Helios pre-filled for that zone (the card
    //    already supports the override keys, so no schema change).
    //hass is loosely typed because the codebase types it as any (HA has no public types for this surface).
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

    //Diagnostic snapshot for window.heliosStats(): live config, engine snapshot (when up) and a small PV
    //block. JSON-safe, no DOM, no PII: the engine snapshot strips its hass.config lat/lon, and the loop
    //below omits the home-latitude / home-longitude overrides so user coordinates never leak.
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
                //Skip user-supplied home coordinates so the snapshot stays PII-free.
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
                lastHistory:      this._pvHistoryDiagnostics
            }
        };
    }

    //Called by the setHeliosLocation / clearHeliosLocation debug helpers. Clears the cached home key so
    //the next updated() sees identityChanged and re-inits the engine against the new coordinates, then
    //schedules that pass. The visual editor reaches the same re-init via the natural identity-drift path
    //(config-changed -> setConfig -> updated() notices _getHomeCoords() resolves to a new key).
    public invalidateLocation(): void
    {
        this._lastHomeKey = '';
        this.requestUpdate();
    }


    //Wipe all card-side cached production/forecast data and refetch from HA + Open-Meteo. Used by the
    //editor's "reset data cache" button to recover from a stuck calibration or stale weather payload.
    public resetDataCache(): void
    {
        //Drop in-memory PV state so the next refreshPv() refetches from scratch, not the cached fetch key.
        this._pvHistory                   = null;
        this._pvCalibStats                = null;
        this._pvChangeSeries              = null;
        this._pvChangeSeriesFetchKey      = '';
        this._haSolarForecast             = [];
        this._haSolarForecastLoaded       = false;
        this._haSolarForecastFetching     = false;
        this._haSolarForecastFetchedAt    = 0;
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
        this._irradianceHistory           = null;
        this._irradianceFetchKey          = '';
        //Drop the module-level caches too, else the next refresh rehydrates from the cross-mount cache with
        //the exact stale entry the user just cleared.
        clearPvModuleCaches();
        clearBatteryModuleCaches();
        clearIrradianceModuleCaches();
        clearEnergyStatsCache();
        //Engine-side: clears localStorage weather cache, drops the in-memory hourly snapshot, refetches.
        this._engine?.resetDataCache();
        this.requestUpdate();
    }


    //Masonry sizing. 1 unit = 50 px so 15 ≈ 750 px, leaving the basemap ~480 px after the timeline's ~150 px.
    public getCardSize(): number
    {
        return 15;
    }

    //Sections-view sizing. 1 row ≈ 56 px, 1 col ≈ 30 px (section width 360 px). 12 cols × 8 rows is both the
    //section editor's ceiling and the card's minimum: the basemap, chip cluster and timeline need the full
    //width and all 8 rows to stay legible.
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

    public connectedCallback(): void
    {
        super.connectedCallback();
        _liveCards.add(this);
        this._registerCacheId();
        //Quick reconnect (HA edit-mode thrash): cancel the deferred engine teardown so the live engine is kept.
        if (this._engineTeardownTimer !== undefined)
        {
            window.clearTimeout(this._engineTeardownTimer);
            this._engineTeardownTimer = undefined;
        }
        //Reset the daily-totals kickoff flag so a remount re-fires refreshHaDailyTotals when the HA Energy
        //defaults snapshot lands again.
        this._dailyTotalsKicked = false;
        tick(this);
        //30 s tick: the clock shows HH:MM, the sun moves ~0.13°/refresh (smooth) and the 5-day live cursor
        //advances ~6 px per 30 s. PV/battery live readings update on hass state changes, not this tick, so
        //they stay real-time.
        this._timer = window.setInterval(() =>
        {
            tick(this);
            //Refresh the HA Energy daily-total cache on the same 30 s cadence. One WS round-trip per
            //non-empty entity list; totals move by watt-hours, so 30 s tracks the dashboard tile cheaply.
            refreshHaDailyTotals(this);
        }, 30_000);
        initVisibilityObserver(this);
        if (typeof document !== 'undefined')
        {
            document.addEventListener('visibilitychange', this._onPageVisibilityForTheme);
        }
        subscribeEnergyPrefs(this);
        //One-shot refresh at connect so the headline lights up on first render rather than waiting 30 s.
        //No-op when no HA stat is wired.
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
        }
        unsubscribeEnergyPrefs(this);
        //Snapshot the view for the next visit (while still registered, so the storage slot is the right one):
        //the engine writes the live camera pose (captures an auto-rotated bearing too), the card writes the
        //view mode + selected chip.
        if (this._engine) { this._engine.cacheKey = this._effectiveCacheId(); }
        this._engine?.persistCameraPose();
        this._persistUiState();
        this._unregisterCacheId();
        //Stop any in-flight clock grow / slide / exit / dim animation so a removed card doesn't keep an rAF alive.
        this._clockAnimSeq++;
        this._clockDimSeq++;
        //HA's edit-mode wrapping fires disconnect + reconnect in the same tick. Defer the engine teardown so a
        //quick reconnect (cancelled in connectedCallback) keeps the live engine; only a real removal lets it fire.
        if (this._engine !== undefined && this._engineTeardownTimer === undefined)
        {
            this._engineTeardownTimer = window.setTimeout(() =>
            {
                this._engineTeardownTimer = undefined;
                this._engine?.cleanup();
                this._engine = undefined;
            }, 400);
        }
        //NOTE: _lastHomeKey is intentionally NOT reset here. The home always resolves to a value (HA config
        //or the user override), and a genuine coordinate change is caught naturally by getHomeCoords on the
        //next updated(); clearing it forced identityChanged=true on every reconnect and re-spawned the engine.
        this._initInflight  = false;
    }

    //IntersectionObserver: pause the continuously-running CSS + SVG SMIL overlay animations when the card
    //scrolls out of view. The engine rotation rAF is left running (the browser auto-throttles it on hidden
    //tabs, and the card looks alive on scroll-back).
    _visibilityObserver?: IntersectionObserver;
    //Document-level visibilitychange listener; set up by initVisibilityObserver(), torn down in
    //disconnectedCallback so a removed card doesn't leak a global handler or double-subscribe on remount.
    _onVisibilityChange?: () => void;


    //Engine init policy: re-init only when an identity input changes (home coordinates). Container reflow
    //just resizes the existing engine; we never tear down the engine for a sibling re-render (it would
    //trash the user's in-progress editor edits).
    protected updated(_changedProperties: PropertyValues): void
    {
        //Restore the saved view mode + selected chip once coords resolve (idempotent; retries until ready).
        this._restoreUiState();

        //LiDAR mode requires a configured local nDSM; if it's removed (or never was), fall back to scene.
        if (this._viewMode === 'lidar' && !hasLocalLidar(this.config))
        {
            this._viewMode = 'scene';
        }

        //Unified data store refresh. Rebuilds when any underlying source changed since the last build, so
        //every consumer reads the latest data without per-consumer invalidation. Cheap when nothing changed
        //(one hash compare), ~50 ms for a full 480 × 7 bucketization + forecast pass on a real refresh.
        this._maybeRebuildUnifiedStore();

        //Drive the home prism's colour + PV-string histogram from the active chip. The squash/grow plays
        //only when the chip CHANGES; a scrub or live tick on the same chip recolours/restacks instantly.
        //Gated on these states so the frequent auto-rotate reprojections (which touch none of them) don't
        //re-resolve the theme colour every frame.
        if (this._engine
            && (_changedProperties.has('_chartTarget')
                || _changedProperties.has('_selectedTime')
                || _changedProperties.has('hass')
                //Energy/PV data lands via callWS subscriptions that requestUpdate() WITHOUT touching hass,
                //but they rebuild the unified store — so watch it too, else the default (PV) home never picks
                //up its colour + per-source bands until the user clicks a chip.
                || _changedProperties.has('_unifiedStore')))
        {
            this._updateHomeAppearance(_changedProperties.has('_chartTarget'));
        }

        //Energy-clock: while in clock mode, rebuild the metric areas when the metric set, the window or the
        //underlying data changes (a data-only rebuild animates nothing; the grow/slide is kicked by the toggle
        //and mode actions), then repaint once fresh areas render. A hover change kicks the slice-focus dim fade.
        if (this._viewMode === 'clock')
        {
            const inputsChanged = _changedProperties.has('_viewMode')
                || _changedProperties.has('_clockTargets')
                || _changedProperties.has('_unifiedStore')
                || _changedProperties.has('_chartSeries')
                || _changedProperties.has('_batterySocHistory')
                || _changedProperties.has('_customEntityHistory');
            if (inputsChanged)
            {
                this._rebuildClockData();
            }
            if (_changedProperties.has('_clockHoverHour'))
            {
                this._startClockDim();
            }
            if (_changedProperties.has('_clockData'))
            {
                this._scheduleClockPaint();
            }
        }

        //Lazy Energy WS subscribe: HA can attach hass after connectedCallback, where the connect-time call
        //bailed without callWS. The helper is idempotent (checks _energyPrefsUnsub), so re-calling is safe.
        if (this.hass && !this._energyPrefsUnsub)
        {
            subscribeEnergyPrefs(this);
        }

        //Daily-totals kickoff: refreshHaDailyTotals at connect is a no-op (the HA Energy defaults haven't
        //landed yet, subscribeEnergyPrefs is async) and the 30 s tick is too far off for first paint. So
        //the moment _energyDefaultsLoaded flips true we fire one immediate refresh. The flag dedupes.
        if (this._energyDefaultsLoaded && !this._dailyTotalsKicked)
        {
            this._dailyTotalsKicked = true;
            refreshHaDailyTotals(this);
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

        //Create the engine once, the first time the card paints. It is then updated in place: setHome() on a
        //coordinate change, updateConfig() on an option change.
        if (!this._engine)
        {
            //Disconnected guard: edit-mode wrapping can fire updated() on a detached element.
            if (!this.isConnected)
            {
                return;
            }
            if (this._initInflight)
            {
                return;
            }
            this._lastHomeKey   = homeKey;
            this._lastConfigSig = computeConfigSig(this.config);
            initEngine(this);
            return;
        }

        //Home moved: re-tile + re-fetch for the new coordinates.
        if (identityChanged)
        {
            this._lastHomeKey = homeKey;
            this._engine.setHome(lat, lon);
        }

        //Push config down only when the visual config actually changed. Otherwise updateConfig() runs on every
        //Lit re-render (clock tick, any @state) and rebuilds the GeoJSON of thousands of points.
        const sig = computeConfigSig(this.config);
        if (sig !== this._lastConfigSig)
        {
            this._lastConfigSig = sig;
            this._engine.updateConfig(this.config);
        }

        //Refresh chain gate: the per-entity helpers are pure functions of hass.states + config + time
        //range. Lit calls updated() on every @state mutation (every HUD re-projection), so without this gate
        //the chain re-runs at 60+ Hz for no new data. Config is compared by content SIGNATURE, not object
        //reference: the dashboard editor hands the card a fresh-but-equivalent config object on every push,
        //and a reference check would flip the gate every frame and spin the refresh chain (and its fetches)
        //into a loop. Skip when none of these moved.
        if (this.hass === this._lastRefreshHassRef
            && sig === this._lastRefreshConfigSig
            && this._timeRange === this._lastRefreshTimeRangeRef
            && this._energyDefaults === this._lastRefreshEnergyDefaultsRef)
        {
            return;
        }
        this._lastRefreshHassRef           = this.hass;
        this._lastRefreshConfigSig         = sig;
        this._lastRefreshTimeRangeRef      = this._timeRange;
        this._lastRefreshEnergyDefaultsRef = this._energyDefaults;

        refreshPv(this);
        refreshBattery(this);
        refreshGrid(this);
        refreshIrradiance(this);
        //Custom entity: hourly history for the timeline curve + clock ring (fire-and-forget; keyed so an
        //unchanged window is a no-op).
        void refreshCustomEntity(this);
        //Solar forecast: read natively from HA's Energy dashboard (energy/solar_forecast). Non-fatal; with
        //no forecast source configured the call returns empty and the curve doesn't render. On the refresh
        //chain (which energy-prefs changes re-trip), so a freshly configured source lands next pass.
        fetchHaSolarForecast(this);
    }


    //Timeline pointer interaction

    _trackElement:   HTMLElement | null = null;
    _trackPointerId: number | null      = null;


    _boundPointerMove = (e: PointerEvent): void => onTimelinePointerMove(this, e);
    _boundPointerUp   = (e: PointerEvent): void => onTimelinePointerUp(this, e);


    //Page-visibility listener that invalidates the cached theme probe when the tab returns to foreground.
    //HA can push a hass with stale themes for one frame after resume, so we drop the cache and force a
    //re-render to pick up a theme polarity flip that happened while backgrounded.
    private _onPageVisibilityForTheme = (): void =>
    {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible')
        {
            this._cachedIsDarkThemesRef = undefined;
            this.requestUpdate();
        }
    };


    //Resolve the active theme polarity, used to drive the `theme-dark` / `theme-light` class on the card. The
    //basemap's dark tint and every theme colour follow that class in CSS, so this no longer pushes anything to
    //the engine. Authoritative: hass.themes.darkMode; the getComputedStyle fallback covers ancient HA builds
    //and custom themes that scope --primary-background-color below :host (only the fallback is cached).
    private _computeIsDark(themesObj: { darkMode?: boolean } | undefined): boolean
    {
        if (themesObj && typeof themesObj.darkMode === 'boolean')
        {
            return themesObj.darkMode;
        }
        if (this._cachedIsDarkThemesRef === themesObj)
        {
            return this._cachedIsDark;
        }
        const isDark = this._probeIsDarkFromCss();
        this._cachedIsDarkThemesRef = themesObj;
        this._cachedIsDark = isDark;
        return isDark;
    }

    //Current theme polarity, used to seed a new engine at construction.
    public themeIsDark(): boolean
    {
        return this._computeIsDark((this.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes);
    }


    //Fallback luminance probe: reads --primary-background-color and decides dark vs light by relative
    //luminance. Costly (forces a style recompute), so only reached when hass.themes.darkMode is undefined.
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


    //Nearest point on the home pill's stadium outline to (chipX, chipY): the straight top/bottom edge over
    //the middle, the rounded end-cap arc beyond it. All chip leaders dock here so the home reads as the
    //focal energy node.
    private _nudgeToHomePill(
        chipX: number, chipY: number,
        homeX: number, homeY: number,
    ): { x: number; y: number }
    {
        const halfW = HeliosCard.HOME_PILL_HALF_WIDTH_PX;
        const halfH = HeliosCard.HOME_PILL_HALF_HEIGHT_PX;
        const ex = chipX - homeX;
        const ey = chipY - homeY;
        //Width of the straight middle (between the two end-cap semicircles).
        const straightHalfW = Math.max(0, halfW - halfH);
        if (Math.abs(ex) <= straightHalfW)
        {
            //Over the straight middle: dock on the nearest top/bottom edge.
            return { x: chipX, y: homeY + (ey >= 0 ? 1 : -1) * halfH };
        }
        //Over an end cap: dock on the matching semicircle arc.
        const cornerX = homeX + (ex >= 0 ? 1 : -1) * straightHalfW;
        const dx = chipX - cornerX;
        const dy = chipY - homeY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: cornerX + (halfH * dx) / dist, y: homeY + (halfH * dy) / dist };
    }


    //One sunrise/sunset marker: a glyph + local time pinned just OUTSIDE the arc at the horizon crossing
    //(offset radially out from the home so it clears the arc line). Null crossing (polar day/night) → nothing.
    private _renderSunCrossing(
        cross:   { x: number; y: number; time: Date } | null,
        home:    { x: number; y: number },
        icon:    string,
        color:   string
    ): TemplateResult | typeof nothing
    {
        if (!cross)
        {
            return nothing;
        }
        const dx   = cross.x - home.x;
        const dy   = cross.y - home.y;
        const dist = Math.hypot(dx, dy) || 1;
        const lx   = cross.x + (dx / dist) * 22;
        const ly   = cross.y + (dy / dist) * 22;
        const t    = cross.time.toLocaleTimeString(this.hass?.locale?.language ?? undefined,
            { hour: '2-digit', minute: '2-digit' });
        return html`
            <div
                class="sun-cross-marker"
                style="left:${lx.toFixed(1)}px; top:${ly.toFixed(1)}px; --sun-cross-color:${color}"
            >
                <ha-icon icon="${icon}"></ha-icon>
                <span>${t}</span>
            </div>
        `;
    }


    //Render

    protected render(): TemplateResult
    {
        //Precondition for the live card chrome: home coordinates resolved (HA config or card-level lat/lon
        //override). The basemap is keyless CARTO raster tiles, so this is purely "can we project the home".
        const hasHomeCoords = getHomeCoords(this.config, this.hass) !== null;


        //Always-visible cloud-cover % label above the home, with an SVG leader to the on-ground 100% ring.
        //Both anchors come pre-projected from engine.projectHomeLabelLayout(). Suppressed until both the
        //layout (map ready) and a cloud-cover value (data ready) exist.
        const layout         = this._labelLayout;

        //PV production chip above the home, tied to it by an animated leader. Only renders when the HA
        //Energy dashboard exposes a solar source and the live read is a finite number.
        const pvEntityId   = resolvePvLiveEntity(this._energyDefaults);
        //ENERGY_COLOR.pv resolves the HA Energy solar token; inline SVG attrs that need a literal hex
        //(not a CSS var) read it directly so colours stay in sync with the CSS rules using the same token.
        const pvColor      = ENERGY_COLOR.pv(this);
        //Past scrub: the chip reflects actual production at that instant (like the cloud/irradiance chips).
        //Future scrub has no PV data yet, so we hide the chip rather than show a stale/fake number.
        const pvScrubbing  = !this._isLiveMode && this._selectedTime !== null;
        const pvScrubFuture = pvScrubbing
            && this._selectedTime!.getTime() > Date.now() + 60_000;

        //The chip shows instantaneous production at the active instant (live now by default, the scrub
        //target in the past). Power sensors (W/kW) plot their state/historical sample; cumulative-energy
        //sensors (Wh/kWh) are differentiated over the rolling buffer (live) or the bracketing history pair
        //(scrub). Never the lifetime total, which is meaningless on a "current production" readout.
        const pvRate = (pvEntityId !== '' && layout !== null)
            ? (pvScrubbing
                ? pvRateAtTime(this, this._selectedTime!)
                : (this._pvCurrent !== null ? currentPvRate(this) : null))
            : null;

        //Predicted PV at a future scrub instant, from the unified store's corrected forecast (the exact
        //series the dotted timeline curve draws), so the chip never disagrees with its line. Null (hidden)
        //when the store isn't built or the instant has no forecast.
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

        //User-configured decimal precision, applied to every chip readout (kW/kWh).
        const valueDec = valueDecimals(this.config);
        const pvDisplayValue = showPvLabel
            ? (isPvPredicted ? '≈ ' : '') + formatPvValue(this.hass, pvActiveRate!.value, pvActiveRate!.unit, valueDec)
            : '';

        //PV -> home animated leader (dashed line + arrow, PV colour). Flow speed normalised against a 5 kW
        //reference. Idle (no flow/arrow) when current production is <= 0.
        const pvWattsNow = (pvRate !== null)
            ? pvNormalizeToWatts(pvRate.value, pvRate.unit)
            : 0;
        //PV leader flow saturates at a fixed 5 kW reference.
        const pvPeakRefW  = 5000;
        const pvFlowDuration = flowDuration(pvWattsNow, pvPeakRefW, 0.5);
        const pvIdle         = !(pvWattsNow > 0);
        //Battery overlay: two chips flanking the PV chip (SoC % left, signed Power right), each wired to it
        //by a static dotted hairline; the power sign is the only charging-vs-discharging encoding. Scrub
        //mirrors PV: live reads hass.states, past-scrub reads the WS history series, future-scrub hides both.
        //Chip eligibility from the HA Energy defaults: a stat_soc source lights the SoC chip; a power
        //source (stat_rate, or stat_energy_from/to without a power_config block) lights the Power chip.
        //They render independently, so a SoC-only install still paints the vessel.
        const batteryEntities    = resolveBatteryEntities(this._energyDefaults);
        const hasAnyBankSoc      = batteryEntities.socEntity   !== null;
        const hasAnyBankPower    = batteryEntities.powerEntity !== null;
        const batteryScrubbing   = !this._isLiveMode && this._selectedTime !== null;
        const batteryScrubFuture = batteryScrubbing
            && this._selectedTime!.getTime() > Date.now() + 60_000;

        //Grid IN/OUT past-scrub: average watts at the scrub instant from the recorder change series, so the
        //chip shows what flowed then. Skip in future scrub (no data) and live mode (live values already set).
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

        //Active SoC/power values for this render: historical samples in scrub mode, live state otherwise.
        const activeBatterySoc: number | null = batteryScrubbing
            ? batterySampleAtTime(this._batterySocHistory, this._selectedTime!)
            : this._batterySoc;
        //Battery power scrub: net the charge/discharge change series (charge - discharge) for a structural
        //sign. Live mode reads the live signed value.
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
        //Power unit is watts on both paths (change series resolves to W, live read normalises to W), so the
        //chip formats consistently regardless of mode.
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
        //Chip uses the HA energy dashboard sign convention (discharge positive, charge negative).
        //activeBatteryPower is the physical charge-positive net, so it's negated for display to stay
        //coherent with the dashboard. Colour + leader direction below keep the physical sign.
        const batteryPowerText = showPowerChip
            ? formatBatteryPower(this.hass, -activeBatteryPower!, activeBatteryUnit, valueDec)
            : '';

        //Home consumption chip:
        //  used_total = from_grid + solar + from_battery - to_grid - to_battery
        //over the card's scrub-aware per-family values, so the chip follows the scrub.
        //Families contribute only when they have a reading; nothing wired -> chip hides. Clamped at zero
        //(a small negative is meter skew).
        const usagePvW = (!pvScrubFuture && pvActiveRate !== null)
            ? pvNormalizeToWatts(pvActiveRate.value, pvActiveRate.unit)
            : null;
        const usageGridW = (gridImportDisplayWatts !== null || gridExportDisplayWatts !== null)
            ? (gridImportDisplayWatts ?? 0) - (gridExportDisplayWatts ?? 0)
            : null;
        //activeBatteryPower is charge-positive, so it SUBTRACTS: charging is consumption that never reaches
        //the home, discharging (negative) adds supply.
        const usageBatteryW = showPowerChip ? activeBatteryPower! : null;
        const homeUsageWatts = (usagePvW === null && usageGridW === null && usageBatteryW === null)
            ? null
            : Math.max(0, (usagePvW ?? 0) + (usageGridW ?? 0) - (usageBatteryW ?? 0));
        const showHomeUsageChip = hasHomeCoords
            && layout !== null
            && !batteryScrubFuture
            && homeUsageWatts !== null;
        const homeUsageText = showHomeUsageChip
            ? formatGridValue(this.hass, homeUsageWatts, 'W', valueDec)
            : '';

        //Charge/discharge direction (PHYSICAL sign, positive = charging) drives the PV<->Power leader
        //arrow: charging flows PV -> Power (into the battery) at a speed proportional to |P| saturating at
        //~5 kW. The dual-tone leader colour tracks the physical direction, independent of the chip's HA-sign
        //flip above.
        const batteryCharging = showPowerChip && (activeBatteryPower! > 0);
        const batteryDischarging = showPowerChip && (activeBatteryPower! < 0);
        const batteryLeaderColor = batteryCharging
            ? 'var(--energy-battery-in-color, #f06292)'
            : 'var(--energy-battery-out-color, #4db6ac)';
        const batteryWattsForFlow = showPowerChip
            ? Math.abs(pvNormalizeToWatts(activeBatteryPower!, activeBatteryUnit))
            : 0;
        //Idle: power within sensor-noise margin of zero (±5 W). The leader is still drawn (keeps the
        //spatial relationship) but the dash flow is frozen and the arrow hidden, since any motion would
        //be misleading.
        const batteryIdle = showPowerChip && batteryWattsForFlow < 5;
        const batteryFlowDuration = flowDuration(batteryWattsForFlow, 5000);

        //PV_HALF_HEIGHT_PX places the top of a leader's vertical leg flush against PV's bottom edge so the
        //line emerges from the chip, not inside it.
        const PV_HALF_HEIGHT_PX    = 11;
        //Half-width of the PV chip, used by the solar-ray target snap. Sized to the narrowest realistic
        //text ("0 W") so the snap lands at-or-before the chip border even on short text and the ray never
        //draws over the chip body.
        const PV_HALF_WIDTH_PX  = 28;
        //Build a rounded L from a chip to the home pill: horizontal leg toward the home's vertical axis,
        //fillet, vertical leg to the pill border. chipX/chipY is the chip centre; the leader starts at the
        //chip edge nudged by chipNudgePx toward the home.
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
            //Land the vertical leg ~13 px off centre so two leaders on the same row don't collide on the
            //pill's axis. That x sits over the stadium's flat edge, so the leg docks at the half-height.
            const HOME_PILL_QUARTER_X = 13;
            const ex = homeX - dirH * HOME_PILL_QUARTER_X;
            const ey = homeY - dirV * HeliosCard.HOME_PILL_HALF_HEIGHT_PX;
            //Fillet radius, clamped to fit inside both legs of the L.
            const FILLET_R = 12;
            const r = Math.min(FILLET_R, Math.abs(ex - sx) / 2, Math.abs(ey - sy) / 2);
            const preX  = ex - dirH * r;
            const postY = sy + dirV * r;
            return `M ${sx.toFixed(1)},${sy.toFixed(1)} L ${preX.toFixed(1)},${sy.toFixed(1)} Q ${ex.toFixed(1)},${sy.toFixed(1)} ${ex.toFixed(1)},${postY.toFixed(1)} L ${ex.toFixed(1)},${ey.toFixed(1)}`;
        };
        //Rounded L between two arbitrary points. verticalFirst=true draws the vertical leg first, then the
        //horizontal into the end (used PV -> Power, dropping down then right). Same fillet as buildLPathToHome.
        const buildLPath = (
            sx: number, sy: number, ex: number, ey: number, verticalFirst: boolean
        ): string =>
        {
            const FILLET_R = 12;
            const dirH = ex > sx ? 1 : -1;
            const dirV = ey > sy ? 1 : -1;
            const r = Math.min(FILLET_R, Math.abs(ex - sx) / 2, Math.abs(ey - sy) / 2);
            if (verticalFirst)
            {
                const preY  = ey - dirV * r;
                const postX = sx + dirH * r;
                return `M ${sx.toFixed(1)},${sy.toFixed(1)} L ${sx.toFixed(1)},${preY.toFixed(1)} Q ${sx.toFixed(1)},${ey.toFixed(1)} ${postX.toFixed(1)},${ey.toFixed(1)} L ${ex.toFixed(1)},${ey.toFixed(1)}`;
            }
            const preX  = ex - dirH * r;
            const postY = sy + dirV * r;
            return `M ${sx.toFixed(1)},${sy.toFixed(1)} L ${preX.toFixed(1)},${sy.toFixed(1)} Q ${ex.toFixed(1)},${sy.toFixed(1)} ${ex.toFixed(1)},${postY.toFixed(1)} L ${ex.toFixed(1)},${ey.toFixed(1)}`;
        };

        //Battery chip stack: Power (kW) on top, State-of-charge (%) below, sharing the same x.
        const BATTERY_HALF_HEIGHT_PX = 14;
        const socChipX   = layout?.batterySocLabel.x   ?? 0;
        const socChipY   = layout?.batterySocLabel.y   ?? 0;
        const powerChipX = layout?.batteryPowerLabel.x ?? 0;
        const powerChipY = layout?.batteryPowerLabel.y ?? 0;
        //SoC -> Power chip: same battery, so the SoC leader docks on the Power chip, not the home. Straight
        //vertical hairline between their facing edges (SoC below Power). No flow, it's a level.
        //SoC -> Power hairline: only when BOTH battery chips show, else it would point at an empty slot.
        const socLeaderPath = (layout && showPowerChip)
            ? `M ${socChipX.toFixed(1)},${(socChipY - BATTERY_HALF_HEIGHT_PX).toFixed(1)} L ${powerChipX.toFixed(1)},${(powerChipY + BATTERY_HALF_HEIGHT_PX).toFixed(1)}`
            : '';
        //SoC -> home: the battery->home discharge flow (rounded L + bead), only while discharging. It
        //leaves the SoC chip (lower, nearest the home) so the Power chip stays a clean top node PV feeds.
        const dischargeLeaderPath = (layout && batteryDischarging)
            ? buildLPathToHome(socChipX, socChipY, 22)
            : '';
        //SoC-only installs (no Power chip): a static connector docks the lone SoC chip to the home hub like
        //every other chip, instead of leaving it floating. Skipped while discharging (that leader docks it).
        const socHomeLeaderPath = (layout && showSocChip && !showPowerChip && !batteryDischarging)
            ? buildLPathToHome(socChipX, socChipY, 22)
            : '';
        //PV -> Power chip, only while charging: an inverted L dropping from the PV chip then right into the
        //Power chip's left edge, PV-coloured bead toward the battery. Removed the instant it discharges.
        //Its drop starts halfway between the PV->home leg (chip centre) and the chip's right edge so the two
        //leaders leaving the PV chip don't overlap at their root.
        const PV_TO_BATTERY_NUDGE_X = 30;
        const pvToBatteryPath = (layout && batteryCharging && showPvLabel)
            ? buildLPath(
                layout.pvLabel.x + PV_HALF_WIDTH_PX / 2,
                layout.pvLabel.y + PV_HALF_HEIGHT_PX,
                powerChipX - PV_TO_BATTERY_NUDGE_X,
                powerChipY,
                true
            )
            : '';
        const gridLeaderPath       = buildLPathToHome(layout?.gridLabel.x         ?? 0, layout?.gridLabel.y         ?? 0, 22);

        //Grid bead cadence: frequency (= 1/dur) is proportional to live power so bead speed tracks the chip
        //value linearly, via dur = MIN_DUR * CAP / watts (MIN_DUR at cap, 2x at half, 4x at a quarter),
        //clamped to MAX_DUR_S. Below ~5 W the chip is idle (recorder noise) and the bead is dropped. Caps
        //are round residential thresholds: 5 kW import, 1 kW export.
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
        //Single grid chip shows the ACTIVE flow only: the larger display value wins and drives colour,
        //value, icon and bead direction. Scrub-aware watts feed the choice so it tracks the timeline. Ties
        //(including idle 0/0) fall to import, a neutral consumption-blue resting state.
        const gridImporting    = (gridImportDisplayWatts ?? 0) >= (gridExportDisplayWatts ?? 0);
        const gridLeaderColor  = gridImporting
            ? 'var(--energy-grid-consumption-color, #488fc2)'
            : 'var(--energy-grid-return-color, #8353d1)';
        //Bead cadence from the active side; null (no bead) when it's below the idle threshold, so an idle
        //grid shows the chip + a static leader with no misleading motion.
        const gridBeadDur      = gridImporting ? gridImportBeadDur : gridExportBeadDur;

        //Custom user-picked entity chip: red pill top-left (above grid) with a leader to the home and a
        //sign-driven bead. Positive value flows home -> chip (reversed traversal), negative flows chip ->
        //home (default). Cadence scales with the value's magnitude; below the idle floor the bead is dropped.
        const customLive        = resolveCustomEntityLive(this.hass, customEntityId(this.config));
        const customIcon        = resolveCustomEntityIcon(this.hass, this.config);
        const customLeaderColor = CUSTOM_ENTITY_COLOR;
        const customLeaderPath  = buildLPathToHome(layout?.customLabel.x ?? 0, layout?.customLabel.y ?? 0, 22);
        const CUSTOM_BEAD_CAP_W     = 5000;
        const CUSTOM_BEAD_MIN_DUR_S = 1.2;
        const CUSTOM_BEAD_MAX_DUR_S = 8.0;
        const CUSTOM_BEAD_IDLE_W    = 5;
        const customMagW   = customLive ? customLive.magnitudeW : 0;
        const customBeadDur = (!customLive || customMagW < CUSTOM_BEAD_IDLE_W)
            ? null
            : Math.min(CUSTOM_BEAD_MAX_DUR_S, Math.max(CUSTOM_BEAD_MIN_DUR_S,
                CUSTOM_BEAD_MIN_DUR_S * CUSTOM_BEAD_CAP_W / Math.max(customMagW, 1)));
        const customPositive = customLive ? customLive.signedValue >= 0 : true;

        //Solar-arc overlay: sun trajectory, current position and incidence ray to the home, all
        //pre-projected to screen space via projectSunScene(). Hidden until the engine is ready.
        const sunScene  = this._sunScene;
        const showSun   = hasHomeCoords && sunScene !== null && sunScene.arc.length >= 2;

        //Fixed colour design system. The sun colour paints the arc, the disc rim and the irradiance fill.
        //The on-ground cloud disc is painted engine-side, so no cloud hex is needed here.
        const sunColor      = ENERGY_COLOR.sun(this);
        const sunRimColor   = darkenHex(sunColor, 0.20);
        const arcSegments   = showSun ? buildArcSegments(sunScene!.arc, sunColor) : [];
        //Z-order split: below-horizon (dotted) segments render BEHIND the home chip cluster, above-horizon
        //in front so the live sun dominates. Single-pass split into reused scratch buffers (no filter()
        //allocations per cycle).
        const arcSegmentsBack     = this._arcBackBuf;
        const arcSegmentsFrontFar  = this._arcFrontBuf;
        const arcSegmentsFrontNear = this._arcFrontNearBuf;
        arcSegmentsBack.length      = 0;
        arcSegmentsFrontFar.length  = 0;
        arcSegmentsFrontNear.length = 0;
        //Above-horizon segments get a 2nd split by camera nearness: the half closest to the eye renders
        //ABOVE the home chips (over leaders + pill), the half arching away renders BEHIND. Threshold is the
        //nearness midpoint.
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

        //The incidence ray only renders when the sun is above the horizon (a ray from below ground would be
        //visually nonsensical).
        const showRay = showSun && sunScene!.sun.altitude > 0;

        //Live irradiance for the W/m² label above the sun disc, also driving the inner-disc fill ratio: at
        //STC (1000 W/m²) the fill reaches the rim, at zero it vanishes. The sqrt mapping linearises AREA
        //perception (area ∝ r²) so a 50% reading covers half the rim's area, not its radius.
        const sunWm2          = sunScene?.sun.irradiance ?? 0;
        const sunWm2Round     = Math.round(sunWm2);
        const sunFillRatio    = Math.sqrt(Math.max(0, Math.min(1, sunWm2 / 1000)));
        const showSunLabel    = showSun && sunScene!.sun.altitude > 0;
        //Solar-ray dash-flow duration, same scale as the PV leader so both streams pulse coherently;
        //saturates at 1000 W/m². The ray spans the whole card, so its saturated pace is a touch slower than
        //the PV leader (0.8 s) to stay readable at peak irradiance.
        const sunFlowDuration = flowDuration(sunWm2, 1000, 0.8);

        //Solar-ray target: anchor the ray to the nearest point of the PV chip outline so a sun below the chip
        //doesn't draw the ray through the chip body.
        let sunRayTargetX = sunScene?.home.x ?? 0;
        let sunRayTargetY = sunScene?.home.y ?? 0;
        //Anchor the ray to the nearest point of the PV chip's stadium outline (centred at pvLabel, straight
        //middle + two end-caps of radius PV_HALF_HEIGHT_PX) so it glides along the outline as the sun arcs.
        if (layout && sunScene && pvEntityId)
        {
            const cx = layout.pvLabel.x;
            const cy = layout.pvLabel.y;
            const halfW = PV_HALF_WIDTH_PX;
            const halfH = PV_HALF_HEIGHT_PX;
            const ex = sunScene.sun.x - cx;
            const ey = sunScene.sun.y - cy;
            //Width of the rectangular middle (between the end-cap semicircles).
            const straightHalfW = Math.max(0, halfW - halfH);

            if (Math.abs(ex) <= straightHalfW)
            {
                //Sun over the straight middle: nearest point is on the top/bottom edge under the sun.
                sunRayTargetX = sunScene.sun.x;
                sunRayTargetY = cy + (ey >= 0 ? 1 : -1) * halfH;
            }
            else
            {
                //Sun off to a rounded end: nearest point is on the matching end-cap arc, along the line
                //from the end-cap centre to the sun.
                const cornerX = cx + (ex >= 0 ? 1 : -1) * straightHalfW;
                const cornerY = cy;
                const dx = sunScene.sun.x - cornerX;
                const dy = sunScene.sun.y - cornerY;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                sunRayTargetX = cornerX + halfH * dx / dist;
                sunRayTargetY = cornerY + halfH * dy / dist;
            }
        }

        //Detect the active HA theme. Authoritative: hass.themes.darkMode (HA flips it on every theme swap).
        //A getComputedStyle luminance probe is the fallback for older HA builds that lack it.
        const themesObj = (this.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes;
        const isDark = this._computeIsDark(themesObj);
        const cardThemeClass = isDark ? 'theme-dark' : 'theme-light';

        //camera-locked swaps the grab cursor for the default arrow when the camera is pinned (pan + rotate
        //disabled, so the open-hand cursor would be misleading). Re-evaluated every render.
        const cameraLocked = this._isCameraLocked();
        const cardClasses = [
            cardThemeClass,
            cameraLocked      ? 'camera-locked'  : '',
            this.preview      ? 'helios-edit'    : '',
            this._viewMode === 'clock' ? 'mode-clock' : '',
            this._viewMode === 'lidar' ? 'mode-lidar' : '',
        ].filter(Boolean).join(' ');

        return html`
            <ha-card class="${cardClasses}">

                <div
                    id="map-container"
                    @pointermove="${(e: PointerEvent) => this._onClockHover(e)}"
                    @pointerleave="${() => this._onClockHoverEnd()}"
                    @pointerdown="${(e: PointerEvent) => this._onClockTapStart(e)}"
                    @pointerup="${(e: PointerEvent) => this._onClockTapEnd(e)}"
                ></div>

                ${hasHomeCoords && this._viewMode === 'clock' ? html`
                    <div class="clock-overlay">
                        <svg class="clock-svg" xmlns="http://www.w3.org/2000/svg"></svg>
                        ${Array.from({ length: 24 }, (_unused, h) => html`
                            <div class="clock-hour-label">${this._formatClockHour(h)}</div>
                        `)}
                        ${[
                            { l: 'N', c: 'var(--red-color, #f44336)' },
                            { l: 'S', c: 'var(--primary-text-color, #212121)' },
                        ].map(o => html`<div class="clock-compass-label" style="color:${o.c}">${o.l}</div>`)}
                        ${this._clockHoverHour !== null
                            ? this._renderClockTooltip(this._clockHoverHour)
                            : nothing}
                    </div>
                ` : nothing}

                ${hasHomeCoords && this._timeRange && this._viewMode === 'scene' ? html`
                    <div
                        class="time-bar"
                        @pointerdown="${(e: PointerEvent) => onTimelinePointerDown(this, e)}"
                    >
                        <!--  Header row just above the chart: the active-target indicator on the left
                              (what the timeline currently shows) and the rolling-period selector on the
                              right, at the same height. The selector swallows its own pointer-down so
                              tapping a preset never starts a scrub on the parent .time-bar.  -->
                        <div class="tb-header">
                            ${this._renderChartIndicator()}
                            ${this._renderPeriodSelector()}
                        </div>

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

                        <!--  Single re-targetable bottom chart: the active _chartTarget picks the series
                              (production + dashed forecast + per-source breakdown by default; grid /
                              battery / irradiance once a chip re-targets it). Hosts the dotted day
                              separators, the night-zone hatch, the future mask and the live + scrub
                              cursors. The day-label strip sits below so it never covers the curves.  -->
                        <div
                            class="tb-chart-stack"
                            style="--chart-accent:${chartAccentColor(this)}"
                        >
                            <div
                                class="tb-chart-card"
                                @pointermove="${(e: PointerEvent) => handleChartHoverMove(this, e)}"
                                @pointerleave="${() => handleChartHoverLeave(this)}"
                            >
                                ${keyed(this._chartTarget, renderBottomChart(this))}
                                ${renderTimelineNightZones(this)}
                                ${renderTimelineFutureMask(this)}
                                ${renderTimelineTicks(this)}
                            </div>
                            ${renderTimelineDayLabels(this)}
                        </div>
                    </div>
                ` : nothing}

<!--  Camera lock chip (top-left). Tapping flips the
                      lock and asks the engine to persist the pose
                      (bearing + pitch + lock flag) to localStorage for
                      the next reload. No tooltip/label: the padlock
                      glyph carries the meaning and tooltips are
                      useless on touch.                              -->
                ${hasHomeCoords ? (() => {
                    const cameraLocked  = this._isCameraLocked();
                    const lockIcon      = cameraLocked ? 'mdi:lock' : 'mdi:lock-open-variant';
                    const sceneOn       = this._viewMode === 'scene';
                    const clockOn       = this._viewMode === 'clock';
                    const lidarOn       = this._viewMode === 'lidar';
                    //The LiDAR mode button only appears when a local nDSM is configured.
                    const lidarAvailable = hasLocalLidar(this.config);
                    return html`
                        <div class="overlay-top-left">
                            <button
                                type="button"
                                class="overlay-btn ${sceneOn ? 'is-on' : ''}"
                                aria-pressed="${sceneOn ? 'true' : 'false'}"
                                title="Scene"
                                @click="${() => this._setViewMode('scene')}"
                            >
                                <ha-icon icon="mdi:weather-sunny"></ha-icon>
                            </button>
                            <button
                                type="button"
                                class="overlay-btn ${clockOn ? 'is-on' : ''}"
                                aria-pressed="${clockOn ? 'true' : 'false'}"
                                title="Clock"
                                @click="${() => this._setViewMode('clock')}"
                            >
                                <ha-icon icon="mdi:clock-outline"></ha-icon>
                            </button>
                            ${lidarAvailable ? html`
                                <button
                                    type="button"
                                    class="overlay-btn ${lidarOn ? 'is-on' : ''}"
                                    aria-pressed="${lidarOn ? 'true' : 'false'}"
                                    title="LiDAR"
                                    @click="${() => this._setViewMode('lidar')}"
                                >
                                    <ha-icon icon="mdi:satellite-variant"></ha-icon>
                                </button>
                            ` : nothing}
                            <button
                                type="button"
                                class="overlay-btn ${cameraLocked ? 'is-on' : ''}"
                                aria-pressed="${cameraLocked ? 'true' : 'false'}"
                                @click="${this._onCameraLockToggle}"
                            >
                                <ha-icon icon="${lockIcon}"></ha-icon>
                            </button>
                        </div>
                    `;
                })() : nothing}

                <!--  Right-hand metric rail (clock mode): one button per configured metric, stacked with no
                      gaps. Multi-select FILTERS — each active metric adds a concentric ring; the active ones
                      fill with their own colour.  -->
                ${hasHomeCoords && this._viewMode === 'clock' ? (() => {
                    const targets = availableClockTargets(this);
                    if (!targets.length) { return nothing; }
                    return html`
                        <div class="overlay-top-right">
                            ${targets.map(t => {
                                const meta = clockTargetMeta(this, t);
                                const on   = this._clockTargets.includes(t);
                                const lbl  = clockTargetLabel(this, t);
                                return html`
                                    <button
                                        type="button"
                                        class="overlay-btn ${on ? 'is-on' : ''}"
                                        style="--clock-btn-color:${meta.color}"
                                        aria-pressed="${on ? 'true' : 'false'}"
                                        title="${lbl}"
                                        aria-label="${lbl}"
                                        @click="${() => this._toggleClockTarget(t)}"
                                    >
                                        <ha-icon icon="${meta.icon}"></ha-icon>
                                    </button>
                                `;
                            })}
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
                <!--  Empty slot kept so the home stack stays
                      vertically anchored for the leaders below. -->
                ${nothing}

                ${showPvLabel ? (() => {
                    //Leader endpoint = the home pill's border on the chip-to-home axis (the shared docking
                    //point for every chip leader).
                    const pvX1 = layout!.pvLabel.x;
                    const pvY1 = layout!.pvLabel.y + PV_HALF_HEIGHT_PX;
                    const pvHomeEnd = this._nudgeToHomePill(
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
                                  production. No rotate="auto" needed
                                  since a disc has no orientation.  -->
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
                        class="pv-pct-label ${isPvPredicted ? 'is-predicted' : ''} ${this._chartTarget === 'production' ? 'is-chart-active' : ''}"
                        style="left:${layout!.pvLabel.x}px; top:${layout!.pvLabel.y}px; --pv-leader-color:${pvColor}"
                        role="button"
                        tabindex="0"
                        @click=${() => this._setChartTarget('production')}
                    >
                        <ha-icon icon="mdi:solar-power"></ha-icon>
                        <span>${pvDisplayValue}</span>
                    </div>
                ` : nothing}

                ${(showSocChip || showPowerChip) ? html`
                    <svg class="battery-leader-svg">
                        <!--
                            SoC → Power chip, solid straight vertical
                            hairline between the two stacked chips. No
                            animation: SoC is a level, not a flow.
                        -->
                        ${socLeaderPath ? svg`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${batteryLeaderColor}"
                                d="${socLeaderPath}"
                            ></path>
                        ` : nothing}
                        <!--  SoC → home static connector when the SoC chip is the only battery chip. -->
                        ${socHomeLeaderPath ? svg`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${batteryLeaderColor}"
                                d="${socHomeLeaderPath}"
                            ></path>
                        ` : nothing}
                        <!--
                            SoC → home, the battery→home discharge
                            flow: solid rounded-L + bead toward the
                            home, drawn only while the battery is
                            discharging to feed the house.
                        -->
                        ${dischargeLeaderPath ? svg`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${batteryLeaderColor}"
                                d="${dischargeLeaderPath}"
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
                                        path="${dischargeLeaderPath}"
                                    ></animateMotion>
                                </circle>
                            ` : nothing}
                        ` : nothing}
                        <!--
                            PV → Power chip, only while charging: an
                            inverted L (down then right) in the PV
                            colour with a bead flowing toward the
                            battery, so the user sees the PV feeding it.
                        -->
                        ${pvToBatteryPath ? svg`
                            <path
                                class="pv-home-leader-line"
                                style="--pv-leader-color:${pvColor}"
                                fill="none"
                                d="${pvToBatteryPath}"
                            ></path>
                            ${!batteryIdle ? svg`
                                <circle
                                    class="pv-home-leader-bead"
                                    r="3"
                                    fill="${pvColor}"
                                >
                                    <animateMotion
                                        dur="${batteryFlowDuration}s"
                                        repeatCount="indefinite"
                                        path="${pvToBatteryPath}"
                                    ></animateMotion>
                                </circle>
                            ` : nothing}
                        ` : nothing}
                    </svg>
                    ${showSocChip ? html`
                        <div
                            class="battery-pct-label ${this._chartTarget === 'battery-soc' ? 'is-chart-active' : ''}"
                            style="left:${layout!.batterySocLabel.x}px; top:${layout!.batterySocLabel.y}px; --battery-leader-color:${batteryLeaderColor}"
                            role="button"
                            tabindex="0"
                            @click=${() => this._setChartTarget('battery-soc')}
                        >
                            <ha-icon icon="mdi:battery"></ha-icon>
                            <span>${batterySocText}</span>
                        </div>
                    ` : nothing}
                    ${showPowerChip ? html`
                        <div
                            class="battery-pct-label ${this._chartTarget === 'battery' ? 'is-chart-active' : ''}"
                            style="left:${layout!.batteryPowerLabel.x}px; top:${layout!.batteryPowerLabel.y}px; --battery-leader-color:${batteryLeaderColor}"
                            role="button"
                            tabindex="0"
                            @click=${() => this._setChartTarget('battery')}
                        >
                            <ha-icon icon="mdi:lightning-bolt"></ha-icon>
                            <span>${batteryPowerText}</span>
                        </div>
                    ` : nothing}
                ` : nothing}

                <!--  Grid chip on the LEFT of the home, sitting on the
                      cluster's centre row. A single normal-size pill
                      that shows the ACTIVE flow only: when importing it
                      reads consumption blue with the import value and a
                      grid → home bead, when exporting it flips to return
                      purple with the export value and a home → grid
                      bead. The dominant side wins when both are live.
                      Same compact recipe as the other chips so the text
                      stays crisp under camera rotation.               -->
                <!--  Custom-entity chip (top-left, above grid). Red leader to the home; bead flows home ->
                      chip on a positive value, chip -> home on a negative one. Shown only when the entity is
                      configured and reads a finite value.  -->
                ${hasHomeCoords && layout !== null && customLive !== null ? html`
                    <svg class="custom-leader-svg">
                        <path class="custom-leader-line" style="stroke:${customLeaderColor}" d="${customLeaderPath}" />
                        ${customBeadDur !== null ? (customPositive ? svg`
                            <circle class="custom-leader-bead" r="3" style="fill:${customLeaderColor}">
                                <animateMotion dur="${customBeadDur.toFixed(2)}s" repeatCount="indefinite"
                                               keyPoints="1;0" keyTimes="0;1" path="${customLeaderPath}" />
                            </circle>
                        ` : svg`
                            <circle class="custom-leader-bead" r="3" style="fill:${customLeaderColor}">
                                <animateMotion dur="${customBeadDur.toFixed(2)}s" repeatCount="indefinite"
                                               path="${customLeaderPath}" />
                            </circle>
                        `) : nothing}
                    </svg>
                    <div
                        class="custom-label ${this._chartTarget === 'custom' ? 'is-chart-active' : ''}"
                        style="left:${layout!.customLabel.x}px; top:${layout!.customLabel.y}px; --custom-leader-color:${customLeaderColor}"
                        title="${customLive!.name}"
                        role="button"
                        tabindex="0"
                        @click=${() => this._setChartTarget('custom')}
                    >
                        <ha-icon icon="${customIcon}"></ha-icon>
                        <span>${customLive!.display}</span>
                    </div>
                ` : nothing}

                ${hasHomeCoords && layout !== null && (gridImportDisplayWatts !== null || gridExportDisplayWatts !== null) && !batteryScrubFuture ? html`
                    <svg class="grid-leader-svg">
                        <path class="grid-leader-line" style="stroke:${gridLeaderColor}" d="${gridLeaderPath}" />
                        <!--  Single bead on the active flow. Import
                              flows grid → home (default traversal),
                              export flows home → grid (keyPoints 1;0
                              reverses it). Dropped when the active side
                              is idle, no misleading motion.           -->
                        ${gridBeadDur !== null ? (gridImporting ? svg`
                            <circle class="grid-leader-bead" r="3" style="fill:${gridLeaderColor}">
                                <animateMotion dur="${gridBeadDur.toFixed(2)}s" repeatCount="indefinite"
                                               path="${gridLeaderPath}" />
                            </circle>
                        ` : svg`
                            <circle class="grid-leader-bead" r="3" style="fill:${gridLeaderColor}">
                                <animateMotion dur="${gridBeadDur.toFixed(2)}s" repeatCount="indefinite"
                                               keyPoints="1;0" keyTimes="0;1"
                                               path="${gridLeaderPath}" />
                            </circle>
                        `) : nothing}
                    </svg>
                    <div
                        class="grid-label ${this._chartTarget === 'grid' ? 'is-chart-active' : ''}"
                        style="left:${layout!.gridLabel.x}px; top:${layout!.gridLabel.y}px; --grid-leader-color:${gridLeaderColor}"
                        role="button"
                        tabindex="0"
                        @click=${() => this._setChartTarget('grid')}
                    >
                        <ha-icon icon="${gridImporting ? 'mdi:transmission-tower-export' : 'mdi:transmission-tower-import'}"></ha-icon>
                        <span>${formatGridValue(this.hass, gridImporting ? (gridImportDisplayWatts ?? 0) : (gridExportDisplayWatts ?? 0), gridImporting ? gridImportDisplayUnit : gridExportDisplayUnit, valueDec)}</span>
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
                      the chip border. The sun disc stays in the
                      depth-split SVG below so it passes in front of /
                      behind the home cluster depending on camera
                      bearing, while the ray never rides over the
                      production chip. -->
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
                            //Sun disc, four layers back-to-front:
                            //  0. Halo, radial-gradient glow whose radius (3× disc) and opacity scale with
                            //     irradiance, feathering into the basemap with no hard edge.
                            //  1. Background fill (SUN_FILL_OPACITY_BG) so the empty disc reads as tinted glass.
                            //  2. Inner fill, radius = sunFillRatio × outer; conveys irradiance (sub-px radii
                            //     vanish, the correct visual for "no sun").
                            //  3. Outer rim (darkened sun colour) for a clear edge against the basemap.
                            //Scale disc + halo by the same ramp the arc uses engine-side, so the disc-to-arc
                            //ratio holds across canvas sizes (1.0 at standard Lovelace grid sizes).
                            const sunArcScale = this._engine?.getSunArcScale() ?? 1;
                            //Cap the disc radius (px): the arc fills a fixed fraction of the frame at any
                            //zoom, but sunArcScale grows as the ground zoom drops (lower px/m), which would
                            //otherwise balloon the disc. 22 px keeps it a sun, not a spotlight.
                            const r = Math.min(
                                (HeliosCard.SUN_R_FAR
                                    + (HeliosCard.SUN_R_NEAR - HeliosCard.SUN_R_FAR) * sunScene!.sun.nearness)
                                    * sunArcScale,
                                22);
                            const rInner = r * sunFillRatio;
                            //Halo proportional to live irradiance, saturating at 1000 W/m². Same sqrt mapping
                            //as sunFillRatio so a 50% reading halves the glow's AREA, not its radius.
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
                        class="solar-pct-label ${this._chartTarget === 'irradiance' ? 'is-chart-active' : ''}"
                        style="left:${sunScene!.sun.x}px; top:${sunScene!.sun.y - 22}px"
                        role="button"
                        tabindex="0"
                        @click=${() => this._setChartTarget('irradiance')}
                    >
                        <ha-icon icon="mdi:white-balance-sunny"></ha-icon>
                        <span>${sunWm2Round} W/m²</span>
                    </div>
                ` : nothing}

                <!--  Cloud chip: a standalone pill just to the RIGHT of the irradiance chip, joined by a
                      short fixed cloud-coloured leader, showing the live cloud cover with a dynamic glyph.
                      Clicking it re-targets the timeline chart to the cloud cover (three altitude-band
                      curves), same chip <-> chart coupling as the other chips. Anchored off the sun so it
                      tracks the irradiance chip.  -->
                ${showSunLabel && this._cloudCover >= 0 ? (() =>
                {
                    //The cloud chip shares the irradiance chip's baseline (both bottom-anchored at sun.y-22,
                    //identical fixed width) and docks just past its edge, joined by a short cloud-coloured
                    //leader. It defaults to the RIGHT edge and flips to the LEFT when the cloud's far edge
                    //would overflow the card; when neither side fits, the roomier one wins.
                    const sx      = sunScene!.sun.x;
                    const bottomY = sunScene!.sun.y - 22;                       //shared chip baseline
                    const midY    = bottomY - HeliosCard.CHIP_HALF_H_PX;        //chips' centre, for the leader
                    const cardW   = this._engine?.getViewportWidth() ?? 0;
                    const HALF    = HeliosCard.CHIP_HALF_W_PX;                  //irradiance chip half-width
                    const CONN    = 16;                                         //leader length bridging the edges
                    const CLOUD_W = 76;                                         //cloud chip content-width upper bound
                    const far     = HALF + CONN + CLOUD_W;                      //sun.x → the cloud's far edge
                    const roomRight = cardW <= 0 || sx + far <= cardW - 8;
                    const roomLeft  = sx - far >= 8;
                    const side      = roomRight ? 1 : (roomLeft ? -1 : (sx < cardW / 2 ? 1 : -1));
                    const leaderLeft = side > 0 ? sx + HALF : sx - HALF - CONN;
                    const chipLeft   = side > 0 ? sx + HALF + CONN : sx - HALF - CONN;
                    //Bottom-align with the irradiance chip; anchor by the edge nearest it so the leader meets it.
                    const chipTransform = side > 0 ? 'translate(0, -100%)' : 'translate(-100%, -100%)';
                    return html`
                        <div
                            class="cloud-chip-leader"
                            style="left:${leaderLeft.toFixed(1)}px; top:${midY.toFixed(1)}px; width:${CONN}px"
                        ></div>
                        <div
                            class="cloud-chip ${this._chartTarget === 'cloud' ? 'is-chart-active' : ''}"
                            style="left:${chipLeft.toFixed(1)}px; top:${bottomY.toFixed(1)}px; transform:${chipTransform}"
                            role="button"
                            tabindex="0"
                            @click=${() => this._setChartTarget('cloud')}
                        >
                            <ha-icon icon="${cloudCoverIcon(this._cloudCover)}"></ha-icon>
                            <span>${Math.round(this._cloudCover)} %</span>
                        </div>
                    `;
                })() : nothing}

                <!--  Sunrise / sunset markers: a sun-coloured glyph + local time just outside the arc at
                      each horizon crossing.  -->
                ${showSun && sunScene ? html`
                    ${this._renderSunCrossing(sunScene.sunrise, sunScene.home, 'mdi:weather-sunset-up',   sunColor)}
                    ${this._renderSunCrossing(sunScene.sunset,  sunScene.home, 'mdi:weather-sunset-down', sunColor)}
                ` : nothing}



                <!--  Home pill: the hub the whole chip cluster orbits,
                      painted at the projected home centre with no
                      drop-leader so every chip leader docks straight
                      against its border. Hosts two stacked lines: the
                      home glyph on top and the live home consumption
                      below.                                           -->
                ${hasHomeCoords && layout !== null ? html`
                    <div
                        class="home-pill ${showHomeUsageChip ? 'has-usage' : ''} ${this._homeHover ? 'is-hovered' : ''} ${this._chartTarget === 'consumption' ? 'is-chart-active' : ''}"
                        style="left:${layout!.home.x}px; top:${layout!.home.y}px"
                        role="button"
                        tabindex="0"
                        @click=${() => this._setChartTarget('consumption')}
                        @mouseenter="${this._onHomeEnter}"
                        @mouseleave="${this._onHomeLeave}"
                    >
                        <ha-icon icon="mdi:home"></ha-icon>
                        ${showHomeUsageChip ? html`<span class="home-pill-usage">${homeUsageText}</span>` : nothing}
                    </div>
                ` : nothing}

            </ha-card>
        `;
    }


    //Per-card unique id namespacing SVG <defs> ids so multiple Helios cards don't clash on gradient/filter refs.
    _instanceId = `h${Math.floor(Math.random() * 1e9).toString(36)}`;

    //Hover handlers on the home hitbox. Toggle the sun-coloured glow halo so the focal building reads as
    //interactive. Cleared on exit so the glow can't stick if the cursor leaves mid-fade.
    private _onHomeEnter = (): void =>
    {
        this._homeHover = true;
    };
    private _onHomeLeave = (): void =>
    {
        this._homeHover = false;
    };

    //Unified store refresh: short-circuits when the host store matches the current data version (hash
    //compare), else rebuilds and assigns the @state. Setting it during updated() schedules one follow-up
    //render but doesn't loop (the rebuild has the same dataVersion, so the next isStoreFresh short-circuits).
    private _maybeRebuildUnifiedStore(): void
    {
        const host = this as unknown as UnifiedStoreHost;
        if (isStoreFresh(host, this._unifiedStore))
        {
            return;
        }
        this._unifiedStore = buildUnifiedStore(host);
    }

    //Reset timeline scrub state so the absolutely-positioned tooltip disappears next render.
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
    //Camera lock state for the top-left lock button. Delegates to the engine (which prefers localStorage
    //over the YAML flag), so the icon always matches the engine's lock state.
    private _isCameraLocked(): boolean
    {
        if (this._engine)
        {
            return this._engine.isCameraLocked();
        }
        return false;
    }
    //Lock-button click: flip the engine's lock state; the engine persists bearing, pitch and lock flag to
    //localStorage (HA's lovelace doesn't persist config-changed from a live card). The next reload restores.
    private _setViewMode(mode: 'scene' | 'clock' | 'lidar'): void
    {
        if (this._viewMode === mode)
        {
            return;
        }
        //Reset any clock animation state so the dial enters/leaves cleanly.
        this._clockAnimSeq++;
        this._clockExiting = [];
        this._clockSlotFrom.clear();
        this._clockSlideStart = 0;
        if (mode === 'clock')
        {
            //Entering clock with no saved filters: seed from the current chip so a ring shows immediately.
            if (this._clockTargets.length === 0)
            {
                this._clockTargets = [this._chartTarget];
            }
            this._rebuildClockData();
            //Reveal every ring with a grow when the dial first appears.
            const now = Date.now();
            this._clockGrowStart.clear();
            this._clockTargets.forEach(t => this._clockGrowStart.set(t, now));
            this._viewMode = mode;
            this._persistUiState();
            this._clockAnimate();
            return;
        }
        if (this._clockTargets.length > 0)
        {
            //Back to scene: the timeline (hidden in clock mode) re-applies the FIRST selected filter.
            this._setChartTarget(this._clockTargets[0]);
        }
        this._viewMode = mode;
        this._persistUiState();
    }

    //Toggle a metric in/out of the clock filter set (multi-select). Each active filter draws its own concentric
    //area; the first stays the timeline's target for when scene mode resumes. Order is preserved (append on
    //add). Adding grows the new area in; removing shrinks + fades it out while the survivors slide to recompact.
    private _toggleClockTarget = (target: ChartTarget): void =>
    {
        const i = this._clockTargets.indexOf(target);
        const adding = i < 0;
        //Snapshot every ring's CURRENT animated slot first, so the recompaction slides from where it is now
        //(robust to toggling again mid-animation) rather than teleporting.
        this._captureClockSlots();
        const now = Date.now();
        if (adding)
        {
            //Re-adding a metric that's still exiting: cancel its exit so we don't briefly draw it twice.
            this._clockExiting = this._clockExiting.filter(e => e.data.target !== target);
            this._clockTargets = [...this._clockTargets, target];
            this._clockGrowStart.set(target, now);
        }
        else
        {
            //Hand the removed ring to the independent exit list at its current slot + height, so an in-progress
            //grow shrinks from where it is (no jump to full) while survivors slide over it.
            const data = this._clockData[i];
            const gs   = this._clockGrowStart.get(target);
            const h0   = gs ? 1 - (1 - Math.min(1, (now - gs) / CLOCK_GROW_MS)) ** 3 : 1;
            if (data) { this._clockExiting.push({ data, slot: this._clockSlotFrom.get(target) ?? i, start: now, h0 }); }
            this._clockGrowStart.delete(target);
            this._clockTargets = this._clockTargets.filter(t => t !== target);
        }
        this._rebuildClockData();
        if (this._clockTargets.length > 0)
        {
            this._setChartTarget(this._clockTargets[0]);
        }
        this._persistUiState();
        this._clockAnimate();
    };

    //Snapshot each present ring's current animated slot into _clockSlotFrom and (re)anchor the slide clock, so
    //the next recompaction eases from the live positions instead of the integer indices.
    private _captureClockSlots(): void
    {
        const now    = Date.now();
        const slideP = this._clockSlideStart ? Math.min(1, (now - this._clockSlideStart) / CLOCK_GROW_MS) : 1;
        const eased  = 1 - (1 - slideP) ** 3;
        const snap   = new Map<ChartTarget, number>();
        this._clockData.forEach((data, i) =>
        {
            const from = this._clockSlotFrom.get(data.target) ?? i;
            snap.set(data.target, from + (i - from) * eased);
        });
        this._clockSlotFrom  = snap;
        this._clockSlideStart = now;
    }

    //Slice-focus dim fade: ramp _clockDim toward 1 while an hour is focused (others fade to 0.5), back to 0
    //when the hover/tap ends. _clockDimHour is kept through the fade-out so the dimmed bars + the focused
    //spoke ramp back smoothly. Instant in preview / reduced motion.
    private _startClockDim(): void
    {
        if (this._clockHoverHour !== null)
        {
            this._clockDimHour = this._clockHoverHour;
        }
        const target = this._clockHoverHour !== null ? 1 : 0;
        if (this.preview || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        {
            this._clockDim = target;
            if (target === 0) { this._clockDimHour = null; }
            this._scheduleClockPaint();
            return;
        }
        const id    = ++this._clockDimSeq;
        const from  = this._clockDim;
        const start = performance.now();
        const DUR   = 150;
        const tick = (now: number): void =>
        {
            if (id !== this._clockDimSeq || this._viewMode !== 'clock')
            {
                return;
            }
            const t = Math.min(1, (now - start) / DUR);
            this._clockDim = from + (target - from) * t;
            this._paintClock();
            if (t < 1)
            {
                requestAnimationFrame(tick);
            }
            else
            {
                this._clockDim = target;
                if (target === 0) { this._clockDimHour = null; }
                this._paintClock();
            }
        };
        requestAnimationFrame(tick);
    }

    //Per-home localStorage key for the card's UI state (view mode + selected chip). Mirrors the engine's
    //camera-pose key scheme so each home restores its own view. Null before coords resolve.
    private _uiStateRestored = false;
    //Join the cache-id registry in connection order, so a pasted card sharing the source's id gets its own
    //order-stable slot. Idempotent (HA edit-mode thrash re-fires connect).
    private _registerCacheId(): void
    {
        const id = cacheId(this.config);
        if (!id)
        {
            return;
        }
        const group = _cacheIdRegistry.get(id) ?? [];
        if (!group.includes(this))
        {
            group.push(this);
            _cacheIdRegistry.set(id, group);
        }
    }
    private _unregisterCacheId(): void
    {
        const id = cacheId(this.config);
        const group = id ? _cacheIdRegistry.get(id) : undefined;
        if (!group)
        {
            return;
        }
        const i = group.indexOf(this);
        if (i >= 0)
        {
            group.splice(i, 1);
        }
        if (group.length === 0)
        {
            _cacheIdRegistry.delete(id);
        }
    }
    //Effective per-card cache id: the configured id for the first card holding it, a stable `#N` suffix for
    //any same-id duplicate (a paste), '' when unconfigured (caller falls back to the home coordinates).
    public _effectiveCacheId(): string
    {
        const id = cacheId(this.config);
        if (!id)
        {
            return '';
        }
        const group = _cacheIdRegistry.get(id);
        const idx = group ? group.indexOf(this) : -1;
        return idx > 0 ? `${id}#${idx + 1}` : id;
    }

    private _uiStateStorageKey(): string | null
    {
        //A per-card cache id isolates cards on the same home (duplicates get a #N suffix); else fall back to
        //the home coordinates.
        const id = this._effectiveCacheId();
        if (id)
        {
            return `helios:ui-state:${id}`;
        }
        const coords = getHomeCoords(this.config, this.hass);
        if (!coords)
        {
            return null;
        }
        const lat = Math.round(coords.lat * 1000) / 1000;
        const lon = Math.round(coords.lon * 1000) / 1000;
        return `helios:ui-state:${lat}:${lon}`;
    }

    //Restore the saved view mode + selected chip once (the camera pose + lock restore inside the engine at
    //init). Runs as soon as coords resolve; a one-frame flash from the defaults is acceptable.
    private _restoreUiState(): void
    {
        if (this._uiStateRestored)
        {
            return;
        }
        const key = this._uiStateStorageKey();
        if (!key)
        {
            return;
        }
        this._uiStateRestored = true;
        try
        {
            const raw = window.localStorage.getItem(key);
            if (!raw)
            {
                return;
            }
            const s = JSON.parse(raw);
            if (s && typeof s === 'object')
            {
                if (s.viewMode === 'scene' || s.viewMode === 'clock'
                    || (s.viewMode === 'lidar' && hasLocalLidar(this.config)))
                {
                    this._viewMode = s.viewMode;
                }
                const valid: ChartTarget[] = ['production', 'consumption', 'grid', 'battery', 'battery-soc', 'irradiance', 'cloud', 'custom'];
                if (typeof s.chartTarget === 'string' && valid.includes(s.chartTarget as ChartTarget))
                {
                    this._chartTarget = s.chartTarget as ChartTarget;
                }
                //Clock filter set: keep order, drop dupes/unknowns. The timeline follows the first.
                if (Array.isArray(s.clockTargets))
                {
                    const seen = new Set<ChartTarget>();
                    const list: ChartTarget[] = [];
                    for (const t of s.clockTargets)
                    {
                        if (typeof t === 'string' && valid.includes(t as ChartTarget) && !seen.has(t as ChartTarget))
                        {
                            seen.add(t as ChartTarget);
                            list.push(t as ChartTarget);
                        }
                    }
                    this._clockTargets = list;
                    if (list.length > 0)
                    {
                        this._chartTarget = list[0];
                    }
                }
            }
        }
        catch (_)
        {
            //Disabled/quota/private-window storage degrades to "use defaults".
        }
    }

    private _persistUiState(): void
    {
        const key = this._uiStateStorageKey();
        if (!key)
        {
            return;
        }
        try
        {
            window.localStorage.setItem(key, JSON.stringify({
                viewMode:     this._viewMode,
                chartTarget:  this._chartTarget,
                clockTargets: this._clockTargets,
            }));
        }
        catch (_)
        {
            //Silent-degrade; only cross-reload persistence is lost.
        }
    }

    //Rebuild one ClockData per active filter (outer -> inner), immediately and unconditionally. Animation is
    //carried separately (per-ring grow start, the exit list, the slide clock), so a data-only rebuild never
    //disturbs an in-flight animation and a toggle is never blocked.
    private _rebuildClockData(): void
    {
        this._clockData = this._clockTargets.map(t => buildClockData(this, t));
    }

    //Current animated slot of a present ring: eased lerp from its captured source slot to its live index.
    private _clockSlotNow(index: number, target: ChartTarget): number
    {
        const from   = this._clockSlotFrom.get(target) ?? index;
        const slideP = this._clockSlideStart ? Math.min(1, (Date.now() - this._clockSlideStart) / CLOCK_GROW_MS) : 1;
        return from + (index - from) * (1 - (1 - slideP) ** 3);
    }

    //True while any grow, slide or exit is still playing (so the shared rAF loop keeps repainting).
    private _clockAnimActive(): boolean
    {
        const now = Date.now();
        if (this._clockExiting.length > 0) { return true; }
        if (this._clockSlideStart && now - this._clockSlideStart < CLOCK_GROW_MS) { return true; }
        for (const t of this._clockGrowStart.values()) { if (now - t < CLOCK_GROW_MS) { return true; } }
        return false;
    }

    //Drive the shared clock animation: one rAF loop that prunes finished state then repaints, until idle.
    //Instant in preview / reduced motion (settle immediately).
    private _clockAnimate(): void
    {
        const settle = (): void =>
        {
            const now = Date.now();
            this._clockExiting = this._clockExiting.filter(e => now - e.start < CLOCK_GROW_MS);
            for (const [t, s] of this._clockGrowStart) { if (now - s >= CLOCK_GROW_MS) { this._clockGrowStart.delete(t); } }
            if (this._clockSlideStart && now - this._clockSlideStart >= CLOCK_GROW_MS)
            {
                this._clockSlideStart = 0;
                this._clockSlotFrom.clear();
            }
        };
        if (this.preview || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        {
            this._clockExiting = [];
            this._clockGrowStart.clear();
            this._clockSlideStart = 0;
            this._clockSlotFrom.clear();
            this._paintClock();
            return;
        }
        const id = ++this._clockAnimSeq;
        const tick = (): void =>
        {
            if (id !== this._clockAnimSeq || this._viewMode !== 'clock') { return; }
            settle();
            this._paintClock();
            if (this._clockAnimActive()) { requestAnimationFrame(tick); }
        };
        requestAnimationFrame(tick);
    }

    private _scheduleClockPaint(): void
    {
        requestAnimationFrame(() => this._paintClock());
    }

    //Project the rings for one frame and write them onto the overlay DOM: the area SVG, the ground-laid hour
    //labels, and the clamped tooltip. Called every transform frame (init.ts) and during the grow/slide/exit
    //animation. Public so the engine's per-frame callback can reach it.
    public _paintClock(): void
    {
        if (this._viewMode !== 'clock')
        {
            return;
        }
        const svgEl  = this._clockSvg;
        const camera = this._engine?._renderer?.camera;
        if (!svgEl || !camera || !camera.hasViewport)
        {
            return;
        }
        //Resolve each ring's live animation scalars: present rings slide to their index + grow in; exiting
        //rings shrink + fade out at their captured slot. An empty list still paints the clock face (guide +
        //spokes + labels). projectClockFrame is pure geometry from here.
        const now = Date.now();
        const rings: ClockRingInput[] = this._clockData.map((data, i) =>
        {
            const gs = this._clockGrowStart.get(data.target);
            const heightScale = gs ? 1 - (1 - Math.min(1, (now - gs) / CLOCK_GROW_MS)) ** 3 : 1;
            return { data, slot: this._clockSlotNow(i, data.target), heightScale, opacity: 1 };
        });
        for (const e of this._clockExiting)
        {
            const p = 1 - (1 - Math.min(1, (now - e.start) / CLOCK_GROW_MS)) ** 3;
            rings.push({ data: e.data, slot: e.slot, heightScale: e.h0 * (1 - p), opacity: 1 - p });
        }
        const frame = projectClockFrame(
            camera, rings,
            this._clockHoverHour,
            this._clockDimHour, this._clockDim,
        );
        svgEl.innerHTML = frame.svg;
        this._clockHits = frame.hits;

        this._clockLabels?.forEach((node, h) =>
        {
            const lay = frame.labels[h];
            if (!lay) { return; }
            node.style.left      = `${lay.x.toFixed(1)}px`;
            node.style.top       = `${lay.y.toFixed(1)}px`;
            node.style.opacity   = lay.opacity.toFixed(3);
            node.style.transform = lay.transform;
        });
        //Compass letters: positioned like the hours but at full opacity (no depth fade).
        this._clockCompassLabels?.forEach((node, i) =>
        {
            const c = frame.compass[i];
            if (!c) { return; }
            node.style.left      = `${c.x.toFixed(1)}px`;
            node.style.top       = `${c.y.toFixed(1)}px`;
            node.style.transform = c.transform;
        });
        this._clampClockTip();
    }

    //Keep the hover tooltip inside the card: prefer to the right of the cursor, flip left on overflow, then
    //clamp both axes with a small margin.
    private _clampClockTip(): void
    {
        const tip  = this._clockTip;
        const card = this._haCard;
        if (!tip || !card)
        {
            return;
        }
        const margin = 8;
        const ww = card.clientWidth;
        const wh = card.clientHeight;
        const tw = tip.offsetWidth;
        const th = tip.offsetHeight;
        let left = this._clockHoverX + 14;
        if (left + tw > ww - margin) { left = this._clockHoverX - 14 - tw; }
        left = Math.max(margin, Math.min(left, ww - tw - margin));
        const top = Math.max(margin, Math.min(this._clockHoverY - th / 2, wh - th - margin));
        tip.style.left = `${left}px`;
        tip.style.top  = `${top}px`;
    }

    //Mouse hover hit-test against the cylinder axes; updates the glow highlight + tooltip. Cleared during a
    //drag (buttons pressed). Touch has no hover, so it's handled by tap below (_onClockTapStart/End).
    private _onClockHover = (e: PointerEvent): void =>
    {
        if (this._viewMode !== 'clock' || e.pointerType !== 'mouse')
        {
            return;
        }
        if (e.buttons !== 0)
        {
            if (this._clockHoverHour !== null)
            {
                this._clockHoverHour = null;
                this._clockTapSticky = false;
            }
            return;
        }
        const card = this._haCard;
        if (!card)
        {
            return;
        }
        const rect = card.getBoundingClientRect();
        this._clockHoverX = e.clientX - rect.left;
        this._clockHoverY = e.clientY - rect.top;
        const hit = clockHitTest(this._clockHits, this._clockHoverX, this._clockHoverY);
        this._clockTapSticky = false;
        if (hit !== this._clockHoverHour)
        {
            this._clockHoverHour = hit;   //@state change -> tooltip render + repaint via updated()
        }
        else if (hit !== null)
        {
            this._scheduleClockPaint();   //same slice, cursor moved: just re-clamp the tooltip
        }
    };

    private _onClockHoverEnd = (): void =>
    {
        //Leaving the surface only dismisses a mouse hover; a tapped (sticky) tooltip stays until tapped away.
        if (this._clockHoverHour === null || this._clockTapSticky)
        {
            return;
        }
        this._clockHoverHour = null;
    };

    //Touch: remember where the gesture began so a tap can be told from a drag-rotate on release.
    private _onClockTapStart = (e: PointerEvent): void =>
    {
        if (this._viewMode !== 'clock' || e.pointerType === 'mouse')
        {
            return;
        }
        const card = this._haCard;
        if (!card)
        {
            return;
        }
        const rect = card.getBoundingClientRect();
        this._clockTapStartX = e.clientX - rect.left;
        this._clockTapStartY = e.clientY - rect.top;
    };

    //Touch release: if the finger barely moved it's a tap — hit-test and toggle a sticky tooltip on the
    //tapped cylinder (or dismiss when tapping empty space). A real drag (moved past the threshold) rotated
    //the camera and is ignored here.
    private _onClockTapEnd = (e: PointerEvent): void =>
    {
        if (this._viewMode !== 'clock' || e.pointerType === 'mouse')
        {
            return;
        }
        const card = this._haCard;
        if (!card)
        {
            return;
        }
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (Math.hypot(x - this._clockTapStartX, y - this._clockTapStartY) > 10)
        {
            return;   //drag-rotate, not a tap
        }
        this._clockHoverX = x;
        this._clockHoverY = y;
        const hit = clockHitTest(this._clockHits, x, y);
        if (hit !== null)
        {
            this._clockTapSticky = true;
            this._clockHoverHour = hit;
        }
        else
        {
            this._clockTapSticky = false;
            this._clockHoverHour = null;
        }
    };

    //Hour label for a ground-laid tick, formatted like the rest of the HA dashboard (12/24h from the user's
    //time_format setting). The Date is local so the hour shown is the one meant.
    private _formatClockHour(h: number): string
    {
        return formatHaTime(this.hass, new Date(2000, 0, 1, h));
    }

    //Hover tooltip for an hour slice: a time-band header, then one row per active filter (its coloured icon
    //+ its total value at that hour). Position is set inline then clamped in _paintClock.
    private _renderClockTooltip(hour: number): TemplateResult
    {
        if (this._clockData.length === 0)
        {
            return html``;
        }
        const next = String((hour + 1) % 24).padStart(2, '0');
        return html`
            <div
                class="clock-tip"
                style="left:${this._clockHoverX}px;top:${this._clockHoverY}px"
            >
                <div class="clock-tip-head">${String(hour).padStart(2, '0')}:00 – ${next}:00</div>
                ${this._clockData.map(data => {
                    const meta = clockTargetMeta(this, data.target);
                    return html`
                        <div class="clock-tip-row">
                            <ha-icon icon="${meta.icon}" style="color:${meta.color}"></ha-icon>
                            <span>${formatClockValue(this, data, clockHourTotal(data, hour))}</span>
                        </div>
                    `;
                })}
            </div>
        `;
    }

    private _onCameraLockToggle = (): void =>
    {
        if (!this._engine)
        {
            return;
        }
        this._engine.setCameraLocked(!this._engine.isCameraLocked());
        this.requestUpdate();
    };

    static styles = [heliosCardStyles, heliosTimelineStyles, heliosCardEnergyClockCss, heliosCardLidarCss];
}
