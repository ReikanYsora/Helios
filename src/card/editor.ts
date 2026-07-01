import type { TemplateResult} from 'lit';
import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { editorStyles } from '../css/helios-card-editor-css';
import
{
    type HeliosConfig,
    DEFAULT_BUILDING_OPACITY,
    DEFAULT_BUILDING_CLUSTER_RADIUS_M,
    DEFAULT_SHADOW_OPACITY,
    DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    DEFAULT_DISPLAY_RADIUS_M,
    MIN_DISPLAY_RADIUS_M,
    MAX_DISPLAY_RADIUS_M,
    DEFAULT_BUILDING_COUNT,
    MIN_BUILDING_COUNT,
    MAX_BUILDING_COUNT,
    FIXED_BUILDING_HEIGHT_M,
    MIN_BUILDING_HEIGHT_M,
    MAX_BUILDING_HEIGHT_M,
    DEFAULT_VALUE_DECIMALS,
    MIN_VALUE_DECIMALS,
    MAX_VALUE_DECIMALS,
} from '../helios-config';
import { pickTranslations, type Translations } from '../i18n';


// Render a localised hint with markdown-style `[text](url)` links as real `<a>` anchors via Lit's tagged template
// (no innerHTML) so URL + text stay escaped. URL safety: anything not http(s):// or same-origin renders as plain
// text, blocking a corrupted translation from injecting a `javascript:` URI.
function renderMarkdownLinks(text: string): unknown[]
{
    const parts: unknown[] = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null)
    {
        if (match.index > cursor)
        {
            parts.push(text.slice(cursor, match.index));
        }
        const label = match[1];
        const url   = match[2];
        if (/^https?:\/\//i.test(url))
        {
            parts.push(html`<a href=${url} target="_blank" rel="noopener noreferrer">${label}</a>`);
        }
        else if (/^\/[a-zA-Z0-9_\-/.]*$/.test(url))
        {
            // Same-origin in-app navigation (e.g. /config/energy). No target=_blank so the user stays inside the HA SPA.
            parts.push(html`<a href=${url}>${label}</a>`);
        }
        else
        {
            // Suspicious scheme: render the URL as plain text so the browser doesn't follow it.
            parts.push(`${label} (${url})`);
        }
        cursor = match.index + match[0].length;
    }
    if (cursor < text.length)
    {
        parts.push(text.slice(cursor));
    }
    return parts;
}


