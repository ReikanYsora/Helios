import type { TemplateResult} from 'lit';
import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import type { HassLike } from '../core/ha-types';
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
    DEFAULT_MAX_EXPECTED_POWER_W,
    MIN_MAX_EXPECTED_POWER_W,
    MAX_MAX_EXPECTED_POWER_W,
    DEFAULT_NO_UI_DELAY_S,
    MIN_NO_UI_DELAY_S,
    MAX_NO_UI_DELAY_S,
    hiddenDevices,
    monitoringGroups,
    monitoringGroupName,
    monitoringGroupColor,
    monitoringGroupColorToken,
    monitoringGroupIcon,
    groupChipVisible,
    chipVisible,
    GROUP_COUNT,
    mapThemeMode,
    mapLayerColor,
    mapLayerVisible,
    mapColorKey,
    mapShowKey,
    type MapThemeMode,
} from '../core/config/helios-config';
import { CHIP_SLOTS, chipSlotColor, chipSlotIcon, type ChipSlot } from '../core/config/chip-appearance';
import { defaultGroundPalette, GROUND_LAYER_KEYS, type GroundLayerKey } from '../scene/ground-render';
import { deviceColorByIndex, isDarkFromCss } from '../core/format/format';
import { pickTranslations, type Translations } from '../core/i18n';
import { subscribeEnergyPrefs, unsubscribeEnergyPrefs, EMPTY_ENERGY_DEFAULTS, type EnergyDefaults, type DeviceConsumption, type EnergyPrefsHost } from '../data/sources/energy-prefs';
import { createGridGuard, refreshGridGuard, type GridGuardState, type GridGuardHost } from '../data/sources/grid-guard';
import { batteryLiveIsBucketSourced } from '../data/sources/battery';



// Visual editor exposing every config option through native HA form controls.
@customElement('helios-card-editor')
export class HeliosCardEditor extends LitElement
{
    @property({ attribute: false }) public hass?: HassLike;
    @state()                        private _cfg: HeliosConfig = {};
    @state()                        private _pickerReady = false;
    //Bumped whenever a colour picker is cleared with its X, to force that picker to be re-created (via keyed) so
    //it re-reads its fallback default value even when the config key was already unset (a no-op edit).
    @state()                        private _colorNonce = 0;
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

