//Adaptive timeline model. Ported from the HA energy-solar-overview card so the standalone Helios
//timeline picks its tick granularity (hours / days / weeks / months) from the visible span, instead
//of always drawing one cell per day (which turned a 30-day window into 30 unreadable chips). The card
//feeds it the active rolling window [start, end]; the renderer draws model.labels + model.separators
//+ model.dayBoundaries. Kept Lit- and engine-free so any card-side module can import it cheaply.


const HOUR_MS = 3_600_000;
const DAY_MS  = 24 * HOUR_MS;

//Max boundary ticks / labels kept after thinning, so a wide window stays legible.
export const TIMELINE_MAX_TICKS = 7;

export type TimelineKind = 'intraday' | 'days' | 'weeks' | 'months';

export interface TimelineSeparator
{
    //Fraction in [0, 1] of the way across the window.
    frac: number;
    //The boundary instant (separator) or period-start instant (label) the entry marks.
    date: Date;
}

export interface TimelineModel
{
    kind:   TimelineKind;
    start:  Date;
    end:    Date;
    //Boundary gridlines (day / week / month starts), thinned to <= maxTicks.
    separators: TimelineSeparator[];
    //Labels: 'intraday' / 'weeks' sit ON the boundary; 'days' / 'months' sit centred on the period named.
    labels: TimelineSeparator[];
    //Midnight gridline fractions, only populated when individual days read clearly (span 1-40 days).
    dayBoundaries: number[];
}


//Local-time date helpers (Helios carries no date-fns dependency).
function startOfDay(d: Date): Date
{
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
}

