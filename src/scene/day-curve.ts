//The day curve: ONE day of a metric, the one being scrubbed, standing round the home on the sun's own ground
//track for that same day. The metric is whatever the caller hands over; nothing here is solar but the track under
//it. Pure geometry + SVG, no card state.
//
//The base is the sun arc projected straight down. That track is NOT a circle: the sun sits at distance
//R x cos(altitude) from the home, so the track closes in at noon, when the sun is overhead, and reaches its
//widest at sunrise and sunset, where the altitude is zero and the arc meets the ground. A constant-radius ring is
//a convention laid over the sky; this IS the sky. Every ground point is where the sun really stood at that moment,
//so the position on the track carries the hour with no clock mapping to agree on, and the southern hemisphere
//needs no mirroring: the real azimuth already runs the other way round.
//
//Each sample rises vertically off its own ground point, so a point on the curve and the sun that stood over it
//share one vertical line. That is what the dashed leader draws.
//
//Depth: the track surrounds the home, so part of it belongs behind the house and part in front. It is cut wherever
//it crosses the plane through the home, and the pieces are handed back as two fragments: the far ones paint before
//the house, the near ones after. The cut moves with the camera, so it is recomputed per frame. Unlike a circle the
//track is not convex, so it may cross that plane more than twice; the split makes no assumption about how many.

import type { SceneCamera } from './projection';
import { DEG, HOUR_MS, DAY_CURVE_HEIGHT_FRAC } from '../core/config/constants';
import { getSunPosition } from '../core/time/sun';
import { serverMsOfDay } from '../core/time/timezone';

//A unit ground direction: the sun's position at one slot, projected down, before the arc radius scales it. Its
//length is cos(altitude), which is what pulls the track inward when the sun climbs.
export interface SunTrackPoint
{
    e: number;
    n: number;
}

//Stroke width at the track's far and near extremes. With no fill left, width IS the depth: the same ribbon the sun
//arc draws itself with, and the same range, so the two read as one scene rather than two conventions.
const CURVE_WIDTH_FAR  = 1.0;
const CURVE_WIDTH_NEAR = 4.0;

//One drawn line of the day: its own values, normalisation and style. The geometry it stands on - the sun's ground
//track, the radius, the sun's place along it and the sweep - is shared by every strand of the same chip and lives
//on DayCurveData, not here. A chip draws one strand (production) or several (grid import + export, battery power +
//SoC, a group's devices).
export interface DayStrand
{
    //One value per slot in the strand's OWN unit; null breaks the line (a slot nothing covered).
    values:    (number | null)[];
    //Which slots are a forecast rather than a reading. PV alone fills this; every other strand is all false.
    predicted: boolean[];
    //This strand's own 100%: the value that rises to full height. Each day passes its OWN peak, so a dull December
    //day reads as clearly as a bright June one and only the SHAPE carries meaning. Shared across a chip's strands
    //where they must be comparable (grid import vs export, a group's devices), and set to 100 for the battery SoC,
    //whose percent then reaches the same top the power peak does.
    peak:      number;
    //Solid colour, or the fallback where segColours leaves a slot null.
    colour:    string;
    //Drawn dashed: the battery SoC, a level rather than a flow.
    dashed?:   boolean;
    //Per-slot colour, for a strand that changes hue along its length (the battery power + SoC, tinted by charge /
    //discharge / idle at each slot). null at a slot falls back to `colour`.
    segColours?: (string | null)[];
}

export interface DayCurveData
{
    //The strands to draw, all standing on the one shared track below. Empty draws nothing.
    strands:  DayStrand[];
    //The sun's ground track for the day on show, one unit vector per slot. Shared by every strand: they all stand
    //on the same day's sun path, only at different heights. Rebuilt as the scrub moves to another day.
    base:     SunTrackPoint[];
    //Fractional slot of the instant on show (live or scrubbed), for the leader down from the sun. null when there
    //is nothing to point at.
    sunSlot:  number | null;
    //The sun arc's ground radius, so the track lands exactly under the arc. Comes from the engine (it owns the arc
    //scale) and moves with the card's size, which is why it travels with the data.
    radiusM:  number;
    //0 .. 1 of the day written on. The day writes itself round from its own midnight, so the sweep IS the day
    //running, not an effect laid over it.
    sweep:    number;
}

