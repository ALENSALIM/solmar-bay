// Every car in Solmar Bay: the player's ride, traffic and police. Cars are built from
// boxes (body, cabin, wheels, lights), drive on the road graph, and the player's car
// uses simple arcade physics: throttle, brake, steering that bites with speed.
import * as THREE from 'three';
import { clamp, distance2D } from './random.js';

export const CAR_COLORS = [0xd93030, 0x2f6fd0, 0xf2c94c, 0x2fbf71, 0xe8e8e8, 0x22242a, 0xff8c42, 0x9b59d0];
export const CAR_NAMES = ['Comet GT', 'Sunset Cruiser', 'Bay Runner', 'Palm Sedan', 'Dune Buggy', 'Ocean Taxi', 'Neon Coupe', 'Harbor Van'];

const POLICE_COLOR = 0x1a1d24;

function buildCarMesh(color, isPolice, isTaxi) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 90 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x10151f, shininess: 140 });
  const trimMat = new THREE.MeshPhongMaterial({ color: 0x14161c, shininess: 40 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.9), bodyMat);
  hood.position.set(0, 0.9, 1.7);
  group.add(hood);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.3), trimMat);
  bumperF.position.set(0, 0.32, 2.2);
  group.add(bumperF);
  const bumperB = bumperF.clone();
  bumperB.position.z = -2.2;
  group.add(bumperB);
  const lightGeo = new THREE.BoxGeometry(0.34, 0.16, 0.08);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.65, 0.65]) {
    const head = new THREE.Mesh(lightGeo, headMat);
    head.position.set(sx, 0.62, 2.26);
    group.add(head);
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(sx, 0.62, -2.26);
    group.add(tail);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.5), trimMat);
    bar.position.set(0, 1.5, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.33, 1.5, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.33, 1.5, -0.2);
    group.add(blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
  }
  if (isTaxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xf2c94c }));
    sign.position.set(0, 1.5, -0.2);
    group.add(sign);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, trimMat);
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  // A soft blob shadow under the car.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5.0),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);
  return group;
}

