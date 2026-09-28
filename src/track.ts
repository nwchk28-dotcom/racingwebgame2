import * as THREE from 'three';
import type { TrackDefinition } from './trackData';
import { TrackPath } from './trackPath';
import { TrackWalls, type WallSegment } from './trackWalls';

export interface ObstacleCollider {
  x: number;
  z: number;
  radius: number;
}

const CURB_STRIPE_LENGTH = 4;

function texturedCanvas(kind: 'road' | 'grass', grassColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = kind === 'road' ? '#30383a' : grassColor;
  context.fillRect(0, 0, 256, 256);
  let seed = kind === 'road' ? 7 : 13;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < (kind === 'road' ? 10500 : 9000); i++) {
    const value = Math.floor(rand() * 55);
    context.fillStyle = kind === 'road'
      ? `rgba(${value + 95},${value + 100},${value + 98},${0.04 + rand() * 0.11})`
      : `rgba(${value + 75},${value + 105},${value + 55},${0.04 + rand() * 0.12})`;
    context.fillRect(rand() * 256, rand() * 256, 1 + rand() * 3, 1 + rand() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (kind === 'grass') texture.repeat.set(30, 30);
  return texture;
}

function makeRibbon(
  points: THREE.Vector3[],
  normals: THREE.Vector3[],
  inner: number,
  outer: number,
  y: number,
  uvScale = 16,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertex = 0;
  for (let i = 0; i < points.length - 1; i++) {
    for (const j of [i, i + 1]) {
      const p = points[j];
      const n = normals[j];
      positions.push(p.x + n.x * inner, y, p.z + n.z * inner);
      positions.push(p.x + n.x * outer, y, p.z + n.z * outer);
      uvs.push(0, j / uvScale, 1, j / uvScale);
    }
    indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
    vertex += 4;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeStripedCurb(
  points: THREE.Vector3[], normals: THREE.Vector3[], distances: number[],
  inner: number, outer: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const stripeColors = [new THREE.Color('#be332d'), new THREE.Color('#efece3')];
  let vertex = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const from = distances[i];
    const to = distances[i + 1];
    let cursor = from;
    while (cursor < to - 1e-6) {
      const stripe = Math.floor((cursor + 1e-6) / CURB_STRIPE_LENGTH);
      const end = Math.min(to, (stripe + 1) * CURB_STRIPE_LENGTH);
      const color = stripeColors[stripe % 2];
      for (const distance of [cursor, end]) {
        const t = (distance - from) / (to - from);
        const point = points[i].clone().lerp(points[i + 1], t);
        const normal = normals[i].clone().lerp(normals[i + 1], t).normalize();
        for (const offset of [inner, outer]) {
          positions.push(point.x + normal.x * offset, 0.038, point.z + normal.z * offset);
          colors.push(color.r, color.g, color.b);
        }
      }
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
      vertex += 4;
      cursor = end;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  roughness = 0.7,
): THREE.Mesh {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness, metalness: roughness < 0.4 ? 0.35 : 0 }),
  );
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function wallGeometry(segments: readonly WallSegment[], height: number, thickness = 0.38): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const wall of segments) {
    const half = thickness / 2;
    const start = positions.length / 3;
    for (const [x, z] of [[wall.ax, wall.az], [wall.bx, wall.bz]]) {
      for (const side of [-1, 1]) {
        positions.push(x + wall.inwardX * side * half, 0, z + wall.inwardZ * side * half);
        positions.push(x + wall.inwardX * side * half, height, z + wall.inwardZ * side * half);
      }
    }
    for (const [a, b, c, d] of [[0, 4, 5, 1], [2, 3, 7, 6], [1, 5, 7, 3]]) {
      indices.push(start + a, start + b, start + c, start + a, start + c, start + d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export class Track extends TrackPath {
  readonly roadHalfWidth: number;
  readonly curbOuterEdge: number;
  readonly outerFence: { centerX: number; centerZ: number; radius: number };
  readonly colliders: ObstacleCollider[] = [];
  readonly walls: TrackWalls;
  readonly group = new THREE.Group();
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene, definition: TrackDefinition) {
    super(definition);
    this.scene = scene;
    this.roadHalfWidth = definition.roadHalfWidth;
    this.curbOuterEdge = definition.roadHalfWidth + definition.curbWidth;
    this.walls = new TrackWalls(this, this.curbOuterEdge);
    const xValues = this.samples.map(point => point.x);
    const zValues = this.samples.map(point => point.z);
    const centerX = (Math.min(...xValues) + Math.max(...xValues)) / 2;
    const centerZ = (Math.min(...zValues) + Math.max(...zValues)) / 2;
    const furthest = Math.max(...this.samples.map(point => Math.hypot(point.x - centerX, point.z - centerZ)));
    this.outerFence = { centerX, centerZ, radius: furthest + 55 };
    this.group.name = `track-${definition.id}`;
    scene.add(this.group);
    this.buildScene();
  }

  private buildScene(): void {
    const scene = this.group;
    this.scene.background = new THREE.Color(this.definition.sky);
    this.scene.fog = new THREE.FogExp2(this.definition.sky, 0.0019);
    scene.add(new THREE.HemisphereLight('#e8f7ff', '#566045', 2.1));
    const sun = new THREE.DirectionalLight('#fff0d7', 2.5);
    sun.position.set(-100, 180, 90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -100;
    sun.shadow.camera.right = sun.shadow.camera.top = 100;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 450;
    sun.shadow.bias = -0.0004;
    sun.target.position.set(-75, 0, 70);
    scene.add(sun, sun.target);

    const grassTexture = texturedCanvas('grass', this.definition.grass);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry((this.outerFence.radius + 80) * 2, (this.outerFence.radius + 80) * 2),
      new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.x = this.outerFence.centerX;
    ground.position.z = this.outerFence.centerZ;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    scene.add(ground);

    const roadTexture = texturedCanvas('road', this.definition.grass);
    const road = new THREE.Mesh(
      makeRibbon(this.samples, this.normals, -this.roadHalfWidth, this.roadHalfWidth, 0.018, 10),
      new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.94, side: THREE.DoubleSide }),
    );
    road.receiveShadow = true;
    scene.add(road);

    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: '#818b80', roughness: 1, side: THREE.DoubleSide });
    const lineMaterial = new THREE.MeshStandardMaterial({ color: '#f4f2e7', roughness: 0.72, side: THREE.DoubleSide });
    const curbMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide });
    const railMaterial = new THREE.MeshStandardMaterial({ color: '#d7dedc', roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide });

    for (const side of [-1, 1]) {
      const near = side * this.roadHalfWidth;
      const far = side * (this.curbOuterEdge + 1.05);
      scene.add(new THREE.Mesh(makeRibbon(this.samples, this.normals, near, far, 0.01), shoulderMaterial));
      scene.add(new THREE.Mesh(makeRibbon(this.samples, this.normals,
        side * (this.roadHalfWidth - 0.33), side * (this.roadHalfWidth - 0.1), 0.04), lineMaterial));
      scene.add(new THREE.Mesh(
        makeStripedCurb(this.samples, this.normals, this.distances, side * this.roadHalfWidth, side * this.curbOuterEdge),
        curbMaterial,
      ));
    }

    this.addOuterFence(scene, railMaterial);
    this.addTracksideWalls(scene);
    if (this.definition.id === 'monaco') this.addMonacoTunnel(scene);
    this.addStartLine(scene);
    this.addBuildings(scene);
    this.addTrees(scene);
  }

  private addTracksideWalls(scene: THREE.Object3D): void {
    const barrier = new THREE.Mesh(wallGeometry(this.walls.segments, 1.55),
      new THREE.MeshStandardMaterial({ color: '#f0eee5', roughness: 0.82, side: THREE.DoubleSide }));
    barrier.name = 'trackside-wall';
    barrier.receiveShadow = true;
    scene.add(barrier);
    const band = new THREE.Mesh(wallGeometry(this.walls.segments, .31, .42),
      new THREE.MeshBasicMaterial({ color: '#ed4938', side: THREE.DoubleSide, toneMapped: false }));
    band.name = 'wall-visibility-band';
    band.position.y = 1.27;
    scene.add(band);
  }

  private addMonacoTunnel(scene: THREE.Object3D): void {
    // Portier to just before Nouvelle Chicane. Keep the roof high and its
    // material emissive so the onboard view stays readable on mobile screens.
    const start = this.distances.findIndex(distance => distance / this.length >= .435);
    const end = this.distances.findIndex(distance => distance / this.length >= .605);
    const points = this.samples.slice(start, end + 1);
    const normals = this.normals.slice(start, end + 1);
    const halfWidth = this.curbOuterEdge + 1.6;
    const tunnel = new THREE.Group();
    tunnel.name = 'monaco-tunnel';
    scene.add(tunnel);
    const roof = new THREE.Mesh(makeRibbon(points, normals, -halfWidth, halfWidth, 8.8),
      new THREE.MeshStandardMaterial({ color: '#b7c3c1', emissive: '#9eaca8',
        emissiveIntensity: 0.72, roughness: 0.9, side: THREE.DoubleSide }));
    tunnel.add(roof);
    const sideSegments: WallSegment[] = [];
    for (let i = start; i < end; i++) {
      const a = this.samples[i];
      const b = this.samples[i + 1];
      const an = this.normals[i];
      const bn = this.normals[i + 1];
      for (const side of [-1, 1]) {
        const ax = a.x + an.x * side * halfWidth;
        const az = a.z + an.z * side * halfWidth;
        const bx = b.x + bn.x * side * halfWidth;
        const bz = b.z + bn.z * side * halfWidth;
        const length = Math.hypot(bx - ax, bz - az);
        if (length < .001) continue;
        sideSegments.push({ ax, az, bx, bz,
          inwardX: side * (az - bz) / length, inwardZ: side * (bx - ax) / length });
      }
    }
    tunnel.add(new THREE.Mesh(wallGeometry(sideSegments, 8.8),
      new THREE.MeshStandardMaterial({ color: '#aeb9b5', emissive: '#536664',
        emissiveIntensity: 0.48, roughness: 0.92, side: THREE.DoubleSide })));
    const light = new THREE.MeshBasicMaterial({ color: '#eef7ed', side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      tunnel.add(new THREE.Mesh(makeRibbon(points, normals,
        side * (halfWidth - 1.15), side * (halfWidth - .65), 8.77), light));
    }
  }

  private addOuterFence(scene: THREE.Object3D, material: THREE.Material): void {
    const { centerX, centerZ, radius } = this.outerFence;
    const visibleRadius = radius + 0.15;
    for (const height of [0.65, 1.15, 1.65]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(visibleRadius, 0.15, 6, 384), material);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(centerX, height, centerZ);
      scene.add(rail);
    }
    const count = Math.ceil(2 * Math.PI * visibleRadius / 7);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 1.9, 6), material, count);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      matrix.makeTranslation(centerX + Math.cos(angle) * visibleRadius, 0.95,
        centerZ + Math.sin(angle) * visibleRadius);
      posts.setMatrixAt(i, matrix);
    }
    posts.castShadow = true;
    scene.add(posts);
  }

  private addStartLine(scene: THREE.Object3D): void {
    const start = this.samples[0];
    const normal = this.normals[0];
    const paint = new THREE.MeshBasicMaterial({ color: '#f5f5f0', side: THREE.DoubleSide });
    for (let i = -Math.floor(this.roadHalfWidth); i < Math.floor(this.roadHalfWidth); i++) {
      if (i % 2 === 0) continue;
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), paint);
      tile.rotation.x = -Math.PI / 2;
      tile.rotation.z = -this.startYaw;
      tile.position.set(start.x + normal.x * (i + 0.5), 0.06, start.z + normal.z * (i + 0.5));
      scene.add(tile);
    }
  }

  private addTracksideBox(parent: THREE.Object3D, distance: number, offset: number,
    size: [number, number, number], color: number): THREE.Mesh | null {
    const index = Math.min(this.sampleCount - 1, Math.round(distance / this.length * this.sampleCount));
    const point = this.samples[index];
    const normal = this.normals[index].clone().normalize();
    const next = this.samples[index + 1];
    const radius = Math.hypot(size[0] / 2, size[2] / 2);
    let x = 0;
    let z = 0;
    let clear = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const distanceFromRoad = offset + Math.sign(offset) * attempt * 16;
      x = point.x + normal.x * distanceFromRoad;
      z = point.z + normal.z * distanceFromRoad;
      if (this.nearest(x, z).distance > radius + this.curbOuterEdge + 8) {
        clear = true;
        break;
      }
    }
    if (!clear) return null;
    const building = box(parent, size,
      [x, size[1] / 2, z], color);
    building.rotation.y = Math.atan2(next.x - point.x, next.z - point.z);
    this.colliders.push({ x, z, radius });
    return building;
  }

  private addBuildings(scene: THREE.Object3D): void {
    if (this.definition.scenery === 'urban') {
      // Unbranded blocks suggest each street circuit without crowding the road.
      for (let i = 0; i < 22; i++) {
        const fraction = (i + 0.35) / 22;
        const side = i % 2 ? -1 : 1;
        const height = 13 + (i * 7 % 15);
        const building = this.addTracksideBox(scene, this.length * fraction, side * 30,
          [18, height, 19], i % 3 ? 0xc2c7bd : 0x9eafa9);
        if (building) box(building, [19, 0.8, 20], [0, height / 2 + 0.4, 0], 0x64777b);
      }
      return;
    }
    if (this.definition.scenery === 'marina') {
      for (let i = 0; i < 12; i++) {
        const fraction = (i + 0.2) / 12;
        const side = i % 2 ? -1 : 1;
        const height = 8 + i % 4 * 4;
        const building = this.addTracksideBox(scene, this.length * fraction, side * 64,
          [30, height, 22], i % 3 ? 0x728d94 : 0xd1d3c8);
        if (building) box(building, [31, 0.7, 23], [0, height / 2 + 0.35, 0], 0x304a52);
      }
      return;
    }
    const airfield = this.definition.scenery === 'airfield';
    const stadium = this.definition.scenery === 'stadium';
    const side = airfield ? -1 : 1;
    for (let i = 0; i < 5; i++) {
      const distance = 65 + i * 37;
      const pit = this.addTracksideBox(scene, distance, side * 52, [28, airfield ? 7 : 9, 31],
        airfield ? 0x515d62 : 0x40494b);
      if (pit) box(pit, [29, 1.2, 33], [0, (airfield ? 7 : 9) / 2 + 0.6, 0], 0x1c282c);
    }
    if (stadium) {
      // Simple unbranded stands give stadium circuits a distinct silhouette.
      for (const [fraction, sideOfRoad] of [[0.67, -1], [0.7, 1], [0.76, -1], [0.79, 1]]) {
        const stand = this.addTracksideBox(scene, this.length * fraction, sideOfRoad * 72,
          [58, 13, 28], 0x687276);
        if (stand) {
          box(stand, [62, 1.5, 30], [0, 7.1, 0], 0x2f3b40);
          for (let row = 0; row < 3; row++) {
            box(stand, [54, 0.45, 23 - row * 4], [0, -4.2 + row * 2.3, 2],
              row % 2 ? 0xb2b9b4 : 0x8d9b99);
          }
        }
      }
    } else {
      for (const fraction of airfield ? [0.27, 0.68] : [0.35, 0.74]) {
        this.addTracksideBox(scene, this.length * fraction, 58, [72, 12, 30],
          airfield ? 0x657479 : 0x536363);
      }
    }
  }

  private addTrees(scene: THREE.Object3D): void {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5f5546, roughness: 1 });
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x2e503b, roughness: 1 });
    const count = this.definition.scenery === 'urban' ? 16 :
      this.definition.scenery === 'marina' ? 45 :
      this.definition.scenery === 'stadium' ? 65 :
      this.definition.scenery === 'airfield' ? 100 :
      this.definition.scenery === 'park' ? 420 : 180;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.55, 5, 5), trunkMaterial, count);
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(3.4, 9, 6), crownMaterial, count);
    let seed = 92345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const matrix = new THREE.Matrix4();
    let added = 0;
    const margin = this.outerFence.radius;
    let attempts = 0;
    while (added < count && attempts++ < count * 100) {
      const x = this.outerFence.centerX + (rand() * 2 - 1) * margin;
      const z = this.outerFence.centerZ + (rand() * 2 - 1) * margin;
      if (this.nearest(x, z).distance < (this.definition.scenery === 'airfield' ? 65 : 38)) continue;
      if (Math.hypot(x - this.outerFence.centerX, z - this.outerFence.centerZ) > this.outerFence.radius - 8) continue;
      const scale = 0.6 + rand() * 0.9;
      matrix.compose(new THREE.Vector3(x, 2.5 * scale, z), new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale));
      trunks.setMatrixAt(added, matrix);
      matrix.compose(new THREE.Vector3(x, 8.5 * scale, z), new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale));
      crowns.setMatrixAt(added, matrix);
      added++;
    }
    trunks.count = crowns.count = added;
    trunks.castShadow = true;
    crowns.castShadow = true;
    scene.add(trunks, crowns);
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          if ('map' in material && material.map instanceof THREE.Texture) textures.add(material.map);
        }
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    this.scene.remove(this.group);
    this.group.clear();
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
  }
}
