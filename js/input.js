// js/input.js
export function createInput(){
  const keys = new Set();

  const down = (e) => {
    keys.add(e.code);
    // prevent page scroll on space
    if (e.code === "Space") e.preventDefault();
  };
  const up = (e) => keys.delete(e.code);

  window.addEventListener("keydown", down, { passive:false });
  window.addEventListener("keyup", up);

  const api = {
    keys,
    left:  () => keys.has("ArrowLeft") || keys.has("KeyA"),
    right: () => keys.has("ArrowRight") || keys.has("KeyD"),
    jump:  () => keys.has("Space"),
    throw: () => keys.has("KeyF"),
    dash:  () => keys.has("ShiftLeft") || keys.has("ShiftRight"),
    pause: () => keys.has("Escape"),
  };

  return api;
}
