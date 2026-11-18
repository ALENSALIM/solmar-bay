// Solmar Bay city: a 9x9-block coastal grid with a central park, a beach,
// an ocean, a pier with a ferris wheel, palm trees and billboards.
// Roads run on a 48-unit pitch; blocks are 36 wide with 12-wide roads.
import * as THREE from 'three';

export const PITCH = 48;
export const ROAD_W = 12;
export const BLOCK = 36;
export const HALF = 216;
export const ROAD_LINES = [-216, -168, -120, -72, -24, 24, 72, 120, 168, 216];
export const BLOCK_CENTERS = [-192, -144, -96, -48, 0, 48, 96, 144, 192];

// Push a circle (pos, radius) out of every building AABB it overlaps.
export function pushOutOfColliders(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Center inside the box: push out along the smallest penetration axis.
        const px = Math.min(pos.x - c.minX + radius, c.maxX - pos.x + radius);
        const pz = Math.min(pos.z - c.minZ + radius, c.maxZ - pos.z + radius);
        if (px < pz) pos.x = (pos.x - c.minX < c.maxX - pos.x) ? c.minX - radius : c.maxX + radius;
        else pos.z = (pos.z - c.minZ < c.maxZ - pos.z) ? c.minZ - radius : c.maxZ + radius;
      }
    }
  }
}

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildingTexture(rng) {
  const base = rng.pick(['#8a7f72', '#7d8a96', '#967d6e', '#6e7d8a', '#a08b74', '#5f6b7a']);
  const lit = ['#ffd98a', '#ffe9b0', '#9fd8ff', '#ffd98a'];
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 2);
    for (let y = 14; y < h - 10; y += 22) {
      for (let x = 10; x < w - 10; x += 20) {
        ctx.fillStyle = rng.chance(0.45) ? rng.pick(lit) : '#2c3540';
        ctx.fillRect(x, y, 12, 14);
      }
    }
  });
}

function roadTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#26292f'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f5d76e';
    ctx.fillRect(w / 2 - 2, 0, 4, 26); ctx.fillRect(w / 2 - 2, 64, 4, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(6, 0, 3, h); ctx.fillRect(w - 9, 0, 3, h);
  });
}

