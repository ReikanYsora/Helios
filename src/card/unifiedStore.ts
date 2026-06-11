//Unified 5-day data source. Single source of truth for every per-time signal the dashboard cards,
//the radial sundial, the graph view and the main UI timeline read from. Built ONCE after the
//underlying fetches land, cached on the host, sliced and re-sampled by every downstream consumer
//at look-up time. Live numeric chips deliberately stay on the direct hass.states path (no extra
//layer between the live entity value and the chip text); every other surface that draws or hovers
//a curve uses this source.
//
//Cadence: a single user-facing knob (`display-update-frequency-per-hour`, 1-60, default 4) controls
//both the storage cadence of the data source and the rendering cadence of every graph that reads
//from it. Higher values give more precise curves at the cost of CPU per rebuild + memory per
//series. The forecast curve is the lone exception: it runs internally at the weather model's native
//hourly cadence (no point computing the predicted W per minute when the cloud-cover input only
//refreshes once an hour), then gets interpolated into the storage cadence at the end of the build.
//
//Window: J-2 to J+2 = 5 days × (24 × bucketsPerHour) buckets per series. Origin: storeStartMs =
//midnight (local time) of (today - 2 days), so bucket 0 sits at the J-2 day start.
//
//Series carried (every one is an array of length bucketsTotal, null marks "no real data and no
//surrounding real samples to interpolate between"):
//  - irradiance W/m² (weather model, interpolated between hourly samples)
//  - cloud %        (weather model, interpolated between hourly samples)
//  - production W   (PV LTS + raw history, interpolated between samples, no forecast mixed in)
//  - forecast W     (computePvPowerWeighted × calibration × shading map, hourly then resampled)
//  - battery W      (signed, history-driven, interpolated between samples)
//  - batterySoc %   (live observation only at the current bucket)
//  - gridImport W   (slope of cumulative kWh meter, interpolated between samples)
//  - gridExport W   (slope of cumulative kWh meter, interpolated between samples)
//
//Forecast is a peer of production, not a fallback for it. The radial dial overlays the forecast
//curve as a dashed line on top of the production fill; the two series are never mixed inside a
//single value.

import type { HeliosConfig } from '../helios-config';
import { displayUpdateFrequencyPerHour } from '../helios-config';
import type { ChartSeries } from './charts';
import type { PvHistory } from './pv';
import { pvCalibK, pvInverterMaxW, computePvPowerWeighted, snowCoverFactor } from './pv';
import { changeSeriesToWatts, type ChangeBucket } from './energy-stats';
import { sampleSkyResidual } from './forecast-sky';
import { sampleGti } from './gti';
import { getSunPosition } from '../engine/sun';
import { effectiveForecastRatio } from './charts';
import { computeForecastCalibration } from './calibration';
import { getHomeCoords } from './init';

//Re-export for graph consumers that want to query the user-configured cadence directly (e.g. the
//SVG path builders that walk bucketsPerHour at render time).
export { displayUpdateFrequencyPerHour } from '../helios-config';


const HOUR_MS = 3_600_000;
const DAY_MS  = 24 * HOUR_MS;

//5-day window, independent of the user-facing cadence knob.
export const STORE_DAYS_PAST  = 2;
export const STORE_DAYS_AHEAD = 2;
export const STORE_DAYS       = STORE_DAYS_PAST + 1 + STORE_DAYS_AHEAD;


//Per-build cadence bundle. Derived from the user config once at the top of buildUnifiedStore and
//threaded through every per-metric builder so the bucket arithmetic stays consistent across passes.
interface CadenceParams
{
    bucketsPerHour:  number;
    bucketsPerDay:   number;
    bucketsTotal:    number;
    stepMs:          number;
}


export interface UnifiedDataStore
{
    //Reference timestamps. storeStartMs is midnight of (today - STORE_DAYS_PAST) days local;
    //storeEndMs is midnight of (today + STORE_DAYS_AHEAD + 1) days local.
    storeStartMs:  number;
    storeEndMs:    number;
    //Cadence the series in this store live at. Captured on the store so every read-side accessor
    //(valueAt, sliceForDay, sliceForRange) stays consistent with the build, and so the rebuild
    //trigger can compare it against the current user setting to invalidate stale stores.
    bucketsPerHour: number;
    bucketsPerDay:  number;
    bucketsTotal:   number;
    stepMs:         number;
    //Build timestamp + data-version hash so consumers can detect "this is the same store as the
    //one I rendered against last frame" without comparing every series.
    builtAtMs:    number;
    dataVersion:  string;

