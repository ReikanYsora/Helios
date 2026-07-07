import type { TemplateResult } from 'lit';
import { html, nothing } from 'lit';
import type { HeliosCard } from '../helios-card';
import { HOUR_MS, HOURS_PER_DAY, CLOCK_GROW_MS } from '../core/config/constants';
import { pickTranslations } from '../core/i18n';
import type { ChartTarget } from '../charts/charts';
import { formatHaHour, ENERGY_COLOR, deviceColorByIndex } from '../core/format/format';
import { refreshClockHourly } from './clock-hourly';
import type { ClockHourly } from './clock-hourly';
import { refreshTrendProfiles } from './trend';
import { refreshDayRing, optimizeDevices } from './day-ring';
import { nightFractionByHour } from '../core/time/sun-zones';
import { getHomeCoords } from '../card/init';
import
{
    type ClockData, type ClockHit, type ClockRingInput, type ClockFrame,
    buildClockData, buildClockDataHourly, hourlyOf, clockTargetMeta, clockTargetLabel,
    projectClockFrame, projectTrendFrame, projectDayRingFrame, trendGoodDirection, clockHitTest, clockTotal, clockLayerValue, formatClockValue,
    clockUnitCeilings, clockLayerPeriod, clockPeriodTotal, CLOCK_SLOTS_PER_HOUR, easeOutCubic,
} from './energy-clock';


