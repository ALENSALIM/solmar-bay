// The 9x9-block coastal city of Solmar Bay: roads, buildings, a park, the
// beach and ocean, a pier with a ferris wheel, palms and billboards.
// Layout: roads run on the grid lines x = 36*m and z = 36*n (m, n in -4..4),
// blocks sit between them; the beach is east of x = 162, the ocean past 190.
import * as THREE from 'three';
import { range, rangeInt, pick } from './random.js';

export const PITCH = 36;
export const ROAD_W = 12;
export const CITY_EDGE = 162;
export const BEACH_X = 162;
export const OCEAN_X = 190;

const PALETTE = [0xe8b48c, 0xc9d6df, 0xf2e3c6, 0x9fb8a8, 0xd98a7a, 0x8fa3c7, 0xe6d28a, 0xb7a6d6];

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#2c3e55';
  for (let y = 8; y < 128; y += 16) {
    for (let x = 8; x < 64; x += 16) {
      g.fillRect(x, y, 9, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function billboardTexture(lines, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = fg;
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((line, i) => {
    g.fillText(line, 128, 64 + (i - (lines.length - 1) / 2) * 36);
  });
  return new THREE.CanvasTexture(c);
}

function box(w, h, d, color, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

export function buildCity(W) {
  const rng = W.rng;
  const scene = W.scene;
  const colliders = [];
  const solids = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground: city concrete, grass park handled by pads, sand, ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 420),
    new THREE.MeshLambertMaterial({ color: 0x9aa08e })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(110, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: dark strips on the grid lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8c8 });
  for (let m = -4; m <= 4; m++) {
    const vx = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CITY_EDGE * 2), roadMat);
    vx.rotation.x = -Math.PI / 2;
    vx.position.set(m * PITCH, 0.02, 0);
    vx.receiveShadow = true;
    group.add(vx);
    const hz = new THREE.Mesh(new THREE.PlaneGeometry(CITY_EDGE * 2, ROAD_W), roadMat);
    hz.rotation.x = -Math.PI / 2;
    hz.position.set(0, 0.02, m * PITCH);
    hz.receiveShadow = true;
    group.add(hz);
    // Centre dashes.
    for (let t = -CITY_EDGE + 9; t < CITY_EDGE; t += 18) {
      const d1 = box(0.6, 0.05, 3, 0xd8d8c8, m * PITCH, 0.04, t, dashMat);
      const d2 = box(3, 0.05, 0.6, 0xd8d8c8, t, 0.04, m * PITCH, dashMat);
      group.add(d1, d2);
    }
  }

  // Block pads and buildings. Park blocks: (0,0),(1,0),(0,1),(1,1) in block coords.
  const parkBlocks = new Set(['0,0', '1,0', '0,1', '1,1']);
  const winTex = windowTexture();
  const buildingMats = PALETTE.map(
    (c) => new THREE.MeshLambertMaterial({ color: c, map: winTex })
  );
  const padMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x5d9b4f });
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 4; j++) {
      const cx = i * PITCH + PITCH / 2;
      const cz = j * PITCH + PITCH / 2;
      const key = `${i},${j}`;
      if (parkBlocks.has(key)) {
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), grassMat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(cx, 0.03, cz);
        pad.receiveShadow = true;
        group.add(pad);
        continue;
      }
      // Beachfront column: no pads or buildings east of the beach line —
      // buildings there would stand on the sand and block the beach.
      if (cx >= BEACH_X) continue;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(cx, 0.03, cz);
      pad.receiveShadow = true;
      group.add(pad);
      const count = rangeInt(rng, 1, 3);
      for (let b = 0; b < count; b++) {
        const w = range(rng, 7, 11);
        const d = range(rng, 7, 11);
        const h = range(rng, 8, 42);
        const ox = range(rng, -5, 5);
        const oz = range(rng, -5, 5);
        const mat = pick(rng, buildingMats);
        const bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        bld.position.set(cx + ox, h / 2, cz + oz);
        bld.castShadow = true;
        bld.receiveShadow = true;
        solids.push(bld);
        group.add(bld);
        // Rooftop box.
        const roof = box(2, 1, 2, 0x555555, cx + ox, h + 0.5, cz + oz);
        group.add(roof);
        colliders.push({
          x0: cx + ox - w / 2, x1: cx + ox + w / 2,
          z0: cz + oz - d / 2, z1: cz + oz + d / 2,
        });
      }
    }
  }

  // Park: trees, pond, benches.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7d33 });
  const treePositions = [];
  for (let i = 0; i < 26; i++) {
    treePositions.push([range(rng, 6, 66), range(rng, 6, 66)]);
  }
  for (const [x, z] of treePositions) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 6), trunkMat);
    trunk.position.set(x, 1.5, z);
    trunk.castShadow = true;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 1.6, 2.6), 8, 6), leafMat);
    crown.position.set(x, 4.2, z);
    crown.castShadow = true;
    group.add(trunk, crown);
  }
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(9, 24),
    new THREE.MeshLambertMaterial({ color: 0x4d8fb5 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(36, 0.05, 36);
  group.add(pond);

  // Beach sand and ocean.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 420),
    new THREE.MeshLambertMaterial({ color: 0xe0c98f })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BEACH_X + 14, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 420),
    new THREE.MeshLambertMaterial({ color: 0x2e7fb8, transparent: true, opacity: 0.92 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(OCEAN_X + 120, -0.15, 0);
  group.add(ocean);

  // Palm trees along the beach.
  for (let z = -160; z <= 160; z += 22) {
    const x = BEACH_X + 6 + range(rng, -2, 4);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z + range(rng, -3, 3));
    trunk.rotation.z = range(rng, -0.12, 0.12);
    trunk.castShadow = true;
    group.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 4), leafMat);
      const a = (f / 5) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.2, 7.2, z + Math.sin(a) * 1.2);
      frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      group.add(frond);
    }
  }

  // Pier: planks out to sea, ferris wheel at the end.
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x8a6b45 });
  const pier = box(64, 0.8, 9, 0x8a6b45, OCEAN_X + 32, 1.2, 0, plankMat);
  pier.receiveShadow = true;
  group.add(pier);
  for (let x = OCEAN_X + 4; x < OCEAN_X + 62; x += 8) {
    const post = box(0.8, 3, 0.8, 0x5d4630, x, 0, -3.6);
    const post2 = box(0.8, 3, 0.8, 0x5d4630, x, 0, 3.6);
    group.add(post, post2);
  }
  const wheel = new THREE.Group();
  wheel.position.set(OCEAN_X + 58, 19, 0);
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.7, 8, 40), rimMat);
  wheel.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(15, 0.7, 8, 40), rimMat);
  rim2.position.z = 1.6;
  wheel.add(rim2);
  const spokeMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 30, 6), spokeMat);
    spoke.rotation.z = a;
    wheel.add(spoke);
  }
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0xffd23f });
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2), cabinMat);
    cabin.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0.8);
    cabin.castShadow = true;
    wheel.add(cabin);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.4, 10), spokeMat);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  group.add(wheel);
  const legL = box(1.2, 19, 1.2, 0x888888, OCEAN_X + 58, 9.5, -6);
  const legR = box(1.2, 19, 1.2, 0x888888, OCEAN_X + 58, 9.5, 6);
  group.add(legL, legR);

  // Billboards on tall poles.
  const boards = [
    { pos: [-72, -72], lines: ['SOLMAR', 'BAY'], bg: '#1e5aa8', fg: '#ffffff' },
    { pos: [108, 108], lines: ['VISIT THE', 'PIER'], bg: '#e74c3c', fg: '#ffffff' },
    { pos: [144, -108], lines: ["RICO'S", 'TACOS'], bg: '#f39c12', fg: '#222222' },
    { pos: [-108, 144], lines: ['OCEAN VIEW', 'HOTEL'], bg: '#27ae60', fg: '#ffffff' },
  ];
  for (const b of boards) {
    const pole = box(1, 14, 1, 0x666666, b.pos[0], 7, b.pos[1]);
    group.add(pole);
    const tex = billboardTexture(b.lines, b.bg, b.fg);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    board.position.set(b.pos[0], 18, b.pos[1]);
    board.rotation.y = Math.PI / 4;
    group.add(board);
    colliders.push({ x0: b.pos[0] - 1, x1: b.pos[0] + 1, z0: b.pos[1] - 1, z1: b.pos[1] + 1 });
  }

  // Clouds drifting overhead.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    for (let s = 0; s < 3; s++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 4, 8), 8, 6), cloudMat);
      puff.position.set(s * 6 - 6, range(rng, -1, 1), range(rng, -2, 2));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(range(rng, -180, 320), range(rng, 55, 85), range(rng, -180, 180));
    group.add(cloud);
    clouds.push(cloud);
  }

  W.city = { colliders, solids, ocean, wheel, clouds, parkRect: { x0: 6, x1: 66, z0: 6, z1: 66 } };
  return W.city;
}

export function updateCity(W, dt) {
  const c = W.city;
  c.wheel.rotation.z += dt * 0.12;
  c.ocean.position.y = -0.15 + Math.sin(W.time * 0.7) * 0.12;
  for (const cloud of c.clouds) {
    cloud.position.x += dt * 1.2;
    if (cloud.position.x > 340) cloud.position.x = -200;
  }
}

// Circle (x, z, radius) vs building AABBs: push the circle out. Returns true on hit.
export function collideCircle(W, x, z, r) {
  let hit = false;
  for (const c of W.city.colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1));
    const nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        return { hit: true, px: x + dx * push, pz: z + dz * push };
      }
      return { hit: true, px: x + r, pz: z };
    }
  }
  return { hit, px: x, pz: z };
}

// Clamp a position inside the playable bounds (city + beach, not the ocean).
export function clampBounds(x, z) {
  return {
    x: Math.max(-170, Math.min(186, x)),
    z: Math.max(-170, Math.min(170, z)),
  };
}
