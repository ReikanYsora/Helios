//Stable import surface for the timeline charts: the shared structural types, the friendly-name label helpers many
//modules read off, plus re-exports of the render + sampling concerns living in sibling modules. Charts only read;
//state mutations live elsewhere.

import type { HassLike } from '../core/ha-types';
import { type HeliosConfig, monitoringGroupName } from '../core/config/helios-config';
import { type ChipSlot, chipSlotColor } from '../core/config/chip-appearance';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import type { UnifiedDataStore } from '../data/unifiedStore';
import type { ChangeBucket } from '../data/sources/energy-stats';
import { ENERGY_COLOR, lerpHexToward } from '../core/format/format';


//Engine-resampled weather series, pushed to the card on every refresh.
export interface ChartSeries
{
    times:        Date[];
    irradiance:   number[];
    //Hourly low / mid / high cloud cover (%), overlaid on the timeline's irradiance view (three altitude bands).
    cloudLow:     number[];
    cloudMid:     number[];
    cloudHigh:    number[];
    //Hourly outdoor temperature (°C) + relative humidity (%); NaN where the model/sensor gave no value.
    temperature:  number[];
    humidity:     number[];
}

//Monitoring-group chart targets (one per group 1..4): the chart draws one curve per device of the group.
export const GROUP_TARGETS = ['group-1', 'group-2', 'group-3', 'group-4'] as const;
export type GroupTarget = typeof GROUP_TARGETS[number];

//Re-targetable bottom-chart target: the single series-set the chart draws at a time. 'production' (default) adds
//the dashed forecast + per-source breakdown; 'grid'/'battery' draw two-direction flows (accent = dominant side);
//'irradiance' draws W/m2 on a fixed 0..1000 scale; 'group-N' draws the group's per-device consumption curves.
export type ChartTarget = 'production' | 'consumption' | 'grid' | 'battery' | 'battery-soc' | 'irradiance' | 'temperature' | 'humidity' | 'cost' | GroupTarget;

//How a day-curve strand takes its colour, resolved live against the theme by resolveStrandColour so a theme flip
//is never baked into the data memo. `token` is a fixed chip-slot colour (production, grid import/export, ...);
//`device` a group device's dashboard colour by index; `flow` a per-slot battery tint (charge / discharge / idle).
export type StrandFlowDir = 'charge' | 'discharge' | 'idle';
export type StrandColour =
    | { kind: 'token';   token: ChipSlot }
    | { kind: 'device';  index: number }
    | { kind: 'solar';   index: number }
    | { kind: 'grid';    index: number; dir: 'import' | 'export' }
    | { kind: 'battery'; index: number; dir: 'charge' | 'discharge' }
    | { kind: 'flow';    dir: (StrandFlowDir | null)[] };

//Group target helpers: build a target from a group number, test one, and read its group number (0 when not a group).
export function groupTarget(n: number): GroupTarget
{
    return `group-${n}` as GroupTarget;
}
export function isGroupTarget(t: ChartTarget | undefined): t is GroupTarget
{
    return typeof t === 'string' && t.startsWith('group-');
}
export function groupOfTarget(t: ChartTarget | undefined): number
{
    return isGroupTarget(t) ? Number(t.slice(6)) : 0;
}

//Friendly name of the first configured entity in a stat list (the HA Energy dashboard's own name), for a tooltip
//row. Empty when none is configured.
export function statFriendly(host: ChartHost, ids: string[]): string
{
    const id = ids[0];
    return id ? String(host.hass?.states?.[id]?.attributes?.friendly_name ?? id) : '';
}

//Canonical per-source PV name: the HA Energy solar source's energy meter (stat_energy_from), by source index. Single
//source of the per-string name so the period aggregation and the timeline label agree on the same `index`; the
//rate/meter arrays are parallel per source, so this stays aligned as long as nothing re-sorts.
export function solarSourceName(host: ChartHost, index: number): string
{
    const id = host._energyDefaults.solarStatEnergyFroms[index];
    return id ? String(host.hass?.states?.[id]?.attributes?.friendly_name ?? id) : `PV ${index + 1}`;
}

