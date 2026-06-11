//Learned sky-residual correction for the PV forecast.
//
//The physical forecast (clear-sky × cloud × thermal × LiDAR shading) plus the 5-day scalar
//calibration captures the AVERAGE production level, but it misses the SHAPE errors that depend on
//where the sun sits in the sky: a tree the LiDAR raster never saw, foliage that grew since the scan,
//a neighbour's roof the flood-fill clipped, or simply a LiDAR cell that was wrong. Those errors are
//systematic and repeat every day at the same sun position, so they are learnable from the user's own
//production history.
//
//This module derives, per (sun-azimuth, sun-altitude) cell, the RATIO between what the user actually
//produced and what the current model (LiDAR included) predicted, over a rolling multi-week window.
//The ratio carries BOTH the level (the model's systematic over/under-prediction) AND the shape (how
//each sun position deviates), because the dominant error is often the level and the old clamped
//5-day scalar couldn't rattle a >50 % miss. At forecast time the ratio replaces that scalar entirely
//when the map is warm: forecast = model × sky-ratio(sun position). A thinly-sampled cell falls back
//to the global mean ratio (the learned overall level), and a brand-new install with no history at
//all gets a null map so the caller keeps the legacy scalar-calibration path, losing nothing on day 1.
//
//The map is 2D (sun azimuth × altitude), carries no localStorage and no per-frame projection (it is
//sampled only when the forecast is built, never drawn), and is recency-weighted so it tracks seasonal
//foliage + soiling instead of averaging a year of stale data. LiDAR stays the cold-start prior (it
//already shades the base model the residual multiplies) and the map only refines what the LiDAR got
//wrong.

import type { HeliosConfig } from '../helios-config';
import type { NdsmRaster } from '../engine/pv-shading';
import { computePvPowerWeighted, pvCalibK, snowCoverFactor, inverterCutoffSocPct, batterySocEntityForInhibit } from './pv';
import { getSunPosition } from '../engine/sun';
import { sampleGti } from './gti';
import { fetchChangeSeries, fetchMeanSeries, type ChangeBucket, type MeanBucket } from './energy-stats';
import { beginLoadingPhase, endLoadingPhase, type LoadingTrackerHost } from './loading-tracker';


//Learning window. 60 days is long enough for the sun's sunrise / sunset azimuths to sweep a wide arc
//and for the altitude band to cover a season's worth of midday heights, so the map fills out, while
//staying inside Open-Meteo's 92-day past_days ceiling and the recorder's hourly-statistics retention.
const LEARN_DAYS = 60;


//Cell grid over the sky hemisphere. 10 deg azimuth × 5 deg altitude = 36 × 18 = 648 cells, of which
//only the daytime arc band is ever visited. Coarse on purpose: a finer grid would fragment the
//per-cell sample count and the residual would read as noise instead of a stable shading signature.
const AZ_STEP_DEG  = 10;
const ALT_STEP_DEG = 5;
const N_AZ  = Math.round(360 / AZ_STEP_DEG);   //36
const N_ALT = Math.round(90  / ALT_STEP_DEG);  //18

//Recency half-life. A residual learned 30 days ago carries half the weight of one learned today, so
//the map tracks the current canopy (leaves on / off) and soiling state instead of a stale annual
//mean.
const RECENCY_HALF_LIFE_MS = 30 * 24 * 3_600_000;

//Confidence saturation. conf = 1 - exp(-weight / W0); W0 is the accumulated weight at which a cell is
//~63 % trusted. Tuned so a handful of clear-day samples already pull the cell meaningfully off 1
//while a single noisy sample stays mostly on the model.
const CONF_W0 = 4;

//Ratio clamp. Wider than the legacy scalar's [0.5, 1.5] because the learned ratio is trusted to
//carry a real level error too (e.g. a 2x kWp misconfig), but still bounded so one sensor fault /
//inverter clip can't drive the forecast to absurdity.
const M_MIN = 0.2;
const M_MAX = 2.5;

