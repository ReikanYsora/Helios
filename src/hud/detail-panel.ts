//Per-chip detail panel (scene mode): tapping a chip opens a compact, vertical readout top-right that
//aggregates the active metric over the selected window. Every energy figure is computed with the SAME method the
//period aggregation uses for its total (buildPeriodData -> layerPeriodTotal / periodTotal), so the panel and the
//dashboard always agree, on every period (day .. year), not just the rolling store window.

import type { TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import { formatEnergyKwh, formatIrradiance, formatTemperature } from '../core/format/format';
import { energyUnit, valueDecimals, irradianceUnit } from '../core/config/helios-config';
import { chipSlotIcon } from '../core/config/chip-appearance';
import { buildPeriodData, layerPeriodTotal, periodTotal, hourlyOf, type PeriodHost, type PeriodData } from '../data/period-totals/period-totals';
import { type ChartTarget, isGroupTarget, groupOfTarget } from '../charts/charts';
import { groupDevices, deviceName, deviceWindowKwh } from '../data/sources/device-consumption';
import type { SunScene } from './hud';
import { DAY_MS } from '../core/config/constants';
import { pickTranslations } from '../core/i18n';
import type { TimelineMode } from '../timeline/timeline-modes';

//The panel reads exactly what the period aggregation reads (PeriodHost) plus the sun scene for the astro rows.
export interface DetailHost extends PeriodHost
{
    readonly _sunScene: SunScene | null;
    //The active rolling-period mode, shown as the panel title so the aggregates read as "over this period".
    readonly _timelineMode: TimelineMode;
}

interface DetailMetric
{
    value: string;
    //Energy / astro rows carry a leading MDI icon; averages use the Ø text glyph; per-device (group) rows drop
    //both and just show the name.
    icon?:  string;
    glyph?: string;
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
        if (raw === null || !isFinite(raw))
        {
            continue;
        }
        const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
        if (tMs < startMs || tMs > endMs)
        {
            continue;
        }
        if (raw > peak)
        {
            peak = raw;
        }
        sum += raw;
        count++;
    }
    return { peak, avg: count ? sum / count : 0, count };
}

//Min / mean / max over a store series inside the window, allowing negative values (temperature). Same bucket-time
//iteration as aggWatts.
function aggRange(store: NonNullable<PeriodHost['_unifiedStore']>, arr: readonly (number | null)[], startMs: number, endMs: number):
    { min: number; avg: number; max: number; count: number }
{
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < arr.length; i++)
    {
        const raw = arr[i];
        if (raw === null || !isFinite(raw))
        {
            continue;
        }
        const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
        if (tMs < startMs || tMs > endMs)
        {
            continue;
        }
        if (raw < min)
        {
            min = raw;
        }
        if (raw > max)
        {
            max = raw;
        }
        sum += raw;
        count++;
    }
    return { min: count ? min : 0, avg: count ? sum / count : 0, max: count ? max : 0, count };
}

//Min / mean / max over a percent PeriodData layer's 24 hour-of-day values (state of charge). Empty when there is
//no history in the window.
function socStats(data: PeriodData): { min: number; avg: number; max: number } | null
{
    const layer = data.layers[0];
    if (!layer)
    {
        return null;
    }
    const hv = hourlyOf(layer.values, false);
    let min = Infinity;
    let max = 0;
    let sum = 0;
    let count = 0;
    for (const v of hv)
    {
        if (!isFinite(v))
        {
            continue;
        }
        if (v < min)
        {
            min = v;
        }
        if (v > max)
        {
            max = v;
        }
        sum += v;
        count++;
    }
    if (!count)
    {
        return null;
    }
    return { min, avg: sum / count, max };
}

