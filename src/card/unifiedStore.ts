//Unified 5-day data source: the single source of truth for every per-time signal the dashboard cards, radial
//sundial, graph view and main timeline read. Built ONCE after the underlying fetches land, cached on the host,
//then sliced/re-sampled by consumers at look-up time. Live numeric chips stay on the direct hass.states path; every
//other surface that draws or hovers a curve uses this source.
//
//Cadence: one knob (`display-update-frequency-per-hour`, 1-60, default 4) controls both the storage cadence and the
//render cadence of every graph. Higher = more precise curves at the cost of CPU/rebuild + memory/series. The forecast
//curve is the exception: sourced from HA's Energy dashboard at its native hourly cadence, read into buckets as a
//stepped hourly curve (each bucket reads the wh of the HA forecast hour it falls inside).
//
//Window: J-2 to J+2 = 5 days x (24 x bucketsPerHour) buckets/series. Origin storeStartMs = local midnight of
//(today - 2 days), so bucket 0 sits at the J-2 day start.
//
//Each series is length bucketsTotal; null marks "no real data and no surrounding samples to interpolate between":
//irradiance W/m2, cloud % (both weather model, interpolated hourly), production W (PV LTS + history, no forecast),
//forecast W (HA Energy solar forecast, hourly stepped), battery W (signed, history), batterySoc % (live only, current
//bucket), gridImport/gridExport W (slope of cumulative kWh meter).
//
//Forecast is a peer of production, not a fallback: the dial overlays forecast as a dashed line on top of the
//production fill; the two series are never mixed inside a single value.

import type { HeliosConfig } from '../helios-config';
import { displayUpdateFrequencyPerHour } from '../helios-config';
import type { ChartSeries } from './charts';
import type { PvHistory } from './pv';
import { changeSeriesToWatts, type ChangeBucket } from './energy-stats';
import { forecastWattsAt, type SolarForecastPoint } from './energy-forecast';

//Re-export so graph consumers (e.g. SVG path builders walking bucketsPerHour) can query the cadence directly.
export { displayUpdateFrequencyPerHour } from '../helios-config';


const HOUR_MS = 3_600_000;
const DAY_MS  = 24 * HOUR_MS;

//Per-build cadence bundle, derived from config once at the top of buildUnifiedStore and threaded through every
//per-metric builder so bucket arithmetic stays consistent across passes.
interface CadenceParams
{
    bucketsPerHour:  number;
    bucketsPerDay:   number;
    bucketsTotal:    number;
    stepMs:          number;
}


export interface UnifiedDataStore
{
    //Local midnight at the start of the active rolling window / local midnight just past its end.
    storeStartMs:  number;
    storeEndMs:    number;
    //Cadence the series live at, captured so read-side accessors stay consistent with the build and the rebuild
    //trigger can compare against the current user setting to invalidate stale stores.
    bucketsPerHour: number;
    bucketsPerDay:  number;
    bucketsTotal:   number;
    stepMs:         number;
    //Build timestamp + data-version hash so consumers can detect "same store as last frame" without comparing series.
    builtAtMs:    number;
    dataVersion:  string;

    irradiance:   (number | null)[];
    cloud:        (number | null)[];
    production:   (number | null)[];
    //HA Energy solar forecast (energy/solar_forecast). All-null when no forecast source is configured (no curve/label).
    forecast:     (number | null)[];
    battery:      (number | null)[];
    batterySoc:   (number | null)[];
    gridImport:   (number | null)[];
    gridExport:   (number | null)[];
}


