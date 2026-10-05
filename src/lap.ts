export type SectorTimes = [number, number, number];
export interface BestLapRecord {
  time: number;
  sectors: SectorTimes;
  /** Ordered elapsed times along the lap, used for a position-matched delta. */
  trace: [number, number][];
}
export interface LapEvent {
  time: number;
  valid: boolean;
  newBest: boolean;
  lapNumber: number;
  sectors: SectorTimes;
  record: BestLapRecord;
}

export class LapTracker {
  lapNumber = 1;
  lapTime = 0;
  bestTime: number | null;
  bestRecord: BestLapRecord | null;
  valid = true;
  invalidReason = '';
  started = false;
  sectorTimes: (number | null)[] = [null, null, null];
  sectorDeltas: (number | null)[] = [null, null, null];
  lastSectorTimes: SectorTimes | null = null;
  lastSectorDeltas: (number | null)[] = [null, null, null];
  gap: number | null = null;
  private reference: BestLapRecord | null;
  private previousProgress = 0;
  private totalProgress = 0;
  private nextGate = .25;
  private reverseDistance = 0;
  private sectorStartTime = 0;
  private sectorIndex = 0;
  private trace: [number, number][] = [[0, 0]];

  constructor(private readonly trackLength: number, bestTime: number | null = null,
    readonly boundaries: readonly [number, number] = [1 / 3, 2 / 3],
    record: BestLapRecord | null = null) {
    if (!(boundaries[0] > 0 && boundaries[0] < boundaries[1] && boundaries[1] < 1)) {
      throw new Error('Sector boundaries must be ordered inside a lap');
    }
    this.bestTime = bestTime;
    this.bestRecord = this.reference = record;
  }

  get currentSector(): number { return this.sectorIndex + 1; }
  get currentSectorTime(): number { return this.lapTime - this.sectorStartTime; }

  reset(progress = 0): void {
    this.lapNumber = 1;
    this.lapTime = 0;
    this.valid = true;
    this.invalidReason = '';
    this.started = false;
    this.previousProgress = progress;
    this.totalProgress = 0;
    this.nextGate = .25;
    this.reverseDistance = 0;
    this.reference = this.bestRecord;
    this.sectorTimes = [null, null, null];
    this.sectorDeltas = [null, null, null];
    this.lastSectorTimes = null;
    this.lastSectorDeltas = [null, null, null];
    this.sectorStartTime = this.sectorIndex = 0;
    this.trace = [[0, 0]];
    this.gap = null;
  }

  update(progress: number, allWheelsOffTrack: boolean, speed: number, dt: number): LapEvent | null {
    if (!this.started) {
      if (speed < .5) { this.previousProgress = progress; return null; }
      this.started = true;
    }
    const beforeTime = this.lapTime;
    const beforeProgress = this.totalProgress;
    this.lapTime += dt;
    if (allWheelsOffTrack) this.invalidate('コースアウト');
    let delta = progress - this.previousProgress;
    if (delta < -.5) delta += 1;
    if (delta > .5) delta -= 1;
    this.previousProgress = progress;
    if (Math.abs(delta) * this.trackLength > Math.max(15, speed * dt * 4 + 6)) this.invalidate('経路逸脱');
    if (delta < -.0002 && speed > 2) {
      this.reverseDistance += -delta * this.trackLength;
      if (this.reverseDistance > 8) this.invalidate('逆走');
    }
    this.totalProgress += delta;
    const lapOrigin = this.lapNumber - 1;
    const localProgress = this.totalProgress - lapOrigin;
    const crossingTime = (gate: number) => beforeTime + dt * Math.max(0, Math.min(1,
      delta > 0 ? (gate - beforeProgress) / delta : 1));

    // A sector gate is latched exactly once, even if the driver reverses over it.
    while (this.sectorIndex < 2 && this.totalProgress >= lapOrigin + this.boundaries[this.sectorIndex]) {
      const time = crossingTime(lapOrigin + this.boundaries[this.sectorIndex]);
      this.captureSector(time);
    }
    if (localProgress > this.trace.at(-1)![0] + .002 && localProgress < 1) {
      this.trace.push([localProgress, this.lapTime]);
    }
    this.gap = this.valid && this.reference
      ? this.lapTime - timeAtProgress(this.reference.trace, Math.max(0, Math.min(1, localProgress))) : null;

    let finished = false;
    while (this.totalProgress >= this.nextGate) {
      const gate = this.nextGate;
      this.nextGate += .25;
      if (Math.round(gate * 4) % 4 === 0) { finished = true; break; }
    }
    if (!finished) return null;
    const time = crossingTime(lapOrigin + 1);
    this.captureSector(time);
    const sectors = this.sectorTimes as SectorTimes;
    this.trace.push([1, time]);
    const record: BestLapRecord = { time, sectors: [...sectors], trace: this.trace };
    const event: LapEvent = {
      time, valid: this.valid,
      newBest: this.valid && (this.bestTime === null || time < this.bestTime),
      lapNumber: this.lapNumber, sectors: [...sectors], record,
    };
    this.lastSectorTimes = [...sectors];
    this.lastSectorDeltas = [...this.sectorDeltas];
    if (event.newBest) { this.bestTime = time; this.bestRecord = record; }
    this.reference = this.bestRecord;
    this.lapNumber++;
    this.lapTime -= time; // carry the part of the frame after the finish
    this.valid = true;
    this.invalidReason = '';
    this.reverseDistance = 0;
    this.sectorIndex = this.sectorStartTime = 0;
    this.sectorTimes = [null, null, null];
    this.sectorDeltas = [null, null, null];
    this.trace = [[0, 0]];
    return event;
  }

  private captureSector(cumulativeTime: number): void {
    const index = this.sectorIndex;
    const time = cumulativeTime - this.sectorStartTime;
    this.sectorTimes[index] = time;
    this.sectorDeltas[index] = this.valid && this.reference ? time - this.reference.sectors[index] : null;
    this.sectorStartTime = cumulativeTime;
    this.sectorIndex++;
  }

  invalidate(reason: string): void {
    if (!this.valid) return;
    this.valid = false;
    this.invalidReason = reason;
    this.gap = null;
    this.sectorDeltas = [null, null, null];
  }
}

export function timeAtProgress(trace: readonly (readonly [number, number])[], progress: number): number {
  let low = 0;
  let high = trace.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (trace[middle][0] <= progress) low = middle;
    else high = middle;
  }
  const [a, ta] = trace[low];
  const [b, tb] = trace[high];
  return ta + (tb - ta) * Math.max(0, Math.min(1, (progress - a) / Math.max(b - a, 1e-9)));
}
export function formatGap(seconds: number | null): string {
  return seconds === null ? '—' : `${seconds < 0 ? '−' : '+'}${Math.abs(seconds).toFixed(3)}`;
}
export function formatTime(seconds: number | null): string {
  if (seconds === null) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(3).padStart(6, '0')}`;
}
