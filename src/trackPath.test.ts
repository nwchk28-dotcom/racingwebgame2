import { describe, expect, it } from 'vitest';
import { TRACKS } from './trackData';
import { TrackPath } from './trackPath';
import { LapTracker } from './lap';

describe('all circuits', () => {
  it('covers every 2025 venue except the Suzuka overpass, plus Sepang', () => {
    expect(TRACKS).toHaveLength(24);
    expect(new Set(TRACKS.map(track => track.id)).size).toBe(24);
    expect(TRACKS.map(track => track.id as string)).not.toContain('suzuka');
    for (const id of ['shanghai', 'bahrain', 'miami', 'imola', 'barcelona',
      'austria', 'hungary', 'zandvoort', 'austin', 'las-vegas', 'lusail', 'sepang']) {
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

  it('rounds Monaco survey joints without leaving a sharp road seam', () => {
    const path = new TrackPath(TRACKS.find(track => track.id === 'monaco')!);
    expect(path.length / path.sampleCount).toBeLessThan(1.7);
    for (let i = 0; i < path.sampleCount; i++) {
      const before = path.samples[i].clone().sub(path.samples[(i - 1 + path.sampleCount) % path.sampleCount]).normalize();
      const after = path.samples[i + 1].clone().sub(path.samples[i]).normalize();
      const angle = Math.acos(Math.max(-1, Math.min(1, before.dot(after))));
      expect(angle, `Monaco joint ${i}`).toBeLessThan(12 * Math.PI / 180);
    }
  });

  it('places each lap origin at its configured timing line', () => {
    const expectedOldProgress: Partial<Record<(typeof TRACKS)[number]['id'], readonly [number, number]>> = {
      sepang: [.92, .95], monza: [0.93, 0.97], silverstone: [0.43, 0.46], monaco: [0.72, 0.74],
      jeddah: [0, 0.02], baku: [0, 0.02], 'abu-dhabi': [0, 0.02], singapore: [0, 0.02],
      shanghai: [.91, .93], bahrain: [0, .02], miami: [0, .02], imola: [0, .02],
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

  it('orients Shanghai like the FIA map and starts on the pit straight', () => {
    const definition = TRACKS.find(track => track.id === 'shanghai')!;
    const sourceOrder = new TrackPath({ ...definition, timingLine: undefined });
    const [x, z] = definition.timingLine!;
    const line = sourceOrder.nearest(-x, z);
    const beforeLine = definition.points[138];
    const firstTurn = definition.points[10];
    const beforeProgress = sourceOrder.nearest(-beforeLine[0], beforeLine[1]).progress;
    const firstTurnProgress = sourceOrder.nearest(-firstTurn[0], firstTurn[1]).progress;
    expect(line.progress).toBeGreaterThan(.91);
    expect(line.progress).toBeLessThan(.93);
    expect(beforeProgress).toBeLessThan(line.progress);
    expect((line.progress - beforeProgress) * sourceOrder.length).toBeGreaterThan(150);
    expect((firstTurnProgress + 1 - line.progress) * sourceOrder.length).toBeGreaterThan(550);

    // In the published orientation, the pit straight rises at the left edge
    // and the long back straight runs mostly across the bottom of the map.
    const pitExit = definition.points[0];
    expect(Math.abs(pitExit[1] - z)).toBeGreaterThan(3 * Math.abs(pitExit[0] - x));
    const backStart = definition.points[120];
    const backEnd = definition.points[135];
    expect(Math.abs(backEnd[0] - backStart[0])).toBeGreaterThan(
      1.5 * Math.abs(backEnd[1] - backStart[1]),
    );
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
  it('starts Sepang on the home straight before its right-hand T1, not the back straight', () => {
    const definition = TRACKS.find(track => track.id === 'sepang')!;
    const original = new TrackPath({ ...definition, timingLine: undefined });
    const line = original.nearest(-365, 28);
    const t1Entry = original.nearest(-definition.points[2][0], definition.points[2][1]);
    const distanceToT1 = ((t1Entry.progress - line.progress + 1) % 1) * original.length;
    expect(distanceToT1).toBeGreaterThan(650);
    expect(distanceToT1).toBeLessThan(710);
    const path = new TrackPath(definition);
    const forward = path.samples[1].clone().sub(path.samples[0]).normalize();
    expect(forward.x).toBeGreaterThan(.99); // Mirrored world eastings: driving west.
    expect(forward.z).toBeLessThan(0);
    expect(definition.roadHalfWidth * 2).toBe(18);
    // T1's rightward change in heading must survive world-axis conversion.
    const entry = original.samples[t1Entry.progress * original.sampleCount | 0];
    // Test the first half of the >180-degree T1 arc; the full exit
    // heading alone cannot distinguish the turn direction.
    const t1Exit = original.nearest(-definition.points[6][0], definition.points[6][1]);
    const exitIndex = Math.floor(t1Exit.progress * original.sampleCount);
    const exitForward = original.samples[exitIndex + 1].clone().sub(original.samples[exitIndex]).normalize();
    expect(forward.x * exitForward.z - forward.z * exitForward.x).toBeGreaterThan(0);
    expect(entry.distanceTo(original.start)).toBeGreaterThan(250);

    // Both nearby straights must keep their own lap progress when reacquired.
    for (const vertex of [0, 96, 97]) {
      const [x, z] = definition.points[vertex];
      const nearest = original.nearest(-x, z);
      expect(nearest.distance).toBeLessThan(15);
      if (vertex === 97) expect(nearest.progress).toBeLessThan(line.progress);
    }
  });

  it('times a complete Sepang lap through the ordered gates', () => {
    const path = new TrackPath(TRACKS.find(track => track.id === 'sepang')!);
    const tracker = new LapTracker(path.length);
    let previous = 0;
    let completed = null;
    for (let i = 1; i <= path.sampleCount; i++) {
      const point = path.samples[i];
      const position = path.nearest(point.x, point.z, previous);
      completed = tracker.update(position.progress, false, 40, .1) ?? completed;
      previous = position.progress;
    }
    expect(completed?.valid).toBe(true);
    expect(completed?.newBest).toBe(true);
  });

});
