import type { TemplateResult } from 'lit';
import { html, svg, nothing } from 'lit';
import { guard } from 'lit/directives/guard.js';
import type { HeliosCard } from '../helios-card';
import { valueDecimals, powerUnit, irradianceUnit, batterySign, maxExpectedPowerW, monitoringGroupColor, monitoringGroupIcon, chipVisible, groupChipVisible, showSunTimes, sunChipMode, batteryChipMode, moonDisplay } from '../core/config/helios-config';
import { moonCrescentPath } from '../scene/moon-crescent';
import { chipSlotColor, chipSlotIcon } from '../core/config/chip-appearance';
import { pickTranslations } from '../core/i18n';
import { darkenHex, ENERGY_COLOR, cloudCoverIcon, formatHaTime, formatIrradiance, batteryLevelIcon } from '../core/format/format';
import { mixHex } from '../core/render-kit/hex';
import { ARRAY_MARKER_COLOR } from '../core/config/constants';
import { currentPvRate, pvRateAtTime, pvNormalizeToWatts, formatPvValue, resolvePvLiveEntity } from '../data/sources/pv';
import { batterySampleAtTime, formatBatteryPower, resolveBatteryEntities } from '../data/sources/battery';
import { buildArcSegments, flowDuration, type LabelLayout, type ArcSegment, type SunScene, type MoonScene } from './hud';
import { nudgeToHomePill } from './hud-geometry';
import { clipSegment, clipPolygon, cardClipRect, pointOutside, pointsAttr, type ClipRect } from '../core/render-kit/geometry';
import { formatGridValue } from '../data/sources/grid';
import { activeGroups, groupLivePowerW, groupPowerWAt } from '../data/sources/device-consumption';
import { groupTarget } from '../charts/charts';
import { wattsAtFromChangeSeries } from '../data/sources/energy-stats';
import { valueAt } from '../data/unifiedStore';
import { getHomeCoords } from '../card/init';


//Sun-position readout: compass point + azimuth + elevation, e.g. "SW 228°, 12°". The compass point makes
//the azimuth self-evident, so the lone second figure reads as elevation. Points are localised (N first,
//clockwise), and azimuth is normalised so any degree maps cleanly onto them.
function formatSunPosition(azimuth: number, altitude: number, compassStr: string): string
{
    const pts   = compassStr.split(',');
    const index = ((Math.round(azimuth / (360 / pts.length)) % pts.length) + pts.length) % pts.length;
    return `${pts[index]} ${Math.round(azimuth)}°, ${Math.round(altitude)}°`;
}


//Depth-modulation bounds for the solar overlay: each pair is the FAR (back of the loop) and NEAR
//(front) end, lerped per-element by the engine's nearness factor in [0..1].
const OUTLINE_FAR  = 1.5;
const OUTLINE_NEAR = 5.0;
const SEGMENT_FAR  = 1.0;
const SEGMENT_NEAR = 4.0;
//Sun-disc radii in px. The inner irradiance fill needs ~9 px diameter at apex to read as an annulus, not a dot.
const SUN_R_FAR    = 10.0;
const SUN_R_NEAR   = 20.0;
const SUN_RIM_WIDTH = 1.5;
//Moon: a pale, fixed colour (no time-of-day ramp, no irradiance fill), and a disc a touch smaller than the sun's so
//the two never read as the same body. Overridable via --helios-moon-color in the card CSS.
const MOON_COLOR    = '#dfe6ee';
//The unlit side: a solid dark slate rather than a faint tint, so the disc reads as one body (its own arc passes
//behind it instead of showing through the dark half as a stray straight edge).
const MOON_DARK     = '#3a4250';
const MOON_R_FAR    = 8.0;
const MOON_R_NEAR   = 16.0;
//Fraction of the disc radius the crescent is inset by, so the lit shape sits inside the rim rather than on it.
const MOON_CRESCENT_INSET = 0.86;
//Home pill is a horizontal stadium (like the other chips), not a circle. Half-extents of its outline;
//leaders dock against this stadium so they all meet the same focal energy node.
const HOME_PILL_HALF_WIDTH_PX  = 38;
const HOME_PILL_HALF_HEIGHT_PX = 14;
//Px a chip leader's start point is nudged horizontally toward the home before the L-path turns.
const CHIP_HOME_NUDGE_PX       = 22;
//Faint tint inside the rim so the "empty sun" at sunrise/sunset still reads as a disc, not a coloured spot.
const SUN_FILL_OPACITY_BG = 0.20;
//Below-horizon segments are dots whose diameter IS the stroke width, scaled down vs daytime so the
//night portion of the loop reads as a quieter trace without competing with the lit half.
const NIGHT_STROKE_FACTOR = 0.5;


//Scene HUD subsystem: the home-anchored energy chip cluster (PV / battery SoC + power / grid / custom /
//home consumption), their animated leader paths, the solar arc depth-split passes, the sun disc/halo/ray
//geometry and the sunrise/sunset markers. Every card member it reads
//(hass, config, the scrub/live state, the label layout, the sun scene, the arc scratch buffers, ...) is
//reached through `this.host`. The reactive @state it renders from stays on the card.
export class SceneHudController
{
    public constructor(private readonly host: HeliosCard)
    {}

    //Directional leader colours for the ACTIVE flow, resolved every render and read back by the card for the
    //detail-panel accent (the grid + battery chips flip tint with the instantaneous flow, so the panel border
    //must reuse the live leader colour rather than the window-dominant chartAccentColor).
    public _gridLeaderColor    = 'var(--energy-grid-consumption-color, #488fc2)';
    public _batteryLeaderColor = 'var(--energy-battery-out-color, #4db6ac)';

    //Arc-segment + ridge-polygon memo, both keyed on the sunScene object reference: refreshHud's sunSceneEq()
    //already keeps that reference stable across renders when nothing about the sun/ridge geometry changed, so a
    //plain identity compare here skips the buildArcSegments() rebuild (an arcColor() computation per segment)
    //and the ridge points map+join on every hass tick, the same way the flow beads below are guard()ed against
    //rebuilding on inputs that haven't moved.
    private _arcSegmentsSunScene: SunScene | null = null;
    private _arcSegmentsCache: ArcSegment[] = [];
    private _ridgeLineSunScene: SunScene | null = null;
    private _ridgeLineCache = '';

    private _buildArcSegmentsCached(sunScene: SunScene, sunColor: string): ArcSegment[]
    {
        if (this._arcSegmentsSunScene !== sunScene)
        {
            this._arcSegmentsSunScene = sunScene;
            this._arcSegmentsCache    = buildArcSegments(sunScene.arc, sunColor);
        }
        return this._arcSegmentsCache;
    }

    private _moonSegmentsScene: MoonScene | null = null;
    private _moonSegmentsCache: ArcSegment[] = [];

    //Moon arc segments, identity-cached on the scene like the sun's. Built inline rather than through
    //buildArcSegments: that one paints the sun's time-of-day colour ramp (grey under the horizon, amber high),
    //while the moon keeps one fixed pale colour whatever its altitude.
    private _buildMoonArcSegmentsCached(moonScene: MoonScene, color: string): ArcSegment[]
    {
        if (this._moonSegmentsScene !== moonScene)
        {
            this._moonSegmentsScene = moonScene;
            const out: ArcSegment[] = [];
            const arc = moonScene.arc;
            for (let i = 0; i < arc.length - 1; i++)
            {
                const p = arc[i]; const n = arc[i + 1];
                out.push({
                    x1: p.x, y1: p.y, x2: n.x, y2: n.y,
                    color,
                    nearness:     0.5 * (p.nearness + n.nearness),
                    belowHorizon: p.belowHorizon || n.belowHorizon,
                });
            }
            this._moonSegmentsCache = out;
        }
        return this._moonSegmentsCache;
    }

    private _buildRidgeLineCached(sunScene: SunScene): string
    {
        if (this._ridgeLineSunScene !== sunScene)
        {
            this._ridgeLineSunScene = sunScene;
            this._ridgeLineCache    = sunScene.ridge.length >= 3
                ? sunScene.ridge.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
                : '';
        }
        return this._ridgeLineCache;
    }

    //Land a chip's leader endpoint on the home pill's stadium outline so every leader docks against the same
    //focal energy node.
    private _nudgeToHomePill(
        chipX: number, chipY: number,
        homeX: number, homeY: number,
    ): { x: number; y: number }
    {
        return nudgeToHomePill(
            chipX, chipY, homeX, homeY,
            HOME_PILL_HALF_WIDTH_PX,
            HOME_PILL_HALF_HEIGHT_PX,
        );
    }

