import * as THREE from 'three';
import type { TrackDefinition } from './trackData';

export interface TrackPosition {
  progress: number;
  distance: number;
  centerX: number;
  centerZ: number;
  normalX: number;
  normalZ: number;
  signedDistance: number;
}

const CELL_SIZE = 32;

export class TrackPath {
  readonly samples: THREE.Vector3[] = [];
  readonly normals: THREE.Vector3[] = [];
  readonly distances: number[] = [0];
  readonly sampleCount: number;
  readonly length: number;
  readonly start: THREE.Vector3;
  readonly startYaw: number;
  private readonly cells = new Map<string, number[]>();

  constructor(readonly definition: TrackDefinition) {
    const source = definition.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    let getPoint: (fraction: number) => THREE.Vector3;
    let approximateLength: number;
    let sourceScale = 1;
    if (definition.spline) {
      const curve = new THREE.CatmullRomCurve3(source, true, 'catmullrom', 1);
      approximateLength = curve.getLength();
      getPoint = fraction => curve.getPointAt(fraction);
    } else {
      const cumulative = [0];
      for (let i = 0; i < source.length; i++) {
        cumulative.push(cumulative[i] + source[i].distanceTo(source[(i + 1) % source.length]));
      }
      approximateLength = cumulative[source.length];
      const scale = (definition.targetLength ?? approximateLength) / approximateLength;
      sourceScale = scale;
      getPoint = fraction => {
        const distance = fraction * approximateLength;
        let low = 0;
        let high = source.length;
        while (low + 1 < high) {
          const middle = (low + high) >>> 1;
          if (cumulative[middle] <= distance) low = middle;
          else high = middle;
        }
        const width = cumulative[low + 1] - cumulative[low];
        return source[low].clone().lerp(source[(low + 1) % source.length],
          width > 0 ? (distance - cumulative[low]) / width : 0).multiplyScalar(scale);
      };
    }

    this.sampleCount = Math.max(definition.spline ? 1440 : 0, Math.ceil(
      (definition.targetLength ?? approximateLength) / (definition.spline ? 2 : 2.5),
    ));
    const rawSamples = Array.from({ length: this.sampleCount }, (_, i) => getPoint(i / this.sampleCount));
    if (definition.spline) {
      this.samples.push(...rawSamples);
    } else {
      // Smooth GPS point corners over roughly 30 m so a wide road and its curbs
      // do not fold through themselves at the tight chicanes.
      const radius = 16;
      const sigma = 6;
      for (let i = 0; i < this.sampleCount; i++) {
        const point = new THREE.Vector3();
        let total = 0;
        for (let j = -radius; j <= radius; j++) {
          const weight = Math.exp(-0.5 * (j / sigma) ** 2);
          point.addScaledVector(rawSamples[(i + j + this.sampleCount) % this.sampleCount], weight);
          total += weight;
        }
        this.samples.push(point.multiplyScalar(1 / total));
      }
      let smoothedLength = 0;
      for (let i = 0; i < this.sampleCount; i++) {
        smoothedLength += this.samples[i].distanceTo(this.samples[(i + 1) % this.sampleCount]);
      }
      if (definition.timingLine) {
        const [x, z] = definition.timingLine;
        const line = new THREE.Vector3(x * sourceScale, 0, z * sourceScale);
        let closest = 0;
        for (let i = 1; i < this.sampleCount; i++) {
          if (this.samples[i].distanceToSquared(line) < this.samples[closest].distanceToSquared(line)) closest = i;
        }
        // Lap progress, the painted line, spawn and map marker now share this origin.
        this.samples.push(...this.samples.splice(0, closest));
      }
      const origin = this.samples[0].clone();
      const scale = (definition.targetLength ?? smoothedLength) / smoothedLength;
      for (const point of this.samples) point.sub(origin).multiplyScalar(scale);
    }
    this.samples.push(this.samples[0].clone());
    for (let i = 1; i <= this.sampleCount; i++) {
      this.distances.push(this.distances[i - 1] + this.samples[i].distanceTo(this.samples[i - 1]));
    }
    this.length = this.distances[this.sampleCount];
    this.start = this.samples[0].clone();
    const first = this.samples[1].clone().sub(this.samples[0]);
    this.startYaw = Math.atan2(first.x, first.z);

    for (let i = 0; i < this.sampleCount; i++) {
      const previous = this.samples[(i - 1 + this.sampleCount) % this.sampleCount];
      const current = this.samples[i];
      const next = this.samples[i + 1];
      const before = current.clone().sub(previous).normalize();
      const after = next.clone().sub(current).normalize();
      const tangent = before.clone().add(after).normalize();
      const miter = Math.min(1.35, 1 / Math.max(0.6, tangent.dot(after)));
      this.normals.push(new THREE.Vector3(tangent.z * miter, 0, -tangent.x * miter));

      const minX = Math.floor(Math.min(current.x, next.x) / CELL_SIZE);
      const maxX = Math.floor(Math.max(current.x, next.x) / CELL_SIZE);
      const minZ = Math.floor(Math.min(current.z, next.z) / CELL_SIZE);
      const maxZ = Math.floor(Math.max(current.z, next.z) / CELL_SIZE);
      for (let cellX = minX; cellX <= maxX; cellX++) {
        for (let cellZ = minZ; cellZ <= maxZ; cellZ++) {
          const key = `${cellX},${cellZ}`;
          const list = this.cells.get(key) ?? [];
          list.push(i);
          this.cells.set(key, list);
        }
      }
    }
    this.normals.push(this.normals[0].clone());
  }

