import { describe, expect, it } from 'vitest';
import { TRACKS } from './trackData';
import { TrackPath } from './trackPath';

describe('all circuits', () => {
  it('covers every 2025 venue except the Suzuka overpass', () => {
    expect(TRACKS).toHaveLength(23);
    expect(new Set(TRACKS.map(track => track.id)).size).toBe(23);
    expect(TRACKS.map(track => track.id as string)).not.toContain('suzuka');
    for (const id of ['shanghai', 'bahrain', 'miami', 'imola', 'barcelona',
      'austria', 'hungary', 'zandvoort', 'austin', 'las-vegas', 'lusail']) {
      expect(TRACKS.some(track => track.id === id), id).toBe(true);
    }
  });

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
        const index = Math.floor(i * path.sampleCount / 100);
        const sample = path.samples[index];
        const position = path.nearest(sample.x, sample.z, previous);
        expect(position.distance).toBeLessThan(0.1);
        expect(position.progress).toBeCloseTo(path.distances[index] / path.length, 2);
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

  it('places each lap origin at its configured timing line', () => {
    const expectedOldProgress: Partial<Record<(typeof TRACKS)[number]['id'], readonly [number, number]>> = {
      monza: [0.93, 0.97], silverstone: [0.43, 0.46], monaco: [0.72, 0.74],
      jeddah: [0, 0.02], baku: [0, 0.02], 'abu-dhabi': [0, 0.02], singapore: [0, 0.02],
      shanghai: [.16, .17], bahrain: [0, .02], miami: [0, .02], imola: [0, .02],
      barcelona: [0, .02], austria: [0, .02], hungary: [0, .02], zandvoort: [0, .02],
      austin: [0, .02], 'las-vegas': [0, .02], lusail: [0, .02],
    };
    for (const definition of TRACKS.filter(item => item.timingLine)) {
      const original = new TrackPath({ ...definition, timingLine: undefined });
      const [x, z] = definition.timingLine!;
      const oldLine = original.nearest(-x, z);
      const [minimum, maximum] = expectedOldProgress[definition.id]!;
      expect(oldLine.distance).toBeLessThan(15);
      const unwrappedProgress = Math.min(oldLine.progress, 1 - oldLine.progress);
      const checkedProgress = minimum === 0 ? unwrappedProgress : oldLine.progress;
      expect(checkedProgress).toBeGreaterThanOrEqual(minimum);
      expect(checkedProgress).toBeLessThan(maximum);

      const moved = new TrackPath(definition);
      const oldIndex = Math.round(oldLine.progress * original.sampleCount) % original.sampleCount;
      const oldForward = original.samples[oldIndex + 1].clone().sub(original.samples[oldIndex]).normalize();
      const newForward = moved.samples[1].clone().sub(moved.samples[0]).normalize();
      expect(oldForward.dot(newForward)).toBeGreaterThan(0.99);
      expect(moved.nearest(moved.start.x, moved.start.z).progress).toBeCloseTo(0, 3);
    }
  });

  it('places the Shanghai checker between Turn 16 and Turn 1 on the pit straight', () => {
    const definition = TRACKS.find(track => track.id === 'shanghai')!;
    const sourceOrder = new TrackPath({ ...definition, timingLine: undefined });
    const [x, z] = definition.timingLine!;
    const line = sourceOrder.nearest(-x, z);
    const finalTurn = definition.points[35];
    const firstTurn = definition.points[49];
    const finalTurnProgress = sourceOrder.nearest(-finalTurn[0], finalTurn[1]).progress;
    const firstTurnProgress = sourceOrder.nearest(-firstTurn[0], firstTurn[1]).progress;
    // Source point zero is on the long back straight before the T14 hairpin.
    // The route then passes T16, this control line, and T1 in that order.
    expect(finalTurnProgress).toBeGreaterThan(.10);
    expect(finalTurnProgress).toBeLessThan(line.progress);
    expect(line.progress).toBeGreaterThan(.164);
    expect(line.progress).toBeLessThan(.169);
    expect(line.progress).toBeLessThan(firstTurnProgress);
    expect(firstTurnProgress).toBeLessThan(.23);
    expect((line.progress - finalTurnProgress) * sourceOrder.length).toBeGreaterThan(200);
    expect((firstTurnProgress - line.progress) * sourceOrder.length).toBeGreaterThan(200);
  });

  it('keeps every circuit start on a straight section', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      const before = path.samples[path.sampleCount - 12].clone().sub(path.samples[0]);
      const after = path.samples[12].clone().sub(path.samples[0]);
      // At the control line, the incoming and outgoing road headings should
      // agree even on circuits whose source vertices are unevenly spaced.
      expect(before.normalize().dot(after.normalize()), definition.id).toBeLessThan(-0.98);
    }
  });
});
