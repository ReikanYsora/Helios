# HELIOS, Architecture

This document describes how the Helios card is put together: the layering (card,
view controllers, typed data layer, scene engine), the 2.5D rendering pipeline,
the data flow, the view modes, and the conventions every subsystem follows. For
the user-facing feature list and configuration, see [README.md](./README.md); for
per-release notes, see [CHANGELOG.md](./CHANGELOG.md).

`src/` is organised **by feature**, not by class: `core/` (shared, pure), `data/`
(the typed data layer), then one directory per view feature (`scene/`, `clock/`,
`timeline/`, `charts/`, `hud/`, `editor/`), with the thin `helios-card.ts` at the
root and a small `card/` for bootstrap.

---

## 1. Overview

Helios is a single self-contained Lovelace card. There is no backend and no
build-time data: everything runs in the browser, talking to Home Assistant over
the WebSocket API and to a few public services (Open-Meteo for weather, CARTO
for the basemap, OpenStreetMap via OpenFreeMap vector tiles for buildings).

The code is organised in layers:

* **The card** (`src/helios-card.ts`, bootstrap in `src/card/*`), a thin Lit
  composition root. It owns the DOM, the `hass` object and the configuration,
  holds the reactive `@state`, runs the lifecycle, and coordinates the render. It
  delegates the two heavy view subsystems to controllers and the data fetching to
  the data layer; it decides *what* to show.
* **The view controllers** (`src/clock/clock-controller.ts`,
  `src/hud/scene-hud-controller.ts`), plain classes constructed with the card as
  their `host`. Each owns one view's animation / hit-test / paint / render logic
  and its scratch state, while the reactive data stays on the card; they reach it
  through `this.host`. This is what keeps the card small: the clock and day dials
  and the scene HUD are ~2000 lines that live in their controllers, not in the card.
* **The data layer** (`src/data/*`), a typed boundary over the HA WebSocket. Every
  recorder read flows through one gateway, one request cache, one durable last-good
  store, and the shared per-source fetch plumbing (`src/data/sources/*`).
* **The scene engine** (`src/scene/helios-engine.ts` + `src/scene/*`), a
  framework-agnostic class that owns the 2.5D scene: the tilted basemap, the
  camera, the projection, and the SVG painter for buildings, shadows and night
  shade. It decides *how* the scene is drawn and projected.

Cutting across all of it, `src/core/*` holds the pure shared primitives that both
sides reuse: `render-kit/` (2D point geometry, hex + tint colour math), `energy.ts`
(the consumption identity), `format/`, `time/` (timezone, sun-zone and sun
position math), `config/` and `i18n/`.

The card feeds the engine a few setters (home location, sun time, palette,
buildings, period) and reads back projected screen-space geometry to place its
HUD. The engine never imports Lit and never reads `hass`; the card never does
trigonometry. The seam between them is a handful of public methods plus per-frame
callbacks (`onMapTransform`, `onWeatherUpdate`).

```
hass -> data/ (gateway -> request-cache -> durable) -> card @state
            |                                              |
            |                          clock-controller / scene-hud-controller
            |                                              |
            +- setHome / setSun / setBuildings / setPeriod / setPalette
            v
      scene/helios-engine.ts -> scene/* (renderer, projection, tiles, buildings)
            |
            +- onMapTransform() / onWeatherUpdate() -> card re-projects its HUD / dial
```

---

## 2. The 2.5D rendering engine (`src/scene/`)

Helios renders a **2.5D** scene with **no WebGL**. The illusion is a
tilted raster basemap with every overlay projected on top in SVG so it stays
glued to the rotating ground.

### Ground plane, `scene/tiles.ts`, `scene/renderer.ts`

