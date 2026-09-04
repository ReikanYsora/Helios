//The Helios-Forecast layout: which arrays the forecast knows, where they stand and which way they look, so the
//card can mark each one in the scene. Read once per configured forecast entry over the `helios_forecast/layout`
//websocket (the same entries the series fetch uses), kept in memory on the host, re-read only when the entry set
//changes or after a long throttle. Entries that are not the Helios provider reject the command and add nothing.

import type { HassLike } from '../core/ha-types';
import type { EnergyDefaults } from './sources/energy-prefs';
import { ARRAY_LAYOUT_THROTTLE_MS } from '../core/config/constants';
import { callWS } from './ha-gateway';
import { parseForecastLayout, type ArrayLine } from '../scene/array-markers';


export interface ForecastLayoutHost
{
    readonly hass: HassLike;
    readonly _energyDefaults: EnergyDefaults;
    //Every line of every answering entry; null until the first fetch settles, [] when no entry answers (the scene
    //then keeps its single sun-to-production ray).
    _forecastLayout: ArrayLine[] | null;
    _forecastLayoutFetching: boolean;
    //Entry ids the last fetch asked for, and when: the throttle key.
    _forecastLayoutKey: string;
    _forecastLayoutFetchedAt: number;
    requestUpdate(): void;
}


export async function fetchForecastLayout(host: ForecastLayoutHost): Promise<void>
{
    if (!host.hass?.callWS || host._forecastLayoutFetching)
    {
        return;
    }
    const ids = host._energyDefaults?.solarForecastEntryIds ?? [];
    const key = ids.join('|');
    if (key === host._forecastLayoutKey && host._forecastLayout !== null
        && Date.now() - host._forecastLayoutFetchedAt < ARRAY_LAYOUT_THROTTLE_MS)
    {
        return;
    }
    if (ids.length === 0)
    {
        host._forecastLayoutKey = key;
        host._forecastLayoutFetchedAt = Date.now();
        if (host._forecastLayout === null || host._forecastLayout.length > 0)
        {
            host._forecastLayout = [];
            host.requestUpdate();
        }
        return;
    }
    host._forecastLayoutFetching = true;
    host._forecastLayoutKey = key;
    host._forecastLayoutFetchedAt = Date.now();
    try
    {
        const answers = await Promise.all(ids.map((entryId) =>
            callWS<unknown>(host.hass, { type: 'helios_forecast/layout', entry_id: entryId })
                .then((raw: unknown) => parseForecastLayout(entryId, raw))
                .catch(() => [] as ArrayLine[])));
        host._forecastLayout = answers.flat();
        host.requestUpdate();
    }
    catch (_)
    {
        //Left as it was: a transient failure keeps the last known layout (or the pre-fetch null), and the next
        //refresh pass retries once the throttle allows.
    }
    finally
    {
        host._forecastLayoutFetching = false;
    }
}
