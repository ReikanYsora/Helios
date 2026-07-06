//Last-good persistence for the data layer: a versioned, age-capped localStorage stash so a browser reload
//or a Home Assistant restart shows the last successfully-fetched data instantly instead of a blank card,
//then refreshes. Every access is best-effort: storage unavailable / full / malformed just yields null (and
//the caller does a fresh fetch), never a throw.

const PREFIX = 'helios:last-good:';
//Bump to invalidate every stored payload at once when a persisted shape changes.
const VERSION = 1;

interface Envelope<T>
{
    v:        number;
    storedAt: number;
    data:     T;
}


//Read the last-good payload for a key if present, current-version, and within maxAgeMs. Null otherwise.
export function loadLastGood<T>(key: string, maxAgeMs: number): T | null
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


//Persist a last-good payload under a key. Best-effort: quota / permission errors are swallowed.
export function saveLastGood<T>(key: string, data: T): void
{
    try
    {
        const env: Envelope<T> = { v: VERSION, storedAt: Date.now(), data };
        window.localStorage?.setItem(PREFIX + key, JSON.stringify(env));
    }
    catch
    {
        //Storage quota / permission: the card just does a fresh fetch on the next load.
    }
}


//Drop every last-good payload (called from the card's reset hook). Returns the count removed.
export function clearLastGood(): number
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