//Structural host surface required to build the store: the union of what every per-metric builder reads. The actual
//card / dashboard host implements a superset.
export interface UnifiedStoreHost
{
    readonly config:                  HeliosConfig | undefined;
    //Active rolling-window span in days (history before today / forecast after). Owned by the card (config seed +
    //runtime selector); buildUnifiedStore builds exactly this many days.
    readonly _periodPastDays:         number;
    readonly _periodFutureDays:       number;
    readonly hass:                    { language?: string; states?: Record<string, { state: string }>; config?: { latitude?: number; longitude?: number } } | undefined;
    readonly _chartSeries:            ChartSeries | null;
    readonly _pvHistory:              PvHistory | null;
    //Recorder `change` series for the solar meter(s), 5-min buckets. Canonical past-production source: buildProduction
    //converts each bucket's reset-corrected kWh to average watts.
    readonly _pvChangeSeries:         ChangeBucket[] | null;
    readonly _pvCalibStats:           PvHistory | null;
    readonly _pvUnit:                 string;
    //Recorder `change` series for battery charge (stat_energy_to) + discharge (stat_energy_from). buildBattery nets
    //them (charge - discharge) so the sign is structural.
    readonly _batteryChargeChangeSeries:    ChangeBucket[] | null;
    readonly _batteryDischargeChangeSeries: ChangeBucket[] | null;
    readonly _batterySoc:             number | null;
    //Recorder `change` series for grid import / export meters, 5-min buckets. Same contract as production: each
    //direction's bucket kWh -> average watts.
    readonly _gridImportChangeSeries: ChangeBucket[] | null;
    readonly _gridExportChangeSeries: ChangeBucket[] | null;
    //HA Energy solar forecast (energy-forecast.ts), merged across config entries and time-sorted. Empty when no
    //forecast source is configured (forecast series left all-null, no curve renders).
    readonly _haSolarForecast:        ReadonlyArray<SolarForecastPoint>;
}


//Bucket arithmetic. Bucketing is HALF-OPEN: sample at t lands in floor((t - storeStartMs) / stepMs). -1 = out of window.
function bucketForMs(storeStartMs: number, ms: number, stepMs: number, bucketsTotal: number): number
{
    if (ms < storeStartMs) { return -1; }
    const idx = Math.floor((ms - storeStartMs) / stepMs);
    if (idx >= bucketsTotal) { return -1; }
    return idx;
}

//Fill null gaps with linear interpolation between bracketing non-null samples. Edges carry the nearest non-null
//forward/backward so the consumer sees a continuous progression where extrapolation makes sense.
function interpolateNullGaps(arr: (number | null)[]): void
{
    const N = arr.length;
    let i = 0;
    while (i < N)
    {
        if (arr[i] !== null) { i++; continue; }
        let j = i;
        while (j < N && arr[j] === null) { j++; }
        const prev = i > 0 ? arr[i - 1] : null;
        const next = j < N ? arr[j]     : null;
        if (prev === null && next === null) { return; }
        if (prev === null)
        {
            for (let k = i; k < j; k++) { arr[k] = next; }
        }
        else if (next === null)
        {
            for (let k = i; k < N; k++) { arr[k] = prev; }
            return;
        }
        else
        {
            const span = j - i + 1;
            for (let k = i; k < j; k++)
            {
                const t = (k - i + 1) / span;
                arr[k] = prev + (next - prev) * t;
            }
        }
        i = j;
    }
}


//Local midnight of the first day in the window (today - daysPast), so every bucket lines up on calendar day boundaries.
function storeOriginMs(daysPast: number): number
{
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() - daysPast * DAY_MS;
}


//---------------------------------------------------------------------------------------------------
//Per-metric builders. Each bucketizes in-window samples into a length-p.bucketsTotal array. Builders that depend on
//already-built series take them as a second argument so the build order stays explicit.
//---------------------------------------------------------------------------------------------------


function buildIrradiance(host: UnifiedStoreHost, storeStartMs: number, storeEndMs: number, p: CadenceParams): (number | null)[]
{
    const out = new Array<number | null>(p.bucketsTotal).fill(null);
    const series = host._chartSeries;
    if (!series || series.times.length === 0) { return out; }
    const sums   = new Array<number>(p.bucketsTotal).fill(0);
    const counts = new Array<number>(p.bucketsTotal).fill(0);
    for (let i = 0; i < series.times.length; i++)
    {
        const t = series.times[i].getTime();
        if (t < storeStartMs || t >= storeEndMs) { continue; }
        const v = series.irradiance?.[i];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) { continue; }
        const h = bucketForMs(storeStartMs, t, p.stepMs, p.bucketsTotal);
        if (h < 0) { continue; }
        sums[h]   += v;
        counts[h] += 1;
    }
    for (let h = 0; h < p.bucketsTotal; h++)
    {
        if (counts[h] > 0) { out[h] = sums[h] / counts[h]; }
    }
    //Weather model lands ~1 sample/hour; remaining buckets stay null until interpolated.
    interpolateNullGaps(out);
    return out;
}


