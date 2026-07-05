//Photovoltaic data subsystem: live polling, history/LTS fetch, instantaneous-rate derivation, calibration, chip/chart formatting.
//
//Functions operate on a "host" (the card) that owns the @state PV fields. Writing back through the card's setters preserves
//Lit reactivity, so calling refreshPv(this) from a lifecycle hook re-renders.

import type { HeliosConfig } from '../helios-config';
import type { EnergyDefaults } from './energy-prefs';
import { pvNormalizeToWatts, formatEntityValue, type PowerUnit } from './format';
import { callWSWithTimeout } from './ws-timeout';
import { fetchChangeSeries, wattsAtFromChangeSeries, changeRefreshAnchorMs, type ChangeBucket, type StatPeriod } from './energy-stats';
import { PV_CACHE_TTL_MS, DAY_MS } from '../constants';
//Re-export so battery/grid/charts/helios-card can import pvNormalizeToWatts from './pv'.
export { pvNormalizeToWatts } from './format';


//Resolve the live PV entity: the first declared power sensor (`stat_rate`), or empty when the install
//has none. Measured-only: a cumulative meter is never treated as a live entity; installs without a
//power sensor simply have no live PV state (their curves and totals read the recorder meters). The
//history/calibration fetches key on the meters separately.
export function resolvePvLiveEntity(defaults: EnergyDefaults): string
{
    return defaults.solarStatRates[0] ?? '';
}




//Historical series as parallel times[]/values[] arrays so a sample can be located by timestamp without allocating wrapper objects.
export interface PvHistory
{
    times:  Date[];
    values: number[];
}

//Result of a rate computation. `unit` is what the PV chip prints after the value (W / kW / MW / "<unit>/h").
export interface PvRate
{
    value: number;
    unit:  string;
}

//Structural surface the host card exposes here. The mutable `_pv*` fields are non-readonly so helpers can assign them;
//@state reactivity is preserved because assignment hits the decorator's setter.
export interface PvHost
{
    readonly config:     HeliosConfig | undefined;
    readonly hass:       any;
    readonly _timeRange: { start: Date; end: Date } | null;
    readonly _energyDefaults: EnergyDefaults;
    //Rolling-window past days (period selector), so the change-series fetch spans the whole store window.
    readonly _periodPastDays: number;
    //Recorder period for the change-series, per the active timeline mode (5-min / hour / day).
    readonly _storeFetchPeriod: StatPeriod;

    requestUpdate(): void;

    _pvCurrent:             number | null;
    _pvUnit:                string;
    _pvHistory:             PvHistory | null;
    //Per-entity histories alongside the aggregated `_pvHistory` so the chart renders one curve per source and the scrub
    //tooltip shows a per-entity breakdown. Keyed by entity id; single-source carries one entry equal to `_pvHistory`.
    //Empty map = aggregated only (single-source or pre-fetch boot window).
    _pvHistoryPerEntity:    Map<string, PvHistory>;
    //Hourly LTS series feeding the 5-day forecast calibration. Same times[]/values[] shape as `_pvHistory`, via
    //`recorder/statistics_during_period` period:'hour' over 5 days. Power sensors land as bucket means; cumulative-energy as
    //bucket-end `state`. ~120 rows, light on the recorder. Null when LTS unavailable (no `state_class`, LTS disabled);
    //calibration then degrades to the narrower `_pvHistory` window.
    _pvCalibStats:          PvHistory | null;
    _pvCalibStatsFetchKey:  string;
    _pvCalibStatsFetching:  boolean;
    //Recorder `change` series for the solar energy meter(s), 5-minute buckets. Canonical past-production source for the unified
    //store (timeline graphs) and chip scrub: the recorder returns reset-corrected, unit-normalised kWh per bucket, the same
    //metric the HA Energy dashboard consumes, so plotted production matches it without client-side differentiation. Null pre-fetch.
    _pvChangeSeries:         ChangeBucket[] | null;
    _pvChangeSeriesFetchKey: string;
    _pvChangeSeriesFetching: boolean;
    //Per-source recorder `change` series, keyed by the source's energy meter (`stat_energy_from`). Same reset-corrected,
    //unit-normalised 5-minute buckets as `_pvChangeSeries`, but split per HA Energy solar source so the Clock/Trend dial
    //shows each string with the exact dashboard energy (and recorded night production from non-solar sources fed in as PV),
    //instead of re-differentiating the lagging hourly LTS. Empty until the per-source fetch lands.
    _pvChangeSeriesPerEntity:    Map<string, ChangeBucket[]>;
    _pvChangePerEntityFetchKey:  string;
    _pvChangePerEntityFetching:  boolean;
}


