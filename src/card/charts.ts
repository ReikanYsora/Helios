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
    DEFAULT_PV_COLOR_HEX
} from '../helios-config';
import { formatDate, formatLocalisedNumber, lerpHexToward } from './format';
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
//positioned div per night interval, filled with a diagonal hatch
//pattern. The divs are inserted inside the chart card so they
//inherit the card's relative positioning + overflow clipping;
//z-index lifts them above the SVG curves (which paint as flow
//content) but stays below the live + scrub cursors (z-index 4).
//The result reads as "this stretch of timeline is night", with
//the underlying curves still legible through the low-alpha
//diagonals.
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
            const v = interpAt(calib.times, calib.values, targetMs);
            if (isFinite(v))
            {
                return { value: Math.max(0, v), unit: displayUnit, isPredicted: false };
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
    const cldV = series ? interpAt(series.times, series.cloud,      atMs) : NaN;
    const pv   = pvValueAtTime(host, atMs);

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
                ${isFinite(irrV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" icon="mdi:white-balance-sunny"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, irrV))} W/m²</span>
                    </div>
                ` : nothing}
                ${isFinite(cldV) ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" icon="mdi:cloud-outline"></ha-icon>
                        <span class="tb-hover-tooltip-value">${Math.round(Math.max(0, Math.min(100, cldV)))} %</span>
                    </div>
                ` : nothing}
                ${hasPv ? html`
                    <div class="tb-hover-tooltip-row">
                        <ha-icon class="tb-hover-tooltip-icon" icon="mdi:solar-power"></ha-icon>
                        <span class="tb-hover-tooltip-value">${formatLocalisedNumber(host.hass, pv.value, pvDecimals)} ${pv.unit}</span>
                    </div>
                ` : nothing}
                ${perEntityRows.map(row => html`
                    <div class="tb-hover-tooltip-row tb-hover-tooltip-row-sub">
                        <span class="tb-hover-tooltip-dot" style="background:${pvSourceColor(row.colorIdx, perEntityIds.length)}"></span>
                        <span class="tb-hover-tooltip-sublabel">${row.label}</span>
                        <span class="tb-hover-tooltip-value">${row.valueText}</span>
                    </div>
                `)}
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


//Single-baseline "irradiance + cloud" SVG chart sitting above the
//timeline. Both curves share the bottom edge as zero and grow
//upward: 1000 W/m² and 100 % cloud cover both touch the top edge.
//Irradiance is drawn on top with a semi-opaque sun-colour fill;
//cloud fills the area below it in the configured cloud colour with
//lower opacity so the two curves coexist instead of competing for
//pixel rows. This replaces the older "sun pushes up / clouds press
//down" mirror layout, where the cloud area grew downward from the
//midline; the new layout keeps the same vertical real estate but
//is easier to read at a glance because both axes share an origin.
export function renderChart(host: ChartHost): TemplateResult
{
    const series = host._chartSeries;
    const range  = host._timeRange;
    if (!series || !range || series.times.length < 2)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 1000 100" preserveAspectRatio="none"></svg>`;
    }

    const W      = 1000;
    const H      = 100;
    //Shared bottom baseline; both curves grow upward from y = H to
    //y = 0. No midline split anymore.
    const BASE   = H;

    const startMs = range.start.getTime();
    const rangeMs = range.end.getTime() - startMs;
    if (rangeMs <= 0)
    {
        return html`<svg class="hc-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"></svg>`;
    }

    const xOf = (t: Date): number =>
        ((t.getTime() - startMs) / rangeMs) * W;

    //Irradiance Y: 0 W/m² sits on the bottom edge, 1000 W/m² sits at the top edge. Anything above clamps to the top.
    const yIrr = (w: number): number =>
        BASE - Math.max(0, Math.min(1, w / 1000)) * H;

    //Cloud Y: 0 % sits on the bottom edge, 100 % sits at the top edge. Same orientation as irradiance now, so 'thicker cloud' reads as 'taller fill'
    //which matches a user's intuition.
    const yCloud = (pct: number): number =>
        BASE - Math.max(0, Math.min(1, pct / 100)) * H;

    const irrPoints = series.times.map((t, i) =>
        `${xOf(t).toFixed(2)},${yIrr(series.irradiance[i] ?? 0).toFixed(2)}`);
    const cloudPoints = series.times.map((t, i) =>
        `${xOf(t).toFixed(2)},${yCloud(series.cloud[i] ?? 0).toFixed(2)}`);

    //Both areas close back to the shared bottom baseline so the
    //fills always anchor to y = H regardless of the first / last
    //sample value.
    const x0 = xOf(series.times[0]);
    const xN = xOf(series.times[series.times.length - 1]);
    const irrArea = `M ${x0},${BASE} L ${irrPoints.join(' L ')} L ${xN},${BASE} Z`;
    const cloudArea = `M ${x0},${BASE} L ${cloudPoints.join(' L ')} L ${xN},${BASE} Z`;

    //Stroke-only paths layered on top of the filled areas to accentuate the curve outline. Same point sequence as the areas, minus the closing
    //segment back to the midline so we don't draw a horizontal line across the baseline.
    const irrLine   = `M ${irrPoints.join(' L ')}`;
    const cloudLine = `M ${cloudPoints.join(' L ')}`;

    const sunColor   = DEFAULT_SUN_COLOR_HEX;
    const cloudColor = DEFAULT_CLOUD_COLOR_HEX;

    //Hover dots + vertical guide. Both curves are interpolated at
    //the hover timestamp so the dots ride the curves exactly,
    //matching what the tooltip above the card reads out. NaN
    //returns (out of range / missing samples) skip the dot quietly.
    const hoverPct = host._chartHoverPct;
    let hoverX:     number = 0;
    let hoverYIrr:  number = NaN;
    let hoverYCld:  number = NaN;
    let showHover  = false;
    if (hoverPct !== null && hoverPct >= 0 && hoverPct <= 100)
    {
        hoverX = (hoverPct / 100) * W;
        const hoverMs = startMs + (hoverPct / 100) * rangeMs;
        const irrV    = interpAt(series.times, series.irradiance, hoverMs);
        const cldV    = interpAt(series.times, series.cloud,      hoverMs);
        if (isFinite(irrV))
        {
            hoverYIrr = yIrr(irrV);
        }
        if (isFinite(cldV))
        {
            hoverYCld = yCloud(cldV);
        }
        showHover = isFinite(hoverYIrr) || isFinite(hoverYCld);
    }

    //Day-boundary X positions in viewBox units (midnight of each
    //local day inside the time range). Drawn as faint dotted
    //vertical lines spanning the full chart height, same role
    //as the day chips on the midline, just visual separators.
    const startMsAbs = range.start.getTime();
    const endMsAbs   = range.end.getTime();
    const dayXs: number[] = [];
    const dCursor = new Date(range.start);
    dCursor.setHours(0, 0, 0, 0);
    while (dCursor.getTime() <= endMsAbs)
    {
        const next = new Date(dCursor);
        next.setDate(next.getDate() + 1);
        if (dCursor.getTime() > startMsAbs && dCursor.getTime() < endMsAbs)
        {
            dayXs.push(xOf(dCursor));
        }
        dCursor.setTime(next.getTime());
    }

    //Hour-boundary X positions, used to draw small vertical
    //ticks centred on the midline (one per hour). Midnights are
    //skipped, those already get a full-height day separator.
    const hourXs: number[] = [];
    const hCursor = new Date(range.start);
    hCursor.setMinutes(0, 0, 0);
    hCursor.setHours(hCursor.getHours() + 1);
    while (hCursor.getTime() <= endMsAbs)
    {
        if (hCursor.getTime() > startMsAbs && hCursor.getHours() !== 0)
        {
            hourXs.push(xOf(hCursor));
        }
        hCursor.setHours(hCursor.getHours() + 1);
    }
    const HOUR_TICK_HALF = 3;

    return html`
        <svg
            class="hc-chart-svg"
            viewBox="0 0 ${W} ${H}"
            preserveAspectRatio="none"
        >
            <!-- Cloud first as the background layer. Painted at a
                 higher alpha than the irradiance fill that sits on
                 top so the cloud curve stays readable through the
                 sun overlay; the irradiance fill keeps its lighter
                 0.25 alpha to avoid washing the cloud area out. -->
            <path
                d="${cloudArea}"
                fill="${cloudColor}"
                fill-opacity="0.45"
            ></path>
            <path
                d="${irrArea}"
                fill="${sunColor}"
                fill-opacity="0.25"
            ></path>
            <path
                class="hc-chart-line"
                d="${cloudLine}"
                stroke="${cloudColor}"
            ></path>
            <path
                class="hc-chart-line"
                d="${irrLine}"
                stroke="${sunColor}"
            ></path>
            ${dayXs.map(x => svg`
                <line
                    class="hc-day-sep"
                    x1="${x.toFixed(2)}" y1="0"
                    x2="${x.toFixed(2)}" y2="${H}"
                ></line>
            `)}
            ${hourXs.map(x => svg`
                <line
                    class="hc-hour-tick"
                    x1="${x.toFixed(2)}" y1="${H - HOUR_TICK_HALF * 2}"
                    x2="${x.toFixed(2)}" y2="${H}"
                ></line>
            `)}
            ${showHover ? svg`
                <line
                    class="hc-hover-guide"
                    x1="${hoverX.toFixed(2)}" y1="0"
                    x2="${hoverX.toFixed(2)}" y2="${H}"
                ></line>
            ` : nothing}
        </svg>
        ${showHover ? html`
            ${isFinite(hoverYCld) ? html`<div class="hc-hover-dot-html" style="left: ${(hoverX / W * 100).toFixed(2)}%; top: ${(hoverYCld / H * 100).toFixed(2)}%; background: ${cloudColor};"></div>` : nothing}
            ${isFinite(hoverYIrr) ? html`<div class="hc-hover-dot-html" style="left: ${(hoverX / W * 100).toFixed(2)}%; top: ${(hoverYIrr / H * 100).toFixed(2)}%; background: ${sunColor};"></div>` : nothing}
        ` : nothing}
    `;
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

    //Day-boundary X positions, same computation as the main chart so the dotted separators line up across the two.
    const endMsAbs = range.end.getTime();
    const dayXs: number[] = [];
    const dCursor = new Date(range.start);
    dCursor.setHours(0, 0, 0, 0);
    while (dCursor.getTime() <= endMsAbs)
    {
        const next = new Date(dCursor);
        next.setDate(next.getDate() + 1);
        if (dCursor.getTime() > startMs && dCursor.getTime() < endMsAbs)
        {
            dayXs.push(((dCursor.getTime() - startMs) / rangeMs) * W);
        }
        dCursor.setTime(next.getTime());
    }

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
    const yOf = (v: number): number =>
        H - Math.max(0, Math.min(1, v / yMax)) * H;

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
    let hoverX:    number = 0;
    let hoverY:    number = NaN;
    let showHover = false;
    if (hoverPct !== null && hoverPct >= 0 && hoverPct <= 100)
    {
        hoverX = (hoverPct / 100) * W;
        const hoverMs = startMs + (hoverPct / 100) * rangeMs;
        let hoverV: number = NaN;
        //Only sample the observed curve when the hover instant sits inside the observed window. Otherwise interpAt would clamp to the last observed
        //value and the dot would freeze on yesterday's late-afternoon reading when the user hovers at noon tomorrow.
        const lastObsMs = samples.length > 0
            ? samples[samples.length - 1].t.getTime()
            : -Infinity;
        if (samples.length >= 1 && hoverMs <= lastObsMs)
        {
            hoverV = interpAt(
                samples.map(s => s.t),
                samples.map(s => s.v),
                hoverMs,
            );
        }
        if (!isFinite(hoverV) && predictedSamples.length >= 1)
        {
            hoverV = interpAt(
                predictedSamples.map(s => s.t),
                predictedSamples.map(s => s.v),
                hoverMs,
            );
        }
        if (isFinite(hoverV))
        {
            //Floor at zero: a net-meter entity can briefly dip below zero around dawn / dusk and the dot should still ride the visible curve, not
            //dive off the bottom of the card.
            hoverY = yOf(Math.max(0, hoverV));
            showHover = true;
        }
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


//Day labels rendered as small white chips overlaying the chart
//card on its midline (between the irradiance and cloud halves).
//Same chip styling as the on-map cloud and W/m² readouts, so all
//three feel like the same family. Each chip is centred on the
//middle of its day's segment in the time range.
export function renderTimelineDayLabels(host: ChartHost): TemplateResult
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

    const today0 = new Date(now);
    today0.setHours(0, 0, 0, 0);

    //Active day during hover or scrub. The strip cell matching the
    //pointer's day-bucket gets a faint brand-blue tint so the user
    //reads "I am on this day" at a glance. Falls back to null when
    //no hover or scrub is active, leaving every cell at rest.
    const hoverPctRef = host._chartHoverPct;
    let activeDayKey: number | null = null;
    if (hoverPctRef !== null && hoverPctRef >= 0 && hoverPctRef <= 100)
    {
        const hoverMs   = start.getTime() + (hoverPctRef / 100) * rangeMs;
        const hoverDate = new Date(hoverMs);
        hoverDate.setHours(0, 0, 0, 0);
        activeDayKey = hoverDate.getTime();
    }

    //Build the per-day cells + the vertical separators between
    //them. Cells use absolute positioning over the strip so each
    //label sits at the geometric centre of its day's segment, even
    //when the first or last day is only partially visible. The
    //separator list collects the right edge of each day except the
    //last (no separator at the strip's outer right edge).
    type Cell = { isToday: boolean; isActive: boolean; centrePct: number; widthPct: number; label: string };
    const cells: Cell[] = [];
    const sepPcts: number[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);

    while (cursor.getTime() <= end.getTime())
    {
        const next = new Date(cursor);
        next.setDate(next.getDate() + 1);

        const segStart = Math.max(start.getTime(), cursor.getTime());
        const segEnd   = Math.min(end.getTime(),   next.getTime());

        if (segEnd > segStart)
        {
            const pStart   = toPct(new Date(segStart));
            const pEnd     = toPct(new Date(segEnd));
            const w        = pEnd - pStart;
            const dayDelta = Math.round((cursor.getTime() - today0.getTime()) / 86_400_000);
            const isToday  = dayDelta === 0;
            const isActive = activeDayKey !== null && cursor.getTime() === activeDayKey;

            const label    = formatDate(cursor, host.hass);

            cells.push({
                isToday,
                isActive,
                centrePct: pStart + w / 2,
                widthPct:  w,
                label,
            });
            //Right edge of the day; becomes a separator unless
            //this day is the last one visible. We record it
            //unconditionally and trim after the loop.
            sepPcts.push(pEnd);
        }

        cursor.setTime(next.getTime());
    }
    //The final entry is the right edge of the strip (not a
    //between-day boundary), drop it.
    if (sepPcts.length > 0)
    {
        sepPcts.pop();
    }

    return html`
        <div class="tb-day-strip">
            ${cells.map(c => html`
                <div
                    class="tb-day-strip-cell ${c.isToday ? 'is-today' : ''} ${c.isActive ? 'is-active' : ''}"
                    style="left:${(c.centrePct - c.widthPct / 2).toFixed(2)}%; width:${c.widthPct.toFixed(2)}%"
                >
                    <span class="tb-day-strip-date">${c.label}</span>
                </div>
            `)}
            ${sepPcts.map(p => html`
                <div class="tb-day-strip-sep" style="left:${p.toFixed(2)}%"></div>
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
