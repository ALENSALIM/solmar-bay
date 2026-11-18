// The law: a wanted level from 0 to 5 stars. Crimes add heat; the police send cars
// that ram and chase, and officers on foot at three stars and up. Lay low and the
// heat fades; get caught on foot and it is over.
import { clamp, distance2D } from './random.js';

export function createPolice(G) {
  const { city, rng } = G;
  let stars = 0;
  let heat = 0;
  let lastCrimeAt = -100;
  let decayTimer = 0;
  let spawnTimer = 0;
  let officerTimer = 0;
  let sirenTimer = 0;
  const pursuitCars = [];

  function wantedLevel() { return stars; }

  function addHeat(amount, crime) {
    if (G.screen !== 'play') return;
    heat += amount;
    lastCrimeAt = G.time;
    const next = clamp(Math.floor(heat), 0, 5);
    if (next > stars) {
      stars = next;
      G.hud.toast(stars >= 3 ? `WANTED — ${stars} stars! The whole force is after you.` : `Wanted level ${stars} star${stars > 1 ? 's' : ''}.`);
      G.audio.sirenBlip();
    }
  }

  function clearWanted() {
    stars = 0;
    heat = 0;
    for (const car of pursuitCars) G.vehicles.removeCar(car);
    pursuitCars.length = 0;
    for (const off of G.people.officers.slice()) {
      G.scene.remove(off.mesh);
      G.people.officers.splice(G.people.officers.indexOf(off), 1);
    }
  }

  function spawnPursuitCar() {
    const p = G.player;
    const angle = rng.range(0, Math.PI * 2);
    const spot = city.nearestRoadPoint(p.pos.x + Math.sin(angle) * 55, p.pos.z + Math.cos(angle) * 55);
    const car = G.vehicles.addCar('police', spot.x, spot.z, rng.range(0, Math.PI * 2), 0x1a1d24, 'Interceptor');
    car.pursuing = true;
    car.cruise = 20;
    pursuitCars.push(car);
    return car;
  }

  function drivePursuit(car, dt) {
    const p = G.player;
    const target = p.car ? p.car.pos : p.pos;
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, dz);
    let dyaw = wantYaw - car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const steer = clamp(dyaw, -1.8 * dt, 1.8 * dt);
    car.yaw += steer;
    const wantSpeed = d > 12 ? 30 : 16;
    car.speed += clamp(wantSpeed - car.speed, -20 * dt, 14 * dt);
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    city.resolveCircle(car.pos, 2.4);
    car.mesh.rotation.y = car.yaw;
    // Ram the player.
    if (p.car && d < 4.6) {
      p.car.speed *= 0.82;
      car.speed *= 0.7;
      G.audio.crash();
      p.damage(3, 'police');
    } else if (!p.car && d < 2.6) {
      // Caught on foot: the bust meter runs in update().
      car.speed = 0;
    }
    const wheels = car.mesh.userData.wheels;
    for (const wheel of wheels) wheel.rotation.x += car.speed * dt * 1.4;
  }

  let bustTimer = 0;

  function update(dt) {
    if (G.screen !== 'play') return;
    const p = G.player;
    // Wanted decays when the player has been clean for a while.
    if (stars > 0 && G.time - lastCrimeAt > 14) {
      decayTimer += dt;
      if (decayTimer > 10) {
        decayTimer = 0;
        heat = Math.max(0, heat - 1);
        stars = clamp(Math.floor(heat), 0, 5);
        if (stars === 0) {
          G.hud.toast('You lost them. The heat is off.');
          clearWanted();
        }
      }
    } else {
      decayTimer = 0;
    }
    // Keep the right number of pursuit cars on the road.
    const wantCars = stars === 0 ? 0 : stars === 1 ? 1 : stars === 2 ? 2 : stars === 3 ? 3 : 4;
    spawnTimer -= dt;
    if (pursuitCars.length < wantCars && spawnTimer <= 0) {
      spawnTimer = 3;
      spawnPursuitCar();
    }
    if (pursuitCars.length > wantCars) {
      const extra = pursuitCars.pop();
      G.vehicles.removeCar(extra);
    }
    for (const car of pursuitCars) drivePursuit(car, dt);
    // Officers on foot at 3 stars and up.
    officerTimer -= dt;
    if (stars >= 3 && G.people.officers.length < stars - 1 && officerTimer <= 0) {
      officerTimer = 5;
      const angle = rng.range(0, Math.PI * 2);
      G.people.spawnOfficer(
        clamp(p.pos.x + Math.sin(angle) * 25, -350, 350),
        clamp(p.pos.z + Math.cos(angle) * 25, -350, 420),
      );
    }
    // Siren wail while wanted.
    if (stars > 0) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 4;
        G.audio.sirenBlip();
      }
    }
    // Busted: a pursuit car sits on the player on foot.
    const nearCop = pursuitCars.some((car) => distance2D(car.pos.x, car.pos.z, p.pos.x, p.pos.z) < 3.2);
    if (nearCop && !p.car) {
      bustTimer += dt;
      if (bustTimer > 1.2) {
        bustTimer = 0;
        G.gameOver('busted');
      }
    } else {
      bustTimer = 0;
    }
  }

  function setWanted(n) {
    // For staged screenshot scenes: set the wanted level and put the pursuit
    // cars on the road at once.
    stars = clamp(n, 0, 5);
    heat = stars;
    lastCrimeAt = G.time;
    while (pursuitCars.length < (stars === 0 ? 0 : stars === 1 ? 1 : stars === 2 ? 2 : stars === 3 ? 3 : 4)) {
      spawnPursuitCar();
    }
  }

  return { addHeat, clearWanted, update, wantedLevel, setWanted, get stars() { return stars; }, pursuitCars };
}
