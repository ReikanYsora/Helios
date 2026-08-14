import { defineConfig } from 'vitest/config';

//Test runner config, kept separate from vite.config.ts (the HACS bundle build). __HELIOS_VERSION__ is inlined by the
//build's `define`; mirror it here so any module that reads it imports cleanly under test. Pure logic runs in the node
//environment; suites that touch the DOM opt into jsdom per-file with a `// @vitest-environment jsdom` header.
export default defineConfig({
    define:
    {
        __HELIOS_VERSION__: JSON.stringify('test'),
    },
    test:
    {
        environment: 'node',
        include:     ['test/**/*.test.ts'],
    },
});
