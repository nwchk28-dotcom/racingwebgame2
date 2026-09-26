import { extractEngineHarmonics } from './engineWaveform';
import { gearAtSpeed, TOP_SPEED_KMH } from './vehicleTuning';

export { gearAtSpeed } from './vehicleTuning';

export function pitchAtSpeed(kmh: number): number {
  const { gear, rev } = gearAtSpeed(kmh);
  return 130 + (gear - 1) * 26 + rev * 75;
}

export class EngineAudio {
  private context: AudioContext | null = null;
  private source: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private active = false;
  private muted = false;
  private speed = 0;
  private throttle = 0;
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
      const harmonics = extractEngineHarmonics(recording.getChannelData(0), recording.sampleRate);
      this.source = context.createOscillator();
      this.source.setPeriodicWave(context.createPeriodicWave(harmonics.real, harmonics.imag));
      this.source.connect(this.gain!);
      this.source.start();
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
    this.source?.frequency.setTargetAtTime(pitchAtSpeed(speedKmh), now, 0.055);
    const volume = this.active && !this.muted && this.source
      ? 0.1 + Math.min(speedKmh / TOP_SPEED_KMH, 1) * 0.12 + throttle * 0.08
      : 0;
    this.gain.gain.setTargetAtTime(volume, now, 0.045);
  }
}
