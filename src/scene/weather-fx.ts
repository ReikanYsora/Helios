//SPIKE (2026.9.0 "Your real sky" de-risk): a THROWAWAY on-card weather overlay driven by ONE continuous index
//w in [0,1] (0 = clear & sunny, 1 = ultra rain). A slider sets it now; later a real weather index (WMO code +
//cloud cover + precipitation) will position the same axis. NOT wired to real weather yet. Remove before release.
//
//The overlay sits between the scene (z 1) and the chips (z 8): weather tints the map/buildings, never the data.
import { html, type TemplateResult } from 'lit';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

//Derived effect strengths for a given index. `sat`/`bright` grade the real scene (#map-container); `sun`/`grey`/
//`cloud`/`rain` fade the overlay layers; `label` is the human condition name (previews the future real index).
export interface WxParams { sun: number; grey: number; cloud: number; rain: number; sat: number; bright: number; label: string; }

export function wxParams(w: number): WxParams
{
    const x = clamp01(w);
    return {
        sun:    clamp01(1 - x / 0.35),        //full sun at 0, gone by ~0.35
        grey:   clamp01((x - 0.12) / 0.40),   //greys in from ~0.12
        cloud:  clamp01((x - 0.18) / 0.35),   //cloud shadows in from ~0.18
        rain:   clamp01((x - 0.50) / 0.50),   //rain from 0.5 → 1
        sat:    1.12 - 0.72 * x,               //scene saturation: 1.12 → 0.40
        bright: 1.06 - 0.42 * x,               //scene brightness: 1.06 → 0.64
        label:
            x < 0.10 ? 'Clear' :
            x < 0.25 ? 'Fair' :
            x < 0.45 ? 'Partly cloudy' :
            x < 0.62 ? 'Overcast' :
            x < 0.82 ? 'Rain' : 'Heavy rain',
    };
}

//Pure markup (no handlers): the CSS-driven layers + the rain canvas. Strengths come from the host's --wx-* vars.
export function weatherOverlay(): TemplateResult
{
    return html`
        <div class="helios-wx">
            <div class="helios-wx-warm"></div>
            <div class="helios-wx-shafts"></div>
            <div class="helios-wx-sunbloom"></div>
            <div class="helios-wx-veil-grey"></div>
            <div class="helios-wx-veil-dark"></div>
            <div class="helios-wx-clouds">
                <div class="helios-wx-cloud k1"></div>
                <div class="helios-wx-cloud k2"></div>
                <div class="helios-wx-cloud k3"></div>
            </div>
            <div class="helios-wx-wet"></div>
            <canvas class="helios-wx-rain"></canvas>
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

    constructor(private readonly _getCanvas: () => HTMLCanvasElement | undefined) {}

    setIntensity(amt: number): void
    {
        this._intensity = clamp01(amt);
        const target = Math.round(this._intensity * this._max);
        if (target <= 0) { this.stop(); return; }
        this._resize();
        while (this._drops.length < target) { this._drops.push(this._newDrop(true)); }
        if (this._drops.length > target) { this._drops.length = target; }
        if (!this._raf) { this._last = 0; this._raf = requestAnimationFrame(this._loop); }
    }

    stop(): void
    {
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
        this._rings = [];
        const c = this._getCanvas();
        const ctx = c?.getContext('2d');
        if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); }
    }

    private _resize(): void
    {
        const c = this._getCanvas();
        if (!c) { return; }
        const r = c.getBoundingClientRect();
        this._dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        this._w = r.width;
        this._h = r.height;
        c.width = Math.round(this._w * this._dpr);
        c.height = Math.round(this._h * this._dpr);
        const ctx = c.getContext('2d');
        if (ctx) { ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0); }
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

    private readonly _loop = (ts: number): void =>
    {
        const c = this._getCanvas();
        const ctx = c?.getContext('2d');
        if (!c || !ctx) { this._raf = 0; return; }
        if (Math.round(c.getBoundingClientRect().width) !== Math.round(this._w)) { this._resize(); }

        if (!this._last) { this._last = ts; }
        let dt = (ts - this._last) / 1000;
        this._last = ts;
        if (dt > 0.1) { dt = 0.1; }

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
            if (d.y > this._h + 20 || d.x > this._w + 40) { this._drops[i] = this._newDrop(false); continue; }
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
            if (g.a <= 0) { this._rings.splice(j, 1); continue; }
            ctx.globalAlpha = Math.max(0, g.a);
            ctx.beginPath();
            ctx.ellipse(g.x, g.y, g.r, g.r * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        this._raf = requestAnimationFrame(this._loop);
    };
}
