//Home Assistant Energy dashboard preferences subscription. Helios reads its data exclusively from the HA Energy dashboard
//global settings (Settings -> Dashboards -> Energy): no more per-card entity slots for PV, grid or battery, the card just
//resolves whatever the dashboard already declares. Subscribed once per card at connectedCallback; HA broadcasts an
//`energy_preferences_updated` event when the user edits the dashboard, the subscription pulls a fresh snapshot and the
//render cascade picks it up.

import { beginLoadingPhase, endLoadingPhase, type LoadingTrackerHost } from './loading-tracker';


export interface EnergyDefaults
{
    //Solar live signed power sensors, one per source's `stat_rate` when declared. Preferred over the cumulative
    //`stat_energy_from` for the live chip + chart because the instantaneous read matches the HA Energy tile to the watt
    //and avoids the trapezoidal slope artefacts on sparse high-frequency inverters.
    solarStatRates:         string[];
    //Cumulative kWh meters from every solar source. Drives the buffer backfill for the chart, the adaptive 5-day
    //forecast calibration, and the detail-panel `produced today` total via `recorder/statistics_during_period` change
    //aggregation.
    solarStatEnergyFroms:   string[];
    //Grid live signed power sensors, one per source's `stat_rate`. Positive splits to the IMPORT chip, negative to the
    //EXPORT chip, exactly like the HA Energy dashboard's own live grid tile.
    gridStatRates:          string[];
    //Grid import kWh meters per source (`stat_energy_from`). Backfilled via the 5-day LTS arm + 6-hour raw arm; consumed
    //by the scrub past derivation and the detail-panel `imported today` total.
    gridStatEnergyFroms:    string[];
    //Grid export kWh meters per source (`stat_energy_to`). Same backfill pattern as the import side.
    gridStatEnergyTos:      string[];
    //Battery live power sensors per source via `power_config` (any of its four slots). After the per-entity sign
    //flips from `invertedRateEntities` are applied, the summed value is charge positive / discharge negative.
    batteryStatRates:       string[];
    //Battery discharge kWh meters (`stat_energy_from`). Drives the detail-panel `discharged today` headline via the
    //recorder `change` aggregation.
    batteryStatEnergyFroms: string[];
    //Battery charge kWh meters (`stat_energy_to`). Drives the `charged today` headline the same way.
    batteryStatEnergyTos:   string[];
    //Battery state-of-charge sensors via `stat_soc`. Aggregated by uniform average across configured sources for the SoC
    //chip + vessel visualisation. Multi-bank weighting by capacity is no longer supported, HA Energy has no concept of
    //per-source capacity.
    batteryStatSocs:        string[];
    //Entity ids whose raw value reads opposite to the card's canonical sign (battery: positive = charging, grid:
    //positive = import). Which `power_config` slot lands here is flavor-dependent because HA's own conventions are:
    //battery `stat_rate` is discharge-positive (flips) while grid `stat_rate` is import-positive (no flip), and the
    //directional from/to slots flip on the side whose direction opposes the canonical sign. The full mapping lives
    //in `collectPowerConfigRates`. Consumers (refreshBattery, refreshGrid, battery history aggregation) flip the
    //sign at sample time so the downstream chips / leaders / scrub buffers see the canonical convention.
    invertedRateEntities:   string[];
    //Config entry ids the user selected as solar-forecast providers on the Energy dashboard's solar sources
    //(`config_entry_solar_forecast`). One of these may be a Helios-Forecast entry; the forecast reader probes them with
    //the `helios_forecast/series` websocket to pull the richer detail curve, and falls back to HA's generic
    //`energy/solar_forecast` otherwise.
    solarForecastEntryIds:  string[];
}


export const EMPTY_ENERGY_DEFAULTS: EnergyDefaults =
{
    solarStatRates:         [],
    solarStatEnergyFroms:   [],
    gridStatRates:          [],
    gridStatEnergyFroms:    [],
    gridStatEnergyTos:      [],
    batteryStatRates:       [],
    batteryStatEnergyFroms: [],
    batteryStatEnergyTos:   [],
    batteryStatSocs:        [],
    invertedRateEntities:   [],
    solarForecastEntryIds:  [],
};


