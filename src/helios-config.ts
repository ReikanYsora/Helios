//Public config schema for the Helios card: the option keys the user touches via YAML or the visual
//editor, their DEFAULT_* values, and the resolver helpers the editor + runtime read. Engine internals
//(layer IDs, raster sizes, tunables) live in helios-engine.ts, not here. Every DEFAULT_*/MIN/MAX value
//now lives in constants.ts; this module imports them for the resolvers below and re-exports them so
//existing `from './helios-config'` imports keep working.

import {
    DEFAULT_DISPLAY_RADIUS_M, MIN_DISPLAY_RADIUS_M, MAX_DISPLAY_RADIUS_M,
    DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    DEFAULT_VALUE_DECIMALS, MIN_VALUE_DECIMALS, MAX_VALUE_DECIMALS,
    DEFAULT_PERIOD_PAST_DAYS, DEFAULT_PERIOD_FUTURE_DAYS,
    MIN_PERIOD_PAST_DAYS, MAX_PERIOD_PAST_DAYS, MIN_PERIOD_FUTURE_DAYS, MAX_PERIOD_FUTURE_DAYS,
    DEFAULT_BUILDING_COUNT, MIN_BUILDING_COUNT, MAX_BUILDING_COUNT,
    FIXED_BUILDING_HEIGHT_M, MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M,
} from './constants';
export {
    DEFAULT_BUILDING_OPACITY,
    DEFAULT_BUILDING_CLUSTER_RADIUS_M, DEFAULT_DISPLAY_RADIUS_M, MIN_DISPLAY_RADIUS_M,
    MAX_DISPLAY_RADIUS_M, DISPLAY_FADE_DELTA_M, DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, DEFAULT_VALUE_DECIMALS,
    MIN_VALUE_DECIMALS, MAX_VALUE_DECIMALS, DEFAULT_PERIOD_PAST_DAYS, DEFAULT_PERIOD_FUTURE_DAYS,
    MIN_PERIOD_PAST_DAYS, MAX_PERIOD_PAST_DAYS, MIN_PERIOD_FUTURE_DAYS, MAX_PERIOD_FUTURE_DAYS,
    DEFAULT_SHADOW_OPACITY,
    DEFAULT_BUILDING_COUNT, MIN_BUILDING_COUNT, MAX_BUILDING_COUNT,
    DEFAULT_BUILDING_REAL_SIZE,
    FIXED_BUILDING_HEIGHT_M, MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M,
} from './constants';


//User-facing config passed to setConfig(), read by the engine + editor. Every key is optional and typed
//`unknown`; callers validate/coerce, and the DEFAULT_* consts below fill in absent keys.
export interface HeliosConfig
{
    //Index signature so retired/legacy keys read as `unknown` without widening errors; the named keys
    //below are the live schema, legacy YAML is stripped on the next editor open.
    [key: string]: unknown;
    //Storage + render cadence in buckets/hour for the unified data source and every graph. Range 1-60,
    //default 4 (15 min). Higher = finer curves at more CPU/memory. Forecast stays hourly, then interpolated.
    'display-update-frequency-per-hour'?: unknown;
    //Idle-camera orbit opt-in. Default false. When true the camera slowly orbits the home while idle.
    'auto-rotate-enabled'?:    unknown;
    //Optional camera pose pinned at init (degrees), overriding the auto-default (pitch 55, bearing toward the
    //equator). pitch 15..85, bearing 0..359; either can be set alone. Drag still works unless camera-locked.
    'camera-pitch-deg'?:       unknown;
    'camera-bearing-deg'?:     unknown;
    //When true, drag-rotate/pitch and the idle orbit are disabled so the camera stays at the configured pose. Default false.
    'camera-locked'?:          unknown;
    //Rolling window: period-past-days of history + period-future-days of forecast around today (inclusive,
    //from local midnight). Defaults reproduce the -2/+2 window; the in-card selector overrides at runtime.
    //Past clamps [0,30], future [0,14] (Open-Meteo forecasts ~16 days).
    'period-past-days'?:       unknown;
    'period-future-days'?:     unknown;
    //Legacy per-layer building radius, retired for `display-radius`. Kept in the type only so the editor's
    //retired-key strip recognises + removes it on save.
    'building-radius'?:        unknown;
    //Global display radius (m): the distance around the home within which buildings and shadows
    //render. Clamped [50,500], default 200. Lowering it is the main perf lever on old phones.
    'display-radius'?:         unknown;
    //Opacity 0..1 of surrounding buildings (home stays 1.0). Default 0.25, a ghost surround for context.
    'building-opacity'?:       unknown;
    //Cluster radius (m): buildings within it (or containing the home) are treated as part of the home and
    //painted at full opacity, so attached garages/verandas don't render as transparent neighbours. Default 0.
    'building-cluster-radius'?: unknown;
    //How many of the nearest buildings to keep around the home. Clamped [10,100], default 50. Replaces the
    //hardcoded MAX_BUILDINGS — lowering it is a perf lever, raising it widens the surround.
    'building-count'?:         unknown;
    //When true (default), buildings are extruded to their real OSM heights (capped). When false, every
    //building uses the fixed `building-height` prism so the framing stays uniform.
    'building-real-size'?:     unknown;
    //Fixed prism height (m) used for every building when `building-real-size` is false. Clamped [3,10], default 6.
    'building-height'?:        unknown;
    //Cast-shadow master toggle. Default true; false projects no shadows from building footprints.
    'shadows-enabled'?:        unknown;
    //Opacity of the cast ground shadow layer, 0..1. Default 0.32.
    'shadow-opacity'?:         unknown;
    //Optional home override. Used only when both parse finite + in range (lat -90..90, lon -180..180); else
    //falls back to hass.config. The window.__heliosLocationOverride debug hook still wins over this.
    'home-latitude'?:          unknown;
    'home-longitude'?:         unknown;
    //Optional live irradiance sensor (W/m²) at the home, preferred over the Open-Meteo model for the "now"
    //reading in live mode. Past + forecast still come from the model.
    'solar-radiation-entity'?: unknown;
}


