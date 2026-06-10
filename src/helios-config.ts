//Public config schema for the Helios card.
//
//Everything in here describes the surface the user touches through the
//Home Assistant YAML or visual editor: the option keys, their default
//values, and the small theme-aware helpers the editor needs to render
//matching placeholders. Engine internals (layer IDs, raster sizes,
//rendering tunables) deliberately do not live here, they stay in
//helios-engine.ts where they are produced and consumed.


//User-facing config object passed to setConfig() and read by both the
//engine and the editor. Every key is optional and typed as unknown,
//so callers must validate / coerce before use. The matching DEFAULT_*
//constants below provide the values used when a key is absent.
export interface HeliosConfig
{
    //Index signature so consumers (and stale references to retired keys) can read arbitrary string keys off the config
    //as `unknown` without TypeScript widening errors. The named keys below are the schema the editor + runtime know
    //about; legacy YAML carrying retired keys is allowed through here and the migration path strips it on the next
    //editor open.
    [key: string]: unknown;
    //When false, all of OpenFreeMap's label layers
    //(road names, building numbers, POI labels, place names) are
    //hidden for a cleaner, minimalist basemap. Default: true.
    'show-labels'?:           unknown;
    //Inverter clipping cap in kW (kilowatts of AC). Optional; when
    //set, the forecast tops out at this value so an oversized DC
    //array hooked to a smaller inverter (e.g. 6.4 kWp panels behind a
    //5 kW inverter, a common European pairing) doesn't show a peak
    //above what the user's hardware can actually deliver. Affects
    //only the predicted curve / chips / day-strip kWh totals; live
    //observation is unaffected (the inverter already does its own
    //clipping in hardware, the entity reports the clipped value).
    'pv-inverter-max-kw'?:    unknown;
    //Panel orientation. Optional; when unset the prediction model
    //assumes horizontal panels (0° tilt) and the orientation maths is
    //bypassed, preserving the original behaviour. Setting `pv-tilt`
    //above 0 enables the Liu-Jordan transposition that splits GHI
    //into direct + diffuse + ground-reflected components on the
    //panel plane, which matters a lot for vertical balcony installs
    //and roofs far from horizontal.
    //  pv-tilt    : tilt angle from horizontal, 0–90°.
    //  pv-azimuth : compass bearing the panel faces, 0–360°
    //               clockwise from north (180 = south). Ignored when
    //               tilt is 0.
    //Legacy single-orientation keys, superseded by `pv-arrays` below.
    //They keep working forever for back-compat: when `pv-arrays` is
    //absent or empty, the card reads these two as a single array
    //entry with share = 100 %.
    'pv-tilt'?:               unknown;
    'pv-azimuth'?:            unknown;
    //Multi-array PV layout. Optional list, each entry describes one
    //group of co-oriented panels:
    //  tilt     : 0–90°  (clamped). 0 = horizontal, 90 = vertical.
    //  azimuth  : 0–360° clockwise from north (180 = south). Wrapped
    //             into range, defaults to 180 when missing.
    //  peak-kwp : installed peak power of THIS string in kWp.
    //             Preferred over `share`: each user enters the real
    //             nameplate for each string, the total kWp is just
    //             the sum, and the weighting is derived
    //             automatically. When any entry carries a
    //             peak-kwp, the top-level `pv-peak-kwp` is ignored.
    //  share    : legacy relative weight, in [0, 1] or any positive
    //             scale. Auto-normalised so the shares used at
    //             compute time always sum to 1.0. Only consulted
    //             when NO entry carries a `peak-kwp`. Kept for
    //             back-compat; existing configs work unchanged.
    //When `pv-arrays` is present and non-empty, the legacy
    //pv-tilt / pv-azimuth keys are ignored. Empty or absent →
    //fall back to the legacy single-orientation path (or the
    //horizontal-panel fast path when those are absent too).
    //Useful for split-array roofs, roof + balcony combos, three-
    //pitch roofs, and any other install where panels don't all
    //face the same way.
    'pv-arrays'?:             unknown;
    //Display update frequency, in buckets per hour. Controls both the storage cadence of the unified
    //data source (production / cloud / irradiance / battery / grid) and the rendering cadence of every
    //graph that reads from it (radial dial, dashboard chart, timeline today). Range 1-60. Default 4 =
    //15 min slots. Higher values give more precise curves at the cost of CPU per rebuild + memory per
    //series. Forecast curve is independent: it always runs at the weather sample rate (hourly), then
    //gets interpolated into the storage buckets.
    'display-update-frequency-per-hour'?: unknown;
    //Optional home-battery overlay. A single chip below the home shows the battery State-of-Charge (%) and the live
    //signed power draw (positive charging, negative discharging), mirroring the PV chip above the home. Battery
    //entities (SoC, power, per-bank sign inversion, multi-bank aggregation) are resolved exclusively from the HA
    //Energy dashboard, no per-card entity slot.
    //Optional. Percent (0-100). Inverter cutoff SoC: the State-of-Charge at which the user's hybrid inverter stops
    //feeding the battery and clamps PV output (almost no production from the panels even when the sun is up). When
    //set AND HA Energy has at least one battery SoC source declared, calibration consumers can skip observation buckets
    //where the SoC reached or exceeded this value. Without the skip those zero-production buckets get interpreted as
    //true zeros and pollute the rolling calibration ratio. Threshold varies per inverter model (some cut at 95, some
    //at 98, some at 100); the user configures their own. Leave unset to feed every bucket into the calibration.
    'inverter-cutoff-soc-pct'?: unknown;
    //Grid import / export wiring is resolved exclusively from the HA Energy dashboard global settings: every grid
    //source's `stat_energy_from` feeds the IMPORT scrub buffer, every `stat_energy_to` feeds the EXPORT scrub
    //buffer, and the optional `stat_rate` / `power_config.stat_rate` overrides the live chip with HA's own
    //signed-power read. No per-card grid entity slot, no per-card invert flag, the sign convention is honoured via
    //HA Energy's own `power_config.stat_rate_inverted` switch on each source.
    //Picks the OpenFreeMap base style. 'streets' (default) renders
    //the full-colour Liberty style with street / POI labels suited to
    //urban areas; 'minimal' renders the muted-grey Positron style for
    //a quieter, label-light basemap that draws less attention. The
    //label visibility toggle and the helios-buildings extrusion are
    //independent of this choice (both are wired to custom sources).
    //When the active HA theme is dark (probed via hass.themes.darkMode),
    //the Fiord dark style is auto-selected so the basemap matches the
    //frontend chrome without a per-card override.
    'map-style'?:             unknown;
    //Opts the idle-camera orbit in or out. Default: false (orbit
    //disabled). When true, the camera slowly orbits around the home
    //while idle; pinch-rotate still works normally. Useful on hero
    //dashboards where the constant motion reads as alive.
    'auto-rotate-enabled'?:    unknown;
    //Optional camera pose pinned at every engine init. Numeric values
    //in degrees; when set they override the auto-default (pitch 55,
    //bearing south in NH / north in SH) so the camera always boots
    //from the same angle the user dialled in.
    //  camera-pitch-deg   : 15..85 (tilt; clamp matches the manual
    //                       drag-pitch bounds).
    //  camera-bearing-deg : 0..359 (compass rotation; 0 = north up,
    //                       90 = east up, 180 = south up, ...).
    //Either can be set independently of the other. Either still
    //allows the user to drag-rotate / drag-pitch at runtime; the
    //pose only locks when camera-locked is true.
    'camera-pitch-deg'?:       unknown;
    'camera-bearing-deg'?:     unknown;
    //Optional boolean. When true, manual drag-rotate AND drag-pitch
    //are disabled on the canvas, and the idle auto-orbit is also
    //suppressed, so the camera stays at the configured (or default)
    //bearing + pitch forever. Default false.
    'camera-locked'?:          unknown;
    //Timeline visibility toggle. Default: true. When false the whole
    //time-bar (chart card, day labels, scrub cursors) is hidden so
    //the card focuses on the live scene only.
    //Timeline width as a percentage of the card width, 50..100.
    //Default: 100 (current behaviour, hugs the card edges at 8 px).
    //Below 100, the time-bar stays centred horizontally and the
    //chart cards shrink proportionally.
    //Legacy per-layer building radius, retired in favour of `display-radius`. Kept in the type only
    //so the editor's retired-key strip can still recognise + remove it on save.
    'building-radius'?:        unknown;
    //Global display radius in metres: the single distance around the home within which buildings,
    //LiDAR cells and raster shadows are rendered. Clamped to [50, 500], default 200. Lowering it is
    //the primary perf lever on older phones (less geometry projected per frame).
    'display-radius'?:         unknown;
    //Opacity 0..1 of the surrounding buildings; home stays at 1.0.
    //Default 0.25, a "ghost" surround that conveys urban context
    //without competing with the data overlays.
    'building-opacity'?:       unknown;
    //Cluster radius (m) around the home: every building whose centroid
    //sits within this radius (or which contains the home point) is
    //treated as part of the home and painted at full opacity. Used
    //to keep verandas, garages and outbuildings physically attached
    //to the main house from rendering as semi-transparent "neighbours".
    //Default 0 (legacy single-polygon home detection).
    'building-cluster-radius'?: unknown;
    //Pixel ratio override for the WebGL canvas. 'auto' (default)
    //uses the device's native devicePixelRatio (capped at 2 on
    //desktop, 1.25 on mobile to keep fragment work bounded). '1x'
    //forces 1.0 ignoring the device, the cheapest possible per-
    //frame fragment workload, useful for low-end devices or long
    //sessions where battery / heat matters more than crispness.
    //Cast-shadow master toggle. Default true. When false, no shadows
    //are projected at all (neither LiDAR nor MapTiler).
    'shadows-enabled'?:        unknown;
    //LiDAR raster precision for shadow geometry. Only meaningful when
    //the home is inside a provider's coverage. One of:
    //  'low'    256x256 raster on the home-radius bbox
    //  'medium' 512x512
    //  'high'   1024x1024 (close to IGN native sampling)
    'lidar-precision'?:       unknown;
    //Opacity of the cast ground shadow layer, 0..1. Default 0.32.
    'shadow-opacity'?:         unknown;
    //Optional generic local nDSM (normalised Digital Surface Model)
    //GeoTIFF LiDAR provider. Lets a user point Helios at a single
    //browser-accessible Float32 GeoTIFF/COG containing height above
    //ground in metres, prepared offline. The provider is generic:
    //it carries no region-specific behaviour and is selected only
    //when explicitly enabled, fully configured, and covering the
    //home. When unset or disabled, Helios falls back to the public
    //provider chain and the OpenFreeMap building-footprint mask
    //exactly as before.
    //  lidar-local-ndsm-enabled : boolean, default false. Master
    //                             opt-in for this provider.
    //  lidar-local-ndsm-url     : string, optional. Browser-reachable
    //                             URL of the nDSM GeoTIFF (same-origin
    //                             /local/... is the recommended path).
    //  lidar-local-ndsm-min-lat : number, optional. Southern edge of
    //                             the raster's geographic extent in
    //                             EPSG:4326 degrees.
    //  lidar-local-ndsm-max-lat : number, optional. Northern edge.
    //  lidar-local-ndsm-min-lon : number, optional. Western edge.
    //  lidar-local-ndsm-max-lon : number, optional. Eastern edge.
    //The four bbox keys describe the raster's geographic frame at
    //runtime. They drive both the cheap covers(lat, lon) gate and
    //the RasterGeo extent passed to processHeightRaster() once the
    //file is decoded. Invalid or incomplete local-provider config
    //disables only the local provider instance; the rest of the
    //card config remains valid.
    'lidar-local-ndsm-enabled'? : unknown;
    'lidar-local-ndsm-url'?     : unknown;
    'lidar-local-ndsm-min-lat'? : unknown;
    'lidar-local-ndsm-max-lat'? : unknown;
    'lidar-local-ndsm-min-lon'? : unknown;
    'lidar-local-ndsm-max-lon'? : unknown;
    //Optional override for the home location. When BOTH home-latitude
    //(-90..90) and home-longitude (-180..180) parse as finite numbers
    //in range, they are used as the home coordinates instead of
    //hass.config.{latitude, longitude}. If either is missing, NaN, or
    //out of range, both are ignored and the card falls back to HA's
    //configured home. The window.__heliosLocationOverride debug helper
    //still wins over this config (it stays the developer escape hatch
    //for one-off testing from the browser console).
    'home-latitude'?:          unknown;
    'home-longitude'?:         unknown;
    //Optional live weather entity overrides. A physical sensor sitting
    //at the home (typical Ecowitt / Davis / personal weather station)
    //is more accurate than the Open-Meteo model interpolated to the
    //home's grid cell, so when the user wires one we prefer it for the
    //"now" reading. Past and forecast values keep coming from the
    //model since a sensor only knows the present.
    //  solar-radiation-entity : HA entity id of a numeric sensor
    //                           reporting global shortwave irradiance
    //                           in W/m². When set and the card is in
    //                           live mode, its value replaces the
    //                           model-derived irradiance on the sun
    //                           chip and the live W/m² readouts.
    'solar-radiation-entity'?: unknown;
    //LiDAR View overlay. When the user clicks the LiDAR View button
    //in the top-right of the card, the regular map UI fades out and
    //the raster is painted as a wireframe + filled cells coloured
    //by live solar exposure (the irradiance heat-map). Wireframe is
    //always on, colours are fixed (white) and the overall opacity is
    //controlled in-card via a bottom slider, not from config. Only
    //the point size remains configurable.
}


