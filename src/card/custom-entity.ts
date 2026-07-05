//User-picked "custom" entity for the red chip + leader bead, measured-only: the id every function receives
//here is the POWER sensor (customEntityId gates on both halves being configured, and resolves to the power
//one). The chip and scrub read that sensor's state and recorded mean, never a value derived from the energy
//meter; the energy meter half feeds the energy surfaces. The value's sign drives bead direction (positive =
//home to chip, negative = chip to home); its magnitude drives cadence.

import { pvNormalizeToWatts } from './format';
import { type HeliosConfig, customEntityId } from '../helios-config';
import { callWSWithTimeout } from './ws-timeout';
import type { StatPeriod } from './energy-stats';

export interface CustomEntityLive
{
    name: string;   //friendly name (honours a user override) or the entity id, for the chip's title
}

export function resolveCustomEntityLive(hass: any, entityId: string): CustomEntityLive | null
{
    if (!entityId) { return null; }
    const st = hass?.states?.[entityId];
    if (!st) { return null; }
    const raw = parseFloat(st.state);
    if (!isFinite(raw)) { return null; }
    return { name: String(st.attributes?.friendly_name ?? entityId) };
}

//Step-sample the watts history (built by refreshCustomEntity) at an instant: the last bucket at or before it. Null
//when there's no history or the instant sits outside it (hourly buckets, so allow up to 1 h past the last).
export function customSampleAtTime(hist: { times: Date[]; values: number[] } | null, timeMs: number): number | null
{
    if (!hist || hist.times.length === 0) { return null; }
    if (timeMs < hist.times[0].getTime() || timeMs > hist.times[hist.times.length - 1].getTime() + 3_600_000) { return null; }
    let idx = hist.times.length - 1;
    for (let i = 0; i < hist.times.length; i++)
    {
        if (hist.times[i].getTime() > timeMs) { idx = i - 1; break; }
    }
    return hist.values[idx < 0 ? 0 : idx];
}

//Instantaneous watts for the chip at the active instant. Live: the power sensor's state (already
//instantaneous). Scrub: its recorded per-bucket mean at that instant, served from the fetched history.
export function customChipWatts(
    hass: any,
    entityId: string,
    history: { times: Date[]; values: number[] } | null,
    selectedTimeMs: number | null
): number | null
{
    if (!entityId) { return null; }
    if (selectedTimeMs !== null) { return customSampleAtTime(history, selectedTimeMs); }
    const st = hass?.states?.[entityId];
    if (!st) { return null; }
    const raw = parseFloat(st.state);
    return isFinite(raw) ? pvNormalizeToWatts(raw, String(st.attributes?.unit_of_measurement ?? '')) : null;
}

//Resolve the icon to show for the custom entity: the user's editor override, else the entity's own icon,
//else a generic energy glyph. Shared by the chip, the clock medallion and the clock rail button.
export function resolveCustomEntityIcon(hass: any, config: HeliosConfig | undefined): string
{
    const override = typeof config?.['custom-entity-icon'] === 'string'
        ? String(config['custom-entity-icon']).trim()
        : '';
    if (override) { return override; }
    const id = customEntityId(config);
    const own = id ? String(hass?.states?.[id]?.attributes?.icon ?? '') : '';
    return own || 'mdi:flash';
}


//Host surface for the history fetch (clock ring + timeline curve).
export interface CustomEntityHost
{
    hass:                 any;
    config:               HeliosConfig | undefined;
    _timeRange:           { start: Date; end: Date } | null;
    //Recorder period per the active timeline mode (5-min / hour / day), so a long window stays light.
    _storeFetchPeriod:    StatPeriod;
    _customEntityHistory: { times: Date[]; values: number[] } | null;
    _customEntityKey:     string;
    requestUpdate():      void;
}

//Fetch the custom power sensor's recorded history over the visible window and store it as { times,
//values } in watts (per-bucket `mean`, normalised server-side), shared by the clock ring, the timeline
//curve and the scrub. Keyed so an unchanged window never refetches.
export async function refreshCustomEntity(host: CustomEntityHost): Promise<void>
{
    const id = customEntityId(host.config);
    if (!id || !host.hass?.callWS || !host._timeRange)
    {
        if (host._customEntityHistory !== null) { host._customEntityHistory = null; host.requestUpdate(); }
        host._customEntityKey = '';
        return;
    }

    const start = host._timeRange.start;
    const now   = new Date();
    const end   = host._timeRange.end > now ? now : host._timeRange.end;
    if (start >= end)
    {
        host._customEntityHistory = { times: [], values: [] };
        return;
    }
    const period = host._storeFetchPeriod;
    const key = `${id}|${start.getTime()}|${end.getTime()}|${period}`;
    if (key === host._customEntityKey) { return; }
    host._customEntityKey = key;

    try
    {
        const res: any = await callWSWithTimeout<any>(host.hass, {
            type:          'recorder/statistics_during_period',
            start_time:    start.toISOString(),
            end_time:      end.toISOString(),
            statistic_ids: [id],
            //Period follows the active mode (5-min for Now / hourly for a week / daily for month+year), so a
            //long window stays light.
            period,
            //The gated id is the power sensor: its recorded per-bucket `mean` IS measured watts (normalised
            //server-side), no differentiation of anything.
            types:         ['mean'],
            units:         { power: 'W' },
        });
        const buckets: any[] = Array.isArray(res?.[id]) ? res[id] : [];
        const times:  Date[]   = [];
        const values: number[] = [];
        for (const b of buckets)
        {
            const tMs = typeof b?.start === 'number' ? b.start : Date.parse(b?.start);
            if (!isFinite(tMs)) { continue; }
            const w = typeof b?.mean === 'number' && isFinite(b.mean) ? b.mean : null;
            if (w === null) { continue; }
            times.push(new Date(tMs));
            values.push(w);
        }
        host._customEntityHistory = { times, values };
    }
    catch (_)
    {
        host._customEntityHistory = { times: [], values: [] };
    }
    host.requestUpdate();
}
