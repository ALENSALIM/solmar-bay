// Vehicles for Solmar Bay: a shared car mesh factory, parked cars you can steal
// and traffic cars that drive the road grid.

import * as THREE from 'three';
import { createRng, clamp, angleLerp } from './random.js';
import { ROAD_LINES, CITY_EDGE } from './city.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8b13c, 0x58b368, 0xd8d8d8, 0x333333, 0x8a5ab8, 0xe87a2e, 0x3aa8a0];

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), darkMat);
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x223344 }));
    bar.position.set(0, 1.72, -0.2);
    g.add(bar);
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lightL.position.set(-0.32, 1.78, -0.2);
    g.add(lightL);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    lightR.position.set(0.32, 1.78, -0.2);
    g.add(lightR);
    g.userData.lights = [lightL, lightR];
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Fleet {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = createRng(77003);
    this.parked = [];
    this.traffic = [];
    this.spawnParked();
    this.spawnTraffic(24);
  }

  addCar(kind, color, x, z, heading) {
    const mesh = makeCarMesh(color, kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = {
      mesh,
      kind,
      color,
      heading,
      speed: 0,
      maxSpeed: kind === 'police' ? 34 : 16,
      driver: kind === 'traffic',
      roadAxis: 'x',
      roadLine: 0,
      dir: 1,
      lane: 2.6,
      stuck: 0,
      hp: 100,
    };
    return car;
  }

  spawnParked() {
    const spots = [];
    for (const line of ROAD_LINES) {
      for (const d of [-154, -110, -66, -22, 22, 66, 110, 154]) {
        spots.push({ x: line, z: d, along: 'z' });
        spots.push({ x: d, z: line, along: 'x' });
      }
    }
    for (let i = 0; i < 14; i++) {
      const s = spots[this.rng.int(0, spots.length - 1)];
      const off = this.rng.pick([-7.6, 7.6]);
      const x = s.along === 'z' ? s.x + off : s.x;
      const z = s.along === 'z' ? s.z : s.z + off;
      const heading = s.along === 'z' ? this.rng.pick([0, Math.PI]) : this.rng.pick([Math.PI / 2, -Math.PI / 2]);
      const car = this.addCar('parked', this.rng.pick(CAR_COLORS), x, z, heading);
      this.parked.push(car);
    }
    // The luxury car for the Grand Larceny mission, parked by the marina.
    const luxe = this.addCar('parked', 0xf2d13c, 44, 154, Math.PI / 2);
    luxe.luxury = true;
    this.parked.push(luxe);
  }

  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const axis = this.rng.pick(['x', 'z']);
      const line = this.rng.pick(ROAD_LINES);
      const d = this.rng.range(-180, 180);
      const car = this.addCar('traffic', this.rng.pick(CAR_COLORS),
        axis === 'x' ? d : line, axis === 'x' ? line : d, 0);
      car.roadAxis = axis;
      car.roadLine = line;
      car.dir = this.rng.pick([-1, 1]);
      car.lane = this.rng.pick([-2.6, 2.6]);
      car.speed = this.rng.range(9, 15);
      car.heading = axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      this.traffic.push(car);
    }
  }

  nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.parked) {
      const dx = c.mesh.position.x - x;
      const dz = c.mesh.position.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  nearestDrivable(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.traffic) {
      const dx = c.mesh.position.x - x;
      const dz = c.mesh.position.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  stealParked(car) {
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
    car.kind = 'player';
    return car;
  }

  jackTraffic(car) {
    const i = this.traffic.indexOf(car);
    if (i >= 0) this.traffic.splice(i, 1);
    car.kind = 'player';
    car.driver = false;
    car.speed = 0;
    return car;
  }

  releasePlayerCar(car) {
    car.kind = 'parked';
    car.speed = 0;
    this.parked.push(car);
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    for (const list of [this.parked, this.traffic]) {
      const i = list.indexOf(car);
      if (i >= 0) list.splice(i, 1);
    }
  }

  update(dt, playerCar) {
    for (const c of this.traffic) {
      // Slow down for the car ahead on the same road.
      let ahead = false;
      for (const o of this.traffic) {
        if (o === c) continue;
        const dx = o.mesh.position.x - c.mesh.position.x;
        const dz = o.mesh.position.z - c.mesh.position.z;
        const along = c.roadAxis === 'x' ? dx * c.dir : dz * c.dir;
        const side = c.roadAxis === 'x' ? Math.abs(dz) : Math.abs(dx);
        if (along > 0 && along < 9 && side < 3) ahead = true;
      }
      const target = ahead ? 0 : c.maxSpeed;
      c.speed += clamp(target - c.speed, -14 * dt, 8 * dt);
      const step = c.speed * dt;
      if (c.roadAxis === 'x') {
        c.mesh.position.x += step * c.dir;
        c.mesh.position.z = c.roadLine + c.lane;
      } else {
        c.mesh.position.z += step * c.dir;
        c.mesh.position.x = c.roadLine + c.lane;
      }
      const atEdge = c.roadAxis === 'x'
        ? (c.dir > 0 ? c.mesh.position.x > CITY_EDGE : c.mesh.position.x < -CITY_EDGE)
        : (c.dir > 0 ? c.mesh.position.z > CITY_EDGE : c.mesh.position.z < -CITY_EDGE);
      if (atEdge) {
        // Turn onto a crossing road at the city edge.
        const other = this.rng.pick(ROAD_LINES);
        if (c.roadAxis === 'x') {
          c.mesh.position.x = clamp(c.mesh.position.x, -CITY_EDGE, CITY_EDGE);
          c.roadAxis = 'z';
          c.roadLine = other;
          c.dir = this.rng.pick([-1, 1]);
          c.lane = this.rng.pick([-2.6, 2.6]);
        } else {
          c.mesh.position.z = clamp(c.mesh.position.z, -CITY_EDGE, CITY_EDGE);
          c.roadAxis = 'x';
          c.roadLine = other;
          c.dir = this.rng.pick([-1, 1]);
          c.lane = this.rng.pick([-2.6, 2.6]);
        }
      }
      const wantHeading = c.roadAxis === 'x'
        ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (c.dir > 0 ? 0 : Math.PI);
      c.heading = angleLerp(c.heading, wantHeading, Math.min(1, dt * 4));
      c.mesh.rotation.y = c.heading;
      const spin = (c.speed * dt) / 0.42;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
    }
    // Keep parked cars still but spin nothing; player car is driven by Player.
    void playerCar;
  }
}
