import { describe, expect, it } from 'vitest';
import { TRACKS } from './trackData';
import { TrackPath } from './trackPath';
import { TrackWalls, WALL_ZONES } from './trackWalls';

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
});
