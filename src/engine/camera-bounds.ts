//Camera pitch bounds — single source of truth for the MapLibre constructor (min/maxPitch), the
//drag-rotate handler, the editor's setCameraPitch, the initial-pose clamp (localStorage pose +
//camera-pitch-deg YAML override) and the detail-mode dive target, so no pose source can bypass the
//floor. MIN = mostly top-down, MAX = nearly horizontal, REST = hemisphere-aware default.
//
//Its own module so helios-engine.ts and detail-mode.ts can share the constants without a circular
//import (detail-mode lives under src/engine/ and is imported by the engine).

export const CAMERA_PITCH_MIN_DEG  = 15;
export const CAMERA_PITCH_MAX_DEG  = 55;
export const CAMERA_PITCH_REST_DEG = 50;