function buildCloud(host: UnifiedStoreHost, storeStartMs: number, storeEndMs: number, p: CadenceParams): (number | null)[]
{
    const out = new Array<number | null>(p.bucketsTotal).fill(null);
    const series = host._chartSeries;
    if (!series || series.times.length === 0) { return out; }
    const sums   = new Array<number>(p.bucketsTotal).fill(0);
    const counts = new Array<number>(p.bucketsTotal).fill(0);
    for (let i = 0; i < series.times.length; i++)
    {
        const t = series.times[i].getTime();
        if (t < storeStartMs || t >= storeEndMs) { continue; }
        const v = series.cloud[i];
        if (typeof v !== 'number' || !Number.isFinite(v)) { continue; }
        const h = bucketForMs(storeStartMs, t, p.stepMs, p.bucketsTotal);
        if (h < 0) { continue; }
        sums[h]   += Math.max(0, Math.min(100, v));
        counts[h] += 1;
    }
    for (let h = 0; h < p.bucketsTotal; h++)
    {
        if (counts[h] > 0) { out[h] = sums[h] / counts[h]; }
    }
    interpolateNullGaps(out);
    return out;
}


//Production = past actual only, no model fallback. Sourced from the recorder `change` metric on the solar meter(s)
//(_pvChangeSeries) — the exact data the HA Energy dashboard consumes: each 5-min bucket's reset-corrected,
//unit-normalised kWh -> average watts (kWh * 1000 / bucket-hours). No client-side differentiation or unit classification,
//so a 15-min SolarEdge counter or daily-reset meter is handled natively by the recorder.
//
//Store buckets are always >= the 5-min source period (data-interval caps at 12/hour = 5 min), so each store bucket
//aggregates whole source buckets and the conversion is exact. Past gaps interpolated; future buckets stay null so the
//forecast series owns the future half.
function buildProduction(host: UnifiedStoreHost, _storeStartMs: number, _storeEndMs: number, nowMs: number, p: CadenceParams): (number | null)[]
{
    const out = changeSeriesToWatts(host._pvChangeSeries, _storeStartMs, p.stepMs, p.bucketsTotal, nowMs);
    //Production is never negative; floor tiny negative recorder changes (meter glitch noise).
    for (let i = 0; i < out.length; i++)
    {
        const v = out[i];
        if (v !== null && v < 0) { out[i] = 0; }
    }
    const nowBucket = bucketForMs(_storeStartMs, nowMs, p.stepMs, p.bucketsTotal);
    const pastEnd   = Math.min(p.bucketsTotal, (nowBucket < 0 ? 0 : nowBucket + 1));
    if (pastEnd > 0)
    {
        const pastSlice = out.slice(0, pastEnd);
        interpolateNullGaps(pastSlice);
        for (let h = 0; h < pastEnd; h++) { out[h] = pastSlice[h]; }
    }
    return out;
}


//Forecast = HA Energy's own solar forecast (energy/solar_forecast) aligned to store buckets. The HA forecast is hourly
//watt-hours; each bucket reads the wh of the HA forecast hour its midpoint falls inside (stepped hourly curve, the exact
//magnitude the Energy dashboard draws). All-null when no forecast source is configured.
function buildForecast(host: UnifiedStoreHost, storeStartMs: number, storeEndMs: number, p: CadenceParams): (number | null)[]
{
    const out = new Array<number | null>(p.bucketsTotal).fill(null);
    const forecast = host._haSolarForecast;
    if (!forecast || forecast.length === 0) { return out; }
    for (let h = 0; h < p.bucketsTotal; h++)
    {
        const mid = storeStartMs + h * p.stepMs + p.stepMs / 2;
        if (mid < storeStartMs || mid >= storeEndMs) { continue; }
        const w = forecastWattsAt(forecast, mid);
        if (w !== null && Number.isFinite(w)) { out[h] = Math.max(0, w); }
    }
    return out;
}


