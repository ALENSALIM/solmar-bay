// Combat: pistol and SMG, mouse aim from the camera crosshair, tracers,
// enemies with health. Shooting is a raycast from the camera through the
// screen centre; enemies and the player both take hitscan damage.
import * as THREE from 'three';
import { makeFigure } from './people.js';
import { isDown, wasPressed } from './input.js';
import { playShot, playThud } from './audio.js';

export function makeWeapons() {
  return {
    pistol: { name: 'Pistol', mag: 12, magSize: 12, auto: false, damage: 34, rate: 0.25, range: 70 },
    smg: { name: 'SMG', mag: 30, magSize: 30, auto: true, damage: 25, rate: 0.11, range: 60, unlocked: false },
  };
}

export function spawnEnemy(W, x, z) {
  const mesh = makeFigure(0x8e2f2f, 0x8a6d4b);
  mesh.position.set(x, 0, z);
  W.scene.add(mesh);
  const enemy = { mesh, pos: mesh.position, hp: 100, maxHp: 100, yaw: 0, shootAt: 0, burst: 0, flash: 0 };
  W.enemies.push(enemy);
  return enemy;
}

export function clearEnemies(W) {
  for (const e of W.enemies) W.scene.remove(e.mesh);
  W.enemies = [];
}

// A tracer line from the muzzle to the hit point, fading fast.
function makeTracer(W, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95 }));
  W.scene.add(line);
  W.tracers.push({ line, life: 0.09 });
}

export function updateTracers(W, dt) {
  for (let i = W.tracers.length - 1; i >= 0; i--) {
    const t = W.tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.09);
    if (t.life <= 0) {
      W.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      W.tracers.splice(i, 1);
    }
  }
}

export function updateCombat(W, dt) {
  const p = W.player;
  const w = W.weapons[W.weapon];
  if (W.reloadAt > 0) {
    if (W.time >= W.reloadAt) {
      w.mag = w.magSize;
      W.reloadAt = 0;
      W.events.push({ type: 'reload-done', at: W.time });
    }
  }
  // Switch weapon.
  if (wasPressed(W.input, 'KeyQ')) {
    const next = W.weapon === 'pistol' ? 'smg' : 'pistol';
    if (next === 'smg' && !W.weapons.smg.unlocked) {
      W.hudFlash = 'SMG locked — finish mission 3';
      W.hudFlashAt = W.time;
    } else {
      W.weapon = next;
      W.events.push({ type: 'switch-weapon', weapon: next, at: W.time });
    }
  }
  if (wasPressed(W.input, 'KeyR') && w.mag < w.magSize && W.reloadAt === 0) {
    W.reloadAt = W.time + 1.1;
  }
  const wantFire = w.auto ? W.input.mouseDown : W.input.mouseClicked;
  if (wantFire && W.reloadAt === 0 && W.time >= W.nextShotAt) {
    if (w.mag <= 0) {
      W.reloadAt = W.time + 1.1;
    } else {
      fireWeapon(W, w);
    }
  }
  // Enemies shoot back.
  for (const e of W.enemies) updateEnemy(W, e, dt);
}

function muzzleWorld(W) {
  const p = W.player;
  const origin = new THREE.Vector3();
  if (p.inCar) {
    origin.copy(p.pos);
    origin.y = 1.4;
  } else {
    origin.copy(p.pos);
    origin.y = 1.5;
  }
  return origin;
}

