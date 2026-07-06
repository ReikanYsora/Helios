//Durable cache (localStorage persistence): round-trip, version + age invalidation, key isolation on clear,
//and graceful failure when storage is unavailable (the card must never throw over a missing/full storage).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadDurable, saveDurable, clearDurable } from '../src/core/data/durable-cache';

//Minimal in-memory localStorage stand-in installed on globalThis.window.
function installMockStorage(): void
{
    const store = new Map<string, string>();
    const mock = {
        getItem:    (k: string): string | null => (store.has(k) ? store.get(k)! : null),
        setItem:    (k: string, v: string): void => { store.set(k, v); },
        removeItem: (k: string): void => { store.delete(k); },
        key:        (i: number): string | null => [...store.keys()][i] ?? null,
        get length(): number { return store.size; },
    };
    (globalThis as unknown as { window: unknown }).window = { localStorage: mock };
}

describe('durable cache', () =>
{
    beforeEach(() =>
    {
        installMockStorage();
    });

    afterEach(() =>
    {
        vi.useRealTimers();
        delete (globalThis as unknown as { window?: unknown }).window;
    });

    it('round-trips a payload within its age window', () =>
    {
        saveDurable('k', { a: 1, series: [1, 2, 3] });
        expect(loadDurable('k', 60_000)).toEqual({ a: 1, series: [1, 2, 3] });
    });

    it('returns null past maxAgeMs', () =>
    {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(1_000_000));
        saveDurable('k', 42);
        vi.setSystemTime(new Date(1_061_000));
        expect(loadDurable('k', 60_000)).toBeNull();
    });

    it('a missing key returns null', () =>
    {
        expect(loadDurable('nope', 60_000)).toBeNull();
    });

    it('a malformed payload returns null instead of throwing', () =>
    {
        window.localStorage.setItem('helios:durable:bad', '{not json');
        expect(loadDurable('bad', 60_000)).toBeNull();
    });

    it('clear removes only helios durable keys', () =>
    {
        saveDurable('a', 1);
        saveDurable('b', 2);
        window.localStorage.setItem('unrelated', 'x');
        expect(clearDurable()).toBe(2);
        expect(loadDurable('a', 60_000)).toBeNull();
        expect(window.localStorage.getItem('unrelated')).toBe('x');
    });

    it('never throws when storage is unavailable', () =>
    {
        delete (globalThis as unknown as { window?: unknown }).window;
        expect(() => saveDurable('k', 1)).not.toThrow();
        expect(loadDurable('k', 60_000)).toBeNull();
        expect(clearDurable()).toBe(0);
    });
});
