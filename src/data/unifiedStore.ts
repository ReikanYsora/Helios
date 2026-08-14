//Unified rolling-window data source: the single source of truth for every per-time signal the card draws or hovers.
//Built ONCE after the underlying fetches land, cached on the host, then sliced/re-sampled by consumers at look-up time.
//Live numeric chips stay on the direct hass.states path; every other surface that draws or hovers a curve uses this.
//
//Cadence: one knob (`display-update-frequency-per-hour`, 1-60, default 4) controls both the storage and render cadence
//of every graph. Higher = more precise curves at the cost of CPU + memory. The forecast curve is the exception: from
//HA's Energy solar forecast at its native hourly cadence, read into buckets as a stepped hourly curve (each bucket reads
//the wh of the forecast hour it falls inside).
//
//Window: the card's active period, daysPast + today + daysFuture, at (24 x bucketsPerHour) buckets/day. Origin
//storeStartMs = local midnight of (today - daysPast), so bucket 0 sits at that day's start.
//
//Each series is length bucketsTotal; null marks "no real data and no surrounding samples to interpolate between".
//
//Forecast is a peer of production, not a fallback: it renders as a dashed line on top of the production fill; the two
//series are never mixed inside a single value.

import type { HeliosConfig } from '../core/config/helios-config';
import type { ChartSeries } from '../charts/charts';
import { changeSeriesToWatts, type ChangeBucket } from './sources/energy-stats';
import { forecastWattsAt, forecastAverageWatts, type SolarForecastPoint } from './energy-forecast';
import { modeBucketsPerHour, type TimelineMode } from '../timeline/timeline-modes';
import { HOUR_MS, DAY_MS } from '../core/config/constants';
import { localMidnightMinusDays } from '../core/time/timezone';

//Per-build cadence bundle, derived from config once in buildUnifiedStore and threaded through every per-metric builder
//so bucket arithmetic stays consistent across passes.
interface CadenceParams
{
    bucketsPerHour:  number;
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

    irradiance:   (number | null)[];   //W/m2, weather model interpolated hourly
    temperature:  (number | null)[];    //°C, weather model / sensor override, interpolated hourly (can be negative)
    humidity:     (number | null)[];    //%, weather model / sensor override, interpolated hourly
    production:   (number | null)[];    //W, recorder history (no forecast)
    //W, HA Energy solar forecast (energy/solar_forecast), hourly stepped. All-null when no forecast source is configured.
    forecast:     (number | null)[];
    battery:      (number | null)[];    //W signed, history
    gridImport:   (number | null)[];    //W, average watts per bucket from the recorder change series
    gridExport:   (number | null)[];    //W, average watts per bucket from the recorder change series
}


//Structural host surface required to build the store: the union of what every per-metric builder reads. The card host
//implements a superset.
export interface UnifiedStoreHost
{
    readonly config:                  HeliosConfig | undefined;
    //Active rolling-window span in days (history before today / forecast after). Owned by the card (config seed +
    //runtime selector); buildUnifiedStore builds exactly this many days.
    readonly _periodPastDays:         number;
    readonly _periodFutureDays:       number;
    //Active timeline mode: drives the store cadence (now = fine, week = hourly, month/year = daily).
    readonly _timelineMode:           TimelineMode;
    readonly _chartSeries:            ChartSeries | null;
    //Recorder `change` series for the solar meter(s), 5-min buckets. buildProduction converts each bucket's reset-corrected
    //kWh to average watts.
    readonly _pvChangeSeries:         ChangeBucket[] | null;
    //Recorder `change` series for battery charge (stat_energy_to) + discharge (stat_energy_from). buildBattery nets
    //them (charge - discharge) so the sign is structural.
    readonly _batteryChargeChangeSeries:    ChangeBucket[] | null;
    readonly _batteryDischargeChangeSeries: ChangeBucket[] | null;
    //Recorder `change` series for grid import / export meters, 5-min buckets. Same contract as production: each
    //direction's bucket kWh -> average watts.
    readonly _gridImportChangeSeries: ChangeBucket[] | null;
    readonly _gridExportChangeSeries: ChangeBucket[] | null;
    //HA Energy solar forecast (energy-forecast.ts), merged across config entries and time-sorted. Empty when no
    //forecast source is configured (forecast series left all-null, no curve renders).
    readonly _haSolarForecast:        readonly SolarForecastPoint[];
}