//Fixed-colour design system.
//
//Each metric has its own colour, fixed and configurable. We don't
//interpolate hues to convey intensity any more, instead we vary the
//area or the position of a single colour so a quick glance at the
//card tells the user "more cloud" or "more sun" without first
//decoding a rainbow ramp. The fixed colour also propagates unchanged
//across all surfaces (timeline mirror chart, on-ground cloud disc,
//on-arc sun disc) so the visual language stays internally consistent.
//
//Defaults were chosen for maximum perceptual contrast against each
//other and against typical satellite imagery:
//  - Sun: a warm amber (#EF9F27), clearly warm, high luminance,
//Defaults aligned with Home Assistant's Energy dashboard palette
//(--energy-solar-color / --energy-battery-out-color / --secondary-
//text-color). A Helios card dropped into an HA dashboard reads
//as a first-party Energy tile, and any theme that overrides the HA
//energy tokens (Catppuccin, Nord, etc.) flows through automatically
//because the CSS rules consume the same variables.
//Sun identity (arc + ray + disc) takes the HA amber tone so it
//reads as distinct from the PV production orange. Helios is named
//for the sun, the live sun on screen must not be confused with
//the "PV production" identity. amber = #ffc107.
export const DEFAULT_SUN_COLOR_HEX:   string = '#ffc107';  //--amber-color
export const DEFAULT_CLOUD_COLOR_HEX: string = '#727272';  //--secondary-text-color (neutral)
//PV chip + leader inherit the HA Energy palette's solar orange so
//Helios's PV identity is identical to the HA energy distribution
//card's solar node.
export const DEFAULT_PV_COLOR_HEX:    string = '#ff9800';  //--energy-solar-color
//SoC identity uses the HA Energy discharge teal (battery-out): the
//SoC chip displays the "stock" of energy in the bank, same color
//as battery-out in HA's energy graph. Live power direction adds
//the in/out variants below via dual-tone leaders / chips.
export const DEFAULT_BATTERY_COLOR_HEX: string = '#4db6ac';  //--energy-battery-out-color
//Battery charging (positive power) uses the HA Energy pink; discharging stays on the teal
//defined above. The leader colour reads the sign of battery power and picks one of the two
//so charging vs discharging is a glanceable distinction.
export const DEFAULT_BATTERY_IN_COLOR_HEX:  string = '#f06292';  //--energy-battery-in-color
export const DEFAULT_BATTERY_OUT_COLOR_HEX: string = '#4db6ac';  //--energy-battery-out-color
//Grid import (consumption from the grid) blue, grid return (export
//to the grid) purple. Exactly the HA Energy palette so the Helios
//map chips read as the same identity HA users see in the Energy
//dashboard.
export const DEFAULT_GRID_IMPORT_COLOR_HEX: string = '#488fc2';  //--energy-grid-consumption-color
export const DEFAULT_GRID_EXPORT_COLOR_HEX: string = '#8353d1';  //--energy-grid-return-color


