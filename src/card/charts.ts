//Timeline chart rendering: the two SVG cards that sit under the map, the timeline cursors that scrub across them, and the per-day kWh aggregation
//used by the day chips.
//
//Pure templates: each function takes a structural `ChartHost`
//(the card) and returns a Lit `TemplateResult` or a derived
//value. State mutations live elsewhere; charts only read.

import { html, svg, nothing, TemplateResult } from 'lit';
import
{
    type HeliosConfig,
    DEFAULT_SUN_COLOR_HEX,
    DEFAULT_CLOUD_COLOR_HEX,
    DEFAULT_PV_COLOR_HEX,
    DEFAULT_GRID_IMPORT_COLOR_HEX,
    DEFAULT_GRID_EXPORT_COLOR_HEX,
    DEFAULT_BATTERY_IN_COLOR_HEX,
    DEFAULT_BATTERY_OUT_COLOR_HEX
} from '../helios-config';
import { formatLocalisedNumber, lerpHexToward } from './format';
import { buildTimelineModel, formatTimelineLabel } from './timeline-model';
import { type PvHistory } from './pv';
import { getHomeCoords } from './init';
import { getSunPosition } from '../engine/sun';
import { sliceForRange, valueAt } from './unifiedStore';
import { sumChangeForDay, type ChangeBucket } from './energy-stats';


//Per-point forecast multiplier. Identity on calR today; kept as a single hook so a future
//multiplier (weather grid contribution, hourly bias correction, etc.) can re-wire through
//the call sites without a sweep.
export function effectiveForecastRatio(calR: number): number
{
    return calR;
}


//Binary-search the sun's altitude=0 crossing inside [dayStart, dayEnd]
//in the requested direction (rising = first crossing where alt > 0,
//setting = first crossing where alt ≤ 0 after being > 0). Returns
//null at polar latitudes during the day-long polar day / night
//windows where the sun never crosses the horizon, or when the
//bracket is degenerate. Used by the timeline's per-day sunrise /
//sunset markers; coarse 1-hour scan + 12 iterations of bisection
//get the answer to seconds precision in ~22 getSunPosition calls
//per event, well under the per-frame budget.
function findSunCrossing(
    lat: number,
    lon: number,
    dayStartMs: number,
    dayEndMs:   number,
    direction:  'rising' | 'setting'
): Date | null
{
    const STEP_MS = 60 * 60 * 1000;
    let prevAlt = getSunPosition(new Date(dayStartMs), lat, lon).altitude;
    let bracketLo = 0;
    let bracketHi = 0;
    let found = false;
    for (let t = dayStartMs + STEP_MS; t <= dayEndMs; t += STEP_MS)
    {
        const alt = getSunPosition(new Date(t), lat, lon).altitude;
        if (direction === 'rising' && prevAlt <= 0 && alt > 0)
        {
            bracketLo = t - STEP_MS;
            bracketHi = t;
            found = true;
            break;
        }
        if (direction === 'setting' && prevAlt > 0 && alt <= 0)
        {
            bracketLo = t - STEP_MS;
            bracketHi = t;
            found = true;
            break;
        }
        prevAlt = alt;
    }
    if (!found)
    {
        return null;
    }
    for (let i = 0; i < 12; i++)
    {
        const mid = (bracketLo + bracketHi) / 2;
        const alt = getSunPosition(new Date(mid), lat, lon).altitude;
        if ((direction === 'rising') === (alt > 0))
        {
            bracketHi = mid;
        }
        else
        {
            bracketLo = mid;
        }
    }
    return new Date((bracketLo + bracketHi) / 2);
}