//What a caller upstream of the engine can know: everything but the radius, which the engine stamps on from the
//arc scale.
export type DayCurveInput = Omit<DayCurveData, 'radiusM'>;

//The live sun, in degrees, as the renderer holds it.
export interface CurveSun
{
    azimuth:  number;
    altitude: number;
}

//The sun's ground track for the day containing `shownMs`: one unit vector per slot, the sun's position at that
//slot projected straight down. Length is cos(altitude), so the track closes in on the home as the sun climbs and
//reaches its full radius at the horizon, where the arc meets the ground.
//
//`slots` comes from the data (see data/period-totals/day-profile.daySlots), never from a constant here: the track
//and the values it carries have to be sampled on the SAME grid, and that grid is the card's graph-detail setting.
//
//The day is taken from the slot clock itself (serverMsOfDay defines a slot), so the track and the data can never
//disagree on where a day begins. localMidnightMinusDays cannot be used for this: it answers in the BROWSER's zone,
//and a dashboard opened from another country would stand the track under the wrong hours.
export function buildSunGroundTrack(shownMs: number, lat: number, lon: number, slots: number): SunTrackPoint[]
{
    const dayStartMs = shownMs - serverMsOfDay(shownMs);
    const slotMs     = (24 * HOUR_MS) / slots;
    const out: SunTrackPoint[] = [];
    for (let s = 0; s < slots; s++)
    {
        //Slot centre, so a sample sits in the middle of the time it stands for rather than on its edge.
        const sun = getSunPosition(new Date(dayStartMs + (s + 0.5) * slotMs), lat, lon);
        const alt = sun.altitude * DEG;
        const az  = sun.azimuth  * DEG;
        //No hemisphere case: the real azimuth already runs the right way round, and noon lands north of the home
        //below the equator because that is where the sun actually is.
        out.push({ e: Math.cos(alt) * Math.sin(az), n: Math.cos(alt) * Math.cos(az) });
    }
    return out;
}

//Fractional slot of an instant, for the sun's leader.
export function slotOfMs(ms: number, slots: number): number
{
    return (serverMsOfDay(ms) / (24 * HOUR_MS)) * slots;
}

//One Catmull-Rom span, from point i to i+1, as a single cubic Bezier. Emitted span by span rather than as one
//long path because each needs its OWN stroke width: that is where the depth comes from, exactly as on the sun arc
//(thin far away, thick up close). A single path can only carry one width for the whole curve, and a chain of
//straight <line>s like the arc's would throw the smoothing away, so this keeps both.
//
//Catmull-Rom passes THROUGH every point (a plain Bezier hull would sag off the peaks), which matters here: the
//curve's job is to say WHEN, so it may not drift off its own samples.
//`ok` marks which points exist. A Catmull-Rom span takes its tangents from the points either SIDE of it, so at the
//edge of a run the neighbour is a slot with no reading, sitting on the ground - and the tangent would haul the
//line down towards it. The curve would hook into the earth just before it stops, which reads as the metric
//collapsing rather than as data running out. Clamping the missing neighbour onto the span's own end lets the line
//leave flat, at the height it really had.
function splineSpan(pts: [number, number][], i: number, closed: boolean, ok?: (k: number) => boolean): string
{
    const n = pts.length;
    const wrap = (k: number): number => (closed ? ((k % n) + n) % n : Math.min(n - 1, Math.max(0, k)));
    const at = (k: number): [number, number] =>
    {
        const j = wrap(k);
        if (!ok || ok(j)) { return pts[j]; }
        //Fall back on the end of this span that the missing neighbour sits beyond.
        return pts[wrap(k < i ? i : i + 1)];
    };
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    //Standard Catmull-Rom -> Bezier control points (tension 1/6). splineAt evaluates this same cubic, so anything
    //that has to sit on the drawn line agrees with it by construction.
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    return `M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`
         + ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
}

