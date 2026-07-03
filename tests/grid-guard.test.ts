//Grid mis-scope guard: pure evidence evaluation + state transitions, against the field scenarios that
//shaped the design (import-only sensor in the signed slot, asymmetric-phase net sensor, coarse-meter lag,
//integration noise, statistics artefacts) and the zero-regression cases (healthy signed sensors never flag).

import { describe, it, expect } from 'vitest';
import { evaluateGuardHours, nextGuardState, buildGuardHours, createGridGuard, type GuardHour } from '../src/card/grid-guard';

const H = (exportKwh: number | null, minW: number | null): GuardHour => ({ exportKwh, minW });

describe('evaluateGuardHours', () =>
{
    it('healthy signed sensor: deep negative mins during export, never a contradiction', () =>
    {
        const hours = [
            H(0, 250), H(1.2, -1100), H(2.4, -2300), H(1.8, -1700), H(0, 300),
        ];
        const ev = evaluateGuardHours(hours);
        expect(ev.contradictions).toBe(0);
        expect(ev.importOnly).toBe(false);
    });

    it('import-only sensor (ThoHilde / maxi07): export metered while min never leaves zero', () =>
    {
        const hours = [
            H(0.1, 120), H(2.1, 0), H(3.4, 0), H(2.8, 15), H(1.9, 0), H(0.05, 480),
        ];
        const ev = evaluateGuardHours(hours);
        //Hours 1-4 are candidates; non-adjacent greedy keeps 2 of the 4-cluster -> plus none elsewhere.
        expect(ev.contradictions).toBeGreaterThanOrEqual(2);
        expect(ev.importOnly).toBe(true);
    });

    it('import-only sensor across a full day reaches the flag threshold', () =>
    {
        const hours: GuardHour[] = [];
        for (let i = 0; i < 24; i++)
        {
            //Night: no export, sensor reads import. Day (hours 9-16): steady export, min pinned at 0.
            hours.push(i >= 9 && i <= 16 ? H(2.5, 0) : H(0, 350));
        }
        const ev = evaluateGuardHours(hours);
        expect(ev.contradictions).toBeGreaterThanOrEqual(3);
        expect(ev.importOnly).toBe(true);
    });

    it('asymmetric-phase net sensor: token -100 W dips cannot vouch for kilowatts of export', () =>
    {
        //Every hour exports 1.3 kWh (implied 1300 W) while the saldierend net sensor only dips to -100 W.
        //Relative band = -260 W, so every hour is a candidate; neighbours are candidates themselves and
        //must NOT exculpate each other.
        const hours: GuardHour[] = [];
        for (let i = 0; i < 8; i++)
        {
            hours.push(H(1.3, -100));
        }
        const ev = evaluateGuardHours(hours);
        expect(ev.contradictions).toBeGreaterThanOrEqual(3);
        expect(ev.importOnly).toBe(false);
    });

    it('coarse export meter: delta landing one hour late is exculpated by the genuinely negative hour', () =>
    {
        //Sun stops at the end of hour 1 (min -1500, delta not yet reported); the meter reports during hour 2
        //(0.31 kWh) when the sensor already reads import again. Twice in the day.
        const hours = [
            H(0.02, -1500), H(0.31, 180), H(0, 220), H(0.03, -1600), H(0.42, 240), H(0, 260),
        ];
        const ev = evaluateGuardHours(hours);
        expect(ev.contradictions).toBe(0);
    });

    it('integration noise below the floor and artefacts above the cap are never evidence', () =>
    {
        const hours = [
            H(0.04, 200), H(0.06, 300), H(0.09, 250),   //clamp noise: all below 0.1 kWh
            H(40, 100),                                  //statistics-surgery artefact: above 25 kWh
        ];
        const ev = evaluateGuardHours(hours);
        expect(ev.contradictions).toBe(0);
    });

    it('hours without min data are skipped, not treated as evidence', () =>
    {
        const hours = [
            H(2.0, null), H(3.1, null), H(2.4, null), H(1.8, null),
        ];
        const ev = evaluateGuardHours(hours);
        expect(ev.contradictions).toBe(0);
        expect(ev.realExportHours).toBe(0);
        expect(ev.importOnly).toBe(false);
    });
});

