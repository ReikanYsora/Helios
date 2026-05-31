//Grid import / export readout, the live numeric value read from
//hass.states and the past-scrub derivation from the rolling buffer
//backed by HA recorder history.
//
//grid-import-entity and grid-export-entity can be wired as a single
//entity (string) OR as an array of entities. The array form is the
//only sane way to model time-of-use installs where the cumulative
//meter is split across two indexes (heures pleines / creuses in
//France, peak / off-peak elsewhere). Crucially, those indexes are
//MUTUALLY EXCLUSIVE: only one is incrementing at any given moment
//(the active tariff), so the chip displays the value of the entity
//that changed MOST RECENTLY. No averaging, no summing: the last-
//updated entity wins.
//
//grid-power-entity is the third wiring: a single COMBINED signed
//sensor (Fronius P_Grid, Shelly EM, P1 net power, ...) whose sign
//encodes the direction. When it is set it owns both chips and the
//directional slots above are ignored: readCombined derives the net
//signed watts (a power sensor's value, or a net-energy sensor's
//signed slope), applies the optional grid-power-invert flip, then
//routes a non-negative net to the IMPORT chip and a negative net to
//the EXPORT chip so only the active direction is ever shown.
//
//Both live and past-scrub derivations share one bracketed-slope
//helper. The bracket is chosen so that the time span across the two
//samples is at least MIN_SLOPE_SPAN_MS, expanding outward when the
//immediate bracket is too narrow. This keeps a 1 Wh meter quantum
//from projecting into a hundred-watt spike when two consecutive
//samples landed 5 s apart, while still using the natural sample
//cadence on sparse meters (Linky 30 min, Shelly 60 s).

import type { HeliosConfig } from '../helios-config';
import { pvNormalizeToWatts } from './pv';


type Sample = { t: number; v: number; lastChangeT?: number | null };


const _historyFetched   = new Set<string>();
const _historyInflight  = new Set<string>();
//72 hour history backfill so the past-scrub bracket actually
//covers the timeline's visible past range (2 days + margin), the
//earlier 6 h window had the user dragging the scrub deep into
//yesterday and hitting the buffer's edge, where pickBracket fell
//back to the first two samples and returned a constant slope for
//every position past that edge (the user's "scrub value never
//changes, no matter where I drop the cursor" symptom).
const GRID_HISTORY_WINDOW_MS = 72 * 60 * 60_000;
//In-memory retention window aligned with the backfill so live
//accumulation never trims off bracket-relevant history.
const GRID_SAMPLE_WINDOW_MS = 72 * 60 * 60_000;
const GRID_SAMPLE_MAX       = 16384;
//Minimum time span a slope must cover before it is trusted. Below
//this the 1 Wh meter quantum dominates the numerator and the
//derivation becomes meaningless (1 Wh / 5 s -> 720 W spike with no
//physical meaning). 60 s keeps that error under ~60 W on a 1 Wh
//meter and is short enough that the chip stays responsive.
const MIN_SLOPE_SPAN_MS = 60_000;
//Live derivation horizon. When picking the bracket for the LIVE
//chip we target now() and look for samples within this many ms
//behind now. Older brackets are not interesting for "what is
//flowing right now" and bias the chip toward a stale average. 10
//min covers Linky histo mode (10 min push cadence) without
//showing an outright stale half-hour-old value.
const LIVE_SLOPE_LOOKBACK_MS = 10 * 60_000;
//Edge tolerance for SCRUB targets that sit just outside the
//buffer. When the user drags the scrub past the buffer's first
//sample by less than this, we use the first bracket as a "best
//effort" answer; beyond that we return null so the chip hides
//cleanly instead of showing a misleading constant slope.
const SCRUB_EDGE_TOLERANCE_MS = 10 * 60_000;


export interface GridHost
{
    readonly config: HeliosConfig | undefined;
    readonly hass:   any;

    requestUpdate(): void;

    _gridImportValue: number | null;
    _gridImportUnit:  string;
    _gridExportValue: number | null;
    _gridExportUnit:  string;
    //Unit per entity (kwh / wh / mwh / w / kw). Needed for the
    //past-scrub derivation so we can convert the raw value delta
    //back to watts independently of which entity sourced the
    //samples in the buffer.
    _gridImportUnits: Map<string, string>;
    _gridExportUnits: Map<string, string>;

