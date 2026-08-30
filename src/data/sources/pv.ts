//Photovoltaic data subsystem: live polling, history/LTS fetch, instantaneous-rate derivation, calibration, chip/chart formatting.
//
//Functions operate on a "host" (the card) that owns the @state PV fields. Writing back through the card's setters preserves
//Lit reactivity, so calling refreshPv(this) from a lifecycle hook re-renders.

import type { HassLike } from '../../core/ha-types';
import type { HeliosConfig } from '../../core/config/helios-config';
import { unionChangeMeters, type EnergyDefaults } from './energy-prefs';
import { formatEntityValue, parseNumericState, type PowerUnit } from '../../core/format/format';
import { fetchChangeById, mergeChangeSeries, extractPerEntity, wattsAtFromChangeSeries, changeRefreshAnchorMs, type ChangeBucket, type StatPeriod } from './energy-stats';
import { sumLiveWatts, type KeyedFetch } from '../source-fetch';
import { localMidnightMinusDays } from '../../core/time/timezone';
//Re-export so battery/grid/charts/helios-card can import pvNormalizeToWatts from './pv'.
export { pvNormalizeToWatts } from '../../core/format/format';


//Resolve the live PV entity: the first declared power sensor (`stat_rate`), or empty when the install
//has none. Measured-only: a cumulative meter is never treated as a live entity; installs without a
//power sensor simply have no live PV state (their curves and totals read the recorder meters). The
//history/calibration fetches key on the meters separately.
export function resolvePvLiveEntity(defaults: EnergyDefaults): string
{
    return defaults.solarStatRates[0] ?? '';
}




//Result of a rate computation. `unit` is what the PV chip prints after the value (always 'W').
export interface PvRate
{
    value: number;
    unit:  string;
}

//Structural surface the host card exposes here. The mutable `_pv*` fields are non-readonly so helpers can assign them;
//@state reactivity is preserved because assignment hits the decorator's setter.
export interface PvHost
{
    readonly config:     HeliosConfig | undefined;
    readonly hass:       HassLike;
    readonly _timeRange: { start: Date; end: Date } | null;
    readonly _energyDefaults: EnergyDefaults;
    //Rolling-window past days (period selector), so the change-series fetch spans the whole store window.
    readonly _periodPastDays: number;
    //Recorder period for the change-series, per the active timeline mode (5-min / hour / day).
    readonly _storeFetchPeriod: StatPeriod;

    requestUpdate(): void;

    _pvCurrent:             number | null;
    _pvUnit:                string;
    //Recorder `change` series for the solar energy meter(s), 5-minute buckets. Canonical past-production source for the unified
    //store (timeline graphs) and chip scrub: the recorder returns reset-corrected, unit-normalised kWh per bucket, the same
    //metric the HA Energy dashboard consumes, so plotted production matches it without client-side differentiation. Null pre-fetch.
    _pvChangeSeries:         ChangeBucket[] | null;
    _pvChangeFetch:          KeyedFetch;
    //Per-source recorder `change` series, keyed by the source's energy meter (`stat_energy_from`). Same reset-corrected,
    //unit-normalised 5-minute buckets as `_pvChangeSeries`, but split per HA Energy solar source so the period
    //aggregation shows each string with the exact dashboard energy (and recorded night production from non-solar
    //sources fed in as PV), instead of re-differentiating the lagging hourly LTS. Empty until the per-source fetch lands.
    _pvChangeSeriesPerEntity:    Map<string, ChangeBucket[]>;
}