export interface EnergyPrefsHost extends LoadingTrackerHost
{
    readonly hass: any;
    _energyDefaults: EnergyDefaults;
    //Flips true the first time `fetchEnergyPrefs` lands a parsed snapshot, including the "no energy_sources at all"
    //case where the parsed defaults are empty arrays. Boot-time gating reads this so an install that genuinely has
    //no HA Energy dashboard configured stops blocking on a never-arriving prefs payload.
    _energyDefaultsLoaded: boolean;
    _energyPrefsUnsub?: () => void;
    requestUpdate(): void;
}


//Find the co2signal / Electricity Maps "grid fossil-fuel percentage" sensor in the entity registry, mirroring HA's own
//Energy dashboard: the integration's percentage sensor is the fossil-fuel share Helios derives the low-carbon split
//from. Returns null when the integration is not present, which is the gate for hiding the low-carbon chip.
export function findCo2SignalEntity(hass: any): string | null
{
    const entities = hass?.entities;
    if (!entities || typeof entities !== 'object')
    {
        return null;
    }
    for (const ent of Object.values(entities) as Array<{ entity_id?: string; platform?: string }>)
    {
        if (!ent || (ent.platform !== 'co2signal' && ent.platform !== 'electricity_maps'))
        {
            continue;
        }
        const id = ent.entity_id;
        if (!id)
        {
            continue;
        }
        //The integration exposes a g/kWh CO2-intensity sensor AND a % fossil-fuel sensor; the percentage one is the
        //fossil share we want.
        if (hass.states?.[id]?.attributes?.unit_of_measurement === '%')
        {
            return id;
        }
    }
    return null;
}


//Fetch the HA Energy dashboard preferences and update the host's cached snapshot. Safe to call multiple times; bails out
//silently when hass is not yet attached or the call fails (RBAC denied, dashboard not configured, etc.).
export async function fetchEnergyPrefs(host: EnergyPrefsHost): Promise<void>
{
    if (!host.hass?.callWS)
    {
        return;
    }
    beginLoadingPhase(host, 'energy-prefs');
    try
    {
        const prefs = await host.hass.callWS({ type: 'energy/get_prefs' }) as {
            energy_sources?: Array<Record<string, unknown>>;
        };
        const next = parseEnergyPrefs(prefs);
        host._energyDefaults       = next;
        host._energyDefaultsLoaded = true;
        host.requestUpdate();
    }
    catch (_)
    {
        //Subscription stays wired; a transient WS error or a not-yet-configured dashboard collapses the chips silently
        //and the next push from `energy_preferences_updated` will retry. The boot gate still flips so the spinner
        //does not block indefinitely on RBAC-denied or older HA cores that do not expose energy/get_prefs.
        host._energyDefaultsLoaded = true;
    }
    finally
    {
        endLoadingPhase(host, 'energy-prefs');
    }
}


//Open a long-running subscription so the snapshot stays in sync when the user edits the Energy dashboard from another
//tab. Falls back to a single fetch when the subscribe path is missing (older HA cores).
export function subscribeEnergyPrefs(host: EnergyPrefsHost): void
{
    if (!host.hass?.connection || host._energyPrefsUnsub)
    {
        return;
    }
    fetchEnergyPrefs(host);
    try
    {
        host._energyPrefsUnsub = host.hass.connection.subscribeEvents(
            () => fetchEnergyPrefs(host),
            'energy_preferences_updated',
        );
    }
    catch (_)
    {
        //Event subscription not supported on this HA core; the one-shot fetch above already populated the cache.
    }
}


export function unsubscribeEnergyPrefs(host: EnergyPrefsHost): void
{
    if (host._energyPrefsUnsub)
    {
        try
        {
            host._energyPrefsUnsub();
        }
        catch (_)
        {
        }
        host._energyPrefsUnsub = undefined;
    }
}


