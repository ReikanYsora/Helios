//Detail-mode dashboard panel: the 4-section overlay that fades in
//when the user clicks the home silhouette (today, tomorrow,
//battery), plus the hover handlers that drive the today
//sparkline's tooltip and the home click / exit transitions.
//
//Pure-ish: most exports return TemplateResult or a computed value;
//the handlers mutate dashboard-specific @state on the host. All
//data is pulled through the host structural interface, no direct
//card imports.

import { html, TemplateResult } from 'lit';
import { pickTranslations } from '../i18n';
import type { HeliosEngine } from '../helios-engine';
import { pvNormalizeToWatts } from './pv';
import type { BatteryHost } from './battery';
import { cloudCoverIcon } from './cloud-icons';
import { hasPvConfigured } from './equipment';
import { type ChartHost } from './charts';
import { computeForecastCalibration } from './calibration';
import { sumChangeForDay } from './energy-stats';
import { integrateForecastKwh, forecastCumulativeForDay } from './unifiedStore';
import type { SunScene } from './overlays';
import { renderRadialDial, renderDashCardChipStrip, renderDashCardGraphView, prepareRadialDayData } from './dashboardRadial';


//Structural surface the host card exposes to this module. Includes
//everything ChartHost + BatteryHost require so dashboard renderers
//can also call computeBatteryToday() on the same host, plus the
//dashboard-specific mutable fields the hover / detail handlers
//update.
export interface DashboardHost extends ChartHost, BatteryHost
{
    readonly _engine?:     HeliosEngine;
    readonly _instanceId:  string;
    readonly _sunScene?:   SunScene | null;

    _detailMode:           boolean;
    _homeHover:            boolean;
    //Latches true the first time every started loading phase finishes. The home hitbox click is
    //gated on this so the user cannot open the dashboard mid-boot, only after the engine + map +
    //weather data have settled.
    _loadingHasCompleted:  boolean;
    //Radial dial hover hour, [0..24) when the cursor sits over the SVG, null otherwise. Front card
    //only, the rear cards never wire their pointer handlers.
    _dashRadialHoverHour:  number | null;
    //Mouse wheel accumulator for the radial dial day-navigation gesture. Each tick of a trackpad or
    //a notched wheel adds to the running sum; when the magnitude crosses a threshold the dashboard
    //navigates one day and the accumulator resets. Reset to 0 between dashboard sessions in
    //handleHomeClick. Mutable, not @state, because every wheel event would otherwise trigger a Lit
    //re-render.
    _dashRadialWheelAcc?:  number;
    //setInterval id for the midnight watcher started in handleHomeClick. Polls every 30 s and
    //triggers a re-render the moment the calendar day rolls over so the J-2 / J+2 cards shift to
    //the new "today" without forcing the user to refresh. Cleared in handleExitDetail.
    _dashMidnightTimer?:   number;
    //CoverFlow active day offset: integer in [-2..+2] where 0 = today, -1 = yesterday, +1 = tomorrow, etc. The
    //dashboard renders 5 cards stacked with a 3D perspective effect; this offset picks which one sits at the
    //front. Reset to 0 (today) every time the panel opens via `handleHomeClick`.
    _dashDayOffset:        number;
    //Touch / pointer swipe state, captured on pointerdown and consumed on pointerup. Null between gestures.
    _dashSwipeStartX:      number | null;
    _dashSwipeStartTime:   number;
    //Enter / exit animation phase. 'entering' kicks the staged reveal (front fades in, mid slides out from
    //behind, back slides out from behind mid), 'exiting' replays it backwards. Lasts 1 s total; afterwards the
    //phase flips to 'idle' and the cards sit at their inline-style resting transforms.
    _dashAnimPhase:        'idle' | 'entering' | 'exiting';
    _dashAnimTimer?:       number;
    //Shared view mode across every CoverFlow card. 'radial' keeps the historical chip strip + radial
    //sundial layout, 'graph' replaces both with a single full-height graph block. Toggled from the
    //bandeau on the front card, the flip applies to every card simultaneously so the user reads the
    //same vocabulary on yesterday + today + tomorrow at every swipe.
    _dashViewMode:         'radial' | 'graph';
    //Unified 5-day data store. Source of truth for every per-time signal the dashboard reads. Built
    //by the card on every Lit update cycle when the underlying source arrays change, sliced here per
    //card via the unifiedStore.sliceForDay helper.
    readonly _unifiedStore: import('./unifiedStore').UnifiedDataStore | null;
}