//Minimum total weighted samples before the map is trusted at all. Below this a brand-new / barely-
//run install would learn a noisy global level, so we return null and the caller keeps the legacy
//5-day scalar calibration. ~a few clear-ish days of midday production clear this.
const MIN_TOTAL_WEIGHT = 3;

//Per-hour model floor (kWh). Below this the predicted energy is so small (deep dusk, low winter sun)
//that actual/model is dominated by quantisation + measurement noise, so the sample is dropped.
const MODEL_KWH_FLOOR = 0.05;

//Sub-samples per learning hour. The production history is hourly (recorder retention caps the 60-day
//window at hourly stats), but the model is evaluated at this many instants across each hour so its
//shading reflects the same sub-hourly geometry the forecast resolves. 4 = one per 15 min.
const LEARN_SUBSAMPLES = 4;

//Leading-edge smoothing. At a fixed time of day the sun's (az, alt) drifts with the season, so the
//cells the FUTURE forecast samples sit just beyond what the history has observed at that hour and
//carry few samples. A confident shading feature learned in the cell the sun has just swept past
//should bleed one cell forward so the future forecast inherits it instead of falling back to the
//global ratio. SMOOTH_CONF_KEEP: cells at / above this confidence are left untouched so sharp,
//well-sampled features are not blurred. SMOOTH_NEIGHBOR_W: how strongly a confident neighbour's ratio
//pulls a thin cell off the global fallback.
const SMOOTH_CONF_KEEP  = 0.6;
const SMOOTH_NEIGHBOR_W = 0.6;


export interface SkyResidualMap
{
    nAz:  number;
    nAlt: number;
    //actual/model ratio per cell (level + shape), clamped to [M_MIN, M_MAX]. Equals globalRatio
    //where the cell was never visited.
    m:    Float32Array;
    //Confidence per cell in [0, 1]; blends the cell ratio toward globalRatio for thinly sampled cells.
    conf: Float32Array;
    //Weighted-mean actual/model over every sample = the learned overall level, the fallback for cold
    //cells and the value the map applies in place of the legacy 5-day scalar.
    globalRatio: number;
    //Diagnostics: total weighted samples + count of visited cells, surfaced through heliosStats so a
    //power user can see how warmed-up the map is.
    totalWeight:  number;
    visitedCells: number;
}


//Inputs the build needs, decoupled from how they are fetched so the module stays a pure function.
export interface SkyResidualInput
{
    config: HeliosConfig | undefined;
    lat:    number;
    lon:    number;
    raster: NdsmRaster | null;
    //Hourly produced-energy buckets (recorder `change`, period 'hour') over the learning window.
    production: ChangeBucket[] | null;
    //Hourly cloud-cover % + shortwave / direct / diffuse radiation (W/m²), parallel arrays on the same
    //time grid (`cloudTimes`). The build matches each production bucket to the nearest sample by time.
    //shortwave is fed to the model as the GHI base, direct + diffuse drive the tilt split, so the build
    //stays consistent with the forecast (which uses the same Open-Meteo fields), keeping the learned
    //residual self-consistent.
    cloudTimes: number[];
    cloud:      number[];
    shortwave:  number[];
    direct:     number[];
    diffuse:    number[];
    //Air temperature (°C), 10 m wind (m/s) and ground snow depth (m) on the same `cloudTimes` grid. The
    //model eval passes temp + wind for thermal derating and applies the snow-cover derate, so the
    //learning runs the SAME physics as the forecast and the residual carries only the local shading /
    //bias, not a thermal or snow offset the forecast also applies.
    temp:       number[];
    wind:       number[];
    snow:       number[];
    //Per-orientation Open-Meteo GTI store (src/card/gti.ts). The model eval below transposes each array
    //on it when present, exactly like the forecast, so the learned residual stays consistent with the
    //curve it corrects. Null leaves the learning on the transposition path.
    gtiStore:   import('./gti').GtiStore | null;
    //Battery state-of-charge over the learning window (hourly mean %) + the inverter-cutoff threshold.
    //When both are set, a production hour whose SoC reached the cutoff is DROPPED from the learning: the
    //inverter clamped PV output because the battery was full, so the low production is curtailment, not
    //shading, and learning from it would teach the map a false low ratio at that sun position. Null SoC
    //or null cutoff disables the guard.
    socSeries:  MeanBucket[] | null;
    cutoffSoc:  number | null;
}


