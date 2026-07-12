import type { PropertyValues } from 'lit';
import { LitElement, html, nothing, svg } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { setServerTimeZone } from './core/time/timezone';
import { toOklab, mixOklab, type OklabColor } from './core/render-kit/oklch';
import { getPath, GRAPH_STROKE_WIDTH, parseCssDuration } from './core/render-kit/graph-path';
import { subscribeEnergyPrefs, unsubscribeEnergyPrefs, EMPTY_ENERGY_DEFAULTS, type EnergyDefaults, type EnergyPrefsHost } from './data/sources/energy-prefs';
import { buildFingerprint, weekBoundsFor, type FpModel, type FpSale } from './fingerprint/fingerprint-model';
import { fetchChangeSeries } from './data/sources/energy-stats';
import { fingerprintStyles } from './css/helios-fingerprint-css';
import { pickTranslations } from './core/i18n';
//Side-effect import: writes the Energy Fingerprint entry into window.customCards for the HA card picker.
import './fingerprint/registry';
//Side-effect import: registers <helios-fingerprint-card-editor>, the visual config editor.
import './fingerprint/fingerprint-editor';

interface FingerprintConfig { type: string; title?: string }

//Hover/tap descriptor for a heatmap cell: the ring rect (x/y/w/h) plus the tooltip anchor (cx/cy) and flip side.
interface FpHover { r: number; q: number; cx: number; cy: number; x: number; y: number; w: number; h: number; flip: boolean }

//Per-instance id seed for SVG clipPath ids (must be unique when several cards share a document).
let fpUidSeq = 0;

//Heatmap geometry in pixels: the SVG is rebuilt to the container's exact size (viewBox 1:1), so it fills whatever
//the Lovelace grid gives it while cells stay rounded and labels stay crisp at any card size. The left margin holds
//the day labels, the bottom margin the hour ticks.
const MARGIN_L = 50;
const MARGIN_B = 16;
const CELL_GAP = 1;
const CELL_RX = 2;

//Empty-slot fill (future or no data): the theme divider at a whisper, so gaps read as absence, not a zero reading.
const EMPTY_FILL = 'var(--divider-color, rgba(127,127,127,0.2))';
const EMPTY_ALPHA = 0.10;

//Day-detail chart, in logical units (viewBox stretched to the detail strip). One x-unit per 15-minute slot; the top
//and bottom insets (a small proportion of the viewBox, so they scale with the card) keep the curves + their beams
//off the edges without eating the plot when the card is short.
const DAY_H = 40;
const DAY_PAD_T = 3;
const DAY_PAD_B = 3;

//How many weeks back the card lets you navigate. The exact data wall (recorder 5-minute retention) is measured on
//load and is usually smaller; this only caps the probe + the navigation range.
const MAX_BACK_WEEKS = 8;

//Material Design Icon paths (Helios has no @mdi/js dep): the check/outline pair Home Assistant's chart legend uses,
//plus close for the day-detail dismiss.
const MDI_CHECK_CIRCLE = 'M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z';
const MDI_CIRCLE_OUTLINE = 'M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z';
const MDI_CLOSE = 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z';

@customElement('helios-fingerprint-card')
export class HeliosFingerprintCard extends LitElement
{
    static styles = fingerprintStyles;

    @property({ attribute: false }) public hass!: any;

    @state() private _config?: FingerprintConfig;
    @state() private _energyDefaults: EnergyDefaults = EMPTY_ENERGY_DEFAULTS;
    @state() _energyDefaultsLoaded = false;
    _energyPrefsUnsub?: (() => void) | undefined;

    @state() private _model: FpModel | null = null;
    @state() private _weekOffset = 0;                                  //0 = current week, 1 = last week, ...
    @state() private _hover: FpHover | null = null;
    @state() private _detailRow: number | null = null;                 //the day whose detail chart is shown, or null
    //Scrub cursor on the day chart: the slot under the pointer plus the pixel anchors for the vertical line, the
    //per-curve beams, and the linked heatmap cell. Null when the pointer is off the chart.
    @state() private _cursor: { q: number; xPx: number; hPx: number; consY: number; impY: number; solY: number; batY: number | null; batCharge: boolean } | null = null;
    //Series toggled off via the legend (keys: cons, imp, sol, bat, loss), HA device-graph style.
    @state() private _hidden = new Set<string>();
    //A week fetch is in flight: drives the disabled UI. Navigation itself is bounded by `_wallOffset`, measured once
    //on load, so back-navigation can never reach an empty week (no snap-back cascade -> no freeze).
    @state() private _navLoading = false;
    private _wallComputing = false;
    //A heatmap cell was tapped: open its day and drop the chart cursor at that slot once the chart is laid out.
    private _pendingCursorQ: number | null = null;
    private readonly _uid = `fp${++fpUidSeq}`;

    @query('.fp-svg') private _svg?: SVGSVGElement;
    @query('.fp-chart') private _chart?: HTMLElement;

    //The grid + solar HA energy colours, pre-converted to OKLab, blended per cell by solar coverage.
    private _srcColors: { grid: OklabColor; solar: OklabColor } | null = null;
    private _probe?: HTMLElement;
    private _ro?: ResizeObserver;
    private _modelKey = '';
    private _wallOffset = Infinity;                                    //first past week with no 5-minute data
    private _lastThemesRef: unknown = undefined;
    private _paintedModel: FpModel | null = null;
    private _paintedSize = '';
    private _paintedDetail: number | null = null;

