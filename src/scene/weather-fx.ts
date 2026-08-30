//"Your real sky": the on-card weather overlay, driven by the real weather resolved at the current
//live/scrub time (cloud cover, precipitation, snowfall, WMO weather code). Independent layers stack: the cloud
//cover sets the sun/grey grade, and rain, snow and thunderstorm add on top of it.
//
//The overlay sits between the scene (z 1) and the chips (z 8): weather tints the map/buildings, never the data.
import { html, type TemplateResult } from 'lit';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

//Raw weather resolved at a time, the input to the layer model. cloud in %, precip in mm, snowfall in cm, code is
//the WMO weather code, sunAltitude is the sun's elevation in degrees (drives the sun-glow fade near the horizon
//and to zero at night).
export interface WxInput { cloud: number; precip: number; snowfall: number; code: number; sunAltitude: number; }

//Derived per-layer strengths. `sat`/`bright` grade the real scene (#map-container); `sun`/`grey`/`cloud` fade the
//CSS overlay layers; `rain`/`snow`/`storm` drive the particle canvases + lightning; `label` is the condition name.
export interface WxLayers
{
    sun:    number;
    grey:   number;
    cloud:  number;
    sat:    number;
    bright: number;
    rain:   number;
    snow:   number;
    storm:  number;
    label:  string;
}

//WMO weather-code groups (https://open-meteo.com/en/docs). Snow: 71-77 (snowfall) + 85/86 (snow showers).
//Thunderstorm: 95 (slight/moderate) + 96/99 (with hail).
const isSnowCode  = (c: number): boolean => (c >= 71 && c <= 77) || c === 85 || c === 86;
const isStormCode = (c: number): boolean => c === 95 || c === 96 || c === 99;

//A forecast can report a hair of precipitation (0.05 mm in an hour, from rounding or dew) under an otherwise clear
//sky. That is a trace, not weather to draw, so below these floors the precipitation layers stay off; real light rain
//(>= 0.1 mm/h) and light snow still paint. Without the floor the intensity curve turns 0.05 mm into visible rain.
const RAIN_MIN_MM = 0.1;
const SNOW_MIN_CM = 0.1;

//Precipitation rate -> particle density [0,1], as a piecewise-linear curve through the meteorological intensity
//classes (WMO / DWD / Met Office) rather than a single sqrt. A sqrt both over-drew a trace (0.1 mm/h read as 16 %
//of full density) and saturated at 4 mm/h, so a downpour and a violent storm looked identical. The breakpoints are
//the class ceilings, so a drizzle, moderate rain, a downpour and a storm each read as a distinct density. Piecewise
//linear is a couple of comparisons plus one interpolation, cheap enough for the per-frame call.
type IntensityCurve = readonly (readonly [number, number])[];

function intensityDensity(x: number, curve: IntensityCurve): number
{
    if (x <= curve[0][0])
    {
        return curve[0][1];
    }
    for (let i = 1; i < curve.length; i++)
    {
        const [x1, y1] = curve[i];
        if (x <= x1)
        {
            const [x0, y0] = curve[i - 1];
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
        }
    }
    return curve[curve.length - 1][1];
}

//mm/h -> drop density. Classes: light (<= 2.5), moderate (<= 10), heavy building to violent, saturating at 50 mm/h.
const RAIN_CURVE: IntensityCurve = [[0.1, 0.05], [2.5, 0.30], [10, 0.60], [50, 1.0]];
//cm/h -> flake density. Same class shape: light (<= 1), moderate (<= 4), heavy building to a blizzard at 10 cm/h.
const SNOW_CURVE: IntensityCurve = [[0.1, 0.08], [1, 0.35], [4, 0.70], [10, 1.0]];

