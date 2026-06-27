//Timeline chart rendering: the two SVG cards under the map, the scrub cursors, and per-day kWh aggregation for the
//day chips. Pure templates over a structural `ChartHost`; charts only read, state mutations live elsewhere.

import type { TemplateResult } from 'lit';
import { html, svg, nothing } from 'lit';
import { type HeliosConfig, valueDecimals } from '../helios-config';
import { ENERGY_COLOR, energySolarColor, formatLocalisedNumber, lerpHexToward, cssHex } from './format';
import { buildTimelineModel, formatTimelineLabel } from './timeline-model';
import { pvNormalizeToWatts, type PvHistory } from './pv';
import { getHomeCoords } from './init';
import { getSunPosition } from '../engine/sun';
import { sliceForRange, valueAt, type UnifiedDataStore } from './unifiedStore';
import { sumChangeForDay, type ChangeBucket } from './energy-stats';
import { resolveCustomEntityIcon } from './custom-entity';



//Binary-search the sun's altitude=0 crossing inside [dayStart, dayEnd] in the requested direction. Returns null
//during polar day/night (no crossing) or a degenerate bracket. Coarse 1-hour scan + 12 bisection iterations reach
//seconds precision in ~22 getSunPosition calls, well under the per-frame budget.
function findSunCrossing(
    lat: number,
    lon: number,
    dayStartMs: number,
    dayEndMs:   number,
    direction:  'rising' | 'setting'
): Date | null
{
    const STEP_MS = 60 * 60 * 1000;
    let prevAlt = getSunPosition(new Date(dayStartMs), lat, lon).altitude;
    let bracketLo = 0;
    let bracketHi = 0;
    let found = false;
    for (let t = dayStartMs + STEP_MS; t <= dayEndMs; t += STEP_MS)
    {
        const alt = getSunPosition(new Date(t), lat, lon).altitude;
        if (direction === 'rising' && prevAlt <= 0 && alt > 0)
        {
            bracketLo = t - STEP_MS;
            bracketHi = t;
            found = true;
            break;
        }
        if (direction === 'setting' && prevAlt > 0 && alt <= 0)
        {
            bracketLo = t - STEP_MS;
            bracketHi = t;
            found = true;
            break;
        }
        prevAlt = alt;
    }
    if (!found)
    {
        return null;
    }
    for (let i = 0; i < 12; i++)
    {
        const mid = (bracketLo + bracketHi) / 2;
        const alt = getSunPosition(new Date(mid), lat, lon).altitude;
        if ((direction === 'rising') === (alt > 0))
        {
            bracketHi = mid;
        }
        else
        {
            bracketLo = mid;
        }
    }
    return new Date((bracketLo + bracketHi) / 2);
}


//Per-day night intervals clipped to the visible range, each a (sunset[N] -> sunrise[N+1]) pair as
//{ startPct, endPct } for `renderTimelineNightZones`. The walk pads one day each side so leading/trailing night
//chunks still resolve when the window doesn't start/end on a solar boundary.
//Memo for computeNightIntervals: the night zones depend only on the window + home coords, which are stable
//across the frequent scrub + auto-rotate renders (those move _selectedTime / the camera, not _timeRange).
//Without this the ~700 getSunPosition calls below ran on every one of those renders.
let _nightMemo: { key: string; out: { startPct: number; endPct: number }[] } | null = null;

