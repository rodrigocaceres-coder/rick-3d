// Keyboard state. held(code) is true while a key is down, pressed(code) is true only on the frame it went down.
const down = new Set();
const justDown = new Set();

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!e.repeat) { down.add(e.code); justDown.add(e.code); }
});
window.addEventListener('keyup', (e) => down.delete(e.code));
window.addEventListener('blur', () => down.clear());

const input = {
  held: (...codes) => codes.some((c) => down.has(c)),
  pressed: (...codes) => codes.some((c) => justDown.has(c)),
  // Movement as x (left/right) and z (up/down on screen), each -1, 0 or 1
  axis() {
    const x = (input.held('KeyD', 'ArrowRight') ? 1 : 0) - (input.held('KeyA', 'ArrowLeft') ? 1 : 0);
    const z = (input.held('KeyS', 'ArrowDown') ? 1 : 0) - (input.held('KeyW', 'ArrowUp') ? 1 : 0);
    return { x, z };
  },
  // Call at the end of every frame
  endFrame() { justDown.clear(); },
  // Resolves the next time one of the keys goes down (used by cards and dialogue)
  nextPress(...codes) {
    return new Promise((resolve) => {
      const on = (e) => {
        if (e.repeat || !codes.includes(e.code)) return;
        window.removeEventListener('keydown', on);
        resolve(e.code);
      };
      window.addEventListener('keydown', on);
    });
  },
};

export default input;