The basemap is a grid of **CARTO raster tiles**
(`*.basemaps.cartocdn.com/rastertiles/{light,dark}_nolabels/...`) stitched onto
an HTML `<canvas>`. The style follows the active Home Assistant theme (light vs
dark), probed from `hass.themes.darkMode`. The canvas is then tilted and turned
with a single CSS `rotateX(pitch) rotateZ(bearing)` transform about the home's
pixel position, so the ground reads as a plane viewed from an angle.

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
(the night-shade wash, the cast shadows, and the extruded buildings). It
coalesces redraws into one `requestAnimationFrame` pass, owns its own
`ResizeObserver`, and fires `onAfterDraw` so the card can re-project its HUD in
lock-step. Colour math (night shade, building tint, day / night blends) lives in
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

### Sun + shadows, `core/time/sun.ts`, `scene/sun-arc.ts`

`core/time/sun.ts` computes the solar position (altitude / azimuth) and the
clear-sky irradiance (Haurwitz 1945 + Kasten-Czeplak 1980 cloud attenuation);
`scene/sun-arc.ts` builds the arc geometry the card draws. The card uses these to
drive the sun arc, the disc, and the shadow direction. Cast shadows are projected
from the building footprints along the sun vector and painted as depth-sorted SVG
polygons by the renderer; they fade as the sun nears the horizon.

---

## 3. View modes

The card has three modes (`_viewMode`, one of `scene` / `clock` / `day`),
switched from the top-left rail: Scene, Clock, and the "Solar Day" day ring. A CSS
class on `<ha-card>` fades the layers that do not belong to the active mode. The
scene HUD and the clock / day dials each live in their own controller; the card
just holds the reactive data they read and inserts their render output.

### Scene (default), `src/hud/`

The full live 2.5D view: tilted basemap, extruded buildings, cast shadows, night
shade, the sun arc (a back pass of below-horizon dots and a front pass of the
daylight arc + disc + ray + irradiance readout), the home pill and its orbiting
chip cluster (PV, battery SoC + power, grid, and one chip per active monitoring
group), and the timeline below.

The HUD is **projected, not laid out**: `hud/scene-hud-controller.ts`
(`SceneHudController`, with `hud/hud.ts` / `hud/hud-geometry.ts`) asks the engine
for the screen-space anchors of the home, the chip cluster and the sun scene every
frame (`onMapTransform`), resolves each chip's scrub-aware value, and returns the
absolutely-positioned chips + SVG leaders at those coordinates. Each chip has a
leader to the home with an animated **bead** whose direction and speed encode the
live flow. Clicking a chip points the timeline at that metric.

**Double-tapping a chip** opens a compact **detail panel** top-right
(`hud/detail-panel.ts`), tinted in the active chip's live colour: it aggregates
that metric over the selected window as icon-only rows (total, peak, per-day
average; import / export / net for grid; charged / discharged for battery flux;
min / avg / max for SoC and per monitoring group; peak + average irradiance plus
the astro rows for the sun). Values print in the card's configured unit. The panel is
bound to the active chip, so a single tap on another chip re-points the chart and
closes it; a second tap re-opens it for the new metric. Every figure is
recomputed from the very series the bottom chart draws, so panel and curve always
agree.

### Clock, `src/clock/`

A 24-hour radial instrument. `clock/clock-controller.ts` (`ClockController`) owns
the dial's animation engine (grow / slide / exit + slice-focus dim, three
seq-guarded rAF loops), the pointer hit-testing, the per-frame projection +
imperative paint, and the tooltips; `clock/energy-clock.ts` is the pure geometry +
data build it drives, and `clock/clock-hourly.ts` the hour-of-day profile.

