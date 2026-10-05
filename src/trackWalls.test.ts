import { describe, expect, it } from 'vitest';
import { TRACKS } from './trackData';
import { TrackPath } from './trackPath';
import { TrackWalls, WALL_ZONES } from './trackWalls';
import { CarPhysics } from './physics';

function pointAt(path: TrackPath, fraction: number, side: number, offset: number) {
  const i = path.distances.findIndex(distance => distance / path.length >= fraction);
  const index = Math.min(path.sampleCount - 1, Math.max(0, i));
  const point = path.samples[index];
  const normal = path.normals[index].clone().normalize();
  return [point.x + normal.x * side * offset, point.z + normal.z * side * offset] as const;
}

describe('trackside walls', () => {
  it('has independently placed left and right wall zones for every circuit', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      const walls = new TrackWalls(path, definition.roadHalfWidth + definition.curbWidth);
      expect(walls.segments.length, definition.id).toBeGreaterThan(0);
      expect(WALL_ZONES[definition.id].some(zone => zone.side !== 'both'), definition.id).toBe(true);
    }
  });

  it('blocks Monaco on both sides through the tunnel but leaves Monza runoff open', () => {
    const monaco = TRACKS.find(track => track.id === 'monaco')!;
    const monacoPath = new TrackPath(monaco);
    const monacoWalls = new TrackWalls(monacoPath, monaco.roadHalfWidth + monaco.curbWidth);
    const monacoOffset = monaco.roadHalfWidth + monaco.curbWidth + 1.4;
    for (const side of [-1, 1]) {
      const [x, z] = pointAt(monacoPath, .51, side, monacoOffset);
      expect(monacoWalls.contact(x, z, .35)?.depth).toBeGreaterThan(0);
    }

    const monza = TRACKS.find(track => track.id === 'monza')!;
    const monzaPath = new TrackPath(monza);
    const monzaWalls = new TrackWalls(monzaPath, monza.roadHalfWidth + monza.curbWidth);
    const monzaOffset = monza.roadHalfWidth + monza.curbWidth + 1.4;
    const [wallX, wallZ] = pointAt(monzaPath, .025, -1, monzaOffset);
    expect(monzaWalls.contact(wallX, wallZ, .35)).not.toBeNull();
    const [openX, openZ] = pointAt(monzaPath, .4, -1, monzaOffset);
    expect(monzaWalls.contact(openX, openZ, .35)).toBeNull();
  });

  it('leaves the outside of Baku Turn 16 open while retaining its inside wall', () => {
    const definition = TRACKS.find(track => track.id === 'baku')!;
    const path = new TrackPath(definition);
    const walls = new TrackWalls(path, definition.roadHalfWidth + definition.curbWidth);
    const offset = definition.roadHalfWidth + definition.curbWidth + 1.4;
    const [outsideX, outsideZ] = pointAt(path, .615, -1, offset);
    const [insideX, insideZ] = pointAt(path, .615, 1, offset);
    expect(walls.contact(outsideX, outsideZ, .35)).toBeNull();
    expect(walls.contact(insideX, insideZ, .35)?.depth).toBeGreaterThan(0);
  });

  it('does not intrude onto the sampled racing centerlines', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      const walls = new TrackWalls(path, definition.roadHalfWidth + definition.curbWidth);
      for (let i = 0; i < path.sampleCount; i += 3) {
        const point = path.samples[i];
        expect(walls.contact(point.x, point.z, 1.9), `${definition.id} at ${i}`).toBeNull();
      }
    }
  });

  it('uses one two-sided wall between the Monaco hairpin arms and leaves room to drive', () => {
    const definition = TRACKS.find(track => track.id === 'monaco')!;
    const path = new TrackPath(definition);
    const walls = new TrackWalls(path, definition.roadHalfWidth + definition.curbWidth);
    const shared = walls.segments.filter(segment => segment.twoSided);
    expect(shared.length).toBeGreaterThan(20);
    for (let i = 0; i < path.sampleCount; i++) {
      const fraction = path.distances[i] / path.length;
      if (fraction < .34 || fraction > .42) continue;
      const point = path.samples[i];
      const normal = path.normals[i];
      // A centered car can move several metres toward either curb without
      // its body being hit by a wall generated from the opposite road arm.
      for (const side of [-1, 1]) {
        expect(walls.contact(point.x + normal.x * side * 3.8,
          point.z + normal.z * side * 3.8, .28), `Monaco ${fraction.toFixed(3)} side ${side}`)
          .toBeNull();
      }
    }
    const wall = shared[Math.floor(shared.length / 2)];
    const x = (wall.ax + wall.bx) / 2;
    const z = (wall.az + wall.bz) / 2;
    const a = walls.contact(x + wall.inwardX * .1, z + wall.inwardZ * .1, .35)!;
    const b = walls.contact(x - wall.inwardX * .1, z - wall.inwardZ * .1, .35)!;
    expect(a.normalX * b.normalX + a.normalZ * b.normalZ).toBeLessThan(-.9);
  });

  it('does not pin a stopped car against either side of the Monaco hairpin', () => {
    const definition = TRACKS.find(track => track.id === 'monaco')!;
    const path = new TrackPath(definition);
    const walls = new TrackWalls(path, definition.roadHalfWidth + definition.curbWidth);
    for (let i = 450; i < 565; i += 3) {
      const point = path.samples[i];
      const next = path.samples[i + 1];
      for (const side of [-1, 0, 1]) {
        const car = new CarPhysics({
          start: path.start, startYaw: path.startYaw,
          curbOuterEdge: definition.roadHalfWidth + definition.curbWidth,
          outerFence: { centerX: 0, centerZ: 0, radius: 1e6 },
          colliders: [], walls, nearest: path.nearest.bind(path),
        });
        car.x = point.x + path.normals[i].x * side * 1.5;
        car.z = point.z + path.normals[i].z * side * 1.5;
        car.yaw = Math.atan2(next.x - point.x, next.z - point.z);
        car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
        expect(car.collided, `Monaco sample ${i}, lane ${side}`).toBe(false);
      }
    }
  });

  it('keeps a car clear of walls throughout the drivable corridor on every circuit', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      const walls = new TrackWalls(path, definition.roadHalfWidth + definition.curbWidth);
      const car = new CarPhysics({
        start: path.start, startYaw: path.startYaw,
        curbOuterEdge: definition.roadHalfWidth + definition.curbWidth,
        outerFence: { centerX: 0, centerZ: 0, radius: 1e6 },
        colliders: [], walls, nearest: path.nearest.bind(path),
      });
      const laneOffset = Math.min(4, definition.roadHalfWidth - 2.2);
      for (let i = 0; i < path.sampleCount; i++) {
        const point = path.samples[i];
        const next = path.samples[i + 1];
        const yaw = Math.atan2(next.x - point.x, next.z - point.z);
        for (const side of [-1, 0, 1]) {
          car.x = point.x + path.normals[i].x * side * laneOffset;
          car.z = point.z + path.normals[i].z * side * laneOffset;
          car.yaw = yaw;
          car.vx = car.vz = car.yawRate = 0;
          car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
          expect(car.collided, `${definition.id} at ${(path.distances[i] / path.length).toFixed(3)} side ${side}`)
            .toBe(false);
        }
      }
    }
  });

  it('leaves Spa La Source and Baku close parallel streets free of collision pockets', () => {
    for (const [trackId, fractions, offset] of [
      ['spa', [.032, .033, .034, .035, .036], 7],
      ['baku', [.389, .390, .763, .769], 4],
    ] as const) {
      const definition = TRACKS.find(track => track.id === trackId)!;
      const path = new TrackPath(definition);
      const walls = new TrackWalls(path, definition.roadHalfWidth + definition.curbWidth);
      const car = new CarPhysics({
        start: path.start, startYaw: path.startYaw,
        curbOuterEdge: definition.roadHalfWidth + definition.curbWidth,
        outerFence: { centerX: 0, centerZ: 0, radius: 1e6 },
        colliders: [], walls, nearest: path.nearest.bind(path),
      });
      for (const fraction of fractions) {
        const i = path.distances.findIndex(distance => distance / path.length >= fraction);
        const point = path.samples[i];
        const next = path.samples[i + 1];
        car.x = point.x + path.normals[i].x * offset;
        car.z = point.z + path.normals[i].z * offset;
        car.yaw = Math.atan2(next.x - point.x, next.z - point.z);
        car.vx = car.vz = car.yawRate = 0;
        car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
        expect(car.collided, `${trackId} at ${fraction}`).toBe(false);
      }
      if (trackId === 'baku') expect(walls.segments.some(segment => segment.twoSided)).toBe(true);
    }
  });
  it('keeps Sepang pit walls on the right and opens the outside of T1 and T15', () => {
    const definition = TRACKS.find(track => track.id === 'sepang')!;
    const path = new TrackPath(definition);
    const walls = new TrackWalls(path, definition.roadHalfWidth + definition.curbWidth);
    const offset = definition.roadHalfWidth + definition.curbWidth + 1.4;
    for (const fraction of [.02, .98]) {
      const right = pointAt(path, fraction, -1, offset);
      const left = pointAt(path, fraction, 1, offset);
      expect(walls.contact(...right, .35)?.depth).toBeGreaterThan(0);
      expect(walls.contact(...left, .35)).toBeNull();
    }
    for (const [fraction, side] of [[.13, 1], [.945, -1]]) {
      const outside = pointAt(path, fraction, side, offset);
      expect(walls.contact(...outside, .35)).toBeNull();
    }
  });

  it('swaps Singapore driver-relative escape sides after reversing lap order', () => {
    const definition = TRACKS.find(track => track.id === 'singapore')!;
    const path = new TrackPath(definition);
    const walls = new TrackWalls(path, definition.roadHalfWidth + definition.curbWidth);
    const offset = definition.roadHalfWidth + definition.curbWidth + 1.4;
    for (const [fraction, wallSide] of [[.24, 1], [.545, -1], [.84, 1]]) {
      const blocked = pointAt(path, fraction, wallSide, offset);
      const open = pointAt(path, fraction, -wallSide, offset);
      expect(walls.contact(...blocked, .35)?.depth).toBeGreaterThan(0);
      expect(walls.contact(...open, .35)).toBeNull();
    }
  });

});
