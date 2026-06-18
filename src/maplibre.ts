//Single shared maplibre-gl instance for every maplibre-gl card on the page.
//
//Multiple maplibre-gl Lovelace cards can share a page, each bundling its own copy. Two live copies
//fight over MapLibre's worker class registry (worker-transferred objects are looked up by
//`constructor._classRegistryKey`), so the second map's worker-fed layers (3D buildings especially)
//never load and MapLibre throws "undefined is not an object (evaluating '..._classRegistryKey')".
//
//Fix: keep only ONE copy active. The first card to evaluate this module publishes its maplibre-gl on
//a global; every other card reuses it, so one worker and one registry serve all. The remaining
//bundled copies stay loaded but unused (no Map created from them, so no worker spawned).
//
//Only works while every card bundles the SAME major maplibre-gl version (all track 5.x). The global
//key is brand-generic on purpose.
import bundled from 'maplibre-gl';

type MaplibreModule = typeof bundled;

const shared = globalThis as typeof globalThis & { __heliosMaplibreGL?: MaplibreModule };
const maplibregl: MaplibreModule = (shared.__heliosMaplibreGL ??= bundled);

export default maplibregl;
