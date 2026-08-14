import { describe, it, expect } from 'vitest';
import { resolveWeatherAtTime } from '../src/data/weather-resolve';
import type { SampleHourly } from '../src/data/weather';

//Two bracketing hours (10:00 and 11:00 UTC). Continuous fields interpolate; categorical code + precip/snow take the
//nearer hour; the -1 irradiance and NaN temp/humidity sentinels are guarded. This mirrors the integration's
//forecast interpolation, so the scene and the graphs agree between the hours (recently moved off nearest-hour).
function fixture(over: Partial<SampleHourly> = {}): SampleHourly
{
    return {
        lat:         0,
        lon:         0,
        times:       [new Date('2024-06-01T10:00:00Z'), new Date('2024-06-01T11:00:00Z')],
        cloudCover:  [20, 40],
        cloudLow:    [10, 30],
        cloudMid:    [5, 15],
        cloudHigh:   [0, 20],
        shortwave:   [200, 400],
        precip:      [0, 2],
        snowfall:    [0, 1],
        weatherCode: [1, 63],
        temperature: [10, 20],
        humidity:    [50, 70],
        ...over,
    };
}

describe('resolveWeatherAtTime', () =>
{
    it('returns the flat empty sentinel when there is no forecast', () =>
    {
        const w = resolveWeatherAtTime(null, new Date('2024-06-01T10:30:00Z'));
        expect(w.cloudCover).toBe(0);
        expect(w.shortwave).toBe(-1);
        expect(Number.isNaN(w.temperature)).toBe(true);
        expect(Number.isNaN(w.humidity)).toBe(true);
    });

    it('reads the exact hour on the boundary', () =>
    {
        const w = resolveWeatherAtTime(fixture(), new Date('2024-06-01T10:00:00Z'));
        expect(w.cloudCover).toBe(13); //cloudEffective(10, 5, 0) = 10 + 0.6*5 + 0.2*0
        expect(w.shortwave).toBe(200);
        expect(w.temperature).toBe(10);
        expect(w.weatherCode).toBe(1);
    });

    it('linearly interpolates continuous fields between the hours', () =>
    {
        const w = resolveWeatherAtTime(fixture(), new Date('2024-06-01T10:15:00Z')); //f = 0.25
        expect(w.cloudLow).toBeCloseTo(15, 6); //raw layer, linear
        expect(w.temperature).toBeCloseTo(12.5, 6);
        expect(w.shortwave).toBeCloseTo(250, 6);
    });

    it('recomputes the effective cloud from the interpolated layers, not by interpolating the effective', () =>
    {
        //Hour 1 layers 100/100/100 -> raw 180, clamped to 100. At the midpoint the layers are 50/50/50 ->
        //effective 50 + 30 + 10 = 90; interpolating the clamped effective (0 -> 100) would wrongly give 50.
        const clamped = fixture({ cloudLow: [0, 100], cloudMid: [0, 100], cloudHigh: [0, 100], cloudCover: [0, 100] });
        expect(resolveWeatherAtTime(clamped, new Date('2024-06-01T10:30:00Z')).cloudCover).toBe(90);
    });

    it('takes the nearer hour for the categorical code and precip/snow', () =>
    {
        //f = 0.25 -> nearer is the first hour.
        const early = resolveWeatherAtTime(fixture(), new Date('2024-06-01T10:15:00Z'));
        expect(early.weatherCode).toBe(1);
        expect(early.precip).toBe(0);
        //f = 0.5 rounds to the later hour (f < 0.5 is false).
        const mid = resolveWeatherAtTime(fixture(), new Date('2024-06-01T10:30:00Z'));
        expect(mid.weatherCode).toBe(63);
        expect(mid.precip).toBe(2);
    });

    it('clamps to the first hour before the range and the last hour after it', () =>
    {
        const before = resolveWeatherAtTime(fixture(), new Date('2024-06-01T09:00:00Z'));
        expect(before.cloudCover).toBe(13); //cloudEffective of hour 0 layers (10, 5, 0)
        const after = resolveWeatherAtTime(fixture(), new Date('2024-06-01T12:00:00Z'));
        expect(after.cloudCover).toBe(43);  //cloudEffective of hour 1 layers (30, 15, 20)
        expect(after.temperature).toBe(20);
    });

    it('drops a -1 irradiance bound instead of blending toward it', () =>
    {
        const at1030 = new Date('2024-06-01T10:30:00Z');
        expect(resolveWeatherAtTime(fixture({ shortwave: [-1, 400] }), at1030).shortwave).toBe(400);
        expect(resolveWeatherAtTime(fixture({ shortwave: [200, -1] }), at1030).shortwave).toBe(200);
        expect(resolveWeatherAtTime(fixture({ shortwave: [-1, -1] }), at1030).shortwave).toBe(-1);
    });

    it('drops a NaN temperature/humidity bound instead of blending toward it', () =>
    {
        const at1030 = new Date('2024-06-01T10:30:00Z');
        expect(resolveWeatherAtTime(fixture({ temperature: [NaN, 20] }), at1030).temperature).toBe(20);
        expect(resolveWeatherAtTime(fixture({ temperature: [10, NaN] }), at1030).temperature).toBe(10);
        expect(Number.isNaN(resolveWeatherAtTime(fixture({ humidity: [NaN, NaN] }), at1030).humidity)).toBe(true);
    });
});