//Single source of truth for the on-screen display radius across the three rendering layers:
//buildings, LiDAR raster cells, and the raster shadow polygons. Earlier betas had two independent
//constants (300 m for buildings + shadows, 150 m for the LiDAR overlay) which made it impossible to
//reason about what the user actually saw when comparing layers, and changes in one drifted out of
//sync with the other. Now everything reads from DEFAULT_DISPLAY_RADIUS_M.
//
//200 m is the default: the home cluster reads as "the buildings around my house" without dragging
//the basemap + per-frame projection on mid-range phones. The user can dial it down via the
//`display-radius` editor slider on older / slower devices where rendering the full 200 m disc of
//buildings + LiDAR cells + shadows is the bottleneck, or up for a wider survey. The LiDAR overlay
//fades to zero opacity at the outer boundary, see DISPLAY_FADE_DELTA_M below.
export const DEFAULT_DISPLAY_RADIUS_M = 200;
//Editor slider bounds for the global display radius. 50 m keeps the rendered disc tiny (the perf
//floor for old phones); 500 m is the widest survey before the per-frame projection of building +
//cell + shadow geometry starts to cost on mid-range hardware.
export const MIN_DISPLAY_RADIUS_M = 50;
export const MAX_DISPLAY_RADIUS_M = 500;
//Width of the LiDAR fade band, measured INWARD from DEFAULT_DISPLAY_RADIUS_M. Cells whose distance
//is in [DEFAULT_DISPLAY_RADIUS_M - DISPLAY_FADE_DELTA_M, DEFAULT_DISPLAY_RADIUS_M] smoothstep-fade
//from full opacity down to zero. Buildings + raster shadows are binary at the display radius (no
//fade) because their footprints are clamped server-side at the tile boundary.
export const DISPLAY_FADE_DELTA_M = 50;
export const DEFAULT_BUILDING_OPACITY          = 0.25;
export const DEFAULT_BUILDING_CLUSTER_RADIUS_M = 0;
export const DEFAULT_BUILDING_COLOR_HEX        = '#d2d2d7';

