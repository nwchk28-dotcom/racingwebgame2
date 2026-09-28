import type { TrackId } from './trackData';
import type { TrackPath } from './trackPath';

export type WallSide = 'left' | 'right' | 'both';
export interface WallZone { from: number; to: number; side: WallSide }
export interface WallSegment {
  ax: number; az: number; bx: number; bz: number;
  inwardX: number; inwardZ: number;
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
    { from: .59, to: .84, side: 'both' }, { from: .84, to: .90, side: 'left' },
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
};

const CELL_SIZE = 24;
const key = (x: number, z: number) => `${x},${z}`;

export class TrackWalls {
  readonly segments: WallSegment[] = [];
  private readonly cells = new Map<string, number[]>();

  constructor(path: TrackPath, curbOuterEdge: number) {
    const offset = curbOuterEdge + 1.45;
    const zones = WALL_ZONES[path.definition.id];
    for (let i = 0; i < path.sampleCount; i++) {
      const progress = (path.distances[i] + path.distances[i + 1]) / (2 * path.length);
      const a = path.samples[i];
      const b = path.samples[i + 1];
      for (const side of [-1, 1] as const) {
        const name = side === 1 ? 'left' : 'right';
        if (!zones.some(zone => progress >= zone.from && progress < zone.to &&
          (zone.side === 'both' || zone.side === name))) continue;
        const an = path.normals[i];
        const bn = path.normals[i + 1];
        const ax = a.x + an.x * side * offset;
        const az = a.z + an.z * side * offset;
        const bx = b.x + bn.x * side * offset;
        const bz = b.z + bn.z * side * offset;
        const length = Math.hypot(bx - ax, bz - az);
        if (length < 0.001) continue;
        const inwardX = side * (az - bz) / length;
        const inwardZ = side * (bx - ax) / length;
        const index = this.segments.push({ ax, az, bx, bz, inwardX, inwardZ }) - 1;
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
      const depth = radius - inwardDistance;
      if (depth <= 0 || depth > 5 || (best && depth <= best.depth)) continue;
      best = { depth, normalX: wall.inwardX, normalZ: wall.inwardZ };
    }
    return best;
  }
}
