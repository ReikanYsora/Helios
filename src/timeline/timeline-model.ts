//Adaptive timeline model: tick granularity (hours/days/weeks/months) follows the visible span. Fed [start, end];
//outputs labels + separators + dayBoundaries.


import { TIMELINE_MAX_TICKS, HOUR_MS, DAY_MS } from '../core/config/constants';

export type TimelineKind = 'intraday' | 'days' | 'weeks' | 'months';

export interface TimelineSeparator
{
    frac: number; //Position in [0, 1] across the window.
    date: Date;   //Boundary instant (separator) or period-start instant (label).
}

export interface TimelineModel
{
    kind:   TimelineKind;
    start:  Date;
    end:    Date;
    separators: TimelineSeparator[]; //Boundary gridlines (day/week/month starts), thinned to <= maxTicks.
    labels:     TimelineSeparator[]; //'intraday'/'weeks' sit ON the boundary; 'days'/'months' sit centred on the period.
    dayBoundaries: number[];         //Midnight gridline fractions, only when individual days read clearly (span 1-40 days).
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

//Resolve a timeline range to millisecond bounds, or null when there is no range or its span is non-positive.
//The single guard behind every "read _timeRange, bail on empty/zero-span" site (overlays, tooltip).
export function resolveRangeMs(
    range: { start: Date; end: Date } | null | undefined
): { startMs: number; endMs: number; rangeMs: number } | null
{
    if (!range)
    {
        return null;
    }
    const startMs = range.start.getTime();
    const endMs   = range.end.getTime();
    const rangeMs = endMs - startMs;
    return rangeMs > 0 ? { startMs, endMs, rangeMs } : null;
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

//Monday-anchored ISO week start at local midnight (getDay() 0=Sun..6=Sat, so Sunday maps 6 days back).
function startOfISOWeek(d: Date): Date
{
    const r = startOfDay(d);
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


//Build the adaptive tick/label model for a visible window. Memoised on the window (+ tick budget): the PV chart,
//the target chart and the day-label renderer each ask for the same model every render, and it is a pure function
//of start/end/maxTicks, so one build per range serves them all until the range changes. One slot per host
//(WeakMap) rather than a single global slot: with two cards mounted (possibly showing different windows), a
//single slot evicts on every render that alternates between them. `host` is a pure cache key here - the model
//never reads anything off it - so any stable per-card object identity works; callers pass their own host.
const _tmCache = new WeakMap<object, { key: string; val: TimelineModel }>();

export function buildTimelineModel(host: object, start: Date, end: Date, maxTicks: number = TIMELINE_MAX_TICKS): TimelineModel
{
    const key    = `${start.getTime()}|${end.getTime()}|${maxTicks}`;
    const cached = _tmCache.get(host);
    if (cached && cached.key === key)
    {
        return cached.val;
    }
    const model = buildTimelineModelUncached(start, end, maxTicks);
    _tmCache.set(host, { key, val: model });
    return model;
}

function buildTimelineModelUncached(start: Date, end: Date, maxTicks: number): TimelineModel
{
    const total    = end.getTime() - start.getTime() || 1;
    const spanDays = total / DAY_MS;

    let kind: TimelineKind;
    let firstTick: Date;
    let next: (d: Date) => Date;
    let periodStart: ((d: Date) => Date) | null; //start of the period containing `d`; null for intraday (labels sit on ticks)
    let labelMode: 'boundary' | 'centered';      //'boundary': label sits on the tick. 'centered': label names a span (weekday/month)

    if (spanDays <= 2.05)
    {
        kind = 'intraday';
        //Finest "nice" hour step keeping the tick count within budget (wide card shows 2h/3h, not always 6h).
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

    //'days' never thins (short weekday labels read fine across a full week; budget 16 sits above its ~14-day cap);
    //other kinds keep maxTicks so wide week/month spans collapse to a readable tick count.
    const tickBudget = kind === 'days' ? Math.max(maxTicks, 16) : maxTicks;
    const thin = <T>(arr: T[]): T[] =>
    {
        const stride = Math.max(1, Math.ceil(arr.length / tickBudget));
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
    let separators = thin(allSeps);

    let labels: TimelineSeparator[];
    if (labelMode === 'boundary')
    {
        labels = separators;
    }
    else
    {
        //Period-name labels (weekday/month) centred on each COMPLETE period; the 0.99 visibility ratio keeps the
        //last period when the window ends on its final millisecond (e.g. a week ending Sun 23:59:59.999).
        const allLabels: TimelineSeparator[] = [];
        let p = periodStart!(start);
        for (let g = 0; p.getTime() < end.getTime() && g < 500; g++)
        {
            const pEndDate  = next(p);
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

    //Months: align the gridlines with the named months (one separator at the start of each shown label) instead of
    //thinning boundaries independently (which dropped lines onto the unlabelled months).
    if (kind === 'months')
    {
        separators = labels
            .map(l => ({ frac: (l.date.getTime() - start.getTime()) / total, date: l.date }))
            .filter(s => s.frac > 0 && s.frac < 1);
    }

    //Midnight gridlines, only up to a week span (Forecast and Week); Month and Year drop them so the graph stays
    //clean when the days are too dense to read individually.
    const dayBoundaries: number[] = [];
    if (spanDays > 1.05 && spanDays <= 8)
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


//Constructing an Intl.DateTimeFormat is a genuinely expensive V8 operation, and formatTimelineLabel below runs
//it fresh for every rendered label. The key space is tiny and stable within a session (4 kinds x whatever
//language HA reports), so caching every formatter ever built - including the try/catch's fallback, so a
//language that throws isn't re-attempted on every call either - is safe with no eviction needed.
const timelineFormatterCache = new Map<string, Intl.DateTimeFormat>();

function timelineFormatterFor(kind: TimelineKind, lang: string | undefined, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat
{
    const key = `${lang ?? ''}|${kind}`;
    let f = timelineFormatterCache.get(key);
    if (!f)
    {
        try
        {
            f = new Intl.DateTimeFormat(lang, opts);
        }
        catch (_)
        {
            f = new Intl.DateTimeFormat(undefined, opts);
        }
        timelineFormatterCache.set(key, f);
    }
    return f;
}

//Kind-aware label for the timeline footer, honouring the HA language: intraday -> hour:minute, days -> short
//weekday, weeks -> day + short month, months -> full month name.
export function formatTimelineLabel(kind: TimelineKind, d: Date, hass?: { language?: string }): string
{
    const lang = (hass?.language as string | undefined) || undefined;
    const opts: Intl.DateTimeFormatOptions =
          kind === 'intraday' ? { hour: '2-digit', minute: '2-digit' }
              : kind === 'days'     ? { weekday: 'short' }
                  : kind === 'weeks'    ? { day: 'numeric', month: 'short' }
                      :                       { month: 'short' };
    return timelineFormatterFor(kind, lang, opts).format(d);
}
