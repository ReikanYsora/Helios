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
    //When false, all of OpenFreeMap's label layers
    //(road names, building numbers, POI labels, place names) are
    //hidden for a cleaner, minimalist basemap. Default: true.
    'show-labels'?:           unknown;
    //Fixed-colour design system. Each metric has one configurable
    //colour reused everywhere it appears (timeline mirror chart +
    //on-arc sun disc for sun, on-ground disc + timeline lower half
    //for cloud). Intensity is conveyed by area / position rather than
    //by hue interpolation, so a high cloud reading reads consistently
    //as "more" regardless of the chosen colour.
    'sun-color'?:             unknown;
    'cloud-color'?:           unknown;
    //Optional photovoltaic production overlay.
    //  pv-power-entity : Home Assistant entity id of a numeric sensor
    //                    representing solar production (instantaneous
    //                    power in W/kW for an impact-readable curve,
    //                    or cumulative daily energy for a saw-tooth
    //                    accumulation curve). When unset, the whole
    //                    PV overlay (chip below the home, dedicated
    //                    timeline graph) is hidden.
    //  pv-color        : single colour used everywhere PV appears
    //                    (chip icon tint, dedicated graph fill /
    //                    stroke). Defaults to a vivid green chosen
    //                    to read cleanly on the white chart card.
    'pv-power-entity'?:       unknown;
    'pv-color'?:              unknown;
    //Installed peak power of the PV array in kWp (kilowatt-peak).
    //Optional; when set, it scales the predicted clear-sky percentage
    //(0..100) into watts so the dotted forecast curve on the PV chart
    //reflects the user's install. Without it, no prediction is drawn,
    //but live observation, peak-of-day highlight and chart axes keep
    //working off the actual PV entity.
    //
    //Superseded by per-string `pv-arrays[].peak-kwp`: when any array entry carries a `peak-kwp`, the total install power is the sum of those values
    //and `pv-peak-kwp` is ignored. Existing configs that only set `pv-peak-kwp` keep working unchanged through the legacy share-based weighting.
    'pv-peak-kwp'?:           unknown;
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
    //Optional home-battery overlay. A single chip below the
    //home shows the battery State-of-Charge (%) and the live signed
    //power draw (positive while charging, negative while discharging),
    //mirroring the PV chip above the home. Either entity is optional;
    //the chip renders as long as at least one is set, with a leader
    //line whose flow direction follows the sign of the power.
    //  battery-soc-entity   : Home Assistant entity id of a numeric
    //                         sensor in % (typical: device_class
    //                         "battery", or unit "%"). Out-of-range
    //                         values are clamped to [0, 100].
    //  battery-power-entity : Home Assistant entity id of a numeric
    //                         power sensor in W or kW. Sign convention
    //                         follows the entity itself; positive is
    //                         interpreted as charging.
    //  battery-color        : single colour used everywhere battery
    //                         appears (chip text, border, leader,
    //                         flow arrow). Defaults to a vivid purple.
    'battery-soc-entity'?:    unknown;
    'battery-power-entity'?:  unknown;
    //Optional. Multi-bank battery support. When present, takes
    //precedence over the flat battery-soc-entity / battery-power-
    //entity / battery-power-invert keys above (which become a
    //single-bank legacy fallback). Each entry:
    //  - name        : optional, free text, used in the editor row
    //                  header. Defaults to "Battery N".
    //  - soc-entity  : required, HA entity id, % (0-100, clamped).
    //  - power-entity: required, HA entity id, W or kW. Signed.
    //  - power-invert: optional bool, flips the sign at ingest
    //                  (per-bank). Default false.
    //  - capacity-kwh: optional weight used to aggregate the
    //                  banks' SoC into the single chip painted on
    //                  the card (capacity-weighted average). Default
    //                  1, meaning equal weight: leave unset when all
    //                  banks are the same size. Set it explicitly
    //                  when bank sizes differ so the displayed SoC
    //                  reflects the real stored-energy ratio rather
    //                  than a flat unweighted mean.
    //Aggregation rules:
    //  - SoC chip = Σ(soc_i × capacity_i) / Σ(capacity_i)
    //  - Power chip = Σ(power_i)  (each bank inverted per its own
    //                              power-invert flag first)
    //  - inverter-cutoff-soc-pct: skips the trainer bucket when
    //    ALL banks are at or above the threshold (min SoC across
    //    banks ≥ cutoff), so a half-full bank correctly trains
    //    even while a sibling bank is full.
    'batteries'?:             unknown;
    //Optional. When true, the live and historical battery power
    //readings are multiplied by -1 before being stored. Use this
    //when the upstream entity reports charging as negative and
    //discharging as positive (some GivEnergy / GivTCP setups), so
    //Helios's internal "positive = charging" convention keeps
    //holding without a template sensor in front. Default false.
    'battery-power-invert'?:  unknown;
    //Optional. Percent (0-100). Inverter cutoff SoC: the State-of-Charge at which the user's hybrid inverter stops feeding the battery and clamps PV
    //output (almost no production from the panels even when the sun is up). When set AND `battery-soc-entity` is also configured, the shading map
    //trainer skips every observation bucket where the battery SoC reached or exceeded this value. Without the skip, those zero-production buckets
    //get interpreted as 100 % shading at the matching sun azimuth / altitude / cloud bin and pollute the shading map for the next ~60 days of half-
    //life decay. Threshold varies per inverter model (some cut at 95, some at 98, some at 100); the user configures their own. Leave unset to keep
    //the legacy behaviour where every bucket trains.
    'inverter-cutoff-soc-pct'?: unknown;
    'battery-color'?:         unknown;
    //Optional. HA entity ids for the grid import / grid export
    //meters the user already exposes through a sensor (or the HA
    //Energy dashboard). The card reads the live values, the
    //visual placement of the readouts is being reworked.
    'grid-import-entity'?:    unknown;
    'grid-export-entity'?:    unknown;
    //Optional. Single COMBINED grid power/energy entity whose sign
    //encodes the direction: many smart meters and inverters expose
    //one signed sensor (Fronius P_Grid, Shelly EM, P1 net power,
    //...) instead of two separate import / export indexes. When set,
    //this entity drives BOTH chips: the card reads its sign and
    //routes a positive value to the IMPORT chip and a negative value
    //to the EXPORT chip (one direction at a time, the other chip is
    //hidden). It takes precedence over grid-import-entity /
    //grid-export-entity, which are ignored while it is configured.
    //
    //Accepts a power sensor (W / kW / MW, the value IS the signed
    //watts) or a signed net-energy sensor (Wh / kWh / MWh whose
    //running total can go down when exporting, the slope IS the
    //signed watts). An array is summed (e.g. three signed per-phase
    //power sensors -> net grid power).
    //
    //Default sign convention: positive = import (drawing from the
    //grid), negative = export (feeding the grid), matching the most
    //common meter / inverter convention. Flip it with
    //grid-power-invert when the upstream sensor reports the opposite.
    'grid-power-entity'?:     unknown;
    //Optional boolean. When true, the combined grid-power-entity sign
    //is flipped at ingest so a positive reading is treated as EXPORT
    //and a negative reading as IMPORT. Use it when the meter reports
    //grid feed-in as positive. Default false. Ignored when
    //grid-power-entity is not set.
    'grid-power-invert'?:     unknown;
    'date-format'?:           unknown;
    //'12h' | '24h'. Default: '24h'. Picks between locale-
    //independent 12-hour ("11:23:45 PM") and 24-hour ("23:23:45")
    //rendering of the date/time chip at the top-right of the card.
    'time-format'?:           unknown;
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
    //Opts the idle-camera orbit in or out. Default: true (orbit
    //enabled). When false, the camera stays at the user's bearing
    //forever; pinch-rotate still works normally. Useful on low-power
    //devices or for users who find the constant motion distracting.
    'auto-rotate-enabled'?:    unknown;
    //Timeline visibility toggle. Default: true. When false the whole
    //time-bar (chart card, day labels, scrub cursors) is hidden so
    //the card focuses on the live scene only.
    'timeline-enabled'?:       unknown;
    //Timeline width as a percentage of the card width, 50..100.
    //Default: 100 (current behaviour, hugs the card edges at 8 px).
    //Below 100, the time-bar stays centred horizontally and the
    //chart cards shrink proportionally.
    'timeline-width-pct'?:     unknown;
    //Show the per-day cumulative kWh chip next to each day label on the timeline. Default: true. When false, only the date is rendered, which keeps
    //the chart cleaner when the user is not tracking production volumes.
    'timeline-consumption-enabled'?: unknown;
    //Radius (m) around the home within which surrounding buildings are
    //rendered. Buildings outside are not drawn at all. Default 100 m.
    'building-radius'?:        unknown;
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
    //Hex colour of every rendered building (home and surroundings
    //share the same base tone, modulated by sun altitude). The
    //surrounding extrusions remain visually distinct via opacity,
    //not hue. Default neutral cool grey #d2d2d7.
    'building-color'?:         unknown;
    //Pixel ratio override for the WebGL canvas. 'auto' (default)
    //uses the device's native devicePixelRatio (capped at 2 on
    //desktop, 1.25 on mobile to keep fragment work bounded). '1x'
    //forces 1.0 ignoring the device, the cheapest possible per-
    //frame fragment workload, useful for low-end devices or long
    //sessions where battery / heat matters more than crispness.
    'pixel-ratio'?:           unknown;
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
    //  lidar-view-point-size: pixels (1..6). Square side length per
    //                         point on the canvas. Default 1.
    'lidar-view-point-size'?: unknown;
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
//text-color). A Helios card dropped into an HA dashboard now reads
//as a first-party Energy tile by default, and any theme that
//overrides the HA energy tokens (Catppuccin, Nord, etc.) flows
//through automatically because the CSS rules consume the same
//variables. The legacy per-config colour overrides
//(sun-color / cloud-color / pv-color / battery-color in YAML) are
//no longer read, those keys stay in the config type for backward
//compatibility but the renderer ignores them.
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
//Battery charging (positive power) uses the HA Energy pink. The
//card splits the battery power leader colour by sign: charging =
//pink, discharging = teal, the dual indicator the user requested
//in the backlog.
export const DEFAULT_BATTERY_IN_COLOR_HEX:  string = '#f06292';  //--energy-battery-in-color
export const DEFAULT_BATTERY_OUT_COLOR_HEX: string = '#4db6ac';  //--energy-battery-out-color
//Grid import (consumption from the grid) blue, grid return (export
//to the grid) purple. Exactly the HA Energy palette so the Helios
//map chips read as the same identity HA users see in the Energy
//dashboard.
export const DEFAULT_GRID_IMPORT_COLOR_HEX: string = '#488fc2';  //--energy-grid-consumption-color
export const DEFAULT_GRID_EXPORT_COLOR_HEX: string = '#8353d1';  //--energy-grid-return-color


