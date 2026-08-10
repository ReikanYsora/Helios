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
            (which would mis-fire with several cards side by side). */
        container-type: inline-size;
        container-name: helios-card;
        /*  border-radius stays because overflow:hidden clips the full-bleed map to it. */
        border-radius: var(--ha-card-border-radius, 12px);
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
        height:     100%;
        width:      100%;
        /*  Floor for layouts that give no explicit height (vertical-stack, panel, some grids): without it
            height:100% collapses to the children's intrinsic height and the map area vanishes. Kept in step
            with the 4-row grid minimum (~248 px) so the sections view can shrink the card that small; layouts
            passing a taller height override this, and going this small is the user's timeline compromise. */
        min-height: 240px;
        /*  Stacking context so absolute z-index children stay scoped to the card and don't escape above
            HA chrome on scroll. */
        isolation: isolate;
    }

    /*  Auto-height sizing. The map, HUD and timeline are all position:absolute, so the card has no in-flow
        content and would collapse to min-height under any layout that gives no explicit height (sections
        "auto" mode, vertical-stack, panel). This flow spacer gives the card its natural 480 px height there.
        A layout passing an explicit height (fixed sections rows, a set panel height) OVERRIDES this content
        height, and overflow:hidden clips the spacer, so the card still shrinks freely down to min_rows. */
    ha-card::before
    {
        content: '';
        display: block;
        height: 480px;
        pointer-events: none;
    }

    #map-container
    {
        /*  Absolute + inset so the container fills the ha-card via containing-block dimensions (which
            respect min-height); a percentage height collapses to 0 under Masonry. Hosts the renderer's
            ground holder + scene SVG. No CSS perspective property here: the ground carries its own perspective() in
            its transform (see SceneCamera.groundTransform), so it projects EXACTLY like the overlays' project3, and
            the flat scene SVG stays out of any 3D context (keeps the buildings aligned with the basemap).
            No overflow:hidden: ha-card already clips, to its rounded box, a pixel tighter than this one. It also
            sat over a preserve-3d subtree, which old WebKit clips badly, the suspected cause of the top-half-only
            render on some old iPads (unverified). */
        position: absolute;
        /*  Bleed 1 px under the border to cover the anti-alias seam at the corners; ha-card clips it back. */
        inset: -1px;
        /*  z-index 1 keeps the container (and home prism) above the ground guide layer (z 0) yet below every
            HUD overlay (z 4+). */
        z-index: 1;
    }

    /*  Ground holder: tilted basemap canvas + edge fade, driven by a CSS 3D transform (rotateX = pitch,
        rotateZ = bearing) written each frame. preserve-3d is REQUIRED: without it, at some pitch angles the
        3D-transformed ground canvas composites ABOVE the flat sibling scene-svg and hides the buildings. */
    .scene-ground-holder
    {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        pointer-events: none;
    }
    /*  Basemap canvas, painted from OpenFreeMap vector tiles (ground-render.ts). Positioned by the renderer's
        transform-origin + transform; sized in JS. Light/dark is two painted palettes, so there is no CSS
        filter: a theme flip repaints the canvas from its cached vector features. */
    .ground
    {
        position: absolute;
        top: 0;
        left: 0;
    }
    /*  Edge fade: same size + transform as the ground, a radial gradient transparent out to GROUND_FADE_START
        (88%) then dissolving to the card background, turning the square canvas into a soft disc. How FAR the
        ground reaches is set by GROUND_RADIUS (the canvas size); this only softens the rim. */
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
    /*  Screen-space scene SVG: cast shadows + extruded buildings repainted every frame.
        Full-size overlay above the ground, click-transparent (the HUD SVGs own their pointer events).
        The building/shadow paths extend far past the card (a whole neighbourhood projected), so this element's
        painted content is much larger than its box. On old iOS the compositor then sized this
        layer's backing store to that content, blew the OS layer-size cap and painted only its top half. contain:
        paint + overflow:hidden bound the layer to the card box (what we actually see), so the backing store stays
        card-sized and the whole scene paints. No visible change elsewhere: off-card paint was already clipped. */
    .scene-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
        contain: paint;
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
        width: 106px;
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

    /*  Day curve in two depth passes around the chip cluster, mirroring the solar arc's own layering: far half
        behind the chips (z 5, same as .solar-svg-front-far), near half over them (z 11). Both sit above the scene
        (z 1), so no building can cut through the curve: it is a reading of the data, like the arc, not something
        standing in the street. */
    .helios-day-curve-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
    }
    .helios-day-curve-far  { z-index: 5;  }
    .helios-day-curve-near { z-index: 11; }

    /*  Any chip with its day curve up: its second notch, pressed. The chip is an outline in the metric's colour on
        the card's background, so ON simply swaps the two - the universal switch language, outlined off / filled on.
        A different LANGUAGE from the .is-chart-active halo, which says "this is the selected chip": the two states
        stack without ever being mistaken for each other. No pixel added, no hit target shrunk. --chip-glow is each
        chip's own accent, so every chip fills with its own colour. */
    .pv-pct-label.is-curve-on,
    .battery-pct-label.is-curve-on,
    .grid-label.is-curve-on,
    .group-label.is-curve-on,
    .solar-pct-label.is-curve-on,
    .home-pill.is-curve-on
    {
        background: var(--chip-glow, var(--primary-color, #ff9800));
        color: var(--ha-card-background, var(--card-background-color, #fff));
        transition: background ${unsafeCSS(HOME_GROW_MS)}ms ease, color ${unsafeCSS(HOME_GROW_MS)}ms ease;
    }
    /*  The icon rides the text colour, so it flips with it. */
    .pv-pct-label.is-curve-on ha-icon,
    .battery-pct-label.is-curve-on ha-icon,
    .grid-label.is-curve-on ha-icon,
    .group-label.is-curve-on ha-icon,
    .solar-pct-label.is-curve-on ha-icon,
    .home-pill.is-curve-on ha-icon
    {
        color: var(--ha-card-background, var(--card-background-color, #fff));
    }

    /*  Day curve. The scaffolding (the sun's ground track, and a riser under each hour) is dashed and in the text
        colour: it is the frame the curve is read against, not data, so it must never compete with it for the eye.
        With no fill under the curve any more, these are the only things saying how high a point stands and how far
        away it is. */
    .helios-day-curve-foot,
    .helios-day-curve-riser
    {
        stroke: var(--primary-text-color, #212121);
        stroke-opacity: 0.35;
        stroke-width: 1;
        stroke-dasharray: 2 3;
        stroke-linecap: round;
    }
    .helios-day-curve-line
    {
        stroke-linecap: round;
    }
    /*  Contrast halo drawn UNDER each curve (2 px wider = ~1 px each side), in the card background (white in a light
        theme, near-black in a dark one) so it detaches the curve from any ground tint or building. */
    .helios-day-curve-line-outline
    {
        stroke: var(--card-background-color, #ffffff);
        stroke-linecap: round;
        stroke-opacity: 0.25;
    }
    /*  The drop from the sun to the curve beneath it. Its colour is the metric's, set per element; everything else
        is the same for every one of them, so it lives here. */
    .helios-day-curve-leader
    {
        stroke-width: 1.5;
        stroke-dasharray: 3 4;
        stroke-linecap: round;
        opacity: 0.85;
    }
    /*  Forecast: same curve, same colour, dashed. What changes after the present moment is not the metric but its
        certainty, so the line carries straight on and only its stroke gives way - the same language the timeline's
        own predicted curve already speaks. */
    .helios-day-curve-line.is-predicted,
    .helios-day-curve-line-outline.is-predicted
    {
        stroke-dasharray: 1 5;
        stroke-opacity: 0.85;
    }
    /*  A level rather than a flow (the battery state of charge): dashed the whole way. Longer dashes than the
        forecast pattern so a state of charge and a solar forecast never read as the same thing. */
    .helios-day-curve-line.is-dashed,
    .helios-day-curve-line-outline.is-dashed
    {
        stroke-dasharray: 5 4;
        stroke-opacity: 0.9;
    }
    /*  The halo stays faint even on dashed/forecast curves (the shared rules above set a high opacity for the
        coloured line; the outline must keep its low contrast value). */
    .helios-day-curve-line-outline.is-predicted,
    .helios-day-curve-line-outline.is-dashed
    {
        stroke-opacity: 0.25;
    }

    /*  Per-chip detail panel: a compact vertical readout top-right, opened by any chip tap and closed by tapping
        the scene. Tinted in the selection colour (--detail-accent, set inline). Icons only, values in the card's
        configured unit, and kept narrow so it never crowds a small card. */
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
        /*  A floating readout, not a card: the generic radius token, not --ha-card-border-radius. A "single card"
            panel view squares every card it holds (--ha-card-border-radius: 0) to make it full-bleed, and that
            cascades into here, which squared the panel too. --ha-border-radius-lg is the same 12px and no view
            overrides it. */
        border-radius: var(--ha-border-radius-lg, 12px);
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
    /*  Panel title: the selected rolling period, so the figures below never read as a live value. */
    .detail-panel .dp-title
    {
        align-self: stretch;
        text-align: center;
        font-size: var(--ha-font-size-xs, 10px);
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--detail-accent, var(--primary-color, #03a9f4));
        padding-bottom: 4px;
        margin-bottom: 2px;
        border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
    /*  The Ø average marker, held to the same 16px column as the icons so the min / avg / max rows line up. */
    .detail-panel .dp-row .dp-glyph
    {
        flex: 0 0 auto;
        width: 16px;
        text-align: center;
        font-size: 15px;
        line-height: 1;
        font-weight: 700;
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
        card. Shared by the PV to home, grid, battery, monitoring-group and sun to PV ray beads. */
    .pv-home-leader-bead,
    .grid-leader-bead,
    .battery-leader-bead,
    .group-leader-bead,
    .helios-day-curve-bead,
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
    /*  Terrain-horizon ridge: a discrete distant-relief silhouette under the sun path, behind the arc + chips
        (z 3). A hazy blue-grey reads on the map without fighting the scene; the fill fades downward to nothing. */
    .horizon-ridge-svg { z-index: 3; opacity: 1; }
    /*  Contrast halo under the crest line, in the card background (white light / near-black dark), so the ridge
        detaches from any ground/building. */
    .horizon-ridge-line-outline
    {
        fill: none;
        stroke: var(--card-background-color, #ffffff);
        stroke-width: 3.4;
        stroke-opacity: 0.25;
        stroke-linejoin: round;
        stroke-linecap: round;
    }
    .horizon-ridge-line
    {
        fill: none;
        stroke: var(--helios-horizon-line-color, var(--blue-grey-color, #607d8b));
        stroke-opacity: 0.75;
        stroke-width: 1.4;
        stroke-linejoin: round;
        stroke-linecap: round;
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

    /*  "Your real sky" weather overlay. The scene is graded by a filter on #map-container (--wx-map-filter); the
        overlay layers fade by --wx-sun / --wx-grey / --wx-cloud / --wx-rain / --wx-snow / --wx-flash, all set from
        JS by the resolved weather. Sits UNDER the chips (z 8).  */
    :host([data-wx-on]) #map-container { filter: var(--wx-map-filter, none); transition: filter 0.18s linear; }

    .helios-wx { position: absolute; inset: 0; z-index: 6; pointer-events: none; border-radius: inherit; overflow: hidden; display: none; }
    :host([data-wx-on]) .helios-wx { display: block; }
    .helios-wx-warm, .helios-wx-shafts, .helios-wx-veil-grey, .helios-wx-veil-dark, .helios-wx-clouds, .helios-wx-wet, .helios-wx-rain, .helios-wx-snow, .helios-wx-flash
    {
        position: absolute;
        inset: 0;
    }
    .helios-wx-rain, .helios-wx-snow { z-index: 7; width: 100%; height: 100%; }
    .helios-wx-snow { opacity: var(--wx-snow, 0); }

    /*  CLEAR: a broad warm wash over the WHOLE card (not one patch) + a bloom that breathes + faint warm shafts.  */
    .helios-wx-warm
    {
        opacity: var(--wx-sun, 0);
        background:
            radial-gradient(150% 140% at var(--wx-sun-x, 40%) var(--wx-sun-y, 14%),
                rgba(255, 206, 130, 0.36),
                rgba(255, 184, 96, 0.20) 45%,
                rgba(255, 170, 80, 0.10) 100%);
    }
    .helios-wx-shafts
    {
        opacity: calc(var(--wx-sun, 0) * 0.45);
        background: repeating-conic-gradient(from 200deg at var(--wx-sun-x, 40%) var(--wx-sun-y, 14%),
            rgba(255, 232, 170, 0.14) 0deg, rgba(255, 232, 170, 0) 5deg 13deg);
        -webkit-mask-image: radial-gradient(120% 120% at var(--wx-sun-x, 40%) var(--wx-sun-y, 14%), #000 0%, rgba(0, 0, 0, 0.4) 45%, transparent 80%);
        mask-image: radial-gradient(120% 120% at var(--wx-sun-x, 40%) var(--wx-sun-y, 14%), #000 0%, rgba(0, 0, 0, 0.4) 45%, transparent 80%);
    }
    /*  GREY (overcast) + DARK (rain) veils, stacked, each faded by its own amount.  */
    .helios-wx-veil-grey { opacity: calc(var(--wx-grey, 0) * 0.5); background: linear-gradient(180deg, rgb(200, 205, 212), rgb(170, 176, 184)); }
    .helios-wx-veil-dark { opacity: calc(var(--wx-rain, 0) * 0.55); background: linear-gradient(180deg, rgb(66, 74, 86), rgb(40, 47, 58)); }

    .helios-wx-clouds { opacity: var(--wx-cloud, 0); }
    .helios-wx-cloud
    {
        position: absolute;
        border-radius: 50%;
        will-change: transform;
        background: radial-gradient(circle, rgba(30, 35, 42, 0.45), rgba(30, 35, 42, 0) 68%);
    }
    /*  Sized in cqw (share of the card's WIDTH, via ha-card's container-type: inline-size) for BOTH axes, so the
        shadows stay round at any card shape. Percent height made them tall ovals on a narrow card: 55% of a small
        width vs 70% of a tall height. left/top keep % for placement; the sweep is element-relative. */
    .helios-wx-cloud.k1 { width: 55cqw; height: 55cqw; left: -30%; top: -10%; animation: helios-wx-sweep 22s linear infinite; }
    .helios-wx-cloud.k2 { width: 42cqw; height: 42cqw; left: -30%; top: 20%; animation: helios-wx-sweep 30s linear infinite; animation-delay: -8s; }
    .helios-wx-cloud.k3 { width: 66cqw; height: 66cqw; left: -45%; top: -20%; animation: helios-wx-sweep 40s linear infinite; animation-delay: -16s; }
    @keyframes helios-wx-sweep { from { transform: translate(0, 0); } to { transform: translate(230%, 18%); } }

    .helios-wx-wet
    {
        opacity: var(--wx-rain, 0);
        background:
            radial-gradient(40% 30% at 30% 60%, rgba(150, 180, 215, 0.16), transparent 70%),
            radial-gradient(35% 25% at 70% 78%, rgba(150, 180, 215, 0.14), transparent 70%);
    }

    /*  Corner chips (cost, temperature, humidity): a centered row pinned along the BOTTOM of the scene, so they
        read as secondary info and group with the home/grid/battery pill family rather than fighting the irradiance
        chip up top. Below the timeline's z-index (1000) so the timeline always wins on overlap. Each icon is tinted
        by --chip-color.  */
    .helios-corner-chips
    {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 12px;
        z-index: 8;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        pointer-events: none;
    }
    /*  When the timeline is shown, lift the row clear of it: period band (33px) + scrubber height + a small gap.
        The scrubber clamp mirrors .time-bar in helios-timeline-css.ts (bottom: 33px; height: clamp(54px,18%,90px));
        keep the two in sync if that changes.  */
    .helios-corner-chips.has-timeline
    {
        bottom: calc(33px + clamp(54px, 18%, 90px) + 10px);
    }
    /*  Same shared pill recipe as the HUD chips: fixed width, 2px border in the chip's colour, card-background fill,
        icon + text in --primary-text-color. Only the border colour differs per chip (via --chip-color).  */
    .helios-corner-chip
    {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        box-sizing: border-box;
        width: 106px;
        padding: 3px 10px;
        border: 2px solid var(--chip-color, #e53935);
        border-radius: 999px;
        background: var(--card-background-color, #ffffff);
        background-clip: padding-box;
        color: var(--primary-text-color, #212121);
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        box-shadow: var(--helios-shadow-chip);
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
        /*  Glow accent for the active-target halo below (same language as the scene chips).  */
        --chip-glow: var(--chip-color, #e53935);
    }
    .helios-corner-chip ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }
    /*  Clickable + active states, mirroring the scene chips: [role=button] re-enables events (the row is
        pointer-events:none), .is-chart-active raises the halo, .is-curve-on fills the pill with the metric colour.  */
    .helios-corner-chip[role="button"] { pointer-events: auto; cursor: pointer; }
    /*  Day-curve open: each non-active corner chip becomes an inert, invisible placeholder. It still reserves its
        slot width so the centered row does not shift the surviving chip when its siblings drop out.  */
    .helios-corner-chip.is-slot-hidden { visibility: hidden; pointer-events: none; }
    .helios-corner-chip::after
    {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        box-shadow: 0 0 12px 1px color-mix(in srgb, var(--chip-glow, transparent) 90%, transparent);
        opacity: 0;
    }
    .helios-corner-chip.is-chart-active::after { opacity: 1; }
    .helios-corner-chip.is-curve-on
    {
        background: var(--chip-glow, var(--primary-color, #ff9800));
        color: var(--ha-card-background, var(--card-background-color, #fff));
    }
    .helios-corner-chip.is-curve-on ha-icon { color: var(--ha-card-background, var(--card-background-color, #fff)); }

    /*  THUNDERSTORM lightning: a top-weighted blue-white flash pushed by the storm controller via --wx-flash.  */
    .helios-wx-flash
    {
        z-index: 7;
        opacity: var(--wx-flash, 0);
        mix-blend-mode: screen;
        background:
            radial-gradient(120% 80% at 50% -10%, rgba(226, 236, 255, 0.9), rgba(200, 216, 255, 0.35) 40%, transparent 75%);
    }

`;
