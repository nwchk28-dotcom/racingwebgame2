import { describe, expect, it } from 'vitest';
import { bestTimeKey, readBestTime, saveBestTime } from './bestTimes';

describe('per-circuit best laps', () => {
  it('separates all available circuits without changing the old NOVA record', () => {
    const values = new Map<string, string>([['apex-one:best-lap:v1', '83.456']]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(bestTimeKey('monza')).toBe('apex-one:best-lap:v1:monza:rules-2:course-0');
    expect(readBestTime('monza', storage)).toBeNull();
    saveBestTime('monza', 112.3, storage);
    saveBestTime('silverstone', 118.2, storage);
    saveBestTime('albert-park', 93.1, storage);
    saveBestTime('mexico-city', 85.2, storage);
    saveBestTime('gilles-villeneuve', 87.3, storage);
    saveBestTime('monaco', 79.5, storage);
    saveBestTime('spa', 125.7, storage);
    saveBestTime('sao-paulo', 81.4, storage);
    saveBestTime('jeddah', 121.5, storage);
    saveBestTime('baku', 119.2, storage);
    saveBestTime('abu-dhabi', 105.4, storage);
    saveBestTime('singapore', 109.7, storage);
    saveBestTime('sepang', 101.2, storage);
    expect(readBestTime('monza', storage)).toBe(112.3);
    expect(readBestTime('silverstone', storage)).toBe(118.2);
    expect(readBestTime('albert-park', storage)).toBe(93.1);
    expect(readBestTime('mexico-city', storage)).toBe(85.2);
    expect(readBestTime('gilles-villeneuve', storage)).toBe(87.3);
    expect(readBestTime('monaco', storage)).toBe(79.5);
    expect(readBestTime('spa', storage)).toBe(125.7);
    expect(readBestTime('sao-paulo', storage)).toBe(81.4);
    expect(readBestTime('jeddah', storage)).toBe(121.5);
    expect(readBestTime('baku', storage)).toBe(119.2);
    expect(readBestTime('abu-dhabi', storage)).toBe(105.4);
    expect(readBestTime('singapore', storage)).toBe(109.7);
    expect(values.get('apex-one:best-lap:v1')).toBe('83.456');
    expect(readBestTime('sepang', storage)).toBe(101.2);
    expect(values.size).toBe(14);
  });

  it('keeps reverse-direction Singapore records separate from the corrected lap', () => {
    const oldKey = 'apex-one:best-lap:v1:singapore';
    const values = new Map([[oldKey, '90.123']]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(readBestTime('singapore', storage)).toBeNull();
    saveBestTime('singapore', 110.456, storage);
    expect(readBestTime('singapore', storage)).toBe(110.456);
    expect(values.get(oldKey)).toBe('90.123');
    expect(bestTimeKey('monza')).toBe('apex-one:best-lap:v1:monza:rules-2:course-0');
  });

  it('ignores invalid or unavailable storage values', () => {
    expect(readBestTime('monza', { getItem: () => 'NaN' })).toBeNull();
    expect(readBestTime('monza', { getItem: () => '0' })).toBeNull();
    expect(readBestTime('monza', { getItem: () => { throw Error('blocked'); } })).toBeNull();
    expect(() => saveBestTime('monza', 91, { setItem: () => { throw Error('blocked'); } }))
      .not.toThrow();
  });
});

describe('stored PB splits and position trace', () => {
  it('reloads the same lap record separately for each course', async () => {
    const { readBestRecord, saveBestRecord } = await import('./bestTimes');
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); } };
    const record = { time: 90, sectors: [20, 35, 35] as [number, number, number],
      trace: [[0, 0], [.2, 20], [.7, 55], [1, 90]] as [number, number][] };
    saveBestRecord('monza', record, storage);
    expect(readBestRecord('monza', storage)).toEqual(record);
    expect(readBestRecord('spa', storage)).toBeNull();
    // A legacy/newer numeric PB without matching splits cannot inherit wrong deltas.
    saveBestTime('monza', 89, storage);
    expect(readBestRecord('monza', storage)).toBeNull();
  });
  it('rejects malformed or non-monotonic traces and mismatched sector sums', async () => {
    const { readBestRecord, saveBestRecord } = await import('./bestTimes');
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); } };
    for (const record of [
      { time: 90, sectors: [20, 35, 34], trace: [[0, 0], [1, 90]] },
      { time: 90, sectors: [20, 35, 35], trace: [[0, 0], [.5, 20], [.4, 30], [1, 90]] },
    ]) {
      saveBestRecord('monza', record as import('./lap').BestLapRecord, storage);
      expect(readBestRecord('monza', storage)).toBeNull();
    }
    expect(readBestRecord('monza', { getItem: () => '{broken' })).toBeNull();
  });
});
