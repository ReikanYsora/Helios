//Open-Meteo weather data layer: multi-model fetch, in-browser cache, and pure helpers around the weather signal.
//No DOM, map, or engine state; all forecast-API code lives here so the engine stays focused on rendering.

//Forecast window, back-off tables, cache TTL/precision live in constants.ts. Aliased on import so in-file usages
//stay unchanged; the back-off tables are re-exported because helios-engine.ts imports them from here.
import {
    WEATHER_PAST_DAYS          as PAST_DAYS,
    WEATHER_FORECAST_DAYS      as FORECAST_DAYS,
    WEATHER_CACHE_TTL_MS       as CACHE_TTL_MS,
    WEATHER_CACHE_KEY_DECIMALS as CACHE_KEY_DECIMALS,
    CACHE_KEY_PREFIX,
} from '../core/config/constants';
import { clearPrefixedLocalStorage } from './log';


//Hourly forecast at the home location. Numeric arrays are aligned on `times`. `shortwave` uses -1 as a
//"no data" sentinel since 0 is a legitimate night value.
export interface SampleHourly
{
    lat:         number;
    lon:         number;
    times:       Date[];
    cloudCover:  number[];
    cloudLow:    number[];
    cloudMid:    number[];
    cloudHigh:   number[];
    shortwave:   number[];
    //Precipitation total (mm) and snowfall (cm) per hour, plus the WMO weather code, for the "Your real sky"
    //weather layers (rain / snow / thunderstorm). All gap-fill to 0 (missing = dry / clear).
    precip:      number[];
    snowfall:    number[];
    weatherCode: number[];
    //Air temperature (°C) and relative humidity (%) at 2 m, for the temperature chip and humidity readout.
    //Gap-fill to NaN (0 is a legitimate value for both), so consumers can tell "no data" from a real reading.
    temperature: number[];
    humidity:    number[];
}


//Median ignoring null/undefined/NaN. Combines concurrent multi-model forecasts into one robust value per timestep.
//Median over mean because individual models occasionally emit gross outliers (e.g. cloud_cover_low pegged at 100%).
export function medianOfNumbers(values: readonly (number | null | undefined)[]): number | null
{
    const clean: number[] = [];
    for (const v of values)
    {
        if (v == null || Number.isNaN(v))
        {
            continue;
        }
        clean.push(v);
    }
    if (clean.length === 0)
    {
        return null;
    }
    clean.sort((a, b) => a - b);
    const mid = Math.trunc(clean.length / 2);
    return clean.length % 2 === 0
        ? (clean[mid - 1] + clean[mid]) / 2
        : clean[mid];
}


//A regional high-resolution model and its (deliberately conservative) coverage box.
interface RegionalModel { model: string; latMin: number; latMax: number; lonMin: number; lonMax: number; }

const REGIONAL_MODELS: RegionalModel[] = [
    //France métropolitaine + Corsica. AROME-France HD at 1.3 km.
    { model: 'meteofrance_seamless',        latMin: 41.3, latMax: 51.2, lonMin: -5.5,   lonMax: 8.5 },
    //United Kingdom & Ireland. UKMO UK 2 km.
    { model: 'ukmo_seamless',               latMin: 49.5, latMax: 61.0, lonMin: -10.5,  lonMax: 2.0 },
    //Central Europe, DE/AT/CH/CZ/PL/Benelux. ICON-D2 at 2 km.
    { model: 'dwd_icon_seamless',           latMin: 46.0, latMax: 56.0, lonMin: 5.0,    lonMax: 22.0 },
    //Italy proper (peninsula + islands).
    { model: 'italia_meteo_arpae_icon_2i',  latMin: 36.5, latMax: 47.0, lonMin: 10.0,   lonMax: 18.5 },
    //Nordics, Norway/Sweden/Finland/Denmark. MET Nordic at 1 km.
    { model: 'metno_seamless',              latMin: 54.5, latMax: 71.5, lonMin: 4.0,    lonMax: 32.0 },
    //Continental US (CONUS). NOAA HRRR 3 km via gfs_seamless.
    { model: 'gfs_seamless',                latMin: 24.5, latMax: 49.5, lonMin: -125.0, lonMax: -66.5 },
    //Korea. KMA at 1.5 km. Its box sits inside the Japan box; the resolver below picks it anyway.
    { model: 'kma_seamless',                latMin: 33.0, latMax: 39.0, lonMin: 124.5,  lonMax: 132.0 },
    //Japan. JMA MSM 5 km.
    { model: 'jma_seamless',                latMin: 24.0, latMax: 46.0, lonMin: 122.0,  lonMax: 146.0 },
    //Australia & NZ. BOM ACCESS-G 15 km.
    { model: 'bom_access_global',           latMin: -47.5, latMax: -10.0, lonMin: 112.0, lonMax: 179.0 },
];

