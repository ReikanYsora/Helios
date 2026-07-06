# Refactor plan, 2026.8.0

Working plan for the 2026.8.0 architecture refactor. This is the roadmap we
execute against; `ARCHITECTURE.md` is updated to match once each pass lands.

Goal: dissolve the two god files (`helios-card.ts` 3362 lines, `helios-engine.ts`
1971 lines) into a typed data layer, self-contained view controllers, and a
shared render kit, without a big-bang rewrite. The card stays shippable and
visually identical after every pass.

---

## 1. Diagnosis (why we are doing this)

Six root patterns, found across the whole `src/` tree:

1. **The card is a mutable god-object data bus.** ~90 `@state` fields; every
   `card/*` helper takes `host: HeliosCard` and mutates its state directly.
   Per-source state comes in hand-synced triads (`series` / `fetchKey` /
   `fetching`), repeated ~8 times.
2. **Mega-methods.** `render()` = 1126 lines, `updated()` = 252 lines with 8
   gate blocks whose ordering is load-bearing but implicit.
3. **The clock/trend dial is a sub-application trapped in the card** (~1000
   lines: 15 cross-invariant fields, 3 rAF loops, hit-test, 4 near-duplicate
   tooltips), plus `energy-clock.ts` (1055 lines) mixing aggregation + geometry
   + hit-test + formatting.
4. **The data/WebSocket layer is ad hoc and untyped.** `hass: any` everywhere;
   7 independent module caches each re-implementing key/TTL/inflight; no
   cancellation of in-flight WS requests (stale-window races on mode switch);
   timeout != abort; 2 unwrapped `callWS`; reactivity fans out from `hass`
   identity, not entity relevance (no `subscribeEntities`).
5. **Duplicated geometry/color/domain across the card/engine line.** The
   extruded-prism painter written twice with divergent cull and depth-sort;
   hex-blend twice; the consumption identity `P + import - export - battery,
   clamp 0` four times.
6. **Ownership is split, not layered.** The engine is created in `card/init.ts`,
   torn down half in the card half in the engine, and `paintClock` reaches
   through `_engine._renderer.camera`, bypassing the engine's public API.

The one good existing seam: the `XxxHost` structural interfaces already decouple
each module from the card *class*. They just point at a god-object bag today.

---

## 2. Target architecture (three pillars)

### Pillar 1, typed data layer

- **`HaGateway`**: the single typed boundary over `hass`. All `callWS`,
  `subscribeEntities`, and `states` reads go through it. Replaces `hass: any`
  with `HomeAssistant`. Carries the timeout + concurrency semaphore (from
  `ws-timeout`) AND real `AbortController` cancellation.
- **`RequestCache<K, V>`**: one cache abstraction (key + TTL + inflight dedup +
  abort). Replaces the 7 ad-hoc module caches; one policy, one prune.
- **`EnergyStore`**: single owner of every energy series, keyed and cancellable.
  Switching window/mode aborts the in-flight fetch of the old window instead of
  letting it resolve and overwrite. Each source (`pv`, `grid`, `battery`,
  `irradiance`, `custom`) is a small unit over a shared `SourceBase` that owns
  the common fetch-key gate, now-anchor quantisation, and multi-source
  aggregation (kills the quartet duplication).
- **Weather ingress folds in.** The engine's separate weather fetch loop moves
  onto the same gateway/cache/cancellation discipline, ending the split brain.

### Pillar 2, reactive view controllers

Lit `ReactiveController`s, each self-contained (its own state, rAF loop,
hit-test, teardown), attached to the card host:

- **`DataController`** wraps `EnergyStore` and requests host updates on change.
- **`SceneController`** owns the engine handle, camera, and scene lifecycle, and
  exposes projection through a clean API (no more `_renderer.camera`
  reach-through).
- **`ClockController`** absorbs the trapped clock/trend sub-application.
- **`TimelineController`** owns scrub state, the tick, and pointer handling.

The card becomes a thin composition root: `render()` delegates to per-view
render modules, `updated()` becomes controller wiring.

### Pillar 3, shared render kit (`core/`)

- **One prism painter** used by both buildings and clock columns (one cull, one
  depth-sort).
