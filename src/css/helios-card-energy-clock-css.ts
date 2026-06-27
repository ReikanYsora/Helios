import { css } from 'lit';

//Clock-mode overlay: the 24-hour ring of cylinders projected on the basemap, the flat centre medallion,
//the ground-laid hour labels, the hover tooltip, and the right-hand metric rail. Every transform that
//glues an element to the rotating ground (medallion, labels) is written inline per frame from the camera
//pose; this sheet carries only the static appearance.
export const heliosCardEnergyClockCss = css`
    /*  Overlay wrapper that holds the whole clock (svg + medallion + labels + tooltip). Full-bleed and
        inert; its absolutely-positioned children share the card's coordinate space. Named so the scene's
        clock-mode fade leaves it (and the right rail) untouched. */
    .clock-overlay
    {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    /*  Screen-space SVG the cylinders paint into each frame (innerHTML set imperatively). Sits above the
        basemap AND the home prism, below the controls; inert so map drag-rotate passes straight through. */
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
        font-size: var(--ha-font-size-l, 16px);
        font-weight: var(--ha-font-weight-medium, 500);
        font-variant-numeric: tabular-nums;
        color: var(--primary-text-color);
        white-space: nowrap;
    }

    /*  Compass letters (N / S) laid flat on the ground at the triangle tips. Like the hour labels but bold
        and at full opacity — they never fade with distance, so the orientation always reads. */
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

    /*  Hover tooltip; left/top set inline to the cursor, then clamped inside the card. */
    /*  Anchored bottom-left, just above the period band — NOT under the cursor — so it never sits over the
        dial or the scrub it describes. */
    .clock-tip
    {
        position: absolute;
        left: 8px;
        bottom: calc(var(--tb-band-h, 36px) + 12px);
        z-index: 14;
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
    .clock-tip-total
    {
        font-weight: 600;
        margin-top: 4px;
        padding-top: 4px;
        border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    /*  Forecast (not-yet-measured) hours: italic to echo the transparent cylinders. */
    .clock-tip.is-predicted
    {
        font-style: italic;
    }

    /*  Right-hand metric rail: the dynamic list of clickable chips that retargets the clock. Mirrors the
        top-left rail; only configured metrics render, stacked with no gaps. */
    .overlay-top-right
    {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 60;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        pointer-events: none;
    }
    /*  Idle icon takes the metric's colour so the rail reads like the chips; the active button fills with
        that same colour (overriding the shared --primary-color fill). */
    .overlay-top-right .overlay-btn ha-icon
    {
        color: var(--clock-btn-color, var(--primary-text-color, #212121));
    }
    .overlay-top-right .overlay-btn.is-on
    {
        background: var(--clock-btn-color, var(--primary-color, #03a9f4));
    }
    .overlay-top-right .overlay-btn.is-on ha-icon
    {
        color: var(--text-on-primary-color, #ffffff);
    }

    /*  Rail row that pairs the Clock mode button with the sub-mode toggle, side by side. */
    .overlay-top-left .rail-row
    {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
    }
    /*  Sub-mode toggle: a pill with a sliding circular knob, the SAME height as the 40 px rail buttons it
        sits beside. Left = histogram, right = area curve; the knob slides under the active side and that
        icon brightens onto it. */
    .clock-submode
    {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 40px;
        box-sizing: border-box;
        padding: 6px;
        border-radius: 999px;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        box-shadow: 0 1px 3px var(--shadow-color, rgba(0, 0, 0, 0.2));
        cursor: pointer;
        pointer-events: auto;
        user-select: none;
    }
    .clock-submode .cs-knob
    {
        position: absolute;
        top: 6px;
        left: 6px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--primary-color, #03a9f4);
        transition: transform var(--ha-animation-duration-fast, 150ms) ease;
    }
    /*  Knob sits over histogram (left) by default; slides one slot (icon width + gap) right for area. */
    .clock-submode.mode-area .cs-knob
    {
        transform: translateX(32px);
    }
    .clock-submode .cs-opt
    {
        position: relative;
        z-index: 1;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color, #727272);
        transition: color var(--ha-animation-duration-fast, 150ms) ease;
    }
    /*  The active side's icon reads on the knob fill. */
    .clock-submode.mode-histogram .cs-histogram,
    .clock-submode.mode-area .cs-area
    {
        color: var(--text-on-primary-color, #ffffff);
    }
`;
