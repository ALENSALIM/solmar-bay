// Keyboard and mouse input for Solmar Bay. Tracks held keys, pointer-lock
// look deltas and mouse buttons; also fires one-shot callbacks for keys the
// game wants as presses (E to enter a car, Q to swap weapon, R to reload).
export class Input {
  constructor() {
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.mouseDown = false;
    this.mouseHeld = false;
    this.locked = false;
    this.pressHandlers = new Map();
    this.anyHandlers = [];
    this.enabled = true;
  }

  attach(canvas) {
    window.addEventListener('keydown', (ev) => {
      if (!this.enabled) return;
      if (ev.repeat) return;
      this.keys.add(ev.code);
      const handler = this.pressHandlers.get(ev.code);
      if (handler) handler(ev);
      for (const fn of this.anyHandlers) fn(ev.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) {
        ev.preventDefault();
      }
    });
    window.addEventListener('keyup', (ev) => { this.keys.delete(ev.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseHeld = false; });
    document.addEventListener('mousemove', (ev) => {
      if (!this.locked) return;
      this.lookDX += ev.movementX || 0;
      this.lookDY += ev.movementY || 0;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('mousedown', (ev) => {
      if (ev.button === 0) { this.mouseDown = true; this.mouseHeld = true; }
    });
    window.addEventListener('mouseup', (ev) => {
      if (ev.button === 0) { this.mouseDown = false; this.mouseHeld = false; }
    });
    canvas.addEventListener('click', () => {
      if (!this.locked && this.enabled) {
        try { canvas.requestPointerLock(); } catch (err) { /* pointer lock optional */ }
      }
    });
  }

  onPress(code, fn) { this.pressHandlers.set(code, fn); }
  onAnyKey(fn) { this.anyHandlers.push(fn); }
  down(code) { return this.keys.has(code); }

  consumeLook() {
    const out = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return out;
  }

  consumeClick() {
    const clicked = this.mouseDown;
    this.mouseDown = false;
    return clicked;
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
