//Central tunables for the card. The DEFAULT_*/MIN/MAX below are the editor's default values;
//helios-config.ts re-exports them and wraps them in the config resolvers (displayRadiusM,
//valueDecimals...). Drawing colours are not constants: each is resolved at runtime from the live HA
//theme tokens (scene palette via the engine, chips + charts via ENERGY_COLOR), so a user's custom
//theme flows through with no hardcoded hex. The LAB conversion factors that ramp those tokens live in
//the "Colour-space conversion" group below.

//=== Time units ===
export const HOUR_MS = 3_600_000;
export const DAY_MS  = 86_400_000;
export const HOURS_PER_DAY = 24;

//=== Math ===
//Shared degrees to radians factor.
export const DEG = Math.PI / 180;

//=== Display radius + buildings ===
//On-screen radius (m) for buildings and shadows; the `display-radius` slider trades perf for survey width.
export const DEFAULT_DISPLAY_RADIUS_M = 200;
export const MIN_DISPLAY_RADIUS_M     = 0;
export const MAX_DISPLAY_RADIUS_M     = 250;
export const DEFAULT_BUILDING_OPACITY          = 0.5;   //ghost surround; home stays 1.0
export const DEFAULT_BUILDING_CLUSTER_RADIUS_M = 0;     //0 = single-polygon home detection

//=== Data cadence + value precision ===
//Buckets/hour for the unified store + every graph (4 = 15 min, max 6 = 10 min).
export const DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR = 4;
export const MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR     = 1;
export const MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR     = 6;
//Decimal places for every value readout (kW/kWh).
export const DEFAULT_VALUE_DECIMALS = 1;
export const MIN_VALUE_DECIMALS     = 0;
export const MAX_VALUE_DECIMALS     = 3;


//=== Colours ===
//Fixed amber for the sun identity (disc, halo, arc apex, irradiance chart): a stable warm yellow, not
//the theme's --warning-color which skews orange under many themes.
export const SUN_COLOR_HEX = '#ffc107';


//=== Camera ===
//Pitch bounds shared by the engine pose policy, drag-rotate, the editor and the initial-pose clamp.
//MIN = mostly top-down, MAX = nearly horizontal, REST = default.
export const CAMERA_PITCH_MIN_DEG  = 0;
export const CAMERA_PITCH_MAX_DEG  = 65;
export const CAMERA_PITCH_REST_DEG = 50;

//=== Sun arc ===
export const SUN_ARC_RADIUS_M      = 40;    //base celestial radius (m); scaled on-screen by the card
export const SUN_ARC_SAMPLES       = 96;    //points along the day's arc (15-min cadence)
export const SUN_ARC_NIGHT_OPACITY = 0.25;  //below-horizon segment opacity
//Standard sunrise/sunset convention (HA, NOAA, suncalc): the apparent upper limb meets the horizon when the
//sun's geometric centre sits 0.833° below it (0.567° atmospheric refraction + 0.267° solar semi-diameter).
//The arc + detail-panel mark rise/set at this altitude, not the geometric-centre 0° crossing.
export const SUNRISE_SUNSET_ALTITUDE_DEG = -0.833;



//=== Animation / timing ===
export const AUTO_ROTATE_DEG_PER_SEC   = 4.0;
export const AUTO_ROTATE_INACTIVITY_MS = 5_000;
//"No UI" mode: idle time (seconds) before the timeline + controls fade away, any input brings them back. Set
//via the 'no-ui-delay' config key, clamped to [MIN,MAX], defaulting to DEFAULT.
export const DEFAULT_NO_UI_DELAY_S     = 5;
export const MIN_NO_UI_DELAY_S         = 0;
export const MAX_NO_UI_DELAY_S         = 10;

//=== Cache TTLs / timeouts / throttles ===
export const BATTERY_CACHE_TTL_MS   = 15 * 60_000;
export const IRRADIANCE_CACHE_TTL_MS = 15 * 60_000;
export const HA_DAILY_TOTALS_TTL_MS = 25_000;
export const FORECAST_THROTTLE_MS   = 5 * 60_000;
export const WS_DEFAULT_TIMEOUT_MS  = 30_000;
export const WS_MAX_CONCURRENT_FETCHES = 2;

