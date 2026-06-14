//Timeline subsystem: the periodic clock tick that advances the live cursor and re-projects the screen-space overlays, plus the pointer handlers that
//scrub the timeline into the past.
//
//Same host-driven pattern as the data modules: the card owns the `@state` timeline fields, the functions here read / write them through a structural
//TimelineHost interface and Lit's reactivity falls out naturally on every assignment.

import type { HeliosConfig } from '../helios-config';
import { refreshOverlays, type OverlaysHost } from './overlays';
import type { HeliosEngine } from '../helios-engine';
import type { ChartSeries } from './charts';


//Structural surface the host card exposes to this module. Extends
//OverlaysHost so the clock tick can fire refreshOverlays(host) on
//the same value without juggling two parameters.
export interface TimelineHost extends OverlaysHost
{
    readonly config:    HeliosConfig | undefined;
    readonly _engine?:  HeliosEngine;

    _timeRange:         { start: Date; end: Date } | null;
    _selectedTime:      Date | null;
    _isLiveMode:        boolean;
    _now:               Date;
    _chartSeries:       ChartSeries | null;

    //Hover cursor position on the timeline charts. The scrub handler
    //below writes it in lock-step with _selectedTime so the hover
    //tooltip + per-curve dots follow a touch drag on mobile (the
    //chart-card pointer handlers don't fire once the time-bar
    //captures the pointer; updating from here gives mobile users the
    //same readout desktop users get on hover).
    _chartHoverPct:     number | null;

    _trackElement:      HTMLElement | null;
    _trackPointerId:    number | null;
    _boundPointerMove:  (e: PointerEvent) => void;
    _boundPointerUp:    (e: PointerEvent) => void;
}


//Re-renders the card every 30 seconds.
//  - In live mode this advances both the HH:MM clock display
//    (seconds were dropped to allow the slower cadence) and the
//    live cursor on the timeline.
//  - In scrubbed mode the clock shows the selected instant and the
//    live cursor still continues to move underneath as wall-clock
//    time progresses.
//PV and battery live readings update on Home Assistant state
//changes, not on this tick, so they stay real-time regardless.
//
//Skip the _now / refreshOverlays update when neither the minute
//the live cursor display HH:MM at most, so a 30 s tick that lands
//inside the same minute would cascade into a full Lit re-render
//(template + arc + chart + dome) for no visible delta. On a busy
//dashboard with several Helios cards, those wasted renders add up.
export function tick(host: TimelineHost): void
{
    const next = new Date();
    const prev = host._now;
    if (prev
        && next.getMinutes() === prev.getMinutes()
        && next.getHours()   === prev.getHours()
        && next.getDate()    === prev.getDate()
        && next.getMonth()   === prev.getMonth()
        && next.getFullYear()=== prev.getFullYear())
    {
        return;
    }
    //Day rollover: the engine's getTimelineRange() is computed off
    //"today midnight - N past days", so when the clock crosses
    //midnight the window must shift by 24 h. Without this refetch
    //the timeline kept showing the previous day's 5-day window
    //(stuck on 4 visible days) until the next weather push hit.
    const dayRolledOver = !prev
        || next.getDate()     !== prev.getDate()
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
    //The sun moves with time, so refresh its screen-space
    //position too. The other parts of refreshOverlays
    //(percentage label) are camera-driven and won't change
    //here, but recomputing them is cheap and keeps the code
    //path uniform.
    refreshOverlays(host);
}


//Start scrubbing on pointer-down. Captures the pointer so subsequent moves and the eventual up land on the same track element regardless of where the
//user drags. Swallowed during the engine's post-exit cooldown so the click that dismissed the dashboard panel can't bleed into an immediate scrub on
//the timeline behind it.
export function onTimelinePointerDown(host: TimelineHost, e: PointerEvent): void
{
    if (!host._timeRange)
    {
        return;
    }
    if (host._engine?.isUserGestureSuppressed())
    {
        return;
    }
    const track = e.currentTarget as HTMLElement;
    track.setPointerCapture(e.pointerId);
    host._trackElement   = track;
    host._trackPointerId = e.pointerId;
    track.addEventListener('pointermove',   host._boundPointerMove);
    track.addEventListener('pointerup',     host._boundPointerUp);
    track.addEventListener('pointercancel', host._boundPointerUp);
    applyTimelinePointer(host, e);
}


export function onTimelinePointerMove(host: TimelineHost, e: PointerEvent): void
{
    if (e.pointerId !== host._trackPointerId)
    {
        return;
    }
    applyTimelinePointer(host, e);
}


export function onTimelinePointerUp(host: TimelineHost, e: PointerEvent): void
{
    if (e.pointerId !== host._trackPointerId)
    {
        return;
    }
    const track = host._trackElement;
    if (track)
    {
        try
        {
            track.releasePointerCapture(e.pointerId);
        }
        catch (_) {}
        track.removeEventListener('pointermove',   host._boundPointerMove);
        track.removeEventListener('pointerup',     host._boundPointerUp);
        track.removeEventListener('pointercancel', host._boundPointerUp);
    }
    host._trackElement   = null;
    host._trackPointerId = null;
    //Drop the hover once the gesture ends so the tooltip + dots disappear cleanly on touch release. Desktop hover keeps using the chart-card pointer
    //handlers above this layer.
    host._chartHoverPct  = null;
}


//Translate the pointer's clientX into a timestamp inside the active
//time range and pin the card into scrubbed mode. No hour-snap on the
//selected time: the previous behaviour rounded to the nearest full
//hour, which made the sun arc and the cloud dome jerk forward in 1 h
//jumps as the user dragged the cursor. Sub-hour timestamps still
//resolve to the right hourly bucket for weather variables (which are
//only published hourly) via nearest-hour lookup in the engine, so we
//keep accuracy where it matters and animate the sun position smoothly
//where it doesn't.
export function applyTimelinePointer(host: TimelineHost, e: PointerEvent): void
{
    if (!host._timeRange)
    {
        return;
    }
    const track   = e.currentTarget as HTMLElement;
    const rect    = track.getBoundingClientRect();
    const frac    = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rangeMs = host._timeRange.end.getTime() - host._timeRange.start.getTime();
    const tMs     = host._timeRange.start.getTime() + frac * rangeMs;

    //Live magnetism: snap back to live mode whenever the pointer
    //lands within MAGNET_PX of the "now" pixel column. Kept tight
    //(8 px ring) so the snap only fires when the pointer is almost
    //exactly on the live cursor; the tooltip's restore-tab cue
    //signals the snap zone before the user releases.
    const MAGNET_PX = 8;
    const nowMs     = Date.now();
    const rangeStart = host._timeRange.start.getTime();
    const rangeEnd   = host._timeRange.end.getTime();
    if (nowMs >= rangeStart && nowMs <= rangeEnd)
    {
        const nowFrac    = (nowMs - rangeStart) / rangeMs;
        const nowXPx     = rect.left + nowFrac * rect.width;
        const pointerXPx = e.clientX;
        if (Math.abs(pointerXPx - nowXPx) <= MAGNET_PX)
        {
            if (!host._isLiveMode || host._selectedTime !== null)
            {
                host._selectedTime  = null;
                host._isLiveMode    = true;
                host._chartHoverPct = null;
                host._engine?.setSelectedTime(null);
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
    host._chartHoverPct = frac * 100;
    host._engine?.setSelectedTime(t);
}




