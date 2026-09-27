import { describe, expect, it } from 'vitest';
import { bestTimeKey, readBestTime, saveBestTime } from './bestTimes';

describe('per-circuit best laps', () => {
  it('separates all available circuits without changing the old NOVA record', () => {
    const values = new Map<string, string>([['apex-one:best-lap:v1', '83.456']]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(bestTimeKey('monza')).toBe('apex-one:best-lap:v1:monza');
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
    expect(values.size).toBe(13);
  });

  it('ignores invalid or unavailable storage values', () => {
    expect(readBestTime('monza', { getItem: () => 'NaN' })).toBeNull();
    expect(readBestTime('monza', { getItem: () => '0' })).toBeNull();
    expect(readBestTime('monza', { getItem: () => { throw Error('blocked'); } })).toBeNull();
    expect(() => saveBestTime('monza', 91, { setItem: () => { throw Error('blocked'); } }))
      .not.toThrow();
  });
});
