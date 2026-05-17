# HELIOS, v1.6.0-alpha.3

HELIOS is a Home Assistant Lovelace custom card that visualises solar
conditions at a home in real time: sun arc, irradiance, cloud cover,
3D buildings with cast shadows, optional PV production, optional
home-battery state, all stitched onto a 3D MapLibre map centred on
the home and reflected in a scrubbable 5-day timeline.

The 3D basemap and the building footprints come from
**[OpenFreeMap](https://openfreemap.org/)** (free vector tiles built
from OpenStreetMap data via the OpenMapTiles schema, no API key, no
signup, no rate limit). Weather forecasts come from
**[Open-Meteo](https://open-meteo.com/)** (also free, no key). LiDAR
shadow data comes from national open-data programmes credited
per-country in the LiDAR section below. None of these services
require an account, so HELIOS ships and runs without any user
configuration of credentials.

External contributors who have shaped surfaces of the card beyond the
core author:

* **[@jourdant](https://github.com/jourdant)** , generic BYO local
  nDSM LiDAR provider in v1.6.0-alpha.2 (PR #5), idea credited to
  [@stephenwq](https://github.com/stephenwq).
* **[@i6media](https://github.com/i6media)** (Frank Boon) , optional
  `home-latitude` / `home-longitude` overrides in v1.6.0-alpha.1
  (PR #9).

---

## Changelog

Each entry consolidates everything between two stable releases.

### v1.5.1, tilted-panel forecast, today cumulative chart, dashboard polish

Hotfix-flavoured iteration on top of v1.5.0. Focused on the issues
1.5.0's new users surfaced in the first 24 hours after release: an
over-optimistic forecast for non-horizontal installs, a dashboard /
timeline mismatch on the projected kWh, and visual polish on the new
detail panel.

**Tilted-panel forecast.** `computePvPower` gains an optional `panel`
argument carrying `tiltDeg` and `azimuthDeg`. When tilt is greater
than zero, the function switches from the horizontal-panel fast path
to a Liu-Jordan isotropic transposition: GHI is split into direct
(cos-of-incidence transposed via `R_b = cos θi / cos z`) and diffuse
(`(1 + cos β) / 2`) components plus a 20 % albedo ground-reflection
term. Two new editor config keys, `pv-tilt` (0..90 degrees) and
`pv-azimuth` (0..360, clockwise from north, 180 = south), feed the
helper `_pvPanelOrientation()` on the card side; defaults keep the
horizontal-panel behaviour bit-for-bit unchanged. Closes #3. A user
with vertical balcony panels was seeing 4.7 kWh predicted against
1.1 kWh measured. With `pv-tilt: 90` + `pv-azimuth: 180`, the
prediction lands in the realistic range and tracks reality through
the day.

**Dashboard / timeline forecast alignment.** The "Aujourd'hui" card
was displaying a forecast figure that drifted from the value shown on
the timeline above. Two root causes: (a) the cumulative-energy unit
(`kWh`) was not handled by `_pvNormalizeToWatts`, which silently
returned 0 after differentiation, zero-ing the observed contribution
in `_computeTodayHourly`; (b) the dashboard's forecast was integrated
via hourly bins while the timeline used the raw `_computeDailyKwhTotals`
path. Both fixed: the cumulative-energy path now goes straight to
watts via `value * 1000` after differentiation, and the dashboard
reads today's forecast directly from `_computeDailyKwhTotals` so the
two surfaces are guaranteed to agree.

**Today cumulative chart.** The right half of the "Aujourd'hui" card,
previously empty, now hosts a sparkline of the day's running kWh.
Past portion is drawn from raw history (cumulative-energy sensors get
a baseline-subtracted reading per sample; power sensors are
integrated by trapezoidal rule); future portion extends with the
hourly forecast bins, the boundary cleanly stitched at "now". A dot
sits on every full hour and a hover line + travelling dot reveal a
tooltip showing the exact cumulative kWh at the cursor's minute.
Gated by a CSS container query on the section (`min-width: 380px`)
so the chart only appears when the card has room to render it
readably; below that, the layout falls back to the previous two-
column shape.

**"Pas encore produit" status + skeleton placeholder.** Two new UI
states for the produced figure in the "Aujourd'hui" card: a
shimmering skeleton replaces the value while the PV history fetch is
in flight (so transient "0,0 kWh" stops reading as fact), and a
small italic line ("production pas encore démarrée" / "production
hasn't started yet" / 8 locales) sits under the value when produced
is effectively zero and the forecast still expects a peak later in
the day.

**Battery cap double-edge fix.** The battery icon in the detail
dashboard had a visible double stroke at the seam between the cap
and the cell shell. Caused by two `<rect>` elements sharing their
edge with `rx`-rounded corners pulling in the cap's bottom slightly,
exposing the shell's top stroke alongside. Replaced by a single open
`<path>` for the cap (top + two sides, no bottom edge) so the shell's
top edge becomes the only stroke at the seam.

**1 px border on travelling beads.** The animated discs that ride
the PV → home and battery ↔ PV leader lines now carry a 1 px stroke
(theme-aware: white on light, near-black on dark) with `paint-order:
stroke fill` so they keep contrast against the map basemap, the
home chip, and any background that happens to share their fill
colour.

### v1.5.0, OpenFreeMap migration, manual PV peak, detail dashboard, multi-country LiDAR

A four-headed iteration on top of v1.4.0. Drops the MapTiler dependency
entirely, replaces auto-calibrating PV with a one-line manual input,
opens a click-through detail dashboard on the home, and rounds out the
LiDAR provider roster started in v1.4.0.

**OpenFreeMap migration.** The map stack moves from MapTiler (paid API
key, opt-in for HACS users) to [OpenFreeMap](https://openfreemap.org/),
which serves OpenMapTiles-schema vector tiles plus three maintained
styles (Liberty, Positron, Fiord) for free with no key, no signup and
no rate limit. The card now ships with zero credentials to configure;
the basemap and the buildings tile fetch (`helios-buildings.ts`) both
resolve their tile URL once at boot from OpenFreeMap's public
TileJSON. Three knock-on cleanups:

- The `maptiler-key` config option is removed (silently ignored if
  present in old YAML; the engine never reads it).
- The `topo` map style is gone (MapTiler-specific). `map-style` now
  accepts `streets` (Liberty) and `minimal` (Positron).
- A `styleimagemissing` handler stubs unknown sprite refs with a 1 px
  transparent image so OFM's smaller sprite sheet can't spam console
  warnings on style switch.

**Manual PV peak power.** The auto-calibration buffer (a 14-day
rolling fit of `predicted vs actual` samples kept in localStorage and
HA's `frontend/user_data`) is gone. Users now enter the installation's
peak power directly via a new `pv-peak-kwp` numeric option in the
editor. `_pvCalibK()` returns `kwp * 10` when set, `null` otherwise.
When `null`, the dotted forecast line and the predicted-value mode of
the PV chip both hide; the live observation, the PV chip and the
peak-of-day highlight still render. A one-shot boot routine
(`_wipeLegacyPvCalibStorage`, gated by a `helios-pv-calib:wiped-v1`
flag) deletes legacy calibration buckets so the migration is silent
for existing users.

**Detail dashboard.** Clicking the home triggers a camera dive (zoom
+ pitch ease) and fades a chip-styled overlay over the HUD with up
to three sections that appear in sequence (~180 ms stagger between
cards):

- **Today**: produced kWh, projected end-of-day total, peak-of-day
  time. No curve, the timeline above already carries that shape.
- **Tomorrow**: a single chip with weather icon + estimated kWh +
  expected peak hour, derived from the multi-model forecast and the
  Haurwitz / Kasten-Czeplak clear-sky model scaled by `pv-peak-kwp`.
- **Battery**: a vessel showing live SoC and the day's charge /
  discharge totals, present only if at least one battery entity is
  configured.

A weekly view was prototyped (5-day "bottle" gauges) but cut: HA's
own Energy dashboard already covers that ground, and squeezing
4 cards into a sub-8-row card layout was too cramped.

Each card shares the same chip vocabulary as the on-map overlays
(white surface, 1 px black border, soft shadow), with a dark-theme
override for `card-theme: 'dark'`. Click anywhere outside a card to
exit; the camera eases back to its pre-dive bearing and the HUD
fades back in.

**Hover home glow (replaces always-on halo).** The v1.4.0
sun-coloured halo painted under the home's outline as a permanent
MapLibre `line` layer is replaced by an SVG glow toggled on the
`home_hover` state. The home then reads as a calm anchor at rest and
the focal building only "lights up" when the cursor is over it,
signalling the click affordance for the detail dashboard.

**Multi-country LiDAR roster (continuing v1.4.0).** Four providers
land alongside the existing IGN-FR pipeline: Defra (England,
GeoTIFF DSM minus DTM), IGN España PNOA-LiDAR (peninsular Spain +
Balearics, two MDSn coverages merged via element-wise MAX), PDOK
AHN4 (Netherlands, GeoTIFF DSM minus DTM), Kartverket NHM (Norway +
Svalbard, ArcGIS Float32 GeoTIFF DOM minus DTM). All five route
through the shared post-processing in
`./helios-lidar/helios-lidar-pipeline.ts`. The `geotiff` package
(~120 KB gzip, lazy-loaded codecs inlined by Vite
`inlineDynamicImports`) is the only third-party dependency added.

Probed and parked: Wales (NRW, per-tile ZIP only), Switzerland
(swisstopo, WMS only carries pre-rendered hillshade), Slovakia
(ZBGIS, surface only as PNG), Denmark (Datafordeler DHM, requires
per-user OAuth).

**Timeline polish.** Daily kWh totals now appear under each date
label on the timeline. Sunrise / sunset ring markers on the sun arc
were swapped for MDI icons. The bottom scrub chip is gone; the
clock chip in the top-left flips to the blue scrub theme during a
scrub, and the back-to-live button is fused next to it. Auto-rotate
defaults to `false` (was `true`) so a fresh install is calm by
default; users opt in for kiosk dashboards.

**i18n.** New keys: `todayLabel`, `todayProduced`, `todayForecast`,
`todayPeak`, `tomorrowLabel`, `tomorrowPeak`, `batteryLabel`,
`batteryCharged`, `batteryDischarged`, `pvPeakPower`,
`pvPeakPowerHelp`. Norwegian (`no`) added as the 8th locale.

### v1.4.0, LiDAR-driven shadows, sun halo, home halo, focal home cluster

Headline iteration on top of v1.3.0. Integrates the French national
LiDAR HD dataset (IGN, metropolitan France + Corsica) as a source
for cast-shadow geometry: where coverage exists, shadows reflect
real buildings AND vegetation captured by aerial LiDAR, instead of
the flat MapTiler footprints (buildings only) used everywhere else.
The cloud-cover disc + 100 % ring move from MapLibre fill layers to
an SVG overlay so they stay a true circle whatever the terrain mesh
does underneath.

**Visual stack rework.** The home and its readouts get a coherent
redesign so the focal cluster reads as the centre of the card:

- The solar overlay splits into two passes. Below-horizon (dotted)
  segments render BEHIND the home chip cluster (z 4), so the home
  reads cleanly through the night portion of the orbit. Above-
  horizon arc + incidence ray + sun disc + W/m² readout render in
  FRONT of every chip (z 7), so the live sun always dominates the
  stack visually.
- New irradiance-driven sun halo, a soft glow at 3× the disc radius,
  filled by an SVG `radialGradient` that drops from
  `sunFillRatio × 0.55` opacity at the centre to fully transparent
  at the rim. Clear-sky noon radiates a visible aura without any
  hard edge.
- New sun-coloured home halo, a blurred MapLibre `line` layer
  (`line-width: 8`, `line-blur: 6`, `line-opacity: 0.55`) painted
  underneath the crisp black home outline (bumped from 2 px to
  3 px). The halo colour tracks the configured sun colour through
  `updateConfig`, keeping the home visually tied to the Helios
  brand palette.
- Cloud chip anchor rotates 45° CCW in the (east, north) world
  frame: NH east → NE, SH west → SW. Both project to the screen's
  lower-left at the hemisphere's resting bearing, leaving the
  upper-screen quadrant to the irradiance chip and the sun.
- New PV → home animated leader: a vertical dashed line in the
  configured PV colour from the production chip's bottom edge down
  to a small anchor bead on the home, dashes flow toward the home
  at a speed proportional to current production over the user's
  theoretical peak (`100 × pvCalibK` when calibrated, 5 kW fallback
  while it warms up). Static and arrow-less when production is 0.
- PV / SoC / Power chip cluster lifts 50 px (PV_CHIP_OFFSET_PX
  65 → 115) so the home reads as a calm anchor with no chip on the
  roof. SoC and Power chips' L-leader vertical legs halve
  (BATTERY_CHIP_Y_OFFSET_PX 40 → 20), and their feet move from the
  PV chip's centre to 25 % / 75 % of its width.
- Date/time chip moves from top-centre to top-left, mirroring the
  back-to-live button on the opposite edge. The button itself drops
  from a folder-style tab hanging below the clock to a standalone
  22 × 22 px chip in the top-right rail, matching the clock's
  rendered height; its icon shrinks from 18 px to 14 px. Both rails
  share the 8 px frame margin used by the timeline.
- Default battery colour changes from `#D32F2F` (Material Red 700)
  to `#FF5252` (Material Red A200) for chip-on-map legibility
  against busy satellite basemaps in both light and dark themes.

**Debug helper.** A non-persisted home-location override is exposed
on `window` so visual issues reported by users can be reproduced on
the developer's instance without touching HA's config:

```js
setHeliosLocation(lat, lon)   // override home for every live card
clearHeliosLocation()         // revert to hass.config
```

The override sits on `window.__heliosLocationOverride` only (no
localStorage), so a page refresh always restores `hass.config`. Each
card reads through a private `_getHomeCoords()` helper that prefers
the override and falls back to `hass.config.{latitude,longitude}`;
when the helper toggles, every live card invalidates its cached
home key and re-inits the engine + weather fetch + PV calibration
bucket against the new coordinates. Calibration data is preserved
across overrides because `helios-pv-calib:${lat}_${lon}` is the
storage key in both `localStorage` and HA's `frontend/user_data`,
so each location owns its own bucket and going back recovers the
original cache untouched.

**Shadow pipeline.** A single master `shadows-enabled` toggle drives
whether cast shadows are rendered at all. When on, the source is
picked automatically:

- **Home inside a LiDAR provider's coverage.** The card fires one
  WMS round-trip to IGN's `IGNF_LIDAR-HD_MNH_*` service, decodes the
  BIL height raster client-side, runs a size-capped 8-connected
  flood fill on the above-threshold cells (each clump capped at ~80
  m² physical), and emits one convex-hull Polygon per clump with
  `render_height` set to the clump's mean cell height. The size cap
  keeps a dense forest from collapsing into one giant blanket shadow
  while the convex hull preserves the organic, non-grid-aligned
  shape of each clump.
- **Outside coverage.** The card falls back to the MapTiler home +
  surroundings footprints (buildings only, no vegetation).

`projectExtrusionShadows` projects each casting polygon's vertices
in the opposite-of-sun direction and emits the convex hull as a
single flat-opacity shadow polygon. The result is clipped to the
building visibility disc via Sutherland-Hodgman against a 64-segment
disc approximation so a tall tree at the edge no longer trails a
200 m shadow past the visible surroundings.

**Raster-backed rendering.** Instead of pushing those shadow
polygons into a MapLibre fill layer, the engine rasterises them
onto a 1024×1024 offscreen canvas at solid black, uploads the
canvas as a MapLibre image source, and renders a raster layer at
`raster-opacity = shadow-opacity`. Per-pixel rendering means many
overlapping clump shadows can't saturate to black through
alpha-compositing the way overlapping fill polygons would; every
pixel is either covered or not, never stacked twice. Canvas
anti-aliasing also softens the polygon edges. A rotating-sun chip
top-right of the map signals the user that LiDAR shadows are still
being fetched + painted.

`lidar-precision` (`low / medium / high` mapped to 256² / 512² /
1024² rasters) controls the IGN raster sampling. It has no effect
out of coverage.

**Cloud disc + ring as SVG.** The translucent on-ground cloud-cover
disc and its fixed 100 % reference ring live as SVG polygons in a
dedicated `.cloud-svg` overlay, projected through
`_projectScenePoint(..., anchorAtHome: true)` (same trick used by
the sun arc) so every vertex shares the home's terrain elevation
reference. The hover breakdown tooltip is wired directly on the
SVG polygon.

**Editor reshuffle.** A new "Shading" section regroups every
shadow-related option: the master toggle, the LiDAR precision
selector (`low / medium / high`), and the opacity slider. The
v1.3.x "MapTiler shadows" toggle and the v1.4-beta irradiance
scanner section are gone.

**Performance.** Three caches absorb the hottest paths so the
rotation cost stays flat:

- The 96-sample sun arc table (sun position + clear-sky GHI per
  15 min step) is memoised per (calendar day, integer cloud %).
  On every map transform we re-project the cached lon/lat/altitudeM
  tuples through the current matrix and skip 96 × 2 trig calls.
- `projectExtrusionShadows` caches its 64-vertex clip disc and the
  per-edge direction vectors that Sutherland-Hodgman consumes,
  keyed on (clip center, radius). Rebuilt only when the home or the
  building radius actually changes.
- `_refreshShadowsAndAtmosphere` carries a signature of the inputs
  the raster mask depends on (sun position rounded to 0.01°, source
  features identity + length, radius, home). Same signature, the
  project + canvas paint + PNG encode round-trip is skipped
  entirely.

`getSunPosition` also keeps a single-entry cache so consecutive
calls in the same Lit cycle return immediately, and the PV chart's
hourly aggregation is memoised against the history reference.

**i18n.** New keys: `shadowsSection`, `shadowsEnabled*`,
`lidarPrecision*`, `shadowOpacity*`, `mapStyleMinimal`,
`mapStyleSatellite`, `terrainDetail*`. All 7 locales updated.

**LiDAR coverage.** France IGN HD lands here in v1.4.0; the four
other providers (Defra UK, IGN ES, PDOK NL, Kartverket NO) land in
v1.5.0 alongside the OpenFreeMap migration. Adding a country is a
single-file drop under `./helios-lidar/providers/`: implement the
`LidarSource` interface from `helios-lidar.ts` and register the
provider in `LIDAR_SOURCES`. The `findLidarSource(lat, lon)`
resolver returns the first matching provider, or `null` for an
out-of-coverage home, in which case the engine falls back to its
basemap building footprints automatically.

The shared post-processing (flood-fill on cells above a height
threshold + size cap + convex hull) lives in
`./helios-lidar/helios-lidar-pipeline.ts`. Each provider only owns
the upstream-specific fetch logic: France serves a single nDSM
raster as BIL float32, the others (UK / NL / NO) need two GeoTIFF
fetches (DSM + DTM) and a per-pixel subtraction, Spain merges two
pre-normalised coverages (vegetation + buildings) via element-wise
MAX. The GeoTIFF fetch + decode + math helpers are factored into
`./helios-lidar/helios-lidar-geotiff.ts`, backed by the `geotiff`
package (~120 KB gzipped, includes lazy-loaded codecs for pako /
zstd / lerc / jpeg / lzw all inlined into the single `helios.js`
bundle via Vite `inlineDynamicImports`).

Providers probed and not yet integrated:

* **Wales** (NRW), per-tile ZIP downloads only, no live raster query.
* **Switzerland** (swisstopo), WMS only carries pre-rendered PNG
  hillshade; raw `swissALTI3D` rasters are downloadable as files
  only.
* **Slovakia** (ZBGIS), DMR (terrain) is GeoTIFF, but DMP (surface)
  is only published as cached PNG visualisation.
* **Denmark** (Datafordeler DHM), WCS GeoTIFF exists but requires a
  per-user API key / OAuth signup.

### v1.3.0, Auto-calibrating PV, terrain detail, mobile rotation, stability

A feature-rich iteration on top of v1.2.0. Adds auto-calibrating PV
prediction with persistence, terrain-detail control, building
outlines, peak-production highlights, and a mobile-friendly single-
pointer rotation handler. Also consolidates a long string of
stability hotfixes (memory leaks, iOS WebGL recovery, editor-preview
engine skip, engine-count cap). No breaking changes; existing
configs work without modification.

**Auto-calibrating PV prediction.**
The card learns the user's installation by ratio-matching its
Haurwitz/Kasten-Czeplak prediction against the live PV power sensor.
A rolling calibration buffer keeps a recent history of `(predicted,
actual)` samples and produces a smoothed gain so the predicted curve
on the PV chart matches the user's setup over time. The buffer is
persisted server-side via Home Assistant's `frontend/user_data`, so
it survives browser cache wipes, device switches, and dashboard
restarts.

**PV chart improvements.**

- Daily peak-production highlight columns mark each day's maximum
  on the PV chart so the eye lands on the relevant slice without
  reading the axis.
- The leader between the cloud-cover chip and the cloud disc now
  terminates at the edge of the filled disc (sized by the live
  cloud percentage) instead of the fixed reference ring.

**Terrain detail.**
New `terrain-detail` option toggles the DEM `maxzoom` between a
smooth low-detail mesh (default) and a finer terrain pass for users
in dramatic relief.

**Building outlines.**
Both `helios-buildings-home` and `helios-buildings-surroundings`
layers are accompanied by a stroke outline so building footprints
stay legible at low opacity.

**Mobile drag rotation.**

- Custom single-pointer rotation handler replaces MapLibre's
  default right-click `dragRotate` so left-click / single-finger
  touch rotates the map cleanly on mobile.
- `touch-action: none` is forced on the MapLibre canvas so the
  browser doesn't intercept the gesture as a scroll.
- Manual drag direction is inverted so the map follows the gesture
  (drag right → world rotates with the finger).

**Editor and lifecycle stability.**

- Engine initialisation is debounced by 500 ms; cards that live for
  less than that (HA dashboard editor preview, rapid config edits)
  never spawn a MapLibre engine or claim a WebGL context.
- A module-level cap on live `HeliosEngine` instances force-cleans
  the oldest when a new one would push the count over the Safari
  mobile WebGL ceiling.
- A hard skip on cards rendered inside HA's dashboard editor
  preview prevents context exhaustion during config editing.
- `window.__heliosStats` exposes lifecycle counters
  (engine create / cleanup / skipped-as-preview) for in-browser
  forensics.

**Memory hardening.**

- iOS WebGL recovery: the context is force-released via
  `WEBGL_lose_context.loseContext()` after `map.remove()`.
- Pre-cleanup of the map container drains leftover canvas nodes
  before each engine re-init.
- Layer-style warnings are silenced at the source by gating
  `setPaintProperty` on `map.getLayer()` existence.

**i18n.**
French punctuation polish (non-breaking spaces before `:`, `;`, `?`,
`!`). New key: `terrainDetail`.

### v1.2.0, Performance, customization, home cluster

A performance-first iteration on top of v1.1.0, plus several
requested customization knobs and a structural fix to the building
rendering pipeline that resolves the dominant FPS bottleneck
reported on v1.1.0. No breaking changes; existing configs work
without modification.

**Buildings, fully self-sourced.**
The 3D buildings used to come from MapTiler's full vector basemap
with no spatial filter, painting thousands of fill-extrusions per
frame in dense urban areas. The card now fetches the MapTiler v3
vector tiles around the home directly, decodes them with
`@mapbox/vector-tile`, splits the MultiPolygon features that group
unrelated buildings together at the source, filters by haversine
distance, and emits two GeoJSON collections rendered as two
distinct fill-extrusion layers:

- `helios-buildings-home`, the home and any attached outbuildings,
  at full opacity.
- `helios-buildings-surroundings`, neighbours within the configured
  visibility radius, at the configured opacity.

The native MapTiler building layers (`Building`, `Building 3D`,
`Building number`) are removed at style load, the bare `removeLayer`
calls work reliably on the current MapTiler v4 style which doesn't
use MapLibre 5 style imports.

**New configuration options:**

- `building-radius` (m, default 100, range 20–1000), visibility
  radius for neighbour buildings.
- `building-cluster-radius` (m, default 0, range 0–100), distance
  around the home within which every building joins the home group
  at full opacity. Lets verandas, garages and sheds read as one
  with the main house.
- `building-opacity` (0..1, default 0.25), opacity of the
  neighbour buildings.
- `building-color` (hex, default `#d2d2d7`), base colour for every
  rendered building, modulated by sun altitude through the day.
- `performance-mode` (boolean, default `false`), disables the 3D
  terrain mesh and hillshade and forces pixelRatio to 1.0. Pitch and
  3D buildings are preserved, so the card still reads as 3D but
  recovers 3–5× FPS on low-end devices.
- `map-style: 'minimal'`, a third option alongside `'streets'` and
  `'topo'` that loads streets-v4 then prunes every non-essential
  layer (POI symbols, place names, country labels, road shields)
  for a stripped basemap.
- `auto-rotate-enabled` (boolean, default `true`), opt out of the
  slow ambient camera orbit.

**Layout polish.**

- The date/time chip and the timeline now sit at symmetric distances
  from the card edges.
- The "Back to live" tab is larger (40 × 24 px) and easier to tap.
- The PV / SoC / Power chip cluster moved closer to the home; the PV
  chip is mirrored below the SoC / Power shelf, placing it next to
  the home as a focal badge.
- The PV-to-home dashed leader was retired, the chip's position
  already conveys the relationship.
- The solar ray now snaps to the side of the PV chip that faces the
  sun (top / right / bottom / left, ±45° windows from up).
- The cloud-cover leader points to the centre of the cloud disc
  instead of the reference ring's east edge.

**Editor UX.**

- Every numeric option is a slider with the value shown next to the
  track. No more chance to type an out-of-range value.
- Slider input is debounced (250 ms) before the engine sees the
  value, so dragging doesn't cascade per-pixel re-renders.

**Animation perf.**

- An `IntersectionObserver` pauses every CSS animation and every
  SVG SMIL animation when the card scrolls out of the viewport.
- `prefers-reduced-motion` is respected, system-level reduced-
  motion setting disables every Helios animation and transition.

**Memory and stability.**

- The four inactivity-bumper canvas listeners are now detached on
  `cleanup()`; their closure used to keep dead MapLibre maps alive
  across editor re-inits.
- The WebGL context is force-released via
  `WEBGL_lose_context.loseContext()` after `map.remove()`, browsers
  cap active WebGL contexts at 8–16 and weren't always reclaiming
  the slot when MapLibre alone released the resources.
- The map container is drained of leftover canvas nodes before each
  engine re-init.

**Internals.**

- Terrain DEM `maxzoom` lowered from 14 to 12, terrain mesh has
  ~16× fewer vertices to project per rotation frame, invisible at
  pitch 55° / zoom 18 over the home.
- `pixelRatio` cap lowered from `[2, 3]` to `[1.5, 2]` on desktop
  and `[1, 1.5]` to `[1, 1.25]` on mobile.
- Hybrid map style (satellite imagery + raster pipeline) retired.
- Card chrome theme is wired to the map style: `card-theme: 'dark'`
  loads the `-dark` MapTiler variant.

**i18n.**
New keys: `mapStyleMinimal`, `buildingsSection`, `buildingsHint`,
`buildingRadius`, `buildingClusterRadius`, `buildingOpacity`,
`buildingColor`, `performanceMode`, `performanceModeOn`,
`performanceModeOff`, `performanceModeHint`. Removed:
`mapStyleHybrid` (the hybrid style is gone).

### v1.1.0, Home battery, PV production, dark theme

Major feature pass on top of v1.0.0. Three optional overlays became
available, the card got a dark skin, and the basemap / camera
vocabulary tightened.

**PV production overlay** *(optional, `pv-power-entity`)*.
A chip pinned above the home shows instantaneous production (W or
kW). Cumulative-energy sensors (kWh) are differentiated on the fly
over a rolling 60 s window. A dedicated mirror chart appears above
the irradiance / cloud timeline. The leader line between home and
chip animates at a speed proportional to live production.

**Home-battery overlay** *(optional, `battery-soc-entity` and/or
`battery-power-entity`)*.
Two chips flank the PV chip: State-of-Charge on the left, signed
instantaneous power on the right. The Power chip's leader animates
to track the sign of the live power (charging vs discharging).
L-shaped polylines connect each battery chip to the PV chip.

**Cloud-cover breakdown tooltip.**
Hovering the on-ground cloud disc opens a low / mid / high
breakdown. The chip stays simple; the detail is on demand.

**Dark theme** (`card-theme: 'dark'`).
Card chrome (chips, charts, buttons, tooltips, scrub overlay)
switches to a near-black surface so the card sits cleanly in dark
HA dashboards. Surface tone settled on `#191a1b`.

**Topographic basemap** (`map-style: 'topo'`).
A second basemap option alongside the default streets variant ,
softer earth tones and contour lines for hilly / outdoor settings.

**Other polish.**

- The solar-ray dash flow runs at a speed proportional to live
  irradiance.
- The cloud-cover chip moved off the home's vertical axis to a
  fixed geographic anchor east (NH) / west (SH) of the disc, giving
  the home's axis to the PV chip.
- Solid chip surfaces (fully opaque `#ffffff` / `#14161c`), earlier
  translucent versions fought the values' legibility.

**i18n.** 7 locales, `en`, `fr`, `de`, `es`, `it`, `nl`, `pt`.

### v1.0.0, Initial HACS release

First public release. Core feature set:

- Solar arc projection (NOAA-validated; mean altitude error 0.30°,
  mean azimuth error 0.36° across 376 sample points).
- Live sun disc with irradiance-proportional fill.
- Animated incidence ray from sun to home.
- Cloud-cover ground disc scaled by live cloud %.
- 5-day scrubbable timeline (2 past + today + 2 forecast),
  dual-area chart of irradiance and cloud cover.
- OpenFreeMap 3D vector basemap (no API key, no signup, OpenMapTiles schema).
- Open-Meteo multi-model weather fetch with regional model
  selection and median fusion.
- 7-locale i18n.

---

## What HELIOS does

HELIOS is a Home Assistant Lovelace card that visualises solar
conditions at the user's home. The full picture sits on a single
3D MapLibre map:

* **Sun arc**, the sun's full 24 h trajectory across the sky,
  projected onto the screen with depth (thicker stroke when in
  front of the camera, thinner behind). Split into two passes:
  below-horizon dots render behind the home chip cluster so the
  home stays readable through the night half of the loop;
  above-horizon segments + sun disc + W/m² chip render in front
  of every chip so the live sun always dominates the stack.
* **Sun disc with halo**, the live position on the arc. Four
  concentric layers, painted back-to-front: an irradiance-driven
  halo (SVG `radialGradient`, 100 % alpha at the centre, 0 % at
  the rim, peak alpha = `sqrt(irradiance/1000) × 0.55`); a
  background tint; an inner fill whose radius scales with
  irradiance; an outer rim.
* **Incidence ray**, dashed line from the sun to the PV chip,
  animated to flow at a speed proportional to live irradiance.
  Snaps to the side of the PV chip facing the sun.
* **Cloud cover disc**, a translucent disc on the ground, centred
  on the home, scaled by the live cloud-cover percentage and
  outlined in the configured cloud colour. A fixed black ring
  marks the 100 % reference.
* **Solar irradiance chip**, pinned above the sun disc, shows the
  live W/m² figure.
* **Cloud cover chip**, pinned just outside the cloud disc at a
  hemisphere-aware geographic anchor (NE of home in NH, SW in SH).
  Shows the live cloud %. Hovering the disc reveals a low/mid/high
  breakdown tooltip.
* **Home halo**, a soft sun-coloured glow under the focal home
  outline so the building reads at a glance even on a busy basemap.
* **PV production chip** *(optional)*, when a `pv-power-entity`
  is configured, a chip above the home shows the *instantaneous*
  production in W or kW. Cumulative-energy sensors (kWh) are
  differentiated automatically over a rolling 60 s window.
* **PV → home animated leader**, a vertical dashed line in the
  configured PV colour from the PV chip's bottom edge down to a
  small anchor bead on the home. Dashes flow toward the home at a
  speed proportional to current production over the user's
  theoretical peak (100 × `pvCalibK` when calibrated, 5 kW
  fallback). Static and arrow-less when production is 0.
* **Home battery chips** *(optional)*, State-of-Charge and signed
  instantaneous Power flank the PV chip, each connected to PV by
  an L-shaped leader whose foot lands at 25 % / 75 % of the PV
  chip's width. The Power leader's dashes flow with the sign of
  the live power.
* **Date/time chip**, top-LEFT of the card, follows the timeline
  cursor (live or scrubbed).
* **Back-to-live button**, top-RIGHT rail, mirrors the date/time
  chip on the opposite edge. Shows only while scrubbing. Shares
  its column with the LiDAR busy chip when both are active.
* **Timeline**, bottom of the card, 5 days wide. Dual-area chart
  with irradiance (top) and cloud cover (bottom) sharing a
  midline that doubles as a date axis. A second chart for PV
  production appears above when configured. Click or drag to
  scrub; the whole map reflects the selected instant in real time.

---

## Project structure

```
Helios/
├── .github/
│   └── workflows/                  HACS validation + release attach
├── data/                           Local working datasets for helper tooling
│   └── <dataset>/                  Dataset-scoped raw / work / out folders
├── dist/                           Generated by `npm run build` (committed for HACS)
│   └── helios.js                   Single bundle
├── tools/                          Offline helper tooling (Python, run via `uv`)
│   ├── lidar/                      Current LiDAR prep / inspection helpers
│   └── tool_paths.py               Shared path helpers for tool scripts
├── src/
│   ├── helios-card.ts              Lit card class, composes everything
│   ├── helios-card-css.ts          Card styles (extracted for readability)
│   ├── helios-config.ts            Visual editor + color picker + config helpers
│   ├── helios-engine.ts            Map orchestration + projection + layers
│   ├── helios-buildings.ts         Self-sourced building tile fetch + radius/cluster filter
│   ├── helios-shadows.ts           Ground-projected shadow polygons (single flat-opacity layer)
│   ├── helios-lidar.ts             LidarSource interface + provider registry
│   ├── helios-lidar/
│   │   ├── helios-lidar-pipeline.ts  Shared flood-fill + convex-hull pipeline
│   │   ├── helios-lidar-geotiff.ts   Float32 GeoTIFF fetch + DSM-DTM math
│   │   ├── helios-lidar-local-ndsm.ts  Generic BYO nDSM provider built on demand from card config
│   │   └── providers/              One file per country
│   │       ├── helios-lidar-fr.ts  IGN HD (metropolitan France + Corsica), BIL float32
│   │       ├── helios-lidar-uk.ts  Defra LiDAR Composite (England), GeoTIFF DSM + DTM
│   │       ├── helios-lidar-es.ts  IGN España PNOA-LiDAR MDSn (peninsular Spain), GeoTIFF
│   │       ├── helios-lidar-nl.ts  PDOK AHN4 (Netherlands), GeoTIFF DSM + DTM
│   │       └── helios-lidar-no.ts  Kartverket NHM (Norway + Svalbard), ArcGIS Float32 GeoTIFF
│   ├── helios-sun.ts               Solar position + Haurwitz / Kasten-Czeplak math
│   ├── helios-weather.ts           Open-Meteo fetch + multi-model fusion + cache
│   └── i18n/
│       ├── index.ts                Resolver + Translations interface
│       └── locales/                en, fr, de, es, it, nl, pt, no
├── hacs.json                       HACS manifest
├── package.json
├── pyproject.toml                  Python helper-tool metadata
├── tsconfig.json
├── uv.lock                         Locked Python helper-tool dependencies
├── vite.config.ts
├── README.md                       User-facing docs
├── ARCHITECTURE.md                 This file
└── LICENSE                         MIT
```

Each `src/helios-*.ts` file has a clearly bounded responsibility:

The repo now has two deliberate layers:

* **Runtime card code in TypeScript.** Everything that ships to Home
  Assistant lives under `src/` and is bundled into the frontend asset.
* **Offline prep tooling in Python.** Local dataset preparation,
  inspection, and conversion helpers live under `tools/` and operate
  on `data/`.

Python was chosen for that second layer because many of the existing
tools and libraries we want to use are already written there. In this
repo that mostly means geospatial and raster work: GDAL-backed format
conversion, inspection helpers, and one-off prep scripts that are far
more mature in Python than in the browser-oriented JavaScript stack.
That keeps the shipped card lean while still letting the project reuse
the right ecosystem for offline processing.

`uv` is the lightweight wrapper around that tooling. It gives us a
small, repeatable Python side with pinned dependencies, fast env setup,
and a clean `uv run python ...` entrypoint for contributors running
helpers locally. The goal is for the Python surface to feel like repo
tooling, not like a second application bolted onto the project.

The `tools/` + `data/` split is also future-facing. Current LiDAR
helpers already use it, but the structure is there so the next workflow
does not have to invent its own layout. GeoJSON tooling is the obvious
next example: new scripts can live under `tools/geojson/` and work
against `data/<dataset>/raw`, `work`, and `out` using the same pattern.

* **helios-card.ts**, top-level Lit element. Owns `render()`,
  the live readings state, the timeline scrub, the PV state and
  the lifecycle hooks. Mostly composition; no heavy logic.
* **helios-card-css.ts**, single `css\`...\`` literal exported
  as `heliosCardStyles`. Imported once from the card.
* **helios-config.ts**, `<helios-card-editor>` (visual editor),
  `<helios-color-picker>` (custom palette + hex picker that
  side-steps the iOS Safari `<input type="color">` crash inside
  HA's nested Shadow DOM), plus `cfgHex` / `formatDate` helpers.
* **helios-engine.ts**, MapLibre setup, night-shade layer,
  building extrusions, cloud-cover disc, screen-space projections
  (sun arc, sun disc, incidence ray, sunrise / sunset rings, label
  positions). Holds the public API consumed by the card
  (`onWeatherUpdate`, `projectSunScene`, `setSelectedTime`,
  `getTimelineSeries`, etc.). Resolves the basemap to one of the
  OpenFreeMap styles (Liberty / Positron / Dark) at init based on
  `map-style` + `card-theme`, no API key required.
* **helios-buildings.ts**, pure module: fetches OpenFreeMap planet
  vector tiles around the home (snapshot URL resolved once via the
  `/planet` TileJSON, cached for the page lifetime), decodes them
  with `@mapbox/vector-tile`, splits MultiPolygons, filters
  features by haversine distance, identifies the home cluster.
  Returns two GeoJSON `FeatureCollection`s consumed by the engine.
* **helios-shadows.ts**, `projectExtrusionShadows` takes a building
  / region FeatureCollection plus the current sun position and
  returns a FeatureCollection of single flat-opacity ground shadow
  polygons (one convex hull per input region, no fade-step
  stacking). Output polygons are clipped Sutherland-Hodgman against
  the building visibility disc so cast shadows never extend past
  the rendered surroundings.
* **helios-lidar.ts**, `LidarSource` interface + `LIDAR_SOURCES`
  provider registry + `findLidarSource(lat, lon)` resolver. Adding
  a country means dropping a new file under
  `./helios-lidar/providers/`.
* **helios-lidar/helios-lidar-pipeline.ts**, the shared post-
  processing every provider routes through: classify cells above a
  height threshold (with optional circular crop), size-capped
  8-connected flood fill so dense forests decompose into many small
  clumps, one convex hull per clump emitted as a `Polygon` feature
  with `render_height` set to the clump's mean height. Identical
  output shape to OpenFreeMap building footprints so the rest of
  the engine doesn't care which side fed the polygons.
* **helios-lidar/helios-lidar-geotiff.ts**, `fetchFloat32GeoTiff`
  for the WMS / WCS / ArcGIS endpoints that serve `image/tiff`
  (everyone except IGN's BIL fast path) plus `subtractRasters`
  (DSM minus DTM → height-above-ground) and `maxRasters` (used by
  Spain to merge vegetation and building MDSn coverages). The
  `geotiff` package is the only third-party dependency added for
  LiDAR support; its lazy-loaded codecs (pako, zstd, lerc, jpeg,
  lzw) are inlined into the single-file bundle by Vite
  `inlineDynamicImports`.
* **helios-lidar/helios-lidar-local-ndsm.ts**, generic BYO nDSM
  provider built on demand from card config (not registered in
  `LIDAR_SOURCES`). Sibling `validateLocalNdsmConfig()` +
  `resolveLidarSource()` helpers in `helios-lidar.ts` validate the
  six `lidar-local-ndsm-*` keys, instantiate a per-config
  `LidarSource`, and prefer it over any public provider that would
  otherwise match inside the configured bounding box. Geotiff
  decoding uses `fetchFloat32GeoTiffWithNoData()` (a sibling of
  `fetchFloat32GeoTiff()` that also returns the GDAL_NODATA
  sentinel so nodata cells can be mapped to NaN before the shared
  pipeline runs). Contributed by [@jourdant](https://github.com/jourdant)
  in PR #5, with the original idea credited to
  [@stephenwq](https://github.com/stephenwq). Unlocks coverage in
  any region with raw LiDAR data available offline (initial use
  case: NSW Australia).
* **helios-lidar/providers/helios-lidar-fr.ts**, IGN LiDAR HD
  pipeline for metropolitan France + Corsica. One WMS round-trip
  on `IGNF_LIDAR-HD_MNH_*` (`image/x-bil;bits=32`), feeds the
  shared pipeline, output passes `projectExtrusionShadows` exactly
  like the OpenFreeMap footprint path.
* **helios-sun.ts**, `getSunPosition`, `computePvPower`,
  `computeIrradianceWm2`. Pure functions; no DOM, no map.
* **helios-weather.ts**, `fetchHomePointData` and friends:
  multi-model Open-Meteo fetch with median fusion, regional
  model selection, in-browser cache, and the 429 back-off
  schedule. No DOM, no map.

---

## Algorithms

### Solar position

`getSunPosition(date, lat, lon)` returns altitude / azimuth. The
implementation uses a simplified declination + equation of time,
with hour-angle normalisation so longitudes far from Greenwich
(NYC, Tokyo, Sydney) stay correct. Validated against the NOAA SPA
reference: mean altitude error 0.30°, mean azimuth error 0.36°
across 376 sample points.

### Clear-sky irradiance

Haurwitz (1945): `GHI_clear = 1098 · cos(z) · exp(-0.059 / cos(z))`
W/m², where `z` is the solar zenith angle. MAE ~62 W/m² versus
PVGIS / NREL benchmarks across full-day curves at varied latitudes.

### Cloud attenuation

Kasten-Czeplak (1980) cubic: `GHI_actual / GHI_clear = 1 - 0.75 ·
(cloud/100)^3.4`. The cloud cover used here is the *effective*
ground-perception value (see below), not the satellite-view total
from Open-Meteo.

### Effective cloud cover

The raw `cloud_cover` field from Open-Meteo measures the satellite-
view total. For ground-level shortwave attenuation, low cloud
weighs much more than high cloud. HELIOS computes:

```
effective_cover = clamp(low + 0.6·mid + 0.2·high, 0, 100)
```

### Multi-model weather fusion

Every Open-Meteo fetch queries one global model (ECMWF IFS 0.25°)
plus the most accurate regional model for the home's location
(AROME-France, UKMO UK, DWD ICON-D2, ItaliaMeteo, MET Nordic,
NOAA HRRR, KMA LDPS, JMA MSM, BOM ACCESS-G, or ECMWF + GFS
elsewhere). Per-timestep median fusion absorbs single-model
outliers (low-cloud pegs, irradiance spikes).

### PV instantaneous rate

For cumulative-energy sensors (`Wh`/`kWh`), the card maintains a
5-minute rolling buffer of state samples and differentiates over
a ~60 s window. This produces a real "what's being produced right
now" reading instead of a misleading lifetime total. Power sensors
(`W`/`kW`) are read directly from `hass.states`.

### Building radius + home cluster

At engine init, `helios-buildings.ts` fetches OpenFreeMap planet
vector tile(s) covering a bbox around the home (1–4 tiles at z=14).
The tile URL template is resolved once at startup from the public
TileJSON at `https://tiles.openfreemap.org/planet`; OpenFreeMap
rotates the underlying snapshot path every few weeks, so caching
the template per page lifetime keeps us pointed at whatever
snapshot is current. Each tile's `building` source-layer is
decoded (OpenMapTiles schema, so `render_height` and
`render_min_height` are present); MultiPolygon
features are split into independent Polygon features. Then each
feature is classified:

- If the polygon contains the home point OR its centroid is within
  `building-cluster-radius` of the home → home cluster.
- Else if its centroid is within `building-radius` → surroundings.
- Else discarded.

The home cluster is emitted as one `FeatureCollection`, painted at
full opacity. Surroundings are another `FeatureCollection`, painted
at the configured opacity. Both share the same `fill-extrusion-color`
modulated by sun altitude.

### LiDAR shadow consolidation

When `shadows-enabled` is true AND a LiDAR provider covers the home,
the engine resolves the matching `LidarSource` via
`findLidarSource(lat, lon)` and calls its `fetchShadowRegions()` with
the home position, the building visibility radius and a raster size
driven by `lidar-precision` (256² / 512² / 1024²).

Each provider does one (France: BIL float32 from IGN's
`IGNF_LIDAR-HD_MNH_*` WMS) or two (UK / NL / NO: GeoTIFF DSM minus
DTM; Spain: vegetation MDSn merged with buildings MDSn via MAX)
upstream fetches, decodes them client-side and hands a single
height raster to the shared post-processing pipeline. Then:

- **Filter.** Cells with `5 ≤ h ≤ 100 m` pass the height threshold.
  Cells beyond `radiusMeters` haversine from the home are dropped
  (circular crop).
- **Flood-fill with size cap.** 8-connected BFS, but each component
  stops growing once it reaches `TARGET_COMPONENT_AREA_M2 / cellArea`
  cells (~80 m² physical). When the cap hits, leftover neighbours
  are picked up by the outer scan loop as fresh seeds, so a dense
  forest decomposes into many small clumps instead of one giant
  region. The cell cap is recomputed per precision from the actual
  pixel pitch so the physical clump size stays consistent.
- **Convex hull per clump.** For each clump, take the convex hull of
  the cells' four corners and emit one Polygon with `render_height
  = mean(clump cells)`. The hull is an irregular, non-axis-aligned
  polygon, so cast shadows from many overlapping clumps alpha-
  composite into a continuous dappled pattern instead of looking
  like a grid-aligned tile mosaic. Single-cell or near-single-cell
  components (< `MIN_COMPONENT_CELLS`) are dropped so noise from
  the height threshold doesn't render as speckled dots.

Polygon count: typically a few hundred to a few thousand clumps per
fetch, scaling with the wooded area covered rather than the raster
resolution.

Those polygons feed `projectExtrusionShadows` exactly like the
OpenFreeMap building footprints do when no provider covers the
home. The result is then clipped to the building visibility disc
(see Shadow clipping below).

### Shadow clipping

`projectExtrusionShadows` accepts optional `clipCenterLat`,
`clipCenterLon`, `clipRadiusMeters`. When provided, it builds a
64-vertex CCW polygon approximating the disc and runs
Sutherland-Hodgman against each emitted shadow polygon. The shadow
trail of a tall region near the edge of the visibility radius
(which would extend hundreds of metres past the buildings) gets
clipped to the same circle as the rendered surroundings.

---

## Configuration

```yaml
type: custom:helios-card
```

No keys, no signup. The basemap comes from OpenFreeMap (free vector
tiles) and weather from Open-Meteo (free, no key). See the full
option table in [README.md](./README.md). Every field is editable
visually; numeric options are sliders so out-of-range values can't
be entered.

---

## Diagnostics

The bundle exposes a single global command for in-browser debugging:

```js
window.heliosStats()
```

Runs against every `<helios-card>` currently mounted on the page and
returns a JSON-safe snapshot AND prints a grouped console dump. Each
card section contains:

- **config**, the live `setConfig` payload (JSON-safe and OK to
  paste publicly, no API keys are ever stored).
- **engine**, the engine's own snapshot: home lat/lon, resolved
  LiDAR provider (or `null` when out of coverage), shadow source
  (`disabled` / `lidar` / `openfreemap` / `pending`), shadow
  opacity and LiDAR clump count, building footprints count,
  weather samples, active timeline range, cache state for the
  per-day sun arc and the last shadow signature.

A `lifecycle` block aggregates module-level counters maintained by
the engine (`window.__heliosStats`): engines created vs cleaned up,
WebGL context-lost events, building fetches fired, etc. Useful for
diagnosing leaks across editor previews and reloads.

`heliosStats()` does not mutate any state; it can be invoked from
the user's console at any time.

Two companion helpers let developers reproduce visual issues on a
different home location without touching HA's config:

```js
setHeliosLocation(lat, lon)   // override home for every live card
clearHeliosLocation()         // revert to hass.config
```

The override lives on `window.__heliosLocationOverride` only; a page
refresh always restores HA's home. PV calibration cache buckets are
keyed by `lat.toFixed(3)_lon.toFixed(3)` in both `localStorage` and
HA's `frontend/user_data`, so each location owns its own bucket and
the user's original cache is recovered untouched on return.

---

## Build & publish

```bash
npm install
npm run typecheck       # strict TS
npm run build           # produces dist/helios.js
```

To publish a release:

1. Make sure `dist/helios.js` is committed (HACS needs the prebuilt
   bundle).
2. Tag the commit and push:
   ```bash
   git tag v1.5.0
   git push origin v1.5.0
   ```
3. Create a GitHub Release (HACS needs a Release, not just a tag).
   The `release.yml` workflow rebuilds `dist/helios.js` from the
   tagged commit and attaches it to the release.

---

## Known limitations

* **Equatorial azimuth**, peak ~9° error near the equator at the
  solstices because of the simplified declination formula.
  Acceptable for the visual hillshade direction; if higher precision
  is ever needed, swap in a NOAA-SPA implementation.
* **OpenFreeMap availability**, the basemap, glyphs, sprites and
  building tiles all come from OpenFreeMap's public CDN. There's no
  per-user rate limit, but the project is run by a single
  organisation; if their CDN goes down, the basemap stops loading
  for everyone. No commercial SLA is offered. Since v1.5.0 this is
  the only third-party hard dependency for the map to render.
* **LiDAR coverage**, five providers integrated today (France IGN
  HD, England Defra, Spain IGN, Netherlands PDOK, Norway
  Kartverket). Out-of-coverage homes fall back to
  OpenFreeMap building footprints (buildings only, no vegetation),
  so the visual works worldwide but trees / hedges only cast
  shadows in covered countries. Additional providers are on the
  roadmap as national open-data APIs become available with a
  CORS-friendly raw raster endpoint.
* **WebGL contexts on long-lived dashboards**, browsers cap
  concurrent WebGL contexts at 8–16. Helios releases its context
  cleanly on every re-init via `WEBGL_lose_context`, but if you
  stack many MapLibre-backed cards in the same dashboard you may
  hit the limit; the browser will then recycle aggressively and
  performance can degrade. Use `pixel-ratio: 1x` and
  `map-style: minimal` on such setups.
