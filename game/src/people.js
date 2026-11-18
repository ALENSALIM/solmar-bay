// The people of Solmar Bay: pedestrians strolling the sidewalks who flee from
// gunfire and speeding cars, and police officers on foot at higher wanted levels.
import * as THREE from 'three';
import { clamp, distance2D } from './random.js';

const SKINS = [0xf2c9a0, 0xc98d5f, 0x8a5a34, 0xe8b88a];
const SHIRTS = [0xd93030, 0x2f6fd0, 0xf2c94c, 0x2fbf71, 0xffffff, 0x9b59d0, 0xff8c42, 0x4fc3f7];
const PANTS = [0x2c3e50, 0x5d6d7e, 0x1a1a1a, 0x7d6608];

export function buildPersonMesh(shirtColor, pantsColor, skinColor, isCop) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.12;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
  head.position.y = 1.66;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34), new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
  hair.position.y = 1.86;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), pants);
  legL.position.set(-0.16, 0.39, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), shirt);
  armL.position.set(-0.42, 1.14, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  if (isCop) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    cap.position.y = 1.92;
    group.add(cap);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    badge.position.set(0.16, 1.3, 0.18);
    group.add(badge);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);
  group.userData.limbs = { legL, legR, armL, armR, torso, head };
  return group;
}

function animateWalk(mesh, phase, speed01) {
  const limbs = mesh.userData.limbs;
  const swing = Math.sin(phase) * 0.55 * speed01;
  limbs.legL.rotation.x = swing;
  limbs.legR.rotation.x = -swing;
  limbs.armL.rotation.x = -swing * 0.8;
  limbs.armR.rotation.x = swing * 0.8;
  limbs.torso.position.y = 1.12 + Math.abs(Math.sin(phase)) * 0.04 * speed01;
}

export function createPeople(G) {
  const { scene, city, rng } = G;
  const peds = [];
  const officers = [];

  function sidewalkPoint() {
    const road = rng.pick([-320, -240, -160, -80, 0, 80, 160, 240, 320]);
    const along = rng.range(-320, 320);
    if (rng.chance(0.5)) return { x: along, z: road + rng.pick([-9.5, 9.5]) };
    return { x: road + rng.pick([-9.5, 9.5]), z: along };
  }

  function spawnPed() {
    const p = sidewalkPoint();
    const mesh = buildPersonMesh(rng.pick(SHIRTS), rng.pick(PANTS), rng.pick(SKINS), false);
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    const ped = {
      mesh, pos: mesh.position, yaw: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2), phase: rng.range(0, 6), state: 'walk',
      target: sidewalkPoint(), fleeTimer: 0, health: 100,
    };
    peds.push(ped);
    return ped;
  }

  function spawnOfficer(x, z) {
    const mesh = buildPersonMesh(0x1a2a4a, 0x1a2a4a, rng.pick(SKINS), true);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const officer = {
      mesh, pos: mesh.position, yaw: 0, speed: 3.4, phase: 0,
      state: 'chase', shootTimer: rng.range(0.5, 1.5), health: 100,
    };
    officers.push(officer);
    return officer;
  }

  function scarePeds(x, z, radius) {
    for (const ped of peds) {
      if (distance2D(ped.pos.x, ped.pos.z, x, z) < radius) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
        ped.target = {
          x: clamp(ped.pos.x + (ped.pos.x - x) * 2, -350, 350),
          z: clamp(ped.pos.z + (ped.pos.z - z) * 2, -350, 420),
        };
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of peds) {
      const dx = ped.target.x - ped.pos.x;
      const dz = ped.target.z - ped.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) {
        if (ped.state === 'flee') { ped.state = 'walk'; ped.fleeTimer = 0; }
        ped.target = sidewalkPoint();
        continue;
      }
      const speed = ped.state === 'flee' ? 5.2 : ped.speed;
      const wantYaw = Math.atan2(dx, dz);
      let dyaw = wantYaw - ped.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      ped.yaw += clamp(dyaw, -4 * dt, 4 * dt);
      ped.pos.x += Math.sin(ped.yaw) * speed * dt;
      ped.pos.z += Math.cos(ped.yaw) * speed * dt;
      city.resolveCircle(ped.pos, 0.5);
      ped.phase += dt * speed * 3.2;
      ped.mesh.rotation.y = ped.yaw;
      animateWalk(ped.mesh, ped.phase, clamp(speed / 5, 0.2, 1));
      if (ped.fleeTimer > 0) ped.fleeTimer -= dt;
    }
  }

  function updateOfficers(dt, playerPos) {
    for (let i = officers.length - 1; i >= 0; i--) {
      const off = officers[i];
      const d = distance2D(off.pos.x, off.pos.z, playerPos.x, playerPos.z);
      if (d > 90) {
        scene.remove(off.mesh);
        officers.splice(i, 1);
        continue;
      }
      const dx = playerPos.x - off.pos.x;
      const dz = playerPos.z - off.pos.z;
      const wantYaw = Math.atan2(dx, dz);
      let dyaw = wantYaw - off.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      off.yaw += clamp(dyaw, -5 * dt, 5 * dt);
      if (d > 14) {
        off.pos.x += Math.sin(off.yaw) * off.speed * dt;
        off.pos.z += Math.cos(off.yaw) * off.speed * dt;
        off.phase += dt * 10;
        animateWalk(off.mesh, off.phase, 1);
      } else {
        off.shootTimer -= dt;
        if (off.shootTimer <= 0) {
          off.shootTimer = rng.range(0.9, 1.6);
          G.combat.officerShot(off);
        }
        animateWalk(off.mesh, off.phase, 0);
      }
      city.resolveCircle(off.pos, 0.5);
      off.mesh.rotation.y = off.yaw;
    }
  }

  function removePed(ped) {
    scene.remove(ped.mesh);
    const i = peds.indexOf(ped);
    if (i >= 0) peds.splice(i, 1);
  }

  for (let i = 0; i < 18; i++) spawnPed();

  return { peds, officers, spawnPed, spawnOfficer, scarePeds, updatePeds, updateOfficers, removePed };
}
