//The home consumption (load) identity, the single source of the "measured values only" rule:
//load = production + grid import - grid export - net battery (charge positive), clamped at 0.
//Callers resolve their own inputs to numbers (null/NaN -> 0) before calling.
export function consumptionLoad(
    production: number,
    gridImport: number,
    gridExport: number,
    netBattery: number
): number
{
    return Math.max(0, production + gridImport - gridExport - netBattery);
}