//Bilinear lookup of the actual/model ratio at an exact sun position, each cell confidence-blended
//toward the global level so thin cells lean on the well-estimated overall ratio instead of noise.
//Reads the four surrounding cells and weights by both the bilinear corner weight and (implicitly)
//confidence, so the correction is smooth across cell boundaries. Returns the global ratio for the
//rare exact-horizon case. The caller multiplies (model × k) by this, replacing the legacy scalar.
export function sampleSkyResidual(map: SkyResidualMap, azDeg: number, altDeg: number): number
{
    const g = map.globalRatio;
    if (altDeg <= 0) { return g; }
    let az = azDeg % 360;
    if (az < 0) { az += 360; }
    const alt = Math.max(0, Math.min(90 - 1e-3, altDeg));

    const fAz  = az  / AZ_STEP_DEG;
    const fAlt = alt / ALT_STEP_DEG;
    const az0  = Math.floor(fAz);
    const alt0 = Math.floor(fAlt);
    const dAz  = fAz  - az0;
    const dAlt = fAlt - alt0;

    let num = 0;
    let den = 0;
    for (let i = 0; i <= 1; i++)
    {
        for (let j = 0; j <= 1; j++)
        {
            const ai = (az0 + i) % map.nAz;       //azimuth wraps around 360
            const aj = alt0 + j;
            if (aj < 0 || aj >= map.nAlt) { continue; }
            const idx = aj * map.nAz + ai;
            //Cell value = its own ratio blended toward the global level by confidence. A cold cell
            //(conf 0) contributes exactly the global ratio.
            const cellM = map.conf[idx] * map.m[idx] + (1 - map.conf[idx]) * g;
            const w = (i === 0 ? 1 - dAz : dAz) * (j === 0 ? 1 - dAlt : dAlt);
            num += w * cellM;
            den += w;
        }
    }
    return den > 0 ? num / den : g;
}


