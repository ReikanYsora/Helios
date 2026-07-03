//Grid import / export readout. Entity resolution mirrors the HA Energy dashboard: import meter =
//each source's `stat_energy_from`, export meter = `stat_energy_to`, optional live signed-power
//sensor = `stat_rate` / `power_config.stat_rate`.
//
//Past series (timeline + scrub) read the recorder's pre-computed `change` metric on the directional
//meters, the same metric the HA Energy dashboard consumes. Import and export are SEPARATE meters, so each
//direction's watts come from its own meter with no sign inference or shared-buffer slope.
//
//Live "now" prefers the signed `stat_rate` sensor (entity state), summed across sources and split
//into import (net >= 0) / export (net < 0), like the HA Energy live tile. Per-source inversion is
//honoured via `power_config.stat_rate_inverted` (invertedRateEntities[]). The grid-guard (grid-guard.ts)
//audits that split against the billing meters and flags a mis-scoped sensor (import-only wired as net);
//while flagged, and on installs with no stat_rate at all, each direction reads through a freshness ladder:
//live counter slope (counter-slope.ts, near-real-time) first, then the latest completed recorder change
//bucket. A flagged import-only sensor still serves the import chip live (its read IS the import), and any
//live import above the gate pins export to 0 (the grid cannot flow both ways at once).

import { pvNormalizeToWatts } from './pv';
import { formatEntityValue, type PowerUnit } from './format';
import type { EnergyDefaults } from './energy-prefs';
import { fetchChangeSeries, latestWattsFromChangeSeries, changeRefreshAnchorMs, type ChangeBucket, type StatPeriod } from './energy-stats';
import { refreshGridGuard, type GridGuardState } from './grid-guard';
import { sampleCounter, counterSlopeWatts } from './counter-slope';
import { GRID_IMPORT_GATE_W } from '../constants';


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

    //Mis-scope guard state (grid-guard.ts); 'flagged' reroutes the live readout off the sign-split.
    _gridGuard: GridGuardState;
    //True when the direction's CURRENT live value came from a lagged recorder bucket (neither a live sensor
    //nor the counter slope). The home formula switches to its shared-window balance on any lagged term.
    _gridImportLagged: boolean;
    _gridExportLagged: boolean;
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

    //Mis-scope audit (no-op between its re-arms / outside its preconditions) and the slope sampler feed
    //(cheap per-cycle state reads; the rings only grow on actual counter changes).
    refreshGridGuard(host);
    const ed = host._energyDefaults;
    for (const id of ed?.gridStatEnergyFroms ?? []) { sampleCounter(host.hass, id); }
    for (const id of ed?.gridStatEnergyTos   ?? []) { sampleCounter(host.hass, id); }

    //Live chip: prefer the signed power sensor (real-time, summed + split) while the guard trusts it;
    //otherwise each direction reads through the meter ladder (counter slope, then latest change bucket)
    //so a cumulative-only or flagged install still shows a "now" value.
    const statRates = ed?.gridStatRates ?? [];
    const flagged   = host._gridGuard.status === 'flagged';
    if (statRates.length > 0 && !flagged)
    {
        readStatRates(host, statRates);
        if (host._gridImportLagged) { host._gridImportLagged = false; }
        if (host._gridExportLagged) { host._gridExportLagged = false; }
    }
    else
    {
        readMeterLadder(host, statRates, flagged);
    }
}


//Fallback live read for both directions: counter slope, then latest change bucket. A flagged import-only
//sensor short-circuits the import side (its state IS the import power, full freshness), and while it reads
//real import the export side is pinned to 0 instead of showing a stale lagged bucket.
function readMeterLadder(host: GridHost, statRates: string[], flagged: boolean): void
{
    const nowMs = Date.now();
    const ed    = host._energyDefaults;

    let importW: number | null = null;
    let importLagged = false;
    if (flagged && host._gridGuard.importLive && statRates.length === 1)
    {
        importW = readCanonicalRateWatts(host, statRates[0]);
    }
    if (importW === null)
    {
        const slope = counterSlopeWatts(ed?.gridStatEnergyFroms ?? [], nowMs);
        if (slope !== null)
        {
            importW = slope;
        }
        else
        {
            const bucket = latestWattsFromChangeSeries(host._gridImportChangeSeries, nowMs);
            if (bucket !== null)
            {
                importW      = Math.max(0, bucket);
                importLagged = true;
            }
        }
    }

    let exportW: number | null = null;
    let exportLagged = false;
    if (flagged && host._gridGuard.importLive && importW !== null && importW > GRID_IMPORT_GATE_W)
    {
        exportW = 0;
    }
    else
    {
        const slope = counterSlopeWatts(ed?.gridStatEnergyTos ?? [], nowMs);
        if (slope !== null)
        {
            exportW = slope;
        }
        else
        {
            const bucket = latestWattsFromChangeSeries(host._gridExportChangeSeries, nowMs);
            if (bucket !== null)
            {
                exportW      = Math.max(0, bucket);
                exportLagged = true;
            }
        }
    }

    applyValue(host, 'import', importW, importW !== null ? 'W' : '');
    applyValue(host, 'export', exportW, exportW !== null ? 'W' : '');
    if (host._gridImportLagged !== importLagged) { host._gridImportLagged = importLagged; }
    if (host._gridExportLagged !== exportLagged) { host._gridExportLagged = exportLagged; }
}


//Canonical import-positive watts of a single rate sensor, or null when unreadable. Only called on the
//flagged import-only path, where the sensor's (never-negative) read is the import power itself.
function readCanonicalRateWatts(host: GridHost, entity: string): number | null
{
    const stateObj = host.hass.states?.[entity];
    if (!stateObj) { return null; }
    const num = parseNumericState(stateObj.state);
    if (num === null) { return null; }
    const watts    = pvNormalizeToWatts(num, String(stateObj.attributes?.unit_of_measurement ?? '').trim());
    const inverted = host._energyDefaults?.invertedRateEntities.includes(entity) ?? false;
    return Math.max(0, inverted ? -watts : watts);
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
    //Rounded end anchor in the key re-issues the fetch once per CHANGE_REFRESH_MS, so a cumulative-only grid
    //keeps a live chip and fresh past curve.
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
