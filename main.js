(() => {
  "use strict";

  // ========= DOM =========
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const menuEl = document.getElementById("menu");
  const charGridEl = document.getElementById("charGrid");
  const btnStart = document.getElementById("btnStart");

  const hudStage = document.getElementById("hudStage");
  const hudCoins = document.getElementById("hudCoins");
  const hudDash = document.getElementById("hudDash");
  const hudSpeed = document.getElementById("hudSpeed");
  const hudThrow = document.getElementById("hudThrow");

  const tutorialBox = document.getElementById("tutorialBox");
  const tutMove = document.getElementById("tutMove");
  const tutJump = document.getElementById("tutJump");
  const tutThrow = document.getElementById("tutThrow");

  const pauseOverlay = document.getElementById("pauseOverlay");
  const btnResume = document.getElementById("btnResume");
  const btnRestart = document.getElementById("btnRestart");
  const btnBackMenu = document.getElementById("btnBackMenu");

  const stageClearOverlay = document.getElementById("stageClearOverlay");
  const stageCharImg = document.getElementById("stageChar");
  const stageClearTitle = document.getElementById("stageClearTitle");
  const stageClearSub = document.getElementById("stageClearSub");
  const statCoins = document.getElementById("statCoins");
  const statHP = document.getElementById("statHP");
  const statStage = document.getElementById("statStage");
  const statUnlocks = document.getElementById("statUnlocks");
  const btnShop = document.getElementById("btnShop");
  const btnNextStage = document.getElementById("btnNextStage");
  const btnClearRestart = document.getElementById("btnClearRestart");

  const shopOverlay = document.getElementById("shopOverlay");
  const shopCoins = document.getElementById("shopCoins");
  const shopList = document.getElementById("shopList");
  const btnShopBack = document.getElementById("btnShopBack");
  const shopkeeperImg = document.getElementById("shopkeeperImg");

  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingFill = document.getElementById("loadingFill");

  // ========= CANVAS SETTINGS =========
  ctx.imageSmoothingEnabled = false;

  // ========= ASSETS (with fallbacks root or /assets) =========
  const ASSETS = {
    background: ["Background_Pic.png"],
    platform: ["Platform.png"],
    exitDoor: ["Exit_Door.png", "Exit_Door.PNG", "exit_door.png"],
    enemy1: ["Enemy1.png", "enemy1.png"],
    enemy2: ["Enemy2.png", "enemy2.png"],
    coin: ["Coin.png", "coin.png"],
    weapon: ["powerup_homephone.png", "Powerup_homephone.png"],
    dash: ["Powerup_Dash.png", "powerup_dash.png"],
    speed: ["Powerup_Speedboost.png", "Powerup_SpeedBoost.png", "powerup_speedboost.png"],
    checkpoint: ["CheckpointFlag.png", "checkpointflag.png"],
    characters: {
      Gilly: ["Gilly.png", "gilly.png"],
      Scott: ["Scott.png", "scott.png"],
      Kevin: ["Kevin.png", "kevin.png"],
      Nate: ["Nate.png", "nate.png"],
      Edgar: ["Edgar.png", "edgar.png"]
    }
  };

  const imgs = { characters: {} };
  const resolvedUrls = {};

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Failed to load: " + url));
      im.src = url;
    });
  }

  function expandCandidateUrls(fileName) {
    const prefixes = ["", "./", "assets/", "./assets/"];
    const urls = [];
    for (const p of prefixes) urls.push(p + fileName);
    return [...new Set(urls)];
  }

  async function loadFirstAvailable(label, fileNameOptions) {
    for (const fileName of fileNameOptions) {
      const urls = expandCandidateUrls(fileName);
      for (const url of urls) {
        try {
          const im = await loadImage(url);
          resolvedUrls[label] = url;
          return im;
        } catch (_) {}
      }
    }
    console.warn(`[ASSET MISSING] ${label} tried:`, fileNameOptions);
    return null;
  }

  async function loadAllAssets() {
    imgs.background = await loadFirstAvailable("background", ASSETS.background);
    imgs.platform = await loadFirstAvailable("platform", ASSETS.platform);
    imgs.exitDoor = await loadFirstAvailable("exitDoor", ASSETS.exitDoor);
    imgs.enemy1 = await loadFirstAvailable("enemy1", ASSETS.enemy1);
    imgs.enemy2 = await loadFirstAvailable("enemy2", ASSETS.enemy2);
    imgs.coin = await loadFirstAvailable("coin", ASSETS.coin);
    imgs.weapon = await loadFirstAvailable("weapon", ASSETS.weapon);
    imgs.dash = await loadFirstAvailable("dash", ASSETS.dash);
    imgs.speed = await loadFirstAvailable("speed", ASSETS.speed);
    imgs.checkpoint = await loadFirstAvailable("checkpoint", ASSETS.checkpoint);

    for (const [name, opts] of Object.entries(ASSETS.characters)) {
      imgs.characters[name] = await loadFirstAvailable(`char:${name}`, opts);
    }

    console.log("Resolved asset URLs:", resolvedUrls);
  }

  // ========= INPUT =========
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    if (e.code === "Escape") togglePause();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  function isDown(code) { return keys.has(code); }

  // ========= RNG =========
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

  // ========= GAME STATE =========
  const GAME = {
    state: "menu",
    stage: 1,
    coins: 0,
    dashUnlocked: false,
    speedUnlocked: false,
    shopUsedThisStage: false,

    worldW: 2400,
    worldH: 720,
    platforms: [],
    coinsOnMap: [],
    enemies: [],
    projectiles: [],
    exit: null,
    exitLocked: false,

    camX: 0,

    loadingT: 0,
    loadingDuration: 6.0,
    pendingStage: null
  };

  // ========= HELPERS =========
  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ========= PLATFORM RENDER (TILED) =========
  const PLATFORM_DRAW_H = 36;
  function drawPlatformTiled(p) {
    if (!imgs.platform) {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      return;
    }
    const img = imgs.platform;
    const scale = PLATFORM_DRAW_H / img.height;
    const tileW = img.width * scale;
    const tileH = PLATFORM_DRAW_H;

    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, tileH);
    ctx.clip();

    for (let dx = p.x; dx < p.x + p.w; dx += tileW) {
      ctx.drawImage(img, dx, p.y, tileW, tileH);
    }
    ctx.restore();
  }

  // ========= HEALTH BARS =========
  function drawHPBlocksScreen(x, y, blocks, filled) {
    const bw = 14, bh = 12, gap = 3;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - 6, y - 6, blocks * (bw + gap) + 10, bh + 12);

    for (let i = 0; i < blocks; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(x + i * (bw + gap), y, bw, bh);
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.fillRect(x + i * (bw + gap) + 2, y + 2, bw - 4, bh - 4);

      if (i < filled) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillRect(x + i * (bw + gap) + 3, y + 3, bw - 6, bh - 6);
      }
    }
    ctx.restore();
  }

  function drawHPBarWorld(entity) {
    const blocks = entity.maxHp;
    const filled = clamp(entity.hp, 0, entity.maxHp);
    const bw = 10, bh = 6, gap = 2;
    const totalW = blocks * (bw + gap) - gap;

    const x = entity.x + entity.w / 2 - totalW / 2;
    const y = entity.y - 12;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - 3, y - 3, totalW + 6, bh + 6);

    for (let i = 0; i < blocks; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(x + i * (bw + gap), y, bw, bh);
      ctx.fillStyle = "rgba(0,0,0,0.95)";
      ctx.fillRect(x + i * (bw + gap) + 1, y + 1, bw - 2, bh - 2);
      if (i < filled) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillRect(x + i * (bw + gap) + 2, y + 2, bw - 4, bh - 4);
      }
    }
  }

  // ========= SPRITES (FEET-ALIGNED) =========
  function drawSpriteAnchored(img, x, y, w, h, scale = 1.0) {
    if (!img) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(x, y, w, h);
      return;
    }
    const drawW = w * scale;
    const drawH = h * scale;
    const dx = x + w / 2 - drawW / 2;
    const dy = y + h - drawH;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  // ========= PHYSICS =========
  const PHYS = {
    gravity: 2200,
    moveAccel: 3000,
    maxSpeed: 340,
    jumpSpeed: 820,
    airControl: 0.65,
    friction: 0.82
  };

  // ========= PLAYER =========
  const player = {
    charName: null,
    x: 120, y: 0,
    w: 52, h: 78,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    hp: 8, maxHp: 8,
    dashCd: 0,
    throwCd: 0
  };

  function resetPlayerAt(x, y) {
    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.facing = 1;
    player.hp = player.maxHp;
    player.dashCd = 0;
    player.throwCd = 0;
  }

  // ========= ENEMIES =========
  function makeEnemy(type, x, y, isBoss = false) {
    const base = { type, x, y, vx: 0, vy: 0, onGround: false, facing: -1, patrolMin: x - 120, patrolMax: x + 120, damage: 1 };
    if (type === "enemy1") {
      return Object.assign(base, { w: 48, h: 64, hp: isBoss ? 10 : 4, maxHp: isBoss ? 10 : 4, speed: isBoss ? 180 : 140, isBoss });
    }
    return Object.assign(base, { w: 54, h: 70, hp: isBoss ? 14 : 6, maxHp: isBoss ? 14 : 6, speed: isBoss ? 210 : 160, isBoss });
  }

  // ========= PROJECTILES =========
  function spawnWeapon() {
    if (player.throwCd > 0) return;
    player.throwCd = 0.45;

    const pr = {
      x: player.x + player.w / 2 + player.facing * 18,
      y: player.y + 18,
      w: 22, h: 22,
      vx: player.facing * 720,
      vy: -160,
      life: 1.2,
      dmg: 2
    };
    GAME.projectiles.push(pr);

    if (GAME.stage === 1) markTutorial("throw");
  }

  // ========= STAGES =========
  function clearStage() {
    GAME.platforms = [];
    GAME.coinsOnMap = [];
    GAME.enemies = [];
    GAME.projectiles = [];
    GAME.exit = null;
    GAME.exitLocked = false;
    GAME.shopUsedThisStage = false;
  }

  const tutorialFlags = { move: false, jump: false, throw: false };
  function markTutorial(which) {
    if (GAME.stage !== 1) return;
    if (which === "move") { tutorialFlags.move = true; tutMove.classList.add("done"); }
    if (which === "jump") { tutorialFlags.jump = true; tutJump.classList.add("done"); }
    if (which === "throw") { tutorialFlags.throw = true; tutThrow.classList.add("done"); }
    if (tutorialFlags.move && tutorialFlags.jump && tutorialFlags.throw) {
      setTimeout(() => tutorialBox.classList.add("hidden"), 600);
    }
  }

  function stage1Tutorial() {
    clearStage();
    GAME.worldW = 2200;
    GAME.worldH = canvas.height;
    const floorY = Math.round(canvas.height - 110);

    GAME.platforms.push({ x: -200, y: floorY, w: GAME.worldW + 400, h: PLATFORM_DRAW_H });
    GAME.platforms.push({ x: 260, y: floorY - 110, w: 340, h: PLATFORM_DRAW_H });
    GAME.platforms.push({ x: 740, y: floorY - 170, w: 360, h: PLATFORM_DRAW_H });
    GAME.platforms.push({ x: 1220, y: floorY - 110, w: 320, h: PLATFORM_DRAW_H });

    for (let i = 0; i < 6; i++) GAME.coinsOnMap.push({ x: 310 + i * 60, y: floorY - 150, r: 14, taken: false });

    const e = makeEnemy("enemy1", 980, floorY - 64, false);
    e.patrolMin = 880; e.patrolMax = 1120;
    GAME.enemies.push(e);

    // Door sits on the floor lane (always reachable)
    GAME.exit = { x: 1880, y: floorY - 200, w: 96, h: 200 };

    resetPlayerAt(120, floorY - player.h);

    tutorialBox.classList.remove("hidden");
    tutMove.classList.remove("done");
    tutJump.classList.remove("done");
    tutThrow.classList.remove("done");
    tutorialFlags.move = tutorialFlags.jump = tutorialFlags.throw = false;
  }

  function stage2BossArena() {
    clearStage();
    GAME.worldW = 2400;
    GAME.worldH = canvas.height;
    const floorY = Math.round(canvas.height - 110);

    GAME.platforms.push({ x: -200, y: floorY, w: GAME.worldW + 400, h: PLATFORM_DRAW_H });
    GAME.platforms.push({ x: 380, y: floorY - 110, w: 420, h: PLATFORM_DRAW_H });
    GAME.platforms.push({ x: 1000, y: floorY - 180, w: 460, h: PLATFORM_DRAW_H });
    GAME.platforms.push({ x: 1700, y: floorY - 110, w: 420, h: PLATFORM_DRAW_H });

    const boss = makeEnemy("enemy2", 1500, floorY - 70, true);
    boss.patrolMin = 1200; boss.patrolMax = 1850;
    boss.damage = 2;
    GAME.enemies.push(boss);

    GAME.exitLocked = true;
    GAME.exit = { x: 2160, y: floorY - 220, w: 100, h: 220 };

    for (let i = 0; i < 10; i++) {
      GAME.coinsOnMap.push({
        x: 520 + i * 160,
        y: (floorY - 250) + (i % 2) * 50,
        r: 14,
        taken: false
      });
    }

    resetPlayerAt(160, floorY - player.h);
    tutorialBox.classList.add("hidden");
  }

  // ======= IMPORTANT: Procedural generation is now GUARANTEED PASSABLE =======
  function generateProceduralStage(stageNum) {
    clearStage();

    const seed = 1337 + stageNum * 999;
    const rnd = mulberry32(seed);

    // Slight growth, but not insane
    GAME.worldW = 2400 + stageNum * 120;
    GAME.worldH = canvas.height;

    const floorY = Math.round(canvas.height - 110);
    const clearZoneRight = 520; // last px kept clean so exit approach is never blocked

    // 1) Always add full floor across the entire level (exit ALWAYS reachable)
    const floorPlat = { x: -200, y: floorY, w: GAME.worldW + 400, h: PLATFORM_DRAW_H };
    GAME.platforms.push(floorPlat);

    // 2) Safety constraints based on player size & collision rules
    // If platform is too low, you can't run under it on the ground (you bonk).
    // Condition: platform bottom must be ABOVE player top when on floor:
    // platform.y + PLATFORM_DRAW_H <= floorY - player.h
    const maxPlatformY = (floorY - player.h) - PLATFORM_DRAW_H - 8; // safety margin
    const minPlatformY = Math.max(260, maxPlatformY - 160);         // keep them not absurdly high

    // Jump-safe spacing (conservative)
    const GAP_MIN = 80;
    const GAP_MAX = 170;          // no more "impossible long gaps"
    const STEP_UP_MAX = 95;       // max rise between platforms
    const STEP_DOWN_MAX = 115;    // max drop between platforms

    // Platform sizes (big, readable)
    const W_MIN = 320;
    const W_MAX = 520;

    // 3) Build a “golden path” of platforms (all reachable) but keep ground open
    const pathPlatforms = [];
    let x = 320;
    let y = clamp(maxPlatformY - 30, minPlatformY, maxPlatformY); // start in a safe band

    const targetEndX = GAME.worldW - clearZoneRight;
    let segments = 6 + Math.min(3, Math.floor(stageNum / 2));     // 6..9 segments

    for (let i = 0; i < segments; i++) {
      const w = Math.floor(W_MIN + rnd() * (W_MAX - W_MIN));
      const plat = { x, y, w, h: PLATFORM_DRAW_H };
      pathPlatforms.push(plat);
      GAME.platforms.push(plat);

      // Advance
      const gap = Math.floor(GAP_MIN + rnd() * (GAP_MAX - GAP_MIN));
      x = x + w + gap;

      // Stop if we reached the safe end area
      if (x > targetEndX - 260) break;

      // Vertical change (clamped)
      const raw = (rnd() < 0.5 ? -1 : 1) * Math.floor(40 + rnd() * 70);
      let nextY = y + raw;

      // Clamp step up/down
      if (nextY < y) nextY = Math.max(nextY, y - STEP_UP_MAX);
      if (nextY > y) nextY = Math.min(nextY, y + STEP_DOWN_MAX);

      y = clamp(nextY, minPlatformY, maxPlatformY);
    }

    // 4) Add a couple of optional side platforms (still safe & not in exit zone)
    const extraCount = 2 + (stageNum >= 6 ? 1 : 0);
    for (let i = 0; i < extraCount; i++) {
      const w = Math.floor(260 + rnd() * 320);
      const px = Math.floor(520 + rnd() * (GAME.worldW - clearZoneRight - 900));
      const py = Math.floor(minPlatformY + rnd() * (maxPlatformY - minPlatformY));
      GAME.platforms.push({ x: px, y: py, w, h: PLATFORM_DRAW_H });
    }

    // 5) Exit door on the floor lane (ALWAYS reachable)
    GAME.exitLocked = false;
    GAME.exit = {
      x: GAME.worldW - 180,
      y: floorY - 230,
      w: 110,
      h: 230
    };

    // 6) Coins: place above golden path (readable, reachable)
    for (const p of pathPlatforms) {
      const n = 1 + (rnd() < 0.45 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        GAME.coinsOnMap.push({
          x: p.x + 60 + rnd() * Math.max(40, p.w - 120),
          y: p.y - 28 - k * 26,
          r: 14,
          taken: false
        });
      }
    }

    // 7) Enemies: spawn ON platforms correctly (no floating/sinking)
    // Choose from the floor + some path platforms, but avoid the spawn area and the exit approach.
    const enemySpawnPlatforms = [floorPlat, ...pathPlatforms].filter(p => p.x < (GAME.worldW - clearZoneRight - 200));
    const enemyCount = 2 + Math.min(5, stageNum);

    for (let i = 0; i < enemyCount; i++) {
      const type = rnd() < 0.55 ? "enemy1" : "enemy2";
      const dummy = makeEnemy(type, 0, 0, false);

      const p = enemySpawnPlatforms[Math.floor(rnd() * enemySpawnPlatforms.length)];

      // Keep away from player spawn (first 500px)
      let ex = p.x + 40 + rnd() * Math.max(20, p.w - dummy.w - 80);
      if (ex < 520) ex = 520 + rnd() * 200;

      // IMPORTANT: y = platform.y - enemy.h so feet sit on the platform
      const e = makeEnemy(type, ex, p.y - dummy.h, false);

      // Patrol bounded to the platform surface
      e.patrolMin = p.x + 10;
      e.patrolMax = p.x + p.w - e.w - 10;

      GAME.enemies.push(e);
    }

    // 8) Spawn player on ground (always has a path)
    resetPlayerAt(140, floorY - player.h);
    tutorialBox.classList.add("hidden");
  }

  function loadStage(n) {
    GAME.stage = n;
    if (n === 1) stage1Tutorial();
    else if (n === 2) stage2BossArena();
    else generateProceduralStage(n);
    updateHUD();
  }

  // ========= SHOP =========
  const SHOP_ITEMS = [
    { id: "dash", name: "DASH MODULE", desc: "Unlock Dash (Shift). Great for boss dodges.", cost: 12,
      canBuy: () => !GAME.dashUnlocked, buy: () => { GAME.dashUnlocked = true; } },
    { id: "speed", name: "SPEED BOOST", desc: "Increase max move speed slightly.", cost: 10,
      canBuy: () => !GAME.speedUnlocked, buy: () => { GAME.speedUnlocked = true; } },
    { id: "heal", name: "REPAIR KIT", desc: "Restore +3 HP (up to max).", cost: 8,
      canBuy: () => player.hp < player.maxHp, buy: () => { player.hp = clamp(player.hp + 3, 0, player.maxHp); } }
  ];

  function openShop() {
    if (GAME.state !== "stageClear") return;
    if (GAME.shopUsedThisStage) return;

    GAME.state = "shop";
    stageClearOverlay.classList.add("hidden");
    shopOverlay.classList.remove("hidden");

    shopkeeperImg.src = (ASSETS.characters.Edgar?.[0] || "Edgar.png");

    renderShop();
  }

  function renderShop() {
    shopCoins.textContent = String(GAME.coins);
    shopList.innerHTML = "";

    for (const item of SHOP_ITEMS) {
      const enabled = item.canBuy() && GAME.coins >= item.cost;

      const row = document.createElement("div");
      row.className = "shop-item";

      const left = document.createElement("div");
      left.innerHTML = `
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
        <div class="shop-meta">Cost: <span class="price">${item.cost}</span></div>
      `;

      const right = document.createElement("div");
      right.className = "shop-right";

      const btn = document.createElement("button");
      btn.className = "btn btn-solid";
      btn.textContent = enabled ? "Buy" : (item.canBuy() ? "Need coins" : "Owned/Full");
      btn.disabled = !enabled;
      btn.onclick = () => {
        if (!enabled) return;
        GAME.coins -= item.cost;
        item.buy();
        renderShop();
        updateHUD();
      };

      right.appendChild(btn);
      row.appendChild(left);
      row.appendChild(right);
      shopList.appendChild(row);
    }
  }

  function closeShopBackToClear() {
    GAME.shopUsedThisStage = true;
    GAME.state = "stageClear";
    shopOverlay.classList.add("hidden");
    stageClearOverlay.classList.remove("hidden");
  }

  // ========= UI =========
  function hideAllOverlays() {
    pauseOverlay.classList.add("hidden");
    stageClearOverlay.classList.add("hidden");
    shopOverlay.classList.add("hidden");
    loadingOverlay.classList.add("hidden");
  }

  function updateHUD() {
    hudStage.textContent = `Level: ${GAME.stage}`;
    hudCoins.textContent = `Coins: ${GAME.coins}`;
    hudDash.textContent = `Dash: ${GAME.dashUnlocked ? (player.dashCd > 0 ? "Cooling" : "Ready") : "Locked"}`;
    hudSpeed.textContent = `Speed: ${GAME.speedUnlocked ? "Boosted" : "Normal"}`;
    hudThrow.textContent = `Throw: ${player.throwCd > 0 ? "Cooling" : "Ready"}`;
  }

  function showStageClear() {
    GAME.state = "stageClear";
    hideAllOverlays();

    stageCharImg.src = (ASSETS.characters[player.charName]?.[0] || "");
    stageClearTitle.textContent = "STAGE CLEARED";
    stageClearSub.textContent = "Door opened. You made it.";
    statCoins.textContent = String(GAME.coins);
    statHP.textContent = `${player.hp}/${player.maxHp}`;
    statStage.textContent = String(GAME.stage);

    const unlocks = [];
    if (GAME.stage === 1) unlocks.push("Boss Stage");
    if (GAME.stage === 2) unlocks.push("Procedural Maps");
    if (GAME.dashUnlocked) unlocks.push("Dash");
    if (GAME.speedUnlocked) unlocks.push("Speed");
    statUnlocks.textContent = unlocks.length ? unlocks.join(", ") : "—";

    stageClearOverlay.classList.remove("hidden");
  }

  function startLoadingNextStage() {
    GAME.state = "loading";
    hideAllOverlays();
    loadingOverlay.classList.remove("hidden");
    GAME.loadingT = 0;
    GAME.pendingStage = GAME.stage + 1;
  }

  function finishLoadingNextStage() {
    loadingOverlay.classList.add("hidden");
    loadStage(GAME.pendingStage);
    GAME.pendingStage = null;
    GAME.state = "play";
  }

  function togglePause() {
    if (GAME.state === "menu") return;
    if (GAME.state === "shop" || GAME.state === "stageClear" || GAME.state === "loading") return;

    if (GAME.state === "paused") {
      GAME.state = "play";
      pauseOverlay.classList.add("hidden");
      return;
    }
    if (GAME.state === "play") {
      GAME.state = "paused";
      pauseOverlay.classList.remove("hidden");
    }
  }

  // ========= COLLISIONS =========
  function resolvePlatformCollisions(ent, dt) {
    ent.onGround = false;

    ent.x += ent.vx * dt;
    for (const p of GAME.platforms) {
      if (rectsOverlap(ent, p)) {
        if (ent.vx > 0) ent.x = p.x - ent.w;
        else if (ent.vx < 0) ent.x = p.x + p.w;
        ent.vx = 0;
      }
    }

    ent.y += ent.vy * dt;
    for (const p of GAME.platforms) {
      if (rectsOverlap(ent, p)) {
        if (ent.vy > 0) { ent.y = p.y - ent.h; ent.vy = 0; ent.onGround = true; }
        else if (ent.vy < 0) { ent.y = p.y + p.h; ent.vy = 0; }
      }
    }

    ent.x = clamp(ent.x, -300, GAME.worldW - ent.w + 300);
    ent.y = clamp(ent.y, -800, GAME.worldH - ent.h + 300);
  }

  // ========= GAME LOOP =========
  let last = performance.now();

  function update(dt) {
    if (GAME.state === "paused" || GAME.state === "menu" || GAME.state === "shop" || GAME.state === "stageClear") {
      updateHUD();
      return;
    }

    if (GAME.state === "loading") {
      GAME.loadingT += dt;
      const t = clamp(GAME.loadingT / GAME.loadingDuration, 0, 1);
      loadingFill.style.width = `${Math.floor(t * 100)}%`;
      if (t >= 1) finishLoadingNextStage();
      return;
    }

    player.throwCd = Math.max(0, player.throwCd - dt);
    player.dashCd = Math.max(0, player.dashCd - dt);

    const left = isDown("ArrowLeft") || isDown("KeyA");
    const right = isDown("ArrowRight") || isDown("KeyD");
    const jump = isDown("Space");
    const throwKey = isDown("KeyF");
    const dashKey = isDown("ShiftLeft") || isDown("ShiftRight");

    if (GAME.stage === 1 && (left || right)) markTutorial("move");

    const accel = PHYS.moveAccel * (player.onGround ? 1 : PHYS.airControl);
    if (left) { player.vx -= accel * dt; player.facing = -1; }
    if (right) { player.vx += accel * dt; player.facing = 1; }

    const maxSpeed = (GAME.speedUnlocked ? (PHYS.maxSpeed * 1.18) : PHYS.maxSpeed);
    player.vx = clamp(player.vx, -maxSpeed, maxSpeed);

    if (player.onGround && !left && !right) player.vx *= PHYS.friction;

    if (jump && player.onGround) {
      player.vy = -PHYS.jumpSpeed;
      player.onGround = false;
      if (GAME.stage === 1) markTutorial("jump");
    }

    if (dashKey && GAME.dashUnlocked && player.dashCd <= 0) {
      player.vx = player.facing * (maxSpeed * 2.2);
      player.dashCd = 1.2;
    }

    if (throwKey && player.throwCd <= 0) spawnWeapon();

    player.vy += PHYS.gravity * dt;
    resolvePlatformCollisions(player, dt);

    for (const pr of GAME.projectiles) {
      pr.life -= dt;
      pr.vy += PHYS.gravity * 0.35 * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      for (const p of GAME.platforms) {
        if (rectsOverlap(pr, p)) { pr.life = -1; break; }
      }

      for (const e of GAME.enemies) {
        if (e.hp > 0 && rectsOverlap(pr, e)) {
          e.hp -= pr.dmg;
          pr.life = -1;
          break;
        }
      }
    }
    GAME.projectiles = GAME.projectiles.filter(p => p.life > 0);

    for (const e of GAME.enemies) {
      if (e.hp <= 0) continue;

      const dist = (player.x + player.w/2) - (e.x + e.w/2);
      const abs = Math.abs(dist);

      if (e.isBoss) {
        e.vx = clamp(Math.sign(dist) * e.speed, -e.speed, e.speed);
        if (abs < 140 && e.onGround && Math.random() < 0.02) e.vy = -780;
      } else {
        if (abs < 260) e.vx = Math.sign(dist) * e.speed;
        else {
          if (e.x < e.patrolMin) e.facing = 1;
          if (e.x > e.patrolMax) e.facing = -1;
          e.vx = e.facing * e.speed * 0.85;
        }
      }

      e.vy += PHYS.gravity * dt;
      resolvePlatformCollisions(e, dt);

      if (rectsOverlap(player, e)) {
        player.hp -= e.damage;
        player.vx = -Math.sign(dist || 1) * 380;
        player.vy = -420;

        if (player.hp <= 0) {
          player.hp = player.maxHp;
          loadStage(GAME.stage);
          return;
        }
      }
    }

    if (GAME.exitLocked) {
      const bossesAlive = GAME.enemies.some(e => e.isBoss && e.hp > 0);
      if (!bossesAlive) GAME.exitLocked = false;
    }

    for (const c of GAME.coinsOnMap) {
      if (c.taken) continue;
      const px = player.x + player.w/2;
      const py = player.y + player.h/2;
      const d2 = (c.x - px)*(c.x - px) + (c.y - py)*(c.y - py);
      if (d2 < 34*34) { c.taken = true; GAME.coins += 1; }
    }

    if (GAME.exit && !GAME.exitLocked && rectsOverlap(player, GAME.exit)) showStageClear();

    GAME.camX = clamp(player.x + player.w/2 - canvas.width/2, 0, Math.max(0, GAME.worldW - canvas.width));
    updateHUD();
  }

  function render() {
    if (imgs.background) ctx.drawImage(imgs.background, 0, 0, canvas.width, canvas.height);
    else {
      ctx.fillStyle = "#001018";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.save();
    ctx.translate(-GAME.camX, 0);

    for (const p of GAME.platforms) drawPlatformTiled(p);

    for (const c of GAME.coinsOnMap) {
      if (c.taken) continue;
      if (imgs.coin) ctx.drawImage(imgs.coin, c.x - c.r, c.y - c.r, c.r*2, c.r*2);
      else {
        ctx.fillStyle = "gold";
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill();
      }
    }

    if (GAME.exit) {
      const ex = GAME.exit;
      if (imgs.exitDoor) ctx.drawImage(imgs.exitDoor, ex.x, ex.y, ex.w, ex.h);
      else {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
      }

      if (GAME.exitLocked) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(ex.x - 40, ex.y - 40, 200, 34);
        ctx.fillStyle = "white";
        ctx.font = "14px ui-monospace";
        ctx.fillText("Defeat the boss!", ex.x - 30, ex.y - 18);
      }
    }

    for (const e of GAME.enemies) {
      if (e.hp <= 0) continue;
      const img = (e.type === "enemy1") ? imgs.enemy1 : imgs.enemy2;
      drawSpriteAnchored(img, e.x, e.y, e.w, e.h, e.isBoss ? 1.6 : 1.35);
      drawHPBarWorld(e);
    }

    const pImg = imgs.characters[player.charName] || null;
    drawSpriteAnchored(pImg, player.x, player.y, player.w, player.h, 1.55);
    drawHPBarWorld(player);

    for (const pr of GAME.projectiles) {
      if (imgs.weapon) ctx.drawImage(imgs.weapon, pr.x, pr.y, pr.w, pr.h);
      else { ctx.fillStyle = "white"; ctx.fillRect(pr.x, pr.y, pr.w, pr.h); }
    }

    ctx.restore();

    drawHPBlocksScreen(canvas.width - 18 - (player.maxHp * 17), 16, player.maxHp, clamp(player.hp, 0, player.maxHp));
  }

  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 1/30);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ========= MENU =========
  let selectedChar = null;

  function renderCharSelect() {
    charGridEl.innerHTML = "";
    for (const name of Object.keys(ASSETS.characters)) {
      const card = document.createElement("div");
      card.className = "char-card" + (selectedChar === name ? " selected" : "");
      card.onclick = () => {
        selectedChar = name;
        btnStart.disabled = false;
        renderCharSelect();
      };

      const im = document.createElement("img");
      im.src = (ASSETS.characters[name]?.[0] || `${name}.png`);
      im.alt = name;

      const info = document.createElement("div");
      info.innerHTML = `<div class="char-name">${name}</div><div class="small">Selectable</div>`;

      card.appendChild(im);
      card.appendChild(info);
      charGridEl.appendChild(card);
    }
  }

  function startGame() {
    player.charName = selectedChar || "Nate";
    menuEl.classList.add("hidden");
    GAME.state = "play";
    GAME.coins = 0;
    GAME.dashUnlocked = false;
    GAME.speedUnlocked = false;
    loadStage(1);
  }

  // ========= BUTTONS =========
  btnStart.addEventListener("click", startGame);

  btnResume.addEventListener("click", () => { if (GAME.state === "paused") togglePause(); });
  btnRestart.addEventListener("click", () => { hideAllOverlays(); loadStage(GAME.stage); GAME.state = "play"; });

  btnBackMenu.addEventListener("click", () => {
    hideAllOverlays();
    GAME.state = "menu";
    menuEl.classList.remove("hidden");
    selectedChar = null;
    btnStart.disabled = true;
    renderCharSelect();
  });

  btnShop.addEventListener("click", openShop);
  btnShopBack.addEventListener("click", closeShopBackToClear);
  btnNextStage.addEventListener("click", startLoadingNextStage);
  btnClearRestart.addEventListener("click", () => { hideAllOverlays(); loadStage(GAME.stage); GAME.state = "play"; });

  // ========= BOOT =========
  (async function boot() {
    renderCharSelect();
    await loadAllAssets();

    GAME.state = "menu";
    hideAllOverlays();
    menuEl.classList.remove("hidden");
    btnStart.disabled = true;

    requestAnimationFrame((t) => {
      last = t;
      requestAnimationFrame(loop);
    });
  })();

})();
