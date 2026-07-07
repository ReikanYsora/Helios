//Energy-clock mode: a ring of 24 hourly cylinders on the ground plane, one per hour, showing whichever
//metric the rail selects (production split per source, grid into import/export, battery into
//charge/discharge, etc.). Each hour aggregates the metric over the whole rolling window (a single day shows
//that day's shape; a longer range averages it). Data comes from the store + histories already loaded, binned
//by hour-of-day, no extra fetch.

import type { SceneCamera } from '../scene/projection';
import { HOUR_MS, HOURS_PER_DAY, SUN_COLOR_HEX } from '../core/config/constants';
import { type ChartTarget, type ChartHost, clockTargetLabel, solarSourceName,
    gridImportName, gridExportName, batteryChargeName, batteryDischargeName } from '../charts/charts';
import { changeSeriesToWatts } from '../data/sources/energy-stats';
import { consumptionLoad } from '../core/energy';
import { ENERGY_COLOR, energySolarColor, lerpHexToward, formatPower, formatIrradiance, formatEnergyKwh, cssHex, uiColorVar } from '../core/format/format';
import type { UnifiedDataStore } from '../data/unifiedStore';
import { customEntityId, customEntityColor, valueDecimals, powerUnit, irradianceUnit } from '../core/config/helios-config';
import { resolveCustomEntityIcon } from '../data/sources/custom-entity';
import { buildLogoDecal } from '../scene/helios-logo';
import type { ClockHourly } from './clock-hourly';
import { modeBucketsPerHour, type TimelineMode } from '../timeline/timeline-modes';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import { serverHour, serverHourFrac } from '../core/time/timezone';

//Structural surface the clock reads off the card. themeIsDark resolves palette polarity for the per-source
//colour ramp.
export type ClockHost = ChartHost & {
    themeIsDark(): boolean;
    _weatherAvailable: boolean;
    _timelineMode: TimelineMode;
    _energyDefaults: EnergyDefaults;
    //Decoupled hourly profile, present only in month/year clock mode (daily store). When set, buildClockData
    //reads it instead of the store so the dial still shows an hour-of-day shape.
    _clockHourly: ClockHourly | null;
};

//Ring geometry as fractions of the smaller viewport edge so the clock fills the card at any size.
const RING_R_FRAC     = 0.34;   //outermost ring radius
const DAY_RING_R_FRAC = 0.40;   //day mode zooms the dial in (bigger than the scene ring) while the hour labels still fit
const DAY_RAIL_FRAC   = 0.32;   //inner fraction of a day consumption ring taken by its solid identity rail
const DAY_GRID_HEX    = '#6d84a6';   //cold slate for grid-drawn hours, a sharp contrast with the sun gold
const RING_INNER_MIN_FRAC = 0.4;//innermost ring radius as a fraction of the outer one
//Fixed slot count: rings always sit at their slot radius, so adding/removing a filter never re-spaces the others.
const CLOCK_MAX_FILTERS = 8;
const MAX_HEIGHT_FRAC = 0.30;   //tallest bar
//Bar tangential half-width (scaled per ring) and radial half-depth (fraction of slot spacing so consecutive
//rings' bars sit flush).
const BAR_TANGENT_FRAC = 0.018;
const BAR_RADIAL_FRAC  = 0.45;
const LABEL_R_MULT    = 1.18;   //hour labels sit just outside the ring
const LABEL_MIN_OPACITY = 0.15; //farthest-back hour label opacity (nearest is opaque)
//Clock-face guide: faint centre ring + 24 spokes reaching toward (but stopping short of) the hour labels.
const CLOCK_HUB_R_FRAC      = 0.12;
const CLOCK_SPOKE_OUTER_FRAC = 1.10;
const CLOCK_GUIDE_OPACITY   = 0.25;
//Compass: filled N/S triangles just beyond the hour labels, with a letter at each tip. Full opacity (no
//depth fade) so orientation always reads.
const CLOCK_COMPASS_BASE_FRAC   = 1.30;
const CLOCK_COMPASS_TIP_FRAC    = 1.42;
const CLOCK_COMPASS_HALF_W_FRAC = 0.05;
const CLOCK_COMPASS_LABEL_FRAC  = 1.50;
//Shared ease-out for every clock transition (grow, shrink, slide, dim). p clamped to 0..1.
export function easeOutCubic(p: number): number
{
    const c = p < 0 ? 0 : p > 1 ? 1 : p;
    return 1 - (1 - c) ** 3;
}
//How close (screen px) the cursor must be to an hour's axis to hover it.
const HOVER_PX = 22;


//One stacked layer of a metric: a per-slot series (CLOCK_SLOTS values) aggregated to 24 hourly bars. Layers
//stack cumulatively.
export interface ClockLayer
{
    color:      string;
    icon:       string;
    label:      string;       //per-source name for production layers, else ''
    values:     number[];     //CLOCK_SLOTS per-slot magnitudes (W, %, or W/m²)
}

export interface ClockData
{
    target: ChartTarget;
    layers: ClockLayer[];
    //The metric's representative colour, for the rail button + the hovered slice glow.
    color:  string;
    //Tooltip formatter + aggregation. 'energy' metrics (production/consumption/grid/battery) SUM kWh over the
    //window per hour-of-day (a total); 'power'/'percent'/'irradiance' AVERAGE.
    unit:   'energy' | 'power' | 'percent' | 'irradiance';
}

//One ring to project, with animation scalars resolved by the card: `slot` is the (possibly fractional) ring
//index driving the radius (interpolated for the slide); `heightScale` 0..1 grow/shrink; `opacity` 0..1 exit fade.
export interface ClockRingInput
{
    data:        ClockData;
    slot:        number;
    heightScale: number;
    opacity:     number;
}

//Screen-space hit target: a vertical axis (base -> top) tagged with its slot, one per hourly bar (tagged with
//that hour's first slot). Hovering highlights it.
export interface ClockHit { slot: number; bx: number; by: number; tx: number; ty: number; }

