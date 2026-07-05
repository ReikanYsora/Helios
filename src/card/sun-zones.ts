//Night share per hour-of-day over a window: for each hour, the fraction of sampled days when the sun is below
//the horizon at that hour. A single day reads 0 or 1 (sharp day/night); a long window averages the seasonal
//swing (2h is always night -> 1; 7h is night in winter, day in summer -> partial), which the dial paints as a
//darker or lighter ground wedge.

import { getSunPosition } from '../engine/sun';
import { serverHour } from './timezone';
import { HOUR_MS, DAY_MS, HOURS_PER_DAY} from '../constants';

export function nightFractionByHour(lat: number, lon: number, startMs: number, endMs: number): number[]
{
    const night = new Array<number>(HOURS_PER_DAY).fill(0);
    const cnt   = new Array<number>(HOURS_PER_DAY).fill(0);
    const days  = Math.max(1, Math.round((endMs - startMs) / DAY_MS));
    //Cap the day samples (a year would be 365): every `step`-th day is enough for a smooth seasonal average.
    const step  = Math.max(1, Math.ceil(days / 120));
    //Sample each retained day across its 24 hours and bin by the HOME hour of day (see ./tz), so the wedges line
    //up with the dial's hours whatever the browser zone. Sampling real instants (not a wall-clock setHours) keeps
    //it correct across DST: each sample lands in its true home hour.
    for (let i = 0; i < days; i += step)
    {
        for (let h = 0; h < HOURS_PER_DAY; h++)
        {
            const ms     = startMs + i * DAY_MS + h * HOUR_MS + HOUR_MS / 2;   //mid-band of a real hour
            const bucket = serverHour(ms);
            if (getSunPosition(new Date(ms), lat, lon).altitude < 0) { night[bucket] += 1; }
            cnt[bucket] += 1;
        }
    }
    return night.map((v, h) => (cnt[h] ? v / cnt[h] : 0));
}