//Host shape consumed by `refreshHaDailyTotals`. The card writes the four slots when the recorder query lands; downstream
//render functions prefer these over the local-integration values for the detail-panel headline figures.
export interface HaDailyTotalsHost extends LoadingTrackerHost
{
    readonly hass: any;
    readonly _energyDefaults: EnergyDefaults;
    _haSolarTodayKwh:          number | null;
    _haGridImportTodayKwh:     number | null;
    _haGridExportTodayKwh:     number | null;
    _haBatteryChargedKwh:      number | null;
    _haBatteryDischargedKwh:   number | null;
    requestUpdate(): void;
}


//Module-level cache for the recorder day-totals fetch. Keyed by `${localDateIso}|${sortedStatisticIds}` so two cards
//on the same dashboard share a single WS round-trip per refresh window. The TTL undershoots the card's 30 s tick so
//the cached value survives the entire interval between refreshes; inflight requests are deduped via the `inflight`
//slot so concurrent cards never race two parallel calls. The cache is process-scoped (cleared on page reload), which
//is the same lifetime as the hass.connection.
type HaDailyTotalsCacheEntry =
{
    ts:        number;
    result:    number | null;
    inflight?: Promise<number | null>;
};
const HA_DAILY_TOTALS_TTL_MS = 25_000;
const _haDailyTotalsCache = new Map<string, HaDailyTotalsCacheEntry>();


//Recorder query helper. Sums the `change` field of `recorder/statistics_during_period` over today (local midnight to now)
//across every statistic_id in the list. Returns null when the list is empty, when no `hass.callWS` is available, or when
//the call rejects, so callers fall back cleanly. Shared across cards via `_haDailyTotalsCache` so an N-card dashboard
//hits the recorder once instead of N times per refresh window.
async function fetchTodayKwhChange(host: HaDailyTotalsHost, statisticIds: string[]): Promise<number | null>
{
    if (statisticIds.length === 0)
    {
        return null;
    }
    if (!host.hass?.callWS)
    {
        return null;
    }
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const now = new Date();
    //Date stamp embedded in the key so the cached value doesn't outlive its window at midnight rollover.
    const cacheKey = `${midnight.getFullYear()}-${midnight.getMonth()}-${midnight.getDate()}|${[...statisticIds].sort().join('|')}`;
    const nowMs    = now.getTime();
    const cached   = _haDailyTotalsCache.get(cacheKey);
    if (cached)
    {
        if (cached.inflight)
        {
            return cached.inflight;
        }
        if (nowMs - cached.ts < HA_DAILY_TOTALS_TTL_MS)
        {
            return cached.result;
        }
    }
    const inflight: Promise<number | null> = (async () =>
    {
        try
        {
            const result = await host.hass.callWS({
                type:          'recorder/statistics_during_period',
                start_time:    midnight.toISOString(),
                end_time:      now.toISOString(),
                statistic_ids: statisticIds,
                //Day-period query returns at most one bucket per statistic covering today's window. `types: ['change']`
                //returns the net delta the recorder computed across the bucket using the same Riemann sum HA Energy itself
                //consumes, so the result matches the dashboard tile to the watt-hour.
                period:        'day',
                types:         ['change'],
                //Normalise to kWh so installs reporting in Wh / MWh land on the same scale as the HA Energy headline tile;
                //the chip + dashboard formatters assume kWh downstream.
                units:         { energy: 'kWh' },
            }) as Record<string, Array<{ change?: number | null }>>;
            let total  = 0;
            let anyHit = false;
            for (const id of statisticIds)
            {
                const buckets = result?.[id];
                if (!Array.isArray(buckets))
                {
                    continue;
                }
                for (const bucket of buckets)
                {
                    const v = typeof bucket?.change === 'number' ? bucket.change : null;
                    if (v === null)
                    {
                        continue;
                    }
                    total += v;
                    anyHit = true;
                }
            }
            return anyHit ? total : null;
        }
        catch (_)
        {
            //Statistic missing, recorder under load or RBAC denied. The caller leaves the previous value untouched, the
            //chip stays readable on the last good snapshot until the next refresh succeeds.
            return null;
        }
    })();
    _haDailyTotalsCache.set(cacheKey, { ts: nowMs, result: null, inflight });
    const settled = await inflight;
    _haDailyTotalsCache.set(cacheKey, { ts: Date.now(), result: settled });
    return settled;
}