//Day-integrated CORRECTED forecast kWh (the "→ X kWh affiné" headline). Reads the unified store's
//`forecast` series, the single forecast pipeline (LiDAR + GTI + thermal + snow + learned sky-residual
//map), so the dashboard figure equals the timeline curve and the day-strip chips to the watt-hour.
//No local model loop here. Returns null when the store isn't built yet or no bucket carried a value.
export function computeRefinedDailyKwh(host: DashboardHost, dayStartMs: number, dayEndMs: number): number | null
{
    const store = host._unifiedStore;
    if (!store) { return null; }
    return integrateForecastKwh(store, dayStartMs, dayEndMs, false);
}


export function renderDashboard(host: DashboardHost): TemplateResult
{
    //CoverFlow skeleton: 5 cards on a 3D perspective stage. Offsets [-2..+2] map to (avant-hier, hier, today,
    //demain, après-demain). The currently focused card is `host._dashDayOffset` (reset to 0 on each open).
    //Cards render with translateX + rotateY + scale + opacity transitions so navigating glides them through the
    //stack. Content is intentionally minimal for now (just the date); the user will iterate on the per-day
    //payload once the perspective + animation feel is dialled in.
    const DAY_OFFSETS = [-2, -1, 0, 1, 2];
    const active = clampDayOffset(host._dashDayOffset ?? 0);

    const animClass = host._dashAnimPhase === 'entering' ? 'dash-cf-entering'
                    : host._dashAnimPhase === 'exiting'  ? 'dash-cf-exiting'
                    : '';

    return html`
        <div class="detail-panel">
            <div class="dash-coverflow"
                 @pointerdown="${(e: PointerEvent) => handleDashSwipeStart(host, e)}"
                 @pointerup="${(e: PointerEvent) => handleDashSwipeEnd(host, e)}"
                 @pointercancel="${() => handleDashSwipeCancel(host)}"
                 @keydown="${(e: KeyboardEvent) => handleDashKey(host, e)}"
                 tabindex="0"
            >
                <div class="dash-cf-stage ${animClass}">
                    ${DAY_OFFSETS.map(offset => renderCoverflowCard(host, offset, active))}
                </div>
            </div>
        </div>
    `;
}


//Clamp the day offset to the rendered range so external nudges (keyboard end-of-bounds, programmatic
//navigation) cannot land the active card outside the [-2..+2] window.
function clampDayOffset(offset: number): number
{
    if (offset < -2) return -2;
    if (offset >  2) return  2;
    return offset;
}


