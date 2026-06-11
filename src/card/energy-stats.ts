//Shared energy-statistics layer. Every PAST energy series Helios draws (production, grid import /
//export, battery charge / discharge) is sourced the exact same way the Home Assistant Energy
//dashboard sources it: the recorder's pre-computed `change` metric, never a client-side
//differentiation of raw counter states.
//
//Why this matters: `recorder/statistics_during_period` with `types: ['change']` returns, per
//statistic and per period bucket, the energy delta the recorder computed for that bucket. The
//recorder handles all the hard parts natively, the same way HA Energy consumes them:
//  - total_increasing resets (counter drops to 0 at midnight / on reboot) are detected and the
//    delta is computed correctly across the reset, never a negative or absurd spike.
//  - total + last_reset sources bracket the delta on the declared reset boundary.
//  - unit conversion: `units: { energy: 'kWh' }` normalises Wh / kWh / MWh server-side so every
//    install lands on the same kWh scale regardless of what the meter reports in.
//
//Helios's only remaining math is the trivial, deterministic last mile: kWh-per-bucket / bucket-
//duration = average watts over the bucket. That is exactly what any "power from energy" template
//in HA would produce, so where HA has a number Helios shows the same number to the watt, and
//where HA has no number (a power curve, a live read from a cumulative-only meter) Helios derives
//it from HA's own primitives instead of contradicting them.

const HOUR_MS = 3_600_000;


//One recorder change bucket: the energy delta in kWh over [startMs, endMs). Already reset-
//corrected and unit-normalised by the recorder.
export interface ChangeBucket
{
    startMs: number;
    endMs:   number;
    kwh:     number;
}


//Recorder statistics period. We fetch `5minute` for fine series (the recorder keeps 5-minute
//short-term statistics for ~10 days, comfortably covering Helios's 2-day past window) and `hour`
//for coarse ones. There is no finer period than 5 minutes in HA, which is why the card's data-
//interval control caps at 12 buckets / hour.
export type StatPeriod = '5minute' | 'hour' | 'day';


//Module-level cache shared across every Helios card on the page so an N-card dashboard hits the
//recorder once per (window | period | statIds) tuple. TTL undershoots the card's 30 s tick so the
//cached series survives the whole interval between refreshes; inflight requests dedup so concurrent
//cards never race two parallel calls.
interface CacheEntry
{
    ts:        number;
    result:    ChangeBucket[] | null;
    inflight?: Promise<ChangeBucket[] | null>;
}
const TTL_MS = 25_000;
const _cache = new Map<string, CacheEntry>();

export function clearEnergyStatsCache(): void
{
    _cache.clear();
}


//Fetch the summed `change` series for a set of statistic ids over [startMs, endMs] at the given
//period. The per-source buckets are summed into a single series aligned on bucket start, so a
//multi-source install (split tariffs, two solar strings each wired as its own HA Energy source,
//multi-bank battery) lands as one combined kWh-per-bucket curve. Returns null when the id list is
//empty, hass is unavailable, or the call rejects, so callers fall back cleanly to their previous
//series.
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
            }) as Record<string, Array<{ start?: unknown; end?: unknown; change?: number | null }>>;

            //Merge the per-source buckets into a single series keyed on bucket start. Buckets align
            //across same-period sources (every source has the same 14:00 hour / 14:05 5-min bucket),
            //so the merge collapses to a clean per-bucket sum; misaligned sources still accumulate
            //into the nearest start key without dropping energy.
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
            //Statistic missing, recorder under load, RBAC denied: leave the caller on its previous
            //series until the next refresh succeeds.
            return null;
        }
    })();

    _cache.set(cacheKey, { ts: nowMs, result: null, inflight });
    const settled = await inflight;
    _cache.set(cacheKey, { ts: Date.now(), result: settled });
    return settled;
}


//One recorder mean bucket: the average of a measurement statistic (e.g. battery state-of-charge %)
//over [startMs, endMs).
export interface MeanBucket
{
    startMs: number;
    endMs:   number;
    mean:    number;
}