    //Per-entity rolling buffers, keyed by entity_id. Multi-entity
    //installs (e.g. EASF01 + EASF02) keep one buffer per source.
    _gridImportSamples: Map<string, Sample[]>;
    _gridExportSamples: Map<string, Sample[]>;
    //Last derived watts per entity, tagged with the wall-clock at
    //which the derivation landed. Used to pick the "most recently
    //updated" entity when the slot has several entities wired.
    _gridImportLastDerived: Map<string, { watts: number; t: number }>;
    _gridExportLastDerived: Map<string, { watts: number; t: number }>;
    //Combined signed grid-power slot (grid-power-entity). One buffer
    //+ unit per wired source; the per-entity signed slopes / powers
    //sum to the net grid watts, whose sign routes the value to the
    //import (>=0) or export (<0) chip.
    _gridCombinedSamples: Map<string, Sample[]>;
    _gridCombinedUnits:   Map<string, string>;
}


function ensureHistoryFetched(host: GridHost, entity: string, bufMap: Map<string, Sample[]>): void
{
    if (!host.hass?.callWS) return;
    if (_historyFetched.has(entity)) return;
    if (_historyInflight.has(entity)) return;
    _historyInflight.add(entity);
    const end   = new Date();
    const start = new Date(end.getTime() - GRID_HISTORY_WINDOW_MS);
    (async (): Promise<void> =>
    {
        try
        {
            const result: any = await host.hass.callWS({
                type:             'history/history_during_period',
                start_time:       start.toISOString(),
                end_time:         end.toISOString(),
                entity_ids:       [entity],
                minimal_response: true,
                no_attributes:    true
            });
            const arr: any[] = (result && result[entity]) ?? [];
            const merged: Sample[] = [];
            let lastV: number | null = null;
            let lastChangeT: number | null = null;
            for (const item of arr)
            {
                const sRaw = item?.s ?? item?.state;
                if (sRaw === null || sRaw === undefined || sRaw === 'unavailable' || sRaw === 'unknown' || sRaw === '') continue;
                const v = parseNumericState(sRaw);
                if (v === null) continue;
                const tsRaw = item?.lu ?? item?.lc ?? item?.last_updated ?? item?.last_changed ?? null;
                const t = parseTimestamp(tsRaw);
                if (t === null) continue;
                const realTransition = lastV !== null && lastV !== v;
                if (realTransition || lastChangeT === null) lastChangeT = t;
                merged.push({ t, v, lastChangeT });
                lastV = v;
            }
            //Merge with any live samples that may have already landed
            //while the WS call was in flight, dedupe by timestamp.
            const live = bufMap.get(entity) ?? [];
            for (const s of live) merged.push(s);
            merged.sort((a, b) => a.t - b.t);
            const deduped: Sample[] = [];
            for (const s of merged)
            {
                const last = deduped[deduped.length - 1];
                if (last && last.t === s.t) continue;
                deduped.push(s);
            }
            if (deduped.length > 0)
            {
                bufMap.set(entity, deduped);
                host.requestUpdate();
            }
            _historyFetched.add(entity);
        }
        catch { /* silent: live derivation still works once HA pushes state */ }
        finally
        {
            _historyInflight.delete(entity);
        }
    })();
}


export function refreshGrid(host: GridHost): void
{
    if (!host.hass)
    {
        if (host._gridImportValue !== null) host._gridImportValue = null;
        if (host._gridImportUnit  !== '')   host._gridImportUnit  = '';
        if (host._gridExportValue !== null) host._gridExportValue = null;
        if (host._gridExportUnit  !== '')   host._gridExportUnit  = '';
        return;
    }

    //A combined signed entity, when wired, owns both chips and the
    //two directional slots are ignored. Otherwise fall back to the
    //independent import / export slots.
    if (resolveEntities(host, 'combined').length > 0)
    {
        readCombined(host);
        return;
    }

    readSlot(host, 'import');
    readSlot(host, 'export');
}


//Config key backing each slot.
function slotKey(slot: 'import' | 'export' | 'combined'): string
{
    if (slot === 'import') return 'grid-import-entity';
    if (slot === 'export') return 'grid-export-entity';
    return 'grid-power-entity';
}