  nearest(x: number, z: number, progressHint?: number): TrackPosition {
    const cellX = Math.floor(x / CELL_SIZE);
    const cellZ = Math.floor(z / CELL_SIZE);
    const candidates = new Set<number>();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const index of this.cells.get(`${cellX + dx},${cellZ + dz}`) ?? []) candidates.add(index);
      }
    }
    const scan = (indices: Iterable<number>): TrackPosition => {
      let best: TrackPosition | null = null;
      let bestHintDifference = Infinity;
      for (const i of indices) {
        const a = this.samples[i];
        const b = this.samples[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const segmentLengthSquared = dx * dx + dz * dz;
        if (segmentLengthSquared < 1e-9) continue;
        const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / segmentLengthSquared, 0, 1);
        const rx = x - (a.x + dx * t);
        const rz = z - (a.z + dz * t);
        const distance = Math.hypot(rx, rz);
        const progress = (this.distances[i] + Math.sqrt(segmentLengthSquared) * t) / this.length % 1;
        const hintDifference = progressHint === undefined ? 0 :
          Math.min(Math.abs(progress - progressHint), 1 - Math.abs(progress - progressHint));
        const tolerance = progressHint === undefined ? 0 : 0.5;
        if (best && (distance > best.distance + tolerance ||
          (Math.abs(distance - best.distance) <= tolerance &&
            (hintDifference > bestHintDifference ||
              (hintDifference === bestHintDifference && distance >= best.distance))))) continue;
        const segmentLength = Math.sqrt(segmentLengthSquared);
        const normalX = dz / segmentLength;
        const normalZ = -dx / segmentLength;
        best = {
          progress, distance, centerX: a.x + dx * t, centerZ: a.z + dz * t,
          normalX, normalZ, signedDistance: rx * normalX + rz * normalZ,
        };
        bestHintDifference = hintDifference;
      }
      return best ?? {
        progress: 0, distance: Infinity, centerX: 0, centerZ: 0,
        normalX: 1, normalZ: 0, signedDistance: Infinity,
      };
    };
    const nearby = scan(candidates);
    if (nearby.distance < CELL_SIZE) return nearby;
    return scan(Array.from({ length: this.sampleCount }, (_, i) => i));
  }
}
