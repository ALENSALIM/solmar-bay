// Pedestrians and mission enemies for Solmar Bay. Pedestrians stroll the
// sidewalks; enemies hold a spot, shoot at the player when close, and fall
// when their health runs out.
import * as THREE from 'three';
import { ROAD_LINES, pushOutOfColliders } from './city.js';

function makeFigure(shirt, pants, skin) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirtMat);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
  head.position.y = 1.62;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pantsMat);
  legL.position.set(0.14, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = -0.14;
  group.add(legL); group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

const SHIRTS = [0xd25a4a, 0x4a7dd2, 0x53b06a, 0xd2b04a, 0x8a5fc0, 0xe8e8e8, 0x3a3a3a, 0x2e8a8a];
const SKINS = [0xe8b98a, 0xc98a5a, 0x8a5a34, 0xf0c8a0];

export class People {
  constructor(scene, rng, city, onPlayerHit) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.onPlayerHit = onPlayerHit || (() => {});
    this.peds = [];
    this.enemies = [];
  }

  spawnPeds(count) {
    for (let i = 0; i < count; i++) {
      const mesh = makeFigure(
        this.rng.pick(SHIRTS), 0x2a2f38, this.rng.pick(SKINS)
      );
      const pos = this.randomSidewalkSpot();
      mesh.position.set(pos.x, 0, pos.z);
      this.scene.add(mesh);
      const ped = {
        mesh, pos: mesh.position, speed: this.rng.range(1.1, 2.1),
        target: this.randomSidewalkSpot(), walkPhase: this.rng.range(0, 6),
        alive: true, fallT: 0,
      };
      mesh.userData.pedRef = ped;
      this.peds.push(ped);
    }
  }

  randomSidewalkSpot() {
    const line = this.rng.pick(ROAD_LINES);
    const along = this.rng.range(-205, 205);
    const side = this.rng.pick([-5.6, 5.6]);
    if (this.rng.chance(0.5)) return { x: along, z: line + side };
    return { x: line + side, z: along };
  }

  spawnEnemies(spots) {
    const made = [];
    for (const spot of spots) {
      const mesh = makeFigure(0x1c1c22, 0x1c1c22, this.rng.pick(SKINS));
      // A dark jacket and a visible gun.
      const gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.12, 0.12),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      gun.position.set(0.2, 1.15, 0.25);
      mesh.add(gun);
      mesh.position.set(spot.x, 0, spot.z);
      this.scene.add(mesh);
      const enemy = {
        mesh, pos: mesh.position, hp: 100, alive: true,
        shootT: this.rng.range(0.4, 1.2), fallT: 0, home: { x: spot.x, z: spot.z },
      };
      mesh.userData.enemyRef = enemy;
      this.enemies.push(enemy);
      made.push(enemy);
    }
    return made;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  damageEnemy(enemy, dmg) {
    if (!enemy.alive) return false;
    enemy.hp -= dmg;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.fallT = 0;
      enemy.mesh.rotation.x = -Math.PI / 2;
      enemy.mesh.position.y = 0.25;
      return true;
    }
    return false;
  }

  shootPed(ped) {
    if (!ped.alive) return false;
    ped.alive = false;
    ped.fallT = 0;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
    return true;
  }

  update(dt, playerPos, playerAlive) {
    for (const ped of this.peds) {
      if (!ped.alive) {
        ped.fallT += dt;
        if (ped.fallT > 4) ped.mesh.visible = false;
        continue;
      }
      const dx = ped.target.x - ped.pos.x;
      const dz = ped.target.z - ped.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1) {
        ped.target = this.randomSidewalkSpot();
        continue;
      }
      ped.pos.x += (dx / dist) * ped.speed * dt;
      ped.pos.z += (dz / dist) * ped.speed * dt;
      ped.mesh.rotation.y = Math.atan2(dx, dz);
      ped.walkPhase += dt * 6;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      pushOutOfColliders(ped.pos, 0.5, this.city.colliders);
    }
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        enemy.fallT += dt;
        if (enemy.fallT > 5) enemy.mesh.visible = false;
        continue;
      }
      const dx = playerPos.x - enemy.pos.x;
      const dz = playerPos.z - enemy.pos.z;
      const dist = Math.hypot(dx, dz);
      enemy.mesh.rotation.y = Math.atan2(dx, dz);
      enemy.shootT -= dt;
      if (playerAlive && dist < 38 && enemy.shootT <= 0) {
        enemy.shootT = 0.9 + this.rng.range(0, 0.5);
        // Enemies are poor shots: hit roughly half the time at close range.
        if (dist < 26 && this.rng.chance(0.5)) {
          this.onPlayerHit(this.rng.range(4, 8));
        }
      }
      // Drift back toward their post if pushed away.
      const hx = enemy.home.x - enemy.pos.x;
      const hz = enemy.home.z - enemy.pos.z;
      const hd = Math.hypot(hx, hz);
      if (hd > 6) {
        enemy.pos.x += (hx / hd) * 1.5 * dt;
        enemy.pos.z += (hz / hd) * 1.5 * dt;
      }
    }
  }
}
