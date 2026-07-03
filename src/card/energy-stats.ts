//Shared energy-statistics layer. Every past energy series (production, grid import/export, battery charge/discharge)
//is sourced like the HA Energy dashboard: the recorder's pre-computed `change` metric, never client-side
//differentiation of raw counter states.
//
//`recorder/statistics_during_period` with `types: ['change']` returns the recorder's energy delta per statistic per
//bucket, handling natively: total_increasing resets (no negative/absurd spike), total+last_reset boundaries, and
//unit conversion (`units: { energy: 'kWh' }` normalises Wh/kWh/MWh server-side). The only math here is
//kWh-per-bucket / bucket-duration = average watts, so where HA has a number the card shows the same number.

import { CHANGE_REFRESH_MS, COARSE_PROBE_MS, DENSE_FRACTION, COARSE_MAX_SPREAD_BUCKETS, COARSE_REGULARITY, HOUR_MS, DAY_MS } from '../constants';


//Re-fetch cadence for the change-series fetch gates (pv/grid/battery). Recorder commits a 5-min bucket every 5 min;
//re-arming once a minute keeps cumulative-only live chips within ~1 min of the freshest bucket without WS spam.
//Callers fold floor(now / CHANGE_REFRESH_MS) into their fetch key so the gate re-arms on this boundary. Defined in
//constants.ts; re-exported here because pv/grid/battery import it from this module.
export { CHANGE_REFRESH_MS } from '../constants';

//"Now" rounded down to the refresh boundary: the single anchor every fetch gate folds into its key (battery/grid also
//pass it as fetch end). One helper so call sites can't drift and every card shares one cache entry per interval.
export function changeRefreshAnchorMs(): number
{
    return Math.floor(Date.now() / CHANGE_REFRESH_MS) * CHANGE_REFRESH_MS;
}


//One recorder change bucket: energy delta in kWh over [startMs, endMs), already reset-corrected and unit-normalised.
export interface ChangeBucket
{
    startMs: number;
    endMs:   number;
    kwh:     number;
}


//Recorder statistics period. `5minute` (kept ~10 days, covers the 2-day past window) for fine series, `hour` for
//coarse. 5 min is the finest period HA offers, hence the data-interval control caps at 12 buckets/hour.
export type StatPeriod = '5minute' | 'hour' | 'day';


//Module-level cache shared across every card so an N-card dashboard hits the recorder once per (window | period |
//statIds) tuple. TTL undershoots CHANGE_REFRESH_MS so all cards within one re-arm interval share one hit, and the
//rounded end anchor guarantees nobody is served data older than one interval. Inflight dedups races.
interface CacheEntry
{
    ts:        number;
    result:    ChangeBucket[] | null;
    inflight?: Promise<ChangeBucket[] | null>;
}
const TTL_MS = CHANGE_REFRESH_MS - 5_000;
const _cache = new Map<string, CacheEntry>();

//Drop settled entries past TTL. Re-arm retires a key every CHANGE_REFRESH_MS, so without eviction the map gains an
//entry (with its parsed bucket array) per series per minute for the page's lifetime: hundreds of MB/day on an
//always-on dashboard. Called every fetch; the map holds only a few live entries so the sweep is cheap.
function pruneExpired(cache: Map<string, { ts: number; inflight?: unknown }>, nowMs: number): void
{
    for (const [key, e] of cache)
    {
        if (!e.inflight && nowMs - e.ts > TTL_MS)
        {
            cache.delete(key);
        }
    }
}

export function clearEnergyStatsCache(): void
{
    _cache.clear();
}