//The shared ground track, projected once: every strand stands on it, and the near/far split is computed from its
//depth alone. Height is excluded here on purpose - it would tilt the near/far test and cut the track off its own
//crossing with the house.
interface GroundPoint { x: number; y: number; depth: number; }
function projectGround(camera: SceneCamera, base: SunTrackPoint[], radiusM: number): GroundPoint[]
{
    return base.map((b) =>
    {
        const g = camera.project3(radiusM * b.e, radiusM * b.n, 0);
        return { x: g.x, y: g.y, depth: g.depth };
    });
}

//One strand's tops, rising off the shared ground points. `has` says whether a line exists above a slot: the TRACK
//runs unbroken through the day whatever happened on it, but a slot the strand never covered has no height to draw,
//and drawing it at zero would put a flat line along the ground and call it a measurement of nothing.
interface TopPoint { x: number; y: number; has: boolean; up: number; }
function projectStrandTops(camera: SceneCamera, strand: DayStrand, base: SunTrackPoint[], radiusM: number, rise: number): TopPoint[]
{
    return base.map((b, s) =>
    {
        const v   = strand.values[s];
        const has = v !== null && isFinite(v);
        const up  = has ? Math.max(0, Math.min(1, (v as number) / strand.peak)) * rise : 0;
        const t   = camera.project3(radiusM * b.e, radiusM * b.n, up);
        return { x: t.x, y: t.y, has, up };
    });
}

//Split a CLOSED loop of `n` points into runs that lie wholly on one side, `side` telling which side a point is on.
//Purely combinatorial, so the depth test and the walk can be got right independently of each other.
//
//Two rules earn their keep, and breaking either is visible on screen. Consecutive pieces share EXACTLY ONE point:
//share two and the segment between them is drawn twice, once in each depth pass, so it reads at the wrong depth
//from one side. And every segment must land in exactly one piece, the wrap from the last point back to the first
//included: miss it and a slice of the curve is simply absent, which shows up only at the angles that put the
//crossing there.
//
//The walk STARTS on a crossing, which is what makes both rules hold: from there each piece runs to the next
//crossing without ever straddling the end of the array, so there is no head-and-tail special case to get wrong.
export function splitLoopBySide(n: number, side: (i: number) => boolean): { idx: number[]; near: boolean }[]
{
    if (n < 2) { return []; }
    let start = -1;
    for (let k = 0; k < n; k++)
    {
        if (side(k) !== side((k - 1 + n) % n)) { start = k; break; }
    }
    //Never crosses: the loop is wholly on one side, so it is one piece, closed back onto itself.
    if (start < 0)
    {
        const idx = Array.from({ length: n }, (_v, i) => i);
        idx.push(0);
        return [{ idx, near: side(0) }];
    }

    //Walk the whole loop from the crossing and one point past it, so the wrap segment is covered like any other.
    const seq: number[] = [];
    for (let j = 0; j <= n; j++) { seq.push((start + j) % n); }

    const out: { idx: number[]; near: boolean }[] = [];
    let cur: number[] = [seq[0]];
    for (let k = 1; k < seq.length; k++)
    {
        if (side(seq[k]) !== side(seq[k - 1]))
        {
            out.push({ idx: cur, near: side(seq[k - 1]) });
            //The new piece starts ON the shared point, not before it: one point in common, never a segment.
            cur = [seq[k - 1]];
        }
        cur.push(seq[k]);
    }
    out.push({ idx: cur, near: side(seq[seq.length - 1]) });
    return out.filter((p) => p.idx.length >= 2);
}

