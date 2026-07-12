import { css } from 'lit';

//Energy Fingerprint styling. The chassis is a stock Home Assistant card: ha-card supplies the border, radius,
//background and shadow, and every colour, spacing and font here routes through HA design tokens so the card is
//indistinguishable from a native Energy dashboard card, in any theme.
export const fingerprintStyles = css`
    /*  A minimum height equal to ~6 grid rows (the card's min_rows), tracking HA's section row metrics, so Lovelace
        "auto height" resolves to a legible card instead of collapsing the charts to nothing. */
    :host
    {
        display: block;
        height: 100%;
        min-height: calc(6 * (var(--row-height, 56px) + var(--row-gap, 8px)) - var(--row-gap, 8px));
    }

    /*  The card fills its Lovelace grid cell so the heatmap can grow/shrink with the drag handles. */
    ha-card
    {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    /*  Standard HA card header: title on the left, the week navigator on the right. */
    .fp-header
    {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 16px 8px;
    }
    .fp-title
    {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--ha-card-header-font-size, 24px);
        font-weight: var(--ha-font-weight-normal, 400);
        line-height: var(--ha-line-height-condensed, 1.2);
        color: var(--ha-card-header-color, var(--primary-text-color, #212121));
        letter-spacing: -0.012em;
    }

    /*  Week navigator: previous / range / next inside a bordered pill, matching HA's own date-range selector. */
    .fp-nav
    {
        flex: none;
        display: inline-flex;
        align-items: stretch;
        height: 36px;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: var(--ha-border-radius-md, 10px);
        overflow: hidden;
        background: var(--card-background-color, #fff);
    }
    .fp-week
    {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 96px;
        padding: 0 4px;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .fp-nav-btn
    {
        appearance: none;
        border: 0;
        background: transparent;
        width: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: inherit;
        font-size: 20px;
        line-height: 1;
        color: var(--secondary-text-color, #727272);
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }
    .fp-nav-btn:first-child  { border-right: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12)); }
    .fp-nav-btn:last-child   { border-left:  var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12)); }
    .fp-nav-btn:hover:not(:disabled)
    {
        background: var(--divider-color, rgba(0, 0, 0, 0.08));
        color: var(--primary-text-color, #212121);
    }
    .fp-nav-btn:disabled { opacity: 0.3; cursor: default; }

    .fp-body
    {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding: 4px 16px 16px;
    }

    .fp-empty
    {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px 4px;
        color: var(--secondary-text-color, #727272);
        font-size: var(--ha-font-size-m, 14px);
        text-align: center;
    }

    /*  Heatmap wrapper: fills the body above the detail chart, positioning context for the hover tooltip + lift. */
    .fp-grid
    {
        flex: 1;
        min-height: 0;
        position: relative;
        width: 100%;
    }

    .fp-svg
    {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
    }

    /*  Row (day) + column (hour) labels: fixed pixel size (the viewBox is 1:1 with the box), theme secondary text. */
    .fp-ylabel,
    .fp-xlabel
    {
        fill: var(--secondary-text-color, #727272);
        font-family: var(--ha-font-family-body, inherit);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
    }
    /*  Day labels are tappable (open the detail chart); the selected day is highlighted. */
    .fp-ylabel { cursor: pointer; }
    .fp-ylabel.is-on { fill: var(--primary-text-color, #212121); font-weight: var(--ha-font-weight-medium, 500); }

    /*  Hover feedback: a quiet ring around the focused cell, sized to it exactly. No scale or shadow (those read
        as a control); just enough to say "this is the slot you are reading". Never intercepts the pointer. */
    .fp-hl
    {
        position: absolute;
        z-index: 1;
        pointer-events: none;
        border-radius: 2px;
        box-shadow: inset 0 0 0 1.5px var(--primary-text-color, #212121);
        opacity: 0.55;
    }

    /*  Hover tooltip: the HA popover recipe (card surface, hairline border, soft shadow), anchored to the cursor. */
    .fp-tip
    {
        position: absolute;
        transform: translate(12px, -50%);
        z-index: 3;
        pointer-events: none;
        width: max-content;
        max-width: 240px;
        padding: 8px 10px;
        border-radius: var(--ha-border-radius-md, 8px);
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
        background: var(--card-background-color, #fff);
        box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.2));
        color: var(--primary-text-color, #212121);
        font-size: var(--ha-font-size-s, 13px);
    }
    /*  Near the right edge, flip the tooltip to the cursor's left so it never spills off the card. */
    .fp-tip.is-left { transform: translate(calc(-100% - 12px), -50%); }
    .fp-tip-head
    {
        font-weight: var(--ha-font-weight-medium, 500);
        margin-bottom: 4px;
        white-space: nowrap;
    }
    .fp-tip-row,
    .fp-tip-src
    {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        white-space: nowrap;
        color: var(--secondary-text-color, #727272);
    }
    .fp-tip-row span:last-child,
    .fp-tip-src span:last-child
    {
        color: var(--primary-text-color, #212121);
        font-variant-numeric: tabular-nums;
    }
    /*  The consumption total sits above the per-source breakdown, separated by a hairline. */
    .fp-tip-total
    {
        margin-bottom: 4px;
        padding-bottom: 4px;
        border-bottom: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .fp-tip-total span:first-child { color: var(--primary-text-color, #212121); font-weight: var(--ha-font-weight-medium, 500); }
    .fp-tip-src span:first-child { display: inline-flex; align-items: center; }
    /*  Source swatch: same colours as the day-chart curves, so the tooltip breakdown reads against them. */
    .fp-sdot
    {
        width: 8px;
        height: 8px;
        border-radius: 2px;
        margin-right: 6px;
        flex: none;
    }
    .fp-sdot-imp { background: var(--energy-grid-consumption-color, var(--primary-color, #488fc2)); }
    .fp-sdot-sol { background: var(--energy-solar-color, var(--warning-color, #ff9800)); }
    .fp-sdot-bat { background: var(--energy-battery-out-color, #4db6ac); }
    /*  Exported / sold row: split off from the consumption sources by a hairline (it is production, not draw). */
    .fp-tip-export
    {
        margin-top: 4px;
        padding-top: 4px;
        border-top: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .fp-tip-export span:first-child { color: var(--secondary-text-color, #727272); }

    /*  Day-detail chart under the grid: the picked day's profile as HA-style curves, only the loss band filled.
        It takes the same share of the card as the heatmap (both flex:1) so the curves have room to be read. */
    .fp-detail
    {
        flex: 1;
        min-height: 0;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        margin-top: 12px;
        padding-top: 10px;
        border-top: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .fp-detail.is-empty
    {
        align-items: center;
        justify-content: center;
        color: var(--secondary-text-color, #727272);
        font-size: var(--ha-font-size-s, 13px);
    }
    .fp-detail-head
    {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 4px;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
    }
    .fp-detail-day
    {
        font-weight: var(--ha-font-weight-medium, 500);
        text-transform: capitalize;
        white-space: nowrap;
    }
    /*  Legend under the chart, a faithful copy of Home Assistant's own chart legend: a wrapping, centered row of
        toggle icon + label, each item 24px tall. Clicking either hides/shows that curve; a hidden series greys out. */
    .fp-detail-legend
    {
        flex: none;
        padding: 8px 0 0;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
    }
    .fp-detail-legend ul
    {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: var(--ha-space-2, 8px);
    }
    .fp-detail-legend li
    {
        height: 24px;
        display: inline-flex;
        align-items: center;
        padding: 0 2px;
        box-sizing: border-box;
    }
    .fp-detail-legend .hidden { color: var(--secondary-text-color, #727272); }
    .fp-detail-legend .label
    {
        background: none;
        border: none;
        padding: 0;
        margin: 0;
        font: inherit;
        color: inherit;
        cursor: pointer;
        white-space: nowrap;
        line-height: var(--ha-line-height-condensed, 1.2);
    }
    .fp-detail-legend .legend-toggle
    {
        background: none;
        border: none;
        color: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 4px;
        margin: -4px 0 -4px -4px;
    }
    .fp-detail-legend .legend-toggle ha-svg-icon { --mdc-icon-size: 18px; width: 18px; height: 18px; }
    @media (hover: hover)
    {
        .fp-detail-legend .label:hover { text-decoration: underline; }
        .fp-detail-legend .legend-toggle:hover { opacity: 0.7; }
    }
    /*  Dismiss the day detail: a centered icon button. */
    .fp-detail-close
    {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--secondary-text-color, #727272);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        margin: -4px -6px -4px 0;
        border-radius: var(--ha-border-radius-circle, 50%);
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }
    .fp-detail-close ha-svg-icon { --mdc-icon-size: 18px; width: 18px; height: 18px; }
    .fp-detail-close:hover { background: var(--divider-color, rgba(0, 0, 0, 0.08)); color: var(--primary-text-color, #212121); }

    /*  Scrub time readout: the hovered 15-minute slot, styled like the tooltip of HA's own chart cards (card
        surface, divider hairline, 12px text, soft shadow), following the cursor. */
    .fp-time
    {
        position: absolute;
        top: 0;
        transform: translateX(-50%);
        z-index: 3;
        pointer-events: none;
        padding: 4px 8px;
        border-radius: var(--ha-border-radius-sm, 4px);
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: 12px;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    /*  Chart area: positioning context for the scrub cursor + beams; the svg fills it. */
    .fp-chart
    {
        position: relative;
        flex: 1;
        min-height: 0;
        touch-action: none;
    }
    .fp-detail-svg
    {
        display: block;
        width: 100%;
        height: 100%;
    }
    /*  Curves mirror HA's built-in graph cards: 2px lines at 0.8 opacity; only the loss band is filled. */
    .fp-line-cons { fill: none; stroke: var(--primary-text-color, #212121); opacity: 0.8; }
    .fp-line-imp  { fill: none; stroke: var(--energy-grid-consumption-color, var(--primary-color, #488fc2)); opacity: 0.8; }
    .fp-line-sol  { fill: none; stroke: var(--energy-solar-color, var(--warning-color, #ff9800)); opacity: 0.8; }
    /*  Battery net flow, dashed so it never competes with the live curves, in the HA battery colours the user
        already knows: discharge (out) above the zero line, charge (in) below it. */
    .fp-line-bat-out { fill: none; stroke: var(--energy-battery-out-color, #4db6ac); opacity: 0.9; stroke-dasharray: 4 3; }
    .fp-line-bat-in  { fill: none; stroke: var(--energy-battery-in-color, #f06292);  opacity: 0.9; stroke-dasharray: 4 3; }
    /*  Value-axis gridlines, the background of HA's own chart cards (divider colour, thin, horizontal only). */
    .fp-grid-line { stroke: var(--divider-color, rgba(127, 127, 127, 0.2)); stroke-width: 1; }
    /*  Value labels facing each gridline, right-aligned in the left gutter (the MARGIN_L the chart is inset by). */
    .fp-yval
    {
        position: absolute;
        left: -6px;
        transform: translate(-100%, -50%);
        pointer-events: none;
        white-space: nowrap;
        font-size: 10px;
        line-height: 1;
        color: var(--secondary-text-color, #727272);
        font-variant-numeric: tabular-nums;
    }
    /*  Zero baseline for the signed battery axis, a touch stronger than the gridlines. */
    .fp-zero      { stroke: var(--divider-color, rgba(127, 127, 127, 0.3)); stroke-width: 1; opacity: 0.9; }
    /*  Exported solar (neither used nor stored). Framed to inform, not to blame: HA's own grid-return colour when it
        just left the house (an opportunity to self-consume more), a calm positive tone when it is actually sold
        back. Never the alarm red of an error, never the "all good" gold of solar. */
    .fp-area-export { fill: var(--energy-grid-return-color, #8353d1); fill-opacity: 0.22; stroke: none; }
    .fp-area-sold   { fill: var(--success-color, #4caf50); fill-opacity: 0.20; stroke: none; }

    /*  Scrub cursor: a dashed vertical line in the HA info colour (matching the axis pointer of HA's chart cards),
        with a beam riding each curve and the linked heatmap cell lit above. */
    .fp-cursor
    {
        position: absolute;
        top: 0;
        width: 0;
        border-left: 1px dashed var(--info-color, #039be5);
        transform: translateX(-0.5px);
        pointer-events: none;
    }
    .fp-beam
    {
        position: absolute;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 0 2px var(--card-background-color, #fff);
        pointer-events: none;
    }
    .fp-beam-cons    { background: var(--primary-text-color, #212121); }
    .fp-beam-imp     { background: var(--energy-grid-consumption-color, var(--primary-color, #488fc2)); }
    .fp-beam-sol     { background: var(--energy-solar-color, var(--warning-color, #ff9800)); }
    .fp-beam-bat-out { background: var(--energy-battery-out-color, #4db6ac); }
    .fp-beam-bat-in  { background: var(--energy-battery-in-color, #f06292); }
`;
