export interface LapEvent {
  time: number;
  valid: boolean;
  newBest: boolean;
  lapNumber: number;
}

export class LapTracker {
  lapNumber = 1;
  lapTime = 0;
  bestTime: number | null;
  valid = true;
  invalidReason = '';
  started = false;
  private previousProgress = 0;
  private totalProgress = 0;
  private nextGate = 0.25;
  private reverseDistance = 0;

  constructor(private readonly trackLength: number, bestTime: number | null = null) {
    this.bestTime = bestTime;
  }

  reset(progress = 0): void {
    this.lapNumber = 1;
    this.lapTime = 0;
    this.valid = true;
    this.invalidReason = '';
    this.started = false;
    this.previousProgress = progress;
    this.totalProgress = 0;
    this.nextGate = 0.25;
    this.reverseDistance = 0;
  }

  update(progress: number, allWheelsOffTrack: boolean, speed: number, dt: number): LapEvent | null {
    if (!this.started) {
      if (speed < 0.5) {
        this.previousProgress = progress;
        return null;
      }
      this.started = true;
    }

    this.lapTime += dt;
    if (allWheelsOffTrack) this.invalidate('コースアウト');

    let delta = progress - this.previousProgress;
    if (delta < -0.5) delta += 1;
    if (delta > 0.5) delta -= 1;
    this.previousProgress = progress;

    if (delta < -0.0002 && speed > 2) {
      this.reverseDistance += -delta * this.trackLength;
      if (this.reverseDistance > 8) this.invalidate('逆走');
    }
    this.totalProgress += delta;

    if (this.totalProgress < this.nextGate) return null;
    // Gates at 1/4, 1/2, 3/4 and the finish line must be crossed in order.
    const crossedGate = this.nextGate;
    this.nextGate += 0.25;
    if (Math.round(crossedGate * 4) % 4 !== 0) return null;

    const event: LapEvent = {
      time: this.lapTime,
      valid: this.valid,
      newBest: this.valid && (this.bestTime === null || this.lapTime < this.bestTime),
      lapNumber: this.lapNumber,
    };
    if (event.newBest) this.bestTime = event.time;
    this.lapNumber++;
    this.lapTime = 0;
    this.valid = true;
    this.invalidReason = '';
    this.reverseDistance = 0;
    return event;
  }

  invalidate(reason: string): void {
    if (!this.valid) return;
    this.valid = false;
    this.invalidReason = reason;
  }
}

export function formatTime(seconds: number | null): string {
  if (seconds === null) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(3).padStart(6, '0')}`;
}
