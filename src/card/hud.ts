//Screen-space HUD subsystem: pulls fresh projections from the engine (sun arc, cloud dome, home silhouettes,
//label anchors), maps sun arc samples into stroke segments, gates SMIL play-state on card visibility, and exposes
//the "flow duration" easing that ramps animation speed with the live production rate.

import type { HeliosEngine } from '../helios-engine';
import { EQ_EPS_PX } from '../constants';
import { arcColor } from '../engine/colors';


//One arc sample from engine.projectSunScene(): (x,y) for placement, nearness/belowHorizon for visual modulation,
//altitude (deg) for the time-of-day arc colour, irradiance carried for the legend.
export interface SunArcSample
{
    x: number;
    y: number;
    irradiance: number;
    altitude:   number;
    nearness:   number;
    belowHorizon: boolean;
}

//Full sun-scene projection. sunrise/sunset are null when the selected day has none (polar regions).
export interface SunScene
{
    arc:      SunArcSample[];
    sun:      { x: number; y: number; irradiance: number; altitude: number; nearness: number };
    home:     { x: number; y: number };
    daylight: number;
    sunrise:  { x: number; y: number; angleRad: number; time: Date } | null;
    sunset:   { x: number; y: number; angleRad: number; time: Date } | null;
}

//Screen-space anchors for the always-visible chips plus ring edge / home point used by leader lines.
export interface LabelLayout
{
    pvLabel:           { x: number; y: number };
    batterySocLabel:   { x: number; y: number };
    batteryPowerLabel: { x: number; y: number };
    gridLabel:         { x: number; y: number };
    home:              { x: number; y: number };
    //Home roof top (home lat/lon at altitude render_height): leader drops here so it follows the roof under resize/pitch.
    homeRoof:          { x: number; y: number };
    //Perspective-projected ground disc around the home; drawn as a polygon, pulses with bead arrival by scaling about `home`.
    homeAnchorPoints:  string;
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
    return pointEq(a.pvLabel,           b.pvLabel)
        && pointEq(a.batterySocLabel,   b.batterySocLabel)
        && pointEq(a.batteryPowerLabel, b.batteryPowerLabel)
        && pointEq(a.gridLabel,         b.gridLabel)
        && pointEq(a.home,              b.home)
        //homeAnchorPoints is a long SVG points string; direct string equality captures every vertex delta cheaply.
        && a.homeAnchorPoints === b.homeAnchorPoints;
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
    if (!nearlyEq(a.sun.x, b.sun.x) || !nearlyEq(a.sun.y, b.sun.y)
        || !nearlyEq(a.sun.altitude, b.sun.altitude)) return false;
    if (a.arc.length !== b.arc.length)
    {
        return false;
    }
    for (let i = 0; i < a.arc.length; i++)
    {
        const sa = a.arc[i], sb = b.arc[i];
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
        && (!nearlyEq(a.sunrise.x, b.sunrise.x) || !nearlyEq(a.sunrise.y, b.sunrise.y))) return false;
    if ((a.sunset === null) !== (b.sunset === null))
    {
        return false;
    }
    if (a.sunset && b.sunset
        && (!nearlyEq(a.sunset.x, b.sunset.x) || !nearlyEq(a.sunset.y, b.sunset.y))) return false;
    return true;
}

//Pull fresh screen-space layouts from the engine and stash on the host. Cheap (a few matrix multiplies per projection).
//Called on every map transform, once at first weather update (projection matrix ready only after style load), and on
//every clock tick in live mode (sun position depends on time).
//
//Each assignment is gated by an equality check: Lit dirty-checks @state by identity, so a fresh-identity assignment with
//identical content still triggers a full re-render. During manual rotation the engine fires transform events at pointer
//rate (up to 120 Hz), and the template's three SMIL <animateMotion> paths are rebuilt from these fields; Safari re-arms
//the SMIL clock on every path mutation, so without these guards the clock state grows over ~10-15 s of drag and frame
//budget collapses.
export function refreshHud(host: HudHost): void
{
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
}


//Pause/resume CSS keyframe + SMIL animations when the card scrolls in/out of view. CSS side: toggle .helios-paused
//(keyed off by the card stylesheet). SMIL side: walk the shadow tree calling (un)pauseAnimations() on every SVG root;
//both are no-ops where unsupported, so no feature detection needed.
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
    for (let i = 0; i < svgs.length; i++)
    {
        const s = svgs[i] as SVGSVGElement & {
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
        catch (_) {}
    }
}


//Map an arc-sample sequence into stroke segments. Caller paints each as a <line> with stroke width scaled by nearness.
export function buildArcSegments(
    arc:      ReadonlyArray<SunArcSample>,
    sunColor: string
): ArcSegment[]
{
    const out: ArcSegment[] = [];
    for (let i = 0; i < arc.length - 1; i++)
    {
        const a = arc[i];
        const b = arc[i + 1];
        out.push({
            x1: a.x, y1: a.y,
            x2: b.x, y2: b.y,
            //Time-of-day arc colour (grey under the horizon, warm near it, amber high). `sunColor` is the
            //live --warning-color amber the high arc takes.
            color:        arcColor(0.5 * (a.altitude + b.altitude), sunColor),
            nearness:     0.5 * (a.nearness + b.nearness),
            belowHorizon: a.belowHorizon || b.belowHorizon
        });
    }
    return out;
}


//Map a "rate" magnitude to an animation duration (seconds): rate<=0 -> 30s (paused, night), rate=saturation -> minDuration.
//Ease-out cubic so half-saturation already feels notably faster than the night baseline ("raw power" feel). minDuration
//is exposed per channel: the sun ray spans the whole map and wants a slightly slower flow than the short PV leader.
export function flowDuration(
    rate:        number,
    saturation:  number,
    minDuration: number = 0.4
): number
{
    if (!isFinite(rate) || rate <= 0)
    {
        return 30;
    }
    //Inline cubic instead of Math.pow(..,3): fires from every bead duration recompute per frame; the 3-multiply chain
    //shaves a measurable slice off the hot path under auto-rotate.
    const f = Math.min(1, rate / saturation);
    const oneMinusF = 1 - f;
    const eased = 1 - oneMinusF * oneMinusF * oneMinusF;
    return 30 - (30 - minDuration) * eased;
}
