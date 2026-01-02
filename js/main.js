// js/main.js
import { CONFIG } from "./config.js";
import { loadAssets } from "./assets.js";
import { createInput } from "./input.js";
import { resolvePlatforms } from "./physics.js";
import { aabb, clamp } from "./utils.js";
import { generateLevel } from "./world.js";
import { createPlayer, updatePlayer, tryThrow, damagePlayer, healPlayer } from "./player.js";
import { updateEnemies, killEnemy } from "./enemies.js";
import { drawGame } from "./render.js";
import { uiRefs, setOverlay, setBootProgress, showWarn, buildCharSelect, updateHUD, buildShop } from "./ui.js";

const ui = uiRefs();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const input = createInput();

const state = {
  assets: null,
  level: 1,
  phase2: false,

  coins: 0, // total (persists)
  bullets: [],

  camX: 0,
  camY: 0,

  platforms: [],
  coinsLevel: [], // legacy not used
  coins: 0,
  spikes: [],
  enemies: [],
  checkpoint: null,
  door: null,
  spawn: null,

  player: null,

  screen: "boot", // boot|char|play|shop
};

function setProgress(done, total, file){
  if (ui.bootSub) ui.bootSub.textContent = "Loading assets…";
  if (ui.bootFile) ui.bootFile.textContent = file || "—";
  setBootProgress(ui, done, total);
}

function bootError(text){
  showWarn(ui, text);
  if (ui.bootSub) ui.bootSub.textContent = "Fix assets and refresh.";
}

function startLevel(level){
  state.level = level;

  const L = generateLevel(level);
  state.phase2 = L.phase2;

  state.platforms = L.platforms;
  state.coins = state.coins ?? 0;
  state.coinsLevel = L.coins;
  state.spikes = L.spikes;
  state.enemies = L.enemies;
  state.checkpoint = L.checkpoint;
  state.door = L.door;
  state.spawn = L.spawn;

  // reset transient bullets each level
  state.bullets = [];

  // spawn player
  state.player.x = state.spawn.x;
  state.player.y = state.spawn.y;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = false;

  // door starts closed until checkpoint
  state.door.open = false;
  state.checkpoint.active = false;
}

function openShop(){
  state.screen = "shop";
  setOverlay(ui.shopOverlay, true);

  buildShop(ui, state, (item) => {
    if (state.coins < item.cost) return;
    state.coins -= item.cost;

    if (item.id === "dash"){
      state.player.dashUnlocked = true;
    }
    if (item.id === "hp"){
      state.player.hpMax += 1;
      state.player.hp = Math.min(state.player.hpMax, state.player.hp + 1);
    }
    if (item.id === "heal"){
      healPlayer(state.player, 3);
    }

    buildShop(ui, state, arguments.callee);
    updateHUD(ui, state);
  });

  ui.shopContinueBtn.onclick = () => closeShopAdvance();
}

function closeShopAdvance(){
  setOverlay(ui.shopOverlay, false);
  state.screen = "play";

  // Advance to next level
  startLevel(state.level + 1);
}

function spikeHitbox(s){
  const ix = CONFIG.spike.hitboxInsetX;
  const iy = CONFIG.spike.hitboxInsetY;
  return {
    x: s.x + ix,
    y: s.y + iy,
    w: Math.max(2, CONFIG.spike.drawW - ix*2),
    h: Math.max(2, CONFIG.spike.drawH - iy*2)
  };
}

function updateCamera(){
  const p = state.player;
  const targetX = (p.x + p.w/2) - CONFIG.canvas.w/2 + (p.vx >= 0 ? CONFIG.camera.lookAhead : -CONFIG.camera.lookAhead);
  const targetY = (p.y + p.h/2) - CONFIG.canvas.h/2;

  state.camX += (targetX - state.camX) * CONFIG.camera.lerp;
  state.camY += (targetY - state.camY) * CONFIG.camera.lerp;

  // clamp camera to sensible bounds
  state.camX = clamp(state.camX, -50, 5000);
  state.camY = clamp(state.camY, -80, 600);
}

function updateBullets(dtMs){
  const dt = dtMs / 1000;
  state.bullets = state.bullets.filter(b => (b.life -= dtMs) > 0);

  for (const b of state.bullets){
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // gravity only on player throw (feel better)
    if (b.from === "player") b.vy += CONFIG.throw.gravity * dt;

    // collide with enemies if player bullet
    if (b.from === "player"){
      for (const e of state.enemies){
        if (!e.alive) continue;
        const hit = {
          x: b.x - b.r, y: b.y - b.r, w: b.r*2, h: b.r*2
        };
        if (aabb(hit, e)){
          killEnemy(e);
          b.life = 0;
          break;
        }
      }
    }

    // collide with player if enemy bullet
    if (b.from === "enemy"){
      const hit = { x: b.x - b.r, y: b.y - b.r, w: b.r*2, h: b.r*2 };
      if (aabb(hit, state.player)){
        damagePlayer(state.player, CONFIG.enemy.bulletDamage);
        b.life = 0;
      }
    }
  }

  state.bullets = state.bullets.filter(b => b.life > 0);
}

