// Boot and the one loop: Solmar Bay runs on a fixed 1/60 s step, the renderer paints
// what is there, and the game moves between title, play, paused, wasted and busted.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|combat (with
// &seed=N) stages that scene instead of running the loop, paints it a few times and
// sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPeople } from './people.js';
import { createPlayer } from './player.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { readSave, writeSave } from './save.js';
import { stageShot, stageShotCamera } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const screenEl = document.getElementById('screen');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);
camera.position.set(0, 40, -120);

const G = {
  time: 0,
  screen: 'title',
  seed,
  scene,
  camera,
  renderer,
};
G.rng = createRandom(seed);
G.input = createInput(canvas);
G.audio = createAudio();
G.city = createCity(scene, G.rng);
G.vehicles = createVehicles(G);
G.people = createPeople(G);
G.player = createPlayer(G);
G.combat = createCombat(G);
G.police = createPolice(G);
G.missions = createMissions(G);
G.hud = createHud(G);
window.__game = G;

function saveGame() {
  const done = [];
  for (let i = 0; i < G.missions.index; i++) done.push(i);
  writeSave({
    money: G.player.money,
    missionsDone: done,
    weapons: G.player.ownedWeapons,
    px: G.player.pos.x,
    pz: G.player.pos.z,
  });
}
G.saveGame = saveGame;

function gameOver(kind) {
  if (G.screen !== 'play') return;
  G.police.clearWanted();
  const fine = kind === 'busted' ? 150 : 200;
  G.player.money = Math.max(0, G.player.money - fine);
  saveGame();
  G.input.unlockPointer();
  if (kind === 'busted') {
    G.screen = 'busted';
    showScreen('BUSTED', 'The Solmar PD caught you.', `You paid $${fine} in fines. Press Enter to walk out of the station.`, 'busted');
    announce('Busted. The police caught you.');
  } else {
    G.screen = 'wasted';
    showScreen('WASTED', 'Rico went down in the streets of Solmar Bay.', `You lost $${fine}. Press Enter to wake up at St. Marina Hospital.`, 'wasted');
    announce('Wasted.');
  }
  G.audio.missionFail();
}
G.gameOver = gameOver;

function announce(message) { statusEl.textContent = message; }

function showScreen(title, story, cta, kind) {
  screenEl.style.display = 'flex';
  if (kind === 'title') {
    const save = readSave();
    const hasSave = save && (save.missionsDone.length > 0 || save.money > 250);
    screenEl.innerHTML = `
      <h1>SOLMAR BAY</h1>
      <h2>AN OPEN-WORLD CRIME STORY</h2>
      <p class="story">Rico Vega is home after three years away, and Solmar Bay has not gotten any
      kinder. Mama Lucia needs a driver, Dante needs muscle, and the whole city is for
      sale to whoever is fast enough to take it. Steal cars, outrun the law, and pull
      off the Big Score.</p>
      <div class="cta">${hasSave ? 'Press Enter — Continue your story' : 'Press Enter — Start a new story'}</div>
      <div class="keys"><b>WASD</b> move / drive &nbsp;·&nbsp; <b>Mouse</b> look &nbsp;·&nbsp; <b>E</b> steal / enter car &nbsp;·&nbsp; <b>F</b> interact
      <br><b>Click</b> shoot &nbsp;·&nbsp; <b>R</b> reload &nbsp;·&nbsp; <b>Q</b> switch weapon &nbsp;·&nbsp; <b>Shift</b> run / handbrake &nbsp;·&nbsp; <b>Space</b> jump &nbsp;·&nbsp; <b>P</b> pause &nbsp;·&nbsp; <b>M</b> mute</div>`;
  } else {
    screenEl.innerHTML = `<div class="big">${title}</div><div class="sub">${story}</div><p class="story">${cta}</p>`;
  }
}

function hideScreen() { screenEl.style.display = 'none'; }

