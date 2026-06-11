//Open-Meteo weather data layer, multi-model fetch, in-browser cache, and pure-function helpers around the weather signal.
//
//No DOM, no map, no engine state. Everything that talks to the forecast API lives here so the engine can stay focused on rendering.

//Hourly forecast at the home location. Numeric arrays are aligned on `times`. `shortwave` uses -1 as a "no data" sentinel, 0 is a legitimate night
//value, so we can't conflate them.
export interface SampleHourly
{
    lat:         number;
    lon:         number;
    times:       Date[];
    cloudCover:  number[];
    cloudLow:    number[];
    cloudMid:    number[];
    cloudHigh:   number[];
    weatherCode: number[];
    shortwave:   number[];
    //Beam (direct) + diffuse shortwave radiation on the horizontal plane in W/m², hourly. Same -1 "no
    //data" sentinel as shortwave. Feed the PV tilt transposition so a sloped array runs on the real
    //direct / diffuse decomposition rather than the cloud-derived split. Providers that don't return
    //them leave -1, and the transposition falls back to the legacy cloud-fraction path.
    directRad:   number[];
    diffuseRad:  number[];
    //Snow depth on the ground in METRES, hourly. NaN-padded when missing. A proxy for snow lying on the
    //panels: combined with the air temperature it drives a winter cover derate (see snowCoverFactor in
    //card/pv.ts), since ground snow with sub-freezing air means the array is likely covered and
    //producing near zero regardless of irradiance.
    snowDepth:   number[];
    //2-metre air temperature in °C, hourly. Used by the PV thermal derating model to estimate cell temperature alongside the irradiance term.
    //NaN-padded when a hour is missing.
    temperature: number[];
    //10-metre wind speed in m/s, hourly. Same cadence as
    //temperature; feeds the convective cooling term in the cell
    //temperature estimate. NaN-padded when missing.
    windSpeed:   number[];
}


//Forecast window: 5 days back + today + 2 days forward. Matches the timeline range exactly so the
//cached payload feeds every consumer (timeline scrub, forecast calibration which reads its own 5-day
//inner window) without overshoot. Each extra past day past 14 inflates Open-Meteo's billing by one
//day-bucket, so capping at 5 + 3 = 8 days keeps the home-point fetch at the minimum 1 bucket.
const PAST_DAYS     = 5;
//Open-Meteo counts today inside `forecast_days`, so FORECAST_DAYS=3 yields today + 2 future days.
//Beyond +2 days the cloud-cover forecast loses predictive value.
const FORECAST_DAYS = 3;

//Exponential back-off on consecutive HTTP 429 (rate-limited)
//responses, indexed by streak count. After exhausting the table we
//stay on the last value (60 min) so a single successful fetch
//resets the counter, the user is never permanently locked out.
export const RATE_LIMIT_BACKOFF_MS = [
    5  * 60_000,
    15 * 60_000,
    60 * 60_000
];

//Graduated back-off for non-429 failures (network down, 5xx, JSON parse). Same shape as the 429
//table but starting at 1 min so a transient network blip recovers quickly. Caps at 60 min so a
//sustained outage cannot pile up high-cadence retry traffic that ends up triggering a per-IP rate
//limit even without a direct 429 from the API.
export const OTHER_ERROR_BACKOFF_MS = [
    1  * 60_000,
    5  * 60_000,
    15 * 60_000,
    60 * 60_000
];


//Median of a numeric array, ignoring null/undefined/NaN. Used to
//combine concurrent forecasts from multiple weather models into a
//single robust value per timestep. Median over mean: individual
//models occasionally emit gross outliers (typical: cloud_cover_low
//pegged at 100 % from the Sundqvist parametrisation hitting an
//underground pressure level).
export function medianOfNumbers(values: ReadonlyArray<number | null | undefined>): number | null
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
    const mid = clean.length >> 1;
    return clean.length % 2 === 0
        ? (clean[mid - 1] + clean[mid]) / 2
        : clean[mid];
}


//Pick the Open-Meteo models to query for the given coordinate. We
//always include one global model (ECMWF IFS 0.25°) plus the most
//accurate national/regional model if the point falls inside its
//coverage area. Coverage boxes are deliberately conservative so
//edge points don't get a model that returns mostly nulls.
//
//Order matters: regions whose box is enclosed by a larger neighbour
//(e.g. Korea inside the Japan box) MUST be tested first.
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
    //Anywhere else: ECMWF + GFS in parallel. Two independent global models give a meaningfully better median than a single one.
    return [GLOBAL, 'gfs_seamless'];
}


