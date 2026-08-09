//Live cost rate for the cost chip: the NET money flow right now, in the user's currency per hour.
//
//net rate = import cost - export revenue = importPrice x importPower - exportPrice x exportPower,
//with power taken from the already-computed live grid slots and price per the HYBRID rule agreed for the feature:
//  - a single configured price (one entity, or one static number) -> that price, measured, exact, no lag;
//  - several prices (a multi-tariff grid, e.g. Tempo) -> resolved later from the recent stat_cost/stat_energy
//    delta (the effective active price); until that lands the rate is left null so the chip hides rather than
//    guessing the wrong tariff.
//
//Everything is absent unless the user configured cost in the Energy dashboard, matching Helios' rule: measured or
//absent, never invented. Positive rate = you are spending; negative = you are earning (solar surplus sold).

import { parseNumericState, pvNormalizeToWatts } from '../../core/format/format';
import type { EnergyDefaults } from './energy-prefs';
import { fetchChangeById, mergeChangeSeries, wattsAtFromChangeSeries, changeRefreshAnchorMs, type ChangeBucket, type StatPeriod } from './energy-stats';
import { localMidnightMinusDays } from '../../core/time/timezone';
import type { KeyedFetch } from '../source-fetch';


export interface CostHost
{
    readonly hass: any;
    readonly _energyDefaults?: EnergyDefaults;
    //Live grid slots, already resolved by grid.ts (measured or null).
    _gridImportValue: number | null;
    _gridImportUnit:  string;
    _gridExportValue: number | null;
    _gridExportUnit:  string;
    //Rolling past-window days + recorder period, for the cost `change` fetch (same span as the store).
    readonly _periodPastDays:   number;
    readonly _storeFetchPeriod: StatPeriod;
    requestUpdate(): void;
    //Recorder `change` series for the cost (`stat_cost`) + compensation (`stat_compensation`) statistics, summed
    //across flows. Δ per bucket is money, so a rate is Δ / bucketHours. Null until first fetch (or none configured).
    _costImportSeries: ChangeBucket[] | null;
    _costExportSeries: ChangeBucket[] | null;
    _costFetch: KeyedFetch;
    //Net live cost rate in `_currency` per hour. Positive = spending, negative = earning. Null = not computable
    //(no cost configured at all).
    _costRate: number | null;
    //The user's currency symbol/code, from hass.config.currency (falls back to a bare euro sign).
    _currency: string;
}

//Fetch the recorder `change` series for the cost + compensation statistics over the past window, so the cost chip's
//live rate AND its curve read HA's OWN money numbers, computed at the correct tariff for every hour (Tempo, HC/HP,
//a total-cost integration sensor: all handled, since HA already priced them). Gated like the grid fetch.
export function refreshCostSeries(host: CostHost): void
{
    const d = host._energyDefaults;
    if (!d) { return; }
    const ids = [...d.gridStatCosts, ...d.gridStatCompensations];
    if (ids.length === 0) { return; }
    const startMs = localMidnightMinusDays(host._periodPastDays);
    const endMs   = changeRefreshAnchorMs();
    const sorted  = [...ids].sort();
    const key = `cost|${sorted.join(',')}|${startMs}|${endMs}`;
    host._costFetch.run(key, () =>
        fetchChangeById(host.hass, sorted, startMs, endMs, host._storeFetchPeriod).then((byId) =>
        {
            if (byId === null) { return; }
            host._costImportSeries = mergeChangeSeries(byId, d.gridStatCosts);
            host._costExportSeries = mergeChangeSeries(byId, d.gridStatCompensations);
            host.requestUpdate();
        }));
}

//Net cost rate (currency/hour) at an instant, from the fetched cost statistics: import cost rate minus export
//compensation rate. wattsAtFromChangeSeries gives Δvalue x 1000 / hours, so /1000 turns money-Δ into money/hour.
//Null when no cost series is loaded (caller then falls back to price x power, or draws nothing).
export function costRateAt(
    host: { _costImportSeries: ChangeBucket[] | null; _costExportSeries: ChangeBucket[] | null },
    atMs: number,
): number | null
{
    if (!host._costImportSeries && !host._costExportSeries) { return null; }
    const impW = wattsAtFromChangeSeries(host._costImportSeries, atMs);
    const expW = wattsAtFromChangeSeries(host._costExportSeries, atMs);
    if (impW === null && expW === null) { return null; }
    return ((impW ?? 0) - (expW ?? 0)) / 1000;
}

