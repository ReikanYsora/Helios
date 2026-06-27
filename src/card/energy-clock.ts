//Energy-clock mode: a ring of 24 hourly cylinders projected on the same 2.5D ground plane as the scene,
//one per hour of the day, showing whichever metric the right-hand rail selects — production split per PV
//string, grid into import/export, battery into charge/discharge, etc. Each hour aggregates the metric over
//the whole rolling window (a single day shows that day's shape; a longer range averages it). The data comes
//straight from the store + histories the timeline already loaded, binned by hour-of-day — no extra fetch.

import type { SceneCamera } from '../engine/projection';
import { HOUR_MS } from '../constants';
import { type ChartTarget, type ChartHost, pvValueAtTime, clockTargetLabel, solarSourceName,
    gridImportName, gridExportName, batteryChargeName, batteryDischargeName } from './charts';
import { ENERGY_COLOR, energySolarColor, lerpHexToward, formatLocalisedNumber, cssHex, uiColorVar } from './format';
import type { UnifiedDataStore } from './unifiedStore';
import { customEntityId, customEntityColor, valueDecimals } from '../helios-config';
import { resolveCustomEntityIcon } from './custom-entity';
import type { ClockHourly } from './clock-hourly';
import { modeBucketsPerHour, type TimelineMode } from './timeline-modes';
import type { EnergyDefaults } from './energy-prefs';
import { pickTranslations } from '../i18n';

//Structural surface the clock reads off the card. It already satisfies ChartHost (the bottom chart consumes
//it); themeIsDark resolves the live palette polarity for the per-source colour ramp.
export type ClockHost = ChartHost & {
    themeIsDark(): boolean;
    _weatherAvailable: boolean;
    _timelineMode: TimelineMode;
    _energyDefaults: EnergyDefaults;
    //Decoupled hourly profile, present only when the store is sub-hourly (month/year) + clock mode. When set,
    //buildClockData reads it instead of the daily store so the dial still shows an hour-of-day shape.
    _clockHourly: ClockHourly | null;
};

//Ring geometry, expressed as fractions of the smaller viewport edge so the clock fills the card at any size.
const RING_R_FRAC     = 0.34;   //outermost ring radius
const RING_INNER_MIN_FRAC = 0.4;//innermost concentric ring radius as a fraction of the outer one
const CLOCK_MAX_FILTERS = 8;    //fixed slot count: rings always sit at their slot radius, so adding/removing
                                //a filter never re-spaces the others (and the radii are constant)
const MAX_HEIGHT_FRAC = 0.30;   //tallest area / bar
//Area mode: a translucent base fill (the curve lines stay full opacity); the hovered slice ramps to full.
const AREA_FILL_BASE  = 0.5;
//Histogram mode: bar tangential half-width (frac of the smaller edge, scaled per ring) and radial half-depth
//(a fraction of the slot spacing so consecutive rings' bars sit flush).
const BAR_TANGENT_FRAC = 0.018;
const BAR_RADIAL_FRAC  = 0.45;
const LABEL_R_MULT    = 1.18;   //hour labels sit just outside the ring
const LABEL_MIN_OPACITY = 0.15; //farthest-back hour label opacity (nearest is opaque)
//Clock-face guide: a faint centre ring (radius as a fraction of the outer ring) with 24 spokes reaching out
//toward — but stopping short of — the hour labels, so the eye can trace an area to its hour.
const CLOCK_HUB_R_FRAC      = 0.12;
const CLOCK_SPOKE_OUTER_FRAC = 1.10;
const CLOCK_GUIDE_OPACITY   = 0.25;
//Compass: filled N/S triangles just beyond the hour labels (fractions of the outer ring radius), with a
//letter at each tip. Full opacity (no depth fade), so the orientation always reads.
const CLOCK_COMPASS_BASE_FRAC   = 1.30;
const CLOCK_COMPASS_TIP_FRAC    = 1.42;
const CLOCK_COMPASS_HALF_W_FRAC = 0.05;
const CLOCK_COMPASS_LABEL_FRAC  = 1.50;
//Grow/shrink + slot-slide duration: a ring rises (ease-out) over GROW_MS when added, falls + fades over it
//when removed, and slides between slots over it when the stack recompacts.
export const CLOCK_GROW_MS = 320;
//Shared ease-out for every clock transition (grow, shrink, slide, dim). p clamped to 0..1.
export function easeOutCubic(p: number): number
{
    const c = p < 0 ? 0 : p > 1 ? 1 : p;
    return 1 - (1 - c) ** 3;
}
//How close (screen px) the cursor must be to an hour's axis to hover it.
const HOVER_PX = 22;


//The two clock sub-modes: a continuous stacked AREA curve, or the classic stacked-bar HISTOGRAM (one bar per
//hour, sitting BETWEEN the hour lines). Both read off the same ClockData — the histogram aggregates the slot
//series to hourly on the fly — so only the geometry differs.
export type ClockMode = 'area' | 'histogram';

//One stacked layer of a metric: a per-slot series (clockSlots() values) drawn as a filled area swept around
//the dial (or aggregated to 24 hourly bars in histogram mode). Layers stack cumulatively.
export interface ClockLayer
{
    color:      string;
    icon:       string;
    label:      string;       //per-source name for production layers, else ''
    values:     number[];     //clockSlots() per-slot magnitudes (W, %, or W/m²)
    predicted?: boolean;      //forecast-only layer (no actuals) — rendered translucent
}

export interface ClockData
{
    target: ChartTarget;
    layers: ClockLayer[];
    //The metric's representative colour, used for the rail button + the hovered slice glow.
    color:  string;
    //Tooltip value formatter + aggregation. 'energy' metrics (production/consumption/grid/battery) SUM the kWh
    //over the window per hour-of-day (a total, the user's ask); 'power'/'percent'/'irradiance' AVERAGE.
    unit:   'energy' | 'power' | 'percent' | 'irradiance';
}

//One ring to project, with its live animation scalars resolved by the card: `slot` is the (possibly
//fractional) ring index driving the radius — the card interpolates it for the slide; `heightScale` is the
//0..1 vertical grow/shrink; `opacity` the 0..1 exit fade.
export interface ClockRingInput
{
    data:        ClockData;
    slot:        number;
    heightScale: number;
    opacity:     number;
}

//Screen-space hit target: a vertical axis (base -> top) tagged with its slot. Area mode emits one per slot;
//histogram mode one per hourly bar (tagged with that hour's first slot). Hovering highlights it.
export interface ClockHit { slot: number; bx: number; by: number; tx: number; ty: number; }

