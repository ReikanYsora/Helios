//Grid import / export readout. Entity resolution is 100 % HA Energy dashboard (config/energy
//global settings): the import meter is every grid source's `stat_energy_from`, the export meter
//every source's `stat_energy_to`, and the optional live signed-power sensor is `stat_rate` /
//`power_config.stat_rate`.
//
//Past series (timeline curve, dashboard graph, scrub tooltip) read the recorder's pre-computed
//`change` metric on the directional energy meters, the exact same data the HA Energy dashboard
//consumes (see energy-stats.ts). Import and export are SEPARATE meters, so each direction's watts
//come straight from its own meter, no sign inference, no shared-buffer slope, every surface reads
//the same buckets and the cross-surface inconsistencies from the old client-side differentiation
//are gone.
//
//Live "now" power prefers the signed `stat_rate` sensor read straight from the entity state,
//summed across sources and split into import (net >= 0) / export (net < 0), exactly like the HA
//Energy live tile. Per-source inversion is honoured via HA Energy's own
//`power_config.stat_rate_inverted` switch (invertedRateEntities[]). When no stat_rate is wired,
//the chip falls back to the average power of the latest completed 5-minute change bucket per
//direction.

import { pvNormalizeToWatts } from './pv';
import type { EnergyDefaults } from './energy-prefs';
import { beginLoadingPhase, endLoadingPhase, type LoadingTrackerHost } from './loading-tracker';
import { fetchChangeSeries, latestWattsFromChangeSeries, type ChangeBucket } from './energy-stats';


export interface GridHost extends LoadingTrackerHost
{
    readonly hass:   any;
    //HA Energy dashboard defaults, populated by card/energy-prefs.ts. Grid wiring resolves
    //exclusively from here: import meters (gridStatEnergyFroms), export meters (gridStatEnergyTos),
    //live power sensors (gridStatRates) and the per-source sign-inversion set.
    readonly _energyDefaults?: EnergyDefaults;

    requestUpdate(): void;

    _gridImportValue: number | null;
    _gridImportUnit:  string;
    _gridExportValue: number | null;
    _gridExportUnit:  string;

    //Recorder `change` series for the import / export energy meters, 5-minute buckets over the
    //store's past window. The canonical past-power source for the unified store + scrub, converted
    //to average watts (kWh * 1000 / bucket-hours) by the consumer. Null until the first fetch lands.
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

    //Live chip. When the HA Energy grid source declares a signed power sensor, mirror HA's live
    //read (real-time, summed + split). Otherwise fall back to the latest completed change bucket
    //per direction so a cumulative-only install still shows a sane "now" value instead of nothing.
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


//Fetch the recorder `change` series for a direction's energy meters over the store's past window
//(2 days back to now), gated on a per-host fetch key so it reissues only when the entity set or
//window changes. The window matches the unified store's J-2 origin so the timeline + dashboard
//graph have a real sample for every past bucket.
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
    const endMs   = Date.now();
    const sorted  = [...ids].sort();
    const key     = `${sorted.join(',')}|${startMs}`;

    const prevKey = slot === 'import' ? host._gridImportChangeFetchKey : host._gridExportChangeFetchKey;
    if (key === prevKey) { return; }

    if (slot === 'import') { host._gridImportChangeFetchKey = key; host._gridImportChangeFetching = true; }
    else                   { host._gridExportChangeFetchKey = key; host._gridExportChangeFetching = true; }
    beginLoadingPhase(host, 'grid-history');
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
            endLoadingPhase(host, 'grid-history');
        });
}


//Mirror of HA's live grid read. Sums the signed power across every `stat_rate` entity collected
//from the HA Energy prefs, then routes the net through applyCombinedSplit: a non-negative net
//shows on IMPORT only, a negative net on EXPORT only. No slope, no integration, the chip reads
//whatever the signed power sensor reports right now, SI-prefix-normalised the same way the
//official Energy dashboard does it.
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
        //Per-source inversion: HA Energy `power_config.stat_rate_inverted` flips the sign for one
        //source in a multi-source wiring. Apply the flag at read time so the split below sees the
        //canonical "positive = import" convention.
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
    //Negative on a directional grid slot has no physical meaning: a negative IMPORT is a moment of
    //EXPORT (already reported by the export slot) and vice versa. Clamp to 0 so the chip stays
    //readable and the bead animation (driven by absolute watts) never runs on the wrong direction.
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


//Parse a state value that came in as either a string or a number. Accepts both '.' and ',' decimal
//separators since some integrations forward the locale-formatted form. Returns null for anything
//that isn't a finite number.
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


//Display helper that formats the grid chip value + unit. Watts get the same "round to integer when
//>100, one decimal otherwise" treatment as the PV chip; kWh keeps two decimals. Returns the empty
//string when the value is null so callers can collapse the chip.
export function formatGridValue(value: number | null, unit: string): string
{
    if (value === null) { return ''; }
    const u = unit.toLowerCase();
    if (u === 'w' || u === 'kw' || u === 'mw')
    {
        const w = pvNormalizeToWatts(value, unit);
        if (Math.abs(w) >= 1000) { return `${(w / 1000).toFixed(1)} kW`; }
        if (Math.abs(w) >= 100)  { return `${Math.round(w)} W`; }
        return `${w.toFixed(1)} W`;
    }
    if (u === 'wh' || u === 'kwh' || u === 'mwh')
    {
        return `${value.toFixed(2)} ${unit}`;
    }
    //Unknown unit: show the raw value + whatever unit HA reported.
    return unit ? `${value} ${unit}` : String(value);
}
