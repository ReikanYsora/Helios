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
import { parseStatBoundaryLoose, parseRawHistorySeries, fetchStatsOrRawHistory } from './energy-stats';
import { temperatureToCelsius } from '../../core/format/format';
import { HOUR_MS, DAY_MS } from '../../core/config/constants';


// Parallel times[]/values[] in the variable's own CANONICAL unit (%, mm, cm, °C), never the source sensor's.
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

//The config keys above, for callers that need to know which entities feed this subsystem without depending on
//OverrideDef itself (e.g. the card's hass-churn reactivity gate).
export const WEATHER_OVERRIDE_CONFIG_KEYS: readonly string[] = OVERRIDES.map((o) => o.configKey);

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
// Module-level history cache (mirrors irradiance/battery): navigation away and back reuses the series, and the
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

// Clamp a raw sensor reading to the variable's valid range; null when it is not a finite number. The reading is
// normalised to the canonical unit FIRST, so the range bounds stay expressed in canonical units.
function clampReading(raw: number, def: OverrideDef, conv: ReadingConverter): number | null
{
    if (!isFinite(raw))
    {
        return null;
    }
    let v = conv.convert(raw);
    if (!isFinite(v))
    {
        return null;
    }
    if (def.min !== null)
    {
        v = Math.max(def.min, v);
    }
    if (def.max !== null)
    {
        v = Math.min(def.max, v);
    }
    return v;
}


// A sensor reports in whatever unit its entity declares, while the model, the engine and the store are all canonical
// (%, mm, cm, °C). Normalise at ingest so a °F probe feeds exactly the same pipeline as an Open-Meteo °C hour;
// without this a 73 °F reading lands in the store as 73 °C. `tag` keys the caches so a unit change re-fetches
// instead of serving values converted under the previous unit.
interface ReadingConverter { convert: (v: number) => number; tag: string; }

const IDENTITY_CONVERTER: ReadingConverter = { convert: (v) => v, tag: '' };

function readingConverter(hass: HassLike, entityId: string, def: OverrideDef): ReadingConverter
{
    if (def.variable !== 'temperature')
    {
        return IDENTITY_CONVERTER;
    }
    const unit = String(hass?.states?.[entityId]?.attributes?.unit_of_measurement ?? '').trim();
    const convert = temperatureToCelsius(unit);
    return convert ? { convert, tag: `@${unit}` } : IDENTITY_CONVERTER;
}


// Live + history refresh for every overridable variable, called each lifecycle cycle. The numeric OVERRIDES share
// refreshVar/pushVar with the condition override below (a HA `weather` entity's state, and recorder history, mapped
// to WMO codes and pushed as the 'code' override so it drives the rain / snow / thunderstorm layers): both are the
// same fetch-key/cache-gate and dirty-flag-gated push scaffolding, differing only in how the live value is derived
// from the entity's state (clampReading+conv vs a CONDITION_TO_CODE lookup) and which config key/history fetcher
// feeds them.
export function refreshWeatherOverrides(host: WeatherOverrideHost): void
{
    for (const def of OVERRIDES)
    {
        refreshVar(
            host, def.variable, def.configKey,
            (hass, entity) => readingConverter(hass, entity, def),
            (stateRef, conv) => clampReading(parseFloat(stateRef.state), def, conv),
            (hass, entityId, start, end, durableKey, conv) => fetchNumericHistory(hass, entityId, start, end, durableKey, def, conv),
        );
    }
    refreshVar(
        host, 'code', 'weather-entity',
        () => IDENTITY_CONVERTER,
        (stateRef) => CONDITION_TO_CODE[String(stateRef.state)] ?? null,
        (hass, entityId, start, end, durableKey) => fetchConditionHistory(hass, entityId, start, end, durableKey),
    );
}


