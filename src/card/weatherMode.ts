//Weather overlay mode. When the user toggles the weather chip in the mode bar, the rest of the
//HUD fades out (same vocabulary as the LiDAR view), the camera tilts top-down and zooms in on
//the area around the home, and a GPU-side cloud-cover overlay paints the modelled coverage as
//three altitude bands (low / mid / high) using a fragment-shader-driven custom MapLibre layer
//(see src/engine/weather-cloud-layer.ts). The bands stack with growing per-band opacity (20 /
//40 / 60 %) so a fully overcast point reads as a heavy ceiling rather than three identical
//greys.
//
//Lifecycle:
//  - enterWeatherMode tilts the camera, ensures the cloud grid is loaded, then asks the engine
//    to mount the shader layer.
//  - exitWeatherMode tells the engine to remove the layer + cancel the refresh timer + restore
//    the camera.
//  - Timeline scrubs hit the engine's refreshCloudShaderTime(); the shader re-uploads the
//    target hour's R / G / B data texture (one ~400-byte transfer, no network call).
//  - The three altitude toggle buttons in the top-left rail drive setCloudShaderBands().
//
//The data feed itself is cached in localStorage for 30 minutes, dedup-guarded, and abortable,
//see src/helios-engine.ts (ensureWeatherCloudGrid + addCloudShaderLayer pair). One entry of the
//mode costs at most one 100-location POST against Open-Meteo; subsequent entries within the TTL
//window cost zero API calls.

import { refreshOverlays, type OverlaysHost } from './overlays';
import type { HeliosEngine } from '../helios-engine';
import type { CardMode } from './card-mode';


//Shared time base with the LiDAR fade so the chip / leader / arc fade cadence reads as one
//consistent vocabulary across modes. Enter ramps the overlay in over 600 ms while the HUD fades
//out; exit ramps back to invisible in 280 ms while the HUD fades back in.
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
    //Per-band visibility flags driven by the three buttons in the top-left weather rail. Reset
    //to all true on every weather-mode entry; the values forward straight into the shader layer
    //as per-band draw skips, no shader uniform branching.
    _weatherShowHigh:           boolean;
    _weatherShowMid:            boolean;
    _weatherShowLow:            boolean;
    //Last time index pushed into the shader, used to short-circuit duplicate scrub updates.
    _weatherShownTimeIdx?:      number;
    //LitElement.requestUpdate(), invoked each frame during the fade so the inline opacity on
    //the surrounding HUD elements steps smoothly. Duck-typed so importing LitElement here
    //doesn't drag Lit into the engine surface.
    requestUpdate(): void;
}


//Lit elements are HTMLElements themselves, so the card root acts directly as the source of the
//`--primary-text-color` CSS variable the shader reads. This helper just casts through the host
//interface so the engine surface stays free of any Lit-specific typing.
function getCssHost(host: WeatherModeHost): HTMLElement | null
{
    return (host as unknown as HTMLElement | null) ?? null;
}


//Tilt the camera, fetch the cloud grid in the background, mount the shader layer the moment
//the grid lands. Per-band toggles reset to all-true so the user always lands on a complete view
//of every band the first time they re-enter the mode.
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


//Tear the overlay down: start the HUD fade-in, drop the shader layer immediately so the basemap
//comes back clean, hand the camera back, stop the cloud refresh timer.
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




//Push any band-visibility / time-index changes coming from the card into the engine so the
//shader updates without a Lit re-render path. Called from updated() on every card cycle.
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


