import type { TrackId } from './trackData';

const BEST_LAP_PREFIX = 'apex-one:best-lap:v1';

export function bestTimeKey(trackId: TrackId): string {
  return `${BEST_LAP_PREFIX}:${trackId}`;
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
