/* main.js
   ✅ Pause Menu (Esc) + Shop
   ✅ Shop uses coins and upgrades persist across levels (for this run)

   NOTE: This file keeps your procedural generation + platform surface collision system.
*/

const ASSETS = {
  bg: "assets/Background_Pic.png",
  platform: "assets/Platform.png",
  exit: "assets/Exit_Door.png",
  checkpoint: "assets/CheckpointFlag.png",
  coin: "assets/Coin.png",
  enemy1: "assets/Enemy1.png",
  enemy2: "assets/Enemy2.png",
  dash: "assets/Powerup_Dash.png",
  speed: "assets/Powerup_Speedboost.png",
  phone: "assets/powerup_homephone.png",
  chars: [
    { id: "Gilly", src: "assets/Gilly.png" },
    { id: "Scott", src: "assets/Scott.png" },
    { id: "Kevin", src: "assets/Kevin.png" },
    { id: "Nate",  src: "assets/Nate.png"  },
  ],
};

// -------------------- TUNING --------------------
const PLATFORM_SURFACE_Y = 14;  // adjust if sprites look floaty vs sunk
const SPRITE_SCALE = 2.0;
const HITBOX_SCALE = 0.72;
const FOOT_SINK = 2;

const USE_PROCEDURAL_LEVELS = true;
const BOSS_EVERY = 3;
const START_LEVEL_INDEX = 0;

const DEBUG_HITBOX = false;
// ----------------------------------------------

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// UI
const menuEl = document.getElementById("menu");
const charGridEl = document.getElementById("charGrid");
const startBtn = document.getElementById("startBtn");

const hudEl = document.getElementById("hud");
const hudLevel = document.getElementById("hudLevel");
const hudCoins = document.getElementById("hudCoins");
const hudDash = document.getElementById("hudDash");
const hudSpeed = document.getElementById("hudSpeed");
const hudThrow = document.getElementById("hudThrow");

// Pause + Shop UI
const pauseOverlay = document.getElementById("pauseOverlay");
const resumeBtn = document.getElementById("resumeBtn");
const shopBtn = document.getElementById("shopBtn");
const restartBtn = document.getElementById("restartBtn");
const quitBtn = document.getElementById("quitBtn");

