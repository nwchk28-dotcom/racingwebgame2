import { describe, expect, it } from 'vitest';
import { TRACKS, type TrackId } from './trackData';
import { TrackPath } from './trackPath';
import { createCourseMap } from './courseMap';
import { LapTracker } from './lap';

// Independently checked against circuit guides / numbered official maps.
// Source X/Z are east/north. Positive signed area is anti-clockwise.
const ANTICLOCKWISE: readonly TrackId[] = [
  'sao-paulo', 'jeddah', 'baku', 'abu-dhabi', 'singapore',
  'miami', 'imola', 'austin', 'las-vegas',
];
// Miami is anti-clockwise overall but its first corner is a right-hander.
const FIRST_LEFT: readonly TrackId[] = [
  ...ANTICLOCKWISE.filter(id => id !== 'miami'), 'gilles-villeneuve',
];

function area(points: readonly (readonly [number, number])[]) {
  return points.reduce((sum, [x, z], i) => {
    const next = points[(i + 1) % points.length];
    return sum + x * next[1] - next[0] * z;
  }, 0);
}

describe('official racing direction', () => {
  it('matches real lap direction on all 24 tracks in source, world and HUD coordinates', () => {
    expect(TRACKS).toHaveLength(24);
    for (const definition of TRACKS) {
      const expected = ANTICLOCKWISE.includes(definition.id) ? 1 : -1;
      expect(Math.sign(area(definition.points)), definition.id).toBe(expected);
      const path = new TrackPath(definition);
      const map = createCourseMap(path);
      const world = path.samples.slice(0, path.sampleCount).map(p => [p.x, p.z] as const);
      const hud = world.map(([x, z]) => { const p = map.project(x, z); return [p.x, -p.y] as const; });
      // World eastings are mirrored for the +Z camera, the map undoes it.
      expect(Math.sign(area(world)), `${definition.id} world`).toBe(-expected);
      expect(Math.sign(area(hud)), `${definition.id} map`).toBe(expected);
    }
  });

  it('approaches the first main corner from the correct side on every circuit', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      const initial = path.startYaw;
      let turn = 0;
      // Ignore shallow kinks and GPS noise, but detect the first substantial
      // corner, rather than inferring corner direction from overall winding.
      for (let i = 1; i < path.sampleCount; i++) {
        const a = path.samples[i];
        const b = path.samples[i + 1];
        const yaw = Math.atan2(b.x - a.x, b.z - a.z);
        turn = Math.atan2(Math.sin(yaw - initial), Math.cos(yaw - initial));
        if (Math.abs(turn) > .6) break;
      }
      // Steering right decreases world yaw with the camera facing local +Z.
      expect(Math.sign(turn), `${definition.id} first corner`).toBe(FIRST_LEFT.includes(definition.id) ? 1 : -1);
    }
  });

  it('leaves the Singapore control line toward T1, T2, T3 in official order', () => {
    const definition = TRACKS.find(track => track.id === 'singapore')!;
    const path = new TrackPath(definition);
    expect(path.samples[1].z).toBeGreaterThan(0);
    const officialLandmarks = [
      [-53.3, 299.5], // T1, left
      [-161.7, 352.4], // T2, right
      [-199.7, 239.3], // T3, left
      [-561.2, -30.5], // onward toward T5 / Raffles Boulevard
    ] as const;
    let previous = 0;
    for (const [x, z] of officialLandmarks) {
      const position = path.nearest(-x, z);
      expect(position.progress).toBeGreaterThan(previous);
      expect(position.progress).toBeLessThan(.3);
      previous = position.progress;
    }
    // Correct-direction driving must complete a valid lap through the gates.
    const lap = new LapTracker(path.length);
    let progress = 0;
    let completed = null;
    for (let i = 1; i <= path.sampleCount; i++) {
      const point = path.samples[i];
      const position = path.nearest(point.x, point.z, progress);
      completed = lap.update(position.progress, false, 40, .1) ?? completed;
      progress = position.progress;
    }
    expect(completed?.valid).toBe(true);
    expect(completed?.newBest).toBe(true);
  });
});
