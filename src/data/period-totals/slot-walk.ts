//Walking store buckets across the slots of a day, in ONE place: slot boundaries cut from the home's midnight and
//from the epoch are not the same thing in a zone offset by a fraction of an hour, so every consumer walks the same
//way.
//
//The shape of the work: a store bucket is a span of time, a slot is a span of the day, and the two grids do not
//line up. So a bucket is not DROPPED into a slot; it is walked segment by segment across every slot it straddles,
//and each slot is credited by how much of the bucket it actually holds. Drop it in whole and a coarse store fills
//one slot an hour and leaves the rest empty - a comb, not a curve.

import { DAY_MS } from '../../core/config/constants';
import { serverMsOfDay } from '../../core/time/timezone';
import type { UnifiedDataStore } from '../unifiedStore';

//The slice of the store to walk. The detail panel wants a whole period aggregated; the day curve wants ONE day,
//the one being scrubbed, because it stands on that day's sun track and the two have to describe the same thing.
export interface PeriodWindow
{
    fromMs: number;
    toMs:   number;
}

//Slot of an instant within the day, in the HOME's zone so it groups by the home's real hour of day, not the
//browser's. Integer arithmetic end to end: see timezone.serverMsOfDay for why going through a fractional hour
//punches holes in whatever is being binned, at some slot counts and not others.
export function slotOf(ms: number, slots: number): number
{
    return Math.min(slots - 1, Math.floor((serverMsOfDay(ms) * slots) / DAY_MS));
}

//Is a bucket's midpoint inside the slice? The midpoint, not either edge, so a bucket belongs to exactly one day
//however the store's grid falls against midnight.
function inWindow(store: UnifiedDataStore, i: number, win: PeriodWindow): boolean
{
    const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
    return tMs >= win.fromMs && tMs < win.toMs;
}

//Walk every bucket the slice asks for, emitting one call per (bucket, slot, milliseconds of the bucket in that
//slot). Callers differ only in what they add up.
//
//`clampEndMs` truncates buckets at an instant: coverage uses it for "this has not happened yet", which is what
//leaves today's later slots with nothing and lets the curve stop there instead of lying flat along the ground.
export function forEachBucketSlot(
    store:      UnifiedDataStore,
    slots:      number,
    win:        PeriodWindow | undefined,
    clampEndMs: number | undefined,
    emit:       (i: number, slot: number, segMs: number) => void,
): void
{
    const slotMs = DAY_MS / slots;
    //Only the buckets the slice can reach (a month's store holds ~744, one day needs 24); `inWindow` still decides
    //the two edges.
    const first = win ? Math.max(0, Math.floor((win.fromMs - store.storeStartMs) / store.stepMs) - 1) : 0;
    const last  = win
        ? Math.min(store.bucketsTotal, Math.ceil((win.toMs - store.storeStartMs) / store.stepMs) + 1)
        : store.bucketsTotal;

    for (let i = first; i < last; i++)
    {
        if (win && !inWindow(store, i, win))
        {
            continue;
        }
        const bStart = store.storeStartMs + i * store.stepMs;
        const bEnd   = clampEndMs === undefined ? bStart + store.stepMs : Math.min(bStart + store.stepMs, clampEndMs);
        for (let t = bStart; t < bEnd; )
        {
            //Next slot boundary of the HOME's day, not of the epoch: the slots are cut from local midnight, and a
            //zone offset that is not a whole hour (Kathmandu, Chatham) would otherwise credit a segment to the
            //slot next door.
            const inDay   = serverMsOfDay(t);
            const slotEnd = t - inDay + (Math.floor(inDay / slotMs) + 1) * slotMs;
            const segEnd  = Math.min(bEnd, slotEnd);
            emit(i, slotOf(t, slots), segEnd - t);
            t = segEnd;
        }
    }
}
