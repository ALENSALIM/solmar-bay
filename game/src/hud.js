// HUD for Solmar Bay: money, wanted stars, health, weapon and ammo, speed,
// objective with distance, toasts, a circular minimap and the menu screens.
import { ROAD_LINES } from './city.js';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.moneyEl = this.el('money');
    this.starsEl = this.el('stars');
    this.healthFill = this.el('health-fill');
    this.healthNum = this.el('health-num');
    this.weaponEl = this.el('weapon-name');
    this.ammoEl = this.el('ammo');
    this.speedEl = this.el('speed');
    this.objectiveEl = this.el('objective-text');
    this.distanceEl = this.el('objective-dist');
    this.toastEl = this.el('toast');
    this.minimap = this.el('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.toastTimer = null;
    this.last = {};
  }

  setText(node, key, value) {
    if (this.last[key] !== value) {
      this.last[key] = value;
      node.textContent = value;
    }
  }

  setMoney(n) { this.setText(this.moneyEl, 'money', `$${Math.floor(n).toLocaleString('en-US')}`); }

  setWanted(n) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < n ? '\u2605' : '\u2606';
    this.setText(this.starsEl, 'stars', stars);
    this.starsEl.classList.toggle('hot', n >= 3);
  }

  setHealth(h) {
    const pct = Math.max(0, Math.min(100, Math.round(h)));
    this.healthFill.style.width = `${pct}%`;
    this.healthFill.classList.toggle('low', pct <= 30);
    this.setText(this.healthNum, 'health', `${pct}`);
  }

  setWeapon(name, ammo, mag, reloading) {
    this.setText(this.weaponEl, 'weapon', name);
    this.setText(this.ammoEl, 'ammo', reloading ? 'RELOADING\u2026' : `${ammo} / ${mag}`);
  }

  setSpeed(kmh) {
    this.setText(this.speedEl, 'speed', `${Math.round(kmh)}`);
  }

  setObjective(text, distM) {
    this.setText(this.objectiveEl, 'objective', text);
    this.setText(this.distanceEl, 'dist', distM === null ? '' : `${Math.round(distM)} m`);
  }

  toast(msg, ms) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms || 3200);
  }

  showScreen(name) {
    for (const id of ['screen-title', 'screen-pause', 'screen-busted', 'screen-wasted']) {
      this.el(id).classList.toggle('hidden', id !== `screen-${name}`);
    }
    this.el('hud').classList.toggle('hidden', name === 'title');
    this.el('crosshair').classList.toggle('hidden', name !== 'playing');
  }

  updateMinimap(G) {
    const ctx = this.mapCtx;
    const S = 180;
    const scale = S / 500;
    const toX = (x) => (x + 250) * scale;
    const toZ = (z) => (z + 250) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#10141a';
    ctx.fillRect(0, 0, S, S);
    // Ocean and beach on the east edge.
    ctx.fillStyle = '#1d6f9e';
    ctx.fillRect(toX(216), 0, S - toX(216), S);
    ctx.fillStyle = '#d9c28a';
    ctx.fillRect(toX(216), 0, toX(252) - toX(216), S);
    // Park.
    ctx.fillStyle = '#2f6b2e';
    ctx.fillRect(toX(-72), toZ(-72), toX(24) - toX(-72), toZ(24) - toZ(-72));
    // Roads.
    ctx.strokeStyle = '#5a5f6a';
    ctx.lineWidth = 4;
    for (const line of ROAD_LINES) {
      ctx.beginPath(); ctx.moveTo(toX(-222), toZ(line)); ctx.lineTo(toX(222), toZ(line)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(line), toZ(-222)); ctx.lineTo(toX(line), toZ(222)); ctx.stroke();
    }
    const dot = (x, z, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(toX(x), toZ(z), r, 0, Math.PI * 2); ctx.fill();
    };
    // Traffic cars.
    for (const car of G.traffic.cars) {
      if (car.isPlayer || car.isParked) continue;
      dot(car.pos.x, car.pos.z, car.isPolice ? '#ff4444' : '#dddddd', car.isPolice ? 3 : 2);
    }
    // Mission enemies.
    for (const e of G.people.enemies) {
      if (e.alive) dot(e.pos.x, e.pos.z, '#ff8800', 3);
    }
    // Objective marker (pulsing yellow).
    const obj = G.missions.objective;
    if (obj && obj.pos) {
      const r = 5 + Math.sin(performance.now() / 280) * 1.5;
      ctx.strokeStyle = '#ffd23c';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(toX(obj.pos.x), toZ(obj.pos.z), r, 0, Math.PI * 2); ctx.stroke();
      dot(obj.pos.x, obj.pos.z, '#ffd23c', 3);
    }
    // Player arrow.
    const p = G.player.inCar ? G.player.inCar.pos : G.player.pos;
    const yaw = G.player.inCar ? G.player.inCar.heading : G.player.yaw;
    ctx.save();
    ctx.translate(toX(p.x), toZ(p.z));
    ctx.rotate(-yaw + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }
}
