//Grid import / export readout. Entity resolution mirrors the HA Energy dashboard: import meter =
//each source's `stat_energy_from`, export meter = `stat_energy_to`, optional live signed-power
//sensor = `stat_rate` / `power_config.stat_rate`.
//
//Past series (timeline + scrub) read the recorder's pre-computed `change` metric on the directional
//meters, the same metric HA Energy consumes. Import and export are SEPARATE meters, so each direction's
//watts come from its own meter with no sign inference or shared-buffer slope.
//
//Live "now" prefers the signed `stat_rate` sensor (entity state), summed across sources and split
//into import (net >= 0) / export (net < 0), like the HA Energy live tile. Per-source inversion is
//honoured via `power_config.stat_rate_inverted` (invertedRateEntities[]). With no stat_rate wired,
//the chip falls back to the average power of the latest completed 5-minute change bucket.

import { pvNormalizeToWatts } from './pv';
import { formatLocalisedNumber, formatPowerKw, formatEnergyKwh, energyToKwh } from './format';
import type { EnergyDefaults } from './energy-prefs';
import { fetchChangeSeries, latestWattsFromChangeSeries, changeRefreshAnchorMs, type ChangeBucket } from './energy-stats';


export interface GridHost
{
    readonly hass:   any;
    //HA Energy dashboard defaults (populated by card/energy-prefs.ts) — the sole source of grid
    //wiring: import/export meters, live power sensors, and the sign-inversion set.
    readonly _energyDefaults?: EnergyDefaults;

    requestUpdate(): void;

    _gridImportValue: number | null;
    _gridImportUnit:  string;
    _gridExportValue: number | null;
    _gridExportUnit:  string;

    //Recorder `change` series (5-minute buckets) for the import / export meters over the store's
    //past window. Consumer converts to average watts (kWh * 1000 / bucket-hours). Null until first
    //fetch lands.
    _gridImportChangeSeries: ChangeBucket[] | null;
    _gridExportChangeSeries: ChangeBucket[] | null;
    _gridImportChangeFetchKey: string;
    _gridExportChangeFetchKey: string;
    _gridImportChangeFetching: boolean;
    _gridExportChangeFetching: boolean;
}


export function refreshGrid(host: GridHost): void
{
    if (!host.hass)
    {
        if (host._gridImportValue !== null) { host._gridImportValue = null; }
        if (host._gridImportUnit  !== '')   { host._gridImportUnit  = ''; }
        if (host._gridExportValue !== null) { host._gridExportValue = null; }
        if (host._gridExportUnit  !== '')   { host._gridExportUnit  = ''; }
        return;
    }

    //Past series: recorder `change` on the directional energy meters.
    fetchGridChangeSeries(host, 'import');
    fetchGridChangeSeries(host, 'export');

    //Live chip: prefer the signed power sensor (real-time, summed + split); otherwise fall back to
    //the latest completed change bucket so a cumulative-only install still shows a "now" value.
    const statRates = host._energyDefaults?.gridStatRates ?? [];
    if (statRates.length > 0)
    {
        readStatRates(host, statRates);
    }
    else
    {
        const nowMs = Date.now();
        const imp   = latestWattsFromChangeSeries(host._gridImportChangeSeries, nowMs);
        const exp   = latestWattsFromChangeSeries(host._gridExportChangeSeries, nowMs);
        applyValue(host, 'import', imp !== null ? Math.max(0, imp) : null, imp !== null ? 'W' : '');
        applyValue(host, 'export', exp !== null ? Math.max(0, exp) : null, exp !== null ? 'W' : '');
    }
}


//Fetch the recorder `change` series for a direction's meters over the store's past window (2 days
//back to now), gated on a per-host fetch key that re-arms every CHANGE_REFRESH_MS (and on entity-set
/// window changes) to track newly committed buckets. Window matches the unified store's J-2 origin.
function fetchGridChangeSeries(host: GridHost, slot: 'import' | 'export'): void
{
    const ed = host._energyDefaults;
    const ids = slot === 'import'
        ? (ed?.gridStatEnergyFroms ?? [])
        : (ed?.gridStatEnergyTos   ?? []);
    if (ids.length === 0) { return; }

    const fetching = slot === 'import' ? host._gridImportChangeFetching : host._gridExportChangeFetching;
    if (fetching) { return; }

    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const startMs = today0.getTime() - 2 * 24 * 3_600_000;
    //Rounded end anchor in the key re-issues the fetch once per CHANGE_REFRESH_MS (as in
    //fetchBatteryChangeSeries), so a cumulative-only grid keeps a live chip and fresh past curve.
    const endMs   = changeRefreshAnchorMs();
    const sorted  = [...ids].sort();
    const key     = `${sorted.join(',')}|${startMs}|${endMs}`;

    const prevKey = slot === 'import' ? host._gridImportChangeFetchKey : host._gridExportChangeFetchKey;
    if (key === prevKey) { return; }

    if (slot === 'import') { host._gridImportChangeFetchKey = key; host._gridImportChangeFetching = true; }
    else                   { host._gridExportChangeFetchKey = key; host._gridExportChangeFetching = true; }
    void fetchChangeSeries(host.hass, sorted, startMs, endMs, '5minute')
        .then((series) =>
        {
            if (series !== null)
            {
                if (slot === 'import') { host._gridImportChangeSeries = series; }
                else                   { host._gridExportChangeSeries = series; }
            }
            host.requestUpdate();
        })
        .finally(() =>
        {
            if (slot === 'import') { host._gridImportChangeFetching = false; }
            else                   { host._gridExportChangeFetching = false; }
        });
}


