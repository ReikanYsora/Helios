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
} from '../constants';


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
}
export { RATE_LIMIT_BACKOFF_MS, OTHER_ERROR_BACKOFF_MS } from '../constants';


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


//Pick the Open-Meteo models for a coordinate: always one global model (ECMWF IFS 0.25°) plus the best regional model if
//the point falls inside its (deliberately conservative) coverage box.
//Order matters: regions whose box is enclosed by a larger neighbour (e.g. Korea inside Japan) MUST be tested first.
export function pickModelsForLocation(lat: number, lon: number, precision: 'standard' | 'high'): string[]
{
    if (precision === 'standard')
    {
        return ['best_match'];
    }

    const GLOBAL = 'ecmwf_ifs025';

    //France métropolitaine + Corsica. AROME-France HD at 1.3 km.
    if (lat >= 41.3 && lat <= 51.2 && lon >= -5.5 && lon <= 8.5)
    {
        return ['meteofrance_seamless', GLOBAL];
    }
    //United Kingdom & Ireland. UKMO UK 2 km.
    if (lat >= 49.5 && lat <= 61.0 && lon >= -10.5 && lon <= 2.0)
    {
        return ['ukmo_seamless', GLOBAL];
    }
    //Central Europe, DE/AT/CH/CZ/PL/Benelux. ICON-D2 at 2 km.
    if (lat >= 46.0 && lat <= 56.0 && lon >= 5.0 && lon <= 22.0)
    {
        return ['dwd_icon_seamless', GLOBAL];
    }
    //Italy proper (peninsula + islands).
    if (lat >= 36.5 && lat <= 47.0 && lon >= 10.0 && lon <= 18.5)
    {
        return ['italia_meteo_arpae_icon_2i', GLOBAL];
    }
    //Nordics, Norway/Sweden/Finland/Denmark. MET Nordic at 1 km.
    if (lat >= 54.5 && lat <= 71.5 && lon >= 4.0 && lon <= 32.0)
    {
        return ['metno_seamless', GLOBAL];
    }
    //Continental US (CONUS). NOAA HRRR 3 km via gfs_seamless.
    if (lat >= 24.5 && lat <= 49.5 && lon >= -125.0 && lon <= -66.5)
    {
        return ['gfs_seamless', GLOBAL];
    }
    //Korea, must be tested before Japan (the JMA box encloses Korea).
    if (lat >= 33.0 && lat <= 39.0 && lon >= 124.5 && lon <= 132.0)
    {
        return ['kma_seamless', GLOBAL];
    }
    //Japan. JMA MSM 5 km.
    if (lat >= 24.0 && lat <= 46.0 && lon >= 122.0 && lon <= 146.0)
    {
        return ['jma_seamless', GLOBAL];
    }
    //Australia & NZ. BOM ACCESS-G 15 km.
    if (lat >= -47.5 && lat <= -10.0 && lon >= 112.0 && lon <= 179.0)
    {
        return ['bom_access_global', GLOBAL];
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
    };
}

//The precision tag is part of the key so payloads at different precisions never collide.
function cacheKey(lat: number, lon: number, precision: 'standard' | 'high'): string
{
    return `${CACHE_KEY_PREFIX}${precision}:${lat.toFixed(CACHE_KEY_DECIMALS)},${lon.toFixed(CACHE_KEY_DECIMALS)}`;
}


//Wipe every Open-Meteo payload stashed in localStorage. Forces a fresh fetch without clearing browser storage manually.
//Safe to call repeatedly.
export function clearWeatherCache(): number
{
    let cleared = 0;
    try
    {
        const ls = window.localStorage;
        if (!ls)
        {
            return 0;
        }
        const stale: string[] = [];
        for (let i = 0; i < ls.length; i++)
        {
            const k = ls.key(i);
            if (k && k.startsWith(CACHE_KEY_PREFIX))
            {
                stale.push(k);
            }
        }
        for (const k of stale) { ls.removeItem(k); cleared++; }
    }
    catch (_) { /* localStorage unavailable or quota error: leave the cache as-is */ }
    return cleared;
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
//The split cloud variables keep total cloud_cover for rendering and let us detect the low-layer "fog spike" failure
//mode. Only the irradiance (shortwave) + cloud series are requested; the PV forecast is read natively from Home Assistant.
const HOURLY_VARS = [
    'shortwave_radiation_instant',
    'cloud_cover',
    'cloud_cover_low',
    'cloud_cover_mid',
    'cloud_cover_high',
];

//Multi-model responses suffix the variable key with the model name (e.g. shortwave_radiation_instant_<model>);
//"best_match" mode uses bare keys. Try the bare key first then the suffixed ones so one code path handles both.
function readSeries(row: any, varName: string, models: string[]): (number | null)[]
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
        out[i] = medianOfNumbers(series.map(s => s[i]));
    }
    return out;
}

//Gap fills: cloud -> 0 (missing = clear); shortwave -> -1 (0 is a valid night value).
const fillCloud     = (arr: (number | null)[]): number[] => arr.map(v => v == null ? 0   : v);
const fillShortwave = (arr: (number | null)[]): number[] => arr.map(v => v == null ? -1  : v);


//Single-point hourly forecast at the home location. Reads fresh browser cache, else fetches Open-Meteo with multi-model
//fusion (median per timestep), user elevation via &elevation= for sharper boundary conditions, and a layer-weighted
//effective cloud cover matching both ground perception and shortwave attenuation:
//  effective = low + 0.6·mid + 0.2·high  (capped at 100%)
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
            `&timezone=auto`;

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
            const times: Date[] = tArr.map((t: string) => new Date(t));

            const lowSeries  = fillCloud(readSeries(row, 'cloud_cover_low',  models));
            const midSeries  = fillCloud(readSeries(row, 'cloud_cover_mid',  models));
            const highSeries = fillCloud(readSeries(row, 'cloud_cover_high', models));

            //Clamp each layer to [0, 100] before weighting so an upstream > 100 quirk doesn't bleed into the weighted sum
            //with the wrong relative contribution (the final Math.min catches the total but the mix would already be wrong).
            const cloudEffective = lowSeries.map((lo, i) =>
            {
                const lc = Math.max(0, Math.min(100, lo ?? 0));
                const mc = Math.max(0, Math.min(100, midSeries[i]  ?? 0));
                const hc = Math.max(0, Math.min(100, highSeries[i] ?? 0));
                return Math.min(100, lc + 0.6 * mc + 0.2 * hc);
            });

            const data: SampleHourly = {
                lat: fLat,
                lon: fLon,
                times,
                cloudCover:  cloudEffective,
                cloudLow:    lowSeries,
                cloudMid:    midSeries,
                cloudHigh:   highSeries,
                shortwave:   fillShortwave(readSeries(row, 'shortwave_radiation_instant', models)),
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
