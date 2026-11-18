// Weapons for Solmar Bay: a pistol and an SMG (unlocked after mission 3),
// raycast hits, fading tracers, magazines and reloads.
import * as THREE from 'three';

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, mag: 12, interval: 0.26, auto: false, tracer: 0xffe9a0 },
  smg: { name: 'SMG', damage: 20, mag: 30, interval: 0.09, auto: true, tracer: 0xffc46e },
};

export class Combat {
  constructor(scene, camera, audio, people, onPedShot) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.people = people;
    this.onPedShot = onPedShot || (() => {});
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 140;
    this.current = 'pistol';
    this.ammo = { pistol: 12, smg: 30 };
    this.reloading = 0;
    this.cooldown = 0;
    this.tracers = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, this.tracerMat.clone());
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this.tracerIdx = 0;
    this.kills = 0;
  }

  get weapon() { return WEAPONS[this.current]; }

  switchWeapon(smgUnlocked) {
    const next = this.current === 'pistol' ? 'smg' : 'pistol';
    if (next === 'smg' && !smgUnlocked) return false;
    this.current = next;
    this.reloading = 0;
    return true;
  }

  startReload() {
    if (this.reloading > 0) return;
    if (this.ammo[this.current] === this.weapon.mag) return;
    this.reloading = 1.1;
  }

  // Fires one shot from the camera through the crosshair. Returns the enemy
  // killed, the ped hit, or null. Call every frame while the trigger is held
  // for automatic weapons; the pistol only fires on a fresh click.
  tryFire(origin, dir, freshClick) {
    if (this.reloading > 0 || this.cooldown > 0) return null;
    const w = this.weapon;
    if (!w.auto && !freshClick) return null;
    if (this.ammo[this.current] <= 0) {
      this.startReload();
      return null;
    }
    this.cooldown = w.interval;
    this.ammo[this.current] -= 1;
    this.audio.shot(this.current === 'smg');
    this.raycaster.set(origin, dir);
    const targets = [];
    for (const e of this.people.enemies) if (e.alive) targets.push(e.mesh);
    for (const p of this.people.peds) if (p.alive) targets.push(p.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    let end = origin.clone().add(dir.clone().multiplyScalar(90));
    let result = null;
    if (hits.length > 0) {
      const hit = hits[0];
      end = hit.point.clone();
      let node = hit.object;
      while (node) {
        if (node.userData.enemyRef) {
          const enemy = node.userData.enemyRef;
          if (this.people.damageEnemy(enemy, w.damage)) {
            this.kills += 1;
            result = { type: 'enemy', enemy };
          } else {
            this.audio.hit();
            result = { type: 'hit', enemy };
          }
          break;
        }
        if (node.userData.pedRef) {
          const ped = node.userData.pedRef;
          if (this.people.shootPed(ped)) {
            this.onPedShot(ped);
            result = { type: 'ped', ped };
          }
          break;
        }
        node = node.parent;
      }
    }
    this.spawnTracer(origin, end);
    return result;
  }

  spawnTracer(from, to) {
    const t = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % this.tracers.length;
    const attr = t.line.geometry.getAttribute('position');
    attr.setXYZ(0, from.x, from.y, from.z);
    attr.setXYZ(1, to.x, to.y, to.z);
    attr.needsUpdate = true;
    t.line.visible = true;
    t.line.material.opacity = 0.9;
    t.life = 0.09;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        this.ammo[this.current] = this.weapon.mag;
      }
    }
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
        if (t.life <= 0) t.line.visible = false;
      }
    }
  }
}
