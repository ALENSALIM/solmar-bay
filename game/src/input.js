// Keyboard + mouse state. Edge-triggered "pressed" keys are consumed once
// per frame by the game loop, so a single keypress never double-fires.
// Mouse look uses movement deltas (no pointer lock required, so headless
// tests can drive the camera with synthetic mouse events).
export function makeInput() {
  return {
    down: new Set(),
    pressed: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    mouseClicked: false,
    wheel: 0,
  };
}

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.down.add(e.code);
    input.pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    input.down.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.down.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    input.mouseDX += e.movementX || 0;
    input.mouseDY += e.movementY || 0;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('wheel', (e) => {
    input.wheel += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function isDown(input, code) {
  return input.down.has(code);
}

export function wasPressed(input, code) {
  return input.pressed.has(code);
}

// Call once per frame after the game has read the input: edges and deltas reset.
export function endFrame(input) {
  input.pressed.clear();
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.mouseClicked = false;
  input.wheel = 0;
}
