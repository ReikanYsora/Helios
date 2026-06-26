//HA Energy dashboard preferences subscription. Helios resolves all sensors from the dashboard's global settings (no
//per-card entity slots). Subscribed once per card; HA's `energy_preferences_updated` event triggers a fresh fetch.

import { HA_DAILY_TOTALS_TTL_MS } from '../constants';


export interface EnergyDefaults
{
    //Solar live signed power sensors (`stat_rate`). Preferred over cumulative `stat_energy_from` for the live chip/chart:
    //the instantaneous read matches the HA tile to the watt and avoids trapezoidal slope artefacts on sparse inverters.
    solarStatRates:         string[];
    //Cumulative kWh meters per solar source. Drives chart backfill, forecast calibration, and `produced today`.
    solarStatEnergyFroms:   string[];
    //Grid live signed power sensors (`stat_rate`). Positive -> IMPORT chip, negative -> EXPORT, like HA's live grid tile.
    gridStatRates:          string[];
    //Grid import kWh meters (`stat_energy_from`). Drives scrub past derivation and `imported today`.
    gridStatEnergyFroms:    string[];
    gridStatEnergyTos:      string[]; //Grid export kWh meters (`stat_energy_to`).
    //Battery live power sensors (`power_config`). After `invertedRateEntities` sign flips: charge positive / discharge negative.
    batteryStatRates:       string[];
    batteryStatEnergyFroms: string[]; //Battery discharge kWh meters (`stat_energy_from`). Drives `discharged today`.
    batteryStatEnergyTos:   string[]; //Battery charge kWh meters (`stat_energy_to`). Drives `charged today`.
    //Battery state-of-charge sensors (`stat_soc`), uniform-averaged across sources (HA Energy has no per-source capacity).
    batteryStatSocs:        string[];
    //Entity ids whose raw value reads opposite to the card's canonical sign (battery: positive = charging, grid: positive =
    //import). HA's conventions: battery `stat_rate` is discharge-positive (flips), grid `stat_rate` import-positive (no flip);
    //directional from/to slots flip on the opposing side. Full mapping in `collectPowerConfigRates`; consumers flip at sample time.
    invertedRateEntities:   string[];
    //Solar-forecast provider config entry ids (`config_entry_solar_forecast`). A Helios-Forecast entry is probed via the
    //`helios_forecast/series` websocket for the richer curve, falling back to HA's generic `energy/solar_forecast`.
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


export interface EnergyPrefsHost
{
    readonly hass: any;
    _energyDefaults: EnergyDefaults;
    //True once `fetchEnergyPrefs` lands a parsed snapshot (including the empty "no energy_sources" case), so boot gating
    //stops blocking on a never-arriving prefs payload when no HA Energy dashboard is configured.
    _energyDefaultsLoaded: boolean;
    _energyPrefsUnsub?: () => void;
    requestUpdate(): void;
}


//Fetch HA Energy dashboard prefs into the host's cached snapshot. Idempotent; bails silently when hass is unattached or
//the call fails (RBAC denied, dashboard not configured).
export async function fetchEnergyPrefs(host: EnergyPrefsHost): Promise<void>
{
    if (!host.hass?.callWS)
    {
        return;
    }
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
        //Subscription stays wired; the next `energy_preferences_updated` push retries. Flip the boot gate anyway so the
        //spinner doesn't block forever on RBAC-denied or older cores lacking energy/get_prefs.
        host._energyDefaultsLoaded = true;
    }
}


//Subscribe so the snapshot stays in sync when the Energy dashboard is edited elsewhere. Falls back to a single fetch
//when the subscribe path is missing (older HA cores).
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
        //Event subscription unsupported on this core; the one-shot fetch above already populated the cache.
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


//Host shape for `refreshHaDailyTotals`. The card writes these slots when the recorder query lands; render functions
//prefer them over the local-integration values for the detail-panel headlines.
export interface HaDailyTotalsHost
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


//Module-level cache for the recorder day-totals fetch, keyed by `${localDate}|${sortedStatisticIds}` so cards on one
//dashboard share a round-trip. TTL undershoots the 30s tick so the value survives a refresh window; `inflight` dedupes
//concurrent calls. Process-scoped (cleared on reload), same lifetime as hass.connection.
type HaDailyTotalsCacheEntry =
{
    ts:        number;
    result:    number | null;
    inflight?: Promise<number | null>;
};
const _haDailyTotalsCache = new Map<string, HaDailyTotalsCacheEntry>();