//Resolve every entity wired for a slot. Accepts both:
//  - "sensor.foo"          (single entity)
//  - ["sensor.foo", "sensor.bar"]  (multi-entity)
//Empty / missing entities are silently dropped.
function resolveEntities(host: GridHost, slot: 'import' | 'export' | 'combined'): string[]
{
    const key = slotKey(slot);
    const raw = (host.config as Record<string, unknown> | undefined)?.[key];
    if (Array.isArray(raw))
    {
        return (raw as unknown[])
            .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
            .map(s => s.trim());
    }
    if (typeof raw === 'string' && raw.trim() !== '') return [raw.trim()];
    return [];
}


function readSlot(host: GridHost, slot: 'import' | 'export'): void
{
    const entities = resolveEntities(host, slot);
    if (entities.length === 0)
    {
        applyValue(host, slot, null, '');
        return;
    }
    const bufMap     = slot === 'import' ? host._gridImportSamples      : host._gridExportSamples;
    const derivedMap = slot === 'import' ? host._gridImportLastDerived  : host._gridExportLastDerived;

    //Drop buffers + last-derived records for entities that have been
    //removed from the config (user trimmed the array in the editor).
    for (const key of Array.from(bufMap.keys()))     if (!entities.includes(key)) bufMap.delete(key);
    for (const key of Array.from(derivedMap.keys())) if (!entities.includes(key)) derivedMap.delete(key);

    let unitForOutput = '';
    let sawAny        = false;
    const nowMs       = Date.now();

    const unitsMap = slot === 'import' ? host._gridImportUnits : host._gridExportUnits;

    for (const entity of entities)
    {
        //Pull the recorder history once per session so the rolling
        //buffer carries a usable slope even when the live state is
        //silent at boot.
        ensureHistoryFetched(host, entity, bufMap);

        const stateObj = host.hass.states?.[entity];
        if (!stateObj) continue;
        const raw  = stateObj.state;
        const unit = String(stateObj.attributes?.unit_of_measurement ?? '').trim();
        if (raw === null || raw === undefined || raw === '' || raw === 'unknown' || raw === 'unavailable') continue;
        const num = parseNumericState(raw);
        if (num === null) continue;
        unitForOutput = unitForOutput || unit;
        sawAny = true;

        const u = unit.toLowerCase();
        unitsMap.set(entity, u);

        //Sample timestamp comes from the entity's last_updated so the
        //slope reflects when HA observed the value, not when we ran
        //refreshGrid. Falling back to nowMs only when last_updated is
        //missing (very old HA, or a state we forged on the fly).
        const stateTs = parseTimestamp(stateObj.last_updated)
                     ?? parseTimestamp(stateObj.last_changed)
                     ?? nowMs;

        if (u === 'wh' || u === 'kwh' || u === 'mwh')
        {
            recordCumulativeSample(bufMap, entity, num, stateTs, nowMs);
            const out = bracketedSlopeWatts(bufMap.get(entity), u, nowMs, LIVE_SLOPE_LOOKBACK_MS);
            if (out !== null)
            {
                //out.changedAt is the timestamp of the newest sample
                //in the bracket. A tariff that just stopped moving
                //sees its bracket sample age out; once everything in
                //the buffer pre-dates the lookback window, this entity
                //stops bidding for the chip and the other tariff wins.
                derivedMap.set(entity, { watts: out.watts, t: out.changedAt });
            }
            else
            {
                //Bracket couldn't produce a slope (buffer too short
                //or all samples flat). Forget any stale derivation
                //for this entity so its sibling drives the chip.
                derivedMap.delete(entity);
            }
        }
        else if (u === 'w' || u === 'kw' || u === 'mw')
        {
            //Power sensor: the value IS the watts. Tag with the
            //sensor's last_updated so cross-entity ranking still
            //works against cumulative-kWh siblings.
            derivedMap.set(entity, {
                watts: pvNormalizeToWatts(num, unit),
                t:     stateTs
            });
        }
        else
        {
            //Unknown unit: forward the raw value, tagged with the
            //entity's last_updated so it ranks competitively.
            derivedMap.set(entity, { watts: num, t: stateTs });
        }
    }

    if (!sawAny)
    {
        //No state resolved yet (entities exist but unavailable).
        //Don't seed a fake 0 W; the chip stays hidden (value null)
        //until either a live state lands or the history fetch below
        //seeds the buffer with a recorder slope.
        return;
    }

    //Pick the entity with the most recent change. If no entity has
    //a derivation yet (buffers still warming up), zero the chip out
    //rather than carrying a stale value forward, the previous
    //"keep last value" rule made a frozen sensor look live.
    let bestT     = -1;
    let bestWatts: number | null = null;
    for (const [, entry] of derivedMap)
    {
        if (entry.t > bestT)
        {
            bestT     = entry.t;
            bestWatts = entry.watts;
        }
    }
    if (bestWatts === null)
    {
        //No live derivation landed yet. Show 0 W so the chip stays
        //visible (it has an entity wired) but reads as "nothing
        //currently flowing", instead of carrying whatever stale
        //number the previous tick had.
        applyValue(host, slot, 0, unitIsEnergy(unitForOutput) ? 'W' : (unitForOutput || 'W'));
        return;
    }

    const outUnit = unitIsEnergy(unitForOutput) ? 'W' : (unitForOutput || 'W');
    applyValue(host, slot, bestWatts, outUnit);
}


