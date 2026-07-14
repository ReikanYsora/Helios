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
        align-items: center;
        gap: 8px;
        margin: 6px 0;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
    }
    .live-status ha-icon
    {
        --mdc-icon-size: 18px;
        flex: none;
    }
    .live-status.is-ok ha-icon   { color: var(--success-color, #4caf50); }
    .live-status.is-warn ha-icon { color: var(--warning-color, #ff9800); }
    .live-status.is-info ha-icon { color: var(--secondary-text-color, #727272); }
    /*  Standalone jump to Home Assistant's Energy config: shown once under the status section and under the
        groups hint, on its own line with a little breathing room above. */
    .live-config-link-row
    {
        margin-top: 10px;
    }
    .live-status-link
    {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-color, #03a9f4);
        text-decoration: none;
    }
    .live-status-link:hover { text-decoration: underline; }
    .live-status-link ha-icon
    {
        --mdc-icon-size: 15px;
        color: var(--primary-color, #03a9f4);
    }

    /*  Always-visible live-data status, pinned above the collapsible sections (its own title, no <details>).
        Its title matches the collapsible sections' flex row so the icon centres on the text (a bare
        .section-title block would baseline-align the icon and sit it too high). */
    .live-data-panel { margin-bottom: 4px; }
    .live-data-panel > .section-title
    {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 0;
    }

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

    /*  Map theme mode toggle: full width, the four options sharing the row equally, with a gap before the
        per-layer blocks below. */
    .map-mode-toggle
    {
        display: flex;
        width: 100%;
        margin-bottom: var(--ha-space-4, 16px);
    }
    .map-mode-toggle .seg-option
    {
        flex: 1;
        text-align: center;
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
    /*  Shared action button (reset cache / reset options / …): icon + label, tinted by --btn-color (set inline),
        full width so every action button reads as one consistent row. The filled variant inverts to a solid fill
        for a destructive confirm. */
    .action-btn
    {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        /*  Fixed width (fits the longest label), right-aligned so every action button lines up on the right edge. */
        width: 260px;
        max-width: 100%;
        margin-left: auto;
        margin-right: 0;
        box-sizing: border-box;
        white-space: nowrap;
        text-decoration: none;
        background: transparent;
        border: var(--ha-border-width-sm, 1px) solid var(--btn-color, var(--error-color, #ef4444));
        color: var(--btn-color, var(--error-color, #ef4444));
        border-radius: var(--ha-border-radius-sm, 4px);
        padding: 8px 12px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        margin-top: 8px;
    }
    .action-btn ha-icon
    {
        --mdc-icon-size: 18px;
        flex: 0 0 auto;
    }
    .action-btn:hover
    {
        background: color-mix(in srgb, var(--btn-color, #ef4444) 8%, transparent);
    }
    .action-btn:focus-visible
    {
        outline: 2px solid var(--btn-color, #ef4444);
        outline-offset: 2px;
    }
    /*  Filled state (e.g. an armed destructive confirm): solid --btn-color fill so it reads clearly. */
    .action-btn-filled,
    .action-btn-filled:hover
    {
        background: var(--btn-color, var(--error-color, #ef4444));
        color: var(--text-primary-color, #fff);
    }
    /*  Disabled field (a dependent control kept visible but inert, e.g. the No-UI delay when the mode is off). */
    .field-disabled
    {
        opacity: 0.45;
    }
    .field-disabled input
    {
        cursor: not-allowed;
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
    /*  Device list: one row per dashboard-tracked device, colour dot + name on the left, the group pill and the
        show/hide toggle on the right. Framed as a soft card so the list reads as a distinct block within the
        section. */
    .device-list
    {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
        margin-bottom: 16px;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.12));
        border-radius: var(--ha-border-radius-md, 6px);
        overflow: hidden;
    }
    .device-row
    {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
    }
    .device-row + .device-row
    {
        border-top: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0,0,0,0.08));
    }
    /*  Device icon tinted in the entity's dashboard colour (set inline), standing in for the old colour dot. */
    .device-icon
    {
        flex: none;
        --mdc-icon-size: 20px;
    }
    .device-row.is-hidden .device-icon,
    .device-row.is-hidden .device-group
    {
        opacity: 0.5;
    }
    .device-name
    {
        flex: 1;
        min-width: 0;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    /*  When a device is hidden, its row dims. */
    .device-row.is-hidden .device-name
    {
        opacity: 0.5;
    }
    /*  Icon-only state toggles, HA-style: no button chrome. The icon carries the state through colour alone: normal
        text colour when active, the dimmed "disabled" colour when inactive. */
    .device-toggle
    {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        background: none;
        color: var(--disabled-text-color, #bdbdbd);
        cursor: pointer;
        transition: color 0.15s, opacity 0.15s;
        --mdc-icon-size: 22px;
    }
    .device-toggle.active
    {
        color: var(--primary-text-color, #212121);
    }
    .device-toggle:hover:not(:disabled)
    {
        color: var(--primary-color, #03a9f4);
    }
    .device-toggle:disabled
    {
        opacity: 0.4;
        cursor: default;
    }
    .device-toggle:focus-visible
    {
        outline: 2px solid var(--primary-color, #03a9f4);
        outline-offset: 2px;
        border-radius: var(--ha-border-radius-sm, 4px);
    }
    /*  Monitoring-group pill: a small circle showing the group number (1..4) filled in the group's colour, or an
        X in a dim outlined circle for "No group". Click cycles No group -> 1 -> ... -> 4 -> No group. */
    .device-group
    {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 50%;
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
        background: none;
        color: var(--disabled-text-color, #bdbdbd);
        font-size: var(--ha-font-size-xs, 12px);
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        transition: color 0.15s, background 0.15s, border-color 0.15s;
        --mdc-icon-size: 16px;
    }
    .device-group.active
    {
        color: #fff;
        border-color: transparent;
        background: var(--group-pill-color, var(--primary-color, #03a9f4));
    }
    .device-group:hover
    {
        border-color: var(--primary-color, #03a9f4);
    }
    .device-group:focus-visible
    {
        outline: 2px solid var(--primary-color, #03a9f4);
        outline-offset: 2px;
    }
    /*  One group's identity in a framed block: line 1 = badge + name, line 2 = colour + icon pickers (each half). */
    .group-block
    {
        margin-bottom: 8px;
        padding: 8px 10px;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: var(--ha-border-radius-md, 6px);
    }
    /*  Breathing room after the last group block before the next field (solar-irradiance entity). */
    .group-block:last-of-type
    {
        margin-bottom: 16px;
    }
    .group-line
    {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .group-line + .group-line
    {
        margin-top: 8px;
    }
    .group-name-badge
    {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        color: #fff;
        font-size: var(--ha-font-size-xs, 12px);
        font-weight: 700;
        line-height: 1;
        background: var(--group-pill-color, var(--primary-color, #03a9f4));
    }
    .group-name-badge ha-icon
    {
        --mdc-icon-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .group-name-input
    {
        flex: 1 1 auto;
        min-width: 0;
        box-sizing: border-box;
        padding: 6px 8px;
        border: var(--ha-border-width-sm, 1px) solid var(--divider-color, rgba(0, 0, 0, 0.2));
        border-radius: var(--ha-border-radius-sm, 4px);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: var(--ha-font-size-s, 13px);
        font-family: inherit;
    }
    .group-name-input:focus
    {
        outline: none;
        border-color: var(--primary-color, #03a9f4);
    }
    /*  Chip box (Chips & colours): the chip's name grows to push the on/off toggle to the right edge; the small
        direction label sits before grid/battery's two colour pickers. */
    .chip-box-name
    {
        flex: 1 1 auto;
        min-width: 0;
        font-size: var(--ha-font-size-s, 13px);
        color: var(--primary-text-color, #212121);
    }
    /*  Chip box body row: an icon picker + a colour picker sharing the width 50/50 (each state gets its own row
        for grid/battery). flex-basis 0 + equal grow makes them the same width regardless of intrinsic content. */
    .chip-body .chip-picker
    {
        flex: 1 1 0;
        min-width: 0;
        width: 0;
    }
    .device-empty
    {
        font-size: var(--ha-font-size-xs, 11px);
        color: var(--secondary-text-color, #727272);
        padding: 4px 0;
    }
`;
