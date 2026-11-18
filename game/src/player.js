// Rico Vega, the player: on foot with a third-person camera, or behind the wheel.
// On foot he runs, jumps and aims; near a car, E steals it (and the law notices).
import * as THREE from 'three';
import { clamp, angleLerp, distance2D } from './random.js';
import { buildPersonMesh } from './people.js';

export function createPlayer(G) {
  const { scene, city } = G;
  const mesh = buildPersonMesh(0x2f6fd0, 0x2c3e50, 0xf2c9a0, false);
  // Rico's look: a red jacket over the blue shirt, so he reads on screen.
  mesh.userData.limbs.torso.material = new THREE.MeshLambertMaterial({ color: 0xc22a2a });
  scene.add(mesh);

  const player = {
    mesh,
    pos: mesh.position,
    yaw: 0,
    camYaw: 0,
    camPitch: 0.32,
    speed: 0,
    verticalSpeed: 0,
    grounded: true,
    health: 100,
    maxHealth: 100,
    money: 250,
    car: null,
    weapon: 'fists',
    weapons: { fists: { ammo: Infinity, reserve: Infinity }, pistol: { ammo: 12, reserve: 48 }, smg: { ammo: 30, reserve: 90 } },
    ownedWeapons: ['fists', 'pistol'],
    walkPhase: 0,
    invulnerable: 0,
    lastDamageAt: 0,
  };
  player.pos.set(0, 0, -40);

  function damage(amount, cause) {
    if (player.invulnerable > 0 || G.screen !== 'play') return;
    player.health = Math.max(0, player.health - amount);
    player.lastDamageAt = G.time;
    G.hud.flashDamage();
    if (player.health <= 0) G.gameOver(cause === 'police' ? 'busted' : 'wasted');
  }

  function heal(amount) {
    player.health = Math.min(player.maxHealth, player.health + amount);
  }

  function updateOnFoot(dt, input) {
    const { dx, dy } = input.consumeMouse();
    player.camYaw -= dx * 0.0032;
    player.camPitch = clamp(player.camPitch + dy * 0.0022, -0.15, 0.9);
    const run = input.isDown('run');
    const moveSpeed = run ? 9.5 : 5.2;
    const fwd = (input.isDown('forward') ? 1 : 0) - (input.isDown('back') ? 1 : 0);
    const strafe = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const sin = Math.sin(player.camYaw);
    const cos = Math.cos(player.camYaw);
    let mx = sin * fwd + cos * strafe;
    let mz = cos * fwd - sin * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len; mz /= len;
      player.yaw = Math.atan2(mx, mz);
      player.speed = moveSpeed;
    } else {
      player.speed = 0;
    }
    player.pos.x += mx * player.speed * dt;
    player.pos.z += mz * player.speed * dt;
    if (input.wasPressed('jump') && player.grounded) {
      player.verticalSpeed = 7.5;
      player.grounded = false;
    }
    if (!player.grounded) {
      player.verticalSpeed -= 22 * dt;
      player.pos.y += player.verticalSpeed * dt;
      if (player.pos.y <= 0) { player.pos.y = 0; player.verticalSpeed = 0; player.grounded = true; }
    }
    city.resolveCircle(player.pos, 0.6);
    player.walkPhase += dt * player.speed * 1.6;
    const limbs = mesh.userData.limbs;
    const swing = Math.sin(player.walkPhase) * 0.6 * clamp(player.speed / 9.5, 0, 1);
    limbs.legL.rotation.x = swing;
    limbs.legR.rotation.x = -swing;
    limbs.armL.rotation.x = -swing * 0.8;
    limbs.armR.rotation.x = swing * 0.8;
    mesh.rotation.y = player.yaw;
    if (player.invulnerable > 0) player.invulnerable -= dt;
  }

  function tryEnterCar() {
    if (player.car) {
      // Get out: step to the car's left side.
      const car = player.car;
      player.car = null;
      car.occupied = false;
      player.pos.set(
        car.pos.x + Math.cos(car.yaw) * -2.2,
        0,
        car.pos.z - Math.sin(car.yaw) * -2.2,
      );
      player.camYaw = car.yaw;
      mesh.visible = true;
      G.hud.setHint('On foot. E near a car to steal it. F to talk, R to reload.');
      return true;
    }
    const car = G.vehicles.nearestCar(player.pos.x, player.pos.z, 4.5, null);
    if (!car) return false;
    if (car.kind === 'police') {
      G.hud.toast('That one belongs to the police.');
      return false;
    }
    const wasParked = car.kind === 'parked';
    if (car.kind === 'traffic' || car.kind === 'taxi') {
      // Jack it: the driver bails and runs.
      G.people.scarePeds(car.pos.x, car.pos.z, 12);
      G.hud.toast(`You stole the ${car.name}!`);
      G.police.addHeat(1, 'grand theft auto');
      car.kind = 'parked';
    } else if (!wasParked) {
      return false;
    }
    player.car = car;
    car.occupied = true;
    car.speed = 0;
    mesh.visible = false;
    player.camYaw = car.yaw;
    G.audio.click();
    G.hud.setHint('W/S drive · A/D steer · Shift handbrake · E get out');
    return true;
  }

  function updateCamera(dt) {
    const cam = G.camera;
    let target;
    let dist;
    let height;
    if (player.car) {
      target = player.car.pos;
      dist = 10.5;
      height = 4.6;
    } else {
      target = player.pos;
      dist = 6.5;
      // Aiming stance: with a gun out, the camera rides lower so the shot can
      // reach a distant target instead of diving into the ground.
      height = player.weapon !== 'fists' ? 2.4 : 3.1;
    }
    const yaw = player.camYaw;
    const pitch = player.camPitch;
    const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = target.y + height + Math.sin(pitch) * dist * 0.6;
    cam.position.x += (cx - cam.position.x) * Math.min(1, dt * 7);
    cam.position.z += (cz - cam.position.z) * Math.min(1, dt * 7);
    cam.position.y += (cy - cam.position.y) * Math.min(1, dt * 7);
    if (!player.car && player.weapon !== 'fists') {
      // Look at a point ahead of the player, not at the player himself: the
      // crosshair — and the shot ray through it — must be able to reach a
      // target down the street. Looking at the player pins the ray to the
      // ground a few metres past his feet, so no distant shot could ever hit.
      // The aim point sits at chest height 14 m out, so the ray crosses a
      // standing target's torso at the ranges gunfights happen (12–23 m);
      // moving the mouse up flattens the shot further for closer targets.
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      cam.lookAt(target.x + fx * 14, 1.65, target.z + fz * 14);
    } else {
      cam.lookAt(target.x, target.y + 1.6, target.z);
    }
    // Keep the camera out of buildings: lift it when it clips a wall.
    if (city.collides(cam.position.x, cam.position.z, 1)) {
      cam.position.y = Math.max(cam.position.y, 14);
    }
  }

  function respawn() {
    player.health = player.maxHealth;
    player.car = null;
    mesh.visible = true;
    const hospital = G.city.LANDMARKS.hospital;
    player.pos.set(hospital.x + 6, 0, hospital.z + 6);
    player.camYaw = 0;
    player.invulnerable = 2;
  }

  player.damage = damage;
  player.heal = heal;
  player.updateOnFoot = updateOnFoot;
  player.tryEnterCar = tryEnterCar;
  player.updateCamera = updateCamera;
  player.respawn = respawn;
  Object.defineProperty(player, 'position', { get() { return player.pos; } });
  Object.defineProperty(player, 'inCar', { get() { return !!player.car; } });
  return player;
}