//Read the combined signed grid-power slot. Each wired entity
//contributes its signed live watts (a power sensor's value, or a
//net-energy sensor's bracketed slope, both of which carry the
//import / export sign); the contributions sum to the net grid power.
//The optional grid-power-invert flips that sign once. A non-negative
//net routes to the IMPORT chip (EXPORT hides), a negative net routes
//to the EXPORT chip (IMPORT hides), so only the active direction
//shows, never both at once.
function readCombined(host: GridHost): void
{
    const entities = resolveEntities(host, 'combined');
    const bufMap   = host._gridCombinedSamples;
    const unitsMap = host._gridCombinedUnits;

    //Drop buffers / units for entities removed from the config.
    for (const key of Array.from(bufMap.keys()))   if (!entities.includes(key)) bufMap.delete(key);
    for (const key of Array.from(unitsMap.keys())) if (!entities.includes(key)) unitsMap.delete(key);

    let signedWatts = 0;
    let sawAny      = false;
    const nowMs     = Date.now();

    for (const entity of entities)
    {
        //Same recorder backfill as the directional slots so the
        //past-scrub bracket is populated even when the live state is
        //slow to push.
        ensureHistoryFetched(host, entity, bufMap);

        const stateObj = host.hass.states?.[entity];
        if (!stateObj) continue;
        const raw  = stateObj.state;
        const unit = String(stateObj.attributes?.unit_of_measurement ?? '').trim();
        if (raw === null || raw === undefined || raw === '' || raw === 'unknown' || raw === 'unavailable') continue;
        const num = parseNumericState(raw);
        if (num === null) continue;

        const u = unit.toLowerCase();
        unitsMap.set(entity, u);

        const stateTs = parseTimestamp(stateObj.last_updated)
                     ?? parseTimestamp(stateObj.last_changed)
                     ?? nowMs;

        //Every form records a sample so the scrub path can re-derive
        //the signed watts at a past instant from the same buffer.
        recordCumulativeSample(bufMap, entity, num, stateTs, nowMs);

        if (u === 'wh' || u === 'kwh' || u === 'mwh')
        {
            //Signed net-energy meter: its running total can fall while
            //exporting, so the bracketed slope already carries the sign.
            const out = bracketedSlopeWatts(bufMap.get(entity), u, nowMs, LIVE_SLOPE_LOOKBACK_MS);
            if (out !== null)
            {
                signedWatts += out.watts;
                sawAny = true;
            }
        }
        else if (u === 'w' || u === 'kw' || u === 'mw')
        {
            //Signed power sensor: the value IS the signed watts.
            signedWatts += pvNormalizeToWatts(num, unit);
            sawAny = true;
        }
        else
        {
            //Unknown unit: forward the raw signed value untouched.
            signedWatts += num;
            sawAny = true;
        }
    }

    if (!sawAny)
    {
        //No live derivation yet (states unavailable or buffers still
        //warming). Leave the chips as-is rather than flashing a fake 0.
        return;
    }

    if (gridPowerInvert(host.config)) signedWatts = -signedWatts;
    applyCombinedSplit(host, signedWatts);
}


//Route a signed net-grid wattage to exactly one directional slot:
//import when >= 0 (including the idle 0 W, so one chip stays visible
//to signal the connection is alive), export when < 0. The opposite
//slot is nulled so its chip hides.
function applyCombinedSplit(host: GridHost, signedWatts: number): void
{
    if (signedWatts >= 0)
    {
        applyValue(host, 'import', signedWatts, 'W');
        applyValue(host, 'export', null, '');
    }
    else
    {
        applyValue(host, 'import', null, '');
        applyValue(host, 'export', -signedWatts, 'W');
    }
}


