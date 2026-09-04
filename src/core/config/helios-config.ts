//Public config schema for the card: the option keys the user touches via YAML or the visual editor, plus
//the resolver helpers the editor + runtime read. The DEFAULT_*/MIN/MAX values live in constants.ts; this
//module imports them for the resolvers and re-exports them for `from './helios-config'` consumers.

import {
    DEFAULT_DISPLAY_RADIUS_M, MIN_DISPLAY_RADIUS_M, MAX_DISPLAY_RADIUS_M,
    DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    DEFAULT_VALUE_DECIMALS, MIN_VALUE_DECIMALS, MAX_VALUE_DECIMALS,
    DEFAULT_MAX_EXPECTED_POWER_W, MIN_MAX_EXPECTED_POWER_W, MAX_MAX_EXPECTED_POWER_W,
    DEFAULT_BUILDING_COUNT, MIN_BUILDING_COUNT, MAX_BUILDING_COUNT,
    FIXED_BUILDING_HEIGHT_M, MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M,
    DEFAULT_NO_UI_DELAY_S, MIN_NO_UI_DELAY_S, MAX_NO_UI_DELAY_S,
    SCENE_ZOOM_LEVELS, DEFAULT_SCENE_ZOOM,
} from './constants';
import { clamp } from '../render-kit/math';

export {
    DEFAULT_BUILDING_OPACITY,
    DEFAULT_BUILDING_CLUSTER_RADIUS_M, DEFAULT_DISPLAY_RADIUS_M, MIN_DISPLAY_RADIUS_M,
    SCENE_ZOOM_LEVELS, DEFAULT_SCENE_ZOOM,
    MAX_DISPLAY_RADIUS_M, DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, DEFAULT_VALUE_DECIMALS,
    MIN_VALUE_DECIMALS, MAX_VALUE_DECIMALS,
    DEFAULT_MAX_EXPECTED_POWER_W, MIN_MAX_EXPECTED_POWER_W, MAX_MAX_EXPECTED_POWER_W,
    DEFAULT_SHADOW_OPACITY,
    DEFAULT_BUILDING_COUNT, MIN_BUILDING_COUNT, MAX_BUILDING_COUNT,
    FIXED_BUILDING_HEIGHT_M, MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M,
    DEFAULT_NO_UI_DELAY_S, MIN_NO_UI_DELAY_S, MAX_NO_UI_DELAY_S,
} from './constants';


