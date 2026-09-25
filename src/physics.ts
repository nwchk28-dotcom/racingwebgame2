import type { Track } from './track';

const BODY_CONTACTS = [
  [-1.55, 4.3], [1.55, 4.3],
  [-1.6, 2.4], [1.6, 2.4],
  [-1.6, -1.75], [1.6, -1.75],
] as const;
const WHEEL_CONTACTS = [
  [-1.19, 2.42], [1.19, 2.42],
  [-1.26, -1.75], [1.26, -1.75],
] as const;
const TIRE_HALF_WIDTH = 0.205;

export interface DriverInput {
  steer: number;
  throttle: number;
  brake: number;
}

export class CarPhysics {
  x = 0;
  z = 0;
  yaw = 0;
  vx = 0;
  vz = 0;
  yawRate = 0;
  offTrack = false;
  allWheelsOffTrack = false;
  collided = false;

  constructor(private readonly track: Pick<Track,
    'start' | 'startYaw' | 'curbOuterEdge' | 'outerFence' | 'colliders' | 'nearest'>) {
    this.reset();
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  reset(): void {
    this.x = this.track.start.x;
    this.z = this.track.start.z;
    this.yaw = this.track.startYaw;
    this.vx = this.vz = this.yawRate = 0;
    this.offTrack = false;
    this.allWheelsOffTrack = false;
    this.collided = false;
  }

  step(input: DriverInput, dt: number): void {
    const forwardX = Math.sin(this.yaw);
    const forwardZ = Math.cos(this.yaw);
    const rightX = forwardZ;
    const rightZ = -forwardX;
    const forwardVelocity = this.vx * forwardX + this.vz * forwardZ;
    const lateralVelocity = this.vx * rightX + this.vz * rightZ;
    const speed = this.speed;
    const grip = 24;
    const maxSteer = 0.34 / (1 + speed / 34);
    // The onboard camera faces local +Z, so screen-right corresponds to world -X.
    const steerAngle = -input.steer * maxSteer;
    const geometricYaw = forwardVelocity * Math.tan(steerAngle) / 3.1;
    const limitedYaw = Math.max(-grip / Math.max(speed, 4),
      Math.min(grip / Math.max(speed, 4), geometricYaw));
    this.yawRate += (limitedYaw - this.yawRate) * Math.min(1, 7 * dt);
    this.yaw += this.yawRate * dt;

    const engine = input.throttle * 19 * Math.max(0, 1 - speed / 93);
    const braking = input.brake * 30;
    const forwardAcceleration = engine - Math.sign(forwardVelocity) * braking;
    const lateralAcceleration = Math.max(-grip, Math.min(grip, -lateralVelocity * 7));
    const drag = 0.0023 * speed * speed + 0.8;
    const dragX = speed > 0.01 ? -this.vx / speed * drag : 0;
    const dragZ = speed > 0.01 ? -this.vz / speed * drag : 0;
    this.vx += (forwardX * forwardAcceleration + rightX * lateralAcceleration + dragX) * dt;
    this.vz += (forwardZ * forwardAcceleration + rightZ * lateralAcceleration + dragZ) * dt;
    if (input.brake > 0 && speed < 0.5 && input.throttle === 0) this.vx = this.vz = 0;
    if (input.throttle === 0 && this.speed < 0.05) this.vx = this.vz = 0;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.resolveCollisions();
    this.offTrack = this.track.nearest(this.x, this.z).distance > this.track.curbOuterEdge;
    this.allWheelsOffTrack = this.offTrack && this.areAllWheelsOutsideCurbs();
  }

  private areAllWheelsOutsideCurbs(): boolean {
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    let side = 0;
    for (const [localX, localZ] of WHEEL_CONTACTS) {
      const wheelX = this.x + localX * cos + localZ * sin;
      const wheelZ = this.z - localX * sin + localZ * cos;
      const signedDistance = this.track.nearest(wheelX, wheelZ).signedDistance;
      // A tire still touching the curb keeps the lap valid.
      if (Math.abs(signedDistance) <= this.track.curbOuterEdge + TIRE_HALF_WIDTH) return false;
      const wheelSide = Math.sign(signedDistance);
      if (side !== 0 && wheelSide !== side) return false;
      side = wheelSide;
    }
    return true;
  }

  private resolveCollisions(): void {
    this.collided = false;
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    // Test the wing and wheels, not only the car center, so a sideways car
    // cannot put its nose through the circular perimeter fence.
    for (let pass = 0; pass < 3; pass++) {
      let deepest = 0;
      let collisionNormalX = 0;
      let collisionNormalZ = 0;
      const { centerX, centerZ, radius } = this.track.outerFence;
      for (const [localX, localZ] of BODY_CONTACTS) {
        const pointX = this.x + localX * cos + localZ * sin;
        const pointZ = this.z - localX * sin + localZ * cos;
        const dx = pointX - centerX;
        const dz = pointZ - centerZ;
        const distance = Math.hypot(dx, dz);
        const penetration = distance - radius;
        if (penetration <= deepest) continue;
        deepest = penetration;
        collisionNormalX = dx / distance;
        collisionNormalZ = dz / distance;
      }
      if (deepest <= 0) break;
      this.x -= collisionNormalX * deepest;
      this.z -= collisionNormalZ * deepest;
      this.cancelImpact(collisionNormalX, collisionNormalZ);
    }

    for (const obstacle of this.track.colliders) {
      const dx = obstacle.x - this.x;
      const dz = obstacle.z - this.z;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      const nearestX = Math.max(-1.6, Math.min(1.6, localX));
      const nearestZ = Math.max(-2.3, Math.min(4.45, localZ));
      const gapX = localX - nearestX;
      const gapZ = localZ - nearestZ;
      const gap = Math.hypot(gapX, gapZ);
      const radius = obstacle.radius + 0.15;
      if (gap >= radius) continue;
      let normalLocalX: number;
      let normalLocalZ: number;
      let penetration: number;
      if (gap > 0.001) {
        normalLocalX = gapX / gap;
        normalLocalZ = gapZ / gap;
        penetration = radius - gap;
      } else {
        const faces = [
          { distance: 1.6 - localX, x: 1, z: 0 },
          { distance: 1.6 + localX, x: -1, z: 0 },
          { distance: 4.45 - localZ, x: 0, z: 1 },
          { distance: 2.3 + localZ, x: 0, z: -1 },
        ];
        const face = faces.reduce((a, b) => a.distance < b.distance ? a : b);
        normalLocalX = face.x;
        normalLocalZ = face.z;
        penetration = radius + face.distance;
      }
      const normalX = normalLocalX * cos + normalLocalZ * sin;
      const normalZ = -normalLocalX * sin + normalLocalZ * cos;
      this.x -= normalX * penetration;
      this.z -= normalZ * penetration;
      this.cancelImpact(normalX, normalZ);
    }
  }

  private cancelImpact(normalX: number, normalZ: number): void {
    const towardObstacle = this.vx * normalX + this.vz * normalZ;
    if (towardObstacle > 0) {
      this.vx -= normalX * towardObstacle * 1.08;
      this.vz -= normalZ * towardObstacle * 1.08;
      this.vx *= 0.65;
      this.vz *= 0.65;
      this.yawRate *= 0.4;
    }
    this.collided = true;
  }
}
