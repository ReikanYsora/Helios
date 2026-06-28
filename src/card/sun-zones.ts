//Night share per hour-of-day over a window: for each hour, the fraction of sampled days when the sun is below
//the horizon at that hour. A single day reads 0 or 1 (sharp day/night); a long window averages the seasonal
//swing (2h is always night -> 1; 7h is night in winter, day in summer -> partial), which the dial paints as a
//darker or lighter ground wedge.

import { getSunPosition } from '../engine/sun';

const DAY_MS = 86_400_000;

export function nightFractionByHour(lat: number, lon: number, startMs: number, endMs: number): number[]
{
    const night = new Array<number>(24).fill(0);
    const cnt   = new Array<number>(24).fill(0);
    const days  = Math.max(1, Math.round((endMs - startMs) / DAY_MS));
    //Cap the day samples (a year would be 365): every `step`-th day is enough for a smooth seasonal average.
    const step  = Math.max(1, Math.ceil(days / 120));
    for (let i = 0; i < days; i += step)
    {
        const d = new Date(startMs + i * DAY_MS);
        for (let h = 0; h < 24; h++)
        {
            d.setHours(h, 30, 0, 0);   //local hour h, mid-band
            if (getSunPosition(d, lat, lon).altitude < 0) { night[h] += 1; }
            cnt[h] += 1;
        }
    }
    return night.map((v, h) => (cnt[h] ? v / cnt[h] : 0));
}
