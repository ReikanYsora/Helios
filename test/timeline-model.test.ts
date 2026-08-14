import { describe, it, expect } from 'vitest';
import { buildTimelineModel } from '../src/timeline/timeline-model';

const HOUR = 3_600_000;

//buildTimelineModel is a pure function of (start, end, maxTicks) and is asked for the same window several times
//per render, so it is memoised. Pin the cache hit/miss behaviour; the model itself is consumed read-only.

describe('buildTimelineModel memo', () =>
{
    it('returns the same instance for the same window and a fresh one when it changes', () =>
    {
        const start = new Date('2024-06-01T00:00:00Z');
        const end   = new Date(start.getTime() + 24 * HOUR);
        const a = buildTimelineModel(start, end);
        const b = buildTimelineModel(new Date(start.getTime()), new Date(end.getTime())); //equal values, new Dates
        expect(b).toBe(a); //memo hit keys on the ms values, not the Date identity

        const c = buildTimelineModel(start, new Date(end.getTime() + 24 * HOUR));
        expect(c).not.toBe(a); //window changed
    });

    it('produces a usable model (dayBoundaries array)', () =>
    {
        const start = new Date('2024-06-01T00:00:00Z');
        const model = buildTimelineModel(start, new Date(start.getTime() + 3 * 24 * HOUR));
        expect(Array.isArray(model.dayBoundaries)).toBe(true);
    });
});
