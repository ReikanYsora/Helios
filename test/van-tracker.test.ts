import { describe, it, expect } from 'vitest';
import { haversineDistanceM, bearingDeg, deriveSpeedMps, deriveHeadingDeg, type VanFix } from '../src/data/sources/van-tracker';

describe('haversineDistanceM', () =>
{
    it('measures ~111.32 km per degree of latitude (matches this codebase\'s METRES_PER_DEGREE)', () =>
    {
        expect(haversineDistanceM(0, 0, 1, 0)).toBeCloseTo(111320, -2);
    });

    it('measures ~111.32 km per degree of longitude at the equator', () =>
    {
        expect(haversineDistanceM(0, 0, 0, 1)).toBeCloseTo(111320, -2);
    });

    it('returns 0 for the same point', () =>
    {
        expect(haversineDistanceM(40.7, -74, 40.7, -74)).toBeCloseTo(0, 6);
    });
});

describe('bearingDeg', () =>
{
    it('reads due north as 0', () =>
    {
        expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 3);
    });
    it('reads due east as 90', () =>
    {
        expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 3);
    });
    it('reads due south as 180', () =>
    {
        expect(bearingDeg(1, 0, 0, 0)).toBeCloseTo(180, 3);
    });
    it('reads due west as 270', () =>
    {
        expect(bearingDeg(0, 1, 0, 0)).toBeCloseTo(270, 3);
    });
});

describe('deriveSpeedMps', () =>
{
    it('is null with fewer than 2 fixes', () =>
    {
        expect(deriveSpeedMps([])).toBeNull();
        expect(deriveSpeedMps([{ lat: 0, lon: 0, tMs: 0 }])).toBeNull();
    });

    it('is null when the oldest/newest fixes are under the 2s gate', () =>
    {
        const fixes: VanFix[] = [{ lat: 0, lon: 0, tMs: 0 }, { lat: 0, lon: 0.001, tMs: 1000 }];
        expect(deriveSpeedMps(fixes)).toBeNull();
    });

    it('computes distance/time across the oldest vs newest fix (100m in 10s = 10 m/s)', () =>
    {
        //~0.0008983 deg longitude at the equator is ~100m.
        const fixes: VanFix[] = [
            { lat: 0, lon: 0,          tMs: 0 },
            { lat: 0, lon: 0.00044915, tMs: 5000 },  //ignored (not oldest/newest)
            { lat: 0, lon: 0.0008983,  tMs: 10000 },
        ];
        expect(deriveSpeedMps(fixes)).toBeCloseTo(10, 0);
    });
});

describe('deriveHeadingDeg', () =>
{
    it('is null with fewer than 2 fixes', () =>
    {
        expect(deriveHeadingDeg([{ lat: 0, lon: 0, tMs: 0 }])).toBeNull();
    });

    it('is null when the oldest/newest fixes are under the 2m movement gate', () =>
    {
        const fixes: VanFix[] = [{ lat: 0, lon: 0, tMs: 0 }, { lat: 0.0000001, lon: 0, tMs: 5000 }];
        expect(deriveHeadingDeg(fixes)).toBeNull();
    });

    it('reads the bearing between the oldest and newest fix (due east)', () =>
    {
        const fixes: VanFix[] = [{ lat: 0, lon: 0, tMs: 0 }, { lat: 0, lon: 0.001, tMs: 5000 }];
        expect(deriveHeadingDeg(fixes)).toBeCloseTo(90, 0);
    });
});
