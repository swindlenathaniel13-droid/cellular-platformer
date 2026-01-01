// js/main.js
import { CONFIG } from "./config.js";
import { loadAssets } from "./assets.js";
import { createInput } from "./input.js";
import { rectsOverlap, clamp } from "./utils.js";
import { moveAndCollide } from "./physics.js";
import { createPlayer, updatePlayer, applyPhysics, canThrow, markThrew, damagePlayer } from "./player.js";
import { generateLevel } from "./world.js";
import { hitEnemy, enemyRect, updateEnemies } from "./enemies.js";
import { drawGame } from "./render.js";
import { bindUI, show, hide, setBootProgress, bootWarn, updateHUD, buildCharGrid, buildShop } from "./ui.js";

const ui = bindUI();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

canvas.width = CONFIG.canvas.w;
canvas.height = CONFIG.canvas.h;

const input = createInput(window);

const state = {
  assets: null,
  missing: [],
  world: null,
  player: null,
  bullets: [],
  enemyBullets: [],
  camX: 0,
  camY: 0,

  phase: "BOOT",
  dashUnlocked: false,

  lastT: 0,
};

function spikeHitbox(s) {
  return {
    x: s.x + CONFIG.spike.hitInsetX,
    y: s.y + CONFIG.spike.hitInsetTop,
    w: Math.max(1, s.w - CONFIG.spike.hitInsetX * 2),
    h: Math.max(1, s.h - CONFIG.spike.hitInsetTop - CONFIG.spike.hitInsetBottom),
  };
}

function resetRun(level = 1, keepCoins = true) {
  state.world = generateLevel(level);

  const prevCoins = keepCoins ? (state.player?.coins ?? 0) : 0;
  const prevChar = state.player?.charKey ?? "nate";
  const prevHPMax = state.player?.hpMax ?? 10;

  state.player = createPlayer(prevChar);
  state.player.hpMax = prevHPMax;
  state.player.hp = Math.min(prevHPMax, prevHPMax);
  state.player.coins = prevCoins;

  state.player.x = state.world.spawn.x;
  state.player.y = state.world.spawn.y;

  state.bullets = [];
  state.enemyBullets = [];
}

function nextLevel() {
  const lvl = state.world.level + 1;
  resetRun(lvl, true);
  state.phase = "PLAY";
  hide(ui.shop.overlay);
}

function openShop() {
  state.phase = "SHOP";
  show(ui.shop.overlay);

  const doBuy = (item) => {
    if (state.player.coins < item.cost) return;

    if (item.id === "hp") {
      state.player.coins -= item.cost;
      state.player.hpMax += 1;
      state.player.hp = Math.min(state.player.hpMax, state.player.hp + 1);
    }
    if (item.id === "dash") {
      state.player.coins -= item.cost;
      state.dashUnlocked = true;
    }

    buildShop(ui, state, doBuy);
  };

  buildShop(ui, state, doBuy);
  ui.shop.cont.onclick = () => nextLevel();
}

function spawnBullet() {
  if (!canThrow(state.player)) return;

  const dir = state.player.face || 1;

  // phone icon projectile size
  const bw = 22, bh = 22;

  // ✅ random speed + random angle + arc
  const spdMul = 1 + (Math.random() * 2 - 1) * CONFIG.throw.speedRand; // ±
  const baseSpeed = CONFIG.throw.speed * spdMul;

  const ang = (Math.random() * 2 - 1) * CONFIG.throw.angleRand; // radians
  const vx = Math.cos(ang) * baseSpeed * dir;
  const vy = Math.sin(ang) * baseSpeed - CONFIG.throw.arcUp;

  const b = {
    x: state.player.x + (dir > 0 ? state.player.w : -bw),
    y: state.player.y + state.player.h * 0.40,
    w: bw,
    h: bh,
    vx,
    vy,
    life: CONFIG.throw.life,
  };

  state.bullets.push(b);
  markThrew(state.player);
}

function updatePlayerBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];

    // ✅ arc gravity
    b.vy += CONFIG.throw.gravity * dt;

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    let dead = b.life <= 0;

    // platform collision
    if (!dead) {
      for (const p of state.world.platforms) {
        if (rectsOverlap(b, p)) { dead = true; break; }
      }
    }

    // hit enemies
    if (!dead) {
      for (let ei = state.world.enemies.length - 1; ei >= 0; ei--) {
        const e = state.world.enemies[ei];
        if (rectsOverlap(b, enemyRect(e))) {
          const killed = hitEnemy(state.world.enemies, ei, 1);
          dead = true;
          if (killed) {
            state.world.enemies.splice(ei, 1);
            // drop a coin
            state.world.coins.push({ x: e.x + 10, y: e.y - 18, w: 18, h: 18, taken: false });
          }
          break;
        }
      }
    }

    if (dead) state.bullets.splice(i, 1);
  }
}

