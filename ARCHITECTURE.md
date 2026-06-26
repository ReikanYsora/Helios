# HELIOS — Architecture

This document describes how the Helios card is put together: the
card / engine split, the 2.5D rendering pipeline, the data layer, the
view modes, and the conventions every subsystem follows. For the
user-facing feature list and configuration, see [README.md](./README.md);
for per-release notes, see [CHANGELOG.md](./CHANGELOG.md).

---

## 1. Overview

Helios is a single self-contained Lovelace card. There is no backend and
no build-time data: everything runs in the browser, talking to Home
Assistant over the WebSocket API and to a few public services (Open-Meteo
for weather, CARTO for the basemap, OpenStreetMap / Overpass for buildings).

The code splits cleanly in two:

* **The card** (`src/helios-card.ts` + `src/card/*`) — a Lit element that
  owns the DOM, the Home Assistant `hass` object, the configuration, and
  every data-fetch subsystem (energy, weather-derived series, charts). It
  decides *what* to show.
* **The engine** (`src/helios-engine.ts` + `src/engine/*`) — a
  framework-agnostic class that owns the 2.5D scene: the tilted basemap,
  the camera, the projection, and the SVG painter for buildings, shadows
  and night shade. It decides *how* the scene is drawn and projected.

The card feeds the engine a few setters (home location, sun time, palette,
buildings, period) and reads back projected screen-space geometry to place
its HUD. The engine never imports Lit and never reads `hass`; the card
never does trigonometry. The seam between them is a handful of public
methods plus per-frame callbacks (`onMapTransform`, `onWeatherUpdate`).

```
hass ──▶ helios-card.ts ──▶ card/* subsystems (energy, store, charts, clock)
              │
              ├─ setHome / setSun / setBuildings / setPeriod / setPalette
              ▼
        helios-engine.ts ──▶ engine/* (renderer, projection, tiles, sun, weather, buildings)
              │
              └─ onMapTransform()/onWeatherUpdate() ──▶ card re-projects its HUD
```

---

## 2. The 2.5D rendering engine

Helios renders a faux-3D ("2.5D") scene with **no WebGL**. The illusion is
a tilted raster basemap with every overlay projected on top in SVG so it
stays glued to the rotating ground.

### Ground plane — `engine/tiles.ts`, `engine/renderer.ts`

The basemap is a grid of **CARTO raster tiles** (`*.basemaps.cartocdn.com/
rastertiles/{light,dark}_nolabels/...`) stitched onto an HTML `<canvas>`.
The style follows the active Home Assistant theme (light vs dark), probed
from `hass.themes.darkMode`. The canvas is then tilted and turned with a
single CSS `rotateX(pitch) rotateZ(bearing)` transform about the home's
pixel position, so the ground reads as a plane viewed from an angle.

### Camera + projection — `engine/projection.ts`

`SceneCamera` is the keystone. All scene coordinates are **local metres
relative to the home origin** (+east, +north, +up). Per frame the host
calls `setViewport(w, h)` to bake the trig basis and the home's screen
anchor, then `project(east, north, up)` maps any point to screen pixels
through *bearing → pitch → perspective*. This is the exact inverse of the
ground canvas's CSS transform, which is what keeps the SVG overlays welded
to the basemap as the camera turns. `project3()` additionally returns the
camera-space depth for painter's-algorithm sorting and label fading.

### Scene SVG — `engine/renderer.ts`

`SceneRenderer` owns the DOM inside the card's `#map-container`: the ground
canvas plus a screen-space `<svg>` it repaints each frame with the
occluding geometry — the night-shade wash, the cast shadows, and the
extruded buildings. It coalesces redraws into one `requestAnimationFrame`
pass, owns its own `ResizeObserver`, and fires `onAfterDraw` so the card
can re-project its HUD in lock-step. Colour math (night shade, building
tint, day / night blends) lives in `engine/colors.ts`.

### Buildings — `engine/buildings.ts`

Footprints are fetched once from **OpenStreetMap via Overpass** for the
home location, parsed to local-metre polygons with a height (real OSM
height / `building:levels`, or a fixed prism), and cached in
`localStorage`. Interpretation (radius filter, nearest-N count, real-vs-
fixed height, home-cluster radius) is a pure pass re-run in memory on any
option change — no re-fetch. The home building(s) extrude opaque; the
surroundings extrude at the configured opacity. Each footprint also casts
a ground shadow from the current sun azimuth / altitude.

