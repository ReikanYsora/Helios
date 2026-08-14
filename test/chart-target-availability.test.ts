import { describe, it, expect } from 'vitest';
import { firstAvailableChartTarget } from '../src/charts/chart-target-availability';
import { freshEnergyDefaults, type EnergyDefaults } from '../src/data/sources/energy-prefs';
import type { HeliosConfig } from '../src/core/config/helios-config';

const cfg = (o: Record<string, unknown> = {}): HeliosConfig => o as unknown as HeliosConfig;

const withSolar   = (d: EnergyDefaults): EnergyDefaults => ({ ...d, solarStatRates: ['sensor.pv'] });
const withGrid    = (d: EnergyDefaults): EnergyDefaults => ({ ...d, gridStatRates: ['sensor.grid'] });
const withBattery = (d: EnergyDefaults): EnergyDefaults => ({ ...d, batteryStatRates: ['sensor.batt'] });

describe('firstAvailableChartTarget', () =>
{
    it('returns null when nothing is configured', () =>
    {
        expect(firstAvailableChartTarget(cfg(), freshEnergyDefaults())).toBeNull();
    });

    it('prefers consumption whenever any family feeds the home balance', () =>
    {
        expect(firstAvailableChartTarget(cfg(), withSolar(freshEnergyDefaults()))).toBe('consumption');
        expect(firstAvailableChartTarget(cfg(), withGrid(freshEnergyDefaults()))).toBe('consumption');
        expect(firstAvailableChartTarget(cfg(), withBattery(freshEnergyDefaults()))).toBe('consumption');
    });

    it('falls through the cluster order when the home chip is hidden', () =>
    {
        const d = withBattery(withGrid(withSolar(freshEnergyDefaults())));
        expect(firstAvailableChartTarget(cfg({ 'chip-home-visible': false }), d)).toBe('production');
        expect(firstAvailableChartTarget(cfg({ 'chip-home-visible': false, 'chip-production-visible': false }), d)).toBe('grid');
        expect(firstAvailableChartTarget(
            cfg({ 'chip-home-visible': false, 'chip-production-visible': false, 'chip-grid-visible': false }), d)).toBe('battery');
    });

    it('never returns a target whose source is unconfigured, even if its chip is visible', () =>
    {
        //Home hidden so consumption is out; only grid is configured, so a visible-but-empty production is skipped.
        const gridOnly = withGrid(freshEnergyDefaults());
        expect(firstAvailableChartTarget(cfg({ 'chip-home-visible': false }), gridOnly)).toBe('grid');
    });

    it('keeps nothing (null) when every configured family has its chip hidden', () =>
    {
        const d = withGrid(withSolar(freshEnergyDefaults()));
        const hidden = cfg({
            'chip-home-visible': false,
            'chip-production-visible': false,
            'chip-grid-visible': false,
            'chip-battery-visible': false,
        });
        expect(firstAvailableChartTarget(hidden, d)).toBeNull();
    });
});
