//The timeline's rolling-window modes. One spec per mode drives the whole pipeline (the store window and whether
//weather is available), so adding/tuning a mode is a one-line change here. The store cadence and recorder fetch
//period derive from the user's data-detail setting (display-update-frequency-per-hour, 1..12) capped per mode, not
//hard-coded, so the editor knob drives every mode, not just Now. The scrub is free (no quantisation) in every mode.

import type { StatPeriod } from './energy-stats';
import { displayUpdateFrequencyPerHour, type HeliosConfig } from '../helios-config';

export type TimelineMode = 'standard' | 'today' | 'week' | 'month' | 'year';

export interface TimelineModeSpec
{
    //Days of history in the window. A function for month/year: the window length tracks the PREVIOUS calendar
    //month/year (so a 31-day month shows 31 days), always ending today.
    pastDays:    number | (() => number);
    futureDays:  number;       //days of forecast (Standard only; the "past" modes end today, no forecast)
    weather:     boolean;      //irradiance + cloud available (Open-Meteo forecast only reaches ~16 days)
    //Cap on store buckets/hour for this window: short windows honour the user's setting fully; month is capped
    //at hourly and year at daily so a long window can't pull a year of 5-min rows.
    maxBucketsPerHour: number;
}

//Order shown in the selector, left -> right.
export const TIMELINE_MODE_ORDER: TimelineMode[] = ['standard', 'today', 'week', 'month', 'year'];

//Day count of the calendar month / year BEFORE the current one, so the month/year windows match the previous
//period's real length and end on today.
function daysInPrevMonth(): number
{
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 0).getDate();
}
function daysInPrevYear(): number
{
    const y = new Date().getFullYear() - 1;
    return (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86_400_000;
}

export const TIMELINE_MODES: Record<TimelineMode, TimelineModeSpec> = {
    //Standard: J-2 .. J+2 (past, today, forecast) - the at-a-glance default. today/week/month/year all END today.
    standard: { pastDays: 2,                            futureDays: 2, weather: true,  maxBucketsPerHour: 12   },
    today:    { pastDays: 0,                            futureDays: 0, weather: true,  maxBucketsPerHour: 12   },
    week:     { pastDays: 6,                            futureDays: 0, weather: true,  maxBucketsPerHour: 12   },
    month:    { pastDays: () => daysInPrevMonth() - 1,  futureDays: 0, weather: false, maxBucketsPerHour: 1    },
    year:     { pastDays: () => daysInPrevYear() - 1,   futureDays: 0, weather: false, maxBucketsPerHour: 1 / 24 },
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
//contains whole source buckets: sub-hourly cadence -> '5minute', hourly -> 'hour', daily -> 'day'.
export function modeFetchPeriod(mode: TimelineMode, config: HeliosConfig | undefined): StatPeriod
{
    const bph = modeBucketsPerHour(mode, config);
    if (bph >= 2) { return '5minute'; }
    if (bph >= 1) { return 'hour'; }
    return 'day';
}
