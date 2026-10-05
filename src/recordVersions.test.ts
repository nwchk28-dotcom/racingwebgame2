import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRACKS, type TrackId } from './trackData';

const revisions = vi.hoisted(() => ({ global: 0, tracks: {} as Partial<Record<TrackId, number>> }));
vi.mock('./recordVersions', () => ({ RECORD_VERSIONS: revisions }));
import { bestTimeKey, readBestRecord, readBestTime, saveBestRecord } from './bestTimes';

const record = { time: 90, sectors: [20, 35, 35] as [number, number, number],
  trace: [[0, 0], [.2, 20], [.7, 55], [1, 90]] as [number, number][] };
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
}
afterEach(() => { revisions.global = 0; revisions.tracks = {}; });

describe('record compatibility revisions', () => {
  it('retains current compatible numeric and sector records without a revision change', () => {
    const storage = memoryStorage();
    saveBestRecord('monza', record, storage);
    expect(bestTimeKey('monza')).toBe('apex-one:best-lap:v1:monza');
    expect(readBestTime('monza', storage)).toBe(90);
    expect(readBestRecord('monza', storage)).toEqual(record);
  });
  it('resets only the changed course, including its splits and gap trace', () => {
    const storage = memoryStorage();
    for (const track of TRACKS) saveBestRecord(track.id, record, storage);
    revisions.tracks.monza = 1;
    for (const track of TRACKS) {
      expect(readBestTime(track.id, storage)).toEqual(track.id === 'monza' ? null : 90);
      expect(readBestRecord(track.id, storage)).toEqual(track.id === 'monza' ? null : record);
    }
    saveBestRecord('monza', record, storage);
    expect(readBestRecord('monza', storage)).toEqual(record);
  });
  it('resets every course after shared driving rules change', () => {
    const storage = memoryStorage();
    for (const track of TRACKS) saveBestRecord(track.id, record, storage);
    revisions.global++;
    for (const track of TRACKS) {
      expect(readBestTime(track.id, storage)).toBeNull();
      expect(readBestRecord(track.id, storage)).toBeNull();
    }
  });
  it('does not restore incompatible records on later global or course updates', () => {
    const storage = memoryStorage();
    saveBestRecord('monza', record, storage);
    revisions.tracks.monza = 1;
    saveBestRecord('monza', record, storage);
    revisions.global = 1;
    expect(readBestRecord('monza', storage)).toBeNull();
    saveBestRecord('monza', record, storage);
    revisions.tracks.monza = 2;
    expect(readBestTime('monza', storage)).toBeNull();
    revisions.global = 2;
    expect(readBestRecord('monza', storage)).toBeNull();
  });
  it('preserves the corrected Singapore direction namespace', () => {
    const storage = memoryStorage();
    storage.setItem('apex-one:best-lap:v1:singapore', '80');
    expect(readBestTime('singapore', storage)).toBeNull();
    saveBestRecord('singapore', record, storage);
    revisions.tracks.singapore = 1;
    expect(readBestTime('singapore', storage)).toBeNull();
    expect(bestTimeKey('singapore')).toContain(':direction-v2:rules-0:course-1');
  });
});
