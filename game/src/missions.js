// Story missions for Rico Vega. Five jobs, each with a cash reward; mission 3
// unlocks the SMG. A glowing beacon marks the current objective, and the
// HUD shows its name and distance. Progress is saved to localStorage.
import * as THREE from 'three';
import { spawnEnemy, clearEnemies } from './combat.js';
import { playChime } from './audio.js';
import { writeSave } from './save.js';
import { makeCarMesh } from './vehicles.js';

export const MISSION_DEFS = [
  {
    id: 0, name: 'Welcome Home', reward: 200,
    intro: 'Rico is back in Solmar Bay. Meet your old friend Marco at the pier.',
    target: { x: 184, z: 0 }, radius: 6,
  },
  {
    id: 1, name: 'The Pickup', reward: 500,
    intro: 'Marco stashed a package across town. Drive over and grab it.',
    target: { x: -108, z: -108 }, radius: 6,
  },
  {
    id: 2, name: 'Street Heat', reward: 1500,
    intro: 'Rival crew is holding the park. Clear them out.',
    target: { x: 36, z: 36 }, radius: 26, kills: 4,
  },
  {
    id: 3, name: 'Grand Larceny', reward: 3000,
    intro: 'A gold coupe is parked uptown. Steal it and bring it to the garage.',
    target: { x: 144, z: -108 }, radius: 6, stealCar: true,
    deliver: { x: -144, z: 108 }, deliverRadius: 8,
  },
  {
    id: 4, name: 'The Big Score', reward: 5000,
    intro: 'Hit the Solmar Bank. Drop the guards, grab the cash, lose the heat.',
    target: { x: -36, z: 72 }, radius: 26, kills: 6,
    escape: { x: 170, z: -140 }, escapeRadius: 8,
  },
];

export function makeMissions(W) {
  const missions = {
    defs: MISSION_DEFS,
    index: 0,
    active: null,
    killsLeft: 0,
    phase: 0,
    goldCar: null,
    beacon: null,
    onKill: null,
  };
  W.missions = missions;
  // Beacon: a light pillar + floating diamond at the objective.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
  );
  pillar.position.y = 30;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23f })
  );
  diamond.position.y = 8;
  beacon.add(pillar, diamond);
  beacon.visible = false;
  beacon.userData.diamond = diamond;
  W.scene.add(beacon);
  missions.beacon = beacon;
  missions.onKill = (enemy) => {
    if (missions.active && missions.active.kills) {
      missions.killsLeft = Math.max(0, missions.killsLeft - 1);
      if (missions.killsLeft === 0) {
        advanceKillMission(W);
      }
    }
  };
  return missions;
}

function saveProgress(W) {
  const data = {
    money: W.money,
    missionsDone: W.missions.defs.slice(0, W.missions.index).map((m) => m.id),
    smgUnlocked: W.weapons.smg.unlocked,
    best: Math.max(W.saveData.best || 0, W.money),
  };
  W.saveData = data;
  writeSave(data);
}

export function startMission(W, index) {
  const def = MISSION_DEFS[index];
  if (!def) {
    W.missions.active = null;
    W.missions.beacon.visible = false;
    return;
  }
  const m = W.missions;
  m.index = index;
  m.active = def;
  m.phase = 0;
  m.killsLeft = def.kills || 0;
  clearEnemies(W);
  // Clean up a previous gold car.
  if (m.goldCar) {
    W.scene.remove(m.goldCar.mesh);
    const pi = W.parked.indexOf(m.goldCar);
    if (pi >= 0) W.parked.splice(pi, 1);
    m.goldCar = null;
  }
  if (def.kills) {
    // Spawn on the roads crossing the target (an intersection), so no
    // enemy ever starts inside a building.
    const spots = [[12, 0], [-12, 0], [0, 12], [0, -12], [22, 0], [-22, 0]];
    for (let i = 0; i < def.kills; i++) {
      const s = spots[i % spots.length];
      spawnEnemy(W, def.target.x + s[0], def.target.z + s[1]);
    }
  }
  if (def.stealCar) {
    const mesh = makeCarMesh(0xffd23f);
    mesh.position.set(def.target.x, 0, def.target.z);
    W.scene.add(mesh);
    const car = { mesh, axis: 'x', dir: 1, speed: 0, pos: mesh.position, parked: true, driven: false, gold: true };
    W.parked.push(car);
    m.goldCar = car;
  }
  moveBeacon(W, def.target.x, def.target.z);
  W.events.push({ type: 'mission-start', mission: def.name, at: W.time });
}