//One projected frame, split into two SVG layers so the home prism can sit between them: `guideSvg` (flat-ground
//hub + 24 hour spokes + compass) paints UNDER the prism, `svg` (upright metric cylinders) OVER it. Plus the
//per-element transforms the card writes onto its DOM nodes.
export interface ClockFrame
{
    guideSvg: string;
    svg:    string;
    hits:   ClockHit[];
    labels: { x: number; y: number; opacity: number; transform: string }[];
    //N/S compass letters, laid flat like the hours but at full opacity.
    compass: { x: number; y: number; transform: string; label: string }[];
    //Home prism's projected centre + screen-px hit radius (the inner empty disc), for the home-hover total.
    home: { x: number; y: number; r: number };
    //Ground-laid Helios mark that replaces the old central column: inner SVG + whether it is hover/tap-active
    //(drives the opacity fade). The engine tilts it onto the ground plane under the upright bars.
    decal: { svg: string; active: boolean };
    //Day mode only: one screen-space hover target per device ring (aligned with the device list). Undefined for
    //the clock/trend dials.
    dayHits?: DayRingHit[];
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


//Dial resolution: sub-hourly slots binning the metric finer than hourly (the histogram re-aggregates to 24
//hourly bars). Fixed at 4 slots/hour: per-hour totals are independent of the slot count.
export const CLOCK_SLOTS_PER_HOUR = 4;
const CLOCK_SLOTS = 24 * CLOCK_SLOTS_PER_HOUR;

//Hour-of-day placement on the dial. `frac` is the fraction of the day (0..1). The southern hemisphere
//reflects the ring about the east-west axis so noon sits north, sunrise east and sunset west, matching the
//real austral sky and the scene's own compass, sun arc and shadows. The dial therefore runs anticlockwise
//there (a reflection reverses the hour order), which is correct for the southern sun even if it reads
//unusually. The compass letters keep their true north/south/east/west, so they are not adjusted.
const hourFracAdj = (frac: number, southern: boolean): number => (southern ? 0.5 - frac : frac);
const hourRad = (frac: number, southern: boolean): number => hourFracAdj(frac, southern) * 2 * Math.PI;
const hourDeg = (frac: number, southern: boolean): number => hourFracAdj(frac, southern) * 360;

//Slot-of-day [0..CLOCK_SLOTS) for an instant, in the HOME time zone (see ./tz) so the dial groups by the home's
//real hour of day, not the browser's.
function slotOf(ms: number): number
{
    return Math.min(CLOCK_SLOTS - 1, Math.floor(serverHourFrac(ms) * CLOCK_SLOTS_PER_HOUR));
}

//Fill NaN gaps by linear interpolation between nearest real samples, wrapping the dial, so an HOURLY-sourced
//metric (sparse sub-hour slots: custom entity, battery SoC, cloud) reads as a smooth ramp instead of a spike
//once per hour. Sub-hour-dense store metrics have no gaps (no-op). All-NaN collapses to zeros.
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

//Expand a 24-value hour-of-day profile to the dial's per-slot resolution. For `sum` (energy) the hour's TOTAL
//splits evenly across its slots, so re-summing recovers the total; otherwise the hourly value is HELD across
//its slots, and a histogram averages back to it.
function expandHourly(hourly: number[], sum: boolean): number[]
{
    const slots = CLOCK_SLOTS;
    const out = new Array<number>(slots);
    for (let i = 0; i < slots; i++)
    {
        const v = Math.max(0, hourly[Math.floor(i / CLOCK_SLOTS_PER_HOUR)] ?? 0);
        out[i] = sum ? v / CLOCK_SLOTS_PER_HOUR : v;
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
        const s = slotOf(store.storeStartMs + (i + 0.5) * store.stepMs);
        sum[s] += Math.abs(v);
        cnt[s] += 1;
    }
    return fillGaps(sum.map((x, s) => (cnt[s] ? x / cnt[s] : NaN)));
}

//Sum one store WATTS series into per-slot ENERGY (kWh) by hour-of-day. Each bucket's energy is SPREAD across
//the slots it covers, so a coarse store (e.g. hourly buckets in month mode) fills every slot evenly instead of
//dumping a whole hour into one slot (the sawtooth). Summing kWh directly (not watts/duration) keeps DST-folded
//buckets from inflating. This is the clock's "total per period".
function binSlotSum(store: UnifiedDataStore, series: (number | null)[]): number[]
{
    const sum    = new Array<number>(CLOCK_SLOTS).fill(0);
    const stepH  = store.stepMs / HOUR_MS;
    const slotMs = HOUR_MS / CLOCK_SLOTS_PER_HOUR;
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
            sum[slotOf(t)] += energy * ((segEnd - t) / store.stepMs);
            t = segEnd;
        }
    }
    return sum;
}

//True when a series carries any real (non-null, non-zero) reading: drives which rail buttons appear.
function hasSignal(series: (number | null)[] | undefined): boolean
{
    return !!series && series.some(v => v !== null && isFinite(v) && v !== 0);
}


//The metrics the rail offers, in display order, filtered to those configured/loaded so buttons stack with no
//gaps. Order: production, consumption, battery pair, grid, weather, custom.
export function availableClockTargets(host: ClockHost): ChartTarget[]
{
    const store = host._unifiedStore;
    const hasProduction = host._energyDefaults.solarStatEnergyFroms.length > 0
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
    //Custom entity, present whenever configured (its ring may be sparse until history lands).
    if (customEntityId(host.config))  { out.push('custom'); }
    return out;
}

//Rail button appearance per metric: a glyph + the metric's colour (idle icon tint + active fill).
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
        case 'custom':      return { icon: resolveCustomEntityIcon(host.hass, host.config), color: cssHex(el, uiColorVar(customEntityColor(host.config), 'red'), '#f44336') };
        default:            return { icon: 'mdi:solar-power',          color: ENERGY_COLOR.pv(el) };
    }
}

//clockTargetLabel lives in charts.ts (single label source); re-exported so callers importing from the clock keep working.
export { clockTargetLabel };


//Build layers from the decoupled hourly profile (month/year daily store): each metric expands its 24
//hour-of-day totals to the dial's slots. Production splits per solar source like the short-window path;
//weather metrics aren't offered in these modes, so they fall through to empty.
export function buildClockDataHourly(host: ClockHost, target: ChartTarget, h: ClockHourly): ClockData
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
        case 'custom':      return data('energy', [oneE(meta.color, meta.icon, tgtLabel, h.custom)]);
        default:            return data(target === 'irradiance' ? 'irradiance' : 'energy', []);
    }
}