//Build the residual map from the production + cloud history. Returns null when there is not enough
//signal to learn anything (no production buckets, no peak power configured), in which case the caller
//keeps the unmodified forecast.
export function buildSkyResidualMap(input: SkyResidualInput): SkyResidualMap | null
{
    const k = pvCalibK(input.config);
    if (k === null) { return null; }
    if (!input.production || input.production.length === 0) { return null; }
    if (input.cloudTimes.length === 0) { return null; }

    const nowMs = Date.now();
    const sumW   = new Float64Array(N_AZ * N_ALT);
    const sumWR  = new Float64Array(N_AZ * N_ALT);
    let globalSumW  = 0;
    let globalSumWR = 0;

    for (const bucket of input.production)
    {
        const kwh = bucket.kwh;
        if (!Number.isFinite(kwh) || kwh < 0) { continue; }
        //Hour midpoint as the sample instant.
        const mid = (bucket.startMs + bucket.endMs) / 2;
        const sun = getSunPosition(new Date(mid), input.lat, input.lon);
        if (sun.altitude <= 0) { continue; }

        //Inverter-cutoff guard: drop hours where the battery was full and the inverter clamped PV
        //output, so the curtailed production isn't mistaken for shading at that sun position.
        if (input.cutoffSoc !== null)
        {
            const soc = socAtMs(input.socSeries, mid);
            if (soc !== null && soc >= input.cutoffSoc) { continue; }
        }

        const ci    = nearestCloudIdx(input.cloudTimes, mid);
        const cloud = ci >= 0 ? clampPct(input.cloud[ci]) : 0;
        const ghi   = ci >= 0 ? input.shortwave[ci] : undefined;
        const dir   = ci >= 0 ? input.direct[ci]    : undefined;
        const dif   = ci >= 0 ? input.diffuse[ci]   : undefined;
        const temp  = ci >= 0 ? input.temp[ci]      : undefined;
        const wind  = ci >= 0 ? input.wind[ci]      : undefined;
        const snow  = ci >= 0 ? input.snow[ci]      : undefined;

        //Model prediction for this hour, running the SAME physics as buildForecast: LiDAR + Open-Meteo
        //GHI base + direct / diffuse split + per-orientation GTI + thermal derating + snow-cover derate.
        //The model power is averaged over LEARN_SUBSAMPLES sub-instants spanning the hour (the weather is
        //hourly so only the sun position + LiDAR shading vary), so modelKwh reflects the FRACTION of the
        //hour the array is actually shaded, matching the sub-hourly forecast. Without this the hourly
        //midpoint either hits or misses a short shadow, and the residual would absorb a shadow the
        //sub-hourly forecast also resolves geometrically, double-counting it.
        const baseCtx = {
            raster:       input.raster,
            airTempC:     (temp != null && isFinite(temp)) ? temp : undefined,
            windMs:       (wind != null && isFinite(wind)) ? wind : undefined,
            ghiWm2:       (ghi != null && ghi >= 0) ? ghi : undefined,
            directWm2:    (dir != null && dir >= 0) ? dir : undefined,
            diffuseWm2:   (dif != null && dif >= 0) ? dif : undefined,
        };
        let wSum = 0;
        let wN   = 0;
        for (let s = 0; s < LEARN_SUBSAMPLES; s++)
        {
            const subT = bucket.startMs + (s + 0.5) * (bucket.endMs - bucket.startMs) / LEARN_SUBSAMPLES;
            if (getSunPosition(new Date(subT), input.lat, input.lon).altitude <= 0) { continue; }
            wSum += computePvPowerWeighted(input.config, new Date(subT), input.lat, input.lon, cloud, {
                ...baseCtx,
                tiltedPoaWm2: input.gtiStore ? (tilt, az) => sampleGti(input.gtiStore, tilt, az, subT) : undefined,
            });
            wN++;
        }
        if (wN === 0) { continue; }
        const modelKwh = (wSum / wN) * k * snowCoverFactor(snow, temp) / 1000;
        if (modelKwh < MODEL_KWH_FLOOR) { continue; }

        const ratio = kwh / modelKwh;
        if (!Number.isFinite(ratio) || ratio < 0) { continue; }

        //Weight: recency (exp decay, 30-day half-life) × clearness (shading reads cleanest on a clear
        //sky; a fully overcast hour still informs the cell, just less). Clamped so overcast keeps a
        //small floor weight rather than dropping out entirely.
        const ageMs   = Math.max(0, nowMs - mid);
        const recency = Math.pow(0.5, ageMs / RECENCY_HALF_LIFE_MS);
        const clear   = Math.max(0.1, 1 - cloud / 100);
        const w       = recency * clear;
        if (w <= 0) { continue; }

        const azIdx  = Math.min(N_AZ - 1, Math.max(0, Math.floor(((sun.azimuth % 360 + 360) % 360) / AZ_STEP_DEG)));
        const altIdx = Math.min(N_ALT - 1, Math.max(0, Math.floor(sun.altitude / ALT_STEP_DEG)));
        const idx    = altIdx * N_AZ + azIdx;

        sumW[idx]  += w;
        sumWR[idx] += w * ratio;
        globalSumW  += w;
        globalSumWR += w * ratio;
    }

    if (globalSumW < MIN_TOTAL_WEIGHT) { return null; }
    //Global weighted-mean actual/model = the learned overall level. This replaces the clamped 5-day
    //scalar (it can carry a real level error the scalar's [0.5, 1.5] clamp couldn't), and is the
    //fallback for cells with no / little data.
    const globalRatio = Math.max(M_MIN, Math.min(M_MAX, globalSumWR / globalSumW));
    if (!(globalRatio > 0)) { return null; }

    const m    = new Float32Array(N_AZ * N_ALT).fill(globalRatio);
    const conf = new Float32Array(N_AZ * N_ALT);
    let visited = 0;
    for (let i = 0; i < m.length; i++)
    {
        if (sumW[i] <= 0) { continue; }
        const cellMean = sumWR[i] / sumW[i];
        m[i]    = Math.max(M_MIN, Math.min(M_MAX, cellMean));
        conf[i] = 1 - Math.exp(-sumW[i] / CONF_W0);
        visited++;
    }

    //Leading-edge smoothing pass. ONLY thin cells (conf < SMOOTH_CONF_KEEP) that sit next to a
    //confident neighbour are touched: they adopt a confidence-weighted blend of that neighbour's
    //learned ratio and gain a fraction of its confidence, so a recently-emerged shading dip reaches the
    //leading-edge sun positions the future forecast samples. Confident cells are copied through
    //untouched (sharp features preserved), and a thin cell with no confident neighbour is left to lean
    //on the global ratio (isolated noise is never amplified).
    const mS    = m.slice();
    const confS = conf.slice();
    for (let aj = 0; aj < N_ALT; aj++)
    {
        for (let ai = 0; ai < N_AZ; ai++)
        {
            const idx      = aj * N_AZ + ai;
            const selfConf = conf[idx];
            if (selfConf >= SMOOTH_CONF_KEEP) { continue; }

            let num = 0;
            let den = 0;
            let bestNbConf = 0;
            for (let dAlt = -1; dAlt <= 1; dAlt++)
            {
                const nj = aj + dAlt;
                if (nj < 0 || nj >= N_ALT) { continue; }
                for (let dAz = -1; dAz <= 1; dAz++)
                {
                    if (dAlt === 0 && dAz === 0) { continue; }
                    const ni   = (ai + dAz + N_AZ) % N_AZ;   //azimuth wraps around 360
                    const nIdx = nj * N_AZ + ni;
                    const c    = conf[nIdx];
                    num += c * m[nIdx];
                    den += c;
                    if (c > bestNbConf) { bestNbConf = c; }
                }
            }
            if (den <= 0 || bestNbConf <= 0) { continue; }   //no confident neighbour: leave as-is

            const nbM    = num / den;
            const nbPull = SMOOTH_NEIGHBOR_W * bestNbConf;
            mS[idx]      = (selfConf * m[idx] + nbPull * nbM) / (selfConf + nbPull);
            confS[idx]   = Math.min(1, selfConf + nbPull);
        }
    }

    return { nAz: N_AZ, nAlt: N_ALT, m: mS, conf: confS, globalRatio, totalWeight: globalSumW, visitedCells: visited };
}


