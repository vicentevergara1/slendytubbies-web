import * as THREE from 'three';
import { createWorld, heightAt } from './world.js';
import { GameAudio } from './audio.js';
import { drawSoftware } from './software.js';
import './style.css';

const app = document.getElementById('app');
const assets = import.meta.env.BASE_URL;
app.innerHTML = `
  <div id="vignette"></div><div id="grain"></div><div id="dangerFlash"></div>
  <div id="hud" class="hidden">
    <div class="hud-top">
      <div class="hud-brand"><strong>SLENDYTUBBIES <span style="color:#d9dd8a">/</span> NOCHE</strong><small>PROTOCOLO DE SUPERVIVENCIA</small></div>
      <div class="hud-right"><div class="count-number"><span id="count">00</span> / 10</div><div class="count-caption">NATILLAS RECUPERADAS</div><div class="collect-markers" id="markers"></div></div>
    </div>
    <div class="hud-center"><div id="areaLabel">PRADERA OSCURA</div><div class="area-line"></div><div id="clock">00:00</div></div>
    <div id="crosshair"></div>
    <div id="interaction" class="hidden"><span class="interact-key" id="interactKey">E</span><span id="interactionText"></span></div>
    <div id="toast"></div>
    <div id="evidence" class="evidence hidden"><div class="evidence-tag">EVIDENCIA RECUPERADA // ARCHIVO ORIGINAL</div><img id="evidenceImage" src="" alt="Escena recuperada"/><div class="evidence-name" id="evidenceName"></div></div>
    <div class="hud-bottom"><div class="meters">
      <div class="meter"><div class="meter-title"><span>LINTERNA</span><span id="batteryValue">100%</span></div><div class="meter-track"><div id="batteryFill"></div></div></div>
      <div class="meter"><div class="meter-title"><span>RESISTENCIA</span><span id="staminaValue">100%</span></div><div class="meter-track"><div id="staminaFill"></div></div></div>
    </div><div class="hints">WASD MOVERSE &nbsp;·&nbsp; SHIFT CORRER &nbsp;·&nbsp; F LINTERNA<br>E INTERACTUAR &nbsp;·&nbsp; M MAPA &nbsp;·&nbsp; ESC PAUSA</div></div>
    <button id="pauseButton" aria-label="Pausar">Ⅱ</button><button id="muteButton" aria-label="Silenciar">♫</button><button id="fullButton" aria-label="Pantalla completa">⛶</button>
  </div>
  <div id="mapPanel" class="hidden"><div class="map-title"><span>MAPA DE SEÑALES</span><span id="coords">X 000 / Z 000</span></div><canvas id="mapCanvas" width="320" height="320"></canvas><div class="map-legend"><span><b>◆</b> TU POSICIÓN</span><span><b class="pink">●</b> NATILLAS</span><span>▢ REFUGIO</span><span>△ CUEVA</span></div></div>
  <div id="menu" class="overlay">
    <div class="menu-content">
      <div class="micro">ARCHIVO PERDIDO <span class="red-dot"></span> 03:00 A. M.</div>
      <div class="serial">EXPEDIENTE Nº 001 // MODO SUPERVIVENCIA</div>
      <h1 class="game-title"><span>SLENDY</span><span>TUBBIES</span><span class="second">NOCHE.</span></h1>
      <div class="version">HORROR SURVIVAL <span style="font-size:12px;color:#7f9690">/</span> EDICIÓN NOCTURNA</div>
      <div class="line"></div>
      <p class="description">Diez natillas. Tres cuerpos. Algo te está buscando. <em>Entra en la cueva, descubre qué ocurrió y regresa al domo antes de que te encuentre.</em></p>
      <div class="cta-row"><button id="startButton" class="primary-button">INICIAR PESADILLA <span class="arrow">↗</span></button><button id="howButton" class="outline-button">CONTROLES</button></div>
      <div class="audio-row"><label class="upload-button" for="audioInput">CAMBIAR AUDIO DE GRITO</label><input id="audioInput" type="file" accept="audio/*" /><span id="audioStatus">✓ GRITO ORIGINAL RECUPERADO · scream2.wav</span></div>
      <div class="controls-panel" id="menuControls"><span><span class="key">WASD</span>MOVER</span><span><span class="key">MOUSE</span>MIRAR</span><span><span class="key">SHIFT</span>CORRER</span><span><span class="key">E</span>RECOGER</span><span><span class="key">F</span>LUZ</span><span><span class="key">M</span>MAPA</span></div>
      <div class="footer-credit">JUEGO 3D PARA NAVEGADOR · AUDIO RECOMENDADO · AURICULARES RECOMENDADOS</div>
    </div>
    <div class="menu-side"><strong>CAM_01 <span class="red-dot"></span> LIVE</strong><span>SEÑAL: INESTABLE</span><span>LOCALIZACIÓN: DESCONOCIDA</span></div>
  </div>
  <div id="pause" class="overlay compact-overlay hidden"><div class="compact-content"><div class="micro">TRANSMISIÓN INTERRUMPIDA</div><h2>EN PAUSA.</h2><p>El bosque sigue ahí. Tinky Winky también.</p><div class="cta-row"><button id="resumeButton" class="primary-button">CONTINUAR <span class="arrow">↗</span></button><button id="pauseRestart" class="outline-button">REINICIAR</button><button id="pauseMenu" class="outline-button">MENÚ</button></div><div class="audio-row" style="justify-content:center"><label class="upload-button" for="pauseAudioInput">CAMBIAR GRITO</label><input id="pauseAudioInput" type="file" accept="audio/*" /><span id="pauseAudioStatus">scream2.wav original activo</span></div><div class="map-relic"><img src="${assets}original/textures/map-1-91.png" alt="Mapa original recuperado"/><span>MAPA ORIGINAL RECUPERADO · REFERENCIA DEL TERRENO</span></div></div></div>
  <div id="end" class="overlay compact-overlay hidden"><div class="compact-content"><div class="micro" id="endEyebrow">FIN DE LA TRANSMISIÓN</div><h2 id="endTitle" class="danger-title">TE ENCONTRÓ.</h2><p id="endMessage">La noche se tragó tu señal.</p><div class="stats-row"><div><strong id="endCount">0 / 10</strong>NATILLAS</div><div><strong id="endTime">00:00</strong>TIEMPO</div><div><strong id="endBest">—</strong>MEJOR MARCA</div></div><div class="cta-row"><button id="retryButton" class="primary-button">VOLVER A INTENTAR <span class="arrow">↗</span></button><button id="endMenu" class="outline-button">MENÚ PRINCIPAL</button></div></div></div>
  <div id="jumpscare" class="hidden"><img src="${assets}original/textures/tinky-0-66.png" alt="" class="original-scare" /></div>
  <div id="touchControls"><div id="joystick"><div id="joystickKnob"></div></div><div class="touch-actions"><button id="touchInteract" aria-label="Interactuar">E</button><button id="touchFlash" aria-label="Linterna">LUZ</button><button id="touchSprint" aria-label="Correr">CORRER</button><button id="touchMap" aria-label="Mapa">MAPA</button></div><button id="mobilePause" aria-label="Pausar">Ⅱ</button></div>
`;

