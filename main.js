/* Pixel Platformer - HTML Canvas
   - Playable: Gilly/Scott/Kevin/Nate
   - Enemies: Enemy1/Enemy2 patrol
   - Boss: Enemy2 becomes a boss fight with HP + patterns
   - Exit door advances level (boss level door is locked until boss defeated)
   - Platform tiles are walkable geometry
   - Powerups: Dash, Speedboost
   - Weapon: powerup_homephone.png = thrown projectile
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

// Change this to 2 if you want to START directly on the boss level for testing.
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

// --- Level data (platforms are rectangles; platform sprite is tiled across the width) ---
const LEVELS = [
  {
    name: "Rooftop Relay",
    spawn: { x: 70, y: 380 },
    exit:  { x: 880, y: 395 },
    exitLocked: false,
    checkpoint: { x: 470, y: 395 },
    platforms: [
      { x: 0, y: 460, w: 960, h: 80 },         // ground
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
  // --- BOSS LEVEL ---
  {
    name: "Boss: Signal Tyrant",
    spawn: { x: 70, y: 380 },
    exit:  { x: 890, y: 395 },
    exitLocked: true, // unlocked when boss dies
    checkpoint: { x: 160, y: 395 },
    platforms: [
      { x: 0, y: 460, w: 960, h: 80 },          // arena floor
      { x: 150, y: 360, w: 140, h: 28 },        // small ledges
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
  x: 60, y: 380, w: 34, h: 48,
  vx: 0, vy: 0,
  facing: 1,
  onGround: false,
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

function setToast(text, frames = 120){
  state.toast.text = text;
  state.toast.t = frames;
}

function resetToLevel(idx){
  state.levelIndex = idx;
  const L = LEVELS[idx];
  hudLevel.textContent = String(idx + 1);
  state.respawn = { x: L.spawn.x, y: L.spawn.y };

  player.x = L.spawn.x;
  player.y = L.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.deadTimer = 0;

  enemies = (L.enemies || []).map(e => ({...e, w: 40, h: 40, vx: 0.7 * (Math.random() > 0.5 ? 1 : -1), vy:0 }));
  coins = (L.coins || []).map(c => ({...c, w: 20, h: 20, taken: false}));
  pickups = (L.pickups || []).map(p => ({...p, w: 26, h: 26, taken: false}));
  projectiles = [];

  exitDoor = { x: L.exit.x, y: L.exit.y, w: 44, h: 56, locked: !!L.exitLocked };
  checkpoint = { x: L.checkpoint.x, y: L.checkpoint.y, w: 28, h: 50, active:false };
  platforms = (L.platforms || []).map(p => ({...p}));

  // Boss setup
  bossProjectiles = [];
  bossWaves = [];
  boss = null;
  if (L.boss){
    boss = {
      type: L.boss.type,
      x: L.boss.x,
      y: L.boss.y,
      w: 92,
      h: 92,
      vx: 0,
      vy: 0,
      onGround: false,
      wasOnGround: false,
      left: L.boss.left,
      right: L.boss.right,
      hp: L.boss.hp,
      maxHp: L.boss.hp,
      mode: "intro",
      t: 90,           // intro timer
      invuln: 0,
      face: -1,
      bounces: 0
    };
    setToast("BOSS APPROACHING", 90);
  }
}

function killPlayer(){
  if (player.deadTimer > 0) return;
  player.deadTimer = 45; // frames of "death pause"
}

function respawnPlayer(){
  player.x = state.respawn.x;
  player.y = state.respawn.y;
  player.vx = 0;
  player.vy = 0;
  projectiles = [];
  bossProjectiles = [];
  bossWaves = [];
}

function unlockExit(){
  if (!exitDoor) return;
  if (!exitDoor.locked) return;
  exitDoor.locked = false;
  setToast("EXIT UNLOCKED!", 120);
}

function startGame(){
  state.running = true;
  menuEl.classList.add("hidden");
  hudEl.classList.remove("hidden");
  state.coins = 0;

  // Powerups reset per run (feel free to change later)
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
  // Horizontal
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

  // Vertical
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
  // death pause
  if (player.deadTimer > 0){
    player.deadTimer--;
    if (player.deadTimer === 0) respawnPlayer();
    return;
  }

  const speedMult = player.speedBoostTimer > 0 ? 1.55 : 1.0;
  const speed = BASE_SPEED * speedMult;

  if (player.dashCooldown > 0) player.dashCooldown--;
  if (player.speedBoostTimer > 0) player.speedBoostTimer--;
  if (player.throwCooldown > 0) player.throwCooldown--;

  // input
  let ax = 0;
  if (KEYS.left) ax -= 1;
  if (KEYS.right) ax += 1;
  if (ax !== 0) player.facing = Math.sign(ax);

  // horizontal velocity
  const target = ax * speed;
  player.vx = player.vx * 0.75 + target * 0.25;

  // jump
  if (KEYS.jump && player.onGround){
    player.vy = JUMP_V;
  }

  // dash
  if (KEYS.dash && player.canDash && player.dashCooldown === 0){
    player.vx = 12 * player.facing;
    player.vy = Math.min(player.vy, 2);
    player.dashCooldown = 45;
  }

  // throw phone projectile
  if (KEYS.throw && player.throwCooldown === 0){
    const proj = {
      x: player.x + (player.facing > 0 ? player.w : -18),
      y: player.y + 18,
      w: 18,
      h: 18,
      vx: 9.5 * player.facing,
      vy: -1.5,
      life: 90
    };
    projectiles.push(proj);
    player.throwCooldown = 18;
  }

  // gravity
  player.vy = clamp(player.vy + GRAVITY, -50, MAX_FALL);
  moveAndCollide(player, platforms);

  // fell off world
  if (player.y > canvas.height + 200){
    killPlayer();
  }

  // checkpoint
  if (checkpoint && aabb(player, checkpoint)){
    checkpoint.active = true;
    state.respawn = { x: checkpoint.x, y: checkpoint.y - 20 };
  }

  // pickups
  for (const p of pickups){
    if (p.taken) continue;
    const box = { x:p.x, y:p.y, w:p.w, h:p.h };
    if (!aabb(player, box)) continue;
    p.taken = true;
    if (p.kind === "dash") player.canDash = true;
    if (p.kind === "speed") player.speedBoostTimer = 60 * 8;
  }

  // coins
  for (const c of coins){
    if (c.taken) continue;
    const box = { x:c.x, y:c.y, w:c.w, h:c.h };
    if (!aabb(player, box)) continue;
    c.taken = true;
    state.coins++;
  }

  // exit (locked on boss level until boss is defeated)
  if (exitDoor && aabb(player, exitDoor)){
    if (!exitDoor.locked) nextLevel();
  }
}

function updateEnemies(){
  for (const e of enemies){
    e.x += e.vx;
    if (e.x < e.left){ e.x = e.left; e.vx = Math.abs(e.vx); }
    if (e.x > e.right){ e.x = e.right; e.vx = -Math.abs(e.vx); }

    // gravity on enemies
    e.vy = (e.vy ?? 0) + GRAVITY;
    const ent = { x:e.x, y:e.y, w:e.w, h:e.h, vx:0, vy:e.vy, onGround:false };
    moveAndCollide(ent, platforms);
    e.y = ent.y;
    e.vy = ent.vy;

    if (player.deadTimer === 0 && aabb(player, e)){
      killPlayer();
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

    // collide with platforms -> vanish
    for (const s of platforms){
      if (aabb(pr, s)){
        pr.life = 0;
        break;
      }
    }

    // hit enemies
    for (const e of enemies){
      if (pr.life <= 0) break;
      if (aabb(pr, e)){
        e.hp -= 1;
        pr.life = 0;
      }
    }

    // hit boss
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
  // travels along the ground from boss position
  const floorY = boss.y + boss.h;
  const y = floorY - 18;
  bossWaves.push({ x: boss.x + boss.w*0.45, y, w: 22, h: 18, vx: -7.5, life: 90 });
  bossWaves.push({ x: boss.x + boss.w*0.55, y, w: 22, h: 18, vx:  7.5, life: 90 });
}

function bossChooseNext(){
  // Weighted pick: shoot, slam, charge
  const r = Math.random();
  if (r < 0.40){
    boss.mode = "shoot";
    boss.t = 85;
    boss.shots = 0;
  } else if (r < 0.72){
    boss.mode = "slam";
    boss.t = 70;      // windup + jump + land
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

  // face player
  const bossCx = boss.x + boss.w/2;
  const playerCx = player.x + player.w/2;
  boss.face = playerCx < bossCx ? -1 : 1;

  // default gravity
  boss.vy = clamp(boss.vy + GRAVITY, -50, MAX_FALL);

  // AI modes
  if (boss.mode === "intro"){
    boss.vx *= 0.85;
    boss.t--;
    if (boss.t <= 0){
      boss.mode = "idle";
      boss.t = 55;
    }
  }
  else if (boss.mode === "idle"){
    // small drift toward player
    const desired = boss.face * 1.2;
    boss.vx = boss.vx * 0.85 + desired * 0.15;

    boss.t--;
    if (boss.t <= 0) bossChooseNext();
  }
  else if (boss.mode === "shoot"){
    boss.vx *= 0.80;

    // shoot 3 times while timer runs
    if (boss.t === 76 || boss.t === 56 || boss.t === 36){
      const dir = boss.face;
      // slight spread
      spawnBossBullet(boss.x + boss.w/2, boss.y + 34, 6.2*dir, -0.4);
      spawnBossBullet(boss.x + boss.w/2, boss.y + 38, 6.0*dir,  0.0);
      spawnBossBullet(boss.x + boss.w/2, boss.y + 42, 5.8*dir,  0.4);
      boss.shots++;
    }

    boss.t--;
    if (boss.t <= 0){
      boss.mode = "idle";
      boss.t = 55;
    }
  }
  else if (boss.mode === "slam"){
    // windup then jump, then on landing make shockwave
    boss.vx *= 0.85;

    // jump moment
    if (!boss.didJump && boss.t === 40 && boss.onGround){
      boss.vy = -14.5;
      boss.didJump = true;
    }

    // landing detection (was in air, now on ground)
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
    // clamp / bounce within arena bounds
    if (boss.x < boss.left){
      boss.x = boss.left;
      if (boss.bounces > 0){
        boss.vx = Math.abs(boss.vx);
        boss.bounces--;
      } else {
        boss.vx = 0;
      }
    }
    if (boss.x + boss.w > boss.right){
      boss.x = boss.right - boss.w;
      if (boss.bounces > 0){
        boss.vx = -Math.abs(boss.vx);
        boss.bounces--;
      } else {
        boss.vx = 0;
      }
    }

    boss.t--;
    if (boss.t <= 0){
      boss.mode = "idle";
      boss.t = 65;
      boss.vx = 0;
    }
  }

  // Apply physics collision with platforms
  const ent = { x: boss.x, y: boss.y, w: boss.w, h: boss.h, vx: boss.vx, vy: boss.vy, onGround:false };
  moveAndCollide(ent, platforms);
  boss.x = ent.x;
  boss.y = ent.y;
  boss.vx = ent.vx;
  boss.vy = ent.vy;
  boss.onGround = ent.onGround;

  // Boss touching player = death
  if (aabb(player, boss)){
    killPlayer();
  }
}

function updateBossProjectiles(){
  for (const pr of bossProjectiles){
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.vy += 0.05;
    pr.life--;

    // collide with platforms
    for (const s of platforms){
      if (aabb(pr, s)){
        pr.life = 0;
        break;
      }
    }

    // hit player
    if (pr.life > 0 && player.deadTimer === 0 && aabb(player, pr)){
      killPlayer();
      pr.life = 0;
    }
  }
  bossProjectiles = bossProjectiles.filter(p => p.life > 0);
}

function updateBossWaves(){
  for (const w of bossWaves){
    w.x += w.vx;
    w.life--;

    // stop if hits a platform edge / ledge
    for (const s of platforms){
      // only treat as collision if wave overlaps platform body (not floor flush)
      if (aabb(w, s)){
        w.life = 0;
        break;
      }
    }

    if (w.life > 0 && player.deadTimer === 0 && aabb(player, w)){
      killPlayer();
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

function drawBossBar(){
  if (!boss || boss.hp <= 0) return;

  const pad = 14;
  const barW = 360;
  const barH = 16;
  const x = pad;
  const y = pad;

  const pct = boss.maxHp === 0 ? 0 : boss.hp / boss.maxHp;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#000";
  ctx.fillRect(x, y, barW, barH);
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = "#fff";
  ctx.fillRect(x+2, y+2, (barW-4)*clamp(pct, 0, 1), barH-4);

  ctx.fillStyle = "#fff";
  ctx.font = "12px ui-sans-serif, system-ui";
  ctx.fillText("BOSS", x, y + barH + 14);
}

function drawToast(){
  if (state.toast.t <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, canvas.height*0.10, canvas.width, 40);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = "#fff";
  ctx.font = "16px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.fillText(state.toast.text, canvas.width/2, canvas.height*0.10 + 26);
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);

  for (const p of platforms) drawTiledPlatform(p);

  // exit door (dim if locked)
  if (exitDoor){
    ctx.globalAlpha = exitDoor.locked ? 0.45 : 1.0;
    ctx.drawImage(images.exit, exitDoor.x, exitDoor.y, exitDoor.w, exitDoor.h);
    ctx.globalAlpha = 1.0;
  }

  // checkpoint
  if (checkpoint){
    ctx.globalAlpha = checkpoint.active ? 1.0 : 0.75;
    ctx.drawImage(images.checkpoint, checkpoint.x, checkpoint.y, checkpoint.w, checkpoint.h);
    ctx.globalAlpha = 1.0;
  }

  // pickups
  for (const p of pickups){
    if (p.taken) continue;
    const img = p.kind === "dash" ? images.dash : images.speed;
    ctx.drawImage(img, p.x, p.y, p.w, p.h);
  }

  // coins
  for (const c of coins){
    if (c.taken) continue;
    ctx.drawImage(images.coin, c.x, c.y, c.w, c.h);
  }

  // enemies
  for (const e of enemies){
    const img = e.type === "enemy1" ? images.enemy1 : images.enemy2;
    ctx.drawImage(img, e.x, e.y, e.w, e.h);
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

  // player projectiles (phone)
  for (const pr of projectiles){
    ctx.drawImage(images.phone, pr.x, pr.y, pr.w, pr.h);
  }

  // boss render
  if (boss && boss.hp > 0){
    const bImg = boss.type === "enemy2" ? images.enemy2 : images.enemy1;

    ctx.save();
    // blink while invulnerable
    if (boss.invuln > 0 && (boss.invuln % 4) < 2) ctx.globalAlpha = 0.55;

    // flip based on face
    if (boss.face < 0){
      ctx.translate(boss.x + boss.w, boss.y);
      ctx.scale(-1, 1);
      ctx.drawImage(bImg, 0, 0, boss.w, boss.h);
    } else {
      ctx.drawImage(bImg, boss.x, boss.y, boss.w, boss.h);
    }
    ctx.restore();
  }

  // player
  const pImg = images[`char_${selectedCharId}`];
  if (pImg){
    ctx.save();
    if (player.facing < 0){
      ctx.translate(player.x + player.w, player.y);
      ctx.scale(-1, 1);
      ctx.drawImage(pImg, 0, 0, player.w, player.h);
    } else {
      ctx.drawImage(pImg, player.x, player.y, player.w, player.h);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  // death flash
  if (player.deadTimer > 0){
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha = 1.0;
  }

  // Boss UI + Toast overlay
  drawBossBar();
  drawToast();
}

let last = performance.now();
function loop(now){
  const dt = (now - last) / 16.67;
  last = now;
  state.time += dt;

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
