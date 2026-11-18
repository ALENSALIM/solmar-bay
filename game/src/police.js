// Police for Solmar Bay: the wanted level, pursuit cars that chase the player,
// foot officers at higher levels, and the busted check.

import * as THREE from 'three';
import { clamp } from './random.js';
import { makeCarMesh } from './vehicles.js';
import { ROAD_LINES } from './city.js';

export class Police {
  constructor(scene, fleet, crowd, audio) {
    this.scene = scene;
    this.fleet = fleet;
    this.crowd = crowd;
    this.audio = audio;
    this.wanted = 0;
    this.pursuit = [];
    this.officers = [];
    this.bustedTimer = 0;
    this.quietTimer = 0;
    this.spawnTimer = 0;
    this.officerTimer = 1;
    this.onBusted = null;
    this.flash = 0;
  }

  setWanted(n) {
    this.wanted = clamp(Math.round(n), 0, 5);
    this.audio.setSiren(this.wanted > 0);
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
    this.quietTimer = 0;
  }

  clearWanted() {
    this.setWanted(0);
    this.clearPursuit();
  }

  clearPursuit() {
    for (const c of this.pursuit) this.scene.remove(c.mesh);
    this.pursuit = [];
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.officers = [];
    this.bustedTimer = 0;
  }

  // Spawn a pursuit car. With exact coordinates it is placed there (used by
  // the screenshot staging); otherwise it appears on a random nearby road.
  spawnPursuitCar(px, pz, exactX, exactZ) {
    let x;
    let z;
    if (typeof exactX === 'number' && typeof exactZ === 'number') {
      x = exactX;
      z = exactZ;
    } else {
      const line = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      x = axis === 'x' ? clamp(px + (Math.random() < 0.5 ? -50 : 50), -190, 190) : line;
      z = axis === 'x' ? line : clamp(pz + (Math.random() < 0.5 ? -50 : 50), -190, 190);
    }
    const mesh = makeCarMesh(0x1c2733, 'police');
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const car = { mesh, heading: 0, speed: 0, maxSpeed: 30 + this.wanted * 1.6, kind: 'police', hp: 100 };
    this.pursuit.push(car);
    return car;
  }

  spawnOfficer(px, pz) {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.0, 0.42), new THREE.MeshLambertMaterial({ color: 0x1c2a44 }));
    body.position.y = 1.05;
    body.castShadow = true;
    mesh.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
    head.position.y = 1.78;
    mesh.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    hat.position.y = 1.98;
    mesh.add(hat);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.35), new THREE.MeshLambertMaterial({ color: 0x1c2a44 }));
    legs.position.y = 0.28;
    mesh.add(legs);
    mesh.position.set(px + (Math.random() - 0.5) * 30, 0, pz + (Math.random() - 0.5) * 30);
    this.scene.add(mesh);
    const officer = { mesh, speed: 4.2 + this.wanted * 0.3, heading: 0, alive: true, health: 100 };
    this.officers.push(officer);
    return officer;
  }

  update(dt, player) {
    const p = player.pos;
    this.flash += dt;
    for (const c of this.pursuit) {
      if (c.mesh.userData.lights) {
        const on = Math.floor(this.flash * 4) % 2 === 0;
        c.mesh.userData.lights[0].material.color.setHex(on ? 0xff2222 : 0x551111);
        c.mesh.userData.lights[1].material.color.setHex(on ? 0x1133aa : 0x2266ff);
      }
    }

    if (this.wanted <= 0) {
      this.quietTimer = 0;
      if (this.pursuit.length > 0 || this.officers.length > 0) this.clearPursuit();
      return;
    }

    // Wanted decays after a long quiet stretch with no new crime.
    this.quietTimer += dt;
    if (this.quietTimer > 45) {
      this.setWanted(this.wanted - 1);
      this.quietTimer = 0;
    }

    // Keep the right number of pursuit cars on the road.
    const wantCars = Math.min(1 + Math.floor(this.wanted / 2), 3);
    this.spawnTimer -= dt;
    if (this.pursuit.length < wantCars && this.spawnTimer <= 0) {
      this.spawnPursuitCar(p.x, p.z);
      this.spawnTimer = 2.5;
    }
    const wantOfficers = this.wanted >= 3 ? Math.min(this.wanted - 2, 3) : 0;
    this.officerTimer -= dt;
    if (this.officers.filter((o) => o.alive).length < wantOfficers && this.officerTimer <= 0) {
      this.spawnOfficer(p.x, p.z);
      this.officerTimer = 3;
    }

    // Pursuit cars steer toward the player and try to ram.
    for (const c of this.pursuit) {
      const dx = p.x - c.mesh.position.x;
      const dz = p.z - c.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
      const targetSpeed = d > 6 ? c.maxSpeed : c.maxSpeed * 0.5;
      c.speed += clamp(targetSpeed - c.speed, -20 * dt, 12 * dt);
      c.mesh.position.x += Math.sin(c.heading) * c.speed * dt;
      c.mesh.position.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.x = clamp(c.mesh.position.x, -240, 240);
      c.mesh.position.z = clamp(c.mesh.position.z, -240, 320);
      c.mesh.rotation.y = c.heading;
      const spin = (c.speed * dt) / 0.42;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
      if (d < 3.4) {
        // Ram: shove the player's car and hurt the player a little.
        if (player.inCar) {
          player.carSpeed *= 0.6;
          player.damage(2);
        } else {
          player.damage(6);
        }
        c.speed *= 0.5;
        c.mesh.position.x -= Math.sin(c.heading) * 1.2;
        c.mesh.position.z -= Math.cos(c.heading) * 1.2;
      }
    }

    // Foot officers run the player down; standing next to one too long gets you busted.
    let nearOfficer = false;
    for (const o of this.officers) {
      if (!o.alive) continue;
      const dx = p.x - o.mesh.position.x;
      const dz = p.z - o.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - o.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      o.heading += clamp(dh, -3 * dt, 3 * dt);
      o.mesh.rotation.y = o.heading;
      if (d > 1.6) {
        o.mesh.position.x += Math.sin(o.heading) * o.speed * dt;
        o.mesh.position.z += Math.cos(o.heading) * o.speed * dt;
      }
      if (d < 3 && !player.inCar) nearOfficer = true;
    }
    if (nearOfficer) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2.5 && this.onBusted) {
        this.bustedTimer = 0;
        this.onBusted();
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
  }
}
