export type Placement = { x: number; y: number; scale: number; opacity: number };
const KEY = 'formula-world:control-layout:v1';
const ids = ['steer-left', 'steer-right', 'steering-track', 'brake', 'throttle'];
type Layout = Record<string, Placement>;
type Size = { width: number; height: number };

/** Use the scaled hit area, including its edges, in both editor and play. */
export function placementStyle(p: Placement, size: Size, width: number, height: number) {
  const scaledWidth = size.width * p.scale, scaledHeight = size.height * p.scale;
  const x = Math.max(scaledWidth / 2 + 8, Math.min(width - scaledWidth / 2 - 8, p.x * width));
  const y = Math.max(scaledHeight / 2 + 55, Math.min(height - scaledHeight / 2 - 8, p.y * height));
  return { position: 'fixed', left: `${x - size.width / 2}px`, top: `${y - size.height / 2}px`,
    width: `${size.width}px`, height: `${size.height}px`, flex: 'none',
    transform: `scale(${p.scale})`, opacity: String(p.opacity), transformOrigin: 'center' };
}

export class ControlLayoutEditor {
  private layout: Layout = {};
  private draft: Layout | null = null;
  private panel: HTMLElement | null = null;
  private selected = '';
  private readonly elements: Record<string, HTMLElement>;
  private readonly controls: HTMLElement;

