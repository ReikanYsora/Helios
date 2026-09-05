import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { groundPoolKey, offerGround, takeGround, disposeGround, parkedGroundKey } from '../src/scene/ground-pool';
import type { VectorGround } from '../src/scene/ground-render';

//A ground as the pool sees it: a canvas with a size to empty and two nodes to detach.
function fakeGround(): VectorGround & { removed: number }
{
    const g = { removed: 0 } as VectorGround & { removed: number };
    const el   = { width: 2816, height: 2816, remove: () => { g.removed++; } } as unknown as HTMLCanvasElement;
    const fade = { remove: () => { g.removed++; } } as unknown as HTMLDivElement;
    g.ground = { el, fade, homeX: 1408, homeY: 1408, size: 2816 };
    g.repaint = () => undefined;
    g.repaintProjected = () => undefined;
    return g;
}

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
        expect(takeGround(groundPoolKey(44.7, -1.2, false))).toBeNull();
        const got = takeGround(key);
        expect(got?.built).toBe(g);
        expect(got?.styleKey).toBe('style-a');
        expect(takeGround(key)).toBeNull();
        expect(g.ground.el.width).toBe(2816);
    });

    it('keeps one spare: a second offer disposes the first, emptying its canvas', () =>
    {
        const key = groundPoolKey(1, 2, false);
        const a = fakeGround();
        const b = fakeGround();
        offerGround(key, 's', a);
        offerGround(key, 's', b);
        expect(a.ground.el.width).toBe(0);
        expect(a.ground.el.height).toBe(0);
        expect(a.removed).toBe(2);
        expect(takeGround(key)?.built).toBe(b);
        expect(b.ground.el.width).toBe(2816);
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
        expect(g.ground.el.width).toBe(0);
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
        expect(g.ground.el.width).toBe(2816);
        expect(takeGround(key)?.styleKey).toBe('t');
    });

    it('disposeGround empties the canvas and detaches both nodes', () =>
    {
        const g = fakeGround();
        disposeGround(g);
        expect(g.ground.el.width).toBe(0);
        expect(g.removed).toBe(2);
    });
});
