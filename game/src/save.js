// localStorage save for Solmar Bay: money, missions finished, SMG unlock
// and the best money total the player has ever held.
export const SAVE_KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: Number.isFinite(data.money) ? data.money : 500,
      missionsDone: Number.isFinite(data.missionsDone) ? data.missionsDone : 0,
      smgUnlocked: data.smgUnlocked === true,
      best: Number.isFinite(data.best) ? data.best : 0,
    };
  } catch (err) {
    return null;
  }
}

export function writeSave(data) {
  try {
    const safe = {
      money: Math.max(0, Math.floor(data.money || 0)),
      missionsDone: Math.max(0, Math.floor(data.missionsDone || 0)),
      smgUnlocked: data.smgUnlocked === true,
      best: Math.max(0, Math.floor(data.best || 0)),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(safe));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (err) { /* no save */ }
}
