# ☀️ HELIOS

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![HA-CustomCard](https://img.shields.io/badge/Home%20Assistant-Custom%20Card-blue)](https://github.com/custom-cards/boilerplate-card)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-orange?style=flat-square&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/reikanysora)

**HELIOS** is a custom [Home Assistant](https://www.home-assistant.io/) Lovelace card that visualises the solar conditions at your home in real time, in 3D.

It pulls weather forecasts from **Open-Meteo** (no key needed), reads your solar / grid / battery wiring straight from the **Home Assistant Energy dashboard**, and stitches them together onto a tilted, rotatable map of your home. The whole scene — the sun's daily arc, the live sun disc, the incidence ray, the production / battery / grid chips, the cast shadows — follows a timeline cursor you can scrub days into the past or the future and watch every layer move with it.

The map is drawn by a self-contained **2.5D engine** (no WebGL): a tilted raster basemap with every overlay — buildings, shadows, sun arc, chips and leaders — projected on top in SVG, so the card stays light and works on any device. Basemap tiles come from **[CARTO](https://carto.com/basemaps/)** (free, no key), themed light or dark to match Home Assistant.

> **Companion site:** [**helios-lidar.org**](https://helios-lidar.org) is a free web tool that turns raw open LiDAR data (LAZ / LAS point clouds, or DSM + DTM raster pairs) into the nDSM GeoTIFF Helios can use for true shadows, plus the YAML snippet to paste into the card. No QGIS, no GDAL, no install. The Python preparation toolchain lives in the standalone [Helios-Lidar repository](https://github.com/ReikanYsora/Helios-Lidar).

---

## At a glance

Helios has **three view modes**, switched from the round buttons in the top-left corner.

### ☀️ Scene mode — the live 3D view

* **Sun arc**, the sun's full daily trajectory projected with depth onto your home. The below-horizon portion renders as discreet dots behind the home so it reads as a calm background, while the daylight portion + sun disc + irradiance readout always stack on top.
* **Live sun disc + irradiance halo**, pinned on the arc; the inner fill scales with the live W/m², a soft sun-coloured halo fades from the centre out.
* **Incidence ray**, a dashed line from the sun to the home, animated to flow faster the stronger the sun.
* **Sunrise / sunset markers**, placed where the arc crosses the horizon, with the local time (hidden in polar day / night where there is no crossing).
* **PV production chip + leader + bead** *(when a solar source is configured)*, shows the **instantaneous** production; a bead rides the leader to the home at a speed proportional to current output. Cumulative-energy meters (kWh) are differentiated to watts on the fly; power-native sources are read directly.
* **Battery chips** *(when a battery is configured)*, State of Charge and signed instantaneous power, with a bead whose direction follows charge / discharge.
* **Grid chip + leader + bead** *(when a grid source is configured)*, the active import / export flow, with a bead whose direction and speed track the power.
* **Custom entity chip** *(optional)*, pick any power or energy entity in the editor and Helios surfaces it as an extra red chip top-left, with a leader to the home and a bead that flows home → entity on a positive value, entity → home on a negative one.
* **Home pill**, the hub the chip cluster orbits, showing the home consumption when the Energy dashboard exposes enough to derive it. Click any chip (or the home) to point the timeline chart at that metric.
* **Cast ground shadows**, projected from the surrounding building footprints, fading as the sun nears the horizon. Toggle and opacity are configurable.
* **Hover home glow + auto-rotation**, a soft halo signals the home is interactive; an opt-in idle orbit slowly turns the scene counter to the sun's motion and pauses the moment you touch the card.
* **Timeline**, the rolling window (2 days past + today + 2 days forecast by default) as a re-targetable chart below the scene: production (+ dashed forecast + per-string breakdown), consumption, grid, battery, battery SoC, irradiance, cloud cover or your custom entity. Click or drag to scrub; the whole scene snaps to the selected instant.

### 🕐 Clock mode — the 24-hour dial

A radial instrument that bins each metric into **24 hours of the day** and stands a ring of cylinders around the centre, one bar per hour. The right-hand rail toggles metrics as **filters**: each active metric adds its own **concentric ring** (production, consumption, battery SoC, battery, grid, irradiance, cloud, custom). Hover or tap a slice to light up that hour across every ring and read each metric's value in the tooltip; a faint clock-face guide and an N / S compass keep the dial legible as it rotates with the scene.

### 🛰️ LiDAR mode *(early, opt-in)*

Appears only when you configure a local nDSM raster (see [Local LiDAR](#local-lidar-byo-ndsm)). The dedicated wireframe view + LiDAR-based shadows are in active development.

* **Multilingual**, the card adapts to your Home Assistant language with English and French today.

---

## Screenshots

![HELIOS PREVIEW 01](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_01.png)
![HELIOS PREVIEW 02](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_02.png)
![HELIOS PREVIEW 03](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_03.png)

*HELIOS displaying current solar exposure, cloud coverage and live PV production for the user's home. The full card is also available as an interactive live demo at [helios-lidar.org](https://helios-lidar.org).*

---

## Support my work

Helios is built and maintained by one person, in the open. If it helps your daily routine, a ⭐ on GitHub or a small coffee keeps the project alive and lets me keep pushing on the next cycle. Upcoming work is tracked live on the public roadmap at [helios-lidar.org/roadmap](https://helios-lidar.org/roadmap).

<a href="https://www.buymeacoffee.com/reikanysora"><img src="https://img.buymeacoffee.com/button-api/?text=Support this project&emoji=☀️&slug=reikanysora&button_colour=5F7FFF&font_colour=ffffff&font_family=Arial&outline_colour=000000&coffee_colour=FFDD00" /></a>

---

## Installation via HACS

### Custom repository (recommended for now)

1. Open HACS → click the three-dot menu → **Custom repositories**.
2. Add this repository: `https://github.com/ReikanYsora/Helios`
3. Set category to **Dashboard**.
4. Install **HELIOS** from the dashboard list.
5. Reload your browser.
6. Add the card to your dashboard:
   ```yaml
   type: custom:helios-card
   ```

### Manual installation

1. Download `helios.js` from the latest [release](https://github.com/ReikanYsora/Helios/releases).
2. Copy it to `<config>/www/community/helios/`.
3. Add the resource to your dashboard:
   ```yaml
   url: /local/community/helios/helios.js
   type: module
   ```

---

## Configuration

No API key required. The basemap is served by [CARTO](https://carto.com/basemaps/) (free, no key) and weather comes from Open-Meteo (also free, no key).

Solar, grid and battery wiring is **not configured per-card**: Helios resolves every entity slot from the **HA Energy dashboard** (`Settings → Dashboards → Energy`), the same global config the official Energy card reads. Set the slots there once and Helios picks them up automatically. The options below cover only the visual + install-specific bits.

Minimal config:

```yaml
type: custom:helios-card
```

The visual editor exposes every option below. Direct YAML editing also works.

### Home location

| Key | Type | Default | Description |
|---|---|---|---|
| `home-latitude` | number | HA home | Optional override (decimal degrees). Applied only when **both** lat and lon are set and valid; otherwise the card uses `hass.config`. Useful for a holiday home, a shared install, or several cards each centred on a different place. |
| `home-longitude` | number | HA home | Companion to `home-latitude`. Partial / out-of-range values are ignored. |

### Camera

| Key | Type | Default | Description |
|---|---|---|---|
| `auto-rotate-enabled` | boolean | `false` | Idle camera orbit. Off by default; enable for kiosk / always-on dashboards. Any drag pauses it, then it resumes after a short idle. |
| `camera-pitch-deg` | 15–85 | `55` | Optional fixed pitch at boot. Drag still works unless locked. |
| `camera-bearing-deg` | 0–359 | hemisphere | Optional fixed bearing at boot. |
| `camera-locked` | boolean | `false` | Disable drag-rotate and the idle orbit; the camera stays at the configured pose. Also toggled live from the lock button on the card. |

> The card also remembers the live camera pose, the active mode, the selected clock filters and the lock per home (or per `cache-id`), so reopening the dashboard restores exactly what you left.

### Buildings + shadows

| Key | Type | Default | Description |
|---|---|---|---|
| `display-radius` | 50–500 m | `200` | Distance around the home within which buildings and shadows render. The main perf lever on older phones. |
| `building-count` | 10–100 | `50` | How many of the nearest buildings to keep around the home. |
| `building-real-size` | boolean | `true` | Extrude buildings to their real OSM heights (capped). When `false`, every building uses the fixed `building-height` prism. |
| `building-height` | 3–10 m | `6` | Fixed prism height used when `building-real-size` is `false`. |
| `building-cluster-radius` | 0–100 m | `0` | Buildings within this distance of the home (or touching it) join the home group at full opacity — use it to attach garages / verandas to the house. |
| `building-opacity` | 0–1 | `0.25` | Opacity of the surrounding buildings. The home (and its cluster) always stays at full opacity. |
| `shadows-enabled` | boolean | `true` | Master toggle for the cast ground shadows (projected from the building footprints). |
| `shadow-opacity` | 0–1 | `0.32` | Opacity of the cast shadows. |

### Data display

| Key | Type | Default | Description |
|---|---|---|---|
| `period-past-days` | 0–30 | `2` | Days of history before today in the rolling window. |
| `period-future-days` | 0–14 | `2` | Days of forecast after today. The default window is J-2 → J+2; it can also be changed live from the timeline's period selector. |
| `display-update-frequency-per-hour` | 1–60 | `4` | Storage + render cadence (buckets per hour) for the data store and every graph. `4` = 15-minute granularity (the HA Energy bucket size); raise for smoother curves, lower to save memory. Live numeric chips bypass this and stay on the direct `hass.states` path. |
| `value-decimals` | 0–3 | `1` | Decimal places on every kW / kWh / % readout. |

### Sensors

| Key | Type | Default | Description |
|---|---|---|---|
| `solar-irradiance-entity` | entity_id | – | Optional physical irradiance sensor (W/m²). When set, its live state + recorder history feed the sun chip number, the irradiance chart and the sun-arc colouring for past + present; forecast hours still come from Open-Meteo. |
| `custom-entity` | entity_id | – | Optional power (W/kW/MW) or energy (Wh/kWh/MWh) entity surfaced as the red chip top-left and as a clock-mode metric. |
| `custom-entity-icon` | MDI icon | entity icon | Optional icon override for the custom-entity chip; falls back to the entity's own icon, then a generic glyph. |

### Local LiDAR (BYO nDSM)

Opt into a user-supplied raster for true LiDAR shadows + the LiDAR view mode (in active development). See [Local LiDAR](#local-lidar-byo-ndsm).

| Key | Type | Default | Description |
|---|---|---|---|
| `lidar-local-ndsm-enabled` | boolean | `false` | Master opt-in. When `true` **and** every key below validates, Helios uses your GeoTIFF inside the configured bbox. |
| `lidar-local-ndsm-url` | string | – | Browser-reachable URL of your nDSM GeoTIFF / COG (height-above-ground in metres). Same-origin `/local/...` is the recommended host path. |
| `lidar-local-ndsm-min-lat` / `max-lat` | number | – | Southern / northern edge of the raster, EPSG:4326 degrees (ordered). |
| `lidar-local-ndsm-min-lon` / `max-lon` | number | – | Western / eastern edge, EPSG:4326 degrees (ordered). |

### Per-card cache

| Key | Type | Default | Description |
|---|---|---|---|
| `cache-id` | string | auto | A hidden, auto-generated id that keeps each card's saved view (mode, clock filters, camera, lock) independent — so two cards on the same home (e.g. one in scene mode, one in clock mode) don't share state. You normally never touch this. |

---

## How it works

* **Solar position**, a compact declination + equation-of-time model with hour-angle normalisation so longitudes far from Greenwich stay correct, validated against the NOAA reference.
* **Clear-sky GHI**, Haurwitz (1945), `1098 · cos(z) · exp(-0.059 / cos(z))` W/m², attenuated by cloud via Kasten-Czeplak (1980).
* **Effective cloud cover**, Helios replaces Open-Meteo's raw total `cloud_cover` with `low + 0.6·mid + 0.2·high` (capped at 100 %), which matches ground perception and shortwave attenuation better.
* **Multi-model weather**, every fetch fuses a global model (ECMWF IFS) with the most accurate regional model for your location, taking the per-timestep median so a single-model outlier can't skew the curve. Cached in the browser, with exponential back-off on rate limits.
* **Energy from the HA Energy dashboard**, the single source of truth for every solar / grid / battery number. Live chips read the configured rate sensors (or differentiate a cumulative meter to watts); the timeline's past curves read the recorder's pre-computed `change` metric — the exact numbers the official Energy dashboard shows — so the two surfaces agree to the watt-hour.
* **PV forecast**, read natively from the HA Energy dashboard's configured solar-forecast provider and drawn as the dashed prediction the live observation tracks against; scrubbing into the future flips the PV chip to the predicted figure.
* **Buildings**, fetched once from OpenStreetMap (Overpass), interpreted in the browser (height cap or fixed prism, radius / count / cluster filters) and cached locally, so the scene spins up offline on the next load.

Full algorithm + architecture details: see [ARCHITECTURE.md](./ARCHITECTURE.md). Per-release notes: see [CHANGELOG.md](./CHANGELOG.md).

---

## Local LiDAR (BYO nDSM)

Helios can use a small **nDSM GeoTIFF** you prepared yourself as a true-height source within a bounding box you define. "nDSM" means a *normalised* Digital Surface Model = DSM (top of canopy / rooftops) − DTM (bare earth), so each pixel holds height-above-ground in metres. A raw DSM or a bare-earth DTM is **not** a valid input — the subtraction has to happen first.

### Recommended path: helios-lidar.org

The companion web tool at **[helios-lidar.org](https://helios-lidar.org)** does the GIS conversion server-side. Upload either a raw LAZ / LAS point cloud or a DSM + DTM raster pair from your country's open-data portal and it returns, after a couple of minutes:

* a Cloud-Optimized GeoTIFF in the nDSM format Helios reads,
* the exact YAML snippet to paste into your card config,
* a 3D preview so you can sanity-check the result before downloading.

No QGIS, no GDAL, no Python on your side. Free, no account, no ads. Country-specific tile-picker links and a short DSM / DTM / nDSM / LAS / LAZ / COG glossary are on the upload page.

### Manual offline prep (advanced)

If you'd rather run the conversion locally, the full Python toolchain lives in the standalone [Helios-Lidar repository](https://github.com/ReikanYsora/Helios-Lidar), with the per-OS GDAL install and the YAML snippet documented there.

### How it plugs into the card

Host the resulting GeoTIFF anywhere your browser can fetch it (e.g. `/config/www/helios/foo.tif` exposed as `/local/helios/foo.tif`) and fill the `lidar-local-ndsm-*` keys. When the toggle is on and the URL + the 4 bounding-box keys validate, the LiDAR view mode unlocks and the raster becomes available to the shadow engine (LiDAR-based shadows + the wireframe view are in active development).

The local-nDSM idea was contributed by [@jourdant](https://github.com/jourdant) ([PR #5](https://github.com/ReikanYsora/Helios/pull/5)), with the original idea credited to [@stephenwq](https://github.com/stephenwq), and the Python preparation tooling ([PR #11](https://github.com/ReikanYsora/Helios/pull/11)) has since graduated into its own [Helios-Lidar repository](https://github.com/ReikanYsora/Helios-Lidar).

---

## Technical stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | [Lit](https://lit.dev/) 3, TypeScript (strict) |
| **Rendering** | Self-contained 2.5D engine — tilted raster basemap (HTML canvas) + SVG overlays, no WebGL |
| **Basemap** | [CARTO](https://carto.com/basemaps/) raster tiles (light / dark, no key) |
| **Weather data** | [Open-Meteo API](https://open-meteo.com/) (free, no key, multi-model fusion) |
| **Energy data** | Home Assistant Energy dashboard (recorder `change` metric + live states) |
| **Buildings** | OpenStreetMap via [Overpass](https://overpass-api.de/) |
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

The card is TypeScript-first and fully self-contained. The companion Python preparation toolchain (used by the helios-lidar.org site to convert raw LiDAR into the card's nDSM format) lives in its own repo: [Helios-Lidar](https://github.com/ReikanYsora/Helios-Lidar).

Source layout:

| Path | Purpose |
| :--- | :--- |
| `src/helios-card.ts`            | Top-level Lit element: render orchestrator + HA + Lit lifecycle + view modes |
| `src/helios-engine.ts`          | Engine lifecycle: weather / buildings fetch, sun + shadow refresh, camera + auto-rotate |
| `src/helios-config.ts`          | `HeliosConfig` schema + resolver helpers (radius, period, custom entity, local LiDAR, …) |
| `src/constants.ts`              | Defaults / bounds, cache TTLs, camera limits, colour + math constants |
| `src/card/init.ts`              | Home-coords resolver + engine bootstrap + visibility observer |
| `src/card/editor.ts`            | Visual editor (accordion sections, sliders, entity / icon pickers) |
| `src/card/energy-prefs.ts`      | HA Energy dashboard subscription + slot resolution (PV / grid / battery / forecast) |
| `src/card/energy-forecast.ts`   | HA solar-forecast fetch + merge |
| `src/card/energy-stats.ts`      | Recorder `change`-metric helpers (5-min buckets → watts) |
| `src/card/pv.ts`                | PV live + history + chip / chart formatting |
| `src/card/battery.ts`           | Battery live (power + SoC) + history, multi-bank aggregation |
| `src/card/grid.ts`              | Grid import / export live + history |
| `src/card/irradiance.ts`        | Optional irradiance-sensor override → engine |
| `src/card/custom-entity.ts`     | Custom power / energy entity (chip + clock metric) resolution |
| `src/card/unifiedStore.ts`      | Rolling-window data store: one bucketised source of truth for every graph |
| `src/card/charts.ts`            | Timeline SVG charts + scrub cursors + day labels + hover tooltip |
| `src/card/timeline.ts`          | Clock tick + scrub pointer handlers |
| `src/card/timeline-model.ts`    | Adaptive timeline tick granularity |
| `src/card/energy-clock.ts`      | Clock mode: concentric hour-of-day rings, guide + compass, projection |
| `src/card/hud.ts`               | Scene HUD projection (sun arc, chips, leaders) refreshed each frame |
| `src/card/format.ts`            | Locale-aware number / value formatting + energy colour tokens |
| `src/card/ws-timeout.ts`        | `callWS` wrapper with timeout |
| `src/engine/renderer.ts`        | Scene painter: ground tilt + buildings + shadows + night wash (canvas + SVG) |
| `src/engine/projection.ts`      | 2.5D camera + bearing → pitch → perspective projection |
| `src/engine/tiles.ts`           | CARTO basemap raster stitching + Web Mercator math |
| `src/engine/buildings.ts`       | Overpass fetch + interpret (radius / count / height / cluster) |
| `src/engine/sun.ts`             | Solar position + Haurwitz / Kasten-Czeplak irradiance + PV power math |
| `src/engine/weather.ts`         | Open-Meteo multi-model fetch + cache + back-off |
| `src/engine/colors.ts`          | Hex blending + time-of-day tints (night shade, building tint) |
| `src/css/`                      | Card + editor + clock + timeline + LiDAR style literals |
| `src/i18n/`                     | Strict-typed translations (en, fr) |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the subsystem-by-subsystem walkthrough.

---

## Credits & data sources

HELIOS depends on several open data services. None require an account or API key.

* **[CARTO](https://carto.com/basemaps/)**, the free raster basemap tiles (light / dark, no labels) the scene is built on.
* **[OpenStreetMap](https://www.openstreetmap.org/copyright)**, the map data behind the basemap and the building footprints (via [Overpass](https://overpass-api.de/)). © OpenStreetMap contributors.
* **[Open-Meteo](https://open-meteo.com/)**, weather forecasts (cloud cover, irradiance, temperature, wind). Free, no key, multi-model fusion under the hood.
* **Home Assistant Energy dashboard**, the single source of truth for solar / grid / battery wiring.

---

## Contributors

External contributors who have shaped the card beyond the core author:

* **[@jourdant](https://github.com/jourdant)** (Jourdan Templeton), the bring-your-own local nDSM LiDAR path ([PR #5](https://github.com/ReikanYsora/Helios/pull/5)) and the Python preparation toolchain ([PR #11](https://github.com/ReikanYsora/Helios/pull/11), now the standalone [Helios-Lidar repository](https://github.com/ReikanYsora/Helios-Lidar)). Original idea credit: [@stephenwq](https://github.com/stephenwq).
* **[@i6media](https://github.com/i6media)** (Frank Boon), the optional `home-latitude` / `home-longitude` overrides ([PR #9](https://github.com/ReikanYsora/Helios/pull/9)).

---

## About me

I build bridges between data and reality. To me, development is more than a profession; it is the tool I have used since childhood to try and decode the complexity of the world around me. I learn every day, fully aware that total understanding is an infinite horizon I will likely never reach, but the journey is worth it.

---

## License

This project is licensed under the GNU General Public License v3.0, see the [LICENSE](LICENSE) file for details.