//-----------------------------------------------------------------
//Module-level cache for the PV-side WS fetches. Survives Lit unmount+remount (navigating away and back), which the
//per-instance `_pv*FetchKey` gate cannot catch; without it every navigation restarted the heavy fetch from zero. Each entry
//carries the parsed series + fetched-at timestamp; TTL stops stale data drifting forever. Keyed by the same fetch key the
//refresh path computes, so an entity/range/SoC change invalidates naturally.

interface PvStatsCacheEntry
{
    stats:     PvHistory;
    //Per-source breakdown cached alongside the aggregate so a cache hit restores it too; otherwise the home
    //histogram + per-source curves keep a stale map after revisiting a period.
    perEntity: Map<string, PvHistory>;
    ts:        number;
}

const _pvCalibStatsCache   = new Map<string, PvStatsCacheEntry>();


function pvStatsCacheGet(cache: Map<string, PvStatsCacheEntry>, key: string): PvStatsCacheEntry | null
{
    const e = cache.get(key);
    if (!e)
    {
        return null;
    }
    if (Date.now() - e.ts > PV_CACHE_TTL_MS)
    {
        cache.delete(key);
        return null;
    }
    return e;
}


//Wipe the module-level PV caches. Called from the card's `resetDataCache()` so the editor "reset" drops the cross-mount memo;
//without it the next refresh short-circuits on a cache hit and re-populates what the user just asked to clear.
export function clearPvModuleCaches(): void
{
    _pvCalibStatsCache.clear();
}


