import type { PropertyValues, TemplateResult } from 'lit';
import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HeliosCard } from './helios-card';
import type { HeliosEngine } from './scene/helios-engine';
import { type HeliosConfig, cacheId } from './core/config/helios-config';
import { heliosCardStyles } from './css/helios-card-scene-css';
import { setServerTimeZone } from './core/time/timezone';
import { isDarkFromCss } from './core/format/format';
import { refreshPvLive } from './data/sources/pv';
import { refreshBatteryLive } from './data/sources/battery';
import { refreshGridLive } from './data/sources/grid';
import {
    subscribeEnergyPrefs,
    unsubscribeEnergyPrefs,
    EMPTY_ENERGY_DEFAULTS,
    type EnergyDefaults,
} from './data/sources/energy-prefs';
import type { ChartSeries } from './charts/charts';
import { refreshHud, type ArcSegment, type SunScene, type LabelLayout } from './hud/hud';
import { getHomeCoords, initEngine, initVisibilityObserver, computeConfigSig, publishConsumptionColor, type InitHost } from './card/init';
import { liveCards } from './card/diagnostics';
import { SceneHudController } from './hud/scene-hud-controller';


//Helios Mini: a second Lovelace card that renders the SAME live 2.5D scene as the main Helios card (tilted
//basemap, buildings, sun arc, cast shadows, day/night ground, camera drag + idle auto-rotate, home hover glow)
//plus the live energy chips (PV, battery, grid, home consumption and the configured monitoring groups). It is
//LIVE-ONLY and NON-INTERACTIVE: no timeline, no scrub, no period selector, no chip selection, no detail panel.
//It reuses the shared scene pieces (SceneHudController, the engine bootstrap in card/init.ts, the scene CSS)
//and reads live values straight from hass.states through the live-only source helpers, never fetching history.


@customElement('helios-mini-card')
export class HeliosMiniCard extends LitElement implements InitHost
{
    @property({ attribute: false }) public hass!: any;
    @property({ attribute: false }) public config!: HeliosConfig;
    //Set by HA on the editor's live-preview card; forwarded to the engine so intro animations are suppressed there.
    @property({ attribute: false }) public preview = false;

    //Display-only: the shared HUD drops the button role, tab focus, click wiring and active-glow when this is false.
    readonly _interactive = false;

    //Scene HUD subsystem (chip cluster + leaders + solar arc depth passes + sun disc/ray). It reads this host's
    //live values + layout + sun state through its back-reference; the scrub branches never run here because
    //_isLiveMode stays true and _selectedTime stays null.
    readonly _hud = new SceneHudController(this as unknown as HeliosCard);

    @state() _engine?: HeliosEngine;
    _now              = new Date();
    @state() _cloudCover = -1;
    @state() _labelLayout: LabelLayout | null = null;
    @state() _sunScene:    SunScene | null    = null;

    //Live chip values, read from hass.states by the live-only source helpers. No history / change-series fetch.
    @state() _pvCurrent: number | null = null;
    @state() _pvUnit        = '';
    @state() _batterySoc:   number | null = null;
    @state() _batteryPower: number | null = null;
    @state() _batteryPowerUnit = '';
    @state() _gridImportValue: number | null = null;
    @state() _gridImportUnit        = '';
    @state() _gridExportValue: number | null = null;
    @state() _gridExportUnit        = '';

    //HA Energy dashboard snapshot; the sole source of energy wiring (solar / grid / battery / device groups).
    @state() _energyDefaults: EnergyDefaults = EMPTY_ENERGY_DEFAULTS;
    _energyDefaultsLoaded = false;
    _energyPrefsUnsub?: () => void;

    //Home-hover glow state, toggled from the home hitbox.
    @state() _homeHover = false;

    //Live scene state permanently: this card only ever shows "right now", so the HUD's scrub branches stay off.
    readonly _selectedTime: Date | null = null;
    _isLiveMode = true;
    _timeRange: { start: Date; end: Date } | null = null;
    _chartSeries: ChartSeries | null = null;

    //Fixed rolling window (Standard: 2 days each side), seeding the engine's weather fetch + sun arc span.
    readonly _periodPastDays   = 2;
    readonly _periodFutureDays = 2;

    //Inert defaults for the fields the HUD only touches in scrub mode (never reached here).
    readonly _unifiedStore = null;
    readonly _pvChangeSeries = null;
    readonly _gridImportChangeSeries = null;
    readonly _gridExportChangeSeries = null;
    readonly _batteryChargeChangeSeries = null;
    readonly _batteryDischargeChangeSeries = null;
    readonly _batterySocHistory = null;
    readonly _deviceChangeSeries = new Map<string, never>();
    readonly _chartTarget = 'production';

    //Weather (irradiance + cloud) is always offered: this card is a live "now" view with no coarse modes.
    readonly _weatherAvailable = true;

