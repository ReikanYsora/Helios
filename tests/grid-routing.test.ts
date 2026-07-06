//refreshGrid routing under the measured-only rule: the healthy sign-split is unchanged, and every other
//situation (no live sensor, guard-flagged sensor) leaves the live chips EMPTY instead of deriving a value
//from the meters. Curves and scrub read the meters through their own series, not through these values.

import { describe, it, expect } from 'vitest';
import { refreshGrid, type GridHost } from '../src/data/sources/grid';
import { createGridGuard } from '../src/data/sources/grid-guard';
import { KeyedFetch } from '../src/data/source-fetch';
import { EMPTY_ENERGY_DEFAULTS, type EnergyDefaults } from '../src/data/sources/energy-prefs';

function makeHost(defaults: Partial<EnergyDefaults>, states: Record<string, any>): GridHost
{
    return {
        hass: { states },
        _energyDefaults: { ...EMPTY_ENERGY_DEFAULTS, ...defaults },
        _periodPastDays: 2,
        _storeFetchPeriod: '5minute',
        requestUpdate: () => {},
        _gridImportValue: null,
        _gridImportUnit:  '',
        _gridExportValue: null,
        _gridExportUnit:  '',
        _gridImportChangeSeries: null,
        _gridExportChangeSeries: null,
        _gridImportFetch: new KeyedFetch(),
        _gridExportFetch: new KeyedFetch(),
        _gridGuard: createGridGuard(),
    };
}

function powerState(watts: number): any
{
    return { state: String(watts), attributes: { unit_of_measurement: 'W' } };
}

describe('refreshGrid, healthy signed sensor (unchanged behaviour)', () =>
{
    const defaults = { gridStatRates: ['sensor.net'], gridStatEnergyFroms: ['sensor.imp'], gridStatEnergyTos: ['sensor.exp'] };

    it('positive net lands on the import chip, export cleared', () =>
    {
        const host = makeHost(defaults, { 'sensor.net': powerState(1200) });
        refreshGrid(host);
        expect(host._gridImportValue).toBe(1200);
        expect(host._gridImportUnit).toBe('W');
        expect(host._gridExportValue).toBeNull();
    });

    it('negative net lands on the export chip, import cleared', () =>
    {
        const host = makeHost(defaults, { 'sensor.net': powerState(-800) });
        refreshGrid(host);
        expect(host._gridExportValue).toBe(800);
        expect(host._gridImportValue).toBeNull();
    });
});

describe('refreshGrid, measured-only rule', () =>
{
    it('no live sensor: chips stay empty, never derived from the meters', () =>
    {
        const host = makeHost(
            { gridStatEnergyFroms: ['sensor.imp'], gridStatEnergyTos: ['sensor.exp'] },
            {}
        );
        //Stale values from a previous wiring must be cleared, not kept.
        host._gridImportValue = 640;
        host._gridImportUnit  = 'W';
        refreshGrid(host);
        expect(host._gridImportValue).toBeNull();
        expect(host._gridImportUnit).toBe('');
        expect(host._gridExportValue).toBeNull();
    });

    it('guard-flagged sensor: chips stay empty instead of trusting the split', () =>
    {
        const defaults = { gridStatRates: ['sensor.net'], gridStatEnergyFroms: ['sensor.imp'], gridStatEnergyTos: ['sensor.exp'] };
        const host = makeHost(defaults, { 'sensor.net': powerState(600) });
        host._gridGuard = { ...createGridGuard(), status: 'flagged', entityKey: 'sensor.net|sensor.exp' };
        refreshGrid(host);
        expect(host._gridImportValue).toBeNull();
        expect(host._gridExportValue).toBeNull();
    });
});
