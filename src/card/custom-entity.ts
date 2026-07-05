//User-picked "custom" entity for the red chip + leader bead, measured-only. Live: the POWER sensor's instantaneous
//state (customEntityId gates on both halves being configured and resolves to the power one). Past curve, scrub and
//the clock ring: the recorder `change` series of the ENERGY meter, converted to average watts per bucket, exactly
//like grid/pv/battery. The value's sign drives bead direction (positive = home to chip, negative = chip to home);
//its magnitude drives cadence.

import { pvNormalizeToWatts, parseNumericState } from './format';
import { type HeliosConfig, customEntityId, customEnergyEntityId } from '../helios-config';
import { fetchChangeSeries, wattsAtFromChangeSeries, changeRefreshAnchorMs, type ChangeBucket, type StatPeriod } from './energy-stats';

export interface CustomEntityLive
{
    name: string;   //friendly name (honours a user override) or the entity id, for the chip's title
}

export function resolveCustomEntityLive(hass: any, entityId: string): CustomEntityLive | null
{
    if (!entityId) { return null; }
    const st = hass?.states?.[entityId];
    if (!st) { return null; }
    if (parseNumericState(st.state) === null) { return null; }
    return { name: String(st.attributes?.friendly_name ?? entityId) };
}

//Instantaneous watts for the chip at the active instant. Live: the power sensor's state (already instantaneous).
//Scrub: the average watts of the energy meter's recorder bucket at that instant, so the past reads the measured
//dashboard energy, not a re-read of the live sensor.
export function customChipWatts(
    hass: any,
    powerEntityId: string,
    changeSeries: ChangeBucket[] | null,
    selectedTimeMs: number | null
): number | null
{
    if (selectedTimeMs !== null) { return wattsAtFromChangeSeries(changeSeries, selectedTimeMs); }
    if (!powerEntityId) { return null; }
    const st = hass?.states?.[powerEntityId];
    if (!st) { return null; }
    const raw = parseNumericState(st.state);
    return raw === null ? null : pvNormalizeToWatts(raw, String(st.attributes?.unit_of_measurement ?? ''));
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


//Host surface for the energy-meter change-series fetch (clock ring + timeline curve + scrub).
export interface CustomEntityHost
{
    hass:                 any;
    config:               HeliosConfig | undefined;
    _timeRange:           { start: Date; end: Date } | null;
    //Recorder period per the active timeline mode (5-min / hour / day), so a long window stays light.
    _storeFetchPeriod:    StatPeriod;
    _customChangeSeries:  ChangeBucket[] | null;
    _customEntityKey:     string;
    _customEntityFetching: boolean;
    requestUpdate():      void;
}

//Fetch the custom ENERGY meter's recorder `change` series over the visible window, stored as ChangeBucket[] (kWh per
//bucket, reset-corrected + unit-normalised server-side). Shared by the clock ring (binned to kWh totals), the timeline
//curve and the scrub (both converting to average watts). Keyed so an unchanged window never refetches.
export async function refreshCustomEntity(host: CustomEntityHost): Promise<void>
{
    const energyId = customEntityId(host.config) ? customEnergyEntityId(host.config) : '';
    if (!energyId || !host.hass?.callWS || !host._timeRange)
    {
        if (host._customChangeSeries !== null) { host._customChangeSeries = null; host.requestUpdate(); }
        host._customEntityKey = '';
        return;
    }

    const startMs = host._timeRange.start.getTime();
    //Quantise the end to the re-arm boundary: Date.now() advances on every hass push, and an unquantised end would
    //churn the key every refresh, refiring a recorder call for the same window all day long.
    const endMs = Math.min(changeRefreshAnchorMs(), host._timeRange.end.getTime());
    if (startMs >= endMs)
    {
        host._customChangeSeries = [];
        return;
    }
    const period = host._storeFetchPeriod;
    const key = `${energyId}|${startMs}|${endMs}|${period}`;
    if (key === host._customEntityKey || host._customEntityFetching) { return; }
    host._customEntityKey = key;

    host._customEntityFetching = true;
    try
    {
        const series = await fetchChangeSeries(host.hass, [energyId], startMs, endMs, period);
        host._customChangeSeries = series ?? [];
    }
    catch (_)
    {
        host._customChangeSeries = [];
        //Let the next pass retry: a failed window must not stay wedged behind its own key.
        host._customEntityKey = '';
    }
    finally
    {
        host._customEntityFetching = false;
    }
    host.requestUpdate();
}
