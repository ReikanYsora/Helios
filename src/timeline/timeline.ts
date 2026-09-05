//Timeline subsystem: the periodic tick that advances the live cursor and re-projects the screen-space
//overlays, plus the pointer handlers that scrub the timeline into the past.
//
//Host-driven like the data modules: the card owns the `@state` timeline fields, the functions here read/write them
//through a structural TimelineHost interface and Lit's reactivity falls out on every assignment.

import type { HeliosConfig } from '../core/config/helios-config';
import { refreshHud, type HudHost } from '../hud/hud';
import type { HeliosEngine } from '../scene/helios-engine';
import type { ChartSeries } from '../charts/charts';
import type { TimelineMode } from './timeline-modes';


//Bound pointer-handler references the host keeps so it can add/remove the same listener instance.
type PointerHandler = (e: PointerEvent) => void;

//Structural surface the host card exposes here. Extends HudHost so the periodic tick can fire refreshHud(host).
export interface TimelineHost extends HudHost
{
    readonly config:    HeliosConfig | undefined;
    readonly _engine?:  HeliosEngine;

    _timeRange:         { start: Date; end: Date } | null;
    _selectedTime:      Date | null;
    _isLiveMode:        boolean;
    _now:               Date;
    _chartSeries:       ChartSeries | null;
    //Active timeline mode (window span + weather availability).
    readonly _timelineMode: TimelineMode;

    //Hover cursor position on the timeline charts. The scrub handler writes it in lock-step with _selectedTime so the
    //hover tooltip + per-curve dots follow a touch drag on mobile, where the chart-card pointer handlers don't fire
    //once the time-bar captures the pointer.
    _chartHoverPct:     number | null;

    _trackElement:      HTMLElement | null;
    _trackPointerId:    number | null;
    boundPointerMove:  PointerHandler;
    boundPointerUp:    PointerHandler;
}


//Re-renders the card on a 30 s cadence: in live mode advances the HH:MM header and live cursor; in scrubbed mode the
//header shows the selected instant while the live cursor keeps moving as wall-clock time progresses. PV/battery live
//readings update on HA state changes, not this tick. The display only shows HH:MM, so bail when the minute/hour/day
//hasn't changed to avoid a full Lit re-render with no visible delta (wasted renders add up with several cards).
export function tick(host: TimelineHost): void
{
    const next = new Date();
    const prev = host._now;
    if (next.getMinutes() === prev.getMinutes()
        && next.getHours()   === prev.getHours()
        && next.getDate()    === prev.getDate()
        && next.getMonth()   === prev.getMonth()
        && next.getFullYear()=== prev.getFullYear())
    {
        return;
    }
    //Day rollover: getTimelineRange() is computed off "today midnight - N past days", so crossing midnight must shift
    //the window by 24 h. Without this refetch the timeline stays stuck on the previous day's window until the next
    //weather push.
    const dayRolledOver = next.getDate()     !== prev.getDate()
        || next.getMonth()    !== prev.getMonth()
        || next.getFullYear() !== prev.getFullYear();
    host._now = next;
    if (dayRolledOver && host._engine)
    {
        const range = host._engine.getTimelineRange();
        if (range)
        {
            host._timeRange = range;
        }
        host._chartSeries = host._engine.getTimelineSeries() ?? host._chartSeries;
    }
    //The sun moves with time, so refresh its screen-space position. The other refreshHud parts are camera-driven and
    //won't change here, but recomputing them is cheap and keeps the path uniform.
    refreshHud(host);
}


//Start scrubbing on pointer-down. Captures the pointer so subsequent moves and the eventual up land on the same
//track regardless of drag position.
export function onTimelinePointerDown(host: TimelineHost, e: PointerEvent): void
{
    if (!host._timeRange)
    {
        return;
    }
    //Ignore a second (multi-touch) pointer while one is already tracking: otherwise it overwrites _trackPointerId,
    //and the first pointer's pointerup then hits the id guard and never releases its capture or listeners.
    if (host._trackPointerId !== null)
    {
        return;
    }
    const track = e.currentTarget as HTMLElement;
    track.setPointerCapture(e.pointerId);
    host._trackElement   = track;
    host._trackPointerId = e.pointerId;
    track.addEventListener('pointermove',   host.boundPointerMove);
    track.addEventListener('pointerup',     host.boundPointerUp);
    track.addEventListener('pointercancel', host.boundPointerUp);
    applyTimelinePointer(host, e);
}


