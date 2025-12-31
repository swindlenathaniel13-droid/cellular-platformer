// main.js (Phase 2: UI + main loop)
// Works on GitHub Pages without bundlers.
// IMPORTANT: all paths are RELATIVE ("./assets/...") to avoid GitHub Pages path issues.

const CONFIG = {
  VIEW_W: 1280,
  VIEW_H: 720,

  GRAVITY: 2400,
  MAX_DT: 0.033,          // clamp delta for stability (30fps worst-case)
  SUBSTEPS: 4,            // simple substep physics

  PLAYER_H: 84,
  PLAYER_SPEED: 320,
  PLAYER_ACCEL: 18,
  PLAYER_JUMP_V: 900,
  COYOTE_TIME: 0.10,      // jump grace
  JUMP_BUFFER: 0.10,      // press jump slightly early

  ENEMY_H: 82,
  ENEMY_SPEED: 140,
  ENEMY_AGGRO_X: 260,
  ENEMY_DROP_X: 140,
  ENEMY_DROP_MAX: 190,    // max allowed drop to chase

  PLATFORM_H: 60,
  WORLD_W: 2600,
  FLOOR_Y: 640,           // top of the main ground

  DOOR_H: 160,
  FLAG_H: 90,
  COIN_SIZE: 26,

  NEXT_STAGE_SECONDS: 6.0 // 5–10 seconds vibe
};

const ASSET_BASE = "./assets/";
const FILES = {
  bg: "Background_Pic.png",
  platform: "Platform.png",
  door: "Exit_Door.png",
  flag: "CheckpointFlag.png",
  coin: "Coin.png",
  enemy1: "Enemy1.png",
  enemy2: "Enemy2.png",
  dash: "Powerup_Dash.png",
  speed: "Powerup_Speedboost.png",
  phone: "powerup_homephone.png",
  nate: "Nate.png",
  kevin: "Kevin.png",
  scott: "Scott.png",
  gilly: "Gilly.png",
  edgar: "Edgar.png"
};

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

// HUD nodes
const hudLevel = $("hudLevel");
const hudCoins = $("hudCoins");
const hudDash = $("hudDash");
const hudSpeed = $("hudSpeed");
const hudThrow = $("hudThrow");
const hudHP = $("hudHP");

// Overlays
const bootOverlay = $("bootOverlay");
const bootBar = $("bootBar");
const bootText = $("bootText");
const bootWarn = $("bootWarn");
const bootStartBtn = $("bootStartBtn");

const charOverlay = $("charOverlay");
const charGrid = $("charGrid");
const charStartBtn = $("charStartBtn");

const pauseOverlay = $("pauseOverlay");
const pauseResumeBtn = $("pauseResumeBtn");
const pauseRestartBtn = $("pauseRestartBtn");
const pauseQuitBtn = $("pauseQuitBtn");

const confirmOverlay = $("confirmOverlay");
const confirmTitle = $("confirmTitle");
const confirmMsg = $("confirmMsg");
const confirmYesBtn = $("confirmYesBtn");
const confirmNoBtn = $("confirmNoBtn");

const stageOverlay = $("stageOverlay");
const rCoins = $("rCoins");
const rDmg = $("rDmg");
const rTime = $("rTime");
const stageContinueBtn = $("stageContinueBtn");

const shopOverlay = $("shopOverlay");
const shopKeeperImg = $("shopKeeperImg");
const shopCoins = $("shopCoins");
const shopList = $("shopList");
const shopDoneBtn = $("shopDoneBtn");

const nextOverlay = $("nextOverlay");
const nextBar = $("nextBar");
const nextText = $("nextText");

const tutorialBox = $("tutorialBox");
const tMove = $("tMove");
const tJump = $("tJump");
const tThrow = $("tThrow");

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }
function rand(a,b){ return a + Math.random()*(b-a); }

function aabb(ax,ay,aw,ah,bx,by,bw,bh){
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function drawImageScaled(img, x, y, w, h, flipX=false, alpha=1){
  if(!img) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  if(flipX){
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
  } else {
    ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
  }
  ctx.restore();
}

function show(el){ el.classList.add("overlay--show"); }
function hide(el){ el.classList.remove("overlay--show"); }

function nowSec(){ return performance.now()/1000; }

// -----------------------------------------------------------------------------
// Asset loading
// -----------------------------------------------------------------------------
async function loadAssets(files){
  const keys = Object.keys(files);
  const total = keys.length;
  const assets = {};
  let loaded = 0;
  const missing = [];

  function updateBoot(){
    const pct = Math.round((loaded/total)*100);
    bootBar.style.width = `${pct}%`;
    bootText.textContent = `${pct}%`;
  }

  await Promise.all(keys.map((k) => {
    const src = ASSET_BASE + files[k];
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        assets[k] = img;
        loaded++;
        updateBoot();
        resolve();
      };
      img.onerror = () => {
        missing.push(files[k]);
        loaded++;
        updateBoot();
        resolve();
      };
      img.src = src;
    });
  }));

  if(missing.length){
    bootWarn.style.display = "block";
    bootWarn.textContent =
      "Missing assets:\n" +
      missing.map(m => `- ${m}`).join("\n") +
      "\n\nFix filenames/case in /assets.";
  }

  return assets;
}

