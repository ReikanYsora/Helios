//Per-chip detail panel (scene mode): tapping a chip opens a compact, vertical readout top-right that
//aggregates the active metric over the selected window. Every energy figure is computed with the SAME method the
//period aggregation uses for its total (buildPeriodData -> layerPeriodTotal / periodTotal), so the panel and the
//dashboard always agree, on every period (day .. year), not just the rolling store window.

import type { TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import { formatEnergyKwh, formatIrradiance } from '../core/format/format';
import { powerUnit, valueDecimals, irradianceUnit } from '../core/config/helios-config';
import { buildPeriodData, layerPeriodTotal, periodTotal, hourlyOf, type PeriodHost, type PeriodData } from '../data/period-totals/period-totals';
import { type ChartTarget, isGroupTarget, groupOfTarget } from '../charts/charts';
import { groupDevices, deviceName, deviceWindowKwh } from '../data/sources/device-consumption';
import type { SunScene } from './hud';
import { DAY_MS } from '../core/config/constants';

//The panel reads exactly what the period aggregation reads (PeriodHost) plus the sun scene for the astro rows.
export interface DetailHost extends PeriodHost
{
    readonly _sunScene: SunScene | null;
}

interface DetailMetric
{
    value: string;
    //Astro / energy rows carry a leading glyph; per-device (group) rows drop the icon and just show the name.
    icon?:  string;
    label?: string;
}

//Number of whole days the window spans, for the per-day averages. At least 1 so a same-day window never divides
//by zero.
function windowDays(startMs: number, endMs: number): number
{
    return Math.max(1, Math.round((endMs - startMs) / DAY_MS));
}

//Min / mean / max over a store watt-array inside the window, for the weather metric (irradiance is not a period
//aggregation metric, so it keeps its own aggregation over the store's own window).
function aggWatts(store: NonNullable<PeriodHost['_unifiedStore']>, arr: readonly (number | null)[], startMs: number, endMs: number):
    { peak: number; avg: number; count: number }
{
    let peak = 0;
    let sum  = 0;
    let count = 0;
    for (let i = 0; i < arr.length; i++)
    {
        const raw = arr[i];
        if (raw === null || !isFinite(raw)) { continue; }
        const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
        if (tMs < startMs || tMs > endMs) { continue; }
        if (raw > peak) { peak = raw; }
        sum += raw;
        count++;
    }
    return { peak, avg: count ? sum / count : 0, count };
}

//Min / mean / max over a percent PeriodData layer's 24 hour-of-day values (state of charge). Empty when there is
//no history in the window.
function socStats(data: PeriodData): { min: number; avg: number; max: number } | null
{
    const layer = data.layers[0];
    if (!layer) { return null; }
    const hv = hourlyOf(layer.values, false);
    let min = Infinity;
    let max = 0;
    let sum = 0;
    let count = 0;
    for (const v of hv)
    {
        if (!isFinite(v)) { continue; }
        if (v < min) { min = v; }
        if (v > max) { max = v; }
        sum += v;
        count++;
    }
    if (!count) { return null; }
    return { min, avg: sum / count, max };
}

//Local clock (HH:MM) in the user's language. Day length as Hh MM with a padded minute.
function formatClock(hass: unknown, d: Date): string
{
    const lang = (hass as { locale?: { language?: string } } | undefined)?.locale?.language ?? 'en';
    return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

function formatDayLength(ms: number): string
{
    const totalMin = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
}

//Build the metric rows for the active target. Returns [] when there is nothing to aggregate yet (no window, or
//the period data has not resolved), so the caller can drop the panel entirely.
function buildMetrics(host: DetailHost, target: ChartTarget): DetailMetric[]
{
    const range = host._timeRange;
    if (!range) { return []; }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    if (endMs <= startMs) { return []; }

    const hass = host.hass;
    const dec  = valueDecimals(host.config);
    const pu   = powerUnit(host.config);
    const iu   = irradianceUnit(host.config);
    const days = windowDays(startMs, endMs);
    const energy = (kwh: number): string => formatEnergyKwh(hass, kwh, dec, pu);

    //Irradiance is weather, not a period aggregation metric: aggregate the store's own W/m2 series + read the astro
    //from the sun scene. Everything else routes through buildPeriodData so it matches the period total exactly.
    if (target === 'irradiance')
    {
        const store = host._unifiedStore;
        const irr   = (w: number): string => formatIrradiance(hass, w, dec, iu);
        const rows: DetailMetric[] = [];
        if (store)
        {
            const a = aggWatts(store, store.irradiance, startMs, endMs);
            rows.push(
                { icon: 'mdi:trending-up',         value: irr(a.peak) },
                { icon: 'mdi:approximately-equal', value: irr(a.avg) },
            );
        }
        const scene = host._sunScene;
        if (scene && scene.sunrise && scene.sunset)
        {
            const rise = scene.sunrise.time;
            const set  = scene.sunset.time;
            const noon = new Date((rise.getTime() + set.getTime()) / 2);
            let maxAlt = 0;
            for (const s of scene.arc) { if (s.altitude > maxAlt) { maxAlt = s.altitude; } }
            rows.push(
                { icon: 'mdi:weather-sunset-up',   value: formatClock(hass, rise) },
                { icon: 'mdi:weather-sunny',       value: formatClock(hass, noon) },
                { icon: 'mdi:weather-sunset-down', value: formatClock(hass, set) },
                { icon: 'mdi:angle-acute',         value: `${Math.round(maxAlt)}°` },
                { icon: 'mdi:timelapse',           value: formatDayLength(set.getTime() - rise.getTime()) },
            );
        }
        return rows;
    }

    //Monitoring group: one row per visible device of the group, its total consumption over the window (same
    //magnitude the chart curves show), shown as the device name + total (no icon, to save width).
    if (isGroupTarget(target))
    {
        const devs = groupDevices(host.config, host._energyDefaults, groupOfTarget(target));
        return devs.map(dev => ({
            label: deviceName(host.hass, dev),
            value: energy(deviceWindowKwh(host._deviceChangeSeries.get(dev.statConsumption), startMs, endMs)),
        }));
    }

    const data = buildPeriodData(host, target);

    if (target === 'battery-soc')
    {
        const s = socStats(data);
        if (!s) { return []; }
        const pct = (v: number): string => `${Math.round(v)} %`;
        return [
            { icon: 'mdi:arrow-down',          value: pct(s.min) },
            { icon: 'mdi:approximately-equal', value: pct(s.avg) },
            { icon: 'mdi:arrow-up',            value: pct(s.max) },
        ];
    }

    //Every remaining target is an energy metric. No layers yet (pre-fetch, or month/year before the hourly
    //profile lands) -> nothing to show.
    if (!data.layers.length) { return []; }

    if (target === 'grid')
    {
        //Layer order from buildPeriodData: [import, export].
        const imp = layerPeriodTotal(data.layers[0], data);
        const exp = data.layers[1] ? layerPeriodTotal(data.layers[1], data) : 0;
        const net = imp - exp;
        const netStr = `${net < 0 ? '-' : ''}${energy(Math.abs(net))}`;
        return [
            { icon: 'mdi:transmission-tower-import', value: energy(imp) },
            { icon: 'mdi:transmission-tower-export', value: energy(exp) },
            { icon: 'mdi:scale-balance',             value: netStr },
            { icon: 'mdi:calendar-today',            value: energy(imp / days) },
        ];
    }

    if (target === 'battery')
    {
        //Layer order from buildPeriodData: [discharge, charge].
        const discharged = layerPeriodTotal(data.layers[0], data);
        const charged    = data.layers[1] ? layerPeriodTotal(data.layers[1], data) : 0;
        return [
            { icon: 'mdi:battery-arrow-down', value: energy(charged) },
            { icon: 'mdi:battery-arrow-up',   value: energy(discharged) },
        ];
    }

    //production, consumption: one grand total (all layers) + its per-day average.
    const total = periodTotal(data);
    return [
        { icon: 'mdi:sigma',          value: energy(total) },
        { icon: 'mdi:calendar-today', value: energy(total / days) },
    ];
}

//Render the detail panel for the active chip, or nothing when there is no data. The accent (--detail-accent) is
//inherited from the card so the border + badge tint always match the chip's live colour.
export function renderDetailPanel(host: DetailHost): TemplateResult | typeof nothing
{
    const target = host._chartTarget ?? 'production';
    const metrics = buildMetrics(host, target);
    if (!metrics.length)
    {
        return nothing;
    }
    return html`
        <div class="detail-panel">
            ${metrics.map(m => html`
                <div class="dp-row ${m.label ? 'dp-row-device' : ''}">
                    ${m.label
                        ? html`<span class="dp-label">${m.label}</span>`
                        : html`<ha-icon icon=${m.icon}></ha-icon>`}
                    <span class="dp-value">${m.value}</span>
                </div>
            `)}
        </div>
    `;
}
