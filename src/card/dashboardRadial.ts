//Helios radial sundial: the single SVG component at the centre of each CoverFlow day card.
//
//Concentric layout, inside -> outside:
//  - Centre: sun disc (irradiance % of summer-solstice clear-sky) + reference rim.
//  - Cloud ring: hourly cloud cover (% from the weather model series), past solid / future dashed.
//  - Production ring: hourly PV power, past solid / future dashed.
//  - Consumption ring: hourly home consumption from the grid net + PV reconstruction, past only.
//  - Sundial: 24 hour labels + 96 sub-hour ticks (4 per hour).
//
//Two cursors:
//  - Permanent "now" cursor on today's card, anchored at the outer edge of the irradiance reference
//    rim and ending at the outer dial edge.
//  - On-hover cursor, mirror of the now cursor in secondary text colour. Drives the corner labels
//    (top-left production, top-right consumption, bottom-left cloud, bottom-right hour).
//
//Angle convention (clockwise, noon at top):
//  hour 12 -> top              (0, -r)
//  hour 18 -> right            (+r, 0)
//  hour  0 -> bottom           (0, +r)
//  hour  6 -> left             (-r, 0)
//Implemented as alpha = (hour - 12) * pi / 12, then x = r * sin(alpha), y = -r * cos(alpha).