function unitIsEnergy(unit: string): boolean
{
    const u = unit.toLowerCase();
    return u === 'wh' || u === 'kwh' || u === 'mwh';
}


//Parse a state value that came in as either a string or a number.
//Accepts both '.' and ',' decimal separators since some integrations
//(rare, but exist) forward the locale-formatted form. Returns null
//for anything that isn't a finite number.
function parseNumericState(raw: unknown): number | null
{
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    //Locale-tolerant: replace a single comma with a dot when the
    //string has no dot already. Avoids breaking thousand-separated
    //inputs like "12,345.6" which would otherwise parse as 12.
    const normalised = trimmed.includes('.') ? trimmed : trimmed.replace(',', '.');
    const n = parseFloat(normalised);
    return Number.isFinite(n) ? n : null;
}


function parseTimestamp(raw: unknown): number | null
{
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number')
    {
        if (!Number.isFinite(raw)) return null;
        return raw > 1e12 ? raw : raw * 1000;
    }
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum > 1e9)
    {
        return asNum > 1e12 ? asNum : asNum * 1000;
    }
    const parsed = new Date(trimmed).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}


//Push a fresh cumulative-energy reading into the per-entity buffer
//and prune the rolling window. Duplicate timestamps are skipped so
//the buffer doesn't fill with copies of the same observation when
//several refreshGrid ticks land between two HA updates.
function recordCumulativeSample(
    bufMap:  Map<string, Sample[]>,
    entity:  string,
    num:     number,
    stateTs: number,
    nowMs:   number
): void
{
    let buf = bufMap.get(entity);
    if (!buf)
    {
        buf = [];
        bufMap.set(entity, buf);
    }
    const last = buf.length > 0 ? buf[buf.length - 1] : null;
    if (!last || stateTs > last.t)
    {
        const isRealTransition = last !== null && last.v !== num;
        buf.push({
            t: stateTs,
            v: num,
            lastChangeT: isRealTransition ? stateTs : (last?.lastChangeT ?? null)
        });
    }
    //Hard cap on buffer size + drop samples older than the retention
    //window, measured against the current wall clock (so stale buffers
    //prune themselves out of memory even if no new sample lands for
    //a while).
    while (buf.length > GRID_SAMPLE_MAX) buf.shift();
    while (buf.length > 1 && nowMs - buf[0].t > GRID_SAMPLE_WINDOW_MS) buf.shift();
}


