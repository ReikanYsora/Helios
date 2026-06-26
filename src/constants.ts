//Central tunables for the Helios card: every "setting" number lives here so the whole card can be
//re-tuned from one place. Structural constants (time units, geo/math, EPSG tables, shaders, layer-id
//lists, internal cache keys, regexes) deliberately stay in their own modules. The DEFAULT_*/MIN/MAX
//below are the editor's default values; helios-config.ts re-exports them and wraps them in the config
//resolvers (displayRadiusM, valueDecimals, periodPastDays...).


//Drawing colours are not constants: every colour is resolved at runtime from the live HA theme tokens —
//the scene palette via the engine, the chips + charts via ENERGY_COLOR (card/theme-colors.ts) — so a
//user's custom theme flows through with no hardcoded hex. The LAB conversion factors that ramp those
//tokens live in the "Colour-space conversion" group below.

//=== Time units ===
export const HOUR_MS = 3_600_000;
export const DAY_MS  = 86_400_000;

//=== Math ===
//Card-side degrees→radians factor. The scene module keeps its own DEG in scene/constants.ts so the two
//layers stay independent; the duplication across the two is intentional.
export const DEG = Math.PI / 180;

//=== Display radius + buildings ===
//Single on-screen radius (m) for buildings and shadows. 200 m default; the `display-radius`
//slider lowers it for perf or raises it for a wider survey. Buildings fade out over DISPLAY_FADE_DELTA_M.
export const DEFAULT_DISPLAY_RADIUS_M = 200;
export const MIN_DISPLAY_RADIUS_M     = 50;
export const MAX_DISPLAY_RADIUS_M     = 500;
export const DISPLAY_FADE_DELTA_M     = 50;
export const DEFAULT_BUILDING_OPACITY          = 0.25;  //ghost surround; home stays 1.0
export const DEFAULT_BUILDING_CLUSTER_RADIUS_M = 0;     //0 = legacy single-polygon home detection
export const HOME_FALLBACK_M                   = 30;    //fallback home half-size when no footprint resolves

//=== Data cadence + value precision ===
//Buckets/hour for the unified store + every graph. 4 = 15 min; clamp [1,12] (12 = the recorder's 5-min floor).
export const DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR = 4;
export const MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR     = 1;
export const MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR     = 12;
//Decimal places for every value readout (kW/kWh). Default 1, clamp [0,3].
export const DEFAULT_VALUE_DECIMALS = 1;
export const MIN_VALUE_DECIMALS     = 0;
export const MAX_VALUE_DECIMALS     = 3;

//=== Rolling-window period ===
//Days of history / forecast around today (inclusive). Defaults reproduce the -2/+2 window; the in-card
//selector overrides at runtime. Past clamps [0,30], future [0,14] (Open-Meteo forecasts ~16 days).
export const DEFAULT_PERIOD_PAST_DAYS   = 2;
export const DEFAULT_PERIOD_FUTURE_DAYS = 2;
export const MIN_PERIOD_PAST_DAYS       = 0;
export const MAX_PERIOD_PAST_DAYS       = 30;
export const MIN_PERIOD_FUTURE_DAYS     = 0;
export const MAX_PERIOD_FUTURE_DAYS     = 14;


//=== Camera ===
//Frame a point this high above the home so the house sits lower with headroom for the arc.
export const CAMERA_TARGET_HEIGHT_M = 10;
//Pitch bounds shared by the engine pose policy, drag-rotate, the editor and the initial-pose clamp.
//MIN = mostly top-down, MAX = nearly horizontal, REST = default.
export const CAMERA_PITCH_MIN_DEG  = 15;
export const CAMERA_PITCH_MAX_DEG  = 55;
export const CAMERA_PITCH_REST_DEG = 50;

//=== Sun arc ===
export const SUN_ARC_RADIUS_M      = 40;    //base celestial radius (m); scaled on-screen by the card
export const SUN_ARC_SAMPLES       = 96;    //points along the day's arc (15-min cadence)
export const SUN_ARC_NIGHT_OPACITY = 0.25;  //below-horizon segment opacity


