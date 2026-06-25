import { LitElement, html, TemplateResult, nothing } from 'lit';
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
    DEFAULT_VALUE_DECIMALS,
    MIN_VALUE_DECIMALS,
    MAX_VALUE_DECIMALS,
} from '../helios-config';
import { pickTranslations, type Translations } from '../i18n';




// Render a localised hint with markdown-style `[text](url)` links as a Lit fragment of real `<a>` anchors. Built via Lit's tagged
// template (no innerHTML) so URL + text stay escaped. URL safety: anything not http(s):// or same-origin is rendered as plain text,
// blocking a corrupted translation from injecting a `javascript:` URI. Used by editor hints linking to public docs.
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
            parts.push(html`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
        }
        else if (/^\/[a-zA-Z0-9_\-/.]*$/.test(url))
        {
            // Same-origin in-app navigation (e.g. /config/energy). No target=_blank so the user stays inside the HA SPA.
            parts.push(html`<a href="${url}">${label}</a>`);
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


// Visual editor exposing every config option through native HA form controls. Wired in via HeliosCard.getConfigElement().
@customElement('helios-card-editor')
export class HeliosCardEditor extends LitElement
{
    @property({ attribute: false }) public hass?: any;
    @state()                        private _cfg: HeliosConfig = {};
    @state()                        private _pickerReady = false;
    // Accordion: at most one top-level section open at a time (a stack of expanded blocks got too tall to scan). Id of the open
    // section, or null when all collapsed. Defaults to 'location' so a fresh card opens on where the home sits.
    @state()                        private _openSection: string | null = 'location';
    // Per-key debounce timers for slider @input. Sliders fire on every drag pixel; dispatching `config-changed` per tick would
    // cascade a full engine re-render each pixel (painful during preview). _cfg updates synchronously so the bound .value tracks the
    // drag, but `config-changed` only dispatches after a short idle window.
    private static readonly SLIDER_COMMIT_DELAY_MS = 250;
    private _sliderDebounce: Map<string, number> = new Map();

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        for (const t of this._sliderDebounce.values())
        {
            window.clearTimeout(t);
        }
        this._sliderDebounce.clear();
        // Clear the "Cache vidé" confirmation timer; otherwise a fast unmount lets it fire on a dead element and warn about
        // touching @state after disconnect.
        if (this._resetFeedbackTimer !== undefined)
        {
            window.clearTimeout(this._resetFeedbackTimer);
            this._resetFeedbackTimer = undefined;
        }
    }

    public setConfig(config: HeliosConfig): void
    {
        // Strip legacy/removed keys on editor open so stale config can't carry ghost behaviour into a fresh card frame.
        const sanitised = HeliosCardEditor._sanitiseConfig({ ...config });
        const changed   = !HeliosCardEditor._configEq(config, sanitised);
        this._cfg = sanitised;
        // If anything was trimmed, push the cleaned config back to HA so the YAML reflects the schema now, not on the next edit.
        if (changed)
        {
            this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: sanitised } }));
        }
    }

    // Legacy/removed keys scrubbed on the next editor open. Grows as keys are retired across versions.
    private static _RETIRED_KEYS: string[] = [
        'card-theme',
        'card-theme-light',
        'card-theme-dark',
        // Entity slots the HA Energy dashboard already declares; the runtime resolves these from `energy/get_prefs` instead.
        // See helios-card.ts setConfig for the user-facing migration notification.
        'pv-power-entity',
        'grid-import-entity',
        'grid-export-entity',
        'grid-power-entity',
        'grid-power-invert',
        'battery-soc-entity',
        'battery-power-entity',
        'battery-power-invert',
        'batteries',
        'timeline-consumption-enabled',
        'date-format',
        'time-format',
        'pixel-ratio',
        'timeline-enabled',
        'timeline-width-pct',
        'building-radius',
        // Colour identity is fixed by the HA Energy palette (DEFAULT_*_COLOR_HEX in helios-config.ts); the renderer reads no
        // per-card override, so these stale keys get stripped.
        'sun-color',
        'cloud-color',
        'pv-color',
        'battery-color',
        'building-color',
        // LiDAR was removed in 2026.7.1 (forecast-based shading works everywhere, no provider inequality). All LiDAR keys are
        // listed here so an upgrading user's saved YAML self-heals on the next editor open without a one-shot migration.
        'lidar-precision',
        'lidar-local-ndsm-enabled',
        'lidar-local-ndsm-url',
        'lidar-local-ndsm-min-lat',
        'lidar-local-ndsm-max-lat',
        'lidar-local-ndsm-min-lon',
        'lidar-local-ndsm-max-lon',
        'lidar-view-point-size',
        'lidar-view-radius',
        'lidar-view-point-color',
        'lidar-view-point-opacity',
        'lidar-view-wireframe',
        'lidar-view-wireframe-color',
        'lidar-view-wireframe-opacity',
    ];
    private static _sanitiseConfig(config: HeliosConfig): HeliosConfig
    {
        const out = { ...config } as Record<string, unknown>;
        for (const k of HeliosCardEditor._RETIRED_KEYS)
        {
            if (k in out)
            {
                delete out[k];
            }
        }
        return out as HeliosConfig;
    }
    private static _configEq(a: HeliosConfig, b: HeliosConfig): boolean
    {
        const aKeys = Object.keys(a).sort();
        const bKeys = Object.keys(b).sort();
        if (aKeys.length !== bKeys.length)
        {
            return false;
        }
        for (let i = 0; i < aKeys.length; i++) if (aKeys[i] !== bKeys[i])
        {
            return false;
        }
        return true;
    }

    public connectedCallback(): void
    {
        super.connectedCallback();
        this._ensureEntityPicker();
    }

    // ha-entity-picker ships in HA's lazy-loaded card-editor bundle and may be unregistered in a fresh tab. Force the load by
    // creating a transient "entities" card and requesting its config element (the side effect registers the tag). Until then the
    // field falls back to a plain text input so it's never broken.
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
                    new Promise<void>(resolve => setTimeout(resolve, 8000))
                ]);
            }
        }
        catch (e)
        {
            console.warn('[HELIOS] Failed to lazy-load ha-entity-picker:', e);
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
        const next = { ...this._cfg, [key]: value } as Record<string, unknown>;
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
        this._cfg = next as HeliosConfig;
    }

    // Free-form numeric field. Empty input clears the option (card falls back to default); a finite number commits as-is; anything
    // else is ignored, leaving the previous value.
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

    // Slider commit. Updates local state synchronously so the thumb tracks the drag, but defers `config-changed` by
    // SLIDER_COMMIT_DELAY_MS so the engine doesn't see a flood of intermediate values.
    private _numSlider(key: keyof HeliosConfig, e: Event): void
    {
        const v = parseFloat((e.target as HTMLInputElement).value);
        if (!isFinite(v))
        {
            return;
        }

        // Local update only, no event dispatch yet.
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


    // Accordion contract: opening a section closes the others (_openSection binds each <details>'s `open` attribute). Collapsing the
    // open one falls back to "everything closed". Also scrolls the just-opened section into view on the next rAF tick (after layout
    // reflects the expanded body) so the user isn't left at the bottom of the previous section.
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

    private _fmtNum(v: number, step: number): string
    {
        return step >= 1 ? String(Math.round(v)) : v.toFixed(2);
    }

    // Solar-radiation entity filter: accepts the `irradiance` device class plus any sensor reporting W/m². The unit fallback covers
    // template sensors (e.g. Ecowitt) that don't declare a device_class.
    private _solarRadiationEntityFilter = (entity: any): boolean =>
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

    protected render(): TemplateResult
    {
        const c = this._cfg;
        const t = this._t();

        // Placeholders for the home lat/lon override fields: show HA's configured home (so the user sees what they'd override),
        // falling back to Amsterdam when HA hasn't set one. Non-binding hint text only; empty input means "use HA's home".
        const haLat = this.hass?.config?.latitude;
        const haLon = this.hass?.config?.longitude;
        const latPlaceholder = typeof haLat === 'number' && isFinite(haLat)
            ? String(haLat) : '52.379';
        const lonPlaceholder = typeof haLon === 'number' && isFinite(haLon)
            ? String(haLon) : '4.900';

        return html`
            <div class="editor">

                <details class="advanced-section" ?open="${this._openSection === 'location'}" @toggle="${(e: Event) => this._onSectionToggle('location', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:map-marker"></ha-icon>${t.editor.locationSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.homeLatitude}</span>
                    <input
                        type="number"
                        min="-90"
                        max="90"
                        step="any"
                        placeholder="${latPlaceholder}"
                        .value="${c['home-latitude'] != null ? String(c['home-latitude']) : ''}"
                        @change="${(e: Event) => this._numField('home-latitude', e)}"
                    />
                </label>
                <label class="field">
                    <span class="label">${t.editor.homeLongitude}</span>
                    <input
                        type="number"
                        min="-180"
                        max="180"
                        step="any"
                        placeholder="${lonPlaceholder}"
                        .value="${c['home-longitude'] != null ? String(c['home-longitude']) : ''}"
                        @change="${(e: Event) => this._numField('home-longitude', e)}"
                    />
                </label>
                <div class="hint">${t.editor.locationHint}</div>

                </details>

                <details class="advanced-section" ?open="${this._openSection === 'map'}" @toggle="${(e: Event) => this._onSectionToggle('map', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:map"></ha-icon>${t.editor.uiAndMapSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.mapStyle}</span>
                    <select
                        class="he-select"
                        .value="${String(c['map-style'] ?? 'streets')}"
                        @change="${(e: Event) => this._update('map-style', (e.target as HTMLSelectElement).value)}"
                    >
                        <option value="streets"   ?selected="${(String(c['map-style'] ?? 'streets')) === 'streets'}">${t.editor.mapStyleStreet}</option>
                        <option value="minimal"   ?selected="${(String(c['map-style'] ?? 'streets')) === 'minimal'}">${t.editor.mapStyleMinimal}</option>
                    </select>
                </label>
                <div class="hint">${t.editor.mapStyleHint}</div>
                <div class="field">
                    <span class="label">${t.editor.showLabels}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${(c['show-labels'] !== false) ? 'active' : ''}"
                            @click="${() => this._update('show-labels', true)}"
                        >${t.editor.labelsOn}</button>
                        <button
                            type="button"
                            class="seg-option ${(c['show-labels'] === false) ? 'active' : ''}"
                            @click="${() => this._update('show-labels', false)}"
                        >${t.editor.labelsOff}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.showLabelsHint}</div>
                <label class="field">
                    <span class="label">${t.editor.displayRadius ?? 'Rayon d\'affichage'}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min="${MIN_DISPLAY_RADIUS_M}"
                            max="${MAX_DISPLAY_RADIUS_M}"
                            step="10"
                            .value="${String(c['display-radius'] ?? DEFAULT_DISPLAY_RADIUS_M)}"
                            @input="${(e: Event) => this._numSlider('display-radius', e)}"
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['display-radius'] ?? DEFAULT_DISPLAY_RADIUS_M), 10)} m</span>
                    </div>
                </label>
                <div class="hint">${t.editor.displayRadiusHelp ?? 'Distance autour de la maison dans laquelle les bâtiments et les ombres sont rendus. Baissez cette valeur (jusqu\'à 50 m) pour fluidifier l\'affichage sur un téléphone ancien ou lent ; montez-la (jusqu\'à 500 m) pour une vue plus large. Par défaut 200 m.'}</div>
                <div class="field">
                    <span class="label">${t.editor.autoRotate}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${(c['auto-rotate-enabled'] === true) ? 'active' : ''}"
                            @click="${() => this._update('auto-rotate-enabled', true)}"
                        >${t.editor.autoRotateOn}</button>
                        <button
                            type="button"
                            class="seg-option ${(c['auto-rotate-enabled'] !== true) ? 'active' : ''}"
                            @click="${() => this._update('auto-rotate-enabled', false)}"
                        >${t.editor.autoRotateOff}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.autoRotateHint}</div>

                </details>

                <details class="advanced-section" ?open="${this._openSection === 'buildings'}" @toggle="${(e: Event) => this._onSectionToggle('buildings', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:office-building-outline"></ha-icon>${t.editor.buildingsSection}</summary>
                <label class="field">
                    <span class="label">${t.editor.buildingClusterRadius}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="100" step="1"
                            .value="${String(c['building-cluster-radius'] ?? DEFAULT_BUILDING_CLUSTER_RADIUS_M)}"
                            @input="${(e: Event) => this._numSlider('building-cluster-radius', e)}"
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['building-cluster-radius'] ?? DEFAULT_BUILDING_CLUSTER_RADIUS_M), 1)} m</span>
                    </div>
                </label>
                <label class="field">
                    <span class="label">${t.editor.buildingOpacity}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            .value="${String(c['building-opacity'] ?? DEFAULT_BUILDING_OPACITY)}"
                            @input="${(e: Event) => this._numSlider('building-opacity', e)}"
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['building-opacity'] ?? DEFAULT_BUILDING_OPACITY), 0.05)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.buildingsHint}</div>

                </details>

                <details class="advanced-section" ?open="${this._openSection === 'shadows'}" @toggle="${(e: Event) => this._onSectionToggle('shadows', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:weather-sunset-down"></ha-icon>${t.editor.shadowsSection}</summary>
                <div class="field">
                    <span class="label">${t.editor.shadowsEnabled}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${(c['shadows-enabled'] !== false) ? 'active' : ''}"
                            @click="${() => this._update('shadows-enabled', true)}"
                        >${t.editor.shadowsEnabledOn}</button>
                        <button
                            type="button"
                            class="seg-option ${(c['shadows-enabled'] === false) ? 'active' : ''}"
                            @click="${() => this._update('shadows-enabled', false)}"
                        >${t.editor.shadowsEnabledOff}</button>
                    </div>
                </div>
                <div class="hint">${t.editor.shadowsEnabledHint}</div>

                <label class="field">
                    <span class="label">${t.editor.shadowOpacity}</span>
                    <div class="slider-row">
                        <input
                            type="range" min="0" max="1" step="0.05"
                            .value="${String(c['shadow-opacity'] ?? DEFAULT_SHADOW_OPACITY)}"
                            @input="${(e: Event) => this._numSlider('shadow-opacity', e)}"
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['shadow-opacity'] ?? DEFAULT_SHADOW_OPACITY), 0.05)}</span>
                    </div>
                </label>
                <div class="hint">${t.editor.shadowOpacityHint}</div>

                </details>

                <details class="advanced-section" ?open="${this._openSection === 'dataDisplay'}" @toggle="${(e: Event) => this._onSectionToggle('dataDisplay', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:chart-timeline-variant"></ha-icon>${t.editor.dataDisplaySection}</summary>
                <label class="field">
                    <span class="label">${t.editor.displayUpdateFrequency}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min="${MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR}"
                            max="${MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR}"
                            step="1"
                            .value="${String(c['display-update-frequency-per-hour'] ?? DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR)}"
                            @input="${(e: Event) => this._numSlider('display-update-frequency-per-hour', e)}"
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
                            min="${MIN_VALUE_DECIMALS}"
                            max="${MAX_VALUE_DECIMALS}"
                            step="1"
                            .value="${String(c['value-decimals'] ?? DEFAULT_VALUE_DECIMALS)}"
                            @input="${(e: Event) => this._numSlider('value-decimals', e)}"
                        />
                        <span class="slider-value">${this._fmtNum(Number(c['value-decimals'] ?? DEFAULT_VALUE_DECIMALS), 1)}</span>
                    </div>
                </label>
                <div class="field-help">${t.editor.valueDecimalsHelp ?? 'Number of decimals shown on every value (power in kW, energy in kWh). 0 to 3.'}</div>
                </details>

                <details class="advanced-section" ?open="${this._openSection === 'installation'}" @toggle="${(e: Event) => this._onSectionToggle('installation', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:solar-power-variant"></ha-icon>${t.editor.installationSection}</summary>
                <div class="hint">${renderMarkdownLinks(t.editor.installationHint)}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.solarRadiationEntity}</span>
                    ${this._pickerReady ? html`
                        <ha-entity-picker
                            allow-custom-entity
                            .hass="${this.hass}"
                            .value="${String(c['solar-radiation-entity'] ?? '')}"
                            .includeDomains="${['sensor', 'input_number']}"
                            .entityFilter="${this._solarRadiationEntityFilter}"
                            @value-changed="${(e: CustomEvent) => this._update('solar-radiation-entity', e.detail.value ?? '')}"
                        ></ha-entity-picker>
                    ` : nothing}
                </div>
                <div class="field-help">${t.editor.solarRadiationEntityHelp}</div>

                </details>


                <details class="advanced-section" ?open="${this._openSection === 'reset'}" @toggle="${(e: Event) => this._onSectionToggle('reset', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:refresh"></ha-icon>${t.editor.resetSection}</summary>
                    <div class="hint">${t.editor.resetSectionHint}</div>
                    <div class="hint reset-warning">${t.editor.resetCacheWarning}</div>
                    <button
                        type="button"
                        class="reset-btn"
                        @click="${() => this._onResetCacheClick()}"
                    >${this._resetFeedback ?? t.editor.resetCacheButton}</button>
                </details>

                <details class="advanced-section about-section" ?open="${this._openSection === 'about'}" @toggle="${(e: Event) => this._onSectionToggle('about', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:information-outline"></ha-icon>${t.editor.aboutSection}</summary>
                    <!-- Identity + links column. Every row uses the same label-left, content-right
                         layout the version row established: a single .about-row line per piece of
                         info, the right side carrying the value (or a clickable link with icon).
                         The X brand mark is an inline SVG because the MDI icon set doesn't ship
                         the post-rebrand glyph and mdi:twitter would mis-label the platform. -->
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


    // Fires the window-level reset bus so every live HeliosCard drops its cached Open-Meteo payload + in-memory PV history and
    // re-fetches. Flashes a 2 s "Cache vidé" confirmation on the button so the user sees the click landed without an editor toast.
    private _resetFeedbackTimer?: number;
    @state() private _resetFeedback: string | null = null;

    private _onResetCacheClick(): void
    {
        try
        {
            window.dispatchEvent(new CustomEvent('helios-data-cache-reset'));
        }
        catch (_) {}
        const t = pickTranslations(this.hass?.language);
        this._resetFeedback = t.editor.resetCacheDone;
        if (this._resetFeedbackTimer !== undefined)
        {
            window.clearTimeout(this._resetFeedbackTimer);
        }
        this._resetFeedbackTimer = window.setTimeout(() =>
        {
            this._resetFeedback = null;
        }, 2000);
    }

    static styles = editorStyles;
}