import { html, svg, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import type { DashboardHost } from './dashboard';
import { navigateDashDay } from './dashboard';
import { getSunPosition } from '../engine/sun';
import { getHomeCoords } from './init';
import { formatLocalisedNumber } from './format';
import { pickTranslations } from '../i18n';
import { sliceForDay, displayUpdateFrequencyPerHour } from './unifiedStore';
import { sumChangeForDay } from './energy-stats';
import { pvValueAtTime, interpAt, type ChartHost } from './charts';
import { pvNormalizeToWatts, pvArrays } from './pv';
import { lerpHexToward } from './format';
import { DEFAULT_PV_COLOR_HEX } from '../helios-config';
import { hasPvConfigured, hasBatteryConfigured } from './equipment';


//Tighter geometry than the V1 prototype: outer dial shrunk from 195 to 165 viewBox units (15 %
//narrower visually), reference disc shrunk from 60 to 48 so the four rings have meaningful breathing
//room. ViewBox stays at 400 so external aspect ratios + max-width caps still apply consistently.
const VIEWBOX                  = 400;
const CENTER                   = 200;
//Concentric ANNULI with breathing gaps between them. The whole layout was rescaled +6 % vs v3 now
//that the CoverFlow cards are wider (5 / 7 aspect ratio instead of 4 / 7). Each data ring has an
//explicit inner edge, outer edge and a 4 unit gap before the next ring. The dial ring is wide enough
//to host its hour labels INSIDE it at the mid-annulus, plus the hour / half / quarter ticks against
//BOTH its outer and inner edges (mirrored).
const R_SUN_REF                = 28;   //reference rim circle, also irradiance max disc radius (halved from v5)
const R_SUN_HALO_MAX           = 50;   //outer envelope of the halo at 100 % irradiance (= old R_SUN_REF, shifted in alongside the rings)
const R_DIAL_INNER             = 158;
//Inter-ring gap (units of viewBox). Same value between every data ring + between the outermost data
//ring and the dial annulus, so the layout reads as evenly-spaced regardless of how many data rings
//are present (3 / 2 / 1).
const RING_GAP                 = 6;
//Default ring widths when all 3 rings (cloud / prod / batt) are present. Sum = 84, plus 4 gaps of 6
//= 108, matches the available span from R_SUN_HALO_MAX (50) to R_DIAL_INNER (158).
const RING_WIDTH_3_RINGS       = 28;
//With one ring removed (no battery OR no PV), one gap is removed too so the freed space is the
//missing ring width + one gap = 34. Split between the two remaining rings, each grows by 17 to
//45 units wide. Sum = 2*45 + 3*6 = 108.
const RING_WIDTH_2_RINGS       = 45;
//With no data rings at all (no PV + no battery), the entire span between R_SUN_HALO_MAX and
//R_DIAL_INNER becomes cloud + irradiance (the single-ring case is encoded directly in
//computeRadialLayout, no width constant needed since the values are R_SUN_HALO_MAX and
//R_DIAL_INNER themselves).


//Per-render radial layout. Driven by what equipment the user has wired: production ring shows up
//only when PV is configured (HA Energy solar source OR pv-arrays declared); battery ring shows up
//only when an HA Energy battery source is wired. Removing a ring redistributes its width + one
//inter-ring gap onto the remaining rings, EXCEPT the clock dial (R_DIAL_INNER -> R_DIAL_OUTER) and
//the inner irradiance disc (R_SUN_REF / R_SUN_HALO_MAX), both of which stay at their original size
//so the visual anchor points (clock face, sun disc) read consistently across configurations.
interface RadialLayout
{
    hasPv:           boolean;
    hasBattery:      boolean;
    cloudInner:      number;
    cloudOuter:      number;
    prodInner:       number;
    prodOuter:       number;
    battInner:       number;
    battOuter:       number;
}

function computeRadialLayout(hasPv: boolean, hasBattery: boolean): RadialLayout
{
    //Three rings: cloud / prod / batt, default widths.
    if (hasPv && hasBattery)
    {
        const cloudInner = R_SUN_HALO_MAX + RING_GAP;
        const cloudOuter = cloudInner + RING_WIDTH_3_RINGS;
        const prodInner  = cloudOuter + RING_GAP;
        const prodOuter  = prodInner  + RING_WIDTH_3_RINGS;
        const battInner  = prodOuter  + RING_GAP;
        const battOuter  = battInner  + RING_WIDTH_3_RINGS;
        return { hasPv, hasBattery, cloudInner, cloudOuter, prodInner, prodOuter, battInner, battOuter };
    }
    //Two rings: cloud + prod (no battery) OR cloud + batt (no PV). The removed ring's outer edge is
    //collapsed onto the now-outermost ring to keep the cluster centred on the same span.
    if (hasPv && !hasBattery)
    {
        const cloudInner = R_SUN_HALO_MAX + RING_GAP;
        const cloudOuter = cloudInner + RING_WIDTH_2_RINGS;
        const prodInner  = cloudOuter + RING_GAP;
        const prodOuter  = prodInner  + RING_WIDTH_2_RINGS;
        //Battery is hidden, collapse its radii to the prod outer edge so any leftover SVG instruction
        //(forecast outline future fill etc.) draws an empty annulus instead of a phantom ring.
        return { hasPv, hasBattery, cloudInner, cloudOuter, prodInner, prodOuter, battInner: prodOuter, battOuter: prodOuter };
    }
    if (!hasPv && hasBattery)
    {
        const cloudInner = R_SUN_HALO_MAX + RING_GAP;
        const cloudOuter = cloudInner + RING_WIDTH_2_RINGS;
        const battInner  = cloudOuter + RING_GAP;
        const battOuter  = battInner  + RING_WIDTH_2_RINGS;
        return { hasPv, hasBattery, cloudInner, cloudOuter, prodInner: cloudOuter, prodOuter: cloudOuter, battInner, battOuter };
    }
    //One ring: cloud + irradiance fills the entire span between the irradiance halo and the dial.
    const cloudInner = R_SUN_HALO_MAX;
    const cloudOuter = R_DIAL_INNER;
    return { hasPv, hasBattery, cloudInner, cloudOuter, prodInner: cloudOuter, prodOuter: cloudOuter, battInner: cloudOuter, battOuter: cloudOuter };
}
//Dial annulus is now twice as wide as before so the hour digits can live INSIDE the ring rather than
//floating outside it. The freed perimeter space goes back to the dial itself, the dial reads as a
//proper analog watch ring with the digits painted on it.
const R_DIAL_OUTER             = 192;
//Hour labels now sit at the mid-line of the annulus, centred between the inner and outer edges of the
//dial. The HTML overlay reads the same percent of the viewBox so the digits anchor on the centre line
//of the ring at any container size.
const R_HOUR_LABEL             = (R_DIAL_INNER + R_DIAL_OUTER) / 2;
//Hover cursor endpoints. Anchored at the outer edge of the irradiance reference rim (= sun disc) and
//ending at the inner border of the dial annulus, the ray crosses every data ring and the tick band
//but stops short of the dial annulus + the hour digits, so the hour read-out stays fully legible
//behind the cursor at every angle.
const R_CURSOR_INNER           = R_SUN_REF;
const R_CURSOR_OUTER           = R_DIAL_INNER;
//Subdivision ticks. Painted near the INNER edge of the annulus, the digit at the centre keeps the eye
//on the hour while the ticks fan out below toward the inner border for the 15 min granularity. Three
//lengths so the eye snaps to the hour ticks first (bold + longest), then the half, then the quarter
//marks. Hour ticks are visibly longer than the rest so the user reads the hour anchor without
//confusing it with a quarter mark right next to a digit.
const R_TICK_INNER_END         = R_DIAL_INNER + 1;
const R_TICK_INNER_HOUR        = R_DIAL_INNER + 7;
const R_TICK_INNER_HALF        = R_DIAL_INNER + 4;
const R_TICK_INNER_QUARTER     = R_DIAL_INNER + 2.5;

const HOUR_MS                  = 3_600_000;
const DAY_MS                   = 24 * HOUR_MS;
//Per-day visual granularity is driven by the user-configured cadence (display-update-frequency-per
//-hour, 1-60). Every render function reads the cadence from `data.bucketsPerHour` (carried through
//the DaySlice the unified store produces) and derives STEPS_PER_HOUR + STEPS_PER_DAY locally. The
//hour-fraction units every public helper (interpAtHour, pastEndHour, polarPt, sun rise / set
//crossings) consumes stay in [0, 24) regardless of the cadence.

//Fixed irradiance scale for the radial cloud-ring overlay. A clear-sky summer noon peaks around 1100
//W / m² at temperate latitudes, picking this as the radial scale max means the curve uses ~90 % of
//the ring on a bright day and a meaningful sliver on an overcast one, and the visual stays consistent
//when the user swipes between past + future cards (per-day relative scaling would re-stretch the
//curve and break the "compare two days at a glance" affordance).
const IRR_SCALE_MAX_WM2        = 1100;


//Polar -> Cartesian helper. Angle convention is documented at the top of the file.
function polarPt(hour: number, radius: number, cx: number = CENTER, cy: number = CENTER): [number, number]
{
    const alpha = ((hour - 12) / 12) * Math.PI;
    return [cx + radius * Math.sin(alpha), cy - radius * Math.cos(alpha)];
}


//Annulus fill path bounded between the inner edge (fixed at innerRadius) and a variable outer
//curve that traces the per-step data values. Emits two subpaths so SVG fill-rule="evenodd" carves
//out the area between them; the inner circle alone would have made the fill spill all the way to
//the centre, the earlier "closed polygon from the centre" recipe likewise. Input array length is
//arbitrary (24 buckets / 1 h, 96 / 15 min, 288 / 5 min etc.), one path vertex per bucket so the
//curve resolves at the bucket granularity directly; no sub-bucket smoothing layer on top.
function buildRadialAnnulusPath(
    perStepValues: ReadonlyArray<number | null>,
    scaleMax:      number,
    innerRadius:   number,
    outerRadius:   number,
): string
{
    const N = perStepValues.length;
    if (N < 4 || scaleMax <= 0)
    {
        return '';
    }
    let d = '';
    for (let i = 0; i < N; i++)
    {
        const v     = perStepValues[i];
        const r     = v === null ? innerRadius : innerRadius + Math.max(0, Math.min(1, v / scaleMax)) * (outerRadius - innerRadius);
        const hour  = (i / N) * 24;
        const [x, y] = polarPt(hour, r);
        d += (d === '' ? 'M ' : ' L ') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    d += ' Z';
    //Inner edge: fixed circle at innerRadius. 48 vertices for a visually smooth fill boundary.
    {
        const [x0, y0] = polarPt(0, innerRadius);
        d += ' M ' + x0.toFixed(2) + ' ' + y0.toFixed(2);
        for (let i = 1; i <= 48; i++)
        {
            const [x, y] = polarPt((i / 48) * 24, innerRadius);
            d += ' L ' + x.toFixed(2) + ' ' + y.toFixed(2);
        }
        d += ' Z';
    }
    return d;
}


//Ring-track arc along a single radius (mid-ring). The track is a stroke of width = ring annulus
//thickness, so the path traces the centre of the ring and the stroke spreads to inner + outer
//edges. Used to split each data ring's track into past + future segments so each segment can
//take its own opacity (full strength for past, faded for not-yet-elapsed hours). A 24 hour span
//is drawn as two half-arcs so the SVG arc command does not degenerate on a closed circle.
function buildRingArcPath(midR: number, fromHour: number, toHour: number): string
{
    if (toHour <= fromHour + 0.001) { return ''; }
    if (toHour - fromHour >= 23.999)
    {
        const [x1, y1] = polarPt(0, midR);
        const [x2, y2] = polarPt(12, midR);
        return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${midR} ${midR} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} A ${midR} ${midR} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    }
    const [x1, y1] = polarPt(fromHour, midR);
    const [x2, y2] = polarPt(toHour,   midR);
    const largeArc = toHour - fromHour > 12 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${midR} ${midR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}


//Open radial outline path (no Z close). Used for the past portion when slicing by current hour.
function buildRadialOutlinePath(
    perStepValues: ReadonlyArray<number | null>,
    scaleMax:      number,
    baseRadius:    number,
    outerRadius:   number,
    fromHour:      number,
    toHour:        number,
): string
{
    const N = perStepValues.length;
    if (N < 4 || scaleMax <= 0 || toHour <= fromHour)
    {
        return '';
    }
    let d = '';
    //Walk the bucket array between the fractional hour bounds, one path vertex per bucket whose
    //centre falls inside the window. iStart / iEnd round outward so a fromHour / toHour that lands
    //mid-bucket still produces a continuous polyline up to the boundary.
    const iStart = Math.max(0, Math.floor((fromHour / 24) * N));
    const iEnd   = Math.min(N - 1, Math.ceil((toHour / 24) * N));
    for (let i = iStart; i <= iEnd; i++)
    {
        const v    = perStepValues[i];
        const r    = v === null ? baseRadius : baseRadius + Math.max(0, Math.min(1, v / scaleMax)) * (outerRadius - baseRadius);
        const hour = (i / N) * 24;
        const [x, y] = polarPt(hour, r);
        d += (d === '' ? 'M ' : ' L ') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    return d;
}


function computeDailyIrradianceRatio(host: DashboardHost, dayStartMs: number): { ratioPct: number; meanWm2: number }
{
    const series = host._chartSeries;
    if (!series || series.times.length === 0) { return { ratioPct: 0, meanWm2: 0 }; }
    const dayEndMs = dayStartMs + DAY_MS;
    let sum   = 0;
    let count = 0;
    for (let i = 0; i < series.times.length; i++)
    {
        const t = series.times[i].getTime();
        if (t < dayStartMs || t >= dayEndMs) { continue; }
        const sw = series.irradiance?.[i];
        if (typeof sw !== 'number' || !Number.isFinite(sw) || sw < 0) { continue; }
        sum += sw;
        count++;
    }
    if (count === 0) { return { ratioPct: 0, meanWm2: 0 }; }
    const meanWm2 = sum / count;
    const coords = getHomeCoords(host.config, host.hass);
    const lat    = coords?.lat ?? 0;
    const refWm2 = summerSolsticeReferenceWm2(lat);
    if (refWm2 <= 0) { return { ratioPct: 0, meanWm2 }; }
    const ratio  = Math.max(0, Math.min(1, meanWm2 / refWm2));
    return { ratioPct: ratio * 100, meanWm2 };
}


const _refMeanWm2Cache = new Map<number, number>();
function summerSolsticeReferenceWm2(lat: number): number
{
    const key = Math.round(lat);
    const cached = _refMeanWm2Cache.get(key);
    if (cached !== undefined) { return cached; }
    const year = new Date().getFullYear();
    const refDate = lat >= 0
        ? new Date(year, 5, 21, 0, 0, 0)
        : new Date(year, 11, 21, 0, 0, 0);
    let sum   = 0;
    for (let h = 0; h < 24; h += 0.5)
    {
        const t = new Date(refDate.getTime() + h * 3_600_000);
        const sun = getSunPosition(t, lat, 0);
        const altRad = sun.altitude * Math.PI / 180;
        if (altRad <= 0) { continue; }
        const cosZ = Math.sin(altRad);
        if (cosZ <= 0) { continue; }
        const ghi = 1098 * cosZ * Math.exp(-0.057 / cosZ);
        sum += ghi;
    }
    const total = sum / 48;
    _refMeanWm2Cache.set(key, total);
    return total;
}


//Resolve the HA-configured time format (12h vs 24h). 'language' / 'system' / unset all fall back to
//the language's Intl default so a fr-FR user lands on 24h, an en-US user on 12h, without us having
//to maintain a per-locale table.
function uses12HourFormat(hass: { locale?: { time_format?: string; language?: string }; language?: string } | undefined): boolean
{
    const tf = hass?.locale?.time_format;
    if (tf === '12') { return true; }
    if (tf === '24') { return false; }
    const lang = hass?.locale?.language || hass?.language || (typeof navigator !== 'undefined' ? navigator.language : 'en');
    try
    {
        const cycle = new Intl.DateTimeFormat(lang, { hour: 'numeric' }).resolvedOptions().hourCycle;
        return cycle === 'h11' || cycle === 'h12';
    }
    catch (_)
    {
        return false;
    }
}


//Convert a 0..23 integer hour into the label string for the dial face, respecting HA's 12 / 24
//format. The 12-hour layout maps 0 + 12 to "12", everything else to its 1..11 modulo so the dial
//reads like a classic analog clock face with AM hours on the morning quadrant and PM hours on the
//afternoon quadrant.
function formatDialHourLabel(hour: number, hass: { locale?: { time_format?: string; language?: string }; language?: string } | undefined): string
{
    if (uses12HourFormat(hass))
    {
        const h12 = hour % 12;
        return h12 === 0 ? '12' : String(h12);
    }
    return String(hour);
}


//Format a clock time for the corner pill, full locale + time format. "14:30" on fr-FR / 24 h,
//"2:30 PM" on en-US / 12 h.
function formatHoverClock(hourFraction: number, hass: { locale?: { time_format?: string; language?: string }; language?: string } | undefined): string
{
    const h = Math.floor(hourFraction);
    const m = Math.floor((hourFraction - h) * 60);
    const d = new Date(2000, 0, 1, h, m);
    const lang = hass?.locale?.language || hass?.language || 'en';
    try
    {
        return new Intl.DateTimeFormat(lang, {
            hour:     'numeric',
            minute:   '2-digit',
            hourCycle: uses12HourFormat(hass) ? 'h12' : 'h23',
        }).format(d);
    }
    catch (_)
    {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
}


function formatW(hass: { language?: string } | undefined, w: number | null): string
{
    if (w === null || !Number.isFinite(w)) { return '—'; }
    if (Math.abs(w) >= 1000)
    {
        return `${formatLocalisedNumber(hass as any, w / 1000, 1)} kW`;
    }
    return `${formatLocalisedNumber(hass as any, Math.round(w), 0)} W`;
}


function formatPct(hass: { language?: string } | undefined, pct: number | null): string
{
    if (pct === null || !Number.isFinite(pct)) { return '—'; }
    return `${formatLocalisedNumber(hass as any, Math.round(pct), 0)} %`;
}


function dayStartMsFor(offset: number): number
{
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d.getTime();
}


function currentHourFraction(): number
{
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}


//Find sunrise + sunset times for a calendar day at (lat, lon). Returns the hour fractions in
//[0, 24) where the sun crosses the horizon. Polar days return both null (sun never sets / never
//rises). Stepped at 5 min to keep the cost low while still landing within ~5 min of the true
//crossing, which is invisible at the dial's 24 hour scale. Memoised per (dayStartMs, lat, lon)
//bucket so a multi-card dashboard does not recompute the same crossing five times per render.
const _sunriseSunsetCache = new Map<string, { sunrise: number | null; sunset: number | null }>();
function findSunriseSunset(dayStartMs: number, lat: number, lon: number): { sunrise: number | null; sunset: number | null }
{
    const key = `${dayStartMs}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    const cached = _sunriseSunsetCache.get(key);
    if (cached) { return cached; }
    let sunrise: number | null = null;
    let sunset:  number | null = null;
    let prevAlt = getSunPosition(new Date(dayStartMs), lat, lon).altitude;
    const startBelowHorizon = prevAlt < 0;
    for (let m = 5; m <= 24 * 60; m += 5)
    {
        const t   = new Date(dayStartMs + m * 60 * 1000);
        const alt = getSunPosition(t, lat, lon).altitude;
        if (prevAlt < 0 && alt >= 0 && sunrise === null) { sunrise = m / 60; }
        else if (prevAlt >= 0 && alt < 0 && sunset === null) { sunset = m / 60; }
        prevAlt = alt;
    }
    //Polar day: never crossed. Polar night: never crossed either. Leave both null in those edge
    //cases so the caller knows there is nothing to paint.
    void startBelowHorizon;
    const result = { sunrise, sunset };
    _sunriseSunsetCache.set(key, result);
    return result;
}


//SVG path command for the night-period filled segment in the dial annulus. From sunset hour at the
//inner radius, clockwise (through midnight) to sunrise hour, radial out to the outer radius, then
//counter-clockwise back to sunset hour at the outer radius, closed. Returns the empty string when
//either sunrise or sunset is null (polar day / night), or when the night spans the entire day.
function buildNightArcPath(sunset: number | null, sunrise: number | null, innerR: number, outerR: number): string
{
    if (sunset === null || sunrise === null) { return ''; }
    //Convert to angle in degrees, clockwise from top (matches polarPt's alpha convention).
    const a0 = ((sunset  - 12) % 24) * 15;
    const a1 = ((sunrise - 12) % 24) * 15;
    let span = a1 - a0;
    if (span < 0) { span += 360; }
    if (span <= 1 || span >= 359) { return ''; }
    const largeArc = span > 180 ? 1 : 0;
    const [sx1, sy1] = polarPt(sunset,  innerR);
    const [ex1, ey1] = polarPt(sunrise, innerR);
    const [ex2, ey2] = polarPt(sunrise, outerR);
    const [sx2, sy2] = polarPt(sunset,  outerR);
    return [
        `M ${sx1.toFixed(2)} ${sy1.toFixed(2)}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 1 ${ex1.toFixed(2)} ${ey1.toFixed(2)}`,
        `L ${ex2.toFixed(2)} ${ey2.toFixed(2)}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 0 ${sx2.toFixed(2)} ${sy2.toFixed(2)}`,
        'Z'
    ].join(' ');
}


//Pointer -> hour conversion. Reads the SVG's bounding box, computes the angle of (clientX, clientY)
//relative to the centre and maps it into the [0, 24) hour range using the same noon-on-top clockwise
//convention as the rest of the file. The v2 implementation mapped angle 0 to hour 0, which mirrored
//the dial: the pointer sitting at 2 a.m. resolved to 14:00 and vice versa. The dial places 12:00 at
//angle 0 (top), so the inverse must add 12 before wrapping back into [0, 24).
function pointerToHourFraction(svgEl: SVGSVGElement, clientX: number, clientY: number): number
{
    const rect = svgEl.getBoundingClientRect();
    const dx   = clientX - (rect.left + rect.width  / 2);
    const dy   = clientY - (rect.top  + rect.height / 2);
    if (dx === 0 && dy === 0) { return 12; }
    //atan2(dx, -dy) yields 0 at top, +pi/2 at right, +/-pi at bottom, -pi/2 at left. Add 2*pi to
    //wrap the lower half into positive.
    let a = Math.atan2(dx, -dy);
    if (a < 0) { a += 2 * Math.PI; }
    //angle 0 -> hour 12 (top of dial), angle pi -> hour 0 (bottom), wrap into [0, 24).
    let hour = 12 + (a / (2 * Math.PI)) * 24;
    if (hour >= 24) { hour -= 24; }
    return hour;
}


//Pre-computed per-card data bundle shared by the radial dial, the top chip strip and the footer
//clock strip. Holding all three views off the same compute pass avoids walking the history series
//three times per render.
export interface RadialDayData
{
    dayStartMs:     number;
    dayEndMs:       number;
    pastEndHour:    number;
    //Per-day bucket cadence captured from the unified data source so each render call derives
    //STEPS_PER_HOUR / STEPS_PER_DAY without re-reading the user config from the host.
    bucketsPerHour: number;
    //Equipment flags. Drive the adaptive radial layout: production ring renders when hasPv, battery
    //ring renders when hasBattery; missing rings collapse and their space + one inter-ring gap get
    //redistributed onto the survivors (cloud + irradiance always stay, clock annulus + inner sun
    //disc stay fixed too).
    hasPv:          boolean;
    hasBattery:     boolean;
    hourlyProd:     (number | null)[];
    hourlyForecast: (number | null)[];
    hourlyBatt:     (number | null)[];
    hourlyCloud:    (number | null)[];
    hourlyIrr:      (number | null)[];
    prodScaleMax:   number;
    battScaleMax:   number;
    cloudScaleMax:  number;
    sunRiseSet:     { sunrise: number | null; sunset: number | null };
    ratioPct:       number;
    //Exact daily totals summed from the recorder `change` buckets for this day, NOT integrated from
    //the gap-interpolated curve, so the badge matches the HA Energy dashboard to the watt-hour.
    //prodDailyKwh is the produced kWh; battNetDailyKwh is the net battery energy in HA's Sources
    //sign convention (discharge minus charge: negative when the battery net charged on the day).
    //Null when the day carries no recorder buckets (future day, or data not yet fetched).
    prodDailyKwh:    number | null;
    battNetDailyKwh: number | null;
}


//Empty per-card data when the unified store hasn't been built yet (first render after card mount,
//before the initial fetches lifted). Every series is all-null so the radial dial + graph view render
//cleanly with empty curves until the first refresh lands the real data, no crash, no flicker.
function emptyRadialDayData(host: DashboardHost, cardOffset: number): RadialDayData
{
    const dayStartMs = dayStartMsFor(cardOffset);
    const dayEndMs   = dayStartMs + DAY_MS;
    const nowMs      = Date.now();
    const pastEndHour = dayEndMs <= nowMs ? 24
                      : dayStartMs >= nowMs ? 0
                      : (nowMs - dayStartMs) / HOUR_MS;
    const bucketsPerHour = displayUpdateFrequencyPerHour(host.config);
    const empty: (number | null)[] = new Array(24 * bucketsPerHour).fill(null);
    return {
        dayStartMs,
        dayEndMs,
        pastEndHour,
        bucketsPerHour,
        hasPv:          hasPvConfigured(host),
        hasBattery:     hasBatteryConfigured(host),
        hourlyProd:     empty.slice(),
        hourlyForecast: empty.slice(),
        hourlyBatt:     empty.slice(),
        hourlyCloud:    empty.slice(),
        hourlyIrr:      empty.slice(),
        prodScaleMax:   500,
        battScaleMax:   500,
        cloudScaleMax:  100,
        sunRiseSet:     { sunrise: null, sunset: null },
        ratioPct:       0,
        prodDailyKwh:    null,
        battNetDailyKwh: null,
    };
}


export function prepareRadialDayData(host: DashboardHost, cardOffset: number): RadialDayData
{
    //Read from the unified 5-day store: every per-time signal already lives in pre-bucketized form.
    //sliceForDay carves out the 96 buckets for this card's calendar day, the only per-day work that
    //stays here is the scale max derivation (depends on the slice) and the sun rise / set + daily
    //irradiance ratio which need the home coordinates.
    const store = host._unifiedStore;
    if (!store)
    {
        return emptyRadialDayData(host, cardOffset);
    }
    const slice = sliceForDay(store, cardOffset);
    const hourlyProd     = slice.hourlyProd.slice();
    const hourlyForecast = slice.hourlyForecast.slice();
    const hourlyBatt     = slice.hourlyBatt.slice();
    const hourlyCloud    = slice.hourlyCloud.slice();
    const hourlyIrr      = slice.hourlyIrradiance.slice();

    //Scale max is locked to the total installed peak power (sum of per-string peak-kwp values,
    //fallback to the legacy top-level pv-peak-kwp), expressed in watts. Every day reads on the
    //same vertical scale so a sunny day curve stretches up close to the top of the chart and a
    //cloudy day curve sits visibly lower, the user reads the day's quality at a glance without
    //having to compare two charts side-by-side. The data-driven path (max actual + forecast x
    //1.25, floored at 500 W) survives as a fallback for installs that have not declared their
    //peak (legacy YAML with neither pv-arrays nor pv-peak-kwp).
    const totalPeakWatts = pvArrays(host.config).totalKwp * 1000;
    let prodScaleMax: number;
    if (totalPeakWatts > 0)
    {
        prodScaleMax = totalPeakWatts;
    }
    else
    {
        let prodMax = 0;
        for (const v of hourlyProd)     { if (v !== null && v > prodMax) { prodMax = v; } }
        for (const v of hourlyForecast) { if (v !== null && v > prodMax) { prodMax = v; } }
        prodScaleMax = Math.max(1, prodMax * 1.25, 500);
    }
    let battMax = 0;
    for (const v of hourlyBatt) { if (v !== null && Math.abs(v) > battMax) { battMax = Math.abs(v); } }
    const battScaleMax  = Math.max(1, battMax * 1.25, 500);
    const cloudScaleMax = 100;

    const homeCoords = getHomeCoords(host.config, host.hass);
    const sunRiseSet = homeCoords ? findSunriseSunset(slice.dayStartMs, homeCoords.lat, homeCoords.lon) : { sunrise: null, sunset: null };
    const { ratioPct } = computeDailyIrradianceRatio(host, slice.dayStartMs);

    //Exact daily totals from the recorder `change` buckets (no curve integration, no gap fill) so the
    //badge matches the HA Energy dashboard. Battery net follows HA's Sources sign: discharge - charge,
    //negative when the battery net charged on the day.
    const prodDailyKwh = sumChangeForDay(host._pvChangeSeries, slice.dayStartMs, slice.dayEndMs);
    const battCharge   = sumChangeForDay(host._batteryChargeChangeSeries,    slice.dayStartMs, slice.dayEndMs);
    const battDischarge = sumChangeForDay(host._batteryDischargeChangeSeries, slice.dayStartMs, slice.dayEndMs);
    const battNetDailyKwh = (battCharge === null && battDischarge === null)
        ? null
        : (battDischarge ?? 0) - (battCharge ?? 0);

    return {
        dayStartMs:     slice.dayStartMs,
        dayEndMs:       slice.dayEndMs,
        pastEndHour:    slice.pastEndHour,
        bucketsPerHour: slice.bucketsPerHour,
        hasPv:          hasPvConfigured(host),
        hasBattery:     hasBatteryConfigured(host),
        hourlyProd,
        hourlyForecast,
        hourlyBatt,
        hourlyCloud,
        hourlyIrr,
        prodScaleMax,
        battScaleMax,
        cloudScaleMax,
        sunRiseSet,
        ratioPct,
        prodDailyKwh,
        battNetDailyKwh,
    };
}


//Render the radial dial for one CoverFlow card. Front card is the only one that wires hover
//handlers, so a quiet rear card never costs a pointermove dispatch.
export function renderRadialDial(host: DashboardHost, cardOffset: number, activeOffset: number, data: RadialDayData): TemplateResult
{
    const isFront    = cardOffset === activeOffset;

    const { dayStartMs, pastEndHour, bucketsPerHour, hourlyProd, hourlyForecast, hourlyBatt, hourlyCloud, hourlyIrr, prodScaleMax, battScaleMax, cloudScaleMax, sunRiseSet, ratioPct } = data;
    const STEPS_PER_HOUR = bucketsPerHour;
    const STEPS_PER_DAY  = 24 * STEPS_PER_HOUR;
    //Adaptive ring radii. Resolved per-render from the equipment flags so missing rings collapse
    //and the survivors spread to absorb the freed span. Shadowing the module-level R_PROD_* / etc.
    //removed values via local consts keeps the rest of the render code untouched.
    const layout         = computeRadialLayout(data.hasPv, data.hasBattery);
    const R_CLOUD_INNER  = layout.cloudInner;
    const R_CLOUD_OUTER  = layout.cloudOuter;
    const R_PROD_INNER   = layout.prodInner;
    const R_PROD_OUTER   = layout.prodOuter;
    const R_BATT_INNER   = layout.battInner;
    const R_BATT_OUTER   = layout.battOuter;

    //Split the signed battery curve into charge (positive) and discharge (positive absolute) per-
    //hour arrays so two annulus paths can paint inside the same ring with their own colours.
    const hourlyBattCharge:    (number | null)[] = hourlyBatt.map(v => (v === null ? null : v > 0 ?  v : 0));
    const hourlyBattDischarge: (number | null)[] = hourlyBatt.map(v => (v === null ? null : v < 0 ? -v : 0));

    //Slice the arrays by the past / future boundary. Past hours feed the solid fills, future hours
    //feed the dashed outlines. Consumption has no future data so its future portion is always empty.
    //The past-end index is in bucket units, the fractional pastEndHour stays in hours and converts
    //to a bucket cutoff via STEPS_PER_HOUR.
    const ceilPastSteps  = Math.ceil(pastEndHour * STEPS_PER_HOUR);
    const floorPastH     = Math.floor(pastEndHour);
    //Production + battery paths only get computed when the matching equipment is configured. When
    //a ring is absent, every path string stays empty and the SVG `${path ? svg`...` : nothing}`
    //gates further down skip rendering the layer entirely, no phantom annulus painted with zero
    //width. Cloud + irradiance always render (they're weather data, not equipment-gated).
    const prodPastPath = data.hasPv && pastEndHour > 0
        ? buildRadialAnnulusPath(hourlyProd.slice(0, ceilPastSteps).concat(new Array(STEPS_PER_DAY - ceilPastSteps).fill(null)), prodScaleMax, R_PROD_INNER, R_PROD_OUTER)
        : '';
    const battChargePath = data.hasBattery && pastEndHour > 0
        ? buildRadialAnnulusPath(hourlyBattCharge.slice(0, ceilPastSteps).concat(new Array(STEPS_PER_DAY - ceilPastSteps).fill(null)), battScaleMax, R_BATT_INNER, R_BATT_OUTER)
        : '';
    const battDischargePath = data.hasBattery && pastEndHour > 0
        ? buildRadialAnnulusPath(hourlyBattDischarge.slice(0, ceilPastSteps).concat(new Array(STEPS_PER_DAY - ceilPastSteps).fill(null)), battScaleMax, R_BATT_INNER, R_BATT_OUTER)
        : '';
    const cloudPastPath = pastEndHour > 0
        ? buildRadialAnnulusPath(hourlyCloud.slice(0, ceilPastSteps).concat(new Array(STEPS_PER_DAY - ceilPastSteps).fill(null)), cloudScaleMax, R_CLOUD_INNER, R_CLOUD_OUTER)
        : '';
    const cloudFuturePath = pastEndHour < 24
        ? buildRadialOutlinePath(hourlyCloud, cloudScaleMax, R_CLOUD_INNER, R_CLOUD_OUTER, floorPastH, 24)
        : '';
    //Irradiance curve overlaid on the cloud ring, sun-coloured. Painted on top of the cloud fill so
    //the eye reads the hour as "sunny" (sun-tint dominates) or "cloudy" (grey dominates) without
    //extra chart real estate, mirrors what the main UI timeline does where both curves share the
    //same X axis at semi-transparent alphas. Scale max is fixed (IRR_SCALE_MAX_WM2) so the curve
    //reads consistently across past + future cards: a sunny day occupies most of the ring, a fully
    //overcast day collapses to the inner edge.
    const irrPastPath = pastEndHour > 0
        ? buildRadialAnnulusPath(hourlyIrr.slice(0, ceilPastSteps).concat(new Array(STEPS_PER_DAY - ceilPastSteps).fill(null)), IRR_SCALE_MAX_WM2, R_CLOUD_INNER, R_CLOUD_OUTER)
        : '';
    const irrFuturePath = pastEndHour < 24
        ? buildRadialOutlinePath(hourlyIrr, IRR_SCALE_MAX_WM2, R_CLOUD_INNER, R_CLOUD_OUTER, floorPastH, 24)
        : '';

    //Sun disc fill radius. Defaults to the daily mean irradiance ratio (computeDailyIrradianceRatio
    //compares the day's mean Wm² to the latitude-aware clear-sky reference), gets overridden below
    //to the hovered hour's instantaneous irradiance when the user is hovering the dial, so the
    //central sun reads as the LIVE value at the cursor instead of the day's overall summary.
    let sunFillRatio = Math.max(0, Math.min(1, ratioPct / 100));

    //Sunrise / sunset feeds the night-zone arc painted in the dial annulus so the user sees at a
    //glance how much of the day was dark. Sunrise + sunset values themselves come from the shared
    //RadialDayData bundle so the same crossings are reused by every consumer.
    const nightPath = buildNightArcPath(sunRiseSet.sunset, sunRiseSet.sunrise, R_DIAL_INNER, R_DIAL_OUTER);

    //Past / future split on the data fills. Past hours fill at full opacity, future hours fill
    //at reduced opacity so the past / future boundary reads directly off the fill contrast and
    //the dedicated "now" cursor can stay dropped.
    const prodFutureFillPath = data.hasPv && pastEndHour < 24
        ? buildRadialAnnulusPath(new Array(ceilPastSteps).fill(null).concat(hourlyForecast.slice(ceilPastSteps, STEPS_PER_DAY)), prodScaleMax, R_PROD_INNER, R_PROD_OUTER)
        : '';
    const cloudFutureFillPath = pastEndHour < 24
        ? buildRadialAnnulusPath(new Array(ceilPastSteps).fill(null).concat(hourlyCloud.slice(ceilPastSteps, STEPS_PER_DAY)), cloudScaleMax, R_CLOUD_INNER, R_CLOUD_OUTER)
        : '';
    const irrFutureFillPath = pastEndHour < 24
        ? buildRadialAnnulusPath(new Array(ceilPastSteps).fill(null).concat(hourlyIrr.slice(ceilPastSteps, STEPS_PER_DAY)), IRR_SCALE_MAX_WM2, R_CLOUD_INNER, R_CLOUD_OUTER)
        : '';

    //Per-ring track arcs split into past + future segments. The not-yet-elapsed half of each ring
    //gets its own class so CSS can paint it at a reduced opacity, the user reads the
    //background of every ring as already-happened (full strength) vs not-yet-happened (faded).
    //Applies to cloud + production + battery rings, NOT the irradiance disc (which is the day's
    //overall reading, no past / future concept) and NOT the dial track (structural).
    const cloudMidR     = (R_CLOUD_INNER + R_CLOUD_OUTER) / 2;
    const prodMidR      = (R_PROD_INNER  + R_PROD_OUTER)  / 2;
    const battMidR      = (R_BATT_INNER  + R_BATT_OUTER)  / 2;
    const cloudTrackPast    = buildRingArcPath(cloudMidR, 0, pastEndHour);
    const cloudTrackFuture  = buildRingArcPath(cloudMidR, pastEndHour, 24);
    const prodTrackPast     = data.hasPv      ? buildRingArcPath(prodMidR, 0, pastEndHour) : '';
    const prodTrackFuture   = data.hasPv      ? buildRingArcPath(prodMidR, pastEndHour, 24) : '';
    const battTrackPast     = data.hasBattery ? buildRingArcPath(battMidR, 0, pastEndHour) : '';
    const battTrackFuture   = data.hasBattery ? buildRingArcPath(battMidR, pastEndHour, 24) : '';

    //Full-day production-forecast outline. The dashed forecast curve runs across the whole day
    //(past + future) so the user can compare the model's prediction against the realised
    //production hour-by-hour at a glance.
    const prodForecastOutlinePath = data.hasPv && hourlyForecast.some(v => v !== null)
        ? buildRadialOutlinePath(hourlyForecast, prodScaleMax, R_PROD_INNER, R_PROD_OUTER, 0, 24)
        : '';

    //Collapsed counterpart paths for the day-load grow animation. Each per-hour curve has a "from"
    //version with all values forced to 0, so the annulus visibly collapses to the ring's inner
    //edge. SMIL animates the d attribute from the collapsed string to the real string, the visual
    //is each curve growing within its OWN annulus from inner to outer instead of the previous
    //scale-from-centre puff (which expanded everything from a single point and looked rough).
    const zeroArrSteps: (number | null)[] = new Array(STEPS_PER_DAY).fill(0);
    const fromProdPast            = pastEndHour > 0  ? buildRadialAnnulusPath(zeroArrSteps, prodScaleMax,  R_PROD_INNER,  R_PROD_OUTER)  : '';
    const fromProdFutureFill      = pastEndHour < 24 ? buildRadialAnnulusPath(zeroArrSteps, prodScaleMax,  R_PROD_INNER,  R_PROD_OUTER)  : '';
    const fromProdForecastOutline = prodForecastOutlinePath ? buildRadialOutlinePath(zeroArrSteps, prodScaleMax,  R_PROD_INNER,  R_PROD_OUTER,  0, 24) : '';
    const fromBattCharge          = pastEndHour > 0  ? buildRadialAnnulusPath(zeroArrSteps, battScaleMax,  R_BATT_INNER,  R_BATT_OUTER)  : '';
    const fromBattDischarge       = pastEndHour > 0  ? buildRadialAnnulusPath(zeroArrSteps, battScaleMax,  R_BATT_INNER,  R_BATT_OUTER)  : '';
    const fromCloudPast           = pastEndHour > 0  ? buildRadialAnnulusPath(zeroArrSteps, cloudScaleMax, R_CLOUD_INNER, R_CLOUD_OUTER) : '';
    const fromCloudFutureFill     = pastEndHour < 24 ? buildRadialAnnulusPath(zeroArrSteps, cloudScaleMax, R_CLOUD_INNER, R_CLOUD_OUTER) : '';
    const fromCloudFuture         = pastEndHour < 24 ? buildRadialOutlinePath(zeroArrSteps, cloudScaleMax, R_CLOUD_INNER, R_CLOUD_OUTER, floorPastH, 24) : '';
    const fromIrrPast             = pastEndHour > 0  ? buildRadialAnnulusPath(zeroArrSteps, IRR_SCALE_MAX_WM2, R_CLOUD_INNER, R_CLOUD_OUTER) : '';
    const fromIrrFutureFill       = pastEndHour < 24 ? buildRadialAnnulusPath(zeroArrSteps, IRR_SCALE_MAX_WM2, R_CLOUD_INNER, R_CLOUD_OUTER) : '';
    const fromIrrFuture           = pastEndHour < 24 ? buildRadialOutlinePath(zeroArrSteps, IRR_SCALE_MAX_WM2, R_CLOUD_INNER, R_CLOUD_OUTER, floorPastH, 24) : '';
    const ANIM_DUR = '700ms';

    //Hover cursor: only on the front card AND only when the host carries a hover hour set by the
    //pointermove handler below. Same shape as the now cursor but in secondary text colour so the
    //two read as a layered pair when the user hovers over the live day.
    const hoverHour = isFront ? host._dashRadialHoverHour : null;
    const hoverActive = (hoverHour !== null && hoverHour !== undefined);
    //Sun disc tracks the hovered hour while hovering. Use the same fixed IRR_SCALE_MAX_WM2 scale as
    //the cloud-ring overlay so the radius the user sees on the central disc lines up consistently
    //with the irradiance curve on the ring (a noon clear-sky hour drives both to ~90 % of their
    //ring, an overcast hour collapses both to near zero). Null sample (recorder gap on a past
    //card, future hour beyond the forecast horizon) falls back to the daily mean already in
    //sunFillRatio.
    if (hoverActive)
    {
        const hoveredIrrW = interpAtHour(hourlyIrr, hoverHour as number);
        if (hoveredIrrW !== null)
        {
            sunFillRatio = Math.max(0, Math.min(1, hoveredIrrW / IRR_SCALE_MAX_WM2));
        }
    }
    const hoverCursor = hoverActive
        ? `M ${polarPt(hoverHour as number, R_CURSOR_INNER)[0].toFixed(2)} ${polarPt(hoverHour as number, R_CURSOR_INNER)[1].toFixed(2)} L ${polarPt(hoverHour as number, R_CURSOR_OUTER)[0].toFixed(2)} ${polarPt(hoverHour as number, R_CURSOR_OUTER)[1].toFixed(2)}`
        : '';

    //Now cursor: only on TODAY's card (cardOffset === 0). Same solar-ray vocabulary as the hover
    //cursor (sun-coloured + dashed) and same endpoints, the user reads the now cursor as the
    //live wall-clock pointer and the hover cursor as the pointer-driven inspection cursor. Both
    //rendered at the same time on today's card during a hover so the visual is a paired set of
    //rays: one fixed at the current hour, one tracking the user's pointer.
    const showNowCursorRay = cardOffset === 0;
    const nowHour = showNowCursorRay ? currentHourFraction() : -1;
    const nowCursor = showNowCursorRay
        ? `M ${polarPt(nowHour, R_CURSOR_INNER)[0].toFixed(2)} ${polarPt(nowHour, R_CURSOR_INNER)[1].toFixed(2)} L ${polarPt(nowHour, R_CURSOR_OUTER)[0].toFixed(2)} ${polarPt(nowHour, R_CURSOR_OUTER)[1].toFixed(2)}`
        : '';

    //Hover spheres: one on each curve at the hover-hour radius. The radius interpolates between
    //adjacent hour samples so the sphere slides smoothly along the curve as the cursor moves. Each
    //sphere is a small circle (4 viewBox units) filled with a per-curve radial gradient that
    //simulates a light source at the upper-left, giving the dot a 3D ball look rather than the
    //flat-disc look of a plain <circle> + solid fill.
    const interpRadius = (values: ReadonlyArray<number | null>, scaleMax: number, innerR: number, outerR: number, hour: number): number =>
    {
        const N      = values.length;
        const step   = hour * N / 24;
        const iWhole = Math.floor(step) % N;
        const f      = step - Math.floor(step);
        const v      = values[iWhole];
        const next   = values[(iWhole + 1) % N];
        const r      = v === null    ? innerR : innerR + Math.max(0, Math.min(1, v    / scaleMax)) * (outerR - innerR);
        const rNext  = next === null ? innerR : innerR + Math.max(0, Math.min(1, next / scaleMax)) * (outerR - innerR);
        return r + (rNext - r) * f;
    };
    let hoverProdDot:  { x: number; y: number } | null = null;
    let hoverBattDot:  { x: number; y: number; charging: boolean } | null = null;
    let hoverCloudDot: { x: number; y: number } | null = null;
    let hoverIrrDot:   { x: number; y: number } | null = null;
    if (hoverActive)
    {
        const hf  = hoverHour as number;
        const idx = Math.max(0, Math.min(STEPS_PER_DAY - 1, Math.floor(hf * STEPS_PER_HOUR)));
        const prodVal  = hourlyProd[idx];
        const battVal  = hourlyBatt[idx];
        const cloudVal = hourlyCloud[idx];
        const irrVal   = hourlyIrr[idx];
        //Equipment-gated dots: prod / batt dots only appear when the matching ring is present in
        //the layout, so we don't paint a stray dot floating in the cloud / irradiance span when the
        //user has no PV or no battery configured. Cloud + irradiance dots always render.
        if (data.hasPv && prodVal !== null) { const r = interpRadius(hourlyProd,  prodScaleMax,  R_PROD_INNER, R_PROD_OUTER, hf); const [x, y] = polarPt(hf, r); hoverProdDot  = { x, y }; }
        if (cloudVal !== null) { const r = interpRadius(hourlyCloud, cloudScaleMax, R_CLOUD_INNER, R_CLOUD_OUTER, hf); const [x, y] = polarPt(hf, r); hoverCloudDot = { x, y }; }
        if (irrVal   !== null) { const r = interpRadius(hourlyIrr,   IRR_SCALE_MAX_WM2, R_CLOUD_INNER, R_CLOUD_OUTER, hf); const [x, y] = polarPt(hf, r); hoverIrrDot = { x, y }; }
        if (data.hasBattery && battVal !== null)
        {
            //Show the dot at every hovered hour the curve has a sample for, even idle hours where
            //the battery is at 0. At 0 the dot lands on the ring's inner edge (the zero baseline
            //both annulus paths share), so the user always sees where the cursor crosses the curve.
            const absSeries: ReadonlyArray<number | null> = hourlyBatt.map(v => (v === null ? null : Math.abs(v)));
            const r = interpRadius(absSeries, battScaleMax, R_BATT_INNER, R_BATT_OUTER, hf);
            const [x, y] = polarPt(hf, r);
            hoverBattDot = { x, y, charging: battVal >= 0 };
        }
    }

    //Sub-hour subdivision ticks. 96 positions around the dial (15 min step). Three lengths so the eye
    //snaps to the hour ticks first (longest + bolder), then the halves, then the quarters. All ticks
    //live near the INNER edge of the annulus, the outer edge stays clean to give the digits clearance.
    //Hour ticks sit just below the digit at the same angular position, the digit + tick read as one
    //paired hour anchor.
    const tickLines: TemplateResult[] = [];
    for (let q = 0; q < 96; q++)
    {
        const hour   = q / 4;
        const isHour = q % 4 === 0;
        const isHalf = !isHour && q % 2 === 0;
        const innerInnerR = isHour ? R_TICK_INNER_HOUR
                          : isHalf ? R_TICK_INNER_HALF
                          :          R_TICK_INNER_QUARTER;
        const cls = isHour ? 'dash-radial-tick-hour'
                  : isHalf ? 'dash-radial-tick-half'
                  :          'dash-radial-tick-quarter';
        const [ix1, iy1] = polarPt(hour, R_TICK_INNER_END);
        const [ix2, iy2] = polarPt(hour, innerInnerR);
        tickLines.push(svg`<line class="${cls}" x1="${ix1.toFixed(2)}" y1="${iy1.toFixed(2)}" x2="${ix2.toFixed(2)}" y2="${iy2.toFixed(2)}"/>`);
    }

    //Hour labels rendered as an HTML overlay OUTSIDE the SVG (not as SVG <text>). SVG content
    //gets scaled by the viewBox / display ratio, so SVG text font-size in CSS px ends up scaled
    //too: huge in panel-view, microscopic in section view. Pulling the labels into an absolutely
    //positioned HTML overlay decouples them from the SVG transform and the font-size is just
    //plain CSS pixels, the HA frontend body token applies cleanly regardless of how the SVG
    //resizes. The overlay container is sized to match the SVG (min(100 %, 92 %) width +
    //aspect-ratio 1 / 1, centred via the wrap's flex-centre) so the per-hour percentage
    //positions land on the same circle the SVG ticks anchor to.
    const labelRadiusPct = (R_HOUR_LABEL / VIEWBOX) * 100;
    const hourLabelsHtml: TemplateResult[] = [];
    //Hour labels around the dial: one per HOUR (not per bucket). The bucket bump took the underlying
    //data resolution from 1 / hour to 1 / 5 min, but the dial chrome is still a 24-position analog
    //clock face, so this loop has to stay at 24 regardless of STEPS_PER_DAY.
    for (let h = 0; h < 24; h++)
    {
        const alpha = ((h - 12) / 12) * Math.PI;
        const leftPct = 50 + labelRadiusPct * Math.sin(alpha);
        const topPct  = 50 - labelRadiusPct * Math.cos(alpha);
        const rotation = ((h - 12) % 24) * 15;
        const lbl     = formatDialHourLabel(h, host.hass);
        hourLabelsHtml.push(html`<span class="dash-radial-hour-label" style="left: ${leftPct.toFixed(2)}%; top: ${topPct.toFixed(2)}%; transform: translate(-50%, -50%) rotate(${rotation.toFixed(2)}deg);">${lbl}</span>`);
    }

    //Pointer handlers (front card only). Imperative because every pointermove on a multi-second
    //hover would otherwise rebuild the whole template; here we set the host's hover hour and call
    //requestUpdate so Lit batches the render at the next microtask, which is fast enough at the
    //single-svg granularity to feel live.
    const setHoverFromEvent = (e: PointerEvent): void =>
    {
        const svgEl = (e.currentTarget as SVGSVGElement | null);
        if (!svgEl) { return; }
        const hf = pointerToHourFraction(svgEl, e.clientX, e.clientY);
        host._dashRadialHoverHour = hf;
        host.requestUpdate();
    };
    const onPointerMove = isFront ? (e: PointerEvent) => setHoverFromEvent(e) : undefined;
    //Touch + pen taps fire pointerdown without a prior pointermove, on a phone the user needs the
    //cursor to land where the finger tapped without having to drag. Mouse pointerdown also lands
    //here and behaves the same (clicking inside the dial parks the hover ray at that hour), which
    //is a useful affordance even on desktop.
    const onPointerDown = isFront ? (e: PointerEvent) => setHoverFromEvent(e) : undefined;
    //pointerleave on touch fires the instant the finger lifts off the screen, which would clear the
    //hover the user just set by tapping. Gate the clear on mouse pointers only so a touch tap leaves
    //the cursor in place after the finger leaves the surface. Mouse drift off the dial keeps clearing
    //the cursor as before.
    const onPointerLeave = isFront ? (e: PointerEvent) =>
    {
        if (e.pointerType !== 'mouse') { return; }
        host._dashRadialHoverHour = null;
        host.requestUpdate();
    } : undefined;
    //Desktop wheel-scroll over the front card cycles through the day offsets, scroll-down advances
    //one day forward, scroll-up moves back one day. Wheel events are throttled by accumulating the
    //deltaY value, so a continuous trackpad swipe doesn't fire dozens of navigations per second.
    const onWheel = isFront ? (e: WheelEvent) =>
    {
        e.preventDefault();
        const acc = (host._dashRadialWheelAcc ?? 0) + e.deltaY;
        const THRESHOLD = 60;
        if (Math.abs(acc) >= THRESHOLD)
        {
            const dir = acc > 0 ? 1 : -1;
            host._dashRadialWheelAcc = 0;
            navigateDashDay(host, (host._dashDayOffset ?? 0) + dir);
        }
        else
        {
            host._dashRadialWheelAcc = acc;
        }
    } : undefined;

    //Hour overlay (top-left of the radial card). Live wall-clock by default on today's card,
    //hovered hour while the user hovers the dial. Hidden on past / future cards with no active
    //hover so the corner stays clean when there is nothing meaningful to show.
    const isToday    = cardOffset === 0;
    const showHour   = isFront && (hoverActive || isToday);
    const hourText   = !showHour ? '' : hoverActive
        ? formatHoverClock(hoverHour as number, host.hass)
        : formatHoverClock(currentHourFraction(), host.hass);

    //Irradiance halo + fill: their radii track sunFillRatio, the daily-mean ratio when no hover is
    //active and the hovered hour's instantaneous irradiance ratio when the user is over the dial.
    //At 0 % the halo collapses to the rim (invisible behind the disc), at 100 % it reaches
    //R_SUN_HALO_MAX which is the pre-shrink sun-disc envelope. A radial gradient fades the glow to
    //fully transparent at the outer edge so it blends into the cloud ring instead of cutting a
    //hard circle.
    const haloR    = R_SUN_REF + (R_SUN_HALO_MAX - R_SUN_REF) * sunFillRatio;
    const sunFillR = R_SUN_REF * sunFillRatio;
    //Per-card gradient id so multiple CoverFlow cards on the same page never collide.
    const haloGradId = `dash-radial-sun-halo-${cardOffset}`;

    //Sunrise / sunset corner overlays. Fixed to the selected day's horizon crossings (no
    //hover-driven update), so the user always sees the day's daylight window read straight off
    //the card. Skipped on polar day / polar night when findSunriseSunset returns null. Same
    //typography family as the top-left clock overlay (HA frontend body token, secondary text
    //colour, tabular nums for the time numerals).
    const sunriseText = sunRiseSet.sunrise !== null ? formatHoverClock(sunRiseSet.sunrise, host.hass) : '';
    const sunsetText  = sunRiseSet.sunset  !== null ? formatHoverClock(sunRiseSet.sunset,  host.hass) : '';

    //"Back to live" button. Shown only on the front card when a hover hour is parked (the cursor on
    //touch screens has no implicit "move away to clear" gesture, so a tap target is the only way out).
    //Sits top-right, mirroring the top-left clock chip, bottom-left sunrise and bottom-right sunset
    //overlays so the four corners read as a paired set. Clearing the hover and requesting an update
    //here is enough, the next render naturally drops the cursor + hover dots and rolls the chip strip
    //back to its live values.
    const tDial            = pickTranslations(host.hass?.language);
    const backToLiveLabel  = tDial.detail.radialBackToLive ?? 'Back to live';
    const showBackToLive   = isFront && hoverActive;
    const onBackToLiveClick = (e: Event): void =>
    {
        e.stopPropagation();
        host._dashRadialHoverHour = null;
        host.requestUpdate();
    };

    return html`
        <ha-card class="dash-radial-wrap" @wheel="${onWheel}">
            ${showHour ? html`<span class="dash-radial-hour-text"><ha-icon icon="mdi:clock-outline"></ha-icon><span>${hourText}</span></span>` : nothing}
            ${showBackToLive ? html`<button
                class="dash-radial-back-to-live"
                type="button"
                @click="${onBackToLiveClick}"
                @pointerdown="${(e: Event) => e.stopPropagation()}"
                aria-label="${backToLiveLabel}"
                title="${backToLiveLabel}"
            ><ha-icon icon="mdi:clock-fast"></ha-icon><span>Live</span></button>` : nothing}
            ${sunriseText ? html`<span class="dash-radial-hour-text dash-radial-hour-text-sunrise"><ha-icon icon="mdi:weather-sunset-up"></ha-icon><span>${sunriseText}</span></span>` : nothing}
            ${sunsetText ? html`<span class="dash-radial-hour-text dash-radial-hour-text-sunset"><ha-icon icon="mdi:weather-sunset-down"></ha-icon><span>${sunsetText}</span></span>` : nothing}
            <div class="dash-radial-hour-labels" aria-hidden="true">${hourLabelsHtml}</div>
            ${keyed(isFront ? `f-${dayStartMs}` : `b-${cardOffset}`, html`<svg
                class="dash-radial-svg"
                viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"
                preserveAspectRatio="xMidYMid meet"
                @pointerdown="${onPointerDown}"
                @pointermove="${onPointerMove}"
                @pointerleave="${onPointerLeave}"
            >
                <defs>
                    <radialGradient id="${haloGradId}">
                        <stop offset="0%"   stop-color="var(--helios-sun-color, var(--amber-color, #f59e0b))" stop-opacity="0.55"/>
                        <stop offset="100%" stop-color="var(--helios-sun-color, var(--amber-color, #f59e0b))" stop-opacity="0"/>
                    </radialGradient>
                </defs>

                <!-- Ring tracks split into past + future arcs. Past arcs sit at full opacity, the
                     not-yet-elapsed half of every data ring is painted faded so the background of
                     the ring reads as already-happened (full strength) vs not-yet-happened (low
                     opacity). The dial track is a single circle since it has no past / future
                     concept (structural). All tracks paint with vector-effect: non-scaling-stroke
                     via CSS so the apparent ring thickness stays constant regardless of how the
                     SVG scales in panel-view vs section-view dashboards. -->
                ${cloudTrackPast   ? svg`<path class="dash-radial-cloud-track"        d="${cloudTrackPast}"   fill="none" stroke-width="${R_CLOUD_OUTER - R_CLOUD_INNER}"/>` : nothing}
                ${cloudTrackFuture ? svg`<path class="dash-radial-cloud-track-future" d="${cloudTrackFuture}" fill="none" stroke-width="${R_CLOUD_OUTER - R_CLOUD_INNER}"/>` : nothing}
                ${prodTrackPast    ? svg`<path class="dash-radial-prod-track"         d="${prodTrackPast}"    fill="none" stroke-width="${R_PROD_OUTER  - R_PROD_INNER}"/>`  : nothing}
                ${prodTrackFuture  ? svg`<path class="dash-radial-prod-track-future"  d="${prodTrackFuture}"  fill="none" stroke-width="${R_PROD_OUTER  - R_PROD_INNER}"/>`  : nothing}
                ${battTrackPast    ? svg`<path class="dash-radial-batt-track"         d="${battTrackPast}"    fill="none" stroke-width="${R_BATT_OUTER  - R_BATT_INNER}"/>`  : nothing}
                ${battTrackFuture  ? svg`<path class="dash-radial-batt-track-future"  d="${battTrackFuture}"  fill="none" stroke-width="${R_BATT_OUTER  - R_BATT_INNER}"/>`  : nothing}
                <circle class="dash-radial-dial-track"  cx="${CENTER}" cy="${CENTER}" r="${(R_DIAL_INNER  + R_DIAL_OUTER)  / 2}"
                        fill="none" stroke-width="${R_DIAL_OUTER - R_DIAL_INNER}"/>

                <!-- Per-element day-load grow animation. Each ring / circle holds its own SMIL
                     <animate> tag that interpolates its d (for paths) or r (for circles) from a
                     collapsed-to-inner-edge "from" state to the real value, the visual is that
                     every curve grows within its OWN annulus from the inner edge outward instead
                     of the previous scale-from-centre puff. Triggered on day-load via the keyed()
                     re-mount, all animates start at begin="0s" so the day's data layer fans out
                     together. -->

                <!-- Night-period arc in the dial annulus. Static (no day-load animation): the
                     night zone is a structural reference for the day's daylight window, the user
                     reads it independently of the curve grow animation. -->
                ${nightPath ? svg`<path class="dash-radial-night" d="${nightPath}"/>` : nothing}

                <!-- Past fills (annulus shapes between the ring inner edge and the per-hour
                     curve) painted via the evenodd fill rule. Future outlines are a polyline
                     along the data curve at the variable outer radius, no fill. Painted inside
                     out so the outer rings stay on top. -->
                ${cloudPastPath ? svg`<path class="dash-radial-cloud-fill" fill-rule="evenodd" d="${cloudPastPath}">
                    <animate attributeName="d" from="${fromCloudPast}" to="${cloudPastPath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                ${cloudFutureFillPath ? svg`<path class="dash-radial-cloud-fill-future" fill-rule="evenodd" d="${cloudFutureFillPath}">
                    <animate attributeName="d" from="${fromCloudFutureFill}" to="${cloudFutureFillPath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                ${cloudFuturePath ? svg`<path class="dash-radial-cloud-future" d="${cloudFuturePath}">
                    <animate attributeName="d" from="${fromCloudFuture}" to="${cloudFuturePath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                <!-- Irradiance overlay on the SAME cloud ring annulus, sun-tinted so the eye reads
                     "sunny" vs "cloudy" by hue. Painted AFTER the cloud layers so the sun tint sits
                     on top, the semi-transparent fill lets the cloud grey show through where both
                     curves rise together, matches the timeline UI where both curves share the same
                     X axis at low alphas. -->
                ${irrPastPath ? svg`<path class="dash-radial-irr-fill" fill-rule="evenodd" d="${irrPastPath}">
                    <animate attributeName="d" from="${fromIrrPast}" to="${irrPastPath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                ${irrFutureFillPath ? svg`<path class="dash-radial-irr-fill-future" fill-rule="evenodd" d="${irrFutureFillPath}">
                    <animate attributeName="d" from="${fromIrrFutureFill}" to="${irrFutureFillPath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                ${irrFuturePath ? svg`<path class="dash-radial-irr-future" d="${irrFuturePath}">
                    <animate attributeName="d" from="${fromIrrFuture}" to="${irrFuturePath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                ${prodPastPath ? svg`<path class="dash-radial-prod-fill" fill-rule="evenodd" d="${prodPastPath}">
                    <animate attributeName="d" from="${fromProdPast}" to="${prodPastPath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                ${prodFutureFillPath ? svg`<path class="dash-radial-prod-fill-future" fill-rule="evenodd" d="${prodFutureFillPath}">
                    <animate attributeName="d" from="${fromProdFutureFill}" to="${prodFutureFillPath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                ${prodForecastOutlinePath ? svg`<path class="dash-radial-prod-future" d="${prodForecastOutlinePath}">
                    <animate attributeName="d" from="${fromProdForecastOutline}" to="${prodForecastOutlinePath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                ${battChargePath ? svg`<path class="dash-radial-batt-charge" fill-rule="evenodd" d="${battChargePath}">
                    <animate attributeName="d" from="${fromBattCharge}" to="${battChargePath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}
                ${battDischargePath ? svg`<path class="dash-radial-batt-discharge" fill-rule="evenodd" d="${battDischargePath}">
                    <animate attributeName="d" from="${fromBattDischarge}" to="${battDischargePath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>` : nothing}

                <!-- Sun: halo + bg + irradiance fill + rim. Only the data-driven layers animate:
                     halo + bg + the variable-radius fill all inflate from r=0 on day load. The
                     reference rim is structural (the irradiance scale anchor) and stays at its
                     final radius from the start so the user always sees the reference circle, the
                     fill animates inside it as the day's irradiance reading flowing toward the
                     reference. -->
                <circle class="dash-radial-sun-halo" cx="${CENTER}" cy="${CENTER}" r="${haloR.toFixed(2)}" fill="url(#${haloGradId})">
                    <animate attributeName="r" from="0" to="${haloR.toFixed(2)}" dur="${ANIM_DUR}" begin="0s" fill="remove"/>
                </circle>
                <circle class="dash-radial-sun-bg" cx="${CENTER}" cy="${CENTER}" r="${R_SUN_REF}">
                    <animate attributeName="r" from="0" to="${R_SUN_REF}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </circle>
                <!-- fill="remove" on the halo + the irradiance fill so the day-load grow animation
                     hands control back to the static r attribute when it ends, and subsequent hover
                     updates can re-target the radius to the hovered hour's irradiance. The sun-bg
                     ref disc keeps fill="freeze" because its radius never changes after mount. -->
                <circle class="dash-radial-sun-fill" cx="${CENTER}" cy="${CENTER}" r="${sunFillR.toFixed(2)}">
                    <animate attributeName="r" from="0" to="${sunFillR.toFixed(2)}" dur="${ANIM_DUR}" begin="0s" fill="remove"/>
                </circle>
                <circle class="dash-radial-sun-rim" cx="${CENTER}" cy="${CENTER}" r="${R_SUN_REF}" fill="none"/>
                <!-- Theme-text outline circle just outside the irradiance reference rim. Same colour
                     family as the data-ring borders so the sun-disc edge reads as a delimited
                     boundary instead of bleeding into the cloud + irradiance fills around it. -->
                <circle class="dash-radial-ring-border" cx="${CENTER}" cy="${CENTER}" r="${R_SUN_REF + 0.4}" fill="none"/>

                <!-- Sunrise / sunset bars: a sun-coloured radial stroke spanning the full width
                     of the dial annulus at the exact hour of sun crossing. Drawn AFTER the night
                     arc + ticks so the bar lays on top of both as a single bold visual cue, the
                     user reads the bar as a horizon-crossing line rather than as decoration. -->
                ${sunRiseSet.sunrise !== null ? (() =>
                {
                    const [x1, y1] = polarPt(sunRiseSet.sunrise, R_DIAL_INNER);
                    const [x2, y2] = polarPt(sunRiseSet.sunrise, R_DIAL_OUTER);
                    return svg`<line class="dash-radial-sun-bar" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
                })() : nothing}
                ${sunRiseSet.sunset !== null ? (() =>
                {
                    const [x1, y1] = polarPt(sunRiseSet.sunset, R_DIAL_INNER);
                    const [x2, y2] = polarPt(sunRiseSet.sunset, R_DIAL_OUTER);
                    return svg`<line class="dash-radial-sun-bar" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
                })() : nothing}

                <!-- Thin border lines on every annulus boundary, one at the inner edge and one at
                     the outer edge of each ring. Sit just outside the data fills so a curve
                     collapsing to the inner edge (the 0-value case) does not bleed past the boundary
                     visually. -->
                <circle class="dash-radial-ring-border" cx="${CENTER}" cy="${CENTER}" r="${R_CLOUD_INNER}" fill="none"/>
                <circle class="dash-radial-ring-border" cx="${CENTER}" cy="${CENTER}" r="${R_CLOUD_OUTER}" fill="none"/>
                <circle class="dash-radial-ring-border" cx="${CENTER}" cy="${CENTER}" r="${R_PROD_INNER}"  fill="none"/>
                <circle class="dash-radial-ring-border" cx="${CENTER}" cy="${CENTER}" r="${R_PROD_OUTER}"  fill="none"/>
                <circle class="dash-radial-ring-border" cx="${CENTER}" cy="${CENTER}" r="${R_BATT_INNER}"  fill="none"/>
                <circle class="dash-radial-ring-border" cx="${CENTER}" cy="${CENTER}" r="${R_BATT_OUTER}"  fill="none"/>
                <circle class="dash-radial-ring-border" cx="${CENTER}" cy="${CENTER}" r="${R_DIAL_INNER}"  fill="none"/>
                <circle class="dash-radial-ring-border" cx="${CENTER}" cy="${CENTER}" r="${R_DIAL_OUTER}"  fill="none"/>

                <!-- Sundial perimeter: quarter-hour ticks. Hour labels are rendered as an HTML
                     overlay siblings of this SVG so the font-size stays constant in CSS pixels
                     regardless of how the SVG scales between section-view and panel-view. -->
                ${tickLines}

                <!-- Hover cursor (any front card with an active hover hour) + now cursor (today's
                     card only). Both painted with the same solar-ray vocabulary (sun colour,
                     5-5 dash, opacity 0.55) so the rays read as a paired set, the now cursor
                     anchors the current wall-clock hour and the hover cursor tracks the pointer
                     when present. -->
                <!-- Cursor rays. Thin solid lines in the HA primary text colour (white on dark
                     theme, black on light), the now cursor at slightly higher stroke-width + opacity
                     so it carries more weight than a passing hover ray. -->
                ${nowCursor ? svg`<path class="dash-radial-cursor-hover dash-radial-cursor-now" d="${nowCursor}"/>` : nothing}
                ${hoverCursor ? svg`<path class="dash-radial-cursor-hover" d="${hoverCursor}"/>` : nothing}

                <!-- Hover dots: one per data ring at the hover-hour value. Top layer so they are
                     always visible above the curves. Plain colored disc with a thin contrast stroke,
                     no gradient, just slightly thicker than the timeline hover dots. -->
                ${hoverCloudDot ? svg`<circle class="dash-radial-dot dash-radial-dot-cloud" cx="${hoverCloudDot.x.toFixed(2)}" cy="${hoverCloudDot.y.toFixed(2)}" r="3"/>` : nothing}
                ${hoverIrrDot   ? svg`<circle class="dash-radial-dot dash-radial-dot-irr"   cx="${hoverIrrDot.x.toFixed(2)}"   cy="${hoverIrrDot.y.toFixed(2)}"   r="3"/>` : nothing}
                ${hoverProdDot  ? svg`<circle class="dash-radial-dot dash-radial-dot-prod"  cx="${hoverProdDot.x.toFixed(2)}"  cy="${hoverProdDot.y.toFixed(2)}"  r="3"/>` : nothing}
                ${hoverBattDot  ? svg`<circle class="dash-radial-dot ${hoverBattDot.charging ? 'dash-radial-dot-batt-charge' : 'dash-radial-dot-batt-discharge'}" cx="${hoverBattDot.x.toFixed(2)}" cy="${hoverBattDot.y.toFixed(2)}" r="3"/>` : nothing}
            </svg>`)}
        </ha-card>
    `;
}


//Scrub-time chip readers. The chip strips show LIVE values for the entity behind each tile: when
//the user parks the cursor at a past instant, the chip MUST show what Home Assistant actually
//recorded at that instant, not what the data source interpolated for that bucket. The store is
//never lying (gaps are filled between real samples), but a chip is an entity readout and the user
//expects it to track the sensor directly. So these readers go straight to the raw HA history
//(_pvHistory + _pvCalibStats for production, _batteryPowerHistory for battery, _chartSeries for
//Open-Meteo weather), bypassing the store entirely. Future instants resolve to null since the raw
//sources have no future samples; the chip renders "—" in that case.
function chipScrubProductionW(host: DashboardHost, targetMs: number): number | null
{
    //Reuse the timeline tooltip's HA-direct PV reader (raw window + LTS fallback) and reject the
    //forecast fallback branch so the chip never blends a modelled W into a "real production" value.
    const r = pvValueAtTime(host as unknown as ChartHost, targetMs);
    if (r.isPredicted || !isFinite(r.value)) { return null; }
    //pvValueAtTime returns the value in the entity's native unit (kW, W, MW); the chip strip's
    //formatW helper expects W, so convert back via pvNormalizeToWatts with the entity unit. The
    //isCumulative branch in pvValueAtTime already differentiated to power, the unit string carries
    //the resulting unit (kW for kWh, W for Wh, etc.).
    const unitForNormalize = r.unit || host._pvUnit || '';
    const w = pvNormalizeToWatts(r.value, unitForNormalize);
    return isFinite(w) ? w : null;
}

function chipScrubBatteryW(host: DashboardHost, targetMs: number): number | null
{
    const hist = host._batteryPowerHistory;
    if (!hist || hist.times.length < 2) { return null; }
    const firstMs = hist.times[0].getTime();
    const lastMs  = hist.times[hist.times.length - 1].getTime();
    if (targetMs < firstMs || targetMs > lastMs) { return null; }
    const v = interpAt(hist.times, hist.values, targetMs);
    if (!isFinite(v)) { return null; }
    const w = pvNormalizeToWatts(v, host._batteryPowerUnit);
    return isFinite(w) ? w : null;
}

function chipScrubWeather(host: DashboardHost, field: 'cloud' | 'irradiance', targetMs: number): number | null
{
    const series = host._chartSeries;
    if (!series || series.times.length < 2) { return null; }
    const arr = field === 'cloud' ? series.cloud : series.irradiance;
    const v   = interpAt(series.times, arr, targetMs);
    return isFinite(v) ? v : null;
}


//Linear interpolation between adjacent hourly samples, indexed by hour fraction. Returns null
//when neither neighbour has a sample so the calling badge can fall back to its label rather than
//show a stray zero. Used by the chip strips so the hovered value flows smoothly between hourly
//grid points instead of snapping at every full hour.
function interpAtHour(arr: ReadonlyArray<number | null>, hf: number): number | null
{
    if (hf < 0) { hf = 0; }
    if (hf > 23.9999) { hf = 23.9999; }
    const N    = arr.length;
    if (N < 2) { return arr[0] ?? null; }
    const step = hf * N / 24;
    const i0   = Math.floor(step);
    const f    = step - i0;
    const v0 = arr[i0];
    const v1 = arr[Math.min(N - 1, i0 + 1)];
    if (v0 === null && v1 === null) { return null; }
    if (v0 === null) { return v1; }
    if (v1 === null) { return v0; }
    return v0 + (v1 - v0) * f;
}


function formatWm2(hass: { language?: string } | undefined, w: number | null): string
{
    if (w === null || !Number.isFinite(w)) { return '—'; }
    return `${formatLocalisedNumber(hass as any, Math.round(w), 0)} W/m²`;
}


function formatKwh(hass: { language?: string } | undefined, kwh: number | null): string
{
    if (kwh === null || !Number.isFinite(kwh)) { return '—'; }
    return `${formatLocalisedNumber(hass as any, kwh, 1)} kWh`;
}


//Day-aggregate helpers used as the chip-strip default values when the user is not hovering the
//radial dial. dailyMean ignores null buckets and returns the mean of the rest, dailyEnergyKwh
//sums hourly Watts back into Watt-hours then divides by 1000 for kWh, treating null buckets as
//zero (a null hour is "no data" not "zero production", so we skip it from the divisor for mean
//but include it as 0 for the energy sum so the running total never silently jumps when a single
//bucket is missing).
function dailyMean(arr: ReadonlyArray<number | null>): number | null
{
    let s = 0, c = 0;
    for (const v of arr) { if (v !== null) { s += v; c++; } }
    return c > 0 ? s / c : null;
}


function dailyEnergyKwh(arr: ReadonlyArray<number | null>): number | null
{
    let s = 0, hasData = false;
    for (const v of arr) { if (v !== null) { s += v; hasData = true; } }
    //Each bucket carries the mean power over a (24 / arr.length)-hour window. Total Wh = sum of
    //bucket-means times the bucket length in hours, divide by 1000 for kWh. Stays invariant to the
    //cadence: the day's kWh is unchanged whether the underlying granularity is 1 / hour or 60 / hour.
    if (!hasData || arr.length === 0) { return null; }
    const stepsPerHour = arr.length / 24;
    return s / stepsPerHour / 1000;
}


//Combined HA-tile-card-style chip strip rendered above the radial graph. Four mushroom-style
//badges in dial-radius order (Irradiance + Cloud = inner / model-derived values, then Production +
//Battery = outer / entity-driven values). Each badge mirrors the HA frontend tile-card layout:
//circular tinted icon disc on the left + a two-line stack on the right with the entity LABEL on
//top (always visible, primary text colour) and the live VALUE below (secondary text colour,
//hovered-hour interpolated value, falls back to "—" when the hover has no value to show for
//that badge or no active hover at all on a non-today card).
//
//The strip is a CSS grid: 2 columns when the .dash-cf-card width is narrow, 4 columns when it is
//wide enough to hold all four tiles on the same line. A @container query on .dash-cf-card drives
//the switch, the grid never falls back to 1 or 3 columns.
export function renderDashCardChipStrip(host: DashboardHost, cardOffset: number, activeOffset: number, data: RadialDayData): TemplateResult
{
    const isFront     = cardOffset === activeOffset;
    const hoverHour   = isFront ? host._dashRadialHoverHour : null;
    const hoverActive = hoverHour !== null && hoverHour !== undefined;
    //Chips read DIRECTLY from the Home Assistant raw history (and Open-Meteo for cloud / irradiance)
    //when the cursor is parked, never from the unified data source. The store is honest about gaps
    //(linearly interpolated between real samples), but the chip is an entity readout and must follow
    //the sensor itself: at instant t the chip shows what HA recorded at t, no store smoothing layer
    //in between. The store still drives the curve geometry on the dial, the chip is a separate path.
    const hoverMs     = hoverActive ? data.dayStartMs + (hoverHour as number) * HOUR_MS : 0;
    const irrW        = hoverActive ? chipScrubWeather(host, 'irradiance', hoverMs) : null;
    const cloudP      = hoverActive ? chipScrubWeather(host, 'cloud',      hoverMs) : null;
    const prodW       = hoverActive ? chipScrubProductionW(host, hoverMs)           : null;
    const battW       = hoverActive ? chipScrubBatteryW(host,    hoverMs)           : null;
    const t           = pickTranslations(host.hass?.language);

    const irrLabel   = t.detail.radialIrradianceLabel ?? 'Irradiance';
    const cloudLabel = t.detail.radialCloudLabel      ?? 'Cloud';
    const prodLabel  = t.detail.radialProductionLabel ?? 'Production';
    const battLabel  = t.detail.radialBatteryLabel    ?? 'Battery';

    //Daily aggregates shown when there is no active hover. Irradiance + cloud read as daily
    //means (W/m² and % both make sense as an averaged value), production reads as the day's
    //total energy in kWh (the same unit the tile-card production headline uses), battery reads
    //as the net daily energy in kWh (sum of charge minus discharge, positive when the battery
    //ended the day fuller than it started, negative when it ended emptier).
    const irrDailyMean   = dailyMean(data.hourlyIrr);
    const cloudDailyMean = dailyMean(data.hourlyCloud);
    //Exact recorder-change daily totals (computed in prepareRadialDayData) so the badge matches the
    //HA Energy dashboard to the watt-hour. battNetDailyKwh is in HA's Sources sign: discharge - charge
    //(negative when the battery net charged on the day).
    const prodDailyKwh   = data.prodDailyKwh;
    const battDailyKwh   = data.battNetDailyKwh;

    const irrValue = hoverActive
        ? (irrW === null ? '—' : formatWm2(host.hass, irrW))
        : (irrDailyMean === null ? '—' : formatWm2(host.hass, irrDailyMean));
    const cloudValue = hoverActive
        ? (cloudP === null ? '—' : formatPct(host.hass, cloudP))
        : (cloudDailyMean === null ? '—' : formatPct(host.hass, cloudDailyMean));
    const prodValue = hoverActive
        ? (prodW === null ? '—' : formatW(host.hass, prodW))
        : formatKwh(host.hass, prodDailyKwh);
    //Battery sign follows the HA Energy dashboard's Sources convention: discharge is positive (the
    //battery supplies energy), charge is negative (it consumes / stores). So the badge number matches
    //the HA "Batterie totale" figure sign-for-sign. The COLOUR still tracks the physical direction
    //(charge = battery-in tint, discharge = battery-out tint) regardless of the sign. Within ±0.5 W
    //(instant) or ±0.05 kWh (daily) the battery reads as flat so the badge does not flicker "+0"/"−0".
    let battValue: string;
    let battCls: string;
    if (hoverActive)
    {
        //battW is charge-positive instantaneous net power; charging shows "−", discharging shows "+".
        battValue = battW === null ? '—'
                  : Math.abs(battW) < 0.5 ? formatW(host.hass, 0)
                  : `${battW > 0 ? '−' : '+'} ${formatW(host.hass, Math.abs(battW))}`;
        battCls   = battW !== null && battW > 0.5  ? 'dash-radial-badge-batt-charge'
                  : battW !== null && battW < -0.5 ? 'dash-radial-badge-batt-discharge'
                  :                                  'dash-radial-badge-batt';
    }
    else
    {
        //battDailyKwh is already in HA's sign (discharge - charge); print it directly.
        battValue = battDailyKwh === null ? '—'
                  : Math.abs(battDailyKwh) < 0.05 ? formatKwh(host.hass, 0)
                  : `${battDailyKwh > 0 ? '+' : '−'} ${formatKwh(host.hass, Math.abs(battDailyKwh))}`;
        battCls   = battDailyKwh !== null && battDailyKwh < -0.05 ? 'dash-radial-badge-batt-charge'
                  : battDailyKwh !== null && battDailyKwh > 0.05  ? 'dash-radial-badge-batt-discharge'
                  :                                                 'dash-radial-badge-batt';
    }

    //Equipment-gated chip strip. Production + Battery chips only appear when the matching equipment
    //is configured. Cloud + Irradiance always render (they're weather data, not equipment-gated),
    //so the strip never collapses to fewer than 2 chips on a card.
    return html`
        <div class="dash-radial-chip-strip">
            <ha-card class="dash-radial-badge dash-radial-badge-irr">
                <span class="dash-radial-badge-chip"><ha-icon icon="mdi:white-balance-sunny"></ha-icon></span>
                <span class="dash-radial-badge-stack">
                    <span class="dash-radial-badge-label">${irrLabel}</span>
                    <span class="dash-radial-badge-value">${irrValue}</span>
                </span>
            </ha-card>
            <ha-card class="dash-radial-badge dash-radial-badge-cloud">
                <span class="dash-radial-badge-chip"><ha-icon icon="mdi:cloud"></ha-icon></span>
                <span class="dash-radial-badge-stack">
                    <span class="dash-radial-badge-label">${cloudLabel}</span>
                    <span class="dash-radial-badge-value">${cloudValue}</span>
                </span>
            </ha-card>
            ${data.hasPv ? html`
                <ha-card class="dash-radial-badge dash-radial-badge-prod">
                    <span class="dash-radial-badge-chip"><ha-icon icon="mdi:solar-power"></ha-icon></span>
                    <span class="dash-radial-badge-stack">
                        <span class="dash-radial-badge-label">${prodLabel}</span>
                        <span class="dash-radial-badge-value">${prodValue}</span>
                    </span>
                </ha-card>
            ` : nothing}
            ${data.hasBattery ? html`
                <ha-card class="dash-radial-badge ${battCls}">
                    <span class="dash-radial-badge-chip"><ha-icon icon="mdi:battery"></ha-icon></span>
                    <span class="dash-radial-badge-stack">
                        <span class="dash-radial-badge-label">${battLabel}</span>
                        <span class="dash-radial-badge-value">${battValue}</span>
                    </span>
                </ha-card>
            ` : nothing}
        </div>
    `;
}


//Graph view: a 2-mini-card strip (production + forecast) on top of a single chart that draws the day's
//actual production vs forecast, hatched night zones on either side of the daylight window, and a hover
//cursor with HTML dots overlaying both curves so the chart stays cosmetically uniform with the timeline
//hover dots in the main UI. Sits inside the dash-cf-card-graph-block ha-card on every CoverFlow card
//while host._dashViewMode === 'graph'.
export function renderDashCardGraphView(host: DashboardHost, cardOffset: number, activeOffset: number, data: RadialDayData): TemplateResult
{
    const isFront     = cardOffset === activeOffset;
    const hoverHour   = isFront ? host._dashRadialHoverHour : null;
    const hoverActive = hoverHour !== null && hoverHour !== undefined;
    const t           = pickTranslations(host.hass?.language);

    const prodLabel     = t.detail.radialProductionLabel ?? 'Production';
    const forecastLabel = t.detail.dashForecastLabel     ?? 'Forecast';

    //Build a "past-actual only" production array. computeHourlyProduction in prepareRadialDayData
    //returns hourlyProd as "past actual buckets + future forecast values" so the radial dial can
    //draw one continuous curve from realised history into the model. The graph view wants the
    //production area to ONLY carry actual past data (the forecast belongs to the dotted line below),
    //otherwise J+1 / J+2 cards draw an area that's actually the forecast and the dotted forecast
    //line gets masked underneath. Cut the array at the past-end boundary; pastEndHour is in fractional
    //hours, the bucket index threshold is pastEndHour * STEPS_PER_HOUR (each bucket = 1 / STEPS_PER_HOUR
    //of an hour). The area collapses to null on every future bucket and the area path goes flat there.
    const STEPS_PER_HOUR = data.bucketsPerHour;
    const STEPS_PER_DAY  = 24 * STEPS_PER_HOUR;
    const pastEndBucket = data.pastEndHour * STEPS_PER_HOUR;
    const hourlyProdPastOnly = data.hourlyProd.map((v, i) => (i < pastEndBucket ? v : null));
    //Hover-or-daily values for the two mini-cards. Production reads as the day's total kWh by default,
    //flips to the hovered hour's instantaneous W while the cursor is parked. Forecast follows the same
    //recipe against the pv-arrays modelled curve. The production chip on hover goes to HA-direct
    //(same contract as the 4-badge strip above); the forecast chip stays on the modelled series since
    //it has no Home Assistant source to read from.
    //Produced kWh from the exact recorder `change` buckets (matches HA to the watt-hour), forecast
    //kWh from the modelled curve (no Home Assistant source to read from).
    const prodDailyKwh     = sumChangeForDay(host._pvChangeSeries, data.dayStartMs, data.dayEndMs);
    const forecastDailyKwh = dailyEnergyKwh(data.hourlyForecast);
    const hoverMs          = hoverActive ? data.dayStartMs + (hoverHour as number) * HOUR_MS : 0;
    const prodW            = hoverActive ? chipScrubProductionW(host, hoverMs)              : null;
    const forecastW        = hoverActive ? interpAtHour(data.hourlyForecast, hoverHour as number) : null;
    const prodValue = hoverActive
        ? (prodW === null     ? '—' : formatW(host.hass, prodW))
        : formatKwh(host.hass, prodDailyKwh);
    const forecastValue = hoverActive
        ? (forecastW === null ? '—' : formatW(host.hass, forecastW))
        : formatKwh(host.hass, forecastDailyKwh);

    //Chart geometry, stretched to fill the ha-card via preserveAspectRatio: none. Y axis goes 0 (top)
    //to H (bottom), the production baseline sits a bit above the bottom edge so the area curve never
    //touches the card border (mirrors the HA Energy dashboard chart convention).
    const W            = 1000;
    const H            = 200;
    const BASELINE_Y   = H - 18;
    const TOP_MARGIN_Y = 14;
    //Combined scale max across actual + forecast so both curves land at the same scale (the forecast
    //might legitimately overshoot the realised production on cloudy days, the scale max captures both).
    const dataScale = Math.max(1, data.prodScaleMax);
    const hourToX = (h: number): number => (h / 24) * W;
    const wattsToY = (w: number | null): number =>
    {
        if (w === null)
        {
            return BASELINE_Y;
        }
        const r = Math.max(0, w) / dataScale;
        return BASELINE_Y - r * (BASELINE_Y - TOP_MARGIN_Y);
    };

    //Catmull-Rom-derived cubic Bezier path through an array of points. Each segment between two
    //consecutive vertices uses the neighbouring vertex on each side to derive its control points
    //((P[i+1] - P[i-1]) / 6 pattern), which keeps the curve C1-continuous through every data point.
    //End-segment handling wraps the missing neighbour onto the boundary vertex so the smoothing
    //doesn't kink at x = 0 or x = W. Returns the d attribute for an OPEN path (no Z close); the
    //area builder downstream wraps the right-then-left-edge return inside its own closing segment.
    const buildBezierPath = (points: ReadonlyArray<[number, number]>): string =>
    {
        const n = points.length;
        if (n < 2) { return ''; }
        let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
        for (let i = 0; i < n - 1; i++)
        {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(n - 1, i + 2)];
            const c1x = p1[0] + (p2[0] - p0[0]) / 6;
            const c1y = p1[1] + (p2[1] - p0[1]) / 6;
            const c2x = p2[0] - (p3[0] - p1[0]) / 6;
            const c2y = p2[1] - (p3[1] - p1[1]) / 6;
            d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
        }
        return d;
    };
    //Build the data points for the production / forecast curves. One vertex per bucket plus a final
    //anchor at x = W so the curve runs the whole canvas (otherwise the last bucket is dropped).
    const buildDataPoints = (values: ReadonlyArray<number | null>): [number, number][] =>
    {
        const N = values.length;
        const points: [number, number][] = [];
        for (let i = 0; i < N; i++)
        {
            points.push([hourToX((i / N) * 24), wattsToY(values[i] ?? null)]);
        }
        points.push([W, wattsToY(values[N - 1] ?? null)]);
        return points;
    };
    const buildLinePath = (values: ReadonlyArray<number | null>): string =>
    {
        if (values.length < 2) { return ''; }
        return buildBezierPath(buildDataPoints(values));
    };
    //Production area path. Closes to the BOTTOM of the chart (y = H) instead of the production-zero
    //baseline so the fill flows continuously from the curve down to the card edge, the strip below
    //y = BASELINE_Y reads as part of the production wash rather than as a band of empty card behind a
    //visible 0-line. Paired with a separate line path (curve only, no verticals, no bottom) so the
    //fill carries no visible "separator" stroke between the area and the zone below.
    const buildAreaPath = (values: ReadonlyArray<number | null>): string =>
    {
        const line = buildLinePath(values);
        if (line === '')
        {
            return '';
        }
        return line + ' L ' + W.toFixed(1) + ' ' + H.toFixed(1)
                    + ' L 0 ' + H.toFixed(1) + ' Z';
    };
    //Collapsed "from" counterparts. Same segment count + same command shape (M + N C) as the
    //real bezier paths so SMIL interpolates without segment-count mismatches. Collapsed shape is
    //a flat horizontal at y = BASELINE_Y, which slides upward into the real curve on day load.
    const buildCollapsedDataPoints = (): [number, number][] =>
    {
        const N = STEPS_PER_DAY;
        const points: [number, number][] = [];
        for (let i = 0; i < N; i++)
        {
            points.push([hourToX((i / N) * 24), BASELINE_Y]);
        }
        points.push([W, BASELINE_Y]);
        return points;
    };
    const buildCollapsedLinePath = (): string => buildBezierPath(buildCollapsedDataPoints());
    const buildCollapsedAreaPath = (): string =>
    {
        const line = buildBezierPath(buildCollapsedDataPoints());
        return line + ' L ' + W.toFixed(1) + ' ' + H.toFixed(1)
                    + ' L 0 ' + H.toFixed(1) + ' Z';
    };

    const prodAreaPath     = buildAreaPath(hourlyProdPastOnly);
    const prodLinePath     = buildLinePath(hourlyProdPastOnly);
    const fromProdArea     = buildCollapsedAreaPath();
    const fromProdLine     = buildCollapsedLinePath();
    const forecastLinePath = buildLinePath(data.hourlyForecast);
    const fromForecastLine = buildCollapsedLinePath();
    //Grow animation aligned on the HA Energy forecast chart (snappy ~400 ms ease-out). 700 ms was
    //the previous value and felt sluggish next to the rest of the HA UI surfaces.
    const ANIM_DUR = '400ms';

    //Night zones + day separators painted in the chart background. Sunrise and sunset are fractional
    //hours of the local day (e.g. 7.5 = 7:30 am). null on polar day / polar night, skip the markers.
    //Night-zone hatch is rendered as HTML overlay divs (NOT an SVG pattern) so the diagonal stays at
    //a true 45 deg regardless of the chart's runtime aspect ratio. The SVG above uses
    //preserveAspectRatio="none" which stretches anything painted in user-space; the HTML overlay
    //lives in CSS pixel space and the gradient angle stays honest.
    const sunrise         = data.sunRiseSet.sunrise;
    const sunset          = data.sunRiseSet.sunset;
    const sunriseLeftPct  = sunrise !== null ? Math.max(0, Math.min(100, sunrise / 24 * 100)) : null;
    const sunsetLeftPct   = sunset  !== null ? Math.max(0, Math.min(100, sunset  / 24 * 100)) : null;

    //Colours aligned on the timeline chart so the two surfaces read as one composed instrument: same
    //production line + area tint, same theme-aware lerp for the dashed forecast curve (pvColor blended
    //toward black on light theme, toward white on dark theme) so the forecast stays readable on either
    //background.
    const pvColor          = DEFAULT_PV_COLOR_HEX;
    const isDarkTheme      = !!(host.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes?.darkMode;
    const predictedPvColor = isDarkTheme
        ? lerpHexToward(pvColor, '#ffffff', 0.55)
        : lerpHexToward(pvColor, '#000000', 0.35);

    //Hover cursor + dots. The dots are HTML overlays positioned by percent of the chart bounding box
    //so they stay perfectly round (the SVG itself stretches via preserveAspectRatio: none, embedded
    //SVG circles would render as ovals on the chart's non-square aspect ratio).
    let hoverX     = 0;
    let prodY      = -1;
    let forecastY  = -1;
    let hoverProdW:     number | null = null;
    let hoverForecastW: number | null = null;
    if (hoverActive)
    {
        hoverX = hourToX(hoverHour as number);
        hoverProdW     = interpAtHour(data.hourlyProd,     hoverHour as number);
        hoverForecastW = interpAtHour(data.hourlyForecast, hoverHour as number);
        if (hoverProdW     !== null) { prodY     = wattsToY(hoverProdW); }
        if (hoverForecastW !== null) { forecastY = wattsToY(hoverForecastW); }
    }

    //Pointer handlers, same shape as the radial dial. Drag / tap parks the cursor at the pointer's
    //hour, finger lift on touch keeps the parked cursor (cleared via the "back to live" pill at the
    //top-right of the radial card OR by swiping to another day).
    const setHoverFromEvent = (e: PointerEvent): void =>
    {
        const svgEl = e.currentTarget as SVGSVGElement | null;
        if (!svgEl) { return; }
        const rect = svgEl.getBoundingClientRect();
        if (rect.width <= 0) { return; }
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        host._dashRadialHoverHour = frac * 24;
        host.requestUpdate();
    };
    const onPointerMove = isFront ? (e: PointerEvent) => setHoverFromEvent(e) : undefined;
    const onPointerDown = isFront ? (e: PointerEvent) => setHoverFromEvent(e) : undefined;
    const onPointerLeave = isFront ? (e: PointerEvent) =>
    {
        if (e.pointerType !== 'mouse') { return; }
        host._dashRadialHoverHour = null;
        host.requestUpdate();
    } : undefined;

    return html`
        <div class="dash-radial-chip-strip dash-radial-chip-strip-pair">
            <ha-card class="dash-radial-badge dash-radial-badge-prod">
                <span class="dash-radial-badge-chip"><ha-icon icon="mdi:solar-power"></ha-icon></span>
                <span class="dash-radial-badge-stack">
                    <span class="dash-radial-badge-label">${prodLabel}</span>
                    <span class="dash-radial-badge-value">${prodValue}</span>
                </span>
            </ha-card>
            <ha-card class="dash-radial-badge dash-radial-badge-forecast">
                <span class="dash-radial-badge-chip"><ha-icon icon="mdi:chart-bell-curve-cumulative"></ha-icon></span>
                <span class="dash-radial-badge-stack">
                    <span class="dash-radial-badge-label">${forecastLabel}</span>
                    <span class="dash-radial-badge-value">${forecastValue}</span>
                </span>
            </ha-card>
        </div>
        <ha-card class="dash-cf-card-graph-block">
            <!-- Night-zone hatch overlays: HTML divs in CSS-pixel space so the 45 deg stripes never
                 stretch with the SVG aspect ratio (same recipe as renderTimelineNightZones in the
                 main timeline). One div for the morning night (midnight -> sunrise), one for the
                 evening night (sunset -> midnight). -->
            ${sunriseLeftPct !== null && sunriseLeftPct > 0 ? html`
                <div class="dash-graph-night-zone" style="left:0%;width:${sunriseLeftPct.toFixed(2)}%"></div>
            ` : nothing}
            ${sunsetLeftPct !== null && sunsetLeftPct < 100 ? html`
                <div class="dash-graph-night-zone" style="left:${sunsetLeftPct.toFixed(2)}%;width:${(100 - sunsetLeftPct).toFixed(2)}%"></div>
            ` : nothing}
            ${keyed(isFront ? `f-${data.dayStartMs}` : `b-${cardOffset}`, html`<svg
                class="dash-graph-svg"
                viewBox="0 0 ${W} ${H}"
                preserveAspectRatio="none"
                @pointerdown="${onPointerDown}"
                @pointermove="${onPointerMove}"
                @pointerleave="${onPointerLeave}"
            >
                ${sunrise !== null
                    ? svg`<line class="dash-graph-day-separator" x1="${hourToX(sunrise).toFixed(1)}" y1="0" x2="${hourToX(sunrise).toFixed(1)}" y2="${H}"/>`
                    : nothing}
                ${sunset !== null
                    ? svg`<line class="dash-graph-day-separator" x1="${hourToX(sunset).toFixed(1)}" y1="0" x2="${hourToX(sunset).toFixed(1)}" y2="${H}"/>`
                    : nothing}
                <!-- Production fill: closed shape from the curve down to the chart bottom, no stroke
                     so the visual reads as a continuous wash from the curve to the card edge with no
                     separator line at y = BASELINE_Y. Colour + opacity match the timeline PV chart
                     (pvColor at 0.25 alpha) so the two surfaces read uniformly. -->
                <path class="dash-graph-prod-area" d="${prodAreaPath}" fill="${pvColor}" fill-opacity="0.25">
                    <animate attributeName="d" from="${fromProdArea}" to="${prodAreaPath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>
                <!-- Production curve: open path (curve only, no verticals + no bottom), traces the
                     edge of the area fill as a solid stroke without painting the surrounding shape. -->
                <path class="dash-graph-prod-line" d="${prodLinePath}" stroke="${pvColor}">
                    <animate attributeName="d" from="${fromProdLine}" to="${prodLinePath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>
                <path class="dash-graph-forecast-line" d="${forecastLinePath}" stroke="${predictedPvColor}">
                    <animate attributeName="d" from="${fromForecastLine}" to="${forecastLinePath}" dur="${ANIM_DUR}" begin="0s" fill="freeze"/>
                </path>
                ${hoverActive
                    ? svg`<line class="dash-graph-cursor" x1="${hoverX.toFixed(1)}" y1="0" x2="${hoverX.toFixed(1)}" y2="${H}"/>`
                    : nothing}
            </svg>`)}
            ${hoverActive && prodY >= 0 ? html`<div class="dash-graph-hover-dot dash-graph-hover-dot-prod"
                style="left:${(hoverX / W * 100).toFixed(2)}%;top:${(prodY / H * 100).toFixed(2)}%"></div>` : nothing}
            ${hoverActive && forecastY >= 0 ? html`<div class="dash-graph-hover-dot dash-graph-hover-dot-forecast"
                style="left:${(hoverX / W * 100).toFixed(2)}%;top:${(forecastY / H * 100).toFixed(2)}%"></div>` : nothing}
            ${hoverActive && (hoverProdW !== null || hoverForecastW !== null) ? html`
                <!-- Hover tooltip: icon + value rows for production / forecast where the cursor sits.
                     Anchored ~14 % from the top of the chart so the cursor line stays visible above
                     it (the line "cuts through" the tooltip rather than being hidden behind it). The
                     ha-card-style background uses HA theme tokens so it follows light / dark themes
                     automatically. pointer-events: none keeps hover on the SVG. -->
                <div class="dash-graph-hover-tooltip" style="left:${(hoverX / W * 100).toFixed(2)}%">
                    <span class="dash-graph-hover-tooltip-row dash-graph-hover-tooltip-row-time">
                        <ha-icon icon="mdi:clock-outline" class="dash-graph-hover-tooltip-icon"></ha-icon>
                        <span class="dash-graph-hover-tooltip-value">${formatHoverClock(hoverHour as number, host.hass)}</span>
                    </span>
                    ${hoverProdW !== null ? html`
                        <span class="dash-graph-hover-tooltip-row">
                            <ha-icon icon="mdi:solar-power" class="dash-graph-hover-tooltip-icon dash-graph-hover-tooltip-icon-prod"></ha-icon>
                            <span class="dash-graph-hover-tooltip-value">${formatW(host.hass, hoverProdW)}</span>
                        </span>
                    ` : nothing}
                    ${hoverForecastW !== null ? html`
                        <span class="dash-graph-hover-tooltip-row">
                            <ha-icon icon="mdi:chart-bell-curve-cumulative" class="dash-graph-hover-tooltip-icon dash-graph-hover-tooltip-icon-forecast"></ha-icon>
                            <span class="dash-graph-hover-tooltip-value">${formatW(host.hass, hoverForecastW)}</span>
                        </span>
                    ` : nothing}
                </div>
            ` : nothing}
        </ha-card>
    `;
}
