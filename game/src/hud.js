// HUD: money, wanted stars, health, weapon/ammo, speed, objective with
// distance, a circular minimap, flash messages, and the title / pause /
// busted / wasted screens. All DOM over the canvas; the minimap is 2D canvas.
import { PITCH } from './city.js';
import { objectiveText } from './missions.js';

function el(tag, id, parent, style) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (style) e.setAttribute('style', style);
  parent.appendChild(e);
  return e;
}

export function buildHud(W) {
  const root = document.getElementById('hud');
  const hud = {};
  hud.money = el('div', 'hud-money', root, 'position:absolute;top:14px;left:16px;font-size:30px;font-weight:800;color:#fff;text-shadow:0 2px 6px #000;');
  hud.stars = el('div', 'hud-stars', root, 'position:absolute;top:52px;left:16px;font-size:26px;letter-spacing:4px;color:#ffd23f;text-shadow:0 2px 6px #000;');
  hud.healthWrap = el('div', null, root, 'position:absolute;top:14px;right:16px;width:220px;text-align:right;');
  hud.healthLabel = el('div', null, hud.healthWrap, 'font-size:13px;color:#fff;text-shadow:0 1px 4px #000;margin-bottom:3px;');
  hud.healthBar = el('div', null, hud.healthWrap, 'height:14px;background:rgba(0,0,0,.55);border:1px solid #fff;border-radius:7px;overflow:hidden;');
  hud.healthFill = el('div', null, hud.healthBar, 'height:100%;width:100%;background:#2ecc71;');
  hud.weapon = el('div', null, hud.healthWrap, 'font-size:20px;font-weight:700;color:#fff;text-shadow:0 1px 4px #000;margin-top:6px;');
  hud.objective = el('div', null, root, 'position:absolute;left:50%;bottom:96px;transform:translateX(-50%);font-size:19px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);padding:8px 18px;border-radius:20px;white-space:nowrap;');
  hud.speed = el('div', null, root, 'position:absolute;left:16px;bottom:16px;font-size:34px;font-weight:800;color:#fff;text-shadow:0 2px 6px #000;');
  hud.flash = el('div', null, root, 'position:absolute;left:50%;top:32%;transform:translateX(-50%);font-size:30px;font-weight:800;color:#ffd23f;text-shadow:0 2px 8px #000;text-align:center;');
  hud.mapWrap = el('div', null, root, 'position:absolute;right:16px;bottom:16px;width:190px;height:190px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.85);box-shadow:0 2px 10px rgba(0,0,0,.5);');
  hud.map = el('canvas', null, hud.mapWrap, 'width:190px;height:190px;');
  hud.map.width = 190;
  hud.map.height = 190;
  hud.crosshair = el('div', null, root, 'position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px #000;pointer-events:none;');
  // Screens.
  hud.title = el('div', 'screen-title', root, 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(rgba(10,30,60,.55),rgba(10,30,60,.75));color:#fff;text-align:center;');
  hud.title.innerHTML = '<div style="font-size:64px;font-weight:900;letter-spacing:6px;text-shadow:0 4px 18px #000;">SOLMAR BAY</div>'
    + '<div style="font-size:20px;margin-top:6px;">Rico Vega is home — and the city owes him.</div>'
    + '<div style="font-size:17px;margin-top:22px;line-height:1.7;">WASD move &nbsp;·&nbsp; Mouse look &nbsp;·&nbsp; E steal / exit car<br>Click shoot &nbsp;·&nbsp; Q switch weapon &nbsp;·&nbsp; R reload &nbsp;·&nbsp; P pause</div>'
    + '<div id="title-continue" style="font-size:24px;font-weight:800;margin-top:30px;color:#ffd23f;">Press ENTER to start</div>';
  hud.pause = el('div', 'screen-pause', root, 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.6);color:#fff;');
  hud.pause.innerHTML = '<div style="font-size:48px;font-weight:900;">PAUSED</div><div style="font-size:18px;margin-top:10px;">Press P or ENTER to resume</div>';
  hud.busted = el('div', 'screen-busted', root, 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(20,40,90,.72);color:#fff;');
  hud.busted.innerHTML = '<div style="font-size:56px;font-weight:900;letter-spacing:4px;">BUSTED</div><div id="busted-fine" style="font-size:20px;margin-top:12px;"></div><div style="font-size:20px;margin-top:26px;color:#ffd23f;">Press ENTER to get back out there</div>';
  hud.wasted = el('div', 'screen-wasted', root, 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(90,10,10,.72);color:#fff;');
  hud.wasted.innerHTML = '<div style="font-size:56px;font-weight:900;letter-spacing:4px;">WASTED</div><div id="wasted-fine" style="font-size:20px;margin-top:12px;"></div><div style="font-size:20px;margin-top:26px;color:#ffd23f;">Press ENTER to get back out there</div>';
  W.hud = hud;
  return hud;
}

export function showScreen(W, name) {
  const h = W.hud;
  h.title.style.display = name === 'title' ? 'flex' : 'none';
  h.pause.style.display = name === 'paused' ? 'flex' : 'none';
  h.busted.style.display = name === 'busted' ? 'flex' : 'none';
  h.wasted.style.display = name === 'wasted' ? 'flex' : 'none';
  if (name === 'busted') {
    document.getElementById('busted-fine').textContent = `The cops took $${W.lastFine || 0} off you.`;
  }
  if (name === 'wasted') {
    document.getElementById('wasted-fine').textContent = 'The hospital patched you up — $100.';
  }
  const inGame = name === 'playing';
  h.crosshair.style.display = inGame ? 'block' : 'none';
}

function drawMinimap(W) {
  const c = W.hud.map.getContext('2d');
  const S = 190;
  const scale = S / 460; // world -230..230 maps to the disc
  const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
  c.clearRect(0, 0, S, S);
  // Ocean + beach on the east edge.
  c.fillStyle = '#1d4e6e';
  c.fillRect(0, 0, S, S);
  c.fillStyle = '#e0c98f';
  const [bx] = toMap(162, 0);
  c.fillRect(bx, 0, S - bx, S);
  // City ground.
  c.fillStyle = '#5a6b52';
  const [cx0, cz0] = toMap(-162, -162);
  const [cx1, cz1] = toMap(162, 162);
  c.fillRect(cx0, cz0, cx1 - cx0, cz1 - cz0);
  // Park.
  c.fillStyle = '#3f7d33';
  const [px0, pz0] = toMap(6, 6);
  const [px1, pz1] = toMap(66, 66);
  c.fillRect(px0, pz0, px1 - px0, pz1 - pz0);
  // Roads.
  c.strokeStyle = '#333a42';
  c.lineWidth = 4;
  for (let m = -4; m <= 4; m++) {
    const [x0, y0] = toMap(m * PITCH, -162);
    const [x1, y1] = toMap(m * PITCH, 162);
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    const [hx0, hy0] = toMap(-162, m * PITCH);
    const [hx1, hy1] = toMap(162, m * PITCH);
    c.beginPath();
    c.moveTo(hx0, hy0);
    c.lineTo(hx1, hy1);
    c.stroke();
  }
  const dot = (x, z, color, r) => {
    const [mx, my] = toMap(x, z);
    c.fillStyle = color;
    c.beginPath();
    c.arc(mx, my, r, 0, Math.PI * 2);
    c.fill();
  };
  for (const car of W.traffic) dot(car.pos.x, car.pos.z, '#bbbbbb', 2);
  for (const car of W.parked) dot(car.pos.x, car.pos.z, '#ffffff', 2);
  for (const e of W.enemies) dot(e.pos.x, e.pos.z, '#ff3333', 3);
  for (const u of W.police) dot(u.pos.x, u.pos.z, '#3388ff', 3);
  // Mission marker: pulsing yellow diamond.
  const obj = objectiveText(W);
  if (W.missions.active) {
    const [mx, my] = toMap(obj.x, obj.z);
    const r = 5 + Math.sin(W.time * 5) * 2;
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.moveTo(mx, my - r);
    c.lineTo(mx + r, my);
    c.lineTo(mx, my + r);
    c.lineTo(mx - r, my);
    c.closePath();
    c.fill();
  }
  // Player arrow.
  const [px, py] = toMap(W.player.pos.x, W.player.pos.z);
  c.save();
  c.translate(px, py);
  c.rotate(Math.atan2(Math.sin(W.player.yaw), Math.cos(W.player.yaw)));
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(0, -7);
  c.lineTo(5, 6);
  c.lineTo(-5, 6);
  c.closePath();
  c.fill();
  c.restore();
}

export function updateHud(W) {
  const h = W.hud;
  h.money.textContent = `$${Math.floor(W.money).toLocaleString('en-US')}`;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < W.wanted ? '★' : '☆';
  h.stars.textContent = stars;
  const hp = Math.max(0, Math.round(W.player.health));
  h.healthLabel.textContent = `HEALTH ${hp}`;
  h.healthFill.style.width = `${hp}%`;
  h.healthFill.style.background = hp > 50 ? '#2ecc71' : hp > 25 ? '#f39c12' : '#e74c3c';
  const w = W.weapons[W.weapon];
  const reloading = W.reloadAt > 0;
  h.weapon.textContent = reloading ? `${w.name} — reloading…` : `${w.name}  ${w.mag} / ∞`;
  const obj = objectiveText(W);
  h.objective.textContent = W.missions.active
    ? `${obj.text} — ${Math.round(obj.dist)}m`
    : obj.text;
  const speed = W.player.inCar ? Math.abs(W.player.carSpeed) * 2.237 : Math.abs(W.player.speed) * 2.237;
  h.speed.textContent = W.player.inCar ? `${Math.round(speed)} mph` : '';
  // Flash messages (SMG unlock, mission complete, locked weapon).
  let flash = '';
  const last = W.events[W.events.length - 1];
  if (W.hudFlash && W.time - W.hudFlashAt < 2.5) flash = W.hudFlash;
  if (last && last.type === 'mission-complete' && W.time - last.at < 2.5) {
    flash = `${last.mission} — +$${last.reward}`;
  }
  if (last && last.type === 'smg-unlocked' && W.time - last.at < 3) {
    flash = 'SMG UNLOCKED — press Q';
  }
  if (last && last.type === 'story-complete' && W.time - last.at < 4) {
    flash = 'YOU OWN SOLMAR BAY';
  }
  h.flash.textContent = flash;
  drawMinimap(W);
}