//Live cost rate from the most recent committed cost bucket (net). Null when no cost series is loaded.
function latestCostRate(host: CostHost): number | null
{
    const imp = host._costImportSeries;
    const exp = host._costExportSeries;
    if ((!imp || imp.length === 0) && (!exp || exp.length === 0)) { return null; }
    const bucketRate = (b: ChangeBucket | undefined): number =>
    {
        if (!b) { return 0; }
        const h = (b.endMs - b.startMs) / 3_600_000;
        return h > 0 ? b.kwh / h : 0;
    };
    const impR = imp && imp.length > 0 ? bucketRate(imp[imp.length - 1]) : 0;
    const expR = exp && exp.length > 0 ? bucketRate(exp[exp.length - 1]) : 0;
    return impR - expR;
}


//Resolve a single €/kWh price for one direction: exactly one price entity -> its live numeric state; else exactly
//one static number -> that number; otherwise null (no price, or a multi-tariff set handled by the effective-price
//path later). Never averages several tariffs: that would misprice the moment.
function singlePrice(hass: CostHost['hass'], entities: string[], numbers: number[]): number | null
{
    if (entities.length === 1)
    {
        return parseNumericState(hass?.states?.[entities[0]]?.state);
    }
    if (entities.length === 0 && numbers.length === 1)
    {
        return numbers[0];
    }
    return null;
}

//The single static price (currency/kWh) for one direction, or null when there is none or a multi-tariff set.
//Used by the durable cost curve: with a constant price, cost = energy x price is exact across the WHOLE history
//(no HA stat_cost backfill needed). Variable (entity) prices are handled separately, later.
export function staticPrice(numbers: number[]): number | null
{
    return numbers.length === 1 ? numbers[0] : null;
}

//Power of a live grid slot in kW (0 when the slot is empty), normalising whatever unit the meter reports.
function slotKw(value: number | null, unit: string): number
{
    return value === null ? 0 : pvNormalizeToWatts(value, unit) / 1000;
}

//Recompute the live net cost rate onto the host. Cheap; call it on the same cadence as the grid live refresh.
export function refreshCostLive(host: CostHost): void
{
    host._currency = String(host.hass?.config?.currency ?? '€');

    //1) Universal path: HA's own cost statistics (correct for any tariff, incl. Tempo + a total-cost sensor). Live
    //   is the most recent committed bucket's net rate. Preferred whenever cost stats are configured.
    const fromStats = latestCostRate(host);
    if (fromStats !== null)
    {
        if (host._costRate !== fromStats) { host._costRate = fromStats; }
        return;
    }

    //2) Fallback: a single configured PRICE x live power (no cost statistic, e.g. only a static/current price set).
    const d = host._energyDefaults;
    const hasAnyPrice = !!d && (
        d.gridImportPrices.length > 0 || d.gridImportPriceNumbers.length > 0
        || d.gridExportPrices.length > 0 || d.gridExportPriceNumbers.length > 0);
    if (!d || !hasAnyPrice)
    {
        if (host._costRate !== null) { host._costRate = null; }
        return;
    }

    const importPrice = singlePrice(host.hass, d.gridImportPrices, d.gridImportPriceNumbers);
    const exportPrice = singlePrice(host.hass, d.gridExportPrices, d.gridExportPriceNumbers);

    //No resolvable import price (0 or multi-tariff): leave the rate null for now (Inc. 2 fills multi-tariff from
    //the effective price). Export-only pricing with no import price is not a real setup, so gate on import.
    if (importPrice === null)
    {
        if (host._costRate !== null) { host._costRate = null; }
        return;
    }

    const cost = importPrice * slotKw(host._gridImportValue, host._gridImportUnit);
    const revenue = exportPrice === null ? 0 : exportPrice * slotKw(host._gridExportValue, host._gridExportUnit);
    const rate = cost - revenue;
    if (host._costRate !== rate) { host._costRate = rate; }
}