//Live + history refresh, called every lifecycle cycle. Fast paths exit early when no entity is configured or the (entity, range)
//tuple matches the last successful fetch.
export function refreshPv(host: PvHost): void
{
    if (!host.hass) { return; }
    const entity = resolvePvLiveEntity(host._energyDefaults);
    const meters = host._energyDefaults.solarStatEnergyFroms;

    if (!entity && meters.length === 0)
    {
        //Nothing configured: clear so the chip and graph disappear instead of sticking with stale data.
        if (host._pvCurrent !== null || host._pvHistory !== null)
        {
            host._pvCurrent = null;
            host._pvHistory = null;
            host._pvUnit    = '';
        }
        return;
    }
    if (!entity && host._pvCurrent !== null)
    {
        //Live sensors unwired (measured-only: the chip has no live state); curves and scrub below keep
        //reading the recorder meters.
        host._pvCurrent = null;
        host._pvUnit    = '';
    }

    //Seed `_pvHistory` empty so the boot gate clears on entity resolution and the live-tail extension below appends without a
    //null guard. The chart pulls its past from `_pvCalibStats` LTS and the right-edge live tail from the pushes here.
    if (host._pvHistory === null)
    {
        host._pvHistory = { times: [], values: [] };
    }

    //Multi-source LIVE aggregation across the declared power sensors ONLY (measured-only: cumulative
    //meters never masquerade as live entities). A split E/W install with a stat_rate per source sees the
    //SUM of every sensor on chip, tooltip and headline.
    const liveEntities  = host._energyDefaults.solarStatRates;
    const isMultiEntity = liveEntities.length > 1;

    //Live state read, always cheap, runs on every Lit cycle. Skipped entirely without a power sensor.
    const stateObj = entity ? host.hass.states?.[entity] : undefined;
    if (stateObj)
    {
        let nextValue:    number | null = null;
        let nextUnit        = '';
        let liveTs        = 0;
        if (isMultiEntity)
        {
            //Sum raw values across every live entity, keeping the first valid sample's unit. Downstream classifies cumulative
            //vs measurement off `_pvUnit`, so a kWh-only install sums to kWh and buffer differentiation derives W, while a
            //stat_rate-on-every-source install sums to W and skips the buffer. Disagreeing per-source units are an HA config
            //error, so this trusts the single-unit assumption HA enforces per Energy block and skips per-sample normalisation.
            let sumValue  = 0;
            let firstUnit = '';
            let anyValid  = false;
            for (const id of liveEntities)
            {
                const so = host.hass.states?.[id];
                if (!so)
                {
                    continue;
                }
                const v = parseFloat(so.state);
                if (!isFinite(v))
                {
                    continue;
                }
                if (!firstUnit)
                {
                    firstUnit = String(so.attributes?.unit_of_measurement ?? '');
                }
                sumValue += v;
                anyValid = true;
                const ts = so.last_updated
                    ? new Date(so.last_updated).getTime()
                    : Date.now();
                if (ts > liveTs)
                {
                    liveTs = ts;
                }
            }
            if (anyValid)
            {
                nextValue = sumValue;
                nextUnit  = firstUnit;
            }
        }
        else
        {
            const v = parseFloat(stateObj.state);
            nextValue = isFinite(v) ? v : null;
            nextUnit  = stateObj.attributes?.unit_of_measurement ?? '';
            liveTs    = stateObj.last_updated
                ? new Date(stateObj.last_updated).getTime()
                : Date.now();
        }
        if (nextValue !== host._pvCurrent)
        {
            host._pvCurrent = nextValue;
        }
        if (nextUnit !== host._pvUnit)
        {
            host._pvUnit = nextUnit;
        }

        if (nextValue !== null)
        {
            const ts = liveTs || Date.now();
            //Extend `_pvHistory`'s tail with the live sample so the chart's right edge tracks live state between hourly
            //re-fetches. The fetch is keyed by (entity, fetch-range) with `range.end` pinned to the hourly weather grid, so
            //without this the curve flatlines at the last hour boundary while the chip keeps ticking. The next full fetch
            //replaces the array wholesale.
            //
            //In-place push, not spread: live state ticks frequently while the fetch key holds for an hour, so spreading would
            //reallocate and grow the arrays unbounded. Push mutates in place (Lit re-renders off the live state assignment
            //above, not `_pvHistory` identity); we trim entries that drift before `_timeRange.start`.
            const hist = host._pvHistory;
            if (hist)
            {
                const lastIdx = hist.times.length - 1;
                const lastTs  = lastIdx >= 0 ? hist.times[lastIdx].getTime() : 0;
                if (ts > lastTs && nextValue !== null)
                {
                    hist.times.push(new Date(ts));
                    hist.values.push(nextValue);
                    //Drop leading samples aged out of the visible window, guarding against unbounded growth on long sessions.
                    if (host._timeRange)
                    {
                        const rangeStartMs = host._timeRange.start.getTime();
                        let drop = 0;
                        while (drop < hist.times.length && hist.times[drop].getTime() < rangeStartMs)
                        {
                            drop++;
                        }
                        if (drop > 0)
                        {
                            hist.times.splice(0, drop);
                            hist.values.splice(0, drop);
                        }
                    }
                }
            }
        }
    }
    else
    if (host._pvCurrent !== null)
        {
            host._pvCurrent = null;
        }

    //Two fetches, gated independently so each reissues only when its (entity, window) tuple changes:
    //  1. Hourly LTS over 5 days, feeding the forecast calibration (`calibration.ts`).
    //  2. Recorder `change` series (5-min buckets) for the past-production curve, the same data the HA Energy dashboard consumes.
    //Both exit cheaply on later cycles because the fetch-key cache short-circuits identical-range re-fetches.
    if (!host._timeRange)
    {
        return;
    }
    const fetchEnd = host._timeRange.end;
    const today0   = new Date();
    today0.setHours(0, 0, 0, 0);

    //Shared entity set + fetch-key part for the calibration LTS: the power sensors when declared, else the
    //meters (recorded statistics of either are measured data; only LIVE reads are sensor-only).
    const calibEntities = liveEntities.length > 0 ? liveEntities : meters;
    const sortedLive   = [...calibEntities].sort();
    const fetchKeyPart = sortedLive.join(',');

    //The chart blends `_pvCalibStats` LTS for any portion `_pvHistory` does not cover; with `_pvHistory` empty the whole past
    //flows through LTS, and the right-edge live tail is pushed from `hass.states[entity]`.

    //Hourly LTS for calibration (5 days). Multi-source aggregation sums per source so the calibration ratio is learned against
    //the SUMMED predicted-vs-actual instead of first-entity-only.
    if (!host._pvCalibStatsFetching)
    {
        const calibStart = new Date(today0.getTime() - 5 * DAY_MS);
        const calibKey   = `${fetchKeyPart}@h|${calibStart.getTime()}|${fetchEnd.getTime()}`;
        if (calibKey !== host._pvCalibStatsFetchKey)
        {
            host._pvCalibStatsFetchKey = calibKey;
            const cachedCalib = pvStatsCacheGet(_pvCalibStatsCache, calibKey);
            if (cachedCalib)
            {
                host._pvCalibStats       = cachedCalib.stats;
                host._pvHistoryPerEntity = cachedCalib.perEntity;
            }
            else
            {
                //Cumulative flag from the SET being fetched (meters when no power sensor is declared), not
                //from the live unit: the aggregator must baseline lifetime counters.
                const isCumulative = liveEntities.length === 0;
                fetchPvStatistics(host, sortedLive, calibStart, fetchEnd, 'hour', calibKey, isCumulative);
            }
        }
    }

    //Past-production curve for the unified store + chip scrub. From the recorder `change` metric on the solar ENERGY meter(s)
    //(`stat_energy_from`), like the HA Energy dashboard: reset-corrected, unit-normalised kWh per 5-min bucket, divided by bucket
    //duration for average watts. No client-side differentiation, so coarse-reporting or daily-reset meters work natively.
    const changeIds = meters;
    if (changeIds.length > 0 && !host._pvChangeSeriesFetching)
    {
        //Span the full configured past window (period selector), not a fixed 2 days, else the older days of a
        //wide window (e.g. 7 d) come back empty.
        const seriesStart = new Date(today0.getTime() - host._periodPastDays * DAY_MS);
        const sortedChange = [...changeIds].sort();
        //The refresh anchor re-arms the gate once per CHANGE_REFRESH_MS. fetchEnd alone only moves on time-range shifts (weather
        //refresh, midnight rollover), too coarse: it froze the past curve and the cumulative-only chip fallback for hours.
        const changeKey    = `${sortedChange.join(',')}|${seriesStart.getTime()}|${fetchEnd.getTime()}|${changeRefreshAnchorMs()}`;
        if (changeKey !== host._pvChangeSeriesFetchKey)
        {
            host._pvChangeSeriesFetchKey = changeKey;
            host._pvChangeSeriesFetching = true;
            void fetchChangeSeries(host.hass, sortedChange, seriesStart.getTime(), fetchEnd.getTime(), host._storeFetchPeriod)
                .then((series) =>
                {
                    if (series !== null) { host._pvChangeSeries = series; }
                    host.requestUpdate();
                })
                .finally(() =>
                {
                    host._pvChangeSeriesFetching = false;
                });
        }

        //Per-source change series (one fetch per solar meter), so the Clock/Trend dial can split production by source
        //with the exact recorder energy instead of the lagging hourly LTS. Only worth it with 2+ sources; a single
        //source already reads the aggregate. Gated on the same key so it re-arms with the aggregate fetch.
        if (changeIds.length >= 2 && !host._pvChangePerEntityFetching && changeKey !== host._pvChangePerEntityFetchKey)
        {
            host._pvChangePerEntityFetchKey = changeKey;
            host._pvChangePerEntityFetching = true;
            const startMs = seriesStart.getTime();
            const endMs   = fetchEnd.getTime();
            const period  = host._storeFetchPeriod;
            void Promise.all(changeIds.map((meter) =>
                fetchChangeSeries(host.hass, [meter], startMs, endMs, period)
                    .then((series) => ({ meter, series }))))
                .then((results) =>
                {
                    const next = new Map<string, ChangeBucket[]>();
                    for (const { meter, series } of results)
                    {
                        if (series !== null) { next.set(meter, series); }
                    }
                    if (next.size > 0) { host._pvChangeSeriesPerEntity = next; }
                    host.requestUpdate();
                })
                .finally(() =>
                {
                    host._pvChangePerEntityFetching = false;
                });
        }
    }
}






