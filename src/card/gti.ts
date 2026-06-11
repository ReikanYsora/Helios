//Global tilted irradiance (GTI) from Open-Meteo, one series per configured array orientation.
//
//Our own transposition (Liu-Jordan in engine/sun.ts) treats the diffuse sky as ISOTROPIC: every patch
//of sky contributes equally. The real sky is anisotropic, brighter in a halo around the sun
//(circumsolar) and along the horizon band, which a tilted panel sees differently depending on where it
//aims. Open-Meteo computes the plane-of-array irradiance with an anisotropic (Perez-family) model for
//a given tilt + azimuth, so pulling its `global_tilted_irradiance` gives a better POA base than our
//isotropic transposition, especially on a panel aimed away from due-equator.
//
//The catch: Open-Meteo accepts ONE tilt + azimuth per request, so a multi-orientation install needs
//one GET per distinct orientation. We fetch them in parallel, keyed by the orientation, over the same
//[J-60, J+2] window the forecast (J-2..J+2) and the 60-day sky-residual learning both read, so a
//single fetch per orientation serves both consumers and the learned residual stays consistent with the
//forecast it corrects.
//
//Azimuth convention: Open-Meteo uses 0 = south, -90 = east, +90 = west, +/-180 = north. Helios stores
//azimuth as 0 = north, 90 = east, 180 = south, 270 = west, so the conversion is omAz = ourAz - 180.

import type { HeliosConfig } from '../helios-config';
import { pvArrays } from './pv';


//Same window as the sky-residual learning so one fetch feeds both the forecast and the learning pass.
//Open-Meteo counts today inside forecast_days, so 3 yields today + 2 future days.
const GTI_PAST_DAYS     = 60;
const GTI_FORECAST_DAYS = 3;

//Orientation binning. Round tilt + azimuth to whole degrees so two arrays that differ only by editor
//rounding noise share one fetch, and the request count tracks distinct physical orientations.
const TILT_BIN_DEG = 1;
const AZ_BIN_DEG   = 1;


export interface GtiSeries
{
    //Epoch-ms timestamps (UTC) and the plane-of-array irradiance in W/m² at each, hourly.
    times: number[];
    poa:   number[];
}

export interface GtiStore
{
    //Keyed by orientationKey(tilt, azimuth) in Helios' own azimuth convention.
    byKey: Map<string, GtiSeries>;
}


//Stable key for an orientation, in Helios' azimuth convention (0 = north). Rounded so editor noise
//collapses to one bin.
export function orientationKey(tiltDeg: number, azimuthDeg: number): string
{
    const t = Math.round(tiltDeg / TILT_BIN_DEG) * TILT_BIN_DEG;
    const a = Math.round((((azimuthDeg % 360) + 360) % 360) / AZ_BIN_DEG) * AZ_BIN_DEG;
    return `${t}|${a}`;
}


//GTI lookup for one orientation at a given time, linearly interpolated between the two bracketing
//hourly samples so a sub-hourly forecast bucket reads a smooth POA instead of an hourly stair-step.
//Returns undefined when the store has no series for this orientation, it carries no data, or both
//bracketing samples are invalid, so the caller falls back to our own transposition cleanly.
export function sampleGti(store: GtiStore | null, tiltDeg: number, azimuthDeg: number, tMs: number): number | undefined
{
    if (!store) { return undefined; }
    const s = store.byKey.get(orientationKey(tiltDeg, azimuthDeg));
    if (!s || s.times.length === 0) { return undefined; }

    //Bracket tMs: i1 = first sample at or after tMs, i0 its predecessor.
    let i1 = s.times.length - 1;
    for (let i = 0; i < s.times.length; i++)
    {
        if (s.times[i] >= tMs) { i1 = i; break; }
    }
    const i0 = Math.max(0, i1 - 1);
    const v0 = s.poa[i0];
    const v1 = s.poa[i1];
    const b0 = !(typeof v0 === 'number' && isFinite(v0) && v0 >= 0);
    const b1 = !(typeof v1 === 'number' && isFinite(v1) && v1 >= 0);
    if (b0 && b1) { return undefined; }
    if (b0) { return v1; }
    if (b1) { return v0; }
    const t0 = s.times[i0];
    const t1 = s.times[i1];
    if (t1 <= t0) { return v1; }
    const f = Math.max(0, Math.min(1, (tMs - t0) / (t1 - t0)));
    return v0 + (v1 - v0) * f;
}


//Host surface. Mirrors the forecast-sky host shape so the card carries one GTI store + the usual
//fetch-key / in-flight guard. GTI is a background forecast refinement: the card renders on the
//transposition fallback until it lands, so it deliberately does NOT register a loading phase.
export interface GtiHost
{
    readonly config: HeliosConfig | undefined;
    readonly hass:   any;
    _gtiStore:      GtiStore | null;
    _gtiFetchKey:   string;
    _gtiFetching:   boolean;
    requestUpdate(): void;
}


