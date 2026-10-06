import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Scene, Mesh, Box3, Vector3 } from 'three';
import { Track } from './track';
import { TRACKS } from './trackData';
import { CarVisual } from './car';

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
  it('keeps the car two metres wide with the reference onboard framing', () => {
    const car = new CarVisual();
    const size = new Box3().setFromObject(car.model).getSize(new Vector3());
    expect(size.x).toBeCloseTo(2, 5);
    expect(car.camera.parent).toBe(car.group);
    expect(car.camera.position.y).toBe(2.05);
    expect(car.camera.fov).toBe(40);
  });

  it('keeps both front tyre tops inside landscape frames with road above them', () => {
    const car = new CarVisual();
    for (const aspect of [16 / 9, 844 / 390]) {
      car.camera.aspect = aspect;
      car.camera.updateProjectionMatrix();
      car.group.updateMatrixWorld(true);
      const ahead = new Vector3(0, 0, 35).project(car.camera);
      for (const side of [-1, 1]) {
        const tyre = new Vector3(side * .773, 1.04, 2.42).project(car.camera);
        expect(Math.abs(tyre.x)).toBeLessThan(.9);
        expect(tyre.y).toBeGreaterThan(-.8);
        expect(ahead.y).toBeGreaterThan(tyre.y + .25);
      }
    }
  });

  // Each circuit gets its own CI time budget; adding courses must not combine
  // every scene build into Vitest's default five-second limit.
  it.each(TRACKS)('places $id facilities outside the road and releases its scene', definition => {
    const scene = new Scene();
    const track = new Track(scene, definition);
    expect(scene.children).toContain(track.group);
    const road = track.group.getObjectByName('road') as Mesh;
    const vertices = road.geometry.getAttribute('position');
    // Every sampled road edge follows the same metre width used by physics.
    for (let i = 0; i < track.sampleCount; i += 17) {
      const width = track.roadHalfWidthAt(track.distances[i] / track.length);
      for (const [vertex, side] of [[i * 4, -1], [i * 4 + 1, 1]]) {
        expect(vertices.getX(vertex)).toBeCloseTo(track.samples[i].x + track.normals[i].x * side * width, 3);
        expect(vertices.getZ(vertex)).toBeCloseTo(track.samples[i].z + track.normals[i].z * side * width, 3);
      }
    }
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
      const nearest = track.nearest(collider.x, collider.z);
      expect(nearest.distance).toBeGreaterThan(collider.radius + track.curbOuterEdgeAt(nearest.progress));
    }
    const mesh = track.group.children.find(child => child instanceof Mesh) as Mesh;
    let released = false;
    mesh.geometry.addEventListener('dispose', () => { released = true; });
    track.dispose();
    expect(released).toBe(true);
    expect(scene.children).not.toContain(track.group);
    expect(track.group.children).toHaveLength(0);
  }, 15_000);
});