//Last-known-carry-forward aggregator. Walks the union of all per-entity timestamps; at each tick reads each entity's most recent
//sample at or before the cursor, then sums. Cursor monotonicity (series sorted by time) makes this O(entities + timestamps).
//Works for both power sensors (instantaneous) and cumulative kWh.
//
//`cumulative` enables per-entity baselining: each entity is baselined at its first observed value in the window before summing.
//Without it, an entity coming online mid-window with a large lifetime total injects a phantom cumulative jump that today-kWh
//integration attributes to "today". Baselined, each entity contributes 0 at first appearance and only its delta from there.
//Power sensors MUST use `cumulative: false`: baselining a W reading yields meaningless "delta-W".
function aggregatePvHistoriesLkcf(perEntity: PvHistory[], cumulative = false): PvHistory
{
    if (perEntity.length === 0)
    {
        return { times: [], values: [] };
    }
    if (perEntity.length === 1)
    {
        return perEntity[0];
    }
    //Union of all timestamps, sorted ascending. Set+sort beats merge-of-sorted at high sample counts, and the Set dedupes
    //coincident timestamps.
    const tsSet = new Set<number>();
    for (const h of perEntity)
    {
        for (const t of h.times)
        {
            tsSet.add(t.getTime());
        }
    }
    const sortedTs = Array.from(tsSet).sort((a, b) => a - b);
    const cursors   = new Array<number>(perEntity.length).fill(-1); //one walking index per entity, advances monotonically
    //Per-entity baseline captured at first observed value when `cumulative` is on. null = entity has not yet contributed.
    const baselines = cumulative ? new Array<number | null>(perEntity.length).fill(null) : null;
    const summed:   number[] = [];
    for (const ts of sortedTs)
    {
        let sum = 0;
        for (let i = 0; i < perEntity.length; i++)
        {
            const series = perEntity[i];
            //Advance cursor while the next sample is at or before the cursor timestamp.
            let cursor = cursors[i];
            while (cursor + 1 < series.times.length && series.times[cursor + 1].getTime() <= ts)
            {
                cursor++;
            }
            cursors[i] = cursor;
            if (cursor >= 0 && isFinite(series.values[cursor]))
            {
                if (baselines)
                {
                    if (baselines[i] === null)
                    {
                        baselines[i] = series.values[cursor];
                    }
                    sum += series.values[cursor] - baselines[i]!;
                }
                else
                {
                    sum += series.values[cursor];
                }
            }
        }
        summed.push(sum);
    }
    return {
        times:  sortedTs.map(t => new Date(t)),
        values: summed,
    };
}




