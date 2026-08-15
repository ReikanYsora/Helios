import { describe, it, expect } from 'vitest';
import { formatPower, formatIrradiance, formatTemperature, temperatureUnit, temperatureToCelsius, resolveUiColor } from '../src/core/format/format';
import type { HassLike } from '../src/core/ha-types';

const hass = { language: 'en' } as unknown as HassLike;
const hassF = { language: 'en', config: { unit_system: { temperature: '°F' } } } as unknown as HassLike;

describe('formatPower signed', () =>
{
    it('shows no sign when the magnitude rounds to zero at the shown precision (no "-0.0")', () =>
    {
        expect(formatPower(hass, -0.4, 2, 'kW', true).startsWith('-')).toBe(false); //-0.0004 kW -> "0.00 kW"
        expect(formatPower(hass, -0.3, 0, 'W', true)).not.toContain('-');            //round(0.3) = 0 -> "0 W"
        expect(formatPower(hass, 0, 2, 'kW', true).includes('-')).toBe(false);
    });

    it('keeps the sign for a value that survives rounding', () =>
    {
        expect(formatPower(hass, -600, 2, 'kW', true).startsWith('-')).toBe(true);  //-0.60 kW
        expect(formatPower(hass, 1500, 2, 'kW', true).startsWith('+')).toBe(true);  //+1.50 kW
        expect(formatPower(hass, -5, 0, 'W', true).startsWith('-')).toBe(true);     //-5 W
    });

    it('adds no sign when unsigned', () =>
    {
        expect(formatPower(hass, 1500, 2, 'kW').startsWith('+')).toBe(false);
    });
});

describe('formatIrradiance', () =>
{
    it('groups the whole-unit W/m2 value through the locale formatter', () =>
    {
        expect(formatIrradiance(hass, 1085, 0, 'W/m²')).toBe('1,085 W/m²');
    });

    it('rescales onto square feet, so an STC peak reads ~93 W/ft2', () =>
    {
        expect(formatIrradiance(hass, 1000, 0, 'W/ft²')).toBe('93 W/ft²');
        expect(formatIrradiance(hass, 0, 0, 'W/ft²')).toBe('0 W/ft²');
    });

    it('keeps kW/m2 unchanged by the square-foot option', () =>
    {
        expect(formatIrradiance(hass, 1000, 2, 'kW/m²')).toBe('1.00 kW/m²');
    });
});

describe('temperature units', () =>
{
    it('follows the Home Assistant unit system, defaulting to Celsius', () =>
    {
        expect(temperatureUnit(hass)).toBe('°C');
        expect(temperatureUnit(hassF)).toBe('°F');
        expect(temperatureUnit(undefined)).toBe('°C');
    });

    it('converts the Celsius pipeline value to the configured readout unit', () =>
    {
        expect(formatTemperature(hass, 22.8)).toBe('22.8 °C');
        expect(formatTemperature(hassF, 22.8)).toBe('73.0 °F');
        expect(formatTemperature(hassF, 0)).toBe('32.0 °F');
        expect(formatTemperature(hassF, -40)).toBe('-40.0 °F');
    });

    it('normalises a sensor reading back to Celsius from the unit its entity declares', () =>
    {
        expect(temperatureToCelsius('°F')!(73)).toBeCloseTo(22.7778, 4);
        expect(temperatureToCelsius('K')!(273.15)).toBeCloseTo(0, 6);
        //Already canonical (or unknown): no converter, so the caller keeps the raw value.
        expect(temperatureToCelsius('°C')).toBeNull();
        expect(temperatureToCelsius(undefined)).toBeNull();
        expect(temperatureToCelsius('')).toBeNull();
    });
});

describe('resolveUiColor', () =>
{
    it('passes #hex, rgb() and var() literals through untouched', () =>
    {
        expect(resolveUiColor(null, '#abcdef', '#000')).toBe('#abcdef');
        expect(resolveUiColor(null, 'rgb(1, 2, 3)', '#000')).toBe('rgb(1, 2, 3)');
        expect(resolveUiColor(null, 'var(--my-color)', '#000')).toBe('var(--my-color)');
    });

    it('falls back to the hex when nothing is set', () =>
    {
        expect(resolveUiColor(null, '', '#123456')).toBe('#123456');
    });
});
