//Mis-scope guard for the live grid power sensor. The HA Energy "Standard" power slot expects a SIGNED net
//sensor (positive = import, negative = export), but nothing in HA validates that: field reports show
//import-only sensors (never negative) wired there, which silently kills the export readout of every consumer
//that sign-splits the value (this card, and HA's own live tiles alike).
//
//The evidence is physical: an hour in which the billing export meter recorded energy while the "net" sensor's
//recorded minimum never went meaningfully negative is impossible for a correctly scoped sensor. The guard
//fetches hourly recorder stats over a rolling window (export meter `change` + rate sensor `min`/`max`) and
//flags the sensor once enough independent proven hours accumulate. While flagged, grid.ts leaves the
//live chips EMPTY (measured-only: nothing is derived from the meters) and the editor explains the fix.
//
//Anti-false-positive rules, each earned against a concrete failure mode:
//  - Bounds on the hourly export (MIN filters integration noise, MAX filters statistics-surgery artefacts).
//  - The negative band scales with the hour's implied export power, so a brief -100 W dip cannot vouch for a
//    sensor that missed kilowatts of export.
//  - Transition guard: an hour adjacent to a genuinely-negative hour is never counted (a coarse export meter
//    can land its delta one hour late, past the moment the sensor stopped reading negative).
//  - Hours without min data are skipped, never treated as evidence (sensor unavailable, LTS missing, or a
//    freshly created synthetic sensor with no history yet).
//  - The flag self-clears after enough contradiction-free evaluations that contained real export, so a user
//    who fixes their sensor in place (same entity id) gets the normal path back without touching the prefs.
//
//Only single-net-sensor installs are evaluated (the flattened prefs of every modern core produce exactly one
//stat_rate per source; multi-source wirings keep the current behavior untouched).

import type { EnergyDefaults } from './energy-prefs';
import {
    GUARD_REFRESH_MS, GUARD_WINDOW_MS, GUARD_MIN_EXPORT_KWH, GUARD_MAX_EXPORT_KWH,
    GUARD_NEGATIVE_BAND_W, GUARD_RELATIVE_BAND, GUARD_CONTRADICTION_HOURS, GUARD_CLEAN_EVALS,
} from '../constants';


export type GridGuardStatus = 'unknown' | 'healthy' | 'flagged';

export interface GridGuardState
{
    status:     GridGuardStatus;
    //Consecutive contradiction-free evaluations (with real export present) while flagged; unflags at GUARD_CLEAN_EVALS.
    cleanEvals: number;
    fetchKey:   string;
    fetching:   boolean;
    //Wiring signature (rate + export meter ids); a prefs edit that changes it resets the whole state.
    entityKey:  string;
}


export function createGridGuard(): GridGuardState
{
    return { status: 'unknown', cleanEvals: 0, fetchKey: '', fetching: false, entityKey: '' };
}


//One hour of evidence: export meter energy and the canonical (import-positive) minimum of the rate sensor.
//Null = no data for that hour on that side.
export interface GuardHour
{
    exportKwh: number | null;
    minW:      number | null;
}


interface GuardEvaluation
{
    //Contradiction hours surviving every rule, counted non-adjacently (a 3-hour cluster counts as 2).
    contradictions:  number;
    //Hours with in-bounds export AND min data present: the only hours that can testify either way.
    realExportHours: number;
}


