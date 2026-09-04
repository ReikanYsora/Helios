//Screen-space HUD subsystem: pulls fresh projections from the engine (sun arc, cloud dome, home silhouettes, label
//anchors), maps sun arc samples into stroke segments, gates SMIL play-state on card visibility, and exposes the
//"flow duration" easing that ramps animation speed with the live production rate.

import type { HeliosEngine } from '../scene/helios-engine';
import type { DayCurveScene, DayCurvePass } from '../scene/day-curve';
import { EQ_EPS_PX } from '../core/config/constants';
import { arcColor } from '../core/render-kit/colors';


//One arc sample from engine.projectSunScene(): (x,y) for placement, nearness/belowHorizon for visual modulation,
//altitude (deg) for the time-of-day arc colour.
export interface SunArcSample
{
    x: number;
    y: number;
    altitude:   number;
    nearness:   number;
    belowHorizon: boolean;
}

//Full sun-scene projection. sunrise/sunset are null when the selected day has none (polar regions).
export interface SunScene
{
    arc:      SunArcSample[];
    sun:      { x: number; y: number; irradiance: number; altitude: number; azimuth: number; nearness: number };
    home:     { x: number; y: number };
    daylight: number;
    ridge:    { x: number; y: number }[];
    sunrise:  { x: number; y: number; angleRad: number; time: Date } | null;
    sunset:   { x: number; y: number; angleRad: number; time: Date } | null;
}

//Moon-scene projection (engine.projectMoonScene): its own arc on the same dome as the sun's, plus the disc's
//position and phase. Cosmetic only, so no irradiance, ray anchor, ridge or rise/set markers.
export interface MoonScene
{
    arc:  SunArcSample[];
    moon: {
        x: number; y: number; altitude: number; azimuth: number; nearness: number;
        fraction: number; waxing: boolean;
    };
}

//Array markers (engine.projectArrayScene): one tile per Helios-Forecast line, as its projected quad, its centre
//(the ray's foot) and how squarely it faces the sun (0..1, the tile's glow); `sun` is the ray target, null while
//the sun is below the horizon (no rays). null when the install has no Helios-Forecast lines.
export interface ArrayTile
{
    points: [number, number][];
    cx:     number;
    cy:     number;
    glow:   number;
}
export interface ArrayScene
{
    tiles: ArrayTile[];
    sun:   { x: number; y: number } | null;
}

//Screen-space anchors for the always-visible chips plus ring edge / home point used by leader lines.
export interface LabelLayout
{
    pvLabel:           { x: number; y: number };
    //Single fused battery chip anchor (SoC drives the fill icon, the value is the power), top of the right column.
    batteryLabel:      { x: number; y: number };
    //Grid chip anchor: top-left, mirroring the battery chip on the right.
    gridLabel:         { x: number; y: number };
    //Monitoring-group chip anchors, fixed by group number ([g1, g2, g3, g4]).
    groupLabels:       { x: number; y: number }[];
    home:              { x: number; y: number };
}

//One pair of arc samples as a stroke segment. Fixed sun colour; depth comes from nearness (stroke width) and
//belowHorizon (switches renderer to night-dot mode).
export interface ArcSegment
{
    x1: number; y1: number;
    x2: number; y2: number;
    color:        string;
    nearness:     number;
    belowHorizon: boolean;
}


//Surface the host card exposes: engine + scene state (mutated by refreshHud) plus the DOM surface
//setAnimationsPaused needs (shadowRoot/classList satisfied natively by LitElement/HTMLElement).
export interface HudHost
{
    readonly _engine?:      HeliosEngine;
    readonly _selectedTime: Date | null;
    readonly _now:          Date;

    _labelLayout:     LabelLayout | null;
    _sunScene:        SunScene | null;
    //The moon's own arc + disc, projected alongside the sun's. null until the engine is ready.
    _moonScene:       MoonScene | null;
    //The day curve, already projected, as the two depth passes the card layers around its chips. null when off.
    _dayCurveScene:   DayCurveScene | null;
    //The Helios-Forecast array tiles + rays, projected with the rest. null without the integration.
    _arrayScene:      ArrayScene | null;

    readonly shadowRoot: ShadowRoot | null;
    readonly classList:  DOMTokenList;
}