//One projected frame, split into two stacked SVG layers plus the per-element transforms the card writes onto
//its DOM nodes. `guideSvg` is the flat-ground guide (centre hub + 24 hour spokes + compass), painted UNDER
//the home prism; `svg` is the upright metric cylinders, painted OVER it.
export interface ClockFrame
{
    guideSvg: string;
    svg:    string;
    hits:   ClockHit[];
    labels: { x: number; y: number; opacity: number; transform: string }[];
    //N/S compass letters, laid flat like the hours but at full opacity (no depth fade).
    compass: { x: number; y: number; transform: string; label: string }[];
}


//Distance from point (px,py) to segment (ax,ay)-(bx,by), in screen px.
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number
{
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}


//Dial resolution: sub-hourly slots binning the metric finer than hourly. Driven by the config's graph-detail
//setting (slots/hour = display-update-frequency-per-hour, 1..12) so the area curve is drawn at that many
//points per hour; the per-hour TOTALS are unchanged (more/fewer points, same area). 24 hour labels still mark
//the dial; each hour spans clockSlotsPerHour() slots. Module-private state so other modules read the live
//value through the getter (an ES live binding); never an exported mutable binding (lint: no-mutable-exports).
let _slotsPerHour = 4;
export function clockSlotsPerHour(): number { return _slotsPerHour; }
export function clockSlots(): number { return 24 * _slotsPerHour; }
//Set once before each (re)build of the clock data, so every binning/projection uses the current config's
//slot count. Clamped to [1,12]; the dial always stays 24 hours.
export function setClockResolution(n: number): void
{
    _slotsPerHour = !Number.isFinite(n) ? 4 : Math.min(12, Math.max(1, Math.round(n)));
}

//Slot-of-day [0..clockSlots()) for a local time.
function slotOf(d: Date): number
{
    return d.getHours() * _slotsPerHour + Math.floor(d.getMinutes() / (60 / _slotsPerHour));
}

//Fill NaN gaps by linear interpolation between the nearest real samples, wrapping around the dial, so a
//metric whose source is HOURLY (binned into sparse sub-hour slots — custom entity, battery SoC, cloud) reads
//as a smooth ramp instead of a spike once per hour. Store-backed metrics are sub-hour dense, so there are no
//gaps and this is a no-op. All-NaN (no data at all) collapses to zeros.
function fillGaps(v: number[]): number[]
{
    const n = v.length;
    if (!v.some(x => Number.isFinite(x))) { return new Array<number>(n).fill(0); }
    const out = v.slice();
    for (let i = 0; i < n; i++)
    {
        if (Number.isFinite(out[i])) { continue; }
        let db = 1; while (!Number.isFinite(v[((i - db) % n + n) % n])) { db++; }
        let df = 1; while (!Number.isFinite(v[(i + df) % n])) { df++; }
        const a = v[((i - db) % n + n) % n];
        const b = v[(i + df) % n];
        out[i] = a + (b - a) * (db / (db + df));
    }
    return out;
}

//Expand a 24-value hour-of-day profile (decoupled hourly clock source) to the dial's per-slot resolution. For
//`sum` (energy) the hour's TOTAL is split evenly across its slots, so per-slot reads as the 15-min energy and
//re-summing the hour recovers the total; otherwise the hourly value is HELD across its slots (the per-slot
//currency is then the hourly value, and a histogram averages back to it).
function expandHourly(hourly: number[], sum: boolean): number[]
{
    const slots = clockSlots();
    const out = new Array<number>(slots);
    for (let i = 0; i < slots; i++)
    {
        const v = Math.max(0, hourly[Math.floor(i / _slotsPerHour)] ?? 0);
        out[i] = sum ? v / _slotsPerHour : v;
    }
    return out;
}

//Bin one store series into per-slot averages of its absolute value (export/charge come back negative); empty
//slots stay NaN so fillGaps can interpolate them rather than reading as a zero spike.
function binSlotAvg(store: UnifiedDataStore, series: (number | null)[]): number[]
{
    const sum = new Array<number>(clockSlots()).fill(0);
    const cnt = new Array<number>(clockSlots()).fill(0);
    for (let i = 0; i < store.bucketsTotal; i++)
    {
        const v = series[i];
        if (v === null || !isFinite(v)) { continue; }
        const s = slotOf(new Date(store.storeStartMs + (i + 0.5) * store.stepMs));
        sum[s] += Math.abs(v);
        cnt[s] += 1;
    }
    return fillGaps(sum.map((x, s) => (cnt[s] ? x / cnt[s] : NaN)));
}

//Sum one store WATTS series into per-slot ENERGY (kWh) by hour-of-day across the window. Each bucket's energy is
//SPREAD across the 15-min slots it actually covers, so a coarse store (e.g. hourly buckets in month mode) fills
//every slot evenly instead of dumping a whole hour into one slot and leaving the other three at 0 (the sawtooth).
//Summing kWh directly (not watts/duration) also keeps DST-folded buckets from inflating. This is the clock's
//"total per period".
function binSlotSum(store: UnifiedDataStore, series: (number | null)[]): number[]
{
    const sum    = new Array<number>(clockSlots()).fill(0);
    const stepH  = store.stepMs / HOUR_MS;
    const slotMs = HOUR_MS / _slotsPerHour;
    for (let i = 0; i < store.bucketsTotal; i++)
    {
        const v = series[i];
        if (v === null || !isFinite(v)) { continue; }
        const energy = (Math.max(0, v) * stepH) / 1000;   //kWh for this bucket
        const bStart = store.storeStartMs + i * store.stepMs;
        const bEnd   = bStart + store.stepMs;
        for (let t = bStart; t < bEnd; )
        {
            const slotEnd = Math.floor(t / slotMs) * slotMs + slotMs;
            const segEnd  = Math.min(bEnd, slotEnd);
            sum[slotOf(new Date(t))] += energy * ((segEnd - t) / store.stepMs);
            t = segEnd;
        }
    }
    return sum;
}

//True when a series carries any real (non-null, non-zero) reading — drives which rail buttons appear.
function hasSignal(series: (number | null)[] | undefined): boolean
{
    return !!series && series.some(v => v !== null && isFinite(v) && v !== 0);
}


//The metrics the rail offers, in display order, filtered to those actually configured/loaded so the buttons
//stack with no gaps. Production sits first, then consumption, the battery pair, grid, and the weather metrics.
export function availableClockTargets(host: ClockHost): ChartTarget[]
{
    const store = host._unifiedStore;
    const hasProduction = host._pvHistoryPerEntity.size > 0
        || hasSignal(store?.production) || hasSignal(store?.forecast);
    const hasGrid    = hasSignal(store?.gridImport) || hasSignal(store?.gridExport);
    const hasBattery = hasSignal(store?.battery);
    const hasSoc     = !!host._batterySocHistory && host._batterySocHistory.values.length > 0;

    const out: ChartTarget[] = [];
    if (hasProduction) { out.push('production'); }
    if (hasProduction || hasGrid || hasBattery) { out.push('consumption'); }
    if (hasSoc)     { out.push('battery-soc'); }
    if (hasBattery) { out.push('battery'); }
    if (hasGrid)    { out.push('grid'); }
    //Weather metrics only when the active mode offers them (off for month/year).
    if (host._weatherAvailable && hasSignal(store?.irradiance)) { out.push('irradiance'); }
    if (host._weatherAvailable && hasSignal(store?.cloud))      { out.push('cloud'); }
    //Custom entity sits last, present whenever it's configured (its ring may be sparse until history lands).
    if (customEntityId(host.config))  { out.push('custom'); }
    return out;
}

