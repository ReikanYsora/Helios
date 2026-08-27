import { describe, it, expect } from 'vitest';
import { parseEnergyPrefs } from '../src/data/sources/energy-prefs';

//A Dutch dual-tariff grid: two flow_from meters (low/high tariff), sharing ONE live price entity, and HA's cost
//sensors re-registered once (so the clean `<meter>_cost` id is dead, `energy/info` points at `_cost_2`) - the
//exact shape reported in #410.
function dualTariffPrefs(): { energy_sources: Record<string, unknown>[] }
{
    return {
        energy_sources: [
            {
                type: 'grid',
                flow_from: [
                    {
                        stat_energy_from: 'sensor.energy_consumption_tarif_1',
                        entity_energy_price: 'sensor.electricity_price_consumption',
                    },
                    {
                        stat_energy_from: 'sensor.energy_consumption_tarif_2',
                        entity_energy_price: 'sensor.electricity_price_consumption',
                    },
                ],
                flow_to: [],
            },
        ],
    };
}

describe('parseEnergyPrefs cost sensors (#410)', () =>
{
    it('prefers energy/info\'s cost_sensors map over the derived `<meter>_cost` guess', () =>
    {
        const costSensors = {
            'sensor.energy_consumption_tarif_1': 'sensor.energy_consumption_tarif_1_cost_2',
            'sensor.energy_consumption_tarif_2': 'sensor.energy_consumption_tarif_2_cost_2',
        };
        const out = parseEnergyPrefs(dualTariffPrefs(), costSensors);
        expect(out.gridStatCosts).toEqual([
            'sensor.energy_consumption_tarif_1_cost_2',
            'sensor.energy_consumption_tarif_2_cost_2',
        ]);
    });

    it('falls back to the `<meter>_cost` guess when the map has no entry (older core, failed fetch)', () =>
    {
        const out = parseEnergyPrefs(dualTariffPrefs());
        expect(out.gridStatCosts).toEqual([
            'sensor.energy_consumption_tarif_1_cost',
            'sensor.energy_consumption_tarif_2_cost',
        ]);
    });

    it('falls back per-meter when the map only covers some of the flows', () =>
    {
        const out = parseEnergyPrefs(dualTariffPrefs(), {
            'sensor.energy_consumption_tarif_1': 'sensor.energy_consumption_tarif_1_cost_2',
        });
        expect(out.gridStatCosts).toEqual([
            'sensor.energy_consumption_tarif_1_cost_2',
            'sensor.energy_consumption_tarif_2_cost',
        ]);
    });
});

describe('parseEnergyPrefs price dedup (#410)', () =>
{
    it('a dual-tariff grid sharing one price entity resolves to a single price, not a multi-tariff bail', () =>
    {
        const out = parseEnergyPrefs(dualTariffPrefs());
        //Both flows carry the same entity; singlePrice() only bails to the cost-statistic path on a GENUINE
        //multiple, so this must dedupe to one, letting the live-price fallback work.
        expect(out.gridImportPrices).toEqual(['sensor.electricity_price_consumption']);
    });

    it('two genuinely different price entities are both kept', () =>
    {
        const prefs = {
            energy_sources: [
                {
                    type: 'grid',
                    flow_from: [
                        { stat_energy_from: 'sensor.grid_low',  entity_energy_price: 'sensor.price_low' },
                        { stat_energy_from: 'sensor.grid_high', entity_energy_price: 'sensor.price_high' },
                    ],
                    flow_to: [],
                },
            ],
        };
        const out = parseEnergyPrefs(prefs);
        expect(out.gridImportPrices).toEqual(['sensor.price_low', 'sensor.price_high']);
    });
});
