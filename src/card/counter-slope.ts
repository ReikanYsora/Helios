//Near-real-time watts from cumulative kWh counters, without the recorder. The card's past series stay on the
//recorder `change` metric (reset-corrected, HA-consistent); this module only serves the LIVE chips, where the
//recorder's 5-minute commit lag is the whole problem. It watches each counter's state changes over a short
//rolling window and derives watts = delta-kWh / delta-time between the first and last change inside it.
//
//Safety rules, in order:
//  - A counter that decreased reset (daily-reset meters, migrations): the ring restarts from the fresh value,
//    never producing a negative or absurd slope.
//  - Fewer than two changes in the window with the newest change still recent: cadence unproven (coarse meter
//    or just-booted sampler), the direction reports "no slope" and the caller falls back to recorder buckets.
//  - No change across the whole window: a DIRECTIONAL counter only advances while its direction flows, so a
//    silent counter is a 0 W read, not a data gap.
//  - A change pair spanning less than SLOPE_MIN_SPAN_MS is rejected: counter-resolution quantisation dominates
//    on short spans and would read as watt noise.
//
//Samples are keyed by entity id at module level (shared across cards, like the energy-stats cache), timestamped
//with the entity's own `last_changed` so the sampling cadence of the card does not distort the slope.

import { energyToKwh } from './format';
import { SLOPE_WINDOW_MS, SLOPE_MIN_SPAN_MS, HOUR_MS } from '../constants';


interface SlopeSample
{
    tMs: number;
    kwh: number;
}

const _samples = new Map<string, SlopeSample[]>();


//Wipe every sample ring. Called from the card's `resetDataCache()` alongside the other module caches.
export function clearCounterSlopeSamples(): void
{
    _samples.clear();
}


//Record the counter's current state if its value changed since the last sample. Cheap (one map lookup, no
//allocation on the no-change path), safe to call every Lit cycle.
export function sampleCounter(hass: any, entityId: string): void
{
    const stateObj = hass?.states?.[entityId];
    if (!stateObj) { return; }
    const v = parseFloat(stateObj.state);
    if (!isFinite(v)) { return; }
    const kwh = energyToKwh(v, String(stateObj.attributes?.unit_of_measurement ?? ''));
    const tMs = stateObj.last_changed ? Date.parse(stateObj.last_changed) : NaN;
    if (!isFinite(tMs)) { return; }

    let ring = _samples.get(entityId);
    if (!ring)
    {
        ring = [];
        _samples.set(entityId, ring);
    }
    const last = ring.length > 0 ? ring[ring.length - 1] : null;
    if (last)
    {
        if (tMs <= last.tMs) { return; }
        if (kwh < last.kwh) { ring.length = 0; }   //counter reset: restart from the fresh baseline
    }
    ring.push({ tMs, kwh });
    //Prune aged samples so a long session never grows the ring past a couple of windows.
    const cutoff = tMs - 2 * SLOPE_WINDOW_MS;
    let drop = 0;
    while (drop < ring.length - 1 && ring[drop].tMs < cutoff)
    {
        drop++;
    }
    if (drop > 0)
    {
        ring.splice(0, drop);
    }
}


//Summed live watts for one direction's counters, or null when any counter's cadence is unproven (the caller
//then falls back to recorder buckets for the WHOLE direction, never mixing a live meter with a lagged one).
export function counterSlopeWatts(entityIds: string[], nowMs: number): number | null
{
    if (entityIds.length === 0) { return null; }
    const windowStart = nowMs - SLOPE_WINDOW_MS;
    let watts = 0;
    for (const id of entityIds)
    {
        const ring = _samples.get(id);
        if (!ring || ring.length === 0) { return null; }
        const newest = ring[ring.length - 1];
        if (newest.tMs < windowStart)
        {
            //Silent for the whole window: no flow on this counter right now. Contributes 0 W, so an idle
            //tariff meter in a dual-meter direction never blocks the active one.
            continue;
        }
        //First in-window sample; the pair must span enough time for quantisation to wash out.
        let firstIdx = 0;
        while (firstIdx < ring.length && ring[firstIdx].tMs < windowStart)
        {
            firstIdx++;
        }
        const first = ring[firstIdx];
        const spanMs = newest.tMs - first.tMs;
        if (spanMs < SLOPE_MIN_SPAN_MS) { return null; }
        watts += Math.max(0, ((newest.kwh - first.kwh) * 1000) / (spanMs / HOUR_MS));
    }
    return watts;
}
