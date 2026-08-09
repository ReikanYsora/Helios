//HA Energy dashboard preferences subscription. All sensors resolve from the dashboard's global settings (no per-card
//entity slots). Subscribed once per card; HA's `energy_preferences_updated` event triggers a fresh fetch.

import { HA_DAILY_TOTALS_TTL_MS, DAY_MS } from '../../core/config/constants';
import { callWS } from '../ha-gateway';
import { RequestCache } from '../request-cache';
import { loadDurable, saveDurable } from '../durable-cache';


export interface EnergyDefaults
{
    //Solar live signed power sensors (`stat_rate`). Preferred over cumulative `stat_energy_from` for the live
    //chip/chart: the instantaneous read matches the HA tile to the watt and avoids trapezoidal slope artefacts on
    //sparse inverters.
    solarStatRates:         string[];
    //Cumulative kWh meters per solar source. Drives chart backfill, forecast calibration, and `produced today`.
    solarStatEnergyFroms:   string[];
    //Grid live signed power sensors (`stat_rate`). Positive -> IMPORT chip, negative -> EXPORT, like HA's live grid tile.
    gridStatRates:          string[];
    //Grid import kWh meters (`stat_energy_from`). Drives scrub past derivation and `imported today`.
    gridStatEnergyFroms:    string[];
    gridStatEnergyTos:      string[]; //Grid export kWh meters (`stat_energy_to`).
    //Cost tracking (all optional; empty unless the user configured cost in the Energy dashboard). Import side lives
    //on flow_from, export/compensation on flow_to. Live price = a €/kWh entity (`entity_energy_price`) or a static
    //number (`number_energy_price`); the cumulative money statistics are `stat_cost` (import) / `stat_compensation`
    //(export). The cost chip stays hidden when all of these are empty.
    gridImportPrices:       string[]; //Live import price entities (€/kWh), current value read live.
    gridImportPriceNumbers: number[]; //Static import prices (€/kWh) for flows configured with a fixed price.
    gridExportPrices:       string[]; //Live export/compensation price entities (€/kWh).
    gridExportPriceNumbers: number[]; //Static export prices (€/kWh).
    gridStatCosts:          string[]; //Cumulative import-cost statistics (`stat_cost`), for the durable curve/panel.
    gridStatCompensations:  string[]; //Cumulative export-revenue statistics (`stat_compensation`).
    //Battery live power sensors (`power_config`). After `invertedRateEntities` sign flips: charge positive / discharge negative.
    batteryStatRates:       string[];
    batteryStatEnergyFroms: string[]; //Battery discharge kWh meters (`stat_energy_from`). Drives `discharged today`.
    batteryStatEnergyTos:   string[]; //Battery charge kWh meters (`stat_energy_to`). Drives `charged today`.
    //Battery state-of-charge sensors (`stat_soc`), uniform-averaged across sources (HA Energy has no per-source capacity).
    batteryStatSocs:        string[];
    //Count of battery SOURCES that expose no live-power sensor (`power_config`). >0 means a mixed/energy-only wiring:
    //the live readout must then net the directional energy meters (which cover every bank) instead of summing the
    //partial set of power sensors, otherwise a battery without a power sensor drops out of the live power.
    batterySourcesWithoutRate: number;
    //Entity ids whose raw value reads opposite to the card's canonical sign (battery: positive = charging, grid:
    //positive = import). HA's conventions: battery `stat_rate` is discharge-positive (flips), grid `stat_rate`
    //import-positive (no flip); directional from/to slots flip on the opposing side. Full mapping in
    //`collectPowerConfigRates`; consumers flip at sample time.
    invertedRateEntities:   string[];
    //Solar-forecast provider config entry ids (`config_entry_solar_forecast`). Each is probed via the
    //`helios_forecast/series` websocket for the richer curve, falling back to HA's generic `energy/solar_forecast`.
    solarForecastEntryIds:  string[];
    //User-given source names from the dashboard settings (first named source per family, '' when none):
    //displayed instead of the entities' friendly names wherever the family is titled.
    gridName:               string;
    batteryName:            string;
    //Individual devices from the dashboard's per-device tracking (`device_consumption`), in dashboard order. NOT part
    //of the source flows above (they are sub-measurements of the home load), kept separately for the monitoring
    //groups so summing them never touches the solar/grid/battery identity.
    devices:                DeviceConsumption[];
}


