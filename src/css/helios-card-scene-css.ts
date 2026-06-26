import { css, unsafeCSS } from 'lit';
import { GROUND_FADE_START } from '../engine/tiles';

//Visual styles for HeliosCard. Grouped by feature (layout, timeline,
//overlays, solar arc, tooltips).
export const heliosCardStyles = css`
    :host
    {
        display: block;
        height:  100%;
    }

    ha-card
    {
        position: relative;
        overflow: hidden;
        /*  Card background follows the HA theme (the basemap disc fades into it at its edges), so the card
            reads as a first-party tile rather than a black box. */
        background: var(--ha-card-background, var(--card-background-color, #fff));
        /*  Clip the backdrop to the padding box so it stops inside the <ha-card> border instead of bleeding
            under it and painting a corner that breaks HA's subtle frame. */
        background-clip: padding-box;
        /*  Container-query host so the kiosk breakpoint at the bottom reacts to the card's own width,
            not the viewport (which would mis-fire with several cards side by side). See issue #33. */
        container-type: inline-size;
        container-name: helios-card;
        /*  Border + shadow come from <ha-card>'s own --ha-card-* tokens; border-radius stays because
            overflow:hidden clips the full-bleed map to it. */
        border-radius: var(--ha-card-border-radius, 12px);
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
        height:     100%;
        width:      100%;
        /*  Floor for layouts where the parent gives no explicit height (vertical-stack, panel, some
            grids): without it height:100% collapses to the children's intrinsic height and the 3D map
            area vanishes. 480 px gives the map ~330 px. Layouts that pass a height override this. */
        min-height: 480px;
        /*  Stacking context so absolute z-index children stay scoped to the card and don't escape
            above HA chrome on scroll. */
        isolation: isolate;
    }

    #map-container
    {
        /*  Absolute + inset so the container fills the ha-card via containing-block dimensions (which
            respect min-height). A percentage height would collapse to 0 under Masonry (min-height-only
            floor); absolute works under every layout. Hosts the 2.5D renderer's ground holder + scene SVG.
            overflow:hidden clips the tilted basemap canvas (which extends past the frame at low pitch) to
            the card; perspective gives the rotateX/rotateZ ground transform its vanishing point. */
        position: absolute;
        /*  Bleed 1 px under the border (re-clipped by the card's overflow:hidden) to cover the
            anti-alias seam where the black backdrop would peek at the rounded corners. */
        inset: -1px;
        overflow: hidden;
        perspective: 1200px;
    }

    /*  Renderer ground holder: the tilted basemap tile canvas + edge fade, driven by a CSS 3D transform
        (rotateX = pitch, rotateZ = bearing) the renderer writes each frame. preserve-3d keeps the canvas
        in the parent's perspective space. */
    .scene-ground-holder
    {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        pointer-events: none;
    }
    /*  Basemap tile canvas (CARTO tiles). Positioned by the renderer's transform-origin + transform;
        sized in JS to the stitched tile grid. */
    .ground
    {
        position: absolute;
        top: 0;
        left: 0;
    }
    /*  Edge fade: same size + transform as the ground, a radial gradient that's transparent out to 90%
        (GROUND_FADE_START) then dissolves to the themed card background, turning the square tile grid into
        a soft disc that melts into the card. */
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
    /*  Screen-space scene SVG: the renderer repaints night-shade + cast shadows + extruded buildings into
        it every frame. Full-size overlay above the ground, click-transparent (the HUD SVGs above own
        their own pointer events). */
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
        HUD chips: ONE shared box recipe for all six floating pills so they
        render at identical height, min-width, padding and font. Only the
        DISTINCT bits (border-colour, z-index, colour, pointer behaviour,
        active-glow, ha-icon, per-chip states) live in the per-chip rules
        below. Do not re-declare the box geometry per chip.
        ============================================================ */
    .pv-pct-label,
    .battery-pct-label,
    .grid-label,
    .solar-pct-label,
    .cloud-chip,
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
        box-shadow: 0 1px 3px var(--shadow-color);
    }

    /*  Crisp-text: the chips land at fractional pixels (50% anchor + -50% translate), so geometric
        precision + antialiased smoothing keeps the glyphs sharp. */
    .pv-pct-label,
    .battery-pct-label,
    .grid-label,
    .solar-pct-label,
    .cloud-chip,
    .home-pill
    {
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }

    /*  Camera-lock toggle, top-left. 40 px circle; brand-blue pastille appears when locked. */
    .overlay-btn
    {
        appearance: none;
        -webkit-appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width:  40px;
        height: 40px;
        box-sizing: border-box;
        padding: 0;
        background-color: transparent;
        background-clip: padding-box;
        color: var(--primary-text-color, #212121);
        border: 0;
        outline: 0 !important;
        outline-offset: 0;
        border-radius: 50%;
        overflow: hidden;
        cursor: pointer;
        pointer-events: auto;
        position: relative;
        z-index: 50;
        opacity: 1;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 0.15s, color 0.15s;
    }
    .overlay-btn:hover,
    .overlay-btn:focus,
    .overlay-btn:focus-visible,
    .overlay-btn:active
    {
        outline: 0 !important;
        box-shadow: none !important;
    }
    .overlay-btn ha-icon
    {
        --mdc-icon-size: 22px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        pointer-events: none;
    }
    .overlay-btn:hover  { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08); }
    .overlay-btn:active { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.16); }
    .overlay-btn.is-on
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-on-primary-color, #ffffff);
    }
    .overlay-btn.is-on:hover  { background: var(--dark-primary-color, #0288d1); }
    .overlay-btn.is-on:active { background: var(--darker-primary-color, #01579b); }
    /*  Disabled state: button stays visible to show the lock state but is inert,
        greyed out with no hover/active feedback. */
    .overlay-btn.is-disabled,
    .overlay-btn[disabled]
    {
        opacity: 0.45;
        cursor: default;
        pointer-events: none;
    }

    /*  View mode. Clock fades every layer but the basemap (and the top-left controls); Scene restores them.
        The basemap (.scene-ground-holder) lives inside #map-container alongside .scene-svg, so the scene SVG
        is faded by name while the map container itself (and the holder) stay. */
    ha-card > :not(#map-container):not(.overlay-top-left):not(.time-bar),
    ha-card .scene-svg
    {
        transition: opacity var(--ha-animation-duration-slow, 350ms) ease;
    }
    ha-card.mode-clock > :not(#map-container):not(.overlay-top-left):not(.time-bar),
    ha-card.mode-clock .scene-svg
    {
        opacity: 0;
        pointer-events: none;
    }

    /*  Top-left rail hosting the mode toggles + camera-lock. pointer-events off on
        the rail; the buttons opt back in so they don't steal map interactions. */
    .overlay-top-left
    {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 60;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        pointer-events: none;
    }
    /*  PV production chip: compact horizontal pill tinted in the production colour (--pv-leader-color,
        set inline). Fixed min-width shared with the battery chips so the leader gap is identical
        regardless of how wide the value reads. */
    .pv-pct-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
    }

    /*  Shared icon recipe for the five value chips (PV / battery / grid / cloud / sun). The home
        pill's icon is coloured differently, so it keeps its own rule below. */
    .pv-pct-label ha-icon,
    .battery-pct-label ha-icon,
    .grid-label ha-icon,
    .cloud-chip ha-icon,
    .solar-pct-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    /*  Re-targetable chips: clicking one points the bottom chart at that metric. Base chips are
        display-only; the [role="button"] selector re-enables events and out-specifies the base rule. */
    .pv-pct-label[role="button"],
    .battery-pct-label[role="button"],
    .grid-label[role="button"],
    .solar-pct-label[role="button"]
    {
        pointer-events: auto;
        cursor: pointer;
    }
    /*  Active target: a soft halo in the chip's own metric colour so the chip-to-chart coupling reads
        at a glance. */
    .pv-pct-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--pv-leader-color, var(--energy-solar-color, #ff9800)) 70%, transparent);
    }
    .battery-pct-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac)) 70%, transparent);
    }
    .grid-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2)) 70%, transparent);
    }
    .solar-pct-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--helios-sun-color, var(--amber-color, #ffc107)) 70%, transparent);
    }

    /*  Predicted PV chip when scrubbing into the future: the value is modelled, not measured, so the
        chip dims and a leading "≈" (set by render) signals "estimate". */
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

    /*  Grid chip, same pill recipe as the PV/battery chips. Shows the active flow only; the border
        follows the inline --grid-leader-color (blue importing, purple exporting), icon + value flip
        with it. */
    .grid-label
    {
        z-index: 8;
        justify-content: center;
        pointer-events: none;
        color:        var(--primary-text-color, #212121);
        border-color: var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2));
    }
    /*  Full-size overlay SVGs for the home-cluster leaders (grid, PV→home, battery). Identical box;
        each hosts its own coloured path(s) defined below. */
    .grid-leader-svg,
    .pv-home-leader-svg,
    .battery-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    /*  Single grid leader; stroke + bead fill from the inline --grid-leader-color, so one path serves
        both import (blue) and export (purple). */
    .grid-leader-line
    {
        stroke-width: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  PV → home leader: vertical dashed line from the PV chip down to the home, in the PV colour.
        z 5, below the chip cluster (z 6) so the dashes pass behind the chips. */
    .pv-home-leader-line
    {
        stroke: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
        stroke-width: 1;
        stroke-opacity: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  Moving bead riding a leader at a speed proportional to live flow, like HA's energy-distribution
        card. Shared by the PV→home, battery and sun→PV ray beads (identical recipe). */
    .pv-home-leader-bead,
    .battery-leader-bead,
    .solar-svg .solar-ray-bead
    {
        opacity: 0.95;
        stroke: var(--card-background-color, #ffffff);
        stroke-width: 1;
        stroke-opacity: 0.85;
        paint-order: stroke fill;
    }
    ha-card.theme-dark .pv-home-leader-bead,
    ha-card.theme-dark .battery-leader-bead,
    ha-card.theme-dark .solar-svg .solar-ray-bead
    {
        stroke: var(--card-background-color, #191a1b);
        stroke-opacity: 0.95;
    }



    /*  Battery leaders. SoC↔PV and PV↔Power share a solid L-shaped path with a rounded bend. The
        PV↔Power leader carries a bead at a speed proportional to |P|, its path flipped inline when
        discharging so travel matches the flow. The SoC leader is static: SoC is a level, not a flow. */
    .battery-leader-line
    {
        stroke: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
        stroke-width: 1;
        stroke-opacity: 1;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
    }

    /*  Solar overlay split into two passes so chips never occlude the live sun while the night part
        still reads as background: .solar-svg-back paints the below-horizon dots below the chip cluster
        (z 4); .solar-svg-front paints the above-horizon arc + ray + sun disc above the chips (z 7). */
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
        color: var(--primary-color, #03a9f4);
        border-color: var(--primary-color, #03a9f4);
        /*  Clickable: the home is the consumption chip, retargeting the bottom chart to home usage. */
        pointer-events: auto;
        cursor: pointer;
        /*  Keep the mask fade and ease the hover glow in/out. */
        transition: opacity 0.35s ease, box-shadow 0.2s ease;
    }
    /*  Light glow on home hover; the hover state is driven from the hitbox by the card. */
    .home-pill.is-hovered
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 7px 1px color-mix(in srgb, var(--primary-color, #03a9f4) 28%, transparent);
    }
    /*  Active consumption target: same retarget glow the other chips use, in the consumption blue. */
    .home-pill.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--energy-grid-consumption-color, #488fc2) 70%, transparent);
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
    /*  Above-horizon arc in two passes so depth drives the local z-order around the home cluster:
        front-far (z 5) is behind the chips/pill (arc disappears behind the home), front-near (z 11) is
        in front (arc comes over the top). Sun disc (z 12) + W/m² chip (z 13) paint last. */
    .solar-svg-front-far  { z-index: 5; }
    .solar-svg-front-near { z-index: 11; }
    /*  Sun disc inherits the arc's depth split: far half under chips + leaders (z 5, passes behind the
        home), near half over everything but the W/m² chip (z 12). */
    .solar-svg-sun-far    { z-index: 5;  }
    .solar-svg-sun-near   { z-index: 12; }
    /*  Sun → PV ray + bead on their own SVG below the chips (z 8) so the chip background occludes the
        ray endpoint at the chip border. The sun disc stays in the depth-split SVGs above. */
    .solar-ray-svg        { z-index: 7;  }

    /*  Arc: first pass a dark outline for legibility on light basemaps, second pass the sun colour on
        top. Stroke widths set inline per segment. */
    .solar-svg .solar-arc-outline { stroke: rgba(0, 0, 0, 0.35); stroke-linecap: round; }
    .solar-svg .solar-arc-segment { stroke-linecap: round; }

    /*  Below-horizon segments as round dots (dasharray "0 N" + round linecap = true circles
        everywhere) so the underground leg reads without colour cues. Stroke alpha halved vs the
        above-horizon arc so the dotted leg recedes as ambient context. */
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

    /*  Incidence ray: dashes flow sun → home at a speed proportional to live irradiance. 1 px hairline
        to match the home cluster's leaders. */
    .solar-svg .solar-ray
    {
        stroke-width: 1;
        stroke-dasharray: 5 5;
        stroke-opacity: 0.55;
        stroke-linecap: round;
        animation: solar-ray-flow var(--sun-flow-duration, 30s) linear infinite;
    }

    @keyframes solar-ray-flow
    {
        from { stroke-dashoffset: 0;  }
        to   { stroke-dashoffset: -10; }
    }

    /*  Cloud chip on the sun → home line: a grey pill showing live cover, clickable to re-target the
        chart to the cloud bands. Same recipe + active glow as the other chips. */
    /*  Cloud chip is the only chip with a custom width: it's just a short percentage, so it sizes to its
        content (no fixed width) and reads about half as wide as the others, saving space. */
    .cloud-chip
    {
        z-index: 11;
        width: auto;
        pointer-events: auto;
        cursor: pointer;
        color: var(--primary-text-color, #212121);
        border-color: var(--secondary-text-color, #727272);
    }
    .cloud-chip.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--secondary-text-color, #727272) 70%, transparent);
    }
    /*  Short cloud-coloured leader joining the irradiance chip to the cloud chip on its right. */
    .cloud-chip-leader
    {
        position: absolute;
        transform: translateY(-50%);
        width: 14px;
        height: 2px;
        background: var(--secondary-text-color, #727272);
        border-radius: 1px;
        pointer-events: none;
        z-index: 10;
    }

    /*  Sunrise / sunset marker: a small glyph + local time pinned just outside the arc at the horizon
        crossing, centred on its computed point. Sun-coloured, click-transparent. */
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

    /*  Solar irradiance label pinned above the live sun, same chip language as the cloud/PV chips.
        Distinct from the shared base: it anchors above the sun, so it uses a -100% vertical translate
        instead of the shared -50%, and sits higher in the stack. */
    .solar-pct-label
    {
        transform: translate(-50%, -100%);
        pointer-events: none;
        /*  Above the arc-front lines (z 11) so an arc segment never crosses the W/m² readout; the sun
            disc (z 12) still paints on top. */
        z-index: 13;
        color: var(--primary-text-color, #212121);
        /*  Sun chip uses the HA amber token so it stays distinct from the PV production chip (orange). */
        border-color: var(--helios-sun-color, var(--amber-color, var(--warning-color, #ffc107)));
    }


    /*  ============================================================
        Dark theme, opt-in via \`card-theme: dark\`. Affects only the chrome
        (chips, charts, cursors, labels, leaders, tooltips); the basemap
        keeps its own colours. Chip plates flip white → near-black, text/
        borders go light-grey, and chart hairlines flip to white-on-dark
        with the same opacity envelopes. User-coloured fills, the scrub
        blue and the live tooltip plate already read on dark, left alone.
        ============================================================ */

    /*  Solar arc outline: the light skin paints a black halo for legibility on bright basemaps; in
        dark mode that halo would vanish into the map, so paint a faint white halo instead. */
    ha-card.theme-dark .solar-svg .solar-arc-outline
    {
        stroke: rgba(255, 255, 255, 0.45);
    }


    /*  Animation perf hooks:
        1. .helios-paused (set by the card's IntersectionObserver when scrolled off-screen) pauses every
           CSS animation; SMIL <animateMotion> is paused in parallel via svg.pauseAnimations().
        2. prefers-reduced-motion disables every helios animation + transition at the OS level. */
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



`;
