import { initUI, showBootLoading, showPressStart, showCharacterSelect, showPauseMenu, showConfirm,
         showStageComplete, showShop, showNextStageLoading, showDeath } from "./ui.js";

// Phase 1 files already provided earlier in your thread:
// (If you already created them, keep them. If not, ask and I’ll paste the full bundle.)
import { CONFIG } from "./config.js";
import { aabb, clamp, formatTime, mulberry32 } from "./utils.js";
import { loadAssets, playSound } from "./assets.js";
import { createWorld } from "./world.js";
import { createPlayer, updatePlayer } from "./player.js";
import { spawnEnemiesForWorld, updateEnemies } from "./enemies.js";
import { render } from "./render.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const state = {
  screen: "BOOT", // BOOT -> START -> SELECT -> LOADING -> PLAY -> STAGE_COMPLETE -> SHOP -> NEXT_LOADING -> PLAY ...
  time: 0,
  levelIndex: 1,
  coins: 0,

  // per-stage stats
  stageCoins: 0,
  stageDamage: 0,
  stageStartAt: 0,

  // deterministic run seed
  runSeed: Math.floor(Math.random() * 1e9),
  levelSeed: 0,

  // snapshot for restart level
  snapshot: null,

  // flags
  shopUsedThisStage: false,
  tutorialDone: localStorage.getItem("ccp_tutorial_done") === "1",

  // objects
  assets: null,
  world: null,
  player: null,
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],
  particles: [],

  // camera smoothing
  cameraX: 0,

  // input
  input: makeInput(),

  // actions assigned by UI
  actions: {},
};

initUI(state);

/* -------------------- INPUT -------------------- */

function makeInput() {
  const held = new Set();
  const pressed = new Set();

  const map = (code) => {
    if (code === "ArrowLeft" || code === "KeyA") return "left";
    if (code === "ArrowRight" || code === "KeyD") return "right";
    if (code === "Space") return "jump";
    if (code === "KeyF") return "throw";
    if (code === "ShiftLeft" || code === "ShiftRight") return "dash";
    if (code === "Escape") return "pause";
    return null;
  };

  window.addEventListener("keydown", (e) => {
    const k = map(e.code);
    if (!k) return;

    // prevent page scroll on Space
    if (e.code === "Space") e.preventDefault();

    if (!held.has(k)) pressed.add(k);
    held.add(k);
  }, { passive:false });

  window.addEventListener("keyup", (e) => {
    const k = map(e.code);
    if (!k) return;
    held.delete(k);
  });

  return {
    held,
    pressed,
    isHeld: (k) => held.has(k),
    isPressed: (k) => pressed.has(k),
    flush: () => pressed.clear(),
  };
}

/* -------------------- GAME FLOW HELPERS -------------------- */

function buildCharacterList() {
  // Use assets already loaded; previews via real URLs so the cards show images
  const base = "./assets/";
  return [
    { key: "Nate",  label: "NATE",  preview: base + "Nate.png" },
    { key: "Kevin", label: "KEVIN", preview: base + "Kevin.png" },
    { key: "Gilly", label: "GILLY", preview: base + "Gilly.png" },
    { key: "Scott", label: "SCOTT", preview: base + "Scott.png" },
    { key: "Edgar", label: "EDGAR", preview: base + "Edgar.png" }, // ✅ added
  ];
}

function startRun() {
  state.levelIndex = 1;
  state.coins = 0;
  state.stageCoins = 0;
  state.stageDamage = 0;
  state.shopUsedThisStage = false;

  // keep tutorialDone flag in localStorage (doesn't repeat)
  state.tutorialDone = localStorage.getItem("ccp_tutorial_done") === "1";

  // new seed per run
  state.runSeed = Math.floor(Math.random() * 1e9);

  goCharacterSelect();
}

function goCharacterSelect() {
  state.screen = "SELECT";
  showCharacterSelect(state, buildCharacterList(), (pickedKey) => {
    state.selectedChar = pickedKey;
    beginLevelLoading(state.levelIndex);
  });
}

function beginLevelLoading(levelIndex) {
  state.screen = "NEXT_LOADING";
  state.loading = {
    t: 0,
    dur: CONFIG.NEXT_STAGE_LOAD_SECONDS,
    madeWorld: false,
  };
}

