import { describe, expect, it } from 'vitest';
import { LapTracker, type LapEvent } from './lap';
import { LapHud } from './lapHud';

function driveLap(laps: LapTracker, duration: number, invalid = false): LapEvent {
  let finished: LapEvent | null = null;
  for (let i = 1; i <= 101 && !finished; i++) {
    finished = laps.update((i / 100) % 1, invalid && i > 60, 100, duration / 100) ?? finished;
  }
  return finished!;
}

describe('finished lap HUD', () => {
  it('holds the full result for three seconds while timing the next lap', () => {
    const laps = new LapTracker(1000, 11, [.2, .7]);
    const hud = new LapHud();
    const event = driveLap(laps, 10);
    hud.completed(event, 1000);
    for (let i = 1; i <= 20; i++) laps.update(i / 100, false, 100, .1);
    expect(laps.lapNumber).toBe(2);
    expect(laps.lapTime).toBeCloseTo(2);
    for (const now of [1000, 3999]) {
      const view = hud.view(laps, now);
      expect(view.lapNumber).toBe(1);
      expect(view.time).toBeCloseTo(10);
      expect(view.gap).toBeCloseTo(-1);
      expect(view.sectors.map(s => s.time)).toEqual(event.sectors);
      expect(view.sectors.every(s => s.previous && !s.active)).toBe(true);
    }
    const current = hud.view(laps, 4000);
    expect(current.lapNumber).toBe(2);
    expect(current.time).toBeCloseTo(2);
    expect(current.sectors[0].time).toBeCloseTo(2);
    expect(current.sectors[1].active).toBe(true);
    expect(current.sectors[2].time).toBeNull();
    expect(current.sectors.every(s => !s.previous)).toBe(true);
  });

  it('keeps the improvement against the previous PB after the PB is saved', () => {
    const laps = new LapTracker(1000, null, [.2, .7]);
    driveLap(laps, 10);
    const event = driveLap(laps, 9);
    const hud = new LapHud();
    hud.completed(event, 0);
    expect(event.newBest).toBe(true);
    expect(laps.bestTime).toBeCloseTo(9);
    expect(hud.view(laps, 2999).gap).toBeCloseTo(-1);
    for (const [index, delta] of [-.2, -.5, -.3].entries()) {
      expect(hud.view(laps, 2999).sectors[index].delta).toBeCloseTo(delta);
    }
  });

  it('shows a slower lap gap, but no fabricated gap for a first or invalid lap', () => {
    const laps = new LapTracker(1000, null, [.2, .7]);
    const hud = new LapHud();
    hud.completed(driveLap(laps, 10), 0);
    expect(hud.view(laps, 1).gap).toBeNull();
    hud.completed(driveLap(laps, 11), 100);
    expect(hud.view(laps, 101).gap).toBeCloseTo(1);
    hud.completed(driveLap(laps, 9, true), 200);
    const invalid = hud.view(laps, 201);
    expect(invalid.valid).toBe(false);
    expect(invalid.invalidReason).toBe('コースアウト');
    expect(invalid.gap).toBeNull();
    expect(invalid.sectors.every(s => s.delta === null)).toBe(true);
    expect(laps.bestTime).toBeCloseTo(10);
  });

  it('discards held results on restart or course changes', () => {
    const laps = new LapTracker(1000);
    const hud = new LapHud();
    hud.completed(driveLap(laps, 10), 0);
    laps.reset();
    hud.reset();
    expect(hud.view(laps, 100).time).toBe(0);
    expect(hud.view(laps, 100).lapNumber).toBe(1);
    expect(hud.view(laps, 100).sectors.every(s => s.time === null)).toBe(true);
  });
});
