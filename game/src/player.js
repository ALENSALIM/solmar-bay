// The player for Solmar Bay: Rico Vega on foot and behind the wheel.
// Movement is relative to the camera yaw. Cars are driven with the same keys.

import * as THREE from 'three';
import { clamp, angleLerp } from './random.js';

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x3a6ea8 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.0, 0.42), jacket);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.8;
  head.castShadow = true;
  g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.36), jeans);
  legs.position.y = 0.28;
  g.add(legs);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x181818 }),
  );
  gun.position.set(0.38, 1.15, 0.35);
  gun.name = 'gun';
  g.add(gun);
  return g;
}

export class Player {
  constructor(scene, city, fleet) {
    this.scene = scene;
    this.city = city;
    this.fleet = fleet;
    this.mesh = makePlayerMesh();
    this.mesh.position.set(0, 0, -150);
    this.scene.add(this.mesh);
    this.heading = 0;
    this.health = 100;
    this.money = 250;
    this.inCar = false;
    this.car = null;
    this.carSpeed = 0;
    this.walkSpeed = 6.5;
    this.runSpeed = 11;
    this.footstep = 0;
  }

  get pos() {
    return this.inCar && this.car ? this.car.mesh.position : this.mesh.position;
  }

  get speed() {
    return this.inCar ? Math.abs(this.carSpeed) : 0;
  }

  setGunVisible(visible) {
    const gun = this.mesh.getObjectByName('gun');
    if (gun) gun.visible = visible;
  }

  enterCar(car) {
    this.car = car;
    this.inCar = true;
    this.carSpeed = 0;
    this.mesh.visible = false;
    this.mesh.position.copy(car.mesh.position);
  }

  exitCar() {
    if (!this.car) return;
    const c = this.car;
    const sideX = Math.cos(c.heading) * 2.6;
    const sideZ = -Math.sin(c.heading) * 2.6;
    this.mesh.position.set(c.mesh.position.x + sideX, 0, c.mesh.position.z + sideZ);
    this.mesh.visible = true;
    this.heading = c.heading;
    this.mesh.rotation.y = this.heading;
    this.fleet.releasePlayerCar(c);
    this.car = null;
    this.inCar = false;
    this.carSpeed = 0;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(100, this.health + amount);
  }

  update(dt, input, camYaw) {
    if (this.inCar && this.car) {
      this.updateDriving(dt, input);
      return;
    }
    let fx = 0;
    let fz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) fz += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) fz -= 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) fx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) fx += 1;
    const len = Math.hypot(fx, fz);
    if (len > 0) {
      fx /= len;
      fz /= len;
      const run = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = run ? this.runSpeed : this.walkSpeed;
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      // W moves away from the camera, D moves to the camera's right.
      const wx = (fz * sin - fx * cos) * speed * dt;
      const wz = (fz * cos + fx * sin) * speed * dt;
      this.mesh.position.x += wx;
      this.mesh.position.z += wz;
      const targetHeading = Math.atan2(wx, wz);
      this.heading = angleLerp(this.heading, targetHeading, Math.min(1, dt * 10));
      this.mesh.rotation.y = this.heading;
      this.footstep += dt * speed * 1.6;
      this.mesh.position.y = Math.abs(Math.sin(this.footstep)) * 0.06;
    } else {
      this.mesh.position.y = 0;
    }
    this.mesh.position.x = clamp(this.mesh.position.x, -240, 240);
    this.mesh.position.z = clamp(this.mesh.position.z, -240, 320);
    this.city.resolveCircle(this.mesh.position, 0.6);
  }

  updateDriving(dt, input) {
    const car = this.car;
    let throttle = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) throttle += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) throttle -= 1;
    let steer = 0;
    if (input.down('KeyA') || input.down('ArrowLeft')) steer += 1;
    if (input.down('KeyD') || input.down('ArrowRight')) steer -= 1;
    const handbrake = input.down('Space');
    const accel = 16;
    const maxFwd = 40;
    const maxRev = 12;
    if (throttle > 0) this.carSpeed += accel * dt;
    else if (throttle < 0) this.carSpeed -= (this.carSpeed > 0.5 ? 26 : 10) * dt;
    else this.carSpeed -= this.carSpeed * 1.4 * dt;
    if (handbrake) this.carSpeed -= this.carSpeed * 3.5 * dt;
    this.carSpeed = clamp(this.carSpeed, -maxRev, maxFwd);
    if (Math.abs(this.carSpeed) > 0.3) {
      const turn = steer * 1.5 * dt * clamp(Math.abs(this.carSpeed) / 10, 0.25, 1);
      car.heading += (this.carSpeed >= 0 ? turn : -turn);
    }
    const step = this.carSpeed * dt;
    const nx = car.mesh.position.x + Math.sin(car.heading) * step;
    const nz = car.mesh.position.z + Math.cos(car.heading) * step;
    const before = { x: car.mesh.position.x, z: car.mesh.position.z };
    car.mesh.position.x = clamp(nx, -240, 240);
    car.mesh.position.z = clamp(nz, -240, 320);
    if (this.city.resolveCircle(car.mesh.position, 1.9)) {
      // Hit a building: lose speed and stop against it.
      const moved = Math.hypot(car.mesh.position.x - before.x, car.mesh.position.z - before.z);
      if (moved < Math.abs(step) * 0.4) this.carSpeed *= 0.35;
    }
    car.mesh.rotation.y = car.heading;
    const spin = (this.carSpeed * dt) / 0.42;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    // Gentle body lean while turning.
    car.mesh.rotation.z = clamp(-steer * this.carSpeed * 0.002, -0.06, 0.06);
  }
}