// Live + history refresh for one overridable variable (shared by the numeric OVERRIDES and the 'code' condition
// override). `convFor` re-derives the entity's reading converter (identity for 'code', which carries no unit);
// `deriveLive` turns the entity's current state into the variable's live sample; `fetchHistory` pulls its past
// series (numeric stats+raw for the OVERRIDES vars, condition-code raw history for 'code').
function refreshVar(
    host:         WeatherOverrideHost,
    variable:     WeatherOverrideVar,
    configKey:    string,
    convFor:      (hass: HassLike, entity: string) => ReadingConverter,
    deriveLive:   (stateRef: HassLike['states'][string], conv: ReadingConverter) => number | null,
    fetchHistory: (hass: HassLike, entityId: string, start: Date, end: Date, durableKey: string, conv: ReadingConverter) => Promise<NumSeries | null>,
): void
{
    const entity = String(host.config?.[configKey] ?? '').trim();
    const st = stateFor(host, variable);

    if (!entity || !host.hass)
    {
        if (st.history !== null)
        {
            st.history = null;
        }
        st.fetchKey     = '';
        st.pushedEntity = '';
        host._engine?.setWeatherOverrideSamples(variable, null);
        return;
    }

    const conv = convFor(host.hass, entity);

    // Keep the engine's "now" sample fresh every cycle (the engine de-dupes on sort, so it is cheap).
    pushVar(host, variable, entity, conv, deriveLive);

    if (!host._timeRange || st.fetching)
    {
        return;
    }

    // Narrow raw-window cap: a high-frequency sensor over a multi-day timeline would drag the recorder. The head of
    // the curve needs the live data; older values interpolate from the resampled series. Cap anchored on NOW so
    // fetchStart stays in the past even when the timeline end sits in the forecast horizon.
    const RAW_WINDOW_H = 6;
    const anchorMs   = quantizedAnchorMs(OVERRIDE_TTL_MS);
    const cap        = new Date(anchorMs - RAW_WINDOW_H * HOUR_MS);
    const fetchStart = host._timeRange.start < cap ? cap : host._timeRange.start;
    const keyEnd     = Math.floor(host._timeRange.end.getTime() / OVERRIDE_TTL_MS) * OVERRIDE_TTL_MS;
    const fetchKey   = `${variable}:${entity}${conv.tag}@${fetchStart.getTime()}|${keyEnd}`;
    if (fetchKey === st.fetchKey)
    {
        return;
    }
    st.fetchKey = fetchKey;

    const durableKey = `wxo:${variable}:${entity}${conv.tag}`;
    st.fetching = true;
    void _cache.get(fetchKey, () => fetchHistory(host.hass, entity, fetchStart, host._timeRange!.end, durableKey, conv))
        .then(h =>
        {
            // The entity, or the unit it declares, can change while this request is in flight. The refresh that
            // noticed already bailed on `st.fetching` without re-keying, so `st.fetchKey` still holds THIS fetch's
            // key and cannot detect the change: re-derive the live wiring instead. Installing a stale result would
            // overwrite the freshly converted live sample with history converted under the previous unit. Clearing
            // the key re-arms the next cycle against the current wiring (mirrors grid-guard's mid-fetch bail).
            const liveEntity = String(host.config?.[configKey] ?? '').trim();
            if (liveEntity !== entity || convFor(host.hass, entity).tag !== conv.tag)
            {
                st.fetchKey = '';
                return;
            }
            st.history = h ?? { times: [], values: [] };
            pushVar(host, variable, entity, conv, deriveLive);
        })
        .finally(() =>
        {
            st.fetching = false;
        });
}

