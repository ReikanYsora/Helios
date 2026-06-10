//Home-battery data subsystem: live SoC + power polling, history fetch, scrub-time sampling, today's energy aggregation and chip formatting.
//
//Single-source model: the user wires their battery on the HA Energy dashboard (one or more `stat_rate`, `stat_energy_from`, `stat_energy_to`,
//`stat_soc` keys per source); Helios picks the first entry of each list and reads from it. Multi-source aggregation is no longer done in the
//card, the HA Energy dashboard already publishes the aggregate values where applicable.

import { formatLocalisedNumber } from './format';
import { pvNormalizeToWatts } from './pv';
import { callWSWithTimeout, WsTimeoutError } from './ws-timeout';
import type { EnergyDefaults } from './energy-prefs';
import { beginLoadingPhase, endLoadingPhase, type LoadingTrackerHost } from './loading-tracker';
import { fetchChangeSeries, latestWattsFromChangeSeries, type ChangeBucket } from './energy-stats';


//-----------------------------------------------------------------
//Module-level cache for the battery history fetch. Survives Lit
//element unmount + remount (the user navigating away from the
//Helios card and back) the same way the PV cache does in pv.ts.
//15-minute TTL covers the most common nav-around-the-dashboard
//pattern without serving stale data forever.

const BATTERY_CACHE_TTL_MS = 15 * 60_000;

interface BatteryHistoryCacheEntry
{
    soc:   BatteryHistory;
    power: BatteryHistory;
    ts:    number;
}

const _batteryHistoryCache: Map<string, BatteryHistoryCacheEntry> = new Map();

function batteryHistoryCacheGet(key: string): BatteryHistoryCacheEntry | null
{
    const e = _batteryHistoryCache.get(key);
    if (!e)
    {
        return null;
    }
    if (Date.now() - e.ts > BATTERY_CACHE_TTL_MS)
    {
        _batteryHistoryCache.delete(key);
        return null;
    }
    return e;
}


//Wipe the module-level battery cache. Called from the card's `resetDataCache()` hook so the editor's "reset" button actually drops
//the cross-mount memo.
export function clearBatteryModuleCaches(): void
{
    _batteryHistoryCache.clear();
}


//Fetched historical series for one battery entity (SoC or power),
//parallel times[] / values[] arrays.
export interface BatteryHistory
{
    times:  Date[];
    values: number[];
}

//Result of computeBatteryToday: live SoC plus the cumulative charged / discharged energy from midnight to "now", in kWh.
export interface BatteryToday
{
    socNow:        number | null;
    chargedKwh:    number;
    dischargedKwh: number;
}


//Resolve the battery power + SoC entity ids from the HA Energy defaults. Power prefers the `stat_rate` (live signed W), falling back to the
//`stat_energy_from` (discharge kWh) and then `stat_energy_to` (charge kWh) when the source did not declare a power_config block. SoC reads
//the `stat_soc` slot directly. Either side returns null when the matching array is empty.
export function resolveBatteryEntities(defaults: EnergyDefaults): { powerEntity: string | null; socEntity: string | null }
{
    const powerEntity = defaults.batteryStatRates[0]
        ?? defaults.batteryStatEnergyFroms[0]
        ?? defaults.batteryStatEnergyTos[0]
        ?? null;
    const socEntity = defaults.batteryStatSocs[0] ?? null;
    return { powerEntity, socEntity };
}


//Structural surface the host card exposes to this module. Mutable
//fields are typed non-readonly so refresh / fetch helpers can
//assign them; Lit's @state reactivity is preserved because each
//assignment hits the same setter the decorator installed.
export interface BatteryHost extends LoadingTrackerHost
{
    readonly hass:       any;
    readonly _timeRange: { start: Date; end: Date } | null;
    readonly _energyDefaults: EnergyDefaults;

