import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CAR_LATERAL_SCALE, TIRE_MODEL_WIDTH, FRONT_WHEEL_MODEL_OFFSET, REAR_WHEEL_MODEL_OFFSET } from './vehicleTuning';

const red = new THREE.MeshStandardMaterial({ color: '#c72529', metalness: 0.45, roughness: 0.28 });
const darkRed = new THREE.MeshStandardMaterial({ color: '#7c1820', metalness: 0.35, roughness: 0.35 });
const carbon = new THREE.MeshStandardMaterial({ color: '#151c20', metalness: 0.22, roughness: 0.42 });
const tire = new THREE.MeshStandardMaterial({ color: '#101315', roughness: 0.93 });
const rim = new THREE.MeshStandardMaterial({ color: '#3b4548', metalness: 0.8, roughness: 0.25 });
const accent = new THREE.MeshStandardMaterial({ color: '#d7e5dd', metalness: 0.3, roughness: 0.4 });

function addBox(parent: THREE.Object3D, size: [number, number, number],
  position: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, Math.min(...size) * 0.18), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Loft rounded cross-sections along the car without changing its footprint.
function addBody(parent: THREE.Object3D, sections: number[][], material: THREE.Material): THREE.Mesh {
  const vertices: number[] = [], indices: number[] = [];
  const segments = 16;
  for (const [z, width, bottom, top] of sections) {
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * Math.PI * 2;
      vertices.push(width * Math.sign(Math.cos(angle)) * Math.abs(Math.cos(angle)) ** 0.55,
        (top + bottom) / 2 + (top - bottom) / 2 * Math.sign(Math.sin(angle)) * Math.abs(Math.sin(angle)) ** 0.55, z);
    }
  }
  for (let row = 0; row < sections.length - 1; row++) {
    for (let i = 0; i < segments; i++) {
      const a = row * segments + i, b = row * segments + (i + 1) % segments;
      indices.push(a, b, a + segments, b, b + segments, a + segments);
    }
  }
  for (let i = 1; i < segments - 1; i++) {
    indices.push(0, i + 1, i);
    const end = (sections.length - 1) * segments;
    indices.push(end, end + i, end + i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addRod(parent: THREE.Object3D, from: number[], to: number[], radius = 0.025): void {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 8), carbon);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  mesh.castShadow = true;
  parent.add(mesh);
}