function addDays(d: Date, n: number): Date
{
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function addWeeks(d: Date, n: number): Date
{
    return addDays(d, n * 7);
}

function addMonths(d: Date, n: number): Date
{
    const r = new Date(d);
    r.setMonth(r.getMonth() + n);
    return r;
}

//Monday-anchored ISO week start, at local midnight.
function startOfISOWeek(d: Date): Date
{
    const r = startOfDay(d);
    //getDay(): 0 = Sunday .. 6 = Saturday. ISO weeks start Monday, so Sunday maps to 6 days back.
    const dow = (r.getDay() + 6) % 7;
    return addDays(r, -dow);
}

function startOfMonth(d: Date): Date
{
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    r.setDate(1);
    return r;
}


//Build the adaptive tick / label model for a visible window. Span thresholds + thinning mirror the HA
//card so the two surfaces read identically.
export function buildTimelineModel(start: Date, end: Date, maxTicks: number = TIMELINE_MAX_TICKS): TimelineModel
{
    const total    = end.getTime() - start.getTime() || 1;
    const spanDays = total / DAY_MS;

    let kind: TimelineKind;
    let firstTick: Date;
    let next: (d: Date) => Date;
    //Start of the period containing `d`; null for intraday (labels sit on ticks).
    let periodStart: ((d: Date) => Date) | null;
    //'boundary': label is a point-in-time, sits ON the tick. 'centered': label names a span
    //(weekday, month) and sits centred on the period.
    let labelMode: 'boundary' | 'centered';

    if (spanDays <= 2.05)
    {
        kind = 'intraday';
        //Finest "nice" hour step that keeps the tick count within the width budget, so a wide card
        //shows 2 h / 3 h ticks instead of always 6 h.
        const spanHours = total / HOUR_MS;
        const stepH = [1, 2, 3, 4, 6, 12].find(h => spanHours / h <= maxTicks) ?? 12;
        const firstStep = Math.ceil((start.getHours() + start.getMinutes() / 60 + 1e-3) / stepH) * stepH;
        firstTick   = new Date(startOfDay(start).getTime() + firstStep * HOUR_MS);
        next        = d => new Date(d.getTime() + stepH * HOUR_MS);
        periodStart = null;
        labelMode   = 'boundary';
    }
    else if (spanDays <= 14.05)
    {
        kind        = 'days';
        firstTick   = addDays(startOfDay(start), 1);
        next        = d => addDays(d, 1);
        periodStart = d => startOfDay(d);
        labelMode   = 'centered';
    }
    else if (spanDays <= 120.05)
    {
        kind        = 'weeks';
        firstTick   = startOfISOWeek(addWeeks(start, 1));
        next        = d => addWeeks(d, 1);
        periodStart = d => startOfISOWeek(d);
        labelMode   = 'boundary';
    }
    else
    {
        kind        = 'months';
        firstTick   = startOfMonth(addMonths(start, 1));
        next        = d => addMonths(d, 1);
        periodStart = d => startOfMonth(d);
        labelMode   = 'centered';
    }

    const thin = <T>(arr: T[]): T[] =>
    {
        const stride = Math.max(1, Math.ceil(arr.length / maxTicks));
        return arr.filter((_, i) => i % stride === 0);
    };

    //Boundary ticks (gridlines).
    const allSeps: TimelineSeparator[] = [];
    for (let c = firstTick, g = 0; c.getTime() < end.getTime() && g < 500; g++)
    {
        const frac = (c.getTime() - start.getTime()) / total;
        if (frac > 0 && frac < 1)
        {
            allSeps.push({ frac, date: new Date(c) });
        }
        c = next(c);
    }
    const separators = thin(allSeps);

    let labels: TimelineSeparator[];
    if (labelMode === 'boundary')
    {
        labels = separators;
    }
    else
    {
        //Period-name labels (weekday, month) centred on each COMPLETE period; a period clipped by a
        //window edge gets no label.
        const allLabels: TimelineSeparator[] = [];
        let p = periodStart!(start);
        for (let g = 0; p.getTime() < end.getTime() && g < 500; g++)
        {
            const pEndDate  = next(p);
            //Complete = a visibility ratio (not strict pEnd <= end), so the last period still counts when
            //the window ends on its final millisecond (e.g. a week ending Sun 23:59:59.999).
            const periodLen = pEndDate.getTime() - p.getTime() || 1;
            const visible   = Math.min(pEndDate.getTime(), end.getTime()) - Math.max(p.getTime(), start.getTime());
            if (visible >= periodLen * 0.99)
            {
                const frac = ((p.getTime() + pEndDate.getTime()) / 2 - start.getTime()) / total;
                allLabels.push({ frac, date: new Date(p) });
            }
            p = pEndDate;
        }
        labels = thin(allLabels);
    }

    //Midnight gridlines, only when individual days read clearly.
    const dayBoundaries: number[] = [];
    if (spanDays > 1.05 && spanDays <= 40)
    {
        let day = addDays(startOfDay(start), 1);
        for (let g = 0; day.getTime() < end.getTime() && g < 64; g++)
        {
            const frac = (day.getTime() - start.getTime()) / total;
            if (frac > 0 && frac < 1)
            {
                dayBoundaries.push(frac);
            }
            day = addDays(day, 1);
        }
    }

    return { kind, start, end, separators, labels, dayBoundaries };
}


//Kind-aware label for the adaptive timeline footer. Honours the HA language preference like
//format.ts/formatDate: intraday -> hour:minute, days -> short weekday, weeks -> day + short month,
//months -> full month name.
export function formatTimelineLabel(kind: TimelineKind, d: Date, hass?: { language?: string }): string
{
    const lang = (hass?.language as string | undefined) || undefined;
    const opts: Intl.DateTimeFormatOptions =
          kind === 'intraday' ? { hour: '2-digit', minute: '2-digit' }
        : kind === 'days'     ? { weekday: 'short' }
        : kind === 'weeks'    ? { day: 'numeric', month: 'short' }
        :                       { month: 'long' };
    try
    {
        return new Intl.DateTimeFormat(lang, opts).format(d);
    }
    catch (_)
    {
        return new Intl.DateTimeFormat(undefined, opts).format(d);
    }
}