function buildLevel(levelIndex) {
  // deterministic per-level seed within this run
  state.levelSeed = (state.runSeed + levelIndex * 99991) >>> 0;

  state.world = createWorld(levelIndex, state.runSeed);
  state.player = createPlayer(state.selectedChar || "Nate", state.world.spawn);

  // full health at level start
  state.player.hp = state.player.hpMax;

  spawnEnemiesForWorld(state);

  // per-stage stats reset
  state.stageCoins = 0;
  state.stageDamage = 0;
  state.stageStartAt = state.time;
  state.shopUsedThisStage = false;

  // snapshot for restart level
  state.snapshot = {
    levelIndex,
    coins: state.coins,
    charKey: state.player.charKey,
    hp: state.player.hp,
    hpMax: state.player.hpMax,
    dashUnlocked: state.player.dashUnlocked,
  };

  // camera reset
  state.cameraX = 0;

  state.ui.clear();
  state.screen = "PLAY";

  // tutorial overlay only on level 1 and only once
  if (levelIndex === 1 && !state.tutorialDone) {
    state.tutorial = {
      moved: false,
      jumped: false,
      threw: false,
      gotCoin: false,
      shown: true
    };
    state.ui.toast("Tutorial: Move / Jump / Throw / Collect a coin", 1800);
  }
}

function restartLevel() {
  if (!state.snapshot) return;
  state.ui.toast("Restarting level…", 900);

  // restore snapshot and rebuild same level
  state.coins = state.snapshot.coins;
  buildLevel(state.snapshot.levelIndex);
}

function restartRunFromDeathOrMenu() {
  showDeath(state, { level: state.levelIndex, coins: state.coins }, () => {
    // Hard reset run
    startRun();
  });
}

function stageComplete() {
  state.screen = "STAGE_COMPLETE";

  const timeStr = formatTime(state.time - state.stageStartAt);
  const results = {
    coins: state.stageCoins,
    damage: state.stageDamage,
    time: timeStr,
  };

  // high score
  const best = Number(localStorage.getItem("ccp_best_level") || "0");
  if (state.levelIndex > best) localStorage.setItem("ccp_best_level", String(state.levelIndex));

  showStageComplete(
    state,
    results,
    () => openShop(),
    () => beginNextStage()
  );
}

function openShop() {
  // Shop only once per stage
  if (state.shopUsedThisStage) {
    state.ui.toast("Shop already used this stage.", 1200);
    return;
  }
  state.shopUsedThisStage = true;
  state.screen = "SHOP";
  renderShop();
}

function renderShop() {
  const items = [
    {
      id: "heal",
      name: "FULL REPAIR",
      desc: "Restore HP to full.",
      cost: 8,
      disabled: state.coins < 8 || state.player.hp >= state.player.hpMax,
      soldOut: false,
    },
    {
      id: "maxhp",
      name: "+1 MAX HP",
      desc: "Increase max HP by 1 (up to 14).",
      cost: 12,
      disabled: state.coins < 12 || state.player.hpMax >= 14,
      soldOut: state.player.hpMax >= 14,
    },
    {
      id: "dash",
      name: "UNLOCK DASH",
      desc: "Unlock Shift dash immediately.",
      cost: 15,
      disabled: state.coins < 15 || state.player.dashUnlocked,
      soldOut: state.player.dashUnlocked,
    },
    {
      id: "throwdmg",
      name: "+THROW POWER",
      desc: "Increase thrown phone damage (max +2).",
      cost: 10,
      disabled: state.coins < 10 || (state.player.throwDmgBonus ?? 0) >= 2,
      soldOut: (state.player.throwDmgBonus ?? 0) >= 2,
    },
    {
      id: "speed",
      name: "SPEED MODULE",
      desc: "Small speed boost next stage (8s).",
      cost: 9,
      disabled: state.coins < 9,
      soldOut: false,
    },
  ];

  showShop(
    state,
    { items },
    (id) => {
      if (id === "heal") {
        if (state.coins < 8) return;
        state.coins -= 8;
        state.player.hp = state.player.hpMax;
        state.ui.toast("Full repair!", 900);
        playSound(state, "buy");
      }
      if (id === "maxhp") {
        if (state.coins < 12 || state.player.hpMax >= 14) return;
        state.coins -= 12;
        state.player.hpMax += 1;
        state.player.hp = state.player.hpMax;
        state.ui.toast("+1 Max HP!", 900);
        playSound(state, "buy");
      }
      if (id === "dash") {
        if (state.coins < 15 || state.player.dashUnlocked) return;
        state.coins -= 15;
        state.player.dashUnlocked = true;
        state.ui.toast("Dash unlocked!", 900);
        playSound(state, "buy");
      }
      if (id === "throwdmg") {
        if (state.coins < 10) return;
        state.coins -= 10;
        state.player.throwDmgBonus = (state.player.throwDmgBonus ?? 0) + 1;
        state.ui.toast("Throw power increased!", 900);
        playSound(state, "buy");
      }
      if (id === "speed") {
        if (state.coins < 9) return;
        state.coins -= 9;
        state.player.speedBoost = Math.max(state.player.speedBoost, 8.0);
        state.ui.toast("Speed module ready!", 900);
        playSound(state, "buy");
      }

      // refresh shop UI with new states
      renderShop();
    },
    () => beginNextStage()
  );
}

