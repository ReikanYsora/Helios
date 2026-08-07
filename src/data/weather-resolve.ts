//Pure weather-at-time resolution: nearest-hour lookup over an already fetched hourly forecast. No DOM, map,
//network, or engine state; the fetch/cache/timer orchestration stays in the engine, and these helpers only read
//the hourly arrays it hands in. Only the cloud + shortwave series the irradiance pipeline needs are resolved.

import type { SampleHourly } from './weather';

//Nearest-hour index in `times` for the target instant. Linear scan with an early break once the distance
//starts growing again (times are sorted ascending). Empty/absent series resolve to 0.
function findHourIndex(times: Date[], t: Date): number
{
    if (!times.length)
    {
        return 0;
    }

    const target = t.getTime();
    let best     = 0;
    let bestDist = Math.abs(times[0].getTime() - target);

    for (let i = 1; i < times.length; i++)
    {
        const d = Math.abs(times[i].getTime() - target);
        if (d < bestDist)
        {
            bestDist = d;
            best     = i;
        }
        else if (d > bestDist)
        {
            break;
        }
    }

    return best;
}

interface WeatherAtTime
{
    cloudCover:     number;
    cloudLow:       number;
    cloudMid:       number;
    cloudHigh:      number;
    shortwave:      number;
    //"Your real sky" layers: precipitation (mm), snowfall (cm) and the WMO weather code at this hour.
    precip:         number;
    snowfall:       number;
    weatherCode:    number;
    //Temperature (°C) and humidity (%); NaN when the model gave no value this hour.
    temperature:    number;
    humidity:       number;
}

//Resolve weather variables at `t` from an hourly forecast. `home` null (initial/failed/in-flight) returns
//the empty sentinel so timeline ramps render flat. shortwave = -1 means the model gave no value this hour
//(caller falls back to Haurwitz).
export function resolveWeatherAtTime(home: SampleHourly | null, t: Date): WeatherAtTime
{
    const empty: WeatherAtTime = {
        cloudCover:     0,
        cloudLow:       0,
        cloudMid:       0,
        cloudHigh:      0,
        shortwave:      -1,
        precip:         0,
        snowfall:       0,
        weatherCode:    0,
        temperature:    NaN,
        humidity:       NaN,
    };

    if (!home || !home.times.length)
    {
        return empty;
    }

    const idx = findHourIndex(home.times, t);
    if (idx < 0 || idx >= home.times.length)
    {
        return empty;
    }

    return {
        cloudCover:     home.cloudCover[idx]  ?? 0,
        cloudLow:       home.cloudLow[idx]    ?? 0,
        cloudMid:       home.cloudMid[idx]    ?? 0,
        cloudHigh:      home.cloudHigh[idx]   ?? 0,
        shortwave:      home.shortwave[idx]   ?? -1,
        precip:         home.precip[idx]      ?? 0,
        snowfall:       home.snowfall[idx]    ?? 0,
        weatherCode:    home.weatherCode[idx] ?? 0,
        temperature:    home.temperature[idx] ?? NaN,
        humidity:       home.humidity[idx]    ?? NaN,
    };
}