function startGame(continueSave) {
  const save = continueSave ? readSave() : null;
  G.audio.unlock();
  G.audio.click();
  if (save) {
    G.player.money = save.money;
    G.player.ownedWeapons = save.weapons && save.weapons.length ? save.weapons : ['fists', 'pistol'];
    if (save.weapons.includes('smg')) G.player.weapon = 'pistol';
    G.player.pos.set(save.px, 0, save.pz);
    G.missions.applySave(save.missionsDone);
    G.hud.toast('Welcome back to Solmar Bay.');
    if (save.missionsDone.length < 5) G.missions.startMission(save.missionsDone.length);
  } else {
    G.player.money = 250;
    G.player.pos.set(0, 0, -40);
    G.missions.startFirst();
  }
  G.screen = 'play';
  hideScreen();
  G.hud.show();
  G.input.lockPointer();
  announce('Playing. Follow the yellow marker.');
}

function update(dt) {
  G.time += dt;
  const input = G.input;
  const p = G.player;
  if (G.screen === 'title') {
    // The city lives behind the title: traffic drives, people walk, the camera orbits.
    G.vehicles.update(dt, input);
    G.people.updatePeds(dt);
    const a = G.time * 0.05;
    camera.position.set(Math.sin(a) * 200, 52, 330 - Math.cos(a) * 130);
    camera.lookAt(0, 12, 300);
    G.city.wheel.rotation.z += dt * 0.12;
    G.city.ocean.position.y = 0.4 + Math.sin(G.time * 0.5) * 0.15;
    return;
  }
  if (G.screen !== 'play') return;
  if (input.wasPressed('pause')) {
    G.screen = 'paused';
    showScreen('PAUSED', 'Solmar Bay waits for you.', 'Press P or Enter to keep playing.', 'paused');
    G.input.unlockPointer();
    announce('Paused.');
    return;
  }
  if (!p.car) p.updateOnFoot(dt, input);
  if (input.wasPressed('enter')) p.tryEnterCar();
  G.vehicles.update(dt, input);
  G.people.updatePeds(dt);
  G.people.updateOfficers(dt, p.pos);
  G.police.update(dt);
  G.combat.update(dt, input);
  G.missions.update(dt, input);
  p.updateCamera(dt);
  G.city.wheel.rotation.z += dt * 0.12;
  G.city.ocean.position.y = 0.4 + Math.sin(G.time * 0.5) * 0.15;
  // Health comes back slowly when the player has been safe for a while.
  if (G.time - p.lastDamageAt > 12 && p.health > 0 && p.health < p.maxHealth) {
    p.heal(4 * dt);
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  accumulator += dt;
  while (accumulator >= STEP) {
    update(STEP);
    accumulator -= STEP;
  }
  if (G.screen === 'play' || G.screen === 'title') G.hud.update();
  G.input.endFrame();
  renderer.render(scene, camera);
}

function runShot(name) {
  const screen = stageShot(G, name);
  if (name === 'start') showScreen('', '', '', 'title');
  else hideScreen();
  let painted = 0;
  function paint() {
    // Let the staged scene settle: traffic rolls, police close in, the camera finds its place.
    for (let i = 0; i < 3; i++) {
      if (screen === 'play') {
        update(STEP);
        G.hud.update();
      }
      stageShotCamera(G, name, painted * 0.4);
    }
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 4) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  showScreen('', '', '', 'title');
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') {
      const muted = G.audio.toggleMute();
      G.hud.toast(muted ? 'Sound off.' : 'Sound on.');
    }
  });
  canvas.addEventListener('click', () => {
    if (G.screen === 'play') G.input.lockPointer();
  });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Enter' && event.code !== 'Space') return;
    if (G.screen === 'title') {
      const save = readSave();
      startGame(!!(save && (save.missionsDone.length > 0 || save.money > 250)));
    } else if (G.screen === 'paused') {
      G.screen = 'play';
      hideScreen();
      G.input.lockPointer();
      announce('Playing.');
    } else if (G.screen === 'wasted' || G.screen === 'busted') {
      G.player.respawn();
      G.screen = 'play';
      hideScreen();
      G.hud.show();
      G.input.lockPointer();
      announce('Back on the streets.');
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyP' && G.screen === 'paused') {
      G.screen = 'play';
      hideScreen();
      G.input.lockPointer();
      announce('Playing.');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') {
      G.screen = 'paused';
      showScreen('PAUSED', 'Solmar Bay waits for you.', 'Press P or Enter to keep playing.', 'paused');
      G.input.unlockPointer();
    }
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  announce('Solmar Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
