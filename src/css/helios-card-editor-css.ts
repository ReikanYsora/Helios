import { css } from 'lit';

//Styles for the config editor. Kept separate from the runtime card's
//helios-card-css.ts so editor and card never share selectors.
//Single export: `editorStyles`, applied to <helios-card-editor>.


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
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--primary-color, #03a9f4);
        margin-top: 10px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12));
    }

    /*  Subsection heading inside a collapsible block. Quieter than
        .section-title (no border, dimmer) so it reads as a logical
        group still inside the parent section. */
    .subsection-title
    {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--secondary-text-color, #6c757d);
        margin-top: 16px;
        margin-bottom: 4px;
    }

    /*  Collapsible section. Native <details>/<summary> so open/closed
        state needs no JS and is keyboard-accessible. Default triangle
        replaced by a custom ::before chevron so the row matches a
        .section-title heading. Extra margin-top separates siblings;
        first child gets none (editor handles its own top padding). */
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
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--primary-color, #03a9f4);
        padding-bottom: 6px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.18));
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
    /*  Per-section icon between the chevron and label. Inherits the
        section title's tint, sized to match the title's rhythm. */
    .section-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        margin-right: 2px;
        flex-shrink: 0;
    }

    /*  Help text margins stack with the section's 14 px flex gap:
        field→help = 22 px, help→next field = 34 px (1.5x ratio), so
        the help reads as attached to the field above it. */
    .field-help
    {
        font-size: 11px;
        color: var(--secondary-text-color, #727272);
        margin: 8px 0 20px 0;
    }

    .field-help a       { color: var(--primary-color, #03a9f4); text-decoration: none; }
    .field-help a:hover { text-decoration: underline; }

    .hint
    {
        font-size: 11px;
        color: var(--secondary-text-color, #727272);
        font-style: italic;
        margin: 8px 0 20px 0;
    }
    .hint a
    {
        color: var(--primary-color, #03a9f4);
        text-decoration: none;
        font-style: normal;
        font-weight: 500;
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

    /*  Extra gap between two consecutive fields with no help text
        between them (e.g. the lat/lon pair). Only fires when both
        siblings are .field, so help-separated rows are unaffected. */
    .field + .field
    {
        margin-top: 8px;
    }

    /*  Stacked variant for controls too wide to share a row with
        their label (e.g. ha-entity-picker). */
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
        font-size: 13px;
        color: var(--primary-text-color, #212121);
        flex: 1;
    }

    input[type="text"],
    input[type="number"]
    {
        width: 180px;
        padding: 6px 8px;
        border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
        border-radius: 4px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: 13px;
    }

    /*  Native dropdown for settings with 3+ options that won't fit a
        segmented toggle across languages. Same width as the text
        inputs for right-edge alignment; native chevron kept on
        purpose as the most familiar control across HA frontends. */
    .he-select
    {
        width: 180px;
        padding: 6px 8px;
        border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
        border-radius: 4px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: 13px;
    }

    /*  Two-button toggle, sized to match the other inputs for
        consistent right-edge alignment. */
    .segmented-toggle
    {
        display: inline-flex;
        width: 180px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
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
        font-size: 13px;
        font-family: inherit;
        transition: background 0.15s, color 0.15s;
    }

    .seg-option + .seg-option
    {
        border-left: 1px solid var(--divider-color, rgba(0,0,0,0.12));
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

    /*  Slider variant replacing number inputs so a value out of the
        supported range can't be entered. Value shown right of track. */
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
        font-size: 12px;
        color: var(--secondary-text-color, #727272);
        min-width: 44px;
        text-align: right;
    }

    code
    {
        font-family: monospace;
        background: var(--secondary-background-color, rgba(0,0,0,0.05));
        padding: 1px 4px;
        border-radius: 3px;
    }

    /*  Gap under the entity picker row in each grid slot so the
        invert toggle / add-source button doesn't crowd the dropdown. */
    .grid-source-row
    {
        margin-bottom: 12px;
    }

    /*  Reset section: warning stacked above the button so the
        destructive-action explanation is read before the click
        target. Button right-aligned to match the +Add affordance.
        Red border + label reinforces "this empties data". */
    .reset-warning
    {
        font-size: 11px;
        line-height: 1.4;
        color: var(--secondary-text-color, #5f6368);
        opacity: 0.85;
        margin-bottom: 8px;
    }
    .reset-btn
    {
        background: transparent;
        border: 1px solid #ef4444;
        color: #ef4444;
        border-radius: 4px;
        padding: 4px 10px;
        font-size: 12px;
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
        background: rgba(239, 68, 68, 0.08);
    }
    .reset-btn:focus-visible
    {
        outline: 2px solid #ef4444;
        outline-offset: 2px;
    }

    /*  About section pinned at the bottom of the editor. Compact
        rows styled as a soft credits-panel footer, not a config
        section. */
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
        font-weight: 500;
        color: var(--secondary-text-color, #71717a);
        font-size: 13px;
    }
    .about-value
    {
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
        font-size: 13px;
        color: var(--primary-text-color, #18181b);
    }
    /*  Identity rows. Label-left, content-right layout (from about-row's
        flex container); variants below tune the right side (link, plain
        value, version chip). */
    .about-row-value
    {
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, inherit));
        font-size: 14px;
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
        font-size: 14px;
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
    /*  X brand mark: inline SVG (mdi:twitter would mis-label the
        post-rebrand platform). Sized to match adjacent ha-icon glyphs. */
    .about-row-svg
    {
        width:  18px;
        height: 18px;
        flex-shrink: 0;
    }
    /*  Version chip styled as a link jumping to the matching GitHub
        release page. */
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
        font-size: 14px;
        font-weight: 500;
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
        font-size: 13px;
        line-height: 1.45;
        color: var(--secondary-text-color, #52525b);
    }
    .about-coffee
    {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    /*  BMC button: same outline shape as reset-btn but in BMC yellow,
        with the same hover bloom for consistency. */
    .about-coffee-link
    {
        margin-top: 8px;
        background: transparent;
        border: 1px solid #ffcc00;
        color: #ffcc00;
        border-radius: 4px;
        padding: 4px 10px;
        font-size: 12px;
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
