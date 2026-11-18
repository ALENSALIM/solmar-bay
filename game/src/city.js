// Solmar Bay itself: a procedural sun-soaked coastal city. A grid of streets, pastel
// towers, a park, a beach and a pier, with the road graph the traffic drives on and
// the named places the story's missions visit.
import * as THREE from 'three';
import { clamp } from './random.js';

export const PITCH = 80;
export const ROAD_W = 14;
export const ROAD_COORDS = [-320, -240, -160, -80, 0, 80, 160, 240, 320];
export const CITY_MIN = -360;
export const CITY_MAX = 360;
export const BEACH_Z = 348;
export const OCEAN_Z = 412;

export const LANDMARKS = {
  cafe: { name: "Mama Lucia's Cafe", x: -236, z: -236 },
  docks: { name: 'Solmar Docks', x: 336, z: 40 },
  plaza: { name: 'Freedom Plaza', x: 0, z: 0 },
  garage: { name: "Rico's Garage", x: 236, z: 236 },
  bank: { name: 'Solmar Bay Bank', x: -76, z: 76 },
  hideout: { name: 'The Hideout', x: -276, z: 276 },
  hospital: { name: 'St. Marina Hospital', x: 276, z: -276 },
  policeStation: { name: 'Solmar PD HQ', x: 76, z: -76 },
  pier: { name: 'Sunset Pier', x: 120, z: 400 },
};

const BUILDING_COLORS = [0xf2e3c9, 0xe8a87c, 0x7fc8bc, 0xf4d35e, 0xffffff, 0xd98c8c, 0x9db8d2, 0xe8b4b8];
const SIGN_TEXTS = [
  { text: 'SOLMAR BAY', sub: 'WELCOME', x: -320, z: -352, color: '#ffd23e' },
  { text: 'BAY BURGER', sub: 'OPEN 24H', x: 160, z: -160, color: '#ff6b6b' },
  { text: 'NEON MOTEL', sub: 'VACANCY', x: -160, z: 160, color: '#7dff9a' },
  { text: 'OCEAN DRIVE', sub: 'BEACHFRONT', x: 240, z: 320, color: '#4fc3f7' },
];