//Pick the Open-Meteo models for a coordinate: always one global model (ECMWF IFS 0.25°) plus the best regional model
//if the point falls inside its coverage box. The boxes overlap (national borders are fuzzy: eastern France also sits
//in the Central-Europe box, southern England in the France box, Korea entirely inside Japan). Of every box the point
//falls in, we keep the one it sits most centrally inside, measured as a fraction of each box's own size. That single
//rule resolves both a partial border overlap (deepest of the two neighbours wins) and a fully enclosed box (Korea's
//small box scores higher than the vast Japan box at the same point), with no reliance on declaration order.
export function pickModelsForLocation(lat: number, lon: number, precision: 'standard' | 'high'): string[]
{
    if (precision === 'standard')
    {
        return ['best_match'];
    }

    const GLOBAL = 'ecmwf_ifs025';

    let best: RegionalModel | undefined;
    let bestScore = -Infinity;
    for (const r of REGIONAL_MODELS)
    {
        if (lat < r.latMin || lat > r.latMax || lon < r.lonMin || lon > r.lonMax)
        {
            continue;
        }
        //Distance to the nearest edge as a fraction of the box's extent (0 on an edge, 0.5 dead centre). The
        //fraction, not the raw margin, is what lets a small enclosed box outscore a large enclosing one.
        const score = Math.min(
            (lat - r.latMin) / (r.latMax - r.latMin),
            (r.latMax - lat) / (r.latMax - r.latMin),
            (lon - r.lonMin) / (r.lonMax - r.lonMin),
            (r.lonMax - lon) / (r.lonMax - r.lonMin),
        );
        if (score > bestScore)
        {
            bestScore = score;
            best = r;
        }
    }

    if (best)
    {
        return [best.model, GLOBAL];
    }
    //Anywhere else: ECMWF + GFS in parallel, two independent global models median better than one.
    return [GLOBAL, 'gfs_seamless'];
}


//Inflight Promise map keyed on cache key (`<precision>:<lat>,<lon>`). When several engines or call sites ask for the same
//(lat, lon, precision) while a fetch is in flight, they await the SAME Promise instead of each firing its own round-trip.
//Cleared in a finally block so an error path frees the slot for the next attempt.
const _inflightFetches = new Map<string, Promise<SampleHourly | null>>();

interface CachedPayload
{
    storedAt: number;
    payload: {
        lat:         number;
        lon:         number;
        times:       string[];
        cloudCover:  number[];
        cloudLow:    number[];
        cloudMid:    number[];
        cloudHigh:   number[];
        shortwave:   number[];
        precip:      number[];
        snowfall:    number[];
        weatherCode: number[];
        temperature: number[];
        humidity:    number[];
    };
}

//Schema version: bumped whenever the stored payload gains fields, so an older cached entry (missing the new
//series) is treated as a miss and refetched instead of feeding NaN/empty arrays downstream.
const CACHE_SCHEMA = 'v2';

//The precision tag is part of the key so payloads at different precisions never collide.
function cacheKey(lat: number, lon: number, precision: 'standard' | 'high'): string
{
    return `${CACHE_KEY_PREFIX}${CACHE_SCHEMA}:${precision}:${lat.toFixed(CACHE_KEY_DECIMALS)},${lon.toFixed(CACHE_KEY_DECIMALS)}`;
}


//Wipe every Open-Meteo payload stashed in localStorage. Forces a fresh fetch without clearing browser storage manually.
//Safe to call repeatedly.
export function clearWeatherCache(): number
{
    return clearPrefixedLocalStorage(CACHE_KEY_PREFIX);
}