//Build the stacked layers for the active metric. Production keeps a per-source breakdown; every other metric
//reuses the store series the timeline draws, binned by hour-of-day (same numbers, same colours). On a long
//window the daily store carries no intraday shape, so the decoupled hourly profile (host._clockHourly) takes over.
export function buildClockData(host: ClockHost, target: ChartTarget): ClockData
{
    if (host._clockHourly) { return buildClockDataHourly(host, target, host._clockHourly); }

    const store  = host._unifiedStore;
    const el     = host as unknown as Element;
    const dark   = host.themeIsDark();
    const meta   = clockTargetMeta(host, target);

    const data = (unit: ClockData['unit'], layers: ClockLayer[]): ClockData =>
        ({ target, color: meta.color, unit, layers });

    //Month/year need the decoupled hourly profile; until it lands, render empty rather than the daily store,
    //which has no hour-of-day shape and would draw a flat full-height ring.
    if (modeBucketsPerHour(host._timelineMode, host.config) < 1)
    {
        return data(target === 'irradiance' ? 'irradiance' : 'energy', []);
    }

    if (target === 'production')
    {
        if (!store) { return data('energy', []); }
        const nowMs = Date.now();
        const stepH  = store.stepMs / HOUR_MS;
        const slotMs = HOUR_MS / CLOCK_SLOTS_PER_HOUR;
        //Per-source production from the recorder `change` metric (reset-corrected, exact HA Energy energy,
        //no sun floor), so each string matches the dashboard and recorded night production from non-solar
        //sources fed in as PV shows. Multi-source rings wait for the per-source fetch (a beat after load);
        //a single source reads the aggregate series, which IS its meter. Source order (NOT sorted):
        //parallel to solarStatEnergyFroms, so index `s` lines up with solarSourceName(host, s).
        const meters = host._energyDefaults.solarStatEnergyFroms;
        const usePerSourceChange = meters.length >= 2 && meters.every((m) => host._pvChangeSeriesPerEntity.has(m));
        const ids = usePerSourceChange ? meters : meters.slice(0, 1);
        const perSourceWatts = usePerSourceChange
            ? meters.map((m) => changeSeriesToWatts(host._pvChangeSeriesPerEntity.get(m) ?? null, store.storeStartMs, store.stepMs, store.bucketsTotal, nowMs))
            : (meters.length === 1 ? [changeSeriesToWatts(host._pvChangeSeries, store.storeStartMs, store.stepMs, store.bucketsTotal, nowMs)] : []);
        //Per-source energy (kWh) SUMMED by hour-of-day: each bucket's power * its hours, SPREAD across the slots
        //it covers, so a coarse store fills every slot instead of one (as in binSlotSum).
        const wsum = ids.map(() => new Array<number>(CLOCK_SLOTS).fill(0));
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs > nowMs) { break; }
            const bStart = store.storeStartMs + i * store.stepMs;
            const bEnd   = bStart + store.stepMs;
            for (let s = 0; s < ids.length; s++)
            {
                const w = perSourceWatts[s]?.[i];
                if (w === null || w === undefined || !(w > 0)) { continue; }
                const v = w;
                const energy = (v * stepH) / 1000;
                for (let t = bStart; t < bEnd; )
                {
                    const slotEnd = Math.floor(t / slotMs) * slotMs + slotMs;
                    const segEnd  = Math.min(bEnd, slotEnd);
                    wsum[s][slotOf(t)] += energy * ((segEnd - t) / store.stepMs);
                    t = segEnd;
                }
            }
        }
        //Actuals only: the clock shows recorded energy, no forecast layer (a translucent forecast ring reads as
        //real production and misleads; the timeline carries the forecast instead).
        const layers: ClockLayer[] = ids.map((_id, s) => ({
            color: energySolarColor(el, dark, s),
            icon:  'mdi:solar-power',
            label: solarSourceName(host, s),
            values: wsum[s],
        }));
        return data('energy', layers);
    }

    //Average a sum/count pair into a per-slot series, interpolating empty slots (hourly sources land in 1 of
    //every 4 slots; fillGaps ramps between them instead of spiking).
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
                const h = slotOf(hist.times[i].getTime());
                sum[h] += v; cnt[h] += 1;
            }
        }
        return data('percent', [{ color: ENERGY_COLOR.batteryOut(el), icon: 'mdi:battery', label: clockTargetLabel(host, target), values: avgOf(sum, cnt) }]);
    }

    if (target === 'custom')
    {
        //Custom energy meter, mapped onto the store grid then summed to kWh totals per slot, exactly like the
        //grid/battery rings. Magnitude only so a signed meter reads as a single ring.
        if (!store) { return data('energy', []); }
        const watts  = changeSeriesToWatts(host._customChangeSeries ?? null, store.storeStartMs, store.stepMs, store.bucketsTotal, Date.now());
        const values = binSlotSum(store, watts.map(v => (v === null ? null : Math.abs(v))));
        return data('energy', [{ color: meta.color, icon: meta.icon, label: clockTargetLabel(host, target), values }]);
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
        //Signed net power (positive = charging), split into two non-negative layers.
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
        //Consumption derived per bucket: production + import - export - net battery, clamped at 0.
        const cons: (number | null)[] = new Array(store.bucketsTotal).fill(null);
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const p = store.production[i]; const gi = store.gridImport[i];
            const ge = store.gridExport[i]; const b = store.battery[i];
            if (p === null && gi === null && ge === null && b === null) { continue; }
            cons[i] = consumptionLoad(p ?? 0, gi ?? 0, ge ?? 0, b ?? 0);
        }
        specs = [{ series: cons, color: ENERGY_COLOR.consumption(el), icon: 'mdi:home-lightning-bolt', label: clockTargetLabel(host, target) }];
    }

    const agg = unit === 'energy' ? binSlotSum : binSlotAvg;
    return data(unit, specs.map(s => ({ color: s.color, icon: s.icon, label: s.label, values: agg(store, s.series) })));
}


//Fraction of the outer radius for ring slot `i`. Slots are FIXED (CLOCK_MAX_FILTERS reserved): slot 0 is the
//outer ring, each next a constant step inward to RING_INNER_MIN_FRAC, independent of how many filters are
//active, so adding/removing one never re-spaces the others.
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
export function hourlyOf(values: number[], sum: boolean): number[]
{
    const out = new Array<number>(HOURS_PER_DAY).fill(0);
    for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        let s = 0;
        for (let j = 0; j < CLOCK_SLOTS_PER_HOUR; j++) { s += Math.max(0, values[h * CLOCK_SLOTS_PER_HOUR + j] ?? 0); }
        out[h] = sum ? s : s / CLOCK_SLOTS_PER_HOUR;
    }
    return out;
}

//Busiest stacked hourly total of a ring. Drives the per-UNIT shared ceiling, so two metrics in the same unit
//plot on the same axis (a 2 kW and a 5 kW power metric read at the right relative heights instead of both
//filling their own ring).
function ringMax(data: ClockData): number
{
    let m = 0;
    const hourly = data.layers.map(L => hourlyOf(L.values, data.unit === 'energy'));
    for (let h = 0; h < HOURS_PER_DAY; h++) { let t = 0; for (const hv of hourly) { t += Math.max(0, hv[h]); } m = Math.max(m, t); }
    return m;
}

//Target per-unit ceiling for a set of rings (busiest among same-unit metrics). The card eases the displayed
//ceiling toward this between filter changes so the remaining bars grow/shrink smoothly instead of snapping.
export function clockUnitCeilings(datas: ClockData[]): Map<string, number>
{
    const m = new Map<string, number>();
    for (const d of datas) { m.set(d.unit, Math.max(m.get(d.unit) ?? 0, ringMax(d))); }
    return m;
}

//Rectangular bar footprint (metres) oriented to `angle`: `hr` half-depth along the radius (rings sit flush),
//`ht` half-width along the tangent.
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

