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
        expect(weatherLayers({ ...base, precip: 1, code: 63 }).rain).toBeCloseTo(0.14375, 5);
    });

    it('does not paint snow from a snowfall trace, but does at the floor', () =>
    {
        expect(weatherLayers({ ...base, snowfall: 0.05 }).snow).toBe(0);
        //A snow code with only a trace of snowfall (< 0.1 cm) draws nothing either: the floor applies to snow too.
        expect(weatherLayers({ ...base, snowfall: 0.05, code: 71 }).snow).toBe(0);
        expect(weatherLayers({ ...base, snowfall: 0.5, code: 71 }).snow).toBeGreaterThan(0);
    });

    it('lets snow take over from rain when it is snowing', () =>
    {
        const w = weatherLayers({ ...base, precip: 2, snowfall: 1, code: 73 });
        expect(w.rain).toBe(0);
        expect(w.snow).toBeGreaterThan(0);
    });
});

describe('weatherLayers precipitation intensity classes', () =>
{
    //Density follows the meteorological intensity classes (WMO / DWD): a trace reads light, and the curve keeps
    //climbing through heavy so a downpour and a violent storm no longer look identical.
    const rain = (precip: number): number => weatherLayers({ ...base, precip, code: 63 }).rain;

    it('renders a trace at the floor as barely-there, not near-full', () =>
    {
        //The old sqrt curve drew 0.1 mm/h at 0.16; a trace should read far lighter than that.
        expect(rain(0.1)).toBeCloseTo(0.05, 5);
        expect(rain(0.1)).toBeLessThan(0.1);
    });

    it('climbs monotonically through the class ceilings', () =>
    {
        expect(rain(2.5)).toBeCloseTo(0.30, 5);   //light ceiling
        expect(rain(10)).toBeCloseTo(0.60, 5);    //moderate ceiling
        expect(rain(50)).toBeCloseTo(1.0, 5);     //violent
        expect(rain(0.1)).toBeLessThan(rain(2.5));
        expect(rain(2.5)).toBeLessThan(rain(10));
        expect(rain(10)).toBeLessThan(rain(50));
    });

    it('no longer saturates in the moderate range', () =>
    {
        //4 mm/h is only "moderate": under the old curve it hit full density and everything above looked the same.
        expect(rain(5)).toBeLessThan(1);
        expect(rain(5)).toBeLessThan(rain(20));
        expect(rain(20)).toBeLessThan(rain(50));
    });

    it('clamps a violent downpour above the top of the scale to full density', () =>
    {
        expect(rain(100)).toBeCloseTo(1.0, 5);
    });

    it('applies the same class shape to snow', () =>
    {
        const snow = (snowfall: number): number => weatherLayers({ ...base, snowfall, code: 73 }).snow;
        expect(snow(0.1)).toBeCloseTo(0.08, 5);
        expect(snow(1)).toBeCloseTo(0.35, 5);
        expect(snow(4)).toBeCloseTo(0.70, 5);
        expect(snow(10)).toBeCloseTo(1.0, 5);
        expect(snow(20)).toBeCloseTo(1.0, 5);   //clamps above a blizzard
        expect(snow(1)).toBeLessThan(snow(4));
    });
});
