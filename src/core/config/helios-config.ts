//Public config schema for the card: the option keys the user touches via YAML or the visual editor, plus
//the resolver helpers the editor + runtime read. The DEFAULT_*/MIN/MAX values live in constants.ts; this
//module imports them for the resolvers and re-exports them for `from './helios-config'` consumers.

import {
    DEFAULT_DISPLAY_RADIUS_M, MIN_DISPLAY_RADIUS_M, MAX_DISPLAY_RADIUS_M,
    DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    DEFAULT_VALUE_DECIMALS, MIN_VALUE_DECIMALS, MAX_VALUE_DECIMALS,
    DEFAULT_BUILDING_COUNT, MIN_BUILDING_COUNT, MAX_BUILDING_COUNT,
    FIXED_BUILDING_HEIGHT_M, MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M,
} from './constants';

export {
    DEFAULT_BUILDING_OPACITY,
    DEFAULT_BUILDING_CLUSTER_RADIUS_M, DEFAULT_DISPLAY_RADIUS_M, MIN_DISPLAY_RADIUS_M,
    MAX_DISPLAY_RADIUS_M, DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, DEFAULT_VALUE_DECIMALS,
    MIN_VALUE_DECIMALS, MAX_VALUE_DECIMALS,
    DEFAULT_SHADOW_OPACITY,
    DEFAULT_BUILDING_COUNT, MIN_BUILDING_COUNT, MAX_BUILDING_COUNT,
    FIXED_BUILDING_HEIGHT_M, MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M,
} from './constants';


//User-facing config passed to setConfig(), read by the engine + editor. Every key is optional and typed
//`unknown`; callers validate/coerce, and the DEFAULT_* consts below fill in absent keys.
export interface HeliosConfig
{
    //Index signature so unknown keys read as `unknown` without widening errors; the editor strips any
    //key not in the named schema below on save.
    [key: string]: unknown;
    //Storage + render cadence in buckets/hour for the unified data source and every graph. Range 1-60,
    //default 4 (15 min). Higher = finer curves at more CPU/memory. Forecast stays hourly, then interpolated.
    'display-update-frequency-per-hour'?: unknown;
    //Idle-camera orbit opt-in. Default false.
    'auto-rotate-enabled'?:    unknown;
    //Camera pose pinned at init (degrees), overriding the auto-default (pitch 55, bearing toward the
    //equator). pitch 15..85, bearing 0..359; either can be set alone. Drag still works unless camera-locked.
    'camera-pitch-deg'?:       unknown;
    'camera-bearing-deg'?:     unknown;
    //When true, drag-rotate/pitch and the idle orbit are disabled so the camera stays at the configured pose. Default false.
    'camera-locked'?:          unknown;
    //Global display radius (m) around the home within which buildings and shadows render. Clamped [50,500],
    //default 200. Lowering it is the main perf lever on weak hardware.
    'display-radius'?:         unknown;
    //Opacity 0..1 of surrounding buildings (home stays 1.0). Default 0.5.
    'building-opacity'?:       unknown;
    //Cluster radius (m): buildings within it (or containing the home) join the home group and paint at full
    //opacity, so attached garages/verandas don't render as transparent neighbours. Default 0.
    'building-cluster-radius'?: unknown;
    //How many nearest buildings to keep around the home. Clamped [10,100], default 50.
    'building-count'?:         unknown;
    //When true (default), buildings extrude to their real heights (capped). When false, every building uses
    //the fixed `building-height` prism so the framing stays uniform.
    'building-real-size'?:     unknown;
    //Fixed prism height (m) per building when `building-real-size` is false. Clamped [3,10], default 6.
    'building-height'?:        unknown;
    //Cast-shadow master toggle. Default true.
    'shadows-enabled'?:        unknown;
    //Opacity 0..1 of the cast ground shadow layer. Default 0.32.
    'shadow-opacity'?:         unknown;
    //Home override. Used only when both parse finite + in range (lat -90..90, lon -180..180); else falls back
    //to hass.config. The window.__heliosLocationOverride debug hook still wins over this.
    'home-latitude'?:          unknown;
    'home-longitude'?:         unknown;
    //Live irradiance sensor (W/m²) at the home, preferred over the model for the live "now" reading. Past +
    //forecast still come from the model.
    'solar-irradiance-entity'?: unknown;
    //HA ui_color token for the base tint of surrounding buildings. Default 'grey'.
    'building-color'?:          unknown;
    //HA ui_color token for the home (consumption) colour: the home pill + every consumption readout. Default 'green'.
    'home-color'?:              unknown;
    //Per-card cache id. When set, the saved view (mode, filters, camera pose, lock) keys on it instead of the
    //home coordinates, so two cards on the same home keep independent state. Empty = shared per-home cache.
    'cache-id'?:                unknown;
    //Power readout unit for the whole card: 'W' or 'kW'. Default 'kW'. Energy always stays kWh.
    'power-unit'?:             unknown;
    //Irradiance (solar constant) readout unit: 'W/m²' or 'kW/m²'. Default 'W/m²'.
    'irradiance-unit'?:        unknown;
    //Battery chip sign convention: 'default' (- charging, + discharging), 'inverted' (+ charging,
    //- discharging), or 'hidden' (magnitude only). Display-only; flow direction and history are unchanged.
    'battery-sign'?:           unknown;
    //"No UI" mode: when true, the timeline and the on-card controls fade away after a short idle and reappear on
    //any input (kiosk/immersive display). Default false. See UI_AUTOHIDE_MS.
    'auto-hide-ui'?:           unknown;
    //Device visibility control. Hidden: recorder-meter ids fully excluded from every view (chips, chart).
    'hidden-devices'?:          unknown;
    //Monitoring group per device (statConsumption id -> 1..4). Absent = No group (default). Drives the group chips.
    'monitoring-groups'?:          unknown;
    //Editable group names (group number -> name). Empty/absent falls back to a localised "Group N".
    'monitoring-group-names'?:     unknown;
    //Editable group icons (group number -> mdi). Empty/absent falls back to a generic glyph.
    'monitoring-group-icons'?:     unknown;
    //Editable group colours (group number -> ui_color token or literal). Empty/absent falls back to --graph-color-N.
    'monitoring-group-colors'?:    unknown;
}


