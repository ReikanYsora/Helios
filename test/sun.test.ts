import { describe, it, expect } from 'vitest';
import { getSunPosition, computeIrradianceWm2, computePvPercent } from '../src/core/time/sun';

//Parity anchors: getSunPosition (declination + equation-of-time model) and the Haurwitz x Kasten-Czeplak irradiance
//are duplicated byte-for-byte in the Python integration. These invariants pin the shared physics so a refactor on
//either side that drifts is caught here.

const PARIS = { lat: 48.8566, lon: 2.3522 };

describe('getSunPosition', () =>
{
    it('puts the sun below the horizon at local night', () =>
    {
        //02:00 UTC on 1 Jan over Paris: deep night, sun well down.
        const { altitude, azimuth } = getSunPosition(new Date('2024-01-01T02:00:00Z'), PARIS.lat, PARIS.lon);
        expect(altitude).toBeLessThan(0);
        expect(azimuth).toBeGreaterThanOrEqual(0);
        expect(azimuth).toBeLessThan(360);
    });

    it('reaches near-zenith at the equator at equinox solar noon', () =>
    {
        //Equator, ~equinox, ~solar noon at lon 0: altitude should be within a couple of degrees of 90.
        const { altitude } = getSunPosition(new Date('2024-03-20T12:00:00Z'), 0, 0);
        expect(altitude).toBeGreaterThan(85);
        expect(altitude).toBeLessThanOrEqual(90);
    });

    it('is deterministic for the same instant and location (single-entry cache)', () =>
    {
        const a = getSunPosition(new Date('2024-06-21T10:00:00Z'), PARIS.lat, PARIS.lon);
        const b = getSunPosition(new Date('2024-06-21T10:00:00Z'), PARIS.lat, PARIS.lon);
        expect(a).toEqual(b);
    });
});

describe('computeIrradianceWm2', () =>
{
    const noon = new Date('2024-03-20T12:00:00Z');

    it('returns 0 below the horizon (night sentinel)', () =>
    {
        expect(computeIrradianceWm2(new Date('2024-01-01T02:00:00Z'), PARIS.lat, PARIS.lon, 0)).toBe(0);
    });

    it('gives a physical clear-sky peak near solar noon at the equator', () =>
    {
        const ghi = computeIrradianceWm2(noon, 0, 0, 0);
        expect(ghi).toBeGreaterThan(980);
        expect(ghi).toBeLessThan(1080);
    });

    it('attenuates monotonically with cloud cover', () =>
    {
        const clear = computeIrradianceWm2(noon, 0, 0, 0);
        const half  = computeIrradianceWm2(noon, 0, 0, 50);
        const solid = computeIrradianceWm2(noon, 0, 0, 100);
        expect(clear).toBeGreaterThan(half);
        expect(half).toBeGreaterThan(solid);
    });

    it('applies the Kasten-Czeplak factor exactly (overcast keeps 25%)', () =>
    {
        //kCloud = 1 - 0.75 * cc^3.4; at cc = 1 that is 0.25, so full overcast is exactly a quarter of clear-sky.
        const clear = computeIrradianceWm2(noon, 0, 0, 0);
        const solid = computeIrradianceWm2(noon, 0, 0, 100);
        expect(solid / clear).toBeCloseTo(0.25, 6);
    });
});

describe('computePvPercent', () =>
{
    it('is 0 at night and clamps to 100 under a strong clear-sky sun', () =>
    {
        expect(computePvPercent(new Date('2024-01-01T02:00:00Z'), PARIS.lat, PARIS.lon, 0)).toBe(0);
        expect(computePvPercent(new Date('2024-03-20T12:00:00Z'), 0, 0, 0)).toBe(100);
    });

    it('tracks irradiance / 10 below the clamp', () =>
    {
        const t = new Date('2024-03-20T12:00:00Z');
        const wm2 = computeIrradianceWm2(t, 0, 0, 100); //~260 W/m2 -> 26 %, under the clamp
        expect(computePvPercent(t, 0, 0, 100)).toBeCloseTo(Math.min(100, wm2 / 10), 6);
    });
});