//Rail button appearance per metric: a single glyph + the metric's colour (idle icon tint + active fill).
export function clockTargetMeta(host: ClockHost, target: ChartTarget): { icon: string; color: string }
{
    const el = host as unknown as Element;
    switch (target)
    {
        case 'consumption': return { icon: 'mdi:home-lightning-bolt', color: ENERGY_COLOR.consumption(el) };
        case 'grid':        return { icon: 'mdi:transmission-tower',   color: ENERGY_COLOR.gridImport(el) };
        case 'battery':     return { icon: 'mdi:battery-charging',     color: ENERGY_COLOR.batteryOut(el) };
        case 'battery-soc': return { icon: 'mdi:battery',              color: ENERGY_COLOR.batteryOut(el) };
        case 'irradiance':  return { icon: 'mdi:white-balance-sunny',  color: ENERGY_COLOR.sun(el) };
        case 'cloud':       return { icon: 'mdi:weather-cloudy',       color: ENERGY_COLOR.cloud(el) };
        case 'custom':      return { icon: resolveCustomEntityIcon(host.hass, host.config), color: cssHex(el, uiColorVar(customEntityColor(host.config), 'red'), '#f44336') };
        default:            return { icon: 'mdi:solar-power',          color: ENERGY_COLOR.pv(el) };
    }
}

//clockTargetLabel lives in charts.ts (single label source); re-exported so callers importing from the clock keep working.
export { clockTargetLabel };


//Build layers from the decoupled hourly profile (month/year, where the store is daily): each metric expands
//its 24 hour-of-day totals to the dial's slots. Production splits per solar source like the short-window path;
//weather metrics aren't offered in these modes, so they fall through to empty.
function buildClockDataHourly(host: ClockHost, target: ChartTarget, h: ClockHourly): ClockData
{
    const el   = host as unknown as Element;
    const dark = host.themeIsDark();
    const meta = clockTargetMeta(host, target);
    const data = (unit: ClockData['unit'], layers: ClockLayer[]): ClockData => ({ target, color: meta.color, unit, layers });
    //Energy metrics expand their hour TOTALS (split across slots); soc/custom hold their hourly average.
    const oneE = (color: string, icon: string, label: string, v: number[]): ClockLayer => ({ color, icon, label, values: expandHourly(v, true) });
    const oneA = (color: string, icon: string, label: string, v: number[]): ClockLayer => ({ color, icon, label, values: expandHourly(v, false) });
    const tgtLabel = clockTargetLabel(host, target);
    switch (target)
    {
        case 'production':  return data('energy', h.pv.map((vals, s) => oneE(energySolarColor(el, dark, s), 'mdi:solar-power', solarSourceName(host, s), vals)));
        case 'consumption': return data('energy', [oneE(ENERGY_COLOR.consumption(el), 'mdi:home-lightning-bolt', tgtLabel, h.consumption)]);
        case 'grid':        return data('energy', [
            oneE(ENERGY_COLOR.gridImport(el), 'mdi:transmission-tower-import', gridImportName(host), h.gridImport),
            oneE(ENERGY_COLOR.gridExport(el), 'mdi:transmission-tower-export', gridExportName(host), h.gridExport),
        ]);
        case 'battery':     return data('energy', [
            oneE(ENERGY_COLOR.batteryOut(el), 'mdi:battery-arrow-up',   batteryDischargeName(host), h.batteryDischarge),
            oneE(ENERGY_COLOR.batteryIn(el),  'mdi:battery-arrow-down', batteryChargeName(host),   h.batteryCharge),
        ]);
        case 'battery-soc': return data('percent', [oneA(ENERGY_COLOR.batteryOut(el), 'mdi:battery', tgtLabel, h.soc)]);
        case 'custom':      return data('power', [oneA(meta.color, meta.icon, tgtLabel, h.custom)]);
        default:            return data(target === 'irradiance' ? 'irradiance' : 'energy', []);
    }
}