// -----------------------------------------------------------------------------
// Game state
// -----------------------------------------------------------------------------
const game = {
  mode: "boot", // boot, char, playing, paused, stage, shop, next
  assets: null,

  selectedCharKey: null,

  // Run progression
  level: 1,
  coins: 0,
  maxHP: 10,
  hp: 10,

  // Run-only upgrades (cleared on death or restart)
  upgrades: {
    dashUnlocked: false,
    speedBoost: 0,     // +0..2
    throwCooldown: 0.55
  },

  // Per-stage stats
  stageStartTime: 0,
  stageCoinsStart: 0,
  stageDmgTaken: 0,

  // Shop control
  shopUsedThisStage: false,

  // Tutorial
  tutorialDone: localStorage.getItem("cp_tutorialDone") === "1",
  tutorialProgress: { move:false, jump:false, throw:false },

  // World
  camX: 0,
  platforms: [],
  coinsArr: [],
  enemies: [],
  projectiles: [],
  door: null,
  flag: null,

  // Player
  player: null,

  // Transition
  nextT: 0,
  nextDur: CONFIG.NEXT_STAGE_SECONDS,

  // Confirm callback
  confirmYes: null
};

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------
const input = {
  left:false, right:false,
  jump:false, jumpPressed:false, jumpReleased:false,
  throwPressed:false,
  dashPressed:false,
  pausePressed:false
};