function computeNightIntervals(host: ChartHost): { startPct: number; endPct: number }[]
{
    const range = host._timeRange;
    if (!range)
    {
        return [];
    }
    const coords = getHomeCoords(host.config, host.hass);
    if (!coords)
    {
        return [];
    }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    const rangeMs = endMs - startMs;
    if (rangeMs <= 0)
    {
        return [];
    }
    const memoKey = `${startMs}|${endMs}|${coords.lat.toFixed(4)}|${coords.lon.toFixed(4)}`;
    if (_nightMemo && _nightMemo.key === memoKey)
    {
        return _nightMemo.out;
    }

    interface Crossing { ms: number; kind: 'sunrise' | 'sunset' }
    const crossings: Crossing[] = [];

    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() - 1);
    const walkEndMs = endMs + 24 * 60 * 60 * 1000;
    while (cursor.getTime() <= walkEndMs)
    {
        const dayStart = cursor.getTime();
        const dayEnd   = dayStart + 24 * 60 * 60 * 1000;
        const rise = findSunCrossing(coords.lat, coords.lon, dayStart, dayEnd, 'rising');
        const setT = findSunCrossing(coords.lat, coords.lon, dayStart, dayEnd, 'setting');
        if (rise)
        {
            crossings.push({ ms: rise.getTime(), kind: 'sunrise' });
        }
        if (setT)
        {
            crossings.push({ ms: setT.getTime(), kind: 'sunset' });
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    crossings.sort((a, b) => a.ms - b.ms);

    const intervals: { startMs: number; endMs: number }[] = [];
    let pendingSunset: number | null = null;
    let sawAnySunrise = false;
    for (const c of crossings)
    {
        if (c.kind === 'sunset')
        {
            pendingSunset = c.ms;
        }
        else
        {
            if (pendingSunset !== null)
            {
                intervals.push({ startMs: pendingSunset, endMs: c.ms });
                pendingSunset = null;
            }
            else if (!sawAnySunrise)
            {
                //Leading night: window opens before the walk's first sunset, so the morning up to the first sunrise is night.
                intervals.push({ startMs: -Infinity, endMs: c.ms });
            }
            sawAnySunrise = true;
        }
    }
    if (pendingSunset !== null)
    {
        //Trailing night extending past the walk's last sunrise.
        intervals.push({ startMs: pendingSunset, endMs: Infinity });
    }

    const out: { startPct: number; endPct: number }[] = [];
    for (const iv of intervals)
    {
        const s = Math.max(iv.startMs, startMs);
        const e = Math.min(iv.endMs,   endMs);
        if (e > s)
        {
            out.push({
                startPct: (s - startMs) / rangeMs * 100,
                endPct:   (e - startMs) / rangeMs * 100,
            });
        }
    }
    _nightMemo = { key: memoKey, out };
    return out;
}


//Night-zone overlays: one absolutely-positioned low-alpha-wash div per night interval, inside the chart card so it
//inherits the card's positioning + clipping. z-index sits above the SVG curves but below the cursors (z-index 4).
export function renderTimelineNightZones(host: ChartHost): TemplateResult | typeof nothing
{
    const intervals = computeNightIntervals(host);
    if (intervals.length === 0)
    {
        return nothing;
    }
    return html`
        ${intervals.map(iv => html`
            <div
                class="hc-night-zone"
                style="left:${iv.startPct.toFixed(2)}%; width:${(iv.endPct - iv.startPct).toFixed(2)}%"
            ></div>
        `)}
    `;
}


//Semi-opaque overlay over the future portion of a chart card (z-index 3: above curves + night-zones, below the
//z-index-4 cursors). Anchored to "now" so the forecast side reads behind a wash. Returns nothing when "now" is
//outside the range, so the mask never shrinks to a sliver or fills the whole card.
export function renderTimelineFutureMask(host: ChartHost): TemplateResult | typeof nothing
{
    const range = host._timeRange;
    if (!range)
    {
        return nothing;
    }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    const rangeMs = endMs - startMs;
    if (rangeMs <= 0)
    {
        return nothing;
    }
    const nowMs = Date.now();
    if (nowMs <= startMs || nowMs >= endMs)
    {
        return nothing;
    }
    const nowPct = (nowMs - startMs) / rangeMs * 100;
    return html`
        <div
            class="hc-future-mask"
            style="left:${nowPct.toFixed(2)}%"
        ></div>
    `;
}


//Active theme polarity (hass.themes.darkMode) — drives whether the per-source colour ramp brightens or
//darkens off the base solar token.
const chartIsDark = (host: ChartHost): boolean => !!host.hass?.themes?.darkMode;

//Per-PV-string production shares at an instant, for the home stacked histogram. Reads each source's raw
//history (interpolated to the instant), keeps the producing ones, and returns {fraction, #rrggbb colour}
//hue-spread off the solar token by source index — matching the per-source chart curves. Empty unless 2+
//sources are producing right now; below that the home renders as a single solid block.
export function solarBands(host: ChartHost, atMs: number): { frac: number; color: string }[]
{
    const map = host._pvHistoryPerEntity;
    if (!map || map.size < 2) { return []; }
    const ids  = Array.from(map.keys()).sort();
    const el   = host as unknown as Element;
    const dark = chartIsDark(host);
    //At the live instant the per-source HISTORY (hourly calibration) doesn't reach "now", so read each
    //source's live power straight off its state instead; only fall back to the history when scrubbing the
    //past. ~5 min tolerance covers the gap between now and the freshest data without misclassifying a scrub.
    const live  = atMs >= Date.now() - 5 * 60_000;
    const parts: { v: number; idx: number }[] = [];
    for (let i = 0; i < ids.length; i++)
    {
        const id = ids[i];
        let v = NaN;
        if (live)
        {
            //Power (stat_rate) sources read directly; cumulative-only sources normalise to 0 here and drop
            //to the history branch below (which differentiates them).
            const so = host.hass?.states?.[id];
            if (so)
            {
                const raw = parseFloat(so.state);
                if (isFinite(raw)) { v = pvNormalizeToWatts(raw, String(so.attributes?.unit_of_measurement ?? '')); }
            }
        }
        if (!(isFinite(v) && v > 0))
        {
            //Scrub, or a live read that yielded nothing: instantaneous power from the per-source history
            //(pvValueAtTime differentiates cumulative meters, in a unit consistent across sources).
            const ph = map.get(id);
            if (ph) { v = pvValueAtTime(host, atMs, ph).value; }
        }
        if (isFinite(v) && v > 0) { parts.push({ v, idx: i }); }
    }
    const total = parts.reduce((s, p) => s + p.v, 0);
    if (total <= 0 || parts.length < 2) { return []; }
    //Same per-source colour ramp as the chart curves.
    return parts.map((p) => ({ frac: p.v / total, color: energySolarColor(el, dark, p.idx) }));
}


export function pvValueAtTime(
    host: ChartHost,
    targetMs: number,
    //Optional per-source history override (multi-source tooltip rows). Reads this series instead of the aggregated
    //`_pvHistory`; the calibration/LTS and forecast fallbacks are skipped in override mode (no per-entity LTS yet),
    //so a per-entity row reads "—" past its history's tail.
    seriesOverride?: { times: Date[]; values: number[] },
): { value: number; unit: string; isPredicted: boolean }
{
    const luRaw = (host._pvUnit || '').trim();
    if (!luRaw)
    {
        return { value: NaN, unit: '', isPredicted: false };
    }
    const lu             = luRaw.toLowerCase();
    const isCumulative   = lu === 'wh' || lu === 'kwh' || lu === 'mwh';
    const displayUnit    = isCumulative
        ? (lu === 'kwh' ? 'kW' : lu === 'mwh' ? 'MW' : 'W')
        : luRaw;
    const duLow = displayUnit.toLowerCase();
    const nativeFromW    = duLow === 'kw' ? 1 / 1000
                         : duLow === 'mw' ? 1 / 1_000_000
                         : 1;

    //Hard zero when the sun is below the horizon at the cursor instant. Catches stale observed samples clamped
    //forward into the night, forecast pairs straddling sunrise/sunset leaking a few watts, and inverter standby
    //readings (0.5-2 W) all night. Panels can't produce without sun, so we enforce that physical floor.
    const coords = getHomeCoords(host.config, host.hass);
    if (coords && getSunPosition(new Date(targetMs), coords.lat, coords.lon).altitude <= 0)
    {
        return { value: 0, unit: displayUnit, isPredicted: false };
    }

    //Observed history. Cumulative entities differentiate the bracketing pair; power entities interpolate. Floor at
    //zero so sensor/net-meter noise never shows "-2 W". Instants beyond the last observed sample fall through to the
    //forecast pass: clamping interpAt would freeze the tooltip on yesterday's late-afternoon reading.
    const hist = seriesOverride ?? host._pvHistory;
    const rawFirstMs = (hist && hist.times.length >= 1)
        ? hist.times[0].getTime()
        : Infinity;
    const lastObsMs = (hist && hist.times.length >= 1)
        ? hist.times[hist.times.length - 1].getTime()
        : -Infinity;
    if (hist && hist.times.length >= 2 && targetMs >= rawFirstMs && targetMs <= lastObsMs)
    {
        if (isCumulative)
        {
            for (let i = 1; i < hist.times.length; i++)
            {
                const t1 = hist.times[i].getTime();
                if (targetMs > t1)
                {
                    continue;
                }
                const t0 = hist.times[i - 1].getTime();
                if (targetMs < t0)
                {
                    break;
                }
                const dtH = (t1 - t0) / 3_600_000;
                if (dtH <= 0 || dtH > 6)
                {
                    break;
                }
                const dv = hist.values[i] - hist.values[i - 1];
                if (!isFinite(dv) || dv < 0)
                {
                    break;
                }
                return { value: Math.max(0, dv / dtH), unit: displayUnit, isPredicted: false };
            }
        }
        else
        {
            const v = interpAt(hist.times, hist.values, targetMs);
            if (isFinite(v))
            {
                return { value: Math.max(0, v), unit: displayUnit, isPredicted: false };
            }
        }
    }
    //Older past, before the head of the raw 6-hour window: fall back to the hourly LTS slot calibration fetched.
    //LTS values are already in native power units, so interpolation is correct regardless of entity type. Skipped in
    //`seriesOverride` mode (no per-entity LTS yet, override carries only the 6 h raw window) -> per-entity rows read "—".
    if (!seriesOverride)
    {
        const calib = host._pvCalibStats;
        if (calib && calib.times.length >= 2 && targetMs <= lastObsMs)
        {
            if (isCumulative)
            {
                //_pvCalibStats carries the meter's cumulative `state` (kWh) per LTS bucket for energy sensors, NOT
                //power. Differentiate the bracketing pair into average power; reading cumulative straight through
                //inflates the readout ~1000x.
                for (let i = 1; i < calib.times.length; i++)
                {
                    const t1 = calib.times[i].getTime();
                    if (targetMs > t1)
                    {
                        continue;
                    }
                    const t0 = calib.times[i - 1].getTime();
                    if (targetMs < t0)
                    {
                        break;
                    }
                    const dtH = (t1 - t0) / 3_600_000;
                    if (dtH <= 0 || dtH > 6)
                    {
                        break;
                    }
                    const dv = calib.values[i] - calib.values[i - 1];
                    if (!isFinite(dv) || dv < 0)
                    {
                        break;
                    }
                    return { value: Math.max(0, dv / dtH), unit: displayUnit, isPredicted: false };
                }
            }
            else
            {
                const v = interpAt(calib.times, calib.values, targetMs);
                if (isFinite(v))
                {
                    return { value: Math.max(0, v), unit: displayUnit, isPredicted: false };
                }
            }
        }
    }

    //Override mode has no per-source forecast yet, so stop on a future cursor and let the caller show "—". The
    //aggregated path below stays unchanged for the headline forecast.
    if (seriesOverride)
    {
        return { value: NaN, unit: displayUnit, isPredicted: false };
    }

    //Forecast for future hours: read the store's CORRECTED forecast at the cursor instant (same series the dotted
    //curve draws), so the tooltip never disagrees with its line. Already cap-clipped and correction-applied.
    const store = host._unifiedStore;
    if (store)
    {
        const w = valueAt(store.forecast, store, targetMs);
        if (w !== null && w > 0)
        {
            return { value: Math.max(0, w) * nativeFromW, unit: displayUnit, isPredicted: true };
        }
    }

    return { value: NaN, unit: displayUnit, isPredicted: false };
}


//Hover tooltip above the chart-card stack: the hover timestamp + one icon-coded row per series, plus the day's kWh
//production (past) or forecast (future). A magnet-snap tab surfaces when the scrub enters the band around the live
//cursor (snap logic in applyTimelinePointer, timeline.ts). The PV row is skipped silently when unavailable.
export function renderTimelineHoverTooltip(host: ChartHost): TemplateResult | typeof nothing
{
    const range    = host._timeRange;
    const series   = host._chartSeries;
    //Tooltip stays available when _chartSeries is null (Open-Meteo unreachable): PV + per-entity rows read from the
    //recorder fine, irradiance + cloud cells just fall back to NaN handled below.
    if (!range)
    {
        return nothing;
    }

    const startMs = range.start.getTime();
    const rangeMs = range.end.getTime() - startMs;
    if (rangeMs <= 0)
    {
        return nothing;
    }

    //Tooltip shows only while the pointer is actively over the chart (or dragging the scrub). On gesture end
    //_chartHoverPct goes null and the tooltip disappears, leaving just the scrub line.
    const hoverPct = host._chartHoverPct;
    if (hoverPct === null || hoverPct < 0 || hoverPct > 100)
    {
        return nothing;
    }
    const pct  = hoverPct;
    const atMs = startMs + (pct / 100) * rangeMs;

    const irrV = series ? interpAt(series.times, series.irradiance, atMs) : NaN;
    const cloudLowV  = series ? interpAt(series.times, series.cloudLow,  atMs) : NaN;
    const cloudMidV  = series ? interpAt(series.times, series.cloudMid,  atMs) : NaN;
    const cloudHighV = series ? interpAt(series.times, series.cloudHigh, atMs) : NaN;
    const customV    = host._customEntityHistory
        ? interpAt(host._customEntityHistory.times, host._customEntityHistory.values, atMs)
        : NaN;
    const pv   = pvValueAtTime(host, atMs);

    //Active chart target: tooltip rows follow the re-targetable chart (chip <-> chart <-> tooltip coupling).
    //Grid/battery read from the store at the cursor instant (watts; kw() formats to kW; null -> NaN).
    const target   = host._chartTarget ?? 'production';
    const store    = host._unifiedStore;
    const gridImpW = store ? (valueAt(store.gridImport, store, atMs) ?? NaN) : NaN;
    const gridExpW = store ? (valueAt(store.gridExport, store, atMs) ?? NaN) : NaN;
    const battW    = store ? (valueAt(store.battery,    store, atMs) ?? NaN) : NaN;
    //Home consumption (load) at the hovered instant: production + import − export − net battery (charge+),
    //clamped at 0. Same formula as the consumption chart series. Hidden when no flow has any reading.
    const prodW          = store ? (valueAt(store.production, store, atMs) ?? NaN) : NaN;
    const hasConsumption = isFinite(prodW) || isFinite(gridImpW) || isFinite(gridExpW) || isFinite(battW);
    const consumptionW   = Math.max(0,
        (isFinite(prodW) ? prodW : 0) + (isFinite(gridImpW) ? gridImpW : 0)
        - (isFinite(gridExpW) ? gridExpW : 0) - (isFinite(battW) ? battW : 0));
    const battSocV = host._batterySocHistory
        ? interpAt(host._batterySocHistory.times, host._batterySocHistory.values, atMs)
        : NaN;
    //User decimals apply to every kW/kWh readout; raw watts stay integers.
    const dec = valueDecimals(host.config);
    const kw = (w: number): string => `${formatLocalisedNumber(host.hass, w / 1000, dec)} kW`;

    //Per-entity breakdown rows for multi-source installs. Each row carries the friendly name + a hue-rotated colour
    //pastille matching its per-source curve. Single-source installs skip it (the lone entry equals the aggregate,
    //which would duplicate the headline row).
    const perEntityMap     = host._pvHistoryPerEntity;
    const perEntityIds     = perEntityMap.size > 1 ? Array.from(perEntityMap.keys()).sort() : [];
    const perEntityRows: { id: string; label: string; valueText: string; colorIdx: number }[] = [];
    for (let i = 0; i < perEntityIds.length; i++)
    {
        const id    = perEntityIds[i];
        const ph    = perEntityMap.get(id);
        if (!ph)
        {
            continue;
        }
        const val   = pvValueAtTime(host, atMs, ph);
        if (!isFinite(val.value))
        {
            continue;
        }
        const stateObj    = host.hass?.states?.[id];
        const friendly    = String(stateObj?.attributes?.friendly_name ?? id);
        const localDec    = val.unit === 'W' ? 0 : dec;
        const valueText   = `${formatLocalisedNumber(host.hass, val.value, localDec)} ${val.unit}`;
        perEntityRows.push({ id, label: friendly, valueText, colorIdx: i });
    }
    const hasPv = isFinite(pv.value);

    //Each tooltip row's icon takes the colour of the series it represents (matching the chart curves) so the
    //readout is scannable at a glance; only the clock + live chip keep the theme colour. Cloud greys mirror the
    //three stacked band shades in renderTargetChart.
    const el             = host as unknown as Element;
    const cloudBase      = ENERGY_COLOR.cloud(el);
    const cloudLowColor  = lerpHexToward(cloudBase, '#ffffff', 0.55);
    const cloudHighColor = lerpHexToward(cloudBase, '#000000', 0.50);

    const atDate     = new Date(atMs);
    const haLanguage = (host.hass?.language as string | undefined) || undefined;
    //Header granularity follows the window: an intraday span shows the time, a multi-day span adds the weekday,
    //and a month/year span shows the calendar day (the scrub steps day by day), so you always know WHEN you are.
    const spanDays  = rangeMs / 86_400_000;
    const timeOpts: Intl.DateTimeFormatOptions =
          spanDays <= 2.05  ? { hour: '2-digit', minute: '2-digit' }
        : spanDays <= 14.05 ? { weekday: 'short', hour: '2-digit', minute: '2-digit' }
        :                     { weekday: 'short', day: 'numeric', month: 'short' };
    const timeLabel  = new Intl.DateTimeFormat(haLanguage, timeOpts).format(atDate);

    //Day total split observed/forecast by cursor-vs-"now" (not the day boundary), so later-today hours show the
    //full-day forecast and earlier hours the production so far. Today's past prefers recorder-backed
    //`_haSolarTodayKwh`, else local trapezoidal integration; future stays on `computeDailyKwhTotals`.
    const dayKey = new Date(atDate);
    dayKey.setHours(0, 0, 0, 0);
    const todayKey = new Date();
    todayKey.setHours(0, 0, 0, 0);
    const isToday        = dayKey.getTime() === todayKey.getTime();
    const isFutureCursor = atMs > Date.now();
    const dayTotals      = computeDailyKwhTotals(host);
    let dayKwh: number | undefined = dayTotals.get(dayKey.getTime());
    if (isToday && !isFutureCursor && typeof host._haSolarTodayKwh === 'number' && isFinite(host._haSolarTodayKwh))
    {
        dayKwh = host._haSolarTodayKwh;
    }
    //Past cursor shows only the instantaneous power (the day total lives in the clock); a future cursor adds the
    //forecast day total, which has no other home in the UI.
    const showForecast   =  isFutureCursor && dayKwh !== undefined && isFinite(dayKwh) && dayKwh >= 0.05;
    const dayKwhText = (dayKwh !== undefined && isFinite(dayKwh) && dayKwh >= 0.05)
        ? formatLocalisedNumber(host.hass, dayKwh, dec) + ' kWh'
        : '';

    //Magnet-snap detection: when the scrub lands in a narrow band around the live cursor, applyTimelinePointer
    //(timeline.ts) auto-releases to live mode and a restore tab surfaces. The 8 px scrub check maps to ~1.2 % at
    //typical chart widths (8 px on a 700 px chart).
    const MAGNET_PCT   = 1.2;
    const nowMsRef     = Date.now();
    const inMagnetZone = nowMsRef >= startMs && nowMsRef <= startMs + rangeMs
        && Math.abs(pct - ((nowMsRef - startMs) / rangeMs) * 100) <= MAGNET_PCT;

    //PV decimals: user setting for kW/MW, raw watts as integers.
    const pvDecimals = (!hasPv || pv.unit === 'W') ? 0 : dec;

    const haLang   = (host.hass?.language as string | undefined) || '';
    //Short inline label for the magnet-snap tab; the title + aria-label carry the long phrase for screen readers.
    const liveLabel = 'Live';
    const liveText  = haLang.toLowerCase().startsWith('fr')
        ? 'Retour au live'
        : 'Back to live';

    //Tooltip horizontal anchor: a continuous translateX(-${pct}%) slide, so its left edge sits at 0 % and right edge
    //at 100 % as the scrub sweeps. Never goes off-screen, no jump-to-edge magnet.
    return html`
        <div
            class="tb-hover-tooltip-tail ${inMagnetZone ? 'is-magnet-snap' : ''}"
            style="left:${pct.toFixed(2)}%"
        ></div>
        <div
            class="tb-hover-tooltip-wrapper"
            style="left:${pct.toFixed(2)}%; transform: translateX(-${pct.toFixed(2)}%)"
        >
            <div class="tb-hover-tooltip">
                <div class="tb-hover-tooltip-time">
                    <ha-icon class="tb-hover-tooltip-time-icon" icon="mdi:clock-outline"></ha-icon>
                    <span class="tb-hover-tooltip-time-label">${timeLabel}</span>
                    <span
                        class="tb-hover-tooltip-live-chip ${inMagnetZone ? 'is-visible' : ''}"
                        title=${liveText}
                        aria-label=${liveText}
                        aria-hidden=${inMagnetZone ? 'false' : 'true'}
                    >
                        <ha-icon class="tb-hover-tooltip-live-chip-dot" icon="mdi:circle-medium"></ha-icon>
                        <span class="tb-hover-tooltip-live-chip-label">${liveLabel}</span>
                    </span>
                </div>
                ${target === 'production' ? html`
                    ${showForecast && dayKwhText ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR.pv(el)}" icon="mdi:crystal-ball"></ha-icon>
                            <span class="tb-hover-tooltip-value">${dayKwhText}</span>
                        </div>
                    ` : nothing}
                    ${hasPv ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR.pv(el)}" icon="mdi:solar-power"></ha-icon>
                            <span class="tb-hover-tooltip-value">${formatLocalisedNumber(host.hass, pv.value, pvDecimals)} ${pv.unit}</span>
                        </div>
                    ` : nothing}
                    ${perEntityRows.map(prow => html`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${energySolarColor(host as unknown as Element, chartIsDark(host), prow.colorIdx)}"></span>
                            <span class="tb-hover-tooltip-sublabel">${prow.label}</span>
                            <span class="tb-hover-tooltip-value">${prow.valueText}</span>
                        </div>
                    `)}
                ` : nothing}
                ${target === 'consumption' && hasConsumption ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR.consumption(el)}" icon="mdi:home-lightning-bolt"></ha-icon>
                        <span class="tb-hover-tooltip-value">${kw(consumptionW)}</span>
                    </div>
                ` : nothing}
                ${target === 'grid' ? html`
                    ${isFinite(gridImpW) && gridImpW >= 1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR.gridImport(el)}" icon="mdi:transmission-tower-export"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(gridImpW)}</span>
                        </div>
                    ` : nothing}
                    ${isFinite(gridExpW) && gridExpW >= 1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR.gridExport(el)}" icon="mdi:transmission-tower-import"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(gridExpW)}</span>
                        </div>
                    ` : nothing}
                ` : nothing}
                ${target === 'battery' ? html`
                    ${isFinite(battW) && battW >= 1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR.batteryIn(el)}" icon="mdi:battery-arrow-up"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(battW)}</span>
                        </div>
                    ` : nothing}
                    ${isFinite(battW) && battW <= -1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR.batteryOut(el)}" icon="mdi:battery-arrow-down"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(-battW)}</span>
                        </div>
                    ` : nothing}
                ` : nothing}
                ${target === 'battery-soc' && isFinite(battSocV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR.batteryOut(el)}" icon="mdi:battery"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, battSocV)))} %</span>
                    </div>
                ` : nothing}
                ${target === 'irradiance' && isFinite(irrV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${ENERGY_COLOR.sun(el)}" icon="mdi:white-balance-sunny"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, irrV))} W/m²</span>
                    </div>
                ` : nothing}
                ${target === 'custom' && isFinite(customV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" style="color:${cssHex(el, '--red-color', '#f44336')}" icon=${resolveCustomEntityIcon(host.hass, host.config)}></ha-icon>
                        <span class="tb-hover-tooltip-value">${formatLocalisedNumber(host.hass, Math.abs(customV) / 1000, dec)} kW</span>
                    </div>
                ` : nothing}
                ${target === 'cloud' ? html`
                    ${isFinite(cloudHighV) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${cloudHighColor}" icon="mdi:format-vertical-align-top"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cloudHighV)))} %</span>
                        </div>
                    ` : nothing}
                    ${isFinite(cloudMidV) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${cloudBase}" icon="mdi:format-vertical-align-center"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cloudMidV)))} %</span>
                        </div>
                    ` : nothing}
                    ${isFinite(cloudLowV) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" style="color:${cloudLowColor}" icon="mdi:format-vertical-align-bottom"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cloudLowV)))} %</span>
                        </div>
                    ` : nothing}
                ` : nothing}
            </div>
        </div>
    `;
}


//Engine-resampled weather series. Same shape the engine snapshots and pushes to the card on every refresh.
export interface ChartSeries
{
    times:        Date[];
    irradiance:   number[];
    cloud:        number[];
    //Hourly low / mid / high cloud cover (%), for the timeline's cloud target (three altitude bands).
    cloudLow:     number[];
    cloudMid:     number[];
    cloudHigh:    number[];
}

//Re-targetable bottom-chart target: the single series-set the chart draws at a time. 'production' (+ dashed
//forecast + per-source breakdown) is default; 'grid'/'battery' draw two-direction flows (accent = dominant side);
//'irradiance' draws W/m² on a fixed 0..1000 scale.
export type ChartTarget = 'production' | 'consumption' | 'grid' | 'battery' | 'battery-soc' | 'irradiance' | 'cloud' | 'custom';

//Structural surface the host card exposes. `_chartHoverPct` is intentionally writable (hover handlers mutate it on
//pointermove/leave); all other fields stay read-only.
export interface ChartHost
{
    readonly config:        HeliosConfig | undefined;
    readonly hass:          any;
    readonly _timeRange:    { start: Date; end: Date } | null;
    readonly _chartSeries:  ChartSeries | null;
    readonly _pvHistory:    PvHistory | null;
    //Recorder `change` series (5-min buckets) for the solar meter(s). sumChangeForDay sums exact per-day kWh so
    //totals match the HA Energy dashboard to the watt-hour, not the gap-interpolated curve.
    readonly _pvChangeSeries: ChangeBucket[] | null;
    //Per-entity histories alongside aggregated `_pvHistory` for per-source curves + tooltip breakdown. Single-source
    //installs carry one entry equal to the aggregate; multi-source carry one per HA Energy source.
    readonly _pvHistoryPerEntity: Map<string, PvHistory>;
    //Hourly LTS series feeding the 5-day forecast calibration. `calibration.ts` prefers this over `_pvHistory` (same
    //window, far fewer rows on high-frequency installs). Null while fetching / empty when not LTS-tracked -> degrades
    //to `_pvHistory`.
    readonly _pvCalibStats:   PvHistory | null;
    readonly _pvUnit:       string;
    readonly _selectedTime: Date | null;
    readonly _isLiveMode:   boolean;
    //Today's produced kWh from the recorder `change` statistic over the `stat_energy_from` arrays. Null when
    //unconfigured or pre-first-call -> tooltip falls back to trapezoidal integration over `_pvHistory`.
    readonly _haSolarTodayKwh?: number | null;
    //Mutable hover-cursor position as a percent of the visible range (0..100), null when inactive. Written by the
    //pointer handlers below.
    _chartHoverPct:         number | null;
    //Unified 5-day data source, single point of truth for the production + forecast curves. Null only between mount
    //and first build -> chart degrades to an empty curve.
    readonly _unifiedStore: UnifiedDataStore | null;
    //Battery state-of-charge history over the active range (times + %). Drives the 'battery-soc' chart
    //target, read directly here because the store only carries a live SoC sample at the current bucket.
    readonly _batterySocHistory: { times: Date[]; values: number[] } | null;
    //Custom-entity hourly history (values in W) for the 'custom' target curve. Null when unconfigured.
    readonly _customEntityHistory?: { times: Date[]; values: number[] } | null;
    //Active bottom-chart target. Drives which series renderBottomChart draws; defaults to 'production'.
    readonly _chartTarget?: ChartTarget;
}


//Linear-interpolate a (strictly time-ascending) series at a target timestamp. Out-of-range targets clamp to the
//nearest endpoint; NaN slots yield NaN so the caller skips rendering. Shared by the hover tooltip + dot positions
//across the irradiance, cloud and PV curves.
export function interpAt(times: Date[], values: number[], targetMs: number): number
{
    const n = Math.min(times.length, values.length);
    if (n === 0)
    {
        return NaN;
    }
    if (targetMs <= times[0].getTime())
    {
        return isFinite(values[0]) ? values[0] : NaN;
    }
    if (targetMs >= times[n - 1].getTime())
    {
        const v = values[n - 1];
        return isFinite(v) ? v : NaN;
    }
    //Binary search the bracketing pair in O(log n) (early returns above guarantee times[0] < targetMs < times[n-1]).
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1)
    {
        const mid = Math.trunc((lo + hi) / 2);
        if (times[mid].getTime() <= targetMs)
        {
            lo = mid;
        }
        else
        {
            hi = mid;
        }
    }
    const t0 = times[lo].getTime();
    const t1 = times[hi].getTime();
    const v0 = values[lo];
    const v1 = values[hi];
    if (!isFinite(v0) || !isFinite(v1))
    {
        return NaN;
    }
    const dt = t1 - t0;
    if (dt <= 0)
    {
        return v1;
    }
    return v0 + (v1 - v0) * (targetMs - t0) / dt;
}


//Hover-cursor pointer handlers, attached per chart card (its bounding rect drives the fractional X). A press
//(e.buttons !== 0) clears the hover so a scrub drag leaves no stale dot; the scrub itself lives on the time-bar
//pointerdown and captures the pointer until release.
export function handleChartHoverMove(host: ChartHost, e: PointerEvent): void
{
    if (e.buttons !== 0)
    {
        host._chartHoverPct = null;
        return;
    }
    const card = e.currentTarget as HTMLElement | null;
    if (!card)
    {
        return;
    }
    const rect = card.getBoundingClientRect();
    if (rect.width <= 0)
    {
        return;
    }
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    host._chartHoverPct = frac * 100;
}


export function handleChartHoverLeave(host: ChartHost): void
{
    host._chartHoverPct = null;
}


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


//Re-targetable bottom chart. Production keeps its dedicated renderer (forecast + per-source breakdown +
//native-unit scaling); other targets go through the generic renderer below.
export function renderBottomChart(host: ChartHost): TemplateResult
{
    const target = host._chartTarget ?? 'production';
    if (target === 'production')
    {
        return renderPvChart(host);
    }
    return renderTargetChart(host, target);
}


//Accent colour for the active target, shared by the chart border and active chip so re-targeting reads as one
//gesture. Production/irradiance/cloud/soc are fixed; grid/battery take the dominant side over the window.
export function chartAccentColor(host: ChartHost): string
{
    const el = host as unknown as Element; //for live HA theme-token colour resolution
    const target = host._chartTarget ?? 'production';
    if (target === 'production') { return ENERGY_COLOR.pv(el); }
    if (target === 'consumption'){ return ENERGY_COLOR.consumption(el); }
    if (target === 'irradiance') { return ENERGY_COLOR.sun(el); }
    if (target === 'cloud')      { return ENERGY_COLOR.cloud(el); }
    if (target === 'battery-soc'){ return ENERGY_COLOR.batteryOut(el); }
    if (target === 'custom')     { return cssHex(el, '--red-color', '#f44336'); }
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
//curve on a fixed 0..1000 W/m² scale. Power stays in watts (tooltip formats to kW); native-unit handling lives in
//renderPvChart for production only.
function renderTargetChart(host: ChartHost, target: Exclude<ChartTarget, 'production'>): TemplateResult
{
    const el = host as unknown as Element; //for live HA theme-token colour resolution
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

    //Map a store series to visible-range points, dropping nulls and clipping to the window. Bucket centre matches
    //sliceForRange so curves line up with the production chart's day separators.
    const toPts = (arr: readonly (number | null)[], map?: (v: number) => number): { t: number; v: number }[] =>
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
        //Home consumption (load) derived per bucket: production + grid import − grid export − net battery
        //(charge-positive), clamped at 0. Same formula as the live home-usage pill, so chart + chip agree.
        const cons: { t: number; v: number }[] = [];
        for (let i = 0; i < store.production.length; i++)
        {
            const p  = store.production[i];
            const gi = store.gridImport[i];
            const ge = store.gridExport[i];
            const b  = store.battery[i];
            //Skip buckets with no measured data at all, so a gap reads as a gap rather than a flat 0.
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
        //reads distinctly, zero while the other is active.
        const charge    = toPts(store.battery, v => Math.max(0, v));
        const discharge = toPts(store.battery, v => Math.max(0, -v));
        series = [
            { pts: charge,    color: ENERGY_COLOR.batteryIn(el) },
            { pts: discharge, color: ENERGY_COLOR.batteryOut(el) },
        ];
    }
    else if (target === 'battery-soc')
    {
        //Battery SoC over the window, read from the fetched SoC history (the store only has a live sample). One curve
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
        //Custom entity over the window, from the fetched hourly history (values in W). One red curve,
        //magnitude only so a signed sensor reads as a single area; the axis auto-scales.
        const hist = host._customEntityHistory;
        const pts: { t: number; v: number }[] = [];
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const tMs = hist.times[i].getTime();
                if (tMs < startMs || tMs > endMsAbs) { continue; }
                const v = hist.values[i];
                if (!isFinite(v)) { continue; }
                pts.push({ t: tMs, v: Math.abs(v) });
            }
        }
        series = [{ pts, color: cssHex(el, '--red-color', '#f44336') }];
    }
    else if (target === 'cloud')
    {
        //Cloud-cover bands from the hourly weather series, low -> mid -> high. Built at the SAME times so they
        //index-align and stack cleanly (each band continues above the one below); the Y axis auto-scales to the
        //stacked total. Light -> dark cloud-grey shades.
        const cs = host._chartSeries;
        const lowPts:  { t: number; v: number }[] = [];
        const midPts:  { t: number; v: number }[] = [];
        const highPts: { t: number; v: number }[] = [];
        if (cs)
        {
            for (let i = 0; i < cs.times.length; i++)
            {
                const tMs = cs.times[i].getTime();
                if (tMs < startMs || tMs > endMsAbs) { continue; }
                const lo = cs.cloudLow[i];
                const mi = cs.cloudMid[i];
                const hi = cs.cloudHigh[i];
                if (!(isFinite(lo) || isFinite(mi) || isFinite(hi))) { continue; }
                lowPts.push( { t: tMs, v: isFinite(lo) ? Math.max(0, lo) : 0 });
                midPts.push( { t: tMs, v: isFinite(mi) ? Math.max(0, mi) : 0 });
                highPts.push({ t: tMs, v: isFinite(hi) ? Math.max(0, hi) : 0 });
            }
        }
        //Three clearly distinct cloud-grey levels (low = lightest, high = darkest) so the stacked layers read
        //as separate bands at the higher fill opacity, not one flat grey.
        series = [
            { pts: lowPts,  color: lerpHexToward(ENERGY_COLOR.cloud(el), '#ffffff', 0.55) },
            { pts: midPts,  color: ENERGY_COLOR.cloud(el) },
            { pts: highPts, color: lerpHexToward(ENERGY_COLOR.cloud(el), '#000000', 0.50) },
        ];
        fixedMax = 0;
    }
    else
    {
        series   = [{ pts: toPts(store.irradiance), color: ENERGY_COLOR.sun(el) }];
        fixedMax = 1000;
    }

    //Among the generic targets only the cloud bands stack (low + mid + high layer up to the total sky cover);
    //per-source PV stacks in renderPvChart. The two-direction targets (grid import/export, battery
    //charge/discharge) draw both areas from the baseline so each flow reads on its own — stacking them would
    //sum two opposite flows into a meaningless total.
    const isStacked = target === 'cloud'
        && series.length > 1
        && series.every(s => s.pts.length === series[0].pts.length && s.pts.length >= 2);

    //Y scale: fixed where set, else auto — to the stacked total when stacked, else the per-series running max.
    let yMax = fixedMax;
    if (yMax <= 0)
    {
        yMax = 1;
        if (isStacked)
        {
            const N = series[0].pts.length;
            for (let j = 0; j < N; j++)
            {
                let total = 0;
                for (const s of series) { total += s.pts[j].v; }
                if (total > yMax) { yMax = total; }
            }
        }
        else
        {
            for (const s of series) { for (const p of s.pts) { if (p.v > yMax) { yMax = p.v; } } }
        }
    }
    //Leave a sliver of headroom at the top so a curve's peak never kisses the timeline's top edge.
    const TOP_HEADROOM_PX = 10;
    const yOf = (v: number): number => H - Math.max(0, Math.min(1, v / yMax)) * (H - TOP_HEADROOM_PX);

    let drawn: { area: string; line: string; color: string; total: number }[];
    if (isStacked)
    {
        const N = series[0].pts.length;
        const lower = new Array<number>(N).fill(0);
        drawn = series.map(s =>
        {
            const up: string[] = [];
            const lo: string[] = [];
            for (let j = 0; j < N; j++)
            {
                const y0 = lower[j];
                const y1 = y0 + s.pts[j].v;
                lower[j] = y1;
                up.push(`${xOf(s.pts[j].t).toFixed(2)},${yOf(y1).toFixed(2)}`);
                lo.push(`${xOf(s.pts[j].t).toFixed(2)},${yOf(y0).toFixed(2)}`);
            }
            const line = `M ${up.join(' L ')}`;
            return {
                area:  `M ${up.join(' L ')} L ${lo.reverse().join(' L ')} Z`,
                line,
                color: s.color,
                total: sum(s.pts),
            };
        });
    }
    else
    {
        drawn = series.map(s =>
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
        //Stacked: the dot rides the cumulative TOP of each band (the stacked curve), not the raw value, so it
        //sits on the visible boundary. Unstacked: the dot rides the series' own value.
        let cum = 0;
        for (const s of series)
        {
            if (s.pts.length < 1) { continue; }
            const v = interpAt(s.pts.map(p => new Date(p.t)), s.pts.map(p => p.v), hoverMs);
            if (!isFinite(v)) { continue; }
            if (isStacked)
            {
                cum += Math.max(0, v);
                hoverDots.push({ y: yOf(cum), color: s.color });
            }
            else
            {
                hoverDots.push({ y: yOf(Math.max(0, v)), color: s.color });
            }
            showHover = true;
        }
    }

    return html`
        <svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            ${dayXs.map(x => svg`
                <line class="hc-day-sep" x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${H}"></line>
            `)}
            <g class="hc-chart-grow">
                ${drawn.map(d => d.area ? svg`
                    <path d="${d.area}" fill="${d.color}" fill-opacity="${isStacked ? '0.6' : '0.22'}"></path>
                ` : nothing)}
                ${drawn.map(d => d.line ? svg`
                    <path class="hc-chart-line" d="${d.line}" stroke="${d.color}"></path>
                ` : nothing)}
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


//The thin track carries only the cursors; day separators live inside the chart card SVG and the scrub time label is
//a chip above the card.
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


//Adaptive timeline labels over the chart-card footer. The shared timeline model picks granularity from the visible
//span (hours / weekdays / day+month / months) and thins the count so a wide window stays legible. Each label sits
//at its model fraction; the day view emphasises today, matching the now-cursor. Separators draw boundary lines.
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
    //Emphasise today only in the day view (each label names one calendar day); on wider spans the now-cursor already
    //marks the present.
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



//kWh-per-day totals over the active range, from two sources: past + today-so-far from the recorder `change` buckets
//(Pass 1), today-remainder + future from the store's corrected forecast (Pass 2). Returns a Map keyed by each day's
//local-midnight ms (kWh); days outside the range or without usable data are omitted.
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
    //the watt-hour (no curve integration / gap interpolation, which was inflating totals). The series spans the J-2
    //past window, covering every past day shown.
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

    //Pass 2: future + today-remainder from the store's CORRECTED forecast (same series the dotted curve draws), so
    //per-day chips agree with the curve. Only buckets at / after "now" contribute (past is Pass 1's real production);
    //the forecast is already cap-clipped and correction-applied.
    const store = host._unifiedStore;
    if (store)
    {
        const nowMs = Date.now();
        const stepH = store.stepMs / 3_600_000;   //bucket length in hours
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
