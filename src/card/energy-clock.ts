//Energy-clock mode: a ring of 24 hourly cylinders projected on the same 2.5D ground plane as the scene,
//one per hour of the day, showing whichever metric the right-hand rail selects — production split per PV
//string, grid into import/export, battery into charge/discharge, etc. Each hour aggregates the metric over
//the whole rolling window (a single day shows that day's shape; a longer range averages it). The data comes
//straight from the store + histories the timeline already loaded, binned by hour-of-day — no extra fetch.

import { type SceneCamera } from '../engine/projection';
import { type ChartTarget, type ChartHost, pvValueAtTime } from './charts';
import { ENERGY_COLOR, energySolarColor, lerpHexToward, formatLocalisedNumber, cssHex } from './format';
import { type UnifiedDataStore } from './unifiedStore';
import { customEntityId } from '../helios-config';
import { resolveCustomEntityIcon, resolveCustomEntityLive } from './custom-entity';

//Structural surface the clock reads off the card. It already satisfies ChartHost (the bottom chart consumes
//it); themeIsDark resolves the live palette polarity for the per-source colour ramp.
export type ClockHost = ChartHost & { themeIsDark(): boolean };

//Ring geometry, expressed as fractions of the smaller viewport edge so the clock fills the card at any size.
const RING_R_FRAC     = 0.34;   //outermost ring radius
const RING_INNER_MIN_FRAC = 0.4;//innermost concentric ring radius as a fraction of the outer one
const CLOCK_MAX_FILTERS = 8;    //fixed slot count: rings always sit at their slot radius, so adding/removing
                                //a filter never re-spaces the others (and the radii are constant)
const MAX_HEIGHT_FRAC = 0.30;   //tallest area / bar
//Area mode: a very transparent base fill (the curve lines stay full opacity); the hovered slice ramps to full.
const AREA_FILL_BASE  = 0.28;
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
//How close (screen px) the cursor must be to an hour's axis to hover it.
const HOVER_PX = 22;


//The two clock sub-modes: a continuous stacked AREA curve, or the classic stacked-bar HISTOGRAM (one bar per
//hour, sitting BETWEEN the hour lines). Both read off the same ClockData — the histogram aggregates the slot
//series to hourly on the fly — so only the geometry differs.
export type ClockMode = 'area' | 'histogram';

//One stacked layer of a metric: a per-slot series (CLOCK_SLOTS values) drawn as a filled area swept around
//the dial (or aggregated to 24 hourly bars in histogram mode). Layers stack cumulatively.
export interface ClockLayer
{
    color:      string;
    icon:       string;
    label:      string;       //per-source name for production layers, else ''
    values:     number[];     //CLOCK_SLOTS per-slot magnitudes (W, %, or W/m²)
    predicted?: boolean;      //forecast-only layer (no actuals) — rendered translucent
}