//Fetch the summed `change` series for a set of statistic ids over [startMs, endMs] at the given period. Per-source
//buckets are summed into one series aligned on bucket start, so multi-source installs land as one combined curve.
//Null on empty ids, no hass, or rejection so callers fall back to their previous series.
export async function fetchChangeSeries(
    hass:         any,
    statisticIds: string[],
    startMs:      number,
    endMs:        number,
    period:       StatPeriod = '5minute',
): Promise<ChangeBucket[] | null>
{
    if (statisticIds.length === 0) { return null; }
    if (!hass?.callWS)             { return null; }
    if (endMs <= startMs)          { return null; }

    const cacheKey = `${period}|${startMs}|${endMs}|${[...statisticIds].sort().join('|')}`;
    const nowMs    = Date.now();
    pruneExpired(_cache, nowMs);
    const cached   = _cache.get(cacheKey);
    if (cached)
    {
        if (cached.inflight)                    { return cached.inflight; }
        if (nowMs - cached.ts < TTL_MS)         { return cached.result; }
    }

    const inflight: Promise<ChangeBucket[] | null> = (async () =>
    {
        try
        {
            const result = await hass.callWS({
                type:          'recorder/statistics_during_period',
                start_time:    new Date(startMs).toISOString(),
                end_time:      new Date(endMs).toISOString(),
                statistic_ids: statisticIds,
                period,
                types:         ['change'],
                units:         { energy: 'kWh' },
            }) as Record<string, { start?: unknown; end?: unknown; change?: number | null }[]>;

            //Merge per-source buckets into one series keyed on bucket start. Same-period sources share bucket starts
            //so the merge is a clean per-bucket sum; misaligned sources accumulate into the nearest start key.
            const merged = new Map<number, ChangeBucket>();
            let anyHit = false;
            for (const id of statisticIds)
            {
                const buckets = result?.[id];
                if (!Array.isArray(buckets)) { continue; }
                for (const b of buckets)
                {
                    const startBoundary = parseStatBoundary(b?.start);
                    if (startBoundary === null) { continue; }
                    const kwh = typeof b?.change === 'number' ? b.change : null;
                    if (kwh === null || !Number.isFinite(kwh)) { continue; }
                    const endBoundary = parseStatBoundary(b?.end) ?? (startBoundary + periodMs(period));
                    const existing = merged.get(startBoundary);
                    if (existing)
                    {
                        existing.kwh += kwh;
                    }
                    else
                    {
                        merged.set(startBoundary, { startMs: startBoundary, endMs: endBoundary, kwh });
                    }
                    anyHit = true;
                }
            }
            if (!anyHit) { return null; }
            return [...merged.values()].sort((a, b) => a.startMs - b.startMs);
        }
        catch (_)
        {
            //Missing statistic, recorder under load, RBAC denied: keep the caller on its previous series.
            return null;
        }
    })();

    _cache.set(cacheKey, { ts: nowMs, result: null, inflight });
    const settled = await inflight;
    _cache.set(cacheKey, { ts: Date.now(), result: settled });
    return settled;
}




//A change bucket whose magnitude exceeds this multiple of the median is a meter reset/rollover artefact, not real
//flow. Single source of the outlier rule for every change-series consumer (store curves and the clock).
const OUTLIER_CAP_FACTOR = 20;

//kWh magnitude above which a change bucket is rejected as a reset/rollover spike (the whole accumulated total
//dumped into one bucket). Infinity when there's nothing to compare against.
export function outlierCapKwh(buckets: ChangeBucket[] | null): number
{
    if (!buckets) { return Infinity; }
    const mags = buckets.map(b => Math.abs(b.kwh)).filter(k => isFinite(k) && k > 0).sort((a, b) => a - b);
    return mags.length ? mags[Math.floor(mags.length / 2)] * OUTLIER_CAP_FACTOR : Infinity;
}

//Coarse-meter smoothing on the binned per-bucket energy (sums/hit). A meter that reports its cumulative energy
//less often than a store bucket lands each delta in one bucket and leaves 0 in the buckets between reports, which
//draws a sawtooth (production looks spiky while a dense grid meter stays smooth). When the non-zero buckets are
//REGULARLY spaced (a real report cadence, not intermittent flow), spread each delta back over its report interval,
//capped so a night-long gap before the first daytime reading is never smeared. Energy-conserving: the sum over each
//interval is unchanged, so totals still match the Energy dashboard. No-op for dense meters (cadence 1) and for
//irregular series (export that only flows sometimes).
function smoothCoarseReports(sums: number[], hit: boolean[]): void
{
    const reports: number[] = [];
    for (let i = 0; i < sums.length; i++)
    {
        if (hit[i] && sums[i] !== 0) { reports.push(i); }
    }
    if (reports.length < 3) { return; }
    const gaps: number[] = [];
    for (let k = 1; k < reports.length; k++) { gaps.push(reports[k] - reports[k - 1]); }
    const cadence = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];   //median gap
    if (cadence <= 1 || cadence > COARSE_MAX_SPREAD_BUCKETS) { return; }
    const regular = gaps.filter(g => Math.abs(g - cadence) <= 1).length / gaps.length;
    if (regular < COARSE_REGULARITY) { return; }
    //Spread each report back over its own interval (capped at the cadence), evenly. Left to right; a report's range
    //never reaches the previous report (span <= cadence <= gap), so the in-place writes never collide, and the
    //genuine-gap buckets before a capped range keep their zero.
    let prev = -1;
    for (const i of reports)
    {
        const span  = prev < 0 ? cadence : Math.min(i - prev, cadence);
        const start = Math.max(0, i - span + 1);
        const share = sums[i] / (i - start + 1);
        for (let j = start; j <= i; j++)
        {
            sums[j] = share;
            hit[j]  = true;
        }
        prev = i;
    }
}


