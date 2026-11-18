// HUD for Solmar Bay: money, wanted stars, health, weapon and ammo, speed,
// mission objective with distance, and a circular minimap. The title, pause,
// busted and wasted screens are DOM overlays built here.

import { ROAD_LINES } from './city.js';

const STAR_ON = '\u2605';
const STAR_OFF = '\u2606';

export class Hud {
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    document.body.appendChild(this.root);
    this.build();
    this.messageTimer = null;
    this.mapBg = this.renderMapBackground();
  }

  el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  build() {
    const css = document.createElement('style');
    css.textContent = `
      #hud { position: fixed; inset: 0; pointer-events: none; font-family: Arial, sans-serif; color: #fff; z-index: 10; }
      .hud-panel { position: absolute; background: rgba(10,16,28,0.62); border-radius: 10px; padding: 8px 12px; }
      #hud-money { top: 14px; right: 14px; font-size: 26px; font-weight: bold; color: #7dff8a; text-shadow: 0 2px 4px #000; }
      #hud-wanted { top: 58px; right: 14px; font-size: 26px; letter-spacing: 4px; color: #ffd76e; text-shadow: 0 2px 4px #000; }
      #hud-health { top: 14px; left: 14px; width: 210px; }
      #hud-health .bar { height: 12px; background: rgba(255,255,255,0.25); border-radius: 6px; overflow: hidden; margin-top: 4px; }
      #hud-health .fill { height: 100%; background: #58d858; width: 100%; }
      #hud-health .label { font-size: 13px; letter-spacing: 1px; }
      #hud-weapon { bottom: 14px; right: 14px; font-size: 20px; text-align: right; }
      #hud-speed { bottom: 14px; left: 14px; font-size: 30px; font-weight: bold; text-shadow: 0 2px 4px #000; }
      #hud-objective { top: 14px; left: 50%; transform: translateX(-50%); max-width: 560px; text-align: center; font-size: 15px; }
      #hud-objective .dist { color: #ffd76e; font-weight: bold; }
      #hud-message { top: 110px; left: 50%; transform: translateX(-50%); font-size: 22px; font-weight: bold; color: #ffd76e; text-shadow: 0 2px 6px #000; }
      #hud-crosshair { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; }
      #hud-crosshair::before, #hud-crosshair::after { content: ''; position: absolute; background: #fff; }
      #hud-crosshair::before { left: 10px; top: 0; width: 2px; height: 22px; }
      #hud-crosshair::after { top: 10px; left: 0; width: 22px; height: 2px; }
      #hud-map { position: absolute; right: 14px; bottom: 64px; width: 168px; height: 168px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.75); box-shadow: 0 2px 10px #000; }
      .hud-screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(6,10,20,0.72); pointer-events: auto; text-align: center; }
      .hud-screen h1 { font-size: 64px; margin: 0; color: #ffd76e; letter-spacing: 6px; text-shadow: 0 4px 18px #000; }
      .hud-screen h2 { font-size: 44px; margin: 0; }
      .hud-screen p { font-size: 18px; max-width: 640px; line-height: 1.5; }
      .hud-screen .keys { font-size: 15px; color: #cfe3ff; }
      .hud-screen button { margin-top: 18px; font-size: 20px; padding: 12px 28px; border: none; border-radius: 10px; background: #ffd76e; color: #222; font-weight: bold; cursor: pointer; }
    `;
    document.head.appendChild(css);

    this.moneyEl = this.el('div', 'hud-panel', this.root);
    this.moneyEl.id = 'hud-money';
    this.wantedEl = this.el('div', 'hud-panel', this.root);
    this.wantedEl.id = 'hud-wanted';
    const health = this.el('div', 'hud-panel', this.root);
    health.id = 'hud-health';
    this.el('span', 'label', health).textContent = 'HEALTH';
    const bar = this.el('div', 'bar', health);
    this.healthFill = this.el('div', 'fill', bar);
    this.weaponEl = this.el('div', 'hud-panel', this.root);
    this.weaponEl.id = 'hud-weapon';
    this.speedEl = this.el('div', 'hud-panel', this.root);
    this.speedEl.id = 'hud-speed';
    this.objectiveEl = this.el('div', 'hud-panel', this.root);
    this.objectiveEl.id = 'hud-objective';
    this.messageEl = this.el('div', '', this.root);
    this.messageEl.id = 'hud-message';
    this.crosshair = this.el('div', '', this.root);
    this.crosshair.id = 'hud-crosshair';
    this.mapCanvas = this.el('canvas', '', this.root);
    this.mapCanvas.id = 'hud-map';
    this.mapCanvas.width = 168;
    this.mapCanvas.height = 168;
    this.mapCtx = this.mapCanvas.getContext('2d');

    this.titleScreen = this.buildScreen('title');
    this.titleScreen.querySelector('h1').textContent = 'SOLMAR BAY';
    this.titleScreen.querySelector('p').textContent =
      'Rico Vega is home after three years away. The city is yours: drive it, steal it, ' +
      'work the five story missions and climb the underworld — just watch the stars.';
    const keys = this.el('p', 'keys', this.titleScreen);
    keys.textContent = 'WASD move / drive  •  E get in & out of cars  •  Mouse aim, Click shoot  •  Q switch weapon  •  R reload  •  P pause  •  Enter start';
    this.titleButton = this.el('button', '', this.titleScreen);
    this.titleButton.textContent = 'START  (Enter)';

    this.pauseScreen = this.buildScreen('pause');
    this.pauseScreen.querySelector('h2').textContent = 'PAUSED';
    this.pauseScreen.querySelector('p').textContent = 'Take a breath, Rico. The city waits.';
    this.pauseButton = this.el('button', '', this.pauseScreen);
    this.pauseButton.textContent = 'RESUME  (Enter)';

    this.endScreen = this.buildScreen('end');
    this.endTitle = this.endScreen.querySelector('h2');
    this.endText = this.endScreen.querySelector('p');
    this.endButton = this.el('button', '', this.endScreen);
    this.endButton.textContent = 'RESPAWN  (Enter)';

    this.hideScreens();
  }

  buildScreen(name) {
    const s = this.el('div', 'hud-screen', this.root);
    s.id = `hud-${name}`;
    this.el('h1', '', s);
    this.el('h2', '', s);
    this.el('p', '', s);
    return s;
  }

  hideScreens() {
    this.titleScreen.style.display = 'none';
    this.pauseScreen.style.display = 'none';
    this.endScreen.style.display = 'none';
  }

  showTitle(hasSave) {
    this.hideScreens();
    this.titleScreen.style.display = 'flex';
    this.titleButton.textContent = hasSave ? 'CONTINUE  (Enter)' : 'START  (Enter)';
  }

  showPause() {
    this.hideScreens();
    this.pauseScreen.style.display = 'flex';
  }

  showEnd(kind, fine) {
    this.hideScreens();
    this.endScreen.style.display = 'flex';
    if (kind === 'busted') {
      this.endTitle.textContent = 'BUSTED!';
      this.endText.textContent = `The Solmar Bay police took you in. You paid a $${fine} fine and lost the heat — for now.`;
    } else {
      this.endTitle.textContent = 'WASTED';
      this.endText.textContent = `Rico went down in the streets of Solmar Bay. The hospital patched you up for $${fine}.`;
    }
  }

  setMessage(text) {
    this.messageEl.textContent = text;
    if (this.messageTimer) window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.messageEl.textContent = '';
    }, 4000);
  }

  renderMapBackground() {
    const c = document.createElement('canvas');
    c.width = 168;
    c.height = 168;
    const g = c.getContext('2d');
    g.fillStyle = '#2d5a2d';
    g.fillRect(0, 0, 168, 168);
    g.fillStyle = '#3a3a40';
    for (const line of ROAD_LINES) {
      const p = ((line + 210) / 420) * 168;
      g.fillRect(p - 2, 0, 4, 168);
      g.fillRect(0, p - 2, 168, 4);
    }
    g.fillStyle = '#e8d29a';
    g.fillRect(0, ((188 + 210) / 420) * 168, 168, 10);
    g.fillStyle = '#1b6fb0';
    g.fillRect(0, ((228 + 210) / 420) * 168, 168, 168 - ((228 + 210) / 420) * 168);
    g.fillStyle = '#4d7d3a';
    g.beginPath();
    g.arc((( -66 + 210) / 420) * 168, ((-66 + 210) / 420) * 168, 8, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  drawMinimap(state) {
    const g = this.mapCtx;
    const S = 168;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    g.clip();
    g.drawImage(this.mapBg, 0, 0);
    const toMap = (x, z) => [((x + 210) / 420) * S, ((z + 210) / 420) * S];
    const dot = (x, z, color, r) => {
      const [mx, mz] = toMap(x, z);
      g.fillStyle = color;
      g.beginPath();
      g.arc(mx, mz, r, 0, Math.PI * 2);
      g.fill();
    };
    if (state.objectivePos) dot(state.objectivePos.x, state.objectivePos.z, '#ffd76e', 5);
    for (const c of state.cars) dot(c.x, c.z, '#ffffff', 2.5);
    for (const p of state.police) dot(p.x, p.z, '#3a86ff', 3.5);
    for (const e of state.enemies) dot(e.x, e.z, '#ff4444', 3);
    const [px, pz] = toMap(state.player.x, state.player.z);
    g.fillStyle = '#7dff8a';
    g.beginPath();
    g.arc(px, pz, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.stroke();
    // North tick.
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px Arial';
    g.textAlign = 'center';
    g.fillText('N', S / 2, 12);
    g.restore();
  }

  update(state) {
    this.moneyEl.textContent = `$${Math.floor(state.money)}`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? STAR_ON : STAR_OFF;
    this.wantedEl.textContent = stars;
    this.wantedEl.style.color = state.wanted >= 4 ? '#ff5555' : '#ffd76e';
    this.healthFill.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    this.healthFill.style.background = state.health > 50 ? '#58d858' : state.health > 25 ? '#f2d13c' : '#ff5555';
    this.weaponEl.textContent = `${state.weaponName}  ${state.ammo}`;
    this.speedEl.textContent = state.inCar ? `${Math.round(state.speed * 2.2)} mph` : '';
    this.objectiveEl.innerHTML = `${state.objective} <span class="dist">${state.distance} m</span>`;
    this.crosshair.style.display = state.playing && !state.inCar ? 'block' : 'none';
    this.drawMinimap(state);
  }
}
