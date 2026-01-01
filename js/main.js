import { CONFIG } from "./config.js";
import { loadAssets } from "./assets.js";
import { createInput } from "./input.js";
import { nowSec } from "./utils.js";
import { createUI, setBootProgress, showBootWarn, setHUD, buildCharSelect, showShop, showStageComplete } from "./ui.js";
import { createWorld, collectCoins, touchCheckpoint, touchExit } from "./world.js";
import { createPlayer, updatePlayer } from "./player.js";
import { spawnEnemiesForLevel, updateEnemies } from "./enemies.js";
import { renderGame } from "./render.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const ui = createUI();
const input = createInput();

let assets = null;

let paused = false;
let gameStarted = false;

let run = null;     // persistent across levels (unless death/restart)
let stage = null;   // per-level

function newRun(){
  return {
    level: 1,
    coins: 0,
    baseHP: CONFIG.START_HP,
    maxHP: CONFIG.START_HP,
    dashUnlocked: false,
    speedTier: 0
  };
}

function newStage(level, charKey){
  const world = createWorld(level);
  spawnEnemiesForLevel(world, level);

  const player = createPlayer(60, 380, charKey);
  player.maxHP = run.maxHP;
  player.hp = run.maxHP;
  player.dashUnlocked = run.dashUnlocked;
  player.speedMult = 1.0 + run.speedTier * 0.08;

  return {
    world,
    player,
    cam: { x: 0, y: 0 },
    stageCoins: 0,
    damageTaken: 0,
    startTime: nowSec(),
    finished: false,
    inShop: false
  };
}

function setCamera(){
  // Follow player with clamping
  const targetX = stage.player.x - CONFIG.CANVAS_W * 0.35;
  stage.cam.x = Math.max(0, Math.min(stage.world.width - CONFIG.CANVAS_W, targetX));
  stage.cam.y = 0;
}

function applyHUD(){
  setHUD(ui, {
    level: run.level,
    coins: run.coins,
    dashUnlocked: run.dashUnlocked,
    speedTier: run.speedTier,
    hp: stage.player.hp,
    maxHP: stage.player.maxHP
  });
}

function openShop(){
  stage.inShop = true;
  ui.show(ui.shop.overlay);

  showShop(
    ui,
    run,
    (id, cost) => {
      if (run.coins < cost) return;
      if (id === "dash" && !run.dashUnlocked){
        run.coins -= cost;
        run.dashUnlocked = true;
      }
      if (id === "speed" && run.speedTier < 3){
        run.coins -= cost;
        run.speedTier += 1;
      }
      if (id === "hp" && run.maxHP < run.baseHP + 5){
        run.coins -= cost;
        run.maxHP += 1;
      }
      // reflect upgrades on player for next stage only
      applyHUD();
    },
    () => {
      ui.hide(ui.shop.overlay);
      stage.inShop = false;
      stageComplete();
    }
  );
}

function stageComplete(){
  stage.finished = true;

  const t = nowSec() - stage.startTime;
  const stats = {
    stageCoins: stage.stageCoins,
    damageTaken: stage.damageTaken,
    time: t,
    totalCoins: run.coins
  };

  ui.show(ui.stage.overlay);
  showStageComplete(ui, stats, () => {
    ui.hide(ui.stage.overlay);
    nextLevel();
  });
}

function nextLevel(){
  // next level, keep run coins + upgrades
  run.level += 1;

  ui.show(ui.boot.overlay);
  if (ui.boot.sub) ui.boot.sub.textContent = "Loading next stage…";
  if (ui.boot.startBtn) ui.boot.startBtn.disabled = true;

  // quick fake loader (arcade vibe)
  let fake = 0;
  const tick = () => {
    fake += 1;
    setBootProgress(ui, fake, 20, "Building level…");
    if (fake < 20) requestAnimationFrame(tick);
    else {
      ui.hide(ui.boot.overlay);
      stage = newStage(run.level, stage.player.charKey);
      applyHUD();
    }
  };
  requestAnimationFrame(tick);
}

function dieAndResetRun(){
  ui.show(ui.death.overlay);
  ui.death.restartBtn.onclick = () => {
    ui.hide(ui.death.overlay);
    run = newRun();
    stage = newStage(run.level, stage.player.charKey);
    applyHUD();
  };
}

