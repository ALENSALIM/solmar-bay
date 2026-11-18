// Solmar Bay — wires the whole game together: renderer, camera, game loop,
// state machine (title / playing / paused / busted / wasted), and the
// debug handle the play test drives.
import * as THREE from 'three';
import { makeRng } from './random.js';
import { loadSave, writeSave } from './save.js';
import { makeInput, attachInput, endFrame, wasPressed } from './input.js';
import { makeAudio, initAudio, setEngine } from './audio.js';
import { buildCity, updateCity } from './city.js';
import { spawnPedestrians, updatePedestrians } from './people.js';
import { spawnTraffic, spawnParked, updateTraffic } from './vehicles.js';
import { makePlayer, updatePlayer } from './player.js';
import { makeWeapons, updateCombat, updateTracers } from './combat.js';
import { makePolice, updatePolice } from './police.js';
import { makeMissions, startMission, updateMissions } from './missions.js';
import { buildHud, updateHud, showScreen } from './hud.js';
import { stageShot, installDebugApi } from './shots.js';

const params = new URLSearchParams(window.location.search);
const FAST = params.get('fast') === '1';
const SEED = parseInt(params.get('seed') || '20261118', 10);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !FAST, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, FAST ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !FAST;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x9fc3dd, 220, 700);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(200, 60, 0);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.7);
sun.position.set(140, 190, 70);
sun.castShadow = !FAST;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -220;
sun.shadow.camera.right = 420;
sun.shadow.camera.top = 220;
sun.shadow.camera.bottom = -220;
sun.shadow.camera.far = 600;
scene.add(sun);

// The world object every module shares.
const W = {
  renderer, scene, camera, canvas,
  rng: makeRng(SEED),
  fast: FAST,
  state: 'title',
  time: 0,
  money: 250,
  wanted: 0,
  weapon: 'pistol',
  weapons: makeWeapons(),
  nextShotAt: 0,
  reloadAt: 0,
  lastShotCrimeAt: -99,
  lastCrimeAt: -99,
  lastFine: 0,
  events: [],
  tracers: [],
  enemies: [],
  frames: 0,
  consoleErrors: [],
  camYaw: Math.PI,
  camPitch: 0.32,
  camDist: 7.5,
  hudFlash: '',
  hudFlashAt: -99,
  saveData: loadSave(),
};
W.input = makeInput();
W.audio = makeAudio();
attachInput(W.input, canvas);
window.addEventListener('error', (e) => W.consoleErrors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => W.consoleErrors.push(String(e.reason)));

W.money = W.saveData.money;
W.weapons.smg.unlocked = !!W.saveData.smgUnlocked;

buildCity(W);
spawnTraffic(W, 24);
spawnParked(W, 14);
spawnPedestrians(W, 18);
makePlayer(W);
makePolice(W);
makeMissions(W);
buildHud(W);
updateHud(W);
W.missions.index = W.saveData.missionsDone.length;
if (W.saveData.missionsDone.length > 0) {
  const cont = document.getElementById('title-continue');
  if (cont) cont.textContent = `Press ENTER to continue — ${W.saveData.missionsDone.length} job${W.saveData.missionsDone.length > 1 ? 's' : ''} done`;
}

function startGame() {
  initAudio(W.audio);
  W.state = 'playing';
  showScreen(W, 'playing');
  if (!W.missions.active && W.missions.index < 5) {
    startMission(W, W.missions.index);
  }
}
W.startGame = startGame;

function resumeAfterBust() {
  W.state = 'playing';
  showScreen(W, 'playing');
}

// Camera: third person. On foot the mouse steers it freely; in a car it
// trails behind the car and the mouse can look around.
function updateCamera(dt) {
  if (W.state === 'title') {
    const t = W.time * 0.05;
    camera.position.set(Math.sin(t) * 200 + 60, 62, Math.cos(t) * 200);
    camera.lookAt(60, 8, 0);
    return;
  }
  const p = W.player;
  const target = new THREE.Vector3(p.pos.x, p.pos.y + 1.7, p.pos.z);
  const input = W.input;
  if (p.inCar) {
    const carYaw = p.inCar.mesh.rotation.y;
    let diff = (carYaw + Math.PI) - W.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    W.camYaw += diff * Math.min(1, dt * 2.2);
    W.camYaw -= input.mouseDX * 0.0032;
    W.camDist = 11;
  } else {
    W.camYaw -= input.mouseDX * 0.0032;
    W.camDist = 7.5;
  }
  // Pitch floor matches aimAt's clamp, so the camera can actually aim at a
  // chest-height target at any range (a higher floor shoots over heads).
  W.camPitch = Math.max(0.02, Math.min(1.0, W.camPitch + input.mouseDY * 0.0032));
  if (input.wheel !== 0) {
    W.camDist = Math.max(5, Math.min(14, W.camDist + input.wheel * 0.004));
  }
  const off = new THREE.Vector3(
    Math.sin(W.camYaw) * Math.cos(W.camPitch),
    Math.sin(W.camPitch),
    Math.cos(W.camYaw) * Math.cos(W.camPitch)
  ).multiplyScalar(W.camDist);
  const want = target.clone().add(off);
  camera.position.lerp(want, Math.min(1, dt * 9));
  camera.lookAt(target);
}

let prevState = W.state;
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  W.frames++;
  const dt = Math.min(clock.getDelta(), 0.25);
  W.time += dt;
  const input = W.input;

  // State transitions.
  if (W.state === 'title' && wasPressed(input, 'Enter')) startGame();
  else if (W.state === 'paused' && (wasPressed(input, 'KeyP') || wasPressed(input, 'Enter'))) {
    W.state = 'playing';
    showScreen(W, 'playing');
  } else if ((W.state === 'busted' || W.state === 'wasted') && wasPressed(input, 'Enter')) {
    resumeAfterBust();
  } else if (W.state === 'playing' && wasPressed(input, 'KeyP')) {
    W.state = 'paused';
    showScreen(W, 'paused');
  }
  // Wasted fine, applied once on the transition.
  if (W.state === 'wasted' && prevState !== 'wasted') {
    W.money = Math.max(0, W.money - 100);
    W.saveData = { money: W.money, missionsDone: W.missions.defs.slice(0, W.missions.index).map((m) => m.id), smgUnlocked: W.weapons.smg.unlocked, best: Math.max(W.saveData.best || 0, W.money) };
    writeSave(W.saveData);
    showScreen(W, 'wasted');
  }
  if (W.state === 'busted' && prevState !== 'busted') showScreen(W, 'busted');
  prevState = W.state;

  if (W.state === 'playing') {
    updatePlayer(W, dt);
    // Camera first, so combat shoots along this frame's view direction.
    updateCamera(dt);
    updateCombat(W, dt);
    updatePolice(W, dt);
    updateMissions(W, dt);
    setEngine(W.audio, W.player.inCar ? Math.abs(W.player.carSpeed) / 30 : 0);
  }
  // Ambient life runs in every state so the title screen feels alive.
  updateTraffic(W, dt);
  updatePedestrians(W, dt);
  updateCity(W, dt);
  updateTracers(W, dt);
  if (W.state !== 'playing') updateCamera(dt);
  if (W.state === 'playing' || W.state === 'paused') updateHud(W);
  renderer.render(scene, camera);
  endFrame(input);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

stageShot(W);
installDebugApi(W);
frame();
