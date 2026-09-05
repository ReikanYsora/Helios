//Hover tooltip + pointer handlers for the timeline chart stack: the per-target readout rows, the day kWh / forecast
//line, and the magnet-snap live chip. Pure templates over the structural ChartHost.

import type { TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import { valueDecimals, powerUnit, energyUnit, irradianceUnit } from '../core/config/helios-config';
import { consumptionLoad } from '../core/energy';
import { energySolarColor, energyGridColor, energyBatteryColor, formatPower, formatIrradiance, formatEnergyKwh, formatTemperature, pvNormalizeToWatts, cssHex, formatHaDateTime, deviceColorByIndex } from '../core/format/format';
import { chipSlotColor, chipSlotIcon } from '../core/config/chip-appearance';
import { valueAt } from '../data/unifiedStore';
import { wattsAtFromChangeSeries, type ChangeBucket } from '../data/sources/energy-stats';
import { groupDevices, deviceName, deviceIcon } from '../data/sources/device-consumption';
import { staticPrice, costRateAt } from '../data/sources/cost';
import { pickTranslations } from '../core/i18n';
import { resolveRangeMs } from './timeline-model';
import {
    type ChartHost,
    chartIsDark,
    targetLabel,
    solarSourceName,
    gridImportName,
    gridExportName,
    batteryChargeName,
    batteryDischargeName,
    gridSourceName,
    batterySourceName,
    isGroupTarget,
    groupOfTarget,
    irradianceForecastColor,
    cloudBandColors,
    hasMultiSourceBreakdown,
} from '../charts/charts';
import { interpAt, pvValueAtTime } from '../data/series-sample';
import { computeDailyKwhTotals } from '../charts/charts-generic';
import { DAY_MS } from '../core/config/constants';


//Hover tooltip above the chart-card stack: the hover timestamp + one icon-coded row per series, plus the day's kWh
//production (past) or forecast (future). A magnet-snap tab surfaces when the scrub enters the band around the live
//cursor (snap logic in applyTimelinePointer, timeline.ts). The PV row is skipped when unavailable.
export function renderTimelineHoverTooltip(host: ChartHost): TemplateResult | typeof nothing
{
    const rng      = resolveRangeMs(host._timeRange);
    const series   = host._chartSeries;
    //Tooltip stays available when _chartSeries is null (Open-Meteo unreachable): PV + per-entity rows read from the
    //recorder fine, irradiance + cloud cells fall back to NaN handled below.
    if (!rng)
    {
        return nothing;
    }
    const { startMs, rangeMs } = rng;

    //Shows only while the pointer is over the chart (or dragging the scrub). On gesture end _chartHoverPct goes null
    //and the tooltip disappears, leaving just the scrub line.
    const hoverPct = host._chartHoverPct;
    if (hoverPct === null || hoverPct < 0 || hoverPct > 100)
    {
        return nothing;
    }
    const pct  = hoverPct;
    const atMs = startMs + (pct / 100) * rangeMs;

    const irrV = series ? interpAt(series.times, series.irradiance, atMs) : NaN;
    const tempV = series ? interpAt(series.times, series.temperature, atMs) : NaN;
    const humV  = series ? interpAt(series.times, series.humidity,    atMs) : NaN;
    const cloudLowV  = series ? interpAt(series.times, series.cloudLow,  atMs) : NaN;
    const cloudMidV  = series ? interpAt(series.times, series.cloudMid,  atMs) : NaN;
    const cloudHighV = series ? interpAt(series.times, series.cloudHigh, atMs) : NaN;
    const pv   = pvValueAtTime(host, atMs);

    //Active chart target: tooltip rows follow the re-targetable chart (chip <-> chart <-> tooltip coupling).
    //Grid/battery read from the store at the cursor instant (watts; kw() formats to kW; null becomes NaN).
    const target   = host._chartTarget ?? 'production';
    const store    = host._unifiedStore;
    const gridImpW = store ? (valueAt(store.gridImport, store, atMs) ?? NaN) : NaN;
    const gridExpW = store ? (valueAt(store.gridExport, store, atMs) ?? NaN) : NaN;
    const battW    = store ? (valueAt(store.battery,    store, atMs) ?? NaN) : NaN;
    //Home consumption (load) at the hovered instant: production + import - export - net battery (charge+), clamped at
    //0. Same formula as the consumption chart series. Hidden when no flow has any reading.
    const prodW          = store ? (valueAt(store.production, store, atMs) ?? NaN) : NaN;
    //Forecast at the cursor from the SAME series the dashed ghost curve draws (store.forecast), so the irradiance
    //view's tooltip row matches its curve + hover dot for the whole day (pvValueAtTime returns recorded production in
    //the past, which is a different number than the forecast reference the ghost curve shows).
    const forecastW      = store ? (valueAt(store.forecast, store, atMs) ?? NaN) : NaN;
    const hasConsumption = isFinite(prodW) || isFinite(gridImpW) || isFinite(gridExpW) || isFinite(battW);
    const consumptionW   = consumptionLoad(
        isFinite(prodW) ? prodW : 0, isFinite(gridImpW) ? gridImpW : 0,
        isFinite(gridExpW) ? gridExpW : 0, isFinite(battW) ? battW : 0);
    const battSocV = host._batterySocHistory
        ? interpAt(host._batterySocHistory.times, host._batterySocHistory.values, atMs)
        : NaN;
    //User decimals apply to every kW/kWh readout; raw watts stay integers.
    const dec = valueDecimals(host.config);
    const powerU = powerUnit(host.config);
    const energyU = energyUnit(host.config);
    const irradU = irradianceUnit(host.config);
    const kw = (w: number): string => formatPower(host.hass, w, dec, powerU);

    //Cost at the hovered instant (currency/hour): import kW x import price - export kW x export price. Static price
    //only (matches the cost curve); NaN when no static price is set. gridImpW/gridExpW are watts, hence /1000.
    const costImpP = host._energyDefaults ? staticPrice(host._energyDefaults.gridImportPriceNumbers) : null;
    const costExpP = host._energyDefaults ? (staticPrice(host._energyDefaults.gridExportPriceNumbers) ?? 0) : 0;
    const costCur  = String(host.hass?.config?.currency ?? '€');
    //Prefer HA's cost statistics at the cursor (any tariff); else a single static price x power at that instant.
    const costFromStats = costRateAt(host, atMs);
    const costV    = costFromStats !== null
        ? costFromStats
        : (costImpP !== null && (isFinite(gridImpW) || isFinite(gridExpW)))
            ? ((isFinite(gridImpW) ? gridImpW : 0) * costImpP - (isFinite(gridExpW) ? gridExpW : 0) * costExpP) / 1000
            : NaN;

    //Per-entity breakdown rows for multi-source installs. Each row carries the friendly name + a hue-rotated colour
    //pastille matching its per-source curve. Single-source installs skip it (the lone entry equals the aggregate,
    //duplicating the headline row).
    const perEntityMap     = host._pvChangeSeriesPerEntity;
    //Source order (not sorted), so row index lines up with solarSourceName: the per-source
    //change map is keyed by the solar meters in HA Energy source order.
    const perEntityIds     = perEntityMap.size > 1 ? Array.from(perEntityMap.keys()) : [];
    const perEntityRows: { id: string; label: string; valueText: string; colorIdx: number }[] = [];
    for (let i = 0; i < perEntityIds.length; i++)
    {
        const id    = perEntityIds[i];
        const val   = pvValueAtTime(host, atMs, id);
        if (!isFinite(val.value))
        {
            continue;
        }
        const valueText   = formatPower(host.hass, pvNormalizeToWatts(val.value, val.unit), dec, powerU);
        perEntityRows.push({ id, label: solarSourceName(host, i), valueText, colorIdx: i });
    }
    const hasPv = isFinite(pv.value);
    //Forecast label, FR/EN like the other tooltip metric names (targetLabel is FR/EN only). Used wherever the row
    //shows the predicted curve rather than measured production - the irradiance view's ghost line, and the PV view
    //once the cursor is past the last recorded sample.
    const forecastLabel  = String(host.hass?.language ?? '').toLowerCase().startsWith('fr') ? 'Prévision' : 'Forecast';

    //Row names: the metric name, or the configured entity's HA Energy name for the two-direction grid/battery rows.
    const tgtName        = targetLabel(host, target);
    //Cloud layer names for the irradiance view's overlay rows (percent unit, separate from the W/m² row).
    const cloudNames     = pickTranslations(host.hass?.language).cloudCover;
    const gridFromName   = gridImportName(host);
    const gridToName     = gridExportName(host);
    const battChargeName = batteryChargeName(host);
    const battDisName    = batteryDischargeName(host);
    //Each row's icon takes the colour of the series it represents (matching the chart curves) so the readout is
    //scannable at a glance; only the live chip keeps the theme colour. Cloud greys mirror the three stacked
    //band shades in renderTargetChart.
    const el             = host as unknown as Element;
    //Monitoring group: one row per visible device, its power at the hovered instant (from its change series) with
    //the device's dashboard colour + name. Empty for non-group targets.
    const groupRows = isGroupTarget(target)
        ? groupDevices(host.config, host._energyDefaults, groupOfTarget(target)).map(dev =>
        {
            const w = wattsAtFromChangeSeries(host._deviceChangeSeries.get(dev.statConsumption) ?? null, atMs);
            return {
                w:     w === null ? NaN : Math.abs(w),
                color: deviceColorByIndex(el, dev.index),
                name:  deviceName(host.hass, dev),
                icon:  deviceIcon(host.hass, dev),
            };
        })
        : [];
    const cloud          = cloudBandColors(el);
    const cloudBase      = cloud.mid;
    const cloudLowColor  = cloud.low;
    const cloudHighColor = cloud.high;
    //Ghosted irradiance colour for the irradiance view's forecast row, identical to the dashed forecast curve + its hover dot.
    const forecastColor  = irradianceForecastColor(host);

    //Multi-source breakdown rows for grid / battery, mirroring the solar perEntity rows: one row per configured meter,
    //but only once 2+ sources each carry their own recorder series (the shared hasMultiSourceBreakdown guard
    //stackedLines also uses), so a single-source install shows no breakdown rows. Index and colour follow the
    //source order the bands are painted in, so each row lines up with its own stacked band.
    const dark = chartIsDark(host);
    const ed   = host._energyDefaults;
    const breakdown = (
        ids:      readonly string[],
        map:      Map<string, ChangeBucket[]>,
        nameFor:  (i: number) => string,
        colorFor: (i: number) => string
    ): { label: string; valueText: string; color: string }[] =>
    {
        if (!hasMultiSourceBreakdown(ids, map))
        {
            return [];
        }
        const rows: { label: string; valueText: string; color: string }[] = [];
        for (let s = 0; s < ids.length; s++)
        {
            const w = wattsAtFromChangeSeries(map.get(ids[s]) ?? null, atMs);
            //Skip a source idle at this instant (same 1 W floor as the aggregate rows); this also drops the whole set
            //for the flow that is not active right now, so import and export never both list their sources at once.
            if (w === null || !isFinite(w) || Math.abs(w) < 1)
            {
                continue;
            }
            rows.push({ label: nameFor(s), valueText: formatPower(host.hass, Math.abs(w), dec, powerU), color: colorFor(s) });
        }
        return rows;
    };
    const gridImpRows = breakdown(ed.gridStatEnergyFroms, host._gridImportChangeSeriesPerEntity, (s) => gridSourceName(host, s, 'import'), (s) => energyGridColor(el, dark, s, 'import'));
    const gridExpRows = breakdown(ed.gridStatEnergyTos,   host._gridExportChangeSeriesPerEntity, (s) => gridSourceName(host, s, 'export'), (s) => energyGridColor(el, dark, s, 'export'));
    const battChgRows = breakdown(ed.batteryStatEnergyTos,   host._batteryChargeChangeSeriesPerEntity,    (s) => batterySourceName(host, s, 'charge'),    (s) => energyBatteryColor(el, dark, s, 'charge'));
    const battDisRows = breakdown(ed.batteryStatEnergyFroms, host._batteryDischargeChangeSeriesPerEntity, (s) => batterySourceName(host, s, 'discharge'), (s) => energyBatteryColor(el, dark, s, 'discharge'));

    //Fused battery view: per-bank SoC at the cursor, to list each bank's level under the power rows (matching the
    //chart's per-bank SoC lines and their hover beams). Falls back to the aggregated mean when no per-bank series.
    //The beam colour tracks the charge/discharge flow (idle grey), same rule as the chart, so a row lines up with
    //its dot's colour.
    const socBankSeries = host._batterySocPerBankHistory.length > 0
        ? host._batterySocPerBankHistory
        : (host._batterySocHistory ? [host._batterySocHistory] : []);
    const socBankVals   = socBankSeries.map(b => interpAt(b.times, b.values, atMs));
    const socLabel      = targetLabel(host, 'battery-soc');
    const socBeamColor  = (!isFinite(battW) || Math.abs(battW) < 5)
        ? cssHex(el, '--secondary-text-color', '#9e9e9e')
        : (battW > 0 ? chipSlotColor(el, host.config, 'batteryCharge') : chipSlotColor(el, host.config, 'batteryDischarge'));

    const atDate     = new Date(atMs);
    const haLanguage = (host.hass?.language as string | undefined) || undefined;
    //Header granularity follows the window: intraday shows the time, a multi-day span adds the weekday, and a
    //month span shows the calendar day, so you always know when you are.
    const spanDays  = rangeMs / DAY_MS;
    const timeOpts: Intl.DateTimeFormatOptions =
          spanDays <= 2.05  ? { hour: '2-digit', minute: '2-digit' }
              : spanDays <= 14.05 ? { weekday: 'short', hour: '2-digit', minute: '2-digit' }
                  :                     { weekday: 'short', day: 'numeric', month: 'short' };
    const timeLabel  = new Intl.DateTimeFormat(haLanguage, timeOpts).format(atDate);

    //Day total split observed/forecast by cursor-vs-"now" (not the day boundary), so later-today hours show the
    //full-day forecast and earlier hours the production so far. Today's past prefers recorder-backed
    //`_haSolarTodayKwh`, else local trapezoidal integration; future uses `computeDailyKwhTotals`.
    const dayKey = new Date(atDate);
    dayKey.setHours(0, 0, 0, 0);
    const todayKey = new Date();
    todayKey.setHours(0, 0, 0, 0);
    const isToday        = dayKey.getTime() === todayKey.getTime();
    const isFutureCursor = atMs > Date.now();
    const dayTotals      = computeDailyKwhTotals(host);
    let dayKwh: number | undefined = dayTotals.get(dayKey.getTime());
    if (isToday && !isFutureCursor && typeof host._haSolarTodayKwh === 'number' && isFinite(host._haSolarTodayKwh))
    {
        dayKwh = host._haSolarTodayKwh;
    }
    //Past cursor shows only instantaneous power (the day total lives in the detail panel); a future cursor adds the
    //forecast day total, which has no other home in the UI.
    const showForecast   =  isFutureCursor && dayKwh !== undefined && isFinite(dayKwh) && dayKwh >= 0.05;
    const dayKwhText = (dayKwh !== undefined && isFinite(dayKwh) && dayKwh >= 0.05)
        ? formatEnergyKwh(host.hass, dayKwh, dec, energyU)
        : '';

    //Magnet-snap detection: when the scrub lands in a narrow band around the live cursor, applyTimelinePointer
    //(timeline.ts) auto-releases to live mode and a restore tab surfaces. The 8 px scrub check maps to ~1.2 % at
    //typical chart widths.
    const MAGNET_PCT   = 1.2;
    const nowMsRef     = Date.now();
    const inMagnetZone = nowMsRef >= startMs && nowMsRef <= startMs + rangeMs
        && Math.abs(pct - ((nowMsRef - startMs) / rangeMs) * 100) <= MAGNET_PCT;


    const haLang   = (host.hass?.language as string | undefined) || '';
    //Short inline label for the magnet-snap tab; the title + aria-label carry the long phrase for screen readers.
    const liveLabel = 'Live';
    const liveText  = haLang.toLowerCase().startsWith('fr')
        ? 'Retour au live'
        : 'Back to live';

    //Horizontal anchor: a continuous translateX(-${pct}%) slide, so its left edge sits at 0 % and right edge at
    //100 % as the scrub sweeps. Never goes off-screen, no jump-to-edge magnet.
    return html`
        <div
            class="tb-hover-tooltip-tail ${inMagnetZone ? 'is-magnet-snap' : ''}"
            style="left:${pct.toFixed(2)}%"
        ></div>
        <div
            class="tb-hover-tooltip-wrapper"
            style="left:${pct.toFixed(2)}%; transform: translateX(-${pct.toFixed(2)}%)"
        >
            <div class="tb-hover-tooltip">
                <div class="tb-hover-tooltip-time">
                    <ha-icon class="tb-hover-tooltip-time-icon" icon="mdi:clock-outline"></ha-icon>
                    <span class="tb-hover-tooltip-time-label">${timeLabel}</span>
                    <span
                        class="tb-hover-tooltip-live-chip ${inMagnetZone ? 'is-visible' : ''}"
                        aria-label=${liveText}
                        aria-hidden=${inMagnetZone ? 'false' : 'true'}
                    >
                        <ha-icon class="tb-hover-tooltip-live-chip-dot" icon="mdi:circle-medium"></ha-icon>
                        <span class="tb-hover-tooltip-live-chip-label">${liveLabel}</span>
                    </span>
                    <span class="tb-hover-tooltip-exact">${formatHaDateTime(host.hass, atDate)}</span>
                </div>
                ${target === 'production' ? html`
                    ${showForecast && dayKwhText ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${forecastColor}" icon="mdi:crystal-ball"></ha-icon>
                            <span class="tb-hover-tooltip-name">${forecastLabel}</span>
                            <span class="tb-hover-tooltip-value">${dayKwhText}</span>
                        </div>
                    ` : nothing}
                    ${hasPv ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${pv.isPredicted ? forecastColor : chipSlotColor(el, host.config, 'production')}" icon=${pv.isPredicted ? 'mdi:crystal-ball' : chipSlotIcon(host.config, 'production', 'mdi:solar-power')}></ha-icon>
                            <span class="tb-hover-tooltip-name">${pv.isPredicted ? forecastLabel : tgtName}</span>
                            <span class="tb-hover-tooltip-value">${formatPower(host.hass, pvNormalizeToWatts(pv.value, pv.unit), dec, powerU)}</span>
                        </div>
                    ` : nothing}
                    ${!pv.isPredicted && isFinite(forecastW) && forecastW > 0 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${forecastColor}" icon="mdi:crystal-ball"></ha-icon>
                            <span class="tb-hover-tooltip-name">${forecastLabel}</span>
                            <span class="tb-hover-tooltip-value">${kw(forecastW)}</span>
                        </div>
                    ` : nothing}
                    ${perEntityRows.map(prow => html`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${energySolarColor(host as unknown as Element, chartIsDark(host), prow.colorIdx)}"></span>
                            <span class="tb-hover-tooltip-sublabel">${prow.label}</span>
                            <span class="tb-hover-tooltip-value">${prow.valueText}</span>
                        </div>
                    `)}
                ` : nothing}
                ${target === 'consumption' && hasConsumption ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'home')}" icon=${chipSlotIcon(host.config, 'home', 'mdi:home-lightning-bolt')}></ha-icon>
                        <span class="tb-hover-tooltip-name">${tgtName}</span>
                        <span class="tb-hover-tooltip-value">${kw(consumptionW)}</span>
                    </div>
                ` : nothing}
                ${target === 'grid' ? html`
                    ${isFinite(gridImpW) && gridImpW >= 1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'gridImport')}" icon=${chipSlotIcon(host.config, 'gridImport')}></ha-icon>
                            <span class="tb-hover-tooltip-name">${gridFromName}</span>
                            <span class="tb-hover-tooltip-value">${kw(gridImpW)}</span>
                        </div>
                    ` : nothing}
                    ${gridImpRows.map(r => html`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${r.color}"></span>
                            <span class="tb-hover-tooltip-sublabel">${r.label}</span>
                            <span class="tb-hover-tooltip-value">${r.valueText}</span>
                        </div>
                    `)}
                    ${isFinite(gridExpW) && gridExpW >= 1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'gridExport')}" icon=${chipSlotIcon(host.config, 'gridExport')}></ha-icon>
                            <span class="tb-hover-tooltip-name">${gridToName}</span>
                            <span class="tb-hover-tooltip-value">${kw(gridExpW)}</span>
                        </div>
                    ` : nothing}
                    ${gridExpRows.map(r => html`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${r.color}"></span>
                            <span class="tb-hover-tooltip-sublabel">${r.label}</span>
                            <span class="tb-hover-tooltip-value">${r.valueText}</span>
                        </div>
                    `)}
                ` : nothing}
                ${target === 'battery' ? html`
                    ${isFinite(battW) && battW >= 1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'batteryCharge')}" icon=${chipSlotIcon(host.config, 'batteryCharge', 'mdi:battery-arrow-up')}></ha-icon>
                            <span class="tb-hover-tooltip-name">${battChargeName}</span>
                            <span class="tb-hover-tooltip-value">${kw(battW)}</span>
                        </div>
                    ` : nothing}
                    ${battChgRows.map(r => html`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${r.color}"></span>
                            <span class="tb-hover-tooltip-sublabel">${r.label}</span>
                            <span class="tb-hover-tooltip-value">${r.valueText}</span>
                        </div>
                    `)}
                    ${isFinite(battW) && battW <= -1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'batteryDischarge')}" icon=${chipSlotIcon(host.config, 'batteryDischarge', 'mdi:battery-arrow-down')}></ha-icon>
                            <span class="tb-hover-tooltip-name">${battDisName}</span>
                            <span class="tb-hover-tooltip-value">${kw(-battW)}</span>
                        </div>
                    ` : nothing}
                    ${battDisRows.map(r => html`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${r.color}"></span>
                            <span class="tb-hover-tooltip-sublabel">${r.label}</span>
                            <span class="tb-hover-tooltip-value">${r.valueText}</span>
                        </div>
                    `)}
                    ${socBankVals.map((v, i) => isFinite(v) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${socBeamColor}" icon="mdi:battery"></ha-icon>
                            <span class="tb-hover-tooltip-name">${host._energyDefaults?.batteryNames?.[i] || `${socLabel}${socBankVals.length > 1 ? ` ${i + 1}` : ''}`}</span>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, v)))} %</span>
                        </div>
                    ` : nothing)}
                ` : nothing}
                ${target === 'battery-soc' && isFinite(battSocV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'batteryDischarge')}" icon="mdi:battery"></ha-icon>
                        <span class="tb-hover-tooltip-name">${tgtName}</span>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, battSocV)))} %</span>
                    </div>
                ` : nothing}
                ${isGroupTarget(target) ? groupRows.map(r => isFinite(r.w) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${r.color}" icon=${r.icon}></ha-icon>
                        <span class="tb-hover-tooltip-name">${r.name}</span>
                        <span class="tb-hover-tooltip-value">${kw(r.w)}</span>
                    </div>
                ` : nothing) : nothing}
                ${target === 'irradiance' && isFinite(irrV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'irradiance')}" icon=${chipSlotIcon(host.config, 'irradiance', 'mdi:white-balance-sunny')}></ha-icon>
                        <span class="tb-hover-tooltip-name">${tgtName}</span>
                        <span class="tb-hover-tooltip-value">${formatIrradiance(host.hass, irrV, dec, irradU)}</span>
                    </div>
                ` : nothing}
                ${target === 'irradiance' && isFinite(forecastW) && forecastW > 0 ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${forecastColor}" icon="mdi:crystal-ball"></ha-icon>
                        <span class="tb-hover-tooltip-name">${forecastLabel}</span>
                        <span class="tb-hover-tooltip-value">${kw(forecastW)}</span>
                    </div>
                ` : nothing}
                ${target === 'irradiance' ? html`
                    ${isFinite(cloudHighV) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${cloudHighColor}" icon="mdi:format-vertical-align-top"></ha-icon>
                            <span class="tb-hover-tooltip-name">${cloudNames.cloudHigh}</span>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cloudHighV)))} %</span>
                        </div>
                    ` : nothing}
                    ${isFinite(cloudMidV) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${cloudBase}" icon="mdi:format-vertical-align-center"></ha-icon>
                            <span class="tb-hover-tooltip-name">${cloudNames.cloudMid}</span>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cloudMidV)))} %</span>
                        </div>
                    ` : nothing}
                    ${isFinite(cloudLowV) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${cloudLowColor}" icon="mdi:format-vertical-align-bottom"></ha-icon>
                            <span class="tb-hover-tooltip-name">${cloudNames.cloudLow}</span>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cloudLowV)))} %</span>
                        </div>
                    ` : nothing}
                ` : nothing}
                ${target === 'temperature' && isFinite(tempV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'temperature')}" icon=${chipSlotIcon(host.config, 'temperature', 'mdi:thermometer')}></ha-icon>
                        <span class="tb-hover-tooltip-name">${tgtName}</span>
                        <span class="tb-hover-tooltip-value">${formatTemperature(host.hass, tempV)}</span>
                    </div>
                ` : nothing}
                ${target === 'humidity' && isFinite(humV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'humidity')}" icon=${chipSlotIcon(host.config, 'humidity', 'mdi:water-percent')}></ha-icon>
                        <span class="tb-hover-tooltip-name">${tgtName}</span>
                        <span class="tb-hover-tooltip-value">${Math.round(humV)} %</span>
                    </div>
                ` : nothing}
                ${target === 'cost' && isFinite(costV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${chipSlotColor(el, host.config, 'cost')}" icon=${chipSlotIcon(host.config, 'cost', 'mdi:cash')}></ha-icon>
                        <span class="tb-hover-tooltip-name">${tgtName}</span>
                        <span class="tb-hover-tooltip-value">${costV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${costCur}/h</span>
                    </div>
                ` : nothing}
            </div>
        </div>
    `;
}


//Coalesces onChartHoverMove's writes to _chartHoverPct to at most one per animation frame: native pointermove
//fires far faster than the display refreshes, and each write triggers a full card re-render (including the chart
//rebuild above). One module-level slot is enough - only one pointer can be hovering a chart at a time - keyed on
//the latest event, so a burst of moves within a frame all collapse into the single most recent one.
let _hoverRafId:   number | null = null;
let _hoverCard:    HTMLElement | null = null;
let _hoverClientX = 0;
let _hoverHost:    ChartHost | null = null;

function cancelPendingHover(): void
{
    if (_hoverRafId !== null)
    {
        cancelAnimationFrame(_hoverRafId);
        _hoverRafId = null;
    }
    _hoverHost = null;
    _hoverCard = null;
}

function flushPendingHover(): void
{
    _hoverRafId = null;
    const host = _hoverHost;
    const card = _hoverCard;
    if (!host || !card)
    {
        return;
    }
    const rect = card.getBoundingClientRect();
    if (rect.width <= 0)
    {
        return;
    }
    const frac = Math.max(0, Math.min(1, (_hoverClientX - rect.left) / rect.width));
    host._chartHoverPct = frac * 100;
}

//Hover-cursor pointer handlers, attached per chart card (its bounding rect drives the fractional X). A press
//(e.buttons !== 0) clears the hover so a scrub drag leaves no stale dot; the scrub itself lives on the time-bar
//pointerdown and captures the pointer until release. The card element + clientX are captured synchronously
//(currentTarget resets to null once the event finishes dispatching, so it can't be read back inside the deferred
//rAF callback); only the bounding-rect read and the _chartHoverPct write are deferred to the next frame.
export function onChartHoverMove(host: ChartHost, e: PointerEvent): void
{
    if (e.buttons !== 0)
    {
        cancelPendingHover();
        host._chartHoverPct = null;
        return;
    }
    const card = e.currentTarget as HTMLElement | null;
    if (!card)
    {
        return;
    }
    _hoverHost    = host;
    _hoverCard    = card;
    _hoverClientX = e.clientX;
    if (_hoverRafId !== null)
    {
        cancelAnimationFrame(_hoverRafId);
    }
    _hoverRafId = requestAnimationFrame(flushPendingHover);
}


export function onChartHoverLeave(host: ChartHost): void
{
    cancelPendingHover();
    host._chartHoverPct = null;
}