    irradiance:   (number | null)[];
    cloud:        (number | null)[];
    production:   (number | null)[];
    forecast:     (number | null)[];
    //Pure physical-model forecast (no learned sky-residual ratio). The "PRÉVU" raw figure; `forecast`
    //is the same pipeline × the learned correction (the "affiné" figure + the timeline curve).
    forecastRaw:  (number | null)[];
    battery:      (number | null)[];
    batterySoc:   (number | null)[];
    gridImport:   (number | null)[];
    gridExport:   (number | null)[];
}


//Structural host surface required to build the store. Mirrors the union of what every per-metric
//builder needs to read; the actual card / dashboard host implements a superset of this.
export interface UnifiedStoreHost
{
    readonly config:                  HeliosConfig | undefined;
    readonly hass:                    { language?: string; states?: Record<string, { state: string }>; config?: { latitude?: number; longitude?: number } } | undefined;
    readonly _chartSeries:            ChartSeries | null;
    readonly _pvHistory:              PvHistory | null;
    //Recorder `change` series for the solar energy meter(s), 5-minute buckets. The canonical past-
    //production source: buildProduction converts each bucket's reset-corrected kWh to average watts.
    readonly _pvChangeSeries:         ChangeBucket[] | null;
    readonly _pvCalibStats:           PvHistory | null;
    readonly _pvUnit:                 string;
    //Recorder `change` series for the battery charge (stat_energy_to) + discharge (stat_energy_from)
    //meters. buildBattery nets them (charge - discharge) so the sign is structural.
    readonly _batteryChargeChangeSeries:    ChangeBucket[] | null;
    readonly _batteryDischargeChangeSeries: ChangeBucket[] | null;
    readonly _batterySoc:             number | null;
    //Recorder `change` series for the grid import / export energy meters, 5-minute buckets. Same
    //contract as the production series: each direction's bucket kWh is converted to average watts.
    readonly _gridImportChangeSeries: ChangeBucket[] | null;
    readonly _gridExportChangeSeries: ChangeBucket[] | null;
    readonly _engine?:                { getLidarRaster(): import('../engine/pv-shading').NdsmRaster | null };
    //Learned sky-residual forecast correction (src/card/forecast-sky.ts). Multiplies the forecast per
    //sun position so it converges to the user's real shading + biases. Null until the histories land,
    //in which case the forecast stays on the physical + LiDAR + scalar-calibration path unchanged.
    readonly _skyResidualMap:         import('./forecast-sky').SkyResidualMap | null;
    //Per-orientation Open-Meteo GTI store (src/card/gti.ts). When present, buildForecast transposes each
    //array on the model's anisotropic plane-of-array irradiance instead of our isotropic Liu-Jordan.
    //Null until the per-orientation fetches land, in which case the transposition path is used.
    readonly _gtiStore:               import('./gti').GtiStore | null;
}


//Bucket arithmetic helpers. Bucketing is HALF-OPEN: a sample at time t lands in bucket
//Math.floor((t - storeStartMs) / stepMs). Out-of-window samples return -1.
function bucketForMs(storeStartMs: number, ms: number, stepMs: number, bucketsTotal: number): number
{
    if (ms < storeStartMs) { return -1; }
    const idx = Math.floor((ms - storeStartMs) / stepMs);
    if (idx >= bucketsTotal) { return -1; }
    return idx;
}

//Fill null gaps in a sparse array with linear interpolation between the bracketing non-null samples.
//Edges (before the first non-null, after the last non-null) carry the nearest non-null forward /
//backward so the consumer always sees a continuous progression where it makes sense to extrapolate.
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


//Midnight (local time) of the J-2 day. Used as the store origin so every per-day slice lines up on
//calendar day boundaries.
function storeOriginMs(): number
{
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() - STORE_DAYS_PAST * DAY_MS;
}