interface MeanCacheEntry { ts: number; result: MeanBucket[] | null; inflight?: Promise<MeanBucket[] | null>; }
const _meanCache = new Map<string, MeanCacheEntry>();

//Fetch the AVERAGED `mean` series for a set of statistic ids over [startMs, endMs] at the given period.
//Unlike fetchChangeSeries (which SUMS energy), a state-of-charge is a level, so the per-source means
//are AVERAGED per bucket. Used by the forecast learning to read the battery SoC over its 60-day window
//and skip the hours where the inverter clamped PV output (battery full), which would otherwise teach
//the sky-residual map a false low ratio at those sun positions. Returns null on empty ids / no hass /
//rejection so the caller keeps whatever it had.
export async function fetchMeanSeries(
    hass:         any,
    statisticIds: string[],
    startMs:      number,
    endMs:        number,
    period:       StatPeriod = 'hour',
): Promise<MeanBucket[] | null>
{
    if (statisticIds.length === 0) { return null; }
    if (!hass?.callWS)             { return null; }
    if (endMs <= startMs)          { return null; }

    const cacheKey = `${period}|${startMs}|${endMs}|${[...statisticIds].sort().join('|')}`;
    const nowMs    = Date.now();
    const cached   = _meanCache.get(cacheKey);
    if (cached)
    {
        if (cached.inflight)            { return cached.inflight; }
        if (nowMs - cached.ts < TTL_MS) { return cached.result; }
    }

    const inflight: Promise<MeanBucket[] | null> = (async () =>
    {
        try
        {
            const result = await hass.callWS({
                type:          'recorder/statistics_during_period',
                start_time:    new Date(startMs).toISOString(),
                end_time:      new Date(endMs).toISOString(),
                statistic_ids: statisticIds,
                period,
                types:         ['mean'],
            }) as Record<string, Array<{ start?: unknown; end?: unknown; mean?: number | null }>>;

            //Average the per-source means per bucket: { sum, count } per start boundary, then divide.
            const acc = new Map<number, { endMs: number; sum: number; count: number }>();
            for (const id of statisticIds)
            {
                const buckets = result?.[id];
                if (!Array.isArray(buckets)) { continue; }
                for (const b of buckets)
                {
                    const startBoundary = parseStatBoundary(b?.start);
                    if (startBoundary === null) { continue; }
                    const m = typeof b?.mean === 'number' ? b.mean : null;
                    if (m === null || !Number.isFinite(m)) { continue; }
                    const endBoundary = parseStatBoundary(b?.end) ?? (startBoundary + periodMs(period));
                    const existing = acc.get(startBoundary);
                    if (existing) { existing.sum += m; existing.count += 1; }
                    else          { acc.set(startBoundary, { endMs: endBoundary, sum: m, count: 1 }); }
                }
            }
            if (acc.size === 0) { return null; }
            return [...acc.entries()]
                .map(([startMs, v]) => ({ startMs, endMs: v.endMs, mean: v.sum / v.count }))
                .sort((a, b) => a.startMs - b.startMs);
        }
        catch (_)
        {
            return null;
        }
    })();

    _meanCache.set(cacheKey, { ts: nowMs, result: null, inflight });
    const settled = await inflight;
    _meanCache.set(cacheKey, { ts: Date.now(), result: settled });
    return settled;
}


