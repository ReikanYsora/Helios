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
const FOOT_R_FRAC     = 0.018;  //cylinder bar half-size (outer ring; scaled down for inner rings)
const MAX_HEIGHT_FRAC = 0.30;   //tallest cylinder
const FLAT_FRAC       = 0.013;  //empty-hour puck / minimum column height
const LABEL_R_MULT    = 1.18;   //hour labels sit just outside the ring
const LABEL_MIN_OPACITY = 0.15; //farthest-back hour label opacity (nearest is opaque)
//Clock-face guide: a faint centre ring (radius as a fraction of the outer ring) with 24 spokes reaching out
//toward — but stopping short of — the hour labels, so the eye can trace a cylinder to its hour.
const CLOCK_HUB_R_FRAC      = 0.12;
const CLOCK_SPOKE_OUTER_FRAC = 1.10;
const CLOCK_GUIDE_OPACITY   = 0.25;
//Compass: filled N/S triangles just beyond the hour labels (fractions of the outer ring radius), with a
//letter at each tip. Full opacity (no depth fade), so the orientation always reads.
const CLOCK_COMPASS_BASE_FRAC   = 1.30;
const CLOCK_COMPASS_TIP_FRAC    = 1.42;
const CLOCK_COMPASS_HALF_W_FRAC = 0.05;
const CLOCK_COMPASS_LABEL_FRAC  = 1.50;
//Period/target-change intro: each cylinder rises (ease-out) over GROW_MS, staggered clockwise by STAGGER_MS.
export const CLOCK_GROW_MS    = 320;
export const CLOCK_STAGGER_MS = 28;
//How close (screen px) the cursor must be to a cylinder's axis to hover it.
const HOVER_PX = 22;


//A single stacked band of an hour's cylinder: its colour, magnitude (drives height share) and tooltip glyph.
export interface ClockBand
{
    color: string;
    value: number;   //magnitude over the period at this hour (W, %, or W/m²)
    icon:  string;
    label: string;   //per-source name for production bands, else ''
}

export interface ClockHour
{
    hour:      number;       //0..23 local
    bands:     ClockBand[];
    predicted: boolean;      //no actuals this hour — drawn from the solar forecast, transparently
}

export interface ClockData
{
    target: ChartTarget;
    hours:  ClockHour[];
    //The metric's representative colour, used to tint the hovered cylinder's glow.
    color:  string;
    //Tooltip value formatter for this metric (kW for power, % for soc/cloud, W/m² for irradiance).
    unit:   'power' | 'percent' | 'irradiance';
}

//Screen-space hit target: a bar's vertical axis (base -> top) tagged with its hour. Hovering any bar
//highlights its whole hour slice (every ring), so only the hour matters for the hit.
export interface ClockHit { hour: number; bx: number; by: number; tx: number; ty: number; }

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


