// Keyboard and mouse input: WASD movement, mouse-look with pointer lock, and the
// one-shot action keys the game polls each frame.
export const ACTION_ENTER = 'enter';
export const ACTION_SHOOT = 'shoot';
export const ACTION_RELOAD = 'reload';
export const ACTION_JUMP = 'jump';
export const ACTION_PAUSE = 'pause';
export const ACTION_WEAPON = 'weapon';
export const ACTION_INTERACT = 'interact';
export const ACTION_CONFIRM = 'confirm';

const KEY_MAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
  KeyE: 'enter',
  KeyF: 'interact',
  KeyR: 'reload',
  KeyQ: 'weapon',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm',
};

export function createInput(canvas) {
  const held = {};
  const pressed = {};
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let locked = false;

  function onKeyDown(event) {
    const name = KEY_MAP[event.code];
    if (!name) return;
    if (!held[name]) pressed[name] = true;
    held[name] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    const name = KEY_MAP[event.code];
    if (name) held[name] = false;
  }
  function onMouseMove(event) {
    if (!locked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  }
  function onMouseDown(event) {
    if (event.button === 0) mouseDown = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    isDown(name) { return !!held[name]; },
    // Consuming read: a press fires exactly once, even when the fixed-step loop
    // runs update() many times per rendered frame (slow machines, headless
    // SwiftShader). Without this, one E press could enter AND exit a car in the
    // same frame, toggling on the number of steps that frame happened to run.
    wasPressed(name) {
      const v = !!pressed[name];
      pressed[name] = false;
      return v;
    },
    consumeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0; mouseDY = 0;
      return { dx, dy };
    },
    get firing() { return mouseDown; },
    get locked() { return locked; },
    lockPointer() {
      try { canvas.requestPointerLock(); } catch { /* pointer lock can be denied; mouse still steers the camera less */ }
    },
    unlockPointer() {
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ignore */ }
    },
    endFrame() {
      for (const key of Object.keys(pressed)) pressed[key] = false;
    },
  };
}