//In-browser cache. Precision is currently fixed to 'high'; the tag
//stays in the key so that re-introducing a precision toggle later
//won't collide with existing cached payloads.
const CACHE_KEY_PREFIX = 'helios-weather-cache:';
//Cache TTL bumped to 45 min from the historical 30 min so the periodic refresh interval (10 min)
//hits the localStorage cache for the first 4 cycles, then triggers a fresh network fetch on the 5th.
//Open-Meteo's underlying models refresh every 15 min server-side and the timezone-anchored payload
//is fully replaced on local midnight regardless, so 45 min stays well within "fresh enough" for the
//forecast horizon while cutting network volume by another third on long-running sessions.
const CACHE_TTL_MS     = 45 * 60_000;
//Cache key precision in decimal degrees. Three decimals = 110 m, well below Open-Meteo's coarsest
//grid cell (25 km for ECMWF, ~1.3 km for the AROME-France HD national model). Cards sitting at
//almost the same home (multi-card dashboards, editor preview during a lat / lon drag) round to one
//entry and share the fetch. The URL sent to the API is rounded to the same precision so the API
//also sees one canonical request, friendly to any CDN cache on the Open-Meteo edge.
const CACHE_KEY_DECIMALS = 3;


//Module-level diagnostics. window.heliosStats() walks these so a power user can audit how many
//times the card has actually talked to Open-Meteo over a session, plus the cache + dedup ratios.
//Pure counters, no behavioural effect.
const _weatherStats =
{
    cacheHits:             0,
    networkFetches:        0,
    inflightDedups:        0,
    rateLimit429:          0,
    otherErrors:           0,
};
export function getWeatherFetchStats(): {
    cacheHits:      number;
    networkFetches: number;
    inflightDedups: number;
    rateLimit429:   number;
    otherErrors:    number;
}
{
    return { ..._weatherStats };
}


//Module-level inflight Promise map keyed on cache key (`<precision>:<lat>,<lon>`). When several
//engines (multi-card dashboard) or several call sites in the same engine (initial spawn + interval
//tick racing on a cold cache) ask for the same (lat, lon, precision) tuple while a fetch is already
//in flight, they all await the SAME Promise instead of each firing its own network round-trip.
//Cleared in a finally block so an error path frees the slot for the next attempt.
const _inflightFetches: Map<string, Promise<SampleHourly | null>> = new Map();

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
        weatherCode: number[];
        shortwave:   number[];
        directRad?:   number[];   //optional: older caches predate the direct / diffuse fetch
        diffuseRad?:  number[];
        snowDepth?:   number[];   //optional: older caches predate the snow-depth fetch
        temperature?: number[];   //optional: older caches predate this field
        windSpeed?:   number[];
    };
}

function cacheKey(lat: number, lon: number, precision: 'standard' | 'high'): string
{
    return `${CACHE_KEY_PREFIX}${precision}:${lat.toFixed(CACHE_KEY_DECIMALS)},${lon.toFixed(CACHE_KEY_DECIMALS)}`;
}


//Wipe every Open-Meteo payload we've stashed in localStorage.
//Exposed for the editor's "reset data cache" button so a user
//who wants to force a fresh fetch (after a network glitch, a
//config change they want re-evaluated, or to retrain the
//forecast calibration) can do so without having to clear
//browser storage manually. Safe to call repeatedly.
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
    catch (_) {}
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
        //Even within the TTL, reject the cache if we crossed a local midnight since it was written. Open-Meteo anchors past_days / forecast_days to
        //"today" in the location's timezone, so the forecast window slides at midnight and stale cache from yesterday would otherwise pin the
        //timeline to the old day.
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
            weatherCode: p.weatherCode ?? [],
            shortwave:   p.shortwave   ?? [],
            //Older caches predate the direct / diffuse fetch; empty arrays read as -1 per index below
            //(via the ?? [] fallthrough on read), so the tilt split falls back to the cloud-derived path.
            directRad:   p.directRad   ?? [],
            diffuseRad:  p.diffuseRad  ?? [],
            snowDepth:   p.snowDepth   ?? [],
            //Older caches predate the temperature + wind fetch; treat
            //missing arrays as "no data" so the thermal derating
            //multiplier falls back to 1 and the prediction reduces
            //to the legacy Haurwitz output cleanly.
            temperature: p.temperature ?? [],
            windSpeed:   p.windSpeed   ?? [],
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
                weatherCode: data.weatherCode,
                shortwave:   data.shortwave,
                directRad:   data.directRad,
                diffuseRad:  data.diffuseRad,
                snowDepth:   data.snowDepth,
                temperature: data.temperature,
                windSpeed:   data.windSpeed,
            }
        };
        window.localStorage?.setItem(cacheKey(lat, lon, precision), JSON.stringify(obj));
    }
    catch
    {
        //Storage quota / permission errors are silently ignored , the user just gets a fresh fetch next time.
    }
}


