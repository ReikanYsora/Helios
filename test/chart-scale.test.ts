import { describe, it, expect } from 'vitest';
import { CHART_W, CHART_H, CHART_TOP_HEADROOM_PX, makeXOf, makeYOf } from '../src/charts/chart-scale';

//The projection both bottom charts share. makeYOf unifies every former yOf variant: the target chart's
//(yMin, yMax), the PV chart's (0, yMax), the cloud percent (0, 100) and the forecast (0, fMax).

describe('makeXOf', () =>
{
    it('maps the range start/mid/end across the full viewBox width', () =>
    {
        const xOf = makeXOf(1000, 2000); //startMs 1000, rangeMs 2000
        expect(xOf(1000)).toBe(0);
        expect(xOf(2000)).toBe(CHART_W / 2);
        expect(xOf(3000)).toBe(CHART_W);
    });
});

describe('makeYOf', () =>
{
    it('puts the max at the top (with headroom) and the min at the baseline', () =>
    {
        const yOf = makeYOf(0, 100);
        expect(yOf(0)).toBe(CHART_H);                       //baseline
        expect(yOf(100)).toBe(CHART_TOP_HEADROOM_PX);       //top edge minus headroom
        expect(yOf(50)).toBe(CHART_H - 0.5 * (CHART_H - CHART_TOP_HEADROOM_PX));
    });

    it('supports a signed floor (temperature) via yMin', () =>
    {
        const yOf = makeYOf(-10, 10);
        expect(yOf(-10)).toBe(CHART_H);
        expect(yOf(10)).toBe(CHART_TOP_HEADROOM_PX);
        expect(yOf(0)).toBe(CHART_H - 0.5 * (CHART_H - CHART_TOP_HEADROOM_PX));
    });

    it('clamps values outside [yMin, yMax] to the baseline / top', () =>
    {
        const yOf = makeYOf(0, 100);
        expect(yOf(150)).toBe(CHART_TOP_HEADROOM_PX); //clamped to top
        expect(yOf(-50)).toBe(CHART_H);               //clamped to baseline
    });
});
