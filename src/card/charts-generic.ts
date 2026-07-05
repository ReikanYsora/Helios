//Re-targetable bottom chart for everything except production, the target accent colour, the cursor/label axis
//furniture, and per-day kWh aggregation for the day chips. Production has its own renderer in charts-pv.ts.

import type { TemplateResult } from 'lit';
import { html, svg, nothing } from 'lit';
import { ENERGY_COLOR, lerpHexToward, cssHex, uiColorVar } from './format';
import { customEntityColor } from '../helios-config';
import { buildTimelineModel, formatTimelineLabel } from './timeline-model';
import { sumChangeForDay } from './energy-stats';
import type { ChartHost, ChartTarget } from './charts';
import { interpAt } from './series-sample';
import { sliceForRange } from './unifiedStore';
import { renderPvChart } from './charts-pv';
import { HOUR_MS } from '../constants';


//Production routes to its dedicated renderer (forecast + per-source breakdown + native-unit scaling); every
//other target goes through the generic renderer below.
export function renderBottomChart(host: ChartHost): TemplateResult
{
    const target = host._chartTarget ?? 'production';
    if (target === 'production')
    {
        return renderPvChart(host);
    }
    return renderTargetChart(host, target);
}


//Accent colour for the active target, shared by chart border and active chip so re-targeting reads as one gesture.
//Production/irradiance/cloud/soc are fixed; grid/battery take the colour of whichever side dominates the window.
export function chartAccentColor(host: ChartHost): string
{
    const el = host as unknown as Element; //live HA theme-token colour resolution
    const target = host._chartTarget ?? 'production';
    if (target === 'production') { return ENERGY_COLOR.pv(el); }
    if (target === 'consumption'){ return ENERGY_COLOR.consumption(el); }
    if (target === 'irradiance') { return ENERGY_COLOR.sun(el); }
    if (target === 'battery-soc'){ return ENERGY_COLOR.batteryOut(el); }
    if (target === 'custom')     { return cssHex(el, uiColorVar(customEntityColor(host.config), 'red'), '#f44336'); }
    const store = host._unifiedStore;
    const range = host._timeRange;
    if (!store || !range)
    {
        return target === 'grid' ? ENERGY_COLOR.gridImport(el) : ENERGY_COLOR.batteryOut(el);
    }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    const sumArr = (arr: readonly (number | null)[], map?: (v: number) => number): number =>
    {
        let s = 0;
        for (let i = 0; i < arr.length; i++)
        {
            const raw = arr[i];
            if (raw === null || !isFinite(raw)) { continue; }
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs < startMs || tMs > endMs) { continue; }
            s += map ? map(raw) : raw;
        }
        return s;
    };
    if (target === 'grid')
    {
        return sumArr(store.gridImport) >= sumArr(store.gridExport)
            ? ENERGY_COLOR.gridImport(el)
            : ENERGY_COLOR.gridExport(el);
    }
    return sumArr(store.battery, v => Math.max(0, v)) >= sumArr(store.battery, v => Math.max(0, -v))
        ? ENERGY_COLOR.batteryIn(el)
        : ENERGY_COLOR.batteryOut(el);
}


