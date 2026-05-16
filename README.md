# ☀️ HELIOS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![HA-CustomCard](https://img.shields.io/badge/Home%20Assistant-Custom%20Card-blue)](https://github.com/custom-cards/boilerplate-card)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-orange?style=flat-square&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/reikanysora)

**HELIOS** is a custom [Home Assistant](https://www.home-assistant.io/) Lovelace card that visualises solar conditions at your home in real time.

It pulls weather forecasts from **Open-Meteo** (no key needed), reads the optional production sensor of your photovoltaic install from your HA states, and stitches them together onto an interactive 3D map powered by **MapLibre GL** with vector tiles served by **[OpenFreeMap](https://openfreemap.org/)** (free, no key, no signup). The whole map, sun arc, sun disc, incidence ray, cloud cover, building extrusions and cast shadows, irradiance graph, PV graph, reflects the timeline cursor; scrub it 2 days into the past or 2 days into the future and watch every layer follow.

---

## At a glance

* **Sun arc**, the sun's full daily trajectory, projected with depth onto your home. Below-horizon segments render as discreet dots behind the home so the underground portion of the arc reads as a calm background, while the daylight portion + sun disc + irradiance readout always stack on top of every chip.
* **Live sun disc with irradiance-driven halo**, pinned on the arc; the inner fill scales with live W/m², a soft sun-coloured halo fades cleanly from 100 % at the centre to 0 % at the rim, with peak alpha driven by the same irradiance reading.
* **Incidence ray**, dashed line from sun to PV chip, animated to flow at a speed proportional to live irradiance. The stronger the sun, the faster it pulses.
* **Cloud cover disc**, translucent disc on the ground, scaled by live cloud-cover %, outlined in the configured cloud colour. A fixed black ring marks the 100 % reference. Hover for the low/mid/high breakdown.
* **PV production chip** *(optional)*, pin above the home, shows the **instantaneous** production in W/kW. Cumulative-energy sensors (kWh) are differentiated automatically over a rolling 60 s window.
* **PV → home animated leader**, a vertical dashed line in the configured PV colour from the production chip down to a small anchor bead on the home; when you set the installation's peak power (kWp) in the editor, dashes flow toward the home at a speed proportional to current production over that peak. Static and arrow-less when production is zero.
* **PV production overlay + forecast** *(optional)*, when a PV entity is configured, the card surfaces the current production as a chip below the home and a dedicated graph above the timeline. If you also enter your installation's peak power (kWp) in the editor, a dotted forecast line based on the Haurwitz / Kasten-Czeplak clear-sky model + live cloud cover overlays the past observation, and the chip switches to a predicted value (italicised, prefixed `≈`) when scrubbing into the future.
* **Home battery overlay** *(optional)*, two independent chips flank the PV chip on the same horizontal axis: State of Charge on the left, signed instantaneous power on the right. Each chip is connected to PV by a short static dotted L-leader. Either entity is independently optional; the corresponding chip only renders when its entity is set.
* **Detail dashboard**, click the home to dive into a chip-styled overlay with four compact sections that fade in one after the other: today's produced kWh + projected end-of-day total + peak time, a 7-day "bottles" chart of recent production, tomorrow's forecast headline (estimated kWh + peak hour), and a battery vessel showing live SoC + the day's charge / discharge totals. Click anywhere outside to exit.
* **Hover home glow**, hovering the home triggers a soft sun-coloured halo underneath the silhouette so the focal building reads as interactive before you click. Halo colour tracks the configured sun colour.
* **Auto-rotation** *(opt-in)*, when enabled, the camera slowly orbits the home in the opposite direction to the sun's apparent motion (~1°/s) after a few seconds of inactivity. Any pinch / drag pauses it instantly and it resumes after a fresh idle window.
* **Timeline**, 5 days wide (2 past + today + 2 forecast). Dual-area chart with irradiance on top and cloud cover below. A second graph appears above when a PV entity is configured. Click or drag anywhere on the timeline to scrub; the whole map snaps to the selected instant.
* **Multilingual**, English, French, German, Spanish, Italian, Dutch, Portuguese, Norwegian. Adapts to your Home Assistant language.

---

## Screenshots

![HELIOS PREVIEW 01](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_01.png)
![HELIOS PREVIEW 02](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_02.png)
![HELIOS PREVIEW 02](https://raw.githubusercontent.com/ReikanYsora/Helios/main/images/preview_03.png)

*HELIOS displaying current solar exposure, cloud coverage and live PV production for the user's home.*

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

The visual editor exposes every option. Minimal config:

```yaml
type: custom:helios-card
```

Every option below is editable visually:

| Key | Type | Default | Description |
|---|---|---|---|
| `map-style` | `'streets' \| 'minimal'` | `'streets'` | Basemap style. `streets` resolves to OpenFreeMap's [Liberty](https://tiles.openfreemap.org/styles/liberty) (full-colour OpenMapTiles look); `minimal` resolves to [Positron](https://tiles.openfreemap.org/styles/positron) (muted grey, very sober). Both flip to OpenFreeMap's [Dark](https://tiles.openfreemap.org/styles/dark) when `card-theme` is `'dark'`. |
| `card-theme` | `'light' \| 'dark'` | `'light'` | Card chrome skin (chips, charts, buttons, tooltips, scrub overlay) AND the 3D map basemap flip between a light surface (white plate) and a dark surface (near-black `#191a1b` plate), so the card sits cleanly inside light or dark Home Assistant dashboards. |
| `pixel-ratio` | `'auto' \| '1x'` | `'auto'` | WebGL canvas pixel density. `auto` uses the device's native devicePixelRatio (capped at 2 on desktop, 1.25 on mobile). `1x` forces 1.0, the cheapest per-frame fragment workload, useful on low-end devices or for long sessions where battery / heat matters more than crispness. |
| `auto-rotate-enabled` | boolean | `false` | When `true`, the camera orbits the home slowly during idle. Any pinch / drag / wheel pauses it for 5 s and it resumes from the user's bearing. Off by default; enable for kiosk / always-on dashboards. |
| `show-labels` | boolean | `true` | Show street names, building numbers, POIs and place names on the basemap. |
| `building-radius` | meters | `100` | Distance around the home within which surrounding buildings are rendered in 3D. Buildings outside the radius are not drawn, the perf win in dense urban areas. Range: 20–1000 m. |
| `building-cluster-radius` | meters | `0` | Distance around the home within which every building joins the home group at full opacity. Use this to attach verandas, garages and sheds to the main house. Range: 0–100 m. |
| `building-opacity` | 0–1 | `0.25` | Opacity of the surrounding buildings. The home (and its cluster) always stays at full opacity so it reads as the focal point. |
| `building-color` | hex | `#d2d2d7` | Base colour for every rendered building, modulated by sun altitude across the day. |
| `shadows-enabled` | boolean | `true` | Master toggle for cast ground shadows. When `false`, no shadows are projected. When `true`, the source is picked automatically: a LiDAR provider when one covers the home (buildings AND vegetation), OpenFreeMap building footprints otherwise (buildings only). All shadows are clipped to the building visibility radius for consistency with the rendered surroundings. See [LiDAR coverage](#lidar-coverage). |
| `lidar-precision` | `'low' \| 'medium' \| 'high'` | `'medium'` | LiDAR raster size when a provider covers the home. Higher = finer shadow contours but a bigger payload. `low` 256², `medium` 512², `high` 1024² (close to IGN native sampling). No effect out of coverage. |
| `shadow-opacity` | 0–1 | `0.32` | Opacity of the cast ground shadows. |
| `sun-color` | hex | `#EF9F27` | Sun disc + arc + timeline irradiance area. |
| `cloud-color` | hex | `#5A8DC4` | On-ground disc + timeline cloud area. |
| `pv-power-entity` | entity_id | - | Optional. Power (W/kW) or cumulative energy (Wh/kWh) sensor. |
| `pv-peak-kwp` | number | - | Optional. Installed peak power in kilowatts-peak. When set, drives the dotted clear-sky forecast line on the PV chart and paces the PV → home animated leader against your installation. Leave empty to hide the forecast (live observation + today's peak still display). |
| `pv-tilt` | degrees | `0` | Optional. Tilt angle of your panels from horizontal: 0 for a flat install, 90 for fully vertical (e.g. balcony). When greater than 0, the forecast model switches from a horizontal-panel assumption to a Liu-Jordan transposition so steep-roof and balcony installs stop seeing a flat-roof prediction (typically a 3–4× overshoot). Leave at 0 to keep the legacy behaviour. |
| `pv-azimuth` | degrees | `180` | Optional. Compass bearing your panels face, clockwise from north: 0 = north, 90 = east, 180 = south, 270 = west. Only used when `pv-tilt > 0`. |
| `pv-color` | hex | `#27B36B` | PV chip border + text + leader + dedicated graph. |
| `battery-soc-entity` | entity_id | - | Optional. Battery State-of-Charge sensor (`%`, usually `device_class: battery`). Renders as a chip on the LEFT of the PV chip showing the live percentage. |
| `battery-power-entity` | entity_id | - | Optional. Battery power sensor (W/kW). Signed: positive is interpreted as charging. Renders as a chip on the RIGHT of the PV chip showing the signed reading verbatim. |
| `battery-color` | hex | `#FF5252` | Battery colour reused on both battery chips' borders + text + the static dotted leaders that connect each to the PV chip. |
| `date-format` | string | `mm-dd` | Tokens: `yyyy`, `yy`, `mm`, `dd`. |
| `time-format` | `'12h' \| '24h'` | `'24h'` | Clock display in the top-right chip. |
| `home-latitude` | number | Home Assistant's home latitude | Optional override for the home latitude in decimal degrees. When BOTH `home-latitude` and `home-longitude` are set to valid coordinates, they take precedence over `hass.config.latitude` / `longitude` and the map recentres on the override. Useful when Home Assistant's configured home address isn't where you want the card centered (shared HA install, holiday home, mobile setup, privacy-conscious users who leave `hass.config` blank, or multiple cards on one dashboard each visualising a different place). Leave empty (default) to use HA's configured home. |
| `home-longitude` | number | Home Assistant's home longitude | Optional override for the home longitude in decimal degrees. Only applied together with `home-latitude`; partial or out-of-range values are silently rejected and the card falls back to HA's configured home. |

The PV entity picker filters to sensors that look like a power or energy reading (`device_class: power|energy` OR a unit in `W/kW/MW/Wh/kWh/MWh`). Both kinds work; the card auto-detects whether to display the entity's state directly (power sensor) or differentiate it on the fly (cumulative energy).

---

## How it works

* **Solar position**, simplified declination + equation of time, with a hour-angle normalisation so longitudes far from Greenwich (NYC, Tokyo, Sydney) stay correct. Validated against the NOAA SPA reference (mean altitude error 0.30°, mean azimuth error 0.36° across 376 sample points).
* **Clear-sky GHI**, Haurwitz (1945), `1098 · cos(z) · exp(-0.059 / cos(z))` W/m². MAE ~62 W/m² versus PVGIS / NREL benchmarks.
* **Cloud attenuation**, Kasten-Czeplak (1980) cubic, `1 - 0.75 · (cloud/100)^3.4`.
* **Multi-model weather**, every fetch queries one global model (ECMWF IFS 0.25°) plus the most accurate national/regional model for your home location (AROME-France, UKMO UK, DWD ICON-D2, ItaliaMeteo, MET Nordic, NOAA HRRR, KMA LDPS, JMA MSM, BOM ACCESS-G, or ECMWF + GFS elsewhere). Per-timestep median fusion absorbs single-model outliers.
* **Effective cloud cover**, the card replaces Open-Meteo's raw `cloud_cover` (satellite-view total) with `low + 0.6·mid + 0.2·high` (capped at 100 %), matching ground perception and shortwave attenuation.
* **PV instantaneous rate**, for cumulative-energy sensors, the card maintains a 5-minute rolling buffer of state samples and differentiates over a ~60 s window, giving a real "what's being produced right now" reading instead of a misleading lifetime total.
* **PV forecast (optional)**, when `pv-peak-kwp` is set, the card multiplies the live `effective_cover` by Haurwitz / Kasten-Czeplak per timestamp and scales by the installed peak power, painting a dotted prediction curve on the PV chart that the live observation tracks against. Scrubbing into the future flips the PV chip to the predicted figure (italicised, prefixed `≈`).

Full algorithm + architecture details: see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## LiDAR coverage

When `shadows-enabled` is on, HELIOS picks between two shadow sources automatically:

* **LiDAR**, only when a provider covers your home. With LiDAR, cast shadows reflect real **buildings AND vegetation** (trees, hedges, etc.) captured by aerial scans.
* **OpenFreeMap building footprints**, everywhere else. Buildings only, no vegetation.

LiDAR coverage today:

| Country | Provider | Coverage | Format | Note |
| :--- | :--- | :--- | :--- | :--- |
| France | **IGN LiDAR HD** | Metropolitan France + Corsica | BIL float32 | Pre-computed nDSM, single fetch |
| England | **Environment Agency LiDAR Composite** | ~99% of England | GeoTIFF float32 | Two fetches (DSM + DTM), subtracted client-side |
| Spain | **IGN España PNOA-LiDAR (MDSn)** | Peninsular Spain + Balearics | GeoTIFF float32 | Two coverages (vegetation + buildings), merged via MAX. Canarias not covered |
| Netherlands | **PDOK AHN4** | Mainland NL | GeoTIFF float32 | Two coverages (DSM + DTM), subtracted client-side. Caribbean Netherlands not covered |
| Norway | **Kartverket NHM** | Mainland Norway + Svalbard | GeoTIFF float32 (ArcGIS) | Two services (DOM + DTM), subtracted client-side |

Other national LiDAR programmes were probed and not yet integrated:

* **Wales (Natural Resources Wales)** , per-tile ZIP downloads only, no live raster query endpoint.
* **Switzerland (swisstopo)** , published WMS only carries pre-rendered PNG hillshade, not raw heights. Raw `swissALTI3D` rasters are downloadable as files only.
* **Slovakia (ZBGIS)** , DMR (terrain) is available as GeoTIFF, but DMP (surface) is only published as cached PNG visualisations.
* **Denmark (Datafordeler DHM)** , WCS GeoTIFF exists but requires a per-user API key / OAuth signup, integration parked until that friction is reduced.

If your country publishes a usable LiDAR HD endpoint (raw float heights via WMS or WCS, CORS-friendly, no per-user authentication) and you'd like to see it integrated, open an issue. The provider plug-in shape is documented in [ARCHITECTURE.md](./ARCHITECTURE.md) (`helios-lidar.ts` interface + `./helios-lidar/providers/` registry).

Out of coverage the card still renders shadows from OpenFreeMap building footprints, so the visual works worldwide, the LiDAR layer is a precision upgrade where available.

---

## Technical stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | [Lit](https://lit.dev/) 3, TypeScript |
| **Mapping** | [MapLibre GL JS](https://maplibre.org/) 5 + [OpenFreeMap](https://openfreemap.org/) vector tiles (free, no key, OpenMapTiles schema) |
| **GeoTIFF** | [geotiff.js](https://github.com/geotiffjs/geotiff.js) for parsing the Float32 LiDAR rasters from UK / ES / NL / NO providers |
| **Weather data** | [Open-Meteo API](https://open-meteo.com/) (free, no key) |
| **Solar math** | NOAA-validated (mean altitude error 0.30°, mean azimuth error 0.36°) |
| **Build** | Vite 5 |

---

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # strict TS
npm run build      # produces dist/helios.js
```

Source layout:

| File | Purpose |
| :--- | :--- |
| `src/helios-card.ts`        | Top-level Lit card, render(), state, lifecycle |
| `src/helios-card-css.ts`    | Card styles |
| `src/helios-config.ts`      | Visual editor + color picker + config helpers |
| `src/helios-engine.ts`      | MapLibre orchestration, layers, projections |
| `src/helios-buildings.ts`   | Self-sourced building tile fetch + radius / cluster filter |
| `src/helios-shadows.ts`     | Ground-projected shadow polygons (flat-opacity raster pipeline) |
| `src/helios-lidar.ts`       | `LidarSource` interface + provider registry |
| `src/helios-lidar/helios-lidar-pipeline.ts` | Shared height-raster → shadow-polygon pipeline (flood fill + convex hull) |
| `src/helios-lidar/helios-lidar-geotiff.ts`  | Float32 GeoTIFF fetch + decode + DSM-DTM math helpers |
| `src/helios-lidar/providers/` | One file per country (`helios-lidar-fr.ts`, `-uk`, `-es`, `-nl`, `-no`) |
| `src/helios-sun.ts`         | Solar position + Haurwitz / Kasten-Czeplak math |
| `src/helios-weather.ts`     | Open-Meteo multi-model fetch + cache |
| `src/i18n/`                 | 8-locale strict-typed translations (en/fr/de/es/it/nl/pt/no) |

---

## Credits & data sources

HELIOS depends on several open data services. None require an account or API key.

* **[OpenFreeMap](https://openfreemap.org/)** — free vector basemap tiles + styles (Liberty, Positron, Dark) built from OpenStreetMap data via the OpenMapTiles schema. The buildings, labels and the basemap itself all come from here. Big thank you to the OpenFreeMap project for hosting a public, no-key, no-rate-limit instance — without it, HELIOS would still be hostage to a paid map provider.
* **[OpenStreetMap](https://www.openstreetmap.org/copyright)** — the underlying map data behind every OpenFreeMap tile. © OpenStreetMap contributors.
* **[Open-Meteo](https://open-meteo.com/)** — weather forecasts (cloud cover, irradiance, etc.). Free, no key, multi-model fusion under the hood.
* **National LiDAR providers** — IGN (France), Environment Agency (England), IGN España (Spain), PDOK (Netherlands), Kartverket (Norway). See [LiDAR coverage](#lidar-coverage) for the per-country credits.
* **[MapLibre GL JS](https://maplibre.org/)** — the WebGL map engine that draws every frame.
* **[geotiff.js](https://github.com/geotiffjs/geotiff.js)** — GeoTIFF Float32 decoder used by the UK / ES / NL / NO LiDAR providers.

---

## About me

I build bridges between data and reality. To me, development is more than a profession; it is the tool I have used since childhood to try and decode the complexity of the world around us. I learn every day, fully aware that total understanding is an infinite horizon I will likely never reach, but the journey is worth it.

---

## Support my work

If you find this project useful and want to support its development, feel free to buy me a coffee (or another battery ;-))!

<a href="https://www.buymeacoffee.com/reikanysora"><img src="https://img.buymeacoffee.com/button-api/?text=+1 W/m² of motivation&emoji=☀️&slug=reikanysora&button_colour=5F7FFF&font_colour=ffffff&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00" /></a>

---

## License

This project is licensed under the MIT License, see the [LICENSE](LICENSE) file for details.
