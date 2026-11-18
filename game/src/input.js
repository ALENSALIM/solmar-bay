// Keyboard and mouse input for Solmar Bay. Keys are tracked by e.code so the
// layout does not matter. Pressed keys are consumed once per frame.

export class Input {
  constructor() {
    this.downKeys = new Set();
    this.pressedKeys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.anyKey = false;
    this.onKeyDown = (e) => {
      if (e.repeat) return;
      this.downKeys.add(e.code);
      this.pressedKeys.add(e.code);
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this.onKeyUp = (e) => {
      this.downKeys.delete(e.code);
    };
    this.onMouseMove = (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    this.onMouseDown = (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.mouseClicked = true;
    };
    this.onMouseUp = (e) => {
      if (e.button !== 0) return;
      this.mouseDown = false;
    };
    this.onBlur = () => {
      this.downKeys.clear();
      this.mouseDown = false;
    };
  }

  attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onBlur);
  }

  down(code) {
    return this.downKeys.has(code);
  }

  // True once for the frame in which the key went down, then consumed.
  wasPressed(code) {
    if (this.pressedKeys.has(code)) {
      this.pressedKeys.delete(code);
      return true;
    }
    return false;
  }

  // True if the key was pressed since the last endFrame, without consuming others.
  peekPressed(code) {
    return this.pressedKeys.has(code);
  }

  clickConsumed() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  endFrame() {
    this.pressedKeys.clear();
    this.mouseClicked = false;
  }
}
