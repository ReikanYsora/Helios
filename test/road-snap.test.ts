import { describe, it, expect } from 'vitest';
import { roadFeaturesToSegments, snapToRoad, type RoadSegment } from '../src/scene/road-snap';
import type { GroundFeature } from '../src/scene/ground-vector';

describe('roadFeaturesToSegments', () =>
{
    it('flattens a road feature\'s lon/lat path into local-metre segments relative to the origin', () =>
    {
        const feature: GroundFeature = {
            layer: 'transportation',
            cls:   'residential',
            line:  true,
            lonLat: [[[0, 0], [0.001, 0]]], //~111m east at the equator
        };
        const segs = roadFeaturesToSegments([feature], 0, 0);
        expect(segs).toHaveLength(1);
        expect(segs[0].ax).toBeCloseTo(0, 3);
        expect(segs[0].ay).toBeCloseTo(0, 3);
        expect(segs[0].bx).toBeCloseTo(111.32, 0);
        expect(segs[0].by).toBeCloseTo(0, 3);
    });
});

describe('snapToRoad', () =>
{
    //A single east-west segment through the origin, 20m long either side.
    const segments: RoadSegment[] = [{ ax: -20, ay: 0, bx: 20, by: 0 }];

    it('snaps a moving point onto the segment (perpendicular from a point above it)', () =>
    {
        const result = snapToRoad({ eastM: 5, northM: 3 }, segments, 10, 10, 3, null);
        expect(result).not.toBeNull();
        expect(result!.e).toBeCloseTo(5, 5);
        expect(result!.n).toBeCloseTo(0, 5);
        expect(result!.distanceM).toBeCloseTo(3, 5);
    });

    it('clamps to the nearest endpoint past the segment\'s end', () =>
    {
        const result = snapToRoad({ eastM: 30, northM: 1 }, segments, 15, 10, 3, null);
        expect(result).not.toBeNull();
        expect(result!.e).toBeCloseTo(20, 5);
        expect(result!.n).toBeCloseTo(0, 5);
    });

    it('returns null beyond the max-distance gate', () =>
    {
        expect(snapToRoad({ eastM: 5, northM: 50 }, segments, 10, 10, 3, null)).toBeNull();
    });

    it('returns null below the min-speed gate, even standing right on the road', () =>
    {
        expect(snapToRoad({ eastM: 5, northM: 0.1 }, segments, 10, 0.1, 3, null)).toBeNull();
    });

    it('returns null with no segments at all', () =>
    {
        expect(snapToRoad({ eastM: 0, northM: 0 }, [], 10, 10, 3, null)).toBeNull();
    });

    it('picks the segment direction that stays within 90deg of the raw heading (never flips backwards)', () =>
    {
        //The segment runs east (bearing 90); a van heading roughly west (270) should get a heading near 270,
        //not 90, even though they describe the same physical line.
        const result = snapToRoad({ eastM: 5, northM: 1 }, segments, 10, 10, 3, 260);
        expect(result).not.toBeNull();
        expect(result!.headingDeg).toBeCloseTo(270, 0);
    });

    it('keeps the segment heading as-is when it already agrees with the raw heading', () =>
    {
        const result = snapToRoad({ eastM: 5, northM: 1 }, segments, 10, 10, 3, 95);
        expect(result).not.toBeNull();
        expect(result!.headingDeg).toBeCloseTo(90, 0);
    });
});
