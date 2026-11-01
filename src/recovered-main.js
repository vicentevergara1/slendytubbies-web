import * as THREE from 'three';
import { createRecoveredWorld } from './recovered-world.js';
import { advanceJump } from './jump-physics.js';
import { stepTinky } from './original-ai.js';
import './recovered.css';
import './recovered-extra.css';

const assetRoot = import.meta.env.BASE_URL;
const app = document.getElementById('app');
app.innerHTML = `
  <div id="loading" class="screen"><div><h1>Slendytubbies</h1><p id="loadText">Cargando archivos del juego original…</p><div class="progress"><span></span></div></div></div>
  <div id="gameUi" class="hidden"><div class="custard-counter">Tubby Custards Collected: <strong id="count">0</strong>/10</div><div class="crosshair">+</div><div class="interaction hidden" id="interaction"></div><div class="notice" id="notice"></div><div class="location" id="location"></div><div class="flashlight-indicator" id="flashlightIndicator">FLASHLIGHT ON · F</div><div id="timeStatus" class="time-status">NOCHE</div></div>
  <div id="threat" class="threat-overlay" aria-hidden="true"></div>
  <div id="mainMenu" class="screen hidden"><div class="menu"><h1>Slendytubbies</h1><p class="subtitle">ORIGINAL MAP · THREE TIMES OF DAY</p><div class="time-picker"><span>ILUMINACIÓN DEL MAPA</span><div class="time-options"><button data-time="day">DÍA</button><button data-time="dusk">TARDE</button><button data-time="night" class="active">NOCHE</button><button data-time="cycle">CICLO</button></div></div><div class="menu-buttons"><button id="playButton">JUGAR</button><button id="controlsButton">CONTROLES</button><button id="fullscreenButton">PANTALLA COMPLETA</button></div><div class="menu-controls hidden" id="controlsPanel">W A S D — Moverse<br>RATÓN — Mirar<br>ESPACIO — Saltar<br>SHIFT — Correr<br>CTRL / C — Agacharse<br>F — Linterna<br>E — Recoger natillas<br>M — Mapa<br>L — Cambiar hora<br>ESC — Pausar</div><p class="small">Recoge las diez natillas. No dejes que Tinky Winky te encuentre.</p></div></div>
  <div id="pauseScreen" class="screen hidden"><div class="menu"><h2>PAUSED</h2><div class="time-picker"><span>CAMBIAR HORA DEL DÍA</span><div class="time-options"><button data-time="day">DÍA</button><button data-time="dusk">TARDE</button><button data-time="night" class="active">NOCHE</button><button data-time="cycle">CICLO</button></div></div><div class="menu-buttons"><button id="resumeButton">RESUME</button><button id="restartButton">RESTART</button><button id="menuButton">MAIN MENU</button></div></div></div>
  <div id="endScreen" class="screen hidden"><div class="menu"><h2 id="endTitle">HE FOUND YOU</h2><p id="endDescription">La noche ha terminado.</p><div class="menu-buttons"><button id="retryButton">PLAY AGAIN</button><button id="endMenuButton">MAIN MENU</button></div></div></div>
  <div id="screamer" class="hidden"><img src="${assetRoot}original/textures/tinky-0-66.png" alt="Tinky Winky" /></div>
  <div id="evidence" class="hidden"><img id="bodyImage" alt="Escena original recuperada"/><p id="bodyLabel"></p></div>
  <div id="map" class="hidden"><div class="map-title">ORIGINAL MAP <button id="closeMap">×</button></div><div class="map-image"><img src="${assetRoot}original/textures/map-1-91.png" alt="Mapa del escenario original"/><span class="map-marker" id="mapMarker"></span></div><p>START · CAVE · TELETUBBY HOUSE</p></div>
  <button id="mobilePause" class="mobile-ui hidden">Ⅱ</button>
  <div id="mobileControls" class="hidden"><div id="touchJoystick"><div id="touchKnob"></div></div><div class="touchButtons"><button id="mobileCollect">E</button><button id="mobileRun">CORRER</button><button id="mobileFlash">F</button><button id="mobileJump">SALTAR</button></div></div>
`;

const $ = id => document.getElementById(id);
const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
const distance = (x, z, a, b) => Math.hypot(x - a, z - b);
const clamp = THREE.MathUtils.clamp;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(1.35, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.domElement.id = 'view';
  app.prepend(renderer.domElement);
} catch (error) {
  $('loadText').innerText = 'Este juego necesita WebGL. Activa la aceleración de hardware en Chrome o Edge y vuelve a cargar la página.';
  throw error;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .3, 1000);
