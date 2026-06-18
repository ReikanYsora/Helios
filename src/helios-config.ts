//Public config schema for the Helios card: the option keys the user touches via YAML or the visual
//editor, their DEFAULT_* values, and the resolver helpers the editor + runtime read. Engine internals
//(layer IDs, raster sizes, tunables) live in helios-engine.ts, not here.


//User-facing config passed to setConfig(), read by the engine + editor. Every key is optional and typed
//`unknown`; callers validate/coerce, and the DEFAULT_* consts below fill in absent keys.
export interface HeliosConfig
{
    //Index signature so retired/legacy keys read as `unknown` without widening errors; the named keys
    //below are the live schema, legacy YAML is stripped on the next editor open.
    [key: string]: unknown;
    //When false, OpenFreeMap label layers (roads, POI, place names) are hidden for a minimal basemap. Default true.
    'show-labels'?:           unknown;
    //Storage + render cadence in buckets/hour for the unified data source and every graph. Range 1-60,
    //default 4 (15 min). Higher = finer curves at more CPU/memory. Forecast stays hourly, then interpolated.
    'display-update-frequency-per-hour'?: unknown;
    //Battery + grid wiring is resolved entirely from the HA Energy dashboard (SoC/power/sign for the battery
    //chip; stat_energy_from/to + optional stat_rate for grid import/export). No per-card entity slots.
    //Base style: 'streets' (default, full-colour Liberty) or 'minimal' (muted Positron); a dark HA theme
    //auto-selects the Fiord dark style. Label toggle + building extrusion are independent of this.
    'map-style'?:             unknown;
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
    //Global display radius (m): the distance around the home within which buildings, LiDAR cells and shadows
    //render. Clamped [50,500], default 200. Lowering it is the main perf lever on old phones.
    'display-radius'?:         unknown;
    //Opacity 0..1 of surrounding buildings (home stays 1.0). Default 0.25, a ghost surround for context.
    'building-opacity'?:       unknown;
    //Cluster radius (m): buildings within it (or containing the home) are treated as part of the home and
    //painted at full opacity, so attached garages/verandas don't render as transparent neighbours. Default 0.
    'building-cluster-radius'?: unknown;
    //Cast-shadow master toggle. Default true; false projects no shadows (LiDAR or footprint).
    'shadows-enabled'?:        unknown;
    //LiDAR raster precision for shadow geometry (only inside provider coverage): 'low' 256, 'medium' 512, 'high' 1024.
    'lidar-precision'?:       unknown;
    //Opacity of the cast ground shadow layer, 0..1. Default 0.32.
    'shadow-opacity'?:         unknown;
    //Optional local nDSM GeoTIFF LiDAR provider: a browser-reachable Float32 height-above-ground raster prepared
    //offline. Selected only when enabled + fully configured + covering the home; otherwise the public provider
    //chain + footprint mask apply. Keys: enabled (master opt-in, default false), url, and the EPSG:4326 bbox
    //min/max lat/lon that gate covers(lat,lon) and the RasterGeo extent. Invalid config disables only this provider.
    'lidar-local-ndsm-enabled'? : unknown;
    'lidar-local-ndsm-url'?     : unknown;
    'lidar-local-ndsm-min-lat'? : unknown;
    'lidar-local-ndsm-max-lat'? : unknown;
    'lidar-local-ndsm-min-lon'? : unknown;
    'lidar-local-ndsm-max-lon'? : unknown;
    //Optional home override. Used only when both parse finite + in range (lat -90..90, lon -180..180); else
    //falls back to hass.config. The window.__heliosLocationOverride debug hook still wins over this.
    'home-latitude'?:          unknown;
    'home-longitude'?:         unknown;
    //Optional live irradiance sensor (W/m²) at the home, preferred over the Open-Meteo model for the "now"
    //reading in live mode. Past + forecast still come from the model.
    'solar-radiation-entity'?: unknown;
}


//Fixed-colour design system: one fixed colour per metric (no hue-ramping), varied by area/position so a
//glance reads "more sun/cloud" without decoding a gradient. Defaults track HA's Energy palette so a Helios
//card reads as a first-party Energy tile and theme overrides (Catppuccin, Nord...) flow through the CSS vars.
//Sun takes HA amber (distinct from the PV solar orange, since the card is named for the sun).
export const DEFAULT_SUN_COLOR_HEX:   string = '#ffc107';  //--amber-color
export const DEFAULT_CLOUD_COLOR_HEX: string = '#727272';  //--secondary-text-color (neutral)
export const DEFAULT_PV_COLOR_HEX:    string = '#ff9800';  //--energy-solar-color
//Battery SoC ("stock") uses HA's discharge teal; live power direction switches the leader/chip between the
//in (pink, charging) and out (teal, discharging) variants below.
export const DEFAULT_BATTERY_COLOR_HEX: string = '#4db6ac';  //--energy-battery-out-color
export const DEFAULT_BATTERY_IN_COLOR_HEX:  string = '#f06292';  //--energy-battery-in-color
export const DEFAULT_BATTERY_OUT_COLOR_HEX: string = '#4db6ac';  //--energy-battery-out-color
//Grid import blue, grid export purple, straight from the HA Energy palette.
export const DEFAULT_GRID_IMPORT_COLOR_HEX: string = '#488fc2';  //--energy-grid-consumption-color
export const DEFAULT_GRID_EXPORT_COLOR_HEX: string = '#8353d1';  //--energy-grid-return-color