//Default values for the building config, exposed so the visual editor can render the matching placeholder / slider defaults.
export const DEFAULT_BUILDING_RADIUS_M         = 100;
export const DEFAULT_BUILDING_OPACITY          = 0.25;
export const DEFAULT_BUILDING_CLUSTER_RADIUS_M = 0;
export const DEFAULT_BUILDING_COLOR_HEX        = '#d2d2d7';


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


//LiDAR View overlay defaults. The disc radius is taken from the
//shared `building-radius` (the "Display radius" knob) so the View
//and the rest of the card stay in sync. Colours are fixed to white
//inside the layer; overall opacity is runtime state driven by the
//in-card bottom slider (DEFAULT_LIDAR_VIEW_OPACITY is the value the
//slider lands on the first time the user opens the view).
export const DEFAULT_LIDAR_VIEW_POINT_SIZE_PX  = 1;
export const DEFAULT_LIDAR_VIEW_OPACITY        = 0.25;
//Distance from the home at which the LiDAR view is at full opacity.
//Beyond this, alpha smoothstep-fades down to 0 at the display
//radius below, so the cloud reads as anchored on the home and
//dissolves into the basemap as you look further out. Decoupled from
//building-radius on purpose: the building-radius controls the data
//fetch (shadows, vegetation extent) and the LiDAR overlay shouldn't
//inherit that bound, mixing the two knobs felt opaque in the editor.
export const LIDAR_VIEW_FULL_OPACITY_RADIUS_M = 100;
//Outer radius where the LiDAR view alpha hits zero. Fixed regardless of the configured fetch radius. Past this distance the shader fades cells to
//zero, so we never paint a million dots for cells the user can barely see anyway, which keeps frame times stable on fullscreen layouts.
export const LIDAR_VIEW_DISPLAY_RADIUS_M = 150;


//Timeline defaults. Exposed so the editor placeholders + sliders land on the same values the runtime falls back to when the config key is absent.
export const DEFAULT_TIMELINE_ENABLED              = true;
export const DEFAULT_TIMELINE_WIDTH_PCT            = 100;
export const DEFAULT_TIMELINE_CONSUMPTION_ENABLED  = true;
