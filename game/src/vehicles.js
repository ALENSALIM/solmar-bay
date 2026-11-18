// Traffic and parked cars for Solmar Bay. Traffic cars follow the road
// grid, turn at intersections and wrap around the city edge; parked cars sit
// at curbs waiting to be stolen. Police cars are built by the same factory.
import * as THREE from 'three';
import { ROAD_LINES, BLOCK_CENTERS } from './city.js';

const CAR_COLORS = [0xd23c2e, 0x2e6fd2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x222222, 0x8a5fc0, 0xe07b2e];

export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x181c22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 2.0), paint);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.8), glass);
  cabin.position.set(-0.2, 1.4, 0);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xccb060 });
  for (const wz of [0.6, -0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), lightMat);
    lamp.position.set(2.22, 0.7, wz);
    group.add(lamp);
  }
  if (isPolice) {
    const barMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 1.2), barMat);
    bar.position.set(-0.2, 1.9, 0);
    group.add(bar);
    const red = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 });
    const blue = new THREE.MeshLambertMaterial({ color: 0x2266ff, emissive: 0x0022aa });
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.5), red);
    r.position.set(-0.2, 2.05, 0.32);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.5), blue);
    b.position.set(-0.2, 2.05, -0.32);
    group.add(r); group.add(b);
    group.userData.lightRed = r;
    group.userData.lightBlue = b;
  }
  return group;
}

export class Traffic {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.cars = [];
    this.flashT = 0;
  }

  spawnTraffic(count) {
    for (let i = 0; i < count; i++) {
      const axis = this.rng.chance(0.5) ? 'x' : 'z';
      const line = this.rng.pick(ROAD_LINES);
      const along = this.rng.range(-210, 210);
      const dir = this.rng.sign();
      const car = this.makeCar(this.rng.pick(CAR_COLORS), false);
      car.axis = axis;
      car.dir = dir;
      car.lane = this.rng.pick([-3, 3]);
      car.speed = this.rng.range(7, 13);
      car.maxSpeed = car.speed;
      car.pos.set(axis === 'x' ? along : line + car.lane, 0, axis === 'x' ? line + car.lane : along);
      car.heading = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.cars.push(car);
    }
  }

  spawnParked(spots) {
    const parked = [];
    for (const spot of spots) {
      const car = this.makeCar(this.rng.pick(CAR_COLORS), false);
      car.isParked = true;
      car.speed = 0;
      car.pos.set(spot.x, 0, spot.z);
      car.heading = spot.heading || 0;
      car.parkSpot = spot;
      parked.push(car);
      this.cars.push(car);
    }
    return parked;
  }

  makeCar(color, isPolice) {
    const group = makeCarMesh(color, isPolice);
    this.scene.add(group);
    const car = {
      group, pos: group.position, heading: 0, speed: 0, maxSpeed: 12,
      axis: 'x', dir: 1, lane: 3, isParked: false, isPolice,
      isPlayer: false, isGold: false, color, turnCooldown: 0,
    };
    group.rotation.y = 0;
    return car;
  }

  makePoliceCar() {
    const car = this.makeCar(0xf2f2f2, true);
    car.maxSpeed = 26;
    car.speed = 0;
    return car;
  }

  removeCar(car) {
    this.scene.remove(car.group);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  nearestCar(pos, maxDist, parkedOnly) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.isPlayer) continue;
      if (parkedOnly && !car.isParked) continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  update(dt, playerCar) {
    this.flashT += dt;
    const flash = Math.floor(this.flashT * 6) % 2 === 0;
    for (const car of this.cars) {
      if (car.isPolice && car.group.userData.lightRed) {
        car.group.userData.lightRed.material.emissive.setHex(flash ? 0xff0000 : 0x220000);
        car.group.userData.lightBlue.material.emissive.setHex(flash ? 0x000022 : 0x0033ff);
      }
      if (car.isParked || car.isPlayer) continue;
      // Slow down if another car is right ahead.
      let targetSpeed = car.maxSpeed;
      const fx = Math.cos(car.heading);
      const fz = -Math.sin(car.heading);
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * -fz + dz * fx);
        if (ahead > 0 && ahead < 9 && side < 2.6) { targetSpeed = Math.min(targetSpeed, 2); break; }
      }
      if (playerCar && playerCar !== car) {
        const dx = playerCar.pos.x - car.pos.x;
        const dz = playerCar.pos.z - car.pos.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * -fz + dz * fx);
        if (ahead > 0 && ahead < 10 && side < 3) targetSpeed = Math.min(targetSpeed, 1.5);
      }
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
      car.pos.x += Math.cos(car.heading) * car.speed * dt;
      car.pos.z += -Math.sin(car.heading) * car.speed * dt;
      // Turn at intersections sometimes.
      car.turnCooldown -= dt;
      if (car.turnCooldown <= 0) {
        const onX = ROAD_LINES.some((l) => Math.abs(car.pos.x - l) < 4);
        const onZ = ROAD_LINES.some((l) => Math.abs(car.pos.z - l) < 4);
        if (onX && onZ && this.rng.chance(0.35)) {
          car.axis = car.axis === 'x' ? 'z' : 'x';
          car.dir = this.rng.sign();
          car.heading = car.axis === 'x'
            ? (car.dir > 0 ? 0 : Math.PI)
            : (car.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
          car.turnCooldown = 4;
        }
      }
      // Wrap around the city edge.
      if (car.pos.x > 222) car.pos.x = -222;
      if (car.pos.x < -222) car.pos.x = 222;
      if (car.pos.z > 222) car.pos.z = -222;
      if (car.pos.z < -222) car.pos.z = 222;
      car.group.rotation.y = car.heading;
    }
  }
}

export function curbSpots(rng, count) {
  const spots = [];
  for (let i = 0; i < count; i++) {
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(-190, 190);
    const horizontal = rng.chance(0.5);
    spots.push({
      x: horizontal ? along : line + 5.2,
      z: horizontal ? line + 5.2 : along,
      heading: horizontal ? 0 : Math.PI / 2,
    });
  }
  return spots;
}

export { BLOCK_CENTERS };
