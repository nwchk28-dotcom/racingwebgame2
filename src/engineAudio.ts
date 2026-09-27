import { extractEngineLayers } from './engineWaveform';
import { gearAtSpeed, TOP_SPEED_KMH } from './vehicleTuning';

export { gearAtSpeed } from './vehicleTuning';

export function pitchAtSpeed(kmh: number): number {
  const { gear, rev } = gearAtSpeed(kmh);
  return 130 + (gear - 1) * 26 + rev * 75;
}

export function engineLayerWeightsAt(speedKmh: number): [number, number, number] {
  const position = gearAtSpeed(speedKmh).rev * 2;
  return [Math.max(0, 1 - position), 1 - Math.abs(position - 1), Math.max(0, position - 1)];
}

export function engineToneAt(speedKmh: number, throttle: number) {
  const speed = Math.max(0, Math.min(speedKmh / TOP_SPEED_KMH, 1));
  const load = Math.max(0, Math.min(throttle, 1));
  const { rev } = gearAtSpeed(speedKmh);
  return {
    bodyGain: 0.105 + speed * 0.025 + load * 0.035,
    bodyCutoff: 850 + speed * 1400 + rev * 1100 + load * 900,
    rumbleGain: 0.065 + (1 - speed) * 0.03,
    biteGain: 0.014 + speed * 0.025 + rev * 0.025 + load * 0.045,
    noiseGain: 0.006 + speed * 0.012 + load * 0.025 + (1 - load) * speed * 0.008,
    noiseCutoff: 750 + speed * 2100 + load * 1100,
  };
}

// A quiet, non-tonal layer supplies the irregular air/exhaust texture that a
// single periodic wave cannot contain. Fade its ends to avoid loop clicks.
export function createEngineNoise(sampleRate: number): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(new ArrayBuffer(Math.ceil(sampleRate * 3) * Float32Array.BYTES_PER_ELEMENT));
  let seed = 0x2f6e2b1;
  let previous = 0;
  const fadeFrames = Math.max(1, Math.floor(sampleRate * 0.006));
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 0x100000000 * 2 - 1;
    previous = white * 0.8 + previous * 0.2;
    const fade = Math.min(1, i / fadeFrames, (samples.length - 1 - i) / fadeFrames);
    samples[i] = previous * fade;
  }
  return samples;
}

export class EngineAudio {
  private context: AudioContext | null = null;
  private source: OscillatorNode | null = null;
  private layerSources: OscillatorNode[] = [];
  private layerGains: GainNode[] = [];
  private rumbleSource: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private bodyGain: GainNode | null = null;
  private bodyFilter: BiquadFilterNode | null = null;
  private rumbleGain: GainNode | null = null;
  private biteGain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private active = false;
  private muted = false;
  private speed = 0;
  private throttle = 0;
  private lastGear = 1;
  private lastUpshiftAt = -Infinity;
  private loading: Promise<void> | null = null;

