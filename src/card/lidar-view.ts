//LiDAR View overlay: clicking View fades out the map UI and projects every loaded LiDAR cell to screen
//as a dot. Handles the toggle gesture and the alpha-fade rAF loop for the enter/exit transitions.
//Host-driven like the timeline / overlays modules: the card owns the @state flag and fade timestamps;
//these helpers mutate them through a structural LidarViewHost.

import { html, nothing, type TemplateResult } from 'lit';
import { refreshOverlays, type OverlaysHost } from './overlays';
import type { HeliosEngine } from '../helios-engine';
import type { CardMode } from './card-mode';


//Enter runs longer than exit: the dot cloud "settles in" while the HUD hurries back on dismiss.
const LIDAR_FADE_IN_MS  = 380;
const LIDAR_FADE_OUT_MS = 280;


//Structural surface the host card exposes. Card-side mode state (_cardMode + _overlayMaskActive) drives
//what the user sees; this module mutates the fade-loop fields and signals the engine. The picker reads
//_cardMode directly so its .is-active class flips on the same render as the mode.
export interface LidarViewHost extends OverlaysHost
{
    readonly _engine?:           HeliosEngine;

    _cardMode:                   CardMode;
    _overlayMaskActive:          boolean;
    _lidarLayerActive:           boolean;
    _lidarFadeInStartMs:         number | null;
    _lidarFadeOutStartMs:        number | null;
    _lidarFadeRaf?:              number;
    _lidarViewOpacity:           number;
}


//Start the LiDAR enter animation. Returns false (no-op) when the engine reports no LiDAR source covers
//the active home. Called when _cardMode transitions INTO 'lidar'. The chip/leader/arc/timeline CSS
//transitions run independently, driven by _overlayMaskActive flipping ON when _cardMode left base.
export function enterLidarView(host: LidarViewHost): boolean
{
    if (!host._engine)
    {
        return false;
    }
    if (host._engine.getActiveLidarSourceId() === null)
    {
        return false;
    }
    host._lidarFadeOutStartMs = null;
    host._lidarFadeInStartMs  = performance.now();
    host._lidarLayerActive    = true;
    host._engine.setLidarViewActive(true);
    refreshOverlays(host);
    startLidarFadeLoop(host);
    return true;
}


//Start the LiDAR exit animation. The fade loop tears the engine layer down and, if _cardMode landed on
//base, lifts the overlay mask. Holding the mask until WebGL fade-out completes is deliberate: otherwise
//the HUD would pop back through the still-visible dot cloud.
export function exitLidarView(host: LidarViewHost): void
{
    host._lidarFadeInStartMs  = null;
    host._lidarFadeOutStartMs = performance.now();
    startLidarFadeLoop(host);
}