export function buildingColorToken(config: HeliosConfig | undefined): string
{
    const raw = config?.['building-color'];
    const token = typeof raw === 'string' ? raw.trim() : '';
    return token || 'grey';
}

//Resolved ui_color token for the home (consumption) colour (home pill + every consumption readout).
//Default 'green'.
export function homeColor(config: HeliosConfig | undefined): string
{
    const raw = config?.['home-color'];
    const token = typeof raw === 'string' ? raw.trim() : '';
    return token || 'green';
}


//Resolved per-card cache id (empty string when unset); isolates the saved view between same-home cards.
export function cacheId(config: HeliosConfig | undefined): string
{
    const raw = config?.['cache-id'];
    return typeof raw === 'string' ? raw.trim() : '';
}


//Resolve the bucket cadence (buckets/hour), clamped to range, defaulting on missing/invalid. Single source
//for the store builder + every cadence consumer (path builders, chart aspect...).
export function displayUpdateFrequencyPerHour(config: HeliosConfig | undefined): number
{
    const raw = config?.['display-update-frequency-per-hour'];
    const parsed   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(parsed)) { return DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR; }
    const rounded = Math.round(parsed);
    if (rounded < MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR) { return MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR; }
    if (rounded > MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR) { return MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR; }
    return rounded;
}


//Resolve the decimal-place count from `value-decimals`, clamped [0,3], defaulting on missing/invalid.
export function valueDecimals(config: HeliosConfig | undefined): number
{
    const raw = config?.['value-decimals'];
    const parsed   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(parsed)) { return DEFAULT_VALUE_DECIMALS; }
    const rounded = Math.round(parsed);
    if (rounded < MIN_VALUE_DECIMALS) { return MIN_VALUE_DECIMALS; }
    if (rounded > MAX_VALUE_DECIMALS) { return MAX_VALUE_DECIMALS; }
    return rounded;
}


//Resolved power readout unit ('W' or 'kW') for every power value on the card. Default 'kW' so existing cards
//are unchanged; energy readouts always stay kWh regardless.
export function powerUnit(config: HeliosConfig | undefined): 'W' | 'kW'
{
    return config?.['power-unit'] === 'W' ? 'W' : 'kW';
}


//Resolved irradiance (solar constant) readout unit ('W/m²' or 'kW/m²'). Default 'W/m²'.
export function irradianceUnit(config: HeliosConfig | undefined): 'W/m²' | 'kW/m²'
{
    return config?.['irradiance-unit'] === 'kW/m²' ? 'kW/m²' : 'W/m²';
}


//Resolved battery chip sign convention. Default keeps charging negative / discharging positive.
export function batterySign(config: HeliosConfig | undefined): 'default' | 'inverted' | 'hidden'
{
    const raw = config?.['battery-sign'];
    return raw === 'inverted' || raw === 'hidden' ? raw : 'default';
}


//"No UI" mode: timeline + controls fade out after an idle delay, back on any input. Default false.
export function autoHideUi(config: HeliosConfig | undefined): boolean
{
    return config?.['auto-hide-ui'] === true;
}


//Recorder-meter ids the user hid (fully excluded from every view).
export function hiddenDevices(config: HeliosConfig | undefined): Set<string>
{
    const raw = config?.['hidden-devices'];
    const out = new Set<string>();
    if (Array.isArray(raw))
    {
        for (const v of raw) { if (typeof v === 'string' && v.trim() !== '') { out.add(v.trim()); } }
    }
    return out;
}

//Number of monitoring groups a device can belong to (1..GROUP_COUNT); 0 means "No group".
export const GROUP_COUNT = 4;

