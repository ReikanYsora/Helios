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
    consumptionRingHidden,
    consumptionRingOrder,
} from '../core/config/helios-config';
import { deviceColorByIndex } from '../core/format/format';
import { pickTranslations, type Translations } from '../core/i18n';
import { subscribeEnergyPrefs, unsubscribeEnergyPrefs, EMPTY_ENERGY_DEFAULTS, type EnergyDefaults, type DeviceConsumption, type EnergyPrefsHost } from '../data/sources/energy-prefs';
import { createGridGuard, refreshGridGuard, type GridGuardState, type GridGuardHost } from '../data/sources/grid-guard';
import { batteryLiveIsBucketSourced } from '../data/sources/battery';
import './editor-custom-entity';
import type { CustomEntityConfigValue } from './editor-custom-entity';


// Visual editor exposing every config option through native HA form controls.
@customElement('helios-card-editor')
export class HeliosCardEditor extends LitElement
{
    @property({ attribute: false }) public hass?: any;
    @state()                        private _cfg: HeliosConfig = {};
    @state()                        private _pickerReady = false;
    // Accordion: at most one top-level section open at a time (a stack of expanded blocks got too tall to scan). Id
    // of the open section, or null when all collapsed. Defaults to null so a fresh card opens fully collapsed, keeping
    // the top-pinned "Configuration status" panel in view.
    @state()                        private _openSection: string | null = null;
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
        unsubscribeEnergyPrefs(this as unknown as EnergyPrefsHost);
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

    //Energy dashboard wiring snapshot + mis-scope guard, powering the live-data status lines: the editor
    //states plainly which live chips can exist with the current HA Energy configuration and why.
    @state() _energyDefaults: EnergyDefaults = EMPTY_ENERGY_DEFAULTS;
    @state() _energyDefaultsLoaded = false;
    _energyPrefsUnsub?: (() => void) | undefined;
    _gridGuard: GridGuardState = createGridGuard();

