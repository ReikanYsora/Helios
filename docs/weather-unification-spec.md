# Weather, irradiance and production: single source of truth

Reference spec for the shared weather pipeline. The card (TypeScript) and the
Helios-Forecast integration (Python) cannot share code, so they duplicate it;
this document is the contract that keeps the two implementations identical, and
the golden vectors are what prove it.

## Goal

What the card *shows* (the Weather effects: sun, cloud, rain, snow) must be
physically consistent with what the graphs *chart* (irradiance, production). One
weather pipeline feeds both. The only thing that may differ between "live/scene"
and "forecast" is the time horizon (measured past vs modelled future), never the
physics, the cloud metric, the model selection, or the interpolation.

## Locked decisions

- **A. Model selection: multi-model median**, via `pickModelsForLocation`
  (regional high-res model + ECMWF global, median fused per hour; `best_match`
  only at "standard" precision). The integration drops `best_match` for the
  forecast values and adopts this exact picker. (This reverses the earlier
  best_match move: we trade agreement with the Open-Meteo app for the better
  measured accuracy of the regional-median.)
- **B. Cloud cover: weighted layers.**
  `cloudEffective = min(100, low + 0.6*mid + 0.2*high)` from
  `cloud_cover_low/mid/high`. Low cloud attenuates far more than high cirrus, so
  this is the metric that best ties the depicted sky to the actual irradiance.
  Both sides fetch the three layers.
- **C. Irradiance stays GHI (horizontal); production is the tilted model.**
  The `W/m2` irradiance figure is a horizontal ground value (matches
  `shortwave_radiation` and a real pyranometer / the sensor override). Production
  (W) uses the full plane-of-array transposition + thermal + snow, the *same*
  model live and in forecast.

## Canonical pipeline

### 1. Open-Meteo request contract