camera.rotation.order = 'YXZ';
scene.add(camera);

const flashlight = new THREE.SpotLight(0xe6e6ca, 38, 80, .39, .7, 1.6);
flashlight.position.set(.18, -.12, .15);
const flashlightTarget = new THREE.Object3D();
flashlightTarget.position.set(0, -.03, -11);
camera.add(flashlight, flashlightTarget);
flashlight.target = flashlightTarget;
camera.add(new THREE.PointLight(0xc5cbd0, .4, 4));

let world;
const state = {
  mode: 'loading', x: 501.793, z: 131.085, yaw: 0, pitch: -.01,
  elapsed: 0, collected: 0, flashlight: true, map: false, speed: 0,
  danger: 0, health: 100, enemyActive: true, enemyClock: 0, touched: false, touchX: 0, touchY: 0,
  touchRun: false, moving: false, bob: 0, jumpHeight: 0, jumpVelocity: 0,
  grounded: true, crouch: false, time: 'night', dayPhase: 1, lightClock: 0
};
const timeNames = { day: 'DÍA', dusk: 'ATARDECER', night: 'NOCHE', cycle: 'CICLO' };
const timeOrder = ['day', 'dusk', 'night', 'cycle'];
const keys = new Set();
const isTouch = window.matchMedia('(pointer: coarse)').matches;
let toastTimer;

const audio = {
  scream: new Audio(`${assetRoot}original/audio/scream2.wav`),
  near: new Audio(`${assetRoot}original/audio/nearbysound.wav`),
  steps: new Audio(`${assetRoot}original/audio/playerfootsteps.wav`),
  theme: new Audio(`${assetRoot}original/audio/slendytubbies_theme.ogg`)
};
audio.scream.volume = .88;
audio.near.volume = .30;
audio.steps.volume = .20;
audio.steps.loop = true;
audio.theme.volume = .2;
audio.theme.loop = true;

function showNotice(message, delay = 3000) {
  $('notice').textContent = message;
  $('notice').classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('notice').classList.remove('show'), delay);
}

function selectTime(value) {
  if (!timeOrder.includes(value)) return;
  state.time = value;
  state.dayPhase = value === 'day' ? 0 : value === 'dusk' ? .5 : value === 'cycle' ? (1 - Math.cos((state.elapsed / 480) * Math.PI * 2)) / 2 : 1;
  document.querySelectorAll('[data-time]').forEach(button => {
    button.classList.toggle('active', button.dataset.time === value);
    button.setAttribute('aria-pressed', String(button.dataset.time === value));
  });
  if (world) world.setLighting(state.dayPhase);
  $('timeStatus').textContent = timeNames[value];
}

function jump() {
  if (state.mode !== 'playing' || !state.grounded || state.crouch) return;
  state.jumpVelocity = 9.4;
  state.grounded = false;
  audio.steps.pause();
}

function mode(next) {
  state.mode = next;
  show('loading', next === 'loading');
  show('mainMenu', next === 'menu');
  show('pauseScreen', next === 'paused');
  show('endScreen', next === 'dead' || next === 'won');
  show('gameUi', next === 'playing');
  show('mobileControls', next === 'playing' && isTouch);
  show('mobilePause', next === 'playing' && isTouch);
  if (next !== 'playing') {
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
    show('map', false);
  }
}

function reset() {
  state.x = 501.793;
  state.z = 131.085;
  state.yaw = 0;
  state.pitch = -.015;
  state.elapsed = 0;
  state.collected = 0;
  state.flashlight = true;
  state.map = false;
  state.enemyActive = true;
  state.health = 100;
  state.enemyClock = 0;
  state.bob = 0;
  state.danger = 0;
  state.jumpHeight = 0;
  state.jumpVelocity = 0;
  state.grounded = true;
  state.crouch = false;
  state.lightClock = 0;
  keys.clear();
  for (const pickup of world.collectibles) {
    pickup.collected = false;
    pickup.group.visible = true;
  }
  if (world.enemy) {
    world.enemy.x = world.enemy.spawnX;
    world.enemy.z = world.enemy.spawnZ;
    world.enemy.group.position.set(world.enemy.x, world.heightAt(world.enemy.x, world.enemy.z), world.enemy.z);
  }
  $('count').textContent = '0';
  show('screamer', false);
  show('evidence', false);
  $('threat').style.opacity = '0';
  world.updateTrees(state.x, state.z, true);
  selectTime(state.time);
}

function start() {
  reset();
  audio.theme.pause();
  mode('playing');
  showNotice('COLLECT ALL 10 TUBBY CUSTARDS', 3800);
  if (!isTouch) renderer.domElement.requestPointerLock?.().catch(() => {});
}