//Pure evidence evaluation over chronologically ordered hours. Exported for tests.
export function evaluateGuardHours(hours: GuardHour[]): GuardEvaluation
{
    const candidates: boolean[] = new Array<boolean>(hours.length).fill(false);
    let realExportHours = 0;
    for (let i = 0; i < hours.length; i++)
    {
        const { exportKwh, minW } = hours[i];
        if (exportKwh === null || minW === null) { continue; }
        if (exportKwh <= GUARD_MIN_EXPORT_KWH || exportKwh >= GUARD_MAX_EXPORT_KWH) { continue; }
        realExportHours++;
        //Implied average export power for the hour; the sensor must have dipped at least RELATIVE of it (or
        //the fixed band for small exports) to count as genuinely signed.
        const band = -Math.max(-GUARD_NEGATIVE_BAND_W, GUARD_RELATIVE_BAND * exportKwh * 1000);
        if (minW > band)
        {
            candidates[i] = true;
        }
    }
    //Transition guard: a coarse export meter can land its delta one hour past the moment the sensor read
    //negative, manufacturing a fake contradiction. A NEIGHBOUR hour where the sensor went genuinely negative
    //exculpates the candidate, but only when that neighbour is not itself a contradiction hour: otherwise a
    //sensor that dips a token -100 W while missing kilowatts of export (the asymmetric-phase wiring) would
    //exculpate its own cluster and never flag. Two passes so exculpation reads the ORIGINAL candidate set.
    const rawCandidates = [...candidates];
    for (let i = 0; i < hours.length; i++)
    {
        if (!rawCandidates[i]) { continue; }
        const exculpates = (j: number): boolean =>
        {
            if (j < 0 || j >= hours.length || rawCandidates[j]) { return false; }
            const m = hours[j].minW;
            return m !== null && m < GUARD_NEGATIVE_BAND_W;
        };
        if (exculpates(i - 1) || exculpates(i + 1))
        {
            candidates[i] = false;
        }
    }
    //Non-adjacent count: greedy pick so a single lag cluster cannot fake independent evidence.
    let contradictions = 0;
    let lastPicked = -2;
    for (let i = 0; i < hours.length; i++)
    {
        if (candidates[i] && i > lastPicked + 1)
        {
            contradictions++;
            lastPicked = i;
        }
    }
    return { contradictions, realExportHours };
}


//Pure state transition from one evaluation. Exported for tests.
export function nextGuardState(prev: GridGuardState, hours: GuardHour[]): GridGuardState
{
    const ev = evaluateGuardHours(hours);
    if (prev.status !== 'flagged')
    {
        if (ev.contradictions >= GUARD_CONTRADICTION_HOURS)
        {
            return { ...prev, status: 'flagged', cleanEvals: 0 };
        }
        return { ...prev, status: 'healthy' };
    }
    //Flagged: only a window that carried real, testifiable export can vote for clearing.
    if (ev.contradictions > 0)
    {
        return { ...prev, cleanEvals: 0 };
    }
    if (ev.realExportHours === 0)
    {
        return prev;
    }
    const cleanEvals = prev.cleanEvals + 1;
    if (cleanEvals >= GUARD_CLEAN_EVALS)
    {
        return { ...prev, status: 'healthy', cleanEvals: 0 };
    }
    return { ...prev, cleanEvals };
}


export interface GridGuardHost
{
    readonly hass: any;
    readonly _energyDefaults?: EnergyDefaults;
    _gridGuard: GridGuardState;
    requestUpdate(): void;
}


