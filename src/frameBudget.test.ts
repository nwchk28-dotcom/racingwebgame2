import { describe, expect, it } from 'vitest';
import { FrameBudget } from './frameBudget';
import { CarPhysics } from './physics';
import { TrackPath } from './trackPath';
import { TRACKS } from './trackData';

function accepted(fps: number, refresh: number): number[] {
  const budget = new FrameBudget(fps);
  const times: number[] = [];
  for (let i = 0; i < refresh * 10; i++) {
    const now = i * 1000 / refresh;
    if (budget.due(now)) times.push(now);
  }
  return times;
}
describe('presentation frame budget', () => {
  it('targets 60 fps across common screen refresh rates', () => {
    for (const refresh of [60, 90, 120]) expect(accepted(60, refresh)).toHaveLength(600);
    // When the browser only supplies 30 callbacks, consume every available one.
    expect(accepted(60, 30)).toHaveLength(300);
    expect(accepted(20, 60)).toHaveLength(200);
  });
  it('recovers from background stalls without a burst of catch-up frames', () => {
    const budget = new FrameBudget(30);
    expect(budget.due(0)).toBe(true);
    expect(budget.due(10)).toBe(false);
    expect(budget.due(10000)).toBe(true);
    expect(budget.due(10001)).toBe(false);
    budget.reset();
    expect(budget.due(10001)).toBe(true);
  });
  it('keeps the same fixed physics steps and car position with 30 or 60 fps presentation', () => {
    const path = new TrackPath(TRACKS[0]);
    const track = Object.assign(path, { walls: { contact: () => null }, colliders: [], curbOuterEdge: path.curbOuterEdgeAt(0),
      outerFence: { centerX: 0, centerZ: 0, radius: 1e6 } });
    function simulate(fps: number) {
      const budget = new FrameBudget(fps);
      const physics = new CarPhysics(track);
      let last = 0, accumulator = 0, steps = 0;
      for (let i = 0; i <= 1200; i++) {
        const now = i * 1000 / 120;
        if (!budget.due(now)) continue;
        accumulator += Math.min((now - last) / 1000, .05);
        last = now;
        while (accumulator + 1e-12 >= 1 / 120) {
          physics.step({ throttle: 1, brake: 0, steer: .1 }, 1 / 120);
          accumulator -= 1 / 120;
          steps++;
        }
      }
      return { steps, x: physics.x, z: physics.z, speed: physics.speed };
    }
    expect(simulate(30)).toEqual(simulate(60));
  });
});