//Fetch the kWh `change` total for the given statistic ids over an arbitrary [startMs, endMs] window. Same
//recorder query as `fetchTodayKwhChange` but parameterised on the range so callers can ask for past days
//(or future days, which always return 0). Cached per (window | statIds) so a multi-card dashboard hits the
//recorder once instead of N times.
export async function fetchKwhChangeForRange(
    host:         HaDailyTotalsHost,
    statisticIds: string[],
    startMs:      number,
    endMs:        number,
): Promise<number | null>
{
    if (statisticIds.length === 0) return null;
    if (!host.hass?.callWS)         return null;
    if (endMs <= startMs)           return null;
    const cacheKey = `${startMs}|${endMs}|${[...statisticIds].sort().join('|')}`;
    const nowMs    = Date.now();
    const cached   = _haDailyTotalsCache.get(cacheKey);
    if (cached)
    {
        if (cached.inflight)
        {
            return cached.inflight;
        }
        if (nowMs - cached.ts < HA_DAILY_TOTALS_TTL_MS)
        {
            return cached.result;
        }
    }
    const inflight: Promise<number | null> = (async () =>
    {
        try
        {
            const result = await host.hass.callWS({
                type:          'recorder/statistics_during_period',
                start_time:    new Date(startMs).toISOString(),
                end_time:      new Date(endMs).toISOString(),
                statistic_ids: statisticIds,
                period:        'day',
                types:         ['change'],
                units:         { energy: 'kWh' },
            }) as Record<string, Array<{ change?: number | null }>>;
            let total  = 0;
            let anyHit = false;
            for (const id of statisticIds)
            {
                const buckets = result?.[id];
                if (!Array.isArray(buckets)) continue;
                for (const bucket of buckets)
                {
                    const v = typeof bucket?.change === 'number' ? bucket.change : null;
                    if (v === null) continue;
                    total += v;
                    anyHit = true;
                }
            }
            return anyHit ? total : null;
        }
        catch (_)
        {
            return null;
        }
    })();
    _haDailyTotalsCache.set(cacheKey, { ts: nowMs, result: null, inflight });
    const settled = await inflight;
    _haDailyTotalsCache.set(cacheKey, { ts: Date.now(), result: settled });
    return settled;
}


//Refresh the five HA Energy daily-total slots from the recorder. Fired periodically from the card's tick loop; cheap to
//call (one WS round-trip per non-empty list, fired in parallel).
export async function refreshHaDailyTotals(host: HaDailyTotalsHost): Promise<void>
{
    beginLoadingPhase(host, 'ha-daily-totals');
    const defaults = host._energyDefaults;
    let solar:      number | null = null;
    let imp:        number | null = null;
    let exp:        number | null = null;
    let charged:    number | null = null;
    let discharged: number | null = null;
    try
    {
        [solar, imp, exp, charged, discharged] = await Promise.all([
            fetchTodayKwhChange(host, defaults.solarStatEnergyFroms),
            fetchTodayKwhChange(host, defaults.gridStatEnergyFroms),
            fetchTodayKwhChange(host, defaults.gridStatEnergyTos),
            fetchTodayKwhChange(host, defaults.batteryStatEnergyTos),
            fetchTodayKwhChange(host, defaults.batteryStatEnergyFroms),
        ]);
    }
    finally
    {
        endLoadingPhase(host, 'ha-daily-totals');
    }
    let changed = false;
    if (solar !== null && solar !== host._haSolarTodayKwh)
    {
        host._haSolarTodayKwh = solar;
        changed = true;
    }
    if (imp !== null && imp !== host._haGridImportTodayKwh)
    {
        host._haGridImportTodayKwh = imp;
        changed = true;
    }
    if (exp !== null && exp !== host._haGridExportTodayKwh)
    {
        host._haGridExportTodayKwh = exp;
        changed = true;
    }
    if (charged !== null && charged !== host._haBatteryChargedKwh)
    {
        host._haBatteryChargedKwh = charged;
        changed = true;
    }
    if (discharged !== null && discharged !== host._haBatteryDischargedKwh)
    {
        host._haBatteryDischargedKwh = discharged;
        changed = true;
    }
    if (changed)
    {
        host.requestUpdate();
    }
}