window.addEventListener("keydown", (e) => {
  if(e.repeat) return;

  if(e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
  if(e.code === "ArrowRight" || e.code === "KeyD") input.right = true;

  if(e.code === "Space"){
    input.jump = true;
    input.jumpPressed = true;
  }
  if(e.code === "KeyF"){
    input.throwPressed = true;
  }
  if(e.code === "ShiftLeft" || e.code === "ShiftRight"){
    input.dashPressed = true;
  }
  if(e.code === "Escape"){
    input.pausePressed = true;
  }
});

window.addEventListener("keyup", (e) => {
  if(e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
  if(e.code === "ArrowRight" || e.code === "KeyD") input.right = false;

  if(e.code === "Space"){
    input.jump = false;
    input.jumpReleased = true;
  }
});

// -----------------------------------------------------------------------------
// Entities
// -----------------------------------------------------------------------------
class Player {
  constructor(x,y,charImg){
    this.x=x; this.y=y;
    this.w = CONFIG.PLAYER_H * 0.72;
    this.h = CONFIG.PLAYER_H;
    this.vx=0; this.vy=0;
    this.face=1;

    this.onGround=false;
    this.coyote=0;
    this.jumpBuf=0;

    this.charImg = charImg;

    this.throwCd = 0;
    this.dashCd = 0;
    this.dashing = 0;

    this.animT = 0;
    this.flashT = 0;
  }

  hurt(dmg){
    game.hp = Math.max(0, game.hp - dmg);
    game.stageDmgTaken += dmg;
    this.flashT = 0.18;
    if(game.hp <= 0){
      dieToLevel1();
    }
  }

  update(dt){
    this.animT += dt;
    if(this.flashT>0) this.flashT = Math.max(0, this.flashT-dt);

    // timers
    if(this.throwCd>0) this.throwCd = Math.max(0, this.throwCd - dt);
    if(this.dashCd>0) this.dashCd = Math.max(0, this.dashCd - dt);
    if(this.dashing>0) this.dashing = Math.max(0, this.dashing - dt);

    // tutorial checks
    if(!game.tutorialDone){
      if(input.left || input.right) game.tutorialProgress.move = true;
      if(input.jumpPressed) game.tutorialProgress.jump = true;
      if(input.throwPressed) game.tutorialProgress.throw = true;

      tMove.checked = game.tutorialProgress.move;
      tJump.checked = game.tutorialProgress.jump;
      tThrow.checked = game.tutorialProgress.throw;

      const done = game.tutorialProgress.move && game.tutorialProgress.jump && game.tutorialProgress.throw;
      tutorialBox.style.display = done ? "none" : "block";
      if(done){
        game.tutorialDone = true;
        localStorage.setItem("cp_tutorialDone", "1");
      }
    }

    // movement
    const baseSpeed = CONFIG.PLAYER_SPEED + game.upgrades.speedBoost*40;
    const dir = (input.left?-1:0) + (input.right?1:0);
    if(dir !== 0) this.face = dir;

    const accel = CONFIG.PLAYER_ACCEL;
    const targetVx = dir * baseSpeed;

    this.vx = lerp(this.vx, targetVx, 1 - Math.pow(0.001, accel*dt));

    // gravity
    this.vy += CONFIG.GRAVITY * dt;

    // coyote/jump buffer
    if(this.onGround) this.coyote = CONFIG.COYOTE_TIME;
    else this.coyote = Math.max(0, this.coyote - dt);

    if(input.jumpPressed) this.jumpBuf = CONFIG.JUMP_BUFFER;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    if(this.jumpBuf > 0 && this.coyote > 0){
      this.vy = -CONFIG.PLAYER_JUMP_V;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
    }

    // variable jump height: releasing jump cuts upward velocity a bit
    if(input.jumpReleased && this.vy < 0){
      this.vy *= 0.55;
    }

    // dash (run-only unlock)
    if(input.dashPressed && game.upgrades.dashUnlocked && this.dashCd <= 0){
      this.dashing = 0.10;
      this.dashCd = 1.10;
      this.vx = this.face * (baseSpeed * 2.2);
    }

    // throw
    if(input.throwPressed && this.throwCd <= 0){
      spawnPlayerProjectile(this);
      this.throwCd = game.upgrades.throwCooldown;
    }

    // move + collide (substeps)
    this.onGround = false;
    const steps = CONFIG.SUBSTEPS;
    for(let i=0;i<steps;i++){
      const sdt = dt/steps;

      // horizontal
      this.x += this.vx * sdt;
      for(const p of game.platforms){
        if(!aabb(this.x,this.y,this.w,this.h,p.x,p.y,p.w,p.h)) continue;
        if(this.vx > 0){
          this.x = p.x - this.w;
        } else if(this.vx < 0){
          this.x = p.x + p.w;
        }
        this.vx = 0;
      }

      // vertical
      this.y += this.vy * sdt;
      for(const p of game.platforms){
        if(!aabb(this.x,this.y,this.w,this.h,p.x,p.y,p.w,p.h)) continue;

        if(this.vy > 0){
          // landing
          this.y = p.y - this.h;
          this.vy = 0;
          this.onGround = true;
        } else if(this.vy < 0){
          // head bump
          this.y = p.y + p.h;
          this.vy = 0;
        }
      }
    }

    // bounds
    this.x = clamp(this.x, 0, CONFIG.WORLD_W - this.w);

    // fell off world
    if(this.y > CONFIG.VIEW_H + 250){
      this.hurt(1); // counts as damage
      // quick reset position inside same level (keeps run alive)
      // if HP hits 0, dieToLevel1() already triggers.
      resetPlayerToSpawn();
    }
  }

  draw(){
    const img = this.charImg;
    const bob = (Math.abs(this.vx) > 5 && this.onGround) ? Math.sin(this.animT*18)*2 : Math.sin(this.animT*2)*1.2;
    const y = this.y + bob;

    const alpha = this.flashT>0 ? 0.35 : 1.0;
    drawImageScaled(img, this.x, y, this.w, this.h, this.face<0, alpha);
  }
}

class Enemy {
  constructor(x,y,type="enemy1",isBoss=false){
    this.x=x; this.y=y;
    this.type=type;
    this.isBoss=isBoss;

    this.h = isBoss ? (CONFIG.ENEMY_H*1.6) : CONFIG.ENEMY_H;
    this.w = this.h * 0.80;

    this.vx = (Math.random()<0.5?-1:1) * CONFIG.ENEMY_SPEED;
    this.vy = 0;
    this.onGround=false;

    this.face = this.vx>=0 ? 1 : -1;

    this.hp = isBoss ? 18 : 3;
    this.flashT = 0;
    this.animT = 0;

    // platform patrol memory
    this.homePlatform = null;
    this.idleT = rand(0.3, 1.4);
    this.state = "PATROL"; // PATROL, CHASE, IDLE
    this.attackCd = rand(0.8, 1.5);
  }

  hurt(dmg){
    this.hp -= dmg;
    this.flashT = 0.15;
    if(this.hp <= 0){
      // drop coins
      for(let i=0;i<(this.isBoss?10:3);i++){
        game.coinsArr.push({
          x: this.x + rand(-20,20),
          y: this.y + rand(-30,10),
          r: CONFIG.COIN_SIZE,
          vy: rand(-220,-80),
          vx: rand(-90,90),
          picked:false
        });
      }
      this.dead = true;
    }
  }

  update(dt){
    this.animT += dt;
    if(this.flashT>0) this.flashT = Math.max(0, this.flashT-dt);
    if(this.attackCd>0) this.attackCd = Math.max(0, this.attackCd-dt);

    // Basic AI: stay on platform, chase player if nearby. Only drop if player is below and drop is safe.
    const pl = game.player;

    // find platform under enemy (simple)
    this.homePlatform = findSupportingPlatform(this);

    const dx = (pl.x + pl.w/2) - (this.x + this.w/2);
    const adx = Math.abs(dx);
    const dy = (pl.y + pl.h/2) - (this.y + this.h/2);

    // idle variety
    this.idleT -= dt;
    if(this.idleT <= 0){
      this.idleT = rand(1.0, 2.6);
      this.state = (this.state === "IDLE") ? "PATROL" : "IDLE";
    }

    let desiredVx = this.vx;

    if(adx < CONFIG.ENEMY_AGGRO_X && Math.abs(dy) < 220){
      this.state = "CHASE";
    }

    if(this.state === "IDLE"){
      desiredVx = 0;
    } else if(this.state === "CHASE"){
      desiredVx = clamp(dx, -1, 1) * (CONFIG.ENEMY_SPEED * (this.isBoss?1.05:1));
    } else {
      // PATROL: keep moving
      desiredVx = this.vx;
    }

    // Edge-turning (only if on platform)
    if(this.homePlatform && this.onGround && this.state !== "CHASE"){
      const leftEdge = this.homePlatform.x + 6;
      const rightEdge = this.homePlatform.x + this.homePlatform.w - this.w - 6;
      if(this.x <= leftEdge){ desiredVx = Math.abs(desiredVx); }
      if(this.x >= rightEdge){ desiredVx = -Math.abs(desiredVx); }
    }

    // Drop logic: if player is below and close, allow falling off edge IF there is a platform below within drop max.
    if(this.homePlatform && this.onGround && dy > 60 && adx < CONFIG.ENEMY_DROP_X){
      const edgeX = (dx < 0) ? (this.homePlatform.x - 2) : (this.homePlatform.x + this.homePlatform.w - this.w + 2);
      const hasLanding = platformBelow(edgeX + this.w/2, this.y + this.h, CONFIG.ENEMY_DROP_MAX);
      if(hasLanding){
        // move toward edge and fall
        desiredVx = (dx<0 ? -1 : 1) * (CONFIG.ENEMY_SPEED*1.1);
      }
    }

    // boss ranged poke
    if(this.isBoss && adx < 520 && adx > 140 && this.attackCd <= 0){
      spawnEnemyProjectile(this);
      this.attackCd = 1.05;
    }

    // apply desired
    this.vx = desiredVx;
    if(this.vx !== 0) this.face = this.vx>=0 ? 1 : -1;

    // gravity
    this.vy += CONFIG.GRAVITY * dt;

    // move + collide
    this.onGround = false;
    const steps = CONFIG.SUBSTEPS;
    for(let i=0;i<steps;i++){
      const sdt = dt/steps;

      this.x += this.vx * sdt;
      for(const p of game.platforms){
        if(!aabb(this.x,this.y,this.w,this.h,p.x,p.y,p.w,p.h)) continue;
        if(this.vx > 0) this.x = p.x - this.w;
        else if(this.vx < 0) this.x = p.x + p.w;
        this.vx *= -1; // bounce/turn
      }

      this.y += this.vy * sdt;
      for(const p of game.platforms){
        if(!aabb(this.x,this.y,this.w,this.h,p.x,p.y,p.w,p.h)) continue;
        if(this.vy > 0){
          this.y = p.y - this.h;
          this.vy = 0;
          this.onGround = true;
        } else if(this.vy < 0){
          this.y = p.y + p.h;
          this.vy = 0;
        }
      }
    }

    // touch player
    if(aabb(this.x,this.y,this.w,this.h, pl.x,pl.y,pl.w,pl.h)){
      pl.hurt(1);
      // small knockback
      pl.vx = (dx>0?-1:1) * 260;
      pl.vy = -420;
    }
  }

  draw(){
    const img = (this.type === "enemy2") ? game.assets.enemy2 : game.assets.enemy1;
    const bob = Math.sin(this.animT*6) * 1.2;
    const alpha = this.flashT>0 ? 0.35 : 1.0;
    drawImageScaled(img, this.x, this.y + bob, this.w, this.h, this.face<0, alpha);
  }
}

function spawnPlayerProjectile(pl){
  const img = game.assets.phone;
  const size = 34;
  game.projectiles.push({
    from:"player",
    x: pl.x + pl.w/2,
    y: pl.y + pl.h*0.45,
    vx: pl.face * 760,
    vy: -60,
    r: size,
    t: 0,
    img
  });
}

function spawnEnemyProjectile(en){
  const img = game.assets.phone;
  const size = 30;
  const dir = (game.player.x + game.player.w/2) < (en.x + en.w/2) ? -1 : 1;
  game.projectiles.push({
    from:"enemy",
    x: en.x + en.w/2,
    y: en.y + en.h*0.40,
    vx: dir * 620,
    vy: -80,
    r: size,
    t: 0,
    img
  });
}

// -----------------------------------------------------------------------------
// World generation (reachable path, less “nonsense proc-gen”)
// -----------------------------------------------------------------------------
function buildLevel(level){
  game.platforms = [];
  game.coinsArr = [];
  game.enemies = [];
  game.projectiles = [];
  game.door = null;
  game.flag = null;

  // Ground
  game.platforms.push({ x:0, y:CONFIG.FLOOR_Y, w:CONFIG.WORLD_W, h:CONFIG.PLATFORM_H });

  // Stepping path
  const path = [];
  let x = 120;
  let y = CONFIG.FLOOR_Y - 140;

  const segments = clamp(5 + Math.floor(level*0.6), 5, 10);

  for(let i=0;i<segments;i++){
    const w = rand(240, 380);
    const dx = rand(170, 260);

    // dy kept within jump capability
    const dy = rand(-110, 110);
    y = clamp(y + dy, 130, CONFIG.FLOOR_Y - 120);

    path.push({ x, y, w, h:CONFIG.PLATFORM_H });
    x += w + dx;
    if(x > CONFIG.WORLD_W - 520) break;
  }

  // Ensure last platform near the right side for the exit
  const last = path[path.length-1] || { x: 900, y: CONFIG.FLOOR_Y - 160, w: 340, h: CONFIG.PLATFORM_H };
  const exitPlat = {
    x: clamp(CONFIG.WORLD_W - 520, last.x + 220, CONFIG.WORLD_W - 420),
    y: clamp(last.y + rand(-60,60), 160, CONFIG.FLOOR_Y - 140),
    w: 360,
    h: CONFIG.PLATFORM_H
  };
  path.push(exitPlat);

  // Add path platforms
  for(const p of path) game.platforms.push(p);

  // Add “challenge gaps” but keep doable: add a few short “floating” platforms between path segments
  for(let i=0;i<path.length-1;i++){
    if(Math.random() < 0.55 && level >= 2){
      const a = path[i], b = path[i+1];
      const midX = a.x + a.w + (b.x - (a.x+a.w))*0.45;
      const midY = clamp(lerp(a.y, b.y, 0.5) - rand(40,90), 140, CONFIG.FLOOR_Y - 200);
      game.platforms.push({ x: midX, y: midY, w: rand(140,220), h: CONFIG.PLATFORM_H });
    }
  }

  // Checkpoint flag mid-level (NOT hidden behind exit)
  const flagPlat = path[Math.floor(path.length*0.55)] || path[0];
  game.flag = {
    x: flagPlat.x + flagPlat.w*0.25,
    y: flagPlat.y - CONFIG.FLAG_H,
    h: CONFIG.FLAG_H
  };

  // Door on exit platform, anchored to platform top
  game.door = {
    x: exitPlat.x + exitPlat.w - 120,
    y: exitPlat.y - CONFIG.DOOR_H,
    h: CONFIG.DOOR_H,
    onPlat: exitPlat
  };

  // Coins: sprinkle along path + small arcs
  for(const p of path){
    const n = Math.floor(rand(3, 7));
    for(let i=0;i<n;i++){
      game.coinsArr.push({
        x: p.x + rand(20, p.w-20),
        y: p.y - rand(40, 90),
        r: CONFIG.COIN_SIZE,
        picked:false,
        vx:0, vy:0
      });
    }
  }

  // Enemies: spawn ON platforms (not in the air)
  const enemyCount = clamp(2 + Math.floor(level*0.7), 2, 7);
  const platsForEnemies = game.platforms.filter(p => p.y < CONFIG.FLOOR_Y); // avoid ground spam
  for(let i=0;i<enemyCount;i++){
    const p = platsForEnemies[Math.floor(rand(0, platsForEnemies.length))];
    if(!p) break;
    const ex = p.x + rand(30, p.w-60);
    const ey = p.y - CONFIG.ENEMY_H;
    const type = (Math.random()<0.35) ? "enemy2" : "enemy1";
    game.enemies.push(new Enemy(ex, ey, type, false));
  }

  // Boss every 5 levels (guarding exit area)
  if(level % 5 === 0){
    const bx = exitPlat.x + 60;
    const by = exitPlat.y - (CONFIG.ENEMY_H*1.6);
    game.enemies.push(new Enemy(bx, by, "enemy2", true));
  }

  // Player spawn: left ground
  if(!game.player){
    game.player = new Player(90, CONFIG.FLOOR_Y - CONFIG.PLAYER_H, getSelectedCharImage());
  } else {
    game.player.x = 90;
    game.player.y = CONFIG.FLOOR_Y - game.player.h;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.onGround = false;
  }

  // Stage stats start
  game.stageStartTime = nowSec();
  game.stageCoinsStart = game.coins;
  game.stageDmgTaken = 0;

  // camera
  game.camX = 0;

  // tutorial
  if(game.level === 1 && !game.tutorialDone){
    tutorialBox.style.display = "block";
    game.tutorialProgress = { move:false, jump:false, throw:false };
    tMove.checked = false; tJump.checked = false; tThrow.checked = false;
  } else {
    tutorialBox.style.display = "none";
  }

  updateHud();
}

function findSupportingPlatform(ent){
  // platform directly below within a small epsilon
  const footY = ent.y + ent.h + 2;
  const midX = ent.x + ent.w/2;
  for(const p of game.platforms){
    if(midX >= p.x && midX <= p.x+p.w){
      if(Math.abs(footY - p.y) < 8) return p;
    }
  }
  return null;
}

function platformBelow(x, y, maxDrop){
  const targetY = y + maxDrop;
  let best = null;
  for(const p of game.platforms){
    if(x >= p.x && x <= p.x+p.w){
      if(p.y >= y && p.y <= targetY){
        if(!best || p.y < best.y) best = p;
      }
    }
  }
  return best;
}

function resetPlayerToSpawn(){
  game.player.x = 90;
  game.player.y = CONFIG.FLOOR_Y - game.player.h;
  game.player.vx = 0;
  game.player.vy = 0;
}

function getSelectedCharImage(){
  const a = game.assets;
  const map = {
    nate: a.nate, kevin: a.kevin, scott: a.scott, gilly: a.gilly, edgar: a.edgar
  };
  return map[game.selectedCharKey] || a.nate;
}

// -----------------------------------------------------------------------------
// UI + Flow
// -----------------------------------------------------------------------------
function updateHud(){
  hudLevel.textContent = String(game.level);
  hudCoins.textContent = String(game.coins);

  hudDash.textContent = game.upgrades.dashUnlocked ? "Ready" : "Locked";
  hudSpeed.textContent = game.upgrades.speedBoost > 0 ? `Boost +${game.upgrades.speedBoost}` : "Normal";
  hudThrow.textContent = (game.player && game.player.throwCd <= 0) ? "Ready" : "Cooling";
  hudHP.textContent = `${game.hp}/${game.maxHP}`;
}

function openConfirm(title, msg, yesFn){
  confirmTitle.textContent = title;
  confirmMsg.textContent = msg;
  game.confirmYes = yesFn;
  show(confirmOverlay);
}

function closeConfirm(){
  hide(confirmOverlay);
  game.confirmYes = null;
}

confirmYesBtn.addEventListener("click", () => {
  const fn = game.confirmYes;
  closeConfirm();
  if(fn) fn();
});
confirmNoBtn.addEventListener("click", closeConfirm);

// Pause buttons
pauseResumeBtn.addEventListener("click", () => { resumeGame(); });
pauseQuitBtn.addEventListener("click", () => {
  openConfirm("QUIT RUN", "Quit to character select?\n(All run progress resets.)", () => {
    resetRunToCharSelect();
  });
});
pauseRestartBtn.addEventListener("click", () => {
  openConfirm("RESTART LEVEL", "Restart this level?\n(This clears run-only shop effects.)", () => {
    restartLevelClearRunUpgrades();
  });
});

function pauseGame(){
  if(game.mode !== "playing") return;
  game.mode = "paused";
  show(pauseOverlay);
}

function resumeGame(){
  if(game.mode !== "paused") return;
  game.mode = "playing";
  hide(pauseOverlay);
}

function resetRunToCharSelect(){
  // Hard reset run
  game.level = 1;
  game.coins = 0;
  game.maxHP = 10;
  game.hp = 10;
  game.upgrades = { dashUnlocked:false, speedBoost:0, throwCooldown:0.55 };
  game.shopUsedThisStage = false;
  game.player = null;
  updateHud();

  hide(pauseOverlay);
  hide(stageOverlay);
  hide(shopOverlay);
  hide(nextOverlay);

  game.mode = "char";
  show(charOverlay);
}

function restartLevelClearRunUpgrades(){
  // restart level, but clears run-only upgrades per your request
  game.coins = 0;
  game.maxHP = 10;
  game.hp = 10;
  game.upgrades = { dashUnlocked:false, speedBoost:0, throwCooldown:0.55 };
  game.shopUsedThisStage = false;

  hide(pauseOverlay);
  buildLevel(game.level);
  game.mode = "playing";
}

function dieToLevel1(){
  // Death always sends you back to level 1 (tutorial does NOT repeat)
  openConfirm("YOU DIED", "Back to Level 1?\n(Full HP. Run-only upgrades cleared.)", () => {
    game.level = 1;
    game.coins = 0;
    game.maxHP = 10;
    game.hp = 10;
    game.upgrades = { dashUnlocked:false, speedBoost:0, throwCooldown:0.55 };
    game.shopUsedThisStage = false;

    // tutorial does not repeat if already marked done
    buildLevel(game.level);
    game.mode = "playing";
  });
}

// -----------------------------------------------------------------------------
// Shop
// -----------------------------------------------------------------------------
function openShop(){
  game.mode = "shop";
  shopKeeperImg.src = ASSET_BASE + FILES.edgar; // Edgar runs the shop
  shopCoins.textContent = String(game.coins);
  shopList.innerHTML = "";

  const items = [
    {
      key:"dash",
      name:"UNLOCK DASH",
      desc:"Enables Shift dash (short burst).",
      cost: 12,
      canBuy: () => !game.upgrades.dashUnlocked,
      buy: () => { game.upgrades.dashUnlocked = true; }
    },
    {
      key:"spd",
      name:"SPEED BOOST",
      desc:"Move speed +40 (stack up to +2).",
      cost: 10,
      canBuy: () => game.upgrades.speedBoost < 2,
      buy: () => { game.upgrades.speedBoost += 1; }
    },
    {
      key:"hp",
      name:"+MAX HP",
      desc:"Increase max HP by +1 (and heal 1).",
      cost: 9,
      canBuy: () => game.maxHP < 15,
      buy: () => { game.maxHP += 1; game.hp = Math.min(game.maxHP, game.hp + 1); }
    },
    {
      key:"heal",
      name:"HEAL",
      desc:"Restore 3 HP (cannot exceed max).",
      cost: 7,
      canBuy: () => game.hp < game.maxHP,
      buy: () => { game.hp = Math.min(game.maxHP, game.hp + 3); }
    },
    {
      key:"throw",
      name:"FASTER THROW",
      desc:"Reduce throw cooldown a bit.",
      cost: 11,
      canBuy: () => game.upgrades.throwCooldown > 0.35,
      buy: () => { game.upgrades.throwCooldown = Math.max(0.35, game.upgrades.throwCooldown - 0.08); }
    }
  ];

  for(const it of items){
    const row = document.createElement("div");
    row.className = "shopItem";

    const left = document.createElement("div");
    left.className = "left";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = it.name;

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = it.desc;

    left.appendChild(name);
    left.appendChild(desc);

    const right = document.createElement("div");
    right.className = "right";

    const cost = document.createElement("div");
    cost.className = "cost";
    cost.textContent = `${it.cost} coins`;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "BUY";

    const refreshBtn = () => {
      const ok = it.canBuy() && game.coins >= it.cost;
      btn.disabled = !ok;
      if(!it.canBuy()) btn.textContent = "SOLD";
      else btn.textContent = "BUY";
    };

    btn.addEventListener("click", () => {
      if(game.coins < it.cost) return;
      if(!it.canBuy()) return;
      game.coins -= it.cost;
      it.buy();
      shopCoins.textContent = String(game.coins);
      updateHud();
      refreshBtn();
    });

    right.appendChild(cost);
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);

    shopList.appendChild(row);
    refreshBtn();
  }

  show(shopOverlay);
  updateHud();
}

shopDoneBtn.addEventListener("click", () => {
  hide(shopOverlay);
  startNextStageLoading();
});

// -----------------------------------------------------------------------------
// Stage complete + next stage
// -----------------------------------------------------------------------------
function stageComplete(){
  // compute results
  const time = nowSec() - game.stageStartTime;
  const coinsGained = game.coins - game.stageCoinsStart;

  rCoins.textContent = String(coinsGained);
  rDmg.textContent = String(game.stageDmgTaken);
  rTime.textContent = `${time.toFixed(1)}s`;

  game.mode = "stage";
  show(stageOverlay);
}

stageContinueBtn.addEventListener("click", () => {
  hide(stageOverlay);

  // Shop opens ONCE after each stage
  if(!game.shopUsedThisStage){
    game.shopUsedThisStage = true;
    openShop();
  } else {
    startNextStageLoading();
  }
});

function startNextStageLoading(){
  game.mode = "next";
  game.nextT = 0;
  nextBar.style.width = "0%";
  nextText.textContent = "0%";
  show(nextOverlay);
}

// -----------------------------------------------------------------------------
// Boot + Character Select
// -----------------------------------------------------------------------------
function buildCharSelect(){
  charGrid.innerHTML = "";

  const chars = [
    { key:"nate",  label:"Nate",  file: FILES.nate },
    { key:"kevin", label:"Kevin", file: FILES.kevin },
    { key:"scott", label:"Scott", file: FILES.scott },
    { key:"gilly", label:"Gilly", file: FILES.gilly },
    { key:"edgar", label:"Edgar", file: FILES.edgar } // now playable
  ];

  for(const c of chars){
    const btn = document.createElement("div");
    btn.className = "charBtn";
    btn.dataset.key = c.key;

    const img = document.createElement("img");
    img.src = ASSET_BASE + c.file;
    img.alt = c.label;

    const meta = document.createElement("div");
    meta.innerHTML = `<div style="font-family:'Press Start 2P', monospace; font-size:11px;">${c.label}</div>
                      <div class="small dim">Pick your fighter.</div>`;

    btn.appendChild(img);
    btn.appendChild(meta);

    btn.addEventListener("click", () => {
      game.selectedCharKey = c.key;
      for(const el of charGrid.querySelectorAll(".charBtn")) el.classList.remove("active");
      btn.classList.add("active");
      charStartBtn.disabled = false;
    });

    charGrid.appendChild(btn);
  }

  charStartBtn.disabled = true;
}

charStartBtn.addEventListener("click", () => {
  hide(charOverlay);
  // start run
  game.level = 1;
  game.coins = 0;
  game.maxHP = 10;
  game.hp = 10;
  game.upgrades = { dashUnlocked:false, speedBoost:0, throwCooldown:0.55 };
  game.shopUsedThisStage = false;
  game.player = null;

  buildLevel(game.level);
  game.mode = "playing";
});

// -----------------------------------------------------------------------------
// Main update + render
// -----------------------------------------------------------------------------
function update(dt){
  if(game.mode === "playing"){
    game.player.update(dt);

    // enemies
    for(const e of game.enemies) e.update(dt);
    game.enemies = game.enemies.filter(e => !e.dead);

    // coins physics + pickup
    for(const c of game.coinsArr){
      if(c.picked) continue;
      if(c.vy){
        c.vy += CONFIG.GRAVITY * dt * 0.35;
        c.x += (c.vx||0) * dt;
        c.y += c.vy * dt;
        // simple ground catch
        for(const p of game.platforms){
          if(aabb(c.x-8,c.y-8,16,16,p.x,p.y,p.w,p.h)){
            c.y = p.y - 10;
            c.vy = 0;
            c.vx = 0;
          }
        }
      }

      if(aabb(game.player.x, game.player.y, game.player.w, game.player.h, c.x-12, c.y-12, 24,24)){
        c.picked = true;
        game.coins += 1;
      }
    }

    // projectiles
    for(const pr of game.projectiles){
      pr.t += dt;
      pr.vy += CONFIG.GRAVITY * dt * 0.25;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      // hit world
      for(const p of game.platforms){
        if(aabb(pr.x-10, pr.y-10, 20,20, p.x,p.y,p.w,p.h)){
          pr.dead = true;
        }
      }

      // hit enemies or player
      if(pr.from === "player"){
        for(const e of game.enemies){
          if(aabb(pr.x-12, pr.y-12, 24,24, e.x,e.y,e.w,e.h)){
            e.hurt(1);
            pr.dead = true;
            break;
          }
        }
      } else {
        const pl = game.player;
        if(aabb(pr.x-12, pr.y-12, 24,24, pl.x,pl.y,pl.w,pl.h)){
          pl.hurt(1);
          pr.dead = true;
        }
      }

      if(pr.t > 2.0) pr.dead = true;
    }
    game.projectiles = game.projectiles.filter(p => !p.dead);

    // Door reach check (exit always “on platform”)
    if(game.door){
      const d = game.door;
      const reach = aabb(game.player.x,game.player.y,game.player.w,game.player.h, d.x, d.y, 70, d.h);
      const bossAlive = game.enemies.some(e => e.isBoss);
      if(reach && !bossAlive){
        stageComplete();
      }
    }

    // camera follow
    game.camX = clamp((game.player.x + game.player.w/2) - CONFIG.VIEW_W/2, 0, CONFIG.WORLD_W - CONFIG.VIEW_W);

    updateHud();
  }

  // paused: nothing updates

  if(game.mode === "next"){
    game.nextT += dt;
    const pct = clamp(game.nextT / game.nextDur, 0, 1);
    nextBar.style.width = `${Math.round(pct*100)}%`;
    nextText.textContent = `${Math.round(pct*100)}%`;

    if(pct >= 1){
      hide(nextOverlay);
      // advance stage
      game.level += 1;
      game.shopUsedThisStage = false;
      buildLevel(game.level);
      game.mode = "playing";
    }
  }

  // handle pause key
  if(input.pausePressed){
    input.pausePressed = false;
    if(game.mode === "playing") pauseGame();
    else if(game.mode === "paused") resumeGame();
  }

  // clear one-frame inputs
  input.jumpPressed = false;
  input.jumpReleased = false;
  input.throwPressed = false;
  input.dashPressed = false;
}

function render(){
  // Clear
  ctx.clearRect(0,0,CONFIG.VIEW_W,CONFIG.VIEW_H);

  if(!game.assets){
    // boot state: just black
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,CONFIG.VIEW_W,CONFIG.VIEW_H);
    return;
  }

  const camX = game.camX;

  // Background parallax
  const bg = game.assets.bg;
  if(bg){
    const parX = -camX * 0.25;
    // draw 2 copies to cover width
    const scale = CONFIG.VIEW_H / bg.height;
    const w = bg.width * scale;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(bg, parX % w, 0, w, CONFIG.VIEW_H);
    ctx.drawImage(bg, (parX % w) + w, 0, w, CONFIG.VIEW_H);
    ctx.restore();
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,CONFIG.VIEW_W,CONFIG.VIEW_H);
  }

  ctx.save();
  ctx.translate(-camX, 0);

  // Platforms
  const platImg = game.assets.platform;
  for(const p of game.platforms){
    // stretch the platform art to platform rect (simple + stable)
    drawImageScaled(platImg, p.x, p.y, p.w, p.h, false, 1);
  }

  // Flag
  if(game.flag){
    const img = game.assets.flag;
    const h = game.flag.h;
    const w = h * (img ? (img.width/img.height) : 0.6);
    drawImageScaled(img, game.flag.x, game.flag.y, w, h);
  }

  // Door (anchored to its platform top)
  if(game.door){
    const img = game.assets.door;
    const h = game.door.h;
    const w = h * (img ? (img.width/img.height) : 0.4);
    drawImageScaled(img, game.door.x, game.door.y, w, h);
  }

  // Coins
  const coinImg = game.assets.coin;
  for(const c of game.coinsArr){
    if(c.picked) continue;
    drawImageScaled(coinImg, c.x - CONFIG.COIN_SIZE/2, c.y - CONFIG.COIN_SIZE/2, CONFIG.COIN_SIZE, CONFIG.COIN_SIZE);
  }

  // Enemies
  for(const e of game.enemies) e.draw();

  // Player
  if(game.player) game.player.draw();

  // Projectiles
  for(const pr of game.projectiles){
    const s = pr.r;
    const rot = pr.t * 12;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(rot);
    drawImageScaled(pr.img, -s/2, -s/2, s, s);
    ctx.restore();
  }

  ctx.restore();
}

