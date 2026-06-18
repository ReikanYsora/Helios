//The card's mutually-exclusive view modes. One state replaces the historical _lidarViewMode /
//_weatherMode boolean pair, so the mode-bar click handler can't leave the card in an inconsistent
//intermediate state (one flag flipping before the other, transitions drifting out of sync).
//
//- 'base': default HUD with chips, leaders, arcs and timeline.
//- 'lidar': WebGL dot-cloud overlay + bottom opacity slider.
//- 'weather': top-down meteorological overlay (zoomed-out camera + per-altitude cloud-cover raster
//             from the multi-point Open-Meteo grid).
//
//Transitions are driven by a state machine in HeliosCard.updated() which kicks the WebGL/overlay
//fades and toggles the overlay mask. CSS animations are class-driven, so a single _cardMode-driven
//class change per render animates the slide reliably.

export type CardMode = 'base' | 'lidar' | 'weather';