//Parse `energy/get_prefs` payload into the nine arrays above. Each Energy source contributes whichever of its declared
//meters Helios consumes; multi-source installs (split tariffs, separate import / export meters, multi-bank batteries)
//all aggregate by simple sum across the arrays at the consumer.
//
//Real-world shapes (HA core 2024+):
//  - solar:   { type: 'solar', stat_energy_from, stat_rate?, config_entry_solar_forecast? }
//  - grid:    { type: 'grid', stat_energy_from, stat_energy_to?, stat_rate?, power_config? }
//  - battery: { type: 'battery', stat_energy_from, stat_energy_to, stat_soc?, power_config? }
//
//`power_config.stat_rate` is the post-2026 grid + battery live-power slot . The top-level
//`stat_rate` on grid sources is the legacy slot still served by the official sankey card today; we read both so any
//Energy dashboard config Helios encounters maps cleanly into our model.
export function parseEnergyPrefs(prefs: {
    energy_sources?: Array<Record<string, unknown>>;
}): EnergyDefaults
{
    //Fresh literal rather than `{ ...EMPTY_ENERGY_DEFAULTS }` so the array fields are not aliased on the shared empty
    //default, avoiding cross-call contamination when multiple parses run in the same lifecycle (the subscription path
    //can trigger a parse while a previous one is still settling).
    const out: EnergyDefaults =
    {
        solarStatRates:         [],
        solarStatEnergyFroms:   [],
        gridStatRates:          [],
        gridStatEnergyFroms:    [],
        gridStatEnergyTos:      [],
        batteryStatRates:       [],
        batteryStatEnergyFroms: [],
        batteryStatEnergyTos:   [],
        batteryStatSocs:        [],
        invertedRateEntities:   [],
        solarForecastEntryIds:  [],
    };
    const sources = Array.isArray(prefs?.energy_sources) ? prefs!.energy_sources! : [];

    for (const src of sources)
    {
        if (!src || typeof src !== 'object')
        {
            continue;
        }
        const type = String(src['type'] ?? '').toLowerCase();

        if (type === 'solar')
        {
            const meter = pickFirstString(src['stat_energy_from']);
            if (meter)
            {
                out.solarStatEnergyFroms.push(meter);
            }
            const rate = pickFirstString(src['stat_rate']);
            if (rate)
            {
                out.solarStatRates.push(rate);
            }
            //Forecast provider config entries the user attached to this solar source. May be a string or a list.
            const fc = src['config_entry_solar_forecast'];
            if (Array.isArray(fc))
            {
                for (const id of fc)
                {
                    if (typeof id === 'string' && id.trim() !== '' && !out.solarForecastEntryIds.includes(id.trim()))
                    {
                        out.solarForecastEntryIds.push(id.trim());
                    }
                }
            }
            else if (typeof fc === 'string' && fc.trim() !== '' && !out.solarForecastEntryIds.includes(fc.trim()))
            {
                out.solarForecastEntryIds.push(fc.trim());
            }
        }
        else if (type === 'grid')
        {
            const imp = pickFirstString(src['stat_energy_from']);
            if (imp)
            {
                out.gridStatEnergyFroms.push(imp);
            }
            const exp = pickFirstString(src['stat_energy_to']);
            if (exp)
            {
                out.gridStatEnergyTos.push(exp);
            }
            const directRate = pickFirstString(src['stat_rate']);
            if (directRate)
            {
                out.gridStatRates.push(directRate);
            }
            else
            {
                for (const slot of collectPowerConfigRates(src['power_config'], 'grid'))
                {
                    out.gridStatRates.push(slot.entity);
                    if (slot.inverted)
                    {
                        out.invertedRateEntities.push(slot.entity);
                    }
                }
            }
        }
        else if (type === 'battery')
        {
            const discharge = pickFirstString(src['stat_energy_from']);
            if (discharge)
            {
                out.batteryStatEnergyFroms.push(discharge);
            }
            const charge = pickFirstString(src['stat_energy_to']);
            if (charge)
            {
                out.batteryStatEnergyTos.push(charge);
            }
            const soc = pickFirstString(src['stat_soc']);
            if (soc)
            {
                out.batteryStatSocs.push(soc);
            }
            //NOTE: a battery source can ALSO carry a top-level `stat_rate` (HA 2026 materialises a combined
            //"net power" statistic for its power-flow view when both directional slots are wired). It is
            //deliberately not read here: the directional pair below already nets to the same value, and
            //summing both would double-count.
            for (const slot of collectPowerConfigRates(src['power_config'], 'battery'))
            {
                out.batteryStatRates.push(slot.entity);
                if (slot.inverted)
                {
                    out.invertedRateEntities.push(slot.entity);
                }
            }
        }
    }
    return out;
}


