import type { TrackId } from './trackData';

/** Increase for changes to shared physics, tyres, steering or lap validity rules.
 * Never decrease or reuse a revision: old, incompatible records must stay hidden.
 * Cosmetic/audio/UI changes do not need a revision increase. */
export const RECORD_VERSIONS = {
  // Reference onboard camera changes corner visibility across every course.
  global: 1,
  /** Increase only affected courses for layout, road width, wall or timing changes.
   * Missing entries have revision 0, preserving currently compatible records. */
  tracks: {} as Partial<Record<TrackId, number>>,
};
