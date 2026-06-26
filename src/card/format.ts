//Formatting/validation helpers shared between the card render path and the visual editor. Kept
//dependency-free so any card-side module can pull them in without dragging Lit or engine symbols along.

import { Xn, Yn, Zn, LAB_T0, LAB_T1, LAB_T2, LAB_T3 } from '../constants';


//Format a number with the user's locale (decimal mark, grouping). Falls back to locale-independent
//toFixed when Intl rejects the resolved locale, guarding against custom HA locales that aren't valid
//BCP-47 tags. `integer = true` rounds to the nearest integer and drops fraction digits.
export function formatLocalisedNumber(
    hass: any,
    value: number,
    fractionDigits: number,
    integer: boolean = false
): string
{
    //Guard against NaN / Infinity / undefined from cold-cache reads or upstream parser failures:
    //`Intl.NumberFormat.format(NaN)` yields the literal "NaN" in chips, so render a neutral zero
    //placeholder until real data lands.
    if (!isFinite(value))
    {
        return integer ? '0' : (0).toFixed(fractionDigits);
    }
    const locale = (hass?.locale?.language as string | undefined)
        ?? (hass?.language as string | undefined)
        ?? undefined;
    const opts: Intl.NumberFormatOptions = integer
        ? { maximumFractionDigits: 0 }
        : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
    try
    {
        return new Intl.NumberFormat(locale, opts).format(value);
    }
    catch (_)
    {
        return integer ? Math.round(value).toString() : value.toFixed(fractionDigits);
    }
}


//Uniform power readout: always kilowatts, locale-aware, with the caller's decimal count, so every
//chip prints the same unit/precision regardless of the source sensor's native unit. Input is watts.
//`signed` prefixes an explicit + / − (figure-dash) so battery charge reads apart from discharge.
export function formatPowerKw(hass: any, watts: number, decimals: number, signed: boolean = false): string
{
    if (signed)
    {
        const sign = watts > 0 ? '+' : (watts < 0 ? '−' : '');
        return `${sign}${formatLocalisedNumber(hass, Math.abs(watts) / 1000, decimals)} kW`;
    }
    return `${formatLocalisedNumber(hass, watts / 1000, decimals)} kW`;
}


//Uniform energy readout: always kilowatt-hours, locale-aware, caller's decimal count. Input already in kWh.
export function formatEnergyKwh(hass: any, kwh: number, decimals: number): string
{
    return `${formatLocalisedNumber(hass, kwh, decimals)} kWh`;
}


//Normalise an energy value + unit to kilowatt-hours. Mirrors pvNormalizeToWatts: Wh / kWh / MWh fold
//to kWh; an unknown unit is treated as already kWh so the caller still prints a finite number.
export function energyToKwh(value: number, unit: string): number
{
    switch ((unit || '').trim().toLowerCase())
    {
        case 'wh':  return value / 1000;
        case 'mwh': return value * 1000;
        default:    return value;
    }
}


//Convert a POWER RATE into watts on a unit-agnostic scale. Lives here (not pv.ts) so it sits next to the
//other unit converters and the shared formatter below; pv.ts re-exports it so existing import sites hold.
//
//Contract: `value` MUST already be an instantaneous power rate (W/kW/MW). Cumulative-energy (Wh/kWh/MWh) must be
//differentiated caller-side first. Passing a raw cumulative reading returns 0 (pausing animation rather than
//mis-scaling kWh as watts) — an intentional wiring trap for future callers.
export function pvNormalizeToWatts(value: number, unit: string): number
{
    const lu = (unit || '').toLowerCase();
    if (lu === 'kw')
    {
        return value * 1000;
    }
    if (lu === 'mw')
    {
        return value * 1_000_000;
    }
    if (lu === 'w')
    {
        return value;
    }
    return 0;
}