//Build the stacked layers for the active metric. Production keeps a per-PV-string breakdown (plus a forecast
//layer covering hours with no actuals yet); every other metric reuses the store series the timeline draws,
//binned by hour-of-day — same numbers, same colours. On a long window the daily store carries no intraday
//shape, so a decoupled hourly profile (host._clockHourly) takes over.
export function buildClockData(host: ClockHost, target: ChartTarget): ClockData
{
    if (host._clockHourly) { return buildClockDataHourly(host, target, host._clockHourly); }

    const store  = host._unifiedStore;
    const el     = host as unknown as Element;
    const dark   = host.themeIsDark();
    const meta   = clockTargetMeta(host, target);

    const data = (unit: ClockData['unit'], layers: ClockLayer[]): ClockData =>
        ({ target, color: meta.color, unit, layers });

    //Month/year need the decoupled hourly profile; until it lands, render an empty baseline rather than the
    //daily store, which carries no hour-of-day shape and would draw a flat full-height ring.
    if (modeBucketsPerHour(host._timelineMode, host.config) < 1)
    {
        return data(target === 'irradiance' ? 'irradiance' : 'energy', []);
    }

    if (target === 'production')
    {
        if (!store) { return data('energy', []); }
        //Source order (NOT sorted): the per-entity map is built in HA Energy source order, parallel to
        //solarStatEnergyFroms, so string `s` here lines up with solarSourceName(host, s) + the other paths.
        const ids = Array.from(host._pvHistoryPerEntity.keys());
        const nowMs = Date.now();
        const stepH  = store.stepMs / HOUR_MS;
        const slotMs = HOUR_MS / _slotsPerHour;
        //Per-source energy (kWh) SUMMED by hour-of-day: each bucket's power * its hours, SPREAD across the slots
        //the bucket covers (so a coarse month/year store fills every slot instead of one — same fix as binSlotSum).
        const wsum = ids.map(() => new Array<number>(clockSlots()).fill(0));
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs > nowMs) { break; }
            const bStart = store.storeStartMs + i * store.stepMs;
            const bEnd   = bStart + store.stepMs;
            ids.forEach((id, s) =>
            {
                const ph = host._pvHistoryPerEntity.get(id);
                if (!ph) { return; }
                const v = pvValueAtTime(host, tMs, ph).value;
                if (!(isFinite(v) && v > 0)) { return; }
                const energy = (v * stepH) / 1000;
                for (let t = bStart; t < bEnd; )
                {
                    const slotEnd = Math.floor(t / slotMs) * slotMs + slotMs;
                    const segEnd  = Math.min(bEnd, slotEnd);
                    wsum[s][slotOf(new Date(t))] += energy * ((segEnd - t) / store.stepMs);
                    t = segEnd;
                }
            });
        }
        //Actuals only: the clock shows recorded energy, no forecast layer (a translucent forecast ring read as
        //real PV and misled — the timeline carries the forecast instead).
        const layers: ClockLayer[] = ids.map((_id, s) => ({
            color: energySolarColor(el, dark, s),
            icon:  'mdi:solar-power',
            label: solarSourceName(host, s),
            values: wsum[s],
        }));
        return data('energy', layers);
    }

    //Average a sum/count pair into a per-slot series, interpolating empty slots (hourly sources land in 1 of
    //every 4 slots — fillGaps ramps between them instead of spiking).
    const avgOf = (s: number[], c: number[]): number[] => fillGaps(s.map((v, i) => (c[i] ? v / c[i] : NaN)));

    if (target === 'battery-soc')
    {
        const hist = host._batterySocHistory;
        const sum = new Array<number>(clockSlots()).fill(0);
        const cnt = new Array<number>(clockSlots()).fill(0);
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const v = hist.values[i];
                if (!isFinite(v)) { continue; }
                const h = slotOf(hist.times[i]);
                sum[h] += v; cnt[h] += 1;
            }
        }
        return data('percent', [{ color: ENERGY_COLOR.batteryOut(el), icon: 'mdi:battery', label: clockTargetLabel(host, target), values: avgOf(sum, cnt) }]);
    }

    if (target === 'cloud')
    {
        const cs = host._chartSeries;
        const slots = clockSlots();
        const sum = [new Array<number>(slots).fill(0), new Array<number>(slots).fill(0), new Array<number>(slots).fill(0)];
        const cnt = [new Array<number>(slots).fill(0), new Array<number>(slots).fill(0), new Array<number>(slots).fill(0)];
        if (cs)
        {
            for (let i = 0; i < cs.times.length; i++)
            {
                const h = slotOf(cs.times[i]);
                const vals = [cs.cloudLow[i], cs.cloudMid[i], cs.cloudHigh[i]];
                vals.forEach((v, b) => { if (isFinite(v)) { sum[b][h] += Math.max(0, v); cnt[b][h] += 1; } });
            }
        }
        const base  = ENERGY_COLOR.cloud(el);
        const cols  = [lerpHexToward(base, '#ffffff', 0.55), base, lerpHexToward(base, '#000000', 0.50)];
        const icons = ['mdi:format-vertical-align-bottom', 'mdi:format-vertical-align-center', 'mdi:format-vertical-align-top'];
        const cl    = pickTranslations(host.hass?.language).clock;
        const names = [cl.cloudLow, cl.cloudMid, cl.cloudHigh];
        return data('percent', [0, 1, 2].map(b => ({ color: cols[b], icon: icons[b], label: names[b], values: avgOf(sum[b], cnt[b]) })));
    }

    if (target === 'custom')
    {
        //Custom entity from its fetched 5-min history (values in W), binned by slot-of-day. One red layer.
        const hist = host._customEntityHistory;
        const sum = new Array<number>(clockSlots()).fill(0);
        const cnt = new Array<number>(clockSlots()).fill(0);
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const v = hist.values[i];
                if (!isFinite(v)) { continue; }
                const h = slotOf(hist.times[i]);
                sum[h] += Math.abs(v); cnt[h] += 1;
            }
        }
        return data('power', [{ color: meta.color, icon: meta.icon, label: clockTargetLabel(host, target), values: avgOf(sum, cnt) }]);
    }

    //Remaining metrics are single- or dual-layer store series, binned by hour-of-day.
    if (!store) { return data(target === 'irradiance' ? 'irradiance' : 'energy', []); }

    let specs: { series: (number | null)[]; color: string; icon: string; label: string }[];
    //Energy metrics SUM kWh per hour-of-day; irradiance AVERAGES W/m².
    let unit: ClockData['unit'] = 'energy';
    if (target === 'grid')
    {
        specs = [
            { series: store.gridImport, color: ENERGY_COLOR.gridImport(el), icon: 'mdi:transmission-tower-import', label: gridImportName(host) },
            { series: store.gridExport, color: ENERGY_COLOR.gridExport(el), icon: 'mdi:transmission-tower-export', label: gridExportName(host) },
        ];
    }
    else if (target === 'battery')
    {
        //Signed net power: positive = charging. Split into two non-negative layers.
        const charge:    (number | null)[] = store.battery.map(v => (v === null ? null : Math.max(0, v)));
        const discharge: (number | null)[] = store.battery.map(v => (v === null ? null : Math.max(0, -v)));
        specs = [
            { series: discharge, color: ENERGY_COLOR.batteryOut(el), icon: 'mdi:battery-arrow-up',   label: batteryDischargeName(host) },
            { series: charge,    color: ENERGY_COLOR.batteryIn(el),  icon: 'mdi:battery-arrow-down', label: batteryChargeName(host) },
        ];
    }
    else if (target === 'irradiance')
    {
        unit  = 'irradiance';
        specs = [{ series: store.irradiance, color: ENERGY_COLOR.sun(el), icon: 'mdi:white-balance-sunny', label: clockTargetLabel(host, target) }];
    }
    else
    {
        //Consumption derived per bucket: production + import − export − net battery, clamped at 0.
        const cons: (number | null)[] = new Array(store.bucketsTotal).fill(null);
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const p = store.production[i]; const gi = store.gridImport[i];
            const ge = store.gridExport[i]; const b = store.battery[i];
            if (p === null && gi === null && ge === null && b === null) { continue; }
            cons[i] = Math.max(0, (p ?? 0) + (gi ?? 0) - (ge ?? 0) - (b ?? 0));
        }
        specs = [{ series: cons, color: ENERGY_COLOR.consumption(el), icon: 'mdi:home-lightning-bolt', label: clockTargetLabel(host, target) }];
    }

    const agg = unit === 'energy' ? binSlotSum : binSlotAvg;
    return data(unit, specs.map(s => ({ color: s.color, icon: s.icon, label: s.label, values: agg(store, s.series) })));
}


//Fraction of the outer radius for ring slot `i`. Slots are FIXED (reserved for CLOCK_MAX_FILTERS rings): slot
//0 is the outer ring, each next slot a constant step inward to RING_INNER_MIN_FRAC. Independent of how many
//filters are active, so adding/removing one never re-spaces the others.
function ringRadiusFrac(i: number): number
{
    const slot = Math.min(i, CLOCK_MAX_FILTERS - 1);
    return 1 - slot * (1 - RING_INNER_MIN_FRAC) / (CLOCK_MAX_FILTERS - 1);
}