//Directional energy names, so the detail panel + timeline tooltips never diverge: the user-given source name
//from the dashboard settings when one exists, else the meter's friendly name (the direction stays
//readable through each row's icon and colour).
export function gridImportName(host: ChartHost):      string
{
    return host._energyDefaults.gridName    || statFriendly(host, host._energyDefaults.gridStatEnergyFroms);
}
export function gridExportName(host: ChartHost):      string
{
    return host._energyDefaults.gridName    || statFriendly(host, host._energyDefaults.gridStatEnergyTos);
}
export function batteryChargeName(host: ChartHost):   string
{
    return host._energyDefaults.batteryName || statFriendly(host, host._energyDefaults.batteryStatEnergyTos);
}
export function batteryDischargeName(host: ChartHost): string
{
    return host._energyDefaults.batteryName || statFriendly(host, host._energyDefaults.batteryStatEnergyFroms);
}

//Per-source grid / battery name, resolved by index the same way solarSourceName is: the meter's HA friendly name for
//that source and direction, falling back to the statistic id, then a generic label. Only the multi-source breakdown
//rows use these, so a single-source install (which still reads gridName / batteryName above) is untouched.
export function gridSourceName(host: ChartHost, index: number, dir: 'import' | 'export'): string
{
    const ed = host._energyDefaults;
    const id = (dir === 'import' ? ed.gridStatEnergyFroms : ed.gridStatEnergyTos)[index];
    return id ? String(host.hass?.states?.[id]?.attributes?.friendly_name ?? id) : `Grid ${index + 1}`;
}
export function batterySourceName(host: ChartHost, index: number, dir: 'charge' | 'discharge'): string
{
    const ed = host._energyDefaults;
    //Prefer the Energy dashboard's configured per-source name; else the meter friendly name, then a generic.
    const configured = ed.batteryNames[index];
    if (configured)
    {
        return configured;
    }
    const id = (dir === 'charge' ? ed.batteryStatEnergyTos : ed.batteryStatEnergyFroms)[index];
    return id ? String(host.hass?.states?.[id]?.attributes?.friendly_name ?? id) : `Battery ${index + 1}`;
}

//Metric name for a tooltip row / rail title. en + fr; other locales fall back to en. Group targets take their
//editable name (or "Group N"); everything else comes from here or from statFriendly.
const TARGET_LABELS_EN: Record<Exclude<ChartTarget, GroupTarget>, string> = {
    production: 'Production', consumption: 'Consumption', grid: 'Grid', battery: 'Battery',
    'battery-soc': 'Battery charge', irradiance: 'Irradiance', temperature: 'Temperature', humidity: 'Humidity',
    cost: 'Cost',
};
const TARGET_LABELS_FR: Record<Exclude<ChartTarget, GroupTarget>, string> = {
    production: 'Production', consumption: 'Consommation', grid: 'Réseau', battery: 'Batterie',
    'battery-soc': 'Charge batterie', irradiance: 'Irradiance', temperature: 'Température', humidity: 'Humidité',
    cost: 'Coût',
};
export function targetLabel(host: ChartHost, target: ChartTarget): string
{
    const lang = String(host.hass?.language ?? '').toLowerCase();
    if (isGroupTarget(target))
    {
        const n = groupOfTarget(target);
        return monitoringGroupName(host.config, n) || `${lang.startsWith('fr') ? 'Groupe' : 'Group'} ${n}`;
    }
    return (lang.startsWith('fr') ? TARGET_LABELS_FR : TARGET_LABELS_EN)[target];
}