//Split the shared ground track by which side of the house each point falls on. One split serves every strand.
function splitByDepth(ground: GroundPoint[]): { idx: number[]; near: boolean }[]
{
    return splitLoopBySide(ground.length, (i) => ground[i].depth > 0);
}

//Nearness of every point, 0 (furthest of this track) .. 1 (nearest), normalised over the track's OWN depth range,
//exactly as the sun arc normalises its own. It drives stroke width, which is the whole depth cue now that there is
//no fill to carry one. Off the shared ground depths, so every strand reads the same near/far ramp.
function nearnessOf(depths: number[]): number[]
{
    let dMin = Infinity;
    let dMax = -Infinity;
    for (const d of depths)
    {
        if (d < dMin) { dMin = d; }
        if (d > dMax) { dMax = d; }
    }
    const range = (dMax - dMin) || 1;
    //project3 returns depth = cameraZ, where LARGER is nearer, so nearness peaks at dMax with no inversion.
    return depths.map((d) => (d - dMin) / range);
}

//The point at fractional index `f` on the very curve splineSpan emits: the same Catmull-Rom cubic, evaluated
//rather than drawn. Anything that has to sit ON the line has to come from here. Reading the samples either side
//and interpolating between them straight is not the same curve: the spline bows AWAY from that chord between
//every pair of samples, so a bead placed on the chord floats off the line it is supposed to be riding, worst
//exactly where the curve bends hardest and the eye is already on it.
export function splineAt(pts: [number, number][], f: number, closed: boolean): [number, number]
{
    const n = pts.length;
    const at = (i: number): [number, number] =>
        closed ? pts[((i % n) + n) % n] : pts[Math.min(n - 1, Math.max(0, i))];
    const i = Math.floor(f);
    const t = f - i;
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    //The same control points splineSpan builds, so this evaluates that exact cubic and no other.
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    const u  = 1 - t;
    const b0 = u * u * u;
    const b1 = 3 * u * u * t;
    const b2 = 3 * u * t * t;
    const b3 = t * t * t;
    return [
        b0 * p1[0] + b1 * c1x + b2 * c2x + b3 * p2[0],
        b0 * p1[1] + b1 * c1y + b2 * c2y + b3 * p2[1],
    ];
}

//One strand within a depth pass: its spans (each carrying its own width AND colour, so a strand may change hue
//along its length) and whether it draws dashed.
export interface DayCurveStrandPass
{
    spans:  { d: string; w: number; predicted: boolean; colour: string }[];
    dashed: boolean;
}

//One depth pass of the curve: everything that goes behind the house, or everything that goes in front.
//
//DATA, not markup. The card turns this into elements itself, so Lit sets every attribute and there is nothing to
//trust: a colour typed into a dashboard's YAML lands in an attribute slot, where it is a string and can never be
//anything else. It also lets Lit diff `d` and `stroke-width` against the DOM it already built, instead of the
//whole subtree being re-parsed from text on every camera frame.
export interface DayCurvePass
{
    //The sun's ground track and the risers under each hour: ONE path each, subpaths joined. They carry no
    //per-element attribute - stroke, width, dash and opacity all come from CSS - so there is nothing to vary and
    //no reason to spend an element per span on them. The riser at each hour rises to the TALLEST strand there, all
    //strands weighed together. Empty string when there is none.
    foot:    string;
    risers:  string;
    //The strands, in the order the data handed them over. Aligned by index across the far and near passes.
    strands: DayCurveStrandPass[];
    //The drop from the sun to the topmost strand beneath it, in that strand's colour, and one bead per strand where
    //the sun's slot lands on it. null / empty when the sun is down or points at no covered strand.
    leader:  { x1: number; y1: number; x2: number; y2: number; stroke: string } | null;
    beads:   { x: number; y: number; colour: string }[];
}

export interface DayCurveScene
{
    far:  DayCurvePass;
    near: DayCurvePass;
}

