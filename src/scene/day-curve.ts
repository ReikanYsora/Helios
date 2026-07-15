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

export interface DayCurveData
{
    //One value per hour-of-day slot, in the metric's own unit; null breaks the curve (a slot nothing covered).
    values:   (number | null)[];
    //Which slots are a forecast rather than a reading. The same curve carries both: only the stroke changes, so
    //the day's shape runs unbroken and only its certainty gives way at `now`.
    predicted: boolean[];
    //Normalisation target: this value rises to the curve's full height. Each day passes its OWN peak, so a dull
    //December day reads as clearly as a bright June one and only the SHAPE carries meaning.
    peak:     number;
    colour:   string;
    //The sun's ground track for the day on show, one unit vector per slot. Rebuilt as the scrub moves to another
    //day, so the base always stands under the arc actually drawn.
    base:     SunTrackPoint[];
    //Fractional slot of the instant on show (live or scrubbed), for the leader down from the sun. null when there
    //is nothing to point at.
    sunSlot:  number | null;
    //The sun arc's ground radius, so the track lands exactly under the arc. Comes from the engine (it owns the arc
    //scale) and moves with the card's size, which is why it travels with the data.
    radiusM:  number;
    //0 .. 1 of the curve written on. The day writes itself round from its own midnight, so the sweep IS the day
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

export interface CurvePoint
{
    //Screen-space top of the curve and the ground point right below it.
    topX:  number;
    topY:  number;
    botX:  number;
    botY:  number;
    //Is there a reading (or a forecast) here at all? The TRACK is the sun's real path and runs unbroken through
    //the day whatever happened on it, but the CURVE must not: a slot nothing covered has no height to draw, and
    //drawing it at zero would put a flat line along the ground and call it a measurement of nothing.
    has:   boolean;
    //Camera-space depth of the GROUND point (height excluded, which would tilt the test): > 0 is nearer than the
    //home, and that is where the track passes in front of it.
    depth: number;
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
//line down towards it. The curve would hook into the earth just before it stops, which reads as production
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

//Project every slot of the ground track. The track itself has no gaps - the sun stood somewhere at every moment
//of the day - so it is projected whole. `has` is what says whether a CURVE exists above a given slot.
function projectSlots(camera: SceneCamera, curve: DayCurveData): CurvePoint[]
{
    const rise = curve.radiusM * DAY_CURVE_HEIGHT_FRAC;
    return curve.base.map((b, s) =>
    {
        const east  = curve.radiusM * b.e;
        const north = curve.radiusM * b.n;
        const v     = curve.values[s];
        const has   = v !== null && isFinite(v);
        const up    = has ? Math.max(0, Math.min(1, (v as number) / curve.peak)) * rise : 0;
        const top   = camera.project3(east, north, up);
        //Depth from the GROUND point: the height would tilt the near/far test and cut the track off its own
        //crossing.
        const bot   = camera.project3(east, north, 0);
        return { topX: top.x, topY: top.y, botX: bot.x, botY: bot.y, depth: bot.depth, has };
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

//Split the projected track by which side of the house each point falls on.
function splitByDepth(pts: CurvePoint[]): { idx: number[]; near: boolean }[]
{
    return splitLoopBySide(pts.length, (i) => pts[i].depth > 0);
}

//Nearness of every point, 0 (furthest of this track) .. 1 (nearest), normalised over the track's OWN depth range,
//exactly as the sun arc normalises its own. It drives stroke width, which is the whole depth cue now that there is
//no fill to carry one.
function nearnessOf(pts: CurvePoint[]): number[]
{
    let dMin = Infinity;
    let dMax = -Infinity;
    for (const p of pts)
    {
        if (p.depth < dMin) { dMin = p.depth; }
        if (p.depth > dMax) { dMax = p.depth; }
    }
    const range = (dMax - dMin) || 1;
    //project3 returns depth = cameraZ, where LARGER is nearer, so nearness peaks at dMax with no inversion.
    return pts.map((p) => (p.depth - dMin) / range);
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
    //no reason to spend an element per span on them. Empty string when there is none.
    foot:   string;
    risers: string;
    //The curve, span by span, because each DOES vary: its width is its depth, and one path can only carry one.
    spans:  { d: string; w: number; predicted: boolean }[];
    //The dashed drop from the sun to the curve, and the bead where it lands. null when the sun is down.
    leader: { x1: number; y1: number; x2: number; y2: number } | null;
    bead:   { x: number; y: number } | null;
}

export interface DayCurveScene
{
    far:    DayCurvePass;
    near:   DayCurvePass;
    colour: string;
}

const emptyPass = (): DayCurvePass => ({ foot: '', risers: '', spans: [], leader: null, bead: null });

//The leader from the sun down to the curve beneath it, and the bead where it lands. The sun end is the sun's own
//position, continuous with the scrub; the curve end is evaluated on the drawn spline, so the bead rides the line
//instead of hovering near it.
function sunLeader(camera: SceneCamera, curve: DayCurveData, sun: CurveSun, pts: CurvePoint[], tops: [number, number][]):
    { near: boolean; x1: number; y1: number; x2: number; y2: number } | null
{
    if (curve.sunSlot === null) { return null; }
    //Sun under the horizon: nothing was produced and there is nothing to point at.
    if (sun.altitude <= 0) { return null; }
    const slots = curve.values.length;
    const f  = ((curve.sunSlot % slots) + slots) % slots;
    const i0 = Math.floor(f);
    const i1 = (i0 + 1) % slots;
    //The curve does not exist across this pair, so neither does the reading.
    if (!pts[i0].has || !pts[i1].has) { return null; }

    //The sun's own ground point, from the live sun rather than the slot: it moves continuously with the scrub,
    //while the slots are a fixed grid.
    const alt = sun.altitude * DEG;
    const az  = sun.azimuth  * DEG;
    const east  = curve.radiusM * Math.cos(alt) * Math.sin(az);
    const north = curve.radiusM * Math.cos(alt) * Math.cos(az);
    const sunP   = camera.project3(east, north, curve.radiusM * Math.sin(alt));
    const ground = camera.project3(east, north, 0);

    //Land on the drawn line, at the same fraction, off the same spline. Closed: the track is a loop, so the
    //fraction either side of midnight has real neighbours rather than a clamped end.
    const hit = splineAt(tops, f, true);
    return { near: ground.depth > 0, x1: sunP.x, y1: sunP.y, x2: hit[0], y2: hit[1] };
}

//Build the curve for one frame, as the two depth passes the card layers around its chips.
export function renderDayCurve(camera: SceneCamera, curve: DayCurveData, sun: CurveSun): DayCurveScene
{
    const scene: DayCurveScene = { far: emptyPass(), near: emptyPass(), colour: curve.colour };
    //The values and the track have to be the same grid; the count itself is the data's to choose.
    if (!camera.hasViewport || curve.peak <= 0 || curve.values.length < 2
        || curve.base.length !== curve.values.length || !(curve.radiusM > 0) || curve.sweep <= 0)
    {
        return scene;
    }
    //How far round the day the sweep has reached. Slots past it are not drawn at all, so the curve arrives by
    //being written rather than by fading up: the line, its scaffolding and its risers all appear together, in the
    //order the day happened.
    const reached = curve.sweep >= 1 ? curve.values.length : curve.sweep * curve.values.length;
    const pts    = projectSlots(camera, curve);
    const near01 = nearnessOf(pts);
    const tops   = pts.map((p) => [p.topX, p.topY] as [number, number]);
    const bots   = pts.map((p) => [p.botX, p.botY] as [number, number]);
    //An hour's worth of slots: the risers stand on the HOURS, not on every sample, or a fine graph-detail setting
    //would fence the whole track in.
    const perHour = Math.max(1, Math.round(curve.values.length / 24));

    for (const piece of splitByDepth(pts))
    {
        const pass  = piece.near ? scene.near : scene.far;
        const drawn = piece.idx.filter((i) => i <= reached);
        if (drawn.length < 2) { continue; }

        //The scaffolding, in the text colour and dashed: the sun's ground track, and a riser under each hour.
        //Neutral and behind, so the eye reads them as the frame the curve is measured against rather than as data.
        //With no fill there is nothing else to say how high a point stands or how far away it is, and a curve
        //floating over a map is unreadable in perspective; these give it something to stand on.
        const foot: string[]   = [];
        const risers: string[] = [];
        for (let k = 1; k < drawn.length; k++) { foot.push(splineSpan(bots, drawn[k - 1], true)); }
        for (const i of drawn)
        {
            if (i % perHour !== 0 || !pts[i].has) { continue; }
            const p = pts[i];
            risers.push(`M ${p.botX.toFixed(2)} ${p.botY.toFixed(2)} L ${p.topX.toFixed(2)} ${p.topY.toFixed(2)}`);
        }
        pass.foot   = pass.foot   ? `${pass.foot} ${foot.join(' ')}`     : foot.join(' ');
        pass.risers = pass.risers ? `${pass.risers} ${risers.join(' ')}` : risers.join(' ');

        //The curve itself, span by span so each takes its own width from its own depth: the same thin-far /
        //thick-near ribbon the sun arc uses.
        for (let k = 1; k < drawn.length; k++)
        {
            const i = drawn[k - 1];
            //No reading either side means no curve to draw between them. This is what stops today at now instead
            //of trailing a flat line along the ground to midnight.
            if (!pts[i].has || !pts[drawn[k]].has) { continue; }
            const n = 0.5 * (near01[i] + near01[drawn[k]]);
            pass.spans.push({
                d: splineSpan(tops, i, true, (j) => pts[j].has),
                w: CURVE_WIDTH_FAR + (CURVE_WIDTH_NEAR - CURVE_WIDTH_FAR) * n,
                //A span is a prediction if either end is: the changeover then lands ON a sample rather than
                //between two, so solid meets dashed exactly where the readings stop.
                predicted: curve.predicted[i] || curve.predicted[drawn[k]],
            });
        }
    }

    const leader = sunLeader(camera, curve, sun, pts, tops);
    if (leader)
    {
        const pass = leader.near ? scene.near : scene.far;
        pass.leader = { x1: leader.x1, y1: leader.y1, x2: leader.x2, y2: leader.y2 };
        pass.bead   = { x: leader.x2, y: leader.y2 };
    }
    return scene;
}