//Battery net power per bucket, "positive = charging". Charge watts from the stat_energy_to `change` series, discharge
//from stat_energy_from; net = charge - discharge. Two separate meters make the sign structural, so charging is never
//lost (the old bug where a single signed sensor only surfaced discharge). Future buckets null.
function buildBattery(host: UnifiedStoreHost, storeStartMs: number, nowMs: number, p: CadenceParams): (number | null)[]
{
    const charge    = changeSeriesToWatts(host._batteryChargeChangeSeries,    storeStartMs, p.stepMs, p.bucketsTotal, nowMs);
    const discharge = changeSeriesToWatts(host._batteryDischargeChangeSeries, storeStartMs, p.stepMs, p.bucketsTotal, nowMs);
    const out = new Array<number | null>(p.bucketsTotal).fill(null);
    for (let i = 0; i < p.bucketsTotal; i++)
    {
        const c = charge[i];
        const d = discharge[i];
        if (c === null && d === null) { continue; }
        out[i] = Math.max(0, c ?? 0) - Math.max(0, d ?? 0);
    }
    const nowBucket = bucketForMs(storeStartMs, nowMs, p.stepMs, p.bucketsTotal);
    const pastEnd   = Math.min(p.bucketsTotal, (nowBucket < 0 ? 0 : nowBucket + 1));
    if (pastEnd > 0)
    {
        const pastSlice = out.slice(0, pastEnd);
        interpolateNullGaps(pastSlice);
        for (let h = 0; h < pastEnd; h++) { out[h] = pastSlice[h]; }
    }
    return out;
}


//Battery SoC: no per-bucket history today, only the live state. Park it on the bucket "now" sits in; rest stay null.
function buildBatterySoc(host: UnifiedStoreHost, storeStartMs: number, nowMs: number, p: CadenceParams): (number | null)[]
{
    const out = new Array<number | null>(p.bucketsTotal).fill(null);
    const live = host._batterySoc;
    if (live === null || live === undefined || !Number.isFinite(live)) { return out; }
    const h = bucketForMs(storeStartMs, nowMs, p.stepMs, p.bucketsTotal);
    if (h >= 0) { out[h] = Math.max(0, Math.min(100, live)); }
    return out;
}


//Grid import / export: average watts per bucket from the directional meter's recorder `change` series, exactly like
//production (kWh * 1000 / bucket-hours). Reset-corrected + unit-normalised server-side. Past gaps interpolated, future null.
function buildGridChange(
    series:       ChangeBucket[] | null,
    storeStartMs: number,
    stepMs:       number,
    bucketsTotal: number,
    nowMs:        number,
): (number | null)[]
{
    const out = changeSeriesToWatts(series, storeStartMs, stepMs, bucketsTotal, nowMs);
    for (let i = 0; i < out.length; i++)
    {
        const v = out[i];
        if (v !== null && v < 0) { out[i] = 0; }
    }
    const nowBucket = bucketForMs(storeStartMs, nowMs, stepMs, bucketsTotal);
    const pastEnd   = Math.min(bucketsTotal, (nowBucket < 0 ? 0 : nowBucket + 1));
    if (pastEnd > 0)
    {
        const pastSlice = out.slice(0, pastEnd);
        interpolateNullGaps(pastSlice);
        for (let h = 0; h < pastEnd; h++) { out[h] = pastSlice[h]; }
    }
    return out;
}


