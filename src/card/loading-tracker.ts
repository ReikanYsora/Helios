//Single source of truth for "is the card still hydrating its data layer". One @state field
//(_loadingPhases) on the card holds the per-phase state, one derived @state (_loadingHasCompleted)
//latches once every registered phase has reached `done` for the FIRST TIME so the banner never
//re-shows on subsequent routine refreshes (user clicks another mode, scrubs the timeline, etc).
//
//Every data-fetch entry point in the card maps to ONE phase id below. The refresh / fetch functions
//call beginLoadingPhase at start and endLoadingPhase at completion (success OR failure), no other
//coordination is needed. Phases are registered lazily, so a user with no LiDAR or no battery sensor
//never sees those phases counted toward the aggregate.
//
//Banner UX:
//- Visible from the moment the FIRST phase begins until every registered phase has reached done.
//- Fades out via CSS transition (slide-up + opacity) when the aggregate hits 1.
//- Stays hidden for the rest of the card lifetime: routine background refreshes do not flash the
//  banner up again, that would feel like the card "loses its data" every time the user clicks.
//- Themed rounded card, padded, with the same bg / border / shadow vocabulary as the rest of the
//  HUD chrome so the user reads one consistent loading language across the card.

import { html, nothing, type TemplateResult } from 'lit';
import { pickTranslations } from '../i18n';


//The set of phases the tracker knows about. Adding a new one here + wiring its begin / end calls in
//the refresh function is the entire integration surface, the banner aggregates automatically. Names
//are kebab-case so they read like CSS / log identifiers when surfaced for debugging.
export type LoadingPhaseId =
    | 'energy-prefs'
    | 'pv-history'
    | 'pv-change-series'
    | 'sky-forecast'
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


//Structural host surface. The card carries the phases map + the latched-completion flag as @state
//so any mutation through these helpers re-renders the banner automatically.
export interface LoadingTrackerHost
{
    //Untyped to match the rest of the codebase (hass is `any` everywhere it crosses module boundaries).
    readonly hass?:           { language?: string } | undefined;
    _loadingPhases:           ReadonlyMap<LoadingPhaseId, LoadingPhaseState>;
    _loadingHasCompleted:     boolean;
    requestUpdate():          void;
}


//Begin a phase. Idempotent: if the phase is already started OR already done it stays as-is so a
//refresh function that runs more than once per session does not reset the tracker. Once the tracker
//has latched _loadingHasCompleted = true, beginLoadingPhase is a no-op so background refreshes do
//NOT bring the banner back.
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


//Mark a phase done. Re-checks the aggregate and latches _loadingHasCompleted once every started
//phase is done. The latch is the ONLY way the banner stops showing, so any phase that begins MUST
//eventually end (success or failure path), otherwise the banner stays stuck on screen.
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
    //Latch the completion flag the moment every started phase has finished. Subsequent
    //beginLoadingPhase calls are then no-ops for this card lifetime.
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


//Aggregate progress as a fraction in [0, 1]. Returns done / started, with a 0 floor so the bar
//never sits at NaN before any phase has begun. The aggregate is purely informational, the banner's
//visibility is controlled by `isLoadingBannerVisible` below, not by the progress value.
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


//True while the banner should be drawn. False before the first phase starts (banner has nothing to
//report), false after the latch (banner is retired for this card lifetime), true everywhere in
//between.
export function isLoadingBannerVisible(host: LoadingTrackerHost): boolean
{
    if (host._loadingHasCompleted)
    {
        return false;
    }
    return host._loadingPhases.size > 0;
}


//Diagnostic surface for window.heliosStats() and the like. Returns an array of [phase, state] pairs
//in registration order so the user can see which phase is currently blocking the banner.
export function loadingPhasesSnapshot(host: LoadingTrackerHost): Array<{ id: LoadingPhaseId; started: boolean; done: boolean }>
{
    const out: Array<{ id: LoadingPhaseId; started: boolean; done: boolean }> = [];
    for (const [id, state] of host._loadingPhases)
    {
        out.push({ id, started: state.started, done: state.done });
    }
    return out;
}


//Render the loading banner at the top of the ha-card. Always emitted (so the slide-out transition
//can fire when isLoadingBannerVisible flips false), gated by the .is-visible class for the actual
//on-screen presence.
export function renderLoadingBanner(host: LoadingTrackerHost): TemplateResult | typeof nothing
{
    const visible    = isLoadingBannerVisible(host);
    const progress   = loadingAggregateProgress(host);
    const t          = pickTranslations(host.hass?.language);
    const label      = t.detail.loadingLabel;
    const activeCls  = visible ? ' is-visible' : '';
    //Aria-hidden mirrors visibility so screen readers do not announce the banner once it has slid
    //out. Aria-live=polite means the label is announced once at first appearance and again when the
    //percentage rounds to a new integer, but not on every progress update.
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


//Alert banner painted just under the loading banner whenever the Open-Meteo home-point fetch
//is stuck in HTTP 429 back-off. Same width / centering as the loading banner so the two read
//as a stacked column, themed with the HA --error-color so the user picks up the alert nature
//at a glance without having to read the text. Disappears the moment the engine signals the
//next successful fetch.
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
