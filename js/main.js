import { CONFIG } from "./config.js";
import { clamp, formatTime, aabb } from "./utils.js";
import { loadAssets } from "./assets.js";
import { createWorld } from "./world.js";
import { createPlayer, updatePlayer } from "./player.js";
import { spawnEnemiesForWorld, updateEnemies } from "./enemies.js";
import { render } from "./render.js";

import {
  initUI,
  showBootLoading,
  showPressStart,
  showCharacterSelect,
  showPauseMenu,
  showConfirm,
  showStageComplete,
  showShop,
  showNextStageLoading,
  showDeath,
} from "./ui.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const state = {
  screen: "BOOT",
  time: 0,

  levelIndex: 1,
  coins: 0,

  stageCoins: 0,
  stageDamage: 0,
  stageStartAt: 0,

  runSeed: Math.floor(Math.random() * 1e9),

  assets: null,
  world: null,
  player: null,
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],

  cameraX: 0,

  shopUsedThisStage: false,
  tutorialDone: localStorage.getItem("ccp_tutorial_done") === "1",

  runUpgrades: {
    hpMaxBonus: 0,
    dashUnlocked: false,
    throwDmgBonus: 0,
    speedBoostSeconds: 0, // applied at start of next level then consumed
  },

  // for restart level
  levelSnapshot: null,

  input: makeInput(),
};

initUI(state);

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

  window.addEventListener(
    "keydown",
    (e) => {
      const k = map(e.code);
      if (!k) return;
      if (e.code === "Space") e.preventDefault();
      if (!held.has(k)) pressed.add(k);
      held.add(k);
    },
    { passive: false }
  );

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

function characterList() {
  const base = "./assets/";
  return [
    { key: "Nate", label: "NATE", preview: base + "Nate.png" },
    { key: "Kevin", label: "KEVIN", preview: base + "Kevin.png" },
    { key: "Gilly", label: "GILLY", preview: base + "Gilly.png" },
    { key: "Scott", label: "SCOTT", preview: base + "Scott.png" },
    { key: "Edgar", label: "EDGAR", preview: base + "Edgar.png" },
  ];
}

/* ---------- FLOW ---------- */

async function boot() {
  state.screen = "BOOT";
  showBootLoading(state, 0, "Loading assets…");

  state.assets = await loadAssets((p01, msg) => showBootLoading(state, p01, msg));

  state.screen = "PRESS_START";
  showPressStart(state, () => {
    chooseCharacter();
  });
}

function chooseCharacter() {
  state.screen = "SELECT";
  showCharacterSelect(state, characterList(), (picked) => {
    state.selectedChar = picked;
    startRun();
  });
}

function startRun() {
  state.levelIndex = 1;
  state.coins = 0;
  state.stageCoins = 0;
  state.stageDamage = 0;
  state.shopUsedThisStage = false;

  // tutorial only once ever
  state.tutorialDone = localStorage.getItem("ccp_tutorial_done") === "1";

  state.runSeed = Math.floor(Math.random() * 1e9);

  state.runUpgrades = {
    hpMaxBonus: 0,
    dashUnlocked: false,
    throwDmgBonus: 0,
    speedBoostSeconds: 0,
  };

  startLevel(state.levelIndex);
}

function startLevel(levelIndex) {
  state.levelIndex = levelIndex;
  state.screen = "LEVEL_LOADING";

  // build instantly (but we show an arcade loading bar for polish)
  buildLevelNow(levelIndex);

  state.load = { t: 0, dur: CONFIG.NEXT_STAGE_LOAD_SECONDS };
  showNextStageLoading(state, 0, `LOADING STAGE ${levelIndex}`);
}