    _batterySoc:          number | null;
    _batteryPower:        number | null;
    _batteryPowerUnit:    string;
    _batterySocHistory:   BatteryHistory | null;
    _batteryPowerHistory: BatteryHistory | null;
    _batteryFetchKey:     string;
    _batteryFetching:     boolean;
    //Recorder `change` series for the battery charge (`stat_energy_to`) and discharge
    //(`stat_energy_from`) energy meters, 5-minute buckets. These are SEPARATE directional meters,
    //so the net power sign is structural (charge positive, discharge negative) instead of inferred
    //from a single signed sensor, which is what fixes the "charge stuck at 0 W" bug. Null until the
    //first fetch lands.
    _batteryChargeChangeSeries:    ChangeBucket[] | null;
    _batteryDischargeChangeSeries: ChangeBucket[] | null;
    _batteryChangeFetchKey:        string;
    _batteryChangeFetching:        boolean;
    //HA Energy daily-total alignment: when the user has battery
    //sources configured on the Energy dashboard, the card refresh
    //loop queries the recorder for today's net charge / discharge
    //change and writes the values here. `computeBatteryToday`
    //prefers these over the in-browser integration of
    //`_batteryPowerHistory`. Null when no HA stat is available or
    //the recorder call has not yet landed (consumer falls back to
    //the local integration in either case).
    _haBatteryChargedKwh?:    number | null;
    _haBatteryDischargedKwh?: number | null;
}


