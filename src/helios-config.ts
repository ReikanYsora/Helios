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
    //Per-layer building radius the editor strips on save (kept in the type so the strip recognises it).
    'building-radius'?:        unknown;
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
    //Custom entity, measured-only contract: BOTH sensors are required for it to display anywhere. The
    //power sensor feeds the live chip + scrub + curve; the energy meter feeds the energy surfaces. The
    //legacy single slot below is only read by the editor to prefill a migration, never at runtime.
    //Empty = no chip. The displayed name follows the entity's friendly name.
    'custom-power-entity'?:     unknown;
    'custom-energy-entity'?:    unknown;
    'custom-entity'?:           unknown;
    //MDI icon override for the custom entity (chip + clock medallion/button). Empty falls back to the entity's
    //own icon, then a generic glyph.
    'custom-entity-icon'?:      unknown;
    //HA ui_color token tinting the custom-entity chip, its leader and its clock ring. Default 'red'.
    'custom-entity-color'?:     unknown;
    //HA ui_color token for the base tint of surrounding buildings. Default 'grey'.
    'building-color'?:          unknown;
    //HA ui_color token for the home (consumption) colour: the home pill + every consumption readout. Default 'green'.
    'home-color'?:              unknown;
    //Per-card cache id. When set, the saved view (mode, filters, camera pose, lock) keys on it instead of the
    //home coordinates, so two cards on the same home keep independent state. Empty = shared per-home cache.
    'cache-id'?:                unknown;
    //Power readout unit for the whole card: 'W' or 'kW'. Default 'kW' (unchanged). Energy always stays kWh.
    'power-unit'?:             unknown;
    //Irradiance (solar constant) readout unit: 'W/m²' or 'kW/m²'. Default 'W/m²'.
    'irradiance-unit'?:        unknown;
    //Battery chip sign convention: 'default' (- charging, + discharging), 'inverted' (+ charging,
    //- discharging), or 'hidden' (magnitude only). Display-only; flow direction and history are unchanged.
    'battery-sign'?:           unknown;
    //"No UI" mode: when true, the timeline and the on-card controls fade away after a short idle and reappear on
    //any input (kiosk/immersive display). Default false. See UI_AUTOHIDE_MS.
    'auto-hide-ui'?:           unknown;
    //Top-right weather panel: when true, show it (scene view). Independent of "No UI" mode. Default false (hidden).
    'show-weather'?:           unknown;
    //Top-right info panel: when true, the panel also lists the sun's astronomical data (altitude, azimuth,
    //sunrise, solar noon, sunset, day length) below the weather. Default false (weather only).
    'show-astro'?:             unknown;
    //Entities whose live value replaces the Open-Meteo default on the info panel: outdoor temperature and wind
    //speed. Empty = use Open-Meteo. Read as-is in the entity's own unit.
    'outdoor-temperature-entity'?: unknown;
    'wind-speed-entity'?:      unknown;
}


//Custom power sensor id (empty when unset).
export function customPowerEntityId(config: HeliosConfig | undefined): string
{
    const raw = config?.['custom-power-entity'];
    return typeof raw === 'string' ? raw.trim() : '';
}

//Custom energy meter id (empty when unset).
export function customEnergyEntityId(config: HeliosConfig | undefined): string
{
    const raw = config?.['custom-energy-entity'];
    return typeof raw === 'string' ? raw.trim() : '';
}

//Validity-gated custom id, the single string every consumer gates on: the POWER sensor (the live
//source), non-empty only when BOTH halves are configured. One incomplete half hides the custom
//entity everywhere instead of displaying a surface we would have to invent.
export function customEntityId(config: HeliosConfig | undefined): string
{
    const power = customPowerEntityId(config);
    return power !== '' && customEnergyEntityId(config) !== '' ? power : '';
}


//Resolved ui_color tokens (default 'red' for the custom-entity chip/leader/clock ring, 'grey' for the
//building base tint); the colour helpers turn these into CSS vars.
export function customEntityColor(config: HeliosConfig | undefined): string
{
    const raw = config?.['custom-entity-color'];
    const token = typeof raw === 'string' ? raw.trim() : '';
    return token || 'red';
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


//Top-right weather panel: hidden unless explicitly enabled. Default false.
export function showWeather(config: HeliosConfig | undefined): boolean
{
    return config?.['show-weather'] === true;
}


//Info panel: also show the sun's astronomical data below the weather. Default false.
export function showAstro(config: HeliosConfig | undefined): boolean
{
    return config?.['show-astro'] === true;
}


//Resolved outdoor-temperature override entity id (empty when unset). Replaces the Open-Meteo temperature on the
//info panel; read in the entity's own unit.
export function outdoorTemperatureEntityId(config: HeliosConfig | undefined): string
{
    const raw = config?.['outdoor-temperature-entity'];
    return typeof raw === 'string' ? raw.trim() : '';
}


//Resolved wind-speed override entity id (empty when unset). Replaces the Open-Meteo wind speed on the info panel.
export function windSpeedEntityId(config: HeliosConfig | undefined): string
{
    const raw = config?.['wind-speed-entity'];
    return typeof raw === 'string' ? raw.trim() : '';
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