function makeGroundTexture() {
  const S = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const g = canvas.getContext('2d');
  const W2 = 900; // world units the texture spans
  const OX = -450; const OZ = -430; // world origin of the texture
  const px = (x) => ((x - OX) / W2) * S;
  const pz = (z) => ((z - OZ) / W2) * S;
  const pw = (w) => (w / W2) * S;

  g.fillStyle = '#5d7d4a'; g.fillRect(0, 0, S, S); // grass base
  // Sand and ocean along the south edge.
  g.fillStyle = '#e8d5a3'; g.fillRect(0, pz(BEACH_Z), S, pz(OCEAN_Z) - pz(BEACH_Z));
  const ocean = g.createLinearGradient(0, pz(OCEAN_Z), 0, S);
  ocean.addColorStop(0, '#2a9db5'); ocean.addColorStop(1, '#155e8a');
  g.fillStyle = ocean; g.fillRect(0, pz(OCEAN_Z), S, S - pz(OCEAN_Z));
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 26; i++) g.fillRect(((i * 173) % S), pz(OCEAN_Z) + 6, 90, 5);
  // Blocks: sidewalk slabs.
  for (let bx = 0; bx < 8; bx++) {
    for (let bz = 0; bz < 8; bz++) {
      const x0 = ROAD_COORDS[bx] + ROAD_W / 2;
      const z0 = ROAD_COORDS[bz] + ROAD_W / 2;
      const w = PITCH - ROAD_W;
      if (bx === 3 && bz === 3) {
        g.fillStyle = '#4d8a4d'; // the park
        g.fillRect(px(x0), pz(z0), pw(w), pw(w));
        g.strokeStyle = '#d8cbb2'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(px(x0 + w / 2), pz(z0)); g.lineTo(px(x0 + w / 2), pz(z0 + w));
        g.moveTo(px(x0), pz(z0 + w / 2)); g.lineTo(px(x0 + w), pz(z0 + w / 2)); g.stroke();
      } else {
        g.fillStyle = '#b8b0a4';
        g.fillRect(px(x0), pz(z0), pw(w), pw(w));
      }
    }
  }
  // Roads: asphalt with dashes.
  g.fillStyle = '#2e3138';
  for (const c of ROAD_COORDS) {
    g.fillRect(px(c - ROAD_W / 2), 0, pw(ROAD_W), S);
    g.fillRect(0, pz(c - ROAD_W / 2), S, pw(ROAD_W));
  }
  g.fillStyle = '#f7d54d';
  for (const c of ROAD_COORDS) {
    for (let t = -400; t < 460; t += 16) {
      g.fillRect(px(c - 0.6), pz(t), pw(1.2), pw(7));
      g.fillRect(px(t), pz(c - 0.6), pw(7), pw(1.2));
    }
  }
  g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 3;
  for (const c of ROAD_COORDS) {
    g.beginPath(); g.moveTo(px(c - ROAD_W / 2 + 1), 0); g.lineTo(px(c - ROAD_W / 2 + 1), S); g.stroke();
    g.beginPath(); g.moveTo(px(c + ROAD_W / 2 - 1), 0); g.lineTo(px(c + ROAD_W / 2 - 1), S); g.stroke();
    g.beginPath(); g.moveTo(0, pz(c - ROAD_W / 2 + 1)); g.lineTo(S, pz(c - ROAD_W / 2 + 1)); g.stroke();
    g.beginPath(); g.moveTo(0, pz(c + ROAD_W / 2 - 1)); g.lineTo(S, pz(c + ROAD_W / 2 - 1)); g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#1c2f4a';
  for (let y = 12; y < 248; y += 24) {
    for (let x = 10; x < 120; x += 24) g.fillRect(x, y, 14, 14);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(text, sub, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 192;
  const g = canvas.getContext('2d');
  g.fillStyle = '#141824'; g.fillRect(0, 0, 512, 192);
  g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(6, 6, 500, 180);
  g.fillStyle = color; g.font = 'bold 64px Trebuchet MS, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 82);
  g.fillStyle = '#ffffff'; g.font = 'bold 34px Trebuchet MS, sans-serif';
  g.fillText(sub, 256, 148);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f6fb2');
  grad.addColorStop(0.55, '#7fb5dd');
  grad.addColorStop(0.8, '#ffb36b');
  grad.addColorStop(1, '#ff8f5e');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
}

export function createCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);

  // Sky dome and sun.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), skyMaterial());
  group.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(60, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sun.position.set(500, 260, -700);
  sun.lookAt(0, 0, 0);
  group.add(sun);

  const sunLight = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sunLight.position.set(220, 320, 140);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x4a6b4a, 0.85));
  scene.fog = new THREE.Fog(0xf2b878, 260, 1100);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 20);
  group.add(ground);

  // Ocean swell plane, slowly breathing.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 420),
    new THREE.MeshPhongMaterial({ color: 0x1e7fa8, transparent: true, opacity: 0.92, shininess: 120 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.4, 620);
  group.add(ocean);

  // Buildings, one shared box and window texture, tinted per building.
  const windowTex = makeWindowTexture();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const materials = BUILDING_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c, map: windowTex }));
  const colliders = [];
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5f6b });
  for (let bx = 0; bx < 8; bx++) {
    for (let bz = 0; bz < 8; bz++) {
      if (bx === 3 && bz === 3) continue; // the park
      const x0 = ROAD_COORDS[bx] + ROAD_W / 2 + 5;
      const z0 = ROAD_COORDS[bz] + ROAD_W / 2 + 5;
      const w = PITCH - ROAD_W - 10;
      const downtown = Math.abs(bx - 3.5) + Math.abs(bz - 3.5) <= 2;
      const count = rng.int(1, downtown ? 2 : 3);
      for (let i = 0; i < count; i++) {
        const bw = rng.range(w * 0.35, w * 0.62);
        const bd = rng.range(w * 0.35, w * 0.62);
        const bh = downtown ? rng.range(22, 68) : rng.range(9, 30);
        const cx = x0 + rng.range(0, w - bw) + bw / 2;
        const cz = z0 + rng.range(0, w - bd) + bd / 2;
        const mesh = new THREE.Mesh(boxGeo, rng.pick(materials));
        mesh.scale.set(bw, bh, bd);
        mesh.position.set(cx, bh / 2, cz);
        group.add(mesh);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.scale.set(bw * 0.3, 1.6, bd * 0.3);
        roof.position.set(cx + bw * 0.15, bh + 0.8, cz - bd * 0.12);
        group.add(roof);
        colliders.push({ minX: cx - bw / 2, maxX: cx + bw / 2, minZ: cz - bd / 2, maxZ: cz + bd / 2 });
      }
    }
  }

  // The park: trees, benches, a fountain.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafGeo = new THREE.ConeGeometry(3.2, 7, 7);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3f });
  const parkTrees = [];
  for (let i = 0; i < 14; i++) {
    const x = rng.range(-28, 28);
    const z = rng.range(-28, 28);
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue;
    parkTrees.push([x, z]);
  }
  for (const [x, z] of parkTrees) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 2.5, z);
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 8, z);
    group.add(leaves);
  }
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.6, 1.2, 16),
    new THREE.MeshPhongMaterial({ color: 0x9fd8e8, shininess: 80 }),
  );
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);

  // Palm trees along the beach and the boulevards (instanced: two draw calls).
  const palmSpots = [];
  for (let x = -320; x <= 320; x += 40) palmSpots.push([x + 8, BEACH_Z + 16]);
  for (let i = 0; i < 26; i++) palmSpots.push([rng.range(-320, 320), rng.pick(ROAD_COORDS) + 10]);
  const palmTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.45, 7, 6), trunkMat, palmSpots.length);
  const palmFrond = new THREE.InstancedMesh(new THREE.ConeGeometry(3.4, 4.5, 6), new THREE.MeshLambertMaterial({ color: 0x2f7d4f }), palmSpots.length);
  const dummy = new THREE.Object3D();
  palmSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3.5, z);
    dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(rng.range(0.85, 1.3));
    dummy.updateMatrix();
    palmTrunk.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 8.4;
    dummy.updateMatrix();
    palmFrond.setMatrixAt(i, dummy.matrix);
  });
  group.add(palmTrunk);
  group.add(palmFrond);

  // Streetlights along every road (instanced).
  const lampSpots = [];
  for (const c of ROAD_COORDS) {
    for (let t = -280; t <= 280; t += 80) {
      lampSpots.push([c + 8, t]);
      lampSpots.push([t, c + 8]);
    }
  }
  const lampPole = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.16, 7, 5),
    new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
    lampSpots.length,
  );
  const lampHead = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.45, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
    lampSpots.length,
  );
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    lampPole.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 7.1;
    dummy.updateMatrix();
    lampHead.setMatrixAt(i, dummy.matrix);
  });
  group.add(lampPole);
  group.add(lampHead);

  // Billboards with the city's own signs.
  for (const sign of SIGN_TEXTS) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 9.75),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(sign.text, sign.sub, sign.color) }),
    );
    mesh.position.set(sign.x, 16, sign.z);
    mesh.rotation.y = sign.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(mesh);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 1), roofMat);
    post.position.set(sign.x, 6, sign.z);
    group.add(post);
  }

  // Sunset Pier: planks out over the water and a slow ferris wheel.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 90), new THREE.MeshLambertMaterial({ color: 0x8a6b45 }));
  pier.position.set(LANDMARKS.pier.x, 1.2, 440);
  group.add(pier);
  const wheel = new THREE.Group();
  wheel.position.set(LANDMARKS.pier.x, 26, 470);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.8, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshLambertMaterial({ color: [0xff6b6b, 0x4fc3f7, 0x7dff9a, 0xf4d35e][i % 4] }));
    cabin.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    wheel.add(cabin);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6, 8), roofMat);
  axle.rotation.x = Math.PI / 2;
  wheel.add(axle);
  group.add(wheel);

  // Road graph: nodes at every intersection, edges along each road.
  const nodes = [];
  const nodeIndex = new Map();
  for (const x of ROAD_COORDS) {
    for (const z of ROAD_COORDS) {
      nodeIndex.set(`${x},${z}`, nodes.length);
      nodes.push({ x, z });
    }
  }
  const edges = [];
  for (let i = 0; i < ROAD_COORDS.length; i++) {
    for (let j = 0; j < ROAD_COORDS.length; j++) {
      const a = nodeIndex.get(`${ROAD_COORDS[i]},${ROAD_COORDS[j]}`);
      if (i + 1 < ROAD_COORDS.length) edges.push([a, nodeIndex.get(`${ROAD_COORDS[i + 1]},${ROAD_COORDS[j]}`)]);
      if (j + 1 < ROAD_COORDS.length) edges.push([a, nodeIndex.get(`${ROAD_COORDS[i]},${ROAD_COORDS[j + 1]}`)]);
    }
  }
  const adjacency = nodes.map(() => []);
  for (const [a, b] of edges) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }

  function nearestNode(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function randomNode() { return rng.int(0, nodes.length - 1); }

  function nearestRoadPoint(x, z) {
    // Snap to the closest road centreline.
    let bx = ROAD_COORDS[0];
    let bz = ROAD_COORDS[0];
    for (const c of ROAD_COORDS) {
      if (Math.abs(c - x) < Math.abs(bx - x)) bx = c;
      if (Math.abs(c - z) < Math.abs(bz - z)) bz = c;
    }
    if (Math.abs(bx - x) < Math.abs(bz - z)) return { x: bx, z };
    return { x, z: bz };
  }

  function collides(x, z, radius) {
    if (x < CITY_MIN + radius || x > CITY_MAX - radius || z < CITY_MIN + radius || z > 430 - radius) return true;
    for (const b of colliders) {
      if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) return true;
    }
    return false;
  }

  function resolveCircle(pos, radius) {
    // Push a circle out of every building it overlaps; returns true when it moved.
    let moved = false;
    for (const b of colliders) {
      const cx = clamp(pos.x, b.minX, b.maxX);
      const cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
        moved = true;
      } else if (d2 <= 0.0001) {
        pos.x = b.maxX + radius;
        moved = true;
      }
    }
    pos.x = clamp(pos.x, CITY_MIN + radius, CITY_MAX - radius);
    pos.z = clamp(pos.z, CITY_MIN + radius, 430 - radius);
    return moved;
  }

  return {
    group, nodes, adjacency, colliders, wheel, ocean, LANDMARKS,
    nearestNode, randomNode, nearestRoadPoint, collides, resolveCircle,
  };
}
