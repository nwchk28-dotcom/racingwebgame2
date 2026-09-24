import type { DriverInput } from './physics';

export class Controls {
  private keys = new Set<string>();
  private touchSteer = 0;
  private touchThrottle = false;
  private touchBrake = false;
  private steeringPointer: number | null = null;
  private throttlePointer: number | null = null;
  private brakePointer: number | null = null;
  private steeringTouch: number | null = null;
  private throttleTouch: number | null = null;
  private brakeTouch: number | null = null;
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
    this.bindTouchControls(throttle, brake);
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
      steer: this.steeringPointer !== null || this.steeringTouch !== null
        ? this.touchSteer : Number(right) - Number(left),
      throttle: Number(this.touchThrottle || this.keys.has('w') || this.keys.has('arrowup')),
      brake: Number(this.touchBrake || this.keys.has('s') || this.keys.has('arrowdown')),
    };
  }

  clear(): void {
    this.keys.clear();
    this.touchSteer = 0;
    this.touchThrottle = this.touchBrake = false;
    this.steeringPointer = this.throttlePointer = this.brakePointer = null;
    this.steeringTouch = this.throttleTouch = this.brakeTouch = null;
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
      if (event.pointerType === 'touch') return;
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
      if (event.pointerType === 'touch') return;
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

  private bindTouchControls(throttle: HTMLElement, brake: HTMLElement): void {
    const updateSteering = (clientX: number) => {
      const rect = this.steeringTrack.getBoundingClientRect();
      const fraction = (clientX - rect.left) / rect.width;
      this.touchSteer = Math.max(-1, Math.min(1, (fraction - 0.5) * 2));
      this.steeringThumb.style.left = `${(this.touchSteer + 1) * 50}%`;
      this.steeringTrack.setAttribute('aria-valuenow', this.touchSteer.toFixed(2));
    };
    this.steeringTrack.addEventListener('touchstart', event => {
      if (this.steeringTouch !== null) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      this.steeringTouch = touch.identifier;
      updateSteering(touch.clientX);
      if (event.cancelable) event.preventDefault();
    }, { passive: false });

    const bindTouchPedal = (element: HTMLElement, kind: 'throttle' | 'brake') => {
      element.addEventListener('touchstart', event => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        if (kind === 'throttle') {
          if (this.throttleTouch !== null) return;
          this.throttleTouch = touch.identifier;
          this.touchThrottle = true;
        } else {
          if (this.brakeTouch !== null) return;
          this.brakeTouch = touch.identifier;
          this.touchBrake = true;
        }
        element.classList.add('pressed');
        if (event.cancelable) event.preventDefault();
      }, { passive: false });
    };
    bindTouchPedal(throttle, 'throttle');
    bindTouchPedal(brake, 'brake');

    document.addEventListener('touchmove', event => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier !== this.steeringTouch) continue;
        updateSteering(touch.clientX);
        if (event.cancelable) event.preventDefault();
      }
    }, { passive: false });

    const release = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === this.steeringTouch) {
          this.steeringTouch = null;
          this.touchSteer = 0;
          this.steeringThumb.style.left = '50%';
          this.steeringTrack.setAttribute('aria-valuenow', '0');
        }
        if (touch.identifier === this.throttleTouch) {
          this.throttleTouch = null;
          this.touchThrottle = false;
          throttle.classList.remove('pressed');
        }
        if (touch.identifier === this.brakeTouch) {
          this.brakeTouch = null;
          this.touchBrake = false;
          brake.classList.remove('pressed');
        }
      }
    };
    document.addEventListener('touchend', release);
    document.addEventListener('touchcancel', release);
  }
}