//---------------------------------------------------------------------------------------------------
//Per-metric builders. Each walks one source array (or a small set of sources), bucketizes the
//in-window samples and returns a length-p.bucketsTotal array. Builders that depend on already-built
//series take them as a second argument so the build order stays explicit.
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
    //Weather model lands at 1 sample / hour, the rest of the buckets stay null until we interpolate.
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


//Production = past actual only, no model fallback. Sourced from the recorder `change` metric on the
//solar energy meter(s) (host._pvChangeSeries), the exact same data the HA Energy dashboard consumes:
//each 5-minute bucket's reset-corrected, unit-normalised kWh is converted to its average watts
//(kWh * 1000 / bucket-hours). No client-side counter differentiation, no unit-string classification,
//so a 15-minute SolarEdge counter or a daily-reset meter is handled natively by the recorder.
//
//Store buckets are always >= the 5-minute source period (the data-interval control caps at 12 / hour
//= 5 min), so each store bucket aggregates one or more whole source buckets and the conversion is
//exact. Past gaps between source buckets are linearly interpolated so the curve stays continuous;
//future buckets stay null so the forecast series owns the future half.
function buildProduction(host: UnifiedStoreHost, _storeStartMs: number, _storeEndMs: number, nowMs: number, p: CadenceParams): (number | null)[]
{
    const out = changeSeriesToWatts(host._pvChangeSeries, _storeStartMs, p.stepMs, p.bucketsTotal, nowMs);
    //Production is never negative; a tiny negative recorder change (meter glitch) is noise, floor it.
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


//Forecast = computePvPowerWeighted × pvCalibK × (learned sky-residual ratio, or the 5-day scalar when
//the map is cold) × snow-cover derate, at every STORE bucket. Runs at the display cadence so a fine
//"graph detail" setting resolves short shadow dips; the hourly Open-Meteo weather is interpolated
//between samples to keep the magnitude smooth. Emits the corrected forecast + the raw physical model.
function buildForecast(
    host: UnifiedStoreHost,
    storeStartMs: number,
    storeEndMs: number,
    p: CadenceParams,
): { forecast: (number | null)[]; forecastRaw: (number | null)[] }
{
    const empty = () => new Array<number | null>(p.bucketsTotal).fill(null);
    const series = host._chartSeries;
    const coords = getHomeCoords(host.config, host.hass);
    if (!series || !coords) { return { forecast: empty(), forecastRaw: empty() }; }
    const k = pvCalibK(host.config);
    if (k === null) { return { forecast: empty(), forecastRaw: empty() }; }
    const cap     = pvInverterMaxW(host.config);
    const cal     = computeForecastCalibration(host as any);
    const calR    = cal ? cal.ratio : 1;
    const raster  = host._engine?.getLidarRaster() ?? null;

    //Inner loop runs at the STORE cadence (the "graph detail" slider, default 4/h = 15 min) instead of
    //a fixed hourly pass. The LiDAR shading + sun position are then sampled every bucket, so a short
    //shadow (a tree clipping production for 30-45 min) is resolved instead of being stepped over by an
    //hourly midpoint. The hourly Open-Meteo weather is interpolated between samples so the magnitude
    //stays smooth at any cadence (no hourly stair-steps). `hourly` is the corrected forecast (model ×
    //learned ratio); `hourlyRaw` is the pure physical model (no learned ratio) for the "PRÉVU" figure.
    const hourly    = new Array<number | null>(p.bucketsTotal).fill(null);
    const hourlyRaw = new Array<number | null>(p.bucketsTotal).fill(null);
    const times     = series.times;
    let wi = 0;   //moving cursor into the hourly weather series; bucket midpoints are ascending
    for (let h = 0; h < p.bucketsTotal; h++)
    {
        const mid = storeStartMs + h * p.stepMs + p.stepMs / 2;
        if (mid < storeStartMs || mid >= storeEndMs) { continue; }
        if (times.length === 0) { continue; }

        //Bracket the bucket midpoint between two hourly weather samples and interpolate each field.
        while (wi < times.length - 1 && times[wi + 1].getTime() <= mid) { wi++; }
        const i0 = wi;
        const i1 = Math.min(times.length - 1, wi + 1);
        const t0 = times[i0].getTime();
        const t1 = times[i1].getTime();
        const f  = (t1 > t0) ? Math.max(0, Math.min(1, (mid - t0) / (t1 - t0))) : 0;

        const cc   = lerpPlain(series.cloud[i0],       series.cloud[i1],       f);
        const ghi  = lerpPlain(series.irradiance[i0],  series.irradiance[i1],  f);
        const dir  = lerpRad(series.directRad?.[i0],   series.directRad?.[i1],  f);
        const dif  = lerpRad(series.diffuseRad?.[i0],  series.diffuseRad?.[i1], f);
        const temp = lerpFinite(series.temperature?.[i0], series.temperature?.[i1], f);
        const wind = lerpFinite(series.windSpeed?.[i0],   series.windSpeed?.[i1],   f);
        const snow = lerpFinite(series.snowDepth?.[i0],   series.snowDepth?.[i1],   f);

        const t = new Date(mid);
        const wRaw = computePvPowerWeighted(host.config, t, coords.lat, coords.lon, cc, {
            airTempC:     temp,
            windMs:       wind,
            //Open-Meteo shortwave (or home sensor) GHI as the irradiance base; beam + diffuse drive the
            //real direct / diffuse split; per-orientation GTI replaces the transposition where available.
            ghiWm2:       ghi,
            directWm2:    dir,
            diffuseWm2:   dif,
            tiltedPoaWm2: host._gtiStore ? (tilt, az) => sampleGti(host._gtiStore, tilt, az, mid) : undefined,
            raster,
        });
        //Calibration ratio. When the learned sky map is warm it REPLACES the 5-day scalar, carrying the
        //level AND the per-sun-position shape (a tree the LiDAR missed, foliage, a wrong cell). A cold
        //cell falls back to the map's global level; no map at all keeps the legacy clamped scalar.
        let ratio: number;
        if (host._skyResidualMap)
        {
            const sun = getSunPosition(t, coords.lat, coords.lon);
            ratio = sampleSkyResidual(host._skyResidualMap, sun.azimuth, sun.altitude);
        }
        else
        {
            ratio = effectiveForecastRatio(calR);
        }
        //Raw = pure physics (LiDAR + thermal + GTI + snow), no learned ratio. Corrected = × ratio.
        const snowF = snowCoverFactor(snow, temp);
        const rawW  = wRaw * k * snowF;
        if (Number.isFinite(rawW))
        {
            hourlyRaw[h] = Math.min(cap, Math.max(0, rawW));
        }
        const w = rawW * ratio;
        if (Number.isFinite(w))
        {
            hourly[h] = Math.min(cap, Math.max(0, w));
        }
    }
    return { forecast: hourly, forecastRaw: hourlyRaw };
}


//Interpolate a weather field between two bracketing hourly samples. lerpPlain assumes both sides are
//valid numbers (cloud / irradiance always are in the chart series). lerpRad guards the -1 "no data"
//sentinel on the radiation fields, lerpFinite the NaN padding on temp / wind / snow: if one side is
//missing take the other, if both return undefined so the model context falls back.
function lerpPlain(a: number, b: number, f: number): number
{
    return a + (b - a) * f;
}
function lerpRad(a: number | undefined, b: number | undefined, f: number): number | undefined
{
    const ba = !(typeof a === 'number' && isFinite(a) && a >= 0);
    const bb = !(typeof b === 'number' && isFinite(b) && b >= 0);
    if (ba && bb) { return undefined; }
    if (ba) { return b; }
    if (bb) { return a; }
    return a! + (b! - a!) * f;
}
function lerpFinite(a: number | undefined, b: number | undefined, f: number): number | undefined
{
    const ba = !(typeof a === 'number' && isFinite(a));
    const bb = !(typeof b === 'number' && isFinite(b));
    if (ba && bb) { return undefined; }
    if (ba) { return b; }
    if (bb) { return a; }
    return a! + (b! - a!) * f;
}


//Battery net power per bucket, convention "positive = charging". Charge watts come from the
//stat_energy_to `change` series, discharge from stat_energy_from; the net is charge - discharge.
//Because the two directions are separate recorder meters, the sign is structural, charging is never
//lost (the bug where a single signed sensor only ever surfaced discharge). Future buckets null.
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


//Battery SoC: no per-bucket history fetch today, so we only have the live state. Park it on the
//bucket "now" sits in and leave every other bucket null.
function buildBatterySoc(host: UnifiedStoreHost, storeStartMs: number, nowMs: number, p: CadenceParams): (number | null)[]
{
    const out = new Array<number | null>(p.bucketsTotal).fill(null);
    const live = host._batterySoc;
    if (live === null || live === undefined || !Number.isFinite(live)) { return out; }
    const h = bucketForMs(storeStartMs, nowMs, p.stepMs, p.bucketsTotal);
    if (h >= 0) { out[h] = Math.max(0, Math.min(100, live)); }
    return out;
}


//Grid import / export: average watts per bucket from the recorder `change` series on the
//directional energy meter, exactly like the production series (kWh * 1000 / bucket-hours). Reset-
//corrected + unit-normalised server-side, no client-side differentiation. Past gaps interpolated,
//future buckets null.
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


//Cheap data-version hash. Combines the cadence + the lengths of every underlying source so a fetch
//that grows any of them OR the user-facing cadence knob change invalidates the cache key.
function computeDataVersion(host: UnifiedStoreHost): string
{
    //Day-key (local midnight). Included in the version hash so the store auto-rebuilds at midnight
    //rollover even when no new source rows have landed yet. Without this, opening the dashboard
    //after a midnight passage with the same fetched arrays leaves the store anchored on the
    //previous day's J-2 origin, and every per-day slice ends up shifted by one day until the
    //first fresh fetch trips a length change.
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
    return `d${todayKey}|c${cadence}|${seriesLen}|${pvHistLen}|${pvCalibLen}|${pvChangeLen}|${battHistLen}|${gridImpLen}|${gridExpLen}|${socLive}`;
}


//Top-level builder. Resolves the cadence from the user config, then runs each per-metric pass in
//dependency order. Pure function of the host snapshot: same input -> same output, no side effects.
export function buildUnifiedStore(host: UnifiedStoreHost): UnifiedDataStore
{
    const bucketsPerHour = displayUpdateFrequencyPerHour(host.config);
    const bucketsPerDay  = 24 * bucketsPerHour;
    const bucketsTotal   = STORE_DAYS * bucketsPerDay;
    const stepMs         = HOUR_MS / bucketsPerHour;
    const p: CadenceParams = { bucketsPerHour, bucketsPerDay, bucketsTotal, stepMs };

    const storeStartMs = storeOriginMs();
    const storeEndMs   = storeStartMs + STORE_DAYS * DAY_MS;
    const nowMs        = Date.now();
    const irradiance   = buildIrradiance(host, storeStartMs, storeEndMs, p);
    const cloud        = buildCloud(host, storeStartMs, storeEndMs, p);
    //Production reads ONLY real sensor samples and interpolates between them. Forecast is the model
    //output, computed at the store cadence with the hourly weather interpolated between samples.
    const production   = buildProduction(host, storeStartMs, storeEndMs, nowMs, p);
    const fc           = buildForecast(host, storeStartMs, storeEndMs, p);
    const forecast     = fc.forecast;
    const forecastRaw  = fc.forecastRaw;
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
        forecastRaw,
        battery,
        batterySoc,
        gridImport,
        gridExport,
    };
}


