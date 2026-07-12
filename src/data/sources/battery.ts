//Home-battery subsystem: live SoC + power polling, history fetch, scrub-time sampling, today's energy aggregation, chip formatting.
//
//The user wires their battery on the HA Energy dashboard (per-source lists of `stat_rate`, `stat_energy_from`, `stat_energy_to`,
//`stat_soc`). Live reads aggregate across every wired bank (sum for power, mean for SoC).

import { formatPowerKw, parseNumericState, type PowerUnit } from '../../core/format/format';
import { pvNormalizeToWatts } from './pv';
import { callWS } from '../ha-gateway';
import { RequestCache } from '../request-cache';
import { saveDurableSeries, loadDurableSeries } from '../durable-cache';
import { warnOnce } from '../log';
import { unionChangeMeters, type EnergyDefaults } from './energy-prefs';
import { fetchChangeById, mergeChangeSeries, changeRefreshAnchorMs, parseStatBoundaryLoose, type ChangeBucket, type StatPeriod } from './energy-stats';
import { sumLiveWatts, quantizedAnchorMs, type KeyedFetch } from '../source-fetch';
import { BATTERY_CACHE_TTL_MS, HOUR_MS, DAY_MS} from '../../core/config/constants';
import { localMidnightMinusDays } from '../../core/time/timezone';


//Module-level history cache, survives Lit unmount+remount (navigate away and back) like the PV cache. 15-min TTL covers
//nav-around-the-dashboard without serving stale data forever, and in-flight de-dup collapses concurrent mounts to one WS hit.
const _batteryCache = new RequestCache<BatterySocFetch | null>(BATTERY_CACHE_TTL_MS);


//Wipe the module-level cache. Called from the card's `resetDataCache()` so the editor's "reset" drops the cross-mount memo.
export function clearBatteryModuleCaches(): void
{
    _batteryCache.clear();
}


//Fetched historical series for one battery entity (SoC or power), as parallel times[] / values[] arrays.
export interface BatteryHistory
{
    times:  Date[];
    values: number[];
}


//Result of a SoC history fetch: the aggregated mean (drives the chip scrub, tooltip and detail panel) plus the raw
//per-bank series in fetch order, kept so the battery chart can draw one SoC line per bank scaled onto the power
//axis. Empty perBank on a single-bank install or a failed/durable-restored fetch.
export interface BatterySocFetch
{
    merged:  BatteryHistory;
    perBank: BatteryHistory[];
}



//Resolve battery power + SoC entity ids from HA Energy defaults. Power prefers `stat_rate` (live signed W), falling back to
//`stat_energy_from` (discharge kWh) then `stat_energy_to` (charge kWh) when no power_config block. SoC reads `stat_soc`. null when empty.
export function resolveBatteryEntities(defaults: EnergyDefaults): { powerEntity: string | null; socEntity: string | null }
{
    const powerEntity = defaults.batteryStatRates[0]
        ?? defaults.batteryStatEnergyFroms[0]
        ?? defaults.batteryStatEnergyTos[0]
        ?? null;
    const socEntity = defaults.batteryStatSocs[0] ?? null;
    return { powerEntity, socEntity };
}


//True when the install lacks a COMPLETE set of live battery power sensors (no stat_rate, or at least one source
//without one). Measured-only: in that case refreshBattery shows NO live battery power at all; only a full rate set
//yields a live chip value. Past curves + scrub read the directional change series regardless.
export function batteryLiveIsBucketSourced(defaults: EnergyDefaults): boolean
{
    return !(defaults.batteryStatRates.length > 0 && defaults.batterySourcesWithoutRate === 0);
}


//Surface the host card exposes to this module. Mutable fields are non-readonly so refresh/fetch helpers can assign them;
//@state reactivity is preserved since each assignment hits the decorator's setter.
export interface BatteryHost
{
    readonly hass:       any;
    readonly _timeRange: { start: Date; end: Date } | null;
    readonly _energyDefaults: EnergyDefaults;
    //Rolling-window past days (period selector), so the change-series fetch spans the whole store window.
    readonly _periodPastDays: number;
    //Recorder period for the change-series + SoC stats, per the active timeline mode (5-min / hour / day).
    readonly _storeFetchPeriod: StatPeriod;

