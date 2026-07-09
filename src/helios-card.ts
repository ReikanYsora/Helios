import type { PropertyValues, TemplateResult} from 'lit';
import { LitElement, html, nothing } from 'lit';
import { customElement, property, state, query, queryAll } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { HeliosEngine } from './scene/helios-engine';
import
{
    type HeliosConfig,
    autoHideUi,
    homeColor,
    cacheId,
} from './core/config/helios-config';
import { refreshClockHourly, clockNeedsHourly, type ClockHourly } from './clock/clock-hourly';
import { type TimelineMode, TIMELINE_MODES, TIMELINE_MODE_ORDER, modeFetchPeriod, modePastDays, modeFutureDays } from './timeline/timeline-modes';
import { DAY_MS, UI_AUTOHIDE_MS, CLOCK_GROW_MS } from './core/config/constants';
import { pickTranslations } from './core/i18n';
import { heliosCardStyles } from './css/helios-card-scene-css';
import { heliosTimelineStyles } from './css/helios-timeline-css';
import { heliosCardEnergyClockCss } from './css/helios-card-energy-clock-css';
import {
    type ClockData, type DayRingHit,
    availableClockTargets, clockTargetMeta, clockTargetLabel,
} from './clock/energy-clock';
import { refreshDayRing, type DayRingData } from './clock/consumption-ring';
import { setServerTimeZone } from './core/time/timezone';
import { isDarkFromCss, cssHex, uiColorVar } from './core/format/format';
import { refreshPv } from './data/sources/pv';
import
{
    refreshBattery,
    clearBatteryModuleCaches
} from './data/sources/battery';
import { refreshIrradiance, clearIrradianceModuleCaches } from './data/sources/irradiance';
import
{
    renderBottomChart,
    chartAccentColor,
    solarBands,
    type ChartTarget,
    GROUP_TARGETS,
    renderTimelineTicks,
    renderTimelineDayLabels,
    renderTimelineNightZones,
    renderTimelineFutureMask,
    renderTimelineHoverTooltip,
    handleChartHoverMove,
    handleChartHoverLeave
} from './charts/charts';
import { renderDetailPanel } from './hud/detail-panel';
import type { ArcSegment, SunScene, LabelLayout } from './hud/hud';
import
{
    tick,
    onTimelinePointerDown,
    onTimelinePointerMove,
    onTimelinePointerUp
} from './timeline/timeline';
import { refreshGrid } from './data/sources/grid';
import { refreshDeviceConsumption } from './data/sources/device-consumption';
import { createGridGuard, type GridGuardState } from './data/sources/grid-guard';
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
    initVisibilityObserver
} from './card/init';
//Side-effect import: registers <helios-card-editor> as a custom element.
import './editor/editor';
//Side-effect import: writes the Helios entry into window.customCards for the HA card picker.
import './card/registry';
//Side-effect import: install banner, location-override debug helpers and the page-wide data-cache reset
//bus. liveCards is the shared registry each card adds/removes itself from.
import { liveCards } from './card/diagnostics';
import { ClockController } from './clock/clock-controller';
import { SceneHudController } from './hud/scene-hud-controller';


//Live cards grouped by their (auto-generated) cache id, in connection order. A pasted card carries a copy of
//the source's id; the registry hands each same-id card a distinct, order-stable storage slot so duplicates
//never share, without the user ever seeing or managing the id.
const _cacheIdRegistry = new Map<string, HeliosCard[]>();


//Main card


@customElement('helios-card')
export class HeliosCard extends LitElement
{
    @property({ attribute: false }) public hass!: any;
    @property({ attribute: false }) config!: HeliosConfig;
    //Set by HA on the editor's live-preview card. HA rebuilds that card on every keystroke, so intro
    //animations (prism rise, timeline curve grow) are suppressed while it is true.
    @property({ attribute: false }) public preview = false;

    //Clock dial subsystem (view-mode switching, the filter toggle, the grow/slide/exit + dim animation
    //engine, dial data build, paint/hit-test, the dial tooltips). Owns its own scratch/animation state; the
    //reactive @state it drives stays on the card and is reached through the controller's host back-reference.
    readonly _clock = new ClockController(this);