export interface ClockData
{
    target: ChartTarget;
    layers: ClockLayer[];
    //The metric's representative colour, used for the rail button + the hovered slice glow.
    color:  string;
    //Tooltip value formatter for this metric (kW for power, % for soc/cloud, W/m² for irradiance).
    unit:   'power' | 'percent' | 'irradiance';
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

//Screen-space hit target: a vertical axis (base -> top) tagged with its slot. Area mode emits one per 15-min
//slot; histogram mode one per hourly bar (tagged with that hour's first slot). Hovering highlights it.
export interface ClockHit { slot: number; bx: number; by: number; tx: number; ty: number; }

//One projected frame: the cylinder SVG plus the per-element transforms the card writes onto its DOM nodes.
export interface ClockFrame
{
    svg:    string;
    hits:   ClockHit[];
    labels: Array<{ x: number; y: number; opacity: number; transform: string }>;
    //N/S compass letters, laid flat like the hours but at full opacity (no depth fade).
    compass: Array<{ x: number; y: number; transform: string; label: string }>;
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


//Dial resolution: 15-minute slots (the store's native cadence), so the curve + the hover focus read finer
//than hourly. 24 hour labels still mark the dial; each hour spans CLOCK_SLOTS_PER_HOUR slots.
const CLOCK_SLOTS_PER_HOUR = 4;
const CLOCK_SLOTS = 24 * CLOCK_SLOTS_PER_HOUR;

//Slot-of-day [0..CLOCK_SLOTS) for a local time.
function slotOf(d: Date): number
{
    return d.getHours() * CLOCK_SLOTS_PER_HOUR + Math.floor(d.getMinutes() / (60 / CLOCK_SLOTS_PER_HOUR));
}

//Fill NaN gaps by linear interpolation between the nearest real samples, wrapping around the dial, so a
//metric whose source is HOURLY (binned into sparse 15-min slots — custom entity, battery SoC, cloud) reads as
//a smooth ramp instead of a spike every 4th slot. Store-backed metrics are already 15-min dense, so there are
//no gaps and this is a no-op. All-NaN (no data at all) collapses to zeros.
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

//Bin one store series into per-slot averages of its absolute value (export/charge come back negative); empty
//slots stay NaN so fillGaps can interpolate them rather than reading as a zero spike.
function binSlotAvg(store: UnifiedDataStore, series: (number | null)[]): number[]
{
    const sum = new Array<number>(CLOCK_SLOTS).fill(0);
    const cnt = new Array<number>(CLOCK_SLOTS).fill(0);
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
    if (hasSignal(store?.irradiance)) { out.push('irradiance'); }
    if (hasSignal(store?.cloud))      { out.push('cloud'); }
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
        case 'custom':      return { icon: resolveCustomEntityIcon(host.hass, host.config), color: cssHex(el, '--red-color', '#f44336') };
        default:            return { icon: 'mdi:solar-power',          color: ENERGY_COLOR.pv(el) };
    }
}

//Human label for the rail button title/aria. English + French (Helios ships en/fr); other locales fall to en.
const TARGET_LABELS_EN: Record<ChartTarget, string> = {
    production: 'Production', consumption: 'Consumption', grid: 'Grid', battery: 'Battery',
    'battery-soc': 'Battery charge', irradiance: 'Irradiance', cloud: 'Cloud cover', custom: 'Custom',
};
const TARGET_LABELS_FR: Record<ChartTarget, string> = {
    production: 'Production', consumption: 'Consommation', grid: 'Réseau', battery: 'Batterie',
    'battery-soc': 'Charge batterie', irradiance: 'Irradiance', cloud: 'Nébulosité', custom: 'Personnalisé',
};
export function clockTargetLabel(host: ClockHost, target: ChartTarget): string
{
    //The custom metric is labelled by the entity's own name, like its chip.
    if (target === 'custom')
    {
        const live = resolveCustomEntityLive(host.hass, customEntityId(host.config));
        return live?.name || customEntityId(host.config) || 'Custom';
    }
    const lang = String(host.hass?.language ?? '').toLowerCase();
    return (lang.startsWith('fr') ? TARGET_LABELS_FR : TARGET_LABELS_EN)[target];
}


//Build the stacked layers for the active metric. Production keeps a per-PV-string breakdown (plus a forecast
//layer covering hours with no actuals yet); every other metric reuses the store series the timeline draws,
//binned by hour-of-day — same numbers, same colours. Each layer is a 24-value hour-of-day series the
//projection sweeps into a continuous filled area around the dial.
export function buildClockData(host: ClockHost, target: ChartTarget): ClockData
{
    const store  = host._unifiedStore;
    const el     = host as unknown as Element;
    const dark   = host.themeIsDark();
    const meta   = clockTargetMeta(host, target);

    const data = (unit: ClockData['unit'], layers: ClockLayer[]): ClockData =>
        ({ target, color: meta.color, unit, layers });

    if (target === 'production')
    {
        if (!store) { return data('power', []); }
        const ids = Array.from(host._pvHistoryPerEntity.keys()).sort();
        const nowMs = Date.now();
        //Per-source actuals: instantaneous power at each past bucket centre, averaged by hour-of-day.
        const sum = ids.map(() => new Array<number>(CLOCK_SLOTS).fill(0));
        const cnt = ids.map(() => new Array<number>(CLOCK_SLOTS).fill(0));
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs > nowMs) { break; }
            const h = slotOf(new Date(tMs));
            ids.forEach((id, s) =>
            {
                const ph = host._pvHistoryPerEntity.get(id);
                if (!ph) { return; }
                const v = pvValueAtTime(host, tMs, ph).value;
                if (isFinite(v) && v > 0) { sum[s][h] += v; cnt[s][h] += 1; }
            });
        }
        //Per-source PV is store-dense (15-min) during the day; night slots are a genuine 0 (not a gap to fill).
        const srcAvg = sum.map((arr, s) => arr.map((x, h) => (cnt[s][h] ? x / cnt[s][h] : 0)));
        const layers: ClockLayer[] = ids.map((id, s) => ({
            color: energySolarColor(el, dark, s),
            icon:  'mdi:solar-power',
            label: String(host.hass?.states?.[id]?.attributes?.friendly_name ?? id),
            values: srcAvg[s],
        }));
        //Forecast layer: covers only the hours with no actuals, drawn translucent so a future day still reads.
        const forecastAvg = binSlotAvg(store, store.forecast);
        const fcVals = forecastAvg.map((v, h) =>
            (srcAvg.reduce((t, a) => t + a[h], 0) <= 0 && v > 0) ? v : 0);
        if (fcVals.some(v => v > 0))
        {
            layers.push({ color: ENERGY_COLOR.pv(el), icon: 'mdi:solar-power', label: '', values: fcVals, predicted: true });
        }
        return data('power', layers);
    }

    //Average a sum/count pair into a per-slot series, interpolating empty slots (hourly sources land in 1 of
    //every 4 slots — fillGaps ramps between them instead of spiking).
    const avgOf = (s: number[], c: number[]): number[] => fillGaps(s.map((v, i) => (c[i] ? v / c[i] : NaN)));

    if (target === 'battery-soc')
    {
        const hist = host._batterySocHistory;
        const sum = new Array<number>(CLOCK_SLOTS).fill(0);
        const cnt = new Array<number>(CLOCK_SLOTS).fill(0);
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
        return data('percent', [{ color: ENERGY_COLOR.batteryOut(el), icon: 'mdi:battery', label: '', values: avgOf(sum, cnt) }]);
    }

    if (target === 'cloud')
    {
        const cs = host._chartSeries;
        const sum = [new Array<number>(CLOCK_SLOTS).fill(0), new Array<number>(CLOCK_SLOTS).fill(0), new Array<number>(CLOCK_SLOTS).fill(0)];
        const cnt = [new Array<number>(CLOCK_SLOTS).fill(0), new Array<number>(CLOCK_SLOTS).fill(0), new Array<number>(CLOCK_SLOTS).fill(0)];
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
        return data('percent', [0, 1, 2].map(b => ({ color: cols[b], icon: icons[b], label: '', values: avgOf(sum[b], cnt[b]) })));
    }

    if (target === 'custom')
    {
        //Custom entity from its fetched 5-min history (values in W), binned by slot-of-day. One red layer.
        const hist = host._customEntityHistory;
        const sum = new Array<number>(CLOCK_SLOTS).fill(0);
        const cnt = new Array<number>(CLOCK_SLOTS).fill(0);
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
        return data('power', [{ color: meta.color, icon: meta.icon, label: '', values: avgOf(sum, cnt) }]);
    }

    //Remaining metrics are single- or dual-layer store series, binned by hour-of-day.
    if (!store) { return data(target === 'irradiance' ? 'irradiance' : 'power', []); }

    let specs: Array<{ series: (number | null)[]; color: string; icon: string }>;
    let unit: ClockData['unit'] = 'power';
    if (target === 'grid')
    {
        specs = [
            { series: store.gridImport, color: ENERGY_COLOR.gridImport(el), icon: 'mdi:transmission-tower-import' },
            { series: store.gridExport, color: ENERGY_COLOR.gridExport(el), icon: 'mdi:transmission-tower-export' },
        ];
    }
    else if (target === 'battery')
    {
        //Signed net power: positive = charging. Split into two non-negative layers.
        const charge:    (number | null)[] = store.battery.map(v => (v === null ? null : Math.max(0, v)));
        const discharge: (number | null)[] = store.battery.map(v => (v === null ? null : Math.max(0, -v)));
        specs = [
            { series: discharge, color: ENERGY_COLOR.batteryOut(el), icon: 'mdi:battery-arrow-up' },
            { series: charge,    color: ENERGY_COLOR.batteryIn(el),  icon: 'mdi:battery-arrow-down' },
        ];
    }
    else if (target === 'irradiance')
    {
        unit  = 'irradiance';
        specs = [{ series: store.irradiance, color: ENERGY_COLOR.sun(el), icon: 'mdi:white-balance-sunny' }];
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
        specs = [{ series: cons, color: ENERGY_COLOR.consumption(el), icon: 'mdi:home-lightning-bolt' }];
    }

    return data(unit, specs.map(s => ({ color: s.color, icon: s.icon, label: '', values: binSlotAvg(store, s.series) })));
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