//Structural surface the host card exposes. `_chartHoverPct` is intentionally writable (hover handlers mutate it on
//pointermove/leave); every other field stays read-only.
export interface ChartHost
{
    readonly config:         HeliosConfig | undefined;
    readonly hass:           HassLike;
    readonly _energyDefaults: EnergyDefaults;
    readonly _timeRange:    { start: Date; end: Date } | null;
    readonly _chartSeries:  ChartSeries | null;
    //Recorder `change` series (recorder-period buckets) for the solar meter(s). sumChangeForDay sums exact per-day kWh so
    //totals match HA Energy to the watt-hour, not the gap-interpolated curve.
    readonly _pvChangeSeries: ChangeBucket[] | null;
    //Per-source recorder `change` series keyed by energy meter (`stat_energy_from`), for the period aggregation's
    //per-source split at exact dashboard energy. Empty on single-source installs (the aggregate already covers it) or pre-fetch.
    readonly _pvChangeSeriesPerEntity: Map<string, ChangeBucket[]>;
    readonly _selectedTime: Date | null;
    readonly _isLiveMode:   boolean;
    //Today's produced kWh from the recorder `change` statistic over the `stat_energy_from` arrays. Null when
    //unconfigured or pre-first-call.
    readonly _haSolarTodayKwh?: number | null;
    //Mutable hover-cursor position as a percent of the visible range (0..100), null when inactive.
    _chartHoverPct:         number | null;
    //Unified rolling-window data source, single point of truth for the production + forecast curves. Null only between mount
    //and first build, when the chart degrades to an empty curve.
    readonly _unifiedStore: UnifiedDataStore | null;
    //Cost + compensation `change` series (net money per bucket), for the cost target's curve (any tariff). Null
    //until fetched or when no cost statistic is configured.
    readonly _costImportSeries: ChangeBucket[] | null;
    readonly _costExportSeries: ChangeBucket[] | null;
    //Battery state-of-charge history over the active range (times + %). Drives the 'battery-soc' chart
    //target, read directly here because the store only carries a live SoC sample at the current bucket.
    readonly _batterySocHistory: { times: Date[]; values: number[] } | null;
    //Raw per-bank SoC series (fetch order) for the battery chart's per-bank lines. Empty on a single-bank install.
    readonly _batterySocPerBankHistory: { times: Date[]; values: number[] }[];
    //Per-device recorder `change` series (statConsumption id -> buckets) for the grouped + visible devices, feeding
    //the monitoring-group chart curves. Empty when no device is grouped.
    readonly _deviceChangeSeries: Map<string, ChangeBucket[]>;
    //Per-source recorder `change` series for grid (import/export) and battery (charge/discharge), keyed by energy
    //meter (config order), for the multi-source stacked breakdown. Empty on single-source installs.
    readonly _gridImportChangeSeriesPerEntity: Map<string, ChangeBucket[]>;
    readonly _gridExportChangeSeriesPerEntity: Map<string, ChangeBucket[]>;
    readonly _batteryChargeChangeSeriesPerEntity: Map<string, ChangeBucket[]>;
    readonly _batteryDischargeChangeSeriesPerEntity: Map<string, ChangeBucket[]>;
    //Active bottom-chart target. Drives which series renderBottomChart draws; defaults to 'production'.
    readonly _chartTarget?: ChartTarget;
}


//Active theme polarity (hass.themes.darkMode): drives whether the per-source colour ramp brightens or darkens off
//the base solar token. Shared by the PV chart + the tooltip's per-source pastilles.
export const chartIsDark = (host: ChartHost): boolean => !!host.hass?.themes?.darkMode;


//Theme-aware "ghost forecast" colour for the irradiance view: the irradiance chip colour pushed toward white on a
//dark theme, black on light, so the dashed forecast silhouette (and its hover dot / tooltip rows) clearly separates
//from the near-identical amber fill under it. Shared by the chart and the tooltip so the two never drift apart.
export function irradianceForecastColor(host: ChartHost): string
{
    const el = host as unknown as Element; //live HA theme-token colour resolution
    const irradColor = chipSlotColor(el, host.config, 'irradiance');
    return chartIsDark(host)
        ? lerpHexToward(irradColor, '#ffffff', 0.75)
        : lerpHexToward(irradColor, '#000000', 0.55);
}

//The three cloud-band tints (low/mid/high altitude), lerped off the base cloud token with the same fractions
//everywhere they're drawn: shared by the chart's stacked overlay bands and the tooltip's three cloud rows so
//they track each other by construction.
export function cloudBandColors(el: Element | null | undefined): { low: string; mid: string; high: string }
{
    const base = ENERGY_COLOR.cloud(el);
    return {
        low:  lerpHexToward(base, '#ffffff', 0.55),
        mid:  base,
        high: lerpHexToward(base, '#000000', 0.50),
    };
}

//Multi-source breakdown eligibility: 2+ configured sources, each with its own recorder change series fetched.
//Below that the aggregate (or lone-entry) view is exact and a per-source breakdown would be redundant or
//partly blank, so callers fall back to the aggregate curve/row instead.
export function hasMultiSourceBreakdown(ids: readonly string[], map: ReadonlyMap<string, ChangeBucket[]>): boolean
{
    return ids.length >= 2 && ids.every((id) => map.has(id));
}


//Re-exports keeping the render concerns importable from this module, with the implementations in sibling files.
export {
    renderTimelineNightZones,
    renderTimelineFutureMask,
} from '../timeline/timeline-overlays';
export {
    renderTimelineHoverTooltip,
    onChartHoverMove,
    onChartHoverLeave,
} from '../timeline/timeline-tooltip';
export {
    renderBottomChart,
    chartAccentColor,
    resolveStrandColour,
    renderTimelineTicks,
    renderTimelineDayLabels,
} from './charts-generic';