function resume() {
  mode('playing');
  if (!isTouch) renderer.domElement.requestPointerLock?.().catch(() => {});
}

function pause() {
  if (state.mode !== 'playing') return;
  mode('paused');
  audio.steps.pause();
}

function end(won = false) {
  if (state.mode !== 'playing') return;
  mode(won ? 'won' : 'dead');
  audio.steps.pause();
  $('endTitle').textContent = won ? 'YOU SURVIVED' : 'HE FOUND YOU';
  $('endDescription').textContent = won ? `¡Recogiste las 10 natillas en ${Math.floor(state.elapsed / 60)}m ${Math.floor(state.elapsed % 60)}s!` : `Tubby Custards Collected: ${state.collected}/10`;
  if (!won) {
    show('screamer', true);
    audio.scream.currentTime = 0;
    audio.scream.play().catch(() => {});
    setTimeout(() => show('screamer', false), 1600);
  }
}

function nearItem() {
  let best;
  let bestDistance = 5;
  for (const item of world.collectibles) {
    if (item.collected) continue;
    const d = distance(state.x, state.z, item.x, item.z);
    if (d < bestDistance) { best = { type: 'pickup', item }; bestDistance = d; }
  }
  for (const item of world.bodies) {
    const d = distance(state.x, state.z, item.x, item.z);
    if (d < bestDistance + 1 && d < 8) { best = { type: 'body', item }; bestDistance = d; }
  }
  return best;
}

function interact() {
  if (state.mode !== 'playing') return;
  const nearby = nearItem();
  if (!nearby) return;
  if (nearby.type === 'pickup') {
    nearby.item.collected = true;
    nearby.item.group.visible = false;
    state.collected++;
    state.enemyActive = true;
    $('count').textContent = state.collected;
    showNotice(`TUBBY CUSTARD FOUND — ${state.collected}/10`, 2500);
    if (state.collected === 10) setTimeout(() => end(true), 850);
  } else {
    const images = { 'Laa-Laa': 'laladead-0-71.png', 'Dipsy': 'dipsydead-0-87.png', 'Po': 'podead-0-57.png' };
    $('bodyImage').src = `${assetRoot}original/textures/${images[nearby.item.name]}`;
    $('bodyLabel').textContent = `${nearby.item.name.toUpperCase()} · ORIGINAL SCENE`;
    show('evidence', true);
    setTimeout(() => show('evidence', false), 3500);
  }
}

function toggleMap() {
  if (state.mode !== 'playing') return;
  state.map = !state.map;
  show('map', state.map);
  const marker = $('mapMarker');
  marker.style.left = `${21.6 + state.x / 1000 * 56.8}%`;
  marker.style.top = `${76.5 - state.z / 1000 * 57.1}%`;
}

function toggleFlashlight() {
  if (state.mode !== 'playing') return;
  state.flashlight = !state.flashlight;
  flashlight.visible = state.flashlight;
  $('flashlightIndicator').textContent = state.flashlight ? 'FLASHLIGHT ON · F' : 'FLASHLIGHT OFF · F';
}

function updateEnemy(delta) {
  if (!world.enemy || !state.enemyActive) return;
  const enemy = world.enemy;
  const d = distance(enemy.x, enemy.z, state.x, state.z);
  let canSee = true;
  if (d < 12 && d > 0.01) {
    const fromY = world.heightAt(enemy.x, enemy.z) + 1.65;
    const toY = world.heightAt(state.x, state.z) + (state.crouch ? 1.1 : 1.72) + state.jumpHeight;
    for (let i = 1; i <= 9; i++) {
      const t = i / 10;
      const x = enemy.x + (state.x - enemy.x) * t;
      const z = enemy.z + (state.z - enemy.z) * t;
      if (world.heightAt(x, z) > fromY + (toY - fromY) * t - .3) { canSee = false; break; }
    }
  }
  const next = stepTinky(
    { x: enemy.x, z: enemy.z },
    { x: state.x, z: state.z, forwardX: -Math.sin(state.yaw), forwardZ: Math.cos(state.yaw), health: state.health },
    delta,
    world.collectibles.length - state.collected,
    canSee
  );
  enemy.x = next.x;
  enemy.z = next.z;
  state.health = next.health;
  enemy.group.position.set(enemy.x, world.heightAt(enemy.x, enemy.z) + (next.shouldMove ? Math.abs(Math.sin(state.elapsed * 8)) * .08 : 0), enemy.z);
  enemy.group.rotation.y = Math.atan2(state.x - enemy.x, state.z - enemy.z);
  enemy.group.rotation.z = next.shouldMove ? Math.sin(state.elapsed * 5.8) * .02 : 0;
  const newDistance = distance(enemy.x, enemy.z, state.x, state.z);
  state.danger = THREE.MathUtils.lerp(state.danger, THREE.MathUtils.clamp(1 - newDistance / 24, 0, 1), .07);
  $('threat').style.opacity = String(next.visible ? Math.max(.12, (100 - state.health) / 100) : 0);
  if (next.visible && audio.near.paused) {
    audio.near.currentTime = 0;
    audio.near.play().catch(() => {});
  }
  if (state.health <= 0) end(false);
}

