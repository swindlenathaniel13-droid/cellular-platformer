const PREVENT = new Set(["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export function createInput(target = window) {
  const down = new Set();
  const pressed = new Set();
  const released = new Set();

  function onKeyDown(e) {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  }

  function onKeyUp(e) {
    if (PREVENT.has(e.code)) e.preventDefault();
    down.delete(e.code);
    released.add(e.code);
  }

  target.addEventListener("keydown", onKeyDown, { passive: false });
  target.addEventListener("keyup", onKeyUp, { passive: false });

  return {
    isDown: (code) => down.has(code),
    wasPressed: (code) => pressed.has(code),
    wasReleased: (code) => released.has(code),

    consumePress(code) {
      const had = pressed.has(code);
      pressed.delete(code);
      return had;
    },

    consumeRelease(code) {
      const had = released.has(code);
      released.delete(code);
      return had;
    },

    clearFrame() {
      pressed.clear();
      released.clear();
    },

    destroy() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
    },
  };
}