    //Scene HUD subsystem (the home-anchored energy chip cluster, its animated leader paths, the solar arc
    //depth passes and the sun disc/ray geometry). Reads the card's scrub/live + layout + sun @state through
    //its host back-reference and returns the HUD template fragment for render().
    readonly _hud = new SceneHudController(this);

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
    _gridImportFetch = new KeyedFetch();
    _gridExportFetch = new KeyedFetch();
    //Mis-scope guard for the live grid sensor (grid-guard.ts). Plain field: transitions are pushed through
    //requestUpdate() by the guard itself, so no @state on the mutable object.
    _gridGuard: GridGuardState = createGridGuard();
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
    //Decoupled hourly clock profile (hour-of-day averages), built only in clock mode on a sub-hourly store
    //(month/year). Null otherwise (buildClockData then reads the store). _clockHourlyKey dedupes refetches.
    @state() _clockHourly: ClockHourly | null = null;
    _clockHourlyKey = '';
    _batteryFetchKey  = '';
    _batteryFetching  = false;
    //Recorder change series for battery charge (stat_energy_to) + discharge (stat_energy_from) meters:
    //canonical past-power source for the unified store + scrub. Net (charge - discharge) gives a
    //structural sign so charging is never lost.
    @state() _batteryChargeChangeSeries:    ChangeBucket[] | null = null;
    @state() _batteryDischargeChangeSeries: ChangeBucket[] | null = null;
    _batteryChangeFetch = new KeyedFetch();
    //Per-device recorder `change` series (statConsumption id -> buckets) for the grouped + visible devices, feeding
    //the monitoring-group chips, rings and clock histogram. Empty until the first fetch / when no device is grouped.
    @state() _deviceChangeSeries = new Map<string, ChangeBucket[]>();
    _deviceChangeFetch = new KeyedFetch();
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
    //Detail panel (scene mode): a compact top-right readout aggregating the selected metric over the window. Opens
    //on a single chip tap (alongside re-pointing the chart); re-tapping the active chip toggles it shut. Bound to
    //the active chip, not a target, so switching chips while open just re-points it.
    @state() _infoPanelOpen = false;
    //Top-left mode selector: 'scene' is the 3D view; 'clock' fades every layer but the basemap and paints the
    //hourly cylinder ring. Scene is the default.
    @state() _viewMode: 'scene' | 'clock' | 'day' = 'scene';
    //"No UI" mode: true once the idle timer fires, hiding (fading) the timeline + controls; any input clears it.
    @state() private _uiHidden = false;
    private _uiHideTimer: number | undefined;
    //Day mode: today's per-slot solar + grid-import shares for the ground ring (24 * display-frequency slots), with its key.
    @state() _dayRing: DayRingData | null = null;
    _dayRingKey = '';
    //Day-mode selection: a STABLE key ('solar' / 'grid' / 'battery' or 'dev:<statId>') so it survives reorder /
    //refetch and can persist to localStorage. Tapping a ring sets it, re-tapping (or tapping empty) clears it; it
    //drives the dim repaint + the top-right detail panel. The hit targets are captured from the last paint.
    @state() _daySelectedKey: string | null = null;
    _dayHitPolys: DayRingHit[] = [];
    //Entry-animation start (ms, Date.now). 0 = no animation in flight, draw the ring fully. Set when day mode is
    //entered or the day is switched (today <-> yesterday); the controller runs a 1 s rAF sweep off it.
    _dayAnimStart = 0;
    //Per-hour night share for the dial's ground day/night wedges, recomputed when the home or window changes.
    @state() _nightFrac: number[] | null = null;
    //Active clock-mode filters, ordered: each selected metric draws one concentric ring (first = outermost).
    //Persisted; the timeline (hidden in clock mode) follows the first when scene mode resumes.
    @state() _clockTargets: ChartTarget[] = [];
    //Energy-clock rings, one ClockData per active filter (outer -> inner). Rebuilt on a filter/data change.
    //Reactive so the dial repaints on a rebuild; the ClockController mutates it through its host reference.
    @state() _clockData: ClockData[] = [];
    //Hovered slot; resolves to its hour and lights every ring's area for that hour + drives the tooltip. null = off.
    @state() _clockHoverSlot: number | null = null;
    //Home prism hovered/tapped: brightens it + shows the window-total tooltip (does NOT dim the cylinders).
    @state() _clockHomeHover = false;
    @query('ha-card') _haCard?: HTMLElement;
    @query('.clock-svg') _clockSvg?: SVGSVGElement;
    @queryAll('.clock-hour-label') _clockLabels!: NodeListOf<HTMLElement>;
    @queryAll('.clock-compass-label') _clockCompassLabels!: NodeListOf<HTMLElement>;
    @state() _chartSeries: {
        times:        Date[];
        irradiance:   number[];
        cloud:        number[];
        //Hourly low/mid/high cloud cover in %, for the timeline's cloud target (three altitude bands).
        cloudLow:     number[];
        cloudMid:     number[];
        cloudHigh:    number[];
    } | null = null;
    @state() _timeRange:    { start: Date; end: Date } | null = null;
    @state() _selectedTime: Date | null = null;
    @state() _isLiveMode    = true;
    //Active timeline mode (now / week / month / year). Drives the window + store cadence + fetch period +
    //scrub snapping (see card/timeline-modes.ts). Persisted per card; the toggle lives in the bottom band.
    @state() _timelineMode: TimelineMode = 'standard';
    //Active rolling-window span (days of history/forecast around today), derived from the mode. Pushed to the
    //engine via setPeriodDays(), read by buildUnifiedStore. Single runtime source of truth for the window.
    //Not @state: changes go through _applyPeriod(), which requestUpdate()s after dropping store + window.
    _periodPastDays   = modePastDays('standard');
    _periodFutureDays = modeFutureDays('standard');

