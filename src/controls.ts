import type { DriverInput } from './physics';

export class Controls {
  private keys = new Set<string>();
  private touchSteer = 0;
  private touchThrottle = false;
  private touchBrake = false;
  private steeringPointer: number | null = null;
  private throttlePointer: number | null = null;
  private brakePointer: number | null = null;
  private steeringTrack: HTMLElement;
  private steeringThumb: HTMLElement;

  constructor(root: HTMLElement) {
    this.steeringTrack = root.querySelector<HTMLElement>('#steering-track')!;
    this.steeringThumb = root.querySelector<HTMLElement>('#steering-thumb')!;
    const throttle = root.querySelector<HTMLElement>('#throttle')!;
    const brake = root.querySelector<HTMLElement>('#brake')!;
    this.bindSteering();
    this.bindPedal(throttle, 'throttle');
    this.bindPedal(brake, 'brake');
    window.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
      this.keys.add(event.key.toLowerCase());
    });
    window.addEventListener('keyup', event => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => this.clear());
  }

  get value(): DriverInput {
    const left = this.keys.has('a') || this.keys.has('arrowleft');
    const right = this.keys.has('d') || this.keys.has('arrowright');
    return {
      steer: this.steeringPointer !== null ? this.touchSteer : Number(right) - Number(left),
      throttle: Number(this.touchThrottle || this.keys.has('w') || this.keys.has('arrowup')),
      brake: Number(this.touchBrake || this.keys.has('s') || this.keys.has('arrowdown')),
    };
  }

  clear(): void {
    this.keys.clear();
    this.touchSteer = 0;
    this.touchThrottle = this.touchBrake = false;
    this.steeringPointer = this.throttlePointer = this.brakePointer = null;
    this.steeringThumb.style.left = '50%';
    document.querySelector('#throttle')?.classList.remove('pressed');
    document.querySelector('#brake')?.classList.remove('pressed');
  }

  private bindSteering(): void {
    const update = (event: PointerEvent) => {
      const rect = this.steeringTrack.getBoundingClientRect();
      const fraction = (event.clientX - rect.left) / rect.width;
      this.touchSteer = Math.max(-1, Math.min(1, (fraction - 0.5) * 2));
      this.steeringThumb.style.left = `${(this.touchSteer + 1) * 50}%`;
    };
    this.steeringTrack.addEventListener('pointerdown', event => {
      if (this.steeringPointer !== null) return;
      event.preventDefault();
      this.steeringPointer = event.pointerId;
      this.steeringTrack.setPointerCapture(event.pointerId);
      update(event);
    });
    this.steeringTrack.addEventListener('pointermove', event => {
      if (event.pointerId === this.steeringPointer) update(event);
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.steeringPointer) return;
      this.steeringPointer = null;
      this.touchSteer = 0;
      this.steeringThumb.style.left = '50%';
    };
    this.steeringTrack.addEventListener('pointerup', release);
    this.steeringTrack.addEventListener('pointercancel', release);
    this.steeringTrack.addEventListener('lostpointercapture', release);
  }

  private bindPedal(element: HTMLElement, kind: 'throttle' | 'brake'): void {
    element.addEventListener('pointerdown', event => {
      event.preventDefault();
      const pointer = kind === 'throttle' ? this.throttlePointer : this.brakePointer;
      if (pointer !== null) return;
      element.setPointerCapture(event.pointerId);
      if (kind === 'throttle') {
        this.throttlePointer = event.pointerId;
        this.touchThrottle = true;
      } else {
        this.brakePointer = event.pointerId;
        this.touchBrake = true;
      }
      element.classList.add('pressed');
    });
    const release = (event: PointerEvent) => {
      const pointer = kind === 'throttle' ? this.throttlePointer : this.brakePointer;
      if (event.pointerId !== pointer) return;
      if (kind === 'throttle') {
        this.throttlePointer = null;
        this.touchThrottle = false;
      } else {
        this.brakePointer = null;
        this.touchBrake = false;
      }
      element.classList.remove('pressed');
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }
}