//Module-level cache, shared across every Helios card on the page so an N-card dashboard fetches each
//orientation once. Keyed on rounded coords + orientation + day so it refreshes daily.
interface GtiCacheEntry { ts: number; series: GtiSeries; }
const _gtiCache = new Map<string, GtiCacheEntry>();
const GTI_TTL_MS = 6 * 3_600_000;   //6 h: the radiation window barely moves within a session

export function clearGtiCache(): void
{
    _gtiCache.clear();
}


//Distinct orientations for the configured arrays, in Helios convention. Empty when no array is
//declared (the forecast then takes the horizontal fast path and needs no GTI).
function distinctOrientations(config: HeliosConfig | undefined, lat: number): Array<{ key: string; tilt: number; az: number }>
{
    const { orientations } = pvArrays(config, lat);
    const seen = new Map<string, { key: string; tilt: number; az: number }>();
    for (const o of orientations)
    {
        //Sun-tracking arrays have no fixed plane, so a single tilt/azimuth GTI request can't represent
        //them. Leave them on our own tracker-aware transposition.
        if (o.tracker) { continue; }
        const key = orientationKey(o.tiltDeg, o.azimuthDeg);
        if (!seen.has(key)) { seen.set(key, { key, tilt: o.tiltDeg, az: o.azimuthDeg }); }
    }
    return [...seen.values()];
}


//Fetch one orientation's GTI history. Open-Meteo's best_match model (no &models) keeps the GTI on the
//same model basis as the sky-residual cloud / shortwave history, which also omits &models, so the
//forecast and the learning share one radiation source. Returns null on any failure.
async function fetchGtiForOrientation(lat: number, lon: number, tiltDeg: number, azimuthDeg: number): Promise<GtiSeries | null>
{
    try
    {
        //Helios azimuth (0 = north) -> Open-Meteo azimuth (0 = south).
        const omAz = azimuthDeg - 180;
        const url = 'https://api.open-meteo.com/v1/forecast'
            + `?latitude=${lat.toFixed(4)}`
            + `&longitude=${lon.toFixed(4)}`
            + '&hourly=global_tilted_irradiance_instant'
            + `&tilt=${Math.round(tiltDeg)}`
            + `&azimuth=${Math.round(omAz)}`
            + `&past_days=${GTI_PAST_DAYS}&forecast_days=${GTI_FORECAST_DAYS}&timezone=UTC`;
        const resp = await fetch(url);
        if (!resp.ok) { return null; }
        const j: any = await resp.json();
        const timeStrs: string[] = j?.hourly?.time ?? [];
        const poaArr:   number[] = j?.hourly?.global_tilted_irradiance_instant ?? [];
        if (timeStrs.length === 0 || poaArr.length === 0) { return null; }
        const times: number[] = new Array(timeStrs.length);
        for (let i = 0; i < timeStrs.length; i++)
        {
            times[i] = new Date(timeStrs[i] + 'Z').getTime();
        }
        return { times, poa: poaArr };
    }
    catch (_)
    {
        return null;
    }
}


//Kick the per-orientation GTI fetches when the configured orientation set changes (or the day rolls
//over). Cheap to call every refresh tick: gated on a key built from the orientation set + day, and the
//module cache absorbs repeat requests across cards. Stores the merged result on the host the moment
//every orientation has resolved.
export function refreshTiltedIrradiance(host: GtiHost, lat: number, lon: number): void
{
    const orients = distinctOrientations(host.config, lat);
    if (orients.length === 0)
    {
        //No fixed-orientation array: nothing to fetch, drop any stale store so the forecast reverts to
        //the horizontal / transposition path cleanly.
        host._gtiStore    = null;
        host._gtiFetchKey = '';
        return;
    }

    const dayKey   = new Date().toDateString();
    const fetchKey = `${lat.toFixed(3)},${lon.toFixed(3)}|${dayKey}|${orients.map(o => o.key).sort().join('+')}`;
    if (fetchKey === host._gtiFetchKey || host._gtiFetching) { return; }
    host._gtiFetchKey = fetchKey;
    host._gtiFetching = true;

    //One GET per orientation, in parallel. A cache hit resolves without a network round-trip.
    const jobs = orients.map(async (o) =>
    {
        const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}|${o.key}`;
        const cached = _gtiCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < GTI_TTL_MS)
        {
            return { key: o.key, series: cached.series };
        }
        const series = await fetchGtiForOrientation(lat, lon, o.tilt, o.az);
        if (series) { _gtiCache.set(cacheKey, { ts: Date.now(), series }); }
        return { key: o.key, series };
    });

    void Promise.all(jobs)
        .then((results) =>
        {
            const byKey = new Map<string, GtiSeries>();
            for (const r of results)
            {
                if (r.series) { byKey.set(r.key, r.series); }
            }
            //Only publish a store when at least one orientation resolved, otherwise keep the forecast on
            //the transposition path rather than handing it an empty store.
            host._gtiStore = byKey.size > 0 ? { byKey } : null;
            host.requestUpdate();
        })
        .finally(() =>
        {
            host._gtiFetching = false;
        });
}
