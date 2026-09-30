import type { TrackId } from './trackData';
import type { TrackPath } from './trackPath';

export type WallSide = 'left' | 'right' | 'both';
export interface WallZone { from: number; to: number; side: WallSide }
export interface WallSegment {
  ax: number; az: number; bx: number; bz: number;
  inwardX: number; inwardZ: number;
  twoSided?: boolean;
}
export interface WallContact { depth: number; normalX: number; normalZ: number }

// Approximate close-barrier stretches in lap order. The omitted stretches have
// grass, asphalt or gravel between the track edge and the distant perimeter.
// Side is from the driver's view, not from the source map's east/west axes.
// See TRACKSIDE_REFERENCES.md for the circuit evidence and fidelity limits.
export const WALL_ZONES: Record<TrackId, readonly WallZone[]> = {
  monza: [
    { from: 0, to: .055, side: 'right' }, { from: .925, to: 1, side: 'right' },
  ],
  silverstone: [
    { from: 0, to: .055, side: 'right' }, { from: .945, to: 1, side: 'right' },
  ],
  'albert-park': [
    { from: 0, to: .11, side: 'right' }, { from: .16, to: .25, side: 'left' },
    { from: .35, to: .43, side: 'right' }, { from: .57, to: .65, side: 'left' },
    { from: .75, to: .83, side: 'right' }, { from: .90, to: 1, side: 'right' },
  ],
  'mexico-city': [
    { from: 0, to: .12, side: 'right' }, { from: .36, to: .43, side: 'left' },
    { from: .70, to: .86, side: 'both' }, { from: .90, to: 1, side: 'right' },
  ],
  'gilles-villeneuve': [
    { from: 0, to: .14, side: 'right' }, { from: .20, to: .36, side: 'left' },
    { from: .39, to: .55, side: 'right' }, { from: .63, to: .71, side: 'left' },
    { from: .77, to: .89, side: 'right' }, { from: .90, to: .98, side: 'right' },
  ],
  monaco: [
    { from: 0, to: .59, side: 'both' },
    { from: .59, to: .65, side: 'left' }, // Nouvelle Chicane escape area
    { from: .65, to: 1, side: 'both' },
  ],
  spa: [
    { from: 0, to: .055, side: 'right' }, { from: .13, to: .18, side: 'left' },
    { from: .85, to: .92, side: 'right' }, { from: .96, to: 1, side: 'right' },
  ],
  'sao-paulo': [
    { from: 0, to: .11, side: 'right' }, { from: .54, to: .65, side: 'left' },
    { from: .82, to: 1, side: 'right' },
  ],
  jeddah: [
    { from: 0, to: .065, side: 'both' }, { from: .065, to: .10, side: 'left' },
    { from: .10, to: .37, side: 'both' }, { from: .37, to: .43, side: 'right' },
    { from: .43, to: .70, side: 'both' }, { from: .70, to: .74, side: 'left' },
    { from: .74, to: .93, side: 'both' }, { from: .93, to: .97, side: 'right' },
    { from: .97, to: 1, side: 'both' },
  ],
  baku: [
    { from: 0, to: .14, side: 'both' }, { from: .14, to: .21, side: 'left' },
    { from: .21, to: .54, side: 'both' }, { from: .54, to: .59, side: 'right' },
    // Turn 16 is a left-hander at about 60.6% of the lap. Its outside (right)
    // has an escape/run-off road; the distant wall at the end of it is not a
    // curbside barrier. Keep the inside wall, then resume both sides after it.
    { from: .59, to: .64, side: 'left' },
    { from: .64, to: .84, side: 'both' }, { from: .84, to: .90, side: 'left' },
    { from: .90, to: 1, side: 'both' },
  ],
  'abu-dhabi': [
    { from: 0, to: .09, side: 'right' }, { from: .54, to: .65, side: 'left' },
    { from: .67, to: .77, side: 'both' }, { from: .80, to: .91, side: 'left' },
    { from: .94, to: 1, side: 'right' },
  ],
  singapore: [
    { from: 0, to: .14, side: 'both' }, { from: .14, to: .18, side: 'right' },
    { from: .18, to: .43, side: 'both' }, { from: .43, to: .48, side: 'left' },
    { from: .48, to: .74, side: 'both' }, { from: .74, to: .78, side: 'right' },
    { from: .78, to: 1, side: 'both' },
  ],
  shanghai: [
    // Keep the physical wall locations after moving the lap origin from the
    // post-T1 section to the pit straight (about +0.25 lap in new progress).
    { from: .048, to: .118, side: 'right' },
    { from: .188, to: .338, side: 'right' },
    { from: .668, to: .738, side: 'left' },
  ],
  bahrain: [
    { from: 0, to: .09, side: 'right' }, { from: .31, to: .38, side: 'left' },
    { from: .53, to: .62, side: 'right' }, { from: .91, to: 1, side: 'right' },
  ],
  miami: [
    { from: 0, to: .11, side: 'both' }, { from: .11, to: .17, side: 'right' },
    { from: .17, to: .40, side: 'both' }, { from: .40, to: .47, side: 'left' },
    { from: .47, to: .72, side: 'both' }, { from: .72, to: .79, side: 'right' },
    { from: .79, to: 1, side: 'both' },
  ],
  imola: [
    { from: 0, to: .12, side: 'right' }, { from: .19, to: .29, side: 'left' },
    { from: .38, to: .46, side: 'right' }, { from: .60, to: .68, side: 'left' },
    { from: .82, to: 1, side: 'right' },
  ],
  barcelona: [
    { from: 0, to: .13, side: 'right' }, { from: .45, to: .54, side: 'left' },
    { from: .87, to: 1, side: 'right' },
  ],
  austria: [
    { from: 0, to: .12, side: 'right' }, { from: .23, to: .31, side: 'left' },
    { from: .65, to: .73, side: 'right' }, { from: .89, to: 1, side: 'right' },
  ],
  hungary: [
    { from: 0, to: .11, side: 'right' }, { from: .26, to: .34, side: 'left' },
    { from: .53, to: .61, side: 'right' }, { from: .88, to: 1, side: 'right' },
  ],
  zandvoort: [
    { from: 0, to: .13, side: 'right' }, { from: .16, to: .30, side: 'left' },
    { from: .34, to: .48, side: 'right' }, { from: .53, to: .62, side: 'left' },
    { from: .68, to: .82, side: 'right' }, { from: .88, to: 1, side: 'right' },
  ],
  austin: [
    { from: 0, to: .10, side: 'right' }, { from: .40, to: .49, side: 'left' },
    { from: .90, to: 1, side: 'right' },
  ],
  'las-vegas': [
    { from: 0, to: .12, side: 'both' }, { from: .12, to: .19, side: 'left' },
    { from: .19, to: .52, side: 'both' }, { from: .52, to: .58, side: 'right' },
    { from: .58, to: .90, side: 'both' }, { from: .90, to: .95, side: 'left' },
    { from: .95, to: 1, side: 'both' },
  ],
  lusail: [
    { from: 0, to: .10, side: 'right' }, { from: .29, to: .37, side: 'left' },
    { from: .64, to: .71, side: 'right' }, { from: .91, to: 1, side: 'right' },
  ],
};

