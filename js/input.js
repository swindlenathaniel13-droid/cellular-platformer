export function createInput(){
  const keys = new Map();
  const pressed = new Set();

  window.addEventListener("keydown", (e) => {
    if (!keys.get(e.code)) pressed.add(e.code);
    keys.set(e.code, true);
  });

  window.addEventListener("keyup", (e) => {
    keys.set(e.code, false);
  });

  return {
    down(code){ return !!keys.get(code); },
    wasPressed(code){ return pressed.has(code); },
    endFrame(){ pressed.clear(); }
  };
}
