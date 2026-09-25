export interface EngineHarmonics {
  real: Float32Array;
  imag: Float32Array;
  sourcePeriodFrames: number;
  correlation: number;
}

const TABLE_SIZE = 256;
const HARMONIC_COUNT = 32;

// Find a short, loud, repetitive part of the recording. The result is one
// averaged engine cycle; playback never advances through the original clip.
export function extractEngineHarmonics(samples: Float32Array, sampleRate: number): EngineHarmonics {
  const minLag = Math.max(2, Math.floor(sampleRate / 800));
  const maxLag = Math.floor(sampleRate / 90);
  const windowFrames = Math.max(2048, Math.floor(sampleRate * 0.12));
  if (samples.length < windowFrames + maxLag) throw new Error('Engine recording is too short');

  const stride = Math.max(1, Math.floor(sampleRate * 0.4));
  const probeFrames = Math.min(2048, windowFrames - maxLag);
  let bestScore = -Infinity;
  let bestStart = 0;
  let bestLag = minLag;
  let bestCorrelation = 0;

  for (let start = 0; start + windowFrames + maxLag <= samples.length; start += stride) {
    let energy = 0;
    for (let i = 0; i < probeFrames; i += 8) energy += samples[start + i] ** 2;
    const rms = Math.sqrt(energy / Math.ceil(probeFrames / 8));
    if (rms < 0.012) continue;

    for (let lag = minLag; lag <= maxLag; lag += 2) {
      let dot = 0;
      let shiftedEnergy = 0;
      for (let i = 0; i < probeFrames; i += 8) {
        const a = samples[start + i];
        const b = samples[start + i + lag];
        dot += a * b;
        shiftedEnergy += b * b;
      }
      const correlation = dot / Math.sqrt(energy * shiftedEnergy || 1);
      const score = correlation * Math.min(1, rms / 0.1) - 0.015 * lag / maxLag;
      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
        bestLag = lag;
        bestCorrelation = correlation;
      }
    }
  }
  if (bestScore === -Infinity) throw new Error('No audible engine section found');

  const cycleCount = Math.min(6, Math.floor(windowFrames / bestLag));
  const table = new Float32Array(TABLE_SIZE);
  for (let cycle = 0; cycle < cycleCount; cycle++) {
    for (let i = 0; i < TABLE_SIZE; i++) {
      const position = bestStart + cycle * bestLag + i * bestLag / TABLE_SIZE;
      const index = Math.floor(position);
      const fraction = position - index;
      table[i] += (samples[index] * (1 - fraction) + samples[index + 1] * fraction) / cycleCount;
    }
  }

  // A drifting phase can cancel the average. One captured cycle is still a
  // fixed waveform, so it is a safe fallback for a less periodic recording.
  let peak = Math.max(...table.map(Math.abs));
  if (peak < 0.002) {
    for (let i = 0; i < TABLE_SIZE; i++) {
      const position = bestStart + i * bestLag / TABLE_SIZE;
      const index = Math.floor(position);
      const fraction = position - index;
      table[i] = samples[index] * (1 - fraction) + samples[index + 1] * fraction;
    }
    peak = Math.max(...table.map(Math.abs));
  }
  if (peak < 0.002) throw new Error('No usable engine waveform found');

  // Keep the source timbre, but use a band-limited periodic wave so every
  // cycle and every repeat at a given frequency has the same pitch.
  const real = new Float32Array(HARMONIC_COUNT + 1);
  const imag = new Float32Array(HARMONIC_COUNT + 1);
  for (let harmonic = 1; harmonic <= HARMONIC_COUNT; harmonic++) {
    for (let i = 0; i < TABLE_SIZE; i++) {
      const angle = 2 * Math.PI * harmonic * i / TABLE_SIZE;
      real[harmonic] += table[i] * Math.cos(angle);
      imag[harmonic] += table[i] * Math.sin(angle);
    }
    real[harmonic] *= 2 / TABLE_SIZE;
    imag[harmonic] *= 2 / TABLE_SIZE;
  }
  return { real, imag, sourcePeriodFrames: bestLag, correlation: bestCorrelation };
}