export class CarVisual {
  readonly group = new THREE.Group();
  readonly model = new THREE.Group();
  readonly camera: THREE.PerspectiveCamera;
  private readonly frontWheels: THREE.Group[] = [];
  private readonly wheelMeshes: THREE.Mesh[] = [];
  private readonly poseForward=new THREE.Vector3();
  private readonly poseUp=new THREE.Vector3();
  private readonly poseRight=new THREE.Vector3();
  private readonly poseVertical=new THREE.Vector3();
  private readonly poseBasis=new THREE.Matrix4();
  private readonly baseCameraY = 2.05;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.055, 1100);
    this.camera.position.set(0, this.baseCameraY, -0.55);
    // A closer, narrower onboard view frames the wheels and halo below the road.
    this.camera.lookAt(0, 0.70, 6);
    this.group.add(this.camera);
    this.model.scale.x = CAR_LATERAL_SCALE;
    this.group.add(this.model);
    this.build();
  }

  setPose(x: number, z: number, yaw: number, height=0, gradientX=0, gradientZ=0): void {
    this.group.position.set(x, height, z);
    const forward=this.poseForward.set(Math.sin(yaw),gradientX*Math.sin(yaw)+gradientZ*Math.cos(yaw),Math.cos(yaw)).normalize();
    const up=this.poseUp.set(-gradientX,1,-gradientZ).normalize();
    const right=this.poseRight.copy(up).cross(forward).normalize();
    this.group.quaternion.setFromRotationMatrix(this.poseBasis.makeBasis(right,this.poseVertical.copy(forward).cross(right).normalize(),forward));
  }

  animate(steering: number, speed: number, _elapsed: number): void {
    // The camera looks along local +Z; its screen-right axis is local -X.
    for (const wheel of this.frontWheels) wheel.rotation.y = -steering * 0.3;
    for (const mesh of this.wheelMeshes) mesh.rotation.x -= speed * 0.002;
    this.camera.position.y = this.baseCameraY;
  }

  private build(): void {
    const car = this.model;
    // Lower tub and tapered nose. The cockpit is intentionally visible from the camera.
    addBox(car, [1.72, 0.48, 3.7], [0, 0.48, 0.2], red);
    addBox(car, [1.32, 0.35, 2.6], [0, 0.78, 0.25], darkRed);
    addBody(car, [[0.75, 0.62, 0.53, 0.94], [1.4, 0.49, 0.50, 0.90],
      [2.5, 0.31, 0.44, 0.78], [3.65, 0.22, 0.40, 0.68], [4.08, 0.20, 0.40, 0.66]], red);
    addBox(car, [0.10, 0.035, 2.25], [0, 0.83, 1.85], accent);
    addBox(car, [2.25, 0.31, 2.15], [0, 0.65, -1.15], red);
    for (const side of [-1, 1]) {
      const sidepod = addBody(car, [[-1.62, 0.21, 0.53, 0.73], [-1.1, 0.31, 0.53, 0.86],
        [-0.25, 0.35, 0.54, 0.88], [0.32, 0.30, 0.57, 0.82]], red);
      sidepod.position.x = side * 1.03;
      addBox(car, [0.46, 0.15, 0.025], [side * 1.03, 0.69, 0.337], carbon);
      for (let vent = 0; vent < 5; vent++) {
        addBox(car, [0.30, 0.018, 0.045], [side * 1.03, 0.876, -0.25 - vent * 0.12], carbon);
      }
      addBox(car, [0.13, 0.12, 1.7], [side * 0.66, 0.9, -0.45], carbon);
      addBox(car, [0.11, 0.12, 1.7], [side * 1.20, 0.83, -0.55], darkRed);
      addBox(car, [0.12, 0.1, 1.9], [side * 0.54, 0.47, 2.6], carbon);
    }

    addBox(car, [2.9, 0.09, 0.53], [0, 0.32, 4.3], carbon);
    addBox(car, [2.72, 0.08, 0.25], [0, 0.49, 4.09], red);
    addBox(car, [0.85, 0.14, 0.5], [0, 0.39, 4.2], red);
    addBox(car, [2.9, 0.08, 0.58], [0, 1.23, -2.4], carbon);

    // Layered aero surfaces stay inside the original wing endplates.
    for (const z of [4.23, 4.39]) {
      addBox(car, [2.72, 0.035, 0.10], [0, 0.43, z], darkRed).rotation.x = -0.14;
    }
    addBox(car, [2.64, 0.045, 0.26], [0, 1.35, -2.4], red);
    for (const side of [-1, 1]) {
      addBox(car, [0.045, 0.34, 0.56], [side * 1.40, 1.20, -2.4], red);
      addBox(car, [0.045, 0.48, 0.12], [side * 0.42, 0.96, -2.35], carbon);
      for (const z of [2.42, -1.75]) {
        for (const y of [0.36, 0.65]) {
          addRod(car, [side * 0.55, y, z - 0.55], [side * 1.18, 0.49, z]);
          addRod(car, [side * 0.55, y, z + 0.48], [side * 1.18, 0.49, z]);
        }
      }
      this.buildWheel(side, 2.42, true);
      this.buildWheel(side, -1.75, false);
      addBox(car, [0.07, 0.08, 0.85], [side * 0.85, 0.62, 2.05], carbon)
        .rotation.y = side * 0.32;
      addBox(car, [0.14, 0.17, 0.48], [side * 1.47, 0.34, 4.22], red);
      addBox(car, [0.35, 0.08, 0.3], [side * 0.83, 0.77, -0.75], carbon);
      addBox(car, [0.05, 0.07, 0.55], [side * 0.65, 1.03, 0.62], accent);
    }

    // Steering wheel and compact instrument cluster remain below the horizon.
    addBox(car, [0.76, 0.38, 0.16], [0, 0.98, 0.16], carbon);
    addBox(car, [0.43, 0.18, 0.025], [0, 1.01, 0.26],
      new THREE.MeshStandardMaterial({ color: '#436b64', emissive: '#183c38', emissiveIntensity: 0.5 }));
    for (const side of [-1, 1]) {
      addBox(car, [0.10, 0.24, 0.13], [side * 0.34, 0.98, 0.24], rim);
      for (let button = 0; button < 3; button++) {
        addBox(car, [0.035, 0.028, 0.018], [side * (0.25 - button * 0.055), 1.10, 0.255], button === 0 ? red : accent);
      }
    }
    addBox(car, [1.35, 0.19, 0.53], [0, 0.99, -0.18], carbon);
  }

  private buildWheel(side: number, z: number, front: boolean): void {
    const radius = 0.49;
    const radialScale = radius / 0.52;
    const pivot = new THREE.Group();
    pivot.position.set(side * (front ? FRONT_WHEEL_MODEL_OFFSET : REAR_WHEEL_MODEL_OFFSET), radius, z);
    this.model.add(pivot);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, TIRE_MODEL_WIDTH, 48), tire);
    wheel.name = front ? 'front-tyre' : 'rear-tyre';
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    pivot.add(wheel);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * radialScale, 0.3 * radialScale, 0.015, 40), rim);
    face.rotation.z = Math.PI / 2;
    face.position.x = side * (TIRE_MODEL_WIDTH / 2 + 0.015);
    pivot.add(face);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.385 * radialScale, 0.026 * radialScale, 5, 28), red);
    stripe.rotation.y = Math.PI / 2;
    stripe.position.x = side * (TIRE_MODEL_WIDTH / 2 + 0.012);
    pivot.add(stripe);
    // Both sidewalls get recessed rim barrels, centre locks and radial spokes.
    for (const faceSide of [-1, 1]) {
      const x = faceSide * (TIRE_MODEL_WIDTH / 2 + 0.010);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.278, 0.012, 6, 40), rim);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = x;
      pivot.add(ring);
      for (let i = 0; i < 10; i++) {
        const angle = i / 10 * Math.PI * 2;
        const spoke = addBox(pivot, [0.016, 0.22, 0.024],
          [x, Math.cos(angle) * 0.16, Math.sin(angle) * 0.16], rim);
        spoke.rotation.x = angle;
      }
      const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.022, 6), accent);
      lock.rotation.z = Math.PI / 2;
      lock.position.x = x;
      pivot.add(lock);
    }
    if (front) this.frontWheels.push(pivot);
    this.wheelMeshes.push(wheel);
  }
}