function fireWeapon(W, w) {
  w.mag -= 1;
  W.nextShotAt = W.time + w.rate;
  playShot(W.audio);
  const origin = muzzleWorld(W);
  const dir = new THREE.Vector3();
  W.camera.getWorldDirection(dir);
  const ray = new THREE.Raycaster(origin, dir, 0.1, w.range);
  // Walls block shots: the nearest hit wins, and only an enemy takes damage.
  const targets = [...W.enemies.map((e) => e.mesh), ...(W.city.solids || [])];
  const hits = ray.intersectObjects(targets, true);
  let end = origin.clone().addScaledVector(dir, w.range);
  let hitEnemy = null;
  if (hits.length > 0) {
    end = hits[0].point.clone();
    let obj = hits[0].object;
    while (obj && !W.enemies.some((e) => e.mesh === obj) && !(W.city.solids || []).includes(obj)) obj = obj.parent;
    hitEnemy = W.enemies.find((e) => e.mesh === obj) || null;
  }
  makeTracer(W, origin, end);
  if (hitEnemy) {
    damageEnemy(W, hitEnemy, w.damage);
  }
  // Firing near witnesses raises heat — but not during a story mission:
  // the job is off the books, and a bust mid-mission would teleport Rico
  // away from the job and make kill missions unfinishable.
  if (W.time - W.lastShotCrimeAt > 10 && !W.missions.active) {
    W.lastShotCrimeAt = W.time;
    addWanted(W, 1);
  }
  W.events.push({ type: 'shot', weapon: W.weapon, hit: !!hitEnemy, end: [Math.round(end.x * 10) / 10, Math.round(end.y * 10) / 10, Math.round(end.z * 10) / 10], at: W.time });
}

export function damageEnemy(W, enemy, dmg) {
  enemy.hp -= dmg;
  enemy.flash = 0.12;
  enemy.mesh.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(0xff0000);
      o.material.emissiveIntensity = 0.9;
    }
  });
  window.setTimeout(() => {
    enemy.mesh.traverse((o) => {
      if (o.isMesh && o.material.emissive) o.material.emissiveIntensity = 0;
    });
  }, 120);
  if (enemy.hp <= 0) {
    killEnemy(W, enemy);
  }
}

function killEnemy(W, enemy) {
  const i = W.enemies.indexOf(enemy);
  if (i >= 0) W.enemies.splice(i, 1);
  W.scene.remove(enemy.mesh);
  playThud(W.audio);
  W.events.push({ type: 'kill', at: W.time });
  // Mission kills are off the books (see fireWeapon): no heat mid-mission.
  if (!W.missions.active) addWanted(W, 1);
  if (W.missions.onKill) W.missions.onKill(enemy);
}

function updateEnemy(W, e, dt) {
  const p = W.player;
  const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
  e.flash = Math.max(0, e.flash - dt);
  if (d > 34 || W.state !== 'playing') return;
  // Face the player and shoot in bursts.
  e.yaw = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
  e.mesh.rotation.y = e.yaw;
  e.shootAt -= dt;
  if (e.shootAt <= 0) {
    e.shootAt = 2.0 + Math.random() * 1.2;
    e.burst = 2;
  }
  if (e.burst > 0) {
    e.burst--;
    const from = e.pos.clone();
    from.y = 1.5;
    const to = p.pos.clone();
    to.y = 1.3;
    // Inaccurate: enemies usually miss, more so at range. Kept gentle so a
    // player who stands still in the open still has ~25 s to fight back.
    const miss = 0.5 + d / 90;
    to.x += (Math.random() - 0.5) * 2 * miss * d * 0.12;
    to.z += (Math.random() - 0.5) * 2 * miss * d * 0.12;
    makeTracer(W, from, to);
    playShot(W.audio);
    if (Math.random() > miss) {
      damagePlayer(W, 4 + Math.floor(Math.random() * 3));
    }
  }
}

export function damagePlayer(W, dmg) {
  const p = W.player;
  if (W.state !== 'playing' || p.health <= 0) return;
  p.health -= dmg;
  p.lastDamageAt = W.time;
  W.events.push({ type: 'player-hit', dmg, at: W.time });
  if (p.health <= 0) {
    p.health = 0;
    W.state = 'wasted';
    W.events.push({ type: 'wasted', at: W.time });
  }
}

// Wanted level helpers (police.js owns the response; this only changes the number).
export function addWanted(W, n) {
  W.wanted = Math.max(0, Math.min(5, W.wanted + n));
  W.lastCrimeAt = W.time;
}