//Clock-face guide laid flat on the ground (under the cylinders): a faint centre ring + a spoke per hour
//reaching from the ring toward each hour label, stopping short so it never overlaps the text, plus the outer
//ring closing the 24 pie slices. Theme colour, low opacity. `outerR` is the outermost ring radius in metres.
function clockGuide(camera: SceneCamera, outerR: number): string
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
    for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        const a  = hourRad(h / HOURS_PER_DAY, camera.southern);
        const p1 = camera.project(hubR * Math.sin(a), hubR * Math.cos(a), 0);
        const p2 = camera.project(tipR * Math.sin(a), tipR * Math.cos(a), 0);
        svg += `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" stroke="${col}" stroke-opacity="${CLOCK_GUIDE_OPACITY}" stroke-width="1" stroke-dasharray="2 2.5"/>`;
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
            transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + (hourEquiv / HOURS_PER_DAY) * 360 + 180}deg)`,
        };
    });
    return { svg, labels };
}

interface ClockFace { depth: number; svg: string }

//Small downward marker above the dial at the CURRENT hour's slot, so opening a dial instantly shows which hour
//band is "now". A dashed line drops from it to `toH` (that hour's bar top) so the marker reads in 3D space.
//Drawn last (always on top).
function currentHourArrow(camera: SceneCamera, R: number, maxHm: number, toH: number): string
{
    const hour = serverHour(Date.now());
    const a = hourRad((hour + 0.5) / HOURS_PER_DAY, camera.southern);
    const e = R * Math.sin(a); const n = R * Math.cos(a);
    const apex = camera.project(e, n, maxHm * 1.15);
    const drop = camera.project(e, n, Math.max(0, toH));
    const col  = 'var(--primary-color, #03a9f4)';
    //Dashed drop to the bar top, then a downward triangle whose apex sits above it.
    const line = `<line x1="${apex[0].toFixed(1)}" y1="${apex[1].toFixed(1)}" x2="${drop[0].toFixed(1)}" y2="${drop[1].toFixed(1)}" stroke="${col}" stroke-width="1.2" stroke-dasharray="2 2"/>`;
    const tri  = `<polygon points="${apex[0].toFixed(1)},${apex[1].toFixed(1)} ${(apex[0] - 6).toFixed(1)},${(apex[1] - 11).toFixed(1)} ${(apex[0] + 6).toFixed(1)},${(apex[1] - 11).toFixed(1)}" fill="${col}" stroke="rgba(255,255,255,0.85)" stroke-width="0.8"/>`;
    return line + tri;
}

//Day/night ground wedges: one flat pizza-slice per hour from the hub out toward the map edge, its darkness set
//by that hour's night share over the period (always-night hours full, mixed hours partial). Painted on the
//ground (under the dial) so it reads as the sun being up or down at each hour band.
function nightSectors(camera: SceneCamera, innerR: number, outerR: number, nightFrac: number[], maxOp: number): string
{
    const SEG = 4;
    let s = '';
    for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        const frac = nightFrac[h] ?? 0;
        if (frac < 0.02) { continue; }
        const a0 = hourRad(h / HOURS_PER_DAY, camera.southern);
        const a1 = hourRad((h + 1) / HOURS_PER_DAY, camera.southern);
        const pts: string[] = [];
        for (let k = 0; k <= SEG; k++) { const a = a0 + (a1 - a0) * k / SEG; const p = camera.project(outerR * Math.sin(a), outerR * Math.cos(a), 0); pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`); }
        for (let k = SEG; k >= 0; k--) { const a = a0 + (a1 - a0) * k / SEG; const p = camera.project(innerR * Math.sin(a), innerR * Math.cos(a), 0); pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`); }
        s += `<polygon points="${pts.join(' ')}" fill="#070b14" opacity="${(frac * maxOp).toFixed(3)}"/>`;
    }
    return s;
}

//One annular band, flat on the ground (top-down): a continuous dark track so the band is always a complete circle
//over the basemap, plus one colour cell per slot whose OPACITY carries the slot's value. No radial gauge and
//nothing stacked, so every band stays legible; the dark track also backs the anti-aliasing seams between cells so
//they read as the theme background, not bright gaps. Edge outlines are drawn separately (see dayEdge), so bands can
//be glued together (production sub-bands) with a single outline around the whole group.
function dayOpacityBand(camera: SceneCamera, rInner: number, rOuter: number, color: string, ops: number[], slots: number): string
{
    const SEG = 4;
    const pt  = (r: number, a: number): string => { const p = camera.project(r * Math.sin(a), r * Math.cos(a), 0); return `${p[0].toFixed(1)},${p[1].toFixed(1)}`; };
    const trackN = Math.max(24, slots);
    const track: string[] = [];
    for (let k = 0; k <= trackN; k++) { track.push(pt(rOuter, hourRad(k / trackN, camera.southern))); }
    for (let k = trackN; k >= 0; k--) { track.push(pt(rInner, hourRad(k / trackN, camera.southern))); }
    let s = `<polygon points="${track.join(' ')}" fill="#9aa4b8" opacity="0.1"/>`;
    for (let i = 0; i < slots; i++)
    {
        const op = ops[i] ?? 0;
        if (op <= 0.02) { continue; }
        const a0 = hourRad(i / slots, camera.southern);
        const a1 = hourRad((i + 1) / slots, camera.southern);
        const pts: string[] = [];
        for (let k = 0; k <= SEG; k++) { pts.push(pt(rOuter, a0 + (a1 - a0) * k / SEG)); }
        for (let k = SEG; k >= 0; k--) { pts.push(pt(rInner, a0 + (a1 - a0) * k / SEG)); }
        s += `<polygon points="${pts.join(' ')}" fill="${color}" opacity="${Math.min(1, op).toFixed(3)}"/>`;
    }
    return s;
}

//One edge outline (a projected ring polyline at radius r) in the given colour.
function dayEdge(camera: SceneCamera, r: number, color: string, slots: number): string
{
    const n = Math.max(24, slots);
    const pts: string[] = [];
    for (let k = 0; k <= n; k++) { const a = hourRad(k / n, camera.southern); const p = camera.project(r * Math.sin(a), r * Math.cos(a), 0); pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`); }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="0.85"/>`;
}

//A device ring in two radially-separate zones, so device identity and the sun story never mix:
//  - a thick SOLID inner rail in the device's own colour (the identity: always visible, full opacity),
//  - the SUN-vs-GRID fragments hooked onto it toward the outer edge -- each active slot split into two layered
//    fills whose opacities carry the slot's brightness between SUN (self-powered: solar + battery, gold) and GRID
//    (drawn from the grid, a sharp cold slate). No outer edge; the gap to the next ring separates them.
//`values` is the device's per-slot energy; `coverage[s]` is the self-sufficiency share (solar + battery) of the slot.
function dayDeviceRing(camera: SceneCamera, rInner: number, rOuter: number, deviceColor: string, values: number[], coverage: number[], slots: number): string
{
    const SEG = 4;
    const pt  = (r: number, a: number): string => { const p = camera.project(r * Math.sin(a), r * Math.cos(a), 0); return `${p[0].toFixed(1)},${p[1].toFixed(1)}`; };
    const rRail  = rInner + (rOuter - rInner) * DAY_RAIL_FRAC;   //fragments live in [rRail, rOuter]
    const trackN = Math.max(24, slots);
    //Solid identity rail (full annulus, [rInner, rRail]).
    const rail: string[] = [];
    for (let k = 0; k <= trackN; k++) { rail.push(pt(rRail, hourRad(k / trackN, camera.southern))); }
    for (let k = trackN; k >= 0; k--) { rail.push(pt(rInner, hourRad(k / trackN, camera.southern))); }
    //Faint neutral track behind the fragment zone ([rRail, rOuter]) so idle hours read without going black.
    const track: string[] = [];
    for (let k = 0; k <= trackN; k++) { track.push(pt(rOuter, hourRad(k / trackN, camera.southern))); }
    for (let k = trackN; k >= 0; k--) { track.push(pt(rRail, hourRad(k / trackN, camera.southern))); }
    let s = `<polygon points="${track.join(' ')}" fill="#9aa4b8" opacity="0.1"/>`
          + `<polygon points="${rail.join(' ')}" fill="${deviceColor}" opacity="1"/>`;
    let peak = 0;
    for (const v of values) { if (v > peak) { peak = v; } }
    if (peak > 0)
    {
        for (let i = 0; i < slots; i++)
        {
            const iv = Math.max(0, (values[i] ?? 0) / peak);
            if (iv <= 0.02) { continue; }
            const op  = 0.35 + 0.65 * Math.min(1, iv);   //slot brightness = how hard the device drew
            const cov = Math.max(0, Math.min(1, coverage[i] ?? 0));
            const a0  = hourRad(i / slots, camera.southern);
            const a1  = hourRad((i + 1) / slots, camera.southern);
            const pts: string[] = [];
            for (let k = 0; k <= SEG; k++) { pts.push(pt(rOuter, a0 + (a1 - a0) * k / SEG)); }
            for (let k = SEG; k >= 0; k--) { pts.push(pt(rRail, a0 + (a1 - a0) * k / SEG)); }
            const poly = pts.join(' ');
            //Two layered fills: the gold share (ran on the sun) over the cold-grid share (drawn from the grid).
            s += `<polygon points="${poly}" fill="${DAY_GRID_HEX}" opacity="${(op * (1 - cov)).toFixed(3)}"/>`;
            s += `<polygon points="${poly}" fill="${SUN_COLOR_HEX}" opacity="${(op * cov).toFixed(3)}"/>`;
        }
    }
    return s;
}

//A thin floating cap: the walls + roof of a prism between two heights (back-face culled, depth-sorted), with
//no body below, so a marker placed lower stays visible.
function floatingSlice(camera: SceneCamera, fp: [number, number][], loH: number, hiH: number, wall: string, roof: string, stroke: string): string
{
    const bearing = camera.bearingDeg * Math.PI / 180;
    const lo = fp.map(p => camera.project(p[0], p[1], loH));
    const hi = fp.map(p => camera.project(p[0], p[1], hiH));
    const edges: { d: number; s: string }[] = [];
    for (let i = 0; i < fp.length; i++)
    {
        const next  = (i + 1) % fp.length;
        const edgeE = fp[next][0] - fp[i][0];
        const edgeN = fp[next][1] - fp[i][1];
        if (edgeN * Math.sin(bearing) + edgeE * Math.cos(bearing) <= 0) { continue; }
        edges.push({
            d: (lo[i][1] + lo[next][1]) / 2,
            s: `<polygon points="${lo[i][0].toFixed(1)},${lo[i][1].toFixed(1)} ${lo[next][0].toFixed(1)},${lo[next][1].toFixed(1)} ${hi[next][0].toFixed(1)},${hi[next][1].toFixed(1)} ${hi[i][0].toFixed(1)},${hi[i][1].toFixed(1)}" fill="${wall}" stroke="${stroke}" stroke-width="0.4"/>`,
        });
    }
    edges.sort((x, y) => x.d - y.d);
    const roofPts = hi.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    return edges.map(e => e.s).join('') + `<polygon points="${roofPts}" fill="${roof}" stroke="${stroke}" stroke-width="0.6"/>`;
}

//Project one frame for ALL selected metrics as concentric rings (outer first, nesting inward). Shared here:
//the 24 hour labels, the under-dial guide + compass, the per-ring glow defs, the global back-to-front depth
//sort; per-ring geometry lives in projectHistogramRing. Pure: the card resolves each ring's animation scalars
//(slot/heightScale/opacity) and the focused slot.
export function projectClockFrame(
    camera: SceneCamera,
    rings: ClockRingInput[],
    //Focused slot (hover/tap) + the 0..1 fade ramp. dimSlot persists through the fade-out so it ramps smoothly.
    dimSlot: number | null,
    dim: number,
    //Localised compass letters, supplied by the card.
    cardinals: { n: string; s: string; e: string; w: string },
    //Per-unit ceiling override (eased between filter changes so bars don't snap to a new scale). Units missing
    //from the map fall back to the busiest current ring of that unit.
    unitCeil?: Map<string, number>,
    //Central column hovered/tapped: brighten it + glow (the card then shows the period-total tooltip).
    columnHighlight = false,
    //Per-hour night share for the ground day/night wedges (empty = none drawn).
    nightFrac: number[] = [],
): ClockFrame
{
    const minEdge = Math.min(camera.centreX * 2, camera.centreY * 2) || 1;
    const ppm     = camera.pxPerMetre || 1;
    const outerR  = (RING_R_FRAC * minEdge) / ppm;
    const maxHm   = (MAX_HEIGHT_FRAC * minEdge) / ppm;   //tallest bar, in metres
    const tilt    = camera.tiltDeg;
    const bearing = camera.bearingDeg;

    //Hour labels, laid flat just outside the OUTER ring; each fades with its distance from the camera.
    const labelR = outerR * LABEL_R_MULT;
    const projLabels = Array.from({ length: 24 }, (_, h) =>
        camera.project3(labelR * Math.sin(hourRad(h / HOURS_PER_DAY, camera.southern)), labelR * Math.cos(hourRad(h / HOURS_PER_DAY, camera.southern)), 0));
    let depthMin = Infinity; let depthMax = -Infinity;
    for (const p of projLabels) { depthMin = Math.min(depthMin, p.depth); depthMax = Math.max(depthMax, p.depth); }
    const depthRange = depthMax - depthMin || 1;
    const labels = projLabels.map((p, h) => ({
        x: p.x, y: p.y,
        opacity: LABEL_MIN_OPACITY + (1 - LABEL_MIN_OPACITY) * (p.depth - depthMin) / depthRange,
        transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + hourDeg(h / HOURS_PER_DAY, camera.southern) + 180}deg)`,
    }));

    //Shared per-UNIT ceiling: every ring of the same unit normalises against the busiest among them, so
    //same-unit metrics share one axis; different units keep their own ceiling. The card may pass an eased
    //override (unitCeil); units it omits fall back to the busiest current ring.
    const unitMax = new Map<string, number>();
    for (const ring of rings) { const u = ring.data.unit; unitMax.set(u, Math.max(unitMax.get(u) ?? 0, ringMax(ring.data))); }

    const hits:  ClockHit[]  = [];
    const faces: ClockFace[] = [];
    rings.forEach((ring, ri) =>
    {
        const R = outerR * ringRadiusFrac(ring.slot);
        const ceiling = unitCeil?.get(ring.data.unit) ?? unitMax.get(ring.data.unit) ?? 0;
        projectHistogramRing(camera, R, outerR, ring, ri, maxHm, ceiling, minEdge, ppm, dimSlot, dim, faces, hits);
    });
    //The central column is gone: a flat Helios mark now fills the hub (drawn by the engine on the ground plane,
    //UNDER these bars, so the nearer bars occlude it). The bars alone populate the upright depth pass.
    const hubR = outerR * CLOCK_HUB_R_FRAC;
    faces.sort((a, b) => a.depth - b.depth);

    //One glow filter per ring, tinted to its metric colour, for the focused slice / bar. Bars carry their own
    //highlight, so the guide stays static (no focused spoke).
    let defs = '<defs>';
    rings.forEach((r, i) => { defs += `<filter id="clock-glow-${i}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${r.data.color}" flood-opacity="0.95"/></filter>`; });
    defs += '</defs>';

    const compass = clockCompass(camera, outerR, bearing, tilt, cardinals);
    //Home-hover target: a disc over the flat mark, centred on the projected home. Radius = the mark's on-ground
    //half-width (half its diameter), covering the whole logo the user taps for the window total.
    const decalDiaPx = outerR * ppm;
    const homeCtr    = camera.project(0, 0, 0);
    //Highlighted (hover/tap) mark stacks one glow per active filter, in ring order, behind a thin edging. Top
    //faces the equator (south in the northern hemisphere, north in the southern) so it aligns with the sun run.
    const decal = buildLogoDecal({
        diameterPx: decalDiaPx,
        orientDeg:  camera.southern ? 0 : 180,
        highlight:  columnHighlight,
    });
    const night = nightFrac.length ? nightSectors(camera, hubR, outerR * 2, nightFrac, 0.5) : '';
    return {
        guideSvg: night + clockGuide(camera, outerR) + compass.svg,
        svg: defs + faces.map(f => f.svg).join('') + currentHourArrow(camera, outerR, maxHm, 0),
        hits, labels, compass: compass.labels,
        home: { x: homeCtr[0], y: homeCtr[1], r: decalDiaPx / 2 },
        decal,
    };
}

