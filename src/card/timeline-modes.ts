//The timeline's rolling-window modes. One spec per mode drives the whole pipeline — the store window + cadence,
//the recorder fetch period for the energy series, whether weather (irradiance/cloud) is available, and how the
//scrub quantises — so adding/tuning a mode is a one-line change here, not a hunt across the card.

import { HOUR_MS, DAY_MS } from '../constants';
import type { StatPeriod } from './energy-stats';
import { displayUpdateFrequencyPerHour, type HeliosConfig } from '../helios-config';

export type TimelineMode = 'now' | 'week' | 'month' | 'year';

export interface TimelineModeSpec
{
    pastDays:    number;       //days of history in the window
    futureDays:  number;       //days of forecast (Now only — the past modes have no forecast)
    fetchPeriod: StatPeriod;   //recorder period for the energy change-series ('5minute' | 'hour' | 'day')
    weather:     boolean;      //irradiance + cloud available (Open-Meteo forecast only reaches ~16 days)
    snapMs:      number;       //scrub quantisation step (0 = free / max precision)
    snapHour:    number | null;//day-stepped modes pin the selected time to this hour-of-day (e.g. 12:00)
}

//Order shown in the selector, left -> right.
export const TIMELINE_MODE_ORDER: TimelineMode[] = ['now', 'week', 'month', 'year'];

export const TIMELINE_MODES: Record<TimelineMode, TimelineModeSpec> = {
    now:   { pastDays: 0,   futureDays: 1, fetchPeriod: '5minute', weather: true,  snapMs: 0,       snapHour: null },
    week:  { pastDays: 7,   futureDays: 0, fetchPeriod: 'hour',    weather: true,  snapMs: HOUR_MS, snapHour: null },
    month: { pastDays: 30,  futureDays: 0, fetchPeriod: 'day',     weather: false, snapMs: DAY_MS,  snapHour: 12   },
    year:  { pastDays: 365, futureDays: 0, fetchPeriod: 'day',     weather: false, snapMs: DAY_MS,  snapHour: 12   },
};

//Store cadence (buckets/hour) for a mode. Now honours the user's display-update-frequency (fine, e.g. 15-min),
//a week steps hourly, month/year step daily (a fraction of an hour). The store derives stepMs + bucketsTotal
//from this, so a fractional value (1/24 = one bucket per day) is valid.
export function modeBucketsPerHour(mode: TimelineMode, config: HeliosConfig | undefined): number
{
    switch (mode)
    {
        case 'now':  return displayUpdateFrequencyPerHour(config);
        case 'week': return 1;
        default:     return 1 / 24;   //month + year: one bucket per day
    }
}
