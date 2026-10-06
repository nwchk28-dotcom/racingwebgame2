import type { LapEvent, LapTracker } from './lap';

/** Presentation only: the next lap keeps being timed during the result display. */
export class LapHud {
  private finish: LapEvent | null = null;
  private until = 0;

  completed(event: LapEvent, now: number): void {
    this.finish = { ...event, sectors: [...event.sectors], sectorDeltas: [...event.sectorDeltas] };
    this.until = now + 3000;
  }

  reset(): void { this.finish = null; this.until = 0; }

  view(laps: LapTracker, now: number) {
    if (this.finish && now >= this.until) this.reset();
    const finish = this.finish;
    return {
      lapNumber: finish?.lapNumber ?? laps.lapNumber,
      time: finish?.time ?? laps.lapTime,
      valid: finish?.valid ?? laps.valid,
      invalidReason: finish?.invalidReason ?? laps.invalidReason,
      gap: finish ? finish.gap : laps.gap,
      sectors: [0, 1, 2].map(index => {
        const active = !finish && laps.started && laps.currentSector === index + 1;
        return {
          time: finish ? finish.sectors[index] : laps.sectorTimes[index] ?? (active ? laps.currentSectorTime : null),
          delta: finish ? finish.sectorDeltas[index] : laps.sectorDeltas[index],
          active, previous: Boolean(finish),
        };
      }),
    };
  }
}
