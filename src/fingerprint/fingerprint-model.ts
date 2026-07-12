//Energy Fingerprint data model: one week as a heatmap grid (7 weekdays x 15-minute slots), built from the Home
//Assistant Energy dashboard statistics. `weekOffset` walks back through past weeks so habits can be compared week
//to week; the granularity stays 15-minute throughout (the card stops navigating where the recorder's 5-minute
//statistics run out, rather than degrading to a coarser view). Reuses the recorder `change` metric already wired
//for the rest of Helios; nothing here reads live states or the scene. All energy is kWh.

import { fetchChangeSeries, type ChangeBucket } from '../data/sources/energy-stats';
import type { EnergyDefaults } from '../data/sources/energy-prefs';
import { localMidnightMinusDays, serverHourFrac } from '../core/time/timezone';
import { DAY_MS } from '../core/config/constants';

const ROWS = 7;    //Monday .. Sunday
const COLS = 96;   //15-minute slots across a day

//One heatmap cell: the energy split for its 15-minute slot, its self-consumption coverage, whether any recorder
//bucket landed (a slot with no data stays empty, never a fabricated zero), and the slot's start (for the tooltip
//and the day-detail graph). Battery fields are 0 when no battery is configured.
export interface FpCell
{
    consumption:      number;         //kWh drawn by the home in the slot (grid import + battery discharge + self-used solar)
    solar:            number;         //kWh produced in the slot
    gridImport:       number;         //kWh drawn from the grid in the slot
    gridExport:       number;         //kWh sent to the grid in the slot
    batteryCharge:    number;         //kWh stored into the battery in the slot
    batteryDischarge: number;         //kWh drawn from the battery in the slot
    coverage:         number | null;  //self-consumed solar / consumption, 0..1; null when there is no load
    revenue:          number;         //money earned selling the exported energy in the slot (0 when no sale configured)
    hasData:          boolean;
    ms:               number;         //slot start (epoch ms)
}

//Grid-export earnings config, resolved by the card from the Energy dashboard (`flow_to`). A compensation statistic
//gives exact currency per slot; otherwise a fixed or (current) entity-driven price is applied per exported kWh.
export interface FpSale
{
    compensationStats: string[];
    priceNumber:       number | null;
    priceValue:        number | null; //resolved current value of an entity_energy_price, if any
}

export interface FpModel
{
    rows:       number;             //always 7 (Mon..Sun)
    cols:       number;             //always 96 (15-minute)
    startMs:    number;             //the week's Monday (local midnight)
    endMs:      number;             //the week's Sunday-end (local midnight + 7 days)
    cells:      FpCell[][];         //[rows][cols]
    rowLabels:  string[];           //weekday + date, one per row
    p95:        number;             //consumption normaliser (95th percentile, so one spike can't wash the grid out)
    hasAnyData: boolean;
    hasBattery: boolean;            //a battery is configured in the HA Energy dashboard
    hasSale:    boolean;            //grid export is compensated (a sale/feed-in tariff is configured)
}

const mkGrid = (): number[][] => Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));

//Monday-indexed weekday (0 = Monday .. 6 = Sunday) for a local-midnight instant.
const mondayIndex = (ms: number): number => (new Date(ms).getDay() + 6) % 7;

//Local-midnight bounds of the week `offset` weeks back (0 = current). Shared by the model and the card's
//look-ahead probe so both agree on exactly which range a week covers.
export function weekBoundsFor(offset: number): { startMs: number; endMs: number }
{
    const startMs = localMidnightMinusDays(mondayIndex(localMidnightMinusDays(0)) + Math.max(0, offset) * 7);
    const sun = new Date(startMs); sun.setDate(sun.getDate() + (ROWS - 1));
    return { startMs, endMs: sun.getTime() + DAY_MS };
}

function percentile(sorted: number[], p: number): number
{
    if (sorted.length === 0) { return 0; }
    const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
    return sorted[i];
}

//Fold a change-series into the grid via a bucket-start -> {r, c} mapper, summing kWh and counting landed buckets so
//a gap reads as no-data.
function bin(series: ChangeBucket[] | null, map: (ms: number) => { r: number; c: number } | null, grid: number[][], count: number[][]): void
{
    if (!series) { return; }
    for (const b of series)
    {
        if (!Number.isFinite(b.kwh)) { continue; }
        const rc = map(b.startMs);
        if (!rc) { continue; }
        grid[rc.r][rc.c] += Math.max(0, b.kwh);
        count[rc.r][rc.c] += 1;
    }
}