export function createVehicles(G) {
  const { scene, city, rng } = G;
  const cars = [];
  let idCounter = 1;

  function addCar(kind, x, z, yaw, color, name) {
    const isPolice = kind === 'police';
    const isTaxi = kind === 'taxi';
    const mesh = buildCarMesh(color, isPolice, isTaxi);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
    const car = {
      id: idCounter++, kind, name: name || 'Car', mesh,
      pos: mesh.position, yaw, speed: 0, steer: 0,
      targetNode: -1, nextNode: -1, stuck: 0, occupied: false,
      cruise: rng.range(9, 15), driver: null, isPolice,
      health: 100, brakeLight: false,
    };
    cars.push(car);
    return car;
  }

  function randomParkedSpot() {
    // Parked along a road's edge, facing along it.
    const horizontal = rng.chance(0.5);
    const road = rng.pick([-320, -240, -160, -80, 0, 80, 160, 240, 320]);
    const along = rng.range(-300, 300);
    const side = rng.chance(0.5) ? 5.4 : -5.4;
    if (horizontal) return { x: along, z: road + side, yaw: rng.chance(0.5) ? 0 : Math.PI };
    return { x: road + side, z: along, yaw: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i++) {
      const node = city.randomNode();
      const n = city.nodes[node];
      const color = rng.pick(CAR_COLORS);
      const kind = rng.chance(0.12) ? 'taxi' : 'traffic';
      const car = addCar(kind, n.x + rng.range(-3, 3), n.z + rng.range(-3, 3), rng.range(0, Math.PI * 2), color, rng.pick(CAR_NAMES));
      car.targetNode = node;
      pickNextNode(car);
    }
  }

  function spawnParked(count) {
    for (let i = 0; i < count; i++) {
      const spot = randomParkedSpot();
      const color = rng.pick(CAR_COLORS);
      addCar('parked', spot.x, spot.z, spot.yaw, color, rng.pick(CAR_NAMES));
    }
  }

  function pickNextNode(car) {
    const options = city.adjacency[car.targetNode].filter((n) => n !== car.nextNode);
    const next = options.length ? rng.pick(options) : rng.pick(city.adjacency[car.targetNode]);
    car.nextNode = car.targetNode;
    car.targetNode = next;
  }

  function lanePoint(car) {
    // Right-hand traffic: offset the lane to the right of the direction of travel.
    const from = city.nodes[car.nextNode];
    const to = city.nodes[car.targetNode];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;
    const t = clamp(1 - distance2D(car.pos.x, car.pos.z, to.x, to.z) / len, 0, 1);
    const cx = from.x + dx * t;
    const cz = from.z + dz * t;
    return { x: cx + nz * 3.2, z: cz - nx * 3.2, yaw: Math.atan2(dx, dz) };
  }

  function driveTraffic(car, dt) {
    const goal = lanePoint(car);
    const targetYaw = goal.yaw;
    let dyaw = targetYaw - car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    car.yaw += clamp(dyaw, -1.6 * dt, 1.6 * dt);
    // Slow for the car ahead.
    let slow = false;
    for (const other of cars) {
      if (other === car || other.kind === 'parked') continue;
      const d = distance2D(car.pos.x, car.pos.z, other.pos.x, other.pos.z);
      if (d < 9) {
        const ahead = (other.pos.x - car.pos.x) * Math.sin(car.yaw) + (other.pos.z - car.pos.z) * Math.cos(car.yaw);
        if (ahead > 0 && ahead < 9) slow = true;
      }
    }
    const want = slow ? 0 : car.cruise;
    car.speed += clamp(want - car.speed, -14 * dt, 8 * dt);
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    car.mesh.rotation.y = car.yaw;
    if (distance2D(car.pos.x, car.pos.z, city.nodes[car.targetNode].x, city.nodes[car.targetNode].z) < 6) {
      pickNextNode(car);
    }
  }

  function drivePlayerCar(car, dt, input) {
    const throttle = (input.isDown('forward') ? 1 : 0) - (input.isDown('back') ? 0.85 : 0);
    const steerInput = (input.isDown('left') ? 1 : 0) - (input.isDown('right') ? 1 : 0);
    const handbrake = input.isDown('run');
    const topSpeed = 42;
    const accel = throttle > 0 ? 16 : 22;
    car.speed += throttle * accel * dt;
    if (!input.isDown('forward') && !input.isDown('back')) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
    car.speed = clamp(car.speed, -14, topSpeed);
    const steerAmount = steerInput * 0.55 * clamp(Math.abs(car.speed) / 10, 0.25, 1) * (handbrake ? 1.5 : 1);
    car.yaw += steerAmount * Math.sign(car.speed || 1) * dt * (car.speed >= 0 ? 1 : -1) * 1.4;
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    const hitBuilding = city.resolveCircle(car.pos, 2.4);
    if (hitBuilding && Math.abs(car.speed) > 6) {
      G.audio.crash();
      car.speed *= 0.35;
      G.player.damage(4);
    }
    // Bump into other cars.
    for (const other of cars) {
      if (other === car) continue;
      const d = distance2D(car.pos.x, car.pos.z, other.pos.x, other.pos.z);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) / 2;
        const nx = (car.pos.x - other.pos.x) / d;
        const nz = (car.pos.z - other.pos.z) / d;
        car.pos.x += nx * push;
        car.pos.z += nz * push;
        if (other.kind !== 'parked') {
          other.pos.x -= nx * push;
          other.pos.z -= nz * push;
          other.speed = car.speed * 0.4;
        }
        if (Math.abs(car.speed) > 8) {
          G.audio.crash();
          car.speed *= 0.6;
          if (other.kind === 'traffic' || other.kind === 'taxi') G.police.addHeat(1, 'hit and run');
        }
      }
    }
    car.mesh.rotation.y = car.yaw;
    const wheels = car.mesh.userData.wheels;
    const spin = car.speed * dt * 1.4;
    for (const wheel of wheels) wheel.rotation.x += spin;
    if (wheels.length >= 2) {
      wheels[0].rotation.y = steerInput * 0.35;
      wheels[1].rotation.y = steerInput * 0.35;
    }
    return Math.abs(car.speed) / topSpeed;
  }

  function nearestCar(x, z, maxDist, kinds) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (kinds && !kinds.includes(car.kind)) continue;
      const d = distance2D(x, z, car.pos.x, car.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function update(dt, input) {
    for (const car of cars) {
      if (car.kind === 'traffic' || car.kind === 'taxi') driveTraffic(car, dt);
      if (car.isPolice && car.pursuing) {
        // Police pursuit is driven by police.js through drivePoliceCar.
      }
      if (car.mesh.userData.lightRed) {
        const flash = Math.floor(G.time * 6) % 2 === 0;
        car.mesh.userData.lightRed.material.color.setHex(flash ? 0xff2222 : 0x550000);
        car.mesh.userData.lightBlue.material.color.setHex(flash ? 0x000055 : 0x2266ff);
      }
    }
    if (G.player.car) {
      const speed01 = drivePlayerCar(G.player.car, dt, input);
      G.audio.setEngine(speed01, true);
    } else {
      G.audio.setEngine(0, false);
    }
  }

  function removeCar(car) {
    scene.remove(car.mesh);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  spawnTraffic(12);
  spawnParked(14);

  return { cars, addCar, nearestCar, update, removeCar, drivePlayerCar, pickNextNode };
}
