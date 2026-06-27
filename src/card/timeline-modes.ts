//The timeline's rolling-window modes. One spec per mode drives the whole pipeline — the store window and whether
//weather (irradiance/cloud) is available — so adding/tuning a mode is a one-line change here. The store CADENCE
//and the recorder FETCH PERIOD are derived from the user's "Détails du graphique" setting
//(display-update-frequency-per-hour, 1..12) capped per mode, NOT hard-coded — so the editor knob drives every
//mode, not just Now. The scrub is free (no quantisation) in every mode.

import type { StatPeriod } from './energy-stats';
import { displayUpdateFrequencyPerHour, type HeliosConfig } from '../helios-config';

export type TimelineMode = 'now' | 'week' | 'month' | 'year';

export interface TimelineModeSpec
{
    pastDays:    number;       //days of history in the window
    futureDays:  number;       //days of forecast (Now only — the past modes have no forecast)
    weather:     boolean;      //irradiance + cloud available (Open-Meteo forecast only reaches ~16 days)
    //Cap on store buckets/hour for this window: Now + week honour the user's setting fully; month is capped at
    //hourly and year at daily so a long window can't pull a year of 5-min rows.
    maxBucketsPerHour: number;
}

//Order shown in the selector, left -> right.
export const TIMELINE_MODE_ORDER: TimelineMode[] = ['now', 'week', 'month', 'year'];

export const TIMELINE_MODES: Record<TimelineMode, TimelineModeSpec> = {
    now:   { pastDays: 0,   futureDays: 1, weather: true,  maxBucketsPerHour: 12   },
    week:  { pastDays: 7,   futureDays: 0, weather: true,  maxBucketsPerHour: 12   },
    month: { pastDays: 30,  futureDays: 0, weather: false, maxBucketsPerHour: 1    },
    year:  { pastDays: 365, futureDays: 0, weather: false, maxBucketsPerHour: 1 / 24 },
};

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
