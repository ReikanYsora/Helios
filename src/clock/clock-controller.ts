import type { TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import type { HeliosCard } from '../helios-card';
import { HOUR_MS, HOURS_PER_DAY, CLOCK_GROW_MS, DAY_ANIM_MS } from '../core/config/constants';
import { pickTranslations } from '../core/i18n';
import type { ChartTarget } from '../charts/charts';
import { formatHaHour, ENERGY_COLOR, deviceColorByIndex } from '../core/format/format';
import { refreshClockHourly } from './clock-hourly';
import { refreshDayRing, type DayRingData } from './consumption-ring';
import { nightFractionByHour } from '../core/time/sun-zones';
import { getHomeCoords } from '../card/init';
import
{
    type ClockData, type ClockHit, type ClockRingInput, type ClockFrame,
    buildClockData, clockTargetMeta, clockTargetLabel,
    projectClockFrame, projectDayRingFrame, clockHitTest, clockTotal, clockLayerValue, formatClockValue,
    clockUnitCeilings, clockLayerPeriod, clockPeriodTotal, CLOCK_SLOTS_PER_HOUR, easeOutCubic,
} from './energy-clock';


//Clock dial subsystem: view-mode switching, the clock-filter toggle/slide, the dim + grow/slide/exit
//rAF animation engine, clock data build, paint/apply-frame, pointer hit-testing, hour/compass formatting
//and the dial tooltips. Extracted from HeliosCard; the reactive @state it drives (_clockData,
//_clockTargets, _clockHoverSlot, _clockHomeHover, _nightFrac, the query refs, ...) stays on
//the card and is reached through `this.host` so Lit reactivity and the energy-clock helpers keep working.

//Even-odd ray-cast: is the screen point inside the projected polygon (a device ring's outer/inner circle)?
function pointInPoly(poly: [number, number][], x: number, y: number): boolean
{
    let inside = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++)
    {
        const xa = poly[a][0]; const ya = poly[a][1];
        const xb = poly[b][0]; const yb = poly[b][1];
        if (((ya > y) !== (yb > y)) && (x < (xb - xa) * (y - ya) / (yb - ya) + xa)) { inside = !inside; }
    }
    return inside;
}

export class ClockController
{
    public constructor(private readonly host: HeliosCard) {}

    //Per-unit displayed ceiling, eased toward the target so the remaining bars rescale smoothly when a filter is
    //toggled (toggling one of two same-unit metrics otherwise snaps the survivor to a new axis). Each entry eases
    //from `from` to `to` over CLOCK_GROW_MS; `start === 0` means at rest (snapped to `to`). The ease is requested
    //only by a filter toggle (via _clockCeilEase); entry, data loading and period changes snap.
    public _clockCeilAnim = new Map<string, { from: number; to: number; start: number }>();
    //Set by a filter toggle to ask paintClock to EASE the next ceiling change instead of snapping it; consumed on
    //the first paint that applies it.
    public _clockCeilEase = false;
    //Home prism's screen centre + hit radius from the last frame, for the home hover/tap test.
    public _clockHome: { x: number; y: number; r: number } | null = null;
    //Screen-space hit segments (each slot's axis), refreshed every paint for the hover test.
    public _clockHits: ClockHit[] = [];
    public _clockHoverX = 0;
    public _clockHoverY = 0;
    //Touch: a tapped tooltip is sticky (hover doesn't fire on touch), cleared by tapping empty space or
    //another cylinder. _clockTapStart* anchor the move-threshold that tells a tap from a drag-rotate.
    public _clockTapSticky = false;
    public _clockTapStartX = 0;
    public _clockTapStartY = 0;
    //Per-ring animation, keyed by metric so rapid toggles never desync (no held rebuild, no shared index):
    //  _clockGrowStart: when a ring's grow begins (0..1 height rise); absent = at rest. A start in the FUTURE
    //                   holds the ring at 0 until then (the reload's shrink/hold/grow uses that). See
    //                   _clockRingHeight for the resolved per-frame height, _clockSlotNow for the slide.
    //  _clockExiting:   removed rings fading + shrinking out, independent of the live list so a toggle never
    //                   blocks the rebuild; each carries the slot it held so survivors slide over it.
    //  _clockSlotFrom + _clockSlideStart: captured source slot per ring + when the recompaction slide began,
    //                   re-snapshotted from CURRENT animated positions on every toggle so nothing teleports.
    //  _clockAnimSeq:   gates the single shared animation rAF loop.
    public _clockGrowStart = new Map<ChartTarget, number>();
    public _clockExiting: { data: ClockData; slot: number; start: number; h0: number }[] = [];
    public _clockSlotFrom = new Map<ChartTarget, number>();
    public _clockSlideStart = 0;
    public _clockAnimSeq = 0;
    //Period-change reload: every ring shrinks to 0 and holds there while the new window's data is fetched,
    //then grows back up once it lands, so the dial never pops abruptly from old data to new. 0 = idle.
    //_clockReloadWindowStartMs is the new window's series-start anchor, captured when the reload begins: the
    //grow only fires once the relevant change-series fetch keys carry THIS start (the now/week store rebuilds
    //eagerly from stale series at the new geometry, so non-null alone never proves the data is fresh).
    public _clockReloadStart = 0;
    public _clockReloadWindowStartMs = 0;
    //Slice-focus dim: _clockDim ramps 0..1 (others fade toward 0.5) while _clockDimSlot is focused; it
    //persists through the fade-out so the dimmed bars + the focused spoke ramp back smoothly.
    public _clockDim = 0;
    public _clockDimSlot: number | null = null;
    public _clockDimSeq  = 0;
    //Cache key for the per-hour night share, so idle frames never recompute refreshNightFrac.
    public _nightFracKey = '';

