// Solmar Bay city: a coastal 9x9 road grid with buildings, a park, a beach and
// ocean, a pier with a ferris wheel, palms and billboards. All geometry is built
// in code; window and sign art is drawn on canvases at load time.

import * as THREE from 'three';
import { createRng, clamp } from './random.js';

export const ROAD_LINES = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
export const CITY_EDGE = 200;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTexture(rng, base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 22) {
      for (let x = 8; x < w - 8; x += 18) {
        g.fillStyle = rng.chance(0.28) ? lit : 'rgba(20,28,44,0.9)';
        g.fillRect(x, y, 11, 14);
      }
    }
  });
}

function signTexture(text, sub, bg, fg) {
  return canvasTexture(512, 192, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg;
    g.font = 'bold 64px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 - 22);
    g.font = '28px Arial, sans-serif';
    g.fillText(sub, w / 2, h / 2 + 52);
  });
}

export function buildCity(scene) {
  const rng = createRng(20261118);
  const colliders = [];
  const animated = { ferris: null, foam: [] };

  const addCollider = (x, z, hw, hd) => {
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
  };

  // --- ground, beach and ocean
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    new THREE.MeshLambertMaterial({ color: 0x5d8a4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -60);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 44),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, 206);
  sand.receiveShadow = true;
  scene.add(sand);

  const oceanMat = new THREE.MeshPhongMaterial({ color: 0x1b6fb0, shininess: 90, transparent: true, opacity: 0.94 });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1100, 500), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.05, 480);
  scene.add(ocean);

  for (let i = 0; i < 5; i++) {
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 2.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(-160 + i * 80, 0.12, 226 + (i % 2) * 4);
    scene.add(foam);
    animated.foam.push(foam);
  }

  // --- roads and sidewalks
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const line of ROAD_LINES) {
    for (const horizontal of [true, false]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(404, 18), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(horizontal ? 0 : line, 0.01, horizontal ? line : 0);
      if (!horizontal) walk.rotation.z = Math.PI / 2;
      walk.receiveShadow = true;
      scene.add(walk);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(404, 12), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(horizontal ? 0 : line, 0.02, horizontal ? line : 0);
      if (!horizontal) road.rotation.z = Math.PI / 2;
      road.receiveShadow = true;
      scene.add(road);
      for (let d = -190; d <= 190; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horizontal ? d : line, 0.03, horizontal ? line : d);
        if (!horizontal) dash.rotation.z = Math.PI / 2;
        scene.add(dash);
      }
    }
  }

  // --- buildings
  const blockCenters = [-154, -110, -66, -22, 22, 66, 110, 154];
  const special = new Set(['-66,-66', '66,66', '110,-110']);
  const bases = ['#b8a88e', '#8fa3b8', '#c2b49a', '#9a8f7a', '#a8b8c2', '#c9a68a'];
  const textures = bases.map((b) => windowTexture(rng, b, '#ffd98a'));
  let ti = 0;
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (bz >= 176) continue; // beach row stays open
      if (special.has(`${bx},${bz}`)) continue;
      const count = rng.int(1, 3);
      for (let k = 0; k < count; k++) {
        const w = rng.range(10, 18);
        const d = rng.range(10, 18);
        const h = rng.range(9, 42);
        const x = bx + rng.range(-8, 8);
        const z = bz + rng.range(-8, 8);
        const tex = textures[ti++ % textures.length];
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2, z);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x4a4440 }),
        );
        roof.position.set(x, h + 0.35, z);
        scene.add(roof);
        addCollider(x, z, w / 2 + 0.4, d / 2 + 0.4);
      }
    }
  }

  // --- park at block (-66,-66)
  const park = new THREE.Mesh(
    new THREE.CircleGeometry(20, 24),
    new THREE.MeshLambertMaterial({ color: 0x4d7d3a }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(-66, 0.04, -66);
  park.receiveShadow = true;
  scene.add(park);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(6, 20),
    new THREE.MeshPhongMaterial({ color: 0x3f9fd8, shininess: 120 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-70, 0.06, -62);
  scene.add(pond);
  for (let i = 0; i < 7; i++) {
    makeTree(scene, -82 + rng.range(0, 32), -82 + rng.range(0, 32), rng);
  }
  for (let i = 0; i < 3; i++) {
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.5, 1),
      new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
    );
    bench.position.set(-78 + i * 10, 0.5, -78);
    scene.add(bench);
  }

  // --- palms along the beach and the park edge
  for (let x = -180; x <= 180; x += 30) {
    makePalm(scene, x + rng.range(-6, 6), 188 + rng.range(0, 6), rng);
  }
  for (let i = 0; i < 5; i++) makePalm(scene, -88 + rng.range(0, 44), -88, rng);

  // --- beach umbrellas
  for (let i = 0; i < 6; i++) {
    const x = -150 + i * 60;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 3, 6),
      new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }),
    );
    pole.position.set(x, 1.5, 198);
    scene.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1.1, 10),
      new THREE.MeshLambertMaterial({ color: i % 2 ? 0xe86a5a : 0x4a90d9 }),
    );
    top.position.set(x, 3.4, 198);
    top.castShadow = true;
    scene.add(top);
  }

  // --- pier and ferris wheel
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(14, 1, 86),
    new THREE.MeshLambertMaterial({ color: 0x8a6a44 }),
  );
  pier.position.set(0, 0.6, 262);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);
  for (const px of [-5.5, 5.5]) {
    for (let z = 226; z <= 300; z += 18) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 3, 6),
        new THREE.MeshLambertMaterial({ color: 0x5d4630 }),
      );
      post.position.set(px, 0, z);
      scene.add(post);
    }
  }
  const wheel = new THREE.Group();
  wheel.position.set(0, 22, 292);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(15, 0.7, 8, 32),
    new THREE.MeshLambertMaterial({ color: 0xe8b13c }),
  );
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 30, 6),
      new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
    );
    spoke.position.set(Math.cos(a) * 0, Math.sin(a) * 0, 0);
    spoke.rotation.z = a + Math.PI / 2;
    spoke.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0);
    // spoke runs from hub to rim: place its center halfway and rotate it
    spoke.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0);
    wheel.add(spoke);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: [0xe86a5a, 0x4a90d9, 0x58b368, 0xf2d13c][i % 4] }),
    );
    cabin.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0);
    cabin.castShadow = true;
    wheel.add(cabin);
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 2, 12),
    new THREE.MeshLambertMaterial({ color: 0x333333 }),
  );
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  scene.add(wheel);
  animated.ferris = wheel;
  const legMat = new THREE.MeshLambertMaterial({ color: 0x6a6a6a });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 24, 8), legMat);
    leg.position.set(s * 8, 11, 292);
    leg.rotation.z = s * 0.32;
    scene.add(leg);
  }

  // --- billboards
  const signs = [
    { text: 'SOLMAR BAY', sub: 'sun • sea • streets', bg: '#123a5c', fg: '#ffd76e', x: -88, z: 30 },
    { text: 'PIER 9', sub: 'ferris wheel • arcade', bg: '#5c1a1a', fg: '#ffffff', x: 88, z: -30 },
    { text: 'MARINA CASINO', sub: 'open all night', bg: '#1a4d2e', fg: '#ffe9a8', x: 44, z: -132 },
    { text: 'SURF & SUN', sub: 'boards • lessons • rentals', bg: '#8a5a1a', fg: '#ffffff', x: -132, z: 132 },
  ];
  for (const s of signs) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.8, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x555555 }),
    );
    pole.position.set(s.x, 5, s.z);
    scene.add(pole);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 6),
      new THREE.MeshLambertMaterial({ map: signTexture(s.text, s.sub, s.bg, s.fg), side: THREE.DoubleSide }),
    );
    board.position.set(s.x, 13, s.z);
    board.rotation.y = rng.range(0, Math.PI);
    scene.add(board);
    addCollider(s.x, s.z, 0.8, 0.8);
  }

  // --- bank (mission target) and garage (mission target)
  const bank = new THREE.Mesh(
    new THREE.BoxGeometry(22, 14, 16),
    new THREE.MeshLambertMaterial({ color: 0xd8cdb8 }),
  );
  bank.position.set(110, 7, -110);
  bank.castShadow = true;
  scene.add(bank);
  const bankSign = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 3.4),
    new THREE.MeshLambertMaterial({ map: signTexture('SOLMAR BANK', 'vaults • loans • gold', '#123a5c', '#ffffff'), side: THREE.DoubleSide }),
  );
  bankSign.position.set(110, 12, -101.4);
  scene.add(bankSign);
  addCollider(110, -110, 11.4, 8.4);

  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(20, 7, 14),
    new THREE.MeshLambertMaterial({ color: 0x7a7f88 }),
  );
  garage.position.set(66, 3.5, 66);
  garage.castShadow = true;
  scene.add(garage);
  const garageSign = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 2.6),
    new THREE.MeshLambertMaterial({ map: signTexture("RICO'S GARAGE", 'no questions asked', '#3a3a3a', '#ffd76e'), side: THREE.DoubleSide }),
  );
  garageSign.position.set(66, 6.2, 73.4);
  scene.add(garageSign);
  addCollider(66, 66, 10.4, 7.4);

  function collides(x, z, r) {
    for (const c of colliders) {
      const cx = clamp(x, c.minX, c.maxX);
      const cz = clamp(z, c.minZ, c.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return c;
    }
    return null;
  }

  function resolveCircle(pos, r) {
    const c = collides(pos.x, pos.z, r);
    if (!c) return false;
    const cx = clamp(pos.x, c.minX, c.maxX);
    const cz = clamp(pos.z, c.minZ, c.maxZ);
    let dx = pos.x - cx;
    let dz = pos.z - cz;
    let len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.001) {
      // Center is inside the box: push out along the smallest penetration axis.
      const pl = pos.x - c.minX;
      const pr = c.maxX - pos.x;
      const pt = pos.z - c.minZ;
      const pb = c.maxZ - pos.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) pos.x = c.minX - r;
      else if (m === pr) pos.x = c.maxX + r;
      else if (m === pt) pos.z = c.minZ - r;
      else pos.z = c.maxZ + r;
      return true;
    }
    dx /= len;
    dz /= len;
    pos.x = cx + dx * r;
    pos.z = cz + dz * r;
    return true;
  }

  let t = 0;
  return {
    colliders,
    landmarks: {
      pier: { x: 0, z: 252 },
      park: { x: -66, z: -66 },
      garage: { x: 66, z: 52 },
      bank: { x: 110, z: -96 },
      beach: { x: -110, z: 176 },
      northGate: { x: 0, z: -176 },
      ferris: { x: 0, z: 292 },
    },
    collides,
    resolveCircle,
    update(dt) {
      t += dt;
      if (animated.ferris) animated.ferris.rotation.z += dt * 0.12;
      animated.foam.forEach((f, i) => {
        f.position.z = 226 + (i % 2) * 4 + Math.sin(t * 0.7 + i) * 1.6;
        f.material.opacity = 0.4 + 0.2 * Math.sin(t * 0.9 + i * 1.7);
      });
    },
  };
}

function makeTree(scene, x, z, rng) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, 3.4, 7),
    new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  );
  trunk.position.set(x, 1.7, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x3f7a34 }),
  );
  top.position.set(x, 4.4, z);
  top.scale.y = 0.85;
  top.castShadow = true;
  scene.add(top);
}

function makePalm(scene, x, z, rng) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.45, 6, 7),
    new THREE.MeshLambertMaterial({ color: 0x8a6a44 }),
  );
  trunk.position.set(x, 3, z);
  trunk.rotation.z = rng.range(-0.08, 0.08);
  trunk.castShadow = true;
  scene.add(trunk);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 4.4, 5),
      new THREE.MeshLambertMaterial({ color: 0x4d9a3a }),
    );
    frond.position.set(x + Math.cos(a) * 1.7, 6.2, z + Math.sin(a) * 1.7);
    frond.rotation.z = Math.cos(a) * 1.1;
    frond.rotation.x = -Math.sin(a) * 1.1;
    scene.add(frond);
  }
}
