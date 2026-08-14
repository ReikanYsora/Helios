import { describe, it, expect } from 'vitest';
import { computeDailyKwhTotals } from '../src/charts/charts-generic';
import type { ChartHost } from '../src/charts/charts';

//The tooltip calls computeDailyKwhTotals on every pointermove; it depends only on the range + data, so it is
//memoised. These pin both the per-day sum (Pass 1, recorder change buckets) and the memo hit/miss behaviour.

const HOUR = 3_600_000;
const todayMidnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

function host(pv: { startMs: number; endMs: number; kwh: number }[]): ChartHost
{
    const mid = todayMidnight();
    return {
        _timeRange:       { start: new Date(mid), end: new Date(mid + 24 * HOUR) },
        _pvChangeSeries:  pv,
        _unifiedStore:    null, //Pass 2 (forecast) skipped, so this isolates the recorder-change sum
    } as unknown as ChartHost;
}

describe('computeDailyKwhTotals', () =>
{
    it('sums the recorder change buckets into the day they fall in', () =>
    {
        const mid = todayMidnight();
        const totals = computeDailyKwhTotals(host([
            { startMs: mid + 9 * HOUR, endMs: mid + 10 * HOUR, kwh: 2 },
            { startMs: mid + 13 * HOUR, endMs: mid + 14 * HOUR, kwh: 3 },
        ]));
        expect(totals.get(mid)).toBe(5);
        expect(totals.size).toBe(1);
    });

    it('returns the same cached instance for an unchanged host, a fresh one when the data changes', () =>
    {
        const mid = todayMidnight();
        const h = host([{ startMs: mid + 9 * HOUR, endMs: mid + 10 * HOUR, kwh: 2 }]);
        const a = computeDailyKwhTotals(h);
        const b = computeDailyKwhTotals(h);
        expect(b).toBe(a); //memo hit: identical instance

        const c = computeDailyKwhTotals(host([
            { startMs: mid + 9 * HOUR, endMs: mid + 10 * HOUR, kwh: 2 },
            { startMs: mid + 15 * HOUR, endMs: mid + 16 * HOUR, kwh: 4 },
        ]));
        expect(c).not.toBe(a);     //memo miss: pv series changed
        expect(c.get(mid)).toBe(6);
    });
});