    //Per-card unique id namespacing SVG <defs> ids so several cards don't clash on gradient/filter refs.
    _instanceId = `h${Math.floor(Math.random() * 1e9).toString(36)}`;

    //Arc-segment scratch buffers, reused in place by the HUD each render (below-horizon behind the cluster,
    //above-horizon split near / far by camera bearing).
    _arcBackBuf:      ArcSegment[] = [];
    _arcFrontBuf:     ArcSegment[] = [];
    _arcFrontNearBuf: ArcSegment[] = [];

    private _timer?: number;
    private _engineTeardownTimer?: number;
    _lastHomeKey   = '';
    _lastConfigSig = '';
    _initInflight  = false;
    _visibilityObserver?: IntersectionObserver;
    _onVisibilityChange?: () => void;

    //Last resolved home-colour token, re-derived only when it changes (getComputedStyle forces a reflow).
    //Read + written by publishConsumptionColor (card/init.ts), so not TS-private.
    _homeColorToken = '';

    //Refresh-chain gate: rerun the live reads only when hass, config or the energy defaults change identity, so
    //the frequent auto-rotate reprojections don't re-run the chain every frame.
    private _lastRefreshHassRef:           unknown = undefined;
    private _lastRefreshConfigSig:         string | undefined = undefined;
    private _lastRefreshEnergyDefaultsRef: unknown = undefined;


    //HA card lifecycle

    public setConfig(config: HeliosConfig): void
    {
        if (!config)
        {
            throw new Error('Invalid HELIOS configuration');
        }
        this.config = { ...config };
    }

