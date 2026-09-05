//A parking place for one painted ground between two renderers. The Home Assistant editor destroys the card and
//creates a fresh one on every setting it changes, and a dashboard reconnects cards on edit-mode wrapping; without
//it each fresh renderer fetches, decodes and paints its own basemap canvases (some 9 MB of backing store across
//the levels of detail, 30 MB before them) while the previous one waits for the garbage collector. The pool holds
//the last released ground for a short while, keyed on what it was built from, so the next renderer at the same
//home adopts it on the spot: the scene shows its map from its first frame, and at most one spare ground is ever
//alive. A ground nobody claims in time is disposed, its canvases emptied so the memory goes back at once rather
//than at the next sweep.

import type { VectorGround } from './ground-render';

//How long a released ground waits for a taker. The editor's rebuilds are seconds apart; a card really gone
//(another view) frees its canvas after this.
const POOL_TTL_MS = 60_000;

interface Parked
{
    key:      string;
    styleKey: string;
    built:    VectorGround;
    timer:    ReturnType<typeof setTimeout>;
}

let _parked: Parked | null = null;

//Identity of a ground: the home it was painted around, the raster path (GPU / CPU) its canvases took, and whether
//it was built as the levels of detail or as the single flat canvas of the projected path.
export function groundPoolKey(lat: number, lon: number, cpuRaster: boolean, flat = false): string
{
    return `${lat.toFixed(6)},${lon.toFixed(6)}|${cpuRaster ? 'cpu' : 'gpu'}|${flat ? 'flat' : 'lod'}`;
}

//Empty every canvas so the browser releases their backing stores now, and take every node out of the tree.
export function disposeGround(built: VectorGround): void
{
    for (const { el } of built.ground.levels)
    {
        el.width  = 0;
        el.height = 0;
        el.remove();
    }
    built.ground.fade.remove();
}

//Hand a ground over for the next renderer. A ground already waiting is disposed: one spare, never a stack.
export function offerGround(key: string, styleKey: string, built: VectorGround): void
{
    if (_parked)
    {
        clearTimeout(_parked.timer);
        if (_parked.built !== built)
        {
            disposeGround(_parked.built);
        }
        _parked = null;
    }
    const timer = setTimeout(() =>
    {
        if (_parked && _parked.built === built)
        {
            _parked = null;
            disposeGround(built);
        }
    }, POOL_TTL_MS);
    _parked = { key, styleKey, built, timer };
}

//Claim the waiting ground if it was built for `key`. `styleKey` tells the taker whether the paint matches.
export function takeGround(key: string): { built: VectorGround; styleKey: string } | null
{
    if (!_parked || _parked.key !== key)
    {
        return null;
    }
    const { built, styleKey, timer } = _parked;
    clearTimeout(timer);
    _parked = null;
    return { built, styleKey };
}

//What is parked right now, for tests and diagnostics.
export function parkedGroundKey(): string | null
{
    return _parked?.key ?? null;
}
