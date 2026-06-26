//Thin wrapper around `hass.callWS` that rejects an in-flight promise after a configurable timeout.
//
//Helios's history/statistics fetches are the slowest WS round-trips the card issues, and on a
//recorder under heavy load (a saturated SQLite connection) they never
//complete, pinning the card on its loading state forever. With this wrapper a stuck fetch rejects
//once the budget elapses; each caller catches it and renders a degraded state (live chips still
//update from `hass.states`, the chart history line just drops until the next attempt).
//
//No retry/backoff: the caller's fetch-key gate re-issues on the next `refresh*` cycle when the
//(entity, window) tuple changes, the right escape valve for a transient recorder stall.

import { WS_DEFAULT_TIMEOUT_MS as DEFAULT_TIMEOUT_MS, WS_MAX_CONCURRENT_FETCHES as MAX_CONCURRENT_FETCHES } from '../constants';


//Rejection raised when `callWS` outlasts its timeout budget. The WS `type` is forwarded into the
//message so the caller's logged warning is self-describing without carrying the whole payload.
export class WsTimeoutError extends Error
{
    constructor(public readonly wsType: string, public readonly timeoutMs: number)
    {
        super(`callWS timeout after ${timeoutMs} ms (${wsType})`);
        this.name = 'WsTimeoutError';
    }
}


//Module-level concurrency semaphore capping in-flight history/statistics WS fetches. The HA recorder
//is a single-threaded SQLite consumer per connection, and a dashboard may run several recorder-bound
//cards in parallel. When Helios alone fires 5 concurrent fetches it monopolises the recorder; a cap
//of 2 leaves slack for the rest of the dashboard.
//
//Over-cap fetches queue and fire as slots free, FIFO. Scoping is per-module (each card bundles its
//own helpers), so two Helios cards collectively cap at 4 — a good-citizen heuristic, not a
//system-wide throttle.

let _activeFetches = 0;
const _fetchQueue: Array<() => void> = [];

function acquireFetchSlot(): Promise<void>
{
    if (_activeFetches < MAX_CONCURRENT_FETCHES)
    {
        _activeFetches++;
        return Promise.resolve();
    }
    return new Promise<void>(resolve =>
    {
        _fetchQueue.push(() =>
        {
            _activeFetches++;
            resolve();
        });
    });
}

function releaseFetchSlot(): void
{
    _activeFetches = Math.max(0, _activeFetches - 1);
    const next = _fetchQueue.shift();
    if (next)
    {
        next();
    }
}


export function callWSWithTimeout<T = unknown>(
    hass:    { callWS: (payload: object) => Promise<T> } | null | undefined,
    payload: { type: string; [k: string]: unknown },
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T>
{
    if (!hass || typeof hass.callWS !== 'function')
    {
        return Promise.reject(new Error('hass.callWS unavailable'));
    }
    return acquireFetchSlot().then(() => new Promise<T>((resolve, reject) =>
    {
        let settled = false;
        const finish = (action: () => void) =>
        {
            if (settled)
            {
                return;
            }
            settled = true;
            releaseFetchSlot();
            action();
        };
        const timer = setTimeout(() =>
        {
            finish(() => reject(new WsTimeoutError(payload.type, timeoutMs)));
        }, timeoutMs);
        hass.callWS(payload).then(
            (result: T) =>
            {
                clearTimeout(timer);
                finish(() => resolve(result));
            },
            (err: unknown) =>
            {
                clearTimeout(timer);
                finish(() => reject(err));
            },
        );
    }));
}


