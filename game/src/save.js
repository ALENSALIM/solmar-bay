// Save / load progress in localStorage. Guarded: headless or private modes
// can throw, and the game must keep working without a save.
const KEY = 'solmar-bay-save-v1';

export function defaultSave() {
  return { money: 250, missionsDone: [], smgUnlocked: false, best: 0 };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    return {
      money: typeof data.money === 'number' ? data.money : base.money,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      smgUnlocked: !!data.smgUnlocked,
      best: typeof data.best === 'number' ? data.best : 0,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data) {
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
    // ignore
  }
}
