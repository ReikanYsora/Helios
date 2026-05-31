# Changelog

All notable changes to HELIOS, grouped by theme rather than strict
added / changed / fixed buckets. Entries below the top one are
preserved from the in-tree history that used to live inside
`ARCHITECTURE.md`.

## Unreleased

### Combined signed grid entity

- New `grid-power-entity` accepts a single signed sensor whose value
  carries the flow direction (Fronius `P_Grid`, Shelly EM, P1 net
  power, …) instead of two separate import / export meters. When it
  is set it owns both chips and supersedes `grid-import-entity` /
  `grid-export-entity`: a non-negative reading lights the IMPORT chip
  (the EXPORT chip hides), a negative reading lights the EXPORT chip,
  so only the active direction shows.
- Works with a power sensor (W / kW / MW, the value IS the signed
  watts) or a signed net-energy sensor (Wh / kWh / MWh whose total
  falls while exporting, the bracketed slope IS the signed watts). A
  list is summed, e.g. three signed per-phase sensors into one net.
  The whole live + scrub derivation rides the existing per-entity
  buffer / recorder-backfill machinery, so multi-tariff and combined
  installs share the same slope path.
- `grid-power-invert` flips the sign convention for meters that
  report grid feed-in as positive (default: positive = import).
- Editor grid section gains a combined-entity picker plus a sign
  toggle; the directional import / export pickers collapse while a
  combined entity is wired.

## v1.8.1

> Point-fix release on top of v1.8.0. v1.8.0 is withdrawn from the
> release timeline, its grid IN / OUT chips were unusable past the
> first six hours of scrub, the day-strip labels were misaligned,
> the sun bead flickered through camera rotations, and the cloud
> dome retirement was not reflected in the docs. v1.8.1 is the
> first build of the cycle that reads as the intended product.

### Grid IN / OUT, full audit + rewrite

- Sample timestamps now come from the entity's `last_updated`
  instead of the wall clock at refresh time, so the slope reflects
  when HA actually observed the value.
- Slope is taken across a bracketed pair of samples whose time
  span is at least 60 s. When the immediate before/after bracket
  sits too close together (5 s pushes on a 1 Wh meter), the
  bracket extends outward until the span clears the noise floor.
  Kills the 1 Wh-quantum-into-720 W-spike pattern.
- Multi-tariff installs (HP / HC) rank by the LAST REAL VALUE
  TRANSITION, not the latest poll, so the entity that actually
  incremented most recently always wins the chip. Live lookback
  10 min covers Linky histo mode (10 min push cadence).
- Recorder backfill window 72 h to match the timeline's visible
  past range. `pickBracket()` returns null when a scrub target
  sits more than 10 min before the buffer's first sample, the
  chip hides cleanly instead of showing a stale constant slope.
- Negative readings clamp to 0 in both live and scrub: a negative
  IMPORT is an EXPORT moment the export chip already reports.
- Bead cadence is now LINEAR in frequency (`dur = MIN * CAP /
  watts`, clamped to `[MIN, MAX]`), so twice the power gives
  twice the speed. Caps tuned to round residential thresholds:
  5 kW import, 1 kW export.

### Day-strip vertical centring + smartphone fit

The date / kWh pair on the bottom strip now shares one baseline
geometry across all four label states (bold today, regular past,
italic forecast, regular non-today). Both spans land on the same
font-size + 18 px line-height, on the HA frontend font stack
(`--mdc-typography-body1-font-family`, `--ha-font-family`,
`--paper-font-common-base_-_font-family`, Roboto fallback). The
strip itself is `box-sizing: border-box` so the inner content
area is exactly 18 px and the line box fills it without leftover
space. Font clamped to 6-9 px so the pair fits the narrower
per-day cells a portrait smartphone produces. Cramped-cell
kWh-hide threshold dropped to 48 px so the last day's forecast
stays visible when the timeline ends mid-day.

### Sun -> PV ray, no more flicker or chip overrun

- The bead was riding on a circle whose `cx` / `cy` plus a
  relative path mutated two attributes per rotation frame; the
  SMIL interpolation jittered between the old and new base.
  Switched to an absolute-path bead with `cx` / `cy` at the
  origin, single-attribute updates keep the animation continuous
  through camera drags.
- The ray + bead lived in the same SVG as the sun disc, whose
  depth split brought the SVG above the PV chip on the sun's
  near half of the sky. Moved the ray + bead to a dedicated SVG
  fixed at z 7, the chip background now always occludes the ray
  endpoint at the chip border. The sun disc keeps its depth
  split so it still passes in front of / behind the home cluster
  depending on bearing.

### Home click zone follows the building shape

The silhouette polygons now receive pointer events themselves,
so a click on any visible part of the focal building opens the
dashboard, regardless of how the 120 px circular hitbox lines
up against the projected centroid. The circular hitbox stays as
a fallback for tiny / distant buildings.

### Dome + LiDAR sliders harmonised

Both pills now share the same min-height, 16 px icons and anchor
rail, and both slide UP from below the card on mode entry and
slide DOWN out of view on mode exit (mirroring the timeline's
own enter / exit). Slider retreat fires immediately on
toggle-off, in parallel with the mode's own fade-out instead of
after it.

### Editor + docs freshness

- Grid section in the visual editor moved between PV and
  Shading, so the energy-producing sources stay grouped.
- README + ARCHITECTURE: the on-ground cloud-cover disc bullet
  is gone (the chip + dome toggle at the top of the card
  replaced it). The Depth-of-field veil bullet is gone (the
  effect is no longer in the rendering pipeline). Grid IN / OUT
  chips added to the "at a glance" feature list, with
  `grid-import-entity` / `grid-export-entity` rows in the config
  table. `cloud-color` description updated to reflect the dome
  bands.
