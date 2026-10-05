import type { TrackId } from './trackData';

/** F1 timing-sector boundaries projected from the official colored circuit maps.
 * Distances are normalized from each game's control line, not equal thirds.
 * The survey centerline is simplified: placements are map-derived approximations.
 * Sources and audit notes: SECTOR_REFERENCES.md. Sepang uses its final F1 event (2017).
 */
export const SECTOR_BOUNDARIES: Record<TrackId, readonly [number, number]> = {
  monza: [.35207, .66760],
  silverstone: [.27222, .73371],
  'albert-park': [.33521, .59991],
  'mexico-city': [.43798, .79500],
  'gilles-villeneuve': [.31541, .61467],
  monaco: [.32501, .72836],
  spa: [.31481, .70180],
  'sao-paulo': [.28877, .72044],
  jeddah: [.33025, .68487],
  baku: [.31837, .65553],
  'abu-dhabi': [.20392, .65516],
  singapore: [.30942, .68647],
  shanghai: [.26999, .56872],
  bahrain: [.29617, .69690],
  miami: [.29608, .64834],
  imola: [.31826, .64534],
  barcelona: [.32283, .70405],
  austria: [.25675, .65820],
  hungary: [.32113, .67436],
  zandvoort: [.36035, .72432],
  austin: [.24504, .65139],
  'las-vegas': [.24745, .51530],
  lusail: [.33450, .63124],
  sepang: [.26382, .65514],
};