    //Reload grow gate for now/week: true only once every CONFIGURED change-series has refetched for the new
    //window. Each fetch helper keys its series on `...|${startMs}|...` where startMs is the new window's series
    //start; so a series is fresh when its key carries _clockReloadWindowStartMs and it is no longer in flight.
    //Series with no configured entity contribute nothing to the dial and are skipped. Until all pass, the
    //store may be non-null but is built from STALE series at the new geometry, so the grow must not fire.
    public clockWindowFetched(): boolean
    {
        const anchor = `|${this._clockReloadWindowStartMs}|`;
        const d = this.host._energyDefaults;
        const fresh = (
            ids:      readonly string[],
            key:      string,
            fetching: boolean,
        ): boolean => ids.length === 0 || (!fetching && key.includes(anchor));
        return fresh(d.solarStatEnergyFroms,   this.host._pvChangeFetch.key,   this.host._pvChangeFetch.fetching)
            && fresh(d.gridStatEnergyFroms,    this.host._gridImportFetch.key, this.host._gridImportFetch.fetching)
            && fresh(d.gridStatEnergyTos,      this.host._gridExportFetch.key, this.host._gridExportFetch.fetching)
            && fresh([...d.batteryStatEnergyTos, ...d.batteryStatEnergyFroms],
                     this.host._batteryChangeFetch.key, this.host._batteryChangeFetch.fetching);
    }

    //Switch between scene (3D view) and clock (hourly ring dial) modes. Resets clock animation state so the
    //dial enters/leaves cleanly, seeds/restores the filter set and home prism, persists, and kicks the
    //decoupled hourly fetch (clock only). No-op when already in the requested mode.
    public setViewMode(mode: 'scene' | 'clock' | 'day'): void
    {
        if (this.host._viewMode === mode)
        {
            return;
        }
        //Reset any clock animation state so the dial enters/leaves cleanly. Ceiling eases reset too, so entry
        //snaps to the target scale instead of easing from a stale one.
        this._clockAnimSeq++;
        this._clockExiting = [];
        this._clockSlotFrom.clear();
        this._clockSlideStart = 0;
        this._clockCeilAnim.clear();
        this._clockCeilEase = false;
        this.host._clockHoverSlot = null;
        this.host._clockHomeHover = false;
        //Leaving the day view restores the camera it saved before entering (top-down + lock is day-only).
        if (this.host._viewMode === 'day' && mode !== 'day') { this.host._engine?.exitDayView(); }
        if (mode === 'clock')
        {
            //Entering clock: the scene's selected chip drives the dial. If it is not already among the active
            //filters, reset to it (so selecting a chip in the scene always carries into clock); when it IS one of
            //them, keep the multi-filter set the user built inside the dial.
            if (!this.host._clockTargets.includes(this.host._chartTarget))
            {
                this.host._clockTargets = [this.host._chartTarget];
            }
            this.rebuildClockData();
            //Reveal every ring with a grow when the dial first appears.
            const now = Date.now();
            this._clockGrowStart.clear();
            this.host._clockTargets.forEach(t => this._clockGrowStart.set(t, now));
            //Dial draws no scene geometry: the engine keeps only the basemap, the overlay paints the dial.
            this.host._engine?.setHomeOnly(true);
            this.host._viewMode = mode;
            this.host.persistUiState();
            //Long window: kick the decoupled hourly fetch now (the gated refresh chain won't, since nothing
            //it watches changed). No-op / clears itself when not needed.
            void refreshClockHourly(this.host);
            this.clockAnimate();
            return;
        }
        if (mode === 'day')
        {
            //Day mode draws no scene geometry; the overlay paints today's ground ring. Lock the camera to a
            //top-down, equator-up view (restored on exit).
            this.host._engine?.setHomeOnly(true);
            this.host._engine?.enterDayView();
            this.host._viewMode = mode;
            this.host.persistUiState();
            void refreshClockHourly(this.host);   //clears the clock profile (it keys off _viewMode)
            void refreshDayRing(this.host);
            this.scheduleClockPaint();
            return;
        }
        //Leaving to scene: restore the full scene + the chart-driven home colour, clear the ground guide + logo.
        this.host._engine?.setHomeOnly(false);
        this.host._engine?.setGroundOverlay('');
        this.host._engine?.setGroundDecal(null);
        this.host.updateHomeAppearance(false);
        if (this.host._clockTargets.length > 0)
        {
            //Back to scene: the timeline (hidden in dial modes) re-applies the FIRST selected filter.
            this.host.setChartTarget(this.host._clockTargets[0]);
        }
        this.host._viewMode = mode;
        this.host.persistUiState();
        //Now that we've left the dial, let the clock profile clear itself (it keys off _viewMode).
        void refreshClockHourly(this.host);
    }