    //Day-chart grow/morph animation: display kWh per slot for each series, eased from the previous curve (or a flat
    //baseline on first open) toward the picked day, exactly as HA's graph cards morph on data change.
    private _disp: { cons: number[]; imp: number[]; sol: number[]; bat: number[] } | null = null;
    private _animKey = '';
    private _animRow: number | null = null;
    private _animFrame?: number;
    //Last-rendered day-chart values + axis, so the scrub handler can place the cursor beams without recomputing.
    private _dayView?: { yMin: number; yMax: number; cons: number[]; imp: number[]; sol: number[]; bat: number[]; hasBattery: boolean; cols: number };

    public setConfig(config: FingerprintConfig): void { this._config = { ...config }; }

    public getCardSize(): number { return 4; }

    //Lovelace Sections (grid) sizing: full section width (12/12/12), with a height that shows the heatmap and a
    //legible day chart together. Grid rows are coarse (~60px each), so this defaults to 8 rows and keeps a floor of
    //6 so the curves never get crushed, while still allowing a taller card up to 16.
    public getGridOptions(): { rows: number; columns: number; min_rows: number; max_rows: number; min_columns: number; max_columns: number }
    {
        return { rows: 8, columns: 12, min_rows: 6, max_rows: 16, min_columns: 12, max_columns: 12 };
    }

    public static getConfigElement(): HTMLElement { return document.createElement('helios-fingerprint-card-editor'); }

    public static getStubConfig(): object { return { type: 'custom:helios-fingerprint-card' }; }

    private get _prefsHost(): EnergyPrefsHost { return this as unknown as EnergyPrefsHost; }

    //Card strings in the active language; the fingerprint block is optional per locale, so anything missing (or a
    //locale that hasn't translated it yet) falls back to the always-present English set.
    private get _t(): NonNullable<ReturnType<typeof pickTranslations>['fingerprint']>
    {
        return pickTranslations(this.hass?.language).fingerprint ?? pickTranslations('en').fingerprint!;
    }

    public connectedCallback(): void
    {
        super.connectedCallback();
        if (this.hass) { subscribeEnergyPrefs(this._prefsHost); }
    }

    public disconnectedCallback(): void
    {
        super.disconnectedCallback();
        unsubscribeEnergyPrefs(this._prefsHost);
        this._ro?.disconnect();
        this._ro = undefined;
        if (this._animFrame !== undefined) { cancelAnimationFrame(this._animFrame); this._animFrame = undefined; }
    }

    protected updated(changed: PropertyValues): void
    {
        if (changed.has('hass') && this.hass)
        {
            setServerTimeZone(this.hass.config?.time_zone);
            if (!this._energyPrefsUnsub) { subscribeEnergyPrefs(this._prefsHost); }
            if (this.hass.themes !== this._lastThemesRef)
            {
                this._lastThemesRef = this.hass.themes;
                this._resolveColors();
            }
        }
        if (!this._srcColors) { this._resolveColors(); }

        void this._computeWall();
        void this._maybeRefresh();
        this._applyPendingCursor();
        if (this._svg && !this._ro && typeof ResizeObserver !== 'undefined')
        {
            this._ro = new ResizeObserver(() => this._paintGrid());
            this._ro.observe(this._svg);
        }
        this._paintGrid();
        this._syncDayAnim();
    }

    //Animate the day-chart curves when the picked DAY changes (grow from a flat baseline on open, morph on switch).
    //A week change with the same day snaps instantly - fast week navigation must not spin a 60fps morph each step,
    //which is what turned rapid back-navigation into a freeze. Honours reduced-motion and a zero/absent duration.
    private _syncDayAnim(): void
    {
        const m = this._model;
        const r = this._detailRow;
        const key = `${this._weekOffset}|${r ?? -1}`;
        if (key === this._animKey) { return; }
        const dayChanged = r !== this._animRow;
        this._animKey = key;
        this._animRow = r;
        if (this._animFrame !== undefined) { cancelAnimationFrame(this._animFrame); this._animFrame = undefined; }
        if (!m || r === null || r >= m.rows) { this._disp = null; return; }

        const row = m.cells[r];
        const target = this._dayTarget(row);
        const flat = row.map(() => 0);
        const from = this._disp ?? { cons: flat, imp: flat, sol: flat, bat: flat };
        const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const dur = parseCssDuration(getComputedStyle(this).getPropertyValue('--ha-animation-duration-slow'));
        if (!dayChanged || reduce || dur <= 1) { this._disp = target; this.requestUpdate(); return; }

        const start = performance.now();
        const step = (now: number): void =>
        {
            const p = Math.min((now - start) / dur, 1);
            const e = 1 - (1 - p) ** 3;
            const lerp = (a: number[], b: number[]): number[] => b.map((v, i) => (a[i] ?? 0) + (v - (a[i] ?? 0)) * e);
            this._disp = { cons: lerp(from.cons, target.cons), imp: lerp(from.imp, target.imp), sol: lerp(from.sol, target.sol), bat: lerp(from.bat, target.bat) };
            this.requestUpdate();
            this._animFrame = p < 1 ? requestAnimationFrame(step) : undefined;
        };
        this._animFrame = requestAnimationFrame(step);
    }

