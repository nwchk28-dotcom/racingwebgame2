import { describe, expect, it } from 'vitest';
import { bestTimeKey, readBestTime, saveBestTime } from './bestTimes';

describe('per-circuit best laps', () => {
  it('retains the old NOVA key and separates the new circuits', () => {
    const values = new Map<string, string>([['apex-one:best-lap:v1', '83.456']]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(bestTimeKey('nova')).toBe('apex-one:best-lap:v1');
    expect(readBestTime('nova', storage)).toBe(83.456);
    expect(readBestTime('monza', storage)).toBeNull();
    saveBestTime('monza', 112.3, storage);
    saveBestTime('silverstone', 118.2, storage);
    saveBestTime('albert-park', 93.1, storage);
    saveBestTime('mexico-city', 85.2, storage);
    saveBestTime('gilles-villeneuve', 87.3, storage);
    saveBestTime('monaco', 79.5, storage);
    saveBestTime('spa', 125.7, storage);
    saveBestTime('sao-paulo', 81.4, storage);
    expect(readBestTime('monza', storage)).toBe(112.3);
    expect(readBestTime('silverstone', storage)).toBe(118.2);
    expect(readBestTime('albert-park', storage)).toBe(93.1);
    expect(readBestTime('mexico-city', storage)).toBe(85.2);
    expect(readBestTime('gilles-villeneuve', storage)).toBe(87.3);
    expect(readBestTime('monaco', storage)).toBe(79.5);
    expect(readBestTime('spa', storage)).toBe(125.7);
    expect(readBestTime('sao-paulo', storage)).toBe(81.4);
    expect(readBestTime('nova', storage)).toBe(83.456);
    expect(values.size).toBe(9);
  });

  it('ignores invalid or unavailable storage values', () => {
    expect(readBestTime('monza', { getItem: () => 'NaN' })).toBeNull();
    expect(readBestTime('monza', { getItem: () => '0' })).toBeNull();
    expect(readBestTime('monza', { getItem: () => { throw Error('blocked'); } })).toBeNull();
    expect(() => saveBestTime('monza', 91, { setItem: () => { throw Error('blocked'); } }))
      .not.toThrow();
  });
});