  constructor(private root: HTMLElement, private clear: () => void) {
    this.controls = root.querySelector('#touch-controls')!;
    this.elements = Object.fromEntries(ids.map(id => [id, root.querySelector<HTMLElement>('#' + id)!]));
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      for (const id of ids) {
        const p = saved?.[id];
        if (p && [p.x, p.y, p.scale, p.opacity].every(Number.isFinite)) this.layout[id] = {
          x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)),
          scale: Math.max(.6, Math.min(1.6, p.scale)), opacity: Math.max(.2, Math.min(1, p.opacity)),
        };
      }
    } catch { /* Storage may be disabled. */ }
    this.refresh();
    window.addEventListener('resize', () => this.refresh());
    for (const id of ['layout-button', 'pause-layout-button']) root.querySelector('#' + id)?.addEventListener('click', () => this.open());
  }

  refresh(): void {
    // Measure natural responsive sizes before fixing any flex child in place.
    // This same pass is used with the exact same DOM in the editor and in play.
    this.root.classList.add('control-layout-measuring');
    for (const el of Object.values(this.elements)) el.removeAttribute('style');
    const sizes = Object.fromEntries(ids.map(id => [id, {
      width: this.elements[id].offsetWidth, height: this.elements[id].offsetHeight,
    }]));
    const bounds = this.root.getBoundingClientRect();
    const layout = this.draft ?? this.layout;
    const defaults = Object.fromEntries(ids.map(id => {
      const rect=this.elements[id].getBoundingClientRect();
      return [id, {x:(rect.left+rect.width/2-bounds.left)/bounds.width,y:(rect.top+rect.height/2-bounds.top)/bounds.height,scale:1,opacity:1}];
    }));
    const custom = ids.some(id => layout[id] && sizes[id].width > 0);
    for (const id of ids) {
      const p = layout[id] ?? (custom ? defaults[id] : undefined), size = sizes[id];
      if (p && size.width > 0 && size.height > 0) {
        Object.assign(this.elements[id].style, placementStyle(p, size, bounds.width, bounds.height));
      }
    }
    this.root.classList.remove('control-layout-measuring');
  }

  private open(): void {
    if (this.panel) return;
    this.clear(); this.draft = structuredClone(this.layout);
    const panel = document.createElement('section');
    panel.className = 'layout-editor'; panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', '操作ボタン配置');
    panel.innerHTML = '<div class="layout-toolbar"><strong>実際のボタンをドラッグして配置</strong><span id="layout-selected"></span><label>大きさ <input id="layout-size" type="range" min="0.6" max="1.6" step="0.05" value="1"></label><label>透明度 <input id="layout-opacity" type="range" min="0.2" max="1" step="0.05" value="1"></label><button id="layout-reset">初期配置</button><button id="layout-cancel">キャンセル</button><button id="layout-save">保存</button><span id="layout-status" role="status"></span></div>';
    const originalNext = this.controls.nextSibling;
    this.panel = panel; this.root.append(panel);
    this.root.classList.add('control-layout-active');
    panel.append(this.controls);
    this.refresh();
    const size = panel.querySelector<HTMLInputElement>('#layout-size')!;
    const opacity = panel.querySelector<HTMLInputElement>('#layout-opacity')!;
    const select = (id: string) => {
      this.selected = id;
      const p = this.draft![id];
      size.value = String(p?.scale ?? 1); opacity.value = String(p?.opacity ?? 1);
      panel.querySelector('#layout-selected')!.textContent = this.elements[id].getAttribute('aria-label') ?? id;
    };
    const ensure = (id: string): Placement => {
      if (!this.draft![id]) {
        const rect = this.elements[id].getBoundingClientRect(), bounds = this.root.getBoundingClientRect();
        this.draft![id] = { x: (rect.left + rect.width / 2 - bounds.left) / bounds.width,
          y: (rect.top + rect.height / 2 - bounds.top) / bounds.height, scale: 1, opacity: 1 };
      }
      return this.draft![id];
    };
    let drag: { id: string; pointer: number; dx: number; dy: number } | null = null;
    panel.addEventListener('pointerdown', event => {
      const target = (event.target as Element).closest<HTMLElement>(ids.map(id => '#' + id).join(','));
      if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const rect = target.getBoundingClientRect();
      ensure(target.id); select(target.id);
      drag = { id: target.id, pointer: event.pointerId,
        dx: event.clientX - rect.left - rect.width / 2, dy: event.clientY - rect.top - rect.height / 2 };
      try { target.setPointerCapture(event.pointerId); } catch { /* Release is also handled on the panel. */ }
    }, true);
    panel.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointer) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const p = ensure(drag.id), bounds = this.root.getBoundingClientRect();
      p.x = (event.clientX - drag.dx - bounds.left) / bounds.width;
      p.y = (event.clientY - drag.dy - bounds.top) / bounds.height;
      this.refresh();
    }, true);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) panel.addEventListener(name, event => {
      if (drag && (event as PointerEvent).pointerId === drag.pointer) {
        event.stopImmediatePropagation(); drag = null;
      }
    }, true);
    // Prevent driving input handlers from receiving editor touches.
    for (const name of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'click']) panel.addEventListener(name, event => {
      if (this.controls.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, { capture: true, passive: false });
    const update = () => {
      const p = ensure(this.selected); p.scale = Number(size.value); p.opacity = Number(opacity.value); this.refresh();
    };
    size.oninput = opacity.oninput = update;
    const close = () => {
      this.controls.parentElement?.removeChild(this.controls);
      this.root.insertBefore(this.controls, originalNext?.parentNode === this.root ? originalNext : null);
      this.root.classList.remove('control-layout-active');
      this.draft = null; this.panel = null; panel.remove(); this.clear(); this.refresh();
      document.removeEventListener('keydown', keydown, true);
    };
    const keydown = (event: KeyboardEvent) => {
      // Pause/reset shortcuts must not resume the game underneath this dialog.
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      else if (!(event.target instanceof HTMLInputElement)) event.stopPropagation();
    };
    document.addEventListener('keydown', keydown, true);
    panel.querySelector('#layout-cancel')!.addEventListener('click', close);
    panel.querySelector('#layout-reset')!.addEventListener('click', () => { this.draft = {}; this.refresh(); select(this.selected); });
    panel.querySelector('#layout-save')!.addEventListener('click', () => {
      this.layout = structuredClone(this.draft!);
      try { localStorage.setItem(KEY, JSON.stringify(this.layout)); close(); }
      catch { panel.querySelector('#layout-status')!.textContent = '端末に保存できません。配置はこのセッションに適用されます。'; }
    });
    select(this.root.classList.contains('button-steering') ? 'steer-left' : 'steering-track');
    panel.querySelector<HTMLButtonElement>('#layout-save')!.focus();
  }
}
