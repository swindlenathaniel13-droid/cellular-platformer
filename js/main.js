// js/main.js
window.__BOOT_JS_OK = true;

import { CONFIG } from "./config.js";
import { loadAssets, FILES } from "./assets.js";
import { createInput, anyPressed, KEYS } from "./input.js";
import { moveAndCollide } from "./physics.js";
import { generateWorld, getSolids, collectCoins, checkCheckpoint, checkExit, spikeDamage } from "./world.js";
import { createPlayer, updatePlayer, applyGravity, tryThrow, updateProjectiles, hurtPlayer, snapshotRunState, restoreRunState } from "./player.js";
import { updateEnemies, projectileHits, enemyTouchDamage } from "./enemies.js";
import { render } from "./render.js";
import { $, show, hide, setBootProgress, setBootSub, showBootWarn, updateHUD, buildCharSelect, openShop } from "./ui.js";

const canvas = $("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Force canvas logical size
canvas.width = CONFIG.canvas.w;
canvas.height = CONFIG.canvas.h;

const input = createInput(window);

const bootOverlay = $("bootOverlay");
const bootStartBtn = $("bootStartBtn");

const charOverlay = $("charOverlay");
const pauseOverlay = $("pauseOverlay");
const shopOverlay = $("shopOverlay");
const resultsOverlay = $("resultsOverlay");

const pauseResumeBtn = $("pauseResumeBtn");
const pauseRestartBtn = $("pauseRestartBtn");

const resTitle = $("resTitle");
const resCoins = $("resCoins");
const resDamage = $("resDamage");
const resTime = $("resTime");
const resContinueBtn = $("resContinueBtn");

// Global game state (run)
const state = {
  assets: null,
  mode: "boot", // boot | char | play | pause | shop | results
  level: 1,

  coinsTotal: 0,

  // per-stage stats
  stageCoins: 0,
  stageDamage: 0,
  stageTime: 0,

  world: null,
  player: null,

  // snapshot at level start (for “Restart Level refunds shop purchases this level”)
  levelSnap: null
};

function resetStageStats(){
  state.stageCoins = 0;
  state.stageDamage = 0;
  state.stageTime = 0;
}

function startLevel(level){
  state.level = level;

  state.world = generateWorld(level, state.assets, 1337);
  state.player.x = 40;
  state.player.y = CONFIG.world.floorY - state.player.h;

  state.player.vx = 0;
  state.player.vy = 0;

  resetStageStats();

  // snapshot (coins + upgrades at level start)
  state.levelSnap = snapshotRunState(state.player, state.coinsTotal);

  hide(shopOverlay);
  hide(pauseOverlay);
  hide(resultsOverlay);

  state.mode = "play";
}

function restartLevelWithRefund(){
  if (!state.levelSnap) return;
  restoreRunState(state.player, state.levelSnap);
  state.coinsTotal = state.levelSnap.coinsTotal;
  startLevel(state.level);
}

function runDeathReset(){
  // Death = new run (back to level 1)
  state.coinsTotal = 0;
  state.player.dashUnlocked = false;
  state.player.maxHP = CONFIG.player.maxHP;
  state.player.hp = state.player.maxHP;
  startLevel(1);
}

function openResults(title){
  state.mode = "results";
  resTitle.textContent = title;
  resCoins.textContent = String(state.stageCoins);
  resDamage.textContent = String(state.stageDamage);
  resTime.textContent = `${state.stageTime.toFixed(1)}s`;
  show(resultsOverlay);
}

function openShopNow(){
  state.mode = "shop";
  show(shopOverlay);

  openShop(
    state,
    (item) => {
      if (state.coinsTotal < item.cost) return;

      // BUY
      state.coinsTotal -= item.cost;

      if (item.id === "dash"){
        state.player.dashUnlocked = true;
      } else if (item.id === "hp"){
        state.player.maxHP += 2;
        state.player.hp = state.player.maxHP;
      }

      updateHUD(state);
      openShopNow(); // rebuild buttons disabled/enabled
    },
    () => {
      hide(shopOverlay);
      state.mode = "play";
    }
  );
}

// Pause wiring
pauseResumeBtn.onclick = () => {
  hide(pauseOverlay);
  state.mode = "play";
};

pauseRestartBtn.onclick = () => {
  const ok = confirm("Restart Level?\nThis resets the level and refunds shop purchases made this level.");
  if (!ok) return;
  hide(pauseOverlay);
  restartLevelWithRefund();
};

// Results continue
resContinueBtn.onclick = () => {
  hide(resultsOverlay);
  startLevel(state.level + 1);
};

// Boot
bootStartBtn.disabled = true;
bootStartBtn.onclick = () => {
  hide(bootOverlay);
  show(charOverlay);
  state.mode = "char";

  buildCharSelect(state.assets, (pick) => {
    hide(charOverlay);
    state.player = createPlayer(40, CONFIG.world.floorY - CONFIG.player.h, pick);
    startLevel(1);
  });
};

// Load assets
(async function boot(){
  try{
    setBootSub("JS OK — Loading assets…");

    const { assets, missing, total } = await loadAssets(({done, total, file}) => {
      setBootProgress(done, total, file);
    });

    state.assets = assets;

    if (missing.length){
      showBootWarn(
        "Some assets failed to load:\n" +
        missing.map(m => `- ${m}`).join("\n") +
        "\n\nFix checklist:\n" +
        "• Folder name is exactly: assets\n" +
        "• Filenames match EXACT case (Coin.png ≠ coin.png)\n" +
        "• Files are at /assets (not /assets/assets)\n"
      );
    }

    setBootSub(`Assets loaded (${total - missing.length}/${total}). Press START.`);
    bootStartBtn.disabled = false;
  } catch (e){
    showBootWarn(`Loader crashed:\n${String(e)}`);
  }
})();

let last = performance.now();

function loop(now){
  requestAnimationFrame(loop);

  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.033, Math.max(0, rawDt)); // clamp

  // Toggle pause with ESC
  if (state.mode === "play" && anyPressed(input, KEYS.pause)){
    state.mode = "pause";
    show(pauseOverlay);
  } else if (state.mode === "pause" && anyPressed(input, KEYS.pause)){
    state.mode = "play";
    hide(pauseOverlay);
  }

  if (state.mode === "play"){
    state.stageTime += dt;

    // player intent
    updatePlayer(state.player, input, dt);

    // throw
    tryThrow(state.player, input);

    // gravity + physics
    applyGravity(state.player, dt);

    const solids = getSolids(state.world);

    // move player
    moveAndCollide(state.player, solids, dt);

    // projectiles
    updateProjectiles(state.player, dt);

    // world interactions
    const got = collectCoins(state.world, state.player);
    if (got > 0){
      state.coinsTotal += got;
      state.stageCoins += got;
    }

    // spikes
    const spDmg = spikeDamage(state.world, state.player);
    if (spDmg > 0){
      const took = hurtPlayer(state.player, spDmg, 0);
      if (took) state.stageDamage += spDmg;
    }

    // enemies
    updateEnemies(state.world, state.player, dt);
    projectileHits(state.world, state.player);

    const touch = enemyTouchDamage(state.world, state.player);
    if (touch){
      const took = hurtPlayer(state.player, touch.dmg, touch.knock);
      if (took) state.stageDamage += touch.dmg;
    }

    // checkpoint logic
    const hitCP = checkCheckpoint(state.world, state.player);
    if (hitCP){
      // FIX: unlock exit THEN open shop (but do NOT advance stage)
      openShopNow();
    }

    // exit logic
    if (checkExit(state.world, state.player)){
      openResults("STAGE COMPLETE");
    }

    // death
    if (state.player.hp <= 0){
      const ok = confirm("You died.\nRestart run from Level 1? (Coins/upgrades reset)");
      if (ok){
        runDeathReset();
      } else {
        // if they cancel, just revive them at start with full HP
        state.player.hp = state.player.maxHP;
        state.player.x = 40;
        state.player.y = CONFIG.world.floorY - state.player.h;
      }
    }
  }

  // Draw (always)
  if (state.assets && state.world && state.player){
    render(ctx, state.assets, state.world, state.player);
  } else {
    ctx.clearRect(0,0,CONFIG.canvas.w, CONFIG.canvas.h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,CONFIG.canvas.w, CONFIG.canvas.h);
  }

  if (state.player) updateHUD(state);

  input.tick();
}

requestAnimationFrame(loop);