//Aggregate a per-slot series to 24 hourly averages, for the histogram bars (each bar = one hour H..H+1).
function hourlyOf(values: number[]): number[]
{
    const out = new Array<number>(24).fill(0);
    for (let h = 0; h < 24; h++)
    {
        let sum = 0;
        for (let j = 0; j < CLOCK_SLOTS_PER_HOUR; j++) { sum += Math.max(0, values[h * CLOCK_SLOTS_PER_HOUR + j] ?? 0); }
        out[h] = sum / CLOCK_SLOTS_PER_HOUR;
    }
    return out;
}

//Rectangular bar footprint (metres) for histogram mode, oriented to `angle`: `hr` half-depth along the radius
//(rings sit flush), `ht` half-width along the tangent. Four sides — cheap to redraw each rotation frame.
function foot(cx: number, cy: number, hr: number, ht: number, angle: number): Array<[number, number]>
{
    const rs = Math.sin(angle), rc = Math.cos(angle);
    const ts = Math.cos(angle), tc = -Math.sin(angle);
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
    footprint: Array<[number, number]>,
    totalHeightM: number,
    bands: Array<{ frac: number; wall: string; roof: string }>,
    stroke: string
): string
{
    if (!bands.length) { return ''; }
    const cum = [0];
    for (const b of bands) { cum.push(cum[cum.length - 1] + b.frac); }
    cum[cum.length - 1] = 1;
    const levels  = cum.map(c => footprint.map(p => camera.project(p[0], p[1], totalHeightM * c)));
    const bearing = camera.bearingDeg * Math.PI / 180;
    const edges: Array<{ depth: number; faces: string }> = [];
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
            const lo = levels[k], hi = levels[k + 1];
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

//Clock-face guide laid flat on the ground (under the cylinders): a faint centre ring + a spoke per hour
//reaching from the ring toward each hour label, stopping short so it never overlaps the text. Theme colour,
//low opacity. The focused hour's spoke ramps to full opacity with `dim` (0..1), so the selected slice's
//line lights up. `outerR` is the outermost ring radius in metres.
function clockGuide(camera: SceneCamera, outerR: number, focusHour: number | null, dim: number): string
{
    const col   = 'var(--primary-text-color, #212121)';
    const hubR  = outerR * CLOCK_HUB_R_FRAC;
    const tipR  = outerR * CLOCK_SPOKE_OUTER_FRAC;

    //Centre ring as a closed 32-gon projected on the ground.
    const ring: string[] = [];
    for (let i = 0; i <= 32; i++)
    {
        const a = (i / 32) * 2 * Math.PI;
        const p = camera.project(hubR * Math.sin(a), hubR * Math.cos(a), 0);
        ring.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    }
    let svg = `<polyline points="${ring.join(' ')}" fill="none" stroke="${col}" stroke-opacity="${CLOCK_GUIDE_OPACITY}" stroke-width="1"/>`;

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

//Compass laid flat on the ground just beyond the hour labels: a filled red triangle pointing North and a
//primary-text-colour one pointing South, each with a letter at its tip oriented like the hours. Returns the
//triangle SVG + the two letter placements (the card renders those as DOM, at full opacity — no depth fade).
function clockCompass(
    camera: SceneCamera, outerR: number, bearing: number, tilt: number
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
        const rs = Math.sin(angle), rc = Math.cos(angle);   //radial (outward) unit
        const ts = Math.cos(angle), tc = -Math.sin(angle);  //tangential unit
        const tip = camera.project(tipR * rs, tipR * rc, 0);
        const b1  = camera.project(baseR * rs + halfW * ts, baseR * rc + halfW * tc, 0);
        const b2  = camera.project(baseR * rs - halfW * ts, baseR * rc - halfW * tc, 0);
        return `<polygon points="${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${b1[0].toFixed(1)},${b1[1].toFixed(1)} ${b2[0].toFixed(1)},${b2[1].toFixed(1)}" fill="${color}"/>`;
    };
    //North sits at angle 0 (hour-0 direction), South at angle π (hour-12). Letters reuse the hour transform.
    const svg = triangle(0, red) + triangle(Math.PI, text);
    const labels = ([{ angle: 0, label: 'N', hourEquiv: 0 }, { angle: Math.PI, label: 'S', hourEquiv: 12 }])
        .map(({ angle, label, hourEquiv }) =>
        {
            const p = camera.project(labelR * Math.sin(angle), labelR * Math.cos(angle), 0);
            return {
                x: p[0], y: p[1], label,
                transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + (hourEquiv / 24) * 360 + 180}deg)`,
            };
        });
    return { svg, labels };
}

type ClockFace = { depth: number; svg: string };

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
    dim: number
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
    let depthMin = Infinity, depthMax = -Infinity;
    for (const p of projLabels) { depthMin = Math.min(depthMin, p.depth); depthMax = Math.max(depthMax, p.depth); }
    const depthRange = depthMax - depthMin || 1;
    const labels = projLabels.map((p, h) => ({
        x: p.x, y: p.y,
        opacity: LABEL_MIN_OPACITY + (1 - LABEL_MIN_OPACITY) * (p.depth - depthMin) / depthRange,
        transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + (h / 24) * 360 + 180}deg)`,
    }));

    const hits:  ClockHit[]  = [];
    const faces: ClockFace[] = [];
    rings.forEach((ring, ri) =>
    {
        const R = outerR * ringRadiusFrac(ring.slot);
        if (mode === 'histogram') { projectHistogramRing(camera, R, outerR, ring, ri, maxHm, minEdge, ppm, dimSlot, dim, faces, hits); }
        else                      { projectAreaRing(camera, R, ring, ri, maxHm, dimSlot, dim, faces, hits); }
    });
    faces.sort((a, b) => a.depth - b.depth);

    //One glow filter per ring, tinted to its metric colour, for the focused slice / bar.
    let defs = '<defs>';
    rings.forEach((r, i) => { defs += `<filter id="clock-glow-${i}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${r.data.color}" flood-opacity="0.95"/></filter>`; });
    defs += '</defs>';

    //Guide + compass sit UNDER the geometry (drawn first). The hour spokes stay untouched by the hover.
    const compass = clockCompass(camera, outerR, bearing, tilt);
    return {
        svg: defs + clockGuide(camera, outerR, null, 0) + compass.svg + faces.map(f => f.svg).join(''),
        hits, labels, compass: compass.labels,
    };
}