//Collect every live-power entity wired in a `power_config` block, each with the sign flip its slot needs to land on
//the card's canonical convention (battery: positive = charging, grid: positive = import).
//
//The slot semantics mirror HA's energy-meter naming, "from the source" / "to the source". The sign of the single-
//sensor slots is FLAVOR-DEPENDENT, per HA's own dialog copy (frontend en.json, battery/grid dialog):
//  - `stat_rate` ("Standard"): ONE signed net sensor in HA's canonical sign. Grid: positive = importing, which
//    matches the card. Battery: positive = DISCHARGING, the opposite of the card's charge-positive convention,
//    so the battery flavor flips it.
//  - `stat_rate_inverted` ("Inverted"): the mirror of Standard. Grid: positive = exporting (flip). Battery:
//    positive = charging, already the card's convention (no flip).
//  - `stat_rate_from`: unsigned power flowing FROM the source, i.e. battery discharge / grid import. Canonical sign:
//    negative for battery (discharging), positive for grid (importing).
//  - `stat_rate_to`: unsigned power flowing TO the source, i.e. battery charge / grid export. Canonical sign:
//    positive for battery (charging), negative for grid (exporting).
//
//A source can carry BOTH directional slots at once (separate charge + discharge wattmeters, e.g. a Zendure exposes
//import and export power as two entities). Reading only one of the pair, which is what this helper did before, shows
//0 W whenever the other direction is active and the wrong sign the rest of the time, so every populated slot lands
//in the list and the consumer sums them.
function collectPowerConfigRates(raw: unknown, flavor: 'grid' | 'battery'): Array<{ entity: string; inverted: boolean }>
{
    if (!raw || typeof raw !== 'object')
    {
        return [];
    }
    const pc  = raw as Record<string, unknown>;
    const out: Array<{ entity: string; inverted: boolean }> = [];
    //Net slots first, and EXCLUSIVE of the directional pair: a signed net sensor already carries
    //both directions, so summing it together with from/to would double-count. Matches the strict
    //priority the previous single-slot resolver had.
    const direct = pickFirstString(pc['stat_rate']);
    if (direct)
    {
        out.push({ entity: direct, inverted: flavor === 'battery' });
    }
    const flipped = pickFirstString(pc['stat_rate_inverted']);
    if (flipped)
    {
        out.push({ entity: flipped, inverted: flavor === 'grid' });
    }
    if (out.length > 0)
    {
        return out;
    }
    const fromEntity = pickFirstString(pc['stat_rate_from']);
    if (fromEntity)
    {
        out.push({ entity: fromEntity, inverted: flavor === 'battery' });
    }
    const toEntity = pickFirstString(pc['stat_rate_to']);
    if (toEntity)
    {
        out.push({ entity: toEntity, inverted: flavor === 'grid' });
    }
    return out;
}


function pickFirstString(v: unknown): string | null
{
    if (typeof v === 'string' && v.trim() !== '')
    {
        return v.trim();
    }
    if (Array.isArray(v))
    {
        for (const item of v)
        {
            if (typeof item === 'string' && item.trim() !== '')
            {
                return item.trim();
            }
        }
    }
    return null;
}
