//Guards the forecast bucket read. The regression this pins: on daily (year) buckets the forecast must be the day's
//MEAN watts, not a single midpoint (noon) sample, so the year curve sits level with the day-averaged production
//instead of towering at the noon peak (issue #303).

import { describe, it, expect } from 'vitest';
import { forecastWattsAt, forecastAverageWatts, type SolarForecastPoint } from '../src/data/energy-forecast';

const HOUR = 60 * 60_000;
const DAY0 = Date.UTC(2026, 6, 3, 0, 0, 0);

//A single clear day: 0 W overnight, a smooth bell peaking at 4000 W around noon, back to 0 by night. One point per hour.
function bellDay(dayStartMs: number): SolarForecastPoint[] {
  const out: SolarForecastPoint[] = [];
  for (let h = 0; h < 24; h++) {
    //Triangular bell centred on 12:00, zero before 06:00 and after 18:00.
    const dist = Math.abs(h - 12);
    const w = dist >= 6 ? 0 : 4000 * (1 - dist / 6);
    out.push({ tMs: dayStartMs + h * HOUR, w });
  }
  return out;
}

describe('forecastAverageWatts', () => {
  it('returns the daily mean, far below the noon peak', () => {
    const fc = bellDay(DAY0);
    const noon = forecastWattsAt(fc, DAY0 + 12 * HOUR);
    const dayMean = forecastAverageWatts(fc, DAY0, DAY0 + 24 * HOUR);

    expect(noon).toBe(4000);
    expect(dayMean).not.toBeNull();
    //Mean of a bell that is zero half the day is a fraction of its peak - nowhere near the midpoint sample.
    expect(dayMean!).toBeLessThan(1200);
    expect(dayMean!).toBeGreaterThan(700);
  });

  it('counts uncovered night hours as zero (matches production averaging energy over 24 h)', () => {
    //Forecast points only for the daylight window; the helper must still divide by the full span, not just covered hrs.
    const daylight = bellDay(DAY0).filter((p) => p.w > 0);
    const dayMean = forecastAverageWatts(daylight, DAY0, DAY0 + 24 * HOUR);
    expect(dayMean).not.toBeNull();
    expect(dayMean!).toBeLessThan(1200);
  });

  it('is null for an empty span or empty forecast', () => {
    expect(forecastAverageWatts([], DAY0, DAY0 + 24 * HOUR)).toBeNull();
    expect(forecastAverageWatts(bellDay(DAY0), DAY0, DAY0)).toBeNull();
  });
});