//Constant slot spacing (metres) between concentric rings; histogram bars are half of it deep so neighbours
//sit flush.
function ringSpacingM(outerR: number): number
{
    return outerR * (1 - RING_INNER_MIN_FRAC) / (CLOCK_MAX_FILTERS - 1);
}

//Aggregate a per-slot series to 24 hourly values for the histogram bars (each bar = one hour H..H+1). `sum`
//(energy) totals the hour's slots; otherwise (power/percent/irradiance) it averages them.
function hourlyOf(values: number[], sum: boolean): number[]
{
    const out = new Array<number>(24).fill(0);
    const sph = _slotsPerHour;
    for (let h = 0; h < 24; h++)
    {
        let s = 0;
        for (let j = 0; j < sph; j++) { s += Math.max(0, values[h * sph + j] ?? 0); }
        out[h] = sum ? s : s / sph;
    }
    return out;
}

//Busiest stacked total of a ring in the given mode (slot total for area, hourly total for histogram). Drives
//the per-UNIT shared ceiling, so two metrics in the same unit are plotted on the exact same axis — a 2 kW and
//a 5 kW power metric read at the right relative heights instead of both filling their own ring.
function ringMax(data: ClockData, mode: ClockMode): number
{
    let m = 0;
    if (mode === 'histogram')
    {
        const hourly = data.layers.map(L => hourlyOf(L.values, data.unit === 'energy'));
        for (let h = 0; h < 24; h++) { let t = 0; for (const hv of hourly) { t += Math.max(0, hv[h]); } m = Math.max(m, t); }
    }
    else
    {
        const slots = clockSlots();
        for (let sl = 0; sl < slots; sl++) { let t = 0; for (const L of data.layers) { t += Math.max(0, L.values[sl] ?? 0); } m = Math.max(m, t); }
    }
    return m;
}

//Rectangular bar footprint (metres) for histogram mode, oriented to `angle`: `hr` half-depth along the radius
//(rings sit flush), `ht` half-width along the tangent. Four sides — cheap to redraw each rotation frame.
function foot(cx: number, cy: number, hr: number, ht: number, angle: number): [number, number][]
{
    const rs = Math.sin(angle); const rc = Math.cos(angle);
    const ts = Math.cos(angle); const tc = -Math.sin(angle);
    return [
        [cx + hr * rs + ht * ts, cy + hr * rc + ht * tc],
        [cx + hr * rs - ht * ts, cy + hr * rc - ht * tc],
        [cx - hr * rs - ht * ts, cy - hr * rc - ht * tc],
        [cx - hr * rs + ht * ts, cy - hr * rc + ht * tc],
    ];
}

//Draw one extruded histogram column split into stacked bands, back-to-front by depth, with a roof cap. Pure
//geometry through the shared camera; the caller resolves each band's fill.
function stackedColumn(
    camera: SceneCamera,
    footprint: [number, number][],
    totalHeightM: number,
    bands: { frac: number; wall: string; roof: string }[],
    stroke: string
): string
{
    if (!bands.length) { return ''; }
    const cum = [0];
    for (const b of bands) { cum.push(cum[cum.length - 1] + b.frac); }
    cum[cum.length - 1] = 1;
    const levels  = cum.map(c => footprint.map(p => camera.project(p[0], p[1], totalHeightM * c)));
    const bearing = camera.bearingDeg * Math.PI / 180;
    const edges: { depth: number; faces: string }[] = [];
    for (let i = 0; i < footprint.length; i++)
    {
        const next = (i + 1) % footprint.length;
        //Back-face cull: drop walls whose outward normal faces away from the camera.
        const edgeE = footprint[next][0] - footprint[i][0];
        const edgeN = footprint[next][1] - footprint[i][1];
        if (edgeN * Math.sin(bearing) + edgeE * Math.cos(bearing) <= 0) { continue; }
        let walls = '';
        for (let k = 0; k < bands.length; k++)
        {
            const lo = levels[k]; const hi = levels[k + 1];
            walls += `<polygon points="${lo[i][0].toFixed(1)},${lo[i][1].toFixed(1)} ${lo[next][0].toFixed(1)},${lo[next][1].toFixed(1)} ${hi[next][0].toFixed(1)},${hi[next][1].toFixed(1)} ${hi[i][0].toFixed(1)},${hi[i][1].toFixed(1)}" fill="${bands[k].wall}" stroke="${stroke}" stroke-width="0.4"/>`;
        }
        edges.push({ depth: (levels[0][i][1] + levels[0][next][1]) / 2, faces: walls });
    }
    edges.sort((a, b) => a.depth - b.depth);
    let svg = edges.map(e => e.faces).join('');
    const roof = levels[levels.length - 1].map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    svg += `<polygon points="${roof}" fill="${bands[bands.length - 1].roof}" stroke="${stroke}" stroke-width="0.6"/>`;
    return svg;
}

//Flat-on-ground highlight wedge for the focused hour (area mode only): a pie sector between the hour-H and
//hour-(H+1) spoke angles, from the central hub out to the spokes' outer radius. The inner + outer arcs are
//sampled at a few sub-angles and projected through the camera, so the sector reads as a curved slice in the
//2.5D view. Filled translucent in the focused metric's colour (neutral white when none), ramped by `dim` so
//it fades in/out with the rest of the focus. Drawn in the guide pass, UNDER the cylinders.
function clockWedge(camera: SceneCamera, outerR: number, hour: number, color: string, dim: number): string
{
    const innerR = outerR * CLOCK_HUB_R_FRAC;
    const outerW = outerR * CLOCK_SPOKE_OUTER_FRAC;
    const a0 = (hour / 24) * 2 * Math.PI;
    const a1 = ((hour + 1) / 24) * 2 * Math.PI;
    const STEPS = 6;
    const pts: string[] = [];
    for (let i = 0; i <= STEPS; i++)
    {
        const a = a0 + (a1 - a0) * (i / STEPS);
        const p = camera.project(outerW * Math.sin(a), outerW * Math.cos(a), 0);
        pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    }
    for (let i = STEPS; i >= 0; i--)
    {
        const a = a0 + (a1 - a0) * (i / STEPS);
        const p = camera.project(innerR * Math.sin(a), innerR * Math.cos(a), 0);
        pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    }
    const op = (0.15 * dim).toFixed(3);
    return `<polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="${op}"/>`;
}