Each selected metric is binned into 24 hours-of-day over the active period and
drawn as a ring of bars (one per hour) projected flat on the same ground plane,
around the flat **Helios mark** at the centre (a CSS-transform ground decal,
`scene/helios-logo.ts`, laid on the tilted plane by the renderer under the bars so
nearer bars occlude it; it rests at half opacity and fades to full on hover/tap,
when it shows the window total). The right-hand rail is a **multi-select filter**:
every active metric adds one **concentric ring** (outer = first selected, nesting
inward on fixed slots so adding / removing a filter never re-spaces the others).
Hovering or tapping a bar lights the whole hour slice across rings, dims the rest,
and shows one tooltip row per metric. A soft **day / night ground wedge** (from
`core/time/sun-zones.ts`, the per-hour fraction of the period the sun is below the
horizon) and an N / S compass keep it legible as the dial rotates with the camera.
The bars are built as a raw SVG string and injected imperatively each frame, the
same trick the renderer uses for buildings, to stay cheap under rotation.

### Solar Day, `src/clock/` + `clock/consumption-ring.ts`

The day ring: a flat 24-hour dial of what the home consumed and where that energy
came from. `clock/consumption-ring.ts` builds the data (`refreshDayRing`),
`clock/energy-clock.ts` projects it (`projectDayRingFrame`), and
`clock/clock-controller.ts` drives its animation, hit-testing and detail panel.

Each tracked device or **monitoring group** draws its own concentric ring whose
per-slot width tracks how hard it ran (a slot at the historical peak average power
fills the ring; a lighter slot is a thinner ribbon). Every slot is coloured by how
that hour's load was met, split across the three sources: local solar, battery
discharge and grid import. Tapping a group ring flips (a CSS-transform card-flip)
into its member devices, one ring each; the centre disc becomes the exit button
while drilled in. Tapping a ring selects it and opens a top-right detail panel that
splits the ring's day energy across those same three sources. The flat Helios mark
sits at the centre and the same day / night ground wedge grounds the dial.

