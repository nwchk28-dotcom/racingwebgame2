import { describe, expect, it } from 'vitest';
import { TRACKS } from './trackData';
import { TrackPath } from './trackPath';

const pathFor = (id: string) => new TrackPath(TRACKS.find(track => track.id === id)!);

describe('circuit widths in metres', () => {
  it('reflects published width ranges at the wide straights and narrow city section', () => {
    const sepang = pathFor('sepang');
    expect(sepang.roadHalfWidthAt(0) * 2).toBe(22);
    expect(sepang.roadHalfWidthAt(.5) * 2).toBe(16);
    expect(sepang.roadHalfWidthAt(.85) * 2).toBe(22);
    const baku = pathFor('baku');
    expect(baku.roadHalfWidthAt(0) * 2).toBe(13);
    expect(baku.roadHalfWidthAt(.437) * 2).toBe(7.6);
    const shanghai = pathFor('shanghai');
    expect(shanghai.roadHalfWidthAt(.3) * 2).toBe(14);
    expect(shanghai.roadHalfWidthAt(.7) * 2).toBe(20);
  });

  it('has continuous widths across every transition and the finish-line wrap', () => {
    for (const definition of TRACKS) {
      const path = new TrackPath(definition);
      const nodes = definition.widthProfile;
      if (nodes) {
        expect(nodes[0][0]).toBe(0);
        expect(nodes.at(-1)![0]).toBe(1);
        expect(nodes.at(-1)![1]).toBe(nodes[0][1]);
        for (let i = 1; i < nodes.length; i++) expect(nodes[i][0]).toBeGreaterThan(nodes[i - 1][0]);
        for (const [progress] of nodes) {
          expect(Math.abs(path.roadHalfWidthAt(progress - 1e-6) -
            path.roadHalfWidthAt(progress + 1e-6))).toBeLessThan(.001);
        }
      }
      for (let i = 0; i < path.sampleCount; i++) {
        const p = path.distances[i] / path.length;
        expect(path.curbOuterEdgeAt(p) - path.roadHalfWidthAt(p)).toBeCloseTo(definition.curbWidth, 9);
        expect(Math.abs(path.roadHalfWidthAt(p) - path.roadHalfWidthAt(path.distances[i + 1] / path.length)),
          definition.id).toBeLessThan(.18);
      }
    }
  });
});
