//Hour-of-day binning in the HOME's time zone, not the browser's. The period aggregation groups every reading by hour of
//day; that grouping has to follow the home's zone (hass.config.time_zone) so a dashboard opened from another
//zone (a trip abroad, a shared link, a remote test) still shows the home's real solar day. The card sets the
//zone once from hass.config; until it is set, the helpers fall back to the browser zone (identical result when
//browser and home share a zone, which is the normal case).
//
//Correctness + speed: the true wall-clock offset is read from Intl (DST-aware) but cached per UTC hour, so a
//multi-day bucketization does at most one Intl lookup per distinct hour and plain arithmetic for the rest.

import { HOUR_MS, DAY_MS, HOURS_PER_DAY} from '../config/constants';

//Local (browser) midnight `days` calendar-days ago, in epoch ms. setDate lands on real local midnight across a
//DST change, where subtracting a flat days * 86_400_000 would drift the origin to 23h or 01h and shift every
//per-day bucket by an hour.
export function localMidnightMinusDays(days: number): number
{
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return d.getTime();
}

let _tz: string | undefined;
let _fmt: Intl.DateTimeFormat | undefined;
//Cache of (UTC-hour bucket) -> home wall-clock offset in ms. Cleared when the zone changes. Keyed by hour so a
//DST switch is picked up within the hour it happens, without an Intl call on every bucket.
const _offsetByUtcHour = new Map<number, number>();

//Set the home/server time zone (an IANA name like "Australia/Perth"). Idempotent and cheap on repeats.
export function setServerTimeZone(tz: string | undefined): void
{
    const next = tz || undefined;
    if (next === _tz)
    {
        return;
    }
    _tz = next;
    _offsetByUtcHour.clear();
    _fmt = next
        ? new Intl.DateTimeFormat('en-US', {
            timeZone: next, hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
        : undefined;
}

//Home wall-clock minus UTC, in ms, for an instant. Read from Intl (DST-aware) once per UTC hour, then cached.
function offsetMs(ms: number): number
{
    const key = Math.floor(ms / HOUR_MS);
    const hit = _offsetByUtcHour.get(key);
    if (hit !== undefined)
    {
        return hit;
    }
    let y = 0; let mo = 0; let d = 0; let h = 0; let mi = 0; let s = 0;
    for (const p of _fmt!.formatToParts(new Date(ms)))
    {
        if (p.type === 'year')
        {
            y = Number(p.value);
        }
        else if (p.type === 'month')
        {
            mo = Number(p.value);
        }
        else if (p.type === 'day')
        {
            d = Number(p.value);
        }
        else if (p.type === 'hour')
        {
            h = Number(p.value) % HOURS_PER_DAY;
        }
        else if (p.type === 'minute')
        {
            mi = Number(p.value);
        }
        else if (p.type === 'second')
        {
            s = Number(p.value);
        }
    }
    //Round to the minute so tiny sub-second drift can't wobble a bucket edge.
    const off = Math.round((Date.UTC(y, mo - 1, d, h, mi, s) - ms) / 60_000) * 60_000;
    _offsetByUtcHour.set(key, off);
    return off;
}

//Integer millisecond-of-day [0, DAY_MS) of an instant, in the home zone (browser zone until one is set).
//
//Anything binning a day into slots must come through here rather than through the fractional hour below. Dividing
//a whole day into an EXACT number of slots is integer arithmetic; going via hours makes it floating point, and a
//slot that is not a binary-friendly fraction of an hour (20 min, 12 min, 10 min) then lands its boundaries just
//under the integer they should be. floor() drops to the previous slot, which swallows two samples while its
//neighbour gets none - a hole in whatever is being binned, at some slot counts and not others.
export function serverMsOfDay(ms: number): number
{
    if (!_fmt)
    {
        const d = new Date(ms);
        return ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
    }
    const wall = ms + offsetMs(ms);
    return ((wall % DAY_MS) + DAY_MS) % DAY_MS;
}