- Project-wide audit pass: em-dashes replaced with commas in
  every source comment, every i18n locale label and the README
  + CHANGELOG. Decorative section dividers removed from
  `engine/buildings.ts`. Dead `shouldShowDomeChip()` helper
  removed from `card/shadingDome.ts`. Unused `PV_LEG_OFFSET_PX`
  constant + its `void` silencer removed from `helios-card.ts`,
  along with a sibling `void batteryCharging;` that was
  silencing a variable the very next line consumes.

### Other

- Cloud-cover curve in the timeline chart bumped from
  `fill-opacity: 0.25` to `0.45` so it stays readable through
  the irradiance fill painted on top.

## v1.8.0

> Accelerated release to address performance regressions reported after
> v1.7.0. Some roadmap items (notably the new LiDAR providers) are
> deferred. Apologies for the delay on those, they remain priority for
> the next cycle. Stabilising the rendering took precedence over
> extending coverage for this one.

### Home Assistant harmonisation

The card now reads the active HA theme directly via
`hass.themes.darkMode` instead of exposing its own toggle. Every chip,
leader, chart and editor control consumes HA design tokens
(`--primary-color`, `--card-background-color`, `--divider-color`,
`--ha-card-border-*`, `--energy-solar-color`,
`--energy-grid-consumption-color`, `--energy-battery-in-color`, etc.).
The card also picks up the HA frontend default border / radius / box-
shadow, so Helios sits visually alongside the other Energy dashboard
cards. Users familiar with the HA Energy dashboard recognise the same
colour vocabulary and chip language, and an HA theme switch now flips
the card automatically.

The legacy `card-theme: light | dark` YAML option is gone. When the
editor opens, retired keys are silently scrubbed from the config.

### Performance and stability

- WebGL "too many active contexts" fix in dashboard edit mode. The
  mount / unmount loop HA triggers during the edit-mode UI animation
  is neutralised (`preview: false`, 1 s first-spawn debounce,
  `isConnected` gates on every deferred spawn path). Engines no
  longer pile up and the browser's WebGL pool stays healthy.
- `LidarViewLayer.setData()` memoised on the raster signature.
  Re-toggling LiDAR view without moving the map short-circuits the
  Mercator double loop and the GPU buffer uploads. ~100-300 ms gain.
- Shading dome animations revised: entry and exit play symmetrically
  with the chip + timeline transitions.
- Home glow refreshed after exiting LiDAR (the projections were
  frozen at the bearing of toggle-on).
- Proportional grid IN / OUT bead animation, tied to the live power
  (cap 10 kW import, 1 kW export, idle below 5 W).
- Dependencies bumped to their latest stable versions (Vite 8,
  TypeScript 6, pbf 5, @mapbox/vector-tile 3, terser 5.48). Bundle
  drops from ~2986 KB to ~2208 KB (-26 %, gzipped -13 %).

### Grid Import / Export

- Multi-tariff support. `grid-import-entity` and `grid-export-entity`
  accept either a string or an array of entities. Typical case: French
  Linky EASF01 (peak hours) + EASF02 (off-peak hours). The visual
  editor exposes an editable list with up to 8 sources per side.
- "Last-changed wins" logic. When several entities are wired, the
  chip displays the watts of whichever entity moved most recently
  (the active tariff).
- Recorder backfill at boot. A 1 h history pull from the HA recorder
  seeds the rolling buffer for each grid entity on first refresh, so
  the slope is meaningful right away even when the live integration
  is silent for minutes (slow-polling Linky TIC, etc.).
- Rolling window 60 min, up to 800 samples per entity.
- No more 0 W seeding. If no derivation has landed yet, the chip
  stays on the last computed value instead of falling back to 0.
- Import / export leaders + beads driven by the live power.

### Home hub and leaders

- Solid drop-leader between the home pill and the projected ground
  at the 3D building, painted in HA primary colour. The home cluster
  is lifted a notch to leave the leader visible.
- Permanent home glow (opacity 0.25 at rest) bumping to 0.85 with a
  thicker drop-shadow on hover.
- Larger home hitbox (120 px, z-index 55) so click / hover lands on
  the home even when chips or leaders sit under the pointer.
- Sun ray bead. The sun → PV chip ray now carries a circular bead
  instead of an arrow, speed tied to the live irradiance.
- Battery + grid leaders use a quadratic fillet on the L-shape to
  match the cloud-layer leaders.

### Cloud cover

- The fourth mode-bar button is gone. The central cloud chip itself
  toggles 3 per-layer sub-chips (low / mid / high) with a cascade
  fade-in animation.
- Three L-leaders connect the toggle to the sub-chips, converging on
  a central junction with a vertical trunk.
- Auto-OFF when switching to LiDAR or Shading mode so the sub-chips
  don't leak into the active layer.

### Timeline and clock chip

- Top-left date / time chip pulled up to z-index 1000, no longer
  crossed by the solar arc nor by the dome overlays.
- Mobile day-strip: tighter gap / padding / font clamps. The kWh
  annotation hides below 90 px cell width.
- Night hatches and day separators alpha bumped to stay legible in
  dark mode.
- Hover tooltip uses a 12 px border-radius matching the chip language.
- Theme-aware prediction colour: darker on light theme, lighter on
  dark theme.
- Timeline slides in / out from below (translateY 140 %) when
  returning to the default view.

### LiDAR mesh

- Loading feedback. Until the exposure compute lands, only the points
  and the wireframe paint in pure white. Colour-filled triangles
  appear once the exposure is ready.
- Spinner on the LiDAR mode-bar button during compute, with the other
  two mode buttons disabled to prevent state races.
- Shader shadow floor bumped (0.25 → 0.55) so the mesh stays legible
  at night when every cell is in shadow.

### Solar arc and irradiance chip

- Depth-split rendering. The half of the arc closer to the camera
  paints over the chips (z 11), the half further out paints behind
  (z 5). The sun disc follows the same rule.