    public connectedCallback(): void
    {
        super.connectedCallback();
        this._ensureEntityPicker();
        subscribeEnergyPrefs(this as unknown as EnergyPrefsHost);
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

    protected updated(): void
    {
        //Guard evaluation for the grid status line; no-op outside its preconditions / between re-arms.
        if (this.hass) { refreshGridGuard(this as unknown as GridGuardHost); }
        this._pruneStaleDeviceIds();
    }

    //Drop any hidden / order id whose device no longer exists in the Energy dashboard, so removing a
    //device there also cleans it from this card's YAML. Guarded on a NON-EMPTY loaded snapshot: an empty one can also
    //mean the prefs failed to load (RBAC), and wiping the lists then would silently lose the user's choices. Writes
    //only when something actually changed, so it converges after a single pass and never loops.
    private _pruneStaleDeviceIds(): void
    {
        if (!this._energyDefaultsLoaded) { return; }
        const devices = this._energyDefaults.devices;
        if (devices.length === 0) { return; }
        const valid = new Set(devices.map(d => d.statConsumption));
        const keys: (keyof HeliosConfig)[] = ['consumption-ring-hidden', 'consumption-ring-order'];
        const next = { ...this._cfg } as Record<string, unknown>;
        let changed = false;
        for (const key of keys)
        {
            const cur = this._cfg[key];
            if (!Array.isArray(cur)) { continue; }
            const kept = cur.filter((v): v is string => typeof v === 'string' && valid.has(v));
            if (kept.length === cur.length) { continue; }
            changed = true;
            if (kept.length) { next[key] = kept; } else { delete next[key]; }
        }
        if (!changed) { return; }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
        this._cfg = next as HeliosConfig;
    }

    //One live-data status line: check or alert glyph + the explanation.
    private _liveStatusLine(ok: boolean, warn: boolean, text: string)
    {
        const icon = ok ? 'mdi:check-circle' : (warn ? 'mdi:alert-circle' : 'mdi:information-outline');
        const cls  = ok ? 'is-ok' : (warn ? 'is-warn' : 'is-info');
        return html`
            <div class="live-status ${cls}">
                <ha-icon icon=${icon}></ha-icon>
                <span>${text}</span>
            </div>
        `;
    }

    //Live-data status, pinned at the top of the editor (outside every section) so setup gaps surface at once.
    //One line per energy family whether or not it is configured in the HA Energy dashboard: a configured
    //family reports whether its live chip can exist (and what to add if not), a family that is not set up says
    //so, so the list reads as the full path to every chip. The home line closes it, since home consumption is
    //derived from the families above. Silent until the prefs snapshot lands.
    private _renderLiveDataStatus(t: Translations)
    {
        if (!this._energyDefaultsLoaded) { return nothing; }
        const d = this._energyDefaults;

        const solarWired   = d.solarStatEnergyFroms.length > 0;
        const gridWired    = d.gridStatEnergyFroms.length > 0 || d.gridStatEnergyTos.length > 0;
        const batteryWired = d.batteryStatEnergyFroms.length > 0 || d.batteryStatEnergyTos.length > 0;

        const gridFlagged  = this._gridGuard.status === 'flagged';
        const solarLive    = d.solarStatRates.length > 0;
        const gridLive     = d.gridStatRates.length > 0 && !gridFlagged;
        const batteryLive  = !batteryLiveIsBucketSourced(d);

        //Home consumption is derived: it needs every family the user DID configure to expose its live sensor.
        const homeReady = (solarWired || gridWired || batteryWired)
            && (!solarWired   || solarLive)
            && (!gridWired    || gridLive)
            && (!batteryWired || batteryLive);

        return html`
            <div class="live-data-panel">
                <div class="section-title"><ha-icon class="section-icon" icon="mdi:list-status"></ha-icon>${t.editor.liveDataTitle ?? 'Configuration status'}</div>
                <div class="hint">${t.editor.liveDataIntro ?? 'Live chips show measured sensors only. Each family needs the optional live power sensor of its energy dashboard source; curves and totals always come from your meters.'}</div>

                ${solarWired
                    ? this._liveStatusLine(solarLive, false, solarLive
                        ? (t.editor.liveSolarOk ?? 'Solar: live power sensor detected.')
                        : (t.editor.liveSolarMissing ?? 'Solar: no live power sensor, the production chip stays hidden. Add one under Settings > Dashboards > Energy > Solar panels.'))
                    : this._liveStatusLine(false, false, t.editor.liveSolarAbsent ?? 'Solar: not set up in your Energy dashboard. Add solar panels there to get the production chip.')}

                ${gridWired
                    ? this._liveStatusLine(gridLive, gridFlagged, gridFlagged
                        ? (t.editor.liveGridMiswired ?? 'Grid: the live power sensor contradicts your meters (it seems to measure a single direction). The chips stay hidden; configure a signed sensor or the Two sensors mode.')
                        : (gridLive
                            ? (t.editor.liveGridOk ?? 'Grid: live power sensor detected.')
                            : (t.editor.liveGridMissing ?? 'Grid: no live power sensor, the import/export chips stay hidden. Add one under Settings > Dashboards > Energy > Grid.')))
                    : this._liveStatusLine(false, false, t.editor.liveGridAbsent ?? 'Grid: not set up in your Energy dashboard. Add the grid there to get the import and export chips.')}

                ${batteryWired
                    ? this._liveStatusLine(batteryLive, false, batteryLive
                        ? (t.editor.liveBatteryOk ?? 'Battery: live power sensors cover every battery.')
                        : (t.editor.liveBatteryMissing ?? 'Battery: live power missing on at least one battery, the power chip stays hidden. Add the power sensor(s) under Settings > Dashboards > Energy > Battery.'))
                    : this._liveStatusLine(false, false, t.editor.liveBatteryAbsent ?? 'Battery: not set up in your Energy dashboard. Add a battery there to get the charge and discharge chip.')}

                ${this._liveStatusLine(homeReady, false, homeReady
                    ? (t.editor.liveHomeOk ?? 'Home consumption: shown, derived from the live families above.')
                    : (t.editor.liveHomeNote ?? 'Home consumption: appears once every configured family above has its live sensor.'))}
            </div>
        `;
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

    //---- Custom entity (measured-only: both sensors required) -------------------------------------------
    //Migration from the legacy single slot: while the new keys are empty, the old entity prefills the field
    //matching its device class so the user only adds the missing half; the first edit persists the new keys
    //and drops the legacy one.
    private _legacyCustomId(): string
    {
        const raw = this._cfg?.['custom-entity'];
        return typeof raw === 'string' ? raw.trim() : '';
    }

    private _legacyCustomIsPower(): boolean
    {
        const st = this.hass?.states?.[this._legacyCustomId()];
        const dc = String(st?.attributes?.device_class ?? '');
        const u  = String(st?.attributes?.unit_of_measurement ?? '').trim().toLowerCase();
        return dc === 'power' || u === 'w' || u === 'kw' || u === 'mw';
    }

    private _customLegacyPending(): boolean
    {
        const c = this._cfg as Record<string, unknown> | undefined;
        return this._legacyCustomId() !== ''
            && !c?.['custom-power-entity']
            && !c?.['custom-energy-entity'];
    }

    private _customConfigValue(): CustomEntityConfigValue
    {
        const c = (this._cfg ?? {}) as Record<string, unknown>;
        let power  = typeof c['custom-power-entity']  === 'string' ? String(c['custom-power-entity'])  : '';
        let energy = typeof c['custom-energy-entity'] === 'string' ? String(c['custom-energy-entity']) : '';
        if (this._customLegacyPending())
        {
            if (this._legacyCustomIsPower()) { power = this._legacyCustomId(); }
            else                             { energy = this._legacyCustomId(); }
        }
        return {
            power,
            energy,
            color: typeof c['custom-entity-color'] === 'string' ? String(c['custom-entity-color']) : 'red',
            icon:  typeof c['custom-entity-icon']  === 'string' ? String(c['custom-entity-icon'])  : '',
        };
    }

    private _onCustomEntityChanged = (e: CustomEvent<{ value: CustomEntityConfigValue }>): void =>
    {
        e.stopPropagation();
        const v    = e.detail.value;
        const next = { ...this._cfg } as Record<string, unknown>;
        //One write for the four keys; empties clear their key so the YAML stays minimal. The legacy single
        //slot is dropped on the first edit (its value now lives in the matching new field).
        const setOrClear = (key: string, val: string): void =>
        {
            if (val) { next[key] = val; } else { delete next[key]; }
        };
        setOrClear('custom-power-entity',  v.power);
        setOrClear('custom-energy-entity', v.energy);
        setOrClear('custom-entity-icon',   v.icon);
        if (v.color && v.color !== 'red') { next['custom-entity-color'] = v.color; } else { delete next['custom-entity-color']; }
        delete next['custom-entity'];
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
        this._cfg = next as HeliosConfig;
    };

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
    //Toggle a device's presence in the ring-hidden list (presence = hidden). Stored back trimmed to undefined when
    //empty so the YAML drops the key.
    private _onDeviceToggleClick = (e: Event): void =>
    {
        const stat = (e.currentTarget as HTMLElement).dataset.stat;
        if (!stat) { return; }
        const cur  = this._cfg['consumption-ring-hidden'];
        const list = Array.isArray(cur) ? cur.filter((v): v is string => typeof v === 'string') : [];
        const next = list.includes(stat) ? list.filter(v => v !== stat) : [...list, stat];
        this._update('consumption-ring-hidden', next.length ? next : undefined);
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

    //One segmented on/off toggle field with its hint. Same markup for every boolean config key. `defaultOn` picks
    //the default when the key is unset (some toggles default on, read as `!== false`). On/off labels default to the
    //shared generic ones but can be overridden per toggle.
    private _renderToggle(
        key: string, label: string, hint: string,
        onLabel?: string, offLabel?: string, defaultOn = false,
    ): TemplateResult
    {
        const c  = this._cfg as Record<string, unknown>;
        const on = defaultOn ? c[key] !== false : c[key] === true;
        const t  = this._t();
        return html`
                <div class="field">
                    <span class="label">${label}</span>
                    <div class="segmented-toggle">
                        <button
                            type="button"
                            class="seg-option ${on ? 'active' : ''}"
                            data-key=${key} data-value="true"
                            @click=${this._onBoolToggleClick}
                        >${onLabel ?? t.editor.autoRotateOn}</button>
                        <button
                            type="button"
                            class="seg-option ${!on ? 'active' : ''}"
                            data-key=${key} data-value="false"
                            @click=${this._onBoolToggleClick}
                        >${offLabel ?? t.editor.autoRotateOff}</button>
                    </div>
                </div>
                <div class="hint">${hint}</div>`;
    }

    //One ui_color picker field (label + ha-selector + help). Same markup for every colour config key.
    private _renderColorPicker(key: string, label: string, help: string, defaultColor: string): TemplateResult
    {
        const c = this._cfg as Record<string, unknown>;
        return html`
                <div class="field field-block">
                    <span class="label">${label}</span>
                    ${this._pickerReady ? html`
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{ ui_color: { default_color: defaultColor } }}
                            .value=${String(c[key] ?? defaultColor)}
                            data-key=${key}
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>
                    ` : nothing}
                </div>
                <div class="field-help">${help}</div>`;
    }

    //One range-slider field (label + range input + live value). Same markup for every numeric config key; the hint
    //stays at the call site since some are per-field and some are shared. `suffix` is appended to the live value.
    private _renderSlider(key: string, label: string, min: number, max: number, step: number, dflt: number, suffix = ''): TemplateResult
    {
        const c   = this._cfg as Record<string, unknown>;
        const raw = c[key] ?? dflt;
        return html`
                <label class="field">
                    <span class="label">${label}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${min}
                            max=${max}
                            step=${step}
                            .value=${String(raw)}
                            data-key=${key}
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(raw), step)}${suffix}</span>
                    </div>
                </label>`;
    }

    //Consumption-ring section body: one draggable row per dashboard-tracked device. Each row carries a drag handle,
    //a colour dot (HA's per-index palette, matching the dashboard graph), the device icon, its friendly name, and the
    //show/hide-in-the-ring toggle. Devices come from the live Energy prefs snapshot, ordered by the saved drag order.
    //Resolved display name for a tracked device: its dashboard name, else the entity's friendly name, else the id.
    private _deviceName(dev: DeviceConsumption): string
    {
        return dev.name || this.hass?.states?.[dev.statConsumption]?.attributes?.friendly_name || dev.statConsumption;
    }

    //The device entity's configured MDI icon (its `icon` attribute), else a generic energy glyph.
    private _deviceIcon(dev: DeviceConsumption): string
    {
        const icon = this.hass?.states?.[dev.statConsumption]?.attributes?.icon;
        return (typeof icon === 'string' && icon) || 'mdi:flash';
    }

    //Devices in the display order the rings follow: the user's saved drag order first, anything not yet in it
    //appended alphabetically. Shared by the render and the drag handler so both agree on the sequence.
    private _orderedDevices(): DeviceConsumption[]
    {
        const order = consumptionRingOrder(this._cfg);
        const rank  = (id: string): number => { const i = order.indexOf(id); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
        return [...this._energyDefaults.devices].sort((a, b) =>
            rank(a.statConsumption) - rank(b.statConsumption)
            || this._deviceName(a).localeCompare(this._deviceName(b), undefined, { sensitivity: 'base' }));
    }

    //Drag + drop reorder (HA's ha-sortable): move the dragged id and persist the full order so the rings follow it.
    private _onDeviceMoved = (ev: CustomEvent<{ oldIndex: number; newIndex: number }>): void =>
    {
        ev.stopPropagation();
        const { oldIndex, newIndex } = ev.detail;
        const ids = this._orderedDevices().map(d => d.statConsumption);
        if (oldIndex < 0 || oldIndex >= ids.length || newIndex < 0 || newIndex >= ids.length) { return; }
        ids.splice(newIndex, 0, ids.splice(oldIndex, 1)[0]);
        this._update('consumption-ring-order', ids);
    };

    private _renderConsumptionRing(t: Translations): TemplateResult
    {
        const devices = this._orderedDevices();
        const hidden  = consumptionRingHidden(this._cfg);
        return html`
            <div class="hint">${t.editor.consumptionRingDevicesIntro ?? 'Devices tracked in your Energy dashboard. Drag to reorder the rings, and use the eye to show or hide a device in the ring.'}</div>
            ${devices.length === 0
                ? html`<div class="cring-empty">${t.editor.consumptionRingNoDevices ?? 'No individual devices are tracked in your Energy dashboard yet. Add device consumption there to control them here.'}</div>`
                : html`<ha-sortable handle-selector=".cring-handle" @item-moved=${this._onDeviceMoved}>
                    <div class="cring-list">
                        ${devices.map(dev => this._renderDeviceRow(dev, hidden, t))}
                    </div>
                </ha-sortable>`}
        `;
    }

    private _renderDeviceRow(dev: DeviceConsumption, hidden: Set<string>, t: Translations): TemplateResult
    {
        const stat  = dev.statConsumption;
        const name  = this._deviceName(dev);
        const color = deviceColorByIndex(this, dev.index);
        const shown = !hidden.has(stat);
        return html`
            <div class="cring-row ${shown ? '' : 'is-hidden'}">
                <ha-icon class="cring-handle" icon="mdi:drag"></ha-icon>
                <span class="cring-dot" style="background:${color}"></span>
                <ha-icon class="cring-icon" icon=${this._deviceIcon(dev)}></ha-icon>
                <span class="cring-name">${name}</span>
                <button
                    type="button"
                    class="cring-toggle ${shown ? 'active' : ''}"
                    data-stat=${stat}
                    aria-pressed=${shown ? 'true' : 'false'}
                    aria-label=${t.editor.consumptionRingRingLabel ?? 'Show in the ring'}
                    @click=${this._onDeviceToggleClick}
                >
                    <ha-icon icon=${shown ? 'mdi:eye' : 'mdi:eye-off'}></ha-icon>
                </button>
            </div>
        `;
    }

    //Custom-entity picker filter: any power (W/kW/MW) or energy (Wh/kWh/MWh) entity, by device_class or unit.
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

                ${this._renderLiveDataStatus(t)}

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
                ${this._renderToggle('auto-rotate-enabled', t.editor.autoRotate, t.editor.autoRotateHint)}
                ${this._renderToggle('auto-hide-ui', t.editor.noUiMode ?? 'No UI mode', t.editor.noUiModeHint ?? 'Fade the timeline and the on-card controls after a few seconds of inactivity. Any tap or move brings them back. Great for a wall display.')}

                </details>

                <details class="advanced-section" data-section="dataDisplay" ?open=${this._openSection === 'dataDisplay'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:gauge"></ha-icon>${t.editor.dataDisplaySection}</summary>
                ${this._renderSlider('display-update-frequency-per-hour', t.editor.displayUpdateFrequency, MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, 1, DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, ' / h')}
                <div class="field-help">${t.editor.displayUpdateFrequencyHelp}</div>
                ${this._renderSlider('value-decimals', t.editor.valueDecimals ?? 'Value decimals', MIN_VALUE_DECIMALS, MAX_VALUE_DECIMALS, 1, DEFAULT_VALUE_DECIMALS)}
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
                <div class="field field-block">
                    <span class="label">${t.editor.batterySign ?? 'Battery sign'}</span>
                    ${this._pickerReady ? html`
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{ select: { mode: 'box', options: [
                                { value: 'default', label: t.editor.batterySignDefault ?? 'Default' },
                                { value: 'inverted', label: t.editor.batterySignInverted ?? 'Inverted' },
                                { value: 'hidden', label: t.editor.batterySignHidden ?? 'Hidden' },
                            ] } }}
                            .value=${String(c['battery-sign'] ?? 'default')}
                            data-key="battery-sign"
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>
                    ` : nothing}
                </div>
                <div class="field-help">${t.editor.batterySignHelp ?? 'Sign shown on the battery chip: default (minus while charging), inverted (plus while charging), or hidden.'}</div>
                <div class="hint">${t.editor.customEntityIntro ?? 'Custom entity: displayed only when BOTH sensors below are set. The power sensor feeds the live chip and the curve, the energy sensor feeds the energy views. Nothing is estimated.'}</div>
                ${this._customLegacyPending() ? html`
                    <div class="hint reset-warning">${t.editor.customLegacyHint ?? 'Your previous custom entity was moved to its matching field below. Add the missing sensor to show the chip again.'}</div>
                ` : nothing}
                <div class="entity-block">
                    <helios-custom-entity-config
                        .hass=${this.hass}
                        .pickerReady=${this._pickerReady}
                        .value=${this._customConfigValue()}
                        .labels=${{
                            power:      t.editor.customPowerEntity ?? 'Power sensor (live)',
                            powerHelp:  t.editor.customPowerEntityHelp ?? 'A real power sensor (W/kW). Feeds the live chip, the scrub and the curve.',
                            energy:     t.editor.customEnergyEntity ?? 'Energy sensor (totals)',
                            energyHelp: t.editor.customEnergyEntityHelp ?? 'A cumulative energy meter (Wh/kWh). Feeds the energy views.',
                            icon:       t.editor.customEntityIcon,
                            color:      t.editor.customEntityColor,
                        }}
                        @value-changed=${this._onCustomEntityChanged}
                    ></helios-custom-entity-config>
                </div>

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

                <details class="advanced-section" data-section="consumptionRing" ?open=${this._openSection === 'consumptionRing'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:chart-donut"></ha-icon>${t.editor.consumptionRingSection ?? 'Consumption ring'}</summary>
                ${this._renderConsumptionRing(t)}
                </details>

                <details class="advanced-section" data-section="buildings" ?open=${this._openSection === 'buildings'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:office-building-outline"></ha-icon>${t.editor.buildingsSection}</summary>
                ${this._renderSlider('display-radius', t.editor.displayRadius ?? 'Display radius', MIN_DISPLAY_RADIUS_M, MAX_DISPLAY_RADIUS_M, 10, DEFAULT_DISPLAY_RADIUS_M, ' m')}
                <div class="hint">${t.editor.displayRadiusHelp ?? 'Radius around the home in which buildings are fetched and drawn, up to the edge of the faded map disc. Lower it to lighten rendering on a slow device; 0 shows just the home.'}</div>
                ${this._renderSlider('building-count', t.editor.buildingCount ?? 'Building count', MIN_BUILDING_COUNT, MAX_BUILDING_COUNT, 5, DEFAULT_BUILDING_COUNT)}
                <div class="hint">${t.editor.buildingCountHelp ?? 'Maximum number of nearby buildings to draw. Lower it to lighten rendering on a slow device.'}</div>
                ${this._renderToggle('building-real-size', t.editor.buildingRealSize ?? 'Real building heights', t.editor.buildingRealSizeHint ?? 'On: use real OpenStreetMap heights (capped to keep the framing readable). Off: give every building the same fixed height below.', t.editor.buildingRealSizeOn ?? 'On', t.editor.buildingRealSizeOff ?? 'Off', true)}
                ${c['building-real-size'] === false
                    ? this._renderSlider('building-height', t.editor.buildingHeight ?? 'Building height', MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M, 0.5, FIXED_BUILDING_HEIGHT_M, ' m')
                    : nothing}
                ${this._renderSlider('building-cluster-radius', t.editor.buildingClusterRadius, 0, 100, 1, DEFAULT_BUILDING_CLUSTER_RADIUS_M, ' m')}
                ${this._renderSlider('building-opacity', t.editor.buildingOpacity, 0, 1, 0.05, DEFAULT_BUILDING_OPACITY)}
                <div class="hint">${t.editor.buildingsHint}</div>
                ${this._renderColorPicker('home-color', t.editor.homeColor, t.editor.homeColorHelp, 'green')}
                ${this._renderColorPicker('building-color', t.editor.buildingColor, t.editor.buildingColorHelp, 'grey')}

                </details>

                <details class="advanced-section" data-section="shadows" ?open=${this._openSection === 'shadows'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:gradient-vertical"></ha-icon>${t.editor.shadowsSection}</summary>
                ${this._renderToggle('shadows-enabled', t.editor.shadowsEnabled, t.editor.shadowsEnabledHint, t.editor.shadowsEnabledOn, t.editor.shadowsEnabledOff, true)}

                ${this._renderSlider('shadow-opacity', t.editor.shadowOpacity, 0, 1, 0.05, DEFAULT_SHADOW_OPACITY)}
                <div class="hint">${t.editor.shadowOpacityHint}</div>

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
