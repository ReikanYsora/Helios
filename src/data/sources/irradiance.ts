// Solar-irradiance override subsystem.
//
// When `solar-irradiance-entity` is wired to a W/m² sensor, its samples beat the weather model for the live + past portions of
// the irradiance pipeline. Fetches history, keeps the live sample fresh each refresh cycle, and pushes the merged set into the
// engine via setSolarIrradianceSamples().
//
// Same host-driven pattern as pv.ts and battery.ts: the card owns the `_irradiance*` fields; functions here read/write
// them through the structural IrradianceHost interface.

import type { HassLike } from '../../core/ha-types';
import type { HeliosConfig } from '../../core/config/helios-config';
import type { HeliosEngine } from '../../scene/helios-engine';
import { RequestCache } from '../request-cache';
import { quantizedAnchorMs } from '../source-fetch';
import { parseStatBoundaryLoose, parseRawHistorySeries, fetchStatsOrRawHistory } from './energy-stats';
import { IRRADIANCE_CACHE_TTL_MS, HOUR_MS } from '../../core/config/constants';


// Module-level history cache (mirrors battery) so a navigation away and back does not re-trigger the WS round-trip;
// in-flight de-dup collapses concurrent mounts to one WS hit.
const _irradianceCache = new RequestCache<IrradianceHistory | null>(IRRADIANCE_CACHE_TTL_MS);


// Wipe the module cache. Called from the card's `resetDataCache()` hook.
export function clearIrradianceModuleCaches(): void
{
    _irradianceCache.clear();
}


// Parse a statistics payload into an IrradianceHistory. Irradiance sensors are `state_class: measurement` reporting instantaneous
// W/m²; the `mean` column carries the bucket-averaged value, anchored at the bucket midpoint to match the engine's W/m² assumption.
//
// We deliberately do NOT fall back to `state`: a few installs surface irradiance as a cumulative MJ/m² counter
// (`state_class: total_increasing`), so `state` is monotonically increasing. Pushing that would feed the engine values that look
// like 10000+ W/m² and distort every downstream derivation (irradiance curve + chip). Buckets with null `mean` are
// skipped; an empty result degrades to the raw-history fallback (which handles its own unit semantics).
function parseIrradianceStats(arr: any[]): IrradianceHistory
{
    const times:  Date[]   = [];
    const values: number[] = [];
    for (const item of arr ?? [])
    {
        const startMs = parseStatBoundaryLoose(item?.start);
        const endMs   = parseStatBoundaryLoose(item?.end);
        if (startMs === null)
        {
            continue;
        }
        const valueRaw = item?.mean;
        if (valueRaw === null || valueRaw === undefined)
        {
            continue;
        }
        const v = typeof valueRaw === 'number' ? valueRaw : parseFloat(String(valueRaw));
        if (!isFinite(v) || v < 0)
        {
            continue;
        }
        const anchorMs = endMs !== null ? (startMs + endMs) / 2 : startMs;
        times.push(new Date(anchorMs));
        values.push(v);
    }
    return { times, values };
}


// Historical irradiance series: parallel times[]/values[]. Values are W/m² as the sensor reports them; the engine consumes that unit directly.
export interface IrradianceHistory
{
    times:  Date[];
    values: number[];
}

// Structural surface the host card exposes to this module.
export interface IrradianceHost
{
    readonly config:     HeliosConfig | undefined;
    readonly hass:       HassLike;
    readonly _timeRange: { start: Date; end: Date } | null;
    readonly _engine?:   HeliosEngine;

    _irradianceHistory:  IrradianceHistory | null;
    _irradianceFetchKey: string;
    _irradianceFetching: boolean;
}


// Live + history refresh, called every lifecycle cycle. Fast-paths exit early with no entity configured; the engine is then
// notified so it drops back to its built-in irradiance sources.
export function refreshIrradiance(host: IrradianceHost): void
{
    const entity = String(host.config?.['solar-irradiance-entity'] ?? '').trim();

    if (!entity || !host.hass)
    {
        if (host._irradianceHistory !== null)
        {
            host._irradianceHistory = null;
        }
        host._irradianceFetchKey = '';
        host._engine?.setSolarIrradianceSamples(null);
        return;
    }

    // Push the latest live state on every Lit cycle to keep the engine's "now" sample fresh; the engine de-dupes on sort, so the
    // cost is tiny even at sub-minute ticks.
    pushIrradianceToEngine(host);

    if (!host._timeRange || host._irradianceFetching)
    {
        return;
    }
    // Narrow raw-window cap: a per-second W/m² sensor over a multi-day timeline would drag the HA recorder for the whole fetch
    // and block other cards reading the same entity. The chart only needs accurate live data at the head of the curve; older past
    // values are interpolated from the engine's resampled series. 6 h gives the W/m² tooltip enough resolution while keeping the
    // recorder responsive.
    //
    // Cap anchored on NOW so fetchStart stays in the past even when the visible timeline end sits in the forecast horizon.
    // Anchoring on timeline end would put fetchStart in the future and the inner clamp would leave the result empty.
    const RAW_WINDOW_H = 6;
    const visibleStart = host._timeRange.start;
    // Quantise the now-anchor to the cache TTL so the dedupe key below only re-arms once per TTL, not every render:
    // an unquantised Date.now() never matches and the fetch re-fires constantly. The 6 h cap is approximate, so the
    // TTL of slop is harmless. The key's end is quantised the same way (the real end still drives the fetch below).
    const anchorMs     = quantizedAnchorMs(IRRADIANCE_CACHE_TTL_MS);
    const cap          = new Date(anchorMs - RAW_WINDOW_H * HOUR_MS);
    const fetchStart   = visibleStart < cap ? cap : visibleStart;
    const keyEnd       = Math.floor(host._timeRange.end.getTime() / IRRADIANCE_CACHE_TTL_MS) * IRRADIANCE_CACHE_TTL_MS;
    const rangeKey = `${fetchStart.getTime()}|${keyEnd}`;
    const fetchKey = `${entity}@${rangeKey}`;
    if (fetchKey === host._irradianceFetchKey)
    {
        return;
    }
    host._irradianceFetchKey = fetchKey;

    // Cache short-circuits the WS round-trip on navigation (fresh within TTL, in-flight de-duped). On a failed fetch the
    // pure fetcher restores the last-good durable series instead of blanking; the engine owns the series, so it is pushed
    // in the `.then` rather than by the fetcher.
    const durableKey = `irr:${entity}`;
    host._irradianceFetching = true;
    void _irradianceCache.get(fetchKey, () => fetchIrradiance(host.hass, entity, fetchStart, host._timeRange!.end, durableKey))
        .then(h =>
        {
            host._irradianceHistory = h ?? { times: [], values: [] }; pushIrradianceToEngine(host);
        })
        .finally(() =>
        {
            host._irradianceFetching = false;
        });
}