function updateEnemyBullets(dt) {
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const b = state.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    let dead = b.life <= 0;

    // platforms block them
    if (!dead) {
      for (const p of state.world.platforms) {
        if (rectsOverlap(b, p)) { dead = true; break; }
      }
    }

    // hit player
    if (!dead && rectsOverlap(b, state.player)) {
      damagePlayer(state.player, 1);
      dead = true;
    }

    if (dead) state.enemyBullets.splice(i, 1);
  }
}

function updateCamera() {
  const targetX = state.player.x + state.player.w * 0.5 - CONFIG.canvas.w * 0.5;
  state.camX = clamp(targetX, 0, Math.max(0, state.world.W - CONFIG.canvas.w));
  state.camY = 0;
}

function killEnemyAtIndex(ei) {
  const e = state.world.enemies[ei];
  state.world.enemies.splice(ei, 1);
  // drop coin
  state.world.coins.push({ x: e.x + 10, y: e.y - 18, w: 18, h: 18, taken: false });
}

function gameplayStep(dt) {
  if (input.consumePress("KeyF")) spawnBullet();

  updatePlayer(state.player, input, dt);
  applyPhysics(state.player, dt);
  moveAndCollide(state.player, state.world.platforms, dt);

  // coins
  for (const c of state.world.coins) {
    if (c.taken) continue;
    if (rectsOverlap(state.player, c)) {
      c.taken = true;
      state.player.coins += 1;
    }
  }

  // spikes
  for (const s of state.world.spikes) {
    if (rectsOverlap(state.player, spikeHitbox(s))) {
      const hit = damagePlayer(state.player, 1);
      if (hit) {
        state.player.vx = -state.player.face * 140;
        state.player.vy = -420;
      }
    }
  }

  // enemy AI + bullets
  updateEnemies(state.world, state.player, dt, state.enemyBullets);

  // ✅ stomp-kill OR contact damage
  for (let ei = state.world.enemies.length - 1; ei >= 0; ei--) {
    const e = state.world.enemies[ei];
    const er = enemyRect(e);

    if (!rectsOverlap(state.player, er)) continue;

    // stomp condition: falling + player bottom is near enemy top
    const playerBottom = state.player.y + state.player.h;
    const enemyTop = e.y;

    const falling = state.player.vy > 120;
    const fromAbove = playerBottom <= enemyTop + 14;

    if (falling && fromAbove) {
      // ✅ stomp kills
      killEnemyAtIndex(ei);
      state.player.vy = -CONFIG.player.stompBounceVel; // bounce
      continue;
    }

    // otherwise damage player
    const hit = damagePlayer(state.player, 1);
    if (hit) {
      state.player.vx = -state.player.face * 160;
      state.player.vy = -420;
    }
  }

  // checkpoint unlocks exit only
  if (!state.world.checkpoint.reached && rectsOverlap(state.player, state.world.checkpoint)) {
    state.world.checkpoint.reached = true;
    state.world.exitUnlocked = true;
  }

  // exit opens shop (only if unlocked)
  if (state.world.exitUnlocked && rectsOverlap(state.player, state.world.exit)) {
    openShop();
  }

  // fell off world
  if (state.player.y > CONFIG.canvas.h + 300) {
    resetRun(state.world.level, true);
  }

  updatePlayerBullets(dt);
  updateEnemyBullets(dt);
  updateCamera();
}

function loop(t) {
  if (!state.lastT) state.lastT = t;
  const dt = Math.min(0.033, (t - state.lastT) / 1000);
  state.lastT = t;

  if (state.phase === "PLAY") gameplayStep(dt);

  if (state.assets && state.world && state.player) {
    drawGame(ctx, state);
    updateHUD(ui, state);
  }

  input.clearFrame();
  requestAnimationFrame(loop);
}

async function boot() {
  show(ui.boot.overlay);
  hide(ui.chars.overlay);
  hide(ui.shop.overlay);

  ui.boot.start.disabled = true;
  ui.boot.warn.style.display = "none";
  ui.boot.sub.textContent = "Loading assets…";

  const { assets, missing } = await loadAssets(({ loaded, total, file }) => {
    setBootProgress(ui, loaded, total, file);
  });

  state.assets = assets;
  state.missing = missing;

  if (missing.length) {
    bootWarn(ui,
      "Some assets failed to load:\n" +
      missing.map(m => `- ${m}`).join("\n") +
      "\n\nFix checklist:\n" +
      "• Folder name is exactly: assets\n" +
      "• Filenames match EXACT case\n" +
      "• Files are at /assets (not /assets/assets)\n"
    );
  }

  ui.boot.sub.textContent = "Assets loaded. Press START.";
  ui.boot.start.disabled = false;

  ui.boot.start.onclick = () => {
    hide(ui.boot.overlay);
    state.phase = "CHAR";
    show(ui.chars.overlay);

    buildCharGrid(ui, state.assets, (picked) => {
      hide(ui.chars.overlay);
      state.phase = "PLAY";
      state.player = createPlayer(picked);
      resetRun(1, false);
    });
  };

  requestAnimationFrame(loop);
}

boot();
