//Re-targetable bottom chart for everything except production, the target accent colour, the cursor/label axis
//furniture, and per-day kWh aggregation for the day chips. Production has its own renderer in charts-pv.ts.

import type { TemplateResult } from 'lit';
import { html, svg, nothing } from 'lit';
import { ENERGY_COLOR, lerpHexToward, cssHex, deviceColorByIndex } from '../core/format/format';
import { chipSlotColor } from '../core/config/chip-appearance';
import { groupDevices, groupColorHex } from '../data/sources/device-consumption';
import { consumptionLoad } from '../core/energy';
import { buildTimelineModel, formatTimelineLabel } from '../timeline/timeline-model';
import { sumChangeForDay, changeSeriesToWatts } from '../data/sources/energy-stats';
import { type ChartHost, type ChartTarget, isGroupTarget, groupOfTarget, chartIsDark } from './charts';
import { interpAt } from '../data/series-sample';
import { sliceForRange } from '../data/unifiedStore';
import { renderPvChart } from './charts-pv';
import { HOUR_MS } from '../core/config/constants';


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
    if (target === 'production') { return chipSlotColor(el, host.config, 'production'); }
    if (target === 'consumption'){ return chipSlotColor(el, host.config, 'home'); }
    if (target === 'irradiance') { return chipSlotColor(el, host.config, 'irradiance'); }
    if (target === 'battery-soc'){ return chipSlotColor(el, host.config, 'batteryDischarge'); }
    if (isGroupTarget(target)) { return groupColorHex(el, host.config, groupOfTarget(target)); }
    const store = host._unifiedStore;
    const range = host._timeRange;
    if (!store || !range)
    {
        return target === 'grid' ? chipSlotColor(el, host.config, 'gridImport') : chipSlotColor(el, host.config, 'batteryDischarge');
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
            ? chipSlotColor(el, host.config, 'gridImport')
            : chipSlotColor(el, host.config, 'gridExport');
    }
    return sumArr(store.battery, v => Math.max(0, v)) >= sumArr(store.battery, v => Math.max(0, -v))
        ? chipSlotColor(el, host.config, 'batteryCharge')
        : chipSlotColor(el, host.config, 'batteryDischarge');
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

    //`lineOnly` series draw a stroke with no area fill (the per-bank SoC overlays on the battery chart); `dashed`
    //marks them as levels rather than flows. `noHoverDot` suppresses the per-series hover dot (the SoC line is split
    //into many colour runs, which would otherwise stack a dot per run; one SoC dot per bank is added separately).
    interface Line { pts: { t: number; v: number }[]; color: string; lineOnly?: boolean; dashed?: boolean; noHoverDot?: boolean }
    let series: Line[];
    let fixedMax = 0;
    //Battery SoC hover source: one dot per bank at the cursor (not one per colour run). Full per-bank pts + the
    //flow-colour resolver, captured so the hover section can place a single SoC dot in the live flow colour.
    let socHover: { banks: { t: number; v: number }[][]; flowColorAt: (aMs: number, bMs: number) => string } | null = null;
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
            const v = consumptionLoad(p ?? 0, gi ?? 0, ge ?? 0, b ?? 0);
            cons.push({ t: tMs, v });
        }
        series = [{ pts: cons, color: chipSlotColor(el, host.config, 'home') }];
    }
    else if (target === 'grid')
    {
        const imp = toPts(store.gridImport);
        const exp = toPts(store.gridExport);
        series = [
            { pts: imp, color: chipSlotColor(el, host.config, 'gridImport') },
            { pts: exp, color: chipSlotColor(el, host.config, 'gridExport') },
        ];
    }
    else if (target === 'battery')
    {
        //Store battery is signed net power (charge - discharge); split into two non-negative curves so each flow
        //reads distinctly, each zero while the other is active.
        const charge    = toPts(store.battery, v => Math.max(0, v));
        const discharge = toPts(store.battery, v => Math.max(0, -v));
        series = [
            { pts: charge,    color: chipSlotColor(el, host.config, 'batteryCharge') },
            { pts: discharge, color: chipSlotColor(el, host.config, 'batteryDischarge') },
        ];
        //Per-bank SoC overlays the flows: one dashed line-only curve per bank, its 0..100 % scaled onto the power
        //peak (100 % = peak) so both share one axis and a sagging bank reads against the charge/discharge areas.
        //Uses the raw per-bank series, falling back to the aggregated mean when only one bank is wired. A SoC-only
        //install (no power) keeps a plain 0..100 % axis. Banks aren't told apart by colour; each SoC line instead
        //takes the battery FLOW colour (HA charge/discharge) at each instant, so a line runs pink while its pack
        //is charging and teal while discharging, tying the level back to the beams above it.
        let powerMax = 0;
        for (const s of series) { for (const p of s.pts) { if (p.v > powerMax) { powerMax = p.v; } } }
        const banks = host._batterySocPerBankHistory.length > 0
            ? host._batterySocPerBankHistory
            : (host._batterySocHistory ? [host._batterySocHistory] : []);
        if (banks.length > 0)
        {
            const socScale = powerMax > 0 ? powerMax / 100 : 1;
            const socChargeCol    = chipSlotColor(el, host.config, 'batteryCharge');
            const socDischargeCol = chipSlotColor(el, host.config, 'batteryDischarge');
            const socIdleCol      = cssHex(el, '--secondary-text-color', '#9e9e9e');
            //Flow colour at a segment: the net battery power (charge-positive) at the segment's midpoint bucket.
            //+/-5 W deadband so recorder noise doesn't flicker the colour on an idle pack.
            const flowColorAt = (aMs: number, bMs: number): string =>
            {
                const idx = Math.floor(((aMs + bMs) / 2 - store.storeStartMs) / store.stepMs);
                const p   = (idx >= 0 && idx < store.battery.length) ? store.battery[idx] : null;
                if (p === null || Math.abs(p) < 5) { return socIdleCol; }
                return p > 0 ? socChargeCol : socDischargeCol;
            };
            const socBanks: { t: number; v: number }[][] = [];
            for (const bank of banks)
            {
                const pts: { t: number; v: number }[] = [];
                for (let i = 0; i < bank.times.length; i++)
                {
                    const tMs = bank.times[i].getTime();
                    if (tMs < startMs || tMs > endMsAbs) { continue; }
                    const soc = bank.values[i];
                    if (soc === undefined || !isFinite(soc)) { continue; }
                    pts.push({ t: tMs, v: Math.max(0, Math.min(100, soc)) * socScale });
                }
                //Split the bank line into runs of same flow colour so a single line carries several colours along
                //its charge/discharge portions. Adjacent runs share their boundary vertex, keeping the line gapless.
                if (pts.length < 2) { continue; }
                socBanks.push(pts);
                const segCount = pts.length - 1;
                const segCols: string[] = [];
                for (let i = 0; i < segCount; i++) { segCols.push(flowColorAt(pts[i].t, pts[i + 1].t)); }
                let runStart = 0;
                for (let i = 1; i <= segCount; i++)
                {
                    if (i === segCount || segCols[i] !== segCols[runStart])
                    {
                        //Run covers segments [runStart, i-1], i.e. points [runStart, i]. noHoverDot: the whole line
                        //gets a SINGLE hover dot (added below from socHover), not one per colour run.
                        series.push({ pts: pts.slice(runStart, i + 1), color: segCols[runStart], lineOnly: true, dashed: true, noHoverDot: true });
                        runStart = i;
                    }
                }
            }
            if (socBanks.length > 0) { socHover = { banks: socBanks, flowColorAt }; }
            fixedMax = powerMax > 0 ? powerMax : 100;
        }
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
        series   = [{ pts, color: chipSlotColor(el, host.config, 'batteryDischarge') }];
        fixedMax = 100;
    }
    else if (isGroupTarget(target))
    {
        //Monitoring group: one line+area curve per visible device of the group, its recorder `change` series
        //mapped onto the store grid as average watts (magnitude only). Each device keeps its dashboard graph
        //colour so the chart and its tooltip read the same palette.
        const devs = groupDevices(host.config, host._energyDefaults, groupOfTarget(target));
        series = devs.map(dev =>
        {
            const watts = changeSeriesToWatts(
                host._deviceChangeSeries.get(dev.statConsumption) ?? null,
                store.storeStartMs, store.stepMs, store.bucketsTotal, Date.now());
            return { pts: toPts(watts, v => Math.abs(v)), color: deviceColorByIndex(el, dev.index) };
        });
    }
    else
    {
        series   = [{ pts: toPts(store.irradiance), color: chipSlotColor(el, host.config, 'irradiance') }];
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
        if (s.pts.length < 2) { return { area: '', line: '', color: s.color, dashed: !!s.dashed, total: sum(s.pts) }; }
        const pp = s.pts.map(p => `${xOf(p.t).toFixed(2)},${yOf(p.v).toFixed(2)}`);
        const x0 = xOf(s.pts[0].t);
        const xN = xOf(s.pts[s.pts.length - 1].t);
        return {
            //Line-only series (per-bank SoC) carry no filled area.
            area:  s.lineOnly ? '' : `M ${x0},${H} L ${pp.join(' L ')} L ${xN},${H} Z`,
            line:  `M ${pp.join(' L ')}`,
            color: s.color,
            dashed: !!s.dashed,
            total: sum(s.pts),
        };
    });

    //Merged irradiance view: the three cloud-cover bands (low -> mid -> high) overlay the irradiance curve
    //as translucent stacked areas drawn ON TOP of it, so the sky literally covers the sun's curve and the
    //anti-correlation reads at a glance. Their own scale maps 100% cumulated cover to the axis top; the
    //bands stay areas-only (no stroke) at a low opacity, keeping the irradiance line in the lead.
    const overlays: { area: string; color: string }[] = [];
    //Hover-dot sources for the irradiance view's non-`series` curves (forecast + cloud bands): each carries its own
    //y-scale, so the hover section reads their value at the cursor through these instead of the shared `yOf`.
    let cloudHover: { bands: { t: number; lo: number; mi: number; hi: number }[]; yOfPct: (p: number) => number; colors: string[] } | null = null;
    let forecastHover: { pts: { t: number; v: number }[]; yOf: (v: number) => number } | null = null;
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
            cloudHover = { bands, yOfPct, colors: layers.map(l => l.color) };
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
            forecastHover = { pts: pts.map(p => ({ t: p.t.getTime(), v: p.v })), yOf: yOfF };
        }
    }
    //Forecast dash on the irradiance view. It rides the near-identical shape of the amber irradiance area, so a
    //plain predicted shade blends in: push the contrast harder (toward white on dark, black on light) than the
    //production line so the dashed silhouette clearly separates from the fill under it.
    const isDarkTheme  = chartIsDark(host);
    const irradColor = chipSlotColor(el, host.config, 'irradiance');
    const forecastColor = isDarkTheme
        ? lerpHexToward(irradColor, '#ffffff', 0.75)
        : lerpHexToward(irradColor, '#000000', 0.55);

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
            if (s.pts.length < 1 || s.noHoverDot) { continue; }
            const v = interpAt(s.pts.map(p => new Date(p.t)), s.pts.map(p => p.v), hoverMs);
            if (!isFinite(v)) { continue; }
            hoverDots.push({ y: yOf(Math.max(0, v)), color: s.color });
            showHover = true;
        }
        //Battery SoC: ONE dot per bank at the cursor, in the live flow colour, instead of one dot per colour run.
        if (socHover)
        {
            for (const pts of socHover.banks)
            {
                if (pts.length < 1) { continue; }
                const v = interpAt(pts.map(p => new Date(p.t)), pts.map(p => p.v), hoverMs);
                if (!isFinite(v)) { continue; }
                hoverDots.push({ y: yOf(Math.max(0, v)), color: socHover.flowColorAt(hoverMs, hoverMs) });
                showHover = true;
            }
        }
        //Forecast + cloud bands ride the irradiance view on their own scales (drawn outside `series`), so their
        //hover dots are computed here too: the forecast dot on its own normalised curve, one cloud dot per layer at
        //its cumulative stacked top, matching the tooltip's three cloud rows.
        if (forecastHover && forecastHover.pts.length >= 1)
        {
            const fv = interpAt(forecastHover.pts.map(p => new Date(p.t)), forecastHover.pts.map(p => p.v), hoverMs);
            if (isFinite(fv) && fv > 0)
            {
                hoverDots.push({ y: forecastHover.yOf(fv), color: forecastColor });
                showHover = true;
            }
        }
        if (cloudHover && cloudHover.bands.length >= 1)
        {
            const times = cloudHover.bands.map(b => new Date(b.t));
            const lo = interpAt(times, cloudHover.bands.map(b => b.lo), hoverMs);
            const mi = interpAt(times, cloudHover.bands.map(b => b.mi), hoverMs);
            const hi = interpAt(times, cloudHover.bands.map(b => b.hi), hoverMs);
            //Cumulative stacked tops (low -> mid -> high), each dot in its layer colour.
            const tops = [
                isFinite(lo) ? lo : 0,
                (isFinite(lo) ? lo : 0) + (isFinite(mi) ? mi : 0),
                (isFinite(lo) ? lo : 0) + (isFinite(mi) ? mi : 0) + (isFinite(hi) ? hi : 0),
            ];
            const present = [isFinite(lo), isFinite(mi), isFinite(hi)];
            for (let k = 0; k < 3; k++)
            {
                if (!present[k]) { continue; }
                hoverDots.push({ y: cloudHover.yOfPct(tops[k]), color: cloudHover.colors[k] });
                showHover = true;
            }
        }
    }

    return html`
        <svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            ${dayXs.map(x => svg`
                <line class="hc-day-sep" x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${H}"></line>
            `)}
            <g class="hc-chart-grow">
                ${drawn.map(d => d.area ? svg`
                    <path d="${d.area}" fill="${d.color}" fill-opacity="0.22"></path>
                ` : nothing)}
                ${drawn.map(d => d.line ? svg`
                    <path class="hc-chart-line" d="${d.line}" stroke="${d.color}" stroke-dasharray="${d.dashed ? '4 3' : 'none'}"></path>
                ` : nothing)}
                ${overlays.map(o => svg`
                    <path d="${o.area}" fill="${o.color}" fill-opacity="0.35"></path>
                `)}
                <!--  Forecast silhouette drawn LAST so it reads as a ghosted reference on top of the target's
                      own fill + the cloud overlay, instead of being buried under them.  -->
                ${forecastLine ? svg`
                    <path class="hc-chart-line hc-chart-predicted" d="${forecastLine}" stroke="${forecastColor}" stroke-width="2" fill="none"></path>
                ` : nothing}
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
//model fraction; day-granularity labels emphasise today, matching the now-cursor.
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
    //Emphasise today only when labels are day-granular (each names one calendar day); wider spans already mark the
    //present with the now-cursor.
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
    //the watt-hour (no curve integration / gap interpolation, which inflates totals). The series spans the past
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