    requestUpdate(): void;

    _batterySoc:          number | null;
    _batteryPower:        number | null;
    _batteryPowerUnit:    string;
    _batterySocHistory:   BatteryHistory | null;
    //Raw per-bank SoC series (fetch order), for the battery chart's per-bank lines. Empty on a single-bank
    //install or before the first fetch.
    _batterySocPerBankHistory: BatteryHistory[];
    _batteryFetchKey:     string;
    _batteryFetching:     boolean;
    //Recorder `change` series for charge (`stat_energy_to`) and discharge (`stat_energy_from`) meters, 5-min buckets. SEPARATE
    //directional meters, so the net power sign is structural (charge +, discharge -) not inferred from one signed sensor, which
    //keeps charging from reading as 0 W. Null until first fetch.
    _batteryChargeChangeSeries:    ChangeBucket[] | null;
    _batteryDischargeChangeSeries: ChangeBucket[] | null;
    _batteryChangeFetch:           KeyedFetch;
}


//Live SoC + power read shared by the full and live-only refresh paths.
//Live SoC: clamped to [0, 100] since some battery management systems briefly report 100.5% during absorption or dip
//negative near calibration. Multi-bank SoC is the arithmetic mean of every wired `stat_soc` (NaN filtered, single-bank
//collapses to the one value); capacity-weighted averaging is not possible (no capacity field in the storage schema).
//Live power, "positive = charging": measured or absent. When power sensors cover EVERY bank (`power_config` on each
//source), sum their states like the HA Energy live tile (per-bank sign honoured via `invertedRateEntities`). A mixed or
//energy-only wiring shows NO live power (the sum would silently miss a bank, and a live value is never derived from the
//meters); scrub and curves keep netting the directional change series regardless.
function computeBatteryLive(hass: any, defaults: EnergyDefaults): { soc: number | null; power: number | null; unit: string }
{
    let soc: number | null = null;
    const socEntities = defaults.batteryStatSocs;
    if (socEntities.length > 0)
    {
        let sum   = 0;
        let count = 0;
        for (const id of socEntities)
        {
            const so = hass.states?.[id];
            const v  = so ? parseNumericState(so.state) : null;
            if (v !== null) { sum += v; count += 1; }
        }
        if (count > 0) { soc = Math.max(0, Math.min(100, sum / count)); }
    }
    let power: number | null = null;
    let unit = '';
    if (!batteryLiveIsBucketSourced(defaults))
    {
        const { watts, any } = sumLiveWatts(hass, defaults.batteryStatRates, defaults.invertedRateEntities);
        if (any) { power = watts; unit = 'W'; }
    }
    return { soc, power, unit };
}


