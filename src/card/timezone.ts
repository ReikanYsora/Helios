//Hour-of-day binning in the HOME's time zone, not the browser's. The clock groups every reading by hour of
//day; that grouping has to follow the home's zone (hass.config.time_zone) so a dashboard opened from another
//zone (a trip abroad, a shared link, a remote test) still shows the home's real solar day. The card sets the
//zone once from hass.config; until it is set, the helpers fall back to the browser zone (identical result when
//browser and home share a zone, which is the normal case).
//
//Correctness + speed: the true wall-clock offset is read from Intl (DST-aware) but cached per UTC hour, so a
//multi-day bucketization does at most one Intl lookup per distinct hour and plain arithmetic for the rest.

import { HOUR_MS, DAY_MS, HOURS_PER_DAY} from '../constants';

let _tz: string | undefined;
let _fmt: Intl.DateTimeFormat | undefined;
//Cache of (UTC-hour bucket) -> home wall-clock offset in ms. Cleared when the zone changes. Keyed by hour so a
//DST switch is picked up within the hour it happens, without an Intl call on every bucket.
const _offsetByUtcHour = new Map<number, number>();

//Set the home/server time zone (an IANA name like "Australia/Perth"). Idempotent and cheap on repeats.
export function setServerTimeZone(tz: string | undefined): void
{
    const next = tz || undefined;
    if (next === _tz) { return; }
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
    if (hit !== undefined) { return hit; }
    let y = 0; let mo = 0; let d = 0; let h = 0; let mi = 0; let s = 0;
    for (const p of _fmt!.formatToParts(new Date(ms)))
    {
        if (p.type === 'year') { y = Number(p.value); }
        else if (p.type === 'month') { mo = Number(p.value); }
        else if (p.type === 'day') { d = Number(p.value); }
        else if (p.type === 'hour') { h = Number(p.value) % HOURS_PER_DAY; }
        else if (p.type === 'minute') { mi = Number(p.value); }
        else if (p.type === 'second') { s = Number(p.value); }
    }
    //Round to the minute so tiny sub-second drift can't wobble a bucket edge.
    const off = Math.round((Date.UTC(y, mo - 1, d, h, mi, s) - ms) / 60_000) * 60_000;
    _offsetByUtcHour.set(key, off);
    return off;
}

//Fractional hour-of-day [0, 24) of an instant, in the home zone (browser zone until one is set).
export function serverHourFrac(ms: number): number
{
    if (!_fmt)
    {
        const d = new Date(ms);
        return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    }
    const wall = ms + offsetMs(ms);
    return (((wall % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS;
}

//Integer hour-of-day [0, 23] of an instant, in the home zone.
export function serverHour(ms: number): number
{
    return Math.floor(serverHourFrac(ms)) % HOURS_PER_DAY;
}
