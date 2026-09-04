# HELIOS, Architecture

This document describes how the Helios card is put together: the layering (card,
the scene HUD controller, typed data layer, scene engine), the 2.5D rendering
pipeline, the data flow, and the conventions every subsystem follows. For
the user-facing feature list and configuration, see [README.md](./README.md); for
per-release notes, see [CHANGELOG.md](./CHANGELOG.md).

`src/` is organised **by feature**, not by class: `core/` (shared, pure), `data/`
(the typed data layer), then one directory per feature (`scene/`,
`timeline/`, `charts/`, `hud/`, `editor/`), with the thin `helios-card.ts` at the
root and a small `card/` for bootstrap.

---

## 1. Overview

Helios is a single self-contained Lovelace card. There is no backend and no
build-time data: everything runs in the browser, talking to Home Assistant over
the WebSocket API and to a few public services (Open-Meteo for weather, and
OpenFreeMap vector tiles, from OpenStreetMap data, for the basemap and buildings).

The code is organised in layers:

* **The card** (`src/helios-card.ts`, bootstrap in `src/card/*`), a thin Lit
  composition root. It owns the DOM, the `hass` object and the configuration,
  holds the reactive `@state`, runs the lifecycle, and coordinates the render. It
  delegates the two heavy view subsystems to controllers and the data fetching to
  the data layer; it decides *what* to show.
* **The scene HUD controller** (`src/hud/scene-hud-controller.ts`), a plain class
  constructed with the card as its `host`. It owns the HUD's projection / paint /
  render logic and its scratch state, while the reactive data stays on the card; it
  reaches it through `this.host`. This is what keeps the card small: the scene HUD
  is ~1000 lines that live in the controller, not in the card.
* **The data layer** (`src/data/*`), a typed boundary over the HA WebSocket. Every
  recorder read flows through one gateway, one request cache, one durable last-good
  store, and the shared per-source fetch plumbing (`src/data/sources/*`).
* **The scene engine** (`src/scene/helios-engine.ts` + `src/scene/*`), a
  framework-agnostic class that owns the 2.5D scene: the tilted basemap, the
  camera, the projection, and the SVG painter for buildings, shadows and night
  shade. It decides *how* the scene is drawn and projected.

Cutting across all of it, `src/core/*` holds the pure shared primitives that both
sides reuse: `render-kit/` (2D point geometry, hex + tint colour math), `energy.ts`
(the consumption identity), `format/`, `time/` (timezone and sun-position
math), `config/` and `i18n/`.

The card feeds the engine a few setters (home location, sun time, palette,
buildings, period) and reads back projected screen-space geometry to place its
HUD. The engine never imports Lit and never reads `hass`; the card never does
trigonometry. The seam between them is a handful of public methods plus per-frame
callbacks (`onMapTransform`, `onWeatherUpdate`).

```
hass -> data/ (gateway -> request-cache -> durable) -> card @state
            |                                              |
            |                                    scene-hud-controller
            |                                              |
            +- setHome / setSun / setBuildings / setPeriod / setPalette
            v
      scene/helios-engine.ts -> scene/* (renderer, projection, ground-render, buildings)
            |
            +- onMapTransform() / onWeatherUpdate() -> card re-projects its HUD
```

---

## 2. The 2.5D rendering engine (`src/scene/`)

Helios renders a **2.5D** scene with **no WebGL**. The illusion is a
tilted vector basemap with every overlay projected on top in SVG so it stays
glued to the rotating ground.

### Ground plane, `scene/ground-render.ts`, `scene/renderer.ts`

The basemap is rendered **in-house from OpenFreeMap vector tiles**
(OpenMapTiles schema: water, landcover, landuse, parks, roads, rail, buildings,
boundaries), painted layer by layer onto an HTML `<canvas>`. The palette follows
the active Home Assistant theme (light vs dark), probed from `hass.themes.darkMode`,
or a fully custom per-layer colour + visibility configuration. The canvas is then tilted and turned
with a single CSS `rotateX(pitch) rotateZ(bearing)` transform about the home's
pixel position, so the ground reads as a plane viewed from an angle.

