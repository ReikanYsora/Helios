//Per-chip detail panel (scene mode): double-tapping a chip opens a compact, vertical readout top-right that
//aggregates the active metric over the selected window. Icons only, values in the card's configured unit. The
//aggregates mirror the bottom-chart series builders in charts-generic so panel and curve always agree.

import type { TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import { formatPower, formatEnergyKwh, formatIrradiance } from './format';
import { powerUnit, valueDecimals, irradianceUnit } from '../helios-config';
import type { ChartHost, ChartTarget } from './charts';
import type { ChangeBucket } from './energy-stats';
import type { SunScene } from './hud';
import { HOUR_MS, DAY_MS } from '../constants';

//Extra host reads beyond ChartHost: the directional change series and the sun scene the panel needs for grid /
//battery totals and the astro rows.
export interface DetailHost extends ChartHost
{
    readonly _gridImportChangeSeries:      ChangeBucket[] | null;
    readonly _gridExportChangeSeries:      ChangeBucket[] | null;
    readonly _batteryChargeChangeSeries:   ChangeBucket[] | null;
    readonly _batteryDischargeChangeSeries: ChangeBucket[] | null;
    readonly _sunScene:                    SunScene | null;
}

interface DetailMetric
{
    icon:  string;
    value: string;
}

//Sum a recorder change series (kWh) over the window, bucket centre inside [startMs, endMs].
function sumChangeKwh(buckets: ChangeBucket[] | null, startMs: number, endMs: number): number
{
    if (!buckets)
    {
        return 0;
    }
    let s = 0;
    for (const b of buckets)
    {
        const tMs = (b.startMs + b.endMs) / 2;
        if (tMs < startMs || tMs > endMs) { continue; }
        if (isFinite(b.kwh)) { s += b.kwh; }
    }
    return s;
}

interface WattAgg
{
    peak:  number;
    min:   number;
    avg:   number;
    count: number;
}

//Peak / min / mean over a store watt-array inside the window. Bucket centre matches charts-generic so the panel
//reads the exact samples the curve draws. `map` folds signed series (e.g. battery) to a single flow.
function aggWatts(
    store:  NonNullable<ChartHost['_unifiedStore']>,
    arr:    readonly (number | null)[],
    startMs: number,
    endMs:  number,
    map?:   (v: number) => number,
): WattAgg
{
    let peak = 0;
    let min  = Infinity;
    let sum  = 0;
    let count = 0;
    for (let i = 0; i < arr.length; i++)
    {
        const raw = arr[i];
        if (raw === null || !isFinite(raw)) { continue; }
        const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
        if (tMs < startMs || tMs > endMs) { continue; }
        const v = map ? map(raw) : raw;
        if (v > peak) { peak = v; }
        if (v < min)  { min = v; }
        sum += v;
        count++;
    }
    return { peak, min: count ? min : 0, avg: count ? sum / count : 0, count };
}

//Derived home-consumption per bucket (same formula as the consumption curve): production + import - export - net
//battery, clamped at 0. Buckets with no measured source are skipped so a gap stays a gap. Returns the window peak
//watts and total kWh (no meter to sum, so it is integrated from the derived watts).
function consumptionAgg(store: NonNullable<ChartHost['_unifiedStore']>, startMs: number, endMs: number):
    { peak: number; totalKwh: number }
{
    let peak = 0;
    let kwh  = 0;
    for (let i = 0; i < store.production.length; i++)
    {
        const p  = store.production[i];
        const gi = store.gridImport[i];
        const ge = store.gridExport[i];
        const b  = store.battery[i];
        if (p === null && gi === null && ge === null && b === null) { continue; }
        const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
        if (tMs < startMs || tMs > endMs) { continue; }
        const v = Math.max(0, (p ?? 0) + (gi ?? 0) - (ge ?? 0) - (b ?? 0));
        if (v > peak) { peak = v; }
        //watts * (bucket hours) = watt-hours; /1000 to kWh (no meter to sum, so it is integrated from the watts).
        kwh += (v * store.stepMs) / HOUR_MS / 1000;
    }
    return { peak, totalKwh: kwh };
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

//Build the metric rows for the active target. Returns [] when there is nothing to aggregate (no store / no data),
//so the caller can drop the panel entirely.
function buildMetrics(host: DetailHost, target: ChartTarget): DetailMetric[]
{
    const store = host._unifiedStore;
    const range = host._timeRange;
    if (!store || !range)
    {
        return [];
    }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    const rangeMs = endMs - startMs;
    if (rangeMs <= 0)
    {
        return [];
    }
    const hass = host.hass;
    const dec  = valueDecimals(host.config);
    const pu   = powerUnit(host.config);
    const iu   = irradianceUnit(host.config);
    const days = Math.max(1, Math.round(rangeMs / DAY_MS));
    const power  = (w: number): string => formatPower(hass, w, dec, pu);
    const energy = (kwh: number): string => formatEnergyKwh(hass, kwh, dec, pu);

    if (target === 'production')
    {
        const a   = aggWatts(store, store.production, startMs, endMs);
        const tot = sumChangeKwh(host._pvChangeSeries, startMs, endMs);
        return [
            { icon: 'mdi:sigma',         value: energy(tot) },
            { icon: 'mdi:trending-up',   value: power(a.peak) },
            { icon: 'mdi:calendar-today', value: energy(tot / days) },
        ];
    }

    if (target === 'consumption')
    {
        const a = consumptionAgg(store, startMs, endMs);
        return [
            { icon: 'mdi:sigma',          value: energy(a.totalKwh) },
            { icon: 'mdi:trending-up',    value: power(a.peak) },
            { icon: 'mdi:calendar-today', value: energy(a.totalKwh / days) },
        ];
    }

    if (target === 'grid')
    {
        const imp = sumChangeKwh(host._gridImportChangeSeries, startMs, endMs);
        const exp = sumChangeKwh(host._gridExportChangeSeries, startMs, endMs);
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
        const charged    = sumChangeKwh(host._batteryChargeChangeSeries, startMs, endMs);
        const discharged = sumChangeKwh(host._batteryDischargeChangeSeries, startMs, endMs);
        return [
            { icon: 'mdi:battery-arrow-down', value: energy(charged) },
            { icon: 'mdi:battery-arrow-up',   value: energy(discharged) },
        ];
    }

    if (target === 'battery-soc')
    {
        const hist = host._batterySocHistory;
        let min = Infinity;
        let max = 0;
        let sum = 0;
        let count = 0;
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const tMs = hist.times[i].getTime();
                if (tMs < startMs || tMs > endMs) { continue; }
                const v = hist.values[i];
                if (v === undefined || !isFinite(v)) { continue; }
                if (v < min) { min = v; }
                if (v > max) { max = v; }
                sum += v;
                count++;
            }
        }
        if (!count)
        {
            return [];
        }
        const pct = (v: number): string => `${Math.round(v)} %`;
        return [
            { icon: 'mdi:arrow-down',           value: pct(min) },
            { icon: 'mdi:approximately-equal',  value: pct(sum / count) },
            { icon: 'mdi:arrow-up',             value: pct(max) },
        ];
    }

    if (target === 'irradiance')
    {
        const a    = aggWatts(store, store.irradiance, startMs, endMs);
        const irr  = (w: number): string => formatIrradiance(hass, w, dec, iu);
        const rows: DetailMetric[] = [
            { icon: 'mdi:trending-up',          value: irr(a.peak) },
            { icon: 'mdi:approximately-equal',  value: irr(a.avg) },
        ];
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

    //custom: totals from the change series, watts from kWh/bucket -> average watts, like the custom curve.
    const tot = sumChangeKwh(host._customChangeSeries ?? null, startMs, endMs);
    let peak = 0;
    let min  = Infinity;
    let sum  = 0;
    let count = 0;
    const buckets = host._customChangeSeries;
    if (buckets)
    {
        for (const b of buckets)
        {
            const durMs = b.endMs - b.startMs;
            if (durMs <= 0) { continue; }
            const tMs = (b.startMs + b.endMs) / 2;
            if (tMs < startMs || tMs > endMs) { continue; }
            if (!isFinite(b.kwh)) { continue; }
            const w = Math.abs((b.kwh * HOUR_MS) / durMs);
            if (w > peak) { peak = w; }
            if (w < min)  { min = w; }
            sum += w;
            count++;
        }
    }
    if (!count)
    {
        return [{ icon: 'mdi:sigma', value: energy(tot) }];
    }
    return [
        { icon: 'mdi:sigma',               value: energy(tot) },
        { icon: 'mdi:arrow-down',          value: power(min) },
        { icon: 'mdi:approximately-equal', value: power(sum / count) },
        { icon: 'mdi:arrow-up',            value: power(peak) },
    ];
}

//Render the detail panel for the active chip, or nothing when there is no data. The accent (--detail-accent)
//is inherited from the card so the border + badge tint always match the chip's live colour, including the
//instantaneous flip of the directional grid / battery chips.
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
                <div class="dp-row">
                    <ha-icon icon=${m.icon}></ha-icon>
                    <span>${m.value}</span>
                </div>
            `)}
        </div>
    `;
}
