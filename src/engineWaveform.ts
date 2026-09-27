export interface EngineHarmonics {
  real: Float32Array;
  imag: Float32Array;
  sourcePeriodFrames: number;
  sourceFrequency: number;
  sourceStartSeconds: number;
  correlation: number;
}

interface Candidate {
  start: number;
  lag: number;
  correlation: number;
  score: number;
}

const TABLE_SIZE = 256;
const HARMONIC_COUNT = 32;

function findCandidates(samples: Float32Array, sampleRate: number): Candidate[] {
  const minLag = Math.max(2, Math.floor(sampleRate / 800));
  const maxLag = Math.floor(sampleRate / 90);
  const windowFrames = Math.max(2048, Math.floor(sampleRate * 0.12));
  if (samples.length < windowFrames + maxLag) throw new Error('Engine recording is too short');

  const stride = Math.max(1, Math.floor(sampleRate * 0.4));
  const probeFrames = Math.min(2048, windowFrames - maxLag);
  const candidates: Candidate[] = [];
  for (let start = 0; start + windowFrames + maxLag <= samples.length; start += stride) {
    let energy = 0;
    for (let i = 0; i < probeFrames; i += 8) energy += samples[start + i] ** 2;
    const rms = Math.sqrt(energy / Math.ceil(probeFrames / 8));
    if (rms < 0.012) continue;

    let best: Candidate | null = null;
    for (let lag = minLag; lag <= maxLag; lag++) {
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
      if (!best || score > best.score) best = { start, lag, correlation, score };
    }
    if (best) candidates.push(best);
  }
  if (candidates.length === 0) throw new Error('No audible engine section found');
  return candidates;
}

function extractAt(samples: Float32Array, sampleRate: number, candidate: Candidate): EngineHarmonics {
  const { start, lag, correlation } = candidate;
  const windowFrames = Math.max(2048, Math.floor(sampleRate * 0.12));
  const cycleCount = Math.min(3, Math.floor(windowFrames / lag));
  const table = new Float32Array(TABLE_SIZE);
  for (let cycle = 0; cycle < cycleCount; cycle++) {
    for (let i = 0; i < TABLE_SIZE; i++) {
      const position = start + cycle * lag + i * lag / TABLE_SIZE;
      const index = Math.floor(position);
      const fraction = position - index;
      table[i] += (samples[index] * (1 - fraction) + samples[index + 1] * fraction) / cycleCount;
    }
  }

  // A drifting phase can cancel an average. One captured cycle is still
  // fixed-pitch and retains more of the original recording's rough timbre.
  let peak = Math.max(...table.map(Math.abs));
  if (peak < 0.002) {
    for (let i = 0; i < TABLE_SIZE; i++) {
      const position = start + i * lag / TABLE_SIZE;
      const index = Math.floor(position);
      const fraction = position - index;
      table[i] = samples[index] * (1 - fraction) + samples[index + 1] * fraction;
    }
    peak = Math.max(...table.map(Math.abs));
  }
  if (peak < 0.002) throw new Error('No usable engine waveform found');

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

  // Start all layers at the same fundamental phase so blending recordings
  // does not make the fundamental disappear through cancellation.
  const phase = Math.atan2(imag[1], real[1]);
  for (let harmonic = 1; harmonic <= HARMONIC_COUNT; harmonic++) {
    const cosine = Math.cos(harmonic * phase);
    const sine = Math.sin(harmonic * phase);
    const a = real[harmonic];
    const b = imag[harmonic];
    real[harmonic] = a * cosine + b * sine;
    imag[harmonic] = b * cosine - a * sine;
  }
  return { real, imag, sourcePeriodFrames: lag, sourceFrequency: sampleRate / lag, sourceStartSeconds: start / sampleRate, correlation };
}

function spectralBrightness(layer: EngineHarmonics): number {
  let total = 0;
  let weighted = 0;
  for (let harmonic = 1; harmonic < layer.real.length; harmonic++) {
    const magnitude = Math.hypot(layer.real[harmonic], layer.imag[harmonic]);
    total += magnitude;
    weighted += magnitude * harmonic;
  }
  return weighted / (total || 1);
}

// A trackside pass can offer only one clean RPM. Take three stable moments
// across the audible pass, then order their timbres from mellow to bright.
export function extractEngineLayers(samples: Float32Array, sampleRate: number): EngineHarmonics[] {
  const candidates = findCandidates(samples, sampleRate);
  const best = [...candidates].sort((a, b) => b.score - a.score)[0];
  const broad = candidates.filter(candidate => candidate.score >= Math.max(0.15, best.score * 0.26));
  if (broad.length === 0) throw new Error('No stable engine section found');
  const bestFrequency = sampleRate / best.lag;
  const nearby = broad.filter(candidate => {
    const ratio = (sampleRate / candidate.lag) / bestFrequency;
    return ratio >= 0.75 && ratio <= 1.3;
  });
  const broadSpan = broad.at(-1)!.start - broad[0].start;
  const nearbySpan = nearby.length > 1 ? nearby.at(-1)!.start - nearby[0].start : 0;
  // Favor different moments of the same engine pass over false subharmonics.
  // A recording that genuinely covers a wide RPM range still uses that range.
  const viable = nearby.length >= 3 && nearbySpan >= broadSpan * 0.5 ? nearby : broad;
  viable.sort((a, b) => a.start - b.start);
  const layers = [0, 1, 2].map(part => {
    const from = Math.floor(part * viable.length / 3);
    const to = Math.max(from + 1, Math.floor((part + 1) * viable.length / 3));
    const best = viable.slice(from, to).sort((a, b) => b.score - a.score)[0];
    return extractAt(samples, sampleRate, best);
  });
  return layers.sort((a, b) => spectralBrightness(a) - spectralBrightness(b) || a.sourceFrequency - b.sourceFrequency);
}

// Retained for callers that only need one stable periodic waveform.
export function extractEngineHarmonics(samples: Float32Array, sampleRate: number): EngineHarmonics {
  const best = findCandidates(samples, sampleRate).sort((a, b) => b.score - a.score)[0];
  return extractAt(samples, sampleRate, best);
}
