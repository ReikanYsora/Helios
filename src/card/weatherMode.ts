//Weather overlay mode. Toggling the weather chip fades the rest of the HUD out, tilts the camera
//top-down over the home, and paints modelled cloud cover as three altitude bands (low/mid/high)
//via a fragment-shader MapLibre layer (src/engine/weather-cloud-layer.ts). Bands stack with
//growing per-band opacity (20/40/60 %) so a fully overcast point reads as a heavy ceiling.
//
//Lifecycle:
//  - enterWeatherMode tilts the camera, ensures the cloud grid is loaded, then mounts the layer.
//  - exitWeatherMode removes the layer, cancels the refresh timer, restores the camera.
//  - Timeline scrubs hit refreshCloudShaderTime(), re-uploading the hour's RGB texture (no network).
//  - The three altitude toggle buttons drive setCloudShaderBands().
//
//Feed is cached in localStorage for 30 min, dedup-guarded, abortable (see src/helios-engine.ts:
//ensureWeatherCloudGrid + addCloudShaderLayer). Mode entry costs at most one Open-Meteo POST;
//subsequent entries within the TTL cost zero.

import { refreshOverlays, type OverlaysHost } from './overlays';
import type { HeliosEngine } from '../helios-engine';
import type { CardMode } from './card-mode';


//Shared time base with the LiDAR fade so the cadence reads consistently across modes.
const WEATHER_FADE_IN_MS  = 600;
const WEATHER_FADE_OUT_MS = 280;


export interface WeatherModeHost extends OverlaysHost
{
    readonly _engine?: HeliosEngine;
    _cardMode:                  CardMode;
    _overlayMaskActive:         boolean;
    _weatherOverlayVisible:     boolean;
    _weatherFadeInStartMs:      number | null;
    _weatherFadeOutStartMs:     number | null;
    _weatherFadeRaf?:           number;
    _selectedTime:              Date | null;
    _isLiveMode:                boolean;
    //Per-band visibility, driven by the top-left rail buttons. Reset to all-true on every entry;
    //values forward straight into the shader layer as per-band draw skips.
    _weatherShowHigh:           boolean;
    _weatherShowMid:            boolean;
    _weatherShowLow:            boolean;
    //Last time index pushed into the shader; short-circuits duplicate scrub updates.
    _weatherShownTimeIdx?:      number;
    //LitElement.requestUpdate(), called each fade frame to step HUD opacity. Duck-typed to keep
    //Lit out of the engine surface.
    requestUpdate(): void;
}


//Lit elements are HTMLElements, so the card root supplies the `--primary-text-color` the shader
//reads. Cast through the host interface to keep the engine surface Lit-free.
function getCssHost(host: WeatherModeHost): HTMLElement | null
{
    return (host as unknown as HTMLElement | null) ?? null;
}


//Tilt the camera, fetch the cloud grid in the background, mount the layer once it lands. Per-band
//toggles reset to all-true so re-entry always lands on a complete view.
export function enterWeatherMode(host: WeatherModeHost): boolean
{
    if (!host._engine) { return false; }
    host._weatherFadeOutStartMs = null;
    host._weatherFadeInStartMs  = performance.now();
    host._weatherOverlayVisible = true;
    host._weatherShowHigh       = true;
    host._weatherShowMid        = true;
    host._weatherShowLow        = true;
    host._weatherShownTimeIdx   = undefined;
    host._engine.enterWeatherCamera();
    void host._engine.ensureWeatherCloudGrid().then(() =>
    {
        if (host._weatherFadeOutStartMs !== null) { return; }
        if (!host._weatherOverlayVisible)         { return; }
        const engine = host._engine;
        if (!engine) { return; }
        engine.startWeatherCloudRefresh();
        const cssHost = getCssHost(host);
        const activeTime = (host._isLiveMode || !host._selectedTime)
            ? new Date()
            : host._selectedTime;
        const timeIdx = engine.getWeatherCloudGridTimeIndex(activeTime);
        const bands: [boolean, boolean, boolean] =
            [host._weatherShowLow, host._weatherShowMid, host._weatherShowHigh];
        engine.addCloudShaderLayer(cssHost, bands, timeIdx >= 0 ? timeIdx : 0);
        host._weatherShownTimeIdx = timeIdx >= 0 ? timeIdx : 0;
        host.requestUpdate();
    });
    refreshOverlays(host);
    startWeatherFadeLoop(host);
    return true;
}


//Tear down: start the HUD fade-in, drop the layer so the basemap returns clean, hand back the
//camera, stop the refresh timer.
export function exitWeatherMode(host: WeatherModeHost): void
{
    host._weatherFadeInStartMs  = null;
    host._weatherFadeOutStartMs = performance.now();
    host._engine?.removeCloudShaderLayer();
    host._engine?.exitWeatherCamera();
    host._engine?.stopWeatherCloudRefresh();
    host._weatherShownTimeIdx = undefined;
    startWeatherFadeLoop(host);
}


export function startWeatherFadeLoop(host: WeatherModeHost): void
{
    if (host._weatherFadeRaf !== undefined) { return; }
    const tick = (): void =>
    {
        const now      = performance.now();
        const inStart  = host._weatherFadeInStartMs;
        const outStart = host._weatherFadeOutStartMs;

        if (outStart !== null && now - outStart >= WEATHER_FADE_OUT_MS)
        {
            host._weatherFadeOutStartMs = null;
            host._weatherOverlayVisible = false;
            refreshOverlays(host);
        }
        if (inStart !== null && now - inStart >= WEATHER_FADE_IN_MS)
        {
            host._weatherFadeInStartMs = null;
        }
        host.requestUpdate();
        if (host._weatherFadeInStartMs !== null || host._weatherFadeOutStartMs !== null)
        {
            host._weatherFadeRaf = requestAnimationFrame(tick);
        }
        else
        {
            host._weatherFadeRaf = undefined;
        }
    };
    host._weatherFadeRaf = requestAnimationFrame(tick);
}




//Push band-visibility / time-index changes from the card into the engine without a Lit re-render.
//Called from updated() on every card cycle.
export function syncWeatherShaderState(host: WeatherModeHost): void
{
    const engine = host._engine;
    if (!engine) { return; }
    if (host._cardMode !== 'weather') { return; }
    engine.setCloudShaderBands([
        host._weatherShowLow,
        host._weatherShowMid,
        host._weatherShowHigh,
    ]);
    const activeTime = (host._isLiveMode || !host._selectedTime)
        ? new Date()
        : host._selectedTime;
    const timeIdx = engine.getWeatherCloudGridTimeIndex(activeTime);
    if (timeIdx >= 0 && timeIdx !== host._weatherShownTimeIdx)
    {
        engine.refreshCloudShaderTime(timeIdx);
        host._weatherShownTimeIdx = timeIdx;
    }
}


