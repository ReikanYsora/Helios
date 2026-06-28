//Pure weather-at-time resolution: nearest-hour lookup and weather-code classification over an already
//fetched hourly forecast. No DOM, map, network, or engine state; the fetch/cache/timer orchestration stays
//in the engine, and these helpers only read the hourly arrays it hands in.

import type { SampleHourly } from './weather';

export type CloudIntensity = 'clear' | 'light' | 'moderate' | 'heavy' | 'storm' | 'fog';

//Classify the model weather code (with cloud % as a tiebreaker) into one of the disc-intensity buckets.
export function weatherCodeToIntensity(code: number, pct: number): CloudIntensity
{
    if (code >= 95)
    {
        return 'storm';
    }
    if (code >= 45 && code <= 48)
    {
        return 'fog';
    }
    if ((code >= 61 && code <= 67) || (code >= 71 && code <= 77) || code >= 80)
    {
        return 'heavy';
    }
    if (code >= 51)
    {
        return 'moderate';
    }
    if (pct < 15)
    {
        return 'clear';
    }
    if (pct < 50)
    {
        return 'light';
    }
    return pct < 80 ? 'moderate' : 'heavy';
}

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
    cloudIntensity: CloudIntensity;
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
        cloudIntensity: 'clear'
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

    const cc   = home.cloudCover[idx]  ?? 0;
    const cLow = home.cloudLow[idx]    ?? 0;
    const cMid = home.cloudMid[idx]    ?? 0;
    const cHi  = home.cloudHigh[idx]   ?? 0;
    const sw   = home.shortwave[idx]   ?? -1;
    const wc   = home.weatherCode[idx] ?? 0;

    return {
        cloudCover:     cc,
        cloudLow:       cLow,
        cloudMid:       cMid,
        cloudHigh:      cHi,
        shortwave:      sw,
        cloudIntensity: weatherCodeToIntensity(wc, cc)
    };
}