//Build the metric rows for the active target. Returns [] when there is nothing to aggregate yet (no window, or
//the period data has not resolved), so the caller can drop the panel entirely.
function buildMetrics(host: DetailHost, target: ChartTarget): DetailMetric[]
{
    const range = host._timeRange;
    if (!range)
    {
        return [];
    }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    if (endMs <= startMs)
    {
        return [];
    }

    const hass = host.hass;
    const dec  = valueDecimals(host.config);
    const eu   = energyUnit(host.config);
    const iu   = irradianceUnit(host.config);
    const days = windowDays(startMs, endMs);
    const energy = (kwh: number): string => formatEnergyKwh(hass, kwh, dec, eu);

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
                { icon: 'mdi:trending-up', value: irr(a.peak) },
                { glyph: 'Ø',              value: irr(a.avg) },
            );
        }
        return rows;
    }

    //Temperature / humidity are weather metrics like irradiance: aggregate the store's own series over the window
    //as max / mean / min (temperature keeps its sign; humidity is a percent).
    if (target === 'temperature' || target === 'humidity')
    {
        const store = host._unifiedStore;
        const rows: DetailMetric[] = [];
        if (store)
        {
            const arr = target === 'temperature' ? store.temperature : store.humidity;
            const a   = aggRange(store, arr, startMs, endMs);
            if (a.count > 0)
            {
                const fmt = target === 'temperature'
                    ? (v: number): string => formatTemperature(hass, v)
                    : (v: number): string => `${Math.round(v)} %`;
                rows.push(
                    { icon: 'mdi:trending-up',   value: fmt(a.max) },
                    { glyph: 'Ø',                value: fmt(a.avg) },
                    { icon: 'mdi:trending-down', value: fmt(a.min) },
                );
            }
        }
        return rows;
    }

    //Cost: total money over the window, summed from HA's cost statistics (import cost minus export compensation).
    //Spent / earned / net / per-day, in the user's currency. Absent when no cost statistic is loaded.
    if (target === 'cost')
    {
        if (!host._costImportSeries && !host._costExportSeries)
        {
            return [];
        }
        const cur = String(hass?.config?.currency ?? '€');
        const money = (v: number): string =>
            `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
        const sumWin = (s: { startMs: number; kwh: number }[] | null): number =>
            (s ?? []).reduce((acc, b) => (b.startMs >= startMs && b.startMs < endMs ? acc + b.kwh : acc), 0);
        const spent  = sumWin(host._costImportSeries);
        const earned = sumWin(host._costExportSeries);
        const net    = spent - earned;
        const rows: DetailMetric[] = [{ icon: 'mdi:cash-minus', value: money(spent) }];
        if (earned > 0)
        {
            rows.push({ icon: 'mdi:cash-plus', value: money(earned) });
        }
        rows.push(
            { icon: 'mdi:scale-balance', value: money(net) },
            { icon: 'mdi:calendar-today', value: money(days > 0 ? net / days : net) },
        );
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
        if (!s)
        {
            return [];
        }
        const pct = (v: number): string => `${Math.round(v)} %`;
        return [
            { icon: 'mdi:arrow-down', value: pct(s.min) },
            { glyph: 'Ø',             value: pct(s.avg) },
            { icon: 'mdi:arrow-up',   value: pct(s.max) },
        ];
    }

    //Every remaining target is an energy metric. No layers yet (pre-fetch, or month/year before the hourly
    //profile lands) -> nothing to show.
    if (!data.layers.length)
    {
        return [];
    }

    //Sum all layers of a flow direction: one layer on a single-source install, several once split per source.
    const dirTotal = (dir: string): number =>
        data.layers.filter((l) => l.dir === dir).reduce((acc, l) => acc + layerPeriodTotal(l, data), 0);

    if (target === 'grid')
    {
        const imp = dirTotal('import');
        const exp = dirTotal('export');
        const net = imp - exp;
        const netStr = `${net < 0 ? '-' : ''}${energy(Math.abs(net))}`;
        return [
            { icon: chipSlotIcon(host.config, 'gridImport'), value: energy(imp) },
            { icon: chipSlotIcon(host.config, 'gridExport'), value: energy(exp) },
            { icon: 'mdi:scale-balance',             value: netStr },
            { icon: 'mdi:calendar-today',            value: energy(imp / days) },
        ];
    }

    if (target === 'battery')
    {
        const discharged = dirTotal('discharge');
        const charged    = dirTotal('charge');
        const rows: DetailMetric[] = [
            { icon: chipSlotIcon(host.config, 'batteryCharge', 'mdi:battery-arrow-down'), value: energy(charged) },
            { icon: chipSlotIcon(host.config, 'batteryDischarge', 'mdi:battery-arrow-up'),   value: energy(discharged) },
        ];

        //Third line: the AVERAGE state of charge over the window. Marked with the same Ø mean glyph the SoC
        //detail panel uses, so it never reads as the live level.
        const soc = socStats(buildPeriodData(host, 'battery-soc'));
        if (soc)
        {
            rows.push({ glyph: 'Ø', value: `${Math.round(soc.avg)} %` });
        }
        return rows;
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
    //Title = the selected rolling period, so the aggregates below read as "over this period", not a live value.
    const t = pickTranslations(host.hass?.language);
    const periodLabel = t.period[host._timelineMode];
    return html`
        <div class="detail-panel">
            ${periodLabel ? html`<div class="dp-title">${periodLabel}</div>` : nothing}
            ${metrics.map(m => html`
                <div class="dp-row ${m.label ? 'dp-row-device' : ''}">
                    ${m.label
        ? html`<span class="dp-label">${m.label}</span>`
        : m.glyph
            ? html`<span class="dp-glyph">${m.glyph}</span>`
            : html`<ha-icon icon=${m.icon}></ha-icon>`}
                    <span class="dp-value">${m.value}</span>
                </div>
            `)}
        </div>
    `;
}
