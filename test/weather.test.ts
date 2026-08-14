import { describe, it, expect } from 'vitest';
import { medianOfNumbers, pickModelsForLocation } from '../src/data/weather';

//Parity anchors for the multi-model fusion: both sides median-combine the picked models and select the same model
//set per coordinate (spec decisions A + B).

describe('medianOfNumbers', () =>
{
    it('returns the middle value for an odd count and the mean of the two middles for an even count', () =>
    {
        expect(medianOfNumbers([3, 1, 2])).toBe(2);
        expect(medianOfNumbers([1, 2, 3, 4])).toBe(2.5);
        expect(medianOfNumbers([5])).toBe(5);
    });

    it('ignores null / undefined / NaN, and is null when nothing is finite', () =>
    {
        expect(medianOfNumbers([1, null, NaN, 3])).toBe(2);
        expect(medianOfNumbers([])).toBeNull();
        expect(medianOfNumbers([null, undefined, NaN])).toBeNull();
    });

    it('resists a gross single-model outlier (the reason for median over mean)', () =>
    {
        //Mean would be 40; the median stays with the two agreeing models.
        expect(medianOfNumbers([10, 10, 100])).toBe(10);
    });
});

describe('pickModelsForLocation', () =>
{
    it('uses best_match only at standard precision, everywhere', () =>
    {
        expect(pickModelsForLocation(48.85, 2.35, 'standard')).toEqual(['best_match']);
        expect(pickModelsForLocation(-33.9, 151.2, 'standard')).toEqual(['best_match']);
    });

    it('pairs the regional HD model with the ECMWF global inside a coverage box', () =>
    {
        expect(pickModelsForLocation(48.8566, 2.3522, 'high')).toEqual(['meteofrance_seamless', 'ecmwf_ifs025']); //Paris
        expect(pickModelsForLocation(52.52, 13.40, 'high')).toEqual(['dwd_icon_seamless', 'ecmwf_ifs025']);       //Berlin
    });

    it('tests Korea before Japan (the JMA box encloses Korea)', () =>
    {
        expect(pickModelsForLocation(37.5665, 126.9780, 'high')).toEqual(['kma_seamless', 'ecmwf_ifs025']); //Seoul
        expect(pickModelsForLocation(35.6762, 139.6503, 'high')).toEqual(['jma_seamless', 'ecmwf_ifs025']); //Tokyo
    });

    it('falls back to two independent globals outside every box', () =>
    {
        expect(pickModelsForLocation(0, 0, 'high')).toEqual(['ecmwf_ifs025', 'gfs_seamless']);
    });
});
