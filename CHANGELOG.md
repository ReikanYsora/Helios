# Changelog

All notable changes to HELIOS are documented here.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and the project follows a date-based versioning scheme (`YEAR.MONTH.PATCH`).

---

## 2026.8.0

The biggest release yet. Devices you track in the Home Assistant energy dashboard
become first-class citizens of the card, a new day view tells the story of your
consumption against the sun, and the whole thing is lighter and faster.

### New: the Helios family, now two cards

Helios ships as two cards you can mix on one dashboard, sharing the same
configuration keys so you can copy-paste between them:

- **Helios**: the full 2.5D scene with the interactive timeline.
- **Helios Energy Fingerprint**: a weekly heatmap of your energy habits (one week
  by 15-minute slots, cell colour = solar coverage, intensity = consumption) with
  week navigation and a day-detail chart of consumption, grid, solar, battery and
  exported energy, including the money earned when a feed-in tariff is configured.

### Fixes

- Scene: left-click drag-rotate now works on Firefox (#306).
- Timeline: the irradiance tooltip shows the forecast value and its beam again (#305).

### New: monitoring groups replace the custom entity

You can now bundle the devices tracked in your energy dashboard into up to **four
monitoring groups**, each with its own name, colour and icon, set in the editor.
A group follows you everywhere: its chip on the scene, its curve in the timeline,
its ring in the day view and its slice in the clock. The old single "custom
entity" is gone; groups do the same job for any number of devices and need no
YAML. Each group is shown by a coloured pill (its number by default, its icon once
you set one), consistent across the editor, the scene chip and both dials.

### New: the Solar Day ring

A day view built around a flat 24-hour dial: each of your devices (or groups)
draws a ring, its width tracking how hard it ran through the day, coloured by
whether that hour's load was met by solar, battery or the grid. Tap a group to
flip into its member devices, tap a ring for a detail panel splitting its energy
across the three sources. It reads across **every period**: Now, Week, Month and
Year aggregate their days by hour-of-day (sums), so the ring shows your typical
day shaped by the whole window; Today fills up to the current hour.

### New: richer clock and battery views

The energy clock gained a compact vertical filter band, slice selection (hover or
tap an hour to pin it across every ring, tap the centre for the period total) and
a cap that keeps the dial legible with many metrics. The battery timeline now
draws one **state-of-charge line per battery bank**, each tinted by its live
charge/discharge flow.

### Changed: a calmer scene

The home now simply takes the active chip's colour (keeping the squash-and-grow
animation when you switch chips). The camera lock is a scene-only setting. Tap
anywhere on the scene background to dismiss an open chip, which finally makes the
detail panel easy to close on a phone. The sun arc uses the true -0.833 degree
horizon so sunrise and sunset land where Home Assistant puts them.

### Changed: focused translations

Helios now ships **27 European languages**, curated for the communities that use
the card most. This cuts the download size substantially with no change to the
languages kept; any other language falls back to English.

### Fixed

- The day bar no longer freezes on the month and year periods (data-freshness fix).
- The battery timeline no longer stacks a cluster of markers on its charge line.
- Assorted robustness: DST-safe day maths, a watchdog on slow map tiles, cleaner
  teardown of animations, and quieter, deduplicated data-layer warnings.

### Removed

- The period-over-period **trend** view. Its story is better told by the day view
  and the timeline's period selector.

---

## 2026.7.4

A quick corrective release. Apologies: 2026.7.3 shipped a detail-panel bug, and I
wanted it fixed fast.

Moral of the story: never let a developer finish "just one more feature" at 2 a.m. :)

### Fixed: detail panel totals now match the energy clock on every period

The per-chip detail panel (double-tap a chip) computed its totals from the card's
rolling ~5-day data window, so on longer periods (month, year) its figures drifted
away from the energy clock and the Home Assistant dashboard, sometimes by a lot.
Every energy total is now computed with the **exact same method the clock uses**
for its period total, so the panel, the clock and the dashboard always agree, on
every period from a day to a year. (The consumption panel's earlier
watt-hours-labelled-as-kWh error is folded into this fix.)

### Fixed: a scene chip selection carries into the clock and trend dials again

Selecting a chip in the scene (including by double-tapping it) once more drives
which metric the clock and trend dials show when you switch to them, instead of
keeping the previously shown one.

### Fixed: the solar forecast is clearly visible on the irradiance view

The dashed solar forecast on the irradiance timeline was ghosted and hard to read
under the cloud-cover bands. It now uses the exact same styling as the production
timeline's forecast (theme-aware shade, full opacity, same dash).

---

## 2026.7.3

