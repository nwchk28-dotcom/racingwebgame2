/** Throttle presentation without changing the 120 Hz physics timestep. */
export class FrameBudget {
  private next = 0;
  constructor(readonly fps: number) {}
  reset(): void { this.next = 0; }
  due(now: number): boolean {
    const interval = 1000 / this.fps;
    // RAF timestamps jitter slightly: do not discard a whole 60 Hz frame
    // just because its callback arrived one or two milliseconds early.
    if (now + interval * .15 < this.next) return false;
    // Keep phase across 60/90/120 Hz displays; recover without catch-up renders.
    this.next = this.next && now - this.next < interval
      ? this.next + interval : now + interval;
    return true;
  }
}