    //Reuse the existing Helios editor: Mini shares the exact config schema, so the group config copies across.
    static getConfigElement(): HTMLElement
    {
        return document.createElement('helios-card-editor');
    }

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
                const lat = entityState?.attributes?.latitude;
                const lon = entityState?.attributes?.longitude;
                if (typeof lat === 'number' && Number.isFinite(lat)
                 && typeof lon === 'number' && Number.isFinite(lon))
                {
                    return { 'home-latitude': lat, 'home-longitude': lon };
                }
            }
        }
        return {};
    }

    //Scene-only card (no timeline band): shorter than the main card. 1 unit ~ 50 px, so ~10 units clears the
    //480 px minimum the basemap needs.
    public getCardSize(): number
    {
        return 10;
    }

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
            rows:        6,
            columns:     12,
            min_rows:    4,
            max_rows:    24,
            min_columns: 12,
            max_columns: 12,
        };
    }

    //Called by the setHeliosLocation / clearHeliosLocation debug helpers: drop the cached home key so the next
    //updated() re-inits the engine against the new coordinates.
    public invalidateLocation(): void
    {
        this._lastHomeKey = '';
        this.requestUpdate();
    }

    //Wipe the engine-side cached weather + buildings and refetch. Used by the shared page-wide reset bus.
    public resetDataCache(): void
    {
        this._engine?.resetDataCache();
        this._engine?.forceBuildingsRefetch();
        this.requestUpdate();
    }

    //Per-card storage discriminator for the engine's camera-pose key.
    public effectiveCacheId(): string
    {
        return cacheId(this.config);
    }

    //Current theme polarity: authoritative hass.themes.darkMode, with a getComputedStyle luminance fallback.
    public themeIsDark(): boolean
    {
        const themes = (this.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes;
        if (themes && typeof themes.darkMode === 'boolean')
        {
            return themes.darkMode;
        }
        return isDarkFromCss(this);
    }

    public connectedCallback(): void
    {
        super.connectedCallback();
        liveCards.add(this);
        //Quick reconnect (HA edit-mode thrash): cancel the deferred engine teardown so the live engine is kept.
        if (this._engineTeardownTimer !== undefined)
        {
            window.clearTimeout(this._engineTeardownTimer);
            this._engineTeardownTimer = undefined;
        }
        this._tick();
        //30 s tick: the sun moves smoothly with wall-clock time. Live chip readings update on hass state changes.
        this._timer = window.setInterval(() => { this._tick(); }, 30_000);
        initVisibilityObserver(this);
        subscribeEnergyPrefs(this);
    }

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        liveCards.delete(this);
        window.clearInterval(this._timer);
        this._visibilityObserver?.disconnect();
        this._visibilityObserver = undefined;
        if (this._onVisibilityChange)
        {
            document.removeEventListener('visibilitychange', this._onVisibilityChange);
            this._onVisibilityChange = undefined;
        }
        unsubscribeEnergyPrefs(this);
        if (this._engine) { this._engine.cacheKey = this.effectiveCacheId(); }
        this._engine?.persistCameraPose();
        //Defer engine teardown so a quick edit-mode reconnect (cancelled above) keeps the live engine.
        if (this._engine !== undefined && this._engineTeardownTimer === undefined)
        {
            this._engineTeardownTimer = window.setTimeout(() =>
            {
                this._engineTeardownTimer = undefined;
                this._engine?.cleanup();
                this._engine = undefined;
            }, 400);
        }
        this._initInflight = false;
    }

    protected willUpdate(_changedProperties: PropertyValues): void
    {
        super.willUpdate(_changedProperties);
        //Bind hour-of-day binning to the HOME time zone before any frame projects, so the sun groups by the
        //home's real hour rather than the browser's. Idempotent, cheap to run on every hass update.
        if (_changedProperties.has('hass'))
        {
            setServerTimeZone(this.hass?.config?.time_zone);
        }
    }

    protected updated(_changedProperties: PropertyValues): void
    {
        //Publish the home (consumption) colour as a :host CSS var so the home pill reads it.
        publishConsumptionColor(this);

        //Lazy Energy WS subscribe: HA can attach hass after connectedCallback. Idempotent (checks the unsub handle).
        if (this.hass && !this._energyPrefsUnsub)
        {
            subscribeEnergyPrefs(this);
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
        const homeKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        const identityChanged = homeKey !== this._lastHomeKey;

        //Create the engine once, then update it in place. init.ts wires the weather + map-transform callbacks
        //that drive refreshHud() (label layout + sun scene) and set _cloudCover / _timeRange / _isLiveMode.
        if (!this._engine)
        {
            if (!this.isConnected || this._initInflight)
            {
                return;
            }
            this._lastHomeKey   = homeKey;
            this._lastConfigSig = computeConfigSig(this.config);
            initEngine(this);
            return;
        }

        if (identityChanged)
        {
            this._lastHomeKey = homeKey;
            this._engine.setHome(lat, lon);
        }

        const sig = computeConfigSig(this.config);
        if (sig !== this._lastConfigSig)
        {
            this._lastConfigSig = sig;
            this._engine.updateConfig(this.config);
        }

        //Live-read gate: the source helpers are pure functions of hass.states + config + energy defaults. Lit
        //calls updated() on every @state mutation (every HUD reprojection), so this skips the reads when none
        //of those moved. Config is compared by content signature, not object reference (the dashboard hands a
        //fresh-but-equivalent config every push).
        if (this.hass === this._lastRefreshHassRef
            && sig === this._lastRefreshConfigSig
            && this._energyDefaults === this._lastRefreshEnergyDefaultsRef)
        {
            return;
        }
        this._lastRefreshHassRef           = this.hass;
        this._lastRefreshConfigSig         = sig;
        this._lastRefreshEnergyDefaultsRef = this._energyDefaults;

        //Group chip values are read live from hass.states inside the HUD (groupLivePowerW), so they need no
        //refresh here; only the source families keep a stored live value.
        refreshPvLive(this);
        refreshBatteryLive(this);
        refreshGridLive(this);
    }

    //Clock heartbeat: advance the wall-clock minute and re-project the sun (which moves with time). Bails when
    //the minute has not changed so an unchanged HH:MM never forces a full re-render. On a day rollover the
    //engine's timeline window shifts, so refresh it and its hourly weather series.
    private _tick(): void
    {
        const next = new Date();
        const prev = this._now;
        if (prev
            && next.getMinutes()  === prev.getMinutes()
            && next.getHours()    === prev.getHours()
            && next.getDate()     === prev.getDate()
            && next.getMonth()    === prev.getMonth()
            && next.getFullYear() === prev.getFullYear())
        {
            return;
        }
        const dayRolledOver = !prev
            || next.getDate()     !== prev.getDate()
            || next.getMonth()    !== prev.getMonth()
            || next.getFullYear() !== prev.getFullYear();
        this._now = next;
        if (dayRolledOver && this._engine)
        {
            const range = this._engine.getTimelineRange();
            if (range) { this._timeRange = range; }
            this._chartSeries = this._engine.getTimelineSeries() ?? this._chartSeries;
        }
        refreshHud(this);
    }

    //Home-hitbox hover handlers: toggle the sun-coloured glow halo so the focal building reads as present.
    onHomeEnter = (): void => { this._homeHover = true; };
    onHomeLeave = (): void => { this._homeHover = false; };


    //Render

    protected render(): TemplateResult
    {
        //Scene HUD: the home-anchored energy chip cluster (PV / battery / grid / groups / home consumption),
        //their leaders, the solar arc depth passes and the sun disc/ray. Display-only here (no chip selection).
        const hud = this._hud.render();

        const isDark = this.themeIsDark();
        const cardThemeClass = isDark ? 'theme-dark' : 'theme-light';

        return html`
            <ha-card class=${cardThemeClass}>
                <div id="map-container"></div>
                ${hud}
            </ha-card>
        `;
    }

    static styles = [heliosCardStyles];
}


declare global
{
    interface HTMLElementTagNameMap
    {
        'helios-mini-card': HeliosMiniCard;
    }
}