//Resolve the bucket cadence (buckets/hour) from config, clamped to range, defaulting on missing/invalid.
//Single source of truth for the store builder + every cadence consumer (path builders, chart aspect, ...).
export function displayUpdateFrequencyPerHour(config: HeliosConfig | undefined): number
{
    const raw = config?.['display-update-frequency-per-hour'];
    const n   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(n)) { return DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR; }
    const r = Math.round(n);
    if (r < MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR) { return MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR; }
    if (r > MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR) { return MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR; }
    return r;
}


//Resolve the decimal-place count from `value-decimals`, clamped [0,3], defaulting on missing/invalid.
export function valueDecimals(config: HeliosConfig | undefined): number
{
    const raw = config?.['value-decimals'];
    const n   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(n)) { return DEFAULT_VALUE_DECIMALS; }
    const r = Math.round(n);
    if (r < MIN_VALUE_DECIMALS) { return MIN_VALUE_DECIMALS; }
    if (r > MAX_VALUE_DECIMALS) { return MAX_VALUE_DECIMALS; }
    return r;
}


//Resolve the global display radius (m) from `display-radius`, clamped to [MIN,MAX], defaulting on invalid.
//Single source of truth so lowering it shrinks buildings and shadows in lockstep.
export function displayRadiusM(config: HeliosConfig | undefined): number
{
    const raw = config?.['display-radius'];
    const n   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(n)) { return DEFAULT_DISPLAY_RADIUS_M; }
    const r = Math.round(n);
    if (r < MIN_DISPLAY_RADIUS_M) { return MIN_DISPLAY_RADIUS_M; }
    if (r > MAX_DISPLAY_RADIUS_M) { return MAX_DISPLAY_RADIUS_M; }
    return r;
}


//Resolve past/forecast day counts from their config keys, clamped to range, defaulting on missing/invalid.
export function periodPastDays(config: HeliosConfig | undefined): number
{
    const raw = config?.['period-past-days'];
    const n   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(n)) { return DEFAULT_PERIOD_PAST_DAYS; }
    const r = Math.round(n);
    if (r < MIN_PERIOD_PAST_DAYS) { return MIN_PERIOD_PAST_DAYS; }
    if (r > MAX_PERIOD_PAST_DAYS) { return MAX_PERIOD_PAST_DAYS; }
    return r;
}

export function periodFutureDays(config: HeliosConfig | undefined): number
{
    const raw = config?.['period-future-days'];
    const n   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(n)) { return DEFAULT_PERIOD_FUTURE_DAYS; }
    const r = Math.round(n);
    if (r < MIN_PERIOD_FUTURE_DAYS) { return MIN_PERIOD_FUTURE_DAYS; }
    if (r > MAX_PERIOD_FUTURE_DAYS) { return MAX_PERIOD_FUTURE_DAYS; }
    return r;
}


//Resolve how many nearest buildings to keep from `building-count`, clamped [MIN,MAX], defaulting on invalid.
export function buildingCount(config: HeliosConfig | undefined): number
{
    const raw = config?.['building-count'];
    const n   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(n)) { return DEFAULT_BUILDING_COUNT; }
    const r = Math.round(n);
    if (r < MIN_BUILDING_COUNT) { return MIN_BUILDING_COUNT; }
    if (r > MAX_BUILDING_COUNT) { return MAX_BUILDING_COUNT; }
    return r;
}


//Resolve the real-OSM-height toggle from `building-real-size`; defaults TRUE (only an explicit false disables it).
export function buildingRealSize(config: HeliosConfig | undefined): boolean
{
    return config?.['building-real-size'] !== false;
}


//Resolve the fixed prism height (m) from `building-height`, clamped [MIN,MAX], defaulting on invalid. Used only
//when `building-real-size` is false.
export function buildingFixedHeightM(config: HeliosConfig | undefined): number
{
    const raw = config?.['building-height'];
    const n   = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(n)) { return FIXED_BUILDING_HEIGHT_M; }
    const r = Math.round(n);
    if (r < MIN_BUILDING_HEIGHT_M) { return MIN_BUILDING_HEIGHT_M; }
    if (r > MAX_BUILDING_HEIGHT_M) { return MAX_BUILDING_HEIGHT_M; }
    return r;
}