- **One color module** (merge `engine/colors.ts` and the color half of
  `card/format.ts`); one hex-blend; `Point` / `pointsAttr` promoted out of the
  color file.
- **One consumption identity** helper.
- **`SceneCamera` promoted to `core/camera`** as the shared spine, exposed via a
  clean API.

---

## 3. Target module tree (direction, not final)

```
src/
  core/            # shared, framework-agnostic, pure where possible
    camera/        # projection + SceneCamera (the one spine)
    render-kit/    # prism painter, color/hex, point/pointsAttr, consumption-identity
    format/        # number/time/unit formatting (pure part of today's format.ts)
    theme/         # color/theme-token resolution (the DOM-touching half, split out)
    time/          # timezone, sun-zones, sun position
    config/        # helios-config + constants
    i18n/
  data/            # the typed data layer
    ha-gateway.ts
    cache.ts
    energy-store.ts
    sources/       # pv, grid, battery, irradiance, custom over SourceBase
    weather.ts
    forecast.ts
  scene/           # 3D scene feature (renderer, buildings, shadows)
  clock/           # clock + trend dial feature
  timeline/        # timeline feature
  charts/          # chart rendering
  hud/             # scene HUD
  editor/          # config editor
  controllers/     # SceneController, ClockController, TimelineController, DataController
  helios-card.ts   # thin composition root
```

---

## 4. Pass plan (each pass ships, low risk first)

Every pass ends green (`npm run lint`, `npm run build`, tests) and is
visually identical on the dev Docker with real data. We do not start a pass
before the previous one is validated.

**Pass 0, socle (no behaviour change).**
- Extract the shared render kit: one prism painter, one color/hex module, one
  consumption identity, `Point`/`pointsAttr` moved out.
- Introduce `HaGateway` + `RequestCache` and route existing fetches through them
  (behaviour preserved; internal plumbing only).
- Add `SourceBase` and fold the pv/grid/battery/irradiance common shape onto it.
- Output stays byte-identical where possible. Ship.

**Pass 1, data layer.**
- Consolidate all fetching into `EnergyStore` on top of gateway + cache.
- Add in-flight cancellation on window/mode switch.
- Fold weather ingress into the same discipline.
- Evaluate and (if validated) adopt `subscribeEntities` for the live-chip
  entities, so reactivity keys on relevant entities, not every `hass` push.
- Ship.

**Pass 2, controllers.**
- Extract `ClockController` (the biggest win), then `TimelineController`, then
  `SceneController`, out of the card. Card shrinks after each.
- `updated()` becomes controller wiring; `render()` delegates to view modules.
- Ship after each controller.

**Pass 3, tree by feature.**
- Move files into the feature tree above; thin the card to a composition root.
- Update `ARCHITECTURE.md`. Ship.

---

## 5. Decision points (need your call)

1. **No new runtime dependency.** Build on Lit's `ReactiveController`, hand-roll
   the tiny observable store. Keeps the ESLint-mirror-of-HA discipline and adds
   no bundle weight. Recommended: yes.
2. **`subscribeEntities` in Pass 1.** Real improvement (react to relevant
   entities, not every global state change), but it changes the reactivity model
   and is the riskiest data change. Recommended: yes, but gated behind careful
   Docker testing, and reversible on its own.
3. **Camera to `core/camera`.** Fixes the `_renderer.camera` reach-through by
   exposing projection through `SceneController`. Recommended: yes.

---

## 6. Stretch goal, deferred within 2026.8.0

- **Drop CARTO (basemap provider).** In line with the "fewer external third
  parties" direction, retire the CARTO basemap later in the cycle (candidate:
  serve the basemap from OpenFreeMap, already used for buildings). Not part of
  the socle passes; scheduled once the refactor spine is in place.

---

## 7. Guardrails

- The card renders identically (scene, HUD, clock, trend, timeline, charts) with
  real data after every pass; verified on the dev Docker.
- No functional regression to the "measured values only / 100% Energy dashboard"
  doctrine: live chips need a live power sensor, curves/totals come from kWh
  meters, nothing derived.
- `npm run lint` + `npm run build` + tests green at the end of every pass.
- No pass left half-done on the branch: each is a self-contained, revertible unit.
