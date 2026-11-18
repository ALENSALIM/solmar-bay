// The story of Rico Vega: five missions across Solmar Bay. Each mission is a list of
// steps — drive here, pick that up, survive this — with a marker in the world, a
// blip on the minimap and a line on the HUD. Finish one and the next unlocks.
import * as THREE from 'three';
import { distance2D } from './random.js';

const MISSIONS = [
  {
    id: 0,
    name: 'Welcome Home',
    giver: "Mama Lucia",
    brief: 'Rico is back in Solmar Bay after three years away. Drive to Mama Lucia’s cafe and say hello.',
    reward: 200,
    steps: [
      { type: 'goto', place: 'cafe', text: 'Drive to Mama Lucia’s Cafe', needCar: true },
      { type: 'talk', place: 'cafe', text: 'Talk to Mama Lucia (press F)', needCar: false },
    ],
  },
  {
    id: 1,
    name: 'The Pickup',
    giver: "Mama Lucia",
    brief: 'A package is waiting at the docks. Collect it and bring it back — and keep your head down.',
    reward: 500,
    steps: [
      { type: 'goto', place: 'docks', text: 'Collect the package at Solmar Docks' },
      { type: 'pickup', place: 'docks', text: 'Grab the package (press F)' },
      { type: 'goto', place: 'cafe', text: 'Bring the package back to the Cafe' },
    ],
  },
  {
    id: 2,
    name: 'Street Heat',
    giver: 'Dante',
    brief: 'Los Diablos jumped Dante at Freedom Plaza. Get there and send them packing.',
    reward: 800,
    steps: [
      { type: 'goto', place: 'plaza', text: 'Reach Freedom Plaza' },
      { type: 'defeat', place: 'plaza', text: 'Defeat the Diablos (0/5 down)', count: 5 },
    ],
  },
  {
    id: 3,
    name: 'Grand Larceny',
    giver: 'Dante',
    brief: 'A yellow Comet GT is parked up in the rich quarter. Steal it and bring it to Rico’s Garage.',
    reward: 1200,
    steps: [
      { type: 'goto', place: 'garage', text: 'A yellow Comet GT is waiting near the Garage — steal it', needCar: false, spawnCar: true },
      { type: 'deliver', place: 'garage', text: 'Deliver the Comet GT to the Garage', needCar: true },
    ],
  },
  {
    id: 4,
    name: 'The Big Score',
    giver: "Mama Lucia",
    brief: 'The Solmar Bay Bank. In, out, and gone before the whole force arrives. Then vanish to the Hideout.',
    reward: 5000,
    steps: [
      { type: 'goto', place: 'bank', text: 'Reach the Solmar Bay Bank' },
      { type: 'hold', place: 'bank', text: 'Crack the vault — hold F by the doors', holdSeconds: 5 },
      { type: 'escape', place: 'hideout', text: 'Escape to the Hideout — lose the cops or outrun them' },
    ],
  },
];