//Clock-face guide laid flat on the ground (under the cylinders): a faint centre ring + a spoke per hour
//reaching from the ring toward each hour label, stopping short so it never overlaps the text. Theme colour,
//low opacity. The focused hour's spoke ramps to full opacity with `dim` (0..1), so the selected slice's
//line lights up. `outerR` is the outermost ring radius in metres.
function clockGuide(camera: SceneCamera, outerR: number, focusHour: number | null, dim: number): string
{
    const col   = 'var(--primary-text-color, #212121)';
    const hubR  = outerR * CLOCK_HUB_R_FRAC;
    const tipR  = outerR * CLOCK_SPOKE_OUTER_FRAC;

    //Centre ring + outer ring (at the spoke ends) as closed polygons projected on the ground, so the spokes
    //read as 24 closed pie slices rather than loose lines.
    const ringAt = (r: number, n: number): string =>
    {
        const pts: string[] = [];
        for (let i = 0; i <= n; i++)
        {
            const a = (i / n) * 2 * Math.PI;
            const p = camera.project(r * Math.sin(a), r * Math.cos(a), 0);
            pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
        }
        return `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-opacity="${CLOCK_GUIDE_OPACITY}" stroke-width="1"/>`;
    };
    let svg = ringAt(hubR, 32) + ringAt(tipR, 64);

    //24 spokes, each along its hour angle from the ring edge out toward the label.
    for (let h = 0; h < 24; h++)
    {
        const a  = (h / 24) * 2 * Math.PI;
        const p1 = camera.project(hubR * Math.sin(a), hubR * Math.cos(a), 0);
        const p2 = camera.project(tipR * Math.sin(a), tipR * Math.cos(a), 0);
        const focused = h === focusHour;
        const op = focused ? CLOCK_GUIDE_OPACITY + (1 - CLOCK_GUIDE_OPACITY) * dim : CLOCK_GUIDE_OPACITY;
        svg += `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" stroke="${col}" stroke-opacity="${op.toFixed(3)}" stroke-width="${focused ? '1.5' : '1'}"/>`;
    }
    return svg;
}

//Compass laid flat on the ground just beyond the hour labels: filled triangles for the four cardinals (North
//red like a needle, the others primary-text), each with a localised letter at its tip oriented like the hours.
//Returns the triangle SVG + the four letter placements (the card renders those as DOM, at full opacity).
function clockCompass(
    camera: SceneCamera, outerR: number, bearing: number, tilt: number,
    cardinals: { n: string; s: string; e: string; w: string }
): { svg: string; labels: ClockFrame['compass'] }
{
    const baseR  = outerR * CLOCK_COMPASS_BASE_FRAC;
    const tipR   = outerR * CLOCK_COMPASS_TIP_FRAC;
    const halfW  = outerR * CLOCK_COMPASS_HALF_W_FRAC;
    const labelR = outerR * CLOCK_COMPASS_LABEL_FRAC;
    const red    = 'var(--red-color, #f44336)';
    const text   = 'var(--primary-text-color, #212121)';

    const triangle = (angle: number, color: string): string =>
    {
        const rs = Math.sin(angle); const rc = Math.cos(angle);   //radial (outward) unit
        const ts = Math.cos(angle); const tc = -Math.sin(angle);  //tangential unit
        const tip = camera.project(tipR * rs, tipR * rc, 0);
        const b1  = camera.project(baseR * rs + halfW * ts, baseR * rc + halfW * tc, 0);
        const b2  = camera.project(baseR * rs - halfW * ts, baseR * rc - halfW * tc, 0);
        return `<polygon points="${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${b1[0].toFixed(1)},${b1[1].toFixed(1)} ${b2[0].toFixed(1)},${b2[1].toFixed(1)}" fill="${color}"/>`;
    };
    //North at angle 0 (hour-0), East at π/2 (hour-6), South at π (hour-12), West at 3π/2 (hour-18). Letters
    //reuse the hour transform via their hour-equivalent direction.
    const dirs = [
        { angle: 0,            label: cardinals.n, hourEquiv: 0,  color: red },
        { angle: Math.PI / 2,  label: cardinals.e, hourEquiv: 6,  color: text },
        { angle: Math.PI,      label: cardinals.s, hourEquiv: 12, color: text },
        { angle: 3 * Math.PI / 2, label: cardinals.w, hourEquiv: 18, color: text },
    ];
    const svg = dirs.map(d => triangle(d.angle, d.color)).join('');
    const labels = dirs.map(({ angle, label, hourEquiv }) =>
    {
        const p = camera.project(labelR * Math.sin(angle), labelR * Math.cos(angle), 0);
        return {
            x: p[0], y: p[1], label,
            transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + (hourEquiv / 24) * 360 + 180}deg)`,
        };
    });
    return { svg, labels };
}

interface ClockFace { depth: number; svg: string }

//Project one frame for ALL selected metrics as concentric rings (outer first, nesting inward), in the chosen
//sub-mode. SHARED here: the 24 hour labels, the under-dial guide + compass, the per-ring glow defs, and the
//global back-to-front depth sort. Per-mode geometry lives in projectAreaRing / projectHistogramRing. Pure —
//the card resolves each ring's animation scalars (slot/heightScale/opacity) + the focused slot.
export function projectClockFrame(
    camera: SceneCamera,
    rings: ClockRingInput[],
    mode: ClockMode,
    //Focused slot (hover/tap) + the 0..1 fade ramp. dimSlot persists through the fade-out so it ramps smoothly.
    dimSlot: number | null,
    dim: number,
    //Localised compass letters (N/S/E/W — e.g. W→O in French), supplied by the card.
    cardinals: { n: string; s: string; e: string; w: string }
): ClockFrame
{
    const minEdge = Math.min(camera.centreX * 2, camera.centreY * 2) || 1;
    const ppm     = camera.pxPerMetre || 1;
    const outerR  = (RING_R_FRAC * minEdge) / ppm;
    const maxHm   = (MAX_HEIGHT_FRAC * minEdge) / ppm;   //tallest area / bar, in metres
    const tilt    = camera.tiltDeg;
    const bearing = camera.bearingDeg;

    //Hour labels, laid flat just outside the OUTER ring; each fades with its distance from the camera.
    const labelR = outerR * LABEL_R_MULT;
    const projLabels = Array.from({ length: 24 }, (_, h) =>
        camera.project3(labelR * Math.sin((h / 24) * 2 * Math.PI), labelR * Math.cos((h / 24) * 2 * Math.PI), 0));
    let depthMin = Infinity; let depthMax = -Infinity;
    for (const p of projLabels) { depthMin = Math.min(depthMin, p.depth); depthMax = Math.max(depthMax, p.depth); }
    const depthRange = depthMax - depthMin || 1;
    const labels = projLabels.map((p, h) => ({
        x: p.x, y: p.y,
        opacity: LABEL_MIN_OPACITY + (1 - LABEL_MIN_OPACITY) * (p.depth - depthMin) / depthRange,
        transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + (h / 24) * 360 + 180}deg)`,
    }));

    //Shared per-UNIT ceiling: every ring of the same unit normalises against the busiest among them, so
    //same-unit metrics share one axis (no read dissonance). Different units keep their own ceiling.
    const unitMax = new Map<string, number>();
    for (const ring of rings) { const u = ring.data.unit; unitMax.set(u, Math.max(unitMax.get(u) ?? 0, ringMax(ring.data, mode))); }

    const hits:  ClockHit[]  = [];
    const faces: ClockFace[] = [];
    rings.forEach((ring, ri) =>
    {
        const R = outerR * ringRadiusFrac(ring.slot);
        const ceiling = unitMax.get(ring.data.unit) ?? 0;
        if (mode === 'histogram') { projectHistogramRing(camera, R, outerR, ring, ri, maxHm, ceiling, minEdge, ppm, dimSlot, dim, faces, hits); }
        else                      { projectAreaRing(camera, R, ring, ri, maxHm, ceiling, dimSlot, dim, faces, hits); }
    });
    faces.sort((a, b) => a.depth - b.depth);

    //One glow filter per ring, tinted to its metric colour, for the focused slice / bar.
    let defs = '<defs>';
    rings.forEach((r, i) => { defs += `<filter id="clock-glow-${i}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${r.data.color}" flood-opacity="0.95"/></filter>`; });
    defs += '</defs>';

    //Two layers so the home prism sits between them: the flat-ground guide + compass go UNDER it (guideSvg),
    //the upright cylinders OVER it (svg). defs (the per-ring glow filters) stay with the cylinders that use them.
    //Area mode also lays a translucent highlight wedge on the hovered hour, beneath the spokes (so the columns
    //rise over it); histogram keeps its own per-bar highlight, so it gets no wedge.
    //Spoke + wedge focus are area-only; histogram keeps its prior guide (no focused spoke) and per-bar highlight.
    const focusHour = (mode === 'area' && dimSlot !== null) ? Math.floor(dimSlot / _slotsPerHour) : null;
    const wedge = (focusHour !== null && dim > 0)
        ? clockWedge(camera, outerR, focusHour, rings[0]?.data.color ?? '#ffffff', dim)
        : '';
    const compass = clockCompass(camera, outerR, bearing, tilt, cardinals);
    return {
        guideSvg: wedge + clockGuide(camera, outerR, focusHour, dim) + compass.svg,
        svg: defs + faces.map(f => f.svg).join(''),
        hits, labels, compass: compass.labels,
    };
}