const emptyPass = (): DayCurvePass => ({ foot: '', risers: '', strands: [], leader: null, beads: [] });

//The leader from the sun down to the strands beneath it, and one bead per strand where the sun's slot lands on it.
//The sun end is the sun's own position, continuous with the scrub; each curve end is evaluated on that strand's
//drawn spline, so a bead rides its line instead of hovering near it. Every strand shares the ground point, so the
//beads stack up one vertical and the leader runs to the topmost of them, in that strand's colour.
function addSunBeads(scene: DayCurveScene, camera: SceneCamera, curve: DayCurveData, sun: CurveSun,
    strands: DayStrand[], stTops: TopPoint[][]): void
{
    //Sun under the horizon, or nothing to point at: no leader, no beads.
    if (curve.sunSlot === null || sun.altitude <= 0) { return; }
    const slots = curve.base.length;
    const f  = ((curve.sunSlot % slots) + slots) % slots;
    const i0 = Math.floor(f);
    const i1 = (i0 + 1) % slots;

    //The sun's own ground + sky points, from the live sun rather than the slot: they move continuously with the
    //scrub, while the slots are a fixed grid.
    const alt = sun.altitude * DEG;
    const az  = sun.azimuth  * DEG;
    const east  = curve.radiusM * Math.cos(alt) * Math.sin(az);
    const north = curve.radiusM * Math.cos(alt) * Math.cos(az);
    const sunP   = camera.project3(east, north, curve.radiusM * Math.sin(alt));
    const ground = camera.project3(east, north, 0);
    const pass = ground.depth > 0 ? scene.near : scene.far;

    const beads: { x: number; y: number; colour: string }[] = [];
    let topX = 0;
    let topY = Infinity;
    let topColour = '';
    for (let s = 0; s < strands.length; s++)
    {
        const tops = stTops[s];
        //The strand does not exist across this pair, so there is nothing on it to mark.
        if (!tops[i0].has || !tops[i1].has) { continue; }
        //Land on the drawn line, at the same fraction, off the same spline. Closed: the track is a loop.
        const hit    = splineAt(tops.map((t) => [t.x, t.y] as [number, number]), f, true);
        const colour = strands[s].segColours?.[i0] ?? strands[s].colour;
        beads.push({ x: hit[0], y: hit[1], colour });
        if (hit[1] < topY) { topY = hit[1]; topX = hit[0]; topColour = colour; }
    }
    if (beads.length === 0) { return; }
    pass.beads  = beads;
    pass.leader = { x1: sunP.x, y1: sunP.y, x2: topX, y2: topY, stroke: topColour };
}