//24 stacked bars, one per hour, sitting BETWEEN the hour lines (centred at H+0.5, each bar the value over
//H..H+1). The hovered bar glows, others dim. Grow / slide / exit ride on the ring's animation scalars.
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
    const focusHour  = dimSlot === null ? null : Math.floor(dimSlot / CLOCK_SLOTS_PER_HOUR);

    for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        const a = hourRad((h + 0.5) / HOURS_PER_DAY, camera.southern);   //BETWEEN the hour lines
        const e = R * Math.sin(a); const n = R * Math.cos(a);
        const total = totalAt(h);
        const base  = camera.project(e, n, 0);
        const top   = camera.project(e, n, total * zScale);
        //Hit axis tagged with the hour's first slot, so the card maps it back to the hour.
        hits.push({ slot: h * CLOCK_SLOTS_PER_HOUR, bx: base[0], by: base[1], tx: top[0], ty: top[1] });
        const active = h === focusHour;
        const dimOp  = ring.opacity * (focusHour !== null && !active ? 1 - 0.5 * dim : 1);
        if (total <= 0)
        {
            //Empty hour: a flat neutral puck so all 24 stay on the dial.
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

//Which way is "better" for a metric, so the trend dial colours the change green/red. +1 = up is good
//(production), -1 = down is good (consumption, grid use), 0 = neutral (battery, weather, custom).
export function trendGoodDirection(target: ChartTarget): number
{
    switch (target)
    {
        case 'production': return 1;
        case 'consumption':
        case 'grid':       return -1;
        default:           return 0;
    }
}

//Project the TREND dial: one ring of 24 bars for the current period P, each with a reference marker (sphere +
//dashed stem) at the previous period's level P-1, the gap coloured green/red by whether the change is an
//improvement for this metric. `perHourP`/`perHourPrev` are 24 hour-of-day totals; both normalise against the
//taller of the two so the marker always fits. Pure geometry; the card resolves the focused hour + the tooltip.
export function projectTrendFrame(
    camera: SceneCamera,
    perHourP: number[],
    perHourPrev: number[],
    color: string,
    direction: number,
    cardinals: { n: string; s: string; e: string; w: string },
    dimSlot: number | null,
    dim: number,
    //Whether the centre mark is hovered/tapped (drives its opacity fade).
    columnHighlight: boolean,
    //Per-hour night share for the ground day/night wedges (empty = none drawn).
    nightFrac: number[] = [],
): ClockFrame
{
    const minEdge = Math.min(camera.centreX * 2, camera.centreY * 2) || 1;
    const ppm     = camera.pxPerMetre || 1;
    const outerR  = (RING_R_FRAC * minEdge) / ppm;
    const maxHm   = (MAX_HEIGHT_FRAC * minEdge) / ppm;
    const tilt    = camera.tiltDeg;
    const bearing = camera.bearingDeg;

    const labelR = outerR * LABEL_R_MULT;
    const projLabels = Array.from({ length: 24 }, (_, h) =>
        camera.project3(labelR * Math.sin(hourRad(h / HOURS_PER_DAY, camera.southern)), labelR * Math.cos(hourRad(h / HOURS_PER_DAY, camera.southern)), 0));
    let depthMin = Infinity; let depthMax = -Infinity;
    for (const p of projLabels) { depthMin = Math.min(depthMin, p.depth); depthMax = Math.max(depthMax, p.depth); }
    const depthRange = depthMax - depthMin || 1;
    const labels = projLabels.map((p, h) => ({
        x: p.x, y: p.y,
        opacity: LABEL_MIN_OPACITY + (1 - LABEL_MIN_OPACITY) * (p.depth - depthMin) / depthRange,
        transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + hourDeg(h / HOURS_PER_DAY, camera.southern) + 180}deg)`,
    }));

    let ceiling = 0;
    for (let h = 0; h < HOURS_PER_DAY; h++) { ceiling = Math.max(ceiling, perHourP[h], perHourPrev[h]); }
    const zScale     = ceiling > 0 ? maxHm / ceiling : 0;
    const R          = outerR;   //single outer ring
    const halfRadial = ringSpacingM(outerR) * BAR_RADIAL_FRAC;
    const halfTan    = (BAR_TANGENT_FRAC * minEdge) / ppm;
    const focusHour  = dimSlot === null ? null : Math.floor(dimSlot / CLOCK_SLOTS_PER_HOUR);
    const good = 'var(--success-color, #2e7d32)';
    const bad  = 'var(--error-color, #c62828)';

    const hits:  ClockHit[]  = [];
    //Depth fade: bars far from the camera dim toward FADE_MIN so the foreground stays readable (gentle, so the
    //back of the dial stays legible).
    const FADE_MIN = 0.6;
    const depths = Array.from({ length: 24 }, (_u, h) =>
    {
        const a = hourRad((h + 0.5) / HOURS_PER_DAY, camera.southern);
        return camera.project3(R * Math.sin(a), R * Math.cos(a), 0).depth;
    });
    let dMin = Infinity; let dMax = -Infinity;
    for (const d of depths) { dMin = Math.min(dMin, d); dMax = Math.max(dMax, d); }
    const dRange = dMax - dMin || 1;

    const faces: ClockFace[] = [];
    for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        const a = hourRad((h + 0.5) / HOURS_PER_DAY, camera.southern);
        const e = R * Math.sin(a); const n = R * Math.cos(a);
        const p = Math.max(0, perHourP[h]); const prev = Math.max(0, perHourPrev[h]);
        const pH = p * zScale; const prevH = prev * zScale;
        const fp = foot(e, n, halfRadial, halfTan, a);
        const base = camera.project(e, n, 0);
        //Hit axis spans up to the taller of the two, so a floating P-1 collar is hoverable too.
        const topH = camera.project(e, n, Math.max(pH, prevH));
        hits.push({ slot: h * CLOCK_SLOTS_PER_HOUR, bx: base[0], by: base[1], tx: topH[0], ty: topH[1] });
        const active = h === focusHour;
        const dimOp  = focusHour !== null && !active ? 1 - 0.5 * dim : 1;
        const fade   = FADE_MIN + (1 - FADE_MIN) * (depths[h] - dMin) / dRange;
        const op     = dimOp * fade;

        //Solid bar = the current period P; a sphere marker on a dashed stem sits at the previous period P-1,
        //coloured green/red by whether the change is an improvement for this metric.
        let svg = '';
        if (pH > 0)
        {
            //Only the TOP slice of the bar (a thin slab, not the full column), so the P-1 marker below it stays
            //visible. CAP is a small slab thickness; clamped so a tiny bar doesn't dip below the ground.
            const cap = maxHm * 0.07;
            svg += floatingSlice(camera, fp, Math.max(0, pH - cap), pH,
                lerpHexToward(color, '#000000', 0.25), lerpHexToward(color, '#ffffff', active ? 0.4 : 0.12),
                active ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.3)');
        }
        if (ceiling > 0)
        {
            const impr    = (p - prev) * direction;
            const markCol = direction === 0 ? 'var(--primary-text-color, #212121)' : (impr >= 0 ? good : bad);
            const top = camera.project(e, n, pH);
            const mk  = camera.project(e, n, prevH);
            svg += `<line x1="${top[0].toFixed(1)}" y1="${top[1].toFixed(1)}" x2="${mk[0].toFixed(1)}" y2="${mk[1].toFixed(1)}" stroke="${markCol}" stroke-width="1.5" stroke-dasharray="2 2"/>`;
            svg += `<circle cx="${mk[0].toFixed(1)}" cy="${mk[1].toFixed(1)}" r="3.4" fill="${markCol}" stroke="rgba(255,255,255,0.85)" stroke-width="0.8"/>`;
        }
        if (op < 1) { svg = `<g opacity="${op.toFixed(3)}">${svg}</g>`; }
        faces.push({ depth: base[1], svg });
    }
    //No central gauge: the flat Helios mark fills the hub (the ground logo can't float, and the hover total does
    //the readout job the old lollipop did). Just the bars populate the upright pass.
    const hubR = outerR * CLOCK_HUB_R_FRAC;
    faces.sort((a, b) => a.depth - b.depth);

    const compass = clockCompass(camera, outerR, bearing, tilt, cardinals);
    //Home-hover target + decal, same flat Helios mark as the clock dial. Centred on the projected home; radius =
    //half its on-ground diameter so the whole mark is the hover/tap target for the period total.
    const decalDiaPx = outerR * ppm;
    const homeCtr    = camera.project(0, 0, 0);
    const decal = buildLogoDecal({
        diameterPx: decalDiaPx,
        orientDeg:  camera.southern ? 0 : 180,
        highlight:  columnHighlight,
    });
    const night = nightFrac.length ? nightSectors(camera, hubR, outerR * 2, nightFrac, 0.5) : '';
    return {
        guideSvg: night + clockGuide(camera, outerR) + compass.svg,
        svg: faces.map(f => f.svg).join('') + currentHourArrow(camera, outerR, maxHm, Math.max(0, perHourP[serverHour(Date.now())]) * zScale),
        hits, labels, compass: compass.labels,
        home: { x: homeCtr[0], y: homeCtr[1], r: decalDiaPx / 2 },
        decal,
    };
}


//Project the DAY ring: a flat 24-hour ground annulus for today. Each hour's cell is split gold (solar share) then
//import-colour (grid share), so both where the sun covered you and where you drew from the grid read at a glance.
//No bars: the story is the colour, not the height. Reuses the clock's labels, guide, compass, now-arrow and decal.
//One device's ring for the day dial: its dashboard colour, per-slot energy (the radial magnitude) and the slot
//segments it ran.
export interface DayDeviceRing
{
    color:    string;
    values:   number[];
    segments: { start: number; end: number }[];
    //Day total (kWh): the ring's WIDTH scales with this device's share of the monitored consumption.
    dailyKwh: number;
}

//Screen-space hover target for one device ring: on the band = inside the outer circle AND outside the inner one.
export interface DayRingHit
{
    outer: [number, number][];
    inner: [number, number][];
}

export function projectDayRingFrame(
    camera: SceneCamera,
    solar: number[],
    battery: number[],
    grid: number[],
    importColor: string,
    batteryColor: string,
    rings: DayDeviceRing[],
    _cardinals: { n: string; s: string; e: string; w: string },
    //Index of the hovered device ring (-1 = none): it gets a small glow in its own colour.
    hoverIndex = -1,
    //Each source ring is drawn only when that source is configured on the dashboard.
    hasSolar = true,
    hasGrid = true,
    hasBattery = true,
): ClockFrame
{
    const minEdge = Math.min(camera.centreX * 2, camera.centreY * 2) || 1;
    const ppm     = camera.pxPerMetre || 1;
    //Day mode zooms the dial in (bigger fraction than the scene ring); the hour labels still fit the frame.
    const outerR  = (DAY_RING_R_FRAC * minEdge) / ppm;
    const hubR    = outerR * CLOCK_HUB_R_FRAC;
    //The ground hour-disc edge (where the guide spokes end). The rings sit flush to it, no wasted gap outside.
    const discR   = outerR * CLOCK_SPOKE_OUTER_FRAC;
    const tilt    = camera.tiltDeg;
    const bearing = camera.bearingDeg;

    const labelR = outerR * LABEL_R_MULT;
    const projLabels = Array.from({ length: 24 }, (_, h) =>
        camera.project3(labelR * Math.sin(hourRad(h / HOURS_PER_DAY, camera.southern)), labelR * Math.cos(hourRad(h / HOURS_PER_DAY, camera.southern)), 0));
    //Top-down view: every hour label is equally near the camera, so no distance fade (full opacity throughout).
    //Labels on the upper half of the dial (above the east-west axis) would sit upside-down with the radial
    //orientation, so they get an extra 180deg to read right-side-up.
    const labels = projLabels.map((p, h) => ({
        x: p.x, y: p.y,
        opacity: 1,
        transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + hourDeg(h / HOURS_PER_DAY, camera.southern) + 180 + (p.y < camera.centreY ? 180 : 0)}deg)`,
    }));

    const homeCtr = camera.project(0, 0, 0);
    //No central logo in day mode: the rings fill the whole face down to the hub circle.
    const decal   = { svg: '', active: false };

    const slots = Math.max(1, solar.length);
    //Source share (0..1) -> opacity for the production block: a floor so even a small share still reads.
    const FLOOR = 0.4;
    const opFor = (v: number): number => (v > 0.02 ? FLOOR + (1 - FLOOR) * Math.min(1, v) : 0);
    //Self-sufficiency share per slot (solar + battery): how much of that hour's home load ran on your own energy.
    //It is what recolours every device ring gold-vs-grid.
    const coverage = solar.map((sv, s) => Math.max(0, Math.min(1, (sv ?? 0) + (battery[s] ?? 0))));
    //Configured sources only, outermost-first (solar, grid, battery). They are MERGED into a single production ring:
    //stuck-together sub-bands with no gap or edge between them, one outline around the whole block.
    const sources: { color: string; ops: number[] }[] = [];
    if (hasSolar)   { sources.push({ color: SUN_COLOR_HEX, ops: solar.map(opFor) }); }
    if (hasGrid)    { sources.push({ color: importColor,   ops: grid.map(opFor) }); }
    if (hasBattery) { sources.push({ color: batteryColor,  ops: battery.map(opFor) }); }

    //Radial budget from the hub out to the hour-disc edge: the merged production block is exactly as wide as the
    //number of sources it holds (N ring-widths); the rest is the consumption zone, one equal-width ring per device.
    const prodUnit = sources.length;
    const nDev     = rings.length;
    const band     = (discR - hubR) / Math.max(1, prodUnit + nDev);
    const gap      = band * 0.4;    //padding between consumption rings
    const groupGap = band * 0.5;    //separation between the production block and the first consumption ring

    const circle = (r: number): [number, number][] =>
    {
        const c: [number, number][] = [];
        for (let k = 0; k < 48; k++) { c.push(camera.project(r * Math.sin(hourRad(k / 48, camera.southern)), r * Math.cos(hourRad(k / 48, camera.southern)), 0)); }
        return c;
    };
    let ringSvg = '';
    const dayHits: DayRingHit[] = [];

    //Merged production block at the rim (flush to discR): glued sub-bands (each one ring-width, no gap/edge
    //between), one outer outline in the outermost source's colour and one inner outline in the innermost source's.
    const prodInner = discR - prodUnit * band;
    if (prodUnit > 0)
    {
        sources.forEach((sc, i) => { ringSvg += dayOpacityBand(camera, discR - (i + 1) * band, discR - i * band, sc.color, sc.ops, slots); });
        ringSvg += dayEdge(camera, discR, sources[0].color, slots);
        ringSvg += dayEdge(camera, prodInner, sources[sources.length - 1].color, slots);
    }

    //Consumption rings fill [hub, prodInner - groupGap]: one equal-width ring per device, `gap` carved between.
    const zoneTop = prodInner - (prodUnit > 0 && nDev > 0 ? groupGap : 0);
    const dband   = (zoneTop - hubR) / Math.max(1, nDev);
    rings.forEach((rg, k) =>
    {
        const rOuter = zoneTop - k * dband - (k === 0 ? 0 : gap / 2);
        const rInner = k === nDev - 1 ? hubR : zoneTop - (k + 1) * dband + gap / 2;
        let one = dayDeviceRing(camera, rInner, rOuter, rg.color, rg.values, coverage, slots);
        if (k === hoverIndex) { one = `<g style="filter:drop-shadow(0 0 4px ${rg.color})">${one}</g>`; }
        ringSvg += one;
        //Hit order matches the rings array, i.e. host._dayRing.devices.
        dayHits.push({ outer: circle(rOuter), inner: circle(rInner) });
    });

    return {
        //No compass in day mode (cardinals hidden): the rings + the under-dial hub guide.
        guideSvg: clockGuide(camera, outerR),
        svg: ringSvg,
        hits: [], labels, compass: [],
        home: { x: homeCtr[0], y: homeCtr[1], r: hubR * ppm },
        decal,
        dayHits,
    };
}


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


