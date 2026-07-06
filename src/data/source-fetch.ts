//Shared fetch plumbing for the per-source data subsystems (pv, grid, battery, custom): the keyed-fetch
//gate, the live-power aggregation, and the minute anchor. Each source keeps its own divergent window/key
//logic and its series data on the host; only these genuinely-shared pieces live here.

import { parseNumericState, pvNormalizeToWatts } from '../core/format/format';


//Gate for a keyed, de-duplicated fetch: runs its task at most once per distinct key, and never while a run
//is already in flight. Replaces the hand-rolled `_xxxFetchKey` + `_xxxFetching` field pairs each source used
//to carry; the source keeps its series data on the host and just drives this gate.
export class KeyedFetch
{
    private _key = '';
    private _fetching = false;

    get key(): string
    {
        return this._key;
    }

    get fetching(): boolean
    {
        return this._fetching;
    }

    //Run `task` unless the key is unchanged or a run is already in flight. The key is adopted before the run,
    //so a re-entrant call with the same key no-ops; the fetching flag clears when the task settles.
    run(key: string, task: () => Promise<void>): void
    {
        if (this._fetching || key === this._key)
        {
            return;
        }
        this._key = key;
        this._fetching = true;
        void task().finally(() =>
        {
            this._fetching = false;
        });
    }

    //Clear the gate so the next matching key re-fetches (the card's data reset).
    reset(): void
    {
        this._key = '';
        this._fetching = false;
    }
}


//Minimal shape of the hass object the live read needs.
interface LiveStates
{
    states?: Record<string, { state: string; attributes?: { unit_of_measurement?: string } }>;
}


//Sum the live signed watts across a set of power sensors, like the HA Energy live tile: parse each state,
//SI-normalise to watts, and flip the sign for any entity listed in `inverted`. Returns the sum and whether
//any sensor produced a valid sample (callers show no live value when none did). Cumulative meters are never
//passed here (measured-only): a live value is never derived from an energy counter.
export function sumLiveWatts(
    hass:     LiveStates | null | undefined,
    entities: readonly string[],
    inverted?: readonly string[],
): { watts: number; any: boolean }
{
    let watts = 0;
    let any = false;
    for (const id of entities)
    {
        const so = hass?.states?.[id];
        if (!so)
        {
            continue;
        }
        const v = parseNumericState(so.state);
        if (v === null)
        {
            continue;
        }
        const w = pvNormalizeToWatts(v, String(so.attributes?.unit_of_measurement ?? '').trim());
        watts += inverted?.includes(id) ? -w : w;
        any = true;
    }
    return { watts, any };
}


//"Now" floored to the minute: a stable dedupe anchor for raw-window fetches (battery SoC, irradiance) so an
//unquantised Date.now() does not change the fetch key every render and re-fire the fetch.
export function minuteAnchorMs(): number
{
    return Math.floor(Date.now() / 60_000) * 60_000;
}
