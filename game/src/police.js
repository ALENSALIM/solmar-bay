// Police: wanted level response. Pursuit cars chase and ram the player;
// foot officers chase on foot and bust the player when they get close.
// A bust costs a fine and respawns Rico at the beach with wanted cleared.
import * as THREE from 'three';
import { makePoliceCarMesh } from './vehicles.js';
import { makeFigure } from './people.js';
import { setSiren } from './audio.js';
import { collideCircle, clampBounds } from './city.js';

export function makePolice(W) {
  W.police = [];
  W.bustProgress = 0;
  W.lastWanted = 0;
  return W.police;
}

function wantedTargets(wanted) {
  if (wanted <= 0) return { cars: 0, officers: 0 };
  if (wanted === 1) return { cars: 0, officers: 1 };
  if (wanted === 2) return { cars: 1, officers: 1 };
  if (wanted === 3) return { cars: 2, officers: 2 };
  if (wanted === 4) return { cars: 3, officers: 3 };
  return { cars: 4, officers: 4 };
}

function spawnPursuitCar(W, x, z) {
  const mesh = makePoliceCarMesh();
  mesh.position.set(x, 0, z);
  W.scene.add(mesh);
  const unit = {
    kind: 'car', mesh, pos: mesh.position, speed: 0,
    maxSpeed: 24, yaw: 0, stuckAt: 0,
  };
  W.police.push(unit);
  return unit;
}

function spawnOfficer(W, x, z) {
  const mesh = makeFigure(0x1f3a93, 0xc68642);
  mesh.position.set(x, 0, z);
  W.scene.add(mesh);
  const unit = { kind: 'officer', mesh, pos: mesh.position, yaw: 0, phase: 0 };
  W.police.push(unit);
  return unit;
}

export function clearPolice(W) {
  for (const u of W.police) W.scene.remove(u.mesh);
  W.police = [];
  W.bustProgress = 0;
}

export function updatePolice(W, dt) {
  const p = W.player;
  // Wanted decays slowly when Rico lays low.
  if (W.wanted > 0 && W.time - W.lastCrimeAt > 25) {
    W.wanted = Math.max(0, W.wanted - 1);
    W.lastCrimeAt = W.time;
    W.events.push({ type: 'wanted-decay', wanted: W.wanted, at: W.time });
  }
  const want = wantedTargets(W.wanted);
  const haveCars = W.police.filter((u) => u.kind === 'car').length;
  const haveOfficers = W.police.filter((u) => u.kind === 'officer').length;
  // Spawn reinforcements near the player, just out of sight.
  for (let i = haveCars; i < want.cars; i++) {
    const a = Math.random() * Math.PI * 2;
    spawnPursuitCar(W, p.pos.x + Math.cos(a) * 55, p.pos.z + Math.sin(a) * 55);
  }
  for (let i = haveOfficers; i < want.officers; i++) {
    const a = Math.random() * Math.PI * 2;
    spawnOfficer(W, p.pos.x + Math.cos(a) * 30, p.pos.z + Math.sin(a) * 30);
  }
  // Despawn the surplus when wanted falls.
  while (W.police.filter((u) => u.kind === 'car').length > want.cars) {
    const u = W.police.find((x) => x.kind === 'car');
    W.scene.remove(u.mesh);
    W.police.splice(W.police.indexOf(u), 1);
  }
  while (W.police.filter((u) => u.kind === 'officer').length > want.officers) {
    const u = W.police.find((x) => x.kind === 'officer');
    W.scene.remove(u.mesh);
    W.police.splice(W.police.indexOf(u), 1);
  }
  setSiren(W.audio, W.wanted >= 2);
  // Chase behaviour.
  let bustNear = false;
  for (const u of W.police) {
    const dx = p.pos.x - u.pos.x;
    const dz = p.pos.z - u.pos.z;
    const dist = Math.hypot(dx, dz);
    if (u.kind === 'car') {
      // Steer toward the player, ram when close.
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - u.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      u.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, dy));
      // Brake to a stop next to the player: a car that keeps driving
      // through never stays close enough to hold the bust. Creep in
      // under 6 m, stop under 3 m.
      const target = dist > 6 ? u.maxSpeed : (dist > 3 ? 3 : 0);
      u.speed += (target - u.speed) * Math.min(1, dt * 1.5);
      const nx = u.pos.x + Math.sin(u.yaw) * u.speed * dt;
      const nz = u.pos.z + Math.cos(u.yaw) * u.speed * dt;
      const col = collideCircle(W, nx, nz, 1.9);
      u.pos.x = col.px;
      u.pos.z = col.pz;
      u.mesh.rotation.y = u.yaw;
      // Flash the light bar.
      const on = Math.floor(W.time * 6) % 2 === 0;
      u.mesh.userData.lightRed.material.color.setHex(on ? 0xff2222 : 0x440000);
      u.mesh.userData.lightBlue.material.color.setHex(on ? 0x111144 : 0x2244ff);
      // Ram the player's car or knock Rico down.
      if (dist < 3.2 && u.speed > 4) {
        if (p.inCar) {
          p.carSpeed = Math.max(0, p.carSpeed - 6 * dt);
        } else if (Math.random() < dt * 0.8) {
          // Officer-style shove: small damage, no instant bust.
        }
      }
      if (dist < 4 && !p.inCar) bustNear = true;
    } else {
      // Officer on foot: run at Rico.
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - u.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      u.yaw += Math.max(-3 * dt, Math.min(3 * dt, dy));
      // Stop next to the player to make the arrest: an officer who runs
      // straight through never stays close enough to hold the bust.
      // 2 m is inside the 2.4 m bust radius, so a stopped officer busts.
      const speed = dist < 2 ? 0 : 5.2;
      const nx = u.pos.x + Math.sin(u.yaw) * speed * dt;
      const nz = u.pos.z + Math.cos(u.yaw) * speed * dt;
      const col = collideCircle(W, nx, nz, 0.5);
      u.pos.x = col.px;
      u.pos.z = col.pz;
      u.mesh.rotation.y = u.yaw;
      u.phase += dt * 9;
      u.mesh.position.y = Math.abs(Math.sin(u.phase)) * 0.05;
      const [l, r] = u.mesh.userData.legs;
      l.rotation.x = Math.sin(u.phase) * 0.5;
      r.rotation.x = -Math.sin(u.phase) * 0.5;
      if (dist < 2.4) bustNear = true;
    }
  }
  // Bust: an officer (or a stopped pursuit) stays close for 1.5 s.
  const canBust = bustNear && (!p.inCar || Math.abs(p.carSpeed) < 1.5);
  if (canBust) {
    W.bustProgress += dt;
    if (W.bustProgress >= 1.5) {
      bustPlayer(W);
    }
  } else {
    W.bustProgress = Math.max(0, W.bustProgress - dt * 2);
  }
}

export function bustPlayer(W) {
  const fine = Math.min(150, Math.floor(W.money * 0.1));
  W.money = Math.max(0, W.money - fine);
  W.lastFine = fine;
  W.wanted = 0;
  W.bustProgress = 0;
  clearPolice(W);
  // Respawn at the beach.
  if (W.player.inCar) {
    const car = W.player.inCar;
    car.driven = false;
    W.player.inCar = null;
    W.player.mesh.visible = true;
  }
  W.player.pos.set(170, 0, 0);
  W.player.mesh.position.copy(W.player.pos);
  W.player.health = 100;
  W.player.carSpeed = 0;
  W.state = 'busted';
  W.events.push({ type: 'busted', fine, at: W.time });
}
