//Photovoltaic data subsystem: live state polling, history fetch, rolling-buffer sampling, instantaneous-rate derivation, calibration helpers, and the
//chip / chart value formatter.
//
//The functions in here operate against a "host" object (the card)
//that owns the `@state` PV fields. Lit reactivity is preserved by
//writing back to the same setters the card declares, so calling
//refreshPv(this) from a card lifecycle hook still triggers a
//re-render exactly as the inline version did.

import type { HeliosConfig } from '../helios-config';
import type { EnergyDefaults } from './energy-prefs';
import { formatLocalisedNumber, formatPowerKw, formatEnergyKwh, energyToKwh } from './format';
import { callWSWithTimeout, WsTimeoutError } from './ws-timeout';
import { beginLoadingPhase, endLoadingPhase, type LoadingTrackerHost } from './loading-tracker';
import { fetchChangeSeries, latestWattsFromChangeSeries, wattsAtFromChangeSeries, changeRefreshAnchorMs, type ChangeBucket } from './energy-stats';


//Resolve the live PV entity from the HA Energy dashboard solar source. Prefers the optional `stat_rate` (signed W or kW)
//over the cumulative `stat_energy_from` (kWh) so the chart and chip plot the live power directly instead of going
//through the trapezoidal differentiation path that reads as flat-topped plateaus on sparse meters. Returns an empty
//string when no solar source is configured, the caller treats that as "chip + chart hidden". Multi-source installs
//collapse to the first entry today; full per-source aggregation across all solar sources lands in a follow-up.
export function resolvePvLiveEntity(defaults: EnergyDefaults): string
{
    if (defaults.solarStatRates.length > 0)
    {
        return defaults.solarStatRates[0];
    }
    if (defaults.solarStatEnergyFroms.length > 0)
    {
        return defaults.solarStatEnergyFroms[0];
    }
    return '';
}




//Fetched historical series, parallel times[] / values[] arrays so a binary or linear search can locate a sample by timestamp without re-allocating
//wrapper objects.
export interface PvHistory
{
    times:  Date[];
    values: number[];
}

//Result of a rate computation. `unit` matches what the user's PV
//chip should print after the value (W / kW / MW / "<unit>/h").
export interface PvRate
{
    value: number;
    unit:  string;
}

//Structural surface the host card exposes to this module. The
//mutable `_pv*` fields are typed non-readonly so the refresh / fetch
//helpers can assign them; Lit's @state reactivity is preserved
//because the assignment hits the same setter the decorator installed.
export interface PvHost extends LoadingTrackerHost
{
    readonly config:     HeliosConfig | undefined;
    readonly hass:       any;
    readonly _timeRange: { start: Date; end: Date } | null;
    readonly _energyDefaults: import('./energy-prefs').EnergyDefaults;

    _pvCurrent:             number | null;
    _pvUnit:                string;
    _pvHistory:             PvHistory | null;
    //Per-entity histories preserved alongside the aggregated `_pvHistory` so the chart can render one curve per
    //source (LBDG_'s feature request) and the scrub tooltip can show a per-entity breakdown next to the summed
    //value. The map is keyed by entity id; on single-source installs it carries a single entry that equals
    //`_pvHistory`. Empty map = aggregated only (single-source or pre-fetch boot window).
    _pvHistoryPerEntity:    Map<string, PvHistory>;
    _pvFetchKey:            string;
    _pvFetching:            boolean;
    _pvHistoryDiagnostics:  { rawEntries: number; samples: number; windowH: number } | null;
    //Hourly long-term-statistics series feeding the 5-day forecast calibration. Same parallel times[] / values[] shape as `_pvHistory`,
    //populated via `recorder/statistics_during_period` with `period: 'hour'` over the past 5 days. Power sensors land here as bucket
    //means; cumulative-energy sensors land as the bucket-end `state` field. Carries roughly 120 rows, an order of magnitude lighter
    //recorder load than the raw history path on a high-frequency BMS. Null when statistics are unavailable (entity has no
    //`state_class`, LTS disabled), the calibration then degrades to the narrower `_pvHistory` window.
    _pvCalibStats:          PvHistory | null;
    _pvCalibStatsFetchKey:  string;
    _pvCalibStatsFetching:  boolean;
    //Recorder `change` series for the solar energy meter(s), 5-minute buckets over the store's past
    //window. This is the canonical past-production source for the unified store (timeline + dashboard
    //graph) and the chip scrub: the recorder hands back reset-corrected, unit-normalised kWh per
    //bucket, the same metric the HA Energy dashboard consumes, so the plotted production matches HA to
    //the watt-hour without any client-side counter differentiation. Null until the first fetch lands.
    _pvChangeSeries:         ChangeBucket[] | null;
    _pvChangeSeriesFetchKey: string;
    _pvChangeSeriesFetching: boolean;
}