export const PV_CHIP_OFFSET_PX     = 70;    //PV chip lift above the home cluster

//=== Animation / timing ===
export const AUTO_ROTATE_DEG_PER_SEC   = 4.0;
export const AUTO_ROTATE_INACTIVITY_MS = 5_000;
export const ENGINE_SPAWN_COOLDOWN_MS = 600;
export const GLOBAL_SPAWN_COOLDOWN_MS = 800;

//=== Cache TTLs / timeouts / throttles ===
export const PV_CACHE_TTL_MS        = 15 * 60_000;
export const BATTERY_CACHE_TTL_MS   = 15 * 60_000;
export const RADIATION_CACHE_TTL_MS = 15 * 60_000;
export const HA_DAILY_TOTALS_TTL_MS = 25_000;
export const FORECAST_THROTTLE_MS   = 5 * 60_000;
export const WS_DEFAULT_TIMEOUT_MS  = 30_000;
export const WS_MAX_CONCURRENT_FETCHES = 2;

//=== Misc thresholds ===
export const EQ_EPS_PX = 0.25;
export const TIMELINE_MAX_TICKS = 7;

//=== Shadows ===
export const DEFAULT_SHADOW_OPACITY = 0.32;
//Offscreen raster resolution for the footprint shadow mask. ~0.4 m/px over a 400 m diameter; fixed.
export const SHADOW_RASTER_SIZE = 1024;

//=== Weather fetch ===
export const WEATHER_PAST_DAYS          = 5;
export const WEATHER_FORECAST_DAYS      = 3;
export const WEATHER_CACHE_TTL_MS       = 45 * 60_000;
export const WEATHER_CACHE_KEY_DECIMALS = 3;
export const RATE_LIMIT_BACKOFF_MS:  readonly number[] = [5 * 60_000, 15 * 60_000, 60 * 60_000];
export const OTHER_ERROR_BACKOFF_MS: readonly number[] = [1 * 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];


//=== Energy-stats (change-series) ===
export const CHANGE_REFRESH_MS = 60_000;
export const COARSE_PROBE_MS   = 15 * 60_000;
export const DENSE_FRACTION    = 0.6;


//=== Buildings / Overpass ===
//Fixed prism height (m) for every building (OSM heights ignored — tall ones break the faux-3D framing),
//the cap on nearest footprints kept, the local-mode fallback house half-extents, the localStorage cache
//TTL, the per-mirror retry delay, and the two CORS Overpass mirrors tried in order.
export const FIXED_BUILDING_HEIGHT_M = 6;
export const MAX_BUILDINGS           = 50;
export const FALLBACK_HOUSE_HALF_W   = 5;
export const FALLBACK_HOUSE_HALF_D   = 4;
export const BUILDING_CACHE_TTL_MS   = 30 * DAY_MS;
export const OVERPASS_RETRY_DELAY_MS = 1200;
export const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

//=== Engine lifecycle ===
//Cap on simultaneously-live HeliosEngine instances (evict the oldest beyond it so orphaned preview cards
//don't exhaust WebGL contexts) and the TTL of the shared module-scope parsed-buildings cache.
export const MAX_LIVE_ENGINES          = 4;
export const SHARED_FETCH_CACHE_TTL_MS = 30 * 60_000;

//=== Weather cache ===
//localStorage key prefix for the cached Open-Meteo forecasts.
export const CACHE_KEY_PREFIX = 'helios-weather-cache:';

//=== Colour-space conversion (CIE D65 / LAB) ===
//D65 white-point tristimulus values and the LAB piecewise-transfer thresholds, used by the RGB↔LAB
//conversion that drives the per-energy-source colour ramp.
/* eslint-disable @typescript-eslint/naming-convention */
export const Xn = 0.95047;
export const Yn = 1;
export const Zn = 1.08883;
/* eslint-enable @typescript-eslint/naming-convention */
export const LAB_T0 = 0.137931034;
export const LAB_T1 = 0.206896552;
export const LAB_T2 = 0.12841855;
export const LAB_T3 = 0.008856452;
