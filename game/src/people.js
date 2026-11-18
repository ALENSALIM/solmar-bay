// Pedestrians: simple figures that stroll the sidewalks, turning at
// intersections. They bob as they walk and scatter when a car gets close.
import * as THREE from 'three';
import { range, rangeInt, pick } from './random.js';
import { PITCH } from './city.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xecf0f1];

export function makeFigure(shirtColor, skinColor) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor || 0xc68642 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.9, 8), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.75;
  head.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), pants);
  legL.position.set(-0.12, 0.3, 0);
  const legR = legL.clone();
  legR.position.x = 0.12;
  g.add(body, head, legL, legR);
  g.userData.legs = [legL, legR];
  return g;
}

function sidewalkPoint(rng) {
  // On a road's edge: a road centre line plus a sidewalk offset.
  const horizontal = rng() < 0.5;
  const line = rangeInt(rng, -4, 4) * PITCH;
  const along = range(rng, -150, 150);
  const off = (rng() < 0.5 ? -1 : 1) * 8;
  return horizontal ? { x: along, z: line + off } : { x: line + off, z: along };
}

export function spawnPedestrians(W, count) {
  const rng = W.rng;
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = sidewalkPoint(rng);
    const mesh = makeFigure(pick(rng, SHIRTS));
    mesh.position.set(p.x, 0, p.z);
    W.scene.add(mesh);
    peds.push({
      mesh,
      pos: mesh.position,
      yaw: range(rng, 0, Math.PI * 2),
      speed: range(rng, 0.9, 1.6),
      target: null,
      turnAt: 0,
      phase: range(rng, 0, Math.PI * 2),
    });
  }
  W.peds = peds;
  return peds;
}

export function updatePedestrians(W, dt) {
  for (const p of W.peds) {
    // Pick a new target point on the sidewalk grid when idle or arrived.
    if (!p.target) {
      const t = sidewalkPoint(W.rng);
      p.target = t;
      p.yaw = Math.atan2(t.x - p.pos.x, t.z - p.pos.z);
    }
    const dx = p.target.x - p.pos.x;
    const dz = p.target.z - p.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      p.target = null;
      continue;
    }
    const want = Math.atan2(dx, dz);
    let dy = want - p.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    p.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
    p.pos.x += Math.sin(p.yaw) * p.speed * dt;
    p.pos.z += Math.cos(p.yaw) * p.speed * dt;
    p.mesh.rotation.y = p.yaw;
    // Walk bob + leg swing.
    p.phase += dt * 7;
    p.mesh.position.y = Math.abs(Math.sin(p.phase)) * 0.06;
    const [l, r] = p.mesh.userData.legs;
    l.rotation.x = Math.sin(p.phase) * 0.5;
    r.rotation.x = -Math.sin(p.phase) * 0.5;
  }
}
