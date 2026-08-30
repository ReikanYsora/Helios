//Data-layer diagnostics. The whole data layer swallows fetch / storage failures on purpose so the card never
//blanks on a transient hiccup, but that also makes a PERSISTENT failure invisible. warnOnce surfaces each
//distinct failure a single time (keyed), so a real problem reaches the console without spamming it every refresh.

const _warned = new Set<string>();

export function warnOnce(key: string, message: string): void
{
    if (_warned.has(key))
    {
        return;
    }
    _warned.add(key);
    // eslint-disable-next-line no-console -- one-time data-layer diagnostic; the layer is otherwise fully silent
    console.warn(`[Helios] ${message}`);
}


//Remove every localStorage key starting with `prefix`. Best-effort: storage unavailable or a quota error
//just leaves the cache as-is. Returns the count removed.
export function clearPrefixedLocalStorage(prefix: string): number
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
            if (k && k.startsWith(prefix))
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
    { /* localStorage unavailable or quota error: leave the cache as-is */ }
    return cleared;
}
