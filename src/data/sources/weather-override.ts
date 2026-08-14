// Weather-override subsystem.
//
// When a local sensor is wired to a weather variable (cloud cover, precipitation, snowfall, temperature, humidity),
// its readings beat the Open-Meteo model for the live + past portions of that variable. For each configured entity
// this fetches history, keeps the live sample fresh every refresh cycle, and pushes the merged series into the
// engine via setWeatherOverrideSamples(); the engine does the nearest-neighbour lookup at resolve time and leaves
// the forecast (future) on the model.
//
// Same host-driven, table-driven pattern as data/sources/irradiance.ts, generalised over every overridable variable.

import type { HassLike } from '../../core/ha-types';
import type { HeliosConfig } from '../../core/config/helios-config';
import type { HeliosEngine, WeatherOverrideVar } from '../../scene/helios-engine';
import { callWS } from '../ha-gateway';
import { RequestCache } from '../request-cache';
import { saveDurableSeries, loadDurableSeries } from '../durable-cache';
import { warnOnce } from '../log';
import { quantizedAnchorMs } from '../source-fetch';
import { parseStatBoundaryLoose } from './energy-stats';
import { HOUR_MS, DAY_MS } from '../../core/config/constants';


// Parallel times[]/values[] in the variable's own unit (%, mm, cm, °C).
interface NumSeries { times: Date[]; values: number[]; }

// One overridable variable: which engine field it feeds, its config entity key, and the valid range (null = unbounded).
interface OverrideDef { readonly variable: WeatherOverrideVar; readonly configKey: string; readonly min: number | null; readonly max: number | null; }
const OVERRIDES: readonly OverrideDef[] = [
    { variable: 'cloudCover',  configKey: 'cloud-cover-entity',   min: 0,    max: 100  },
    { variable: 'precip',      configKey: 'precipitation-entity', min: 0,    max: null },
    { variable: 'snowfall',    configKey: 'snowfall-entity',      min: 0,    max: null },
    { variable: 'temperature', configKey: 'temperature-entity',   min: null, max: null },
    { variable: 'humidity',    configKey: 'humidity-entity',      min: 0,    max: 100  },
];

//HA `weather` entity condition -> WMO weather code, so a weather entity can drive the condition (rain / snow /
//thunderstorm) the same way Open-Meteo's weather_code does. Unlisted conditions push no sample (model kept).
const CONDITION_TO_CODE: Record<string, number> = {
    'clear-night': 0, 'sunny': 0,
    'partlycloudy': 2,
    'cloudy': 3, 'windy': 3, 'windy-variant': 3, 'exceptional': 3,
    'fog': 45,
    'rainy': 63, 'pouring': 65,
    'snowy': 73, 'snowy-rainy': 73,
    'lightning': 95, 'lightning-rainy': 95, 'hail': 96,
};

const OVERRIDE_TTL_MS = 5 * 60 * 1000;
// Module-level history cache (mirrors irradiance/PV/battery): navigation away and back reuses the series, and the
// in-flight de-dup collapses concurrent mounts to one WS round-trip per (entity, window).
const _cache = new RequestCache<NumSeries | null>(OVERRIDE_TTL_MS);

// Wipe the module cache. Called from the card's resetDataCache() hook.
export function clearWeatherOverrideCaches(): void
{
    _cache.clear();
}


// Per-variable fetch/merge state on the host. Kept in a Map so the host exposes one field for all variables.
interface VarState
{
    history:  NumSeries | null;
    fetchKey: string;
    fetching: boolean;
    // Dirty-flag inputs for the push gate (history/state identity + entity), so an idle re-render does not rebuild
    // the sample array every frame during auto-rotate.
    pushedHist:   unknown;
    pushedState:  unknown;
    pushedEntity: string;
}

export interface WeatherOverrideHost
{
    readonly config:     HeliosConfig | undefined;
    readonly hass:       HassLike;
    readonly _timeRange: { start: Date; end: Date } | null;
    readonly _engine?:   HeliosEngine;

    _weatherOverrideState: Map<WeatherOverrideVar, VarState>;
}

function stateFor(host: WeatherOverrideHost, variable: WeatherOverrideVar): VarState
{
    let st = host._weatherOverrideState.get(variable);
    if (!st)
    {
        st = { history: null, fetchKey: '', fetching: false, pushedHist: undefined, pushedState: undefined, pushedEntity: '' };
        host._weatherOverrideState.set(variable, st);
    }
    return st;
}

