import { describe, it, expect } from 'vitest';
import { weatherLayers } from '../src/scene/weather-fx';

//A high sun so the day factor never masks what we are asserting about the precipitation layers.
const base = { cloud: 0, precip: 0, snowfall: 0, code: 0, sunAltitude: 45 };

describe('weatherLayers precipitation floor', () =>
{
    it('does not paint rain from a forecast trace under a clear sky', () =>
    {
        //A cloudless clear-sky code carrying 0.05 mm of "precipitation" is a trace, not rain.
        expect(weatherLayers({ ...base, precip: 0.05, code: 0 }).rain).toBe(0);
        expect(weatherLayers({ ...base, precip: 0.09 }).rain).toBe(0);
    });

    it('still paints real light rain at and above the floor', () =>
    {
        expect(weatherLayers({ ...base, precip: 0.1, code: 61 }).rain).toBeGreaterThan(0);
        expect(weatherLayers({ ...base, precip: 1, code: 63 }).rain).toBeCloseTo(0.5, 5); //sqrt(1)/2
    });

    it('does not paint snow from a snowfall trace, but does at the floor', () =>
    {
        expect(weatherLayers({ ...base, snowfall: 0.05 }).snow).toBe(0);
        expect(weatherLayers({ ...base, snowfall: 0.5, code: 71 }).snow).toBeGreaterThan(0);
    });

    it('lets snow take over from rain when it is snowing', () =>
    {
        const w = weatherLayers({ ...base, precip: 2, snowfall: 1, code: 73 });
        expect(w.rain).toBe(0);
        expect(w.snow).toBeGreaterThan(0);
    });
});