//Cheap data-version hash: cadence + the lengths of every source, so a fetch that grows any of them OR a cadence knob
//change invalidates the cache key.
function computeDataVersion(host: UnifiedStoreHost): string
{
    //Day-key (local midnight) included so the store auto-rebuilds at midnight rollover even when no new rows landed.
    //Without it, opening the dashboard after midnight with the same arrays leaves the store anchored on the previous
    //day's J-2 origin and every per-day slice is shifted by one day until a fetch trips a length change.
    const todayKey = new Date().toDateString();
    const cadence       = displayUpdateFrequencyPerHour(host.config);
    const seriesLen     = host._chartSeries?.times.length ?? 0;
    const pvHistLen     = host._pvHistory?.times.length   ?? 0;
    const pvCalibLen    = host._pvCalibStats?.times.length ?? 0;
    const pvChangeLen   = host._pvChangeSeries?.length ?? 0;
    const battHistLen   = (host._batteryChargeChangeSeries?.length ?? 0) + (host._batteryDischargeChangeSeries?.length ?? 0);
    const gridImpLen = host._gridImportChangeSeries?.length ?? 0;
    const gridExpLen = host._gridExportChangeSeries?.length ?? 0;
    const socLive = host._batterySoc ?? '';
    const forecastLen = host._haSolarForecast?.length ?? 0;
    return `d${todayKey}|c${cadence}|${seriesLen}|${pvHistLen}|${pvCalibLen}|${pvChangeLen}|${battHistLen}|${gridImpLen}|${gridExpLen}|${socLive}|f${forecastLen}`;
}


//Top-level builder. Resolves cadence from config, then runs each per-metric pass in dependency order. Pure function of
//the host snapshot: same input -> same output, no side effects.
export function buildUnifiedStore(host: UnifiedStoreHost): UnifiedDataStore
{
    const bucketsPerHour = displayUpdateFrequencyPerHour(host.config);
    const bucketsPerDay  = 24 * bucketsPerHour;
    //Rolling-window span from the card's active period (config seed or runtime override): daysPast + today + daysFuture.
    const daysPast   = host._periodPastDays;
    const daysFuture = host._periodFutureDays;
    const storeDays  = daysPast + 1 + daysFuture;
    const bucketsTotal   = storeDays * bucketsPerDay;
    const stepMs         = HOUR_MS / bucketsPerHour;
    const p: CadenceParams = { bucketsPerHour, bucketsPerDay, bucketsTotal, stepMs };

    const storeStartMs = storeOriginMs(daysPast);
    const storeEndMs   = storeStartMs + storeDays * DAY_MS;
    const nowMs        = Date.now();
    const irradiance   = buildIrradiance(host, storeStartMs, storeEndMs, p);
    const cloud        = buildCloud(host, storeStartMs, storeEndMs, p);
    //Production reads ONLY real sensor samples + interpolates; forecast reads the HA Energy forecast at store cadence.
    const production   = buildProduction(host, storeStartMs, storeEndMs, nowMs, p);
    const forecast     = buildForecast(host, storeStartMs, storeEndMs, p);
    const battery      = buildBattery(host, storeStartMs, nowMs, p);
    const batterySoc   = buildBatterySoc(host, storeStartMs, nowMs, p);
    const gridImport   = buildGridChange(host._gridImportChangeSeries, storeStartMs, p.stepMs, p.bucketsTotal, nowMs);
    const gridExport   = buildGridChange(host._gridExportChangeSeries, storeStartMs, p.stepMs, p.bucketsTotal, nowMs);
    return {
        storeStartMs,
        storeEndMs,
        bucketsPerHour,
        bucketsPerDay,
        bucketsTotal,
        stepMs,
        builtAtMs:   nowMs,
        dataVersion: computeDataVersion(host),
        irradiance,
        cloud,
        production,
        forecast,
        battery,
        batterySoc,
        gridImport,
        gridExport,
    };
}


//True when the host's current store matches the host's current data version; lets the caller skip the rebuild.
export function isStoreFresh(host: UnifiedStoreHost, store: UnifiedDataStore | null): boolean
{
    if (!store) { return false; }
    return store.dataVersion === computeDataVersion(host);
}


//---------------------------------------------------------------------------------------------------
//Read-side accessors. Every consumer (radial dial, graph view, timeline) goes through these so bucket arithmetic and
//the interpolation contract stay in one place.
//---------------------------------------------------------------------------------------------------


//Linearly interpolate a series value at an exact timestamp. Null when outside the window OR both surrounding buckets null.
export function valueAt(series: ReadonlyArray<number | null>, store: UnifiedDataStore, ms: number): number | null
{
    if (ms < store.storeStartMs || ms >= store.storeEndMs) { return null; }
    const stepFloat = (ms - store.storeStartMs) / store.stepMs - 0.5;
    const i0 = Math.max(0, Math.min(store.bucketsTotal - 1, Math.floor(stepFloat)));
    const i1 = Math.max(0, Math.min(store.bucketsTotal - 1, i0 + 1));
    const v0 = series[i0];
    const v1 = series[i1];
    if (v0 === null && v1 === null) { return null; }
    if (v0 === null) { return v1; }
    if (v1 === null) { return v0; }
    const f = Math.max(0, Math.min(1, stepFloat - i0));
    return v0 + (v1 - v0) * f;
}




