//Single source of truth for every chip's configurable colour + icon. The scene chips, the timeline curves and
//tooltips, the detail mini-panel and the editor all resolve appearance through here, so a colour/icon set once in
//"Entity display" shows up everywhere. Each energy state (production, both grid directions, both battery
//directions, irradiance, home) is a "slot": its config keys, its editor default swatch, and the theme colour +
//built-in glyph it falls back to when the user hasn't overridden it. Groups keep their own resolver
//(monitoringGroupColor / groupColorHex / monitoringGroupIcon) since they are dynamic (1..4, user-named).

import type { HeliosConfig } from './helios-config';
import { cssHex, resolveUiColor } from '../format/format';
import { SUN_COLOR_HEX } from './constants';

export type ChipSlot =
    | 'irradiance' | 'production' | 'gridImport' | 'gridExport'
    | 'batteryCharge' | 'batteryDischarge' | 'home';

interface SlotDef
{
    colorKey:       keyof HeliosConfig;
    iconKey:        keyof HeliosConfig;
    //Editor ui_color picker default swatch (an HA colour name).
    uiColorDefault: string;
    //Theme var carrying the built-in colour ('' when the default is a fixed hex with no theme token).
    colorVar:       string;
    fallbackHex:    string;
    //Built-in glyph, used when the chip has no live-state icon to fall back to.
    defaultIcon:    string;
}

export const CHIP_SLOTS: Record<ChipSlot, SlotDef> = {
    irradiance:       { colorKey: 'chip-irradiance-color',        iconKey: 'chip-irradiance-icon',        uiColorDefault: 'amber',       colorVar: '',                                fallbackHex: SUN_COLOR_HEX, defaultIcon: 'mdi:weather-sunny' },
    production:       { colorKey: 'chip-production-color',        iconKey: 'chip-production-icon',        uiColorDefault: 'orange',      colorVar: '--energy-solar-color',            fallbackHex: '#ff9800',     defaultIcon: 'mdi:solar-power' },
    gridImport:       { colorKey: 'chip-grid-import-color',       iconKey: 'chip-grid-import-icon',       uiColorDefault: 'blue',        colorVar: '--energy-grid-consumption-color', fallbackHex: '#488fc2',     defaultIcon: 'mdi:transmission-tower-export' },
    gridExport:       { colorKey: 'chip-grid-export-color',       iconKey: 'chip-grid-export-icon',       uiColorDefault: 'deep-purple', colorVar: '--energy-grid-return-color',      fallbackHex: '#8353d1',     defaultIcon: 'mdi:transmission-tower-import' },
    batteryCharge:    { colorKey: 'chip-battery-charge-color',    iconKey: 'chip-battery-charge-icon',    uiColorDefault: 'pink',        colorVar: '--energy-battery-in-color',       fallbackHex: '#f06292',     defaultIcon: 'mdi:battery-charging' },
    batteryDischarge: { colorKey: 'chip-battery-discharge-color', iconKey: 'chip-battery-discharge-icon', uiColorDefault: 'teal',        colorVar: '--energy-battery-out-color',      fallbackHex: '#4db6ac',     defaultIcon: 'mdi:battery' },
    home:             { colorKey: 'chip-home-color',              iconKey: 'chip-home-icon',              uiColorDefault: 'primary',     colorVar: '--primary-color',                 fallbackHex: '#4caf50',     defaultIcon: 'mdi:home' },
};

//A slot's built-in colour (no override): its theme var resolved to hex, else the fixed fallback hex.
function chipSlotBaseColor(el: Element | null | undefined, slot: ChipSlot): string
{
    const def = CHIP_SLOTS[slot];
    return def.colorVar ? cssHex(el, def.colorVar, def.fallbackHex) : def.fallbackHex;
}

//Resolve a slot's colour to a concrete hex (safe for canvas fills + inline styles): the override token when set
//(a ui_color name resolved off the live theme, or a #/rgb literal), else the built-in colour.
export function chipSlotColor(el: Element | null | undefined, config: HeliosConfig | undefined, slot: ChipSlot): string
{
    const base = chipSlotBaseColor(el, slot);
    const raw  = (config as Record<string, unknown> | undefined)?.[CHIP_SLOTS[slot].colorKey as string];
    const token = typeof raw === 'string' ? raw.trim() : '';
    return resolveUiColor(el, token, base);
}

//Resolve a slot's icon: the override when set, else `dynamicDefault` when the caller has a live-state glyph (grid
//direction, battery level, cloud cover), else the slot's built-in default.
export function chipSlotIcon(config: HeliosConfig | undefined, slot: ChipSlot, dynamicDefault?: string): string
{
    const raw = (config as Record<string, unknown> | undefined)?.[CHIP_SLOTS[slot].iconKey as string];
    const s = typeof raw === 'string' ? raw.trim() : '';
    return s || dynamicDefault || CHIP_SLOTS[slot].defaultIcon;
}
