//parseEnergyPrefs battery extraction: a dashboard battery source (stat_energy_from discharge, stat_energy_to
//charge, stat_soc, top-level stat_rate) populates the battery meter arrays, so the editor's config-check panel
//reads the family as wired. Guards the "battery shows as not set up" regression.

import { describe, it, expect } from 'vitest';
import { parseEnergyPrefs } from '../src/data/sources/energy-prefs';

describe('parseEnergyPrefs battery', () =>
{
    it('extracts the battery meters from a real dashboard payload', () =>
    {
        const d = parseEnergyPrefs({
            energy_sources: [
                { type: 'solar', stat_energy_from: 'sensor.solar_e', stat_rate: 'sensor.solar_p' },
                { type: 'grid',  stat_energy_from: 'sensor.grid_imp', stat_energy_to: 'sensor.grid_exp', stat_rate: 'sensor.grid_p' },
                { type: 'battery', stat_energy_from: 'sensor.batt_out', stat_energy_to: 'sensor.batt_in', stat_soc: 'sensor.batt_soc', stat_rate: 'sensor.batt_p' },
            ],
        });
        expect(d.batteryStatEnergyFroms).toEqual(['sensor.batt_out']);
        expect(d.batteryStatEnergyTos).toEqual(['sensor.batt_in']);
        expect(d.batteryStatSocs).toEqual(['sensor.batt_soc']);
        //No power_config, so the top-level stat_rate is the battery's live power (flipped: HA is discharge-positive).
        //That makes the source rate-sourced, not bucket-sourced, so the live chip + config-check read it as wired.
        expect(d.batteryStatRates).toEqual(['sensor.batt_p']);
        expect(d.invertedRateEntities).toContain('sensor.batt_p');
        expect(d.batterySourcesWithoutRate).toBe(0);
    });
});