const $ = id => document.getElementById(id);
let renderer;
let software = false;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
} catch {
  software = true;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  renderer = {
    domElement: canvas,
    setSize(width, height) { canvas.width = Math.floor(width * Math.min(devicePixelRatio || 1, 1.4)); canvas.height = Math.floor(height * Math.min(devicePixelRatio || 1, 1.4)); },
    render() { drawSoftware(ctx, canvas, state, world, performance.now()); }
  };
  renderer.setSize(innerWidth, innerHeight);
}
renderer.domElement.id = 'gameCanvas';
app.insertBefore(renderer.domElement, app.firstChild);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, .08, 250);
camera.rotation.order = 'YXZ';
scene.add(camera);
const world = createWorld(scene, { useOriginalModels: !software });
const audio = new GameAudio();

const flashlight = new THREE.SpotLight(0xe7f5df, 21, 37, .48, .72, 1.5);
flashlight.position.set(.10, -.12, -.1);
const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, -.08, -10);
camera.add(flashlight, lightTarget);
flashlight.target = lightTarget;
const nearLight = new THREE.PointLight(0xd6e3e0, .32, 3);
camera.add(nearLight);

const state = {
  mode: 'menu', x: 0, z: 16, yaw: 0, pitch: -.015, elapsed: 0, battery: 100,
  stamina: 100, collected: 0, flashlight: true, showMap: false, muted: false,
  moveTime: 0, enemyRelocateClock: 0, dangerCooldown: 0, heartClock: 0,
  toastTimeout: 0, touch: { x: 0, y: 0, sprint: false }, looking: false,
  lastNear: null, playerHeight: 1.65
};

