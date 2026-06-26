import { css } from 'lit';

//Timeline styles for HeliosCard: the bottom time-bar / scrubber, the two stacked
//charts (curves, day separators, hover guide + dots, future mask, night zones),
//the hover tooltip, the day-strip footer and the period selector. Split out of
//helios-card-scene-css.ts to keep that file focused on the map, HUD chips, solar arc and
//home cluster. Both stylesheets share the same shadow root, so card-level custom
//properties (--card-background-color, --shadow-color, --rgb-primary-text-color, ...)
//defined on :host / ha-card in helios-card-scene-css.ts resolve here unchanged.
export const heliosTimelineStyles = css`
    /*  Timeline, pinned to the bottom of the card. The whole bar accepts pointer events for scrub.
        Slides out below the card edge (transform) instead of fading when hidden. */
    .time-bar
    {
        transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
        will-change: transform;
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
        background context. Stroke colour comes from the inline attribute (HA Energy's per-source ramp,
        see energySolarColor in format.ts) so the curve matches its tooltip-row pastille + the
        home histogram band. */
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
    /*  Active-target indicator: icon of the current chart target, keyed so it fades in on each
        re-target. */
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

    /*  Dark theme (opt-in via \`card-theme: dark\`): flip the chart day separators to
        white-on-dark at the same opacity. The chart card, cursors and tooltip plate
        flip via their --card-background-color / --rgb-primary-text-color recipes. */
    ha-card.theme-dark .hc-day-sep
    {
        stroke: rgba(255, 255, 255, 0.55);
    }

    /*  Fullscreen / kiosk breakpoint (issue #33): above 900 px card width the chip text bumps one size
        step up so the chips, day-strip and W/m² readout stay legible from across the room. On-map
        geometry is scaled separately by the engine (_heliosScale). Keyed on the container query (above)
        so it flips on the card's own width, not the viewport's. */
    @container helios-card (min-width: 900px)
    {
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
