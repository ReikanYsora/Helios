import { describe, it, expect } from 'vitest';
import {
    parseStatBoundary,
    parseStatBoundaryLoose,
    outlierCapKwh,
    mergeChangeSeries,
    extractPerEntity,
    sumChangeForDay,
    changeSeriesToWatts,
} from '../src/data/sources/energy-stats';
import { HOUR_MS, DAY_MS } from '../src/core/config/constants';

type Bucket = { startMs: number; endMs: number; kwh: number };
const bucket = (i: number, kwh: number): Bucket => ({ startMs: i * HOUR_MS, endMs: (i + 1) * HOUR_MS, kwh });

describe('parseStatBoundary (strict)', () =>
{
    it('accepts epoch ms and ISO strings, rejects everything else', () =>
    {
        expect(parseStatBoundary(1_700_000_000_000)).toBe(1_700_000_000_000);
        expect(parseStatBoundary('2024-01-01T00:00:00Z')).toBe(Date.parse('2024-01-01T00:00:00Z'));
        expect(parseStatBoundary('not a date')).toBeNull();
        expect(parseStatBoundary(NaN)).toBeNull();
        expect(parseStatBoundary(null)).toBeNull();
        expect(parseStatBoundary({})).toBeNull();
    });
});

describe('parseStatBoundaryLoose', () =>
{
    it('treats a value under 1e12 as seconds and scales it to ms', () =>
    {
        expect(parseStatBoundaryLoose(1_700_000_000_000)).toBe(1_700_000_000_000); //already ms
        expect(parseStatBoundaryLoose(1_700_000_000)).toBe(1_700_000_000_000);     //seconds -> ms
    });

    it('handles numeric-string epochs and ISO strings', () =>
    {
        expect(parseStatBoundaryLoose('1700000000')).toBe(1_700_000_000_000);
        expect(parseStatBoundaryLoose('1700000000000')).toBe(1_700_000_000_000);
        expect(parseStatBoundaryLoose('2024-01-01T00:00:00Z')).toBe(Date.parse('2024-01-01T00:00:00Z'));
        expect(parseStatBoundaryLoose(null)).toBeNull();
        expect(parseStatBoundaryLoose(undefined)).toBeNull();
    });
});

describe('outlierCapKwh', () =>
{
    it('is Infinity when there is nothing to compare against', () =>
    {
        expect(outlierCapKwh(null)).toBe(Infinity);
        expect(outlierCapKwh([])).toBe(Infinity);
        expect(outlierCapKwh([bucket(0, 0), bucket(1, 0)])).toBe(Infinity); //zeros filtered out
    });

    it('caps at 20x the p90 magnitude and uses absolute value', () =>
    {
        //mags [2, 4] -> p90 index min(1, floor(2*0.9)=1) = 1 -> 4 -> cap 80.
        expect(outlierCapKwh([bucket(0, 2), bucket(1, -4)])).toBe(80);
    });
});

describe('mergeChangeSeries', () =>
{
    it('sums per bucket start across ids and sorts ascending', () =>
    {
        const byId = { a: [bucket(0, 1), bucket(1, 2)], b: [bucket(0, 10)] };
        expect(mergeChangeSeries(byId, ['a', 'b'])).toEqual([
            { startMs: 0, endMs: HOUR_MS, kwh: 11 },
            { startMs: HOUR_MS, endMs: 2 * HOUR_MS, kwh: 2 },
        ]);
    });

    it('ignores absent ids and returns null when nothing matches', () =>
    {
        expect(mergeChangeSeries({ a: [bucket(0, 1)] }, ['a', 'missing'])).toEqual([{ startMs: 0, endMs: HOUR_MS, kwh: 1 }]);
        expect(mergeChangeSeries({}, ['x'])).toBeNull();
    });
});

describe('extractPerEntity', () =>
{
    it('keeps only ids the recorder returned, in the requested order', () =>
    {
        const byId = { a: [bucket(0, 1)], b: [bucket(0, 2)] };
        const out  = extractPerEntity(byId, ['b', 'a', 'c']);
        expect([...out.keys()]).toEqual(['b', 'a']);
        expect(out.has('c')).toBe(false);
    });
});

describe('sumChangeForDay', () =>
{
    it('sums buckets whose start falls in the day, excluding the day end', () =>
    {
        const buckets = [bucket(0, 1), bucket(1, 2), { startMs: DAY_MS, endMs: DAY_MS + HOUR_MS, kwh: 5 }];
        expect(sumChangeForDay(buckets, 0, DAY_MS)).toBe(3);
    });

    it('is null when no bucket falls in the day', () =>
    {
        expect(sumChangeForDay([bucket(0, 1)], DAY_MS, 2 * DAY_MS)).toBeNull();
        expect(sumChangeForDay(null, 0, DAY_MS)).toBeNull();
    });
});

describe('changeSeriesToWatts', () =>
{
    it('returns all nulls for an empty series', () =>
    {
        expect(changeSeriesToWatts(null, 0, HOUR_MS, 3, 3 * HOUR_MS)).toEqual([null, null, null]);
    });

    it('converts kWh per bucket into average watts (kWh * 1000 / hours)', () =>
    {
        //Three adjacent hourly reports: dense meter, coarse-smoothing is inert (span 1).
        const out = changeSeriesToWatts([bucket(0, 1), bucket(1, 2), bucket(2, 3)], 0, HOUR_MS, 4, 4 * HOUR_MS);
        expect(out).toEqual([1000, 2000, 3000, null]);
    });

    it('drops buckets before the store window and at/after now', () =>
    {
        const buckets = [bucket(-1, 5), bucket(0, 1), bucket(2, 9)];
        const out     = changeSeriesToWatts(buckets, 0, HOUR_MS, 3, 2 * HOUR_MS); //now at bucket 2 start
        expect(out).toEqual([1000, null, null]);
    });

    it('rejects a reset/rollover spike above the outlier cap', () =>
    {
        //Ten unit buckets set the p90 at 1 (cap 20); the eleventh dumps a lifetime total and is dropped.
        const buckets: Bucket[] = [];
        for (let i = 0; i < 10; i++) { buckets.push(bucket(i, 1)); }
        buckets.push(bucket(10, 1000));
        const out = changeSeriesToWatts(buckets, 0, HOUR_MS, 11, 11 * HOUR_MS);
        expect(out[0]).toBe(1000);
        expect(out[10]).toBeNull(); //spike rejected, bucket left empty
    });
});