//Sum the `change` field of `recorder/statistics_during_period` over today (local midnight to now) across all statistic_ids.
//Null on empty list, missing callWS, or rejection so callers fall back cleanly. Shared via `_haDailyTotalsCache`.
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
    //Date stamp in the key so the cached value doesn't outlive its window at midnight rollover.
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
                //Day period yields one bucket per statistic; `types: ['change']` is the net delta from the same Riemann sum
                //HA Energy consumes, so the result matches the dashboard tile to the watt-hour.
                period:        'day',
                types:         ['change'],
                //Normalise to kWh (installs may report Wh/MWh); chip + dashboard formatters assume kWh downstream.
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
            //Statistic missing, recorder under load, or RBAC denied: caller keeps the last good value so the chip stays readable.
            return null;
        }
    })();
    _haDailyTotalsCache.set(cacheKey, { ts: nowMs, result: null, inflight });
    const settled = await inflight;
    _haDailyTotalsCache.set(cacheKey, { ts: Date.now(), result: settled });
    return settled;
}




//Refresh the five HA Energy daily-total slots from the recorder. Fired from the card's tick loop; one WS round-trip per
//non-empty list, in parallel.
export async function refreshHaDailyTotals(host: HaDailyTotalsHost): Promise<void>
{
    const defaults = host._energyDefaults;
    let solar:      number | null = null;
    let imp:        number | null = null;
    let exp:        number | null = null;
    let charged:    number | null = null;
    let discharged: number | null = null;
    [solar, imp, exp, charged, discharged] = await Promise.all([
        fetchTodayKwhChange(host, defaults.solarStatEnergyFroms),
        fetchTodayKwhChange(host, defaults.gridStatEnergyFroms),
        fetchTodayKwhChange(host, defaults.gridStatEnergyTos),
        fetchTodayKwhChange(host, defaults.batteryStatEnergyTos),
        fetchTodayKwhChange(host, defaults.batteryStatEnergyFroms),
    ]);
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


//Parse `energy/get_prefs` into the arrays above. Each source contributes whichever meters Helios consumes; multi-source
//installs (split tariffs, separate import/export meters, multi-bank batteries) aggregate by sum at the consumer.
//
//Real-world shapes (HA core 2024+):
//  - solar:   { type: 'solar', stat_energy_from, stat_rate?, config_entry_solar_forecast? }
//  - grid:    { type: 'grid', stat_energy_from, stat_energy_to?, stat_rate?, power_config? }
//  - battery: { type: 'battery', stat_energy_from, stat_energy_to, stat_soc?, power_config? }
//
//`power_config.stat_rate` is the post-2026 grid/battery live-power slot; the top-level grid `stat_rate` is the legacy
//slot HA still serves. We read both so any encountered config maps cleanly.
export function parseEnergyPrefs(prefs: {
    energy_sources?: Array<Record<string, unknown>>;
}): EnergyDefaults
{
    //Fresh literal (not `{ ...EMPTY_ENERGY_DEFAULTS }`) so array fields aren't aliased on the shared empty default, avoiding
    //cross-call contamination when the subscription path parses while a previous parse is still settling.
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
            //Forecast provider config entries on this solar source. May be a string or a list.
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
            //A battery source may also carry a top-level `stat_rate` (HA 2026 net-power statistic). Deliberately skipped:
            //the directional pair below already nets to the same value, so reading both would double-count.
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


//Collect every live-power entity in a `power_config` block with the sign flip its slot needs for the card's canonical
//convention (battery: positive = charging, grid: positive = import). Slot semantics mirror HA's dialog copy:
//  - `stat_rate` ("Standard"): one signed net sensor. Grid positive = import (matches). Battery positive = discharge (flip).
//  - `stat_rate_inverted` ("Inverted"): mirror. Grid positive = export (flip). Battery positive = charge (no flip).
//  - `stat_rate_from`: unsigned FROM the source (battery discharge -> negative / grid import -> positive).
//  - `stat_rate_to`: unsigned TO the source (battery charge -> positive / grid export -> negative).
//A source can carry both directional slots (separate charge/discharge wattmeters, e.g. Zendure), so every populated slot
//lands in the list and the consumer sums them; reading only one would show 0W or the wrong sign.
function collectPowerConfigRates(raw: unknown, flavor: 'grid' | 'battery'): Array<{ entity: string; inverted: boolean }>
{
    if (!raw || typeof raw !== 'object')
    {
        return [];
    }
    const pc  = raw as Record<string, unknown>;
    const out: Array<{ entity: string; inverted: boolean }> = [];
    //Net slots first, and exclusive of the directional pair: a signed net sensor already carries both directions, so
    //summing it with from/to would double-count.
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