//Live + history refresh, called from the card on every lifecycle
//cycle. Reads SoC and power from hass.states for the entities
//resolved off the HA Energy defaults, and dispatches a history
//fetch when the (entities, range) tuple changes. History fields are
//populated in fetchBatteryHistory after the WS response lands.
export function refreshBattery(host: BatteryHost): void
{
    if (!host.hass)
    {
        return;
    }

    const { powerEntity, socEntity } = resolveBatteryEntities(host._energyDefaults);

    //Nothing configured: clear everything and bail. This keeps a stale graph from lingering when the user wipes the battery source from
    //the HA Energy dashboard.
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
        if (host._batteryPowerHistory  !== null)
        {
            host._batteryPowerHistory = null;
        }
        host._batteryFetchKey = '';
        return;
    }

    //Live SoC + power readouts. SoC clamped to [0, 100] because some BMS entities briefly report 100.5 % during absorption or dip
    //negative around calibration, neither of which is meaningful to the user. Power normalised to watts so downstream consumers can
    //work with a single unit regardless of how the source reports.
    //
    //Multi-bank SoC averaging mirrors the HA frontend logic
    //(`src/panels/lovelace/cards/energy/hui-energy-distribution-card.ts:213-225`): plain arithmetic mean of every
    //wired `stat_soc` value, NaN entries filtered out, single-bank installs collapse to the single value. The
    //capacity-weighted average from HA core PR #172817 lands once the field exists in the storage schema.
    let nextSoc: number | null = null;
    const socEntities = host._energyDefaults.batteryStatSocs;
    if (socEntities.length > 0)
    {
        let sum = 0;
        let count = 0;
        for (const id of socEntities)
        {
            const so = host.hass.states?.[id];
            const v  = so ? parseFloat(so.state) : NaN;
            if (isFinite(v))
            {
                sum   += v;
                count += 1;
            }
        }
        if (count > 0)
        {
            nextSoc = Math.max(0, Math.min(100, sum / count));
        }
    }
    //Live battery power, convention "positive = charging".
    //  - When the HA Energy battery sources declare a signed power sensor (`power_config.stat_rate`),
    //    sum its state across banks, real-time, exactly like the HA Energy live tile. Per-bank sign
    //    inversion is honoured via the `invertedRateEntities` set.
    //  - Otherwise the net comes from the two SEPARATE directional energy meters: the latest charge
    //    bucket (stat_energy_to) minus the latest discharge bucket (stat_energy_from). Because charge
    //    and discharge are distinct meters, the sign is structural and charging is never lost, which
    //    is the fix for the "battery charge stuck at 0 W" bug.
    let nextPower: number | null = null;
    let nextUnit:  string        = '';
    const rateEntities = host._energyDefaults.batteryStatRates;
    if (rateEntities.length > 0)
    {
        let sum = 0;
        let anyValid = false;
        for (const id of rateEntities)
        {
            const so = host.hass.states?.[id];
            const v  = so ? parseFloat(so.state) : NaN;
            if (!isFinite(v)) { continue; }
            const unit  = String(so.attributes?.unit_of_measurement ?? '');
            const watts = pvNormalizeToWatts(v, unit);
            const inverted = host._energyDefaults.invertedRateEntities.includes(id);
            sum += inverted ? -watts : watts;
            anyValid = true;
        }
        if (anyValid)
        {
            nextPower = sum;
            nextUnit  = 'W';
        }
    }
    else if (host._energyDefaults.batteryStatEnergyTos.length > 0
          || host._energyDefaults.batteryStatEnergyFroms.length > 0)
    {
        const nowMs     = Date.now();
        const chargeW   = latestWattsFromChangeSeries(host._batteryChargeChangeSeries, nowMs);
        const dischargeW = latestWattsFromChangeSeries(host._batteryDischargeChangeSeries, nowMs);
        if (chargeW !== null || dischargeW !== null)
        {
            nextPower = Math.max(0, chargeW ?? 0) - Math.max(0, dischargeW ?? 0);
            nextUnit  = 'W';
        }
    }
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

    //Past power series: recorder `change` on the two directional energy meters. Charge from
    //stat_energy_to, discharge from stat_energy_from; the store + scrub net them (charge - discharge)
    //so the sign is structural, no single-sensor inference. Fetched over the store's J-2 past window.
    fetchBatteryChangeSeries(host);

    //History fetch, only when the (entities, range) tuple changed.
    //Without this guard we'd reissue the WS command on every Lit
    //cycle (e.g. every clock tick).
    if (!host._timeRange || host._batteryFetching)
    {
        return;
    }

    //Entity arrays for the SoC history fetch. SoC stays on the raw / mean statistics path (it is a
    //measurement, not an energy counter); power history is sourced from the change series above.
    const powerEntities = host._energyDefaults.batteryStatRates;
    if (socEntities.length === 0 && powerEntities.length === 0)
    {
        return;
    }
    //Two-tier window:
    //  - LTS arm uses `visibleStart`, full visible timeline range,
    //    so the dashboard panel's today's charged / discharged kWh
    //    totals integrate across the full current day. LTS is
    //    near-free on the recorder regardless of source frequency.
    //  - Raw arm uses `rawStart`, capped at the last 6 h. The raw
    //    path only fires when LTS is empty (custom sensor without
    //    `state_class`), and on a 1 Hz BMS without LTS the wider
    //    window would drag the recorder.
    //  Both anchors are computed off `Date.now()` so the inner
    //  clamp at fetchBatteryHistory never tips into the future.
    const RAW_WINDOW_H = 6;
    const visibleStart = host._timeRange.start;
    const rawStart     = new Date(Date.now() - RAW_WINDOW_H * 3_600_000);
    const ltsStart     = visibleStart < rawStart ? visibleStart : rawStart;
    const rangeKey       = `${ltsStart.getTime()}|${rawStart.getTime()}|${host._timeRange.end.getTime()}`;
    //Multi-bank aggregation: the fetch key carries every wired entity (sorted) so adding / removing a bank flips
    //the key and invalidates the previous snapshot. Same shape as the PV multi-source fetch key, see pv.ts.
    const sortedSoc      = [...socEntities].sort();
    const sortedPower    = [...powerEntities].sort();
    const sig            = `${sortedSoc.join(',')}|${sortedPower.join(',')}`;
    const fetchKey       = `${sig}@${rangeKey}`;
    if (fetchKey === host._batteryFetchKey)
    {
        return;
    }
    host._batteryFetchKey = fetchKey;

    //Cache hit short-circuits the WS round-trip: the user navigates away from the Helios card and back, the module-level cache still has
    //the previous parsed series ready, no recorder hit. Cache invalidates on TTL (15 min) or on any (entities / range) change.
    const cached = batteryHistoryCacheGet(fetchKey);
    if (cached)
    {
        host._batterySocHistory   = cached.soc;
        host._batteryPowerHistory = cached.power;
        return;
    }
    fetchBatteryHistory(host, sortedSoc, sortedPower, ltsStart, rawStart, host._timeRange.end, fetchKey);
}