const held = new Set();
let lastFrame = performance.now();
let jumpTimeout = null;
const isTouch = window.matchMedia('(pointer: coarse)').matches;
const distance = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const clamp = THREE.MathUtils.clamp;
const forward = new THREE.Vector3(), strafe = new THREE.Vector3();

function reset() {
  state.x = 0; state.z = 16; state.yaw = 0; state.pitch = -.045;
  state.elapsed = 0; state.battery = 100; state.stamina = 100; state.collected = 0;
  state.flashlight = true; state.showMap = false; state.enemyRelocateClock = 0;
  state.dangerCooldown = 0; state.heartClock = 0; state.moveTime = 0; state.lastNear = null;
  held.clear(); state.touch = { x: 0, y: 0, sprint: false };
  world.custards.forEach(o => { o.collected = false; o.group.visible = true; });
  world.batteries.forEach(o => { o.used = false; o.group.visible = true; });
  world.bodies.forEach(o => { o.inspected = false; });
  const enemy = world.enemy;
  enemy.x = 44; enemy.z = -28; enemy.state = 'patrol'; enemy.tick = 0;
  enemy.target = { x: 38, z: -29 };
  enemy.group.position.set(enemy.x, heightAt(enemy.x, enemy.z), enemy.z);
  $('markers').innerHTML = Array.from({ length: 10 }, () => '<i></i>').join('');
  $('mapPanel').classList.add('hidden'); $('interaction').classList.add('hidden');
  $('dangerFlash').style.opacity = 0;
  $('evidence').classList.add('hidden');
  $('jumpscare').classList.add('hidden');
  if (jumpTimeout) clearTimeout(jumpTimeout);
  updateHud();
}

