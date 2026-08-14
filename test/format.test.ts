import { describe, it, expect } from 'vitest';
import { formatPower, formatIrradiance, resolveUiColor } from '../src/core/format/format';
import type { HassLike } from '../src/core/ha-types';

const hass = { language: 'en' } as unknown as HassLike;

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
