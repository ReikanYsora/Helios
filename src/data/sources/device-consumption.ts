//Per-device recorder `change` series + live power for the monitoring-group system (scene group chips, per-group
//consumption rings, clock group buttons). Only devices that are assigned to a group AND not hidden are fetched,
//on the same store window + cadence as the source meters. Keyed so an unchanged (id-set, window) is a no-op.

import { fetchChangeById, mergeChangeSeries, changeRefreshAnchorMs, type ChangeBucket, type StatPeriod } from './energy-stats';
import { sumLiveWatts, type KeyedFetch } from '../source-fetch';
import { cssHex } from '../../core/format/format';
import type { EnergyDefaults, DeviceConsumption } from './energy-prefs';
import { monitoringGroups, consumptionRingHidden, monitoringGroupColorToken, GROUP_COUNT, GROUP_FALLBACK_COLORS, type HeliosConfig } from '../../core/config/helios-config';
import { DAY_MS } from '../../core/config/constants';


export interface DeviceConsumptionHost
{
    readonly hass: any;
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
    const hidden = consumptionRingHidden(config);
    return defaults.devices.filter(d =>
        d.statConsumption !== '' && groups.has(d.statConsumption) && !hidden.has(d.statConsumption));
}

//Visible devices of one group (1..GROUP_COUNT), in dashboard order.
export function groupDevices(config: HeliosConfig | undefined, defaults: EnergyDefaults, group: number): DeviceConsumption[]
{
    const groups = monitoringGroups(config);
    const hidden = consumptionRingHidden(config);
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
    const token = monitoringGroupColorToken(config, group);
    if (!token)                  { return graphHex; }
    if (/^(#|rgb)/i.test(token)) { return token; }
    return cssHex(el, `--${token}-color`, graphHex);
}

//Friendly name of a device: its dashboard name, else the entity's friendly name, else the stat id.
export function deviceName(hass: any, dev: DeviceConsumption): string
{
    return dev.name || String(hass?.states?.[dev.statConsumption]?.attributes?.friendly_name ?? '') || dev.statConsumption;
}

//The device entity's configured MDI icon, else a generic energy glyph.
export function deviceIcon(hass: any, dev: DeviceConsumption): string
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
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const startMs = today0.getTime() - host._periodPastDays * DAY_MS;
    const endMs   = changeRefreshAnchorMs();
    const sorted  = [...ids].sort();
    const key     = `${sorted.join(',')}|${startMs}|${endMs}`;
    host._deviceChangeFetch.run(key, () =>
        fetchChangeById(host.hass, sorted, startMs, endMs, host._storeFetchPeriod)
            .then((byId) =>
            {
                if (byId === null) { return; }
                const next = new Map<string, ChangeBucket[]>();
                for (const id of sorted)
                {
                    const s = mergeChangeSeries(byId, [id]);
                    if (s !== null) { next.set(id, s); }
                }
                host._deviceChangeSeries = next;
                host.requestUpdate();
            }));
}
