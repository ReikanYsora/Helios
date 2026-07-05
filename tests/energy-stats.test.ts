//Characterisation of the change-series reads: the outlier rule protecting the store curves, and the
//fine/coarse scrub read. Live chips no longer derive from these series (measured sensors only).

import { describe, it, expect } from 'vitest';
import { wattsAtFromChangeSeries, outlierCapKwh, type ChangeBucket } from '../src/card/energy-stats';

const T0 = Date.UTC(2026, 6, 3, 12, 0, 0);
const MIN5 = 5 * 60_000;

//n consecutive 5-minute buckets ending at T0, each carrying `kwh`.
function denseBuckets(n: number, kwh: number): ChangeBucket[]
{
    const out: ChangeBucket[] = [];
    for (let i = n; i > 0; i--)
    {
        out.push({ startMs: T0 - i * MIN5, endMs: T0 - (i - 1) * MIN5, kwh });
    }
    return out;
}

describe('outlierCapKwh', () =>
{
    it('a genuine production bell with a long twilight tail is never capped', () =>
    {
        //Summer day: 40 twilight buckets trickling 0.01 kWh, 10 midday buckets at 0.3 kWh.
        //A median-based cap (0.01 * 20 = 0.2) would reject the whole midday top and the curve
        //would flat-line at the cap through interpolation; the p90-based cap must keep it.
        const buckets: ChangeBucket[] = [];
        for (let i = 0; i < 40; i++)
        {
            buckets.push({ startMs: T0 + i * MIN5, endMs: T0 + (i + 1) * MIN5, kwh: 0.01 });
        }
        for (let i = 40; i < 50; i++)
        {
            buckets.push({ startMs: T0 + i * MIN5, endMs: T0 + (i + 1) * MIN5, kwh: 0.3 });
        }
        expect(outlierCapKwh(buckets)).toBeGreaterThan(0.3);
    });

    it('a meter reset dumping a lifetime total into one bucket is still rejected', () =>
    {
        const buckets = denseBuckets(50, 0.2);
        buckets.push({ startMs: T0, endMs: T0 + MIN5, kwh: 35000 });
        const cap = outlierCapKwh(buckets);
        expect(cap).toBeLessThan(35000);
        expect(cap).toBeGreaterThan(0.2);
    });

    it('empty input means no cap', () =>
    {
        expect(outlierCapKwh(null)).toBe(Infinity);
        expect(outlierCapKwh([])).toBe(Infinity);
    });
});

describe('wattsAtFromChangeSeries (characterisation)', () =>
{
    it('fine meter: reads the bucket containing the instant', () =>
    {
        expect(wattsAtFromChangeSeries(denseBuckets(6, 0.1), T0 - MIN5 / 2)).toBeCloseTo(1200, 0);
    });

    it('coarse meter: spreads the lone delta over the probe window', () =>
    {
        const buckets: ChangeBucket[] = [
            { startMs: T0 - 3 * MIN5, endMs: T0 - 2 * MIN5, kwh: 0 },
            { startMs: T0 - 2 * MIN5, endMs: T0 - 1 * MIN5, kwh: 0.3 },
            { startMs: T0 - 1 * MIN5, endMs: T0,            kwh: 0 },
        ];
        //15-min probe centred on the instant: 0.3 kWh spread over the 12.5 covered minutes = 1440 W.
        expect(wattsAtFromChangeSeries(buckets, T0 - MIN5)).toBeCloseTo(1440, 0);
    });

    it('null outside any covered window', () =>
    {
        expect(wattsAtFromChangeSeries(null, T0)).toBeNull();
        expect(wattsAtFromChangeSeries(denseBuckets(6, 0.1), T0 + 3_600_000)).toBeNull();
    });
});
