//Shared projection for the two stacked bottom charts (the re-targetable target chart and the PV chart). Both draw
//into one 1000x100 viewBox so their X axis and the day cursor line up; keeping the geometry here stops the two
//renderers drifting apart. Pure, no store/DOM.

import { html, type TemplateResult } from 'lit';

export const CHART_W = 1000;
export const CHART_H = 100;
//Headroom at the top so a curve's peak never kisses the top edge.
export const CHART_TOP_HEADROOM_PX = 10;

//The empty frame both charts return before a range/store exists. preserveAspectRatio=none stretches the fixed
//viewBox to the card width.
export function emptyChartSvg(): TemplateResult
{
    return html`<svg class="hc-chart-svg" viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none"></svg>`;
}

//X projection: epoch ms -> viewBox x. Callers holding a Date pass t.getTime().
export function makeXOf(startMs: number, rangeMs: number): (ms: number) => number
{
    return (ms) => ((ms - startMs) / rangeMs) * CHART_W;
}

//Y projection: value -> viewBox y, clamped to [yMin, yMax] with top headroom. A 0-based axis (PV watts, percent,
//forecast) passes yMin = 0. Callers guarantee yMax > yMin.
export function makeYOf(yMin: number, yMax: number): (v: number) => number
{
    return (v) => CHART_H - Math.max(0, Math.min(1, (v - yMin) / (yMax - yMin))) * (CHART_H - CHART_TOP_HEADROOM_PX);
}
