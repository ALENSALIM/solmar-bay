// Combat: the player's pistol and SMG, rival gang members who shoot back, and the
// tracers and flashes that make a shootout read on screen. Shots are raycasts from
// the camera through the crosshair.
import * as THREE from 'three';
import { clamp, distance2D } from './random.js';
import { buildPersonMesh } from './people.js';

const WEAPONS = {
  fists: { name: 'Fists', damage: 25, range: 2.6, rate: 0.45, auto: false, spread: 0 },
  pistol: { name: 'Pistol', damage: 34, range: 90, rate: 0.28, auto: false, spread: 0.012 },
  smg: { name: 'SMG', damage: 20, range: 70, rate: 0.09, auto: true, spread: 0.045 },
};

export function createCombat(G) {
  const { scene, rng } = G;
  const enemies = [];
  const tracers = [];
  const raycaster = new THREE.Raycaster();
  let shootCooldown = 0;
  let lastShotWasAuto = false;

  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1);

  function spawnTracer(from, to) {
    const len = from.distanceTo(to);
    const mesh = new THREE.Mesh(tracerGeo, tracerMat);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.lookAt(to);
    mesh.scale.z = len;
    scene.add(mesh);
    tracers.push({ mesh, life: 0.09 });
  }

  function spawnMuzzleFlash(pos) {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffdf6b, transparent: true, opacity: 0.95 }),
    );
    flash.position.copy(pos);
    scene.add(flash);
    tracers.push({ mesh: flash, life: 0.06, flash: true });
  }

  function muzzlePosition() {
    const p = G.player;
    if (p.car) return new THREE.Vector3(p.car.pos.x, 1.4, p.car.pos.z);
    return new THREE.Vector3(p.pos.x, 1.5, p.pos.z);
  }

  function shoot() {
    const p = G.player;
    const def = WEAPONS[p.weapon];
    if (!def || shootCooldown > 0) return;
    if (p.weapon !== 'fists') {
      const mag = p.weapons[p.weapon];
      if (mag.ammo <= 0) {
        reload();
        return;
      }
      mag.ammo -= 1;
    }
    shootCooldown = def.rate;
    G.audio.gunshot();
    const from = G.camera.position.clone();
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    dir.x += (rng.next() - 0.5) * def.spread * 2;
    dir.y += (rng.next() - 0.5) * def.spread * 2;
    dir.z += (rng.next() - 0.5) * def.spread * 2;
    dir.normalize();
    raycaster.set(from, dir);
    raycaster.far = def.range;
    // Hit enemies first.
    const targets = enemies.filter((e) => e.alive).map((e) => e.mesh);
    const hits = raycaster.intersectObjects(targets, true);
    let end = from.clone().add(dir.clone().multiplyScalar(def.range));
    if (hits.length > 0) {
      const hit = hits[0];
      end = hit.point.clone();
      let enemy = null;
      let obj = hit.object;
      while (obj && !enemy) {
        enemy = enemies.find((e) => e.mesh === obj);
        obj = obj.parent;
      }
      if (enemy) {
        enemy.health -= def.damage;
        enemy.flashTimer = 0.08;
        if (enemy.health <= 0) killEnemy(enemy);
        else G.hud.toast(`Hit ${enemy.name}!`);
      }
    } else {
      // Check buildings: stop the tracer at the first wall.
      const walls = G.city.colliders;
      for (const b of walls) {
        // Cheap slab test in 2D along the ray.
        const t = rayBoxHit(from, dir, b);
        if (t > 0 && t < def.range) {
          end = from.clone().add(dir.clone().multiplyScalar(t));
          break;
        }
      }
    }
    spawnTracer(muzzlePosition(), end);
    spawnMuzzleFlash(muzzlePosition());
    G.people.scarePeds(p.pos.x, p.pos.z, 40);
    // Gunfire draws the law.
    G.police.addHeat(0.25, 'gunfire');
  }

  function rayBoxHit(from, dir, b) {
    // 2D ray vs AABB in the XZ plane, y ignored (walls are tall).
    let tmin = 0;
    let tmax = 200;
    for (const [o, d, mn, mx] of [[from.x, dir.x, b.minX, b.maxX], [from.z, dir.z, b.minZ, b.maxZ]]) {
      if (Math.abs(d) < 1e-8) {
        if (o < mn || o > mx) return -1;
      } else {
        let t1 = (mn - o) / d;
        let t2 = (mx - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return -1;
      }
    }
    return tmin;
  }

  function reload() {
    const p = G.player;
    const mag = p.weapons[p.weapon];
    if (!mag || p.weapon === 'fists') return;
    const need = (p.weapon === 'smg' ? 30 : 12) - mag.ammo;
    const take = Math.min(need, mag.reserve);
    if (take <= 0) {
      G.hud.toast('Out of ammo — find a gun shop.');
      return;
    }
    mag.ammo += take;
    mag.reserve -= take;
    G.audio.click();
    G.hud.toast('Reloaded.');
  }

  function spawnEnemy(x, z, name) {
    const mesh = buildPersonMesh(0x3a1a1a, 0x1a1a1a, rng.pick([0xf2c9a0, 0xc98d5f, 0x8a5a34]), false);
    mesh.position.set(x, 0, z);
    // Face the player on spawn: an alerted gang member walks straight at
    // its target. Without this the enemy spawns facing +z, turns at a
    // limited rate while walking, and arcs sideways off the line of fire.
    mesh.rotation.y = Math.atan2(G.player.pos.x - x, G.player.pos.z - z);
    scene.add(mesh);
    const enemy = {
      mesh, pos: mesh.position, name: name || 'Diablo',
      health: 100, alive: true, shootTimer: rng.range(0.6, 1.8),
      phase: rng.range(0, 6), flashTimer: 0, speed: 3.0,
    };
    enemies.push(enemy);
    return enemy;
  }

  function killEnemy(enemy) {
    enemy.alive = false;
    enemy.mesh.rotation.x = -Math.PI / 2;
    enemy.mesh.position.y = 0.4;
    G.player.money += 50;
    G.hud.toast(`${enemy.name} is down. +$50`);
    G.audio.pickup();
    window.setTimeout(() => {
      scene.remove(enemy.mesh);
      const i = enemies.indexOf(enemy);
      if (i >= 0) enemies.splice(i, 1);
    }, 4000);
  }

  function officerShot(officer) {
    const p = G.player;
    const d = distance2D(officer.pos.x, officer.pos.z, p.pos.x, p.pos.z);
    if (d > 40) return;
    const from = new THREE.Vector3(officer.pos.x, 1.4, officer.pos.z);
    const to = new THREE.Vector3(p.pos.x, 1.2 + (p.car ? 0.4 : 0), p.pos.z);
    spawnTracer(from, to);
    spawnMuzzleFlash(from);
    G.audio.gunshot();
    if (rng.chance(0.35)) p.damage(6, 'police');
  }

  function enemyShot(enemy) {
    const p = G.player;
    const d = distance2D(enemy.pos.x, enemy.pos.z, p.pos.x, p.pos.z);
    if (d > 45) return;
    const from = new THREE.Vector3(enemy.pos.x, 1.4, enemy.pos.z);
    const to = new THREE.Vector3(p.pos.x, 1.2, p.pos.z);
    spawnTracer(from, to);
    spawnMuzzleFlash(from);
    G.audio.gunshot();
    if (rng.chance(0.3)) p.damage(7, 'gang');
  }

  function update(dt, input) {
    if (shootCooldown > 0) shootCooldown -= dt;
    const p = G.player;
    const def = WEAPONS[p.weapon];
    const wantFire = def.auto ? input.firing : (input.firing && !lastShotWasAuto);
    if (wantFire && G.screen === 'play') shoot();
    lastShotWasAuto = input.firing;
    if (input.wasPressed('reload')) reload();
    if (input.wasPressed('weapon')) {
      const owned = p.ownedWeapons;
      const i = owned.indexOf(p.weapon);
      p.weapon = owned[(i + 1) % owned.length];
      G.audio.click();
    }
    for (let i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) {
        scene.remove(tracers[i].mesh);
        tracers.splice(i, 1);
      }
    }
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const d = distance2D(enemy.pos.x, enemy.pos.z, p.pos.x, p.pos.z);
      const dx = p.pos.x - enemy.pos.x;
      const dz = p.pos.z - enemy.pos.z;
      const wantYaw = Math.atan2(dx, dz);
      let dyaw = wantYaw - enemy.mesh.rotation.y;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      enemy.mesh.rotation.y += clamp(dyaw, -4 * dt, 4 * dt);
      if (d > 16) {
        enemy.pos.x += Math.sin(enemy.mesh.rotation.y) * enemy.speed * dt;
        enemy.pos.z += Math.cos(enemy.mesh.rotation.y) * enemy.speed * dt;
        enemy.phase += dt * 9;
        const limbs = enemy.mesh.userData.limbs;
        const swing = Math.sin(enemy.phase) * 0.5;
        limbs.legL.rotation.x = swing;
        limbs.legR.rotation.x = -swing;
      } else {
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0) {
          enemy.shootTimer = rng.range(1.0, 2.0);
          enemyShot(enemy);
        }
      }
      if (enemy.flashTimer > 0) {
        enemy.flashTimer -= dt;
        enemy.mesh.userData.limbs.torso.material.color.setHex(0xffffff);
      } else {
        enemy.mesh.userData.limbs.torso.material.color.setHex(0x3a1a1a);
      }
    }
  }

  return { enemies, WEAPONS, shoot, reload, spawnEnemy, killEnemy, officerShot, update };
}