function readCache(lat: number, lon: number, precision: 'standard' | 'high'): SampleHourly | null
{
    try
    {
        const raw = window.localStorage?.getItem(cacheKey(lat, lon, precision));
        if (!raw)
        {
            return null;
        }
        const obj = JSON.parse(raw);
        if (Date.now() - obj.storedAt > CACHE_TTL_MS)
        {
            return null;
        }
        //Even within TTL, reject if we crossed a local midnight since it was written: Open-Meteo anchors past_days/
        //forecast_days to "today" in the location's timezone, so yesterday's cache would pin the timeline to the old day.
        if (new Date(obj.storedAt).toDateString() !== new Date().toDateString())
        {
            return null;
        }
        const p = obj.payload;
        if (!p || Array.isArray(p) || !Array.isArray(p.times))
        {
            return null;
        }
        return {
            lat:         p.lat,
            lon:         p.lon,
            times:       p.times.map((t: string) => new Date(t)),
            cloudCover:  p.cloudCover  ?? [],
            cloudLow:    p.cloudLow    ?? [],
            cloudMid:    p.cloudMid    ?? [],
            cloudHigh:   p.cloudHigh   ?? [],
            shortwave:   p.shortwave   ?? [],
            precip:      p.precip      ?? [],
            snowfall:    p.snowfall    ?? [],
            weatherCode: p.weatherCode ?? [],
            //JSON turns NaN into null on write; map back so a cached "no data" hour stays NaN, not 0.
            temperature: (p.temperature ?? []).map((v: number | null) => v == null ? NaN : v),
            humidity:    (p.humidity    ?? []).map((v: number | null) => v == null ? NaN : v),
        };
    }
    catch
    {
        return null;
    }
}

function writeCache(lat: number, lon: number, precision: 'standard' | 'high', data: SampleHourly): void
{
    try
    {
        const obj: CachedPayload =
        {
            storedAt: Date.now(),
            payload:  {
                lat:         data.lat,
                lon:         data.lon,
                times:       data.times.map(t => t.toISOString()),
                cloudCover:  data.cloudCover,
                cloudLow:    data.cloudLow,
                cloudMid:    data.cloudMid,
                cloudHigh:   data.cloudHigh,
                shortwave:   data.shortwave,
                precip:      data.precip,
                snowfall:    data.snowfall,
                weatherCode: data.weatherCode,
                temperature: data.temperature,
                humidity:    data.humidity,
            }
        };
        window.localStorage?.setItem(cacheKey(lat, lon, precision), JSON.stringify(obj));
    }
    catch
    {
        //Storage quota / permission errors ignored, the user just gets a fresh fetch next time.
    }
}


//Variables requested from Open-Meteo. shortwave_radiation_instant gives GHI W/m² *at* the indicated hour (vs averaged
//over the preceding one), matching the visual time cursor; it powers the live irradiance chip and sun-arc colouring.
//The low/mid/high cloud layers are combined client-side into cloudEffective for rendering (and let us detect the
//low-layer "fog spike" failure mode); the API's raw total cloud_cover is not used. precipitation (mm), snowfall
//(cm) and weather_code (WMO) drive the "Your real sky" weather layers (rain / snow / thunderstorm). The PV
//forecast is read natively from Home Assistant.
const HOURLY_VARS = [
    'shortwave_radiation_instant',
    'cloud_cover_low',
    'cloud_cover_mid',
    'cloud_cover_high',
    'precipitation',
    'snowfall',
    'weather_code',
    'temperature_2m',
    'relative_humidity_2m',
];

//Multi-model responses suffix the variable key with the model name (e.g. shortwave_radiation_instant_<model>);
//"best_match" mode uses bare keys. Try the bare key first then the suffixed ones so one code path handles both.
//Categorical fuse for weather_code: a median of WMO codes is meaningless (rain 63 and cloudy 3 average to 33, a
//code that maps to neither model's sky). Take the first model that reported a code - the primary regional model,
//first in pickModelsForLocation - so the FX layers always reflect one real forecast.
function firstFinite(vals: (number | null)[]): number | null
{
    for (const v of vals)
    {
        if (v != null && Number.isFinite(v))
        {
            return v;
        }
    }
    return null;
}