let lastT = performance.now();
function loop(){
  const t = performance.now();
  let dt = (t - lastT) / 1000;
  lastT = t;
  dt = clamp(dt, 0, CONFIG.MAX_DT);

  update(dt);
  render();

  requestAnimationFrame(loop);
}

// -----------------------------------------------------------------------------
// Boot sequence
// -----------------------------------------------------------------------------
function startBoot(){
  game.mode = "boot";
  show(bootOverlay);
  hide(charOverlay);
  hide(pauseOverlay);
  hide(stageOverlay);
  hide(shopOverlay);
  hide(nextOverlay);
  hide(confirmOverlay);

  bootStartBtn.disabled = true;

  // If JS errors, show them in the boot warning area
  window.addEventListener("error", (e) => {
    bootWarn.style.display = "block";
    bootWarn.textContent = `JS Error:\n${e.message}`;
  });

  loadAssets(FILES).then((assets) => {
    game.assets = assets;
    bootText.textContent = "Assets loaded.";
    bootBar.style.width = "100%";
    bootStartBtn.disabled = false;
  });
}

bootStartBtn.addEventListener("click", () => {
  hide(bootOverlay);
  game.mode = "char";
  buildCharSelect();
  show(charOverlay);
});

// Start
startBoot();
requestAnimationFrame(loop);