//Shared chip value formatter: power sources (W/kW/MW) print kW, energy sources (Wh/kWh/MWh) print kWh, both
//locale-aware at the configured precision so chips read uniform regardless of the source sensor's native unit.
//An unknown unit keeps the entity's own unit string but still honours the decimal setting. Callers add their
//own null-handling / signing around this.
export function formatEntityValue(hass: any, value: number, unit: string, decimals: number): string
{
    const u  = (unit || '').trim();
    const lu = u.toLowerCase();

    if (lu === 'w' || lu === 'kw' || lu === 'mw')
    {
        return formatPowerKw(hass, pvNormalizeToWatts(value, unit), decimals);
    }
    if (lu === 'wh' || lu === 'kwh' || lu === 'mwh')
    {
        return formatEnergyKwh(hass, energyToKwh(value, unit), decimals);
    }
    const formatted = formatLocalisedNumber(hass, value, decimals);
    return u ? `${formatted} ${u}` : formatted;
}


//Darken a #rrggbb hex by a factor in [0, 1] (0 = unchanged, 1 = pure black). Multiplicative per
//channel, keeping hue intact. Derives the darker sun-disc rim from the configured sun colour so the
//rim stays visible without a second config key.
export function darkenHex(hex: string, factor: number): string
{
    const f = 1 - Math.max(0, Math.min(1, factor));
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * f);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * f);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * f);
    const h = (n: number) => n.toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
}


//Linear blend between two #rrggbb hex colours: `t` = 0 returns `a`, `t` = 1 returns `b`. The cloud
//disc uses it to derive light (low) and dark (high) band shades from one configured cloud colour.
export function lerpHexToward(a: string, b: string, t: number): string
{
    const u = Math.max(0, Math.min(1, t));
    const ar = parseInt(a.slice(1, 3), 16);
    const ag = parseInt(a.slice(3, 5), 16);
    const ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16);
    const bg = parseInt(b.slice(3, 5), 16);
    const bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ar + (br - ar) * u);
    const g = Math.round(ag + (bg - ag) * u);
    const bl = Math.round(ab + (bb - ab) * u);
    const h = (n: number) => n.toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(bl)}`;
}


// Cloud-cover icon
//Cloud-cover MDI icon resolver for the cloud-cover chip.


//Map a 0..100 cloud cover to a Material Design weather glyph.
export function cloudCoverIcon(coverPct: number): string
{
    if (coverPct < 0)
    {
        return 'mdi:weather-cloudy';
    }
    if (coverPct < 15)
    {
        return 'mdi:weather-sunny';
    }
    if (coverPct < 40)
    {
        return 'mdi:weather-partly-cloudy';
    }
    if (coverPct < 75)
    {
        return 'mdi:weather-cloudy';
    }
    return 'mdi:weather-pouring';
}


// HA energy theme colours + LAB ramp
//Theme colour resolution for the card. Wherever a colour must be a concrete string — canvas chart
//fills, inline SVG attributes — rather than a CSS var(), we resolve the live HA theme token off a host
//element's computed style, so a user's custom theme flows through and we don't hardcode hex. A literal
//fallback covers the case where the token is unset.

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
//The D65 white-point + LAB transfer thresholds live in constants.ts.
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
//Memo for the deterministic LAB ramp step, keyed by base+dark+idx — the per-source colours are recomputed
//on every chart/tooltip/histogram render, but the conversion only depends on those three.
const _solarRampMemo = new Map<string, string>();

export function energySolarColor(host: Element | null | undefined, dark: boolean, idx: number): string
{
    if (host)
    {
        const override = getComputedStyle(host).getPropertyValue(`--energy-solar-color-${idx}`).trim();
        if (override) { return cssHex(host, `--energy-solar-color-${idx}`, '#ff9800'); }
    }
    const base = cssHex(host, '--energy-solar-color', '#ff9800');
    if (!idx) { return base; }
    const key = `${base}|${dark}|${idx}`;
    let out = _solarRampMemo.get(key);
    if (out === undefined)
    {
        const lab = rgbToLab(hexToRgb(base));
        out = labToHex([lab[0] + (dark ? 18 : -18) * idx, lab[1], lab[2]]);
        _solarRampMemo.set(key, out);
    }
    return out;
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
