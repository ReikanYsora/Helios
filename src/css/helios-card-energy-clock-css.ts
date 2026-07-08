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
        controls; inert so map drag-rotate passes straight through. */
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

    /*  Right-hand metric rail: a dynamic list of clickable chips that retargets the clock. Mirrors the
        top-left rail; only configured metrics render. */
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
        that same colour, overriding the shared --primary-color fill. */
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
`;
