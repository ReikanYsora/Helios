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

//Rotate a #rrggbb colour's hue by `deg` degrees, keeping saturation + lightness. Used to spread the home
//histogram bands around the solar token by source index — the hex twin of pvSourceColor's hsl() rotation,
//so the prism bands match the per-source chart curves. Returns the input unchanged if it isn't #rrggbb.
export function hueRotate(hex: string, deg: number): string
{
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) { return hex; }
    const r = parseInt(m[1], 16) / 255;
    const g = parseInt(m[2], 16) / 255;
    const b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min)
    {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0)
          : max === g ? (b - r) / d + 2
          :             (r - g) / d + 4;
        h /= 6;
    }
    h = (((h * 360 + deg) % 360) + 360) % 360 / 360;
    const hue2rgb = (p: number, q: number, t: number): number =>
    {
        if (t < 0) { t += 1; }
        if (t > 1) { t -= 1; }
        if (t < 1 / 6) { return p + (q - p) * 6 * t; }
        if (t < 1 / 2) { return q; }
        if (t < 2 / 3) { return p + (q - p) * (2 / 3 - t) * 6; }
        return p;
    };
    const q  = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p  = 2 * l - q;
    const to = (v: number): string => Math.round(v * 255).toString(16).padStart(2, '0');
    return '#' + to(hue2rgb(p, q, h + 1 / 3)) + to(hue2rgb(p, q, h)) + to(hue2rgb(p, q, h - 1 / 3));
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
