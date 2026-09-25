import { describe, expect, it } from 'vitest';
import { LapTracker, formatTime } from './lap';

function driveLap(tracker: LapTracker, allWheelsOffTrack = false): ReturnType<LapTracker['update']> {
  let event = null;
  for (let i = 1; i <= 100; i++) {
    event = tracker.update((i / 100) % 1, allWheelsOffTrack, 20, 0.1) ?? event;
  }
  return event;
}

describe('lap timing', () => {
  it('records a complete lap and keeps the best after reset', () => {
    const lap = new LapTracker(1000);
    const result = driveLap(lap);
    expect(result?.valid).toBe(true);
    expect(result?.newBest).toBe(true);
    expect(lap.lapNumber).toBe(2);
    expect(lap.bestTime).toBeCloseTo(10);
    lap.reset();
    expect(lap.bestTime).toBeCloseTo(10);
    expect(lap.lapNumber).toBe(1);
  });

  it('invalidates off-track laps without overwriting the best', () => {
    const lap = new LapTracker(1000, 9);
    const result = driveLap(lap, true);
    expect(result?.valid).toBe(false);
    expect(result?.newBest).toBe(false);
    expect(lap.bestTime).toBe(9);
  });

  it('keeps a lap invalid after all wheels return to the course', () => {
    const lap = new LapTracker(1000);
    lap.update(0, true, 20, 0.1);
    const result = driveLap(lap);
    expect(result?.valid).toBe(false);
    expect(lap.bestTime).toBeNull();
    expect(lap.valid).toBe(true);
  });

  it('invalidates a sustained reverse movement', () => {
    const lap = new LapTracker(1000);
    lap.update(0, false, 20, 0.1);
    lap.update(0.04, false, 20, 0.1);
    lap.update(0.03, false, 20, 0.1);
    expect(lap.valid).toBe(false);
    expect(lap.invalidReason).toBe('逆走');
  });

  it('formats lap times', () => {
    expect(formatTime(null)).toBe('--:--.---');
    expect(formatTime(83.456)).toBe('01:23.456');
  });
});