//-----------------------------------------------------------------
//Module-level cache for the three PV-side WS fetches. Survives Lit
//element unmount + remount (the user navigating away from the card
//and back), which is the lifecycle event that the per-instance
//`_pv*FetchKey` gate cannot catch. Without this, every navigation
//restarted the heavy fetch from zero
//
//Each entry carries the parsed series + the fetched-at timestamp.
//TTL keeps stale data from drifting forever, the next refresh
//cycle after expiry falls back to a fresh fetch. Keyed by the same
//fetch key the refresh path computes, so an entity / range / SoC
//bank change naturally invalidates without an explicit clear.

const PV_CACHE_TTL_MS = 15 * 60_000;

interface PvHistoryCacheEntry
{
    history:          PvHistory;
    //Per-entity snapshots preserved in the cache so a cross-mount cache hit also primes the per-entity curves on the
    //chart without a fresh round-trip. Stored as a plain object map for JSON-friendliness; the Map ↔ object coercion
    //lives at the cache-set / cache-get boundary.
    historyPerEntity: Record<string, PvHistory>;
    batteryHistory:   PvHistory | null;
    diagnostics:      { rawEntries: number; samples: number; windowH: number };
    ts:               number;
}

interface PvStatsCacheEntry
{
    stats: PvHistory;
    ts:    number;
}

const _pvHistoryCache:        Map<string, PvHistoryCacheEntry> = new Map();
const _pvCalibStatsCache:     Map<string, PvStatsCacheEntry>   = new Map();


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


//Wipe the module-level PV caches. Called from the card's `resetDataCache()` hook so the editor's "reset" button actually drops the
//cross-mount memo. Without this call the next refresh would short-circuit on a cache hit and re-populate the slot with the exact data
//the user just asked to clear.
export function clearPvModuleCaches(): void
{
    _pvHistoryCache.clear();
    _pvCalibStatsCache.clear();
}


