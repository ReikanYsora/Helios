//Sun/night geometry for the timeline: the sun-altitude crossing search, the memoised per-day night intervals, the
//night-zone + future-mask overlays, and the per-source production shares for the home histogram.

import type { TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import { energySolarColor } from './format';
import { pvNormalizeToWatts } from './pv';
import { getHomeCoords } from './init';
import { getSunPosition } from '../engine/sun';
import { type ChartHost, chartIsDark } from './charts';
import { pvValueAtTime } from './series-sample';


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
