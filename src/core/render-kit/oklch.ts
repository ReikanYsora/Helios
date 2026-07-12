//Perceptual colour mixing in OKLab. Used by the Energy Fingerprint heatmap to blend each 15-minute slot's energy
//sources (grid import / solar / battery discharge) by their share of consumption, without the muddy mid-tones an
//sRGB average produces. All colours come from the active theme at runtime (resolved via getComputedStyle); nothing
//here hardcodes a hue.

//Parsed straight-alpha sRGB, channels 0..255.
interface Rgb { r: number; g: number; b: number }

//Parse a browser-resolved colour string. getComputedStyle returns `rgb(r, g, b)` / `rgba(r, g, b, a)`; a theme
//that sets a variable to a hex literal resolves to that hex. Returns null for anything unparseable (transparent,
//named colours, empty), so the caller can fall back.
export function parseColor(input: string): Rgb | null
{
    const s = input.trim();
    if (s === '' || s === 'transparent') { return null; }
    const m = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (m)
    {
        const parts = m[1].split(/[,\s/]+/).filter(Boolean);
        if (parts.length < 3) { return null; }
        const r = parseFloat(parts[0]);
        const g = parseFloat(parts[1]);
        const b = parseFloat(parts[2]);
        if (![r, g, b].every(Number.isFinite)) { return null; }
        return { r, g, b };
    }
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    if (hex)
    {
        let h = hex[1];
        if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    }
    return null;
}

const srgbToLinear = (c: number): number =>
{
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (c: number): number =>
{
    const x = c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055;
    return Math.max(0, Math.min(255, Math.round(x * 255)));
};

//OKLCh = { L lightness 0..1, C chroma >=0, h hue radians }.
interface Oklch { L: number; C: number; h: number }

function rgbToOklch({ r, g, b }: Rgb): Oklch
{
    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);
    const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);
    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    return { L, C: Math.hypot(a, bb), h: Math.atan2(bb, a) };
}

function oklchToRgb({ L, C, h }: Oklch): Rgb
{
    const a = C * Math.cos(h);
    const bb = C * Math.sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * bb;
    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;
    return {
        r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
    };
}

//A colour in OKLab rectangular coordinates (L, a, b), the space to average in: weighted sums stay perceptually
//sensible and never loop the hue wheel the wrong way (the failure mode of averaging OKLCh hue angles directly).
export interface OklabColor { L: number; a: number; b: number }

//Pre-convert a resolved colour string to OKLab once, so painting a whole grid only does weighted sums. Null if
//the string is unparseable.
export function toOklab(color: string): OklabColor | null
{
    const rgb = parseColor(color);
    if (!rgb) { return null; }
    const { L, C, h } = rgbToOklch(rgb);
    return { L, a: C * Math.cos(h), b: C * Math.sin(h) };
}

//Weighted blend of several OKLab colours -> `rgb(r, g, b)` string. Weights are the fractions each source contributes
//(they need not sum to 1; the result is normalised). Returns null when the total weight is zero.
export function mixOklab(items: { c: OklabColor; w: number }[]): string | null
{
    let L = 0; let a = 0; let b = 0; let tw = 0;
    for (const { c, w } of items)
    {
        if (w <= 0) { continue; }
        L += c.L * w; a += c.a * w; b += c.b * w; tw += w;
    }
    if (tw <= 0) { return null; }
    L /= tw; a /= tw; b /= tw;
    const rgb = oklchToRgb({ L, C: Math.hypot(a, b), h: Math.atan2(b, a) });
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}