// Clamp a raw sensor reading to the variable's valid range; null when it is not a finite number.
function clampReading(raw: number, def: OverrideDef): number | null
{
    if (!isFinite(raw)) { return null; }
    let v = raw;
    if (def.min !== null) { v = Math.max(def.min, v); }
    if (def.max !== null) { v = Math.min(def.max, v); }
    return v;
}


// Live + history refresh for every overridable variable, called each lifecycle cycle.
export function refreshWeatherOverrides(host: WeatherOverrideHost): void
{
    for (const def of OVERRIDES)
    {
        refreshOne(host, def);
    }
    refreshConditionOverride(host);
}


//Condition override from a HA `weather` entity: its state (and recorder history) mapped to WMO codes, pushed to
//the engine as the 'code' override so it drives the rain / snow / thunderstorm layers over the live + past window.
function refreshConditionOverride(host: WeatherOverrideHost): void
{
    const entity = String(host.config?.['weather-entity'] ?? '').trim();
    const st = stateFor(host, 'code');

    if (!entity || !host.hass)
    {
        if (st.history !== null) { st.history = null; }
        st.fetchKey     = '';
        st.pushedEntity = '';
        host._engine?.setWeatherOverrideSamples('code', null);
        return;
    }

    pushCondition(host, entity);

    if (!host._timeRange || st.fetching) { return; }

    const RAW_WINDOW_H = 6;
    const anchorMs   = quantizedAnchorMs(OVERRIDE_TTL_MS);
    const cap        = new Date(anchorMs - RAW_WINDOW_H * HOUR_MS);
    const fetchStart = host._timeRange.start < cap ? cap : host._timeRange.start;
    const keyEnd     = Math.floor(host._timeRange.end.getTime() / OVERRIDE_TTL_MS) * OVERRIDE_TTL_MS;
    const fetchKey   = `code:${entity}@${fetchStart.getTime()}|${keyEnd}`;
    if (fetchKey === st.fetchKey) { return; }
    st.fetchKey = fetchKey;

    const durableKey = `wxo:code:${entity}`;
    st.fetching = true;
    void _cache.get(fetchKey, () => fetchConditionHistory(host.hass, entity, fetchStart, host._timeRange!.end, durableKey))
        .then(h => { st.history = h ?? { times: [], values: [] }; pushCondition(host, entity); })
        .finally(() => { st.fetching = false; });
}

function pushCondition(host: WeatherOverrideHost, entity: string): void
{
    if (!host._engine) { return; }
    const st       = stateFor(host, 'code');
    const hist     = st.history;
    const stateRef = host.hass.states?.[entity];
    if (st.pushedHist === hist && st.pushedState === stateRef && st.pushedEntity === entity) { return; }

    const samples: { time: Date; value: number }[] = [];
    if (hist)
    {
        for (let i = 0; i < hist.times.length; i++) { samples.push({ time: hist.times[i], value: hist.values[i] }); }
    }
    if (stateRef)
    {
        const code = CONDITION_TO_CODE[String(stateRef.state)];
        if (code !== undefined)
        {
            const ts = stateRef.last_updated ? new Date(stateRef.last_updated) : new Date();
            samples.push({ time: ts, value: code });
        }
    }
    host._engine.setWeatherOverrideSamples('code', samples.length > 0 ? samples : null);
    st.pushedHist   = hist;
    st.pushedState  = stateRef;
    st.pushedEntity = entity;
}

