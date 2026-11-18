// Cars: box-built vehicles. Traffic cars loop the road grid; parked cars
// wait to be stolen. One car object serves both, with a `driven` flag for
// the player's current ride.
import * as THREE from 'three';
import { range, rangeInt, pick } from './random.js';
import { PITCH } from './city.js';

const CAR_COLORS = [0xd63031, 0x0984e3, 0xfdcb6e, 0x00b894, 0x6c5ce7, 0xe17055, 0x636e72, 0xffffff, 0x2d3436];

export function makeCarMesh(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.3), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  g.add(body, cabin);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export function makePoliceCarMesh() {
  const g = makeCarMesh(0xf5f6fa);
  const black = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 1.2), black);
  hood.position.set(0, 0.9, 1.2);
  g.add(hood);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: 0x888888 }));
  bar.position.set(0, 1.45, -0.25);
  g.add(bar);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  red.position.set(-0.28, 1.48, -0.25);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
  blue.position.set(0.28, 1.48, -0.25);
  g.add(red, blue);
  g.userData.lightRed = red;
  g.userData.lightBlue = blue;
  return g;
}

// A traffic car drives the road grid: at each intersection it may turn.
// `road` is its current road line (x or z multiple of PITCH), `axis` 'x'|'z'.
export function spawnTraffic(W, count) {
  const rng = W.rng;
  const cars = [];
  for (let i = 0; i < count; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = rangeInt(rng, -4, 4) * PITCH + (rng() < 0.5 ? -2.5 : 2.5);
    const along = range(rng, -150, 150);
    const mesh = makeCarMesh(pick(rng, CAR_COLORS));
    const dir = rng() < 0.5 ? 1 : -1;
    const pos = axis === 'x' ? { x: along, z: line } : { x: line, z: along };
    mesh.position.set(pos.x, 0, pos.z);
    mesh.rotation.y = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    W.scene.add(mesh);
    cars.push({
      mesh, axis, dir, speed: range(rng, 7, 11),
      pos: mesh.position, parked: false, wasParked: false, driven: false,
      turnCooldown: range(rng, 0, 4),
    });
  }
  W.traffic = cars;
  return cars;
}

export function spawnParked(W, count) {
  const rng = W.rng;
  const cars = [];
  for (let i = 0; i < count; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = rangeInt(rng, -4, 4) * PITCH + (rng() < 0.5 ? -4.2 : 4.2);
    const along = range(rng, -150, 150);
    const mesh = makeCarMesh(pick(rng, CAR_COLORS));
    const pos = axis === 'x' ? { x: along, z: line } : { x: line, z: along };
    mesh.position.set(pos.x, 0, pos.z);
    mesh.rotation.y = axis === 'x' ? Math.PI / 2 : 0;
    W.scene.add(mesh);
    cars.push({ mesh, axis, dir: 1, speed: 0, pos: mesh.position, parked: true, wasParked: true, driven: false });
  }
  W.parked = cars;
  return cars;
}

function snapToRoad(car, line) {
  // Keep the car on its road centre (with its lane offset) while it drives.
  if (car.axis === 'x') car.pos.z = line;
  else car.pos.x = line;
}

export function updateTraffic(W, dt) {
  for (const car of W.traffic) {
    if (car.driven) continue;
    car.turnCooldown -= dt;
    const lane = (car.axis === 'x' ? car.pos.z : car.pos.x);
    // Are we near an intersection (a crossing road line)?
    const along = car.axis === 'x' ? car.pos.x : car.pos.z;
    const nearest = Math.round(along / PITCH) * PITCH;
    if (Math.abs(along - nearest) < 1.2 && car.turnCooldown <= 0) {
      car.turnCooldown = range(W.rng, 3, 8);
      if (W.rng() < 0.45) {
        // Turn onto the crossing road.
        const newAxis = car.axis === 'x' ? 'z' : 'x';
        const newLine = nearest + (W.rng() < 0.5 ? -2.5 : 2.5);
        const newDir = W.rng() < 0.5 ? 1 : -1;
        car.axis = newAxis;
        car.dir = newDir;
        if (newAxis === 'x') {
          car.pos.z = newLine;
          car.mesh.rotation.y = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.pos.x = newLine;
          car.mesh.rotation.y = newDir > 0 ? 0 : Math.PI;
        }
      }
    }
    const step = car.speed * car.dir * dt;
    if (car.axis === 'x') car.pos.x += step;
    else car.pos.z += step;
    // U-turn at the city edge.
    const edge = 155;
    const a = car.axis === 'x' ? car.pos.x : car.pos.z;
    if (a > edge || a < -edge) {
      car.dir *= -1;
      car.mesh.rotation.y += Math.PI;
      snapToRoad(car, lane);
    }
    // Wheel spin.
    for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.36;
  }
}
