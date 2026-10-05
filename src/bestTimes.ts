import type { TrackId } from './trackData';
import type { BestLapRecord } from './lap';
import { RECORD_VERSIONS } from './recordVersions';

const BEST_LAP_PREFIX = 'apex-one:best-lap:v1';

export function bestTimeKey(trackId: TrackId): string {
  // Old Singapore records were driven in reverse and are not comparable.
  // Retain that stored value, but use a fresh record for the corrected layout.
  const version = trackId === 'singapore' ? ':direction-v2' : '';
  const globalRevision = RECORD_VERSIONS.global;
  const trackRevision = RECORD_VERSIONS.tracks[trackId] ?? 0;
  // Revision zero keeps existing compatible PBs. Both numeric PBs and splits
  // use this same key; changing either revision resets them together.
  const revision = globalRevision === 0 && trackRevision === 0
    ? '' : `:rules-${globalRevision}:course-${trackRevision}`;
  return `${BEST_LAP_PREFIX}:${trackId}${version}${revision}`;
}

export function readBestTime(trackId: TrackId, storage?: Pick<Storage, 'getItem'>): number | null {
  try {
    const raw = (storage ?? window.localStorage).getItem(bestTimeKey(trackId));
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveBestTime(trackId: TrackId, time: number,
  storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? window.localStorage).setItem(bestTimeKey(trackId), String(time));
  } catch {
    // Private browsing can disable local storage.
  }
}

export function readBestRecord(trackId: TrackId, storage?: Pick<Storage, 'getItem'>): BestLapRecord | null {
  try {
    const target = storage ?? window.localStorage;
    const raw = target.getItem(`${bestTimeKey(trackId)}:sectors-v1`);
    if (!raw) return null;
    const record = JSON.parse(raw) as BestLapRecord;
    if (!Number.isFinite(record.time) || record.time <= 0 || record.time !== readBestTime(trackId, target) ||
      !Array.isArray(record.sectors) || record.sectors.length !== 3 ||
      record.sectors.some(time => !Number.isFinite(time) || time <= 0) ||
      Math.abs(record.sectors.reduce((a, b) => a + b, 0) - record.time) > .001 ||
      !Array.isArray(record.trace) || record.trace.length < 2 || record.trace.length > 2000) return null;
    let previousProgress = -1;
    let previousTime = -1;
    for (const point of record.trace) {
      if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) ||
        point[0] <= previousProgress || point[0] < 0 || point[0] > 1 || point[1] < previousTime) return null;
      [previousProgress, previousTime] = point;
    }
    if (record.trace[0][0] !== 0 || record.trace[0][1] !== 0 ||
      record.trace.at(-1)![0] !== 1 || Math.abs(record.trace.at(-1)![1] - record.time) > .001) return null;
    return record;
  } catch { return null; }
}

export function saveBestRecord(trackId: TrackId, record: BestLapRecord,
  storage?: Pick<Storage, 'setItem'>): void {
  try {
    const target = storage ?? window.localStorage;
    target.setItem(`${bestTimeKey(trackId)}:sectors-v1`, JSON.stringify(record));
    target.setItem(bestTimeKey(trackId), String(record.time));
  } catch { /* Storage disabled or full: keep the in-memory best. */ }
}
