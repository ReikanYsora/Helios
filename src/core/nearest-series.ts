//A time-keyed sample series (ascending tMs) with nearest-neighbour lookup inside a window. Backs the engine's
//sensor-irradiance override and every weather-variable override: the card re-pushes samples each Lit cycle, so
//build (clean + sort) and equals (the identity guard that stops the render loop) belong here too. Pure, no DOM.

export interface TimeSample { tMs: number; v: number; }

//Build a sorted series from raw samples. `accept` keeps a value or drops it (irradiance drops negatives); non-finite
//time or value is always dropped. Empty -> null so callers treat "no data" and "cleared" uniformly.
export function buildTimeSamples<S>(
    samples: S[] | null | undefined,
    time:    (s: S) => number,
    value:   (s: S) => number,
    accept:  (v: number) => boolean,
): TimeSample[] | null
{
    if (!samples || samples.length === 0)
    {
        return null;
    }
    const out: TimeSample[] = [];
    for (const s of samples)
    {
        const tMs = time(s);
        const v   = value(s);
        if (!isFinite(tMs) || !isFinite(v) || !accept(v))
        {
            continue;
        }
        out.push({ tMs, v });
    }
    out.sort((a, b) => a.tMs - b.tMs);
    return out.length > 0 ? out : null;
}

//Element-wise equality of two sorted series (identity fast-path). Used to skip a re-render when a re-pushed
//dataset is unchanged.
export function timeSamplesEqual(a: TimeSample[] | null, b: TimeSample[] | null): boolean
{
    if (a === b)
    {
        return true;
    }
    if (a === null || b === null)
    {
        return false;
    }
    if (a.length !== b.length)
    {
        return false;
    }
    for (let i = 0; i < a.length; i++)
    {
        if (a[i].tMs !== b[i].tMs || a[i].v !== b[i].v)
        {
            return false;
        }
    }
    return true;
}

//Value of the sample nearest `tMs` within +/- windowMs, else null. Samples must be ascending; the scan stops once
//the delta grows again (the rest is monotonically worse).
export function nearestSampleAt(samples: TimeSample[] | null, tMs: number, windowMs: number): number | null
{
    if (!samples || samples.length === 0)
    {
        return null;
    }
    let bestIdx   = -1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let i = 0; i < samples.length; i++)
    {
        const d = Math.abs(samples[i].tMs - tMs);
        if (d < bestDelta)
        {
            bestDelta = d; bestIdx = i;
        }
        else if (d > bestDelta)
        {
            break;
        }
    }
    if (bestIdx < 0 || bestDelta > windowMs)
    {
        return null;
    }
    return samples[bestIdx].v;
}