function moveBeacon(W, x, z) {
  const b = W.missions.beacon;
  b.position.set(x, 0, z);
  b.visible = true;
}

function advanceKillMission(W) {
  const m = W.missions;
  const def = m.active;
  if (def.escape) {
    m.phase = 1;
    moveBeacon(W, def.escape.x, def.escape.z);
    W.events.push({ type: 'mission-phase', mission: def.name, phase: 1, at: W.time });
  } else {
    completeMission(W);
  }
}

function completeMission(W) {
  const m = W.missions;
  const def = m.active;
  W.money += def.reward;
  W.events.push({ type: 'mission-complete', mission: def.name, reward: def.reward, at: W.time });
  playChime(W.audio);
  if (def.id === 2) {
    W.weapons.smg.unlocked = true;
    W.events.push({ type: 'smg-unlocked', at: W.time });
  }
  m.beacon.visible = false;
  m.active = null;
  m.index = def.id + 1;
  saveProgress(W);
  if (m.index < MISSION_DEFS.length) {
    window.setTimeout(() => {
      if (W.state === 'playing') startMission(W, m.index);
    }, 1200);
  } else {
    W.events.push({ type: 'story-complete', at: W.time });
  }
}

export function updateMissions(W, dt) {
  const m = W.missions;
  if (m.beacon.visible) {
    m.beacon.userData.diamond.position.y = 8 + Math.sin(W.time * 2.5) * 1.2;
    m.beacon.userData.diamond.rotation.y += dt * 2;
  }
  if (!m.active || W.state !== 'playing') return;
  const def = m.active;
  const p = W.player;
  if (def.kills) {
    if (m.killsLeft > 0) return;
    // All kills done: either escape phase or complete.
    if (def.escape && m.phase === 1) {
      const d = Math.hypot(p.pos.x - def.escape.x, p.pos.z - def.escape.z);
      if (d < def.escapeRadius) completeMission(W);
    }
    return;
  }
  if (def.stealCar) {
    if (m.phase === 0) {
      // Reach the gold car and get in.
      if (m.goldCar && p.inCar === m.goldCar) {
        m.phase = 1;
        moveBeacon(W, def.deliver.x, def.deliver.z);
        W.events.push({ type: 'mission-phase', mission: def.name, phase: 1, at: W.time });
      }
      return;
    }
    const d = Math.hypot(p.pos.x - def.deliver.x, p.pos.z - def.deliver.z);
    if (d < def.deliverRadius && p.inCar === m.goldCar) completeMission(W);
    return;
  }
  const d = Math.hypot(p.pos.x - def.target.x, p.pos.z - def.target.z);
  if (d < def.radius) completeMission(W);
}

export function objectiveText(W) {
  const m = W.missions;
  if (!m.active) {
    return m.index >= MISSION_DEFS.length
      ? { text: 'You own Solmar Bay — free roam', dist: 0, x: 0, z: 0 }
      : { text: 'Get ready…', dist: 0, x: 0, z: 0 };
  }
  const def = m.active;
  let tx = def.target.x;
  let tz = def.target.z;
  let text = def.name;
  if (def.kills) {
    text = m.killsLeft > 0
      ? `${def.name} — take out the crew (${m.killsLeft} left)`
      : (def.escape ? `${def.name} — escape to the beach` : def.name);
    if (def.escape && m.killsLeft === 0) {
      tx = def.escape.x;
      tz = def.escape.z;
    }
  } else if (def.stealCar) {
    text = m.phase === 0 ? `${def.name} — steal the gold coupe` : `${def.name} — deliver it to the garage`;
    if (m.phase === 1) {
      tx = def.deliver.x;
      tz = def.deliver.z;
    }
  }
  const dist = Math.hypot(W.player.pos.x - tx, W.player.pos.z - tz);
  return { text, dist, x: tx, z: tz };
}