//Default and allowed range for the user-facing display update frequency (buckets per hour). 4 = a
//bucket every 15 minutes, the sweet spot between visible curve precision and rebuild CPU cost. The
//slider clamps to [1, 12]: 12 buckets / hour = 5 minutes, which is the recorder's finest statistics
//period (HA has no statistics period shorter than 5 minutes). Asking for more than 12 / hour could
//only interpolate the 5-minute buckets into cosmetic sub-buckets, no extra real data, so the ceiling
//sits at the point where every step still maps to a distinct recorder bucket.
export const DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR = 4;
export const MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR     = 1;
export const MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR     = 12;

//Resolve the bucket cadence (buckets per hour) the data source and every graph reads from. Reads
//the user-facing config key, clamps to the allowed range, falls back to the default for missing /
//invalid values. Same helper used by the store builder + by every consumer that needs the cadence
//(SVG path builders, chart aspect ratio, etc.) so the value reaches every surface from a single
//source of truth.
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


//Resolve the global display radius in metres from the `display-radius` config key, clamped to
//[MIN_DISPLAY_RADIUS_M, MAX_DISPLAY_RADIUS_M], defaulting to DEFAULT_DISPLAY_RADIUS_M for missing /
//invalid values. Single source of truth for the radius the engine renders buildings, LiDAR cells and
//raster shadows within, so lowering it on an old phone shrinks every layer's geometry in lockstep.
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


