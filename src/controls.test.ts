import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controls } from './controls';

class FakeElement extends EventTarget {
  style = { left: '' };
  classList = { add: vi.fn(), remove: vi.fn() };
  attributes = new Map<string, string>();

  getBoundingClientRect(): DOMRect {
    return { left: 0, width: 100 } as DOMRect;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

function touchEvent(type: string, identifier: number, clientX: number, activeTouches: number): Event {
  const event = new Event(type, { cancelable: true });
  const touch = { identifier, clientX };
  Object.defineProperties(event, {
    changedTouches: { value: [touch] },
    touches: { value: Array.from({ length: activeTouches }, () => touch) },
  });
  return event;
}

afterEach(() => vi.unstubAllGlobals());

describe('mobile controls', () => {
  it('keeps steering and throttle active with two separate fingers', () => {
    const elements = new Map([
      ['#steering-track', new FakeElement()],
      ['#steering-thumb', new FakeElement()],
      ['#steer-left', new FakeElement()],
      ['#steer-right', new FakeElement()],
      ['#throttle', new FakeElement()],
      ['#brake', new FakeElement()],
    ]);
    const fakeDocument = new EventTarget();
    const querySelector = (selector: string) => elements.get(selector) ?? null;
    Object.assign(fakeDocument, { querySelector });
    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('window', new EventTarget());
    const controls = new Controls({ querySelector } as unknown as HTMLElement);
    controls.setSteeringMode('slider');

    elements.get('#steering-track')!.dispatchEvent(touchEvent('touchstart', 1, 90, 1));
    elements.get('#throttle')!.dispatchEvent(touchEvent('touchstart', 2, 50, 2));
    expect(controls.value.steer).toBeCloseTo(0.8);
    expect(controls.value.throttle).toBe(1);

    fakeDocument.dispatchEvent(touchEvent('touchmove', 1, 10, 2));
    expect(controls.value.steer).toBeCloseTo(-0.8);
    expect(controls.value.throttle).toBe(1);

    fakeDocument.dispatchEvent(touchEvent('touchend', 1, 10, 1));
    expect(controls.value.steer).toBe(0);
    expect(controls.value.throttle).toBe(1);
    fakeDocument.dispatchEvent(touchEvent('touchend', 2, 50, 0));
    expect(controls.value.throttle).toBe(0);
  });

  it('supports button steering with independent steering and pedal fingers', () => {
    const elements = new Map([
      ['#steering-track', new FakeElement()],
      ['#steering-thumb', new FakeElement()],
      ['#steer-left', new FakeElement()],
      ['#steer-right', new FakeElement()],
      ['#throttle', new FakeElement()],
      ['#brake', new FakeElement()],
    ]);
    const fakeDocument = new EventTarget();
    const querySelector = (selector: string) => elements.get(selector) ?? null;
    Object.assign(fakeDocument, { querySelector });
    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('window', new EventTarget());
    const controls = new Controls({ querySelector } as unknown as HTMLElement);
    expect(controls.value).toEqual({ steer: 0, throttle: 0, brake: 0 });

    elements.get('#steer-right')!.dispatchEvent(touchEvent('touchstart', 1, 50, 1));
    elements.get('#throttle')!.dispatchEvent(touchEvent('touchstart', 2, 50, 2));
    expect(controls.value).toEqual({ steer: 1, throttle: 1, brake: 0 });
    elements.get('#steer-left')!.dispatchEvent(touchEvent('touchstart', 3, 50, 3));
    expect(controls.value.steer).toBe(0);
    fakeDocument.dispatchEvent(touchEvent('touchend', 1, 50, 2));
    expect(controls.value).toEqual({ steer: -1, throttle: 1, brake: 0 });
    controls.setSteeringMode('slider');
    expect(controls.value).toEqual({ steer: 0, throttle: 0, brake: 0 });
  });
});