function setMode(mode) {
  state.mode = mode;
  $('menu').classList.toggle('hidden', mode !== 'menu');
  $('pause').classList.toggle('hidden', mode !== 'paused');
  $('end').classList.toggle('hidden', mode !== 'lost' && mode !== 'won');
  $('hud').classList.toggle('hidden', mode !== 'playing');
  $('touchControls').classList.toggle('active', mode === 'playing' && isTouch);
  if (mode !== 'playing') { state.showMap = false; $('mapPanel').classList.add('hidden'); }
  if (mode !== 'playing' && document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}

function start() {
  reset(); audio.init(); setMode('playing');
  showToast('RECUPERA LAS 10 NATILLAS. EVITA A TINKY WINKY.', 5200);
  if (!isTouch) renderer.domElement.requestPointerLock?.().catch(() => {});
}

function resume() {
  audio.init(); setMode('playing');
  if (!isTouch) renderer.domElement.requestPointerLock?.().catch(() => {});
}

function pause() {
  if (state.mode !== 'playing') return;
  setMode('paused');
}

function showToast(text, ms = 3400) {
  const el = $('toast'); el.textContent = text; el.classList.add('visible');
  if (state.toastTimeout) clearTimeout(state.toastTimeout);
  state.toastTimeout = setTimeout(() => el.classList.remove('visible'), ms);
}

function formatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function updateHud() {
  $('count').textContent = String(state.collected).padStart(2, '0');
  $('batteryFill').style.width = `${Math.max(0, state.battery)}%`;
  $('staminaFill').style.width = `${Math.max(0, state.stamina)}%`;
  $('batteryValue').textContent = `${Math.round(state.battery)}%`;
  $('staminaValue').textContent = `${Math.round(state.stamina)}%`;
  $('clock').textContent = formatTime(state.elapsed);
  const inCave = state.x > -35 && state.x < -25 && state.z < -22 && state.z > -60;
  const atHome = distance(state.x, state.z, 18, -6) < 13;
  $('areaLabel').textContent = inCave ? 'CUEVA SUBTERRÁNEA' : atHome ? 'DOMO ABANDONADO' : (state.z < -12 ? 'BOSQUE PROFUNDO' : 'PRADERA OSCURA');
  flashlight.visible = state.flashlight && state.battery > 0;
  $('markers').querySelectorAll('i').forEach((el, i) => el.classList.toggle('filled', i < state.collected));
  $('muteButton').textContent = state.muted ? '×' : '♫';
}

function toggleFlash() {
  if (state.mode !== 'playing') return;
  if (state.battery <= 0 && !state.flashlight) { showToast('LA BATERÍA ESTÁ AGOTADA.'); return; }
  state.flashlight = !state.flashlight;
  audio.switch();
}

function toggleMap() {
  if (state.mode !== 'playing') return;
  state.showMap = !state.showMap;
  $('mapPanel').classList.toggle('hidden', !state.showMap);
  if (state.showMap) drawMap();
}

function nearby() {
  const targets = [];
  for (const c of world.custards) if (!c.collected) targets.push({ type: 'custard', obj: c, x: c.x, z: c.z, radius: 2.7, label: 'RECOGER NATILLA' });
  for (const b of world.batteries) if (!b.used) targets.push({ type: 'battery', obj: b, x: b.x, z: b.z, radius: 2.4, label: 'TOMAR BATERÍA' });
  for (const b of world.bodies) targets.push({ type: 'body', obj: b, x: b.x, z: b.z, radius: 3.1, label: `INSPECCIONAR A ${b.name.toUpperCase()}` });
  if (state.collected === 10) targets.push({ type: 'exit', x: 18, z: .8, radius: 4.2, label: 'REGRESAR AL DOMO / ESCAPAR' });
  targets.sort((a, b) => distance(state.x, state.z, a.x, a.z) - distance(state.x, state.z, b.x, b.z));
  return targets.find(t => distance(state.x, state.z, t.x, t.z) < t.radius) || null;
}

function interact() {
  if (state.mode !== 'playing') return;
  const target = nearby();
  if (!target) return;
  if (target.type === 'custard') {
    target.obj.collected = true; target.obj.group.visible = false;
    state.collected++; audio.pickup();
    if (state.collected === 10) showToast('10 / 10. ¡VUELVE A LA ENTRADA DEL DOMO PARA ESCAPAR!', 7000);
    else if (state.collected === 3) showToast('ALGO HA DETECTADO TU PRESENCIA. NO TE DETENGAS.', 4600);
    else if (state.collected === 7) showToast('TINKY WINKY SE ESTÁ ACERCANDO...', 4300);
    else showToast(`${state.collected} / 10 NATILLAS RECUPERADAS`);
  } else if (target.type === 'battery') {
    target.obj.used = true; target.obj.group.visible = false;
    state.battery = clamp(state.battery + 44, 0, 100); audio.battery();
    showToast('BATERÍA RECOGIDA. LINTERNA RECARGADA.');
  } else if (target.type === 'body') {
    target.obj.inspected = true; audio.scareCue(); showToast(target.obj.message, 6000);
    const images = { 'Laa-Laa': 'laladead-0-71.png', 'Po': 'podead-0-57.png', 'Dipsy': 'dipsydead-0-87.png' };
    $('evidenceImage').src = `${assets}original/textures/${images[target.obj.name]}`;
    $('evidenceName').textContent = target.obj.name.toUpperCase();
    $('evidence').classList.remove('hidden');
    clearTimeout(state.evidenceTimeout);
    state.evidenceTimeout = setTimeout(() => $('evidence').classList.add('hidden'), 6000);
  } else if (target.type === 'exit') win();
  updateHud();
}

function move(dt) {
  let f = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - state.touch.y;
  let s = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0) + state.touch.x;
  const len = Math.hypot(f, s);
  if (len > 1) { f /= len; s /= len; }
  const moving = len > .07;
  const sprintHeld = held.has('ShiftLeft') || held.has('ShiftRight') || state.touch.sprint;
  const sprint = sprintHeld && moving && state.stamina > 1;
  state.stamina = clamp(state.stamina + dt * (sprint ? -18 : 13), 0, 100);
  if (moving) {
    const speed = sprint ? 6.5 : 3.65;
    forward.set(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    strafe.set(Math.cos(state.yaw), 0, Math.sin(state.yaw));
    const dx = (forward.x * f + strafe.x * s) * speed * dt;
    const dz = (forward.z * f + strafe.z * s) * speed * dt;
    const canStand = (x, z) => {
      if (Math.abs(x) > 82 || Math.abs(z) > 82) return false;
      if (world.collisions.some(c => distance(x, z, c.x, c.z) < c.radius + .35)) return false;
      const inCave = x > -34.1 && x < -25.9 && z < -22 && z > -58;
      if (inCave && (x < -33.1 || x > -26.9)) return false;
      return true;
    };
    if (canStand(state.x + dx, state.z)) state.x += dx;
    if (canStand(state.x, state.z + dz)) state.z += dz;
    state.moveTime += dt * (sprint ? 12 : 8);
    audio.step(sprint);
  }
  if (state.flashlight && state.battery > 0) {
    state.battery = clamp(state.battery - dt * .20, 0, 100);
    if (state.battery === 0) { state.flashlight = false; showToast('LA LINTERNA SE HA APAGADO. BUSCA BATERÍAS.'); }
  }
  const bob = moving ? Math.sin(state.moveTime) * (sprint ? .085 : .045) : 0;
  const targetY = heightAt(state.x, state.z) + state.playerHeight + bob;
  camera.position.set(state.x, THREE.MathUtils.lerp(camera.position.y || targetY, targetY, Math.min(1, dt * 13)), state.z);
  camera.rotation.set(state.pitch, state.yaw, moving ? Math.sin(state.moveTime * .5) * .008 : 0);
}

function updateEnemy(dt) {
  const enemy = world.enemy;
  const d = distance(state.x, state.z, enemy.x, enemy.z);
  const cave = state.x > -35 && state.x < -25 && state.z < -22 && state.z > -60;
  const detection = state.collected >= 3 ? 52 + state.collected * 2 : 16;
  const chase = d < detection || (cave && d < 65) || (state.collected >= 8 && d < 100);
  enemy.state = chase ? 'chase' : 'patrol';
  if (chase) {
    enemy.target.x = state.x; enemy.target.z = state.z;
  } else if (distance(enemy.x, enemy.z, enemy.target.x, enemy.target.z) < 2) {
    enemy.target.x = clamp(enemy.x + (Math.random() - .5) * 45, -73, 73);
    enemy.target.z = clamp(enemy.z + (Math.random() - .5) * 45, -73, 73);
  }
  const vx = enemy.target.x - enemy.x, vz = enemy.target.z - enemy.z;
  const length = Math.max(.001, Math.hypot(vx, vz));
  const speed = chase ? 2.08 + state.collected * .17 : .88;
  enemy.x += vx / length * dt * speed;
  enemy.z += vz / length * dt * speed;
  enemy.tick += dt * (chase ? 7.3 : 2.9);
  enemy.group.position.set(enemy.x, heightAt(enemy.x, enemy.z) + Math.abs(Math.sin(enemy.tick)) * .05, enemy.z);
  enemy.group.rotation.y = Math.atan2(vx, vz);
  enemy.leftArm.rotation.x = Math.sin(enemy.tick) * .41;
  enemy.rightArm.rotation.x = -Math.sin(enemy.tick) * .41;
  enemy.leftLeg.rotation.x = -Math.sin(enemy.tick) * .31;
  enemy.rightLeg.rotation.x = Math.sin(enemy.tick) * .31;
  enemy.eyeGlow.intensity = 1 + .7 * (1 + Math.sin(enemy.tick * 2));

  const threat = clamp(1 - d / 23, 0, .82);
  $('dangerFlash').style.opacity = threat.toFixed(2);
  if (d < 17) {
    state.heartClock -= dt;
    if (state.heartClock <= 0) { audio.heartbeat(); state.heartClock = Math.max(.6, d / 17 * 1.3); }
    if (d < 11 && state.dangerCooldown <= 0) { showToast('CORRE. NO MIRES ATRÁS.', 1900); state.dangerCooldown = 13; }
  }
  if (state.dangerCooldown > 0) state.dangerCooldown -= dt;
  if (d < 1.8) lose();

  state.enemyRelocateClock += dt;
  if (d > 75 && state.collected >= 2 && state.enemyRelocateClock > 25) {
    const angle = Math.random() * Math.PI * 2;
    enemy.x = clamp(state.x + Math.cos(angle) * 35, -72, 72);
    enemy.z = clamp(state.z + Math.sin(angle) * 35, -72, 72);
    state.enemyRelocateClock = 0;
  }
}

function lose() {
  if (state.mode !== 'playing') return;
  setMode('lost');
  $('jumpscare').classList.remove('hidden');
  audio.scream();
  $('endEyebrow').textContent = 'SEÑAL PERDIDA · AMENAZA CONFIRMADA';
  $('endTitle').textContent = 'TE ENCONTRÓ.';
  $('endTitle').className = 'danger-title';
  $('endMessage').textContent = 'Tinky Winky te encontró en la oscuridad. La expedición ha terminado.';
  finishStats();
  jumpTimeout = setTimeout(() => $('jumpscare').classList.add('hidden'), 1450);
}

function win() {
  if (state.mode !== 'playing') return;
  audio.pickup();
  const best = Number(localStorage.getItem('slendynight_best_seconds') || 0);
  if (!best || state.elapsed < best) localStorage.setItem('slendynight_best_seconds', String(Math.floor(state.elapsed)));
  $('endEyebrow').textContent = 'TRANSMISIÓN COMPLETADA · AMANECER';
  $('endTitle').textContent = 'SOBREVIVISTE.';
  $('endTitle').className = 'win-title';
  $('endMessage').textContent = 'Recuperaste las diez natillas, exploraste la noche y lograste regresar al domo.';
  finishStats(); setMode('won');
}

function finishStats() {
  $('endCount').textContent = `${state.collected} / 10`;
  $('endTime').textContent = formatTime(state.elapsed);
  const best = Number(localStorage.getItem('slendynight_best_seconds') || 0);
  $('endBest').textContent = best ? formatTime(best) : '—';
}

function drawMap() {
  const canvas = $('mapCanvas'), ctx = canvas.getContext('2d');
  const W = canvas.width, S = W / 170;
  ctx.fillStyle = '#0c1d1c'; ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = '#223b36'; ctx.lineWidth = 1;
  for (let i = -80; i <= 80; i += 10) {
    const p = W / 2 + i * S;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
  }
  const mark = (x, z, color, r = 3) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(W / 2 + x * S, W / 2 + z * S, r, 0, Math.PI * 2); ctx.fill(); };
  for (const tree of world.collisions) {
    if (tree.radius > 1.6) continue;
    mark(tree.x, tree.z, '#1b3c2c', 1.3);
  }
  ctx.strokeStyle = '#a5a46d'; ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 + 14 * S, W / 2 - 10 * S, 8 * S, 8 * S);
  ctx.strokeStyle = '#789b9a';
  ctx.beginPath(); ctx.moveTo(W / 2 - 30 * S, W / 2 - 21 * S); ctx.lineTo(W / 2 - 30 * S, W / 2 - 58 * S); ctx.stroke();
  for (const c of world.custards) if (!c.collected) mark(c.x, c.z, '#fa72af', 4);
  for (const b of world.batteries) if (!b.used) mark(b.x, b.z, '#abd9b6', 3);
  for (const b of world.bodies) mark(b.x, b.z, '#ae6063', 3);
  const px = W / 2 + state.x * S, py = W / 2 + state.z * S;
  ctx.save(); ctx.translate(px, py); ctx.rotate(state.yaw);
  ctx.fillStyle = '#ecf5d2'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-6, 7); ctx.lineTo(6, 7); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#c7ddbb66'; ctx.strokeRect(1, 1, W - 2, W - 2);
  $('coords').textContent = `X ${Math.round(state.x)} / Z ${Math.round(state.z)}`;
}

