import { css } from 'lit';

//Styles for the local-LiDAR view mode. It reuses the full scene (basemap + building/home shadows + prisms)
//and keeps the timeline + period band + the top-left mode rail; only the HUD (chips, leaders, sun, sun-arc,
//cloud) is hidden. The nDSM surface is drawn as a wireframe on top, inside the scene SVG layer (no extra
//element). Same selective-hide approach as clock mode.
export const heliosCardLidarCss = css`
    /*  Keep the scene, timeline, period band and the top-left rail; fade out every other direct child of the
        card (the HUD layers) so only those controls float over the scene + wireframe. */
    ha-card.mode-lidar > :not(#map-container):not(.overlay-top-left):not(.time-bar):not(.tb-band)
    {
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--ha-animation-duration-slow, 350ms) ease;
    }
`;
