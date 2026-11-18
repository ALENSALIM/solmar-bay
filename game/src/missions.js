// Rico Vega's story: five missions across Solmar Bay. Each mission is a
// short chain of stages (go somewhere, take someone out, steal a car,
// deliver it, grab the cash) with a glowing beacon marking the objective.
import * as THREE from 'three';

export const MISSION_DEFS = [
  {
    name: 'Welcome Home', reward: 200,
    stages: [
      { type: 'goto', pos: 'homePos', radius: 6, text: 'Go home to Rico\u2019s house' },
    ],
  },
  {
    name: 'The Pickup', reward: 500,
    stages: [
      { type: 'goto', pos: 'pickupPos', radius: 5, text: 'Pick up the package' },
      { type: 'goto', pos: 'dropoffPos', radius: 5, text: 'Deliver the package to the drop-off' },
    ],
  },
  {
    name: 'Street Heat', reward: 1000, unlocksSmg: true,
    stages: [
      { type: 'goto', pos: 'cornerPos', radius: 8, text: 'Reach the corner crew' },
      { type: 'kill', pos: 'cornerPos', count: 3, text: 'Take out the corner crew' },
    ],
  },
  {
    name: 'Grand Larceny', reward: 2000,
    stages: [
      { type: 'steal', text: 'Steal the gold car' },
      { type: 'deliver', pos: 'garagePos', radius: 7, text: 'Deliver the gold car to the garage' },
    ],
  },
  {
    name: 'The Big Score', reward: 5000,
    stages: [
      { type: 'goto', pos: 'bankPos', radius: 8, text: 'Reach the bank' },
      { type: 'kill', pos: 'bankPos', count: 4, text: 'Take out the bank guards' },
      { type: 'grab', pos: 'bankPos', radius: 5, text: 'Grab the cash' },
      { type: 'goto', pos: 'safehousePos', radius: 6, text: 'Escape to the safehouse' },
    ],
  },
];

export class MissionManager {
  constructor(G) {
    this.G = G;
    this.index = 0;
    this.stageIdx = 0;
    this.done = false;
    this.objective = { text: '', pos: null };
    this.stageEnemies = [];
    this.beacon = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd23c, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 36, 14, 1, true), beamMat);
    beam.position.y = 18;
    this.beacon.add(beam);
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 3, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd23c })
    );
    arrow.position.y = 38;
    arrow.rotation.x = Math.PI;
    this.beacon.add(arrow);
    this.beaconArrow = arrow;
    this.beacon.visible = false;
    G.scene.add(this.beacon);
    this.time = 0;
  }

  resolvePos(stage) {
    if (!stage.pos) return null;
    const p = this.G.city[stage.pos];
    return p ? { x: p.x, z: p.z } : null;
  }

  startMission(i) {
    this.index = i;
    this.stageIdx = 0;
    this.done = false;
    if (i >= MISSION_DEFS.length) {
      this.done = true;
      this.objective = { text: 'Free roam \u2014 Solmar Bay is yours', pos: null };
      this.beacon.visible = false;
      return;
    }
    this.setupStage();
  }

  setupStage() {
    const def = MISSION_DEFS[this.index];
    const stage = def.stages[this.stageIdx];
    this.stageEnemies = [];
    if (stage.type === 'kill') {
      const center = this.resolvePos(stage);
      const spots = [];
      for (let k = 0; k < stage.count; k++) {
        const a = (k / stage.count) * Math.PI * 2 + 0.6;
        spots.push({ x: center.x + Math.cos(a) * 7, z: center.z + Math.sin(a) * 7 });
      }
      this.stageEnemies = this.G.people.spawnEnemies(spots);
    }
    this.refreshObjective();
  }

  refreshObjective() {
    const def = MISSION_DEFS[this.index];
    if (!def) return;
    const stage = def.stages[this.stageIdx];
    let text = stage.text;
    if (stage.type === 'kill') {
      const alive = this.stageEnemies.filter((e) => e.alive).length;
      const killed = this.stageEnemies.length - alive;
      text = `${stage.text} (${killed}/${this.stageEnemies.length})`;
    }
    this.objective = { text, pos: this.resolvePos(stage) };
  }

  currentText() {
    if (this.done) return this.objective.text;
    const def = MISSION_DEFS[this.index];
    return `Mission ${this.index + 1}: ${def.name} \u2014 ${this.objective.text}`;
  }

  debugComplete() {
    // Test hook: finish the current mission at once.
    const def = MISSION_DEFS[this.index];
    if (!def) return;
    this.completeMission();
  }

  completeStage() {
    const def = MISSION_DEFS[this.index];
    this.G.audio.pickup();
    this.stageIdx += 1;
    if (this.stageIdx >= def.stages.length) this.completeMission();
    else this.setupStage();
  }

  completeMission() {
    const def = MISSION_DEFS[this.index];
    this.G.people.clearEnemies();
    this.G.onReward(def.reward);
    if (def.unlocksSmg) this.G.onSmgUnlocked();
    this.G.hud.toast(`Mission complete: ${def.name}  +$${def.reward}`);
    this.index += 1;
    if (this.index >= MISSION_DEFS.length) {
      this.done = true;
      this.objective = { text: 'Free roam \u2014 Solmar Bay is yours', pos: null };
      this.beacon.visible = false;
      this.G.onAllDone();
      return;
    }
    this.G.saveProgress();
    this.startMission(this.index);
    this.G.hud.toast(`New mission: ${MISSION_DEFS[this.index].name}`);
  }

  update(dt) {
    this.time += dt;
    if (this.done) return;
    const def = MISSION_DEFS[this.index];
    const stage = def.stages[this.stageIdx];
    const player = this.G.player;
    const pos = player.inCar ? player.inCar.pos : player.pos;
    let finished = false;
    if (stage.type === 'goto' || stage.type === 'grab') {
      const target = this.resolvePos(stage);
      if (target && Math.hypot(pos.x - target.x, pos.z - target.z) < stage.radius) {
        finished = true;
      }
    } else if (stage.type === 'kill') {
      const alive = this.stageEnemies.filter((e) => e.alive).length;
      if (alive === 0) finished = true;
      else this.refreshObjective();
    } else if (stage.type === 'steal') {
      if (player.inCar && player.inCar.isGold) finished = true;
    } else if (stage.type === 'deliver') {
      const target = this.resolvePos(stage);
      if (player.inCar && player.inCar.isGold && target &&
          Math.hypot(player.inCar.pos.x - target.x, player.inCar.pos.z - target.z) < stage.radius) {
        finished = true;
      }
    }
    if (finished) this.completeStage();
    // Beacon follows the objective.
    if (this.objective.pos) {
      this.beacon.visible = true;
      this.beacon.position.set(this.objective.pos.x, 0, this.objective.pos.z);
      this.beaconArrow.position.y = 38 + Math.sin(this.time * 3) * 1.5;
      this.beacon.rotation.y += dt * 0.8;
    } else {
      this.beacon.visible = false;
    }
  }
}
