import { describe, expect, it, vi } from 'vitest';
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


describe('idle engine power use', () => {
  it('suspends the audio graph on mute and pause, then restores it on resume', async () => {
    const context = {
      state: 'running', currentTime: 10,
      resume: vi.fn(async () => { context.state = 'running'; }),
      suspend: vi.fn(async () => { context.state = 'suspended'; }),
    };
    const frequency = vi.fn();
    const gain = vi.fn();
    const audio = new EngineAudio();
    Object.assign(audio, { context, source: { frequency: { setTargetAtTime: frequency } },
      gain: { gain: { setTargetAtTime: gain } } });
    audio.setActive(true);
    audio.setMuted(true);
    await Promise.resolve();
    expect(context.suspend).toHaveBeenCalledTimes(1);
    frequency.mockClear();
    audio.update(150, 1);
    expect(frequency).not.toHaveBeenCalled();
    audio.setMuted(false);
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(frequency).toHaveBeenLastCalledWith(pitchAtSpeed(150), 10, .055);
    expect(gain).toHaveBeenLastCalledWith(1, 10, .025);
    audio.setActive(false);
    await Promise.resolve();
    expect(context.suspend).toHaveBeenCalledTimes(2);
    audio.setMuted(true);
    audio.setMuted(false);
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('reconciles rapid pause/resume changes while suspension is pending', async () => {
    let complete: () => void = () => undefined;
    const context = {
      state: 'running', currentTime: 0,
      suspend: vi.fn(() => new Promise<void>(resolve => {
        complete = () => { context.state = 'suspended'; resolve(); };
      })),
      resume: vi.fn(async () => { context.state = 'running'; }),
    };
    const audio = new EngineAudio();
    Object.assign(audio, { context });
    audio.setActive(false);
    audio.setActive(true);
    audio.setActive(true);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    complete();
    await Promise.resolve();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe('running');
  });
});

describe('audio continuity', () => {
  it('recovers an interrupted audio context while driving', async () => {
    const context = { state: 'interrupted', currentTime: 10,
      resume: vi.fn(async () => { context.state = 'running'; }) };
    const audio = new EngineAudio();
    const frequency = vi.fn();
    Object.assign(audio, { context, active: true,
      source: { frequency: { setTargetAtTime: frequency } },
      gain: { gain: { setTargetAtTime: vi.fn() } } });
    audio.update(150, 1);
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(frequency).toHaveBeenLastCalledWith(pitchAtSpeed(150), 10, .055);
  });
  it('restores shift volume on the audio clock and does not retrigger at a jittering gear boundary', () => {
    const context = { currentTime: 10 };
    const master = { value: 1, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
    const source = { frequency: { setTargetAtTime: vi.fn() } };
    const audio = new EngineAudio();
    Object.assign(audio, { context, source, layerSources: [source], gain: { gain: master } });
    audio.setActive(true);
    audio.update(49, 1);
    context.currentTime = 10.1;
    audio.update(50, 1);
    expect(master.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 10.19);
    expect(master.linearRampToValueAtTime).toHaveBeenCalledTimes(2);
    for (const [time, speed] of [[10.4, 49.8], [10.5, 50.2], [10.7, 49.9], [10.8, 50.1]]) {
      context.currentTime = time; audio.update(speed, 1);
    }
    expect(master.linearRampToValueAtTime).toHaveBeenCalledTimes(2);
    audio.setMuted(true);
    expect(master.cancelScheduledValues).toHaveBeenLastCalledWith(10.8);
    expect(master.setTargetAtTime).toHaveBeenLastCalledWith(0, 10.8, .025);
  });
});
