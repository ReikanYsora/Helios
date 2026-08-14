//Per-device recorder `change` series + live power for the monitoring-group system (scene group chips). Only devices
//that are assigned to a group AND not hidden are fetched, on the same store window + cadence as the source meters.
//Keyed so an unchanged (id-set, window) is a no-op.

import type { HassLike } from '../../core/ha-types';
import { fetchChangeById, extractPerEntity, changeRefreshAnchorMs, wattsAtFromChangeSeries, type ChangeBucket, type StatPeriod } from './energy-stats';
import { sumLiveWatts, type KeyedFetch } from '../source-fetch';
import { cssHex, resolveUiColor } from '../../core/format/format';
import type { EnergyDefaults, DeviceConsumption } from './energy-prefs';
import { monitoringGroups, hiddenDevices, monitoringGroupColorToken, GROUP_COUNT, GROUP_FALLBACK_COLORS, type HeliosConfig } from '../../core/config/helios-config';
import { localMidnightMinusDays } from '../../core/time/timezone';


export interface DeviceConsumptionHost
{
    readonly hass: HassLike;
    readonly config: HeliosConfig | undefined;
    readonly _energyDefaults: EnergyDefaults;
    //Rolling-window past days (period selector), so the change fetch spans the whole store window.
    readonly _periodPastDays: number;
    //Recorder period per the active timeline mode (5-min / hour / day).
    readonly _storeFetchPeriod: StatPeriod;
    requestUpdate(): void;

    //Per-device recorder `change` series (statConsumption id -> buckets), for the grouped + visible devices.
    //Empty until the first fetch / when no device is grouped.
    _deviceChangeSeries: Map<string, ChangeBucket[]>;
    _deviceChangeFetch: KeyedFetch;
}


//Devices participating in the group system: assigned to a group (1..GROUP_COUNT) AND not hidden, in dashboard
//order. A hidden device is excluded everywhere by contract, even when it carries a group.
export function groupedDevices(config: HeliosConfig | undefined, defaults: EnergyDefaults): DeviceConsumption[]
{
    const groups = monitoringGroups(config);
    const hidden = hiddenDevices(config);
    return defaults.devices.filter(d =>
        d.statConsumption !== '' && groups.has(d.statConsumption) && !hidden.has(d.statConsumption));
}

//Visible devices of one group (1..GROUP_COUNT), in dashboard order.
export function groupDevices(config: HeliosConfig | undefined, defaults: EnergyDefaults, group: number): DeviceConsumption[]
{
    const groups = monitoringGroups(config);
    const hidden = hiddenDevices(config);
    return defaults.devices.filter(d =>
        d.statConsumption !== '' && groups.get(d.statConsumption) === group && !hidden.has(d.statConsumption));
}

//Groups (1..GROUP_COUNT) that have at least one visible device; an empty group renders nothing anywhere.
export function activeGroups(config: HeliosConfig | undefined, defaults: EnergyDefaults): number[]
{
    const out: number[] = [];
    for (let g = 1; g <= GROUP_COUNT; g++)
    {
        if (groupDevices(config, defaults, g).length > 0) { out.push(g); }
    }
    return out;
}

//Resolve a group's colour to a concrete HEX off a host element's computed style (canvas fills / SVG need a real
//colour, not a var()). Configured ui_color token when set, else --graph-color-N, with a fixed hex fallback.
export function groupColorHex(el: Element | null | undefined, config: HeliosConfig | undefined, group: number): string
{
    const graphHex = cssHex(el, `--graph-color-${group}`, GROUP_FALLBACK_COLORS[(group - 1) % GROUP_FALLBACK_COLORS.length]);
    return resolveUiColor(el, monitoringGroupColorToken(config, group), graphHex);
}

//Friendly name of a device: its dashboard name, else the entity's friendly name, else the stat id.
export function deviceName(hass: HassLike, dev: DeviceConsumption): string
{
    return dev.name || String(hass?.states?.[dev.statConsumption]?.attributes?.friendly_name ?? '') || dev.statConsumption;
}

//The device entity's configured MDI icon, else a generic energy glyph.
export function deviceIcon(hass: HassLike, dev: DeviceConsumption): string
{
    const icon = hass?.states?.[dev.statConsumption]?.attributes?.icon;
    return (typeof icon === 'string' && icon) || 'mdi:flash';
}

//Total kWh of a device's `change` series inside [startMs, endMs] (magnitude), for the detail-panel per-device
//totals. 0 when the series is missing / empty.
export function deviceWindowKwh(series: ChangeBucket[] | undefined, startMs: number, endMs: number): number
{
    if (!series) { return 0; }
    let kwh = 0;
    for (const b of series)
    {
        const mid = (b.startMs + b.endMs) / 2;
        if (mid >= startMs && mid <= endMs && isFinite(b.kwh)) { kwh += Math.abs(b.kwh); }
    }
    return kwh;
}

//Live power (W) summed over a group's visible devices, from their `stat_rate` sensors. null when NONE reads (so
//the chip can hide); a device without a rate sensor contributes 0.
export function groupLivePowerW(host: DeviceConsumptionHost, group: number): number | null
{
    const rates = groupDevices(host.config, host._energyDefaults, group)
        .map(d => d.statRate)
        .filter(r => r !== '');
    if (rates.length === 0) { return null; }
    const { watts, any } = sumLiveWatts(host.hass, rates);
    return any ? watts : null;
}

//Group power (W) at a past instant (scrub), summed over the group's visible devices from their `change` series.
//null when NONE has a reading at that instant. Mirrors groupLivePowerW for the scene chip's scrub value.
export function groupPowerWAt(host: DeviceConsumptionHost, group: number, atMs: number): number | null
{
    let sum = 0;
    let any = false;
    for (const dev of groupDevices(host.config, host._energyDefaults, group))
    {
        const w = wattsAtFromChangeSeries(host._deviceChangeSeries.get(dev.statConsumption) ?? null, atMs);
        if (w !== null) { sum += w; any = true; }
    }
    return any ? sum : null;
}

//Fetch the per-device `change` series over the store's past window for the grouped + visible devices. One recorder
//call (per-id), keyed on (id-set, window) and re-armed each CHANGE_REFRESH_MS. Clears the map when nothing is grouped.
export function refreshDeviceConsumption(host: DeviceConsumptionHost): void
{
    if (!host.hass) { return; }
    const ids = groupedDevices(host.config, host._energyDefaults).map(d => d.statConsumption);
    if (ids.length === 0)
    {
        if (host._deviceChangeSeries.size > 0) { host._deviceChangeSeries = new Map(); host.requestUpdate(); }
        return;
    }
    const startMs = localMidnightMinusDays(host._periodPastDays);
    const endMs   = changeRefreshAnchorMs();
    const sorted  = [...ids].sort();
    const key     = `${sorted.join(',')}|${startMs}|${endMs}`;
    host._deviceChangeFetch.run(key, () =>
        fetchChangeById(host.hass, sorted, startMs, endMs, host._storeFetchPeriod)
            .then((byId) =>
            {
                if (byId === null) { return; }
                //Per-device split of the shared fetch: each id's own buckets (already sorted), in one pass.
                host._deviceChangeSeries = extractPerEntity(byId, sorted);
                host.requestUpdate();
            }));
}