function update(delta) {
  if (!world) return;
  const t = performance.now() / 1000;
  if (state.mode === 'playing') {
    state.elapsed += delta;
    state.crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (!state.grounded) {
      const next = advanceJump(state.jumpHeight, state.jumpVelocity, delta);
      state.jumpHeight = next.height;
      state.jumpVelocity = next.velocity;
      state.grounded = next.grounded;
    }
    if (state.time === 'cycle') {
      state.lightClock += delta;
      if (state.lightClock > .15) {
        state.lightClock = 0;
        state.dayPhase = (1 - Math.cos((state.elapsed / 480) * Math.PI * 2)) / 2;
        world.setLighting(state.dayPhase);
        $('timeStatus').textContent = state.dayPhase < .28 ? 'DÍA' : state.dayPhase < .73 ? 'TARDE' : 'NOCHE';
      }
    }
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - state.touchY;
    const side = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + state.touchX;
    const amount = Math.hypot(forward, side);
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || state.touchRun;
    const speed = state.crouch ? 3 : sprint ? 20 : 7;
    state.moving = amount > .12;
    if (amount > .01) {
      const dx = (-Math.sin(state.yaw) * forward + Math.cos(state.yaw) * side) / Math.max(1, amount);
      const dz = (Math.cos(state.yaw) * forward + Math.sin(state.yaw) * side) / Math.max(1, amount);
      let nx = clamp(state.x + dx * speed * delta, 4, 996);
      let nz = clamp(state.z + dz * speed * delta, 4, 996);
      const target = world.heightAt(nx, nz);
      const previous = world.heightAt(state.x, state.z);
      if (target - previous > 1.2 + state.jumpHeight) { nx = state.x; nz = state.z; }
      if (state.jumpHeight < 1.5 && world.trees.some(tree => (tree[0] - nx) ** 2 + (tree[1] - nz) ** 2 < 1.0)) {
        nx = state.x; nz = state.z;
      }
      state.x = nx; state.z = nz;
      if (state.grounded) state.bob += delta * (sprint ? 14 : 9);
      if (state.grounded && audio.steps.paused && state.elapsed > 1) audio.steps.play().catch(() => {});
      if (!state.grounded) audio.steps.pause();
    } else { audio.steps.pause(); }
    if (keys.has('ArrowLeft')) state.yaw += 1.4 * delta;
    if (keys.has('ArrowRight')) state.yaw -= 1.4 * delta;
    world.updateTrees(state.x, state.z);
    updateEnemy(delta);
    for (const custard of world.collectibles) {
      if (!custard.collected && distance(state.x, state.z, custard.x, custard.z) < 2) {
        custard.collected = true;
        custard.group.visible = false;
        state.collected++;
        $('count').textContent = state.collected;
        showNotice(`TUBBY CUSTARD FOUND — ${state.collected}/10`, 2500);
        if (state.collected === 10) setTimeout(() => end(true), 850);
      }
    }
    const near = nearItem();
    $('interaction').textContent = near ? (near.type === 'pickup' ? '[E] COLLECT TUBBY CUSTARD' : `[E] EXAMINE ${near.item.name.toUpperCase()}`) : '';
    show('interaction', !!near);
    const atHouse = distance(state.x, state.z, world.house?.x || 500, world.house?.z || 730);
    const atCave = distance(state.x, state.z, world.cave?.x || 282, world.cave?.z || 230);
    $('location').textContent = atCave < 65 ? 'CAVE' : atHouse < 70 ? 'TELETUBBY HOUSE' : '';
  }
  const bob = state.mode === 'playing' && state.moving && state.grounded ? Math.sin(state.bob) * .035 : 0;
  camera.position.set(state.x, world.heightAt(state.x, state.z) + (state.crouch ? 1.1 : 1.72) + state.jumpHeight + bob, -state.z);
  camera.rotation.set(state.pitch, state.yaw, 0);
  flashlight.intensity = state.flashlight ? 32 + state.dayPhase * 11 + Math.sin(t * 13) * .4 : 0;
  world.updateSky(camera);
  if (state.mode === 'playing') renderer.render(scene, camera);
  else if (state.mode !== 'loading') renderer.render(scene, camera);
}