    //Build a rounded L from a chip to the home pill: horizontal leg toward the home's vertical axis,
    //fillet, vertical leg to the pill border. chipX/chipY is the chip centre; the leader starts at the
    //chip edge nudged CHIP_HOME_NUDGE_PX toward the home.
    private _buildLPathToHome(layout: LabelLayout | null, chipX: number, chipY: number): string
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
        const sx = chipX + dirH * CHIP_HOME_NUDGE_PX;
        const sy = chipY;
        //Land the vertical leg ~13 px off centre so two leaders on the same row don't collide on the
        //pill's axis. That x sits over the stadium's flat edge, so the leg docks at the half-height.
        const HOME_PILL_QUARTER_X = 13;
        const ex = homeX - dirH * HOME_PILL_QUARTER_X;
        const ey = homeY - dirV * HOME_PILL_HALF_HEIGHT_PX;
        //Fillet radius, clamped to fit inside both legs of the L.
        const FILLET_R = 12;
        const r = Math.min(FILLET_R, Math.abs(ex - sx) / 2, Math.abs(ey - sy) / 2);
        const preX  = ex - dirH * r;
        const postY = sy + dirV * r;
        return `M ${sx.toFixed(1)},${sy.toFixed(1)} L ${preX.toFixed(1)},${sy.toFixed(1)} Q ${ex.toFixed(1)},${sy.toFixed(1)} ${ex.toFixed(1)},${postY.toFixed(1)} L ${ex.toFixed(1)},${ey.toFixed(1)}`;
    }

    //Rounded L between two arbitrary points. verticalFirst=true draws the vertical leg first, then the
    //horizontal into the end (the four-group fan-out: down from the home pill's bottom edge, then across to the
    //chip). Same fillet as _buildLPathToHome.
    private _buildLPath(
        sx: number, sy: number, ex: number, ey: number, verticalFirst: boolean
    ): string
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
    }

    //Straight vertical lead from the home pill's bottom edge down to a chip centred on the home's x-axis (chip
    //x == home x). The bead runs home -> chip; the segment under the chip is hidden by its opaque background.
    private _buildVerticalLeadFromHome(layout: LabelLayout, x: number, chipY: number): string
    {
        const homeBottomY = layout.home.y + HOME_PILL_HALF_HEIGHT_PX;
        return `M ${x.toFixed(1)},${homeBottomY.toFixed(1)} L ${x.toFixed(1)},${chipY.toFixed(1)}`;
    }

    //One sunrise/sunset marker: a glyph + local time pinned just OUTSIDE the arc at the horizon crossing
    //(offset radially out from the home so it clears the arc line). Null crossing (polar day/night) -> nothing.
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
        const t    = formatHaTime(this.host.hass, cross.time);
        return html`
            <div
                class="sun-cross-marker"
                style="transform:translate(${lx.toFixed(1)}px,${ly.toFixed(1)}px) translate(-50%,-50%); --sun-cross-color:${color}"
            >
                <ha-icon icon=${icon}></ha-icon>
                <span>${t}</span>
            </div>
        `;
    }

    //Resolve the whole chip/leader/arc/sun model for this frame and return the HUD template fragment (the chip
    //divs + the leader / arc / solar SVG layers + the home pill). Called once per card render.
    public render(): TemplateResult
    {
        //Precondition for the live card chrome: home coordinates resolved (HA config or card-level lat/lon
        //override); nothing else in this render can project without them.
        const hasHomeCoords = getHomeCoords(this.host.config, this.host.hass) !== null;

        //Shared scrub state, computed once and reused by every family below (PV, battery/grid, groups) instead
        //of each recomputing the same live/scrub check and scrub-time-in-the-future check off the same host
        //fields. Past scrub: a family reflects its actual reading at that instant. Future scrub has no data
        //yet for most families, so they hide rather than show a stale/fake number.
        const scrubbing   = !this.host._isLiveMode && this.host._selectedTime !== null;
        const scrubFuture = scrubbing
            && this.host._selectedTime!.getTime() > Date.now() + 60_000;

        //Chip interactivity: the card wires each chip as a button that re-points the bottom chart and glows when
        //active. A display-only host can set `_interactive = false` to drop the button role, tab focus, click
        //wiring and active-glow; unset reads as interactive.
        const interactive = (this.host as unknown as { _interactive?: boolean })._interactive !== false;

        //Always-visible chip anchors come pre-projected from engine.projectHomeLabelLayout(). Suppressed until
        //both the layout (map ready) and a data value exist.
        const layout         = this.host._labelLayout;

        //Per-chip visibility from the "Entity display" config (each defaults visible). Home visibility (the
        //neutral-ring swap) is handled separately at the home pill.
        const cfg = this.host.config;
        //Shared flow-animation reference: every power flow (PV, grid, battery, device groups) is paced against
        //this single figure, so the largest live flow always reads as the fastest. Configurable per install.
        const flowRefW = maxExpectedPowerW(cfg);
        //Day curve up: the chips that have nothing to do with the curve stand down, so it is read against the house
        //rather than through a cluster of unrelated numbers. The chip whose metric raised the curve STAYS - the
        //toggle has to remain under the finger that pressed it - and so does the home, the anchor of the whole
        //scene. The curve follows the active target, so "the chip that raised it" is simply the active one.
        const curveOn = this.host._dayCurveOpen;
        const active  = this.host._chartTarget;
        //Down when the curve is up unless this is the metric on show.
        const keeps = (t: string): boolean => !curveOn || active === t;
        const showChipIrradiance = keeps('irradiance') && chipVisible(cfg, 'chip-irradiance-visible');
        const showChipProduction = keeps('production') && chipVisible(cfg, 'chip-production-visible');
        const showChipGrid       = keeps('grid')       && chipVisible(cfg, 'chip-grid-visible');
        const showChipBattery    = keeps('battery')    && chipVisible(cfg, 'chip-battery-visible');
        //Irradiance chip colour (the W/m² readout above the sun); overridable, resolved through the central table.
        const irradChipColor     = chipSlotColor(this.host, cfg, 'irradiance');
        //Home chip hidden: the central pill collapses to a hollow ring sized to the same docking outline, so the
        //leads keep their normal shapes and dock on it exactly as they did on the pill, with the home visible
        //through the transparent centre.
        const homeHidden         = !chipVisible(cfg, 'chip-home-visible');
        //Home anchor: the hollow ring stays while a chip that DOCKS A LEADER on it is visible (production, grid,
        //battery, device groups). The sun/irradiance chip sits by the sun disc with no leader to the home, so it
        //does NOT hold the ring: a sun-position card (home hidden, only the sun chip) drops the ring and leaves
        //just the sun + location, e.g. a shutter/climate page keyed on the sun. Config-driven so it stays
        //stable across scrubbing.
        const anyHomeLeaderChipVisible = showChipProduction || showChipGrid || showChipBattery
            || activeGroups(this.host.config, this.host._energyDefaults).some(g => groupChipVisible(cfg, g) && keeps(groupTarget(g)));
        const showHomeElement    = !homeHidden || anyHomeLeaderChipVisible;

        //PV production chip above the home, tied to it by an animated leader. Only renders when the HA
        //Energy dashboard exposes a solar source and the live read is a finite number.
        const pvEntityId   = resolvePvLiveEntity(this.host._energyDefaults);
        //ENERGY_COLOR.pv resolves the HA Energy solar token; inline SVG attrs that need a literal hex
        //(not a CSS var) read it directly so colours stay in sync with the CSS rules using the same token.
        //The user's per-chip colour overrides it when set (resolved through the central chip-appearance table).
        const pvColor      = chipSlotColor(this.host, cfg, 'production');

        //The chip shows measured instantaneous production at the active instant: the power sensors' summed
        //state live, the meters' recorder change series at a scrubbed instant. No sensor, no chip.
        const pvRate = (pvEntityId !== '' && layout !== null)
            ? (scrubbing
                ? pvRateAtTime(this.host, this.host._selectedTime!)
                : (this.host._pvCurrent !== null ? currentPvRate(this.host) : null))
            : null;

        //Predicted PV at a future scrub instant, from the unified store's corrected forecast (the exact
        //series the dotted timeline curve draws), so the chip never disagrees with its line. Null (hidden)
        //when the store isn't built or the instant has no forecast.
        let pvPredictedRate: { value: number; unit: string } | null = null;
        if (scrubFuture && pvEntityId !== '' && layout !== null && this.host._unifiedStore)
        {
            const w = valueAt(this.host._unifiedStore.forecast, this.host._unifiedStore, this.host._selectedTime!.getTime());
            if (w !== null && w > 0)
            {
                pvPredictedRate = { value: w, unit: 'W' };
            }
        }

        const isPvPredicted = scrubFuture && pvPredictedRate !== null;
        const pvActiveRate  = isPvPredicted ? pvPredictedRate : pvRate;

        const showPvLabel = hasHomeCoords
            && showChipProduction
            && layout !== null
            && pvEntityId !== ''
            && pvActiveRate !== null
            && (!scrubFuture || isPvPredicted)
            //Scrub to an era with no production (no panels yet, or a flat 0) hides the chip AND its leader
            //together, so a stale 0 never leaves the leader dangling to the home.
            && (!scrubbing || pvActiveRate.value > 0);

        //User-configured decimal precision, applied to every chip readout (kW/kWh).
        const valueDec = valueDecimals(this.host.config);
        const powerU   = powerUnit(this.host.config);
        const irradU   = irradianceUnit(this.host.config);
        const pvDisplayValue = showPvLabel
            ? (isPvPredicted ? '~ ' : '') + formatPvValue(this.host.hass, pvActiveRate!.value, pvActiveRate!.unit, valueDec, powerU)
            : '';

        //PV -> home animated leader (dashed line + arrow, PV colour). Flow speed normalised against the shared
        //flow reference. Idle (no flow/arrow) when current production is <= 0.
        const pvWattsNow = (pvRate !== null)
            ? pvNormalizeToWatts(pvRate.value, pvRate.unit)
            : 0;
        const pvPeakRefW  = flowRefW;
        const pvFlowDuration = flowDuration(pvWattsNow, pvPeakRefW, 0.5);
        const pvIdle         = !(pvWattsNow > 0);
        //Battery: SoC + power resolved separately (each eligible from its own HA Energy source: stat_soc for the
        //SoC, stat_rate or stat_energy_from/to without a power_config block for the power), then fused into one
        //chip below. Scrub mirrors PV: live reads hass.states, past-scrub reads the history series, future-scrub
        //hides it.
        const batteryEntities    = resolveBatteryEntities(this.host._energyDefaults);
        const hasAnyBankSoc      = batteryEntities.socEntity   !== null;
        const hasAnyBankPower    = batteryEntities.powerEntity !== null;

        //Grid IN/OUT past-scrub: average watts at the scrub instant from the recorder change series, so the
        //chip shows what flowed then. Skip in future scrub (no data) and live mode (live values already set).
        const gridScrubTimeMs = scrubbing && !scrubFuture
            ? this.host._selectedTime!.getTime()
            : null;
        const rawImport = gridScrubTimeMs !== null
            ? wattsAtFromChangeSeries(this.host._gridImportChangeSeries, gridScrubTimeMs)
            : this.host._gridImportValue;
        const rawExport = gridScrubTimeMs !== null
            ? wattsAtFromChangeSeries(this.host._gridExportChangeSeries, gridScrubTimeMs)
            : this.host._gridExportValue;
        const gridImportDisplayWatts = rawImport === null ? null : Math.max(0, rawImport);
        const gridExportDisplayWatts = rawExport === null ? null : Math.max(0, rawExport);
        const gridImportDisplayUnit = gridScrubTimeMs !== null ? 'W' : this.host._gridImportUnit;
        const gridExportDisplayUnit = gridScrubTimeMs !== null ? 'W' : this.host._gridExportUnit;

        //Active SoC/power values for this render: historical samples in scrub mode, live state otherwise.
        const activeBatterySoc: number | null = scrubbing
            ? batterySampleAtTime(this.host._batterySocHistory, this.host._selectedTime!)
            : this.host._batterySoc;
        //Battery power scrub: net the charge/discharge change series (charge - discharge) for a structural
        //sign. Live mode reads the live signed value.
        let activeBatteryPower: number | null;
        if (scrubbing)
        {
            const tMs = this.host._selectedTime!.getTime();
            const chargeW    = wattsAtFromChangeSeries(this.host._batteryChargeChangeSeries, tMs);
            const dischargeW = wattsAtFromChangeSeries(this.host._batteryDischargeChangeSeries, tMs);
            activeBatteryPower = (chargeW === null && dischargeW === null)
                ? null
                : Math.max(0, chargeW ?? 0) - Math.max(0, dischargeW ?? 0);
        }
        else
        {
            activeBatteryPower = this.host._batteryPower;
        }
        //Power unit is watts on both paths (change series resolves to W, live read normalises to W), so the
        //chip formats consistently regardless of mode.
        const activeBatteryUnit = scrubbing ? 'W' : this.host._batteryPowerUnit;

        const showSocChip = (hasHomeCoords && layout !== null)
            && !scrubFuture
            && hasAnyBankSoc
            && activeBatterySoc !== null;
        const showPowerChip = (hasHomeCoords && layout !== null)
            && !scrubFuture
            && hasAnyBankPower
            && activeBatteryPower !== null;

        //Fused battery chip: one chip carries both readings. The SoC drives the fill icon (built below, once the
        //charge direction is known) and, on a SoC-only install, doubles as the chip value; the mean SoC text is
        //the fallback value. The per-bank SoC breakdown lives in the battery chart, not the chip.
        const showBatteryChip = (showSocChip || showPowerChip) && showChipBattery;
        const batterySocText = showSocChip ? `${Math.round(activeBatterySoc!)} %` : '';
        //Chip uses the HA energy dashboard sign convention (discharge positive, charge negative).
        //activeBatteryPower is the physical charge-positive net, so it's negated for display to stay
        //coherent with the dashboard. Colour + leader direction below keep the physical sign.
        const batteryPowerText = showPowerChip
            ? formatBatteryPower(this.host.hass, -activeBatteryPower!, activeBatteryUnit, valueDec, powerU, batterySign(this.host.config))
            : '';

        //Home consumption chip:
        //  used_total = from_grid + solar + from_battery - to_grid - to_battery
        //over the card's scrub-aware per-family values, so the chip follows the scrub.
        //Families contribute only when they have a reading; nothing wired -> chip hides. Clamped at zero
        //(a small negative is meter skew).
        const usagePvW = (!scrubFuture && pvActiveRate !== null)
            ? pvNormalizeToWatts(pvActiveRate.value, pvActiveRate.unit)
            : null;
        const usageGridW = (gridImportDisplayWatts !== null || gridExportDisplayWatts !== null)
            ? (gridImportDisplayWatts ?? 0) - (gridExportDisplayWatts ?? 0)
            : null;
        //activeBatteryPower is charge-positive, so it SUBTRACTS: charging is consumption that never reaches
        //the home, discharging (negative) adds supply.
        const usageBatteryW = showPowerChip ? activeBatteryPower! : null;
        //Live balance is measured or absent: in live mode, every CONFIGURED family must have a real live
        //reading (a wired family with no live power sensor would silently unbalance the sum, so the chip
        //hides and the editor explains). Scrub mode keeps the bucket-domain balance: all terms share the
        //meters' cadence there, the same bookkeeping the HA Energy dashboard does.
        const d = this.host._energyDefaults;
        const homeLiveComplete = scrubbing || (
            (d.solarStatEnergyFroms.length === 0 || usagePvW !== null)
            && ((d.gridStatEnergyFroms.length === 0 && d.gridStatEnergyTos.length === 0) || usageGridW !== null)
            && ((d.batteryStatEnergyFroms.length === 0 && d.batteryStatEnergyTos.length === 0) || usageBatteryW !== null));
        const homeUsageWatts = !homeLiveComplete
            ? null
            : ((usagePvW === null && usageGridW === null && usageBatteryW === null)
                ? null
                : Math.max(0, (usagePvW ?? 0) + (usageGridW ?? 0) - (usageBatteryW ?? 0)));
        const showHomeUsageChip = hasHomeCoords
            && layout !== null
            && !scrubFuture
            && homeUsageWatts !== null;
        const homeUsageText = showHomeUsageChip
            ? formatGridValue(this.host.hass, homeUsageWatts, 'W', valueDec, powerU)
            : '';

        //Charge/discharge direction (PHYSICAL sign, positive = charging) drives the battery <-> home bead
        //direction and the lead colour, at a speed proportional to |P| saturating at the shared flow reference,
        //independent of the chip's HA-sign flip above.
        const batteryCharging = showPowerChip && (activeBatteryPower! > 0);
        const batteryChargeColor    = chipSlotColor(this.host, cfg, 'batteryCharge');
        const batteryDischargeColor = chipSlotColor(this.host, cfg, 'batteryDischarge');
        const batteryLeaderColor = batteryCharging ? batteryChargeColor : batteryDischargeColor;
        this._batteryLeaderColor = batteryLeaderColor;
        const batteryWattsForFlow = showPowerChip
            ? Math.abs(pvNormalizeToWatts(activeBatteryPower!, activeBatteryUnit))
            : 0;
        //Idle: power within sensor-noise margin of zero (+/-5 W). The leader is still drawn (keeps the
        //spatial relationship) but the dash flow is frozen and the arrow hidden, since any motion would
        //be misleading.
        const batteryIdle = showPowerChip && batteryWattsForFlow < 5;
        const batteryFlowDuration = flowDuration(batteryWattsForFlow, flowRefW);

        //PV_HALF_HEIGHT_PX places the top of a leader's vertical leg flush against PV's bottom edge so the
        //line emerges from the chip, not inside it.
        const PV_HALF_HEIGHT_PX    = 11;
        //Half-width of the PV chip, used by the solar-ray target snap. Sized to the narrowest realistic
        //text ("0 W") so the snap lands at-or-before the chip border even on short text and the ray never
        //draws over the chip body.
        const PV_HALF_WIDTH_PX  = 28;

        //Single fused battery chip anchor.
        const batteryChipX = layout?.batteryLabel.x ?? 0;
        const batteryChipY = layout?.batteryLabel.y ?? 0;
        //Fill icon driven by the SoC (charging variant while charging); a power-only install has no level, so
        //batteryLevelIcon falls back to a neutral battery. The chip value is the power, or the SoC percentage
        //on a SoC-only install.
        const batteryChipIcon = chipSlotIcon(cfg, batteryCharging ? 'batteryCharge' : 'batteryDischarge', batteryLevelIcon(showSocChip ? activeBatterySoc : null, batteryCharging));
        //Readout follows the configured mode (power by default, or SoC), each falling back to the other when its
        //own value is unavailable, so a power-only or SoC-only install still shows something.
        const batteryChipText = batteryChipMode(cfg) === 'soc'
            ? (showSocChip ? batterySocText : batteryPowerText)
            : (showPowerChip ? batteryPowerText : batterySocText);
        //Single battery <-> home lead: the battery is just a node on the home hub, like every other chip. The bead
        //runs battery -> home while discharging (it feeds the house) and home -> battery while charging; idle leaves
        //a static connector. We deliberately draw NO PV -> battery lead: whether a charge comes from solar or the
        //grid is not measured (an AC-coupled or grid-charged battery would make that source wrong), and inventing
        //that split is the one thing the card never does. The lead's magnitude is still the real battery power.
        const batteryHomeLeaderPath = (layout && showBatteryChip)
            ? this._buildLPathToHome(layout, batteryChipX, batteryChipY)
            : '';
        const gridLeaderPath       = this._buildLPathToHome(layout, layout?.gridLabel.x ?? 0, layout?.gridLabel.y ?? 0);

        //Monitoring-group chips: DYNAMIC placement by the number of active groups (each = >= 1 visible device), so
        //the cluster stays balanced instead of pinning every group to a fixed corner:
        //  1 group  -> centred below the home on the lower row, vertical lead;
        //  2 groups -> left + right, grid/battery-style horizontal lead off each chip's mid-height;
        //  3 groups -> two on top (left/right) + one centred on the lower row, vertical lead;
        //  4 groups -> four-corner fan-out.
        //Live value = the sum of the group's device stat_rate; colour = the group's graph colour; a number badge
        //carries the group id. Every lead's bead runs home -> chip (power leaving to the group's devices).
        const HOME_PILL_WIDTH_PX  = 96;
        const GROUP_CHIP_HALF_W   = 48;
        //Bead cadence: fastest at the shared flow reference, dropped below ~5 W (recorder noise), like the grid/battery beads.
        const GROUP_BEAD_CAP_W    = flowRefW;
        const GROUP_BEAD_IDLE_W   = 5;
        //Four-corner fan-out (4 groups only): each lead docks the home pill's bottom edge at 32/44/56/68 % of its
        //width, symmetric around the centre and mirrored left/right, so the four leads fan out without crossing.
        const GROUP_ATTACH_STEP   = 0.12;
        const GROUP_ATTACH_FRAC   = [
            0.5 - 1.5 * GROUP_ATTACH_STEP,   //slot 0 top-left  (outer left)
            0.5 - 0.5 * GROUP_ATTACH_STEP,   //slot 1 bottom-left (inner left)
            0.5 + 1.5 * GROUP_ATTACH_STEP,   //slot 2 top-right (outer right)
            0.5 + 0.5 * GROUP_ATTACH_STEP,   //slot 3 bottom-right (inner right)
        ];
        //Geometry primitives read back from the projected layout so the dynamic slots track the home + kiosk
        //scale: the two side columns (grid/battery x), the home's x, and the two group rows below the home.
        const groupLeftX   = layout?.gridLabel.x       ?? 0;
        const groupRightX  = layout?.batteryLabel.x    ?? 0;
        const groupCenterX = layout?.home.x            ?? 0;
        const groupRow1Y   = layout?.groupLabels[0]?.y ?? 0;
        const groupRow2Y   = layout?.groupLabels[1]?.y ?? 0;
        //Scrub-aware group value: at a past instant read each device's change series, else the live stat_rate sum.
        const groupScrubMs = scrubbing ? this.host._selectedTime!.getTime() : null;
        //Group consumption has no forecast, so scrubbing into the future hides the group chips (and their leaders)
        //entirely, the same way the PV chip drops out of a future scrub with no prediction (scrubFuture above).
        const activeGroupList = (layout && !scrubFuture)
            ? activeGroups(this.host.config, this.host._energyDefaults).filter(g => groupChipVisible(cfg, g) && keeps(groupTarget(g)))
            : [];
        const groupCount      = activeGroupList.length;
        const groupChips = layout
            ? activeGroupList.map((g, i) =>
            {
                //Slot + lead per (index within the active set, total count). `reverse` flips the bead so it runs
                //home -> chip even on the horizontal leads (which are geometrically built chip -> home).
                let anchor:   { x: number; y: number };
                let leadPath: string;
                let reverse = false;
                if (groupCount === 1)
                {
                    //Single group sits on the lower row, at the same height as the centred chip of the 3-group case.
                    anchor   = { x: groupCenterX, y: groupRow2Y };
                    leadPath = this._buildVerticalLeadFromHome(layout, groupCenterX, anchor.y);
                }
                else if (groupCount === 4)
                {
                    //Four-corner arrangement: slots [top-left, bottom-left, top-right, bottom-right].
                    const isLeft  = i < 2;
                    anchor        = { x: isLeft ? groupLeftX : groupRightX, y: i % 2 === 0 ? groupRow1Y : groupRow2Y };
                    const innerX  = isLeft ? anchor.x + GROUP_CHIP_HALF_W : anchor.x - GROUP_CHIP_HALF_W;
                    const attachX = layout.home.x + (GROUP_ATTACH_FRAC[i] - 0.5) * HOME_PILL_WIDTH_PX;
                    const attachY = layout.home.y + HOME_PILL_HALF_HEIGHT_PX;
                    leadPath      = this._buildLPath(attachX, attachY, innerX, anchor.y, true);
                }
                else if (i < 2)
                {
                    //2 or 3 groups: the first two sit left/right on the top row, with a grid/battery-style
                    //horizontal lead leaving the chip's mid-height and docking on the home pill.
                    anchor   = { x: i === 0 ? groupLeftX : groupRightX, y: groupRow1Y };
                    leadPath = this._buildLPathToHome(layout, anchor.x, anchor.y);
                    reverse  = true;
                }
                else
                {
                    //3 groups: the third is centred below (lower row) with a vertical lead.
                    anchor   = { x: groupCenterX, y: groupRow2Y };
                    leadPath = this._buildVerticalLeadFromHome(layout, groupCenterX, anchor.y);
                }
                const watts   = groupScrubMs !== null ? groupPowerWAt(this.host, g, groupScrubMs) : groupLivePowerW(this.host, g);
                const color   = monitoringGroupColor(this.host.config, g);
                //Group pastille glyph: the configured icon, else the group number (so groups stay distinguishable).
                const icon    = monitoringGroupIcon(this.host.config, g);
                //Bead flows home -> chip (power leaving to the group's devices), cadence proportional to the live
                //draw; dropped below the idle floor so a group at rest shows a static leader with no motion.
                const magW    = watts === null ? 0 : Math.abs(watts);
                const beadDur = magW < GROUP_BEAD_IDLE_W ? null : flowDuration(magW, GROUP_BEAD_CAP_W);
                return { g, anchor, leadPath, reverse, watts, color, icon, beadDur };
            })
            : [];

        //Grid beads use the shared flow curve (flowDuration): fastest at the flow reference, easing to a crawl
        //toward zero, exactly like the PV, battery and device flows. Below ~5 W the chip is idle (recorder
        //noise) and the bead is dropped. Import and export share the same reference, so a larger flow always
        //reads as faster than a smaller one, whichever direction it runs.
        const GRID_BEAD_CAP_W  = flowRefW;
        const GRID_BEAD_IDLE_W = 5;
        //Scrub-aware like the chip values above, so the bead's cadence always matches the instant the
        //chip displays (never today's live pace on yesterday's scrub).
        const importWattsAbs = gridImportDisplayWatts !== null
            ? Math.abs(pvNormalizeToWatts(gridImportDisplayWatts, gridImportDisplayUnit))
            : 0;
        const exportWattsAbs = gridExportDisplayWatts !== null
            ? Math.abs(pvNormalizeToWatts(gridExportDisplayWatts, gridExportDisplayUnit))
            : 0;
        const gridImportBeadDur = importWattsAbs < GRID_BEAD_IDLE_W ? null
            : flowDuration(importWattsAbs, GRID_BEAD_CAP_W);
        const gridExportBeadDur = exportWattsAbs < GRID_BEAD_IDLE_W ? null
            : flowDuration(exportWattsAbs, GRID_BEAD_CAP_W);
        //Single grid chip shows the ACTIVE flow only: the larger display value wins and drives colour,
        //value, icon and bead direction. Scrub-aware watts feed the choice so it tracks the timeline. Ties
        //(including idle 0/0) fall to import, a neutral consumption-blue resting state.
        const gridImporting    = (gridImportDisplayWatts ?? 0) >= (gridExportDisplayWatts ?? 0);
        const gridImportColor  = chipSlotColor(this.host, cfg, 'gridImport');
        const gridExportColor  = chipSlotColor(this.host, cfg, 'gridExport');
        const gridLeaderColor  = gridImporting ? gridImportColor : gridExportColor;
        this._gridLeaderColor = gridLeaderColor;
        //Bead cadence from the active side; null (no bead) when it's below the idle threshold, so an idle
        //grid shows the chip + a static leader with no misleading motion.
        const gridBeadDur      = gridImporting ? gridImportBeadDur : gridExportBeadDur;

        //Solar-arc overlay: sun trajectory, current position and incidence ray to the home, all
        //pre-projected to screen space via projectSunScene(). Hidden until the engine is ready.
        const sunScene  = this.host._sunScene;
        const showSun   = hasHomeCoords && sunScene !== null && sunScene.arc.length >= 2;

        //Clip rectangle for the HUD overlays, in the same card-px space they project into (the camera's viewport).
        //Off-card ink on old iOS oversizes each composited SVG layer past the compositor cap and drops its lower
        //half; the arc loops well past the card and the sun can sit far off it below the horizon.
        const cam       = this.host._engine?._renderer?.camera;
        const clipRect: ClipRect | null = cam?.hasViewport ? cardClipRect(cam.width, cam.height) : null;

        //Fixed colour design system. The sun colour paints the arc, the disc rim and the irradiance fill.
        const sunColor      = ENERGY_COLOR.sun(this.host);
        const sunRimColor   = darkenHex(sunColor, 0.20);
        const arcSegments   = showSun ? this._buildArcSegmentsCached(sunScene!, sunColor) : [];
        //Z-order split: below-horizon (dotted) segments render BEHIND the home chip cluster, above-horizon
        //in front so the live sun dominates. Single-pass split into reused scratch buffers (no filter()
        //allocations per cycle).
        const arcSegmentsBack     = this.host._arcBackBuf;
        const arcSegmentsFrontFar  = this.host._arcFrontBuf;
        const arcSegmentsFrontNear = this.host._arcFrontNearBuf;
        arcSegmentsBack.length      = 0;
        arcSegmentsFrontFar.length  = 0;
        arcSegmentsFrontNear.length = 0;
        //Above-horizon segments get a 2nd split by camera nearness: the half closest to the eye renders
        //ABOVE the home chips (over leaders + pill), the half arching away renders BEHIND. Threshold is the
        //nearness midpoint.
        for (const s of arcSegments)
        {
            //Trim each segment to the card box. The segments are fresh this frame, so writing the
            //clipped endpoints back is safe; a segment that misses the card entirely is dropped.
            if (clipRect)
            {
                const c = clipSegment([s.x1, s.y1], [s.x2, s.y2], clipRect);
                if (!c)
                {
                    continue;
                }
                s.x1 = c[0][0]; s.y1 = c[0][1];
                s.x2 = c[1][0]; s.y2 = c[1][1];
            }
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
        //With Helios-Forecast lines in the scene, each array carries its own ray to the sun (below) and the single
        //sun-to-production ray steps aside.
        const arrayScene = this.host._arrayScene;
        const hasArrays  = arrayScene !== null && arrayScene.tiles.length > 0;
        const showRay = showSun && sunScene!.sun.altitude > 0 && !hasArrays;

        //Live irradiance for the W/m² label above the sun disc, also driving the inner-disc fill ratio: at
        //STC (1000 W/m²) the fill reaches the rim, at zero it vanishes. The sqrt mapping linearises AREA
        //perception (area prop to r²) so a 50% reading covers half the rim's area, not its radius.
        const sunWm2          = sunScene?.sun.irradiance ?? 0;
        const sunIrradText    = formatIrradiance(this.host.hass, sunWm2, valueDec, irradU);
        const sunFillRatio    = Math.sqrt(Math.max(0, Math.min(1, sunWm2 / 1000)));
        //What the sun chip reads out: irradiance (default), sun position (azimuth + elevation), or both.
        const chipMode        = sunChipMode(cfg);
        const sunAlt          = sunScene?.sun.altitude ?? 0;
        const sunAz           = sunScene?.sun.azimuth ?? 0;
        const sunPositionText = formatSunPosition(sunAz, sunAlt, pickTranslations(this.host.hass?.language).compass);
        //Irradiance (and its cloud chip) are weather; hidden when weather is off (month/year). Sun position
        //is pure geometry and needs none, so position mode stays visible without it. The sun disc/arc (also
        //pure geometry) stays regardless.
        const showSunLabel    = showSun && showChipIrradiance && sunAlt > 0
            && (chipMode === 'position' || this.host._weatherAvailable);
        const sunChipText     = chipMode === 'position' ? sunPositionText : sunIrradText;
        //Position mode drops the cloud-cover glyph (irrelevant to geometry) for a plain sun.
        const sunChipIconFallback = chipMode === 'position'
            ? 'mdi:white-balance-sunny'
            : (this.host._cloudCover >= 0 ? cloudCoverIcon(this.host._cloudCover) : 'mdi:white-balance-sunny');
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
        //Only when the chip is actually shown: scrubbing into the future hides it, so the ray falls back to the
        //home instead of pointing at the vanished chip's slot.
        if (layout && sunScene && showPvLabel)
        {
            //Same stadium-nearest-point math as the chip leaders, roles swapped: stadium = the PV chip, external
            //point = the sun.
            const target = nudgeToHomePill(
                sunScene.sun.x, sunScene.sun.y,
                layout.pvLabel.x, layout.pvLabel.y,
                PV_HALF_WIDTH_PX, PV_HALF_HEIGHT_PX,
            );
            sunRayTargetX = target.x;
            sunRayTargetY = target.y;
        }

        //Clip the incidence ray to the card box; the line and the bead's motion path both read these
        //trimmed endpoints so they stay in lockstep. A ray that misses the card entirely is dropped.
        let rayX1 = sunScene?.sun.x ?? 0;
        let rayY1 = sunScene?.sun.y ?? 0;
        let rayX2 = sunRayTargetX;
        let rayY2 = sunRayTargetY;
        let rayVisible = showRay;
        if (clipRect && showRay)
        {
            const c = clipSegment([rayX1, rayY1], [rayX2, rayY2], clipRect);
            if (c)
            {
                rayX1 = c[0][0]; rayY1 = c[0][1];
                rayX2 = c[1][0]; rayY2 = c[1][1];
            }
            else
            {
                rayVisible = false;
            }
        }
        //Cull the sun disc + halo when the sun sits far off the card (near or below the horizon), so its layer never
        //balloons past the card box. 80 px clears the largest halo (disc r <= 22, halo = 3r).
        const sunDiscVisible = clipRect === null
            || !pointOutside(
                [sunScene?.sun.x ?? 0, sunScene?.sun.y ?? 0],
                { minX: clipRect.minX - 80, minY: clipRect.minY - 80, maxX: clipRect.maxX + 80, maxY: clipRect.maxY + 80 },
            );

        //Terrain-horizon ridge: a discrete relief silhouette as a CLOSED ring around the home (empty on flat
        //terrain). Drawn as a polygon so it encircles the house; the sun crosses the crest at its azimuth.
        const ridgePts = sunScene?.ridge ?? [];
        const showRidge = ridgePts.length >= 3;
        const ridgeLine = sunScene ? this._buildRidgeLineCached(sunScene) : '';

        return html`
                <!--  Terrain-horizon ridge: distant relief silhouette encircling the home, behind the arc + chips.  -->
                ${showRidge ? html`
                    <svg class="solar-svg horizon-ridge-svg">
                        <polygon class="horizon-ridge-line-outline" points=${ridgeLine}></polygon>
                        <polygon class="horizon-ridge-line" points=${ridgeLine}></polygon>
                    </svg>
                ` : nothing}

                <!--  Solar arc, BACK pass: only the dotted below-horizon segments (the sun's path under the
                      celestial sphere), so the home + chips read in front of the night half of the loop.
                      Above-horizon segments, ray, disc and W/m² readout are in the FRONT pass below.  -->
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
                                stroke-width="${(OUTLINE_FAR
                                    + (OUTLINE_NEAR - OUTLINE_FAR) * s.nearness)
                                    * NIGHT_STROKE_FACTOR}"
                            ></line>
                        `)}
                        ${arcSegmentsBack.map(s => svg`
                            <line
                                class="solar-arc-segment solar-arc-night"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke="${s.color}"
                                stroke-width="${(SEGMENT_FAR
                                    + (SEGMENT_NEAR - SEGMENT_FAR) * s.nearness)
                                    * NIGHT_STROKE_FACTOR}"
                            ></line>
                        `)}
                    </svg>
                ` : nothing}


                ${showPvLabel ? (() =>
    {
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
                            x1=${pvX1}
                            y1=${pvY1}
                            x2=${pvHomeEnd.x}
                            y2=${pvHomeEnd.y}
                        ></line>
                        ${!pvIdle ? guard([pvColor, pvFlowDuration, pvX1, pvY1, pvHomeEnd.x, pvHomeEnd.y], () => svg`
                            <!--  Filled disc riding the leader from the PV chip to the home, speed
                                  proportional to live production. No rotate="auto": a disc has no orientation.
                                  guard()ed on its own inputs, same reason as every flow bead below: this whole
                                  template runs on every hass tick, most of which touch none of these values, and
                                  rewriting a live SMIL <animateMotion>'s attributes re-arms its clock even when
                                  the rewritten value is identical - real, sustained main-thread cost on a card
                                  with any flow running, independent of scene size.  -->
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
                        `) : nothing}
                    </svg>`;
    })() : nothing}

                ${showPvLabel ? html`
                    <div
                        class="pv-pct-label ${isPvPredicted ? 'is-predicted' : ''} ${interactive && this.host._chartTarget === 'production' ? 'is-chart-active' : ''} ${this.host._dayCurveOpen ? 'is-curve-on' : ''}"
                        style="transform:translate(${layout!.pvLabel.x}px,${layout!.pvLabel.y}px) translate(-50%,-50%); --pv-leader-color:${pvColor}; --chip-color:${pvColor}"
                        role=${interactive ? 'button' : nothing}
                        tabindex=${interactive ? '0' : nothing}
                        data-target="production"
                        @click=${interactive ? this.host.onChartTargetClick : undefined}
                    >
                        <ha-icon icon=${chipSlotIcon(cfg, 'production', 'mdi:solar-power')}></ha-icon>
                        <span>${pvDisplayValue}</span>
                    </div>
                ` : nothing}

                ${showBatteryChip ? html`
                    <svg class="battery-leader-svg">
                        <!--  Single battery <-> home lead. A static connector when idle; a bead runs battery -> home
                              while discharging (feeding the house) and home -> battery while charging. No source is
                              claimed on the charge side, so the card never asserts where the charge came from.  -->
                        ${batteryHomeLeaderPath ? svg`
                            <path
                                class="battery-leader-line"
                                style="--battery-leader-color:${batteryLeaderColor}"
                                d="${batteryHomeLeaderPath}"
                            ></path>
                            ${(showPowerChip && !batteryIdle) ? guard([batteryLeaderColor, batteryFlowDuration, batteryHomeLeaderPath, batteryCharging], () => svg`
                                <circle
                                    class="battery-leader-bead"
                                    r="3"
                                    style="fill:${batteryLeaderColor}"
                                >
                                    <animateMotion
                                        dur="${batteryFlowDuration}s"
                                        repeatCount="indefinite"
                                        path="${batteryHomeLeaderPath}"
                                        keyPoints=${batteryCharging ? '1;0' : nothing}
                                        keyTimes=${batteryCharging ? '0;1' : nothing}
                                    ></animateMotion>
                                </circle>
                            `) : nothing}
                        ` : nothing}
                    </svg>
                    <div
                        class="battery-pct-label ${interactive && this.host._chartTarget === 'battery' ? 'is-chart-active' : ''} ${curveOn && active === 'battery' ? 'is-curve-on' : ''}"
                        style="transform:translate(${batteryChipX}px,${batteryChipY}px) translate(-50%,-50%); --battery-leader-color:${batteryLeaderColor}"
                        role=${interactive ? 'button' : nothing}
                        tabindex=${interactive ? '0' : nothing}
                        data-target="battery"
                        @click=${interactive ? this.host.onChartTargetClick : undefined}
                    >
                        <ha-icon icon=${batteryChipIcon}></ha-icon>
                        <span>${batteryChipText}</span>
                    </div>
                ` : nothing}

                <!--  Grid chip on the LEFT of the home: one pill showing the ACTIVE flow only. Importing reads
                      consumption blue with a grid -> home bead; exporting flips to return purple with a
                      home -> grid bead. The dominant side wins when both are live.  -->
                ${hasHomeCoords && showChipGrid && layout !== null && (gridImportDisplayWatts !== null || gridExportDisplayWatts !== null) && !scrubFuture ? html`
                    <svg class="grid-leader-svg">
                        <path class="grid-leader-line" style="stroke:${gridLeaderColor}" d=${gridLeaderPath} />
                        <!--  Single bead on the active flow. Import
                              flows grid -> home (default traversal),
                              export flows home -> grid (keyPoints 1;0
                              reverses it). Dropped when the active side
                              is idle, no misleading motion.           -->
                        ${gridBeadDur !== null ? guard([gridLeaderColor, gridBeadDur, gridLeaderPath, gridImporting], () => gridImporting ? svg`
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
                        class="grid-label ${interactive && this.host._chartTarget === 'grid' ? 'is-chart-active' : ''} ${curveOn && active === 'grid' ? 'is-curve-on' : ''}"
                        style="transform:translate(${layout!.gridLabel.x}px,${layout!.gridLabel.y}px) translate(-50%,-50%); --grid-leader-color:${gridLeaderColor}"
                        role=${interactive ? 'button' : nothing}
                        tabindex=${interactive ? '0' : nothing}
                        data-target="grid"
                        @click=${interactive ? this.host.onChartTargetClick : undefined}
                    >
                        <ha-icon icon=${gridImporting ? chipSlotIcon(cfg, 'gridImport') : chipSlotIcon(cfg, 'gridExport')}></ha-icon>
                        <span>${formatGridValue(this.host.hass, gridImporting ? (gridImportDisplayWatts ?? 0) : (gridExportDisplayWatts ?? 0), gridImporting ? gridImportDisplayUnit : gridExportDisplayUnit, valueDec, powerU)}</span>
                    </div>
                ` : nothing}

                <!--  Monitoring-group chips (dynamic placement by active-group count). Each shows the group's live
                      total with a number badge; clicking one points the chart at that group's per-device curves.
                      The bead runs home -> chip; horizontal leads are reversed (keyPoints) to keep that direction.  -->
                ${hasHomeCoords && layout !== null ? groupChips.map((gc) =>
    {
        //Narrowed to a local so guard()'s callback keeps TS's `!== null` narrowing (a property
        //access like gc.beadDur loses it across the closure boundary).
        const beadDur = gc.beadDur;
        return html`
                    <svg class="group-leader-svg">
                        <path class="group-leader-line" style="stroke:${gc.color}" d=${gc.leadPath} />
                        ${beadDur !== null ? guard([gc.color, beadDur, gc.leadPath, gc.reverse], () => svg`
                            <circle class="group-leader-bead" r="3" style="fill:${gc.color}">
                                <animateMotion dur="${beadDur.toFixed(2)}s" repeatCount="indefinite"
                                               keyPoints=${gc.reverse ? '1;0' : nothing} keyTimes=${gc.reverse ? '0;1' : nothing}
                                               path="${gc.leadPath}" />
                            </circle>
                        `) : nothing}
                    </svg>
                    <div
                        class="group-label ${interactive && this.host._chartTarget === groupTarget(gc.g) ? 'is-chart-active' : ''} ${curveOn && active === groupTarget(gc.g) ? 'is-curve-on' : ''}"
                        style="transform:translate(${gc.anchor.x}px,${gc.anchor.y}px) translate(-50%,-50%); --group-color:${gc.color}"
                        role=${interactive ? 'button' : nothing}
                        tabindex=${interactive ? '0' : nothing}
                        data-target=${groupTarget(gc.g)}
                        @click=${interactive ? this.host.onChartTargetClick : undefined}
                    >
                        ${gc.icon
        ? html`<ha-icon icon=${gc.icon}></ha-icon>`
        : html`<span class="group-glyph-num">${gc.g}</span>`}
                        <span>${gc.watts === null ? '' : formatPvValue(this.host.hass, gc.watts, 'W', valueDec, powerU)}</span>
                    </div>
                `;
    }) : nothing}

                <!--  Solar arc, FAR-FRONT pass: above-horizon segments with nearness below the 0.5 midpoint
                      (arched away from the eye but still ahead of the sky dome's back wall). These render
                      BEHIND the home-anchored chips so the "back half" of the arc doesn't cross a chip.  -->
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
                                stroke-width="${OUTLINE_FAR
                                    + (OUTLINE_NEAR - OUTLINE_FAR) * s.nearness}"
                            ></line>
                        `)}
                        ${arcSegmentsFrontFar.map(s => svg`
                            <line
                                class="solar-arc-segment"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke="${s.color}"
                                stroke-width="${SEGMENT_FAR
                                    + (SEGMENT_NEAR - SEGMENT_FAR) * s.nearness}"
                            ></line>
                        `)}
                    </svg>
                ` : nothing}

                <!--  Solar arc, NEAR-FRONT pass: above-horizon segments with nearness at or above 0.5 (closer
                      to the camera than the home). These render IN FRONT of the home chips + leaders so the
                      live arc reads on top of the HUD on its near side, keeping the sun visually dominant.  -->
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
                                stroke-width="${OUTLINE_FAR
                                    + (OUTLINE_NEAR - OUTLINE_FAR) * s.nearness}"
                            ></line>
                        `)}
                        ${arcSegmentsFrontNear.map(s => svg`
                            <line
                                class="solar-arc-segment"
                                x1="${s.x1}" y1="${s.y1}"
                                x2="${s.x2}" y2="${s.y2}"
                                stroke="${s.color}"
                                stroke-width="${SEGMENT_FAR
                                    + (SEGMENT_NEAR - SEGMENT_FAR) * s.nearness}"
                            ></line>
                        `)}
                    </svg>
                ` : nothing}

                <!--  Ray + bead in their own SVG below the chip family (z 7 < pv-pct-label z 8) so the PV
                      chip occludes the ray endpoint at its border. The sun disc stays in the depth-split SVG
                      below (in front of / behind the home cluster by camera bearing), so the ray never rides
                      over the production chip.  -->
                ${showSun && rayVisible ? html`
                    <svg class="solar-svg solar-ray-svg"
                         style="--solar-daylight:${sunScene!.daylight}">
                        <line
                            class="solar-ray"
                            style="--sun-flow-duration:${sunFlowDuration}s"
                            x1=${rayX1}  y1=${rayY1}
                            x2=${rayX2}  y2=${rayY2}
                            stroke=${sunColor}
                        ></line>
                        <!--  Bead rides an absolute-coordinate path with cx / cy at the default 0 origin.
                              Single-attribute updates keep the SMIL animation continuous during rotation.  -->
                        ${guard([sunColor, sunFlowDuration, rayX1, rayY1, rayX2, rayY2], () => svg`
                            <circle
                                class="solar-ray-bead"
                                r="3"
                                fill=${sunColor}
                            >
                                <animateMotion
                                    dur="${sunFlowDuration}s"
                                    repeatCount="indefinite"
                                    path="M ${rayX1},${rayY1} L ${rayX2},${rayY2}"
                                ></animateMotion>
                            </circle>
                        `)}
                    </svg>
                ` : nothing}

                <!--  Array markers: one tile per Helios-Forecast line, turned and tilted as the line is, glowing
                      by how squarely it faces the sun, with a hairline of dots from the tile to the sun while it
                      is up. Same tier as the incidence ray they replace.  -->
                ${showSun && hasArrays ? html`
                    <svg class="solar-svg solar-array-svg"
                         style="--solar-daylight:${sunScene!.daylight}">
                        ${arrayScene!.tiles.map((tile) =>
    {
        const quad = clipRect ? clipPolygon(tile.points, clipRect) : tile.points;
        const sunAt = arrayScene!.sun;
        //No ray from a tile the card does not show: an off-card array would otherwise shoot one in from the edge.
        const ray = sunAt && !(clipRect && pointOutside([tile.cx, tile.cy], clipRect))
            ? (clipRect ? clipSegment([tile.cx, tile.cy], [sunAt.x, sunAt.y], clipRect) : [[tile.cx, tile.cy], [sunAt.x, sunAt.y]])
            : null;
        //Dark glass at rest, brightening toward the marker colour as the line turns square to the light.
        const fill = mixHex('#1c2a3f', ARRAY_MARKER_COLOR, 0.12 + 0.6 * tile.glow);
        return svg`
                            ${ray ? svg`
                            <line class="solar-array-ray"
                                x1="${ray[0][0]}" y1="${ray[0][1]}" x2="${ray[1][0]}" y2="${ray[1][1]}"
                                stroke="${ARRAY_MARKER_COLOR}"></line>` : nothing}
                            ${quad.length >= 3 ? svg`
                            <polygon class="solar-array-tile"
                                points="${pointsAttr(quad)}"
                                fill="${fill}" stroke="${ARRAY_MARKER_COLOR}"></polygon>` : nothing}`;
    })}
                    </svg>
                ` : nothing}

                ${showSun && sunDiscVisible ? html`
                    <svg
                        class="solar-svg solar-svg-sun ${sunScene!.sun.nearness >= 0.50 ? 'solar-svg-sun-near' : 'solar-svg-sun-far'}"
                        style="--solar-daylight:${sunScene!.daylight}"
                    >
                        ${(() =>
    {
        //Sun disc, four layers back-to-front:
        //  0. Halo, radial-gradient glow whose radius (3x disc) and opacity scale with
        //     irradiance, feathering into the basemap with no hard edge.
        //  1. Background fill (SUN_FILL_OPACITY_BG) so the empty disc reads as tinted glass.
        //  2. Inner fill, radius = sunFillRatio x outer; conveys irradiance (sub-px radii
        //     vanish, the correct visual for "no sun").
        //  3. Outer rim (darkened sun colour) for a clear edge against the basemap.
        //Scale disc + halo by the same ramp the arc uses engine-side, so the disc-to-arc
        //ratio holds across canvas sizes (1.0 at standard Lovelace grid sizes).
        const sunArcScale = this.host._engine?.getSunArcScale() ?? 1;
        //Cap the disc radius (px): the arc fills a fixed fraction of the frame at any
        //zoom, but sunArcScale grows as the ground zoom drops (lower px/m), which would
        //otherwise balloon the disc. 22 px keeps it a sun, not a spotlight.
        const r = Math.min(
            (SUN_R_FAR
                                    + (SUN_R_NEAR - SUN_R_FAR) * sunScene!.sun.nearness)
                                    * sunArcScale,
            22);
        const rInner = r * sunFillRatio;
        //Halo proportional to live irradiance, saturating at 1000 W/m². Same sqrt mapping
        //as sunFillRatio so a 50% reading halves the glow's AREA, not its radius.
        const haloR        = r * 3;
        const haloAlphaMax = sunFillRatio * 0.55;
        //Radiant-heat aura: a warm glow that breathes (a CSS opacity + scale pulse, a heat
        //wave emanating from the disc), fading in with irradiance so a low / hazy sun stays
        //calm. `--heat` (0..1) is the gate the CSS pulse multiplies.
        const heat = Math.max(0, Math.min(1, (sunFillRatio - 0.15) / 0.55));
        //mix-blend-mode disqualifies this element from compositor-only animation, so Blink keeps running the
        //pulse on the main thread every frame even fully invisible (heat 0, opacity 0 - a weak/hazy/night
        //sun). Pausing it on the same per-frame write that already gates opacity costs nothing extra and the
        //pulse resumes exactly where CSS would have left it once heat rises again.
        const heatPlayState = heat > 0.02 ? 'running' : 'paused';
        return svg`
                                <defs>
                                    <radialGradient id="solar-halo-grad-${this.host._instanceId}">
                                        <stop offset="0%"   stop-color="${sunColor}" stop-opacity="${haloAlphaMax}"></stop>
                                        <stop offset="100%" stop-color="${sunColor}" stop-opacity="0"></stop>
                                    </radialGradient>
                                    <radialGradient id="solar-heat-grad-${this.host._instanceId}">
                                        <stop offset="0%"   stop-color="${sunColor}" stop-opacity="0.9"></stop>
                                        <stop offset="55%"  stop-color="${sunColor}" stop-opacity="0.35"></stop>
                                        <stop offset="100%" stop-color="${sunColor}" stop-opacity="0"></stop>
                                    </radialGradient>
                                </defs>
                                <circle
                                    class="solar-sun-halo"
                                    cx="${sunScene!.sun.x}" cy="${sunScene!.sun.y}"
                                    r="${haloR}"
                                    fill="url(#solar-halo-grad-${this.host._instanceId})"
                                ></circle>
                                <circle
                                    class="solar-sun-heat"
                                    cx="${sunScene!.sun.x}" cy="${sunScene!.sun.y}"
                                    r="${r * 2.6}"
                                    fill="url(#solar-heat-grad-${this.host._instanceId})"
                                    style="--heat:${heat};animation-play-state:${heatPlayState}"
                                ></circle>
                                <circle
                                    class="solar-sun-bg"
                                    cx="${sunScene!.sun.x}" cy="${sunScene!.sun.y}"
                                    r="${r}"
                                    fill="${sunColor}"
                                    fill-opacity="${SUN_FILL_OPACITY_BG}"
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
                                    stroke-width="${SUN_RIM_WIDTH}"
                                ></circle>
                            `;
    })()}
                    </svg>
                ` : nothing}

                <!--  Moon: its own arc (dotted under the horizon, solid above) and a phase-correct crescent disc,
                      in ONE layer that always paints over the sun's (z 13 > sun near-disc z 12): the moon is
                      nearer to us than the sun, so it never passes behind it. Cosmetic only, no chip. Lit side
                      faces the sun's projected position in this same scene, so the crescent reads right against
                      the sun wherever the camera turns; that direction only degenerates at new moon, when there is
                      no crescent to orient anyway.  -->
                ${(() =>
    {
        const mode      = moonDisplay(cfg);
        const moonScene = this.host._moonScene;
        if (mode === 'hidden' || !hasHomeCoords || !moonScene || moonScene.arc.length < 2)
        {
            return nothing;
        }
        //'night': only while the sun is below the geometric horizon (its own scene, same instant).
        if (mode === 'night' && sunScene && sunScene.sun.altitude > 0)
        {
            return nothing;
        }
        const moonColor = MOON_COLOR;
        const moonRim   = darkenHex(moonColor, 0.30);
        const segs      = this._buildMoonArcSegmentsCached(moonScene, moonColor);
        const m         = moonScene.moon;

        //Disc + crescent, culled off-card like the sun's (60 px clears the largest rim).
        const discVisible = m.altitude > 0 && (clipRect === null
            || !pointOutside([m.x, m.y],
                { minX: clipRect.minX - 60, minY: clipRect.minY - 60, maxX: clipRect.maxX + 60, maxY: clipRect.maxY + 60 }));
        const arcScale = this.host._engine?.getSunArcScale() ?? 1;
        const r  = Math.min((MOON_R_FAR + (MOON_R_NEAR - MOON_R_FAR) * m.nearness) * arcScale, 18);
        const litDx = (sunScene?.sun.x ?? m.x + 1) - m.x;
        const litDy = (sunScene?.sun.y ?? m.y) - m.y;
        const crescent = moonCrescentPath(m.x, m.y, r * MOON_CRESCENT_INSET, m.fraction, litDx, litDy);

        //Clip to the card box, then split solid (above horizon) from dotted (below): each half gets its own
        //translucent <g>, see the CSS note on why the opacity cannot sit on the segments themselves.
        const solid: ArcSegment[] = [];
        const dotted: ArcSegment[] = [];
        for (const s of segs)
        {
            if (clipRect)
            {
                const c = clipSegment([s.x1, s.y1], [s.x2, s.y2], clipRect);
                if (!c)
                {
                    continue;
                }
                s.x1 = c[0][0]; s.y1 = c[0][1]; s.x2 = c[1][0]; s.y2 = c[1][1];
            }
            (s.belowHorizon ? dotted : solid).push(s);
        }
        const moonLine = (s: ArcSegment) =>
        {
            const w = (SEGMENT_FAR + (SEGMENT_NEAR - SEGMENT_FAR) * s.nearness) * 0.75;
            return svg`
                            <line
                                class="moon-arc-segment ${s.belowHorizon ? 'moon-arc-night' : ''}"
                                x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"
                                stroke="${s.color}"
                                stroke-width="${s.belowHorizon ? w * NIGHT_STROKE_FACTOR : w}"
                            ></line>`;
        };

        return html`
                    <svg class="moon-svg">
                        <g class="moon-arc-nightg">${dotted.map(moonLine)}</g>
                        <g class="moon-arc-solid">${solid.map(moonLine)}</g>
                        ${discVisible ? svg`
                            <circle class="moon-disc-bg" cx="${m.x}" cy="${m.y}" r="${r}" fill="${MOON_DARK}" fill-opacity="0.9"></circle>
                            <path class="moon-crescent" d="${crescent}" fill="${moonColor}"></path>
                            <circle class="moon-disc-rim" cx="${m.x}" cy="${m.y}" r="${r}" fill="none" stroke="${moonRim}" stroke-width="1"></circle>
                        ` : nothing}
                    </svg>
                `;
    })()}

                <!--  Weather chip, pinned above the sun disc: the cloud-cover glyph (clear / partly / overcast)
                      next to the live irradiance value. One chip carries both stories, the icon for the sky
                      condition and the number for the W/m²; clicking it targets the timeline's irradiance
                      view, where the cloud layers overlay the curve.  -->
                ${showSunLabel ? html`
                    <div
                        class="solar-pct-label ${interactive && this.host._chartTarget === 'irradiance' ? 'is-chart-active' : ''} ${curveOn && active === 'irradiance' ? 'is-curve-on' : ''}"
                        style="transform:translate(${sunScene!.sun.x}px,${sunScene!.sun.y - 22}px) translate(-50%,-100%); --solar-color:${irradChipColor}"
                        role=${interactive ? 'button' : nothing}
                        tabindex=${interactive ? '0' : nothing}
                        data-target="irradiance"
                        @click=${interactive ? this.host.onChartTargetClick : undefined}
                    >
                        <ha-icon icon=${chipSlotIcon(cfg, 'irradiance', sunChipIconFallback)}></ha-icon>
                        <span>${sunChipText}</span>
                    </div>
                ` : nothing}

                <!--  Sunrise / sunset markers: a sun-coloured glyph + local time just outside the arc at each
                      horizon crossing. Hidden by the show-sun-times option.  -->
                ${showSun && sunScene && showSunTimes(cfg) ? html`
                    ${this._renderSunCrossing(sunScene.sunrise, sunScene.home, 'mdi:weather-sunset-up',   sunColor)}
                    ${this._renderSunCrossing(sunScene.sunset,  sunScene.home, 'mdi:weather-sunset-down', sunColor)}
                ` : nothing}



                <!--  Home hub: the node the chip cluster orbits, at the projected home centre with no drop-leader
                      so every chip leader docks straight against it. Shown as the home pill (glyph + live
                      consumption) unless the home chip is hidden, in which case it collapses to a small hollow
                      ring: a bare contact point the leads converge on, the scene still visible through it.  -->
                ${hasHomeCoords && layout !== null && showHomeElement
        ? (homeHidden
            ? html`<div class="home-ring" style="transform:translate(${layout!.home.x}px,${layout!.home.y}px) translate(-50%,-50%); --home-ring-color:${chipSlotColor(this.host, cfg, 'home')}"></div>`
            : html`
                    <div
                        class="home-pill ${this.host._homeHover ? 'is-hovered' : ''} ${interactive && this.host._chartTarget === 'consumption' ? 'is-chart-active' : ''} ${curveOn && active === 'consumption' ? 'is-curve-on' : ''}"
                        style="transform:translate(${layout!.home.x}px,${layout!.home.y}px) translate(-50%,-50%)"
                        role=${interactive ? 'button' : nothing}
                        tabindex=${interactive ? '0' : nothing}
                        data-target="consumption"
                        @click=${interactive ? this.host.onChartTargetClick : undefined}
                        @mouseenter=${this.host.onHomeEnter}
                        @mouseleave=${this.host.onHomeLeave}
                    >
                        <ha-icon icon=${chipSlotIcon(cfg, 'home', 'mdi:home')}></ha-icon>
                        ${showHomeUsageChip ? html`<span class="home-pill-usage">${homeUsageText}</span>` : nothing}
                    </div>`)
        : nothing}
        `;
    }
}
