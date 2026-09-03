import { describe, it, expect } from 'vitest';
import { bucketizeWeatherAvg, buildUnifiedStore, type UnifiedStoreHost } from '../src/data/unifiedStore';
import { HOUR_MS } from '../src/core/config/constants';

//Characterises the shared weather bucketizer that backs irradiance / temperature / humidity: per-bucket mean of the
//in-window finite samples, the per-metric `accept` transform, and the gap interpolation.
const P = (bucketsTotal: number) => ({ bucketsPerHour: 1, bucketsTotal, stepMs: HOUR_MS });
const at = (frac: number) => new Date(frac * HOUR_MS);

//The three metric transforms, exactly as the wrappers pass them.
const irradiance = (v: number) => (v < 0 ? null : v);
const temperature = (v: number) => v;
const humidity = (v: number) => Math.max(0, Math.min(100, v));

describe('bucketizeWeatherAvg', () =>
{
    it('averages the samples that fall in each bucket', () =>
    {
        const times  = [at(0), at(0.5), at(1), at(2)];
        const values = [10, 20, 100, 200];
        expect(bucketizeWeatherAvg(times, values, 0, 3 * HOUR_MS, P(3), irradiance)).toEqual([15, 100, 200]);
    });

    it('drops negative irradiance samples before averaging', () =>
    {
        //-5 is dropped, so the bucket mean is 20 (not 7.5).
        expect(bucketizeWeatherAvg([at(0), at(0.5)], [-5, 20], 0, HOUR_MS, P(1), irradiance)).toEqual([20]);
    });

    it('clamps humidity to 0..100 and keeps sub-zero temperature', () =>
    {
        expect(bucketizeWeatherAvg([at(0), at(0.5)], [150, -10], 0, HOUR_MS, P(1), humidity)).toEqual([50]);
        expect(bucketizeWeatherAvg([at(0), at(0.5)], [-10, 10], 0, HOUR_MS, P(1), temperature)).toEqual([0]);
    });

    it('skips non-finite samples', () =>
    {
        expect(bucketizeWeatherAvg([at(0), at(0.5)], [NaN, 20], 0, HOUR_MS, P(1), temperature)).toEqual([20]);
    });

    it('excludes samples outside the store window', () =>
    {
        expect(bucketizeWeatherAvg([at(-1), at(0)], [999, 10], 0, HOUR_MS, P(1), temperature)).toEqual([10]);
    });

    it('linearly interpolates an interior gap', () =>
    {
        //Buckets [15, null, 200] -> the middle fills to the midpoint.
        const times  = [at(0), at(0.5), at(2)];
        const values = [10, 20, 200];
        expect(bucketizeWeatherAvg(times, values, 0, 3 * HOUR_MS, P(3), irradiance)).toEqual([15, 107.5, 200]);
    });

    it('returns all-null for missing series', () =>
    {
        expect(bucketizeWeatherAvg(undefined, undefined, 0, HOUR_MS, P(2), temperature)).toEqual([null, null]);
        expect(bucketizeWeatherAvg([], [], 0, HOUR_MS, P(2), temperature)).toEqual([null, null]);
    });
});

//Minimal, otherwise-empty host: enough for computeDataVersion's window/cadence/content terms to resolve without
//throwing, so each test only has to vary the one field it's characterising.
function baseHost(overrides: Partial<UnifiedStoreHost>): UnifiedStoreHost
{
    return {
        config:                          undefined,
        _periodPastDays:                 0,
        _periodFutureDays:               0,
        _timelineMode:                   'today',
        _chartSeries:                    null,
        _pvChangeSeries:                 null,
        _batteryChargeChangeSeries:      null,
        _batteryDischargeChangeSeries:   null,
        _gridImportChangeSeries:         null,
        _gridExportChangeSeries:         null,
        _haSolarForecast:                [],
        _haSolarForecastFetchedAt:       0,
        ...overrides,
    };
}

//Regression coverage for the forecast half of computeDataVersion (via buildUnifiedStore's dataVersion output): a
//provider that refreshes its past-hour estimates in place, without the point COUNT changing, must still invalidate
//the store. Length alone is blind to that; the fetch timestamp is what catches it (Helios-Forecast #52).
describe('buildUnifiedStore data version (forecast in-place revision)', () =>
{
    it('changes when the forecast array is refetched, even at the same length', () =>
    {
        const forecastA = [{ tMs: 0, w: 100 }, { tMs: HOUR_MS, w: 200 }];
        const forecastB = [{ tMs: 0, w: 150 }, { tMs: HOUR_MS, w: 250 }]; //same length, revised values

        const v1 = buildUnifiedStore(baseHost({ _haSolarForecast: forecastA, _haSolarForecastFetchedAt: 1000 })).dataVersion;
        const v2 = buildUnifiedStore(baseHost({ _haSolarForecast: forecastB, _haSolarForecastFetchedAt: 2000 })).dataVersion;

        expect(v2).not.toBe(v1);
    });

    it('stays identical when nothing about the forecast changed (no spurious rebuild)', () =>
    {
        const forecast = [{ tMs: 0, w: 100 }, { tMs: HOUR_MS, w: 200 }];

        const v1 = buildUnifiedStore(baseHost({ _haSolarForecast: forecast, _haSolarForecastFetchedAt: 1000 })).dataVersion;
        const v2 = buildUnifiedStore(baseHost({ _haSolarForecast: forecast, _haSolarForecastFetchedAt: 1000 })).dataVersion;

        expect(v2).toBe(v1);
    });

    it('still changes on a genuine length change (unaffected by the fetch-timestamp addition)', () =>
    {
        const shorter = [{ tMs: 0, w: 100 }];
        const longer  = [{ tMs: 0, w: 100 }, { tMs: HOUR_MS, w: 200 }];

        const v1 = buildUnifiedStore(baseHost({ _haSolarForecast: shorter, _haSolarForecastFetchedAt: 1000 })).dataVersion;
        const v2 = buildUnifiedStore(baseHost({ _haSolarForecast: longer, _haSolarForecastFetchedAt: 1000 })).dataVersion;

        expect(v2).not.toBe(v1);
    });
});
