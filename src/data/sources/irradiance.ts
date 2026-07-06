// Solar-irradiance override subsystem.
//
// When `solar-irradiance-entity` is wired to a W/m² sensor, its samples beat the weather model for the live + past portions of
// the irradiance pipeline. Fetches history, keeps the live sample fresh each refresh cycle, and pushes the merged set into the
// engine via setSolarRadiationSamples().
//
// Same host-driven pattern as card/pv.ts and card/battery.ts: the card owns the `_irradiance*` fields; functions here read/write
// them through the structural IrradianceHost interface.

import type { HeliosConfig } from '../../core/config/helios-config';
import type { HeliosEngine } from '../../scene/helios-engine';
import { callWS } from '../ha-gateway';
import { RequestCache } from '../request-cache';
import { saveDurableSeries, loadDurableSeries } from '../durable-cache';
import { minuteAnchorMs } from '../source-fetch';
import { parseStatBoundaryLoose } from './energy-stats';
import { IRRADIANCE_CACHE_TTL_MS, HOUR_MS, DAY_MS} from '../../core/config/constants';


// Module-level history cache (mirrors PV/battery) so a navigation away and back does not re-trigger the WS round-trip;
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
    readonly hass:       any;
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
        // Clear everything when the entity is removed so the engine drops back to its built-in irradiance sources.
        if (host._irradianceHistory !== null)
        {
            host._irradianceHistory = null;
        }
        host._irradianceFetchKey = '';
        host._engine?.setSolarRadiationSamples(null);
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
    // Quantise the now-anchor to the minute so the dedupe key below stays stable between renders; an unquantised Date.now()
    // changes every millisecond, so the key never matches and the fetch re-fires every render. The 6 h cap is approximate, so
    // the minute of slop is harmless.
    const anchorMs     = minuteAnchorMs();
    const cap          = new Date(anchorMs - RAW_WINDOW_H * HOUR_MS);
    const fetchStart   = visibleStart < cap ? cap : visibleStart;
    const rangeKey = `${fetchStart.getTime()}|${host._timeRange.end.getTime()}`;
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
        .then(h => { host._irradianceHistory = h ?? { times: [], values: [] }; pushIrradianceToEngine(host); })
        .finally(() => { host._irradianceFetching = false; });
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
        host._engine.setSolarRadiationSamples(null);
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
    host._engine.setSolarRadiationSamples(samples.length > 0 ? samples : null);
    _pushedIrradianceKey.set(host, { histRef: hist, stateRef, entity });
}


// Fetch the irradiance history: defensive parsing across HA's compaction / minimal_response variants. W/m² values are taken
// as-is; the sensor is expected to expose irradiance in the unit the engine consumes, no normalisation.
// Pure irradiance history fetcher: no host mutation, no fetching flag, no module cache write, and it does NOT push to the
// engine (the caller does that in the `.then`, since the engine owns the merged series). Returns the fresh series on
// success, the last-good durable copy on a failed fetch (so the curve survives an HA restart / timeout), or an empty
// series for an empty window.
export async function fetchIrradiance(
    hass:       any,
    entityId:   string,
    start:      Date,
    end:        Date,
    durableKey: string,
): Promise<IrradianceHistory | null>
{
    if (!hass?.callWS)
    {
        return null;
    }
    try
    {
        const now = new Date();
        const fetchEnd = end > now ? now : end;
        if (start >= fetchEnd)
        {
            return { times: [], values: [] };
        }

        // Try statistics first. HA-convention irradiance sensors expose `state_class: measurement` and land in LTS automatically,
        // so the stats path scales to high-frequency feeds at near-zero cost. Falls back to raw history for non-LTS custom sensors,
        // at the cost of recorder bandwidth on the slim window.
        let history: IrradianceHistory = { times: [], values: [] };
        const statsResult: any = await callWS<any>(hass, {
            type:           'recorder/statistics_during_period',
            start_time:     start.toISOString(),
            end_time:       fetchEnd.toISOString(),
            statistic_ids:  [entityId],
            period:         '5minute',
            // Mean only. The parser refuses the cumulative `state` field (see parseIrradianceStats). Cumulative-counter entities
            // land empty here and the raw-history fallback below takes over.
            types:          ['mean'],
        });
        const statsArr: any[] = (statsResult && statsResult[entityId]) ?? [];
        if (statsArr.length > 0)
        {
            history = parseIrradianceStats(statsArr);
        }
        else
        {
            const rawResult: any = await callWS<any>(hass, {
                type:                     'history/history_during_period',
                start_time:               start.toISOString(),
                end_time:                 fetchEnd.toISOString(),
                entity_ids:               [entityId],
                minimal_response:         true,
                no_attributes:            true,
                significant_changes_only: true,
            });
            history = parseRawIrradianceHistory((rawResult && rawResult[entityId]) ?? []);
        }

        // Persist the last-good series so a failed fetch on the next load restores it instead of blanking.
        saveDurableSeries(durableKey, history);
        return history;
    }
    catch (_e)
    {
        // Fetch timed out or failed (HA restart, recorder stall): restore the last-good durable series so the engine keeps
        // real past irradiance rather than blanking back to Open-Meteo.
        return loadDurableSeries(durableKey, DAY_MS);
    }
}


// Raw-history parser, the fallback when statistics is empty. Tolerates the compact `s`/`lu` and verbose `state`/`last_updated`
// shapes, drops `unavailable`/`unknown`/empty samples, and falls back to the previous timestamp on a missing `lu` (HA compaction
// can omit it on consecutive identical samples).
function parseRawIrradianceHistory(arr: any[]): IrradianceHistory
{
    const times:  Date[]   = [];
    const values: number[] = [];
    let lastTsMs: number | null = null;

    for (const item of arr)
    {
        const sRaw = item?.s ?? item?.state;
        if (sRaw === null
            || sRaw === undefined
            || sRaw === 'unavailable'
            || sRaw === 'unknown'
            || sRaw === '')
        {
            continue;
        }
        const v = parseFloat(String(sRaw));
        if (!isFinite(v) || v < 0)
        {
            continue;
        }

        let ts: Date | null = null;
        const tsRaw =
            item?.lu             ??
            item?.lc             ??
            item?.last_updated   ??
            item?.last_changed   ??
            null;
        if (typeof tsRaw === 'number')
        {
            ts = new Date(tsRaw > 1e12 ? tsRaw : tsRaw * 1000);
        }
        else if (typeof tsRaw === 'string')
        {
            const asNum = Number(tsRaw);
            if (Number.isFinite(asNum) && asNum > 1e9)
            {
                ts = new Date(asNum > 1e12 ? asNum : asNum * 1000);
            }
            else
            {
                ts = new Date(tsRaw);
            }
        }
        if ((!ts || isNaN(ts.getTime())) && lastTsMs !== null)
        {
            ts = new Date(lastTsMs);
        }
        if (!ts || isNaN(ts.getTime()))
        {
            continue;
        }

        lastTsMs = ts.getTime();
        times.push(ts);
        values.push(v);
    }

    return { times, values };
}
