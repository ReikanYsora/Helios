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

describe('latestCostRate on a coarse meter (flat newest bucket)', () =>
{
    const MIN = 60_000;
    //A stepped *_cost sensor as HA derives it from a 15-minute meter recorded at 5-minute resolution: the meter
    //reports once, then two buckets pass with no change, then it reports again. Newest bucket is flat.
    function steppedSeries(): ChangeBucket[]
    {
        const out: ChangeBucket[] = [];
        for (let i = 12; i >= 1; i--)
        {
            const endMs = NOW - (i - 1) * 5 * MIN;
            //Movement lands every third bucket: 0.0625 currency per 15 min = 0.25/h.
            out.push({ startMs: endMs - 5 * MIN, endMs, kwh: i % 3 === 0 ? 0.0625 : 0 });
        }
        return out;
    }

    it('does not publish the flat bucket as a zero rate', () =>
    {
        //Before: the newest bucket is Δ0, so the chip read 0.00/h between meter reports even while importing.
        const rate = latestCostRate(host(steppedSeries()), NOW);
        expect(rate).not.toBeNull();
        expect(rate).not.toBe(0);
    });

    it('averages the coarse window like the scrub path, so it reads the true rate', () =>
    {
        //0.0625 per 15 min is 0.25/h; the window average must land there, not on the flat bucket's 0.
        expect(latestCostRate(host(steppedSeries()), NOW)).toBeCloseTo(0.25, 6);
    });

    it('still reads a genuinely idle meter as zero', () =>
    {
        //Every bucket flat: no sampling artefact to correct, and no rate to invent. The window averages to 0.
        const idle = steppedSeries().map((b) => ({ ...b, kwh: 0 }));
        expect(latestCostRate(host(idle), NOW)).toBe(0);
    });

    it('nets import against export across the window', () =>
    {
        //Import 0.25/h and export 0.10/h on the same coarse cadence: net spend is 0.15/h.
        const exp = steppedSeries().map((b) => ({ ...b, kwh: b.kwh * 0.4 }));
        expect(latestCostRate(host(steppedSeries(), exp), NOW)).toBeCloseTo(0.15, 6);
    });

    it('leaves the dense-meter path untouched', () =>
    {
        //A fine meter with a non-flat newest bucket takes the original single-bucket read: 2.5 currency/h.
        expect(latestCostRate(host([bucket(0, 2.5)]), NOW)).toBeCloseTo(2.5, 6);
    });

    //A fine meter that moves every bucket. Its newest zero is REAL - import just stopped - and must be reported now,
    //not averaged away with the activity that preceded it. This is the transition case a naive average gets wrong.
    function denseSeriesThenStop(): ChangeBucket[]
    {
        const out: ChangeBucket[] = [];
        for (let i = 12; i >= 2; i--)
        {
            const endMs = NOW - (i - 1) * 5 * MIN;
            out.push({ startMs: endMs - 5 * MIN, endMs, kwh: 0.5 / 12 });   //0.5/h, every bucket
        }
        out.push({ startMs: NOW - 5 * MIN, endMs: NOW, kwh: 0 });          //then it stops
        return out;
    }

    it('keeps a genuine newest zero on a dense meter (import just stopped)', () =>
    {
        //Every earlier bucket in the window is nonzero, so this meter is dense: the flat newest bucket is real news.
        expect(latestCostRate(host(denseSeriesThenStop()), NOW)).toBe(0);
    });

    it('does not let a dense export series vote a sparse import series into a zero', () =>
    {
        //Import is coarse (flat newest bucket, sparse window); export is dense and has just stopped. The import
        //side must still be averaged rather than the whole chip collapsing to 0 because one side is dense.
        const rate = latestCostRate(host(steppedSeries(), denseSeriesThenStop()), NOW);
        expect(rate).not.toBeNull();
        expect(rate).toBeGreaterThan(0);
    });
});