function updateLook(dx, dy, sensitivity = .00235) {
  state.yaw -= dx * sensitivity;
  state.pitch = clamp(state.pitch - dy * sensitivity, -1.38, 1.38);
}

function animate(t) {
  requestAnimationFrame(animate);
  const dt = Math.min((t - lastFrame) / 1000, .065); lastFrame = t;
  if (state.mode === 'playing') {
    state.elapsed += dt;
    move(dt);
    updateEnemy(dt);
    world.custards.forEach(c => { if (!c.collected) { c.group.position.y = c.baseY + Math.sin(t * .002 + c.index) * .07; c.group.rotation.y += dt * .42; } });
    world.batteries.forEach(b => { if (!b.used) b.group.rotation.y += dt * .36; });
    world.fogWisps.forEach(w => { w.mesh.position.x += Math.sin(t * .00016 + w.phase) * dt * .18; });
    const n = nearby();
    if (n !== state.lastNear) {
      state.lastNear = n;
      $('interaction').classList.toggle('hidden', !n);
      if (n) $('interactionText').textContent = n.label;
    }
    if (state.showMap) drawMap();
    updateHud();
  } else if (state.mode === 'menu') {
    camera.position.set(1.5, heightAt(1.5, 15) + 1.7 + Math.sin(t * .0004) * .1, 15);
    camera.rotation.set(-.07, -.18 + Math.sin(t * .00016) * .14, 0);
  }
  renderer.render(scene, camera);
}

