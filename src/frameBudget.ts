/** Throttle presentation without changing the 120 Hz physics timestep. */
export class FrameBudget {
  private next = 0;
  constructor(readonly fps: number) {}
  reset(): void { this.next = 0; }
  due(now: number): boolean {
    if (now + .1 < this.next) return false;
    const interval = 1000 / this.fps;
    // Keep phase across 60/90/120 Hz displays; recover without catch-up renders.
    this.next = this.next && now - this.next < interval
      ? this.next + interval : now + interval;
    return true;
  }
}
