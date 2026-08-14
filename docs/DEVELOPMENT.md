# Development

Building Helios from source, and where everything lives. For how the subsystems
fit together, see [ARCHITECTURE.md](../ARCHITECTURE.md).

---

## Build

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # strict TS
npm run lint       # eslint
npm run test       # vitest
npm run knip       # unused files / exports / dependencies
npm run build      # produces dist/helios.js
```

The card is TypeScript-first and fully self-contained, a single `helios.js` bundle whose only runtime dependencies are Lit and polygon-clipping, both bundled in.

## Source layout

| Path | Purpose |
| :--- | :--- |
| `src/helios-card.ts`            | Top-level Lit element: render orchestrator + HA + Lit lifecycle |
| `src/core/config/helios-config.ts` | `HeliosConfig` schema + resolver helpers (radius, monitoring groups, colours, ...) |
| `src/core/config/constants.ts`  | Defaults / bounds, cache TTLs, camera limits, colour + math constants |
| `src/core/format/format.ts`     | Locale-aware number / value formatting + energy colour tokens |
| `src/core/time/`                | Solar position + clear-sky irradiance (`sun.ts`), home-timezone maths (`timezone.ts`) |
| `src/core/render-kit/`          | Shared drawing kit: hex blending + tints (`colors.ts` / `hex.ts`), projection geometry (`geometry.ts`) |
| `src/core/nearest-series.ts`    | Time-keyed sample series: build / equals / nearest-neighbour lookup (sensor + weather overrides) |
| `src/core/ha-types.ts`          | Minimal structural `HassLike` type: the fields the card reads off `hass` |
| `src/core/i18n/`                | Strict-typed translations (`index.ts` + `locales/`, 27 languages) |
| `src/core/energy.ts`            | Home-consumption balance (the energy dashboard's definition) |
| `src/scene/helios-engine.ts`    | Engine lifecycle: weather / buildings fetch, sun + shadow refresh, camera + auto-rotate |
| `src/scene/renderer.ts`         | Scene painter: ground tilt + buildings + shadows, graded through the day/night cycle (canvas + SVG) |
| `src/scene/projection.ts`       | 2.5D camera + bearing / pitch / perspective projection |
| `src/scene/ground-render.ts` `ground-vector.ts` `tiles.ts` | Vector ground renderer (OpenFreeMap layers, themeable) + Web Mercator math |
| `src/scene/buildings.ts` `openfreemap.ts` `vector-tile.ts` | OpenFreeMap fetch + interpret (radius / count / height / cluster) |
| `src/scene/sun-arc.ts`          | Sun-arc + irradiance geometry (Haurwitz / Kasten-Czeplak, PV math) |
| `src/scene/day-curve.ts`        | Day curve geometry: the shared sun ground track, per-strand splines, the depth split, risers and beads |
| `src/scene/weather-fx.ts`       | "Your real sky" overlay: per-layer strengths + the rain / snow / storm particle canvases |
| `src/scene/hud-layout.ts`       | Chip-cluster layout |
| `src/hud/scene-hud-controller.ts` `hud.ts` `hud-geometry.ts` | Scene HUD projection (sun arc, chips, leaders) refreshed each frame |
| `src/hud/detail-panel.ts`       | Per-chip detail panel: window aggregates (total / peak / avg, astro) as icon rows |
| `src/data/unifiedStore.ts`      | Rolling-window data store: one bucketised source of truth for every graph |
| `src/data/period-totals/`       | Hour-of-day aggregation: the detail panel's period totals + the day curve's one-day profile |
| `src/data/source-fetch.ts` `series-sample.ts` `request-cache.ts` `durable-cache.ts` `ha-gateway.ts` | Fetch orchestration, sampling, and caching layers |
| `src/data/energy-forecast.ts`   | HA solar-forecast fetch + merge |
| `src/data/weather.ts` `weather-resolve.ts` | Open-Meteo multi-model fetch + cache + back-off (cloud, irradiance) |
| `src/data/sources/energy-prefs.ts` | HA Energy dashboard subscription + slot resolution (PV / grid / battery / forecast) |
| `src/data/sources/energy-stats.ts` | Recorder `change`-metric helpers (buckets to watts) |
| `src/data/sources/pv.ts` `battery.ts` `grid.ts` | Per-source live + history (power, SoC, import / export) |
| `src/data/sources/irradiance.ts` | Optional irradiance-sensor override into the engine |
| `src/data/sources/weather-override.ts` | Optional local-sensor overrides for the weather variables (temperature, humidity, cloud, ...) |
| `src/data/sources/cost.ts`      | Cost / compensation resolution: live rate + any-tariff cost statistics for the cost chip |
| `src/data/sources/grid-guard.ts` | Grid import/export guard-hours evaluation |
| `src/data/sources/horizon.ts`   | Terrain horizon profile from Open-Meteo elevation (per-azimuth ridge angle) |
| `src/data/sources/device-consumption.ts` | Per-device meters + monitoring-group membership / colours |
| `src/charts/charts.ts` `charts-pv.ts` `charts-generic.ts` `chart-scale.ts` | Timeline SVG charts + scrub cursors + day labels + tooltip + shared projection |
| `src/timeline/timeline.ts` `timeline-model.ts` `timeline-modes.ts` | Scrub handlers, tick granularity, the rolling-window periods |
| `src/timeline/timeline-overlays.ts` `timeline-tooltip.ts` | Timeline night-zone / future-mask shading + hover tooltip |
| `src/editor/editor.ts`          | Visual editor (accordion sections, sliders, entity / icon / colour pickers, group setup) |
| `src/css/`                      | Card + editor + timeline style literals |

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the subsystem-by-subsystem walkthrough.