//Returns true when the store already on the host matches the host's current data version. Lets the
//caller decide whether to skip a rebuild (cache stays warm) or trigger a fresh build.
export function isStoreFresh(host: UnifiedStoreHost, store: UnifiedDataStore | null): boolean
{
    if (!store) { return false; }
    return store.dataVersion === computeDataVersion(host);
}


//---------------------------------------------------------------------------------------------------
//Read-side accessors. Every downstream consumer (radial dial, graph view, timeline) goes through
//these so the bucket arithmetic stays in one place and the interpolation contract is consistent.
//---------------------------------------------------------------------------------------------------


//Linearly interpolate a series value at an exact timestamp. Returns null when the timestamp falls
//outside the store window OR both surrounding buckets are null.
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


//Bucket range for the day at offset `dayOffset` (-2..+2 typically). Returns the half-open
//[startBucket, endBucket) indices that cover that calendar day. Out-of-range offsets clamp to the
//store bounds.
export function dayBucketRange(store: UnifiedDataStore, dayOffset: number): { start: number; end: number }
{
    const dayStartMs = store.storeStartMs + (STORE_DAYS_PAST + dayOffset) * DAY_MS;
    const startBucket = Math.max(0, bucketForMs(store.storeStartMs, dayStartMs, store.stepMs, store.bucketsTotal));
    const endBucket   = Math.min(store.bucketsTotal, startBucket + store.bucketsPerDay);
    return { start: startBucket, end: endBucket };
}


