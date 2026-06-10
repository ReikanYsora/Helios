import { LitElement, html, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { editorStyles } from '../css/helios-card-editor-css';
import
{
    type HeliosConfig,
    DEFAULT_BUILDING_OPACITY,
    DEFAULT_BUILDING_CLUSTER_RADIUS_M,
    DEFAULT_LIDAR_PRECISION,
    DEFAULT_SHADOW_OPACITY,
    DEFAULT_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    MIN_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    MAX_DISPLAY_UPDATE_FREQUENCY_PER_HOUR,
    DEFAULT_DISPLAY_RADIUS_M,
    MIN_DISPLAY_RADIUS_M,
    MAX_DISPLAY_RADIUS_M,
} from '../helios-config';
import { pickTranslations, type Translations } from '../i18n';


//LiDAR View visual knobs that existed before the in-card opacity slider replaced them. Left here as a const tuple so `_update` can strip
//them silently on every config write: the runtime already ignores these keys, the silent strip just keeps the saved YAML tidy.
const LIDAR_VIEW_LEGACY_KEYS = [
    'lidar-view-point-color',
    'lidar-view-point-opacity',
    'lidar-view-wireframe',
    'lidar-view-wireframe-color',
    'lidar-view-wireframe-opacity'
] as const;




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
        else if (/^\/[a-zA-Z0-9_\-/.]*$/.test(url))
        {
            //Same-origin in-app navigation (e.g. /config/energy to jump to the Home Assistant Energy dashboard editor).
            //No target=_blank so the user stays inside the HA SPA and the dashboard's own navigation history works.
            parts.push(html`<a href="${url}">${label}</a>`);
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
    @state()                        private _openArrayIndices: Set<number> = new Set();
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
        for (const t of this._sliderDebounce.values())
        {
            window.clearTimeout(t);
        }
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
        //Entity slots the HA Energy dashboard already declares are silently stripped on the next editor open; the card
        //runtime resolves them from `energy/get_prefs` instead. See helios-card.ts setConfig for the user-facing
        //migration notification.
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
        'lidar-view-point-size',
        'lidar-view-radius',
        'building-radius',
        //Colour identity is fixed by the HA Energy palette via the DEFAULT_*_COLOR_HEX constants in
        //helios-config.ts; the renderer no longer reads any per-card override so the stale YAML keys
        //get stripped on the next editor pass.
        'sun-color',
        'cloud-color',
        'pv-color',
        'battery-color',
        'building-color',
        //LiDAR view styling collapsed into the HA --primary-text-color token + the in-card opacity
        //slider. These five keys are also stripped on every edit via LIDAR_VIEW_LEGACY_KEYS below,
        //listing them here too so an editor open that doesn't touch anything still cleans the YAML.
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

    //ha-entity-picker is part of HA's lazy-loaded card-editor bundle. In a fresh tab, or in HA versions that don't pre-load it for custom cards, the
    //tag is unknown until something on the page pulls it in. We force the load by creating a transient "entities" card and asking for its config
    //element, the side effect registers ha-entity-picker. While the load is pending we fall back to a plain text input so the field is never broken.
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
        //Silently strip the LiDAR View visual knobs that were collapsed into the in-card opacity slider, the moment the user makes any edit, so the config self-heals without needing
        //a one-shot migration. The runtime ignores them too, this just keeps the YAML tidy.
        for (const k of LIDAR_VIEW_LEGACY_KEYS)
        {
            if (k in next)
            {
                delete next[k];
            }
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
        if (!isFinite(v))
        {
            return;
        }
        this._update(key, v);
    }

    //Slider commit. Updates local state synchronously so the slider thumb tracks the drag, but defers the cross-component `config-changed` event by
    //SLIDER_COMMIT_DELAY_MS so the engine doesn't see a flood of intermediate values.
    private _numSlider(key: keyof HeliosConfig, e: Event): void
    {
        const v = parseFloat((e.target as HTMLInputElement).value);
        if (!isFinite(v))
        {
            return;
        }

        //Local update only, no event dispatch yet.
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
        tracker:   string | null;
    }[]
    {
        const toNum = (v: unknown): number | null =>
        {
            if (v === undefined || v === null || v === '')
            {
                return null;
            }
            const n = typeof v === 'number' ? v : parseFloat(String(v));
            return isFinite(n) ? n : null;
        };
        const toStr = (v: unknown): string | null =>
        {
            if (v === undefined || v === null)
            {
                return null;
            }
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
                    tracker:   toStr(e['tracker']),
                };
            });
        }

        const legacyTilt = toNum(this._cfg?.['pv-tilt']);
        const legacyAz   = toNum(this._cfg?.['pv-azimuth']);
        if (legacyTilt !== null || legacyAz !== null)
        {
            return [{ name: null, tilt: legacyTilt, azimuth: legacyAz, share: 100, peakKwp: null, latitude: null, longitude: null, height: null, tracker: null }];
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
        tracker:   string | null;
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
                if (e.name      !== null)
                {
                    o['name']      = e.name;
                }
                if (e.tilt      !== null)
                {
                    o['tilt']      = e.tilt;
                }
                if (e.azimuth   !== null)
                {
                    o['azimuth']   = e.azimuth;
                }
                if (e.share     !== null)
                {
                    o['share']     = e.share;
                }
                if (e.peakKwp   !== null)
                {
                    o['peak-kwp']  = e.peakKwp;
                }
                if (e.latitude  !== null)
                {
                    o['latitude']  = e.latitude;
                }
                if (e.longitude !== null)
                {
                    o['longitude'] = e.longitude;
                }
                if (e.height    !== null)
                {
                    o['height']    = e.height;
                }
                if (e.tracker   !== null && e.tracker !== 'none')
                {
                    //'none' is the implicit default; we only persist explicit tracker types so the YAML
                    //stays minimal and a row toggled back to "fixed" doesn't carry a dangling tracker key.
                    o['tracker']   = e.tracker;
                }
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
        if (i < 0 || i >= list.length)
        {
            return;
        }
        const raw = (e.target as HTMLInputElement).value.trim();
        if (raw === '')
        {
            list[i] = { ...list[i], [key]: null };
        }
        else
        {
            const v = parseFloat(raw);
            if (!isFinite(v))
            {
                return;
            }
            list[i] = { ...list[i], [key]: v };
        }
        this._writePvArrays(list);
    }

    //Updates the tracker selection for row `i`. The value is one of 'none' (= fixed install, no
    //tracker), 'dual-axis', 'single-axis-h', 'single-axis-v'. 'none' is persisted as null so the YAML
    //stays minimal, the write-out branch in _writePvArrays then skips the key entirely.
    private _arrayTracker(i: number, e: Event): void
    {
        const list = this._readPvArrays();
        if (i < 0 || i >= list.length)
        {
            return;
        }
        const raw = (e.target as HTMLSelectElement).value;
        const next = raw === 'dual-axis' || raw === 'single-axis-h' || raw === 'single-axis-v'
            ? raw
            : null;
        list[i] = { ...list[i], tracker: next };
        this._writePvArrays(list);
    }

    //Updates the user-typed name for row `i`. Empty input clears the field to null, the summary then falls back to the auto-numbered "Row N" title.
    //Stops the event so the parent <details>` toggle doesn't fire when the user types inside the input.
    private _arrayName(i: number, e: Event): void
    {
        const list = this._readPvArrays();
        if (i < 0 || i >= list.length)
        {
            return;
        }
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
        if (list.length >= HeliosCardEditor.PV_ARRAYS_MAX)
        {
            return;
        }
        list.push({ name: null, tilt: null, azimuth: null, share: null, peakKwp: null, latitude: null, longitude: null, height: null, tracker: null });
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
        if (i < 0 || i >= list.length)
        {
            return;
        }
        //Removing the last array is allowed and clears the whole pv-arrays section (see _writePvArrays empty-list branch). Lets the
        //user wipe their orientation setup from the visual editor without dropping to YAML.
        list.splice(i, 1);
        //Shift the open-set so the higher indices map to their new positions after the splice. The removed index drops out, and every index above it
        //slides down by one.
        const next = new Set<number>();
        for (const idx of this._openArrayIndices)
        {
            if (idx === i)
            {
                continue;
            }
            if (idx > i)
            {
                next.add(idx - 1);
            }
            else
            {
                next.add(idx);
            }
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
        if (el.open)
        {
            next.add(i);
        }
        else
        {
            next.delete(i);
        }
        this._openArrayIndices = next;
    }

    private _fmtNum(v: number, step: number): string
    {
        return step >= 1 ? String(Math.round(v)) : v.toFixed(2);
    }

    //Filter for the PV entity picker, accepts power/energy device
    //classes (the canonical case) plus any sensor whose unit looks
    //like W/kW/MW or Wh/kWh/MWh. The unit fallback covers custom
    //template sensors that don't bother declaring a device_class.
    //integrations like Ecowitt where the field is just a raw float.
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

    //Multi-entity grid editor: each slot (import / export) accepts a
    //list of entities, same UX as the PV-array / battery-bank lists
    //above but trimmed to a single field per entry. The slot's value
    //in the config is normalised on read: a leftover legacy string
    //is converted to a one-element array, and a fully empty array is
    //serialised as an absent key so the YAML stays clean.

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
                <div class="hint">${t.editor.displayRadiusHelp ?? 'Distance autour de la maison dans laquelle les bâtiments, les cellules LiDAR et les ombres sont rendus. Baissez cette valeur (jusqu\'à 50 m) pour fluidifier l\'affichage sur un téléphone ancien ou lent ; montez-la (jusqu\'à 500 m) pour une vue plus large. Par défaut 200 m.'}</div>
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
                </details>

                <details class="advanced-section" ?open="${this._openSection === 'installation'}" @toggle="${(e: Event) => this._onSectionToggle('installation', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:solar-power-variant"></ha-icon>${t.editor.installationSection}</summary>
                <div class="hint">${renderMarkdownLinks(t.editor.installationHint)}</div>
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
                <div class="field">
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
                    return html`
                        <details class="advanced-section" open>
                            <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:angle-acute"></ha-icon>${t.editor.pvArraysSection}</summary>
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
                                                <span class="label">${t.editor.pvArrayTracker}</span>
                                                <select
                                                    class="he-select"
                                                    .value="${arr.tracker ?? 'none'}"
                                                    @change="${(e: Event) => this._arrayTracker(i, e)}"
                                                >
                                                    <option value="none"          ?selected="${(arr.tracker ?? 'none') === 'none'}">${t.editor.pvArrayTrackerNone}</option>
                                                    <option value="dual-axis"     ?selected="${arr.tracker === 'dual-axis'}">${t.editor.pvArrayTrackerDual}</option>
                                                    <option value="single-axis-h" ?selected="${arr.tracker === 'single-axis-h'}">${t.editor.pvArrayTrackerSingleH}</option>
                                                    <option value="single-axis-v" ?selected="${arr.tracker === 'single-axis-v'}">${t.editor.pvArrayTrackerSingleV}</option>
                                                </select>
                                            </label>
                                            <div class="field-help">${t.editor.pvArrayTrackerHelp}</div>
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


                <details class="advanced-section" ?open="${this._openSection === 'lidar'}" @toggle="${(e: Event) => this._onSectionToggle('lidar', e)}">
                    <summary class="section-title section-title-collapse"><ha-icon class="section-icon" icon="mdi:cube-scan"></ha-icon>${t.editor.localLidarSection}</summary>
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
                    <div class="about-row">
                        <span class="about-label" aria-hidden="true"></span>
                        <a class="about-row-link" href="https://github.com/ReikanYsora/Helios-Lidar" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:github"></ha-icon>
                            <span>${t.editor.aboutRepoLidar}</span>
                        </a>
                    </div>
                    <div class="about-block">
                        <a class="about-link" href="https://helios-lidar.org" target="_blank" rel="noopener noreferrer">
                            <ha-icon icon="mdi:satellite-variant"></ha-icon>
                            <span>${t.editor.aboutSiteTitle}</span>
                        </a>
                        <p class="about-paragraph">${t.editor.aboutSiteDescription}</p>
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
