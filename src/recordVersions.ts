import type { TrackId } from './trackData';

/** Increase for changes to shared physics, tyres, steering or lap validity rules.
 * Never decrease or reuse a revision: old, incompatible records must stay hidden.
 * Cosmetic/audio/UI changes do not need a revision increase. */
export const RECORD_VERSIONS = {
  // Finite rail endpoints do not extend invisible collision planes into the road.
  global: 9,
  /** Increase only affected courses for layout, road width, wall or timing changes.
   * Missing entries have revision 0, preserving currently compatible records. */
  // Restore the native passable rail openings at both chicanes.
  tracks: {monaco:1,suzuka:1} as Partial<Record<TrackId, number>>,
};