//Per-day stats for the CoverFlow cards. Returns the produced kWh (from HA Energy / LTS recorder), the forecast
//kWh + refined forecast kWh (via the 5-day calibration ratio), and a weighted average cloud coverage used by
//the bandeau weather glyph.
//
//Production:
//  - today (offset 0): prefer `_haSolarTodayKwh` (recorder day total). Fallback to integration of `_pvHistory`.
//  - past (offset < 0): integrate `_pvCalibStats` (hourly LTS) over the day window. Power entities use a
//    trapezoidal mean over the hourly samples, cumulative entities use the first-to-last delta within the day.
//  - future (offset > 0): zero (no production data yet).
//Forecast:
//  - any day: walk `_chartSeries` over the day window, multiply each step by `pvCalibK` to get watts, sum to kWh.
//Refined forecast:
//  - `computeRefinedDailyKwh` (calibration ratio + shading map) when calibration is available, else null.
function computeDayStats(host: DashboardHost, dayOffset: number): {
    producedKwh: number;
    forecastKwh: number;
    refinedKwh:  number | null;
    avgCloud:    number;
}
{
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() + dayOffset);
    const dayEnd   = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayStartMs = dayStart.getTime();
    const dayEndMs   = dayEnd.getTime();

    //Production
    let producedKwh = 0;
    if (dayOffset === 0)
    {
        const haKwh = host._haSolarTodayKwh ?? null;
        if (haKwh !== null)
        {
            producedKwh = Math.max(0, haKwh);
        }
        else
        {
            const cum = computeTodayCumulative(host);
            producedKwh = cum.actualSamples.length > 0
                ? Math.max(0, cum.actualSamples[cum.actualSamples.length - 1].kwh)
                : 0;
        }
    }
    else if (dayOffset < 0)
    {
        //Past day: sum the recorder `change` buckets over the day so the produced kWh matches the HA
        //Energy dashboard exactly, no curve integration. The change series spans the store's J-2 past
        //window, which covers every past day the CoverFlow can scroll to.
        const kwh = sumChangeForDay(host._pvChangeSeries, dayStartMs, dayEndMs);
        if (kwh !== null)
        {
            producedKwh = Math.max(0, kwh);
        }
    }

    //Forecast (raw / "PRÉVU") + cloud average, both from the unified store so they match the timeline.
    //forecastKwh is the uncorrected physical model integral; the corrected "affiné" figure comes from
    //computeRefinedDailyKwh below. Cloud is averaged weighted by the raw forecast watts so daylight
    //hours dominate the glyph (a cloudy midnight doesn't skew it).
    let forecastKwh = 0;
    let cloudSum    = 0;
    let cloudWeight = 0;
    const store = host._unifiedStore;
    if (store)
    {
        const rawKwh = integrateForecastKwh(store, dayStartMs, dayEndMs, true);
        forecastKwh  = rawKwh ?? 0;
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const mid = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (mid < dayStartMs || mid >= dayEndMs) { continue; }
            const cloud = store.cloud[i];
            if (cloud === null || !isFinite(cloud)) { continue; }
            const w = store.forecastRaw[i];
            const weight = (w !== null && isFinite(w) && w > 0) ? w : 1;
            cloudSum    += cloud * weight;
            cloudWeight += weight;
        }
    }
    const avgCloud = cloudWeight > 0 ? cloudSum / cloudWeight : 0;

    //Refined forecast
    const calibration = computeForecastCalibration(host);
    const refinedKwh  = calibration !== null
        ? computeRefinedDailyKwh(host, dayStartMs, dayEndMs)
        : null;

    return { producedKwh, forecastKwh, refinedKwh, avgCloud };
}


