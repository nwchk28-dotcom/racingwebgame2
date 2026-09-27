import { describe, expect, it } from 'vitest';
import { createEngineNoise, engineLayerWeightsAt, engineToneAt, EngineAudio, gearAtSpeed, pitchAtSpeed } from './engineAudio';

describe('engine gears', () => {
  it('raises revs within each gear and drops them on an upshift', () => {
    expect(gearAtSpeed(0)).toEqual({ gear: 1, rev: 0 });
    expect(gearAtSpeed(49).rev).toBeGreaterThan(gearAtSpeed(10).rev);
    expect(gearAtSpeed(50).gear).toBe(2);
    expect(gearAtSpeed(50).rev).toBe(0);
    expect(gearAtSpeed(81).rev).toBeGreaterThan(gearAtSpeed(60).rev);
    expect(gearAtSpeed(265).gear).toBe(8);
    expect(gearAtSpeed(300).rev).toBe(1);
  });

  it('maps a given speed to one stable pitch, with a drop at each upshift', () => {
    expect(pitchAtSpeed(0)).toBe(130);
    expect(pitchAtSpeed(50)).toBe(156);
    const boundaries = [0, 50, 82, 116, 153, 190, 228, 265, 300];
    for (let gear = 0; gear < boundaries.length - 1; gear++) {
      const low = boundaries[gear];
      const high = boundaries[gear + 1];
      expect(pitchAtSpeed(high - 0.1)).toBeGreaterThan(pitchAtSpeed(low));
      if (gear < boundaries.length - 2) expect(pitchAtSpeed(high)).toBeLessThan(pitchAtSpeed(high - 0.1));
    }
    expect(pitchAtSpeed(200)).toBeGreaterThan(pitchAtSpeed(20));
    expect(pitchAtSpeed(400)).toBe(pitchAtSpeed(300));
  });

  it('keeps pitch unchanged when only throttle or playback time changes', () => {
    const frequencies: number[] = [];
    const volumes: number[] = [];
    const bodyLevels: number[] = [];
    const audio = new EngineAudio();
    Object.assign(audio, {
      context: { currentTime: 10 },
      source: { frequency: { setTargetAtTime: (value: number) => frequencies.push(value) } },
      bodyGain: { gain: { setTargetAtTime: (value: number) => bodyLevels.push(value) } },
      gain: { gain: { setTargetAtTime: (value: number) => volumes.push(value) } },
    });
    audio.setActive(true);
    audio.update(70, 0);
    Object.assign(audio, { context: { currentTime: 40 } });
    audio.update(70, 1);
    expect(frequencies.at(-2)).toBe(frequencies.at(-1));
    expect(bodyLevels.at(-1)).toBeGreaterThan(bodyLevels.at(-2)!);
    expect(volumes.at(-1)).toBe(1);
    audio.setMuted(true);
    expect(volumes.at(-1)).toBe(0);
  });

  it('adds more high-frequency texture under load without changing the speed-derived pitch', () => {
    const coasting = engineToneAt(180, 0);
    const accelerating = engineToneAt(180, 1);
    expect(accelerating.biteGain).toBeGreaterThan(coasting.biteGain);
    expect(accelerating.noiseGain).toBeGreaterThan(coasting.noiseGain);
    expect(accelerating.bodyCutoff).toBeGreaterThan(coasting.bodyCutoff);
    expect(engineToneAt(260, 1).noiseCutoff).toBeGreaterThan(accelerating.noiseCutoff);
  });

  it('crossfades recorded tones across the rev range of each gear', () => {
    expect(engineLayerWeightsAt(0)).toEqual([1, 0, 0]);
    expect(engineLayerWeightsAt(25)).toEqual([0, 1, 0]);
    expect(engineLayerWeightsAt(50)).toEqual([1, 0, 0]);
    expect(engineLayerWeightsAt(49)[2]).toBeGreaterThan(0.9);
    for (const speed of [5, 30, 75, 140, 230, 300]) {
      expect(engineLayerWeightsAt(speed).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
    }
  });

  it('briefly cuts power on an upshift, then returns to full volume', () => {
    const levels: number[] = [];
    const source = { frequency: { setTargetAtTime: () => undefined } };
    const audio = new EngineAudio();
    Object.assign(audio, {
      context: { currentTime: 10 }, source, layerSources: [source],
      gain: { gain: { setTargetAtTime: (value: number) => levels.push(value) } },
    });
    audio.setActive(true);
    audio.update(49, 1);
    Object.assign(audio, { context: { currentTime: 10.1 } });
    audio.update(50, 1);
    expect(levels.at(-1)).toBeLessThan(0.5);
    Object.assign(audio, { context: { currentTime: 10.25 } });
    audio.update(60, 1);
    expect(levels.at(-1)).toBe(1);
  });

  it('makes a non-silent noise bed with a seamless loop boundary', () => {
    const samples = createEngineNoise(8000);
    expect(Math.abs(samples[0])).toBeLessThan(1e-6);
    expect(Math.abs(samples.at(-1)!)).toBeLessThan(1e-6);
    expect(samples.reduce((energy, sample) => energy + sample * sample, 0) / samples.length).toBeGreaterThan(0.05);
  });
});