//Drives the fade alpha while a fade is in flight, pushing each tick's alpha to the engine for the next
//MapLibre repaint. Self-terminates when both fades are null so the rAF cost stays at zero when idle.
export function startLidarFadeLoop(host: LidarViewHost): void
{
    if (host._lidarFadeRaf !== undefined)
    {
        return;
    }
    const tick = (): void =>
    {
        const now = performance.now();
        const inStart  = host._lidarFadeInStartMs;
        const outStart = host._lidarFadeOutStartMs;

        //Exit fade done: tear down the layer and lift the mask only if the user landed on base (it stays
        //on for weather mode so chips don't flash between modes).
        if (outStart !== null && now - outStart >= LIDAR_FADE_OUT_MS)
        {
            host._lidarFadeOutStartMs = null;
            host._lidarLayerActive    = false;
            host._engine?.setLidarViewFadeAlpha(0);
            host._engine?.setLidarViewActive(false);
            if (host._cardMode === 'base')
            {
                host._overlayMaskActive = false;
            }
            //refreshOverlays was gated out while LiDAR was active, so any camera rotation left the
            //silhouette + chips frozen at the toggle-on bearing. Re-project now so glow + leaders land
            //correctly when the HUD returns.
            refreshOverlays(host);
        }
        //Enter fade done: drop the marker so ticks stop ramping. Layer alpha holds at 1 until toggle-off.
        if (inStart !== null && now - inStart >= LIDAR_FADE_IN_MS)
        {
            host._lidarFadeInStartMs = null;
        }

        //Recompute fade progress on the active marker(s) and push to the engine; the setter triggers a
        //MapLibre repaint so the updated alpha shows next frame.
        const inT  = host._lidarFadeInStartMs  !== null
            ? Math.max(0, Math.min(1, (now - host._lidarFadeInStartMs)  / LIDAR_FADE_IN_MS))
            : 1;
        const outT = host._lidarFadeOutStartMs !== null
            ? Math.max(0, Math.min(1, (now - host._lidarFadeOutStartMs) / LIDAR_FADE_OUT_MS))
            : 0;
        //Enter ramps 0→1, exit back to 0. Never both in flight (the helpers clear one before setting the
        //other), so the multiplication is a guard.
        const alpha = (host._lidarFadeInStartMs  !== null ? inT : (host._lidarLayerActive ? 1 : 0))
                    * (host._lidarFadeOutStartMs !== null ? (1 - outT) : 1);
        host._engine?.setLidarViewFadeAlpha(alpha);

        if (host._lidarFadeInStartMs !== null || host._lidarFadeOutStartMs !== null)
        {
            host._lidarFadeRaf = requestAnimationFrame(tick);
        }
        else
        {
            host._lidarFadeRaf = undefined;
        }
    };
    host._lidarFadeRaf = requestAnimationFrame(tick);
}


//Bottom-of-card opacity slider, painted only while LiDAR-View mode is active. Slider value is a percent
//(0..100) for readability; the host bridges it back to the [0..1] engine API.
export function renderLidarViewOpacityPicker(
    host:     LidarViewHost,
    onChange: (opacity: number) => void,
): TemplateResult | typeof nothing
{
    const pct        = Math.round(Math.max(0, Math.min(1, host._lidarViewOpacity)) * 100);
    //.is-active projects _cardMode directly, so the CSS transition fires on the same render as the mode
    //flip — the pill slides down the moment the user clicks away, independent of the WebGL fade-out.
    const sliderActive = host._cardMode === 'lidar';
    const activeCls    = sliderActive ? ' is-active' : '';
    return html`
        <div class="lidar-view-opacity-slider${activeCls}" aria-label="LiDAR view opacity" ?aria-hidden="${!sliderActive}">
            <ha-icon class="lidar-view-opacity-icon lidar-view-opacity-icon--low"  icon="mdi:circle-outline"></ha-icon>
            <input type="range" min="0" max="100" step="1"
                   class="lidar-view-opacity-range"
                   .value="${String(pct)}"
                   aria-label="LiDAR view opacity percentage"
                   tabindex="${sliderActive ? 0 : -1}"
                   @input="${(e: Event) => {
                       const input = e.target as HTMLInputElement;
                       const v = Number(input.value);
                       onChange(v / 100);
                       //The host's _onLidarOpacityChange triggers a Lit requestUpdate at the
                       //rAF-coalesced cadence, which re-renders this picker template and updates
                       //the percentage span through the normal Lit text-node pipeline. The
                       //previous design did an imperative `span.textContent =` write here to
                       //skip the re-render cost, but textContent replaces every child node of
                       //the span, including Lit's tracking markers, which crashed Lit on the
                       //next render of the card and aborted updated() partway through (the
                       //aborted updated() then skipped _handleCardModeChange entirely, which
                       //stranded the LiDAR layer on screen after a mode swap).
                   }}" />
            <ha-icon class="lidar-view-opacity-icon lidar-view-opacity-icon--high" icon="mdi:circle"></ha-icon>
            <span class="lidar-view-opacity-value">${pct}%</span>
        </div>
    `;
}