//Bin one store series into 24 hour-of-day averages of its absolute value (export/charge come back negative).
function binHourAvg(store: UnifiedDataStore, series: (number | null)[]): number[]
{
    const sum = new Array<number>(24).fill(0);
    const cnt = new Array<number>(24).fill(0);
    for (let i = 0; i < store.bucketsTotal; i++)
    {
        const v = series[i];
        if (v === null || !isFinite(v)) { continue; }
        const h = new Date(store.storeStartMs + (i + 0.5) * store.stepMs).getHours();
        sum[h] += Math.abs(v);
        cnt[h] += 1;
    }
    return sum.map((s, h) => (cnt[h] ? s / cnt[h] : 0));
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


//Build the 24-hour rings for the active metric. Production keeps a per-PV-string breakdown (with a forecast
//fallback for hours that have no actuals yet); every other metric reuses the store series the timeline draws,
//binned by hour-of-day — same numbers, same colours.
export function buildClockData(host: ClockHost, target: ChartTarget): ClockData
{
    const store  = host._unifiedStore;
    const el     = host as unknown as Element;
    const dark   = host.themeIsDark();
    const meta   = clockTargetMeta(host, target);

    const empty = (unit: ClockData['unit']): ClockData => ({
        target, color: meta.color, unit,
        hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, bands: [], predicted: false })),
    });

    if (target === 'production')
    {
        if (!store) { return empty('power'); }
        const ids = Array.from(host._pvHistoryPerEntity.keys()).sort();
        const nowMs = Date.now();
        //Per-source actuals: instantaneous power at each past bucket centre, averaged by hour-of-day.
        const sum = ids.map(() => new Array<number>(24).fill(0));
        const cnt = ids.map(() => new Array<number>(24).fill(0));
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs > nowMs) { break; }
            const h = new Date(tMs).getHours();
            ids.forEach((id, s) =>
            {
                const ph = host._pvHistoryPerEntity.get(id);
                if (!ph) { return; }
                const v = pvValueAtTime(host, tMs, ph).value;
                if (isFinite(v) && v > 0) { sum[s][h] += v; cnt[s][h] += 1; }
            });
        }
        const srcAvg = sum.map((arr, s) => arr.map((x, h) => (cnt[s][h] ? x / cnt[s][h] : 0)));
        const forecastAvg = binHourAvg(store, store.forecast);
        const hours: ClockHour[] = [];
        for (let h = 0; h < 24; h++)
        {
            const bands: ClockBand[] = [];
            let actualTotal = 0;
            ids.forEach((id, s) =>
            {
                const v = srcAvg[s][h];
                actualTotal += v;
                if (v > 0)
                {
                    const name = String(host.hass?.states?.[id]?.attributes?.friendly_name ?? id);
                    bands.push({ color: energySolarColor(el, dark, s), value: v, icon: 'mdi:solar-power', label: name });
                }
            });
            //No actuals but a forecast: one transparent predicted band so a future day still reads its shape.
            if (actualTotal <= 0 && forecastAvg[h] > 0)
            {
                hours.push({ hour: h, predicted: true, bands: [
                    { color: ENERGY_COLOR.pv(el), value: forecastAvg[h], icon: 'mdi:solar-power', label: '' },
                ] });
            }
            else
            {
                hours.push({ hour: h, predicted: false, bands });
            }
        }
        return { target, color: meta.color, unit: 'power', hours };
    }

    if (target === 'battery-soc')
    {
        const hist = host._batterySocHistory;
        const sum = new Array<number>(24).fill(0);
        const cnt = new Array<number>(24).fill(0);
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const v = hist.values[i];
                if (!isFinite(v)) { continue; }
                const h = hist.times[i].getHours();
                sum[h] += v; cnt[h] += 1;
            }
        }
        const color = ENERGY_COLOR.batteryOut(el);
        return {
            target, color: meta.color, unit: 'percent',
            hours: Array.from({ length: 24 }, (_, h) => ({
                hour: h, predicted: false,
                bands: cnt[h] ? [{ color, value: sum[h] / cnt[h], icon: 'mdi:battery', label: '' }] : [],
            })),
        };
    }

    if (target === 'cloud')
    {
        const cs = host._chartSeries;
        const sum = [new Array<number>(24).fill(0), new Array<number>(24).fill(0), new Array<number>(24).fill(0)];
        const cnt = [new Array<number>(24).fill(0), new Array<number>(24).fill(0), new Array<number>(24).fill(0)];
        if (cs)
        {
            for (let i = 0; i < cs.times.length; i++)
            {
                const h = cs.times[i].getHours();
                const vals = [cs.cloudLow[i], cs.cloudMid[i], cs.cloudHigh[i]];
                vals.forEach((v, b) => { if (isFinite(v)) { sum[b][h] += Math.max(0, v); cnt[b][h] += 1; } });
            }
        }
        const base = ENERGY_COLOR.cloud(el);
        const cols  = [lerpHexToward(base, '#ffffff', 0.55), base, lerpHexToward(base, '#000000', 0.50)];
        const icons = ['mdi:format-vertical-align-bottom', 'mdi:format-vertical-align-center', 'mdi:format-vertical-align-top'];
        return {
            target, color: meta.color, unit: 'percent',
            hours: Array.from({ length: 24 }, (_, h) => ({
                hour: h, predicted: false,
                bands: [0, 1, 2]
                    .filter(b => cnt[b][h] && sum[b][h] / cnt[b][h] > 0)
                    .map(b => ({ color: cols[b], value: sum[b][h] / cnt[b][h], icon: icons[b], label: '' })),
            })),
        };
    }

    if (target === 'custom')
    {
        //Custom entity from its fetched hourly history (values in W), binned by hour-of-day. One red band.
        const hist = host._customEntityHistory;
        const sum = new Array<number>(24).fill(0);
        const cnt = new Array<number>(24).fill(0);
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const v = hist.values[i];
                if (!isFinite(v)) { continue; }
                const h = hist.times[i].getHours();
                sum[h] += Math.abs(v); cnt[h] += 1;
            }
        }
        return {
            target, color: meta.color, unit: 'power',
            hours: Array.from({ length: 24 }, (_, h) => ({
                hour: h, predicted: false,
                bands: cnt[h] ? [{ color: meta.color, value: sum[h] / cnt[h], icon: meta.icon, label: '' }] : [],
            })),
        };
    }

    //Remaining metrics are single- or dual-band store series, binned by hour-of-day.
    if (!store) { return empty(target === 'irradiance' ? 'irradiance' : 'power'); }

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
        //Signed net power: positive = charging. Split into two non-negative bands.
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

    const binned = specs.map(s => ({ avg: binHourAvg(store, s.series), color: s.color, icon: s.icon }));
    return {
        target, color: meta.color, unit,
        hours: Array.from({ length: 24 }, (_, h) => ({
            hour: h, predicted: false,
            bands: binned
                .filter(s => s.avg[h] > 0)
                .map(s => ({ color: s.color, value: s.avg[h], icon: s.icon, label: '' })),
        })),
    };
}