//Render a single CoverFlow card. The transform is driven by the delta between the card's day offset and the
//currently active offset: 0 = front, ±1 = mid (rotated 35°), ±2 = back (rotated 50°). Z-index ordering keeps the
//front card on top of its neighbours regardless of stacking order in the DOM. Opacity fades the back cards so
//they read as background context rather than competing for the user's attention.
function renderCoverflowCard(
    host:         DashboardHost,
    cardOffset:   number,
    activeOffset: number,
): TemplateResult
{
    const delta    = cardOffset - activeOffset;
    const absDelta = Math.abs(delta);
    const sign     = delta < 0 ? -1 : delta > 0 ? 1 : 0;
    //Offsets expressed as a PERCENT of the card's own width so the fan adapts to the container size. Front
    //card is now sized to fill ~90 % of the stage, so the side translation + scale of the back cards is
    //pulled tighter (the previous 50 / 80 % offsets sent the back cards off-screen on the new, bigger
    //front card layout).
    const txPct    = sign * (absDelta === 1 ? 32 : absDelta === 2 ? 50 : 0);
    const scale    = absDelta === 0 ? 1 : absDelta === 1 ? 0.74 : 0.58;
    //rotateY restored on the side cards now that the true blur source (backdrop-filter on .dash-cf-card
    //::after) is gone. The 3D context still rasterises side cards but the FRONT card has no 3D transform
    //in its own transform list (rotY = 0 below), so it stays sharp.
    const rotY     = sign * (absDelta === 1 ? 22 : absDelta === 2 ? 38 : 0);
    const zIdx     = 10 - absDelta;
    const opacity  = 1;
    const isFront  = absDelta === 0;
    //Perspective-driven gradient blur: each side card gets a ::after overlay (CSS rule keyed off the data-delta
    //attribute) that backdrop-blurs the half of the card facing AWAY from the centre, while leaving the half
    //facing TOWARDS the centre sharp. The data-delta value lets the CSS pick the right gradient direction +
    //blur strength.
    const deltaAttr = delta;

    //Date label: this card represents `today + cardOffset` days. Computed off a fresh midnight Date so day
    //rollover at midnight does not leave a stale offset cached. Full weekday + day + month format,
    //text-transform: capitalize on the rendered span turns the locale's lowercase output (e.g. fr "mercredi 4
    //juin") into "Mercredi 4 Juin" without us coding locale-specific capitalisation rules.
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + cardOffset);
    const haLanguage = (host.hass?.language as string | undefined) || undefined;
    //Two formats so the bandeau can swap based on container width via @container query in CSS. Long format is
    //the default; short (day + abbreviated month) kicks in on tight sections where the long string would
    //overflow. Both are localised via Intl so the order + abbreviation follow the HA frontend's language.
    const dateLabelLong  = new Intl.DateTimeFormat(haLanguage, {
        weekday: 'long',
        day:     'numeric',
        month:   'long',
    }).format(d);
    const dateLabelShort = new Intl.DateTimeFormat(haLanguage, {
        day:   'numeric',
        month: 'short',
    }).format(d);

    const tLocal = pickTranslations(host.hass?.language);
    const friendlyLabel = cardOffset === -2 ? (tLocal.detail.dayLabelDayBefore ?? '2 days ago')
                        : cardOffset === -1 ? (tLocal.detail.dayLabelYesterday ?? 'Yesterday')
                        : cardOffset ===  0 ? (tLocal.detail.dayLabelToday     ?? 'Today')
                        : cardOffset ===  1 ? (tLocal.detail.dayLabelTomorrow  ?? 'Tomorrow')
                        :                     (tLocal.detail.dayLabelDayAfter  ?? 'In 2 days');

    //Centring is handled by the parent CSS grid (place-items: center on .dash-cf-stage). The front card
    //needs NO transform at all = sharp on every browser including Safari. The side cards add perspective
    //+ translateX + scale + rotateY to fan them out from the centre.
    const transformParts: string[] = [];
    if (rotY !== 0)
    {
        transformParts.push('perspective(2400px)');
    }
    if (txPct !== 0)
    {
        transformParts.push(`translateX(${txPct}%)`);
    }
    if (scale !== 1)
    {
        transformParts.push(`scale(${scale})`);
    }
    if (rotY !== 0)
    {
        transformParts.push(`rotateY(${rotY}deg)`);
    }
    if (transformParts.length === 0)
    {
        transformParts.push('none');
    }
    const style = `transform: ${transformParts.join(' ')}; z-index: ${zIdx}; opacity: ${opacity};`;

    const t = pickTranslations(host.hass?.language);

    //Per-day stats for the production / forecast block.
    const stats = computeDayStats(host, cardOffset);
    const weatherIcon = cloudCoverIcon(stats.avgCloud);

    //Shared per-card data bundle, computed once and threaded into both the radial dial and the
    //top chip strip so the hourly aggregation only runs once per card per render.
    const radialData = prepareRadialDayData(host, cardOffset);


    //Shared view mode for every card in the stack. Click on the toggle in any card's bandeau flips
    //the mode for the whole CoverFlow. The graph view shows the production curve, so the toggle
    //only makes sense (and only renders) when PV is configured. When the user has no PV wired the
    //view is locked to radial regardless of the persisted mode, so a previously-saved 'graph'
    //value doesn't strand the user on an empty chart after they remove their PV source.
    const hasPv         = hasPvConfigured(host);
    const viewMode      = hasPv ? (host._dashViewMode ?? 'radial') : 'radial';
    const nextViewMode  = viewMode === 'radial' ? 'graph' : 'radial';
    const viewToggleIcon  = viewMode === 'radial' ? 'mdi:radar' : 'mdi:chart-line';
    const viewToggleLabel = viewMode === 'radial'
        ? (t.detail.dashViewRadialLabel ?? 'Radial view')
        : (t.detail.dashViewGraphLabel  ?? 'Graph view');
    const onToggleView = (e: Event): void =>
    {
        e.stopPropagation();
        host._dashViewMode = nextViewMode;
        host.requestUpdate();
    };

    return html`
        <article
            class="dash-cf-card ${isFront ? 'dash-cf-card-front' : ''} dash-cf-view-${viewMode}"
            style="${style}"
            data-day-offset="${cardOffset}"
            data-delta="${deltaAttr}"
            @click="${(e: Event) => { if (!isFront) { e.stopPropagation(); navigateDashDay(host, cardOffset); } }}"
        >
            <ha-card class="dash-cf-card-bandeau">
                <span class="dash-cf-card-bandeau-leading">
                    <span class="dash-cf-card-weather-chip" aria-hidden="true">
                        <ha-icon icon="${weatherIcon}"></ha-icon>
                    </span>
                    ${isFront && hasPv ? html`
                        <button
                            class="dash-cf-view-toggle dash-cf-view-toggle-${viewMode}"
                            type="button"
                            @click="${onToggleView}"
                            aria-label="${viewToggleLabel}"
                            title="${viewToggleLabel}"
                        >
                            <ha-icon icon="${viewToggleIcon}"></ha-icon>
                        </button>
                    ` : html`
                        <span class="dash-cf-view-toggle-spacer" aria-hidden="true"></span>
                    `}
                </span>
                <span class="dash-cf-card-bandeau-center">
                    <ha-icon class="dash-cf-card-cal-icon" icon="mdi:calendar"></ha-icon>
                    <span class="dash-cf-card-date dash-cf-card-date-long">${dateLabelLong}</span>
                    <span class="dash-cf-card-date dash-cf-card-date-short">${dateLabelShort}</span>
                    <span class="dash-cf-card-day-chip">${friendlyLabel}</span>
                </span>
                ${isFront ? html`
                    <button
                        class="dash-cf-close-btn"
                        @click="${(e: Event) => handleExitDetail(host, e)}"
                        aria-label="${t.detail.exitHint}"
                    >
                        <ha-icon icon="mdi:close"></ha-icon>
                    </button>
                ` : html`
                    <span class="dash-cf-card-bandeau-spacer" aria-hidden="true"></span>
                `}
            </ha-card>

            ${viewMode === 'radial' ? html`
                ${renderDashCardChipStrip(host, cardOffset, activeOffset, radialData)}
                ${renderRadialDial(host, cardOffset, activeOffset, radialData)}
            ` : html`
                ${renderDashCardGraphView(host, cardOffset, activeOffset, radialData)}
            `}
        </article>
    `;
}