//Bucket arithmetic. Bucketing is HALF-OPEN: sample at t lands in floor((t - storeStartMs) / stepMs). -1 = out of window.
function bucketForMs(storeStartMs: number, ms: number, stepMs: number, bucketsTotal: number): number
{
    if (ms < storeStartMs) { return -1; }
    const idx = Math.floor((ms - storeStartMs) / stepMs);
    if (idx >= bucketsTotal) { return -1; }
    return idx;
}

//Fill null gaps with linear interpolation between bracketing non-null samples. Edges carry the nearest non-null sample
//outward so the consumer sees a continuous progression where extrapolation makes sense.
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

//Interpolate null gaps in the PAST portion of a store series only (buckets up to and including the one "now"
//falls in), leaving future buckets untouched. Shared by the production/battery/grid change-series builders.
function interpolatePastOnly(out: (number | null)[], storeStartMs: number, nowMs: number, stepMs: number, bucketsTotal: number): void
{
    const nowBucket = bucketForMs(storeStartMs, nowMs, stepMs, bucketsTotal);
    const pastEnd   = Math.min(bucketsTotal, (nowBucket < 0 ? 0 : nowBucket + 1));
    if (pastEnd > 0)
    {
        const pastSlice = out.slice(0, pastEnd);
        interpolateNullGaps(pastSlice);
        for (let h = 0; h < pastEnd; h++) { out[h] = pastSlice[h]; }
    }
}


//Local midnight of the first day in the window (today - daysPast), so every bucket lines up on calendar day boundaries.
function storeOriginMs(daysPast: number): number
{
    return localMidnightMinusDays(daysPast);
}


//---------------------------------------------------------------------------------------------------
//Per-metric builders. Each bucketizes in-window samples into a length-p.bucketsTotal array. Builders that depend on
//already-built series take them as a second argument so the build order stays explicit.
//---------------------------------------------------------------------------------------------------


//Average a weather series' field into store buckets: mean of the in-window finite samples per bucket, remaining
//gaps interpolated (the model lands ~1 sample/hour). `accept` maps a finite sample to the value to average, or
//null to drop it - the only difference between the three weather metrics.
export function bucketizeWeatherAvg(
    times:        Date[] | undefined,
    values:       (number | null | undefined)[] | undefined,
    storeStartMs: number,
    storeEndMs:   number,
    p:            CadenceParams,
    accept:       (v: number) => number | null,
): (number | null)[]
{
    const out = new Array<number | null>(p.bucketsTotal).fill(null);
    if (!times || times.length === 0 || !values) { return out; }
    const sums   = new Array<number>(p.bucketsTotal).fill(0);
    const counts = new Array<number>(p.bucketsTotal).fill(0);
    for (let i = 0; i < times.length; i++)
    {
        const t = times[i].getTime();
        if (t < storeStartMs || t >= storeEndMs) { continue; }
        const raw = values[i];
        if (typeof raw !== 'number' || !Number.isFinite(raw)) { continue; }
        const v = accept(raw);
        if (v === null) { continue; }
        const h = bucketForMs(storeStartMs, t, p.stepMs, p.bucketsTotal);
        if (h < 0) { continue; }
        sums[h]   += v;
        counts[h] += 1;
    }
    for (let h = 0; h < p.bucketsTotal; h++)
    {
        if (counts[h] > 0) { out[h] = sums[h] / counts[h]; }
    }
    interpolateNullGaps(out);
    return out;
}

//Irradiance drops negatives; temperature keeps sub-zero readings (they are real); humidity clamps to 0..100.
function buildIrradiance(host: UnifiedStoreHost, storeStartMs: number, storeEndMs: number, p: CadenceParams): (number | null)[]
{
    const s = host._chartSeries;
    return bucketizeWeatherAvg(s?.times, s?.irradiance, storeStartMs, storeEndMs, p, (v) => (v < 0 ? null : v));
}

function buildTemperature(host: UnifiedStoreHost, storeStartMs: number, storeEndMs: number, p: CadenceParams): (number | null)[]
{
    const s = host._chartSeries;
    return bucketizeWeatherAvg(s?.times, s?.temperature, storeStartMs, storeEndMs, p, (v) => v);
}

function buildHumidity(host: UnifiedStoreHost, storeStartMs: number, storeEndMs: number, p: CadenceParams): (number | null)[]
{
    const s = host._chartSeries;
    return bucketizeWeatherAvg(s?.times, s?.humidity, storeStartMs, storeEndMs, p, (v) => Math.max(0, Math.min(100, v)));
}