// Visual editor exposing every config option through native HA form controls.
@customElement('helios-card-editor')
export class HeliosCardEditor extends LitElement
{
    @property({ attribute: false }) public hass?: any;
    @state()                        private _cfg: HeliosConfig = {};
    @state()                        private _pickerReady = false;
    // Accordion: at most one top-level section open at a time (a stack of expanded blocks got too tall to scan). Id
    // of the open section, or null when all collapsed. Defaults to 'location' so a fresh card opens on the home spot.
    @state()                        private _openSection: string | null = 'location';
    // Per-key debounce timers for slider @input. Sliders fire on every drag pixel; dispatching `config-changed` per
    // tick would cascade a full engine re-render each pixel (painful during preview). _cfg updates synchronously so
    // the bound .value tracks the drag, but `config-changed` only dispatches after a short idle window.
    private static readonly SLIDER_COMMIT_DELAY_MS = 250;
    //Give the lazily-imported ha-entity-picker this long to register before rendering the form unenhanced.
    private static readonly PICKER_LOAD_TIMEOUT_MS = 8000;
    //How long the "cache reset" confirmation stays on screen before clearing.
    private static readonly RESET_FEEDBACK_MS = 2000;
    private _sliderDebounce = new Map<string, number>();

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        for (const t of this._sliderDebounce.values())
        {
            window.clearTimeout(t);
        }
        this._sliderDebounce.clear();
        // Clear the cache-reset confirmation timer; otherwise a fast unmount lets it fire on a dead element and warn
        // about touching @state after disconnect.
        if (this._resetFeedbackTimer !== undefined)
        {
            window.clearTimeout(this._resetFeedbackTimer);
            this._resetFeedbackTimer = undefined;
        }
    }

    public setConfig(config: HeliosConfig): void
    {
        this._cfg = { ...config };
        //Assign a hidden, per-card cache id the first time the card is configured. It keeps each card's saved view
        //isolated and is never shown or editable. Deferred so config-changed isn't dispatched inside the host's
        //setConfig call stack; guarded so it fires once.
        if (!this._cfg['cache-id'])
        {
            const id = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
            setTimeout(() =>
            {
                if (!this._cfg['cache-id'])
                {
                    this._update('cache-id', id);
                }
            }, 0);
        }
    }

    public connectedCallback(): void
    {
        super.connectedCallback();
        this._ensureEntityPicker();
    }

    // ha-entity-picker ships in HA's lazy-loaded card-editor bundle and may be unregistered in a fresh tab. Force the
    // load by creating a transient "entities" card and requesting its config element (the side effect registers the
    // tag). Until then the field falls back to a plain text input so it's never broken.
    private async _ensureEntityPicker(): Promise<void>
    {
        if (this._pickerReady)
        {
            return;
        }
        if (typeof customElements !== 'undefined' && customElements.get('ha-entity-picker'))
        {
            this._pickerReady = true;
            return;
        }

        try
        {
            const w: any = window as any;
            if (typeof w.loadCardHelpers === 'function')
            {
                const helpers = await w.loadCardHelpers();
                if (helpers?.createCardElement)
                {
                    const card: any = await helpers.createCardElement({
                        type:     'entities',
                        entities: []
                    });
                    const ctor: any = card?.constructor;
                    if (typeof ctor?.getConfigElement === 'function')
                    {
                        await ctor.getConfigElement();
                    }
                }
            }
            if (typeof customElements !== 'undefined')
            {
                await Promise.race([
                    customElements.whenDefined('ha-entity-picker'),
                    new Promise<void>(resolve => { setTimeout(resolve, HeliosCardEditor.PICKER_LOAD_TIMEOUT_MS); })
                ]);
            }
        }
        catch (_e)
        {
            //Lazy import failed to register the picker: it simply renders unenhanced.
        }
        finally
        {
            this._pickerReady = true;
        }
    }

    private _t(): Translations
    {
        return pickTranslations(this.hass?.language);
    }

    private _update(key: keyof HeliosConfig, value: unknown): void
    {
        const next = { ...this._cfg } as Record<string, unknown>;
        //undefined clears the key entirely so the YAML drops it (resolvers fall back to their default), rather
        //than persisting an explicit `key: undefined`.
        if (value === undefined) { delete next[key]; }
        else { next[key] = value; }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
        this._cfg = next as HeliosConfig;
    }

    // Free-form numeric field. Empty input clears the option (card falls back to default); a finite number commits
    // as-is; anything else is ignored, leaving the previous value.
    private _numField(key: keyof HeliosConfig, e: Event): void
    {
        const raw = (e.target as HTMLInputElement).value.trim();
        if (raw === '')
        {
            this._update(key, undefined);
            return;
        }
        const v = parseFloat(raw);
        if (!isFinite(v))
        {
            return;
        }
        this._update(key, v);
    }

    // Updates local state synchronously so the thumb tracks the drag, but defers `config-changed` by
    // SLIDER_COMMIT_DELAY_MS so the engine doesn't see a flood of intermediate values.
    private _numSlider(key: keyof HeliosConfig, e: Event): void
    {
        const v = parseFloat((e.target as HTMLInputElement).value);
        if (!isFinite(v))
        {
            return;
        }

        this._cfg = { ...this._cfg, [key]: v };

        const k        = String(key);
        const existing = this._sliderDebounce.get(k);
        if (existing !== undefined)
        {
            window.clearTimeout(existing);
        }
        const t = window.setTimeout(() =>
        {
            this._sliderDebounce.delete(k);
            this.dispatchEvent(new CustomEvent('config-changed',
                { detail: { config: this._cfg } }));
        }, HeliosCardEditor.SLIDER_COMMIT_DELAY_MS);
        this._sliderDebounce.set(k, t);
    }


    // Opening a section closes the others (_openSection binds each <details>'s `open` attribute); collapsing the open
    // one falls back to "everything closed". Scrolls the just-opened section into view on the next rAF tick (after
    // layout reflects the expanded body) so the user isn't left at the bottom of the previous section.
    private _onSectionToggle(sectionId: string, e: Event): void
    {
        const el = e.currentTarget as HTMLDetailsElement;
        if (el.open)
        {
            this._openSection = sectionId;
            requestAnimationFrame(() =>
            {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        else if (this._openSection === sectionId)
        {
            this._openSection = null;
        }
    }

    // Bound template delegates: each reads its parameter off the firing element's data-* attribute so the markup can
    // pass bare method references (no in-template arrows). data-key maps to a HeliosConfig key, data-section to an
    // accordion id, data-value to the boolean a toggle button commits.
    private _onSectionToggleEvt = (e: Event): void =>
    {
        const section = (e.currentTarget as HTMLElement).dataset.section;
        if (section) { this._onSectionToggle(section, e); }
    };
    private _onNumFieldChange = (e: Event): void =>
    {
        const key = (e.currentTarget as HTMLElement).dataset.key as keyof HeliosConfig | undefined;
        if (key) { this._numField(key, e); }
    };
    private _onNumSliderInput = (e: Event): void =>
    {
        const key = (e.currentTarget as HTMLElement).dataset.key as keyof HeliosConfig | undefined;
        if (key) { this._numSlider(key, e); }
    };
    private _onEntityValueChanged = (e: CustomEvent): void =>
    {
        const key = (e.currentTarget as HTMLElement).dataset.key as keyof HeliosConfig | undefined;
        if (!key) { return; }
        //Empty/undefined is a real edit: an entity cleared, or a colour reset to the card default via the picker's
        //clear affordance (ui_color emits undefined when the chosen token equals its default). Store it as unset so
        //the resolver falls back to the default. The picker never emits on init, so there is no echo to filter.
        const raw  = (e as CustomEvent<{ value?: unknown }>).detail.value;
        const next = raw === undefined || raw === null || raw === '' ? undefined : raw;
        if ((this._cfg[key] ?? undefined) === (next ?? undefined)) { return; }
        this._update(key, next);
    };
    private _onBoolToggleClick = (e: Event): void =>
    {
        const el  = e.currentTarget as HTMLElement;
        const key = el.dataset.key as keyof HeliosConfig | undefined;
        if (key) { this._update(key, el.dataset.value === 'true'); }
    };

    private _fmtNum(v: number, step: number): string
    {
        return step >= 1 ? String(Math.round(v)) : v.toFixed(2);
    }

    // Solar-irradiance entity filter: accepts the `irradiance` device class plus any sensor reporting W/m². The unit
    // fallback covers template sensors that don't declare a device_class.
    private _solarIrradianceEntityFilter = (entity: any): boolean =>
    {
        if (!entity || !entity.attributes)
        {
            return false;
        }
        if (entity.attributes.device_class === 'irradiance')
        {
            return true;
        }
        const u = String(entity.attributes.unit_of_measurement ?? '').trim();
        return u === 'W/m²' || u === 'W/m2';
    };

    //Custom-entity picker filter: any power (W/kW/MW) or energy (Wh/kWh/MWh) entity, by device_class or unit.
    private _customEntityFilter = (entity: any): boolean =>
    {
        if (!entity || !entity.attributes)
        {
            return false;
        }
        const dc = String(entity.attributes.device_class ?? '');
        if (dc === 'power' || dc === 'energy')
        {
            return true;
        }
        const u = String(entity.attributes.unit_of_measurement ?? '').trim().toLowerCase();
        return u === 'w' || u === 'kw' || u === 'mw' || u === 'wh' || u === 'kwh' || u === 'mwh';
    };

    protected render(): TemplateResult
    {
        const c = this._cfg;
        const t = this._t();

        // Placeholders for the home lat/lon override fields: show HA's configured home (so the user sees what they'd
        // override), falling back to Amsterdam when HA hasn't set one. Hint text only; empty input means "use HA's
        // home".
        const haLat = this.hass?.config?.latitude;
        const haLon = this.hass?.config?.longitude;
        const latPlaceholder = typeof haLat === 'number' && isFinite(haLat)
            ? String(haLat) : '52.379';
        const lonPlaceholder = typeof haLon === 'number' && isFinite(haLon)
            ? String(haLon) : '4.900';

        return html`
            <div class="editor">

                <details class="advanced-section" data-section="location" ?open=${this._openSection === 'location'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:map-marker"></ha-icon>${t.editor.locationSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.homeLatitude}</span>
                    <input
                        type="number"
                        min="-90"
                        max="90"
                        step="any"
                        placeholder=${latPlaceholder}
                        .value=${c['home-latitude'] != null ? String(c['home-latitude']) : ''}
                        data-key="home-latitude"
                        @change=${this._onNumFieldChange}
                    />
                </label>
                <label class="field">
                    <span class="label">${t.editor.homeLongitude}</span>
                    <input
                        type="number"
                        min="-180"
                        max="180"
                        step="any"
                        placeholder=${lonPlaceholder}
                        .value=${c['home-longitude'] != null ? String(c['home-longitude']) : ''}
                        data-key="home-longitude"
                        @change=${this._onNumFieldChange}
                    />
                </label>
                <div class="hint">${t.editor.locationHint}</div>

                </details>

                <details class="advanced-section" data-section="map" ?open=${this._openSection === 'map'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:tune"></ha-icon>${t.editor.uiAndMapSection}</summary>
                <div class="field">
                    <span class="label">${t.editor.autoRotate}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${(c['auto-rotate-enabled'] === true) ? 'active' : ''}"
                            data-key="auto-rotate-enabled" data-value="true"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.autoRotateOn}</button>
                        <button
                            type="button"
                            class="seg-option ${(c['auto-rotate-enabled'] !== true) ? 'active' : ''}"
                            data-key="auto-rotate-enabled" data-value="false"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.autoRotateOff}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.autoRotateHint}</div>

                <div class="field field-block">
                    <span class="label">${t.editor.customEntity}</span>
                    ${this._pickerReady ? html`
                        <ha-entity-picker
                            allow-custom-entity
                            .hass=${this.hass}
                            .value=${String(c['custom-entity'] ?? '')}
                            .includeDomains=${['sensor', 'input_number', 'number']}
                            .entityFilter=${this._customEntityFilter}
                            data-key="custom-entity"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-entity-picker>
                    ` : nothing}
                </div>
                <div class="field-help">${t.editor.customEntityHelp}</div>
                ${String(c['custom-entity'] ?? '') !== '' ? html`
                    <div class="field field-block">
                        <span class="label">${t.editor.customEntityIcon}</span>
                        ${this._pickerReady ? html`
                            <ha-icon-picker
                                .hass=${this.hass}
                                .value=${String(c['custom-entity-icon'] ?? '')}
                                data-key="custom-entity-icon"
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-icon-picker>
                        ` : nothing}
                    </div>
                    <div class="field field-block">
                        <span class="label">${t.editor.customEntityColor}</span>
                        ${this._pickerReady ? html`
                            <ha-selector
                                .hass=${this.hass}
                                .selector=${{ ui_color: { default_color: 'red' } }}
                                .value=${String(c['custom-entity-color'] ?? 'red')}
                                data-key="custom-entity-color"
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-selector>
                        ` : nothing}
                    </div>
                    <div class="field-help">${t.editor.customEntityColorHelp}</div>
                ` : nothing}

                </details>

                <details class="advanced-section" data-section="buildings" ?open=${this._openSection === 'buildings'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:office-building-outline"></ha-icon>${t.editor.buildingsSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.displayRadius ?? 'Display radius'}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${MIN_DISPLAY_RADIUS_M}
                            max=${MAX_DISPLAY_RADIUS_M}
                            step="10"
                            .value=${String(c['display-radius'] ?? DEFAULT_DISPLAY_RADIUS_M)}
                            data-key="display-radius"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['display-radius'] ?? DEFAULT_DISPLAY_RADIUS_M), 10)} m</span>
                    </div>
                </label>
                <div class="hint">${t.editor.displayRadiusHelp ?? 'Radius around the home in which buildings are fetched and drawn, up to the edge of the faded map disc. Lower it to lighten rendering on a slow device; 0 shows just the home.'}</div>
                <label class="field">
                    <span class="label">${t.editor.buildingCount ?? 'Building count'}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${MIN_BUILDING_COUNT}
                            max=${MAX_BUILDING_COUNT}
                            step="5"
                            .value=${String(c['building-count'] ?? DEFAULT_BUILDING_COUNT)}
                            data-key="building-count"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['building-count'] ?? DEFAULT_BUILDING_COUNT), 5)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.buildingCountHelp ?? 'Maximum number of nearby buildings to draw. Lower it to lighten rendering on a slow device.'}</div>
                <div class="field">
                    <span class="label">${t.editor.buildingRealSize ?? 'Real building heights'}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${(c['building-real-size'] !== false) ? 'active' : ''}"
                            data-key="building-real-size" data-value="true"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.buildingRealSizeOn ?? 'On'}</button>
                        <button
                            type="button"
                            class="seg-option ${(c['building-real-size'] === false) ? 'active' : ''}"
                            data-key="building-real-size" data-value="false"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.buildingRealSizeOff ?? 'Off'}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.buildingRealSizeHint ?? 'On: use real OpenStreetMap heights (capped to keep the framing readable). Off: give every building the same fixed height below.'}</div>
                ${c['building-real-size'] === false ? html`
                    <label class="field">
                        <span class="label">${t.editor.buildingHeight ?? 'Building height'}</span>
                        <div class="slider-row">
                            <input
                                type="range"
                                min=${MIN_BUILDING_HEIGHT_M}
                                max=${MAX_BUILDING_HEIGHT_M}
                                step="0.5"
                                .value=${String(c['building-height'] ?? FIXED_BUILDING_HEIGHT_M)}
                                data-key="building-height"
                                @input=${this._onNumSliderInput}
                            />
                            <span class="slider-value">${this._fmtNum(Number(c['building-height'] ?? FIXED_BUILDING_HEIGHT_M), 0.5)} m</span>
                        </div>
                    </label>
                ` : nothing}
                <label class="field">
                    <span class="label">${t.editor.buildingClusterRadius}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="100" step="1"
                            .value=${String(c['building-cluster-radius'] ?? DEFAULT_BUILDING_CLUSTER_RADIUS_M)}
                            data-key="building-cluster-radius"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['building-cluster-radius'] ?? DEFAULT_BUILDING_CLUSTER_RADIUS_M), 1)} m</span>
                    </div>
                </label>
                <label class="field">
                    <span class="label">${t.editor.buildingOpacity}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            .value=${String(c['building-opacity'] ?? DEFAULT_BUILDING_OPACITY)}
                            data-key="building-opacity"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['building-opacity'] ?? DEFAULT_BUILDING_OPACITY), 0.05)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.buildingsHint}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.homeColor}</span>
                    ${this._pickerReady ? html`
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{ ui_color: { default_color: 'green' } }}
                            .value=${String(c['home-color'] ?? 'green')}
                            data-key="home-color"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>
                    ` : nothing}
                </div>
                <div class="field-help">${t.editor.homeColorHelp}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.buildingColor}</span>
                    ${this._pickerReady ? html`
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{ ui_color: { default_color: 'grey' } }}
                            .value=${String(c['building-color'] ?? 'grey')}
                            data-key="building-color"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>
                    ` : nothing}
                </div>
                <div class="field-help">${t.editor.buildingColorHelp}</div>

                </details>

                <details class="advanced-section" data-section="shadows" ?open=${this._openSection === 'shadows'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:gradient-vertical"></ha-icon>${t.editor.shadowsSection}</summary>
                <div class="field">
                    <span class="label">${t.editor.shadowsEnabled}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${(c['shadows-enabled'] !== false) ? 'active' : ''}"
                            data-key="shadows-enabled" data-value="true"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.shadowsEnabledOn}</button>
                        <button
                            type="button"
                            class="seg-option ${(c['shadows-enabled'] === false) ? 'active' : ''}"
                            data-key="shadows-enabled" data-value="false"
                            @click=${this._onBoolToggleClick}
                        >${t.editor.shadowsEnabledOff}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.shadowsEnabledHint}</div>

                <label class="field">
                    <span class="label">${t.editor.shadowOpacity}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            .value=${String(c['shadow-opacity'] ?? DEFAULT_SHADOW_OPACITY)}
                            data-key="shadow-opacity"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['shadow-opacity'] ?? DEFAULT_SHADOW_OPACITY), 0.05)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.shadowOpacityHint}</div>

                </details>

                <details class="advanced-section" data-section="dataDisplay" ?open=${this._openSection === 'dataDisplay'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:chart-timeline-variant"></ha-icon>${t.editor.dataDisplaySection}</summary>
                <label class="field">
                    <span class="label">${t.editor.displayUpdateFrequency}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR}
                            max=${MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR}
                            step="1"
                            .value=${String(c['display-update-frequency-per-hour'] ?? DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR)}
                            data-key="display-update-frequency-per-hour"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['display-update-frequency-per-hour'] ?? DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR), 1)} / h</span>
                    </div>
                </label>
                <div class="field-help">${t.editor.displayUpdateFrequencyHelp}</div>
                <label class="field">
                    <span class="label">${t.editor.valueDecimals ?? 'Value decimals'}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${MIN_VALUE_DECIMALS}
                            max=${MAX_VALUE_DECIMALS}
                            step="1"
                            .value=${String(c['value-decimals'] ?? DEFAULT_VALUE_DECIMALS)}
                            data-key="value-decimals"
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['value-decimals'] ?? DEFAULT_VALUE_DECIMALS), 1)}</span>
                    </div>
                </label>
                <div class="field-help">${t.editor.valueDecimalsHelp ?? 'Number of decimals shown on every value (power in kW, energy in kWh). 0 to 3.'}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.powerUnit ?? 'Power unit'}</span>
                    ${this._pickerReady ? html`
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{ select: { mode: 'box', options: [{ value: 'kW', label: 'kW' }, { value: 'W', label: 'W' }] } }}
                            .value=${String(c['power-unit'] ?? 'kW')}
                            data-key="power-unit"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>
                    ` : nothing}
                </div>
                <div class="field-help">${t.editor.powerUnitHelp ?? 'Unit for every power readout on the card. Energy always stays in kWh.'}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.irradianceUnit ?? 'Solar constant unit'}</span>
                    ${this._pickerReady ? html`
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{ select: { mode: 'box', options: [{ value: 'W/m²', label: 'W/m²' }, { value: 'kW/m²', label: 'kW/m²' }] } }}
                            .value=${String(c['irradiance-unit'] ?? 'W/m²')}
                            data-key="irradiance-unit"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>
                    ` : nothing}
                </div>
                <div class="field-help">${t.editor.irradianceUnitHelp ?? 'Unit for the solar constant (irradiance) readout.'}</div>
                </details>

                <details class="advanced-section" data-section="installation" ?open=${this._openSection === 'installation'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:solar-power-variant"></ha-icon>${t.editor.installationSection}</summary>
                <div class="hint">${renderMarkdownLinks(t.editor.installationHint)}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.solarIrradianceEntity}</span>
                    ${this._pickerReady ? html`
                        <ha-entity-picker
                            allow-custom-entity
                            .hass=${this.hass}
                            .value=${String(c['solar-irradiance-entity'] ?? '')}
                            .includeDomains=${['sensor', 'input_number']}
                            .entityFilter=${this._solarIrradianceEntityFilter}
                            data-key="solar-irradiance-entity"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-entity-picker>
                    ` : nothing}
                </div>
                <div class="field-help">${t.editor.solarIrradianceEntityHelp}</div>

                </details>


                <details class="advanced-section" data-section="reset" ?open=${this._openSection === 'reset'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:refresh"></ha-icon>${t.editor.resetSection}</summary>
                    <div class="hint">${t.editor.resetSectionHint}</div>
                    <div class="hint reset-warning">${t.editor.resetCacheWarning}</div>
                    <button
                        type="button"
                        class="reset-btn"
                        @click=${this._onResetCacheClick}
                    >${this._resetFeedback ?? t.editor.resetCacheButton}</button>
                </details>

                <details class="advanced-section about-section" data-section="about" ?open=${this._openSection === 'about'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:information-outline"></ha-icon>${t.editor.aboutSection}</summary>
                    <!-- Identity + links column: one .about-row line per item, label left and value (or icon link)
                         right. The X brand mark is an inline SVG because the MDI icon set doesn't ship the current
                         glyph and mdi:twitter would mis-label the platform. -->
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutVersionLabel}</span>
                        <a class="about-row-link about-version-link"
                           href="https://github.com/ReikanYsora/Helios/releases/tag/v${__HELIOS_VERSION__}"
                           target="_blank" rel="noopener noreferrer"
                        >${__HELIOS_VERSION__}</a>
                    </div>
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutDeveloperLabel}</span>
                        <span class="about-row-value">ReikanYsora (Jérôme Crémoux)</span>
                    </div>
                    <div class="about-row">
                        <span class="about-label" aria-hidden="true"></span>
                        <a class="about-row-link" href="https://x.com/ReikanYsora" target="_blank" rel="noopener noreferrer">
                            <svg class="about-row-svg" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" fill="currentColor"/>
                            </svg>
                            <span>@ReikanYsora</span>
                        </a>
                    </div>
                    <div class="about-row">
                        <span class="about-label" aria-hidden="true"></span>
                        <a class="about-row-link" href="https://www.linkedin.com/in/jerome-cremoux/" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:linkedin"></ha-icon>
                            <span>${t.editor.aboutDeveloperLinkedIn}</span>
                        </a>
                    </div>
                    <div class="about-row">
                        <span class="about-label" aria-hidden="true"></span>
                        <a class="about-row-link" href="https://github.com/ReikanYsora/Helios" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:github"></ha-icon>
                            <span>${t.editor.aboutRepoCard}</span>
                        </a>
                    </div>
                    <div class="about-block about-coffee">
                        <p class="about-paragraph">${t.editor.aboutCoffeeMessage}</p>
                        <a class="about-link about-coffee-link" href="https://www.buymeacoffee.com/reikanysora" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:coffee"></ha-icon>
                            <span>${t.editor.aboutCoffeeLink}</span>
                        </a>
                    </div>
                </details>

            </div>
        `;
    }


    // Fires the window-level reset bus so every live card drops its cached Open-Meteo payload + in-memory PV history
    // and re-fetches. Flashes a brief confirmation on the button so the user sees the click landed without a toast.
    private _resetFeedbackTimer?: number;
    @state() private _resetFeedback: string | null = null;

    private _onResetCacheClick(): void
    {
        try
        {
            window.dispatchEvent(new CustomEvent('helios-data-cache-reset'));
        }
        catch (_) { /* CustomEvent unsupported: skip the cross-card cache-reset broadcast */ }
        const t = pickTranslations(this.hass?.language);
        this._resetFeedback = t.editor.resetCacheDone;
        if (this._resetFeedbackTimer !== undefined)
        {
            window.clearTimeout(this._resetFeedbackTimer);
        }
        this._resetFeedbackTimer = window.setTimeout(() =>
        {
            this._resetFeedback = null;
        }, HeliosCardEditor.RESET_FEEDBACK_MS);
    }

    static styles = editorStyles;
}