// Merge cached recorder history with the live state and push to the engine. Called every refresh cycle (so the latest live sample
// is always in) and once a history fetch lands. Cheap: array concat + a setter that sorts once O(n log n).
//
// Dirty-flag gate: inputs are stable between hass pushes and fetches, so we hash (history identity, state identity, entity) and
// skip the rebuild when nothing changed. Without it, auto-rotate rebuilds the full sample set per render (move events mutate
// overlay @state -> updated() -> refreshIrradiance), causing GC churn.
const _pushedIrradianceKey = new WeakMap<IrradianceHost, {
    histRef: unknown;
    stateRef: unknown;
    entity: string;
}>();

export function pushIrradianceToEngine(host: IrradianceHost): void
{
    if (!host._engine)
    {
        return;
    }
    const entity = String(host.config?.['solar-irradiance-entity'] ?? '').trim();
    if (!entity || !host.hass)
    {
        host._engine.setSolarIrradianceSamples(null);
        _pushedIrradianceKey.delete(host);
        return;
    }
    const hist     = host._irradianceHistory;
    const stateRef = host.hass.states?.[entity];
    const cached = _pushedIrradianceKey.get(host);
    if (cached
        && cached.histRef  === hist
        && cached.stateRef === stateRef
        && cached.entity   === entity)
    {
        return;
    }
    const samples: { time: Date; wm2: number }[] = [];
    if (hist)
    {
        for (let i = 0; i < hist.times.length; i++)
        {
            samples.push({ time: hist.times[i], wm2: hist.values[i] });
        }
    }
    if (stateRef)
    {
        const v = parseFloat(stateRef.state);
        if (isFinite(v) && v >= 0)
        {
            const ts = stateRef.last_updated
                ? new Date(stateRef.last_updated)
                : new Date();
            samples.push({ time: ts, wm2: v });
        }
    }
    host._engine.setSolarIrradianceSamples(samples.length > 0 ? samples : null);
    _pushedIrradianceKey.set(host, { histRef: hist, stateRef, entity });
}


// Irradiance history fetch: the shared single-entity stats-then-raw fetch (energy-stats.ts). Statistics
// (`statistics_during_period` 'mean') first, since HA-convention irradiance sensors expose `state_class: measurement`
// and land in LTS automatically at near-zero cost even at high frequency; falls back to raw history for non-LTS
// custom sensors. W/m² values are taken as-is, with no normalisation. Returns the fresh series on success, the
// last-good durable copy on a failed fetch (so the curve survives an HA restart / timeout), or an empty series for
// an empty window; does NOT push to the engine (the caller does that in the `.then`, since the engine owns the
// merged series).
export async function fetchIrradiance(
    hass:       HassLike,
    entityId:   string,
    start:      Date,
    end:        Date,
    durableKey: string,
): Promise<IrradianceHistory | null>
{
    return fetchStatsOrRawHistory(hass, entityId, start, end, durableKey, {
        parseStats:  parseIrradianceStats,
        parseRaw:    parseRawIrradianceHistory,
        warnKey:     'irradiance-fetch',
        // Fetch timed out or failed (HA restart, recorder stall): restore the last-good durable series so the engine
        // keeps real past irradiance rather than blanking back to Open-Meteo.
        warnMessage: 'irradiance fetch failed; showing cached data until it recovers',
    });
}


// Raw-history parser, the fallback when statistics is empty, via the shared per-entity parser (energy-stats.ts).
// Refuses a negative reading (irradiance is never negative) on top of the shared compact/verbose state + timestamp
// handling.
function parseRawIrradianceHistory(arr: any[]): IrradianceHistory
{
    return parseRawHistorySeries(arr, (s) =>
    {
        const v = parseFloat(s);
        return (isFinite(v) && v >= 0) ? v : null;
    });
}