//Production = past actual only, no model fallback. From the recorder `change` metric on the solar meter(s)
//(_pvChangeSeries), the data the HA Energy dashboard consumes: each 5-min bucket's reset-corrected, unit-normalised
//kWh -> average watts (kWh * 1000 / bucket-hours). No client-side differentiation or unit classification, so a
//coarse-reporting or daily-reset meter is handled natively by the recorder.
//
//Store buckets are always >= the 5-min source period (data-interval caps at 12/hour = 5 min), so each store bucket
//aggregates whole source buckets and the conversion is exact. Past gaps interpolated; future buckets stay null so the
//forecast series owns the future half.
function buildProduction(host: UnifiedStoreHost, storeStartMs: number, nowMs: number, p: CadenceParams): (number | null)[]
{
    const out = changeSeriesToWatts(host._pvChangeSeries, storeStartMs, p.stepMs, p.bucketsTotal, nowMs);
    //Production is never negative; floor tiny negative recorder changes (meter glitch noise).
    for (let i = 0; i < out.length; i++)
    {
        const v = out[i];
        if (v !== null && v < 0) { out[i] = 0; }
    }
    interpolatePastOnly(out, storeStartMs, nowMs, p.stepMs, p.bucketsTotal);
    return out;
}


//Forecast = HA Energy's solar forecast (energy/solar_forecast) aligned to store buckets. The forecast is hourly
//watt-hours; on fine buckets (<= 1 h) each reads the wh of the forecast hour its midpoint falls inside (stepped
//hourly curve, the magnitude the Energy dashboard draws). On coarse (daily) buckets a single midpoint sample would
//read noon's peak watts while production stores the day's MEAN watts, so the whole bucket is averaged instead - else
//the year curve towers over the actuals. All-null when no forecast source is configured.
function buildForecast(host: UnifiedStoreHost, storeStartMs: number, storeEndMs: number, p: CadenceParams): (number | null)[]
{
    const out = new Array<number | null>(p.bucketsTotal).fill(null);
    const forecast = host._haSolarForecast;
    if (!forecast || forecast.length === 0) { return out; }
    const coarse = p.stepMs > HOUR_MS;
    for (let h = 0; h < p.bucketsTotal; h++)
    {
        const start = storeStartMs + h * p.stepMs;
        const mid = start + p.stepMs / 2;
        if (mid < storeStartMs || mid >= storeEndMs) { continue; }
        const w = coarse
            ? forecastAverageWatts(forecast, start, start + p.stepMs)
            : forecastWattsAt(forecast, mid);
        if (w !== null && Number.isFinite(w)) { out[h] = Math.max(0, w); }
    }
    return out;
}


//Battery net power per bucket, "positive = charging". Charge watts from the stat_energy_to `change` series, discharge
//from stat_energy_from; net = charge - discharge. Two separate meters make the sign structural. Future buckets null.
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
    interpolatePastOnly(out, storeStartMs, nowMs, p.stepMs, p.bucketsTotal);
    return out;
}


//Grid import / export: average watts per bucket from the directional meter's recorder `change` series, like production
//(kWh * 1000 / bucket-hours). Reset-corrected + unit-normalised server-side. Past gaps interpolated, future null.
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
    interpolatePastOnly(out, storeStartMs, nowMs, stepMs, bucketsTotal);
    return out;
}


//Compact content signature for a recorder change-series: its length plus the last bucket's end + kWh. The last-kWh
//term is what tracks an in-place growing bucket: in month/year the current day is a single daily bucket whose kWh
//climbs all day at constant length, so it must feed the hash for the store to rebuild and the day bar to advance.
function changeSig(s: ChangeBucket[] | null): string
{
    const n = s?.length ?? 0;
    if (n === 0) { return '0'; }
    const last = s![n - 1];
    return `${n}.${last.endMs}.${last.kwh.toFixed(3)}`;
}

