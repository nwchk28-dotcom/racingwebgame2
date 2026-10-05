import type { TrackId } from './trackData';

const BEST_LAP_PREFIX = 'apex-one:best-lap:v1';

export function bestTimeKey(trackId: TrackId): string {
  // Old Singapore records were driven in reverse and are not comparable.
  // Retain that stored value, but use a fresh record for the corrected layout.
  const version = trackId === 'singapore' ? ':direction-v2' : '';
  return `${BEST_LAP_PREFIX}:${trackId}${version}`;
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