// Merge cached recorder history with the live state and push to the engine. Dirty-flag gated so an unchanged
// (history, state, entity) triple skips the rebuild. `deriveLive` is the one thing that differs between the
// numeric OVERRIDES (clampReading+conv) and the 'code' condition override (a CONDITION_TO_CODE lookup).
function pushVar(
    host:       WeatherOverrideHost,
    variable:   WeatherOverrideVar,
    entity:     string,
    conv:       ReadingConverter,
    deriveLive: (stateRef: HassLike['states'][string], conv: ReadingConverter) => number | null,
): void
{
    if (!host._engine)
    {
        return;
    }
    const st       = stateFor(host, variable);
    const hist     = st.history;
    const stateRef = host.hass.states?.[entity];
    if (st.pushedHist === hist && st.pushedState === stateRef && st.pushedEntity === entity)
    {
        return;
    }

    const samples: { time: Date; value: number }[] = [];
    if (hist)
    {
        for (let i = 0; i < hist.times.length; i++)
        {
            samples.push({ time: hist.times[i], value: hist.values[i] });
        }
    }
    if (stateRef)
    {
        const v = deriveLive(stateRef, conv);
        if (v !== null)
        {
            const ts = stateRef.last_updated ? new Date(stateRef.last_updated) : new Date();
            samples.push({ time: ts, value: v });
        }
    }
    host._engine.setWeatherOverrideSamples(variable, samples.length > 0 ? samples : null);
    st.pushedHist   = hist;
    st.pushedState  = stateRef;
    st.pushedEntity = entity;
}

//Condition history: raw recorder states mapped to WMO codes (skipping unknown/unavailable conditions). Restores
//the last-good durable copy on a failed fetch.
async function fetchConditionHistory(hass: HassLike, entityId: string, start: Date, end: Date, durableKey: string): Promise<NumSeries | null>
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
            if ((!ts || isNaN(ts.getTime())) && lastTsMs !== null)
            {
                ts = new Date(lastTsMs);
            }
            if (code === undefined || !ts || isNaN(ts.getTime()))
            {
                continue;
            }
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

// Numeric-history fetcher for the OVERRIDES vars: the shared single-entity stats-then-raw fetch (energy-stats.ts).
// Values come back in the variable's canonical unit (`conv` normalises whatever the entity reports). No host
// mutation and no engine push (the caller pushes in the `.then`).
export async function fetchNumericHistory(
    hass:       HassLike,
    entityId:   string,
    start:      Date,
    end:        Date,
    durableKey: string,
    def:        OverrideDef,
    conv:       ReadingConverter = IDENTITY_CONVERTER,
): Promise<NumSeries | null>
{
    return fetchStatsOrRawHistory(hass, entityId, start, end, durableKey, {
        parseStats:  (arr) => parseStats(arr, def, conv),
        parseRaw:    (arr) => parseRaw(arr, def, conv),
        warnKey:     `wxo-fetch-${durableKey}`,
        warnMessage: 'weather override fetch failed; showing cached data until it recovers',
    });
}

// Statistics parser: the `mean` column at the bucket midpoint. Buckets with a null/out-of-range mean are skipped.
function parseStats(arr: any[], def: OverrideDef, conv: ReadingConverter): NumSeries
{
    const times: Date[] = [];
    const values: number[] = [];
    for (const item of arr ?? [])
    {
        const startMs = parseStatBoundaryLoose(item?.start);
        const endMs   = parseStatBoundaryLoose(item?.end);
        if (startMs === null)
        {
            continue;
        }
        const raw = item?.mean;
        if (raw === null || raw === undefined)
        {
            continue;
        }
        const v = clampReading(typeof raw === 'number' ? raw : parseFloat(String(raw)), def, conv);
        if (v === null)
        {
            continue;
        }
        times.push(new Date(endMs !== null ? (startMs + endMs) / 2 : startMs));
        values.push(v);
    }
    return { times, values };
}

// Raw-history parser (fallback), via the shared per-entity parser (energy-stats.ts): compact/verbose state +
// timestamp shapes, epoch ms/seconds magnitude check, carry-forward onto the previous sample's timestamp when a
// repeat omits its own, clamped/converted through the variable's own reading rules.
function parseRaw(arr: any[], def: OverrideDef, conv: ReadingConverter): NumSeries
{
    return parseRawHistorySeries(arr, (s) => clampReading(parseFloat(s), def, conv));
}