//AREA sub-mode: a continuous stacked area swept over the dial's slots. Fills sit at a very transparent base
//(the curve lines stay full opacity); the focused HOUR's slices ramp to full opacity + a bright glowing line.
//Interaction snaps to the hour: dimSlot resolves to a focused hour and EVERY slice in that hour brightens, so
//the whole hour band of the curve lights up (matching the histogram, which highlights a whole bar).
function projectAreaRing(
    camera: SceneCamera, R: number, ring: ClockRingInput, ri: number, maxHm: number, ceiling: number,
    dimSlot: number | null, dim: number, faces: ClockFace[], hits: ClockHit[]
): void
{
    const data  = ring.data;
    const slots = clockSlots();
    const sph   = _slotsPerHour;
    const focusHour = dimSlot === null ? null : Math.floor(dimSlot / sph);
    const totalAt = (sl: number): number => data.layers.reduce((s, L) => s + Math.max(0, L.values[sl] ?? 0), 0);
    //Normalise against the shared per-unit ceiling, not the ring's own max, so same-unit metrics share an axis.
    const zScale = ceiling > 0 ? (maxHm * ring.heightScale) / ceiling : 0;
    let maxTotal = 0;   //own max — only to detect a truly empty ring (baseline circle)
    for (let sl = 0; sl < slots; sl++) { maxTotal = Math.max(maxTotal, totalAt(sl)); }

    for (let sl = 0; sl < slots; sl++)
    {
        const a = (sl / slots) * 2 * Math.PI;
        const e = R * Math.sin(a); const n = R * Math.cos(a);
        const base = camera.project(e, n, 0);
        const top  = camera.project(e, n, totalAt(sl) * zScale);
        hits.push({ slot: sl, bx: base[0], by: base[1], tx: top[0], ty: top[1] });
    }

    if (maxTotal <= 0)
    {
        const pts: string[] = [];
        for (let s = 0; s <= slots; s++) { const a = (s / slots) * 2 * Math.PI; const p = camera.project(R * Math.sin(a), R * Math.cos(a), 0); pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`); }
        faces.push({ depth: -Infinity, svg: `<polyline points="${pts.join(' ')}" fill="none" stroke="${data.color}" stroke-opacity="${(0.3 * ring.opacity).toFixed(3)}" stroke-width="1"/>` });
        return;
    }

    const ground:   [number, number][] = [];
    const layerTop: [number, number][][] = data.layers.map(() => []);
    for (let s = 0; s <= slots; s++)
    {
        const sl = s % slots;
        const a  = (s / slots) * 2 * Math.PI;
        const e  = R * Math.sin(a); const n = R * Math.cos(a);
        ground.push(camera.project(e, n, 0));
        let cum = 0;
        for (let k = 0; k < data.layers.length; k++) { cum += Math.max(0, data.layers[k].values[sl] ?? 0); layerTop[k].push(camera.project(e, n, cum * zScale)); }
    }

    const top = layerTop[layerTop.length - 1];
    for (let s = 0; s < slots; s++)
    {
        const depth   = (ground[s][1] + ground[s + 1][1]) / 2;
        //The focused hour's slices ramp their fill from the transparent base to full; the rest stay at base.
        const focused = focusHour !== null && Math.floor(s / sph) === focusHour;
        const fillMul = focused ? AREA_FILL_BASE + (1 - AREA_FILL_BASE) * dim : AREA_FILL_BASE;
        for (let k = 0; k < data.layers.length; k++)
        {
            const L   = data.layers[k];
            const loA = k === 0 ? ground[s]     : layerTop[k - 1][s];
            const loB = k === 0 ? ground[s + 1] : layerTop[k - 1][s + 1];
            const hiA = layerTop[k][s];
            const hiB = layerTop[k][s + 1];
            const fillOp = (ring.opacity * fillMul * (L.predicted ? 0.5 : 1)).toFixed(3);
            const fill   = lerpHexToward(L.color, '#000000', 0.12);
            faces.push({ depth, svg: `<polygon points="${loA[0].toFixed(1)},${loA[1].toFixed(1)} ${loB[0].toFixed(1)},${loB[1].toFixed(1)} ${hiB[0].toFixed(1)},${hiB[1].toFixed(1)} ${hiA[0].toFixed(1)},${hiA[1].toFixed(1)}" fill="${fill}" fill-opacity="${fillOp}"/>` });
            //Thin full-opacity boundary on each stacked layer (the topmost edge gets the focus-aware line below),
            //in the layer's own colour, so superposed areas stay legible.
            if (k < data.layers.length - 1)
            {
                const edge = lerpHexToward(L.color, '#ffffff', 0.3);
                faces.push({ depth, svg: `<line x1="${hiA[0].toFixed(1)}" y1="${hiA[1].toFixed(1)}" x2="${hiB[0].toFixed(1)}" y2="${hiB[1].toFixed(1)}" stroke="${edge}" stroke-opacity="${ring.opacity.toFixed(3)}" stroke-width="0.75"/>` });
            }
        }
        //Curve line: full opacity always; the hovered slice brightens, thickens and glows.
        const stroke = focused ? 'rgba(255,255,255,0.97)' : lerpHexToward(data.color, '#ffffff', 0.3);
        const glow   = focused ? ` filter="url(#clock-glow-${ri})"` : '';
        const w      = focused ? (1 + 1.5 * dim) : 1;
        faces.push({ depth, svg: `<line x1="${top[s][0].toFixed(1)}" y1="${top[s][1].toFixed(1)}" x2="${top[s + 1][0].toFixed(1)}" y2="${top[s + 1][1].toFixed(1)}" stroke="${stroke}" stroke-opacity="${ring.opacity.toFixed(3)}" stroke-width="${w.toFixed(2)}"${glow}/>` });
    }
}

//HISTOGRAM sub-mode: 24 stacked bars, one per hour, sitting BETWEEN the hour lines (centred at H+0.5 — each
//bar is the value over H..H+1). The hovered bar glows; the others dim. Grow / slide / exit ride on the ring's
//animation scalars exactly like the area mode.
function projectHistogramRing(
    camera: SceneCamera, R: number, outerR: number, ring: ClockRingInput, ri: number, maxHm: number, ceiling: number,
    minEdge: number, ppm: number, dimSlot: number | null, dim: number, faces: ClockFace[], hits: ClockHit[]
): void
{
    const data   = ring.data;
    const hourly = data.layers.map(L => hourlyOf(L.values, data.unit === 'energy'));   //[layer][24]
    const totalAt = (h: number): number => hourly.reduce((s, hv) => s + Math.max(0, hv[h]), 0);
    //Normalise against the shared per-unit ceiling so same-unit metrics' bars are directly comparable.
    const zScale = ceiling > 0 ? (maxHm * ring.heightScale) / ceiling : 0;
    const halfRadial = ringSpacingM(outerR) * BAR_RADIAL_FRAC;
    const halfTan    = (BAR_TANGENT_FRAC * minEdge) / ppm * ringRadiusFrac(ring.slot);
    const focusHour  = dimSlot === null ? null : Math.floor(dimSlot / _slotsPerHour);

    for (let h = 0; h < 24; h++)
    {
        const a = ((h + 0.5) / 24) * 2 * Math.PI;   //BETWEEN the hour lines
        const e = R * Math.sin(a); const n = R * Math.cos(a);
        const total = totalAt(h);
        const base  = camera.project(e, n, 0);
        const top   = camera.project(e, n, total * zScale);
        //Hit axis tagged with the hour's first slot, so the card maps it back to the hour.
        hits.push({ slot: h * _slotsPerHour, bx: base[0], by: base[1], tx: top[0], ty: top[1] });
        const active = h === focusHour;
        const dimOp  = ring.opacity * (focusHour !== null && !active ? 1 - 0.5 * dim : 1);
        if (total <= 0)
        {
            //Empty hour: a flat neutral puck so all 24 stay on the dial (as the old histogram did).
            const puckH = maxHm * 0.04 * ring.heightScale;
            let puck = stackedColumn(camera, foot(e, n, halfRadial, halfTan, a), puckH,
                [{ frac: 1, wall: 'rgba(140,140,140,0.3)', roof: 'rgba(170,170,170,0.42)' }], 'rgba(0,0,0,0.25)');
            if (dimOp < 1) { puck = `<g opacity="${dimOp.toFixed(3)}">${puck}</g>`; }
            faces.push({ depth: base[1], svg: puck });
            continue;
        }
        const bands = data.layers
            .map((L, k) => ({ v: Math.max(0, hourly[k][h]), color: L.color }))
            .filter(b => b.v > 0)
            .map(b => ({ frac: b.v / total, wall: lerpHexToward(b.color, '#000000', 0.25), roof: lerpHexToward(b.color, '#ffffff', active ? 0.4 : 0.12) }));
        if (!bands.length) { continue; }
        const stroke = active ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.3)';
        let col = stackedColumn(camera, foot(e, n, halfRadial, halfTan, a), total * zScale, bands, stroke);
        if (active) { col = `<g filter="url(#clock-glow-${ri})">${col}</g>`; }
        if (dimOp < 1) { col = `<g opacity="${dimOp.toFixed(3)}">${col}</g>`; }
        faces.push({ depth: base[1], svg: col });
    }
}


//Slot nearest the cursor (within HOVER_PX of its axis); null when off every ring. The card maps the slot to
//its hour for the highlight + tooltip, so hovering lights that whole hour across rings.
export function clockHitTest(hits: ClockHit[], x: number, y: number): number | null
{
    let best: number | null = null;
    let bestD = HOVER_PX;
    for (const h of hits)
    {
        const d = distToSegment(x, y, h.bx, h.by, h.tx, h.ty);
        if (d < bestD) { bestD = d; best = h.slot; }
    }
    return best;
}


//Read one layer aggregated over the hour the focused slot falls in: the hour's TOTAL (`sum`, energy) or its
//AVERAGE (power/percent/irradiance), matching the histogram bar. Both clock sub-modes read this — the area
//interaction snaps to the hour, so its tooltip shows exactly the same per-hour figures as the histogram.
export function hourlyAt(values: number[], hour: number, sum: boolean): number
{
    const sph = _slotsPerHour;
    let s = 0;
    for (let j = 0; j < sph; j++) { s += Math.max(0, values[hour * sph + j] ?? 0); }
    return sum ? s : s / sph;
}
export function clockLayerValue(layer: ClockLayer, data: ClockData, _mode: ClockMode, slot: number): number
{
    return hourlyAt(layer.values, Math.floor(slot / _slotsPerHour), data.unit === 'energy');
}

//A metric's total magnitude at the focused position (sum of its layers), for the per-filter tooltip rows.
export function clockTotal(data: ClockData, mode: ClockMode, slot: number): number
{
    return data.layers.reduce((s, L) => s + clockLayerValue(L, data, mode, slot), 0);
}


//Format a band/total magnitude for the tooltip, per the metric's unit. kW/kWh honour the user's decimals
//setting; %/irradiance read as integers. 'energy' values are already kWh.
export function formatClockValue(host: ClockHost, data: ClockData, v: number): string
{
    if (data.unit === 'percent')    { return `${Math.round(Math.max(0, v))} %`; }
    if (data.unit === 'irradiance') { return `${Math.round(Math.max(0, v))} W/m²`; }
    const dec = valueDecimals(host.config);
    if (data.unit === 'energy')     { return `${formatLocalisedNumber(host.hass, v, dec)} kWh`; }
    return `${formatLocalisedNumber(host.hass, v / 1000, dec)} kW`;
}
