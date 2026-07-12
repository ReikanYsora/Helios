import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

//Visual config editor for the Energy Fingerprint card, driven by Home Assistant's own `ha-form` so it looks and
//behaves exactly like a native card editor in any theme. The card reads the HA Energy dashboard automatically, so
//there is nothing mandatory here: only presentation options.
interface FingerprintConfig
{
    type:   string;
    title?: string;
}

const SCHEMA = [
    { name: 'title', selector: { text: {} } },
] as const;

const LABELS: Record<string, string> = {
    title: 'Title',
};

@customElement('helios-fingerprint-card-editor')
export class HeliosFingerprintCardEditor extends LitElement
{
    @property({ attribute: false }) public hass!: any;
    @state() private _config: FingerprintConfig = { type: '' };

    public setConfig(config: FingerprintConfig): void
    {
        this._config = { ...config };
    }

    private _computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

    private _valueChanged = (e: CustomEvent<{ value: FingerprintConfig }>): void =>
    {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('config-changed', {
            detail: { config: { ...this._config, ...e.detail.value } },
            bubbles: true,
            composed: true,
        }));
    };

    protected render()
    {
        if (!this.hass) { return nothing; }
        return html`
            <ha-form
                .hass=${this.hass}
                .data=${this._config}
                .schema=${SCHEMA}
                .computeLabel=${this._computeLabel}
                @value-changed=${this._valueChanged}
            ></ha-form>`;
    }
}
