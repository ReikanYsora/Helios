//Public config schema for the Helios card: the option keys the user touches via YAML or the visual
//editor, their DEFAULT_* values, and the resolver helpers the editor + runtime read. Engine internals
//(layer IDs, raster sizes, tunables) live in helios-engine.ts, not here. Every DEFAULT_*/MIN/MAX value
//now lives in constants.ts; this module imports them for the resolvers below and re-exports them so
//existing `from './helios-config'` imports keep working.

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
    //How many of the nearest buildings to keep around the home. Clamped [10,100], default 50. Lowering it is
    //a perf lever, raising it widens the surround.
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
    'solar-irradiance-entity'?: unknown;
    //Optional user-picked power/energy entity surfaced as the red "custom" chip (top-left, above grid) and a
    //clock-mode metric. Empty = no chip. The displayed name follows the entity's friendly name.
    'custom-entity'?:           unknown;
    //Optional MDI icon override for the custom entity (chip + clock medallion/button). Empty falls back to the
    //entity's own icon, then a generic glyph.
    'custom-entity-icon'?:      unknown;
    //HA ui_color token tinting the custom-entity chip, its leader and its clock ring. Default 'red'.
    'custom-entity-color'?:     unknown;
    //HA ui_color token for the base tint of surrounding buildings in the scene. Default 'grey'.
    'building-color'?:          unknown;
    //HA ui_color token for the home (consumption) colour: the home pill + every consumption readout. Default 'green'.
    'home-color'?:              unknown;
    //Optional per-card cache id. When set, the saved view (mode, selected filters, camera pose, lock) is keyed
    //on it instead of the home coordinates, so two cards on the same home keep independent state (e.g. one in
    //scene mode, one in clock mode). Empty = shared per-home cache (the default).
    'cache-id'?:                unknown;
    //Optional local nDSM (normalised Digital Surface Model) GeoTIFF: a single browser-reachable raster the
    //user points Helios at for true LiDAR shadows + the LiDAR view mode. Enabled gates everything; the URL +
    //EPSG:4326 bounding box must all be present and ordered for the source to be considered defined.
    'lidar-local-ndsm-enabled'?: unknown;
    'lidar-local-ndsm-url'?:     unknown;
    'lidar-local-ndsm-min-lat'?: unknown;
    'lidar-local-ndsm-max-lat'?: unknown;
    'lidar-local-ndsm-min-lon'?: unknown;
    'lidar-local-ndsm-max-lon'?: unknown;
    //LiDAR shadow quality: scales the nDSM raster resolution ('low'|'medium'|'high', default 'medium').
    //Lower = fewer cells = lighter card; higher = finer shadows at more CPU/memory.
    'lidar-shadow-quality'?:     unknown;
}


//Validated local-nDSM config (url + ordered EPSG:4326 bbox), or null when not fully/validly defined. Single
//source of truth for "is a local LiDAR defined" — gates the LiDAR view mode, the LiDAR shadows and the editor.
export interface LocalLidarConfig
{
    url:    string;
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}
export function localLidarConfig(config: HeliosConfig | undefined): LocalLidarConfig | null
{
    if (config?.['lidar-local-ndsm-enabled'] !== true)
    {
        return null;
    }
    const url = config?.['lidar-local-ndsm-url'];
    if (typeof url !== 'string' || !url.trim())
    {
        return null;
    }
    const minLat = Number(config?.['lidar-local-ndsm-min-lat']);
    const maxLat = Number(config?.['lidar-local-ndsm-max-lat']);
    const minLon = Number(config?.['lidar-local-ndsm-min-lon']);
    const maxLon = Number(config?.['lidar-local-ndsm-max-lon']);
    if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite))
    {
        return null;
    }
    if (maxLat <= minLat || maxLon <= minLon)
    {
        return null;
    }
    return { url: url.trim(), minLat, maxLat, minLon, maxLon };
}
export function hasLocalLidar(config: HeliosConfig | undefined): boolean
{
    return localLidarConfig(config) !== null;
}


//Resolved LiDAR shadow quality, picking the nDSM raster resolution. Returns the configured tier only when it
//is exactly one of the known values, else 'medium' (the default).
export function lidarShadowQuality(config: HeliosConfig | undefined): 'low' | 'medium' | 'high'
{
    const raw = config?.['lidar-shadow-quality'];
    return raw === 'low' || raw === 'medium' || raw === 'high' ? raw : 'medium';
}


//Resolved custom-entity id (empty string when unset). A plain string read; the chip/clock gate on emptiness.
export function customEntityId(config: HeliosConfig | undefined): string
{
    const raw = config?.['custom-entity'];
    return typeof raw === 'string' ? raw.trim() : '';
}


//Resolved ui_color token for the custom-entity chip/leader/clock ring (default 'red') and for the
//building base tint (default 'grey'). A plain string read; the colour helpers turn it into a CSS var.
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

//Resolved ui_color token for the home (consumption) colour — the home pill + every consumption readout.
//Default 'green', matching the unconfigured tint.
export function homeColor(config: HeliosConfig | undefined): string
{
    const raw = config?.['home-color'];
    const token = typeof raw === 'string' ? raw.trim() : '';
    return token || 'green';
}


//Resolved per-card cache id (empty string when unset). Isolates the saved view between same-home cards.
export function cacheId(config: HeliosConfig | undefined): string
{
    const raw = config?.['cache-id'];
    return typeof raw === 'string' ? raw.trim() : '';
}


//Resolve the bucket cadence (buckets/hour) from config, clamped to range, defaulting on missing/invalid.
//Single source of truth for the store builder + every cadence consumer (path builders, chart aspect, ...).
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


//Resolve the global display radius (m) from `display-radius`, clamped to [MIN,MAX], defaulting on invalid.
//Single source of truth so lowering it shrinks buildings and shadows in lockstep.
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


//Resolve the fixed prism height (m) from `building-height`, clamped [MIN,MAX], defaulting on invalid. Used only
//when `building-real-size` is false.
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