//Fetch the recorder `change` series for the battery charge (stat_energy_to) + discharge
//(stat_energy_from) energy meters over the store's J-2 past window. Gated on a per-host fetch key
//so it reissues only when the entity set or window changes. Charge and discharge are fetched as
//two independent series so the consumer can net them with a structural sign.
function fetchBatteryChangeSeries(host: BatteryHost): void
{
    const chargeIds    = host._energyDefaults.batteryStatEnergyTos;
    const dischargeIds = host._energyDefaults.batteryStatEnergyFroms;
    if (chargeIds.length === 0 && dischargeIds.length === 0) { return; }
    if (host._batteryChangeFetching) { return; }

    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const startMs = today0.getTime() - 2 * 24 * 3_600_000;
    const endMs   = Date.now();
    const sortedCharge    = [...chargeIds].sort();
    const sortedDischarge = [...dischargeIds].sort();
    const key = `${sortedCharge.join(',')}|${sortedDischarge.join(',')}|${startMs}`;
    if (key === host._batteryChangeFetchKey) { return; }
    host._batteryChangeFetchKey = key;
    host._batteryChangeFetching = true;
    beginLoadingPhase(host, 'battery-history');
    void Promise.all([
        sortedCharge.length    > 0 ? fetchChangeSeries(host.hass, sortedCharge,    startMs, endMs, '5minute') : Promise.resolve(null),
        sortedDischarge.length > 0 ? fetchChangeSeries(host.hass, sortedDischarge, startMs, endMs, '5minute') : Promise.resolve(null),
    ]).then(([charge, discharge]) =>
    {
        if (charge    !== null) { host._batteryChargeChangeSeries    = charge; }
        if (discharge !== null) { host._batteryDischargeChangeSeries = discharge; }
        host.requestUpdate();
    }).finally(() =>
    {
        host._batteryChangeFetching = false;
        endLoadingPhase(host, 'battery-history');
    });
}


//Parse a raw-history payload (`history/history_during_period`, minimal response shape) into a `BatteryHistory`. Accepts both `lu` (numeric epoch
//seconds) and `last_updated` / `last_changed` (ISO strings) so the function survives HA payload variations across releases.
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


