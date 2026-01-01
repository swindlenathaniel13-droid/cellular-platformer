export function createInput(){
  const keys = new Set();
  const pressed = new Set();
  const released = new Set();

  function down(e){
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  }
  function up(e){
    keys.delete(e.code);
    released.add(e.code);
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)) e.preventDefault();
    down(e);
  }, { passive:false });

  window.addEventListener("keyup", up);

  return {
    isDown: (code) => keys.has(code),
    wasPressed: (code) => pressed.has(code),
    wasReleased: (code) => released.has(code),
    tick: () => { pressed.clear(); released.clear(); }
  };
}
