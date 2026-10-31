import type { TrackId } from './trackData';

/** Increase for changes to shared physics, tyres, steering or lap validity rules.
 * Never decrease or reuse a revision: old, incompatible records must stay hidden.
 * Cosmetic/audio/UI changes do not need a revision increase. */
export const RECORD_VERSIONS = {
  // Finite rail endpoints do not extend invisible collision planes into the road.
  global: 9,
  /** Increase only affected courses for layout, road width, wall or timing changes.
   * Missing entries have revision 0, preserving currently compatible records. */
  // Native scenery replaces generic buildings and their old collision circles.
  // Spa keeps its approved revision; only newly replaced courses increase here.
  tracks: {spa:1,monaco:2,suzuka:2,monza:1,silverstone:1,'albert-park':1,'mexico-city':1,
    'gilles-villeneuve':1,'sao-paulo':1,jeddah:1,baku:1,'abu-dhabi':1,singapore:1,
    shanghai:1,bahrain:1,miami:1,imola:1,barcelona:1,austria:1,hungary:1,
    zandvoort:1,austin:1,'las-vegas':1,lusail:1,sepang:1} as Partial<Record<TrackId, number>>,
};
