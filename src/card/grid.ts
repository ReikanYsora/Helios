//Grid import / export readout. Entity resolution mirrors the HA Energy dashboard: import meter =
//each source's `stat_energy_from`, export meter = `stat_energy_to`, optional live signed-power
//sensor = `stat_rate` / `power_config.stat_rate`.
//
//Past series (timeline + scrub) read the recorder's pre-computed `change` metric on the directional
//meters, the same metric the HA Energy dashboard consumes. Import and export are SEPARATE meters, so each
//direction's watts come from its own meter with no sign inference or shared-buffer slope.
//
//Live "now" is measured or absent, never derived: the signed `stat_rate` sensor (entity state) summed
//across sources and split into import (net >= 0) / export (net < 0), like the HA Energy live tile,
//with per-source inversion honoured via `power_config.stat_rate_inverted` (invertedRateEntities[]).
//No sensor wired, or a sensor the grid-guard (grid-guard.ts) proved mis-scoped against the billing
//meters: the live chips stay EMPTY and the editor explains what to configure; curves and scrub keep
//reading the meters regardless.

import { pvNormalizeToWatts } from './pv';
import { formatEntityValue, type PowerUnit } from './format';
import type { EnergyDefaults } from './energy-prefs';
import { fetchChangeSeries, changeRefreshAnchorMs, type ChangeBucket, type StatPeriod } from './energy-stats';
import { refreshGridGuard, type GridGuardState } from './grid-guard';


export interface GridHost
{
    readonly hass:   any;
    //HA Energy dashboard defaults (populated by card/energy-prefs.ts), the sole source of grid wiring:
    //import/export meters, live power sensors, and the sign-inversion set.
    readonly _energyDefaults?: EnergyDefaults;
    //Rolling-window past days (period selector), so the change-series fetch spans the whole store window.
    readonly _periodPastDays: number;
    //Recorder period for the change-series, per the active timeline mode (5-min / hour / day).
    readonly _storeFetchPeriod: StatPeriod;

    requestUpdate(): void;

    _gridImportValue: number | null;
    _gridImportUnit:  string;
    _gridExportValue: number | null;
    _gridExportUnit:  string;

    //Recorder `change` series (5-minute buckets) for the import / export meters over the store's past window.
    //Consumer converts to average watts (kWh * 1000 / bucket-hours). Null until first fetch lands.
    _gridImportChangeSeries: ChangeBucket[] | null;
    _gridExportChangeSeries: ChangeBucket[] | null;
    _gridImportChangeFetchKey: string;
    _gridExportChangeFetchKey: string;
    _gridImportChangeFetching: boolean;
    _gridExportChangeFetching: boolean;

    //Mis-scope guard state (grid-guard.ts); 'flagged' empties the live chips instead of trusting the split.
    _gridGuard: GridGuardState;
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

    //Mis-scope audit (no-op between its re-arms / outside its preconditions).
    refreshGridGuard(host);

    //Live chips are measured or absent: the signed power sensor while the guard trusts it, nothing
    //otherwise. Curves and scrub keep reading the meters above regardless.
    const statRates = host._energyDefaults?.gridStatRates ?? [];
    if (statRates.length > 0 && host._gridGuard.status !== 'flagged')
    {
        readStatRates(host, statRates);
    }
    else
    {
        applyValue(host, 'import', null, '');
        applyValue(host, 'export', null, '');
    }
}


//Fetch the recorder `change` series for a direction's meters over the store's past window, gated on a per-host
//fetch key that re-arms every CHANGE_REFRESH_MS (and on entity-set / window changes) to track newly committed
//buckets. Window matches the unified store's origin.
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
    //Span the full configured past window (period selector), not a fixed 2 days, else the older days of a
    //wide window (e.g. 7 d) come back empty.
    const startMs = today0.getTime() - host._periodPastDays * 24 * 3_600_000;
    //Rounded end anchor in the key re-issues the fetch once per CHANGE_REFRESH_MS, so the past curve and
    //scrub keep tracking newly committed buckets.
    const endMs   = changeRefreshAnchorMs();
    const sorted  = [...ids].sort();
    const key     = `${sorted.join(',')}|${startMs}|${endMs}`;

    const prevKey = slot === 'import' ? host._gridImportChangeFetchKey : host._gridExportChangeFetchKey;
    if (key === prevKey) { return; }

    if (slot === 'import') { host._gridImportChangeFetchKey = key; host._gridImportChangeFetching = true; }
    else                   { host._gridExportChangeFetchKey = key; host._gridExportChangeFetching = true; }
    void fetchChangeSeries(host.hass, sorted, startMs, endMs, host._storeFetchPeriod)
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


//Live grid read like the HA Energy dashboard: sum signed power across every `stat_rate` entity, then route the
//net through applyCombinedSplit (non-negative net -> import, negative -> export). No integration; reads the sensor
//as-is, SI-prefix-normalised.
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
        //`power_config.stat_rate_inverted` flips the sign for one source in a multi-source wiring; apply at read
        //time so the split below sees the canonical "positive = import" convention.
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
    //Negative on a directional slot is meaningless (a negative import is export, already reported by the other
    //slot). Clamp to 0 so the chip stays readable and the absolute-watts bead animation never runs on the wrong direction.
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


//Format the grid chip value: power sources in kW, energy sources in kWh, locale-aware at the configured precision.
//Empty string when null so callers can collapse the chip. Thin wrapper over the shared formatter.
export function formatGridValue(hass: any, value: number | null, unit: string, decimals: number, powerU: PowerUnit = 'kW'): string
{
    if (value === null) { return ''; }
    return formatEntityValue(hass, value, unit, decimals, powerU);
}