**This release changes how Helios reads your data: it now follows the Home
Assistant energy dashboard at 100%, and never estimates a value.** Everything the
card shows, live or historical, comes straight from your dashboard: there is
nothing extra to wire, and no per-card value that can drift from it. Please read
the first section below, it may change what you see on your card.

### Measured values only (energy dashboard alignment)

Helios used to derive some real-time values from your cumulative meters when no
live sensor was available. That created confusing differences with the energy
dashboard, so it is gone. The new rule is simple:

* **Live chips** (the real-time values in the scene) appear **only when a real
  live power sensor** is configured on the matching source of your energy
  dashboard (the optional "power" field). No sensor, no chip: nothing is
  derived from meters anymore.
* **Curves, scrub, energy clock and totals** come only from your **kWh
  meters**, through the same recorder data the energy dashboard reads. They
  match it by construction.
* **The home consumption readout** is the same live balance the energy
  dashboard defines (solar + import - export - battery) and appears once every
  configured family has its live sensor.
* If a live grid sensor is detected as **mis-wired** (for example an
  import-only sensor configured as a signed net sensor), Helios hides the
  affected chips and the editor explains exactly what to fix, instead of
  displaying values that cannot be trusted.
* The editor gains a **live-data status panel** telling you, family by family,
  which live chips can exist with your current configuration and what to add.
* The **home consumption override** option is removed: the dashboard's balance
  is the single source of truth (a diverging per-card sensor was exactly the
  kind of confusion this release ends). The old option is simply ignored.

### Added: detail panels, double-tap any chip

**Double-tap** (or double-click) any chip in the scene to open a compact panel
top-right, tinted in that chip's own colour. It aggregates the metric over the
period you are viewing, as icon-only figures in your chosen unit (W or kW):

* **Production / consumption**: total energy, peak power, average per day.
* **Grid**: total import, total export, net, average import per day.
* **Battery**: energy charged and energy discharged.
* **Battery charge (SoC)**: minimum, average and maximum.
* **Sun**: peak and average irradiance, plus sunrise, solar noon, sunset, highest
  altitude and day length.
* **Custom entity**: total, plus minimum, average and maximum.

Every figure is recomputed from the exact series the chart draws, so the panel and
the curve always agree. Double-tap again to close. Like everything else on the
card, there is nothing to configure: it reads only what your dashboard already
provides.

### Removed: the weather panel

The top-right weather + astronomy plate is gone, along with its temperature and
wind options. It had drifted away from what the card is about, the energy of your
home, and only ever showed values your dashboard displays better. The weather
Helios actually needs, cloud cover and irradiance, keeps driving the sun disc, the
irradiance view and the shadows exactly as before.

### Changed: the clock and trend dials lose their central column

The stacked column at the centre of the clock and trend dials is replaced by the
flat **Helios logo**, laid on the ground plane. It does the same job, hover or tap
it for the period total, without standing up into the view. With several filters
in clock mode, or a busy trend, the old column obstructed the bars, the arc and
the labels; the logo rests at half opacity and lifts to full when you point at it.

### Changed: custom entity now takes its two sensors

* The custom entity follows the same rule: a **power sensor** (live chip and
  curve) and an **energy sensor** (energy views), plus the optional colour and
  icon, in a redesigned editor block. It displays only when both sensors are
  set. An entity configured with the old single field is pre-moved to the
  matching new field in the editor; add the missing one and save.

### Changed: cloud coverage merged into the irradiance chip

* The floating cloud chip is gone (it collided with the home cluster on
  phones). Its weather glyph (clear / partly cloudy / overcast) now lives on
  the irradiance chip: one compact chip, the icon for the sky and the number
  for the W/m². Clicking it opens the irradiance view where the three cloud
  layers are drawn **over the curve** as translucent bands (100% total cover =
  top of the axis), so the clouds visibly eat the sun. The energy clock drops
  its cloud filter (an instantaneous coverage has no meaning in a cumulative
  view).

### Added: dashboard source names on the cards

* The grid and battery rows (tooltips, clock) now display the name you gave
  the source in the energy dashboard settings, when one is set, instead of the
  meter entities' names.

### Added: the solar forecast on the irradiance view

* The dashed forecast curve now also rides the irradiance view (next to the
  cloud layers), as a ghosted silhouette on its own scale: forecast, sun and
  clouds read together. The production view keeps its true shared-scale
  forecast.

### Fixed: the consumption detail panel read 1000x too high