//Condition history: raw recorder states mapped to WMO codes (skipping unknown/unavailable conditions). Restores
//the last-good durable copy on a failed fetch.
async function fetchConditionHistory(hass: HassLike, entityId: string, start: Date, end: Date, durableKey: string): Promise<NumSeries | null>
{
    if (!hass?.callWS) { return null; }
    try
    {
        const now = new Date();
        const fetchEnd = end > now ? now : end;
        if (start >= fetchEnd) { return { times: [], values: [] }; }

        const raw: any = await callWS<any>(hass, {
            type:                     'history/history_during_period',
            start_time:               start.toISOString(),
            end_time:                 fetchEnd.toISOString(),
            entity_ids:               [entityId],
            minimal_response:         true,
            no_attributes:            true,
            significant_changes_only: true,
        });
        const arr: any[] = (raw && raw[entityId]) ?? [];
        const times: Date[] = [];
        const values: number[] = [];
        let lastTsMs: number | null = null;
        for (const item of arr)
        {
            const code = CONDITION_TO_CODE[String(item?.s ?? item?.state)];
            const tsRaw = item?.lu ?? item?.lc ?? item?.last_updated ?? item?.last_changed ?? null;
            let ts: Date | null = typeof tsRaw === 'number'
                ? new Date(tsRaw > 1e12 ? tsRaw : tsRaw * 1000)
                : (typeof tsRaw === 'string' ? new Date(tsRaw) : null);
            if ((!ts || isNaN(ts.getTime())) && lastTsMs !== null) { ts = new Date(lastTsMs); }
            if (code === undefined || !ts || isNaN(ts.getTime())) { continue; }
            lastTsMs = ts.getTime();
            times.push(ts);
            values.push(code);
        }
        const series = { times, values };
        saveDurableSeries(durableKey, series);
        return series;
    }
    catch (_e)
    {
        warnOnce(`wxo-fetch-${durableKey}`, 'weather condition fetch failed; showing cached data until it recovers');
        return loadDurableSeries(durableKey, DAY_MS);
    }
}

function refreshOne(host: WeatherOverrideHost, def: OverrideDef): void
{
    const entity = String(host.config?.[def.configKey] ?? '').trim();
    const st = stateFor(host, def.variable);

    if (!entity || !host.hass)
    {
        if (st.history !== null) { st.history = null; }
        st.fetchKey     = '';
        st.pushedEntity = '';
        host._engine?.setWeatherOverrideSamples(def.variable, null);
        return;
    }

    // Keep the engine's "now" sample fresh every cycle (the engine de-dupes on sort, so it is cheap).
    pushOne(host, def, entity);

    if (!host._timeRange || st.fetching) { return; }

    // Narrow raw-window cap (mirrors irradiance): a high-frequency sensor over a multi-day timeline would drag the
    // recorder. The head of the curve needs the live data; older values interpolate from the resampled series.
    // Cap anchored on NOW so fetchStart stays in the past even when the timeline end sits in the forecast horizon.
    const RAW_WINDOW_H = 6;
    const anchorMs   = quantizedAnchorMs(OVERRIDE_TTL_MS);
    const cap        = new Date(anchorMs - RAW_WINDOW_H * HOUR_MS);
    const fetchStart = host._timeRange.start < cap ? cap : host._timeRange.start;
    const keyEnd     = Math.floor(host._timeRange.end.getTime() / OVERRIDE_TTL_MS) * OVERRIDE_TTL_MS;
    const fetchKey   = `${def.variable}:${entity}@${fetchStart.getTime()}|${keyEnd}`;
    if (fetchKey === st.fetchKey) { return; }
    st.fetchKey = fetchKey;

    const durableKey = `wxo:${def.variable}:${entity}`;
    st.fetching = true;
    void _cache.get(fetchKey, () => fetchNumericHistory(host.hass, entity, fetchStart, host._timeRange!.end, durableKey, def))
        .then(h => { st.history = h ?? { times: [], values: [] }; pushOne(host, def, entity); })
        .finally(() => { st.fetching = false; });
}

// Merge cached recorder history with the live state and push to the engine. Dirty-flag gated so an unchanged
// (history, state, entity) triple skips the rebuild.
function pushOne(host: WeatherOverrideHost, def: OverrideDef, entity: string): void
{
    if (!host._engine) { return; }
    const st       = stateFor(host, def.variable);
    const hist     = st.history;
    const stateRef = host.hass.states?.[entity];
    if (st.pushedHist === hist && st.pushedState === stateRef && st.pushedEntity === entity) { return; }

    const samples: { time: Date; value: number }[] = [];
    if (hist)
    {
        for (let i = 0; i < hist.times.length; i++) { samples.push({ time: hist.times[i], value: hist.values[i] }); }
    }
    if (stateRef)
    {
        const v = clampReading(parseFloat(stateRef.state), def);
        if (v !== null)
        {
            const ts = stateRef.last_updated ? new Date(stateRef.last_updated) : new Date();
            samples.push({ time: ts, value: v });
        }
    }
    host._engine.setWeatherOverrideSamples(def.variable, samples.length > 0 ? samples : null);
    st.pushedHist   = hist;
    st.pushedState  = stateRef;
    st.pushedEntity = entity;
}