    //Latest camera pose published by the live preview (helios-camera-pose event). Captured into the config when
    //the user turns on the camera lock. Null until the preview has published a pose (fires on init + every move).
    private _livePose: { bearing: number; pitch: number } | null = null;
    private readonly _onCameraPose = (e: Event): void =>
    {
        const d = (e as CustomEvent).detail;
        if (!d || typeof d.bearing !== 'number' || typeof d.pitch !== 'number')
        {
            return;
        }
        this._livePose = { bearing: d.bearing, pitch: d.pitch };
    };
    //Turning the lock on freezes AND saves the current framed angle into the config, so the exact view propagates
    //to every device/browser (the drag-set pose otherwise lives only in per-device localStorage). One write.
    private _lockCameraToCurrentView(): void
    {
        const pose = this._livePose;
        const next = { ...this._cfg } as Record<string, unknown>;
        next['camera-locked'] = true;
        if (pose)
        {
            next['camera-bearing-deg'] = Math.round(((pose.bearing % 360) + 360) % 360);
            next['camera-pitch-deg']   = Math.round(pose.pitch);
        }
        this._commit(next);
    }

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        window.removeEventListener('helios-camera-pose', this._onCameraPose);
        unsubscribeEnergyPrefs(this as unknown as EnergyPrefsHost);
        for (const t of this._sliderDebounce.values())
        {
            window.clearTimeout(t);
        }
        this._sliderDebounce.clear();
        // Clear the reset confirmation/feedback timers; otherwise a fast unmount lets one fire on a dead element and
        // warn about touching @state after disconnect.
        for (const timer of [this._resetFeedbackTimer, this._optionsResetConfirmTimer, this._optionsResetFeedbackTimer])
        {
            if (timer !== undefined)
            {
                window.clearTimeout(timer);
            }
        }
        this._resetFeedbackTimer = undefined;
        this._optionsResetConfirmTimer = undefined;
        this._optionsResetFeedbackTimer = undefined;
    }

    //Legacy custom-entity config keys that may linger in an older YAML; stripped on load so the saved config stays clean.
    private static readonly LEGACY_KEYS = ['custom-power-entity', 'custom-energy-entity', 'custom-entity', 'custom-entity-icon', 'custom-entity-color'];
    //Lovelace-managed keys, preserved by the "reset options" button (the card `type` is mandatory; the layout keys
    //keep the card's dashboard placement/size). Everything else is a Helios option and gets cleared.
    private static readonly LOVELACE_KEYS = ['type', 'view_layout', 'grid_options', 'layout_options'];

    public setConfig(config: HeliosConfig): void
    {
        this._cfg = { ...config };
        //Drop any legacy custom-entity keys from an older YAML. Deferred so config-changed isn't dispatched inside
        //the host's setConfig call stack.
        if (HeliosCardEditor.LEGACY_KEYS.some(k => k in this._cfg))
        {
            setTimeout(() =>
            {
                if (!this.isConnected)
                {
                    return;
                }   //editor detached before the tick: nothing to dispatch onto
                const next = { ...this._cfg } as Record<string, unknown>;
                let changed = false;
                for (const k of HeliosCardEditor.LEGACY_KEYS)
                {
                    if (k in next)
                    {
                        delete next[k]; changed = true;
                    }
                }
                if (changed)
                {
                    this._commit(next);
                }
            }, 0);
        }
        //Assign a hidden, per-card cache id the first time the card is configured. It keeps each card's saved view
        //isolated and is never shown or editable. Deferred so config-changed isn't dispatched inside the host's
        //setConfig call stack; guarded so it fires once.
        if (!this._cfg['cache-id'])
        {
            const id = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
            setTimeout(() =>
            {
                if (!this.isConnected)
                {
                    return;
                }   //editor detached before the tick: skip the deferred update
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
        window.addEventListener('helios-camera-pose', this._onCameraPose);
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
                    new Promise<void>(resolve =>
                    {
                        setTimeout(resolve, HeliosCardEditor.PICKER_LOAD_TIMEOUT_MS);
                    })
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
        if (this.hass)
        {
            refreshGridGuard(this as unknown as GridGuardHost);
        }
        this._pruneStaleDeviceIds();
    }

    //Drop any hidden id whose device no longer exists in the Energy dashboard, so removing a
    //device there also cleans it from this card's YAML. Guarded on a NON-EMPTY loaded snapshot: an empty one can also
    //mean the prefs failed to load (RBAC), and wiping the lists then would silently lose the user's choices. Writes
    //only when something actually changed, so it converges after a single pass and never loops.
    private _pruneStaleDeviceIds(): void
    {
        if (!this._energyDefaultsLoaded)
        {
            return;
        }
        const devices = this._energyDefaults.devices;
        if (devices.length === 0)
        {
            return;
        }
        const valid = new Set(devices.map(d => d.statConsumption));
        const keys: (keyof HeliosConfig)[] = ['hidden-devices'];
        const next = { ...this._cfg } as Record<string, unknown>;
        let changed = false;
        for (const key of keys)
        {
            const cur = this._cfg[key];
            if (!Array.isArray(cur))
            {
                continue;
            }
            const kept = cur.filter((v): v is string => typeof v === 'string' && valid.has(v));
            if (kept.length === cur.length)
            {
                continue;
            }
            changed = true;
            if (kept.length)
            {
                next[key] = kept;
            }
            else
            {
                delete next[key];
            }
        }
        //Groups are an object map (id -> 1..4), not an array: drop entries whose device is gone.
        const groupsRaw = this._cfg['monitoring-groups'];
        if (groupsRaw && typeof groupsRaw === 'object' && !Array.isArray(groupsRaw))
        {
            const kept: Record<string, number> = {};
            let dropped = false;
            for (const [k, v] of Object.entries(groupsRaw as Record<string, unknown>))
            {
                if (valid.has(k) && typeof v === 'number')
                {
                    kept[k] = v;
                }
                else
                {
                    dropped = true;
                }
            }
            if (dropped)
            {
                changed = true;
                if (Object.keys(kept).length)
                {
                    next['monitoring-groups'] = kept;
                }
                else
                {
                    delete next['monitoring-groups'];
                }
            }
        }
        if (!changed)
        {
            return;
        }
        this._commit(next);
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

    //One-tap jump to Home Assistant's Energy configuration (a single dashboard covers solar / grid / battery;
    //HA has no per-family deep anchor). Shown once under the status section and under the groups hint.
    private _energyConfigLink()
    {
        const t = this._t();
        return html`
            <a class="live-status-link" href="/config/energy/dashboard" target="_blank" rel="noopener noreferrer">
                <ha-icon icon="mdi:open-in-new"></ha-icon>
                <span>${t.editor.openEnergyConfig}</span>
            </a>
        `;
    }

    //Live-data status, pinned at the top of the editor (outside every section) so setup gaps surface at once.
    //One line per energy family whether or not it is configured in the HA Energy dashboard: a configured
    //family reports whether its live chip can exist (and what to add if not), a family that is not set up says
    //so, so the list reads as the full path to every chip. The home line closes it, since home consumption is
    //derived from the families above. Silent until the prefs snapshot lands.
    private _renderLiveDataStatus(t: Translations)
    {
        if (!this._energyDefaultsLoaded)
        {
            return nothing;
        }
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
                <div class="section-title"><ha-icon class="section-icon" icon="mdi:list-status"></ha-icon>${t.editor.liveDataTitle}</div>
                <div class="hint">${t.editor.liveDataIntro}</div>

                ${solarWired
        ? this._liveStatusLine(solarLive, false, solarLive
            ? (t.editor.liveSolarOk)
            : (t.editor.liveSolarMissing))
        : this._liveStatusLine(false, false, t.editor.liveSolarAbsent)}

                ${gridWired
        ? this._liveStatusLine(gridLive, gridFlagged, gridFlagged
            ? (t.editor.liveGridMiswired)
            : (gridLive
                ? (t.editor.liveGridOk)
                : (t.editor.liveGridMissing)))
        : this._liveStatusLine(false, false, t.editor.liveGridAbsent)}

                ${batteryWired
        ? this._liveStatusLine(batteryLive, false, batteryLive
            ? (t.editor.liveBatteryOk)
            : (t.editor.liveBatteryMissing))
        : this._liveStatusLine(false, false, t.editor.liveBatteryAbsent)}

                ${this._liveStatusLine(homeReady, false, homeReady
        ? (t.editor.liveHomeOk)
        : (t.editor.liveHomeNote))}

                <div class="live-config-link-row">${this._energyConfigLink()}</div>
            </div>
        `;
    }

    //Dispatches config-changed with the built next config and mirrors it into local state; the shared tail every
    //mutator ends with once it has assembled its next config object.
    private _commit(next: Record<string, unknown>): void
    {
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
        this._cfg = next as HeliosConfig;
    }

    private _update(key: keyof HeliosConfig, value: unknown): void
    {
        const next = { ...this._cfg } as Record<string, unknown>;
        //undefined clears the key entirely so the YAML drops it (resolvers fall back to their default), rather
        //than persisting an explicit `key: undefined`.
        if (value === undefined)
        {
            delete next[key];
        }
        else
        {
            next[key] = value;
        }
        this._commit(next);
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
        if (section)
        {
            this._onSectionToggle(section, e);
        }
    };
    private _onNumFieldChange = (e: Event): void =>
    {
        const key = (e.currentTarget as HTMLElement).dataset.key as keyof HeliosConfig | undefined;
        if (key)
        {
            this._numField(key, e);
        }
    };
    private _onNumSliderInput = (e: Event): void =>
    {
        const key = (e.currentTarget as HTMLElement).dataset.key as keyof HeliosConfig | undefined;
        if (key)
        {
            this._numSlider(key, e);
        }
    };
    private _onEntityValueChanged = (e: CustomEvent): void =>
    {
        const key = (e.currentTarget as HTMLElement).dataset.key as keyof HeliosConfig | undefined;
        if (!key)
        {
            return;
        }
        //Empty/undefined is a real edit: an entity cleared, or a colour reset to the card default via the picker's
        //clear affordance (ui_color emits undefined when the chosen token equals its default). Store it as unset so
        //the resolver falls back to the default. The picker never emits on init, so there is no echo to filter.
        const raw     = (e as CustomEvent<{ value?: unknown }>).detail.value;
        const cleared = raw === undefined || raw === null || raw === '';
        const next    = cleared ? undefined : raw;
        //Clearing a picker (its X) must snap back to the default. When the key is already unset, storing undefined
        //is a no-op that would leave the ha-selector blank, so bump the nonce to re-create it on its default.
        if (cleared)
        {
            this._colorNonce++;
        }
        if ((this._cfg[key] ?? undefined) === (next ?? undefined))
        {
            return;
        }
        this._update(key, next);
    };
    private _onBoolToggleClick = (e: Event): void =>
    {
        const el  = e.currentTarget as HTMLElement;
        const key = el.dataset.key as keyof HeliosConfig | undefined;
        if (!key)
        {
            return;
        }
        const value = el.dataset.value === 'true';
        //Locking the camera also snapshots the current preview angle into the config (see _lockCameraToCurrentView),
        //so a frozen view is identical on every device. Unlocking is a plain toggle.
        if (key === 'camera-locked' && value)
        {
            this._lockCameraToCurrentView(); return;
        }
        this._update(key, value);
    };
    //Toggle a device's presence in the hidden-devices list (presence = hidden). Stored back trimmed to undefined
    //when empty so the YAML drops the key.
    private _onDeviceToggleClick = (e: Event): void =>
    {
        const stat = (e.currentTarget as HTMLElement).dataset.stat;
        if (!stat)
        {
            return;
        }
        const cur  = this._cfg['hidden-devices'];
        const list = Array.isArray(cur) ? cur.filter((v): v is string => typeof v === 'string') : [];
        const next = list.includes(stat) ? list.filter(v => v !== stat) : [...list, stat];
        this._update('hidden-devices', next.length ? next : undefined);
    };
    //Drag-and-drop is delegated to HA's own <ha-sortable> (sortablejs under the hood), which HA registers at runtime
    //like ha-icon, so it works with a mouse AND a finger without bundling anything. Each zone is a sortable sharing one
    //group name, so a chip can be dragged between them; preventOnFilter keeps a tap on the eye from being swallowed.
    private readonly _sortOptions = { preventOnFilter: false };

    //Assign one device to a group (1..GROUP_COUNT), or drop it out of every group with 0. Same object shape the
    //config already stores (id -> 1..GROUP_COUNT), so existing setups round-trip unchanged; an empty map drops the
    //option entirely.
    private _assignDeviceToGroup(stat: string, group: number): void
    {
        const cur = monitoringGroups(this._cfg);
        const map: Record<string, number> = {};
        for (const [k, g] of cur)
        {
            if (k !== stat)
            {
                map[k] = g;
            }
        }
        if (group >= 1)
        {
            map[stat] = group;
        }
        this._update('monitoring-groups', Object.keys(map).length ? map : undefined);
    }

    //A chip was dropped into a zone: ha-sortable fires item-added on the destination, carrying the chip's sortableData
    //(the device id). The zone's group is its data-group (0 = the No-group pool). A device has exactly one group, so
    //assigning it to the new one implicitly removes it from the old.
    private _onZoneItemAdded = (e: CustomEvent<{ data: unknown }>): void =>
    {
        const stat = e.detail?.data;
        if (typeof stat !== 'string' || stat === '')
        {
            return;
        }
        const group = Number((e.currentTarget as HTMLElement).dataset.group);
        if (!Number.isInteger(group) || group < 0 || group > GROUP_COUNT)
        {
            return;
        }
        this._assignDeviceToGroup(stat, group);
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
                            aria-pressed=${on ? 'true' : 'false'}
                            data-key=${key} data-value="true"
                            @click=${this._onBoolToggleClick}
                        >${onLabel ?? t.editor.autoRotateOn}</button>
                        <button
                            type="button"
                            class="seg-option ${!on ? 'active' : ''}"
                            aria-pressed=${!on ? 'true' : 'false'}
                            data-key=${key} data-value="false"
                            @click=${this._onBoolToggleClick}
                        >${offLabel ?? t.editor.autoRotateOff}</button>
                    </div>
                </div>
                ${hint ? html`<div class="hint">${hint}</div>` : nothing}`;
    }

    //One entity-picker field (label + ha-entity-picker + help). Used for the optional local weather-override
    //sensors; `domains` defaults to the numeric sensor domains, overridden for the `weather` entity picker.
    private _renderSensorPicker(key: string, label: string, help: string, domains: string[] = ['sensor', 'input_number']): TemplateResult
    {
        const c = this._cfg as Record<string, unknown>;
        return html`
                <div class="field field-block">
                    <span class="label">${label}</span>
                    ${this._pickerReady ? html`
                        <ha-entity-picker
                            allow-custom-entity
                            .hass=${this.hass}
                            .value=${String(c[key] ?? '')}
                            .includeDomains=${domains}
                            data-key=${key}
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-entity-picker>
                    ` : nothing}
                </div>
                ${help ? html`<div class="field-help">${help}</div>` : nothing}`;
    }

    //One ui_color picker field (label + ha-selector + help). Same markup for every colour config key.
    private _renderColorPicker(key: string, label: string, help: string, defaultColor: string, disabled = false): TemplateResult
    {
        const c = this._cfg as Record<string, unknown>;
        return html`
                <div class="field field-block ${disabled ? 'field-disabled' : ''}">
                    <span class="label">${label}</span>
                    ${this._pickerReady ? html`
                        ${keyed(this._colorNonce, html`<ha-selector
                            .hass=${this.hass}
                            .selector=${{ ui_color: { default_color: defaultColor } }}
                            .value=${String(c[key] ?? defaultColor)}
                            data-key=${key}
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>`)}
                    ` : nothing}
                </div>
                ${help ? html`<div class="field-help">${help}</div>` : nothing}`;
    }

    //One box-select field (label + ha-selector + help). Same markup for every enumerated config key.
    private _renderSelect(key: string, label: string, options: { value: string; label: string }[], dflt: string, help: string, mode: 'box' | 'dropdown' = 'box'): TemplateResult
    {
        const c = this._cfg as Record<string, unknown>;
        return html`
                <div class="field field-block">
                    <span class="label">${label}</span>
                    ${this._pickerReady ? html`
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{ select: { mode, options } }}
                            .value=${String(c[key] ?? dflt)}
                            data-key=${key}
                            @value-changed=${this._onEntityValueChanged}
                        ></ha-selector>
                    ` : nothing}
                </div>
                <div class="field-help">${help}</div>`;
    }

    //One range-slider field (label + range input + live value). Same markup for every numeric config key; the hint
    //stays at the call site since some are per-field and some are shared. `suffix` is appended to the live value.
    //`disabled` greys the whole row and blocks input (used to keep a dependent slider visible but inert).
    private _renderSlider(key: string, label: string, min: number, max: number, step: number, dflt: number, suffix = '', disabled = false): TemplateResult
    {
        const c   = this._cfg as Record<string, unknown>;
        const raw = c[key] ?? dflt;
        return html`
                <label class="field ${disabled ? 'field-disabled' : ''}">
                    <span class="label">${label}</span>
                    <div class="slider-row">
                        <input
                            type="range"
                            min=${min}
                            max=${max}
                            step=${step}
                            .value=${String(raw)}
                            ?disabled=${disabled}
                            data-key=${key}
                            @input=${this._onNumSliderInput}
                        />
                        <span class="slider-value">${this._fmtNum(Number(raw), step)}${suffix}</span>
                    </div>
                </label>`;
    }

    //One action button: an icon + label, its border and text tinted by `color` (a full-colour fill when `filled`,
    //for a destructive confirm). Renders a link when `href` is given, else a button firing `onClick`. All action
    //buttons share this markup + width, so they read as one consistent family (reset cache / options / coffee).
    private _renderActionButton(opts: {
        icon: string; label: string; color: string; onClick?: () => void; href?: string; filled?: boolean;
    }): TemplateResult
    {
        const cls   = `action-btn ${opts.filled ? 'action-btn-filled' : ''}`;
        const inner = html`<ha-icon icon=${opts.icon}></ha-icon><span>${opts.label}</span>`;
        return opts.href !== undefined
            ? html`<a class=${cls} style="--btn-color:${opts.color}" href=${opts.href} target="_blank" rel="noopener noreferrer">${inner}</a>`
            : html`<button type="button" class=${cls} style="--btn-color:${opts.color}" @click=${opts.onClick}>${inner}</button>`;
    }

    //One About-section external link row: an icon + label linking out. Shared markup for the site / LinkedIn /
    //GitHub rows so they stay identical.
    private _renderAboutLink(icon: string, label: string, href: string): TemplateResult
    {
        return html`
                <div class="about-row">
                    <span class="about-label" aria-hidden="true"></span>
                    <a class="about-row-link" href=${href} target="_blank" rel="noopener noreferrer">
                        <ha-icon icon=${icon}></ha-icon>
                        <span>${label}</span>
                    </a>
                </div>`;
    }

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

    //Devices in dashboard order (their HA Energy index), tie-broken by name.
    private _orderedDevices(): DeviceConsumption[]
    {
        return [...this._energyDefaults.devices].sort((a, b) =>
            a.index - b.index
            || this._deviceName(a).localeCompare(this._deviceName(b), undefined, { sensitivity: 'base' }));
    }

    private _renderGroupAssignment(t: Translations): TemplateResult
    {
        const hint = t.editor.groupAssignHint;
        const devices = this._orderedDevices();
        const hidden  = hiddenDevices(this._cfg);

        if (devices.length === 0)
        {
            return html`
                <div class="hint">${hint}</div>
                <div class="live-config-link-row">${this._energyConfigLink()}</div>
                <div class="device-empty">${t.editor.hiddenDevicesEmpty}</div>`;
        }

        const groups  = monitoringGroups(this._cfg);
        const inGroup = (g: number): DeviceConsumption[] =>
            devices.filter(d => (groups.get(d.statConsumption) ?? 0) === g);

        return html`
            <div class="hint">${hint}</div>
            <div class="live-config-link-row">${this._energyConfigLink()}</div>
            <div class="group-zones">
                ${Array.from({ length: GROUP_COUNT }, (_v, i) => i + 1)
        .map(g => this._renderGroupZone(t, g, inGroup(g), hidden))}
            </div>
            ${this._renderGroupZone(t, 0, inGroup(0), hidden)}
        `;
    }

    //One drop zone: groups 1..GROUP_COUNT carry the group's badge/name/colour; group 0 is the "No group" pool at the
    //bottom. Devices are draggable chips; an empty group keeps a "drop here" placeholder so it still reads as a target.
    private _renderGroupZone(t: Translations, group: number, devs: DeviceConsumption[], hidden: Set<string>): TemplateResult
    {
        const isNone = group === 0;
        const name   = isNone
            ? (t.editor.noGroup)
            : (monitoringGroupName(this._cfg, group) || `${t.editor.group} ${group}`);
        const icon   = isNone ? '' : monitoringGroupIcon(this._cfg, group);
        const color  = isNone ? '' : monitoringGroupColor(this._cfg, group);
        return html`
            <div
                class="group-zone ${isNone ? 'group-zone-none' : ''}"
                style=${isNone ? '' : `--group-pill-color:${color}`}
            >
                <div class="group-zone-head">
                    <span class="group-name-badge ${isNone ? 'group-name-badge-none' : ''}">
                        ${isNone
        ? html`<ha-icon icon="mdi:tray-remove"></ha-icon>`
        : (icon ? html`<ha-icon icon=${icon}></ha-icon>` : html`${group}`)}
                    </span>
                    <span class="group-zone-name">${name}</span>
                    <span class="group-zone-count">${devs.length}</span>
                </div>
                <ha-sortable
                    group="helios-monitoring-groups"
                    draggable-selector=".dev-chip"
                    filter=".device-toggle"
                    data-group=${String(group)}
                    .options=${this._sortOptions}
                    @item-added=${this._onZoneItemAdded}
                >
                    <div class="group-zone-body">
                        ${devs.length
        ? repeat(devs, d => d.statConsumption, d => this._renderDeviceChip(d, hidden, t))
        : html`<div class="group-zone-empty">${t.editor.groupDropHere}</div>`}
                    </div>
                </ha-sortable>
            </div>`;
    }

    //A draggable device chip: dashboard-tinted icon + name + the show/hide eye. Grabbing anywhere but the eye starts
    //a pointer drag; the eye keeps its own click.
    private _renderDeviceChip(dev: DeviceConsumption, hidden: Set<string>, t: Translations): TemplateResult
    {
        const stat  = dev.statConsumption;
        const name  = this._deviceName(dev);
        const color = deviceColorByIndex(this, dev.index);
        const shown = !hidden.has(stat);
        //`sortableData` is what ha-sortable hands back in item-added, so a dropped chip is known by its device id.
        return html`
            <div class="dev-chip ${shown ? '' : 'is-hidden'}" .sortableData=${stat}>
                <ha-icon class="device-icon" icon=${this._deviceIcon(dev)} style="color:${color}"></ha-icon>
                <span class="device-name">${name}</span>
                <button
                    type="button"
                    class="device-toggle ${shown ? 'active' : ''}"
                    data-stat=${stat}
                    aria-pressed=${shown ? 'true' : 'false'}
                    aria-label=${t.editor.deviceVisibilityLabel}
                    @click=${this._onDeviceToggleClick}
                >
                    <ha-icon icon=${shown ? 'mdi:eye' : 'mdi:eye-off'}></ha-icon>
                </button>
            </div>`;
    }


    //Map configuration section: the 4-way theme toggle, plus the per-layer colour + visibility blocks in Custom.
    private _renderMapSection(t: Translations): TemplateResult
    {
        const mode = mapThemeMode(this._cfg);
        const mc   = t.mapConfig;
        const opt  = (val: MapThemeMode, label: string): TemplateResult => html`
            <button type="button" class="seg-option ${mode === val ? 'active' : ''}" aria-pressed=${mode === val ? 'true' : 'false'} data-value=${val} @click=${this._onMapModeClick}>${label}</button>`;
        return html`
            <div class="field-help">${mc.intro}</div>
            <div class="segmented-toggle map-mode-toggle">
                ${opt('auto', mc.modeAuto)}
                ${opt('dark', mc.modeDark)}
                ${opt('light', mc.modeLight)}
                ${opt('custom', mc.modeCustom)}
            </div>
            ${mode === 'custom' ? GROUND_LAYER_KEYS.map((key) => this._renderMapLayerBlock(t, key)) : nothing}`;
    }

    //Switch the map colour mode. Entering Custom seeds every unset layer colour from the current theme default so
    //the user starts from a real palette, not a blank slate (one config-changed dispatch for the whole switch).
    private _onMapModeClick = (e: Event): void =>
    {
        const val = (e.currentTarget as HTMLElement).dataset.value as MapThemeMode | undefined;
        if (!val || val === mapThemeMode(this._cfg))
        {
            return;
        }
        const next = { ...this._cfg } as Record<string, unknown>;
        if (val === 'auto')
        {
            delete next['map-theme-mode'];
        }
        else
        {
            next['map-theme-mode'] = val;
        }
        if (val === 'custom')
        {
            const base = defaultGroundPalette(isDarkFromCss(this));
            for (const key of GROUND_LAYER_KEYS)
            {
                const ck = mapColorKey(key);
                if (!next[ck])
                {
                    next[ck] = base[key];
                }
            }
        }
        this._commit(next);
    };

    private _mapLayerLabel(t: Translations, key: GroundLayerKey): string
    {
        return t.mapConfig[key];
    }

    //One configurable map layer: colour pill + name + show/hide toggle + the HA ui_color picker.
    private _renderMapLayerBlock(t: Translations, key: GroundLayerKey): TemplateResult
    {
        const on = mapLayerVisible(this._cfg, key);
        //Effective colour: the stored value, else the current theme's default for this layer. So the picker
        //always shows a colour, and clearing it with the X falls straight back to that default.
        const colour = mapLayerColor(this._cfg, key) || defaultGroundPalette(isDarkFromCss(this))[key];
        const pill   = /^(#|rgb)/i.test(colour) ? colour : `var(--${colour}-color, #888)`;
        return html`
                <div class="group-block">
                    <div class="group-line">
                        <span class="group-name-badge" style="--group-pill-color:${pill}"></span>
                        <span class="chip-box-name">${this._mapLayerLabel(t, key)}</span>
                        <div class="segmented-toggle">
                            <button type="button" class="seg-option ${on ? 'active' : ''}" aria-pressed=${on ? 'true' : 'false'} data-key=${mapShowKey(key)} data-value="true" @click=${this._onBoolToggleClick}>${t.editor.autoRotateOn}</button>
                            <button type="button" class="seg-option ${!on ? 'active' : ''}" aria-pressed=${!on ? 'true' : 'false'} data-key=${mapShowKey(key)} data-value="false" @click=${this._onBoolToggleClick}>${t.editor.autoRotateOff}</button>
                        </div>
                    </div>
                    ${this._pickerReady ? html`
                        <div class="group-line chip-body">
                            ${keyed(this._colorNonce, html`<ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{ ui_color: {} }}
                                .value=${colour}
                                data-key=${mapColorKey(key)}
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-selector>`)}
                        </div>` : nothing}
                </div>`;
    }

    private _renderChipsSection(t: Translations): TemplateResult
    {
        return html`
            <div class="hint">${t.editor.chipsIntro}</div>
            ${this._renderChipBox(t.editor.chipIrradiance, 'chip-irradiance-visible', ['irradiance'])}
            ${this._renderChipBox(t.editor.chipProduction, 'chip-production-visible', ['production'])}
            ${this._renderChipBox(t.editor.chipGrid, 'chip-grid-visible', ['gridImport', 'gridExport'])}
            ${this._renderChipBox(t.editor.chipBattery, 'chip-battery-visible', ['batteryCharge', 'batteryDischarge'])}
            ${this._renderChipBox(t.editor.chipHome, 'chip-home-visible', ['home'])}
            ${this._renderChipBox(t.editor.chipTemperature, 'show-temperature', ['temperature'])}
            ${this._renderChipBox(t.editor.chipHumidity, 'show-humidity', ['humidity'])}
            ${this._renderChipBox(t.editor.chipCost, 'show-cost', ['cost'])}
            ${Array.from({ length: GROUP_COUNT }, (_v, i) => i + 1).map(g => this._renderGroupChipBox(t, g))}
        `;
    }

    //One fixed chip's box: a colour+icon badge, the chip name and a show/hide toggle on the header line, then one
    //body row per state (icon picker + colour picker at 50/50). Single-state chips get one row; grid/battery get
    //two (one per direction). The icon picker shows the resolved icon (chosen or the built-in default) selected.
    private _renderChipBox(label: string, visKey: string, slots: ChipSlot[]): TemplateResult
    {
        const c    = this._cfg as Record<string, unknown>;
        const on   = chipVisible(this._cfg, visKey);
        const t    = this._t();
        const badge     = chipSlotColor(this, this._cfg, slots[0]);
        const badgeIcon = chipSlotIcon(this._cfg, slots[0]);
        return html`
                <div class="group-block">
                    <div class="group-line">
                        <span class="group-name-badge" style="--group-pill-color:${badge}"><ha-icon icon=${badgeIcon}></ha-icon></span>
                        <span class="chip-box-name">${label}</span>
                        <div class="segmented-toggle">
                            <button type="button" class="seg-option ${on ? 'active' : ''}" aria-pressed=${on ? 'true' : 'false'} data-key=${visKey} data-value="true" @click=${this._onBoolToggleClick}>${t.editor.autoRotateOn}</button>
                            <button type="button" class="seg-option ${!on ? 'active' : ''}" aria-pressed=${!on ? 'true' : 'false'} data-key=${visKey} data-value="false" @click=${this._onBoolToggleClick}>${t.editor.autoRotateOff}</button>
                        </div>
                    </div>
                    ${this._pickerReady ? slots.map(slot =>
    {
        const def = CHIP_SLOTS[slot];
        return html`
                        <div class="group-line chip-body">
                            <ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{ icon: {} }}
                                .value=${chipSlotIcon(this._cfg, slot)}
                                data-key=${def.iconKey}
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-selector>
                            ${keyed(this._colorNonce, html`<ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{ ui_color: { default_color: def.uiColorDefault } }}
                                .value=${String(c[def.colorKey as string] ?? def.uiColorDefault)}
                                data-key=${def.colorKey}
                                @value-changed=${this._onEntityValueChanged}
                            ></ha-selector>`)}
                        </div>`;
    }) : nothing}
                </div>`;
    }

    //One group's box: a colour+icon badge, an editable name field and a show/hide toggle on the header line, then
    //a body line with the group's icon + colour pickers. All bound to the shared group maps (rename lives here).
    private _renderGroupChipBox(t: Translations, g: number): TemplateResult
    {
        const on    = groupChipVisible(this._cfg, g);
        const badge = monitoringGroupColor(this._cfg, g);
        const gi    = monitoringGroupIcon(this._cfg, g);
        return html`
                <div class="group-block">
                    <div class="group-line">
                        <span class="group-name-badge" style="--group-pill-color:${badge}">${gi ? html`<ha-icon icon=${gi}></ha-icon>` : html`${g}`}</span>
                        <input
                            class="group-name-input"
                            type="text"
                            .value=${monitoringGroupName(this._cfg, g)}
                            placeholder=${`${t.editor.group} ${g}`}
                            data-group=${String(g)}
                            @change=${this._onGroupNameChanged}
                        />
                        <div class="segmented-toggle">
                            <button type="button" class="seg-option ${on ? 'active' : ''}" aria-pressed=${on ? 'true' : 'false'} data-group=${String(g)} data-value="true" @click=${this._onGroupVisibleClick}>${t.editor.autoRotateOn}</button>
                            <button type="button" class="seg-option ${!on ? 'active' : ''}" aria-pressed=${!on ? 'true' : 'false'} data-group=${String(g)} data-value="false" @click=${this._onGroupVisibleClick}>${t.editor.autoRotateOff}</button>
                        </div>
                    </div>
                    ${this._pickerReady ? html`
                        <div class="group-line chip-body">
                            <ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{ icon: {} }}
                                .value=${monitoringGroupIcon(this._cfg, g) || undefined}
                                data-group=${String(g)}
                                @value-changed=${this._onGroupIconChanged}
                            ></ha-selector>
                            ${keyed(this._colorNonce, html`<ha-selector
                                class="chip-picker"
                                .hass=${this.hass}
                                .selector=${{ ui_color: {} }}
                                .value=${monitoringGroupColorToken(this._cfg, g) || deviceColorByIndex(this, g - 1)}
                                data-group=${String(g)}
                                @value-changed=${this._onGroupColorChanged}
                            ></ha-selector>`)}
                        </div>
                    ` : nothing}
                </div>`;
    }

    //Write one entry of a per-group object-map config key (empty value clears it; empty map drops the key).
    private _updateGroupMap(key: keyof HeliosConfig, group: string, value: string): void
    {
        const cur = this._cfg[key];
        const map: Record<string, string> = (cur && typeof cur === 'object' && !Array.isArray(cur))
            ? { ...(cur as Record<string, string>) }
            : {};
        if (value)
        {
            map[group] = value;
        }
        else
        {
            delete map[group];
        }
        this._update(key, Object.keys(map).length ? map : undefined);
    }

    private _onGroupNameChanged = (e: Event): void =>
    {
        const el = e.currentTarget as HTMLInputElement;
        if (el.dataset.group)
        {
            this._updateGroupMap('monitoring-group-names', el.dataset.group, el.value.trim());
        }
    };
    private _onGroupColorChanged = (e: CustomEvent<{ value?: unknown }>): void =>
    {
        e.stopPropagation();
        const g = (e.currentTarget as HTMLElement).dataset.group;
        if (!g)
        {
            return;
        }
        const value = typeof e.detail.value === 'string' ? e.detail.value : '';
        //X clear -> re-create the picker so it snaps back to the group's default colour even when already unset.
        if (value === '')
        {
            this._colorNonce++;
        }
        this._updateGroupMap('monitoring-group-colors', g, value);
    };
    private _onGroupIconChanged = (e: CustomEvent<{ value?: unknown }>): void =>
    {
        e.stopPropagation();
        const g = (e.currentTarget as HTMLElement).dataset.group;
        if (g)
        {
            this._updateGroupMap('monitoring-group-icons', g, typeof e.detail.value === 'string' ? e.detail.value : '');
        }
    };
    //Toggle a group chip's visibility. Stored as a 'monitoring-group-hidden' object map (group -> true = hidden);
    //visible drops the key, an empty map drops the whole option.
    private _onGroupVisibleClick = (e: Event): void =>
    {
        const el = e.currentTarget as HTMLElement;
        const g  = el.dataset.group;
        if (!g)
        {
            return;
        }
        const cur = this._cfg['monitoring-group-hidden'];
        const map: Record<string, boolean> = (cur && typeof cur === 'object' && !Array.isArray(cur))
            ? { ...(cur as Record<string, boolean>) }
            : {};
        if (el.dataset.value === 'true')
        {
            delete map[g];
        }
        else
        {
            map[g] = true;
        }
        this._update('monitoring-group-hidden', Object.keys(map).length ? map : undefined);
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
                ${this._renderToggle('show-timeline', t.editor.showTimeline, t.editor.showTimelineHint, undefined, undefined, true)}
                ${this._renderToggle('show-detail-panel', t.editor.showDetailPanel, t.editor.showDetailPanelHint, undefined, undefined, true)}
                ${this._renderToggle('show-sun-times', t.editor.showSunTimes, t.editor.showSunTimesHint, undefined, undefined, true)}
                ${this._renderToggle('show-horizon-line', t.editor.showHorizonLine, t.editor.showHorizonLineHint, undefined, undefined, true)}
                ${this._renderColorPicker('horizon-line-color', t.editor.horizonLineColor, t.editor.horizonLineColorHint, 'blue-grey', c['show-horizon-line'] === false)}
                ${this._renderSelect('scene-zoom', t.editor.sceneZoom,
        [{ value: '1',   label: '1x' },
            { value: '1.5', label: '1.5x' },
            { value: '2',   label: '2x' }], '1',
        t.editor.sceneZoomHint)}
                ${this._renderToggle('weather-enabled', t.editor.weatherEnabled, t.editor.weatherEnabledHint, undefined, undefined, true)}
                ${this._renderToggle('auto-hide-ui', t.editor.noUiMode, t.editor.noUiModeHint)}
                ${this._renderSlider('no-ui-delay', t.editor.noUiDelay, MIN_NO_UI_DELAY_S, MAX_NO_UI_DELAY_S, 1, DEFAULT_NO_UI_DELAY_S, ' s', c['auto-hide-ui'] !== true)}
                <div class="field-help">${t.editor.noUiDelayHint}</div>
                ${this._renderToggle('auto-rotate-enabled', t.editor.autoRotate, t.editor.autoRotateHint)}
                ${this._renderToggle('camera-locked', t.editor.lockRotation, t.editor.lockRotationHint)}
                ${this._renderToggle('degraded-render', t.editor.degradedRender, t.editor.degradedRenderHint)}

                </details>

                <details class="advanced-section" data-section="mapconfig" ?open=${this._openSection === 'mapconfig'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:map"></ha-icon>${t.mapConfig.section}</summary>
                ${this._renderMapSection(t)}
                </details>

                <details class="advanced-section" data-section="chips" ?open=${this._openSection === 'chips'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:palette-swatch-outline"></ha-icon>${t.editor.chipsSection}</summary>
                ${this._renderChipsSection(t)}
                </details>

                <details class="advanced-section" data-section="groups" ?open=${this._openSection === 'groups'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:select-group"></ha-icon>${t.editor.groupsConfigTitle}</summary>
                ${this._renderGroupAssignment(t)}
                </details>

                <details class="advanced-section" data-section="sensors" ?open=${this._openSection === 'sensors'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:sun-wireless-outline"></ha-icon>${t.editor.optionalSensors}</summary>
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
                ${this._renderSensorPicker('temperature-entity',   t.editor.temperatureEntity,   t.editor.temperatureEntityHelp)}
                ${this._renderSensorPicker('humidity-entity',      t.editor.humidityEntity,      t.editor.humidityEntityHelp)}
                ${this._renderSensorPicker('cloud-cover-entity',   t.editor.cloudCoverEntity,   t.editor.cloudCoverEntityHelp)}
                ${this._renderSensorPicker('precipitation-entity', t.editor.precipitationEntity, t.editor.precipitationEntityHelp)}
                ${this._renderSensorPicker('snowfall-entity',      t.editor.snowfallEntity,      t.editor.snowfallEntityHelp)}
                ${this._renderSensorPicker('weather-entity',       t.editor.weatherEntity,       t.editor.weatherEntityHelp, ['weather'])}
                </details>

                <details class="advanced-section" data-section="dataDisplay" ?open=${this._openSection === 'dataDisplay'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:gauge"></ha-icon>${t.editor.dataDisplaySection}</summary>
                ${this._renderSlider('display-update-frequency-per-hour', t.editor.displayUpdateFrequency, MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, 1, DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR, ' / h')}
                <div class="field-help">${t.editor.displayUpdateFrequencyHelp}</div>
                ${this._renderSlider('value-decimals', t.editor.valueDecimals, MIN_VALUE_DECIMALS, MAX_VALUE_DECIMALS, 1, DEFAULT_VALUE_DECIMALS)}
                <div class="field-help">${t.editor.valueDecimalsHelp}</div>
                ${this._renderSlider('max-expected-power', t.editor.maxExpectedPower, MIN_MAX_EXPECTED_POWER_W, MAX_MAX_EXPECTED_POWER_W, 500, DEFAULT_MAX_EXPECTED_POWER_W, ' W')}
                <div class="field-help">${t.editor.maxExpectedPowerHelp}</div>
                ${this._renderSelect('power-unit', t.editor.powerUnit,
        [{ value: 'kW', label: 'kW' }, { value: 'W', label: 'W' }], 'kW',
        t.editor.powerUnitHelp)}
                ${this._renderSelect('energy-unit', t.editor.energyUnit,
        [{ value: 'auto', label: t.editor.energyUnitAuto }, { value: 'kWh', label: 'kWh' }, { value: 'Wh', label: 'Wh' }], 'auto',
        t.editor.energyUnitHelp)}
                ${this._renderSelect('irradiance-unit', t.editor.irradianceUnit,
        [{ value: 'W/m²', label: 'W/m²' }, { value: 'kW/m²', label: 'kW/m²' }, { value: 'W/ft²', label: 'W/ft²' }], 'W/m²',
        t.editor.irradianceUnitHelp)}
                ${this._renderSelect('sun-chip-mode', t.editor.sunChipMode,
        [{ value: 'irradiance', label: t.editor.sunChipModeIrradiance },
            { value: 'position', label: t.editor.sunChipModePosition }], 'irradiance',
        t.editor.sunChipModeHelp)}
                ${this._renderSelect('battery-chip-mode', t.editor.batteryChipMode,
        [{ value: 'power', label: t.editor.batteryChipModePower },
            { value: 'soc', label: t.editor.batteryChipModeSoc }], 'power',
        t.editor.batteryChipModeHelp)}
                ${this._renderSelect('battery-sign', t.editor.batterySign, [
        { value: 'default',  label: t.editor.batterySignDefault },
        { value: 'inverted', label: t.editor.batterySignInverted },
        { value: 'hidden',   label: t.editor.batterySignHidden },
    ], 'default',
    t.editor.batterySignHelp, 'dropdown')}
                </details>

                <details class="advanced-section" data-section="buildings" ?open=${this._openSection === 'buildings'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:office-building-outline"></ha-icon>${t.editor.buildingsSection}</summary>
                ${this._renderSlider('display-radius', t.editor.displayRadius, MIN_DISPLAY_RADIUS_M, MAX_DISPLAY_RADIUS_M, 10, DEFAULT_DISPLAY_RADIUS_M, ' m')}
                <div class="hint">${t.editor.displayRadiusHelp}</div>
                ${this._renderSlider('building-count', t.editor.buildingCount, MIN_BUILDING_COUNT, MAX_BUILDING_COUNT, 5, DEFAULT_BUILDING_COUNT)}
                <div class="hint">${t.editor.buildingCountHelp}</div>
                ${this._renderToggle('building-real-size', t.editor.buildingRealSize, t.editor.buildingRealSizeHint, t.editor.buildingRealSizeOn, t.editor.buildingRealSizeOff, true)}
                ${c['building-real-size'] === false
        ? this._renderSlider('building-height', t.editor.buildingHeight, MIN_BUILDING_HEIGHT_M, MAX_BUILDING_HEIGHT_M, 0.5, FIXED_BUILDING_HEIGHT_M, ' m')
        : nothing}
                ${this._renderSlider('building-cluster-radius', t.editor.buildingClusterRadius, 0, 100, 1, DEFAULT_BUILDING_CLUSTER_RADIUS_M, ' m')}
                <div class="hint">${t.editor.buildingClusterRadiusHelp}</div>
                ${this._renderSlider('building-opacity', t.editor.buildingOpacity, 0, 1, 0.05, DEFAULT_BUILDING_OPACITY)}
                <div class="hint">${t.editor.buildingsHint}</div>
                ${this._renderColorPicker('building-color', t.editor.buildingColor, t.editor.buildingColorHelp, 'grey')}

                </details>

                <details class="advanced-section" data-section="moon" ?open=${this._openSection === 'moon'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:moon-waning-crescent"></ha-icon>${t.editor.moonSection}</summary>
                ${this._renderSelect('moon-display', t.editor.moonDisplay,
        [{ value: 'always', label: t.editor.moonDisplayAlways },
            { value: 'night',  label: t.editor.moonDisplayNight },
            { value: 'hidden', label: t.editor.moonDisplayHidden }], 'night',
        t.editor.moonDisplayHint)}

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
                    ${this._renderActionButton({
        icon: 'mdi:database-refresh-outline',
        label: this._resetFeedback ?? t.editor.resetCacheButton,
        color: 'var(--error-color, #ef4444)',
        onClick: this._onResetCacheClick.bind(this),
    })}
                    <div class="hint reset-warning">${t.editor.resetOptionsWarning}</div>
                    ${this._renderActionButton({
        icon: 'mdi:cog-refresh-outline',
        label: this._optionsResetFeedback ?? (this._optionsResetArmed ? (t.editor.resetOptionsConfirm) : (t.editor.resetOptionsButton)),
        color: 'var(--error-color, #ef4444)',
        onClick: this._onResetOptionsClick.bind(this),
        filled: this._optionsResetArmed,
    })}
                </details>

                <details class="advanced-section about-section" data-section="about" ?open=${this._openSection === 'about'} @toggle=${this._onSectionToggleEvt}>
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:information-outline"></ha-icon>${t.editor.aboutSection}</summary>
                    <!-- Identity + links column: one .about-row line per item, label left and value (or icon link)
                         right. -->
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutVersionLabel}</span>
                        <a class="about-row-link about-version-link"
                           href="https://github.com/ReikanYsora/Helios/releases/tag/v${__HELIOS_VERSION__}"
                           target="_blank" rel="noopener noreferrer"
                        >${__HELIOS_VERSION__}</a>
                    </div>
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutDeveloperLabel}</span>
                        <span class="about-row-value">ReikanYsora (Jérôme CREMOUX)</span>
                    </div>
                    ${this._renderAboutLink('mdi:web', 'helios-ha.org', 'https://helios-ha.org')}
                    ${this._renderAboutLink('mdi:linkedin', t.editor.aboutDeveloperLinkedIn, 'https://www.linkedin.com/in/jerome-cremoux/')}
                    ${this._renderAboutLink('mdi:github', t.editor.aboutRepoCard, 'https://github.com/ReikanYsora/Helios')}
                    <div class="about-block about-coffee">
                        <p class="about-paragraph">${t.editor.aboutCoffeeMessage}</p>
                        ${this._renderActionButton({
        icon: 'mdi:coffee',
        label: t.editor.aboutCoffeeLink,
        color: '#ffcc00',
        href: 'https://www.buymeacoffee.com/reikanysora',
    })}
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
        catch (_)
        { /* CustomEvent unsupported: skip the cross-card cache-reset broadcast */ }
        const t = this._t();
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

    //Reset every card option to its default. Destructive (wipes all customisation), so it takes a confirming
    //second click: the first arms it (button turns into a confirm prompt for a few seconds), the second clears
    //the whole config to {}. Only the card's own options are touched; Home Assistant data is never affected.
    private _optionsResetConfirmTimer?: number;
    private _optionsResetFeedbackTimer?: number;
    @state() private _optionsResetArmed = false;
    @state() private _optionsResetFeedback: string | null = null;

    private _onResetOptionsClick(): void
    {
        if (!this._optionsResetArmed)
        {
            this._optionsResetArmed = true;
            if (this._optionsResetConfirmTimer !== undefined)
            {
                window.clearTimeout(this._optionsResetConfirmTimer);
            }
            this._optionsResetConfirmTimer = window.setTimeout(() =>
            {
                this._optionsResetArmed = false;
            }, 4000);
            return;
        }
        this._optionsResetArmed = false;
        if (this._optionsResetConfirmTimer !== undefined)
        {
            window.clearTimeout(this._optionsResetConfirmTimer);
        }
        //Clear every Helios option but keep the Lovelace-managed keys (the card `type` is mandatory, plus any
        //layout placement HA stored), so the card stays valid and keeps its dashboard slot.
        const cur  = this._cfg as Record<string, unknown>;
        const next = {} as Record<string, unknown>;
        for (const k of HeliosCardEditor.LOVELACE_KEYS)
        {
            if (cur[k] !== undefined)
            {
                next[k] = cur[k];
            }
        }
        this._commit(next);
        const t = this._t();
        this._optionsResetFeedback = t.editor.resetOptionsDone;
        if (this._optionsResetFeedbackTimer !== undefined)
        {
            window.clearTimeout(this._optionsResetFeedbackTimer);
        }
        this._optionsResetFeedbackTimer = window.setTimeout(() =>
        {
            this._optionsResetFeedback = null;
        }, HeliosCardEditor.RESET_FEEDBACK_MS);
    }

    static styles = editorStyles;
}
