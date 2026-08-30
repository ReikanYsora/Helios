//Typed boundary over Home Assistant's WebSocket API for the card's data layer. Every recorder/statistics
//round-trip goes through callWS here, which adds the shared timeout and the concurrency cap (the recorder
//is a single SQLite consumer per connection), plus optional AbortSignal cancellation so a superseded
//window's fetch is dropped instead of resolving into stale state.
//
//The timeout does not abort the server-side query (HA's WS has no cancel); it stops us waiting and frees
//the slot. No retry: a rejected fetch is re-issued by the caller's fetch-key gate on the next refresh.

import { WS_DEFAULT_TIMEOUT_MS as DEFAULT_TIMEOUT_MS, WS_MAX_CONCURRENT_FETCHES as MAX_CONCURRENT_FETCHES } from '../core/config/constants';


//Minimal shape of hass the gateway needs. Widened toward the full HomeAssistant type as the data layer
//migrates off `any`.
export interface HassCallWS
{
    callWS: <T>(payload: object) => Promise<T>;
}


//Per-call options: a timeout override and an AbortSignal to drop a superseded request.
export interface CallOptions
{
    timeoutMs?: number;
    signal?:    AbortSignal;
}


//Rejection raised when callWS outlasts its timeout budget. The WS `type` is forwarded into the message so
//the caller's logged warning is self-describing without carrying the whole payload.
export class WsTimeoutError extends Error
{
    constructor(public readonly wsType: string, public readonly timeoutMs: number)
    {
        super(`callWS timeout after ${timeoutMs} ms (${wsType})`);
        this.name = 'WsTimeoutError';
    }
}


//Rejection raised when an AbortSignal drops the call before it settled (a superseded window/mode).
export class WsAbortError extends Error
{
    constructor(public readonly wsType: string)
    {
        super(`callWS aborted (${wsType})`);
        this.name = 'WsAbortError';
    }
}


//Module-level concurrency semaphore capping in-flight history/statistics WS fetches. The HA recorder is a
//single-threaded SQLite consumer per connection, and a dashboard may run several recorder-bound cards in
//parallel. Firing 5 concurrent fetches monopolises the recorder; a cap of 2 leaves slack for the rest of
//the dashboard. Over-cap fetches queue and fire as slots free, FIFO. Scoping is per-module (each card
//bundles its own helpers), so two cards collectively cap at 4: a good-citizen heuristic, not a system-wide
//throttle.

let _activeFetches = 0;
const _fetchQueue: (() => void)[] = [];

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


//Call a WS command with the shared timeout + concurrency cap, and optional AbortSignal cancellation.
export function callWS<T = unknown>(
    hass:    HassCallWS | null | undefined,
    payload: { type: string; [k: string]: unknown },
    opts?:   CallOptions,
): Promise<T>
{
    if (!hass || typeof hass.callWS !== 'function')
    {
        return Promise.reject(new Error('hass.callWS unavailable'));
    }
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const signal = opts?.signal;
    if (signal?.aborted)
    {
        return Promise.reject(new WsAbortError(payload.type));
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
        const onAbort = () =>
        {
            clearTimeout(timer);
            finish(() => reject(new WsAbortError(payload.type)));
        };
        const timer = setTimeout(() =>
        {
            signal?.removeEventListener('abort', onAbort);
            finish(() => reject(new WsTimeoutError(payload.type, timeoutMs)));
        }, timeoutMs);
        if (signal)
        {
            signal.addEventListener('abort', onAbort, { once: true });
        }
        hass.callWS<T>(payload).then(
            (result: T) =>
            {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                finish(() => resolve(result));
            },
            (err: unknown) =>
            {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                finish(() => reject(err));
            },
        );
    }));
}