//One individual device tracked by the Energy dashboard.
export interface DeviceConsumption
{
    //Cumulative kWh meter (`stat_consumption`), on the same change-series path as the source meters.
    statConsumption: string;
    //Live power sensor (`stat_rate`), '' when the device exposes none.
    statRate:        string;
    //User-given dashboard name, '' when unset (the consumer falls back to the entity's friendly name).
    name:            string;
    //Parent stat this device is nested under (`included_in_stat`), '' when standalone. Parsed and reserved for a
    //future parent-subtraction pass (so a compound device isn't double-counted); no consumer reads it yet.
    includedInStat:  string;
    //Position in the dashboard's device list. HA colours its devices graph by this index
    //(`--graph-color-{index+1}`, else `--color-{(index % 54)+1}`), so the device curves reuse it to match the dashboard.
    index:           number;
}


//The union of every source's recorder energy meter (`change`) ids: solar, grid import/export, battery
//charge/discharge. Sources fetch this union in one call so RequestCache collapses them to a single recorder
//round-trip, then each merges its own ids.
export function unionChangeMeters(d: EnergyDefaults): string[]
{
    return [
        ...d.solarStatEnergyFroms,
        ...d.gridStatEnergyFroms,
        ...d.gridStatEnergyTos,
        ...d.batteryStatEnergyTos,
        ...d.batteryStatEnergyFroms,
    ];
}


//A new EnergyDefaults literal each call. Array fields must not be aliased across callers, so this returns a
//fresh object rather than a shared constant (see parseEnergyPrefs, which parses into its own copy).
export function freshEnergyDefaults(): EnergyDefaults
{
    return {
        solarStatRates:         [],
        solarStatEnergyFroms:   [],
        gridStatRates:          [],
        gridStatEnergyFroms:    [],
        gridStatEnergyTos:      [],
        gridImportPrices:       [],
        gridImportPriceNumbers: [],
        gridExportPrices:       [],
        gridExportPriceNumbers: [],
        gridStatCosts:          [],
        gridStatCompensations:  [],
        batteryStatRates:       [],
        batteryStatEnergyFroms: [],
        batteryStatEnergyTos:   [],
        batteryStatSocs:        [],
        batterySourcesWithoutRate: 0,
        invertedRateEntities:   [],
        solarForecastEntryIds:  [],
        gridName:               '',
        batteryName:            '',
        devices:                [],
    };
}

export const EMPTY_ENERGY_DEFAULTS: EnergyDefaults = freshEnergyDefaults();


export interface EnergyPrefsHost
{
    readonly hass: any;
    _energyDefaults: EnergyDefaults;
    //True once `fetchEnergyPrefs` lands a parsed snapshot (including the empty "no energy_sources" case), so boot
    //gating stops blocking on a never-arriving prefs payload when no HA Energy dashboard is configured.
    _energyDefaultsLoaded: boolean;
    _energyPrefsUnsub?: (() => void) | undefined;
    requestUpdate(): void;
}


//Fetch HA Energy dashboard prefs into the host's cached snapshot. Idempotent; bails silently when hass is unattached
//or the call fails (RBAC denied, dashboard not configured).
export async function fetchEnergyPrefs(host: EnergyPrefsHost): Promise<void>
{
    if (!host.hass?.callWS)
    {
        return;
    }
    try
    {
        const prefs = await callWS(host.hass, { type: 'energy/get_prefs' }) as {
            energy_sources?: Record<string, unknown>[];
            device_consumption?: Record<string, unknown>[];
        };
        const next = parseEnergyPrefs(prefs);
        host._energyDefaults       = next;
        host._energyDefaultsLoaded = true;
        host.requestUpdate();
    }
    catch (_)
    {
        //Subscription stays wired; the next `energy_preferences_updated` push retries. Flip the boot gate anyway so
        //the spinner doesn't block forever on RBAC-denied or older cores lacking energy/get_prefs.
        host._energyDefaultsLoaded = true;
    }
}


//Subscribe so the snapshot stays in sync when the Energy dashboard is edited elsewhere. Falls back to a single fetch
//when the subscribe path is missing (older cores).
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
            /* prefs subscription already gone or unsubscribe threw on teardown */
        }
        host._energyPrefsUnsub = undefined;
    }
}


//Host shape for `refreshHaDailyTotals`. The card writes the slot when the recorder query lands; the timeline tooltip
//prefers it over local integration for today's produced-kWh headline.
export interface HaDailyTotalsHost
{
    readonly hass: any;
    readonly _energyDefaults: EnergyDefaults;
    _haSolarTodayKwh:          number | null;
    requestUpdate(): void;
}


//Module-level cache for the recorder day-totals fetch, keyed by `${localDate}|${sortedStatisticIds}` so cards on one
//dashboard share a round-trip. TTL undershoots the 30s tick so the value survives a refresh window; `inflight`
//dedupes concurrent calls. Process-scoped (cleared on reload).
const _haDailyTotalsCache = new RequestCache<number | null>(HA_DAILY_TOTALS_TTL_MS);