//Index of the nearest sample by time. The history is hourly so a linear scan with an early break on
//the sorted times stays cheap even over a 60-day window. Returns -1 for an empty grid.
function nearestCloudIdx(times: number[], tMs: number): number
{
    if (times.length === 0) { return -1; }
    let best   = 0;
    let bestDt = Infinity;
    for (let i = 0; i < times.length; i++)
    {
        const dt = Math.abs(times[i] - tMs);
        if (dt < bestDt) { bestDt = dt; best = i; }
        else if (times[i] > tMs && dt > bestDt) { break; }
    }
    return best;
}

function clampPct(v: number): number
{
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
}

//Battery SoC (%) at an instant from the hourly mean series: the bucket whose [start, end) contains
//tMs, else the nearest by midpoint. Null when the series is empty / absent (guard then never fires).
function socAtMs(series: MeanBucket[] | null, tMs: number): number | null
{
    if (!series || series.length === 0) { return null; }
    let best = -1;
    let bestDt = Infinity;
    for (let i = 0; i < series.length; i++)
    {
        const b = series[i];
        if (tMs >= b.startMs && tMs < b.endMs) { return b.mean; }
        const dt = Math.abs((b.startMs + b.endMs) / 2 - tMs);
        if (dt < bestDt) { bestDt = dt; best = i; }
        else if (b.startMs > tMs && dt > bestDt) { break; }
    }
    return best >= 0 ? series[best].mean : null;
}