//=== Misc thresholds ===
export const EQ_EPS_PX = 0.25;
export const TIMELINE_MAX_TICKS = 7;

//=== Shadows ===
export const DEFAULT_SHADOW_OPACITY = 0.32;

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
//Store-curve coarse-meter smoothing: the largest report cadence (in store buckets) still spread back into a
//smooth curve, and the fraction of gaps that must sit at that cadence to treat a meter as regularly coarse
//(below it, the non-zero buckets read as genuine intermittent flow and are left untouched).
export const COARSE_MAX_SPREAD_BUCKETS = 6;
export const COARSE_REGULARITY         = 0.6;


//=== Grid mis-scope guard ===
//Detector for a mis-scoped live grid sensor: hourly recorder stats over the window, contradiction = the
//export meter recorded energy while the "signed net" sensor never went meaningfully negative (physically
//impossible for a correctly scoped sensor). Bounds keep integration noise (MIN) and statistics-surgery
//artefacts (MAX) out of the evidence; the negative band scales with the hour's implied export power
//(RELATIVE) so a brief -100 W dip cannot vouch for a sensor missing kilowatts of export. Flag needs
//CONTRADICTION_HOURS non-adjacent proven hours; it self-clears after CLEAN_EVALS contradiction-free
//evaluations that contained real export.
export const GUARD_REFRESH_MS         = 30 * 60_000;
export const GUARD_WINDOW_MS          = 24 * HOUR_MS;
export const GUARD_MIN_EXPORT_KWH     = 0.1;
export const GUARD_MAX_EXPORT_KWH     = 25;
export const GUARD_NEGATIVE_BAND_W    = -50;
export const GUARD_RELATIVE_BAND      = 0.2;
export const GUARD_CONTRADICTION_HOURS = 3;
export const GUARD_CLEAN_EVALS        = 3;


//=== Buildings / OpenFreeMap ===
//Fixed prism height (m) used when real heights are off (tall buildings break the 2.5D framing), the cap
//on nearest footprints kept, the local-mode fallback house half-extents, and the cache TTL.
export const FIXED_BUILDING_HEIGHT_M = 6;
export const DEFAULT_BUILDING_COUNT  = 50;
export const MIN_BUILDING_COUNT      = 10;
export const MAX_BUILDING_COUNT      = 100;
export const MIN_BUILDING_HEIGHT_M   = 3;
export const MAX_BUILDING_HEIGHT_M   = 10;
//Real-height cap (m) so a nearby tower can't dominate the 2.5D framing; untagged buildings fall back.
export const REAL_HEIGHT_CAP_M       = 25;
export const REAL_HEIGHT_FALLBACK_M  = 6;
export const FALLBACK_HOUSE_HALF_W   = 5;
export const FALLBACK_HOUSE_HALF_D   = 4;
export const BUILDING_CACHE_TTL_MS   = 30 * DAY_MS;
//OpenFreeMap vector tiles: the buildings source (footprints + real heights via render_height). Free, no key,
//CORS-open CDN, gzip-served. The TileJSON gives the versioned tile URL template (the planet snapshot rotates).
export const OFM_TILEJSON_URL     = 'https://tiles.openfreemap.org/planet';
//Building geometry is complete at the tileset's max zoom (14); a whole radius fits in a handful of tiles.
export const OFM_TILE_ZOOM        = 14;
//Per-tile watchdog: fetch has no native timeout, so a hung tile would otherwise stall the whole set.
export const OFM_FETCH_TIMEOUT_MS = 10_000;
//Re-attempt delay after a total buildings-fetch outage: it heals without a page reload (the scene shows the
//fallback house in the meantime).
export const BUILDINGS_REFETCH_DELAY_MS = 5 * 60_000;

//=== Engine lifecycle ===
//TTL of the shared module-scope parsed-buildings cache.
export const SHARED_FETCH_CACHE_TTL_MS = 30 * 60_000;