- Endpoint `https://api.open-meteo.com/v1/forecast`, `timezone=UTC`, no unit
  params (defaults: W/m2, degC, snow depth in metres), coordinates rounded to the
  cache-key precision before building the URL. `elevation=` (the home's altitude)
  is sent for sharper boundary conditions; both sides send the identical value.
- `models=` from `pickModelsForLocation(lat, lon, precision)`. Per-hour fusion is
  the **median** of the finite model values (median of one = the value). The one
  exception is the categorical `weather_code`: a median of WMO codes is
  meaningless, so it takes the first reporting model's code.
- Hourly variables the **card** fetches: `shortwave_radiation_instant`,
  `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high`, `precipitation`,
  `snowfall`, `weather_code`, `temperature_2m`, `relative_humidity_2m`. The
  **integration** additionally fetches `direct_radiation` / `diffuse_radiation`
  (and `wind_speed_10m`, `snow_depth`) for its tilted production model; the card
  does not, since it shows GHI irradiance only and reads production from the
  forecast (see the Correction below).
- Missing-value fill: cloud -> 0, shortwave (and the integration's direct /
  diffuse) -> -1 sentinel (means "no model value, fall back"), precip/snowfall ->
  0, temp/humidity -> NaN.
- Transient handling: retry an empty / non-200 payload; per-request timeout; on
  failure reuse the last-good series rather than blanking. HTTP 429 arms a
  back-off.

### 2. Cloud cover

`cloudEffective(i) = min(100, clamp(low_i) + 0.6*clamp(mid_i) + 0.2*clamp(high_i))`
with each layer clamped to `[0, 100]` before weighting.

### 3. Sun position

Already unified and parity-tested. Simplified declination + equation-of-time
model, hour angle normalised to `[-180, 180]`. Altitude and azimuth in degrees,
azimuth clockwise from north. (card `core/time/sun.ts::getSunPosition`,
integration `solar/geometry.py::sun_position`.)

### 4. Irradiance (GHI, horizontal, W/m2)

Tiered, highest available wins:

1. **sensor** - a wired `W/m2` entity at the home (live/past only; scrubbing the
   future falls through).
2. **shortwave** - `shortwave_radiation_instant` from the model, when `>= 0`.
3. **haurwitz** - analytical clear-sky, always available:
   - `cosZ = sin(altitude)`, night (`altitude <= 0`) -> 0.
   - `ghiClear = 1098 * cosZ * exp(-0.059 / cosZ)` (Haurwitz 1945).
   - `kCloud = 1 - 0.75 * cc^3.4` with `cc = cloudEffective/100`
     (Kasten-Czeplak 1980).
   - `ghi = max(0, ghiClear * kCloud)`.

### 5. Production (plane-of-array, per orientation, % of STC -> W)

Per co-oriented panel group, then summed with per-array inverter caps.

- Effective GHI: supplied `ghi` (shortwave) when present, else `ghiClear*kCloud`.
- Fixed / tracker geometry: dual-axis -> `beta = 90 - alt`, `az = sunAz`;
  single-axis-h -> `beta = 90 - alt`; single-axis-v -> `az = sunAz`.
- Transposition (Liu-Jordan isotropic sky):
  - `cosTheta = sin(alt)*cos(beta) + cos(alt)*sin(beta)*cos(sunAz - az)`.
  - `rB = cosTheta>0 ? max(0,cosTheta)/max(0.087, cosZ) : 0`.
  - direct fraction: from real `direct/diffuse` when both supplied
    (`direct/(direct+diffuse)`), else cloud-derived
    `clamp(0..0.85, (kCloud-0.25)/0.75 * 0.85)`.
  - `directPoa = ghi*directFrac*rB` (0 when shaded),
    `diffusePoa = ghi*(1-directFrac)*(1+cos beta)/2`,
    `groundPoa = ghi*0.2*(1-cos beta)/2`.
  - **preferred POA**: Open-Meteo GTI when supplied, else the sum above.
- `pStc = poa/1000` (fraction of STC).
- Thermal derate (when air temp finite): NOCT cell model
  `Tcell = Tair + (44-20)/800*poa - 1.5*wind`, derate
  `max(0.6, 1 + (-0.0035)*(Tcell-25))`.
- Snow derate: depth `< 0.01 m` -> 1; else melt ramp over `0..4 degC`, floor 0.1.
- Horizontal panel (`tilt<=0`, no tracker): POA = GHI (shaded flat keeps ~25%).
- Watts: `pct * kWp * 10 * snow`, clipped at the array cap, summed, then the
  entry inverter cap.

### 6. Time resolution and interpolation

Both sides resolve a weather sample at an arbitrary instant the **same** way:
linear interpolation between the two bracketing hourly samples (moving cursor,
ascending time), guarding missing / negative irradiance fields. The **effective
cloud cover is recomputed from the interpolated layers** (via `cloudEffective`),
never interpolated directly: the `min(100)` clamp makes it a non-linear function
of the layers, so a separately-interpolated effective drifts from the layers once
the clamp bites. Categorical fields (`weather_code`, precip, snowfall) take the
nearer hour instead of blending. Irradiance and production are then evaluated at
that interpolated sample.

## Parity discipline

- One set of **golden vectors**: (instant, lat, lon, cloud layers, shortwave,
  direct, diffuse, temp, wind, snow, panel) -> (sun, ghi, poa%, watts). Stored
  once, replayed by both the TypeScript tests and the Python tests.
- Any change to a formula, constant, cloud weight, model set or interpolation
  edits the spec, regenerates the golden vectors, and updates both sides in the
  same change. Neither side edits the physics alone.

## Status (implemented)

Integration:
- [x] Forecast values now use `pick_models_for_location` (regional + global,
      median) instead of `best_match`; fetch the three cloud layers and fuse the
      weighted `cloud_effective`; irradiance variables switched to their `_instant`
      form. (`openmeteo.py`.)
- [x] The whole GTI supply chain is removed: the forecast self-transposes (Liu-
      Jordan from GHI + direct/diffuse) exactly like the card model, so the raw
      forecast and the residual learning stay consistent. The `poa_wm2` branch of
      the pure model is kept (parity fixtures exercise it, identical to the card).

Card:
- [x] Scene weather now linearly interpolates the continuous fields between the
      bracketing hours (`weather-resolve.ts`), matching the forecast, with the
      same -1 / NaN guards.
- [x] The effective cloud cover is recomputed from the interpolated layers via a
      single shared `cloudEffective` (`weather.ts`), so the per-hour precompute and
      the at-instant resolve can no longer diverge under the `min(100)` clamp.
- [x] `weather_code` is fused by first-reporting model, not median-averaged (a
      median of WMO codes is meaningless).
- [x] The simple `computePvPower` is renamed `computePvPercent` (it returns a
      GHI-derived irradiance %, and the old name collided with the integration's
      tilted `compute_pv_power`).

## Correction: the card has no production model to unify

The audit first framed a card "production tiltée" step. Tracing every call site
showed that was wrong: `computePvPercent` / `computeIrradianceWm2` only feed the
scene's irradiance (the arc W/m2 label, the timeline irradiance curve fallback) -
which per decision C stays **GHI horizontal**, so it is already correct. The card
does **not** model per-panel production in watts: production the user sees is
**measured** (recorder, `pv.ts`) plus the **forecast** it reads from a provider
(the Helios-Forecast integration or HA's generic solar forecast, via
`energy-forecast.ts`). So there is nothing on the card to transpose, and it never
needed `direct` / `diffuse` in `weather.ts`.

Resolved architecture questions:
1. **Where production is computed for the card.** It is not: the card consumes
   the integration's (or generic) forecast series; only the integration runs the
   physical model.
2. **GTI vs self-transposition.** Self-transposition, both nominally identical -
   the card model has always self-transposed; the integration now matches it (GTI
   dropped).
3. **Integration refinements** (learned residual, analog blend, uncertainty band)
   stay integration-only; they wrap the shared physical model without changing it,
   so the raw physical curve remains the parity anchor.
