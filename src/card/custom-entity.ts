//User-picked "custom" entity for the red chip + leader bead. The chip shows the value at the active instant
//(live now, or the timeline scrub target), as POWER (kW) — never an energy meter's lifetime total. A power
//entity (W/kW/MW) reads its instantaneous state; a cumulative-energy entity (Wh/kWh/MWh) is differentiated to
//average watts (see customChipWatts + refreshCustomEntity). resolveCustomEntityLive still supplies the chip's
//name + presence. The value's sign drives the bead direction (positive = home → chip, negative = chip →
//home); its magnitude drives the cadence.

import { formatEntityValue, pvNormalizeToWatts, energyToKwh } from './format';
import { type HeliosConfig, customEntityId } from '../helios-config';
import { callWSWithTimeout } from './ws-timeout';
import type { StatPeriod } from './energy-stats';

export interface CustomEntityLive
{
    name:        string;   //friendly name (honours a user override) or the entity id, for the chip's title
    display:     string;   //value + unit (kW for power, kWh for energy), shown next to the icon
    signedValue: number;   //raw numeric state; its sign is the bead direction
    magnitudeW:  number;   //flow magnitude (W-equivalent) for the bead cadence
}

const POWER_UNITS  = new Set(['w', 'kw', 'mw']);
const ENERGY_UNITS = new Set(['wh', 'kwh', 'mwh']);

//True when an entity carries a power or energy reading — the set the picker offers and the chip accepts.
export function isPowerOrEnergyEntity(stateObj: any): boolean
{
    if (!stateObj || !stateObj.attributes) { return false; }
    const dc = String(stateObj.attributes.device_class ?? '');
    if (dc === 'power' || dc === 'energy') { return true; }
    const lu = String(stateObj.attributes.unit_of_measurement ?? '').trim().toLowerCase();
    return POWER_UNITS.has(lu) || ENERGY_UNITS.has(lu);
}

export function resolveCustomEntityLive(hass: any, entityId: string): CustomEntityLive | null
{
    if (!entityId) { return null; }
    const st = hass?.states?.[entityId];
    if (!st) { return null; }
    const raw = parseFloat(st.state);
    if (!isFinite(raw)) { return null; }

    const unit = String(st.attributes?.unit_of_measurement ?? '');
    const lu   = unit.trim().toLowerCase();
    const dc   = String(st.attributes?.device_class ?? '');
    const isPower  = dc === 'power'  || POWER_UNITS.has(lu);
    const isEnergy = dc === 'energy' || ENERGY_UNITS.has(lu);

    //W-equivalent magnitude for the bead cadence: power normalises to watts; energy scales its kWh value to a
    //comparable scalar; anything else falls back to the bare magnitude.
    const magnitudeW = isPower  ? Math.abs(pvNormalizeToWatts(raw, unit))
                     : isEnergy ? Math.abs(energyToKwh(raw, unit)) * 1000
                     :            Math.abs(raw);

    return {
        name:        String(st.attributes?.friendly_name ?? entityId),
        display:     formatEntityValue(hass, raw, unit, 1),
        signedValue: raw,
        magnitudeW,
    };
}

//Step-sample the WATTS history (built by refreshCustomEntity) at an instant: the last bucket at or before it.
//Null when there's no history or the instant sits outside it (hourly buckets, so allow up to 1 h past the last).
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

//Instantaneous W-equivalent for the chip at the active instant — NEVER the lifetime total. Scrub: the W
//history (mean for power, change-differentiated for energy) at that instant. Live: a power entity reads its
//state directly (already instantaneous); a cumulative-energy entity has no meaningful instantaneous state, so
//it falls back to the latest derived-power bucket from the history.
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
    const unit = String(st.attributes?.unit_of_measurement ?? '');
    const dc   = String(st.attributes?.device_class ?? '');
    const isEnergy = dc === 'energy' || ENERGY_UNITS.has(unit.trim().toLowerCase());
    if (isEnergy)
    {
        return history && history.values.length > 0 ? history.values[history.values.length - 1] : null;
    }
    const raw = parseFloat(st.state);
    return isFinite(raw) ? pvNormalizeToWatts(raw, unit) : null;
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


//Host surface for the history fetch (clock ring + timeline curve). Mirrors the battery SoC fetch.
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

//Fetch the custom entity's 5-minute history over the visible window and store it as { times, values } in
//WATTS, so the clock ring (binned into 15-min slots) and the timeline curve share one consistent, genuinely
//fine series (not interpolated from hourly). Power sensors come back as `mean` (already W via unit
//normalisation); cumulative energy meters come back as `change` (kWh per bucket) and are differentiated to
//average watts via the bucket duration. Keyed so an unchanged window never refetches.
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
            //long window stays light. The differentiation below reads each bucket's own duration.
            period,
            //Normalise so `mean` lands in watts and `change` in kWh regardless of the sensor's native unit.
            types:         ['mean', 'change'],
            units:         { energy: 'kWh', power: 'W' },
        });
        const buckets: any[] = Array.isArray(res?.[id]) ? res[id] : [];
        const times:  Date[]   = [];
        const values: number[] = [];
        for (const b of buckets)
        {
            const tMs = typeof b?.start === 'number' ? b.start : Date.parse(b?.start);
            if (!isFinite(tMs)) { continue; }
            let w: number | null = null;
            if (typeof b?.mean === 'number' && isFinite(b.mean))
            {
                w = b.mean;
            }
            else if (typeof b?.change === 'number' && isFinite(b.change))
            {
                const hours = typeof b?.end === 'number'
                    ? (b.end - tMs) / 3_600_000
                    : (Date.parse(b?.end) - tMs) / 3_600_000;
                w = hours > 0 ? (b.change / hours) * 1000 : null;
            }
            if (w === null || !isFinite(w)) { continue; }
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