//Find the pair of samples (oldest, newest) that brackets `targetMs`
//in the buffer such that newest.t - oldest.t >= MIN_SLOPE_SPAN_MS.
//When the immediate before/after bracket is too narrow (typical
//5 s push throttle on Wh meters with 1 Wh quantum), we extend the
//bracket outward, preferring the closer side, until either the
//span exceeds MIN_SLOPE_SPAN_MS or the buffer is exhausted.
//
//Returns null when no two distinct samples can be found at all.
//
//`maxLookbackMs` constrains the LIVE path: the bracket's newest
//sample must sit within `maxLookbackMs` of targetMs so a chip that
//was last updated 10 min ago doesn't drag a stale "average" into
//the live display. SCRUB pases null to disable that constraint.
function pickBracket(
    buf:           Sample[],
    targetMs:      number,
    maxLookbackMs: number | null
): { oldest: Sample; newest: Sample } | null
{
    if (buf.length < 2) return null;
    //beforeIdx = index of the latest sample with t <= targetMs.
    //afterIdx  = index of the earliest sample with t > targetMs.
    let beforeIdx = -1;
    for (let i = 0; i < buf.length; i++)
    {
        if (buf[i].t <= targetMs) beforeIdx = i;
        else break;
    }
    let afterIdx = beforeIdx + 1;

    if (beforeIdx < 0)
    {
        //Target predates the buffer.
        if (maxLookbackMs === null)
        {
            //SCRUB path: if the target is meaningfully before the
            //buffer's first sample, refuse to extrapolate. Returning
            //the same first-two-samples bracket for every target in
            //this range would show one constant slope across hours
            //of scrub (the symptom that motivated this audit).
            //Within the edge tolerance the first bracket is still
            //used so a small gap between buffer start and the user's
            //scrub instant doesn't hide the chip needlessly.
            if (buf[0].t - targetMs > SCRUB_EDGE_TOLERANCE_MS) return null;
        }
        beforeIdx = 0;
        afterIdx  = 1;
    }
    else if (afterIdx >= buf.length)
    {
        //Target postdates the buffer (live path: target = now,
        //newest buffer sample t < now). Use the last two samples.
        beforeIdx = buf.length - 2;
        afterIdx  = buf.length - 1;
    }

    let oldest = buf[beforeIdx];
    let newest = buf[afterIdx];

    //Extend outward until the bracket spans MIN_SLOPE_SPAN_MS or we
    //can't extend any further on either side.
    while (newest.t - oldest.t < MIN_SLOPE_SPAN_MS)
    {
        const canShrinkOlder  = beforeIdx > 0;
        const canExtendNewer  = afterIdx < buf.length - 1;
        if (!canShrinkOlder && !canExtendNewer) break;
        if (!canShrinkOlder)
        {
            afterIdx++;
            newest = buf[afterIdx];
        }
        else if (!canExtendNewer)
        {
            beforeIdx--;
            oldest = buf[beforeIdx];
        }
        else
        {
            //Prefer the side whose neighbour sits closer in time so
            //the bracket grows symmetrically around the target.
            const beforeGap = oldest.t - buf[beforeIdx - 1].t;
            const afterGap  = buf[afterIdx + 1].t - newest.t;
            if (afterGap <= beforeGap)
            {
                afterIdx++;
                newest = buf[afterIdx];
            }
            else
            {
                beforeIdx--;
                oldest = buf[beforeIdx];
            }
        }
    }

    if (maxLookbackMs !== null && targetMs - newest.t > maxLookbackMs)
    {
        return null;
    }
    if (newest.t === oldest.t) return null;
    return { oldest, newest };
}


function slopeWatts(oldest: Sample, newest: Sample, u: string): number | null
{
    const dt = (newest.t - oldest.t) / 1000;
    if (dt <= 0) return null;
    let dE_wh = newest.v - oldest.v;
    if (u === 'kwh') dE_wh *= 1000;
    else if (u === 'mwh') dE_wh *= 1_000_000;
    //Power = energy / time. dE_wh is in Wh, dt is in seconds; the
    //3600 factor turns Wh per second into watts.
    return dE_wh * 3600 / dt;
}


//Internal helper used by the LIVE refresh. Returns the slope in
//watts plus the timestamp of the newest sample in the bracket so
//the multi-entity picker can rank by "moved most recently".
function bracketedSlopeWatts(
    buf:           Sample[] | undefined,
    u:             string,
    targetMs:      number,
    maxLookbackMs: number | null
): { watts: number; changedAt: number } | null
{
    if (!buf) return null;
    const bracket = pickBracket(buf, targetMs, maxLookbackMs);
    if (!bracket) return null;
    const w = slopeWatts(bracket.oldest, bracket.newest, u);
    if (w === null) return null;
    //changedAt = the timestamp of the latest REAL value transition
    //seen in this entity's buffer, not the last poll. The multi-
    //tariff picker ranks by "moved most recently", and HA pushes
    //last_updated even when the state value doesn't change, so the
    //poll time would tie HP and HC even when only HP is currently
    //incrementing. Falling back to newest.t when lastChangeT is
    //null preserves the legacy ordering on the very first sample
    //of a buffer.
    const changedAt = bracket.newest.lastChangeT ?? bracket.newest.t;
    return { watts: w, changedAt };
}


