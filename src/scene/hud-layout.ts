//Pure HUD layout ramps: canvas-size -> scale factors for the on-map chip cluster and the sun-arc fallback
//radius. No DOM or engine state; the engine measures the viewport and feeds the smaller side in.

//Linear ramp on the smaller CSS side so the chip cluster expands on a kiosk layout: 1.0 below FLOOR
//(standard grid cell), ramping to `max` at TOP. Used for the horizontal spread (max 1.6) and the steeper
//vertical lift (max 2.4); same FLOOR/TOP breakpoints so the two transitions hinge together.
export function clusterScaleRamp(minDim: number, max: number): number
{
    if (!Number.isFinite(minDim) || minDim <= 0)
    {
        return 1.0;
    }
    const FLOOR = 600;
    const TOP   = 1200;
    if (minDim <= FLOOR)
    {
        return 1.0;
    }
    if (minDim >= TOP)
    {
        return max;
    }
    return 1.0 + (max - 1.0) * (minDim - FLOOR) / (TOP - FLOOR);
}

//Stepped canvas-size ramp for the sun arc, used as a fallback before the map projection is ready so the
//first paint has a sane radius. The dynamic projection-probe scale takes over once projection works.
export function steppedArcScale(minDim: number): number
{
    if (!Number.isFinite(minDim) || minDim <= 0)
    {
        return 1.0;
    }
    const SMALL = 360; const FLOOR = 600; const TOP = 1200; const MIN = 0.72; const MAX = 2.2;
    if (minDim <= SMALL)
    {
        return MIN;
    }
    if (minDim <  FLOOR)
    {
        return MIN + (1.0 - MIN) * (minDim - SMALL) / (FLOOR - SMALL);
    }
    if (minDim >= TOP)
    {
        return MAX;
    }
    return 1.0 + (MAX - 1.0) * (minDim - FLOOR) / (TOP - FLOOR);
}