function beginNextStage() {
  // goes to loading, then builds next level
  beginLevelLoading(state.levelIndex + 1);
}

function togglePause() {
  if (state.screen !== "PLAY") return;

  state.screen = "PAUSED";
  showPauseMenu(state, {
    onResume: () => {
      state.ui.clear();
      state.screen = "PLAY";
    },
    onRestartLevel: () => {
      showConfirm(
        state,
        "RESTART LEVEL?",
        "This resets coins collected, pickups, enemies, and damage for this level.",
        "YES",
        "NO",
        () => restartLevel(),
        () => showPauseMenu(state, {
          onResume: () => { state.ui.clear(); state.screen="PLAY"; },
          onRestartLevel: () => togglePause(), // will be overridden next open
          onRestartRun: () => togglePause(),
        })
      );
    },
    onRestartRun: () => {
      showConfirm(
        state,
        "RESTART RUN?",
        "This sends you back to Level 1 and clears run coins/progress.\nTutorial will not repeat.",
        "YES",
        "NO",
        () => startRun(),
        () => showPauseMenu(state, {
          onResume: () => { state.ui.clear(); state.screen="PLAY"; },
          onRestartLevel: () => {},
          onRestartRun: () => {},
        })
      );
    }
  });
}

/* -------------------- COLLISIONS / RULES -------------------- */

function applyDamageToPlayer(amount, knockX = 0, knockY = -260) {
  const p = state.player;
  if (!p) return;
  if (p.iFrames > 0) return;

  p.hp -= amount;
  state.stageDamage += amount;
  p.hurtFlash = 0.18;
  p.iFrames = 0.6;

  p.vx += knockX;
  p.vy = Math.min(p.vy, knockY);

  if (p.hp <= 0) {
    // death → show death screen → restart run
    state.screen = "DEAD";
    showDeath(state, { level: state.levelIndex, coins: state.coins }, () => startRun());
  }
}

function updateRules(dt) {
  const p = state.player;
  if (!p) return;

  // iFrames tick
  p.iFrames = Math.max(0, (p.iFrames ?? 0) - dt);

  // hazards
  for (const hz of state.world.hazards || []) {
    if (aabb(p, hz)) {
      applyDamageToPlayer(1, p.face * -180, -320);
    }
  }

  // enemy touch damage
  for (const e of state.enemies || []) {
    if (aabb(p, e)) {
      const dir = (p.x + p.w/2) < (e.x + e.w/2) ? -1 : 1;
      applyDamageToPlayer(1, dir * 240, -320);
    }
  }

  // enemy bullets
  for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
    const b = state.enemyProjectiles[i];
    if (aabb(p, b)) {
      state.enemyProjectiles.splice(i, 1);
      const dir = b.vx > 0 ? 1 : -1;
      applyDamageToPlayer(b.dmg ?? 1, dir * 220, -280);
    }
  }

  // fell off map
  if (p.y > CONFIG.BASE_GROUND_Y + 520) {
    // hard death: restart run, full health, tutorial not repeated
    state.screen = "DEAD";
    showDeath(state, { level: state.levelIndex, coins: state.coins }, () => startRun());
  }

  // tutorial progression (only level 1, only if not done)
  if (state.levelIndex === 1 && !state.tutorialDone && state.tutorial?.shown) {
    if (!state.tutorial.moved && (state.input.isHeld("left") || state.input.isHeld("right"))) state.tutorial.moved = true;
    if (!state.tutorial.jumped && state.input.isPressed("jump")) state.tutorial.jumped = true;
    if (!state.tutorial.threw && state.input.isPressed("throw")) state.tutorial.threw = true;
    if (!state.tutorial.gotCoin && state.stageCoins > 0) state.tutorial.gotCoin = true;

    if (state.tutorial.moved && state.tutorial.jumped && state.tutorial.threw && state.tutorial.gotCoin) {
      state.tutorialDone = true;
      localStorage.setItem("ccp_tutorial_done", "1");
      state.ui.toast("Tutorial complete!", 1200);
      state.tutorial.shown = false;
    }
  }

  // exit gating: if boss exists, require boss dead
  const bossAlive = (state.enemies || []).some(e => e.type === "Boss");
  const exit = state.world.exit;

  if (exit && aabb(p, exit)) {
    if (bossAlive) {
      state.ui.toast("Defeat the boss to unlock the exit!", 1100);
    } else {
      stageComplete();
    }
  }
}