//Sum the `change` field of `recorder/statistics_during_period` over today (local midnight to now) across all
//statistic_ids. Null on empty list, missing callWS, or rejection so callers fall back cleanly. Shared via the cache.
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
    //The date-stamped key also persists today's total durably, so a reload or failure keeps the figure.
    const durableKey = `dt:${cacheKey}`;
    return _haDailyTotalsCache.get(cacheKey, async () =>
    {
        try
        {
            const result = await callWS(host.hass, {
                type:          'recorder/statistics_during_period',
                start_time:    midnight.toISOString(),
                end_time:      now.toISOString(),
                statistic_ids: statisticIds,
                //Day period yields one bucket per statistic; `types: ['change']` is the net delta from the same
                //Riemann sum HA Energy consumes, so the result matches the dashboard tile to the watt-hour.
                period:        'day',
                types:         ['change'],
                //Normalise to kWh (installs may report Wh/MWh); chip + dashboard formatters assume kWh downstream.
                units:         { energy: 'kWh' },
            }) as Record<string, { change?: number | null }[]>;
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
            if (!anyHit) { return null; }
            saveDurable(durableKey, total);
            return total;
        }
        catch (_)
        {
            //Statistic missing, recorder under load, or RBAC denied: fall back to the durable copy so the
            //chip keeps today's figure instead of blanking.
            return loadDurable<number>(durableKey, DAY_MS);
        }
    });
}




//Refresh today's produced-kWh slot from the recorder. Fired from the card's tick loop; one WS round-trip.
export async function refreshHaDailyTotals(host: HaDailyTotalsHost): Promise<void>
{
    const solar = await fetchTodayKwhChange(host, host._energyDefaults.solarStatEnergyFroms);
    if (solar !== null && solar !== host._haSolarTodayKwh)
    {
        host._haSolarTodayKwh = solar;
        host.requestUpdate();
    }
}


