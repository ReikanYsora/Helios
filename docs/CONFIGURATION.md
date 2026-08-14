# Configuration

Every option Helios exposes, in the visual editor and in YAML. For installing the
card and a tour of what it does, see the [README](../README.md). For a live demo
and the guides, see [helios-ha.org](https://helios-ha.org).

---

No API key required. The basemap is rendered in-house from [OpenFreeMap](https://openfreemap.org/) vector tiles (open data, no key) and weather comes from Open-Meteo (also free, no key).

Solar, grid and battery wiring is **not configured per-card**: Helios resolves every entity slot from the **HA Energy dashboard** (`Settings` then `Dashboards` then `Energy`), the same global config the official Energy card reads. Set the slots there once and Helios picks them up automatically. The options below cover only the visual and install-specific bits.

## Where do the numbers come from

Helios follows the energy dashboard at 100% and **never estimates a value**:

* **Live chips** (real-time values in the scene) read the **live power sensors**
  of your energy dashboard sources: the optional "power" field of each source.
  If a source has no live power sensor, its chip is simply not shown, and the
  editor's live-data panel tells you what to add. Nothing is ever derived from
  cumulative meters to fake a "now" value.
* **Curves, scrub and totals** read your **kWh meters** through
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

## Home location

| Key | Type | Default | Description |
|---|---|---|---|
| `home-latitude` | number | HA home | Optional override (decimal degrees). Applied only when **both** lat and lon are set and valid; otherwise the card uses `hass.config`. Useful for a holiday home, a shared install, or several cards each centred on a different place. |
| `home-longitude` | number | HA home | Companion to `home-latitude`. Partial or out-of-range values are ignored. |

## Camera

| Key | Type | Default | Description |
|---|---|---|---|
| `auto-rotate-enabled` | boolean | `false` | Idle camera orbit. Off by default; enable for kiosk / always-on dashboards. Any drag pauses it, then it resumes after a short idle. |
| `camera-pitch-deg` | 0-65 | `50` | Optional fixed pitch at boot. Drag still works unless locked. |
| `camera-bearing-deg` | 0-359 | hemisphere | Optional fixed bearing at boot. |
| `camera-locked` | boolean | `false` | Disable drag-rotate and the idle orbit; the camera stays at the configured pose. Also toggled live from the lock button on the card. |

> The card also remembers the live camera pose, the selected period, the selected chip and the lock per home (or per `cache-id`), so reopening the dashboard restores exactly what you left.

## Interface

| Key | Type | Default | Description |
|---|---|---|---|
| `auto-hide-ui` | boolean | `false` | No UI mode: fade the timeline and the on-card controls after a few seconds of inactivity, bringing them back on any tap or move. For kiosks and wall displays. |

## Buildings + shadows

| Key | Type | Default | Description |
|---|---|---|---|
| `display-radius` | 0-250 m | `200` | Distance around the home within which buildings and shadows render. The main perf lever on older phones. 250 m is as far as the ground under them reaches; 0 draws none. |
| `building-count` | 10-100 | `50` | How many of the nearest buildings to keep around the home. |
| `building-real-size` | boolean | `true` | Extrude buildings to their real OSM heights (capped). When `false`, every building uses the fixed `building-height` prism. |
| `building-height` | 3-10 m | `6` | Fixed prism height used when `building-real-size` is `false`. |
| `building-cluster-radius` | 0-100 m | `0` | Buildings within this distance of the home (or touching it) join the home group at full opacity. Use it to attach garages / verandas to the house. |
| `building-opacity` | 0-1 | `0.5` | Opacity of the surrounding buildings. The home (and its cluster) always stays at full opacity. |
| `building-color` | color | theme | Optional base tone for the surrounding buildings. |
| `shadows-enabled` | boolean | `true` | Master toggle for the cast ground shadows (projected from the building footprints). |
| `shadow-opacity` | 0-1 | `0.32` | Opacity of the cast shadows. |

## Data display

| Key | Type | Default | Description |
|---|---|---|---|
| `display-update-frequency-per-hour` | 1-6 | `4` | Storage + render cadence (buckets per hour) for the data store, every graph and the day curve's own resolution. `4` = 15-minute granularity (the HA Energy bucket size); raise for smoother curves, lower to save memory. Live numeric chips bypass this and stay on the direct `hass.states` path. |
| `value-decimals` | 0-3 | `1` | Decimal places on every kW / kWh / % readout. |
| `power-unit` | `W` \| `kW` | `kW` | Unit for every power readout (chips, tooltips). Energy follows it, so `kW` pairs with `kWh` and `W` with `Wh`. |
| `irradiance-unit` | `W/m²` \| `kW/m²` | `W/m²` | Unit for the solar-constant (irradiance) readout above the sun. |
| `battery-sign` | `default` \| `inverted` \| `hidden` | `default` | Sign shown on the battery chip: `default` (minus charging, plus discharging), `inverted`, or `hidden` (magnitude only). Display-only; flows and history are unchanged. |

The rolling window itself is chosen live from the timeline's period selector (**Forecast**, **Yesterday**, **Today**, **Week**, **Month**) and remembered per card; it needs no YAML key.

## Sensors + colors

| Key | Type | Default | Description |
|---|---|---|---|
| `solar-irradiance-entity` | entity_id | none | Optional physical irradiance sensor (W/m²). When set, its live state + recorder history feed the sun chip number, the irradiance chart and the sun-arc colouring for past + present; forecast hours still come from Open-Meteo. |
| `monitoring-group-names` | map | none | Per-group display name (group number -> name). Set from the editor's monitoring-group section. |
| `monitoring-group-colors` | map | `--graph-color-N` | Per-group colour (group number -> colour). Falls back to Home Assistant's graph colour for that group. |
| `monitoring-group-icons` | map | none | Per-group icon (group number -> MDI icon). With no icon the group shows its number. |
| `hidden-devices` | list | none | Device meters hidden from every view. Managed from the editor's device list (the eye toggle). |
| `chip-home-color` | color | theme | Optional colour for the home pill and its consumption readout. |

## Per-card cache

| Key | Type | Default | Description |
|---|---|---|---|
| `cache-id` | string | auto | A hidden, auto-generated id that keeps each card's saved view (selected period, selected chip, camera, lock) independent, so two cards on the same home do not share state. You normally never touch this. |
