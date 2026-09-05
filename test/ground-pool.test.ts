import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { groundPoolKey, offerGround, takeGround, disposeGround, parkedGroundKey } from '../src/scene/ground-pool';
import type { VectorGround } from '../src/scene/ground-render';

//A ground as the pool sees it: level canvases with sizes to empty and nodes to detach, plus the fade disc.
function fakeGround(): VectorGround & { removed: number }
{
    const g = { removed: 0 } as VectorGround & { removed: number };
    const canvas = (size: number): HTMLCanvasElement =>
        ({ width: size, height: size, remove: () => { g.removed++; } } as unknown as HTMLCanvasElement);
    const fade = { remove: () => { g.removed++; } } as unknown as HTMLDivElement;
    g.ground = {
        levels: [
            { el: canvas(700), homeX: 350, homeY: 350, size: 700, scale: 4 },
            { el: canvas(932), homeX: 466, homeY: 466, size: 932, scale: 1 },
        ],
        fade,
        reachPx: 1400,
    };
    g.repaint = () => undefined;
    g.repaintProjected = () => undefined;
    return g;
}
const side = (g: VectorGround, i = 0): number => g.ground.levels[i].el.width;

describe('ground pool', () =>
{
    beforeEach(() => { vi.useFakeTimers(); takeGround(parkedGroundKey() ?? ''); });
    afterEach(() => { vi.useRealTimers(); });

    it('hands a parked ground back to a taker with the same key, once', () =>
    {
        const key = groundPoolKey(44.6, -1.2, false);
        const g = fakeGround();
        offerGround(key, 'style-a', g);
        expect(parkedGroundKey()).toBe(key);
        expect(takeGround(groundPoolKey(44.6, -1.2, true))).toBeNull();
        expect(takeGround(groundPoolKey(44.6, -1.2, false, true))).toBeNull();
        expect(takeGround(groundPoolKey(44.7, -1.2, false))).toBeNull();
        const got = takeGround(key);
        expect(got?.built).toBe(g);
        expect(got?.styleKey).toBe('style-a');
        expect(takeGround(key)).toBeNull();
        expect(side(g)).toBe(700);
    });

    it('keeps one spare: a second offer disposes the first, emptying its canvas', () =>
    {
        const key = groundPoolKey(1, 2, false);
        const a = fakeGround();
        const b = fakeGround();
        offerGround(key, 's', a);
        offerGround(key, 's', b);
        expect(side(a, 0)).toBe(0);
        expect(side(a, 1)).toBe(0);
        expect(a.ground.levels[0].el.height).toBe(0);
        expect(a.removed).toBe(3);
        expect(takeGround(key)?.built).toBe(b);
        expect(side(b)).toBe(700);
    });

    it('disposes a ground nobody claims in time', () =>
    {
        const key = groundPoolKey(1, 2, false);
        const g = fakeGround();
        offerGround(key, 's', g);
        vi.advanceTimersByTime(59_000);
        expect(parkedGroundKey()).toBe(key);
        vi.advanceTimersByTime(2_000);
        expect(parkedGroundKey()).toBeNull();
        expect(side(g)).toBe(0);
        expect(takeGround(key)).toBeNull();
    });

    it('re-offering the same ground restarts its wait without disposing it', () =>
    {
        const key = groundPoolKey(1, 2, false);
        const g = fakeGround();
        offerGround(key, 's', g);
        vi.advanceTimersByTime(50_000);
        offerGround(key, 't', g);
        vi.advanceTimersByTime(50_000);
        expect(side(g)).toBe(700);
        expect(takeGround(key)?.styleKey).toBe('t');
    });

    it('disposeGround empties every level canvas and detaches every node', () =>
    {
        const g = fakeGround();
        disposeGround(g);
        expect(side(g, 0)).toBe(0);
        expect(side(g, 1)).toBe(0);
        expect(g.removed).toBe(3);
    });
});