//Sub-pixel epsilon for screen-space equality: below this the eye can't tell and Lit shouldn't re-render. Larger skips
//real motion frames; smaller re-renders on floating-point projection noise.
function nearlyEq(a: number, b: number): boolean
{
    return Math.abs(a - b) <= EQ_EPS_PX;
}

function pointEq(
    a: { x: number; y: number } | null | undefined,
    b: { x: number; y: number } | null | undefined,
): boolean
{
    if (a === b)
    {
        return true;
    }
    if (!a || !b)
    {
        return false;
    }
    return nearlyEq(a.x, b.x) && nearlyEq(a.y, b.y);
}

function labelLayoutEq(a: LabelLayout | null, b: LabelLayout | null): boolean
{
    if (a === b)
    {
        return true;
    }
    if (!a || !b)
    {
        return false;
    }
    return pointEq(a.pvLabel,      b.pvLabel)
        && pointEq(a.batteryLabel, b.batteryLabel)
        && pointEq(a.gridLabel,    b.gridLabel)
        && a.groupLabels.length === b.groupLabels.length
        && a.groupLabels.every((p, i) => pointEq(p, b.groupLabels[i]))
        && pointEq(a.home,         b.home);
}

function sunSceneEq(a: SunScene | null, b: SunScene | null): boolean
{
    if (a === b)
    {
        return true;
    }
    if (!a || !b)
    {
        return false;
    }
    if (!nearlyEq(a.daylight, b.daylight))
    {
        return false;
    }
    if (!pointEq(a.home, b.home))
    {
        return false;
    }
    //irradiance and nearness are gated too, not just position: irradiance drives the disc fill, halo, heat aura and
    //W/m2 chip, and nearness the disc radius + z-split, so a weather-only change at a stationary sun (fixed scrub
    //time, new cloud) still has to repaint.
    if (!nearlyEq(a.sun.x, b.sun.x) || !nearlyEq(a.sun.y, b.sun.y)
        || !nearlyEq(a.sun.altitude, b.sun.altitude)
        || !nearlyEq(a.sun.azimuth, b.sun.azimuth)
        || !nearlyEq(a.sun.irradiance, b.sun.irradiance)
        || !nearlyEq(a.sun.nearness, b.sun.nearness))
    {
        return false;
    }
    if (a.arc.length !== b.arc.length)
    {
        return false;
    }
    for (let i = 0; i < a.arc.length; i++)
    {
        const sa = a.arc[i]; const sb = b.arc[i];
        if (sa.belowHorizon !== sb.belowHorizon)
        {
            return false;
        }
        if (!nearlyEq(sa.x, sb.x) || !nearlyEq(sa.y, sb.y))
        {
            return false;
        }
    }
    //Sunrise / sunset markers must match presence and screen pos.
    if ((a.sunrise === null) !== (b.sunrise === null))
    {
        return false;
    }
    if (a.sunrise && b.sunrise
        && (!nearlyEq(a.sunrise.x, b.sunrise.x) || !nearlyEq(a.sunrise.y, b.sunrise.y)))
    {
        return false;
    }
    if ((a.sunset === null) !== (b.sunset === null))
    {
        return false;
    }
    if (a.sunset && b.sunset
        && (!nearlyEq(a.sunset.x, b.sunset.x) || !nearlyEq(a.sunset.y, b.sunset.y)))
    {
        return false;
    }
    return true;
}

//Same identity-preserving guard as sunSceneEq: the moon is re-projected on every transform tick, and a content-equal
//result must keep its identity or Lit rebuilds the moon SVG for nothing. Phase (fraction/waxing) is gated too: a
//fixed scrub time at a stationary moon still changes the crescent as the day is scrubbed.
function moonSceneEq(a: MoonScene | null, b: MoonScene | null): boolean
{
    if (a === b)
    {
        return true;
    }
    if (!a || !b)
    {
        return false;
    }
    if (!nearlyEq(a.moon.x, b.moon.x) || !nearlyEq(a.moon.y, b.moon.y)
        || !nearlyEq(a.moon.altitude, b.moon.altitude)
        || !nearlyEq(a.moon.nearness, b.moon.nearness)
        || Math.abs(a.moon.fraction - b.moon.fraction) > 0.002
        || a.moon.waxing !== b.moon.waxing)
    {
        return false;
    }
    if (a.arc.length !== b.arc.length)
    {
        return false;
    }
    for (let i = 0; i < a.arc.length; i++)
    {
        const sa = a.arc[i]; const sb = b.arc[i];
        if (sa.belowHorizon !== sb.belowHorizon || !nearlyEq(sa.x, sb.x) || !nearlyEq(sa.y, sb.y))
        {
            return false;
        }
    }
    return true;
}