//User-facing config passed to setConfig(), read by the engine + editor. Every key is optional and typed
//`unknown`; callers validate/coerce, and the DEFAULT_* consts below fill in absent keys.
export interface HeliosConfig
{
    //Index signature so unknown keys read as `unknown` without widening errors; the editor strips any
    //key not in the named schema below on save.
    [key: string]: unknown;
    //Storage + render cadence in buckets/hour for the unified data source and every graph. Range 1-6,
    //default 4 (15 min). Higher = finer curves at more CPU/memory. Forecast stays hourly, then interpolated.
    'display-update-frequency-per-hour'?: unknown;
    //Idle-camera orbit opt-in. Default false.
    'auto-rotate-enabled'?:    unknown;
    //Camera pose pinned at init (degrees), overriding the auto-default (CAMERA_PITCH_REST_DEG, bearing toward
    //the equator). pitch CAMERA_PITCH_MIN_DEG..CAMERA_PITCH_MAX_DEG (0..65), bearing 0..359; either can be set
    //alone. Drag still works unless camera-locked.
    'camera-pitch-deg'?:       unknown;
    'camera-bearing-deg'?:     unknown;
    //When true, drag-rotate/pitch and the idle orbit are disabled so the camera stays at the configured pose. Default false.
    'camera-locked'?:          unknown;
    //Global display radius (m) around the home within which buildings and shadows render. Clamped [0,250],
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
    //"No UI" idle delay in seconds (0..10) before the timeline + controls fade in No UI mode. Default 5. Only
    //used when 'auto-hide-ui' is on.
    'no-ui-delay'?:            unknown;
    //Per-chip visibility (the "Chips & colours" section). Each defaults to visible; explicit false hides that
    //chip family. Home hidden swaps the central pill for a small hollow ring the leads converge on.
    'chip-irradiance-visible'?: unknown;
    'chip-production-visible'?: unknown;
    'chip-grid-visible'?:       unknown;
    'chip-battery-visible'?:    unknown;
    'chip-home-visible'?:       unknown;
    //Per-group chip visibility override (group number -> true = hidden). A group chip shows when it has visible
    //devices AND is not hidden here. Absent = every group visible.
    'monitoring-group-hidden'?: unknown;
    //Per-chip colour overrides (ui_color token or #/rgb/var literal). Empty/absent falls back to the energy token.
    //Grid + battery carry a colour per direction so import/export and charge/discharge stay distinct.
    'chip-irradiance-color'?:        unknown;
    'chip-production-color'?:        unknown;
    'chip-grid-import-color'?:       unknown;
    'chip-grid-export-color'?:       unknown;
    'chip-battery-charge-color'?:    unknown;
    'chip-battery-discharge-color'?: unknown;
    'chip-temperature-color'?:       unknown;
    'chip-humidity-color'?:          unknown;
    //Home (consumption) chip colour; also the home pill's resting colour. Default 'primary'. The home building
    //otherwise follows the selected chip's colour.
    'chip-home-color'?:         unknown;
    //Per-chip icon overrides (mdi). Empty/absent falls back to the chip's built-in glyph. Grid + battery carry an
    //icon per direction so import/export and charge/discharge each stay recognisable.
    'chip-irradiance-icon'?:          unknown;
    'chip-production-icon'?:           unknown;
    'chip-grid-import-icon'?:          unknown;
    'chip-grid-export-icon'?:          unknown;
    'chip-battery-charge-icon'?:       unknown;
    'chip-battery-discharge-icon'?:    unknown;
    'chip-home-icon'?:                unknown;
    'chip-temperature-icon'?:         unknown;
    'chip-humidity-icon'?:            unknown;
    //Outdoor temperature + humidity chips (top-left column). Default shown when data is available.
    'show-temperature'?:        unknown;
    'show-humidity'?:           unknown;
    //Scene UI toggles (all default visible). show-timeline hides the timeline + the period selector; the detail
    //panel toggle hides the tap-to-open per-chip mini-panel; sun-times hides the sunrise/sunset markers at the arc.
    'show-timeline'?:           unknown;
    'show-detail-panel'?:       unknown;
    'show-sun-times'?:          unknown;
    'show-horizon-line'?:       unknown;
    'horizon-line-color'?:      unknown;
    //Moon arc + crescent disc: 'always' | 'night' (only while the sun is down) | 'hidden'. Cosmetic, no chip.
    'moon-display'?:            unknown;
    //Scene magnification, one of SCENE_ZOOM_LEVELS (1 = as-is). See sceneZoom().
    'scene-zoom'?:              unknown;
    'sun-chip-mode'?:           unknown;
    'battery-chip-mode'?:       unknown;
    //Per-card cache id. When set, the saved view (mode, filters, camera pose, lock) keys on it instead of the
    //home coordinates, so two cards on the same home keep independent state. Empty = shared per-home cache.
    'cache-id'?:                unknown;
    //Power readout unit for the whole card: 'W' or 'kW'. Default 'kW'. Energy totals follow it by default
    //('energy-unit' absent or 'auto'), unless 'energy-unit' is set on its own.
    'power-unit'?:             unknown;
    //Energy total unit: 'auto' (follow power-unit, the default), 'Wh' or 'kWh'.
    'energy-unit'?:            unknown;
    //Irradiance (solar constant) readout unit: 'W/m²', 'kW/m²' or 'W/ft²'. Default 'W/m²'.
    'irradiance-unit'?:        unknown;
    //Battery chip sign convention: 'default' (- charging, + discharging), 'inverted' (+ charging,
    //- discharging), or 'hidden' (magnitude only). Display-only; flow direction and history are unchanged.
    'battery-sign'?:           unknown;
    //"Your real sky" weather effects (cloud grade + rain / snow / thunderstorm), driven by the real weather at the
    //live/scrub time. Default true.
    'weather-enabled'?:        unknown;
    //Local-sensor overrides for the weather variables: a configured entity beats Open-Meteo for the live + past
    //window (forecast keeps the model). Temperature feeds the temperature chip; humidity the humidity readout.
    'cloud-cover-entity'?:     unknown;
    'precipitation-entity'?:   unknown;
    'snowfall-entity'?:        unknown;
    'temperature-entity'?:     unknown;
    'humidity-entity'?:        unknown;
    //A HA `weather` entity whose condition (rain / snow / thunderstorm) overrides the model for the live + past.
    'weather-entity'?:         unknown;
    //"No UI" mode: when true, the timeline and the on-card controls fade away after a short idle and reappear on
    //any input (kiosk/immersive display). Default false. Idle delay set via 'no-ui-delay'.
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

//Resolved ui_color token for the home (consumption) colour (home pill + every consumption readout). Reads the
//home chip's colour; default 'primary' (the home building otherwise follows the selected chip).
export function homeColor(config: HeliosConfig | undefined): string
{
    const raw = config?.['chip-home-color'];
    const token = typeof raw === 'string' ? raw.trim() : '';
    return token || 'primary';
}


//Resolved per-card cache id (empty string when unset); isolates the saved view between same-home cards.
export function cacheId(config: HeliosConfig | undefined): string
{
    const raw = config?.['cache-id'];
    return typeof raw === 'string' ? raw.trim() : '';
}


//Read an integer config value, rounding then clamping to [min, max], returning `def` when missing or non-numeric.
//The single parse-round-clamp routine behind every numeric config resolver below.
function resolveClampedInt(config: HeliosConfig | undefined, key: string, def: number, min: number, max: number): number
{
    const raw = config?.[key];
    const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
    if (!Number.isFinite(parsed))
    {
        return def;
    }
    return clamp(Math.round(parsed), min, max);
}

//Resolve the bucket cadence (buckets/hour), clamped to range, defaulting on missing/invalid. Single source
//for the store builder + every cadence consumer (path builders, chart aspect...).
export function displayUpdateFrequencyPerHour(config: HeliosConfig | undefined): number
{
    return resolveClampedInt(config, 'display-update-frequency-per-hour', DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR);
}


//Resolve the decimal-place count from `value-decimals`, clamped [0,3], defaulting on missing/invalid.
export function valueDecimals(config: HeliosConfig | undefined): number
{
    return resolveClampedInt(config, 'value-decimals', DEFAULT_VALUE_DECIMALS, MIN_VALUE_DECIMALS, MAX_VALUE_DECIMALS);
}

//The power (W) at which any flow animates at full speed. Every flow's pace is normalised against it, so the
//largest live flow always reads as the fastest. Defaults to DEFAULT_MAX_EXPECTED_POWER_W.
export function maxExpectedPowerW(config: HeliosConfig | undefined): number
{
    return resolveClampedInt(config, 'max-expected-power', DEFAULT_MAX_EXPECTED_POWER_W, MIN_MAX_EXPECTED_POWER_W, MAX_MAX_EXPECTED_POWER_W);
}


//Resolved power readout unit ('W' or 'kW') for every power value on the card. Default 'kW' so existing cards
//are unchanged.
export function powerUnit(config: HeliosConfig | undefined): 'W' | 'kW'
{
    return config?.['power-unit'] === 'W' ? 'W' : 'kW';
}


//Resolved energy total unit ('Wh' or 'kWh'). Explicit 'energy-unit' wins; absent or 'auto' mirrors powerUnit
//(kW -> kWh, W -> Wh), exactly today's behaviour, so an existing card is unchanged until the user picks one on
//its own.
export function energyUnit(config: HeliosConfig | undefined): 'Wh' | 'kWh'
{
    const raw = config?.['energy-unit'];
    if (raw === 'Wh')
    {
        return 'Wh';
    }
    if (raw === 'kWh')
    {
        return 'kWh';
    }
    return powerUnit(config) === 'W' ? 'Wh' : 'kWh';
}


//Resolved irradiance (solar constant) readout unit ('W/m²', 'kW/m²' or 'W/ft²'). Default 'W/m²'.
export function irradianceUnit(config: HeliosConfig | undefined): 'W/m²' | 'kW/m²' | 'W/ft²'
{
    const raw = config?.['irradiance-unit'];
    if (raw === 'kW/m²')
    {
        return 'kW/m²';
    }
    if (raw === 'W/ft²')
    {
        return 'W/ft²';
    }
    return 'W/m²';
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


//"Your real sky" weather effects. Default on (explicit false disables).
export function weatherEnabled(config: HeliosConfig | undefined): boolean
{
    return config?.['weather-enabled'] !== false;
}

//Force the compatibility ("degraded") renderer: the projected ground path, with no CSS 3D transform on the
//basemap. Opt-in (default off), for devices whose WebView flickers on the 3D-transformed ground even though the
//auto-detection left them on a transform path. Trades the cheap GPU rotation for a per-frame CPU reproject.
export function degradedRender(config: HeliosConfig | undefined): boolean
{
    return config?.['degraded-render'] === true;
}


//Scene UI element toggles (all default visible; explicit false hides). show-timeline covers the timeline band +
//the period selector; detail-panel is the tap-to-open per-chip mini-panel; sun-times are the sunrise/sunset arc markers.
export function showTimeline(config: HeliosConfig | undefined): boolean
{
    return config?.['show-timeline'] !== false;
}
export function showDetailPanel(config: HeliosConfig | undefined): boolean
{
    return config?.['show-detail-panel'] !== false;
}
export function showSunTimes(config: HeliosConfig | undefined): boolean
{
    return config?.['show-sun-times'] !== false;
}
//Drawn terrain-horizon ridge line. Default shown; hidden when explicitly false. The sun gate uses the terrain
//regardless of this, so hiding the line never changes the realistic dimming behind hills.
export function showHorizonLine(config: HeliosConfig | undefined): boolean
{
    return config?.['show-horizon-line'] !== false;
}
export type MoonDisplay = 'always' | 'night' | 'hidden';
//Moon arc + phase disc visibility. Default 'night' (only while the sun is below the horizon, when a moon is
//expected and the sun's own layers have dimmed); 'always' keeps it up in daylight too; 'hidden' drops it entirely.
//Purely cosmetic: it drives no chip, no value, no calculation.
export function moonDisplay(config: HeliosConfig | undefined): MoonDisplay
{
    const v = config?.['moon-display'];
    return v === 'always' || v === 'hidden' ? v : 'night';
}
//Scene magnification: 1 (default, today's rendering), 1.5 or 2. Multiplies the camera's px-per-metre, so the
//basemap, buildings and shadows grow around the home; the sun/moon arcs, discs and chips stay card-sized (the arc
//scale probe measures projected px per metre and compensates). Accepts a number or a numeric string (the editor's
//select emits strings); anything else falls back to 1.
export type SceneZoom = (typeof SCENE_ZOOM_LEVELS)[number];
export function sceneZoom(config: HeliosConfig | undefined): SceneZoom
{
    const raw = config?.['scene-zoom'];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    return (SCENE_ZOOM_LEVELS as readonly number[]).includes(n) ? (n as SceneZoom) : DEFAULT_SCENE_ZOOM;
}

//Configured colour for the horizon ridge line, as a ui_color token or hex. Undefined falls back to the card CSS.
export function horizonLineColor(config: HeliosConfig | undefined): string | undefined
{
    const v = config?.['horizon-line-color'];
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}
//Outdoor temperature + humidity chips (top-left column). Default shown; hidden when explicitly false or no data.
export function showTemperature(config: HeliosConfig | undefined): boolean
{
    return config?.['show-temperature'] !== false;
}
export function showHumidity(config: HeliosConfig | undefined): boolean
{
    return config?.['show-humidity'] !== false;
}
//Cost chip: shown by default, but only actually renders when a cost is configured in the Energy dashboard (the
//card gates on a resolvable live rate). Hidden when explicitly turned off.
export function showCost(config: HeliosConfig | undefined): boolean
{
    return config?.['show-cost'] !== false;
}

export type SunChipMode = 'irradiance' | 'position';
//What the sun chip reads out: live irradiance (default) or the sun's position (azimuth + elevation).
//Position is pure engine maths, needs no entity.
export function sunChipMode(config: HeliosConfig | undefined): SunChipMode
{
    return config?.['sun-chip-mode'] === 'position' ? 'position' : 'irradiance';
}

export type BatteryChipMode = 'power' | 'soc';
//What the fused battery chip reads out: live power (default) or the state of charge (%). The other reading
//still drives the icon, and the chip falls back to whichever value is actually available.
export function batteryChipMode(config: HeliosConfig | undefined): BatteryChipMode
{
    return config?.['battery-chip-mode'] === 'soc' ? 'soc' : 'power';
}


//Idle delay (ms) before the No UI fade, from the 'no-ui-delay' config key (seconds, clamped to [MIN,MAX]).
//Defaults to DEFAULT_NO_UI_DELAY_S when unset or invalid.
export function noUiDelayMs(config: HeliosConfig | undefined): number
{
    //parseFloat (not Number): Number('') and Number('  ') are 0, which would silently mean a 0 ms delay instead of
    //the default; parseFloat yields NaN there and falls through to DEFAULT_NO_UI_DELAY_S.
    const raw = Number.parseFloat(String(config?.['no-ui-delay'] ?? ''));
    const secs = Number.isFinite(raw)
        ? Math.min(MAX_NO_UI_DELAY_S, Math.max(MIN_NO_UI_DELAY_S, raw))
        : DEFAULT_NO_UI_DELAY_S;
    return secs * 1000;
}


//Recorder-meter ids the user hid (fully excluded from every view).
export function hiddenDevices(config: HeliosConfig | undefined): Set<string>
{
    const raw = config?.['hidden-devices'];
    const out = new Set<string>();
    if (Array.isArray(raw))
    {
        for (const v of raw)
        {
            if (typeof v === 'string' && v.trim() !== '')
            {
                out.add(v.trim());
            }
        }
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
            if (id !== '' && Number.isInteger(g) && g >= 1 && g <= GROUP_COUNT)
            {
                out.set(id, g);
            }
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
        if (typeof v === 'string')
        {
            return v.trim();
        }
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
    if (!token)
    {
        return fallback;
    }
    if (/^(#|rgb|var)/i.test(token))
    {
        return token;
    }
    return `var(--${token}-color, ${fallback})`;
}


//Whether a group's chip is shown: true unless the user hid it via 'monitoring-group-hidden' (group -> true). A
//group still only appears once it ALSO has at least one visible device (see activeGroups).
export function groupChipVisible(config: HeliosConfig | undefined, group: number): boolean
{
    const raw = config?.['monitoring-group-hidden'];
    if (raw && typeof raw === 'object' && !Array.isArray(raw))
    {
        return (raw as Record<string, unknown>)[String(group)] !== true;
    }
    return true;
}


//Whether a fixed chip is shown: true unless hidden via its 'chip-<name>-visible' key.
export function chipVisible(config: HeliosConfig | undefined, key: string): boolean
{
    return (config as Record<string, unknown> | undefined)?.[key] !== false;
}


//=== Vector basemap (map) configuration ===
export type MapThemeMode = 'auto' | 'dark' | 'light' | 'custom';

//How the vector basemap picks its colours: auto follows the HA theme, dark/light force a polarity, custom uses
//the per-layer colours + visibility below.
export function mapThemeMode(config: HeliosConfig | undefined): MapThemeMode
{
    const v = (config as Record<string, unknown> | undefined)?.['map-theme-mode'];
    return v === 'dark' || v === 'light' || v === 'custom' ? v : 'auto';
}

//Per-layer config keys for the custom colour + visibility.
export function mapColorKey(layer: string): string
{
    return `map-color-${layer}`;
}
export function mapShowKey(layer: string):  string
{
    return `map-show-${layer}`;
}

//The stored custom colour for a layer ('' when unset): a ui_color token or a raw #hex / rgb(), resolved to a
//paintable colour by the engine.
export function mapLayerColor(config: HeliosConfig | undefined, layer: string): string
{
    const v = (config as Record<string, unknown> | undefined)?.[mapColorKey(layer)];
    return typeof v === 'string' ? v.trim() : '';
}

//Whether a layer is drawn (custom mode only). Default true.
export function mapLayerVisible(config: HeliosConfig | undefined, layer: string): boolean
{
    return (config as Record<string, unknown> | undefined)?.[mapShowKey(layer)] !== false;
}


//Resolve the global display radius (m), clamped to [MIN,MAX], defaulting on invalid. Single source so
//lowering it shrinks buildings and shadows in lockstep.
export function displayRadiusM(config: HeliosConfig | undefined): number
{
    return resolveClampedInt(config, 'display-radius', DEFAULT_DISPLAY_RADIUS_M, MIN_DISPLAY_RADIUS_M, MAX_DISPLAY_RADIUS_M);
}


//Resolve how many nearest buildings to keep from `building-count`, clamped [MIN,MAX], defaulting on invalid.
export function buildingCount(config: HeliosConfig | undefined): number
{
    return resolveClampedInt(config, 'building-count', DEFAULT_BUILDING_COUNT, MIN_BUILDING_COUNT, MAX_BUILDING_COUNT);
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
    return resolveClampedInt(config, 'building-height', FIXED_BUILDING_HEIGHT_M, MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M);
}
