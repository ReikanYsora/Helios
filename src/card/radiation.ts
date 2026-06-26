// Solar-irradiance override subsystem.
//
// When `solar-radiation-entity` is wired to a physical W/m² sensor, its samples beat the weather model for the live + past
// portions of the irradiance pipeline. Fetches history, keeps the live sample fresh each refresh cycle, and pushes the merged
// set into the engine via setSolarRadiationSamples().
//
// Same host-driven pattern as card/pv.ts and card/battery.ts: the card owns the `_solarRadiation*` fields; functions here
// read/write them through the structural RadiationHost interface.

import type { HeliosConfig } from '../helios-config';
import type { HeliosEngine } from '../helios-engine';
import { callWSWithTimeout, WsTimeoutError } from './ws-timeout';
import { RADIATION_CACHE_TTL_MS } from '../constants';


// Module-level history cache (mirrors PV/battery) so a navigation away and back does not re-trigger the WS round-trip.

interface RadiationHistoryCacheEntry
{
    history: RadiationHistory;
    ts:      number;
}

const _radiationHistoryCache: Map<string, RadiationHistoryCacheEntry> = new Map();

function radiationHistoryCacheGet(key: string): RadiationHistoryCacheEntry | null
{
    const e = _radiationHistoryCache.get(key);
    if (!e)
    {
        return null;
    }
    if (Date.now() - e.ts > RADIATION_CACHE_TTL_MS)
    {
        _radiationHistoryCache.delete(key);
        return null;
    }
    return e;
}


// Wipe the module cache. Called from the card's `resetDataCache()` hook.
export function clearRadiationModuleCaches(): void
{
    _radiationHistoryCache.clear();
}


// Coerce a `start`/`end` statistics field into a ms epoch. Duplicated from the PV/battery parsers to keep this module self-contained.
function parseStatBoundary(raw: unknown): number | null
{
    if (raw === null || raw === undefined)
    {
        return null;
    }
    if (typeof raw === 'number')
    {
        return raw > 1e12 ? raw : raw * 1000;
    }
    if (typeof raw === 'string')
    {
        const asNum = Number(raw);
        if (Number.isFinite(asNum) && asNum > 1e9)
        {
            return asNum > 1e12 ? asNum : asNum * 1000;
        }
        const d = new Date(raw);
        const t = d.getTime();
        return isFinite(t) ? t : null;
    }
    return null;
}


