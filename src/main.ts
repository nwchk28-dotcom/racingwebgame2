import * as THREE from 'three';
import { CarVisual } from './car';
import { readBestTime, saveBestTime } from './bestTimes';
import { Controls } from './controls';
import { EngineAudio, gearAtSpeed } from './engineAudio';
import { LapTracker, formatTime } from './lap';
import { CarPhysics } from './physics';
import { Track } from './track';
import { TRACKS, type TrackDefinition, type TrackId } from './trackData';
import { TrackPath } from './trackPath';
import './style.css';

function coursePreview(definition: TrackDefinition): { outline: string; length: number } {
  const path = new TrackPath(definition);
  const xs = path.samples.map(point => point.x);
  const zs = path.samples.map(point => point.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const scale = Math.min(138 / (Math.max(...xs) - minX), 68 / (Math.max(...zs) - minZ));
  const step = Math.max(1, Math.floor(path.sampleCount / 100));
  const points: string[] = [];
  for (let i = 0; i < path.sampleCount; i += step) {
    const point = path.samples[i];
    points.push(`${(11 + (point.x - minX) * scale).toFixed(1)},${(76 - (point.z - minZ) * scale).toFixed(1)}`);
  }
  return {
    outline: `<svg viewBox="0 0 160 86" aria-hidden="true"><polyline points="${points.join(' ')}" /></svg>`,
    length: path.length,
  };
}

const trackCards = TRACKS.map((definition, index) => {
  const preview = coursePreview(definition);
  return `
  <button class="track-option${index === 0 ? ' selected' : ''}" type="button"
    data-track-id="${definition.id}" aria-pressed="${index === 0}">
    <span class="track-option-top"><b>0${index + 1}</b><span>${definition.location}</span></span>
    ${preview.outline}
    <strong>${definition.name}</strong>
    <span class="track-option-bottom"><span>${(preview.length / 1000).toFixed(definition.targetLength ? 3 : 2)} KM</span>
      <span>BEST <b data-best-for="${definition.id}">--:--.---</b></span></span>
  </button>`;
}).join('');

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="scene" aria-hidden="true"></div>
  <div class="cinema-vignette" aria-hidden="true"></div>

  <header class="topbar">
    <div class="brand"><span class="brand-mark">A<span>1</span></span><span class="brand-name">APEX <strong>ONE</strong><small>TIME ATTACK</small></span></div>
    <div class="track-name"><span class="live-dot"></span> <span id="current-track-name">NOVA CIRCUIT</span> <span class="track-meta">/ DRY / 23°C</span></div>
    <div class="top-actions">
      <button id="sound-button" class="icon-button" type="button" aria-label="音を消す" title="エンジン音を切り替え">♪</button>
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
    <div class="speed-panel"><div class="speed-caption">SPEED <span class="gear-label">GEAR <b id="gear">1</b></span></div><div class="speed-main"><strong id="speed">000</strong><span>KM/H</span></div><div class="speed-line"><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span><span class="speed-tick"></span></div></div>
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
      <div class="track-select-heading"><span>SELECT CIRCUIT</span><span>SOLO TIME ATTACK / 03 TRACKS</span></div>
      <div class="track-options" role="group" aria-label="コースを選択">${trackCards}</div>
      <button id="start-button" class="primary-button" type="button">START ENGINE <span>↗</span></button>
      <div class="menu-help"><span class="desktop-help">W / ↑ 加速　S / ↓ ブレーキ　A D / ← → ハンドル</span><span class="mobile-help">左のスライダーでハンドル、右のペダルで運転</span></div>
    </div>
    <div class="menu-footer"><span>APEX ONE / ORIGINAL RACING EXPERIENCE</span><span>01 — 03</span></div>
  </section>

  <section id="pause-overlay" class="menu-overlay paused" hidden>
    <div class="menu-card pause-card"><div class="menu-kicker"><span class="kicker-line"></span> SESSION PAUSED</div><h2>TAKE A<br /><em>BREATH.</em></h2><p>走行を再開するか、スタート地点からやり直せます。</p><button id="resume-button" class="primary-button" type="button">RESUME <span>↗</span></button><button id="restart-button" class="secondary-button" type="button">RESTART LAP</button><button id="menu-button" class="secondary-button" type="button">SELECT CIRCUIT</button></div>
  </section>

  <div id="rotate-overlay" class="rotate-overlay"><div class="rotate-icon">↻</div><strong>横向きでプレイしてください</strong><p>端末を回転すると、コックピットが表示されます。</p></div>
`;

const scene = new THREE.Scene();
let selectedTrack: TrackDefinition = TRACKS[0];
let track = new Track(scene, selectedTrack);
const car = new CarVisual();
scene.add(car.group);
let physics = new CarPhysics(track);
car.setPose(physics.x, physics.z, physics.yaw);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const mobile = window.matchMedia('(pointer: coarse)').matches;
if (mobile) {
  // Safari can treat simultaneous steering and pedal touches as a page pinch.
  // Cancel the native gesture while leaving Pointer Events for both controls intact.
  const preventNativeGesture = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const preventMultiTouchGesture = (event: TouchEvent) => {
    if (event.touches.length > 1) preventNativeGesture(event);
  };
  document.addEventListener('touchstart', preventMultiTouchGesture, { passive: false, capture: true });
  document.addEventListener('touchmove', preventMultiTouchGesture, { passive: false, capture: true });
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, preventNativeGesture, { passive: false, capture: true });
  }
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  document.addEventListener('touchend', event => {
    if (event.changedTouches.length !== 1 || event.touches.length !== 0) return;
    const touch = event.changedTouches[0];
    const doubleTap = lastTapTime > 0 && event.timeStamp - lastTapTime < 350
      && Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY) < 48;
    if (doubleTap) {
      if (event.cancelable) event.preventDefault();
      lastTapTime = 0;
    } else {
      lastTapTime = event.timeStamp;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
    }
  }, { passive: false });
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = !mobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.querySelector('#scene')!.appendChild(renderer.domElement);

const controls = new Controls(app);
const engineAudio = new EngineAudio();
let laps = new LapTracker(track.length, readBestTime(selectedTrack.id));

const speedElement = app.querySelector<HTMLElement>('#speed')!;
const gearElement = app.querySelector<HTMLElement>('#gear')!;
const soundButton = app.querySelector<HTMLButtonElement>('#sound-button')!;
const currentTimeElement = app.querySelector<HTMLElement>('#current-time')!;
const bestTimeElement = app.querySelector<HTMLElement>('#best-time')!;
const lapNumberElement = app.querySelector<HTMLElement>('#lap-number')!;
const lapStateElement = app.querySelector<HTMLElement>('#lap-state')!;
const toastElement = app.querySelector<HTMLElement>('#toast')!;
const pauseOverlay = app.querySelector<HTMLElement>('#pause-overlay')!;
const startOverlay = app.querySelector<HTMLElement>('#start-overlay')!;
const currentTrackName = app.querySelector<HTMLElement>('#current-track-name')!;
let active = false;
let paused = false;
let elapsed = 0;
let lastFrame = 0;
let accumulator = 0;
let toastTimeout = 0;
let lapProgressHint = 0;

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
  const kmh = physics.speed * 3.6;
  speedElement.textContent = String(Math.round(kmh)).padStart(3, '0');
  gearElement.textContent = String(gearAtSpeed(kmh).gear);
  currentTimeElement.textContent = formatTime(laps.lapTime);
  bestTimeElement.textContent = formatTime(laps.bestTime);
  lapNumberElement.textContent = String(laps.lapNumber).padStart(2, '0');
  lapStateElement.textContent = laps.valid ? 'VALID LAP' : `INVALID • ${laps.invalidReason}`;
  lapStateElement.classList.toggle('invalid', !laps.valid);
  const speedTicks = app.querySelectorAll<HTMLElement>('.speed-tick');
  const tickCount = Math.min(speedTicks.length, Math.ceil(physics.speed * 3.6 / 38));
  speedTicks.forEach((tick, index) => tick.classList.toggle('active', index < tickCount));
}

function refreshTrackChoices(): void {
  app.querySelectorAll<HTMLButtonElement>('.track-option').forEach(button => {
    const selected = button.dataset.trackId === selectedTrack.id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  for (const definition of TRACKS) {
    app.querySelector<HTMLElement>(`[data-best-for="${definition.id}"]`)!.textContent =
      formatTime(readBestTime(definition.id));
  }
}

function selectTrack(id: TrackId): void {
  if (active || selectedTrack.id === id) return;
  const definition = TRACKS.find(item => item.id === id);
  if (!definition) return;
  track.dispose();
  renderer.renderLists.dispose();
  selectedTrack = definition;
  track = new Track(scene, definition);
  physics = new CarPhysics(track);
  laps = new LapTracker(track.length, readBestTime(id));
  lapProgressHint = 0;
  currentTrackName.textContent = definition.name;
  car.setPose(physics.x, physics.z, physics.yaw);
  refreshTrackChoices();
  refreshHud();
  lastFrame = performance.now();
}

function reset(notify = true): void {
  controls.clear();
  physics.reset();
  engineAudio.update(0, 0);
  laps.reset(0);
  lapProgressHint = 0;
  accumulator = 0;
  car.setPose(physics.x, physics.z, physics.yaw);
  refreshHud();
  if (notify) toast('START LINE に戻りました');
}

function setPaused(value: boolean): void {
  if (!active) return;
  paused = value;
  pauseOverlay.hidden = !value;
  if (value) controls.clear();
  else engineAudio.unlock();
  engineAudio.setActive(!value);
  lastFrame = performance.now();
}

function start(): void {
  engineAudio.unlock();
  engineAudio.setActive(true);
  active = true;
  paused = false;
  startOverlay.hidden = true;
  pauseOverlay.hidden = true;
  app.classList.add('in-game');
  reset(false);
  lastFrame = performance.now();
}

app.querySelector('#start-button')!.addEventListener('click', start);
app.querySelectorAll<HTMLButtonElement>('.track-option').forEach(button => {
  button.addEventListener('click', () => selectTrack(button.dataset.trackId as TrackId));
});
soundButton.addEventListener('click', () => {
  engineAudio.unlock();
  engineAudio.setMuted(!engineAudio.isMuted);
  soundButton.textContent = engineAudio.isMuted ? '×' : '♪';
  soundButton.setAttribute('aria-label', engineAudio.isMuted ? '音を出す' : '音を消す');
});
app.querySelector('#pause-button')!.addEventListener('click', () => setPaused(!paused));
app.querySelector('#resume-button')!.addEventListener('click', () => setPaused(false));
app.querySelector('#reset-button')!.addEventListener('click', () => reset());
app.querySelector('#restart-button')!.addEventListener('click', () => { reset(); setPaused(false); });
app.querySelector('#menu-button')!.addEventListener('click', () => {
  controls.clear();
  engineAudio.setActive(false);
  active = false;
  paused = false;
  pauseOverlay.hidden = true;
  startOverlay.hidden = false;
  app.classList.remove('in-game');
  reset(false);
  refreshTrackChoices();
});
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
      const position = track.nearest(physics.x, physics.z, lapProgressHint);
      lapProgressHint = position.progress;
      if (physics.collided) laps.invalidate('接触');
      const event = laps.update(position.progress, physics.allWheelsOffTrack, physics.speed, 1 / 120);
      if (event) {
        if (event.newBest) {
          saveBestTime(selectedTrack.id, event.time);
          refreshTrackChoices();
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
    engineAudio.update(physics.speed * 3.6, controls.value.throttle);
    refreshHud();
  }
  renderer.render(scene, car.camera);
}

refreshHud();
refreshTrackChoices();
renderer.setAnimationLoop(frame);
