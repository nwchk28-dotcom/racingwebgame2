import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CarPhysics } from './physics';
import type { Track } from './track';

const straightTrack = {
  start: new Vector3(0, 0, 0),
  startYaw: 0,
  roadHalfWidth: 7,
  barrierHalfWidth: 12.3,
  colliders: [],
  nearest: (x: number, z: number) => ({
    progress: z / 1000, distance: Math.abs(x),
    centerX: 0, centerZ: z, normalX: 1, normalZ: 0, signedDistance: x,
  }),
} satisfies Pick<Track, 'start' | 'startYaw' | 'roadHalfWidth' | 'barrierHalfWidth' | 'colliders' | 'nearest'>;

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

  it('stops at the guardrail instead of passing through', () => {
    const car = new CarPhysics(straightTrack);
    car.x = 10.7;
    car.vx = 35;
    car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
    expect(car.collided).toBe(true);
    expect(car.x).toBeLessThanOrEqual(10.8);
    expect(car.vx).toBeLessThan(0);
  });

  it('keeps the front wing inside the guardrail when the car is sideways', () => {
    const car = new CarPhysics(straightTrack);
    car.x = 8.2;
    car.yaw = Math.PI / 2;
    car.vx = 15;
    car.step({ steer: 0, throttle: 0, brake: 0 }, 1 / 120);
    expect(car.collided).toBe(true);
    expect(car.x + 4.3).toBeLessThanOrEqual(12.3 + 0.001);
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
});
