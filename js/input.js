export function createInput(){
  const keys = new Set();
  const pressed = new Set(); // edge-triggered

  const down = (e) => {
    const k = e.key.toLowerCase();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  };
  const up = (e) => {
    keys.delete(e.key.toLowerCase());
  };

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);

  return {
    keys,
    pressed,
    frameEnd(){ pressed.clear(); },

    left(){ return keys.has("arrowleft") || keys.has("a"); },
    right(){ return keys.has("arrowright") || keys.has("d"); },
    jumpHeld(){ return keys.has(" "); },
    jumpPressed(){ return pressed.has(" "); },

    dashPressed(){ return pressed.has("shift"); },
    throwPressed(){ return pressed.has("f"); },

    pausePressed(){ return pressed.has("escape"); },
  };
}