//Per-group fallback colours (used when the theme lacks --graph-color-N and no colour is configured), shared by the
//scene chips, the chart and the editor pills so a group reads the same everywhere.
export const GROUP_FALLBACK_COLORS = ['#4269d0', '#efb118', '#ff725c', '#6cc5b0'];

//Monitoring group assignment: device id -> group number (1..GROUP_COUNT). Stored as an object so each device
//carries its own group independent of order/hide. Absent from the map = No group. Out-of-range values are dropped.
export function monitoringGroups(config: HeliosConfig | undefined): Map<string, number>
{
    const raw = config?.['monitoring-groups'];
    const out = new Map<string, number>();
    if (raw && typeof raw === 'object' && !Array.isArray(raw))
    {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>))
        {
            const id = k.trim();
            const g  = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
            if (id !== '' && Number.isInteger(g) && g >= 1 && g <= GROUP_COUNT) { out.set(id, g); }
        }
    }
    return out;
}

//Read a string entry from a per-group object map config key (group -> value). Empty when unset.
function groupMapString(config: HeliosConfig | undefined, key: keyof HeliosConfig, group: number): string
{
    const raw = config?.[key];
    if (raw && typeof raw === 'object' && !Array.isArray(raw))
    {
        const v = (raw as Record<string, unknown>)[String(group)];
        if (typeof v === 'string') { return v.trim(); }
    }
    return '';
}

//User-given name of a monitoring group (1..GROUP_COUNT). Empty when unset, so the consumer falls back to a
//localised "Group N".
export function monitoringGroupName(config: HeliosConfig | undefined, group: number): string
{
    return groupMapString(config, 'monitoring-group-names', group);
}

//User-picked MDI icon of a group. Empty when unset, so the consumer falls back to a generic glyph.
export function monitoringGroupIcon(config: HeliosConfig | undefined, group: number): string
{
    return groupMapString(config, 'monitoring-group-icons', group);
}

//Raw configured colour token of a group ('' when unset): a ui_color name, or a #/rgb/var literal.
export function monitoringGroupColorToken(config: HeliosConfig | undefined, group: number): string
{
    return groupMapString(config, 'monitoring-group-colors', group);
}

//Resolved CSS colour of a group (a var()/literal string for CSS contexts): the configured ui_color token when set,
//else the theme's --graph-color-N with a fixed hex fallback. One source so the chip, chart and editor read the same.
export function monitoringGroupColor(config: HeliosConfig | undefined, group: number): string
{
    const fallback = `var(--graph-color-${group}, ${GROUP_FALLBACK_COLORS[(group - 1) % GROUP_FALLBACK_COLORS.length]})`;
    const token = monitoringGroupColorToken(config, group);
    if (!token) { return fallback; }
    if (/^(#|rgb|var)/i.test(token)) { return token; }
    return `var(--${token}-color, ${fallback})`;
}


//Resolve the global display radius (m), clamped to [MIN,MAX], defaulting on invalid. Single source so
//lowering it shrinks buildings and shadows in lockstep.
export function displayRadiusM(config: HeliosConfig | undefined): number
{
    const raw = config?.['display-radius'];
    const parsed   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(parsed)) { return DEFAULT_DISPLAY_RADIUS_M; }
    const rounded = Math.round(parsed);
    if (rounded < MIN_DISPLAY_RADIUS_M) { return MIN_DISPLAY_RADIUS_M; }
    if (rounded > MAX_DISPLAY_RADIUS_M) { return MAX_DISPLAY_RADIUS_M; }
    return rounded;
}


//Resolve how many nearest buildings to keep from `building-count`, clamped [MIN,MAX], defaulting on invalid.
export function buildingCount(config: HeliosConfig | undefined): number
{
    const raw = config?.['building-count'];
    const parsed   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(parsed)) { return DEFAULT_BUILDING_COUNT; }
    const rounded = Math.round(parsed);
    if (rounded < MIN_BUILDING_COUNT) { return MIN_BUILDING_COUNT; }
    if (rounded > MAX_BUILDING_COUNT) { return MAX_BUILDING_COUNT; }
    return rounded;
}


//Resolve the real-OSM-height toggle from `building-real-size`; defaults TRUE (only an explicit false disables it).
export function buildingRealSize(config: HeliosConfig | undefined): boolean
{
    return config?.['building-real-size'] !== false;
}


//Resolve the fixed prism height (m), clamped [MIN,MAX], defaulting on invalid. Used only when
//`building-real-size` is false.
export function buildingFixedHeightM(config: HeliosConfig | undefined): number
{
    const raw = config?.['building-height'];
    const parsed   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(parsed)) { return FIXED_BUILDING_HEIGHT_M; }
    const rounded = Math.round(parsed);
    if (rounded < MIN_BUILDING_HEIGHT_M) { return MIN_BUILDING_HEIGHT_M; }
    if (rounded > MAX_BUILDING_HEIGHT_M) { return MAX_BUILDING_HEIGHT_M; }
    return rounded;
}
