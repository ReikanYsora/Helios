//Trend mode data: two hour-of-day profiles for the active window, the current period P and the same-length
//window just before it (P-1), so the dial can compare each hour against the previous comparable period. Both
//are built from the recorder statistics (uniform across now/week/month/year), reusing the clock's fetch.

import { fetchHourlyProfile, type ClockHourly } from './clock-hourly';
import { customEntityId, type HeliosConfig } from '../core/config/helios-config';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import { HOUR_MS } from '../core/config/constants';

export interface TrendHost
{
    hass:            any;
    config:          HeliosConfig | undefined;
    _energyDefaults: EnergyDefaults;
    _timeRange:      { start: Date; end: Date } | null;
    _viewMode?:      'scene' | 'clock' | 'trend' | 'day';
    _trendP:         ClockHourly | null;
    _trendPrev:      ClockHourly | null;
    _trendKey:       string;
    requestUpdate(): void;
}

//Build (or clear) the P and P-1 profiles. Keyed so an unchanged window never refetches; the previous window is
//the same elapsed length immediately before the current one.
export async function refreshTrendProfiles(host: TrendHost): Promise<void>
{
    if (host._viewMode !== 'trend' || !host.hass?.callWS || !host._timeRange)
    {
        if (host._trendP !== null || host._trendPrev !== null) { host._trendP = null; host._trendPrev = null; host.requestUpdate(); }
        host._trendKey = '';
        return;
    }
    const d   = host._energyDefaults;
    const cid = customEntityId(host.config);
    const startMs = host._timeRange.start.getTime();
    //Quantise the end to the whole hour so the key doesn't churn every frame (Date.now() advances each render).
    const endMs   = Math.floor(Math.min(Date.now(), host._timeRange.end.getTime()) / HOUR_MS) * HOUR_MS;
    if (startMs >= endMs) { return; }
    const len = endMs - startMs;

    const key = `${startMs}|${endMs}|${d.solarStatEnergyFroms}|${d.gridStatEnergyFroms}|${d.gridStatEnergyTos}|${d.batteryStatEnergyTos}|${d.batteryStatEnergyFroms}|${d.batteryStatSocs}|${cid}`;
    if (key === host._trendKey) { return; }
    //Drop stale profiles only when the window itself moved (mode/period switch), so a benign end-of-window tick
    //doesn't flash the dial empty.
    const windowChanged = !host._trendKey.startsWith(`${startMs}|`);
    host._trendKey = key;
    if (windowChanged && (host._trendP !== null || host._trendPrev !== null)) { host._trendP = null; host._trendPrev = null; host.requestUpdate(); }

    const [p, prev] = await Promise.all([
        fetchHourlyProfile(host.hass, d, cid, startMs, endMs),
        fetchHourlyProfile(host.hass, d, cid, startMs - len, startMs),
    ]);
    //Ignore a resolution whose window moved on while it was in flight.
    if (host._trendKey !== key) { return; }
    host._trendP    = p;
    host._trendPrev = prev;
    host.requestUpdate();
}