//Pull an LTS series from HA's `recorder/statistics_during_period` WS command. Trades raw resolution for a ~100x smaller payload,
//keeping the recorder responsive on installs reporting several samples per second. Populates `host._pvCalibStats` for the 5-day
//forecast calibration.
//
//Field selection by unit: power sensors carry the bucket mean; cumulative-energy (Wh/kWh/MWh) carry their reading in `state`. We
//request BOTH columns and let the parser prefer `mean`, falling back to `state`. Asking for both avoids a silent failure: when
//the unit hasn't yet propagated to `host._pvUnit` (cold start before the first hass.states tick), a mean-only request would
//return all-null buckets for a cumulative entity and leave the slot empty.
//
//Anchoring: both flavours anchor at the bucket midpoint to match the power-sensor convention and the trapezoidal integration in
//`calibration.ts`; cross-day attribution drift is absorbed by `actualKwhForDay`'s guard widening. Buckets with both null dropped.
//
//LTS requires the entity to carry a `state_class`. Untracked entities return an empty array, surfaced as an empty `PvHistory` so
//the consumer falls back to `_pvHistory`.
export async function fetchPvStatistics(
    host: PvHost,
    entityIds: string[],
    start: Date,
    end: Date,
    period: '5minute' | 'hour' | 'day' | 'week' | 'month',
    cacheKey = '',
    //Same `cumulative` flag as the aggregator: cumulative entities populate `state` with the bucket-end lifetime value, so the
    //multi-source phantom-jump risk applies. Power entities populate `mean` and stay on the raw-sum path.
    cumulative = false,
): Promise<void>
{
    if (!host.hass?.callWS || entityIds.length === 0)
    {
        return;
    }

    const fetchingFlag    = '_pvCalibStatsFetching' as const;
    const targetSlot      = '_pvCalibStats' as const;
    const cache           = _pvCalibStatsCache;

    host[fetchingFlag] = true;
    try
    {
        //History only exists up to "now". Clamp the fetch end so we don't ask HA for empty future buckets.
        const now = new Date();
        const fetchEnd = end > now ? now : end;
        if (start >= fetchEnd)
        {
            host[targetSlot] = { times: [], values: [] };
            return;
        }

        const result: any = await callWSWithTimeout<any>(host.hass, {
            type:           'recorder/statistics_during_period',
            start_time:     start.toISOString(),
            end_time:       fetchEnd.toISOString(),
            statistic_ids:  entityIds,
            period,
            //Request both: power sensors populate `mean`, cumulative-energy populate `state`. One round-trip covers both wirings
            //without depending on the user-facing unit having reached `host._pvUnit`.
            types:          ['mean', 'state'],
            //Normalise to kWh/W so installs reporting in Wh/MWh/kW land on the scale calibration + chart expect.
            units:          { energy: 'kWh', power: 'W' },
        });

        //Per-entity bucket parse, then LKCF aggregation over the union of bucket midpoints. Same-period entities usually align,
        //collapsing the walker to a clean per-bucket sum; misaligned series carry forward.
        const perEntity: PvHistory[] = [];
        for (const id of entityIds)
        {
            const arr: any[] = (result && result[id]) ?? [];
            const times:  Date[]   = [];
            const values: number[] = [];
            for (const item of arr)
            {
                const startRaw = item?.start;
                const endRaw   = item?.end;
                const startMs  = parseStatBoundary(startRaw);
                const endMs    = parseStatBoundary(endRaw);
                if (startMs === null)
                {
                    continue;
                }
                let valueRaw: unknown = item?.mean;
                if (valueRaw === null || valueRaw === undefined)
                {
                    valueRaw = item?.state;
                }
                if (valueRaw === null || valueRaw === undefined)
                {
                    continue;
                }
                const v = typeof valueRaw === 'number' ? valueRaw : parseFloat(String(valueRaw));
                if (!isFinite(v))
                {
                    continue;
                }
                //Bucket midpoint anchor for both flavours, aligning with the trapezoidal integration in `calibration.ts`.
                const anchorMs = endMs !== null ? (startMs + endMs) / 2 : startMs;
                times.push(new Date(anchorMs));
                values.push(v);
            }
            perEntity.push({ times, values });
        }

        //Expose the per-source breakdown (keyed by entity id) for the per-source chart curves, the scrub tooltip rows, and the
        //home histogram. Same native-unit shape as the aggregate; consumers handle the cumulative-to-power differentiation.
        const perMap = new Map<string, PvHistory>();
        for (let i = 0; i < entityIds.length; i++)
        {
            perMap.set(entityIds[i], perEntity[i]);
        }
        host._pvHistoryPerEntity = perMap;

        const stats: PvHistory = aggregatePvHistoriesLkcf(perEntity, cumulative);
        host[targetSlot] = stats;
        if (cacheKey)
        {
            cache.set(cacheKey, { stats, perEntity: perMap, ts: Date.now() });
        }
    }
    catch (_e)
    {
        //Fetch timed out, LTS endpoint missing, or entity not tracked: surface an empty series so the consumer degrades to raw _pvHistory.
        host[targetSlot] = { times: [], values: [] };
    }
    finally
    {
        host[fetchingFlag] = false;
    }
}


