//Equipment detectors. Lightweight predicates the radial dial layout and the view toggle use to
//decide which rings to draw and whether the graph view is even useful to expose. Read off the host
//snapshot only, no side effects, safe to call on every render.

import type { EnergyDefaults } from './energy-prefs';

export interface EquipmentHost
{
    readonly _energyDefaults: EnergyDefaults;
}


//True when the user has at least one HA Energy solar source wired (live stat_rate OR cumulative
//stat_energy_from). PV is resolved exclusively from the HA Energy dashboard now: there is no
//per-card PV config. False when the dashboard would draw an empty production ring, in which case
//the radial layout drops the production ring entirely and the view toggle hides itself.
export function hasPvConfigured(host: EquipmentHost): boolean
{
    const ed = host._energyDefaults;
    if (ed.solarStatRates.length > 0) { return true; }
    if (ed.solarStatEnergyFroms.length > 0) { return true; }
    return false;
}


//True when the user has at least one HA Energy battery source wired (signed power, charge or
//discharge cumulative, or SoC). False drops the battery ring from the radial layout.
export function hasBatteryConfigured(host: EquipmentHost): boolean
{
    const ed = host._energyDefaults;
    if (ed.batteryStatRates.length > 0) { return true; }
    if (ed.batteryStatEnergyFroms.length > 0) { return true; }
    if (ed.batteryStatEnergyTos.length > 0) { return true; }
    if (ed.batteryStatSocs.length > 0) { return true; }
    return false;
}
