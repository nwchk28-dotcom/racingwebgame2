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
});
