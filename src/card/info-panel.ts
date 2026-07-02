//Top-right ambient info panel helpers: WMO weather-code -> condition bucket + mdi icon, unit conversion for the
//Open-Meteo defaults (Celsius / km-h) into the HA unit system, override-entity reads, and the small time/duration
//formatters the panel needs. Pure over hass + numbers; no DOM.

//Condition buckets the panel labels + icons. One per visually distinct sky, coarser than the full WMO table.
export type ConditionKey =
    'clear' | 'partlyCloudy' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';

//Bucket a WMO weather code (0..99) into a ConditionKey. Ranges mirror Open-Meteo's documented code list.
export function wmoConditionKey(code: number): ConditionKey
{
    if (code >= 95)                          { return 'thunder'; }              //95, 96, 99
    if (code >= 71 && code <= 77)            { return 'snow'; }
    if (code >= 85 && code <= 86)            { return 'snow'; }                 //snow showers
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) { return 'rain'; }
    if (code >= 51 && code <= 57)            { return 'drizzle'; }
    if (code >= 45 && code <= 48)            { return 'fog'; }
    if (code === 3)                          { return 'cloudy'; }
    if (code === 1 || code === 2)            { return 'partlyCloudy'; }
    return 'clear';                                                            //0 (and anything unmapped)
}

//mdi icon for a condition bucket. `night` swaps the two clear-ish buckets to their moonlit variants so a clear
//night doesn't show a sun.
export function conditionIcon(key: ConditionKey, night: boolean): string
{
    switch (key)
    {
        case 'clear':        return night ? 'mdi:weather-night' : 'mdi:weather-sunny';
        case 'partlyCloudy': return night ? 'mdi:weather-night-partly-cloudy' : 'mdi:weather-partly-cloudy';
        case 'cloudy':       return 'mdi:weather-cloudy';
        case 'fog':          return 'mdi:weather-fog';
        case 'drizzle':      return 'mdi:weather-partly-rainy';
        case 'rain':         return 'mdi:weather-pouring';
        case 'snow':         return 'mdi:weather-snowy';
        case 'thunder':      return 'mdi:weather-lightning';
        default:             return 'mdi:weather-cloudy';
    }
}


//A formatted value + its unit label, ready to drop into the panel.
export interface PanelValue
{
    value: string;
    unit:  string;
}

function isImperialTemp(hass: any): boolean
{
    return String(hass?.config?.unit_system?.temperature ?? '').includes('F');
}

function isImperialLength(hass: any): boolean
{
    return String(hass?.config?.unit_system?.length ?? '').toLowerCase().includes('mi');
}

//Open-Meteo temperature (Celsius) in the HA unit system.
export function formatTempC(hass: any, celsius: number): PanelValue | null
{
    if (!Number.isFinite(celsius)) { return null; }
    if (isImperialTemp(hass))
    {
        return { value: String(Math.round(celsius * 9 / 5 + 32)), unit: '°F' };
    }
    return { value: String(Math.round(celsius)), unit: '°C' };
}

//Open-Meteo wind speed (km/h) in the HA unit system.
export function formatWindKmh(hass: any, kmh: number): PanelValue | null
{
    if (!Number.isFinite(kmh)) { return null; }
    if (isImperialLength(hass))
    {
        return { value: String(Math.round(kmh * 0.621371)), unit: 'mph' };
    }
    return { value: String(Math.round(kmh)), unit: 'km/h' };
}

//Read a numeric override entity as {value, unit} in its OWN unit (no conversion): the user picked this sensor, so
//we trust its native reading. Null when absent/non-numeric/unavailable.
export function readEntityValue(hass: any, entityId: string): PanelValue | null
{
    if (!entityId) { return null; }
    const st = hass?.states?.[entityId];
    if (!st) { return null; }
    const raw = st.state;
    if (raw === null || raw === undefined || raw === '' || raw === 'unknown' || raw === 'unavailable') { return null; }
    const n = parseFloat(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) { return null; }
    return { value: String(Math.round(n)), unit: String(st.attributes?.unit_of_measurement ?? '').trim() };
}


//HH:MM at the home/HA timezone. sunrise/sunset arrive as absolute instants, so formatting in the configured
//timezone yields the correct local clock even when the browser sits elsewhere.
export function formatClock(hass: any, date: Date): string
{
    try
    {
        return new Intl.DateTimeFormat(hass?.locale?.language ?? hass?.language ?? 'en', {
            hour:     '2-digit',
            minute:   '2-digit',
            timeZone: hass?.config?.time_zone,
        }).format(date);
    }
    catch (_)
    {
        return '';
    }
}

//Day length between two instants as "14h 22m". Null when either bound is missing (polar day/night).
export function formatDayLength(sunrise: Date | null, sunset: Date | null): string | null
{
    if (!sunrise || !sunset) { return null; }
    const mins = Math.max(0, Math.round((sunset.getTime() - sunrise.getTime()) / 60_000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}
