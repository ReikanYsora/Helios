//localMidnightMinusDays: must land on real LOCAL midnight for every offset, including offsets whose window
//crosses a DST change. A flat `days * 86_400_000` subtraction drifts to 23h / 01h on a DST-observing zone; the
//calendar-day subtraction here always sits at 00:00 local.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { localMidnightMinusDays } from '../src/core/time/timezone';

afterEach(() => { vi.useRealTimers(); });

describe('localMidnightMinusDays', () =>
{
    it('lands on local midnight for every offset, including across a spring-forward', () =>
    {
        vi.useFakeTimers();
        //Just after the European spring-forward (last Sunday of March 2026); offsets of 2-3 days cross it.
        vi.setSystemTime(new Date(2026, 2, 30, 15, 37, 12));
        for (const n of [0, 1, 2, 3, 7, 30, 365])
        {
            const d = new Date(localMidnightMinusDays(n));
            expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0]);
        }
    });

    it('is exactly n calendar days before today (local)', () =>
    {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 6, 10, 9, 0, 0));
        const expected = new Date(); expected.setHours(0, 0, 0, 0); expected.setDate(expected.getDate() - 3);
        expect(localMidnightMinusDays(3)).toBe(expected.getTime());
    });
});