//Same gate for the array tiles: a few quads, compared corner by corner, plus the glow (sun-driven, so a fixed
//scrub time at a still camera can change it alone).
function arraySceneEq(a: ArrayScene | null, b: ArrayScene | null): boolean
{
    if (a === b)
    {
        return true;
    }
    if (!a || !b || a.tiles.length !== b.tiles.length || !pointEq(a.sun, b.sun))
    {
        return false;
    }
    for (let i = 0; i < a.tiles.length; i++)
    {
        const ta = a.tiles[i]; const tb = b.tiles[i];
        if (Math.abs(ta.glow - tb.glow) > 0.01 || !nearlyEq(ta.cx, tb.cx) || !nearlyEq(ta.cy, tb.cy)
            || ta.points.length !== tb.points.length)
        {
            return false;
        }
        for (let k = 0; k < ta.points.length; k++)
        {
            if (!nearlyEq(ta.points[k][0], tb.points[k][0]) || !nearlyEq(ta.points[k][1], tb.points[k][1]))
            {
                return false;
            }
        }
    }
    return true;
}

function dayCurvePassEq(a: DayCurvePass, b: DayCurvePass): boolean
{
    if (a.foot !== b.foot || a.risers !== b.risers)
    {
        return false;
    }
    if ((a.leader === null) !== (b.leader === null))
    {
        return false;
    }
    if (a.leader && b.leader
        && (a.leader.stroke !== b.leader.stroke
            || !nearlyEq(a.leader.x1, b.leader.x1) || !nearlyEq(a.leader.y1, b.leader.y1)
            || !nearlyEq(a.leader.x2, b.leader.x2) || !nearlyEq(a.leader.y2, b.leader.y2)))
    {
        return false;
    }
    if (a.beads.length !== b.beads.length)
    {
        return false;
    }
    for (let i = 0; i < a.beads.length; i++)
    {
        const ba = a.beads[i]; const bb = b.beads[i];
        if (ba.colour !== bb.colour || !nearlyEq(ba.x, bb.x) || !nearlyEq(ba.y, bb.y))
        {
            return false;
        }
    }
    if (a.strands.length !== b.strands.length)
    {
        return false;
    }
    for (let i = 0; i < a.strands.length; i++)
    {
        const sa = a.strands[i]; const sb = b.strands[i];
        if (sa.dashed !== sb.dashed || sa.spans.length !== sb.spans.length)
        {
            return false;
        }
        for (let j = 0; j < sa.spans.length; j++)
        {
            const pa = sa.spans[j]; const pb = sb.spans[j];
            if (pa.d !== pb.d || pa.w !== pb.w || pa.predicted !== pb.predicted || pa.colour !== pb.colour)
            {
                return false;
            }
        }
    }
    return true;
}

//Same rationale as the guards above: the day curve is projected on every map transform, and its two passes feed the
//heaviest scene layer. On an idle tick (no camera move, no scrub) the projection is deterministic and identical, so a
//content-equal result must keep its identity or Lit rebuilds the subtree and re-arms its SMIL clock for nothing.
function dayCurveSceneEq(a: DayCurveScene | null, b: DayCurveScene | null): boolean
{
    if (a === b)
    {
        return true;
    }
    if (!a || !b)
    {
        return false;
    }
    return dayCurvePassEq(a.far, b.far) && dayCurvePassEq(a.near, b.near);
}

