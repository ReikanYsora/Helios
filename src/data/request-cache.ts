//One request cache for the data layer: a fresh-within-TTL result store with in-flight de-duplication, so
//N cards (or N re-renders) asking for the same key inside the window hit the recorder once. Settled
//entries past TTL are pruned on every access, so the map only ever holds the few live keys.
//
//The fetcher owns its own error handling: return a sentinel (e.g. null) rather than reject to have that
//sentinel cached for the TTL; a rejecting fetcher is not cached, so the next call retries.

export class RequestCache<V>
{
    private readonly _entries = new Map<string, { ts: number; result?: V; inflight?: Promise<V> }>();

    constructor(private readonly _ttlMs: number) {}

    //Fresh cached value, the in-flight promise for the same key, or run the fetcher and cache its result.
    get(key: string, fetcher: () => Promise<V>): Promise<V>
    {
        const nowMs = Date.now();
        this._prune(nowMs);
        const cached = this._entries.get(key);
        if (cached)
        {
            if (cached.inflight)                 { return cached.inflight; }
            if (nowMs - cached.ts < this._ttlMs) { return Promise.resolve(cached.result as V); }
        }
        const inflight = fetcher();
        this._entries.set(key, { ts: nowMs, inflight });
        return inflight.then(
            (result) =>
            {
                this._entries.set(key, { ts: Date.now(), result });
                return result;
            },
            (err: unknown) =>
            {
                //A rejecting fetcher poisons nothing: drop the key so the next call retries.
                this._entries.delete(key);
                throw err;
            });
    }

    clear(): void
    {
        this._entries.clear();
    }

    private _prune(nowMs: number): void
    {
        for (const [key, e] of this._entries)
        {
            if (!e.inflight && nowMs - e.ts > this._ttlMs)
            {
                this._entries.delete(key);
            }
        }
    }
}