//Day-offset navigation. Clamps to the [-2..+2] window and triggers a Lit re-render via requestUpdate so the
//transforms animate from the previous active offset to the new one. Swallowed during the enter / exit
//animation window so an in-flight fade cannot navigate mid-animation.
export function navigateDashDay(host: DashboardHost, nextOffset: number): void
{
    if (host._dashAnimPhase !== 'idle')
    {
        return;
    }
    const next = clampDayOffset(nextOffset);
    if (next === host._dashDayOffset)
    {
        return;
    }
    host._dashDayOffset = next;
    //Drop the hover hour on every card change. Without this, a cursor parked on the previous day's
    //radial would bleed onto the next card and read as "this hour" until the user moves the pointer
    //again, which is especially confusing on touch where there's no implicit pointermove to clear
    //the stale hover.
    host._dashRadialHoverHour = null;
    (host as unknown as { requestUpdate(): void }).requestUpdate();
}


//Pointer swipe handlers (mobile + trackpad). Capture clientX on pointerdown, compare on pointerup. A horizontal
//motion > 50 px within 500 ms triggers a day-step in the swipe direction. Vertical swipes are ignored so
//scrolling the page above the panel still works.
export function handleDashSwipeStart(host: DashboardHost, e: PointerEvent): void
{
    host._dashSwipeStartX    = e.clientX;
    host._dashSwipeStartTime = performance.now();
}


export function handleDashSwipeEnd(host: DashboardHost, e: PointerEvent): void
{
    if (host._dashSwipeStartX === null)
    {
        return;
    }
    const dx = e.clientX - host._dashSwipeStartX;
    const dt = performance.now() - host._dashSwipeStartTime;
    host._dashSwipeStartX = null;
    if (Math.abs(dx) > 50 && dt < 500)
    {
        //Swipe LEFT (dx < 0) = next day; swipe RIGHT (dx > 0) = previous day. Mirrors the natural "drag the
        //next-day card into view from the right edge" gesture.
        const active = host._dashDayOffset ?? 0;
        navigateDashDay(host, active + (dx < 0 ? 1 : -1));
    }
}


export function handleDashSwipeCancel(host: DashboardHost): void
{
    host._dashSwipeStartX = null;
}


