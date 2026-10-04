import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Scene, Mesh } from 'three';
import { Track } from './track';
import { TRACKS } from './trackData';

beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 256, height: 256,
      getContext: () => ({ fillStyle: '', fillRect: () => undefined }),
    }),
  });
});
afterAll(() => vi.unstubAllGlobals());

describe('track scenes', () => {
  it('places new facilities outside the drivable road and releases the old scene', () => {
    const scene = new Scene();
    for (const definition of TRACKS) {
      const track = new Track(scene, definition);
      expect(scene.children).toContain(track.group);
      const tunnel = track.group.getObjectByName('monaco-tunnel');
      expect(Boolean(tunnel)).toBe(definition.id === 'monaco');
      expect(Boolean(track.group.getObjectByName('baku-turn-16-runoff')))
        .toBe(definition.id === 'baku');
      if (tunnel) {
        expect(tunnel.children).toHaveLength(4);
        const roof = tunnel.children[0] as Mesh;
        const heights = roof.geometry.getAttribute('position');
        for (let i = 0; i < heights.count; i++) expect(heights.getY(i)).toBeGreaterThan(8);
      }
      if (definition.id === 'sepang') {
        const pits = track.group.children.filter(child => child.name === 'pit-building');
        expect(pits).toHaveLength(5);
        for (const pit of pits) {
          expect(track.nearest(pit.position.x, pit.position.z).signedDistance).toBeLessThan(0);
        }
      }
      for (const collider of track.colliders) {
        expect(track.nearest(collider.x, collider.z).distance)
          .toBeGreaterThan(collider.radius + track.curbOuterEdge);
      }
      const mesh = track.group.children.find(child => child instanceof Mesh) as Mesh;
      let released = false;
      mesh.geometry.addEventListener('dispose', () => { released = true; });
      track.dispose();
      expect(released).toBe(true);
      expect(scene.children).not.toContain(track.group);
      expect(track.group.children).toHaveLength(0);
    }
  });
});