//-------------------------------------------------------------------------------------------------
//Fetch orchestration + memoised build. The two histories (production from the recorder, cloud from
//Open-Meteo) are fetched once per learning window and the residual map is rebuilt only when either
//history changes, so the heavy per-sample model evaluation runs at most once per fetch, not on every
//store rebuild.

export interface SkyForecastHost extends LoadingTrackerHost
{
    readonly hass:   any;
    readonly config: HeliosConfig | undefined;
    readonly _energyDefaults: import('./energy-prefs').EnergyDefaults;
    readonly _engine?: { getLidarRaster(): NdsmRaster | null };
    //Per-orientation Open-Meteo GTI store, shared with the forecast so the learning transposes on the
    //same anisotropic POA. Null leaves the learning on the transposition path.
    readonly _gtiStore: import('./gti').GtiStore | null;

    _skyProdSeries:   ChangeBucket[] | null;
    _skyProdFetchKey: string;
    _skyProdFetching: boolean;
    _skyCloudTimes:   number[];
    _skyCloud:        number[];
    _skyShortwave:    number[];
    _skyDirect:       number[];
    _skyDiffuse:      number[];
    _skyTemp:         number[];
    _skyWind:         number[];
    _skySnow:         number[];
    _skyCloudFetchKey: string;
    _skyCloudFetching: boolean;
    //60-day battery SoC mean series for the inverter-cutoff guard. Only fetched when the guard is armed
    //(inverter-cutoff-soc-pct set AND a battery SoC sensor is wired); null otherwise.
    _skySoc:          MeanBucket[] | null;
    _skySocFetchKey:  string;
    _skySocFetching:  boolean;
    _skyResidualMap:  SkyResidualMap | null;
    _skyMapVersion:   string;
    requestUpdate(): void;
}


//Module-level cache for the Open-Meteo cloud history, shared across every Helios card on the page so
//an N-card dashboard fetches it once. Keyed on rounded coords + day so it refreshes daily.
interface CloudHistEntry { ts: number; times: number[]; cloud: number[]; shortwave: number[]; direct: number[]; diffuse: number[]; temp: number[]; wind: number[]; snow: number[]; }
const _cloudHistCache = new Map<string, CloudHistEntry>();
const CLOUD_HIST_TTL_MS = 6 * 3_600_000;   //6 h: the past window barely changes within a session

export function clearSkyForecastCache(): void
{
    _cloudHistCache.clear();
}


