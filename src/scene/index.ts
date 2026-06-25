//Public surface of the card-agnostic 2.5D scene renderer. Import from here.
export { SceneRenderer } from './renderer';
export type { SceneRendererOptions, ScenePaletteFull } from './renderer';
export { SceneCamera, PITCH_MIN, PITCH_MAX, DEFAULT_BEARING, DEFAULT_TILT } from './projection';
export type { ProjectedPoint } from './projection';
export { renderSky, renderNightShade } from './sky';
export type { SunSample, SkyResult } from './sky';
export { renderBuildings, renderShadows } from './buildings';
export type { Building, ScenePalette } from './buildings';
export {
    pxPerMetreFor, buildGround, GROUND_ZOOM, GROUND_RADIUS, TILE_PX,
} from './tiles';
export type { Ground } from './tiles';
export {
    type Point, lonLatToTile, metresPerDegree, ringToLocalMetres,
    pointInPolygon, distanceToHome, signedArea, simplifyFootprint, convexHull, pointsAttr,
} from './geo';
export {
    mixHex, hexByte, lerp, nightShade, buildingColor, tintedRgba, arcColor,
} from './colors';