//Integrate the forecast series (watts/bucket) over [dayStartMs, dayEndMs) into kWh at store cadence: each non-null
//bucket contributes watts x stepHours / 1000. Single source for every forecast kWh figure (headline, CoverFlow cards,
//day-strip chips) so they all match the timeline curve. Null when no bucket in range carried a value.
export function integrateForecastKwh(store: UnifiedDataStore, dayStartMs: number, dayEndMs: number): number | null
{
    const series = store.forecast;
    const stepH  = store.stepMs / HOUR_MS;
    let kwh = 0;
    let any = false;
    for (let i = 0; i < store.bucketsTotal; i++)
    {
        const mid = store.storeStartMs + (i + 0.5) * store.stepMs;
        if (mid < dayStartMs || mid >= dayEndMs) { continue; }
        const v = series[i];
        if (v === null || !isFinite(v)) { continue; }
        kwh += v * stepH / 1000;
        any = true;
    }
    return any ? kwh : null;
}


//Cumulative forecast kWh across [dayStartMs, dayEndMs), one point per bucket, for the running intraday curve. Same
//integration as integrateForecastKwh (endpoint == headline total). Always seeded with a 0 point at dayStartMs.
export function forecastCumulativeForDay(store: UnifiedDataStore, dayStartMs: number, dayEndMs: number): Array<{ tMs: number; kwh: number }>
{
    const stepH = store.stepMs / HOUR_MS;
    const out: Array<{ tMs: number; kwh: number }> = [{ tMs: dayStartMs, kwh: 0 }];
    let kwh = 0;
    for (let i = 0; i < store.bucketsTotal; i++)
    {
        const bucketStart = store.storeStartMs + i * store.stepMs;
        const mid         = bucketStart + 0.5 * store.stepMs;
        if (mid < dayStartMs || mid >= dayEndMs) { continue; }
        const v = store.forecast[i];
        if (v === null || !isFinite(v)) { continue; }
        kwh += v * stepH / 1000;
        out.push({ tMs: bucketStart + store.stepMs, kwh });
    }
    return out;
}




//Per-bucket samples over an arbitrary [startMs, endMs] sub-window. Used by the main timeline chart (production +
//forecast curves across the visible 5-day window). One entry per bucket whose centre falls inside; null = no data.
export interface RangeSlice
{
    times:      Date[];
    production: (number | null)[];
    forecast:   (number | null)[];
    cloud:      (number | null)[];
    irradiance: (number | null)[];
}

export function sliceForRange(store: UnifiedDataStore, startMs: number, endMs: number): RangeSlice
{
    const lo = Math.max(store.storeStartMs, startMs);
    const hi = Math.min(store.storeEndMs,   endMs);
    if (hi <= lo)
    {
        return { times: [], production: [], forecast: [], cloud: [], irradiance: [] };
    }
    const stepMs = store.stepMs;
    const firstBucketIdx = Math.floor((lo - store.storeStartMs) / stepMs);
    const firstMid = store.storeStartMs + firstBucketIdx * stepMs + stepMs / 2;
    const times:      Date[]            = [];
    const production: (number | null)[] = [];
    const forecast:   (number | null)[] = [];
    const cloud:      (number | null)[] = [];
    const irradiance: (number | null)[] = [];
    for (let mid = firstMid; mid < hi; mid += stepMs)
    {
        if (mid < lo) { continue; }
        times.push(new Date(mid));
        production.push(valueAt(store.production, store, mid));
        forecast.push(  valueAt(store.forecast,   store, mid));
        cloud.push(     valueAt(store.cloud,      store, mid));
        irradiance.push(valueAt(store.irradiance, store, mid));
    }
    return { times, production, forecast, cloud, irradiance };
}