//Project a change series onto the unified-store bucket grid as average watts. For each store
//bucket, sum the kWh of every source bucket whose start falls inside it, then average-power =
//summed-kWh * 1000 / bucket-duration-hours. Store buckets are always >= the source period (the
//slider caps at 12 / hour = 5 min, the source period floor), so each store bucket contains one or
//more whole source buckets and the conversion is exact, not interpolated.
//
//Buckets with no source data stay null; the caller interpolates the past half so the curve stays
//continuous. Future buckets (start >= nowMs) stay null so the forecast series owns the future.
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
    const sums = new Array<number>(bucketsTotal).fill(0);
    const hit  = new Array<boolean>(bucketsTotal).fill(false);
    for (const b of buckets)
    {
        if (b.startMs < storeStartMs || b.startMs >= nowMs) { continue; }
        const idx = Math.floor((b.startMs - storeStartMs) / stepMs);
        if (idx < 0 || idx >= bucketsTotal) { continue; }
        sums[idx] += b.kwh;
        hit[idx]   = true;
    }
    const stepH = stepMs / HOUR_MS;
    for (let i = 0; i < bucketsTotal; i++)
    {
        if (!hit[i]) { continue; }
        //Negative net (battery discharge bucket, or a meter that the recorder reports as a small
        //negative change) is preserved here, the caller decides whether to floor it; production /
        //grid floor at zero, battery keeps the sign.
        out[i] = (sums[i] * 1000) / stepH;
    }
    return out;
}


//Deriving live power from a recorder `change` series has to cope with two very different meters:
//  - a FINE meter (Shelly, P1, Victron) whose counter advances every few seconds, so essentially
//    every 5-minute recorder bucket carries energy. The latest bucket alone is the responsive,
//    correct read, exactly as before.
//  - a COARSE meter (SolarEdge: every 15 min) whose counter only advances on its report, so the
//    recorder lands the whole 15-minute delta in ONE 5-minute bucket and zeroes the other two. The
//    latest bucket then reads 0 two-thirds of the time and ~3x the true power one-third, the bug the
//    Pi4 / SolarEdge tester saw.
//We distinguish them by the density of non-zero buckets in a recent probe window: a dense window is a
//fine meter (read the latest bucket directly, no smoothing, no behaviour change), a sparse window is a
//coarse meter (average the whole probe window so the lone delta is spread over its real interval). So
//the coarse-meter fix never touches a fine-meter install.
const COARSE_PROBE_MS = 15 * 60_000;   //recent span we judge density over + average a coarse meter across
const DENSE_FRACTION  = 0.6;           //>= this share of probe buckets non-zero => fine meter, read direct

//Average power (W) over the buckets overlapping [loMs, hiMs), pro-rating straddling buckets. Returns
//{ kwh, ms, nonZero, total } so the caller can both compute the average AND judge meter density.
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


//Live power for the chip on cumulative-only installs (no stat_rate). Fine meter: latest completed
//bucket. Coarse meter: average of the recent probe window. Null only when no completed bucket exists.
export function latestWattsFromChangeSeries(
    buckets: ChangeBucket[] | null,
    nowMs:   number,
): number | null
{
    if (!buckets || buckets.length === 0) { return null; }
    //Most recent COMPLETED bucket (end <= now, never a half-filled in-progress one).
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
        //Fine meter: the latest bucket is the responsive, correct read (0 immediately on a real dip).
        return wattsFromBucket(buckets[lastIdx]);
    }
    //Coarse meter: spread the sparse delta over the probe span -> true average power.
    return probe.ms > 0 ? Math.max(0, (probe.kwh * 1000) / (probe.ms / HOUR_MS)) : 0;
}


//Average watts at an arbitrary past instant, for the scrub tooltip. Same fine / coarse split centred
//on tMs. Null only when no bucket covers the probe window (future scrub, gap before the data starts).
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


//Sum the recorder `change` over a single calendar day [dayStartMs, dayEndMs). Buckets are keyed on
//their start, so this returns the exact kWh the recorder attributes to that day, the same number the
//HA Energy dashboard's daily total shows, with no curve integration and no gap interpolation (which
//is what made the integrated-curve daily totals drift a percent or two above HA). Returns null when
//no bucket falls in the day so the caller can hide / fall back instead of showing a phantom zero.
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
    return 24 * HOUR_MS;
}


//Parse a statistics bucket boundary. The recorder serves epoch milliseconds (number) on modern
//cores and ISO strings on older ones; accept both.
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
