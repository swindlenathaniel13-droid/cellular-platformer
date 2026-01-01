// js/input.js
export function createInput(target = window){
  const down = new Set();
  const pressed = new Set();
  const released = new Set();

  function keyDown(e){
    const code = e.code;
    if (!down.has(code) && !e.repeat) pressed.add(code);
    down.add(code);
  }
  function keyUp(e){
    const code = e.code;
    down.delete(code);
    released.add(code);
  }

  target.addEventListener("keydown", keyDown);
  target.addEventListener("keyup", keyUp);

  return {
    down: (code) => down.has(code),
    pressed: (code) => pressed.has(code),
    released: (code) => released.has(code),
    tick: () => { pressed.clear(); released.clear(); },
    destroy: () => {
      target.removeEventListener("keydown", keyDown);
      target.removeEventListener("keyup", keyUp);
    }
  };
}

export const KEYS = {
  left: ["ArrowLeft","KeyA"],
  right: ["ArrowRight","KeyD"],
  jump: ["Space"],
  throw: ["KeyF"],
  dash: ["ShiftLeft","ShiftRight"],
  pause: ["Escape"]
};

export function anyDown(input, arr){ return arr.some(k => input.down(k)); }
export function anyPressed(input, arr){ return arr.some(k => input.pressed(k)); }
export function anyReleased(input, arr){ return arr.some(k => input.released(k)); }
