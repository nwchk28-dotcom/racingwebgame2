import { describe, expect, it } from 'vitest';
import { createCourseMap } from './courseMap';
import { TRACKS } from './trackData';
import { TrackPath } from './trackPath';

describe('course map', () => {
  it('projects the live car position and line onto each selected circuit', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      const map = createCourseMap(path);
      const start = map.project(path.start.x, path.start.z);
      expect(start).toEqual(map.start);
      expect(map.outline.split(' ').length).toBeGreaterThan(100);
      for (const sample of path.samples.slice(0, path.sampleCount).filter((_, i) => i % 37 === 0)) {
        const dot = map.project(sample.x, sample.z);
        expect(dot.x).toBeGreaterThanOrEqual(13);
        expect(dot.x).toBeLessThanOrEqual(167);
        expect(dot.y).toBeGreaterThanOrEqual(31);
        expect(dot.y).toBeLessThanOrEqual(117);
      }
    }
  });

  it('shows a right-hand bend on the right in both the onboard view and map', () => {
    const definition = { ...TRACKS[0], spline: false, targetLength: 400,
      points: [[0, 0], [0, 100], [100, 100], [100, 0]] as const };
    const path = new TrackPath(definition);
    const map = createCourseMap(path);
    const before = path.samples[Math.round(70 / path.length * path.sampleCount)];
    const after = path.samples[Math.round(140 / path.length * path.sampleCount)];
    const ahead = path.samples[Math.round(71 / path.length * path.sampleCount)];
    const yaw = Math.atan2(ahead.x - before.x, ahead.z - before.z);
    // With a +Z-facing camera, local screen-right is (-cos(yaw), sin(yaw)).
    const screenRight = (after.x - before.x) * -Math.cos(yaw) +
      (after.z - before.z) * Math.sin(yaw);
    expect(screenRight).toBeGreaterThan(0);
    expect(map.project(after.x, after.z).x).toBeGreaterThan(map.project(before.x, before.z).x);
  });
});
