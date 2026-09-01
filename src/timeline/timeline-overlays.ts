//Sun/night geometry for the timeline: the sun-altitude crossing search, the memoised per-day night intervals, and the
//night-zone + future-mask overlays.

import type { TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import { getHomeCoords } from '../card/init';
import { getSunPosition } from '../core/time/sun';
import { resolveRangeMs } from './timeline-model';
import type { ChartHost } from '../charts/charts';


//Binary-search the sun's altitude=0 crossing inside [dayStart, dayEnd] in the requested direction. Null during polar
//day/night (no crossing) or a degenerate bracket. Coarse 1-hour scan + 12 bisection iterations reach seconds
//precision in ~22 getSunPosition calls, well under the per-frame budget.
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
//Memoised: night zones depend only on the window + home coords, stable across the frequent scrub + auto-rotate
//renders (those move _selectedTime / the camera, not _timeRange). Without it the ~700 getSunPosition calls below
//ran on every such render. One slot per host (WeakMap), not a single global slot: two cards showing the same
//home at different time windows (e.g. one "Now", one "Week") would otherwise evict each other's entry on every
//render.
const _nightMemo = new WeakMap<ChartHost, { key: string; out: { startPct: number; endPct: number }[] }>();

function computeNightIntervals(host: ChartHost): { startPct: number; endPct: number }[]
{
    const r = resolveRangeMs(host._timeRange);
    if (!r)
    {
        return [];
    }
    const coords = getHomeCoords(host.config, host.hass);
    if (!coords)
    {
        return [];
    }
    const { startMs, endMs, rangeMs } = r;
    const memoKey = `${startMs}|${endMs}|${coords.lat.toFixed(4)}|${coords.lon.toFixed(4)}`;
    const cached  = _nightMemo.get(host);
    if (cached && cached.key === memoKey)
    {
        return cached.out;
    }

    interface Crossing { ms: number; kind: 'sunrise' | 'sunset' }
    const crossings: Crossing[] = [];

    const cursor = new Date(startMs);
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
    _nightMemo.set(host, { key: memoKey, out });
    return out;
}


//Night-zone overlays: one absolutely-positioned low-alpha-wash div per night interval, inside the chart card so it
//inherits its positioning + clipping. z-index sits above the SVG curves but below the cursors (z-index 4).
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
//z-index-4 cursors). Anchored to "now" so the forecast side reads behind a wash. Nothing when "now" is outside the
//range, so the mask never shrinks to a sliver or fills the whole card.
export function renderTimelineFutureMask(host: ChartHost): TemplateResult | typeof nothing
{
    const r = resolveRangeMs(host._timeRange);
    if (!r)
    {
        return nothing;
    }
    const { startMs, endMs, rangeMs } = r;
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


