//Screen-space overlay subsystem: pulls fresh projections from the
//engine (sun arc, cloud dome, home silhouettes, label anchors),
//maps the sun arc samples into stroke-ready segments, controls
//the SMIL animation play-state when the card scrolls in / out of
//view, and exposes the "flow duration" easing used to ramp
//animation speeds with the live production rate.

import type { HeliosEngine } from '../helios-engine';


//Single arc sample as produced by engine.projectSunScene(). The
//card consumes (x, y) for placement and `nearness` / `belowHorizon`
//for visual modulation. `irradiance` is carried alongside for
//consumers that want to colour-modulate per sample.
export interface SunArcSample
{
    x: number;
    y: number;
    irradiance: number;
    nearness:   number;
    belowHorizon: boolean;
}

//Full sun-scene projection: arc samples, sun position, home anchor,
//daylight fraction, plus sunrise / sunset anchors (null when the
//selected day has no sunrise or sunset, polar regions).
export interface SunScene
{
    arc:      SunArcSample[];
    sun:      { x: number; y: number; irradiance: number; altitude: number; nearness: number };
    home:     { x: number; y: number };
    daylight: number;
    sunrise:  { x: number; y: number; angleRad: number; time: Date } | null;
    sunset:   { x: number; y: number; angleRad: number; time: Date } | null;
}

//Cloud-cover scene snapshot consumed by the card chip stack. The engine exposes the per-altitude percentages and the
//resolved chip colour, refreshed on every map transform and clock tick. The per-layer chips next to the cloud-cover
//toggle display these values directly.
export interface CloudScene
{
    cloudHex:   string;
    cloudPct:   number;
    cloudLow:   number;
    cloudMid:   number;
    cloudHigh:  number;
}

//Per-polygon silhouette of one home building in screen space: the projected base ring and the projected top ring. Painted into the cloud-dome SVG
//mask so the union covers the exact extruded prism even for concave footprints.
export interface HomeSilhouette
{
    base: Array<{ x: number; y: number }>;
    top:  Array<{ x: number; y: number }>;
}

//Screen-space anchor positions for the always-visible chips
//(cloud %, PV W, battery SoC + power) and the ring edge / home
//point used by the leader lines.
export interface LabelLayout
{
    cloudLabel:        { x: number; y: number };
    pvLabel:           { x: number; y: number };
    batterySocLabel:   { x: number; y: number };
    batteryPowerLabel: { x: number; y: number };
    gridLabel:         { x: number; y: number };
    lowCarbonLabel:    { x: number; y: number };
    ringEdge:          { x: number; y: number };
    home:              { x: number; y: number };
    //Projected screen position of the home roof top (home lat/lon at
    //altitude render_height). Drop leader from the home pill lands
    //exactly here so the connection follows the roof even when the
    //user resizes the card or pitches the camera.
    homeRoof:          { x: number; y: number };
    //Perspective-projected ground disc around the home. Drawn as
    //a polygon in the PV leader SVG; pulses with the bead arrival
    //by scaling around its centre (which is `home`).
    homeAnchorPoints:  string;
}

//One pair of arc samples mapped to a stroke-ready segment. The
//segment shares one fixed colour (the configured sun colour);
//depth perception comes from `nearness` (modulates stroke width)
//and `belowHorizon` (switches the renderer to night-dot mode).
export interface ArcSegment
{
    x1: number; y1: number;
    x2: number; y2: number;
    color:        string;
    nearness:     number;
    belowHorizon: boolean;
}


//Structural surface the host card exposes. Mixes engine + scene
//state (mutated by refreshOverlays) with the DOM surface
//setAnimationsPaused needs (shadowRoot + classList come from
//LitElement / HTMLElement, the card satisfies them natively).
export interface OverlaysHost
{
    readonly _engine?:      HeliosEngine;
    readonly _selectedTime: Date | null;
    readonly _now:          Date;

    _labelLayout:     LabelLayout | null;
    _sunScene:        SunScene | null;
    _cloudScene:      CloudScene | null;
    _homeSilhouettes: HomeSilhouette[];

    readonly shadowRoot: ShadowRoot | null;
    readonly classList:  DOMTokenList;
}


//Sub-pixel epsilon for screen-space equality. Below this the eye
//cannot tell the difference and Lit shouldn't re-render. Larger
//values would let Lit skip true motion frames; smaller ones would
//re-render on floating-point projection noise that produces no
//visible delta.
const EQ_EPS_PX = 0.25;

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