//rAF-coalesced scrub position, mirroring flushPendingHover's pattern (timeline-tooltip.ts): a raw pointermove
//stream during a drag can fire many times per frame, and applyTimelinePosition's downstream cost (selected-time
//resolution, weather/ground repaint) is worth coalescing to one update per frame. track + clientX are captured
//synchronously (currentTarget resets to null once the event finishes dispatching, so it can't be read back
//inside the deferred rAF callback) - only the position write itself is deferred.
let _scrubRafId:   number | null = null;
let _scrubHost:    TimelineHost | null = null;
let _scrubTrack:   HTMLElement | null = null;
let _scrubClientX = 0;

function flushPendingScrub(): void
{
    _scrubRafId = null;
    const host  = _scrubHost;
    const track = _scrubTrack;
    _scrubHost  = null;
    _scrubTrack = null;
    if (host && track)
    {
        applyTimelinePosition(host, track, _scrubClientX);
    }
}

export function onTimelinePointerMove(host: TimelineHost, e: PointerEvent): void
{
    if (e.pointerId !== host._trackPointerId)
    {
        return;
    }
    _scrubHost    = host;
    _scrubTrack   = e.currentTarget as HTMLElement;
    _scrubClientX = e.clientX;
    if (_scrubRafId !== null)
    {
        cancelAnimationFrame(_scrubRafId);
    }
    _scrubRafId = requestAnimationFrame(flushPendingScrub);
}


export function onTimelinePointerUp(host: TimelineHost, e: PointerEvent): void
{
    if (e.pointerId !== host._trackPointerId)
    {
        return;
    }
    //A scrub position is a committed value on release, not a transient hover indicator like flushPendingHover's -
    //flush any still-queued frame synchronously rather than leave up to one frame of drag dropped on the floor.
    if (_scrubRafId !== null)
    {
        cancelAnimationFrame(_scrubRafId);
        flushPendingScrub();
    }
    const track = host._trackElement;
    if (track)
    {
        try
        {
            track.releasePointerCapture(e.pointerId);
        }
        catch (_)
        { /* pointer capture may already be released */ }
        track.removeEventListener('pointermove',   host.boundPointerMove);
        track.removeEventListener('pointerup',     host.boundPointerUp);
        track.removeEventListener('pointercancel', host.boundPointerUp);
    }
    host._trackElement   = null;
    host._trackPointerId = null;
    //Drop the hover so the tooltip + dots disappear cleanly on touch release; desktop hover keeps using the
    //chart-card handlers above.
    host._chartHoverPct  = null;
}


//Snap the timeline back to live: drop the scrub selection, re-enter live mode, and let the scene engine follow "now"
//again. Shared by the magnet snap and the explicit Live button.
export function returnTimelineToLive(host: TimelineHost): void
{
    host._selectedTime  = null;
    host._isLiveMode    = true;
    host._chartHoverPct = null;
    host._engine?.setSelectedTime(null);
}


export function applyTimelinePointer(host: TimelineHost, e: PointerEvent): void
{
    applyTimelinePosition(host, e.currentTarget as HTMLElement, e.clientX);
}

function applyTimelinePosition(host: TimelineHost, track: HTMLElement, clientX: number): void
{
    if (!host._timeRange)
    {
        return;
    }
    const rect    = track.getBoundingClientRect();
    const frac    = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rangeMs = host._timeRange.end.getTime() - host._timeRange.start.getTime();
    const tMs     = host._timeRange.start.getTime() + frac * rangeMs;

    //Live magnetism: snap back to live mode when the pointer lands within MAGNET_PX of the "now" pixel column. Tight
    //(8 px) so it only fires when almost exactly on the live cursor; the tooltip's restore-tab cue signals the snap
    //zone before release.
    const MAGNET_PX = 8;
    const nowMs     = Date.now();
    const rangeStart = host._timeRange.start.getTime();
    const rangeEnd   = host._timeRange.end.getTime();
    if (nowMs >= rangeStart && nowMs <= rangeEnd)
    {
        const nowFrac    = (nowMs - rangeStart) / rangeMs;
        const nowXPx     = rect.left + nowFrac * rect.width;
        const pointerXPx = clientX;
        if (Math.abs(pointerXPx - nowXPx) <= MAGNET_PX)
        {
            if (!host._isLiveMode || host._selectedTime !== null)
            {
                returnTimelineToLive(host);
            }
            return;
        }
    }

    const t = new Date(tMs);
    if (host._selectedTime && host._selectedTime.getTime() === t.getTime())
    {
        return;
    }

    host._selectedTime  = t;
    host._isLiveMode    = false;
    //Cursor follows the pointer exactly (no snap), in lockstep with the hover tooltip, so click + drag feel as fine
    //as hover. The engine resolves the instant to the right hourly weather bucket on its own.
    host._chartHoverPct = frac * 100;
    host._engine?.setSelectedTime(t);
}