The canvas is painted **once** and thereafter only transformed, never redrawn per
frame. That is what makes it cheap, and also why the card repaints it from its
cached features whenever it comes back from a pause: a browser is free to drop a
canvas's backing store while a tab sits in the background, and nothing in the draw
loop would ever put those pixels back.

Features are grouped by layer once, right after the fetch, not re-filtered from
the flat array on every paint: a repaint (theme change, or every camera move on
the projected fallback) walks each layer's own slice instead of scanning the
whole tile set once per layer. Same-style line features (roads, rail, paths,
casings, boundaries) draw as one batched `Path2D` + stroke per style bucket
instead of one call per feature, cutting draw-call count and allocation on
every repaint regardless of path. On the non-projected path, where the tile-space
mapping never changes for a ground build's whole lifetime, every feature's (and
stroke bucket's) `Path2D` is additionally cached and replayed across repeated
repaints, so only the fill/stroke colour is reapplied on a theme or altitude
change; the projected path always rebuilds fresh, since its geometry genuinely
moves every frame under the camera.

That CSS 3D transform is the fast path, but some hardware can't composite it: entry
Android GPUs corrupt a GPU-drawn canvas into colored noise, and a few old WebViews
mis-layer the tilted plane. `renderer.ts` sniffs those (GPU string, texture cap, UA)
and falls back on its own, either to a CPU-rasterized canvas still under the transform,
or, for the broken-3D cases, to a **projected** path that repaints the ground
already-projected every frame with no 3D layer at all. When the sniff misses a device
(a WebView that hides its GPU name, and still flickers), the `degraded-render` option
forces that projected path by hand.

### Camera + projection, `scene/projection.ts`

`SceneCamera` is the keystone. All scene coordinates are **local metres relative
to the home origin** (+east, +north, +up). Per frame the host calls
`setViewport(w, h)` to bake the trig basis and the home's screen anchor, then
`project(east, north, up)` maps any point to screen pixels through bearing,
pitch and perspective. This is the exact inverse of the ground canvas's CSS
transform, which is what keeps the SVG overlays welded to the basemap as the
camera turns. `project3()` additionally returns the camera-space depth for
painter's-algorithm sorting and label fading.

### Scene SVG, `scene/renderer.ts`

`SceneRenderer` owns the DOM inside the card's map container: the ground canvas
plus a screen-space `<svg>` it repaints each frame with the occluding geometry
(the cast shadows and the extruded buildings). It
coalesces redraws into one `requestAnimationFrame` pass, owns its own
`ResizeObserver`, and fires `onAfterDraw` so the card can re-project its HUD in
lock-step. The `<svg>` is bound to the card box (`contain: paint`): its building
paths reach a whole neighbourhood past the card, and without that bound an old iOS
compositor sized the layer's backing store to that content, capped it and painted
only the top half; binding it also trims the off-card raster on every frame.
Colour math (building tint, day / night grading of the ground + buildings) lives in
`core/render-kit/colors.ts`, over the shared hex primitives in
`core/render-kit/hex.ts`; the shared 2D point type + SVG-points formatter live in
`core/render-kit/geometry.ts`.

### Buildings, `scene/buildings.ts`, `scene/openfreemap.ts`, `scene/vector-tile.ts`

Footprints are fetched once from **OpenStreetMap, served as OpenFreeMap vector
tiles** covering a radius around the home (`scene/openfreemap.ts` fetches, `scene/vector-tile.ts`
decodes the Mapbox Vector Tile `building` layer), parsed to local-metre polygons
with a height (real OSM height / `building:levels`, or a fixed prism), and cached
in `localStorage`. Interpretation (radius filter, nearest-N count, real-vs-fixed
height, home-cluster radius) is a pure pass re-run in memory on any option change,
with no re-fetch. The home building(s) extrude opaque; the surroundings extrude at
the configured opacity. Each footprint also casts a ground shadow from the current
sun azimuth / altitude.

Three passes turn raw tile rings into a scene that paints correctly:

- **Tile ownership.** Every tile repeats its neighbours' geometry inside a ~37 m
  buffer, so one building arrives from up to four tiles: whole from the tile it sits
  in, clipped from the others. A ring is kept only by the tile whose cell contains
  its centroid, which delivers each building exactly once and whole.
- **Merge.** Touching blocks of equal height are unioned (`polygon-clipping`) into
  one prism, keeping holes and inner roof lines, so a terrace is one solid block
  rather than a row of overlapping boxes with party walls drawn between them.
- **Paint order.** With no z-buffer, order is everything. For each pair of nearby
  buildings a **separating plane** is sought between their real outlines; that plane
  says which of the two is in front from the current eye point. The pairwise
  relations are topologically sorted (Kahn) into the paint order, HOME INCLUDED: one
  face list for every building, painted far-to-near as a single stable sort (a
  nearer neighbour occludes the home exactly as it would occlude another neighbour,
  and vice versa), not two separate always-home-on-top groups. This is exact for
  vertical prisms on a common ground plane, which is what the scene is. Neighbour
  opacity is baked into each face's own fill/stroke as rgba rather than a wrapping
  `<g opacity>`, since the home is now free to interleave between neighbour faces in
  the paint order.

Walls are shaded by Lambert from the footprint's own winding: a face square on to
the sun takes the lit tint, one turned away falls to the ambient (sky) tint.

### Sun + shadows, `core/time/sun.ts`, `scene/sun-arc.ts`

`core/time/sun.ts` computes the solar position (altitude / azimuth) and the
clear-sky irradiance (Haurwitz 1945 + Kasten-Czeplak 1980 cloud attenuation);
`scene/sun-arc.ts` builds the arc geometry the card draws. The card uses these to
drive the sun arc, the disc, and the shadow direction. They fade as the sun nears
the horizon.

`core/time/moon.ts` is the moon's counterpart: a low-precision lunar position
(ecliptic -> equatorial -> horizontal) and the illuminated fraction from the
sun-earth-moon angle, no ephemeris library. `scene/sun-arc.ts` projects it onto the
same dome as the sun (`moonSpherePoint`), the engine samples its own 96-point arc
(`projectMoonScene`, cached per day + arc scale, nothing weather-related), and
`scene/moon-crescent.ts` turns the fraction into a point-sampled SVG crescent lit
toward the sun's projected position. One HUD layer, always over the sun's (the moon
is the nearer body); the `moon-display` option picks always / night-only / hidden.
Cosmetic only: no chip, no value, no calculation reads it.

A cast shadow is the **exact swept envelope** of the footprint: the outline
translated along the sun vector, plus one quad per edge (outer rings and courtyard
rings alike), emitted as a single path per caster. Sweeping the real outline rather
than hulling it matters as soon as blocks merge into concave shapes, since a hull
fills the notch of an L. Every sub-path is wound the same way, because non-zero fill
adds like windings and cancels opposing ones, and the projection flips winding.

The shade layer is then clipped, in one operation, by a path holding the backdrop
plus every building footprint under `clip-rule="evenodd"`, so no shadow lies on
ground a building stands on (its own or a neighbour's) while courtyards still catch
it. One clip, not a subtraction per shape: non-zero fill counts a winding NUMBER, and
the sweep's pieces overlap most over the footprints, so a single reversed ring cannot
bring the count to zero there.

### Terrain horizon, `data/sources/horizon.ts`

The surrounding skyline is resolved on-device from Open-Meteo's elevation API (no
key, worldwide): a fan of ridge samples around the home, log-spaced out to ~25 km,
reduced to the largest elevation angle any ridge subtends per azimuth (a fixed-step
`HorizonProfile`). The profile is cached in durable storage keyed on the rounded home
coordinates, since terrain does not change. It feeds the scene two ways: the sun
**dims the moment it drops behind a hill**, not only at the flat horizon, and a
discreet ridge line is drawn around the house (shown / hidden / recoloured in the
editor). It is visual only, never touching measured production or the forecast.

---

## 3. The view

The card is a single live 2.5D scene with a re-targetable timeline below it. The
scene HUD lives in its own controller (`SceneHudController`); the card holds the
reactive data it reads and inserts its render output.

### Scene, `src/hud/`

The full live 2.5D view: tilted vector basemap, extruded buildings, cast shadows,
the whole scene graded through the day/night cycle, the sun arc (a back pass of
below-horizon dots and a front pass of the daylight arc + disc + ray + irradiance
readout), the home pill and its orbiting chip cluster (PV, battery SoC + power,
grid, and one chip per active monitoring group), and the timeline below.

The HUD is **projected, not laid out**: `hud/scene-hud-controller.ts`
(`SceneHudController`, with `hud/hud.ts` / `hud/hud-geometry.ts`) asks the engine
for the screen-space anchors of the home, the chip cluster and the sun scene every
frame (`onMapTransform`), resolves each chip's scrub-aware value, and returns the
absolutely-positioned chips + SVG leaders at those coordinates. Each chip/marker
positions itself via one inline `transform: translate()` (the projected coordinates
composed with its own centring offset), not `left`/`top`, so moving it every frame
is compositor-only work, never a forced layout pass. `onMapTransform`'s own
single-flight `requestAnimationFrame` gate additionally skips every second call
during a sustained burst (auto-rotate, a long drag) - a real one-off transform is
never the call that gets skipped. Each chip has a
leader to the home with an animated **bead** whose direction and speed encode the
live flow: a native SVG SMIL `<animateMotion>`, not a JS/CSS animation. Its
`dur`/`path`/`keyPoints` are wrapped in Lit's `guard()`, keyed on the handful of
values that actually define the bead - rewriting a running SMIL element's
attributes re-arms its animation clock even when the written value is identical,
real main-thread cost that has nothing to do with scene size, and `render()` here
runs on every `hass` change (`refreshHud`'s own projections use the same
equal-content-keeps-identity guard for the same reason, see `hud.ts`). Clicking a
chip points the timeline at that metric.

**Tapping a chip** opens a compact **detail panel** top-right
(`hud/detail-panel.ts`), tinted in the active chip's live colour: it aggregates
that metric over the selected window as icon-only rows (total, peak, per-day
average; import / export / net for grid; charged / discharged for battery flux;
min / avg / max for SoC and per monitoring group; peak + average irradiance plus
the astro rows for the sun). Values print in the card's configured unit. The panel is
bound to the active chip, so tapping another chip re-points it rather than closing
it; a tap on the scene background is what dismisses it. Every figure is recomputed
from the very series the bottom chart draws, so panel and curve always agree.

**Re-tapping any already-active chip** raises the **day curve**
(`scene/day-curve.ts`, data in `data/period-totals/day-profile.ts`): the scrubbed
day for that metric, drawn as one or more lines standing on the sun's own ground
track around the home. That track is the sun arc projected straight down, so it is
not a circle - the sun sits at `R x cos(altitude)` from the home, which pulls the
track in at noon and out to the arc's own feet at sunrise and sunset. Every ground
point is where the sun really stood at that moment, so position on the track carries
the hour with no clock convention to agree on, and the southern hemisphere needs no
mirroring. The gesture is generic; a few metrics draw more than one line and are the
only per-metric branch in `day-profile.ts`: production splits one stacked band per PV
source (each in its energy-dashboard colour); grid and battery split the same way, one
stacked band per source per direction (import/export, charge/discharge), so a
multi-meter grid or multi-pack battery reads each source rather than one lumped flow;
the battery keeps a dashed state-of-charge line per bank; a monitoring group draws one
line per device; irradiance draws one, except in Month, where the weather model does
not reach. The arc and the timeline read the same per-source split (the layers come
from `period-totals.ts`, coloured by the HA-energy ramp in `core/format`), so a metric
never shows two different readings of the same day. Switching chips re-points the curve
and leaves it up, so tapping across the cluster walks one day through each metric.

Geometry is shared and computed once (the ground track, the near/far depth split,
the per-hour risers rising to the tallest line of the moment); each line - a
`DayStrand` - carries only its own values, peak, colour and dash. A dashed leader
drops from the sun to the topmost line, with one bead where the sun's slot lands on
each. Colours are DESCRIPTORS resolved live against the theme, never frozen into the
one-day profile the card memoises. The day writes itself on from its own midnight
when raised, and the chips with nothing to say about the active metric stand down
while it is up. On today the production forecast carries the curve past the present
moment, dashed, as its own line: the same shape, only its certainty gives way.

The curve is projected by the engine but rendered as a **HUD layer**, not scene
geometry, and deliberately: `#map-container` is its own stacking context, so
anything the renderer draws is pinned below the chips. It is layered in two depth
passes (far and near) so the curve self-occludes at its own crossings, and both
passes sit **above** the solar overlays (sun disc, arc, incidence ray, irradiance
label): with auto-rotation the sun would otherwise sweep across the curve and hide
the reading, so the diagram wins that overlap. It stays below the per-chip detail
panel and the timeline, and clear of the buildings it would otherwise cut through. The engine
stamps the radius on because it owns the arc scale, so the card hands over everything
but that.

---

## 4. The data layer (`src/data/`)

Every number on the card comes from one of three places: the **HA Energy
dashboard** (solar / grid / battery), **Open-Meteo** (irradiance, cloud), or an
optional **irradiance sensor**. They converge into a single rolling-window store
that every graph reads. All recorder reads share the typed plumbing described last
in this section.

### HA Energy dashboard, `data/sources/energy-prefs.ts`

Helios does not take per-card entity keys. It subscribes to `energy/get_prefs`
and resolves the solar / grid / battery / forecast slots from the user's Energy
dashboard config, the same slots the official Energy card reads, re-fetching on
`energy_preferences_updated`. **Measured values only**: live chips read the
configured live power sensors directly (`sumLiveWatts` in `data/source-fetch.ts`,
SI-normalised, summed across every wired source); a value is never derived from a
cumulative energy meter. The past curves read the recorder's pre-computed `change`
metric, the exact numbers the Energy dashboard shows, so the two surfaces agree to
the watt-hour. `data/sources/pv.ts`, `battery.ts`, `grid.ts`, `irradiance.ts` own
the live + history resolution per source; `data/energy-forecast.ts` reads the
dashboard's configured solar-forecast provider, preferring the
[Helios-Forecast](https://github.com/ReikanYsora/Helios-Forecast) integration's own
detail series (`helios_forecast/series`) when it is configured and falling back to
HA's generic `energy/solar_forecast` otherwise. Only the Helios-Forecast path carries
a past window (its hourly archive, residual-corrected against real production); HA's
generic forecast is future-only by design of the underlying providers (Forecast.Solar,
Solcast, ...), so a period reaching into the past (Yesterday, Week, ...) only draws a
forecast curve there with Helios-Forecast configured. `data/sources/cost.ts` reads the
grid flows' configured prices (`entity_energy_price` / `number_energy_price`) and
cost statistics (`stat_cost` / `stat_compensation`) to drive the cost chip: a live
net rate (price x power) and, for a fixed price, a cost curve derived as energy x
price across the whole history. Absent when no price is configured, never invented.

The grid live readout carries a safety layer: `data/sources/grid-guard.ts` audits
the optional live power sensor against the billing meters (hourly recorder stats:
an hour of metered export while the "signed net" sensor never went meaningfully
negative is physically impossible) and, once proven mis-scoped, reroutes the live
split to the meters, self-clearing if the sensor is later fixed.

The battery live readout has the same kind of guard, `data/sources/battery-guard.ts`:
each battery's live power sensor is judged against that battery's own charge and
discharge meters (`batteryBanks` in `energy-prefs.ts` keeps the pairing the flat
lists lose) over a rolling 24 h of hourly stats, and a sensor proven backwards for
its slot is flipped per rate inside the live sum, never by negating the total, so a
correct second battery is never turned around with a wrong first one. Display-only
`battery-sign` sits on top of this and is untouched by it.

### Weather, `data/weather.ts`, `data/weather-resolve.ts`

One fetch per home point against Open-Meteo, fusing a global model with the best
regional model for the location and taking the **per-timestep median** to reject
single-model outliers. It returns the hourly series the scene needs: irradiance
(`shortwave_radiation_instant`), the three cloud layers (collapsed to an
*effective* cover of `low + 0.6*mid + 0.2*high`), precipitation, snowfall, the WMO
weather code, temperature and humidity. Cached in `localStorage` with a short TTL,
a schema version in the key (so a payload from an older field-set is refetched),
and exponential back-off on HTTP 429.

### "Your real sky" layers, `scene/weather-fx.ts`

`weatherLayers()` maps the resolved weather to independent overlay strengths: the
cloud cover sets the sun/grey grade (the sun also fading near the horizon by
altitude), and rain, snow and thunderstorm stack on top. The overlay is CSS
layers plus two particle canvases (`WeatherRain`, `WeatherSnow`, both extending
a shared `WeatherParticleFx` base that owns the canvas, DPR-aware resize and the
start/stop lifecycle, leaving each subclass only its particle shape and per-tick
physics) and a scripted lightning flash (`WeatherStorm`, a different enough shape
- no canvas, CSS-var driven - that it stays outside that shared base), driven by
`--wx-*` custom properties the card sets from the layer strengths. It sits between the scene and the chips, so weather
tints the map, never the data. The scene grade itself (saturation + brightness for
cloud cover) is **baked into the ground and building paint** by the renderer
(`SceneRenderer.setWeatherGrade`), not applied as a CSS `filter` on the map layer:
a filter there wraps the CSS 3D-transformed basemap and forces the whole scene to
re-flatten every frame while rotating, which flickers hard on Android WebViews.
`setWeatherGrade` is a no-op within a small tolerance of the current grade, not
exact equality: cloud cover resolves continuously while scrubbing the timeline, so
an exact-equality gate repainted the ground canvas on almost every tick even though
the sky barely changed.

### Weather overrides, `data/sources/irradiance.ts`, `data/sources/weather-override.ts`

When a local sensor is configured, its recorder history + live state replace the
Open-Meteo model for past + present timestamps (forecast hours stay on the model,
since a sensor has no future). Irradiance keeps its own module; every other
variable (cloud cover, precipitation, snowfall, temperature, humidity, and the
condition from a HA `weather` entity mapped to a WMO code) runs through the
generalised, table-driven `weather-override.ts`. Each pushes samples to the
engine, which does the nearest-neighbour lookup at resolve time.

### Scene zoom

`scene-zoom` (1 / 1.5 / 2) multiplies the camera's px-per-metre (`SceneCamera.pxPerMetre`,
`renderer.setZoom`). Everything projected through the camera grows with it: the
buildings, the shadows, the horizon ridge, and the basemap canvas, which is painted
once at the base scale and gets a matching `scale()` in its CSS transform (the
compat `projected` path re-projects through the same camera). The HUD does not:
`_sunArcScale()` probes the projected px per metre and sizes the sun/moon arcs in
metres to fit the card, so the arcs, discs and chip cluster keep their on-screen
size while the neighbourhood zooms in under them. Default 1 leaves the transform
string and every projection byte-identical to before the option existed.

### Unified store, `data/unifiedStore.ts`

The single source of truth for every graph. It bucketises the active period at
the configured cadence (`display-update-frequency-per-hour`, default 4 = 15 min)
into parallel series: `irradiance`, `temperature`, `humidity`, `production`,
`forecast`, `battery`, `gridImport`, `gridExport`. Weather is interpolated from its hourly
samples; the energy series are filled from the recorder `change` buckets (past
only, null in the future); the forecast is a stepped hourly curve. A `dataVersion`
hash lets consumers detect "same store as last frame" and skip the rebuild; it
rolls over at midnight. Read-side accessors (`valueAt`, `sliceForRange`) give the
charts and the timeline a consistent view regardless of cadence.

### Periods, `timeline/timeline-modes.ts`

One spec per period drives the whole pipeline (store window, whether weather is
available, the bucket cadence cap). The five periods are **J - J+2** (id `forecast`, its former label: today to two
days ahead), **Yesterday**, **Today**, **Week** and **Month**. Yesterday is exactly
the previous day; Today / Week / Month end on today; Month resolves its length from
the previous calendar month. The store cadence and the recorder fetch period derive
from the user's data-detail setting, capped per period, with Month capped at hourly
so a 31-day window never pulls a month of 5-minute rows.

Month is the longest view, and the last one the **scene** can still speak for: its
store stays hourly, so any day of it can be scrubbed to and read under that day's own
sun. A Year period sat past it on a daily store, which carried no shape of a day at
all: nothing the arc, the shadows or the curve could illustrate, 365 bars two pixels
wide for the eye, and a second data path of its own to fetch an hourly profile the
store could not provide. It said less than the Energy dashboard already says better,
so it is gone and that path with it.

### Charts, `src/charts/`

The timeline is a re-targetable SVG chart over the store. `_chartTarget` selects
the series-set: production (with dashed forecast and a per-source stacked
breakdown, in `charts/charts-pv.ts`), consumption, grid and battery (each stacked
per source when several are wired), battery SoC, irradiance, cloud or a monitoring
group (the generic path, and the grid/battery per-source stacking, live in
`charts/charts-generic.ts`). It draws day separators, night-zone hatching
(`timeline/timeline-overlays.ts`), a future mask, the live + the scrub cursors, and a
hover tooltip (`timeline/timeline-tooltip.ts`) whose icons take each series'
colour. The series build, the daily totals, the night intervals and the shared
tick model are each memoised per card (`WeakMap` keyed on the host), not in one
global slot, so a multi-card dashboard's cards don't evict each other's cache on
every interleaved render.

### The recorder plumbing, `data/*`

Every recorder read shares one typed stack, so an N-card dashboard is a good
citizen and a stalled fetch never blanks the card:

* **`data/ha-gateway.ts`**: the single typed boundary over `hass.callWS`. It
  applies the shared timeout and a concurrency cap (the recorder is a
  single-threaded SQLite consumer per connection), so no code path hits the
  WebSocket raw.
* **`data/request-cache.ts`**: one fresh-within-TTL cache with in-flight
  de-duplication and a prune sweep. Several cards (or several sources on one card)
  asking for the same key within the window collapse to a single round-trip.
* **`data/durable-cache.ts`**: a versioned `localStorage` last-good store. Every
  recorder series and the day-total persist a copy; on a rejected fetch (recorder
  stall, HA restart, cold reload) the source restores the last-good instead of
  blanking to empty. Date-bearing series round-trip through `saveDurableSeries` /
  `loadDurableSeries` (epoch-ms, since JSON drops `Date`).
* **`data/source-fetch.ts`**: the per-source plumbing: `KeyedFetch` (a keyed,
  de-duplicated fetch gate that replaces the hand-rolled fetch-key / fetching
  field pairs), `sumLiveWatts` (the live multi-source power aggregation), and
  `minuteAnchorMs` (the minute-quantised refresh anchor).
* **One recorder call per refresh**: `data/sources/energy-stats.ts` exposes
  `fetchChangeById`, which returns the recorder `change` buckets **per statistic
  id** in a single WS call. pv, grid and battery all request the same **union** of
  every configured meter (`unionChangeMeters`) over a common window, so the request
  cache collapses them to one recorder round-trip; each source then merges only its
  own ids (`mergeChangeSeries`). The home-consumption identity (`production +
  import - export - net battery`, clamped) lives once in
  `core/energy.ts`.
* **One raw-history parser for the sensors that need it**: battery, irradiance and
  the weather overrides all fall back to `history`/`history_during_period` when a
  sensor carries no long-term statistics, decoding the same compact/verbose payload
  shape (`s`/`state`, `lu`/`lc`/`last_updated`/`last_changed`) with only the
  value-extraction step differing per source; one shared parser (magnitude-checked
  ms-vs-seconds timestamps, carrying the last timestamp forward across a compacted
  repeat) backs all three. Irradiance and the weather overrides also share the
  "try `statistics_during_period`, fall back to raw history on an empty result"
  fetch shape that wraps it.

---

## 5. Monitoring groups, `data/sources/device-consumption.ts`

The devices tracked in the user's HA Energy dashboard can be bundled into up to
four **monitoring groups**, each with a name, colour and icon. The assignment and
its labels are flat config keys (`monitoring-groups`, `monitoring-group-names`,
`monitoring-group-colors`, `monitoring-group-icons`), with `hidden-devices`
listing meters to hide everywhere; the resolvers that clamp + default them
(`monitoringGroupName` / `monitoringGroupColor` / `monitoringGroupIcon`,
`GROUP_COUNT`) live in `core/config/helios-config.ts`, and the device data
(`activeGroups`, `groupDevices`, `deviceName`) in
`data/sources/device-consumption.ts`.

Each active group surfaces two ways: as a chip on the scene (with a leader + bead,
like the source chips) and a selectable curve in the timeline. A group with no
visible device renders nothing anywhere.

---

## 6. Persistence

Two things survive a reload, both keyed per home (or per `cache-id` when set, so
two cards on one home stay independent):

* **The saved view**, the selected period and the selected chip, written to
  `localStorage` by the card on change and on teardown, restored once coordinates
  resolve.
* **The camera pose**, bearing, pitch and the lock flag, written by the engine on
  drag-end and on teardown (capturing an auto-rotated bearing too), and read back
  at boot so the scene reopens exactly as it was left.

Separately, the data layer keeps a **durable last-good copy** of every recorder
series (see §4) so the *content* survives a failed fetch or a cold reload, not
just the view.

A hidden `cache-id` is auto-generated by the editor the first time a card is
configured, and a runtime registry (`card/registry.ts`) gives a pasted duplicate
(same id) a stable distinct slot, so copies never share a saved view.

---

## 7. Code organisation

`src/` is grouped **by feature**: `core/` (shared, pure), `data/` (the typed data
layer + `data/sources/`), `scene/`, `timeline/`, `charts/`, `hud/`,
`editor/`, plus the root `helios-card.ts` and a small `card/` for bootstrap
(`init`, `registry`, `diagnostics`).

The card is a thin composition root. One **view controller** (`SceneHudController`
in `hud/`) owns the scene HUD: a plain class holding its own scratch state,
constructed as `new SceneHudController(this)`, that reads the card's reactive
`@state` and DOM refs through `this.host` (the reactive data stays on the card, so
Lit reactivity is untouched). Public controller methods drop the leading
underscore, per the repo's lint rule.

Every other feature module exports **plain functions**. Subsystems do not import
the card or the engine directly; instead each declares a small **structural host
interface** in its own file describing exactly the fields it reads or mutates, and
the card / engine satisfies it structurally. This keeps each subsystem testable in
isolation and makes the dependency surface explicit: `charts.ts` declares a
`ChartHost` with just the store + series it needs, and the card *is* a `ChartHost`
by shape, not by inheritance.

`core/` and `data/` are framework-agnostic and (for `core/`) `hass`-agnostic:
`core/` is pure (render-kit geometry + hex + colour, the energy consumption
identity, formatting, timezone / sun math, config, i18n), and `data/` wraps the
WebSocket behind the gateway / cache described in §4.

Configuration is a flat, optional, kebab-case key map (`HeliosConfig`) with a
resolver helper per key in `core/config/helios-config.ts` that clamps + defaults
the raw value, so a malformed YAML value degrades gracefully instead of throwing.
The editor (`editor/editor.ts`) is a hand-rolled accordion of native controls +
Home Assistant entity / icon / colour pickers; it writes the same flat config back
via `config-changed`.

Internationalisation (`core/i18n/`) is a strict-typed `Translations` interface
with one locale file per language, picked by `hass.language` with an English
fallback.

---

## 8. Lifecycle, in short

1. `setConfig()` validates + stores the config; the editor auto-assigns a
   `cache-id` on first configure.
2. On first paint with resolved home coordinates, the card constructs the engine
   once (and its scene-HUD controller); later it updates the engine **in
   place** (home move, option change) rather than respawning it.
3. The engine boots the basemap, fetches buildings + weather, arms the atmosphere
   refresh and the optional auto-rotate loop, and starts firing `onMapTransform`
   per frame.
4. The card subscribes to the Energy dashboard and, through the data layer,
   fetches the per-source live + history in one shared recorder call, builds the
   unified store, and renders the HUD / charts from it via the controller.
   A short tick advances the live cursor and refreshes daily totals. A
   `shouldUpdate()` override skips the render pass outright when `hass` was
   the only property that changed and a fingerprint over every entity Helios
   actually reads (plus theme, language, home location) is unchanged - HA
   replaces the whole `hass` object on any entity's state change anywhere in
   the house, not just the ones this card shows.
5. On disconnect the engine teardown is deferred briefly (HA edit-mode churn fires
   disconnect + reconnect in one tick); a real removal tears down the renderer,
   timers, controllers and observers, after persisting the view + pose.