let last = performance.now();
function frame(now) {
  const delta = Math.min(.05, (now - last) / 1000);
  last = now;
  update(delta);
  requestAnimationFrame(frame);
}

function attachControls() {
  document.querySelectorAll('[data-time]').forEach(button => button.addEventListener('click', () => selectTime(button.dataset.time)));
  $('playButton').addEventListener('click', start);
  $('resumeButton').addEventListener('click', resume);
  $('restartButton').addEventListener('click', start);
  $('retryButton').addEventListener('click', start);
  $('menuButton').addEventListener('click', () => mode('menu'));
  $('endMenuButton').addEventListener('click', () => mode('menu'));
  $('controlsButton').addEventListener('click', () => $('controlsPanel').classList.toggle('hidden'));
  $('fullscreenButton').addEventListener('click', () => document.documentElement.requestFullscreen?.().catch(() => {}));
  $('closeMap').addEventListener('click', toggleMap);
  $('mobilePause').addEventListener('click', pause);
  $('mobileCollect').addEventListener('click', interact);
  $('mobileFlash').addEventListener('click', toggleFlashlight);
  $('mobileJump').addEventListener('click', jump);
  $('mobileRun').addEventListener('pointerdown', () => { state.touchRun = true; });
  $('mobileRun').addEventListener('pointerup', () => { state.touchRun = false; });
  $('mobileRun').addEventListener('pointercancel', () => { state.touchRun = false; });
  addEventListener('keydown', event => {
    keys.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'Escape') state.mode === 'playing' ? pause() : state.mode === 'paused' ? resume() : undefined;
    if (event.code === 'KeyE') interact();
    if (event.code === 'KeyF') toggleFlashlight();
    if (event.code === 'KeyM') toggleMap();
    if (event.code === 'Space') jump();
    if (event.code === 'KeyL' && state.mode === 'playing') selectTime(timeOrder[(timeOrder.indexOf(state.time) + 1) % timeOrder.length]);
  });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', () => { keys.clear(); audio.steps.pause(); });
  addEventListener('mousemove', event => {
    if (state.mode !== 'playing' || document.pointerLockElement !== renderer.domElement) return;
    state.yaw -= event.movementX * .0022;
    state.pitch = clamp(state.pitch - event.movementY * .002, -1.42, 1.42);
  });
  document.addEventListener('pointerlockchange', () => {
    if (state.mode === 'playing' && !isTouch && document.pointerLockElement !== renderer.domElement) pause();
  });
  renderer.domElement.addEventListener('click', () => {
    if (state.mode === 'playing' && !isTouch && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.().catch(() => {});
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  if (isTouch) {
    const stick = $('touchJoystick');
    let stickId;
    stick.addEventListener('pointerdown', event => { stickId = event.pointerId; stick.setPointerCapture(event.pointerId); });
    stick.addEventListener('pointermove', event => {
      if (stickId !== event.pointerId) return;
      const r = stick.getBoundingClientRect();
      const x = clamp((event.clientX - r.left - r.width / 2) / (r.width / 2), -1, 1);
      const y = clamp((event.clientY - r.top - r.height / 2) / (r.height / 2), -1, 1);
      state.touchX = x;
      state.touchY = y;
      $('touchKnob').style.transform = `translate(${x * 40}px, ${y * 40}px)`;
    });
    const stop = () => { stickId = null; state.touchX = 0; state.touchY = 0; $('touchKnob').style.transform = ''; };
    stick.addEventListener('pointerup', stop);
    stick.addEventListener('pointercancel', stop);
    let lookX, lookY;
    renderer.domElement.addEventListener('pointerdown', e => { lookX = e.clientX; lookY = e.clientY; });
    renderer.domElement.addEventListener('pointermove', e => {
      if (!Number.isFinite(lookX) || state.mode !== 'playing') return;
      state.yaw -= (e.clientX - lookX) * .005;
      state.pitch = clamp(state.pitch - (e.clientY - lookY) * .005, -1.4, 1.4);
      lookX = e.clientX; lookY = e.clientY;
    });
    renderer.domElement.addEventListener('pointerup', () => { lookX = undefined; });
  }
}

attachControls();
requestAnimationFrame(frame);
try {
  world = await createRecoveredWorld(scene, message => { $('loadText').textContent = message; });
  mode('menu');
} catch (error) {
  $('loadText').textContent = `No se pudo cargar el mapa original: ${error.message}`;
  console.error(error);
}