//Project a change series onto the unified-store bucket grid as average watts: per store bucket, sum the kWh of every
//source bucket starting inside it, then W = kWh * 1000 / bucket-duration-hours. Store buckets are always >= the
//source period, so each contains whole source buckets and the conversion is exact. A coarse-reporting meter is then
//smoothed (smoothCoarseReports) so it does not sawtooth. Empty buckets stay null (caller interpolates the past);
//future buckets (start >= nowMs) stay null for the forecast.
export function changeSeriesToWatts(
    buckets:      ChangeBucket[] | null,
    storeStartMs: number,
    stepMs:       number,
    bucketsTotal: number,
    nowMs:        number,
): (number | null)[]
{
    const out = new Array<number | null>(bucketsTotal).fill(null);
    if (!buckets || buckets.length === 0) { return out; }
    const cap  = outlierCapKwh(buckets);
    const sums = new Array<number>(bucketsTotal).fill(0);
    const hit  = new Array<boolean>(bucketsTotal).fill(false);
    for (const b of buckets)
    {
        if (b.startMs < storeStartMs || b.startMs >= nowMs) { continue; }
        if (Math.abs(b.kwh) > cap) { continue; }   //drop a reset/rollover spike
        const idx = Math.floor((b.startMs - storeStartMs) / stepMs);
        if (idx < 0 || idx >= bucketsTotal) { continue; }
        sums[idx] += b.kwh;
        hit[idx]   = true;
    }
    smoothCoarseReports(sums, hit);
    const stepH = stepMs / HOUR_MS;
    for (let i = 0; i < bucketsTotal; i++)
    {
        if (!hit[i]) { continue; }
        //Negative net (battery discharge, or a small negative recorder change) is preserved; the caller floors if
        //needed (production/grid at zero, battery keeps the sign).
        out[i] = (sums[i] * 1000) / stepH;
    }
    return out;
}


//Deriving live power from a `change` series must cope with two meter types:
//  - Fine: counter advances every few seconds, so every 5-min bucket carries energy and the latest bucket alone is
//    the responsive, correct read.
//  - Coarse (reports every 15 min): counter only advances on report, so the recorder lands the whole 15-min delta in
//    one bucket and zeroes the other two; the latest bucket then reads 0 two-thirds of the time and ~3x one-third.
//Distinguished by density of non-zero buckets in a probe window: dense = fine (read latest direct), sparse = coarse
//(average the probe window so the lone delta spreads over its real interval). Fine installs are untouched.

//Average power (W) over buckets overlapping [loMs, hiMs), pro-rating straddlers. Returns kwh/ms/nonZero/total so the
//caller can both average AND judge meter density.
function probeChangeWindow(buckets: ChangeBucket[], loMs: number, hiMs: number): { kwh: number; ms: number; nonZero: number; total: number }
{
    let kwh = 0;
    let ms  = 0;
    let nonZero = 0;
    let total   = 0;
    for (const b of buckets)
    {
        if (b.endMs <= loMs || b.startMs >= hiMs) { continue; }
        const span = b.endMs - b.startMs;
        if (span <= 0) { continue; }
        const ov = Math.min(b.endMs, hiMs) - Math.max(b.startMs, loMs);
        if (ov <= 0) { continue; }
        kwh += b.kwh * (ov / span);
        ms  += ov;
        total++;
        if (b.kwh > 0) { nonZero++; }
    }
    return { kwh, ms, nonZero, total };
}

function wattsFromBucket(b: ChangeBucket): number
{
    const dt = b.endMs - b.startMs;
    return dt > 0 ? Math.max(0, (b.kwh * 1000) / (dt / HOUR_MS)) : 0;
}