//Evaluation driver, called from refreshGrid every cycle: cheap no-op between GUARD_REFRESH_MS re-arms and
//outside the guard's preconditions. The two hourly stats calls are tiny (~24 rows each).
export function refreshGridGuard(host: GridGuardHost): void
{
    const ed        = host._energyDefaults;
    const rates     = ed?.gridStatRates      ?? [];
    const exportIds = ed?.gridStatEnergyTos  ?? [];
    const entityKey = `${[...rates].sort().join(',')}|${[...exportIds].sort().join(',')}`;
    const state     = host._gridGuard;
    if (entityKey !== state.entityKey)
    {
        host._gridGuard = { ...createGridGuard(), entityKey };
        return;
    }
    if (rates.length !== 1 || exportIds.length === 0 || !host.hass?.callWS) { return; }
    if (state.fetching) { return; }
    const anchor = Math.floor(Date.now() / GUARD_REFRESH_MS) * GUARD_REFRESH_MS;
    const key    = `${entityKey}|${anchor}`;
    if (key === state.fetchKey) { return; }
    state.fetchKey = key;
    state.fetching = true;

    const endMs    = Date.now();
    const startMs  = endMs - GUARD_WINDOW_MS;
    const rateId   = rates[0];
    const inverted = ed?.invertedRateEntities.includes(rateId) ?? false;
    void Promise.all([
        host.hass.callWS({
            type:          'recorder/statistics_during_period',
            start_time:    new Date(startMs).toISOString(),
            end_time:      new Date(endMs).toISOString(),
            statistic_ids: exportIds,
            period:        'hour',
            types:         ['change'],
            units:         { energy: 'kWh' },
        }),
        host.hass.callWS({
            type:          'recorder/statistics_during_period',
            start_time:    new Date(startMs).toISOString(),
            end_time:      new Date(endMs).toISOString(),
            statistic_ids: [rateId],
            period:        'hour',
            //min AND max: a legacy inverted wiring flips the sign, so its canonical minimum is -max.
            types:         ['min', 'max'],
            units:         { power: 'W' },
        }),
    ])
        .then(([exportRes, rateRes]) =>
        {
            const hours = buildGuardHours(
                exportRes as Record<string, { start?: unknown; change?: number | null }[]>,
                rateRes   as Record<string, { start?: unknown; min?: number | null; max?: number | null }[]>,
                exportIds, rateId, inverted,
            );
            const next = nextGuardState(host._gridGuard, hours);
            if (next !== host._gridGuard)
            {
                const changed = next.status !== host._gridGuard.status;
                next.fetchKey = key;
                next.entityKey = entityKey;
                host._gridGuard = next;
                if (changed) { host.requestUpdate(); }
            }
        })
        .catch(() =>
        {
            //Recorder under load or RBAC denied: no evidence, no transition; the next re-arm retries.
        })
        .finally(() =>
        {
            host._gridGuard.fetching = false;
        });
}


//Align the two payloads on hour starts. Exported for tests.
export function buildGuardHours(
    exportRes: Record<string, { start?: unknown; change?: number | null }[]>,
    rateRes:   Record<string, { start?: unknown; min?: number | null; max?: number | null }[]>,
    exportIds: string[],
    rateId:    string,
    inverted:  boolean,
): GuardHour[]
{
    const byStart = new Map<number, GuardHour>();
    const slot = (startMs: number): GuardHour =>
    {
        let h = byStart.get(startMs);
        if (!h)
        {
            h = { exportKwh: null, minW: null };
            byStart.set(startMs, h);
        }
        return h;
    };
    for (const id of exportIds)
    {
        for (const b of exportRes?.[id] ?? [])
        {
            const startMs = parseGuardBoundary(b?.start);
            const change  = typeof b?.change === 'number' && Number.isFinite(b.change) ? b.change : null;
            if (startMs === null || change === null) { continue; }
            const h = slot(startMs);
            h.exportKwh = (h.exportKwh ?? 0) + change;
        }
    }
    for (const b of rateRes?.[rateId] ?? [])
    {
        const startMs = parseGuardBoundary(b?.start);
        if (startMs === null) { continue; }
        const raw = inverted
            ? (typeof b?.max === 'number' && Number.isFinite(b.max) ? -b.max : null)
            : (typeof b?.min === 'number' && Number.isFinite(b.min) ? b.min : null);
        if (raw === null) { continue; }
        slot(startMs).minW = raw;
    }
    return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([, h]) => h);
}


function parseGuardBoundary(raw: unknown): number | null
{
    if (typeof raw === 'number' && Number.isFinite(raw)) { return raw; }
    if (typeof raw === 'string')
    {
        const ms = Date.parse(raw);
        return Number.isNaN(ms) ? null : ms;
    }
    return null;
}
