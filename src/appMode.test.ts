import { describe, expect, it } from 'vitest';
import { isWebApp } from './appMode';

describe('installed web-app entry', () => {
  it('blocks ordinary tabs, including a tab in fullscreen', () => {
    expect(isWebApp(() => false, false)).toBe(false);
    expect(isWebApp(query => query === '(display-mode: fullscreen)', false)).toBe(false);
  });
  it('accepts installed Chromium apps and iOS/Safari home-screen apps', () => {
    expect(isWebApp(query => query === '(display-mode: standalone)', false)).toBe(true);
    expect(isWebApp(() => false, true)).toBe(true);
    expect(isWebApp(query => query === '(display-mode: window-controls-overlay)', false)).toBe(true);
  });
});
