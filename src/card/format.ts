//Small formatting and validation helpers shared between the card render path and the visual editor. Kept dependency-free so any card-side module can
//pull them in without dragging Lit or engine symbols along.


//Format a number with the user's locale (decimal mark, grouping).
//Falls back to a locale-independent toFixed when Intl rejects the
//resolved locale string, which protects against custom HA locales
//that aren't valid BCP-47 tags. `integer = true` rounds to the
//nearest integer and drops the fraction digits entirely.
export function formatLocalisedNumber(
    hass: any,
    value: number,
    fractionDigits: number,
    integer: boolean = false
): string
{
    //Guard against NaN / Infinity / undefined-coerced-to-number coming from cold-cache reads or upstream parser failures. Without
    //this guard `Intl.NumberFormat.format(NaN)` returns the literal "NaN" string which surfaces in chips; we render a neutral
    //zero placeholder instead so the chip stays readable until real data lands.
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
//chip prints the same unit and precision regardless of the source sensor's native unit. Input is
//watts. `signed` prefixes an explicit + / − (the card's figure-dash) so battery charge reads apart
//from discharge at a glance; unsigned just formats the value.
export function formatPowerKw(hass: any, watts: number, decimals: number, signed: boolean = false): string
{
    if (signed)
    {
        const sign = watts > 0 ? '+' : (watts < 0 ? '−' : '');
        return `${sign}${formatLocalisedNumber(hass, Math.abs(watts) / 1000, decimals)} kW`;
    }
    return `${formatLocalisedNumber(hass, watts / 1000, decimals)} kW`;
}


//Uniform energy readout: always kilowatt-hours, locale-aware, with the caller's decimal count.
//Input is already in kWh.
export function formatEnergyKwh(hass: any, kwh: number, decimals: number): string
{
    return `${formatLocalisedNumber(hass, kwh, decimals)} kWh`;
}


//Normalise an energy value + unit string to kilowatt-hours. Mirrors pvNormalizeToWatts on the power
//side: Wh / kWh / MWh fold to kWh; an unknown unit is treated as already kWh so the caller still
//prints a finite number rather than dropping the readout.
export function energyToKwh(value: number, unit: string): number
{
    switch ((unit || '').trim().toLowerCase())
    {
        case 'wh':  return value / 1000;
        case 'mwh': return value * 1000;
        default:    return value;
    }
}


//Darken a #rrggbb hex by a factor in [0, 1] (0 = unchanged,
//1 = pure black). Multiplicative on each channel, keeps the
//hue intact, just lowers the value. Used to derive the slightly
//darker rim colour around the sun disc from the configured sun
//colour, so the rim stays visible against the disc fill without
//the user having to configure two colours.
export function darkenHex(hex: string, factor: number): string
{
    const f = 1 - Math.max(0, Math.min(1, factor));
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * f);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * f);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * f);
    const h = (n: number) => n.toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
}


//Linear blend between two #rrggbb hex colours. `t` = 0 returns
//`a` unchanged, `t` = 1 returns `b`. Used by the cloud disc to
//derive the light (low) and dark (high) band shades from the
//configured cloud colour without needing a second / third
//config key.
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
