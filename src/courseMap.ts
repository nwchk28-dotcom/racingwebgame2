import type { TrackPath } from './trackPath';

export interface CourseMap {
  outline: string;
  start: { x: number; y: number };
  project: (x: number, z: number) => { x: number; y: number };
}

/** Fit the same centerline used by physics and lap timing into the HUD SVG. */
export function createCourseMap(path: TrackPath): CourseMap {
  const points = path.samples.slice(0, path.sampleCount);
  const xs = points.map(point => point.x);
  const zs = points.map(point => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const scale = Math.min(152 / Math.max(maxX - minX, 1), 84 / Math.max(maxZ - minZ, 1));
  const left = 14 + (152 - (maxX - minX) * scale) / 2;
  const bottom = 116 - (84 - (maxZ - minZ) * scale) / 2;
  const project = (x: number, z: number) => ({
    // Undo TrackPath's world-space mirror: the HUD keeps the real layout.
    x: left + (maxX - x) * scale,
    y: bottom - (z - minZ) * scale,
  });
  const step = Math.max(1, Math.floor(path.sampleCount / 220));
  const coordinates: string[] = [];
  for (let i = 0; i < path.sampleCount; i += step) {
    const point = project(points[i].x, points[i].z);
    coordinates.push(`${point.x.toFixed(1)},${point.y.toFixed(1)}`);
  }
  const first = project(points[0].x, points[0].z);
  coordinates.push(`${first.x.toFixed(1)},${first.y.toFixed(1)}`);
  return { outline: coordinates.join(' '), start: first, project };
}