//Coerce a stats-bucket `start`/`end` into a millisecond epoch. Accepts ISO strings, numeric seconds and numeric milliseconds
//(HA's payload shape has changed across releases). Returns null on anything unparseable.
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


//Production rate at an arbitrary historical time (timeline scrubbed into the past). Reads average power from the recorder
//`change` series (5-min buckets): resets + unit conversion already handled, so it's a single bucket lookup, no differentiation.
//Returns null when no bucket covers the instant (future scrub or recorder gap), hiding the chip. Watts floored at zero so a
//net-meter quirk never surfaces as negative production.
export function pvRateAtTime(host: PvHost, time: Date): PvRate | null
{
    const w = wattsAtFromChangeSeries(host._pvChangeSeries, time.getTime());
    if (w === null)
    {
        return null;
    }
    return { value: Math.max(0, w), unit: 'W' };
}


//Live "now" PV rate: measured or absent. With power sensors (`stat_rate`), read their states directly,
//summed across every wired source, like the HA Energy live tile. Without one, return null so the chip
//hides (and the editor explains what to configure): a live value is never derived from the cumulative
//meters. Past curves and scrub keep reading the recorder series regardless.
export function currentPvRate(host: PvHost): PvRate | null
{
    const rates = host._energyDefaults.solarStatRates;
    if (rates.length === 0) { return null; }
    let sumW = 0;
    let any  = false;
    for (const id of rates)
    {
        const so = host.hass?.states?.[id];
        if (!so) { continue; }
        const v = parseFloat(so.state);
        if (!isFinite(v)) { continue; }
        sumW += pvNormalizeToWatts(v, String(so.attributes?.unit_of_measurement ?? ''));
        any   = true;
    }
    if (!any) { return null; }
    return { value: Math.max(0, sumW), unit: 'W' };
}







//Format a PV reading for the chip below the home. Power prints in the card's configured unit (W or kW); energy keeps
//its native unit. Thin wrapper over the shared formatter.
export function formatPvValue(hass: any, value: number, unit: string, decimals: number, powerU: PowerUnit = 'kW'): string
{
    return formatEntityValue(hass, value, unit, decimals, powerU);
}
