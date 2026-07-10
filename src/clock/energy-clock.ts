//Energy-clock mode: a ring of 24 hourly cylinders on the ground plane, one per hour, showing whichever
//metric the rail selects (production split per source, grid into import/export, battery into
//charge/discharge, etc.). Each hour aggregates the metric over the whole rolling window (a single day shows
//that day's shape; a longer range averages it). Data comes from the store + histories already loaded, binned
//by hour-of-day, no extra fetch.

import type { SceneCamera } from '../scene/projection';
import { HOUR_MS, HOURS_PER_DAY } from '../core/config/constants';
import { type ChartTarget, type ChartHost, clockTargetLabel, solarSourceName,
    gridImportName, gridExportName, batteryChargeName, batteryDischargeName,
    isGroupTarget, groupOfTarget, groupTarget } from '../charts/charts';
import { changeSeriesToWatts } from '../data/sources/energy-stats';
import { activeGroups, groupDevices, deviceName, deviceIcon } from '../data/sources/device-consumption';
import { consumptionLoad } from '../core/energy';
import { ENERGY_COLOR, energySolarColor, lerpHexToward, formatPower, formatIrradiance, formatEnergyKwh, deviceColorByIndex } from '../core/format/format';
import type { UnifiedDataStore } from '../data/unifiedStore';
import { valueDecimals, powerUnit, irradianceUnit, monitoringGroupColor, monitoringGroupIcon, GROUP_COUNT } from '../core/config/helios-config';
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
const DAY_BAND_COLOR  = 'var(--card-background-color, #000000)';   //group zone background + centre disc (theme-linked)
const RING_INNER_MIN_FRAC = 0.4;//innermost ring radius as a fraction of the outer one
//How far a PINNED slice fades the OTHER hour bars (1 = fully transparent at full ramp). Only pin dims; hover doesn't.
const CLOCK_DIM_STRENGTH  = 0.78;
//Fixed slot count: rings always sit at their slot radius, so adding/removing a filter never re-spaces the others.
//Sized to the maximum number of filters availableClockTargets can ever return (6 base metrics: production,
//consumption, battery-soc, battery, grid, irradiance + one per monitoring group), so the innermost ring never
//clamps onto its neighbour when everything is enabled.
const CLOCK_MAX_FILTERS = 6 + GROUP_COUNT;
const MAX_HEIGHT_FRAC = 0.30;   //tallest bar
//Bar tangential half-width (scaled per ring) and radial half-depth (fraction of slot spacing so consecutive
//rings' bars sit flush).
const BAR_TANGENT_FRAC = 0.018;
const BAR_RADIAL_FRAC  = 0.45;
const LABEL_R_MULT    = 1.18;   //hour labels sit just outside the ring
const LABEL_MIN_OPACITY = 0.15; //farthest-back hour label opacity (nearest is opaque)
//Clock-face guide: faint centre ring + 24 spokes reaching toward (but stopping short of) the hour labels.
const CLOCK_HUB_R_FRAC      = 0.12;
//Helios hub mark diameter as a fraction of the outer-ring disc: shrunk so the logo doesn't crowd the inner ring.
//Only the drawn decal scales; the central home tap/hover disc keeps the full radius.
const LOGO_DECAL_SCALE      = 0.8;
const CLOCK_SPOKE_OUTER_FRAC = 1.10;
const CLOCK_GUIDE_OPACITY   = 0.25;
//Consumption-ring (day mode) geometry, independent of the histogram so the two dials can differ. Outer edge of
//the ring stack + hour-label radius pushed out vs the histogram; the rings hug the rim so the middle stays free
//for a big centre disc (the hovered ring's icon paints there). Tunable.
const DAY_RING_OUTER_MULT   = 1.22;   //ring-stack outer edge as a multiple of outerR (histogram uses 1.10)
const DAY_RING_LABEL_MULT   = 1.32;   //hour labels sit just outside the (bigger) ring
//Uniform shrink of the whole day dial (rings, disc, hour labels all derive from outerR), so its wider
//1.32x label ring clears the card edge in small layouts. Preserves every internal ratio/padding above.
const DAY_RING_SCALE        = 0.82;
const DAY_RIBBON_GAUGE_FRAC = 0.82;   //member ribbon width as a fraction of its sub-band
//The centre disc is a FIXED size and the producer rings a FIXED width; the consumer rings share whatever radial
//space is left between them, so a group of 12 devices just draws thinner rings (never a ballooning centre).
const DAY_ZONE_PAD_FRAC     = 0.10;   //uniform padding between zones + before the centre disc
const DAY_CENTER_DISC_FRAC  = 0.30;   //FIXED centre disc radius (fraction of outerR)
const DAY_PRODUCER_W_FRAC   = 0.10;   //FIXED width of each producer ring (fraction of outerR)
//2 px primary-text-colour outline on the CENTRE disc only (the zone donuts stay unedged).
const DAY_CENTER_EDGE_PX    = 1;
//Multi-colour glow rimming the PRODUCTION zone's inner + outer circles (built from its producer colours), marking
//it as the fixed reference zone.
const DAY_PROD_GLOW_WIDTH   = 2;
const DAY_PROD_GLOW_BLUR    = 3.5;
const DAY_PROD_GLOW_OPACITY = 0.5;
//Midnight tick: a short radial line across the ring at 00h, marking the day's start. FIXED half-length (never
//scales with the ring width), so every ring shows the same small marker regardless of how wide it is.
const DAY_TICK_WIDTH_PX     = 2;
const DAY_TICK_HALF_PX      = 8;
//Peak-hour marker (consumers): a radial line, in the ring colour, at the ring's busiest slot, with a
//primary-text-colour edging (drawn as a slightly wider line behind it). FIXED length, like the midnight tick.
const DAY_PEAK_WIDTH_PX     = 3;
const DAY_PEAK_EDGE_PX      = 1;
const DAY_PEAK_HALF_PX      = 8;
const DAY_PEAK_OPACITY      = 1;
//Not-yet-lived part of today's ring: a faint hairline instead of the full ribbon, signalling "no data here yet".
const DAY_FUTURE_WIDTH_PX   = 1.5;
const DAY_FUTURE_OPACITY    = 0.18;
//Edge-light on the hovered / selected ring (like the histogram's focused bar): a bright outline on the ribbon.
const DAY_EDGE_STROKE       = 'rgba(255,255,255,0.46)';
const DAY_EDGE_WIDTH_PX     = 1;
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
    //Day mode only: the consumer rings, in a SEPARATE layer from `svg` (the producers), so the drill flip can
    //transform the consumers without moving the static producer rings.
    dayConsumerSvg?: string;
    //Day mode only: the centre disc, in its OWN layer so it can counter-flip against the consumer rings.
    dayCenterSvg?: string;
    //Day mode only: one screen-space hover target per device ring (aligned with the device list). Undefined for
    //the clock dial.
    dayHits?: DayRingHit[];
    //Day mode only: where the centre-disc icon anchors. Midway from the disc centre to its topmost screen point,
    //so the icon sits in the disc's upper half (room for content below).
    centerAnchor?: { x: number; y: number };
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
    //Monitoring groups: one button per active group (>= 1 visible device).
    for (const g of activeGroups(host.config, host._energyDefaults)) { out.push(groupTarget(g)); }
    return out;
}