//Parse a statistics payload (`recorder/statistics_during_period`) into a `BatteryHistory`. SoC and power sensors most often expose
//`state_class: measurement` (Victron, Solis, Tesla, Pylontech, BYD, SonnenBatterie BMS) and the relevant column is `mean`. Some setups
//wire a cumulative-energy kWh counter as the battery power source instead (`state_class: total_increasing`), in which case `mean` is
//`null` and `state` carries the cumulative reading at the bucket end. We prefer `mean` when present and fall back to `state` so the
//slot lands populated either way.
function parseBatteryStats(arr: any[]): BatteryHistory
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
        let valueRaw: unknown = item?.mean;
        let anchorAtEnd = false;
        if (valueRaw === null || valueRaw === undefined)
        {
            valueRaw = item?.state;
            //Cumulative readings anchor at the bucket end so consecutive deltas attribute correctly to the bucket that produced them.
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


//Coerce a `start` / `end` statistics field into a millisecond epoch. Same accept set as the PV stats parser, kept here as a private copy so
//`battery.ts` stays import-light (a single circular guard through `pv.ts` would otherwise be needed).
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


//History fetch for the battery overlay. Tries `recorder/statistics_during_period` first because it's the only path that scales on a
//Victron BMS reporting at >1 Hz (5-min buckets, ~576 rows for a 2-day window per entity vs ~150-200k raw). When the entity has no
//long-term-statistics tracking (no `state_class`) the stats array comes back empty and we fall back to a raw `history/history_during_period`
//fetch with `significant_changes_only` so the legacy code path still works for users with custom or non-`measurement` entities.
//
//SoC + power entities are bundled into one WS roundtrip when both are configured.
//Last-known-carry-forward aggregator across N battery banks. Mirrors `aggregatePvHistoriesLkcf` in pv.ts but adds two
//hooks for the battery semantics: a per-entity `transform` (used to flip the sign on `stat_rate_inverted` wirings
//before the sum) and a top-level `reducer` (`sum` for power, `mean` for SoC). Walks the union of all per-entity
//timestamps in O(entities * union) so multi-bank fetches stay sub-ms even at 1 Hz BMS cadence.
function aggregateBatteryLkcf(
    perEntity: BatteryHistory[],
    reducer:   'sum' | 'mean',
    transform: (value: number, entityIdx: number) => number,
): BatteryHistory
{
    if (perEntity.length === 0)
    {
        return { times: [], values: [] };
    }
    if (perEntity.length === 1)
    {
        const only = perEntity[0];
        return {
            times:  only.times,
            values: only.values.map((v, _i) => transform(v, 0)),
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
            const h = perEntity[i];
            let c   = cursors[i];
            while (c + 1 < h.times.length && h.times[c + 1].getTime() <= ts)
            {
                c++;
            }
            cursors[i] = c;
            if (c >= 0 && isFinite(h.values[c]))
            {
                sum += transform(h.values[c], i);
                count++;
            }
        }
        out.push(count === 0 ? NaN : reducer === 'mean' ? sum / count : sum);
    }
    return {
        times:  sortedTs.map(t => new Date(t)),
        values: out,
    };
}


export async function fetchBatteryHistory(
    host:          BatteryHost,
    socEntities:   string[],
    powerEntities: string[],
    ltsStart:      Date,
    rawStart:      Date,
    end:           Date,
    cacheKey:      string = '',
): Promise<void>
{
    if (!host.hass?.callWS)
    {
        return;
    }
    if (socEntities.length === 0 && powerEntities.length === 0)
    {
        return;
    }
    host._batteryFetching = true;
    beginLoadingPhase(host, 'battery-history');
    try
    {
        //History only exists up to "now", the future half of the timeline has no battery data. Clamp the fetch end so we don't waste a roundtrip on
        //empty future buckets.
        const now = new Date();
        const fetchEnd = end > now ? now : end;
        if (ltsStart >= fetchEnd && rawStart >= fetchEnd)
        {
            host._batterySocHistory   = { times: [], values: [] };
            host._batteryPowerHistory = { times: [], values: [] };
            return;
        }

        //Dedupe: an install that wires the same entity both as SoC and as power is degenerate but cheap to handle.
        const idSet = new Set<string>();
        for (const id of socEntities)   idSet.add(id);
        for (const id of powerEntities) idSet.add(id);
        const ids = Array.from(idSet);

        const perEntity: Record<string, BatteryHistory> = {};

        //LTS arm uses the broader `ltsStart` (typically the visible
        //timeline start, often midnight or earlier) so the dashboard
        //panel's today's charged/discharged kWh totals can integrate
        //across the FULL current day. The raw fallback below uses
        //the narrower `rawStart` so a non-LTS-tracked entity does
        //not pull a multi-day raw scan on a 1 Hz BMS.
        const statsResult: any = await callWSWithTimeout<any>(host.hass, {
            type:           'recorder/statistics_during_period',
            start_time:     ltsStart.toISOString(),
            end_time:       fetchEnd.toISOString(),
            statistic_ids:  ids,
            period:         '5minute',
            //Both fields, because a setup that wires a cumulative kWh meter as the battery power source has `mean: null` per bucket
            //(measurement assumption breaks). Asking for `state` too lets the parser cover both wirings in one round-trip.
            types:          ['mean', 'state'],
            //Normalise: SoC stays %, power stays in W, cumulative energy stays in kWh, so the downstream parser does
            //not have to handle Wh / MWh / mW scaling at sample time.
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
            //Either no entity is LTS-tracked (no `state_class`) or the recorder hasn't seen the window yet. Fall back to raw history with
            //`significant_changes_only` so high-frequency installs still benefit from server-side dedup. Raw arm is capped at the narrow
            //`rawStart` (last 6 h) so a 1 Hz BMS without LTS does not drag the recorder.
            const rawResult: any = await callWSWithTimeout<any>(host.hass, {
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

        //Multi-bank LKCF aggregation. SoC averages across every wired bank, power sums with per-entity sign-flips
        //applied from `_energyDefaults.invertedRateEntities` before the sum so a mixed-wiring install (standard sign
        //on bank A, inverted on bank B) still aggregates correctly. Single-bank installs collapse to the per-entity
        //series unchanged.
        const invertedSet = new Set(host._energyDefaults.invertedRateEntities);
        const socSeries   = aggregateBatteryLkcf(
            socEntities.map(id => perEntity[id] ?? { times: [], values: [] }),
            'mean',
            v => Math.max(0, Math.min(100, v)),
        );
        const powerSeries = aggregateBatteryLkcf(
            powerEntities.map(id => perEntity[id] ?? { times: [], values: [] }),
            'sum',
            (v, idx) => invertedSet.has(powerEntities[idx]) ? -v : v,
        );
        host._batterySocHistory   = socSeries;
        host._batteryPowerHistory = powerSeries;

        //Persist the parsed series for the next mount. Cross-mount cache hits short-circuit the WS round-trip entirely on the
        //navigation case that drives the user-visible "lag on each return" symptom.
        if (cacheKey)
        {
            _batteryHistoryCache.set(cacheKey, { soc: socSeries, power: powerSeries, ts: Date.now() });
        }
    }
    catch (e)
    {
        if (e instanceof WsTimeoutError)
        {
            console.warn(`[HELIOS] battery history fetch timed out (${e.timeoutMs} ms), rendering without past-day curve.`);
        }
        else
        {
            console.warn('[HELIOS] battery history fetch failed:', e);
        }
        host._batterySocHistory   = { times: [], values: [] };
        host._batteryPowerHistory = { times: [], values: [] };
    }
    finally
    {
        host._batteryFetching = false;
        endLoadingPhase(host, 'battery-history');
    }
}


//Locate the history sample at or before `time` and return its
//value, or null if the time falls outside the fetched window. A
//60 s grace at the tail keeps "scrub to live" resolving cleanly
//(same convention as the PV chip).
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


//Format a signed battery power value for the chip. Mirrors formatPvValue's W ↔ kW switching but always prefixes a sign so the user can tell charging
//from discharging at a glance.
export function formatBatteryPower(hass: any, value: number, unit: string): string
{
    const lu = (unit || '').trim().toLowerCase();
    const sign = value > 0 ? '+' : (value < 0 ? '−' : '');
    const abs  = Math.abs(value);

    if (lu === 'w' && abs >= 1000)
    {
        return `${sign}${formatLocalisedNumber(hass, abs / 1000, 2)} kW`;
    }
    if (lu === 'w')
    {
        return `${sign}${formatLocalisedNumber(hass, abs, 0, true)} W`;
    }
    if (lu === 'kw')
    {
        return `${sign}${formatLocalisedNumber(hass, abs, 2)} kW`;
    }
    //Unknown unit, format the value with one decimal of precision and keep the configured entity's own unit string. Still locale-aware so the decimal
    //mark matches the rest of the card.
    return `${sign}${formatLocalisedNumber(hass, abs, 1)}${unit ? ' ' + unit : ''}`;
}


//Aggregate today's battery energy from the historical power series.
//Walks the samples from midnight to "now", trapezoid-integrates the
//positive (charging) and negative (discharging) sides separately
//into kWh totals. Returns the live SoC alongside so the dashboard
//card can render the vessel + flow values from a single read.
export function computeBatteryToday(host: BatteryHost): BatteryToday
{
    //HA Energy alignment short-circuit. When the user wired battery
    //sources on the Energy dashboard, the card's refresh tick has
    //already populated the two slots from `recorder/statistics_during_period`
    //(types: 'change') over today's local window. The recorder
    //value is the same Riemann sum the Energy dashboard tile shows,
    //precise to the watt-hour on every cadence including the 1 Hz
    //installs where the in-browser integration drifts. Use both
    //slots as a pair: a partial override (only one side set) would
    //let one direction tick from HA while the other ticks from the
    //local buffer, the two directions would no longer share a
    //consistent baseline.
    const haCharged    = host._haBatteryChargedKwh    ?? null;
    const haDischarged = host._haBatteryDischargedKwh ?? null;
    if (haCharged !== null && haDischarged !== null)
    {
        return {
            socNow:        host._batterySoc,
            chargedKwh:    haCharged,
            dischargedKwh: haDischarged,
        };
    }

    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const startMs = today0.getTime();
    const endMs   = Date.now();

    let chargedKwh    = 0;
    let dischargedKwh = 0;

    const hist = host._batteryPowerHistory;
    if (hist && hist.times.length >= 2)
    {
        for (let i = 1; i < hist.times.length; i++)
        {
            const tMs = hist.times[i].getTime();
            if (tMs < startMs || tMs > endMs)
            {
                continue;
            }
            const dtH = (tMs - hist.times[i - 1].getTime()) / 3_600_000;
            if (dtH <= 0 || dtH > 6)
            {
                continue;
            }
            const wAvg = (pvNormalizeToWatts(hist.values[i - 1], host._batteryPowerUnit)
                        + pvNormalizeToWatts(hist.values[i],     host._batteryPowerUnit)) / 2;
            const kwh = (wAvg * dtH) / 1000;
            if (kwh > 0)
            {
                chargedKwh    += kwh;
            }
            else
            {
                dischargedKwh += -kwh;
            }
        }
    }

    return {
        socNow: host._batterySoc,
        chargedKwh,
        dischargedKwh
    };
}
