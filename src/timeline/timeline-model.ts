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


//Build the adaptive tick/label model for a visible window.
export function buildTimelineModel(start: Date, end: Date, maxTicks: number = TIMELINE_MAX_TICKS): TimelineModel
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
    try
    {
        return new Intl.DateTimeFormat(lang, opts).format(d);
    }
    catch (_)
    {
        return new Intl.DateTimeFormat(undefined, opts).format(d);
    }
}