//Data-version hash: the active window + cadence + a content signature of every source, so the store rebuilds on a
//period change, a cadence-knob change, a new bucket, or the current bucket growing in place.
function computeDataVersion(host: UnifiedStoreHost): string
{
    //Day-key (local midnight) so the store rebuilds at the midnight rollover even when no new rows landed; otherwise
    //the per-day slices stay anchored on the previous day's origin until a fetch trips the hash.
    const todayKey = new Date().toDateString();
    const cadence  = modeBucketsPerHour(host._timelineMode, host.config);
    //Window in the hash so a period change invalidates on its own, no reliance on a store-null happening elsewhere.
    const window   = `${host._timelineMode}.${host._periodPastDays}.${host._periodFutureDays}`;
    //Weather series signature: its length + last time + last irradiance.
    const chart    = host._chartSeries;
    const chartN   = chart?.times.length ?? 0;
    const chartSig = chartN === 0 ? '0' : `${chartN}.${chart!.times[chartN - 1].getTime()}.${chart!.irradiance[chartN - 1] ?? 0}.${chart!.temperature?.[chartN - 1] ?? 0}`;
    //Battery charge + discharge kept SEPARATE (summing their lengths could collide, e.g. 3+5 == 5+3).
    return `d${todayKey}|w${window}|c${cadence}|s${chartSig}`
        + `|pv${changeSig(host._pvChangeSeries)}`
        + `|bc${changeSig(host._batteryChargeChangeSeries)}|bd${changeSig(host._batteryDischargeChangeSeries)}`
        + `|gi${changeSig(host._gridImportChangeSeries)}|ge${changeSig(host._gridExportChangeSeries)}`
        + `|f${host._haSolarForecast?.length ?? 0}`;
}


//Top-level builder. Resolves cadence from config, then runs each per-metric pass in dependency order. Pure function of
//the host snapshot: same input -> same output.
export function buildUnifiedStore(host: UnifiedStoreHost): UnifiedDataStore
{
    const bucketsPerHour = modeBucketsPerHour(host._timelineMode, host.config);
    const bucketsPerDay  = 24 * bucketsPerHour;
    //Rolling-window span from the card's active period (config seed or runtime override): daysPast + today + daysFuture.
    const daysPast   = host._periodPastDays;
    const daysFuture = host._periodFutureDays;
    const storeDays  = daysPast + 1 + daysFuture;
    const bucketsTotal   = storeDays * bucketsPerDay;
    const stepMs         = HOUR_MS / bucketsPerHour;
    const p: CadenceParams = { bucketsPerHour, bucketsTotal, stepMs };

    const storeStartMs = storeOriginMs(daysPast);
    const storeEndMs   = storeStartMs + storeDays * DAY_MS;
    const nowMs        = Date.now();
    const irradiance   = buildIrradiance(host, storeStartMs, storeEndMs, p);
    const temperature  = buildTemperature(host, storeStartMs, storeEndMs, p);
    const humidity     = buildHumidity(host, storeStartMs, storeEndMs, p);
    //Production reads ONLY real sensor samples and interpolates; forecast reads the HA Energy forecast at store cadence.
    const production   = buildProduction(host, storeStartMs, nowMs, p);
    const forecast     = buildForecast(host, storeStartMs, storeEndMs, p);
    const battery      = buildBattery(host, storeStartMs, nowMs, p);
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
        temperature,
        humidity,
        production,
        forecast,
        battery,
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
//Read-side accessors. Every consumer goes through these so bucket arithmetic and the interpolation contract stay in
//one place.
//---------------------------------------------------------------------------------------------------


//Linearly interpolate a series value at an exact timestamp. Null when outside the window OR both surrounding buckets null.
export function valueAt(series: readonly (number | null)[], store: UnifiedDataStore, ms: number): number | null
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




//Per-bucket samples over an arbitrary [startMs, endMs] sub-window, used by the main timeline chart. One entry per bucket
//whose centre falls inside; null = no data.
export interface RangeSlice
{
    times:      Date[];
    production: (number | null)[];
    forecast:   (number | null)[];
}

export function sliceForRange(store: UnifiedDataStore, startMs: number, endMs: number): RangeSlice
{
    const lo = Math.max(store.storeStartMs, startMs);
    const hi = Math.min(store.storeEndMs,   endMs);
    if (hi <= lo)
    {
        return { times: [], production: [], forecast: [] };
    }
    const stepMs = store.stepMs;
    const firstBucketIdx = Math.floor((lo - store.storeStartMs) / stepMs);
    const firstMid = store.storeStartMs + firstBucketIdx * stepMs + stepMs / 2;
    const times:      Date[]            = [];
    const production: (number | null)[] = [];
    const forecast:   (number | null)[] = [];
    for (let mid = firstMid; mid < hi; mid += stepMs)
    {
        if (mid < lo) { continue; }
        times.push(new Date(mid));
        production.push(valueAt(store.production, store, mid));
        forecast.push(  valueAt(store.forecast,   store, mid));
    }
    return { times, production, forecast };
}