function billboardTexture(text, bg, fg) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = 'bold 44px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 - 8);
    ctx.font = '20px Arial';
    ctx.fillText('SOLMAR BAY', w / 2, h / 2 + 34);
  });
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  const roadTex = roadTexture();
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;

  // Ground base.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ color: 0x77796b })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, 0, 0);
  group.add(ground);

  // Beach sand strip and ocean on the east side.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 480),
    new THREE.MeshLambertMaterial({ color: 0xd9c28a })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(251, 0.01, 0);
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 480),
    new THREE.MeshLambertMaterial({ color: 0x1d6f9e, transparent: true, opacity: 0.92 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(436, 0.02, 0);
  group.add(ocean);

  // Roads: one long strip per road line, both directions.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const line of ROAD_LINES) {
    const along = new THREE.Mesh(new THREE.PlaneGeometry(456, ROAD_W), roadMat);
    along.rotation.x = -Math.PI / 2;
    along.position.set(0, 0.03, line);
    group.add(along);
    const across = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 456), roadMat);
    across.rotation.x = -Math.PI / 2;
    across.position.set(line, 0.03, 0);
    group.add(across);
  }

  // Blocks: sidewalk slabs, park in the middle, buildings elsewhere.
  const parkBlocks = new Set(['3,3', '4,3', '3,4', '4,4']);
  const slabMat = new THREE.MeshLambertMaterial({ color: 0x9a9a8e });
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x4d8a4a });
  const buildingTexs = [buildingTexture(rng), buildingTexture(rng), buildingTexture(rng)];
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = 0; bx < 9; bx++) {
    for (let bz = 0; bz < 9; bz++) {
      const cx = BLOCK_CENTERS[bx];
      const cz = BLOCK_CENTERS[bz];
      const isPark = parkBlocks.has(`${bx},${bz}`);
      const slab = new THREE.Mesh(
        new THREE.PlaneGeometry(BLOCK + 2, BLOCK + 2),
        isPark ? parkMat : slabMat
      );
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, 0.04, cz);
      group.add(slab);
      if (isPark) continue;
      // One or two buildings per block, kept inside the block.
      const count = rng.chance(0.35) ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = rng.range(13, 26);
        const d = rng.range(13, 26);
        const h = rng.range(10, 52);
        const ox = count === 2 ? (i === 0 ? -8 : 8) : 0;
        const oz = count === 2 ? (i === 0 ? 6 : -6) : 0;
        const mat = new THREE.MeshLambertMaterial({ map: rng.pick(buildingTexs) });
        const b = new THREE.Mesh(buildingGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2, cz + oz);
        group.add(b);
        colliders.push({
          minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2,
        });
      }
    }
  }

  // Palm trees: along the beach and in the park.
  function makePalm(scale) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a48 })
    );
    trunk.position.y = 3.5;
    palm.add(trunk);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7d3a });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      palm.add(leaf);
    }
    palm.scale.setScalar(scale);
    return palm;
  }
  for (let z = -200; z <= 200; z += 40) {
    const palm = makePalm(rng.range(0.9, 1.3));
    palm.position.set(228 + rng.range(-4, 4), 0, z + rng.range(-8, 8));
    group.add(palm);
  }
  for (let i = 0; i < 10; i++) {
    const palm = makePalm(rng.range(0.8, 1.2));
    palm.position.set(rng.range(-48, 48), 0, rng.range(-48, 48));
    group.add(palm);
  }

  // Pier reaching east into the ocean, with a ferris wheel at its end.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9c7a52 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(96, 1.2, 12), pierMat);
  pier.position.set(264, 0.6, 0);
  group.add(pier);
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(306, 16, 0);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(13, 0.5, 8, 28),
    new THREE.MeshLambertMaterial({ color: 0xff5a7a })
  );
  wheelGroup.add(rim);
  const spokeMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 26, 0.4), spokeMat);
    spoke.rotation.z = (i / 6) * Math.PI;
    wheelGroup.add(spoke);
  }
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x3aa7ff });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2), cabinMat);
    cabin.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0);
    wheelGroup.add(cabin);
  }
  const support = new THREE.Mesh(new THREE.BoxGeometry(2, 16, 2), spokeMat);
  support.position.set(306, 8, 0);
  group.add(support);
  group.add(wheelGroup);

  // Billboards with the city's own brands.
  const boards = [
    { text: 'SOLMAR', bg: '#123a5c', fg: '#ffd76e', x: -168, z: -168 },
    { text: 'VEGA MOTORS', bg: '#5c1230', fg: '#ffffff', x: 120, z: 168 },
    { text: 'PIER 9', bg: '#0d5c3a', fg: '#ffe9b0', x: 168, z: -72 },
    { text: 'OCEAN VIEW', bg: '#7a4d12', fg: '#ffffff', x: -72, z: 120 },
  ];
  for (const b of boards) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 14, 6),
      new THREE.MeshLambertMaterial({ color: 0x555555 })
    );
    pole.position.set(b.x, 7, b.z);
    group.add(pole);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 11),
      new THREE.MeshLambertMaterial({ map: billboardTexture(b.text, b.bg, b.fg), side: THREE.DoubleSide })
    );
    face.position.set(b.x, 18, b.z);
    face.rotation.y = rng.pick([0, Math.PI / 2]);
    group.add(face);
  }

  // Lamp posts along the main roads.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const lampGlow = new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0xffdf80 });
  for (let i = 0; i < 24; i++) {
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(-200, 200);
    const horizontal = rng.chance(0.5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 5), lampMat);
    pole.position.set(horizontal ? along : line + 6.5, 3.5, horizontal ? line + 6.5 : along);
    group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampGlow);
    bulb.position.set(pole.position.x, 7.2, pole.position.z);
    group.add(bulb);
  }

  return {
    colliders,
    spawnPos: { x: -120, z: 72 },
    homePos: { x: -120, z: 120 },
    garagePos: { x: 168, z: -72 },
    bankPos: { x: 72, z: -120 },
    pickupPos: { x: -168, z: -48 },
    dropoffPos: { x: 120, z: 48 },
    cornerPos: { x: -24, z: 168 },
    safehousePos: { x: -120, z: 120 },
    goldCarPos: { x: 144, z: -120 },
    wheel: wheelGroup,
    ocean,
    bounds: { min: -216, max: 216 },
  };
}