//Single source of truth for the on-screen display radius across all three layers (buildings, LiDAR cells,
//raster shadows). 200 m default reads as "the buildings around my house" without dragging mid-range phones;
//the `display-radius` slider lowers it for perf or raises it for a wider survey. LiDAR fades out over the
//outer DISPLAY_FADE_DELTA_M band.
export const DEFAULT_DISPLAY_RADIUS_M = 200;
//Editor slider bounds: 50 m (perf floor) to 500 m (widest before per-frame geometry projection costs).
export const MIN_DISPLAY_RADIUS_M = 50;
export const MAX_DISPLAY_RADIUS_M = 500;
//Inward LiDAR fade band from the display radius: cells in [radius - delta, radius] smoothstep to zero.
//Buildings + shadows are binary at the radius (footprints clamped server-side at the tile boundary).
export const DISPLAY_FADE_DELTA_M = 50;
export const DEFAULT_BUILDING_OPACITY          = 0.25;
export const DEFAULT_BUILDING_CLUSTER_RADIUS_M = 0;
export const DEFAULT_BUILDING_COLOR_HEX        = '#d2d2d7';

//Display update frequency (buckets/hour). 4 = every 15 min. Clamp [1,12]: 12 = 5 min, the recorder's finest
//statistics period, so a higher value would only interpolate cosmetic sub-buckets with no extra real data.
export const DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR = 4;
export const MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR     = 1;
export const MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR     = 12;

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


//Decimal places for every value readout (kW/kWh), one setting for visual uniformity. Default 1, clamp [0,3].
export const DEFAULT_VALUE_DECIMALS = 1;
export const MIN_VALUE_DECIMALS     = 0;
export const MAX_VALUE_DECIMALS     = 3;

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
//Single source of truth so lowering it shrinks buildings, LiDAR cells and shadows in lockstep.
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


//Shadow precision = multiplier on the provider's native cell pitch: high 1x, medium 2x, low 4x. Pinning to
//the native sampling means each rendered point maps to a real publication cell, not a server interpolation.
//Only meaningful inside provider coverage; outside, shadows fall back to footprints.
export type LidarPrecisionLevel = 'low' | 'medium' | 'high';
export const DEFAULT_LIDAR_PRECISION: LidarPrecisionLevel = 'medium';
//Precision -> pitch multiplier (effective pitch = nativePitch x multiplier; rasterSize derived from radius + pitch).
export const LIDAR_PRECISION_PITCH_MULT: Record<LidarPrecisionLevel, number> = {
    low:    4,
    medium: 2,
    high:   1
};
//Default ground-shadow opacity when `shadow-opacity` is unset.
export const DEFAULT_SHADOW_OPACITY = 0.32;


//Default opt-in for the local-nDSM LiDAR provider (editor toggle default). Stays off until enabled AND given url + bbox.
export const DEFAULT_LIDAR_LOCAL_NDSM_ENABLED = false;


//LiDAR View overlay defaults. Disc radius derives from DEFAULT_DISPLAY_RADIUS_M; colours fixed white; overall
//opacity is runtime state from the in-card slider (DEFAULT_LIDAR_VIEW_OPACITY is its first-open value).
export const DEFAULT_LIDAR_VIEW_OPACITY        = 0.25;
//Radius where the LiDAR overlay alpha starts ramping down (full inside, smoothstep to zero out to the display
//radius). Derived as DEFAULT_DISPLAY_RADIUS_M - DISPLAY_FADE_DELTA_M so one edit rescales every layer.
export const LIDAR_VIEW_FULL_OPACITY_RADIUS_M = DEFAULT_DISPLAY_RADIUS_M - DISPLAY_FADE_DELTA_M;


//Rolling-window period defaults (history days / forecast days around today, inclusive). Reproduce the -2/+2
//window; these only seed the initial span, the in-card selector overrides at runtime. Past [0,30], future [0,14].
export const DEFAULT_PERIOD_PAST_DAYS   = 2;
export const DEFAULT_PERIOD_FUTURE_DAYS = 2;
export const MIN_PERIOD_PAST_DAYS       = 0;
export const MAX_PERIOD_PAST_DAYS       = 30;
export const MIN_PERIOD_FUTURE_DAYS     = 0;
export const MAX_PERIOD_FUTURE_DAYS     = 14;

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