//Clock / trend dial subsystem: view-mode switching, the clock-filter toggle/slide, the dim + grow/slide/exit
//rAF animation engine, clock/trend data build, paint/apply-frame, pointer hit-testing, hour/compass formatting
//and the four dial tooltips. Extracted from HeliosCard; the reactive @state it drives (_clockData,
//_clockTargets, _trendP/_trendPrev, _clockHoverSlot, _clockHomeHover, _nightFrac, the query refs, ...) stays on
//the card and is reached through `this.host` so Lit reactivity and the energy-clock/trend helpers keep working.

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
    public setViewMode(mode: 'scene' | 'clock' | 'trend' | 'day'): void
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
        if (mode === 'trend')
        {
            //The scene's selected chip drives the trend dial too (single-metric, like scene). Weather metrics have
            //no P / P-1 profile, so an irradiance selection falls back to consumption.
            if (this.host._chartTarget !== 'irradiance') { this.host._trendTarget = this.host._chartTarget; }
            if (this.host._trendTarget === 'irradiance') { this.host._trendTarget = 'consumption'; }
            //Dial draws no scene geometry; the overlay paints the comparison dial. Fetch the two profiles.
            this.host._engine?.setHomeOnly(true);
            this.host._viewMode = mode;
            this.host.persistUiState();
            void refreshClockHourly(this.host);   //clears the clock profile (it keys off _viewMode)
            void refreshTrendProfiles(this.host); //P + P-1
            this.scheduleClockPaint();
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
        //Now that we've left the dial, let both profiles clear themselves (they key off _viewMode).
        void refreshClockHourly(this.host);
        void refreshTrendProfiles(this.host);
    }

    //Rail button delegate: the clicked element carries its mode in data-view.
    public onViewModeClick = (e: Event): void =>
    {
        const view = (e.currentTarget as HTMLElement).dataset.view as 'scene' | 'clock' | 'trend' | 'day' | undefined;
        if (view) { this.setViewMode(view); }
    };

    //Trend metric selector (single choice): pick the metric, refetch is implicit (data is metric-independent;
    //only the displayed vector changes), repaint.
    public onTrendTargetClick = (e: Event): void =>
    {
        const t = (e.currentTarget as HTMLElement).dataset.target as ChartTarget | undefined;
        if (t && t !== this.host._trendTarget) { this.host._trendTarget = t; this.scheduleClockPaint(); }
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
            if (id !== this._clockDimSeq || (this.host._viewMode !== 'clock' && this.host._viewMode !== 'trend'))
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

    //Trend hour-of-day vectors for the selected metric: P and P-1 totals per hour (summed across the metric's
    //layers), the energy flag (sum vs average), and a ClockData for unit-aware value formatting.
    public trendVectors(): { pH: number[]; prevH: number[]; isE: boolean; data: ClockData | null }
    {
        const target = this.host._trendTarget;
        const dP    = this.host._trendP    ? buildClockDataHourly(this.host, target, this.host._trendP)    : null;
        const dPrev = this.host._trendPrev ? buildClockDataHourly(this.host, target, this.host._trendPrev) : null;
        const isE   = ((dP ?? dPrev)?.unit ?? 'energy') === 'energy';
        const vec = (data: ClockData | null): number[] =>
        {
            const out = new Array<number>(HOURS_PER_DAY).fill(0);
            if (!data) { return out; }
            for (const L of data.layers) { const hv = hourlyOf(L.values, isE); for (let h = 0; h < HOURS_PER_DAY; h++) { out[h] += hv[h]; } }
            return out;
        };
        return { pH: vec(dP), prevH: vec(dPrev), isE, data: dP ?? dPrev };
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
        if (this.host._viewMode !== 'clock' && this.host._viewMode !== 'trend' && this.host._viewMode !== 'day')
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

        //Trend dial: one ring of bars for P, a reference marker per hour at P-1. Both vectors are the selected
        //metric's hour-of-day totals, summed across the metric's layers (import+export, per-source PV, ...).
        if (this.host._viewMode === 'trend')
        {
            const target = this.host._trendTarget;
            const { pH, prevH } = this.trendVectors();
            const frame = projectTrendFrame(
                camera, pH, prevH,
                clockTargetMeta(this.host, target).color, trendGoodDirection(target),
                cardinals, this._clockDimSlot, this._clockDim,
                this.host._clockHomeHover, this.host._nightFrac ?? [],
            );
            this._applyClockFrame(frame);
            return;
        }
        //Day dial: the flat 24-hour ground ring for today, each hour split gold (solar) then import-colour (grid).
        //No bars, no rail, no tooltip: just the base ground ring.
        if (this.host._viewMode === 'day')
        {
            const el          = this.host as unknown as Element;
            const dr          = this.host._dayRing;
            const importColor = ENERGY_COLOR.gridImport(el);
            const batteryColor = ENERGY_COLOR.batteryOut(el);
            //Optimised mode reschedules the shiftable devices into the real solar production (see optimizeDevices).
            const devs        = dr?.devices ?? [];
            const optValues   = this.host._dayOptimized === true ? optimizeDevices(dr?.pv ?? [], devs) : null;
            const rings       = devs.map((dev, i) => ({
                color:    deviceColorByIndex(el, dev.index),
                values:   optValues ? optValues[i] : dev.values,
                segments: dev.segments,
                dailyKwh: dev.dailyKwh,
            }));
            const frame       = projectDayRingFrame(camera, dr?.solar ?? [], dr?.battery ?? [], dr?.grid ?? [], importColor, batteryColor, rings, cardinals, this.host._dayHover ?? -1, dr?.hasSolar ?? false, dr?.hasGrid ?? false, dr?.hasBattery ?? false);
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
    //the clock and trend dials.
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
        if (this.host._viewMode === 'day')
        {
            this._dayHoverMove(e);
            return;
        }
        if ((this.host._viewMode !== 'clock' && this.host._viewMode !== 'trend') || e.pointerType !== 'mouse')
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

    //Day mode: point-in-band hover over the concentric device rings. Sets the hovered ring index (opacity repaint)
    //and the cursor position (tooltip), re-rendering only when it changes or while a ring stays hovered.
    private _dayHoverMove(e: PointerEvent): void
    {
        if (e.pointerType !== 'mouse') { return; }
        const card = this.host._haCard;
        if (!card) { return; }
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let idx: number | null = null;
        const polys = this.host._dayHitPolys;
        for (let i = 0; i < polys.length; i++)
        {
            if (pointInPoly(polys[i].outer, x, y) && !pointInPoly(polys[i].inner, x, y)) { idx = i; break; }
        }
        this.host._dayHoverX = x;
        this.host._dayHoverY = y;
        if (idx !== this.host._dayHover)
        {
            this.host._dayHover = idx;
            this.scheduleClockPaint();
            this.host.requestUpdate();
        }
        else if (idx !== null)
        {
            this.host.requestUpdate();
        }
    }

    //Day-mode hover tooltip, placed at the cursor. The hover id runs producers first (solar, grid, battery -- name +
    //day total) then devices (name, day total, and the solar / grid split of that total).
    public renderDayTooltip(index: number): TemplateResult | typeof nothing
    {
        const dr = this.host._dayRing;
        if (!dr) { return nothing; }
        const el = this.host as unknown as Element;
        const gridColor = ENERGY_COLOR.gridImport(el);
        const batteryColor = ENERGY_COLOR.batteryOut(el);
        const x = (this.host._dayHoverX + 14).toFixed(0);
        const y = this.host._dayHoverY.toFixed(0);
        //Bottom:auto so the cursor `top` wins (the .clock-tip default anchors bottom, which would stretch the box).
        const wrap = (inner: TemplateResult): TemplateResult => html`
            <div class="clock-tip" style="left:${x}px; top:${y}px; bottom:auto">${inner}</div>`;
        //Producer rings, in the same order as their hover ids.
        const producers: { name: string; icon: string; color: string; kwh: number }[] = [];
        if (dr.hasSolar)   { producers.push({ name: 'Solar', icon: 'mdi:white-balance-sunny', color: '#ffc107', kwh: dr.solarKwh }); }
        if (dr.hasGrid)    { producers.push({ name: 'Grid', icon: 'mdi:transmission-tower', color: gridColor, kwh: dr.gridKwh }); }
        if (dr.hasBattery) { producers.push({ name: 'Battery', icon: 'mdi:battery', color: batteryColor, kwh: dr.batteryKwh }); }
        if (index < producers.length)
        {
            const p = producers[index];
            return wrap(html`
                <div class="clock-tip-head">${p.name}</div>
                <div style="display:flex;gap:6px;align-items:center;white-space:nowrap;margin-top:3px">
                    <ha-icon icon=${p.icon} style="--mdc-icon-size:14px;color:${p.color}"></ha-icon>
                    <span>${p.kwh.toFixed(2)} kWh</span>
                </div>`);
        }
        const dev = dr.devices[index - producers.length];
        if (!dev) { return nothing; }
        return wrap(html`
            <div class="clock-tip-head">${dev.name}</div>
            <div style="display:flex;gap:10px;align-items:center;white-space:nowrap;margin-top:3px">
                <span>${dev.dailyKwh.toFixed(2)} kWh</span>
                <span style="color:#ffc107;display:inline-flex;align-items:center;gap:2px"><ha-icon icon="mdi:white-balance-sunny" style="--mdc-icon-size:14px"></ha-icon>${Math.round(dev.solarPct * 100)}%</span>
                <span style="color:${gridColor};display:inline-flex;align-items:center;gap:2px"><ha-icon icon="mdi:transmission-tower" style="--mdc-icon-size:14px"></ha-icon>${Math.round(dev.gridPct * 100)}%</span>
            </div>`);
    }

    public onClockHoverEnd = (e: PointerEvent): void =>
    {
        if (this.host._viewMode === 'day')
        {
            if (this.host._dayHover !== null) { this.host._dayHover = null; this.scheduleClockPaint(); this.host.requestUpdate(); }
            return;
        }
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

    //Touch: remember where the gesture began so a tap can be told from a drag-rotate on release.
    public onClockTapStart = (e: PointerEvent): void =>
    {
        if ((this.host._viewMode !== 'clock' && this.host._viewMode !== 'trend') || e.pointerType === 'mouse')
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

    //Touch release: if the finger barely moved it's a tap, hit-test and toggle a sticky tooltip on the
    //tapped cylinder (or dismiss when tapping empty space). A real drag (moved past the threshold) rotated
    //the camera and is ignored here.
    public onClockTapEnd = (e: PointerEvent): void =>
    {
        if ((this.host._viewMode !== 'clock' && this.host._viewMode !== 'trend') || e.pointerType === 'mouse')
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

    //Trend tooltip for the focused hour: the current period's value, the previous period's value, and their
    //signed delta coloured green/red by whether the change is an improvement for this metric.
    public renderTrendTooltip(slot: number): TemplateResult | typeof nothing
    {
        if (!this.host._trendP && !this.host._trendPrev)
        {
            return nothing;
        }
        const hour = Math.floor(slot / CLOCK_SLOTS_PER_HOUR);
        const head = `${String(hour).padStart(2, '0')}:00 - ${String((hour + 1) % HOURS_PER_DAY).padStart(2, '0')}:00`;
        const target = this.host._trendTarget;
        const meta   = clockTargetMeta(this.host, target);
        //Sum the metric's layers for the focused hour, carrying a ClockData for unit-aware formatting.
        const sumHour = (prof: ClockHourly | null): { v: number; data: ClockData | null } =>
        {
            if (!prof) { return { v: 0, data: null }; }
            const data = buildClockDataHourly(this.host, target, prof);
            const isE  = data.unit === 'energy';
            let v = 0;
            for (const L of data.layers) { v += hourlyOf(L.values, isE)[hour]; }
            return { v, data };
        };
        const p    = sumHour(this.host._trendP);
        const prev = sumHour(this.host._trendPrev);
        const dataFmt = p.data ?? prev.data;
        const fmt = (val: number): string => dataFmt ? formatClockValue(this.host, dataFmt, val) : val.toFixed(1);
        const delta = p.v - prev.v;
        const dir   = trendGoodDirection(target);
        const deltaColor = dir === 0
            ? 'var(--primary-text-color, #212121)'
            : (delta * dir >= 0 ? 'var(--success-color, #2e7d32)' : 'var(--error-color, #c62828)');
        return html`
            <div class="clock-tip">
                <div class="clock-tip-head">${head}</div>
                <div class="clock-tip-row">
                    <ha-icon icon=${meta.icon} style="color:${meta.color}"></ha-icon>
                    <span class="clock-tip-name">${clockTargetLabel(this.host, target)}</span>
                    <span class="clock-tip-val">${fmt(p.v)}</span>
                </div>
                <div class="clock-tip-row">
                    <ha-icon icon="mdi:history" style="color:var(--secondary-text-color)"></ha-icon>
                    <span class="clock-tip-name">P-1</span>
                    <span class="clock-tip-val">${fmt(prev.v)}</span>
                </div>
                <div class="clock-tip-row">
                    <ha-icon icon="mdi:delta" style="color:${deltaColor}"></ha-icon>
                    <span class="clock-tip-name"></span>
                    <span class="clock-tip-val" style="color:${deltaColor}">${delta >= 0 ? '+' : '-'}${fmt(Math.abs(delta))}</span>
                </div>
            </div>
        `;
    }

    //Central-gauge tooltip (trend): the period GLOBAL total P, the previous period P-1, and the signed delta.
    public renderTrendHomeTooltip(): TemplateResult | typeof nothing
    {
        if (!this.host._trendP && !this.host._trendPrev)
        {
            return nothing;
        }
        const { pH, prevH, isE, data } = this.trendVectors();
        const totalOf = (a: number[]): number => { let t = 0; for (const v of a) { t += v; } return isE ? t : t / HOURS_PER_DAY; };
        const tP    = totalOf(pH);
        const tPrev = totalOf(prevH);
        const fmt   = (v: number): string => data ? formatClockValue(this.host, data, v) : v.toFixed(1);
        const delta = tP - tPrev;
        const dir   = trendGoodDirection(this.host._trendTarget);
        const deltaColor = dir === 0
            ? 'var(--primary-text-color, #212121)'
            : (delta * dir >= 0 ? 'var(--success-color, #2e7d32)' : 'var(--error-color, #c62828)');
        const meta = clockTargetMeta(this.host, this.host._trendTarget);
        return html`
            <div class="clock-tip">
                <div class="clock-tip-head">${clockTargetLabel(this.host, this.host._trendTarget)}</div>
                <div class="clock-tip-row">
                    <ha-icon icon=${meta.icon} style="color:${meta.color}"></ha-icon>
                    <span class="clock-tip-name"></span>
                    <span class="clock-tip-val">${fmt(tP)}</span>
                </div>
                <div class="clock-tip-row">
                    <ha-icon icon="mdi:history" style="color:var(--secondary-text-color)"></ha-icon>
                    <span class="clock-tip-name">P-1</span>
                    <span class="clock-tip-val">${fmt(tPrev)}</span>
                </div>
                <div class="clock-tip-row">
                    <ha-icon icon="mdi:delta" style="color:${deltaColor}"></ha-icon>
                    <span class="clock-tip-name"></span>
                    <span class="clock-tip-val" style="color:${deltaColor}">${delta >= 0 ? '+' : '-'}${fmt(Math.abs(delta))}</span>
                </div>
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