function readSeries(
    row:     any,
    varName: string,
    models:  string[],
    fuse:    (vals: (number | null)[]) => number | null = medianOfNumbers,
): (number | null)[]
{
    const direct = row?.hourly?.[varName];
    if (Array.isArray(direct))
    {
        return direct.map((v: any) => (v == null || Number.isNaN(v)) ? null : Number(v));
    }
    const series: (number | null)[][] = [];
    for (const m of models)
    {
        const arr = row?.hourly?.[`${varName}_${m}`];
        if (!Array.isArray(arr))
        {
            continue;
        }
        series.push(arr.map((v: any) => (v == null || Number.isNaN(v)) ? null : Number(v)));
    }
    if (series.length === 0)
    {
        return [];
    }
    const len = Math.max(...series.map(s => s.length));
    const out = new Array<number | null>(len);
    for (let i = 0; i < len; i++)
    {
        out[i] = fuse(series.map(s => s[i]));
    }
    return out;
}

//Gap fills: cloud -> 0 (missing = clear); shortwave -> -1 (0 is a valid night value).
const fillCloud     = (arr: (number | null)[]): number[] => arr.map(v => v == null ? 0   : v);
const fillShortwave = (arr: (number | null)[]): number[] => arr.map(v => v == null ? -1  : v);
//Precip (mm) / snowfall (cm) -> 0 (missing = dry). Weather code -> 0 (clear); Math.round is a safety on an already
//integer code (weather_code is fused by first-reporting model, never averaged - see firstFinite).
const fillZero      = (arr: (number | null)[]): number[] => arr.map(v => v == null ? 0   : Math.max(0, v));
const fillCode      = (arr: (number | null)[]): number[] => arr.map(v => v == null ? 0   : Math.round(v));
//Temperature (°C, can be negative) and humidity (%) keep NaN for missing hours: 0 is a real reading for both.
const fillNaN       = (arr: (number | null)[]): number[] => arr.map(v => (v == null || !isFinite(v)) ? NaN : v);


//Layer-weighted effective cloud cover (spec decision B): each layer clamped to [0, 100] before weighting so an
//upstream > 100 quirk doesn't bleed in with the wrong relative contribution. Low cloud attenuates far more than high
//cirrus. THE single source: the per-hour precompute here and weather-resolve's at-instant recompute both call it, so
//the effective cover is always a function of the layers at that instant (never a separately-interpolated value that
//would drift from the layers once the min(100) clamp bites).
export function cloudEffective(low: number, mid: number, high: number): number
{
    const lc = Math.max(0, Math.min(100, low));
    const mc = Math.max(0, Math.min(100, mid));
    const hc = Math.max(0, Math.min(100, high));
    return Math.min(100, lc + 0.6 * mc + 0.2 * hc);
}


