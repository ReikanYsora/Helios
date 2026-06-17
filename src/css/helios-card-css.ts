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
        /*  Clip the black map backdrop to the PADDING box so it stops INSIDE the <ha-card> border
            instead of bleeding under it. Without this, background-clip defaults to border-box and the
            black fills the rounded-corner gap between the (inner-clipped) map and the border, painting a
            dark thick corner that doesn't match HA's subtle card frame. Same fix as the dashboard
            integration; same padding-box pattern used on the chips / mode bar. */
        background-clip: padding-box;
        /*  Container query host so the fullscreen / kiosk breakpoint
            rules at the bottom of this stylesheet can react to the
            card's own width without depending on the viewport size,
            which would mis-fire when the user has several Helios
            cards side by side in a grid view. See issue #33. */
        container-type: inline-size;
        container-name: helios-card;
        /*  Border + shadow come from <ha-card> itself (same --ha-card-*
            tokens), so we don't restyle the frame; doing so only diverged
            from the user's theme. border-radius stays because the
            overflow:hidden above clips the full-bleed map to it. */
        border-radius: var(--ha-card-border-radius, 12px);
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
        /*  Bleed 1 px under the <ha-card> border (the card's overflow:hidden re-clips the map to the
            rounded shape) so the map covers the 1 px anti-alias seam at the rounded corners where the
            black backdrop would otherwise peek between the inner-clipped map and the border. */
        inset: -1px;
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
        gets a visual hint that the home is tappable. The
        overlay-masked fade rule (specificity 0,2,0) wins over this
        (0,1,0) so the glow still fades out in masked modes. */
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


    /*  When LiDAR View is active, fade out every overlay layer so
        the dot cloud reads on its own against a quiet basemap. The
        toggle button itself is opted back in (selector below) so
        the user can always exit. The map container stays visible
        so the dots are projected onto a real basemap.

        Selector list covers the corners (top-left clock + top-right
        rail minus the LiDAR button itself), the home hitbox / glow, and
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
    .solar-svg,
    .solar-pct-label,
    .pv-home-leader-svg,
    .pv-pct-label,
    .battery-leader-svg,
    .battery-pct-label,
    .grid-leader-svg,
    .grid-label,
    .low-carbon-leader-svg,
    .low-carbon-label,
    .home-pill
    {
        transition: opacity 0.35s ease;
    }
    /*  will-change opt-in: scope the composite-layer promotion to the transition windows only.
        Declaring will-change: opacity unconditionally on 15+ elements pins that many GPU layers
        in idle VRAM (~15-30 MB on devices with limited budgets) and forces the compositor to
        re-sync them on every Lit re-render. Promote only when a mode actually toggles, gated
        on ha-card.overlay-masked, which is set on every non-base _cardMode. One rule covers
        the union of transition windows. */
    ha-card.overlay-masked .overlay-top-left,
    ha-card.overlay-masked .home-glow-svg,
    ha-card.overlay-masked .home-hitbox,
    ha-card.overlay-masked .solar-svg,
    ha-card.overlay-masked .solar-pct-label,
    ha-card.overlay-masked .pv-home-leader-svg,
    ha-card.overlay-masked .pv-pct-label,
    ha-card.overlay-masked .battery-leader-svg,
    ha-card.overlay-masked .battery-pct-label,
    ha-card.overlay-masked .grid-leader-svg,
    ha-card.overlay-masked .grid-label,
    ha-card.overlay-masked .low-carbon-leader-svg,
    ha-card.overlay-masked .low-carbon-label,
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
    /*  Chips + leaders + arcs fade out behind any non-base mode (LiDAR, weather).
        Single rule keyed on the overlay-masked class so the state machine on the card side
        controls exactly when the fade kicks in either direction. */
    ha-card.overlay-masked .home-glow-svg,
    ha-card.overlay-masked .home-hitbox,
    ha-card.overlay-masked .solar-svg,
    ha-card.overlay-masked .solar-pct-label,
    ha-card.overlay-masked .pv-home-leader-svg,
    ha-card.overlay-masked .pv-pct-label,
    ha-card.overlay-masked .battery-leader-svg,
    ha-card.overlay-masked .battery-pct-label,
    ha-card.overlay-masked .grid-leader-svg,
    ha-card.overlay-masked .grid-label,
    ha-card.overlay-masked .low-carbon-leader-svg,
    ha-card.overlay-masked .low-carbon-label,
    ha-card.overlay-masked .cloud-chip,
    ha-card.overlay-masked .cloud-chip-leader
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
    /*  Timeline slides below the card edge for any non-base mode (overlay-masked is set on every
        non-base mode). Weather mode is the exception:
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
        /*  HA-style card frame: a thin 1 px stroke in the active chart accent, softened to 60 % so it
            reads as a subtle frame rather than the heavy ink box it used to be. Mirrors the HA
            energy-solar-overview timeline border (the standalone carried the same non-HA heavy border). */
        border: var(--ha-border-width-sm, 1px) solid
            color-mix(in srgb, var(--chart-accent, var(--primary-text-color, #212121)) 60%, transparent);
        border-radius: var(--ha-border-radius-lg, 8px);
        box-shadow: 0 1px 3px var(--shadow-color);
        /*  Height scales with the card's container width (cqw =
            container-query width). 36 px floor on a small grid tile,
            72 px ceiling on a fullscreen kiosk. Both timeline charts
            share the same expression so they always stay siblings of
            the same height. */
        height: clamp(36px, 8cqw, 72px);
        overflow: hidden;
    }
    .hc-chart-svg
    {
        display: block;
        width: 100%;
        height: 100%;
    }
    /*  Grow ONLY the curves (wrapped in .hc-chart-grow) up from the baseline when the chart target
        changes (the SVG is keyed on the target so it re-mounts and replays), matching HA's graph cards'
        500 ms grow. The dotted day/night separators and the hover guide sit OUTSIDE this group so they
        stay put instead of stretching with the animation. fill-box anchors the scale at the group's own
        bbox bottom (the chart baseline). */
    .hc-chart-grow
    {
        transform-box: fill-box;
        transform-origin: bottom;
        animation: hc-chart-grow 500ms ease-out;
    }
    @keyframes hc-chart-grow
    {
        from { transform: scaleY(0); }
        to   { transform: scaleY(1); }
    }
    @media (prefers-reduced-motion: reduce)
    {
        .hc-chart-grow { animation: none; }
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
        /*  HA-style subtle frame (1 px divider), matching the chart card above so the timeline +
            day-strip stack reads as one instrument without the old heavy ink box. */
        border: var(--ha-border-width-sm, 1px) solid
            var(--divider-color, rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.12));
        border-radius: var(--ha-border-radius-lg, 8px);
        box-shadow: 0 1px 2px var(--shadow-color);
        overflow: hidden;
        pointer-events: none;
    }
    /*  Adaptive timeline label, point-positioned on its model fraction. The inline left anchors the
        fraction; the translate pulls the label back by half its own width so the text sits centred over
        the fraction rather than to its right. */
    .tb-day-strip-date
    {
        position: absolute;
        top: 0;
        bottom: 0;
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        padding: 0 1px;
        box-sizing: border-box;
        color: var(--primary-text-color, #212121);
        /*  Inherit the HA frontend font stack rather than the OS default so the label's vertical metrics
            match the chart cards stacked above. */
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, Roboto, "Helvetica Neue", Arial, sans-serif));
        font-size: clamp(9px, 7cqw, 11px);
        line-height: 18px;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        z-index: 2;
        font-weight: var(--ha-font-weight-normal, 400);
    }

    /*  Today's label in the day view carries a touch more weight so it reads as the present alongside
        the now-cursor. */
    .tb-day-strip-date.is-today
    {
        font-weight: var(--ha-font-weight-medium, 500);
    }

    /*  Header row sitting just ABOVE the timeline chart: the active-target indicator on the left and the
        rolling-period selector on the right, at the same height. pointer-events: none so the band itself
        stays transparent to map rotation; the interactive children re-enable events. */
    .tb-header
    {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 2px 4px;
        pointer-events: none;
    }
    /*  Active-target indicator (mirror of HA's chart-indicator): the icon of whatever the timeline chart
        currently shows, tinted with the active accent. Keyed so it fades in on each re-target. */
    .tb-chart-indicator
    {
        display: inline-flex;
        align-items: center;
        /*  Same chip frame as the period selector (card surface + shadow + radius) so the two header
            controls read as one family. */
        padding: 2px 6px;
        border-radius: 8px;
        background: var(--card-background-color, #ffffff);
        box-shadow: 0 1px 3px var(--shadow-color);
        /*  Icon in the text ink (black), not the accent colour. */
        color: var(--primary-text-color, #212121);
        pointer-events: none;
    }
    .tb-chart-indicator ha-icon
    {
        --mdc-icon-size: 18px;
        color: inherit;
        display: block;
        animation: tb-chart-indicator-fade 250ms ease;
    }
    @keyframes tb-chart-indicator-fade
    {
        from { opacity: 0; }
        to   { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce)
    {
        .tb-chart-indicator ha-icon { animation: none; }
    }
    /*  Rolling-period selector: a compact text segmented control on the right of the header row. Same
        on-primary active recipe as the mode bar so the two controls read as one family. */
    .tb-period-selector
    {
        display: inline-flex;
        gap: 2px;
        padding: 2px;
        border-radius: 8px;
        background: var(--card-background-color, #ffffff);
        box-shadow: 0 1px 3px var(--shadow-color);
        pointer-events: auto;
    }
    .tb-period-seg
    {
        appearance: none;
        -webkit-appearance: none;
        border: 0;
        outline: 0;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: 6px;
        background: transparent;
        color: var(--secondary-text-color, #727272);
        font-family: var(--ha-font-family-body, var(--mdc-typography-body1-font-family, Roboto, "Helvetica Neue", Arial, sans-serif));
        font-size: clamp(9px, 6cqw, 11px);
        line-height: 16px;
        letter-spacing: 0;
        font-weight: var(--ha-font-weight-medium, 500);
        white-space: nowrap;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 0.15s, color 0.15s;
    }
    .tb-period-seg:hover
    {
        background: rgba(var(--rgb-primary-text-color, 33, 33, 33), 0.08);
        color: var(--primary-text-color, #212121);
    }
    .tb-period-seg.is-on
    {
        background: var(--primary-color, #03a9f4);
        color: var(--text-on-primary-color, #ffffff);
    }
    .tb-period-seg.is-on:hover  { background: var(--dark-primary-color, #0288d1); }

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
        min-width: 76px;
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

    /*  Re-targetable-chart chips: clicking one points the single bottom chart at that metric. The base
        chips are display-only (pointer-events: none); the [role="button"] selector both re-enables the
        events and out-specifies the base rule regardless of source order. */
    .pv-pct-label[role="button"],
    .battery-pct-label[role="button"],
    .grid-label[role="button"],
    .solar-pct-label[role="button"]
    {
        pointer-events: auto;
        cursor: pointer;
        /*  Stop the chip's card-background from bleeding under the coloured 2px border at the rounded
            ends (clips it to the padding box, inside the border). */
        background-clip: padding-box;
    }
    /*  Active target: a soft 12 px halo in the chip's OWN metric colour at 70 %, the same recipe as the
        HA card's chips, so the active chip <-> chart coupling reads at a glance (was a flat primary ring). */
    .pv-pct-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--pv-leader-color, var(--energy-solar-color, #ff9800)) 70%, transparent);
    }
    .battery-pct-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--battery-leader-color, var(--energy-battery-out-color, #4db6ac)) 70%, transparent);
    }
    .grid-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2)) 70%, transparent);
    }
    .solar-pct-label.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--helios-sun-color, var(--amber-color, #ffc107)) 70%, transparent);
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
        min-width: 76px;
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

    /*  Grid chip: same compact single-line pill recipe as the PV and
        battery chips, so its text stays crisp under camera rotation.
        It shows the active flow only; the border follows the inline
        --grid-leader-color the renderer resolves (consumption blue
        while importing, return purple while exporting), the icon +
        value flip with it. */
    .grid-label
    {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 76px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-text-color, #212121);
        border: 2px solid var(--grid-leader-color, var(--energy-grid-consumption-color, #488fc2));
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
    .grid-label ha-icon
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
    /*  Single grid leader. Stroke + bead fill come from the inline
        --grid-leader-color the renderer resolves to the dominant flow,
        so one path serves both import (blue) and export (purple). */
    .grid-leader-line
    {
        stroke-width: 1;
        stroke-linecap: round;
        fill: none;
    }

    /*  Low-carbon chip: same single-line pill recipe as the others,
        tinted in HA's non-fossil green. Sits at the top of the left
        column and feeds the grid chip below it. */
    .low-carbon-label
    {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 76px;
        box-sizing: border-box;
        background: var(--card-background-color, #ffffff);
        color: var(--primary-text-color, #212121);
        border: 2px solid var(--low-carbon-color, var(--energy-non-fossil-color, #0f9d58));
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
    .low-carbon-label ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }
    /*  Low-carbon → grid leader: a straight vertical hairline (no L,
        the two chips share the column x). Stroke + bead fill come from
        the inline --low-carbon-color. */
    .low-carbon-leader-svg
    {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    .low-carbon-leader-line
    {
        stroke-width: 1;
        stroke-linecap: round;
        fill: none;
    }

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
           opacity, so the overlay-masked fade rule above can win
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
        transform: translate(-50%, -50%);
        z-index: 9;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 4px;
        /*  Horizontal stadium, like the other chips and the HA card: the home glyph and the live usage
            sit side by side. min-width / height match the leader dock half-extents (38 / 14 px) so the
            chip leaders meet the visible pill edge. */
        min-width: 76px;
        height: 28px;
        box-sizing: border-box;
        padding: 0 10px;
        background: var(--card-background-color, #ffffff);
        background-clip: padding-box;
        color: var(--primary-color, #03a9f4);
        border: 2px solid var(--primary-color, #03a9f4);
        border-radius: 999px;
        pointer-events: none;
        box-shadow: 0 1px 3px var(--shadow-color);
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        /*  Keep the mask fade AND ease the hover glow in/out. */
        transition: opacity 0.35s ease, box-shadow 0.2s ease;
    }
    /*  Very light glow on home hover: a soft halo in the primary colour,
        the hover state is driven from the hitbox by the card. */
    .home-pill.is-hovered
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 7px 1px color-mix(in srgb, var(--primary-color, #03a9f4) 28%, transparent);
    }
    .home-pill ha-icon
    {
        --mdc-icon-size: 16px;
        /*  Home glyph in the text ink (black), not the blue pill border colour. */
        color: var(--primary-text-color, #212121);
        display: inline-flex;
        align-items: center;
    }
    /*  Live home consumption, second line inside the hub. Same text
        size as the surrounding chips so the cluster reads uniform;
        tabular figures keep the digits steady, regular text ink keeps
        it readable against the card background. */
    .home-pill-usage
    {
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 700;
        line-height: 1.1;
        color: var(--primary-text-color, #212121);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        letter-spacing: -0.2px;
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

    /*  Cloud chip on the sun -> home line: a stadium pill in cloud grey showing the live cover, clickable
        to re-target the timeline chart to the cloud bands. Same recipe + active glow as the other chips. */
    .cloud-chip
    {
        position: absolute;
        transform: translate(-50%, -50%);
        z-index: 11;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        pointer-events: auto;
        cursor: pointer;
        background: var(--card-background-color, #ffffff);
        background-clip: padding-box;
        color: var(--primary-text-color, #212121);
        border: 2px solid var(--secondary-text-color, #727272);
        border-radius: 999px;
        padding: 3px 10px;
        font-size: var(--ha-font-size-s, 12px);
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        box-shadow: 0 1px 3px var(--shadow-color);
    }
    .cloud-chip ha-icon
    {
        --mdc-icon-size: 16px;
        color: inherit;
        display: inline-flex;
        align-items: center;
    }
    .cloud-chip.is-chart-active
    {
        box-shadow: 0 1px 3px var(--shadow-color),
                    0 0 12px color-mix(in srgb, var(--secondary-text-color, #727272) 70%, transparent);
    }
    /*  Short fixed cloud-coloured leader joining the irradiance chip to the cloud chip on its right. */
    .cloud-chip-leader
    {
        position: absolute;
        transform: translateY(-50%);
        width: 14px;
        height: 2px;
        background: var(--secondary-text-color, #727272);
        border-radius: 1px;
        pointer-events: none;
        z-index: 10;
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
        .grid-label,
        .low-carbon-label,
        .solar-pct-label
        {
            font-size: var(--ha-font-size-m, 14px);
            padding: 4px 12px;
        }
        .pv-pct-label ha-icon,
        .battery-pct-label ha-icon,
        .grid-label ha-icon,
        .low-carbon-label ha-icon,
        .solar-pct-label ha-icon
        {
            --mdc-icon-size: 18px;
        }
        .tb-day-strip-date
        {
            font-size: clamp(8px, 5.5cqw, var(--ha-font-size-s, 12px));
        }
        .tb-hover-tooltip
        {
            font-size: var(--ha-font-size-s, 13px);
        }
    }


`;
