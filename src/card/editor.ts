import { LitElement, html, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { colorPickerStyles, editorStyles } from '../css/helios-card-editor-css';
import
{
    type HeliosConfig,
    DEFAULT_BUILDING_RADIUS_M,
    DEFAULT_BUILDING_OPACITY,
    DEFAULT_BUILDING_CLUSTER_RADIUS_M,
    DEFAULT_LIDAR_PRECISION,
    DEFAULT_SHADOW_OPACITY,
    DEFAULT_LIDAR_VIEW_POINT_SIZE_PX,
    DEFAULT_TIMELINE_ENABLED,
    DEFAULT_TIMELINE_WIDTH_PCT,
    DEFAULT_TIMELINE_CONSUMPTION_ENABLED
} from '../helios-config';
import { pickTranslations, type Translations } from '../i18n';
import { renderShadingMapSection } from './shadingMapView';


//LiDAR View visual knobs that existed before the in-card opacity slider replaced them. Left here as a const tuple so `_update` can strip
//them silently on every config write: the runtime already ignores these keys, the silent strip just keeps the saved YAML tidy.
const LIDAR_VIEW_LEGACY_KEYS = [
    'lidar-view-point-color',
    'lidar-view-point-opacity',
    'lidar-view-wireframe',
    'lidar-view-wireframe-color',
    'lidar-view-wireframe-opacity'
] as const;


//Custom color picker.
//
//Why custom: <input type="color"> opens a native popover, which iOS
//Safari crashes on when invoked from a deeply nested Shadow DOM ,
//exactly HA's setup (dashboard editor → custom card editor → Lit
//root). We replace it with an in-shadow swatch + popover exposing a
//curated 42-colour palette plus a hex text input for free entry.
@customElement('helios-color-picker')
export class HeliosColorPicker extends LitElement
{
    @property({ type: String }) public value:    string  = '#888888';
    @property({ type: String }) public ariaLabel: string = 'Color';
    @state()                    private _open    = false;
    @state()                    private _hexDraft = '';

    private static readonly PRESETS: string[] = [
        '#ffffff', '#f5f5f4', '#d4d4d8', '#a8a29e', '#52525b', '#1f2937', '#000000',
        '#fef3c7', '#fcd34d', '#f59e0b', '#ea580c', '#dc2626', '#991b1b', '#7c2d12',
        '#dcfce7', '#86efac', '#22c55e', '#16a34a', '#15803d', '#064e3b', '#052e16',
        '#dbeafe', '#93c5fd', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a', '#172554',
        '#ede9fe', '#c4b5fd', '#8b5cf6', '#7c3aed', '#6d28d9', '#4c1d95', '#2e1065',
        '#fce7f3', '#f9a8d4', '#ec4899', '#db2777', '#be185d', '#9d174d', '#500724'
    ];

    //Capturing document handler so a click outside closes the popover.
    private _onDocClick = (e: MouseEvent) =>
    {
        const path = e.composedPath();
        if (!path.includes(this))
        {
            this._open = false;
            document.removeEventListener('click', this._onDocClick, true);
        }
    };

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        document.removeEventListener('click', this._onDocClick, true);
    }

    private _toggle(e: Event): void
    {
        e.stopPropagation();
        this._open = !this._open;
        this._hexDraft = this.value;
        if (this._open)
        {
            //Defer one tick so the click that opened the popover doesn't immediately close it.
            setTimeout(() => document.addEventListener('click', this._onDocClick, true), 0);
        }
        else
        {
            document.removeEventListener('click', this._onDocClick, true);
        }
    }

    private _emit(value: string): void
    {
        this.value = value;
        this.dispatchEvent(new CustomEvent('value-changed',
            { detail: { value }, bubbles: true, composed: true }));
    }

    private _selectPreset(hex: string, e: Event): void
    {
        e.stopPropagation();
        this._emit(hex);
        this._open = false;
        document.removeEventListener('click', this._onDocClick, true);
    }

    private _onHexInput(e: Event): void
    {
        this._hexDraft = (e.target as HTMLInputElement).value;
    }

    private _commitHex(): void
    {
        const v = this._hexDraft.trim();
        const m = /^#?([0-9a-fA-F]{6})$/.exec(v);
        if (m)
        {
            this._emit('#' + m[1].toLowerCase());
        }
    }

    private _onHexKey(e: KeyboardEvent): void
    {
        if (e.key === 'Enter')
        {
            this._commitHex();
            this._open = false;
            document.removeEventListener('click', this._onDocClick, true);
        }
        else if (e.key === 'Escape')
        {
            this._open = false;
            document.removeEventListener('click', this._onDocClick, true);
        }
    }

    protected render(): TemplateResult
    {
        return html`
            <button
                type="button"
                class="swatch"
                style="background:${this.value}"
                aria-label="${this.ariaLabel}"
                aria-haspopup="dialog"
                aria-expanded="${this._open}"
                @click="${this._toggle}"
            ></button>
            ${this._open ? html`
                <div class="pop" role="dialog" @click="${(e: Event) => e.stopPropagation()}">
                    <div class="grid">
                        ${HeliosColorPicker.PRESETS.map(c => html`
                            <button
                                type="button"
                                class="cell ${c.toLowerCase() === this.value.toLowerCase() ? 'selected' : ''}"
                                style="background:${c}"
                                aria-label="${c}"
                                @click="${(e: Event) => this._selectPreset(c, e)}"
                            ></button>
                        `)}
                    </div>
                    <div class="hex-row">
                        <span class="hex-prefix">#</span>
                        <input
                            class="hex-input"
                            type="text"
                            spellcheck="false"
                            autocomplete="off"
                            maxlength="7"
                            .value="${this._hexDraft.replace(/^#/, '')}"
                            @input="${this._onHexInput}"
                            @blur="${this._commitHex}"
                            @keydown="${this._onHexKey}"
                        />
                    </div>
                </div>
            ` : nothing}
        `;
    }

    static styles = colorPickerStyles;
}


