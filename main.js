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
        if (ent.vx > 
