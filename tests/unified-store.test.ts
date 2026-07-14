//Data-version freshness: the store must rebuild when the current daily bucket grows in place (month/year, where
//today is a single daily bucket whose kWh climbs all day at constant length), on a period-window change, and it
//must keep battery charge / discharge distinct (their lengths must not be summed into one colliding number).

import { describe, it, expect } from 'vitest';
import { buildUnifiedStore, isStoreFresh, type UnifiedStoreHost } from '../src/data/unifiedStore';
import type { ChangeBucket } from '../src/data/sources/energy-stats';

const DAY = 86_400_000;
function bucket(startMs: number, kwh: number): ChangeBucket
{
    return { startMs, endMs: startMs + DAY, kwh };
}

function makeHost(over: Partial<UnifiedStoreHost> = {}): UnifiedStoreHost
{
    return {
        config:                       undefined,
        _periodPastDays:              365,
        _periodFutureDays:            0,
        _timelineMode:                'year',
        _chartSeries:                 null,
        _pvChangeSeries:              null,
        _batteryChargeChangeSeries:   null,
        _batteryDischargeChangeSeries: null,
        _gridImportChangeSeries:      null,
        _gridExportChangeSeries:      null,
        _haSolarForecast:             [],
        ...over,
    };
}

describe('unifiedStore data version', () =>
{
    it('invalidates when the current daily bucket grows in place (day-bar freeze regression)', () =>
    {
        const today = bucket(Date.UTC(2026, 6, 10), 3);
        const pv    = [bucket(Date.UTC(2026, 6, 8), 10), bucket(Date.UTC(2026, 6, 9), 12), today];
        const host  = makeHost({ _pvChangeSeries: pv });

        const store = buildUnifiedStore(host);
        expect(isStoreFresh(host, store)).toBe(true);    //nothing changed yet

        today.kwh = 5;                                   //same length, today's bucket accumulated more
        expect(isStoreFresh(host, store)).toBe(false);   //store must rebuild
    });

    it('invalidates on a period-window change', () =>
    {
        const pv    = [bucket(Date.UTC(2026, 6, 9), 12)];
        const store = buildUnifiedStore(makeHost({ _pvChangeSeries: pv }));
        const wider = makeHost({ _pvChangeSeries: pv, _periodPastDays: 30, _timelineMode: 'month' });
        expect(isStoreFresh(wider, store)).toBe(false);
    });

    it('keeps battery charge and discharge distinct (no length-sum collision)', () =>
    {
        const three = [bucket(0, 1), bucket(DAY, 1), bucket(2 * DAY, 1)];
        const five  = [bucket(0, 1), bucket(DAY, 1), bucket(2 * DAY, 1), bucket(3 * DAY, 1), bucket(4 * DAY, 1)];
        const store = buildUnifiedStore(makeHost({ _batteryChargeChangeSeries: three, _batteryDischargeChangeSeries: five }));
        const swapped = makeHost({ _batteryChargeChangeSeries: five, _batteryDischargeChangeSeries: three });
        expect(isStoreFresh(swapped, store)).toBe(false);
    });
});
