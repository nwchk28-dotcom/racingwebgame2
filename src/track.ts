import * as THREE from 'three';

export interface TrackPosition {
  progress: number;
  distance: number;
  centerX: number;
  centerZ: number;
  normalX: number;
  normalZ: number;
  signedDistance: number;
}

export interface ObstacleCollider {
  x: number;
  z: number;
  radius: number;
}

const ROAD_HALF_WIDTH = 7;
const SAMPLE_COUNT = 720;

const nodes = [
  [0, 0], [0, 95], [3, 210], [-46, 288], [-147, 303],
  [-228, 253], [-243, 166], [-185, 109], [-171, 20],
  [-234, -62], [-213, -142], [-132, -192], [-27, -183],
  [65, -179], [116, -113], [83, -54], [0, -96],
] as const;

function texturedCanvas(kind: 'road' | 'grass'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = kind === 'road' ? '#30383a' : '#56704b';
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
  segmentFilter?: (segment: number) => boolean,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertex = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    if (segmentFilter && !segmentFilter(i)) continue;
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

function makeRail(points: THREE.Vector3[], normals: THREE.Vector3[], offset: number,
  bottom: number, top: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const p = points[i];
    const n = normals[i];
    positions.push(p.x + n.x * offset, bottom, p.z + n.z * offset);
    positions.push(p.x + n.x * offset, top, p.z + n.z * offset);
    if (i < SAMPLE_COUNT) {
      const v = i * 2;
      indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function box(
  scene: THREE.Scene,
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
  scene.add(object);
  return object;
}

function signTexture(text: string, background: string, foreground: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = background;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = foreground;
  c.font = 'italic 900 124px Arial, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 512, 132, 950);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Track {
  readonly roadHalfWidth = ROAD_HALF_WIDTH;
  readonly barrierHalfWidth = 12.3;
  readonly colliders: ObstacleCollider[] = [];
  readonly samples: THREE.Vector3[] = [];
  readonly normals: THREE.Vector3[] = [];
  readonly distances: number[] = [0];
  readonly length: number;
  readonly start: THREE.Vector3;
  readonly startYaw: number;

  constructor(scene: THREE.Scene) {
    const curve = new THREE.CatmullRomCurve3(
      nodes.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.35,
    );
    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const t = i / SAMPLE_COUNT;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      this.samples.push(p);
      this.normals.push(new THREE.Vector3(tangent.z, 0, -tangent.x));
      if (i > 0) this.distances.push(this.distances[i - 1] + p.distanceTo(this.samples[i - 1]));
    }
    this.length = this.distances[SAMPLE_COUNT];
    this.start = this.samples[0].clone();
    const tangent = curve.getTangentAt(0);
    this.startYaw = Math.atan2(tangent.x, tangent.z);

    this.buildScene(scene);
  }

  nearest(x: number, z: number): TrackPosition {
    let bestDistanceSquared = Infinity;
    let bestProgress = 0;
    let centerX = 0;
    let centerZ = 0;
    let normalX = 1;
    let normalZ = 0;
    let signedDistance = 0;
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const a = this.samples[i];
      const b = this.samples[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const segmentLengthSquared = dx * dx + dz * dz;
      const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / segmentLengthSquared, 0, 1);
      const rx = x - (a.x + dx * t);
      const rz = z - (a.z + dz * t);
      const distanceSquared = rx * rx + rz * rz;
      if (distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        bestProgress = (this.distances[i] + Math.sqrt(segmentLengthSquared) * t) / this.length;
        centerX = a.x + dx * t;
        centerZ = a.z + dz * t;
        normalX = dz / Math.sqrt(segmentLengthSquared);
        normalZ = -dx / Math.sqrt(segmentLengthSquared);
        signedDistance = rx * normalX + rz * normalZ;
      }
    }
    return {
      progress: bestProgress % 1,
      distance: Math.sqrt(bestDistanceSquared),
      centerX, centerZ, normalX, normalZ, signedDistance,
    };
  }

  private buildScene(scene: THREE.Scene): void {
    scene.background = new THREE.Color('#a9c6cf');
    scene.fog = new THREE.FogExp2('#a9c6cf', 0.0019);
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

    const grassTexture = texturedCanvas('grass');
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1800, 1800),
      new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    scene.add(ground);

    const roadTexture = texturedCanvas('road');
    const road = new THREE.Mesh(
      makeRibbon(this.samples, this.normals, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0.018, 10),
      new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.94, side: THREE.DoubleSide }),
    );
    road.receiveShadow = true;
    scene.add(road);

    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: '#818b80', roughness: 1, side: THREE.DoubleSide });
    const lineMaterial = new THREE.MeshStandardMaterial({ color: '#f4f2e7', roughness: 0.72, side: THREE.DoubleSide });
    const curbRed = new THREE.MeshStandardMaterial({ color: '#be332d', roughness: 0.82, side: THREE.DoubleSide });
    const curbWhite = new THREE.MeshStandardMaterial({ color: '#efece3', roughness: 0.82, side: THREE.DoubleSide });
    const railMaterial = new THREE.MeshStandardMaterial({ color: '#d7dedc', roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide });

    for (const side of [-1, 1]) {
      const near = side * ROAD_HALF_WIDTH;
      const far = side * (ROAD_HALF_WIDTH + 2.2);
      scene.add(new THREE.Mesh(makeRibbon(this.samples, this.normals, near, far, 0.01), shoulderMaterial));
      scene.add(new THREE.Mesh(makeRibbon(this.samples, this.normals, side * 6.67, side * 6.9, 0.04), lineMaterial));
      for (let colorIndex = 0; colorIndex < 2; colorIndex++) {
        const curb = new THREE.Mesh(
          makeRibbon(this.samples, this.normals, side * 7.05, side * 8.15, 0.038, 16,
            i => Math.floor(this.distances[i] / 4) % 2 === colorIndex),
          colorIndex === 0 ? curbRed : curbWhite,
        );
        scene.add(curb);
      }
      for (const height of [0.65, 1.15, 1.65]) {
        scene.add(new THREE.Mesh(makeRail(this.samples, this.normals,
          side * 12.5, height - 0.15, height + 0.15), railMaterial));
      }
      const postGeometry = new THREE.BoxGeometry(0.14, 1.9, 0.14);
      const posts = new THREE.InstancedMesh(postGeometry, railMaterial, 120);
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < 120; i++) {
        const index = Math.floor(i / 120 * SAMPLE_COUNT);
        const p = this.samples[index];
        const n = this.normals[index];
        matrix.makeTranslation(p.x + n.x * side * 12.5, 0.95, p.z + n.z * side * 12.5);
        posts.setMatrixAt(i, matrix);
      }
      posts.castShadow = true;
      scene.add(posts);
    }

    this.addStartLine(scene);
    this.addBuildings(scene);
    this.addTrees(scene);
  }

  private addStartLine(scene: THREE.Scene): void {
    const start = this.samples[0];
    const tangent = new THREE.Vector3(Math.sin(this.startYaw), 0, Math.cos(this.startYaw));
    const normal = this.normals[0];
    const paint = new THREE.MeshBasicMaterial({ color: '#f5f5f0', side: THREE.DoubleSide });
    for (let i = -7; i < 7; i++) {
      if (i % 2 === 0) continue;
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), paint);
      tile.rotation.x = -Math.PI / 2;
      tile.rotation.z = -this.startYaw;
      tile.position.set(start.x + normal.x * (i + 0.5), 0.06, start.z + normal.z * (i + 0.5));
      scene.add(tile);
    }
    const bannerPosition = start.clone().addScaledVector(tangent, 7);
    for (const side of [-1, 1]) {
      const postX = bannerPosition.x + normal.x * side * 10;
      const postZ = bannerPosition.z + normal.z * side * 10;
      box(scene, [0.55, 8.8, 0.55],
        [postX, 4.4, postZ], 0x202b2f);
      this.colliders.push({ x: postX, z: postZ, radius: 0.42 });
    }
    const beam = box(scene, [20.5, 2.1, 0.7], [bannerPosition.x, 8.05, bannerPosition.z], 0x1b3439);
    beam.rotation.y = this.startYaw;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(18.5, 1.7),
      new THREE.MeshBasicMaterial({ map: signTexture('APEX ONE  •  TIME ATTACK', '#1a393d', '#e4f3ed'), side: THREE.DoubleSide }),
    );
    sign.position.set(bannerPosition.x, 8.05, bannerPosition.z - 0.37);
    sign.rotation.y = this.startYaw + Math.PI;
    scene.add(sign);
  }

  private addBuildings(scene: THREE.Scene): void {
    // The first straight passes a compact pit complex; signs use original wording.
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
    for (const [x, z, angle] of [[-41, 225, 0], [-179, 273, 0.9], [-210, -112, 1.1], [70, -160, 0.3]] as const) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 5.5),
        new THREE.MeshBasicMaterial({ map: signTexture('DRIVE THE LINE', '#16343b', '#e5eee9'), side: THREE.DoubleSide }),
      );
      panel.position.set(x, 4.5, z);
      panel.rotation.y = angle + Math.PI;
      scene.add(panel);
      box(scene, [0.22, 6, 0.22], [x - 9, 3, z], 0x39474a);
    }
  }

  private addTrees(scene: THREE.Scene): void {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5f5546, roughness: 1 });
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x2e503b, roughness: 1 });
    const count = 180;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.55, 5, 5), trunkMaterial, count);
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(3.4, 9, 6), crownMaterial, count);
    let seed = 92345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const matrix = new THREE.Matrix4();
    let added = 0;
    while (added < count) {
      const x = -350 + rand() * 650;
      const z = -310 + rand() * 730;
      if (this.nearest(x, z).distance < 33) continue;
      const scale = 0.6 + rand() * 0.9;
      matrix.compose(new THREE.Vector3(x, 2.5 * scale, z), new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale));
      trunks.setMatrixAt(added, matrix);
      matrix.compose(new THREE.Vector3(x, 8.5 * scale, z), new THREE.Quaternion(),
        new THREE.Vector3(scale, scale, scale));
      crowns.setMatrixAt(added, matrix);
      added++;
    }
    trunks.castShadow = true;
    crowns.castShadow = true;
    scene.add(trunks, crowns);
  }
}