    //Rail button delegate: the clicked element carries its mode in data-view.
    public onViewModeClick = (e: Event): void =>
    {
        const view = (e.currentTarget as HTMLElement).dataset.view as 'scene' | 'clock' | 'day' | undefined;
        if (view) { this.setViewMode(view); }
    };

    //Toggle a metric in/out of the clock filter set (multi-select). Each active filter draws its own concentric
    //ring of hour bars; the first stays the timeline's target for when scene mode resumes. Order is preserved
    //(append on add). Adding grows the new ring in; removing shrinks + fades it while the survivors slide to
    //recompact and their shared-unit ceiling eases to the new scale.
    public toggleClockTarget = (target: ChartTarget): void =>
    {
        const i = this.host._clockTargets.indexOf(target);
        const adding = i < 0;
        //Snapshot every ring's CURRENT animated slot first, so the recompaction slides from where it is now
        //(robust to toggling again mid-animation) rather than teleporting.
        this.captureClockSlots();
        const now = Date.now();
        if (adding)
        {
            //Re-adding a metric that's still exiting: cancel its exit so we don't briefly draw it twice.
            this._clockExiting = this._clockExiting.filter(e => e.data.target !== target);
            this.host._clockTargets = [...this.host._clockTargets, target];
            this._clockGrowStart.set(target, now);
        }
        else
        {
            //Hand the removed ring to the independent exit list at its current slot + height, so an in-progress
            //grow shrinks from where it is (no jump to full) while survivors slide over it.
            const data = this.host._clockData[i];
            const gs   = this._clockGrowStart.get(target);
            const h0   = gs ? easeOutCubic((now - gs) / CLOCK_GROW_MS) : 1;
            if (data) { this._clockExiting.push({ data, slot: this._clockSlotFrom.get(target) ?? i, start: now, h0 }); }
            this._clockGrowStart.delete(target);
            this.host._clockTargets = this.host._clockTargets.filter(t => t !== target);
        }
        this.rebuildClockData();
        if (this.host._clockTargets.length > 0)
        {
            this.host.setChartTarget(this.host._clockTargets[0]);
        }
        this.host.persistUiState();
        //A toggle rescales the shared-unit survivors: ask paintClock to ease the ceiling change rather than snap.
        this._clockCeilEase = true;
        this.clockAnimate();
    };

    //Metric-rail button delegate: the clicked element carries its metric in data-target.
    public onClockTargetToggleClick = (e: Event): void =>
    {
        const target = (e.currentTarget as HTMLElement).dataset.target as ChartTarget | undefined;
        if (target) { this.toggleClockTarget(target); }
    };

    //Snapshot each present ring's current animated slot into _clockSlotFrom and (re)anchor the slide clock, so
    //the next recompaction eases from the live positions instead of the integer indices.
    public captureClockSlots(): void
    {
        const now    = Date.now();
        const slideP = this._clockSlideStart ? (now - this._clockSlideStart) / CLOCK_GROW_MS : 1;
        const eased  = easeOutCubic(slideP);
        const snap   = new Map<ChartTarget, number>();
        this.host._clockData.forEach((data, i) =>
        {
            const from = this._clockSlotFrom.get(data.target) ?? i;
            snap.set(data.target, from + (i - from) * eased);
        });
        this._clockSlotFrom  = snap;
        this._clockSlideStart = now;
    }

