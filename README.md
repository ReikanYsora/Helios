# HELIOS

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![HA-CustomCard](https://img.shields.io/badge/Home%20Assistant-Custom%20Card-blue)](https://github.com/custom-cards/boilerplate-card)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-orange?style=flat-square&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/reikanysora)

**HELIOS** is a custom [Home Assistant](https://www.home-assistant.io/) Lovelace card that turns your solar setup into a living 3D view of your home, the sun and the weather, all in real time and right inside your dashboard.

It reads your solar, grid and battery wiring straight from the **Home Assistant Energy dashboard**, pulls a multi-model weather forecast from **Open-Meteo** (no key), and stitches both onto a tilted, rotatable map of your home. The sun's daily arc, the live sun disc, the incidence ray, the production / battery / grid chips and the cast shadows all follow a timeline you can scrub days into the past or the future, watching every layer move with it.

The scene is drawn by a self-contained **2.5D engine with no WebGL**: a tilted raster basemap with every overlay (buildings, shadows, sun arc, chips and leaders) projected on top in SVG, so the card stays light and fluid on any device, phone included. Basemap tiles come from **[CARTO](https://carto.com/basemaps/)** (free, no key), themed light or dark to match Home Assistant.

> **Website + live demo:** explore the full card, the documentation and the public roadmap at **[helios-ha.org](https://helios-ha.org)**.

---

## At a glance

Helios has **three view modes**, switched from the round buttons in the top-left corner.

### Scene mode, the live 3D view

* **Sun arc**, the sun's full daily trajectory projected with depth onto your home. The below-horizon portion renders as discreet dots behind the home so it reads as a calm background, while the daylight portion, the sun disc and the irradiance readout always stack on top.
* **Live sun disc + irradiance halo**, pinned on the arc; the inner fill scales with the live W/m², a soft sun-coloured halo fades from the centre out.
* **Incidence ray**, a dashed line from the sun to the home, animated to flow faster the stronger the sun.
* **Sunrise / sunset markers**, placed where the arc crosses the horizon, with the local time (hidden in polar day / night where there is no crossing).
* **PV production chip + leader + bead** *(when the solar source has a live power sensor)*, shows the **measured instantaneous** production; a bead rides the leader to the home at a speed proportional to current output.
* **Battery chips** *(when a battery is configured)*, state of charge and signed instantaneous power, with a bead whose direction follows charge / discharge.
* **Grid chip + leader + bead** *(when a grid source is configured)*, the active import / export flow, with a bead whose direction and speed track the power.
* **Custom entity chip** *(optional)*, pick a power sensor AND an energy meter in the editor and Helios surfaces them as an extra chip top-left, with a leader to the home and a bead that flows with the value's sign.
* **Home pill**, the hub the chip cluster orbits, showing the live home consumption balance (the energy dashboard's own definition) once every configured family has its live sensor. Click any chip (or the home) to point the timeline at that metric; the home pill even grows a per-source stacked column when several solar sources are configured.
* **Cast ground shadows**, projected from the surrounding building footprints, fading as the sun nears the horizon. Toggle and opacity are configurable.
* **Day / night ground**, the ground darkens where the sun is below the horizon, so dawn and dusk read at a glance.
* **Hover glow + auto-rotation**, a soft halo signals the home is interactive; an opt-in idle orbit slowly turns the scene counter to the sun's motion and pauses the moment you touch the card.
* **Timeline**, the active period as a re-targetable chart below the scene: production (with dashed forecast and per-string breakdown), consumption, grid, battery, battery SoC, irradiance (with the cloud layers overlaid) or your custom entity. Click or drag to scrub; the whole scene snaps to the selected instant.
* **Weather + astronomy panel**, a small plate in the top-right corner showing the local temperature and wind, with the sky condition as an icon (from Open-Meteo, or your own temperature / wind sensors). An optional toggle adds the sun's altitude, azimuth, sunrise, solar noon, sunset and day length, each shown as an icon to keep it compact. You can show or hide the whole panel; when shown, the wind-direction arrow is projected onto the tilted ground so it keeps pointing the true way as you orbit the camera, and it stays visible in No UI mode.
* **No UI mode** *(optional)*, fades the timeline and the on-card controls after a few seconds of inactivity and brings them back on any tap or move; the weather panel stays. Built for kiosks and wall displays.

### Clock mode, the 24-hour dial

A radial instrument that bins each metric into **24 hours of the day** and stands a ring of cylinders around a central column, one bar per hour. The right-hand rail toggles metrics as **filters**: each active metric adds its own **concentric ring** (production, consumption, battery SoC, battery, grid, irradiance, custom). Hover or tap a slice to light up that hour across every ring and read each metric's value in the tooltip. A soft **day / night wedge** on the ground shows when the sun is up over the period, and an N / S compass keeps the dial legible as it rotates with the scene.

### Trend mode, the period-over-period comparison

A radial comparison of one metric, hour by hour: the **current period** stands as a ring of bars while a floating marker and stem pin the **same hour in the previous comparable period**, so you read instantly whether each hour is up or down. Bars are coloured good or bad depending on the metric (more production is good, more grid import is not). An arrow with a drop line marks the current hour, the central column reads the **global delta** of the whole period versus the one before, and the same day / night wedge grounds the dial.

### Multilingual

Helios follows your Home Assistant language, with **63 languages** translated today.

---

## Screenshots

![HELIOS PREVIEW 01](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_01.png)
![HELIOS PREVIEW 02](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_02.png)
![HELIOS PREVIEW 03](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_03.png)

*HELIOS displaying current solar exposure, cloud coverage and live PV production for the user's home. An interactive live demo is available at [helios-ha.org](https://helios-ha.org).*

---

## Support my work

Helios is built and maintained by one person, in the open. If it helps your daily routine, a star on GitHub or a small coffee keeps the project alive and lets me keep pushing on the next cycle. Upcoming work is tracked live on the public roadmap at [helios-ha.org](https://helios-ha.org).

<a href="https://www.buymeacoffee.com/reikanysora"><img src="https://img.buymeacoffee.com/button-api/?text=Support this project&emoji=☀️&slug=reikanysora&button_colour=5F7FFF&font_colour=ffffff&font_family=Arial&outline_colour=000000&coffee_colour=FFDD00" /></a>

---

## Installation via HACS

Helios is available directly in the [HACS](https://hacs.xyz/) store.

1. Open HACS.
2. Search for **HELIOS**.
3. Install it.
4. Reload your browser.
5. Add the card to your dashboard (see [Adding the card to a dashboard](#adding-the-card-to-a-dashboard)).

### Manual installation

1. Download `helios.js` from the latest [release](https://github.com/ReikanYsora/Helios/releases).
2. Copy it to `<config>/www/community/helios/`.
3. Add the resource to your dashboard:
   ```yaml
   url: /local/community/helios/helios.js
   type: module
   ```

### Adding the card to a dashboard

1. Open the dashboard where you want the card and click the pencil icon (Edit dashboard) in the top right.
2. Click **+ Add card**.
3. Search for **Helios** in the card picker and select it. Or scroll to the bottom, pick **Manual**, and paste:
   ```yaml
   type: custom:helios-card
   ```
4. Save. Helios picks up your Energy dashboard configuration automatically, no other setup is required.

If Helios does not appear in the picker, the resource is probably not loaded. With a HACS install it is registered automatically. For a manual install, go to `Settings` then `Dashboards`, open the three-dot menu, choose `Resources`, and add the resource as described above, then hard-refresh your browser.

---

## Configuration

No API key required. The basemap is served by [CARTO](https://carto.com/basemaps/) (free, no key) and weather comes from Open-Meteo (also free, no key).

Solar, grid and battery wiring is **not configured per-card**: Helios resolves every entity slot from the **HA Energy dashboard** (`Settings` then `Dashboards` then `Energy`), the same global config the official Energy card reads. Set the slots there once and Helios picks them up automatically. The options below cover only the visual and install-specific bits.

### Where do the numbers come from

Helios follows the energy dashboard at 100% and **never estimates a value**:

* **Live chips** (real-time values in the scene) read the **live power sensors**
  of your energy dashboard sources: the optional "power" field of each source.
  If a source has no live power sensor, its chip is simply not shown, and the
  editor's live-data panel tells you what to add. Nothing is ever derived from
  cumulative meters to fake a "now" value.
* **Curves, scrub, energy clock and totals** read your **kWh meters** through
  the recorder statistics, the exact data the energy dashboard's bars are made
  of. Where the dashboard has a number, Helios shows the same number.
* **Home consumption** is the dashboard's own balance (solar + import - export
  - battery), computed live from the live sensors, shown once every configured
  family has one.
* If the grid's live sensor is detected as mis-wired (for example an
  import-only sensor configured as a signed net sensor), Helios hides the grid
  chips and the editor explains what to fix, instead of showing values that
  cannot be trusted.

So: **a visible chip is always a real-time measurement; a curve is always your
official meter data.** If a chip you expect is missing, open the editor: the
live-data panel lists, family by family, what your dashboard provides and what
is missing.

Minimal config:

```yaml
type: custom:helios-card
```

The visual editor exposes every option below. Direct YAML editing also works.

### Home location

| Key | Type | Default | Description |
|---|---|---|---|
| `home-latitude` | number | HA home | Optional override (decimal degrees). Applied only when **both** lat and lon are set and valid; otherwise the card uses `hass.config`. Useful for a holiday home, a shared install, or several cards each centred on a different place. |
| `home-longitude` | number | HA home | Companion to `home-latitude`. Partial or out-of-range values are ignored. |

### Camera

| Key | Type | Default | Description |
|---|---|---|---|
| `auto-rotate-enabled` | boolean | `false` | Idle camera orbit. Off by default; enable for kiosk / always-on dashboards. Any drag pauses it, then it resumes after a short idle. |
| `camera-pitch-deg` | 15-85 | `55` | Optional fixed pitch at boot. Drag still works unless locked. |
| `camera-bearing-deg` | 0-359 | hemisphere | Optional fixed bearing at boot. |
| `camera-locked` | boolean | `false` | Disable drag-rotate and the idle orbit; the camera stays at the configured pose. Also toggled live from the lock button on the card. |

> The card also remembers the live camera pose, the active mode, the selected clock filters and the lock per home (or per `cache-id`), so reopening the dashboard restores exactly what you left.

### Interface

| Key | Type | Default | Description |
|---|---|---|---|
| `auto-hide-ui` | boolean | `false` | No UI mode: fade the timeline and the on-card controls after a few seconds of inactivity, bringing them back on any tap or move. The weather panel stays visible. For kiosks and wall displays. |
| `show-weather` | boolean | `false` | Show the top-right weather panel (scene view). Set to `true` to show it. Independent of No UI mode. |
| `show-astro` | boolean | `false` | Add the sun's astronomical data (altitude, azimuth, sunrise, solar noon, sunset, day length) to the top-right info panel, below the weather. Only applies when `show-weather` is on. |

### Buildings + shadows

| Key | Type | Default | Description |
|---|---|---|---|
| `display-radius` | 50-500 m | `200` | Distance around the home within which buildings and shadows render. The main perf lever on older phones. |
| `building-count` | 10-100 | `50` | How many of the nearest buildings to keep around the home. |
| `building-real-size` | boolean | `true` | Extrude buildings to their real OSM heights (capped). When `false`, every building uses the fixed `building-height` prism. |
| `building-height` | 3-10 m | `6` | Fixed prism height used when `building-real-size` is `false`. |
| `building-cluster-radius` | 0-100 m | `0` | Buildings within this distance of the home (or touching it) join the home group at full opacity. Use it to attach garages / verandas to the house. |
| `building-opacity` | 0-1 | `0.5` | Opacity of the surrounding buildings. The home (and its cluster) always stays at full opacity. |
| `building-color` | color | theme | Optional base tone for the surrounding buildings. |
| `shadows-enabled` | boolean | `true` | Master toggle for the cast ground shadows (projected from the building footprints). |
| `shadow-opacity` | 0-1 | `0.32` | Opacity of the cast shadows. |

### Data display

| Key | Type | Default | Description |
|---|---|---|---|
| `display-update-frequency-per-hour` | 1-6 | `4` | Storage + render cadence (buckets per hour) for the data store and every graph. `4` = 15-minute granularity (the HA Energy bucket size); raise for smoother curves, lower to save memory. Live numeric chips bypass this and stay on the direct `hass.states` path. |
| `value-decimals` | 0-3 | `1` | Decimal places on every kW / kWh / % readout. |
| `power-unit` | `W` \| `kW` | `kW` | Unit for every power readout (chips, tooltips, dial). Energy follows it, so `kW` pairs with `kWh` and `W` with `Wh`. |
| `irradiance-unit` | `W/m²` \| `kW/m²` | `W/m²` | Unit for the solar-constant (irradiance) readout above the sun. |
| `battery-sign` | `default` \| `inverted` \| `hidden` | `default` | Sign shown on the battery chip: `default` (minus charging, plus discharging), `inverted`, or `hidden` (magnitude only). Display-only; flows and history are unchanged. |

The rolling window itself is chosen live from the timeline's period selector (**Standard**, **Today**, **Week**, **Month**, **Year**) and remembered per card; it needs no YAML key.

### Sensors + colors

| Key | Type | Default | Description |
|---|---|---|---|
| `solar-irradiance-entity` | entity_id | none | Optional physical irradiance sensor (W/m²). When set, its live state + recorder history feed the sun chip number, the irradiance chart and the sun-arc colouring for past + present; forecast hours still come from Open-Meteo. |
| `outdoor-temperature-entity` | entity_id | none | Optional sensor shown on the info panel instead of the Open-Meteo temperature. Read in its own unit. |
| `wind-speed-entity` | entity_id | none | Optional sensor shown on the info panel instead of the Open-Meteo wind speed. Read in its own unit. |
| `custom-power-entity` | entity_id | none | Custom entity, live half: a real power sensor (W/kW) feeding the extra chip top-left, its scrub and its curve. The custom entity displays only when BOTH halves are set. |
| `custom-energy-entity` | entity_id | none | Custom entity, energy half: a cumulative energy meter (Wh/kWh) feeding the energy views. |
| `custom-entity-icon` | MDI icon | entity icon | Optional icon override for the custom-entity chip; falls back to the entity's own icon, then a generic glyph. |
| `custom-entity-color` | color | theme red | Optional colour for the custom-entity chip, its leader and its clock ring. |
| `home-color` | color | theme | Optional colour for the home pill and its consumption readout. |

### Per-card cache

| Key | Type | Default | Description |
|---|---|---|---|
| `cache-id` | string | auto | A hidden, auto-generated id that keeps each card's saved view (mode, clock filters, camera, lock) independent, so two cards on the same home (for example one in scene mode, one in clock mode) do not share state. You normally never touch this. |

---

## How it works

* **Solar position**, a compact declination + equation-of-time model with hour-angle normalisation so longitudes far from Greenwich stay correct, validated against the NOAA reference.
* **Clear-sky GHI**, Haurwitz (1945), `1098 * cos(z) * exp(-0.059 / cos(z))` W/m², attenuated by cloud via Kasten-Czeplak (1980).
* **Effective cloud cover**, Helios replaces Open-Meteo's raw total `cloud_cover` with `low + 0.6*mid + 0.2*high` (capped at 100 %), which matches ground perception and shortwave attenuation better.
* **Multi-model weather**, every fetch fuses a global model (ECMWF IFS) with the most accurate regional model for your location, taking the per-timestep median so a single-model outlier cannot skew the curve. Cached in the browser, with exponential back-off on rate limits.
* **Energy from the HA Energy dashboard**, the single source of truth for every solar / grid / battery number. Live chips read the configured rate sensors (or differentiate a cumulative meter to watts); the timeline's past curves read the recorder's pre-computed `change` metric, the exact numbers the official Energy dashboard shows, so the two surfaces agree to the watt-hour.
* **PV forecast**, read natively from the HA Energy dashboard's configured solar-forecast provider and drawn as the dashed prediction the live observation tracks against; scrubbing into the future flips the PV chip to the predicted figure.
* **Buildings**, fetched once from OpenStreetMap (via OpenFreeMap vector tiles), interpreted in the browser (height cap or fixed prism, radius / count / cluster filters) and cached locally, so the scene spins up offline on the next load.

Full algorithm + architecture details: see [ARCHITECTURE.md](./ARCHITECTURE.md). Per-release notes: see [CHANGELOG.md](./CHANGELOG.md).

---

## Technical stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | [Lit](https://lit.dev/) 3, TypeScript (strict) |
| **Rendering** | Self-contained 2.5D engine: tilted raster basemap (HTML canvas) + SVG overlays, no WebGL |
| **Basemap** | [CARTO](https://carto.com/basemaps/) raster tiles (light / dark, no key) |
| **Weather data** | [Open-Meteo API](https://open-meteo.com/) (free, no key, multi-model fusion) |
| **Energy data** | Home Assistant Energy dashboard (recorder `change` metric + live states) |
| **Buildings** | OpenStreetMap via [OpenFreeMap](https://openfreemap.org/) vector tiles |
| **Solar math** | NOAA-validated |
| **Build** | Vite |

---

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # strict TS
npm run build      # produces dist/helios.js
```

The card is TypeScript-first and fully self-contained, a single `helios.js` bundle with no runtime dependency beyond Lit.

Source layout:

| Path | Purpose |
| :--- | :--- |
| `src/helios-card.ts`            | Top-level Lit element: render orchestrator + HA + Lit lifecycle + view modes |
| `src/helios-engine.ts`          | Engine lifecycle: weather / buildings fetch, sun + shadow refresh, camera + auto-rotate |
| `src/helios-config.ts`          | `HeliosConfig` schema + resolver helpers (radius, custom entity, colours, ...) |
| `src/constants.ts`              | Defaults / bounds, cache TTLs, camera limits, colour + math constants |
| `src/card/init.ts`              | Home-coords resolver + engine bootstrap + visibility observer |
| `src/card/editor.ts`            | Visual editor (accordion sections, sliders, entity / icon / colour pickers) |
| `src/card/energy-prefs.ts`      | HA Energy dashboard subscription + slot resolution (PV / grid / battery / forecast) |
| `src/card/energy-forecast.ts`   | HA solar-forecast fetch + merge |
| `src/card/energy-stats.ts`      | Recorder `change`-metric helpers (5-min buckets to watts) |
| `src/card/pv.ts` `battery.ts` `grid.ts` | Per-source live + history (power, SoC, import / export) |
| `src/card/irradiance.ts`        | Optional irradiance-sensor override into the engine |
| `src/card/custom-entity.ts`     | Custom power / energy entity (chip + clock / trend metric) resolution |
| `src/card/unifiedStore.ts`      | Rolling-window data store: one bucketised source of truth for every graph |
| `src/card/charts.ts` `charts-pv.ts` `charts-generic.ts` | Timeline SVG charts + scrub cursors + day labels + tooltip |
| `src/card/timeline.ts` `timeline-model.ts` `timeline-modes.ts` | Scrub handlers, tick granularity, the five rolling-window periods |
| `src/card/timeline-night.ts` `timeline-tooltip.ts` | Timeline night-zone shading + hover tooltip |
| `src/card/energy-clock.ts` `clock-hourly.ts` | Clock + trend dials: hour-of-day rings, central column, projection |
| `src/card/trend.ts`             | Period-over-period (current vs previous) hour-of-day profiles |
| `src/card/sun-zones.ts`         | Per-hour day / night fraction for the dial ground wedge |
| `src/card/hud.ts` `hud-geometry.ts` | Scene HUD projection (sun arc, chips, leaders) refreshed each frame |
| `src/card/format.ts`            | Locale-aware number / value formatting + energy colour tokens |
| `src/card/info-panel.ts`        | Weather + astronomy info panel helpers (WMO condition to icon, unit conversion, formatting) |
| `src/engine/renderer.ts`        | Scene painter: ground tilt + buildings + shadows + night wash (canvas + SVG) |
| `src/engine/projection.ts`      | 2.5D camera + bearing / pitch / perspective projection |
| `src/engine/tiles.ts`           | CARTO basemap raster stitching + Web Mercator math |
| `src/engine/buildings.ts`       | OpenFreeMap fetch + interpret (radius / count / height / cluster) |
| `src/engine/sun.ts` `sun-arc.ts` | Solar position + Haurwitz / Kasten-Czeplak irradiance + PV math + arc geometry |
| `src/engine/weather.ts` `weather-resolve.ts` | Open-Meteo multi-model fetch + cache + back-off (cloud, irradiance, temperature, wind) |
| `src/engine/colors.ts`          | Hex blending + time-of-day tints (night shade, building tint) |
| `src/css/`                      | Card + editor + clock + timeline style literals |
| `src/i18n/`                     | Strict-typed translations (63 languages) |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the subsystem-by-subsystem walkthrough.

---

## Credits & data sources

HELIOS depends on several open data services. None require an account or API key.

* **[CARTO](https://carto.com/basemaps/)**, the free raster basemap tiles (light / dark, no labels) the scene is built on.
* **[OpenStreetMap](https://www.openstreetmap.org/copyright)**, the map data behind the basemap and the building footprints (served as vector tiles by [OpenFreeMap](https://openfreemap.org/)). © OpenStreetMap contributors.
* **[Open-Meteo](https://open-meteo.com/)**, weather forecasts (cloud cover, irradiance, temperature, wind). Free, no key, multi-model fusion under the hood.
* **Home Assistant Energy dashboard**, the single source of truth for solar / grid / battery wiring.

A heartfelt thank you to every user who tried Helios, filed an issue, suggested an idea or simply shared a screenshot. Your feedback is what shaped the direction the card has taken.

---

## About me

I build bridges between data and reality. To me, development is more than a profession; it is the tool I have used since childhood to try and decode the complexity of the world around me. I learn every day, fully aware that total understanding is an infinite horizon I will likely never reach, but the journey is worth it.

---

## License

HELIOS, solar conditions visualisation card for Home Assistant.
Copyright (C) 2026 Jérôme Crémoux (ReikanYsora).

This project is licensed under the GNU General Public License v3.0, see the [LICENSE](LICENSE) file for details.
