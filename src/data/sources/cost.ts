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


export interface CostHost
{
    readonly hass: any;
    readonly _energyDefaults?: EnergyDefaults;
    //Live grid slots, already resolved by grid.ts (measured or null).
    _gridImportValue: number | null;
    _gridImportUnit:  string;
    _gridExportValue: number | null;
    _gridExportUnit:  string;
    //Net live cost rate in `_currency` per hour. Positive = spending, negative = earning. Null = not computable
    //(no cost configured, or a multi-tariff price not yet resolvable).
    _costRate: number | null;
    //The user's currency symbol/code, from hass.config.currency (falls back to a bare euro sign).
    _currency: string;
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
