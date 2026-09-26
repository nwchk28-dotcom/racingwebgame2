export const TOP_SPEED_KMH = 340;
export const TOP_SPEED_MPS = TOP_SPEED_KMH / 3.6;

// Approximate redline speeds for the eight forward gears.
export const GEAR_END_SPEEDS = [55, 93, 132, 174, 216, 258, 300, TOP_SPEED_KMH] as const;

export function gearAtSpeed(kmh: number): { gear: number; rev: number } {
  const speed = Math.max(0, kmh);
  const index = GEAR_END_SPEEDS.findIndex(limit => speed < limit);
  const gearIndex = index < 0 ? GEAR_END_SPEEDS.length - 1 : index;
  const low = gearIndex === 0 ? 0 : GEAR_END_SPEEDS[gearIndex - 1];
  const high = GEAR_END_SPEEDS[gearIndex];
  return { gear: gearIndex + 1, rev: Math.min(1, (speed - low) / (high - low)) };
}
