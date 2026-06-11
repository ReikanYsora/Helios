# ☀️ HELIOS

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![HA-CustomCard](https://img.shields.io/badge/Home%20Assistant-Custom%20Card-blue)](https://github.com/custom-cards/boilerplate-card)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-orange?style=flat-square&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/reikanysora)

**HELIOS** is a custom [Home Assistant](https://www.home-assistant.io/) Lovelace card that visualises solar conditions at your home in real time.

It pulls weather forecasts from **Open-Meteo** (no key needed), reads the optional production sensor of your photovoltaic install from your HA states, and stitches them together onto an interactive 3D map powered by **MapLibre GL** with vector tiles served by **[OpenFreeMap](https://openfreemap.org/)** (free, no key, no signup). The whole map, sun arc, sun disc, incidence ray, cloud cover, building extrusions and cast shadows, irradiance graph, PV graph, reflects the timeline cursor; scrub it 2 days into the past or 2 days into the future and watch every layer follow.

> **v1.8.4 note**, the data-correctness + forecast cycle built on top of v1.8.3's HA Energy rewiring. (1) Every measured series, solar production, grid import / export, battery charge / discharge, now reads the recorder's pre-computed **`change` metric**, the exact numbers the HA Energy dashboard shows, so Helios matches it **to the watt-hour** surface by surface; the recorder also handles counter resets and unit conversion natively, so a daily-reset meter no longer paints a midnight spike and a meter that only reports every 15 minutes (SolarEdge) no longer flickers between 0 and a wrong value on the live chips. (2) The **forecast got a deep overhaul**: it transposes each panel array on Open-Meteo's anisotropic `global_tilted_irradiance` and the real direct / diffuse split instead of a cloud-cover approximation, derates for snow lying on the panels, and **relearns a per-sun-position correction from your own production over a rolling 60 days**, so a tree the LiDAR scan missed (or one that has grown since) gets captured, including on the future days, and the whole curve now runs at the graph-detail cadence so a finer setting resolves short shadow dips an hourly curve stepped right over. See [CHANGELOG](CHANGELOG.md) for the detail.

> **v1.8.3 note**, biggest release of the v1.8.x line by a wide margin. Three structural moves and a few older surfaces retired in one pass. (1) Entity wiring drops every user-configurable PV / grid / battery key in favour of the **HA Energy dashboard as the single source of truth** (`Settings → Dashboards → Energy`), the same global config the official Energy card reads, so the two surfaces stop disagreeing on which sensor a number comes from. (2) The dashboard dive ships a **radial sundial card** that absorbs the previous tiles + cumulative chart into one annular instrument with sunrise / sunset markers, hover dots that snap to every series at the same instant, and a production curve whose Y-axis is locked to the installation's peak power so a sunny vs cloudy day reads on the same scale. (3) The cloud-mode chip is replaced by a top-right **Weather mode** that overlays live RainViewer precipitation radar on the basemap, luminance-inverted to a black-and-white palette (light rain = light grey, storm = dark grey) and refreshed every 5 minutes while the mode stays on. The cycle also retires the shading-map trainer entirely (the gain over the 5-day calibration ratio alone was negligible while the dome rendering and storage costs were heavy), swaps the boot sun-spinner for a card-style **progress banner** with phase-aware fill, surfaces an alert banner under the loading banner whenever the Open-Meteo home-point fetch trips an HTTP 429 back-off, and bumps the i18n surface from 11 to **63 locales**. See [CHANGELOG](CHANGELOG.md) for the detail, and the public roadmap with upcoming work tracked live at [**helios-lidar.org/roadmap**](https://helios-lidar.org/roadmap).

> **Companion site:** [**helios-lidar.org**](https://helios-lidar.org) is a free web tool that turns raw open LiDAR data from any country (LAZ / LAS point clouds OR DSM + DTM raster pairs) into the nDSM GeoTIFF Helios needs, plus the YAML snippet to paste into the card. Use it when your region is not covered by the built-in LiDAR providers below. No QGIS, no GDAL, no install. Free, no account, no ads, hosted on my own VPS. The full Python preparation toolchain lives in the standalone [Helios-Lidar repository](https://github.com/ReikanYsora/Helios-Lidar).

---

## At a glance

* **Sun arc**, the sun's full daily trajectory, projected with depth onto your home. Below-horizon segments render as discreet dots behind the home so the underground portion of the arc reads as a calm background, while the daylight portion + sun disc + irradiance readout always stack on top of every chip.
* **Live sun disc with irradiance-driven halo**, pinned on the arc; the inner fill scales with live W/m², a soft sun-coloured halo fades cleanly from 100 % at the centre to 0 % at the rim, with peak alpha driven by the same irradiance reading.
* **Incidence ray**, dashed line from sun to PV chip, animated to flow at a speed proportional to live irradiance. The stronger the sun, the faster it pulses.
* **Weather mode**, top-right mode bar (Layer / LiDAR / Weather). Weather tilts the camera to a top-down satellite framing around the home and overlays **live RainViewer precipitation radar** on the basemap, luminance-inverted to a black-and-white palette so light rain reads as light grey and storm cells as dark grey. Refreshed every 5 minutes for as long as the user stays in the mode. Three optional cloud-layer chips appear below the mode bar (low / mid / high coverage from the home-point Open-Meteo feed) so the user reads the per-altitude breakdown next to the live radar at a glance. Live-only, no scrub timeline.
* **PV production chip** *(optional)*, pin above the home, shows the **instantaneous** production in W/kW. PV wiring resolves automatically from the HA Energy dashboard (`Settings → Dashboards → Energy → Solar production`); cumulative-energy sources (kWh) are differentiated to watts on the fly over a rolling 60 s window, power-native sources are read directly.
* **PV → home animated leader**, a vertical dashed line in the configured PV colour from the production chip down to a small anchor bead on the home; when you set the installation's peak power (kWp) in the editor, dashes flow toward the home at a speed proportional to current production over that peak. Static and arrow-less when production is zero.
* **PV production overlay + forecast** *(optional)*, when the HA Energy dashboard carries a Solar production source, the card surfaces the current production as a chip below the home and a dedicated graph above the timeline. If you also declare the installation's peak power on each `pv-arrays` entry (or fall back to the legacy top-level `pv-peak-kwp` for a single-array install), a dotted forecast line based on the Haurwitz / Kasten-Czeplak clear-sky model + live cloud cover, with a Sandia NOCT cell-temperature derating fed from Open-Meteo's air temperature + wind speed, overlays the past observation, and the chip switches to a predicted value (prefixed `≈`) when scrubbing into the future. When a LiDAR provider covers the home (or a BYO local-nDSM is configured), the forecast additionally ray-marches from each array toward the sun against the loaded nDSM and zeroes the direct beam on shaded arrays, keeping diffuse + ground-reflected components so a shaded panel drops to ~25-30 % of clear-sky output rather than zero.
* **PV array map markers**, when entries in `pv-arrays` carry their own GPS coordinates (> 10 m from the home), a small solar-panel icon in the configured PV colour appears on the map at each panel location. Useful for ground-mounted arrays sitting elsewhere than the home, e.g. in a clearing while the house itself is under trees.
* **Home battery overlay** *(optional)*, two chips flank the PV chip on the same horizontal axis: State of Charge on the left, signed instantaneous power on the right. Battery wiring is resolved automatically from the HA Energy dashboard (`Settings → Dashboards → Energy → Home Battery Storage`): each bank you declared there contributes to the aggregate, and multi-bank setups (house + garage + standalone hybrid) collapse into one SoC chip (capacity-weighted average) and one power chip (signed sum) without per-card YAML. The chip side appears as soon as the matching slot is wired on the Energy block.
* **Radial sundial dashboard**, click the home to dive into a chip-styled overlay built around a **radial sundial card**: an annular instrument that lays out the day on a 24-hour ring with concentric tracks for production, battery and cloud cover, sunrise / sunset markers anchored on the dial, hover dots that snap every series to the same instant, and a live cursor that traces the current hour. A second view (toggle in the bandeau) swaps the dial for a full-day production curve whose Y-axis is locked to the installation's peak power, so a sunny day stretches to the top and a cloudy day sits visibly lower on the same scale. Today (produced kWh + refined forecast + peak readouts) / Tomorrow (full forecast + peak hour) / Battery (vessel + totals) are surfaced as a CoverFlow strip above the chart so the user swipes between them. Click outside to exit.
* **Forecast calibration**, the dashboard learns from the last 5 completed days how the Open-Meteo model under- or over-predicts your installation and surfaces a refined value next to each PRÉVU figure with a hover hint. Captures static biases (cloud forecast skew, soiling, orientation, inverter losses). Hidden when fewer than 2 past days carry enough production to derive a stable ratio.
* **LiDAR-View overlay**, top-right mode bar (Layer / LiDAR / Weather). LiDAR mode paints every loaded raster cell as a wireframe + filled triangles, shaded in real time by a per-cell raymarch (lit cells glow warm, shadowed cells dim out). A bottom-of-card slider tunes the layer opacity live. Hidden when no LiDAR provider covers the home. Wireframe is always on, only the opacity is user-tunable.
* **Grid IN / OUT chips** *(optional)*, flank the home cluster on the grid side. Grid wiring is resolved automatically from the HA Energy dashboard (`Settings → Dashboards → Energy → Grid consumption / Return to grid`). Multi-tariff installs (HP / HC peak / off-peak indexes like Linky EASF01 + EASF02) are handled natively when the Energy block carries multiple sources per slot, the chip surfaces the most recently incrementing index. Cumulative kWh meters are differentiated to watts on the fly with an HA recorder backfill at boot so the chip reads a meaningful slope even when the live integration is slow-polling. The LIVE chip mirrors the official Energy dashboard's `stat_rate` when configured on the source so the two surfaces match to the watt. An animated bead rides the leader at a speed proportional to power.
* **Hover home glow**, hovering the home triggers a soft sun-coloured halo underneath the silhouette so the focal building reads as interactive before you click. Halo colour tracks the configured sun colour.
* **Auto-rotation** *(opt-in)*, when enabled, the camera slowly orbits the home in the opposite direction to the sun's apparent motion (~1°/s) after a few seconds of inactivity. Any pinch / drag pauses it instantly and it resumes after a fresh idle window.
* **Timeline**, 5 days wide (2 past + today + 2 forecast). Dual-area chart with irradiance on top and cloud cover below. A second graph appears above when a PV entity is configured. Click or drag anywhere on the timeline to scrub; the whole map snaps to the selected instant.
* **Boot progress banner**, replaces the previous spinner on cold start. A themed banner pinned to the top of the card surfaces a per-phase fill (energy prefs, PV history, battery history, grid history, solar radiation, daily totals, weather forecast, buildings, LiDAR raster, LiDAR exposure) so the user reads exactly which fetch is in flight, not "something is loading". Latches itself off after the first complete pass so routine refreshes don't flash it back up.
* **OpenMeteo rate-limit alert banner**, surfaces under the loading banner whenever the Open-Meteo home-point fetch hits HTTP 429 back-off. Themed with HA's `--warning-color` palette (amber tinted background + matching border) so the alert nature reads at a glance, EN + FR copy. Disappears the moment the next fetch lands.
* **Multilingual**, 63 locales matching the full HA frontend translation surface (every language that ships with HA core). Adapts automatically to your Home Assistant language; fallback to English when a string hasn't been translated yet.

---

## Screenshots

![HELIOS PREVIEW 01](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_01.png)
![HELIOS PREVIEW 02](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_02.png)
![HELIOS PREVIEW 03](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_03.png)
![HELIOS PREVIEW 04](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_04.png)
![HELIOS PREVIEW 05](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_05.png)

*HELIOS displaying current solar exposure, cloud coverage and live PV production for the user's home. The full card is also available as an interactive live demo at [helios-lidar.org](https://helios-lidar.org).*

---

## Support my work

v1.8.4 is the data-correctness + forecast cycle: every measured series converges on the recorder `change` metric so Helios matches the HA Energy dashboard to the watt-hour, and the forecast is reworked around Open-Meteo's tilted irradiance, a snow-cover derate and a 60-day learned per-sun-position correction. It builds on v1.8.3, the biggest of the v1.8.x line: entity wiring moved off the card's own YAML keys and onto the HA Energy dashboard as the single source of truth, the dashboard dive was rebuilt around a radial sundial that replaced the previous tiles + cumulative chart, the cloud-mode chip became a top-right Weather mode backed by live RainViewer precipitation radar, the shading-map trainer was retired, the boot spinner was swapped for a phase-aware progress banner, and the i18n surface went from 11 to 63 locales. Upcoming work is tracked live on the public roadmap at [helios-lidar.org/roadmap](https://helios-lidar.org/roadmap). If Helios helps your daily routine, a ⭐ on GitHub or a small coffee keeps the project alive and lets me keep pushing on the next cycle.

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

No API key required. The basemap is served by [OpenFreeMap](https://openfreemap.org/) (free, no signup, no rate limits) and weather comes from Open-Meteo (also free, no key).

PV, grid and battery wiring is **not configured per-card**: the card resolves every entity slot from the HA Energy dashboard (`Settings → Dashboards → Energy`), the same global config the official Energy card reads. Set the slots there once and Helios picks them up automatically. The configuration surface below covers the install-specific bits HA does not know about: peak power per PV string, optional inverter cap, LiDAR providers, visual options.

Minimal config:

```yaml
type: custom:helios-card
```

The visual editor exposes every option below. Direct YAML editing also works.

### Map + buildings + shadows

| Key | Type | Default | Description |
|---|---|---|---|
| `map-style` | `'streets' \| 'minimal'` | `'streets'` | Basemap style. `streets` resolves to OpenFreeMap's [Liberty](https://tiles.openfreemap.org/styles/liberty) (full-colour OpenMapTiles look); `minimal` resolves to [Positron](https://tiles.openfreemap.org/styles/positron) (muted grey, very sober). Both flip to OpenFreeMap's [Dark](https://tiles.openfreemap.org/styles/dark) when the active HA theme is dark (probed via `hass.themes.darkMode`). |
| `show-labels` | boolean | `true` | Show street names, building numbers, POIs and place names on the basemap. |
| `auto-rotate-enabled` | boolean | `false` | When `true`, the camera orbits the home slowly during idle. Any pinch / drag / wheel pauses it for 5 s and it resumes from the user's bearing. Off by default; enable for kiosk / always-on dashboards. |
| `building-cluster-radius` | meters | `0` | Distance around the home within which every building joins the home group at full opacity. Use this to attach verandas, garages and sheds to the main house. Range: 0–100 m. |
| `building-opacity` | 0–1 | `0.25` | Opacity of the surrounding buildings. The home (and its cluster) always stays at full opacity so it reads as the focal point. |
| `shadows-enabled` | boolean | `true` | Master toggle for cast ground shadows. When `false`, no shadows are projected. When `true`, the source is picked automatically: a LiDAR provider when one covers the home (buildings AND vegetation), OpenFreeMap building footprints otherwise (buildings only). See [LiDAR coverage](#lidar-coverage). |
| `lidar-precision` | `'low' \| 'medium' \| 'high'` | `'medium'` | LiDAR raster size when a provider covers the home. Higher = finer shadow contours but a bigger payload. `low` 256², `medium` 512², `high` 1024² (close to IGN native sampling). No effect out of coverage. |
| `shadow-opacity` | 0–1 | `0.32` | Opacity of the cast ground shadows. |

### Display cadence

| Key | Type | Default | Description |
|---|---|---|---|
| `display-update-frequency-per-hour` | 1–60 | `4` | Storage cadence for the 5-day data store + render cadence for every graph that reads from it (radial sundial, graph view, main UI timeline). Higher = smoother curves but more memory + render cycles. Default `4` = 15 min granularity, which is the HA Energy dashboard's native bucket size; raise to `12` for 5 min buckets on a fast machine, lower to `1` for hourly only. Live numeric chips bypass this cadence and stay on the direct `hass.states` path. |

### Installation specifics

| Key | Type | Default | Description |
|---|---|---|---|
| `pv-inverter-max-kw` | number | - | Optional. Inverter AC nameplate in kW. Clips the forecast at this ceiling so an oversized DC array (typical European 6.4 kWp behind a 5 kW inverter) doesn't show a predicted peak above what the hardware delivers. Leave unset to let the forecast run unclipped. |
| `inverter-cutoff-soc-pct` | 0–100 | - | Optional. Percent at which your hybrid inverter clamps PV output once the battery reaches its ceiling. When set AND the HA Energy battery slot exposes a SoC source, the 5-day calibration ratio skips every observation bucket where the battery reached the cutoff, so the inverter-blocked production doesn't poison the actual / predicted ratio. Per-inverter (typically 95 / 98 / 100). |
| `solar-radiation-entity` | entity_id | - | Optional. Physical irradiance sensor (W/m²). When set, its live + recorder history feeds the sun chip number, PV chart Y-axis and sun-arc colouring for past + present timestamps. Forecast hours still come from Open-Meteo. |

### PV arrays (per-string peak + orientation)

| Key | Type | Default | Description |
|---|---|---|---|
| `pv-arrays` | list | - | One entry per group of co-oriented panels. Each entry takes `tilt` (0–90°), `azimuth` (0–360° clockwise from north), `peak-kwp` (this string's actual kWp), and the optional GPS + height + tracker fields below. The forecast model evaluates each entry separately and weights the result, so split-array installs (one row east + one row west, roof + balcony, three-pitch roofs) get a correct production curve. See the example below the table. |
| `pv-arrays[].peak-kwp` | number | - | This string's installed peak in kWp. The engine uses the sum across entries as the install total. |
| `pv-arrays[].share` | number | auto | *Legacy.* This string's relative weight. Auto-normalised to sum to 100 % at compute time. Falls through to a flat split when no entry carries a share. Ignored when `peak-kwp` is set on the same entry. |
| `pv-arrays[].latitude` | number | home lat | Optional. Decimal-degree latitude of this row of panels, used when they sit a meaningful distance away from the home (ground-mounted in a clearing, detached garage, etc.). The forecast runs at the panel's true location and a small solar-panel marker in the PV colour appears on the map. Both `latitude` and `longitude` must be set for the override to apply. |
| `pv-arrays[].longitude` | number | home lon | Optional. Decimal-degree longitude, see `latitude`. |
| `pv-arrays[].height` | metres | `5` | Optional. Height above ground in metres for this row of panels. Used as the starting altitude when the forecast ray-marches against the LiDAR nDSM to decide whether the array is in shadow. The default 5 m matches the eaves of a single-storey house; raise for upper-floor roofs, lower for ground-mounted. Has no effect when no LiDAR provider is active. |
| `pv-arrays[].tracker` | `'none' \| 'dual-axis' \| 'single-axis-h' \| 'single-axis-v'` | `'none'` | Optional. Solar tracker model for this string. `none` (default) treats the panel as a fixed tilt + azimuth install; the tracker variants override the Liu-Jordan transposition with the sun-aligned tilt and / or azimuth (dual-axis hits theoretical peak every hour; horizontal-axis follows sun elevation while parking the configured azimuth; vertical-axis follows the sun's azimuth while parking the configured tilt). |
| `pv-peak-kwp` | number | - | *Legacy top-level fallback.* Total install kWp. Used only when `pv-arrays` is empty or when no entry carries a `peak-kwp`. |
| `pv-tilt` | degrees | `0` | *Legacy.* Tilt angle from horizontal. Superseded by `pv-arrays`; ignored when `pv-arrays` is set. |
| `pv-azimuth` | degrees | `180` | *Legacy.* Compass bearing, clockwise from north. Only used when `pv-tilt > 0` and `pv-arrays` is unset. |

### LiDAR (BYO local nDSM)

When a national provider covers your home (see [LiDAR coverage](#lidar-coverage)), no extra config is needed. The keys below opt into a user-supplied raster when no public provider covers you.

| Key | Type | Default | Description |
|---|---|---|---|
| `lidar-local-ndsm-enabled` | boolean | `false` | Master opt-in for the BYO local nDSM provider. When `true` AND every key below validates, Helios uses your own GeoTIFF as the shadow source inside the configured bbox, taking precedence over any national provider that would otherwise match. |
| `lidar-local-ndsm-url` | string | - | Browser-reachable URL of your nDSM GeoTIFF / COG. Same-origin `/local/community/Helios/lidar/…tif` is the recommended host path. The raster must be an nDSM (height-above-ground, in metres) prepared offline, not a raw DSM / DTM. |
| `lidar-local-ndsm-min-lat` | number | - | Southern edge of the raster's geographic extent, EPSG:4326 degrees. Required when the provider is enabled. |
| `lidar-local-ndsm-max-lat` | number | - | Northern edge, EPSG:4326 degrees. Required when the provider is enabled. |
| `lidar-local-ndsm-min-lon` | number | - | Western edge, EPSG:4326 degrees. Required when the provider is enabled. |
| `lidar-local-ndsm-max-lon` | number | - | Eastern edge, EPSG:4326 degrees. Required when the provider is enabled. |

### Home location override

| Key | Type | Default | Description |
|---|---|---|---|
| `home-latitude` | number | HA's home latitude | Optional override for the home latitude in decimal degrees. When BOTH `home-latitude` and `home-longitude` are set to valid coordinates, they take precedence over `hass.config.latitude` / `longitude` and the map recentres on the override. Useful when Home Assistant's configured home address isn't where you want the card centered (shared HA install, holiday home, mobile setup, privacy-conscious users who leave `hass.config` blank, or multiple cards on one dashboard each visualising a different place). Leave empty (default) to use HA's configured home. |
| `home-longitude` | number | HA's home longitude | Optional override for the home longitude in decimal degrees. Only applied together with `home-latitude`; partial or out-of-range values are silently rejected and the card falls back to HA's configured home. |

### What is no longer configurable

Several v1.7.x / v1.8.x keys are silently stripped on every editor save (the runtime treats them as absent). The migration paths are baked in:

- **Entity wiring** (`pv-power-entity`, `grid-import-entity`, `grid-export-entity`, `grid-power-entity`, `grid-power-invert`, `battery-soc-entity`, `battery-power-entity`, `battery-power-invert`, `batteries`) → resolved from the HA Energy dashboard.
- **Colour identity** (`sun-color`, `cloud-color`, `pv-color`, `battery-color`, `building-color`) → fixed by the HA Energy palette (`--energy-solar-color`, `--energy-battery-out-color`, ...) so the card reads as a first-party HA tile on any theme.
- **Theme keys** (`card-theme`, `card-theme-light`, `card-theme-dark`) → resolved from `hass.themes.darkMode`.
- **Timeline keys** (`timeline-enabled`, `timeline-width-pct`, `timeline-consumption-enabled`) → the timeline is always on, sized to the card width.
- **Display formatting** (`date-format`, `time-format`) → the card reads the HA locale settings.
- **WebGL knobs** (`pixel-ratio`, `building-radius`, `lidar-view-point-size`, `lidar-view-radius`) → derived from a single `DEFAULT_DISPLAY_RADIUS_M` constant (200 m).
- **LiDAR view styling** (`lidar-view-point-color`, `lidar-view-point-opacity`, `lidar-view-wireframe`, `lidar-view-wireframe-color`, `lidar-view-wireframe-opacity`) → the point cloud + wireframe inherit `--primary-text-color` directly from the active HA theme, opacity stays live-tunable via the in-card bottom slider.

### Multi-array PV layouts

Use `pv-arrays` when your panels aren't all facing the same way. One YAML entry per orientation group. Each entry's `peak-kwp` is the install total for that string in kilowatts-peak; the engine sums the entries so the total install kWp comes out of the YAML directly:

```yaml
type: custom:helios-card
pv-arrays:
  - { tilt: 10, azimuth: 90,  peak-kwp: 3.2 }   # one row tilted 10°, facing east
  - { tilt: 10, azimuth: 270, peak-kwp: 3.2 }   # one row tilted 10°, facing west
```

Other shapes work the same way: a roof + balcony combo, a three-pitch roof, or any asymmetric retrofit:

```yaml
pv-arrays:
  - { tilt: 35, azimuth: 180, peak-kwp: 4.6 }   # main south-facing roof
  - { tilt: 90, azimuth: 90,  peak-kwp: 1.9 }   # vertical balcony panels facing east
```

Solar trackers are supported per-array via the optional `tracker` field (dual-axis tracks both tilt + azimuth, single-axis-h follows sun elevation, single-axis-v follows sun azimuth):

```yaml
pv-arrays:
  - { tilt: 0, azimuth: 180, peak-kwp: 7.5, tracker: dual-axis }
```

The visual editor exposes a repeatable "Array" section with `+ Add array` / `Remove`, so you can configure this without dropping to YAML. Existing configs that still use the legacy `share:` weights or the bare `pv-tilt` / `pv-azimuth` keys keep working unchanged.

---

## How it works

* **Solar position**, simplified declination + equation of time, with a hour-angle normalisation so longitudes far from Greenwich (NYC, Tokyo, Sydney) stay correct. Validated against the NOAA SPA reference (mean altitude error 0.30°, mean azimuth error 0.36° across 376 sample points).
* **Clear-sky GHI**, Haurwitz (1945), `1098 · cos(z) · exp(-0.059 / cos(z))` W/m². MAE ~62 W/m² versus PVGIS / NREL benchmarks.
* **Cloud attenuation**, Kasten-Czeplak (1980) cubic, `1 - 0.75 · (cloud/100)^3.4`.
* **Multi-model weather**, every fetch queries one global model (ECMWF IFS 0.25°) plus the most accurate national/regional model for your home location (AROME-France, UKMO UK, DWD ICON-D2, ItaliaMeteo, MET Nordic, NOAA HRRR, KMA LDPS, JMA MSM, BOM ACCESS-G, or ECMWF + GFS elsewhere). Per-timestep median fusion absorbs single-model outliers.
* **Effective cloud cover**, the card replaces Open-Meteo's raw `cloud_cover` (satellite-view total) with `low + 0.6·mid + 0.2·high` (capped at 100 %), matching ground perception and shortwave attenuation.
* **PV instantaneous rate**, for cumulative-energy sensors, the card maintains a 5-minute rolling buffer of state samples and differentiates over a ~60 s window, giving a real "what's being produced right now" reading instead of a misleading lifetime total.
* **PV forecast (optional)**, when at least one `pv-arrays` entry carries a `peak-kwp` value (or the legacy top-level `pv-peak-kwp` is set), the card multiplies the live `effective_cover` by Haurwitz / Kasten-Czeplak per timestamp and scales by the installed peak power, painting a dotted prediction curve on the PV chart that the live observation tracks against. Scrubbing into the future flips the PV chip to the predicted figure (italicised, prefixed `≈`).
* **PV thermal derating**, the same forecast pulls `temperature_2m` + `wind_speed_10m` from Open-Meteo and runs a Sandia NOCT cell-temperature model (`T_cell = T_air + (NOCT - 20) / 800 · GHI - 1.5 · wind`), then derates the predicted output with a `γ_pmp = -0.0040 /°C` temperature coefficient. On a hot summer noon at 35 °C / ~900 W/m² the predicted peak drops by ~13 %, which was previously being absorbed by the rolling calibration ratio as a flat multiplier. Falls back to a multiplier of 1 when the model didn't return temperature or wind at that hour.
* **LiDAR-aware shading on the PV forecast**, when a LiDAR provider covers the home (or a BYO local nDSM is configured), the forecast additionally ray-marches from each `pv-arrays` entry along the sun direction against the loaded nDSM (2 m step, 200 m reach, bilinear sample) and zeroes the direct-beam component on arrays whose line-of-sight to the sun is blocked. Diffuse + ground-reflected components are kept, so a shaded panel doesn't drop to zero but to ~25-30 % of clear-sky output. For installs with `pv-arrays` declared at distinct coordinates, each entry is shaded independently, so a roof-east array shaded by a tall neighbour at 8 am doesn't affect the roof-west array on the same property. From v1.6.3 onwards, when the loaded raster ships a DTM band (every COG produced by [helios-lidar.org](https://helios-lidar.org)) the ray-march also accounts for terrain slope between the panel and the obstacle: a building 50 m east on terrain that rises 8 m reads as a 13 m obstacle, the same building on terrain that drops 8 m reads as -3 m and is correctly ignored. Single-band rasters (legacy locals, every public provider) keep the previous flat-ground behaviour.

* **Forecast calibration (optional)**, the dashboard refines its predicted kWh by learning from the last 5 completed days' (actual / predicted) ratio. The ratio captures the residual biases the analytical model can't see (cloud-forecast skew, soiling, panel ageing) on top of the thermal + shading corrections already applied upstream, and is clamped to [0.5, 1.5] so a one-off sensor outage can't poison the average. Hidden silently when fewer than 2 past days carry enough production to derive a stable ratio.

Full algorithm + architecture details: see [ARCHITECTURE.md](./ARCHITECTURE.md). Per-release notes: see [CHANGELOG.md](./CHANGELOG.md).

---

## LiDAR coverage

When `shadows-enabled` is on, HELIOS picks between two shadow sources automatically:

* **LiDAR**, only when a provider covers your home. With LiDAR, cast shadows reflect real **buildings AND vegetation** (trees, hedges, etc.) captured by aerial scans.
* **OpenFreeMap building footprints**, everywhere else. Buildings only, no vegetation.

LiDAR coverage today, 10 registered providers:

| Country | Provider | Coverage | Format | Note |
| :--- | :--- | :--- | :--- | :--- |
| France | **IGN LiDAR HD** | Metropolitan France + Corsica | BIL float32 | Pre-computed nDSM, single fetch |
| England | **Environment Agency LiDAR Composite** | ~99% of England | GeoTIFF float32 | Two fetches (DSM + DTM), subtracted client-side |
| Spain | **IGN España PNOA-LiDAR (MDSn)** | Peninsular Spain + Balearics | GeoTIFF float32 | Two coverages (vegetation + buildings), merged via MAX. Canarias not covered |
| Netherlands | **PDOK AHN4** | Mainland NL | GeoTIFF float32 | Two coverages (DSM + DTM), subtracted client-side. Caribbean Netherlands not covered |
| Norway | **Kartverket NHM** | Mainland Norway + Svalbard | GeoTIFF float32 (ArcGIS) | Two services (DOM + DTM), subtracted client-side |
| Germany (NRW) | **Geobasis NRW nDOM** | Nordrhein-Westfalen (~18M people) | GeoTIFF float32 (WCS) | Pre-computed nDOM, single fetch |
| Germany (Brandenburg + Berlin) | **LGB bDOM + DGM** | Brandenburg + Berlin (~6.1M people) | GeoTIFF float32 (WCS 2.0.1) | Two fetches (image-based DOM + DGM), subtracted client-side |
| Poland | **GUGiK NMPT** | All of Poland (~38M people) | GeoTIFF float32 (WCS 2.0.1) | Pre-computed national DSM, single fetch, EPSG:4326 natively supported |
| Canada | **NRCan HRDEM Mosaic** | National (1-2 m LiDAR in the south, satellite-derived in the far north) | GeoTIFF float32 (WCS 1.1.1) | Pre-computed DSM coverage, single fetch |
| United States (Vermont) | **VCGI nDSM** | Vermont (~645K people) | Float32 GeoTIFF (ArcGIS exportImage) | Pre-normalised nDSM, single fetch, no DSM-DTM round-trip |

> **Provider expansion is paused while the rest of the cycle catches up.** If your region is not in the table, the [**helios-lidar.org**](https://helios-lidar.org) companion site is the answer today: prepare your own raster from raw open LiDAR data and feed it via the BYO local-nDSM path documented below. Bringing back the dormant providers (Baden-Württemberg, Tyrol, Styria, Flanders, where the DSM-DTM subtraction quality didn't meet the bar) is on the list once a cleaner data path is identified.

An interactive world map of every region the card covers natively
lives at [helios-lidar.org/coverage](https://helios-lidar.org/coverage),
click any point to drop a demo Helios card on it and see the result
instantly. Rectangles are colour-coded by the release that introduced
each provider.

Other national LiDAR programmes were probed and not yet integrated:

* **Wales (Natural Resources Wales)** , per-tile ZIP downloads only, no live raster query endpoint.
* **Switzerland (swisstopo)** , published WMS only carries pre-rendered PNG hillshade, not raw heights. Raw `swissALTI3D` rasters are downloadable as files only.
* **Slovakia (ZBGIS)** , DMR (terrain) is available as GeoTIFF, but DMP (surface) is only published as cached PNG visualisations.
* **Denmark (Datafordeler DHM)** , WCS GeoTIFF exists but requires a per-user API key / OAuth signup, integration parked until that friction is reduced.
* **Belgium (Wallonia + Flanders)** , both regions publish 1m DSM/DTM rasters under permissive licences (CC-BY 4.0 for Wallonia's MNS/MNT 2021-2022, Flemish DHMV II for Flanders + Brussels). Wallonia's WMS however serves pre-rendered RGB tiles for `image/tiff`, not the raw float values the card consumes. Flanders has a clean Float32 WCS but the only exposed CRS is EPSG:31370 (Belgian Lambert 72) which would require bundling a reprojection library (proj4js) to convert the card's WGS84 bbox math. Parked until both can be unblocked together.
* **Other German Länder** , Bayern, Berlin, Hamburg, Sachsen and a handful of others publish nDOM rasters with similar quality to NRW, integration tracked per-Land as time allows.
* **United States** , federal USGS 3DEP exposes a live ArcGIS Image Server (`elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer`) for the *bare-earth* DEM only (DTM). No public DSM service at federal level, so the height-above-ground data needed for shadows isn't reachable. State-level programmes such as Minnesota DNR (`mntopo`) publish raw LiDAR as per-tile ZIP downloads only, no live raster query API. BYO local nDSM is the practical path for US users until a public DSM service materialises.

If your country publishes a usable LiDAR HD endpoint (raw float heights via WMS or WCS, CORS-friendly, no per-user authentication) and you'd like to see it integrated, open an issue. The provider plug-in shape is documented in [ARCHITECTURE.md](./ARCHITECTURE.md) (`helios-lidar.ts` interface + `./helios-lidar/providers/` registry).

Out of coverage the card still renders shadows from OpenFreeMap building footprints, so the visual works worldwide, the LiDAR layer is a precision upgrade where available.

### Bring your own LiDAR

If your region isn't covered by any of the public providers above but you have access to raw LiDAR data (e.g. via a national open-data portal), Helios can use a small nDSM GeoTIFF you prepared yourself as its shadow source within a bounding box you define. There are two ways to prepare that file.

#### Recommended path: helios-lidar.org

The companion web tool at **[helios-lidar.org](https://helios-lidar.org)** does the GIS conversion server-side. You upload either a raw LAZ / LAS point cloud or a DSM + DTM raster pair from your country's open-data portal; the site spits back, after a couple of minutes:

* a 2-band Cloud-Optimized GeoTIFF (band 1 = nDSM = obstacle height above local ground, band 2 = DTM = ground elevation), used by the card's terrain-aware shading,
* the exact YAML snippet to paste into your card config,
* a 3D preview matching the card's own LiDAR View, so you can sanity-check the result before downloading.

> **Already running Helios with a local nDSM from before v1.6.3?** Your existing file keeps working , the card detects the missing DTM band and falls back to flat-ground geometry as it did before. If your home is on a slope (hill, valley, mountain residential), re-running your original LAZ on helios-lidar.org produces a 2-band file the card uses to ray-march obstacles through the real terrain. Users on flat terrain see no difference either way.

No QGIS, no GDAL, no PDAL, no Python install on your side. Free, no account, no ads, no tracking. The site is hosted on a small VPS I pay for myself and is the intended path for LAZ-only or DSM/DTM-only regions where the on-the-fly providers above don't yet reach. Country-specific tile-picker links (France IGN, Switzerland swissSURFACE3D, Netherlands AHN, Spain PNOA-LiDAR, UK Environment Agency, USA 3DEP + global OpenTopography aggregator) are listed directly on the upload page, with a short glossary explaining DSM / DTM / nDSM / LAS / LAZ / COG for first-time users.

#### Manual offline prep (advanced)

If you'd rather run the conversion locally, the full Python toolchain (inspect a GeoTIFF, convert to a Cloud Optimized GeoTIFF, generate a synthetic test raster, plus the helios-lidar.org server itself) lives in the standalone [Helios-Lidar repository](https://github.com/ReikanYsora/Helios-Lidar). The detailed guide for the local-only path, including the GDAL system-library install per OS, the `uv` setup, and the YAML snippet to paste back into Helios, lives there.

#### How it plugs into the card

The card config exposes a `lidar-local-ndsm-*` family (visible in the editor's collapsed "Advanced , Local LiDAR (BYO)" section, hidden by default). When the toggle is on AND the URL + the 4 bounding-box keys all validate, this source takes precedence over any public provider that would otherwise match inside the bbox. Outside the bbox, the regular fallback chain (public providers → OpenFreeMap footprints) applies unchanged.

What "nDSM" means: a normalised Digital Surface Model = DSM (top of canopy / rooftops) − DTM (bare earth), so each pixel holds height-above-ground in metres. A bare-earth DTM or a raw DSM is *not* a valid input, the subtraction has to happen first. Host the resulting GeoTIFF anywhere your browser can fetch it: `/config/www/community/Helios/lidar/foo.tif` exposed as `/local/community/Helios/lidar/foo.tif` is the historical path; the YAML snippet that helios-lidar.org generates uses `/config/www/helios/foo.tif` exposed as `/local/helios/foo.tif` instead, both work.

The BYO local nDSM provider was contributed by [@jourdant](https://github.com/jourdant) in [PR #5](https://github.com/ReikanYsora/Helios/pull/5), with the original idea credited to [@stephenwq](https://github.com/stephenwq). Initial use case: NSW Australia (raster prepared from the [NSW elevation portal](https://elevation.fsdf.org.au/)), where no native provider exists in Helios yet. The companion Python preparation tooling, originally added in [PR #11](https://github.com/ReikanYsora/Helios/pull/11), has since graduated into its own [Helios-Lidar repository](https://github.com/ReikanYsora/Helios-Lidar). Big thanks to all three for closing the LiDAR-coverage gap for the rest of the world.

---

## Technical stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | [Lit](https://lit.dev/) 3, TypeScript |
| **Mapping** | [MapLibre GL JS](https://maplibre.org/) 5 + [OpenFreeMap](https://openfreemap.org/) vector tiles (free, no key, OpenMapTiles schema) |
| **GeoTIFF** | [geotiff.js](https://github.com/geotiffjs/geotiff.js) for parsing the Float32 LiDAR rasters from UK / ES / NL / NO / DE / PL / CA providers |
| **Weather data** | [Open-Meteo API](https://open-meteo.com/) (free, no key) |
| **Solar math** | NOAA-validated (mean altitude error 0.30°, mean azimuth error 0.36°) |
| **Build** | Vite 8 |

---

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # strict TS
npm run build      # produces dist/helios.js
```

The card is TypeScript-first and fully self-contained. The companion Python preparation toolchain (used by the helios-lidar.org site to convert raw LiDAR data into the card's nDSM format) lives in its own repo: [Helios-Lidar](https://github.com/ReikanYsora/Helios-Lidar).

Source layout:

| Path | Purpose |
| :--- | :--- |
| `src/helios-card.ts`              | Top-level Lit element: render orchestrator + HA + Lit lifecycle |
| `src/helios-engine.ts`            | Top-level engine class: MapLibre orchestration + projections |
| `src/helios-config.ts`            | `HeliosConfig` schema + `DEFAULT_*` constants (shared) |
| `src/card/pv.ts`                  | PV live state + history fetch + rate derivation + chip formatter |
| `src/card/battery.ts`             | Multi-bank battery parser + SoC + power live + history aggregation |
| `src/card/grid.ts`                | Grid import / export live + history + HA Energy dashboard entity resolver |
| `src/card/energy-prefs.ts`        | HA Energy dashboard preferences subscription + cache + slot resolution |
| `src/card/radiation.ts`           | Optional `solar-radiation-entity` bridge → engine override |
| `src/card/calibration.ts`         | Forecast calibration: actual / predicted ratio learned from past days |
| `src/card/unifiedStore.ts`        | 5-day data store: 480-bucket source of truth for every dashboard signal |
| `src/card/dashboard.ts`           | Detail-mode panel: CoverFlow strip + Today / Tomorrow / Battery sections |
| `src/card/dashboardRadial.ts`     | Radial sundial card: annular tracks, hover dots, sunrise / sunset markers |
| `src/card/weatherMode.ts`         | Weather mode lifecycle: camera tilt + RainViewer overlay + fade loop |
| `src/card/charts.ts`              | Timeline SVG charts + cursors + day labels |
| `src/card/overlays.ts`            | Sun arc + cloud disc + home silhouette projections |
| `src/card/timeline.ts`            | 30 s clock tick + scrub pointer handlers + config readers |
| `src/card/lidar-view.ts`          | LiDAR-View toggle + fade rAF loop + bottom opacity slider |
| `src/card/loading-tracker.ts`     | Per-phase boot progress banner + visibility latch |
| `src/card/init.ts`                | Engine bootstrap + visibility observer + home-coords resolver |
| `src/card/format.ts`              | cfgHex, formatDate, locale-aware number, hex colour helpers |
| `src/card/editor.ts`              | `<helios-card-editor>` + `<helios-color-picker>` + About section |
| `src/card/cloud-icons.ts`         | Cloud-cover icon picker for the weather mode-bar button |
| `src/card/equipment.ts`           | Equipment chip layout helpers (PV / battery / grid clusters) |
| `src/engine/sun.ts`               | Solar position + Haurwitz / Kasten-Czeplak / Liu-Jordan math |
| `src/engine/pv-thermal.ts`        | Sandia NOCT cell-temp derating |
| `src/engine/pv-shading.ts`        | nDSM raycast (per-array shading + per-cell exposure for LiDAR-View) |
| `src/engine/weather.ts`           | Open-Meteo multi-model fetch + cache + 429 back-off |
| `src/engine/buildings.ts`         | OpenFreeMap planet tile fetch + radius / cluster filter |
| `src/engine/shadows.ts`           | Ground-projected shadow polygons + Sutherland-Hodgman clip |
| `src/engine/shadow-raster.ts`     | Offscreen canvas rasteriser feeding MapLibre's image source |
| `src/engine/lighting.ts`          | Day-night colour math (night shade, building tint, light angle) |
| `src/engine/auto-rotate.ts`       | Idle camera orbit rAF loop |
| `src/engine/camera-bounds.ts`     | Pitch min / max / rest constants shared across the camera entry points |
| `src/engine/detail-mode.ts`       | Detail-mode camera dive (smoothstep zoom + pitch + bearing) |
| `src/engine/lidar-view-layer.ts`  | MapLibre custom WebGL layer: dot cloud + wireframe + irradiance fill |
| `src/engine/lidar.ts`             | `LidarSource` interface + registered provider registry + BYO validator |
| `src/engine/lidar/pipeline.ts`    | Shared flood-fill + convex-hull pipeline |
| `src/engine/lidar/geotiff.ts`     | Float32 GeoTIFF fetch + DSM-DTM math helpers |
| `src/engine/lidar/aaigrid.ts`     | Arc/Info ASCII grid parser (used by a subset of providers) |
| `src/engine/lidar/proj.ts`        | Lightweight EPSG → WGS84 reprojection helpers |
| `src/engine/lidar/proxy.ts`       | CORS / SSL workaround layer for providers behind picky endpoints |
| `src/engine/lidar/local-ndsm.ts`  | Generic BYO nDSM provider built from card config |
| `src/engine/lidar/providers/`     | One file per registered country / region: `fr.ts`, `uk.ts`, `es.ts`, `nl.ts`, `no.ts`, `de-nrw.ts`, `de-bb-be.ts`, `pl.ts`, `ca.ts`, `us-vt.ts`. Four additional files (`at-stmk.ts`, `at-tirol.ts`, `de-bw.ts`, `be-fl.ts`) live in the same folder but are NOT currently in the registry, see the comment in `lidar.ts`. |
| `src/css/`                        | Card + editor style literals |
| `src/i18n/`                       | 63-locale strict-typed translations matching the HA frontend translation surface |

Each `card/*` and `engine/*` module exports plain functions; subsystems
talk to the card / engine through a small structural host interface
declared in the module itself. See [ARCHITECTURE.md](./ARCHITECTURE.md#code-organisation)
for the full pattern.

---

## Credits & data sources

HELIOS depends on several open data services. None require an account or API key.

* **[OpenFreeMap](https://openfreemap.org/)**, free vector basemap tiles + styles (Liberty, Positron, Dark) built from OpenStreetMap data via the OpenMapTiles schema. The buildings, labels and the basemap itself all come from here. Big thank you to the OpenFreeMap project for hosting a public, no-key, no-rate-limit instance, without it, HELIOS would still be hostage to a paid map provider.
* **[OpenStreetMap](https://www.openstreetmap.org/copyright)**, the underlying map data behind every OpenFreeMap tile. © OpenStreetMap contributors.
* **[Open-Meteo](https://open-meteo.com/)**, weather forecasts (cloud cover, irradiance, etc.). Free, no key, multi-model fusion under the hood.
* **National LiDAR providers**, IGN (France), Environment Agency (England), IGN España (Spain), PDOK (Netherlands), Kartverket (Norway). See [LiDAR coverage](#lidar-coverage) for the per-country credits.
* **[MapLibre GL JS](https://maplibre.org/)**, the WebGL map engine that draws every frame.
* **[geotiff.js](https://github.com/geotiffjs/geotiff.js)**, GeoTIFF Float32 decoder used by the UK / ES / NL / NO LiDAR providers.

---

## Contributors

External contributors who have shaped the card beyond the core author:

* **[@jourdant](https://github.com/jourdant)** (Jourdan Templeton), generic BYO local nDSM LiDAR provider ([PR #5](https://github.com/ReikanYsora/Helios/pull/5), unlocks shadows in any region with raw LiDAR data available offline, initial use case NSW Australia), and the Python preparation toolchain under `tools/lidar/` ([PR #11](https://github.com/ReikanYsora/Helios/pull/11), inspect a GeoTIFF, convert to Cloud Optimized GeoTIFF, generate a synthetic test raster). Original idea credit: [@stephenwq](https://github.com/stephenwq).
* **[@i6media](https://github.com/i6media)** (Frank Boon), optional `home-latitude` / `home-longitude` overrides ([PR #9](https://github.com/ReikanYsora/Helios/pull/9), useful for shared HA installs, holiday / parents' homes, mobile setups, or multiple cards on one dashboard each visualising a different place), and the multi-orientation PV layout (`pv-arrays`) ([PR #10](https://github.com/ReikanYsora/Helios/pull/10), one entry per group of co-oriented panels, each with its own tilt, azimuth, share and optional GPS).

---

## About me

I build bridges between data and reality. To me, development is more than a profession; it is the tool I have used since childhood to try and decode the complexity of the world around me. I learn every day, fully aware that total understanding is an infinite horizon I will likely never reach, but the journey is worth it.

---

## License

This project is licensed under the GNU General Public License v3.0, see the [LICENSE](LICENSE) file for details.