//Render a localised hint string that may contain markdown-style
//links `[text](url)` as a Lit fragment with real `<a>` anchors.
//No HTML parsing, no innerHTML: each link is built through Lit's
//tagged template literal so the URL + text stay text-escaped.
//
//URL safety: anything that doesn't start with `http://` or
//`https://` is rendered as plain text. Stops a malicious /
//corrupted translation from sneaking in a `javascript:` URI.
//
//Used by editor hints that need a clickable link to helios-lidar.org or other public docs.
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
        else
        {
            //Suspicious scheme, render as plain text so the user can see the URL but the browser doesn't follow it.
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


//Visual editor, exposes every config option through native HA form
//controls (text inputs, color picker, entity picker). Wired into the
//card via HeliosCard.getConfigElement().
@customElement('helios-card-editor')
export class HeliosCardEditor extends LitElement
{
    @property({ attribute: false }) public hass?: any;
    @state()                        private _cfg: HeliosConfig = {};
    @state()                        private _pickerReady = false;
    //Accordion: at most one top-level editor section open at a time
    //(the alternative was a stack of expanded blocks which got too
    //tall to scan once every section was open). Tracks the id of
    //the currently-open section; null when every section is collapsed.
    //Defaults to 'location' so the very first thing the user sees on
    //a fresh card is where the home sits.
    @state()                        private _openSection: string | null = 'location';
    //Per-pan open/closed state for the multi-array editor section.
    //First pan opens by default so a freshly-opened editor reads
    //"single array, ready to fill", but subsequent toggles by the
    //user persist until they remove a pan or rebuild the card.
    //`_arrayAdd` adds the new index to this set; `_arrayRemove`
    //shifts the indices above the removed one down by 1.
    @state()                        private _openArrayIndices: Set<number> = new Set([0]);
    //Per-bank open/closed state for the multi-bank battery editor section. Mirrors `_openArrayIndices` (same first-pan-open default,
    //same shift-on-remove semantics). Separate Set so opening a PV array doesn't accidentally toggle a battery bank with the same index.
    @state()                        private _openBatteryIndices: Set<number> = new Set([0]);

    //Per-key debounce timers for slider inputs. Sliders fire @input
    //on every pixel of drag, so dispatching `config-changed` per
    //tick would cascade an updateConfig + full re-render through
    //the engine on each pixel, visibly painful during preview. We
    //update the local _cfg synchronously (so the slider's bound
    //.value tracks the drag perfectly) but only dispatch the
    //cross-component `config-changed` event after a short idle
    //window.
    private static readonly SLIDER_COMMIT_DELAY_MS = 250;
    private _sliderDebounce: Map<string, number> = new Map();

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        for (const t of this._sliderDebounce.values()) window.clearTimeout(t);
        this._sliderDebounce.clear();
        //"Cache vidé" confirmation timer survives a fast unmount if not cleared, fires on a dead element and triggers a Lit warning
        //about touching @state after disconnect. Clear it here so the editor unmounts cleanly mid-feedback.
        if (this._resetFeedbackTimer !== undefined)
        {
            window.clearTimeout(this._resetFeedbackTimer);
            this._resetFeedbackTimer = undefined;
        }
    }

    public setConfig(config: HeliosConfig): void
    {
        //Strip every legacy / removed config key the moment the user
        //opens the editor. Keeps YAML clean as the schema evolves and
        //prevents stale config from carrying ghost behaviour into a
        //fresh card frame.
        const sanitised = HeliosCardEditor._sanitiseConfig({ ...config });
        const changed   = !HeliosCardEditor._configEq(config, sanitised);
        this._cfg = sanitised;
        //If we trimmed anything, push the cleaned config back up to
        //HA so the YAML reflects the schema immediately, not only on
        //the user's next manual edit.
        if (changed)
        {
            this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: sanitised } }));
        }
    }

    //Schema-aware strip of legacy / removed keys. The list grows with
    //the version; new entries land here when a key is retired so the
    //next editor open silently scrubs the user's YAML.
    private static _RETIRED_KEYS: string[] = [
        'card-theme',
        'card-theme-light',
        'card-theme-dark',
    ];
    private static _sanitiseConfig(config: HeliosConfig): HeliosConfig
    {
        const out = { ...config } as Record<string, unknown>;
        for (const k of HeliosCardEditor._RETIRED_KEYS)
        {
            if (k in out) delete out[k];
        }
        return out as HeliosConfig;
    }
    private static _configEq(a: HeliosConfig, b: HeliosConfig): boolean
    {
        const aKeys = Object.keys(a).sort();
        const bKeys = Object.keys(b).sort();
        if (aKeys.length !== bKeys.length) return false;
        for (let i = 0; i < aKeys.length; i++) if (aKeys[i] !== bKeys[i]) return false;
        return true;
    }

    public connectedCallback(): void
    {
        super.connectedCallback();
        this._ensureEntityPicker();
    }

    //ha-entity-picker is part of HA's lazy-loaded card-editor bundle. In a fresh tab, or in HA versions that don't pre-load it for custom cards, the
    //tag is unknown until something on the page pulls it in. We force the load by creating a transient "entities" card and asking for its config
    //element, the side effect registers ha-entity-picker. While the load is pending we fall back to a plain text input so the field is never broken.
    private async _ensureEntityPicker(): Promise<void>
    {
        if (this._pickerReady) return;
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
        //Silently strip the LiDAR View visual knobs that were collapsed into the in-card opacity slider, the moment the user makes any edit, so the config self-heals without needing
        //a one-shot migration. The runtime ignores them too, this just keeps the YAML tidy.
        for (const k of LIDAR_VIEW_LEGACY_KEYS)
        {
            if (k in next) delete next[k];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
        this._cfg = next as HeliosConfig;
    }

    private _str(key: keyof HeliosConfig, e: Event): void
    {
        this._update(key, (e.target as HTMLInputElement).value);
    }

    //Free-form numeric field. Empty input clears the option (so the
    //card falls back to its default behaviour); a valid finite number
    //is committed as-is. Anything else is ignored, the previous value
    //stays in place.
    private _numField(key: keyof HeliosConfig, e: Event): void
    {
        const raw = (e.target as HTMLInputElement).value.trim();
        if (raw === '')
        {
            this._update(key, undefined);
            return;
        }
        const v = parseFloat(raw);
        if (!isFinite(v)) return;
        this._update(key, v);
    }

    //Slider commit. Updates local state synchronously so the slider thumb tracks the drag, but defers the cross-component `config-changed` event by
    //SLIDER_COMMIT_DELAY_MS so the engine doesn't see a flood of intermediate values.
    private _numSlider(key: keyof HeliosConfig, e: Event): void
    {
        const v = parseFloat((e.target as HTMLInputElement).value);
        if (!isFinite(v)) return;

        //Local update only, no event dispatch yet.
        this._cfg = { ...this._cfg, [key]: v };

        const k        = String(key);
        const existing = this._sliderDebounce.get(k);
        if (existing !== undefined) window.clearTimeout(existing);
        const t = window.setTimeout(() =>
        {
            this._sliderDebounce.delete(k);
            this.dispatchEvent(new CustomEvent('config-changed',
                { detail: { config: this._cfg } }));
        }, HeliosCardEditor.SLIDER_COMMIT_DELAY_MS);
        this._sliderDebounce.set(k, t);
    }

    //Reads the configured PV layout into the shape the editor's
    //repeatable section consumes. Always returns at least one entry
    //so the section always has a card to render:
    //  - `pv-arrays` present → one editor entry per array.
    //  - legacy `pv-tilt` / `pv-azimuth` present → one entry seeded
    //    from those values, share defaulted to 100.
    //  - nothing set → one entry with all-null fields (placeholders
    //    show through).
    //Field values are stored as `number | null`, where null means
    //"empty input"; that maps directly to the input's value binding.
    private _readPvArrays(): {
        name:      string | null;
        tilt:      number | null;
        azimuth:   number | null;
        share:     number | null;
        peakKwp:   number | null;
        latitude:  number | null;
        longitude: number | null;
        height:    number | null;
    }[]
    {
        const toNum = (v: unknown): number | null =>
        {
            if (v === undefined || v === null || v === '') return null;
            const n = typeof v === 'number' ? v : parseFloat(String(v));
            return isFinite(n) ? n : null;
        };
        const toStr = (v: unknown): string | null =>
        {
            if (v === undefined || v === null) return null;
            const s = String(v).trim();
            return s === '' ? null : s;
        };

        const raw = this._cfg?.['pv-arrays'];
        if (Array.isArray(raw))
        {
            //Honour an explicit empty `pv-arrays: []` as "no array configured" (post-delete state), don't silently fall back to legacy.
            return raw.map(entry =>
            {
                const e = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
                return {
                    name:      toStr(e['name']),
                    tilt:      toNum(e['tilt']),
                    azimuth:   toNum(e['azimuth']),
                    share:     toNum(e['share']),
                    peakKwp:   toNum(e['peak-kwp']),
                    latitude:  toNum(e['latitude']),
                    longitude: toNum(e['longitude']),
                    height:    toNum(e['height']),
                };
            });
        }

        const legacyTilt = toNum(this._cfg?.['pv-tilt']);
        const legacyAz   = toNum(this._cfg?.['pv-azimuth']);
        if (legacyTilt !== null || legacyAz !== null)
        {
            return [{ name: null, tilt: legacyTilt, azimuth: legacyAz, share: 100, peakKwp: null, latitude: null, longitude: null, height: null }];
        }
        return [];
    }

    //Persists a list of array entries to the config under `pv-arrays`
    //and clears the legacy `pv-tilt` / `pv-azimuth` keys in the same
    //event so configs converge to the new shape once the user touches
    //the section. Null fields are dropped so a partially-filled card
    //(e.g. tilt set but azimuth blank) still produces a sparse but
    //valid YAML entry; the card-side reader applies sensible defaults.
    private _writePvArrays(list: {
        name:      string | null;
        tilt:      number | null;
        azimuth:   number | null;
        share:     number | null;
        peakKwp:   number | null;
        latitude:  number | null;
        longitude: number | null;
        height:    number | null;
    }[]): void
    {
        const next = { ...this._cfg } as Record<string, unknown>;
        //Strip the legacy single-orientation keys on every write so configs converge to the new shape regardless of what the user
        //started from.
        delete next['pv-tilt'];
        delete next['pv-azimuth'];
        if (list.length === 0)
        {
            //User emptied the array list: drop the `pv-arrays:` key entirely. The card-side reader then falls back to its defaults
            //(flat-plate horizontal forecast) and the PV chip / chart still render off the live entity, just without per-string
            //orientation weighting.
            delete next['pv-arrays'];
        }
        else
        {
            next['pv-arrays'] = list.map(e =>
            {
                const o: Record<string, number | string> = {};
                if (e.name      !== null) o['name']      = e.name;
                if (e.tilt      !== null) o['tilt']      = e.tilt;
                if (e.azimuth   !== null) o['azimuth']   = e.azimuth;
                if (e.share     !== null) o['share']     = e.share;
                if (e.peakKwp   !== null) o['peak-kwp']  = e.peakKwp;
                if (e.latitude  !== null) o['latitude']  = e.latitude;
                if (e.longitude !== null) o['longitude'] = e.longitude;
                if (e.height    !== null) o['height']    = e.height;
                return o;
            });
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
        this._cfg = next;
    }

    //Updates a single field on entry `i` in the array list. Empty
    //input clears the field to null (mirrors `_numField`); any other
    //unparseable value is ignored so the previous typed value sticks.
    private _arrayField(i: number, key: 'tilt' | 'azimuth' | 'share' | 'peakKwp' | 'latitude' | 'longitude' | 'height', e: Event): void
    {
        const list = this._readPvArrays();
        if (i < 0 || i >= list.length) return;
        const raw = (e.target as HTMLInputElement).value.trim();
        if (raw === '')
        {
            list[i] = { ...list[i], [key]: null };
        }
        else
        {
            const v = parseFloat(raw);
            if (!isFinite(v)) return;
            list[i] = { ...list[i], [key]: v };
        }
        this._writePvArrays(list);
    }

    //Updates the user-typed name for row `i`. Empty input clears the field to null, the summary then falls back to the auto-numbered "Row N" title.
    //Stops the event so the parent <details>` toggle doesn't fire when the user types inside the input.
    private _arrayName(i: number, e: Event): void
    {
        const list = this._readPvArrays();
        if (i < 0 || i >= list.length) return;
        const raw = (e.target as HTMLInputElement).value.trim();
        list[i] = { ...list[i], name: raw === '' ? null : raw };
        this._writePvArrays(list);
    }

    //Adds a new array entry below the existing ones. The new entry
    //is left fully blank so all three inputs show their placeholders
    //(tilt 0, azimuth 180, share = 100 / N). No mirror, no inherited
    //tilt, no share re-balancing of existing entries: a blank row
    //is the only thing the user expects when they click +Add.
    //The engine reads a missing tilt as 0 (horizontal fast path),
    //so a blank row doesn't break the forecast for partially
    //configured layouts. Caps at 6 entries; the +Add button is
    //hidden past that in the render.
    private static readonly PV_ARRAYS_MAX = 6;

    private _arrayAdd(): void
    {
        const list = this._readPvArrays();
        if (list.length >= HeliosCardEditor.PV_ARRAYS_MAX) return;
        list.push({ name: null, tilt: null, azimuth: null, share: null, peakKwp: null, latitude: null, longitude: null, height: null });
        //Open the newly added pan in the editor by default: the user just clicked to add it, so its body should be visible without requiring a second
        //click on the chevron. Existing pans keep their current open/closed state untouched.
        this._openArrayIndices = new Set([...this._openArrayIndices, list.length - 1]);
        this._writePvArrays(list);
    }

    //Removes entry `i`. The render disables this button when only
    //one entry remains so the list never collapses to zero. After
    //removal the remaining shares stay exactly as the user set
    //them; auto-normalisation in the card-side reader handles the
    //rest. The share placeholder updates to reflect the new entry
    //count, so a remaining single entry with a null share visually
    //reads as "100%" without needing to write 100 into the YAML.
    private _arrayRemove(i: number): void
    {
        const list = this._readPvArrays();
        if (i < 0 || i >= list.length) return;
        //Removing the last array is allowed and clears the whole pv-arrays section (see _writePvArrays empty-list branch). Lets the
        //user wipe their orientation setup from the visual editor without dropping to YAML.
        list.splice(i, 1);
        //Shift the open-set so the higher indices map to their new positions after the splice. The removed index drops out, and every index above it
        //slides down by one.
        const next = new Set<number>();
        for (const idx of this._openArrayIndices)
        {
            if (idx === i)        continue;
            if (idx > i)          next.add(idx - 1);
            else                  next.add(idx);
        }
        this._openArrayIndices = next;
        this._writePvArrays(list);
    }

    //Sum of declared shares across the editor's current view; used
    //by the render to decide whether to surface the "auto-normalised"
    //hint. Null shares count as 0, since the user hasn't typed a
    //number there yet and there's no need to nag.
    private _arraySharesSum(list: { share: number | null }[]): number
    {
        return list.reduce((a, e) => a + (e.share ?? 0), 0);
    }

    //Enforces the accordion contract for top-level editor sections:
    //opening one closes every other (Lit re-render is driven by the
    //_openSection state binding the `open` attribute on each
    //<details>). When the user collapses the currently-open section
    //the editor falls back to "everything closed", a valid state
    //since the section content is the only mandatory surface.
    //
    //Also scrolls the just-opened section into view so the user is never left looking at the bottom of the previous section after a click. Done on
    //the next rAF tick so the layout reflects the newly-expanded body before we measure.
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

    //Syncs the local open-set with the <details> element's runtime state on every native `toggle` event. Without this round-trip, Lit re-renders
    //would snap the `open` attribute back to whatever _openArrayIndices says, fighting the user's click.
    private _onArrayToggle(i: number, e: Event): void
    {
        const el = e.currentTarget as HTMLDetailsElement;
        const next = new Set(this._openArrayIndices);
        if (el.open) next.add(i);
        else         next.delete(i);
        this._openArrayIndices = next;
    }

    //Battery-bank editor state machinery. Mirrors the PV-arrays helpers above (read/write to the `batteries:` array with legacy flat-key
    //fallback, per-field updaters, add/remove). Kept separate so a bank edit never touches a PV row by index collision.
    private _readBatteries(): {
        name:        string | null;
        socEntity:   string;
        powerEntity: string;
        powerInvert: boolean;
        capacityKwh: number | null;
    }[]
    {
        const toNum = (v: unknown): number | null =>
        {
            if (v === undefined || v === null || v === '') return null;
            const n = typeof v === 'number' ? v : parseFloat(String(v));
            return isFinite(n) ? n : null;
        };
        const toStr = (v: unknown): string | null =>
        {
            if (v === undefined || v === null) return null;
            const s = String(v).trim();
            return s === '' ? null : s;
        };
        const raw = this._cfg?.['batteries'];
        if (Array.isArray(raw))
        {
            //Empty `batteries: []` is the post-delete state and must be honoured as "no battery configured", not silently fallen-back to
            //legacy keys (which the user may not even have set in the first place).
            return raw.map(entry =>
            {
                const e = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
                return {
                    name:        toStr(e['name']),
                    socEntity:   String(e['soc-entity']   ?? '').trim(),
                    powerEntity: String(e['power-entity'] ?? '').trim(),
                    powerInvert: e['power-invert'] === true,
                    capacityKwh: toNum(e['capacity-kwh']),
                };
            });
        }
        //Legacy single-bank fallback: wrap the flat keys in a one-row list when the user still has flat-key YAML AND has never opened
        //the editor. The first edit migrates to `batteries:` and the legacy keys go away (see _writeBatteries). Returns an empty list
        //when no flat key is set either, so the section shows just the "add bank" button and the user can start clean.
        const soc   = String(this._cfg?.['battery-soc-entity']   ?? '').trim();
        const power = String(this._cfg?.['battery-power-entity'] ?? '').trim();
        if (soc === '' && power === '') return [];
        return [{
            name:        null,
            socEntity:   soc,
            powerEntity: power,
            powerInvert: this._cfg?.['battery-power-invert'] === true,
            capacityKwh: null,
        }];
    }

    //Persists a list of bank entries under `batteries:` and clears the legacy flat keys in the same event so configs converge to the new
    //shape on first edit. Empty entity strings are dropped from the YAML so a half-filled new row produces a sparse but valid bank.
    private _writeBatteries(list: {
        name:        string | null;
        socEntity:   string;
        powerEntity: string;
        powerInvert: boolean;
        capacityKwh: number | null;
    }[]): void
    {
        const next = { ...this._cfg } as Record<string, unknown>;
        //Legacy flat keys are always stripped on any battery edit so configs converge to the new shape regardless of what the user
        //started from.
        delete next['battery-soc-entity'];
        delete next['battery-power-entity'];
        delete next['battery-power-invert'];
        if (list.length === 0)
        {
            //User emptied the bank list, drop the `batteries:` key entirely so the YAML reads as "no battery configured" and parse-
            //BatteryBanks returns an empty list (chip + dashboard battery card hidden).
            delete next['batteries'];
        }
        else
        {
            next['batteries'] = list.map(e =>
            {
                const o: Record<string, number | string | boolean> = {};
                if (e.name        !== null) o['name']         = e.name;
                if (e.socEntity   !== '')   o['soc-entity']   = e.socEntity;
                if (e.powerEntity !== '')   o['power-entity'] = e.powerEntity;
                if (e.powerInvert)          o['power-invert'] = true;
                if (e.capacityKwh !== null) o['capacity-kwh'] = e.capacityKwh;
                return o;
            });
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
        this._cfg = next as HeliosConfig;
    }

    private _bankEntity(i: number, key: 'socEntity' | 'powerEntity', value: string): void
    {
        const list = this._readBatteries();
        if (i < 0 || i >= list.length) return;
        list[i] = { ...list[i], [key]: (value ?? '').trim() };
        this._writeBatteries(list);
    }

    private _bankName(i: number, e: Event): void
    {
        const list = this._readBatteries();
        if (i < 0 || i >= list.length) return;
        const raw = (e.target as HTMLInputElement).value.trim();
        list[i] = { ...list[i], name: raw === '' ? null : raw };
        this._writeBatteries(list);
    }

    private _bankCapacity(i: number, e: Event): void
    {
        const list = this._readBatteries();
        if (i < 0 || i >= list.length) return;
        const raw = (e.target as HTMLInputElement).value.trim();
        if (raw === '')
        {
            list[i] = { ...list[i], capacityKwh: null };
        }
        else
        {
            const v = parseFloat(raw);
            if (!isFinite(v) || v <= 0) return;
            list[i] = { ...list[i], capacityKwh: v };
        }
        this._writeBatteries(list);
    }

    private _bankInvert(i: number, invert: boolean): void
    {
        const list = this._readBatteries();
        if (i < 0 || i >= list.length) return;
        list[i] = { ...list[i], powerInvert: invert };
        this._writeBatteries(list);
    }

    //Hard cap on banks. Same rationale as PV_ARRAYS_MAX: anything past 6 starts getting unreadable in the chip aggregation explanation,
    //and almost no residential install has more than 4 banks.
    private static readonly BATTERIES_MAX = 6;

    private _bankAdd(): void
    {
        const list = this._readBatteries();
        if (list.length >= HeliosCardEditor.BATTERIES_MAX) return;
        list.push({ name: null, socEntity: '', powerEntity: '', powerInvert: false, capacityKwh: null });
        this._openBatteryIndices = new Set([...this._openBatteryIndices, list.length - 1]);
        this._writeBatteries(list);
    }

    private _bankRemove(i: number): void
    {
        const list = this._readBatteries();
        if (i < 0 || i >= list.length) return;
        list.splice(i, 1);
        //Removing the last bank is allowed and clears the whole battery section (see _writeBatteries empty-list branch). Lets the user
        //wipe their setup from the visual editor without dropping to YAML.
        const next = new Set<number>();
        for (const idx of this._openBatteryIndices)
        {
            if (idx === i)        continue;
            if (idx > i)          next.add(idx - 1);
            else                  next.add(idx);
        }
        this._openBatteryIndices = next;
        this._writeBatteries(list);
    }

    private _onBankToggle(i: number, e: Event): void
    {
        const el = e.currentTarget as HTMLDetailsElement;
        const next = new Set(this._openBatteryIndices);
        if (el.open) next.add(i);
        else         next.delete(i);
        this._openBatteryIndices = next;
    }

    //Format a numeric slider value for display alongside the input.
    //Integers stay integer; fractional values get 2 decimals.
    private _fmtNum(v: number, step: number): string
    {
        return step >= 1 ? String(Math.round(v)) : v.toFixed(2);
    }

    //Filter for the PV entity picker, accepts power/energy device
    //classes (the canonical case) plus any sensor whose unit looks
    //like W/kW/MW or Wh/kWh/MWh. The unit fallback covers custom
    //template sensors that don't bother declaring a device_class.
    private _pvEntityFilter = (entity: any): boolean =>
    {
        if (!entity || !entity.attributes) return false;
        const dc = entity.attributes.device_class;
        if (dc === 'power' || dc === 'energy') return true;
        const u = String(entity.attributes.unit_of_measurement ?? '').trim();
        return u === 'W'  || u === 'kW' || u === 'MW'
            || u === 'Wh' || u === 'kWh' || u === 'MWh';
    };

    //Filter for the battery SoC picker, sensors with device_class
    //'battery' (the canonical case used by every BMS integration)
    //or any sensor with a percent unit. Energy/power sensors are
    //intentionally excluded; SoC is a percentage by design.
    private _batterySocEntityFilter = (entity: any): boolean =>
    {
        if (!entity || !entity.attributes) return false;
        if (entity.attributes.device_class === 'battery') return true;
        const u = String(entity.attributes.unit_of_measurement ?? '').trim();
        return u === '%';
    };

    //Filter for the battery power picker, power-only (no energy).
    //The chip needs an instantaneous reading; cumulative kWh totals
    //wouldn't make sense here without on-the-fly differentiation,
    //which we deliberately don't do for battery (PV does, battery
    //doesn't, to keep this overlay simple per the design brief).
    private _batteryPowerEntityFilter = (entity: any): boolean =>
    {
        if (!entity || !entity.attributes) return false;
        if (entity.attributes.device_class === 'power') return true;
        const u = String(entity.attributes.unit_of_measurement ?? '').trim();
        return u === 'W' || u === 'kW' || u === 'MW';
    };

    //Filter for the solar-radiation picker. The canonical match is a
    //sensor with the irradiance device_class (HA core 2024.4+) or any
    //sensor reporting global shortwave radiation in W/m². The unit
    //fallback catches custom template sensors that don't bother
    //declaring a device_class, which is the common case for
    //integrations like Ecowitt where the field is just a raw float.
    private _solarRadiationEntityFilter = (entity: any): boolean =>
    {
        if (!entity || !entity.attributes) return false;
        if (entity.attributes.device_class === 'irradiance') return true;
        const u = String(entity.attributes.unit_of_measurement ?? '').trim();
        return u === 'W/m²' || u === 'W/m2';
    };

    //Multi-entity grid editor: each slot (import / export) accepts a
    //list of entities, same UX as the PV-array / battery-bank lists
    //above but trimmed to a single field per entry. The slot's value
    //in the config is normalised on read: a leftover legacy string
    //is converted to a one-element array, and a fully empty array is
    //serialised as an absent key so the YAML stays clean.
    private static GRID_SOURCES_MAX = 8;

    private _readGridSources(slot: 'import' | 'export'): string[]
    {
        const key = slot === 'import' ? 'grid-import-entity' : 'grid-export-entity';
        const raw = (this._cfg as Record<string, unknown> | undefined)?.[key];
        if (Array.isArray(raw))
        {
            return (raw as unknown[])
                .filter((s): s is string => typeof s === 'string')
                .map(s => s.trim());
        }
        if (typeof raw === 'string' && raw.trim() !== '') return [raw.trim()];
        return [];
    }

    private _writeGridSources(slot: 'import' | 'export', list: string[]): void
    {
        if (!this._cfg) return;
        const key = slot === 'import' ? 'grid-import-entity' : 'grid-export-entity';
        const next = { ...this._cfg } as Record<string, unknown>;
        //Preserve empty placeholder rows so the editor can render a
        //fresh entity-picker waiting for input after the user clicks
        //"Add a source". Filtering empties out at write-time was the
        //bug that made the Add button look broken: every fresh row
        //was stripped before render.
        //
        //Collapse to a single string only when the list has exactly
        //one non-empty entry AND no empty placeholders are pending
        //(otherwise the picker UI would lose the row the user is
        //about to fill in). Drop the key entirely only when the list
        //is fully empty.
        if (list.length === 0)
        {
            delete next[key];
        }
        else if (list.length === 1 && list[0].trim() !== '')
        {
            next[key] = list[0];
        }
        else
        {
            next[key] = list.slice();
        }
        this._cfg = next as HeliosConfig;
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
    }

    private _gridSourceAdd(slot: 'import' | 'export'): void
    {
        const list = this._readGridSources(slot);
        if (list.length >= HeliosCardEditor.GRID_SOURCES_MAX) return;
        list.push('');
        this._writeGridSources(slot, list);
    }

    private _gridSourceRemove(slot: 'import' | 'export', i: number): void
    {
        const list = this._readGridSources(slot);
        list.splice(i, 1);
        this._writeGridSources(slot, list);
    }

    private _gridSourceSet(slot: 'import' | 'export', i: number, value: string): void
    {
        const list = this._readGridSources(slot);
        list[i] = value;
        this._writeGridSources(slot, list);
    }

    //Combined signed grid-power entity (grid-power-entity). A single
    //picker rather than the multi-source list above: one signed
    //sensor whose sign encodes the direction is the whole point, the
    //array form (summed phases) stays a YAML-only power-user path.
    //An array already in the config is collapsed to its first entry
    //for display so the editor never silently drops the others.
    private _readGridPowerEntity(): string
    {
        const raw = (this._cfg as Record<string, unknown> | undefined)?.['grid-power-entity'];
        if (Array.isArray(raw))
        {
            const first = (raw as unknown[]).find(s => typeof s === 'string' && s.trim() !== '');
            return typeof first === 'string' ? first.trim() : '';
        }
        return typeof raw === 'string' ? raw.trim() : '';
    }

    private _writeGridPowerEntity(value: string): void
    {
        if (!this._cfg) return;
        const next = { ...this._cfg } as Record<string, unknown>;
        const trimmed = value.trim();
        //Clearing the picker drops the combined slot entirely (and its
        //sign flag with it) so the directional import / export pickers
        //below reappear; the YAML stays clean of an empty key.
        if (trimmed === '')
        {
            delete next['grid-power-entity'];
            delete next['grid-power-invert'];
        }
        else
        {
            next['grid-power-entity'] = trimmed;
        }
        this._cfg = next as HeliosConfig;
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
    }

    private _readGridPowerInvert(): boolean
    {
        return (this._cfg as Record<string, unknown> | undefined)?.['grid-power-invert'] === true;
    }

    private _writeGridPowerInvert(invert: boolean): void
    {
        if (!this._cfg) return;
        const next = { ...this._cfg } as Record<string, unknown>;
        //Default (false) is the absent state, so we only persist the
        //flag when the user picks the inverted convention.
        if (invert) next['grid-power-invert'] = true;
        else        delete next['grid-power-invert'];
        this._cfg = next as HeliosConfig;
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next as HeliosConfig } }));
    }

    private _renderGridSlot(slot: 'import' | 'export'): TemplateResult
    {
        const t = pickTranslations(this.hass?.language);
        const list  = this._readGridSources(slot);
        const title = slot === 'import' ? t.editor.gridImportTitle : t.editor.gridExportTitle;
        const hint  = slot === 'import' ? t.editor.gridImportHint  : t.editor.gridExportHint;
        return html`
            <div class="grid-slot-block">
                <div class="grid-slot-title">${title}</div>
                <div class="hint">${hint}</div>
                ${list.length === 0 ? html`
                    <button
                        type="button"
                        class="pv-array-add"
                        @click="${() => this._gridSourceAdd(slot)}"
                    >+ ${t.editor.gridSourceAdd}</button>
                ` : html`
                    ${list.map((entity, i) => html`
                        <div class="grid-source-row">
                            <div class="grid-source-picker">
                                ${this._pickerReady ? html`
                                    <ha-entity-picker
                                        allow-custom-entity
                                        .hass="${this.hass}"
                                        .value="${entity}"
                                        .includeDomains="${['sensor', 'input_number']}"
                                        @value-changed="${(e: CustomEvent) => this._gridSourceSet(slot, i, e.detail.value ?? '')}"
                                    ></ha-entity-picker>
                                ` : html`
                                    <input
                                        type="text"
                                        .value="${entity}"
                                        placeholder="sensor.${slot === 'import' ? 'grid_import' : 'grid_export'}"
                                        @change="${(e: Event) => this._gridSourceSet(slot, i, (e.target as HTMLInputElement).value)}"
                                    />
                                `}
                            </div>
                            <button
                                type="button"
                                class="pv-array-remove"
                                aria-label="${t.editor.gridSourceRemove}"
                                @click="${() => this._gridSourceRemove(slot, i)}"
                            >${t.editor.gridSourceRemove}</button>
                        </div>
                    `)}
                    ${list.length < HeliosCardEditor.GRID_SOURCES_MAX ? html`
                        <button
                            type="button"
                            class="pv-array-add"
                            @click="${() => this._gridSourceAdd(slot)}"
                        >+ ${t.editor.gridSourceAdd}</button>
                    ` : nothing}
                `}
            </div>
        `;
    }

    //Combined signed-entity block at the top of the grid section. A
    //single picker plus a sign-convention toggle; the toggle and its
    //help only appear once an entity is wired so the empty state stays
    //compact. When an entity is set the directional import / export
    //blocks below are collapsed by the caller (the combined slot owns
    //both chips).
    private _renderGridCombined(): TemplateResult
    {
        const t      = pickTranslations(this.hass?.language);
        const entity = this._readGridPowerEntity();
        const invert = this._readGridPowerInvert();
        return html`
            <div class="grid-slot-block">
                <div class="grid-slot-title">${t.editor.gridCombinedTitle}</div>
                <div class="hint">${t.editor.gridCombinedHint}</div>
                <div class="grid-source-row">
                    <div class="grid-source-picker">
                        ${this._pickerReady ? html`
                            <ha-entity-picker
                                allow-custom-entity
                                .hass="${this.hass}"
                                .value="${entity}"
                                .includeDomains="${['sensor', 'input_number']}"
                                @value-changed="${(e: CustomEvent) => this._writeGridPowerEntity(e.detail.value ?? '')}"
                            ></ha-entity-picker>
                        ` : html`
                            <input
                                type="text"
                                .value="${entity}"
                                placeholder="sensor.grid_power"
                                @change="${(e: Event) => this._writeGridPowerEntity((e.target as HTMLInputElement).value)}"
                            />
                        `}
                    </div>
                    ${entity !== '' ? html`
                        <button
                            type="button"
                            class="pv-array-remove"
                            aria-label="${t.editor.gridSourceRemove}"
                            @click="${() => this._writeGridPowerEntity('')}"
                        >${t.editor.gridSourceRemove}</button>
                    ` : nothing}
                </div>
                ${entity !== '' ? html`
                    <div class="field">
                        <span class="label">${t.editor.gridInvertLabel}</span>
                        <div class="segmented-toggle">
                            <button
                                type="button"
                                class="seg-option ${(!invert) ? 'active' : ''}"
                                @click="${() => this._writeGridPowerInvert(false)}"
                            >${t.editor.gridInvertStandard}</button>
                            <button
                                type="button"
                                class="seg-option ${(invert) ? 'active' : ''}"
                                @click="${() => this._writeGridPowerInvert(true)}"
                            >${t.editor.gridInvertInverted}</button>
                        </div>
                    </div>
                    <div class="field-help">${t.editor.gridInvertHelp}</div>
                ` : nothing}
            </div>
        `;
    }

    protected render(): TemplateResult
    {
        const c = this._cfg;
        const t = this._t();

        //Placeholders for the home lat/lon override fields. We surface
        //HA's currently-configured home so the user instantly sees what
        //they would be overriding, falling back to a neutral example
        //(Amsterdam) when HA hasn't set one. Empty input means "use
        //HA's home"; the placeholder is non-binding text only.
        const haLat = this.hass?.config?.latitude;
        const haLon = this.hass?.config?.longitude;
        const latPlaceholder = typeof haLat === 'number' && isFinite(haLat)
            ? String(haLat) : '52.379';
        const lonPlaceholder = typeof haLon === 'number' && isFinite(haLon)
            ? String(haLon) : '4.900';

        return html`
            <div class="editor">

                <details class="advanced-section" ?open="${this._openSection === 'location'}" @toggle="${(e: Event) => this._onSectionToggle('location', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.locationSection}</summary>
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
                    <summary class="section-title section-title-collapse">${t.editor.mapSection}</summary>
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

                </details>

                <details class="advanced-section" ?open="${this._openSection === 'ui'}" @toggle="${(e: Event) => this._onSectionToggle('ui', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.uiSection}</summary>
                    <label class="field">
                        <span class="label">${t.editor.dateFormat}</span>
                        <input
                            type="text"
                            .value="${String(c['date-format'] ?? '')}"
                            placeholder="mm-dd"
                            @change="${(e: Event) => this._str('date-format', e)}"
                        />
                    </label>
                    <div class="field-help">
                        ${t.editor.dateFormatHelp} <code>mm-dd</code>, <code>dd/mm</code>, <code>yyyy-mm-dd</code>.
                    </div>
                    <div class="field">
                        <span class="label">${t.editor.timeFormat}</span>
                        <div class="segmented-toggle">
                            <button
                                type="button"
                                class="seg-option ${(String(c['time-format'] ?? '24h')) === '24h' ? 'active' : ''}"
                                @click="${() => this._update('time-format', '24h')}"
                            >${t.editor.timeFormat24}</button>
                            <button
                                type="button"
                                class="seg-option ${(String(c['time-format'] ?? '24h')) === '12h' ? 'active' : ''}"
                                @click="${() => this._update('time-format', '12h')}"
                            >${t.editor.timeFormat12}</button>
                        </div>
                    </div>
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
                    <div class="field">
                        <span class="label">${t.editor.pixelRatio}</span>
                        <div class="segmented-toggle">
                            <button
                                type="button"
                                class="seg-option ${(String(c['pixel-ratio'] ?? 'auto')).toLowerCase() !== '1x' ? 'active' : ''}"
                                @click="${() => this._update('pixel-ratio', 'auto')}"
                            >${t.editor.pixelRatioAuto}</button>
                            <button
                                type="button"
                                class="seg-option ${(String(c['pixel-ratio'] ?? 'auto')).toLowerCase() === '1x' ? 'active' : ''}"
                                @click="${() => this._update('pixel-ratio', '1x')}"
                            >${t.editor.pixelRatio1x}</button>
                        </div>
                    </div>
                    <div class="hint">${t.editor.pixelRatioHint}</div>
                    <label class="field">
                        <span class="label">${t.editor.displayRadius}</span>
                        <div class="slider-row">
                            <input
                                type="range" min="20" max="500" step="10"
                                .value="${String(c['building-radius'] ?? DEFAULT_BUILDING_RADIUS_M)}"
                                @input="${(e: Event) => this._numSlider('building-radius', e)}"
                            />
                            <span class="slider-value">${this._fmtNum(Number(c['building-radius'] ?? DEFAULT_BUILDING_RADIUS_M), 1)} m</span>
                        </div>
                    </label>
                    <div class="hint">${t.editor.displayRadiusHint}</div>

                    <details class="advanced-section" open>
                        <summary class="section-title section-title-collapse">${t.editor.timelineSection}</summary>
                        <div class="field">
                            <span class="label">${t.editor.timelineEnabled}</span>
                            <div class="segmented-toggle">
                                <button
                                    type="button"
                                    class="seg-option ${((c['timeline-enabled'] ?? DEFAULT_TIMELINE_ENABLED) === true) ? 'active' : ''}"
                                    @click="${() => this._update('timeline-enabled', true)}"
                                >${t.editor.timelineEnabledOn}</button>
                                <button
                                    type="button"
                                    class="seg-option ${((c['timeline-enabled'] ?? DEFAULT_TIMELINE_ENABLED) !== true) ? 'active' : ''}"
                                    @click="${() => this._update('timeline-enabled', false)}"
                                >${t.editor.timelineEnabledOff}</button>
                            </div>
                        </div>
                        <div class="hint">${t.editor.timelineEnabledHint}</div>
                        <label class="field">
                            <span class="label">${t.editor.timelineWidth}</span>
                            <div class="slider-row">
                                <input
                                    type="range" min="50" max="100" step="5"
                                    .value="${String(c['timeline-width-pct'] ?? DEFAULT_TIMELINE_WIDTH_PCT)}"
                                    @input="${(e: Event) => this._numSlider('timeline-width-pct', e)}"
                                />
                                <span class="slider-value">${this._fmtNum(Number(c['timeline-width-pct'] ?? DEFAULT_TIMELINE_WIDTH_PCT), 1)} %</span>
                            </div>
                        </label>
                        <div class="hint">${t.editor.timelineWidthHint}</div>
                        <div class="field">
                            <span class="label">${t.editor.timelineConsumption}</span>
                            <div class="segmented-toggle">
                                <button
                                    type="button"
                                    class="seg-option ${((c['timeline-consumption-enabled'] ?? DEFAULT_TIMELINE_CONSUMPTION_ENABLED) === true) ? 'active' : ''}"
                                    @click="${() => this._update('timeline-consumption-enabled', true)}"
                                >${t.editor.timelineConsumptionOn}</button>
                                <button
                                    type="button"
                                    class="seg-option ${((c['timeline-consumption-enabled'] ?? DEFAULT_TIMELINE_CONSUMPTION_ENABLED) !== true) ? 'active' : ''}"
                                    @click="${() => this._update('timeline-consumption-enabled', false)}"
                                >${t.editor.timelineConsumptionOff}</button>
                            </div>
                        </div>
                        <div class="hint">${t.editor.timelineConsumptionHint}</div>
                    </details>
                </details>

                <details class="advanced-section" ?open="${this._openSection === 'buildings'}" @toggle="${(e: Event) => this._onSectionToggle('buildings', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.buildingsSection}</summary>
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
                    <summary class="section-title section-title-collapse">${t.editor.shadowsSection}</summary>
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
                    <span class="label">${t.editor.lidarPrecision}</span>
                    <select
                        class="he-select"
                        .value="${String(c['lidar-precision'] ?? DEFAULT_LIDAR_PRECISION)}"
                        @change="${(e: Event) => this._update('lidar-precision', (e.target as HTMLSelectElement).value)}"
                    >
                        <option value="low"    ?selected="${(String(c['lidar-precision'] ?? DEFAULT_LIDAR_PRECISION)) === 'low'}">${t.editor.lidarPrecisionLow}</option>
                        <option value="medium" ?selected="${(String(c['lidar-precision'] ?? DEFAULT_LIDAR_PRECISION)) === 'medium'}">${t.editor.lidarPrecisionMedium}</option>
                        <option value="high"   ?selected="${(String(c['lidar-precision'] ?? DEFAULT_LIDAR_PRECISION)) === 'high'}">${t.editor.lidarPrecisionHigh}</option>
                    </select>
                </label>
                <div class="hint">${t.editor.lidarPrecisionHint}</div>

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

                <details class="advanced-section" ?open="${this._openSection === 'pv'}" @toggle="${(e: Event) => this._onSectionToggle('pv', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.pvSection}</summary>
                <div class="hint">${t.editor.pvHint}</div>
                <div class="field field-block">
                    <span class="label">${t.editor.pvEntity}</span>
                    ${this._pickerReady ? html`
                        <ha-entity-picker
                            allow-custom-entity
                            .hass="${this.hass}"
                            .value="${String(c['pv-power-entity'] ?? '')}"
                            .includeDomains="${['sensor', 'input_number']}"
                            .entityFilter="${this._pvEntityFilter}"
                            @value-changed="${(e: CustomEvent) => this._update('pv-power-entity', e.detail.value ?? '')}"
                        ></ha-entity-picker>
                    ` : html`
                        <input
                            type="text"
                            .value="${String(c['pv-power-entity'] ?? '')}"
                            placeholder="sensor.solar_power"
                            @change="${(e: Event) => this._str('pv-power-entity', e)}"
                        />
                    `}
                </div>
                <div class="field-help">${t.editor.pvEntityHelp}</div>
                <label class="field">
                    <span class="label">${t.editor.pvPeakPower}</span>
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="6.5"
                        .value="${c['pv-peak-kwp'] != null ? String(c['pv-peak-kwp']) : ''}"
                        @change="${(e: Event) => this._numField('pv-peak-kwp', e)}"
                    />
                </label>
                <div class="field-help">${t.editor.pvPeakPowerHelp}</div>
                <label class="field">
                    <span class="label">${t.editor.pvInverterMaxKw}</span>
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="5"
                        .value="${c['pv-inverter-max-kw'] != null ? String(c['pv-inverter-max-kw']) : ''}"
                        @change="${(e: Event) => this._numField('pv-inverter-max-kw', e)}"
                    />
                </label>
                <div class="field-help">${t.editor.pvInverterMaxKwHelp}</div>
                ${(() => {
                    const arrays   = this._readPvArrays();
                    const sharesSum = this._arraySharesSum(arrays);
                    //Hint shows only when the user has filled at least
                    //two shares and they don't sum to 100 (±0.5 % to
                    //accommodate the integer-split rounding the +Add
                    //button emits). Quiet for the single-array case
                    //and for the "all blank" initial state.
                    const explicit = arrays.filter(a => a.share !== null).length;
                    const showNormHint = explicit >= 2 && Math.abs(sharesSum - 100) > 0.5;
                    //Auto-open the multi-array section when the user
                    //already has config there (either the new pv-arrays
                    //shape or the legacy pv-tilt key). A fresh editor
                    //starts collapsed to keep the simple-install case
                    //visually quiet.
                    const hasArrays = Array.isArray(c['pv-arrays']) && (c['pv-arrays'] as unknown[]).length > 0;
                    const hasLegacy = c['pv-tilt'] != null && c['pv-tilt'] !== '';
                    const sectionOpen = hasArrays || hasLegacy;
                    return html`
                        <details class="advanced-section" ?open="${sectionOpen}">
                            <summary class="section-title section-title-collapse">${t.editor.pvArraysSection}</summary>
                            <div class="hint">${t.editor.pvArraysHelp}</div>
                            ${arrays.map((arr, i) => {
                                const fallback = t.editor.pvArrayTitle.replace('{n}', String(i + 1));
                                const title = arr.name ?? fallback;
                                const isOpen = this._openArrayIndices.has(i);
                                return html`
                                    <details class="pv-array-card" ?open="${isOpen}" @toggle="${(e: Event) => this._onArrayToggle(i, e)}">
                                        <summary class="pv-array-summary">
                                            <span class="pv-array-chevron" aria-hidden="true"></span>
                                            <span class="pv-array-title">${title}</span>
                                            <button
                                                type="button"
                                                class="pv-array-remove"
                                                aria-label="${t.editor.pvArrayRemove}: ${title}"
                                                @click="${(e: Event) => { e.preventDefault(); e.stopPropagation(); this._arrayRemove(i); }}"
                                            >${t.editor.pvArrayRemove}</button>
                                        </summary>
                                        <div class="pv-array-body">
                                            <label class="field">
                                                <span class="label">${t.editor.pvArrayName}</span>
                                                <input
                                                    type="text"
                                                    maxlength="40"
                                                    placeholder="${fallback}"
                                                    .value="${arr.name ?? ''}"
                                                    @change="${(e: Event) => this._arrayName(i, e)}"
                                                />
                                            </label>
                                            <div class="field-help">${t.editor.pvArrayNameHelp}</div>
                                            <label class="field">
                                                <span class="label">${t.editor.pvArrayTilt}</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="90"
                                                    step="1"
                                                    placeholder="0"
                                                    .value="${arr.tilt !== null ? String(arr.tilt) : ''}"
                                                    @change="${(e: Event) => this._arrayField(i, 'tilt', e)}"
                                                />
                                            </label>
                                            <div class="field-help">${t.editor.pvArrayTiltHelp}</div>
                                            <label class="field">
                                                <span class="label">${t.editor.pvArrayAzimuth}</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="360"
                                                    step="1"
                                                    placeholder="180"
                                                    .value="${arr.azimuth !== null ? String(arr.azimuth) : ''}"
                                                    @change="${(e: Event) => this._arrayField(i, 'azimuth', e)}"
                                                />
                                            </label>
                                            <div class="field-help">${t.editor.pvArrayAzimuthHelp}</div>
                                            <label class="field">
                                                <span class="label">${t.editor.pvArrayPeakKwp}</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    placeholder="3.2"
                                                    .value="${arr.peakKwp !== null ? String(arr.peakKwp) : ''}"
                                                    @change="${(e: Event) => this._arrayField(i, 'peakKwp', e)}"
                                                />
                                            </label>
                                            <div class="field-help">${t.editor.pvArrayPeakKwpHelp}</div>
                                            <label class="field">
                                                <span class="label">${t.editor.pvArrayLatitude}</span>
                                                <input
                                                    type="number"
                                                    min="-90"
                                                    max="90"
                                                    step="any"
                                                    placeholder="${t.editor.pvArrayCoordsPlaceholder}"
                                                    .value="${arr.latitude !== null ? String(arr.latitude) : ''}"
                                                    @change="${(e: Event) => this._arrayField(i, 'latitude', e)}"
                                                />
                                            </label>
                                            <label class="field">
                                                <span class="label">${t.editor.pvArrayLongitude}</span>
                                                <input
                                                    type="number"
                                                    min="-180"
                                                    max="180"
                                                    step="any"
                                                    placeholder="${t.editor.pvArrayCoordsPlaceholder}"
                                                    .value="${arr.longitude !== null ? String(arr.longitude) : ''}"
                                                    @change="${(e: Event) => this._arrayField(i, 'longitude', e)}"
                                                />
                                            </label>
                                            <div class="field-help">${t.editor.pvArrayCoordsHelp}</div>
                                            <label class="field">
                                                <span class="label">${t.editor.pvArrayHeight}</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="60"
                                                    step="0.5"
                                                    placeholder="5"
                                                    .value="${arr.height !== null ? String(arr.height) : ''}"
                                                    @change="${(e: Event) => this._arrayField(i, 'height', e)}"
                                                />
                                            </label>
                                            <div class="field-help">${t.editor.pvArrayHeightHelp}</div>
                                        </div>
                                    </details>
                                `;
                            })}
                            ${arrays.length < HeliosCardEditor.PV_ARRAYS_MAX ? html`
                                <button
                                    type="button"
                                    class="pv-array-add"
                                    @click="${() => this._arrayAdd()}"
                                >${t.editor.pvArrayAdd}</button>
                            ` : nothing}
                            ${showNormHint ? html`
                                <div class="hint">${t.editor.pvArrayNormHint}</div>
                            ` : nothing}
                        </details>
                    `;
                })()}

                </details>

                <details class="advanced-section" ?open="${this._openSection === 'grid'}" @toggle="${(e: Event) => this._onSectionToggle('grid', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.gridSection}</summary>
                    <div class="hint">${t.editor.gridHint}</div>
                    ${this._renderGridCombined()}
                    ${this._readGridPowerEntity() === '' ? html`
                        ${this._renderGridSlot('import')}
                        ${this._renderGridSlot('export')}
                    ` : nothing}
                </details>

                <details class="advanced-section" ?open="${this._openSection === 'shading'}" @toggle="${(e: Event) => this._onSectionToggle('shading', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.shadingSection}</summary>
                    ${renderShadingMapSection({ hass: this.hass, onAfterChange: () => this.requestUpdate() })}
                </details>

                <details class="advanced-section" ?open="${this._openSection === 'battery'}" @toggle="${(e: Event) => this._onSectionToggle('battery', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.batterySection}</summary>
                    <div class="hint">${t.editor.batteryHint}</div>
                    ${(() => {
                        const banks = this._readBatteries();
                        return html`
                            ${banks.map((bank, i) => {
                                const fallback = t.editor.batteryBankTitle.replace('{n}', String(i + 1));
                                const title    = bank.name ?? fallback;
                                const isOpen   = this._openBatteryIndices.has(i);
                                return html`
                                    <details class="pv-array-card" ?open="${isOpen}" @toggle="${(e: Event) => this._onBankToggle(i, e)}">
                                        <summary class="pv-array-summary">
                                            <span class="pv-array-chevron" aria-hidden="true"></span>
                                            <span class="pv-array-title">${title}</span>
                                            <button
                                                type="button"
                                                class="pv-array-remove"
                                                aria-label="${t.editor.batteryBankRemove}: ${title}"
                                                @click="${(e: Event) => { e.preventDefault(); e.stopPropagation(); this._bankRemove(i); }}"
                                            >${t.editor.batteryBankRemove}</button>
                                        </summary>
                                        <div class="pv-array-body">
                                            <label class="field">
                                                <span class="label">${t.editor.batteryBankName}</span>
                                                <input
                                                    type="text"
                                                    maxlength="40"
                                                    placeholder="${fallback}"
                                                    .value="${bank.name ?? ''}"
                                                    @change="${(e: Event) => this._bankName(i, e)}"
                                                />
                                            </label>
                                            <div class="field-help">${t.editor.batteryBankNameHelp}</div>
                                            <div class="field field-block">
                                                <span class="label">${t.editor.batterySocEntity}</span>
                                                ${this._pickerReady ? html`
                                                    <ha-entity-picker
                                                        allow-custom-entity
                                                        .hass="${this.hass}"
                                                        .value="${bank.socEntity}"
                                                        .includeDomains="${['sensor', 'input_number']}"
                                                        .entityFilter="${this._batterySocEntityFilter}"
                                                        @value-changed="${(e: CustomEvent) => this._bankEntity(i, 'socEntity', e.detail.value ?? '')}"
                                                    ></ha-entity-picker>
                                                ` : html`
                                                    <input
                                                        type="text"
                                                        .value="${bank.socEntity}"
                                                        placeholder="sensor.battery_soc"
                                                        @change="${(e: Event) => this._bankEntity(i, 'socEntity', (e.target as HTMLInputElement).value)}"
                                                    />
                                                `}
                                            </div>
                                            <div class="field-help">${t.editor.batterySocEntityHelp}</div>
                                            <div class="field field-block">
                                                <span class="label">${t.editor.batteryPowerEntity}</span>
                                                ${this._pickerReady ? html`
                                                    <ha-entity-picker
                                                        allow-custom-entity
                                                        .hass="${this.hass}"
                                                        .value="${bank.powerEntity}"
                                                        .includeDomains="${['sensor', 'input_number']}"
                                                        .entityFilter="${this._batteryPowerEntityFilter}"
                                                        @value-changed="${(e: CustomEvent) => this._bankEntity(i, 'powerEntity', e.detail.value ?? '')}"
                                                    ></ha-entity-picker>
                                                ` : html`
                                                    <input
                                                        type="text"
                                                        .value="${bank.powerEntity}"
                                                        placeholder="sensor.battery_power"
                                                        @change="${(e: Event) => this._bankEntity(i, 'powerEntity', (e.target as HTMLInputElement).value)}"
                                                    />
                                                `}
                                            </div>
                                            <div class="field-help">${t.editor.batteryPowerEntityHelp}</div>
                                            <div class="field">
                                                <span class="label">${t.editor.batteryPowerInvert}</span>
                                                <div class="segmented-toggle">
                                                    <button
                                                        type="button"
                                                        class="seg-option ${(!bank.powerInvert) ? 'active' : ''}"
                                                        @click="${() => this._bankInvert(i, false)}"
                                                    >${t.editor.batteryPowerInvertStandard}</button>
                                                    <button
                                                        type="button"
                                                        class="seg-option ${(bank.powerInvert) ? 'active' : ''}"
                                                        @click="${() => this._bankInvert(i, true)}"
                                                    >${t.editor.batteryPowerInvertInverted}</button>
                                                </div>
                                            </div>
                                            <div class="field-help">${t.editor.batteryPowerInvertHelp}</div>
                                            <label class="field">
                                                <span class="label">${t.editor.batteryCapacityKwh}</span>
                                                <input
                                                    type="number"
                                                    min="0.1"
                                                    step="0.1"
                                                    placeholder="10"
                                                    .value="${bank.capacityKwh !== null ? String(bank.capacityKwh) : ''}"
                                                    @change="${(e: Event) => this._bankCapacity(i, e)}"
                                                />
                                            </label>
                                            <div class="field-help">${t.editor.batteryCapacityKwhHelp}</div>
                                        </div>
                                    </details>
                                `;
                            })}
                            ${banks.length < HeliosCardEditor.BATTERIES_MAX ? html`
                                <button
                                    type="button"
                                    class="pv-array-add"
                                    @click="${() => this._bankAdd()}"
                                >+ ${t.editor.batteryBankAdd}</button>
                            ` : nothing}
                        `;
                    })()}
                    <div class="field" style="margin-top: 14px;">
                        <span class="label">${t.editor.inverterCutoffSocPct}</span>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            .value="${c['inverter-cutoff-soc-pct'] != null ? String(c['inverter-cutoff-soc-pct']) : ''}"
                            placeholder="95"
                            @change="${(e: Event) => this._numField('inverter-cutoff-soc-pct', e)}"
                        />
                    </div>
                    <div class="field-help">${t.editor.inverterCutoffSocPctHelp}</div>
                </details>

                <details class="advanced-section" ?open="${this._openSection === 'weather'}" @toggle="${(e: Event) => this._onSectionToggle('weather', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.weatherSection}</summary>
                    <div class="hint">${t.editor.weatherHint}</div>
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

                <details class="advanced-section" ?open="${this._openSection === 'lidarView'}" @toggle="${(e: Event) => this._onSectionToggle('lidarView', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.lidarViewSection}</summary>
                    <div class="hint">${t.editor.lidarViewHint}</div>
                    <label class="field">
                        <span class="label">${t.editor.lidarViewPointSize}</span>
                        <div class="slider-row">
                            <input
                                type="range" min="1" max="6" step="0.5"
                                .value="${String(c['lidar-view-point-size'] ?? DEFAULT_LIDAR_VIEW_POINT_SIZE_PX)}"
                                @input="${(e: Event) => this._numSlider('lidar-view-point-size', e)}"
                            />
                            <span class="slider-value">${this._fmtNum(Number(c['lidar-view-point-size'] ?? DEFAULT_LIDAR_VIEW_POINT_SIZE_PX), 0.5)}</span>
                        </div>
                    </label>
                </details>

                <details class="advanced-section" ?open="${this._openSection === 'lidar'}" @toggle="${(e: Event) => this._onSectionToggle('lidar', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.localLidarSection}</summary>
                    <div class="hint">${t.editor.localLidarHint}</div>
                    <div class="hint" style="margin-bottom: 14px;">${renderMarkdownLinks(t.editor.localLidarToolsHint)}</div>
                    <div class="field">
                        <span class="label">${t.editor.localLidarEnabled}</span>
                        <div class="segmented-toggle">
                            <button
                                type="button"
                                class="seg-option ${c['lidar-local-ndsm-enabled'] === true ? 'active' : ''}"
                                @click="${() => this._update('lidar-local-ndsm-enabled', true)}"
                            >${t.editor.autoRotateOn}</button>
                            <button
                                type="button"
                                class="seg-option ${c['lidar-local-ndsm-enabled'] !== true ? 'active' : ''}"
                                @click="${() => this._update('lidar-local-ndsm-enabled', false)}"
                            >${t.editor.autoRotateOff}</button>
                        </div>
                    </div>
                    <label class="field">
                        <span class="label">${t.editor.localLidarUrl}</span>
                        <input
                            type="text"
                            .value="${String(c['lidar-local-ndsm-url'] ?? '')}"
                            placeholder="/local/community/Helios/lidar/home-ndsm.tif"
                            @change="${(e: Event) => this._str('lidar-local-ndsm-url', e)}"
                        />
                    </label>
                    <label class="field">
                        <span class="label">${t.editor.localLidarMinLat}</span>
                        <input
                            type="number"
                            min="-90"
                            max="90"
                            step="any"
                            placeholder="-33.900000"
                            .value="${c['lidar-local-ndsm-min-lat'] != null ? String(c['lidar-local-ndsm-min-lat']) : ''}"
                            @change="${(e: Event) => this._numField('lidar-local-ndsm-min-lat', e)}"
                        />
                    </label>
                    <label class="field">
                        <span class="label">${t.editor.localLidarMaxLat}</span>
                        <input
                            type="number"
                            min="-90"
                            max="90"
                            step="any"
                            placeholder="-33.890000"
                            .value="${c['lidar-local-ndsm-max-lat'] != null ? String(c['lidar-local-ndsm-max-lat']) : ''}"
                            @change="${(e: Event) => this._numField('lidar-local-ndsm-max-lat', e)}"
                        />
                    </label>
                    <label class="field">
                        <span class="label">${t.editor.localLidarMinLon}</span>
                        <input
                            type="number"
                            min="-180"
                            max="180"
                            step="any"
                            placeholder="151.200000"
                            .value="${c['lidar-local-ndsm-min-lon'] != null ? String(c['lidar-local-ndsm-min-lon']) : ''}"
                            @change="${(e: Event) => this._numField('lidar-local-ndsm-min-lon', e)}"
                        />
                    </label>
                    <label class="field">
                        <span class="label">${t.editor.localLidarMaxLon}</span>
                        <input
                            type="number"
                            min="-180"
                            max="180"
                            step="any"
                            placeholder="151.210000"
                            .value="${c['lidar-local-ndsm-max-lon'] != null ? String(c['lidar-local-ndsm-max-lon']) : ''}"
                            @change="${(e: Event) => this._numField('lidar-local-ndsm-max-lon', e)}"
                        />
                    </label>
                </details>

                <details class="advanced-section" ?open="${this._openSection === 'reset'}" @toggle="${(e: Event) => this._onSectionToggle('reset', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.resetSection}</summary>
                    <div class="hint">${t.editor.resetSectionHint}</div>
                    <div class="hint reset-warning">${t.editor.resetCacheWarning}</div>
                    <button
                        type="button"
                        class="reset-btn"
                        @click="${() => this._onResetCacheClick()}"
                    >${this._resetFeedback ?? t.editor.resetCacheButton}</button>
                </details>

                <details class="advanced-section about-section" ?open="${this._openSection === 'about'}" @toggle="${(e: Event) => this._onSectionToggle('about', e)}">
                    <summary class="section-title section-title-collapse">${t.editor.aboutSection}</summary>
                    <div class="about-row">
                        <span class="about-label">${t.editor.aboutVersionLabel}</span>
                        <span class="about-value">${__HELIOS_VERSION__}</span>
                    </div>
                    <div class="about-block">
                        <a class="about-link" href="https://helios-lidar.org" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:satellite-variant"></ha-icon>
                            <span>${t.editor.aboutSiteTitle}</span>
                        </a>
                        <p class="about-paragraph">${t.editor.aboutSiteDescription}</p>
                    </div>
                    <div class="about-block">
                        <div class="about-label">${t.editor.aboutCodeLabel}</div>
                        <a class="about-link" href="https://github.com/ReikanYsora/Helios" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:github"></ha-icon>
                            <span>${t.editor.aboutRepoCard}</span>
                        </a>
                        <a class="about-link" href="https://github.com/ReikanYsora/Helios-Lidar" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:github"></ha-icon>
                            <span>${t.editor.aboutRepoLidar}</span>
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


    //Fires the window-level reset bus so every live HeliosCard on the page drops its cached Open-Meteo payload + in-memory PV history and triggers a
    //fresh fetch. Also flashes a short "Cache vidé" confirmation on the button itself for 2 s so the user knows the click landed without us needing a
    //toast system inside the editor.
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
