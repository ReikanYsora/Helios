//Terrain horizon profile: the elevation angle of the surrounding relief for each azimuth, so the sun can be
//hidden behind a mountain (visual only, it never touches production or forecast). Computed on-device from
//Open-Meteo's elevation API (already a dependency, CORS-enabled, worldwide, no key): sample the ground height
//in a fan around the home, and for each azimuth take the largest angle any ridge subtends. Cached in
//localStorage keyed on the rounded home coordinates, since terrain does not change.

import { saveDurable, loadDurable } from '../durable-cache';

const R_EARTH = 6371000;
//Curvature + standard atmospheric refraction: distant terrain sits lower than a flat-earth angle would say.
const R_EFFECTIVE = (R_EARTH * 7) / 3 / 2;

//Fan resolution: azimuths every AZ_STEP, ridge samples log-spaced from DIST_MIN to DIST_MAX. 24 x 16 = 384
//points (+home) fits in four batched elevation requests, and interpolating 24 azimuths draws a smooth ridge.
const AZ_STEP = 15;
const AZ_COUNT = 360 / AZ_STEP;
const DIST_MIN = 200;
const DIST_MAX = 25000;
const DIST_RINGS = 16;
const BATCH = 100;

//Round coordinates to this many decimals for the cache key (~1 km), so small home moves reuse one profile.
const KEY_DECIMALS = 2;
const CACHE_VERSION = 1;
//Terrain is static; refresh only every few months so a home relocation eventually re-resolves.
const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

const DEG = Math.PI / 180;

//Below this peak elevation the relief is treated as flat: the sun gate and the drawn ridge both switch off, so a
//plain never gets a pointless near-zero silhouette line.
export const HORIZON_MIN_PEAK_DEG = 2;

//Fixed-step horizon: alt[i] is the terrain elevation (deg) at azimuth i*AZ_STEP, clockwise from North.
export interface HorizonProfile
{
    step: number;
    alt:  number[];
}

const _inflight = new Map<string, Promise<HorizonProfile | null>>();

//Durable sub-key with horizon's own CACHE_VERSION embedded, so a profile-shape bump orphans old entries
//independently of the shared durable schema version. durable-cache adds its prefix, TTL, skip-identical write and
//quota eviction (which the previous bespoke read/write here lacked).
function cacheKey(lat: number, lon: number): string
{
    return `horizon:v${CACHE_VERSION}:${lat.toFixed(KEY_DECIMALS)},${lon.toFixed(KEY_DECIMALS)}`;
}

//Destination point DIST metres from (lat, lon) along a compass bearing (deg from North), on a sphere.
function destination(lat: number, lon: number, bearingDeg: number, distM: number): [number, number]
{
    const d = distM / R_EARTH;
    const br = bearingDeg * DEG;
    const la = lat * DEG;
    const lo = lon * DEG;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
    const lo2 = lo + Math.atan2(
        Math.sin(br) * Math.sin(d) * Math.cos(la),
        Math.cos(d) - Math.sin(la) * Math.sin(la2)
    );
    return [la2 / DEG, lo2 / DEG];
}

//Log-spaced ridge distances: near terrain sets the low angles, far peaks (10-25 km) the high ones.
function ringDistances(): number[]
{
    const out: number[] = [];
    for (let i = 0; i < DIST_RINGS; i++)
    {
        out.push(DIST_MIN * (DIST_MAX / DIST_MIN) ** (i / (DIST_RINGS - 1)));
    }
    return out;
}

function readCache(lat: number, lon: number): HorizonProfile | null
{
    const p = loadDurable<HorizonProfile>(cacheKey(lat, lon), CACHE_TTL_MS);
    if (!p || !Array.isArray(p.alt) || typeof p.step !== 'number')
    {
        return null;
    }
    return { step: p.step, alt: p.alt.map(Number) };
}

function writeCache(lat: number, lon: number, profile: HorizonProfile): void
{
    saveDurable(cacheKey(lat, lon), profile);
}

