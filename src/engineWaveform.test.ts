import { describe, expect, it } from 'vitest';
import { extractEngineHarmonics } from './engineWaveform';

describe('engine waveform extraction', () => {
  it('selects a steady repeating sound from a recording with a noisy lead-in', () => {
    const sampleRate = 8000;
    const audio = new Float32Array(sampleRate);
    let seed = 1;
    for (let i = 0; i < audio.length; i++) {
      if (i < sampleRate * 0.2) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        audio[i] = (seed / 4294967296 - 0.5) * 0.8;
      } else {
        audio[i] = 0.3 * Math.sin(2 * Math.PI * 200 * i / sampleRate)
          + 0.1 * Math.sin(2 * Math.PI * 400 * i / sampleRate);
      }
    }

    const result = extractEngineHarmonics(audio, sampleRate);
    const fundamental = Math.hypot(result.real[1], result.imag[1]);
    const second = Math.hypot(result.real[2], result.imag[2]);
    expect(result.sourcePeriodFrames).toBeCloseTo(40, 0);
    expect(result.correlation).toBeGreaterThan(0.95);
    expect(fundamental).toBeGreaterThan(second);
    expect(result.real.every(Number.isFinite)).toBe(true);
    expect(result.imag.every(Number.isFinite)).toBe(true);
  });
});
