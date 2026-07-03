//Characterisation of the change-series live reads: pins the fine/coarse behaviour the chips rely on, plus
//the shared-window average feeding the home balance and the outlier rule on both.

import { describe, it, expect } from 'vitest';
import { latestWattsFromChangeSeries, averageWattsOverWindow, type ChangeBucket } from '../src/card/energy-stats';

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

describe('latestWattsFromChangeSeries (characterisation)', () =>
{
    it('fine meter: the latest completed bucket is the read', () =>
    {
        //0.1 kWh per 5-min bucket = 1200 W.
        expect(latestWattsFromChangeSeries(denseBuckets(6, 0.1), T0)).toBeCloseTo(1200, 0);
    });

    it('coarse meter: the lone delta spreads over the probe window', () =>
    {
        //One 0.3 kWh report in the last 15 minutes, two empty buckets around it.
        const buckets: ChangeBucket[] = [
            { startMs: T0 - 3 * MIN5, endMs: T0 - 2 * MIN5, kwh: 0 },
            { startMs: T0 - 2 * MIN5, endMs: T0 - 1 * MIN5, kwh: 0.3 },
            { startMs: T0 - 1 * MIN5, endMs: T0,            kwh: 0 },
        ];
        //0.3 kWh over 15 min = 1200 W.
        expect(latestWattsFromChangeSeries(buckets, T0)).toBeCloseTo(1200, 0);
    });

    it('null on empty input', () =>
    {
        expect(latestWattsFromChangeSeries(null, T0)).toBeNull();
        expect(latestWattsFromChangeSeries([], T0)).toBeNull();
    });

    it('a reset/rollover artefact bucket is dropped instead of rendering a megawatt chip', () =>
    {
        const buckets = denseBuckets(12, 0.1);
        //Statistics surgery dumps 40 kWh into the latest bucket (median 0.1 -> cap 2 kWh).
        buckets[buckets.length - 1] = { ...buckets[buckets.length - 1], kwh: 40 };
        const w = latestWattsFromChangeSeries(buckets, T0);
        expect(w).not.toBeNull();
        //The read falls back to the previous sane bucket, not 480 kW.
        expect(w!).toBeLessThan(2000);
    });
});

describe('averageWattsOverWindow', () =>
{
    it('averages the shared window, pro-rating straddlers', () =>
    {
        //Last 15 minutes at 0.1 kWh/bucket = steady 1200 W.
        expect(averageWattsOverWindow(denseBuckets(6, 0.1), T0 - 15 * 60_000, T0)).toBeCloseTo(1200, 0);
    });

    it('null when nothing overlaps the window (series not landed / long gap)', () =>
    {
        expect(averageWattsOverWindow(null, T0 - 15 * 60_000, T0)).toBeNull();
        expect(averageWattsOverWindow(denseBuckets(6, 0.1), T0 + MIN5, T0 + 2 * MIN5)).toBeNull();
    });

    it('applies the same outlier rule as the live read', () =>
    {
        const buckets = denseBuckets(12, 0.1);
        buckets[buckets.length - 1] = { ...buckets[buckets.length - 1], kwh: 40 };
        const w = averageWattsOverWindow(buckets, T0 - 15 * 60_000, T0);
        expect(w).not.toBeNull();
        expect(w!).toBeLessThan(2000);
    });
});