The home (consumption) chip has no meter, so its detail panel integrates power
into energy; that integration returned watt-hours but labelled them kWh, inflating
the total and per-day average by 1000. It now matches the energy clock and the
dashboard. Grid, battery and custom panels were never affected (they sum the
recorder's kWh directly).

### Fixed: a stray battery leader with a hidden state-of-charge chip

When a battery reported power but no state of charge, a connector could still be
drawn to the empty SoC slot. A hidden SoC chip now drops both of the leaders tied
to it, whatever the power reads.

### Fixed: the custom entity stays visible at zero while scrubbing

A measured 0 is a real value, so the custom chip no longer vanishes when you scrub
onto a zero reading; it disappears only where the entity has no history at all.

### Fixed: a minus sign on zero values

* A sensor blipping a few negative milliwatts could render as "-0.00 kW" on a
  chip. Values that round to zero at the displayed precision now render as a
  true zero, everywhere.

### Fixed: production curve flattening into a plateau

* On days with a deep production bell and a long dawn/dusk tail, the
  spike-protection filter could reject the real midday peak and bridge it with
  a flat line. Its threshold now uses the 90th percentile instead of the
  median: genuine peaks always pass, meter-reset spikes are still rejected.

### Fixed: 2.5D buildings are back, from a more reliable source

* The buildings were fetched from the OpenStreetMap Overpass API, which had
  started refusing the card by waves. Helios now reads the same OpenStreetMap
  building data from **OpenFreeMap vector tiles** (a free, key-less map CDN):
  the surroundings load reliably again, with their real heights, and the card
  no longer depends on a service that can lock it out. Still cached locally, so
  it stays instant and works offline on the next load.

### Changed: the custom entity now reads measured energy

* If you use the optional custom entity, its clock ring, timeline curve and
  scrub now read the **energy meter** you configured (the measured kWh from the
  recorder), exactly like grid, solar and battery. The live chip still shows the
  power sensor's instant value. Both sensors stay required.

### Fixed: correctness and performance

* An off-screen card could keep polling the weather service forever; it now
  stops cleanly when hidden.
* A custom entity could re-query the recorder on every state update; it now
  refreshes at most once a minute.
* Recorder queries that never answered could freeze a value until the page was
  reloaded; they now time out and recover on their own.
* A locale that uses a comma as the decimal separator now reads correctly on
  every chip, not just the grid.
* A large batch of internal clean-up (dead code, memory and rendering), with no
  change to what the card does.


---

## 2026.7.2

A refinement release on top of 2026.7.1: a new ambient info panel, more display
and unit options, and a batch of accuracy fixes for specific setups.

### New: weather and astronomy panel

* A small **info panel** in the top-right corner showing the local weather right
  now: temperature and wind, with the sky condition shown as an icon, sourced
  from Open-Meteo, with optional Home Assistant entity overrides for outdoor
  temperature and wind speed. It can be **shown or hidden** from the editor.
* An optional **astronomical readout** (a toggle in the editor, shown only when
  the panel is on) that adds the sun's altitude and azimuth, sunrise, solar noon,
  sunset and day length, each labelled with an icon to keep the panel compact.
* The wind-direction arrow is **projected onto the tilted 2.5D ground**, so it
  keeps pointing at the true compass direction as you orbit the camera.
* The panel stays visible in **No UI mode**, so a wall display keeps its ambient
  weather even once the timeline and controls have faded away.

### New: No UI mode

* An opt-in mode that **fades the timeline and the on-card controls** after a few
  seconds of inactivity and brings them back on any tap or move. Built for
  kiosks and wall displays.

### Display and units

* A **power unit** selector (W or kW); energy follows it, so kW pairs with kWh
  and W with Wh.
* A separate **solar-constant (irradiance) unit** selector.
* A **battery-sign** option: default (minus charging, plus discharging),
  inverted, or hidden on the battery chip.
* An optional **home-consumption override** entity for the consumption chip
  readout, when an inverter exposes a direct sensor.

### Accuracy fixes

* Correct **southern-hemisphere** Clock and Trend, with hour binning now done in
  the server's timezone rather than the browser's.
* Fixed near-zero Clock and Trend totals on kWh-only solar sources.
* **Coarse-reporting meters** (those that report every 15 minutes or more) are
  smoothed so their curves no longer sawtooth.
* Fixed the **solar forecast** reading half power on sub-hourly buckets
  (contributed by @adamhf).
* **Non-solar 24/7 producers** (water turbines, micro-hydro) configured under
  solar production now keep their night-time hours on the Clock and Trend dials,
  and each per-source ring reads the exact recorder energy, matching the Energy
  dashboard instead of the slightly lagging calibration series.
* **Multi-string solar forecast** now sums every configured forecast provider
  instead of showing only the first string's prediction.
* **Multi-battery** installs with mixed wiring (one bank with a live power
  sensor, another with only energy meters) no longer drop a battery from the
  live power readout.
* The home now keeps the **colour of the selected chip** after you leave the
  dashboard and return, instead of resetting to the default metric.

---

## 2026.7.1

A new chapter for Helios. This release describes the card as it is **today**:
a single, self-contained Lovelace card that gives your solar setup a living,
real-time 2.5D presence on your dashboard. Everything below is what `2026.7.1`
does, here and now.

### The scene

* A 2.5D view of your home drawn entirely **without WebGL**: a
  tilted raster basemap from CARTO (free, no key, themed to match Home
  Assistant light / dark) with every overlay projected on top in SVG, so the
  card stays fluid on any device, phones included.
* Surrounding **buildings** are fetched once from OpenStreetMap (Overpass),
  extruded to their real heights (capped) or to a fixed prism, and cached
  locally so the scene reopens instantly and offline.
* **Cast ground shadows** projected from the building footprints along the live
  sun vector, fading as the sun nears the horizon.
* A **day / night ground** that darkens where the sun is below the horizon.
* Optional, opt-in **auto-rotation** that idly orbits the home and pauses the
  instant you touch the card, plus drag-to-rotate and a camera lock.

### The sun

* The sun's **full daily arc** projected with depth: discreet dots below the
  horizon, the bright daylight arc, the live sun disc and an irradiance halo
  that scales with the current W/m² on top.
* An animated **incidence ray** from the sun to the home, flowing faster the
  stronger the sun, and **sunrise / sunset markers** with local times.
* Solar position from a NOAA-validated declination + equation-of-time model;
  clear-sky irradiance via Haurwitz (1945) attenuated by cloud via
  Kasten-Czeplak (1980).

### The energy

* All solar / grid / battery numbers come from the **Home Assistant Energy
  dashboard**, the single source of truth, resolved automatically (no per-card
  entity wiring).
* Live **chips** orbit the home pill: PV production, battery state of charge +
  power, grid import / export and an optional custom entity, each with a leader
  and a flow bead encoding direction and magnitude.
* Live readings come from the configured rate sensors (cumulative meters are
  differentiated to watts on the fly); past curves read the recorder's
  pre-computed `change` metric, so the card and the official Energy dashboard
  agree to the watt-hour.
* **PV forecast** read natively from your configured solar-forecast provider,
  drawn as a dashed prediction the live observation tracks against.
* Optional physical **irradiance sensor** override and an optional **custom
  power / energy entity** surfaced as its own chip and dial metric.

### Three view modes

* **Scene**, the live 2.5D view with the timeline below.
* **Clock**, a 24-hour dial that bins each metric into hours of the day as
  concentric rings around a central column; tap an hour to read every metric,
  with a day / night ground wedge and an N / S compass.
* **Trend**, a period-over-period comparison: the current period as a ring of
  bars with a floating marker pinning the same hour in the previous comparable
  period, coloured good or bad per metric, a current-hour arrow, and a central
  column reading the global delta.

### The timeline

* A re-targetable chart below the scene: production (with dashed forecast and
  per-string breakdown), consumption, grid, battery, battery SoC, irradiance,
  cloud cover or your custom entity. Click or drag to scrub; the whole scene
  snaps to the selected instant.
* **Five periods**, chosen live and remembered per card: **Standard**
  (two days back, today, two days ahead), **Today**, **Week**, **Month** and
  **Year**. Today, Week, Month and Year all end on today; Month and Year match
  the real length of the previous calendar month / year.

### Built in

* **63 languages**, following your Home Assistant language.
* A visual **editor** for every visual and install option, with sensible
  defaults and graceful handling of malformed YAML.
* Per-card persistence of the view mode, camera pose, selected metrics and lock,
  so the dashboard reopens exactly as you left it.

---

## Legacy versions

Helios started its life as a different kind of card, and grew through many
iterations and a great deal of community feedback. To everyone who installed an
early build, opened an issue, suggested a feature or shared a screenshot:
**thank you.** That feedback is precisely what made the project rethink its
direction.

With `2026.7.1`, Helios takes a deliberate new course: a new rendering engine, a
new internal logic, a sharper vision and a real focus on performance and
fluidity on every device. Because so much changed at once, drawing a detailed
before-and-after comparison against the older releases would be more confusing
than useful, so this changelog starts fresh from `2026.7.1`.

The earlier releases remain available in the repository's
[release history](https://github.com/ReikanYsora/Helios/releases) and in the git
history for anyone who needs them, but they are no longer the recommended path.
The clearest, most current picture of where Helios is and where it is going
lives on the project site and its public roadmap at
**[helios-ha.org](https://helios-ha.org)**.
