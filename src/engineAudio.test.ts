import { describe, expect, it } from 'vitest';
import { gearAtSpeed } from './engineAudio';

describe('engine gears', () => {
  it('raises revs within each gear and drops them on an upshift', () => {
    expect(gearAtSpeed(0)).toEqual({ gear: 1, rev: 0 });
    expect(gearAtSpeed(31).rev).toBeGreaterThan(gearAtSpeed(10).rev);
    expect(gearAtSpeed(32).gear).toBe(2);
    expect(gearAtSpeed(32).rev).toBe(0);
    expect(gearAtSpeed(57).rev).toBeGreaterThan(gearAtSpeed(40).rev);
    expect(gearAtSpeed(200).gear).toBe(8);
    expect(gearAtSpeed(300).rev).toBe(1);
  });
});