//Map real weather to layer strengths. The sun's brightness derives from the cloud cover; precipitation falls as
//rain unless it's snowing (snowfall or a snow code), in which case the snow layer takes over; thunderstorm codes
//add the storm/lightning layer on top of whatever precipitation is falling.
export function weatherLayers(w: WxInput): WxLayers
{
    const cloud01 = clamp01(w.cloud / 100);
    const snowing = w.snowfall >= SNOW_MIN_CM || isSnowCode(w.code);
    const storm   = isStormCode(w.code) ? (w.code === 95 ? 0.7 : 1) : 0;

    //Rain and snow share the trace floor: below it a trace draws nothing, at/above it the class curve sets density.
    const rain = (snowing || w.precip < RAIN_MIN_MM)      ? 0 : intensityDensity(w.precip, RAIN_CURVE);
    const snow = (snowing && w.snowfall >= SNOW_MIN_CM)   ? intensityDensity(w.snowfall, SNOW_CURVE) : 0;

    //Day factor fades the sun glow out as the sun nears the horizon (0 at/below horizon, full by ~18°) so sunrise
    //and sunset don't paint a full midday bloom, and night is dark.
    const dayFactor = clamp01(w.sunAltitude / 18);

    return {
        sun:    dayFactor * clamp01(1 - cloud01 / 0.85),   //full sun in a clear high sky, gone under cloud or near the horizon
        grey:   clamp01((cloud01 - 0.25) / 0.60),            //grey veil builds in from ~25% cloud
        cloud:  clamp01((cloud01 - 0.30) / 0.55),            //moving cloud shadows from ~30%
        sat:    1.10 - 0.60 * cloud01,                        //scene saturation: 1.10 -> 0.50
        bright: 1.05 - 0.33 * cloud01,                        //scene brightness: 1.05 -> 0.72
        rain,
        snow,
        storm,
        label:
            storm > 0            ? 'Thunderstorm' :
                snow  > 0.5          ? 'Snow' :
                    snow  > 0            ? 'Light snow' :
                        rain  > 0.5          ? 'Rain' :
                            rain  > 0            ? 'Light rain' :
                                cloud01 > 0.75       ? 'Overcast' :
                                    cloud01 > 0.40       ? 'Cloudy' :
                                        cloud01 > 0.15       ? 'Partly cloudy' : 'Clear',
    };
}

//Pure markup (no handlers): the CSS-driven layers + the particle canvases + the lightning flash. Strengths come
//from the host's --wx-* vars.
export function weatherOverlay(): TemplateResult
{
    return html`
        <div class="helios-wx">
            <div class="helios-wx-warm"></div>
            <div class="helios-wx-shafts"></div>
            <div class="helios-wx-veil-grey"></div>
            <div class="helios-wx-veil-dark"></div>
            <div class="helios-wx-clouds">
                <div class="helios-wx-cloud k1"></div>
                <div class="helios-wx-cloud k2"></div>
                <div class="helios-wx-cloud k3"></div>
            </div>
            <div class="helios-wx-wet"></div>
            <canvas class="helios-wx-rain"></canvas>
            <canvas class="helios-wx-snow"></canvas>
            <div class="helios-wx-flash"></div>
        </div>`;
}

interface Drop { x: number; y: number; len: number; spd: number; wind: number; }
interface Ring { x: number; y: number; r: number; a: number; }

//Rain particle loop on a single 2D canvas: one batched line stroke + a few capped ground ripples, delta-timed,
//DPR-capped. `setIntensity(0..1)` scales the drop count and starts/stops the loop, so an idle card burns nothing.
export class WeatherRain
{
    private _raf = 0;
    private _drops: Drop[] = [];
    private _rings: Ring[] = [];
    private _w = 0;
    private _h = 0;
    private _dpr = 1;
    private _last = 0;
    private _ripAcc = 0;
    private _intensity = 0;
    private readonly _max = 430;
    private readonly _ringCap = 20;
    private _ro?: ResizeObserver;

    constructor(private readonly _getCanvas: () => HTMLCanvasElement | undefined)
    {}

    setIntensity(amt: number): void
    {
        this._intensity = clamp01(amt);
        const target = Math.round(this._intensity * this._max);
        if (target <= 0)
        {
            this.stop(); return;
        }
        //Resize only when (re)starting the loop, never on every call: a caller that drives setIntensity every
        //animation frame would otherwise clear the canvas (c.width reset) each frame and wipe the rain. The loop
        //itself re-resizes when the canvas size actually changes.
        if (!this._raf)
        {
            this._resize(); this._observeResize();
        }
        while (this._drops.length < target)
        {
            this._drops.push(this._newDrop(true));
        }
        if (this._drops.length > target)
        {
            this._drops.length = target;
        }
        if (!this._raf)
        {
            this._last = 0; this._raf = requestAnimationFrame(this._loop);
        }
    }

    stop(): void
    {
        if (this._raf)
        {
            cancelAnimationFrame(this._raf); this._raf = 0;
        }
        this._ro?.disconnect(); this._ro = undefined;
        this._rings = [];
        const c = this._getCanvas();
        const ctx = c?.getContext('2d');
        if (c && ctx)
        {
            ctx.clearRect(0, 0, c.width, c.height);
        }
    }

    private _resize(): void
    {
        const c = this._getCanvas();
        if (!c)
        {
            return;
        }
        const r = c.getBoundingClientRect();
        this._dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        this._w = r.width;
        this._h = r.height;
        c.width = Math.round(this._w * this._dpr);
        c.height = Math.round(this._h * this._dpr);
        const ctx = c.getContext('2d');
        if (ctx)
        {
            ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        }
    }

    private _newDrop(anywhere: boolean): Drop
    {
        return {
            x:    Math.random() * (this._w + 80) - 40,
            y:    anywhere ? Math.random() * this._h : -20,
            len:  7 + Math.random() * 15,
            spd:  520 + Math.random() * 560,
            wind: 60 + Math.random() * 40,
        };
    }