//Variables we ask Open-Meteo for. shortwave_radiation_instant gives
//the GHI W/m² *at* the indicated hour (vs averaged over the
//preceding hour), matching our visual time cursor. The split cloud
//variables let us:
//  - keep the total `cloud_cover` for visual rendering
//  - detect the well-known "fog spike" failure mode of low-layer
//    parametrisations.
const HOURLY_VARS = [
    'shortwave_radiation_instant',
    //Beam + diffuse on the horizontal plane, same instant cadence as shortwave so all three line up on
    //the time cursor. Feed the tilt transposition with the real direct / diffuse decomposition.
    'direct_radiation_instant',
    'diffuse_radiation_instant',
    //Ground snow depth (metres). Drives the winter snow-cover derate on the PV output.
    'snow_depth',
    'cloud_cover',
    'cloud_cover_low',
    'cloud_cover_mid',
    'cloud_cover_high',
    'weather_code',
    //Drive the PV thermal-derating model in pv-thermal.ts. Cell temperature climbs above STC under sun and is cooled by wind, so the engine pulls
    //both alongside cloud + irradiance. Providers that don't return them leave the multiplier at 1, and the prediction falls back to the legacy "cool
    //cell" assumption.
    'temperature_2m',
    'wind_speed_10m',
];

//Multi-model responses suffix the variable key with the model name
//(e.g. shortwave_radiation_instant_meteofrance_seamless). The
//"best_match" mode is the exception, bare keys. We try the bare
//key first then the suffixed ones, so the same code handles both.
function readSeries(row: any, varName: string, models: string[]): Array<number | null>
{
    const direct = row?.hourly?.[varName];
    if (Array.isArray(direct))
    {
        return direct.map((v: any) => (v == null || Number.isNaN(v)) ? null : Number(v));
    }
    const series: Array<Array<number | null>> = [];
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
    const out: Array<number | null> = new Array(len);
    for (let i = 0; i < len; i++)
    {
        out[i] = medianOfNumbers(series.map(s => s[i]));
    }
    return out;
}

//weather_code is categorical (WMO 0..99), averaging is meaningless.
//Pick the value from the first model that has it, which is by
//construction the most appropriate for the user's location.
function readWeatherCode(row: any, models: string[]): number[]
{
    const direct = row?.hourly?.weather_code;
    if (Array.isArray(direct))
    {
        return direct.map((v: any) => Number(v) || 0);
    }
    for (const m of models)
    {
        const arr = row?.hourly?.[`weather_code_${m}`];
        if (Array.isArray(arr))
        {
            return arr.map((v: any) => Number(v) || 0);
        }
    }
    return [];
}

//Cloud-cover gaps clamp to 0 (treat missing as clear). Shortwave
//uses -1 because 0 is a valid night value. Temperature + wind use
//NaN so a downstream `isFinite` check rejects the sample cleanly
//without conflating "missing" with a real zero reading.
const fillCloud     = (arr: Array<number | null>): number[] => arr.map(v => v == null ? 0   : v);
const fillShortwave = (arr: Array<number | null>): number[] => arr.map(v => v == null ? -1  : v);
const fillNaN       = (arr: Array<number | null>): number[] => arr.map(v => v == null ? NaN : v);