//Rail button appearance per metric: a glyph + the metric's colour (idle icon tint + active fill).
export function clockTargetMeta(host: ClockHost, target: ChartTarget): { icon?: string; num?: string; color: string }
{
    const el = host as unknown as Element;
    if (isGroupTarget(target))
    {
        const g     = groupOfTarget(target);
        const icon  = monitoringGroupIcon(host.config, g);
        const color = monitoringGroupColor(host.config, g);
        //Groups fall back to their number glyph when no custom icon is set (mirrors the scene chip and editor pastille).
        return icon ? { icon, color } : { num: String(g), color };
    }
    switch (target)
    {
        case 'consumption': return { icon: 'mdi:home-lightning-bolt', color: ENERGY_COLOR.consumption(el) };
        case 'grid':        return { icon: 'mdi:transmission-tower',   color: ENERGY_COLOR.gridImport(el) };
        case 'battery':     return { icon: 'mdi:battery-charging',     color: ENERGY_COLOR.batteryOut(el) };
        case 'battery-soc': return { icon: 'mdi:battery',              color: ENERGY_COLOR.batteryOut(el) };
        case 'irradiance':  return { icon: 'mdi:white-balance-sunny',  color: ENERGY_COLOR.sun(el) };
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
    //Energy metrics expand their hour TOTALS (split across slots); soc holds its hourly average.
    const oneE = (color: string, icon: string, label: string, v: number[]): ClockLayer => ({ color, icon, label, values: expandHourly(v, true) });
    const oneA = (color: string, icon: string, label: string, v: number[]): ClockLayer => ({ color, icon, label, values: expandHourly(v, false) });
    const tgtLabel = clockTargetLabel(host, target);
    if (isGroupTarget(target))
    {
        //One layer per visible device of the group, from its hour-of-day totals in the profile.
        const devs = groupDevices(host.config, host._energyDefaults, groupOfTarget(target));
        return data('energy', devs.map(dev =>
            oneE(deviceColorByIndex(el, dev.index), deviceIcon(host.hass, dev), deviceName(host.hass, dev),
                h.devices[dev.statConsumption] ?? new Array<number>(HOURS_PER_DAY).fill(0))));
    }
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
    else if (isGroupTarget(target))
    {
        //One layer per visible device of the group: its `change` series as watts on the store grid (magnitude),
        //so each hour's bar subdivides into per-device pieces in their dashboard colours.
        const nowMs = Date.now();
        specs = groupDevices(host.config, host._energyDefaults, groupOfTarget(target)).map(dev => ({
            series: changeSeriesToWatts(host._deviceChangeSeries.get(dev.statConsumption) ?? null, store.storeStartMs, store.stepMs, store.bucketsTotal, nowMs)
                .map(v => (v === null ? null : Math.abs(v))),
            color: deviceColorByIndex(el, dev.index),
            icon:  deviceIcon(host.hass, dev),
            label: deviceName(host.hass, dev),
        }));
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
            walls += `<polygon points="${lo[i][0].toFixed(1)},${lo[i][1].toFixed(1)} ${lo[next][0].toFixed(1)},${lo[next][1].toFixed(1)} ${hi[next][0].toFixed(1)},${hi[next][1].toFixed(1)} ${hi[i][0].toFixed(1)},${hi[i][1].toFixed(1)}" fill="${bands[k].wall}" stroke="${stroke}" stroke-width="1.4"/>`;
        }
        edges.push({ depth: (levels[0][i][1] + levels[0][next][1]) / 2, faces: walls });
    }
    edges.sort((a, b) => a.depth - b.depth);
    let svg = edges.map(e => e.faces).join('');
    const roof = levels[levels.length - 1].map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    svg += `<polygon points="${roof}" fill="${bands[bands.length - 1].roof}" stroke="${stroke}" stroke-width="1.6"/>`;
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

//Project the ground point at day-fraction `f` on a ring of radius `rm` (metres) to screen px.
function dayPt(camera: SceneCamera, rm: number, f: number): [number, number]
{
    const a = hourRad(f, camera.southern);
    return camera.project(rm * Math.sin(a), rm * Math.cos(a), 0);
}

//A full DONUT (annulus) on the ground: outer + inner sampled circles as one even-odd path, so the centre is a hole.
//Backgrounds are plain donuts (no start/end -> no overlapping midnight caps); only the value arcs have caps. With
//`edgeWidth` > 0, both circles get a primary-text-colour outline (used for the centre disc).
function dayDonut(camera: SceneCamera, outerRm: number, innerRm: number, fill: string, opacity: number, edgeWidth = 0): string
{
    const STEPS = 120;
    const ring = (rm: number): string =>
    {
        let d = '';
        for (let k = 0; k < STEPS; k++) { const a = 2 * Math.PI * k / STEPS; const p = camera.project(rm * Math.sin(a), rm * Math.cos(a), 0); d += `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; }
        return d + 'Z';
    };
    //Fill (and the edge stroke) via `style` so CSS vars resolve; a plain `fill=`/`stroke=` attribute would not.
    //The edge uses Home Assistant's standard card border (colour + width) so the centre disc reads like a mini card.
    const edgeStyle = edgeWidth > 0 ? `;stroke:var(--ha-card-border-color, var(--divider-color, rgba(0, 0, 0, 0.12)));stroke-width:${edgeWidth};stroke-opacity:${opacity}` : '';
    return `<path d="${ring(outerRm)}${ring(innerRm)}" style="fill:${fill};fill-opacity:${opacity}${edgeStyle}" fill-rule="evenodd"/>`;
}

//Multi-colour glow rimming a zone's inner + outer circles: a diagonal gradient blended across the zone's member
//colours, softly blurred. Used on the fixed PRODUCTION zone so it reads as the anchor at a glance.
function dayZoneGlow(camera: SceneCamera, outerRm: number, innerRm: number, colors: string[], opacity: number): string
{
    if (colors.length === 0 || opacity <= 0) { return ''; }
    const STEPS = 96;
    const circle = (rm: number): string =>
    {
        let d = '';
        for (let k = 0; k < STEPS; k++) { const a = 2 * Math.PI * k / STEPS; const p = camera.project(rm * Math.sin(a), rm * Math.cos(a), 0); d += `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; }
        return d + 'Z';
    };
    const stops = colors.map((c, i) => `<stop offset="${colors.length === 1 ? '0' : (i / (colors.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('');
    const stroke = `fill="none" stroke="url(#prod-glow-grad)" stroke-width="${DAY_PROD_GLOW_WIDTH}"`;
    return `<defs>`
        + `<linearGradient id="prod-glow-grad" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`
        + `<filter id="prod-glow-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${DAY_PROD_GLOW_BLUR}"/></filter>`
        + `</defs>`
        + `<g filter="url(#prod-glow-blur)" opacity="${opacity.toFixed(3)}">`
        + `<path d="${circle(outerRm)}" ${stroke}/><path d="${circle(innerRm)}" ${stroke}/>`
        + `</g>`;
}

//A member ring drawn as a variable-WIDTH filled ribbon: each slot's radial half-thickness follows its intensity `t`
//in [0, 1] (a consumer's average power against the historical peak; a producer's share of the slot's load). An idle
//slot is a MIN_RIBBON_PX hairline; a slot at 1 fills the full `gaugeW`, so a heavy load reads visibly thicker than a
//light one. Filled (not stroked), so the width is exact and it never draws the wide-stroke self-overlap dots
//WebKit/Chrome render on polylines. Width is linearly interpolated between slot centres, so the band swells and
//narrows smoothly rather than stepping. Each end (either side of the midnight gap) is anchored with a full-width disc
//so start and end always read however thin the ribbon is there, with a band-colour hole punched in its centre.
const MIN_RIBBON_PX = 2;
//A variable-width arc from f0 to f1 (constant width when `flat` is set), used for both the solid value ribbon and
//the faint future track.
function dayRibbonArc(camera: SceneCamera, rm: number, f0: number, f1: number, wPx: (s: number) => number, slots: number, steps: number): string
{
    const ppm = camera.pxPerMetre || 1;
    const outer: string[] = [];
    const inner: string[] = [];
    for (let k = 0; k <= steps; k++)
    {
        const f     = f0 + (f1 - f0) * (k / steps);
        const slotF = Math.min(slots - 1e-6, Math.max(0, f * slots));
        const s0    = Math.floor(slotF);
        const s1    = Math.min(slots - 1, s0 + 1);
        const halfM = ((wPx(s0) + (wPx(s1) - wPx(s0)) * (slotF - s0)) / 2) / ppm;
        const po    = dayPt(camera, rm + halfM, f);
        const pi    = dayPt(camera, rm - halfM, f);
        outer.push(`${k ? 'L' : 'M'}${po[0].toFixed(2)},${po[1].toFixed(2)}`);
        inner.push(`L${pi[0].toFixed(2)},${pi[1].toFixed(2)}`);
    }
    inner.reverse();
    return `${outer.join('')}${inner.join('')}Z`;
}
//Midnight tick: a short radial line at 00h, marking the day's start. FIXED length (independent of the ring width,
//so a wide single-device ring shows the same small marker, not a giant bar). Drawn on top of the ribbon.
function dayStartTick(camera: SceneCamera, rm: number, color: string, opacity: number): string
{
    const halfM = DAY_TICK_HALF_PX / (camera.pxPerMetre || 1);
    const po = dayPt(camera, rm + halfM, 0);
    const pi = dayPt(camera, rm - halfM, 0);
    return `<line x1="${po[0].toFixed(2)}" y1="${po[1].toFixed(2)}" x2="${pi[0].toFixed(2)}" y2="${pi[1].toFixed(2)}" stroke="${color}" stroke-opacity="${opacity.toFixed(3)}" stroke-width="${DAY_TICK_WIDTH_PX}" stroke-linecap="round"/>`;
}
function dayRibbon(camera: SceneCamera, rm: number, gaugeW: number, color: string, t: number[], slots: number, dim: number, edge = false, fade = 1, sweep = 1, liveFrac = 1): string
{
    const wPx = (s: number): number => MIN_RIBBON_PX + (gaugeW - MIN_RIBBON_PX) * Math.min(1, Math.max(0, t[s] ?? 0));
    const fLive  = Math.min(1, Math.max(0, liveFrac));               //lived edge (today = now; a full day = 1)
    //Ring starts at 00h (f=0). Entry sweep fills the LIVED part (0..fLive); over a complete day it closes the full
    //circle back to 00h. The future track (fLive..1) is static + faint.
    const fSolid = fLive * Math.min(1, Math.max(0, sweep));
    const STEPS  = Math.max(slots * 2, 120);   //dense enough that the circle stays smooth at any slot count
    //Edge-light: a bright outline round the solid ribbon (the hovered / selected ring only).
    const stroke = edge ? ` stroke="${DAY_EDGE_STROKE}" stroke-width="${DAY_EDGE_WIDTH_PX}"` : '';
    let svg = '';
    //1. Not-yet-lived part (today): a faint constant hairline round to 00h, signalling "no data here yet". Bottom.
    if (1 - fLive > 1e-4)
    {
        svg += `<path d="${dayRibbonArc(camera, rm, fLive, 1, () => DAY_FUTURE_WIDTH_PX, slots, STEPS)}" fill="${color}" fill-opacity="${(DAY_FUTURE_OPACITY * dim * fade).toFixed(3)}"/>`;
    }
    //2. Solid value ribbon over the lived part.
    if (fSolid > 1e-4)
    {
        svg += `<path d="${dayRibbonArc(camera, rm, 0, fSolid, wPx, slots, STEPS)}" fill="${color}" fill-opacity="${(0.9 * dim).toFixed(3)}"${stroke}/>`;
    }
    //3. Midnight tick on top, so 00h always reads however thin the ribbon is there.
    svg += dayStartTick(camera, rm, color, dim * fade);
    return svg;
}

//Peak marker: a light radial line, in the ring's colour, at the hour a ring's consumption peaks. Spans the ring's
//width so it reads as "this group / device peaked here".
function dayPeakMarker(camera: SceneCamera, rm: number, color: string, peakFrac: number, opacity: number): string
{
    const halfM = DAY_PEAK_HALF_PX / (camera.pxPerMetre || 1);   //fixed length, independent of the ring width
    const po = dayPt(camera, rm + halfM, peakFrac);
    const pi = dayPt(camera, rm - halfM, peakFrac);
    const coords = `x1="${po[0].toFixed(2)}" y1="${po[1].toFixed(2)}" x2="${pi[0].toFixed(2)}" y2="${pi[1].toFixed(2)}"`;
    const line = (w: number, stroke: string): string => `<line ${coords} stroke="${stroke}" stroke-opacity="${opacity.toFixed(3)}" stroke-width="${w}" stroke-linecap="round"/>`;
    //Wider primary-text edging behind, then the ring-colour line on top.
    return line(DAY_PEAK_WIDTH_PX + 2 * DAY_PEAK_EDGE_PX, 'var(--primary-text-color, #e0e0e0)') + line(DAY_PEAK_WIDTH_PX, color);
}

//A whole GROUP (all producers, or all consumers) as ONE zone: a single black band (rounded-rectangle ends, a
//constant-width midnight slot) spanning the group, with each member drawn inside at its own sub-radius. One zone per
//group + a clear separation reads as "producers" vs "consumers", without the striped look of many stuck-together
//ring backgrounds. Hits are returned in member order (for the tooltip hit-test). `dimOf(i)` is the opacity
//multiplier for member i (1 = normal; <1 fades a ring during hover). `outerRm`/`thickM` are the group band's outer
//radius + thickness. Each member carries its per-slot intensity `t` in [0, 1], drawn as a variable-width ribbon.
function dayRunGroup(camera: SceneCamera, outerRm: number, thickM: number, members: { color: string; t: number[] }[], slots: number, dimOf: (i: number) => number, edgeOf: (i: number) => boolean, fade = 1, sweep = 1, liveFrac = 1, peaks = false): { svg: string; hits: DayRingHit[] }
{
    const ppm    = camera.pxPerMetre || 1;
    const n      = Math.max(1, members.length);
    const sub    = thickM / n;
    const gaugeW = Math.max(1, sub * ppm * DAY_RIBBON_GAUGE_FRAC);   //member ring width (small gap between rings)
    const circle = (r: number): [number, number][] => Array.from({ length: 48 }, (_, k) => dayPt(camera, r, k / 48));
    //The zone donut hugs the member rings with just a small breathing margin (no big border outside/inside).
    const halfW  = (gaugeW / ppm) / 2;
    const margin = sub * 0.14;
    //The zone donut fades in with the entry animation (empty band first); its inner + outer circles are edged.
    let svg = dayDonut(camera, outerRm - 0.5 * sub + halfW + margin, outerRm - (n - 0.5) * sub - halfW - margin, DAY_BAND_COLOR, fade);
    const hits: DayRingHit[] = [];
    members.forEach((m, i) =>
    {
        const mMid = outerRm - (i + 0.5) * sub;
        svg += dayRibbon(camera, mMid, gaugeW, m.color, m.t, slots, dimOf(i), edgeOf(i), fade, sweep, liveFrac);
        //Peak-hour marker (consumers only): a radial line, in the ring's colour, at the ring's busiest slot. It
        //appears only at the very END of the entry sweep (fades in over its last tenth), not during the fill.
        if (peaks)
        {
            const appear = Math.min(1, Math.max(0, (sweep - 0.9) / 0.1));
            if (appear > 0)
            {
                let pk = 0; let pv = 0;
                for (let s = 0; s < m.t.length; s++) { if (m.t[s] > pv) { pv = m.t[s]; pk = s; } }
                if (pv > 0) { svg += dayPeakMarker(camera, mMid, m.color, (pk + 0.5) / slots, DAY_PEAK_OPACITY * dimOf(i) * appear); }
            }
        }
        hits.push({ outer: circle(outerRm - i * sub), inner: circle(outerRm - (i + 1) * sub) });
    });
    return { svg, hits };
}

//Project one frame for ALL selected metrics as concentric rings (outer first, nesting inward). Shared here:
//the 24 hour labels, the under-dial guide + compass, the per-ring glow defs, the global back-to-front depth
//sort; per-ring geometry lives in projectHistogramRing. Pure: the card resolves each ring's animation scalars
//(slot/heightScale/opacity) and the focused slot.
export function projectClockFrame(
    camera: SceneCamera,
    rings: ClockRingInput[],
    //PINNED slot + the 0..1 fade ramp: only a pinned slice dims the OTHER bars (they fade transparent). dimSlot
    //persists through the fade-out so it ramps smoothly. Both the pinned and the hovered bar are edge-lit.
    dimSlot: number | null,
    dim: number,
    //HOVERED slot (transient): edge-lights that bar only, never dims the others. Null when nothing is hovered.
    hoverSlot: number | null,
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
        projectHistogramRing(camera, R, outerR, ring, ri, maxHm, ceiling, minEdge, ppm, dimSlot, dim, hoverSlot, faces, hits);
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
        diameterPx: decalDiaPx * LOGO_DECAL_SCALE,
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
//H..H+1). The hovered AND the pinned bar are edge-lit; only a PINNED bar dims the others (they fade transparent).
//Grow / slide / exit ride on the ring's animation scalars.
function projectHistogramRing(
    camera: SceneCamera, R: number, outerR: number, ring: ClockRingInput, ri: number, maxHm: number, ceiling: number,
    minEdge: number, ppm: number, dimSlot: number | null, dim: number, hoverSlot: number | null, faces: ClockFace[], hits: ClockHit[]
): void
{
    const data   = ring.data;
    const hourly = data.layers.map(L => hourlyOf(L.values, data.unit === 'energy'));   //[layer][24]
    const totalAt = (h: number): number => hourly.reduce((s, hv) => s + Math.max(0, hv[h]), 0);
    //Normalise against the shared per-unit ceiling so same-unit metrics' bars are directly comparable.
    const zScale = ceiling > 0 ? (maxHm * ring.heightScale) / ceiling : 0;
    const halfRadial = ringSpacingM(outerR) * BAR_RADIAL_FRAC;
    const halfTan    = (BAR_TANGENT_FRAC * minEdge) / ppm * ringRadiusFrac(ring.slot);
    //Pinned hour drives the transparency of the OTHERS; hovered hour is edge-lit only. Both are "active" (glow).
    const pinHour   = dimSlot   === null ? null : Math.floor(dimSlot   / CLOCK_SLOTS_PER_HOUR);
    const hoverHour = hoverSlot === null ? null : Math.floor(hoverSlot / CLOCK_SLOTS_PER_HOUR);

    for (let h = 0; h < HOURS_PER_DAY; h++)
    {
        const a = hourRad((h + 0.5) / HOURS_PER_DAY, camera.southern);   //BETWEEN the hour lines
        const e = R * Math.sin(a); const n = R * Math.cos(a);
        const total = totalAt(h);
        const base  = camera.project(e, n, 0);
        const top   = camera.project(e, n, total * zScale);
        //Hit axis tagged with the hour's first slot, so the card maps it back to the hour.
        hits.push({ slot: h * CLOCK_SLOTS_PER_HOUR, bx: base[0], by: base[1], tx: top[0], ty: top[1] });
        const active = h === pinHour || h === hoverHour;
        //Only a PINNED slice fades the rest; the edge-lit bars (pinned + hovered) stay fully opaque.
        const dimOp  = ring.opacity * (pinHour !== null && !active ? 1 - CLOCK_DIM_STRENGTH * dim : 1);
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


//Project the DAY ring: a flat 24-hour ground annulus for today. Each hour's cell is split gold (solar share) then
//import-colour (grid share), so both where the sun covered you and where you drew from the grid read at a glance.
//No bars: the story is the colour, not the height. Reuses the clock's labels, guide, compass, now-arrow and decal.
//One device's ring for the day dial: its dashboard colour + per-slot energy (the run arcs are derived from it).
export interface DayDeviceRing
{
    color:  string;
    values: number[];
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
    solarColor: string,
    importColor: string,
    batteryColor: string,
    rings: DayDeviceRing[],
    //Each source ring is drawn only when that source is configured on the dashboard.
    hasSolar = true,
    hasGrid = true,
    hasBattery = true,
    //Selected ring index (-1 = none), in the concatenated [producers..., devices...] order. When one is selected
    //every OTHER ring fades (producers and devices alike); with no selection all stay at full opacity.
    selectedIndex = -1,
    //Historical peak average power (kW) across all consumption meters: the device ribbons' width reference. 0 keeps
    //the fixed-width run arcs (no reference known).
    maxKw = 0,
    //Entry-animation progress (0..1); 1 = fully drawn. Below 1, the donuts + start discs fade in, then the ribbons
    //sweep from midnight round the day with the end disc riding the front.
    progress = 1,
    //Day fraction [0,1] of "now" (1 = a complete day, e.g. yesterday). For today, slots past this are the future:
    //drawn as a faint hairline (no data yet) rather than a full ribbon.
    liveFrac = 1,
    //Hovered ring index (-1 = none), same order as selectedIndex. The hovered AND the selected ring are edge-lit
    //(a bright outline), like the histogram's focused bar.
    hoverIndex = -1,
): ClockFrame
{
    const minEdge = Math.min(camera.centreX * 2, camera.centreY * 2) || 1;
    const ppm     = camera.pxPerMetre || 1;
    const outerR  = (RING_R_FRAC * DAY_RING_SCALE * minEdge) / ppm;   //day dial shrunk uniformly so the wide label ring clears the card edge
    //Ring-stack outer edge, pushed out vs the histogram; the inner edge + centre disc are derived below.
    const discR   = outerR * DAY_RING_OUTER_MULT;
    const tilt    = camera.tiltDeg;
    const bearing = camera.bearingDeg;
    //Hour labels laid flat just outside the (bigger) ring, radial, no dots. Kept consistent with the other modes.
    const labelR = outerR * DAY_RING_LABEL_MULT;
    const labels = Array.from({ length: 24 }, (_, h) =>
    {
        const p = dayPt(camera, labelR, h / HOURS_PER_DAY);
        return {
            x: p[0], y: p[1], opacity: 1,
            transform: `translate(-50%, -50%) perspective(900px) rotateX(${tilt}deg) rotateZ(${bearing + hourDeg(h / HOURS_PER_DAY, camera.southern) + 180}deg)`,
        };
    });
    const guideSvg = '';

    const homeCtr = camera.project(0, 0, 0);
    const decal   = { svg: '', active: false };   //no central logo in day mode

    const slots = Math.max(1, solar.length);
    //Two "big rings": all configured PRODUCERS (solar, grid, battery) grouped inside one zone, all DEVICES in
    //another, each member drawn as a variable-width ribbon at its own sub-radius. Reading a device ribbon against the
    //solar one shows at a glance whether it ran under the sun. dayHits are returned in draw order (producers then
    //devices) so the tooltip can map a hit index back to a source or a device.
    const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
    //Soften the per-slot width (edge-clamped 3-slot mean) so fine-cadence jitter and the slot-to-slot flip between
    //competing sources don't leave the ribbon edge hairy.
    const smooth = (a: number[]): number[] => a.map((_, i) =>
    {
        let s = 0; let c = 0;
        for (let k = -1; k <= 1; k++) { const j = i + k; if (j >= 0 && j < a.length) { s += Math.max(0, a[j]); c++; } }
        return c > 0 ? s / c : 0;
    });
    //Producer ribbon thickness = the source's (smoothed) share of the slot's load (already 0..1).
    const producers: { color: string; t: number[] }[] = [];
    if (hasSolar)   { producers.push({ color: solarColor,    t: smooth(solar.map(clamp01))   }); }
    if (hasGrid)    { producers.push({ color: importColor,   t: smooth(grid.map(clamp01))    }); }
    if (hasBattery) { producers.push({ color: batteryColor,  t: smooth(battery.map(clamp01)) }); }
    const nP = producers.length;
    //Consumer ribbon thickness = the slot's average power against the historical peak (maxKw), as an energy-per-slot
    //reference, on a sqrt curve so a light load still reads without losing the order of magnitudes, then smoothed. No
    //reference known -> fall back to the ring's own peak so it still shows relative intensity, not a flat hairline.
    const slotHours = HOURS_PER_DAY / slots;
    const consumers = rings.map(rg =>
    {
        let ref = maxKw > 0 ? maxKw * slotHours : 0;
        if (ref <= 0) { for (const v of rg.values) { ref = Math.max(ref, Math.max(0, v)); } }
        const t0 = ref > 0 ? rg.values.map(v => Math.sqrt(clamp01(Math.max(0, v) / ref))) : rg.values.map(() => 0);
        return { color: rg.color, t: smooth(t0) };
    });

    const nC = consumers.length;
    //Radial layout (outer -> inner): producer zone (FIXED width per ring), a uniform pad, consumer zone, the SAME
    //pad, then the FIXED centre disc. The consumer rings share whatever space is left between the producer zone
    //and the centre, so a group of many devices just draws thinner rings; the centre never balloons. The pad only
    //appears where a boundary exists.
    const pad        = DAY_ZONE_PAD_FRAC * outerR;
    const centreR    = DAY_CENTER_DISC_FRAC * outerR;                //FIXED
    const padBetween = (nP > 0 && nC > 0) ? pad : 0;
    const padCentre  = (nP + nC > 0) ? pad : 0;
    const producerSub   = DAY_PRODUCER_W_FRAC * outerR;             //FIXED per producer ring
    const producerThick = nP * producerSub;
    //Consumers fill the remainder between the producer zone and the fixed centre (floored so it never inverts);
    //dayRunGroup derives each ring's width from this thickness / count, so 12 devices just draw thinner.
    const consumerThick = Math.max(0, discR - centreR - padCentre - padBetween - producerThick);

    //Producers and consumers are drawn into SEPARATE layers: producers never change between drill levels, so the
    //drill zoom must not touch them; only the consumer layer (+ the centre disc) zooms.
    let producerSvg = '';
    let consumerSvg = '';
    let dayHits: DayRingHit[] = [];
    //A selection fades every OTHER ring; the selected AND the hovered ring stay full (so their edge reads). With
    //no selection nothing fades. Hover alone never dims.
    const dimAt = (globalIndex: number): number => (selectedIndex < 0 || selectedIndex === globalIndex || globalIndex === hoverIndex) ? 1 : 0.22;
    //The hovered AND the selected ring are edge-lit (a bright outline), like the histogram's focused bar.
    const edgeAt = (globalIndex: number): boolean => globalIndex === hoverIndex || globalIndex === selectedIndex;
    //Entry sweep: donuts + start discs fade in over the first quarter, then the ribbon sweeps round the day.
    const ease  = (x: number): number => { const c = Math.min(1, Math.max(0, x)); return 1 - (1 - c) ** 3; };
    const fade  = ease(progress / 0.25);
    const sweep = ease((progress - 0.25) / 0.75);
    let cursor = discR;
    if (nP > 0)
    {
        //Producer global hit index is just k.
        const g = dayRunGroup(camera, cursor, producerThick, producers, slots, (k) => dimAt(k), (k) => edgeAt(k), fade, sweep, liveFrac);
        //Multi-colour glow rimming the zone's outer + inner circles, from the producer colours: marks it fixed.
        const glow = dayZoneGlow(camera, cursor, cursor - producerThick, producers.map(p => p.color), DAY_PROD_GLOW_OPACITY * fade);
        producerSvg += glow + g.svg;
        dayHits = dayHits.concat(g.hits);
        cursor -= producerThick + padBetween;   //pad before the consumer zone
    }
    if (nC > 0)
    {
        //A device's global hit index is nP + k. Consumers carry the peak-hour markers.
        const g = dayRunGroup(camera, cursor, consumerThick, consumers, slots, (k) => dimAt(nP + k), (k) => edgeAt(nP + k), fade, sweep, liveFrac, true);
        consumerSvg += g.svg;
        dayHits = dayHits.concat(g.hits);   //hit index: producers 0..nP-1 then devices nP..
    }
    //Centre disc: same background as the zone donuts, with a 2 px primary-text outline. Its OWN layer (stays fixed,
    //like the producers, while the consumer rings flip); only its content (the button) fades.
    const centerSvg = dayDonut(camera, centreR, 0, DAY_BAND_COLOR, fade, DAY_CENTER_EDGE_PX);

    //Centre-icon anchor: midway from the disc centre to its TOPMOST screen point, so the icon sits in the disc's
    //upper half (leaving the lower half for content below).
    let topPt = homeCtr;
    for (let k = 0; k < 48; k++) { const p = dayPt(camera, centreR, k / 48); if (p[1] < topPt[1]) { topPt = p; } }
    const centerAnchor = { x: (homeCtr[0] + topPt[0]) / 2, y: (homeCtr[1] + topPt[1]) / 2 };

    return {
        guideSvg,
        svg: producerSvg,
        dayConsumerSvg: consumerSvg,
        dayCenterSvg: centerSvg,
        hits: [], labels, compass: [],
        home: { x: homeCtr[0], y: homeCtr[1], r: centreR * ppm },
        decal,
        dayHits,
        centerAnchor,
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