function buildLevelNow(levelIndex) {
  state.world = createWorld(levelIndex, state.runSeed);

  // apply “next stage” speed boost then consume it
  const upgrades = { ...state.runUpgrades };
  const speedSeconds = upgrades.speedBoostSeconds || 0;
  upgrades.speedBoostSeconds = 0;

  state.player = createPlayer(state.selectedChar || "Nate", state.world.spawn, upgrades);
  state.player.speedBoost = speedSeconds; // active this level only

  state.projectiles = [];
  state.enemyProjectiles = [];
  spawnEnemiesForWorld(state);

  state.stageCoins = 0;
  state.stageDamage = 0;
  state.stageStartAt = state.time;

  state.shopUsedThisStage = false;

  // snapshot for restart-level
  state.levelSnapshot = {
    levelIndex,
    coins: state.coins,
    runUpgrades: JSON.parse(JSON.stringify(state.runUpgrades)),
    charKey: state.selectedChar,
  };

  state.cameraX = 0;
}

function restartLevel() {
  if (!state.levelSnapshot) return;
  state.coins = state.levelSnapshot.coins;
  state.runUpgrades = JSON.parse(JSON.stringify(state.levelSnapshot.runUpgrades));
  state.selectedChar = state.levelSnapshot.charKey;
  startLevel(state.levelSnapshot.levelIndex);
}

function restartRun() {
  showDeath(state, { level: state.levelIndex, coins: state.coins }, () => {
    startRun();
  });
}

function stageComplete() {
  state.screen = "STAGE_COMPLETE";

  const results = {
    coins: state.stageCoins,
    damage: state.stageDamage,
    time: formatTime(state.time - state.stageStartAt),
  };

  showStageComplete(state, results, () => openShop(), () => nextStage());
}

function openShop() {
  if (state.shopUsedThisStage) return;
  state.shopUsedThisStage = true;
  state.screen = "SHOP";
  renderShop();
}

function renderShop() {
  const items = [
    {
      id: "heal",
      name: "FULL REPAIR",
      desc: "Restore HP to full now.",
      cost: 8,
      disabled: state.coins < 8 || state.player.hp >= state.player.hpMax,
      soldOut: false,
    },
    {
      id: "maxhp",
      name: "+1 MAX HP",
      desc: "Increase max HP by 1 (max +5).",
      cost: 12,
      disabled: state.coins < 12 || state.runUpgrades.hpMaxBonus >= 5,
      soldOut: state.runUpgrades.hpMaxBonus >= 5,
    },
    {
      id: "dash",
      name: "UNLOCK DASH",
      desc: "Unlock dash permanently for this run.",
      cost: 15,
      disabled: state.coins < 15 || state.runUpgrades.dashUnlocked,
      soldOut: state.runUpgrades.dashUnlocked,
    },
    {
      id: "throwdmg",
      name: "+THROW POWER",
      desc: "Increase throw damage (max +2).",
      cost: 10,
      disabled: state.coins < 10 || state.runUpgrades.throwDmgBonus >= 2,
      soldOut: state.runUpgrades.throwDmgBonus >= 2,
    },
    {
      id: "speed",
      name: "SPEED MODULE",
      desc: "Next stage: faster move speed for 8 seconds.",
      cost: 9,
      disabled: state.coins < 9,
      soldOut: false,
    },
  ];

  showShop(
    state,
    { items },
    (id) => {
      if (id === "heal" && state.coins >= 8) {
        state.coins -= 8;
        state.player.hp = state.player.hpMax;
      }
      if (id === "maxhp" && state.coins >= 12 && state.runUpgrades.hpMaxBonus < 5) {
        state.coins -= 12;
        state.runUpgrades.hpMaxBonus += 1;
      }
      if (id === "dash" && state.coins >= 15 && !state.runUpgrades.dashUnlocked) {
        state.coins -= 15;
        state.runUpgrades.dashUnlocked = true;
      }
      if (id === "throwdmg" && state.coins >= 10 && state.runUpgrades.throwDmgBonus < 2) {
        state.coins -= 10;
        state.runUpgrades.throwDmgBonus += 1;
      }
      if (id === "speed" && state.coins >= 9) {
        state.coins -= 9;
        state.runUpgrades.speedBoostSeconds = Math.max(state.runUpgrades.speedBoostSeconds, 8);
      }

      renderShop();
    },
    () => nextStage()
  );
}

