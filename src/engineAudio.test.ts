import { describe, expect, it } from 'vitest';
import { EngineAudio, gearAtSpeed, pitchAtSpeed } from './engineAudio';

describe('engine gears', () => {
  it('raises revs within each gear and drops them on an upshift', () => {
    expect(gearAtSpeed(0)).toEqual({ gear: 1, rev: 0 });
    expect(gearAtSpeed(54).rev).toBeGreaterThan(gearAtSpeed(10).rev);
    expect(gearAtSpeed(55).gear).toBe(2);
    expect(gearAtSpeed(55).rev).toBe(0);
    expect(gearAtSpeed(92).rev).toBeGreaterThan(gearAtSpeed(65).rev);
    expect(gearAtSpeed(300).gear).toBe(8);
    expect(gearAtSpeed(340).rev).toBe(1);
  });

  it('maps a given speed to one stable pitch, with a drop at each upshift', () => {
    expect(pitchAtSpeed(0)).toBe(130);
    expect(pitchAtSpeed(55)).toBe(156);
    const boundaries = [0, 55, 93, 132, 174, 216, 258, 300, 340];
    for (let gear = 0; gear < boundaries.length - 1; gear++) {
      const low = boundaries[gear];
      const high = boundaries[gear + 1];
      expect(pitchAtSpeed(high - 0.1)).toBeGreaterThan(pitchAtSpeed(low));
      if (gear < boundaries.length - 2) expect(pitchAtSpeed(high)).toBeLessThan(pitchAtSpeed(high - 0.1));
    }
    expect(pitchAtSpeed(200)).toBeGreaterThan(pitchAtSpeed(20));
    expect(pitchAtSpeed(400)).toBe(pitchAtSpeed(340));
  });

  it('keeps pitch unchanged when only throttle or playback time changes', () => {
    const frequencies: number[] = [];
    const volumes: number[] = [];
    const audio = new EngineAudio();
    Object.assign(audio, {
      context: { currentTime: 10 },
      source: { frequency: { setTargetAtTime: (value: number) => frequencies.push(value) } },
      gain: { gain: { setTargetAtTime: (value: number) => volumes.push(value) } },
    });
    audio.setActive(true);
    audio.update(70, 0);
    Object.assign(audio, { context: { currentTime: 40 } });
    audio.update(70, 1);
    expect(frequencies.at(-2)).toBe(frequencies.at(-1));
    expect(volumes.at(-1)).toBeGreaterThan(volumes.at(-2)!);
    audio.setMuted(true);
    expect(volumes.at(-1)).toBe(0);
  });
});