// Pure numeric-history fetcher: statistics `mean` first (scales to high-frequency measurement sensors that land in
// LTS), raw history as the fallback. Returns the fresh series, the last-good durable copy on a failed fetch, or an
// empty series for an empty window. No host mutation and no engine push (the caller pushes in the `.then`).
export async function fetchNumericHistory(
    hass:       HassLike,
    entityId:   string,
    start:      Date,
    end:        Date,
    durableKey: string,
    def:        OverrideDef,
): Promise<NumSeries | null>
{
    if (!hass?.callWS) { return null; }
    try
    {
        const now = new Date();
        const fetchEnd = end > now ? now : end;
        if (start >= fetchEnd) { return { times: [], values: [] }; }

        let series: NumSeries = { times: [], values: [] };
        const statsResult: any = await callWS<any>(hass, {
            type:          'recorder/statistics_during_period',
            start_time:    start.toISOString(),
            end_time:      fetchEnd.toISOString(),
            statistic_ids: [entityId],
            period:        '5minute',
            types:         ['mean'],
        });
        const statsArr: any[] = (statsResult && statsResult[entityId]) ?? [];
        if (statsArr.length > 0)
        {
            series = parseStats(statsArr, def);
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
            series = parseRaw((rawResult && rawResult[entityId]) ?? [], def);
        }

        saveDurableSeries(durableKey, series);
        return series;
    }
    catch (_e)
    {
        warnOnce(`wxo-fetch-${durableKey}`, 'weather override fetch failed; showing cached data until it recovers');
        return loadDurableSeries(durableKey, DAY_MS);
    }
}

// Statistics parser: the `mean` column at the bucket midpoint. Buckets with a null/out-of-range mean are skipped.
function parseStats(arr: any[], def: OverrideDef): NumSeries
{
    const times: Date[] = [];
    const values: number[] = [];
    for (const item of arr ?? [])
    {
        const startMs = parseStatBoundaryLoose(item?.start);
        const endMs   = parseStatBoundaryLoose(item?.end);
        if (startMs === null) { continue; }
        const raw = item?.mean;
        if (raw === null || raw === undefined) { continue; }
        const v = clampReading(typeof raw === 'number' ? raw : parseFloat(String(raw)), def);
        if (v === null) { continue; }
        times.push(new Date(endMs !== null ? (startMs + endMs) / 2 : startMs));
        values.push(v);
    }
    return { times, values };
}

// Raw-history parser (fallback), tolerant of the compact `s`/`lu` and verbose `state`/`last_updated` shapes; drops
// unavailable/unknown/empty and falls back to the previous timestamp when `lu` is omitted on repeats.
function parseRaw(arr: any[], def: OverrideDef): NumSeries
{
    const times: Date[] = [];
    const values: number[] = [];
    let lastTsMs: number | null = null;

    for (const item of arr)
    {
        const sRaw = item?.s ?? item?.state;
        if (sRaw === null || sRaw === undefined || sRaw === 'unavailable' || sRaw === 'unknown' || sRaw === '') { continue; }
        const v = clampReading(parseFloat(String(sRaw)), def);
        if (v === null) { continue; }

        let ts: Date | null = null;
        const tsRaw = item?.lu ?? item?.lc ?? item?.last_updated ?? item?.last_changed ?? null;
        if (typeof tsRaw === 'number')
        {
            ts = new Date(tsRaw > 1e12 ? tsRaw : tsRaw * 1000);
        }
        else if (typeof tsRaw === 'string')
        {
            const asNum = Number(tsRaw);
            ts = (Number.isFinite(asNum) && asNum > 1e9) ? new Date(asNum > 1e12 ? asNum : asNum * 1000) : new Date(tsRaw);
        }
        if ((!ts || isNaN(ts.getTime())) && lastTsMs !== null) { ts = new Date(lastTsMs); }
        if (!ts || isNaN(ts.getTime())) { continue; }

        lastTsMs = ts.getTime();
        times.push(ts);
        values.push(v);
    }
    return { times, values };
}
