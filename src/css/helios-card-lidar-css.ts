import { css } from 'lit';

//Styles for the local-LiDAR view mode. In this mode the whole scene is hidden and the local LiDAR is drawn
//as a wireframe instead (added later); for now only the top-left mode rail (mode toggles + lock) stays on
//screen. The wireframe layer, when it lands, opts back in with its own class.
export const heliosCardLidarCss = css`
    /*  Clock mode fades all but a few layers; LiDAR mode goes further and hides EVERYTHING (basemap + scene
        SVG + HUD + timeline) except the top-left rail, so only the controls float over the LiDAR wireframe. */
    ha-card.mode-lidar > :not(.overlay-top-left):not(.lidar-overlay)
    {
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--ha-animation-duration-slow, 350ms) ease;
    }
`;