//Keyboard navigation as a bonus for desktop users.
export function handleDashKey(host: DashboardHost, e: KeyboardEvent): void
{
    const active = host._dashDayOffset ?? 0;
    if (e.key === 'ArrowLeft')
    {
        e.preventDefault();
        navigateDashDay(host, active - 1);
    }
    else if (e.key === 'ArrowRight')
    {
        e.preventDefault();
        navigateDashDay(host, active + 1);
    }
    else if (e.key === 'Escape')
    {
        e.preventDefault();
        handleExitDetail(host, e);
    }
}


//Global document-level keydown so ESC closes the dashboard regardless of which element currently has
//focus. Bound in `connectedCallback` on the host card + unbound in `disconnectedCallback`. The handler
//is a no-op when the dashboard is not open so the listener is cheap to keep around.
export function handleDashGlobalKey(host: DashboardHost, e: KeyboardEvent): void
{
    if (e.key !== 'Escape')
    {
        return;
    }
    if (!host._detailMode)
    {
        return;
    }
    e.preventDefault();
    handleExitDetail(host, e);
}


//Computes hourly production for today, splitting observed (past
//+ now) from forecast (now → midnight). Returns one bin per hour
//of the day [0..23], with watts at the hour's midpoint. Bins
//missing observed data fall back to the forecast value where
//available; truly empty bins (no kWp configured + before sensor
//has started) get 0 W.




//Two time-ordered cumulative production curves for today's chart.
//`actualSamples` is the observed history integrated from midnight
//up to the latest sample (or "now" if the entity went quiet for
//a few minutes). `predictedSamples` is the pure forecast model
//(kWp × clear-sky × cloud) integrated hour by hour from midnight
//to midnight, regardless of "now", so the user can compare what
//was predicted at each past hour against what was actually
//produced. Both curves share the same Y scale via `maxKwh`.
export function computeTodayCumulative(host: DashboardHost): {
    actualSamples:    Array<{ tMs: number; kwh: number }>;
    predictedSamples: Array<{ tMs: number; kwh: number }>;
    pastEndMs:        number;
    maxKwh:           number;
}
{
    const HOUR_MS = 3_600_000;
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const tomorrow0 = new Date(today0);
    tomorrow0.setDate(tomorrow0.getDate() + 1);
    const startMs = today0.getTime();
    const endMs   = tomorrow0.getTime();
    const nowMs   = Date.now();

    const actualSamples: Array<{ tMs: number; kwh: number }> = [];
    actualSamples.push({ tMs: startMs, kwh: 0 });

    let actualKwh = 0;
    let pastEndMs = startMs;

    //Actual: integrate observed history. Cumulative-energy sensors
    //get a baseline-subtracted reading per sample; power sensors
    //get trapezoidal integration over consecutive pairs.
    const hist = host._pvHistory;
    const calib = host._pvCalibStats;
    const unit = (host._pvUnit || '').toLowerCase();
    const isCumulativeEnergy = unit === 'wh' || unit === 'kwh' || unit === 'mwh';
    const energyFactor = unit === 'wh' ? 1 / 1000
                       : unit === 'mwh' ? 1000
                       : 1;

    //Merge LTS calib (hourly, covers 5 days) into the raw history's morning gap. The raw fetch
    //is capped at the last 6 h of wall-clock time on purpose (HA recorder is single-threaded
    //behind SQLite, multi-day raw scans on a 1 Hz Victron block every other card reading the
    //same entity), so any production that happened before `now - 6 h` reaches the dashboard
    //via the 5-day LTS samples carried in `_pvCalibStats`. Pre-rolling those samples into the
    //integration keeps the morning portion of the cumulative chart aligned with HA Energy.
    //The raw window owns the present tail (it has full sample resolution there); LTS samples
    //are dropped once they cross into the raw window's first timestamp.
    const rawFirstMs = hist && hist.times.length > 0 ? hist.times[0].getTime() : Infinity;
    const mergedTimes:  Date[]   = [];
    const mergedValues: number[] = [];
    if (calib && calib.times.length > 0)
    {
        for (let i = 0; i < calib.times.length; i++)
        {
            const tMs = calib.times[i].getTime();
            if (tMs < startMs || tMs >= endMs)
            {
                continue;
            }
            //Drop LTS rows once they cross into the raw window, the raw fetch carries the live tail at full
            //resolution and would paint over the coarse LTS samples anyway.
            if (tMs >= rawFirstMs)
            {
                continue;
            }
            const v = calib.values[i];
            if (!isFinite(v))
            {
                continue;
            }
            mergedTimes.push(calib.times[i]);
            mergedValues.push(v);
        }
    }
    if (hist && hist.times.length > 0)
    {
        for (let i = 0; i < hist.times.length; i++)
        {
            const tMs = hist.times[i].getTime();
            if (tMs < startMs || tMs >= endMs)
            {
                continue;
            }
            mergedTimes.push(hist.times[i]);
            mergedValues.push(hist.values[i]);
        }
    }

    if (mergedTimes.length > 0)
    {
        let baseline: number | null = null;
        let prevT:    number | null = null;
        let prevW:    number | null = null;

        for (let i = 0; i < mergedTimes.length; i++)
        {
            const tMs = mergedTimes[i].getTime();

            if (isCumulativeEnergy)
            {
                const v = mergedValues[i] * energyFactor;
                if (baseline === null)
                {
                    baseline = v;
                }
                //Mid-day counter reset (sensor restart, integration nodered restart, daily-reset utility-meter): the
                //raw value drops below the baseline. Snap the baseline so the cumulative day-kwh stays monotonic from
                //the last known total, otherwise every post-reset sample reads as a fresh baseline and the day total
                //jumps backward by the full pre-reset production.
                if (v < baseline)
                {
                    baseline = v - actualKwh;
                }
                const kwh = Math.max(0, v - baseline);
                actualSamples.push({ tMs, kwh });
                actualKwh = kwh;
            }
            else
            {
                const w = pvNormalizeToWatts(mergedValues[i], host._pvUnit);
                if (!isFinite(w))
                {
                    continue;
                }
                if (prevT !== null && prevW !== null)
                {
                    const dh = (tMs - prevT) / HOUR_MS;
                    if (dh > 0 && dh <= 6)
                    {
                        actualKwh += ((prevW + w) / 2) / 1000 * dh;
                    }
                }
                actualSamples.push({ tMs, kwh: actualKwh });
                prevT = tMs;
                prevW = w;
            }
            pastEndMs = tMs;
        }
    }

    //Anchor the actual line at "now" so the curve ends precisely at the present moment, instead of stopping at the last sample which could be a
    //minute or two stale.
    if (pastEndMs < nowMs && nowMs < endMs)
    {
        actualSamples.push({ tMs: nowMs, kwh: actualKwh });
        pastEndMs = nowMs;
    }

    //Predicted: running cumulative of the unified store's CORRECTED forecast over the whole day (no
    //"now" filter), so the curve matches the timeline's dotted forecast and the headline "affiné" total
    //to the watt-hour. No local model loop.
    const store = host._unifiedStore;
    const predictedSamples = store
        ? forecastCumulativeForDay(store, startMs, endMs)
        : [{ tMs: startMs, kwh: 0 }];

    let maxKwh = 0;
    for (const s of actualSamples)    if (s.kwh > maxKwh)
    {
        maxKwh = s.kwh;
    }
    for (const s of predictedSamples) if (s.kwh > maxKwh)
    {
        maxKwh = s.kwh;
    }

    return { actualSamples, predictedSamples, pastEndMs, maxKwh };
}