function bindClick(id, fn) { $(id).addEventListener('click', fn); }
bindClick('startButton', start);
bindClick('resumeButton', resume);
bindClick('retryButton', start);
bindClick('pauseRestart', start);
bindClick('pauseButton', pause);
bindClick('mobilePause', pause);
bindClick('pauseMenu', () => setMode('menu'));
bindClick('endMenu', () => setMode('menu'));
bindClick('howButton', () => {
  const panel = $('menuControls');
  panel.style.color = '#f3f1ba';
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('WASD: MOVER · RATÓN: MIRAR · SHIFT: CORRER · E: INTERACTUAR · F: LUZ · M: MAPA', 5000);
});
bindClick('muteButton', () => { state.muted = !state.muted; audio.setMuted(state.muted); updateHud(); });
bindClick('fullButton', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

async function handleAudioFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const name = await audio.setScreamFile(file);
    $('audioStatus').textContent = `GRITO CARGADO: ${name}`;
    $('pauseAudioStatus').textContent = `LISTO: ${name}`;
  } catch (err) {
    $('audioStatus').textContent = err.message;
    $('pauseAudioStatus').textContent = err.message;
  }
}
$('audioInput').addEventListener('change', handleAudioFile);
$('pauseAudioInput').addEventListener('change', handleAudioFile);

