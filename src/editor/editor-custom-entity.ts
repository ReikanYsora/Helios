//Reusable custom-entity configuration block for the editor: one power sensor (live chip), one energy
//meter (energy surfaces), an optional colour and an optional icon. Measured-only contract: the card
//displays the custom entity only when BOTH sensors are set, so the two pickers sit together with their
//own hints. Labels are injected by the host (translation-agnostic), and the value travels as one object,
//so a future multi-entity editor can stack N of these rows without touching this file.

import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface CustomEntityConfigValue
{
    power:  string;
    energy: string;
    color:  string;
    icon:   string;
}

export interface CustomEntityConfigLabels
{
    power:      string;
    powerHelp:  string;
    energy:     string;
    energyHelp: string;
    icon:       string;
    color:      string;
}

@customElement('helios-custom-entity-config')
export class HeliosCustomEntityConfig extends LitElement
{
    @property({ attribute: false }) public hass:   any;

    @property({ attribute: false }) public value:  CustomEntityConfigValue = { power: '', energy: '', color: 'red', icon: '' };

    @property({ attribute: false }) public labels: CustomEntityConfigLabels = { power: '', powerHelp: '', energy: '', energyHelp: '', icon: '', color: '' };

    //Host flips this once the HA pickers are loaded (same gate as the editor's other pickers).
    @property({ attribute: false }) public pickerReady = false;

    //Mirrors the editor's field styling so the block reads as native rows of the entities section.
    static styles = css`
        .field
        {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .field.field-block
        {
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
        }
        .field.field-block ha-entity-picker { width: 100%; }
        .label
        {
            font-size: var(--ha-font-size-s, 13px);
            color: var(--primary-text-color, #212121);
        }
        .field-help
        {
            font-size: var(--ha-font-size-xs, 11px);
            color: var(--secondary-text-color, #727272);
            margin: 2px 0 10px;
        }
    `;

    render(): TemplateResult
    {
        return html`
            <div class="field field-block">
                <span class="label">${this.labels.power}</span>
                ${this.pickerReady ? html`
                    <ha-entity-picker
                        allow-custom-entity
                        .hass=${this.hass}
                        .value=${this.value.power}
                        .includeDomains=${['sensor']}
                        .includeDeviceClasses=${['power']}
                        data-field="power"
                        @value-changed=${this._onFieldChanged}
                    ></ha-entity-picker>
                ` : nothing}
            </div>
            <div class="field-help">${this.labels.powerHelp}</div>
            <div class="field field-block">
                <span class="label">${this.labels.energy}</span>
                ${this.pickerReady ? html`
                    <ha-entity-picker
                        allow-custom-entity
                        .hass=${this.hass}
                        .value=${this.value.energy}
                        .includeDomains=${['sensor']}
                        .includeDeviceClasses=${['energy']}
                        data-field="energy"
                        @value-changed=${this._onFieldChanged}
                    ></ha-entity-picker>
                ` : nothing}
            </div>
            <div class="field-help">${this.labels.energyHelp}</div>
            <div class="field field-block">
                <span class="label">${this.labels.icon}</span>
                ${this.pickerReady ? html`
                    <ha-icon-picker
                        .hass=${this.hass}
                        .value=${this.value.icon}
                        placeholder="mdi:flash"
                        data-field="icon"
                        @value-changed=${this._onFieldChanged}
                    ></ha-icon-picker>
                ` : nothing}
            </div>
            <div class="field field-block">
                <span class="label">${this.labels.color}</span>
                ${this.pickerReady ? html`
                    <ha-selector
                        .hass=${this.hass}
                        .selector=${{ ui_color: { default_color: 'red' } }}
                        .value=${this.value.color || 'red'}
                        data-field="color"
                        @value-changed=${this._onFieldChanged}
                    ></ha-selector>
                ` : nothing}
            </div>
        `;
    }

    private _onFieldChanged(ev: CustomEvent): void
    {
        ev.stopPropagation();
        const field = (ev.currentTarget as HTMLElement).getAttribute('data-field') as keyof CustomEntityConfigValue;
        const raw   = (ev.detail?.value ?? '') as string;
        const next  = { ...this.value, [field]: typeof raw === 'string' ? raw : '' };
        this.value  = next;
        this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: next } }));
    }
}

declare global
{
    interface HTMLElementTagNameMap
    {
        'helios-custom-entity-config': HeliosCustomEntityConfig;
    }
}