const CELL_SIZE = 24;
const key = (x: number, z: number) => `${x},${z}`;

interface SharedEdgePoint { x: number; z: number; otherIndex: number }

function hasWall(zones: readonly WallZone[], progress: number, side: -1 | 1): boolean {
  const name = side === 1 ? 'left' : 'right';
  return zones.some(zone => progress >= zone.from && progress < zone.to &&
    (zone.side === 'both' || zone.side === name));
}

function sharedTrackEdges(path: TrackPath, zones: readonly WallZone[], offset: number): Map<string, SharedEdgePoint> {
  const shared = new Map<string, SharedEdgePoint>();
  const limitSquared = (offset * 2 + 3.5) ** 2;
  const sampleCellSize = 32;
  const pointCells = new Map<string, number[]>();
  for (let i = 0; i < path.sampleCount; i++) {
    const point = path.samples[i];
    const cell = key(Math.floor(point.x / sampleCellSize), Math.floor(point.z / sampleCellSize));
    const list = pointCells.get(cell) ?? [];
    list.push(i);
    pointCells.set(cell, list);
  }
  for (let i = 0; i < path.sampleCount; i++) {
    const point = path.samples[i];
    const normal = path.normals[i];
    for (const side of [-1, 1] as const) {
      if (!hasWall(zones, path.distances[i] / path.length, side)) continue;
      let closest = -1;
      let closestSquared = limitSquared;
      const cellX = Math.floor(point.x / sampleCellSize);
      const cellZ = Math.floor(point.z / sampleCellSize);
      for (let cx = cellX - 1; cx <= cellX + 1; cx++) {
        for (let cz = cellZ - 1; cz <= cellZ + 1; cz++) {
          for (const j of pointCells.get(key(cx, cz)) ?? []) {
            const separation = Math.abs(path.distances[i] - path.distances[j]);
            if (Math.min(separation, path.length - separation) < 35) continue;
            const alignment = normal.dot(path.normals[j]);
            if (Math.abs(alignment) < .72) continue;
            const otherSide = (alignment < 0 ? side : -side) as -1 | 1;
            if (!hasWall(zones, path.distances[j] / path.length, otherSide)) continue;
            const dx = path.samples[j].x - point.x;
            const dz = path.samples[j].z - point.z;
            const squared = dx * dx + dz * dz;
            if (squared >= closestSquared) continue;
            if ((dx * normal.x + dz * normal.z) * side < Math.sqrt(squared) * .78) continue;
            closest = j;
            closestSquared = squared;
          }
        }
      }
      if (closest >= 0) {
        const other = path.samples[closest];
        shared.set(key(i, side), {
          x: (point.x + other.x) / 2,
          z: (point.z + other.z) / 2,
          otherIndex: closest,
        });
      }
    }
  }
  return shared;
}

