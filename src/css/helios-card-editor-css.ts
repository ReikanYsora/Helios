import { css } from 'lit';

//Styles for the config editor, separate from the runtime card's sheet so editor and card never share
//selectors. Single export: `editorStyles`, applied to <helios-card-editor>. Sizes/radii/weights/danger
//colour route through HA tokens (with the prior literal as fallback) so the editor tracks the active theme.

export const editorStyles = css`
    .editor
    {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-title
    {
        font-size: var(--ha-font-size-s, 12px);
        font-weight: var(--ha-font-weight-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--primary-color, #03a9f4);
        margin-top: 10px;
        padding-bottom: 4px;
        border-bottom: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
    }

    /*  Collapsible section. Native <details>/<summary> so open/closed state needs no JS and is
        keyboard-accessible. Default triangle replaced by a custom ::before chevron so the row matches a
        .section-title heading. margin-top separates siblings; first child gets none (editor pads its
        own top). */
    details.advanced-section
    {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 24px;
    }
    details.advanced-section:first-child { margin-top: 0; }
    details.advanced-section > summary
    {
        list-style: none;
        cursor: pointer;
        user-select: none;
    }
    details.advanced-section > summary::-webkit-details-marker { display: none; }
    details.advanced-section > summary.section-title-collapse
    {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: var(--ha-font-weight-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--primary-color, #03a9f4);
        padding-bottom: 6px;
        border-bottom: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.18));
    }
    details.advanced-section > summary.section-title-collapse::before
    {
        content: '▸';
        display: inline-block;
        font-size: 10px;
        line-height: 1;
        transition: transform 120ms ease-out;
    }
    details.advanced-section[open] > summary.section-title-collapse::before
    {
        transform: rotate(90deg);
    }
    /*  Per-section icon between the chevron and label; inherits the section title's tint. */
    .section-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        margin-right: 2px;
        flex-shrink: 0;
    }

    /*  Help-text margins stack with the section's 14 px flex gap: field-to-help 22 px, help-to-next-field
        34 px (1.5x ratio), so the help reads as attached to the field above it. .hint adds italics. */

    /*  Measured-only status lines (one per configured energy family). */
    .live-status
    {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin: 6px 0;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
    }
    .live-status ha-icon
    {
        --mdc-icon-size: 18px;
        flex: none;
        margin-top: 1px;
    }
    .live-status.is-ok ha-icon   { color: var(--success-color, #4caf50); }
    .live-status.is-warn ha-icon { color: var(--warning-color, #ff9800); }
    .live-status.is-info ha-icon { color: var(--secondary-text-color, #727272); }

    .field-help,
    .hint
    {
        font-size: var(--ha-font-size-xs, 11px);
        color: var(--secondary-text-color, #727272);
        margin: 8px 0 20px 0;
    }
    .hint { font-style: italic; }

    .field-help a       { color: var(--primary-color, #03a9f4); text-decoration: none; }
    .field-help a:hover { text-decoration: underline; }
    .hint a
    {
        color: var(--primary-color, #03a9f4);
        text-decoration: none;
        font-style: normal;
        font-weight: var(--ha-font-weight-medium, 500);
    }
    .hint a:hover { text-decoration: underline; }

    .field
    {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        position: relative;
    }

    /*  Extra gap between two consecutive fields with no help text between them (e.g. the lat/lon pair).
        Only fires when both siblings are .field, so help-separated rows are unaffected. */
    .field + .field
    {
        margin-top: 8px;
    }

    /*  Stacked variant for controls too wide to share a row with their label (e.g. ha-entity-picker). */
    .field.field-block
    {
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
    }

    .field.field-block .label             { flex: none; }
    .field.field-block ha-entity-picker   { width: 100%; }

    .label
    {
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
        flex: 1;
    }

    input[type="number"]
    {
        width: 180px;
        padding: 6px 8px;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
        border-radius: var(--ha-border-radius-sm, 4px);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: var(--ha-font-size-s, 13px);
    }

    /*  Two-button toggle, sized to match the other inputs for right-edge alignment. */
    .segmented-toggle
    {
        display: inline-flex;
        width: 180px;
        border-radius: var(--ha-border-radius-md, 6px);
        overflow: hidden;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
        background: var(--card-background-color, #fff);
    }

    .seg-option
    {
        flex: 1;
        padding: 7px 10px;
        background: transparent;
        color: var(--primary-text-color, #212121);
        border: none;
        cursor: pointer;
        font-size: var(--ha-font-size-s, 13px);
        font-family: inherit;
        transition: background 0.15s, color 0.15s;
    }

    .seg-option + .seg-option
    {
        border-left: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
    }

    .seg-option:hover:not(.active)
    {
        background: var(--secondary-background-color, rgba(0,0,0,0.04));
    }

    .seg-option.active
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-primary-color, #fff);
    }

    /*  Slider variant for ranged values so an out-of-range number can't be entered. Value shown right of
        the track. */
    .slider-row
    {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: 180px;
    }

    .slider-row input[type="range"]
    {
        flex: 1;
        min-width: 0;
        accent-color: var(--primary-color, #03a9f4);
    }

    .slider-value
    {
        font-variant-numeric: tabular-nums;
        font-size: var(--ha-font-size-s, 12px);
        color: var(--secondary-text-color, #727272);
        min-width: 44px;
        text-align: right;
    }

    /*  Reset section: warning stacked above the button so the destructive-action explanation is read
        before the click target. Button right-aligned to match the +Add affordance; danger border + label
        reinforces "this empties data". */
    .reset-warning
    {
        font-size: var(--ha-font-size-xs, 11px);
        line-height: 1.4;
        color: var(--secondary-text-color, #5f6368);
        opacity: 0.85;
        margin-bottom: 8px;
    }
    .reset-btn
    {
        background: transparent;
        border: var(--ha-border-width-sm, 1px) solid var(--error-color, #ef4444);
        color: var(--error-color, #ef4444);
        border-radius: var(--ha-border-radius-sm, 4px);
        padding: 4px 10px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        display: block;
        margin-left: auto;
        margin-top: 8px;
        width: fit-content;
    }
    .reset-btn:hover
    {
        background: color-mix(in srgb, var(--error-color, #ef4444) 8%, transparent);
    }
    .reset-btn:focus-visible
    {
        outline: 2px solid var(--error-color, #ef4444);
        outline-offset: 2px;
    }

    /*  About section pinned at the editor bottom. Compact rows styled as a soft credits footer, not a
        config section. */
    .about-row
    {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 4px 0;
    }
    .about-row + .about-row { padding-top: 4px; }
    .about-row:first-of-type { padding-top: 8px; }
    .about-label
    {
        font-weight: var(--ha-font-weight-medium, 500);
        color: var(--secondary-text-color, #71717a);
        font-size: var(--ha-font-size-s, 13px);
    }
    /*  Identity rows: label-left, content-right (from about-row's flex container); variants below tune the
        right side (link, plain value, version chip). */
    .about-row-value
    {
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, inherit));
        font-size: var(--ha-font-size-m, 14px);
        font-weight: var(--ha-font-weight-medium, 500);
        color: var(--primary-text-color, #18181b);
        text-align: right;
    }
    .about-row-link
    {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, inherit));
        font-size: var(--ha-font-size-m, 14px);
        font-weight: var(--ha-font-weight-medium, 500);
        color: var(--primary-color, #3b82f6);
        text-decoration: none;
    }
    .about-row-link:hover { text-decoration: underline; }
    .about-row-link ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
    }
    /*  X brand mark: inline SVG (mdi:twitter mis-labels the platform). Sized to match adjacent ha-icon
        glyphs. */
    .about-row-svg
    {
        width:  18px;
        height: 18px;
        flex-shrink: 0;
    }
    /*  Version chip styled as a link to the matching GitHub release page. */
    .about-version-link
    {
        font-weight: var(--ha-font-weight-bold, 700);
        color: var(--primary-text-color, #18181b);
    }
    .about-version-link:hover { text-decoration: underline; }
    .about-block
    {
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .about-link
    {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: var(--primary-color, #3b82f6);
        font-size: var(--ha-font-size-m, 14px);
        font-weight: var(--ha-font-weight-medium, 500);
        padding: 6px 0;
    }
    .about-link:hover { text-decoration: underline; }
    .about-link ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
    }
    .about-paragraph
    {
        margin: 0;
        font-size: var(--ha-font-size-s, 13px);
        line-height: 1.45;
        color: var(--secondary-text-color, #52525b);
    }
    .about-coffee
    {
        margin-top: 18px;
        padding-top: 14px;
        border-top: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    /*  BMC button: same outline shape and hover bloom as reset-btn, in Buy Me a Coffee brand yellow
        (kept literal: it's an external brand colour, not a themeable surface). */
    .about-coffee-link
    {
        margin-top: 8px;
        background: transparent;
        border: var(--ha-border-width-sm, 1px) solid #ffcc00;
        color: #ffcc00;
        border-radius: var(--ha-border-radius-sm, 4px);
        padding: 4px 10px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        align-self: flex-end;
        margin-left: auto;
        width: fit-content;
    }
    .about-coffee-link:hover
    {
        background: rgba(255, 204, 0, 0.08);
        text-decoration: none;
    }
    .about-coffee-link:focus-visible
    {
        outline: 2px solid #ffcc00;
        outline-offset: 2px;
    }
`;
