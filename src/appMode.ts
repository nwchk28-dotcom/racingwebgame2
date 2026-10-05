/** Home-screen launch on iOS, installed PWA on Chromium/Safari desktop. */
export function isWebApp(
  matches: (query: string) => boolean = query => window.matchMedia(query).matches,
  iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true,
): boolean {
  return iosStandalone || matches('(display-mode: standalone)') ||
    matches('(display-mode: window-controls-overlay)');
}