//Generic chart for the non-production targets. Grid + battery draw two directional series each; irradiance one
//curve on a fixed 0..1000 W/m² scale. Power stays in watts (tooltip formats to kW).
function renderTargetChart(host: ChartHost, target: Exclude<ChartTarget, 'production'>): TemplateResult
{
    const el = host as unknown as Element; //live HA theme-token colour resolution
    const store = host._unifiedStore;
    const range = host._timeRange;
    const W = 1000;
    const H = 100;
    if (!store || !range)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
    }
    const startMs  = range.start.getTime();
    const endMsAbs = range.end.getTime();
    const rangeMs  = endMsAbs - startMs;
    if (rangeMs <= 0)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
    }
    const xOf = (tMs: number): number => ((tMs - startMs) / rangeMs) * W;

    //Store series to visible-range points: drop nulls, clip to the window. Bucket centre matches sliceForRange so
    //curves line up with the production chart's day separators.
    const toPts =(arr: readonly (number | null)[], map?: (v: number) => number): { t: number; v: number }[] =>
    {
        const out: { t: number; v: number }[] = [];
        for (let i = 0; i < arr.length; i++)
        {
            const raw = arr[i];
            if (raw === null || !isFinite(raw)) { continue; }
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs < startMs || tMs > endMsAbs) { continue; }
            out.push({ t: tMs, v: map ? map(raw) : raw });
        }
        return out;
    };
    const sum = (pts: { v: number }[]): number => pts.reduce((a, p) => a + p.v, 0);

    interface Line { pts: { t: number; v: number }[]; color: string }
    let series: Line[];
    let fixedMax = 0;
    if (target === 'consumption')
    {
        //Home consumption (load) per bucket: production + grid import - grid export - net battery (charge-positive),
        //clamped at 0. Same formula as the live home-usage pill, so chart + chip agree.
        const cons: { t: number; v: number }[] = [];
        for (let i = 0; i < store.production.length; i++)
        {
            const p  = store.production[i];
            const gi = store.gridImport[i];
            const ge = store.gridExport[i];
            const b  = store.battery[i];
            //Skip buckets with no measured data, so a gap reads as a gap rather than a flat 0.
            if (p === null && gi === null && ge === null && b === null) { continue; }
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs < startMs || tMs > endMsAbs) { continue; }
            const v = Math.max(0, (p ?? 0) + (gi ?? 0) - (ge ?? 0) - (b ?? 0));
            cons.push({ t: tMs, v });
        }
        series = [{ pts: cons, color: ENERGY_COLOR.consumption(el) }];
    }
    else if (target === 'grid')
    {
        const imp = toPts(store.gridImport);
        const exp = toPts(store.gridExport);
        series = [
            { pts: imp, color: ENERGY_COLOR.gridImport(el) },
            { pts: exp, color: ENERGY_COLOR.gridExport(el) },
        ];
    }
    else if (target === 'battery')
    {
        //Store battery is signed net power (charge - discharge); split into two non-negative curves so each flow
        //reads distinctly, each zero while the other is active.
        const charge    = toPts(store.battery, v => Math.max(0, v));
        const discharge = toPts(store.battery, v => Math.max(0, -v));
        series = [
            { pts: charge,    color: ENERGY_COLOR.batteryIn(el) },
            { pts: discharge, color: ENERGY_COLOR.batteryOut(el) },
        ];
    }
    else if (target === 'battery-soc')
    {
        //Battery SoC over the window, from the fetched SoC history (the store only carries a live sample). One curve
        //on a fixed 0..100 % scale.
        const hist = host._batterySocHistory;
        const pts: { t: number; v: number }[] = [];
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const tMs = hist.times[i].getTime();
                if (tMs < startMs || tMs > endMsAbs) { continue; }
                const v = hist.values[i];
                if (v === undefined || !isFinite(v)) { continue; }
                pts.push({ t: tMs, v });
            }
        }
        series   = [{ pts, color: ENERGY_COLOR.batteryOut(el) }];
        fixedMax = 100;
    }
    else if (target === 'custom')
    {
        //Custom energy meter over the window, from its recorder `change` series: each bucket's kWh converted to
        //average watts (kWh * 3600000 / bucket-ms), like the production curve. One curve in the configured custom
        //colour, magnitude only so a signed meter reads as a single area; axis auto-scales.
        const buckets = host._customChangeSeries;
        const pts: { t: number; v: number }[] = [];
        if (buckets)
        {
            for (const b of buckets)
            {
                const durMs = b.endMs - b.startMs;
                if (durMs <= 0) { continue; }
                const tMs = (b.startMs + b.endMs) / 2;
                if (tMs < startMs || tMs > endMsAbs) { continue; }
                if (!isFinite(b.kwh)) { continue; }
                pts.push({ t: tMs, v: Math.abs((b.kwh * HOUR_MS) / durMs) });
            }
        }
        series = [{ pts, color: cssHex(el, uiColorVar(customEntityColor(host.config), 'red'), '#f44336') }];
    }
    else
    {
        series   = [{ pts: toPts(store.irradiance), color: ENERGY_COLOR.sun(el) }];
        fixedMax = 1000;
    }

    //Y scale: fixed where set, else the per-series running max. No target stacks its own series; the cloud bands
    //are an overlay of the irradiance view, stacked in their own percent scale below.
    let yMax = fixedMax;
    if (yMax <= 0)
    {
        yMax = 1;
        for (const s of series) { for (const p of s.pts) { if (p.v > yMax) { yMax = p.v; } } }
    }
    //Headroom at the top so a curve's peak never kisses the top edge.
    const TOP_HEADROOM_PX = 10;
    const yOf = (v: number): number => H - Math.max(0, Math.min(1, v / yMax)) * (H - TOP_HEADROOM_PX);

    const drawn = series.map(s =>
    {
        if (s.pts.length < 2) { return { area: '', line: '', color: s.color, total: sum(s.pts) }; }
        const pp = s.pts.map(p => `${xOf(p.t).toFixed(2)},${yOf(p.v).toFixed(2)}`);
        const x0 = xOf(s.pts[0].t);
        const xN = xOf(s.pts[s.pts.length - 1].t);
        return {
            area:  `M ${x0},${H} L ${pp.join(' L ')} L ${xN},${H} Z`,
            line:  `M ${pp.join(' L ')}`,
            color: s.color,
            total: sum(s.pts),
        };
    });

    //Merged irradiance view: the three cloud-cover bands (low -> mid -> high) overlay the irradiance curve
    //as translucent stacked areas drawn ON TOP of it, so the sky literally covers the sun's curve and the
    //anti-correlation reads at a glance. Their own scale maps 100% cumulated cover to the axis top; the
    //bands stay areas-only (no stroke) at a low opacity, keeping the irradiance line in the lead.
    const overlays: { area: string; color: string }[] = [];
    if (target === 'irradiance' && host._chartSeries)
    {
        const cs = host._chartSeries;
        const bands: { t: number; lo: number; mi: number; hi: number }[] = [];
        for (let i = 0; i < cs.times.length; i++)
        {
            const tMs = cs.times[i].getTime();
            if (tMs < startMs || tMs > endMsAbs) { continue; }
            const lo = cs.cloudLow[i];
            const mi = cs.cloudMid[i];
            const hi = cs.cloudHigh[i];
            if (!(isFinite(lo) || isFinite(mi) || isFinite(hi))) { continue; }
            bands.push({
                t:  tMs,
                lo: isFinite(lo) ? Math.max(0, lo) : 0,
                mi: isFinite(mi) ? Math.max(0, mi) : 0,
                hi: isFinite(hi) ? Math.max(0, hi) : 0,
            });
        }
        if (bands.length >= 2)
        {
            const yOfPct = (pct: number): number =>
                H - Math.max(0, Math.min(1, pct / 100)) * (H - TOP_HEADROOM_PX);
            const layers: { pick: (b: { lo: number; mi: number; hi: number }) => number; color: string }[] = [
                { pick: b => b.lo, color: lerpHexToward(ENERGY_COLOR.cloud(el), '#ffffff', 0.55) },
                { pick: b => b.mi, color: ENERGY_COLOR.cloud(el) },
                { pick: b => b.hi, color: lerpHexToward(ENERGY_COLOR.cloud(el), '#000000', 0.50) },
            ];
            const lower = new Array<number>(bands.length).fill(0);
            for (const layer of layers)
            {
                const up: string[] = [];
                const lo: string[] = [];
                for (let j = 0; j < bands.length; j++)
                {
                    const y0 = lower[j];
                    const y1 = y0 + layer.pick(bands[j]);
                    lower[j] = y1;
                    up.push(`${xOf(bands[j].t).toFixed(2)},${yOfPct(y1).toFixed(2)}`);
                    lo.push(`${xOf(bands[j].t).toFixed(2)},${yOfPct(y0).toFixed(2)}`);
                }
                overlays.push({
                    area:  `M ${up.join(' L ')} L ${lo.reverse().join(' L ')} Z`,
                    color: layer.color,
                });
            }
        }
    }

    //The solar forecast rides the irradiance view (with its cloud overlay) as a ghosted reference: the
    //three sun-driven curves live together, and the forecast's shape reads against the clouds that will
    //eat it. Normalised to its own maximum (W against W/m2, sharing the axis would squash one curve);
    //production keeps its true shared-scale forecast in charts-pv; other targets stay clean.
    let forecastLine = '';
    if (target === 'irradiance' && store)
    {
        const slice = sliceForRange(store, startMs, endMsAbs);
        const pts: { t: Date; v: number }[] = [];
        let fMax = 0;
        for (let i = 0; i < slice.times.length; i++)
        {
            const v = slice.forecast[i];
            if (v === null || !isFinite(v) || v <= 0) { continue; }
            pts.push({ t: slice.times[i], v });
            if (v > fMax) { fMax = v; }
        }
        if (pts.length >= 2 && fMax > 0)
        {
            const yOfF = (v: number): number =>
                H - Math.max(0, Math.min(1, v / fMax)) * (H - TOP_HEADROOM_PX);
            forecastLine = `M ${pts.map(p => `${xOf(p.t.getTime()).toFixed(2)},${yOfF(p.v).toFixed(2)}`).join(' L ')}`;
        }
    }

    //Day separators from the shared timeline model (bounded, empty on wide spans).
    const dayXs = buildTimelineModel(range.start, range.end).dayBoundaries.map(frac => frac * W);

    //Hover guide + one dot per series, interpolated at the hover instant.
    const hoverPct = host._chartHoverPct;
    let hoverX     = 0;
    let showHover  = false;
    const hoverDots: { y: number; color: string }[] = [];
    if (hoverPct !== null && hoverPct >= 0 && hoverPct <= 100)
    {
        hoverX = (hoverPct / 100) * W;
        const hoverMs = startMs + (hoverPct / 100) * rangeMs;
        for (const s of series)
        {
            if (s.pts.length < 1) { continue; }
            const v = interpAt(s.pts.map(p => new Date(p.t)), s.pts.map(p => p.v), hoverMs);
            if (!isFinite(v)) { continue; }
            hoverDots.push({ y: yOf(Math.max(0, v)), color: s.color });
            showHover = true;
        }
    }

    return html`
        <svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            ${dayXs.map(x => svg`
                <line class="hc-day-sep" x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${H}"></line>
            `)}
            <g class="hc-chart-grow">
                ${forecastLine ? svg`
                    <path class="hc-chart-predicted hc-chart-forecast-ghost" d="${forecastLine}" stroke="${ENERGY_COLOR.pv(el)}" fill="none"></path>
                ` : nothing}
                ${drawn.map(d => d.area ? svg`
                    <path d="${d.area}" fill="${d.color}" fill-opacity="0.22"></path>
                ` : nothing)}
                ${drawn.map(d => d.line ? svg`
                    <path class="hc-chart-line" d="${d.line}" stroke="${d.color}"></path>
                ` : nothing)}
                ${overlays.map(o => svg`
                    <path d="${o.area}" fill="${o.color}" fill-opacity="0.35"></path>
                `)}
            </g>
            ${showHover ? svg`
                <line class="hc-hover-guide" x1="${hoverX.toFixed(2)}" y1="0" x2="${hoverX.toFixed(2)}" y2="${H}"></line>
            ` : nothing}
        </svg>
        ${hoverDots.map(d => html`
            <div class="hc-hover-dot-html" style="left: ${(hoverX / W * 100).toFixed(2)}%; top: ${(d.y / H * 100).toFixed(2)}%; background: ${d.color};"></div>
        `)}
    `;
}


