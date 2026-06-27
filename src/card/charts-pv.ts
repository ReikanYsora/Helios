//Photovoltaic production chart: the observed area + line, the dashed forecast curve, the per-source stacked bands
//(multi-source installs), and the hover dots that ride each curve. Native-unit Y scaling lives here (production
//only); the generic targets stay in charts-generic.ts.

import type { TemplateResult } from 'lit';
import { html, svg, nothing } from 'lit';
import { ENERGY_COLOR, energySolarColor, lerpHexToward } from './format';
import { buildTimelineModel } from './timeline-model';
import { sliceForRange } from './unifiedStore';
import { type ChartHost, chartIsDark } from './charts';
import { interpAt, pvValueAtTime } from './series-sample';


//Render the photovoltaic production graph above the main timeline chart. Shares the X axis (host._timeRange) so day
//boundaries and the scrub cursor align across both. The observed curve stops at the last recorded sample; the
//forecast continues past "now".
export function renderPvChart(host: ChartHost): TemplateResult
{
    const el = host as unknown as Element; //for live HA theme-token colour resolution
    const range = host._timeRange;
    const hist  = host._pvHistory;
    const W     = 1000;
    const H     = 100;

    if (!range)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
    }

    const startMs = range.start.getTime();
    const rangeMs = range.end.getTime() - startMs;
    if (rangeMs <= 0)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
    }

    const pvColor = ENERGY_COLOR.pv(el);
    //Theme-aware "predicted" shade for the dashed forecast curve: light theme blends toward black, dark toward white,
    //so it stays a readable softer line on either plate.
    const isDarkTheme       = !!(host.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes?.darkMode;
    const predictedPvColor  = isDarkTheme
        ? lerpHexToward(pvColor, '#ffffff', 0.55)
        : lerpHexToward(pvColor, '#000000', 0.35);

    //Day-boundary X positions from the shared timeline model (same source as the weather chart so separators line
    //up). Bounded to <= 40 entries; empty on wide spans.
    const endMsAbs = range.end.getTime();
    const dayXs = buildTimelineModel(range.start, range.end).dayBoundaries.map(frac => frac * W);

    //Single-source read: unifiedStore carries the production series over the full J-2..J+2 window in watts (linearly
    //interpolated, never mixed with forecast). sliceForRange returns one sample per DISPLAY bucket in view; empty
    //before the first build -> empty frame.
    const lu = (host._pvUnit || '').toLowerCase();
    const isCumulativeEnergy = lu === 'wh' || lu === 'kwh' || lu === 'mwh';
    //The store handles cumulative->W internally; keep these referenced to silence unused warnings.
    void isCumulativeEnergy;
    void hist;
    const store = host._unifiedStore;
    const rangeSlice = store ? sliceForRange(store, startMs, endMsAbs) : null;

    const xOf = (t: Date): number =>
        ((t.getTime() - startMs) / rangeMs) * W;

    //Observed samples are in the entity's native power unit; the forecast is in watts. Compute the W -> native scale
    //once so both feed yMax on the same axis (mixing units would flatten a kW observed curve when the predicted is
    //in W).
    const nativeFromW = (() => {
        const native = isCumulativeEnergy
            ? (lu === 'kwh' ? 'kw' : lu === 'mwh' ? 'mw' : lu === 'wh' ? 'w' : '')
            : lu;
        if (native === 'kw')
        {
            return 1 / 1000;
        }
        if (native === 'mw')
        {
            return 1 / 1_000_000;
        }
        return 1;
    })();

    //Production samples: store watts × nativeFromW so the Y axis stays in the entity's native unit (store is the
    //single conversion point).
    const samples: { t: Date; v: number }[] = [];
    if (rangeSlice)
    {
        for (let i = 0; i < rangeSlice.times.length; i++)
        {
            const v = rangeSlice.production[i];
            if (v === null || !isFinite(v)) { continue; }
            samples.push({ t: rangeSlice.times[i], v: v * nativeFromW });
        }
    }

    //Forecast curve: same store, same conversion. The forecast series is already cap-clipped, calibration-applied
    //and shading-aware at every DISPLAY bucket, no local model loop here.
    const predictedSamples: { t: Date; v: number }[] = [];
    if (rangeSlice)
    {
        for (let i = 0; i < rangeSlice.times.length; i++)
        {
            const v = rangeSlice.forecast[i];
            if (v === null || !isFinite(v) || v <= 0) { continue; }
            predictedSamples.push({ t: rangeSlice.times[i], v: v * nativeFromW });
        }
    }

    //Auto-scale Y to the running max (min 1 to avoid divide-by-zero on an all-zero window, keeping the curve pinned
    //to the baseline). Predicted samples feed yMax too so the forecast line never clips above observed peaks.
    let yMax = 1;
    for (const s of samples)          { if (s.v > yMax) yMax = s.v; }
    for (const s of predictedSamples) { if (s.v > yMax) yMax = s.v; }
    //Leave a sliver of headroom at the top so the production / forecast peak never kisses the top edge.
    const TOP_HEADROOM_PX = 10;
    const yOf = (v: number): number =>
        H - Math.max(0, Math.min(1, v / yMax)) * (H - TOP_HEADROOM_PX);

    const points = samples.map(s =>
        `${xOf(s.t).toFixed(2)},${yOf(s.v).toFixed(2)}`);

    let area  = '';
    let line  = '';
    if (points.length >= 2)
    {
        const x0 = xOf(samples[0].t);
        const xN = xOf(samples[samples.length - 1].t);
        area = `M ${x0},${H} L ${points.join(' L ')} L ${xN},${H} Z`;
        line = `M ${points.join(' L ')}`;
    }

    //Per-source STACKED areas (multi-source installs): each source's share of the aggregate at every bucket,
    //stacked so the filled areas sum to the aggregate and never overlap. Same per-source colour ramp as the
    //home histogram (energySolarColor by sorted index). Single-source installs keep the plain aggregate area.
    const perEntityIdsForCurves = host._pvHistoryPerEntity.size > 1
        ? Array.from(host._pvHistoryPerEntity.keys()).sort()
        : [];
    const stackedAreas: { color: string; path: string }[] = [];
    if (perEntityIdsForCurves.length > 1 && samples.length >= 2)
    {
        const elc   = host as unknown as Element;
        const darkc = chartIsDark(host);
        const S = perEntityIdsForCurves.length;
        const N = samples.length;
        //Each source's instantaneous power at every aggregate-sample time (pvValueAtTime differentiates
        //cumulative meters and floors below the horizon, in a unit consistent across sources).
        const raw: number[][] = [];
        for (let s = 0; s < S; s++)
        {
            const ph  = host._pvHistoryPerEntity.get(perEntityIdsForCurves[s]);
            const arr = new Array<number>(N).fill(0);
            if (ph)
            {
                for (let j = 0; j < N; j++)
                {
                    const v = pvValueAtTime(host, samples[j].t.getTime(), ph).value;
                    arr[j] = isFinite(v) && v > 0 ? v : 0;
                }
            }
            raw.push(arr);
        }
        //Stack each source as its share of the aggregate, so the stack top tracks the aggregate curve exactly.
        const lower = new Array<number>(N).fill(0);
        for (let s = 0; s < S; s++)
        {
            const up: string[] = [];
            const lo: string[] = [];
            for (let j = 0; j < N; j++)
            {
                let total = 0;
                for (let k = 0; k < S; k++) { total += raw[k][j]; }
                const share = total > 0 ? raw[s][j] / total : 0;
                const y0 = lower[j];
                const y1 = y0 + share * samples[j].v;
                lower[j] = y1;
                up.push(`${xOf(samples[j].t).toFixed(2)},${yOf(y1).toFixed(2)}`);
                lo.push(`${xOf(samples[j].t).toFixed(2)},${yOf(y0).toFixed(2)}`);
            }
            stackedAreas.push({
                color: energySolarColor(elc, darkc, s),
                path:  `M ${up.join(' L ')} L ${lo.reverse().join(' L ')} Z`,
            });
        }
    }

    let predictedLine = '';
    if (predictedSamples.length >= 2)
    {
        const pPoints = predictedSamples.map(s =>
            `${xOf(s.t).toFixed(2)},${yOf(s.v).toFixed(2)}`);
        predictedLine = `M ${pPoints.join(' L ')}`;
    }

    //Hover dot at the interpolated PV value. Observed wins; with no observed value (future, gap, outage) it falls
    //back to the predicted series. Same Y axis as the curve it rides, so it reads as a point on the curve.
    const hoverPct = host._chartHoverPct;
    let hoverX = 0;
    let hoverY = NaN;
    let hoverYPred = NaN;
    let showHover = false;
    if (hoverPct !== null && hoverPct >= 0 && hoverPct <= 100)
    {
        hoverX = (hoverPct / 100) * W;
        const hoverMs = startMs + (hoverPct / 100) * rangeMs;
        //Observed dot only inside the observed window (else interpAt clamps and the dot freezes on yesterday's tail
        //when hovering tomorrow). Forecast dot wherever it has a value, so both dots ride their own curves at once.
        const lastObsMs = samples.length > 0
            ? samples[samples.length - 1].t.getTime()
            : -Infinity;
        if (samples.length >= 1 && hoverMs <= lastObsMs)
        {
            const a = interpAt(samples.map(s => s.t), samples.map(s => s.v), hoverMs);
            //Floor at zero: a net meter can dip below zero at dawn/dusk; the dot still rides the curve.
            if (isFinite(a)) { hoverY = yOf(Math.max(0, a)); }
        }
        if (predictedSamples.length >= 1)
        {
            const p = interpAt(predictedSamples.map(s => s.t), predictedSamples.map(s => s.v), hoverMs);
            if (isFinite(p)) { hoverYPred = yOf(Math.max(0, p)); }
        }
        showHover = isFinite(hoverY) || isFinite(hoverYPred);
    }

    //Per-source hover dots: one dot riding the top of each stacked band at the hover instant, in the band's
    //colour, so the curves carry the same dot vocabulary as the cloud chart.
    const sourceHoverDots: { y: number; color: string }[] = [];
    if (showHover && hoverPct !== null && stackedAreas.length > 0)
    {
        const hoverMs    = startMs + (hoverPct / 100) * rangeMs;
        const aggAtHover = interpAt(samples.map(s => s.t), samples.map(s => s.v), hoverMs);
        if (isFinite(aggAtHover) && aggAtHover > 0)
        {
            const rawAtHover = perEntityIdsForCurves.map(id =>
            {
                const ph = host._pvHistoryPerEntity.get(id);
                if (!ph) { return 0; }
                const v = pvValueAtTime(host, hoverMs, ph).value;
                return isFinite(v) && v > 0 ? v : 0;
            });
            const total = rawAtHover.reduce((a, b) => a + b, 0);
            if (total > 0)
            {
                let cumShare = 0;
                for (let s = 0; s < perEntityIdsForCurves.length; s++)
                {
                    cumShare += rawAtHover[s] / total;
                    sourceHoverDots.push({
                        y:     yOf(cumShare * aggAtHover),
                        color: energySolarColor(host as unknown as Element, chartIsDark(host), s),
                    });
                }
            }
        }
    }

    return html`
        <svg
            class="hc-chart-svg"
            viewBox="0 0 ${W} ${H}"
            preserveAspectRatio="none"
        >
            ${dayXs.map(x => svg`
                <line
                    class="hc-day-sep"
                    x1="${x.toFixed(2)}" y1="0"
                    x2="${x.toFixed(2)}" y2="${H}"
                ></line>
            `)}
            <g class="hc-chart-grow">
                ${stackedAreas.length > 0
                    ? stackedAreas.map(a => svg`
                        <path
                            d="${a.path}"
                            fill="${a.color}"
                            fill-opacity="0.55"
                        ></path>
                    `)
                    : (area ? svg`
                        <path
                            d="${area}"
                            fill="${pvColor}"
                            fill-opacity="0.25"
                        ></path>
                    ` : nothing)}
                ${line ? svg`
                    <path
                        class="hc-chart-line"
                        d="${line}"
                        stroke="${pvColor}"
                    ></path>
                ` : nothing}
                ${predictedLine ? svg`
                    <path
                        class="hc-chart-line hc-chart-predicted"
                        d="${predictedLine}"
                        stroke="${predictedPvColor}"
                    ></path>
                ` : nothing}
            </g>
            ${showHover ? svg`
                <line
                    class="hc-hover-guide"
                    x1="${hoverX.toFixed(2)}" y1="0"
                    x2="${hoverX.toFixed(2)}" y2="${H}"
                ></line>
            ` : nothing}
        </svg>
        ${showHover && isFinite(hoverY) ? html`
            <div class="hc-hover-dot-html" style="left: ${(hoverX / W * 100).toFixed(2)}%; top: ${(hoverY / H * 100).toFixed(2)}%; background: ${pvColor};"></div>
        ` : nothing}
        ${showHover && isFinite(hoverYPred) ? html`
            <div class="hc-hover-dot-html" style="left: ${(hoverX / W * 100).toFixed(2)}%; top: ${(hoverYPred / H * 100).toFixed(2)}%; background: ${predictedPvColor};"></div>
        ` : nothing}
        ${sourceHoverDots.map(d => html`
            <div class="hc-hover-dot-html" style="left: ${(hoverX / W * 100).toFixed(2)}%; top: ${(d.y / H * 100).toFixed(2)}%; background: ${d.color};"></div>
        `)}
    `;
}
