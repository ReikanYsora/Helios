import { css, unsafeCSS } from 'lit';
//MapLibre's stylesheet ships under dist/maplibre-gl.css. Vite's
//`?inline` query suffix returns the file content as a raw string
//instead of injecting a global <style> tag, we need the rules
//*inside* our shadow root, not in document <head>. Without these
//rules .maplibregl-canvas falls back to the default `position:
//static`, which makes the canvas participate in the layout flow:
//in HA panel-mode (where the parent container has no fixed
//height), the explicit pixel size MapLibre writes onto the canvas
//pushes the container, our ResizeObserver fires, MapLibre re-reads
//a bigger container, and we're in an unbounded growth loop. With
//the rule applied the canvas is taken out of flow and the loop
//breaks.
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?inline';

//Visual styles for the main HeliosCard. Kept in a dedicated file so
//the card module reads as logic only; rules are grouped by feature
//(layout, timeline, overlays, solar arc, tooltips).
export const heliosCardStyles = css`
    ${unsafeCSS(maplibreCss)}

    :host
    {
        display: block;
        height:  100%;
    }

    ha-card
    {
        position: relative;
        overflow: hidden;
        background: #000;
        /*  Container query host so the fullscreen / kiosk breakpoint
            rules at the bottom of this stylesheet can react to the
            card's own width without depending on the viewport size,
            which would mis-fire when the user has several Helios
            cards side by side in a grid view. See issue #33. */
        container-type: inline-size;
        container-name: helios-card;
        /*  Card frame: pull the radius + border + shadow straight off
            the HA card design tokens so Helios matches whatever the
            user's frontend theme has set for every other dashboard
            card. Hard-coded fallbacks mirror the HA default theme:
            12 px radius, 1 px divider hairline, the standard 2-band
            elevation shadow.                                          */
        border-radius: var(--ha-card-border-radius, 12px);
        border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, rgba(0, 0, 0, 0.12)));
        box-shadow: var(--ha-card-box-shadow,
                        0 2px 1px -1px rgba(0, 0, 0, 0.2),
                        0 1px 1px 0 rgba(0, 0, 0, 0.14),
                        0 1px 3px 0 rgba(0, 0, 0, 0.12));
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
        height:     100%;
        width:      100%;
        /*  Floor that survives dashboard layouts where the parent
            doesn't apply an explicit height (vertical-stack, panel
            view, some custom dashboards like Mushroom-based grids).
            Without this floor, height:100% resolves to the children's
            intrinsic height, which means only the timeline chart's
            ~150 px contributes and the 3D map area collapses out of
            view. 480 px leaves the chart its natural height and gives
            the map area ~330 px which is enough to read the home and
            its surroundings. Layouts that DO pass an explicit height
            (masonry via getCardSize, sections view via getGridOptions)
            override this freely.                                       */
        min-height: 480px;
        /*  New stacking context so absolute children with z-index
            stay scoped to the card instead of escaping above HA's
            dashboard chrome on scroll. */
        isolation: isolate;
    }

    #map-container
    {
        /*  Absolute + inset:0 so the container fills its ha-card
            parent via the containing-block dimensions (which respect
            min-height) rather than via percentage height resolution.
            Percentage heights only cascade when the parent has a
            concrete pixel height, the Masonry dashboard layout sets
            only a min-height floor on the card, so a height:100% here
            would collapse to 0 and the MapLibre canvas would never
            render. Sections and panel views pass a pixel height down,
            so the old percentage path worked there, the absolute path
            works under both.                                          */
        position: absolute;
        inset: 0;
    }

    /*  Force-hide the MapLibre attribution rail. attributionControl
        compact: true is meant to collapse it to an icon, but MapLibre
        auto-expands the full bar above 640 px viewport width which
        most dashboard cards exceed. We hide it outright via CSS, the
        attribution credit (MapLibre + OpenFreeMap + OpenMapTiles +
        OpenStreetMap data) lives in the README and the HACS info pane
        so the license obligation stays satisfied through documentation
        rather than chrome real estate. */
    .maplibregl-ctrl-attrib,
    .maplibregl-ctrl-bottom-right,
    .maplibregl-ctrl-bottom-left
    {
        display: none !important;
    }
    /*  Camera-locked cursor: drop the MapLibre grab cursor when the user has the camera
        pinned. drag pan + drag rotate are both disabled in the locked state, so the open-hand
        cursor was advertising an interaction that does not exist. MapLibre sets the cursor
        inline on the canvas, so the override needs !important to bite. */
    ha-card.camera-locked .maplibregl-canvas-container,
    ha-card.camera-locked .maplibregl-canvas
    {
        cursor: default !important;
    }


    /*  Home hitbox, invisible circular click target centred on the
        home's projected screen position. Sits above every overlay
        SVG (z 12) but below the detail panel (z 60) so a click
        always reaches it, regardless of which chip / leader happens
        to sit underneath at that moment. */
    /*  Home click target. Sized to comfortably overlap the 3D
        building silhouette on a typical residential footprint
        (40-50 m at home altitude after the projection), and z-index
        bumped above every chip + leader cluster so the click reliably
        lands on the home regardless of which decoration happens to
        sit under the pointer at that moment.                       */
    .home-hitbox
    {
        position: absolute;
        transform: translate(-50%, -50%);
        width:  120px;
        height: 120px;
        border-radius: 50%;
        background: transparent;
        cursor: pointer;
        pointer-events: auto;
        z-index: 55;
    }
    /*  Loading-state hitbox: still rendered (the user sees the home pill underneath) but inert.
        No pointer events so click + mouseenter / mouseleave never fire, the wait cursor flags
        the brief "still loading" window so the user does not think the click is broken when the
        dashboard fails to open. The class is removed the moment the loader latches and the
        normal pointer cursor + click handler come back. */
    .home-hitbox.is-loading
    {
        cursor: wait;
        pointer-events: none;
    }

    /*  Home hover glow. Same base + top + side-quad polygons as the
        cloud-dome mask (so it tracks rotation pixel-for-pixel with
        the building extrusion), painted in the configured sun colour
        with a CSS drop-shadow bloom. Opacity is the only thing that
        animates so the fade is GPU-cheap, the geometry comes back
        every frame from the engine without re-rendering this SVG. */
    .home-glow-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        /*  The SVG itself stays click-transparent so empty pixels
            don't capture clicks meant for chips behind it; only the
            painted polygons (the home-glow-shape rule below) receive
            pointer events. cursor: pointer makes the silhouette
            read as interactive on hover. */
        pointer-events: none;
        cursor: pointer;
        /*  Sits ABOVE the basemap + buildings but BELOW the home chip
            cluster (z 8) so the hover glow + production pulse never
            cross over the PV / battery / grid / cloud / solar value
            chips. The chips always win on the shared pixels. */
        z-index: 6;
        /*  Resting opacity is a faint 0.25 so the home silhouette stays discoverable on the
            basemap even in busy mixed-building neighbourhoods. Hover bumps to 0.85 for an
            unmistakable interactive cue; the drop-shadow stays modest at rest and ramps up on
            hover via a heavier filter rule.                                                   */
        opacity: 0.25;
        transition: opacity 0.18s ease, filter 0.18s ease;
        filter: drop-shadow(0 0 4px var(--primary-color, #03a9f4));
    }
    .home-glow-svg.is-hovered
    {
        opacity: 0.85;
        filter: drop-shadow(0 0 8px var(--primary-color, #03a9f4));
    }

    /*  Touch devices have no hover state, mouseenter / mouseleave
        never fire, so the .is-hovered class is never applied. Show
        the glow permanently at a softer opacity so the user still
        gets a visual hint that the home is tappable. The detail-
        mode fade rule (specificity 0,2,0) wins over this (0,1,0)
        so the glow still fades out when the dashboard opens. */
    @media (hover: none)
    {
        .home-glow-svg { opacity: 0.45; }
    }
    .home-glow-svg .home-glow-shape
    {
        /*  Translucent HA primary-color halo painted ONLY on hover
            (the parent SVG controls opacity); the home base identity
            colour lives on the 3D fill-extrusion in _addBuildings(). */
        fill: var(--primary-color, #03a9f4);
        fill-opacity: 0.08;
        stroke: var(--primary-color, #03a9f4);
        stroke-width: 1;
        stroke-linejoin: round;
        /*  Painted polygons capture clicks so the silhouette's actual shape becomes the hit
            zone. The 120 px circular hitbox below only covers the centre, and on larger /
            zoomed-in buildings the corners stick out past it; visiblePainted reads the painted
            footprint and catches clicks anywhere on the visible roof. */
        pointer-events: visiblePainted;
    }


    /*  Detail mode (dashboard dive) reuses the same chip / leader / arc / timeline hide rules
        as the LiDAR + weather modes via the shared .overlay-masked class. The card-side render
        sets overlay-masked whenever _overlayMaskActive OR _detailMode is true, so a home click
        triggers the same 0.35 s fade + 0.45 s timeline slide as a mode-bar click. Time-bar
        slide-out transitions live alongside the chip fade rules further down so the two
        transforms (fade vs slide) do not race during the dashboard open / close window.       */

    /*  When LiDAR View is active, fade out every overlay layer so
        the dot cloud reads on its own against a quiet basemap. The
        toggle button itself is opted back in (selector below) so
        the user can always exit. The map container stays visible
        so the dots are projected onto a real basemap.

        Selector list mirrors what .detail-active fades earlier in
        this file, plus the corners (top-left clock + top-right rail
        minus the LiDAR button itself), the home hitbox / glow, and
        the timeline. Easier to audit if any future overlay needs
        to be hidden in LiDAR View by looking at this single block. */
    /*  Base transition + composite-layer hint kept on the unprefixed selectors so the fade
        runs in BOTH directions across every browser. The will-change: opacity hint promotes
        each element to its own composite layer so the GPU drives the alpha sweep instead of
        asking the painter to redo layout per frame, which would otherwise drop frames on the
        chips that sit inside transform-less wrappers (time-bar, solar-svg).                  */
    .overlay-top-left,
    .home-glow-svg,
    .home-hitbox,
    .home-drop-leader-svg,
    .solar-svg,
    .solar-pct-label,
    .pv-home-leader-svg,
    .pv-pct-label,
    .battery-leader-svg,
    .battery-pct-label,
    .grid-leader-svg,
    .grid-import-label,
    .grid-export-label,
    .home-pill
    {
        transition: opacity 0.35s ease;
    }
    /*  will-change opt-in: scope the composite-layer promotion to the transition windows only.
        Declaring will-change: opacity unconditionally on 15+ elements pins that many GPU layers
        in idle VRAM (~15-30 MB on devices with limited budgets) and forces the compositor to
        re-sync them on every Lit re-render. Promote only when a mode actually toggles, gated
        on ha-card.overlay-masked, which is set on every non-base _cardMode AND whenever
        _detailMode is true (dashboard dive). One rule covers the union of transition windows. */
    ha-card.overlay-masked .overlay-top-left,
    ha-card.overlay-masked .home-glow-svg,
    ha-card.overlay-masked .home-hitbox,
    ha-card.overlay-masked .home-drop-leader-svg,
    ha-card.overlay-masked .solar-svg,
    ha-card.overlay-masked .solar-pct-label,
    ha-card.overlay-masked .pv-home-leader-svg,
    ha-card.overlay-masked .pv-pct-label,
    ha-card.overlay-masked .battery-leader-svg,
    ha-card.overlay-masked .battery-pct-label,
    ha-card.overlay-masked .grid-leader-svg,
    ha-card.overlay-masked .grid-import-label,
    ha-card.overlay-masked .grid-export-label,
    ha-card.overlay-masked .home-pill
    {
        will-change: opacity;
    }

    /*  Timeline SLIDES out below the card / slides back in from the bottom edge instead of fading.
        translateX kept inside every keyframe so the bar never drifts horizontally during the slide. */
    .time-bar
    {
        transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
        will-change: transform;
    }
    /*  Chips + leaders + arcs fade out behind any non-base mode (LiDAR, weather, detail dive).
        Single rule keyed on the overlay-masked class so the state machine on the card side
        controls exactly when the fade kicks in either direction. */
    ha-card.overlay-masked .home-glow-svg,
    ha-card.overlay-masked .home-hitbox,
    ha-card.overlay-masked .home-drop-leader-svg,
    ha-card.overlay-masked .solar-svg,
    ha-card.overlay-masked .solar-pct-label,
    ha-card.overlay-masked .pv-home-leader-svg,
    ha-card.overlay-masked .pv-pct-label,
    ha-card.overlay-masked .battery-leader-svg,
    ha-card.overlay-masked .battery-pct-label,
    ha-card.overlay-masked .grid-leader-svg,
    ha-card.overlay-masked .grid-import-label,
    ha-card.overlay-masked .grid-export-label
    {
        opacity: 0;
        pointer-events: none;
    }
    /*  home-pill is the small circular home icon that anchors the home cluster. It hides on every
        masked mode EXCEPT weather: in weather mode the basemap + radar overlay alone don't show
        where the user lives, so the pill stays so the user can identify their own roof against
        the rain cells around it. */
    ha-card.overlay-masked:not(.mode-weather) .home-pill
    {
        opacity: 0;
        pointer-events: none;
    }
    /*  Timeline slides below the card edge for any non-base mode + the dashboard dive (overlay-
        masked is set for both, see the card-side render comment). Weather mode is the exception:
        the cloud grid is fetched as a 5-day window (-2/+3 days) on entry, so scrubbing the time-
        bar just walks the cached time slice without a fresh fetch. Keeping the timebar visible
        means the user can replay the day's cloud cover or peek ahead at the forecast directly
        from the weather view. */
    ha-card.overlay-masked:not(.mode-weather) .time-bar
    {
        transform: translateY(140%);
        pointer-events: none;
    }
    /*  Top-left cluster (lock chip) hides on every masked mode EXCEPT weather: weather mode hosts
        the per-altitude cloud band toggles in this rail and they need to stay interactive while
        the rest of the HUD is faded out. */
    ha-card.overlay-masked:not(.mode-weather) .overlay-top-left
    {
        opacity: 0;
        pointer-events: none;
    }
    ha-card.overlay-masked .overlay-top-right
    {
        opacity: 1;
        pointer-events: auto;
    }
    /*  Dashboard mode (detail-active) hides the top-right toggle rail (UI / LiDAR / ShadowDome
        buttons) entirely. The rail makes sense in the layered card modes where the user is
        switching between visualisations, in the dashboard dive the user is looking at the day's
        data and the toggles are visually noisy. They come back the moment the user closes the
        dashboard (the class is dropped). Same specificity as the overlay-masked rule above, this
        rule comes later so it wins by cascade order. */
    ha-card.detail-active .overlay-top-right
    {
        opacity: 0;
        pointer-events: none;
    }


    /*  Detail panel, takes over the card while detail mode is on.
        Hosts the three-section dashboard (today / tomorrow /
        battery, the last two sat side by side when both render).
        The backdrop is a soft scrim + blur so the basemap behind
        stays readable (the camera is zoomed and pitched underneath)
        without competing with the panel content. Dismissal goes
        through a dedicated close button in the corner rather than
        a stray click on the panel itself, otherwise scrolling or
        tapping inside a card on a small viewport would close it. */
    .detail-panel
    {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.35);
        /*  backdrop-filter blur removed: it forces every descendant element (cards, charts, text) into
            their own composite layers which were rasterised at fractional resolution, the side effect was
            a subtle blur on every dashboard chip / text the user clearly saw. The detail panel scrim alone
            (the rgba background above) is enough to dim the map behind without the GPU layer cost. */
        z-index: 60;
        opacity: 0;
        animation: detail-panel-fade-in 0.25s ease forwards;
        display: flex;
        flex-direction: column;
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
    }
    @keyframes detail-panel-fade-in
    {
        from { opacity: 0; }
        to   { opacity: 1; }
    }

    .detail-close-btn
    {
        position: absolute;
        top: 10px;
        right: 10px;
        width:  28px;
        height: 28px;
        padding: 0;
        background: var(--card-background-color, #ffffff);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 50%;
        color: var(--primary-text-color, #212121);
        cursor: pointer;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px var(--shadow-color);
        transition: transform 0.12s;
    }
    .detail-close-btn:hover  { transform: scale(1.05); }
    .detail-close-btn:active { transform: scale(0.95); }
    .detail-close-btn ha-icon { --mdc-icon-size: 16px; color: inherit; }
    ha-card.theme-dark .detail-close-btn
    {
        background:   var(--card-background-color, #191a1b);
        color:        var(--primary-text-color, #e6e6e6);
        border-color: var(--divider-color, rgba(255, 255, 255, 0.20));
    }

    .detail-panel-inner
    {
        flex: 1;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        overflow-y: auto;
        overflow-x: hidden;
    }

    /*  CoverFlow dashboard. 5 cards stacked on a 3D perspective stage, the centre card represents today and is at
        full size + opacity, the ±1 cards sit behind it slightly rotated, the ±2 cards sit further back still.
        Navigation: chevron arrows on desktop, swipe on touch + trackpad, keyboard arrows when the stage has
        focus. */
    .dash-coverflow
    {
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 24px;
        min-height: 0;
        outline: none;
        touch-action: pan-y;
    }
    .dash-cf-stage
    {
        position: relative;
        flex: 1;
        width: 100%;
        height: 100%;
        min-height: 0;
        /*  CSS grid stack: all 5 cards live in the same 1 x 1 grid cell, place-items centres each in the
            cell, z-index drives the visual stacking. The front card (transform: none) is centred by the
            grid alone, no translate(-50%, -50%) needed = no compositor layer promotion = sharp on every
            browser including Safari. Side cards centre too, then their inline transform translates +
            scales + rotateY from that centre to fan them out. */
        display: grid;
        grid-template-columns: 1fr;
        grid-template-rows: 1fr;
        place-items: center;
    }
    .dash-cf-card
    {
        position: relative;
        grid-area: 1 / 1;
        /*  Re-scope the full --ha-card-* token cascade for the inner mini-cards. Panel-view
            dashboards (single-card mode) override these tokens on the outer Helios card so it
            fills the screen edge-to-edge with no visible border, the override cascades down and
            crushes every inner ha-card on the CoverFlow front face to square corners with no
            border. Re-establishing the tokens here keeps the bandeau / badges / radial card
            with proper HA frontend chrome regardless of the outer card mode. The user's theme
            can still override this scope via card-mod or a frontend theme. */
        --ha-card-border-radius: 12px;
        --ha-card-border-width: 1px;
        --ha-card-border-color: var(--divider-color, rgba(0, 0, 0, 0.12));
        /*  Container-type: inline-size on the outer card so cqi units inside (e.g. the hour
            label clamp) resolve to the card's own width rather than to an ancestor's. Combined
            with the helios-card opt-out on the inner mini-cards above, the inner cards do not
            re-name this container so existing @container helios-card queries still target the
            outer Helios ha-card. */
        container-type: inline-size;
        /*  Card sized via plain percentages of the closest positioned ancestor (.dash-cf-stage). Height
            at 96 % leaves a 2 % gutter top + bottom so the card uses the visible space the panel offers,
            width derives from the height via the aspect ratio, max-width 82 % caps it on tall narrow
            stages (phone portrait) where the height-derived width would otherwise overflow horizontally. */
        height: 96%;
        max-width: 88%;
        /*  Wider aspect than the previous 4 / 7 so the radial dial reads as the focal element of the
            card without leaving a wide blank gutter on either side. Height 96 % and aspect 5 / 7 give
            a card width of ~69 % of the stage height; the side cards keep their txPct +/- 32 / 50 %
            offsets so they still peek out from behind the front card and stay clickable. */
        aspect-ratio: 5 / 7;
        /*  Outer card chrome bound to the HA frontend tokens so the CoverFlow card frame matches
            the surrounding dashboard. Bigger radius than the inner mini-cards (1.5x) so the outer
            shell visually contains the stack inside it without their corners poking through. */
        /*  Concentric rounded-rectangle rule: an outer corner should equal the inner radius plus
            the inner padding so the inner mini-cards visually align with the outer shell. With
            8 px padding between the inner cards and the outer edge, outer-radius = inner-radius
            + 8 px keeps the curve continuous regardless of how the HA theme tunes the inner
            radius via --ha-card-border-radius. */
        border-radius: calc(var(--ha-card-border-radius, 12px) + 8px);
        background: var(--primary-background-color, var(--ha-card-background, #1c1c1c));
        border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, rgba(255, 255, 255, 0.12)));
        box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.25),
            0 12px 32px rgba(0, 0, 0, 0.18);
        /*  Mini-cards inside (bandeau, badge strip, radial card, footer clock) sit at the HA
            frontend's standard 8 px gap. The same 8 px also serves as inner padding so each mini-
            card breathes inside the outer shell. No per-child margins anywhere on the front face,
            all spacing comes from this gap + padding pair. */
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 8px;
        cursor: pointer;
        transition:
            transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity   420ms cubic-bezier(0.22, 1, 0.36, 1);
        transform-origin: center center;
        overflow: hidden;
    }
    .dash-cf-card-front
    {
        cursor: default;
        box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.35),
            0 24px 48px rgba(0, 0, 0, 0.22);
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-width: none;
        /*  Front card: NO transform of any kind. Centred by the parent grid (place-items: center) on the
            stage. The !important on transform shadows the inline transform that dashboard.ts still emits
            (which still applies to the side cards). */
        transform: none !important;
        /*  touch-action: none disables the browser's native scroll / pan / zoom for touches on the
            focused front card. On mobile, dragging across the card no longer scrolls the parent
            dashboard page underneath, the user reads the radial dial + chip strip without the
            page jumping around. */
        touch-action: none;
    }
    /*  Light-theme shadow override for the CoverFlow stack. The default rules above use heavy
        rgba(0, 0, 0, 0.22-0.35) shadows that sit well on a dark theme card background but read as a
        floating 3D layer when the active HA theme is light, the look does not match the rest of the
        HA frontend whose default ha-card shadow is much softer. Re-bind the shadow on light themes to
        the same low-alpha pattern HA uses on its own cards so the CoverFlow stack reads as part of
        the surrounding dashboard, not as a separate elevated panel. */
    ha-card:not(.theme-dark) .dash-cf-card
    {
        box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.06),
            0 4px 12px rgba(0, 0, 0, 0.06);
    }
    ha-card:not(.theme-dark) .dash-cf-card-front
    {
        box-shadow:
            0 2px 6px rgba(0, 0, 0, 0.10),
            0 8px 20px rgba(0, 0, 0, 0.08);
    }
    /*  Inner mini-cards on light theme: drop the global Material-elevation drop shadow inherited
        from the Helios outer ha-card rule. On a light-theme card background the Material shadow
        reads as a heavy floating offset that doesn't match the modern flat-card look most HA
        frontend themes go for (Mushroom, the HA default, the community flat themes), the user
        explicitly flagged the 3D look as off-brand. The 1 px hairline border the outer rule
        already paints keeps the cards visibly delimited without the shadow. */
    ha-card:not(.theme-dark) ha-card.dash-cf-card-bandeau,
    ha-card:not(.theme-dark) ha-card.dash-radial-badge,
    ha-card:not(.theme-dark) ha-card.dash-radial-wrap,
    ha-card:not(.theme-dark) ha-card.dash-cf-card-graph-block
    {
        box-shadow: none;
    }
    /*  Bottom-fade mask removed. mask-image forces the card into a compositor layer which the browser
        then rasterises, the side effect was a subtle blur on the card content. The user can still scroll
        the card via touch / wheel; the hint that there is more content below is now implicit. */
    .dash-cf-card-front::-webkit-scrollbar
    {
        display: none;
    }

    /*  Top-of-card bandeau styled as a Mushroom-card header strip anchored at the top with a small margin all
        around so it reads as a card-inside-card. Grid layout (auto / 1fr / auto) keeps the weather chip on the
        left, the date group in the centre and the close button (or a spacer on non-front cards) on the right
        regardless of card width. Background and border colours bind to the HA theme tokens so the strip
        follows the active frontend theme. */
    /*  The outer Helios ha-card sets a Helios-specific background (#000 for the map area), a
        480 px min-height floor for the map, and a helios-card container scope. The inner mini-
        cards on the CoverFlow front face are also ha-cards (so the HA frontend chrome applies)
        and must opt out of all three: standard HA card background, no min-height floor, and no
        nested container scope (otherwise @container helios-card queries elsewhere in this file
        would resolve against the inner mini-card width and mis-fire). */
    ha-card.dash-cf-card-bandeau,
    ha-card.dash-radial-badge,
    ha-card.dash-radial-wrap,
    ha-card.dash-cf-card-graph-block
    {
        background:   var(--ha-card-background, var(--card-background-color, #1c1c1c));
        min-height:   0;
        height:       auto;
        width:        auto;
        container-type: normal;
    }

    /*  Bandeau: ha-card host, so background / border / border-radius / box-shadow come from the
        HA frontend's own ha-card styles. Only the layout (grid columns + padding) lives here. */
    ha-card.dash-cf-card-bandeau
    {
        padding: 6px 10px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        min-height: 0;
        height: auto;
        width: auto;
    }
    /*  Weather chip on the left. Circular, slightly larger than the inner glyph so the icon sits centred
        without nudging up or down. line-height: 0 on the chip + a flex-centred ha-icon kills the default
        text-baseline alignment that was pushing the glyph 1-2 px off centre. */
    .dash-cf-card-weather-chip
    {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: var(--secondary-background-color, rgba(127, 127, 127, 0.1));
        color: var(--primary-text-color, #ffffff);
        line-height: 0;
    }
    .dash-cf-card-weather-chip ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
    }
    /*  Centre group: calendar glyph + date + "Aujourd'hui / Hier / ..." chip styled like the HA frontend
        "Now"-style neutral chip in the screenshot the user shared. */
    .dash-cf-card-bandeau-center
    {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-width: 0;
        overflow: hidden;
    }
    .dash-cf-card-cal-icon
    {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color, var(--primary-text-color, #ffffff));
        flex-shrink: 0;
        /*  Kill the ha-icon baseline so the glyph lands on the flex cross-axis centre rather than its
            default text baseline (the date text sits centred, the icon was nudging up by ~2 px without these
            three lines). */
        display: inline-flex;
        align-items: center;
        line-height: 0;
    }
    .dash-cf-card-date
    {
        font-size: clamp(var(--ha-font-size-s, 13px), 2.2cqw, var(--ha-font-size-l, 16px));
        font-weight: var(--ha-font-weight-bold, 700);
        letter-spacing: 0.2px;
        text-transform: capitalize;
        color: var(--primary-text-color, #ffffff);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    /*  Two formats rendered side by side: long is the default, short is hidden. The container query below
        swaps them on narrow ha-card containers (section view, narrow dashboard) where the long format would
        otherwise truncate. Both are localised via Intl.DateTimeFormat in the renderer so the abbreviation
        respects the HA frontend's language. */
    .dash-cf-card-date-short { display: none; }
    .dash-cf-card-date-long  { display: inline; }
    .dash-cf-card-day-chip
    {
        background: color-mix(in srgb, var(--primary-color, #03a9f4) 18%, transparent);
        color: var(--primary-color, #03a9f4);
        border-radius: 14px;
        padding: 2px 10px;
        font-size: var(--ha-font-size-xs, 11px);
        font-weight: var(--ha-font-weight-bold, 700);
        line-height: 1.4;
        white-space: nowrap;
        flex-shrink: 0;
    }
    /*  Left-side group. Holds the weather chip plus the view-mode toggle (front card) or an invisible
        spacer of matching width (side cards), so the centre column stays vertically aligned on every
        card regardless of which one sits at the front. */
    .dash-cf-card-bandeau-leading
    {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
    }
    .dash-cf-view-toggle-spacer
    {
        /*  32 px placeholder that matches the toggle width on the front card so the bandeau-leading
            group keeps the same overall width on every card and the centre column never shifts on
            swipe. Held by aria-hidden, no visual chrome. */
        display: inline-block;
        width: 32px;
        height: 32px;
    }
    /*  Right-side slot. Either the close button (front card) or an invisible 30 px spacer of matching
        width on the side cards. */
    .dash-cf-card-bandeau-spacer
    {
        display: inline-block;
        width: 30px;
        height: 30px;
    }
    /*  View-mode toggle in the bandeau. Round 32 px chip mirroring the weather chip on the left, with a
        mode-coloured tint so the user reads the active mode at a glance. Two colour families: the radial
        mode picks up --energy-solar-color (warm orange, ties to the sundial visual), the graph mode
        picks up --primary-color (HA blue, ties to the chart vocabulary). Tap flips the mode for every
        card in the stack at once. */
    .dash-cf-view-toggle
    {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: none;
        cursor: pointer;
        line-height: 0;
        padding: 0;
        transition: background 0.15s, color 0.15s, transform 0.1s;
    }
    .dash-cf-view-toggle:active
    {
        transform: scale(0.94);
    }
    .dash-cf-view-toggle ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
    }
    .dash-cf-view-toggle-radial
    {
        background: color-mix(in srgb, var(--energy-solar-color, #ff9800) 22%, transparent);
        color: var(--energy-solar-color, #ff9800);
    }
    .dash-cf-view-toggle-radial:hover
    {
        background: color-mix(in srgb, var(--energy-solar-color, #ff9800) 36%, transparent);
    }
    .dash-cf-view-toggle-graph
    {
        background: color-mix(in srgb, var(--primary-color, #03a9f4) 22%, transparent);
        color: var(--primary-color, #03a9f4);
    }
    .dash-cf-view-toggle-graph:hover
    {
        background: color-mix(in srgb, var(--primary-color, #03a9f4) 36%, transparent);
    }
    /*  Graph view block. Full-height ha-card that replaces the chip strip + radial dial in the dashboard
        CoverFlow when the view mode is 'graph'. Hosts a stretched SVG chart (preserveAspectRatio: none)
        + HTML hover dot overlays. position: relative so the overlays anchor on the block edges, and
        padding: 0 so the dot percentages align with SVG content space (breathing room comes from the
        SVG's internal TOP_MARGIN_Y + BASELINE_Y offsets, not from the wrap padding). */
    ha-card.dash-cf-card-graph-block
    {
        position: relative;
        flex: 1 1 0;
        min-height: 0;
        display: block;
        padding: 0;
        overflow: hidden;
    }

    /*  Pair-mode grid override for the mini-card strip in graph view. The base rule is 1fr 1fr at
        narrow widths and repeat(4, 1fr) at >=640 px containers; graph mode only has 2 cards (production
        + forecast) so we lock it to 2 columns at every width so the cards never end up squished into a
        quarter-row with empty cells. */
    .dash-radial-chip-strip.dash-radial-chip-strip-pair
    {
        grid-template-columns: 1fr 1fr;
    }
    @container (min-width: 640px)
    {
        .dash-radial-chip-strip.dash-radial-chip-strip-pair
        {
            grid-template-columns: 1fr 1fr;
        }
    }
    /*  Forecast mini-card: same chrome as the production / battery / cloud / irradiance ones, just in
        the HA primary blue family so the two graph-mode chips read as a paired set against the
        production-orange + forecast-blue split the chart uses underneath. */
    .dash-radial-badge-forecast .dash-radial-badge-chip
    {
        background: color-mix(in srgb, var(--primary-color, #03a9f4) 22%, transparent);
        color: var(--primary-color, #03a9f4);
    }

    /*  Graph view chart. SVG stretches edge-to-edge via preserveAspectRatio: none so the area + line
        paths fill the full block width and height; HTML hover dots overlay on top via percentages of
        the block bounding box, which keeps them perfectly round (SVG circles would render as ovals
        under the chart's non-square aspect ratio). */
    .dash-graph-svg
    {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
    }
    /*  Night-zone hatch overlay on the dashboard graph. Absolutely-positioned HTML divs sized via
        percent of the chart card (left + width). The diagonal stripes live in CSS pixel space, NOT
        in the SVG user-coordinate space, so the 45 deg angle stays honest regardless of the SVG
        viewport stretch (the chart uses preserveAspectRatio="none" which would warp an SVG
        pattern). Same recipe as .hc-night-zone in the timeline: 1.5 px stroke at 6 px period.
        z-index sits above the SVG fill / line paths but below the hover cursor + dots (z-index 5).
        pointer-events: none so hover stays on the SVG. */
    .dash-graph-night-zone
    {
        position: absolute;
        top: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 3;
        background-image: repeating-linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.12) 0,
            rgba(0, 0, 0, 0.12) 1.5px,
            transparent         1.5px,
            transparent         6px
        );
    }
    ha-card.theme-dark .dash-graph-night-zone
    {
        background-image: repeating-linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.18) 0,
            rgba(255, 255, 255, 0.18) 1.5px,
            transparent              1.5px,
            transparent              6px
        );
    }
    .dash-graph-day-separator
    {
        stroke: color-mix(in srgb, var(--primary-text-color, #ffffff) 45%, transparent);
        stroke-width: 1;
        stroke-dasharray: 3 3;
        vector-effect: non-scaling-stroke;
        fill: none;
    }
    /*  Production area + line + forecast line: colour comes from the inline fill / stroke attribute
        set in renderCardChartBlock so the dashboard chart reads in the same user-configured pvColor
        as the timeline chart. Only the geometric properties live in CSS here. */
    .dash-graph-prod-area
    {
        stroke: none;
    }
    .dash-graph-prod-line
    {
        fill: none;
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
    }
    .dash-graph-forecast-line
    {
        fill: none;
        stroke-width: 1.5;
        stroke-dasharray: 4 3;
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    .dash-graph-cursor
    {
        stroke: var(--primary-text-color, #ffffff);
        stroke-width: 1.5;
        stroke-opacity: 0.7;
        vector-effect: non-scaling-stroke;
        fill: none;
    }
    /*  Hover dots, HTML overlays anchored via percent of the block bounding box (the SVG fills 100 %
        so the SVG content space matches the percent space). Same colour vocabulary as the chart curves
        underneath, primary-text-color outline matches the radial dial + main timeline hover dots so the
        delimitation reads consistently across every chart surface in the card. */
    .dash-graph-hover-dot
    {
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 1.5px solid color-mix(in srgb, var(--primary-text-color, #ffffff) 70%, transparent);
        box-sizing: border-box;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 5;
    }
    .dash-graph-hover-dot-prod
    {
        background: var(--energy-solar-color, #ff9800);
    }
    .dash-graph-hover-dot-forecast
    {
        background: color-mix(in srgb, var(--energy-solar-color, #ff9800) 55%, transparent);
    }

    /*  Hover tooltip on the dashboard graph chart. HTML overlay sitting on top of the cursor line,
        ~14 % down from the top of the chart so the cursor line stays visible above the tooltip and
        reads as "cutting through" rather than disappearing behind. ha-card-style background + radius
        + shadow + border use the HA theme tokens so the tooltip follows light + dark themes the same
        way every other ha-card on the dashboard does. Icon + value pairs, no text label, one row per
        available signal (production + forecast). Centered horizontally on the cursor, clamped via
        max-content so the inline rows lay out tightly. */
    .dash-graph-hover-tooltip
    {
        position: absolute;
        top: 4%;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 4;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px 8px;
        background: var(--card-background-color, var(--ha-card-background, #ffffff));
        color: var(--primary-text-color, #1a1a1a);
        border: 1px solid color-mix(in srgb, var(--primary-text-color, #1a1a1a) 14%, transparent);
        border-radius: var(--ha-card-border-radius, 8px);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
        font-size: 12px;
        font-weight: 500;
        line-height: 1.2;
        white-space: nowrap;
    }
    .dash-graph-hover-tooltip-row
    {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .dash-graph-hover-tooltip-icon
    {
        --mdc-icon-size: 14px;
        width: 14px;
        height: 14px;
    }
    .dash-graph-hover-tooltip-icon-prod
    {
        color: var(--energy-solar-color, #ff9800);
    }
    .dash-graph-hover-tooltip-icon-forecast
    {
        color: color-mix(in srgb, var(--energy-solar-color, #ff9800) 70%, var(--primary-text-color, #1a1a1a) 30%);
    }
    .dash-graph-hover-tooltip-value
    {
        font-variant-numeric: tabular-nums;
    }

    /*  Container queries on the OUTER ha-card width. Each CoverFlow card is 46 cqw wide (~46 % of the ha-card),
        which means a section view at the max 12 x 8 slot (~500 px ha-card) renders cards at ~230 px, where
        2 tiles side by side reduce to ~95 px each and the label "Production 0,0 kWh" no longer fits. So the
        4-tile 2 x 2 grid only stays when there is enough room: ha-card >= 1000 px (panel view, or a wide
        free-form dashboard). Below that we stack to a single column so the labels stay readable. The 600 px
        breakpoint below ALSO swaps the date strip to a short format and hides the day chip when even the
        bandeau width gets tight. */
    @container helios-card (max-width: 1000px)
    {
        /*  On narrow stages the radial dial still wants the card slightly taller than wide so the
            sundial does not crash into the bandeau. Aspect-ratio 5 / 7 keeps the dial focal without
            making the card so wide that the side neighbours get covered. */
        .dash-cf-card { aspect-ratio: 5 / 7; }
    }
    @container helios-card (max-width: 600px)
    {
        .dash-cf-card-date-long  { display: none;   }
        .dash-cf-card-date-short { display: inline; }
        .dash-cf-card-day-chip   { display: none;   }
    }

    /*  Helios radial sundial.
        Concentric rings, inside -> outside: cloud, production, consumption, sundial. Two cursors
        layer over the rings: "now" in primary colour, "hover" in secondary text colour. Four corner
        pills float over the SVG: TL production, TR consumption, BL cloud, BR clock. The SVG is
        capped at a tighter max-width so the dial does not eat the whole card horizontally. */
    /*  Radial card. ha-card host so background / border / border-radius / box-shadow come from
        the HA frontend's own ha-card styles. flex: 1 1 0 so the dial absorbs whatever vertical
        space is left between the strips above and below it. */
    ha-card.dash-radial-wrap
    {
        /*  No padding on the wrap. With a padding > 0 the in-flow flex-centred SVG resolves its
            max-height: 100% against the wrap's CONTENT box (excludes padding) while the absolute-
            positioned hour-labels overlay resolves the same expression against the PADDING box
            (includes padding), and the two reference rectangles drift apart by 2 * padding when
            max-height kicks in on a wider-than-tall panel-view wrap. The labels then sit slightly
            above the annulus they belong to. Setting padding to 0 collapses the two reference
            rectangles onto the same box so the two layers stay aligned at every aspect ratio.
            Corner overlays (clock TL, back-to-live TR, sunrise BL, sunset BR) still get their 6 /
            10 px breathing room from their own top / right / bottom / left offsets. */
        position: relative;
        flex: 1 1 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        min-height: 0;
        height: auto;
        width: auto;
        overflow: hidden;
    }
    /*  Badge strip: a transparent CSS grid containing four HA-tile-card-style badges (Irradiance,
        Cloud, Production, Battery in dial-radius order). The grid switches between 2 columns and
        4 columns at the .dash-cf-card container width breakpoint below, so the strip is always
        either 2 or 4 across, never 1 or 3 (the user explicitly excluded the odd layouts). The
        badges themselves are ha-cards so the strip itself adds no chrome. */
    .dash-radial-chip-strip
    {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        flex-shrink: 0;
    }
    /*  Wide cards fit all four badges on one line. The breakpoint is sized so a single badge
        keeps a comfortable minimum width (~150 px) at the 4-column threshold, narrower cards
        fall back to a 2x2 grid instead. */
    @container (min-width: 640px)
    {
        .dash-radial-chip-strip
        {
            grid-template-columns: repeat(4, 1fr);
        }
    }
    /*  Narrow cards (the 2x2 grid layout, typically a CoverFlow card in a section-view dashboard
        or a phone-portrait window). The badges shrink in lockstep: tighter padding, smaller icon
        disc, smaller icon glyph, smaller label + value font sizes so values like "287 W/m²" or
        "19,3 kWh" stop clipping at the right edge of the badge in the 2-column grid. */
    @container (max-width: 639px)
    {
        ha-card.dash-radial-badge
        {
            gap: 8px;
            padding: 6px 8px;
        }
        .dash-radial-badge-chip
        {
            width: 28px;
            height: 28px;
        }
        .dash-radial-badge-chip ha-icon
        {
            --mdc-icon-size: 18px;
        }
        .dash-radial-badge-label
        {
            font-size: var(--ha-font-size-s, 13px);
        }
        .dash-radial-badge-value
        {
            font-size: var(--ha-font-size-xs, 11px);
        }
    }
    /*  Hour overlay in the top-left of the radial card. Plain HA-frontend text (no chip / no
        chrome) so it reads as a subtle timestamp on top of the dial. Live wall-clock on today's
        card by default, hovered hour while the user hovers the dial, hidden on past / future
        cards with no active hover. */
    .dash-radial-hour-text
    {
        position: absolute;
        top: 6px;
        left: 10px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: var(--ha-font-weight-medium, 500);
        font-variant-numeric: tabular-nums;
        color: var(--secondary-text-color, rgba(255, 255, 255, 0.7));
        pointer-events: none;
        z-index: 1;
        line-height: 1;
    }
    .dash-radial-hour-text ha-icon
    {
        --mdc-icon-size: 14px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        line-height: 0;
    }
    /*  Sunrise + sunset corner overlays sit at the bottom-left + bottom-right of the radial
        card. Same typography + chrome as the top-left clock overlay (HA frontend body token,
        secondary text colour) so the three corners read as one set of structural read-outs:
        clock = where we are in the day, sunrise = when daylight started, sunset = when daylight
        ended. Fixed for the day, no hover update, ha-icon tinted with the sun colour so the
        eye groups the two horizon markers visually. */
    .dash-radial-hour-text-sunrise
    {
        top: auto;
        bottom: 6px;
        left: 10px;
        right: auto;
    }
    .dash-radial-hour-text-sunset
    {
        top: auto;
        bottom: 6px;
        right: 10px;
        left: auto;
    }
    .dash-radial-hour-text-sunrise ha-icon,
    .dash-radial-hour-text-sunset  ha-icon
    {
        color: var(--helios-sun-color, var(--amber-color, #f59e0b));
    }
    /*  "Back to live" button sits in the TOP-RIGHT corner of the radial card, mirroring the
        top-left clock overlay so the four corners read as a paired set: clock = the hovered or
        live time, back-to-live = reset to live (only visible while a hover cursor is parked),
        sunrise + sunset = horizon crossings on the bottom row. Typography matches the clock chip
        so the visual weight stays balanced across all four overlays. */
    .dash-radial-back-to-live
    {
        /*  Box metrics chosen so the visual centre of the button matches the visual centre of the
            top-left .dash-radial-hour-text chip. The chip's effective height is icon-driven (14 px
            mdc icon + line-height: 1 text), the button adds 2 px symmetric padding + a 1 px border
            for a total of 20 px against the chip's 14 px, top: 3px shifts the button up so both
            chips visually align on the horizontal centre line of the top-corners row. */
        position: absolute;
        top: 3px;
        right: 10px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: var(--ha-font-family-body, inherit);
        font-size: var(--ha-font-size-s, 12px);
        font-weight: var(--ha-font-weight-medium, 500);
        font-variant-numeric: tabular-nums;
        color: var(--primary-text-color, #ffffff);
        background: color-mix(in srgb, var(--primary-text-color, #ffffff) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-text-color, #ffffff) 25%, transparent);
        border-radius: 999px;
        padding: 2px 10px 2px 8px;
        cursor: pointer;
        line-height: 1;
        z-index: 3;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .dash-radial-back-to-live:hover
    {
        background: color-mix(in srgb, var(--primary-text-color, #ffffff) 18%, transparent);
        border-color: color-mix(in srgb, var(--primary-text-color, #ffffff) 40%, transparent);
    }
    .dash-radial-back-to-live ha-icon
    {
        --mdc-icon-size: 14px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        line-height: 0;
    }
    /*  Hide the back-to-live button on pointing devices that have a real hover (= mouse, trackpad,
        stylus on a desktop). On those the pointerleave handler already clears the hover cursor when
        the pointer drifts off the dial, the button is redundant chrome. Keep the button visible on
        coarse-pointer / no-hover devices (phones, tablets) where the tap-to-set affordance has no
        symmetric "tap-off-to-clear" gesture. */
    @media (hover: hover) and (pointer: fine)
    {
        .dash-radial-back-to-live
        {
            display: none;
        }
    }
    /*  HA-frontend tile-card-style badge: ha-card host (chrome from HA frontend) with a circular
        tinted icon chip on the left and a two-line text stack on the right (entity LABEL on top,
        live VALUE below). Padding + gap mirror the HA tile-card the user shared (Lave-vaisselle /
        0 W). min-width: 0 + flex + ellipsis on the text spans guarantee the badge never breaks
        its 1-line label / 1-line value layout, regardless of how narrow the grid column is. */
    ha-card.dash-radial-badge
    {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        min-height: 0;
        height: auto;
        width: auto;
    }
    .dash-radial-badge-chip
    {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        flex-shrink: 0;
    }
    .dash-radial-badge-chip ha-icon
    {
        --mdc-icon-size: 22px;
        color: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
    }
    .dash-radial-badge-stack
    {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
    }
    /*  Label + value typography pulled straight off the HA frontend tokens so the badge tracks
        the active HA theme's font sizes and weights. Label is the entity name (primary text
        colour, medium weight), value is the live reading (secondary text colour, regular
        weight), both ellipsised on overflow so a 2-column layout never wraps text. */
    .dash-radial-badge-label
    {
        font-family: var(--ha-font-family-body, inherit);
        font-size: var(--ha-font-size-m, 14px);
        font-weight: var(--ha-font-weight-medium, 500);
        line-height: 1.25;
        color: var(--primary-text-color, #ffffff);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
    }
    .dash-radial-badge-value
    {
        font-family: var(--ha-font-family-body, inherit);
        font-size: var(--ha-font-size-s, 12px);
        font-weight: var(--ha-font-weight-normal, 400);
        line-height: 1.25;
        font-variant-numeric: tabular-nums;
        color: var(--secondary-text-color, rgba(255, 255, 255, 0.7));
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
    }
    /*  Per-badge accent on the icon chip (the badge body itself stays neutral so the strip reads
        cohesively). Production + battery follow the HA energy palette tokens, cloud uses the
        secondary-text-color so the icon matches the grey cloud ring rendered in the dial below. */
    .dash-radial-badge-prod .dash-radial-badge-chip
    {
        background: color-mix(in srgb, var(--energy-solar-color, #ff9800) 22%, transparent);
        color: var(--energy-solar-color, #ff9800);
    }
    .dash-radial-badge-batt .dash-radial-badge-chip
    {
        background: color-mix(in srgb, var(--state-icon-color, var(--primary-text-color, #ffffff)) 18%, transparent);
        color: var(--state-icon-color, var(--primary-text-color, #ffffff));
    }
    .dash-radial-badge-batt-charge .dash-radial-badge-chip
    {
        background: color-mix(in srgb, var(--energy-battery-in-color, #f06292) 22%, transparent);
        color: var(--energy-battery-in-color, #f06292);
    }
    .dash-radial-badge-batt-discharge .dash-radial-badge-chip
    {
        background: color-mix(in srgb, var(--energy-battery-out-color, #4db6ac) 22%, transparent);
        color: var(--energy-battery-out-color, #4db6ac);
    }
    .dash-radial-badge-cloud .dash-radial-badge-chip
    {
        background: color-mix(in srgb, var(--secondary-text-color, rgba(255, 255, 255, 0.65)) 22%, transparent);
        color: var(--secondary-text-color, rgba(255, 255, 255, 0.65));
    }
    .dash-radial-badge-irr .dash-radial-badge-chip
    {
        background: color-mix(in srgb, var(--helios-sun-color, var(--amber-color, #f59e0b)) 22%, transparent);
        color: var(--helios-sun-color, var(--amber-color, #f59e0b));
    }
    .dash-radial-svg
    {
        /*  Width caps at 92 % of the available card column so the dial reads as the focal element
            without crowding the side gutters. Height caps at the available space, the aspect ratio
            stays 1 / 1 so the dial is always a true circle. touch-action: none disables the
            browser's default scroll / pan / zoom gestures inside the dial so a finger drag for the
            hover cursor on mobile no longer scrolls the page underneath. */
        width:      min(100%, 92%);
        height:     auto;
        max-height: 100%;
        aspect-ratio: 1 / 1;
        display: block;
        touch-action: none;
    }
    /*  Constant stroke width across SVG render sizes. Every stroke (ring borders, ticks, cursors,
        curve outlines, sun bars) renders at the same apparent thickness regardless of viewBox
        scaling, matching the way the mini-card borders stay 1 px in both section view and panel
        view. The ring TRACKS are explicitly opted out because their stroke IS the annulus shape
        (stroke-width = ring thickness), so they MUST scale with the viewBox or the annulus
        collapses to a hairline in panel-view. */
    .dash-radial-svg *
    {
        vector-effect: non-scaling-stroke;
    }
    .dash-radial-svg .dash-radial-cloud-track,
    .dash-radial-svg .dash-radial-cloud-track-future,
    .dash-radial-svg .dash-radial-prod-track,
    .dash-radial-svg .dash-radial-prod-track-future,
    .dash-radial-svg .dash-radial-batt-track,
    .dash-radial-svg .dash-radial-batt-track-future,
    .dash-radial-svg .dash-radial-dial-track
    {
        vector-effect: none;
    }
    /*  Hover dots. Plain coloured disc per curve, thin primary-text-color stroke so the dot reads as
        a circled marker on both themes (the previous card-background stroke vanished against the
        track in the same colour family). Same colour token as the ring borders + the sun-rim outer
        contour so every theme-aware delimiter on the dial agrees. */
    .dash-radial-dot
    {
        pointer-events: none;
        stroke: color-mix(in srgb, var(--primary-text-color, #ffffff) 70%, transparent);
        stroke-width: 0.6;
    }
    .dash-radial-dot-cloud         { fill: color-mix(in srgb, var(--secondary-text-color, rgba(255, 255, 255, 0.75)) 95%, transparent); }
    .dash-radial-dot-irr           { fill: var(--helios-sun-color, var(--amber-color, #f59e0b)); }
    .dash-radial-dot-prod          { fill: var(--energy-solar-color, #ff9800); }
    .dash-radial-dot-batt-charge   { fill: var(--energy-battery-in-color, #f06292); }
    .dash-radial-dot-batt-discharge{ fill: var(--energy-battery-out-color, #4db6ac); }

    /*  Ring tracks (background of each ring). Same vocabulary across the three data rings, only the
        token differs so each ring picks up the right energy-palette colour. The dial track is
        slightly stronger so it reads as a structural anchor for the hour labels + ticks living
        inside it. */
    .dash-radial-cloud-track
    {
        stroke: color-mix(in srgb, var(--secondary-text-color, rgba(255, 255, 255, 0.55)) 12%, transparent);
    }
    .dash-radial-prod-track
    {
        stroke: color-mix(in srgb, var(--energy-solar-color, #ff9800) 14%, transparent);
    }
    .dash-radial-batt-track
    {
        stroke: color-mix(in srgb, var(--energy-battery-in-color, #f06292) 10%, transparent);
    }
    .dash-radial-dial-track
    {
        /*  Day-zone of the dial annulus. Theme-tracking via --primary-text-color (white in dark
            theme, black in light) at a stronger opacity than the previous divider-color recipe
            so the track has enough contrast against the card background to read as a clear ring,
            in both themes. */
        stroke: color-mix(in srgb, var(--primary-text-color, rgba(255, 255, 255, 0.7)) 18%, transparent);
    }
    /*  Not-yet-elapsed half of each data ring background. Same stroke colour as the past arc but
        at a much reduced opacity so the background reads as "this hasn't happened yet". Painted
        as a separate arc path so the past + future halves can be styled independently without
        having to mask a single full-circle track. */
    .dash-radial-cloud-track-future,
    .dash-radial-prod-track-future,
    .dash-radial-batt-track-future
    {
        opacity: 0.35;
    }
    .dash-radial-cloud-track-future { stroke: color-mix(in srgb, var(--secondary-text-color, rgba(255, 255, 255, 0.55)) 12%, transparent); }
    .dash-radial-prod-track-future  { stroke: color-mix(in srgb, var(--energy-solar-color, #ff9800) 14%, transparent); }
    .dash-radial-batt-track-future  { stroke: color-mix(in srgb, var(--energy-battery-in-color, #f06292) 10%, transparent); }

    /*  Ring fills + future outlines. Past portions render as filled polygons (solid area below the
        curve), future portions as dashed outlines without fill. Same vocabulary on cloud /
        production rings (both have a forecast). Consumption is past only so no future class is
        needed. */
    .dash-radial-cloud-fill
    {
        fill:   color-mix(in srgb, var(--secondary-text-color, rgba(255, 255, 255, 0.65)) 35%, transparent);
        stroke: color-mix(in srgb, var(--secondary-text-color, rgba(255, 255, 255, 0.65)) 70%, transparent);
        stroke-width: 1.1;
        stroke-linejoin: round;
    }
    .dash-radial-cloud-fill-future
    {
        /*  Future zone of the cloud ring: same fill colour as the past zone but at a lower
            opacity, so the dial reads as "past data full strength, forecast wash on top". The
            dashed outline (.dash-radial-cloud-future) sits on top of this wash as the contour. */
        fill:   color-mix(in srgb, var(--secondary-text-color, rgba(255, 255, 255, 0.65)) 14%, transparent);
        stroke: none;
    }
    .dash-radial-cloud-future
    {
        fill: none;
        stroke: color-mix(in srgb, var(--secondary-text-color, rgba(255, 255, 255, 0.65)) 60%, transparent);
        stroke-width: 1.2;
        stroke-dasharray: 4 3;
        stroke-linejoin: round;
        stroke-linecap: round;
    }
    /*  Irradiance curve overlaid on the SAME cloud-ring annulus. Sun-coloured semi-transparent fill
        so the cloud grey underneath shows through where both curves rise together (cloudy hour with
        non-zero irradiance), the eye reads the hour as "sunny" when the warm tint dominates and
        "cloudy" when the grey wins. Mirrors the timeline chart vocabulary where both signals share
        the same axis at low alphas. */
    .dash-radial-irr-fill
    {
        fill:   color-mix(in srgb, var(--helios-sun-color, var(--amber-color, #f59e0b)) 40%, transparent);
        stroke: color-mix(in srgb, var(--helios-sun-color, var(--amber-color, #f59e0b)) 75%, transparent);
        stroke-width: 1.1;
        stroke-linejoin: round;
    }
    .dash-radial-irr-fill-future
    {
        /*  Future zone of the irradiance curve: same hue as the past zone at a lower opacity so the
            forecast irradiance reads as a wash under the dashed contour. Same recipe as the cloud
            future fill but in the sun colour. */
        fill:   color-mix(in srgb, var(--helios-sun-color, var(--amber-color, #f59e0b)) 18%, transparent);
        stroke: none;
    }
    .dash-radial-irr-future
    {
        fill: none;
        stroke: color-mix(in srgb, var(--helios-sun-color, var(--amber-color, #f59e0b)) 65%, transparent);
        stroke-width: 1.2;
        stroke-dasharray: 4 3;
        stroke-linejoin: round;
        stroke-linecap: round;
    }
    .dash-radial-prod-fill
    {
        fill:   color-mix(in srgb, var(--energy-solar-color, #ff9800) 55%, transparent);
        stroke: color-mix(in srgb, var(--energy-solar-color, #ff9800) 85%, transparent);
        stroke-width: 1.2;
        stroke-linejoin: round;
    }
    .dash-radial-prod-fill-future
    {
        /*  Future zone of the production ring: half-opacity orange wash under the dashed
            forecast outline so the user sees the forecast volume as a softer tint of the past
            fill, without losing the contour line. */
        fill:   color-mix(in srgb, var(--energy-solar-color, #ff9800) 22%, transparent);
        stroke: none;
    }
    .dash-radial-prod-future
    {
        fill: none;
        stroke: color-mix(in srgb, var(--energy-solar-color, #ff9800) 75%, transparent);
        stroke-width: 1.4;
        stroke-dasharray: 4 3;
        stroke-linejoin: round;
        stroke-linecap: round;
    }
    /*  Battery ring fills. Two annulus paths share the ring, charge (positive battery flow) in
        the HA Energy charge-in colour and discharge (negative) in the discharge-out colour. The
        ring's two halves overlap at the inner edge baseline where the battery is at rest. */
    .dash-radial-batt-charge
    {
        fill:   color-mix(in srgb, var(--energy-battery-in-color, #f06292) 55%, transparent);
        stroke: color-mix(in srgb, var(--energy-battery-in-color, #f06292) 85%, transparent);
        stroke-width: 1.2;
        stroke-linejoin: round;
    }
    .dash-radial-batt-discharge
    {
        fill:   color-mix(in srgb, var(--energy-battery-out-color, #4db6ac) 55%, transparent);
        stroke: color-mix(in srgb, var(--energy-battery-out-color, #4db6ac) 85%, transparent);
        stroke-width: 1.2;
        stroke-linejoin: round;
    }

    /*  Sundial perimeter. Three tick weights (hour > half > quarter), each drawn on BOTH the outer
        and inner edges of the dial annulus so the user sees the markers regardless of which side
        of the labels they look at. Hour labels use the HA primary TEXT colour so they read as
        white on dark themes and black on light themes, matching the rest of the HA frontend. */
    .dash-radial-tick-hour
    {
        stroke: var(--primary-text-color, #ffffff);
        stroke-width: 1.4;
        stroke-linecap: round;
    }
    .dash-radial-tick-half
    {
        stroke: color-mix(in srgb, var(--primary-text-color, #ffffff) 65%, transparent);
        stroke-width: 1;
        stroke-linecap: round;
    }
    .dash-radial-tick-quarter
    {
        stroke: color-mix(in srgb, var(--primary-text-color, #ffffff) 35%, transparent);
        stroke-width: 0.7;
        stroke-linecap: round;
    }
    /*  Hour labels are rendered as an HTML overlay OUTSIDE the SVG so the font-size is just CSS
        pixels, not affected by the viewBox / display scaling that made the previous SVG <text>
        labels grow enormous in panel-view. The overlay matches the SVG's footprint (same width
        cap + aspect ratio + centring) so the per-hour percentage positions land on the same
        circle the dial ticks anchor to. The labels themselves are absolutely positioned by JS-
        computed left / top percentages + a rotate() transform that matches the radial label
        orientation the SVG used. */
    .dash-radial-hour-labels
    {
        position: absolute;
        top: 50%;
        left: 50%;
        width: min(100%, 92%);
        aspect-ratio: 1 / 1;
        max-height: 100%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 2;
    }
    .dash-radial-hour-label
    {
        position: absolute;
        font-family: var(--ha-font-family-body, inherit);
        font-size: var(--ha-font-size-s, 13px);
        font-weight: var(--ha-font-weight-medium, 500);
        color: var(--primary-text-color, #ffffff);
        font-variant-numeric: tabular-nums;
        line-height: 1;
        white-space: nowrap;
    }
    /*  Hour labels render at every hour, every width: the dial geometry fits all 24 numerals
        comfortably even on the narrowest CoverFlow card sizes. */

    /*  Sun halo: a soft sun-coloured glow ring sitting behind the disc. Stroke is none, the fill
        is the per-card radial gradient defined in the SVG <defs>. The halo grows from the rim out
        to the pre-shrink envelope at 100 % irradiance, the gradient fades to fully transparent at
        the outer edge so it blends into the cloud ring instead of cutting a hard circle. */
    .dash-radial-sun-halo
    {
        stroke: none;
        pointer-events: none;
    }
    /*  Sunrise / sunset bars painted INSIDE the dial annulus as a sun-coloured radial stroke
        spanning the full width of the ring at the exact hour of the horizon crossing. Replaces
        the previous mdi-icon markers, which competed for space with the hour ticks and had to
        fight CSS px / SVG-unit scale ratios. A single radial bar reads as one bold horizon line
        per crossing, no rotation or symbol orientation to worry about. */
    .dash-radial-sun-bar
    {
        stroke: var(--helios-sun-color, var(--amber-color, #f59e0b));
        stroke-width: 2.6;
        stroke-linecap: round;
        pointer-events: none;
    }
    /*  Sun layers, same recipe as the 3D card sun. NO background tinted disc this revision: the
        user asked for just a reference rim + an irradiance fill so the centre reads as a single
        clean disc growing inside a circle. */
    .dash-radial-sun-bg
    {
        /*  Background plate in the sun colour itself at low opacity, so the "empty disc" reads as
            a faint coloured wash inside the reference rim. */
        fill: var(--helios-sun-color, var(--amber-color, #f59e0b));
        fill-opacity: 0.18;
    }
    .dash-radial-sun-fill
    {
        fill: var(--helios-sun-color, var(--amber-color, #f59e0b));
        /*  Thin contrasting stroke around the irradiance disc itself so the orange fill always has
            a visible edge against the faint background wash behind it, even at small disc sizes. */
        stroke: color-mix(in srgb, var(--primary-text-color, #ffffff) 45%, transparent);
        stroke-width: 0.5;
    }
    .dash-radial-sun-rim
    {
        /*  Reference rim takes the sun colour exactly, no darkening, so the rim reads as the
            outline of the same sun the rest of the card paints. */
        stroke: var(--helios-sun-color, var(--amber-color, #f59e0b));
        stroke-width: 1.4;
    }

    /*  Thin annulus border lines. Drawn at each ring's inner + outer edges so the user reads each
        ring as a clearly delimited band rather than a fuzzy gradient. Stroke in the HA frontend's
        primary text colour at moderate opacity, the borders track the active theme (white-ish on a
        dark theme, dark on a light theme) and stay visibly contoured against the card background
        either way. */
    .dash-radial-ring-border
    {
        stroke: color-mix(in srgb, var(--primary-text-color, #ffffff) 70%, transparent);
        stroke-width: 0.6;
    }

    /*  Night arc inside the dial annulus, from sunset clockwise through midnight to sunrise.
        Theme-aware via prefers-color-scheme so the night reads as darker than the day in both
        themes without being overly heavy: in a dark theme the card background is already dark
        so the night only needs a light reinforcement (0.30 black), in a light theme the card
        background is bright so a softer 0.18 black still reads as noticeably darker than the
        day track without crushing the area to charcoal. */
    .dash-radial-night
    {
        fill: rgba(0, 0, 0, 0.30);
        stroke: none;
        pointer-events: none;
    }
    @media (prefers-color-scheme: light)
    {
        .dash-radial-night
        {
            fill: rgba(0, 0, 0, 0.18);
        }
    }
    /*  Hover cursor styled exactly like the 3D card's solar-ray leader: sun-coloured stroke,
        5-5 dashed pattern, stroke-opacity 0.55, line-cap round. Anchored at the outer edge of
        the irradiance reference rim and ending at the outer edge of the sundial, so the cursor
        reads as a radial ray from the sun across the data rings out to the dial perimeter. */
    .dash-radial-cursor-hover
    {
        /*  Thin solid line in the HA frontend's primary text colour, theme-aware (white on dark
            themes, black on light) so it reads against both card backgrounds without needing a
            secondary outline halo. Hover variant stays subtle, the now variant below pushes the
            stroke + opacity up. */
        stroke: var(--primary-text-color, #ffffff);
        stroke-width: 1.4;
        stroke-opacity: 0.55;
        stroke-linecap: round;
        fill: none;
        pointer-events: none;
    }
    /*  The "now" cursor on today's card carries more weight than a passing hover ray, it anchors the
        current wall-clock hour and the user needs to spot it instantly at a glance. Same colour
        family as the hover variant, just a bolder stroke and higher opacity so the live cursor reads
        as the primary pointer and the hover variant as the secondary one. */
    .dash-radial-cursor-now
    {
        stroke-width: 2;
        stroke-opacity: 0.95;
    }

    /*  Close button anchored top-right of the focused card, not the panel. Mirrors the previous
        .detail-close-btn shape (28 px round, primary tint, soft shadow) but now lives inside the front card so
        it travels with the navigation rather than sitting in a fixed corner of the screen. */
    /*  Close button, now a flex / grid child of the bandeau instead of an absolute-positioned overlay. Sits on
        the right edge of the bandeau next to the date group and auto-aligns vertically with the weather chip
        on the opposite side. line-height: 0 + inline-flex centred ha-icon keeps the glyph rendered on the
        exact centre. */
    .dash-cf-close-btn
    {
        width: 30px;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 50%;
        background: var(--primary-color, #03a9f4);
        color: var(--text-primary-color, #ffffff);
        cursor: pointer;
        padding: 0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
        transition: transform 160ms ease;
        line-height: 0;
        flex-shrink: 0;
    }
    .dash-cf-close-btn:hover  { transform: scale(1.06); }
    .dash-cf-close-btn:active { transform: scale(0.94); }
    .dash-cf-close-btn ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
    }

    /*  Hover highlight on every card: border picks up the active theme primary so the user gets a clear
        visual cue that the card is interactive. */
    .dash-cf-card:hover
    {
        border-color: var(--primary-color, #03a9f4);
    }

    /*  Perspective-driven gradient blur. A ::after overlay sits on top of every side card with a
        backdrop-filter blur and a linear-gradient mask that fades from opaque on the AWAY-from-centre edge to
        transparent on the TOWARDS-centre edge. The overlay therefore blurs only the half of the card that is
        further from the focal centre, giving the depth-of-field cue the user asked for, while the other half
        stays sharp. ±1 cards get a softer blur (3 px), ±2 get a stronger one (6 px). */
    /*  Depth cue without backdrop-filter: side cards just get an opacity drop. backdrop-filter created a
        new stacking context per back card that bled into the front card's compositing, the front-card
        content read as blurry as a side effect. Replaced with plain opacity, no GPU layer hint, no front
        card side effect. */
    /*  Side cards subtly faded so the focused front card carries the eye, but still visible
        enough that the user can tell which days are stacked behind. J-1 / J+1 sit at 90 %
        opacity (just a 10 % haze, the eye still reads them clearly), J-2 / J+2 fade further to
        70 % so the further-away cards read as more distant in the stack. */
    .dash-cf-card[data-delta="-1"], .dash-cf-card[data-delta="1"]  { opacity: 0.90; }
    .dash-cf-card[data-delta="-2"], .dash-cf-card[data-delta="2"]  { opacity: 0.70; }

    /*  Enter / exit animation, 1 s total, staged in three phases. The cards translate from BEHIND their forward
        neighbour to their resting transform:
        - 0 - 300 ms: front (today) card fades in at the centre (or out on exit).
        - 300 - 650 ms: ±1 cards slide out from behind the front card to their resting position (reverse on exit).
        - 650 - 1000 ms: ±2 cards slide out from behind the ±1 cards (reverse on exit).
        Each keyframe's "to" state must match the inline transform / opacity (txPct 50 / 80, scale 0.85 / 0.70,
        rotY 25 / 45 deg) so the handover to inline-only styling at animation end is seamless. fill-mode: both
        keeps the from-state visible during the delay and the to-state visible after the animation completes.
        Cards stop accepting click during the animation window (pointer-events: none) so an in-flight slide
        cannot navigate to a different day half-way through.                                                    */
    .dash-cf-stage.dash-cf-entering .dash-cf-card,
    .dash-cf-stage.dash-cf-exiting  .dash-cf-card
    {
        pointer-events: none;
    }
    @keyframes dash-cf-enter-front
    {
        /*  Scale + opacity so the entrance is visible even while the parent .detail-panel runs its own 250 ms
            opacity fade-in (the two overlap during 0-250 ms; the parent fade alone would mask a pure opacity
            change on the card). Drop opacity to 0 too so the card properly fades in once the panel settles. */
        0%   { opacity: 0; transform: scale(0.92); }
        100% { opacity: 1; transform: scale(1);    }
    }
    @keyframes dash-cf-enter-mid-left
    {
        0%   { transform: perspective(2400px) translateX(0%)   scale(1)    rotateY(0deg);   opacity: 0; }
        100% { transform: perspective(2400px) translateX(-32%) scale(0.74) rotateY(-22deg); opacity: 1; }
    }
    @keyframes dash-cf-enter-mid-right
    {
        0%   { transform: perspective(2400px) translateX(0%)  scale(1)    rotateY(0deg);  opacity: 0; }
        100% { transform: perspective(2400px) translateX(32%) scale(0.74) rotateY(22deg); opacity: 1; }
    }
    @keyframes dash-cf-enter-back-left
    {
        0%   { transform: perspective(2400px) translateX(-32%) scale(0.74) rotateY(-22deg); opacity: 0; }
        100% { transform: perspective(2400px) translateX(-50%) scale(0.58) rotateY(-38deg); opacity: 1; }
    }
    @keyframes dash-cf-enter-back-right
    {
        0%   { transform: perspective(2400px) translateX(32%) scale(0.74) rotateY(22deg); opacity: 0; }
        100% { transform: perspective(2400px) translateX(50%) scale(0.58) rotateY(38deg); opacity: 1; }
    }
    .dash-cf-stage.dash-cf-entering .dash-cf-card[data-day-offset="0"]  { animation: dash-cf-enter-front      300ms ease-out 0ms   both; }
    .dash-cf-stage.dash-cf-entering .dash-cf-card[data-day-offset="-1"] { animation: dash-cf-enter-mid-left   350ms ease-out 300ms both; }
    .dash-cf-stage.dash-cf-entering .dash-cf-card[data-day-offset="1"]  { animation: dash-cf-enter-mid-right  350ms ease-out 300ms both; }
    .dash-cf-stage.dash-cf-entering .dash-cf-card[data-day-offset="-2"] { animation: dash-cf-enter-back-left  350ms ease-out 650ms both; }
    .dash-cf-stage.dash-cf-entering .dash-cf-card[data-day-offset="2"]  { animation: dash-cf-enter-back-right 350ms ease-out 650ms both; }

    @keyframes dash-cf-exit-back-left
    {
        0%   { transform: perspective(2400px) translateX(-50%) scale(0.58) rotateY(-38deg); opacity: 1; }
        100% { transform: perspective(2400px) translateX(-32%) scale(0.74) rotateY(-22deg); opacity: 0; }
    }
    @keyframes dash-cf-exit-back-right
    {
        0%   { transform: perspective(2400px) translateX(50%) scale(0.58) rotateY(38deg); opacity: 1; }
        100% { transform: perspective(2400px) translateX(32%) scale(0.74) rotateY(22deg); opacity: 0; }
    }
    @keyframes dash-cf-exit-mid-left
    {
        0%   { transform: perspective(2400px) translateX(-32%) scale(0.74) rotateY(-22deg); opacity: 1; }
        100% { transform: perspective(2400px) translateX(0%)   scale(1)    rotateY(0deg);   opacity: 0; }
    }
    @keyframes dash-cf-exit-mid-right
    {
        0%   { transform: perspective(2400px) translateX(32%) scale(0.74) rotateY(22deg); opacity: 1; }
        100% { transform: perspective(2400px) translateX(0%)  scale(1)    rotateY(0deg);  opacity: 0; }
    }
    @keyframes dash-cf-exit-front
    {
        /*  Symmetric exit: scale down + fade out. The parent .detail-panel does NOT fade out (it just unmounts
            at t=1 s), so this is the only motion on the front card during exit. */
        0%   { opacity: 1; transform: scale(1);    }
        100% { opacity: 0; transform: scale(0.92); }
    }
    .dash-cf-stage.dash-cf-exiting .dash-cf-card[data-day-offset="-2"] { animation: dash-cf-exit-back-left  350ms ease-in 0ms   both; }
    .dash-cf-stage.dash-cf-exiting .dash-cf-card[data-day-offset="2"]  { animation: dash-cf-exit-back-right 350ms ease-in 0ms   both; }
    .dash-cf-stage.dash-cf-exiting .dash-cf-card[data-day-offset="-1"] { animation: dash-cf-exit-mid-left   350ms ease-in 350ms both; }
    .dash-cf-stage.dash-cf-exiting .dash-cf-card[data-day-offset="1"]  { animation: dash-cf-exit-mid-right  350ms ease-in 350ms both; }
    .dash-cf-stage.dash-cf-exiting .dash-cf-card[data-day-offset="0"]  { animation: dash-cf-exit-front      300ms ease-in 700ms both; }



    /*  Timeline, pinned to the bottom of the card with uniform
        breathing space. The whole bar accepts pointer events for
        scrub. */

    .time-bar
    {
        position: absolute;
        /*  Bottom inset matches the time-bar's internal flex gap.
            With the day-label chip row pinned as the last flex
            child, an equal inset above (gap to the chart card) and
            below (gap to the card edge) centres the chip row in
            the band between the chart card's bottom edge and the
            card's bottom edge.                                       */
        bottom: 6px;
        /*  Centred via left + right gutter instead of transform: translateX(-50%) because the transform
            promoted the time-bar into a compositor layer that rasterised the inner SVG charts + tooltips
            at fractional resolution = blur. With left: 8 px + right: 8 px + width: auto the timeline is
            still 100 % - 16 px wide but renders at native pixel resolution. */
        left: 8px;
        right: 8px;
        width: auto;
        /*  Timeline owns its own stacking layer at the very top of
            the card so the sun arc, the home glow and any overlay
            chip never crosses over it during auto-rotate.            */
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        cursor: grab;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    }

    .time-bar:active
    {
        cursor: grabbing;
    }

    /*  Chart card, bordered white panel hosting the area chart,
        day-label chips on the midline, dotted day separators and
        the live + scrub HTML cursor overlays. */
    .tb-chart-card
    {
        position: relative;
        background: var(--card-background-color, #ffffff);
        /*  Theme-aware ink border so the chart cards stand out
            against the basemap on both palettes. The 0.55 alpha
            keeps the stroke visible without dominating the chart
            content underneath. */
        border: 2px solid rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.55);
        border-radius: 8px;
        box-shadow: 0 1px 3px var(--shadow-color);
        /*  Height scales with the card's container width (cqw =
            container-query width). 36 px floor on a small grid tile,
            72 px ceiling on a fullscreen kiosk. Both timeline charts
            share the same expression so they always stay siblings of
            the same height. */
        height: clamp(36px, 8cqw, 72px);
        overflow: hidden;
    }
    ha-card.theme-dark .tb-chart-card
    {
        border-color: rgba(255, 255, 255, 0.55);
    }

    .hc-chart-svg
    {
        display: block;
        width: 100%;
        height: 100%;
    }

    /*  Stroke-only outline on top of the filled area so peaks read
        cleanly even where the gradient fades towards the midline.
        Stroke width 0.7 px so the curve reads as a hairline
        trace; a wider stroke (the earlier 1.4 px default) stacked
        over itself on every wobble on high-variation days and
        turned the dense regions into a smudged band. At 0.7 px
        the curve stays a line at any zoom.                       */
    .hc-chart-line
    {
        fill: none;
        stroke-width: 0.7;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
        opacity: 0.95;
        pointer-events: none;
    }

    /*  PV prediction line, overlays the observed PV chart for hours
        past "now" using the user-configured peak power (pv-peak-kwp)
        scaled by the clear-sky model. Dashed pattern, the stroke
        colour itself is computed theme-aware in charts.ts so the
        forecast curve stays readable on both backgrounds.          */
    .hc-chart-predicted
    {
        stroke-dasharray: 4 3;
        stroke-width: 1;
    }

    /*  Per-source PV curves, one per HA Energy solar source on multi-source installs. Drawn UNDER the aggregate
        line with lower opacity + the same 0.7 px stroke so the eye reads them as background context to the
        headline total above. The stroke colour comes from the inline stroke attribute (a hue-rotated derivative
        of the theme PV colour, see pvSourceColor in charts.ts) so the curve matches the colour pastille on the
        corresponding tooltip row. */
    .hc-chart-line-source
    {
        opacity: 0.35;
    }



    /*  Dotted day separators inside the chart card. Boosted to 0.55
        alpha (was 0.30) and a slightly chunkier dash pattern so the
        midnight boundaries between two days read clearly without the
        eye having to hunt for them. Flips with the theme via
        --rgb-primary-text-color. */
    .hc-day-sep
    {
        stroke: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.55);
        stroke-width: 1.2;
        stroke-dasharray: 2 2.5;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }

    /*  Solid midline splitting irradiance (top) from cloud
        cover (bottom). Day-label chips overlay it. Token-driven so
        the line flips with the theme. */
    .hc-chart-mid
    {
        stroke: var(--primary-text-color, #212121);
        stroke-width: 1.4;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }

    /*  Tiny hour ticks centred on the midline. Discreet enough to
        read as ambient texture rather than a primary feature. */
    .hc-hour-tick
    {
        stroke: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.35);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }

    /*  Live cursor: thin line spanning the full chart with a small
        triangle handle at the top. Slightly wider + a hair more
        opaque than earlier iterations so it stays readable through
        the future-mask wash that paints on top of half the chart.
        Still kept subtle: it's a passive "where now is" reference,
        not a focus target. */
    .tb-cursor-now
    {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.5);
        border-radius: 999px;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 4;
    }
    /*  No top arrow on the pill, just the stroke. Reads cleaner
        against the chart and matches the rounded chip language of
        the rest of the card. */

    /*  Scrub cursor: a thin solid brand-blue stroke spanning the
        chart. No arrow, no handle dot, no pseudo-element, just a
        single line so the cursor reads as a minimal scrub mark. */
    .tb-cursor-sel
    {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1.5px;
        background: var(--primary-color, #03a9f4);
        border-radius: 999px;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 4;
        box-shadow: 0 0 4px rgba(var(--rgb-primary-color), 0.4);
    }

    /*  Hover guide line, drawn vertically across the chart at
        the pointer's X. Same dotted recipe as the day-separator
        lines but a touch more opaque so it reads as "interactive
        focus" rather than ambient structure.                       */
    .hc-hover-guide
    {
        stroke: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.55);
        stroke-width: 1;
        stroke-dasharray: 2 2;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }

    /*  Per-curve hover dot, anchored at the interpolated Y of each series. Stroked in the HA
        primary text colour so the dot reads as a circled marker on both themes (white on dark,
        black on light), matching the radial dial's hover dots. */
    .hc-hover-dot
    {
        stroke: color-mix(in srgb, var(--primary-text-color, #ffffff) 70%, transparent);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
    }
    /*  Timeline curve hover dot rendered as an absolutely-positioned HTML element overlay on
        the chart card. The chart SVG uses preserveAspectRatio="none" so the area + line paths
        stretch with the chart container width, but the previous SVG <circle r="3"> hover dots
        were stretched too and ended up as tall ovals / cylinders at common chart aspect ratios.
        Pulling the dots out into HTML CSS-pixel ovals (perfectly round via width = height +
        border-radius 50%) decouples the dot shape from the SVG stretch, the user always sees a
        circular marker centred on the curve. Position derived from the SVG hoverX / W and hoverY
        / H ratios, the chart card and the SVG share the same content area so percentages map
        cleanly between the two coordinate spaces. */
    .hc-hover-dot-html
    {
        position: absolute;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        border: 1.5px solid color-mix(in srgb, var(--primary-text-color, #ffffff) 70%, transparent);
        box-sizing: border-box;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 5;
    }

    /*  Hover tooltip card, sits above the chart-card stack inside
        the time-bar. Frame + padding match HA Energy dashboard chart
        tooltips so the card reads as native HA chrome (card-background
        surface, HA divider border, HA standard elevation shadow). */
    /*  Wrapper that hosts the magnet tab + tooltip body. Carries the
        horizontal positioning (left + translateX) so both children
        slide together as one block when the scrub moves, the tab
        inherits the wrapper's transform via the DOM tree so there's
        no per-element lag. Bottom + margin lift the whole stack into
        the 10 px gap above the chart card. */
    .tb-hover-tooltip-wrapper
    {
        position: absolute;
        bottom: 100%;
        margin-bottom: 10px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
        z-index: 30;
    }
    .tb-hover-tooltip
    {
        position: relative;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-text-color, #212121);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        border-radius: 4px;
        padding: 6px 8px;
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.16), 0 1px 4px 0 rgba(0, 0, 0, 0.06);
        font-family: var(--ha-font-family-body, 'Roboto', sans-serif);
        font-size: var(--ha-font-size-s, 12px);
        line-height: 1.25;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        min-width: 120px;
        align-self: stretch;
    }

    /*  Time heading at the top of the tooltip body, left-aligned with a
        clock glyph in front and a hairline separator under it so the
        time reads as a heading block above the data rows. Bold + tabular
        numerals + left-aligned to match the data rows below. */
    .tb-hover-tooltip-time
    {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: var(--ha-font-weight-bold, 700);
        letter-spacing: 0.3px;
        padding-bottom: 4px;
        margin-bottom: 4px;
        border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .tb-hover-tooltip-time-icon
    {
        --mdc-icon-size: 14px;
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        line-height: 1;
        color: var(--primary-text-color, #212121);
        --mdc-icon-color: var(--primary-text-color, #212121);
    }
    .tb-hover-tooltip-time-label
    {
        display: inline-flex;
        align-items: center;
        line-height: 1;
    }
    .tb-hover-tooltip-row
    {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 1px 0;
    }

    .tb-hover-tooltip-icon
    {
        --mdc-icon-size: 14px;
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        line-height: 1;
        color: var(--primary-text-color, #212121);
        --mdc-icon-color: var(--primary-text-color, #212121);
    }
    .tb-hover-tooltip-value
    {
        flex: 1;
        text-align: right;
    }

    /*  Per-source breakdown rows shown under the aggregate PV row on multi-source installs. Indent slightly so the
        eye reads them as children of the aggregate row above. Smaller font + lighter weight to step them visually
        below the headline without losing legibility. The colour pastille mirrors the hue-rotated per-source curve
        drawn on the chart underneath so the user can match row to curve at a glance. */
    .tb-hover-tooltip-row-sub
    {
        font-size: var(--ha-font-size-xs, 11px);
        opacity: 0.78;
        padding-left: 4px;
    }
    .tb-hover-tooltip-dot
    {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        display: inline-block;
    }
    .tb-hover-tooltip-sublabel
    {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
    }

    /*  Magnet-snap tab: real chip tab stacked above the tooltip in
        the wrapper's vertical flex column. Top corners match the
        tooltip's border-radius, bottom corners are flat and the
        bottom border is dropped so the seam between the tab and the
        tooltip reads as one continuous frame. -1 px margin pulls the
        tab down onto the tooltip's top border, sharing the 1 px line. */
    /*  LIVE chip floated at the top-right of the scrub tooltip, sharing the tooltip's own 6 px / 8 px padding so the
        chip baseline matches the time row. Outline recipe: transparent backdrop + 1 px theme primary border +
        primary-colour glyph + label, so the chip reads consistently across light + dark themes without ever clashing
        with the tooltip background. The dot pulses to mirror the HA Energy dashboard's live-data vocabulary. */
    .tb-hover-tooltip-live-chip
    {
        /*  Lives as the last flex child of the time row, pushed to the right edge via margin-left: auto. align-items:
            center on the parent vertically centres the chip with the clock glyph + the time label automatically, no
            absolute positioning, no top/right calculation against the tooltip padding. */
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 0 6px 0 4px;
        height: 18px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-color, #03a9f4);
        border: 1px solid var(--primary-color, #03a9f4);
        border-radius: 3px;
        font-size: inherit;
        font-weight: var(--ha-font-weight-bold, 700);
        letter-spacing: 0.4px;
        text-transform: uppercase;
        line-height: 1;
        /*  Force the chip onto its own GPU layer with a 3-axis translate, so it gets a pixel-snapped grid independent
            of the wrapper's fractional translateX(-X%). Without this, the chip text + 1 px border antialias against a
            sub-pixel offset inherited from the parent transform and read as blurry on high-DPI screens. */
        transform: translateZ(0);
        backface-visibility: hidden;
        /*  Fade in / out instead of pop in / out: render the chip in every tooltip pass and toggle visibility via
            opacity. */
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.16s ease-out;
    }
    .tb-hover-tooltip-live-chip.is-visible
    {
        opacity: 1;
    }
    .tb-hover-tooltip-live-chip-dot
    {
        --mdc-icon-size: 12px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        animation: tb-hover-tooltip-live-pulse 1.4s ease-in-out infinite;
    }
    .tb-hover-tooltip-live-chip-label
    {
        display: inline-flex;
        align-items: center;
        line-height: 1;
    }
    @keyframes tb-hover-tooltip-live-pulse
    {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
    }

    /*  Scrub tail: a vertical dotted line drawn at the scrub X,
        sitting in the 10 px gap between the tooltip's bottom edge
        and the chart-card top edge. Positioned independently of the
        tooltip so it stays anchored on the scrub line even when the
        tooltip slides to clear the timeline edges. The dot pattern
        is painted via repeating-linear-gradient so the magnet-snap
        variant can flow the dots upward via a background-position
        animation; a plain dashed border could not be animated. */
    .tb-hover-tooltip-tail
    {
        position: absolute;
        bottom: 100%;
        width: 1.5px;
        height: 10px;
        /*  Default cursor paints in the theme's primary text colour
            (black-ish on light themes, white-ish on dark) and is NOT
            animated, so a regular scrub reads as a quiet vertical
            cue. The brand-blue + flow animation only kicks in inside
            the magnet zone (see the .is-magnet-snap rule below). */
        background-image: repeating-linear-gradient(
            to bottom,
            var(--primary-text-color, #212121) 0,
            var(--primary-text-color, #212121) 2px,
            transparent 2px,
            transparent 4px
        );
        transform: translateX(-50%);
        pointer-events: none;
        /*  Foreground layer above the tooltip (z 30) AND above any
            chart-card decoration so the animated cursor stays visible
            in the magnet zone. */
        z-index: 1001;
    }
    /*  Magnet-snap variant: brand-blue dot column with a continuous
        upward flow animation so the user sees a "rising" pattern
        that signals "release here to return to live". The flow runs
        bottom to top because the live cursor sits ABOVE the chart
        viewport (in time, "now" is the forward edge). */
    .tb-hover-tooltip-tail.is-magnet-snap
    {
        background-image: repeating-linear-gradient(
            to bottom,
            var(--primary-color, #03a9f4) 0,
            var(--primary-color, #03a9f4) 2px,
            transparent 2px,
            transparent 4px
        );
        animation: tb-hover-tooltip-tail-flow 0.5s linear infinite;
    }
    @keyframes tb-hover-tooltip-tail-flow
    {
        from { background-position: 0 0; }
        to   { background-position: 0 -4px; }
    }

    /*  tb-hover-tooltip flips with the theme on its own through
        --card-background-color / --primary-text-color /
        --divider-color, no explicit dark override needed. */


    /*  Night-zone overlays. One absolutely-positioned div per
        sunset, next sunrise window, inserted as a sibling of the
        chart SVG inside the chart card. CSS diagonal hatching
        sits on top of the curves but below the live + scrub
        cursors (z-index 4), so dusk and dawn read as "this slice
        is night" without obscuring the curve shape underneath.
        Repeating linear gradients render at the device pixel grid
        regardless of the chart SVG's preserveAspectRatio=none, so
        the stripes stay diagonal across any card width.            */
    /*  Future-mask wash, sits on top of the curves and night zones
        and stretches from "now" to the right edge of the card. The
        wash uses the card background colour at moderate alpha so it
        lightens the curves AND the night-zone hatches in a single
        pass without redoubling on overlapping regions. Cursors sit
        at z-index 4 and stay fully opaque.                          */
    .hc-future-mask
    {
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        pointer-events: none;
        z-index: 3;
        /*  color-mix keeps the wash translucent at every theme: 55 %
            of the active card background mixed with 45 % transparency
            lets the predicted PV curve underneath stay visible while
            still marking the future portion as "not yet real". The
            color-mix on transparent is critical, var(--card-background-
            color) on its own goes fully opaque in dark mode and hides
            the prediction entirely. */
        background: color-mix(in srgb, var(--card-background-color, #ffffff) 55%, transparent);
    }


    .hc-night-zone
    {
        position: absolute;
        top: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 3;
        /*  Hatch + sunset/sunrise edges share the exact same RGBA
            (rgba(0, 0, 0, 0.07) light, rgba(255, 255, 255, 0.10)
            dark) so the boundary line reads as the densest part of
            the same hatch rather than as a separate marker. Alpha
            dropped relative to earlier iterations: too much density
            obscured the curves the user came to read.              */
        background-image: repeating-linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.12) 0,
            rgba(0, 0, 0, 0.12) 1.5px,
            transparent         1.5px,
            transparent         6px
        );
        box-shadow: inset  1px 0 0 0 rgba(0, 0, 0, 0.12),
                    inset -1px 0 0 0 rgba(0, 0, 0, 0.12);
    }
    ha-card.theme-dark .hc-night-zone
    {
        background-image: repeating-linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.18) 0,
            rgba(255, 255, 255, 0.18) 1.5px,
            transparent              1.5px,
            transparent              6px
        );
        box-shadow: inset  1px 0 0 0 rgba(255, 255, 255, 0.18),
                    inset -1px 0 0 0 rgba(255, 255, 255, 0.18);
    }


    /*  Day strip: a single bordered bar spanning the full timeline
        width, with one centred label per visible day and a 1 px
        vertical separator at every midnight boundary between two
        adjacent days. Same border + radius + shadow recipe as the
        chart cards above so the timeline stack reads as one
        composed instrument.                                        */
    .tb-day-strip
    {
        position: relative;
        height: 22px;
        /*  border-box so the 22 px height includes the 2 px border,
            inner content area is exactly 18 px. The cell's
            line-height matches that 18 px so the text line box fills
            the cell with no leftover space, no ambiguity about
            where the row sits vertically. */
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        /*  Theme-aware ink border matching the chart cards above so
            the timeline + day-strip stack reads as one outlined
            instrument. */
        border: 2px solid rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.55);
        /*  Compact radius (matches the chart cards stacked above) so
            the strip reads as a low-key axis rather than a pill chip. */
        border-radius: 8px;
        box-shadow: 0 1px 2px var(--shadow-color);
        overflow: hidden;
        pointer-events: none;
    }
    ha-card.theme-dark .tb-day-strip
    {
        border-color: rgba(255, 255, 255, 0.55);
    }

    .tb-day-strip-cell
    {
        position: absolute;
        top: 0;
        bottom: 0;
        display: inline-flex;
        flex-direction: row;
        align-items: baseline;
        justify-content: center;
        /*  Tight inline spacing so the date glyph and the kWh
            annotation read as one compact group on a narrow phone
            cell rather than two widely-separated pieces. */
        gap: 1px;
        padding: 0 1px;
        box-sizing: border-box;
        color: var(--primary-text-color, #212121);
        /*  Inherit the HA frontend font stack rather than letting
            the cell fall back to the OS default. Different OS fonts
            ship italic and bold variants with different vertical
            metrics, so on a host that did not propagate the Roboto
            stack down to this depth, the date (bold) and the
            forecast kWh (italic) ended up sitting on different
            baselines and the cell read as misaligned. */
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, Roboto, "Helvetica Neue", Arial, sans-serif));
        font-size: clamp(9px, 7cqw, 11px);
        line-height: 18px;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: clip;
        z-index: 2;
        font-weight: var(--ha-font-weight-normal, 400);
    }

    .tb-day-strip-cell.is-today
    {
        font-weight: var(--ha-font-weight-medium, 500);
    }
    /*  Active day during scrub / hover gets a faint brand-blue tint
        and bumps the label to a slightly heavier weight so the user
        reads "I am on this day" at a glance. Tint uses --primary-color
        at 16 % alpha for both light and dark themes, sitting just
        above the strip's own --card-background-color. */
    .tb-day-strip-cell.is-active
    {
        background: color-mix(in srgb, var(--primary-color, #03a9f4) 16%, transparent);
        font-weight: 600;
    }

    .tb-day-strip-date
    {
        font-weight: inherit;
    }

    /*  Vertical separator at each between-day boundary. Dotted
        1 px line matching the chart's own day separators
        (.hc-day-sep: stroke 0.30 alpha, dasharray 1.5 / 2.5), so
        the strip extends the same visual language as the cards
        above it. No separator at the outer edges since the strip
        border already closes the line there.                       */
    .tb-day-strip-sep
    {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
        z-index: 1;
        background-image: repeating-linear-gradient(
            to bottom,
            rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.30) 0,
            rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.30) 1.5px,
            transparent                                          1.5px,
            transparent                                          4px
        );
    }

    /*  Optional PV graph card stacked above the main chart. Same
        height as the main chart so the two cards form a balanced
        stack: production sits on top, irradiance + cloud cover
        underneath, neither dominating the other. The combined
        block keeps the same total vertical footprint the previous
        (32 px PV + 64 px main) layout occupied. */
    .tb-pv-card
    {
        height: clamp(36px, 8cqw, 72px);
    }


    /*  Cloud-cover toggle button. iOS-friendly 40 px touch target,
        icon-only with a title tooltip; the on state takes the brand
        primary plate so the user has one consistent
        visual language for "you are in a non-default mode".
        Segments are glued together via shared borders and
        matching corner radii.                                    */
    /*  HA ha-icon-button-style toggles: each segment is a transparent
        circle that holds the icon, an active or hover state lights
        up the circle in the brand colour. Same visual vocabulary as
        the HA dashboard toolbar buttons so a Helios card dropped
        into a HA Energy dashboard reads as part of the toolbar
        family. */
    /*  Mode bar (Layer / LiDAR / Weather). Vertical column of three
        icon-only toggles, anchored top-right, no backplate so the
        column reads as a quiet HA-toolbar trio sitting on the map.
        Each button uses the same transparent-circle recipe as the
        camera-lock and cloud-cover toggles so all three corner
        controls speak the same language. */
    .mode-bar
    {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        pointer-events: auto;
    }
    .mode-bar-seg
    {
        appearance: none;
        -webkit-appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width:  40px;
        height: 40px;
        box-sizing: border-box;
        padding: 0;
        background-color: transparent;
        background-clip: padding-box;
        color: var(--primary-text-color, #212121);
        border: 0;
        outline: 0 !important;
        outline-offset: 0;
        border-radius: 50%;
        overflow: hidden;
        cursor: pointer;
        position: relative;
        opacity: 1;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 0.15s, color 0.15s, opacity 0.15s;
    }
    .mode-bar-seg:hover,
    .mode-bar-seg:focus,
    .mode-bar-seg:focus-visible,
    .mode-bar-seg:active
    {
        outline: 0 !important;
        box-shadow: none !important;
    }
    .mode-bar-seg:hover  { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08); }
    .mode-bar-seg:active { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.16); }
    .mode-bar-seg ha-icon
    {
        --mdc-icon-size: 22px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        pointer-events: none;
    }
    /*  Active segment: brand-blue pastille behind the icon, white
        glyph on top, same on-primary recipe as cloud-cover-toggle.is-on
        so the two controls read as one family.                       */
    .mode-bar-seg.is-on
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-on-primary-color, #ffffff);
    }
    .mode-bar-seg.is-on:hover  { background: var(--dark-primary-color, #0288d1); }
    .mode-bar-seg.is-on:active { background: var(--darker-primary-color, #01579b); }
    .mode-bar-seg.is-disabled,
    .mode-bar-seg:disabled
    {
        opacity: 0.4;
        cursor: not-allowed;
        pointer-events: none;
    }
    /*  Spinning LiDAR icon while shadows are being computed. Same
        rotation primitive used by the centre shadow-busy spinner so
        the two surfaces breathe at the same rate. */
    .mode-bar-seg .is-spinning
    {
        animation: helios-mode-spin 1s linear infinite;
    }
    @keyframes helios-mode-spin
    {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
    }

    /*  Top corner overlays. Camera-lock + scrub-return on the left,
        cloud-cover toggle on the right. Both rails are flex rows
        sitting 8 px from their card edge.                          */

    /*  Date/time chip, same chip language as the on-map readouts.
        Explicit height (border-box) so the chip and the back-to-
        live button next to it share the exact same vertical
        footprint, no align-items: center shift in the parent flex
        container. */
    /*  Global crisp-text rule for every chip rendered with a
        translate centred on the home anchor. Without this rule
        Safari and Chrome land the chip at a fractional pixel
        (50 % anchor + -50 % translate) which softens the glyph
        edges. text-rendering: geometricPrecision + antialiased
        smoothing keeps the text sharp at any sub-pixel offset. */
    .pv-pct-label,
    .battery-pct-label,
    .solar-pct-label
    {
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }

    /*  Top-right overlay rail. Hosts the three view-mode toggles
        (default layer view). z-index: 60 keeps
        the rail above the LiDAR canvas (z 30) and the centre spinner
        (z 50) so a toggle is always reachable. Pointer events off on
        the rail itself so the empty rail never steals map
        interactions; each .cloud-cover-toggle button opts back in. */
    .overlay-top-right
    {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 60;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        pointer-events: none;
    }

    /*  Camera-lock toggle. Pinned top-left of the card, opens
        (lock-open) when the camera is free and closes (lock) when
        locked. Same visual size and idle/active recipe as the
        .cloud-cover-toggle so the left lock button and the right
        cloud-cover button read as one family. The brand-blue
        pastille appears when locked, matching cloud-cover-toggle.is-on. */
    .camera-lock-btn
    {
        appearance: none;
        -webkit-appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width:  40px;
        height: 40px;
        box-sizing: border-box;
        padding: 0;
        background-color: transparent;
        background-clip: padding-box;
        color: var(--primary-text-color, #212121);
        border: 0;
        outline: 0 !important;
        outline-offset: 0;
        border-radius: 50%;
        overflow: hidden;
        cursor: pointer;
        pointer-events: auto;
        position: relative;
        z-index: 50;
        opacity: 1;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 0.15s, color 0.15s;
    }
    .camera-lock-btn:hover,
    .camera-lock-btn:focus,
    .camera-lock-btn:focus-visible,
    .camera-lock-btn:active
    {
        outline: 0 !important;
        box-shadow: none !important;
    }
    .camera-lock-btn ha-icon
    {
        --mdc-icon-size: 22px;
        color: inherit;
        display: inline-flex;
        align-items: center;
        pointer-events: none;
    }
    .camera-lock-btn:hover  { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08); }
    .camera-lock-btn:active { background-color: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.16); }
    .camera-lock-btn.is-on
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-on-primary-color, #ffffff);
    }
    .camera-lock-btn.is-on:hover  { background: var(--dark-primary-color, #0288d1); }
    .camera-lock-btn.is-on:active { background: var(--darker-primary-color, #01579b); }
    /*  Disabled state (weather mode): button stays visible so the user reads the current lock
        state at a glance but the click target is inert. Greys out + cursor switches to default,
        no hover / active feedback so taps read as no-ops. */
    .camera-lock-btn.is-disabled,
    .camera-lock-btn[disabled]
    {
        opacity: 0.45;
        cursor: default;
        pointer-events: none;
    }

    /*  Top-left rail, mirrors overlay-top-right on the opposite edge
        so the corner overlays sit at matching heights. Hosts the
        camera-lock toggle. Pointer events are off on the rail by
        default; the button opts back in via .camera-lock-btn so
        clicks reach it without the rail stealing unrelated map
        interactions. */
    .overlay-top-left
    {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 60;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        pointer-events: none;
    }
    /*  Per-altitude cloud band toggles share the .mode-bar / .mode-bar-seg recipe with the
        top-right mode bar: identical 40 px round icon-only buttons stacked in a 4 px-gap flex
        column. Nothing extra needed here, the wrapper class .mode-bar already pins pointer-
        events: auto on the cluster so taps reach the buttons through the overlay-top-left rail
        (which keeps pointer-events: none by default).                                            */

    /*  Loading banner. Shown at the top of the card while the first hydration wave of data fetches
        is still in flight (PV, battery, grid, solar radiation, daily totals, weather, buildings,
        LiDAR). Retires for the rest of the card lifetime once every started phase has finished
        once, so routine background refreshes (mode switches, scrub, time tick) do NOT bring it
        back. Rounded card, themed bg + border + shadow so the user reads it as part of the rest
        of the HUD chrome. Slide-in from the top + opacity, slide-out downwards via the same pure
        CSS transition pattern (no keyframes, no animation: forwards). Sits above the timeline +
        mode bar at z-index 60. */
    /*  Loading banner. Pinned at the top edge of the card, horizontally centred between the lock
        chip on the left and the mode-bar on the right (both anchored at top: 8px). No slide-in
        animation: short fetch waves were ending before the slide-in completed, leaving the
        banner blinking once and disappearing without showing meaningful information. Sits at the
        same top edge as the surrounding chrome, plays no transform, only a snappy opacity step
        when shown / hidden. */
    .loading-banner
    {
        position: absolute;
        top: 8px;
        left: 64px;
        right: 64px;
        max-width: 260px;
        margin: 0 auto;
        padding: 6px 12px 8px;
        background: var(--ha-card-background, var(--card-background-color, rgba(0, 0, 0, 0.55)));
        color: var(--primary-text-color, #ffffff);
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.15));
        border-radius: 16px;
        font-size: var(--ha-font-size-s, 12px);
        line-height: 1.4;
        z-index: 60;
        opacity: 0;
        pointer-events: none;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .loading-banner.is-visible
    {
        opacity: 1;
    }
    .loading-banner-label
    {
        font-weight: var(--ha-font-weight-medium, 500);
        opacity: 0.85;
        text-align: center;
    }
    .loading-banner-bar
    {
        position: relative;
        width: 100%;
        height: 6px;
        background: var(--divider-color, rgba(255, 255, 255, 0.15));
        border-radius: 999px;
        overflow: hidden;
    }
    .loading-banner-bar-fill
    {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        background: var(--primary-color, #03a9f4);
        border-radius: 999px;
        transition: width 0.35s ease;
    }

    /*  Alert banner painted under the loading banner whenever the Open-Meteo home-point fetch
        is stuck in HTTP 429 back-off. Same width / centering as the loading banner so the two
        read as a stacked column. Themed with the HA frontend alert vocabulary: a soft tinted
        background derived from --warning-color (HA's standard yellow-orange alert hue for
        rate-limit / advisory states, distinct from --error-color which is the red error tier)
        plus a matching border. Falls back to a sensible amber if --warning-color is unset. */
    .weather-rate-limit-banner
    {
        position: absolute;
        top: 60px;
        left: 64px;
        right: 64px;
        max-width: 260px;
        margin: 0 auto;
        padding: 8px 12px;
        background: color-mix(in srgb, var(--warning-color, #ff9800) 18%, transparent);
        color: var(--warning-color, #ff9800);
        border: 1px solid var(--warning-color, #ff9800);
        border-radius: 8px;
        font-size: var(--ha-font-size-s, 12px);
        line-height: 1.4;
        z-index: 60;
        opacity: 0;
        pointer-events: none;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
        display: flex;
        flex-direction: column;
        gap: 2px;
        transition: opacity 0.25s ease;
    }
    .weather-rate-limit-banner.is-visible
    {
        opacity: 1;
    }
    .weather-rate-limit-banner-title
    {
        font-weight: var(--ha-font-weight-medium, 500);
        text-align: center;
    }
    .weather-rate-limit-banner-message
    {
        text-align: center;
        opacity: 0.9;
    }

    /*  LiDAR View opacity slider. Painted at the bottom of the card while the LiDAR view is
        active. Continuous capsule pill, ungated (no ticks) because opacity is a free analog tune,
        not a binned pick. */

    .lidar-view-opacity-slider
    {
        position: absolute;
        bottom: 14px;
        left: 50%;
        /*  Animation-IN + transition-OUT pattern: enters via a keyframe to avoid initial-paint
            spillover, leaves via a regular CSS transition so the slide-out plays smoothly. */
        transform: translate(-50%, 60px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.35s ease, transform 0.35s ease;
        z-index: 50;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        min-height: 28px;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
    }
    .lidar-view-opacity-slider.is-active
    {
        opacity: 1;
        transform: translate(-50%, 0);
        pointer-events: auto;
    }
    .lidar-view-opacity-icon
    {
        --mdc-icon-size: 16px;
        color: rgba(255, 255, 255, 0.85);
        display: inline-flex;
        align-items: center;
    }
    .lidar-view-opacity-icon--low  { opacity: 0.7; }
    .lidar-view-opacity-icon--high { opacity: 1.0; }
    .lidar-view-opacity-range
    {
        appearance: none;
        -webkit-appearance: none;
        width: 160px;
        height: 4px;
        background: linear-gradient(to right, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.9) 100%);
        border-radius: 999px;
        outline: none;
        cursor: pointer;
        margin: 0;
    }
    .lidar-view-opacity-range::-webkit-slider-thumb
    {
        appearance: none;
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--primary-color, #03a9f4);
        border: 2px solid var(--card-background-color, #ffffff);
        box-shadow: 0 1px 3px var(--shadow-color);
        cursor: pointer;
        position: relative;
        z-index: 2;
    }
    .lidar-view-opacity-range::-moz-range-thumb
    {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--primary-color, #03a9f4);
        border: 2px solid var(--card-background-color, #ffffff);
        box-shadow: 0 1px 3px var(--shadow-color);
        cursor: pointer;
        position: relative;
        z-index: 2;
    }
    .lidar-view-opacity-value
    {
        min-width: 36px;
        text-align: right;
        font-size: var(--ha-font-size-xs, 11px);
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
        font-variant-numeric: tabular-nums;
    }

    /*  Weather mode renders inside MapLibre via a GL custom layer (see
        src/engine/weather-cloud-layer.ts), no DOM overlay any more, no per-cell SVG. */

    /*  Photovoltaic production chip, same frame as cloud/W/m² but
        tinted in the user-configured production colour (border +
        text + icon) for instant identification.
        --pv-leader-color is set inline by the renderer. The
        min-width / centred text are shared with the SoC and Power
        battery chips so the visible gap on each side of the PV
        chip is identical regardless of how wide each value reads
        ("26 %" vs "+12.34 kW" otherwise produce visibly unequal
        leader gaps). */
    /*  PV production chip. Compact horizontal pill so it does not
        crowd the map (HA-energy-shaped 76 x 76 nodes read too heavy
        at the card's native zoom). The HA-energy identity stays via
        the coloured ring + icon glyph + ink tokens, the shape stays
        compact. */
    .pv-pct-label
    {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 56px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color:      var(--primary-text-color, #212121);
        border:     2px solid var(--pv-leader-color, var(--energy-solar-color, #ff9800));
        border-radius: 999px;
        padding: 3px 10px;
        font-size:    var(--ha-font-size-s, 12px);
        font-weight:  600;
        line-height:  1.2;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 1px 3px var(--shadow-color);
        white-space: nowrap;
    }

    .pv-pct-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    /*  Predicted PV chip, shown when scrubbing into the future. The
        value comes from the kWp × clear-sky model, not a measured
        reading, so we semi-transparency the whole chip and rely on
        the leading "≈" character (set by the card's render) to
        signal "estimate" textually. */
    .pv-pct-label.is-predicted
    {
        opacity: 0.55;
        font-style: italic;
    }

    /*  Battery SoC and Power chips, same compact pill recipe as the
        PV chip. HA-energy node identity is carried by the coloured
        ring, the icon and the ink tokens, the shape stays compact so
        it does not crowd the map. */
    .battery-pct-label
    {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 56px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color:      var(--primary-text-color, #212121);
        border:     2px solid var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
        border-radius: 999px;
        padding: 3px 10px;
        font-size:    var(--ha-font-size-s, 12px);
        font-weight:  600;
        line-height:  1.2;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 1px 3px var(--shadow-color);
        white-space: nowrap;
    }

    .battery-pct-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    /*  Grid import / export chips, same compact pill recipe as the
        battery chips but tinted in the HA Energy grid colours:
        consumption blue for import, return purple for export. Both
        chips live in the LEFT column of the home cluster. */
    .grid-import-label,
    .grid-export-label
    {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 56px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-text-color, #212121);
        border-radius: 999px;
        padding: 3px 10px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 1px 3px var(--shadow-color);
        white-space: nowrap;
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
    }
    .grid-import-label
    {
        border: 2px solid var(--energy-grid-consumption-color, #488fc2);
    }
    .grid-export-label
    {
        border: 2px solid var(--energy-grid-return-color, #8353d1);
    }
    .grid-import-label ha-icon,
    .grid-export-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    .grid-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    .grid-import-leader-line
    {
        stroke: var(--energy-grid-consumption-color, #488fc2);
        stroke-width: 1;
        stroke-linecap: round;
        fill: none;
    }
    .grid-export-leader-line
    {
        stroke: var(--energy-grid-return-color, #8353d1);
        stroke-width: 1;
        stroke-linecap: round;
        fill: none;
    }
    .grid-import-leader-bead { fill: var(--energy-grid-consumption-color, #488fc2); }
    .grid-export-leader-bead { fill: var(--energy-grid-return-color, #8353d1); }

    /*  PV → home leader. Vertical dashed line from the PV chip's
        bottom edge down to the home marker, painted in the configured
        PV colour. Same dash vocabulary as the battery leader so the
        two flows read as one coherent visual language. Animation runs
        only when current production is positive; idle state keeps the
        line static. Sits at z 5, BELOW the chip cluster (z 6) so the
        dashes pass behind the PV / SoC / Power chips. */
    .pv-home-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }

    .pv-home-leader-line
    {
        stroke: var(--pv-leader-color, var(--energy-solar-color, #ff9800));
        stroke-width: 1;
        stroke-opacity: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  Moving bead, a small filled disc rides the leader at a
        speed proportional to live production. Same vocabulary as
        the Home Assistant energy-distribution card. */
    .pv-home-leader-bead
    {
        opacity: 0.95;
        stroke: var(--card-background-color, #ffffff);
        stroke-width: 1;
        stroke-opacity: 0.85;
        paint-order: stroke fill;
    }
    ha-card.theme-dark .pv-home-leader-bead
    {
        stroke: var(--card-background-color, #191a1b);
        stroke-opacity: 0.95;
    }



    /*  Battery leaders.
        Both SoC ↔ PV and PV ↔ Power share the exact same visual
        vocabulary: solid L-shaped path with a rounded fillet at
        the bend, matching the Home Assistant energy-distribution
        card. The PV ↔ Power leader carries a small filled bead
        riding along the path (animateMotion in card.ts) at a
        speed proportional to |P|; the bead's path is flipped
        inline by the renderer when discharging so its travel
        direction matches the energy flow. The SoC leader is
        static, no bead: SoC is a level, not a flow. */
    .battery-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }

    .battery-leader-line
    {
        stroke: var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac));
        stroke-width: 1;
        stroke-opacity: 1;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
    }

    .battery-leader-bead
    {
        opacity: 0.95;
        stroke: var(--card-background-color, #ffffff);
        stroke-width: 1;
        stroke-opacity: 0.85;
        paint-order: stroke fill;
    }
    ha-card.theme-dark .battery-leader-bead
    {
        stroke: var(--card-background-color, #191a1b);
        stroke-opacity: 0.95;
    }

    /*  Solar overlay, split into two passes so chips never occlude
        the live sun while the night portion of the loop still reads
        as background:
          - .solar-svg-back paints only the dotted below-horizon
            segments and stacks BELOW the home chip cluster (z 4)
            so the home + readouts sit clearly on top of the night
            half of the orbit.
          - .solar-svg-front paints the above-horizon arc, the
            incidence ray, and the sun disc, and stacks ABOVE the
            chips (z 7) so the live sun always dominates the stack.
            The card is named Helios, the sun must win the stack. */
    .solar-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        /* Daylight fade is fed via the --solar-daylight CSS variable
           (set inline per render, ranges 0..1) instead of an inline
           opacity, so the .detail-active fade rule below can win
           cleanly without fighting an inline style. */
        opacity: var(--solar-daylight, 1);
        transition: opacity 600ms ease-out;
    }
    /*  Central home pill, a circular node painted at the projected
        home centre. Every chip leader (PV, battery, grid) docks
        against its border so the home reads as the single energy
        hub the way HA's Energy distribution card does.            */
    .home-pill
    {
        position: absolute;
        width:  28px;
        height: 28px;
        transform: translate(-50%, -50%);
        background: var(--card-background-color, #ffffff);
        border: 2px solid var(--primary-color, #03a9f4);
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        z-index: 9;
        pointer-events: none;
        box-shadow: 0 1px 3px var(--shadow-color);
        color: var(--primary-color, #03a9f4);
    }
    .home-pill ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }

    /*  Solid drop-leader from the home pill down to the projected
        ground at the home position. Length covers the CLUSTER_LIFT_PX
        gap between the cluster Y and the basemap-projected home.x/y.
        Sits in its own SVG layer below the pill (z 5) so the pill
        crowns the leader visually.                                   */
    .home-drop-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
        overflow: visible;
    }
    .home-drop-leader-line
    {
        stroke: var(--primary-color, #03a9f4);
        stroke-width: 1;
        stroke-linecap: round;
        fill: none;
        opacity: 0.85;
    }

    .solar-svg-back        { z-index: 4; }
    /*  Above-horizon arc is rendered in TWO passes so the depth of
        each segment drives the local z-order around the home cluster:
          - solar-svg-front-far  (z 5)  : the half of the arc that has
            already arched away from the camera. Sits BEHIND chips
            (z 8), leaders (z 5..), pill (z 9); reads as "the arc
            disappears behind the home".
          - solar-svg-front-near (z 11) : the half closest to the
            camera. Sits IN FRONT of chips + leaders so the arc reads
            as "coming over the top of the home" on its near side.
        Sun disc (z 12) and the W/m^2 chip (z 13) always paint last.  */
    .solar-svg-front-far  { z-index: 5; }
    .solar-svg-front-near { z-index: 11; }
    /*  Sun disc inherits the same depth split as the arc:
        - far half of the loop : disc paints UNDER chips + leaders
          (z 5) so the sun "passes behind the home" as the loop
          arcs away from the camera.
        - near half of the loop : disc paints OVER everything but
          the W/m^2 chip (z 12).                                  */
    .solar-svg-sun-far    { z-index: 5;  }
    .solar-svg-sun-near   { z-index: 12; }
    /*  Sun -> PV ray + bead live on their own SVG below the chip
        family (pv-pct-label sits at z 8) so the chip's background
        always occludes the ray endpoint at the chip border. The
        sun disc itself stays in the depth-split SVGs above so the
        disc still passes in front of / behind the home cluster
        depending on camera bearing. */
    .solar-ray-svg        { z-index: 7;  }

    /*  Cloud-cover dome overlay: a celestial hemisphere centred
        on the home, sliced into three horizontal bands (low / mid
        / high cloud) whose per-band opacity scales with the live
        cover percentage. Same fade-in / fade-out CSS rules as the
        and same currentColor + opacity-driven look so the bands
        feel like "filling water" inside a glass hemisphere. */
    .cloud-dome-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 12;
        color: var(--helios-cloud-color, var(--primary-text-color, var(--secondary-text-color, #727272)));
        transition: opacity 240ms ease-out;
    }
    .cloud-dome-disc
    {
        transition: opacity 240ms ease-out;
    }
    .cloud-dome-disc-ring
    {
        stroke-dasharray: 4 4;
    }
    /*  Light theme tweak: the dome discs paint at a darker tint so
        they read against a bright basemap. */
    ha-card.theme-light .cloud-dome-svg
    {
        color: var(--helios-cloud-color, #4d4d4d);
    }

    /*  Arc, first pass paints a dark outline for legibility on
        light basemaps; second pass paints the configured sun
        colour on top. Stroke widths are set inline per segment. */
    .solar-svg .solar-arc-outline { stroke: rgba(0, 0, 0, 0.35); stroke-linecap: round; }
    .solar-svg .solar-arc-segment { stroke-linecap: round; }

    /*  Below-horizon segments, round dots at fixed spacing so the eye reads "this is happening
        underground" without colour or depth scaling having to carry the signal. dasharray "0 N"
        with linecap round renders true circles on every browser. Stroke alpha is halved relative
        to the above-horizon arc so the dotted leg recedes visually: the bright arc reads as
        "the part of the day where there is sunlight" and the dotted leg as ambient context
        underneath.                                                                              */
    .solar-svg .solar-arc-night
    {
        stroke-linecap: round;
        stroke-dasharray: 0 8;
        stroke-opacity: 0.45;
    }
    .solar-svg .solar-arc-night.solar-arc-outline
    {
        stroke-opacity: 0.25;
    }

    /*  Incidence ray, dashes flow from the sun toward the home at a
        speed proportional to live irradiance. Hairline 1 px to match
        the home cluster's solid leaders so the whole connector family
        reads at one weight. */
    .solar-svg .solar-ray
    {
        stroke-width: 1;
        stroke-dasharray: 5 5;
        stroke-opacity: 0.55;
        stroke-linecap: round;
        animation: solar-ray-flow var(--sun-flow-duration, 30s) linear infinite;
    }

    @keyframes solar-ray-flow
    {
        from { stroke-dashoffset: 0;  }
        to   { stroke-dashoffset: -10; }
    }

    /*  Solar ray bead, small filled disc travelling sun -> PV chip
        along the incidence ray. Same recipe as the PV / battery /
        grid beads (white halo stroke, paint-order stroke-fill, dark
        halo in theme-dark) so the bead family reads consistently
        across all leaders. Speed comes from the inline animateMotion
        dur value driven by the live irradiance.                    */
    .solar-svg .solar-ray-bead
    {
        opacity: 0.95;
        stroke: var(--card-background-color, #ffffff);
        stroke-width: 1;
        stroke-opacity: 0.85;
        paint-order: stroke fill;
    }
    ha-card.theme-dark .solar-svg .solar-ray-bead
    {
        stroke: var(--card-background-color, #191a1b);
        stroke-opacity: 0.95;
    }


    /*  Solar irradiance label, chip pinned above the live sun
        position, same chip language as the cloud and PV chips.
        Sits in the front layer (z 7) so it stacks on top of every
        home-anchored chip, matching the front-pass solar overlay. */
    .solar-pct-label
    {
        position: absolute;
        transform: translate(-50%, -100%);
        pointer-events: none;
        /*  Sits ABOVE the arc-front lines (z 11) so the W/m² readout
            never gets crossed over by an arc segment that happens
            to project through its area. The sun disc (z 12) still
            paints on top because it shares the cluster identity. */
        z-index: 13;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--card-background-color, #ffffff);
        color:      var(--primary-text-color, #212121);
        /*  Sun chip uses the HA amber token so the live irradiance
            reads distinct from the PV production identity. PV stays
            on --energy-solar-color (orange); the sun stays on amber
            so the two never blur visually. */
        border:     2px solid var(--helios-sun-color, var(--amber-color, var(--warning-color, #ffc107)));
        border-radius: 999px;
        padding: 3px 10px;
        font-size:    var(--ha-font-size-s, 12px);
        font-weight:  600;
        line-height:  1.2;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 1px 3px var(--shadow-color);
        white-space: nowrap;
    }

    .solar-pct-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }


    /*  ============================================================
        Dark theme, opt-in via the \`card-theme: dark\` config.

        The whole card is already painted on top of a 3D map, so
        "dark mode" here is really about the chrome (chips, charts,
        cursors, day labels, leader lines, tooltips), the basemap
        keeps its own colours. Strategy:

          - chip surfaces flip from a solid white plate to a solid
            near-black plate, so the chip itself reads as a clean
            darkened tile over the map instead of a
            bright sticker.
          - chip text / borders / icons go from black to a soft
            light-grey (#e6e6e6 text, #cccccc borders), pure white
            would clip detail against bright basemap patches.
          - chart hairlines (midline, day separators, hour ticks,
            live cursor) flip from black-on-white to white-on-near-
            black with the same opacity envelopes as the light skin
            so the visual weight stays balanced.
          - chart fills (PV / cloud / irradiance) are user-coloured
            and unchanged, they read fine on both surfaces.
          - the scrub blue (#1f6feb) and the live tooltip dark
            plate already read on dark backgrounds, so they're left
            alone.
        ============================================================ */

    /*  .tb-chart-card flips via --card-background-color +
        --divider-color, no explicit dark-theme override needed. */

    ha-card.theme-dark .hc-day-sep
    {
        stroke: rgba(255, 255, 255, 0.55);
    }

    ha-card.theme-dark .hc-chart-mid
    {
        stroke: #cccccc;
    }

    ha-card.theme-dark .hc-hour-tick
    {
        stroke: rgba(255, 255, 255, 0.35);
    }

    /*  tb-cursor-now is driven by --rgb-primary-text-color + alpha
        so it flips with the theme on its own, no dark overrides
        needed. */

    /*  Value chips (PV, battery, cloud, solar) sit on a dark plate
        with a thick coloured ring in BOTH themes, matching the visual
        language of Home Assistant's energy dashboard so a Helios card
        sitting alongside HA's own surfaces reads as part of the same
        family. The plate is opaque enough to stay readable over a
        bright basemap in light mode without us forking the recipe
        per theme. */

    /*  Cloud leader keeps its slate-blue colour in dark mode too,
        the chip's frame already carries the same colour on both
        themes so the leader matches by default. */

    /*  Solar arc outline, the light skin paints a black halo
        behind the configured sun colour for legibility on bright
        basemaps; in dark mode that halo would disappear into the
        map, so we paint a faint white halo instead. The arc and
        sun disc themselves keep their configured colour. */
    ha-card.theme-dark .solar-svg .solar-arc-outline
    {
        stroke: rgba(255, 255, 255, 0.45);
    }


    /*  ---------------------------------------------------------
        Animation perf hooks
        ---------------------------------------------------------

        1. .helios-paused, set on the host element by the card's
           IntersectionObserver when the card scrolls out of the
           viewport. Pauses every CSS animation (SVG dash-flow,
           offset-path arrow flow) until the card returns. SMIL
           <animateMotion> is paused in parallel via
           svg.pauseAnimations() in the card script.

        2. prefers-reduced-motion, respects the user's system
           setting. When the user has asked for reduced motion at
           the OS level, every helios animation and transition is
           disabled. The card still functions; it just doesn't move.
    */
    :host(.helios-paused) *,
    :host(.helios-paused) *::before,
    :host(.helios-paused) *::after
    {
        animation-play-state: paused !important;
    }

    @media (prefers-reduced-motion: reduce)
    {
        *, *::before, *::after
        {
            animation-duration:         0ms !important;
            animation-iteration-count:  1   !important;
            transition-duration:        0ms !important;
        }
    }


    /*  Fullscreen / kiosk breakpoint, see issue #33. When the card
        is rendered above 900 CSS px of width (a dedicated dashboard
        view, kiosk panel, mobile portrait on tablet, ...), the chip
        text bumps one size step up so the value chips, the day-strip
        and the W/m² readout stay readable from across the room.

        The sun arc radius and the home chip cluster offsets are
        scaled separately by the engine (_heliosScale), so the
        on-map geometry expands in lockstep with this typography pass
        without overlapping the chip text.

        Container queries on ha-card (declared above) so a Helios
        card sitting in a wide section view alongside narrower cards
        flips on its own width, not on the viewport's. */
    @container helios-card (min-width: 900px)
    {
        .pv-pct-label,
        .battery-pct-label,
        .grid-import-label,
        .grid-export-label,
        .solar-pct-label
        {
            font-size: var(--ha-font-size-m, 14px);
            padding: 4px 12px;
        }
        .pv-pct-label ha-icon,
        .battery-pct-label ha-icon,
        .grid-import-label ha-icon,
        .grid-export-label ha-icon,
        .solar-pct-label ha-icon
        {
            --mdc-icon-size: 18px;
        }
        .tb-day-strip-cell
        {
            font-size: clamp(8px, 5.5cqw, var(--ha-font-size-s, 12px));
        }
        .tb-hover-tooltip
        {
            font-size: var(--ha-font-size-s, 13px);
        }
    }


`;
