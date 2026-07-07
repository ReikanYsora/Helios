//parseEnergyPrefs device extraction: the dashboard's individual devices (`device_consumption`) land in `devices`
//with their meter, live-rate, name and parent, and keep their RAW array index so the ring's colour matches HA's
//per-index devices-graph palette. Water devices are ignored; malformed rows are skipped without shifting the index.

import { describe, it, expect } from 'vitest';
import { parseEnergyPrefs } from '../src/data/sources/energy-prefs';

describe('parseEnergyPrefs devices', () =>
{
    it('extracts each field and defaults the optionals to empty strings', () =>
    {
        const out = parseEnergyPrefs({
            device_consumption: [
                { stat_consumption: 'sensor.washer_kwh', stat_rate: 'sensor.washer_w', name: 'Washer', included_in_stat: 'sensor.home_kwh' },
                { stat_consumption: 'sensor.rack_kwh' },
            ],
        });
        expect(out.devices).toEqual([
            { statConsumption: 'sensor.washer_kwh', statRate: 'sensor.washer_w', name: 'Washer', includedInStat: 'sensor.home_kwh', index: 0 },
            { statConsumption: 'sensor.rack_kwh',   statRate: '',                name: '',       includedInStat: '',                index: 1 },
        ]);
    });

    it('keeps the raw array index (colour match) even when a malformed row is skipped', () =>
    {
        const out = parseEnergyPrefs({
            device_consumption: [
                { stat_consumption: 'sensor.a_kwh' },
                { name: 'no meter' },                //malformed: no stat_consumption -> skipped
                { stat_consumption: 'sensor.c_kwh' },
            ],
        });
        expect(out.devices.map(d => [d.statConsumption, d.index])).toEqual([
            ['sensor.a_kwh', 0],
            ['sensor.c_kwh', 2],
        ]);
    });

    it('ignores water devices and a missing list', () =>
    {
        expect(parseEnergyPrefs({}).devices).toEqual([]);
        expect(parseEnergyPrefs({ device_consumption_water: [{ stat_consumption: 'sensor.tap_l' }] } as any).devices).toEqual([]);
    });
});