//Single-point hourly forecast at the home location. Reads fresh browser cache, else fetches Open-Meteo with multi-model
//fusion (median per timestep), user elevation via &elevation= for sharper boundary conditions, and a layer-weighted
//effective cloud cover matching both ground perception and shortwave attenuation:
//  effective = low + 0.6*mid + 0.2*high  (capped at 100%)
//This replaces the API's raw cloud_cover (satellite-view total), which over-counts high cirrus on otherwise clear days.
//Returns null on any failure so the caller can degrade gracefully.
export async function fetchHomePointData(
    lat:       number,
    lon:       number,
    elevation: number | undefined,
    precision: 'standard' | 'high',
    signal:    AbortSignal
): Promise<SampleHourly | null>
{
    //Round to cache-key precision up front so every downstream op (localStorage lookup, dedup key, API URL) uses the
    //EXACT same coordinates. Otherwise two callers ~80 m apart hit the network with different URLs but share a cache
    //entry, defeating CDN-friendliness AND fragmenting the inflight dedup.
    const fLat = Number(lat.toFixed(CACHE_KEY_DECIMALS));
    const fLon = Number(lon.toFixed(CACHE_KEY_DECIMALS));

    const cached = readCache(fLat, fLon, precision);
    if (cached)
    {
        return cached;
    }

    //Inflight dedup: await an in-progress fetch for the same key instead of starting a fresh round-trip. Critical when
    //several engines spawn at once and would otherwise race on a cold cache.
    const inflightKey = cacheKey(fLat, fLon, precision);
    const pending = _inflightFetches.get(inflightKey);
    if (pending)
    {
        return pending;
    }

    const fetchPromise = (async (): Promise<SampleHourly | null> =>
    {
        const models = pickModelsForLocation(fLat, fLon, precision);

        let url =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${fLat.toFixed(CACHE_KEY_DECIMALS)}` +
            `&longitude=${fLon.toFixed(CACHE_KEY_DECIMALS)}` +
            `&hourly=${HOURLY_VARS.join(',')}` +
            `&models=${models.join(',')}` +
            `&past_days=${PAST_DAYS}&forecast_days=${FORECAST_DAYS}` +
            //UTC, not timezone=auto: the hourly time strings come back with NO offset, so parsing must know the
            //zone. UTC lets us pin each instant explicitly (below) instead of it defaulting to the device zone,
            //which shifts the whole axis when the device/server zone differs from the home coordinates.
            `&timezone=UTC`;

        if (elevation !== undefined)
        {
            url += `&elevation=${elevation.toFixed(0)}`;
        }

        try
        {
            const res = await fetch(url, { signal });
            if (!res.ok)
            {
                //Re-throw HTTP 429 with the status attached so the engine catch routes it to RATE_LIMIT_BACKOFF_MS;
                //returning null would short-circuit that catch and the back-off would never arm, leaving the engine
                //hammering Open-Meteo. Other non-OK statuses fall through to the silent null path (generic network error).
                if (res.status === 429)
                {
                    const err: Error & { status?: number } = new Error('Open-Meteo rate limit (HTTP 429)');
                    err.status = 429;
                    throw err;
                }
                return null;
            }
            const json = await res.json();
            const row = Array.isArray(json) ? json[0] : json;

            const tArr  = row?.hourly?.time ?? [];
            //Append 'Z' so the offset-free UTC strings parse as UTC instants (see the timezone=UTC note above),
            //not in the device zone. new Date on a bare 'YYYY-MM-DDTHH:mm' would otherwise use local time.
            const times: Date[] = tArr.map((t: string) => new Date(`${t}Z`));

            const lowSeries  = fillCloud(readSeries(row, 'cloud_cover_low',  models));
            const midSeries  = fillCloud(readSeries(row, 'cloud_cover_mid',  models));
            const highSeries = fillCloud(readSeries(row, 'cloud_cover_high', models));

            const cloudEffectiveSeries = lowSeries.map((lo, i) =>
                cloudEffective(lo ?? 0, midSeries[i] ?? 0, highSeries[i] ?? 0));

            const data: SampleHourly = {
                lat: fLat,
                lon: fLon,
                times,
                cloudCover:  cloudEffectiveSeries,
                cloudLow:    lowSeries,
                cloudMid:    midSeries,
                cloudHigh:   highSeries,
                shortwave:   fillShortwave(readSeries(row, 'shortwave_radiation_instant', models)),
                precip:      fillZero(readSeries(row, 'precipitation', models)),
                snowfall:    fillZero(readSeries(row, 'snowfall',      models)),
                weatherCode: fillCode(readSeries(row, 'weather_code',  models, firstFinite)),
                temperature: fillNaN(readSeries(row, 'temperature_2m',       models)),
                humidity:    fillNaN(readSeries(row, 'relative_humidity_2m', models)),
            };

            writeCache(fLat, fLon, precision, data);
            return data;
        }
        catch (e)
        {
            //AbortError, network, and JSON parse errors are swallowed (caller treats null as "no data"). HTTP 429 is
            //NOT swallowed: it propagates to the engine so the back-off table arms.
            if (e && typeof e === 'object' && (e as { status?: number }).status === 429)
            {
                throw e;
            }
            return null;
        }
    })();

    _inflightFetches.set(inflightKey, fetchPromise);
    try
    {
        return await fetchPromise;
    }
    finally
    {
        //Release the slot so the next fetch doesn't dedup against a stale Promise; later callers should see the cached
        //payload, not a leftover reference to the round-trip just finished.
        _inflightFetches.delete(inflightKey);
    }
}