//=== Weather cache ===
//localStorage key prefix for the cached Open-Meteo forecasts.
export const CACHE_KEY_PREFIX = 'helios-weather-cache:';

//=== Colour-space conversion (CIE D65 / LAB) ===
//D65 white-point tristimulus values and the LAB piecewise-transfer thresholds, used by the RGB<->LAB
//conversion that drives the per-energy-source colour ramp.
 
export const Xn = 0.95047;
export const Yn = 1;
export const Zn = 1.08883;
 
export const LAB_T0 = 0.137931034;
export const LAB_T1 = 0.206896552;
export const LAB_T2 = 0.12841855;
export const LAB_T3 = 0.008856452;


//Tunables for the 2.5D scene engine, a card-agnostic unit: nothing below depends on the card, and the
//engine modules reach up here via ../constants.

//=== Camera + projection ===
//Pitch bounds shared by the editor, drag-rotate and the initial-pose clamp. MIN = nearly top-down,
//MAX = nearly horizontal. Default pose faces the sun's side so it sits at the top of the frame at noon.
//NEAR_PLANE is the near-plane margin as a fraction of PERSPECTIVE (clamps/culls points at the camera);
//PERSPECTIVE is the projection + CSS depth in px shared by the ground transform and project3.
//The low-level SceneCamera pose clamp reuses the single pitch-bound source of truth (CAMERA_PITCH_MIN/MAX_DEG
//in the Camera block above), so the render ceiling can never sit below what the engine, drag-rotate and editor accept.
export const DEFAULT_BEARING = 180;
export const DEFAULT_TILT    = 50;
export const NEAR_PLANE      = 0.15;
export const PERSPECTIVE     = 1200;

//=== Basemap tiles ===
//Tile pixel size, ground-canvas radius/zoom, the edge-fade start (% of the closest side, consumed by the
//card CSS), and the WGS84 Earth circumference used for the local-metre math.
export const TILE_PX             = 256;
export const GROUND_RADIUS       = 5;
export const GROUND_ZOOM         = 19;
export const GROUND_FADE_START   = 88;
export const EARTH_CIRCUMFERENCE_M = 40075016.686;
//Metres per degree of latitude (mean). Longitude scales this by cos(latitude). Used by every lon/lat<->metres
//projection (engine chip cluster, sun arc, building footprints) instead of re-deriving the literal each time.
export const METRES_PER_DEGREE   = 111_320;

//=== Renderer ===
//SVG namespace for the scene's screen-space overlay.
export const SVG_NS = 'http://www.w3.org/2000/svg';

//=== Day curve ===
//One scrubbed day of a metric, drawn round the home on the sun's own ground track for that day (see
//scene/day-curve.ts). There is no radius constant: the track IS the sun arc projected down, so it already stands
//on the arc's two ground crossings and closes in on the home as the sun climbs.
//
//The height is a fraction of that track's radius rather than a fixed metre count. The arc scale tracks the card's
//size, so fixed metres would flatten the curve into a pancake on a large card and tower over it on a small one; a
//fraction holds the shape at every size, which is what the arc already does for itself. Kept well under 1 so the
//curve reads UNDER the sun's path instead of fighting it.
export const DAY_CURVE_HEIGHT_FRAC = 0.58;
//Shortest run of covered slots that still draws. A window that has only just opened (today, a minute after
//midnight) covers one slot, and one point is a spike, not a curve.
export const DAY_CURVE_MIN_RUN = 3;
//How long the curve takes to write itself on when the PV chip's second notch is pressed.
export const DAY_CURVE_SWEEP_MS = 700;

//=== Renderer shadows ===
//Shadows fade to full at SHADOW_FADE_DEG above the horizon; cast length is capped at MAX_SHADOW_M so a
//low sun doesn't streak a shadow across the whole disc.
export const SHADOW_FADE_DEG = 10;
export const MAX_SHADOW_M    = 50;

//=== Scene animation (ms / easing) ===
//Building-rise window (matches the HA energy graphs) and the home retarget squash/grow timings.
export const GROWTH_RISE_MS  = 500;
export const HOME_SQUASH_MS  = 220;
export const HOME_GROW_MS    = 300;