//Kick the two history fetches + rebuild the map when both have landed. Cheap to call every refresh
//tick: the fetches are gated on a per-window key and the map rebuild is gated on a version hash.
export function refreshSkyForecast(host: SkyForecastHost, lat: number, lon: number): void
{
    if (!host.hass?.callWS) { return; }
    const energyIds = host._energyDefaults?.solarStatEnergyFroms ?? [];
    if (energyIds.length === 0) { return; }

    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const startMs = today0.getTime() - LEARN_DAYS * 24 * 3_600_000;
    const endMs   = Date.now();

    //Production history: hourly recorder `change` over the learning window (reset-corrected, exact).
    const sortedIds = [...energyIds].sort();
    const prodKey   = `${sortedIds.join(',')}|${startMs}`;
    if (prodKey !== host._skyProdFetchKey && !host._skyProdFetching)
    {
        host._skyProdFetchKey = prodKey;
        host._skyProdFetching = true;
        beginLoadingPhase(host, 'sky-forecast');
        void fetchChangeSeries(host.hass, sortedIds, startMs, endMs, 'hour')
            .then((series) =>
            {
                if (series !== null) { host._skyProdSeries = series; }
                host.requestUpdate();
            })
            .finally(() =>
            {
                host._skyProdFetching = false;
                endLoadingPhase(host, 'sky-forecast');
            });
    }

    //Battery SoC history for the inverter-cutoff guard. batterySocEntityForInhibit returns the SoC
    //entity only when the guard is armed (cutoff percent set AND a SoC source wired), so installs
    //without it pay nothing.
    const socEntity = batterySocEntityForInhibit(host.config, host._energyDefaults);
    if (socEntity !== null)
    {
        const socKey = `${socEntity}|${startMs}`;
        if (socKey !== host._skySocFetchKey && !host._skySocFetching)
        {
            host._skySocFetchKey = socKey;
            host._skySocFetching = true;
            void fetchMeanSeries(host.hass, [socEntity], startMs, endMs, 'hour')
                .then((series) =>
                {
                    if (series !== null) { host._skySoc = series; }
                    host.requestUpdate();
                })
                .finally(() => { host._skySocFetching = false; });
        }
    }
    else if (host._skySoc !== null)
    {
        //Guard disarmed since the last fetch: drop the stale SoC so the map stops filtering.
        host._skySoc = null;
        host._skySocFetchKey = '';
    }

    //Cloud history: one Open-Meteo GET over the learning window.
    const cloudKey = `${lat.toFixed(3)},${lon.toFixed(3)}|${LEARN_DAYS}`;
    const cachedCloud = _cloudHistCache.get(cloudKey);
    if (cachedCloud && Date.now() - cachedCloud.ts < CLOUD_HIST_TTL_MS)
    {
        if (host._skyCloudFetchKey !== cloudKey)
        {
            host._skyCloudFetchKey = cloudKey;
            host._skyCloudTimes    = cachedCloud.times;
            host._skyCloud         = cachedCloud.cloud;
            host._skyShortwave     = cachedCloud.shortwave;
            host._skyDirect        = cachedCloud.direct;
            host._skyDiffuse       = cachedCloud.diffuse;
            host._skyTemp          = cachedCloud.temp;
            host._skyWind          = cachedCloud.wind;
            host._skySnow          = cachedCloud.snow;
        }
    }
    else if (cloudKey !== host._skyCloudFetchKey && !host._skyCloudFetching)
    {
        host._skyCloudFetchKey = cloudKey;
        host._skyCloudFetching = true;
        void fetchCloudHistory(lat, lon, LEARN_DAYS)
            .then((res) =>
            {
                if (res)
                {
                    host._skyCloudTimes = res.times;
                    host._skyCloud      = res.cloud;
                    host._skyShortwave  = res.shortwave;
                    host._skyDirect     = res.direct;
                    host._skyDiffuse    = res.diffuse;
                    host._skyTemp       = res.temp;
                    host._skyWind       = res.wind;
                    host._skySnow       = res.snow;
                    _cloudHistCache.set(cloudKey, { ts: Date.now(), times: res.times, cloud: res.cloud, shortwave: res.shortwave, direct: res.direct, diffuse: res.diffuse, temp: res.temp, wind: res.wind, snow: res.snow });
                    host.requestUpdate();
                }
            })
            .finally(() => { host._skyCloudFetching = false; });
    }

    maybeRebuildSkyMap(host, lat, lon);
}