//AREA sub-mode: a continuous stacked area swept over the 15-min slots. Fills sit at a very transparent base
//(the curve lines stay full opacity); the hovered slot's slice ramps to full opacity + a bright glowing line.
function projectAreaRing(
    camera: SceneCamera, R: number, ring: ClockRingInput, ri: number, maxHm: number,
    dimSlot: number | null, dim: number, faces: ClockFace[], hits: ClockHit[]
): void
{
    const data = ring.data;
    const totalAt = (sl: number): number => data.layers.reduce((s, L) => s + Math.max(0, L.values[sl] ?? 0), 0);
    let maxTotal = 0;
    for (let sl = 0; sl < CLOCK_SLOTS; sl++) { maxTotal = Math.max(maxTotal, totalAt(sl)); }
    const zScale = maxTotal > 0 ? (maxHm * ring.heightScale) / maxTotal : 0;

    for (let sl = 0; sl < CLOCK_SLOTS; sl++)
    {
        const a = (sl / CLOCK_SLOTS) * 2 * Math.PI;
        const e = R * Math.sin(a), n = R * Math.cos(a);
        const base = camera.project(e, n, 0);
        const top  = camera.project(e, n, totalAt(sl) * zScale);
        hits.push({ slot: sl, bx: base[0], by: base[1], tx: top[0], ty: top[1] });
    }

    if (maxTotal <= 0)
    {
        const pts: string[] = [];
        for (let s = 0; s <= CLOCK_SLOTS; s++) { const a = (s / CLOCK_SLOTS) * 2 * Math.PI; const p = camera.project(R * Math.sin(a), R * Math.cos(a), 0); pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`); }
        faces.push({ depth: -Infinity, svg: `<polyline points="${pts.join(' ')}" fill="none" stroke="${data.color}" stroke-opacity="${(0.3 * ring.opacity).toFixed(3)}" stroke-width="1"/>` });
        return;
    }

    const ground:   Array<[number, number]> = [];
    const layerTop: Array<Array<[number, number]>> = data.layers.map(() => []);
    for (let s = 0; s <= CLOCK_SLOTS; s++)
    {
        const sl = s % CLOCK_SLOTS;
        const a  = (s / CLOCK_SLOTS) * 2 * Math.PI;
        const e  = R * Math.sin(a), n = R * Math.cos(a);
        ground.push(camera.project(e, n, 0));
        let cum = 0;
        for (let k = 0; k < data.layers.length; k++) { cum += Math.max(0, data.layers[k].values[sl] ?? 0); layerTop[k].push(camera.project(e, n, cum * zScale)); }
    }

    const top = layerTop[layerTop.length - 1];
    for (let s = 0; s < CLOCK_SLOTS; s++)
    {
        const depth   = (ground[s][1] + ground[s + 1][1]) / 2;
        //The hovered slice ramps its fill from the transparent base to full; every other slice stays at base.
        const focused = dimSlot !== null && s === dimSlot;
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
    camera: SceneCamera, R: number, outerR: number, ring: ClockRingInput, ri: number, maxHm: number,
    minEdge: number, ppm: number, dimSlot: number | null, dim: number, faces: ClockFace[], hits: ClockHit[]
): void
{
    const data   = ring.data;
    const hourly = data.layers.map(L => hourlyOf(L.values));   //[layer][24]
    const totalAt = (h: number): number => hourly.reduce((s, hv) => s + Math.max(0, hv[h]), 0);
    let maxTotal = 0;
    for (let h = 0; h < 24; h++) { maxTotal = Math.max(maxTotal, totalAt(h)); }
    const zScale = maxTotal > 0 ? (maxHm * ring.heightScale) / maxTotal : 0;
    const halfRadial = ringSpacingM(outerR) * BAR_RADIAL_FRAC;
    const halfTan    = (BAR_TANGENT_FRAC * minEdge) / ppm * ringRadiusFrac(ring.slot);
    const focusHour  = dimSlot === null ? null : Math.floor(dimSlot / CLOCK_SLOTS_PER_HOUR);

    for (let h = 0; h < 24; h++)
    {
        const a = ((h + 0.5) / 24) * 2 * Math.PI;   //BETWEEN the hour lines
        const e = R * Math.sin(a), n = R * Math.cos(a);
        const total = totalAt(h);
        const base  = camera.project(e, n, 0);
        const top   = camera.project(e, n, total * zScale);
        //Hit axis tagged with the hour's first slot, so the card maps it back to the hour.
        hits.push({ slot: h * CLOCK_SLOTS_PER_HOUR, bx: base[0], by: base[1], tx: top[0], ty: top[1] });
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


//Slot nearest the cursor (within HOVER_PX of its axis); null when off every ring. Slot-only, since hovering
//lights that whole 15-min slice across rings.
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


//Read one layer at the focused position, honouring the mode: area reads the exact 15-min slot; histogram
//reads the hourly average of the slot's hour (matching the bar height).
function hourlyAt(values: number[], hour: number): number
{
    let sum = 0;
    for (let j = 0; j < CLOCK_SLOTS_PER_HOUR; j++) { sum += Math.max(0, values[hour * CLOCK_SLOTS_PER_HOUR + j] ?? 0); }
    return sum / CLOCK_SLOTS_PER_HOUR;
}
export function clockLayerValue(layer: ClockLayer, mode: ClockMode, slot: number): number
{
    return mode === 'histogram'
        ? hourlyAt(layer.values, Math.floor(slot / CLOCK_SLOTS_PER_HOUR))
        : Math.max(0, layer.values[slot] ?? 0);
}

//A metric's total magnitude at the focused position (sum of its layers), for the per-filter tooltip rows.
export function clockTotal(data: ClockData, mode: ClockMode, slot: number): number
{
    return data.layers.reduce((s, L) => s + clockLayerValue(L, mode, slot), 0);
}

//Slots per hour, exposed so the card can format a slot's HH:MM label + range.
export { CLOCK_SLOTS_PER_HOUR };

//Format a band/total magnitude for the tooltip, per the metric's unit.
export function formatClockValue(host: ClockHost, data: ClockData, v: number): string
{
    if (data.unit === 'percent')    { return `${Math.round(Math.max(0, v))} %`; }
    if (data.unit === 'irradiance') { return `${Math.round(Math.max(0, v))} W/m²`; }
    return `${formatLocalisedNumber(host.hass, v / 1000, 1)} kW`;
}