//Live + history refresh, called every lifecycle cycle. Reads SoC and power from hass.states for the resolved entities and
//dispatches a history fetch when the (entities, range) tuple changes; history fields land in fetchBatterySoc.
export function refreshBattery(host: BatteryHost): void
{
    if (!host.hass)
    {
        return;
    }

    const { powerEntity, socEntity } = resolveBatteryEntities(host._energyDefaults);

    //Nothing configured: clear everything so no stale graph lingers when the user wipes the battery source from HA Energy.
    if (!powerEntity && !socEntity)
    {
        if (host._batterySoc           !== null)
        {
            host._batterySoc          = null;
        }
        if (host._batteryPower         !== null)
        {
            host._batteryPower        = null;
        }
        if (host._batteryPowerUnit     !== '')
        {
            host._batteryPowerUnit    = '';
        }
        if (host._batterySocHistory    !== null)
        {
            host._batterySocHistory   = null;
        }
        if (host._batterySocPerBankHistory.length > 0)
        {
            host._batterySocPerBankHistory = [];
        }
        host._batteryFetchKey = '';
        return;
    }

    const socEntities = host._energyDefaults.batteryStatSocs;
    const { soc: nextSoc, power: nextPower, unit: nextUnit } = computeBatteryLive(host.hass, host._energyDefaults);
    if (nextSoc   !== host._batterySoc)
    {
        host._batterySoc       = nextSoc;
    }
    if (nextPower !== host._batteryPower)
    {
        host._batteryPower     = nextPower;
    }
    if (nextUnit  !== host._batteryPowerUnit)
    {
        host._batteryPowerUnit = nextUnit;
    }

    //Past power series: recorder `change` on the two directional energy meters; the store + scrub net them (charge - discharge)
    //so the sign is structural.
    fetchBatteryChangeSeries(host);

    //History fetch only when the (entities, range) tuple changed, else we'd reissue the WS command every Lit cycle.
    if (!host._timeRange || host._batteryFetching)
    {
        return;
    }

    //SoC stays on the raw/mean statistics path (a measurement, not an energy counter); past power comes from the change series above.
    if (socEntities.length === 0)
    {
        return;
    }
    //Two-tier window. LTS arm uses `visibleStart` (full visible timeline) so today's charged/discharged kWh integrate across the
    //full day; LTS is near-free on the recorder. Raw arm uses `rawStart`, capped at 6 h, firing only when LTS is empty (custom
    //sensor without `state_class`) since a wider raw window on a high-frequency battery feed would drag the recorder. Both anchors
    //are off `Date.now()` so the inner clamp in fetchBatterySoc never tips into the future.
    const RAW_WINDOW_H = 6;
    const visibleStart = host._timeRange.start;
    //Quantise the now-anchor to the cache TTL so the dedupe key below only re-arms once per TTL, not every render:
    //an unquantised Date.now() never matches and the fetch re-fires constantly. The 6 h cap is approximate, so the
    //TTL of slop is harmless. The key's end is quantised the same way (the real end still drives the fetch below),
    //so a live present does not rotate the key either.
    const anchorMs     = quantizedAnchorMs(BATTERY_CACHE_TTL_MS);
    const rawStart     = new Date(anchorMs - RAW_WINDOW_H * HOUR_MS);
    const ltsStart     = visibleStart < rawStart ? visibleStart : rawStart;
    const keyEnd       = Math.floor(host._timeRange.end.getTime() / BATTERY_CACHE_TTL_MS) * BATTERY_CACHE_TTL_MS;
    const rangeKey       = `${ltsStart.getTime()}|${rawStart.getTime()}|${keyEnd}`;
    //Fetch key carries every wired SoC entity (sorted) so adding/removing a bank flips the key and invalidates the snapshot.
    const sortedSoc      = [...socEntities].sort();
    const fetchKey       = `${sortedSoc.join(',')}@${rangeKey}`;
    if (fetchKey === host._batteryFetchKey)
    {
        return;
    }
    host._batteryFetchKey = fetchKey;

    //Cache short-circuits the WS round-trip on navigate-away-and-back (fresh within TTL, in-flight de-duped). On a failed
    //fetch the pure fetcher restores the last-good durable series instead of blanking; @state assignment triggers render.
    const durableKey = `bsoc:${host._storeFetchPeriod}|${sortedSoc.join(',')}`;
    host._batteryFetching = true;
    void _batteryCache.get(fetchKey, () => fetchBatterySoc(host.hass, sortedSoc, ltsStart, rawStart, host._timeRange!.end, host._storeFetchPeriod, durableKey))
        .then(res => {
            host._batterySocHistory        = res?.merged  ?? { times: [], values: [] };
            host._batterySocPerBankHistory = res?.perBank ?? [];
        })
        .finally(() => { host._batteryFetching = false; });
}


//Narrow host for the live-only battery read (Helios Mini): the live chip fields only, no history surface.
export interface BatteryLiveHost
{
    readonly hass:            any;
    readonly _energyDefaults: EnergyDefaults;
    _batterySoc:       number | null;
    _batteryPower:     number | null;
    _batteryPowerUnit: string;
}


//Live-only battery refresh for a card that never fetches history: mean SoC across every wired `stat_soc`
//bank and summed live power (only when every bank exposes a power sensor). No recorder call.
export function refreshBatteryLive(host: BatteryLiveHost): void
{
    if (!host.hass) { return; }
    const { powerEntity, socEntity } = resolveBatteryEntities(host._energyDefaults);
    if (!powerEntity && !socEntity)
    {
        if (host._batterySoc       !== null) { host._batterySoc       = null; }
        if (host._batteryPower     !== null) { host._batteryPower     = null; }
        if (host._batteryPowerUnit !== '')   { host._batteryPowerUnit = ''; }
        return;
    }

    const { soc: nextSoc, power: nextPower, unit: nextUnit } = computeBatteryLive(host.hass, host._energyDefaults);
    if (nextSoc   !== host._batterySoc)       { host._batterySoc       = nextSoc; }
    if (nextPower !== host._batteryPower)      { host._batteryPower     = nextPower; }
    if (nextUnit  !== host._batteryPowerUnit)  { host._batteryPowerUnit = nextUnit; }
}