//Rectangular bar footprint (metres) oriented to the hour `angle`: `hr` is the half-depth along the radius
//(set so rings sit flush), `ht` the half-width along the tangent. Two faces sit perpendicular to the radius
//(one facing the centre, one facing out), two are tangential. Four sides — half the geometry of an octagon,
//so a full set of filter rings stays cheap to redraw each rotation frame.
function foot(cx: number, cy: number, hr: number, ht: number, angle: number): Array<[number, number]>
{
    const rs = Math.sin(angle), rc = Math.cos(angle);   //radial (outward) unit
    const ts = Math.cos(angle), tc = -Math.sin(angle);  //tangential unit
    return [
        [cx + hr * rs + ht * ts, cy + hr * rc + ht * tc],
        [cx + hr * rs - ht * ts, cy + hr * rc - ht * tc],
        [cx - hr * rs - ht * ts, cy - hr * rc - ht * tc],
        [cx - hr * rs + ht * ts, cy - hr * rc + ht * tc],
    ];
}

//Draw one extruded column split into stacked bands, back-to-front by depth, with a roof cap. Ported from the
//scene's home-histogram column: pure geometry through the shared camera, caller resolves each band's fill.
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
    const rings = cum.map(c => footprint.map(p => camera.project(p[0], p[1], totalHeightM * c)));
    const bearing = camera.bearingDeg * Math.PI / 180;
    const edges: Array<{ depth: number; faces: string }> = [];
    for (let i = 0; i < footprint.length; i++)
    {
        const next = (i + 1) % footprint.length;
        //Back-face cull: drop walls whose outward normal faces away from the camera.
        const edgeE = footprint[next][0] - footprint[i][0];
        const edgeN = footprint[next][1] - footprint[i][1];
        if (edgeN * Math.sin(bearing) + edgeE * Math.cos(bearing) <= 0) { continue; }
        let faces = '';
        for (let k = 0; k < bands.length; k++)
        {
            const lo = rings[k];
            const hi = rings[k + 1];
            faces += `<polygon points="${lo[i][0].toFixed(1)},${lo[i][1].toFixed(1)} ${lo[next][0].toFixed(1)},${lo[next][1].toFixed(1)} ${hi[next][0].toFixed(1)},${hi[next][1].toFixed(1)} ${hi[i][0].toFixed(1)},${hi[i][1].toFixed(1)}" fill="${bands[k].wall}" stroke="${stroke}" stroke-width="0.4"/>`;
        }
        edges.push({ depth: (rings[0][i][1] + rings[0][next][1]) / 2, faces });
    }
    edges.sort((a, b) => a.depth - b.depth);
    let svg = edges.map(e => e.faces).join('');
    const roof = rings[rings.length - 1].map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    svg += `<polygon points="${roof}" fill="${bands[bands.length - 1].roof}" stroke="${stroke}" stroke-width="0.6"/>`;
    return svg;
}


