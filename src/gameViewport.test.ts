import { describe, expect, it, vi } from 'vitest';
import { bindGameViewport } from './gameViewport';

function fixture(visual = true) {
  const viewport = Object.assign(new EventTarget(), {
    width: 844, height: 390, offsetLeft: 0, offsetTop: 0,
  });
  const callbacks: FrameRequestCallback[] = [];
  const document = Object.assign(new EventTarget(), { hidden: false });
  const host = Object.assign(new EventTarget(), {
    innerWidth: 390, innerHeight: 844, // Stale layout dimensions after rotation.
    visualViewport: visual ? viewport : null,
    document,
    requestAnimationFrame: (callback: FrameRequestCallback) => callbacks.push(callback),
  });
  const app = { style: { width: '', height: '', left: '', top: '' } };
  const resize = vi.fn();
  const sync = bindGameViewport(app as HTMLElement, resize, host as unknown as Window);
  const flush = () => callbacks.splice(0).forEach(callback => callback(0));
  return { app, viewport, host, resize, sync, flush, document };
}

describe('game viewport recovery', () => {
  it('uses the visible landscape size even while the layout retains portrait dimensions', () => {
    const { app } = fixture();
    expect(app.style).toEqual({ width: '844px', height: '390px', left: '0px', top: '0px' });
  });
  it('keeps HUD and canvas aligned when the visual viewport scrolls without resizing', () => {
    const { app, viewport, resize, flush } = fixture();
    viewport.offsetTop = 42;
    viewport.dispatchEvent(new Event('scroll'));
    flush();
    expect(app.style.top).toBe('42px');
    expect(resize).toHaveBeenCalledOnce();
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('scroll'));
    flush();
    expect(app.style.top).toBe('0px');
  });
  it('recovers dimensions after page restoration and coalesces rotation events', () => {
    const { app, viewport, host, resize, flush } = fixture();
    host.dispatchEvent(new Event('pageshow'));
    host.dispatchEvent(new Event('orientationchange'));
    viewport.height = 430; // Settles after the event, before the next frame.
    flush();
    expect(app.style.height).toBe('430px');
    expect(resize).toHaveBeenCalledOnce();
  });
  it('detects late changes without an event and ignores transient zero dimensions', () => {
    const { app, viewport, sync } = fixture();
    viewport.height = 0;
    expect(sync()).toBe(false);
    expect(app.style.height).toBe('390px');
    viewport.height = 430;
    expect(sync()).toBe(true);
    expect(app.style.height).toBe('430px');
    expect(sync()).toBe(false);
  });
  it('refreshes on foreground restoration and supports hosts without VisualViewport', () => {
    const { app, host, document, flush, resize } = fixture(false);
    host.innerWidth = 844;
    host.innerHeight = 390;
    document.dispatchEvent(new Event('visibilitychange'));
    flush();
    expect(app.style.width).toBe('844px');
    expect(app.style.height).toBe('390px');
    expect(resize).toHaveBeenCalledOnce();
  });
});