//The thin track carries only the cursors; day separators live inside the chart card SVG, the scrub time label is a
//chip above the card.
export function renderTimelineTicks(host: ChartHost): TemplateResult | typeof nothing
{
    if (!host._timeRange)
    {
        return nothing;
    }

    const { start, end } = host._timeRange;
    const rangeMs = end.getTime() - start.getTime();
    const now     = new Date();
    const toPct   = (d: Date): number =>
        Math.max(0, Math.min(100, (d.getTime() - start.getTime()) / rangeMs * 100));

    const nowPct        = toPct(now);
    const showSelected  = !host._isLiveMode && host._selectedTime !== null;
    const selPct        = showSelected ? toPct(host._selectedTime!) : 0;

    return html`
        <div class="tb-cursor-now" style="left:${nowPct}%"></div>
        ${showSelected ? html`
            <div class="tb-cursor-sel" style="left:${selPct}%"></div>
        ` : nothing}
    `;
}


//Adaptive timeline labels over the chart-card footer. The shared model picks granularity from the visible span
//(hours / weekdays / day+month / months) and thins the count so a wide window stays legible. Each label sits at its
//model fraction; the day view emphasises today, matching the now-cursor.
export function renderTimelineDayLabels(host: ChartHost): TemplateResult | typeof nothing
{
    if (!host._timeRange)
    {
        return nothing;
    }

    const { start, end } = host._timeRange;
    const model  = buildTimelineModel(start, end);
    //Drop entries hugging the window edges so they never collide with the card corners.
    const labels = model.labels.filter(s => s.frac > 0.02 && s.frac < 0.98);
    const seps   = model.separators.filter(s => s.frac > 0.02 && s.frac < 0.98);

    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    //Emphasise today only in the day view (each label names one calendar day); wider spans already mark the present
    //with the now-cursor.
    const isTodayLabel = (d: Date): boolean =>
        model.kind === 'days' && d.getTime() === today0.getTime();

    return html`
        <div class="tb-day-strip">
            ${seps.map(s => html`
                <div class="tb-day-strip-sep" style="left:${(s.frac * 100).toFixed(2)}%"></div>
            `)}
            ${labels.map(s => html`
                <span
                    class="tb-day-strip-date ${isTodayLabel(s.date) ? 'is-today' : ''}"
                    style="left:${(s.frac * 100).toFixed(2)}%"
                >${formatTimelineLabel(model.kind, s.date, host.hass)}</span>
            `)}
        </div>
    `;
}



