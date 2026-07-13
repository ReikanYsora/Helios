import { css, unsafeCSS } from 'lit';
import { GROUND_FADE_START } from '../scene/tiles';
import { HOME_GROW_MS } from '../core/config/constants';

//Visual styles for HeliosCard, grouped by feature (layout, overlays, solar arc, home cluster).
export const heliosCardStyles = css`
    :host
    {
        display: block;
        height:  100%;
        /*  Shared chip/surface drop shadow, so every floating pill and themed plate reads at the same depth. */
        --helios-shadow-chip: 0 1px 3px var(--shadow-color);
    }

    ha-card
    {
        position: relative;
        overflow: hidden;
        /*  Background follows the HA theme; the basemap disc fades into it at its edges. */
        background: var(--ha-card-background, var(--card-background-color, #fff));
        /*  Clip the backdrop to the padding box so it stops inside the border instead of painting a
            corner outside HA's frame. */
        background-clip: padding-box;
        /*  Container-query host so the kiosk breakpoint reacts to the card's own width, not the viewport
            (which would mis-fire with several cards side by side). See issue #33. */
        container-type: inline-size;
        container-name: helios-card;
        /*  border-radius stays because overflow:hidden clips the full-bleed map to it. */
        border-radius: var(--ha-card-border-radius, 12px);
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
        height:     100%;
        width:      100%;
        /*  Floor for layouts that give no explicit height (vertical-stack, panel, some grids): without it
            height:100% collapses to the children's intrinsic height and the map area vanishes. 480 px
            gives the map ~330 px; layouts passing a height override this. */
        min-height: 480px;
        /*  Stacking context so absolute z-index children stay scoped to the card and don't escape above
            HA chrome on scroll. */
        isolation: isolate;
    }

    #map-container
    {
        /*  Absolute + inset so the container fills the ha-card via containing-block dimensions (which
            respect min-height); a percentage height collapses to 0 under Masonry. Hosts the renderer's
            ground holder + scene SVG. overflow:hidden clips the tilted basemap canvas (which extends past
            the frame at low pitch). No CSS perspective property here: the ground carries its own perspective() in
            its transform (see SceneCamera.groundTransform), so it projects EXACTLY like the overlays' project3, and
            the flat scene SVG stays out of any 3D context (fixes the buildings-vs-basemap drift + the A9X iPad
            half-render, #304). */
        position: absolute;
        /*  Bleed 1 px under the border (re-clipped by overflow:hidden) to cover the anti-alias seam at
            the rounded corners. */
        inset: -1px;
        overflow: hidden;
        /*  z-index 1 keeps the container (and home prism) above the ground guide layer (z 0) yet below every
            HUD overlay (z 4+). */
        z-index: 1;
    }

    /*  Ground holder: tilted basemap canvas + edge fade, driven by a CSS 3D transform (rotateX = pitch,
        rotateZ = bearing) written each frame. preserve-3d keeps the canvas in the parent's perspective
        space. */
    .scene-ground-holder
    {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        pointer-events: none;
    }
    /*  Basemap tile canvas. Positioned by the renderer's transform-origin + transform; sized in JS to the
        stitched tile grid. One light style is fetched for both themes. */
    .ground
    {
        position: absolute;
        top: 0;
        left: 0;
    }
    /*  Dark theme tints the light basemap to a dark map purely in CSS: invert + hue-rotate keep it
        legible, brightness + low saturation keep it calm under the HUD. */
    ha-card.theme-dark .ground
    {
        filter: invert(0.9) hue-rotate(170deg) brightness(1.3) contrast(1) saturate(0.4);
    }
    /*  Edge fade: same size + transform as the ground, a radial gradient transparent out to
        GROUND_FADE_START (90%) then dissolving to the card background, turning the square tile grid into a
        soft disc. */
    .ground-fade
    {
        position: absolute;
        top: 0;
        left: 0;
        will-change: transform;
        pointer-events: none;
        background: radial-gradient(
            circle closest-side at 50% 50%,
            transparent 0%,
            transparent ${unsafeCSS(GROUND_FADE_START)}%,
            var(--ha-card-background, var(--card-background-color, #fff)) 100%
        );
    }
    /*  Screen-space scene SVG: night-shade + cast shadows + extruded buildings repainted every frame.
        Full-size overlay above the ground, click-transparent (the HUD SVGs own their pointer events). */
    .scene-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
    }
    /*  Camera-locked cursor: default cursor when rotation is disabled, so the scene doesn't advertise an
        interaction that doesn't exist. */
    ha-card.camera-locked #map-container
    {
        cursor: default !important;
    }


    /*  ============================================================
        HUD chips: ONE shared box recipe for every floating pill so they
        match in height, width, padding and font. Only the distinct bits
        (border-colour, z-index, pointer behaviour, active-glow, per-chip
        states) live in the per-chip rules below; don't re-declare the box
        geometry per chip.
        ============================================================ */
    .pv-pct-label,
    .battery-pct-label,
    .grid-label,
    .group-label,
    .solar-pct-label,
    .home-pill
    {
        position: absolute;
        transform: translate(-50%, -50%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        box-sizing: border-box;
        /*  Fixed width so every chip is identical; content centres within it. */
        width: 96px;
        padding: 3px 10px;
        border: 2px solid;
        border-radius: 999px;
        background: var(--card-background-color, #ffffff);
        background-clip: padding-box;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        box-shadow: var(--helios-shadow-chip);
        /*  Chips land at fractional pixels (50% anchor + -50% translate), so geometric precision +
            antialiased smoothing keeps the glyphs sharp. */
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }

    /*  PV production chip: pill tinted in the production colour (--pv-leader-color, set inline). Shares the
        fixed width so the leader gap stays identical however wide the value reads. */
    .pv-pct-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
    }

    /*  Shared icon recipe for the value chips (PV / battery / grid / cloud / sun). The home pill's icon is
        coloured differently, so it keeps its own rule below. */
    .pv-pct-label ha-icon,
    .battery-pct-label ha-icon,
    .grid-label ha-icon,
    .group-label ha-icon,
    .solar-pct-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    /*  Re-targetable chips: clicking one points the bottom chart at that metric. Base chips are
        display-only; [role="button"] re-enables events and out-specifies the base rule. */
    .pv-pct-label[role="button"],
    .battery-pct-label[role="button"],
    .grid-label[role="button"],
    .group-label[role="button"],
    .solar-pct-label[role="button"]
    {
        pointer-events: auto;
        cursor: pointer;
    }
    /*  Active-target glow. It lives on a ::after pseudo so it can FADE via opacity: box-shadow doesn't
        transition reliably between transparent and color-mix on WebKit, but opacity always does. --chip-glow
        carries each chip's metric colour; the pseudo holds the blurred halo, opacity 0 at rest, 1 while active. */
    .pv-pct-label      { --chip-glow: var(--pv-leader-color, var(--energy-solar-color, #ff9800)); }
    .battery-pct-label { --chip-glow: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac)); }
    .grid-label        { --chip-glow: var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2)); }
    .group-label       { --chip-glow: var(--group-color, var(--primary-color, #03a9f4)); }
    .solar-pct-label   { --chip-glow: var(--solar-color, var(--amber-color, #ffc107)); }
    .home-pill         { --chip-glow: var(--helios-consumption-color, #4caf50); }

    .pv-pct-label::after,
    .battery-pct-label::after,
    .grid-label::after,
    .group-label::after,
    .solar-pct-label::after,
    .home-pill::after
    {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        box-shadow: 0 0 12px 1px color-mix(in srgb, var(--chip-glow, transparent) 90%, transparent);
        opacity: 0;
        /*  Fade synced to the home prism's grow animation (HOME_GROW_MS) so the chip's glow and the house
            settle together on a selection. */
        transition: opacity ${unsafeCSS(HOME_GROW_MS)}ms ease;
    }
    .pv-pct-label.is-chart-active::after,
    .battery-pct-label.is-chart-active::after,
    .grid-label.is-chart-active::after,
    .group-label.is-chart-active::after,
    .solar-pct-label.is-chart-active::after,
    .home-pill.is-chart-active::after
    {
        opacity: 1;
    }

    /*  ============================================================
        Per-chip detail panel (scene mode). Double-tapping the active
        chip opens this compact, vertical readout top-right, tinted in
        the selection colour (--detail-accent, set inline). Icons only,
        values in the card's configured unit. Kept narrow so it never
        crowds a small card.
        ============================================================ */
    .detail-panel
    {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 40;
        display: flex;
        flex-direction: column;
        gap: 2px;
        box-sizing: border-box;
        /*  Fixed width: the panel never reflows with content; long device friendly names ellipsise instead. */
        width: 160px;
        padding: 6px 10px;
        border: 2px solid var(--detail-accent, var(--primary-color, #03a9f4));
        border-radius: var(--ha-card-border-radius, 12px);
        background: var(--card-background-color, #ffffff);
        background-clip: padding-box;
        box-shadow: var(--helios-shadow-chip);
        color: var(--primary-text-color, #212121);
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        pointer-events: none;
        -webkit-font-smoothing: antialiased;
    }
    .detail-panel .dp-row
    {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }
    .detail-panel .dp-row ha-icon
    {
        --mdc-icon-size: 16px;
        flex: 0 0 auto;
        color: var(--detail-accent, var(--primary-color, #03a9f4));
    }
    .detail-panel .dp-row span
    {
        flex: 1 1 auto;
        text-align: right;
    }
    /*  Per-device group rows: a left-aligned name (ellipsised) then the right-aligned total. */
    .detail-panel .dp-row-device .dp-label
    {
        flex: 1 1 auto;
        /*  min-width:0 lets a flex child shrink below its content so the ellipsis actually engages. */
        min-width: 0;
        text-align: left;
        /*  Regular weight (the panel is 600 by default): the name is a label, the value stays the emphasis. */
        font-weight: 400;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .detail-panel .dp-row-device .dp-value
    {
        flex: 0 0 auto;
        text-align: right;
        margin-left: 10px;
    }

    /*  Predicted PV chip when scrubbing into the future: the value is modelled, not measured, so the
        chip dims and a leading "~" (set by render) signals "estimate". */
    .pv-pct-label.is-predicted
    {
        opacity: 0.55;
        font-style: italic;
    }

    /*  Battery SoC and Power chips, same compact pill recipe as the PV chip. */
    .battery-pct-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
    }

    /*  Grid chip, same pill recipe. Shows the active flow only; border follows the inline
        --grid-leader-color (blue importing, purple exporting), icon + value flip with it. */
    .grid-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2));
    }
    /*  Monitoring-group chip, same pill recipe; border in the group's colour. A small numbered disc carries the
        group id, placed on the chip's OUTER corner (away from the home) so it never sits over the lead's bead. */
    .group-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--group-color, var(--primary-color, #03a9f4));
    }
    /*  Group pastille glyph shown when the group has no configured icon: its number, sized + weighted like the
        chip icon it stands in for (the chip border already carries the group colour). */
    .group-label .group-glyph-num
    {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: inherit;
    }
    /*  Full-size overlay SVGs for the home-cluster leaders (grid, PV to home, battery, groups); each hosts
        its own coloured path(s) below. */
    .grid-leader-svg,
    .pv-home-leader-svg,
    .battery-leader-svg,
    .group-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    /*  Group leader: a thin static line from the home pill down to the group chip, in the group's colour. */
    .group-leader-line
    {
        stroke-width: 2;
        stroke-linecap: round;
        fill: none;
    }
    /*  Grid leader; stroke + bead fill from the inline colour, so one path serves both import
        (blue) and export (purple). */
    .grid-leader-line
    {
        stroke-width: 2;
        stroke-linecap: round;
        fill: none;
    }

    /*  PV to home leader: vertical dashed line from the PV chip down to the home, in the PV colour. z 5,
        below the chip cluster so the dashes pass behind the chips. */
    .pv-home-leader-line
    {
        stroke: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
        stroke-width: 2;
        stroke-opacity: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  Moving bead riding a leader at a speed proportional to live flow, like HA's energy-distribution
        card. Shared by the PV to home, battery, monitoring-group and sun to PV ray beads. */
    .pv-home-leader-bead,
    .battery-leader-bead,
    .group-leader-bead,
    .solar-svg .solar-ray-bead
    {
        opacity: 0.95;
        stroke: var(--primary-text-color, #212121);
        stroke-width: 1;
        paint-order: stroke fill;
    }



    /*  Battery leaders. SoC and power leaders share a solid L-shaped path with a rounded bend. The power
        leader carries a bead at a speed proportional to |P|, its path flipped inline when discharging so
        travel matches the flow. The SoC leader is static: SoC is a level, not a flow. */
    .battery-leader-line
    {
        stroke: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
        stroke-width: 2;
        stroke-opacity: 1;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
    }

    /*  Solar overlay split in two passes so chips never occlude the live sun while the night part still
        reads as background: .solar-svg-back paints below-horizon dots below the chips (z 4),
        .solar-svg-front paints the above-horizon arc + ray + sun disc above them (z 7). */
    .solar-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        /* Daylight fade via the --solar-daylight variable (0..1, set inline). */
        opacity: var(--solar-daylight, 1);
        transition: opacity 600ms ease-out;
    }
    /*  Central home pill at the projected home centre. Every chip leader docks against its border so
        the home reads as the single energy hub, like HA's Energy distribution card. */
    .home-pill
    {
        z-index: 9;
        flex-direction: row;
        justify-content: center;
        /*  Home == consumption: matches the consumption green used by its chart. */
        color: var(--helios-consumption-color, #4caf50);
        border-color: var(--helios-consumption-color, #4caf50);
        /*  Clickable: the home is the consumption chip, retargeting the bottom chart to home usage. */
        pointer-events: auto;
        cursor: pointer;
        /*  Keep the mask fade and ease the hover glow in/out. */
        transition: opacity 0.35s ease, box-shadow 0.2s ease;
    }
    /*  Neutral home ring: shown in place of the home pill when the home chip is hidden. A hollow stadium (same 2 px
        border as the chips) with a transparent centre so the 2.5D home shows through it. Its height matches the
        leads' vertical dock (2 x HOME_PILL_HALF_HEIGHT_PX = 28 in scene-hud-controller) so every leader still meets
        its top/bottom edge; the width is kept compact. Purely a contact point; non-interactive. */
    .home-ring
    {
        position: absolute;
        transform: translate(-50%, -50%);
        box-sizing: border-box;
        width: 50px;
        height: 28px;
        border: 2px solid var(--home-ring-color, var(--primary-color, #4caf50));
        border-radius: 999px;
        background: transparent;
        z-index: 9;
        pointer-events: none;
    }
    /*  Light glow on home hover; the hover state is driven from the hitbox by the card. Active consumption target
        uses the shared ::after glow like every other chip (fades via opacity). */
    .home-pill.is-hovered
    {
        box-shadow: var(--helios-shadow-chip),
                    0 0 7px 1px color-mix(in srgb, var(--helios-consumption-color, #4caf50) 28%, transparent);
    }
    .home-pill ha-icon
    {
        --mdc-icon-size: 16px;
        /*  Home glyph in the text ink, not the blue pill border colour. */
        color: var(--primary-text-color, #212121);
        display: inline-flex;
        align-items: center;
    }
    /*  Live home-consumption value; inherits the shared chip font so it matches the other chips' text. */
    .home-pill-usage
    {
        color: var(--primary-text-color, #212121);
    }

    .solar-svg-back        { z-index: 4; }
    /*  Above-horizon arc and sun disc in two depth passes around the home cluster: far half (z 5) behind
        the chips/pill (passes behind the home), near half (arc z 11, disc z 12) over the top. W/m² chip
        (z 13) paints last. */
    .solar-svg-front-far  { z-index: 5; }
    .solar-svg-front-near { z-index: 11; }
    .solar-svg-sun-far    { z-index: 5;  }
    .solar-svg-sun-near   { z-index: 12; }
    /*  Sun to PV ray + bead on their own SVG below the chips (z 8) so the chip background occludes the ray
        endpoint at the chip border. */
    .solar-ray-svg        { z-index: 7;  }

    /*  Arc: first pass a dark outline for legibility on light basemaps, second pass the sun colour on top.
        Stroke widths set inline per segment. */
    .solar-svg .solar-arc-outline { stroke: rgba(0, 0, 0, 0.35); stroke-linecap: round; }
    .solar-svg .solar-arc-segment { stroke-linecap: round; }

    /*  Below-horizon segments as round dots (dasharray "0 N" + round linecap = true circles) so the
        underground leg reads without colour cues; stroke alpha halved vs the day arc so it recedes. */
    .solar-svg .solar-arc-night
    {
        stroke-linecap: round;
        stroke-dasharray: 0 8;
        stroke-opacity: 0.45;
    }
    .solar-svg .solar-arc-night.solar-arc-outline
    {
        stroke-opacity: 0.25;
    }

    /*  Incidence ray: dashes flow sun to home at a speed proportional to live irradiance. 2 px, matching
        the home cluster's leaders. A soft amber glow gives the beam more presence; it feathers with
        daylight (--solar-daylight, set on the svg) so it fades to nothing at dusk. */
    .solar-svg .solar-ray
    {
        stroke-width: 2;
        stroke-dasharray: 5 5;
        stroke-opacity: 0.55;
        stroke-linecap: round;
        /*  Two-stop amber halo (tight bright core + wide soft bloom) so the thin dashed beam actually glows.
            No daylight factor here: the parent .solar-svg already fades the whole layer by --solar-daylight,
            so folding it in again would attenuate the glow twice (daylight²) and wash it out. */
        filter:
            drop-shadow(0 0 3px rgba(255, 193, 7, 0.95))
            drop-shadow(0 0 9px rgba(255, 193, 7, 0.7));
        animation: solar-ray-flow var(--sun-flow-duration, 30s) linear infinite;
    }

    @keyframes solar-ray-flow
    {
        from { stroke-dashoffset: 0;  }
        to   { stroke-dashoffset: -10; }
    }

    /*  Sunrise / sunset marker: glyph + local time pinned just outside the arc at the horizon crossing,
        centred on its computed point. Sun-coloured, click-transparent. */
    .sun-cross-marker
    {
        position: absolute;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        color: var(--sun-cross-color, #ffc107);
        pointer-events: none;
        /*  Same layer as the far arc (z 5) it sits on, so the value chips (z 8) stay on top. */
        z-index: 5;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    }
    .sun-cross-marker ha-icon
    {
        --mdc-icon-size: 18px;
        width: 18px;
        height: 18px;
    }
    .sun-cross-marker span
    {
        font-size: var(--ha-font-size-xs, 11px);
        font-weight: var(--ha-font-weight-medium, 500);
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }

    /*  Solar irradiance label pinned above the live sun. Anchors above the sun via a -100% vertical
        translate (not the shared -50%) and sits higher in the stack. */
    .solar-pct-label
    {
        transform: translate(-50%, -100%);
        pointer-events: none;
        /*  Above the arc-front lines (z 11) so a segment never crosses the W/m² readout; the sun disc
            (z 12) still paints on top. */
        z-index: 13;
        color: var(--primary-text-color, #212121);
        /*  Configured irradiance colour (--solar-color, set inline), else the HA amber token so it stays distinct
            from the PV production chip (orange). */
        border-color: var(--solar-color, var(--amber-color, var(--warning-color, #ffc107)));
    }


    /*  ============================================================
        Dark theme, opt-in via \`card-theme: dark\`. Affects only the chrome
        (chips, charts, cursors, labels, leaders, tooltips); the basemap
        keeps its own colours. Chip plates flip white to near-black, text/
        borders go light-grey, chart hairlines flip to white-on-dark at the
        same opacities. User-coloured fills, the scrub blue and the live
        tooltip plate already read on dark, so they're left alone.
        ============================================================ */

    /*  Solar arc outline: the light skin paints a black halo for legibility on bright basemaps; in dark
        mode that would vanish into the map, so paint a faint white halo instead. */
    ha-card.theme-dark .solar-svg .solar-arc-outline
    {
        stroke: rgba(255, 255, 255, 0.45);
    }


    /*  Animation perf hooks:
        1. .helios-paused (set by the card's IntersectionObserver when scrolled off-screen) pauses every
           CSS animation; SMIL <animateMotion> is paused in parallel via svg.pauseAnimations().
        2. prefers-reduced-motion disables every animation + transition at the OS level. */
    :host(.helios-paused) *,
    :host(.helios-paused) *::before,
    :host(.helios-paused) *::after
    {
        animation-play-state: paused !important;
    }

    @media (prefers-reduced-motion: reduce)
    {
        *, *::before, *::after
        {
            animation-duration:         0ms !important;
            animation-iteration-count:  1   !important;
            transition-duration:        0ms !important;
        }
    }

    /* "No UI" mode: the timeline + on-card controls fade out after an idle delay and reappear on any input
       (driven by the data-ui-hidden host attribute; see _uiHidden / noUiDelayMs). The reduced-motion block
       above drops the fade to an instant show/hide. */
    .time-bar,
    .tb-band
    {
        transition: opacity 1000ms ease;
    }
    :host([data-ui-hidden]) .time-bar,
    :host([data-ui-hidden]) .tb-band
    {
        opacity: 0;
        pointer-events: none;
    }



`;