//Fetch the recorder `change` series for charge (stat_energy_to) + discharge (stat_energy_from) meters. Gated on a per-host key
//that re-arms every CHANGE_REFRESH_MS (and on entity-set/window changes) so the series tracks newly committed buckets. Charge
//and discharge fetched as two independent series so the consumer can net them with a structural sign.
function fetchBatteryChangeSeries(host: BatteryHost): void
{
    const chargeIds    = host._energyDefaults.batteryStatEnergyTos;
    const dischargeIds = host._energyDefaults.batteryStatEnergyFroms;
    if (chargeIds.length === 0 && dischargeIds.length === 0) { return; }

    //Span the full configured past window (period selector), not a fixed 2 days, else the older days of a
    //wide window (e.g. 7 d) come back empty.
    const startMs = localMidnightMinusDays(host._periodPastDays);
    //Rounded end anchor so the past curve + scrub keep tracking new buckets. One call for the union of every
    //source's meters; RequestCache collapses pv/grid/battery to a single recorder round-trip. Charge and
    //discharge are merged separately so the net power keeps a structural sign.
    const endMs   = changeRefreshAnchorMs();
    const sortedUnion = [...unionChangeMeters(host._energyDefaults)].sort();
    const key = `${sortedUnion.join(',')}|${startMs}|${endMs}`;
    host._batteryChangeFetch.run(key, () =>
        fetchChangeById(host.hass, sortedUnion, startMs, endMs, host._storeFetchPeriod)
            .then((byId) =>
            {
                if (byId === null) { return; }
                const charge    = chargeIds.length    > 0 ? mergeChangeSeries(byId, chargeIds)    : null;
                const discharge = dischargeIds.length > 0 ? mergeChangeSeries(byId, dischargeIds) : null;
                if (charge    !== null) { host._batteryChargeChangeSeries    = charge; }
                if (discharge !== null) { host._batteryDischargeChangeSeries = discharge; }
                host.requestUpdate();
            }));
}


//Parse a raw-history payload (`history/history_during_period`, minimal shape) into a `BatteryHistory`. Accepts `lu` (epoch seconds)
//and `last_updated`/`last_changed` (ISO) so it survives HA payload variations across releases.
function parseRawBatteryHistory(arr: any[]): BatteryHistory
{
    const times:  Date[]   = [];
    const values: number[] = [];
    for (const item of arr ?? [])
    {
        const stateStr =
            typeof item?.s     === 'string' ? item.s :
            typeof item?.state === 'string' ? item.state :
            null;
        if (stateStr === null
            || stateStr === 'unavailable'
            || stateStr === 'unknown'
            || stateStr === '')
        {
            continue;
        }
        const v = parseFloat(stateStr);
        if (!isFinite(v))
        {
            continue;
        }
        let ts: Date | null = null;
        if (typeof item?.lu === 'number')
        {
            ts = new Date(item.lu * 1000);
        }
        else if (typeof item?.last_updated === 'string')
        {
            ts = new Date(item.last_updated);
        }
        else if (typeof item?.last_changed === 'string')
        {
            ts = new Date(item.last_changed);
        }
        if (!ts || isNaN(ts.getTime()))
        {
            continue;
        }
        times.push(ts);
        values.push(v);
    }
    return { times, values };
}