//kWh-per-day totals over the active range from two passes: past + today-so-far from the recorder `change` buckets,
//today-remainder + future from the store's corrected forecast. Returns a Map keyed by each day's local-midnight ms
//(kWh); days outside the range or without usable data are omitted.
export function computeDailyKwhTotals(host: ChartHost): Map<number, number>
{
    const out = new Map<number, number>();
    if (!host._timeRange)
    {
        return out;
    }
    const { start, end } = host._timeRange;
    const startMs  = start.getTime();
    const endMsAbs = end.getTime();

    const dayKey = (ms: number): number =>
    {
        const d = new Date(ms);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    };

    //Pass 1: past + today-so-far, summed per day from the recorder `change` buckets so each day matches HA Energy to
    //the watt-hour (no curve integration / gap interpolation, which inflates totals). The series spans the J-2 past
    //window, covering every past day shown.
    const changeSeries = host._pvChangeSeries;
    if (changeSeries && changeSeries.length > 0)
    {
        const cursor = new Date(startMs);
        cursor.setHours(0, 0, 0, 0);
        while (cursor.getTime() < endMsAbs)
        {
            const ds   = cursor.getTime();
            const next = new Date(cursor);
            next.setDate(next.getDate() + 1);
            const kwh = sumChangeForDay(changeSeries, ds, next.getTime());
            if (kwh !== null)
            {
                out.set(ds, Math.max(0, kwh));
            }
            cursor.setTime(next.getTime());
        }
    }

    //Pass 2: future + today-remainder from the store's corrected forecast (same series the dotted curve draws), so
    //per-day chips agree with the curve. Only buckets at/after "now" contribute (past is Pass 1's real production);
    //the forecast is already cap-clipped and correction-applied.
    const store = host._unifiedStore;
    if (store)
    {
        const nowMs = Date.now();
        const stepH = store.stepMs / HOUR_MS;   //bucket length in hours
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const mid = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (mid < startMs || mid > endMsAbs) { continue; }
            if (mid < nowMs) { continue; }   //past covered by Pass 1
            const w = store.forecast[i];
            if (w === null || !isFinite(w) || w <= 0) { continue; }
            const dk = dayKey(mid);
            out.set(dk, (out.get(dk) ?? 0) + w * stepH / 1000);
        }
    }

    return out;
}
