import { describe, it, expect, vi } from 'vitest';
import { parseEnergyPrefs, subscribeEnergyPrefs, type EnergyPrefsHost, freshEnergyDefaults } from '../src/data/sources/energy-prefs';

//A minimal EnergyPrefsHost. `admin` drives hass.user.is_admin (undefined = unknown/older core);
//`subscribeEvents` is a spy so tests can assert whether the doomed WS call was even attempted.
function fakeHost(admin: boolean | undefined, subscribeEvents: ReturnType<typeof vi.fn>): EnergyPrefsHost & { requestUpdate: ReturnType<typeof vi.fn> }
{
    return {
        hass: {
            states: {},
            config: {} as any,
            connection: { subscribeEvents },
            callWS: vi.fn().mockResolvedValue({}),
            language: 'en',
            user: admin === undefined ? undefined : { is_admin: admin },
        } as any,
        _energyDefaults:       freshEnergyDefaults(),
        _energyDefaultsLoaded: false,
        _energyPrefsUnsub:     undefined,
        requestUpdate:         vi.fn(),
    };
}

//Flush the microtask queue so the fire-and-forget promise chains inside subscribeEnergyPrefs settle.
async function flush(): Promise<void>
{
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

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

describe('subscribeEnergyPrefs non-admin retry storm (#415)', () =>
{
    it('never calls subscribeEvents for a known non-admin user', async () =>
    {
        const subscribeEvents = vi.fn();
        const host = fakeHost(false, subscribeEvents);
        subscribeEnergyPrefs(host);
        await flush();
        expect(subscribeEvents).not.toHaveBeenCalled();
        //The one-shot energy/get_prefs fetch still ran (non-admin users CAN call it).
        expect(host.hass.callWS).toHaveBeenCalled();
    });

    it('still attempts the subscription for an admin user', async () =>
    {
        const subscribeEvents = vi.fn().mockResolvedValue(() => {});
        const host = fakeHost(true, subscribeEvents);
        subscribeEnergyPrefs(host);
        await flush();
        expect(subscribeEvents).toHaveBeenCalledTimes(1);
    });

    it('still attempts the subscription when admin status is unknown (older core / test harness)', async () =>
    {
        const subscribeEvents = vi.fn().mockResolvedValue(() => {});
        const host = fakeHost(undefined, subscribeEvents);
        subscribeEnergyPrefs(host);
        await flush();
        expect(subscribeEvents).toHaveBeenCalledTimes(1);
    });

    it('does not retry on every subsequent call after subscribeEvents rejects (the actual #415 loop)', async () =>
    {
        //is_admin unknown, so the pre-check doesn't skip it; the rejection itself is what must stick.
        const subscribeEvents = vi.fn().mockRejectedValue(new Error('Unauthorized'));
        const host = fakeHost(undefined, subscribeEvents);

        //Simulate what helios-card.ts's updated() does on every single hass state change: call subscribeEnergyPrefs
        //again whenever the guard isn't set. Before the fix this retried the doomed subscription every time.
        for (let i = 0; i < 20; i++)
        {
            subscribeEnergyPrefs(host);
            await flush();
        }
        expect(subscribeEvents).toHaveBeenCalledTimes(1);
        //The guard must be left set so a caller checking it (helios-card.ts's `!this._energyPrefsUnsub`) stops
        //calling in altogether, not just internally short-circuit.
        expect(host._energyPrefsUnsub).toBeDefined();
    });
});
