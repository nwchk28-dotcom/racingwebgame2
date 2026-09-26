import { describe, expect, it } from 'vitest';
import { TRACKS } from './trackData';
import { TrackPath } from './trackPath';

describe('three circuits', () => {
  it('keeps the requested lap lengths and a dense, closed centerline', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      expect(path.samples[0].distanceTo(path.samples[path.sampleCount])).toBeLessThan(0.001);
      expect(path.length).toBeGreaterThan(1000);
      if (definition.targetLength) {
        expect(Math.abs(path.length - definition.targetLength) / definition.targetLength).toBeLessThan(0.01);
      }
      for (let i = 0; i < path.sampleCount; i++) {
        expect(path.samples[i].distanceTo(path.samples[i + 1])).toBeLessThan(5);
        expect(Number.isFinite(path.normals[i].x)).toBe(true);
      }
    }
  });

  it('finds the actual road segment on each course and follows ordered progress', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      let previous = 0;
      for (let i = 0; i < 100; i++) {
        const sample = path.samples[Math.floor(i * path.sampleCount / 100)];
        const position = path.nearest(sample.x, sample.z, previous);
        expect(position.distance).toBeLessThan(0.1);
        expect(position.progress).toBeCloseTo(i / 100, 2);
        previous = position.progress;
      }
    }
  });

  it('finds the closest segment near a curb, including close parallel sections', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      for (let i = 0; i < path.sampleCount; i += Math.floor(path.sampleCount / 37)) {
        const point = path.samples[i];
        const normal = path.normals[i].clone().normalize();
        const x = point.x + normal.x * 8;
        const z = point.z + normal.z * 8;
        const result = path.nearest(x, z);
        let bruteDistance = Infinity;
        for (let j = 0; j < path.sampleCount; j++) {
          const a = path.samples[j];
          const b = path.samples[j + 1];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
          bruteDistance = Math.min(bruteDistance, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
        }
        expect(result.distance).toBeCloseTo(bruteDistance, 5);
      }
    }
  });

  it('keeps both curb edges moving forward through tight corners', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      const edge = definition.roadHalfWidth + definition.curbWidth;
      for (let i = 0; i < path.sampleCount; i++) {
        const start = path.samples[i];
        const end = path.samples[i + 1];
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        for (const side of [-1, 1]) {
          const edgeDx = dx + (path.normals[i + 1].x - path.normals[i].x) * edge * side;
          const edgeDz = dz + (path.normals[i + 1].z - path.normals[i].z) * edge * side;
          expect(edgeDx * dx + edgeDz * dz, `${definition.id} segment ${i} side ${side}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
