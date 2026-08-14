//Formatting/validation helpers shared between the card render path and the visual editor. Kept
//dependency-free so any card-side module can pull them in without dragging Lit or engine symbols along.

import type { HassLike } from '../ha-types';
import { Xn, Yn, Zn, LAB_T0, LAB_T1, LAB_T2, LAB_T3, SUN_COLOR_HEX } from '../config/constants';
import { mixHex, hexByte } from '../render-kit/hex';
import { clamp } from '../render-kit/math';


//Format a number with the user's locale (decimal mark, grouping). Falls back to locale-independent
//toFixed when Intl rejects the resolved locale, guarding against custom HA locales that aren't valid
//BCP-47 tags. `integer = true` rounds to the nearest integer and drops fraction digits.
export function formatLocalisedNumber(
    hass: HassLike,
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

//Format a Date with the user's HA language + a caller-supplied options set, falling back to the runtime default
//locale if the language tag is rejected. No time-zone conversion: callers pass a local Date for wall-clock display.
function formatWithHaLocale(hass: HassLike, date: Date, opts: Intl.DateTimeFormatOptions): string
{
    const locale = hass?.locale as { time_format?: string; language?: string } | undefined;
    const withAmPm: Intl.DateTimeFormatOptions = { ...opts, hour12: haUseAmPm(locale) };
    try
    {
        return new Intl.DateTimeFormat(locale?.language, withAmPm).format(date);
    }
    catch (_)
    {
        return new Intl.DateTimeFormat(undefined, withAmPm).format(date);
    }
}

//Format a time like the HA frontend: hour + minute in the user's language, honouring their 12/24-hour setting.
export function formatHaTime(hass: HassLike, date: Date): string
{
    return formatWithHaLocale(hass, date, { hour: 'numeric', minute: '2-digit' });
}


//Date + time like the HA frontend (day, short month, hour:minute, honouring 12/24h), for the timeline scrub readout
//where the coarse axis labels (months on a year window) don't pin the exact instant.
export function formatHaDateTime(hass: HassLike, date: Date): string
{
    return formatWithHaLocale(hass, date, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}


//Power display unit for the whole card, resolved from config (see powerUnit()). Energy readouts stay kWh.
export type PowerUnit = 'W' | 'kW';

//Uniform power readout in the card's configured unit, locale-aware. Input is watts. 'kW' divides by 1000 at the
//caller's decimal count; 'W' prints whole watts (a fractional watt is meaningless). `signed` prefixes an explicit
//+/- so battery charge reads apart from discharge.
export function formatPower(hass: HassLike, watts: number, decimals: number, unit: PowerUnit, signed = false): string
{
    const mag = signed ? Math.abs(watts) : watts;
    //Sign from the ROUNDED display magnitude: a value that snaps to 0 at the shown precision prints no sign, so a
    //tiny negative reading reads "0 kW", never "-0.0 kW".
    const displayMag = unit === 'W' ? Math.round(mag) : Number((mag / 1000).toFixed(decimals));
    const sign = signed && displayMag !== 0 ? (watts < 0 ? '-' : '+') : '';
    if (unit === 'W')
    {
        return `${sign}${formatLocalisedNumber(hass, Math.round(mag), 0)} W`;
    }
    return `${sign}${formatLocalisedNumber(hass, mag / 1000, decimals)} kW`;
}

//Power readout defaulting to 'kW'. Callers that respect the user's power-unit setting pass it through.
export function formatPowerKw(hass: HassLike, watts: number, decimals: number, signed = false, unit: PowerUnit = 'kW'): string
{
    return formatPower(hass, watts, decimals, unit, signed);
}

//Irradiance (solar constant) readout in the configured unit. Input is W/m². 'W/m²' prints whole units; 'kW/m²'
//divides by 1000 at the caller's decimal count (a typical peak reads ~1 kW/m²).
export function formatIrradiance(hass: HassLike, wPerM2: number, decimals: number, unit: 'W/m²' | 'kW/m²'): string
{
    const v = Math.max(0, wPerM2);
    if (unit === 'kW/m²')
    {
        return `${formatLocalisedNumber(hass, v / 1000, decimals)} kW/m²`;
    }
    return `${formatLocalisedNumber(hass, Math.round(v), 0)} W/m²`;
}


//Uniform energy readout, locale-aware. Input is kWh. The card's power unit drives the energy scale too, so the
//whole card stays SI-consistent: 'kW' keeps kWh at the caller's decimals; 'W' prints whole watt-hours (Wh).
export function formatEnergyKwh(hass: HassLike, kwh: number, decimals: number, unit: PowerUnit = 'kW'): string
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
export function formatEntityValue(hass: HassLike, value: number, unit: string, decimals: number, powerU: PowerUnit = 'kW'): string
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
    const f = 1 - clamp(factor, 0, 1);
    const h = (n: number) => Math.round(n * f).toString(16).padStart(2, '0');
    return `#${h(hexByte(hex, 1))}${h(hexByte(hex, 3))}${h(hexByte(hex, 5))}`;
}


//Linear blend between two #rrggbb hex colours: `t` = 0 returns `a`, `t` = 1 returns `b`. The cloud
//disc uses it to derive light (low) and dark (high) band shades from one configured cloud colour.
export function lerpHexToward(a: string, b: string, t: number): string
{
    return mixHex(a, b, clamp(t, 0, 1));
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
    const rounded = clamp(Math.round(soc / 10) * 10, 0, 100);
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
//theme resolves it. `uiColorVar` yields the var NAME (for the engine, which reads it to hex via getComputedStyle).
export function uiColorVar(token: string | undefined, fallbackToken: string): string
{
    const t = (token ?? '').trim();
    return `--${t || fallbackToken}-color`;
}

//Resolve a user-set colour to something paintable: a literal (#hex / rgb()) passes straight through, anything else
//is an HA ui_color token read off the live theme, and an unset one falls back.
//
//ONE resolver on purpose. This test used to be copy-pasted at each call site, and the copies drifted: chips, map
//layers and monitoring groups took a #hex, while the building tint and the home colour did not. Those two wrapped
//the value in a var() name whatever it was, so a hex became `var(--#ff0000-color)` -- meaningless, silently
//discarded, and the building just stayed grey. Same config, same look to a user, different answer.
export function resolveUiColor(
    el:            Element | null | undefined,
    token:         string | undefined,
    fallbackHex:   string,
    fallbackToken  = '',
): string
{
    const t = (token ?? '').trim();
    //A literal colour passes through untouched: #hex, rgb()/rgba(), or a var() reference (else `var(--x)` would be
    //wrapped into the meaningless `var(--var(--x)-color)`). Matches monitoringGroupColor so every colour input behaves the same.
    if (/^(#|rgb|var)/i.test(t))
    {
        return t;
    }
    //Nothing set and no token-level default: the caller's hex IS the answer.
    if (!t && !fallbackToken)
    {
        return fallbackHex;
    }
    return cssHex(el, uiColorVar(t, fallbackToken), fallbackHex);
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
        //Resolve to #rrggbb via the shared parser (handles #rgb / #rrggbb / rgb()); an unset/unparseable token
        //resolves to the white fallback, i.e. "not dark".
        const hex = cssHex(host, '--primary-background-color', '#ffffff');
        const lum = (0.299 * hexByte(hex, 1) + 0.587 * hexByte(hex, 3) + 0.114 * hexByte(hex, 5)) / 255;
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
        hexByte(hex, 1),
        hexByte(hex, 3),
        hexByte(hex, 5),
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
//explicit `--energy-solar-color-<idx>` override. Returns #rrggbb. Used for the per-source chart curves so they
//always match the energy dashboard.
//Memo for the deterministic LAB ramp step, keyed by base+dark+idx: per-source colours are recomputed every
//chart/tooltip render, but the conversion only depends on those three.
const _energyRampMemo = new Map<string, string>();

//HA's getEnergyColor logic, ported: a source's colour is the theme override --<var>-<idx> when set, else the base
//--<var> shifted in LAB lightness by 18 per index (brighten in dark, darken in light). Shared by solar/grid/battery
//so multi-source curves read exactly like the HA Energy dashboard.
export function energyRampColor(host: Element | null | undefined, dark: boolean, idx: number, propertyVar: string, fallback: string): string
{
    if (host)
    {
        const override = getComputedStyle(host).getPropertyValue(`${propertyVar}-${idx}`).trim();
        if (override) { return cssHex(host, `${propertyVar}-${idx}`, fallback); }
    }
    const base = cssHex(host, propertyVar, fallback);
    if (!idx) { return base; }
    const key = `${propertyVar}|${base}|${dark}|${idx}`;
    let out = _energyRampMemo.get(key);
    if (out === undefined)
    {
        const lab = rgbToLab(hexToRgb(base));
        out = labToHex([lab[0] + (dark ? 18 : -18) * idx, lab[1], lab[2]]);
        _energyRampMemo.set(key, out);
    }
    return out;
}

export function energySolarColor(host: Element | null | undefined, dark: boolean, idx: number): string
{
    return energyRampColor(host, dark, idx, '--energy-solar-color', '#ff9800');
}

export function energyGridColor(host: Element | null | undefined, dark: boolean, idx: number, dir: 'import' | 'export'): string
{
    return dir === 'import'
        ? energyRampColor(host, dark, idx, '--energy-grid-consumption-color', '#488fc2')
        : energyRampColor(host, dark, idx, '--energy-grid-return-color', '#8353d1');
}

export function energyBatteryColor(host: Element | null | undefined, dark: boolean, idx: number, dir: 'charge' | 'discharge'): string
{
    return dir === 'charge'
        ? energyRampColor(host, dark, idx, '--energy-battery-in-color', '#f06292')
        : energyRampColor(host, dark, idx, '--energy-battery-out-color', '#4db6ac');
}

//Colour HA gives an individual device by its position in the Energy dashboard's device list: the theme's
//`--graph-color-{index+1}`, falling back to `--color-{(index % 54)+1}`, then grey. Lets the device curves
//match the colours the user already sees on the dashboard's devices graph.
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
