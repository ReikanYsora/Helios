import { css } from 'lit';

//Clock-mode overlay: the 24-hour ring of cylinders projected on the basemap, the flat centre medallion,
//the ground-laid hour labels, the hover tooltip, and the right-hand metric rail. Transforms that glue an
//element to the rotating ground are written inline per frame from the camera pose; this sheet carries
//only the static appearance.
export const heliosCardEnergyClockCss = css`
    /*  Overlay wrapper holding the whole clock (svg + medallion + labels + tooltip). Full-bleed and inert;
        its absolutely-positioned children share the card's coordinate space. Named so the scene's
        clock-mode fade leaves it (and the right rail) untouched. */
    .clock-overlay
    {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    /*  Screen-space SVG the cylinders paint into each frame. Above the basemap and home prism, below the
        controls; inert so map drag-rotate passes straight through. In day mode this layer holds the STATIC
        producer rings (they never move during a drill). */
    .clock-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 5;
        pointer-events: none;
        overflow: visible;
    }
    /*  Day-mode consumer rings + centre disc, in a 3D card flipper so the drill reveal (controller-driven) pivots
        them around the 0h-12h axis WITHOUT touching the producer rings above. The perspective is scoped to this
        wrapper so it never distorts the ground-laid hour labels' own perspective transforms. */
    .clock-consumers-persp
    {
        position: absolute;
        inset: 0;
        z-index: 5;
        pointer-events: none;
        perspective: 1400px;
    }
    .clock-consumers-flip
    {
        position: absolute;
        inset: 0;
        transform-style: preserve-3d;
        transform-origin: center;   /*  vertical 0h-12h axis  */
        transition: transform 300ms ease;
    }
    .clock-consumers-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: visible;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
    }
    /*  The back face is pre-rotated 180deg: it faces away at rest and toward the viewer once the flipper turns.  */
    .clock-face-back
    {
        transform: rotateY(180deg);
    }
    /*  Centre layer, kept FIXED (like the producer rings) while the consumer rings flip. Drawn BEFORE the consumer
        flipper so it sits BELOW it: the flipping rings pass over the centre disc. */
    .clock-center-layer
    {
        position: absolute;
        inset: 0;
    }
    .clock-center-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: visible;
    }
    /*  Centre content, pinned to the projected disc centre (left/top + --cci-disc set per frame). Holds the Helios
        mark at the top level, the exit button while drilled; the whole thing fades on a drill (content swap). */
    .clock-center-content
    {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 6;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: calc(var(--cci-disc, 40px) * 1.7);
        height: calc(var(--cci-disc, 40px) * 1.7);
        pointer-events: none;
        opacity: 1;
        transition: opacity var(--ha-animation-duration-fast, 200ms) ease;
    }
    /*  Helios mark filling the disc at the top level, in the theme text colour. */
    .clock-center-logo
    {
        display: flex;
        width: calc(var(--cci-disc, 40px) * 1.4);
        height: calc(var(--cci-disc, 40px) * 1.4);
        color: var(--primary-text-color, #e0e0e0);
    }
    .clock-center-logo svg
    {
        width: 100%;
        height: 100%;
    }

    /*  Day-ring centre exit button: shown (and clickable) only while drilled into a group; it returns to the group
        level. A back arrow sits above the group's glyph + name, all inside the central disc. Upright (no tilt). */
    .clock-center-btn
    {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: calc(var(--cci-disc, 40px) * 0.06);
        width: 100%;
        height: 100%;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--primary-text-color, #e0e0e0);
        cursor: pointer;
        pointer-events: none;
        transition: transform 120ms ease;
        -webkit-tap-highlight-color: transparent;
        line-height: 1;
    }
    .clock-center-btn.is-open
    {
        pointer-events: auto;
    }
    .clock-center-btn:hover  { transform: scale(1.06); }
    .clock-center-btn:active { transform: scale(0.97); }
    .clock-center-btn:focus-visible { outline: none; }
    /*  Back-arrow hint on top, muted; the glyph / number carries the group colour below it. */
    .clock-center-btn .cci-back
    {
        --mdc-icon-size: calc(var(--cci-disc, 40px) * 0.4);
        opacity: 0.7;
    }
    .clock-center-btn .cci-glyph
    {
        --mdc-icon-size: calc(var(--cci-disc, 40px) * 0.55);
    }
    .clock-center-btn .cci-num
    {
        font-size: calc(var(--cci-disc, 40px) * 0.55);
        font-weight: var(--ha-font-weight-bold, 700);
        font-variant-numeric: tabular-nums;
    }
    .clock-center-btn .cci-name
    {
        max-width: calc(var(--cci-disc, 40px) * 1.5);
        font-size: calc(var(--cci-disc, 40px) * 0.2);
        font-weight: var(--ha-font-weight-medium, 500);
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /*  Hour labels laid flat on the ground (transform set per frame), outside the ring of cylinders.
        Below the cylinders so foreground columns pass over them. */
    .clock-hour-label
    {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 3;
        transform-origin: center;
        will-change: transform, opacity;
        pointer-events: none;
        font-size: 13px;
        font-weight: var(--ha-font-weight-normal, 400);
        font-variant-numeric: tabular-nums;
        color: var(--primary-text-color);
        white-space: nowrap;
    }

    /*  Compass letters (N / S) laid flat on the ground at the triangle tips. Like the hour labels but bold
        and at full opacity: they never fade with distance, so orientation always reads. */
    .clock-compass-label
    {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 3;
        transform-origin: center;
        will-change: transform;
        pointer-events: none;
        font-size: var(--ha-font-size-l, 16px);
        font-weight: var(--ha-font-weight-bold, 700);
        line-height: 1;
        white-space: nowrap;
    }

    /*  Hover tooltip anchored bottom-left, just above the period band (not under the cursor), so it never
        sits over the dial or the scrub it describes. */
    .clock-tip
    {
        position: absolute;
        left: 8px;
        bottom: calc(36px + 12px);
        /*  Above the top-left mode rail (z 60) so a tall tooltip is never clipped behind the mode buttons. */
        z-index: 70;
        min-width: 120px;
        max-width: calc(100% - 16px);
        box-sizing: border-box;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 8px;
        padding: 6px 10px;
        font-size: var(--ha-font-size-s, 12px);
        line-height: 1.6;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 2px 6px var(--shadow-color, rgba(0, 0, 0, 0.3));
        pointer-events: none;
    }
    .clock-tip-head
    {
        font-weight: 600;
        margin-bottom: 2px;
    }
    .clock-tip-row
    {
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
    }
    .clock-tip-row ha-icon
    {
        --mdc-icon-size: 16px;
        flex: none;
    }
    /*  Group glyph fallback: same 16 px footprint as the icon, tabular number in the group's colour. */
    .clock-tip-row .clock-tip-num
    {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        flex: none;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
    }
    /*  Entity / metric name between the glyph and the value; truncated so a long friendly name can't widen the
        tooltip past its clamp. */
    .clock-tip-name
    {
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 180px;
    }
    /*  Per-entity breakdown row: the value pushed flush right so the column of numbers aligns. */
    .clock-tip-val
    {
        margin-left: auto;
        padding-left: 12px;
        font-variant-numeric: tabular-nums;
    }

    /*  Right-hand metric rail: a single vertical band of stacked filter cells (was a column of separate
        round buttons, which grew too tall with many metrics). One themed plate; each metric is a flush cell,
        divided by a hairline, so up to ~10 filters fit in a compact strip. */
    .overlay-top-right
    {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 60;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        overflow: hidden;
        border-radius: var(--ha-border-radius-lg, 12px);
        background: var(--card-background-color, #ffffff);
        box-shadow: var(--helios-shadow-chip);
        pointer-events: none;
    }
    /*  Each metric is a flush cell inside the band: shorter than the free-standing 40 px circle and square
        (the band clips the outer corners), so the whole strip stays low. */
    .overlay-top-right .overlay-btn
    {
        width: 34px;
        height: 36px;
        border-radius: 0;
    }
    /*  Hairline divider between stacked cells (skipped on the first). */
    .overlay-top-right .overlay-btn + .overlay-btn
    {
        border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
    }
    /*  Idle icon takes the metric's colour so the rail reads like the chips; the active cell fills with
        that same colour (also on hover/active, overriding the shared --primary-color states). */
    .overlay-top-right .overlay-btn ha-icon
    {
        --mdc-icon-size: 20px;
        color: var(--clock-btn-color, var(--primary-text-color, #212121));
    }
    /*  Group number fallback in the rail cell: same footprint and colour as the icon. */
    .overlay-top-right .overlay-btn .overlay-btn-num
    {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--clock-btn-color, var(--primary-text-color, #212121));
    }
    .overlay-top-right .overlay-btn.is-on .overlay-btn-num
    {
        color: var(--text-on-primary-color, #ffffff);
    }
    .overlay-top-right .overlay-btn.is-on,
    .overlay-top-right .overlay-btn.is-on:hover,
    .overlay-top-right .overlay-btn.is-on:active
    {
        background: var(--clock-btn-color, var(--primary-color, #03a9f4));
    }
    .overlay-top-right .overlay-btn.is-on ha-icon
    {
        color: var(--text-on-primary-color, #ffffff);
    }
`;