//Read one layer aggregated over the hour the focused slot falls in: the hour's TOTAL (`sum`, energy) or
//AVERAGE (power/percent/irradiance), matching the histogram bar.
export function hourlyAt(values: number[], hour: number, sum: boolean): number
{
    const sph = CLOCK_SLOTS_PER_HOUR;
    let s = 0;
    for (let j = 0; j < sph; j++) { s += Math.max(0, values[hour * sph + j] ?? 0); }
    return sum ? s : s / sph;
}
export function clockLayerValue(layer: ClockLayer, data: ClockData, slot: number): number
{
    return hourlyAt(layer.values, Math.floor(slot / CLOCK_SLOTS_PER_HOUR), data.unit === 'energy');
}

//A metric's total magnitude at the focused position (sum of its layers), for the per-filter tooltip rows.
export function clockTotal(data: ClockData, slot: number): number
{
    return data.layers.reduce((s, L) => s + clockLayerValue(L, data, slot), 0);
}

//One layer's aggregate over the whole window, for the home-hover total: energy SUMS the 24 hourly kWh totals
//(the window's energy), other units AVERAGE them (a representative percent/irradiance/power over the window).
export function clockLayerPeriod(layer: ClockLayer, data: ClockData): number
{
    const energy = data.unit === 'energy';
    const hv = hourlyOf(layer.values, energy);
    let t = 0; for (let h = 0; h < HOURS_PER_DAY; h++) { t += Math.max(0, hv[h]); }
    return energy ? t : t / HOURS_PER_DAY;
}

//A metric's window aggregate across all its layers (the grand total a single-layer metric shows).
export function clockPeriodTotal(data: ClockData): number
{
    return data.layers.reduce((s, L) => s + clockLayerPeriod(L, data), 0);
}


//Format a band/total magnitude for the tooltip, per the metric's unit. kW/kWh honour the user's decimals
//setting; %/irradiance read as integers. 'energy' values are already kWh.
export function formatClockValue(host: ClockHost, data: ClockData, v: number): string
{
    if (data.unit === 'percent')    { return `${Math.round(Math.max(0, v))} %`; }
    const dec = valueDecimals(host.config);
    if (data.unit === 'irradiance') { return formatIrradiance(host.hass, v, dec, irradianceUnit(host.config)); }
    if (data.unit === 'energy')     { return formatEnergyKwh(host.hass, v, dec, powerUnit(host.config)); }
    return formatPower(host.hass, v, dec, powerUnit(host.config));
}