function handlePickups(){
  const p = state.player;

  // coins
  for (const c of state.coinsLevel){
    if (c.collected) continue;
    const hit = { x: c.x - c.r, y: c.y - c.r, w: c.r*2, h: c.r*2 };
    if (aabb(hit, p)){
      c.collected = true;
      state.coins += 1; // persists across levels
    }
  }

  // checkpoint -> unlock door, set respawn
  if (!state.checkpoint.active && aabb(p, state.checkpoint)){
    state.checkpoint.active = true;
    state.spawn = { x: state.checkpoint.x, y: state.checkpoint.y };
    state.door.open = true;
  }

  // door -> opens shop (ONLY if open)
  if (state.door.open && aabb(p, state.door)){
    openShop();
  }
}

function handleHazards(){
  const p = state.player;

  // spikes
  for (const s of state.spikes){
    const hb = spikeHitbox(s);
    if (aabb(p, hb)){
      const hit = damagePlayer(p, CONFIG.spike.damage);
      if (hit){
        // small knockback
        p.vx *= -0.35;
        p.vy = Math.min(p.vy, 120);
      }
    }
  }

  // enemies contact / stomp
  for (const e of state.enemies){
    if (!e.alive) continue;
    if (!aabb(p, e)) continue;

    const playerBottom = p.y + p.h;
    const enemyTop = e.y;
    const falling = p.vy > 120;

    // stomp if coming from above
    if (CONFIG.player.stompKill && falling && playerBottom - enemyTop < 18){
      killEnemy(e);
      p.vy = CONFIG.player.stompBounce;
    } else {
      damagePlayer(p, 1);
      // knockback
      p.vx += (p.x < e.x ? -160 : 160);
    }
  }
}

function respawnIfDead(){
  if (state.player.hp > 0) return;

  // On death: respawn at spawn, keep TOTAL coins (you asked to keep coins across clears)
  state.player.hp = state.player.hpMax;
  state.player.x = state.spawn.x;
  state.player.y = state.spawn.y;
  state.player.vx = 0;
  state.player.vy = 0;
}

let last = performance.now();
function loop(t){
  const dtMs = Math.min(34, t - last);
  last = t;

  if (state.screen === "play"){
    // Update player motion
    updatePlayer(state.player, input, dtMs);
    resolvePlatforms(state.player, state.platforms);

    // Throw weapon (random)
    const facing = (input.right() ? 1 : 0) - (input.left() ? 1 : 0) || (state.player.vx >= 0 ? 1 : -1);
    if (input.throw()){
      const b = tryThrow(state.player, facing);
      if (b) state.bullets.push(b);
    }

    // Enemies
    const enemyShots = updateEnemies(state.enemies, state.player, dtMs);
    for (const s of enemyShots) state.bullets.push(s);

    // Bullets
    updateBullets(dtMs);

    // Pickups & hazards
    handlePickups();
    handleHazards();
    respawnIfDead();

    // Camera
    updateCamera();

    // HUD
    updateHUD(ui, state);
  }

  // Render
  if (state.assets){
    drawGame(ctx, state, t);
  }

  requestAnimationFrame(loop);
}

async function boot(){
  const { assets, missing } = await loadAssets({
    onProgress: (done, total) => setBootProgress(ui, done, total),
    onFile: (file) => { if (ui.bootFile) ui.bootFile.textContent = `Loading: ${file}`; }
  });

  state.assets = assets;

  if (ui.hudThrowIcon && assets.phone){
    ui.hudThrowIcon.src = assets.phone.src;
  }

  if (missing.length){
    bootError(
      "Some assets failed to load:\n" +
      missing.map(m => `- ${m}`).join("\n") +
      "\n\nChecklist:\n• Folder name: assets\n• Filenames EXACT case (Coin.png ≠ coin.png)\n• Files at /assets (not /assets/assets)\n"
    );
  }

  if (ui.bootSub) ui.bootSub.textContent = "Assets loaded. Press START.";
  if (ui.bootStartBtn) ui.bootStartBtn.disabled = false;

  ui.bootStartBtn.onclick = () => {
    setOverlay(ui.bootOverlay, false);
    setOverlay(ui.charOverlay, true);
    state.screen = "char";

    buildCharSelect(ui, state.assets, (picked) => {
      state.player = createPlayer(picked);
      state.player.dashUnlocked = CONFIG.player.dashUnlocked;

      setOverlay(ui.charOverlay, false);
      state.screen = "play";

      // IMPORTANT: do NOT reset coins between levels
      state.coins = 0;

      startLevel(1);

      updateHUD(ui, state);
    });
  };

  // Shop continue via Enter
  window.addEventListener("keydown", (e) => {
    if (state.screen === "shop" && e.code === "Enter"){
      closeShopAdvance();
    }
  });
}

boot();
requestAnimationFrame(loop);
