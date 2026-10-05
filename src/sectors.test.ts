import { describe, expect, it } from 'vitest';
import { TRACKS } from './trackData';
import { SECTOR_BOUNDARIES } from './sectors';
import { LapTracker, formatGap } from './lap';

describe('F1 timing sectors', () => {
  it('provides ordered non-uniform sector gates for all 24 circuits', () => {
    expect(Object.keys(SECTOR_BOUNDARIES)).toHaveLength(TRACKS.length);
    for (const track of TRACKS) {
      const [s1, s2] = SECTOR_BOUNDARIES[track.id];
      expect(s1).toBeGreaterThan(.1);
      expect(s2).toBeGreaterThan(s1);
      expect(s2).toBeLessThan(.9);
      expect(s1 === 1 / 3 && s2 === 2 / 3).toBe(false);
    }
  });

  it('interpolates crossing instants, sums three sectors and compares to the PB lap', () => {
    const lap = new LapTracker(1000, null, [.235, .645]);
    let event = null;
    for (let i = 1; i <= 100; i++) event = lap.update((i / 100) % 1, false, 100, .1) ?? event;
    expect(event!.sectors[0]).toBeCloseTo(2.35, 8);
    expect(event!.sectors[1]).toBeCloseTo(4.1, 8);
    expect(event!.sectors[2]).toBeCloseTo(3.55, 8);
    expect(event!.sectors.reduce((a, b) => a + b)).toBeCloseTo(event!.time, 8);
    lap.reset();
    for (let i = 1; i <= 30; i++) lap.update(i / 100, false, 100, .08);
    expect(lap.sectorDeltas[0]).toBeCloseTo(-.47, 8);
    expect(lap.gap).toBeCloseTo(-.6, 8);
    expect(lap.currentSector).toBe(2);
    expect(formatGap(lap.gap)).toBe('−0.600');
  });

  it('does not award a sector twice when reversing through its boundary', () => {
    const lap = new LapTracker(1000, null, [.2, .7]);
    for (let i = 1; i <= 21; i++) lap.update(i / 100, false, 100, .1);
    const s1 = lap.sectorTimes[0];
    lap.update(.195, false, 100, .1);
    lap.update(.205, false, 100, .1);
    expect(lap.sectorTimes[0]).toBe(s1);
    expect(lap.currentSector).toBe(2);
    expect(lap.valid).toBe(false);
  });

  it('retains only valid PB sectors and clears comparison on an invalid lap', () => {
    const lap = new LapTracker(1000, null, [.2, .7]);
    for (let i = 1; i <= 100; i++) lap.update((i / 100) % 1, false, 100, .1);
    const best = lap.bestRecord;
    lap.reset();
    for (let i = 1; i <= 100; i++) lap.update((i / 100) % 1, i > 60, 100, .09);
    expect(lap.bestRecord).toBe(best);
    expect(lap.lastSectorDeltas).toEqual([null, null, null]);
    lap.reset();
    expect(lap.sectorTimes).toEqual([null, null, null]);
    expect(lap.gap).toBeNull();
    expect(lap.bestRecord).toBe(best);
  });

  it('keeps old numeric bests while waiting for a newly recorded PB trace', () => {
    const lap = new LapTracker(1000, 9, [.2, .7]);
    for (let i = 1; i <= 30; i++) lap.update(i / 100, false, 100, .1);
    expect(lap.gap).toBeNull();
    expect(lap.sectorDeltas).toEqual([null, null, null]);
    expect(formatGap(null)).toBe('—');
  });
});
