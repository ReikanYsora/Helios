//Theme colour resolution for the card. Wherever a colour must be a concrete string — canvas chart
//fills, inline SVG attributes — rather than a CSS var(), we resolve the live HA theme token off a host
//element's computed style, so a user's custom theme flows through and we don't hardcode hex. A literal
//fallback covers the case where the token is unset. Mirrors the source Solar scene card's colour wiring.

//Resolve a CSS custom property to #rrggbb off the host's computed style. Accepts #rgb / #rrggbb /
//rgb()/rgba(); falls back when the token is empty or unparseable.
export function cssHex(host: Element | null | undefined, token: string, fallback: string): string
{
    if (!host)
    {
        return fallback;
    }
    const raw = getComputedStyle(host).getPropertyValue(token).trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) { return raw; }
    if (/^#[0-9a-f]{3}$/i.test(raw)) { return '#' + raw.slice(1).split('').map(c => c + c).join(''); }
    const m = raw.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
    if (m)
    {
        const h = (n: string): string => Math.max(0, Math.min(255, Math.round(parseFloat(n)))).toString(16).padStart(2, '0');
        return '#' + h(m[1]) + h(m[2]) + h(m[3]);
    }
    return fallback;
}

//RGB↔LAB conversion (chroma.js, via HA's common/color), used for the per-energy-source colour ramp below.
/* eslint-disable @typescript-eslint/naming-convention */
const Xn = 0.95047;
const Yn = 1;
const Zn = 1.08883;
/* eslint-enable @typescript-eslint/naming-convention */
const LAB_T0 = 0.137931034;
const LAB_T1 = 0.206896552;
const LAB_T2 = 0.12841855;
const LAB_T3 = 0.008856452;
const rgbXyz = (c: number): number => { const r = c / 255; return r <= 0.04045 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4; };
const xyzLab = (t: number): number => (t > LAB_T3 ? t ** (1 / 3) : t / LAB_T2 + LAB_T0);
const xyzRgb = (r: number): number => 255 * (r <= 0.00304 ? 12.92 * r : 1.055 * r ** (1 / 2.4) - 0.055);
const labXyz = (t: number): number => (t > LAB_T1 ? t * t * t : LAB_T2 * (t - LAB_T0));

function hexToRgb(hex: string): [number, number, number]
{
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}

function rgbToLab([r, g, b]: [number, number, number]): [number, number, number]
{
    const rr = rgbXyz(r);
    const gg = rgbXyz(g);
    const bb = rgbXyz(b);
    const x = xyzLab((0.4124564 * rr + 0.3575761 * gg + 0.1804375 * bb) / Xn);
    const y = xyzLab((0.2126729 * rr + 0.7151522 * gg + 0.072175  * bb) / Yn);
    const z = xyzLab((0.0193339 * rr + 0.119192  * gg + 0.9503041 * bb) / Zn);
    const l = 116 * y - 16;
    return [l < 0 ? 0 : l, 500 * (x - y), 200 * (y - z)];
}

function labToHex([l, a, b]: [number, number, number]): string
{
    let y = (l + 16) / 116;
    let x = y + a / 500;
    let z = y - b / 200;
    y = Yn * labXyz(y);
    x = Xn * labXyz(x);
    z = Zn * labXyz(z);
    const r  = Math.round(xyzRgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z));
    const g  = Math.round(xyzRgb(-0.969266 * x + 1.8760108 * y + 0.041556  * z));
    const b2 = Math.round(xyzRgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z));
    const h  = (c: number): string => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b2);
}

//Per-energy-source colour, identical to HA Energy's getEnergyColor: source `idx` 0 is the base solar token;
//higher indices brighten it (dark theme) or darken it (light theme) by 18 LAB-lightness units per step,
//unless the theme defines an explicit `--energy-solar-color-<idx>` override. Returns #rrggbb. Used for both
//the per-source chart curves and the home histogram bands so the two always match the energy dashboard.
export function energySolarColor(host: Element | null | undefined, dark: boolean, idx: number): string
{
    if (host)
    {
        const override = getComputedStyle(host).getPropertyValue(`--energy-solar-color-${idx}`).trim();
        if (override) { return cssHex(host, `--energy-solar-color-${idx}`, '#ff9800'); }
    }
    const base = cssHex(host, '--energy-solar-color', '#ff9800');
    if (!idx) { return base; }
    const lab = rgbToLab(hexToRgb(base));
    return labToHex([lab[0] + (dark ? 18 : -18) * idx, lab[1], lab[2]]);
}

//The card's semantic colours, resolved from the HA Energy palette tokens (the same ones HA's own energy
//cards use) with the palette defaults as fallbacks. Pass the card element as host.
export const ENERGY_COLOR = {
    pv:         (h: Element | null | undefined): string => cssHex(h, '--energy-solar-color', '#ff9800'),
    //Home consumption (load): the same consumption-blue the home pill rests in, so chip + chart agree.
    consumption:(h: Element | null | undefined): string => cssHex(h, '--energy-grid-consumption-color', '#488fc2'),
    gridImport: (h: Element | null | undefined): string => cssHex(h, '--energy-grid-consumption-color', '#488fc2'),
    gridExport: (h: Element | null | undefined): string => cssHex(h, '--energy-grid-return-color', '#8353d1'),
    batteryIn:  (h: Element | null | undefined): string => cssHex(h, '--energy-battery-in-color', '#f06292'),
    batteryOut: (h: Element | null | undefined): string => cssHex(h, '--energy-battery-out-color', '#4db6ac'),
    sun:        (h: Element | null | undefined): string => cssHex(h, '--warning-color', '#ffc107'),
    cloud:      (h: Element | null | undefined): string => cssHex(h, '--secondary-text-color', '#727272'),
} as const;
