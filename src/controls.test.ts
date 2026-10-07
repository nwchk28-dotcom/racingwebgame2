import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const activeTouchesById = new Map<number, { identifier: number; clientX: number }>();
beforeEach(() => activeTouchesById.clear());

function touchEvent(type: string, identifier: number, clientX: number, activeTouches: number): Event {
  const event = new Event(type, { cancelable: true });
  const touch = { identifier, clientX };
  if (type === 'touchend' || type === 'touchcancel') activeTouchesById.delete(identifier);
  else activeTouchesById.set(identifier, touch);
  Object.defineProperties(event, {
    changedTouches: { value: [touch] },
    touches: { value: activeTouches === 0 ? [] : [...activeTouchesById.values()] },
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


function setupControls() {
  const elements = new Map(['#steering-track', '#steering-thumb', '#steer-left', '#steer-right', '#throttle', '#brake']
    .map(id => [id, new FakeElement()]));
  const doc = new EventTarget();
  const win = new EventTarget();
  const querySelector = (id: string) => elements.get(id) ?? null;
  vi.stubGlobal('document', Object.assign(doc, { querySelector }));
  vi.stubGlobal('window', win);
  return { controls: new Controls({ querySelector } as unknown as HTMLElement), elements, doc, win };
}
function pointer(type: string, id: number, pointerType = 'touch') {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: id, pointerType, clientX: 80, button: 0 });
  return event;
}
describe('touch input recovery', () => {
  it('accepts touch pointers immediately even if capture throws, and releases outside the button', () => {
    const { controls, elements, doc } = setupControls();
    Object.assign(elements.get('#steer-left')!, { setPointerCapture: () => { throw Error('capture failed'); } });
    elements.get('#steer-left')!.dispatchEvent(pointer('pointerdown', 1));
    elements.get('#throttle')!.dispatchEvent(pointer('pointerdown', 2));
    expect(controls.value).toEqual({ steer: -1, throttle: 1, brake: 0 });
    doc.dispatchEvent(pointer('pointerup', 1));
    expect(controls.value).toEqual({ steer: 0, throttle: 1, brake: 0 });
    doc.dispatchEvent(pointer('pointercancel', 2));
    expect(controls.value.throttle).toBe(0);
  });
  it('retains touch backup after lost capture and never leaves a stuck input after release', () => {
    const { controls, elements, doc } = setupControls();
    const button = elements.get('#steer-right')!;
    button.dispatchEvent(pointer('pointerdown', 10));
    button.dispatchEvent(touchEvent('touchstart', 20, 50, 1));
    button.dispatchEvent(pointer('lostpointercapture', 10));
    expect(controls.value.steer).toBe(1);
    doc.dispatchEvent(touchEvent('touchend', 20, 50, 0));
    expect(controls.value.steer).toBe(0);
  });
  it('allows another finger on a held button and survives rapid release/repress', () => {
    const { controls, elements, doc } = setupControls();
    const button = elements.get('#throttle')!;
    button.dispatchEvent(pointer('pointerdown', 1));
    button.dispatchEvent(pointer('pointerdown', 2));
    doc.dispatchEvent(pointer('pointerup', 1));
    expect(controls.value.throttle).toBe(1);
    doc.dispatchEvent(pointer('pointerup', 2));
    for (let id = 3; id < 30; id++) {
      button.dispatchEvent(pointer('pointerdown', id));
      expect(controls.value.throttle).toBe(1);
      doc.dispatchEvent(pointer('pointerup', id));
      expect(controls.value.throttle).toBe(0);
    }
  });
  it('recovers when a touch release was omitted and clears controls on focus loss', () => {
    const { controls, elements, win } = setupControls();
    elements.get('#steer-left')!.dispatchEvent(touchEvent('touchstart', 1, 50, 1));
    activeTouchesById.delete(1); // Simulate a browser which omitted touchend.
    elements.get('#steer-right')!.dispatchEvent(touchEvent('touchstart', 2, 50, 1));
    expect(controls.value.steer).toBe(1);
    win.dispatchEvent(new Event('blur'));
    expect(controls.value).toEqual({ steer: 0, throttle: 0, brake: 0 });
  });
});

describe('mixed touch/pointer event cleanup', () => {
  it('removes a stale pointer from touchend while another pedal stays held', () => {
    const { controls, elements, doc } = setupControls();
    elements.get('#steer-left')!.dispatchEvent(pointer('pointerdown', 10));
    elements.get('#steer-left')!.dispatchEvent(touchEvent('touchstart', 1, 50, 1));
    elements.get('#throttle')!.dispatchEvent(pointer('pointerdown', 20));
    elements.get('#throttle')!.dispatchEvent(touchEvent('touchstart', 2, 50, 2));
    // Simulate omitted pointerup, but a delivered touchend.
    doc.dispatchEvent(touchEvent('touchend', 1, 50, 1));
    expect(controls.value).toEqual({ steer: 0, throttle: 1, brake: 0 });
    doc.dispatchEvent(touchEvent('touchend', 2, 50, 0));
    expect(controls.value).toEqual({ steer: 0, throttle: 0, brake: 0 });
  });
  it('recovers a touch slider after its pointer stream is cancelled', () => {
    const { controls, elements, doc } = setupControls();
    controls.setSteeringMode('slider');
    elements.get('#steering-track')!.dispatchEvent(pointer('pointerdown', 10));
    elements.get('#steering-track')!.dispatchEvent(touchEvent('touchstart', 1, 90, 1));
    doc.dispatchEvent(pointer('pointercancel', 10));
    expect(controls.value.steer).toBeCloseTo(.8);
    doc.dispatchEvent(touchEvent('touchmove', 1, 20, 1));
    expect(controls.value.steer).toBeCloseTo(-.6);
    doc.dispatchEvent(touchEvent('touchcancel', 1, 20, 0));
    expect(controls.value.steer).toBe(0);
  });
});