function nextStage() {
  startLevel(state.levelIndex + 1);
}

function togglePause() {
  if (state.screen === "PLAY") {
    state.screen = "PAUSED";
    showPauseMenu(state, {
      onResume: () => { state.ui.clear(); state.screen = "PLAY"; },
      onRestartLevel: () => {
        showConfirm(
          state,
          "RESTART LEVEL?",
          "This resets this stage’s pickups/enemies/damage.\nRun upgrades stay.",
          "YES",
          "NO",
          () => restartLevel(),
          () => togglePause()
        );
      },
      onRestartRun: () => {
        showConfirm(
          state,
          "RESTART RUN?",
          "Back to Level 1.\nTutorial will not repeat.",
          "YES",
          "NO",
          () => startRun(),
          () => togglePause()
        );
      }
    });
  } else if (state.screen === "PAUSED") {
    state.ui.clear();
    state.screen = "PLAY";
  }
}

/* ---------- GAME RULES ---------- */

function applyDamage(amount) {
  const p = state.player;
  if (p.iFrames > 0) return;
  p.hp -= amount;
  p.iFrames = 0.6;
  state.stageDamage += amount;

  if (p.hp <= 0) {
    state.screen = "DEAD";
    showDeath(state, { level: state.levelIndex, coins: state.coins }, () => startRun());
  }
}

function updateRules(dt) {
  const p = state.player;

  // enemy contact damage
  for (const e of state.enemies) {
    if (aabb(p, e)) applyDamage(1);
  }
  // enemy bullets
  for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
    const b = state.enemyProjectiles[i];
    if (aabb(p, b)) {
      state.enemyProjectiles.splice(i, 1);
      applyDamage(1);
    }
  }

  // fall death
  if (p.y > CONFIG.BASE_GROUND_Y + 600) {
    state.screen = "DEAD";
    showDeath(state, { level: state.levelIndex, coins: state.coins }, () => startRun());
  }

  // exit
  const bossAlive = state.enemies.some(e => e.type === "Boss");
  if (state.world.exit && aabb(p, state.world.exit)) {
    if (bossAlive) {
      state.ui.toast("Defeat the boss to unlock the exit!", 1000);
    } else {
      stageComplete();
    }
  }

  // tutorial once
  if (state.levelIndex === 1 && !state.tutorialDone) {
    // mark done after first coin collected
    if (state.stageCoins >= 1) {
      state.tutorialDone = true;
      localStorage.setItem("ccp_tutorial_done", "1");
      state.ui.toast("Tutorial complete!", 1200);
    } else {
      state.ui.toast("Tutorial: grab 1 coin to finish!", 900);
    }
  }

  p.iFrames = Math.max(0, p.iFrames - dt);
}

/* ---------- LOOP ---------- */

let last = performance.now();

function tick(now) {
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = clamp(rawDt, 0, 1 / 30);

  state.time += dt;

  // global keys
  if (state.input.isPressed("pause")) togglePause();

  if (state.screen === "LEVEL_LOADING") {
    state.load.t += dt;
    const p01 = clamp(state.load.t / state.load.dur, 0, 1);
    showNextStageLoading(state, p01, `LOADING STAGE ${state.levelIndex}`);
    if (p01 >= 1) {
      state.ui.clear();
      state.screen = "PLAY";
    }
  }

  if (state.screen === "PLAY") {
    updatePlayer(state, dt);
    updateEnemies(state, dt);
    updateRules(dt);

    // camera smoothing
    const camTarget = clamp(state.player.x - CONFIG.CANVAS_W * 0.35, 0, state.world.length - CONFIG.CANVAS_W);
    state.cameraX += (camTarget - state.cameraX) * clamp(8 * dt, 0, 1);

    state.ui.updateHUD();
  }

  // draw (if assets exist)
  if (state.assets && state.world && state.player) {
    render(state, ctx);
  } else {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  }

  state.input.flush();
  requestAnimationFrame(tick);
}

boot().then(() => requestAnimationFrame(tick));