//Per-day night intervals clipped to the visible time range.
//Each interval is a (sunset[N] -> sunrise[N+1]) pair returned as
//{ startPct, endPct } fractional positions; consumed by
//`renderTimelineNightZones` to lay diagonal-hatch overlays over
//the chart cards. The walk pads one day on either side of the
//visible window so the leading and trailing night chunks (the
//morning before the first sunrise, the evening after the last
//sunset) still resolve correctly when the window doesn't start
//or end exactly on a solar boundary.
function computeNightIntervals(host: ChartHost): Array<{ startPct: number; endPct: number }>
{
    const range = host._timeRange;
    if (!range)
    {
        return [];
    }
    const coords = getHomeCoords(host.config, host.hass);
    if (!coords)
    {
        return [];
    }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    const rangeMs = endMs - startMs;
    if (rangeMs <= 0)
    {
        return [];
    }

    type Crossing = { ms: number; kind: 'sunrise' | 'sunset' };
    const crossings: Crossing[] = [];

    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() - 1);
    const walkEndMs = endMs + 24 * 60 * 60 * 1000;
    while (cursor.getTime() <= walkEndMs)
    {
        const dayStart = cursor.getTime();
        const dayEnd   = dayStart + 24 * 60 * 60 * 1000;
        const rise = findSunCrossing(coords.lat, coords.lon, dayStart, dayEnd, 'rising');
        const setT = findSunCrossing(coords.lat, coords.lon, dayStart, dayEnd, 'setting');
        if (rise)
        {
            crossings.push({ ms: rise.getTime(), kind: 'sunrise' });
        }
        if (setT)
        {
            crossings.push({ ms: setT.getTime(), kind: 'sunset' });
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    crossings.sort((a, b) => a.ms - b.ms);

    const intervals: Array<{ startMs: number; endMs: number }> = [];
    let pendingSunset: number | null = null;
    let sawAnySunrise = false;
    for (const c of crossings)
    {
        if (c.kind === 'sunset')
        {
            pendingSunset = c.ms;
        }
        else
        {
            if (pendingSunset !== null)
            {
                intervals.push({ startMs: pendingSunset, endMs: c.ms });
                pendingSunset = null;
            }
            else if (!sawAnySunrise)
            {
                //Leading night: the window opens before the first sunset of our walk, so the morning chunk up to the first sunrise is still a night
                //zone.
                intervals.push({ startMs: -Infinity, endMs: c.ms });
            }
            sawAnySunrise = true;
        }
    }
    if (pendingSunset !== null)
    {
        //Trailing night extending past the walk's last sunrise.
        intervals.push({ startMs: pendingSunset, endMs: Infinity });
    }

    const out: Array<{ startPct: number; endPct: number }> = [];
    for (const iv of intervals)
    {
        const s = Math.max(iv.startMs, startMs);
        const e = Math.min(iv.endMs,   endMs);
        if (e > s)
        {
            out.push({
                startPct: (s - startMs) / rangeMs * 100,
                endPct:   (e - startMs) / rangeMs * 100,
            });
        }
    }
    return out;
}


//Night-zone overlays for a chart card. Renders one absolutely-
//positioned div per night interval, filled with a solid low-alpha
//wash. The divs are inserted inside the chart card so they
//inherit the card's relative positioning + overflow clipping;
//z-index lifts them above the SVG curves (which paint as flow
//content) but stays below the live + scrub cursors (z-index 4).
//The result reads as "this stretch of timeline is night", with
//the underlying curves still legible through the low-alpha wash.
export function renderTimelineNightZones(host: ChartHost): TemplateResult
{
    const intervals = computeNightIntervals(host);
    if (intervals.length === 0)
    {
        return html``;
    }
    return html`
        ${intervals.map(iv => html`
            <div
                class="hc-night-zone"
                style="left:${iv.startPct.toFixed(2)}%; width:${(iv.endPct - iv.startPct).toFixed(2)}%"
            ></div>
        `)}
    `;
}


//Semi-opaque overlay covering the future portion of a chart card.
//Paints on top of the curves + night-zones at z-index 3, leaving
//the live + scrub cursors (z-index 4) untouched. Anchored to "now"
//inside the active visible range, so the past portion (left of
//the overlay) reads at full punch and the forecast portion (right
//of the overlay) sits behind a wash that fades curves, fills and
//hatch overlays in one go. Returns nothing when "now" sits
//outside the range (a fully-past or fully-future window), so the
//mask never shrinks to a sliver or fills the whole card.
export function renderTimelineFutureMask(host: ChartHost): TemplateResult
{
    const range = host._timeRange;
    if (!range)
    {
        return html``;
    }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    const rangeMs = endMs - startMs;
    if (rangeMs <= 0)
    {
        return html``;
    }
    const nowMs = Date.now();
    if (nowMs <= startMs || nowMs >= endMs)
    {
        return html``;
    }
    const nowPct = (nowMs - startMs) / rangeMs * 100;
    return html`
        <div
            class="hc-future-mask"
            style="left:${nowPct.toFixed(2)}%"
        ></div>
    `;
}


//PV value at the hover timestamp, expressed in the entity's
//native power unit so the tooltip number matches the Y axis of
//the PV chart and the user's own entity reading. Observed-history
//pair around the cursor wins; falling back to the clear-sky model
//(scaled by pv-peak-kwp + thermal derating + LiDAR shading) for
//hours past "now" keeps the readout meaningful in the forecast
//window. Returns NaN value when neither source can supply a
//number at the cursor instant (no entity configured, sample gap,
//etc).
//Hue-rotated palette built around the HA Energy `--energy-solar-color` theme token. The first source keeps the
//base hue (so single-source installs reading this index get the exact theme colour), siblings step the hue by
//`360 / N` degrees so a 2-source split E / W lands on opposite hues, a 3-source install on 120 ° spacing, and so
//on. The CSS HSL `from` syntax lets us derive the rotation in pure CSS so the actual colour follows the user's
//live theme without us having to parse the resolved RGB. Falls back to a fixed orange on browsers that don't
//support the relative-colour syntax. Exported so the dashboard chart tooltip can reuse the same per-source
//colours next to the friendly-name rows.
export function pvSourceColor(index: number, total: number): string
{
    if (total <= 1)
    {
        return 'var(--energy-solar-color, #ff9800)';
    }
    const step = 360 / total;
    return `hsl(from var(--energy-solar-color, #ff9800) calc(h + ${index * step}) s l)`;
}


export function pvValueAtTime(
    host: ChartHost,
    targetMs: number,
    //Optional per-source history override. When supplied, the function reads from this series instead of the
    //aggregated `_pvHistory`, used by the multi-source per-entity tooltip rows so each source displays its own
    //value at the scrub instant. The calibration / LTS fallback is skipped in override mode (no per-entity LTS is
    //fetched yet); the forecast pass on the aggregated path stays as-is, so a per-entity row simply reads "—" when
    //the cursor lands past the per-entity history's tail.
    seriesOverride?: { times: Date[]; values: number[] },
): { value: number; unit: string; isPredicted: boolean }
{
    const luRaw = (host._pvUnit || '').trim();
    if (!luRaw)
    {
        return { value: NaN, unit: '', isPredicted: false };
    }
    const lu             = luRaw.toLowerCase();
    const isCumulative   = lu === 'wh' || lu === 'kwh' || lu === 'mwh';
    const displayUnit    = isCumulative
        ? (lu === 'kwh' ? 'kW' : lu === 'mwh' ? 'MW' : 'W')
        : luRaw;
    const duLow = displayUnit.toLowerCase();
    const nativeFromW    = duLow === 'kw' ? 1 / 1000
                         : duLow === 'mw' ? 1 / 1_000_000
                         : 1;

    //Hard zero when the sun is below the horizon at the cursor
    //instant. Catches three otherwise-tricky cases at once:
    //  - A stale observed sample (the entity didn't tick after dusk)
    //    that interpAt clamps forward into the night.
    //  - Forecast bracketing pairs straddling sunrise / sunset
    //    where the linear interp between "0" and "small positive"
    //    leaks a few watts into pre-dawn / post-dusk.
    //  - Inverter standby readings that a power-entity reports as
    //    0.5-2 W all night.
    //Panels can't produce without sun, so we don't trust any source
    //that disagrees with that physical floor.
    const coords = getHomeCoords(host.config, host.hass);
    if (coords && getSunPosition(new Date(targetMs), coords.lat, coords.lon).altitude <= 0)
    {
        return { value: 0, unit: displayUnit, isPredicted: false };
    }

    //Observed history. Cumulative entities differentiate between
    //the bracketing pair (the same shape the chart uses); power
    //entities linearly interpolate. Sensor noise (and net-meter
    //entities swinging through zero at dawn / dusk) can hand back
    //a small negative reading; we floor at zero so the tooltip
    //never displays "-2 W" of production.
    //
    //Hover instants BEYOND the last observed sample fall through
    //to the forecast pass below: clamping interpAt to the last
    //observed value would mean the tooltip reads "3 W" for noon
    //tomorrow just because that was the panel's reading at 16:00
    //yesterday (the late-afternoon tail of the last seen day).
    const hist = seriesOverride ?? host._pvHistory;
    const rawFirstMs = (hist && hist.times.length >= 1)
        ? hist.times[0].getTime()
        : Infinity;
    const lastObsMs = (hist && hist.times.length >= 1)
        ? hist.times[hist.times.length - 1].getTime()
        : -Infinity;
    if (hist && hist.times.length >= 2 && targetMs >= rawFirstMs && targetMs <= lastObsMs)
    {
        if (isCumulative)
        {
            for (let i = 1; i < hist.times.length; i++)
            {
                const t1 = hist.times[i].getTime();
                if (targetMs > t1)
                {
                    continue;
                }
                const t0 = hist.times[i - 1].getTime();
                if (targetMs < t0)
                {
                    break;
                }
                const dtH = (t1 - t0) / 3_600_000;
                if (dtH <= 0 || dtH > 6)
                {
                    break;
                }
                const dv = hist.values[i] - hist.values[i - 1];
                if (!isFinite(dv) || dv < 0)
                {
                    break;
                }
                return { value: Math.max(0, dv / dtH), unit: displayUnit, isPredicted: false };
            }
        }
        else
        {
            const v = interpAt(hist.times, hist.values, targetMs);
            if (isFinite(v))
            {
                return { value: Math.max(0, v), unit: displayUnit, isPredicted: false };
            }
        }
    }
    //Older past, before the head of the raw 6-hour window: fall
    //back to the hourly LTS slot the calibration already fetched.
    //The LTS values are already in native power units (mean for
    //power sensors, differentiated state for cumulative-energy
    //sensors) so a linear interpolation at the cursor instant is
    //the right thing to do regardless of the source entity type.
    //Skipped in `seriesOverride` mode because no per-entity LTS is fetched alongside the per-entity raw history yet
    //(the override carries only the 6 h raw window). Per-entity rows simply read "—" for older past until a
    //per-entity LTS path is added.
    if (!seriesOverride)
    {
        const calib = host._pvCalibStats;
        if (calib && calib.times.length >= 2 && targetMs <= lastObsMs)
        {
            if (isCumulative)
            {
                //_pvCalibStats carries the meter's cumulative `state` (kWh) per hourly LTS bucket for
                //energy sensors, NOT power, the same contract dashboard.ts relies on when it baseline-
                //subtracts these samples for the daily-kWh total. So differentiate the bracketing pair
                //into average power, exactly like the raw-history branch above, instead of reading the
                //cumulative value straight through (which mislabels a kWh reading as kW and inflates the
                //scrub readout ~1000x once the cursor falls past the raw 6 h window).
                for (let i = 1; i < calib.times.length; i++)
                {
                    const t1 = calib.times[i].getTime();
                    if (targetMs > t1)
                    {
                        continue;
                    }
                    const t0 = calib.times[i - 1].getTime();
                    if (targetMs < t0)
                    {
                        break;
                    }
                    const dtH = (t1 - t0) / 3_600_000;
                    if (dtH <= 0 || dtH > 6)
                    {
                        break;
                    }
                    const dv = calib.values[i] - calib.values[i - 1];
                    if (!isFinite(dv) || dv < 0)
                    {
                        break;
                    }
                    return { value: Math.max(0, dv / dtH), unit: displayUnit, isPredicted: false };
                }
            }
            else
            {
                const v = interpAt(calib.times, calib.values, targetMs);
                if (isFinite(v))
                {
                    return { value: Math.max(0, v), unit: displayUnit, isPredicted: false };
                }
            }
        }
    }

    //Per-entity override mode has no per-source forecast yet (the model is single-aggregate), so we stop here on a
    //future cursor and let the caller show "—". The aggregated path below stays unchanged for the headline forecast.
    if (seriesOverride)
    {
        return { value: NaN, unit: displayUnit, isPredicted: false };
    }

    //Forecast for future hours: read the unified store's CORRECTED forecast at the cursor instant, the
    //same series the dotted timeline curve draws and the dashboard "affiné" headline integrates, so the
    //tooltip never disagrees with the line it sits on. The store value is already cap-clipped and
    //correction-applied, no local model loop here.
    const store = host._unifiedStore;
    if (store)
    {
        const w = valueAt(store.forecast, store, targetMs);
        if (w !== null && w > 0)
        {
            return { value: Math.max(0, w) * nativeFromW, unit: displayUnit, isPredicted: true };
        }
    }

    return { value: NaN, unit: displayUnit, isPredicted: false };
}


//Hover tooltip block, sits above the chart-card stack inside the
//time-bar. Shows the hover timestamp + one icon-coded row per
//series, plus the day's kWh production (observed past + today
//so-far) or forecast (future days) on a dedicated row. A small
//magnet-snap tab appears above the tooltip the moment the scrub
//pointer enters the narrow band around the live cursor, signalling
//the imminent auto-snap back to live mode (see applyTimelinePointer
//in timeline.ts for the actual snap logic). The PV row is skipped
//silently when the entity isn't configured or no value is available
//at the cursor instant, so the chip stays useful for forecast-only
//setups.
export function renderTimelineHoverTooltip(host: ChartHost): TemplateResult
{
    const range    = host._timeRange;
    const series   = host._chartSeries;
    //Tooltip stays available even when _chartSeries is null (Open-Meteo unreachable). The PV +
    //per-entity rows read from the recorder and render fine; the irradiance + cloud cells just go
    //missing for that hover, falling back to NaN handled below.
    if (!range)
    {
        return html``;
    }

    const startMs = range.start.getTime();
    const rangeMs = range.end.getTime() - startMs;
    if (rangeMs <= 0)
    {
        return html``;
    }

    //Tooltip shows ONLY while the pointer is actively over the chart
    //(or actively dragging the scrub, which keeps _chartHoverPct in
    //sync). Once the gesture ends, _chartHoverPct goes null and the
    //tooltip disappears, leaving only the scrub line behind so the
    //user reads the locked instant without a floating callout.
    const hoverPct = host._chartHoverPct;
    if (hoverPct === null || hoverPct < 0 || hoverPct > 100)
    {
        return html``;
    }
    const pct  = hoverPct;
    const atMs = startMs + (pct / 100) * rangeMs;

    const irrV = series ? interpAt(series.times, series.irradiance, atMs) : NaN;
    const cloudLowV  = series ? interpAt(series.times, series.cloudLow,  atMs) : NaN;
    const cloudMidV  = series ? interpAt(series.times, series.cloudMid,  atMs) : NaN;
    const cloudHighV = series ? interpAt(series.times, series.cloudHigh, atMs) : NaN;
    const pv   = pvValueAtTime(host, atMs);

    //Active chart target: the tooltip rows follow whatever the re-targetable chart is showing, the same
    //chip <-> chart <-> tooltip coupling as the HA card. Grid / battery values are read from the unified
    //store at the cursor instant (watts; kw() formats to kW). valueAt may return null -> coerce to NaN.
    const target   = host._chartTarget ?? 'production';
    const store    = host._unifiedStore;
    const gridImpW = store ? (valueAt(store.gridImport, store, atMs) ?? NaN) : NaN;
    const gridExpW = store ? (valueAt(store.gridExport, store, atMs) ?? NaN) : NaN;
    const battW    = store ? (valueAt(store.battery,    store, atMs) ?? NaN) : NaN;
    const battSocV = host._batterySocHistory
        ? interpAt(host._batterySocHistory.times, host._batterySocHistory.values, atMs)
        : NaN;
    const kw = (w: number): string => `${formatLocalisedNumber(host.hass, w / 1000, 1)} kW`;

    //Per-entity breakdown rows for multi-source installs (LBDG_'s feature). Each row carries the friendly name from
    //hass.states + a colour pastille derived by hue-rotating the theme PV colour, so the chip ↔ row visual link
    //matches the per-source curve drawn on the chart underneath. Single-source installs skip the breakdown entirely
    //(the per-entity map carries one entry equal to the aggregate, which would duplicate the headline row).
    const perEntityMap     = host._pvHistoryPerEntity;
    const perEntityIds     = perEntityMap.size > 1 ? Array.from(perEntityMap.keys()).sort() : [];
    const perEntityRows: Array<{ id: string; label: string; valueText: string; colorIdx: number }> = [];
    for (let i = 0; i < perEntityIds.length; i++)
    {
        const id    = perEntityIds[i];
        const ph    = perEntityMap.get(id);
        if (!ph)
        {
            continue;
        }
        const val   = pvValueAtTime(host, atMs, ph);
        if (!isFinite(val.value))
        {
            continue;
        }
        const stateObj    = host.hass?.states?.[id];
        const friendly    = String(stateObj?.attributes?.friendly_name ?? id);
        const localDec    = val.unit === 'W' ? 0 : (Math.abs(val.value) < 100 ? 1 : 0);
        const valueText   = `${formatLocalisedNumber(host.hass, val.value, localDec)} ${val.unit}`;
        perEntityRows.push({ id, label: friendly, valueText, colorIdx: i });
    }
    const hasPv = isFinite(pv.value);

    //The scrub tooltip icons now inherit the active HA theme colour
    //(see .tb-hover-tooltip-icon), so the per-series tints from the
    //legacy DEFAULT_*_COLOR_HEX constants are no longer applied here.

    const atDate     = new Date(atMs);
    const haLanguage = (host.hass?.language as string | undefined) || undefined;
    const timeLabel  = new Intl.DateTimeFormat(haLanguage, {
        hour: '2-digit', minute: '2-digit',
    }).format(atDate);

    //Day total split into observed (past scrub) and forecast (future scrub). The split key is the cursor instant vs
    //"now", not the day boundary, so scrubbing later-today hours shows the day's forecast projection (full-day kWh) and
    //scrubbing earlier-today hours shows the observed production so far. Today's past bucket prefers the recorder-backed
    //`_haSolarTodayKwh` so the tooltip matches the dashboard "produced today" chip to the watt-hour, falling back to the
    //local trapezoidal integration when the HA Energy preference is not wired. Today's future bucket and every other
    //future day stay on `computeDailyKwhTotals`, which adds the forecast model's remaining hours to the observed past.
    const dayKey = new Date(atDate);
    dayKey.setHours(0, 0, 0, 0);
    const todayKey = new Date();
    todayKey.setHours(0, 0, 0, 0);
    const isToday        = dayKey.getTime() === todayKey.getTime();
    const isFutureCursor = atMs > Date.now();
    const dayTotals      = computeDailyKwhTotals(host);
    let dayKwh: number | undefined = dayTotals.get(dayKey.getTime());
    if (isToday && !isFutureCursor && typeof host._haSolarTodayKwh === 'number' && isFinite(host._haSolarTodayKwh))
    {
        dayKwh = host._haSolarTodayKwh;
    }
    const showProduction = !isFutureCursor && dayKwh !== undefined && isFinite(dayKwh) && dayKwh >= 0.05;
    const showForecast   =  isFutureCursor && dayKwh !== undefined && isFinite(dayKwh) && dayKwh >= 0.05;
    const dayKwhText = (dayKwh !== undefined && isFinite(dayKwh) && dayKwh >= 0.05)
        ? formatLocalisedNumber(host.hass, dayKwh, 1) + ' kWh'
        : '';

    //Magnet-snap detection. When the scrub pointer lands within a
    //narrow band around the live cursor, applyTimelinePointer in
    //timeline.ts auto-releases back to live mode. A small restore
    //tab surfaces above the tooltip the moment the pointer enters
    //that band so the user reads the upcoming snap visually. The
    //px-based scrub check uses 8 px, this pct equivalent is sized to
    //match at typical chart widths (8 px on a 700 px chart ~= 1.2 %).
    const MAGNET_PCT   = 1.2;
    const nowMsRef     = Date.now();
    const inMagnetZone = nowMsRef >= startMs && nowMsRef <= startMs + rangeMs
        && Math.abs(pct - ((nowMsRef - startMs) / rangeMs) * 100) <= MAGNET_PCT;

    //PV decimals: 1 for kW/MW under three digits, 0 otherwise.
    const pvDecimals = !hasPv ? 0
                     : pv.unit === 'W' ? 0
                     : (Math.abs(pv.value) < 100 ? 1 : 0);

    const haLang   = (host.hass?.language as string | undefined) || '';
    //Short label inside the magnet-snap tab. The tooltip title + aria-label still carry the long phrase for screen readers
    //and hover hint; the inline label stays single-word so the tab does not bloat the tooltip width.
    const liveLabel = 'Live';
    const liveText  = haLang.toLowerCase().startsWith('fr')
        ? 'Retour au live'
        : 'Back to live';

    //Tooltip horizontal anchor: a continuous left-to-right slide
    //driven by translateX(-${pct}%), so the tooltip's left edge sits
    //at 0 when the scrub is at 0 % and its right edge sits at 100 %
    //when the scrub is at 100 %. Net result: the tooltip never goes
    //off-screen yet there's no jump-to-edge magnet at any threshold,
    //the box just slides smoothly along with the scrub.
    return html`
        <div
            class="tb-hover-tooltip-tail ${inMagnetZone ? 'is-magnet-snap' : ''}"
            style="left:${pct.toFixed(2)}%"
        ></div>
        <div
            class="tb-hover-tooltip-wrapper"
            style="left:${pct.toFixed(2)}%; transform: translateX(-${pct.toFixed(2)}%)"
        >
            <div class="tb-hover-tooltip">
                <div class="tb-hover-tooltip-time">
                    <ha-icon class="tb-hover-tooltip-time-icon" icon="mdi:clock-outline"></ha-icon>
                    <span class="tb-hover-tooltip-time-label">${timeLabel}</span>
                    <span
                        class="tb-hover-tooltip-live-chip ${inMagnetZone ? 'is-visible' : ''}"
                        title="${liveText}"
                        aria-label="${liveText}"
                        aria-hidden="${inMagnetZone ? 'false' : 'true'}"
                    >
                        <ha-icon class="tb-hover-tooltip-live-chip-dot" icon="mdi:circle-medium"></ha-icon>
                        <span class="tb-hover-tooltip-live-chip-label">${liveLabel}</span>
                    </span>
                </div>
                ${target === 'production' ? html`
                    ${showProduction && dayKwhText ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:solar-power-variant"></ha-icon>
                            <span class="tb-hover-tooltip-value">${dayKwhText}</span>
                        </div>
                    ` : nothing}
                    ${showForecast && dayKwhText ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:crystal-ball"></ha-icon>
                            <span class="tb-hover-tooltip-value">${dayKwhText}</span>
                        </div>
                    ` : nothing}
                    ${hasPv ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:solar-power"></ha-icon>
                            <span class="tb-hover-tooltip-value">${formatLocalisedNumber(host.hass, pv.value, pvDecimals)} ${pv.unit}</span>
                        </div>
                    ` : nothing}
                    ${perEntityRows.map(prow => html`
                        <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                            <span class="tb-hover-tooltip-dot" style="background:${pvSourceColor(prow.colorIdx, perEntityIds.length)}"></span>
                            <span class="tb-hover-tooltip-sublabel">${prow.label}</span>
                            <span class="tb-hover-tooltip-value">${prow.valueText}</span>
                        </div>
                    `)}
                ` : nothing}
                ${target === 'grid' ? html`
                    ${isFinite(gridImpW) && gridImpW >= 1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:transmission-tower-export"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(gridImpW)}</span>
                        </div>
                    ` : nothing}
                    ${isFinite(gridExpW) && gridExpW >= 1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:transmission-tower-import"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(gridExpW)}</span>
                        </div>
                    ` : nothing}
                ` : nothing}
                ${target === 'battery' ? html`
                    ${isFinite(battW) && battW >= 1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:battery-arrow-up"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(battW)}</span>
                        </div>
                    ` : nothing}
                    ${isFinite(battW) && battW <= -1 ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:battery-arrow-down"></ha-icon>
                            <span class="tb-hover-tooltip-value">${kw(-battW)}</span>
                        </div>
                    ` : nothing}
                ` : nothing}
                ${target === 'battery-soc' && isFinite(battSocV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" icon="mdi:battery"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, battSocV)))} %</span>
                    </div>
                ` : nothing}
                ${target === 'irradiance' && isFinite(irrV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" icon="mdi:white-balance-sunny"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, irrV))} W/m²</span>
                    </div>
                ` : nothing}
                ${target === 'cloud' ? html`
                    ${isFinite(cloudLowV) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:format-vertical-align-bottom"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cloudLowV)))} %</span>
                        </div>
                    ` : nothing}
                    ${isFinite(cloudMidV) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:format-vertical-align-center"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cloudMidV)))} %</span>
                        </div>
                    ` : nothing}
                    ${isFinite(cloudHighV) ? html`
                        <div class="tb-hover-tooltip-row">
                            <ha-icon class="tb-hover-tooltip-icon" icon="mdi:format-vertical-align-top"></ha-icon>
                            <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cloudHighV)))} %</span>
                        </div>
                    ` : nothing}
                ` : nothing}
            </div>
        </div>
    `;
}


//Engine-resampled weather series. Same shape the engine snapshots and pushes to the card on every refresh.
export interface ChartSeries
{
    times:        Date[];
    irradiance:   number[];
    cloud:        number[];
    //Hourly low / mid / high cloud cover (%), for the timeline's cloud target (three altitude bands).
    cloudLow:     number[];
    cloudMid:     number[];
    cloudHigh:    number[];
    //Hourly horizontal beam + diffuse radiation (W/m²), -1 where the
    //model didn't decompose. Feed the tilt transposition with the real
    //direct / diffuse split. Consumers that don't transpose ignore them.
    directRad:    number[];
    diffuseRad:   number[];
    //Hourly ground snow depth (m), NaN where unknown. Feeds the winter snow-cover derate.
    snowDepth:    number[];
    //Hourly ambient temperature (°C) and 10-metre wind speed (m/s).
    //NaN where the model didn't supply a value. Consumers that
    //don't care about thermal derating ignore these fields.
    temperature:  number[];
    windSpeed:    number[];
}

//Re-targetable bottom-chart target: the single series-set the one chart draws at a time. 'production'
//(+ dashed forecast + per-source breakdown) is the default; 'grid' / 'battery' draw their two-direction
//flows (accent = the dominant side over the window); 'irradiance' draws the W/m² curve on a fixed
//0..1000 scale. Cloud is intentionally NOT a target, it lives in weather mode.
export type ChartTarget = 'production' | 'grid' | 'battery' | 'battery-soc' | 'irradiance' | 'cloud';

//Structural surface the host card exposes to this module. The `_chartHoverPct` field is intentionally writable: hover handlers defined here mutate it
//on pointermove / pointerleave, exactly like the dashboard's `_dashChartHoverTs`. All other fields stay read-only.
export interface ChartHost
{
    readonly config:        HeliosConfig | undefined;
    readonly hass:          any;
    readonly _timeRange:    { start: Date; end: Date } | null;
    readonly _chartSeries:  ChartSeries | null;
    readonly _pvHistory:    PvHistory | null;
    //Recorder `change` series for the solar energy meter(s), 5-minute buckets. Used to sum exact
    //per-day produced kWh (sumChangeForDay) so the daily totals match the HA Energy dashboard to the
    //watt-hour instead of drifting from the integrated, gap-interpolated curve.
    readonly _pvChangeSeries: ChangeBucket[] | null;
    //Per-entity histories preserved alongside the aggregated `_pvHistory` so the chart can render one curve per
    //source and the scrub tooltip can show a per-source breakdown next to the summed value. Single-source installs
    //carry a single entry equal to the aggregate; multi-source installs carry one entry per HA Energy source.
    readonly _pvHistoryPerEntity: Map<string, PvHistory>;
    //Hourly long-term-statistics series feeding the 5-day forecast calibration. `calibration.ts` prefers this over `_pvHistory` because it
    //carries the same 5-day window with two orders of magnitude fewer rows on high-frequency installs. Null while the stats fetch is in
    //flight, or empty when the entity is not LTS-tracked, in both cases the consumer degrades to `_pvHistory`.
    readonly _pvCalibStats:   PvHistory | null;
    readonly _pvUnit:       string;
    readonly _selectedTime: Date | null;
    readonly _isLiveMode:   boolean;
    //HA Energy daily-total alignment: today's produced kWh as queried
    //from the recorder `change` statistic on every `stat_energy_from`
    //array, so the scrub tooltip lands on the same figure the dashboard
    //chip shows. Null when not configured or before the first recorder
    //call lands, in which case the tooltip falls back to the local
    //trapezoidal integration over `_pvHistory`.
    readonly _haSolarTodayKwh?: number | null;
    //Mutable hover-cursor position as a percent inside the visible
    //time range (0..100), null when no hover is active. Written by
    //the pointer handlers defined below.
    _chartHoverPct:         number | null;
    //Exposed so the PV predictor inside the chart layer can pull
    //the loaded LiDAR raster for the per-array shading raycast.
    //Optional because the chart still renders fine without the
    //engine reference (shading just falls back to "no obstacle").
    readonly _engine?:      { getLidarRaster(): import('../engine/pv-shading').NdsmRaster | null };
    //Unified 5-day data source, single point of truth for the production + forecast curves the
    //timeline + radial + dashboard charts read from. Null only between mount and the first build,
    //the chart degrades to an empty curve until then.
    readonly _unifiedStore: import('./unifiedStore').UnifiedDataStore | null;
    //Battery state-of-charge history over the active range (times + %). Drives the 'battery-soc' chart
    //target, read directly here because the store only carries a live SoC sample at the current bucket.
    readonly _batterySocHistory: { times: Date[]; values: number[] } | null;
    //Active bottom-chart target. Drives which series renderBottomChart draws; defaults to 'production'.
    readonly _chartTarget?: ChartTarget;
}


//Linear-interpolate a series at a target absolute timestamp. The
//series is assumed strictly increasing in time. Targets outside
//the range clamp to the nearest endpoint; NaN slots break the
//interpolation, the caller then sees NaN and skips rendering.
//Used by the hover tooltip + dot positions across the irradiance,
//cloud and PV curves so all three readouts share the same
//interpolation contract.
export function interpAt(times: Date[], values: number[], targetMs: number): number
{
    const n = Math.min(times.length, values.length);
    if (n === 0)
    {
        return NaN;
    }
    if (targetMs <= times[0].getTime())
    {
        return isFinite(values[0]) ? values[0] : NaN;
    }
    if (targetMs >= times[n - 1].getTime())
    {
        const v = values[n - 1];
        return isFinite(v) ? v : NaN;
    }
    //Binary search over the monotonically ascending `times` array. The early returns above already handled the
    //out-of-range cases, so here we know times[0] < targetMs < times[n - 1] and we narrow lo/hi to the bracketing
    //pair in O(log n). The previous linear scan walked from index 1 on every render, hot on 1 Hz sensors where
    //`_pvHistory` reaches ~21,600 entries over a 6 h window and the tooltip re-runs interpAt twice per render.
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1)
    {
        const mid = (lo + hi) >> 1;
        if (times[mid].getTime() <= targetMs)
        {
            lo = mid;
        }
        else
        {
            hi = mid;
        }
    }
    const t0 = times[lo].getTime();
    const t1 = times[hi].getTime();
    const v0 = values[lo];
    const v1 = values[hi];
    if (!isFinite(v0) || !isFinite(v1))
    {
        return NaN;
    }
    const dt = t1 - t0;
    if (dt <= 0)
    {
        return v1;
    }
    return v0 + (v1 - v0) * (targetMs - t0) / dt;
}


//Hover-cursor pointer handlers. Attached on each chart card; the
//card's bounding rect drives the fractional X conversion. A press
//(e.buttons !== 0) clears the hover so a scrub drag never leaves
//a stale dot behind: the scrub interaction itself lives on the
//time-bar pointerdown above us, and once it captures the pointer
//our pointermove no longer fires until release.
export function handleChartHoverMove(host: ChartHost, e: PointerEvent): void
{
    if (e.buttons !== 0)
    {
        host._chartHoverPct = null;
        return;
    }
    const card = e.currentTarget as HTMLElement | null;
    if (!card)
    {
        return;
    }
    const rect = card.getBoundingClientRect();
    if (rect.width <= 0)
    {
        return;
    }
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    host._chartHoverPct = frac * 100;
}


export function handleChartHoverLeave(host: ChartHost): void
{
    host._chartHoverPct = null;
}


//Render the optional photovoltaic production graph that sits
//above the main timeline chart. Same X axis as the main chart
//(time range pulled from host._timeRange) so day boundaries and
//the scrub cursor line up vertically across both blocks. The
//curve is plotted from host._pvHistory (fetched via the HA
//history WebSocket command); future data is intentionally left
//blank, the curve naturally stops at the last recorded sample
//since there's no production data after "now".
export function renderPvChart(host: ChartHost): TemplateResult
{
    const range = host._timeRange;
    const hist  = host._pvHistory;
    const W     = 1000;
    const H     = 100;

    if (!range)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
    }

    const startMs = range.start.getTime();
    const rangeMs = range.end.getTime() - startMs;
    if (rangeMs <= 0)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
    }

    const pvColor = DEFAULT_PV_COLOR_HEX;
    //Theme-aware "predicted" PV shade for the dashed forecast curve
    //overlay: light theme blends pvColor toward BLACK so it stays
    //readable on a white card; dark theme blends toward WHITE so it
    //still reads as a softer line on the dark plate. Mirrors the
    //dashboard's predictedColor logic.
    const isDarkTheme       = !!(host.hass as { themes?: { darkMode?: boolean } } | undefined)?.themes?.darkMode;
    const predictedPvColor  = isDarkTheme
        ? lerpHexToward(pvColor, '#ffffff', 0.55)
        : lerpHexToward(pvColor, '#000000', 0.35);

    //Day-boundary X positions from the shared timeline model, same source as the weather chart so the
    //dotted separators line up across the two. Bounded to <= 40 entries; empty on wide spans.
    const endMsAbs = range.end.getTime();
    const dayXs = buildTimelineModel(range.start, range.end).dayBoundaries.map(frac => frac * W);

    //Single-source read: the unified data source (src/card/unifiedStore.ts) carries the production
    //series for the full J-2 to J+2 window in watts, interpolated linearly between real samples,
    //never mixed with the forecast model. sliceForRange returns one sample per DISPLAY bucket within
    //the visible window. Empty when the source isn't built yet (first paint), the chart renders the
    //empty frame in that case.
    const lu = (host._pvUnit || '').toLowerCase();
    const isCumulativeEnergy = lu === 'wh' || lu === 'kwh' || lu === 'mwh';
    //Reference the cumulative-detection flag so the unused-variable warning stays silent (the
    //branch lives in the legacy code path now, the store handles cumulative->W internally).
    void isCumulativeEnergy;
    void hist;
    const store = host._unifiedStore;
    const rangeSlice = store ? sliceForRange(store, startMs, endMsAbs) : null;

    const xOf = (t: Date): number =>
        ((t.getTime() - startMs) / rangeMs) * W;

    //Observed samples are in the entity's native power unit
    //(kW / W / MW for a power entity, or differentiated to that
    //unit / hour for a cumulative-energy entity). Calibration k
    //is "W per percent of STC", so a raw `pct * k` predicted
    //value is in WATTS. Mixing units on the same Y axis would
    //flatten the observed curve into invisibility when the
    //entity is in kW and the predicted is in W (yMax pegged to
    //thousands while observed sits at single digits). Compute
    //the W → native scale once and apply it to the predicted
    //series so both feed yMax on the same axis.
    const nativeFromW = (() => {
        const native = isCumulativeEnergy
            ? (lu === 'kwh' ? 'kw' : lu === 'mwh' ? 'mw' : lu === 'wh' ? 'w' : '')
            : lu;
        if (native === 'kw')
        {
            return 1 / 1000;
        }
        if (native === 'mw')
        {
            return 1 / 1_000_000;
        }
        return 1;
    })();

    //Production samples: read from the data source in watts, multiplied by nativeFromW so the value
    //feeds the Y axis on the same scale the entity's native unit uses (rest of the chart still draws
    //in native units, the data source is the single conversion point).
    const samples: Array<{ t: Date; v: number }> = [];
    if (rangeSlice)
    {
        for (let i = 0; i < rangeSlice.times.length; i++)
        {
            const v = rangeSlice.production[i];
            if (v === null || !isFinite(v)) { continue; }
            samples.push({ t: rangeSlice.times[i], v: v * nativeFromW });
        }
    }

    //Forecast curve: same source, same unit conversion. The forecast series in the store already
    //carries the cap-clipped, calibration-applied, shading-aware watts at every DISPLAY bucket. No
    //local computePvPowerWeighted loop here, the data source is the single point of truth.
    const predictedSamples: Array<{ t: Date; v: number }> = [];
    if (rangeSlice)
    {
        for (let i = 0; i < rangeSlice.times.length; i++)
        {
            const v = rangeSlice.forecast[i];
            if (v === null || !isFinite(v) || v <= 0) { continue; }
            predictedSamples.push({ t: rangeSlice.times[i], v: v * nativeFromW });
        }
    }

    //Auto-scale: the Y axis maps 0 to the bottom edge and the
    //series' running max to the top edge. With a min of 1 we
    //avoid division-by-zero when the series is all-zero (early
    //morning, prolonged outage) and keep the curve visibly
    //pinned to the baseline rather than silently disappearing.
    //Predicted samples also feed into yMax so the forecast line
    //doesn't clip when expected production exceeds anything
    //the user has produced lately.
    let yMax = 1;
    for (const s of samples)          { if (s.v > yMax) yMax = s.v; }
    for (const s of predictedSamples) { if (s.v > yMax) yMax = s.v; }
    //Leave a sliver of headroom at the top so the production / forecast peak never kisses the top edge.
    const TOP_HEADROOM_PX = 10;
    const yOf = (v: number): number =>
        H - Math.max(0, Math.min(1, v / yMax)) * (H - TOP_HEADROOM_PX);

    const points = samples.map(s =>
        `${xOf(s.t).toFixed(2)},${yOf(s.v).toFixed(2)}`);

    let area  = '';
    let line  = '';
    if (points.length >= 2)
    {
        const x0 = xOf(samples[0].t);
        const xN = xOf(samples[samples.length - 1].t);
        area = `M ${x0},${H} L ${points.join(' L ')} L ${xN},${H} Z`;
        line = `M ${points.join(' L ')}`;
    }

    //Per-source curves. One light polyline per HA Energy source, drawn UNDER the aggregate line so the eye reads the
    //total as the dominant trace and the breakdown as background context. Hue rotates around the theme PV colour so
    //a split E / W lands on opposite hues; the same colour shows up in the tooltip pastille for the matching row,
    //giving the user a row ↔ curve visual link. Skipped on single-source installs where the per-entity map carries
    //one entry equal to the aggregate (drawing it would just paint a duplicate trace at lower opacity under the
    //headline curve). The per-entity series uses the same cumulative-differentiation rule as the aggregate path so
    //a 4 × stat_energy_from / no stat_rate setup paints as 4 power curves, not 4 monotonically climbing kWh ramps.
    const perEntityIdsForCurves = host._pvHistoryPerEntity.size > 1
        ? Array.from(host._pvHistoryPerEntity.keys()).sort()
        : [];
    const perEntityCurves: Array<{ id: string; line: string; color: string }> = [];
    for (let idx = 0; idx < perEntityIdsForCurves.length; idx++)
    {
        const id = perEntityIdsForCurves[idx];
        const ph = host._pvHistoryPerEntity.get(id);
        if (!ph)
        {
            continue;
        }
        let eTimes:  Date[]   = ph.times;
        let eValues: number[] = ph.values;
        if (isCumulativeEnergy && eTimes.length >= 2)
        {
            const MIN_DTH = 0.05;
            const dT: Date[]   = [];
            const dV: number[] = [];
            let prevIdx = 0;
            for (let i = 1; i < eTimes.length; i++)
            {
                const dtH = (eTimes[i].getTime() - eTimes[prevIdx].getTime()) / 3_600_000;
                if (dtH <= 0)
                {
                    continue;
                }
                if (dtH > 6)
                {
                    prevIdx = i;
                    continue;
                }
                const dv = eValues[i] - eValues[prevIdx];
                if (dv < 0)
                {
                    prevIdx = i;
                    continue;
                }
                if (dtH < MIN_DTH)
                {
                    continue;
                }
                dT.push(eTimes[i]);
                dV.push(dv / dtH);
                prevIdx = i;
            }
            eTimes  = dT;
            eValues = dV;
        }
        const ePoints: string[] = [];
        //Lighter decimation than the aggregate: per-entity curves are background context, half the resolution is
        //plenty and keeps the SVG path strings short on 4-source / 1 Hz installs (4 × 750 points stays under the
        //browser path limit).
        const stride = Math.max(1, Math.floor(eTimes.length / 750));
        for (let i = 0; i < eTimes.length; i += stride)
        {
            const t = eTimes[i];
            const v = eValues[i];
            const tMs = t.getTime();
            if (tMs < startMs || tMs > endMsAbs)
            {
                continue;
            }
            if (!isFinite(v))
            {
                continue;
            }
            ePoints.push(`${xOf(t).toFixed(2)},${yOf(v).toFixed(2)}`);
        }
        if (ePoints.length < 2)
        {
            continue;
        }
        perEntityCurves.push({
            id,
            line:  `M ${ePoints.join(' L ')}`,
            color: pvSourceColor(idx, perEntityIdsForCurves.length),
        });
    }

    let predictedLine = '';
    if (predictedSamples.length >= 2)
    {
        const pPoints = predictedSamples.map(s =>
            `${xOf(s.t).toFixed(2)},${yOf(s.v).toFixed(2)}`);
        predictedLine = `M ${pPoints.join(' L ')}`;
    }

    //Hover dot, drawn at the interpolated PV value at hover time.
    //Observed samples win; if there's no observed value at that
    //instant (future, gap, outage), fall back to the predicted
    //series so the dot keeps tracking. Same Y axis as the curve
    //it rides on, so the dot reads as "this is where the curve
    //sits at that moment" rather than free-floating.
    const hoverPct = host._chartHoverPct;
    let hoverX:     number = 0;
    let hoverY:     number = NaN;
    let hoverYPred: number = NaN;
    let showHover = false;
    if (hoverPct !== null && hoverPct >= 0 && hoverPct <= 100)
    {
        hoverX = (hoverPct / 100) * W;
        const hoverMs = startMs + (hoverPct / 100) * rangeMs;
        //Observed curve: only inside the observed window, else interpAt clamps to the last reading and
        //the dot freezes on yesterday's late-afternoon value when hovering tomorrow. Forecast curve:
        //wherever it has a value, so on the production part the user sees BOTH the production dot AND the
        //forecast dot riding their own curves, not just one.
        const lastObsMs = samples.length > 0
            ? samples[samples.length - 1].t.getTime()
            : -Infinity;
        if (samples.length >= 1 && hoverMs <= lastObsMs)
        {
            const a = interpAt(samples.map(s => s.t), samples.map(s => s.v), hoverMs);
            //Floor at zero: a net meter can dip below zero at dawn/dusk; the dot still rides the curve.
            if (isFinite(a)) { hoverY = yOf(Math.max(0, a)); }
        }
        if (predictedSamples.length >= 1)
        {
            const p = interpAt(predictedSamples.map(s => s.t), predictedSamples.map(s => s.v), hoverMs);
            if (isFinite(p)) { hoverYPred = yOf(Math.max(0, p)); }
        }
        showHover = isFinite(hoverY) || isFinite(hoverYPred);
    }

    return html`
        <svg
            class="hc-chart-svg"
            viewBox="0 0 ${W} ${H}"
            preserveAspectRatio="none"
        >
            ${dayXs.map(x => svg`
                <line
                    class="hc-day-sep"
                    x1="${x.toFixed(2)}" y1="0"
                    x2="${x.toFixed(2)}" y2="${H}"
                ></line>
            `)}
            <g class="hc-chart-grow">
                ${area ? svg`
                    <path
                        d="${area}"
                        fill="${pvColor}"
                        fill-opacity="0.25"
                    ></path>
                ` : nothing}
                ${perEntityCurves.map(c => svg`
                    <path
                        class="hc-chart-line hc-chart-line-source"
                        d="${c.line}"
                        stroke="${c.color}"
                    ></path>
                `)}
                ${line ? svg`
                    <path
                        class="hc-chart-line"
                        d="${line}"
                        stroke="${pvColor}"
                    ></path>
                ` : nothing}
                ${predictedLine ? svg`
                    <path
                        class="hc-chart-line hc-chart-predicted"
                        d="${predictedLine}"
                        stroke="${predictedPvColor}"
                    ></path>
                ` : nothing}
            </g>
            ${showHover ? svg`
                <line
                    class="hc-hover-guide"
                    x1="${hoverX.toFixed(2)}" y1="0"
                    x2="${hoverX.toFixed(2)}" y2="${H}"
                ></line>
            ` : nothing}
        </svg>
        ${showHover && isFinite(hoverY) ? html`
            <div class="hc-hover-dot-html" style="left: ${(hoverX / W * 100).toFixed(2)}%; top: ${(hoverY / H * 100).toFixed(2)}%; background: ${pvColor};"></div>
        ` : nothing}
        ${showHover && isFinite(hoverYPred) ? html`
            <div class="hc-hover-dot-html" style="left: ${(hoverX / W * 100).toFixed(2)}%; top: ${(hoverYPred / H * 100).toFixed(2)}%; background: ${predictedPvColor};"></div>
        ` : nothing}
    `;
}


//Re-targetable bottom chart. Production keeps its dedicated renderer (forecast + per-source breakdown +
//native-unit scaling); grid / battery / irradiance go through the generic renderer below. One chart, the
//active target decides what it shows, matching the HA energy-solar-overview card.
export function renderBottomChart(host: ChartHost): TemplateResult
{
    const target = host._chartTarget ?? 'production';
    if (target === 'production')
    {
        return renderPvChart(host);
    }
    return renderTargetChart(host, target);
}


//Accent colour for the active chart target: the colour the chart border and the active chip share, so
//re-targeting reads as one coupled gesture (same as the HA card). Production / irradiance are fixed;
//grid / battery take the dominant side over the visible window.
export function chartAccentColor(host: ChartHost): string
{
    const target = host._chartTarget ?? 'production';
    if (target === 'production') { return DEFAULT_PV_COLOR_HEX; }
    if (target === 'irradiance') { return DEFAULT_SUN_COLOR_HEX; }
    if (target === 'cloud')      { return DEFAULT_CLOUD_COLOR_HEX; }
    if (target === 'battery-soc'){ return DEFAULT_BATTERY_OUT_COLOR_HEX; }
    const store = host._unifiedStore;
    const range = host._timeRange;
    if (!store || !range)
    {
        return target === 'grid' ? DEFAULT_GRID_IMPORT_COLOR_HEX : DEFAULT_BATTERY_OUT_COLOR_HEX;
    }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    const sumArr = (arr: ReadonlyArray<number | null>, map?: (v: number) => number): number =>
    {
        let s = 0;
        for (let i = 0; i < arr.length; i++)
        {
            const raw = arr[i];
            if (raw === null || !isFinite(raw)) { continue; }
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs < startMs || tMs > endMs) { continue; }
            s += map ? map(raw) : raw;
        }
        return s;
    };
    if (target === 'grid')
    {
        return sumArr(store.gridImport) >= sumArr(store.gridExport)
            ? DEFAULT_GRID_IMPORT_COLOR_HEX
            : DEFAULT_GRID_EXPORT_COLOR_HEX;
    }
    return sumArr(store.battery, v => Math.max(0, v)) >= sumArr(store.battery, v => Math.max(0, -v))
        ? DEFAULT_BATTERY_IN_COLOR_HEX
        : DEFAULT_BATTERY_OUT_COLOR_HEX;
}


//Generic chart for the non-production targets, all read from the unified store. Grid + battery draw two
//directional series each (accent = the dominant side over the window); irradiance draws one curve on a
//fixed 0..1000 W/m² scale. Power series stay in watts (the tooltip formats to kW), so no per-entity
//native-unit handling here, that stays in renderPvChart for production only.
function renderTargetChart(host: ChartHost, target: Exclude<ChartTarget, 'production'>): TemplateResult
{
    const store = host._unifiedStore;
    const range = host._timeRange;
    const W = 1000;
    const H = 100;
    if (!store || !range)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
    }
    const startMs  = range.start.getTime();
    const endMsAbs = range.end.getTime();
    const rangeMs  = endMsAbs - startMs;
    if (rangeMs <= 0)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
    }
    const xOf = (tMs: number): number => ((tMs - startMs) / rangeMs) * W;

    //Map a store series (aligned on the store buckets) to visible-range points, dropping nulls and
    //clipping to the timeline window. Bucket centre matches sliceForRange so curves line up with the
    //production chart's day separators.
    const toPts = (arr: ReadonlyArray<number | null>, map?: (v: number) => number): Array<{ t: number; v: number }> =>
    {
        const out: Array<{ t: number; v: number }> = [];
        for (let i = 0; i < arr.length; i++)
        {
            const raw = arr[i];
            if (raw === null || !isFinite(raw)) { continue; }
            const tMs = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (tMs < startMs || tMs > endMsAbs) { continue; }
            out.push({ t: tMs, v: map ? map(raw) : raw });
        }
        return out;
    };
    const sum = (pts: Array<{ v: number }>): number => pts.reduce((a, p) => a + p.v, 0);

    type Line = { pts: Array<{ t: number; v: number }>; color: string };
    let series: Line[];
    let fixedMax = 0;
    if (target === 'grid')
    {
        const imp = toPts(store.gridImport);
        const exp = toPts(store.gridExport);
        series = [
            { pts: imp, color: DEFAULT_GRID_IMPORT_COLOR_HEX },
            { pts: exp, color: DEFAULT_GRID_EXPORT_COLOR_HEX },
        ];
    }
    else if (target === 'battery')
    {
        //Store battery is signed net power (charge - discharge). Split into two non-negative curves so
        //charging and discharging read as distinct flows, each zero while the other is active.
        const charge    = toPts(store.battery, v => Math.max(0, v));
        const discharge = toPts(store.battery, v => Math.max(0, -v));
        series = [
            { pts: charge,    color: DEFAULT_BATTERY_IN_COLOR_HEX },
            { pts: discharge, color: DEFAULT_BATTERY_OUT_COLOR_HEX },
        ];
    }
    else if (target === 'battery-soc')
    {
        //Battery state-of-charge over the window, read straight from the fetched SoC history (the store
        //only carries a live SoC sample at the current bucket). One curve on a fixed 0..100 % scale.
        const hist = host._batterySocHistory;
        const pts: Array<{ t: number; v: number }> = [];
        if (hist)
        {
            for (let i = 0; i < hist.times.length; i++)
            {
                const tMs = hist.times[i].getTime();
                if (tMs < startMs || tMs > endMsAbs) { continue; }
                const v = hist.values[i];
                if (v === undefined || !isFinite(v)) { continue; }
                pts.push({ t: tMs, v });
            }
        }
        series   = [{ pts, color: DEFAULT_BATTERY_OUT_COLOR_HEX }];
        fixedMax = 100;
    }
    else if (target === 'cloud')
    {
        //Cloud-cover bands read from the hourly weather series (not the bucketed store): low / mid / high
        //altitude layers on a fixed 0..100 % scale, in light -> dark cloud-grey shades.
        const cs = host._chartSeries;
        const csPts = (arr: ReadonlyArray<number>): Array<{ t: number; v: number }> =>
        {
            if (!cs) { return []; }
            const out: Array<{ t: number; v: number }> = [];
            for (let i = 0; i < cs.times.length; i++)
            {
                const tMs = cs.times[i].getTime();
                if (tMs < startMs || tMs > endMsAbs) { continue; }
                const v = arr[i];
                if (v === undefined || !isFinite(v)) { continue; }
                out.push({ t: tMs, v });
            }
            return out;
        };
        series = [
            { pts: csPts(cs?.cloudLow  ?? []), color: lerpHexToward(DEFAULT_CLOUD_COLOR_HEX, '#ffffff', 0.35) },
            { pts: csPts(cs?.cloudMid  ?? []), color: DEFAULT_CLOUD_COLOR_HEX },
            { pts: csPts(cs?.cloudHigh ?? []), color: lerpHexToward(DEFAULT_CLOUD_COLOR_HEX, '#000000', 0.30) },
        ];
        fixedMax = 100;
    }
    else
    {
        series   = [{ pts: toPts(store.irradiance), color: DEFAULT_SUN_COLOR_HEX }];
        fixedMax = 1000;
    }

    //Y scale: fixed for irradiance, else auto to the running max across both series (min 1 to avoid a
    //flat-line divide-by-zero on an all-zero window).
    let yMax = fixedMax;
    if (yMax <= 0)
    {
        yMax = 1;
        for (const s of series) { for (const p of s.pts) { if (p.v > yMax) { yMax = p.v; } } }
    }
    //Leave a sliver of headroom at the top so a curve's peak never kisses the timeline's top edge.
    const TOP_HEADROOM_PX = 10;
    const yOf = (v: number): number => H - Math.max(0, Math.min(1, v / yMax)) * (H - TOP_HEADROOM_PX);

    const drawn = series.map(s =>
    {
        if (s.pts.length < 2) { return { area: '', line: '', color: s.color, total: sum(s.pts) }; }
        const pp = s.pts.map(p => `${xOf(p.t).toFixed(2)},${yOf(p.v).toFixed(2)}`);
        const x0 = xOf(s.pts[0].t);
        const xN = xOf(s.pts[s.pts.length - 1].t);
        return {
            area:  `M ${x0},${H} L ${pp.join(' L ')} L ${xN},${H} Z`,
            line:  `M ${pp.join(' L ')}`,
            color: s.color,
            total: sum(s.pts),
        };
    });

    //Day separators from the shared timeline model (bounded, empty on wide spans).
    const dayXs = buildTimelineModel(range.start, range.end).dayBoundaries.map(frac => frac * W);

    //Hover guide + one dot per series, interpolated at the hover instant.
    const hoverPct = host._chartHoverPct;
    let hoverX     = 0;
    let showHover  = false;
    const hoverDots: Array<{ y: number; color: string }> = [];
    if (hoverPct !== null && hoverPct >= 0 && hoverPct <= 100)
    {
        hoverX = (hoverPct / 100) * W;
        const hoverMs = startMs + (hoverPct / 100) * rangeMs;
        for (const s of series)
        {
            if (s.pts.length < 1) { continue; }
            const v = interpAt(s.pts.map(p => new Date(p.t)), s.pts.map(p => p.v), hoverMs);
            if (isFinite(v))
            {
                hoverDots.push({ y: yOf(Math.max(0, v)), color: s.color });
                showHover = true;
            }
        }
    }

    return html`
        <svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            ${dayXs.map(x => svg`
                <line class="hc-day-sep" x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${H}"></line>
            `)}
            <g class="hc-chart-grow">
                ${drawn.map(d => d.area ? svg`
                    <path d="${d.area}" fill="${d.color}" fill-opacity="0.22"></path>
                ` : nothing)}
                ${drawn.map(d => d.line ? svg`
                    <path class="hc-chart-line" d="${d.line}" stroke="${d.color}"></path>
                ` : nothing)}
            </g>
            ${showHover ? svg`
                <line class="hc-hover-guide" x1="${hoverX.toFixed(2)}" y1="0" x2="${hoverX.toFixed(2)}" y2="${H}"></line>
            ` : nothing}
        </svg>
        ${hoverDots.map(d => html`
            <div class="hc-hover-dot-html" style="left: ${(hoverX / W * 100).toFixed(2)}%; top: ${(d.y / H * 100).toFixed(2)}%; background: ${d.color};"></div>
        `)}
    `;
}


//The thin track now carries only the cursors. Day
//separators live inside the chart card SVG (dotted vertical
//lines) and the scrub time label has been promoted to a chip
//above the chart card.
export function renderTimelineTicks(host: ChartHost): TemplateResult
{
    if (!host._timeRange)
    {
        return html``;
    }

    const { start, end } = host._timeRange;
    const rangeMs = end.getTime() - start.getTime();
    const now     = new Date();
    const toPct   = (d: Date): number =>
        Math.max(0, Math.min(100, (d.getTime() - start.getTime()) / rangeMs * 100));

    const nowPct        = toPct(now);
    const showSelected  = !host._isLiveMode && host._selectedTime !== null;
    const selPct        = showSelected ? toPct(host._selectedTime!) : 0;

    return html`
        <div class="tb-cursor-now" style="left:${nowPct}%"></div>
        ${showSelected ? html`
            <div class="tb-cursor-sel" style="left:${selPct}%"></div>
        ` : nothing}
    `;
}


//Adaptive timeline labels overlaying the chart-card footer line. The shared timeline model picks the
//granularity from the visible span (hours for a single day, weekday names for a week, day + short month
//for a month-plus, month names beyond that) and thins the count, so a wide window stays legible instead
//of stamping one chip per day. Each label sits at its model fraction; in the day view today's label is
//emphasised, matching the now-cursor. Separators draw the matching boundary lines.
export function renderTimelineDayLabels(host: ChartHost): TemplateResult
{
    if (!host._timeRange)
    {
        return html``;
    }

    const { start, end } = host._timeRange;
    const model  = buildTimelineModel(start, end);
    //Drop entries hugging the window edges so they never collide with the card corners.
    const labels = model.labels.filter(s => s.frac > 0.02 && s.frac < 0.98);
    const seps   = model.separators.filter(s => s.frac > 0.02 && s.frac < 0.98);

    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    //Emphasise today only in the day view, where each label names one calendar day; on the wider spans
    //the now-cursor already marks the present and a single highlighted weekday/month would read oddly.
    const isTodayLabel = (d: Date): boolean =>
        model.kind === 'days' && d.getTime() === today0.getTime();

    return html`
        <div class="tb-day-strip">
            ${seps.map(s => html`
                <div class="tb-day-strip-sep" style="left:${(s.frac * 100).toFixed(2)}%"></div>
            `)}
            ${labels.map(s => html`
                <span
                    class="tb-day-strip-date ${isTodayLabel(s.date) ? 'is-today' : ''}"
                    style="left:${(s.frac * 100).toFixed(2)}%"
                >${formatTimelineLabel(model.kind, s.date, host.hass)}</span>
            `)}
        </div>
    `;
}



//Compute kWh-per-day totals over the active timeline range. The helper integrates two sources:
//
//  - Past + today-so-far: sum of the observed PV history (from
//    `_pvHistory`), respecting the entity's unit (W/kW power
//    sensors are integrated by trapezoidal rule; cumulative
//    energy sensors are differenced and summed).
//  - Today-remainder + future: integration of the kWp × clear-
//    sky × cloud model, hour by hour, using the engine's
//    weather series.
//
//Returns a Map keyed by each day's local-midnight ms, with values in kWh. Days that fall outside the active range or carry no usable data are
//omitted.
export function computeDailyKwhTotals(host: ChartHost): Map<number, number>
{
    const out = new Map<number, number>();
    if (!host._timeRange)
    {
        return out;
    }
    const { start, end } = host._timeRange;
    const startMs  = start.getTime();
    const endMsAbs = end.getTime();

    const dayKey = (ms: number): number =>
    {
        const d = new Date(ms);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    };

    //Pass 1: past + today-so-far, summed directly from the recorder `change` buckets per day so each
    //day's produced kWh matches the HA Energy dashboard to the watt-hour. No curve integration, no gap
    //interpolation (which was inflating the totals a percent or two above HA). The change series spans
    //the store's J-2 past window, which covers every past day the timeline can show.
    const changeSeries = host._pvChangeSeries;
    if (changeSeries && changeSeries.length > 0)
    {
        const cursor = new Date(startMs);
        cursor.setHours(0, 0, 0, 0);
        while (cursor.getTime() < endMsAbs)
        {
            const ds   = cursor.getTime();
            const next = new Date(cursor);
            next.setDate(next.getDate() + 1);
            const kwh = sumChangeForDay(changeSeries, ds, next.getTime());
            if (kwh !== null)
            {
                out.set(ds, Math.max(0, kwh));
            }
            cursor.setTime(next.getTime());
        }
    }

    //Pass 2: future + today-remainder from the unified store's CORRECTED forecast, the same series the
    //dotted timeline curve draws and the dashboard "affiné" headline integrates, so the per-day chips
    //agree with the curve next to them. Only buckets at / after "now" contribute (past is Pass 1's real
    //production); the store forecast is already cap-clipped and correction-applied.
    const store = host._unifiedStore;
    if (store)
    {
        const nowMs = Date.now();
        const stepH = store.stepMs / 3_600_000;   //bucket length in hours
        for (let i = 0; i < store.bucketsTotal; i++)
        {
            const mid = store.storeStartMs + (i + 0.5) * store.stepMs;
            if (mid < startMs || mid > endMsAbs) { continue; }
            if (mid < nowMs) { continue; }   //past covered by Pass 1
            const w = store.forecast[i];
            if (w === null || !isFinite(w) || w <= 0) { continue; }
            const dk = dayKey(mid);
            out.set(dk, (out.get(dk) ?? 0) + w * stepH / 1000);
        }
    }

    return out;
}