    //Flipped by fetchEnergyPrefs after the first parse lands, so the card kicks refreshHaDailyTotals as
    //soon as the HA Energy defaults snapshot appears rather than waiting up to 30 s for the next tick.
    _energyDefaultsLoaded   = false;
    private _dailyTotalsKicked = false;
    //Unified 5-day data store. Built after the initial weather + PV + battery + grid fetches, rebuilt when
    //any refresh, sliced/interpolated by the radial dial, graph view and main timeline. Live numeric chips
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
    private _cachedIsDarkThemesRef: unknown = undefined;
    private _cachedIsDark = false;
    //Last resolved home-colour token, so the :host consumption var is only re-derived when it changes.
    private _homeColorToken = '';

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

    //Timeline mode selector (Now / 1 week / 1 month / 1 year). Derives the window from the mode spec, applies
    //it (drops + rebuilds the store at the mode's cadence), persists, and (when in clock mode, where the band
    //stays visible) replays the dial grow so the change animates.
    private _setTimelineMode(mode: TimelineMode): void
    {
        if (this._timelineMode === mode) { return; }
        this._timelineMode = mode;
        const spec = TIMELINE_MODES[mode];
        this._periodPastDays   = modePastDays(mode);
        this._periodFutureDays = modeFutureDays(mode);
        //Entering a no-weather mode: drop weather metrics from the clock filters + retarget the chart off them.
        if (!spec.weather)
        {
            this._clockTargets = this._clockTargets.filter(t => t !== 'irradiance');
            if (this._chartTarget === 'irradiance')
            {
                this._chartTarget = this._clockTargets[0] ?? 'production';
            }
        }
        this._applyPeriod();
        this.persistUiState();
        if (this._viewMode === 'clock')
        {
            //Shrink the current rings out now; they grow back once the new window's data lands (updated()).
            //Anchor the expected series start (midnight - new past span) so the grow gate can tell a completed
            //refetch for THIS window from the stale series the store would otherwise rebuild from eagerly.
            const today0 = new Date();
            today0.setHours(0, 0, 0, 0);
            this._clock._clockReloadStart = Date.now();
            this._clock._clockReloadWindowStartMs = today0.getTime() - this._periodPastDays * DAY_MS;
            this._clock._clockGrowStart.clear();
            void refreshClockHourly(this);
            this._clock.clockAnimate();
        }
    }

    //Shared: swallow a pointerdown so the period selector doesn't start a timeline scrub.
    private _stopPropagation = (e: Event): void => { e.stopPropagation(); };

    //Period-selector button delegate: the clicked element carries its mode in data-mode.
    private _onTimelineModeClick = (e: Event): void =>
    {
        const mode = (e.currentTarget as HTMLElement).dataset.mode as TimelineMode | undefined;
        if (mode) { this._setTimelineMode(mode); }
    };

    //Recorder period for the energy change-series, per the active mode (5-min for Now, hourly for a week,
    //daily for month/year), so a long window never pulls 5-min rows. Read by the fetch hosts (pv/grid/battery).
    get _storeFetchPeriod(): StatPeriod { return modeFetchPeriod(this._timelineMode, this.config); }

    //Whether weather (irradiance + cloud) is offered in the active mode. Off for month/year (Open-Meteo only
    //reaches ~16 days), where the focus is energy. Hides those chips + clock-rail buttons + chart targets.
    get _weatherAvailable(): boolean { return TIMELINE_MODES[this._timelineMode].weather; }

    //Chip -> bottom-chart re-targeting. Points the chart at the clicked metric; no-op when already there.
    setChartTarget = (target: ChartTarget): void =>
    {
        if (this._chartTarget !== target)
        {
            this._chartTarget = target;
            this.persistUiState();
        }
    };

    //Chip click delegate: the clicked element carries its metric in data-target. A tap points the chart at the
    //chip AND opens its detail panel; re-tapping the active chip re-points/keeps it open (never toggles shut).
    onChartTargetClick = (e: Event): void =>
    {
        const target = (e.currentTarget as HTMLElement).dataset.target as ChartTarget | undefined;
        if (!target) { return; }
        this.setChartTarget(target);
        //Any chip tap opens (or keeps open) the panel on that chip; closing is done elsewhere, not by re-tapping.
        this._infoPanelOpen = true;
        //Opening the panel on a coarse (month/year) window needs the clock's hourly profile, which the scene does
        //not otherwise fetch: kick it now so the totals match the clock instead of showing empty.
        if (this._infoPanelOpen)
        {
            void refreshClockHourly(this);
        }
    };

    //Last target the home prism was painted for, so updated() can tell a chip CHANGE (play the squash/grow)
    //from a same-chip scrub/tick (instant recolour). Undefined until the first paint (no squash on load).
    private _lastHomeTarget?: ChartTarget;

