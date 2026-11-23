This is a source modification to the uploaded **Helios 2026.9.6** snapshot, not an
official Helios release. It adds geometryonly lowpoly OBJ house support to the
existing SVG scene.

**A new compiled bundle is not supplied.** This source ZIP deliberately omits the
original `dist/helios.js`, because that file does not contain the new feature.
Build the modified source before installing it.

## Build

Use a development computer with a compatible Node.js version (Node 22.12 is a
suitable baseline for this repository's build dependencies). The repository
dependencies are unchanged and `packagelock.json` is retained.

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

`npm ci` requires access to your npm registry. The build writes the updated
singlefile card to `dist/helios.js`.

## Install in Home Assistant

1. Back up your current dashboard config and resource settings.
2. Copy the **newly built** `dist/helios.js` to
   `/config/www/helioscustomhouse.js`.
3. Change the existing Helios dashboard resource to
   `/local/helioscustomhouse.js?v=customhouse1` (JavaScript module).
   **Do not load both the original and modified Helios bundles**: they register
   the same customelement names.
4. Copy `examples/lowpolyhouse.obj` to
   `/config/www/models/lowpolyhouse.obj`. Create the `models` folder if needed.
5. Add this to your existing card YAML, or use the new controls under Buildings:

```yaml
type: custom:helioscard
housemodelurl: /local/models/lowpolyhouse.obj
housemodelsizem: 12
housemodelupaxis: y
housemodelrotationdeg: 0
```

6. Reload the dashboard, clearing stale frontend cache if necessary.
   Test the sample before replacing it with your own house.
7. To revert just the model, remove `housemodelurl`. To revert this code fork,
   restore the original resource URL and remove the custommodel options.

Installing the modified bundle under `/local/` keeps it separate from HACSmanaged
files, but it will not automatically inherit future upstream Helios updates.

## What changed

 `src/core/config/housemodelconfig.ts`: validated options and defaults.
 `src/core/config/heliosconfig.ts`: public option keys.
 `src/scene/housemodel.ts`: bounded OBJ parser, polygon triangulation, transforms,
  home replacement, and mesh roofheight lookup.
 `src/scene/housemodelloader.ts`: abortable streamed fetch, size cap, timeout,
  staleresponse protection, local transforms, retry/cleanup.
 `src/scene/housemodelrender.ts`: projected flatshaded SVG triangles.
 `src/scene/buildings.ts`: optional mesh on the existing Building type and painter.
 `src/scene/heliosengine.ts`: loading/fallback, live config, energy anchors,
  forecastarray roof heights and cleanup/cache reset.
 `src/scene/arraymarkers.ts`: meshaware mounting heights.
 `src/card/init.ts`: model options included in live visualconfig signatures.
 `src/editor/editor.ts`: model controls in Buildings (initial English labels).
 `test/housemodel*.test.ts`: regression cases for parsing, config, rendering,
  fallback, limits, async races, timeout and teardown.
 `examples/`: a tiny closed Yup gabled house and sample YAML.
 `docs/CONFIGURATION.md`: complete option/export/limitation documentation.

## Validation status

The source was inspected and offline structural/geometryreference checks were
performed during preparation. **Node/npm are not installed in the preparation
environment** and external network access is unavailable, so TypeScript checking,
ESLint, Vitest and the Vite build were **not run**. The added test suites must be
executed on your development machine; no claim of a passed build or live Home
Assistant/browser test is made.

Read [docs/CONFIGURATION.md](docs/CONFIGURATION.md#customhouseobj) for the
supported export subset and shadow/depthorder limitations.

Offline checks completed:

 `git apply check` accepts the supplied patch against the uploaded source.
 Every relative TypeScript import resolves and all seven new option keys occur
  in the schema, visual editor, docs and liveupdate signature.
 A TypeScript lexer reported no error tokens in the changed/new source.
  This is lexical checking, **not** a compiler/type check.
 A separate Python geometry reference verified the sample's 10 vertices /
  16 outward triangles, closed manifold edges, concaveface triangulation,
  pitchedroof heights, and finite projections in 288 camera poses.
  These are reference checks, **not** execution of the TypeScript tests.
 The original license and dependency lock are retained; no energy/datalayer
  files were changed.
