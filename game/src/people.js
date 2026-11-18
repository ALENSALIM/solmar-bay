// People for Solmar Bay: pedestrians strolling the sidewalks and armed
// enemies that missions spawn. Pedestrians flee when a gun goes off nearby.

import * as THREE from 'three';
import { createRng, clamp, angleLerp, dist2d } from './random.js';
import { ROAD_LINES, CITY_EDGE } from './city.js';

const SHIRT_COLORS = [0xe8e8e8, 0x4a90d9, 0xe86a5a, 0x58b368, 0xf2d13c, 0x8a5ab8, 0xe87a2e];

function makePersonMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.0, 0.4),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.55, 0.35),
    new THREE.MeshLambertMaterial({ color: pants }),
  );
  legs.position.y = 0.28;
  g.add(legs);
  return g;
}

export class Crowd {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = createRng(45177);
    this.peds = [];
    this.enemies = [];
    this.onEnemyShoot = null;
    for (let i = 0; i < 18; i++) this.spawnPed();
  }

  spawnPed(x, z) {
    const line = this.rng.pick(ROAD_LINES);
    const axis = this.rng.pick(['x', 'z']);
    const d = this.rng.range(-180, 180);
    const px = x !== undefined ? x : (axis === 'x' ? d : line + this.rng.pick([-8.5, 8.5]));
    const pz = z !== undefined ? z : (axis === 'x' ? line + this.rng.pick([-8.5, 8.5]) : d);
    const mesh = makePersonMesh(
      this.rng.pick(SHIRT_COLORS),
      this.rng.pick([0x2e3440, 0x5a4a3a, 0x3a5a8a]),
      this.rng.pick([0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0]),
    );
    mesh.position.set(px, 0, pz);
    this.scene.add(mesh);
    const ped = {
      mesh, axis, line, dir: this.rng.pick([-1, 1]),
      speed: this.rng.range(1.2, 2.4), heading: 0, flee: 0,
    };
    ped.heading = axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
    this.peds.push(ped);
    return ped;
  }

  scare(x, z, radius) {
    for (const p of this.peds) {
      if (dist2d(p.mesh.position.x, p.mesh.position.z, x, z) < radius) {
        p.flee = 4;
        p.speed = 5;
      }
    }
  }

  spawnEnemies(n, cx, cz) {
    const made = [];
    for (let i = 0; i < n; i++) {
      const x = cx + this.rng.range(-14, 14);
      const z = cz + this.rng.range(-14, 14);
      const mesh = makePersonMesh(0x8a1f1f, 0x222222, 0xc98a5a);
      const gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x111111 }),
      );
      gun.position.set(0.35, 1.15, 0.4);
      mesh.add(gun);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const e = { mesh, health: 100, alive: true, shootCd: this.rng.range(0.5, 1.5), speed: 3.4, heading: 0 };
      this.enemies.push(e);
      made.push(e);
    }
    return made;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  livingEnemies() {
    return this.enemies.filter((e) => e.alive);
  }

  damageEnemy(enemy, dmg) {
    if (!enemy.alive) return false;
    enemy.health -= dmg;
    if (enemy.health <= 0) {
      enemy.alive = false;
      enemy.mesh.rotation.x = -Math.PI / 2;
      enemy.mesh.position.y = 0.3;
      return true;
    }
    return false;
  }

  update(dt, playerPos, combat) {
    for (const p of this.peds) {
      if (p.flee > 0) {
        p.flee -= dt;
        if (p.flee <= 0) p.speed = this.rng.range(1.2, 2.4);
      }
      const step = p.speed * dt;
      if (p.axis === 'x') {
        p.mesh.position.x += step * p.dir;
        p.mesh.position.z = p.line + (p.dir > 0 ? 8.5 : -8.5);
        if (Math.abs(p.mesh.position.x) > CITY_EDGE) {
          p.dir *= -1;
          p.axis = 'z';
          p.line = this.rng.pick(ROAD_LINES);
          p.mesh.position.x = clamp(p.mesh.position.x, -CITY_EDGE, CITY_EDGE);
        }
      } else {
        p.mesh.position.z += step * p.dir;
        p.mesh.position.x = p.line + (p.dir > 0 ? 8.5 : -8.5);
        if (Math.abs(p.mesh.position.z) > CITY_EDGE) {
          p.dir *= -1;
          p.axis = 'x';
          p.line = this.rng.pick(ROAD_LINES);
          p.mesh.position.z = clamp(p.mesh.position.z, -CITY_EDGE, CITY_EDGE);
        }
      }
      const want = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
      p.heading = angleLerp(p.heading, want, Math.min(1, dt * 5));
      p.mesh.rotation.y = p.heading;
      p.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.008 + p.mesh.position.x)) * 0.05;
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = playerPos.x - e.mesh.position.x;
      const dz = playerPos.z - e.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const wantHeading = Math.atan2(dx, dz);
      e.heading = angleLerp(e.heading, wantHeading, Math.min(1, dt * 6));
      e.mesh.rotation.y = e.heading;
      if (d > 9) {
        e.mesh.position.x += Math.sin(e.heading) * e.speed * dt;
        e.mesh.position.z += Math.cos(e.heading) * e.speed * dt;
        this.city.resolveCircle(e.mesh.position, 0.5);
      }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < 42) {
        e.shootCd = this.rng.range(1.1, 1.9);
        if (this.onEnemyShoot) {
          this.onEnemyShoot(e, { x: playerPos.x, y: 1.2, z: playerPos.z });
        }
      }
    }
    void combat;
  }
}
