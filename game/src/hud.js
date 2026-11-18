// The HUD: money, wanted stars, health, weapon, speed, objective, toasts and the
// circular minimap — a top-down drawing of the city with the player, the mission
// marker, the police and the traffic on it.
import { clamp } from './random.js';
import { ROAD_COORDS, BEACH_Z, OCEAN_Z } from './city.js';

export function createHud(G) {
  const hud = document.getElementById('hud');
  const moneyEl = document.getElementById('money');
  const starsEl = document.getElementById('stars');
  const healthFill = document.getElementById('healthfill');
  const weaponName = document.getElementById('weaponName');
  const weaponAmmo = document.getElementById('weaponAmmo');
  const speedVal = document.getElementById('speedVal');
  const objTag = document.getElementById('objTag');
  const objText = document.getElementById('objText');
  const objDist = document.getElementById('objDist');
  const crosshair = document.getElementById('crosshair');
  const toastEl = document.getElementById('toast');
  const hintEl = document.getElementById('hint');
  const vignette = document.getElementById('vignette');
  const minimap = document.getElementById('minimap');
  const mm = minimap.getContext('2d');
  let toastTimer = null;
  let lastMoney = -1;
  let lastStars = -1;
  let lastHealth = -1;

  function show() { hud.classList.add('on'); }
  function hide() { hud.classList.remove('on'); }

  function setObjective(tag, text, dist) {
    objTag.textContent = tag;
    objText.textContent = text;
    objDist.textContent = dist || '';
  }
  function setObjectiveDistance(dist) { objDist.textContent = dist; }

  function toast(message, ms) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms || 2800);
  }

  function setHint(text) { hintEl.textContent = text; }

  function flashDamage() {
    vignette.style.display = 'block';
    window.setTimeout(() => { vignette.style.display = 'none'; }, 260);
  }

  function update() {
    const p = G.player;
    if (p.money !== lastMoney) {
      lastMoney = p.money;
      moneyEl.textContent = `$${p.money.toLocaleString('en-US')}`;
    }
    const stars = G.police.stars;
    if (stars !== lastStars) {
      lastStars = stars;
      starsEl.textContent = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : '';
    }
    const health = Math.round(p.health);
    if (health !== lastHealth) {
      lastHealth = health;
      healthFill.style.width = `${clamp(health, 0, 100)}%`;
    }
    const def = G.combat.WEAPONS[p.weapon];
    weaponName.textContent = def ? def.name : p.weapon;
    if (p.weapon === 'fists') {
      weaponAmmo.textContent = 'Press Q to switch weapon';
    } else {
      const mag = p.weapons[p.weapon];
      weaponAmmo.textContent = mag ? `${mag.ammo} / ${mag.reserve} in reserve` : '';
    }
    const speed = p.car ? Math.abs(p.car.speed) * 2.24 : 0;
    speedVal.textContent = String(Math.round(speed));
    crosshair.style.display = (!p.car && p.weapon !== 'fists' && G.screen === 'play') ? 'block' : 'none';
    drawMinimap();
  }

  function drawMinimap() {
    const S = 200;
    const range = 460; // world metres across the map
    const toMap = (x, z) => [((x + range / 2) / range) * S, ((z + range / 2) / range) * S];
    mm.clearRect(0, 0, S, S);
    mm.fillStyle = '#12283d';
    mm.fillRect(0, 0, S, S);
    // Ocean and beach at the bottom.
    const [, beachY] = toMap(0, BEACH_Z);
    const [, oceanY] = toMap(0, OCEAN_Z);
    mm.fillStyle = '#e8d5a3';
    mm.fillRect(0, beachY, S, oceanY - beachY);
    mm.fillStyle = '#1e7fa8';
    mm.fillRect(0, oceanY, S, S - oceanY);
    // Blocks.
    mm.fillStyle = '#3a4a3a';
    for (let bx = 0; bx < 8; bx++) {
      for (let bz = 0; bz < 8; bz++) {
        if (bx === 3 && bz === 3) continue;
        const [x, z] = toMap(ROAD_COORDS[bx] + 7, ROAD_COORDS[bz] + 7);
        const w = (66 / range) * S;
        mm.fillRect(x, z, w, w);
      }
    }
    // Roads.
    mm.strokeStyle = '#8a93a3';
    mm.lineWidth = 5;
    for (const c of ROAD_COORDS) {
      const [x] = toMap(c, 0);
      const [, z] = toMap(0, c);
      mm.beginPath(); mm.moveTo(x, 0); mm.lineTo(x, S); mm.stroke();
      mm.beginPath(); mm.moveTo(0, z); mm.lineTo(S, z); mm.stroke();
    }
    // Mission marker.
    const markerPos = G.missions.markerPosition;
    if (markerPos) {
      const [x, y] = toMap(markerPos.x, markerPos.z);
      const pulse = 7 + Math.sin(G.time * 5) * 2;
      mm.fillStyle = '#ffd23e';
      mm.beginPath(); mm.arc(x, y, pulse, 0, Math.PI * 2); mm.fill();
      mm.strokeStyle = '#000'; mm.lineWidth = 2;
      mm.beginPath(); mm.arc(x, y, pulse, 0, Math.PI * 2); mm.stroke();
    }
    // Police cars.
    for (const car of G.police.pursuitCars) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      mm.fillStyle = Math.floor(G.time * 6) % 2 === 0 ? '#ff2222' : '#2266ff';
      mm.beginPath(); mm.arc(x, y, 4, 0, Math.PI * 2); mm.fill();
    }
    // Traffic dots.
    mm.fillStyle = 'rgba(255,255,255,0.75)';
    for (const car of G.vehicles.cars) {
      if (car.kind !== 'traffic' && car.kind !== 'taxi') continue;
      const [x, y] = toMap(car.pos.x, car.pos.z);
      mm.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // The player, an arrow pointing where he faces.
    const p = G.player;
    const [px, py] = toMap(p.pos.x, p.pos.z);
    const yaw = p.car ? p.car.yaw : p.camYaw;
    mm.save();
    mm.translate(px, py);
    mm.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)));
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(0, -9); mm.lineTo(6, 7); mm.lineTo(-6, 7); mm.closePath();
    mm.fill();
    mm.strokeStyle = '#000'; mm.lineWidth = 1.5; mm.stroke();
    mm.restore();
  }

  return { show, hide, update, setObjective, setObjectiveDistance, toast, setHint, flashDamage };
}
