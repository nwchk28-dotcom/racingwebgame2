import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CarPhysics } from './physics';
import type { Track } from './track';
import { gearAtSpeed, TOP_SPEED_KMH } from './vehicleTuning';

const straightTrack = {
  start: new Vector3(0, 0, 0),
  startYaw: 0,
  curbOuterEdge: 10.7,
  outerFence: { centerX: 0, centerZ: 0, radius: 500 },
  colliders: [],
  nearest: (x: number, z: number) => ({
    progress: z / 1000, distance: Math.abs(x),
    centerX: 0, centerZ: z, normalX: 1, normalZ: 0, signedDistance: x,
  }),
} satisfies Pick<Track, 'start' | 'startYaw' | 'curbOuterEdge' | 'outerFence' | 'colliders' | 'nearest'>;

describe('car physics', () => {
  it('accelerates, steers and brakes', () => {
    const car = new CarPhysics(straightTrack);
    for (let i = 0; i < 360; i++) car.step({ steer: 0, throttle: 1, brake: 0 }, 1 / 120);
    const fastSpeed = car.speed;
    expect(fastSpeed).toBeGreaterThan(25);
    expect(car.z).toBeGreaterThan(30);
    for (let i = 0; i < 80; i++) car.step({ steer: 0.5, throttle: 1, brake: 0 }, 1 / 120);
    expect(car.yaw).toBeLessThan(0);
    expect(car.x).toBeLessThan(0);
    for (let i = 0; i < 180; i++) car.step({ steer: 0, throttle: 0, brake: 1 }, 1 / 120);
    expect(car.speed).toBeLessThan(fastSpeed);
  });

  it('returns to the start pose on reset', () => {
    const car = new CarPhysics(straightTrack);
    for (let i = 0; i < 120; i++) car.step({ steer: 0, throttle: 1, brake: 0 }, 1 / 120);
    car.reset();
    expect(car.x).toBe(0);
    expect(car.z).toBe(0);
    expect(car.speed).toBe(0);
  });

  it('turns left for negative input', () => {
    const car = new CarPhysics(straightTrack);
    for (let i = 0; i < 180; i++) car.step({ steer: -0.45, throttle: 1, brake: 0 }, 1 / 120);
    expect(car.yaw).toBeGreaterThan(0);
    expect(car.x).toBeGreaterThan(0);
  });

  it('stops at the circular perimeter fence instead of passing through', () => {
    const car = new CarPhysics({ ...straightTrack,
      outerFence: { centerX: -60, centerZ: 40, radius: 50 },
    });
    car.x = -11.4;
    car.z = 40;
    car.vx = 35;
    car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
    expect(car.collided).toBe(true);
    expect(car.x).toBeLessThanOrEqual(-11.6);
    expect(car.vx).toBeLessThan(0);
  });

  it('keeps the front wing inside the circular fence when sideways', () => {
    const car = new CarPhysics({ ...straightTrack,
      outerFence: { centerX: 0, centerZ: 0, radius: 50 },
    });
    car.x = 46.5;
    car.yaw = Math.PI / 2;
    car.vx = 15;
    car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
    expect(car.collided).toBe(true);
    expect(car.x + 4.3).toBeLessThanOrEqual(50 + 0.001);
  });

  it('handles on-track and off-track surfaces the same way', () => {
    const inside = new CarPhysics(straightTrack);
    const outside = new CarPhysics(straightTrack);
    outside.x = 13;
    inside.vz = outside.vz = 28;
    const input = { steer: 0.45, throttle: 0.7, brake: 0 };
    for (let i = 0; i < 40; i++) {
      inside.step(input, 1 / 120);
      outside.step(input, 1 / 120);
    }
    expect(outside.offTrack).toBe(true);
    expect(outside.yaw).toBeCloseTo(inside.yaw, 8);
    expect(outside.vx).toBeCloseTo(inside.vx, 8);
    expect(outside.vz).toBeCloseTo(inside.vz, 8);
  });

  it('keeps the lap legal while a tire touches the curb and flags four wheels beyond it', () => {
    const car = new CarPhysics(straightTrack);
    car.x = 11.9;
    car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
    expect(car.allWheelsOffTrack).toBe(false);
    car.x = 12.3;
    car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
    expect(car.allWheelsOffTrack).toBe(true);
  });

  it('cannot drive through an obstacle post', () => {
    const car = new CarPhysics({
      ...straightTrack,
      colliders: [{ x: 0, z: 15, radius: 0.5 }],
    });
    car.z = 9.9;
    car.vz = 28;
    car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
    expect(car.collided).toBe(true);
    expect(car.z).toBeLessThanOrEqual(9.9);
    expect(car.vz).toBeLessThan(0);
  });

  it('approaches 340 km/h in eighth gear on a long straight', () => {
    const car = new CarPhysics({ ...straightTrack,
      outerFence: { centerX: 0, centerZ: 0, radius: 10000 },
    });
    for (let i = 0; i < 120 * 45; i++) car.step({ steer: 0, throttle: 1, brake: 0 }, 1 / 120);
    const kmh = car.speed * 3.6;
    expect(kmh).toBeGreaterThan(TOP_SPEED_KMH - 2);
    expect(kmh).toBeLessThan(TOP_SPEED_KMH + 1);
    expect(gearAtSpeed(kmh).gear).toBe(8);
  });
});