    //Re-measure only when the canvas actually resizes, instead of forcing a layout read every frame in the loop.
    private _observeResize(): void
    {
        if (this._ro || typeof ResizeObserver === 'undefined')
        {
            return;
        }
        const c = this._getCanvas();
        if (!c)
        {
            return;
        }
        this._ro = new ResizeObserver((): void =>
        {
            if (this._raf)
            {
                this._resize();
            }
        });
        this._ro.observe(c);
    }

    private readonly _loop = (ts: number): void =>
    {
        const c = this._getCanvas();
        const ctx = c?.getContext('2d');
        if (!c || !ctx)
        {
            this._raf = 0; return;
        }
        if (!this._last)
        {
            this._last = ts;
        }
        let dt = (ts - this._last) / 1000;
        this._last = ts;
        if (dt > 0.1)
        {
            dt = 0.1;
        }

        ctx.clearRect(0, 0, this._w, this._h);

        //Streaks: one path, one stroke. Denser rain reads slightly brighter.
        ctx.strokeStyle = `rgba(205,222,240,${0.35 + this._intensity * 0.25})`;
        ctx.lineWidth = 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < this._drops.length; i++)
        {
            const d = this._drops[i];
            d.y += d.spd * dt;
            d.x += d.wind * dt;
            if (d.y > this._h + 20 || d.x > this._w + 40)
            {
                this._drops[i] = this._newDrop(false); continue;
            }
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - d.wind * 0.02, d.y - d.len);
        }
        ctx.stroke();

        //Ground impact ripples (capped, only worth it once it rains a bit).
        this._ripAcc += dt;
        if (this._intensity > 0.15 && this._ripAcc > 0.05 && this._rings.length < this._ringCap)
        {
            this._ripAcc = 0;
            this._rings.push({ x: Math.random() * this._w, y: this._h * 0.45 + Math.random() * this._h * 0.5, r: 1, a: 0.5 });
        }
        ctx.strokeStyle = 'rgba(190,215,240,0.35)';
        ctx.lineWidth = 1;
        for (let j = this._rings.length - 1; j >= 0; j--)
        {
            const g = this._rings[j];
            g.r += 26 * dt;
            g.a -= 0.9 * dt;
            if (g.a <= 0)
            {
                this._rings.splice(j, 1); continue;
            }
            ctx.globalAlpha = Math.max(0, g.a);
            ctx.beginPath();
            ctx.ellipse(g.x, g.y, g.r, g.r * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        this._raf = requestAnimationFrame(this._loop);
    };
}

interface Flake { x: number; y: number; r: number; spd: number; amp: number; phase: number; sway: number; }

//Snow particle loop, sibling to WeatherRain: soft round flakes drift down slowly with a horizontal sway, batched
//into one fill. `setIntensity(0..1)` scales the flake count and starts/stops the loop.
export class WeatherSnow
{
    private _raf = 0;
    private _flakes: Flake[] = [];
    private _w = 0;
    private _h = 0;
    private _dpr = 1;
    private _last = 0;
    private _intensity = 0;
    private readonly _max = 340;
    private _ro?: ResizeObserver;

    constructor(private readonly _getCanvas: () => HTMLCanvasElement | undefined)
    {}

    setIntensity(amt: number): void
    {
        this._intensity = clamp01(amt);
        const target = Math.round(this._intensity * this._max);
        if (target <= 0)
        {
            this.stop(); return;
        }
        if (!this._raf)
        {
            this._resize(); this._observeResize();
        }
        while (this._flakes.length < target)
        {
            this._flakes.push(this._newFlake(true));
        }
        if (this._flakes.length > target)
        {
            this._flakes.length = target;
        }
        if (!this._raf)
        {
            this._last = 0; this._raf = requestAnimationFrame(this._loop);
        }
    }

    stop(): void
    {
        if (this._raf)
        {
            cancelAnimationFrame(this._raf); this._raf = 0;
        }
        this._ro?.disconnect(); this._ro = undefined;
        const c = this._getCanvas();
        const ctx = c?.getContext('2d');
        if (c && ctx)
        {
            ctx.clearRect(0, 0, c.width, c.height);
        }
    }

    private _resize(): void
    {
        const c = this._getCanvas();
        if (!c)
        {
            return;
        }
        const r = c.getBoundingClientRect();
        this._dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        this._w = r.width;
        this._h = r.height;
        c.width = Math.round(this._w * this._dpr);
        c.height = Math.round(this._h * this._dpr);
        const ctx = c.getContext('2d');
        if (ctx)
        {
            ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        }
    }

