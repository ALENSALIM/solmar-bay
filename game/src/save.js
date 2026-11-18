// The save file: money, story progress and the player's place in the city, kept in
// this browser's localStorage so a visit can continue where it left off.
export const SAVE_KEY = 'solmar-bay-save-v1';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone.filter((n) => Number.isInteger(n)) : [],
      weapons: Array.isArray(data.weapons) ? data.weapons.filter((w) => typeof w === 'string') : ['fists', 'pistol'],
      px: typeof data.px === 'number' ? data.px : 0,
      pz: typeof data.pz === 'number' ? data.pz : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage can be off */ }
}
