//Equipment detectors. Predicates the radial dial layout and view toggle use to decide which rings to
//draw and whether the graph view is worth exposing. Read off the host snapshot only, no side effects.

import type { EnergyDefaults } from './energy-prefs';

export interface EquipmentHost
{
    readonly _energyDefaults: EnergyDefaults;
}


//True when at least one HA Energy solar source is wired (live stat_rate or cumulative
//stat_energy_from). PV is resolved exclusively from the HA Energy dashboard now (no per-card PV
//config). When false, the radial layout drops the production ring and the view toggle hides itself.
export function hasPvConfigured(host: EquipmentHost): boolean
{
    const ed = host._energyDefaults;
    if (ed.solarStatRates.length > 0) { return true; }
    if (ed.solarStatEnergyFroms.length > 0) { return true; }
    return false;
}


//True when at least one HA Energy battery source is wired (signed power, charge/discharge cumulative,
//or SoC). When false, the battery ring is dropped from the radial layout.
export function hasBatteryConfigured(host: EquipmentHost): boolean
{
    const ed = host._energyDefaults;
    if (ed.batteryStatRates.length > 0) { return true; }
    if (ed.batteryStatEnergyFroms.length > 0) { return true; }
    if (ed.batteryStatEnergyTos.length > 0) { return true; }
    if (ed.batteryStatSocs.length > 0) { return true; }
    return false;
}