//Shadow precision levels. Each level is a multiplier on the active provider's native cell pitch:
//
//  'high'   1x native (one fetched cell per real source sample)
//  'medium' 2x native (one fetched cell per 4 real samples)
//  'low'    4x native (one fetched cell per 16 real samples)
//
//Pinning the request to the upstream's natural sampling means every
//rendered point matches a real publication cell rather than a server-
//side interpolation. Density grows with smaller pitches (e.g. France
//0.5 m vs Spain 2.5 m) and with bigger radii. Only meaningful when
//the home is inside a provider's coverage; outside, shadows fall
//back to MapTiler footprints regardless of this setting.
export type LidarPrecisionLevel = 'low' | 'medium' | 'high';
export const DEFAULT_LIDAR_PRECISION: LidarPrecisionLevel = 'medium';
//Precision -> pitch multiplier. The fetched raster's effective cell
//pitch is `nativePitch x multiplier`; rasterSize is derived from the
//radius and that effective pitch, clamped by the pipeline defaults.
export const LIDAR_PRECISION_PITCH_MULT: Record<LidarPrecisionLevel, number> = {
    low:    4,
    medium: 2,
    high:   1
};
//Default opacity of the ground shadow layer when the user has not set the `shadow-opacity` config option.
export const DEFAULT_SHADOW_OPACITY = 0.32;


//Default opt-in for the generic local-nDSM LiDAR provider. Exported so the visual editor can render the matching toggle default. The provider stays
//disabled until the user flips this AND supplies the URL + bbox in the editor / YAML.
export const DEFAULT_LIDAR_LOCAL_NDSM_ENABLED = false;


//LiDAR View overlay defaults. The disc radius is now derived from DEFAULT_DISPLAY_RADIUS_M above
//(single source of truth across buildings, LiDAR + shadows). Colours are fixed to white inside the
//layer; overall opacity is runtime state driven by the in-card bottom slider
//(DEFAULT_LIDAR_VIEW_OPACITY is the value the slider lands on the first time the user opens the view).
export const DEFAULT_LIDAR_VIEW_OPACITY        = 0.25;
//Distance from the home where the LiDAR overlay alpha starts ramping down. Inside this radius the
//cloud is at full opacity; in [LIDAR_VIEW_FULL_OPACITY_RADIUS_M, DEFAULT_DISPLAY_RADIUS_M] it
//smoothstep-fades to zero. Derived from DEFAULT_DISPLAY_RADIUS_M - DISPLAY_FADE_DELTA_M so a single
//edit at the top of this file rescales every layer consistently.
export const LIDAR_VIEW_FULL_OPACITY_RADIUS_M = DEFAULT_DISPLAY_RADIUS_M - DISPLAY_FADE_DELTA_M;


//Timeline defaults. Exposed so the editor placeholders + sliders land on the same values the runtime falls back to when the config key is absent.
