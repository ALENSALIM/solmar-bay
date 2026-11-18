// Screenshot staging + the debug API the play test uses. Staging is driven
// by the URL: ?shot=start|drive|chase|combat, ?seed=N, ?fast=1, ?autostart=1.
// Nothing here is part of normal play: the game starts on the title screen.
import { spawnEnemy } from './combat.js';
import { showScreen } from './hud.js';

export function stageShot(W) {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot') || 'start';
  if (shot === 'start') return;
  // All staged shots skip the title screen — and hide its overlay, or it
  // would sit on top of the gameplay.
  W.state = 'playing';
  showScreen(W, 'playing');
  const p = W.player;
  if (shot === 'drive') {
    const car = W.parked[0] || W.traffic[0];
    putInCar(W, car);
    car.pos.set(0, 0, -60);
    car.mesh.rotation.y = 0;
    p.carSpeed = 18;
    W.camYaw = Math.PI;
    W.camPitch = 0.32;
  } else if (shot === 'chase') {
    const car = W.parked[1] || W.traffic[1];
    putInCar(W, car);
    car.pos.set(0, 0, -40);
    car.mesh.rotation.y = 0;
    p.carSpeed = 20;
    W.wanted = 3;
    W.lastCrimeAt = W.time;
    W.camYaw = Math.PI;
    W.camPitch = 0.3;
  } else if (shot === 'combat') {
    p.pos.set(148, 0, -20);
    p.mesh.position.copy(p.pos);
    p.yaw = Math.PI / 2;
    spawnEnemy(W, 164, -20);
    spawnEnemy(W, 167, -13);
    spawnEnemy(W, 167, -27);
    spawnEnemy(W, 161, -20);
    W.camYaw = -Math.PI / 2;
    W.camPitch = 0.12;
  }
  W.events.push({ type: 'shot-staged', shot, at: W.time });
}

function putInCar(W, car) {
  const p = W.player;
  p.inCar = car;
  car.driven = true;
  car.parked = false;
  p.mesh.visible = false;
  p.carSpeed = 0;
  p.pos.copy(car.pos);
}

// The debug handle the headless play test drives. Real players never see it.
export function installDebugApi(W) {
  window.__game = {
    W,
    state: () => W.state,
    money: () => Math.floor(W.money),
    wanted: () => W.wanted,
    health: () => Math.round(W.player.health),
    mission: () => (W.missions.active ? W.missions.active.name : W.missions.index >= 5 ? 'done' : 'none'),
    missionIndex: () => W.missions.index,
    killsLeft: () => W.missions.killsLeft,
    playerPos: () => ({ x: W.player.pos.x, z: W.player.pos.z }),
    playerSpeed: () => (W.player.inCar ? Math.abs(W.player.carSpeed) : Math.abs(W.player.speed)),
    inCar: () => !!W.player.inCar,
    enemies: () => W.enemies.length,
    enemyList: () => W.enemies.map((e) => ({ x: e.pos.x, y: 1.2, z: e.pos.z, hp: e.hp })),
    police: () => W.police.length,
    traffic: () => W.traffic.length,
    peds: () => W.peds.length,
    weapon: () => W.weapon,
    ammo: () => W.weapons[W.weapon].mag,
    smgUnlocked: () => W.weapons.smg.unlocked,
    consoleErrors: () => W.consoleErrors.length,
    events: () => W.events.map((e) => e.type),
    frames: () => W.frames,
    shotLog: () => W.events.filter((e) => e.type === 'shot').slice(-10).map((e) => ({ weapon: e.weapon, hit: e.hit, end: e.end, at: Math.round(e.at * 10) / 10 })),
    // Angle (radians) between the camera's current view direction and the
    // direction from the muzzle to the aim point. The play test polls this
    // below ~0.01 before firing, so a shot is never wasted on a camera
    // that is still swinging to the new aim.
    aimError: (x, y, z) => {
      const cam = W.camera.position;
      const hx = W.player.pos.x;
      const hy = W.player.pos.y + 1.7;
      const hz = W.player.pos.z;
      let vx = hx - cam.x;
      let vy = hy - cam.y;
      let vz = hz - cam.z;
      const vl = Math.hypot(vx, vy, vz) || 1;
      vx /= vl; vy /= vl; vz /= vl;
      const mx = W.player.pos.x;
      const my = W.player.pos.y + 1.5;
      const mz = W.player.pos.z;
      let tx = x - mx;
      let ty = y - my;
      let tz = z - mz;
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      const dot = Math.max(-1, Math.min(1, vx * tx + vy * ty + vz * tz));
      return Math.acos(dot);
    },
    teleport: (x, z) => {
      if (W.player.inCar) {
        const car = W.player.inCar;
        car.pos.set(x, 0, z);
        W.player.pos.copy(car.pos);
      } else {
        W.player.pos.set(x, 0, z);
        W.player.mesh.position.copy(W.player.pos);
      }
    },
    aimAt: (x, y, z) => {
      // Aim from the muzzle (player + 1.5m up): the camera's view direction
      // depends only on yaw/pitch, so this stays exact once the camera settles.
      const ox = W.player.pos.x;
      const oy = W.player.pos.y + 1.5;
      const oz = W.player.pos.z;
      const dx = x - ox;
      const dy = y - oy;
      const dz = z - oz;
      const len = Math.hypot(dx, dy, dz) || 1;
      const vx = dx / len;
      const vy = dy / len;
      const vz = dz / len;
      W.camYaw = Math.atan2(-vx, -vz);
      W.camPitch = Math.max(0.02, Math.min(1.0, Math.asin(-vy)));
    },
    setWanted: (n) => {
      W.wanted = n;
      W.lastCrimeAt = W.time;
    },
    nearestTraffic: () => {
      let best = null;
      let bestD = 1e9;
      for (const c of W.traffic) {
        const d = Math.hypot(c.pos.x - W.player.pos.x, c.pos.z - W.player.pos.z);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (!best) return null;
      const dx = best.axis === 'x' ? best.dir : 0;
      const dz = best.axis === 'z' ? best.dir : 0;
      return { x: best.pos.x, z: best.pos.z, speed: best.speed, dx, dz };
    },
    start: () => {
      if (W.state === 'title') W.startGame();
    },
  };
}
