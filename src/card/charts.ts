//Stable import surface for the timeline charts: the shared structural types, the friendly-name label helpers many
//modules read off, plus re-exports of the render + sampling concerns living in sibling modules. Charts only read;
//state mutations live elsewhere.

import { type HeliosConfig, customEntityId } from '../helios-config';
import type { EnergyDefaults } from './energy-prefs';
import type { PvHistory } from './pv';
import type { UnifiedDataStore } from './unifiedStore';
import type { ChangeBucket } from './energy-stats';
import { resolveCustomEntityLive } from './custom-entity';


//Engine-resampled weather series, pushed to the card on every refresh.
export interface ChartSeries
{
    times:        Date[];
    irradiance:   number[];
    cloud:        number[];
    //Hourly low / mid / high cloud cover (%), for the timeline's cloud target (three altitude bands).
    cloudLow:     number[];
    cloudMid:     number[];
    cloudHigh:    number[];
}

//Re-targetable bottom-chart target: the single series-set the chart draws at a time. 'production' (default) adds
//the dashed forecast + per-source breakdown; 'grid'/'battery' draw two-direction flows (accent = dominant side);
//'irradiance' draws W/m² on a fixed 0..1000 scale.
export type ChartTarget = 'production' | 'consumption' | 'grid' | 'battery' | 'battery-soc' | 'irradiance' | 'cloud' | 'custom';

//Friendly name of the first configured entity in a stat list (the HA Energy dashboard's own name), for a tooltip
//row. Empty when none is configured.
export function statFriendly(host: ChartHost, ids: string[]): string
{
    const id = ids[0];
    return id ? String(host.hass?.states?.[id]?.attributes?.friendly_name ?? id) : '';
}

//Canonical per-source PV name: the HA Energy solar source's energy meter (stat_energy_from), by source index. Single
//source of the per-string name so the clock (both data paths) and the timeline label string `index` identically; the
//rate/meter arrays are parallel per source, so this stays aligned as long as nothing re-sorts.
export function solarSourceName(host: ChartHost, index: number): string
{
    const id = host._energyDefaults.solarStatEnergyFroms[index];
    return id ? String(host.hass?.states?.[id]?.attributes?.friendly_name ?? id) : `PV ${index + 1}`;
}

//Directional energy names from the HA Energy dashboard, so the clock + timeline tooltips never diverge.
export function gridImportName(host: ChartHost):      string { return statFriendly(host, host._energyDefaults.gridStatEnergyFroms); }
export function gridExportName(host: ChartHost):      string { return statFriendly(host, host._energyDefaults.gridStatEnergyTos); }
export function batteryChargeName(host: ChartHost):   string { return statFriendly(host, host._energyDefaults.batteryStatEnergyTos); }
export function batteryDischargeName(host: ChartHost): string { return statFriendly(host, host._energyDefaults.batteryStatEnergyFroms); }

//Metric name for a tooltip row / rail title. en + fr; other locales fall back to en. Custom takes the entity's own
//name. Every tooltip name comes from here or from statFriendly.
const TARGET_LABELS_EN: Record<ChartTarget, string> = {
    production: 'Production', consumption: 'Consumption', grid: 'Grid', battery: 'Battery',
    'battery-soc': 'Battery charge', irradiance: 'Irradiance', cloud: 'Cloud cover', custom: 'Custom',
};
const TARGET_LABELS_FR: Record<ChartTarget, string> = {
    production: 'Production', consumption: 'Consommation', grid: 'Réseau', battery: 'Batterie',
    'battery-soc': 'Charge batterie', irradiance: 'Irradiance', cloud: 'Nébulosité', custom: 'Personnalisé',
};
export function clockTargetLabel(host: ChartHost, target: ChartTarget): string
{
    if (target === 'custom')
    {
        const live = resolveCustomEntityLive(host.hass, customEntityId(host.config));
        return live?.name || customEntityId(host.config) || 'Custom';
    }
    const lang = String(host.hass?.language ?? '').toLowerCase();
    return (lang.startsWith('fr') ? TARGET_LABELS_FR : TARGET_LABELS_EN)[target];
}

//Structural surface the host card exposes. `_chartHoverPct` is intentionally writable (hover handlers mutate it on
//pointermove/leave); every other field stays read-only.
export interface ChartHost
{
    readonly config:         HeliosConfig | undefined;
    readonly hass:           any;
    readonly _energyDefaults: EnergyDefaults;
    readonly _timeRange:    { start: Date; end: Date } | null;
    readonly _chartSeries:  ChartSeries | null;
    readonly _pvHistory:    PvHistory | null;
    //Recorder `change` series (5-min buckets) for the solar meter(s). sumChangeForDay sums exact per-day kWh so
    //totals match HA Energy to the watt-hour, not the gap-interpolated curve.
    readonly _pvChangeSeries: ChangeBucket[] | null;
    //Per-entity histories alongside aggregated `_pvHistory` for per-source curves + tooltip breakdown. Single-source
    //installs carry one entry equal to the aggregate; multi-source carry one per HA Energy source.
    readonly _pvHistoryPerEntity: Map<string, PvHistory>;
    //Hourly LTS series feeding the 5-day forecast calibration. `calibration.ts` prefers this over `_pvHistory` (same
    //window, far fewer rows on high-frequency installs). Null while fetching / empty when not LTS-tracked, then
    //degrades to `_pvHistory`.
    readonly _pvCalibStats:   PvHistory | null;
    readonly _pvUnit:       string;
    readonly _selectedTime: Date | null;
    readonly _isLiveMode:   boolean;
    //Today's produced kWh from the recorder `change` statistic over the `stat_energy_from` arrays. Null when
    //unconfigured or pre-first-call, then the tooltip falls back to trapezoidal integration over `_pvHistory`.
    readonly _haSolarTodayKwh?: number | null;
    //Mutable hover-cursor position as a percent of the visible range (0..100), null when inactive.
    _chartHoverPct:         number | null;
    //Unified 5-day data source, single point of truth for the production + forecast curves. Null only between mount
    //and first build, when the chart degrades to an empty curve.
    readonly _unifiedStore: UnifiedDataStore | null;
    //Battery state-of-charge history over the active range (times + %). Drives the 'battery-soc' chart
    //target, read directly here because the store only carries a live SoC sample at the current bucket.
    readonly _batterySocHistory: { times: Date[]; values: number[] } | null;
    //Custom-entity hourly history (values in W) for the 'custom' target curve. Null when unconfigured.
    readonly _customEntityHistory?: { times: Date[]; values: number[] } | null;
    //Active bottom-chart target. Drives which series renderBottomChart draws; defaults to 'production'.
    readonly _chartTarget?: ChartTarget;
}


//Active theme polarity (hass.themes.darkMode): drives whether the per-source colour ramp brightens or darkens off
//the base solar token. Shared by the PV chart + the tooltip's per-source pastilles.
export const chartIsDark = (host: ChartHost): boolean => !!host.hass?.themes?.darkMode;


//Re-exports keeping every symbol importable from this module, with the render + sampling concerns in sibling files.
export { interpAt, pvValueAtTime } from './series-sample';
export {
    renderTimelineNightZones,
    renderTimelineFutureMask,
    solarBands,
} from './timeline-night';
export {
    renderTimelineHoverTooltip,
    handleChartHoverMove,
    handleChartHoverLeave,
} from './timeline-tooltip';
export { renderPvChart } from './charts-pv';
export {
    renderBottomChart,
    chartAccentColor,
    renderTimelineTicks,
    renderTimelineDayLabels,
    computeDailyKwhTotals,
} from './charts-generic';