//Derive the grid watts AT (or as close as possible to) a target
//timestamp, used by the past-scrub render. Sums the bracketed slope
//of every entity in the slot, so multi-tariff installs (HP + HC)
//combine into the actual power that was flowing at the scrub
//instant, the inactive tariff contributing 0 W because its bracket
//is flat across the target.
//
//Returns null when no buffer can produce a bracket at all.
export function gridWattsAtTime(
    samples:  Map<string, Sample[]>,
    units:    Map<string, string>,
    targetMs: number,
): number | null
{
    let total: number = 0;
    let anyHit: boolean = false;
    for (const [entity, buf] of samples)
    {
        if (buf.length < 2) continue;
        const u = (units.get(entity) ?? 'kwh').toLowerCase();
        if (u !== 'wh' && u !== 'kwh' && u !== 'mwh')
        {
            //Power-native sensor: closest sample wins (no
            //integration needed).
            let best = buf[0];
            let bestDt = Math.abs(buf[0].t - targetMs);
            for (let i = 1; i < buf.length; i++)
            {
                const d = Math.abs(buf[i].t - targetMs);
                if (d < bestDt) { best = buf[i]; bestDt = d; }
            }
            //pvNormalizeToWatts is the same conversion used live so
            //kW / MW power-native sensors stay consistent across the
            //two paths.
            const watts = u === 'kw' ? best.v * 1000 : u === 'mw' ? best.v * 1_000_000 : best.v;
            total += watts;
            anyHit = true;
            continue;
        }
        //Cumulative-energy sensor.
        const bracket = pickBracket(buf, targetMs, null);
        if (!bracket) continue;
        const w = slopeWatts(bracket.oldest, bracket.newest, u);
        if (w === null) continue;
        total += w;
        anyHit = true;
    }
    return anyHit ? total : null;
}


//True when the user wired a combined signed grid-power entity, which
//then owns both chips and supersedes the separate import / export
//slots. Used by the card to pick the right scrub derivation and by
//the editor to collapse the directional pickers.
export function isGridCombined(config: HeliosConfig | undefined): boolean
{
    const raw = (config as Record<string, unknown> | undefined)?.['grid-power-entity'];
    if (Array.isArray(raw))
    {
        return (raw as unknown[]).some(s => typeof s === 'string' && s.trim() !== '');
    }
    return typeof raw === 'string' && raw.trim() !== '';
}


//Sign-convention flag for the combined slot. Default false means
//positive = import; true flips it so positive = export.
export function gridPowerInvert(config: HeliosConfig | undefined): boolean
{
    return (config as Record<string, unknown> | undefined)?.['grid-power-invert'] === true;
}


//Past-scrub derivation for the combined slot: the net signed watts
//flowing at `targetMs`, summed across every wired source and flipped
//by grid-power-invert. The caller splits the sign into the import /
//export chips exactly as the live path does. Returns null when no
//buffer can bracket the target.
export function gridCombinedWattsAtTime(host: GridHost, targetMs: number): number | null
{
    const signed = gridWattsAtTime(host._gridCombinedSamples, host._gridCombinedUnits, targetMs);
    if (signed === null) return null;
    return gridPowerInvert(host.config) ? -signed : signed;
}


function applyValue(host: GridHost, slot: 'import' | 'export', value: number | null, unit: string): void
{
    //Negative on a directional grid slot has no physical meaning:
    //a negative IMPORT is a moment of EXPORT (already reported by
    //the export slot), and a negative EXPORT is a moment of import.
    //Clamping to 0 keeps the chip readable and prevents the bead
    //animation (driven by the absolute watts) from running on a
    //direction the slot was never wired to represent.
    const clamped = (value === null) ? null : Math.max(0, value);
    if (slot === 'import')
    {
        if (host._gridImportValue !== clamped) host._gridImportValue = clamped;
        if (host._gridImportUnit  !== unit)    host._gridImportUnit  = unit;
    }
    else
    {
        if (host._gridExportValue !== clamped) host._gridExportValue = clamped;
        if (host._gridExportUnit  !== unit)    host._gridExportUnit  = unit;
    }
}


//Display helper that formats the grid chip value + unit. Watts get
//the same "round to integer when >100, one decimal otherwise"
//treatment as the PV chip; kWh keeps two decimals. Returns the
//empty string when the value is null so callers can collapse the
//chip without an explicit conditional.
export function formatGridValue(value: number | null, unit: string): string
{
    if (value === null) return '';
    const u = unit.toLowerCase();
    if (u === 'w' || u === 'kw' || u === 'mw')
    {
        const w = pvNormalizeToWatts(value, unit);
        if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(1)} kW`;
        if (Math.abs(w) >= 100)  return `${Math.round(w)} W`;
        return `${w.toFixed(1)} W`;
    }
    if (u === 'wh' || u === 'kwh' || u === 'mwh')
    {
        return `${value.toFixed(2)} ${unit}`;
    }
    //Unknown unit: show the raw value + whatever unit HA reported.
    return unit ? `${value} ${unit}` : String(value);
}