describe('nextGuardState', () =>
{
    const importOnlyDay = (): GuardHour[] =>
    {
        const hours: GuardHour[] = [];
        for (let i = 0; i < 24; i++)
        {
            hours.push(i >= 9 && i <= 16 ? H(2.5, 0) : H(0, 350));
        }
        return hours;
    };
    const healthyDay = (): GuardHour[] =>
    {
        const hours: GuardHour[] = [];
        for (let i = 0; i < 24; i++)
        {
            hours.push(i >= 9 && i <= 16 ? H(2.5, -2400) : H(0, 350));
        }
        return hours;
    };

    it('flags an import-only install and remembers the live-import classification', () =>
    {
        const next = nextGuardState(createGridGuard(), importOnlyDay());
        expect(next.status).toBe('flagged');
        expect(next.importLive).toBe(true);
    });

    it('stays healthy on a healthy install (zero-regression path)', () =>
    {
        const next = nextGuardState(createGridGuard(), healthyDay());
        expect(next.status).toBe('healthy');
    });

    it('self-clears after enough contradiction-free evaluations containing real export', () =>
    {
        let state = nextGuardState(createGridGuard(), importOnlyDay());
        expect(state.status).toBe('flagged');
        //The user fixed their sensor in place: the window now shows genuine negatives.
        state = nextGuardState(state, healthyDay());
        state = nextGuardState(state, healthyDay());
        expect(state.status).toBe('flagged');
        state = nextGuardState(state, healthyDay());
        expect(state.status).toBe('healthy');
        expect(state.importLive).toBe(false);
    });

    it('a windowless night (no export at all) neither clears nor accumulates', () =>
    {
        let state = nextGuardState(createGridGuard(), importOnlyDay());
        const night: GuardHour[] = Array.from({ length: 12 }, () => H(0, 400));
        const before = state.cleanEvals;
        state = nextGuardState(state, night);
        expect(state.status).toBe('flagged');
        expect(state.cleanEvals).toBe(before);
    });

    it('a contradiction resets the clean streak', () =>
    {
        let state = nextGuardState(createGridGuard(), importOnlyDay());
        state = nextGuardState(state, healthyDay());
        expect(state.cleanEvals).toBe(1);
        state = nextGuardState(state, importOnlyDay());
        expect(state.cleanEvals).toBe(0);
        expect(state.status).toBe('flagged');
    });
});

describe('buildGuardHours', () =>
{
    it('aligns export change and canonical min on hour starts, honouring legacy inversion', () =>
    {
        const t0 = Date.UTC(2026, 6, 1, 10);
        const t1 = Date.UTC(2026, 6, 1, 11);
        const exportRes = {
            'sensor.exp_a': [{ start: t0, change: 1.2 }, { start: t1, change: 0.4 }],
            'sensor.exp_b': [{ start: t0, change: 0.3 }],
        };
        const rateRes = {
            'sensor.net': [{ start: t0, min: -50, max: 900 }, { start: t1, min: -20, max: 1200 }],
        };
        const straight = buildGuardHours(exportRes, rateRes, ['sensor.exp_a', 'sensor.exp_b'], 'sensor.net', false);
        expect(straight).toEqual([
            { exportKwh: 1.5, minW: -50 },
            { exportKwh: 0.4, minW: -20 },
        ]);
        //Inverted wiring: the canonical minimum is -max.
        const inverted = buildGuardHours(exportRes, rateRes, ['sensor.exp_a', 'sensor.exp_b'], 'sensor.net', true);
        expect(inverted).toEqual([
            { exportKwh: 1.5, minW: -900 },
            { exportKwh: 0.4, minW: -1200 },
        ]);
    });
});
