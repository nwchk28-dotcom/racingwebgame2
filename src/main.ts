import * as THREE from 'three';
import { CarVisual } from './car';
import { Controls } from './controls';
import { LapTracker, formatTime } from './lap';
import { CarPhysics } from './physics';
import { Track } from './track';
import './style.css';

const STORAGE_KEY = 'apex-one:best-lap:v1';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="scene" aria-hidden="true"></div>
  <div class="cinema-vignette" aria-hidden="true"></div>

  <header class="topbar">
    <div class="brand"><span class="brand-mark">A<span>1</span></span><span class="brand-name">APEX <strong>ONE</strong><small>TIME ATTACK</small></span></div>
    <div class="track-name"><span class="live-dot"></span> NOVA CIRCUIT <span class="track-meta">/ DRY / 23°C</span></div>
    <div class="top-actions">
      <button id="reset-button" class="icon-button" type="button" aria-label="スタート地点に戻る" title="リセット (R)">↻</button>
      <button id="pause-button" class="icon-button" type="button" aria-label="一時停止" title="一時停止 (Esc)">Ⅱ</button>
    </div>
  </header>

  <main id="hud" class="hud" aria-live="off">
    <div class="timing-panel">
      <div class="panel-eyebrow">SESSION 01 <span>•</span> SOLO TIME ATTACK</div>
      <div class="lap-row"><span>LAP <b id="lap-number">01</b></span><span id="lap-state" class="lap-state">VALID LAP</span></div>
      <div id="current-time" class="current-time">00:00.000</div>
      <div class="best-row"><span>PERSONAL BEST</span><strong id="best-time">--:--.---</strong></div>
    </div>
    <div class="speed-panel"><div class="speed-caption">SPEED</div><div class="speed-main"><strong id="speed">000</strong><span>KM/H</span></div><div class="speed-line"><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span></div></div>
    <div class="drive-hint"><span class="hint-label">DRIVE MODE</span><strong>ONBOARD</strong><small>CHASE THE NEXT LAP</small></div>
  </main>

  <div id="touch-controls" class="touch-controls">
    <div class="steer-control"><div class="control-label"><span>STEER</span><span>LEFT <i>—</i> RIGHT</span></div><div id="steering-track" class="steering-track" role="slider" aria-label="ハンドル" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="0"><span class="steer-center"></span><span id="steering-thumb" class="steering-thumb"><span>≡</span></span></div></div>
    <div class="pedals"><button id="brake" class="pedal brake" type="button"><span class="pedal-bars">///</span><strong>BRAKE</strong></button><button id="throttle" class="pedal throttle" type="button"><span class="pedal-bars">///</span><strong>THROTTLE</strong></button></div>
  </div>

  <div id="toast" class="toast" role="status"></div>

  <section id="start-overlay" class="menu-overlay">
    <div class="menu-card">
      <div class="menu-kicker"><span class="kicker-line"></span> ONE CAR. ONE CIRCUIT. ONE LAP.</div>
      <h1>FIND YOUR<br /><em>APEX.</em></h1>
      <p>オンボード視点で、自己ベストを塗り替えよう。</p>
      <div class="menu-details"><span><b>01</b> NOVA CIRCUIT</span><span><b>∞</b> TIME ATTACK</span></div>
      <button id="start-button" class="primary-button" type="button">START ENGINE <span>↗</span></button>
      <div class="menu-help"><span class="desktop-help">W / ↑ 加速　S / ↓ ブレーキ　A D / ← → ハンドル</span><span class="mobile-help">左のスライダーでハンドル、右のペダルで運転</span></div>
    </div>
    <div class="menu-footer"><span>APEX ONE / ORIGINAL RACING EXPERIENCE</span><span>01 — 01</span></div>
  </section>

  <section id="pause-overlay" class="menu-overlay paused" hidden>
    <div class="menu-card pause-card"><div class="menu-kicker"><span class="kicker-line"></span> SESSION PAUSED</div><h2>TAKE A<br /><em>BREATH.</em></h2><p>走行を再開するか、スタート地点からやり直せます。</p><button id="resume-button" class="primary-button" type="button">RESUME <span>↗</span></button><button id="restart-button" class="secondary-button" type="button">RESTART LAP</button></div>
  </section>

  <div id="rotate-overlay" class="rotate-overlay"><div class="rotate-icon">↻</div><strong>横向きでプレイしてください</strong><p>端末を回転すると、コックピットが表示されます。</p></div>