//(tomorrow hasn't happened yet).





//Detail-mode toggles. Driven by the home click (off → on) and a
//click anywhere on the detail panel (on → off). The engine
//handles the eased camera transition; we just flip the state
//and let the CSS .detail-active class fade out the overlays.
export function handleHomeClick(host: DashboardHost, e: Event): void
{
    //Stop propagation so the underlying map doesn't also process the click as a pan / drag start, and so nested overlay layers don't double-handle
    //it.
    e.stopPropagation();
    if (host._detailMode) { return; }
    //Loading guard: don't open the dashboard while the engine + map + weather data are still
    //settling. Opening mid-boot would render empty cards with "—" everywhere and the user would
    //see numbers populating one by one as each phase completes, looks broken. The hitbox stays
    //clickable from a hit-detection standpoint but the open is a no-op until the loader latches.
    if (!host._loadingHasCompleted) { return; }
    //Clear the hover flag immediately, the hitbox un-renders
    //once detail mode opens so mouseleave never fires; without
    //this the glow would flash back on as soon as the user
    //exits detail mode and the hitbox re-appears.
    host._homeHover  = false;
    host._detailMode = true;
    //Always re-centre on today when the panel opens, even if the user closed it on a different day mid-swipe.
    host._dashDayOffset = 0;
    host._dashSwipeStartX = null;
    //Kick the staged enter animation. Phase 'entering' lasts 1 s, after which the cards settle into their
    //resting transforms. A guard against re-entrance during the animation window is unnecessary because the
    //timer below cancels any in-flight one when the panel re-opens.
    if (host._dashAnimTimer !== undefined)
    {
        window.clearTimeout(host._dashAnimTimer);
    }
    host._dashAnimPhase = 'entering';
    host._dashAnimTimer = window.setTimeout(() =>
    {
        host._dashAnimPhase = 'idle';
        host._dashAnimTimer = undefined;
        (host as unknown as { requestUpdate(): void }).requestUpdate();
    }, 1000);
    host._engine?.setDetailMode(true);
    //Invalidate the refresh-gate cache so the next render runs the full chain (refreshGrid +
    //refreshBattery + refreshPv) immediately. Without this, opening the dashboard right after a page load
    //could leave the grid samples buffer empty if the previous render's gate held the cached refs.
    const h = host as unknown as {
        _lastRefreshHassRef?:           unknown;
        _lastRefreshConfigRef?:         unknown;
        _lastRefreshTimeRangeRef?:      unknown;
        _lastRefreshEnergyDefaultsRef?: unknown;
    };
    h._lastRefreshHassRef           = undefined;
    h._lastRefreshConfigRef         = undefined;
    h._lastRefreshTimeRangeRef      = undefined;
    h._lastRefreshEnergyDefaultsRef = undefined;
    (host as unknown as { requestUpdate(): void }).requestUpdate();
    //Midnight watcher: if the day rolls over while the dashboard is open, regenerate the five
    //CoverFlow cards so the J-2 .. J+2 dates shift to the new "today" without forcing the user to
    //refresh. Polls every 30 s, compares the day-start ms snapshot we captured here against the
    //live "now"; on a mismatch we trigger a Lit re-render and the date helpers inside
    //renderCoverflowCard pick up the new calendar day naturally. Cleared on handleExitDetail.
    if (host._dashMidnightTimer !== undefined)
    {
        window.clearInterval(host._dashMidnightTimer);
    }
    let lastDayStartMs = new Date().setHours(0, 0, 0, 0);
    host._dashMidnightTimer = window.setInterval(() =>
    {
        const todayStartMs = new Date().setHours(0, 0, 0, 0);
        if (todayStartMs !== lastDayStartMs)
        {
            lastDayStartMs = todayStartMs;
            (host as unknown as { requestUpdate(): void }).requestUpdate();
        }
    }, 30_000);
}


