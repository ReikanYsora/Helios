import { describe, it, expect } from 'vitest';
import { getMoonPosition, getMoonPhase } from '../src/core/time/moon';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const DAY_MS = 24 * 60 * 60 * 1000;

describe('getMoonPosition', () =>
{
    it('returns an altitude/azimuth in valid physical ranges', () =>
    {
        const { altitude, azimuth } = getMoonPosition(new Date('2024-06-21T10:00:00Z'), PARIS.lat, PARIS.lon);
        expect(altitude).toBeGreaterThanOrEqual(-90);
        expect(altitude).toBeLessThanOrEqual(90);
        expect(azimuth).toBeGreaterThanOrEqual(0);
        expect(azimuth).toBeLessThan(360);
    });

    it('is deterministic for the same instant and location (single-entry cache)', () =>
    {
        const a = getMoonPosition(new Date('2024-06-21T10:00:00Z'), PARIS.lat, PARIS.lon);
        const b = getMoonPosition(new Date('2024-06-21T10:00:00Z'), PARIS.lat, PARIS.lon);
        expect(a).toEqual(b);
    });

    it('moves noticeably over a few hours (the moon is not pinned like a fixed star)', () =>
    {
        const a = getMoonPosition(new Date('2024-06-21T00:00:00Z'), PARIS.lat, PARIS.lon);
        const b = getMoonPosition(new Date('2024-06-21T06:00:00Z'), PARIS.lat, PARIS.lon);
        expect(Math.abs(a.azimuth - b.azimuth)).toBeGreaterThan(1);
    });
});

//getMoonPhase is validated by internal consistency (period, bounds, waxing/waning agreeing with the fraction's own
//trend) rather than against one hand-picked reference date: that keeps the test honest about what the low-precision
//model actually guarantees (see moon.ts's own doc comment) without betting the suite on a memorised almanac date.
describe('getMoonPhase', () =>
{
    const start = new Date('2024-01-01T00:00:00Z').getTime();
    const scan = (days: number) => Array.from({ length: days }, (_, i) => getMoonPhase(new Date(start + i * DAY_MS)));

    it('keeps the illuminated fraction within [0, 1]', () =>
    {
        for (const p of scan(120))
        {
            expect(p.fraction).toBeGreaterThanOrEqual(0);
            expect(p.fraction).toBeLessThanOrEqual(1);
        }
    });

    it('reaches both a near-new and a near-full moon within one synodic month', () =>
    {
        const fractions = scan(31).map((p) => p.fraction);
        expect(Math.min(...fractions)).toBeLessThan(0.03);
        expect(Math.max(...fractions)).toBeGreaterThan(0.97);
    });

    it('two consecutive full moons are ~29.53 days apart (the real synodic month)', () =>
    {
        const days = scan(70);
        const peak = (from: number, to: number) =>
        {
            let bestI = from, bestV = -1;
            for (let i = from; i < to; i++)
            {
                if (days[i].fraction > bestV)
                {
                    bestV = days[i].fraction; bestI = i;
                }
            }
            return bestI;
        };
        const firstFull  = peak(0, 32);
        const secondFull = peak(firstFull + 20, 70);
        expect(secondFull - firstFull).toBeGreaterThan(28);
        expect(secondFull - firstFull).toBeLessThan(31);
    });

    it('waxes right after a new moon and wanes right after a full moon', () =>
    {
        const days = scan(70);
        let newMoonI = 0, newMoonV = 2;
        let fullMoonI = 0, fullMoonV = -1;
        for (let i = 0; i < days.length; i++)
        {
            if (days[i].fraction < newMoonV)
            {
                newMoonV = days[i].fraction; newMoonI = i;
            }
            if (days[i].fraction > fullMoonV)
            {
                fullMoonV = days[i].fraction; fullMoonI = i;
            }
        }
        expect(days[newMoonI + 2].waxing).toBe(true);
        expect(days[fullMoonI + 2].waxing).toBe(false);
    });

    it('the fraction trend agrees with the waxing flag day over day', () =>
    {
        const days = scan(60);
        let agree = 0;
        for (let i = 1; i < days.length; i++)
        {
            const rising = days[i].fraction >= days[i - 1].fraction;
            if (rising === days[i].waxing)
            {
                agree++;
            }
        }
        //Allow a couple of near-flat days around the exact new/full turning points to disagree on direction.
        expect(agree).toBeGreaterThanOrEqual(days.length - 1 - 4);
    });
});
