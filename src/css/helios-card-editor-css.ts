import { css } from 'lit';

//Visual styles for the card configuration editor. Kept in its own
//file (separate from the runtime card's helios-card-css.ts) so a
//styling change to the editor never accidentally affects the card
//rendered on the dashboard, and vice versa. The two surfaces live
//in distinct Shadow DOM trees and share zero selectors, so the
//split is purely organisational, not functional.
//
//Single export: `editorStyles`, applied to the <helios-card-editor>
//root element that hosts the whole config UI.


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

    /*  Subsection heading inside an already-collapsible block. One
        notch quieter than .section-title (no border, dimmer colour)
        so users read it as "still inside the parent section, this
        is just a logical group". Used for the LiDAR View knobs
        nested in the Shading section. */
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

    /*  Collapsible section. Uses native <details>/<summary> so the
        open/closed state needs no JS plumbing and survives keyboard
        navigation for free. The default disclosure triangle is
        replaced by a custom chevron via ::before so the summary
        row visually matches a regular .section-title heading with a
        single rotating glyph that signals expandability.

        Extra margin-top between sibling sections so they read as
        distinct blocks even when several are collapsed in a row.
        The first child of the editor gets no margin (the editor
        container handles its own top padding).                     */
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
    /*  Per-section icon, sits between the chevron and the label so each accordion row reads at a glance. Inherits the
        section title's primary-colour tint and shrinks to match the title's vertical rhythm without overpowering it. */
    .section-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        margin-right: 2px;
        flex-shrink: 0;
    }

    /*  Vertical rhythm: a positive top margin pushes the help
        visibly away from its field above, and a generous bottom
        margin creates a clear break before the next field. Both
        stack with the section's 14 px flex gap, giving:
          field → help        = gap + top    = 14 + 8  = 22 px
          help  → next field  = gap + bottom = 14 + 20 = 34 px
        Hierarchy ratio 1.5×, both spacings comfortable to read.   */
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

    /*  Extra breathing room between two consecutive fields with no
        help text between them (e.g. the Location lat/lon pair or
        the Local LiDAR bbox quartet). Without it the rows visually
        touch because the section flex gap alone is too tight. The
        selector only fires when both siblings are .field, so cases
        with a .hint or .field-help between still rely on the
        help's own margins.                                          */
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

    /*  Native dropdown reused for any setting with 3+ options whose
        labels can't fit a horizontal segmented toggle without
        cropping across languages. Same width budget as the text
        inputs so right-edge alignment matches the rest of the
        editor. The browser's native chevron + dropdown menu is
        kept on purpose: it's the most familiar control on every
        HA frontend (desktop, mobile, iframe). */
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

    /*  Two-button toggle, sized to match the other inputs so
        the right-edge alignment stays consistent across fields. */
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

    /*  Slider variant, replaces type="number" inputs so the
        user can never enter a value outside the supported range.
        The matching value is shown to the right of the track. */
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

    /*  Breathing room under the entity picker row in every grid slot
        (combined, import, export) so the invert toggle / "add source"
        button does not crowd the dropdown. */
    .grid-source-row
    {
        margin-bottom: 12px;
    }

    /*  Reset section: warning text stacked ABOVE the button so the
        user reads the destructive-action explanation before
        reaching the click target. The button itself is
        right-aligned (display:block + margin-left:auto), matching
        the +Add row affordance pattern used in the PV arrays
        section so the editor's bottom-of-section action buttons
        all live in the same screen position. Destructive red
        border + label so the colour reinforces the "this empties
        data" message even at a glance. */
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

    /*  About section pinned at the very bottom of the editor.
        Compact rows for the version + links + appreciation line,
        styled as a "credits panel" rather than another config
        section so the user reads it as a soft footer.              */
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
    /*  Identity rows. Every row uses the same label-left, content-right layout the version row
        established: flex layout with the label squeezed left + the value or link pushed right.
        about-row already has the base flex container; the per-content variants below tune the
        right-side style (link, plain value, version chip). */
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
    /*  X brand mark: inline SVG so the post-rebrand glyph renders properly (mdi:twitter would
        mis-label the platform). Sized to match the ha-icon glyphs in adjacent rows. */
    .about-row-svg
    {
        width:  18px;
        height: 18px;
        flex-shrink: 0;
    }
    /*  Version chip: HA frontend body font, bold, primary text colour, decorated as a link (the
        anchor jumps to the matching GitHub release page). */
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
    /*  BMC button styled to match the reset-btn shape (transparent fill,
        1px border, compact padding, right-aligned via margin-left: auto)
        but in BMC yellow so the brand colour still reads even though the
        fill is gone. Same hover bloom pattern as reset-btn for visual
        consistency across the editor's outline buttons.                */
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
