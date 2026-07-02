# Changelog

All notable changes to HELIOS are documented here.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and the project follows a date-based versioning scheme (`YEAR.MONTH.PATCH`).

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
* The wind-direction arrow is **projected onto the tilted 3D ground**, so it
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
real-time 3D presence on your dashboard. Everything below is what `2026.7.1`
does, here and now.

### The scene

* A faux-3D ("2.5D") view of your home drawn entirely **without WebGL**: a
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

* **Scene**, the live 3D view with the timeline below.
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