//Height factor [0..1] for an hour's cylinder during the grow sweep (1 when idle). growthStart = 0 means no
//animation. Staggered clockwise so the ring fills like a sweep hand.
function hourGrowth(growthStart: number, hour: number): number
{
    if (!growthStart) { return 1; }
    const t = Math.max(0, Math.min(1, (Date.now() - growthStart - hour * CLOCK_STAGGER_MS) / CLOCK_GROW_MS));
    return 1 - (1 - t) ** 3;
}

//Height factor [1..0] for a departing ring's reverse sweep: the mirror of hourGrowth (staggered from the
//last hour) so a removed filter's bars shrink away in the opposite order to how they grew in.
function hourShrink(removeStart: number, hour: number): number
{
    if (!removeStart) { return 1; }
    const t = Math.max(0, Math.min(1, (Date.now() - removeStart - (23 - hour) * CLOCK_STAGGER_MS) / CLOCK_GROW_MS));
    return (1 - t) ** 3;
}


//Fraction of the outer radius for ring slot `i`. Slots are FIXED (reserved for CLOCK_MAX_FILTERS rings): slot
//0 is the outer ring, each next slot a constant step inward to RING_INNER_MIN_FRAC. Independent of how many
//filters are active, so adding/removing one never re-spaces the others.
function ringRadiusFrac(i: number): number
{
    const slot = Math.min(i, CLOCK_MAX_FILTERS - 1);
    return 1 - slot * (1 - RING_INNER_MIN_FRAC) / (CLOCK_MAX_FILTERS - 1);
}