//Rebuild the residual map when the underlying histories changed. Version hash = production length +
//cloud length + day, so the daily recency shift + any fresh fetch trips a rebuild and nothing else
//does. The build itself runs ~LEARN_DAYS×24 model evaluations (a few ms), gated here so it never
//runs on a plain clock tick.
function maybeRebuildSkyMap(host: SkyForecastHost, lat: number, lon: number): void
{
    const prodLen  = host._skyProdSeries?.length ?? 0;
    const cloudLen = host._skyCloudTimes.length;
    if (prodLen === 0 || cloudLen === 0) { return; }
    const todayKey = new Date().toDateString();
    //GTI marker in the hash so a fresh per-orientation fetch landing AFTER the histories trips a rebuild
    //(the learning must re-run on the same POA the forecast now uses).
    const gtiLen   = host._gtiStore ? host._gtiStore.byKey.size : 0;
    //SoC marker so arming the cutoff guard (or its history landing) re-runs the learning with the filter.
    const socLen   = host._skySoc?.length ?? 0;
    const version  = `${todayKey}|${prodLen}|${cloudLen}|${gtiLen}|${socLen}`;
    if (version === host._skyMapVersion) { return; }
    host._skyMapVersion = version;
    host._skyResidualMap = buildSkyResidualMap({
        config:     host.config,
        lat,
        lon,
        raster:     host._engine?.getLidarRaster() ?? null,
        production: host._skyProdSeries,
        cloudTimes: host._skyCloudTimes,
        cloud:      host._skyCloud,
        shortwave:  host._skyShortwave,
        direct:     host._skyDirect,
        diffuse:    host._skyDiffuse,
        temp:       host._skyTemp,
        wind:       host._skyWind,
        snow:       host._skySnow,
        gtiStore:   host._gtiStore,
        socSeries:  host._skySoc,
        cutoffSoc:  inverterCutoffSocPct(host.config),
    });
    host.requestUpdate();
}


//Open-Meteo weather history for the learning window. One GET, single location, hourly `cloud_cover`
//+ `shortwave_radiation` over the past window. Returns parallel epoch-ms times + percent + W/m²
//arrays, or null on any failure (the caller keeps whatever it had, the map just stays cold).
async function fetchCloudHistory(lat: number, lon: number, days: number): Promise<{ times: number[]; cloud: number[]; shortwave: number[]; direct: number[]; diffuse: number[]; temp: number[]; wind: number[]; snow: number[] } | null>
{
    try
    {
        const url = 'https://api.open-meteo.com/v1/forecast'
            + `?latitude=${lat.toFixed(4)}`
            + `&longitude=${lon.toFixed(4)}`
            + '&hourly=cloud_cover,shortwave_radiation,direct_radiation,diffuse_radiation,temperature_2m,wind_speed_10m,snow_depth'
            + `&past_days=${days}&forecast_days=1&timezone=UTC`;
        const resp = await fetch(url);
        if (!resp.ok) { return null; }
        const j: any = await resp.json();
        const timeStrs: string[] = j?.hourly?.time ?? [];
        const cloudArr: number[] = j?.hourly?.cloud_cover ?? [];
        const swArr:    number[] = j?.hourly?.shortwave_radiation ?? [];
        const dirArr:   number[] = j?.hourly?.direct_radiation ?? [];
        const difArr:   number[] = j?.hourly?.diffuse_radiation ?? [];
        const tempArr:  number[] = j?.hourly?.temperature_2m ?? [];
        const windArr:  number[] = j?.hourly?.wind_speed_10m ?? [];
        const snowArr:  number[] = j?.hourly?.snow_depth ?? [];
        if (timeStrs.length === 0 || cloudArr.length === 0) { return null; }
        const times: number[] = new Array(timeStrs.length);
        for (let i = 0; i < timeStrs.length; i++)
        {
            times[i] = new Date(timeStrs[i] + 'Z').getTime();
        }
        return { times, cloud: cloudArr, shortwave: swArr, direct: dirArr, diffuse: difArr, temp: tempArr, wind: windArr, snow: snowArr };
    }
    catch (_)
    {
        return null;
    }
}