//Live + history refresh, called from the card on every lifecycle
//cycle. Cheap fast paths exit early when no entity is configured or
//when the (entity, range) tuple matches the last successful fetch.
export function refreshPv(host: PvHost): void
{
    const entity = resolvePvLiveEntity(host._energyDefaults);

    if (!entity || !host.hass)
    {
        //Reset everything when the user clears the entity field so the chip and graph immediately disappear instead of sticking around with stale
        //data.
        if (host._pvCurrent !== null || host._pvHistory !== null)
        {
            host._pvCurrent = null;
            host._pvHistory = null;
            host._pvUnit    = '';
        }
        host._pvFetchKey = '';
        return;
    }

    //Seed `_pvHistory` as an empty pair so the boot gate clears immediately on entity resolution
    //and the live tail extension below can append without a null guard each cycle. The chart
    //pulls its past portion from `_pvCalibStats` LTS and the right-edge
    //live tail from the `hass.states[entity]` pushes appended here.
    if (host._pvHistory === null)
    {
        host._pvHistory = { times: [], values: [] };
    }

    //Multi-source LIVE aggregation. A user with a split E/W install (or any other multi-string install with one
    //solar source per string in HA Energy) sees the SUM of every wired stat_rate / stat_energy_from sensor on the
    //chip, the tooltip, the dashboard headline, instead of just the first entry the previous resolver returned. The
    //history fetch + scrub-past path stays single-entity for now (uses `entity` resolved above) until the recorder
    //+ interpolation refactor that turns `_pvHistory` into a summed series lands.
    const liveEntities = host._energyDefaults.solarStatRates.length > 0
        ? host._energyDefaults.solarStatRates
        : host._energyDefaults.solarStatEnergyFroms;
    const isMultiEntity = liveEntities.length > 1;

    //Live state read, always cheap, runs on every Lit cycle.
    const stateObj = host.hass.states?.[entity];
    if (stateObj)
    {
        let nextValue:    number | null = null;
        let nextUnit:     string        = '';
        let liveTs:       number        = 0;
        if (isMultiEntity)
        {
            //Sum the raw value across every configured live entity and keep the unit of the first valid sample. The
            //downstream consumer (currentPvRate / pvRateAtTime) classifies cumulative vs measurement off `_pvUnit` so
            //a kWh-only HA Energy install (4 stat_energy_from sources, no stat_rate) lands as a summed kWh stream and
            //the buffer differentiation derives total W exactly as it does for a single source; a stat_rate-on-every-
            //source install lands as a summed W stream and the chip skips the buffer path. The unit is taken from the
            //first valid entity; multi-source installs where the per-source units disagree are an HA config error
            //(one source in W, another in kW would mis-sum), so this path trusts the single-unit assumption a single
            //HA Energy block enforces and skips the per-sample normalisation helper.
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
            //Extend `_pvHistory`'s tail with the live sample so the chart's right edge tracks the live state between hourly history
            //re-fetches. The history fetch is keyed by (entity, fetch-range) and `range.end` is pinned to the hourly weather grid,
            //so without this the plotted PV curve flatlines at the value captured at the last hour boundary even while the chip
            //keeps ticking. The next full fetch (when the hour rolls over) replaces the array wholesale.
            //
            //In-place push instead of spread: with the live state ticking up to ~50 times per second and the fetch key sitting
            //stable for an hour at a time, the previous spread-then-reassign reallocated `times` and `values` on every tick
            //and the arrays grew unbounded. Push mutates the existing arrays (Lit re-renders are driven by the live state
            //assignment above, not by `_pvHistory` identity), and we trim entries that drift before `_timeRange.start` so the
            //tail does not balloon past the visible window.
            const hist = host._pvHistory;
            if (hist)
            {
                const lastIdx = hist.times.length - 1;
                const lastTs  = lastIdx >= 0 ? hist.times[lastIdx].getTime() : 0;
                if (ts > lastTs && nextValue !== null)
                {
                    hist.times.push(new Date(ts));
                    hist.values.push(nextValue);
                    //Drop the leading samples that have aged out of the chart's visible window. Guards the array against
                    //unbounded growth on long-uptime sessions where the fetch key stays stable for many hours.
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
    {
        if (host._pvCurrent !== null)
        {
            host._pvCurrent = null;
        }
    }

    //Two fetches, gated independently so each reissues only when its (entity, window) tuple changes:
    //  1. Hourly long-term statistics over 5 days, feeding the 5-day forecast calibration (`calibration.ts`).
    //  2. The recorder `change` series (5-minute buckets) for the past-production curve, the same data the HA
    //     Energy dashboard consumes.
    //Both exit cheaply on subsequent Lit cycles (clock ticks, hass updates) because the fetch-key cache
    //short-circuits identical-range re-fetches.
    if (!host._timeRange)
    {
        return;
    }
    const fetchEnd = host._timeRange.end;
    const HOUR_MS  = 3_600_000;
    const today0   = new Date();
    today0.setHours(0, 0, 0, 0);

    //Raw history, narrow window. Capped at the last RAW_WINDOW_H
    //hours regardless of how wide the user's visible timeline is.
    //The HA recorder is single-threaded behind SQLite, so a multi-
    //day raw fetch on a 1 Hz inverter (Victron Cerbo and friends)
    //blocks every other card reading the same entity for the
    //duration of the fetch, on every card load. The chart already
    //has access to the `_pvCalibStats` LTS slot (hour resolution over
    //5 days), which carries the past portion of the visible timeline
    //orders of magnitude faster than a raw scan.
    //Hoisted out of the LTS fetch blocks below so the calibration path see the same entity set for
    //their cache keys. A drift between the keys would re-fetch one path on every refresh, defeating the hourly /
    //5-min cadence guarantees.
    const sortedLive   = [...liveEntities].sort();
    const fetchKeyPart = sortedLive.length > 0 ? sortedLive.join(',') : entity;

    //Raw `history/history_during_period` fetch removed. The card is now wired to the HA Energy dashboard end-to-end
    //(daily totals via recorder `change`, headlines via `_haSolarTodayKwh`, calibration via `_pvCalibStats`,
    //forecast calibration, and the live chip via `hass.states[entity]` direct read), so the
    //raw 6 h scan that was kept around to feed the chart tail + scrub past at 1 Hz precision is no longer load-
    //bearing for any single feature. It was also the single heaviest WS round-trip the card fired (4-source 1 Hz
    //Victron install = ~5-10 MB payload, single-threaded SQLite recorder scan on every card mount). The chart
    //rendering already blends `_pvCalibStats` for any portion `_pvHistory` does not cover; with `_pvHistory` empty
    //the whole past portion of the curve flows through LTS. The right-edge live tail is still extended via the
    //`hass.states[entity]` push appended directly to `_pvHistory.times` / `.values` higher up in this function,
    //so the curve still tracks the live state at the cadence HA fires state_changed events.

    //Hourly LTS for calibration (5 days). Multi-source aggregation matches the raw-history path so the calibration
    //ratio is learned against the SUMMED predicted-vs-actual instead of the first-entity-only fraction.
    if (!host._pvCalibStatsFetching)
    {
        const calibStart = new Date(today0.getTime() - 5 * 24 * HOUR_MS);
        const calibKey   = `${fetchKeyPart}@h|${calibStart.getTime()}|${fetchEnd.getTime()}`;
        if (calibKey !== host._pvCalibStatsFetchKey)
        {
            host._pvCalibStatsFetchKey = calibKey;
            const cachedCalib = pvStatsCacheGet(_pvCalibStatsCache, calibKey);
            if (cachedCalib)
            {
                host._pvCalibStats = cachedCalib.stats;
            }
            else
            {
                const calibIds     = sortedLive.length > 0 ? sortedLive : [entity];
                const unitLow      = (host._pvUnit || '').toLowerCase();
                const isCumulative = unitLow === 'wh' || unitLow === 'kwh' || unitLow === 'mwh';
                fetchPvStatistics(host, calibIds, calibStart, fetchEnd, 'hour', calibKey, isCumulative);
            }
        }
    }

    //Past-production curve for the unified store (timeline + dashboard graph) + the chip scrub. Sourced
    //from the recorder `change` metric on the solar ENERGY meter(s) (`stat_energy_from`), exactly like
    //the HA Energy dashboard: the recorder returns reset-corrected, unit-normalised kWh per 5-minute
    //bucket and the store divides by the bucket duration to get average watts. No client-side counter
    //differentiation, so a 15-minute SolarEdge counter or a daily-reset meter is handled natively by
    //the recorder instead of producing a flat-zero curve or a midnight spike.
    const changeIds = host._energyDefaults.solarStatEnergyFroms;
    if (changeIds.length > 0 && !host._pvChangeSeriesFetching)
    {
        const seriesStart = new Date(today0.getTime() - 2 * 24 * HOUR_MS);
        const sortedChange = [...changeIds].sort();
        //The refresh anchor re-arms the gate once per CHANGE_REFRESH_MS. fetchEnd alone (timeline
        //range end) only moves when the engine shifts the time range (a weather refresh landing,
        //the midnight rollover), far too coarse on its own: it froze the past curve and the
        //cumulative-only live-chip fallback at mount-time data for hours.
        const changeKey    = `${sortedChange.join(',')}|${seriesStart.getTime()}|${fetchEnd.getTime()}|${changeRefreshAnchorMs()}`;
        if (changeKey !== host._pvChangeSeriesFetchKey)
        {
            host._pvChangeSeriesFetchKey = changeKey;
            host._pvChangeSeriesFetching = true;
            beginLoadingPhase(host, 'pv-change-series');
            void fetchChangeSeries(host.hass, sortedChange, seriesStart.getTime(), fetchEnd.getTime(), '5minute')
                .then((series) =>
                {
                    if (series !== null) { host._pvChangeSeries = series; }
                    host.requestUpdate();
                })
                .finally(() =>
                {
                    host._pvChangeSeriesFetching = false;
                    endLoadingPhase(host, 'pv-change-series');
                });
        }
    }
}







//Last-known-carry-forward aggregator. Walks the union of all per-entity timestamps and at each tick reads each
//entity's most recent sample at or before the cursor, then sums. The cursor monotonicity (every series is sorted by
//time) makes the walk O((entities + timestamps) total) instead of O(entities * timestamps). Works equally well for
//power sensors (instantaneous reading at each tick) and cumulative kWh sensors.
//
//`cumulative` flag enables per-entity baselining: each entity is baselined at its first observed value within the
//window before its contribution is summed. Without this, a multi-source install where one entity comes online
//mid-window (e.g., a Victron MPPT that boots up at 13:00 with a lifetime cumulative of 1000 kWh) would inject a
//phantom 1000 kWh jump into the aggregated series at 13:00, and the dashboard's today-kWh integration would
//attribute that whole jump to "today's production starting at 13:00". With baselining each entity contributes 0 at
//its first appearance and only its delta-since-arrival from there, so the aggregated curve grows smoothly. Power
//sensors must use `cumulative: false` because baselining a W reading turns it into "delta-W since the first sample",
//which is meaningless.
function aggregatePvHistoriesLkcf(perEntity: PvHistory[], cumulative: boolean = false): PvHistory
{
    if (perEntity.length === 0)
    {
        return { times: [], values: [] };
    }
    if (perEntity.length === 1)
    {
        return perEntity[0];
    }
    //Union of all timestamps, sorted ascending. Set + sort beats a merge-of-sorted because the entity histories can
    //carry tens of thousands of samples each on 1 Hz sensors and the explicit Set dedupes coincident timestamps.
    const tsSet = new Set<number>();
    for (const h of perEntity)
    {
        for (const t of h.times)
        {
            tsSet.add(t.getTime());
        }
    }
    const sortedTs = Array.from(tsSet).sort((a, b) => a - b);
    //One walking index per entity; advances monotonically through the sorted timestamps.
    const cursors   = new Array<number>(perEntity.length).fill(-1);
    //Per-entity baseline captured at the first observed value when `cumulative` mode is on. `null` means the
    //entity has not yet contributed a sample within the window.
    const baselines = cumulative ? new Array<number | null>(perEntity.length).fill(null) : null;
    const summed:   number[] = [];
    for (const ts of sortedTs)
    {
        let sum = 0;
        for (let i = 0; i < perEntity.length; i++)
        {
            const h = perEntity[i];
            //Advance cursor while the next sample is at or before the cursor timestamp.
            let c = cursors[i];
            while (c + 1 < h.times.length && h.times[c + 1].getTime() <= ts)
            {
                c++;
            }
            cursors[i] = c;
            if (c >= 0 && isFinite(h.values[c]))
            {
                if (baselines)
                {
                    if (baselines[i] === null)
                    {
                        baselines[i] = h.values[c];
                    }
                    sum += h.values[c] - baselines[i]!;
                }
                else
                {
                    sum += h.values[c];
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




//Pull a long-term-statistics series from HA's `recorder/statistics_during_period` WebSocket command. Trades raw resolution for a two-orders-of-
//magnitude reduction in payload size, which keeps the recorder responsive on installs whose PV entity reports several samples per second (Victron
//Cerbo and friends).
//
//Populates `host._pvCalibStats` for the 5-day forecast calibration.
//
//Field selection depends on the entity unit. Power sensors carry the bucket mean. Cumulative-energy sensors (`Wh` / `kWh` / `MWh`) carry
//their cumulative reading in the bucket `state` field. We ask for BOTH columns in the WS payload and let the parser prefer `mean` when
//it is populated, with `state` as fallback. Asking for both removes a class of silent failures: when the entity unit hasn't yet propagated
//to `host._pvUnit` at the time the fetch fires (cold start before the live hass.states tick lands), the heuristic would have asked for
//`mean` only and a cumulative-energy entity would have returned all-null buckets, leaving the slot empty.
//
//Anchoring: cumulative samples (taken from `state`) anchor at the bucket midpoint to match the power-sensor convention. The slight
//attribution drift across the day boundary is absorbed by `calibration.ts:actualKwhForDay`'s guard widening.
//Power samples (taken from `mean`) anchor at the bucket midpoint so the trapezoidal integration in `calibration.ts` matches the
//existing semantics. Buckets with both `mean` AND `state` null are dropped silently.
//
//Long-term statistics require the source entity to carry a `state_class` (`measurement`, `total`, or `total_increasing`) so HA tracks it. When the
//entity is not LTS-tracked HA returns an empty array; we surface that as an empty `PvHistory` and let the consumer fall back to `_pvHistory`.
export async function fetchPvStatistics(
    host: PvHost,
    entityIds: string[],
    start: Date,
    end: Date,
    period: '5minute' | 'hour' | 'day' | 'week' | 'month',
    cacheKey: string = '',
    //Same `cumulative` flag as fetchPvHistory. For LTS this matters because cumulative entities populate the `state`
    //field with the bucket-end lifetime value, which mirrors the multi-source phantom-jump risk if one source comes
    //online mid-window. Power entities populate `mean` directly and stay on the raw-sum path.
    cumulative: boolean = false,
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
            //Request both `mean` and `state`. Power sensors populate `mean`, cumulative-energy sensors populate `state`. The parser
            //below prefers `mean` and falls back to `state`, so a single round-trip covers both wirings without depending on the
            //user-facing unit having reached `host._pvUnit` yet.
            types:          ['mean', 'state'],
            //Normalise to kWh / W so installs reporting in Wh, MWh or kW land on the same scale the calibration + chart
            //expect. The `pvNormalizeToWatts` helper still handles the live state read where this hint is unavailable.
            units:          { energy: 'kWh', power: 'W' },
        });

        //Per-entity bucket parse, then LKCF aggregation over the union of bucket midpoints. LTS buckets typically
        //align across same-period entities (every entity has a 14:00 hour bucket etc.), in which case the LKCF
        //walker collapses to a clean per-bucket sum; on misaligned series the carry-forward keeps the per-source
        //contribution stable across gaps.
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
                //Bucket midpoint anchor for both flavours. Aligns with the trapezoidal integration in `calibration.ts` and
                //the forecast learning. Mid-bucket attribution averages out across the day boundary for cumulative sensors when the
                //calibration's cross-day guard tolerates the trailing slice.
                const anchorMs = endMs !== null ? (startMs + endMs) / 2 : startMs;
                times.push(new Date(anchorMs));
                values.push(v);
            }
            perEntity.push({ times, values });
        }

        const stats: PvHistory = aggregatePvHistoriesLkcf(perEntity, cumulative);
        host[targetSlot] = stats;
        if (cacheKey)
        {
            cache.set(cacheKey, { stats, ts: Date.now() });
        }
    }
    catch (e)
    {
        if (e instanceof WsTimeoutError)
        {
            console.warn(`[HELIOS] PV calib statistics fetch timed out (${e.timeoutMs} ms), consumer degrades to raw _pvHistory.`);
        }
        else
        {
            //LTS endpoint missing or entity not tracked. Surface an empty series so the consumer can degrade to `_pvHistory`.
            console.warn('[HELIOS] PV calib statistics fetch failed:', e);
        }
        host[targetSlot] = { times: [], values: [] };
    }
    finally
    {
        host[fetchingFlag] = false;
    }
}


//Coerce a `start` / `end` field from a statistics bucket into a millisecond epoch. Accepts ISO strings, numeric seconds, and numeric milliseconds
//since HA's payload shape has changed between releases. Returns null on anything unparseable.
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


//Locate the slot that brackets a scrub timestamp. Priority order:
//  1. `_pvHistory` raw (~2 days, finest resolution)
//  2. `_pvCalibStats` hourly (5 days), populated right after card mount and not deferred to idle
//
//Compute the production rate at an arbitrary historical time
//(used when the user scrubs the timeline into the past). For
//a cumulative entity we differentiate the two history samples
//bracketing the requested instant; for a power entity we just
//return the value of the closest historical sample. Returns
//null when the requested time falls outside every fetched
//history window, the chip is then hidden by the caller, which
//is the right behaviour for the future half of the timeline
//(no production data exists there yet).
export function pvRateAtTime(host: PvHost, time: Date): PvRate | null
{
    //Read the average power at the scrub instant from the recorder `change` series (5-minute
    //buckets). The recorder already handled resets + unit conversion, so this is a single bucket
    //lookup, no differentiation, no classification. Returns null when no bucket covers the instant
    //(future scrub, or a gap in the recorder data), which hides the chip there, the right behaviour
    //for the future half of the timeline. Watts are floored at zero so a net-meter quirk never
    //surfaces as negative production.
    const w = wattsAtFromChangeSeries(host._pvChangeSeries, time.getTime());
    if (w === null)
    {
        return null;
    }
    return { value: Math.max(0, w), unit: 'W' };
}


//Compute the live "now" PV production rate, sourced exactly like the HA Energy live tile:
//
//  - When the solar source declares a power sensor (`stat_rate`), read its state directly, summed
//    across every wired stat_rate for a split install. This is the real-time value HA itself shows.
//  - Otherwise (cumulative-only install, e.g. SolarEdge with no power sensor) fall back to the
//    average power of the latest completed 5-minute recorder `change` bucket. HA shows no live power
//    at all in this case; the 5-minute average is the closest HA-consistent live read available, and
//    it fixes the old "stuck at 0 W" failure where a 15-minute counter never filled the rolling
//    buffer's 5-minute window.
//
//Returns null when neither source yields a value (no power sensor and no change series yet), so the
//caller hides the chip rather than ever printing the lifetime cumulative total.
export function currentPvRate(host: PvHost): PvRate | null
{
    const rates = host._energyDefaults.solarStatRates;
    if (rates.length > 0)
    {
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
        if (any) { return { value: Math.max(0, sumW), unit: 'W' }; }
    }

    const w = latestWattsFromChangeSeries(host._pvChangeSeries, Date.now());
    if (w === null) { return null; }
    return { value: Math.max(0, w), unit: 'W' };
}


//Convert a POWER RATE into watts. Used to drive animation speeds on a unit-agnostic scale, the leader-line dash flow saturates at a fixed wattage no
//matter what unit the user's sensor is in.
//
//Contract: the `value` argument MUST already be an instantaneous power rate (W / kW / MW). Cumulative-energy sensors (Wh / kWh / MWh)
//are caller-side differentiated into a power rate FIRST via pvRateAtTime / currentPvRate before reaching this helper. Passing a raw
//cumulative-energy reading here returns 0 (which pauses any animation that depends on it, instead of silently mis-scaling a kWh
//figure as if it were already in watts), the explicit no-op is meant as a wiring trap for future callers.
export function pvNormalizeToWatts(value: number, unit: string): number
{
    const lu = (unit || '').toLowerCase();
    if (lu === 'kw')
    {
        return value * 1000;
    }
    if (lu === 'mw')
    {
        return value * 1_000_000;
    }
    if (lu === 'w')
    {
        return value;
    }
    return 0;
}










//Format a PV reading for the chip below the home. The display
//auto-rescales W → kW when the magnitude crosses a threshold so
//a 4500 W reading prints as "4.5 kW" rather than the noisier
//"4500 W". Energy units (kWh / Wh) keep their native unit and
//get a single decimal, daily totals usually sit in the 0–50 kWh
//band where one decimal is the right amount of precision.
export function formatPvValue(hass: any, value: number, unit: string, decimals: number): string
{
    const u  = (unit || '').trim();
    const lu = u.toLowerCase();

    //Power sources always print in kW, energy sources in kWh, both at the configured precision, so
    //the PV chip reads uniform with every other readout regardless of the sensor's native unit.
    if (lu === 'w' || lu === 'kw' || lu === 'mw')
    {
        return formatPowerKw(hass, pvNormalizeToWatts(value, unit), decimals);
    }
    if (lu === 'wh' || lu === 'kwh' || lu === 'mwh')
    {
        return formatEnergyKwh(hass, energyToKwh(value, unit), decimals);
    }
    //Fallback for arbitrary units: keep the entity's own unit string but still honour the global
    //decimal setting so the precision tracks everything else.
    const formatted = formatLocalisedNumber(hass, value, decimals);
    return u ? `${formatted} ${u}` : formatted;
}