### Sun + shadows — `engine/sun.ts`

`engine/sun.ts` computes the solar position (altitude / azimuth) and the
clear-sky irradiance (Haurwitz 1945 + Kasten-Czeplak 1980 cloud
attenuation), and the card uses it to drive the sun arc, the disc, and the
shadow direction. Cast shadows are projected from the building footprints
along the sun vector and painted as depth-sorted SVG polygons by the
renderer; they fade as the sun nears the horizon.

---

## 3. View modes

The card has three modes (`_viewMode`), switched from the top-left rail.
A CSS class on `<ha-card>` (`mode-clock` / `mode-lidar`) fades the layers
that don't belong to the active mode.

### Scene (default)

The full live 3D view: tilted basemap, extruded buildings, cast shadows,
night shade, the sun arc (a back pass of below-horizon dots and a front
pass of the daylight arc + disc + ray + irradiance readout), the home pill
and its orbiting chip cluster (PV, battery SoC + power, grid, custom
entity), and the timeline below.

The HUD is **projected, not laid out**: `card/hud.ts` asks the engine for
the screen-space anchors of the home, the chip cluster and the sun scene
every frame (`onMapTransform`), and the card renders absolutely-positioned
chips + SVG leaders at those coordinates. Each chip has a leader to the
home with an animated **bead** whose direction and speed encode the live
flow. Clicking a chip points the timeline chart at that metric.

### Clock — `card/energy-clock.ts`

A 24-hour radial instrument. Each selected metric is binned into 24
hours-of-day over the rolling window and drawn as a ring of bars (one per
hour) projected flat on the same ground plane. The right-hand rail is a
**multi-select filter**: every active metric adds one **concentric ring**
(outer = first selected, nesting inward on fixed slots so adding / removing
a filter never re-spaces the others). Hovering or tapping a bar lights the
whole hour slice across rings, dims the rest, and shows one tooltip row per
metric; a faint clock-face guide (centre hub + 24 spokes) and an N / S
compass keep it legible as the dial rotates with the camera. Rings grow in
on selection (staggered sweep) and shrink out on removal. The bars are
built as a raw SVG string and injected imperatively each frame, the same
trick the renderer uses for buildings, to stay cheap under rotation.

### LiDAR (early, opt-in)

Appears only when a valid local nDSM is configured (`hasLocalLidar`). The
mode currently hides everything but the rail; the wireframe view and the
LiDAR-based shadow path are in active development. The CSS lives in
`css/helios-card-lidar-css.ts` with a `.lidar-overlay` seam reserved for
the future layer.

---

## 4. The data layer

Every number on the card comes from one of three places: the **HA Energy
dashboard** (solar / grid / battery), **Open-Meteo** (irradiance, cloud,
temperature, wind), or an optional **irradiance sensor**. They converge
into a single rolling-window store that every graph reads.

### HA Energy dashboard — `card/energy-prefs.ts`

Helios does not take per-card entity keys. It subscribes to
`energy/get_prefs` and resolves the solar / grid / battery / forecast slots
from the user's Energy dashboard config — the same slots the official
Energy card reads — re-fetching on `energy_preferences_updated`. Live chips
read the configured rate sensors (or differentiate a cumulative meter to
watts over a short rolling window); the past curves read the recorder's
pre-computed `change` metric (`card/energy-stats.ts`), the exact numbers
the Energy dashboard shows, so the two surfaces agree to the watt-hour.
`card/pv.ts`, `card/battery.ts`, `card/grid.ts` own the live + history
resolution per source; `card/energy-forecast.ts` reads the dashboard's
configured solar-forecast provider.

### Weather — `engine/weather.ts`

One fetch per home point against Open-Meteo, fusing a global model with the
best regional model for the location and taking the **per-timestep median**
to reject single-model outliers. It returns hourly irradiance
(`shortwave_radiation_instant`), the three cloud layers (collapsed to an
*effective* cover of `low + 0.6·mid + 0.2·high`), temperature and wind.
Cached in `localStorage` with a short TTL and exponential back-off on HTTP
429.

### Irradiance override — `card/irradiance.ts`

When `solar-irradiance-entity` is set, its recorder history + live state
replace the Open-Meteo model for past + present timestamps (forecast hours
stay on the model, since a sensor has no future).

