// Rico Vega on foot and behind the wheel. On foot: WASD moves relative to
// the camera yaw, Shift runs. In a car: W/S throttle and brake, A/D steer,
// the car is simple arcade physics with building collision.
import * as THREE from 'three';
import { makeFigure } from './people.js';
import { isDown, wasPressed } from './input.js';
import { collideCircle, clampBounds } from './city.js';
import { playHorn } from './audio.js';
import { addWanted } from './combat.js';

export function makePlayer(W) {
  const mesh = makeFigure(0xe67e22, 0xc68642);
  mesh.position.set(170, 0, 0);
  W.scene.add(mesh);
  const player = {
    mesh,
    pos: mesh.position,
    yaw: -Math.PI / 2,
    health: 100,
    maxHealth: 100,
    speed: 0,
    inCar: null,
    carSpeed: 0,
    steer: 0,
    lastDamageAt: -99,
    walkPhase: 0,
  };
  W.player = player;
  return player;
}

function nearestCar(W, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    if (c.driven) continue;
    const d = Math.hypot(c.pos.x - W.player.pos.x, c.pos.z - W.player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function updatePlayer(W, dt) {
  const p = W.player;
  const input = W.input;
  if (p.inCar) {
    updateDriving(W, dt);
    return;
  }
  // Camera-relative movement.
  const fwd = (isDown(input, 'KeyW') || isDown(input, 'ArrowUp') ? 1 : 0)
    - (isDown(input, 'KeyS') || isDown(input, 'ArrowDown') ? 1 : 0);
  const strafe = (isDown(input, 'KeyD') || isDown(input, 'ArrowRight') ? 1 : 0)
    - (isDown(input, 'KeyA') || isDown(input, 'ArrowLeft') ? 1 : 0);
  const run = isDown(input, 'ShiftLeft') || isDown(input, 'ShiftRight');
  const speed = run ? 9 : 6;
  const cy = W.camYaw;
  let mx = 0;
  let mz = 0;
  if (fwd !== 0 || strafe !== 0) {
    mx = -Math.sin(cy) * fwd + Math.cos(cy) * strafe;
    mz = -Math.cos(cy) * fwd - Math.sin(cy) * strafe;
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    p.speed = speed;
    p.yaw = Math.atan2(mx, mz);
  } else {
    p.speed = 0;
  }
  let nx = p.pos.x + mx * p.speed * dt;
  let nz = p.pos.z + mz * p.speed * dt;
  const col = collideCircle(W, nx, nz, 0.55);
  nx = col.px;
  nz = col.pz;
  const cl = clampBounds(nx, nz);
  p.pos.x = cl.x;
  p.pos.z = cl.z;
  p.mesh.rotation.y = p.yaw;
  p.walkPhase += dt * (p.speed > 0 ? 9 : 0);
  p.mesh.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.05;
  const [l, r] = p.mesh.userData.legs;
  const swing = p.speed > 0 ? 0.55 : 0;
  l.rotation.x = Math.sin(p.walkPhase) * swing;
  r.rotation.x = -Math.sin(p.walkPhase) * swing;
  // Health regen after 10 s without damage.
  if (W.time - p.lastDamageAt > 10 && p.health < p.maxHealth) {
    p.health = Math.min(p.maxHealth, p.health + 4 * dt);
  }
  // Enter / exit a car.
  if (wasPressed(input, 'KeyE')) {
    const car = nearestCar(W, [...W.parked, ...W.traffic], 3.4);
    if (car) enterCar(W, car);
  }
  if (wasPressed(input, 'KeyH')) playHorn(W.audio);
}

function enterCar(W, car) {
  const p = W.player;
  // Jacking a moving traffic car (one that was never parked) is a crime.
  if (!car.wasParked) {
    addWanted(W, 1);
    W.events.push({ type: 'jacked', at: W.time });
  }
  p.inCar = car;
  car.driven = true;
  car.parked = false;
  p.mesh.visible = false;
  p.carSpeed = 0;
  W.events.push({ type: 'enter-car', at: W.time });
}

export function exitCar(W) {
  const p = W.player;
  const car = p.inCar;
  if (!car) return;
  p.inCar = null;
  car.driven = false;
  if (car.wasParked) car.parked = true;
  p.carSpeed = 0;
  // Step out to the side of the car.
  const side = Math.cos(car.mesh.rotation.y);
  const sideZ = -Math.sin(car.mesh.rotation.y);
  p.pos.set(car.pos.x + side * 2.2, 0, car.pos.z + sideZ * 2.2);
  p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
}

function updateDriving(W, dt) {
  const p = W.player;
  const car = p.inCar;
  const input = W.input;
  const throttle = (isDown(input, 'KeyW') || isDown(input, 'ArrowUp') ? 1 : 0)
    - (isDown(input, 'KeyS') || isDown(input, 'ArrowDown') ? 1 : 0);
  const steerIn = (isDown(input, 'KeyA') || isDown(input, 'ArrowLeft') ? 1 : 0)
    - (isDown(input, 'KeyD') || isDown(input, 'ArrowRight') ? 1 : 0);
  const maxSpeed = 30;
  const accel = 16;
  if (throttle > 0) p.carSpeed = Math.min(maxSpeed, p.carSpeed + accel * dt);
  else if (throttle < 0) p.carSpeed = Math.max(-9, p.carSpeed - accel * 0.9 * dt);
  else p.carSpeed -= Math.sign(p.carSpeed) * Math.min(Math.abs(p.carSpeed), 10 * dt);
  // Steering scales with speed and flips in reverse.
  const steerTarget = steerIn * 1.9 * Math.min(1, Math.abs(p.carSpeed) / 8);
  p.steer += (steerTarget - p.steer) * Math.min(1, dt * 8);
  car.mesh.rotation.y += p.steer * Math.sign(p.carSpeed) * dt * 0.9;
  const yaw = car.mesh.rotation.y;
  const nx = car.pos.x + Math.sin(yaw) * p.carSpeed * dt;
  const nz = car.pos.z + Math.cos(yaw) * p.carSpeed * dt;
  const col = collideCircle(W, nx, nz, 1.9);
  if (col.hit && Math.abs(p.carSpeed) > 6) {
    p.carSpeed *= 0.4;
    W.events.push({ type: 'crash', at: W.time });
  }
  const cl = clampBounds(col.px, col.pz);
  car.pos.x = cl.x;
  car.pos.z = cl.z;
  // Wheels spin with speed.
  for (const w of car.mesh.userData.wheels) w.rotation.x += (p.carSpeed * dt) / 0.36;
  // Player follows the car.
  p.pos.copy(car.pos);
  p.mesh.position.copy(car.pos);
  // Exit the car.
  if (wasPressed(input, 'KeyE')) exitCar(W);
  if (wasPressed(input, 'KeyH')) playHorn(W.audio);
}
