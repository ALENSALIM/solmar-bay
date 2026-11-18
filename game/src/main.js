// Solmar Bay: wiring, game loop, menus and test hooks.
import * as THREE from 'three';
import { makeRng } from './random.js';
import { loadSave, writeSave } from './save.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity } from './city.js';
import { Traffic, curbSpots } from './vehicles.js';
import { People } from './people.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '20261118', 10);
const fast = params.get('fast') === '1';
const shot = params.get('shot') || '';
const rng = makeRng(seed);

// Renderer, scene, camera, lights.
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x87b5d6, 150, 480);
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(120, 50, 120);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a5a4a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.8);
sun.position.set(150, 220, 80);
scene.add(sun);

// Shared game object.
const G = {
  scene, camera, renderer, rng,
  mode: 'title', time: 0, autoFire: false, autoDrive: false,
  state: { money: 500, missionsDone: 0, smgUnlocked: false, best: 0 },
};

const input = new Input();
input.attach(renderer.domElement);
G.input = input;
const audio = new AudioSys();
G.audio = audio;

const saved = loadSave();
if (saved) {
  G.state.money = saved.money;
  G.state.missionsDone = saved.missionsDone;
  G.state.smgUnlocked = saved.smgUnlocked;
  G.state.best = saved.best;
}

const city = buildCity(scene, rng);
G.city = city;

const traffic = new Traffic(scene, rng, city);
traffic.spawnTraffic(24);
const parkedSpots = curbSpots(rng, 9);
const goldSpot = { x: city.goldCarPos.x, z: city.goldCarPos.z, heading: 0 };
parkedSpots.push(goldSpot);
const parked = traffic.spawnParked(parkedSpots);
const goldCar = parked[parked.length - 1];
goldCar.isGold = true;
goldCar.group.children[0].material.color.set(0xffd23c);
G.traffic = traffic;
G.goldCar = goldCar;

const people = new People(scene, rng, city, (dmg) => player.damage(dmg));
people.spawnPeds(18);
G.people = people;

const player = new Player(scene, rng, city, input, traffic, audio, {
  onJacked: () => {
    police.addWanted(1);
    hud.toast('Car jacked! Wanted level up');
  },
  onDied: () => bust('wasted'),
});
G.player = player;

const combat = new Combat(scene, camera, audio, people, () => {
  police.addWanted(1);
  hud.toast('Wanted level up');
});
G.combat = combat;

const police = new Police(scene, rng, city, traffic, audio,
  (dmg) => player.damage(dmg),
  () => bust('busted'));
G.police = police;

const hud = new HUD();
G.hud = hud;

const missions = new MissionManager(G);
G.missions = missions;

G.saveProgress = () => {
  G.state.best = Math.max(G.state.best, G.state.money);
  writeSave({
    money: G.state.money,
    missionsDone: missions.index,
    smgUnlocked: G.state.smgUnlocked,
    best: G.state.best,
  });
};
G.onReward = (amount) => {
  G.state.money += amount;
  G.state.best = Math.max(G.state.best, G.state.money);
  audio.cash();
  G.saveProgress();
};
G.onSmgUnlocked = () => {
  G.state.smgUnlocked = true;
  hud.toast('SMG unlocked! Press Q to switch weapon');
  G.saveProgress();
};
G.onAllDone = () => {
  hud.toast('Story complete! Solmar Bay is yours \u2014 free roam');
  G.saveProgress();
};

// Menus and game flow.
function bust(kind) {
  if (G.mode !== 'playing') return;
  const fine = Math.min(100, G.state.money);
  G.state.money -= fine;
  G.saveProgress();
  G.mode = kind;
  input.exitPointerLock();
  document.getElementById(`${kind}-fine`).textContent = `$${fine}`;
  hud.showScreen(kind);
  if (kind === 'busted') audio.busted();
  else audio.wasted();
  police.clearAll();
}

function respawn() {
  player.resetToHome();
  G.mode = 'playing';
  hud.showScreen('playing');
  G.saveProgress();
}

