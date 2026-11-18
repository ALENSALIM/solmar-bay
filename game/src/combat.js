// Combat for Solmar Bay: pistol and submachine gun, mouse-aimed hitscan shots
// with visible tracers, ammo and reloads. Shots scare nearby pedestrians.

import * as THREE from 'three';

const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, mag: 12, spread: 0.012, auto: false, range: 90 },
  smg: { name: 'SMG', damage: 20, rate: 0.085, mag: 30, spread: 0.03, auto: true, range: 80 },
};

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.current = 'pistol';
    this.ammo = { pistol: 12, smg: 30 };
    this.reserve = { pistol: 60, smg: 120 };
    this.cooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this.tracers = [];
    this.ray = new THREE.Raycaster();
  }

  get weapon() {
    return WEAPONS[this.current];
  }

  get ammoText() {
    return `${this.ammo[this.current]} / ${this.reserve[this.current]}`;
  }

  switchWeapon() {
    this.current = this.current === 'pistol' ? 'smg' : 'pistol';
    this.cooldown = 0.1;
    return this.current;
  }

  hasSmg() {
    return this.reserve.smg > 0 || this.ammo.smg > 0;
  }

  unlockSmg() {
    this.ammo.smg = 30;
    this.reserve.smg = 120;
  }

  reload() {
    const w = this.weapon;
    const need = w.mag - this.ammo[this.current];
    if (need <= 0 || this.reserve[this.current] <= 0) return false;
    const take = Math.min(need, this.reserve[this.current]);
    this.ammo[this.current] += take;
    this.reserve[this.current] -= take;
    this.cooldown = Math.max(this.cooldown, 0.5);
    return true;
  }

  canShoot() {
    return this.cooldown <= 0 && this.ammo[this.current] > 0;
  }

  // origin: world position of the muzzle. ndc: mouse in -1..1. targets: enemy-like
  // objects {mesh, alive, hitRadius}. Returns the enemy hit, if any.
  shoot(origin, ndc, targets) {
    if (this.cooldown > 0) return null;
    if (this.ammo[this.current] <= 0) return null;
    this.ammo[this.current] -= 1;
    this.cooldown = this.weapon.rate;
    const dir = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    // Add a little spread so long shots are not laser-perfect.
    dir.x += (Math.random() - 0.5) * this.weapon.spread;
    dir.y += (Math.random() - 0.5) * this.weapon.spread;
    dir.z += (Math.random() - 0.5) * this.weapon.spread;
    dir.normalize();
    this.ray.set(this.camera.position, dir);
    this.ray.far = this.weapon.range;
    let hitPoint = null;
    let hitEnemy = null;
    let bestT = Infinity;
    const meshes = targets.filter((t) => t.alive).map((t) => t.mesh);
    const hits = this.ray.intersectObjects(meshes, true);
    if (hits.length > 0) {
      const h = hits[0];
      hitPoint = h.point;
      bestT = h.distance;
      let obj = h.object;
      while (obj) {
        const found = targets.find((t) => t.mesh === obj);
        if (found) {
          hitEnemy = found;
          break;
        }
        obj = obj.parent;
      }
    }
    if (!hitPoint) {
      hitPoint = this.camera.position.clone().add(dir.clone().multiplyScalar(this.weapon.range));
    }
    this.addTracer(origin, hitPoint);
    void bestT;
    return hitEnemy;
  }

  // A shot that does not use the camera ray: an enemy firing at the player.
  enemyShot(from, to) {
    this.addTracer(from, to);
  }

  addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.95;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