//Pull fresh screen-space layouts from the engine and stash on the host. Cheap (a few matrix multiplies per
//projection). Called on every map transform, once at first weather update (projection matrix ready only after style
//load), and on every periodic tick in live mode (sun position depends on time).
//
//Each assignment is gated by an equality check: Lit dirty-checks @state by identity, so a fresh-identity assignment
//with identical content still triggers a full re-render. During manual rotation the engine fires transform events at
//pointer rate (up to 120 Hz), and the template's three SMIL <animateMotion> paths are rebuilt from these fields;
//Safari re-arms the SMIL clock on every path mutation, so without these guards the clock state grows over a drag and
//frame budget collapses.
export function refreshHud(host: HudHost): void
{
    //Don't project until the camera knows its viewport: every projection would otherwise centre on the (0,0) seed
    //and flash the whole HUD into the top-left corner for a frame.
    if (host._engine && !host._engine.isViewportReady())
    {
        return;
    }
    const nextLabel = host._engine?.projectHomeLabelLayout() ?? null;
    if (!labelLayoutEq(host._labelLayout, nextLabel))
    {
        host._labelLayout = nextLabel;
    }

    const t = host._selectedTime ?? host._now;
    const nextSun   = host._engine ? host._engine.projectSunScene(t) : null;
    if (!sunSceneEq(host._sunScene, nextSun))
    {
        host._sunScene = nextSun;
    }

    //The moon rides the same refresh as the sun: same dome, same camera, same reasons to re-project.
    const nextMoon  = host._engine ? host._engine.projectMoonScene(t) : null;
    if (!moonSceneEq(host._moonScene, nextMoon))
    {
        host._moonScene = nextMoon;
    }

    //The day curve rides the same refresh as the rest of the HUD, for the same reason: it is projected through the
    //camera, so it has to be redrawn on every map transform or it slides off the scene under it. Gated like the others.
    const nextCurve = host._engine?.projectDayCurve(t) ?? null;
    if (!dayCurveSceneEq(host._dayCurveScene, nextCurve))
    {
        host._dayCurveScene = nextCurve;
    }

    //The array tiles stand in the scene like the buildings and their rays reach for the sun: same refresh.
    const nextArrays = host._engine?.projectArrayScene(t) ?? null;
    if (!arraySceneEq(host._arrayScene, nextArrays))
    {
        host._arrayScene = nextArrays;
    }
}


//Pause/resume CSS keyframe + SMIL animations when the card scrolls in/out of view. CSS: toggle .helios-paused (keyed
//off by the card stylesheet). SMIL: walk the shadow tree calling (un)pauseAnimations() on every SVG root; both are
//no-ops where unsupported, so no feature detection needed.
export function setAnimationsPaused(host: HudHost, paused: boolean): void
{
    host.classList.toggle('helios-paused', paused);
    const root = host.shadowRoot;
    if (!root)
    {
        return;
    }
    //NodeList is directly iterable; skip Array.from.
    const svgs = root.querySelectorAll('svg');
    for (const svg of svgs)
    {
        const s = svg as SVGSVGElement & {
            pauseAnimations?:   () => void;
            unpauseAnimations?: () => void;
        };
        try
        {
            if (paused)
            {
                s.pauseAnimations?.();
            }
            else
            {
                s.unpauseAnimations?.();
            }
        }
        catch (_)
        { /* SMIL control unsupported on this element */ }
    }
}


//Map an arc-sample sequence into stroke segments. Caller paints each as a <line> with stroke width scaled by nearness.
export function buildArcSegments(
    arc:      readonly SunArcSample[],
    sunColor: string
): ArcSegment[]
{
    const out: ArcSegment[] = [];
    for (let i = 0; i < arc.length - 1; i++)
    {
        const point = arc[i];
        const next  = arc[i + 1];
        out.push({
            x1: point.x, y1: point.y,
            x2: next.x,  y2: next.y,
            //Time-of-day arc colour (grey under the horizon, warm near it, amber high). `sunColor` is the live
            //--warning-color amber the high arc takes.
            color:        arcColor(0.5 * (point.altitude + next.altitude), sunColor),
            nearness:     0.5 * (point.nearness + next.nearness),
            belowHorizon: point.belowHorizon || next.belowHorizon
        });
    }
    return out;
}


//Map a "rate" magnitude to an animation duration (seconds): rate<=0 -> 30s (paused, night), rate=saturation ->
//minDuration. Ease-out cubic so half-saturation already feels notably faster than the night baseline. minDuration is
//per channel: the sun ray spans the whole map and wants a slightly slower flow than the short PV leader.
export function flowDuration(
    rate:        number,
    saturation:  number,
    minDuration = 0.4
): number
{
    if (!isFinite(rate) || rate <= 0)
    {
        return 30;
    }
    //Inline cubic instead of Math.pow(..,3): runs on every bead-duration recompute per frame, so the 3-multiply
    //chain shaves a measurable slice off the hot path under auto-rotate.
    const f = Math.min(1, rate / saturation);
    const oneMinusF = 1 - f;
    const eased = 1 - oneMinusF * oneMinusF * oneMinusF;
    return 30 - (30 - minDuration) * eased;
}
