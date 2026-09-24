import * as THREE from 'three';

const red = new THREE.MeshStandardMaterial({ color: '#c72529', metalness: 0.45, roughness: 0.28 });
const darkRed = new THREE.MeshStandardMaterial({ color: '#7c1820', metalness: 0.35, roughness: 0.35 });
const carbon = new THREE.MeshStandardMaterial({ color: '#151c20', metalness: 0.22, roughness: 0.42 });
const tire = new THREE.MeshStandardMaterial({ color: '#101315', roughness: 0.93 });
const rim = new THREE.MeshStandardMaterial({ color: '#3b4548', metalness: 0.8, roughness: 0.25 });
const accent = new THREE.MeshStandardMaterial({ color: '#d7e5dd', metalness: 0.3, roughness: 0.4 });

function addBox(parent: THREE.Object3D, size: [number, number, number],
  position: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number,
  material: THREE.Material): void {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 7, false), material);
  mesh.castShadow = true;
  parent.add(mesh);
}

function addNose(parent: THREE.Object3D): void {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -0.67, 0.53, 0.75,  0.67, 0.53, 0.75,
    -0.62, 0.94, 0.75,  0.62, 0.94, 0.75,
    -0.23, 0.40, 4.08,  0.23, 0.40, 4.08,
    -0.20, 0.66, 4.08,  0.20, 0.66, 4.08,
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex([
    2, 6, 3, 3, 6, 7, // top
    0, 4, 2, 2, 4, 6, // left
    1, 3, 5, 3, 7, 5, // right
    4, 5, 6, 5, 7, 6, // tip
    0, 1, 4, 1, 5, 4, // floor
  ]);
  geometry.computeVertexNormals();
  const nose = new THREE.Mesh(geometry, red);
  nose.castShadow = true;
  nose.receiveShadow = true;
  parent.add(nose);
}

export class CarVisual {
  readonly group = new THREE.Group();
  readonly camera: THREE.PerspectiveCamera;
  private readonly frontWheels: THREE.Group[] = [];
  private readonly wheelMeshes: THREE.Mesh[] = [];
  private readonly baseCameraY = 1.88;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(80, 1, 0.055, 1100);
    this.camera.position.set(0, this.baseCameraY, -0.7);
    this.camera.lookAt(0, 1.49, 24);
    this.group.add(this.camera);
    this.build();
  }

  setPose(x: number, z: number, yaw: number): void {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
  }

  animate(steering: number, speed: number, elapsed: number): void {
    // The camera looks along local +Z; its screen-right axis is local -X.
    for (const wheel of this.frontWheels) wheel.rotation.y = -steering * 0.3;
    for (const mesh of this.wheelMeshes) mesh.rotation.x -= speed * 0.002;
    const vibration = Math.min(speed / 80, 1) * 0.005;
    this.camera.position.y = this.baseCameraY + Math.sin(elapsed * 52) * vibration;
  }

  private build(): void {
    const car = this.group;
    // Lower tub and tapered nose. The cockpit is intentionally visible from the camera.
    addBox(car, [1.72, 0.48, 3.7], [0, 0.48, 0.2], red);
    addBox(car, [1.32, 0.35, 2.6], [0, 0.78, 0.25], darkRed);
    addNose(car);
    addBox(car, [0.10, 0.035, 2.25], [0, 0.83, 1.85], accent);
    addBox(car, [2.25, 0.31, 2.15], [0, 0.65, -1.15], red);
    for (const side of [-1, 1]) {
      const sidepod = addBox(car, [0.54, 0.31, 1.95], [side * 0.94, 0.69, -0.65], red);
      sidepod.rotation.y = side * 0.08;
      addBox(car, [0.13, 0.12, 1.7], [side * 0.66, 0.9, -0.45], carbon);
      addBox(car, [0.11, 0.12, 1.7], [side * 1.06, 0.83, -0.55], darkRed);
      addBox(car, [0.12, 0.1, 1.9], [side * 0.54, 0.47, 2.6], carbon);
    }

    addBox(car, [2.9, 0.09, 0.53], [0, 0.32, 4.3], carbon);
    addBox(car, [2.72, 0.08, 0.25], [0, 0.49, 4.09], red);
    addBox(car, [0.85, 0.14, 0.5], [0, 0.39, 4.2], red);
    addBox(car, [2.9, 0.08, 0.58], [0, 1.23, -2.4], carbon);

    for (const side of [-1, 1]) {
      this.buildWheel(side, 2.42, true);
      this.buildWheel(side, -1.75, false);
      addBox(car, [0.07, 0.08, 0.85], [side * 0.85, 0.62, 2.05], carbon)
        .rotation.y = side * 0.32;
      addBox(car, [0.14, 0.17, 0.48], [side * 1.47, 0.34, 4.22], red);
      addBox(car, [0.35, 0.08, 0.3], [side * 0.83, 0.77, -0.75], carbon);
      addBox(car, [0.05, 0.07, 0.55], [side * 0.65, 1.03, 0.62], accent);
      addTube(car, [
        new THREE.Vector3(side * 0.78, 1.12, 0.05),
        new THREE.Vector3(side * 0.68, 1.25, 0.55),
        new THREE.Vector3(side * 0.50, 1.51, 1.12),
        new THREE.Vector3(side * 0.16, 1.60, 1.51),
      ], 0.052, carbon);
    }
    addTube(car, [
      new THREE.Vector3(-0.16, 1.60, 1.51),
      new THREE.Vector3(0, 1.62, 1.57),
      new THREE.Vector3(0.16, 1.60, 1.51),
    ], 0.052, carbon);
    addTube(car, [new THREE.Vector3(0, 1.61, 1.57), new THREE.Vector3(0, 1.02, 2.12)], 0.033, carbon);

    // Steering wheel and compact instrument cluster remain below the horizon.
    addBox(car, [0.76, 0.38, 0.16], [0, 0.98, 0.16], carbon);
    addBox(car, [0.43, 0.18, 0.025], [0, 1.01, 0.26],
      new THREE.MeshStandardMaterial({ color: '#436b64', emissive: '#183c38', emissiveIntensity: 0.5 }));
    addBox(car, [1.35, 0.19, 0.53], [0, 0.99, -0.18], carbon);
  }

  private buildWheel(side: number, z: number, front: boolean): void {
    const pivot = new THREE.Group();
    pivot.position.set(side * (front ? 1.19 : 1.26), 0.52, z);
    this.group.add(pivot);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.41, 24), tire);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    pivot.add(wheel);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.015, 24), rim);
    face.rotation.z = Math.PI / 2;
    face.position.x = side * 0.22;
    pivot.add(face);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.026, 5, 28), red);
    stripe.rotation.y = Math.PI / 2;
    stripe.position.x = side * 0.217;
    pivot.add(stripe);
    if (front) this.frontWheels.push(pivot);
    this.wheelMeshes.push(wheel);
  }
}
