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