//Integrate the forecast series (watts per bucket) over [dayStartMs, dayEndMs) into kWh, at the store
//cadence: each non-null bucket contributes watts × stepHours / 1000. The single source for every
//forecast kWh figure (dashboard headline, CoverFlow cards, day-strip chips) so they all match the
//timeline curve exactly. `raw` selects the uncorrected physical model (the "PRÉVU" figure) over the
//learned-corrected forecast (the "affiné" figure). Returns null when no bucket in range carried a value.
export function integrateForecastKwh(store: UnifiedDataStore, dayStartMs: number, dayEndMs: number, raw = false): number | null
{
    const series = raw ? store.forecastRaw : store.forecast;
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


//Cumulative forecast kWh samples across [dayStartMs, dayEndMs), one point per store bucket, for the
//dashboard's running intraday forecast curve. Same integration as integrateForecastKwh so the curve's
//endpoint equals the headline total. Always seeded with a 0 point at dayStartMs.
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


//Slice the per-day arrays for the card at `dayOffset`. Returns store.bucketsPerDay-length series
//(storage == display cadence in the current architecture, so no resampling is needed). Graphs walk
//the returned arrays at their native length.
export interface DaySlice
{
    dayStartMs:  number;
    dayEndMs:    number;
    pastEndHour: number;
    bucketsPerHour: number;
    hourlyIrradiance: ReadonlyArray<number | null>;
    hourlyCloud:      ReadonlyArray<number | null>;
    hourlyProd:       ReadonlyArray<number | null>;
    hourlyForecast:   ReadonlyArray<number | null>;
    hourlyBatt:       ReadonlyArray<number | null>;
    hourlyBattSoc:    ReadonlyArray<number | null>;
    hourlyGridIn:     ReadonlyArray<number | null>;
    hourlyGridOut:    ReadonlyArray<number | null>;
}

export function sliceForDay(store: UnifiedDataStore, dayOffset: number): DaySlice
{
    const dayStartMs = store.storeStartMs + (STORE_DAYS_PAST + dayOffset) * DAY_MS;
    const dayEndMs   = dayStartMs + DAY_MS;
    const nowMs      = Date.now();
    const pastEndHour = dayEndMs <= nowMs ? 24
                      : dayStartMs >= nowMs ? 0
                      : (nowMs - dayStartMs) / HOUR_MS;
    const { start, end } = dayBucketRange(store, dayOffset);
    return {
        dayStartMs,
        dayEndMs,
        pastEndHour,
        bucketsPerHour:   store.bucketsPerHour,
        hourlyIrradiance: store.irradiance.slice(start, end),
        hourlyCloud:      store.cloud.slice(start, end),
        hourlyProd:       store.production.slice(start, end),
        hourlyForecast:   store.forecast.slice(start, end),
        hourlyBatt:       store.battery.slice(start, end),
        hourlyBattSoc:    store.batterySoc.slice(start, end),
        hourlyGridIn:     store.gridImport.slice(start, end),
        hourlyGridOut:    store.gridExport.slice(start, end),
    };
}


//Per-bucket samples covering an arbitrary [startMs, endMs] sub-window of the store. Used by the
//main timeline chart which renders the production + forecast curves across the visible 5-day window.
//One entry per storage bucket whose centre falls inside the requested window; null entries indicate
//"no data" for that bucket.
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