/* -------------------- MAIN LOOP -------------------- */

let last = performance.now();

async function boot() {
  // Boot screen while assets load
  let prog = 0;
  showBootLoading(state, 0, "Loading assets…");

  state.assets = await loadAssets((p01, label) => {
    prog = p01;
    showBootLoading(state, prog, label || "Loading assets…");
  });

  state.screen = "START";
  showPressStart(state, () => {
    startRun();
  });
}

function tick(now) {
  const rawDt = (now - last) / 1000;
  last = now;

  // clamp dt so physics doesn't explode
  const dt = clamp(rawDt, 0, 1 / 30);

  state.time += dt;

  // global input actions
  if (state.input.isPressed("pause")) {
    if (state.screen === "PLAY") togglePause();
    else if (state.screen === "PAUSED") { state.ui.clear(); state.screen = "PLAY"; }
  }

  // state updates
  if (state.screen === "NEXT_LOADING") {
    state.loading.t += dt;
    const p01 = clamp(state.loading.t / state.loading.dur, 0, 1);

    showNextStageLoading(state, p01, `STAGE ${state.levelIndex} → ${state.screenTargetLevel ?? ""}`.trim());

    // Build world early (so it’s ready before fade ends)
    if (!state.loading.madeWorld && state.loading.t > state.loading.dur * 0.2) {
      const targetLevel = state.levelIndex; // default
      // If we came from "next stage", the intended target is current+1
      const intended = state.levelIndex;
      // We set intended by reading if stage was complete:
      // In this implementation we simply treat NEXT_LOADING as "go to current levelIndex already set"
      state.loading.madeWorld = true;
      buildLevel(state.levelIndex);
      // Note: buildLevel sets screen to PLAY and clears UI; we need to keep loading visible until end
      state.screen = "NEXT_LOADING";
    }

    showNextStageLoading(state, p01, `LOADING STAGE ${state.levelIndex}`);

    if (p01 >= 1) {
      // finalize: ensure world is built
      if (!state.world || state.screen !== "PLAY") {
        buildLevel(state.levelIndex);
      } else {
        state.ui.clear();
        state.screen = "PLAY";
      }
    }
  }

  if (state.screen === "PLAY") {
    // camera smoothing target
    const camTarget = clamp(state.player.x - CONFIG.CANVAS_W * 0.35, 0, state.world.length - CONFIG.CANVAS_W);
    state.cameraX += (camTarget - state.cameraX) * clamp(8 * dt, 0, 1);

    // store dt for particle decay inside render (tiny hack)
    state._dtForParticles = dt;

    updatePlayer(state, dt);
    updateEnemies(state, dt);
    updateRules(dt);

    // Update HUD chips
    state.ui.updateHUD();
  }

  // Draw
  if (state.assets && state.world && state.player) {
    render(state, ctx);
  } else {
    // keep canvas dark until ready
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Clear pressed keys at end
  state.input.flush();

  requestAnimationFrame(tick);
}

/* -------------------- FIX NEXT_LOADING TRANSITIONS -------------------- */
/* We use these helpers to keep levelIndex consistent through loading. */

function beginNextStage() {
  // called from Stage Complete or Shop
  state.levelIndex += 1;
  beginLevelLoading(state.levelIndex);
}

function beginLevelLoading(levelIndex) {
  state.levelIndex = levelIndex;
  state.screen = "NEXT_LOADING";
  state.loading = { t: 0, dur: CONFIG.NEXT_STAGE_LOAD_SECONDS, madeWorld: false };
}

/* -------------------- HOOK UI BACK ACTION -------------------- */
state.actions.goBoot = () => {
  state.screen = "START";
  showPressStart(state, () => startRun());
};

/* -------------------- BOOT -------------------- */
boot().then(() => requestAnimationFrame(tick));