function foldedWallSegments(path: TrackPath, offset: number): Set<string> {
  const folded = new Set<string>();
  for (let i = 0; i < path.sampleCount; i++) {
    const a = path.samples[i];
    const b = path.samples[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const distanceSquared = dx * dx + dz * dz;
    for (const side of [-1, 1] as const) {
      const edgeX = dx + (path.normals[i + 1].x - path.normals[i].x) * side * offset;
      const edgeZ = dz + (path.normals[i + 1].z - path.normals[i].z) * side * offset;
      if ((edgeX * dx + edgeZ * dz) / distanceSquared >= .4) continue;
      // A constant-width offset can fold back at a hairpin with a radius
      // smaller than the wall setback. Leave a short opening rather than
      // creating an inward-facing collision pocket at the fold.
      for (let neighbor = -4; neighbor <= 4; neighbor++) {
        folded.add(key((i + neighbor + path.sampleCount) % path.sampleCount, side));
      }
    }
  }
  return folded;
}

export class TrackWalls {
  readonly segments: WallSegment[] = [];
  private readonly cells = new Map<string, number[]>();

  constructor(path: TrackPath, curbOuterEdge: number) {
    const offset = curbOuterEdge + 1.45;
    const zones = WALL_ZONES[path.definition.id];
    const sharedEdges = sharedTrackEdges(path, zones, offset);
    const foldedEdges = foldedWallSegments(path, offset);
    for (let i = 0; i < path.sampleCount; i++) {
      const progress = (path.distances[i] + path.distances[i + 1]) / (2 * path.length);
      const a = path.samples[i];
      const b = path.samples[i + 1];
      for (const side of [-1, 1] as const) {
        if (!hasWall(zones, progress, side)) continue;
        const startShared = sharedEdges.get(key(i, side));
        const endShared = sharedEdges.get(key((i + 1) % path.sampleCount, side));
        const shared = startShared ?? endShared;
        // The earlier arm owns the shared barrier. The later arm must not
        // build a second row on its side of the same narrow strip of land.
        if (shared && i > shared.otherIndex) continue;
        if (!shared && foldedEdges.has(key(i, side))) continue;
        const an = path.normals[i];
        const bn = path.normals[i + 1];
        const ax = startShared?.x ?? a.x + an.x * side * offset;
        const az = startShared?.z ?? a.z + an.z * side * offset;
        const bx = endShared?.x ?? b.x + bn.x * side * offset;
        const bz = endShared?.z ?? b.z + bn.z * side * offset;
        const length = Math.hypot(bx - ax, bz - az);
        if (length < 0.001) continue;
        const roadX = b.x - a.x;
        const roadZ = b.z - a.z;
        if ((bx - ax) * roadX + (bz - az) * roadZ <= 0) continue;
        const inwardX = side * (az - bz) / length;
        const inwardZ = side * (bx - ax) / length;
        const index = this.segments.push({ ax, az, bx, bz, inwardX, inwardZ,
          twoSided: Boolean(shared) }) - 1;
        for (let cx = Math.floor((Math.min(ax, bx) - 1) / CELL_SIZE);
          cx <= Math.floor((Math.max(ax, bx) + 1) / CELL_SIZE); cx++) {
          for (let cz = Math.floor((Math.min(az, bz) - 1) / CELL_SIZE);
            cz <= Math.floor((Math.max(az, bz) + 1) / CELL_SIZE); cz++) {
            const cell = key(cx, cz);
            const list = this.cells.get(cell) ?? [];
            list.push(index);
            this.cells.set(cell, list);
          }
        }
      }
    }
  }

  contact(x: number, z: number, radius: number): WallContact | null {
    const candidates = this.cells.get(key(Math.floor(x / CELL_SIZE), Math.floor(z / CELL_SIZE)));
    if (!candidates) return null;
    let best: WallContact | null = null;
    for (const index of candidates) {
      const wall = this.segments[index];
      const dx = wall.bx - wall.ax;
      const dz = wall.bz - wall.az;
      const t = ((x - wall.ax) * dx + (z - wall.az) * dz) / (dx * dx + dz * dz);
      if (t < -.12 || t > 1.12) continue;
      const inwardDistance = (x - wall.ax) * wall.inwardX + (z - wall.az) * wall.inwardZ;
      const depth = radius - (wall.twoSided ? Math.abs(inwardDistance) : inwardDistance);
      if (depth <= 0 || depth > 5 || (best && depth <= best.depth)) continue;
      const direction = wall.twoSided && inwardDistance < 0 ? -1 : 1;
      best = { depth, normalX: wall.inwardX * direction, normalZ: wall.inwardZ * direction };
    }
    return best;
  }
}