### Unified store — `card/unifiedStore.ts`

The single source of truth for every graph. It bucketises the rolling
window (J-2 → J+2 by default) at the configured cadence
(`display-update-frequency-per-hour`, default 4 = 15 min) into parallel
series: `irradiance`, `cloud`, `production`, `forecast`, `battery`,
`batterySoc`, `gridImport`, `gridExport`. Weather is interpolated from its
hourly samples; the energy series are filled from the recorder `change`
buckets (past only, null in the future); the forecast is a stepped hourly
curve. A `dataVersion` hash lets consumers detect "same store as last
frame" and skip the rebuild; it rolls over at midnight. Read-side
accessors (`valueAt`, `sliceForRange`) give the charts and the clock a
consistent view regardless of cadence.

### Charts — `card/charts.ts`

The timeline is a re-targetable SVG chart over the store. `_chartTarget`
selects the series-set: production (+ dashed forecast + per-string stacked
breakdown), consumption, grid (import / export), battery (charge /
discharge), battery SoC, irradiance, cloud (three stacked bands) or the
custom entity. It draws day separators, night-zone hatching, a future
mask, the live + the scrub cursors, and a hover tooltip whose icons take
each series' colour.

---

## 5. Custom entity — `card/custom-entity.ts`

A user-picked power or energy entity surfaced two ways: as a red chip
(top-left, above the grid chip) with a leader + a sign-driven bead in scene
mode, and as a selectable metric (its own ring) in clock mode. The resolver
handles both wirings: an instantaneous power reading is shown signed
directly; a cumulative energy meter is shown in its native unit. The chip's
icon is the editor override, else the entity's own icon, else a generic
glyph; its colour is the HA frontend's named red.

---

## 6. Persistence

Two things survive a reload, both keyed per home (or per `cache-id` when
set, so two cards on one home stay independent):

* **The saved view** — view mode, the selected clock filters, and the
  selected chip — written to `localStorage` by the card on change and on
  teardown, restored once coordinates resolve.
* **The camera pose** — bearing, pitch and the lock flag — written by the
  engine on drag-end and on teardown (capturing an auto-rotated bearing
  too), and read back at boot so the scene reopens exactly as it was left.

A hidden `cache-id` is auto-generated by the editor the first time a card
is configured, and a runtime registry gives a pasted duplicate (same id) a
stable distinct slot, so copies never share a saved view.

---

## 7. Code organisation

Every `card/*` and `engine/*` module exports **plain functions** (plus the
two top-level classes). Subsystems don't import the card or the engine
directly; instead each declares a small **structural host interface** in
its own file describing exactly the fields it reads or mutates, and the
card / engine satisfies it structurally. This keeps each subsystem testable
in isolation and makes the dependency surface explicit at the call site —
e.g. `charts.ts` declares a `ChartHost` with just the store + series it
needs, and the card *is* a `ChartHost` by shape, not by inheritance.

Configuration is a flat, optional, kebab-case key map (`HeliosConfig`) with
a resolver helper per key in `helios-config.ts` that clamps + defaults the
raw value, so a malformed YAML value degrades gracefully instead of
throwing. The editor (`card/editor.ts`) is a hand-rolled accordion of
native controls + Home Assistant entity / icon pickers; it writes the same
flat config back via `config-changed`.

Internationalisation (`src/i18n/`) is a strict-typed `Translations`
interface with one locale file per language (en, fr today), picked by
`hass.language` with an English fallback.

---

## 8. Lifecycle, in short

1. `setConfig()` validates + stores the config; the editor auto-assigns a
   `cache-id` on first configure.
2. On first paint with resolved home coordinates, the card constructs the
   engine once; later it updates the engine **in place** (home move, option
   change) rather than respawning it.
3. The engine boots the basemap, fetches buildings + weather, arms the
   60 s atmosphere refresh and the optional auto-rotate loop, and starts
   firing `onMapTransform` per frame.
4. The card subscribes to the Energy dashboard, fetches the per-source
   live + history, builds the unified store, and renders the HUD / charts /
   clock from it. A 30 s tick advances the live cursor and refreshes daily
   totals.
5. On disconnect the engine teardown is deferred briefly (HA edit-mode
   churn fires disconnect + reconnect in one tick); a real removal tears
   down the renderer, timers and observers, after persisting the view +
   pose.
