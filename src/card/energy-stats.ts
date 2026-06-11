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


//Resolve the most recent non-null watts value at or before `nowMs` from a change series, for the
//live chip on cumulative-only installs (no stat_rate power sensor). Returns the average power of
//the last completed source bucket. Null when no bucket covers the recent window.
//Trailing window for the live power read. Reading the single latest 5-minute bucket breaks for a
//sensor that only reports its cumulative energy every N minutes (SolarEdge: every 15): the recorder
//then attributes the whole N-minute delta to ONE 5-minute bucket and leaves the others at zero, so the
//latest bucket reads either 0 (empty) or ~N/5 times the true power (the one that caught the jump).
//Averaging over a window at least as wide as the report interval captures exactly one delta over the
//real elapsed time, so kWh / hours = the true average power regardless of how the recorder bucketed it.
//15 min covers the common 15-minute meters; if that window is all-zero (a slower meter, or a reporting
//gap) we keep walking back to MAX so a real value still surfaces instead of a false 0.
const LIVE_AVG_WINDOW_MS = 15 * 60_000;
const LIVE_AVG_MAX_MS    = 60 * 60_000;

export function latestWattsFromChangeSeries(
    buckets: ChangeBucket[] | null,
    nowMs:   number,
): number | null
{
    if (!buckets || buckets.length === 0) { return null; }
    //Accumulate completed buckets (end <= now, never a half-filled in-progress bucket) from the end
    //until the covered span reaches the base window AND at least one bucket carried real energy. The
    //average over that span = total kWh / total hours, immune to how a coarse meter's delta landed.
    let accKwh = 0;
    let accMs  = 0;
    let sawData = false;
    for (let i = buckets.length - 1; i >= 0; i--)
    {
        const b = buckets[i];
        if (b.endMs > nowMs) { continue; }
        const dt = b.endMs - b.startMs;
        if (dt <= 0) { continue; }
        accKwh += b.kwh;
        accMs  += dt;
        if (b.kwh > 0) { sawData = true; }
        if (accMs >= LIVE_AVG_WINDOW_MS && sawData) { break; }
        if (accMs >= LIVE_AVG_MAX_MS) { break; }
    }
    if (accMs <= 0) { return null; }
    return Math.max(0, (accKwh * 1000) / (accMs / HOUR_MS));
}


//Sample the average watts at an arbitrary instant from a change series, for the scrub tooltip.
//Locates the source bucket containing `tMs` and returns its average power. Null when no bucket
//covers the instant (future scrub, or a gap in the recorder data).
//Average power (W) over [lo, hi), pro-rating any bucket that straddles a window edge. Returns null
//when the window carries no real energy, so the caller can widen and retry instead of reading a false 0.
function windowedWattsFromChangeSeries(buckets: ChangeBucket[], loMs: number, hiMs: number): number | null
{
    let accKwh  = 0;
    let accMs   = 0;
    let sawData = false;
    for (const b of buckets)
    {
        if (b.endMs <= loMs || b.startMs >= hiMs) { continue; }
        const span = b.endMs - b.startMs;
        if (span <= 0) { continue; }
        const ov = Math.min(b.endMs, hiMs) - Math.max(b.startMs, loMs);   //overlap with the window
        if (ov <= 0) { continue; }
        accKwh += b.kwh * (ov / span);
        accMs  += ov;
        if (b.kwh > 0) { sawData = true; }
    }
    if (accMs <= 0 || !sawData) { return null; }
    return Math.max(0, (accKwh * 1000) / (accMs / HOUR_MS));
}

export function wattsAtFromChangeSeries(
    buckets: ChangeBucket[] | null,
    tMs:     number,
): number | null
{
    if (!buckets || buckets.length === 0) { return null; }
    //Average over a window centred on tMs rather than reading the single bucket that contains it: for a
    //meter reporting every N minutes the recorder lands the whole delta in one 5-minute bucket and zeroes
    //the rest, so a single-bucket read alternates 0 / ~N-times-true. A centred window spans the report
    //interval and yields the true average; widen to MAX before giving up so a slow meter still reads.
    const half = LIVE_AVG_WINDOW_MS / 2;
    const base = windowedWattsFromChangeSeries(buckets, tMs - half, tMs + half);
    if (base !== null) { return base; }
    const wide = LIVE_AVG_MAX_MS / 2;
    return windowedWattsFromChangeSeries(buckets, tMs - wide, tMs + wide);
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
