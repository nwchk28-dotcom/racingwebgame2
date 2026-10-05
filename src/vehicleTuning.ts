export const TOP_SPEED_KMH = 300;
export const TOP_SPEED_MPS = TOP_SPEED_KMH / 3.6;

// Approximate redline speeds for the eight forward gears.
export const GEAR_END_SPEEDS = [50, 82, 116, 153, 190, 228, 265, TOP_SPEED_KMH] as const;

export function gearAtSpeed(kmh: number): { gear: number; rev: number } {
  const speed = Math.max(0, kmh);
  const index = GEAR_END_SPEEDS.findIndex(limit => speed < limit);
  const gearIndex = index < 0 ? GEAR_END_SPEEDS.length - 1 : index;
  const low = gearIndex === 0 ? 0 : GEAR_END_SPEEDS[gearIndex - 1];
  const high = GEAR_END_SPEEDS[gearIndex];
  return { gear: gearIndex + 1, rev: Math.min(1, (speed - low) / (high - low)) };
}

// Model's original widest part (front-wing endplates) spans 3.08 m.
// Scale only lateral geometry; preserve the existing camera and handling.
export const CAR_WIDTH_M = 2;
export const CAR_LATERAL_SCALE = CAR_WIDTH_M / 3.08;
export const CAR_CONTACT_RADIUS = 0.1;
export const CAR_CONTACT_HALF_WIDTH = CAR_WIDTH_M / 2 - CAR_CONTACT_RADIUS;