//Single-point hourly forecast at the home location. Reads from the
//browser cache when fresh; otherwise fetches Open-Meteo with
//multi-model fusion (median per timestep), the user's elevation
//passed via &elevation= for sharper boundary conditions, and a
//"layer-weighted" effective cloud cover that matches both ground
//perception and shortwave attenuation:
//
//  effective = low + 0.6·mid + 0.2·high  (capped at 100 %)
//
//This replaces the API's raw `cloud_cover` (satellite-view total)
//which over-counts high cirrus on otherwise clear days.
//
//Returns null on any failure so the caller can degrade gracefully.
export async function fetchHomePointData(
    lat:       number,
    lon:       number,
    elevation: number | undefined,
    precision: 'standard' | 'high',
    signal:    AbortSignal
): Promise<SampleHourly | null>
{
    //Round to the cache-key precision up front so every downstream operation (localStorage lookup,
    //inflight dedup key, URL submitted to the API) uses the EXACT same coordinates. Without this the
    //URL would carry 5-decimal precision while the cache key carried 3-decimal precision, so two
    //cards 80 m apart would hit the network with different URLs but share a cache entry, defeating
    //the CDN-friendliness goal AND fragmenting our own inflight dedup.
    const fLat = Number(lat.toFixed(CACHE_KEY_DECIMALS));
    const fLon = Number(lon.toFixed(CACHE_KEY_DECIMALS));

    const cached = readCache(fLat, fLon, precision);
    if (cached)
    {
        _weatherStats.cacheHits++;
        return cached;
    }

    //Inflight dedup: if another caller is already fetching the same (lat, lon, precision), await
    //the same Promise instead of starting a fresh network round-trip. Critical on multi-card
    //dashboards where every helios-card spawns its own engine; without this every card would race
    //on a cold cache and each one would hit Open-Meteo once.
    const inflightKey = cacheKey(fLat, fLon, precision);
    const pending = _inflightFetches.get(inflightKey);
    if (pending)
    {
        _weatherStats.inflightDedups++;
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
            _weatherStats.networkFetches++;
            const res = await fetch(url, { signal });
            if (!res.ok)
            {
                //Re-throw HTTP 429 with the status code attached so the engine catch can route it to the exponential back-off table
                //(`RATE_LIMIT_BACKOFF_MS`). Returning `null` here would short-circuit the engine's catch and the back-off would never
                //arm, leaving the card hammering Open-Meteo at the normal cadence under a rate-limit. Other non-OK statuses fall
                //through to the silent null path, treated the same as a generic network error.
                if (res.status === 429)
                {
                    _weatherStats.rateLimit429++;
                    const err: Error & { status?: number } = new Error('Open-Meteo rate limit (HTTP 429)');
                    err.status = 429;
                    throw err;
                }
                _weatherStats.otherErrors++;
                return null;
            }
            const json = await res.json();
            const row = Array.isArray(json) ? json[0] : json;

            const tArr  = row?.hourly?.time ?? [];
            const times: Date[] = tArr.map((t: string) => new Date(t));

            const lowSeries  = fillCloud(readSeries(row, 'cloud_cover_low',  models));
            const midSeries  = fillCloud(readSeries(row, 'cloud_cover_mid',  models));
            const highSeries = fillCloud(readSeries(row, 'cloud_cover_high', models));

            //Clamp each layer to [0, 100] before weighting so an upstream API quirk that returns > 100 on one layer does
            //not bleed into the weighted sum with the wrong relative contribution (the final Math.min would catch the
            //total but the layer mix would already be wrong).
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
                weatherCode: readWeatherCode(row, models),
                shortwave:   fillShortwave(readSeries(row, 'shortwave_radiation_instant', models)),
                directRad:   fillShortwave(readSeries(row, 'direct_radiation_instant',  models)),
                diffuseRad:  fillShortwave(readSeries(row, 'diffuse_radiation_instant', models)),
                snowDepth:   fillNaN(readSeries(row, 'snow_depth', models)),
                temperature: fillNaN(readSeries(row, 'temperature_2m',  models)),
                windSpeed:   fillNaN(readSeries(row, 'wind_speed_10m',  models)),
            };

            writeCache(fLat, fLon, precision, data);
            return data;
        }
        catch (e)
        {
            //AbortError on cancellation, network errors, JSON parse errors, all swallowed silently. The caller treats null as "no data
            //available" and renders the timeline ramps as empty. Rate-limit errors (HTTP 429) are NOT swallowed: they propagate to the
            //engine so the back-off table arms.
            if (e && typeof e === 'object' && (e as { status?: number }).status === 429)
            {
                throw e;
            }
            if (e && typeof e === 'object' && (e as { name?: string }).name !== 'AbortError')
            {
                _weatherStats.otherErrors++;
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
        //Release the slot so the next fetch (after the result is cached) doesn't dedup against a
        //stale Promise. The cached payload is what later callers should see, not a leftover
        //reference to the network round-trip we just finished.
        _inflightFetches.delete(inflightKey);
    }
}