- The W/m² label sits at z 13 above the front arc so it never gets
  crossed.

### PV string markers removed

The icon + leader + sphere that marked each PV string position is
removed. Backing code, CSS and engine projections are gone too
(~5 KB bundle savings).

### HA Energy auto-detect removed

The fallback that pulled entities from the HA Energy dashboard is
removed for PV, battery and grid. Resolution is now entirely driven
by the explicit YAML keys. Diagnosing a chip at 0 W is much simpler:
if the chip is silent, the configured entity is the one responsible,
no opaque fallback shadowing the source.

### Diagnostics and hygiene

- Every runtime `console.info` / `console.log` debug call is gone.
  The console stays silent in steady state, only genuine warnings
  (context lost, fetch failed) remain.
- Engine cleanup drops `_lidarViewLayer` + `_lidarRaster` explicitly
  after `map.remove()` so dead GL handles don't get pinned across
  editor respawns.

### i18n

- 9 new grid keys translated across every supported locale (EN, FR,
  DE, ES, IT, NL, PT, NO, PL, CS, SV).

## v1.7.0

Headline release on top of v1.6.4. Thirty-five alpha iterations + three
betas, condensed below. The deliberate scope choice for this cycle was
"refine the prediction rather than add more providers", so the LiDAR
provider count is unchanged (10) and the energy went into the live
irradiance overlay, the adaptive shading map, multi-battery support and
the polish pass on the dashboard + layer transitions. Users in
uncovered regions can prepare their own raster via
[helios-lidar.org](https://helios-lidar.org).

### Live LiDAR irradiance overlay

The LiDAR-View overlay now paints every loaded raster cell as a
wireframe + filled triangles, shaded in real time by a per-cell
raymarch from each cell toward the sun against the loaded nDSM.
Lit cells glow warm (warm-tinted at the irradiance peak), shadowed
cells dim out. The compute runs in 32-row chunks per
requestAnimationFrame tick so the main thread stays responsive while
the irradiance map fills in row-by-row, no freeze even on
high-precision rasters. Toggled from the three-segment top-right
mode bar (Layer / LiDAR / Dome); a bottom-of-card slider tunes the
overlay opacity live. The five previous per-element visual config
keys (`lidar-view-point-color` / `-point-opacity` /
`-wireframe` / `-wireframe-color` / `-wireframe-opacity`) collapsed
into that single slider; the legacy keys are silently stripped on
first edit. Only `lidar-view-point-size` remains tunable from the
editor.

### Adaptive shading map

A second learning layer sits on top of the 5-day calibration: each
cell of a polar grid (sun azimuth × sun altitude × cloud-cover bin)
holds the average actual / predicted ratio observed at that
combination. The forecast then bends at the right time of day for
tree shadows, neighbouring roofs and other obstacles the LiDAR
didn't capture. Visualisable from the editor as a hemispheric "dome"
overlay (Shadows segment of the mode bar), with stats and per-bin
import / export / reset. Builds up from the user's own data over a
few weeks; until then the scalar calibration carries the load.

### Multi-battery banks

New `batteries:` config array declares any number of physical
battery banks side-by-side (house + garage + standalone hybrid,
mixed-vendor BMS, etc.). The chip on the card stays single,
aggregating the banks as a capacity-weighted SoC + summed signed
power. Each bank carries its own `power-invert` flag (per-vendor
sign convention) and an optional `capacity-kwh` weight. Editor UI
mirrors the multi-array PV pattern (add / remove rows, individual
collapsible cards). Legacy flat `battery-soc-entity` /
`battery-power-entity` / `battery-power-invert` keys keep working:
they are wrapped as a single-bank list under the hood and stripped
on the first edit via the new editor UI. Mixed-vendor power
readings (one bank in W, another in kW) are normalised to watts
before being summed so the aggregate is coherent.

### Inverter cutoff guard

New `inverter-cutoff-soc-pct` config gates the shading-map trainer:
when the user's hybrid inverter clamps PV output once the battery
reaches its set ceiling, every observation bucket where every bank
reached the cutoff is skipped, so the inverter-blocked production
doesn't train as phantom shadow at the matching sun position.
Per-bucket min-SoC across banks is the gate signal, so a half-full
sibling bank correctly trains the bucket while one full bank does
not block it. Logs a console warning when the cutoff is armed but
no bank exposes a SoC entity (silent-guard misconfig).

### Dashboard counter-up

Headline kWh figures on the dashboard (produced, forecast, refined)
now tick up from 0 to their real value with a 700 ms cubic ease-out
the moment the user opens detail mode. Delta % and peak time stay
anchored on the real values so they don't sweep through nonsense
intermediate numbers.

### Depth-of-field veil

Permanent across modes, ultra-subtle (0.6 px backdrop blur) shaped
by a radial mask centred on the home's current screen position.
Fully transparent inside the inner disc (no blur at the focal
point), full blur at the edges. Sits between the basemap and the
chips so the UI stays crisp regardless. Subliminal on its own,
gives the card a gentle peripheral out-of-focus feel that mimics
DoF at distance.

### About section in the editor

New collapsible section pinned at the very bottom of the visual
editor, carries: the running version (inlined at build time from
package.json), a pointer at the companion site
[helios-lidar.org](https://helios-lidar.org), the two source-code
repos (Helios + Helios-Lidar) with GitHub icons, and a short
appreciation paragraph + Buy Me A Coffee link styled in the BMC
yellow. Translated into all 11 locales.

### Memory hygiene + correctness pass

A round of audits before the final tag closed:

* Four memory leaks identified across the engine lifecycle, the
  chunked exposure loop pinning the dead engine after rapid config
  edits, the LiDAR-View custom layer leaking its 4 GPU buffers +
  shader program on iOS Safari, the editor's reset-feedback timer
  firing on dead elements, and the styleimagemissing handler
  surviving past cleanup as an anonymous lambda. All four closed,
  so the "must refresh after several edits" symptom is gone.
* DTM no-data gap in `pv-shading.ts` now falls back to flat-ground
  at the offending step instead of skipping the obstacle entirely,
  fixed in both `isPanelShaded` and `computeLidarCellExposureRows`,
  was under-detecting shading on panels near LiDAR coverage edges.
* LiDAR exposure raster-swap race fixed (size guard in setExposure
  + raster-identity check in the chunked tick + stale-sun
  re-check), no more one-frame ghosting on precision change or
  view locked 30 s behind the cursor during a rapid timeline scrub.
* Calibration day-boundary no longer over-counts ~1 h of the
  previous evening into the new day on sparse cumulative-energy
  sensors (both samples of a delta pair must fall inside the day).
* Multi-bank power aggregation normalises to watts before summing
  (mixed-vendor W + kW installs were producing nonsense before).

### Editor polish

* Battery banks AND PV arrays are now fully wipeable from the
  visual editor: removing the last row drops the `batteries:` or
  `pv-arrays:` key entirely, so the chip / forecast cleanly falls
  back to "not configured". Empty arrays are honoured on re-read so
  the section shows just an "+ Add" button.
* Chip fade-in / fade-out across mode toggles got a
  `will-change: opacity` hint, the CSS rules were already correct
  in both directions but the browser dropped frames on chips
  inside transform-less wrappers (time-bar, solar-svg) under load,
  producing intermittent "sometimes works, sometimes doesn't"
  behaviour. Now bulletproof, GPU-composited.

### Locales

Three new locales added: Czech, Polish, Swedish. Total: 11
(cs, de, en, es, fr, it, nl, no, pl, pt, sv). Every new key
introduced this cycle (multi-battery editor + About section +
LiDAR-View hint rewrite) was translated natively into all 11.

### Repo split

The Python preparation toolchain (raw LAZ / LAS → 2-band COG that
the companion site uses server-side) moved out of this repo into
its own [Helios-Lidar](https://github.com/ReikanYsora/Helios-Lidar)
repository. Card-side and pipeline-side concerns are now in two
separate repos kept loosely coupled by the documented COG output
format. The local `tools/` and `data/` directories have been
removed from this tree accordingly.

### License

Switched from MIT to GPL-3.0-or-later. LICENSE file ships the
canonical GPL-3.0 text prepended with the project's copyright
notice; README badge + footer + package.json `license` field
all updated.

## v1.6.4

Point release on top of v1.6.3 with one behavioural change.

### Heartbeat ping removed

The anonymous install heartbeat introduced in v1.6.3 (a once-per-
day POST of a random UUIDv4 to helios-lidar.org) is gone. The
card no longer emits any beacon, and the `helios-anon-stats`
config key is no longer read. Anyone setting it explicitly to
`false` can leave the line in their YAML (it's now a no-op) or
remove it.

Install analytics are now derived from public GitHub Releases
download counts on the helios-lidar.org landing page, which keeps
the same informational value without a client-side ping.

## v1.6.3

Headline release on top of v1.6.2. Sixteen beta iterations
condensed below. The big themes :

### Terrain-aware LiDAR shading

The pre-1.6.3 ray-march in `pv-shading.ts` assumed flat ground at
every cell of the nDSM, which under- or over-counted shading by
the slope between the panel and a far obstacle on any non-flat
install. The companion pipeline at [helios-lidar.org](https://helios-lidar.org)
now ships a 2-band COG (band 1 = nDSM, band 2 = DTM) and the
card lifts both into absolute Z anchored at the panel's local
ground, so a 5 m building 50 m east on terrain that rises 8 m
correctly reads as a 13 m obstacle (and a 5 m building on
terrain that drops 8 m correctly reads as -3 m, i.e. below the
panel and invisible to the sun). Legacy single-band rasters
(public providers + pre-v1.6.3 local COGs) fall back to the
flat-ground geometry transparently, no breakage.

US-foot LAZ files (a common hurdle for North American users)
also got fixed in the pipeline: the source CRS gets reprojected
to the nearest UTM zone in metres before rasterisation, so
6 ftUS-pitch panels no longer end up encoded as 6 m and skew
the shading.

### PV configuration : per-string kWp + inverter PMax

`pv-arrays[].peak-kwp` replaces the abstract `share` field for
multi-string installs. Each row carries its real nameplate;
total install power is the sum, no more "60/40 with 5 kWp total"
shorthand. New top-level `pv-inverter-max-kw` clips the forecast
at the inverter's nameplate so an oversized DC array (typical
European 6.4 kWp behind a 5 kW inverter) doesn't show a peak
above what the hardware delivers. Editor + 8 locales updated.
Legacy share-based configs keep working unchanged.

### 5-day rolling forecast calibration, now everywhere

The dashboard already nudged its "refined" headline by the
5-day actual / model ratio; v1.6.3 propagates the same `cal.ratio`
to the dotted forecast curve, the per-day kWh chips on the
timeline strip, the hover tooltip's PV value, AND the live PV
chip when scrubbing into the future. All four readouts now
agree at any scrub instant.

### Timeline overhaul

* **Hover tooltip** on both chart cards (irradiance / cloud + PV).
  Pointer-move draws a vertical guide line + colour-coded dots
  (mdi:white-balance-sunny, mdi:cloud-outline, mdi:flash) at the
  cursor position. PV row skipped silently when no entity is
  configured. Works on mobile too: a touch drag updates the
  tooltip the same way as desktop hover.
* **Night zones** as diagonal-hatch overlays from sunset[N] to
  sunrise[N+1] on both chart cards, with dotted vertical day /
  night boundary lines. Same hatch + boundary on the dashboard's
  today chart for one unified visual vocabulary.
* **Future-mask wash** anchored at "now" so the forecast portion
  of every curve + the night-zone hatch fades together. Past
  reads punchy; forecast reads as forecast.
* **Day-strip** below the cards: one bordered bar with dotted
  midnight separators and per-day kWh totals; the cells size their
  text via container queries so a 4-day mobile view doesn't
  smash the date + kWh together.
* **Balanced chart heights** (48 px each) so PV no longer looks
  like a sparkline below the irradiance / cloud card.
* **Cursor weights bumped** to read through the future wash.
  Negative PV readings (net-meter dawn / dusk noise) clamp at 0
  in the tooltip + the live chip + the dashboard headline.

### Camera : pitch on vertical drag

Vertical drag on the canvas tilts the camera; horizontal drag
keeps the existing bearing rotation. Pitch clamped to
[15°, 85°], so the user can dive almost top-down or peek almost
flat against the ground without ever passing through it.
Two-finger pinch-rotate stays with MapLibre's built-in handler.

### PV home-anchor as a perspective ground ring

The single screen-space disc at the home gets replaced by a
2.5 m stroked ring projected through the map's camera matrices.
Lies flat on the ground around the home, aplated by pitch and
rotated by bearing. The back arc of the ring is masked by the
home silhouette (same polygons the home-glow uses), so the
building visually sits inside the ring. Pulse animation rides
through the bead arrival cycle.

### LiDAR cast-shadow quality

The cluster cap dropped from 400 cells to 80 (~16 m² target
area) so convex hulls trace L-roofs and zigzagging tree rows
much closer to their real outline; the shadow raster size is
tied to the existing `lidar-precision` knob (low / medium =
1024 px, high = 2048 px) so the median user pays no extra
mobile cost and power-users opt in to the sharper edges. Shadow
recompute is also coalesced into a 100 ms debounce during
timeline scrub, so dragging the cursor at high precision no
longer feels glued.

### Smaller polish that ships in 1.6.3 too

* **LiDAR chip cluster** redesigned as a row-reverse pair (chip
  on the left, mode toggle on the right), both clickable, with
  three coverage states (no provider / online / local) and the
  active-on theme matching the scrub clock on the opposite
  corner. Chip text comes from the `lidarViewChipLabel` i18n
  key ("Vue LiDAR" / "LiDAR view" / ...).
* **Forecast curves at 0.7 px stroke** (was 1.4 px) so dense
  variation reads as a hairline trace instead of a smudged band.
* **PV predicted icon in the timeline tooltip** uses the lighter
  `lerpHexToward(pvColor, '#ffffff', 0.55)` tint, matching the
  dashboard's dotted forecast convention.
* **Dashboard tomorrow card calibration tooltip** can finally
  paint above the battery card (`:has()` selector lifts the
  hovered card to a higher z-index).
* **Editor BYO LiDAR hint** rewritten to lead with
  helios-lidar.org (the easy path) and mention the local
  `tools/lidar/` helpers as the fallback. Now renders the
  inline `[text](url)` syntax as real `<a>` anchors via a
  scheme-restricted markdown-link helper.
* **Sunrise / sunset arc icons removed** ; the arc shape on the
  3D map already signals them and the icons piled up visually
  against the LiDAR shadow blobs on the horizon. Replaced by
  diagonal night-zone hatching on the dashboard chart for the
  same indication on the 2D charts.
* **Neighbour-building outlines** dropped (visual noise on dense
  streets); the home outline stays.
* **Day-strip date font** bumped (`clamp(9px, 11cqw, 13px)`) and
  the cells use container queries so the layout adapts to any
  card width.
* **Detail-panel `.dash-card` entry animation** ends on
  `transform: none` so the stacking context releases after the
  fade-in and tooltips can paint above sibling cards.
* **HACS repo description** refreshed to match what the card
  actually does in 1.6.x.

---

## v1.6.2

Precision release on top of v1.6.1: two upgrades to the PV
prediction model and one UI cleanup on the LiDAR-View toggle. No
breaking changes, every existing config keeps working unchanged.

### PV thermal derating

The PV forecast now accounts for the cell temperature climb under
sun and the convective cooling under wind, using the classic
Sandia / NOCT pipeline:

* The Open-Meteo fetch now pulls `temperature_2m` + `wind_speed_10m`
  alongside the existing cloud + shortwave variables.
* Cell temperature is estimated with `T_cell = T_air + (NOCT − 20) /
  800 W/m² × GHI − 1.5 × wind`, then the output is derated by
  `1 + γ_pmp × (T_cell − 25)` with γ_pmp = −0.0040 /°C (the typical
  monocrystalline silicon coefficient).
* Plumbed through every PV computation site: live chip, scrub
  preview, dashboard "today" / "tomorrow" graphs, forecast
  calibration. On a hot summer noon at 35 °C ambient and ~900 W/m²
  the derating reduces the predicted peak by ~13 %, which is the
  bulk of the model bias the rolling calibration ratio was
  previously absorbing as a flat multiplier.
* Falls back cleanly when the model didn't return temperature or
  wind: multiplier stays at 1 and the forecast reduces bit-for-bit
  to the previous Haurwitz + Liu-Jordan output.

### LiDAR-aware shading on the PV forecast

When a LiDAR provider covers the home (or a BYO local-nDSM raster
is configured), the PV forecast ray-marches from each PV array
along the sun direction and zeroes the direct-beam component on
arrays whose line-of-sight to the sun is blocked by a building or
tree. The diffuse + ground-reflected components are kept (an
obstacle blocks the sun ray but not the upper hemisphere of sky),
so a shaded panel doesn't drop to zero, just to the ~25-30 % of
clear-sky output the diffuse + reflected terms contribute.

* New `height` field per entry in `pv-arrays` (metres above ground,
  default 5). Used as the ray's starting altitude so a panel on a
  first-floor roof clears a low fence the same-orientation
  ground-mounted array would sit in the shadow of.
* Bilinear sample of the loaded nDSM, 2 m step, 200 m max reach.
  Same buffer the LiDAR View overlay paints, no extra fetch.
* For installs with `pv-arrays` declared at distinct coordinates,
  each entry is shaded independently. So a roof-east array can be
  shaded by a tall neighbour at 8 am while the roof-west array on
  the same property is fully lit.
* Skipped silently when no LiDAR raster is loaded (no providers
  match the home, no BYO nDSM configured), so installs outside
  LiDAR coverage continue to produce the legacy forecast.

### LiDAR-View toggle visual cleanup

The toggle chip on the top-right rail now mirrors the date chip on
the opposite rail exactly: 12 px Roboto 600, line-height 1.2,
padding 2 px 8 px, 22 px tall, mixed-case `LiDAR` label. The 1.6.1
chip used 11 px uppercase Roboto with `line-height: 1`, which left
zero slack for the font's natural cap-height asymmetry; the visible
glyph centre drifted up or down against the icon depending on the
browser (Chromium, Firefox and WebKit each shifted it by a
different fraction of a px). The new recipe centres consistently
across every engine, the same way the date chip has always done.

### Notes for users

The new fields are opt-in but the temperature derating activates
automatically as soon as v1.6.2 is installed, since the weather
fetch starts pulling temperature + wind without any config change.
Expect the forecast to read **a few percent lower** at the midday
peak on hot clear days and a few percent higher on cold clear
winter days; the self-calibration ratio will absorb the residual
within a few sunny days.

For LiDAR-aware shading to kick in, the home needs to be inside a
LiDAR provider's coverage (one of the 10 native providers shipped
with the card, or a BYO local-nDSM via the `lidar-local-ndsm-*`
keys). Outside coverage, the forecast falls back to the existing
geometry-only model.

The companion site [helios-lidar.org](https://helios-lidar.org) is
also bumped to 1.6.2 in lock-step.

---

## v1.6.1

Hotfix on top of v1.6.0 addressing two visible bugs surfaced by
community feedback on the Reddit launch thread. Scope deliberately
kept tight; LiDAR coverage expansion and other feature work moves
to v1.7.

### Fixes

* **Refined-forecast tooltip clipping** ,
  [#16](https://github.com/ReikanYsora/Helios/issues/16). The
  hover explanation behind the "→ X kWh affiné" chip on the
  AUJOURD'HUI and DEMAIN dashboard cards used the same horizontal
  anchor on both layouts, which only fit the AUJOURD'HUI
  two-column headline. The DEMAIN headline is a single
  left-aligned column, so the chip sits on the left and the
  tooltip extended past the card's left edge into ha-card's
  overflow clip. Each card now anchors its tooltip on the side
  opposite the chip so it grows into the card interior:
  `.dash-card.dash-today .dash-stat-refined::after { right: 0 }`
  and `.dash-card.dash-tomorrow .dash-stat-refined::after { left:
  0 }`.
* **Black-map after location change on Firefox**, when the user
  switches `home-latitude` / `home-longitude` in the editor
  preview on Firefox, the previous MapLibre engine's WebGL
  context wasn't fully released by the time the next engine tried
  to bind one, yielding a black canvas. Engine init now waits one
  animation frame between cleanup and new MapLibre allocation
  when there was a previous engine, giving Firefox time to
  release the context. No effect on Chrome (the extra 16 ms sits
  inside the existing 500 ms editor debounce).

## v1.6.0

The biggest iteration since the OpenFreeMap migration. Three
headline tracks: a GPU-resident LiDAR View overlay, a complete
dashboard rework with a learning forecast, and a card-wide
architecture split that broke the two ~5k-line monoliths into
focused subsystem modules. Plus per-array PV configuration (with
optional GPS), a reset cache control, a new German LiDAR provider,
external solar-radiation sensor input, and a long list of editor
polish.

### Highlights

* **Forecast calibration**. The dashboard learns from the last 5
  completed days how the model under- or over-predicts your
  installation and surfaces a refined value beside each PRÉVU
  figure with a hover hint that spells out the calibration window
  ("→ 18.2 kWh refined (-8 %)"). Window clamps the multiplier to
  ±50 %, falls back silently when fewer than 2 past days carry
  enough production to derive a stable ratio, and never publishes
  anything until the historical fetch has landed.
* **Dashboard rework**. The detail-mode panel is rebuilt around
  three responsive sections: Today (produced + refined forecast +
  dual peak readouts + cumulative chart with sunrise / sunset
  markers + live now cursor + smart-positioned hover tooltip),
  Tomorrow (full-day forecast + peak hour, side by side with
  Battery when configured, full width otherwise) and Battery
  (vessel + charge / discharge totals). Date chips next to
  AUJOURD'HUI / DEMAIN confirm the two pure-forecast cards cover
  different days.
* **LiDAR View overlay**. A WebGL custom layer paints every loaded
  LiDAR cell as a small dot in screen space, optionally with a
  wireframe overlay. GPU-resident, re-rasterised by MapLibre on
  every transform with no JS-side redraw, so panning and rotating
  through a dense forest stay smooth. Distance fade, theme-aware
  colours, configurable display radius, soft enter / exit
  transitions with a scanner pulse on activation.
* **Architecture refactor**. `helios-card.ts` (5218 lines) and
  `helios-engine.ts` (4437 lines) were split into focused modules
  under `src/card/` and `src/engine/`, each owning one piece of
  functionality (data fetch, render, input, util, lifecycle on the
  card side; physics, geometry, animation, layer on the engine
  side). The two top-level files now act as orchestrators that
  delegate to their subsystems through small structural host
  interfaces. Lit reactivity stays natural, no service classes, no
  mixin gymnastics, no `requestUpdate()` ceremony.

### PV configuration

* **Per-array GPS coordinates**. Each entry in `pv-arrays` accepts
  optional `latitude` / `longitude` fields. When set and different
  from the home (> 10 m), the forecast model runs at the panel's
  true coordinates and a small solar-panel icon in the configured
  PV colour appears on the map at that position. Useful for ground-
  mounted arrays in a clearing while the home itself sits under
  trees.
* **Multi-orientation PV layout** (`pv-arrays`). One YAML entry per
  group of co-oriented panels (`tilt`, `azimuth`, `share`).
  Forecast model evaluates each entry separately and weights by its
  share, so split-array installs (east + west rows, roof + balcony,
  three-pitch roofs) get a correct prediction instead of the
  single-orientation approximation. Shares auto-normalise so 50/50,
  60/60 and 1/1 all produce the same forecast. Visual editor
  exposes a repeatable section with `+ Add row` / `Remove` and
  renameable rows; legacy `pv-tilt` / `pv-azimuth` keep working
  unchanged. Closes [#8](https://github.com/ReikanYsora/Helios/issues/8),
  contributed by [@i6media](https://github.com/i6media) in
  [PR #10](https://github.com/ReikanYsora/Helios/pull/10).
* **Battery power sign toggle**. New `battery-power-invert` config
  option multiplies live + historical battery power by -1 before
  storage, so installs where the upstream entity reports charging
  as negative (some GivEnergy / GivTCP setups) align with Helios's
  internal "positive = charging" convention without a template
  sensor in front.

### LiDAR

* **Germany (NRW) provider**. Geobasis NRW publishes a pre-computed
  nDOM raster via WCS GeoTIFF, covering Nordrhein-Westfalen
  (~18M people). Single fetch, routes through the same shared
  pipeline as every other provider.
* **Poland (GUGiK NMPT) provider**. National pre-computed DSM via
  WCS 2.0.1, GeoTIFF Float32, EPSG:4326 natively supported (no
  reprojection round-trip). ~38M people. Single fetch.
* **Canada (NRCan HRDEM Mosaic) provider**. National DSM coverage
  via GeoServer WCS 1.1.1. 1-2 m LiDAR-derived in the populated
  south, satellite-derived further north. ~38M people. Single
  fetch.
* **Austria, Styria (Steiermark) provider**. Two-fetch DSM-DTM
  subtraction from the Land Steiermark ALS Höhen-
  / Geländeinformation WCS services. ~1.2M people. First
  Austrian Land integrated, opens the door to the eight others.
* **Austria, Tirol (Tyrol) provider**. Two-fetch DSM-DTM
  subtraction from the Land Tirol terrain WCS (DGM + DOM 5 m).
  ~760K people.
* **Germany, Brandenburg + Berlin provider**. LGB bDOM + DGM
  1 m WCS, two fetches subtracted client-side. Single integration
  covers both Lands (Brandenburg ~2.5M + Berlin ~3.6M = ~6.1M
  people).
* **Germany, Baden-Württemberg provider**. LGL INSPIRE DOM5 +
  DGM1 WCS, two fetches subtracted client-side. ~11.3M people,
  Germany's third most populous Land.
* **United States, Vermont provider**. VCGI statewide
  pre-normalised nDSM via ArcGIS Image Server exportImage,
  single-fetch Float32 GeoTIFF, no DSM-DTM round-trip. ~645K
  people. First US-state native provider in Helios.
* **Worldwide LiDAR provider registry**. New
  [`LIDAR_PROVIDERS.html`](./LIDAR_PROVIDERS.html) lists every
  public elevation / LiDAR source inspected (integrated,
  verified compatible but pending, partially compatible,
  incompatible) with status, endpoint, curl-verified example fetch
  URL ready to paste in a browser, and an inline SVG world map
  overlaying the integrated providers' coverage bboxes.
* **BYO local nDSM provider**. New `lidar-local-ndsm-*` config
  family lets users in regions without a built-in provider host
  their own height-above-ground GeoTIFF and have Helios use it as
  the shadow source inside a user-defined bounding box. Takes
  precedence over public providers inside the bbox; outside the
  bbox, the regular fallback chain (public → footprints) applies
  unchanged. Closes [#5](https://github.com/ReikanYsora/Helios/issues/5),
  contributed by [@jourdant](https://github.com/jourdant) in
  [PR #5](https://github.com/ReikanYsora/Helios/pull/5), original
  idea credited to [@stephenwq](https://github.com/stephenwq).
* **LiDAR prep tools**. A `tools/lidar/` Python toolchain walks
  through the last stages of nDSM preparation: inspect a GeoTIFF,
  convert to a Cloud Optimized GeoTIFF for efficient browser
  streaming, generate a synthetic test raster. Detailed guide and
  `uv` setup in [`tools/lidar/README.md`](tools/lidar/README.md).
  Closes [#11](https://github.com/ReikanYsora/Helios/issues/11),
  contributed by [@jourdant](https://github.com/jourdant) in
  [PR #11](https://github.com/ReikanYsora/Helios/pull/11).
* **LiDAR View overlay**. Detailed under Highlights above. Editor
  promotion to its own section, native-pitch raster + per-view
  radius filter, ~30-50× perf win on the hot loop, theme-aware
  colours, distance fade, soft enter / exit transitions, scanner
  pulse on activation, debug overlay for diagnostics.
* **LiDAR View display radius**. Decoupled from `building-radius`
  so the dot cloud can extend past the visible buildings (the
  trees that cast the surrounding shadows often sit beyond the
  building disc).

### Home Assistant integration

* **External solar-radiation sensor input**. New optional
  `solar-radiation-entity` config pulls live + historical W/m²
  from a configured sensor and pushes them to the engine, so the
  irradiance display + chart prefer the physical sensor over the
  Open-Meteo model for live and past timestamps. Future
  timestamps still come from the model. Closes
  [#1](https://github.com/ReikanYsora/Helios/issues/1).
* **`home-latitude` / `home-longitude` override**. Optional
  per-card coordinates that win over `hass.config.latitude` /
  `longitude` when both parse as valid coords. Useful for shared
  HA installs, holiday / parents' homes, mobile setups, multiple
  cards on one dashboard each visualising a different place, or
  privacy-conscious users who leave `hass.config` blank.
  Contributed by [@i6media](https://github.com/i6media) in
  [PR #9](https://github.com/ReikanYsora/Helios/pull/9).
* **Card height floor**. Adds a minimum height so the card still
  reads correctly inside layouts that don't constrain its
  vertical footprint (sections view at small row counts, masonry
  with rigid columns).

### Editor

* **Reset data cache button**. New "Reset" section at the bottom
  of the editor. Wipes the cached Open-Meteo payload and the
  in-memory PV history for every Helios card open on the page,
  forcing a fresh fetch. Useful for a stuck calibration or a
  stale weather payload. HA data is never touched. Destructive
  warning above the button explains exactly what gets cleared
  and what doesn't.
* **Live editor preview**. Editor opens a live preview of the
  card so config edits show their effect before the dashboard
  reload. Engine bootstrap debounced 500 ms so quick editor
  churn doesn't burn WebGL contexts.
* **Renameable PV rows**. Each `pv-arrays` entry takes an
  optional `name`; the editor's repeatable section uses it as
  the card title, falling back to "Row N" otherwise.
* **Accordion editor**. Every section collapsible, the editor
  remembers which one is open, and only one expands at a time so
  the configuration panel stays compact.
* **Editor section reorg**. LiDAR View promoted to its own
  section. Map / UI / Buildings / Shadows / Local LiDAR groups
  rearranged for a natural top-to-bottom flow.
* **Editor vertical rhythm**. Spacing between labels, hints and
  fields tuned across the whole editor so each section reads as
  a calm vertical strip instead of a wall of inputs. Field
  helps share consistent line height and opacity, color groups
  cluster visually.
* **Single-finger auto-rotate**. The idle-camera orbit toggle
  pauses on a single-finger drag instead of requiring two
  fingers, matching the rest of MapLibre's touch input.

### Fixes

* **PV history chart spike**. Cumulative-energy sensors (Wh /
  kWh / MWh) no longer produce phantom spikes from quantization
  noise. The differentiation now holds a 3 min anchor so the
  rate averages over a window where 1 Wh integer noise is
  negligible.
* **Freeze on solar-radiation entity selection**. Selecting a
  solar-radiation entity in the editor used to freeze the card
  while the bridge pulled history. The fetch is now properly
  deferred and the engine continues rendering during the
  in-flight call. Closes
  [#12](https://github.com/ReikanYsora/Helios/issues/12).
* **Sun-ray arrow scrub**. The travelling arrow on the
  irradiance leader no longer detaches from the path when
  scrubbing the timeline back and forth. SMIL `animateMotion`
  no longer restarts on every path update; visibility is now
  gated on `_isLiveMode`.
* **Smartphone vertical alignment on PIC PRÉVU**. Icon and text
  share a single 13 px line-box with a 1 px translateY nudge on
  the uppercase glyphs so they visually centre with the icon
  instead of floating above.
* **LiDAR view button clickability**. `pointer-events` fix so
  the button receives clicks on touch devices. Button hides
  entirely when no provider covers the home, instead of
  rendering disabled.
* **LiDAR View float32 precision** on the GPU buffer (loss-of-
  precision artefacts on long lat / lon values).
* **LiDAR view layer init**. Hardened against a half-ready map
  to stop a race condition where the GL layer attached before
  MapLibre finished bootstrapping its default buffers.

### Internal

* `PAST_DAYS` bumped from 2 to 7. The timeline UI clips to the
  last 2 past days for scrub precision; the extra payload feeds
  the forecast calibration.
* PV history fetch window extended to 7 past days, in one HA
  round-trip instead of two; the chart still filters to its
  visible range.
* New `card/calibration.ts` module exporting
  `computeForecastCalibration(host)`, fed by `_chartSeries` +
  `_pvHistory` + per-day model integration.
* Window-level `helios-data-cache-reset` event bus so multiple
  cards on the same page reset their state in sync.
* `clearWeatherCache()` public helper in `engine/weather.ts`.
* `resetDataCache()` public method on both the card and the
  engine.

### Credits

* **[@jourdant](https://github.com/jourdant)** (Jourdan Templeton)
 , BYO local nDSM LiDAR provider ([PR #5](https://github.com/ReikanYsora/Helios/pull/5))
  and matching Python preparation toolchain
  ([PR #11](https://github.com/ReikanYsora/Helios/pull/11)), idea
  credited to [@stephenwq](https://github.com/stephenwq).
  Unlocks shadows for any region with raw LiDAR data available
  offline, initial use case NSW Australia.
* **[@i6media](https://github.com/i6media)** (Frank Boon), optional
  `home-latitude` / `home-longitude` overrides
  ([PR #9](https://github.com/ReikanYsora/Helios/pull/9)) and the
  multi-orientation PV layout
  ([PR #10](https://github.com/ReikanYsora/Helios/pull/10)).
  Closes #8.


## v1.5.1, tilted-panel forecast, today cumulative chart, dashboard polish

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


## v1.5.0, OpenFreeMap migration, manual PV peak, detail dashboard, multi-country LiDAR

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
per-user OAuth), United States (federal USGS 3DEP exposes a live
ArcGIS Image Server for bare-earth DEM only; no public DSM service,
and state programmes such as MN DNR publish raw LiDAR as per-tile
ZIP downloads only).

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


## Earlier versions

The full pre-1.5.0 history (v1.4.0 LiDAR shadows, v1.3.0 PV
auto-calibration, v1.2.0 customisation + home cluster, v1.1.0
battery + PV + dark theme, v1.0.0 initial HACS release) lives in
the project's git log. The notes for those releases used to be
embedded in `ARCHITECTURE.md` and remain available on the
corresponding GitHub Release pages.