//Live + history refresh, called every lifecycle cycle. Fast paths exit early when no entity is configured or the (entity, range)
//tuple matches the last successful fetch.
export function refreshPv(host: PvHost): void
{
    if (!host.hass)
    {
        return;
    }
    const entity = resolvePvLiveEntity(host._energyDefaults);
    const meters = host._energyDefaults.solarStatEnergyFroms;

    if (!entity && meters.length === 0)
    {
        //Nothing configured: clear so the chip disappears instead of sticking with stale data.
        if (host._pvCurrent !== null)
        {
            host._pvCurrent = null;
            host._pvUnit    = '';
        }
        return;
    }
    if (!entity && host._pvCurrent !== null)
    {
        //Live sensors unwired (measured-only: the chip has no live state); curves and scrub below keep
        //reading the recorder meters.
        host._pvCurrent = null;
        host._pvUnit    = '';
    }

    //Multi-source LIVE aggregation across the declared power sensors ONLY (measured-only: cumulative
    //meters never masquerade as live entities). A split E/W install with a stat_rate per source sees the
    //SUM of every sensor on chip, tooltip and headline.
    const liveEntities  = host._energyDefaults.solarStatRates;
    const isMultiEntity = liveEntities.length > 1;

    //Live state read, always cheap, runs on every Lit cycle. Skipped entirely without a power sensor.
    const stateObj = entity ? host.hass.states?.[entity] : undefined;
    if (stateObj)
    {
        let nextValue: number | null = null;
        let nextUnit = '';
        if (isMultiEntity)
        {
            //Sum raw values across every live power sensor, keeping the first valid sample's unit (W/kW/MW).
            //Disagreeing per-source units are an HA config error, so this trusts the single-unit assumption HA
            //enforces per Energy block and skips per-sample normalisation.
            let sumValue  = 0;
            let firstUnit = '';
            let anyValid  = false;
            for (const id of liveEntities)
            {
                const so = host.hass.states?.[id];
                if (!so)
                {
                    continue;
                }
                const v = parseNumericState(so.state);
                if (v === null)
                {
                    continue;
                }
                if (!firstUnit)
                {
                    firstUnit = String(so.attributes?.unit_of_measurement ?? '');
                }
                sumValue += v;
                anyValid = true;
            }
            if (anyValid)
            {
                nextValue = sumValue;
                nextUnit  = firstUnit;
            }
        }
        else
        {
            nextValue = parseNumericState(stateObj.state);
            nextUnit  = stateObj.attributes?.unit_of_measurement ?? '';
        }
        if (nextValue !== host._pvCurrent)
        {
            host._pvCurrent = nextValue;
        }
        if (nextUnit !== host._pvUnit)
        {
            host._pvUnit = nextUnit;
        }
    }
    else if (host._pvCurrent !== null)
    {
        host._pvCurrent = null;
    }

    if (!host._timeRange)
    {
        return;
    }
    //Past-production curve for the unified store + chip scrub. From the recorder `change` metric on the solar ENERGY meter(s)
    //(`stat_energy_from`), like the HA Energy dashboard: reset-corrected, unit-normalised kWh per 5-min bucket, divided by bucket
    //duration for average watts. No client-side differentiation, so coarse-reporting or daily-reset meters work natively.
    const changeIds = meters;
    if (changeIds.length > 0)
    {
        //Span the full configured past window (period selector), not a fixed 2 days, else the older days of a
        //wide window (e.g. 7 d) come back empty.
        const startMs = localMidnightMinusDays(host._periodPastDays);
        //End anchored to the refresh boundary (the recorder holds nothing beyond now, so the forecast horizon
        //is irrelevant): one call fetches the union of every source's meters, and RequestCache collapses pv/
        //grid/battery to a single recorder round-trip. Each source then merges its own ids from the result.
        const endMs = changeRefreshAnchorMs();
        const sortedUnion = [...unionChangeMeters(host._energyDefaults)].sort();
        const key = `${sortedUnion.join(',')}|${startMs}|${endMs}`;
        host._pvChangeFetch.run(key, () =>
            fetchChangeById(host.hass, sortedUnion, startMs, endMs, host._storeFetchPeriod)
                .then((byId) =>
                {
                    if (byId === null)
                    {
                        return;
                    }
                    const agg = mergeChangeSeries(byId, changeIds);
                    if (agg !== null)
                    {
                        host._pvChangeSeries = agg;
                    }
                    //Per-source series (the period aggregation splits production by meter): read each meter's own
                    //buckets from the same per-id result, no extra call. Only meaningful with 2+ sources.
                    if (changeIds.length >= 2)
                    {
                        const next = extractPerEntity(byId, changeIds);
                        if (next.size > 0)
                        {
                            host._pvChangeSeriesPerEntity = next;
                        }
                    }
                    host.requestUpdate();
                }));
    }
}








//Production rate at an arbitrary historical time (timeline scrubbed into the past). Reads average power from the recorder
//`change` series (5-min buckets): resets + unit conversion already handled, so it's a single bucket lookup, no differentiation.
//Returns null when no bucket covers the instant (future scrub or recorder gap), hiding the chip. Watts floored at zero so a
//net-meter quirk never surfaces as negative production.
export function pvRateAtTime(host: PvHost, time: Date): PvRate | null
{
    const w = wattsAtFromChangeSeries(host._pvChangeSeries, time.getTime());
    if (w === null)
    {
        return null;
    }
    return { value: Math.max(0, w), unit: 'W' };
}


//Narrow host for the live PV read: just the live chip fields, no history/store surface.
export interface PvLiveHost
{
    readonly hass:            HassLike;
    readonly _energyDefaults: EnergyDefaults;
    _pvCurrent: number | null;
    _pvUnit:    string;
}


//Live "now" PV rate: measured or absent. With power sensors (`stat_rate`), read their states directly,
//summed across every wired source, like the HA Energy live tile. Without one, return null so the chip
//hides (and the editor explains what to configure): a live value is never derived from the cumulative
//meters. Past curves and scrub keep reading the recorder series regardless.
export function currentPvRate(host: PvLiveHost): PvRate | null
{
    const rates = host._energyDefaults.solarStatRates;
    if (rates.length === 0)
    {
        return null;
    }
    const { watts, any } = sumLiveWatts(host.hass, rates);
    if (!any)
    {
        return null;
    }
    return { value: Math.max(0, watts), unit: 'W' };
}







//Format a PV reading for the chip below the home. Power prints in the card's configured unit (W or kW); energy keeps
//its native unit. Thin wrapper over the shared formatter.
export function formatPvValue(hass: HassLike, value: number, unit: string, decimals: number, powerU: PowerUnit = 'kW'): string
{
    return formatEntityValue(hass, value, unit, decimals, powerU);
}
