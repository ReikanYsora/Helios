//Warm start: the data a card had when it left the document, kept for the card that takes its place. The Home
//Assistant editor destroys the card and creates a fresh one on every setting it changes, so without this a
//fresh card showed empty chips and an empty timeline until its own fetches came back, and the editor preview
//flashed through that state on every keystroke. A leaving card parks its fetched series, live readings and
//preferences under its cache id (or its home); a card booting under the same key seeds itself from them before
//its first render and then refreshes normally, so every fetch still runs, it just no longer paints a blank
//first. Short-lived and in memory only: a genuinely new visit still starts cold.

//Kept as it is: the leaving card's own arrays and maps, never copied. It stops writing them at disconnect.
export const WARM_START_FIELDS = [
    '_energyDefaults', '_energyDefaultsLoaded',
    '_pvCurrent', '_pvUnit', '_pvChangeSeries', '_pvChangeSeriesPerEntity',
    '_haSolarForecast', '_haSolarForecastLoaded', '_haSolarForecastFetchedAt', '_haSolarForecastCoveredPastDays',
    '_forecastLayout', '_forecastLayoutKey', '_forecastLayoutFetchedAt',
    '_haSolarTodayKwh',
    '_batterySoc', '_batteryPower', '_batteryPowerUnit',
    '_batterySocHistory', '_batterySocPerBankHistory',
    '_batteryChargeChangeSeries', '_batteryDischargeChangeSeries',
    '_batteryChargeChangeSeriesPerEntity', '_batteryDischargeChangeSeriesPerEntity',
    '_batteryGuard',
    '_gridImportValue', '_gridImportUnit', '_gridExportValue', '_gridExportUnit',
    '_gridImportChangeSeries', '_gridExportChangeSeries',
    '_gridImportChangeSeriesPerEntity', '_gridExportChangeSeriesPerEntity',
    '_gridGuard',
    '_costRate', '_currency', '_costImportSeries', '_costExportSeries',
    '_deviceChangeSeries',
    '_irradianceHistory', '_weatherOverrideState',
    '_cloudCover', '_precip', '_snowfall', '_weatherCode', '_temperature', '_humidity',
] as const;

//A snapshot older than this is stale enough to start cold instead (the fetches it would paper over take seconds).
const WARM_START_TTL_MS = 5 * 60_000;

interface Snapshot
{
    at:   number;
    data: Record<string, unknown>;
}

const _snapshots = new Map<string, Snapshot>();

//The slot a card saves to and boots from: its cache id when it has one, else its home.
export function warmStartKey(cacheId: string, homeKey: string): string
{
    return cacheId || homeKey;
}

export function saveWarmStart(host: object, key: string): void
{
    if (!key)
    {
        return;
    }
    const src  = host as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const f of WARM_START_FIELDS)
    {
        data[f] = src[f];
    }
    _snapshots.set(key, { at: Date.now(), data });
}

//Seed `host` from the snapshot under `key`, if one is fresh enough. Returns whether anything was restored.
export function restoreWarmStart(host: object, key: string): boolean
{
    const snap = key ? _snapshots.get(key) : undefined;
    if (!snap)
    {
        return false;
    }
    if (Date.now() - snap.at > WARM_START_TTL_MS)
    {
        _snapshots.delete(key);
        return false;
    }
    const dst = host as Record<string, unknown>;
    for (const f of WARM_START_FIELDS)
    {
        dst[f] = snap.data[f];
    }
    return true;
}

//For tests.
export function clearWarmStarts(): void
{
    _snapshots.clear();
}
