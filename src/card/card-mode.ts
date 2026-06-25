//The card's mutually-exclusive view modes. One state replaces the historical _weatherMode boolean,
//so the mode-bar click handler can't leave the card in an inconsistent intermediate state
//(transitions drifting out of sync).
//
//- 'base': default HUD with chips, leaders, arcs and timeline.
//- 'weather': top-down meteorological overlay (zoomed-out camera + per-altitude cloud-cover raster
//             from the multi-point Open-Meteo grid).
//
//Transitions are driven by a state machine in HeliosCard.updated() which kicks the overlay
//fades and toggles the overlay mask. CSS animations are class-driven, so a single _cardMode-driven
//class change per render animates the slide reliably.

export type CardMode = 'base' | 'weather';