//Radial half-depth of every bar, in metres: half the constant slot spacing, so consecutive rings' bars sit
//flush — an outer ring's inner face meets the inner ring's outer face. `outerR` is the outer ring radius.
function barHalfRadial(outerR: number): number
{
    const slotSpacing = outerR * (1 - RING_INNER_MIN_FRAC) / (CLOCK_MAX_FILTERS - 1);
    return slotSpacing * 0.48;   //0.48 (not 0.5) leaves a hairline so adjacent faces don't z-fight
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

//Project one frame for ALL selected metrics as concentric rings (outer = first selected, nesting inward):
//the cylinder SVG (globally back-to-front across rings), the hit segments tagged with their ring, and the
//flat transforms for the 24 ground-laid hour labels. Pure.
export function projectClockFrame(
    camera: SceneCamera,
    dataList: ClockData[],
    growthStart: number,
    //Rings whose grow sweep is currently playing (null = all rings). Other rings render at full height.
    growRings: ReadonlySet<number> | null,
    //A departing ring (index) shrinking out in reverse, with its own sweep start. null = none.
    removingRing: number | null,
    removeStart: number,
    highlightHour: number | null,
    //Hour kept at full opacity while its slice is focused; every other hour dims by `dim` (0..1). dimHour
    //persists through the fade-out so the dimmed bars ramp back smoothly after the hover/tap ends.
    dimHour: number | null,
    dim: number
): ClockFrame
{
    const width  = camera.centreX * 2;
    const height = camera.centreY * 2;
    const minEdge = Math.min(width, height) || 1;
    const ppm = camera.pxPerMetre || 1;
    const outerR = (RING_R_FRAC * minEdge) / ppm;
    const baseFootR = (FOOT_R_FRAC * minEdge) / ppm;
    const halfRadial = barHalfRadial(outerR);   //constant: makes consecutive rings sit flush
    const maxHpx = MAX_HEIGHT_FRAC * minEdge;
    const flatPx = FLAT_FRAC * minEdge;
    const tilt    = camera.tiltDeg;
    const bearing = camera.bearingDeg;

    //Hour labels, laid flat just outside the OUTER ring; each fades with its distance from the camera.
    const labelR = outerR * LABEL_R_MULT;
    const projLabels = Array.from({ length: 24 }, (_, h) =>
    {
        const angle = (h / 24) * 2 * Math.PI;
        return camera.project3(labelR * Math.sin(angle), labelR * Math.cos(angle), 0);
    });
    let depthMin = Infinity;
    let depthMax = -Infinity;
    for (const p of projLabels) { depthMin = Math.min(depthMin, p.depth); depthMax = Math.max(depthMax, p.depth); }
    const depthRange = depthMax - depthMin || 1;
    const labels = projLabels.map((p, h) =>
    {
        const near = (p.depth - depthMin) / depthRange;
        return {
            x: p.x, y: p.y,
            opacity: LABEL_MIN_OPACITY + (1 - LABEL_MIN_OPACITY) * near,
            transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + (h / 24) * 360 + 180}deg)`,
        };
    });

    //Collect every column across all rings, each normalised to ITS OWN ring's busiest hour (metrics have
    //different units), then depth-sort globally so near columns paint over far ones regardless of ring.
    type Col = {
        ring: number; hour: number; bands: ClockBand[]; predicted: boolean;
        east: number; north: number; angle: number; amount: number; maxValue: number; halfTan: number; screenY: number;
    };
    const cols: Col[] = [];
    dataList.forEach((data, ring) =>
    {
        const ringR   = outerR * ringRadiusFrac(ring);
        const halfTan = baseFootR * ringRadiusFrac(ring);   //tangential width keeps a constant angular span
        const perHour = data.hours.map(r =>
        {
            const angle = (r.hour / 24) * 2 * Math.PI;
            const east  = ringR * Math.sin(angle);
            const north = ringR * Math.cos(angle);
            const amount = r.bands.reduce((s, b) => s + Math.max(0, b.value), 0);
            return { r, east, north, angle, amount };
        });
        const maxValue = Math.max(0, ...perHour.map(p => p.amount));
        for (const p of perHour)
        {
            cols.push({
                ring, hour: p.r.hour, bands: p.r.bands, predicted: p.r.predicted,
                east: p.east, north: p.north, angle: p.angle, amount: p.amount, maxValue, halfTan,
                screenY: camera.project(p.east, p.north, 0)[1],
            });
        }
    });
    cols.sort((a, b) => a.screenY - b.screenY);

    const hits: ClockHit[] = [];
    //Opacity of a column: predicted bars are half-transparent; while a slice is focused, every OTHER hour
    //dims by `dim` (toward 0.5). The two multiply.
    const colOpacity = (hour: number, predicted: boolean): number =>
    {
        const dimmed = dimHour !== null && hour !== dimHour ? 1 - 0.5 * dim : 1;
        return (predicted ? 0.5 : 1) * dimmed;
    };

    let svg = '';
    for (const col of cols)
    {
        //Hovering any bar lights its whole hour slice: every ring's bar at that hour reads as active.
        const active = highlightHour !== null && col.hour === highlightHour;
        //A departing ring shrinks (reverse sweep); otherwise grow plays only on the rings currently sweeping
        //(null = all), the rest at full height.
        const grow   = col.ring === removingRing
            ? hourShrink(removeStart, col.hour)
            : (growthStart && (growRings === null || growRings.has(col.ring)))
                ? hourGrowth(growthStart, col.hour) : 1;
        const fp     = foot(col.east, col.north, halfRadial, col.halfTan, col.angle);

        if (col.amount <= 0 || col.maxValue <= 0)
        {
            //Empty hour: a flat neutral puck so all 24 stay on the dial.
            const h = (flatPx / ppm) * grow;
            const base = camera.project(col.east, col.north, 0);
            const top  = camera.project(col.east, col.north, h);
            hits.push({ hour: col.hour, bx: base[0], by: base[1], tx: top[0], ty: top[1] });
            let puck = stackedColumn(camera, fp, h,
                [{ frac: 1, wall: 'rgba(140,140,140,0.3)', roof: 'rgba(170,170,170,0.42)' }], 'rgba(0,0,0,0.25)');
            const op = colOpacity(col.hour, false);
            if (op < 1) { puck = `<g opacity="${op.toFixed(3)}">${puck}</g>`; }
            svg += puck;
            continue;
        }

        //Minimum height keeps tiny values visible; the rest scale against the ring's busiest hour.
        const colHeight = (Math.max(flatPx, (col.amount / col.maxValue) * maxHpx) / ppm) * grow;
        const base = camera.project(col.east, col.north, 0);
        const top  = camera.project(col.east, col.north, colHeight);
        hits.push({ hour: col.hour, bx: base[0], by: base[1], tx: top[0], ty: top[1] });

        const bands = col.bands
            .filter(b => b.value > 0)
            .map(b => ({
                frac: b.value / col.amount,
                wall: lerpHexToward(b.color, '#000000', 0.25),
                roof: lerpHexToward(b.color, '#ffffff', active ? 0.4 : 0.12),
            }));
        if (!bands.length) { continue; }
        const stroke = active ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.3)';
        let piece = stackedColumn(camera, fp, colHeight, bands, stroke);
        //Highlighted bars glow in their own ring's colour (one filter per ring).
        if (active) { piece = `<g filter="url(#clock-glow-${col.ring})">${piece}</g>`; }
        const op = colOpacity(col.hour, col.predicted);
        if (op < 1) { piece = `<g opacity="${op.toFixed(3)}">${piece}</g>`; }
        svg += piece;
    }

    //One glow filter per ring, tinted to its metric colour, so every highlighted bar in the hour slice reads
    //above the rest in its own colour.
    let defs = '<defs>';
    dataList.forEach((d, i) =>
    {
        defs += `<filter id="clock-glow-${i}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${d.color}" flood-opacity="0.9"/></filter>`;
    });
    defs += '</defs>';

    //Guide + compass sit under the cylinders (drawn first, after the defs) so columns + glow paint over them;
    //the focused hour's spoke brightens with the dim. The compass is outside the dial, so nothing overlaps it.
    const compass = clockCompass(camera, outerR, bearing, tilt);
    return {
        svg: defs + clockGuide(camera, outerR, dimHour, dim) + compass.svg + svg,
        hits, labels, compass: compass.labels,
    };
}


//Hour of the bar nearest the cursor (within HOVER_PX of its axis); null when off every bar. Hour-only,
//since hovering lights the whole slice across rings.
export function clockHitTest(hits: ClockHit[], x: number, y: number): number | null
{
    let best: number | null = null;
    let bestD = HOVER_PX;
    for (const h of hits)
    {
        const d = distToSegment(x, y, h.bx, h.by, h.tx, h.ty);
        if (d < bestD) { bestD = d; best = h.hour; }
    }
    return best;
}


//A metric's total magnitude at a given hour (sum of its bands), for the per-filter tooltip rows.
export function clockHourTotal(data: ClockData, hour: number): number
{
    const r = data.hours.find(h => h.hour === hour);
    return r ? r.bands.reduce((s, b) => s + Math.max(0, b.value), 0) : 0;
}

//Format a band/total magnitude for the tooltip, per the metric's unit.
export function formatClockValue(host: ClockHost, data: ClockData, v: number): string
{
    if (data.unit === 'percent')    { return `${Math.round(Math.max(0, v))} %`; }
    if (data.unit === 'irradiance') { return `${Math.round(Math.max(0, v))} W/m²`; }
    return `${formatLocalisedNumber(host.hass, v / 1000, 1)} kW`;
}
