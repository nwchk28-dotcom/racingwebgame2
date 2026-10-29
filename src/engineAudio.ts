import { extractEngineLayers } from './engineWaveform';
import { gearAtSpeed, TOP_SPEED_KMH, GEAR_END_SPEEDS } from './vehicleTuning';

export { gearAtSpeed } from './vehicleTuning';

export function pitchAtSpeed(kmh: number): number {
  const { gear, rev } = gearAtSpeed(kmh);
  return 220 + (gear - 1) * 44 + rev * 130;
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
    bodyGain: 0.09 + speed * 0.02 + load * 0.03,
    bodyCutoff: 1600 + speed * 2200 + rev * 1600 + load * 1300,
    rumbleGain: 0.028 + (1 - speed) * 0.02,
    biteGain: 0.025 + speed * 0.035 + rev * 0.03 + load * 0.055,
    noiseGain: 0.012 + speed * 0.018 + load * 0.035 + (1 - load) * speed * 0.008,
    noiseCutoff: 1400 + speed * 2800 + load * 1500,
    combustionRate: 45 + rev * 85 + speed * 40,
    pitchScatter: 9 + rev * 6 + load * 13,
    amplitudeScatter: 0.012 + load * 0.022,
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
  private combustionFilter: BiquadFilterNode | null = null;
  private pitchScatter: GainNode | null = null;
  private amplitudeScatter: GainNode | null = null;
  private active = false;
  private muted = false;
  private speed = 0;
  private throttle = 0;
  private lastShiftAt = -Infinity;
  private audioGear = 1;
  private loading: Promise<void> | null = null;
  private changingState = false;
  private retryResumeAt = 0;

  get isMuted(): boolean { return this.muted; }

  unlock(): void {
    this.retryResumeAt = 0;
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'balanced' });
      this.context.addEventListener('statechange', () => this.syncContextState());
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.context.destination);
    }
    this.syncContextState();
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
        curve[i] = Math.tanh(x * 2.8) / Math.tanh(2.8);
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

      // Filtered random modulation breaks the repeating waveform into uneven
      // combustion pulses. Shared detuning preserves phase during layer blends.
      const combustionFilter = context.createBiquadFilter();
      combustionFilter.type = 'lowpass';
      combustionFilter.frequency.value = 45;
      combustionFilter.Q.value = 0.5;
      noiseSource.connect(combustionFilter);
      const pitchScatter = context.createGain();
      pitchScatter.gain.value = 9;
      combustionFilter.connect(pitchScatter);
      layerSources.forEach(source => pitchScatter.connect(source.detune));
      pitchScatter.connect(rumbleSource.detune);
      const amplitudeScatter = context.createGain();
      amplitudeScatter.gain.value = 0.012;
      combustionFilter.connect(amplitudeScatter);
      amplitudeScatter.connect(bodyGain.gain);
      amplitudeScatter.connect(biteGain.gain);
      this.combustionFilter = combustionFilter;
      this.pitchScatter = pitchScatter;
      this.amplitudeScatter = amplitudeScatter;

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
      this.audioGear = gearAtSpeed(this.speed).gear;
      this.update(this.speed, this.throttle);
    } catch (error) {
      console.warn('Engine audio could not load', error);
    }
  }

  // Muting a gain alone leaves every oscillator/filter processing audio.
  // Suspend the whole graph while idle, and reconcile fast pause/resume taps.
  private syncContextState(): void {
    const context = this.context;
    if (!context || this.changingState || context.state === 'closed') return;
    const running = this.active && !this.muted;
    if (running && performance.now() < this.retryResumeAt) return;
    const operation = running ? context.resume : context.suspend;
    if (typeof operation !== 'function' || context.state === (running ? 'running' : 'suspended')) return;
    this.changingState = true;
    void operation.call(context).then(() => {
      this.changingState = false;
      if (context.state === 'running') this.update(this.speed, this.throttle);
      else if (running) this.retryResumeAt = performance.now() + 1000;
      // Reconcile only if the requested state changed while awaiting the browser.
      if (running !== (this.active && !this.muted)) this.syncContextState();
    }).catch(error => {
      this.changingState = false;
      this.retryResumeAt = performance.now() + 1000;
      console.warn('Engine audio state could not change', error);
    });
  }

  setActive(active: boolean): void {
    this.active = active;
    this.update(this.speed, this.throttle);
    this.syncContextState();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.update(this.speed, this.throttle);
    this.syncContextState();
  }

  update(speedKmh: number, throttle: number): void {
    this.speed = speedKmh;
    this.throttle = throttle;
    if (!this.context || !this.gain) return;
    if (this.context.state === 'suspended' || (this.context.state as string) === 'interrupted') {
      if (this.active && !this.muted) this.syncContextState();
      return;
    }
    const now = this.context.currentTime;
    const gear = gearAtSpeed(speedKmh).gear;
    // Hold the audible gear through boundary jitter. Switch pitch and the
    // volume envelope together, including on downshifts.
    const previousGear = this.audioGear;
    const downshift = gear < previousGear && speedKmh < GEAR_END_SPEEDS[gear - 1] - 3;
    const upshift = gear > previousGear;
    if (upshift || downshift) this.audioGear = gear;
    const shifted = this.audioGear !== previousGear && this.active && this.layerSources.length > 0;
    if (shifted) this.lastShiftAt = now;
    const low = this.audioGear === 1 ? 0 : GEAR_END_SPEEDS[this.audioGear - 2];
    const high = GEAR_END_SPEEDS[this.audioGear - 1];
    const rev = Math.max(0, Math.min(1, (speedKmh - low) / (high - low)));
    const pitch = 220 + (this.audioGear - 1) * 44 + rev * 130;
    // Settle the new note while silent, rather than gliding between gears.
    const pitchResponse = now - this.lastShiftAt < 0.05 ? 0.004 : 0.055;
    const tone = engineToneAt(speedKmh, throttle);
    this.source?.frequency.setTargetAtTime(pitch, now, pitchResponse);
    for (let i = 1; i < this.layerSources.length; i++) {
      this.layerSources[i].frequency.setTargetAtTime(pitch, now, pitchResponse);
    }
    const weights = engineLayerWeightsAt(speedKmh);
    this.layerGains.forEach((level, index) => {
      level.gain.setTargetAtTime(weights[index] ?? 0, now, 0.065);
    });
    this.rumbleSource?.frequency.setTargetAtTime(pitch * 0.5, now, pitchResponse);
    this.bodyGain?.gain.setTargetAtTime(tone.bodyGain, now, 0.06);
    this.bodyFilter?.frequency.setTargetAtTime(tone.bodyCutoff, now, 0.07);
    this.rumbleGain?.gain.setTargetAtTime(tone.rumbleGain, now, 0.07);
    this.biteGain?.gain.setTargetAtTime(tone.biteGain, now, 0.06);
    this.noiseGain?.gain.setTargetAtTime(tone.noiseGain, now, 0.08);
    this.noiseFilter?.frequency.setTargetAtTime(tone.noiseCutoff, now, 0.08);
    this.combustionFilter?.frequency.setTargetAtTime(tone.combustionRate, now, 0.08);
    this.pitchScatter?.gain.setTargetAtTime(tone.pitchScatter, now, 0.08);
    this.amplitudeScatter?.gain.setTargetAtTime(tone.amplitudeScatter, now, 0.08);
    const sinceShift = now - this.lastShiftAt;
    const shiftCut = sinceShift < 0.025 ? 0 : Math.min(1, (sinceShift - 0.025) / 0.025);
    const master = this.gain.gain;
    const audible = this.active && !this.muted && Boolean(this.source);
    if (!audible) {
      master.cancelScheduledValues?.(now);
      master.setTargetAtTime(0, now, .025);
    } else if (typeof master.linearRampToValueAtTime === 'function') {
      if (shifted) {
        // Recover on the audio clock even when WebGL stalls during the shift.
        master.cancelScheduledValues(now);
        master.setValueAtTime(master.value, now);
        master.linearRampToValueAtTime(0, now + .005);
        master.setValueAtTime(0, now + .025);
        master.linearRampToValueAtTime(1, now + .05);
      } else if (sinceShift >= .05) master.setTargetAtTime(1, now, .025);
    } else master.setTargetAtTime(shiftCut, now, .025);
  }
}