//Build the curve for one frame, as the two depth passes the card layers around its chips. Every strand stands on
//the one shared ground track, so the near/far split, the foot and the risers are worked out once and each strand
//is filed into the passes by that single split.
export function renderDayCurve(camera: SceneCamera, curve: DayCurveData, sun: CurveSun): DayCurveScene
{
    if (!camera.hasViewport || !(curve.radiusM > 0) || curve.sweep <= 0 || curve.base.length < 2)
    {
        return { far: emptyPass(), near: emptyPass() };
    }
    //A strand with no peak has nothing to normalise against; one off the shared grid cannot be projected on it.
    const strands = curve.strands.filter((st) => st.peak > 0 && st.values.length === curve.base.length);
    if (strands.length === 0) { return { far: emptyPass(), near: emptyPass() }; }

    const slots = curve.base.length;
    //Each pass carries one strand-pass per strand, aligned by index, so a strand keeps its slot in both halves.
    const mkPass = (): DayCurvePass =>
        ({ foot: '', risers: '', strands: strands.map((st) => ({ spans: [], dashed: st.dashed ?? false })), leader: null, beads: [] });
    const scene: DayCurveScene = { far: mkPass(), near: mkPass() };

    const rise    = curve.radiusM * DAY_CURVE_HEIGHT_FRAC;
    const ground  = projectGround(camera, curve.base, curve.radiusM);
    const near01  = nearnessOf(ground.map((g) => g.depth));
    const bots    = ground.map((g) => [g.x, g.y] as [number, number]);
    const stTops  = strands.map((st) => projectStrandTops(camera, st, curve.base, curve.radiusM, rise));
    //How far round the day the sweep has reached. Slots past it are not drawn at all, so the curve arrives by being
    //written rather than by fading up: the lines, the scaffolding and the risers all appear together, in order.
    const reached = curve.sweep >= 1 ? slots : curve.sweep * slots;
    //An hour's worth of slots: the risers stand on the HOURS, not on every sample, or a fine graph-detail setting
    //would fence the whole track in.
    const perHour = Math.max(1, Math.round(slots / 24));

    for (const piece of splitByDepth(ground))
    {
        const pass  = piece.near ? scene.near : scene.far;
        const drawn = piece.idx.filter((i) => i <= reached);
        if (drawn.length < 2) { continue; }

        //The scaffolding, in the text colour and dashed: the sun's ground track, and a riser under each hour rising
        //to the TALLEST strand there. Neutral and behind, so the eye reads them as the frame the strands are
        //measured against. The riser weighs every strand together (the universal rule): one vertical per hour, up
        //to whichever line stands highest.
        const foot: string[]   = [];
        const risers: string[] = [];
        for (let k = 1; k < drawn.length; k++) { foot.push(splineSpan(bots, drawn[k - 1], true)); }
        for (const i of drawn)
        {
            if (i % perHour !== 0) { continue; }
            let best   = -1;
            let bestUp = -Infinity;
            for (let s = 0; s < strands.length; s++)
            {
                const t = stTops[s][i];
                if (t.has && t.up > bestUp) { bestUp = t.up; best = s; }
            }
            if (best < 0) { continue; }
            const t = stTops[best][i];
            risers.push(`M ${ground[i].x.toFixed(2)} ${ground[i].y.toFixed(2)} L ${t.x.toFixed(2)} ${t.y.toFixed(2)}`);
        }
        pass.foot   = pass.foot   ? `${pass.foot} ${foot.join(' ')}`     : foot.join(' ');
        pass.risers = pass.risers ? `${pass.risers} ${risers.join(' ')}` : risers.join(' ');

        //Each strand's own line, span by span so each takes its width from its depth: the same thin-far / thick-near
        //ribbon the sun arc uses, and its colour from its slot (a flow strand changes hue along its length).
        for (let s = 0; s < strands.length; s++)
        {
            const st     = strands[s];
            const tops   = stTops[s];
            const topPts = tops.map((t) => [t.x, t.y] as [number, number]);
            const hasAt  = (j: number): boolean => tops[j].has;
            const out    = pass.strands[s];
            for (let k = 1; k < drawn.length; k++)
            {
                const i = drawn[k - 1];
                const j = drawn[k];
                //No reading either side means no line to draw between them. This is what stops today at now instead
                //of trailing a flat line along the ground to midnight.
                if (!tops[i].has || !tops[j].has) { continue; }
                const n = 0.5 * (near01[i] + near01[j]);
                out.spans.push({
                    d: splineSpan(topPts, i, true, hasAt),
                    w: CURVE_WIDTH_FAR + (CURVE_WIDTH_NEAR - CURVE_WIDTH_FAR) * n,
                    //A span is a prediction if either end is: the changeover then lands ON a sample rather than
                    //between two, so solid meets dashed exactly where the readings stop.
                    predicted: st.predicted[i] || st.predicted[j],
                    //Per-slot colour where the strand carries one (battery flow), else its solid colour.
                    colour: st.segColours?.[i] ?? st.colour,
                });
            }
        }
    }

    addSunBeads(scene, camera, curve, sun, strands, stTops);
    return scene;
}
