import { describe, it, expect } from 'vitest';
import { buildTimelineModel } from '../src/timeline/timeline-model';

const HOUR = 3_600_000;

//buildTimelineModel is a pure function of (start, end, maxTicks) and is asked for the same window several times
//per render, so it is memoised. Pin the cache hit/miss behaviour; the model itself is consumed read-only.

describe('buildTimelineModel memo', () =>
{
    it('returns the same instance for the same window and a fresh one when it changes', () =>
    {
        const host  = {}; //cache key only - the model never reads anything off it, see timeline-model.ts
        const start = new Date('2024-06-01T00:00:00Z');
        const end   = new Date(start.getTime() + 24 * HOUR);
        const a = buildTimelineModel(host, start, end);
        const b = buildTimelineModel(host, new Date(start.getTime()), new Date(end.getTime())); //equal values, new Dates
        expect(b).toBe(a); //memo hit keys on the ms values, not the Date identity

        const c = buildTimelineModel(host, start, new Date(end.getTime() + 24 * HOUR));
        expect(c).not.toBe(a); //window changed
    });

    it('keeps separate cache slots per host', () =>
    {
        const start = new Date('2024-06-01T00:00:00Z');
        const end   = new Date(start.getTime() + 24 * HOUR);
        const a = buildTimelineModel({}, start, end);
        const b = buildTimelineModel({}, start, end); //same window, different host identity
        expect(b).not.toBe(a); //no cross-host cache hit
        expect(b).toEqual(a);  //same content regardless
    });

    it('produces a usable model (dayBoundaries array)', () =>
    {
        const start = new Date('2024-06-01T00:00:00Z');
        const model = buildTimelineModel({}, start, new Date(start.getTime() + 3 * 24 * HOUR));
        expect(Array.isArray(model.dayBoundaries)).toBe(true);
    });
});