    private _newFlake(anywhere: boolean): Flake
    {
        return {
            x:     Math.random() * (this._w + 40) - 20,
            y:     anywhere ? Math.random() * this._h : -10,
            r:     1 + Math.random() * 2.4,
            spd:   26 + Math.random() * 46,       //much slower than rain
            amp:   8 + Math.random() * 20,        //horizontal sway amplitude
            phase: Math.random() * Math.PI * 2,
            sway:  0.6 + Math.random() * 0.9,     //sway angular speed
        };
    }

    //Re-measure only when the canvas actually resizes, instead of forcing a layout read every frame in the loop.
    private _observeResize(): void
    {
        if (this._ro || typeof ResizeObserver === 'undefined')
        {
            return;
        }
        const c = this._getCanvas();
        if (!c)
        {
            return;
        }
        this._ro = new ResizeObserver((): void =>
        {
            if (this._raf)
            {
                this._resize();
            }
        });
        this._ro.observe(c);
    }

    private readonly _loop = (ts: number): void =>
    {
        const c = this._getCanvas();
        const ctx = c?.getContext('2d');
        if (!c || !ctx)
        {
            this._raf = 0; return;
        }
        if (!this._last)
        {
            this._last = ts;
        }
        let dt = (ts - this._last) / 1000;
        this._last = ts;
        if (dt > 0.1)
        {
            dt = 0.1;
        }

        ctx.clearRect(0, 0, this._w, this._h);
        ctx.fillStyle = `rgba(248,250,255,${0.6 + this._intensity * 0.3})`;
        ctx.beginPath();
        for (let i = 0; i < this._flakes.length; i++)
        {
            const f = this._flakes[i];
            f.y += f.spd * dt;
            f.phase += f.sway * dt;
            const x = f.x + Math.sin(f.phase) * f.amp;
            if (f.y > this._h + 10)
            {
                this._flakes[i] = this._newFlake(false); continue;
            }
            ctx.moveTo(x + f.r, f.y);
            ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        }
        ctx.fill();

        this._raf = requestAnimationFrame(this._loop);
    };
}

//Thunderstorm lightning: no canvas, just a scripted flash envelope pushed to the host's --wx-flash var. When
//active it schedules strikes at random intervals (more frequent at higher strength), each a fast double-flash
//that decays over ~350 ms. `setStrength(0..1)` starts/stops it.
export class WeatherStorm
{
    private _raf = 0;
    private _strength = 0;
    private _last = 0;
    private _nextAt = 0;    //timestamp of the next strike (RAF clock)
    private _strikeT0 = -1; //start time of the strike in progress, -1 when idle between strikes
    private _lastFlash = -1;

    constructor(private readonly _set: (flash: number) => void)
    {}

    //Only touch the CSS var when the value actually changes: the multi-second gaps between strikes would otherwise
    //rewrite the same 0 every frame, triggering a style recalc for nothing.
    private _emit(flash: number): void
    {
        if (flash !== this._lastFlash)
        {
            this._lastFlash = flash; this._set(flash);
        }
    }

    setStrength(s: number): void
    {
        this._strength = clamp01(s);
        if (this._strength <= 0)
        {
            this.stop(); return;
        }
        if (!this._raf)
        {
            this._last = 0; this._nextAt = 0; this._strikeT0 = -1; this._raf = requestAnimationFrame(this._loop);
        }
    }

    stop(): void
    {
        if (this._raf)
        {
            cancelAnimationFrame(this._raf); this._raf = 0;
        }
        this._emit(0);
    }

    //Random gap to the next strike, shorter at higher strength (~3-7 s at full, ~7-15 s when faint).
    private _gap(): number
    {
        const base = 7000 - this._strength * 4000;
        return base + Math.random() * base;
    }

    //Flash envelope for a strike, τ in ms since it began: sharp flash, brief dip, second flash, then decay.
    private static _envelope(tau: number): number
    {
        if (tau < 45)
        {
            return 1;
        }
        if (tau < 95)
        {
            return 0.28;
        }
        if (tau < 150)
        {
            return 0.85;
        }
        if (tau < 360)
        {
            return 0.85 * (1 - (tau - 150) / 210);
        }
        return 0;
    }

    private readonly _loop = (ts: number): void =>
    {
        if (!this._last)
        {
            this._last = ts; this._nextAt = ts + this._gap();
        }

        if (this._strikeT0 < 0)
        {
            //Between strikes: dark, waiting for the scheduled time.
            this._emit(0);
            if (ts >= this._nextAt)
            {
                this._strikeT0 = ts;
            }
        }
        else
        {
            const tau = ts - this._strikeT0;
            this._emit(WeatherStorm._envelope(tau) * (0.7 + this._strength * 0.3));
            if (tau >= 360)
            {
                this._strikeT0 = -1; this._nextAt = ts + this._gap();
            }
        }

        this._last = ts;
        this._raf = requestAnimationFrame(this._loop);
    };
}
