// The screenshot scenes behind ?shot=start|drive|chase|combat. Each one stages the
// real game — the same world, the same rules — in a fixed state, so the frame is what
// play really looks like and the same seed always gives the same frame.
import { distance2D } from './random.js';

function placePlayerInCar(G, x, z, yaw, color, name) {
  const car = G.vehicles.addCar('parked', x, z, yaw, color, name);
  G.player.pos.set(x, 0, z);
  G.player.tryEnterCar();
  return car;
}

function scatterTrafficNear(G, x, z, count) {
  let placed = 0;
  let attempt = 0;
  for (const car of G.vehicles.cars) {
    if (placed >= count) break;
    if (car.kind !== 'traffic' && car.kind !== 'taxi') continue;
    const angle = (attempt / count) * Math.PI * 2;
    attempt += 1;
    const spot = G.city.nearestRoadPoint(x + Math.cos(angle) * 26, z + Math.sin(angle) * 26);
    // The snap can land a car on the staging road right next to the player —
    // keep the road by the player clear so nothing blocks the camera.
    if (distance2D(spot.x, spot.z, x, z) < 15) continue;
    car.pos.x = spot.x;
    car.pos.z = spot.z;
    car.yaw = Math.atan2(x - spot.x, z - spot.z);
    car.targetNode = G.city.nearestNode(spot.x, spot.z);
    placed++;
  }
}

/**
 * Stage the named scene on the live game object and return the screen to draw.
 * The caller paints a few frames, then sets window.__shotReady.
 */
function snapChaseCamera(G) {
  // Put the camera exactly where the chase cam will sit, so the first painted
  // frame is already framed right — the camera lerp only needs to hold it,
  // not travel from wherever the boot left it. The offset matches
  // updateCamera exactly: the camera sits opposite the facing direction,
  // i.e. target + (-sin(camYaw), -cos(camYaw)) * dist.
  const p = G.player;
  const target = p.car ? p.car.pos : p.pos;
  const dist = p.car ? 10.5 : 6.5;
  const height = p.car ? 4.6 : 3.1;
  const fx = -Math.sin(p.camYaw);
  const fz = -Math.cos(p.camYaw);
  const cy = target.y + height + Math.sin(p.camPitch) * dist * 0.6;
  G.camera.position.set(target.x + fx * dist, cy, target.z + fz * dist);
  G.camera.lookAt(target.x, target.y + 1.6, target.z);
}

export function stageShot(G, name) {
  const p = G.player;
  G.screen = 'play';
  G.hud.show();
  if (name === 'drive') {
    p.money = 1250;
    placePlayerInCar(G, -40, 320, 0, 0xd93030, 'Comet GT');
    p.car.speed = 24;
    scatterTrafficNear(G, -40, 320, 6);
    G.missions.startMission(0);
    G.hud.setObjective('Welcome Home — Mama Lucia', 'Drive to Mama Lucia’s Cafe', '210m away');
    snapChaseCamera(G);
    return 'play';
  }
  if (name === 'chase') {
    p.money = 3400;
    placePlayerInCar(G, 120, 0, Math.PI / 2, 0xf2c94c, 'Comet GT');
    p.car.speed = 30;
    G.police.setWanted(3);
    // Flank the player ahead of the camera's view, as if cutting them off:
    // cars trailing directly behind would sit behind the chase camera.
    G.police.pursuitCars.forEach((car, i) => {
      car.pos.x = 120 + 14 + i * 9;
      car.pos.z = i % 2 === 0 ? -11 : 12;
      car.yaw = Math.PI / 2;
      car.speed = 26;
    });
    scatterTrafficNear(G, 120, 0, 4);
    G.hud.setObjective('The Big Score — Mama Lucia', 'Escape to the Hideout — lose the cops or outrun them', '540m away');
    G.hud.toast('WANTED — 3 stars! The whole force is after you.');
    snapChaseCamera(G);
    return 'play';
  }
  if (name === 'combat') {
    p.money = 2100;
    p.weapon = 'pistol';
    const plaza = G.city.LANDMARKS.plaza;
    G.missions.startMission(2);
    // Jump straight to the shootout for the staged frame: the mission's
    // defeat step only spawns the Diablos after the goto step completes,
    // so spawn their ring now and put Rico at the plaza edge facing them.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      G.combat.spawnEnemy(plaza.x + Math.cos(a) * 10, plaza.z + Math.sin(a) * 10, 'Diablo');
    }
    p.pos.set(plaza.x, 0, plaza.z + 18);
    // Face the plaza from the road south of it, so the chase camera behind
    // Rico sits on the open road too (a diagonal spot put the camera inside
    // a building and the collision lift flattened the frame top-down).
    // Facing is (sin(camYaw), cos(camYaw)): camYaw PI faces -z, toward the plaza.
    p.camYaw = Math.PI;
    p.yaw = p.camYaw;
    G.hud.setObjective('Street Heat — Dante', 'Defeat the Diablos (0/5 down)', '');
    snapChaseCamera(G);
    return 'play';
  }
  // start: the title screen over the city at golden hour.
  G.screen = 'title';
  p.pos.set(60, 0, 330);
  p.camYaw = Math.PI;
  G.camera.position.set(60, 42, 180);
  G.camera.lookAt(0, 18, 320);
  G.hud.hide();
  return 'title';
}

export function stageShotCamera(G, name, t) {
  // A slow orbit for the title scene; the play scenes use the chase camera.
  if (name !== 'start') return;
  const a = t * 0.08;
  G.camera.position.set(Math.sin(a) * 180, 46 + Math.sin(t * 0.3) * 6, 320 - Math.cos(a) * 120);
  G.camera.lookAt(0, 14, 300);
}
