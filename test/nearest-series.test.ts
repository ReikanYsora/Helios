import { describe, it, expect } from 'vitest';
import { buildTimeSamples, timeSamplesEqual, nearestSampleAt } from '../src/core/nearest-series';

type Raw = { t: number; val: number };
const time = (s: Raw) => s.t;
const val = (s: Raw) => s.val;

describe('buildTimeSamples', () =>
{
    it('sorts ascending and maps to {tMs, v}', () =>
    {
        expect(buildTimeSamples([{ t: 2, val: 20 }, { t: 1, val: 10 }], time, val, () => true))
            .toEqual([{ tMs: 1, v: 10 }, { tMs: 2, v: 20 }]);
    });

    it('drops non-finite time or value and applies accept', () =>
    {
        const raw = [{ t: NaN, val: 5 }, { t: 1, val: Infinity }, { t: 2, val: -5 }, { t: 3, val: 30 }];
        expect(buildTimeSamples(raw, time, val, (v) => v >= 0)).toEqual([{ tMs: 3, v: 30 }]);
    });

    it('returns null for empty, missing, or fully-dropped input', () =>
    {
        expect(buildTimeSamples(null, time, val, () => true)).toBeNull();
        expect(buildTimeSamples([], time, val, () => true)).toBeNull();
        expect(buildTimeSamples([{ t: 1, val: -5 }], time, val, (v) => v >= 0)).toBeNull();
    });
});

describe('timeSamplesEqual', () =>
{
    it('compares element-wise with an identity fast-path and null handling', () =>
    {
        const a = [{ tMs: 1, v: 10 }, { tMs: 2, v: 20 }];
        expect(timeSamplesEqual(a, a)).toBe(true);
        expect(timeSamplesEqual(a, [{ tMs: 1, v: 10 }, { tMs: 2, v: 20 }])).toBe(true);
        expect(timeSamplesEqual(a, [{ tMs: 1, v: 10 }, { tMs: 2, v: 21 }])).toBe(false);
        expect(timeSamplesEqual(a, [{ tMs: 1, v: 10 }])).toBe(false);
        expect(timeSamplesEqual(a, null)).toBe(false);
        expect(timeSamplesEqual(null, null)).toBe(true);
    });
});

describe('nearestSampleAt', () =>
{
    const samples = [{ tMs: 0, v: 10 }, { tMs: 100, v: 20 }, { tMs: 300, v: 40 }];

    it('returns the value of the nearest sample inside the window', () =>
    {
        expect(nearestSampleAt(samples, 90, 50)).toBe(20); //nearest is tMs 100 (delta 10)
        expect(nearestSampleAt(samples, 0, 50)).toBe(10);
    });

    it('returns null when the nearest sample is outside the window', () =>
    {
        expect(nearestSampleAt(samples, 90, 5)).toBeNull();   //delta 10 > window 5
        expect(nearestSampleAt(samples, 400, 50)).toBeNull(); //delta 100 > 50
    });

    it('returns null for an empty or missing series', () =>
    {
        expect(nearestSampleAt(null, 0, 50)).toBeNull();
        expect(nearestSampleAt([], 0, 50)).toBeNull();
    });
});