// Parse a statistics payload into a RadiationHistory. Irradiance sensors are `state_class: measurement` reporting instantaneous
// W/m²; the `mean` column carries the bucket-averaged value, anchored at the bucket midpoint to match the engine's W/m² assumption.
//
// We deliberately do NOT fall back to `state`: a few installs surface irradiance as a cumulative MJ/m² counter
// (`state_class: total_increasing`), so `state` is monotonically increasing. Pushing that would feed the engine values that look
// like 10000+ W/m² and distort every downstream derivation (5-day calibration ratio, refined forecast, irradiance chip). Buckets
// with null `mean` are skipped; an empty slot degrades to the raw-history fallback (which handles its own unit semantics).
function parseRadiationStats(arr: any[]): RadiationHistory
{
    const times:  Date[]   = [];
    const values: number[] = [];
    for (const item of arr ?? [])
    {
        const startMs = parseStatBoundary(item?.start);
        const endMs   = parseStatBoundary(item?.end);
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
export interface RadiationHistory
{
    times:  Date[];
    values: number[];
}

// Structural surface the host card exposes to this module.
export interface RadiationHost
{
    readonly config:     HeliosConfig | undefined;
    readonly hass:       any;
    readonly _timeRange: { start: Date; end: Date } | null;
    readonly _engine?:   HeliosEngine;

    _solarRadiationHistory:  RadiationHistory | null;
    _solarRadiationFetchKey: string;
    _solarRadiationFetching: boolean;
}


// Live + history refresh, called from the card every lifecycle cycle. Fast-paths exit early with no entity configured; the engine
// is then notified so it drops back to its built-in irradiance sources.
export function refreshSolarRadiation(host: RadiationHost): void
{
    const entity = String(host.config?.['solar-radiation-entity'] ?? '').trim();

    if (!entity || !host.hass)
    {
        // Clear everything when the entity is removed so the engine drops back to its built-in irradiance sources.
        if (host._solarRadiationHistory !== null)
        {
            host._solarRadiationHistory = null;
        }
        host._solarRadiationFetchKey = '';
        host._engine?.setSolarRadiationSamples(null);
        return;
    }

    // Push the latest live state on every Lit cycle to keep the engine's "now" sample fresh; the engine de-dupes on sort, so the
    // cost is tiny even at sub-minute tick rates.
    pushSolarRadiationToEngine(host);

    if (!host._timeRange || host._solarRadiationFetching)
    {
        return;
    }
    // Narrow raw-window cap: a per-second W/m² sensor over a multi-day timeline would drag the HA recorder for the whole fetch
    // and block other cards reading the same entity. The chart only needs accurate live data
    // at the head of the curve; older past values are interpolated from the engine's resampled series. 6 h gives the W/m² tooltip
    // enough resolution while keeping the recorder responsive.
    //
    // Cap anchored on NOW so fetchStart stays in the past even when the visible timeline end sits in the forecast horizon (next
    // day). Anchoring on timeline end would put fetchStart in the future and the inner clamp would leave the slot empty.
    const RAW_WINDOW_H = 6;
    const visibleStart = host._timeRange.start;
    const cap          = new Date(Date.now() - RAW_WINDOW_H * 3_600_000);
    const fetchStart   = visibleStart < cap ? cap : visibleStart;
    const rangeKey = `${fetchStart.getTime()}|${host._timeRange.end.getTime()}`;
    const fetchKey = `${entity}@${rangeKey}`;
    if (fetchKey === host._solarRadiationFetchKey)
    {
        return;
    }
    host._solarRadiationFetchKey = fetchKey;

    // Cache hit short-circuits the WS round-trip on navigation. Invalidates on TTL (15 min) or any entity/range change (which flips the fetch key).
    const cached = radiationHistoryCacheGet(fetchKey);
    if (cached)
    {
        host._solarRadiationHistory = cached.history;
        pushSolarRadiationToEngine(host);
        return;
    }
    fetchSolarRadiationHistory(host, entity, fetchStart, host._timeRange.end, fetchKey);
}


// Merge cached recorder history with the live state and push to the engine. Called every refresh cycle (so the latest live sample
// is always in) and once a history fetch lands. Cheap: array concat + a setter that sorts once O(n log n).
//
// Dirty-flag gate: inputs are stable between hass pushes and fetches, so we hash (history identity, state identity, entity) and
// skip the rebuild when nothing changed. Without it, auto-rotate rebuilds ~700 sample objects per render (move events mutate
// overlay @state -> updated() -> refreshSolarRadiation), causing massive GC churn.
const _pushedRadiationKey = new WeakMap<RadiationHost, {
    histRef: unknown;
    stateRef: unknown;
    entity: string;
}>();

export function pushSolarRadiationToEngine(host: RadiationHost): void
{
    if (!host._engine)
    {
        return;
    }
    const entity = String(host.config?.['solar-radiation-entity'] ?? '').trim();
    if (!entity || !host.hass)
    {
        host._engine.setSolarRadiationSamples(null);
        _pushedRadiationKey.delete(host);
        return;
    }
    const hist     = host._solarRadiationHistory;
    const stateRef = host.hass.states?.[entity];
    const cached = _pushedRadiationKey.get(host);
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
    _pushedRadiationKey.set(host, { histRef: hist, stateRef, entity });
}


// Fetch the irradiance history: defensive parsing across HA's compaction / minimal_response variants. W/m² values are taken
// as-is; the sensor is expected to expose irradiance in the unit the engine consumes, no normalisation step.
export async function fetchSolarRadiationHistory(
    host:     RadiationHost,
    entityId: string,
    start:    Date,
    end:      Date,
    cacheKey: string = '',
): Promise<void>
{
    if (!host.hass?.callWS)
    {
        return;
    }
    host._solarRadiationFetching = true;
    try
    {
        const now = new Date();
        const fetchEnd = end > now ? now : end;
        if (start >= fetchEnd)
        {
            host._solarRadiationHistory = { times: [], values: [] };
            pushSolarRadiationToEngine(host);
            return;
        }

        // Try statistics first. HA-convention irradiance sensors expose `state_class: measurement` and land in LTS automatically,
        // so the stats path scales to high-frequency feeds at near-zero cost. Falls back to raw history for non-LTS custom sensors,
        // at the cost of recorder bandwidth on the slim 2-day window.
        let history: RadiationHistory = { times: [], values: [] };
        const statsResult: any = await callWSWithTimeout<any>(host.hass, {
            type:           'recorder/statistics_during_period',
            start_time:     start.toISOString(),
            end_time:       fetchEnd.toISOString(),
            statistic_ids:  [entityId],
            period:         '5minute',
            // Mean only. The parser refuses the cumulative `state` field (see parseRadiationStats). Cumulative-counter entities
            // land empty here and the raw-history fallback below takes over.
            types:          ['mean'],
        });
        const statsArr: any[] = (statsResult && statsResult[entityId]) ?? [];
        if (statsArr.length > 0)
        {
            history = parseRadiationStats(statsArr);
        }
        else
        {
            const rawResult: any = await callWSWithTimeout<any>(host.hass, {
                type:                     'history/history_during_period',
                start_time:               start.toISOString(),
                end_time:                 fetchEnd.toISOString(),
                entity_ids:               [entityId],
                minimal_response:         true,
                no_attributes:            true,
                significant_changes_only: true,
            });
            history = parseRawRadiationHistory((rawResult && rawResult[entityId]) ?? []);
        }

        host._solarRadiationHistory = history;
        pushSolarRadiationToEngine(host);
        if (cacheKey)
        {
            _radiationHistoryCache.set(cacheKey, { history, ts: Date.now() });
        }
    }
    catch (e)
    {
        if (e instanceof WsTimeoutError)
        {
            console.warn(`[HELIOS] solar radiation fetch timed out (${e.timeoutMs} ms), engine falls back to Open-Meteo for the past window.`);
        }
        else
        {
            console.warn('[HELIOS] Solar radiation history fetch failed:', e);
        }
        host._solarRadiationHistory = { times: [], values: [] };
        pushSolarRadiationToEngine(host);
    }
    finally
    {
        host._solarRadiationFetching = false;
    }
}


// Raw-history parser, kept for the statistics fallback path. Tolerates the compact `s`/`lu` and verbose `state`/`last_updated`
// shapes, drops `unavailable`/`unknown`/empty samples, and falls back to the previous timestamp on a missing `lu` (HA compaction
// can omit it on consecutive identical samples).
function parseRawRadiationHistory(arr: any[]): RadiationHistory
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