//Build the fingerprint for the week `weekOffset` weeks back (0 = the current week). Null when no hass/callWS. When
//the returned model has no data, that week is past the recorder's 5-minute retention (the navigation wall). `sale`
//carries the resolved grid-export earnings config so each slot's revenue can be computed.
export async function buildFingerprint(hass: any, d: EnergyDefaults, weekOffset: number, lang: string, sale: FpSale): Promise<FpModel | null>
{
    if (!hass?.callWS) { return null; }
    const { startMs: weekMonday, endMs: weekEndMs } = weekBoundsFor(weekOffset);
    //The seven local midnights of this week (setDate keeps them on real midnights across a DST change).
    const dayStarts = Array.from({ length: ROWS }, (_v, r) => { const dd = new Date(weekMonday); dd.setDate(dd.getDate() + r); return dd.getTime(); });
    const fetchEnd = Math.min(Date.now(), weekEndMs);
    const hasBattery = d.batteryStatEnergyFroms.length > 0 || d.batteryStatEnergyTos.length > 0;
    //A sale is configured when export is compensated in any of the dashboard's forms. When there is no per-kWh price
    //we fall back to the compensation statistic (currency change per slot).
    const hasPrice = sale.priceNumber !== null || sale.priceValue !== null;
    const hasSale = hasPrice || sale.compensationStats.length > 0;
    const useCompStat = !hasPrice && sale.compensationStats.length > 0;

    const [solar, imp, exp, batIn, batOut, comp] = await Promise.all([
        fetchChangeSeries(hass, d.solarStatEnergyFroms, weekMonday, fetchEnd, '5minute'),
        fetchChangeSeries(hass, d.gridStatEnergyFroms,  weekMonday, fetchEnd, '5minute'),
        fetchChangeSeries(hass, d.gridStatEnergyTos,    weekMonday, fetchEnd, '5minute'),
        hasBattery ? fetchChangeSeries(hass, d.batteryStatEnergyTos,   weekMonday, fetchEnd, '5minute') : Promise.resolve(null),
        hasBattery ? fetchChangeSeries(hass, d.batteryStatEnergyFroms, weekMonday, fetchEnd, '5minute') : Promise.resolve(null),
        useCompStat ? fetchChangeSeries(hass, sale.compensationStats, weekMonday, fetchEnd, '5minute') : Promise.resolve(null),
    ]);

    const dayRowFor = (ms: number): number =>
    {
        let r = -1;
        for (let i = 0; i < ROWS; i++) { if (ms >= dayStarts[i]) { r = i; } else { break; } }
        return r;
    };
    const map = (ms: number): { r: number; c: number } | null =>
    {
        const r = dayRowFor(ms);
        if (r < 0) { return null; }
        return { r, c: Math.min(COLS - 1, Math.max(0, Math.floor(serverHourFrac(ms) * (COLS / 24)))) };
    };

    const gS = mkGrid(); const gI = mkGrid(); const gE = mkGrid(); const gBC = mkGrid(); const gBD = mkGrid(); const gRev = mkGrid(); const cnt = mkGrid();
    bin(solar, map, gS, cnt); bin(imp, map, gI, cnt); bin(exp, map, gE, cnt);
    bin(batIn, map, gBC, cnt); bin(batOut, map, gBD, cnt);
    //Compensation-stat path: the "change" per slot is money, not kWh, so bin it straight into the revenue grid.
    if (comp) { const rc = mkGrid(); bin(comp, map, gRev, rc); }

    //Per-kWh price path (fixed or current entity value): revenue = exported kWh * price, applied below per slot.
    const price = sale.priceNumber ?? sale.priceValue ?? 0;

    const cells: FpCell[][] = [];
    const consVals: number[] = [];
    let hasAnyData = false;

    for (let r = 0; r < ROWS; r++)
    {
        const row: FpCell[] = [];
        for (let c = 0; c < COLS; c++)
        {
            const has = cnt[r][c] > 0;
            const solarE = gS[r][c];
            const gridImport = gI[r][c];
            const gridExport = gE[r][c];
            const batteryCharge = gBC[r][c];
            const batteryDischarge = gBD[r][c];
            //Solar the home actually used = produced minus what went to the grid and into the battery. Consumption
            //is that self-used solar plus everything drawn from the grid and the battery.
            const selfSolar = Math.max(0, solarE - gridExport - batteryCharge);
            const consumption = Math.max(0, gridImport + batteryDischarge + selfSolar);
            const coverage = consumption > 0 ? Math.min(1, selfSolar / consumption) : null;
            const revenue = useCompStat ? Math.max(0, gRev[r][c]) : gridExport * price;
            row.push({ consumption, solar: solarE, gridImport, gridExport, batteryCharge, batteryDischarge, coverage, revenue, hasData: has, ms: dayStarts[r] + c * 15 * 60_000 });
            if (has) { hasAnyData = true; consVals.push(consumption); }
        }
        cells.push(row);
    }

    const wd = new Intl.DateTimeFormat(lang || undefined, { weekday: 'short', day: 'numeric' });
    return {
        rows: ROWS, cols: COLS, startMs: weekMonday, endMs: weekEndMs,
        cells,
        rowLabels: dayStarts.map(ms => wd.format(new Date(ms))),
        p95: Math.max(1e-6, percentile([...consVals].sort((a, b) => a - b), 95)),
        hasAnyData,
        hasBattery,
        hasSale,
    };
}