    //Resolve the grid + solar Home Assistant energy colours through the CSS cascade (a hidden probe reads the fully
    //computed value), so the heatmap always tracks the active theme and never hardcodes a hue.
    private _resolveColors(): void
    {
        if (!this.shadowRoot) { return; }
        const el = this._probe ??= (() => { const s = document.createElement('span'); s.style.display = 'none'; this.shadowRoot!.appendChild(s); return s; })();
        const read = (expr: string): string => { el.style.color = expr; return getComputedStyle(el).color; };
        const grid  = toOklab(read('var(--energy-grid-consumption-color, var(--primary-color, #488fc2))'));
        const solar = toOklab(read('var(--energy-solar-color, var(--warning-color, #ff9800))'));
        this._srcColors = (grid && solar) ? { grid, solar } : null;
        this._paintedModel = null;   //force a repaint with the new colours
    }

    //Measure the navigation wall ONCE on load, before any back-navigation is allowed: fetch the oldest 5-minute
    //grid-import bucket within the cap, and set `_wallOffset` to the first week entirely before it. Until this
    //resolves the "previous" arrow stays disabled, so a burst of clicks can never walk into an empty week (which is
    //what used to trigger the snap-back cascade + repaint storm that froze the page). One fetch, then bounded nav.
    private async _computeWall(): Promise<void>
    {
        if (this._wallOffset !== Infinity || this._wallComputing) { return; }
        if (!this._energyDefaultsLoaded || !this.hass?.callWS) { return; }
        this._wallComputing = true;
        try
        {
            const { startMs } = weekBoundsFor(MAX_BACK_WEEKS);
            const series = await fetchChangeSeries(this.hass, this._energyDefaults.gridStatEnergyFroms, startMs, Date.now(), '5minute');
            let wall = 1;
            if (series && series.length)
            {
                let earliest = Infinity;
                for (const b of series) { if (b.startMs < earliest) { earliest = b.startMs; } }
                wall = MAX_BACK_WEEKS;
                for (let o = 0; o <= MAX_BACK_WEEKS; o++) { if (weekBoundsFor(o).endMs <= earliest) { wall = o; break; } }
            }
            this._wallOffset = Math.max(1, Math.min(wall, MAX_BACK_WEEKS));
            this.requestUpdate();
        }
        finally
        {
            this._wallComputing = false;
        }
    }

    //Rebuild the model when the week, energy config or the ~5-minute live edge moves; a stable key dedupes work.
    //Navigation is bounded by `_wallOffset`, so this only ever fetches weeks that have data.
    private async _maybeRefresh(): Promise<void>
    {
        if (!this._energyDefaultsLoaded || !this.hass?.callWS) { return; }
        const d = this._energyDefaults;
        const bucket = Math.floor(Date.now() / (5 * 60_000));
        const sale: FpSale = {
            compensationStats: d.gridExportCompensationStats,
            priceNumber: d.gridExportPriceNumber,
            priceValue: this._resolvePrice(d.gridExportPriceEntity),
        };
        const key = `${this._weekOffset}|${bucket}|${d.solarStatEnergyFroms}|${d.gridStatEnergyFroms}|${d.gridStatEnergyTos}|${sale.priceNumber}|${sale.priceValue}|${d.gridExportCompensationStats}`;
        if (key === this._modelKey) { return; }
        this._modelKey = key;
        this._navLoading = true;
        try
        {
            const model = await buildFingerprint(this.hass, d, this._weekOffset, this.hass?.language ?? '', sale);
            if (this._modelKey !== key) { return; }
            this._model = model;
        }
        finally
        {
            this._navLoading = false;
        }
    }

    //Bounded nav: never past the measured wall (Infinity until measured -> back disabled on load). No snap-back can
    //fire, so even a burst of clicks only ever lands on weeks that have data.
    private _prevWeek = (): void => { if (this._weekOffset + 1 < this._wallOffset) { this._weekOffset += 1; } };
    private _nextWeek = (): void => { if (this._weekOffset > 0) { this._weekOffset -= 1; } };
    private _closeDetail = (): void => { this._detailRow = null; };

    private _weekLabel(): string
    {
        const m = this._model;
        if (!m) { return ''; }
        const fmt = new Intl.DateTimeFormat(this.hass?.language || undefined, { day: 'numeric', month: 'short' });
        return fmt.formatRange(new Date(m.startMs), new Date(m.endMs - 1));
    }

