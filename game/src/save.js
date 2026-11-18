// Save game for Solmar Bay: missions finished, money and weapons, in localStorage.

const KEY = 'solmar-bay-save-v1';

export function defaultSave() {
  return { money: 250, missionsDone: [], smg: false, health: 100 };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const base = defaultSave();
    return {
      money: typeof data.money === 'number' ? data.money : base.money,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone.filter((n) => Number.isInteger(n)) : [],
      smg: data.smg === true,
      health: typeof data.health === 'number' ? data.health : base.health,
    };
  } catch {
    return null;
  }
}

export function storeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}
