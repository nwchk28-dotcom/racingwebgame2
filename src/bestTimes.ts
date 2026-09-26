import type { TrackId } from './trackData';

const LEGACY_NOVA_KEY = 'apex-one:best-lap:v1';

export function bestTimeKey(trackId: TrackId): string {
  return trackId === 'nova' ? LEGACY_NOVA_KEY : `${LEGACY_NOVA_KEY}:${trackId}`;
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