//Mirror of HA's live grid read: sum signed power across every `stat_rate` entity, then route the net
//through applyCombinedSplit (non-negative net -> import, negative -> export). No integration; reads
//the sensor as-is, SI-prefix-normalised like the official Energy dashboard.
function readStatRates(host: GridHost, rates: string[]): void
{
    let signedWatts = 0;
    let sawAny      = false;
    for (const entity of rates)
    {
        const stateObj = host.hass.states?.[entity];
        if (!stateObj) { continue; }
        const raw = stateObj.state;
        if (raw === null || raw === undefined || raw === '' || raw === 'unknown' || raw === 'unavailable')
        {
            continue;
        }
        const num = parseNumericState(raw);
        if (num === null) { continue; }
        const unit  = String(stateObj.attributes?.unit_of_measurement ?? '').trim();
        const watts = pvNormalizeToWatts(num, unit);
        //`power_config.stat_rate_inverted` flips the sign for one source in a multi-source wiring;
        //apply at read time so the split below sees the canonical "positive = import" convention.
        const inverted = host._energyDefaults?.invertedRateEntities.includes(entity) ?? false;
        signedWatts += inverted ? -watts : watts;
        sawAny = true;
    }
    if (!sawAny) { return; }
    applyCombinedSplit(host, signedWatts);
}


function applyCombinedSplit(host: GridHost, signedWatts: number): void
{
    if (signedWatts >= 0)
    {
        applyValue(host, 'import', signedWatts, 'W');
        applyValue(host, 'export', null, '');
    }
    else
    {
        applyValue(host, 'import', null, '');
        applyValue(host, 'export', -signedWatts, 'W');
    }
}


function applyValue(host: GridHost, slot: 'import' | 'export', value: number | null, unit: string): void
{
    //Negative on a directional slot is meaningless (a negative import is export, already reported by
    //the other slot). Clamp to 0 so the chip stays readable and the absolute-watts bead animation
    //never runs on the wrong direction.
    const clamped = (value === null) ? null : Math.max(0, value);
    if (slot === 'import')
    {
        if (host._gridImportValue !== clamped) { host._gridImportValue = clamped; }
        if (host._gridImportUnit  !== unit)    { host._gridImportUnit  = unit; }
    }
    else
    {
        if (host._gridExportValue !== clamped) { host._gridExportValue = clamped; }
        if (host._gridExportUnit  !== unit)    { host._gridExportUnit  = unit; }
    }
}


//Parse a state that arrived as string or number. Accepts both '.' and ',' decimal separators (some
//integrations forward the locale-formatted form). Null for anything non-finite.
function parseNumericState(raw: unknown): number | null
{
    if (typeof raw === 'number')
    {
        return Number.isFinite(raw) ? raw : null;
    }
    if (typeof raw !== 'string') { return null; }
    const trimmed = raw.trim();
    if (trimmed === '') { return null; }
    const normalised = trimmed.replace(',', '.');
    const n = parseFloat(normalised);
    return Number.isFinite(n) ? n : null;
}


//Format the grid chip value: power sources in kW, energy sources in kWh, at the configured precision
//and locale-aware. Empty string when null so callers can collapse the chip.
export function formatGridValue(hass: any, value: number | null, unit: string, decimals: number): string
{
    if (value === null) { return ''; }
    const u = unit.toLowerCase();
    if (u === 'w' || u === 'kw' || u === 'mw')
    {
        return formatPowerKw(hass, pvNormalizeToWatts(value, unit), decimals);
    }
    if (u === 'wh' || u === 'kwh' || u === 'mwh')
    {
        return formatEnergyKwh(hass, energyToKwh(value, unit), decimals);
    }
    //Unknown unit: raw value at the configured precision + whatever unit HA reported.
    return unit ? `${formatLocalisedNumber(hass, value, decimals)} ${unit}` : String(value);
}