//Batched elevation lookup: Open-Meteo takes up to BATCH coordinates per request. Null if any chunk fails.
async function fetchElevations(coords: [number, number][], signal: AbortSignal): Promise<number[] | null>
{
    const chunks: [number, number][][] = [];
    for (let i = 0; i < coords.length; i += BATCH)
    {
        chunks.push(coords.slice(i, i + BATCH));
    }

    //Sequential, not Promise.all: firing every chunk at once bursts 4-5 heavy elevation calls (100 points each)
    //at Open-Meteo in a single instant, the surest way to trip its rate limit on a cold start. One at a time
    //keeps the pressure low; the horizon is deferred off the critical path and cached for months, so the slightly
    //slower resolve costs nothing visible.
    const out: number[] = [];
    for (const chunk of chunks)
    {
        const lats = chunk.map((c) => c[0].toFixed(5)).join(',');
        const lons = chunk.map((c) => c[1].toFixed(5)).join(',');
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
        // eslint-disable-next-line no-await-in-loop -- deliberate serialization to avoid a request burst
        const res = await fetch(url, { signal });
        if (!res.ok)
        {
            return null;
        }
        // eslint-disable-next-line no-await-in-loop -- same
        const json = await res.json();
        const el = json?.elevation;
        if (!Array.isArray(el) || el.length !== chunk.length)
        {
            return null;
        }
        for (const v of el)
        {
            out.push(Number(v));
        }
    }
    return out;
}

//Resolve the terrain horizon for a home location: cache, else compute from Open-Meteo elevation. Returns null on
//any failure so the caller degrades to the flat horizon.
export function fetchHorizonProfile(lat: number, lon: number, signal: AbortSignal): Promise<HorizonProfile | null>
{
    const fLat = Number(lat.toFixed(KEY_DECIMALS));
    const fLon = Number(lon.toFixed(KEY_DECIMALS));

    const cached = readCache(fLat, fLon);
    if (cached)
    {
        return Promise.resolve(cached);
    }

    const key = cacheKey(fLat, fLon);
    const pending = _inflight.get(key);
    if (pending)
    {
        return pending;
    }

    const promise = (async (): Promise<HorizonProfile | null> =>
    {
        try
        {
            const rings = ringDistances();
            const coords: [number, number][] = [[fLat, fLon]];
            for (let a = 0; a < AZ_COUNT; a++)
            {
                const az = a * AZ_STEP;
                for (const dist of rings)
                {
                    coords.push(destination(fLat, fLon, az, dist));
                }
            }

            const elev = await fetchElevations(coords, signal);
            if (!elev)
            {
                return null;
            }

            const home = elev[0];
            const alt = new Array<number>(AZ_COUNT).fill(0);
            let idx = 1;
            for (let a = 0; a < AZ_COUNT; a++)
            {
                let best = 0;
                for (const dist of rings)
                {
                    const drop = (dist * dist) / (2 * R_EFFECTIVE);
                    const angle = Math.atan2(elev[idx] - home - drop, dist) / DEG;
                    idx++;
                    if (angle > best)
                    {
                        best = angle;
                    }
                }
                alt[a] = best;
            }

            const profile: HorizonProfile = { step: AZ_STEP, alt };
            writeCache(fLat, fLon, profile);
            return profile;
        }
        catch (_)
        {
            return null;
        }
        finally
        {
            _inflight.delete(key);
        }
    })();

    _inflight.set(key, promise);
    return promise;
}

//Terrain elevation (deg) at an arbitrary azimuth, linearly interpolated between the profile's buckets (wrapping
//at 360). 0 for an empty profile.
export function horizonAltAt(profile: HorizonProfile | null, azimuthDeg: number): number
{
    if (!profile || profile.alt.length === 0)
    {
        return 0;
    }
    const n = profile.alt.length;
    let az = azimuthDeg % 360;
    if (az < 0)
    {
        az += 360;
    }
    const f = az / profile.step;
    const i0 = Math.floor(f) % n;
    const i1 = (i0 + 1) % n;
    const frac = f - Math.floor(f);
    return profile.alt[i0] * (1 - frac) + profile.alt[i1] * frac;
}

//The tallest ridge anywhere: lets a consumer skip the whole feature on effectively flat terrain.
export function horizonPeak(profile: HorizonProfile | null): number
{
    if (!profile || profile.alt.length === 0)
    {
        return 0;
    }
    let m = 0;
    for (const v of profile.alt)
    {
        if (v > m)
        {
            m = v;
        }
    }
    return m;
}
