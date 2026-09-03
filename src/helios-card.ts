import type { PropertyValues, TemplateResult} from 'lit';
import { LitElement, html, svg, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { HassLike } from './core/ha-types';
import type { HeliosEngine, WeatherOverrideVar } from './scene/helios-engine';
import
{
    type HeliosConfig,
    autoHideUi,
    noUiDelayMs,
    showTimeline,
    showDetailPanel,
    cacheId,
    weatherEnabled,
    showTemperature,
    showHumidity,
    showCost,
    showHorizonLine,
    horizonLineColor,
} from './core/config/helios-config';
import { chipSlotColor, chipSlotIcon } from './core/config/chip-appearance';
import { buildDayProfile, daySlots, type ProfileStrand } from './data/period-totals/day-profile';
import { buildSunGroundTrack, slotOfMs, type DayCurveInput, type DayStrand, type DayCurvePass, type DayCurveScene, type SunTrackPoint } from './scene/day-curve';
import { type TimelineMode, TIMELINE_MODES, TIMELINE_MODE_ORDER, modeFetchPeriod, modePastDays, modeFutureDays } from './timeline/timeline-modes';
import { pickTranslations } from './core/i18n';
import { DAY_CURVE_SWEEP_MS } from './core/config/constants';
import { heliosCardStyles } from './css/helios-card-scene-css';
import { weatherOverlay, WeatherRain, WeatherSnow, WeatherStorm, weatherLayers, type WxInput } from './scene/weather-fx';
import { heliosTimelineStyles } from './css/helios-timeline-css';
import { setServerTimeZone, serverMsOfDay } from './core/time/timezone';
import { isDarkFromCss, resolveUiColor, formatTemperature, clearUiColorCache } from './core/format/format';
import { refreshPv } from './data/sources/pv';
import
{
    refreshBattery,
    clearBatteryModuleCaches
} from './data/sources/battery';
import { refreshIrradiance, clearIrradianceModuleCaches } from './data/sources/irradiance';
import { refreshWeatherOverrides, clearWeatherOverrideCaches, WEATHER_OVERRIDE_CONFIG_KEYS } from './data/sources/weather-override';
import
{
    renderBottomChart,
    chartAccentColor,
    resolveStrandColour,
    type ChartTarget,
    GROUP_TARGETS,
    renderTimelineTicks,
    renderTimelineDayLabels,
    renderTimelineNightZones,
    renderTimelineFutureMask,
    renderTimelineHoverTooltip,
    onChartHoverMove,
    onChartHoverLeave
} from './charts/charts';
import { firstAvailableChartTarget } from './charts/chart-target-availability';
import { renderDetailPanel } from './hud/detail-panel';
import { refreshHud } from './hud/hud';
import type { ArcSegment, SunScene, MoonScene, LabelLayout } from './hud/hud';
import
{
    tick,
    onTimelinePointerDown,
    onTimelinePointerMove,
    onTimelinePointerUp,
    returnTimelineToLive
} from './timeline/timeline';
import { refreshGrid } from './data/sources/grid';
import { refreshCostLive, refreshCostSeries } from './data/sources/cost';
import { refreshDeviceConsumption } from './data/sources/device-consumption';
import { createGridGuard, type GridGuardState } from './data/sources/grid-guard';
import { createBatteryGuard, type BatteryGuardState } from './data/sources/battery-guard';
import {
    subscribeEnergyPrefs,
    unsubscribeEnergyPrefs,
    refreshHaDailyTotals,
    EMPTY_ENERGY_DEFAULTS,
    type EnergyDefaults,
} from './data/sources/energy-prefs';
import { clearEnergyStatsCache, type StatPeriod, type ChangeBucket } from './data/sources/energy-stats';
import { clearDurable } from './data/durable-cache';
import { KeyedFetch } from './data/source-fetch';
import { fetchHaSolarForecast, type SolarForecastPoint } from './data/energy-forecast';
import { buildUnifiedStore, isStoreFresh, type UnifiedStoreHost, type UnifiedDataStore } from './data/unifiedStore';
import
{
    computeConfigSig,
    getHomeCoords,
    initEngine,
    initVisibilityObserver,
    publishConsumptionColor
} from './card/init';
//Side-effect import: registers <helios-card-editor> as a custom element.
import './editor/editor';
//Side-effect import: writes the Helios entry into window.customCards for the HA card picker.
import './card/registry';
//Side-effect import: install banner, location-override debug helpers and the page-wide data-cache reset
//bus. liveCards is the shared registry each card adds/removes itself from.
import { liveCards } from './card/diagnostics';
import { SceneHudController } from './hud/scene-hud-controller';


//Live cards grouped by their (auto-generated) cache id, in connection order. A pasted card carries a copy of
//the source's id; the registry hands each same-id card a distinct, order-stable storage slot so duplicates
//never share, without the user ever seeing or managing the id.
const _cacheIdRegistry = new Map<string, HeliosCard[]>();


//Main card


@customElement('helios-card')
export class HeliosCard extends LitElement
{
    @property({ attribute: false }) public hass!: HassLike;
    @property({ attribute: false }) config!: HeliosConfig;
    //Set by HA on the editor's live-preview card. HA rebuilds that card on every keystroke, so intro
    //animations (prism rise, timeline curve grow) are suppressed while it is true.
    @property({ attribute: false }) public preview = false;

    //Scene HUD subsystem (the home-anchored energy chip cluster, its animated leader paths, the solar arc
    //depth passes and the sun disc/ray geometry). Reads the card's scrub/live + layout + sun @state through
    //its host back-reference and returns the HUD template fragment for render().
    readonly _hud = new SceneHudController(this);

    @state() _engine?:        HeliosEngine;
    @state() _now             = new Date();
    //Cloud-cover values shown in the on-ground disc hover popup.
    @state() _cloudCover      = -1;
    //"Your real sky" weather layers, resolved at the current live/scrub time and pushed by the engine:
    //precipitation (mm), snowfall (cm) and the WMO weather code (drives rain / snow / thunderstorm).
    @state() _precip          = 0;
    @state() _snowfall        = 0;
    @state() _weatherCode     = 0;
    //Outdoor temperature (°C) + relative humidity (%) at the current time; NaN until data / when unavailable.
    @state() _temperature     = NaN;
    @state() _humidity        = NaN;
    //Net live cost rate in `_currency` per hour (positive = spending, negative = earning), from refreshCostLive.
    //Null when no cost is configured in the Energy dashboard (the cost chip then hides).
    @state() _costRate: number | null = null;
    //User currency from hass.config.currency; set alongside _costRate.
    _currency = '€';
    //Recorder `change` series for the cost + compensation statistics (net money per bucket), driving the cost
    //chip's live rate + its curve for ANY tariff (Tempo, HC/HP, a total-cost integration sensor). Null until fetched.
    @state() _costImportSeries: ChangeBucket[] | null = null;
    @state() _costExportSeries: ChangeBucket[] | null = null;
    _costFetch = new KeyedFetch();
    //Screen-space layout of the always-visible labels + leaders, recomputed via
    //engine.projectHomeLabelLayout() on every map transform. null while the map is loading.
    @state() _labelLayout: LabelLayout | null = null;
    //PV production state, set when the HA Energy dashboard exposes a solar source: live value from
    //hass.states + historical series from HA's history API for the dedicated chart.
    @state() _pvCurrent: number | null = null;
    @state() _pvUnit        = '';
    //Recorder change series for the solar meter(s): canonical past-production source for the unified
    //store + chip scrub. Reset-corrected, unit-normalised kWh per 5-min bucket, same as the HA Energy
    //dashboard.
    @state() _pvChangeSeries: ChangeBucket[] | null = null;
    _pvChangeFetch = new KeyedFetch();
    @state() _pvChangeSeriesPerEntity = new Map<string, ChangeBucket[]>();
    //HA Energy dashboard solar forecast (src/card/energy-forecast.ts), merged across config entries.
    //The unified store reads this into its forecast series. Empty when no forecast source is configured.
    @state() _haSolarForecast: SolarForecastPoint[] = [];
    _haSolarForecastLoaded    = false;
    _haSolarForecastFetching  = false;
    _haSolarForecastFetchedAt = 0;
    //Past-days window actually covered by the last successful fetch. Lets the throttle below tell "nothing new
    //to ask for" apart from "too soon to ask again": switching to a mode wanting more past days (e.g. Yesterday)
    //bypasses the throttle even seconds after a narrower fetch, instead of silently keeping that narrower result.
    _haSolarForecastCoveredPastDays = 0;
    //Home-battery state, set when the HA Energy dashboard exposes a battery source (stat_rate,
    //stat_energy_from/to or stat_soc). Live readings; historical series in the *History fields below.
    //Units kept alongside values so the chip formats kW vs W without re-reading the state.
    @state() _batterySoc:        number | null = null;
    @state() _batteryPower:      number | null = null;
    @state() _batteryPowerUnit        = '';
    //Grid import/export live values, set by refreshGrid() from the HA Energy grid source's stat_energy_from
    //(import) / stat_energy_to (export). Unit captured alongside so the chip formats W/kWh/m³ correctly.
    @state() _gridImportValue:   number | null = null;
    @state() _gridImportUnit        = '';
    @state() _gridExportValue:   number | null = null;
    @state() _gridExportUnit        = '';
    //Recorder change series for the grid import/export meters: canonical past-power source for the
    //unified store + scrub. Reset-corrected kWh per 5-min bucket, same as the HA Energy dashboard.
    @state() _gridImportChangeSeries: ChangeBucket[] | null = null;
    @state() _gridExportChangeSeries: ChangeBucket[] | null = null;
    //Per-source split of the same change fetch, for the multi-source stacked breakdown (arc + timeline). Empty on a
    //single-source install; config (meter) order, matching the aggregate above.
    @state() _gridImportChangeSeriesPerEntity = new Map<string, ChangeBucket[]>();
    @state() _gridExportChangeSeriesPerEntity = new Map<string, ChangeBucket[]>();
    _gridImportFetch = new KeyedFetch();
    _gridExportFetch = new KeyedFetch();
    //Mis-scope guard for the live grid sensor (grid-guard.ts). Plain field: transitions are pushed through
    //requestUpdate() by the guard itself, so no @state on the mutable object.
    _gridGuard: GridGuardState = createGridGuard();
    //Sign guard for the live battery rate sensor (battery-guard.ts): corrects an inverted convention so the flow
    //direction matches the meters. Same plain-field pattern as the grid guard.
    _batteryGuard: BatteryGuardState = createBatteryGuard();
    //Historical series for the active timeline range. Both battery entities fetched in one
    //history/history_during_period WS call when both are set.
    @state() _batterySocHistory: {
        times:  Date[];
        values: number[];
    } | null = null;
    //Raw per-bank SoC series (fetch order), driving the battery chart's per-bank lines. Empty on a single-bank
    //install or before the first fetch.
    @state() _batterySocPerBankHistory: {
        times:  Date[];
        values: number[];
    }[] = [];
    _batteryFetchKey  = '';
    _batteryFetching  = false;
    //Recorder change series for battery charge (stat_energy_to) + discharge (stat_energy_from) meters:
    //canonical past-power source for the unified store + scrub. Net (charge - discharge) gives a
    //structural sign so charging is never lost.
    @state() _batteryChargeChangeSeries:    ChangeBucket[] | null = null;
    @state() _batteryDischargeChangeSeries: ChangeBucket[] | null = null;
    //Per-source split for the multi-source stacked breakdown (arc + timeline). Empty on a single-source install.
    @state() _batteryChargeChangeSeriesPerEntity    = new Map<string, ChangeBucket[]>();
    @state() _batteryDischargeChangeSeriesPerEntity = new Map<string, ChangeBucket[]>();
    _batteryChangeFetch = new KeyedFetch();
    //Per-device recorder `change` series (statConsumption id -> buckets) for the grouped + visible devices, feeding
    //the monitoring-group chips. Empty until the first fetch / when no device is grouped.
    @state() _deviceChangeSeries = new Map<string, ChangeBucket[]>();
    _deviceChangeFetch = new KeyedFetch();
    //Irradiance entity history, populated when solar-irradiance-entity is configured. Recorder
    //samples over the timeline range, merged with the live state, pushed to the engine via
    //setSolarIrradianceSamples. Plain field (no @state): render never reads it, the engine owns lookup.
    _irradianceHistory: { times: Date[]; values: number[] } | null = null;
    _irradianceFetchKey = '';
    _irradianceFetching = false;
    //Per-variable fetch/merge state for the local-sensor weather overrides (cloud/precip/snow/temp/humidity).
    //Plain field (no @state): the engine owns the lookup, render never reads it. Keyed by weather variable.
    _weatherOverrideState = new Map<WeatherOverrideVar, {
        history: { times: Date[]; values: number[] } | null;
        fetchKey: string; fetching: boolean;
        pushedHist: unknown; pushedState: unknown; pushedEntity: string;
    }>();
    //Screen-space layout of the solar arc, sun and incidence ray. Recomputed via engine.projectSunScene()
    //on every map transform and periodic tick (sun moves with time).
    @state() _sunScene: SunScene | null = null;
    //The moon's own arc + crescent disc, projected on the same dome as the sun and refreshed with it. Cosmetic
    //only (no chip, no value), so nothing downstream reads it but the HUD template.
    @state() _moonScene: MoonScene | null = null;
    //Day curve, projected by the engine and refreshed with the rest of the HUD. Two depth passes so the card can
    //put the far half behind its chips and the near half over them, the way the sun arc does.
    @state() _dayCurveScene: DayCurveScene | null = null;

    //Energy dashboard preferences snapshot. Subscribed at connectedCallback, updated on every HA
    //energy_preferences_updated event. Chip refresh helpers read their fallback entity from here.
    @state() _energyDefaults: EnergyDefaults = EMPTY_ENERGY_DEFAULTS;
    _energyPrefsUnsub?: () => void;
    //Today's produced kWh from refreshHaDailyTotals() against the recorder, for the timeline tooltip's
    //today headline. Null when no HA solar stat is configured or the recorder call has not landed.
    @state() _haSolarTodayKwh:        number | null = null;
    //Hover state on the home hitbox. Drives a sun-coloured glow halo so the focal building reads as
    //interactive before clicking.
    @state() _homeHover = false;
    //Hover position on the timeline chart cards, as a percent of the visible range. Null when the pointer
    //is outside; drives the hover guide line, per-curve dots and the tooltip chip.
    @state() _chartHoverPct: number | null = null;
    //Active bottom-chart target: the single re-targetable chart draws this series-set; chips re-point it
    //(production by default, then grid/battery/irradiance/cloud as chips re-point it).
    @state() _chartTarget: ChartTarget = 'production';
    //True once the user has picked a chip or a saved pick was restored. Until then the target tracks the first
    //available chip as the Energy config resolves (see updated()), so a card with no solar never sits on an empty
    //production selection at load.
    private _chartTargetExplicit = false;
    //Detail panel (scene mode): a compact top-right readout aggregating the selected metric over the window. Any
    //chip tap opens it (alongside re-pointing the chart) and a tap on the scene closes it. Bound to the active
    //chip, not a target, so switching chips while open just re-points it.
    @state() _infoPanelOpen = false;
    //The day curve is the active chip's second notch: it is UP or it is not, said by the user, not derived from
    //which chip happens to be selected. Derived, it could not be dismissed - production is the default target, so a
    //tap on the scene closed the detail panel and left the curve standing with nothing left to close it.
    @state() _dayCurveOpen = false;
    //Progress of the curve writing itself on, 0 .. 1. See _setDayCurveOpen.
    @state() _dayCurveT = 0;
    private _dayCurveRaf = 0;
    //The day curve's heavy half, kept until the day it describes actually changes. Plain field, not @state: it is
    //a cache of what _buildDayCurve would return, never a thing to render off.
    private _dayCurveMemo?: {
        dayStartMs: number;
        target:     ChartTarget;
        store:      unknown;
        pv:         unknown;
        perEntity:  unknown;
        gridImpPE:  unknown;
        gridExpPE:  unknown;
        battChgPE:  unknown;
        battDisPE:  unknown;
        devices:    unknown;
        soc:        unknown;
        socBank:    unknown;
        defaults:   unknown;
        range:      unknown;
        nowMin:     number;
        lat:        number;
        lon:        number;
        slots:      number;
        //The heavy part: the strands (values / peak / forecast / colour DESCRIPTOR) and the ground track they stand
        //on. Colours are resolved off the descriptor each call, outside this memo, so a theme flip is never frozen.
        strands:    ProfileStrand[];
        base:       SunTrackPoint[];
    };
    //"No UI" mode: true once the idle timer fires, hiding (fading) the timeline + controls; any input clears it.
    @state() private _uiHidden = false;
    private _uiHideTimer: number | undefined;
    @query('ha-card') _haCard?: HTMLElement;

    //"Your real sky": on-card weather driven by the real weather resolved at the live/scrub time. Independent
    //layers stack (cloud grade + rain / snow / thunderstorm), each fed by weatherLayers() and rendered by the
    //CSS overlay + the rain/snow canvases + the lightning controller.
    @state() private _wxOn = true;
    @query('.helios-wx-rain') private _wxRainCanvas?: HTMLCanvasElement;
    @query('.helios-wx-snow') private _wxSnowCanvas?: HTMLCanvasElement;
    private readonly _wxRainCtl  = new WeatherRain((): HTMLCanvasElement | undefined => this._wxRainCanvas);
    private readonly _wxSnowCtl  = new WeatherSnow((): HTMLCanvasElement | undefined => this._wxSnowCanvas);
    private readonly _wxStormCtl = new WeatherStorm((v: number): void => this.style.setProperty('--wx-flash', v.toFixed(3)));
    //Last value written per --wx-* var (see _applyWeather), so a repeat write of an unchanged value skips the
    //setProperty call - the same guard WeatherStorm._emit already applies to --wx-flash, extended to every var
    //_applyWeather owns. Per-var rather than one combined check: --wx-sun-x/-y move every rotation frame while
    //the rest only change with the weather data itself, so a combined guard would rarely skip anything.
    private _lastWxVars: Record<string, string> = {};
    private _setWxVar(name: string, value: string): void
    {
        if (this._lastWxVars[name] !== value)
        {
            this._lastWxVars[name] = value;
            this.style.setProperty(name, value);
        }
    }
    //Weather driving the layers right now: the resolved live/scrub weather (cloud/precip/snow/code + sun altitude).
    private get _wxInput(): WxInput
    {
        const sun = this._sunScene?.sun;
        return {
            cloud:       Math.max(0, this._cloudCover),
            precip:      this._precip,
            snowfall:    this._snowfall,
            code:        this._weatherCode,
            sunAltitude: sun ? sun.altitude : 45,
        };
    }
    @state() _chartSeries: {
        times:        Date[];
        irradiance:   number[];
        cloud:        number[];
        //Hourly low/mid/high cloud cover in %, for the timeline's cloud target (three altitude bands).
        cloudLow:     number[];
        cloudMid:     number[];
        cloudHigh:    number[];
        //Hourly outdoor temperature (°C) + relative humidity (%), for their chart targets + day curves.
        temperature:  number[];
        humidity:     number[];
    } | null = null;
    @state() _timeRange:    { start: Date; end: Date } | null = null;
    @state() _selectedTime: Date | null = null;
    @state() _isLiveMode    = true;
    //Active timeline mode (Forecast / Yesterday / Today / Week / Month). Drives the window + store cadence +
    //fetch period + scrub snapping (see card/timeline-modes.ts). Persisted per card; the toggle lives in the
    //bottom band.
    @state() _timelineMode: TimelineMode = 'forecast';
    //Active rolling-window span (days of history/forecast around today), derived from the mode. Pushed to the
    //engine via setPeriodDays(), read by buildUnifiedStore. Single runtime source of truth for the window.
    //Not @state: changes go through _applyPeriod(), which requestUpdate()s after dropping store + window.
    _periodPastDays   = modePastDays('forecast');
    _periodFutureDays = modeFutureDays('forecast');

    //Flipped by fetchEnergyPrefs after the first parse lands, so the card kicks refreshHaDailyTotals as
    //soon as the HA Energy defaults snapshot appears rather than waiting up to 30 s for the next tick.
    _energyDefaultsLoaded   = false;
    private _dailyTotalsKicked = false;
    //Fingerprint from the last hass-only update pass shouldUpdate() let through (see below); undefined until
    //the first one, which is never skipped.
    private _lastHassFingerprint: string | undefined = undefined;
    //Unified 5-day data store. Built after the initial weather + PV + battery + grid fetches, rebuilt when
    //any refresh, sliced/interpolated by the graph view and main timeline. Live numeric chips
    //stay on the direct hass.states path: the store carries bucketed curves, the chips need sample-accurate
    //values a 15 min bucket would lose.
    @state() _unifiedStore: UnifiedDataStore | null = null;


    private _timer?:           number;
    //Deferred engine teardown handle: lets the engine survive HA's edit-mode disconnect+reconnect thrash.
    private _engineTeardownTimer?: number;
    _lastHomeKey       = '';
    _lastConfigSig     = '';
    _initInflight      = false;

    //Cached theme polarity. The fallback path (getComputedStyle + regex) forces a style flush, too costly
    //per render. Result only changes on theme polarity flip / style reload, so cache by themesObj identity.
    //The empty-cache marker is a private symbol, not undefined, so a genuinely-undefined themesObj still
    //resolves through the CSS fallback instead of colliding with "not cached yet".
    private static readonly _UNCACHED_THEMES = Symbol('theme-cache-empty');
    private _cachedIsDarkThemesRef: unknown = HeliosCard._UNCACHED_THEMES;
    private _cachedIsDark = false;
    //Tracks hass.themes' own reference across updates, purely to invalidate the cssHex colour cache on a real
    //theme swap (see willUpdate). Separate from _cachedIsDarkThemesRef above: that one only runs down the
    //darkMode-missing fallback path, not on every hass update.
    private _lastColorCacheThemesRef: unknown = undefined;
    //Last resolved home-colour token, so the :host consumption var is only re-derived when it changes.
    //Read + written by publishConsumptionColor (card/init.ts), so not TS-private.
    _homeColorToken = '';

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
    _arcBackBuf:      ArcSegment[] = [];
    _arcFrontBuf:     ArcSegment[] = [];
    _arcFrontNearBuf: ArcSegment[] = [];



    //HA card lifecycle

    public setConfig(config: HeliosConfig): void
    {
        if (!config)
        {
            throw new Error('Invalid HELIOS configuration');
        }
        this.config = { ...config };
        //The rolling window is driven by the timeline mode (card/timeline-modes.ts) + the persisted choice, so
        //setConfig doesn't seed it.
        //"Your real sky" master switch follows the config (default on); the layers re-apply via updated().
        this._wxOn = weatherEnabled(this.config);
        //Re-arm (or stop) the "No UI" idle fade when the option changes.
        this._scheduleUiHide();
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

    //Timeline mode selector (Forecast / Yesterday / Today / Week / Month). Derives the window from the mode spec,
    //applies it (drops + rebuilds the store at the mode's cadence) and persists.
    private _setTimelineMode(mode: TimelineMode): void
    {
        if (this._timelineMode === mode)
        {
            return;
        }
        this._timelineMode = mode;
        const spec = TIMELINE_MODES[mode];
        this._periodPastDays   = modePastDays(mode);
        this._periodFutureDays = modeFutureDays(mode);
        //Entering a no-weather mode: retarget the chart off any weather metric (irradiance / temperature / humidity)
        //onto the first configured + visible energy chip (consumption -> production -> grid -> battery -> groups).
        //Never force production, which the user may have hidden or have no solar source for; if nothing qualifies,
        //keep the current target and let the chart draw nothing.
        if (!spec.weather && (this._chartTarget === 'irradiance' || this._chartTarget === 'temperature' || this._chartTarget === 'humidity'))
        {
            const fallback = firstAvailableChartTarget(this.config, this._energyDefaults);
            if (fallback)
            {
                this._chartTarget = fallback;
            }
        }
        this._applyPeriod();
        this.persistUiState();
    }

    //Shared: swallow a pointerdown so the period selector doesn't start a timeline scrub.
    private _stopPropagation = (e: Event): void =>
    {
        e.stopPropagation();
    };

    //Period-selector button delegate: the clicked element carries its mode in data-mode.
    private _onTimelineModeClick = (e: Event): void =>
    {
        const mode = (e.currentTarget as HTMLElement).dataset.mode as TimelineMode | undefined;
        if (mode)
        {
            this._setTimelineMode(mode);
        }
    };

    //Recorder period for the energy change-series, per the active mode (5-min for forecast, hourly for a week,
    //daily for month), so a long window never pulls 5-min rows. Read by the fetch hosts (pv/grid/battery).
    get _storeFetchPeriod(): StatPeriod
    {
        return modeFetchPeriod(this._timelineMode, this.config);
    }

    //Whether weather (irradiance + cloud) is offered in the active mode. Off for month (Open-Meteo only
    //reaches ~16 days), where the focus is energy. Hides those chips + their chart targets.
    get _weatherAvailable(): boolean
    {
        return TIMELINE_MODES[this._timelineMode].weather;
    }

    //Chip -> bottom-chart re-targeting. Points the chart at the clicked metric; no-op when already there.
    setChartTarget = (target: ChartTarget): void =>
    {
        //A deliberate pick: from here the target is the user's, never re-resolved to the default.
        this._chartTargetExplicit = true;
        if (this._chartTarget !== target)
        {
            this._chartTarget = target;
            this.persistUiState();
        }
    };

    //Chip click delegate: the clicked element carries its metric in data-target. A tap points the chart at the
    //chip AND opens its detail panel.
    //
    //Re-tapping the ALREADY ACTIVE chip is the day curve's toggle, for EVERY chip now, not just PV. That gesture was
    //doing nothing at all, so it costs no pixel, no new control and no reduced hit target - the whole chip stays the
    //target, which matters on a phone, where a knob inside a 22 px pill would be a coin toss. It reads as what it is:
    //"I am on this metric... now show me its day".
    //
    //Switching to a DIFFERENT chip while the curve is up re-points it and leaves it up: the curve follows the active
    //target (see _buildDayCurve), so tapping across the chips walks the same day through each metric. Closing is the
    //re-tap, or a tap on the scene.
    onChartTargetClick = (e: Event): void =>
    {
        const target = (e.currentTarget as HTMLElement).dataset.target as ChartTarget | undefined;
        if (!target)
        {
            return;
        }
        if (target === this._chartTarget)
        {
            this._setDayCurveOpen(!this._dayCurveOpen);
        }
        else
        {
            this.setChartTarget(target);
        }
        //Any chip tap opens (or keeps open) the panel on that chip; closing is done elsewhere, not by re-tapping.
        this._infoPanelOpen = true;
    };

    //Last target the home prism was painted for, so updated() can tell a chip CHANGE (play the squash/grow)
    //from a same-chip scrub/tick (instant recolour). Undefined until the first paint (no squash on load).
    private _lastHomeTarget?: ChartTarget;

    //Push the home prism's appearance to the renderer (via the engine): a solid block in the active chip's accent
    //colour. `animate` plays the squash/grow on a chip change.
    //The active chip's LIVE colour, the single source every "active chip" accent reads (home prism, timeline
    //border, detail panel). The directional chips (grid, battery) flip tint with the INSTANTANEOUS flow, so this
    //reuses the HUD's live/scrub-aware leader colours rather than chartAccentColor, whose window-dominant direction
    //makes no sense for a live view (it would show the day's net while the scene shows now). Non-directional targets
    //carry no direction, so chartAccentColor already matches.
    private _activeChipColor(): string
    {
        return this._chartTarget === 'grid' ? this._hud._gridLeaderColor
            : (this._chartTarget === 'battery' || this._chartTarget === 'battery-soc') ? this._hud._batteryLeaderColor
                : chartAccentColor(this);
    }

    updateHomeAppearance(animate: boolean): void
    {
        if (!this._engine)
        {
            return;
        }
        const color = this._activeChipColor();
        //No squash on the very first paint (no prior target to grow away from).
        const play  = animate && this._lastHomeTarget !== undefined;
        this._lastHomeTarget = this._chartTarget;
        this._engine.setHomeAppearance(color, play);
    }

    //Raise or lower the curve, writing it on from midnight round to midnight as the day itself runs. The sweep is
    //driven here rather than in CSS because the scene SVG is rebuilt on every camera frame, and a CSS animation on
    //a fresh element restarts with it: under auto-rotation it would stutter forever instead of playing once.
    private _setDayCurveOpen(open: boolean): void
    {
        if (open === this._dayCurveOpen)
        {
            return;
        }
        this._dayCurveOpen = open;
        if (this._dayCurveRaf)
        {
            cancelAnimationFrame(this._dayCurveRaf); this._dayCurveRaf = 0;
        }
        const to = open ? 1 : 0;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        {
            this._dayCurveT = to;
            return;
        }
        const from  = this._dayCurveT;
        const start = performance.now();
        //`step`, not `tick`: the module already exports a timeline tick and shadowing it here would read as that.
        const step = (now: number): void =>
        {
            const x = Math.min(1, (now - start) / DAY_CURVE_SWEEP_MS);
            //Ease-out on the leg being travelled: it leaves briskly and settles, rather than crawling then snapping.
            //Setting the state is the whole step: it runs the normal update, which hands the engine the new sweep
            //and refreshes the HUD off it. Calling refreshHud from here instead would re-project the sweep the
            //engine was last GIVEN, not the one just set.
            this._dayCurveT = from + (to - from) * (1 - (1 - x) ** 3);
            this._dayCurveRaf = x < 1 ? requestAnimationFrame(step) : 0;
        };
        this._dayCurveRaf = requestAnimationFrame(step);
    }

    //Curve data for the engine to project. null means no chip's curve is raised at all: the day curve follows the
    //ACTIVE chart target, so re-pointing it at another chip is nothing more than the target moving under it. Each
    //target builds its own strands (PV one, grid two, battery two, a group one per device); an empty strand list is
    //still a valid answer ("the sun did not shine", "no import today"), distinct from null ("nothing is raised").
    private _buildDayCurve(): DayCurveInput | null
    {
        if (!this._dayCurveOpen && this._dayCurveT <= 0)
        {
            return null;
        }
        const target = this._chartTarget;
        const coords = getHomeCoords(this.config, this.hass);
        if (!coords)
        {
            return null;
        }
        //Clamped INTO the window, because the curve reads the store and can only speak for a day the store holds.
        //Every period but Yesterday ends on today, so "now" is inside one and is the right default. Yesterday ends
        //at this morning's midnight, which puts now OUTSIDE its own window: the curve was then built for today
        //against a store that only has yesterday, found nothing, and drew nothing until a scrub landed a selection
        //back inside.
        const range = this._timeRange;
        const live  = (this._selectedTime ?? new Date()).getTime();
        const shownMs = range
            ? Math.min(Math.max(live, range.start.getTime()), range.end.getTime() - 1)
            : live;

        //Everything below speaks for the day ON SHOW: the values, the sun track under them, and the sun's own
        //position along it. A scrub into another day rebuilds all three together, so they can never describe
        //different days.
        //
        //But NOT on every frame of that scrub. The profile walks the whole store and the track works out a sun
        //position per slot, and dragging across an afternoon was rebuilding both sixty times a second to answer a
        //question whose answer had not changed. Only the sun's own place along the track moves, so only that is
        //recomputed below.
        //
        //The key is everything the two of them READ, and nothing less. `_now` is in it because today's profile is
        //cut at the present moment (coverage stops there, the forecast starts there), so the boundary is not a
        //property of the day alone. `_energyDefaults` is in it because the meters it names decide the layer split.
        //`_timeRange` is in it because its absence makes the profile come back empty, and a memo of that emptiness
        //would outlive the range's arrival.
        //The key is everything the strands READ. `_deviceChangeSeries` feeds the group curves, `_batterySocHistory`
        //and `_batterySocPerBankHistory` the battery SoC, so a scrub to those targets or a late data arrival has to
        //miss the memo.
        const slots = daySlots(this.config);
        const m = this._dayCurveMemo;
        const fresh = m !== undefined
            && m.dayStartMs === shownMs - serverMsOfDay(shownMs)
            && m.target     === target
            && m.store      === this._unifiedStore
            && m.pv         === this._pvChangeSeries
            && m.perEntity  === this._pvChangeSeriesPerEntity
            && m.gridImpPE  === this._gridImportChangeSeriesPerEntity
            && m.gridExpPE  === this._gridExportChangeSeriesPerEntity
            && m.battChgPE  === this._batteryChargeChangeSeriesPerEntity
            && m.battDisPE  === this._batteryDischargeChangeSeriesPerEntity
            && m.devices    === this._deviceChangeSeries
            && m.soc        === this._batterySocHistory
            && m.socBank    === this._batterySocPerBankHistory
            && m.defaults   === this._energyDefaults
            && m.range      === this._timeRange
            && m.nowMin     === Math.floor(this._now.getTime() / 60_000)
            && m.lat        === coords.lat
            && m.lon        === coords.lon
            && m.slots      === slots;
        if (!fresh)
        {
            this._dayCurveMemo = {
                dayStartMs: shownMs - serverMsOfDay(shownMs),
                target,
                store:     this._unifiedStore,
                pv:        this._pvChangeSeries,
                perEntity: this._pvChangeSeriesPerEntity,
                gridImpPE: this._gridImportChangeSeriesPerEntity,
                gridExpPE: this._gridExportChangeSeriesPerEntity,
                battChgPE: this._batteryChargeChangeSeriesPerEntity,
                battDisPE: this._batteryDischargeChangeSeriesPerEntity,
                devices:   this._deviceChangeSeries,
                soc:       this._batterySocHistory,
                socBank:   this._batterySocPerBankHistory,
                defaults:  this._energyDefaults,
                range:     this._timeRange,
                //The minute, not the millisecond: the profile is cut at `now`, and `_now` only ticks once a minute
                //anyway. A raw timestamp would miss on every single call and the memo would be decoration.
                nowMin:    Math.floor(this._now.getTime() / 60_000),
                lat:       coords.lat,
                lon:       coords.lon,
                slots,
                strands:   buildDayProfile(this, target, shownMs),
                base:      buildSunGroundTrack(shownMs, coords.lat, coords.lon, slots),
            };
        }
        const kept = this._dayCurveMemo!;
        //Resolve each strand's colour DESCRIPTOR to live theme hex here, outside the memo, so a theme flip repaints
        //without rebuilding the whole profile. Everything else rides straight off the memo.
        const strands: DayStrand[] = kept.strands.map((ps) =>
        {
            const resolved = resolveStrandColour(this, ps.colour);
            return {
                values:     ps.values,
                predicted:  ps.predicted,
                peak:       ps.peak,
                dashed:     ps.dashed,
                colour:     resolved.colour,
                segColours: resolved.segColours,
            };
        });
        return {
            strands,
            base: kept.base,
            //The leader ties the sun to what it made, so it only exists when the sun ON SCREEN belongs to the day
            //the curve describes. The clamp above having moved the instant is exactly the test: it only moves when
            //now falls outside the window, which is Yesterday showing a live sun over yesterday's curve. Two days,
            //nothing to tie, no leader.
            sunSlot: live === shownMs ? slotOfMs(shownMs, kept.slots) : null,
            sweep:   this._dayCurveT,
        };
    }



    //One depth pass of the day curve, all its strands. Lit builds every element and sets every attribute, so a
    //colour lands in an attribute slot where it is a string and nothing else - and Lit diffs `d` and `stroke-width`
    //against the DOM it already made, instead of an SVG string being re-parsed from scratch every camera frame.
    //
    //One depth pass's strands, drawn line by line. Each span carries its own width (its depth) and colour (a flow
    //strand changes hue along its length).
    private _renderDayCurvePass(pass: DayCurvePass): unknown
    {
        return svg`
            ${pass.foot ? svg`<path class="helios-day-curve-foot" d=${pass.foot} fill="none"></path>` : nothing}
            ${pass.risers ? svg`<path class="helios-day-curve-riser" d=${pass.risers} fill="none"></path>` : nothing}
            ${pass.strands.map(st => st.spans.map(s => svg`
                <path
                    class="helios-day-curve-line-outline ${st.dashed ? 'is-dashed' : ''} ${s.predicted ? 'is-predicted' : ''}"
                    d=${s.d}
                    fill="none"
                    stroke-width=${s.w + 2}
                ></path>
            `))}
            ${pass.strands.map(st => st.spans.map(s => svg`
                <path
                    class="helios-day-curve-line ${st.dashed ? 'is-dashed' : ''} ${s.predicted ? 'is-predicted' : ''}"
                    d=${s.d}
                    fill="none"
                    stroke=${s.colour}
                    stroke-width=${s.w}
                ></path>
            `))}
            ${pass.leader ? svg`
                <line
                    class="helios-day-curve-leader"
                    x1=${pass.leader.x1} y1=${pass.leader.y1}
                    x2=${pass.leader.x2} y2=${pass.leader.y2}
                    stroke=${pass.leader.stroke}
                ></line>
            ` : nothing}
            ${pass.beads.map(b => svg`
                <circle class="helios-day-curve-bead" cx=${b.x} cy=${b.y} r="3" fill=${b.colour}></circle>
            `)}
        `;
    }


    //Timeline mode selector: Forecast / Yesterday / Today / Week / Month. The active mode is highlighted. Every
    //mode is available (the detail panel aggregates a multi-day period by hour-of-day).
    //Pointer-down is swallowed so tapping never starts a scrub on the parent band.
    private _renderPeriodSelector(): TemplateResult
    {
        const t = pickTranslations(this.hass?.language);
        const labels: Record<TimelineMode, string> = {
            forecast:  t.period.forecast,
            yesterday: t.period.yesterday,
            today:     t.period.today,
            week:      t.period.week,
            month:     t.period.month,
        };
        return html`
            <div
                class="tb-period-selector"
                role="group"
                aria-label=${t.period.rangeLabel}
                @pointerdown=${this._stopPropagation}
            >
                ${TIMELINE_MODE_ORDER.map(m => html`
                    <button
                        type="button"
                        class="tb-period-seg ${this._timelineMode === m ? 'is-on' : ''}"
                        data-mode=${m}
                        @click=${this._onTimelineModeClick}
                    >${labels[m]}</button>
                `)}
            </div>
        `;
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
                const entityState = hass.states?.[entityId];
                const lat   = entityState?.attributes?.latitude;
                const lon   = entityState?.attributes?.longitude;
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

    //Called by the setHeliosLocation / clearHeliosLocation debug helpers. Clears the cached home key so
    //the next updated() sees identityChanged and re-inits the engine against the new coordinates, then
    //schedules that pass. The visual editor reaches the same re-init via the natural identity-drift path
    //(config-changed -> setConfig -> updated() notices getHomeCoords() resolves to a new key).
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
        this._pvChangeSeries              = null;
        this._pvChangeFetch.reset();
        this._pvChangeSeriesPerEntity     = new Map();
        this._haSolarForecast             = [];
        this._haSolarForecastLoaded       = false;
        this._haSolarForecastFetching     = false;
        this._haSolarForecastFetchedAt    = 0;
        this._haSolarForecastCoveredPastDays = 0;
        this._gridImportChangeSeries      = null;
        this._gridExportChangeSeries      = null;
        this._gridImportChangeSeriesPerEntity = new Map();
        this._gridExportChangeSeriesPerEntity = new Map();
        this._gridImportFetch.reset();
        this._gridExportFetch.reset();
        this._gridGuard                   = createGridGuard();
        this._batteryGuard                = createBatteryGuard();
        this._batterySocHistory           = null;
        this._batteryFetchKey             = '';
        this._batteryChargeChangeSeries   = null;
        this._batteryDischargeChangeSeries = null;
        this._batteryChargeChangeSeriesPerEntity    = new Map();
        this._batteryDischargeChangeSeriesPerEntity = new Map();
        this._batteryChangeFetch.reset();
        this._deviceChangeSeries          = new Map();
        this._deviceChangeFetch.reset();
        this._irradianceHistory           = null;
        this._irradianceFetchKey          = '';
        this._weatherOverrideState        = new Map();
        //Drop the unified store so the next paint rebuilds it from the refetched series rather than from the data
        //the user just cleared.
        this._unifiedStore                = null;
        //Drop the module-level caches too, else the next refresh rehydrates from the cross-mount cache with
        //the exact stale entry the user just cleared.
        clearBatteryModuleCaches();
        clearIrradianceModuleCaches();
        clearWeatherOverrideCaches();
        clearEnergyStatsCache();
        clearDurable();
        //Engine-side: clears localStorage weather cache, drops the in-memory hourly snapshot, refetches.
        this._engine?.resetDataCache();
        //Also drop the buildings caches (localStorage + shared) and re-fetch, so this one button refreshes
        //everything including the OpenFreeMap footprints.
        this._engine?.forceBuildingsRefetch();
        this.requestUpdate();
    }



    //Masonry sizing. 1 unit = 50 px so 10 ~ 500 px.
    public getCardSize(): number
    {
        return 10;
    }

    //Sections-view sizing. Full width (12 cols). The default is 8 rows (~480 px, the card's sweet spot), with a
    //low 4-row minimum so the user can still shrink it freely; below the comfortable height the timeline gets
    //cramped, which is the user's compromise to make.
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
            min_rows:    4,
            max_rows:    24,
            min_columns: 12,
            max_columns: 12
        };
    }

    //"No UI" mode: fade the timeline + controls after the configured idle delay (noUiDelayMs) of no input; any
    //input brings them back and restarts the countdown. Listeners are attached in connectedCallback; a no-op
    //when the mode is off. A delay of 0 means "never show the UI": input keeps it hidden rather than flashing it.
    private _onUiActivity = (): void =>
    {
        if (!autoHideUi(this.config))
        {
            return;
        }
        if (noUiDelayMs(this.config) <= 0)
        {
            if (!this._uiHidden)
            {
                this._uiHidden = true;
            }
            return;
        }
        if (this._uiHidden)
        {
            this._uiHidden = false;
        }
        this._scheduleUiHide();
    };

    private _scheduleUiHide(): void
    {
        if (this._uiHideTimer !== undefined)
        {
            window.clearTimeout(this._uiHideTimer);
            this._uiHideTimer = undefined;
        }
        if (!autoHideUi(this.config))
        {
            if (this._uiHidden)
            {
                this._uiHidden = false;
            }
            return;
        }
        //Delay 0: hide immediately and stay hidden (no timer), so the UI never reappears on input.
        const delay = noUiDelayMs(this.config);
        if (delay <= 0)
        {
            if (!this._uiHidden)
            {
                this._uiHidden = true;
            }
            return;
        }
        this._uiHideTimer = window.setTimeout(() =>
        {
            this._uiHidden = true;
        }, delay);
    }

    public connectedCallback(): void
    {
        super.connectedCallback();
        liveCards.add(this);
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
        //30 s tick: the header shows HH:MM, the sun moves ~0.13°/refresh (smooth) and the 5-day live cursor
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
        //"No UI" mode: watch for any input on the card and arm the idle fade (both no-ops when the mode is off).
        this.addEventListener('pointerdown', this._onUiActivity);
        this.addEventListener('pointermove', this._onUiActivity, { passive: true });
        this.addEventListener('wheel', this._onUiActivity, { passive: true });
        this.addEventListener('touchstart', this._onUiActivity, { passive: true });
        this._scheduleUiHide();
    }

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        this._wxRainCtl.stop();
        this._wxSnowCtl.stop();
        this._wxStormCtl.stop();
        liveCards.delete(this);
        window.clearInterval(this._timer);
        if (this._dayCurveRaf)
        {
            cancelAnimationFrame(this._dayCurveRaf); this._dayCurveRaf = 0;
        }
        this.removeEventListener('pointerdown', this._onUiActivity);
        this.removeEventListener('pointermove', this._onUiActivity);
        this.removeEventListener('wheel', this._onUiActivity);
        this.removeEventListener('touchstart', this._onUiActivity);
        if (this._uiHideTimer !== undefined)
        {
            window.clearTimeout(this._uiHideTimer); this._uiHideTimer = undefined;
        }
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
        if (this._engine)
        {
            this._engine.cacheKey = this.effectiveCacheId();
        }
        this._engine?.persistCameraPose();
        this.persistUiState();
        this._unregisterCacheId();
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


    //HA replaces the whole `hass` object on ANY entity's state_changed anywhere in the house, not just the ones
    //this card reads - a full render pass for a light bulb toggling in another room. Narrow gate: only when
    //this pass changed NOTHING but `hass` (config/@state changes always render normally, see below), skip it
    //unless something Helios actually reads moved. Cheap (a string join over a few dozen entities) next to the
    //render it may skip.
    protected shouldUpdate(changedProperties: PropertyValues): boolean
    {
        if (changedProperties.size === 1 && changedProperties.has('hass'))
        {
            const next = this._relevantHassFingerprint();
            //The fingerprint below only reads hass.themes.darkMode, so a theme swap that keeps the same
            //light/dark mode (the ordinary "pick a different theme" case) never shows up in it on its own.
            //Bypass on any hass.themes reference change too, the same signal willUpdate uses below to
            //invalidate the colour cache - otherwise such a swap could be silently blocked forever (until an
            //unrelated field happens to change in the same pass), leaving chip/chart colours stuck on the old
            //theme. _lastColorCacheThemesRef is updated in willUpdate, which only runs once this returns true,
            //so this naturally stays in sync pass to pass.
            const themesChanged = this.hass?.themes !== this._lastColorCacheThemesRef;
            if (!themesChanged && next === this._lastHassFingerprint)
            {
                return false;
            }
            this._lastHassFingerprint = next;
        }
        return super.shouldUpdate(changedProperties);
    }

    //Every hass-derived value a render pass can depend on: the Energy-dashboard-resolved entities
    //(_energyDefaults - the single source of truth, see the house rule against card-level sensor overrides)
    //plus the small set of config-driven sensor overrides (weather variables, irradiance) that read hass.states
    //directly, plus theme/language/home location. `id=state@last_changed` per entity, so an attribute-only
    //push some integrations use (same state string, new last_changed) is still caught.
    private _relevantHassFingerprint(): string
    {
        const hass = this.hass;
        const d    = this._energyDefaults;
        const ids  = [
            ...d.solarStatRates, ...d.solarStatEnergyFroms,
            ...d.gridStatRates, ...d.gridStatEnergyFroms, ...d.gridStatEnergyTos,
            ...d.gridImportPrices, ...d.gridExportPrices,
            ...d.batteryStatRates, ...d.batteryStatEnergyFroms, ...d.batteryStatEnergyTos, ...d.batteryStatSocs,
            ...d.devices.flatMap((dev) => [dev.statConsumption, dev.statRate]),
            String(this.config?.['solar-irradiance-entity'] ?? ''),
            ...WEATHER_OVERRIDE_CONFIG_KEYS.map((key) => String(this.config?.[key] ?? '')),
        ];
        let out = `${hass?.themes?.darkMode}|${hass?.language}`
            + `|${hass?.config?.latitude}|${hass?.config?.longitude}|${hass?.config?.time_zone}|${hass?.config?.elevation}`;
        for (const id of ids)
        {
            if (!id)
            {
                continue;
            }
            const s = hass?.states?.[id];
            out += `|${id}=${s?.state}@${s?.last_changed}`;
        }
        return out;
    }

    //Engine init policy: re-init only when an identity input changes (home coordinates). Container reflow
    //just resizes the existing engine; we never tear down the engine for a sibling re-render (it would
    //trash the user's in-progress editor edits).
    protected willUpdate(_changedProperties: PropertyValues): void
    {
        super.willUpdate(_changedProperties);
        //Bind the period aggregation's hour-of-day binning to the HOME time zone (see ./card/tz) before any frame
        //projects or the store rebuilds this cycle, so the "now" marker and the day/night wedges all group by the
        //home's real hour rather than the browser's. Idempotent, so it is cheap to run on every hass update.
        if (_changedProperties.has('hass'))
        {
            setServerTimeZone(this.hass?.config?.time_zone);
            //Drop the cached colour resolutions (see cssHex) the moment HA actually swaps hass.themes - a real
            //theme change, not just a re-render. hass.themes' own reference identity is HA's own change signal
            //for this (a same-theme hass update reuses the same object), so this never over- or under-fires.
            const themesRef = this.hass?.themes;
            if (themesRef !== this._lastColorCacheThemesRef)
            {
                this._lastColorCacheThemesRef = themesRef;
                clearUiColorCache(this);
            }
        }
    }

    //Corner weather chips (top-left column): outdoor temperature + humidity, resolved at the current live/scrub
    //time (Open-Meteo or the matching local sensor override). Each is hidden when turned off or without a reading.
    private _renderTempChip(): TemplateResult | typeof nothing
    {
        if (!showTemperature(this.config) || !isFinite(this._temperature))
        {
            return nothing;
        }
        //When a day curve is up, only the active chip is visible; the other stays in the DOM as an invisible
        //placeholder so the visible chip keeps its slot (the centered row must not shift when its sibling drops).
        const hidden = this._dayCurveOpen && this._chartTarget !== 'temperature';
        return this._cornerChip('temperature', formatTemperature(this.hass, this._temperature), hidden);
    }
    private _renderHumidityChip(): TemplateResult | typeof nothing
    {
        if (!showHumidity(this.config) || !isFinite(this._humidity))
        {
            return nothing;
        }
        const hidden = this._dayCurveOpen && this._chartTarget !== 'humidity';
        return this._cornerChip('humidity', `${Math.round(this._humidity)} %`, hidden);
    }
    private _cornerChip(slot: 'temperature' | 'humidity' | 'cost', text: string, hidden: boolean): TemplateResult
    {
        const color   = chipSlotColor(this, this.config, slot);
        const icon    = chipSlotIcon(this.config, slot);
        //Same re-targeting gesture as the scene chips: one tap points the chart + around-house curve at this
        //metric, a second tap on the active chip toggles its day curve (onChartTargetClick).
        const active  = this._chartTarget === slot;
        const curveOn = active && this._dayCurveOpen;
        //A hidden chip carries is-slot-hidden (visibility:hidden): it reserves its width but is automatically
        //inert, unfocusable and out of the a11y tree, so role/tabindex/click can stay static.
        return html`
            <div
                class="helios-corner-chip ${active ? 'is-chart-active' : ''} ${curveOn ? 'is-curve-on' : ''} ${hidden ? 'is-slot-hidden' : ''}"
                style=${`--chip-color:${color}`}
                role="button"
                tabindex="0"
                data-target=${slot}
                @click=${this.onChartTargetClick}
            >
                <ha-icon icon=${icon}></ha-icon>
                <span>${text}</span>
            </div>`;
    }

    //Cost chip: the live NET money rate in the user's currency per hour. Fixed, user-configurable colour
    //+ icon like every other chip (no sign-driven colour); spend vs earn is carried by the value's sign (a negative
    //rate means you are earning). Tap it like any chip to bring up its cost curve. Hidden when turned off or when no
    //cost is configured (no resolvable rate).
    private _renderCostChip(): TemplateResult | typeof nothing
    {
        if (!showCost(this.config) || this._costRate === null)
        {
            return nothing;
        }
        const hidden = this._dayCurveOpen && this._chartTarget !== 'cost';
        const val = this._costRate
            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return this._cornerChip('cost', `${val} ${this._currency}/h`, hidden);
    }

    //Push the resolved weather onto the host as --wx-* vars (scene grade + overlay strengths) and drive the
    //rain/snow/storm controllers. Source is the resolved live/scrub weather (any local sensor overrides are
    //already folded in upstream). The sun glow is anchored on the real sun position and gated on daylight.
    private _applyWeather(): void
    {
        this.toggleAttribute('data-wx-on', this._wxOn);

        if (!this._wxOn)
        {
            this._wxRainCtl.setIntensity(0);
            this._wxSnowCtl.setIntensity(0);
            this._wxStormCtl.setStrength(0);
            this._engine?.setWeatherGrade(1, 1);
            return;
        }

        const sun = this._sunScene?.sun;
        const p = weatherLayers(this._wxInput);
        this._setWxVar('--wx-sun', p.sun.toFixed(3));
        if (sun)
        {
            this._setWxVar('--wx-sun-x', `${sun.x.toFixed(1)}px`);
            this._setWxVar('--wx-sun-y', `${sun.y.toFixed(1)}px`);
        }
        this._setWxVar('--wx-grey',  p.grey.toFixed(3));
        this._setWxVar('--wx-cloud', p.cloud.toFixed(3));
        this._setWxVar('--wx-rain',  p.rain.toFixed(3));
        this._setWxVar('--wx-snow',  p.snow.toFixed(3));
        this._engine?.setWeatherGrade(p.sat, p.bright);
        this._wxRainCtl.setIntensity(p.rain);
        this._wxSnowCtl.setIntensity(p.snow);
        this._wxStormCtl.setStrength(p.storm);
    }

    //Off-screen / hidden-tab pause for the weather canvases (their rAF loops aren't covered by the CSS animation
    //pause). Stop halts the three loops; resume re-applies the current weather, which restarts whatever is falling.
    public pauseWeather(paused: boolean): void
    {
        if (paused)
        {
            this._wxRainCtl.stop();
            this._wxSnowCtl.stop();
            this._wxStormCtl.stop();
        }
        else
        {
            this._applyWeather();
        }
    }

    protected updated(_changedProperties: PropertyValues): void
    {
        //"No UI" mode: reflect the faded state onto the host so the CSS fades the timeline + controls.
        this.toggleAttribute('data-ui-hidden', this._uiHidden);

        //"Your real sky": recompute the weather layers whenever the resolved weather, the master switch or the sun
        //(glow anchor + day/night) changes.
        if (_changedProperties.has('_cloudCover') || _changedProperties.has('_precip')
            || _changedProperties.has('_snowfall') || _changedProperties.has('_weatherCode')
            || _changedProperties.has('_wxOn') || _changedProperties.has('_sunScene')
            || _changedProperties.has('config'))
        {
            this._applyWeather();
        }

        //With the timeline hidden there's no period selector or scrub: pin the mode to Today so the scene reads
        //as "right now", and snap any active scrub back to live (a frozen past instant would otherwise stick).
        if (!showTimeline(this.config))
        {
            if (this._timelineMode !== 'today')
            {
                this._setTimelineMode('today');
            }
            this._exitScrubMode();
        }

        //Publish the home (consumption) colour as a :host CSS var so every consumption readout reads it.
        publishConsumptionColor(this);

        //Terrain-horizon ridge: show/hide the drawn line (the sun gate always uses the terrain), and publish its
        //colour as a :host var, resolved through the shared ui_color resolver so a token, hex or rgb all work.
        this._engine?.setHorizonLineVisible(showHorizonLine(this.config));
        this.style.setProperty(
            '--helios-horizon-line-color',
            resolveUiColor(this, horizonLineColor(this.config), '#607d8b', 'blue-grey')
        );

        //Restore the saved selected chip once coords resolve (idempotent; retries until ready).
        this._restoreUiState();

        //Default chart target: until the user has picked a chip (or a saved pick was restored), track the first
        //configured + visible target as the Energy config resolves (consumption -> production -> grid -> battery
        //-> groups), so a card with no solar never opens on an empty production selection.
        if (!this._chartTargetExplicit && _changedProperties.has('_energyDefaults'))
        {
            const resolved = firstAvailableChartTarget(this.config, this._energyDefaults);
            if (resolved && resolved !== this._chartTarget)
            {
                this._chartTarget = resolved;
            }
        }

        //Unified data store refresh. Rebuilds when any underlying source changed since the last build, so
        //every consumer reads the latest data without per-consumer invalidation. Cheap when nothing changed
        //(one hash compare), ~50 ms for a full 480 x 7 bucketization + forecast pass on a real refresh.
        this._maybeRebuildUnifiedStore();

        //Drive the home prism's colour from the active chip. The squash/grow plays only when the chip
        //CHANGES; a scrub or live tick on the same chip recolours instantly.
        //Gated on these states so the frequent auto-rotate reprojections (which touch none of them) don't
        //re-resolve the theme colour every frame.
        if (this._engine
            && (_changedProperties.has('_chartTarget')
                || _changedProperties.has('_selectedTime')
                || _changedProperties.has('hass')
                //Energy/PV data lands via callWS subscriptions that requestUpdate() WITHOUT touching hass,
                //but they rebuild the unified store, so watch it too, else the default (PV) home never picks
                //up its colour + per-source bands until the user clicks a chip.
                || _changedProperties.has('_unifiedStore')
                //Engine (re)spawn: after a remount the chip may have been RESTORED to a non-default metric
                //while the engine was still null, so repaint the home for the active chip once it lands.
                //Without this the prism keeps the engine's default colour while the chip shows another mode.
                || _changedProperties.has('_engine')))
        {
            this.updateHomeAppearance(_changedProperties.has('_chartTarget'));
        }

        //Day curve. One pass over the day's slots off data already in hand, so the gate below is only to keep it
        //off the auto-rotate reprojection path, which touches none of these. `_selectedTime` is in it because the
        //scrub moves the sun: its leader follows, and a scrub onto another day rebuilds the ground track under the
        //new arc.
        if (this._engine
            && (_changedProperties.has('_dayCurveOpen')
                //Everything the curve reads has to be able to wake it. `_now` carries the cut at the present
                //moment, `_energyDefaults` the meters behind the layer split, `_timeRange` the window whose
                //absence makes the profile empty.
                || _changedProperties.has('_now')
                || _changedProperties.has('_energyDefaults')
                || _changedProperties.has('_timeRange')
                //The sweep is CARRIED to the engine in the curve's data, so every step of it has to come back
                //through here. Left out, the engine kept whichever sweep happened to be current the last time
                //something else in this list moved - which was 0 the instant the animation started, so the curve
                //never appeared, and 1 by the time it was switched off, so it appeared then instead. The states
                //were not inverted: the sweep was one gate behind, permanently.
                || _changedProperties.has('_dayCurveT')
                || _changedProperties.has('_chartTarget')
                || _changedProperties.has('_unifiedStore')
                //The group and battery curves read these; a late data arrival on the active target has to wake it.
                || _changedProperties.has('_deviceChangeSeries')
                || _changedProperties.has('_batterySocHistory')
                || _changedProperties.has('_batterySocPerBankHistory')
                || _changedProperties.has('_timelineMode')
                || _changedProperties.has('_selectedTime')
                || _changedProperties.has('_engine')))
        {
            this._engine.setDayCurve(this._buildDayCurve());
            refreshHud(this);
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


        //Ensure the engine exists + reflects the current coords/config, and get the config signature the
        //refresh gate needs. null means bail this pass (no hass/config/coords, or the engine was just spawned).
        const sig = this._maybeBootstrapOrUpdateEngine();
        if (sig === null)
        {
            return;
        }
        this._runRefreshChainIfNeeded(sig);
    }

    //Create the engine on first paint (then update it in place: setHome on a coord change, updateConfig on an
    //option change), returning the current config signature for the refresh gate, or null when updated() should
    //bail this pass (no hass/config/coords, engine just spawned, or the element is detached).
    private _maybeBootstrapOrUpdateEngine(): string | null
    {
        if (!this.hass?.config || !this.config)
        {
            return null;
        }

        const coords = getHomeCoords(this.config, this.hass);
        if (!coords)
        {
            return null;
        }

        const { lat, lon } = coords;
        const homeKey  = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        const identityChanged = homeKey !== this._lastHomeKey;

        if (!this._engine)
        {
            //Disconnected guard: edit-mode wrapping can fire updated() on a detached element.
            if (!this.isConnected)
            {
                return null;
            }
            if (this._initInflight)
            {
                return null;
            }
            this._lastHomeKey   = homeKey;
            this._lastConfigSig = computeConfigSig(this.config);
            initEngine(this);
            return null;
        }

        //Home moved: re-tile + re-fetch for the new coordinates.
        if (identityChanged)
        {
            this._lastHomeKey = homeKey;
            this._engine.setHome(lat, lon);
        }

        //Push config down only when the visual config actually changed. Otherwise updateConfig() runs on every
        //Lit re-render (periodic tick, any @state) and rebuilds the GeoJSON of thousands of points.
        const sig = computeConfigSig(this.config);
        if (sig !== this._lastConfigSig)
        {
            this._lastConfigSig = sig;
            this._engine.updateConfig(this.config);
        }
        return sig;
    }

    //Run the per-entity refresh chain, gated so it only fires when hass / config / time range / energy-defaults
    //moved. Lit calls updated() on every @state mutation (every HUD re-projection), so without this gate the chain
    //re-runs at 60+ Hz for no new data. Config is compared by content SIGNATURE, not object reference: the dashboard
    //editor hands the card a fresh-but-equivalent config object on every push, and a reference check would flip the
    //gate every frame and spin the refresh chain (and its fetches) into a loop.
    private _runRefreshChainIfNeeded(sig: string): void
    {
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
        //Cost: kick the cost-statistics fetch (gated), then recompute the live rate (from those stats when loaded,
        //else a configured price x the grid live values just computed above).
        refreshCostSeries(this);
        refreshCostLive(this);
        refreshIrradiance(this);
        refreshWeatherOverrides(this);
        //Per-device consumption series for the monitoring groups (fire-and-forget; keyed so an unchanged id-set +
        //window is a no-op; clears itself when no device is grouped).
        refreshDeviceConsumption(this);
        //Solar forecast: read natively from HA's Energy dashboard (energy/solar_forecast). Non-fatal; with
        //no forecast source configured the call returns empty and the curve doesn't render. On the refresh
        //chain (which energy-prefs changes re-trip), so a freshly configured source lands next pass.
        fetchHaSolarForecast(this);
    }


    //Timeline pointer interaction

    _trackElement:   HTMLElement | null = null;
    _trackPointerId: number | null      = null;


    boundPointerMove = (e: PointerEvent): void => onTimelinePointerMove(this, e);
    boundPointerUp   = (e: PointerEvent): void => onTimelinePointerUp(this, e);


    //Page-visibility listener that invalidates the cached theme probe when the tab returns to foreground.
    //HA can push a hass with stale themes for one frame after resume, so we drop the cache and force a
    //re-render to pick up a theme polarity flip that happened while backgrounded.
    private _onPageVisibilityForTheme = (): void =>
    {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible')
        {
            this._cachedIsDarkThemesRef = HeliosCard._UNCACHED_THEMES;
            this.requestUpdate();
        }
    };

    //Bound delegates to the timeline + chart-hover module helpers, which need the host as first arg.
    private _onTimelinePointerDown = (e: PointerEvent): void => onTimelinePointerDown(this, e);
    private _onChartHoverMove      = (e: PointerEvent): void => onChartHoverMove(this, e);
    private _onChartHoverLeave     = (): void => onChartHoverLeave(this);

    //Explicit "back to live" button: jump straight from a scrubbed instant to the live cursor, no fiddling
    //with the slider. Its pointerdown is swallowed so pressing it never scrubs the track underneath.
    private _onReturnToLive = (e: Event): void =>
    {
        e.stopPropagation(); returnTimelineToLive(this);
    };
    private _stopPointer    = (e: Event): void =>
    {
        e.stopPropagation();
    };
    private get _backToLiveLabel(): string
    {
        return pickTranslations(this.hass?.language).editor.backToLive;
    }


    //Resolve the active theme polarity, used to drive the `theme-dark` / `theme-light` class on the card. The
    //basemap's dark tint and every theme colour follow that class in CSS, so this pushes nothing to the engine.
    //Authoritative: hass.themes.darkMode; the getComputedStyle fallback covers older HA builds and custom
    //themes that scope --primary-background-color below :host (only the fallback is cached).
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
        const isDark = isDarkFromCss(this);
        this._cachedIsDarkThemesRef = themesObj;
        this._cachedIsDark = isDark;
        return isDark;
    }

    //hass.themes read through the one narrowing cast, so themeIsDark() and render() don't each re-spell it.
    private _themesObj(): { darkMode?: boolean } | undefined
    {
        return (this.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes;
    }

    //Current theme polarity, used to seed a new engine at construction.
    public themeIsDark(): boolean
    {
        return this._computeIsDark(this._themesObj());
    }


    //Render

    protected render(): TemplateResult
    {
        //Precondition for the live card chrome: home coordinates resolved (HA config or card-level lat/lon
        //override). The basemap needs no API key, so this is purely "can we project the home".
        const hasHomeCoords = getHomeCoords(this.config, this.hass) !== null;


        //Scene HUD: the home-anchored energy chip cluster (PV / battery / grid / home consumption),
        //their animated leaders, the solar arc depth passes and the sun disc/ray geometry. It resolves its own
        //chip/leader/sun model from the card's scrub/live + layout + sun @state and returns the HUD fragment,
        //also exposing the two directional leader colours (read back for the detail-panel accent below).
        const hud = this._hud.render();

        //Detect the active HA theme. Authoritative: hass.themes.darkMode (HA flips it on every theme swap).
        //A getComputedStyle luminance probe is the fallback for older HA builds that lack it.
        const isDark = this._computeIsDark(this._themesObj());
        const cardThemeClass = isDark ? 'theme-dark' : 'theme-light';

        //camera-locked swaps the grab cursor for the default arrow when drag-rotate is inert, so the open-hand cursor
        //isn't misleading. Re-evaluated every render.
        const cameraLocked = this._isCameraLocked();
        //Detail panel accent (from the active chip) drives both the panel border and the little "i" badge on the
        //open chip, so it lives as a card-level class + CSS var.
        const infoOpen = this._infoPanelOpen;
        //Detail-panel + timeline accent = the ACTIVE chip's live colour (see _activeChipColor).
        const activeChipColor = this._activeChipColor();
        const cardClasses = [
            cardThemeClass,
            cameraLocked      ? 'camera-locked'  : '',
            this.preview      ? 'helios-edit'    : '',
        ].filter(Boolean).join(' ');
        //Selected-chip accent for the timeline + period-selector top borders (always), plus the detail-panel
        //accent (same colour) only when the panel is open.
        const cardStyle = `--tb-accent:${activeChipColor}${infoOpen ? `; --detail-accent:${activeChipColor}` : ''}`;
        //Whether the bottom timeline chrome is on screen. Also lifts the weather chips clear of it (.has-timeline).
        const timelineShown = hasHomeCoords && this._timeRange && showTimeline(this.config);

        return html`
            <ha-card class=${cardClasses} style=${cardStyle}>

                <div
                    id="map-container"
                    @pointerdown=${this._onSceneTapStart}
                    @pointerup=${this._onSceneTapEnd}
                ></div>

                <!--  "Your real sky": weather overlay layers, then the weather chips (temperature, humidity),
                      grouped along the bottom with the scene pill family (lifted above the timeline when shown).  -->
                ${weatherOverlay()}
                <div class="helios-corner-chips ${timelineShown ? 'has-timeline' : ''}">
                    ${this._renderCostChip()}
                    ${this._renderTempChip()}
                    ${this._renderHumidityChip()}
                </div>

                ${timelineShown ? html`
                    <div
                        class="time-bar"
                        @pointerdown=${this._onTimelinePointerDown}
                    >
                        ${renderTimelineHoverTooltip(this)}

                        ${!this._isLiveMode && this._selectedTime !== null ? html`
                            <button
                                class="tb-live-btn"
                                type="button"
                                title=${this._backToLiveLabel}
                                aria-label=${this._backToLiveLabel}
                                @pointerdown=${this._stopPointer}
                                @click=${this._onReturnToLive}
                            >
                                <ha-icon icon="mdi:skip-forward"></ha-icon>
                                <span>Live</span>
                            </button>
                        ` : nothing}

                        <!--  Single re-targetable bottom chart: the active _chartTarget picks the series
                              (production + dashed forecast + per-source breakdown by default; grid /
                              battery / irradiance once a chip re-targets it). Hosts the dotted day
                              separators, the night-zone hatch, the future mask and the live + scrub
                              cursors. The day-label strip sits below so it never covers the curves.  -->
                        <div
                            class="tb-chart-stack"
                            style="--chart-accent:${activeChipColor}"
                        >
                            <div
                                class="tb-chart-card"
                                @pointermove=${this._onChartHoverMove}
                                @pointerleave=${this._onChartHoverLeave}
                            >
                                ${keyed(`${this._chartTarget}|${this._timelineMode}`, renderBottomChart(this))}
                                ${(this._timelineMode === 'forecast' || this._timelineMode === 'today' || this._timelineMode === 'yesterday' || this._timelineMode === 'week')
        ? renderTimelineNightZones(this) : nothing}
                                ${renderTimelineFutureMask(this)}
                                ${renderTimelineTicks(this)}
                            </div>
                            ${renderTimelineDayLabels(this)}
                        </div>
                    </div>
                ` : nothing}

                <!--  Period-mode band: a separate strip BELOW the timeline (own card styling, same width,
                      radius and themed border), holding the Forecast / Yesterday / Today / Week / Month selector.  -->
                ${hasHomeCoords && showTimeline(this.config) ? html`
                    <div class="tb-band">
                        ${this._renderPeriodSelector()}
                    </div>
                ` : nothing}

                ${hud}

                <!--  Day curve, in two depth passes. Both sit ABOVE the solar overlays (sun, arc, irradiance, z 14/15)
                      so auto-rotation never sweeps them over the reading; near stays over far so the curve
                      self-occludes at its own crossings. Above the buildings either way, because it is a reading of
                      the data and not a wall standing in the street.  -->
                ${this._dayCurveScene ? html`
                    <svg class="helios-day-curve-svg helios-day-curve-far">
                        ${this._renderDayCurvePass(this._dayCurveScene.far)}
                    </svg>
                    <svg class="helios-day-curve-svg helios-day-curve-near">
                        ${this._renderDayCurvePass(this._dayCurveScene.near)}
                    </svg>
                ` : nothing}

                <!--  Per-chip detail panel: tapping a chip aggregates its metric over the window in a compact
                      top-right readout (icons only, values in the card's unit).  -->
                ${infoOpen && hasHomeCoords && showDetailPanel(this.config) ? renderDetailPanel(this) : nothing}

            </ha-card>
        `;
    }


    //Per-card unique id namespacing SVG <defs> ids so multiple Helios cards don't clash on gradient/filter refs.
    _instanceId = `h${Math.floor(Math.random() * 1e9).toString(36)}`;

    //Hover handlers on the home hitbox. Toggle the sun-coloured glow halo so the focal building reads as
    //interactive. Cleared on exit so the glow can't stick if the cursor leaves mid-fade.
    onHomeEnter = (): void =>
    {
        this._homeHover = true;
    };
    onHomeLeave = (): void =>
    {
        this._homeHover = false;
    };

    //Map-background tap: anchor the move threshold that tells a tap from a drag-rotate.
    private _sceneTapStartX = 0;
    private _sceneTapStartY = 0;
    //Pointer position relative to the card's top-left, or null when the card element isn't mounted yet.
    private _localPointerXY(e: PointerEvent): { x: number; y: number } | null
    {
        const card = this._haCard;
        if (!card)
        {
            return null;
        }
        const rect = card.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    private _onSceneTapStart = (e: PointerEvent): void =>
    {
        const p = this._localPointerXY(e);
        if (!p)
        {
            return;
        }
        this._sceneTapStartX = p.x;
        this._sceneTapStartY = p.y;
    };
    //Release: a tap (movement under ~10 px) on the map background closes the open detail panel, so a selected
    //chip can be dismissed by tapping empty space (touch has no click-outside otherwise). Chips / timeline /
    //buttons are separate overlays that never reach this handler. A real drag rotated the camera and is ignored.
    private _onSceneTapEnd = (e: PointerEvent): void =>
    {
        const p = this._localPointerXY(e);
        if (!p)
        {
            return;
        }
        if (Math.hypot(p.x - this._sceneTapStartX, p.y - this._sceneTapStartY) > 10)
        {
            return;
        }
        if (this._infoPanelOpen)
        {
            this._infoPanelOpen = false;
        }
        //One gesture, one rule: a tap on the scene puts away everything a chip tap put up.
        this._setDayCurveOpen(false);
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
    //True once _restoreUiState() has run, so updated() reads localStorage at most once instead of on every pass.
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
    public effectiveCacheId(): string
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

    //Per-home localStorage key for the card's UI state (selected chip + timeline mode). Mirrors the engine's
    //camera-pose key scheme so each home restores its own view. Null before coords resolve.
    private _uiStateStorageKey(): string | null
    {
        //A per-card cache id isolates cards on the same home (duplicates get a #N suffix); else fall back to
        //the home coordinates.
        const id = this.effectiveCacheId();
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

    //Restore the saved selected chip + timeline mode once (the camera pose + lock restore inside the engine at
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
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object')
            {
                const valid: ChartTarget[] = ['production', 'consumption', 'grid', 'battery', 'battery-soc', 'irradiance', 'temperature', 'humidity', 'cost', ...GROUP_TARGETS];
                if (typeof parsed.chartTarget === 'string' && valid.includes(parsed.chartTarget as ChartTarget))
                {
                    //A restored pick is the user's own, so it stands and is never re-resolved to the default.
                    this._chartTarget = parsed.chartTarget as ChartTarget;
                    this._chartTargetExplicit = true;
                }
                if (typeof parsed.timelineMode === 'string' && parsed.timelineMode in TIMELINE_MODES)
                {
                    this._timelineMode     = parsed.timelineMode as TimelineMode;
                    this._periodPastDays   = modePastDays(this._timelineMode);
                    this._periodFutureDays = modeFutureDays(this._timelineMode);
                }
            }
        }
        catch (_)
        {
            //Disabled/quota/private-window storage degrades to "use defaults".
        }
    }

    persistUiState(): void
    {
        const key = this._uiStateStorageKey();
        if (!key)
        {
            return;
        }
        try
        {
            window.localStorage.setItem(key, JSON.stringify({
                chartTarget:  this._chartTarget,
                timelineMode: this._timelineMode,
            }));
        }
        catch (_)
        {
            //Silent-degrade; only cross-reload persistence is lost.
        }
    }

    static styles = [heliosCardStyles, heliosTimelineStyles];
}
