//The timeline's rolling-window modes. One spec per mode drives the whole pipeline (the store window and whether
//weather is available), so adding/tuning a mode is a one-line change here. The store cadence and recorder fetch
//period derive from the user's data-detail setting (display-update-frequency-per-hour, 1..12) capped per mode, not
//hard-coded, so the editor knob drives every mode, not just the J - J+2 window. The scrub is free (no
//quantisation) in every mode.

import type { StatPeriod } from '../data/sources/energy-stats';
import { displayUpdateFrequencyPerHour, type HeliosConfig } from '../core/config/helios-config';

export type TimelineMode = 'forecast' | 'yesterday' | 'today' | 'week' | 'month';

export interface TimelineModeSpec
{
    //Days of history in the window. A function for month: the window length tracks the PREVIOUS calendar month (so
    //a 31-day month shows 31 days), always ending today.
    pastDays:    number | (() => number);
    futureDays:  number;       //days of forecast (J - J+2 mode only; the "past" modes end today, no forecast)
    weather:     boolean;      //irradiance + cloud available (Open-Meteo forecast only reaches ~16 days)
    //Cap on store buckets/hour for this window: short windows honour the user's setting fully; month is capped at
    //hourly so a 31-day window can't pull a month of 5-min rows.
    maxBucketsPerHour: number;
}

//Order shown in the selector, left -> right.
export const TIMELINE_MODE_ORDER: TimelineMode[] = ['forecast', 'yesterday', 'today', 'week', 'month'];

//Day count of the calendar month BEFORE the current one, so the month window matches its real length and ends
//on today.
function daysInPrevMonth(): number
{
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 0).getDate();
}

export const TIMELINE_MODES: Record<TimelineMode, TimelineModeSpec> = {
    //J - J+2 (id 'forecast', its former name): today + the two days ahead, so 3 days - the at-a-glance default. It carried J-1 as well,
    //which spent a quarter of the width on a day that is already its own mode next door. today/week/month/year all
    //END today.
    forecast:  { pastDays: 0,                           futureDays: 2, weather: true,  maxBucketsPerHour: 12   },
    //Yesterday: EXACTLY the previous day. futureDays -1 ends the window at today's midnight (start + storeDays =
    //past 1 + 1 - 1 = 1 day), so the timeline shows only J-1, not J-1..today.
    yesterday: { pastDays: 1,                           futureDays: -1, weather: true, maxBucketsPerHour: 12   },
    today:     { pastDays: 0,                           futureDays: 0, weather: true,  maxBucketsPerHour: 12   },
    week:     { pastDays: 6,                            futureDays: 0, weather: true,  maxBucketsPerHour: 12   },
    //Month is the long view, and the last one the SCENE can still speak for: its store stays hourly, so any day of
    //it can be scrubbed to and read under that day's own sun. A year mode on a DAILY store would carry no shape of
    //a day at all, nothing the arc, the shadows or the curve could illustrate, and 365 bars two pixels wide for the
    //eye, a whole second data path to say less than the Energy dashboard already says better.
    month:    { pastDays: () => daysInPrevMonth() - 1,  futureDays: 0, weather: false, maxBucketsPerHour: 1    },
};

//Resolved window lengths (resolves the month/year functions to a concrete day count for today).
export function modePastDays(mode: TimelineMode): number
{
    const p = TIMELINE_MODES[mode].pastDays;
    return typeof p === 'function' ? p() : p;
}
export function modeFutureDays(mode: TimelineMode): number
{
    return TIMELINE_MODES[mode].futureDays;
}

//Store cadence (buckets/hour) for a mode = the user's display-update-frequency, capped to the mode's ceiling.
//The store derives stepMs + bucketsTotal from this; a fractional value (1/24 = one bucket per day) is valid.
export function modeBucketsPerHour(mode: TimelineMode, config: HeliosConfig | undefined): number
{
    return Math.min(displayUpdateFrequencyPerHour(config), TIMELINE_MODES[mode].maxBucketsPerHour);
}

//Recorder period for the energy change-series, derived from the resolved cadence so each store bucket always
//contains whole source buckets: sub-hourly cadence -> '5minute', hourly -> 'hour'.
export function modeFetchPeriod(mode: TimelineMode, config: HeliosConfig | undefined): StatPeriod
{
    const bph = modeBucketsPerHour(mode, config);
    if (bph >= 2)
    {
        return '5minute';
    }
    if (bph >= 1)
    {
        return 'hour';
    }
    return 'day';
}