//Parse `energy/get_prefs` into the arrays above. Each source contributes whichever meters the card consumes;
//multi-source installs (split tariffs, separate import/export meters, multi-bank batteries) aggregate by sum at the
//consumer.
//
//Source shapes (HA core 2024+):
//  - solar:   { type: 'solar', stat_energy_from, stat_rate?, config_entry_solar_forecast? }
//  - grid:    { type: 'grid', stat_energy_from, stat_energy_to?, stat_rate?, power_config? }
//  - battery: { type: 'battery', stat_energy_from, stat_energy_to, stat_soc?, power_config? }
//
//HA exposes the live-power slot in two shapes: `power_config.stat_rate` and the top-level grid `stat_rate`. Both are
//read so any encountered config maps cleanly.
export function parseEnergyPrefs(prefs: {
    energy_sources?: Record<string, unknown>[];
    device_consumption?: Record<string, unknown>[];
}): EnergyDefaults
{
    //Fresh literal (not `{ ...EMPTY_ENERGY_DEFAULTS }`) so array fields aren't aliased onto the shared empty default,
    //avoiding cross-call contamination when the subscription path parses while a previous parse is still settling.
    const out: EnergyDefaults = freshEnergyDefaults();
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
            pushStrings(src['stat_energy_from'], out.solarStatEnergyFroms);
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
            if (!out.gridName)
            {
                out.gridName = pickFirstString(src['name']) ?? '';
            }
            //Import + export meters come either flat on the source (the simplified/mock shape) or - in a real HA
            //dashboard - as `flow_from[]` / `flow_to[]` arrays (multi-tariff, several meters). Collect ALL of them so
            //the aggregate sums every meter, not just the first.
            pushStrings(src['stat_energy_from'], out.gridStatEnergyFroms);
            pushStrings(src['stat_energy_to'], out.gridStatEnergyTos);
            for (const f of asRecordArray(src['flow_from']))
            {
                pushStrings(f['stat_energy_from'], out.gridStatEnergyFroms);
            }
            for (const f of asRecordArray(src['flow_to']))
            {
                pushStrings(f['stat_energy_to'], out.gridStatEnergyTos);
            }
            //Cost tracking (optional). HA's real multi-tariff shape carries the price + cost stat INSIDE each flow
            //item; the simplified/single shape carries them top-level. Read both so any config maps; all empty when
            //no cost is tracked (the cost chip then stays hidden). Import price/cost live on flow_from + top-level;
            //export compensation on flow_to (top-level entity_energy_price is the IMPORT price, never read as export).
            for (const f of [src, ...asRecordArray(src['flow_from'])])
            {
                const p = pickFirstString(f['entity_energy_price']); if (p) { out.gridImportPrices.push(p); }
                const n = Number(f['number_energy_price']);          if (Number.isFinite(n)) { out.gridImportPriceNumbers.push(n); }
                const c = pickFirstString(f['stat_cost']);           if (c) { out.gridStatCosts.push(c); }
            }
            for (const f of [src, ...asRecordArray(src['flow_to'])])
            {
                const c = pickFirstString(f['stat_compensation']);   if (c) { out.gridStatCompensations.push(c); }
            }
            for (const f of asRecordArray(src['flow_to']))
            {
                const p = pickFirstString(f['entity_energy_price']); if (p) { out.gridExportPrices.push(p); }
                const n = Number(f['number_energy_price']);          if (Number.isFinite(n)) { out.gridExportPriceNumbers.push(n); }
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
            if (!out.batteryName)
            {
                out.batteryName = pickFirstString(src['name']) ?? '';
            }
            pushStrings(src['stat_energy_from'], out.batteryStatEnergyFroms);
            pushStrings(src['stat_energy_to'], out.batteryStatEnergyTos);
            const soc = pickFirstString(src['stat_soc']);
            if (soc)
            {
                out.batteryStatSocs.push(soc);
            }
            //Battery live power: prefer the `power_config` rate slots; a source with none falls back to its
            //top-level `stat_rate` (the common HA battery config, a net-power sensor). Only a source with NEITHER
            //is truly bucket-sourced, where live power must be netted from the directional energy meters instead.
            const batteryRates = collectPowerConfigRates(src['power_config'], 'battery');
            if (batteryRates.length > 0)
            {
                for (const slot of batteryRates)
                {
                    out.batteryStatRates.push(slot.entity);
                    if (slot.inverted)
                    {
                        out.invertedRateEntities.push(slot.entity);
                    }
                }
            }
            else
            {
                const topRate = pickFirstString(src['stat_rate']);
                if (topRate)
                {
                    //HA's battery stat_rate is discharge-positive; flip it to the card's charge-positive convention.
                    out.batteryStatRates.push(topRate);
                    out.invertedRateEntities.push(topRate);
                }
                else
                {
                    out.batterySourcesWithoutRate += 1;
                }
            }
        }
    }

    //Individual devices tracked by the dashboard (`device_consumption`, electricity only; water is ignored). Keep the
    //raw index so the colour matches HA's per-index devices-graph palette; skip only malformed rows with no meter.
    const devices = Array.isArray(prefs?.device_consumption) ? prefs!.device_consumption! : [];
    devices.forEach((dev, index) =>
    {
        if (!dev || typeof dev !== 'object')
        {
            return;
        }
        const row  = dev as Record<string, unknown>;
        const stat = pickFirstString(row['stat_consumption']);
        if (!stat)
        {
            return;
        }
        out.devices.push({
            statConsumption: stat,
            statRate:        pickFirstString(row['stat_rate']) ?? '',
            name:            pickFirstString(row['name']) ?? '',
            includedInStat:  pickFirstString(row['included_in_stat']) ?? '',
            index,
        });
    });

    return out;
}


//Collect every live-power entity in a `power_config` block with the sign flip its slot needs for the card's canonical
//convention (battery: positive = charging, grid: positive = import). Slot semantics mirror HA's dialog copy:
//  - `stat_rate` ("Standard"): one signed net sensor. Grid positive = import (matches). Battery positive = discharge (flip).
//  - `stat_rate_inverted` ("Inverted"): mirror. Grid positive = export (flip). Battery positive = charge (no flip).
//  - `stat_rate_from`: unsigned from the source (battery discharge -> negative / grid import -> positive).
//  - `stat_rate_to`: unsigned to the source (battery charge -> positive / grid export -> negative).
//A source can carry both directional slots (separate charge/discharge wattmeters), so every populated slot lands in
//the list and the consumer sums them; reading only one would show 0W or the wrong sign.
function collectPowerConfigRates(raw: unknown, flavor: 'grid' | 'battery'): { entity: string; inverted: boolean }[]
{
    if (!raw || typeof raw !== 'object')
    {
        return [];
    }
    const pc  = raw as Record<string, unknown>;
    const out: { entity: string; inverted: boolean }[] = [];
    //Net slots first, exclusive of the directional pair: a signed net sensor already carries both directions, so
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


//Push every non-empty string found in `v` (a string or a nested array) into `arr`, de-duped. Used to collect ALL
//meters for a source (multi-tariff grids expose several under `flow_from`/`flow_to`), not just the first.
function pushStrings(v: unknown, arr: string[]): void
{
    if (typeof v === 'string' && v.trim() !== '')
    {
        const s = v.trim();
        if (!arr.includes(s)) { arr.push(s); }
    }
    else if (Array.isArray(v))
    {
        for (const item of v) { pushStrings(item, arr); }
    }
}

const asRecordArray = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object') : [];

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