The ring works across **every period**: the same Standard (Now), Yesterday, Today,
Week, Month and Year selector drives it. A single-day window (Today) fills up to
the current hour at the fine per-frequency cadence; a multi-day window aggregates
its days by hour-of-day (each source's buckets summed into their hour-of-day slot)
at hourly cadence, so a long span shows the summed daily profile without pulling
sub-hour rows.

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
dashboard's configured solar-forecast provider.

The grid live readout carries a safety layer: `data/sources/grid-guard.ts` audits
the optional live power sensor against the billing meters (hourly recorder stats:
an hour of metered export while the "signed net" sensor never went meaningfully
negative is physically impossible) and, once proven mis-scoped, reroutes the live
split to the meters, self-clearing if the sensor is later fixed.

### Weather, `data/weather.ts`, `data/weather-resolve.ts`

One fetch per home point against Open-Meteo, fusing a global model with the best
regional model for the location and taking the **per-timestep median** to reject
single-model outliers. It returns only what the irradiance pipeline needs: hourly
irradiance (`shortwave_radiation_instant`) and the three cloud layers (collapsed
to an *effective* cover of `low + 0.6*mid + 0.2*high`). Cached in `localStorage`
with a short TTL and exponential back-off on HTTP 429.

### Irradiance override, `data/sources/irradiance.ts`

When `solar-irradiance-entity` is set, its recorder history + live state replace
the Open-Meteo model for past + present timestamps (forecast hours stay on the
model, since a sensor has no future).

### Unified store, `data/unifiedStore.ts`

The single source of truth for every graph. It bucketises the active period at
the configured cadence (`display-update-frequency-per-hour`, default 4 = 15 min)
into parallel series: `irradiance`, `cloud`, `production`, `forecast`, `battery`,
`batterySoc`, `gridImport`, `gridExport`. Weather is interpolated from its hourly
samples; the energy series are filled from the recorder `change` buckets (past
only, null in the future); the forecast is a stepped hourly curve. A `dataVersion`
hash lets consumers detect "same store as last frame" and skip the rebuild; it
rolls over at midnight. Read-side accessors (`valueAt`, `sliceForRange`) give the
charts, the clock and the day dial a consistent view regardless of cadence.

### Periods, `timeline/timeline-modes.ts`

One spec per period drives the whole pipeline (store window, whether weather is
available, the bucket cadence cap). The six periods are **Standard** (Now),
**Yesterday**, **Today**, **Week**, **Month** and **Year**, and all six drive the
day-ring view as well as the timeline (the ring aggregates multi-day periods by
hour-of-day). Yesterday is exactly the previous day; Today / Week / Month / Year
end on today; Month and Year resolve their length from the previous calendar month
/ year. The store cadence and the recorder fetch period derive from the user's
data-detail setting, capped per period (long windows fall back to hourly, then
daily, so a year never pulls a year of 5-minute rows).

### Charts, `src/charts/`

The timeline is a re-targetable SVG chart over the store. `_chartTarget` selects
the series-set: production (with dashed forecast and a per-string stacked
breakdown, in `charts/charts-pv.ts`), consumption, grid, battery, battery SoC,
irradiance, cloud or a monitoring group (the generic single-series path lives in
`charts/charts-generic.ts`). It draws day separators, night-zone hatching
(`timeline/timeline-overlays.ts`), a future mask, the live + the scrub cursors, and a
hover tooltip (`timeline/timeline-tooltip.ts`) whose icons take each series'
colour.

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

---

## 5. Monitoring groups, `data/sources/device-consumption.ts`

The devices tracked in the user's HA Energy dashboard can be bundled into up to
four **monitoring groups**, each with a name, colour and icon. The assignment and
its labels are flat config keys (`monitoring-groups`, `monitoring-group-names`,
`monitoring-group-colors`, `monitoring-group-icons`), with `consumption-ring-hidden`
listing meters to drop from the ring; the resolvers that clamp + default them
(`monitoringGroupName` / `monitoringGroupColor` / `monitoringGroupIcon`,
`GROUP_COUNT`) live in `core/config/helios-config.ts`, and the device data
(`activeGroups`, `groupDevices`, `deviceName`) in
`data/sources/device-consumption.ts`.

Each active group surfaces four ways: as a chip on the scene (with a leader + bead,
like the source chips), a selectable curve in the timeline, a ring in the Solar Day
view, and a slice in the clock. A group with no visible device renders nothing
anywhere.

---

## 6. Persistence

Two things survive a reload, both keyed per home (or per `cache-id` when set, so
two cards on one home stay independent):

* **The saved view**, the view mode, the selected period, the selected clock /
  day-ring metrics, and the selected chip, written to `localStorage` by the card on
  change and on teardown, restored once coordinates resolve.
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
layer + `data/sources/`), `scene/`, `clock/`, `timeline/`, `charts/`, `hud/`,
`editor/`, plus the root `helios-card.ts` and a small `card/` for bootstrap
(`init`, `registry`, `diagnostics`).

The card is a thin composition root. Two **view controllers** (`ClockController`
in `clock/`, `SceneHudController` in `hud/`) own the dial and the scene HUD: each
is a plain class holding its own scratch / animation state, constructed as
`new XController(this)`, that reads the card's reactive `@state` and DOM refs
through `this.host` (the reactive data stays on the card, so Lit reactivity is
untouched). Public controller methods drop the leading underscore, per the repo's
lint rule.

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
   once (and its clock / scene-HUD controllers); later it updates the engine **in
   place** (home move, option change) rather than respawning it.
3. The engine boots the basemap, fetches buildings + weather, arms the atmosphere
   refresh and the optional auto-rotate loop, and starts firing `onMapTransform`
   per frame.
4. The card subscribes to the Energy dashboard and, through the data layer,
   fetches the per-source live + history in one shared recorder call, builds the
   unified store, and renders the HUD / charts / dial from it via the controllers.
   A short tick advances the live cursor and refreshes daily totals.
5. On disconnect the engine teardown is deferred briefly (HA edit-mode churn fires
   disconnect + reconnect in one tick); a real removal tears down the renderer,
   timers, controllers and observers, after persisting the view + pose.
