// /js/main.js
window.__BOOT_JS_OK = true;

import { CONFIG } from "./config.js";
import { loadAssets, FILES } from "./assets.js";
import { createInput } from "./input.js";
import { buildLevel } from "./world.js";
import { createPlayer, updatePlayer } from "./player.js";
import { render } from "./render.js";

const $ = (id) => document.getElementById(id);

// Canvas
const canvas = $("game");
const ctx = canvas?.getContext("2d");
if (ctx) ctx.imageSmoothingEnabled = false;

// Boot UI (null-safe)
const bootOverlay = $("bootOverlay");
const bootBar = $("bootBar");
const bootText = $("bootText");
const bootSub = $("bootSub");
const bootFile = $("bootFile");
const bootWarn = $("bootWarn");
const bootStartBtn = $("bootStartBtn");

// Character select
const charOverlay = $("charOverlay");
const charGrid = $("charGrid");
const charStartBtn = $("charStartBtn");

// Pause
const pauseOverlay = $("pauseOverlay");
const resumeBtn = $("resumeBtn");

// HUD
const hudLevel = $("hudLevel");
const hudCoins = $("hudCoins");
const hudHP = $("hudHP");

function show(el){ el?.classList.add("overlay--show"); }
function hide(el){ el?.classList.remove("overlay--show"); }

function warn(text){
  if (!bootWarn) return;
  bootWarn.style.display = "block";
  bootWarn.textContent = text;
}

function setProgress(done, total){
  const pct = total ? Math.round((done/total)*100) : 0;
  if (bootBar) bootBar.style.width = `${pct}%`;
  if (bootText) bootText.textContent = `${pct}%`;
}

function fatal(msg, err){
  console.error(msg, err);
  if (bootSub) bootSub.textContent = "Boot failed (see message below)";
  warn(msg + (err ? "\n\n" + String(err) : ""));
}

const input = createInput();

let assets = null;
let world = null;
let player = null;
let camX = 0;

const game = {
  level: 1,
  totalCoins: 0,
  selectedCharKey: null,
};

function buildCharSelect(){
  if (!charGrid || !charStartBtn) return;

  charGrid.innerHTML = "";
  const chars = [
    { key:"nate",  label:"Nate"  },
    { key:"kevin", label:"Kevin" },
    { key:"scott", label:"Scott" },
    { key:"gilly", label:"Gilly" },
    { key:"edgar", label:"Edgar" },
  ];

  for (const c of chars){
    const btn = document.createElement("div");
    btn.className = "charBtn";
    btn.dataset.key = c.key;

    const img = document.createElement("img");
    img.src = `./assets/${FILES[c.key]}`;
    img.alt = c.label;

    const meta = document.createElement("div");
    meta.innerHTML = `
      <div style="font-family:'Press Start 2P', monospace; font-size:11px;">${c.label}</div>
      <div class="tiny" style="margin:0;color:#9bb3da;">Pick your fighter.</div>
    `;

    btn.appendChild(img);
    btn.appendChild(meta);

    btn.addEventListener("click", () => {
      game.selectedCharKey = c.key;
      for (const el of charGrid.querySelectorAll(".charBtn")) el.classList.remove("active");
      btn.classList.add("active");
      charStartBtn.disabled = false;
    });

    charGrid.appendChild(btn);
  }

  charStartBtn.disabled = true;
}

function startRun(){
  world = buildLevel(game.level);
  player = createPlayer(game.selectedCharKey ?? "nate");
  camX = 0;
  hide(charOverlay);
  hide(bootOverlay);
}

bootStartBtn?.addEventListener("click", () => {
  hide(bootOverlay);
  show(charOverlay);
  buildCharSelect();
});

charStartBtn?.addEventListener("click", () => {
  startRun();
});

resumeBtn?.addEventListener("click", () => {
  hide(pauseOverlay);
});

let last = performance.now();
function loop(now){
  const dt = Math.min(0.033, (now - last)/1000);
  last = now;

  // Draw something even before run starts
  if (!ctx){
    return requestAnimationFrame(loop);
  }

  if (assets && world && player){
    world.stageTime += dt;
    updatePlayer(player, input, world, dt);

    // Camera follow
    const targetCam = Math.max(0, player.x - CONFIG.CANVAS_W*0.35);
    camX += (targetCam - camX) * CONFIG.CAM_LERP;

    // HUD
    hudLevel && (hudLevel.textContent = String(game.level));
    hudCoins && (hudCoins.textContent = String(game.totalCoins + world.stageCoins));
    hudHP && (hudHP.textContent = `${player.hp}/${player.hpMax}`);

    render(ctx, assets, world, player, camX);
  } else {
    ctx.clearRect(0,0,CONFIG.CANVAS_W,CONFIG.CANVAS_H);
    ctx.fillStyle="#000";
    ctx.fillRect(0,0,CONFIG.CANVAS_W,CONFIG.CANVAS_H);
  }

  input.endFrame();
  requestAnimationFrame(loop);
}

(async function boot(){
  try{
    if (bootSub) bootSub.textContent = "JS OK — Loading assets…";
    if (bootStartBtn) bootStartBtn.disabled = true;

    const res = await loadAssets(({file,done,total}) => {
      if (bootFile) bootFile.textContent = `Loading: ${file}`;
      setProgress(done, total);
    });

    assets = res.assets;

    if (bootFile) bootFile.textContent = "—";

    if (res.missing?.length){
      warn(
        "Some assets failed to load:\n" +
        res.missing.map(m => `- ${m}`).join("\n") +
        "\n\nFix checklist:\n" +
        "• Folder name is exactly: assets\n" +
        "• Filenames match EXACT case (Spike.png ≠ spike.png)\n" +
        "• Files are at /assets (not /assets/assets)\n"
      );
    }

    if (bootSub) bootSub.textContent = "Assets loaded. Press START.";
    if (bootStartBtn) bootStartBtn.disabled = false;

    requestAnimationFrame(loop);
  } catch (e){
    fatal("Loader crashed during boot().", e);
  }
})();
