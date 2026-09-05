import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveWarmStart, restoreWarmStart, warmStartKey, clearWarmStarts, WARM_START_FIELDS } from '../src/card/warm-start';

function host(overrides: Record<string, unknown> = {}): Record<string, unknown>
{
    const h: Record<string, unknown> = {};
    for (const f of WARM_START_FIELDS)
    {
        h[f] = null;
    }
    return { ...h, ...overrides };
}

describe('warm start', () =>
{
    beforeEach(() => { vi.useFakeTimers(); clearWarmStarts(); });
    afterEach(() => { vi.useRealTimers(); });

    it('keys on the cache id when there is one, else on the home', () =>
    {
        expect(warmStartKey('kiosk', '44.62612,-1.24538')).toBe('kiosk');
        expect(warmStartKey('', '44.62612,-1.24538')).toBe('44.62612,-1.24538');
    });

    it('a fresh card under the same key takes over the leaving card\'s data, by reference', () =>
    {
        const series = [{ t: 1, kwh: 2 }];
        const per = new Map([['sensor.a', series]]);
        const a = host({ _pvChangeSeries: series, _pvChangeSeriesPerEntity: per, _temperature: 21.5, _energyDefaultsLoaded: true });
        saveWarmStart(a, 'k');
        const b = host();
        expect(restoreWarmStart(b, 'k')).toBe(true);
        expect(b._pvChangeSeries).toBe(series);
        expect(b._pvChangeSeriesPerEntity).toBe(per);
        expect(b._temperature).toBe(21.5);
        expect(b._energyDefaultsLoaded).toBe(true);
    });

    it('another key, no key, or a stale snapshot leaves the card cold', () =>
    {
        const a = host({ _temperature: 21.5 });
        saveWarmStart(a, 'k');
        saveWarmStart(a, '');
        const b = host({ _temperature: NaN });
        expect(restoreWarmStart(b, 'other')).toBe(false);
        expect(restoreWarmStart(b, '')).toBe(false);
        expect(Number.isNaN(b._temperature)).toBe(true);
        vi.advanceTimersByTime(5 * 60_000 + 1);
        expect(restoreWarmStart(b, 'k')).toBe(false);
        expect(Number.isNaN(b._temperature)).toBe(true);
    });

    it('does not carry fetch gates or projections, only data', () =>
    {
        const fields = new Set<string>(WARM_START_FIELDS);
        for (const gate of ['_pvChangeFetch', '_gridImportFetch', '_batteryFetching', '_haSolarForecastFetching',
            '_forecastLayoutFetching', '_sunScene', '_unifiedStore', '_engine', '_labelLayout'])
        {
            expect(fields.has(gate)).toBe(false);
        }
    });
});