function startGame(newGame) {
  if (newGame) {
    G.state.money = 500;
    G.state.missionsDone = 0;
    G.state.smgUnlocked = false;
    combat.ammo = { pistol: 12, smg: 30 };
    combat.current = 'pistol';
  }
  player.resetToHome();
  police.clearAll();
  people.clearEnemies();
  G.mode = 'playing';
  hud.showScreen('playing');
  audio.ensure();
  audio.startMusic();
  missions.startMission(G.state.missionsDone);
  G.saveProgress();
}
G.startGame = startGame;

function togglePause() {
  if (G.mode === 'playing') {
    G.mode = 'paused';
    hud.showScreen('paused');
    input.exitPointerLock();
  } else if (G.mode === 'paused') {
    G.mode = 'playing';
    hud.showScreen('playing');
  }
}

input.onPress('KeyE', () => {
  if (G.mode !== 'playing') return;
  if (player.inCar) player.exitCar();
  else {
    const car = player.tryEnterCar();
    if (car && car.isGold) hud.toast('Gold car stolen! Deliver it to the garage');
  }
});
input.onPress('KeyQ', () => {
  if (G.mode !== 'playing') return;
  if (combat.switchWeapon(G.state.smgUnlocked)) {
    hud.toast(`Weapon: ${combat.weapon.name}`);
  } else {
    hud.toast('Finish mission 3 to unlock the SMG');
    audio.denied();
  }
});
input.onPress('KeyR', () => { if (G.mode === 'playing') combat.startReload(); });
input.onPress('KeyP', () => togglePause());
input.onPress('Escape', () => { if (G.mode === 'playing') togglePause(); });
input.onPress('KeyM', () => {
  const muted = audio.toggleMute();
  hud.toast(muted ? 'Sound off' : 'Sound on');
});
input.onPress('Enter', () => {
  if (G.mode === 'title') startGame(!saved);
  else if (G.mode === 'paused') togglePause();
  else if (G.mode === 'busted' || G.mode === 'wasted') respawn();
});
input.onAnyKey(() => audio.ensure());

document.getElementById('btn-new').addEventListener('click', () => { audio.ensure(); startGame(true); });
document.getElementById('btn-continue').addEventListener('click', () => { audio.ensure(); startGame(false); });
document.getElementById('btn-resume').addEventListener('click', () => togglePause());
document.getElementById('btn-quit').addEventListener('click', () => {
  G.mode = 'title';
  hud.showScreen('title');
  refreshTitle();
});
document.getElementById('btn-respawn').addEventListener('click', () => respawn());
document.getElementById('btn-respawn2').addEventListener('click', () => respawn());

function refreshTitle() {
  document.getElementById('title-best').textContent = `$${Math.max(G.state.best, 0).toLocaleString('en-US')}`;
  document.getElementById('btn-continue').classList.toggle('hidden', !saved || saved.missionsDone === 0);
}
refreshTitle();
hud.showScreen('title');

// Camera follow with smoothing.
const camPos = new THREE.Vector3(120, 50, 120);
const camTarget = new THREE.Vector3(0, 5, 0);
const tmpV = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

