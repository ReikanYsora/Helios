//Formatting/validation helpers shared between the card render path and the visual editor. Kept
//dependency-free so any card-side module can pull them in without dragging Lit or engine symbols along.

import { Xn, Yn, Zn, LAB_T0, LAB_T1, LAB_T2, LAB_T3, SUN_COLOR_HEX } from '../config/constants';
import { mixHex } from '../render-kit/hex';


//Format a number with the user's locale (decimal mark, grouping). Falls back to locale-independent
//toFixed when Intl rejects the resolved locale, guarding against custom HA locales that aren't valid
//BCP-47 tags. `integer = true` rounds to the nearest integer and drops fraction digits.
export function formatLocalisedNumber(
    hass: any,
    value: number,
    fractionDigits: number,
    integer = false
): string
{
    //Guard against NaN / Infinity / undefined from cold-cache reads or upstream parser failures:
    //`Intl.NumberFormat.format(NaN)` yields the literal "NaN" in chips, so render a neutral zero
    //placeholder until real data lands.
    if (!isFinite(value))
    {
        return integer ? '0' : (0).toFixed(fractionDigits);
    }
    //Snap values that ROUND to zero at the requested precision to a true zero: a -0.4 W sensor
    //blip otherwise renders as "-0,00 kW" (Intl keeps the sign of a negative near-zero).
    const snapEps = integer ? 0.5 : 0.5 * 10 ** -fractionDigits;
    if (Math.abs(value) < snapEps)
    {
        value = 0;
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


//HA's am/pm decision: the user's explicit 12/24-hour choice from hass.locale.time_format, falling back to the
//language/system default by probing the runtime, so a time we format reads exactly as the rest of the dashboard does.
function haUseAmPm(locale: { time_format?: string; language?: string } | undefined): boolean
{
    const tf = locale?.time_format;
    if (tf === '12') { return true; }
    if (tf === '24') { return false; }
    //'language' or 'system' (or unset): probe the runtime, honouring the chosen language for 'language'.
    const testLang = tf === 'language' ? locale?.language : undefined;
    try
    {
        const probe = new Date().toLocaleString(testLang);
        return probe.includes('AM') || probe.includes('PM');
    }
    catch (_)
    {
        return false;
    }
}

//Format a time like the HA frontend: hour + minute in the user's language, honouring their 12/24-hour setting. No
//time-zone conversion: callers pass a local Date for the clock face, so the hour shown is the one meant.
export function formatHaTime(hass: any, date: Date): string
{
    const locale = hass?.locale as { time_format?: string; language?: string } | undefined;
    const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: haUseAmPm(locale) };
    try
    {
        return new Intl.DateTimeFormat(locale?.language, opts).format(date);
    }
    catch (_)
    {
        return new Intl.DateTimeFormat(undefined, opts).format(date);
    }
}


//Hour-only label (no minutes), localised + 12/24h aware: "12 AM" / "1 PM" in
//am/pm locales, the bare hour in 24h ones. For the clock dial's 24 ground
//labels, where a ":00" on every hour is noise (and very long in English am/pm).
export function formatHaHour(hass: any, date: Date): string
{
    const locale = hass?.locale as { time_format?: string; language?: string } | undefined;
    const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', hour12: haUseAmPm(locale) };
    try
    {
        return new Intl.DateTimeFormat(locale?.language, opts).format(date);
    }
    catch (_)
    {
        return new Intl.DateTimeFormat(undefined, opts).format(date);
    }
}


//Date + time like the HA frontend (day, short month, hour:minute, honouring 12/24h), for the timeline scrub readout
//where the coarse axis labels (months on a year window) don't pin the exact instant.
export function formatHaDateTime(hass: any, date: Date): string
{
    const locale = hass?.locale as { time_format?: string; language?: string } | undefined;
    const opts: Intl.DateTimeFormatOptions = {
        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: haUseAmPm(locale),
    };
    try
    {
        return new Intl.DateTimeFormat(locale?.language, opts).format(date);
    }
    catch (_)
    {
        return new Intl.DateTimeFormat(undefined, opts).format(date);
    }
}


//Power display unit for the whole card, resolved from config (see powerUnit()). Energy readouts stay kWh.
export type PowerUnit = 'W' | 'kW';

//Uniform power readout in the card's configured unit, locale-aware. Input is watts. 'kW' divides by 1000 at the
//caller's decimal count; 'W' prints whole watts (a fractional watt is meaningless). `signed` prefixes an explicit
//+/- so battery charge reads apart from discharge.
export function formatPower(hass: any, watts: number, decimals: number, unit: PowerUnit, signed = false): string
{
    const sign = signed ? (watts > 0 ? '+' : (watts < 0 ? '-' : '')) : '';
    const mag  = signed ? Math.abs(watts) : watts;
    if (unit === 'W')
    {
        return `${sign}${formatLocalisedNumber(hass, Math.round(mag), 0)} W`;
    }
    return `${sign}${formatLocalisedNumber(hass, mag / 1000, decimals)} kW`;
}

//Power readout defaulting to 'kW'. Callers that respect the user's power-unit setting pass it through.
export function formatPowerKw(hass: any, watts: number, decimals: number, signed = false, unit: PowerUnit = 'kW'): string
{
    return formatPower(hass, watts, decimals, unit, signed);
}

//Irradiance (solar constant) readout in the configured unit. Input is W/m². 'W/m²' prints whole units; 'kW/m²'
//divides by 1000 at the caller's decimal count (a typical peak reads ~1 kW/m²).
export function formatIrradiance(hass: any, wPerM2: number, decimals: number, unit: 'W/m²' | 'kW/m²'): string
{
    const v = Math.max(0, wPerM2);
    if (unit === 'kW/m²')
    {
        return `${formatLocalisedNumber(hass, v / 1000, decimals)} kW/m²`;
    }
    return `${Math.round(v)} W/m²`;
}


//Uniform energy readout, locale-aware. Input is kWh. The card's power unit drives the energy scale too, so the
//whole card stays SI-consistent: 'kW' keeps kWh at the caller's decimals; 'W' prints whole watt-hours (Wh).
export function formatEnergyKwh(hass: any, kwh: number, decimals: number, unit: PowerUnit = 'kW'): string
{
    if (unit === 'W')
    {
        return `${formatLocalisedNumber(hass, Math.round(kwh * 1000), 0)} Wh`;
    }
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


//Parse a hass state string into a finite number, tolerant of a comma decimal separator (locales that render
//`1,23`). Returns null on empty/non-numeric so callers gate cleanly. Shared by every live chip read so the same
//state parses identically on the grid, pv, battery and custom chips.
export function parseNumericState(raw: unknown): number | null
{
    if (typeof raw === 'number')
    {
        return Number.isFinite(raw) ? raw : null;
    }
    if (typeof raw !== 'string') { return null; }
    const trimmed = raw.trim();
    if (trimmed === '') { return null; }
    const n = parseFloat(trimmed.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}


//Convert a POWER RATE into watts on a unit-agnostic scale. Lives here (not pv.ts) so it sits next to the other unit
//converters and the shared formatter below; pv.ts re-exports it.
//
//Contract: `value` MUST already be an instantaneous power rate (W/kW/MW). Cumulative-energy (Wh/kWh/MWh) must be
//differentiated caller-side first. Passing a raw cumulative reading returns 0 (pausing animation rather than mis-scaling
//kWh as watts), an intentional wiring trap.
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
export function formatEntityValue(hass: any, value: number, unit: string, decimals: number, powerU: PowerUnit = 'kW'): string
{
    const u  = (unit || '').trim();
    const lu = u.toLowerCase();

    if (lu === 'w' || lu === 'kw' || lu === 'mw')
    {
        return formatPower(hass, pvNormalizeToWatts(value, unit), decimals, powerU);
    }
    if (lu === 'wh' || lu === 'kwh' || lu === 'mwh')
    {
        return formatEnergyKwh(hass, energyToKwh(value, unit), decimals, powerU);
    }
    const formatted = formatLocalisedNumber(hass, value, decimals);
    return u ? `${formatted} ${u}` : formatted;
}


//Darken a #rrggbb hex by a factor in [0, 1] (0 = unchanged, 1 = pure black). Multiplicative per channel, keeping hue
//intact. Derives the darker sun-disc rim from the configured sun colour so the rim stays visible without a second config key.
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
    return mixHex(a, b, Math.max(0, Math.min(1, t)));
}


//Map a 0..100 cloud cover to a Material Design weather glyph for the cloud-cover chip.
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


//Map a 0..100 battery state of charge to the matching Material Design battery glyph, like HA's energy distribution
//card: the level is rounded to the nearest ten and, when charging, the charging variant is used. Empty and full get
//their dedicated icons; a null SoC (power-only install, no level to show) falls back to the neutral battery outline.
export function batteryLevelIcon(soc: number | null, charging: boolean): string
{
    if (soc === null || !isFinite(soc))
    {
        return 'mdi:battery';
    }
    const rounded = Math.max(0, Math.min(100, Math.round(soc / 10) * 10));
    if (charging)
    {
        if (rounded >= 100) { return 'mdi:battery-charging-100'; }
        if (rounded <= 0)   { return 'mdi:battery-charging-outline'; }
        return `mdi:battery-charging-${rounded}`;
    }
    if (rounded >= 100) { return 'mdi:battery'; }
    if (rounded <= 0)   { return 'mdi:battery-outline'; }
    return `mdi:battery-${rounded}`;
}


//HA ui_color tokens: a STRING token, either a theme keyword (primary, accent, disabled) or a Material colour name
//(red, grey, ...), mapping to the CSS var `--<token>-color`. A token is just slugged into its var name and the live
//theme resolves it. `uiColorVar` yields the var NAME (for the engine, which reads it to hex via getComputedStyle);
//`resolveUiColor` yields a ready `var(--token-color, fallback)` for CSS/inline styles, passing through values already
//given as #/rgb/var.
export function uiColorVar(token: string | undefined, fallbackToken: string): string
{
    const t = (token ?? '').trim();
    return `--${t || fallbackToken}-color`;
}

//Theme colour resolution for the card. Wherever a colour must be a concrete string (canvas chart fills, inline SVG
//attributes) rather than a CSS var(), we resolve the live HA theme token off a host element's computed style, so a
//user's custom theme flows through and we don't hardcode hex. A literal fallback covers an unset token.

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

//Fallback luminance probe: reads --primary-background-color and decides dark vs light by relative luminance. Costly
//(forces a style recompute), so only reached when hass.themes.darkMode is undefined.
export function isDarkFromCss(host: Element): boolean
{
    try
    {
        const bg = getComputedStyle(host).getPropertyValue('--primary-background-color').trim();
        if (!bg)
        {
            return false;
        }
        const hexMatch = bg.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        let r = 0; let g = 0; let b = 0;
        if (hexMatch)
        {
            const hex = hexMatch[1].length === 3
                ? hexMatch[1].split('').map(c => c + c).join('')
                : hexMatch[1];
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        }
        else
        {
            const rgbMatch = bg.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (rgbMatch) { r = +rgbMatch[1]; g = +rgbMatch[2]; b = +rgbMatch[3]; }
        }
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return lum < 0.5;
    }
    catch (_) { /* probe failed: fall through to the light-theme default */ }
    return false;
}

//RGB/LAB conversion for the per-energy-source colour ramp below. The D65 white-point + LAB transfer thresholds live in constants.ts.
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

//Per-energy-source colour, matching the HA Energy palette: source `idx` 0 is the base solar token; higher indices
//brighten it (dark theme) or darken it (light theme) by 18 LAB-lightness units per step, unless the theme defines an
//explicit `--energy-solar-color-<idx>` override. Returns #rrggbb. Used for the per-source chart curves and the home
//histogram bands so the two always match the energy dashboard.
//Memo for the deterministic LAB ramp step, keyed by base+dark+idx: per-source colours are recomputed every
//chart/tooltip/histogram render, but the conversion only depends on those three.
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

//Colour HA gives an individual device by its position in the Energy dashboard's device list: the theme's
//`--graph-color-{index+1}`, falling back to `--color-{(index % 54)+1}`, then grey. Lets the day-ring device
//rings match the colours the user already sees on the dashboard's devices graph.
export function deviceColorByIndex(host: Element | null | undefined, index: number): string
{
    return cssHex(host, `--graph-color-${index + 1}`, cssHex(host, `--color-${(index % 54) + 1}`, '#8a8a8a'));
}


//The card's semantic colours, resolved from the HA Energy palette tokens (the same ones HA's own energy
//cards use) with the palette defaults as fallbacks. Pass the card element as host.
export const ENERGY_COLOR = {
    pv:         (h: Element | null | undefined): string => cssHex(h, '--energy-solar-color', '#ff9800'),
    //Home consumption (load): a dedicated green, so it never reads as the grid-import blue.
    consumption:(h: Element | null | undefined): string => cssHex(h, '--helios-consumption-color', '#4caf50'),
    gridImport: (h: Element | null | undefined): string => cssHex(h, '--energy-grid-consumption-color', '#488fc2'),
    gridExport: (h: Element | null | undefined): string => cssHex(h, '--energy-grid-return-color', '#8353d1'),
    batteryIn:  (h: Element | null | undefined): string => cssHex(h, '--energy-battery-in-color', '#f06292'),
    batteryOut: (h: Element | null | undefined): string => cssHex(h, '--energy-battery-out-color', '#4db6ac'),
    sun:        (_h: Element | null | undefined): string => SUN_COLOR_HEX,
    cloud:      (h: Element | null | undefined): string => cssHex(h, '--secondary-text-color', '#727272'),
} as const;
