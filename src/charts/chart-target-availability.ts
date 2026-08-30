//First selectable chart target that is both CONFIGURED (its source exists in the Energy dashboard) and VISIBLE
//(its chip is not hidden), in the fixed cluster order consumption -> production -> grid -> battery -> groups.
//Used to retarget the chart off a metric that just became unavailable (e.g. a weather chip when a no-weather
//timeline mode is entered) without landing on a chip the user has no source for or has hidden. Null when nothing
//qualifies: the caller then keeps the current target and the chart simply draws nothing.

import type { HeliosConfig } from '../core/config/helios-config';
import { chipVisible, groupChipVisible } from '../core/config/helios-config';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import { activeGroups } from '../data/sources/device-consumption';
import { groupTarget, type ChartTarget } from './charts';


function hasSolar(d: EnergyDefaults): boolean
{
    return d.solarStatRates.length > 0 || d.solarStatEnergyFroms.length > 0;
}

function hasGrid(d: EnergyDefaults): boolean
{
    return d.gridStatRates.length > 0 || d.gridStatEnergyFroms.length > 0 || d.gridStatEnergyTos.length > 0;
}

function hasBattery(d: EnergyDefaults): boolean
{
    return d.batteryStatRates.length > 0 || d.batteryStatEnergyFroms.length > 0 || d.batteryStatEnergyTos.length > 0;
}


export function firstAvailableChartTarget(config: HeliosConfig | undefined, defaults: EnergyDefaults): ChartTarget | null
{
    //Consumption (home) is the dashboard balance, so it stands as long as any energy family feeds it.
    if (chipVisible(config, 'chip-home-visible') && (hasSolar(defaults) || hasGrid(defaults) || hasBattery(defaults)))
    {
        return 'consumption';
    }
    if (chipVisible(config, 'chip-production-visible') && hasSolar(defaults))
    {
        return 'production';
    }
    if (chipVisible(config, 'chip-grid-visible') && hasGrid(defaults))
    {
        return 'grid';
    }
    if (chipVisible(config, 'chip-battery-visible') && hasBattery(defaults))
    {
        return 'battery';
    }
    for (const g of activeGroups(config, defaults))
    {
        if (groupChipVisible(config, g))
        {
            return groupTarget(g);
        }
    }
    return null;
}
