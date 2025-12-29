/* Pixel Platformer - HTML Canvas
   - Playable: Gilly/Scott/Kevin/Nate
   - Enemies: Enemy1/Enemy2 patrol, can also be boss later
   - Exit door advances level
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

const KEYS = {
  left:false, right:false, jump:false, dash:false, throw:false
};
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
    ]
  },
  {
    name: "Circuit Steps",
    spawn: { x: 60, y: 380 },
    exit:  { x: 900, y: 170 },
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
    ]
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
  camera: { x: 0, y: 0 },
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

  enemies = L.enemies.map(e => ({...e, w: 40, h: 40, vx: 0.7 * (Math.random() > 0.5 ? 1 : -1) }));
  coins = L.coins.map(c => ({...c, w: 20, h: 20, taken: false}));
  pickups = L.pickups.map(p => ({...p, w: 26, h: 26, taken: false}));
  projectiles = [];
  exitDoor = { x: L.exit.x, y: L.exit.y, w: 44, h: 56 };
  checkpoint = { x: L.checkpoint.x, y: L.checkpoint.y, w: 28, h: 50, active:false };
  platforms = L.platforms.map(p => ({...p}));

  // Per-level: keep powerups you already collected (feel free to change later)
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
}

function startGame(){
  state.running = true;
  menuEl.classList.add("hidden");
  hudEl.classList.remove("hidden");
  state.levelIndex = 0;
  state.coins = 0;
  player.canDash = false;
  player.dashCooldown = 0;
  player.speedBoostTimer = 0;
  player.throwCooldown = 0;
  resetToLevel(0);
}

function nextLevel(){
  const next = state.levelIndex + 1;
  if (next >= LEVELS.length){
    // simple "win" loop back to start for now
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

  // dash cooldown
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

  // dash (requires pickup)
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
    if (p.kind === "speed") player.speedBoostTimer = 60 * 8; // 8 seconds @60fps-ish
  }

  // coins
  for (const c of coins){
    if (c.taken) continue;
    const box = { x:c.x, y:c.y, w:c.w, h:c.h };
    if (!aabb(player, box)) continue;
    c.taken = true;
    state.coins++;
  }

  // exit
  if (exitDoor && aabb(player, exitDoor)){
    nextLevel();
  }
}

function updateEnemies(){
  for (const e of enemies){
    // patrol
    e.x += e.vx;
    if (e.x < e.left){ e.x = e.left; e.vx = Math.abs(e.vx); }
    if (e.x > e.right){ e.x = e.right; e.vx = -Math.abs(e.vx); }

    // gravity on enemies (so they sit on platforms)
    e.vy = (e.vy ?? 0) + GRAVITY;
    const ent = { x:e.x, y:e.y, w:e.w, h:e.h, vx:0, vy:e.vy, onGround:false };
    moveAndCollide(ent, platforms);
    e.y = ent.y;
    e.vy = ent.vy;

    // collide with player
    if (player.deadTimer === 0 && aabb(player, e)){
      killPlayer();
    }
  }
  // remove dead enemies
  enemies = enemies.filter(e => e.hp > 0);
}

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
  }
  projectiles = projectiles.filter(p => p.life > 0);
}

function updateHUD(){
  hudCoins.textContent = String(state.coins);
  hudDash.textContent = player.canDash ? (player.dashCooldown === 0 ? "Ready" : "Cooling") : "No";
  hudSpeed.textContent = player.speedBoostTimer > 0 ? "Boosted" : "Normal";
  hudThrow.textContent = player.throwCooldown === 0 ? "Ready" : "Cooling";
}

// --- Rendering ---
function drawTiledPlatform(rect){
  const img = images.platform;
  const tileH = rect.h;
  // draw platform sprite scaled to height, tiled across width
  const scale = tileH / img.height;
  const tileW = img.width * scale;
  for (let x = rect.x; x < rect.x + rect.w; x += tileW){
    const w = Math.min(tileW, rect.x + rect.w - x);
    ctx.drawImage(img, 0, 0, img.width * (w / tileW), img.height, x, rect.y, w, tileH);
  }
}

function draw(){
  // background
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);

  // platforms
  for (const p of platforms){
    drawTiledPlatform(p);
  }

  // exit door
  if (exitDoor){
    ctx.drawImage(images.exit, exitDoor.x, exitDoor.y, exitDoor.w, exitDoor.h);
  }

  // checkpoint
  if (checkpoint){
    // slightly brighten if active
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
    // tiny hp bar
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#000";
    ctx.fillRect(e.x, e.y - 6, e.w, 4);
    ctx.fillStyle = "#fff";
    const hpw = clamp((e.hp / 4) * e.w, 0, e.w);
    ctx.fillRect(e.x, e.y - 6, hpw, 4);
    ctx.globalAlpha = 1.0;
  }

  // projectiles
  for (const pr of projectiles){
    ctx.drawImage(images.phone, pr.x, pr.y, pr.w, pr.h);
  }

  // player
  const pImg = images[`char_${selectedCharId}`];
  if (pImg){
    // flip based on facing
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
    // fallback
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
}

let last = performance.now();
function loop(now){
  const dt = (now - last) / 16.67;
  last = now;
  state.time += dt;

  if (state.running){
    updatePlayer();
    updateEnemies();
    updateProjectiles();
    updateHUD();
    draw();
  } else {
    // menu background preview
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
    // default selection highlight none until clicked
    requestAnimationFrame(loop);
  } catch (err){
    console.error(err);
    alert("Could not load images. Check the /assets filenames match exactly.");
  }
})();

