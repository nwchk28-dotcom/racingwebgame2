/** Keep the installed game's host aligned with the visible mobile viewport. */
export function bindGameViewport(app: HTMLElement, resize: () => void, host: Window = window): () => boolean {
  let previous = '';
  let pending = false;
  const sync = (): boolean => {
    const viewport = host.visualViewport;
    const width = viewport?.width ?? host.innerWidth;
    const height = viewport?.height ?? host.innerHeight;
    // Rotation / app restoration can briefly report an empty viewport.
    if (width <= 0 || height <= 0) return false;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const current = `${width},${height},${left},${top}`;
    if (current === previous) return false;
    previous = current;
    app.style.width = `${width}px`;
    app.style.height = `${height}px`;
    app.style.left = `${left}px`;
    app.style.top = `${top}px`;
    return true;
  };
  const schedule = (): void => {
    if (pending) return;
    pending = true;
    host.requestAnimationFrame(() => {
      pending = false;
      sync();
      resize();
    });
  };
  for (const event of ['resize', 'orientationchange', 'pageshow', 'focus']) {
    host.addEventListener(event, schedule);
  }
  host.visualViewport?.addEventListener('resize', schedule);
  host.visualViewport?.addEventListener('scroll', schedule);
  host.document.addEventListener('visibilitychange', () => {
    if (!host.document.hidden) schedule();
  });
  sync();
  return sync;
}
