//Regression test for the hand-rolled MVT decoder against a real OpenFreeMap z14 tile (a slice of La Defense, so it
//carries tall towers with real render_height). The fixture is stored gzipped exactly as OFM serves it; the browser
//decompresses via Content-Encoding, so the test gunzips first to feed the decoder the raw protobuf it expects.

import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, it, expect } from 'vitest';
import { decodeVectorTile } from '../src/engine/mvt';

const here = dirname(fileURLToPath(import.meta.url));
const tile = new Uint8Array(gunzipSync(readFileSync(join(here, 'fixtures', 'ofm-tile-z14.pbf'))));

describe('decodeVectorTile', () =>
{
    const layers = decodeVectorTile(tile);

    it('decodes every layer without desync', () =>
    {
        expect(layers.length).toBeGreaterThan(0);
        expect(layers.map((l) => l.name)).toContain('building');
    });

    it('reads building polygons with real render heights', () =>
    {
        const building = layers.find((l) => l.name === 'building')!;
        expect(building.extent).toBe(4096);
        expect(building.features.length).toBeGreaterThan(0);

        //Every feature is a polygon (type 3) with at least one ring of >= 3 vertices.
        for (const f of building.features)
        {
            expect(f.type).toBe(3);
            expect(f.rings.length).toBeGreaterThan(0);
            expect(f.rings[0].length).toBeGreaterThanOrEqual(3);
        }

        //La Defense towers: at least one building tags a height well above a house.
        const heights = building.features
            .map((f) => f.tags.render_height)
            .filter((h): h is number => typeof h === 'number');
        expect(heights.length).toBeGreaterThan(0);
        expect(Math.max(...heights)).toBeGreaterThan(20);
    });

    it('keeps tile-local coordinates inside a sane range', () =>
    {
        const building = layers.find((l) => l.name === 'building')!;
        //Buffered vertices sit slightly outside [0, extent]; allow a generous margin but reject a desynced decode
        //that would produce wild integers.
        for (const [x, y] of building.features[0].rings[0])
        {
            expect(x).toBeGreaterThan(-2048);
            expect(x).toBeLessThan(6144);
            expect(y).toBeGreaterThan(-2048);
            expect(y).toBeLessThan(6144);
        }
    });
});