  get isMuted(): boolean { return this.muted; }

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.context.destination);
    }
    void this.context.resume().catch(error => console.warn('Engine audio could not resume', error));
    if (!this.loading) this.loading = this.loadRecording();
  }

  private async loadRecording(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/f1-engine.mp3`);
      if (!response.ok) throw new Error(`Engine recording: HTTP ${response.status}`);
      const context = this.context!;
      const recording = await context.decodeAudioData(await response.arrayBuffer());
      const layers = extractEngineLayers(recording.getChannelData(0), recording.sampleRate);
      const waves = layers.map(layer => context.createPeriodicWave(layer.real, layer.imag));

      const bodyFilter = context.createBiquadFilter();
      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.value = 850;
      bodyFilter.Q.value = 0.7;
      const bodyGain = context.createGain();
      bodyGain.gain.value = 0;
      const biteFilter = context.createBiquadFilter();
      biteFilter.type = 'highpass';
      biteFilter.frequency.value = 1100;
      const biteGain = context.createGain();
      biteGain.gain.value = 0;
      const saturator = context.createWaveShaper();
      const curve = new Float32Array(new ArrayBuffer(1024 * Float32Array.BYTES_PER_ELEMENT));
      for (let i = 0; i < curve.length; i++) {
        const x = i / (curve.length - 1) * 2 - 1;
        curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8);
      }
      saturator.curve = curve;
      saturator.oversample = '2x';

      const layerSources = waves.map(wave => {
        const oscillator = context.createOscillator();
        const level = context.createGain();
        oscillator.setPeriodicWave(wave);
        level.gain.value = 0;
        oscillator.connect(level);
        level.connect(saturator);
        this.layerGains.push(level);
        return oscillator;
      });
      saturator.connect(bodyFilter);
      saturator.connect(biteFilter);
      bodyFilter.connect(bodyGain);
      biteFilter.connect(biteGain);
      bodyGain.connect(this.gain!);
      biteGain.connect(this.gain!);

      const rumbleSource = context.createOscillator();
      rumbleSource.setPeriodicWave(waves[0]);
      const rumbleFilter = context.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 580;
      const rumbleGain = context.createGain();
      rumbleGain.gain.value = 0;
      rumbleSource.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(this.gain!);

      const noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 3), context.sampleRate);
      noiseBuffer.copyToChannel(createEngineNoise(context.sampleRate), 0);
      const noiseSource = context.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      const noiseFilter = context.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 750;
      noiseFilter.Q.value = 0.65;
      const noiseGain = context.createGain();
      noiseGain.gain.value = 0;
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.gain!);

      // Small amplitude irregularity makes combustion feel less perfectly
      // periodic, without changing the pitch chosen from speed and gear.
      for (const [frequency, depth] of [[7.1, 0.006], [10.7, 0.003]] as const) {
        const pulse = context.createOscillator();
        pulse.frequency.value = frequency;
        const pulseDepth = context.createGain();
        pulseDepth.gain.value = depth;
        pulse.connect(pulseDepth);
        pulseDepth.connect(bodyGain.gain);
        pulse.start();
      }

      this.source = layerSources[0];
      this.layerSources = layerSources;
      this.rumbleSource = rumbleSource;
      this.bodyFilter = bodyFilter;
      this.bodyGain = bodyGain;
      this.rumbleGain = rumbleGain;
      this.biteGain = biteGain;
      this.noiseFilter = noiseFilter;
      this.noiseGain = noiseGain;
      layerSources.forEach(source => source.start());
      rumbleSource.start();
      noiseSource.start();
      this.lastGear = gearAtSpeed(this.speed).gear;
      this.update(this.speed, this.throttle);
    } catch (error) {
      console.warn('Engine audio could not load', error);
    }
  }

  setActive(active: boolean): void {
    this.active = active;
    this.update(this.speed, this.throttle);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.update(this.speed, this.throttle);
  }

  update(speedKmh: number, throttle: number): void {
    this.speed = speedKmh;
    this.throttle = throttle;
    if (!this.context || !this.gain) return;
    const now = this.context.currentTime;
    const pitch = pitchAtSpeed(speedKmh);
    const gear = gearAtSpeed(speedKmh).gear;
    if (this.active && this.layerSources.length > 0 && gear > this.lastGear && now - this.lastUpshiftAt > 0.18) {
      this.lastUpshiftAt = now;
    }
    this.lastGear = gear;
    const tone = engineToneAt(speedKmh, throttle);
    this.source?.frequency.setTargetAtTime(pitch, now, 0.055);
    for (let i = 1; i < this.layerSources.length; i++) {
      this.layerSources[i].frequency.setTargetAtTime(pitch, now, 0.055);
    }
    const weights = engineLayerWeightsAt(speedKmh);
    this.layerGains.forEach((level, index) => {
      level.gain.setTargetAtTime(weights[index] ?? 0, now, 0.065);
    });
    this.rumbleSource?.frequency.setTargetAtTime(pitch * 0.5, now, 0.055);
    this.bodyGain?.gain.setTargetAtTime(tone.bodyGain, now, 0.06);
    this.bodyFilter?.frequency.setTargetAtTime(tone.bodyCutoff, now, 0.07);
    this.rumbleGain?.gain.setTargetAtTime(tone.rumbleGain, now, 0.07);
    this.biteGain?.gain.setTargetAtTime(tone.biteGain, now, 0.06);
    this.noiseGain?.gain.setTargetAtTime(tone.noiseGain, now, 0.08);
    this.noiseFilter?.frequency.setTargetAtTime(tone.noiseCutoff, now, 0.08);
    const sinceShift = now - this.lastUpshiftAt;
    const shiftCut = sinceShift < 0.09 ? 0.28 + 0.72 * sinceShift / 0.09 : 1;
    this.gain.gain.setTargetAtTime(this.active && !this.muted && this.source ? shiftCut : 0, now, 0.025);
  }
}
