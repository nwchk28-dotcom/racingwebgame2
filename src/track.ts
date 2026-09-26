import * as THREE from 'three';
import type { TrackDefinition } from './trackData';
import { TrackPath } from './trackPath';

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

export class Track extends TrackPath {
  readonly roadHalfWidth: number;
  readonly curbOuterEdge: number;
  readonly outerFence: { centerX: number; centerZ: number; radius: number };
  readonly colliders: ObstacleCollider[] = [];
  readonly group = new THREE.Group();
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene, definition: TrackDefinition) {
    super(definition);
    this.scene = scene;
    this.roadHalfWidth = definition.roadHalfWidth;
    this.curbOuterEdge = definition.roadHalfWidth + definition.curbWidth;
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
    this.addStartLine(scene);
    this.addBuildings(scene);
    this.addTrees(scene);
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
    if (this.definition.scenery === 'nova') {
      for (let i = 0; i < 6; i++) {
        const z = 30 + i * 30;
        box(scene, [28, 8, 26], [37, 4, z], 0x344247);
        box(scene, [29, 1, 27], [37, 8.5, z], 0x17262b);
        const glass = box(scene, [1, 3.3, 22], [22.8, 5.3, z], 0x6c9097, 0.13);
        glass.castShadow = false;
        box(scene, [8, 0.2, 20], [22.5, 2.5, z], 0xe1e9e1);
      }
      box(scene, [18, 11, 58], [-42, 5.5, 110], 0x4c5759);
      box(scene, [24, 1.5, 62], [-43, 11.5, 110], 0x202a2d);
      for (let row = 0; row < 4; row++) {
        box(scene, [17, 0.45, 54], [-42, 2.1 + row * 2.2, 110], row % 2 ? 0x536769 : 0x718183);
      }
      return;
    }
    const airfield = this.definition.scenery === 'airfield';
    const side = airfield ? -1 : 1;
    for (let i = 0; i < 5; i++) {
      const distance = 65 + i * 37;
      const pit = this.addTracksideBox(scene, distance, side * 52, [28, airfield ? 7 : 9, 31],
        airfield ? 0x515d62 : 0x40494b);
      if (pit) box(pit, [29, 1.2, 33], [0, (airfield ? 7 : 9) / 2 + 0.6, 0], 0x1c282c);
    }
    for (const fraction of airfield ? [0.27, 0.68] : [0.35, 0.74]) {
      this.addTracksideBox(scene, this.length * fraction, 58, [72, 12, 30],
        airfield ? 0x657479 : 0x536363);
    }
  }

  private addTrees(scene: THREE.Object3D): void {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5f5546, roughness: 1 });
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x2e503b, roughness: 1 });
    const count = this.definition.scenery === 'airfield' ? 100 :
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