function pointArrayEq(
    a: Array<{ x: number; y: number }>,
    b: Array<{ x: number; y: number }>,
): boolean
{
    if (a === b)
    {
        return true;
    }
    if (a.length !== b.length)
    {
        return false;
    }
    for (let i = 0; i < a.length; i++)
    {
        if (!nearlyEq(a[i].x, b[i].x) || !nearlyEq(a[i].y, b[i].y))
        {
            return false;
        }
    }
    return true;
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
    return pointEq(a.cloudLabel,        b.cloudLabel)
        && pointEq(a.pvLabel,           b.pvLabel)
        && pointEq(a.batterySocLabel,   b.batterySocLabel)
        && pointEq(a.batteryPowerLabel, b.batteryPowerLabel)
        && pointEq(a.gridLabel,         b.gridLabel)
        && pointEq(a.lowCarbonLabel,    b.lowCarbonLabel)
        && pointEq(a.ringEdge,          b.ringEdge)
        && pointEq(a.home,              b.home)
        //homeAnchorPoints is a long SVG points string; direct
        //equality against the previous string captures every
        //vertex delta the ground disc would render and is cheap
        //(both ends are interned via the engine's call cycle).
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

function cloudSceneEq(a: CloudScene | null, b: CloudScene | null): boolean
{
    if (a === b)
    {
        return true;
    }
    if (!a || !b)
    {
        return false;
    }
    if (a.cloudHex !== b.cloudHex)
    {
        return false;
    }
    if (a.cloudPct !== b.cloudPct)
    {
        return false;
    }
    if (a.cloudLow !== b.cloudLow)
    {
        return false;
    }
    if (a.cloudMid !== b.cloudMid)
    {
        return false;
    }
    return a.cloudHigh === b.cloudHigh;
}

function homeSilhouettesEq(a: HomeSilhouette[], b: HomeSilhouette[]): boolean
{
    if (a === b)
    {
        return true;
    }
    if (a.length !== b.length)
    {
        return false;
    }
    for (let i = 0; i < a.length; i++)
    {
        if (!pointArrayEq(a[i].base, b[i].base))
        {
            return false;
        }
        if (!pointArrayEq(a[i].top,  b[i].top))
        {
            return false;
        }
    }
    return true;
}


//Pull the fresh screen-space layouts from the engine and stash
//them on the host. Cheap: each engine projection is a handful of
//matrix multiplies, no allocations of consequence. Called on every
//map transform broadcast by the engine, plus once at first weather
//update (the engine's projection matrix is only ready after the
//style has loaded), plus on every clock tick when in live mode
//(the sun position depends on the time).
//
//Each assignment is gated by a shallow equality check against the
//previous value. Lit uses identity-based dirty checking on @state
//properties, so a fresh-identity assignment with identical numeric
//content still triggers a full template re-render. During manual
//map rotation MapLibre fires move events at the pointer rate (up
//to 120 Hz on M4 trackpads), and the heavy template includes
//three SMIL <animateMotion> elements whose `path` attribute is
//rebuilt from these scene fields. Safari/WebKit re-arms the SMIL
//clock on every path mutation; without these guards the clock
//state grew monotonically over ~10-15 s of continuous drag and
//the frame budget collapsed past the 120 Hz ceiling.
export function refreshOverlays(host: OverlaysHost): void
{
    const nextLabel = host._engine?.projectHomeLabelLayout() ?? null;
    if (!labelLayoutEq(host._labelLayout, nextLabel))
    {
        host._labelLayout = nextLabel;
    }

    const t = host._selectedTime ?? host._now;
    const nextSun   = host._engine ? host._engine.projectSunScene(t)        : null;
    const nextCloud = host._engine ? host._engine.projectCloudScene()       : null;
    const nextHomes = host._engine ? host._engine.projectHomeFootprints()   : [];
    if (!sunSceneEq       (host._sunScene,        nextSun))
    {
        host._sunScene        = nextSun;
    }
    if (!cloudSceneEq     (host._cloudScene,      nextCloud))
    {
        host._cloudScene      = nextCloud;
    }
    if (!homeSilhouettesEq(host._homeSilhouettes, nextHomes))
    {
        host._homeSilhouettes = nextHomes;
    }

    //custom layer now: no per-transform projection on the JS side,
    //no canvas redraw. The card just drives the fade-in/out alpha
    //via _startLidarFadeLoop; MapLibre re-issues the layer's draw
    //call on every transform automatically.

    //Weather raster source / layer is owned by the engine + the weather mode lifecycle, so this
    //transform path stays free of a per-frame refreshOverlays for it.
}


//Pause / resume CSS keyframe animations and SMIL animations when
//the card scrolls in / out of view. Uses the host's class list for
//the CSS side (a single .helios-paused class is keyed off by the
//card stylesheet) and walks the shadow tree to call
//(un)pauseAnimations() on every SVG root for the SMIL side. Both
//SMIL methods are no-ops on browsers that don't support them, so
//no feature-detection is needed.
export function setAnimationsPaused(host: OverlaysHost, paused: boolean): void
{
    host.classList.toggle('helios-paused', paused);
    const root = host.shadowRoot;
    if (!root)
    {
        return;
    }
    //NodeList directly iterable: skip Array.from. The querySelectorAll
    //result is live in spec but immutable for our use here; the loop
    //touches every svg in order regardless.
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


//Map an arc-sample sequence into stroke-ready segments. The caller paints each segment as one <line> with a stroke width scaled by `nearness` and a
//colour pulled from the configured sun colour.
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
            color:        sunColor,
            nearness:     0.5 * (a.nearness + b.nearness),
            belowHorizon: a.belowHorizon || b.belowHorizon
        });
    }
    return out;
}


//Map a "rate" magnitude to an animation duration in seconds.
//  rate <= 0           → 30 s        (paused, night / no production)
//  rate  = saturation  → minDuration (fastest, full power)
//
//Ease-out cubic ramp: half-saturation already feels meaningfully faster than the night baseline, which gives the user the feeling of raw power
//pushing through the line. The minDuration is exposed so callers can tune the saturated-end pace per channel, the sun ray spans the full map and
//benefits from a slightly slower flow than the PV leader, which is short and local.
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
    //Inline cubic instead of Math.pow(.., 3): the call fires from every
    //bead duration recompute (sun ray, PV leader, grid beads) on each
    //render frame; replacing the generic exponent with a 3-multiply
    //chain shaves a measurable slice off the hot path under
    //auto-rotate.
    const f = Math.min(1, rate / saturation);
    const oneMinusF = 1 - f;
    const eased = 1 - oneMinusF * oneMinusF * oneMinusF;
    return 30 - (30 - minDuration) * eased;
}