export function createMissions(G) {
  const { scene, city } = G;
  let index = 0;
  let stepIndex = 0;
  let active = false;
  let defeated = 0;
  let holdTimer = 0;
  let targetCar = null;
  let startedAt = 0;

  const markerGeo = new THREE.OctahedronGeometry(1.6);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.visible = false;
  scene.add(marker);
  const ringGeo = new THREE.RingGeometry(2.4, 3.0, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  function current() { return MISSIONS[index] || null; }
  function currentStep() {
    const m = current();
    return m ? m.steps[stepIndex] : null;
  }
  function placeOf(step) { return city.LANDMARKS[step.place]; }

  function showMarker(step) {
    const place = placeOf(step);
    marker.position.set(place.x, 7, place.z);
    ring.position.set(place.x, 0.15, place.z);
    marker.visible = true;
    ring.visible = true;
  }

  function hideMarker() {
    marker.visible = false;
    ring.visible = false;
  }

  function startMission(i) {
    index = i;
    stepIndex = 0;
    defeated = 0;
    holdTimer = 0;
    active = true;
    startedAt = G.time;
    const m = current();
    G.hud.setObjective(`${m.name} — ${m.giver}`, m.brief, '');
    G.hud.toast(`New mission: ${m.name}`);
    G.audio.pickup();
    enterStep();
  }

  function enterStep() {
    const step = currentStep();
    if (!step) return;
    if (step.type === 'defeat') {
      for (let i = 0; i < step.count; i++) {
        const a = (i / step.count) * Math.PI * 2;
        G.combat.spawnEnemy(placeOf(step).x + Math.cos(a) * 10, placeOf(step).z + Math.sin(a) * 10, 'Diablo');
      }
      defeated = 0;
    }
    if (step.spawnCar) {
      const place = placeOf(step);
      targetCar = G.vehicles.addCar('parked', place.x + 8, place.z + 4, 0.6, 0xf2c94c, 'Comet GT');
      G.hud.toast('There it is — the yellow Comet GT.');
    }
    if (step.type === 'goto' && step.needCar && !G.player.car) {
      G.hud.toast('You will need a car for this one.');
    }
    showMarker(step);
    updateObjectiveText();
  }

  function updateObjectiveText() {
    const m = current();
    const step = currentStep();
    if (!m || !step) return;
    let text = step.text;
    if (step.type === 'defeat') text = `Defeat the Diablos (${defeated}/${step.count} down)`;
    if (step.type === 'hold' && holdTimer > 0) text = `Cracking the vault… ${Math.ceil(step.holdSeconds - holdTimer)}s`;
    G.hud.setObjective(`${m.name} — ${m.giver}`, text, '');
  }

  function advanceStep() {
    stepIndex += 1;
    const m = current();
    if (stepIndex >= m.steps.length) {
      completeMission();
      return;
    }
    G.audio.pickup();
    enterStep();
  }

  function completeMission() {
    const m = current();
    active = false;
    hideMarker();
    // Record the completion before saving: saveGame derives missionsDone
    // from the mission index, so the index must already point past this one.
    // (Without this the save always lagged one mission behind, and reloading
    // restarted the mission that was just finished.)
    index = m.id + 1;
    G.player.money += m.reward;
    G.hud.toast(`Mission complete: ${m.name}  +$${m.reward}`);
    G.hud.setObjective('Solmar Bay', m.id === 4 ? 'The Big Score is done. Solmar Bay is yours — free roam.' : 'Mission complete. Head for the next marker when you are ready.', '');
    G.audio.missionDone();
    G.saveGame();
    if (m.id === 2) {
      G.player.ownedWeapons.push('smg');
      G.hud.toast('Dante gave you an SMG. Press Q to switch weapons.');
    }
    if (m.id < MISSIONS.length - 1) {
      window.setTimeout(() => {
        if (G.screen === 'play') startMission(m.id + 1);
      }, 2500);
    } else {
      G.hud.setObjective('Solmar Bay', 'Story complete! Free roam — steal cars, dodge the law, make the city yours.', '');
    }
  }

  function failMission(reason) {
    active = false;
    hideMarker();
    G.hud.toast(`Mission failed: ${reason}`);
    G.audio.missionFail();
    window.setTimeout(() => {
      if (G.screen === 'play') startMission(index);
    }, 2500);
  }

  function playerPosition() { return G.player.car ? G.player.car.pos : G.player.pos; }

  function update(dt, input) {
    marker.rotation.y += dt * 1.6;
    marker.position.y = 7 + Math.sin(G.time * 2) * 0.7;
    ring.scale.setScalar(1 + Math.sin(G.time * 2.4) * 0.12);
    if (!active || G.screen !== 'play') return;
    const m = current();
    const step = currentStep();
    if (!step) return;
    const place = placeOf(step);
    const pos = playerPosition();
    const d = distance2D(pos.x, pos.z, place.x, place.z);
    G.hud.setObjectiveDistance(d < 8 ? 'You are here' : `${Math.round(d)}m away`);

    if (step.type === 'goto' || step.type === 'deliver') {
      const ok = step.type === 'deliver' ? !!G.player.car : true;
      if (d < 8 && ok) {
        if (step.type === 'deliver' && targetCar && G.player.car !== targetCar) {
          G.hud.toast('That is not the Comet GT!');
          return;
        }
        advanceStep();
      }
    } else if (step.type === 'talk' || step.type === 'pickup') {
      if (d < 7 && input.wasPressed('interact')) {
        advanceStep();
      }
    } else if (step.type === 'defeat') {
      const down = step.count - G.combat.enemies.filter((e) => e.alive).length;
      if (down !== defeated) {
        defeated = down;
        updateObjectiveText();
      }
      if (defeated >= step.count) advanceStep();
    } else if (step.type === 'hold') {
      if (d < 9 && input.isDown('interact')) {
        holdTimer += dt;
        if (holdTimer >= step.holdSeconds) {
          G.police.addHeat(3, 'bank robbery');
          G.hud.toast('Vault cracked! RUN — the cops are coming!');
          advanceStep();
        } else {
          updateObjectiveText();
        }
      } else if (holdTimer > 0) {
        holdTimer = Math.max(0, holdTimer - dt * 2);
        updateObjectiveText();
      }
    } else if (step.type === 'escape') {
      if (d < 8) {
        if (G.police.stars > 0) {
          G.hud.toast('Lose the cops first — or just reach the Hideout.');
          advanceStep();
        } else {
          advanceStep();
        }
      }
    }
  }

  function startFirst() { startMission(0); }

  function applySave(doneIds) {
    index = Math.min(doneIds.length, MISSIONS.length - 1);
    if (doneIds.length >= MISSIONS.length) {
      index = MISSIONS.length - 1;
      active = false;
      G.hud.setObjective('Solmar Bay', 'Story complete! Free roam — steal cars, dodge the law, make the city yours.', '');
    }
  }

  return {
    MISSIONS, startMission, startFirst, update, failMission, applySave,
    get current() { return current(); },
    get currentStep() { return currentStep(); },
    get active() { return active; },
    get index() { return index; },
    get markerPosition() { return marker.visible ? marker.position : null; },
  };
}