//Live power for the chip on cumulative-only installs (no stat_rate). Fine: latest completed bucket. Coarse: average
//of the recent probe window. Null only when no completed bucket exists. Reset/rollover spikes are dropped through
//the shared outlier rule first, so a statistics-surgery artefact never renders as a megawatt chip.
export function latestWattsFromChangeSeries(
    rawBuckets: ChangeBucket[] | null,
    nowMs:      number,
): number | null
{
    if (!rawBuckets || rawBuckets.length === 0) { return null; }
    const cap     = outlierCapKwh(rawBuckets);
    const buckets = cap === Infinity ? rawBuckets : rawBuckets.filter(b => Math.abs(b.kwh) <= cap);
    if (buckets.length === 0) { return null; }
    //Most recent completed bucket (end <= now, never a half-filled in-progress one).
    let lastIdx = -1;
    for (let i = buckets.length - 1; i >= 0; i--)
    {
        if (buckets[i].endMs <= nowMs) { lastIdx = i; break; }
    }
    if (lastIdx < 0) { return null; }
    const lastEnd = buckets[lastIdx].endMs;

    const probe = probeChangeWindow(buckets, lastEnd - COARSE_PROBE_MS, lastEnd);
    if (probe.total === 0) { return wattsFromBucket(buckets[lastIdx]); }
    const dense = probe.nonZero >= Math.ceil(probe.total * DENSE_FRACTION);
    if (dense)
    {
        //Fine meter: latest bucket is the responsive, correct read (0 immediately on a real dip).
        return wattsFromBucket(buckets[lastIdx]);
    }
    //Coarse meter: spread the sparse delta over the probe span -> true average power.
    return probe.ms > 0 ? Math.max(0, (probe.kwh * 1000) / (probe.ms / HOUR_MS)) : 0;
}


//Average watts at an arbitrary past instant, for the scrub tooltip. Same fine/coarse split centred on tMs. Null only
//when no bucket covers the probe window (future scrub, gap before data starts).
export function wattsAtFromChangeSeries(
    buckets: ChangeBucket[] | null,
    tMs:     number,
): number | null
{
    if (!buckets || buckets.length === 0) { return null; }
    const half  = COARSE_PROBE_MS / 2;
    const probe = probeChangeWindow(buckets, tMs - half, tMs + half);
    if (probe.total === 0) { return null; }
    const dense = probe.nonZero >= Math.ceil(probe.total * DENSE_FRACTION);
    if (dense)
    {
        //Fine meter: read the bucket that actually contains tMs.
        for (const b of buckets)
        {
            if (tMs >= b.startMs && tMs < b.endMs) { return wattsFromBucket(b); }
        }
    }
    //Coarse meter (or tMs between buckets): average the probe window.
    return probe.ms > 0 ? Math.max(0, (probe.kwh * 1000) / (probe.ms / HOUR_MS)) : 0;
}


//Average watts over an explicit shared window, for the home-balance formula when any family's live value is
//bucket-sourced: every term is then evaluated over the SAME span, so a fast-moving live term can never be
//subtracted against a lagged one (the mixed-cadence inflation this replaces). Same outlier rule as the live
//read. Null when no bucket overlaps the window, so the caller hides rather than sums a partial balance.
export function averageWattsOverWindow(
    rawBuckets: ChangeBucket[] | null,
    loMs:       number,
    hiMs:       number,
): number | null
{
    if (!rawBuckets || rawBuckets.length === 0 || hiMs <= loMs) { return null; }
    const cap     = outlierCapKwh(rawBuckets);
    const buckets = cap === Infinity ? rawBuckets : rawBuckets.filter(b => Math.abs(b.kwh) <= cap);
    const probe   = probeChangeWindow(buckets, loMs, hiMs);
    if (probe.total === 0 || probe.ms <= 0) { return null; }
    return (probe.kwh * 1000) / (probe.ms / HOUR_MS);
}


//Sum the recorder `change` over a single calendar day [dayStartMs, dayEndMs). Buckets are keyed on start, so this
//returns the exact kWh the recorder attributes to the day (matching HA Energy's daily total), with no curve
//integration or gap interpolation (which drifts integrated totals a percent or two above HA). Null when no bucket
//falls in the day so the caller can hide/fall back instead of showing a phantom zero.
export function sumChangeForDay(
    buckets:    ChangeBucket[] | null,
    dayStartMs: number,
    dayEndMs:   number,
): number | null
{
    if (!buckets || buckets.length === 0) { return null; }
    let sum    = 0;
    let anyHit = false;
    for (const b of buckets)
    {
        if (b.startMs < dayStartMs || b.startMs >= dayEndMs) { continue; }
        sum   += b.kwh;
        anyHit = true;
    }
    return anyHit ? sum : null;
}


function periodMs(period: StatPeriod): number
{
    if (period === '5minute') { return 5 * 60_000; }
    if (period === 'hour')    { return HOUR_MS; }
    return DAY_MS;
}


//Parse a statistics bucket boundary: modern cores serve epoch ms (number), older ones ISO strings; accept both.
function parseStatBoundary(raw: unknown): number | null
{
    if (typeof raw === 'number' && Number.isFinite(raw)) { return raw; }
    if (typeof raw === 'string')
    {
        const ms = Date.parse(raw);
        return Number.isNaN(ms) ? null : ms;
    }
    return null;
}