`;

const scene = new THREE.Scene();
const track = new Track(scene);
const car = new CarVisual();
scene.add(car.group);
const physics = new CarPhysics(track);
car.setPose(physics.x, physics.z, physics.yaw);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const mobile = window.matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = !mobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.querySelector('#scene')!.appendChild(renderer.domElement);

const controls = new Controls(app);
const readBest = (): number | null => {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch { return null; }
};
const laps = new LapTracker(track.length, readBest());

const speedElement = app.querySelector<HTMLElement>('#speed')!;
const currentTimeElement = app.querySelector<HTMLElement>('#current-time')!;
const bestTimeElement = app.querySelector<HTMLElement>('#best-time')!;
const lapNumberElement = app.querySelector<HTMLElement>('#lap-number')!;
const lapStateElement = app.querySelector<HTMLElement>('#lap-state')!;
const toastElement = app.querySelector<HTMLElement>('#toast')!;
const pauseOverlay = app.querySelector<HTMLElement>('#pause-overlay')!;
const startOverlay = app.querySelector<HTMLElement>('#start-overlay')!;
let active = false;
let paused = false;
let elapsed = 0;
let lastFrame = 0;
let accumulator = 0;
let toastTimeout = 0;

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  car.camera.aspect = width / height;
  car.camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function toast(message: string, kind = ''): void {
  toastElement.textContent = message;
  toastElement.className = `toast visible ${kind}`;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toastElement.classList.remove('visible'), 2900);
}

function refreshHud(): void {
  speedElement.textContent = String(Math.round(physics.speed * 3.6)).padStart(3, '0');
  currentTimeElement.textContent = formatTime(laps.lapTime);
  bestTimeElement.textContent = formatTime(laps.bestTime);
  lapNumberElement.textContent = String(laps.lapNumber).padStart(2, '0');
  lapStateElement.textContent = laps.valid ? 'VALID LAP' : `INVALID • ${laps.invalidReason}`;
  lapStateElement.classList.toggle('invalid', !laps.valid);
  const speedTicks = app.querySelectorAll<HTMLElement>('.speed-tick');
  const tickCount = Math.min(speedTicks.length, Math.ceil(physics.speed * 3.6 / 38));
  speedTicks.forEach((tick, index) => tick.classList.toggle('active', index < tickCount));
}

function reset(): void {
  controls.clear();
  physics.reset();
  laps.reset(0);
  car.setPose(physics.x, physics.z, physics.yaw);
  refreshHud();
  toast('START LINE に戻りました');
}

function setPaused(value: boolean): void {
  if (!active) return;
  paused = value;
  pauseOverlay.hidden = !value;
  if (value) controls.clear();
  lastFrame = performance.now();
}

function start(): void {
  active = true;
  paused = false;
  startOverlay.hidden = true;
  pauseOverlay.hidden = true;
  app.classList.add('in-game');
  reset();
  lastFrame = performance.now();
}

app.querySelector('#start-button')!.addEventListener('click', start);
app.querySelector('#pause-button')!.addEventListener('click', () => setPaused(!paused));
app.querySelector('#resume-button')!.addEventListener('click', () => setPaused(false));
app.querySelector('#reset-button')!.addEventListener('click', reset);
app.querySelector('#restart-button')!.addEventListener('click', () => { reset(); setPaused(false); });
window.addEventListener('keydown', event => {
  if (event.repeat) return;
  if (event.key === 'Escape') setPaused(!paused);
  if (event.key.toLowerCase() === 'r' && active) reset();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
portrait.addEventListener('change', () => { if (portrait.matches) setPaused(true); });

function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000 || 0, 0.05);
  lastFrame = now;
  if (active && !paused && !portrait.matches) {
    accumulator = Math.min(accumulator + dt, 0.1);
    while (accumulator >= 1 / 120) {
      physics.step(controls.value, 1 / 120);
      const position = track.nearest(physics.x, physics.z);
      if (physics.collided) laps.invalidate('接触');
      const event = laps.update(position.progress, position.distance, physics.speed, 1 / 120);
      if (event) {
        if (event.newBest) {
          try { localStorage.setItem(STORAGE_KEY, String(event.time)); } catch { /* private mode */ }
          toast(`NEW PERSONAL BEST  ${formatTime(event.time)}`, 'best');
        } else if (event.valid) {
          toast(`LAP ${String(event.lapNumber).padStart(2, '0')}  ${formatTime(event.time)}`);
        } else {
          toast('INVALID LAP • 記録されません', 'invalid');
        }
      }
      elapsed += 1 / 120;
      accumulator -= 1 / 120;
    }
    car.setPose(physics.x, physics.z, physics.yaw);
    car.animate(controls.value.steer, physics.speed, elapsed);
    refreshHud();
  }
  renderer.render(scene, car.camera);
}

refreshHud();
renderer.setAnimationLoop(frame);