    //Paint the heatmap imperatively (one SVG string, rebuilt only when the model, theme colours or box size move),
    //so a hover never re-diffs hundreds of Lit nodes. The viewBox matches the element's pixel box 1:1.
    private _paintGrid(): void
    {
        const m = this._model;
        const el = this._svg;
        if (!el || !m) { return; }
        const box = el.getBoundingClientRect();
        //Use the exact (unrounded) box for the viewBox + cell geometry so the SVG maps 1:1 to CSS pixels and the DOM
        //hover ring lands exactly on its cell; only the memo key is rounded, to avoid repainting on sub-pixel jitter.
        const W = box.width;
        const H = box.height;
        if (W < 60 || H < 40) { return; }
        const size = `${Math.round(W)}x${Math.round(H)}`;
        if (this._model === this._paintedModel && size === this._paintedSize && this._detailRow === this._paintedDetail) { return; }
        this._paintedModel = this._model;
        this._paintedSize = size;
        this._paintedDetail = this._detailRow;

        el.setAttribute('viewBox', `0 0 ${W} ${H}`);
        const cw = (W - MARGIN_L) / m.cols;
        const ch = (H - MARGIN_B) / m.rows;

        let out = '';
        for (let r = 0; r < m.rows; r++)
        {
            const y = r * ch;
            //The picked day gets a filled backdrop across its whole row plus an accent bar at the left edge - a
            //clear "this day is open" cue that reads better than a thin outline, drawn behind the cells.
            if (this._detailRow === r)
            {
                out += `<rect x="${(MARGIN_L - 3).toFixed(2)}" y="${(y - 1).toFixed(2)}" width="${(m.cols * cw + 3).toFixed(2)}" height="${Math.max(0, ch - CELL_GAP + 2).toFixed(2)}" rx="4" fill="var(--primary-text-color)" fill-opacity="0.07"></rect>`;
                out += `<rect x="${(MARGIN_L - 3).toFixed(2)}" y="${(y + 1).toFixed(2)}" width="2.5" height="${Math.max(0, ch - CELL_GAP - 3).toFixed(2)}" rx="1.25" fill="var(--primary-color)"></rect>`;
            }
            for (let q = 0; q < m.cols; q++)
            {
                const cell = m.cells[r][q];
                const x = MARGIN_L + q * cw;
                let fill = EMPTY_FILL; let op = EMPTY_ALPHA;
                //A future or gap slot carries no recorder bucket (hasData false), so it stays empty on its own. The
                //intensity floor is lifted and gamma-corrected so low-consumption slots stay legible on a light
                //theme (a pale tint over white otherwise vanishes), while the peak still reads full strength. Hue
                //runs grid-blue -> solar-gold by solar coverage; battery can't get its own hue (blue+gold already
                //makes green), so the source split is spelled out in the hover tooltip instead.
                if (cell.hasData)
                {
                    const cons = cell.consumption;
                    op = cons > 0 ? 0.22 + 0.75 * Math.min(1, cons / m.p95) ** 0.72 : EMPTY_ALPHA;
                    if (cons > 0 && this._srcColors)
                    {
                        const cov = cell.coverage ?? 0;
                        fill = mixOklab([
                            { c: this._srcColors.grid, w: 1 - cov },
                            { c: this._srcColors.solar, w: cov },
                        ]) ?? 'var(--primary-color)';
                    }
                    else { fill = 'var(--primary-color)'; }
                }
                out += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(0, cw - CELL_GAP).toFixed(2)}" height="${Math.max(0, ch - CELL_GAP).toFixed(2)}" rx="${CELL_RX}" fill="${fill}" fill-opacity="${op.toFixed(3)}"></rect>`;
            }
            //Clickable day label (weekday + date); a tap opens that day's detail chart.
            out += `<text x="${MARGIN_L - 7}" y="${(y + ch / 2).toFixed(1)}" text-anchor="end" dominant-baseline="central" class="fp-ylabel ${this._detailRow === r ? 'is-on' : ''}">${m.rowLabels[r]}</text>`;
        }
        //Hour ticks, density adapted to the width: pick the finest step (1..6 h) that still leaves labels legible,
        //and skip 00h (the day obviously starts at midnight) so nothing crowds under the day labels.
        const plotW = W - MARGIN_L;
        const stepH = [1, 2, 3, 4, 6].find(s => (plotW / 24) * s >= 44) ?? 6;
        for (let h = stepH; h < 24; h += stepH)
        {
            out += `<text x="${(MARGIN_L + (h / 24) * plotW).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="fp-xlabel">${String(h).padStart(2, '0')}h</text>`;
        }
        el.innerHTML = out;
    }

    //Grid geometry at the current box size, shared by hover + click hit-testing.
    private _geom(): { box: DOMRect; cw: number; ch: number } | null
    {
        const el = this._svg; const m = this._model;
        if (!el || !m) { return null; }
        const box = el.getBoundingClientRect();
        const cw = (box.width - MARGIN_L) / m.cols;
        const ch = (box.height - MARGIN_B) / m.rows;
        return (cw <= 0 || ch <= 0) ? null : { box, cw, ch };
    }

    //Build the hover descriptor (ring rect + tooltip anchor) for a cell at a client position.
    private _makeHover(r: number, q: number, clientX: number, clientY: number, g: { box: DOMRect; cw: number; ch: number }): FpHover
    {
        //The SVG fills .fp-grid, so its bounding box doubles as the grid's coordinate origin for the overlays.
        const localX = clientX - g.box.left;
        const localY = clientY - g.box.top;
        return {
            r, q,
            cx: localX,
            cy: Math.min(Math.max(localY, 46), Math.max(46, g.box.height - 46)),
            x: MARGIN_L + q * g.cw,
            y: r * g.ch,
            w: Math.max(0, g.cw - CELL_GAP),
            h: Math.max(0, g.ch - CELL_GAP),
            flip: localX > g.box.width * 0.5,
        };
    }

    //Pointer hover drives the tooltip on desktop. Touch is handled by tap (below) so a scroll never triggers it.
    //When hovering the day that is already open below, the chart cursor mirrors the hovered slot so the two views
    //move together without a click.
    private _onMove = (e: PointerEvent): void =>
    {
        if (e.pointerType === 'touch') { return; }
        const g = this._geom(); const m = this._model;
        if (!g || !m) { return; }
        const q = Math.floor((e.clientX - g.box.left - MARGIN_L) / g.cw);
        const r = Math.floor((e.clientY - g.box.top) / g.ch);
        if (r < 0 || r >= m.rows || q < 0 || q >= m.cols || !m.cells[r][q].hasData)
        {
            if (this._hover) { this._hover = null; }
            if (this._cursor) { this._cursor = null; }
            return;
        }
        this._hover = this._makeHover(r, q, e.clientX, e.clientY, g);
        if (r === this._detailRow && this._chart && this._dayView)
        {
            const rect = this._chart.getBoundingClientRect();
            if (rect.width > 0) { this._cursor = this._cursorAt(q, rect, this._dayView); }
        }
        else if (this._cursor)
        {
            this._cursor = null;
        }
    };

    private _onLeave = (e: PointerEvent): void => { if (e.pointerType !== 'touch' && this._hover) { this._hover = null; } };

    //A tap in the left label column toggles that day's detail chart. A tap on a 15-minute cell opens its day AND
    //drops the chart cursor on that exact slot, so the heatmap and the day curves stay in sync from one gesture.
    private _onClick = (e: PointerEvent): void =>
    {
        const g = this._geom(); const m = this._model;
        if (!g || !m) { return; }
        const r = Math.floor((e.clientY - g.box.top) / g.ch);
        if (r < 0 || r >= m.rows) { return; }
        if ((e.clientX - g.box.left) < MARGIN_L) { this._detailRow = this._detailRow === r ? null : r; return; }
        const q = Math.floor((e.clientX - g.box.left - MARGIN_L) / g.cw);
        if (q < 0 || q >= m.cols || !m.cells[r][q].hasData) { return; }
        this._detailRow = r;
        this._pendingCursorQ = q;
        //Snap the day chart to this day synchronously (no grow animation), so the freshly placed cursor sits on the
        //final curve, not on a mid-animation value.
        this._disp = this._dayTarget(m.cells[r]);
        this._animRow = r;
        this._animKey = `${this._weekOffset}|${r}`;
    };

    private _dayTarget(row: { consumption: number; gridImport: number; solar: number; batteryDischarge: number; batteryCharge: number }[]): { cons: number[]; imp: number[]; sol: number[]; bat: number[] }
    {
        return { cons: row.map(c => c.consumption), imp: row.map(c => c.gridImport), sol: row.map(c => c.solar), bat: row.map(c => c.batteryDischarge - c.batteryCharge) };
    }

    //Hover tooltip: what the home used in this 15-minute slot and WHERE it came from - grid, solar (self-used) and
    //battery discharge, each with its kWh and share of the load. This provenance breakdown is what the cell colour
    //alone can't show (battery has no distinct hue), so it lives here.
    private _renderHover()
    {
        const h = this._hover; const m = this._model;
        if (!h || !m) { return nothing; }
        const cell = m.cells[h.r][h.q];
        const t = this._t;
        const lang = this.hass?.language || undefined;
        const d = new Date(cell.ms);
        const title = `${new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric' }).format(d)} - ${new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d)}`;
        const cons = cell.consumption;
        const selfSolar = Math.max(0, cons - cell.gridImport - cell.batteryDischarge);
        const wAvg = Math.round(cons * 4 * 1000);
        const pct = (v: number): string => cons > 0 ? `${Math.round((v / cons) * 100)}%` : '-';
        const srcRow = (cls: string, name: string, kwh: number) => html`
            <div class="fp-tip-src"><span><i class="fp-sdot ${cls}"></i>${name}</span><span>${kwh.toFixed(2)} kWh · ${pct(kwh)}</span></div>`;
        return html`
            <div class="fp-hl" style="left:${h.x}px; top:${h.y}px; width:${h.w}px; height:${h.h}px"></div>
            <div class="fp-tip ${h.flip ? 'is-left' : ''}" style="left:${h.cx}px; top:${h.cy}px">
                <div class="fp-tip-head">${title}</div>
                <div class="fp-tip-row fp-tip-total"><span>${t.consumption}</span><span>${cons.toFixed(2)} kWh · ${wAvg} W</span></div>
                ${srcRow('fp-sdot-imp', t.grid, cell.gridImport)}
                ${srcRow('fp-sdot-sol', t.solar, selfSolar)}
                ${m.hasBattery ? srcRow('fp-sdot-bat', t.battery, cell.batteryDischarge) : nothing}
                ${cell.gridExport > 0 ? html`<div class="fp-tip-src fp-tip-export"><span>${m.hasSale ? t.sold : t.exported}</span><span>${cell.gridExport.toFixed(2)} kWh${m.hasSale ? ` · ${this._fmtMoney(cell.revenue)}` : ''}</span></div>` : nothing}
            </div>`;
    }

    //The selected day's profile: consumption, grid import and solar production as HA-style curves, 00h -> 24h. Only
    //the exported surplus (solar rising above consumption - real energy that left the house unused) is filled, so it
    //stands out. The strip stays mounted at a fixed height (placeholder when nothing is picked) so selecting a day
    //or changing week never resizes the heatmap above it. Scrubbing the chart drops a cursor with per-curve beams
    //and lights up the matching cell in the heatmap.
    private _renderDetail()
    {
        const t = this._t;
        const m = this._model; const r = this._detailRow;
        if (!m || r === null || r >= m.rows)
        {
            this._dayView = undefined;
            return html`<div class="fp-detail is-empty"><span>${t.selectDay}</span></div>`;
        }
        const row = m.cells[r];
        const cols = m.cols; const last = cols - 1;
        const hasBat = m.hasBattery;
        const hidden = this._hidden;
        const showCons = !hidden.has('cons'); const showImp = !hidden.has('imp'); const showSol = !hidden.has('sol');
        const showBat = hasBat && !hidden.has('bat'); const showLoss = !hidden.has('loss');
        //Animated display values (grow from a flat baseline on open, morph between days) fall back to the real day.
        const cons = this._disp?.cons ?? row.map(c => c.consumption);
        const imp  = this._disp?.imp  ?? row.map(c => c.gridImport);
        const sol  = this._disp?.sol  ?? row.map(c => c.solar);
        const bat  = this._disp?.bat  ?? row.map(c => c.batteryDischarge - c.batteryCharge);
        //Axis spans every series' real range, regardless of what is toggled off, so hiding/showing a curve never
        //rescales the others. Battery net flow can go negative (charging), so the zero line lifts off the bottom;
        //with no battery yMin stays 0 and the frame is bottom-anchored.
        let yMax = 1e-6; let yMin = 0;
        for (const c of row)
        {
            if (!c.hasData) { continue; }
            yMax = Math.max(yMax, c.consumption, c.gridImport, c.solar);
            if (hasBat) { const n = c.batteryDischarge - c.batteryCharge; yMax = Math.max(yMax, n); yMin = Math.min(yMin, n); }
        }
        const span = yMax - yMin;
        const usable = DAY_H - DAY_PAD_T - DAY_PAD_B;
        const yOf = (v: number): number => (DAY_H - DAY_PAD_B) - ((v - yMin) / span) * usable;
        this._dayView = { yMin, yMax, cons, imp, sol, bat, hasBattery: hasBat, cols };
        //Gridlines framing the plot like a native graph background: value-axis lines horizontally, plus a vertical
        //every 6 hours so the time axis is readable.
        const gridYs = [0, 1, 2, 3, 4].map(k => DAY_PAD_T + (usable * k) / 4);
        //Interior verticals only (06/12/18h): ECharts hides the axis line, so no edge box - just splitlines inside.
        const gridXs = [0.25, 0.5, 0.75].map(f => f * cols);
        //x = slot index, so point i sits at the LEFT edge of heatmap cell i; the viewBox spans `cols`, and a
        //trailing point at x=cols carries the last value to the right edge - the chart shares the heatmap's exact
        //x-scale (the plot is inset by the same MARGIN_L), so a vertical line lands on the same time in both.
        const coordsOf = (vals: number[]): number[][] => [...vals.map((v, i) => [i, yOf(v)] as number[]), [cols, yOf(vals[last])]];
        const line = (cls: string, d: string) => svg`<path class=${cls} stroke-width=${GRAPH_STROKE_WIDTH} vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" d=${d}></path>`;

        //Loss band: solar above what the home used AND what the battery stored - the truly exported/unused energy.
        //With no battery the absorb line is just consumption, so the band is unchanged.
        const absorb = cons.map((cv, i) => cv + Math.max(0, -bat[i]));
        const topCoords: number[][] = [...sol.map((sv, i) => [i, Math.min(yOf(sv), yOf(absorb[i]))] as number[]), [cols, Math.min(yOf(sol[last]), yOf(absorb[last]))]];
        const botCoords: number[][] = [[cols, yOf(absorb[last])], ...absorb.map((_av, i) => [last - i, yOf(absorb[last - i])] as number[])];
        const lossPath = `${getPath(topCoords)} ${getPath(botCoords).replace(/^M/, 'L')} Z`;
        const zeroY = yOf(0);
        const clipUp = `${this._uid}-up`; const clipDown = `${this._uid}-down`;

        const lang = this.hass?.language || undefined;
        const label = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(row[0].ms));
        const cur = this._cursor;
        //Legend chip, styled like Home Assistant's own chart legend (check/outline toggle icon + label); a click on
        //either the icon or the label hides/shows that curve.
        const leg = (k: string, color: string, text: string) => html`
            <li class=${hidden.has(k) ? 'hidden' : ''}>
                <button type="button" class="legend-toggle" data-k=${k} aria-pressed=${!hidden.has(k)} @click=${this._onLegend}>
                    <ha-svg-icon .path=${hidden.has(k) ? MDI_CIRCLE_OUTLINE : MDI_CHECK_CIRCLE} style=${hidden.has(k) ? '' : `color:${color}`}></ha-svg-icon>
                </button>
                <button type="button" class="label" data-k=${k} @click=${this._onLegend}>${text}</button>
            </li>`;
        return html`
            <div class="fp-detail">
                <div class="fp-detail-head">
                    <span class="fp-detail-day">${label}</span>
                    <button type="button" class="fp-detail-close" aria-label=${t.close} @click=${this._closeDetail}>
                        <ha-svg-icon .path=${MDI_CLOSE}></ha-svg-icon>
                    </button>
                </div>
                <div class="fp-chart" style="margin-left:${MARGIN_L}px" @pointermove=${this._onChartMove} @pointerdown=${this._onChartMove} @pointerleave=${this._onChartLeave}>
                    ${svg`
                        <svg class="fp-detail-svg" viewBox="0 0 ${cols} ${DAY_H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                            ${showBat ? svg`<defs>
                                <clipPath id=${clipUp}><rect x="0" y="0" width=${cols} height=${zeroY}></rect></clipPath>
                                <clipPath id=${clipDown}><rect x="0" y=${zeroY} width=${cols} height=${DAY_H - zeroY}></rect></clipPath>
                            </defs>` : nothing}
                            ${gridYs.map(gy => svg`<line class="fp-grid-line" x1="0" y1=${gy} x2=${cols} y2=${gy} vector-effect="non-scaling-stroke"></line>`)}
                            ${gridXs.map(gx => svg`<line class="fp-grid-line" x1=${gx} y1=${DAY_PAD_T} x2=${gx} y2=${DAY_H - DAY_PAD_B} vector-effect="non-scaling-stroke"></line>`)}
                            ${showLoss ? svg`<path class=${m.hasSale ? 'fp-area-sold' : 'fp-area-export'} d=${lossPath}></path>` : nothing}
                            ${showBat ? svg`<line class="fp-zero" x1="0" y1=${zeroY} x2=${cols} y2=${zeroY} vector-effect="non-scaling-stroke"></line>` : nothing}
                            ${showCons ? line('fp-line-cons', getPath(coordsOf(cons))) : nothing}
                            ${showImp ? line('fp-line-imp', getPath(coordsOf(imp))) : nothing}
                            ${showSol ? line('fp-line-sol', getPath(coordsOf(sol))) : nothing}
                            ${showBat ? svg`
                                <g clip-path="url(#${clipUp})">${line('fp-line-bat-out', getPath(coordsOf(bat)))}</g>
                                <g clip-path="url(#${clipDown})">${line('fp-line-bat-in', getPath(coordsOf(bat)))}</g>
                            ` : nothing}
                        </svg>`}
                    ${gridYs.map((gy, k) => html`<span class="fp-yval" style="top:${(gy / DAY_H * 100).toFixed(2)}%">${this._fmtKwh(yMin + (1 - k / 4) * span)}${k === 0 ? ' kWh' : ''}</span>`)}
                    ${cur ? html`
                        <div class="fp-cursor" style="left:${cur.xPx}px; height:${cur.hPx}px"></div>
                        <div class="fp-time" style="left:${cur.xPx}px">${this._slotLabel(row[cur.q].ms)}</div>
                        ${showCons ? html`<div class="fp-beam fp-beam-cons" style="left:${cur.xPx}px; top:${cur.consY}px"></div>` : nothing}
                        ${showImp ? html`<div class="fp-beam fp-beam-imp" style="left:${cur.xPx}px; top:${cur.impY}px"></div>` : nothing}
                        ${showSol ? html`<div class="fp-beam fp-beam-sol" style="left:${cur.xPx}px; top:${cur.solY}px"></div>` : nothing}
                        ${showBat && cur.batY !== null ? html`<div class="fp-beam ${cur.batCharge ? 'fp-beam-bat-in' : 'fp-beam-bat-out'}" style="left:${cur.xPx}px; top:${cur.batY}px"></div>` : nothing}
                    ` : nothing}
                </div>
                <div class="fp-detail-legend chart-legend">
                    <ul>
                        ${leg('cons', 'var(--primary-text-color, #212121)', t.consumption)}
                        ${leg('imp', 'var(--energy-grid-consumption-color, var(--primary-color, #488fc2))', t.grid)}
                        ${leg('sol', 'var(--energy-solar-color, var(--warning-color, #ff9800))', t.solar)}
                        ${hasBat ? leg('bat', 'var(--energy-battery-out-color, #4db6ac)', t.battery) : nothing}
                        ${m.hasSale
                            ? leg('loss', 'var(--success-color, #4caf50)', t.sold)
                            : leg('loss', 'var(--energy-grid-return-color, #8353d1)', t.exported)}
                    </ul>
                </div>
            </div>`;
    }

    //"HH:MM - HH:MM" range for a 15-minute slot, shown at the scrub cursor.
    private _slotLabel(msStart: number): string
    {
        const tf = new Intl.DateTimeFormat(this.hass?.language || undefined, { hour: '2-digit', minute: '2-digit' });
        return `${tf.format(new Date(msStart))} - ${tf.format(new Date(msStart + 15 * 60_000))}`;
    }

    //Compact kWh axis value: no decimals >= 10, one >= 1, two below, and a bare "0" at the baseline.
    private _fmtKwh(v: number): string
    {
        if (Math.abs(v) < 0.005) { return '0'; }
        const a = Math.abs(v);
        return v.toFixed(a >= 10 ? 0 : a >= 1 ? 1 : 2);
    }

    //Current numeric value of an `entity_energy_price` sensor (per exported kWh), or null when absent/non-numeric.
    private _resolvePrice(entityId: string | null): number | null
    {
        if (!entityId) { return null; }
        const v = Number.parseFloat(this.hass?.states?.[entityId]?.state);
        return Number.isFinite(v) ? v : null;
    }

    //Money in the dashboard's currency (falls back to a plain number if the currency code is missing/invalid).
    private _fmtMoney(v: number): string
    {
        const currency = this.hass?.config?.currency;
        const lang = this.hass?.language || undefined;
        try { return new Intl.NumberFormat(lang, currency ? { style: 'currency', currency } : { maximumFractionDigits: 2 }).format(v); }
        catch { return v.toFixed(2); }
    }

    //Scrub the day chart: snap to the slot under the pointer, anchor the cursor at that slot's left edge (where its
    //curve point sits), place a beam on each curve, and light up the matching heatmap cell above. The plot shares
    //the heatmap's inset and x-scale, so the cursor lands on the same time in both. Mouse move and touch swipe alike.
    private _onChartMove = (e: PointerEvent): void =>
    {
        const el = this._chart; const dv = this._dayView;
        if (!el || !dv) { return; }
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) { return; }
        const t = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        this._cursor = this._cursorAt(Math.floor(t * dv.cols), rect, dv);
    };

    //Cursor descriptor for slot q: its x on the plot, a beam y on each curve, the linked heatmap cell.
    private _cursorAt(qRaw: number, rect: DOMRect, dv: NonNullable<typeof this._dayView>): NonNullable<typeof this._cursor>
    {
        const q = Math.min(dv.cols - 1, Math.max(0, qRaw));
        const xPx = (q / dv.cols) * rect.width;
        const span = dv.yMax - dv.yMin;
        const usable = DAY_H - DAY_PAD_T - DAY_PAD_B;
        const yPx = (v: number): number => ((DAY_H - DAY_PAD_B) - ((v - dv.yMin) / span) * usable) / DAY_H * rect.height;
        return { q, xPx, hPx: rect.height, consY: yPx(dv.cons[q]), impY: yPx(dv.imp[q]), solY: yPx(dv.sol[q]), batY: dv.hasBattery ? yPx(dv.bat[q]) : null, batCharge: dv.bat[q] < 0 };
    }

    //After a heatmap cell tap opened a day, drop the chart cursor on the matching slot once the chart is laid out.
    private _applyPendingCursor(): void
    {
        if (this._pendingCursorQ === null) { return; }
        const el = this._chart; const dv = this._dayView;
        if (!el || !dv) { return; }
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) { return; }
        const q = this._pendingCursorQ;
        this._pendingCursorQ = null;
        this._cursor = this._cursorAt(q, rect, dv);
    }

    private _onChartLeave = (): void => { if (this._cursor) { this._cursor = null; } };

    //Toggle a curve's visibility from its legend chip (the hidden set drives both the axis fit and what is drawn).
    private _onLegend = (e: Event): void =>
    {
        const k = (e.currentTarget as HTMLElement | null)?.dataset?.k;
        if (!k) { return; }
        const next = new Set(this._hidden);
        if (next.has(k)) { next.delete(k); } else { next.add(k); }
        this._hidden = next;
    };

    //The heatmap cell that the day-chart cursor points at, ringed like a hover so the two charts read as linked.
    private _renderChartLink()
    {
        const cur = this._cursor; const r = this._detailRow; const m = this._model;
        if (!cur || r === null || !m) { return nothing; }
        const g = this._geom();
        if (!g) { return nothing; }
        return html`<div class="fp-hl" style="left:${MARGIN_L + cur.q * g.cw}px; top:${r * g.ch}px; width:${Math.max(0, g.cw - CELL_GAP)}px; height:${Math.max(0, g.ch - CELL_GAP)}px"></div>`;
    }

    protected render()
    {
        if (!this._config) { return nothing; }
        const t = this._t;
        const title = this._config.title ?? t.title;
        const ready = this._model !== null;
        //Infinity until the wall is measured on load, so "previous" stays disabled until back-nav is safe.
        const canOlder = this._wallOffset !== Infinity && this._weekOffset + 1 < this._wallOffset;
        return html`
            <ha-card>
                <div class="fp-header">
                    <span class="fp-title">${title}</span>
                    <div class="fp-nav">
                        <button type="button" class="fp-nav-btn" aria-label=${t.prevWeek} ?disabled=${!canOlder || this._navLoading} @click=${this._prevWeek}>&lsaquo;</button>
                        <span class="fp-week">${this._weekLabel()}</span>
                        <button type="button" class="fp-nav-btn" aria-label=${t.nextWeek} ?disabled=${this._weekOffset === 0 || this._navLoading} @click=${this._nextWeek}>&rsaquo;</button>
                    </div>
                </div>
                <div class="fp-body">
                    ${ready && this._model!.hasAnyData
                        ? html`
                            <div class="fp-grid" @pointermove=${this._onMove} @pointerleave=${this._onLeave} @click=${this._onClick}>
                                <svg class="fp-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"></svg>
                                ${this._renderChartLink()}
                                ${this._renderHover()}
                            </div>
                            ${this._renderDetail()}
                        `
                        : html`<div class="fp-empty">${ready ? t.noData : t.loading}</div>`}
                </div>
            </ha-card>`;
    }
}
