// Story missions for Solmar Bay: five jobs that take Rico Vega from a welcome
// home to the big score. Each mission has a beacon in the world and a distance
// readout; finishing one pays out and starts the next.

import * as THREE from 'three';
import { dist2d } from './random.js';

const MISSION_DEFS = [
  {
    id: 0,
    name: 'Welcome Home',
    text: 'Head to the pier and meet your old friend Marco.',
    reward: 200,
    target: 'pier',
  },
  {
    id: 1,
    name: 'The Pickup',
    text: 'Pick up the getaway car at the park, then bring it to Rico\u2019s garage.',
    reward: 500,
    target: 'park',
  },
  {
    id: 2,
    name: 'Street Heat',
    text: 'Rival crew on the beach. Take out all four of them.',
    reward: 1000,
    target: 'beach',
  },
  {
    id: 3,
    name: 'Grand Larceny',
    text: 'Steal the gold luxury car by the marina and bring it to the garage.',
    reward: 2500,
    target: 'garage',
  },
  {
    id: 4,
    name: 'The Big Score',
    text: 'Hit Solmar Bank, survive the crew guarding it, then reach the north gate.',
    reward: 5000,
    target: 'bank',
  },
];

export class Missions {
  constructor(scene, city, crowd) {
    this.scene = scene;
    this.city = city;
    this.crowd = crowd;
    this.defs = MISSION_DEFS;
    this.current = 0;
    this.stage = 0;
    this.finished = false;
    this.spawned = 0;
    this.beacon = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 17;
    this.beacon.add(beam);
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.4),
      new THREE.MeshBasicMaterial({ color: 0xffd76e }),
    );
    marker.position.y = 5;
    this.beacon.add(marker);
    this.marker = marker;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.beacon.add(ring);
    this.scene.add(this.beacon);
    this.setBeacon(0, 0);
  }

  get def() {
    return this.defs[this.current];
  }

  setBeacon(x, z) {
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = true;
  }

  targetPos() {
    const L = this.city.landmarks;
    const d = this.def;
    if (!d) return null;
    if (d.id === 1) return this.stage === 0 ? L.park : L.garage;
    if (d.id === 4) {
      if (this.stage === 0) return L.bank;
      if (this.stage === 1) return L.bank;
      return L.northGate;
    }
    return L[d.target];
  }

  start(index) {
    this.current = index;
    this.stage = 0;
    this.finished = false;
    this.spawned = 0;
    this.crowd.clearEnemies();
    const L = this.city.landmarks;
    if (index === 2) {
      this.crowd.spawnEnemies(4, L.beach.x, L.beach.z);
      this.spawned = 4;
    } else if (index === 4) {
      // Enemies arrive when Rico reaches the bank.
      this.spawned = 0;
    }
    const t = this.targetPos();
    if (t) this.setBeacon(t.x, t.z);
  }

  objectiveText() {
    if (this.finished) return 'Story complete — Solmar Bay is yours. Free roam!';
    const d = this.def;
    if (!d) return '';
    let extra = '';
    if (d.id === 1) extra = this.stage === 0 ? ' (get to the park)' : ' (drive the car to the garage)';
    if (d.id === 2) {
      const left = this.crowd.livingEnemies().length;
      extra = ` (${this.spawned - left} of ${this.spawned} down)`;
    }
    if (d.id === 4) {
      if (this.stage === 0) extra = ' (reach the bank)';
      else if (this.stage === 1) extra = ` (${this.crowd.livingEnemies().length} guards left)`;
      else extra = ' (reach the north gate)';
    }
    return `${d.name}: ${d.text}${extra}`;
  }

  distanceTo(playerPos) {
    const t = this.targetPos();
    if (!t) return 0;
    return Math.round(dist2d(playerPos.x, playerPos.z, t.x, t.z));
  }

  complete(game) {
    const d = this.def;
    game.player.money += d.reward;
    game.saveData.missionsDone.push(d.id);
    game.saveData.money = game.player.money;
    game.store();
    game.audio.jingle();
    game.hud.setMessage(`${d.name} complete! +$${d.reward}`);
    if (d.id === 2) {
      game.combat.unlockSmg();
      game.player.setGunVisible(true);
      game.hud.setMessage(`${d.name} complete! +$${d.reward} — SMG unlocked (Q to switch)`);
      game.saveData.smg = true;
      game.store();
    }
    this.current++;
    if (this.current >= this.defs.length) {
      this.finished = true;
      this.beacon.visible = false;
      game.hud.setMessage('Story complete! Solmar Bay is yours, Rico.');
      return;
    }
    this.start(this.current);
  }

  update(dt, game) {
    if (this.finished) return;
    const d = this.def;
    const p = game.player.pos;
    const L = this.city.landmarks;
    this.marker.rotation.y += dt * 2;
    this.marker.position.y = 5 + Math.sin(performance.now() * 0.003) * 0.5;

    if (d.id === 0) {
      if (dist2d(p.x, p.z, L.pier.x, L.pier.z) < 7) this.complete(game);
    } else if (d.id === 1) {
      if (this.stage === 0) {
        if (dist2d(p.x, p.z, L.park.x, L.park.z) < 7) {
          this.stage = 1;
          game.hud.setMessage('Car is yours. Drive it to the garage!');
          const t = this.targetPos();
          if (t) this.setBeacon(t.x, t.z);
        }
      } else if (game.player.inCar && dist2d(p.x, p.z, L.garage.x, L.garage.z) < 9) {
        this.complete(game);
      }
    } else if (d.id === 2) {
      if (this.spawned > 0 && this.crowd.livingEnemies().length === 0) this.complete(game);
    } else if (d.id === 3) {
      const car = game.player.car;
      if (game.player.inCar && car && car.luxury && dist2d(p.x, p.z, L.garage.x, L.garage.z) < 9) {
        this.complete(game);
      }
    } else if (d.id === 4) {
      if (this.stage === 0) {
        if (dist2d(p.x, p.z, L.bank.x, L.bank.z) < 8) {
          this.stage = 1;
          this.crowd.spawnEnemies(6, L.bank.x, L.bank.z);
          this.spawned = 6;
          game.police.addWanted(2);
          game.hud.setMessage('The vault crew is here! Take them all out.');
        }
      } else if (this.stage === 1) {
        if (this.spawned > 0 && this.crowd.livingEnemies().length === 0) {
          this.stage = 2;
          game.hud.setMessage('Vault cleared! Get to the north gate!');
          const t = this.targetPos();
          if (t) this.setBeacon(t.x, t.z);
        }
      } else if (dist2d(p.x, p.z, L.northGate.x, L.northGate.z) < 8) {
        this.complete(game);
      }
    }
  }
}
