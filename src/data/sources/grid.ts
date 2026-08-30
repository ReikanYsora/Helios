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

import type { HassLike } from '../../core/ha-types';
import { formatEntityValue, type PowerUnit } from '../../core/format/format';
import { unionChangeMeters, type EnergyDefaults } from './energy-prefs';
import { fetchChangeById, mergeChangeSeries, extractPerEntity, changeRefreshAnchorMs, type ChangeBucket, type StatPeriod } from './energy-stats';
import { refreshGridGuard, type GridGuardState } from './grid-guard';
import { sumLiveWatts, type KeyedFetch } from '../source-fetch';
import { localMidnightMinusDays } from '../../core/time/timezone';


export interface GridHost
{
    readonly hass:   HassLike;
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
    _gridImportChangeSeriesPerEntity: Map<string, ChangeBucket[]>;
    _gridExportChangeSeriesPerEntity: Map<string, ChangeBucket[]>;
    _gridImportFetch: KeyedFetch;
    _gridExportFetch: KeyedFetch;

    //Mis-scope guard state (grid-guard.ts); 'flagged' empties the live chips instead of trusting the split.
    _gridGuard: GridGuardState;
}


//The four live grid chip fields, exposed by both the full and live-only hosts.
interface GridSlots
{
    _gridImportValue: number | null;
    _gridImportUnit:  string;
    _gridExportValue: number | null;
    _gridExportUnit:  string;
}


//Assign one directional slot. Negative on a directional slot is meaningless (a negative import is export, already
//reported by the other slot), so clamp to 0: the chip stays readable and the absolute-watts bead animation never
//runs on the wrong direction.
function applyGridSlot(host: GridSlots, slot: 'import' | 'export', value: number | null, unit: string): void
{
    const clamped = value === null ? null : Math.max(0, value);
    if (slot === 'import')
    {
        if (host._gridImportValue !== clamped)
        {
            host._gridImportValue = clamped;
        }
        if (host._gridImportUnit  !== unit)
        {
            host._gridImportUnit  = unit;
        }
    }
    else
    {
        if (host._gridExportValue !== clamped)
        {
            host._gridExportValue = clamped;
        }
        if (host._gridExportUnit  !== unit)
        {
            host._gridExportUnit  = unit;
        }
    }
}


//Route a signed net watt reading into the import (net >= 0) / export (net < 0) slots, like the HA Energy live tile.
function applyGridSplit(host: GridSlots, signedWatts: number): void
{
    if (signedWatts >= 0)
    {
        applyGridSlot(host, 'import', signedWatts, 'W');
        applyGridSlot(host, 'export', null, '');
    }
    else
    {
        applyGridSlot(host, 'import', null, '');
        applyGridSlot(host, 'export', -signedWatts, 'W');
    }
}


export function refreshGrid(host: GridHost): void
{
    if (!host.hass)
    {
        if (host._gridImportValue !== null)
        {
            host._gridImportValue = null;
        }
        if (host._gridImportUnit  !== '')
        {
            host._gridImportUnit  = '';
        }
        if (host._gridExportValue !== null)
        {
            host._gridExportValue = null;
        }
        if (host._gridExportUnit  !== '')
        {
            host._gridExportUnit  = '';
        }
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
        applyGridSlot(host, 'import', null, '');
        applyGridSlot(host, 'export', null, '');
    }
}


//Fetch the recorder `change` series for a direction's meters over the store's past window, gated on a per-host
//fetch key that re-arms every CHANGE_REFRESH_MS (and on entity-set / window changes) to track newly committed
//buckets. Window matches the unified store's origin.
function fetchGridChangeSeries(host: GridHost, slot: 'import' | 'export'): void
{
    const ed = host._energyDefaults;
    if (!ed)
    {
        return;
    }
    const ids = slot === 'import' ? ed.gridStatEnergyFroms : ed.gridStatEnergyTos;
    if (ids.length === 0)
    {
        return;
    }

    //Span the full configured past window (period selector), not a fixed 2 days, else the older days of a
    //wide window (e.g. 7 d) come back empty.
    const startMs = localMidnightMinusDays(host._periodPastDays);
    //Rounded end anchor so the past curve tracks newly committed buckets. One call for the union of every
    //source's meters; RequestCache collapses pv/grid/battery to a single recorder round-trip, then each
    //merges its own ids.
    const endMs   = changeRefreshAnchorMs();
    const sortedUnion = [...unionChangeMeters(ed)].sort();
    const key = `${sortedUnion.join(',')}|${startMs}|${endMs}`;

    const gate = slot === 'import' ? host._gridImportFetch : host._gridExportFetch;
    gate.run(key, () =>
        fetchChangeById(host.hass, sortedUnion, startMs, endMs, host._storeFetchPeriod)
            .then((byId) =>
            {
                if (byId === null)
                {
                    return;
                }
                const series = mergeChangeSeries(byId, ids);
                if (series !== null)
                {
                    if (slot === 'import')
                    {
                        host._gridImportChangeSeries = series;
                    }
                    else
                    {
                        host._gridExportChangeSeries = series;
                    }
                }
                //Per-source split for the stacked breakdown (multi-source only), from the same result, config order.
                if (ids.length >= 2)
                {
                    const pe = extractPerEntity(byId, ids);
                    if (pe.size > 0)
                    {
                        if (slot === 'import')
                        {
                            host._gridImportChangeSeriesPerEntity = pe;
                        }
                        else
                        {
                            host._gridExportChangeSeriesPerEntity = pe;
                        }
                    }
                }
                host.requestUpdate();
            }));
}


//Live grid read like the HA Energy dashboard: sum signed power across every `stat_rate` entity, then route the
//net through applyGridSplit (non-negative net -> import, negative -> export). No integration; reads the sensor
//as-is, SI-prefix-normalised.
function readStatRates(host: GridHost, rates: string[]): void
{
    //`power_config.stat_rate_inverted` flips the sign for one source in a multi-source wiring; sumLiveWatts
    //applies it at read time so the split below sees the canonical "positive = import" convention.
    const { watts, any } = sumLiveWatts(host.hass, rates, host._energyDefaults?.invertedRateEntities);
    if (!any)
    {
        return;
    }
    applyGridSplit(host, watts);
}


//Format the grid chip value: power sources in kW, energy sources in kWh, locale-aware at the configured precision.
//Empty string when null so callers can collapse the chip. Thin wrapper over the shared formatter.
export function formatGridValue(hass: HassLike, value: number | null, unit: string, decimals: number, powerU: PowerUnit = 'kW'): string
{
    if (value === null)
    {
        return '';
    }
    return formatEntityValue(hass, value, unit, decimals, powerU);
}
