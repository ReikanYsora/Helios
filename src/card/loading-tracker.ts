//Single source of truth for "is the card still hydrating its data layer". _loadingPhases holds
//per-phase state; _loadingHasCompleted latches once every registered phase is `done` for the FIRST
//time so the banner never re-shows on routine refreshes (mode change, timeline scrub, etc).
//
//Each data-fetch entry point maps to ONE phase id below: call beginLoadingPhase at start and
//endLoadingPhase at completion (success OR failure). Phases register lazily, so a user with no LiDAR
//or no battery sensor never sees those phases counted.
//
//Banner UX: visible from the first phase start until every registered phase is done, then fades out
//(slide-up + opacity) and stays hidden for the card lifetime so background refreshes never reflash
//it. Themed to match the rest of the HUD chrome.

import { html, nothing, type TemplateResult } from 'lit';
import { pickTranslations } from '../i18n';


//Phases the tracker knows about. Adding one here + wiring its begin/end calls is the whole
//integration surface; the banner aggregates automatically. Kebab-case to read like log identifiers.
export type LoadingPhaseId =
    | 'energy-prefs'
    | 'pv-history'
    | 'pv-change-series'
    | 'solar-forecast'
    | 'battery-history'
    | 'grid-history'
    | 'solar-radiation'
    | 'ha-daily-totals'
    | 'weather-forecast'
    | 'buildings'
    | 'lidar-raster'
    | 'lidar-exposure';


export interface LoadingPhaseState
{
    started: boolean;
    done:    boolean;
}


//Host surface. Phases map + latch flag are @state on the card so mutations re-render the banner.
export interface LoadingTrackerHost
{
    //Untyped to match the rest of the codebase (hass is `any` across module boundaries).
    readonly hass?:           { language?: string } | undefined;
    _loadingPhases:           ReadonlyMap<LoadingPhaseId, LoadingPhaseState>;
    _loadingHasCompleted:     boolean;
    requestUpdate():          void;
}


//Begin a phase. Idempotent (already started/done stays as-is); no-op once latched so background
//refreshes do NOT bring the banner back.
export function beginLoadingPhase(host: LoadingTrackerHost, id: LoadingPhaseId): void
{
    if (host._loadingHasCompleted)
    {
        return;
    }
    const existing = host._loadingPhases.get(id);
    if (existing && (existing.started || existing.done))
    {
        return;
    }
    const next = new Map(host._loadingPhases);
    next.set(id, { started: true, done: false });
    host._loadingPhases = next;
    host.requestUpdate();
}


//Mark a phase done and latch _loadingHasCompleted once every started phase is done. The latch is the
//ONLY thing that stops the banner, so any phase that begins MUST eventually end (success or failure)
//or the banner stays stuck.
export function endLoadingPhase(host: LoadingTrackerHost, id: LoadingPhaseId): void
{
    if (host._loadingHasCompleted)
    {
        return;
    }
    const existing = host._loadingPhases.get(id);
    if (!existing || existing.done)
    {
        return;
    }
    const next = new Map(host._loadingPhases);
    next.set(id, { started: true, done: true });
    host._loadingPhases = next;
    let allDone = next.size > 0;
    for (const state of next.values())
    {
        if (!state.done) { allDone = false; break; }
    }
    if (allDone)
    {
        host._loadingHasCompleted = true;
    }
    host.requestUpdate();
}


//Aggregate progress in [0, 1] (done / started), 0 before any phase begins to avoid NaN. Purely
//informational; banner visibility is controlled by isLoadingBannerVisible, not this value.
export function loadingAggregateProgress(host: LoadingTrackerHost): number
{
    if (host._loadingPhases.size === 0)
    {
        return 0;
    }
    let doneCount = 0;
    for (const state of host._loadingPhases.values())
    {
        if (state.done) { doneCount++; }
    }
    return doneCount / host._loadingPhases.size;
}


//True while the banner should be drawn: false before the first phase and after the latch, true in
//between.
export function isLoadingBannerVisible(host: LoadingTrackerHost): boolean
{
    if (host._loadingHasCompleted)
    {
        return false;
    }
    return host._loadingPhases.size > 0;
}


//Diagnostic surface (window.heliosStats() etc): [phase, state] pairs in registration order to see
//which phase is blocking the banner.
export function loadingPhasesSnapshot(host: LoadingTrackerHost): Array<{ id: LoadingPhaseId; started: boolean; done: boolean }>
{
    const out: Array<{ id: LoadingPhaseId; started: boolean; done: boolean }> = [];
    for (const [id, state] of host._loadingPhases)
    {
        out.push({ id, started: state.started, done: state.done });
    }
    return out;
}


//Render the loading banner. Always emitted (so the slide-out transition can fire when visibility
//flips false), gated by the .is-visible class for on-screen presence.
export function renderLoadingBanner(host: LoadingTrackerHost): TemplateResult | typeof nothing
{
    const visible    = isLoadingBannerVisible(host);
    const progress   = loadingAggregateProgress(host);
    const t          = pickTranslations(host.hass?.language);
    const label      = t.detail.loadingLabel;
    const activeCls  = visible ? ' is-visible' : '';
    //aria-hidden mirrors visibility so SRs stop announcing it once slid out; aria-live=polite
    //announces the label at first appearance and on integer percentage changes, not every update.
    return html`
        <div
            class="loading-banner${activeCls}"
            role="status"
            aria-live="polite"
            ?aria-hidden="${!visible}"
        >
            <div class="loading-banner-label">${label}</div>
            <div class="loading-banner-bar" aria-hidden="true">
                <div
                    class="loading-banner-bar-fill"
                    style="width: ${(progress * 100).toFixed(1)}%"
                ></div>
            </div>
        </div>
    `;
}


export interface WeatherRateLimitHost
{
    readonly hass?:        { language?: string } | undefined;
    _weatherRateLimited:   boolean;
}


//Alert banner under the loading banner while the Open-Meteo home-point fetch is in HTTP 429 back-off.
//Stacks below it with matching width/centering, themed with --error-color. Hidden on the next
//successful fetch.
export function renderWeatherRateLimitBanner(host: WeatherRateLimitHost): TemplateResult | typeof nothing
{
    const t        = pickTranslations(host.hass?.language);
    const title    = t.detail.weatherRateLimitTitle   ?? 'OpenMeteo: rate limit';
    const message  = t.detail.weatherRateLimitMessage ?? 'Too many requests, please wait';
    const visible  = host._weatherRateLimited;
    const cls      = visible ? ' is-visible' : '';
    return html`
        <div
            class="weather-rate-limit-banner${cls}"
            role="status"
            aria-live="polite"
            ?aria-hidden="${!visible}"
        >
            <div class="weather-rate-limit-banner-title">${title}</div>
            <div class="weather-rate-limit-banner-message">${message}</div>
        </div>
    `;
}