export function handleExitDetail(host: DashboardHost, e: Event): void
{
    e.stopPropagation();
    if (!host._detailMode) { return; }
    if (host._dashAnimPhase === 'exiting')
    {
        return;
    }
    //Re-centre on today first if the user is sitting on a different day, so the exit animation always plays
    //from the canonical front=today state. The transform transition (420 ms) on each card runs concurrently;
    //we delay the staged fade-out by that much so the cards do not start fading before they have reached
    //their resting position. When already on today, no re-centre delay.
    const TRANSFORM_TRANSITION_MS = 420;
    const recenterDelay = host._dashDayOffset !== 0 ? TRANSFORM_TRANSITION_MS : 0;
    if (recenterDelay > 0)
    {
        host._dashDayOffset = 0;
        (host as unknown as { requestUpdate(): void }).requestUpdate();
    }
    if (host._dashAnimTimer !== undefined)
    {
        window.clearTimeout(host._dashAnimTimer);
    }
    if (host._dashMidnightTimer !== undefined)
    {
        window.clearInterval(host._dashMidnightTimer);
        host._dashMidnightTimer = undefined;
    }
    host._dashAnimTimer = window.setTimeout(() =>
    {
        host._dashAnimPhase = 'exiting';
        (host as unknown as { requestUpdate(): void }).requestUpdate();
        host._dashAnimTimer = window.setTimeout(() =>
        {
            host._detailMode    = false;
            host._dashAnimPhase = 'idle';
            host._dashAnimTimer = undefined;
            host._engine?.setDetailMode(false);
            (host as unknown as { requestUpdate(): void }).requestUpdate();
        }, 1000);
    }, recenterDelay);
}