function updateCamera(dt) {
  let px, py, pz, tx, ty, tz;
  if (G.mode === 'title') {
    const t = G.time * 0.045;
    px = Math.cos(t) * 175; py = 58; pz = Math.sin(t) * 175;
    tx = 0; ty = 4; tz = 0;
  } else if (player.inCar) {
    const car = player.inCar;
    const fx = Math.cos(car.heading);
    const fz = -Math.sin(car.heading);
    px = car.pos.x - fx * 11; py = 4.8; pz = car.pos.z - fz * 11;
    tx = car.pos.x + fx * 10; ty = 1.6; tz = car.pos.z + fz * 10;
  } else {
    const fx = Math.sin(player.camYaw);
    const fz = -Math.cos(player.camYaw);
    const dist = 7.5 * Math.cos(player.camPitch);
    px = player.pos.x - fx * dist;
    py = player.pos.y + 2.4 + Math.sin(player.camPitch) * 7.5;
    pz = player.pos.z - fz * dist;
    tx = player.pos.x + fx * 2;
    ty = player.pos.y + 1.7;
    tz = player.pos.z + fz * 2;
  }
  const k = 1 - Math.exp(-9 * dt);
  camPos.x += (px - camPos.x) * k;
  camPos.y += (py - camPos.y) * k;
  camPos.z += (pz - camPos.z) * k;
  camTarget.x += (tx - camTarget.x) * k;
  camTarget.y += (ty - camTarget.y) * k;
  camTarget.z += (tz - camTarget.z) * k;
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

// Main loop.
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  city.wheel.rotation.z -= dt * 0.25;
  if (G.mode === 'title') {
    traffic.update(dt, null);
    people.update(dt, player.pos, false);
  } else if (G.mode === 'playing') {
    player.update(dt, true);
    traffic.update(dt, player.inCar);
    people.update(dt, player.inCar ? player.inCar.pos : player.pos, true);
    police.update(dt, player.inCar ? player.inCar.pos : player.pos, !!player.inCar, Math.abs(player.carSpeed), player.health > 0);
    combat.update(dt);
    missions.update(dt);
    if (police.wanted === 0) player.regen(dt);
    // Shooting: mouse click or held trigger, or auto-fire for the combat shot.
    if (!player.inCar) {
      const freshClick = input.consumeClick();
      const held = input.mouseHeld;
      if (freshClick || held || G.autoFire) {
        let dir;
        if (G.autoFire) {
          let best = null;
          let bestD = Infinity;
          for (const e of people.enemies) {
            if (!e.alive) continue;
            const d = e.pos.distanceTo(player.pos);
            if (d < bestD) { bestD = d; best = e; }
          }
          if (best) {
            tmpV.set(best.pos.x, 1.2, best.pos.z);
            dir = tmpV.clone().sub(camera.position).normalize();
          } else {
            dir = camera.getWorldDirection(tmpDir);
          }
        } else {
          dir = camera.getWorldDirection(tmpDir);
        }
        const origin = camera.position.clone().add(dir.clone().multiplyScalar(1.2));
        combat.tryFire(origin, dir, freshClick || G.autoFire);
      }
    }
    // HUD.
    hud.setMoney(G.state.money);
    hud.setWanted(police.wanted);
    hud.setHealth(player.health);
    hud.setWeapon(combat.weapon.name, combat.ammo[combat.current], combat.weapon.mag, combat.reloading > 0);
    const speedKmh = player.inCar ? Math.abs(player.carSpeed) * 3.6 : 0;
    hud.setSpeed(speedKmh);
    const obj = missions.objective;
    let dist = null;
    if (obj && obj.pos) {
      const p = player.inCar ? player.inCar.pos : player.pos;
      dist = Math.hypot(p.x - obj.pos.x, p.z - obj.pos.z);
    }
    hud.setObjective(missions.currentText(), dist);
    hud.updateMinimap(G);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Test and screenshot hooks.
window.__game = {
  G, player, police, missions, combat, traffic, people, hud,
  get mode() { return G.mode; },
  get money() { return G.state.money; },
  get missionsDone() { return missions.index; },
  startGame,
  setWanted(n) { police.setWanted(n); },
  teleport(x, z) {
    player.pos.set(x, 0, z);
    if (player.inCar) player.inCar.pos.set(x, 0, z);
  },
  unlockSMG() { G.state.smgUnlocked = true; },
  aimAt(x, y, z) {
    // Yaw so the camera looks toward the target horizontally.
    tmpV.set(x, y, z).sub(camera.position);
    const yaw = Math.atan2(tmpV.x, -tmpV.z);
    player.camYaw = yaw;
    // Pitch so the camera's forward actually points at the target: the
    // camera sits ~7.5u behind the player and looks at a point 2u ahead at
    // height 1.7, so solve the pitch that matches the target's angle.
    const dx = x - player.pos.x, dz = z - player.pos.z;
    const horiz = Math.hypot(dx, dz);
    let lo = -0.15, hi = 0.85;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      const py = 2.4 + Math.sin(mid) * 7.5;
      const lookAngle = Math.atan2(py - 1.7, 7.5 * Math.cos(mid) + 2);
      const targetAngle = Math.atan2(py - y, horiz + 7.5 * Math.cos(mid));
      if (lookAngle < targetAngle) lo = mid; else hi = mid;
    }
    player.camPitch = (lo + hi) / 2;
  },
};

if (shot) applyShot(G, shot);
else if (fast) startGame(false);

requestAnimationFrame(frame);
