import { describe, it, expect } from 'vitest';
import { latestCostRate } from '../src/data/sources/cost';
import { COST_STAT_MAX_AGE_MS } from '../src/core/config/constants';
import type { ChangeBucket } from '../src/data/sources/energy-stats';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 7, 14, 22, 0, 0);

//One hourly money bucket ending `endAgoMs` before NOW, carrying `value` currency units.
function bucket(endAgoMs: number, value: number): ChangeBucket
{
    const endMs = NOW - endAgoMs;
    return { startMs: endMs - HOUR, endMs, kwh: value };
}

function host(imp: ChangeBucket[] | null, exp: ChangeBucket[] | null = null): any
{
    return { _costImportSeries: imp, _costExportSeries: exp };
}

describe('latestCostRate freshness gate', () =>
{
    it('uses the newest bucket while it is still recent', () =>
    {
        //A bucket that closed at the top of the current hour: normal, and the rate is its money / its hours.
        expect(latestCostRate(host([bucket(0, 2.5)]), NOW)).toBeCloseTo(2.5, 6);
    });

    it('tolerates the ~1 h of lag inherent to hourly statistics', () =>
    {
        //HA only commits the current hour once it closes, so a 1 h old bucket is the steady state, not staleness.
        expect(latestCostRate(host([bucket(HOUR, 2.5)]), NOW)).toBeCloseTo(2.5, 6);
    });

    it('returns null once the newest bucket is older than the ceiling', () =>
    {
        //A utility integration backfilling yesterday: the last bucket is real, but it is not "now".
        const stale = bucket(16 * HOUR, 2.83);
        expect(latestCostRate(host([stale]), NOW)).toBeNull();
    });

    it('treats the ceiling itself as still fresh, and one step past it as stale', () =>
    {
        expect(latestCostRate(host([bucket(COST_STAT_MAX_AGE_MS, 1)]), NOW)).toBeCloseTo(1, 6);
        expect(latestCostRate(host([bucket(COST_STAT_MAX_AGE_MS + 1, 1)]), NOW)).toBeNull();
    });

    it('nets export compensation off the import cost', () =>
    {
        const rate = latestCostRate(host([bucket(0, 3)], [bucket(0, 1.25)]), NOW);
        expect(rate).toBeCloseTo(1.75, 6);
    });

    it('qualifies on the import series alone when nothing is being exported', () =>
    {
        //No compensation buckets at all must not read as "stale export" and suppress the chip.
        expect(latestCostRate(host([bucket(0, 2)], []), NOW)).toBeCloseTo(2, 6);
        expect(latestCostRate(host([bucket(0, 2)], null), NOW)).toBeCloseTo(2, 6);
    });

    it('fails when EITHER populated direction is stale, not just the newest', () =>
    {
        //The two statistics can update at different cadences. A fresh bucket on one side must not vouch for a
        //stale bucket on the other: netting them would publish the stale side's rate as the live one.
        expect(latestCostRate(host([bucket(16 * HOUR, 3)], [bucket(0, 1)]), NOW)).toBeNull();
        expect(latestCostRate(host([bucket(0, 3)], [bucket(16 * HOUR, 1)]), NOW)).toBeNull();
        //Both fresh still nets normally.
        expect(latestCostRate(host([bucket(0, 3)], [bucket(0, 1)]), NOW)).toBeCloseTo(2, 6);
    });

    it('returns null when no series is loaded at all', () =>
    {
        expect(latestCostRate(host(null, null), NOW)).toBeNull();
        expect(latestCostRate(host([], []), NOW)).toBeNull();
    });

    it('scales a sub-hour bucket to a per-hour rate', () =>
    {
        //5-minute statistics: 0.25 currency over 15 min is 1.00 per hour.
        const endMs = NOW;
        const b: ChangeBucket = { startMs: endMs - 15 * 60_000, endMs, kwh: 0.25 };
        expect(latestCostRate(host([b]), NOW)).toBeCloseTo(1, 6);
    });
});
