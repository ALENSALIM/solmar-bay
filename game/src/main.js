// Solmar Bay: the game itself. Wires the city, vehicles, people, player, police,
// combat, missions, HUD, audio and input together and runs the frame loop.

import * as THREE from 'three';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { Combat } from './combat.js';
import { Fleet } from './vehicles.js';
import { Crowd } from './people.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { loadSave, storeSave, defaultSave } from './save.js';
import { stageScene } from './shots.js';
import { clamp } from './random.js';

export class Game {
  constructor() {
    this.state = 'title';
    this.staged = null;
    this.camYaw = Math.PI;
    this.saveData = loadSave() || defaultSave();
    this.audio = new AudioEngine();
    this.input = new Input();
    this.input.attach();

    const fast = new URLSearchParams(window.location.search).has('fast');
    this.renderer = new THREE.WebGLRenderer({ antialias: !fast });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(fast ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !fast;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ec9e8);
    this.scene.fog = new THREE.Fog(0x9fd0e8, 220, 700);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 40, -180);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a7a4a, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.9);
    sun.position.set(140, 220, 90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 700;
    this.scene.add(sun);

    this.city = buildCity(this.scene);
    this.fleet = new Fleet(this.scene, this.city);
    this.crowd = new Crowd(this.scene, this.city);
    this.player = new Player(this.scene, this.city, this.fleet);
    this.police = new Police(this.scene, this.fleet, this.crowd, this.audio);
    this.combat = new Combat(this.scene, this.camera);
    this.missions = new Missions(this.scene, this.city, this.crowd);
    this.hud = new Hud();

    this.applySave();
    this.police.onBusted = () => this.endRun('busted');
    this.crowd.onEnemyShoot = (enemy, target) => this.enemyFires(enemy, target);

    this.hud.titleButton.addEventListener('click', () => this.startPlaying());
    this.hud.pauseButton.addEventListener('click', () => this.resume());
    this.hud.endButton.addEventListener('click', () => this.respawn());

    this.clock = new THREE.Clock();
    this.orbitAngle = 0;
    window.addEventListener('resize', () => this.onResize());
    this.updateHud();
    this.hud.showTitle(this.saveData.missionsDone.length > 0);

    window.__solmar = {
      game: this,
      state: () => this.snapshot(),
      teleport: (x, z) => {
        if (this.player.inCar) this.player.exitCar();
        this.player.mesh.position.set(x, 0, z);
      },
      setWanted: (n) => this.police.setWanted(n),
      startMission: (i) => this.missions.start(i),
      stage: (name) => {
        this.staged = name;
        return stageScene(this, name);
      },
      giveSmg: () => {
        this.combat.unlockSmg();
        this.saveData.smg = true;
        this.store();
      },
    };
    this.loop();
  }

  applySave() {
    this.player.money = this.saveData.money;
    this.player.health = this.saveData.health || 100;
    if (this.saveData.smg) this.combat.unlockSmg();
    const next = this.saveData.missionsDone.length;
    if (next >= this.missions.defs.length) {
      this.missions.finished = true;
      this.missions.current = this.missions.defs.length;
      this.missions.beacon.visible = false;
    } else {
      this.missions.start(next);
    }
  }

  store() {
    this.saveData.money = this.player.money;
    this.saveData.health = this.player.health;
    storeSave(this.saveData);
  }

  startPlaying() {
    if (this.state === 'playing') return;
    this.audio.ensure();
    this.audio.startMusic();
    this.state = 'playing';
    this.staged = null;
    this.hud.hideScreens();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.hideScreens();
  }

  endRun(kind) {
    if (this.state !== 'playing') return;
    const fine = kind === 'busted'
      ? Math.max(100, Math.floor(this.player.money * 0.1))
      : Math.max(100, Math.floor(this.player.money * 0.05));
    this.player.money = Math.max(0, this.player.money - fine);
    this.state = kind;
    this.audio.busted();
    this.audio.setEngine(0);
    this.police.clearWanted();
    this.hud.showEnd(kind, fine);
    this.store();
  }

  respawn() {
    this.player.health = 100;
    if (this.player.inCar) this.player.exitCar();
    this.player.mesh.position.set(-66, 0, -40);
    this.player.heading = 0;
    this.player.mesh.rotation.y = 0;
    this.camYaw = 0;
    if (!this.missions.finished) this.missions.start(this.missions.current);
    this.state = 'playing';
    this.hud.hideScreens();
    this.store();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  enemyFires(enemy, target) {
    if (this.state !== 'playing') return;
    const from = new THREE.Vector3(enemy.mesh.position.x, 1.3, enemy.mesh.position.z);
    const to = new THREE.Vector3(
      target.x + (Math.random() - 0.5) * 3,
      target.y,
      target.z + (Math.random() - 0.5) * 3,
    );
    this.combat.enemyShot(from, to);
    this.audio.shot();
    if (Math.random() < 0.4) {
      if (this.player.damage(5)) this.endRun('wasted');
    }
  }

  tryEnterExitCar() {
    if (this.player.inCar) {
      this.player.exitCar();
      return;
    }
    const p = this.player.mesh.position;
    const parked = this.fleet.nearestParked(p.x, p.z, 5.5);
    if (parked) {
      this.player.enterCar(this.fleet.stealParked(parked));
      this.audio.pickup();
      return;
    }
    const moving = this.fleet.nearestDrivable(p.x, p.z, 5.5);
    if (moving) {
      const car = this.fleet.jackTraffic(moving);
      this.player.enterCar(car);
      this.police.addWanted(1);
      this.hud.setMessage('Car jacked! The police are on to you.');
      const ped = this.crowd.spawnPed(car.mesh.position.x, car.mesh.position.z);
      ped.flee = 6;
      ped.speed = 5.5;
      this.audio.pickup();
    }
  }

  tryShoot() {
    if (this.player.inCar) return;
    if (!this.combat.canShoot()) {
      if (this.combat.ammo[this.combat.current] === 0 && this.combat.cooldown <= 0) {
        this.audio.dryClick();
      }
      return;
    }
    const ndc = {
      x: (this.input.mouseX / window.innerWidth) * 2 - 1,
      y: -(this.input.mouseY / window.innerHeight) * 2 + 1,
    };
    const origin = this.player.mesh.position.clone();
    origin.y = 1.35;
    origin.x += Math.sin(this.player.heading) * 0.6;
    origin.z += Math.cos(this.player.heading) * 0.6;
    const targets = [
      ...this.crowd.enemies,
      ...this.police.officers.filter((o) => o.alive),
    ];
    const hit = this.combat.shoot(origin, ndc, targets);
    this.audio.shot();
    this.crowd.scare(this.player.pos.x, this.player.pos.z, 22);
    if (hit) {
      const isEnemy = this.crowd.enemies.includes(hit);
      const dmg = this.combat.weapon.damage;
      if (isEnemy) {
        if (this.crowd.damageEnemy(hit, dmg)) {
          this.player.money += 25;
          this.police.addWanted(1);
          this.hud.setMessage('Target down! +$25');
        }
      } else {
        hit.health -= dmg;
        if (hit.health <= 0) {
          hit.alive = false;
          hit.mesh.rotation.x = -Math.PI / 2;
          hit.mesh.position.y = 0.3;
          this.player.money += 25;
          this.police.addWanted(1);
        }
      }
    }
  }

  updateHud() {
    const p = this.player.pos;
    const t = this.missions.targetPos();
    this.hud.update({
      money: this.player.money,
      wanted: this.police.wanted,
      health: this.player.health,
      weaponName: this.combat.weapon.name,
      ammo: this.combat.ammoText,
      speed: this.player.speed,
      inCar: this.player.inCar,
      objective: this.missions.objectiveText(),
      distance: this.missions.distanceTo(p),
      playing: this.state === 'playing',
      player: { x: p.x, z: p.z },
      cars: [...this.fleet.traffic, ...this.fleet.parked].map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
      police: [...this.police.pursuit.map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
        ...this.police.officers.filter((o) => o.alive).map((o) => ({ x: o.mesh.position.x, z: o.mesh.position.z }))],
      enemies: this.crowd.livingEnemies().map((e) => ({ x: e.mesh.position.x, z: e.mesh.position.z })),
      objectivePos: t,
    });
  }

  snapshot() {
    const p = this.player.pos;
    return {
      state: this.state,
      money: Math.floor(this.player.money),
      health: Math.round(this.player.health),
      wanted: this.police.wanted,
      inCar: this.player.inCar,
      carSpeed: Math.round(this.player.speed * 10) / 10,
      mission: this.missions.finished ? 'done' : this.missions.def.name,
      missionStage: this.missions.stage,
      missionsDone: this.saveData.missionsDone.slice(),
      player: { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 },
      traffic: this.fleet.traffic.length,
      parked: this.fleet.parked.length,
      peds: this.crowd.peds.length,
      enemies: this.crowd.livingEnemies().length,
      pursuit: this.police.pursuit.length,
      officers: this.police.officers.filter((o) => o.alive).length,
      weapon: this.combat.current,
      ammo: this.combat.ammo[this.combat.current],
      consoleErrors: window.__errors ? window.__errors.length : 0,
    };
  }

  // Put the camera exactly on its follow position (used by the staging helper
  // so a screenshot starts from the right angle instead of mid-lerp).
  snapCamera() {
    const p = this.player.pos;
    const dist = this.player.inCar ? 12 : 9.5;
    const height = this.player.inCar ? 5 : 4.2;
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    this.camera.position.set(p.x - fx * dist, height, p.z - fz * dist);
    this.camera.lookAt(new THREE.Vector3(p.x + fx * 6, 1.8, p.z + fz * 6));
  }

  updateCamera(dt) {
    const p = this.player.pos;
    if (this.state === 'title') {
      if (this.staged === 'title') return;
      this.orbitAngle += dt * 0.05;
      const r = 150;
      this.camera.position.set(Math.sin(this.orbitAngle) * r, 55, Math.cos(this.orbitAngle) * r - 20);
      this.camera.lookAt(0, 4, 40);
      return;
    }
    const moving = this.player.inCar ? Math.abs(this.player.carSpeed) > 1 : true;
    if (moving) {
      const targetYaw = this.player.inCar ? this.player.car.heading : this.player.heading;
      let d = targetYaw - this.camYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.camYaw += d * Math.min(1, dt * 2.2);
    }
    const dist = this.player.inCar ? 12 : 9.5;
    const height = this.player.inCar ? 5 : 4.2;
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    const desired = new THREE.Vector3(p.x - fx * dist, height, p.z - fz * dist);
    const k = 1 - Math.exp(-dt * 7);
    this.camera.position.lerp(desired, k);
    const look = new THREE.Vector3(p.x + fx * 6, 1.8, p.z + fz * 6);
    this.camera.lookAt(look);
  }

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const input = this.input;

    if (this.state === 'playing') {
      if (input.wasPressed('KeyP')) {
        this.state = 'paused';
        this.hud.showPause();
      } else {
        if (input.wasPressed('KeyE')) this.tryEnterExitCar();
        if (input.wasPressed('KeyQ') && this.saveData.smg) {
          this.combat.switchWeapon();
          this.audio.reload();
        }
        if (input.wasPressed('KeyR')) {
          if (this.combat.reload()) this.audio.reload();
        }
        const shooting = this.combat.weapon.auto ? input.mouseDown : input.clickConsumed();
        if (shooting) this.tryShoot();

        this.player.update(dt, input, this.camYaw);
        this.fleet.update(dt, this.player.car);
        this.crowd.update(dt, this.player.pos, this.combat);
        this.police.update(dt, this.player);
        this.combat.update(dt);
        this.missions.update(dt, this);
        this.city.update(dt);
        this.audio.setEngine(this.player.inCar ? Math.abs(this.player.carSpeed) / 40 : 0);
        if (this.player.health <= 0) this.endRun('wasted');
        this.updateHud();
      }
    } else if (this.state === 'paused') {
      if (input.wasPressed('Enter')) this.resume();
      this.audio.setEngine(0);
    } else if (this.state === 'busted' || this.state === 'wasted') {
      if (input.wasPressed('Enter')) this.respawn();
      this.city.update(dt);
    } else {
      // Title: the city lives behind the menu.
      if (input.wasPressed('Enter')) this.startPlaying();
      this.city.update(dt);
      this.fleet.update(dt, null);
      this.crowd.update(dt, this.player.pos, this.combat);
    }

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
    requestAnimationFrame(() => this.loop());
  }
}

export function startGame() {
  return new Game();
}
