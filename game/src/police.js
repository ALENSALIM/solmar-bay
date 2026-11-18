// Wanted level and police response for Solmar Bay. Pursuit cars chase the
// player; foot officers close in to bust them. Wanted decays when the
// player keeps clean for a while.
import * as THREE from 'three';
import { pushOutOfColliders } from './city.js';

function makeOfficer() {
  const group = new THREE.Group();
  const blue = new THREE.MeshLambertMaterial({ color: 0x1e3a6e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.34), blue);
  torso.position.y = 1.06;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin);
  head.position.y = 1.64;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), dark);
  hat.position.y = 1.84;
  group.add(hat);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), dark);
  legL.position.set(0.15, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = -0.15;
  group.add(legL); group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

export class Police {
  constructor(scene, rng, city, traffic, audio, onPlayerHit, onBusted) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.traffic = traffic;
    this.audio = audio;
    this.onPlayerHit = onPlayerHit || (() => {});
    this.onBusted = onBusted || (() => {});
    this.wanted = 0;
    this.lastCrimeT = -1000;
    this.decayT = 0;
    this.time = 0;
    this.pursuit = [];
    this.officers = [];
    this.bustT = 0;
    this.boxedT = 0;
  }

  addWanted(n) {
    this.wanted = Math.min(5, this.wanted + n);
    this.lastCrimeT = this.time;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.lastCrimeT = this.time;
  }

  clearAll() {
    for (const car of this.pursuit) this.traffic.removeCar(car);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.pursuit = [];
    this.officers = [];
    this.wanted = 0;
    this.bustT = 0;
    this.boxedT = 0;
  }

  wantedTargetCars() {
    if (this.wanted === 0) return 0;
    return Math.min(1 + Math.floor(this.wanted / 2), 4);
  }

  wantedTargetOfficers() {
    if (this.wanted < 2) return 0;
    return Math.min(this.wanted - 1, 3);
  }

  spawnOfficerNear(pos) {
    const mesh = makeOfficer();
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = 24;
    mesh.position.set(
      Math.max(-210, Math.min(210, pos.x + Math.cos(angle) * dist)),
      0,
      Math.max(-210, Math.min(210, pos.z + Math.sin(angle) * dist))
    );
    this.scene.add(mesh);
    const officer = {
      mesh, pos: mesh.position, shootT: this.rng.range(0.5, 1.4),
      walkPhase: this.rng.range(0, 6),
    };
    this.officers.push(officer);
    return officer;
  }

  update(dt, playerPos, playerInCar, playerSpeed, playerAlive) {
    this.time += dt;
    // Wanted decays after 20 clean seconds, one star per 10 seconds.
    if (this.wanted > 0 && this.time - this.lastCrimeT > 20) {
      this.decayT += dt;
      if (this.decayT > 10) {
        this.decayT = 0;
        this.wanted = Math.max(0, this.wanted - 1);
      }
    }
    // Pursuit cars: keep the right count, chasing the player.
    const wantCars = this.wantedTargetCars();
    while (this.pursuit.length < wantCars) {
      const car = this.traffic.makePoliceCar();
      const angle = this.rng.range(0, Math.PI * 2);
      car.pos.set(
        Math.max(-210, Math.min(210, playerPos.x + Math.cos(angle) * 34)),
        0,
        Math.max(-210, Math.min(210, playerPos.z + Math.sin(angle) * 34))
      );
      car.heading = Math.atan2(-(playerPos.z - car.pos.z), playerPos.x - car.pos.x);
      car.speed = 12;
      this.pursuit.push(car);
      this.traffic.cars.push(car);
    }
    while (this.pursuit.length > wantCars) {
      const car = this.pursuit.pop();
      this.traffic.removeCar(car);
    }
    for (const car of this.pursuit) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(-dz, dx);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const wantSpeed = Math.min(27 + this.wanted * 1.5, dist < 8 ? 14 : 30);
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.5);
      car.pos.x += Math.cos(car.heading) * car.speed * dt;
      car.pos.z += -Math.sin(car.heading) * car.speed * dt;
      pushOutOfColliders(car.pos, 1.7, this.city.colliders);
      car.group.rotation.y = car.heading;
    }
    // Boxed-in bust: a pursuit car touching the player's slow car.
    if (playerInCar && playerAlive) {
      let touching = false;
      for (const car of this.pursuit) {
        if (Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z) < 4.2) {
          touching = true;
          break;
        }
      }
      if (touching && Math.abs(playerSpeed) < 6) this.boxedT += dt;
      else this.boxedT = 0;
      if (this.boxedT > 1.6) { this.boxedT = 0; this.onBusted(); return; }
    }
    // Foot officers.
    const wantOfficers = this.wantedTargetOfficers();
    while (this.officers.length < wantOfficers) this.spawnOfficerNear(playerPos);
    while (this.officers.length > wantOfficers) {
      const o = this.officers.pop();
      this.scene.remove(o.mesh);
    }
    let nearestOfficer = Infinity;
    for (const o of this.officers) {
      const dx = playerPos.x - o.pos.x;
      const dz = playerPos.z - o.pos.z;
      const dist = Math.hypot(dx, dz);
      nearestOfficer = Math.min(nearestOfficer, dist);
      o.mesh.rotation.y = Math.atan2(dx, dz);
      if (!playerInCar && playerAlive && dist > 1.6) {
        o.pos.x += (dx / dist) * 6.6 * dt;
        o.pos.z += (dz / dist) * 6.6 * dt;
        o.walkPhase += dt * 9;
        const swing = Math.sin(o.walkPhase) * 0.5;
        o.mesh.userData.legL.rotation.x = swing;
        o.mesh.userData.legR.rotation.x = -swing;
      }
      o.shootT -= dt;
      if (playerAlive && !playerInCar && dist < 28 && this.wanted >= 3 && o.shootT <= 0) {
        o.shootT = 1.1;
        if (this.rng.chance(0.4)) this.onPlayerHit(this.rng.range(3, 6));
      }
      pushOutOfColliders(o.pos, 0.5, this.city.colliders);
    }
    // Busted when an officer stands on the player.
    if (!playerInCar && playerAlive && nearestOfficer < 2.2) {
      this.bustT += dt;
      if (this.bustT > 1.2) { this.bustT = 0; this.onBusted(); }
    } else {
      this.bustT = Math.max(0, this.bustT - dt * 2);
    }
    this.audio.setSiren(this.wanted > 0 && playerAlive);
  }
}