function togglePause(){
  if (!gameStarted) return;
  paused = !paused;
  if (paused) ui.show(ui.pause.overlay);
  else ui.hide(ui.pause.overlay);
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape"){
    e.preventDefault();
    togglePause();
  }
});

ui.pause.resumeBtn.onclick = () => togglePause();
ui.pause.restartRunBtn.onclick = () => {
  // Reset EVERYTHING (coins + upgrades), per your request
  ui.hide(ui.pause.overlay);
  paused = false;
  run = newRun();
  stage = newStage(run.level, stage.player.charKey);
  applyHUD();
};

async function boot(){
  ui.show(ui.boot.overlay);
  if (ui.boot.sub) ui.boot.sub.textContent = "Loading assets…";

  const { assets: loaded, missing } = await loadAssets(({ done, total, file }) => {
    setBootProgress(ui, done, total, file);
  });

  assets = loaded;

  if (missing.length){
    showBootWarn(ui,
      "Some assets failed to load:\n" +
      missing.map(m => `- ${m}`).join("\n") +
      "\n\nFix checklist:\n" +
      "• Folder name is exactly: assets\n" +
      "• Filenames match EXACT case (Coin.png ≠ coin.png)\n" +
      "• Files are at /assets (not /assets/assets)\n"
    );
  }

  if (ui.boot.sub) ui.boot.sub.textContent = "Assets loaded. Press START.";
  ui.boot.startBtn.disabled = false;

  ui.boot.startBtn.onclick = () => {
    ui.hide(ui.boot.overlay);
    ui.show(ui.chars.overlay);
    buildCharSelect(ui, assets, (charKey) => {
      ui.hide(ui.chars.overlay);
      startGame(charKey);
    });
  };
}

function startGame(charKey){
  gameStarted = true;
  run = newRun();
  stage = newStage(run.level, charKey);
  applyHUD();
}

let last = performance.now();
let acc = 0;
const FIXED = 1/60;

function loop(now){
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  acc += dt;

  // Input tick is per-frame for pressed/released
  // (fixed steps use same pressed data for that frame)
  const doFrame = () => {
    if (!gameStarted || !stage){
      // background idle
      ctx.clearRect(0,0,CONFIG.CANVAS_W, CONFIG.CANVAS_H);
      ctx.fillStyle = "#000"; ctx.fillRect(0,0,CONFIG.CANVAS_W, CONFIG.CANVAS_H);
      return;
    }

    if (paused || stage.inShop || stage.finished){
      renderGame(ctx, assets, stage.world, stage.player, stage.cam);
      return;
    }

    // Fixed update steps
    while (acc >= FIXED){
      step(FIXED);
      acc -= FIXED;
    }

    setCamera();
    renderGame(ctx, assets, stage.world, stage.player, stage.cam);
  };

  doFrame();
  input.tick();
  requestAnimationFrame(loop);
}

function step(dt){
  const p = stage.player;
  const w = stage.world;

  // Update player
  updatePlayer(p, input, w.platforms, w.hazards, dt, (dmg) => {
    p.hp -= dmg;
    stage.damageTaken += dmg;
    applyHUD();
    if (p.hp <= 0){
      dieAndResetRun();
    }
  });

  // Fall death (off map)
  if (p.y > w.height){
    dieAndResetRun();
    return;
  }

  // Coins
  const got = collectCoins(w, p);
  if (got > 0){
    stage.stageCoins += got;
    run.coins += got;
    applyHUD();
  }

  // Checkpoint => unlock door ONLY
  if (touchCheckpoint(w, p)){
    // door unlocked, do NOT open shop here
    // (shop opens at the exit door)
  }

  // Enemies
  updateEnemies(w, p, dt, (dmg) => {
    p.hp -= dmg;
    stage.damageTaken += dmg;
    applyHUD();
    if (p.hp <= 0){
      dieAndResetRun();
    }
  });

  // Exit: only after checkpoint unlocked and (if boss exists) boss dead
  const bossBlocks = (w.bossAlive === true);
  if (touchExit(w, p) && !bossBlocks){
    // open shop at exit
    openShop();
  }
}

boot();
requestAnimationFrame(loop);
