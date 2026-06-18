//Formatting/validation helpers shared between the card render path and the visual editor. Kept
//dependency-free so any card-side module can pull them in without dragging Lit or engine symbols along.


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
