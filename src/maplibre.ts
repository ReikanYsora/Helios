//Single shared maplibre-gl instance for every maplibre-gl card on the page.
//
//More than one maplibre-gl based Lovelace card can sit on the same Home Assistant
//page, each bundling its own copy of maplibre-gl. Two live copies fight over
//MapLibre's worker class registry (every worker-transferred object is looked up by
//`constructor._classRegistryKey`), so the second map's worker-fed layers, the 3D
//buildings in particular, never load and MapLibre throws "undefined is not an
//object (evaluating '..._classRegistryKey')".
//
//Fix: keep only ONE copy active. The first card to evaluate this module publishes
//its maplibre-gl on a global; every other maplibre-gl card reuses it, so a single
//worker and a single registry serve them all. The remaining bundled copies stay
//loaded but unused (no Map is ever created from them, so they spawn no worker).
//
//This only works while every such card on the page bundles the SAME major
//maplibre-gl version (they all track 5.x). The global key is brand-generic on
//purpose.
import bundled from 'maplibre-gl';

type MaplibreModule = typeof bundled;

const shared = globalThis as typeof globalThis & { __heliosMaplibreGL?: MaplibreModule };
const maplibregl: MaplibreModule = (shared.__heliosMaplibreGL ??= bundled);

export default maplibregl;
