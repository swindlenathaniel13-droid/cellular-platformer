(() => {
  "use strict";

  // ---------------- DOM ----------------
  const $ = (id) => document.getElementById(id);

  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // Boot overlay
  const bootOverlay = $("bootOverlay");
  const bootFill = $("bootFill");
  const bootPct = $("bootPct");
  const bootSub = $("bootSub");

  const menuEl = $("menu");
  const charGridEl = $("charGrid");
  const btnStart = $("btnStart");

  const hudStage = $("hudStage");
  const hudCoins = $("hudCoins");
  const hudDash = $("hudDash");
  const hudSpeed = $("hudSpeed");
  const hudThrow = $("hudThrow");

  const hpBlocksEl = $("hpBlocks");

  const tutorialBox = $("tutorialBox");
  const tutMove = $("tutMove");
  const tutJump = $("tutJump");
  const tutThrow = $("tutThrow");

  const pauseOverlay = $("pauseOverlay");
  const btnResume = $("btnResume");
  const btnRestart = $("btnRestart");
  const btnBackMenu = $("btnBackMenu");

  const stageClearOverlay = $("stageClearOverlay");
  const stageClearTitle = $("stageClearTitle");
  const stageClearSub = $("stageClearSub");
  const btnShop = $("btnShop");
  const btnNextStage = $("btnNextStage");
  const btnClearRestart = $("btnClearRestart");

  const shopOverlay = $("shopOverlay");
  const shopkeeperImg = $("shopkeeperImg");
  const shopCoinsEl = $("shopCoins");
  const shopList = $("shopList");
  const btnShopBack = $("btnShopBack");

  const loadingOverlay = $("loadingOverlay");
  const loadingFill = $("loadingFill");

  // ---------------- Utils ----------------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------------- Input ----------------
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    if (e.code === "Escape") togglePause();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  const down = (code) => keys.has(code);

  // ---------------- RNG ----------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------- Assets ----------------
  const ASSET_BASE = "assets/";

  const FILES = {
    Background: "Background_Pic.png",
    Platform: "Platform.png",
    Exit: "Exit_Door.png",
    Coin: "Coin.png",
    Enemy1: "Enemy1.png",
    Enemy2: "Enemy2.png",
    Weapon: "powerup_homephone.png",
    Dash: "Powerup_Dash.png",
    Speed: "Powerup_Speedboost.png",

    Gilly: "Gilly.png",
    Scott: "Scott.png",
    Kevin: "Kevin.png",
    Nate: "Nate.png",
    Edgar: "Edgar.png",
  };

  const imgs = {};

  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Failed to load: " + path));
      im.src = path;
    });
  }

  async function loadAllAssets(onProgress) {
    const entries = Object.entries(FILES);
    const total = entries.length;
    let loaded = 0;

    const tasks = entries.map(async ([k, file]) => {
      const im = await loadImage(ASSET_BASE + file);
      imgs[k] = im;
      loaded++;
      if (onProgress) onProgress(loaded, total, k);
    });

    await Promise.all(tasks);
    shopkeeperImg.src = imgs.Edgar.src;
  }

  // ---------------- Game constants ----------------
  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;

  const PLATFORM_H = 42;
  const GROUND_Y = 640;

  // ✅ TUNED so sprites match platforms + can fit under platforms
  const DRAW = {
    playerScale: 1.70,
    enemyScale: 1.65,
    exitScale: 2.05,
    coinScale: 1.30,
    weaponScale: 1.25,

    playerFootPad: 4,
    enemyFootPad: 4,
    exitFootPad: 4,
  };

  // ✅ Slightly stronger jump to reach higher tutorial platforms
  const PHYS = {
    gravity: 2400,
    accel: 3400,
    maxSpeed: 420,
    jump: 1040,
    friction: 0.82,
  };

  // ---------------- State ----------------
  const GAME = {
    mode: "menu",
    stage: 1,
    coins: 0,

    dashUnlocked: false,
    speedUnlocked: false,
    shopUsedThisStage: false,

    worldW: 2600,
    camX: 0,

    platforms: [],
    pickups: [],
    enemies: [],
    projectiles: [],

    exit: null,
    exitLocked: false,

    loadingT: 0,
    loadingDur: 8.0,
    pendingStage: null,

    tutorial: { move: false, jump: false, throw: false },
  };

  // ✅ Collider is what matters for fitting under platforms + landing
  // (Sprite is scaled separately)
  const player = {
    char: "Nate",
    x: 120,
    y: GROUND_Y - 62,

    // collider size
    w: 40,
    h: 62,

    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,

    hp: 8,
    maxHp: 8,
    invuln: 0,

    dashCd: 0,
    throwCd: 0,

    // animation helpers
    landedT: 0,
  };

  function resetPlayer(x, y) {
    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.facing = 1;
    player.hp = player.maxHp;
    player.invuln = 0;
    player.dashCd = 0;
    player.throwCd = 0;
    player.landedT = 0;
  }

  function makeEnemy(type, x, y, isBoss = false, platformRef = null) {
    const is2 = type === "enemy2";
    const e = {
      type,
      x,
      y,

      // ✅ slightly smaller collider so enemies "sit" on platforms better
      w: is2 ? 48 : 44,
      h: is2 ? 70 : 64,

      vx: 0,
      vy: 0,
      onGround: false,
      facing: -1,

      speed: is2 ? 165 : 150,
      hp: is2 ? 6 : 4,
      maxHp: is2 ? 6 : 4,
      damage: 1,

      platform: platformRef,
      patrolMin: x - 140,
      patrolMax: x + 140,

      isBoss,
      aiT: 0,
      jumpCd: 0,

      // animation helper
      bobSeed: (x * 0.013) % 10,
    };

    if (isBoss) {
      e.hp = is2 ? 14 : 10;
      e.maxHp = e.hp;
      e.speed += 40;
      e.damage = 2;
    }

    return e;
  }

  // ---------------- Collision ----------------
  function resolvePlatformCollisions(ent, dt) {
    ent.onGround = false;

    // X
    ent.x += ent.vx * dt;
    for (const p of GAME.platforms) {
      if (rectsOverlap(ent, p)) {
        if (ent.vx > 0) ent.x = p.x - ent.w;
        else if (ent.vx < 0) ent.x = p.x + p.w;
        ent.vx = 0;
      }
    }

    // Y
    ent.y += ent.vy * dt;
    for (const p of GAME.platforms) {
      if (rectsOverlap(ent, p)) {
        if (ent.vy > 0) {
          ent.y = p.y - ent.h;
          ent.vy = 0;
          ent.onGround = true;
        } else if (ent.vy < 0) {
          // ✅ BUGFIX: was ent.ent (typo) — this can break "head hits platform"
          ent.y = p.y + p.h;
          ent.vy = 0;
        }
      }
    }

    ent.x = clamp(ent.x, -200, GAME.worldW - ent.w + 200);
    ent.y = clamp(ent.y, -1200, VIEW_H + 600);
  }

  function willStepOff(ent, dir) {
    const aheadX = ent.x + ent.w / 2 + dir * (ent.w / 2 + 8);
    const probe = { x: aheadX, y: ent.y + ent.h + 2, w: 2, h: 10 };
    for (const p of GAME.platforms) {
      if (rectsOverlap(probe, p)) return false;
    }
    return true;
  }

  // ---------------- Drawing ----------------
  function drawBackground() {
    const im = imgs.Background;
    const scale = VIEW_H / im.height;
    const tileW = im.width * scale;

    const par = 0.18;
    const x0 = -((GAME.camX * par) % tileW);

    for (let x = x0; x < VIEW_W + tileW; x += tileW) {
      ctx.drawImage(im, x, 0, tileW, VIEW_H);
    }
  }

  function drawPlatform(p) {
    const im = imgs.Platform;
    const scale = PLATFORM_H / im.height;
    const tileW = im.width * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, PLATFORM_H);
    ctx.clip();

    for (let x = p.x; x < p.x + p.w; x += tileW) {
      ctx.drawImage(im, x, p.y, tileW, PLATFORM_H);
    }
    ctx.restore();
  }

  // ✅ Sprite draw helper with: scaling, flip, rotation, bob, squash/stretch
  function drawSprite(im, ent, scale, footPad, opts = {}) {
    const {
      flip = false,
      rot = 0,
      bobY = 0,
      sx = 1,
      sy = 1,
      alpha = 1,
    } = opts;

    const dw = ent.w * scale * sx;
    const dh = ent.h * scale * sy;

    const cx = ent.x + ent.w / 2;
    const baseY = (ent.y + ent.h) - dh + footPad + bobY;

    ctx.save();
    ctx.globalAlpha = alpha;

    // move to center of sprite
    ctx.translate(cx, baseY + dh / 2);

    // rotation + flip
    ctx.rotate(rot);
    ctx.scale(flip ? -1 : 1, 1);

    // draw centered
    ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);

    ctx.restore();
  }

  function drawCoin(c, t) {
    // fake "spin": squeeze width in/out
    const spin = 0.55 + 0.45 * Math.sin(t * 8 + c.x * 0.02);
    const dw = c.w * DRAW.coinScale * spin;
    const dh = c.h * DRAW.coinScale;

    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.drawImage(imgs.Coin, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function drawExit(ex, t) {
    const shimmer = 0.85 + 0.15 * Math.sin(t * 3);
    drawSprite(imgs.Exit, ex, DRAW.exitScale, DRAW.exitFootPad, { alpha: shimmer });
  }

  function drawHPBlocks(ent) {
    const blocks = ent.maxHp;
    const filled = clamp(ent.hp, 0, ent.maxHp);
    const bw = 10, bh = 6, gap = 2;
    const total = blocks * (bw + gap) - gap;
    const x = ent.x + ent.w / 2 - total / 2;
    const y = ent.y - 16;

    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(x - 3, y - 3, total + 6, bh + 6);

    for (let i = 0; i < blocks; i++) {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(x + i * (bw + gap), y, bw, bh);
      ctx.fillStyle = "rgba(0,0,0,.95)";
      ctx.fillRect(x + i * (bw + gap) + 1, y + 1, bw - 2, bh - 2);
      if (i < filled) {
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.fillRect(x + i * (bw + gap) + 2, y + 2, bw - 4, bh - 4);
      }
    }
  }

  function updatePlayerHpHud() {
    hpBlocksEl.innerHTML = "";
    for (let i = 0; i < player.maxHp; i++) {
      const d = document.createElement("div");
      d.className = "hp-block" + (i < player.hp ? " filled" : "");
      hpBlocksEl.appendChild(d);
    }
  }

  // ---------------- Stage building ----------------
  function clearWorld() {
    GAME.platforms.length = 0;
    GAME.pickups.length = 0;
    GAME.enemies.length = 0;
    GAME.projectiles.length = 0;
    GAME.exit = null;
    GAME.exitLocked = false;
  }

  function addGround(worldW) {
    GAME.platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: PLATFORM_H });
  }

  function setTutorialChecks() {
    tutMove.classList.toggle("done", GAME.tutorial.move);
    tutJump.classList.toggle("done", GAME.tutorial.jump);
    tutThrow.classList.toggle("done", GAME.tutorial.throw);

    if (GAME.tutorial.move && GAME.tutorial.jump && GAME.tutorial.throw) {
      tutorialBox.classList.add("hidden");
    }
  }

  // ✅ Raised platforms so you can CLEARLY fit under them with new sizing
  function stage1Tutorial() {
    clearWorld();
    GAME.worldW = 2600;

    addGround(GAME.worldW);

    const p1 = { x: 420, y: 480, w: 360, h: PLATFORM_H };
    const p2 = { x: 860, y: 390, w: 360, h: PLATFORM_H };
    const p3 = { x: 1320, y: 480, w: 360, h: PLATFORM_H };
    GAME.platforms.push(p1, p2, p3);

    for (let i = 0; i < 7; i++) {
      GAME.pickups.push({
        kind: "coin",
        x: 480 + i * 120,
        y: 430 - (i % 2) * 38,
        w: 24,
        h: 24,
        value: 1,
      });
    }

    const e = makeEnemy("enemy1", p2.x + 140, p2.y - 70, false, p2);
    e.y = p2.y - e.h;
    e.patrolMin = p2.x + 10;
    e.patrolMax = p2.x + p2.w - e.w - 10;
    GAME.enemies.push(e);

    // exit reachable
    GAME.exit = { x: GAME.worldW - 220, y: GROUND_Y - 140, w: 84, h: 140 };

    resetPlayer(120, GROUND_Y - player.h);

    GAME.tutorial = { move: false, jump: false, throw: false };
    tutorialBox.classList.remove("hidden");
    setTutorialChecks();
  }

  function stage2BossArena() {
    clearWorld();
    GAME.worldW = 2400;

    addGround(GAME.worldW);

    const p1 = { x: 520, y: 480, w: 380, h: PLATFORM_H };
    const p2 = { x: 980, y: 390, w: 380, h: PLATFORM_H };
    const p3 = { x: 1440, y: 480, w: 380, h: PLATFORM_H };
    GAME.platforms.push(p1, p2, p3);

    const boss = makeEnemy("enemy2", 1600, GROUND_Y - 76, true, null);
    boss.y = GROUND_Y - boss.h;
    boss.patrolMin = 1200;
    boss.patrolMax = 2000;
    GAME.enemies.push(boss);

    GAME.exitLocked = true;
    GAME.exit = { x: GAME.worldW - 220, y: GROUND_Y - 140, w: 84, h: 140 };

    resetPlayer(160, GROUND_Y - player.h);
    tutorialBox.classList.add("hidden");
  }

  // Procedural kept (but clamped so platforms don't get too low)
  function generateProcedural(stageNum) {
    clearWorld();

    const seed = (stageNum * 9973) ^ 0xA5A5A5A5;
    const rng = mulberry32(seed);

    GAME.worldW = 2600 + Math.min(1200, stageNum * 220);
    addGround(GAME.worldW);

    GAME.exit = { x: GAME.worldW - 220, y: GROUND_Y - 140, w: 84, h: 140 };
    GAME.exitLocked = false;

    let x = 420;
    let y = 480;

    const islandCount = 6 + Math.min(7, stageNum);
    const madePlatforms = [];

    for (let i = 0; i < islandCount; i++) {
      const w = 320 + Math.floor(rng() * 220);
      const dx = 220 + Math.floor(rng() * 160);
      const dy = -80 + Math.floor(rng() * 160);

      x += dx;

      // ✅ prevents "too low, can't run under" platforms
      y = clamp(y + dy, 300, 500);

      if (x + w > GAME.worldW - 380) break;

      const plat = { x, y, w, h: PLATFORM_H };
      GAME.platforms.push(plat);
      madePlatforms.push(plat);

      const coinN = 2 + Math.floor(rng() * 4);
      for (let c = 0; c < coinN; c++) {
        GAME.pickups.push({ kind: "coin", x: x + 40 + c * 90, y: y - 46, w: 24, h: 24, value: 1 });
      }

      if (rng() < 0.65) {
        const t = rng() < 0.55 ? "enemy1" : "enemy2";
        const e = makeEnemy(t, x + 90, y, false, plat);
        e.y = plat.y - e.h;
        e.patrolMin = x + 10;
        e.patrolMax = x + w - e.w - 10;
        GAME.enemies.push(e);
      }
    }

    if (madePlatforms.length === 0) {
      const plat = { x: 720, y: 480, w: 520, h: PLATFORM_H };
      GAME.platforms.push(plat);
      const e = makeEnemy("enemy1", plat.x + 120, plat.y, false, plat);
      e.y = plat.y - e.h;
      e.patrolMin = plat.x + 10;
      e.patrolMax = plat.x + plat.w - e.w - 10;
      GAME.enemies.push(e);
    }

    resetPlayer(120, GROUND_Y - player.h);
    tutorialBox.classList.add("hidden");
  }

  function hideAllOverlays() {
    pauseOverlay.classList.add("hidden");
    stageClearOverlay.classList.add("hidden");
    shopOverlay.classList.add("hidden");
    loadingOverlay.classList.add("hidden");
  }

  function loadStage(n) {
    GAME.stage = n;
    GAME.shopUsedThisStage = false;

    if (n === 1) stage1Tutorial();
    else if (n === 2) stage2BossArena();
    else generateProcedural(n);

    GAME.mode = "play";
    hideAllOverlays();
    menuEl.classList.add("hidden");

    GAME.camX = 0;
    updateHud();
    updatePlayerHpHud();
  }

  // ---------------- Shop ----------------
  const SHOP_ITEMS = [
    { id: "dash", name: "Unlock Dash", desc: "Press Shift to dash forward (short burst).", cost: 10, canBuy: () => !GAME.dashUnlocked, buy: () => (GAME.dashUnlocked = true) },
    { id: "speed", name: "Unlock Speedboost", desc: "Move faster permanently.", cost: 12, canBuy: () => !GAME.speedUnlocked, buy: () => (GAME.speedUnlocked = true) },
    { id: "hp", name: "+1 Max HP", desc: "Increases max HP by 1 (up to 12).", cost: 15, canBuy: () => player.maxHp < 12, buy: () => { player.maxHp += 1; player.hp = player.maxHp; } },
    { id: "heal", name: "Heal to Full", desc: "Restore HP to max.", cost: 6, canBuy: () => player.hp < player.maxHp, buy: () => { player.hp = player.maxHp; } },
  ];

  function renderShop() {
    shopCoinsEl.textContent = String(GAME.coins);
    shopList.innerHTML = "";

    for (const item of SHOP_ITEMS) {
      const wrap = document.createElement("div");
      wrap.className = "shop-item";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = item.name;

      const desc = document.createElement("div");
      desc.className = "desc";
      desc.textContent = item.desc;

      const meta = document.createElement("div");
      meta.className = "meta";

      const price = document.createElement("div");
      price.className = "mono";
      price.textContent = `Cost: ${item.cost}`;

      const btn = document.createElement("button");
      btn.className = "btn-solid";
      const canBuy = item.canBuy();
      btn.disabled = !canBuy || GAME.coins < item.cost;
      btn.textContent = canBuy ? (GAME.coins < item.cost ? "Need coins" : "Buy") : "Owned";

      btn.onclick = () => {
        if (btn.disabled) return;
        GAME.coins -= item.cost;
        item.buy();
        renderShop();
        updateHud();
        updatePlayerHpHud();
      };

      meta.appendChild(price);
      meta.appendChild(btn);

      wrap.appendChild(name);
      wrap.appendChild(desc);
      wrap.appendChild(meta);

      shopList.appendChild(wrap);
    }
  }

  function openStageClear() {
    GAME.mode = "stageclear";
    stageClearTitle.textContent = `STAGE ${GAME.stage} CLEARED`;
    stageClearSub.textContent = GAME.shopUsedThisStage ? "Shop already used this stage." : "Shop available once (after clearing).";
    stageClearOverlay.classList.remove("hidden");
  }

  function openShop() {
    if (GAME.shopUsedThisStage) return;
    GAME.mode = "shop";
    shopOverlay.classList.remove("hidden");
    renderShop();
  }

  function closeShopBackToClear() {
    shopOverlay.classList.add("hidden");
    GAME.shopUsedThisStage = true;
    openStageClear();
  }

  function startLoadingNextStage(nextStage) {
    GAME.mode = "loading";
    loadingOverlay.classList.remove("hidden");
    GAME.loadingT = 0;
    GAME.pendingStage = nextStage;
    loadingFill.style.width = "0%";
  }

  // ---------------- Projectiles / Damage ----------------
  function throwWeapon() {
    if (player.throwCd > 0) return;
    player.throwCd = 0.35;

    GAME.projectiles.push({
      x: player.x + player.w / 2 + player.facing * 22,
      y: player.y + 18,
      w: 22,
      h: 22,
      vx: player.facing * 780,
      vy: -220,
      life: 1.6,
      dmg: 2,
    });

    if (GAME.stage === 1 && !GAME.tutorial.throw) {
      GAME.tutorial.throw = true;
      setTutorialChecks();
    }
  }

  function hurtPlayer(amount) {
    if (player.invuln > 0) return;
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = 0.6;
    updatePlayerHpHud();

    if (player.hp <= 0) {
      loadStage(GAME.stage);
    }
  }

  // ---------------- Enemy AI (platform-first) ----------------
  function enemyThink(e, dt) {
    const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
    const absDx = Math.abs(dx);
    const dir = dx < 0 ? -1 : 1;

    const playerFeet = player.y + player.h;
    const enemyFeet = e.y + e.h;

    const sameLane = Math.abs(playerFeet - enemyFeet) < 30;
    const playerBelowEnemy = (playerFeet > enemyFeet + 40);

    let wantsChase = absDx < 320 && (sameLane || playerBelowEnemy);
    if (e.isBoss && absDx < 520) wantsChase = true;

    // anchored platform behavior
    if (e.platform) {
      e.x = clamp(e.x, e.platform.x + 6, e.platform.x + e.platform.w - e.w - 6);

      // drop ONLY if player below + close
      if (wantsChase && playerBelowEnemy && absDx < 260) {
        const edge = 10;
        const atLeft = e.x <= e.platform.x + edge;
        const atRight = e.x >= e.platform.x + e.platform.w - e.w - edge;

        e.facing = dir;
        e.vx = dir * e.speed * 0.85;

        if ((dir < 0 && atLeft) || (dir > 0 && atRight)) {
          e.platform = null;
          e.patrolMin = e.x - 180;
          e.patrolMax = e.x + 180;
        }
        return;
      }

      if (wantsChase && sameLane) {
        if (!willStepOff(e, dir)) {
          e.vx = dir * e.speed;
          e.facing = dir;
        } else {
          e.vx *= 0.15;
        }
      } else {
        if (e.x < e.patrolMin) e.facing = 1;
        if (e.x > e.patrolMax) e.facing = -1;

        if (!willStepOff(e, e.facing)) e.vx = e.facing * e.speed * 0.75;
        else { e.facing *= -1; e.vx = 0; }
      }

      return;
    }

    // unanchored chase/patrol
    if (wantsChase) {
      e.vx = dir * e.speed;
      e.facing = dir;
    } else {
      if (e.x < e.patrolMin) e.facing = 1;
      if (e.x > e.patrolMax) e.facing = -1;
      e.vx = e.facing * e.speed * 0.65;
    }

    if (e.isBoss) {
      e.jumpCd = Math.max(0, e.jumpCd - dt);
      if (e.jumpCd <= 0 && e.onGround && absDx < 420) {
        e.vy = -780;
        e.jumpCd = 2.2;
      }
    }
  }

  // ---------------- HUD ----------------
  function updateHud() {
    hudStage.textContent = `Level: ${GAME.stage}`;
    hudCoins.textContent = `Coins: ${GAME.coins}`;
    hudDash.textContent = GAME.dashUnlocked ? (player.dashCd > 0 ? "Dash: Cooling" : "Dash: Ready") : "Dash: Locked";
    hudSpeed.textContent = GAME.speedUnlocked ? "Speed: Boosted" : "Speed: Normal";
    hudThrow.textContent = player.throwCd > 0 ? "Throw: Cooling" : "Throw: Ready";
  }

  // ---------------- Menu / Character select ----------------
  const PLAYABLE = ["Gilly", "Scott", "Kevin", "Nate"];
  let selectedChar = null;

  function buildCharacterGrid() {
    charGridEl.innerHTML = "";
    for (const name of PLAYABLE) {
      const card = document.createElement("div");
      card.className = "char-card";

      const im = document.createElement("img");
      im.alt = name;
      im.src = imgs[name].src;

      const txt = document.createElement("div");

      const nm = document.createElement("div");
      nm.className = "char-name";
      nm.textContent = name;

      const sub = document.createElement("div");
      sub.className = "small";
      sub.textContent = "Playable";

      txt.appendChild(nm);
      txt.appendChild(sub);

      card.appendChild(im);
      card.appendChild(txt);

      card.onclick = () => {
        selectedChar = name;
        player.char = name;
        [...charGridEl.querySelectorAll(".char-card")].forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        btnStart.disabled = false;
      };

      charGridEl.appendChild(card);
    }
  }

  btnStart.addEventListener("click", () => {
    if (!selectedChar) return;
    loadStage(1);
  });

  // ---------------- Pause / Buttons ----------------
  btnResume.addEventListener("click", () => {
    if (GAME.mode === "paused") togglePause();
  });

  btnRestart.addEventListener("click", () => {
    loadStage(GAME.stage);
    pauseOverlay.classList.add("hidden");
    GAME.mode = "play";
  });

  btnBackMenu.addEventListener("click", () => {
    GAME.mode = "menu";
    hideAllOverlays();
    menuEl.classList.remove("hidden");
    btnStart.disabled = true;
    selectedChar = null;
  });

  btnShop.addEventListener("click", () => {
    if (GAME.shopUsedThisStage) return;
    stageClearOverlay.classList.add("hidden");
    openShop();
  });

  btnNextStage.addEventListener("click", () => {
    stageClearOverlay.classList.add("hidden");
    startLoadingNextStage(GAME.stage + 1);
  });

  btnClearRestart.addEventListener("click", () => {
    stageClearOverlay.classList.add("hidden");
    loadStage(GAME.stage);
  });

  btnShopBack.addEventListener("click", () => {
    closeShopBackToClear();
  });

  function togglePause() {
    if (GAME.mode === "menu" || GAME.mode === "stageclear" || GAME.mode === "shop" || GAME.mode === "loading") return;
    if (GAME.mode === "paused") {
      GAME.mode = "play";
      pauseOverlay.classList.add("hidden");
    } else if (GAME.mode === "play") {
      GAME.mode = "paused";
      pauseOverlay.classList.remove("hidden");
    }
  }

  // ---------------- Update & Render loop ----------------
  let last = 0;

  function update(dt) {
    if (GAME.mode === "paused" || GAME.mode === "menu" || GAME.mode === "stageclear" || GAME.mode === "shop") return;

    if (GAME.mode === "loading") {
      GAME.loadingT += dt;
      const t = clamp(GAME.loadingT / GAME.loadingDur, 0, 1);
      loadingFill.style.width = `${Math.floor(t * 100)}%`;

      if (t >= 1) {
        loadingOverlay.classList.add("hidden");
        loadStage(GAME.pendingStage);
      }
      return;
    }

    player.dashCd = Math.max(0, player.dashCd - dt);
    player.throwCd = Math.max(0, player.throwCd - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.landedT = Math.max(0, player.landedT - dt);

    let move = 0;
    if (down("ArrowLeft") || down("KeyA")) move -= 1;
    if (down("ArrowRight") || down("KeyD")) move += 1;

    if (move !== 0) {
      player.facing = move;
      player.vx += move * PHYS.accel * dt;
    } else {
      player.vx *= PHYS.friction;
      if (Math.abs(player.vx) < 8) player.vx = 0;
    }

    const maxSpeed = PHYS.maxSpeed * (GAME.speedUnlocked ? 1.25 : 1.0);
    player.vx = clamp(player.vx, -maxSpeed, maxSpeed);

    const prevOnGround = player.onGround;

    if ((down("Space") || down("ArrowUp")) && player.onGround) {
      player.vy = -PHYS.jump;
      player.onGround = false;
      if (GAME.stage === 1 && !GAME.tutorial.jump) {
        GAME.tutorial.jump = true;
        setTutorialChecks();
      }
    }

    if (GAME.dashUnlocked && down("ShiftLeft") && player.dashCd <= 0) {
      player.vx = player.facing * (maxSpeed * 2.2);
      player.dashCd = 1.0;
    }

    if (down("KeyF")) {
      if (player.throwCd <= 0) throwWeapon();
    }

    if (GAME.stage === 1 && !GAME.tutorial.move) {
      if (Math.abs(player.vx) > 40) {
        GAME.tutorial.move = true;
        setTutorialChecks();
      }
    }

    player.vy += PHYS.gravity * dt;
    resolvePlatformCollisions(player, dt);

    // landing squash trigger
    if (!prevOnGround && player.onGround) {
      player.landedT = 0.12;
    }

    // pickups
    for (let i = GAME.pickups.length - 1; i >= 0; i--) {
      const p = GAME.pickups[i];
      if (rectsOverlap(player, p)) {
        if (p.kind === "coin") {
          GAME.coins += p.value;
          GAME.pickups.splice(i, 1);
          updateHud();
        }
      }
    }

    // enemies
    for (let i = GAME.enemies.length - 1; i >= 0; i--) {
      const e = GAME.enemies[i];

      enemyThink(e, dt);

      e.vy += PHYS.gravity * dt;
      resolvePlatformCollisions(e, dt);

      // keep anchored footing tight
      if (e.platform) {
        const desiredY = e.platform.y - e.h;
        if (Math.abs(e.y - desiredY) < 10) {
          e.y = desiredY;
          e.vy = 0;
          e.onGround = true;
        }
      }

      if (rectsOverlap(player, e)) hurtPlayer(e.damage);

      if (e.hp <= 0) {
        GAME.enemies.splice(i, 1);
        if (GAME.exitLocked && GAME.enemies.every((en) => !en.isBoss)) {
          GAME.exitLocked = false;
        }
      }
    }

    // projectiles
    for (let i = GAME.projectiles.length - 1; i >= 0; i--) {
      const pr = GAME.projectiles[i];
      pr.life -= dt;
      pr.vy += PHYS.gravity * 0.55 * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      let hitPlat = false;
      for (const p of GAME.platforms) {
        if (rectsOverlap(pr, p)) { hitPlat = true; break; }
      }
      if (hitPlat) {
        pr.vx *= 0.25;
        pr.vy *= -0.25;
        pr.life = Math.min(pr.life, 0.25);
      }

      for (const e of GAME.enemies) {
        if (rectsOverlap(pr, e)) {
          e.hp -= pr.dmg;
          pr.life = 0;
          break;
        }
      }

      if (pr.life <= 0) GAME.projectiles.splice(i, 1);
    }

    // exit
    if (GAME.exit && !GAME.exitLocked) {
      if (rectsOverlap(player, GAME.exit)) {
        openStageClear();
      }
    }

    // camera
    const targetCam = clamp(player.x - VIEW_W * 0.35, 0, Math.max(0, GAME.worldW - VIEW_W));
    GAME.camX = lerp(GAME.camX, targetCam, 0.08);

    updateHud();
  }

  function render() {
    const t = performance.now() / 1000;

    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(-GAME.camX, 0);

    drawBackground();

    for (const p of GAME.platforms) drawPlatform(p);

    for (const p of GAME.pickups) {
      if (p.kind === "coin") drawCoin(p, t);
    }

    if (GAME.exit) drawExit(GAME.exit, t);

    // projectiles
    for (const pr of GAME.projectiles) {
      drawSprite(imgs.Weapon, pr, DRAW.weaponScale, 0, {
        rot: Math.sin(t * 20) * 0.10,
      });
    }

    // enemies with simple animations
    for (const e of GAME.enemies) {
      const im = e.type === "enemy2" ? imgs.Enemy2 : imgs.Enemy1;

      const walk = Math.min(1, Math.abs(e.vx) / 120);
      const bobY = (walk > 0.05 ? Math.sin(t * 12 + e.bobSeed) : Math.sin(t * 2 + e.bobSeed)) * (2 + 2 * walk);
      const rot = (walk > 0.05 ? Math.sin(t * 12 + e.bobSeed) : 0) * 0.03;

      drawSprite(im, e, DRAW.enemyScale, DRAW.enemyFootPad, {
        flip: e.facing < 0,
        bobY,
        rot,
      });

      drawHPBlocks(e);
    }

    // player with retro squash/stretch + bob
    const pIm = imgs[player.char];

    const speedAbs = Math.abs(player.vx);
    const walk = Math.min(1, speedAbs / 180);

    const idleBob = Math.sin(t * 2.0) * 1.2;
    const walkBob = Math.sin(t * 12.0) * (2.2 + 2.2 * walk);
    const bobY = (walk > 0.05 ? walkBob : idleBob);

    // jump squash/stretch
    let sx = 1, sy = 1;
    if (!player.onGround) {
      sx = 1.05;
      sy = 0.95;
    }

    // landing squash
    if (player.landedT > 0) {
      const k = player.landedT / 0.12;
      sx = 0.92 + 0.08 * (1 - k);
      sy = 1.08 - 0.08 * (1 - k);
    }

    // tilt when running
    const rot = (walk > 0.10 ? Math.sin(t * 12) * 0.025 * player.facing : 0);

    const flicker = (player.invuln <= 0 || Math.floor(performance.now() / 90) % 2 === 0);

    if (flicker) {
      drawSprite(pIm, player, DRAW.playerScale, DRAW.playerFootPad, {
        flip: player.facing < 0,
        bobY,
        rot,
        sx,
        sy
      });
    }

    ctx.restore();
  }

  function loop(t) {
    if (!last) last = t;
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;

    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ---------------- Stage Clear / Shop / Loading ----------------
  function openStageClear() {
    GAME.mode = "stageclear";
    stageClearTitle.textContent = `STAGE ${GAME.stage} CLEARED`;
    stageClearSub.textContent = GAME.shopUsedThisStage ? "Shop already used this stage." : "Shop available once (after clearing).";
    stageClearOverlay.classList.remove("hidden");
  }

  btnShop.addEventListener("click", () => {
    if (GAME.shopUsedThisStage) return;
    stageClearOverlay.classList.add("hidden");
    openShop();
  });

  btnNextStage.addEventListener("click", () => {
    stageClearOverlay.classList.add("hidden");
    startLoadingNextStage(GAME.stage + 1);
  });

  btnClearRestart.addEventListener("click", () => {
    stageClearOverlay.classList.add("hidden");
    loadStage(GAME.stage);
  });

  function openShop() {
    if (GAME.shopUsedThisStage) return;
    GAME.mode = "shop";
    shopOverlay.classList.remove("hidden");
    renderShop();
  }

  btnShopBack.addEventListener("click", () => {
    closeShopBackToClear();
  });

  function closeShopBackToClear() {
    shopOverlay.classList.add("hidden");
    GAME.shopUsedThisStage = true;
    openStageClear();
  }

  function startLoadingNextStage(nextStage) {
    GAME.mode = "loading";
    loadingOverlay.classList.remove("hidden");
    GAME.loadingT = 0;
    GAME.pendingStage = nextStage;
    loadingFill.style.width = "0%";
  }

  // ---------------- Boot ----------------
  async function boot() {
    menuEl.classList.add("hidden");
    btnStart.disabled = true;

    bootOverlay.classList.remove("hidden");
    bootFill.style.width = "0%";
    bootPct.textContent = "0%";
    bootSub.textContent = "Loading assets…";

    try {
      await loadAllAssets((loaded, total) => {
        const pct = Math.floor((loaded / total) * 100);
        bootFill.style.width = pct + "%";
        bootPct.textContent = pct + "%";
        bootSub.textContent = `Loading assets… (${loaded}/${total})`;
      });
    } catch (err) {
      console.error(err);
      bootSub.textContent = "Asset load failed. Check /assets names (case-sensitive).";
      bootPct.textContent = "ERROR";
      return;
    }

    bootOverlay.classList.add("hidden");

    buildCharacterGrid();
    updateHud();
    updatePlayerHpHud();

    GAME.mode = "menu";
    menuEl.classList.remove("hidden");

    requestAnimationFrame(loop);
  }

  // ---------------- Start ----------------
  boot();
})();

