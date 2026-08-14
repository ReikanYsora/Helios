//Pure weather-at-time resolution: linear interpolation between the two bracketing hours of an already
//fetched hourly forecast, matching the integration's forecast interpolation so the scene and the graphs
//agree at any instant, not only on the hour. No DOM, map, network, or engine state; the fetch/cache/timer
//orchestration stays in the engine, and these helpers only read the hourly arrays it hands in.

import { cloudEffective, type SampleHourly } from './weather';

//The two samples bracketing `t` (i0 before, i1 at/after) plus the 0..1 fraction between them. A target past
//the last sample clamps to it (f pinned to 0 or 1), before the first clamps to the first.
function bracket(times: Date[], t: Date): { i0: number; i1: number; f: number }
{
    const target = t.getTime();
    let i1 = times.length - 1;
    for (let i = 0; i < times.length; i++)
    {
        if (times[i].getTime() >= target)
        {
            i1 = i;
            break;
        }
    }
    const i0 = Math.max(0, i1 - 1);
    const t0 = times[i0].getTime();
    const t1 = times[i1].getTime();
    const f  = t1 > t0 ? Math.max(0, Math.min(1, (target - t0) / (t1 - t0))) : 0;
    return { i0, i1, f };
}

//Plain linear interpolation for a continuous, always-present field (the cloud layers).
function lerp(a: number, b: number, f: number): number
{
    return a + (b - a) * f;
}

//Irradiance interpolation guarding the -1 "no model value this hour" sentinel: a missing bound is dropped so
//a real value is never blended toward -1 (mirrors the forecast's lerp_rad).
function lerpRad(a: number, b: number, f: number): number
{
    const aBad = !isFinite(a) || a < 0;
    const bBad = !isFinite(b) || b < 0;
    if (aBad && bBad) { return -1; }
    if (aBad) { return b; }
    if (bBad) { return a; }
    return a + (b - a) * f;
}

//Temperature / humidity interpolation guarding the NaN "no value this hour" sentinel (mirrors lerp_finite).
function lerpFinite(a: number, b: number, f: number): number
{
    const aBad = !isFinite(a);
    const bBad = !isFinite(b);
    if (aBad && bBad) { return NaN; }
    if (aBad) { return b; }
    if (bBad) { return a; }
    return a + (b - a) * f;
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
//the empty sentinel so timeline ramps render flat. Continuous fields (clouds, shortwave, temperature,
//humidity) are linearly interpolated between the bracketing hours; the categorical weather code and the
//precip/snow rates take the nearer hour (no meaningful blend). shortwave = -1 means no model value here
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

    const { i0, i1, f } = bracket(home.times, t);
    const near = f < 0.5 ? i0 : i1;

    //Interpolate the raw layers, then recompute the effective cover from them at this instant (via the shared
    //cloudEffective), rather than interpolating the precomputed effective: the min(100) clamp makes effective a
    //non-linear function of the layers, so a separately-interpolated value drifts once the clamp bites. This keeps
    //the effective cover a function of the layers at any instant, matching the parity golden vectors.
    const cloudLow  = lerp(home.cloudLow[i0]  ?? 0, home.cloudLow[i1]  ?? 0, f);
    const cloudMid  = lerp(home.cloudMid[i0]  ?? 0, home.cloudMid[i1]  ?? 0, f);
    const cloudHigh = lerp(home.cloudHigh[i0] ?? 0, home.cloudHigh[i1] ?? 0, f);

    return {
        cloudCover:     cloudEffective(cloudLow, cloudMid, cloudHigh),
        cloudLow,
        cloudMid,
        cloudHigh,
        shortwave:      lerpRad(home.shortwave[i0] ?? -1, home.shortwave[i1] ?? -1, f),
        precip:         home.precip[near]      ?? 0,
        snowfall:       home.snowfall[near]    ?? 0,
        weatherCode:    home.weatherCode[near] ?? 0,
        temperature:    lerpFinite(home.temperature[i0] ?? NaN, home.temperature[i1] ?? NaN, f),
        humidity:       lerpFinite(home.humidity[i0]    ?? NaN, home.humidity[i1]    ?? NaN, f),
    };
}