const shopOverlay = document.getElementById("shopOverlay");
const shopCoinsEl = document.getElementById("shopCoins");
const closeShopBtn = document.getElementById("closeShopBtn");
const shopListEl = document.getElementById("shopList");

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function aabb(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// -------------------- RNG + Procedural --------------------
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function rInt(rng, min, max){ return Math.floor(rng() * (max - min + 1)) + min; }
function pick(rng, arr){ return arr[rInt(rng, 0, arr.length - 1)]; }

function getRunSeed(){
  const s = new URLSearchParams(location.search).get("seed");
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  return Math.floor(Math.random() * 1e9);
}
const RUN_SEED = getRunSeed();

function generateProceduralLevel(levelIndex){
  const rng = mulberry32((RUN_SEED + levelIndex * 10007) >>> 0);
  const W = canvas.width;

  const groundY = 460;
  const platforms = [{ x: 0, y: groundY, w: W, h: 80 }];

  const difficulty = 1 + Math.floor(levelIndex / BOSS_EVERY);
  const steps = clamp(6 + Math.floor(difficulty * 0.8), 6, 10);

  let x = 120;
  let y = 400;

  for (let i=0;i<steps;i++){
    const w = rInt(rng, 170, 280);
    const h = 28;

    x += rInt(rng, 95, 145);
    y = clamp(y + rInt(rng, -60, 40), 220, 410);

    if (x + w > W - 40) x = (W - 40) - w;
    x = clamp(x, 40, W - w - 40);

    platforms.push({ x, y, w, h });
  }

  const spawn = { x: 70, y: 380 };

  const last = platforms[platforms.length - 1];
  const exit = {
    x: Math.floor(last.x + last.w - 54),
    y: Math.floor(last.y + PLATFORM_SURFACE_Y - 56)
  };

  const mid = platforms[Math.floor(platforms.length / 2)];
  const checkpoint = {
    x: Math.floor(mid.x + mid.w * 0.5),
    y: Math.floor(mid.y + PLATFORM_SURFACE_Y - 50)
  };

  const coins = [];
  platforms.slice(1).forEach((p, idx) => {
    const n = rInt(rng, 1, 3);
    const surface = p.y + PLATFORM_SURFACE_Y;
    for (let j=0;j<n;j++){
      coins.push({
        x: Math.floor(p.x + (p.w/(n+1))*(j+1) - 10),
        y: Math.floor(surface - 34 - (idx % 2)*6)
      });
    }
  });

  const pickups = [];
  if (platforms.length > 2){
    const p = platforms[2];
    const surface = p.y + PLATFORM_SURFACE_Y;
    pickups.push({ kind:"dash", x: Math.floor(p.x + p.w*0.5), y: Math.floor(surface - 35) });
  }
  if (platforms.length > 4){
    const p = platforms[platforms.length - 3];
    const surface = p.y + PLATFORM_SURFACE_Y;
    pickups.push({ kind:"speed", x: Math.floor(p.x + p.w*0.5), y: Math.floor(surface - 35) });
  }

  const enemies = [];
  const enemyCount = clamp(1 + Math.floor(difficulty * 1.2), 1, 6);
  const pads = platforms.slice(2, -1);

  for (let i=0;i<enemyCount;i++){
    const p = pick(rng, pads);
    const surface = p.y + PLATFORM_SURFACE_Y;

    const type = rng() < 0.55 ? "enemy1" : "enemy2";
    const hpBase = type === "enemy1" ? 2 : 3;
    const hp = hpBase + Math.floor(difficulty / 2);

    enemies.push({
      type,
      x: Math.floor(p.x + rInt(rng, 10, Math.max(10, p.w - 60))),
      y: Math.floor(surface - 60),
      left: Math.floor(p.x + 6),
      right: Math.floor(p.x + p.w - 6),
      hp
    });
  }

  return {
    name: `Procedural ${difficulty}`,
    spawn,
    exit,
    exitLocked: false,
    checkpoint,
    platforms,
    enemies,
    coins,
    pickups,
    boss: null
  };
}

// -------------------- Boss Template --------------------
const BOSS_LEVEL_TEMPLATE = {
  name: "Boss: Signal Tyrant",
  spawn: { x: 70, y: 380 },
  exit:  { x: 890, y: 395 },
  exitLocked: true,
  checkpoint: { x: 160, y: 395 },
  platforms: [
    { x: 0, y: 460, w: 960, h: 80 },
    { x: 150, y: 360, w: 140, h: 28 },
    { x: 360, y: 320, w: 150, h: 28 },
    { x: 590, y: 320, w: 150, h: 28 },
    { x: 790, y: 360, w: 140, h: 28 },
  ],
  enemies: [],
  coins: [
    { x: 180, y: 330 }, { x: 400, y: 290 }, { x: 640, y: 290 }, { x: 820, y: 330 }
  ],
  pickups: [
    { kind:"dash",  x: 360, y: 285 },
    { kind:"speed", x: 590, y: 285 },
  ],
  boss: {
    type: "enemy2",
    hp: 22,
    x: 720,
    y: 330,
    left: 520,
    right: 900
  }
};

function getLevel(idx){
  const isBoss = (idx % BOSS_EVERY) === (BOSS_EVERY - 1);
  if (!USE_PROCEDURAL_LEVELS){
    return isBoss ? BOSS_LEVEL_TEMPLATE : generateProceduralLevel(idx);
  }
  return isBoss ? BOSS_LEVEL_TEMPLATE : generateProceduralLevel(idx);
}

// -------------------- Assets --------------------
function loadImage(src){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
let images = {};
async function loadAll(){
  const entries = [
    ["bg", ASSETS.bg],
    ["platform", ASSETS.platform],
    ["exit", ASSETS.exit],
    ["checkpoint", ASSETS.checkpoint],
    ["coin", ASSETS.coin],
    ["enemy1", ASSETS.enemy1],
    ["enemy2", ASSETS.enemy2],
    ["dash", ASSETS.dash],
    ["speed", ASSETS.speed],
    ["phone", ASSETS.phone],
  ];
  for (const c of ASSETS.chars) entries.push([`char_${c.id}`, c.src]);

  const loaded = await Promise.all(entries.map(([k, src]) => loadImage(src).then(img => [k, img])));
  images = Object.fromEntries(loaded);
}

// -------------------- Input --------------------
const KEYS = { left:false, right:false, jump:false, dash:false, throw:false };

function clearKeys(){
  KEYS.left = KEYS.right = KEYS.jump = KEYS.dash = KEYS.throw = false;
}

window.addEventListener("keydown", (e) => {
  // Pause toggle: Esc (even if keys are being held)
  if (e.code === "Escape") {
    if (state.running) togglePause();
    return;
  }

  if (["ArrowLeft","KeyA"].includes(e.code)) KEYS.left = true;
  if (["ArrowRight","KeyD"].includes(e.code)) KEYS.right = true;
  if (e.code === "Space") KEYS.jump = true;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") KEYS.dash = true;
  if (e.code === "KeyF") KEYS.throw = true;
});

window.addEventListener("keyup", (e) => {
  if (["ArrowLeft","KeyA"].includes(e.code)) KEYS.left = false;
  if (["ArrowRight","KeyD"].includes(e.code)) KEYS.right = false;
  if (e.code === "Space") KEYS.jump = false;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") KEYS.dash = false;
  if (e.code === "KeyF") KEYS.throw = false;
});

// -------------------- Sizes --------------------
const BASE = {
  player: { w: 34, h: 48 },
  enemy:  { w: 40, h: 40 },
  boss:   { w: 92, h: 92 },
  phone:  { w: 18, h: 18 },
};

function makeSizes(base){
  const dw = Math.round(base.w * SPRITE_SCALE);
  const dh = Math.round(base.h * SPRITE_SCALE);
  const w  = Math.round(dw * HITBOX_SCALE);
  const h  = Math.round(dh * HITBOX_SCALE);
  return { w, h, dw, dh };
}
const PLAYER_SZ = makeSizes(BASE.player);
const ENEMY_SZ  = makeSizes(BASE.enemy);
const BOSS_SZ   = makeSizes(BASE.boss);

const PHONE_DW = Math.round(BASE.phone.w * SPRITE_SCALE);
const PHONE_DH = Math.round(BASE.phone.h * SPRITE_SCALE);
const PHONE_W  = Math.round(PHONE_DW * 0.85);
const PHONE_H  = Math.round(PHONE_DH * 0.85);

// Align sprite feet to hitbox bottom
function renderRect(ent){
  const dx = ent.x - Math.floor((ent.dw - ent.w)/2);
  const dy = ent.y - (ent.dh - ent.h) + FOOT_SINK;
  return { x: dx, y: dy, w: ent.dw, h: ent.dh };
}

// -------------------- State --------------------
let selectedCharId = null;

const state = {
  running: false,
  paused: false,
  shopOpen: false,

  levelIndex: 0,
  coins: 0,
  respawn: { x: 60, y: 380 },
  toast: { text: "", t: 0 },

  // Shop upgrades (persist across levels for this run)
  upgrades: {
    maxHpBonus: 0,        // +1 per purchase, max 4
    dashModule: false,    // unlock dash permanently
    speedLevel: 0,        // +10% per level, max 3
    damageBonus: 0,       // +1 damage per level, max 3
    throwReduce: 0        // -2 frames per level, max 4
  }
};

const player = {
  x: 60, y: 380,
  w: PLAYER_SZ.w, h: PLAYER_SZ.h, dw: PLAYER_SZ.dw, dh: PLAYER_SZ.dh,
  vx: 0, vy: 0,
  facing: 1,
  onGround: false,

  baseMaxHp: 6,
  maxHp: 6,
  hp: 6,
  invuln: 0,

  canDash: false,
  dashCooldown: 0,
  speedBoostTimer: 0,

  throwCooldown: 0,
  throwCooldownMax: 18,
  projectileDamage: 1,

  deadTimer: 0,
};

// Level objects
let platforms = []; // drawing
let solids = [];    // collision (surface offset)
let enemies = [];
let coins = [];
let pickups = [];
let projectiles = [];
let exitDoor = null;
let checkpoint = null;

// Boss
let boss = null;
let bossProjectiles = [];
let bossWaves = [];

// -------------------- Pause + Shop logic --------------------
function setOverlay(el, show){
  el.classList.toggle("hidden", !show);
  el.setAttribute("aria-hidden", show ? "false" : "true");
}

function pauseGame(){
  if (state.paused) return;
  state.paused = true;
  clearKeys();
  setOverlay(pauseOverlay, true);
  setOverlay(shopOverlay, false);
  state.shopOpen = false;
}

function resumeGame(){
  if (!state.paused) return;
  state.paused = false;
  clearKeys();
  setOverlay(pauseOverlay, false);
  setOverlay(shopOverlay, false);
  state.shopOpen = false;
}

function togglePause(){
  if (!state.running) return;
  if (state.paused) resumeGame();
  else pauseGame();
}

function openShop(){
  if (!state.paused) pauseGame();
  state.shopOpen = true;
  setOverlay(pauseOverlay, false);
  setOverlay(shopOverlay, true);
  renderShop();
}

function closeShop(){
  state.shopOpen = false;
  setOverlay(shopOverlay, false);
  setOverlay(pauseOverlay, true);
  renderShop(); // harmless
}

resumeBtn.addEventListener("click", resumeGame);
shopBtn.addEventListener("click", openShop);
closeShopBtn.addEventListener("click", closeShop);

restartBtn.addEventListener("click", () => {
  // restart current level, keep upgrades/coins
  resetToLevel(state.levelIndex);
  resumeGame();
});

quitBtn.addEventListener("click", () => {
  // quit to character select, reset run
  resumeGame();
  state.running = false;
  state.paused = false;
  state.shopOpen = false;
  setOverlay(pauseOverlay, false);
  setOverlay(shopOverlay, false);
  hudEl.classList.add("hidden");
  menuEl.classList.remove("hidden");

  // reset run data
  state.coins = 0;
  state.levelIndex = 0;
  state.upgrades = {
    maxHpBonus: 0,
    dashModule: false,
    speedLevel: 0,
    damageBonus: 0,
    throwReduce: 0
  };
  applyUpgrades(true);
});

// -------------------- Shop items --------------------
function shopCatalog(){
  const u = state.upgrades;

  const maxHpCost = 12 + (u.maxHpBonus * 10);
  const speedCost = 14 + (u.speedLevel * 10);
  const dmgCost   = 18 + (u.damageBonus * 12);
  const cdCost    = 16 + (u.throwReduce * 10);

  return [
    {
      id: "heal",
      name: "REFRESH PACK",
      desc: "Heal to full HP immediately.",
      cost: 8,
      canBuy: () => player.hp < player.maxHp,
      ownedText: () => `HP: ${player.hp}/${player.maxHp}`,
      buy: () => { player.hp = player.maxHp; }
    },
    {
      id: "dash",
      name: "DASH MODULE",
      desc: "Unlock Dash permanently (Shift).",
      cost: 25,
      canBuy: () => !u.dashModule,
      ownedText: () => u.dashModule ? "Owned" : "Not owned",
      buy: () => { u.dashModule = true; }
    },
    {
      id: "maxhp",
      name: "HEART CHIP",
      desc: "Max HP +1 (up to +4).",
      cost: maxHpCost,
      canBuy: () => u.maxHpBonus < 4,
      ownedText: () => `Level: ${u.maxHpBonus}/4`,
      buy: () => { u.maxHpBonus += 1; }
    },
    {
      id: "speed",
      name: "SPEED TUNER",
      desc: "Permanent speed +10% (up to +30%).",
      cost: speedCost,
      canBuy: () => u.speedLevel < 3,
      ownedText: () => `Level: ${u.speedLevel}/3`,
      buy: () => { u.speedLevel += 1; }
    },
    {
      id: "damage",
      name: "PHONE BOOSTER",
      desc: "Thrown phone damage +1 (up to +3).",
      cost: dmgCost,
      canBuy: () => u.damageBonus < 3,
      ownedText: () => `Level: ${u.damageBonus}/3`,
      buy: () => { u.damageBonus += 1; }
    },
    {
      id: "cooldown",
      name: "QUICK-TOSS SPRINGS",
      desc: "Throw cooldown -2 (up to -8).",
      cost: cdCost,
      canBuy: () => u.throwReduce < 4,
      ownedText: () => `Level: ${u.throwReduce}/4`,
      buy: () => { u.throwReduce += 1; }
    }
  ];
}

function renderShop(){
  shopCoinsEl.textContent = String(state.coins);
  shopListEl.innerHTML = "";

  const items = shopCatalog();
  items.forEach(item => {
    const canBuy = item.canBuy();
    const afford = state.coins >= item.cost;
    const disabled = !(canBuy && afford);

    const row = document.createElement("div");
    row.className = "shop-item";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="shop-name">${item.name}</div>
      <div class="shop-desc">${item.desc}</div>
      <div class="shop-meta">${item.ownedText()}</div>
    `;

    const right = document.createElement("div");
    right.className = "shop-right";

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = `Cost: ${item.cost}`;

    const btn = document.createElement("button");
    btn.className = "btn btn-solid";
    btn.textContent = disabled ? (canBuy ? "Need Coins" : "Maxed/Owned") : "Buy";
    btn.disabled = disabled;

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      state.coins -= item.cost;
      item.buy();
      applyUpgrades(false);
      renderShop();
      updateHUD();
    });

    right.appendChild(price);
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);
    shopListEl.appendChild(row);
  });
}

// Apply upgrades to player stats (call after purchases + on level reset)
function applyUpgrades(resetHpToFull){
  const u = state.upgrades;

  player.maxHp = player.baseMaxHp + u.maxHpBonus;
  if (resetHpToFull) player.hp = player.maxHp;
  else player.hp = Math.min(player.hp, player.maxHp);

  player.canDash = player.canDash || u.dashModule; // keep pickups too

  const minCooldown = 6;
  player.throwCooldownMax = Math.max(minCooldown, 18 - (u.throwReduce * 2));

  player.projectileDamage = 1 + u.damageBonus;
}

// -------------------- Platform collision surface --------------------
function rebuildSolids(){
  solids = platforms.map(p => {
    const y = p.y + PLATFORM_SURFACE_Y;
    const h = Math.max(4, p.h - PLATFORM_SURFACE_Y);
    return { x: p.x, y, w: p.w, h };
  });
}

function snapToSurface(ent){
  const cx = ent.x + ent.w/2;
  let best = null;
  let bestDy = Infinity;

  for (const s of solids){
    if (cx < s.x || cx > s.x + s.w) continue;
    const targetY = s.y - ent.h;
    const dy = Math.abs(ent.y - targetY);
    if (dy < bestDy){
      bestDy = dy;
      best = s;
    }
  }

  if (best){
    ent.y = best.y - ent.h;
    ent.vy = 0;
    ent.onGround = true;
  }
}

// -------------------- Combat / death --------------------
function setToast(text, frames = 120){
  state.toast.text = text;
  state.toast.t = frames;
}
function updateToast(){
  if (state.toast.t > 0) state.toast.t--;
}

function damagePlayer(amount, knockDir = 0){
  if (player.deadTimer > 0) return;
  if (player.invuln > 0) return;

  player.hp -= amount;
  player.invuln = 45;

  if (knockDir !== 0){
    player.vx = 6.5 * knockDir;
    player.vy = Math.min(player.vy, -5.5);
  }

  if (player.hp <= 0){
    player.hp = 0;
    killPlayer();
  }
}
function killPlayer(){
  if (player.deadTimer > 0) return;
  player.deadTimer = 45;
}
function respawnPlayer(){
  player.x = state.respawn.x;
  player.y = state.respawn.y;
  player.vx = 0;
  player.vy = 0;
  player.invuln = 30;
  player.hp = player.maxHp;

  projectiles = [];
  bossProjectiles = [];
  bossWaves = [];

  snapToSurface(player);
}

function unlockExit(){
  if (!exitDoor) return;
  if (!exitDoor.locked) return;
  exitDoor.locked = false;
  setToast("EXIT UNLOCKED!", 120);
}

// -------------------- Physics --------------------
const GRAVITY = 0.55;
const JUMP_V = -11.5;
const BASE_SPEED = 3.2;
const MAX_FALL = 14;

function moveAndCollide(ent, solidList){
  ent.x += ent.vx;
  for (const s of solidList){
    if (!aabb(ent, s)) continue;
    if (ent.vx > 0){
      ent.x = s.x - ent.w;
      ent.vx = 0;
    } else if (ent.vx < 0){
      ent.x = s.x + s.w;
      ent.vx = 0;
    }
  }

  ent.y += ent.vy;
  ent.onGround = false;
  for (const s of solidList){
    if (!aabb(ent, s)) continue;
    if (ent.vy > 0){
      ent.y = s.y - ent.h;
      ent.vy = 0;
      ent.onGround = true;
    } else if (ent.vy < 0){
      ent.y = s.y + s.h;
      ent.vy = 0;
    }
  }
}

// -------------------- Level Reset --------------------
function resetToLevel(idx){
  state.levelIndex = idx;
  const L = getLevel(idx);

  hudLevel.textContent = String(idx + 1);
  state.respawn = { x: L.spawn.x, y: L.spawn.y };

  platforms = (L.platforms || []).map(p => ({...p}));
  rebuildSolids();

  player.x = L.spawn.x;
  player.y = L.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.deadTimer = 0;
  player.invuln = 0;

  // Keep run upgrades and apply them at level start
  applyUpgrades(true);

  coins = (L.coins || []).map(c => ({...c, w: 20, h: 20, taken: false}));
  pickups = (L.pickups || []).map(p => ({...p, w: 26, h: 26, taken: false}));
  projectiles = [];

  exitDoor = { x: L.exit.x, y: L.exit.y, w: 44, h: 56, locked: !!L.exitLocked };
  checkpoint = { x: L.checkpoint.x, y: L.checkpoint.y, w: 28, h: 50, active:false };

  enemies = (L.enemies || []).map(e => ({
    ...e,
    w: ENEMY_SZ.w, h: ENEMY_SZ.h, dw: ENEMY_SZ.dw, dh: ENEMY_SZ.dh,
    vx: 0.7 * (Math.random() > 0.5 ? 1 : -1),
    vy: 0,
    maxHp: e.hp,
    left: e.left,
    right: Math.max(e.left + 10, e.right - ENEMY_SZ.w)
  }));

  bossProjectiles = [];
  bossWaves = [];
  boss = null;

  if (L.boss){
    boss = {
      type: L.boss.type,
      x: L.boss.x,
      y: L.boss.y,
      w: BOSS_SZ.w, h: BOSS_SZ.h, dw: BOSS_SZ.dw, dh: BOSS_SZ.dh,
      vx: 0,
      vy: 0,
      onGround: false,
      wasOnGround: false,
      left: L.boss.left,
      right: L.boss.right,
      hp: L.boss.hp,
      maxHp: L.boss.hp,
      mode: "intro",
      t: 90,
      invuln: 0,
      face: -1,
      bounces: 0
    };
    setToast("BOSS APPROACHING", 90);
  }

  snapToSurface(player);
  for (const e of enemies) snapToSurface(e);
  if (boss) snapToSurface(boss);

  updateHUD();
}

function nextLevel(){
  resetToLevel(state.levelIndex + 1);
}

// -------------------- Player Update --------------------
function updatePlayer(){
  if (player.deadTimer > 0){
    player.deadTimer--;
    if (player.deadTimer === 0) respawnPlayer();
    return;
  }
  if (player.invuln > 0) player.invuln--;

  const permSpeedMult = 1.0 + (state.upgrades.speedLevel * 0.10);
  const speedMult = (player.speedBoostTimer > 0 ? 1.55 : 1.0) * permSpeedMult;
  const speed = BASE_SPEED * speedMult;

  if (player.dashCooldown > 0) player.dashCooldown--;
  if (player.speedBoostTimer > 0) player.speedBoostTimer--;
  if (player.throwCooldown > 0) player.throwCooldown--;

  let ax = 0;
  if (KEYS.left) ax -= 1;
  if (KEYS.right) ax += 1;
  if (ax !== 0) player.facing = Math.sign(ax);

  const target = ax * speed;
  player.vx = player.vx * 0.75 + target * 0.25;

  if (KEYS.jump && player.onGround){
    player.vy = JUMP_V;
  }

  if (KEYS.dash && player.canDash && player.dashCooldown === 0){
    player.vx = 12 * player.facing;
    player.vy = Math.min(player.vy, 2);
    player.dashCooldown = 45;
  }

  // Throw homephone weapon
  if (KEYS.throw && player.throwCooldown === 0){
    const pr = {
      x: player.x + (player.facing > 0 ? player.w : -PHONE_W),
      y: player.y + Math.round(player.h * 0.30),
      w: PHONE_W,
      h: PHONE_H,
      vx: 9.5 * player.facing,
      vy: -1.5,
      life: 90,
      dmg: player.projectileDamage
    };
    projectiles.push(pr);
    player.throwCooldown = player.throwCooldownMax;
  }

  player.vy = clamp(player.vy + GRAVITY, -50, MAX_FALL);
  moveAndCollide(player, solids);

  if (player.y > canvas.height + 200){
    player.hp = 0;
    killPlayer();
  }

  if (checkpoint && aabb(player, checkpoint)){
    checkpoint.active = true;
    state.respawn = { x: checkpoint.x, y: checkpoint.y - 20 };
  }

  for (const p of pickups){
    if (p.taken) continue;
    const box = { x:p.x, y:p.y, w:p.w, h:p.h };
    if (!aabb(player, box)) continue;
    p.taken = true;
    if (p.kind === "dash") player.canDash = true;
    if (p.kind === "speed") player.speedBoostTimer = 60 * 8;
  }

  for (const c of coins){
    if (c.taken) continue;
    const box = { x:c.x, y:c.y, w:c.w, h:c.h };
    if (!aabb(player, box)) continue;
    c.taken = true;
    state.coins++;
  }

  if (exitDoor && aabb(player, exitDoor)){
    if (!exitDoor.locked) nextLevel();
  }
}

// -------------------- Enemies --------------------
function updateEnemies(){
  for (const e of enemies){
    e.x += e.vx;
    if (e.x < e.left){ e.x = e.left; e.vx = Math.abs(e.vx); }
    if (e.x > e.right){ e.x = e.right; e.vx = -Math.abs(e.vx); }

    e.vy = (e.vy ?? 0) + GRAVITY;
    const ent = { x:e.x, y:e.y, w:e.w, h:e.h, vx:0, vy:e.vy, onGround:false };
    moveAndCollide(ent, solids);
    e.y = ent.y;
    e.vy = ent.vy;

    if (player.deadTimer === 0 && aabb(player, e)){
      const knock = (player.x + player.w/2) < (e.x + e.w/2) ? -1 : 1;
      damagePlayer(1, knock);
    }
  }
  enemies = enemies.filter(e => e.hp > 0);
}

// -------------------- Projectiles --------------------
function updateProjectiles(){
  for (const pr of projectiles){
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.vy += 0.15;
    pr.life--;

    for (const s of solids){
      if (aabb(pr, s)){ pr.life = 0; break; }
    }

    for (const e of enemies){
      if (pr.life <= 0) break;
      if (aabb(pr, e)){
        e.hp -= pr.dmg;
        pr.life = 0;
      }
    }

    if (boss && boss.hp > 0 && pr.life > 0){
      if (boss.invuln === 0 && aabb(pr, boss)){
        boss.hp -= pr.dmg;
        boss.invuln = 8;
        pr.life = 0;
        if (boss.hp <= 0){
          boss.hp = 0;
          unlockExit();
          setToast("BOSS DEFEATED!", 140);
        }
      }
    }
  }
  projectiles = projectiles.filter(p => p.life > 0);
}

// -------------------- Boss --------------------
function spawnBossBullet(x, y, vx, vy){
  bossProjectiles.push({ x, y, w: 14, h: 14, vx, vy, life: 150 });
}
function spawnShockwave(){
  const floorY = boss.y + boss.h;
  const y = floorY - 18;
  bossWaves.push({ x: boss.x + boss.w*0.45, y, w: 22, h: 18, vx: -7.5, life: 90 });
  bossWaves.push({ x: boss.x + boss.w*0.55, y, w: 22, h: 18, vx:  7.5, life: 90 });
}
function bossChooseNext(){
  const r = Math.random();
  if (r < 0.40){ boss.mode = "shoot"; boss.t = 85; }
  else if (r < 0.72){ boss.mode = "slam"; boss.t = 70; boss.didJump = false; }
  else { boss.mode = "chargeWindup"; boss.t = 28; boss.bounces = 1; }
}
function updateBoss(){
  if (!boss || boss.hp <= 0) return;
  if (player.deadTimer > 0) return;

  boss.wasOnGround = boss.onGround;
  if (boss.invuln > 0) boss.invuln--;

  const bossCx = boss.x + boss.w/2;
  const playerCx = player.x + player.w/2;
  boss.face = playerCx < bossCx ? -1 : 1;

  boss.vy = clamp(boss.vy + GRAVITY, -50, MAX_FALL);

  if (boss.mode === "intro"){
    boss.vx *= 0.85;
    boss.t--;
    if (boss.t <= 0){ boss.mode = "idle"; boss.t = 55; }
  } else if (boss.mode === "idle"){
    const desired = boss.face * 1.2;
    boss.vx = boss.vx * 0.85 + desired * 0.15;
    boss.t--;
    if (boss.t <= 0) bossChooseNext();
  } else if (boss.mode === "shoot"){
    boss.vx *= 0.80;
    if (boss.t === 76 || boss.t === 56 || boss.t === 36){
      const dir = boss.face;
      spawnBossBullet(boss.x + boss.w/2, boss.y + 34, 6.2*dir, -0.4);
      spawnBossBullet(boss.x + boss.w/2, boss.y + 38, 6.0*dir,  0.0);
      spawnBossBullet(boss.x + boss.w/2, boss.y + 42, 5.8*dir,  0.4);
    }
    boss.t--;
    if (boss.t <= 0){ boss.mode = "idle"; boss.t = 55; }
  } else if (boss.mode === "slam"){
    boss.vx *= 0.85;
    if (!boss.didJump && boss.t === 40 && boss.onGround){
      boss.vy = -14.5;
      boss.didJump = true;
    }
    if (boss.didJump && !boss.wasOnGround && boss.onGround){
      spawnShockwave();
      boss.mode = "idle";
      boss.t = 70;
      setToast("STOMP!", 45);
    } else {
      boss.t--;
      if (boss.t <= 0){ boss.mode = "idle"; boss.t = 55; }
    }
  } else if (boss.mode === "chargeWindup"){
    boss.vx *= 0.70;
    boss.t--;
    if (boss.t <= 0){
      boss.mode = "charge";
      boss.t = 60;
      boss.vx = 9.2 * boss.face;
    }
  } else if (boss.mode === "charge"){
    if (boss.x < boss.left){
      boss.x = boss.left;
      if (boss.bounces > 0){ boss.vx = Math.abs(boss.vx); boss.bounces--; }
      else boss.vx = 0;
    }
    if (boss.x + boss.w > boss.right){
      boss.x = boss.right - boss.w;
      if (boss.bounces > 0){ boss.vx = -Math.abs(boss.vx); boss.bounces--; }
      else boss.vx = 0;
    }
    boss.t--;
    if (boss.t <= 0){ boss.mode = "idle"; boss.t = 65; boss.vx = 0; }
  }

  const ent = { x: boss.x, y: boss.y, w: boss.w, h: boss.h, vx: boss.vx, vy: boss.vy, onGround:false };
  moveAndCollide(ent, solids);
  boss.x = ent.x; boss.y = ent.y; boss.vx = ent.vx; boss.vy = ent.vy; boss.onGround = ent.onGround;

  if (aabb(player, boss)){
    const knock = (player.x + player.w/2) < (boss.x + boss.w/2) ? -1 : 1;
    damagePlayer(1, knock);
  }
}
function updateBossProjectiles(){
  for (const pr of bossProjectiles){
    pr.x += pr.vx; pr.y += pr.vy; pr.vy += 0.05; pr.life--;
    for (const s of solids){ if (aabb(pr, s)){ pr.life = 0; break; } }
    if (pr.life > 0 && player.deadTimer === 0 && aabb(player, pr)){
      const knock = pr.vx < 0 ? -1 : 1;
      damagePlayer(1, knock);
      pr.life = 0;
    }
  }
  bossProjectiles = bossProjectiles.filter(p => p.life > 0);
}
function updateBossWaves(){
  for (const w of bossWaves){
    w.x += w.vx; w.life--;
    for (const s of solids){ if (aabb(w, s)){ w.life = 0; break; } }
    if (w.life > 0 && player.deadTimer === 0 && aabb(player, w)){
      const knock = w.vx < 0 ? -1 : 1;
      damagePlayer(1, knock);
      w.life = 0;
    }
  }
  bossWaves = bossWaves.filter(w => w.life > 0);
}

// -------------------- HUD --------------------
function updateHUD(){
  hudCoins.textContent = String(state.coins);
  hudDash.textContent = player.canDash ? (player.dashCooldown === 0 ? "Ready" : "Cooling") : "No";
  const permSpeedMult = 1.0 + (state.upgrades.speedLevel * 0.10);
  hudSpeed.textContent = player.speedBoostTimer > 0 ? "Boosted" : (permSpeedMult > 1 ? "Upgraded" : "Normal");
  hudThrow.textContent = player.throwCooldown === 0 ? "Ready" : "Cooling";
}

// -------------------- 8-bit HP bars --------------------
function drawPixelFrame(x, y, w, h){
  ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#fff"; ctx.fillRect(x+1, y+1, w-2, h-2);
  ctx.fillStyle = "#000"; ctx.fillRect(x+2, y+2, w-4, h-4);
}
function drawSegmentBar(x, y, segments, filled, segW = 8, segH = 8, gap = 2){
  for (let i=0;i<segments;i++){
    const sx = x + i * (segW + gap);
    ctx.fillStyle = (i < filled) ? "#fff" : "#111";
    ctx.fillRect(sx, y, segW, segH);
  }
}
function drawLabel(text, x, y, align="left"){
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.restore();
}
function drawPlayerHP(){
  const segments = player.maxHp;
  const filled = clamp(player.hp, 0, player.maxHp);

  const segW = 10, segH = 10, gap = 2;
  const innerW = segments * segW + (segments-1)*gap;

  const pad = 12;
  const frameW = innerW + 8;
  const frameH = segH + 8;

  const x = canvas.width - pad - frameW;
  const y = pad;

  drawPixelFrame(x, y, frameW, frameH);
  drawSegmentBar(x+4, y+4, segments, filled, segW, segH, gap);
  drawLabel("HP", x + frameW - 2, y + frameH + 14, "right");
}
function drawEnemyHP(ent){
  if (!ent.maxHp || ent.maxHp <= 1) return;

  const segments = clamp(ent.maxHp, 2, 10);
  const filled = clamp(ent.hp, 0, ent.maxHp);

  const segW = 5, segH = 4, gap = 1;
  const innerW = segments * segW + (segments-1)*gap;
  const frameW = innerW + 6;
  const frameH = segH + 6;

  const rr = renderRect(ent);
  const x = Math.floor(rr.x + rr.w/2 - frameW/2);
  const y = Math.floor(rr.y - frameH - 6);

  drawPixelFrame(x, y, frameW, frameH);
  const segFilled = Math.round((filled / ent.maxHp) * segments);
  drawSegmentBar(x+3, y+3, segments, segFilled, segW, segH, gap);
}
function drawBossBar(){
  if (!boss || boss.hp <= 0) return;

  const segments = 16;
  const filledSeg = Math.round((boss.hp / boss.maxHp) * segments);

  const pad = 12;
  const segW = 10, segH = 10, gap = 2;
  const innerW = segments * segW + (segments-1)*gap;
  const frameW = innerW + 8;
  const frameH = segH + 8;

  const x = pad;
  const y = pad;

  drawPixelFrame(x, y, frameW, frameH);
  drawSegmentBar(x+4, y+4, segments, filledSeg, segW, segH, gap);
  drawLabel("BOSS", x, y + frameH + 14, "left");
}
function drawToast(){
  if (state.toast.t <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, canvas.height*0.10, canvas.width, 40);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = "#fff";
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  ctx.fillText(state.toast.text, canvas.width/2, canvas.height*0.10 + 26);
  ctx.restore();
}

// -------------------- Render --------------------
function drawTiledPlatform(rect){
  const img = images.platform;
  const tileH = rect.h;
  const scale = tileH / img.height;
  const tileW = img.width * scale;
  for (let x = rect.x; x < rect.x + rect.w; x += tileW){
    const w = Math.min(tileW, rect.x + rect.w - x);
    ctx.drawImage(img, 0, 0, img.width * (w / tileW), img.height, x, rect.y, w, tileH);
  }
}

function drawEntity(img, ent, facing=1, blink=false){
  const rr = renderRect(ent);
  ctx.save();
  if (blink) ctx.globalAlpha = 0.55;
  if (facing < 0){
    ctx.translate(rr.x + rr.w, rr.y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, rr.w, rr.h);
  } else {
    ctx.drawImage(img, rr.x, rr.y, rr.w, rr.h);
  }
  ctx.restore();

  if (DEBUG_HITBOX){
    ctx.save();
    ctx.strokeStyle = "#ff00ff";
    ctx.strokeRect(ent.x, ent.y, ent.w, ent.h);
    ctx.restore();
  }
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);

  for (const p of platforms) drawTiledPlatform(p);

  if (DEBUG_HITBOX){
    ctx.save();
    ctx.strokeStyle = "#00ffff";
    for (const s of solids){
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.w, s.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (exitDoor){
    ctx.globalAlpha = exitDoor.locked ? 0.45 : 1.0;
    ctx.drawImage(images.exit, exitDoor.x, exitDoor.y, exitDoor.w, exitDoor.h);
    ctx.globalAlpha = 1.0;
  }

  if (checkpoint){
    ctx.globalAlpha = checkpoint.active ? 1.0 : 0.75;
    ctx.drawImage(images.checkpoint, checkpoint.x, checkpoint.y, checkpoint.w, checkpoint.h);
    ctx.globalAlpha = 1.0;
  }

  for (const p of pickups){
    if (p.taken) continue;
    const img = p.kind === "dash" ? images.dash : images.speed;
    ctx.drawImage(img, p.x, p.y, p.w, p.h);
  }

  for (const c of coins){
    if (c.taken) continue;
    ctx.drawImage(images.coin, c.x, c.y, c.w, c.h);
  }

  for (const e of enemies){
    const img = e.type === "enemy1" ? images.enemy1 : images.enemy2;
    const face = e.vx < 0 ? -1 : 1;
    drawEntity(img, e, face, false);
    drawEnemyHP(e);
  }

  for (const pr of bossProjectiles){
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#fff";
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    ctx.globalAlpha = 1.0;
  }

  for (const w of bossWaves){
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.globalAlpha = 1.0;
  }

  for (const pr of projectiles){
    ctx.drawImage(images.phone, pr.x, pr.y, pr.w, pr.h);
  }

  if (boss && boss.hp > 0){
    const bImg = boss.type === "enemy2" ? images.enemy2 : images.enemy1;
    const blink = boss.invuln > 0 && (boss.invuln % 4) < 2;
    drawEntity(bImg, boss, boss.face, blink);
    drawBossBar();
  }

  const pImg = images[`char_${selectedCharId}`];
  const blink = player.invuln > 0 && (player.invuln % 10) < 5;
  drawEntity(pImg, player, player.facing, blink);

  drawPlayerHP();
  drawToast();
}

// -------------------- Character select --------------------
function buildCharacterMenu(){
  charGridEl.innerHTML = "";
  ASSETS.chars.forEach((c) => {
    const card = document.createElement("div");
    card.className = "char-card";
    card.setAttribute("role","button");
    card.tabIndex = 0;

    const img = document.createElement("img");
    img.src = c.src;
    img.alt = c.id;

    const label = document.createElement("div");
    label.innerHTML = `<div class="char-name">${c.id}</div><div class="small">Playable</div>`;

    card.appendChild(img);
    card.appendChild(label);

    function select(){
      selectedCharId = c.id;
      [...document.querySelectorAll(".char-card")].forEach(el => el.classList.remove("selected"));
      card.classList.add("selected");
      startBtn.disabled = false;
    }

    card.addEventListener("click", select);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") select(); });

    charGridEl.appendChild(card);
  });
}

// -------------------- Start / Loop --------------------
function startGame(){
  state.running = true;
  state.paused = false;
  state.shopOpen = false;
  setOverlay(pauseOverlay, false);
  setOverlay(shopOverlay, false);

  menuEl.classList.add("hidden");
  hudEl.classList.remove("hidden");

  state.coins = 0;

  // reset upgrades for a new run
  state.upgrades = {
    maxHpBonus: 0,
    dashModule: false,
    speedLevel: 0,
    damageBonus: 0,
    throwReduce: 0
  };

  // reset player “found” abilities
  player.canDash = false;
  player.dashCooldown = 0;
  player.speedBoostTimer = 0;
  player.throwCooldown = 0;

  applyUpgrades(true);
  resetToLevel(START_LEVEL_INDEX);
}
startBtn.addEventListener("click", startGame);

let last = performance.now();
function loop(now){
  last = now;

  if (state.running){
    if (!state.paused){
      updatePlayer();
      updateEnemies();
      updateBoss();
      updateProjectiles();
      updateBossProjectiles();
      updateBossWaves();
      updateHUD();
      updateToast();
    } else {
      // Keep shop coin display fresh while paused
      shopCoinsEl.textContent = String(state.coins);
    }
    draw();
  } else {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (images.bg) ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(loop);
}

// -------------------- Boot --------------------
(async function init(){
  buildCharacterMenu();
  try{
    await loadAll();
    requestAnimationFrame(loop);
  } catch (err){
    console.error(err);
    alert("Could not load images. Check the /assets filenames match exactly.");
  }
})();
