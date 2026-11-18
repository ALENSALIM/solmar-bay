// Rico Vega on foot and behind the wheel: third-person movement, car
// stealing and arcade driving, with building collision and health.
import * as THREE from 'three';
import { pushOutOfColliders } from './city.js';

function makeRico() {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e4a6e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.34), shirt);
  torso.position.y = 1.06;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin);
  head.position.y = 1.64;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xd23c2e })
  );
  cap.position.y = 1.82;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), jeans);
  legL.position.set(0.15, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = -0.15;
  group.add(legL); group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

export class Player {
  constructor(scene, rng, city, input, traffic, audio, hooks) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.input = input;
    this.traffic = traffic;
    this.audio = audio;
    this.hooks = hooks || {};
    this.group = makeRico();
    scene.add(this.group);
    this.pos = this.group.position;
    this.pos.set(city.spawnPos.x, 0, city.spawnPos.z);
    this.yaw = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.health = 100;
    this.maxHealth = 100;
    this.inCar = null;
    this.carSpeed = 0;
    this.walkPhase = 0;
    this.steer = 0;
  }

  resetToHome() {
    this.pos.set(this.city.spawnPos.x, 0, this.city.spawnPos.z);
    this.yaw = 0;
    this.camYaw = Math.PI;
    this.health = this.maxHealth;
    if (this.inCar) {
      this.inCar.isPlayer = false;
      this.inCar.speed = 0;
      this.inCar = null;
      this.group.visible = true;
    }
  }

  damage(amount) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && this.hooks.onDied) this.hooks.onDied();
  }

  regen(dt) {
    if (this.health > 0 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 3 * dt);
    }
  }

  tryEnterCar() {
    if (this.inCar) return null;
    const car = this.traffic.nearestCar(this.pos, 4.5, false);
    if (!car) return null;
    const jacked = !car.isParked;
    car.isPlayer = true;
    car.isParked = false;
    car.speed = 0;
    this.inCar = car;
    this.carSpeed = 0;
    this.group.visible = false;
    if (jacked && this.hooks.onJacked) this.hooks.onJacked(car);
    return car;
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    car.isPlayer = false;
    car.speed = 0;
    this.inCar = null;
    this.carSpeed = 0;
    // Step out on the driver's side.
    const side = car.heading + Math.PI / 2;
    this.pos.set(
      car.pos.x + Math.cos(side) * 2.4,
      0,
      car.pos.z - Math.sin(side) * 2.4
    );
    pushOutOfColliders(this.pos, 0.6, this.city.colliders);
    this.group.visible = true;
    this.yaw = car.heading;
    this.camYaw = car.heading + Math.PI;
  }

  update(dt, playing) {
    if (!playing) return;
    if (this.inCar) this.updateDriving(dt);
    else this.updateOnFoot(dt);
  }

  updateOnFoot(dt) {
    const look = this.input.consumeLook();
    this.camYaw += look.dx * 0.0032;
    this.camPitch = Math.max(-0.15, Math.min(0.85, this.camPitch + look.dy * 0.0028));
    let mx = 0;
    let mz = 0;
    if (this.input.down('KeyW') || this.input.down('ArrowUp')) mz += 1;
    if (this.input.down('KeyS') || this.input.down('ArrowDown')) mz -= 1;
    if (this.input.down('KeyA') || this.input.down('ArrowLeft')) mx -= 1;
    if (this.input.down('KeyD') || this.input.down('ArrowRight')) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      const sprint = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
      const speed = sprint ? 12 : 8;
      // Camera-relative movement: forward is away from the camera.
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      const wx = (mx * cos - mz * sin) * -1;
      const wz = (mx * sin + mz * cos) * -1;
      this.pos.x += wx * speed * dt;
      this.pos.z += wz * speed * dt;
      const targetYaw = Math.atan2(wx, wz);
      let dy = targetYaw - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 12);
      this.walkPhase += dt * (sprint ? 13 : 10);
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.group.userData.legL.rotation.x = swing;
      this.group.userData.legR.rotation.x = -swing;
    } else {
      this.group.userData.legL.rotation.x = 0;
      this.group.userData.legR.rotation.x = 0;
    }
    this.group.rotation.y = this.yaw;
    pushOutOfColliders(this.pos, 0.6, this.city.colliders);
    this.pos.x = Math.max(-222, Math.min(284, this.pos.x));
    this.pos.z = Math.max(-222, Math.min(222, this.pos.z));
  }

  updateDriving(dt) {
    const car = this.inCar;
    const fwd = this.input.down('KeyW') || this.input.down('ArrowUp');
    const back = this.input.down('KeyS') || this.input.down('ArrowDown');
    const left = this.input.down('KeyA') || this.input.down('ArrowLeft');
    const right = this.input.down('KeyD') || this.input.down('ArrowRight');
    const maxSpeed = 42;
    if (fwd) this.carSpeed += 16 * dt;
    else if (back) this.carSpeed -= this.carSpeed > 0.5 ? 24 * dt : 8 * dt;
    else this.carSpeed -= this.carSpeed * 0.9 * dt;
    if (this.carSpeed > maxSpeed) this.carSpeed = maxSpeed;
    if (this.carSpeed < -10) this.carSpeed = -10;
    if (Math.abs(this.carSpeed) < 0.05 && !fwd && !back) this.carSpeed = 0;
    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const steerFactor = Math.min(1, Math.abs(this.carSpeed) / 9);
    this.steer += (steerInput - this.steer) * Math.min(1, dt * 8);
    car.heading += this.steer * 1.9 * steerFactor * dt * Math.sign(this.carSpeed || 1);
    car.pos.x += Math.cos(car.heading) * this.carSpeed * dt;
    car.pos.z += -Math.sin(car.heading) * this.carSpeed * dt;
    // Building collision: stop and slide out.
    const beforeX = car.pos.x;
    const beforeZ = car.pos.z;
    pushOutOfColliders(car.pos, 1.7, this.city.colliders);
    if (car.pos.x !== beforeX || car.pos.z !== beforeZ) this.carSpeed *= 0.4;
    // Other cars: soft push apart.
    for (const other of this.traffic.cars) {
      if (other === car || other.isPlayer) continue;
      const dx = car.pos.x - other.pos.x;
      const dz = car.pos.z - other.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.8 && d > 0.01) {
        car.pos.x = other.pos.x + (dx / d) * 3.8;
        car.pos.z = other.pos.z + (dz / d) * 3.8;
        this.carSpeed *= 0.6;
      }
    }
    car.pos.x = Math.max(-222, Math.min(284, car.pos.x));
    car.pos.z = Math.max(-222, Math.min(222, car.pos.z));
    car.speed = this.carSpeed;
    car.group.rotation.y = car.heading;
    // Lean the body a little into corners.
    car.group.rotation.z = -this.steer * Math.min(1, Math.abs(this.carSpeed) / 20) * 0.06;
    this.audio.setEngine(Math.abs(this.carSpeed) / maxSpeed);
    this.camYaw = car.heading + Math.PI;
    this.camPitch = 0.24;
  }
}
