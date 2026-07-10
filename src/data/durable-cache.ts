import { warnOnce } from './log';

//Durable cache for the data layer: a versioned, age-capped localStorage stash so a browser reload or a
//Home Assistant restart shows the last successfully-fetched data instantly instead of a blank card, then
//refreshes. It is the durable counterpart to RequestCache (which is ephemeral, per session). Every access
//is best-effort: storage unavailable / full / malformed just yields null (and the caller does a fresh
//fetch), never a throw.

const PREFIX = 'helios:durable:';
//Bump to invalidate every stored payload at once when a persisted shape changes.
const VERSION = 1;

interface Envelope<T>
{
    v:        number;
    storedAt: number;
    data:     T;
}


//Read the durable payload for a key if present, current-version, and within maxAgeMs. Null otherwise.
export function loadDurable<T>(key: string, maxAgeMs: number): T | null
{
    try
    {
        const raw = window.localStorage?.getItem(PREFIX + key);
        if (!raw)
        {
            return null;
        }
        const env = JSON.parse(raw) as Envelope<T>;
        if (!env || env.v !== VERSION || typeof env.storedAt !== 'number')
        {
            return null;
        }
        if (Date.now() - env.storedAt > maxAgeMs)
        {
            return null;
        }
        return env.data ?? null;
    }
    catch
    {
        return null;
    }
}


//localStorage, or null if it throws on access (private-mode / disabled storage).
function safeLocalStorage(): Storage | null
{
    try { return window.localStorage ?? null; } catch { return null; }
}

//The stored `data` JSON of a durable key (current-version only), for the skip-identical check. Null when absent
//or malformed.
function storedDataJson(ls: Storage, fullKey: string): string | null
{
    try
    {
        const raw = ls.getItem(fullKey);
        if (!raw) { return null; }
        const env = JSON.parse(raw) as Envelope<unknown>;
        return env && env.v === VERSION ? JSON.stringify(env.data) : null;
    }
    catch
    {
        return null;
    }
}

//Free room in a full store by dropping the oldest durable entries (a quarter of them, at least one), skipping the
//key currently being written. Returns true if anything was removed so the caller can retry the write.
function evictOldestDurable(ls: Storage, keepKey: string): boolean
{
    try
    {
        const entries: { k: string; at: number }[] = [];
        for (let i = 0; i < ls.length; i++)
        {
            const k = ls.key(i);
            if (!k || !k.startsWith(PREFIX) || k === keepKey) { continue; }
            let at = 0;
            try { at = (JSON.parse(ls.getItem(k) ?? '{}') as Envelope<unknown>).storedAt || 0; } catch { at = 0; }
            entries.push({ k, at });
        }
        if (entries.length === 0) { return false; }
        entries.sort((a, b) => a.at - b.at);
        const drop = Math.max(1, Math.floor(entries.length / 4));
        for (let i = 0; i < drop; i++) { ls.removeItem(entries[i].k); }
        return true;
    }
    catch
    {
        return false;
    }
}

//Persist a payload under a key. Best-effort: never throws. Skips a write when the data is unchanged (the same
//payload is re-saved on every refresh), and on a full store evicts the oldest durable entries and retries once so
//the last-good layer self-heals instead of silently dying.
export function saveDurable<T>(key: string, data: T): void
{
    const ls = safeLocalStorage();
    if (!ls) { return; }
    const full = PREFIX + key;
    let dataJson: string;
    try { dataJson = JSON.stringify(data); } catch { return; }
    if (storedDataJson(ls, full) === dataJson) { return; }
    const envJson = `{"v":${VERSION},"storedAt":${Date.now()},"data":${dataJson}}`;
    try { ls.setItem(full, envJson); }
    catch
    {
        //Quota / permission: reclaim space and retry once; if it still fails the card just re-fetches next load.
        let recovered = false;
        if (evictOldestDurable(ls, full)) { try { ls.setItem(full, envJson); recovered = true; } catch { /* still full */ } }
        if (!recovered) { warnOnce('durable-write', 'durable cache write failed (storage full or blocked); last-good data may be degraded'); }
    }
}


//Drop every durable payload (called from the card's reset hook). Returns the count removed.
export function clearDurable(): number
{
    let cleared = 0;
    try
    {
        const ls = window.localStorage;
        if (!ls)
        {
            return 0;
        }
        const stale: string[] = [];
        for (let i = 0; i < ls.length; i++)
        {
            const k = ls.key(i);
            if (k && k.startsWith(PREFIX))
            {
                stale.push(k);
            }
        }
        for (const k of stale)
        {
            ls.removeItem(k);
            cleared++;
        }
    }
    catch
    {
        //localStorage unavailable: nothing to clear.
    }
    return cleared;
}


//A time series ({ times: Date[]; values: number[] }). JSON can't round-trip Date (it stringifies them), so
//store the times as epoch ms and rehydrate to Date on load: a restored series is then drop-in usable.
export interface DurableSeries
{
    times:  Date[];
    values: number[];
}

export function saveDurableSeries(key: string, series: DurableSeries): void
{
    saveDurable(key, { t: series.times.map(d => d.getTime()), v: series.values });
}

export function loadDurableSeries(key: string, maxAgeMs: number): DurableSeries | null
{
    const raw = loadDurable<{ t: number[]; v: number[] }>(key, maxAgeMs);
    return raw ? { times: raw.t.map(ms => new Date(ms)), values: raw.v } : null;
}