document.addEventListener('keydown', event => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  if (event.repeat && ['KeyE', 'KeyF', 'KeyM', 'Escape'].includes(event.code)) return;
  held.add(event.code);
  if (event.code === 'Escape') { state.mode === 'playing' ? pause() : state.mode === 'paused' ? resume() : null; }
  if (event.code === 'KeyE') interact();
  if (event.code === 'KeyF') toggleFlash();
  if (event.code === 'KeyM') toggleMap();
});
document.addEventListener('keyup', event => held.delete(event.code));
window.addEventListener('blur', () => { held.clear(); if (state.mode === 'playing' && !isTouch) pause(); });
document.addEventListener('mousemove', event => {
  if (state.mode === 'playing' && document.pointerLockElement === renderer.domElement) updateLook(event.movementX, event.movementY);
});
document.addEventListener('pointerlockchange', () => {
  if (!isTouch && state.mode === 'playing' && document.pointerLockElement !== renderer.domElement) pause();
});
renderer.domElement.addEventListener('click', () => {
  if (state.mode === 'playing' && !isTouch && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
});

bindClick('touchInteract', interact);
bindClick('touchFlash', toggleFlash);
bindClick('touchMap', toggleMap);
const sprintButton = $('touchSprint');
sprintButton.addEventListener('pointerdown', e => { e.preventDefault(); state.touch.sprint = true; sprintButton.setPointerCapture(e.pointerId); });
const stopSprint = () => { state.touch.sprint = false; };
sprintButton.addEventListener('pointerup', stopSprint);
sprintButton.addEventListener('pointercancel', stopSprint);
const joystick = $('joystick'), knob = $('joystickKnob');
let stickId = null;
function updateStick(e) {
  const box = joystick.getBoundingClientRect();
  const dx = e.clientX - (box.left + box.width / 2), dy = e.clientY - (box.top + box.height / 2);
  const length = Math.max(1, Math.hypot(dx, dy));
  const radius = Math.min(length, 44);
  state.touch.x = dx / length * radius / 44;
  state.touch.y = dy / length * radius / 44;
  knob.style.transform = `translate(${state.touch.x * 44}px,${state.touch.y * 44}px)`;
}
joystick.addEventListener('pointerdown', e => { e.preventDefault(); stickId = e.pointerId; joystick.setPointerCapture(e.pointerId); updateStick(e); });
joystick.addEventListener('pointermove', e => { if (stickId === e.pointerId) updateStick(e); });
function releaseStick(e) { if (stickId !== e.pointerId) return; stickId = null; state.touch.x = 0; state.touch.y = 0; knob.style.transform = ''; }
joystick.addEventListener('pointerup', releaseStick);
joystick.addEventListener('pointercancel', releaseStick);
let lookTouch = null, lastTouchX = 0, lastTouchY = 0;
renderer.domElement.addEventListener('pointerdown', e => {
  if (!isTouch || state.mode !== 'playing' || e.pointerType !== 'touch' || e.clientX < window.innerWidth * .35) return;
  lookTouch = e.pointerId; lastTouchX = e.clientX; lastTouchY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (lookTouch !== e.pointerId || state.mode !== 'playing') return;
  updateLook(e.clientX - lastTouchX, e.clientY - lastTouchY, .0053);
  lastTouchX = e.clientX; lastTouchY = e.clientY;
});
function releaseLook(e) { if (lookTouch === e.pointerId) lookTouch = null; }
renderer.domElement.addEventListener('pointerup', releaseLook);
renderer.domElement.addEventListener('pointercancel', releaseLook);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

reset(); setMode('menu'); requestAnimationFrame(animate);
