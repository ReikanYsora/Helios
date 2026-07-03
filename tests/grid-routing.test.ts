//refreshGrid routing: characterises the untouched healthy path (sign-split identical to the original) and
//exercises the guard-driven ladder (flagged import-only sensor, gate, slope preference, bucket fallback).

import { describe, it, expect, beforeEach } from 'vitest';
import { refreshGrid, type GridHost } from '../src/card/grid';
import { createGridGuard } from '../src/card/grid-guard';
import { clearCounterSlopeSamples } from '../src/card/counter-slope';
import { EMPTY_ENERGY_DEFAULTS, type EnergyDefaults } from '../src/card/energy-prefs';
import type { ChangeBucket } from '../src/card/energy-stats';

const MIN5 = 5 * 60_000;

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
        _gridImportChangeFetchKey: '',
        _gridExportChangeFetchKey: '',
        _gridImportChangeFetching: false,
        _gridExportChangeFetching: false,
        _gridGuard: createGridGuard(),
        _gridImportLagged: false,
        _gridExportLagged: false,
    };
}

function powerState(watts: number): any
{
    return { state: String(watts), attributes: { unit_of_measurement: 'W' } };
}

function counterState(kwh: number, changedMs: number): any
{
    return {
        state:        String(kwh),
        last_changed: new Date(changedMs).toISOString(),
        attributes:   { unit_of_measurement: 'kWh' },
    };
}

//Recent completed 5-minute buckets ending on the last boundary before now, each carrying `kwh`.
function recentBuckets(kwh: number, n = 6): ChangeBucket[]
{
    const lastEnd = Math.floor(Date.now() / MIN5) * MIN5;
    const out: ChangeBucket[] = [];
    for (let i = n; i > 0; i--)
    {
        out.push({ startMs: lastEnd - i * MIN5, endMs: lastEnd - (i - 1) * MIN5, kwh });
    }
    return out;
}

beforeEach(() =>
{
    clearCounterSlopeSamples();
});

describe('refreshGrid, healthy signed sensor (zero-regression characterisation)', () =>
{
    const defaults = { gridStatRates: ['sensor.net'], gridStatEnergyFroms: ['sensor.imp'], gridStatEnergyTos: ['sensor.exp'] };

    it('positive net lands on the import chip, export cleared', () =>
    {
        const host = makeHost(defaults, { 'sensor.net': powerState(1200) });
        refreshGrid(host);
        expect(host._gridImportValue).toBe(1200);
        expect(host._gridImportUnit).toBe('W');
        expect(host._gridExportValue).toBeNull();
        expect(host._gridImportLagged).toBe(false);
        expect(host._gridExportLagged).toBe(false);
    });

    it('negative net lands on the export chip, import cleared', () =>
    {
        const host = makeHost(defaults, { 'sensor.net': powerState(-800) });
        refreshGrid(host);
        expect(host._gridExportValue).toBe(800);
        expect(host._gridImportValue).toBeNull();
    });

    it('clears a stale lagged flag when back on the live path', () =>
    {
        const host = makeHost(defaults, { 'sensor.net': powerState(500) });
        host._gridImportLagged = true;
        refreshGrid(host);
        expect(host._gridImportLagged).toBe(false);
    });
});

describe('refreshGrid, flagged import-only sensor', () =>
{
    const defaults = { gridStatRates: ['sensor.net'], gridStatEnergyFroms: ['sensor.imp'], gridStatEnergyTos: ['sensor.exp'] };
    const entityKey = 'sensor.net|sensor.exp';

    function flaggedHost(states: Record<string, any>, importLive: boolean): GridHost
    {
        const host = makeHost(defaults, states);
        host._gridGuard = { ...createGridGuard(), status: 'flagged', importLive, entityKey };
        return host;
    }

    it('live import above the gate pins export to 0 (never both directions at once)', () =>
    {
        const host = flaggedHost({ 'sensor.net': powerState(600) }, true);
        host._gridExportChangeSeries = recentBuckets(0.25);   //stale 3 kW that must NOT show
        refreshGrid(host);
        expect(host._gridImportValue).toBe(600);
        expect(host._gridImportLagged).toBe(false);
        expect(host._gridExportValue).toBe(0);
        expect(host._gridExportLagged).toBe(false);
    });

    it('no live import: export reads through the meter ladder (bucket fallback, lag flagged)', () =>
    {
        const host = flaggedHost({ 'sensor.net': powerState(0) }, true);
        host._gridExportChangeSeries = recentBuckets(0.25);   //0.25 kWh / 5 min = 3000 W
        refreshGrid(host);
        expect(host._gridImportValue).toBe(0);
        expect(host._gridExportValue).toBeCloseTo(3000, 0);
        expect(host._gridExportLagged).toBe(true);
    });

    it('a contradicting SIGNED sensor (asymmetric phases) is bypassed for both directions', () =>
    {
        const host = flaggedHost({ 'sensor.net': powerState(-1000) }, false);
        host._gridImportChangeSeries = recentBuckets(0.05);   //600 W
        host._gridExportChangeSeries = recentBuckets(0.10);   //1200 W
        refreshGrid(host);
        //Both directions from the billing meters, simultaneously non-zero: the 3-phase reality.
        expect(host._gridImportValue).toBeCloseTo(600, 0);
        expect(host._gridExportValue).toBeCloseTo(1200, 0);
        expect(host._gridImportLagged).toBe(true);
        expect(host._gridExportLagged).toBe(true);
    });
});

describe('refreshGrid, no live sensor (meter ladder)', () =>
{
    const defaults = { gridStatEnergyFroms: ['sensor.imp'], gridStatEnergyTos: ['sensor.exp'] };

    it('prefers the live counter slope over the lagged bucket', () =>
    {
        const now = Date.now();
        //Export counter advancing 0.03 kWh over 90 s (1200 W); import counter idle for an hour (0 W).
        const host = makeHost(defaults, {
            'sensor.exp': counterState(100.00, now - 100_000),
            'sensor.imp': counterState(500.00, now - 3_600_000),
        });
        host._gridExportChangeSeries = recentBuckets(0.25);   //stale 3 kW the slope must beat
        refreshGrid(host);
        //First cycle: one export sample, cadence unproven, bucket fallback shows.
        expect(host._gridExportLagged).toBe(true);
        //Counter advances: second sample proves the cadence.
        (host as any).hass = { states: {
            'sensor.exp': counterState(100.03, now - 10_000),
            'sensor.imp': counterState(500.00, now - 3_600_000),
        } };
        refreshGrid(host);
        expect(host._gridExportValue).toBeCloseTo(1200, 0);
        expect(host._gridExportLagged).toBe(false);
        expect(host._gridImportValue).toBe(0);   //idle counter = no import flowing
        expect(host._gridImportLagged).toBe(false);
    });

    it('cumulative-only original behaviour holds when the slope is unavailable (coarse meters)', () =>
    {
        const host = makeHost(defaults, {});
        host._gridImportChangeSeries = recentBuckets(0.05);   //600 W
        host._gridExportChangeSeries = recentBuckets(0.10);   //1200 W
        refreshGrid(host);
        expect(host._gridImportValue).toBeCloseTo(600, 0);
        expect(host._gridExportValue).toBeCloseTo(1200, 0);
        expect(host._gridImportLagged).toBe(true);
        expect(host._gridExportLagged).toBe(true);
    });
});
