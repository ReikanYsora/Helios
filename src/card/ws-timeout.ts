//Thin wrapper around `hass.callWS` that aborts the in-flight promise after a configurable timeout.
//
//Helios's history and statistics fetches are the slowest WebSocket round-trips the card issues, and on a recorder under heavy load (the Victron
//Cerbo case saturated the SQLite connection) they would never complete. Without a timeout the card stayed pinned on its loading state
//forever and the user had no signal that anything was wrong. With this wrapper a stuck fetch resolves to a rejection after the budget elapses;
//each caller catches the error and renders a degraded state (live chip values still update from `hass.states`, the chart history line just
//disappears until the next attempt).
//
//No retry, no backoff: the caller's existing fetch-key gate naturally re-issues on the next `refresh*` cycle when the (entity, window) tuple
//changes, which is the right escape valve for a transient recorder stall.

const DEFAULT_TIMEOUT_MS = 30_000;


//Race the underlying `callWS` against a timeout. Resolves with the WS payload, or rejects with a `WsTimeoutError` once the budget elapses. The
//`type` parameter is forwarded into the error message so the warning the caller logs is self-describing without dragging the entire payload along.
export class WsTimeoutError extends Error
{
    constructor(public readonly wsType: string, public readonly timeoutMs: number)
    {
        super(`callWS timeout after ${timeoutMs} ms (${wsType})`);
        this.name = 'WsTimeoutError';
    }
}


//-----------------------------------------------------------------
//Module-level concurrency semaphore. Caps the number of in-flight
//history / statistics WS fetches issued by Helios at any given
//moment. The HA recorder is a single-threaded SQLite consumer per
//connection, and a single user dashboard may run several
//recorder-bound cards in parallel (Helios + apex-charts +
//mini-graph + etc.). When Helios alone fires 5 concurrent fetches
//(PV history, PV calib stats, PV trainer stats, battery,
//radiation) it monopolises the recorder for the duration and
//other cards' history queries stall behind us. A cap of 2 leaves
//slack for the rest of the dashboard.
//
//Fetches over the cap queue up and fire as slots free, in FIFO
//order. The semaphore is intentionally scoped to this module
//(card-side) since each card has its own bundled instance of the
//helpers; one Helios card limits itself to 2, two Helios cards
//on the same dashboard collectively limit themselves to 4. This
//is a good-citizen heuristic, not a system-wide throttle.

const MAX_CONCURRENT_FETCHES = 2;
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


