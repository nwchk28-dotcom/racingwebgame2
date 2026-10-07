import type { DriverInput } from './physics';

type Action = 'slider' | 'left' | 'right' | 'throttle' | 'brake';

export class Controls {
  private steeringMode: 'slider' | 'buttons' = 'buttons';
  private keys = new Set<string>();
  private pointers = new Map<number, Action>();
  private touchPointers = new Set<number>();
  private touches = new Map<number, Action>();
  private pointerTouches = new Map<number, number>();
  private touchSteer = 0;
  private elements: Record<Action, HTMLElement>;
  private steeringThumb: HTMLElement;

  constructor(root: HTMLElement) {
    this.elements = {
      slider: root.querySelector('#steering-track')!, left: root.querySelector('#steer-left')!,
      right: root.querySelector('#steer-right')!, throttle: root.querySelector('#throttle')!,
      brake: root.querySelector('#brake')!,
    };
    this.steeringThumb = root.querySelector('#steering-thumb')!;
    for (const [action, element] of Object.entries(this.elements) as [Action, HTMLElement][]) {
      element.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        // Commit input before capture: capture can throw on Safari/cancelled pointers.
        this.pointers.set(event.pointerId, action);
        if (event.pointerType === 'touch') this.touchPointers.add(event.pointerId);
        if (action === 'slider') this.updateSteering(event.clientX);
        this.refreshPressed();
        try { element.setPointerCapture(event.pointerId); } catch { /* Document release is the fallback. */ }
      });
      element.addEventListener('lostpointercapture', event => this.releasePointer(event.pointerId));
      // Touch Events also cover browsers which omit/cancel a touch Pointer Event.
      // Keep the two sources separate so one cannot cancel the other prematurely.
      element.addEventListener('touchstart', event => {
        this.reconcileTouches(event.touches);
        for (const touch of Array.from(event.changedTouches)) {
          this.touches.set(touch.identifier, action);
          const pointer = [...this.pointers.keys()].reverse().find(id =>
            this.touchPointers.has(id) && this.pointers.get(id) === action && !this.pointerTouches.has(id));
          if (pointer !== undefined) this.pointerTouches.set(pointer, touch.identifier);
          if (action === 'slider') this.updateSteering(touch.clientX);
        }
        this.refreshPressed();
        if (event.cancelable) event.preventDefault();
      }, { passive: false });
    }
    document.addEventListener('pointermove', event => {
      if (this.pointers.get(event.pointerId) === 'slider') this.updateSteering(event.clientX);
    });
    for (const type of ['pointerup', 'pointercancel'] as const) {
      // Releases must work even outside the original button or without capture.
      document.addEventListener(type, event => this.releasePointer(event.pointerId));
    }
    document.addEventListener('touchmove', event => {
      for (const touch of Array.from(event.changedTouches)) {
        if (this.touches.get(touch.identifier) !== 'slider') continue;
        this.updateSteering(touch.clientX);
        if (event.cancelable) event.preventDefault();
      }
    }, { passive: false });
    for (const type of ['touchend', 'touchcancel'] as const) {
      document.addEventListener(type, event => {
        for (const touch of Array.from(event.changedTouches)) this.touches.delete(touch.identifier);
        this.reconcileTouches(event.touches);
        if (event.touches.length === 0) {
          for (const id of this.touchPointers) this.pointers.delete(id);
          this.touchPointers.clear();
        }
        this.refreshPressed();
      });
    }
    window.addEventListener('keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
      this.keys.add(event.key.toLowerCase());
    });
    window.addEventListener('keyup', event => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => this.clear());
  }

  private held(action: Action): boolean {
    for (const held of this.pointers.values()) if (held === action) return true;
    for (const held of this.touches.values()) if (held === action) return true;
    return false;
  }

  get value(): DriverInput {
    const left = this.keys.has('a') || this.keys.has('arrowleft');
    const right = this.keys.has('d') || this.keys.has('arrowright');
    const buttonLeft = this.held('left'), buttonRight = this.held('right');
    return {
      steer: this.steeringMode === 'buttons'
        ? buttonLeft || buttonRight ? Number(buttonRight) - Number(buttonLeft) : Number(right) - Number(left)
        : this.held('slider') ? this.touchSteer : Number(right) - Number(left),
      throttle: Number(this.held('throttle') || this.keys.has('w') || this.keys.has('arrowup')),
      brake: Number(this.held('brake') || this.keys.has('s') || this.keys.has('arrowdown')),
    };
  }

  setSteeringMode(mode: 'slider' | 'buttons'): void { this.clear(); this.steeringMode = mode; }

  clear(): void {
    this.keys.clear(); this.pointers.clear(); this.touchPointers.clear(); this.touches.clear(); this.pointerTouches.clear();
    this.refreshPressed();
  }

  private releasePointer(id: number): void {
    this.pointers.delete(id); this.touchPointers.delete(id); this.pointerTouches.delete(id); this.refreshPressed();
  }

  private reconcileTouches(touches: TouchList): void {
    const active = new Set(Array.from(touches, touch => touch.identifier));
    for (const id of this.touches.keys()) if (!active.has(id)) this.touches.delete(id);
    for (const [pointer, touch] of this.pointerTouches) {
      if (active.has(touch)) continue;
      this.pointers.delete(pointer); this.touchPointers.delete(pointer); this.pointerTouches.delete(pointer);
    }
  }

  private updateSteering(clientX: number): void {
    const rect = this.elements.slider.getBoundingClientRect();
    this.touchSteer = Math.max(-1, Math.min(1, ((clientX - rect.left) / Math.max(1, rect.width) - .5) * 2));
    this.steeringThumb.style.left = `${(this.touchSteer + 1) * 50}%`;
    this.elements.slider.setAttribute('aria-valuenow', this.touchSteer.toFixed(2));
  }

  private refreshPressed(): void {
    for (const action of ['left', 'right', 'throttle', 'brake'] as const) {
      if (this.held(action)) this.elements[action].classList.add('pressed');
      else this.elements[action].classList.remove('pressed');
    }
    if (!this.held('slider')) {
      this.touchSteer = 0; this.steeringThumb.style.left = '50%';
      this.elements.slider.setAttribute('aria-valuenow', '0');
    }
  }
}
