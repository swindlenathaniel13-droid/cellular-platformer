/* Pixel Platformer - HTML Canvas
   - Playable: Gilly/Scott/Kevin/Nate
   - Enemies: Enemy1/Enemy2 patrol (each has HP bar)
   - Boss: Enemy2 becomes a boss fight with HP + patterns (segmented boss bar)
   - Exit door advances level (boss level door is locked until boss defeated)
   - Platform tiles are walkable geometry
   - Powerups: Dash, Speedboost
   - Weapon: powerup_homephone.png = thrown projectile
   - 8-bit segmented HP bars for player + all enemies
   - NEW: sprite scaling + snapping so characters/enemies look "on" platforms
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

// Set to 2 if you want to start directly on the boss level for testing.
const START_LEVEL_INDEX = 0;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const menuEl = document.getElementById("menu");
const charGridEl = document.getElementById("charGrid");
const startBtn = document.getElementById("startBtn");

const hudEl = document.getElementById("hud");
const hudLevel = document.getElementById("hudLevel");
const hudCoins = document.getElementById("hudCoins");
const hudDash = document.getElementById("hudDash");
const hudSpeed = document.getElementById("hudSpeed");
const hudThrow = document.getElementById("hudThrow");

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function aabb(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

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

// --- Input ---
const KEYS = { left:false, right:false, jump:false, dash:false, throw:false };
window.addEventListener("keydown", (e) => {
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

// --- Levels (static for now) ---
const LEVELS = [
  {
    name: "Rooftop Relay",
    spawn: { x: 70, y: 380 },
    exit:  { x: 880, y: 395 },
    exitLocked: false,
    checkpoint: { x: 470, y: 395 },
    platforms: [
      { x: 0, y: 460, w: 960, h: 80 },
      { x: 140, y: 380, w: 220, h: 28 },
      { x: 420, y: 320, w: 180, h: 28 },
      { x: 650, y: 360, w: 200, h: 28 },
      { x: 780, y: 290, w: 140, h: 28 },
    ],
    enemies: [
      { type:"enemy1", x: 200, y: 330, left: 150, right: 340, hp: 2 },
      { type:"enemy2", x: 720, y: 310, left: 650, right: 840, hp: 3 },
    ],
    coins: [
      { x: 170, y: 340 }, { x: 210, y: 340 }, { x: 250, y: 340 },
      { x: 460, y: 280 }, { x: 500, y: 280 },
      { x: 820, y: 250 },
    ],
    pickups: [
      { kind:"dash",  x: 440, y: 285 },
      { kind:"speed", x: 820, y: 260 },
    ],
    boss: null
  },
  {
    name: "Circuit Steps",
    spawn: { x: 60, y: 380 },
    exit:  { x: 900, y: 170 },
    exitLocked: false,
    checkpoint: { x: 520, y: 240 },
    platforms: [
      { x: 0, y: 460, w: 960, h: 80 },
      { x: 120, y: 400, w: 160, h: 28 },
      { x: 310, y: 350, w: 160, h: 28 },
      { x: 500, y: 300, w: 180, h: 28 },
      { x: 710, y: 250, w: 180, h: 28 },
      { x: 760, y: 190, w: 160, h: 28 },
    ],
    enemies: [
      { type:"enemy2", x: 320, y: 300, left: 310, right: 450, hp: 3 },
      { type:"enemy1", x: 520, y: 250, left: 500, right: 670, hp: 2 },
      { type:"enemy2", x: 740, y: 200, left: 710, right: 880, hp: 4 },
    ],
    coins: [
      { x: 150, y: 360 }, { x: 190, y: 360 },
      { x: 340, y: 310 }, { x: 380, y: 310 },
      { x: 540, y: 260 }, { x: 580, y: 260 },
      { x: 760, y: 210 }, { x: 800, y: 210 }, { x: 840, y: 210 }
    ],
    pickups: [
      { kind:"speed", x: 530, y: 265 },
    ],
    boss: null
  },
  {
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
  }
];

// --- Sprite scaling (make characters/enemies feel like they belong in the world) ---
const SPRITE_SCALE = 1.8; // try 2.0 for even bigger

const PLAYER_BASE = { w: 34, h: 48 };
const ENEMY_BASE  = { w: 40, h: 40 };
const BOSS_BASE   = { w: 92, h: 92 };
const PHONE_BASE  = { w: 18, h: 18 };

const PLAYER_SIZE = { w: Math.round(PLAYER_BASE.w * SPRITE_SCALE), h: Math.round(PLAYER_BASE.h * SPRITE_SCALE) };
const ENEMY_SIZE  = { w: Math.round(ENEMY_BASE.w  * SPRITE_SCALE), h: Math.round(ENEMY_BASE.h  * SPRITE_SCALE) };
const BOSS_SIZE   = { w: Math.round(BOSS_BASE.w   * SPRITE_SCALE), h: Math.round(BOSS_BASE.h   * SPRITE_SCALE) };
const PHONE_SIZE  = { w: Math.round(PHONE_BASE.w  * SPRITE_SCALE), h: Math.round(PHONE_BASE.h  * SPRITE_SCALE) };

// Visual: draw sprites slightly LOWER so feet sit on platform art better
const SPRITE_RENDER_Y_OFFSET = Math.round(6 * SPRITE_SCALE);

// --- Game state ---
let selectedCharId = null;

const state = {
  running: false,
  levelIndex: 0,
  coins: 0,
  respawn: { x: 60, y: 380 },
  time: 0,
  toast: { text: "", t: 0 }
};

const player = {
  x: 60, y: 380, w: PLAYER_SIZE.w, h: PLAYER_SIZE.h,
  vx: 0, vy: 0,
  facing: 1,
  onGround: false,

  // health
  maxHp: 6,
  hp: 6,
  invuln: 0,

  canDash: false,
  dashCooldown: 0,
  speedBoostTimer: 0,
  throwCooldown: 0,
  deadTimer: 0,
};

let enemies = [];
let coins = [];
let pickups = [];
let projectiles = [];
let exitDoor = null;
let checkpoint = null;
let platforms = [];

// Boss-related
let boss = null;
let bossProjectiles = [];
let bossWaves = [];

// Snap helper: place an entity ON the nearest platform top (by X), near a preferred foot Y
function snapEntityToNearestPlatform(ent, preferredFootY){
  const cx = ent.x + ent.w / 2;
  let best = null;
  let bestDist = Infinity;

  for (const p of platforms){
    if (cx < p.x || cx > p.x + p.w) continue;
    const dist = Math.abs(p.y - preferredFootY);
    if (dist < bestDist){
      bestDist = dist;
      best = p;
    }
  }

  if (best){
    ent.y = best.y - ent.h;
    ent.vy = 0;
    ent.onGround = true;
  }
}

function setToast(text, frames = 120){
  state.toast.text = text;
  state.toast.t = frames;
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

  // snap after respawn
  snapEntityToNearestPlatform(player, player.y + PLAYER_BASE.h);
}

function unlockExit(){
  if (!exitDoor) return;
  if (!exitDoor.locked) return;
  exitDoor.locked = false;
  setToast("EXIT UNLOCKED!", 120);
}

function resetToLevel(idx){
  state.levelIndex = idx;
  const L = LEVELS[idx];
  hudLevel.textContent = String(idx + 1);
  state.respawn = { x: L.spawn.x, y: L.spawn.y };

  // platforms first (needed for snapping)
  platforms = (L.platforms || []).map(p => ({...p}));

  // player reset
  player.x = L.spawn.x;
  player.y = L.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.deadTimer = 0;
  player.invuln = 0;
  player.hp = player.maxHp;

  coins = (L.coins || []).map(c => ({...c, w: 20, h: 20, taken: false}));
  pickups = (L.pickups || []).map(p => ({...p, w: 26, h: 26, taken: false}));
  projectiles = [];

  exitDoor = { x: L.exit.x, y: L.exit.y, w: 44, h: 56, locked: !!L.exitLocked };
  checkpoint = { x: L.checkpoint.x, y: L.checkpoint.y, w: 28, h: 50, active:false };

  // enemies (scaled + patrol correction)
  enemies = (L.enemies || []).map(e => ({
    ...e,
    w: ENEMY_SIZE.w, h: ENEMY_SIZE.h,
    vx: 0.7 * (Math.random() > 0.5 ? 1 : -1),
    vy: 0,
    maxHp: e.hp,
    _preferredFootY: (e.y ?? 0) + ENEMY_BASE.h,
    right: e.right - (ENEMY_SIZE.w - ENEMY_BASE.w)
  }));

  // boss reset
  bossProjectiles = [];
  bossWaves = [];
  boss = null;

  if (L.boss){
    boss = {
      type: L.boss.type,
      x: L.boss.x,
      y: L.boss.y,
      w: BOSS_SIZE.w,
      h: BOSS_SIZE.h,
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

  // Snap bigger sprites so they sit ON platforms
  snapEntityToNearestPlatform(player, (L.spawn?.y ?? player.y) + PLAYER_BASE.h);

  for (const e of enemies){
    snapEntityToNearestPlatform(e, e._preferredFootY);
    delete e._preferredFootY;
  }

  if (boss){
    snapEntityToNearestPlatform(boss, (L.boss?.y ?? boss.y) + BOSS_BASE.h);
  }
}

function startGame(){
  state.running = true;
  menuEl.classList.add("hidden");
  hudEl.classList.remove("hidden");
  state.coins = 0;

  player.canDash = false;
  player.dashCooldown = 0;
  player.speedBoostTimer = 0;
  player.throwCooldown = 0;

  resetToLevel(START_LEVEL_INDEX);
}

function nextLevel(){
  const next = state.levelIndex + 1;
  if (next >= LEVELS.length){
    resetToLevel(0);
    state.coins = 0;
    return;
  }
  resetToLevel(next);
}

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
startBtn.addEventListener("click", startGame);

// --- Physics & collisions ---
const GRAVITY = 0.55;
const JUMP_V = -11.5;
const BASE_SPEED = 3.2;
const MAX_FALL = 14;

function moveAndCollide(ent, solids){
  ent.x += ent.vx;
  for (const s of solids){
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
  for (const s of solids){
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

function updatePlayer(){
  if (player.deadTimer > 0){
    player.deadTimer--;
    if (player.deadTimer === 0) respawnPlayer();
    return;
  }

  if (player.invuln > 0) player.invuln--;

  const speedMult = player.speedBoostTimer > 0 ? 1.55 : 1.0;
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

  if (KEYS.throw && player.throwCooldown === 0){
    const proj = {
      x: player.x + (player.facing > 0 ? player.w : -PHONE_SIZE.w),
      y: player.y + Math.round(player.h * 0.35),
      w: PHONE_SIZE.w,
      h: PHONE_SIZE.h,
      vx: 9.5 * player.facing,
      vy: -1.5,
      life: 90
    };
    projectiles.push(proj);
    player.throwCooldown = 18;
  }

  player.vy = clamp(player.vy + GRAVITY, -50, MAX_FALL);
  moveAndCollide(player, platforms);

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

function updateEnemies(){
  for (const e of enemies){
    e.x += e.vx;
    if (e.x < e.left){ e.x = e.left; e.vx = Math.abs(e.vx); }
    if (e.x > e.right){ e.x = e.right; e.vx = -Math.abs(e.vx); }

    e.vy = (e.vy ?? 0) + GRAVITY;
    const ent = { x:e.x, y:e.y, w:e.w, h:e.h, vx:0, vy:e.vy, onGround:false };
    moveAndCollide(ent, platforms);
    e.y = ent.y;
    e.vy = ent.vy;

    if (player.deadTimer === 0 && aabb(player, e)){
      const knock = (player.x + player.w/2) < (e.x + e.w/2) ? -1 : 1;
      damagePlayer(1, knock);
    }
  }
  enemies = enemies.filter(e => e.hp > 0);
}

// Player projectiles (home phone)
function updateProjectiles(){
  for (const pr of projectiles){
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.vy += 0.15;
    pr.life--;

    for (const s of platforms){
      if (aabb(pr, s)){
        pr.life = 0;
        break;
      }
    }

    for (const e of enemies){
      if (pr.life <= 0) break;
      if (aabb(pr, e)){
        e.hp -= 1;
        pr.life = 0;
      }
    }

    if (boss && boss.hp > 0 && pr.life > 0){
      if (boss.invuln === 0 && aabb(pr, boss)){
        boss.hp -= 1;
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

// --- Boss logic ---
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
  if (r < 0.40){
    boss.mode = "shoot";
    boss.t = 85;
  } else if (r < 0.72){
    boss.mode = "slam";
    boss.t = 70;
    boss.didJump = false;
  } else {
    boss.mode = "chargeWindup";
    boss.t = 28;
    boss.bounces = 1;
  }
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
    if (boss.t <= 0){
      boss.mode = "idle";
      boss.t = 55;
    }
  }
  else if (boss.mode === "idle"){
    const desired = boss.face * 1.2;
    boss.vx = boss.vx * 0.85 + desired * 0.15;

    boss.t--;
    if (boss.t <= 0) bossChooseNext();
  }
  else if (boss.mode === "shoot"){
    boss.vx *= 0.80;

    if (boss.t === 76 || boss.t === 56 || boss.t === 36){
      const dir = boss.face;
      spawnBossBullet(boss.x + boss.w/2, boss.y + 34, 6.2*dir, -0.4);
      spawnBossBullet(boss.x + boss.w/2, boss.y + 38, 6.0*dir,  0.0);
      spawnBossBullet(boss.x + boss.w/2, boss.y + 42, 5.8*dir,  0.4);
    }

    boss.t--;
    if (boss.t <= 0){
      boss.mode = "idle";
      boss.t = 55;
    }
  }
  else if (boss.mode === "slam"){
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
      if (boss.t <= 0){
        boss.mode = "idle";
        boss.t = 55;
      }
    }
  }
  else if (boss.mode === "chargeWindup"){
    boss.vx *= 0.70;
    boss.t--;
    if (boss.t <= 0){
      boss.mode = "charge";
      boss.t = 60;
      boss.vx = 9.2 * boss.face;
    }
  }
  else if (boss.mode === "charge"){
    if (boss.x < boss.left){
      boss.x = boss.left;
      if (boss.bounces > 0){
        boss.vx = Math.abs(boss.vx);
        boss.bounces--;
      } else boss.vx = 0;
    }
    if (boss.x + boss.w > boss.right){
      boss.x = boss.right - boss.w;
      if (boss.bounces > 0){
        boss.vx = -Math.abs(boss.vx);
        boss.bounces--;
      } else boss.vx = 0;
    }

    boss.t--;
    if (boss.t <= 0){
      boss.mode = "idle";
      boss.t = 65;
      boss.vx = 0;
    }
  }

  const ent = { x: boss.x, y: boss.y, w: boss.w, h: boss.h, vx: boss.vx, vy: boss.vy, onGround:false };
  moveAndCollide(ent, platforms);
  boss.x = ent.x;
  boss.y = ent.y;
  boss.vx = ent.vx;
  boss.vy = ent.vy;
  boss.onGround = ent.onGround;

  if (aabb(player, boss)){
    const knock = (player.x + player.w/2) < (boss.x + boss.w/2) ? -1 : 1;
    damagePlayer(1, knock);
  }
}

function updateBossProjectiles(){
  for (const pr of bossProjectiles){
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.vy += 0.05;
    pr.life--;

    for (const s of platforms){
      if (aabb(pr, s)){
        pr.life = 0;
        break;
      }
    }

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
    w.x += w.vx;
    w.life--;

    for (const s of platforms){
      if (aabb(w, s)){
        w.life = 0;
        break;
      }
    }

    if (w.life > 0 && player.deadTimer === 0 && aabb(player, w)){
      const knock = w.vx < 0 ? -1 : 1;
      damagePlayer(1, knock);
      w.life = 0;
    }
  }
  bossWaves = bossWaves.filter(w => w.life > 0);
}

function updateHUD(){
  hudCoins.textContent = String(state.coins);
  hudDash.textContent = player.canDash ? (player.dashCooldown === 0 ? "Ready" : "Cooling") : "No";
  hudSpeed.textContent = player.speedBoostTimer > 0 ? "Boosted" : "Normal";
  hudThrow.textContent = player.throwCooldown === 0 ? "Ready" : "Cooling";
}

function updateToast(){
  if (state.toast.t > 0) state.toast.t--;
}

// --- 8-bit HP bar drawing helpers ---
function drawPixelFrame(x, y, w, h){
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x+1, y+1, w-2, h-2);
  ctx.fillStyle = "#000";
  ctx.fillRect(x+2, y+2, w-4, h-4);
}

function drawSegmentBar(x, y, segments, filled, segW = 8, segH = 8, gap = 2){
  for (let i = 0; i < segments; i++){
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

  if (player.invuln > 0 && (player.invuln % 10) < 5){
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + frameW - 10, y - 6, 8, 4);
  }
}

function drawEnemyHP(ent){
  if (!ent.maxHp || ent.maxHp <= 1) return;

  const segments = clamp(ent.maxHp, 2, 10);
  const filled = clamp(ent.hp, 0, ent.maxHp);

  const segW = 5, segH = 4, gap = 1;
  const innerW = segments * segW + (segments-1)*gap;
  const frameW = innerW + 6;
  const frameH = segH + 6;

  const x = Math.floor(ent.x + ent.w/2 - frameW/2);
  const y = Math.floor(ent.y + SPRITE_RENDER_Y_OFFSET - frameH - 6);

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

// --- Rendering ---
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

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);

  for (const p of platforms) drawTiledPlatform(p);

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

  // enemies + HP
  for (const e of enemies){
    const img = e.type === "enemy1" ? images.enemy1 : images.enemy2;
    ctx.drawImage(img, e.x, e.y + SPRITE_RENDER_Y_OFFSET, e.w, e.h);
    drawEnemyHP(e);
  }

  // boss projectiles
  for (const pr of bossProjectiles){
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#fff";
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    ctx.globalAlpha = 1.0;
  }

  // boss waves
  for (const w of bossWaves){
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.globalAlpha = 1.0;
  }

  // player phone projectiles
  for (const pr of projectiles){
    ctx.drawImage(images.phone, pr.x, pr.y, pr.w, pr.h);
  }

  // boss render + boss bar
  if (boss && boss.hp > 0){
    const bImg = boss.type === "enemy2" ? images.enemy2 : images.enemy1;

    ctx.save();
    if (boss.invuln > 0 && (boss.invuln % 4) < 2) ctx.globalAlpha = 0.55;

    if (boss.face < 0){
      ctx.translate(boss.x + boss.w, boss.y + SPRITE_RENDER_Y_OFFSET);
      ctx.scale(-1, 1);
      ctx.drawImage(bImg, 0, 0, boss.w, boss.h);
    } else {
      ctx.drawImage(bImg, boss.x, boss.y + SPRITE_RENDER_Y_OFFSET, boss.w, boss.h);
    }
    ctx.restore();

    drawBossBar();
  }

  // player render (blink when invulnerable)
  const pImg = images[`char_${selectedCharId}`];
  if (pImg){
    ctx.save();
    if (player.invuln > 0 && (player.invuln % 10) < 5) ctx.globalAlpha = 0.55;

    if (player.facing < 0){
      ctx.translate(player.x + player.w, player.y + SPRITE_RENDER_Y_OFFSET);
      ctx.scale(-1, 1);
      ctx.drawImage(pImg, 0, 0, player.w, player.h);
    } else {
      ctx.drawImage(pImg, player.x, player.y + SPRITE_RENDER_Y_OFFSET, player.w, player.h);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  // player HP bar
  drawPlayerHP();

  if (player.deadTimer > 0){
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha = 1.0;
  }

  drawToast();
}

let last = performance.now();
function loop(now){
  last = now;

  if (state.running){
    updatePlayer();
    updateEnemies();
    updateBoss();
    updateProjectiles();
    updateBossProjectiles();
    updateBossWaves();
    updateHUD();
    updateToast();
    draw();
  } else {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (images.bg) ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(loop);
}

// Boot
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