    //Push the home prism's appearance for the active chip to the renderer (via the engine): the chip's
    //accent colour, plus the per-PV-string production histogram when the solar chip is active (a single
    //producing string falls back to a solid block). `animate` plays the squash/grow on a chip change.
    updateHomeAppearance(animate: boolean): void
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


    //Timeline mode selector: Now / Yesterday / Today / Week / Month / Year. The active mode is highlighted. In
    //day (rings) mode only Yesterday + Today make sense, so the other modes are shown but disabled (greyed).
    //Pointer-down is swallowed so tapping never starts a scrub on the parent band.
    private _renderPeriodSelector(): TemplateResult
    {
        const t = pickTranslations(this.hass?.language);
        const labels: Record<TimelineMode, string> = {
            standard:  t.period?.standard  ?? 'Now',
            yesterday: t.period?.yesterday ?? 'Yesterday',
            today:     t.period?.today     ?? 'Today',
            week:      t.period?.week      ?? 'Week',
            month:     t.period?.month     ?? 'Month',
            year:      t.period?.year      ?? 'Year',
        };
        const dayOnly = this._viewMode === 'day';
        return html`
            <div
                class="tb-period-selector"
                role="group"
                aria-label=${t.period?.rangeLabel ?? 'Time range'}
                @pointerdown=${this._stopPropagation}
            >
                ${TIMELINE_MODE_ORDER.map(m => {
                    const disabled = dayOnly && m !== 'yesterday' && m !== 'today';
                    return html`
                        <button
                            type="button"
                            class="tb-period-seg ${this._timelineMode === m ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}"
                            data-mode=${m}
                            ?disabled=${disabled}
                            @click=${this._onTimelineModeClick}
                        >${labels[m]}</button>
                    `;
                })}
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
        this._pvChangeSeries              = null;
        this._pvChangeFetch.reset();
        this._pvChangeSeriesPerEntity     = new Map();
        this._haSolarForecast             = [];
        this._haSolarForecastLoaded       = false;
        this._haSolarForecastFetching     = false;
        this._haSolarForecastFetchedAt    = 0;
        this._gridImportChangeSeries      = null;
        this._gridExportChangeSeries      = null;
        this._gridImportFetch.reset();
        this._gridExportFetch.reset();
        this._gridGuard                   = createGridGuard();
        this._batterySocHistory           = null;
        this._batteryFetchKey             = '';
        this._batteryChargeChangeSeries   = null;
        this._batteryDischargeChangeSeries = null;
        this._batteryChangeFetch.reset();
        this._deviceChangeSeries          = new Map();
        this._deviceChangeFetch.reset();
        this._irradianceHistory           = null;
        this._irradianceFetchKey          = '';
        //Drop the derived clock + unified store so the next paint rebuilds them from the refetched series rather
        //than the data the user just cleared.
        this._clockHourly                 = null;
        this._clockHourlyKey              = '';
        this._unifiedStore                = null;
        //Drop the module-level caches too, else the next refresh rehydrates from the cross-mount cache with
        //the exact stale entry the user just cleared.
        clearBatteryModuleCaches();
        clearIrradianceModuleCaches();
        clearEnergyStatsCache();
        clearDurable();
        //Engine-side: clears localStorage weather cache, drops the in-memory hourly snapshot, refetches.
        this._engine?.resetDataCache();
        //Also drop the buildings caches (localStorage + shared) and re-fetch, so this one button refreshes
        //everything including the OpenFreeMap footprints.
        this._engine?.forceBuildingsRefetch();
        this.requestUpdate();
    }



    //Masonry sizing. 1 unit = 50 px so 15 ~ 750 px, leaving the basemap ~480 px after the timeline's ~150 px.
    public getCardSize(): number
    {
        return 15;
    }

    //Sections-view sizing. 1 row ~ 56 px, 1 col ~ 30 px (section width 360 px). 12 cols × 8 rows is both the
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

    //"No UI" mode: fade the timeline + controls after UI_AUTOHIDE_MS of no input; any input brings them back and
    //restarts the countdown. Listeners are attached in connectedCallback; a no-op when the mode is off.
    private _onUiActivity = (): void =>
    {
        if (!autoHideUi(this.config)) { return; }
        if (this._uiHidden) { this._uiHidden = false; }
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
            if (this._uiHidden) { this._uiHidden = false; }
            return;
        }
        this._uiHideTimer = window.setTimeout(() => { this._uiHidden = true; }, UI_AUTOHIDE_MS);
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
        //30 s tick: the clock shows HH:MM, the sun moves ~0.13°/refresh (smooth) and the 5-day live cursor
        //advances ~6 px per 30 s. PV/battery live readings update on hass state changes, not this tick, so
        //they stay real-time.
        this._timer = window.setInterval(() =>
        {
            tick(this);
            //Refresh the HA Energy daily-total cache on the same 30 s cadence. One WS round-trip per
            //non-empty entity list; totals move by watt-hours, so 30 s tracks the dashboard tile cheaply.
            refreshHaDailyTotals(this);
            //Keep the dial's "current hour" arrow in step with the clock even on an idle, camera-locked card.
            if (this._viewMode === 'clock' || this._viewMode === 'day') { this._clock.scheduleClockPaint(); }
            //Day rings show live data: re-fetch on the tick so the current period rolls in (keyed to 5 min, so this
            //is a no-op until the window advances).
            if (this._viewMode === 'day') { void refreshDayRing(this); }
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
        liveCards.delete(this);
        window.clearInterval(this._timer);
        this.removeEventListener('pointerdown', this._onUiActivity);
        this.removeEventListener('pointermove', this._onUiActivity);
        this.removeEventListener('wheel', this._onUiActivity);
        this.removeEventListener('touchstart', this._onUiActivity);
        if (this._uiHideTimer !== undefined) { window.clearTimeout(this._uiHideTimer); this._uiHideTimer = undefined; }
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
        if (this._engine) { this._engine.cacheKey = this.effectiveCacheId(); }
        this._engine?.persistCameraPose();
        this.persistUiState();
        this._unregisterCacheId();
        //Stop any in-flight clock grow / slide / exit / dim animation so a removed card doesn't keep an rAF alive.
        this._clock._clockAnimSeq++;
        this._clock._clockDimSeq++;
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
    protected willUpdate(_changedProperties: PropertyValues): void
    {
        super.willUpdate(_changedProperties);
        //Bind the clock's hour-of-day binning to the HOME time zone (see ./card/tz) before any frame projects or
        //the store rebuilds this cycle, so the dial, the "now" marker and the day/night wedges all group by the
        //home's real hour rather than the browser's. Idempotent, so it is cheap to run on every hass update.
        if (_changedProperties.has('hass'))
        {
            setServerTimeZone(this.hass?.config?.time_zone);
        }
    }

    protected updated(_changedProperties: PropertyValues): void
    {
        //"No UI" mode: reflect the faded state onto the host so the CSS fades the timeline + controls.
        this.toggleAttribute('data-ui-hidden', this._uiHidden);

        //Publish the home (consumption) colour as a :host CSS var so every consumption readout reads it. Resolve
        //the configured ui_color token to a hex once per token change (getComputedStyle forces a reflow).
        const homeToken = homeColor(this.config);
        if (homeToken !== this._homeColorToken)
        {
            this._homeColorToken = homeToken;
            this.style.setProperty('--helios-consumption-color', cssHex(this, uiColorVar(homeToken, 'green'), '#4caf50'));
        }

        //Restore the saved view mode + selected chip once coords resolve (idempotent; retries until ready).
        this._restoreUiState();

        //Keep the engine's "clock view" flag in sync so the camera lock (scene-only) is ignored in the clock view
        //(rotation stays free there), while the scene honours it and the day view stays inert top-down regardless.
        if (_changedProperties.has('_viewMode') || _changedProperties.has('_engine'))
        {
            this._engine?.setClockView(this._viewMode === 'clock');
        }

        //Unified data store refresh. Rebuilds when any underlying source changed since the last build, so
        //every consumer reads the latest data without per-consumer invalidation. Cheap when nothing changed
        //(one hash compare), ~50 ms for a full 480 × 7 bucketization + forecast pass on a real refresh.
        this._maybeRebuildUnifiedStore();

        //Drive the home prism's colour + PV-string histogram from the active chip. The squash/grow plays
        //only when the chip CHANGES; a scrub or live tick on the same chip recolours/restacks instantly.
        //Gated on these states so the frequent auto-rotate reprojections (which touch none of them) don't
        //re-resolve the theme colour every frame.
        if (this._viewMode === 'scene'
            && this._engine
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

        //Dial day/night wedges: recompute the per-hour night share when the home or window changes (keyed, so
        //this is cheap). A new _nightFrac repaints via the dial branches below.
        if ((this._viewMode === 'clock' || this._viewMode === 'day')
            && (_changedProperties.has('_viewMode')
                || _changedProperties.has('_timeRange')
                || _changedProperties.has('hass')
                || _changedProperties.has('config')))
        {
            this._clock.refreshNightFrac();
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
                || _changedProperties.has('_clockHourly')
                //An editor save (decimals...) changes config-derived clock visuals: rebuild
                //so the cylinders + home pick up the new colour instead of keeping the cached one.
                || _changedProperties.has('config');
            if (inputsChanged)
            {
                this._clock.rebuildClockData();
            }
            //Reload grow: once the new window's data source is ready (the store for now/week, the hourly
            //profile for month/year), grow the shrunk rings back up, scheduled for the end of the shrink so
            //it always reads down-then-up.
            if (this._clock._clockReloadStart)
            {
                //month/year wait on the hourly profile (nulled up front on a window change, so non-null -> fresh);
                //now/week wait on every configured change-series having refetched for the new window: the store
                //rebuilds eagerly from stale series, so non-null alone would grow the OLD numbers.
                const ready = clockNeedsHourly(this)
                    ? this._clockHourly !== null
                    : this._unifiedStore !== null && this._clock.clockWindowFetched();
                if (ready)
                {
                    const growStart = Math.max(Date.now(), this._clock._clockReloadStart + CLOCK_GROW_MS);
                    this._clockTargets.forEach(t => this._clock._clockGrowStart.set(t, growStart));
                    this._clock._clockReloadStart = 0;
                    this._clock.clockAnimate();
                }
            }
            //Clock dial draws no scene geometry: keep the engine in home-only so it shows just the basemap under
            //the overlay (bars + central column). Re-assert on dial open, filter change, data land, engine respawn.
            if (_changedProperties.has('_viewMode')
                || _changedProperties.has('_clockTargets')
                || _changedProperties.has('_unifiedStore')
                || _changedProperties.has('_engine')
                || _changedProperties.has('config'))
            {
                this._engine?.setHomeOnly(true);
            }
            //Engine (re)spawn (e.g. returning to the tab): replay the bar grow on every present ring, so the dial
            //re-enters with the build animation instead of popping in.
            if (_changedProperties.has('_engine') && this._engine)
            {
                const now = Date.now();
                this._clock._clockGrowStart.clear();
                this._clockTargets.forEach(t => this._clock._clockGrowStart.set(t, now));
                this._clock.clockAnimate();
            }
            if (_changedProperties.has('_clockHoverSlot'))
            {
                this._clock.startClockDim();
            }
            //Central-column hover toggles its highlight: repaint so it brightens/glows (its colour comes from the
            //projected frame, not the engine prism).
            if (_changedProperties.has('_clockHomeHover'))
            {
                this._clock.scheduleClockPaint();
            }
            if (_changedProperties.has('_clockData') || _changedProperties.has('_nightFrac'))
            {
                this._clock.scheduleClockPaint();
            }
        }

        //Day dial: refetch today's hourly profile when the window/data/config changes or the engine respawns;
        //repaint when the profile, the home hover or the night share land. No rail, no hover tooltip here.
        if (this._viewMode === 'day')
        {
            //Entering day mode from a period that has no daily ring (week/month/year/standard) snaps to Today.
            if (_changedProperties.has('_viewMode') && this._timelineMode !== 'yesterday' && this._timelineMode !== 'today')
            {
                this._setTimelineMode('today');
            }
            if (_changedProperties.has('_viewMode')
                || _changedProperties.has('_timelineMode')
                || _changedProperties.has('_timeRange')
                || _changedProperties.has('_energyDefaults')
                || _changedProperties.has('config')
                || _changedProperties.has('_engine'))
            {
                void refreshDayRing(this);
            }
            if (_changedProperties.has('_engine')) { this._engine?.setHomeOnly(true); this._engine?.enterDayView(); }
            //Replay the entry sweep whenever the day view is (re)entered or the day is switched (today <-> yesterday).
            if (_changedProperties.has('_viewMode') || _changedProperties.has('_timelineMode'))
            {
                this._clock.startDayAnim();
            }
            if (_changedProperties.has('_dayRing')
                || _changedProperties.has('_daySelectedKey')
                || _changedProperties.has('_clockHomeHover')
                || _changedProperties.has('_nightFrac'))
            {
                this._clock.scheduleClockPaint();
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
        //Per-device consumption series for the monitoring groups (fire-and-forget; keyed so an unchanged id-set +
        //window is a no-op; clears itself when no device is grouped).
        refreshDeviceConsumption(this);
        //Decoupled hourly clock profile: only does work in clock mode on a long (month/year) window; clears
        //itself otherwise. Keyed so an unchanged window is a no-op.
        void refreshClockHourly(this);
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
            this._cachedIsDarkThemesRef = undefined;
            this.requestUpdate();
        }
    };

    //Bound delegates to the timeline + chart-hover module helpers, which need the host as first arg.
    private _onTimelinePointerDown = (e: PointerEvent): void => onTimelinePointerDown(this, e);
    private _onChartHoverMove      = (e: PointerEvent): void => handleChartHoverMove(this, e);
    private _onChartHoverLeave     = (): void => handleChartHoverLeave(this);


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

    //Current theme polarity, used to seed a new engine at construction.
    public themeIsDark(): boolean
    {
        return this._computeIsDark((this.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes);
    }


    //Render

    protected render(): TemplateResult
    {
        //Precondition for the live card chrome: home coordinates resolved (HA config or card-level lat/lon
        //override). The basemap is keyless CARTO raster tiles, so this is purely "can we project the home".
        const hasHomeCoords = getHomeCoords(this.config, this.hass) !== null;


        //Scene HUD: the home-anchored energy chip cluster (PV / battery / grid / home consumption),
        //their animated leaders, the solar arc depth passes and the sun disc/ray geometry. It resolves its own
        //chip/leader/sun model from the card's scrub/live + layout + sun @state and returns the HUD fragment,
        //also exposing the two directional leader colours (read back for the detail-panel accent below).
        const hud = this._hud.render();

        //Detect the active HA theme. Authoritative: hass.themes.darkMode (HA flips it on every theme swap).
        //A getComputedStyle luminance probe is the fallback for older HA builds that lack it.
        const themesObj = (this.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes;
        const isDark = this._computeIsDark(themesObj);
        const cardThemeClass = isDark ? 'theme-dark' : 'theme-light';

        //camera-locked swaps the grab cursor for the default arrow when drag-rotate is inert, so the open-hand cursor
        //isn't misleading: the day view is always top-down (inert), the scene honours the lock, and the clock is
        //always free to rotate (the lock is scene-only). Re-evaluated every render.
        const cameraLocked = this._viewMode === 'day' || (this._viewMode === 'scene' && this._isCameraLocked());
        //Detail panel shows only in scene mode; its accent (from the active chip) drives both the panel border and
        //the little "i" badge on the open chip, so it lives as a card-level class + CSS var.
        const infoOpen = this._infoPanelOpen && this._viewMode === 'scene';
        //Detail-panel accent = the ACTIVE chip's live colour. The directional chips (grid, battery) flip their
        //tint with the instantaneous flow, so reuse those same leader colours rather than chartAccentColor (which
        //is the window-dominant direction); the non-directional targets already agree with chartAccentColor.
        const activeChipColor =
            this._chartTarget === 'grid' ? this._hud._gridLeaderColor
            : (this._chartTarget === 'battery' || this._chartTarget === 'battery-soc') ? this._hud._batteryLeaderColor
            : chartAccentColor(this);
        const cardClasses = [
            cardThemeClass,
            cameraLocked      ? 'camera-locked'  : '',
            this.preview      ? 'helios-edit'    : '',
            this._viewMode === 'clock' ? 'mode-clock' : '',
            this._viewMode === 'day' ? 'mode-day' : '',
        ].filter(Boolean).join(' ');
        //Expose the active chip's colour always (the timeline border tracks it for feedback); the detail-panel
        //accent only when the panel is open.
        const cardStyle = `--active-chip-color:${activeChipColor}${infoOpen ? `;--detail-accent:${activeChipColor}` : ''}`;

        return html`
            <ha-card class=${cardClasses} style=${cardStyle}>

                <div
                    id="map-container"
                    @pointermove=${this._clock.onClockHover}
                    @pointerleave=${this._clock.onClockHoverEnd}
                    @pointerdown=${this._clock.onClockTapStart}
                    @pointerup=${this._clock.onClockTapEnd}
                ></div>

                ${hasHomeCoords && (this._viewMode === 'clock' || this._viewMode === 'day') ? html`
                    <div class="clock-overlay">
                        <svg class="clock-svg" xmlns="http://www.w3.org/2000/svg"></svg>
                        ${Array.from({ length: 24 }, (_unused, h) => html`
                            <div class="clock-hour-label">${this._clock.formatClockHour(h)}</div>
                        `)}
                        ${this._clock.compassLabels().map(o => html`<div class="clock-compass-label" style="color:${o.c}">${o.l}</div>`)}
                        ${this._clockHoverSlot !== null
                            ? this._clock.renderClockTooltip(this._clockHoverSlot)
                            : (this._clockHomeHover
                                ? this._clock.renderClockHomeTooltip()
                                : nothing)}
                    </div>
                ` : nothing}

                ${hasHomeCoords && this._timeRange && this._viewMode === 'scene' ? html`
                    <div
                        class="time-bar"
                        @pointerdown=${this._onTimelinePointerDown}
                    >
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
                                @pointermove=${this._onChartHoverMove}
                                @pointerleave=${this._onChartHoverLeave}
                            >
                                ${keyed(`${this._chartTarget}|${this._timelineMode}`, renderBottomChart(this))}
                                ${(this._timelineMode === 'standard' || this._timelineMode === 'today' || this._timelineMode === 'yesterday' || this._timelineMode === 'week')
                                    ? renderTimelineNightZones(this) : nothing}
                                ${renderTimelineFutureMask(this)}
                                ${renderTimelineTicks(this)}
                            </div>
                            ${renderTimelineDayLabels(this)}
                        </div>
                    </div>
                ` : nothing}

                <!--  Period-mode band: a separate strip BELOW the timeline (own card styling, same width,
                      radius and themed border), holding the Now / 1 week / 1 month / 1 year selector. Stays
                      visible in clock mode too so the window can be changed from there.  -->
                ${hasHomeCoords ? html`
                    <div class="tb-band">
                        ${this._renderPeriodSelector()}
                    </div>
                ` : nothing}

<!--  Top-left button rail: the scene / clock / day view toggle. Glyphs only, no labels: tooltips are
                      useless on touch. (The camera-lock chip lives top-right and only in scene mode.)  -->
                ${hasHomeCoords ? (() => {
                    const sceneOn       = this._viewMode === 'scene';
                    const clockOn       = this._viewMode === 'clock';
                    const dayOn         = this._viewMode === 'day';
                    return html`
                        <div class="overlay-top-left">
                            <button
                                type="button"
                                class="overlay-btn ${sceneOn ? 'is-on' : ''}"
                                aria-pressed=${sceneOn ? 'true' : 'false'}
                                aria-label="Scene"
                                data-view="scene"
                                @click=${this._clock.onViewModeClick}
                            >
                                <ha-icon icon="mdi:weather-sunny"></ha-icon>
                            </button>
                            <button
                                type="button"
                                class="overlay-btn ${clockOn ? 'is-on' : ''}"
                                aria-pressed=${clockOn ? 'true' : 'false'}
                                aria-label="Clock"
                                data-view="clock"
                                @click=${this._clock.onViewModeClick}
                            >
                                <ha-icon icon="mdi:chart-bar"></ha-icon>
                            </button>
                            <button
                                type="button"
                                class="overlay-btn ${dayOn ? 'is-on' : ''}"
                                aria-pressed=${dayOn ? 'true' : 'false'}
                                aria-label="Daily rings"
                                data-view="day"
                                @click=${this._clock.onViewModeClick}
                            >
                                <ha-icon icon="mdi:chart-donut"></ha-icon>
                            </button>
                        </div>
                    `;
                })() : nothing}


                <!--  Right-hand metric rail (clock mode): one button per configured metric, stacked with no
                      gaps. Multi-select FILTERS: each active metric adds a concentric ring; the active ones
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
                                        aria-pressed=${on ? 'true' : 'false'}
                                        aria-label=${lbl}
                                        data-target=${t}
                                        @click=${this._clock.onClockTargetToggleClick}
                                    >
                                        <ha-icon icon=${meta.icon}></ha-icon>
                                    </button>
                                `;
                            })}
                        </div>
                    `;
                })() : nothing}

                ${hud}

                <!--  Per-chip detail panel: tapping a chip aggregates its metric over the window in a compact
                      top-right readout (icons only, values in the card's unit). Scene mode only.  -->
                ${infoOpen && hasHomeCoords ? renderDetailPanel(this) : nothing}

                <!--  Day mode: selecting a ring opens the same top-right panel with that ring's name + day total
                      (and, for a device, its solar / grid / battery split).  -->
                ${this._viewMode === 'day' && this._daySelectedKey
                    ? this._clock.renderDaySelectionPanel(this._daySelectedKey)
                    : nothing}

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
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object')
            {
                if (parsed.viewMode === 'scene' || parsed.viewMode === 'clock' || parsed.viewMode === 'day')
                {
                    this._viewMode = parsed.viewMode;
                }
                const valid: ChartTarget[] = ['production', 'consumption', 'grid', 'battery', 'battery-soc', 'irradiance', ...GROUP_TARGETS];
                if (typeof parsed.chartTarget === 'string' && valid.includes(parsed.chartTarget as ChartTarget))
                {
                    this._chartTarget = parsed.chartTarget as ChartTarget;
                }
                if (typeof parsed.timelineMode === 'string' && parsed.timelineMode in TIMELINE_MODES)
                {
                    this._timelineMode     = parsed.timelineMode as TimelineMode;
                    this._periodPastDays   = modePastDays(this._timelineMode);
                    this._periodFutureDays = modeFutureDays(this._timelineMode);
                }
                if (typeof parsed.daySelectedKey === 'string') { this._daySelectedKey = parsed.daySelectedKey; }
                //Clock filter set: keep order, drop dupes/unknowns. The timeline follows the first.
                if (Array.isArray(parsed.clockTargets))
                {
                    const seen = new Set<ChartTarget>();
                    const list: ChartTarget[] = [];
                    for (const target of parsed.clockTargets)
                    {
                        if (typeof target === 'string' && valid.includes(target as ChartTarget) && !seen.has(target as ChartTarget))
                        {
                            seen.add(target as ChartTarget);
                            list.push(target as ChartTarget);
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
                viewMode:      this._viewMode,
                chartTarget:   this._chartTarget,
                clockTargets:  this._clockTargets,
                timelineMode:  this._timelineMode,
                daySelectedKey: this._daySelectedKey,
            }));
        }
        catch (_)
        {
            //Silent-degrade; only cross-reload persistence is lost.
        }
    }

    //Thin bridge to the ClockController's paint entry point, kept so init.ts's per-frame `host.paintClock?.()`
    //callback reaches the extracted dial subsystem.
    public paintClock(): void { this._clock.paintClock(); }

    static styles = [heliosCardStyles, heliosTimelineStyles, heliosCardEnergyClockCss];
}
