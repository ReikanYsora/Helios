import { css } from 'lit';

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
        background: #000;
        /*  Clip the black map backdrop to the padding box so it stops inside the <ha-card> border
            instead of bleeding under it and painting a dark corner that breaks HA's subtle frame. */
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
    /*  Basemap tile canvas (live CARTO tiles) or its flat-plane fallback. Positioned by the renderer's
        transform-origin + transform; sized in JS to the stitched tile grid. */
    .ground,
    .ground-flat
    {
        position: absolute;
        top: 0;
        left: 0;
    }
    /*  Edge fade: same size + transform as the ground, dissolving the disc borders into the card
        background so the basemap doesn't end in a hard rectangle. */
    .ground-fade
    {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
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


    /*  Home click target: invisible circular hitbox centred on the home's projected position, sized to
        overlap a typical building footprint. z-index above every chip + leader so the click always
        lands on the home regardless of what sits under the pointer. */
    .home-hitbox
    {
        position: absolute;
        transform: translate(-50%, -50%);
        width:  120px;
        height: 120px;
        border-radius: 50%;
        background: transparent;
        cursor: pointer;
        pointer-events: auto;
        z-index: 55;
    }

    /*  Timeline slides out below the card edge instead of fading. */
    .time-bar
    {
        transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
        will-change: transform;
    }


    /*  Timeline, pinned to the bottom of the card. The whole bar accepts pointer events for scrub. */
    .time-bar
    {
        position: absolute;
        bottom: 6px;
        /*  Centred via left/right gutters, not translateX(-50%): the transform promoted the bar into a
            compositor layer that rasterised the inner SVG charts at fractional resolution = blur. */
        left: 8px;
        right: 8px;
        width: auto;
        /*  Own stacking layer at the top of the card so the sun arc, home glow and overlay chips never
            cross over it during auto-rotate. */
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        cursor: grab;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    }

    .time-bar:active
    {
        cursor: grabbing;
    }

    /*  Chart + day-label footer composite. The frame (accent stroke, radius, shadow) lives here so the
        chart and its footer read as one instrument with a hairline divider between them, like the HA
        energy-solar-overview timeline. overflow:hidden clips both children to the rounded corners. */
    .tb-chart-stack
    {
        position: relative;
        background: var(--card-background-color, #ffffff);
        /*  HA-style card frame: a thin stroke in the active chart accent, softened to 60 % so it reads
            as a subtle frame. */
        border: var(--ha-border-width-sm, 1px) solid
            color-mix(in srgb, var(--chart-accent, var(--primary-text-color, #212121)) 60%, transparent);
        border-radius: var(--ha-border-radius-lg, 8px);
        box-shadow: 0 1px 3px var(--shadow-color);
        overflow: hidden;
    }
    .tb-chart-card
    {
        position: relative;
        /*  Height scales with container width (cqw): 36 px floor on a small tile, 72 px ceiling on a
            kiosk. Both timeline charts share this expression so they stay equal height. */
        height: clamp(36px, 8cqw, 72px);
        overflow: hidden;
    }
    .hc-chart-svg
    {
        display: block;
        width: 100%;
        height: 100%;
    }
    /*  Grow only the curves up from the baseline when the chart re-targets (SVG is keyed so it
        re-mounts and replays), matching HA's 500 ms grow. Separators + hover guide sit outside this
        group so they don't stretch. fill-box anchors the scale at the chart baseline. */
    .hc-chart-grow
    {
        transform-box: fill-box;
        transform-origin: bottom;
        animation: hc-chart-grow 500ms ease-out;
    }
    @keyframes hc-chart-grow
    {
        from { transform: scaleY(0); }
        to   { transform: scaleY(1); }
    }
    @media (prefers-reduced-motion: reduce)
    {
        .hc-chart-grow { animation: none; }
    }

    /*  Stroke-only outline over the filled area so peaks read cleanly where the gradient fades.
        0.7 px hairline: a wider stroke self-overlapped on high-variation days and smudged dense
        regions into a band. */
    .hc-chart-line
    {
        fill: none;
        stroke-width: 0.7;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
        opacity: 0.95;
        pointer-events: none;
    }

    /*  PV prediction line: overlays the observed chart past "now" from pv-peak-kwp scaled by the
        clear-sky model. Stroke colour is computed theme-aware in charts.ts. */
    .hc-chart-predicted
    {
        stroke-dasharray: 4 3;
        stroke-width: 1;
    }

    /*  Per-source PV curves on multi-source installs. Drawn under the aggregate at lower opacity as
        background context. Stroke colour comes from the inline attribute (hue-rotated derivative, see
        pvSourceColor in charts.ts) so the curve matches its tooltip-row pastille. */
    .hc-chart-line-source
    {
        opacity: 0.35;
    }



    /*  Dotted day separators at midnight boundaries, at 0.55 alpha so they read clearly. Flips with
        the theme via --rgb-primary-text-color. */
    .hc-day-sep
    {
        stroke: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.55);
        stroke-width: 1.2;
        stroke-dasharray: 2 2.5;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }


    /*  Tiny hour ticks on the midline, discreet ambient texture. */
    .hc-hour-tick
    {
        stroke: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.35);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }

    /*  Live cursor: thin "where now is" line spanning the chart. Slightly wide + opaque so it stays
        readable through the future-mask wash, but kept subtle as a passive reference. */
    .tb-cursor-now
    {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.5);
        border-radius: 999px;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 4;
    }
    /*  Scrub cursor: a thin solid brand-blue stroke spanning the chart, no arrow or handle, so it
        reads as a minimal scrub mark. */
    .tb-cursor-sel
    {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1.5px;
        background: var(--primary-color, #03a9f4);
        border-radius: 999px;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 4;
        box-shadow: 0 0 4px rgba(var(--rgb-primary-color), 0.4);
    }

    /*  Hover guide: vertical line at the pointer's X. Same dotted recipe as the day separators but
        more opaque so it reads as interactive focus, not ambient structure. */
    .hc-hover-guide
    {
        stroke: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.55);
        stroke-width: 1;
        stroke-dasharray: 2 2;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }

    /*  Per-curve hover dot at the interpolated Y of each series. Stroked in the primary text colour
        so it reads as a circled marker on both themes. */
    .hc-hover-dot
    {
        stroke: color-mix(in srgb, var(--primary-text-color, #ffffff) 70%, transparent);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }
    /*  Hover dot as an absolutely-positioned HTML element, not SVG: the chart SVG uses
        preserveAspectRatio="none", which stretched <circle> dots into ovals. CSS-pixel dots
        (width=height, border-radius 50%) stay round. Position derived from the hoverX/W, hoverY/H
        ratios since card and SVG share the same content area. */
    .hc-hover-dot-html
    {
        position: absolute;
        /*  6 px filled disc, matching the moving beads on the chip leaders. */
        width: 6px;
        height: 6px;
        border-radius: 50%;
        box-sizing: border-box;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 5;
    }

    /*  Wrapper hosting the tooltip body. Carries the horizontal positioning (left + translateX) so its
        children slide together as one block on scrub. Bottom + margin lift the stack into the gap
        above the chart card. */
    .tb-hover-tooltip-wrapper
    {
        position: absolute;
        bottom: 100%;
        margin-bottom: 10px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
        z-index: 30;
    }
    /*  Frame + padding match HA Energy chart tooltips so it reads as native HA chrome. */
    .tb-hover-tooltip
    {
        position: relative;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 4px;
        padding: 6px 8px;
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.16), 0 1px 4px 0 rgba(0, 0, 0, 0.06);
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
        font-size: var(--ha-font-size-s, 12px);
        line-height: 1.25;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        min-width: 120px;
        align-self: stretch;
    }

    /*  Time heading at the top of the tooltip: clock glyph + bold tabular numerals with a hairline
        separator under it, so the time reads as a heading above the data rows. */
    .tb-hover-tooltip-time
    {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: var(--ha-font-weight-bold, 700);
        letter-spacing: 0.3px;
        padding-bottom: 4px;
        margin-bottom: 4px;
        border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .tb-hover-tooltip-time-icon
    {
        --mdc-icon-size: 14px;
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        line-height: 1;
        color: var(--primary-text-color, #212121);
        --mdc-icon-color: var(--primary-text-color, #212121);
    }
    .tb-hover-tooltip-time-label
    {
        display: inline-flex;
        align-items: center;
        line-height: 1;
    }
    .tb-hover-tooltip-row
    {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 1px 0;
    }

    .tb-hover-tooltip-icon
    {
        --mdc-icon-size: 14px;
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        line-height: 1;
        color: var(--primary-text-color, #212121);
        --mdc-icon-color: var(--primary-text-color, #212121);
    }
    .tb-hover-tooltip-value
    {
        flex: 1;
        text-align: right;
    }

    /*  Per-source breakdown rows under the aggregate PV row on multi-source installs. Indented +
        smaller so they read as children of the headline. The colour pastille mirrors the per-source
        chart curve so row and curve can be matched. */
    .tb-hover-tooltip-row-sub
    {
        font-size: var(--ha-font-size-xs, 11px);
        opacity: 0.78;
        padding-left: 4px;
    }
    .tb-hover-tooltip-dot
    {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        display: inline-block;
    }
    .tb-hover-tooltip-sublabel
    {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
    }

    /*  LIVE chip at the top-right of the scrub tooltip. Outline recipe (transparent backdrop + primary
        border + primary glyph) so it reads on both themes without clashing with the tooltip background.
        The dot pulses, mirroring HA Energy's live-data vocabulary. */
    .tb-hover-tooltip-live-chip
    {
        /*  Last flex child of the time row, pushed right via margin-left: auto; the parent's
            align-items: center vertically aligns it with the clock glyph + time label, no absolute math. */
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 0 6px 0 4px;
        height: 18px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-color, #03a9f4);
        border: 1px solid var(--primary-color, #03a9f4);
        border-radius: 3px;
        font-size: inherit;
        font-weight: var(--ha-font-weight-bold, 700);
        letter-spacing: 0.4px;
        text-transform: uppercase;
        line-height: 1;
        /*  Own GPU layer via translateZ so the chip gets a pixel-snapped grid independent of the
            wrapper's fractional translateX; otherwise the text + border antialias blurry on high-DPI. */
        transform: translateZ(0);
        backface-visibility: hidden;
        /*  Fade in/out via opacity (rendered every tooltip pass) instead of popping. */
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.16s ease-out;
    }
    .tb-hover-tooltip-live-chip.is-visible
    {
        opacity: 1;
    }
    .tb-hover-tooltip-live-chip-dot
    {
        --mdc-icon-size: 12px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        animation: tb-hover-tooltip-live-pulse 1.4s ease-in-out infinite;
    }
    .tb-hover-tooltip-live-chip-label
    {
        display: inline-flex;
        align-items: center;
        line-height: 1;
    }
    @keyframes tb-hover-tooltip-live-pulse
    {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
    }

    /*  Scrub tail: vertical dotted line at the scrub X in the gap above the chart card. Positioned
        independently of the tooltip so it stays on the scrub line when the tooltip slides to clear the
        edges. Painted via repeating-linear-gradient so the magnet-snap variant can flow the dots
        (a dashed border could not be animated). */
    .tb-hover-tooltip-tail
    {
        position: absolute;
        bottom: 100%;
        width: 1.5px;
        height: 10px;
        /*  Default cursor paints in the primary text colour, un-animated, as a quiet scrub cue. The
            brand-blue + flow animation only kicks in in the magnet zone (.is-magnet-snap below). */
        background-image: repeating-linear-gradient(
            to bottom,
            var(--primary-text-color, #212121) 0,
            var(--primary-text-color, #212121) 2px,
            transparent 2px,
            transparent 4px
        );
        transform: translateX(-50%);
        pointer-events: none;
        /*  Above the tooltip (z 30) and chart-card decoration so the animated cursor stays visible. */
        z-index: 1001;
    }
    /*  Magnet-snap variant: brand-blue dots flowing upward to signal "release here to return to live".
        Flow runs bottom-to-top because "now" is the forward edge above the viewport. */
    .tb-hover-tooltip-tail.is-magnet-snap
    {
        background-image: repeating-linear-gradient(
            to bottom,
            var(--primary-color, #03a9f4) 0,
            var(--primary-color, #03a9f4) 2px,
            transparent 2px,
            transparent 4px
        );
        animation: tb-hover-tooltip-tail-flow 0.5s linear infinite;
    }
    @keyframes tb-hover-tooltip-tail-flow
    {
        from { background-position: 0 0; }
        to   { background-position: 0 -4px; }
    }

    /*  tb-hover-tooltip flips with the theme via --card-background-color etc., no dark override. */


    /*  Future-mask wash: stretches from "now" to the right edge, on top of the curves and night zones
        but below the cursors (z 4). Card background at moderate alpha lightens both curves and
        night-zone washes in one pass without redoubling on overlap. */
    .hc-future-mask
    {
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        pointer-events: none;
        z-index: 3;
        /*  color-mix on transparent keeps the wash translucent on every theme so the predicted PV
            curve stays visible; the bare var(--card-background-color) goes opaque in dark mode and
            would hide the prediction. */
        background: color-mix(in srgb, var(--card-background-color, #ffffff) 55%, transparent);
    }


    .hc-night-zone
    {
        position: absolute;
        top: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 3;
        /*  Night-slice wash: a touch darker in light themes (lighter in dark, rule below), no hatch or
            border, so dusk/dawn read as one calm band that keeps the curves legible. */
        background: rgba(0, 0, 0, 0.06);
    }
    ha-card.theme-dark .hc-night-zone
    {
        background: rgba(255, 255, 255, 0.08);
    }


    /*  Day strip: a bordered bar with one centred label per visible day and a vertical separator at
        each midnight. Frame recipe matches the chart cards so the stack reads as one instrument. */
    .tb-day-strip
    {
        position: relative;
        height: 22px;
        box-sizing: border-box;
        /*  Footer band of the chart stack: frame lives on .tb-chart-stack, so here we only draw the
            hairline separating labels from the chart above (like the HA timeline footer). */
        border-top: var(--ha-border-width-sm, 1px) solid
            var(--divider-color, rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.12));
        overflow: hidden;
        pointer-events: none;
    }
    /*  Timeline label point-positioned on its model fraction: inline left anchors the fraction, the
        translate centres the text over it. */
    .tb-day-strip-date
    {
        position: absolute;
        top: 0;
        bottom: 0;
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        padding: 0 1px;
        box-sizing: border-box;
        color: var(--primary-text-color, #212121);
        /*  HA frontend font stack so the label's metrics match the chart cards above. */
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, Roboto, "Helvetica Neue", Arial, sans-serif));
        font-size: clamp(9px, 7cqw, 11px);
        line-height: 18px;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        z-index: 2;
        font-weight: var(--ha-font-weight-normal, 400);
    }

    /*  Today's label carries more weight so it reads as the present alongside the now-cursor. */
    .tb-day-strip-date.is-today
    {
        font-weight: var(--ha-font-weight-medium, 500);
    }

    /*  Header row above the chart: active-target indicator left, period selector right. pointer-events:
        none so the band stays transparent to map rotation; the children re-enable events. */
    .tb-header
    {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 2px 4px;
        pointer-events: none;
    }
    /*  Active-target indicator (mirrors HA's chart-indicator): icon of the current chart target, keyed
        so it fades in on each re-target. */
    .tb-chart-indicator
    {
        display: inline-flex;
        align-items: center;
        /*  Same chip frame as the period selector so the two header controls read as one family. */
        padding: 2px 6px;
        border-radius: 8px;
        background: var(--card-background-color, #ffffff);
        box-shadow: 0 1px 3px var(--shadow-color);
        /*  Icon in the text ink, not the accent colour. */
        color: var(--primary-text-color, #212121);
        pointer-events: none;
    }
    .tb-chart-indicator ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
        display: block;
        animation: tb-chart-indicator-fade 250ms ease;
    }
    @keyframes tb-chart-indicator-fade
    {
        from { opacity: 0; }
        to   { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce)
    {
        .tb-chart-indicator ha-icon { animation: none; }
    }
    /*  Rolling-period selector: compact text segmented control with the shared on-primary active
        recipe so the controls read as one family. */
    .tb-period-selector
    {
        display: inline-flex;
        gap: 2px;
        padding: 2px;
        border-radius: 8px;
        background: var(--card-background-color, #ffffff);
        box-shadow: 0 1px 3px var(--shadow-color);
        pointer-events: auto;
    }
    .tb-period-seg
    {
        appearance: none;
        -webkit-appearance: none;
        border: 0;
        outline: 0;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: 6px;
        background: transparent;
        color: var(--secondary-text-color, #727272);
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, Roboto, "Helvetica Neue", Arial, sans-serif));
        font-size: clamp(9px, 6cqw, 11px);
        line-height: 16px;
        letter-spacing: 0;
        font-weight: var(--ha-font-weight-medium, 500);
        white-space: nowrap;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 0.15s, color 0.15s;
    }
    .tb-period-seg:hover
    {
        background: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08);
        color: var(--primary-text-color, #212121);
    }
    .tb-period-seg.is-on
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-on-primary-color, #ffffff);
    }
    .tb-period-seg.is-on:hover  { background: var(--dark-primary-color, #0288d1); }

    /*  Vertical separator at each between-day boundary, dotted to match the chart's day separators.
        None at the outer edges since the strip border closes those. */
    .tb-day-strip-sep
    {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
        z-index: 1;
        background-image: repeating-linear-gradient(
            to bottom,
            rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.30) 0,
            rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.30) 1.5px,
            transparent                                          1.5px,
            transparent                                          4px
        );
    }



    /*  Crisp-text rule for chips translated onto the home anchor: the 50 % anchor + -50 % translate
        lands them at a fractional pixel, so geometricPrecision + antialiased smoothing keeps the
        glyphs sharp. */
    .pv-pct-label,
    .battery-pct-label,
    .solar-pct-label
    {
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }

    /*  Camera-lock toggle, top-left. Same 40 px circle recipe as the toolbar-button recipe; brand-blue
        pastille appears when locked. */
    .camera-lock-btn
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
    .camera-lock-btn:hover,
    .camera-lock-btn:focus,
    .camera-lock-btn:focus-visible,
    .camera-lock-btn:active
    {
        outline: 0 !important;
        box-shadow: none !important;
    }
    .camera-lock-btn ha-icon
    {
        --mdc-icon-size: 22px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        pointer-events: none;
    }
    .camera-lock-btn:hover  { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08); }
    .camera-lock-btn:active { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.16); }
    .camera-lock-btn.is-on
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-on-primary-color, #ffffff);
    }
    .camera-lock-btn.is-on:hover  { background: var(--dark-primary-color, #0288d1); }
    .camera-lock-btn.is-on:active { background: var(--darker-primary-color, #01579b); }
    /*  Disabled state: button stays visible to show the lock state but is inert,
        greyed out with no hover/active feedback. */
    .camera-lock-btn.is-disabled,
    .camera-lock-btn[disabled]
    {
        opacity: 0.45;
        cursor: default;
        pointer-events: none;
    }

    /*  Top-left rail hosting the camera-lock toggle. pointer-events off on
        the rail; the button opts back in so it doesn't steal map interactions. */
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
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 76px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color:      var(--primary-text-color, #212121);
        border:     2px solid var(--pv-leader-color, var(--energy-solar-color, #ff9800));
        border-radius: 999px;
        padding: 3px 10px;
        font-size:    var(--ha-font-size-s, 12px);
        font-weight:  600;
        line-height:  1.2;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 1px 3px var(--shadow-color);
        white-space: nowrap;
    }

    .pv-pct-label ha-icon
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
        /*  Clip the card-background to the padding box so it doesn't bleed under the coloured border. */
        background-clip: padding-box;
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
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 76px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color:      var(--primary-text-color, #212121);
        border:     2px solid var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
        border-radius: 999px;
        padding: 3px 10px;
        font-size:    var(--ha-font-size-s, 12px);
        font-weight:  600;
        line-height:  1.2;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 1px 3px var(--shadow-color);
        white-space: nowrap;
    }

    .battery-pct-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    /*  Grid chip, same pill recipe as the PV/battery chips. Shows the active flow only; the border
        follows the inline --grid-leader-color (blue importing, purple exporting), icon + value flip
        with it. */
    .grid-label
    {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 76px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-text-color, #212121);
        border: 2px solid var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2));
        border-radius: 999px;
        padding: 3px 10px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 1px 3px var(--shadow-color);
        white-space: nowrap;
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }
    .grid-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    .grid-leader-svg
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

    /*  Low-carbon chip, same pill recipe tinted in HA's non-fossil green. Sits above the grid chip and
        feeds it. */
    .low-carbon-label
    {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 76px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-text-color, #212121);
        border: 2px solid var(--low-carbon-color, var(--energy-non-fossil-color, #0f9d58));
        border-radius: 999px;
        padding: 3px 10px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 1px 3px var(--shadow-color);
        white-space: nowrap;
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }
    .low-carbon-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }
    /*  Low-carbon → grid leader: a straight vertical hairline (chips share the column x). Stroke + bead
        fill from the inline --low-carbon-color. */
    .low-carbon-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    .low-carbon-leader-line
    {
        stroke-width: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  PV → home leader: vertical dashed line from the PV chip down to the home, in the PV colour.
        z 5, below the chip cluster (z 6) so the dashes pass behind the chips. */
    .pv-home-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }

    .pv-home-leader-line
    {
        stroke: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
        stroke-width: 1;
        stroke-opacity: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  Moving bead riding the leader at a speed proportional to live production, like HA's
        energy-distribution card. */
    .pv-home-leader-bead
    {
        opacity: 0.95;
        stroke: var(--card-background-color, #ffffff);
        stroke-width: 1;
        stroke-opacity: 0.85;
        paint-order: stroke fill;
    }
    ha-card.theme-dark .pv-home-leader-bead
    {
        stroke: var(--card-background-color, #191a1b);
        stroke-opacity: 0.95;
    }



    /*  Battery leaders. SoC↔PV and PV↔Power share a solid L-shaped path with a rounded bend. The
        PV↔Power leader carries a bead at a speed proportional to |P|, its path flipped inline when
        discharging so travel matches the flow. The SoC leader is static: SoC is a level, not a flow. */
    .battery-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }

    .battery-leader-line
    {
        stroke: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
        stroke-width: 1;
        stroke-opacity: 1;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
    }

    .battery-leader-bead
    {
        opacity: 0.95;
        stroke: var(--card-background-color, #ffffff);
        stroke-width: 1;
        stroke-opacity: 0.85;
        paint-order: stroke fill;
    }
    ha-card.theme-dark .battery-leader-bead
    {
        stroke: var(--card-background-color, #191a1b);
        stroke-opacity: 0.95;
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
        position: absolute;
        transform: translate(-50%, -50%);
        z-index: 9;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 4px;
        /*  Horizontal stadium: home glyph + live usage side by side. min-width/height match the leader
            dock half-extents (38/14 px) so the leaders meet the visible pill edge. */
        min-width: 76px;
        height: 28px;
        box-sizing: border-box;
        padding: 0 10px;
        background: var(--card-background-color, #ffffff);
        background-clip: padding-box;
        color: var(--primary-color, #03a9f4);
        border: 2px solid var(--primary-color, #03a9f4);
        border-radius: 999px;
        pointer-events: none;
        box-shadow: 0 1px 3px var(--shadow-color);
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        /*  Keep the mask fade and ease the hover glow in/out. */
        transition: opacity 0.35s ease, box-shadow 0.2s ease;
    }
    /*  Light glow on home hover; the hover state is driven from the hitbox by the card. */
    .home-pill.is-hovered
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 7px 1px color-mix(in srgb, var(--primary-color, #03a9f4) 28%, transparent);
    }
    .home-pill ha-icon
    {
        --mdc-icon-size: 16px;
        /*  Home glyph in the text ink, not the blue pill border colour. */
        color: var(--primary-text-color, #212121);
        display: inline-flex;
        align-items: center;
    }
    /*  Live home consumption, second line inside the hub. Tabular figures keep the digits steady. */
    .home-pill-usage
    {
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 700;
        line-height: 1.1;
        color: var(--primary-text-color, #212121);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        letter-spacing: -0.2px;
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
    .cloud-chip
    {
        position: absolute;
        transform: translate(-50%, -50%);
        z-index: 11;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        pointer-events: auto;
        cursor: pointer;
        background: var(--card-background-color, #ffffff);
        background-clip: padding-box;
        color: var(--primary-text-color, #212121);
        border: 2px solid var(--secondary-text-color, #727272);
        border-radius: 999px;
        padding: 3px 10px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        box-shadow: 0 1px 3px var(--shadow-color);
    }
    .cloud-chip ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
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
        gap: 1px;
        color: var(--sun-cross-color, #ffc107);
        pointer-events: none;
        /*  Same layer as the far arc (z 5) it sits on, so the value chips (z 8) stay on top — matches
            the source card's l-arc-far placement of the sunrise/sunset markers. */
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

    /*  Solar ray bead travelling sun → PV chip along the ray. Same recipe as the other beads; speed
        from the inline animateMotion dur driven by live irradiance. */
    .solar-svg .solar-ray-bead
    {
        opacity: 0.95;
        stroke: var(--card-background-color, #ffffff);
        stroke-width: 1;
        stroke-opacity: 0.85;
        paint-order: stroke fill;
    }
    ha-card.theme-dark .solar-svg .solar-ray-bead
    {
        stroke: var(--card-background-color, #191a1b);
        stroke-opacity: 0.95;
    }


    /*  Solar irradiance label pinned above the live sun, same chip language as the cloud/PV chips. */
    .solar-pct-label
    {
        position: absolute;
        transform: translate(-50%, -100%);
        pointer-events: none;
        /*  Above the arc-front lines (z 11) so an arc segment never crosses the W/m² readout; the sun
            disc (z 12) still paints on top. */
        z-index: 13;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--card-background-color, #ffffff);
        color:      var(--primary-text-color, #212121);
        /*  Sun chip uses the HA amber token so it stays distinct from the PV production chip (orange). */
        border:     2px solid var(--helios-sun-color, var(--amber-color, var(--warning-color, #ffc107)));
        border-radius: 999px;
        padding: 3px 10px;
        font-size:    var(--ha-font-size-s, 12px);
        font-weight:  600;
        line-height:  1.2;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 1px 3px var(--shadow-color);
        white-space: nowrap;
    }

    .solar-pct-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }


    /*  ============================================================
        Dark theme, opt-in via \`card-theme: dark\`. Affects only the chrome
        (chips, charts, cursors, labels, leaders, tooltips); the basemap
        keeps its own colours. Chip plates flip white → near-black, text/
        borders go light-grey, and chart hairlines flip to white-on-dark
        with the same opacity envelopes. User-coloured fills, the scrub
        blue and the live tooltip plate already read on dark, left alone.
        ============================================================ */

    /*  .tb-chart-card flips via --card-background-color + --divider-color, no dark override needed. */

    ha-card.theme-dark .hc-day-sep
    {
        stroke: rgba(255, 255, 255, 0.55);
    }


    ha-card.theme-dark .hc-hour-tick
    {
        stroke: rgba(255, 255, 255, 0.35);
    }

    /*  tb-cursor-now is driven by --rgb-primary-text-color + alpha so it flips on its own. */

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


    /*  Fullscreen / kiosk breakpoint (issue #33): above 900 px card width the chip text bumps one size
        step up so the chips, day-strip and W/m² readout stay legible from across the room. On-map
        geometry is scaled separately by the engine (_heliosScale). Keyed on the container query (above)
        so it flips on the card's own width, not the viewport's. */
    @container helios-card (min-width: 900px)
    {
        .pv-pct-label,
        .battery-pct-label,
        .grid-label,
        .low-carbon-label,
        .solar-pct-label
        {
            font-size: var(--ha-font-size-m, 14px);
            padding: 4px 12px;
        }
        .pv-pct-label ha-icon,
        .battery-pct-label ha-icon,
        .grid-label ha-icon,
        .low-carbon-label ha-icon,
        .solar-pct-label ha-icon
        {
            --mdc-icon-size: 18px;
        }
        .tb-day-strip-date
        {
            font-size: clamp(8px, 5.5cqw, var(--ha-font-size-s, 12px));
        }
        .tb-hover-tooltip
        {
            font-size: var(--ha-font-size-s, 13px);
        }
    }


`;