//Parse a statistics payload (`recorder/statistics_during_period`) into a `BatteryHistory`. SoC/power sensors usually expose
//`state_class: measurement` so the column is `mean`. Some setups wire a cumulative kWh counter (`total_increasing`) where `mean` is
//null and `state` carries the bucket-end reading; prefer `mean`, fall back to `state` so the slot lands populated either way.
function parseBatteryStats(arr: any[]): BatteryHistory
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
        let valueRaw: unknown = item?.mean;
        let anchorAtEnd = false;
        if (valueRaw === null || valueRaw === undefined)
        {
            valueRaw = item?.state;
            //Cumulative readings anchor at bucket end so consecutive deltas attribute to the bucket that produced them.
            anchorAtEnd = true;
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
        const anchorMs = anchorAtEnd
            ? (endMs ?? startMs)
            : (endMs !== null ? (startMs + endMs) / 2 : startMs);
        times.push(new Date(anchorMs));
        values.push(v);
    }
    return { times, values };
}


//History fetch for the battery overlay. Tries `recorder/statistics_during_period` first: the only path that scales on a
//high-frequency feed (5-min buckets, ~576 rows per 2-day window vs ~150-200k raw). When the entity has no LTS tracking (no
//`state_class`) the stats array is empty and we fall back to raw `history/history_during_period` with `significant_changes_only`
//for custom/non-measurement entities. SoC + power entities are bundled into one WS roundtrip when both are configured.
//
//Multi-bank SoC aggregator: last-known-carry-forward mean across N banks, each value clamped to [0, 100]. Walks the
//union of all timestamps in O(entities * union), sub-ms even at high cadence. Single-bank collapses to the one series.
function aggregateBatterySocLkcf(perEntity: BatteryHistory[]): BatteryHistory
{
    const clamp = (v: number): number => Math.max(0, Math.min(100, v));
    if (perEntity.length === 0)
    {
        return { times: [], values: [] };
    }
    if (perEntity.length === 1)
    {
        const only = perEntity[0];
        return {
            times:  only.times,
            values: only.values.map(clamp),
        };
    }
    const tsSet = new Set<number>();
    for (const h of perEntity)
    {
        for (const t of h.times)
        {
            tsSet.add(t.getTime());
        }
    }
    const sortedTs = Array.from(tsSet).sort((a, b) => a - b);
    const cursors  = new Array<number>(perEntity.length).fill(-1);
    const out:     number[] = [];
    for (const ts of sortedTs)
    {
        let sum   = 0;
        let count = 0;
        for (let i = 0; i < perEntity.length; i++)
        {
            const series = perEntity[i];
            let cursor   = cursors[i];
            while (cursor + 1 < series.times.length && series.times[cursor + 1].getTime() <= ts)
            {
                cursor++;
            }
            cursors[i] = cursor;
            if (cursor >= 0 && isFinite(series.values[cursor]))
            {
                sum += clamp(series.values[cursor]);
                count++;
            }
        }
        out.push(count === 0 ? NaN : sum / count);
    }
    return {
        times:  sortedTs.map(t => new Date(t)),
        values: out,
    };
}


