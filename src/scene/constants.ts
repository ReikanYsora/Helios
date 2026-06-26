//Tunables for the self-contained 2.5D scene module. Kept separate from the card/engine constants.ts so
//scene/ stays a standalone, card-agnostic unit: nothing here depends on the card and nothing outside
//scene/ needs to reach in. Values are preserved exactly from where they used to live module-locally.

//=== Camera + projection ===
//Pitch bounds shared by the editor, drag-rotate and the initial-pose clamp. MIN = nearly top-down,
//MAX = nearly horizontal. Default pose faces the sun's side so it sits at the top of the frame at noon.
//NEAR_PLANE is the near-plane margin as a fraction of PERSPECTIVE (clamps/culls points at the camera);
//PERSPECTIVE is the projection + CSS depth in px shared by the ground transform and project3.
export const PITCH_MIN      = 5;
export const PITCH_MAX      = 65;
export const DEFAULT_BEARING = 180;
export const DEFAULT_TILT    = 50;
export const NEAR_PLANE      = 0.15;
export const PERSPECTIVE     = 1200;

//=== Basemap tiles ===
//Tile pixel size, ground-canvas radius/zoom, the edge-fade start (% of the closest side, consumed by the
//card CSS), and the WGS84 Earth circumference + metres-per-degree-latitude used for the local-metre math.
export const TILE_PX             = 256;
export const GROUND_RADIUS       = 3;
export const GROUND_ZOOM         = 18;
export const GROUND_FADE_START   = 90;
export const EARTH_CIRCUMFERENCE_M = 40075016.686;
export const METRES_PER_DEG_LAT  = 111_320;

//=== Renderer ===
//Camera aim point above the home (m), the dark-theme CSS filter that tints the light CARTO tiles, and the
//SVG namespace for the scene's screen-space overlay.
export const DEFAULT_TARGET_HEIGHT_M = 3;
export const DARK_FILTER = 'invert(0.9) hue-rotate(170deg) brightness(1.3) contrast(1) saturate(0.4)';
export const SVG_NS = 'http://www.w3.org/2000/svg';

//=== Shadows ===
//Shadows fade in near the horizon (full at SHADOW_FADE_DEG above it); a cast shadow is capped at MAX_SHADOW_M
//so a low sun doesn't streak a shadow across the whole disc.
export const SHADOW_FADE_DEG = 10;
export const MAX_SHADOW_M    = 50;

//=== Scene animation (ms / easing) ===
//Building-rise window (matches the HA energy graphs) and the home retarget squash/grow timings.
export const GROWTH_RISE_MS  = 500;
export const HOME_SQUASH_MS  = 220;
export const HOME_GROW_MS    = 300;

//=== Geo math ===
//Single shared degrees→radians factor for the whole scene module.
export const DEG = Math.PI / 180;
