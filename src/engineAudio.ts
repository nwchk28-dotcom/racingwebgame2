const GEAR_END_SPEEDS = [32, 58, 86, 115, 142, 166, 185, 215] as const;

export function gearAtSpeed(kmh: number): { gear: number; rev: number } {
  const speed = Math.max(0, kmh);
  const index = GEAR_END_SPEEDS.findIndex(limit => speed < limit);
  const gearIndex = index < 0 ? GEAR_END_SPEEDS.length - 1 : index;
  const low = gearIndex === 0 ? 0 : GEAR_END_SPEEDS[gearIndex - 1];
  const high = GEAR_END_SPEEDS[gearIndex];
  return { gear: gearIndex + 1, rev: Math.min(1, (speed - low) / (high - low)) };
}

// Pick a sustained loud interval, rather than the quiet lead-in or the car fading away.
// Crossfade its ends so the real recording loops without a click.
function makeEngineLoop(context: AudioContext, recording: AudioBuffer): AudioBuffer {
  const sampleRate = recording.sampleRate;
  const windowLength = Math.min(Math.floor(sampleRate * 5), recording.length);
  const step = Math.floor(sampleRate * 0.5);
  const channel = recording.getChannelData(0);
  let bestStart = 0;
  let bestScore = -Infinity;
  for (let start = 0; start + windowLength <= recording.length; start += step) {
    let energy = 0;
    for (let i = start; i < start + windowLength; i += 64) energy += channel[i] * channel[i];
    if (energy > bestScore) {
      bestScore = energy;
      bestStart = start;
    }
  }
  const fade = Math.min(Math.floor(sampleRate * 0.15), Math.floor(windowLength / 8));
  const loopLength = windowLength - fade;
  const loop = context.createBuffer(recording.numberOfChannels, loopLength, sampleRate);
  for (let c = 0; c < recording.numberOfChannels; c++) {
    const input = recording.getChannelData(c);
    const output = loop.getChannelData(c);
    for (let i = 0; i < loopLength; i++) {
      const source = input[bestStart + fade + i];
      if (i < loopLength - fade) output[i] = source;
      else {
        const t = (i - (loopLength - fade)) / fade;
        output[i] = source * (1 - t) + input[bestStart + i - (loopLength - fade)] * t;
      }
    }
  }
  return loop;
}

export class EngineAudio {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
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
      this.source = context.createBufferSource();
      this.source.buffer = makeEngineLoop(context, recording);
      this.source.loop = true;
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
    const { rev } = gearAtSpeed(speedKmh);
    this.source?.playbackRate.setTargetAtTime(0.72 + rev * 0.66, now, 0.055);
    const volume = this.active && !this.muted && this.source
      ? 0.1 + Math.min(speedKmh / 225, 1) * 0.12 + throttle * 0.08
      : 0;
    this.gain.gain.setTargetAtTime(volume, now, 0.045);
  }
}
