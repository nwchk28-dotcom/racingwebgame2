import * as THREE from 'three';
import { nativeCircuits } from './nativeCircuit';
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

  get native() { return nativeCircuits[this.definition.id]; }

  surfaceAt(x: number, z: number, hint?: number) {
    const p = this.nearest(x, z, hint);
    const data = this.native;
    if (!data) return { height: 0, gradientX: 0, gradientZ: 0, progress: p.progress };
    for (const area of data.corridor.escapeAreas ?? []) {
      let inside=false;
      for(let i=0,j=area.polygon.length-1;i<area.polygon.length;j=i++) {
        const a=area.polygon[i],b=area.polygon[j];
        if((a.z>z)!==(b.z>z) && x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
      }
      if(inside)return {height:area.height,gradientX:0,gradientZ:0,progress:p.progress};
    }
    const distance = p.progress * this.length;
    let lo = 0, hi = this.sampleCount;
    while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (this.distances[mid] <= distance) lo = mid; else hi = mid; }
    const t = (distance - this.distances[lo]) / Math.max(1e-9, this.distances[hi] - this.distances[lo]);
    const span=this.distances[hi]-this.distances[lo];
    const hermite=(k:number,slope:number) => {
      const a=data.surface[lo][k],b=data.surface[hi][k],u=data.surface[lo][slope]*span,v=data.surface[hi][slope]*span;
      return {value:(2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*u+(-2*t**3+3*t*t)*b+(t**3-t*t)*v,
        derivative:((6*t*t-6*t)*a+(3*t*t-4*t+1)*u+(-6*t*t+6*t)*b+(3*t*t-2*t)*v)/span};
    };
    // A polyline segment normal jumps at every sample. Interpolate the native
    // shared vertex normals so banking and grade have one limit at each join.
    const nx=data.normals[lo][0]*(1-t)+data.normals[hi][0]*t;
    const nz=data.normals[lo][1]*(1-t)+data.normals[hi][1]*t;
    const length=Math.hypot(nx,nz),normalX=nx/length,normalZ=nz/length;
    const offset=(x-p.centerX)*normalX+(z-p.centerZ)*normalZ;
    const elevation=hermite(0,1),banking=hermite(2,3),bank=Math.tan(banking.value);
    // C1 heights and gradients extend through the painted edges and runoff.
    const grade = elevation.derivative + offset * banking.derivative * (1 + bank * bank);
    return { height: elevation.value + offset * bank,
      gradientX: -normalZ * grade + normalX * bank,
      gradientZ: normalX * grade + normalZ * bank, progress: p.progress };
  }

  /** Smooth, cyclic width shared by the scene, walls and wheel validity checks. */
  roadHalfWidthAt(progress: number): number {
    if (this.native) {
      const d = ((progress % 1) + 1) % 1 * this.native.length;
      let lo=0, hi=this.native.distances.length-1;
      while(lo+1<hi) { const mid=(lo+hi)>>>1; if(this.native.distances[mid]<=d) lo=mid; else hi=mid; }
      const t=(d-this.native.distances[lo])/Math.max(1e-9,this.native.distances[hi]-this.native.distances[lo]);
      return this.native.widths[lo]*(1-t)+this.native.widths[hi]*t;
    }
    const nodes = this.definition.widthProfile;
    if (!nodes?.length) return this.definition.roadHalfWidth;
    const p = ((progress % 1) + 1) % 1;
    let low = 0;
    let high = nodes.length - 1;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (nodes[middle][0] <= p) low = middle;
      else high = middle;
    }
    const [from, a] = nodes[low];
    const [to, b] = nodes[high];
    const t = (p - from) / (to - from);
    const blend = t * t * (3 - 2 * t);
    return (a + (b - a) * blend) / 2;
  }

  curbOuterEdgeAt(progress: number): number {
    return this.roadHalfWidthAt(progress) + this.definition.curbWidth;
  }

  constructor(readonly definition: TrackDefinition) {
    // The onboard camera faces local +Z, whose screen-right is world -X.
    // Mirror source eastings into world space so the driver sees the same
    // left/right turns as the published circuit layout.
    const source = definition.points.map(([x, z]) => new THREE.Vector3(-x, 0, z));
    let getPoint: (fraction: number) => THREE.Vector3;
    let approximateLength: number;
    let sourceScale = 1;
    if (definition.id === 'monaco') {
      // Monaco's dense but uneven survey points contain visible straight-line
      // joints. Interpolate through them without averaging the Fairmont
      // hairpin inward, which would narrow its already tight driving lane.
      const curve = new THREE.CatmullRomCurve3(source, true, 'centripetal');
      curve.arcLengthDivisions = 4096;
      approximateLength = curve.getLength();
      getPoint = fraction => curve.getPointAt(fraction);
    } else if (definition.spline) {
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
      (definition.targetLength ?? approximateLength) /
      (definition.id === 'monaco' ? 1.6 : definition.spline ? 2 : 2.5),
    ));
    const rawSamples = Array.from({ length: this.sampleCount }, (_, i) => getPoint(i / this.sampleCount));
    if (definition.spline) {
      this.samples.push(...rawSamples);
    } else {
      // Smooth GPS point corners over roughly 30 m so a wide road and its curbs
      // do not fold through themselves at the tight chicanes.
      // Interpolate Monaco through the survey points, then apply only a small
      // local filter to remove GPS jitter. The broader filter used elsewhere
      // would pull the tight Fairmont hairpin inward.
      const sigma = definition.id === 'monaco' ? 2.5 : definition.smoothingSigma ?? 6;
      const radius = Math.ceil(sigma * 2.7);
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
        const line = new THREE.Vector3(-x * sourceScale, 0, z * sourceScale);
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
    if (this.native) {
      this.samples.length = 0;
      this.samples.push(...this.native.points.slice(0,-1).map(([x,z]) => new THREE.Vector3(x,0,z)));
      this.sampleCount = this.samples.length;
    }
    this.samples.push(this.samples[0].clone());
    for (let i = 1; i <= this.sampleCount; i++) {
      this.distances.push(this.distances[i - 1] + this.samples[i].distanceTo(this.samples[i - 1]));
    }
    if(this.native)this.distances.splice(0,this.distances.length,...this.native.distances);
    this.length = this.native?.length ?? this.distances[this.sampleCount];
    this.start = this.samples[0].clone();
    const first = this.samples[1].clone().sub(this.samples[0]);
    this.startYaw = Math.atan2(first.x, first.z);

    for (let i = 0; i < this.sampleCount; i++) {
      const previous = this.samples[(i - 1 + this.sampleCount) % this.sampleCount];
      const current = this.samples[i];
      const next = this.samples[i + 1];
      const before = current.clone().sub(previous).normalize();
      const after = next.clone().sub(current).normalize();
      // Monaco's source polyline has a few abrupt GPS corners. A wider road
      // needs a more gradual edge normal there, without moving the centerline.
      const tangent = definition.id === 'monaco'
        ? this.samples[(i + 3) % this.sampleCount].clone()
          .sub(this.samples[(i - 3 + this.sampleCount) % this.sampleCount]).normalize()
        : before.clone().add(after).normalize();
      const miter = definition.id === 'monaco' ? 1 :
        Math.min(1.35, 1 / Math.max(0.6, tangent.dot(after)));
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
    if (this.native) {
      this.normals.splice(0, this.normals.length, ...this.native.normals.map(([x,z]) => new THREE.Vector3(x,0,z)));
    }
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
        const progress = (this.distances[i] + (this.distances[i+1]-this.distances[i]) * t) / this.length % 1;
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