//Pure SoC history fetcher: no host mutation, no fetching flag, no module cache write. The caller runs it through the
//RequestCache and lands the result on `@state`. Returns the fresh SoC series on success, the last-good durable copy on a
//failed fetch (so the curve survives an HA restart / timeout instead of blanking), or an empty series for an empty window.
export async function fetchBatterySoc(
    hass:       any,
    ids:        string[],
    ltsStart:   Date,
    rawStart:   Date,
    end:        Date,
    period:     StatPeriod,
    durableKey: string,
): Promise<BatterySocFetch | null>
{
    if (!hass?.callWS)
    {
        return null;
    }
    if (ids.length === 0)
    {
        return null;
    }
    try
    {
        //History only exists up to "now"; clamp the fetch end so we don't waste a roundtrip on empty future buckets.
        const now = new Date();
        const fetchEnd = end > now ? now : end;
        if (ltsStart >= fetchEnd && rawStart >= fetchEnd)
        {
            return { merged: { times: [], values: [] }, perBank: [] };
        }

        const perEntity: Record<string, BatteryHistory> = {};

        //LTS arm uses the broader `ltsStart` (usually visible start, often midnight or earlier) so today's charged/discharged kWh
        //integrate across the full day. The raw fallback below uses the narrower `rawStart` so a non-LTS entity doesn't pull a
        //multi-day raw scan on a high-frequency BMS.
        const statsResult: any = await callWS<any>(hass, {
            type:           'recorder/statistics_during_period',
            start_time:     ltsStart.toISOString(),
            end_time:       fetchEnd.toISOString(),
            statistic_ids:  ids,
            period,
            //Both fields: a cumulative-kWh-as-power wiring has `mean: null` per bucket, so asking for `state` too lets the parser
            //cover both wirings in one round-trip.
            types:          ['mean', 'state'],
            //Normalise units so the parser doesn't handle Wh/MWh/mW scaling at sample time (SoC %, power W, energy kWh).
            units:          { energy: 'kWh', power: 'W' },
        });
        const statsUsable = ids.some(id => Array.isArray(statsResult?.[id]) && statsResult[id].length > 0);
        if (statsUsable)
        {
            for (const id of ids)
            {
                perEntity[id] = parseBatteryStats(statsResult?.[id] ?? []);
            }
        }
        else
        {
            //No entity is LTS-tracked (no `state_class`) or the recorder hasn't seen the window yet. Fall back to raw history with
            //`significant_changes_only` for server-side dedup; raw arm capped at `rawStart` (6 h) so a high-frequency feed doesn't drag the recorder.
            const rawResult: any = await callWS<any>(hass, {
                type:                     'history/history_during_period',
                start_time:               rawStart.toISOString(),
                end_time:                 fetchEnd.toISOString(),
                entity_ids:               ids,
                minimal_response:         true,
                no_attributes:            true,
                significant_changes_only: true,
            });
            for (const id of ids)
            {
                perEntity[id] = parseRawBatteryHistory(rawResult?.[id] ?? []);
            }
        }

        //Per-bank series in fetch order, for the chart's per-bank SoC lines. Single-bank collapses to one entry.
        const perBank = ids.map(id => perEntity[id] ?? { times: [], values: [] });
        //Multi-bank LKCF aggregation: SoC averages across banks, single-bank collapses to the per-entity series unchanged.
        const socSeries = aggregateBatterySocLkcf(perBank);
        //Persist the last-good mean series so a failed fetch on the next load restores it instead of blanking.
        saveDurableSeries(durableKey, socSeries);
        return { merged: socSeries, perBank };
    }
    catch (_e)
    {
        //Fetch timed out or failed (LTS unavailable, entity untracked, HA restart): restore the last-good durable mean
        //series so the curve survives, rather than blanking to empty. Per-bank lines drop until the next good fetch.
        warnOnce('battery-soc-fetch', 'battery SoC fetch failed; showing cached data until it recovers');
        return { merged: loadDurableSeries(durableKey, DAY_MS) ?? { times: [], values: [] }, perBank: [] };
    }
}


//Locate the history sample at or before `time` and return its value, or null if outside the fetched window. 60 s tail grace keeps
//"scrub to live" resolving cleanly.
export function batterySampleAtTime(
    hist: BatteryHistory | null,
    time: Date
): number | null
{
    if (!hist || hist.times.length === 0)
    {
        return null;
    }
    const tMs = time.getTime();
    const firstMs = hist.times[0].getTime();
    const lastMs  = hist.times[hist.times.length - 1].getTime();
    if (tMs < firstMs || tMs > lastMs + 60_000)
    {
        return null;
    }
    let idx = hist.times.length - 1;
    for (let i = 0; i < hist.times.length; i++)
    {
        if (hist.times[i].getTime() > tMs)
        {
            idx = i - 1;
            break;
        }
    }
    if (idx < 0) { idx = 0; }
    return hist.values[idx];
}


//Format a battery power value for the chip in the card's configured unit (W or kW), at the configured precision.
//`sign` picks the convention: 'default' keeps the +/- as given (charging negative, discharging positive after the
//caller's negation), 'inverted' flips it, 'hidden' drops the sign and shows the magnitude only.
export function formatBatteryPower(hass: any, value: number, unit: string, decimals: number, powerU: PowerUnit = 'kW', sign: 'default' | 'inverted' | 'hidden' = 'default'): string
{
    const watts = pvNormalizeToWatts(value, unit);
    if (sign === 'hidden') { return formatPowerKw(hass, Math.abs(watts), decimals, false, powerU); }
    return formatPowerKw(hass, sign === 'inverted' ? -watts : watts, decimals, true, powerU);
}


