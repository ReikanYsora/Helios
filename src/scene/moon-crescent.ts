//Moon crescent shape: the illuminated region of the disc as a point-sampled SVG path. Sampling sidesteps the `A`
//command's sweep/large-arc flag ambiguity at no drawing cost.
//
//Local frame: origin at the disc centre, "lit" direction is +X. moonCrescentPath rotates the sampled local points
//so +X faces the given lit direction, then translates to the disc's actual centre.

//Local-frame boundary of the illuminated region: the true circle edge on the lit half, then the terminator (an
//ellipse of horizontal radius r*|1-2f|) back on the other half. At f=0 both halves coincide (zero-area, no visible
//crescent); at f=0.5 the terminator degenerates to the straight diameter (an exact half-disc); at f=1 the
//terminator becomes the true far edge (a full circle). Exported for tests.
export function moonCrescentLocalPoints(r: number, fraction: number, samples = 24): [number, number][]
{
    const f  = Math.max(0, Math.min(1, fraction));
    const rx = r * Math.abs(1 - 2 * f);
    //Terminator bulges toward the lit side (+X) for a crescent (f < 0.5, same side as the true edge it is cutting
    //into), and toward the dark side (-X, the true far edge's own side) for a gibbous moon (f > 0.5).
    const s = f < 0.5 ? 1 : -1;

    //Both curves are sampled at a uniform ANGLE, not a uniform y: a circle sampled evenly in y turns into long
    //straight chords at its top and bottom (where x changes fastest per unit y), which reads as a faceted
    //boundary exactly where a gibbous moon's lit region hugs the rim.
    const pts: [number, number][] = [];
    for (let i = 0; i <= samples; i++)
    {
        const t = Math.PI * (i / samples);
        pts.push([r * Math.sin(t), -r * Math.cos(t)]);
    }
    //The terminator shares its two end points (top and bottom of the disc) with the true edge just traced, so it
    //runs strictly between them: no duplicated vertex at either seam.
    for (let i = 1; i < samples; i++)
    {
        const t = Math.PI * (i / samples);
        pts.push([s * rx * Math.sin(t), r * Math.cos(t)]);
    }
    return pts;
}

//SVG path for the illuminated region, in the disc's actual screen position, lit toward (litDx, litDy) (need not be
//normalised). Falls back to +X when the direction is degenerate (e.g. the sun sits exactly on the moon, only
//possible right at new moon, where the crescent is invisible anyway so the choice is moot).
export function moonCrescentPath(
    cx: number, cy: number, r: number, fraction: number, litDx: number, litDy: number, samples = 24,
): string
{
    const len = Math.hypot(litDx, litDy);
    const ux = len > 1e-6 ? litDx / len : 1;
    const uy = len > 1e-6 ? litDy / len : 0;

    const pts = moonCrescentLocalPoints(r, fraction, samples);
    const d = pts.map(([x, y], i) =>
    {
        const sx = cx + x * ux - y * uy;
        const sy = cy + x * uy + y * ux;
        return `${i === 0 ? 'M' : 'L'} ${sx.toFixed(2)},${sy.toFixed(2)}`;
    });
    return `${d.join(' ')} Z`;
}
