import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/*
 * Build configuration for HACS distribution.
 *
 * The output filename MUST match the GitHub repository name
 * (lowercased) for HACS to find it: repo "Helios" → "helios.js".
 * See https://hacs.xyz/docs/publish/plugin/#requirements
 *
 * The bundle is a single ES module dropped into `dist/`. HACS
 * searches `dist/` first, so this layout is what gets shipped.
 *
 * __HELIOS_VERSION__ is inlined from package.json at build time so
 * the bundle can print a single source-of-truth banner to the
 * browser console without a runtime fetch or a duplicated constant
 * to keep in sync with package.json.
 */
export default defineConfig({
    define:
    {
        __HELIOS_VERSION__: JSON.stringify(pkg.version)
    },
    build:
    {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        target: 'es2020',
        lib:
        {
            entry:    'src/helios-card.ts',
            formats:  ['es'],
            fileName: () => 'helios.js'
        },
        rollupOptions:
        {
            //Bundle everything (lit, maplibre-gl, geotiff codecs, ...)
            //into a single file so the user only needs to register one
            //resource URL in Lovelace. No external imports, and no
            //code-splitting either: geotiff dynamically imports its
            //per-format decoders (pako, zstd, lerc, jpeg, lzw, ...),
            //which would normally land in separate chunks.
            //inlineDynamicImports hoists every dynamic import into
            //the main bundle so HACS sees a single helios.js
            //artefact. The Vite 8 deprecation warning is acceptable
            //here, the alternative (`output.codeSplitting: false`)
            //emits multiple chunks which HACS can't serve.
            external: [],
            output:
            {
                inlineDynamicImports: true
            }
        },
        //Trim down build output: minify but keep readable enough for
        //the curious user to inspect. Terser preserves classnames so
        //custom-element registrations remain stable across builds.
        minify: 'terser',
        terserOptions:
        {
            keep_classnames: true,
            keep_fnames:     true
        }
    }
});