    //Slice-focus dim fade: ramp _clockDim toward 1 while an hour is focused (others fade to 0.5), back to 0
    //when the hover/tap ends. _clockDimSlot is kept through the fade-out so the dimmed bars + the focused
    //spoke ramp back smoothly. Instant in preview / reduced motion.
    public startClockDim(): void
    {
        if (this.host._clockHoverSlot !== null)
        {
            this._clockDimSlot = this.host._clockHoverSlot;
        }
        const target = this.host._clockHoverSlot !== null ? 1 : 0;
        if (this.host.preview || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        {
            this._clockDim = target;
            if (target === 0) { this._clockDimSlot = null; }
            this.scheduleClockPaint();
            return;
        }
        const id    = ++this._clockDimSeq;
        const from  = this._clockDim;
        const start = performance.now();
        const DUR   = 150;
        const animateDim = (now: number): void =>
        {
            if (id !== this._clockDimSeq || this.host._viewMode !== 'clock')
            {
                return;
            }
            const t = Math.min(1, (now - start) / DUR);
            this._clockDim = from + (target - from) * easeOutCubic(t);
            this.paintClock();
            if (t < 1)
            {
                requestAnimationFrame(animateDim);
            }
            else
            {
                this._clockDim = target;
                if (target === 0) { this._clockDimSlot = null; }
                this.paintClock();
            }
        };
        requestAnimationFrame(animateDim);
    }

    //Day-ring entry sweep: repaint every frame for DAY_ANIM_MS so the paint branch can read the animation progress
    //off `_dayAnimStart`. Drawn full at once in preview / reduced motion. A new call cancels the previous loop.
    public _dayAnimSeq = 0;
    public startDayAnim(): void
    {
        if (this.host.preview || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        {
            this.host._dayAnimStart = 0;
            this.scheduleClockPaint();
            return;
        }
        this.host._dayAnimStart = Date.now();
        const id = ++this._dayAnimSeq;
        const step = (): void =>
        {
            if (id !== this._dayAnimSeq || this.host._viewMode !== 'day') { return; }
            this.paintClock();
            if (this.host._dayAnimStart > 0 && Date.now() - this.host._dayAnimStart < DAY_ANIM_MS)
            {
                requestAnimationFrame(step);
            }
            else
            {
                this.host._dayAnimStart = 0;
                this.paintClock();
            }
        };
        requestAnimationFrame(step);
    }

    //Rebuild one ClockData per active filter (outer -> inner), immediately and unconditionally. Animation is
    //carried separately (per-ring grow start, the exit list, the slide clock), so a data-only rebuild never
    //disturbs an in-flight animation and a toggle is never blocked.
    public rebuildClockData(): void
    {
        this.host._clockData = this.host._clockTargets.map(t => buildClockData(this.host, t));
    }

    //Current animated slot of a present ring: eased lerp from its captured source slot to its live index.
    private _clockSlotNow(index: number, target: ChartTarget): number
    {
        const from   = this._clockSlotFrom.get(target) ?? index;
        const slideP = this._clockSlideStart ? (Date.now() - this._clockSlideStart) / CLOCK_GROW_MS : 1;
        return from + (index - from) * easeOutCubic(slideP);
    }

    //A present ring's 0..1 height for this frame, by explicit phase:
    //  GROW:   a grow start exists. While it's scheduled in the future (the reload hold), it sits at 0;
    //          from the start onward it eases up to full.
    //  SHRINK: no grow start but a reload is in progress: ease down from full to 0, then hold there.
    //  REST:   neither: full height.
    private _clockRingHeight(target: ChartTarget, now: number): number
    {
        const gs = this._clockGrowStart.get(target);
        if (gs !== undefined) { return now >= gs ? easeOutCubic((now - gs) / CLOCK_GROW_MS) : 0; }
        if (this._clockReloadStart) { return 1 - easeOutCubic((now - this._clockReloadStart) / CLOCK_GROW_MS); }
        return 1;
    }

    //True while any grow, slide or exit is still playing (so the shared rAF loop keeps repainting).
    private _clockAnimActive(): boolean
    {
        const now = Date.now();
        if (this._clockExiting.length > 0) { return true; }
        //Stay active through the whole reload (shrink + hold) until the data lands and the grow is scheduled.
        if (this._clockReloadStart) { return true; }
        if (this._clockSlideStart && now - this._clockSlideStart < CLOCK_GROW_MS) { return true; }
        //A future grow start (reload hold) keeps it active until that grow finishes.
        for (const t of this._clockGrowStart.values()) { if (now - t < CLOCK_GROW_MS) { return true; } }
        //A ceiling rescale ease still running.
        for (const a of this._clockCeilAnim.values()) { if (a.start && now - a.start < CLOCK_GROW_MS) { return true; } }
        return false;
    }

    //Drive the shared clock animation: one rAF loop that prunes finished state then repaints, until idle.
    //Instant in preview / reduced motion (settle immediately).
    public clockAnimate(): void
    {
        const settle = (): void =>
        {
            const now = Date.now();
            this._clockExiting = this._clockExiting.filter(e => now - e.start < CLOCK_GROW_MS);
            for (const [t, s] of this._clockGrowStart) { if (now - s >= CLOCK_GROW_MS) { this._clockGrowStart.delete(t); } }
            //Settle finished ceiling eases to rest (start 0) so they stop driving the loop but keep their value.
            for (const [, a] of this._clockCeilAnim) { if (a.start && now - a.start >= CLOCK_GROW_MS) { a.from = a.to; a.start = 0; } }
            if (this._clockSlideStart && now - this._clockSlideStart >= CLOCK_GROW_MS)
            {
                this._clockSlideStart = 0;
                this._clockSlotFrom.clear();
            }
            //Reload safety: if the new data never lands (fetch failure / no data), grow back after 12 s so the
            //dial is never stuck shrunk.
            if (this._clockReloadStart && now - this._clockReloadStart > 12_000)
            {
                this.host._clockTargets.forEach(t => this._clockGrowStart.set(t, now));
                this._clockReloadStart = 0;
            }
        };
        if (this.host.preview || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        {
            this._clockExiting = [];
            this._clockGrowStart.clear();
            this._clockSlideStart = 0;
            this._clockReloadStart = 0;
            this._clockSlotFrom.clear();
            this._clockCeilAnim.clear();
            this._clockCeilEase = false;
            this.paintClock();
            return;
        }
        const id = ++this._clockAnimSeq;
        const animateClock = (): void =>
        {
            if (id !== this._clockAnimSeq || this.host._viewMode !== 'clock') { return; }
            settle();
            this.paintClock();
            if (this._clockAnimActive()) { requestAnimationFrame(animateClock); }
        };
        requestAnimationFrame(animateClock);
    }

    public scheduleClockPaint(): void
    {
        requestAnimationFrame(() => this.paintClock());
    }

    //Recompute the per-hour night share for the ground wedges when the home or the window (rounded to the hour)
    //changes. Cheap + keyed, so idle frames never recompute.
    public refreshNightFrac(): void
    {
        const coords = getHomeCoords(this.host.config, this.host.hass);
        if (!coords || !this.host._timeRange)
        {
            if (this.host._nightFrac !== null) { this.host._nightFrac = null; }
            this._nightFracKey = '';
            return;
        }
        const startMs = this.host._timeRange.start.getTime();
        const endMs   = Math.min(Date.now(), this.host._timeRange.end.getTime());
        const key = `${coords.lat.toFixed(3)}|${coords.lon.toFixed(3)}|${Math.floor(startMs / HOUR_MS)}|${Math.floor(endMs / HOUR_MS)}`;
        if (key === this._nightFracKey) { return; }
        this._nightFracKey = key;
        this.host._nightFrac = nightFractionByHour(coords.lat, coords.lon, startMs, endMs);
    }

    //Project the rings for one frame and write them onto the overlay DOM: the bar SVG, the ground-laid hour
    //labels, and the clamped tooltip. Called every transform frame (init.ts) and during the grow/slide/exit
    //animation. Public so the engine's per-frame callback can reach it.
    public paintClock(): void
    {
        if (this.host._viewMode !== 'clock' && this.host._viewMode !== 'day')
        {
            return;
        }
        const svgEl  = this.host._clockSvg;
        const camera = this.host._engine?._renderer?.camera;
        if (!svgEl || !camera || !camera.hasViewport)
        {
            return;
        }
        const tc = pickTranslations(this.host.hass?.language).clock;
        const cardinals = { n: tc.compassN, s: tc.compassS, e: tc.compassE, w: tc.compassW };

        //Day dial: the flat 24-hour ground ring for today, each hour split gold (solar) then import-colour (grid).
        //No bars, no rail, no tooltip: just the base ground ring.
        if (this.host._viewMode === 'day')
        {
            const el          = this.host as unknown as Element;
            const dr          = this.host._dayRing;
            const importColor = ENERGY_COLOR.gridImport(el);
            const batteryColor = ENERGY_COLOR.batteryOut(el);
            const devs        = dr?.devices ?? [];
            const rings       = devs.map(dev => ({
                color:  dev.color ?? deviceColorByIndex(el, dev.index),
                values: dev.values,
            }));
            //Entry-sweep progress (0..1); 1 = fully drawn (no animation in flight).
            const anim        = this.host._dayAnimStart > 0 ? Math.min(1, (Date.now() - this.host._dayAnimStart) / DAY_ANIM_MS) : 1;
            const frame       = projectDayRingFrame(camera, dr?.solar ?? [], dr?.battery ?? [], dr?.grid ?? [], importColor, batteryColor, rings, dr?.hasSolar ?? false, dr?.hasGrid ?? false, dr?.hasBattery ?? false, this._daySelectedIndex(dr), dr?.maxKw ?? 0, anim);
            this.host._dayHitPolys = frame.dayHits ?? [];
            this._applyClockFrame(frame);
            return;
        }
        //Resolve each ring's live animation scalars: present rings slide to their index + grow in; exiting
        //rings shrink + fade out at their captured slot. An empty list still paints the clock face (guide +
        //spokes + labels). projectClockFrame is pure geometry from here.
        const now = Date.now();
        const rings: ClockRingInput[] = this.host._clockData.map((data, i) =>
            ({ data, slot: this._clockSlotNow(i, data.target), heightScale: this._clockRingHeight(data.target, now), opacity: 1 }));
        for (const e of this._clockExiting)
        {
            const p = easeOutCubic((now - e.start) / CLOCK_GROW_MS);
            rings.push({ data: e.data, slot: e.slot, heightScale: e.h0 * (1 - p), opacity: 1 - p });
        }
        //Per-unit ceiling for this frame. A toggle (via _clockCeilEase) eases the survivors from their current
        //displayed ceiling to the new target; everything else (entry, data load, period change) snaps. An ease
        //already in flight is left to run, so it never gets re-snapped on the next frame.
        const targetCeil = clockUnitCeilings(this.host._clockData);
        const ease       = this._clockCeilEase;
        this._clockCeilEase = false;
        const dispCeil = new Map<string, number>();
        const ceilAt = (a: { from: number; to: number; start: number }): number =>
            a.start === 0 ? a.to : a.from + (a.to - a.from) * easeOutCubic((now - a.start) / CLOCK_GROW_MS);
        for (const u of [...this._clockCeilAnim.keys()]) { if (!targetCeil.has(u)) { this._clockCeilAnim.delete(u); } }
        for (const [u, to] of targetCeil)
        {
            const prev = this._clockCeilAnim.get(u);
            if (!prev)
            {
                this._clockCeilAnim.set(u, { from: to, to, start: 0 });            //first sight: rest at target
            }
            else if (prev.to !== to)
            {
                //Target moved. Ease only a TOGGLE that LOWERS the ceiling (a filter removed: the survivors rescale
                //up smoothly). A rising ceiling snaps: easing the denominator up from a smaller value divides the
                //bar heights by too little for the first frames and flings them off the top (e.g. adding a metric
                //while the only ring was all-zero, like PV at night). The added ring still grows in via its own
                //heightScale, so the snap is invisible.
                const from = ceilAt(prev);
                this._clockCeilAnim.set(u, ease && to < from ? { from, to, start: now } : { from: to, to, start: 0 });
            }
            dispCeil.set(u, ceilAt(this._clockCeilAnim.get(u)!));
        }
        const frame = projectClockFrame(
            camera, rings,
            this._clockDimSlot, this._clockDim,
            cardinals,
            dispCeil,
            this.host._clockHomeHover,
            this.host._nightFrac ?? [],
        );
        this._applyClockFrame(frame);
    }

    //Write a projected dial frame onto the overlay DOM: cylinders/bars into .clock-svg, the flat guide into the
    //engine's ground overlay, the hit axes + centre hit, and the ground-laid hour + compass labels. Shared by
    //the clock and day dials.
    private _applyClockFrame(frame: ClockFrame): void
    {
        if (this.host._clockSvg) { this.host._clockSvg.innerHTML = frame.svg; }
        this.host._engine?.setGroundOverlay(frame.guideSvg);
        this.host._engine?.setGroundDecal(frame.decal.svg, frame.decal.active);
        this._clockHits = frame.hits;
        this._clockHome = frame.home;

        this.host._clockLabels?.forEach((node, h) =>
        {
            const lay = frame.labels[h];
            if (!lay) { return; }
            node.style.left      = `${lay.x.toFixed(1)}px`;
            node.style.top       = `${lay.y.toFixed(1)}px`;
            node.style.opacity   = lay.opacity.toFixed(3);
            node.style.transform = lay.transform;
        });
        //Compass letters: positioned like the hours but at full opacity (no depth fade).
        this.host._clockCompassLabels?.forEach((node, i) =>
        {
            const c = frame.compass[i];
            if (!c) { return; }
            node.style.left      = `${c.x.toFixed(1)}px`;
            node.style.top       = `${c.y.toFixed(1)}px`;
            node.style.transform = c.transform;
        });
    }

    //Mouse hover hit-test against the cylinder axes; updates the glow highlight + tooltip. Cleared during a
    //drag (buttons pressed). Touch has no hover, so it's handled by tap below (onClockTapStart/End).
    public onClockHover = (e: PointerEvent): void =>
    {
        if (this.host._viewMode !== 'clock' || e.pointerType !== 'mouse')
        {
            return;
        }
        if (e.buttons !== 0)
        {
            if (this.host._clockHoverSlot !== null)
            {
                this.host._clockHoverSlot = null;
                this._clockTapSticky = false;
            }
            return;
        }
        const card = this.host._haCard;
        if (!card)
        {
            return;
        }
        const rect = card.getBoundingClientRect();
        this._clockHoverX = e.clientX - rect.left;
        this._clockHoverY = e.clientY - rect.top;
        const hit = clockHitTest(this._clockHits, this._clockHoverX, this._clockHoverY);
        this._clockTapSticky = false;
        //The home owns only the central disc, and only when no cylinder is under the cursor: it brightens the
        //prism + shows the window total, and never dims the cylinders.
        const homeHit = hit === null && this._clockHomeHit(this._clockHoverX, this._clockHoverY);
        if (homeHit !== this.host._clockHomeHover)
        {
            this.host._clockHomeHover = homeHit;
        }
        if (hit !== this.host._clockHoverSlot)
        {
            this.host._clockHoverSlot = hit;   //@state change -> tooltip render + repaint via updated()
        }
        //Same slice, cursor moved: nothing to repaint. The tooltip is CSS-anchored, not cursor-tracked.
    };

    //True when (x,y) falls within the home prism's central hit disc captured from the last frame.
    private _clockHomeHit(x: number, y: number): boolean
    {
        const h = this._clockHome;
        return !!h && Math.hypot(x - h.x, y - h.y) <= h.r;
    }

    //Ordered selection keys matching the frame's ring order: producers (solar, grid, battery, when configured) then
    //devices in their display order. The key is stable ('solar' / 'grid' / 'battery' or 'dev:<statId>'), so a
    //selection survives a reorder or refetch.
    private _daySelectionKeys(dr: DayRingData): string[]
    {
        const keys: string[] = [];
        if (dr.hasSolar)   { keys.push('solar'); }
        if (dr.hasGrid)    { keys.push('grid'); }
        if (dr.hasBattery) { keys.push('battery'); }
        for (const d of dr.devices) { keys.push(`dev:${d.statId}`); }
        return keys;
    }

    //Resolve the saved selection key to a frame ring index (-1 = nothing selected, or the selected ring is gone).
    private _daySelectedIndex(dr: DayRingData | null): number
    {
        const key = this.host._daySelectedKey;
        if (!dr || !key) { return -1; }
        return this._daySelectionKeys(dr).indexOf(key);
    }

    //Day-mode selection panel (top-right, the scene detail-panel style): the selected ring's name + day total, and
    //for a device its solar / grid / battery split (which sums to 100%). The accent tints the panel border.
    public renderDaySelectionPanel(key: string): TemplateResult | typeof nothing
    {
        const dr = this.host._dayRing;
        if (!dr) { return nothing; }
        const el = this.host as unknown as Element;
        const kwh = (v: number): string => `${v.toFixed(2)} kWh`;
        const pct = (v: number): string => `${Math.round(v * 100)} %`;
        const panel = (accent: string, name: string, rows: { icon: string; value: string }[]): TemplateResult => html`
            <div class="detail-panel" style="--detail-accent:${accent}">
                <div class="dp-head">${name}</div>
                ${rows.map(r => html`<div class="dp-row"><ha-icon icon=${r.icon}></ha-icon><span>${r.value}</span></div>`)}
            </div>`;
        if (key === 'solar')   { return panel('#ffc107', 'Solar', [{ icon: 'mdi:white-balance-sunny', value: kwh(dr.solarKwh) }]); }
        if (key === 'grid')    { return panel(ENERGY_COLOR.gridImport(el), 'Grid', [{ icon: 'mdi:transmission-tower', value: kwh(dr.gridKwh) }]); }
        if (key === 'battery') { return panel(ENERGY_COLOR.batteryOut(el), 'Battery', [{ icon: 'mdi:battery', value: kwh(dr.batteryKwh) }]); }
        const dev = dr.devices.find(d => `dev:${d.statId}` === key);
        if (!dev) { return nothing; }
        const rows = [
            { icon: 'mdi:sigma',               value: kwh(dev.dailyKwh) },
            { icon: 'mdi:white-balance-sunny', value: pct(dev.solarPct) },
            { icon: 'mdi:transmission-tower',  value: pct(dev.gridPct) },
        ];
        if (dr.hasBattery) { rows.push({ icon: 'mdi:battery', value: pct(dev.batteryPct) }); }
        return panel(dev.color ?? deviceColorByIndex(el, dev.index), dev.name, rows);
    }

    //Day-mode tap: toggle the ring under the point (re-tapping the selected ring, or tapping empty space, clears it).
    private _daySelectAt(x: number, y: number): void
    {
        const dr = this.host._dayRing;
        const polys = this.host._dayHitPolys;
        let idx = -1;
        for (let i = 0; i < polys.length; i++)
        {
            if (pointInPoly(polys[i].outer, x, y) && !pointInPoly(polys[i].inner, x, y)) { idx = i; break; }
        }
        const keys = dr ? this._daySelectionKeys(dr) : [];
        const hitKey = idx >= 0 && idx < keys.length ? keys[idx] : null;
        this.host._daySelectedKey = (hitKey && hitKey === this.host._daySelectedKey) ? null : hitKey;
        this.host.persistUiState();
    }

    public onClockHoverEnd = (e: PointerEvent): void =>
    {
        //Day mode has no hover: selection is tap-driven and sticky, so a pointer leaving changes nothing.
        if (this.host._viewMode === 'day') { return; }
        //Touch fires pointerleave on finger-up, right after the tap toggled the home/slot: ignore it so a tap
        //isn't cancelled the instant it lands. Touch state is sticky and managed by onClockTapEnd.
        if (e.pointerType !== 'mouse')
        {
            return;
        }
        if (this.host._clockHomeHover)
        {
            this.host._clockHomeHover = false;
        }
        //Leaving the surface only dismisses a mouse hover; a tapped (sticky) tooltip stays until tapped away.
        if (this.host._clockHoverSlot === null || this._clockTapSticky)
        {
            return;
        }
        this.host._clockHoverSlot = null;
    };

    //Remember where the gesture began so a tap can be told from a drag-rotate on release. Day mode selects on tap
    //for BOTH mouse and touch (no hover), so it records for every pointer type; clock keeps its touch-only tap.
    public onClockTapStart = (e: PointerEvent): void =>
    {
        const day = this.host._viewMode === 'day';
        if ((!day && this.host._viewMode !== 'clock') || (!day && e.pointerType === 'mouse'))
        {
            return;
        }
        const card = this.host._haCard;
        if (!card)
        {
            return;
        }
        const rect = card.getBoundingClientRect();
        this._clockTapStartX = e.clientX - rect.left;
        this._clockTapStartY = e.clientY - rect.top;
    };

    //Release: if the pointer barely moved it's a tap. Day mode toggles the ring selection under it; clock toggles a
    //sticky tooltip on the tapped cylinder. A real drag (past the threshold) rotated the camera and is ignored.
    public onClockTapEnd = (e: PointerEvent): void =>
    {
        const day = this.host._viewMode === 'day';
        if ((!day && this.host._viewMode !== 'clock') || (!day && e.pointerType === 'mouse'))
        {
            return;
        }
        const card = this.host._haCard;
        if (!card)
        {
            return;
        }
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (Math.hypot(x - this._clockTapStartX, y - this._clockTapStartY) > 10)
        {
            return;   //drag-rotate, not a tap
        }
        if (day) { this._daySelectAt(x, y); return; }
        this._clockHoverX = x;
        this._clockHoverY = y;
        const hit = clockHitTest(this._clockHits, x, y);
        if (hit !== null)
        {
            this._clockTapSticky = true;
            this.host._clockHoverSlot = hit;
            this.host._clockHomeHover = false;
        }
        else if (this._clockHomeHit(x, y))
        {
            //Tap the home: toggle its window-total tooltip (re-tap or tap elsewhere dismisses).
            this.host._clockHomeHover = !this.host._clockHomeHover;
            this.host._clockHoverSlot = null;
            this._clockTapSticky = this.host._clockHomeHover;
        }
        else
        {
            this._clockTapSticky = false;
            this.host._clockHoverSlot = null;
            this.host._clockHomeHover = false;
        }
    };

    //Hour label for a ground-laid tick, formatted like the rest of the HA dashboard (12/24h from the user's
    //time_format setting). The Date is local so the hour shown is the one meant.
    public formatClockHour(h: number): string
    {
        return formatHaHour(this.host.hass, new Date(2000, 0, 1, h));
    }

    //Localised compass letters in the SAME order projectClockFrame/clockCompass emit them (N, E, S, W), so each
    //div lines up with frame.compass[i] when _paintClock positions them. North is the red needle.
    public compassLabels(): { l: string; c: string }[]
    {
        const tc   = pickTranslations(this.host.hass?.language).clock;
        const text = 'var(--primary-text-color, #212121)';
        return [
            { l: tc.compassN, c: 'var(--red-color, #f44336)' },
            { l: tc.compassE, c: text },
            { l: tc.compassS, c: text },
            { l: tc.compassW, c: text },
        ];
    }


    //Hover tooltip for an hour slice: a time-band header, then one row per active filter (its coloured icon
    //+ its total value at that hour). Position is set inline then clamped in paintClock.
    public renderClockTooltip(slot: number): TemplateResult | typeof nothing
    {
        if (this.host._clockData.length === 0)
        {
            return nothing;
        }
        //The tooltip reads the HOUR the focused slot falls in: the header is the hour band (HH:00 - HH+1:00)
        //and the rows/total below aggregate that hour, matching the histogram bar.
        const hour = Math.floor(slot / CLOCK_SLOTS_PER_HOUR);
        const head = `${String(hour).padStart(2, '0')}:00 - ${String((hour + 1) % HOURS_PER_DAY).padStart(2, '0')}:00`;
        return html`
            <div class="clock-tip">
                <div class="clock-tip-head">${head}</div>
                ${this.host._clockData.map(data => {
                    const meta = clockTargetMeta(this.host, data.target);
                    //Multi-entity metrics (PV per source, grid import/export, battery charge/discharge) break
                    //down to one row per contributing layer; each row carries the layer's name (the entity's HA
                    //Energy name, or the metric name) between its glyph and value. Single-layer metrics keep one
                    //total row tagged with the metric name.
                    if (data.layers.length > 1) {
                        const rows = data.layers
                            .map(l => ({ l, v: clockLayerValue(l, data, slot) }))
                            .filter(r => r.v > 0);
                        if (rows.length > 0) {
                            return html`${rows.map(({ l, v }) => html`
                                <div class="clock-tip-row">
                                    <ha-icon icon=${l.icon} style="color:${l.color}"></ha-icon>
                                    <span class="clock-tip-name">${l.label}</span>
                                    <span class="clock-tip-val">${formatClockValue(this.host, data, v)}</span>
                                </div>
                            `)}`;
                        }
                    }
                    return html`
                        <div class="clock-tip-row">
                            <ha-icon icon=${meta.icon} style="color:${meta.color}"></ha-icon>
                            <span class="clock-tip-name">${clockTargetLabel(this.host, data.target)}</span>
                            <span class="clock-tip-val">${formatClockValue(this.host, data, clockTotal(data, slot))}</span>
                        </div>
                    `;
                })}
            </div>
        `;
    }

    //Home-hover tooltip: the window aggregate (energy summed, other units averaged) for every active filter,
    //the same rows as the hour tooltip but totalled over the whole selected period instead of one hour.
    public renderClockHomeTooltip(): TemplateResult | typeof nothing
    {
        if (this.host._clockData.length === 0)
        {
            return nothing;
        }
        const tc = pickTranslations(this.host.hass?.language).clock;
        return html`
            <div class="clock-tip">
                <div class="clock-tip-head">${tc.total}</div>
                ${this.host._clockData.map(data => {
                    const meta = clockTargetMeta(this.host, data.target);
                    if (data.layers.length > 1) {
                        const rows = data.layers
                            .map(l => ({ l, v: clockLayerPeriod(l, data) }))
                            .filter(r => r.v > 0);
                        if (rows.length > 0) {
                            return html`${rows.map(({ l, v }) => html`
                                <div class="clock-tip-row">
                                    <ha-icon icon=${l.icon} style="color:${l.color}"></ha-icon>
                                    <span class="clock-tip-name">${l.label}</span>
                                    <span class="clock-tip-val">${formatClockValue(this.host, data, v)}</span>
                                </div>
                            `)}`;
                        }
                    }
                    return html`
                        <div class="clock-tip-row">
                            <ha-icon icon=${meta.icon} style="color:${meta.color}"></ha-icon>
                            <span class="clock-tip-name">${clockTargetLabel(this.host, data.target)}</span>
                            <span class="clock-tip-val">${formatClockValue(this.host, data, clockPeriodTotal(data))}</span>
                        </div>
                    `;
                })}
            </div>
        `;
    }
}
