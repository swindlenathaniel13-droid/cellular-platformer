(() => {
  "use strict";

  // ---------------- DOM ----------------
  const $ = (id) => document.getElementById(id);

  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

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

  function nowMs() { return performance.now(); }

  // ---------------- Input ----------------
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    if (e.code === "Escape") togglePause();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  const down = (code) => keys.has(code);

  // ---------------- RNG (stable per stage) ----------------
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
  // IMPORTANT: your repo has /assets with these exact filenames.
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
    Edgar: "Edgar.png"
  };

  const imgs = {};
  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Failed to load " + path));
      im.src = path;
    });
  }

  async function loadAllAssets() {
    const want = Object.entries(FILES).map(async ([k, file]) => {
      const im = await loadImage(ASSET_BASE + file);
      imgs[k] = im;
    });

    await Promise.all(want);

    // shopkeeper portrait
    shopkeeperImg.src = imgs.Edgar.src;
  }

  // ---------------- Game constants ----------------
  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;

  // World “floor”
  const PLATFORM_H = 42;     // match the visual chunk we tile
  const GROUND_Y = 640;      // top of the ground platform

  // Make sprites feel bigger on the platforms
  const DRAW = {
    playerScale: 2.05,
    enemyScale: 2.00,
    exitScale: 2.10,
    coinScale: 1.45,
    weaponScale: 1.35
  };

  // Physics tuned for consistent jump reach
  const PHYS = {
    gravity: 2400,
    accel: 3400,
    maxSpeed: 420,
    jump: 940,
    friction: 0.82
  };

  // ---------------- State ----------------
  const GAME = {
    mode: "menu", // menu | play | paused | stageclear | shop | loading
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

    // loading timer
    loadingT: 0,
    loadingDur: 8.0, // 5–10 seconds: using 8s
    pendingStage: null,

    // tutorial checks
    tutorial: { move:false, jump:false, throw:false }
  };

  // Player collider is intentionally smaller than the sprite (fixes “collision box too big”)
  const player = {
    char: "Nate",

    x: 120, y: GROUND_Y - 74,
    w: 44, h: 74,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,

    hp: 8, maxHp: 8,
    invuln: 0,

    dashCd: 0,
    throwCd: 0
  };

  function resetPlayer(x, y) {
    player.x = x; player.y = y;
    player.vx = 0; player.vy = 0;
    player.onGround = false;
    player.facing = 1;
    player.hp = player.maxHp;
    player.invuln = 0;
    player.dashCd = 0;
    player.throwCd = 0;
  }

  function makeEnemy(type, x, y, isBoss=false, platformRef=null) {
    const is2 = type === "enemy2";
    const e = {
      type,
      x, y,
      w: is2 ? 50 : 46,
      h: is2 ? 76 : 70,
      vx: 0, vy: 0,
      onGround: false,
      facing: -1,

      speed: is2 ? 165 : 150,
      hp: is2 ? 6 : 4,
      maxHp: is2 ? 6 : 4,
      damage: 1,

      // anchoring enemy to a platform fixes the “not on platform” feeling
      platform: platformRef,

      // patrol bounds (usually platform edges)
      patrolMin: x - 140,
      patrolMax: x + 140,

      isBoss,
      aiT: 0,
      jumpCd: 0
    };

    if (isBoss) {
      e.hp = is2 ? 14 : 10;
      e.maxHp = e.hp;
      e.speed += 40;
      e.damage = 2;
    }

    return e;
  }

  // ---------------- Collision & platform helpers ----------------
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
          ent.y = p.y + p.h;
          ent.vy = 0;
        }
      }
    }

    ent.x = clamp(ent.x, -200, GAME.worldW - ent.w + 200);
    ent.y = clamp(ent.y, -1200, VIEW_H + 600);
  }

  function platformUnderFeet(ent, extraDown=6) {
    // Returns the platform that the entity is currently standing on (or null)
    const feet = {
      x: ent.x + 4,
      y: ent.y + ent.h,
      w: ent.w - 8,
      h: extraDown
    };
    for (const p of GAME.platforms) {
      if (rectsOverlap(feet, p)) return p;
    }
    return null;
  }

  function willStepOff(ent, dir) {
    // Look ahead a bit and see if there will be ground/platform below next step
    const aheadX = ent.x + ent.w/2 + dir * (ent.w/2 + 8);
    const probe = { x: aheadX, y: ent.y + ent.h + 2, w: 2, h: 10 };
    for (const p of GAME.platforms) {
      if (rectsOverlap(probe, p)) return false; // safe
    }
    return true; // would fall
  }

  // ---------------- Drawing ----------------
  function drawBackground() {
    const im = imgs.Background;
    const scale = VIEW_H / im.height;
    const tileW = im.width * scale;

    // Parallax scroll
    const par = 0.18;
    const x0 = -((GAME.camX * par) % tileW);

    for (let x = x0; x < VIEW_W + tileW; x += tileW) {
      ctx.drawImage(im, x, 0, tileW, VIEW_H);
    }
  }

  function drawPlatform(p) {
    const im = imgs.Platform;

    // Tile the platform texture horizontally, keep platform height consistent
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

  function drawAnchored(im, x, y, w, h, scale=1.0, footPad=0) {
    // Anchor to collider bottom, so feet stay “on platform”
    const dw = w * scale;
    const dh = h * scale;
    const dx = x + w/2 - dw/2;
    const dy = (y + h) - dh + footPad;
    ctx.drawImage(im, dx, dy, dw, dh);
  }

  function drawCoin(c) {
    const im = imgs.Coin;
    drawAnchored(im, c.x, c.y, c.w, c.h, DRAW.coinScale, 0);
  }

  function drawExit(ex) {
    const im = imgs.Exit;
    drawAnchored(im, ex.x, ex.y, ex.w, ex.h, DRAW.exitScale, 4);
  }

  function drawHPBlocks(ent) {
    const blocks = ent.maxHp;
    const filled = clamp(ent.hp, 0, ent.maxHp);
    const bw = 10, bh = 6, gap = 2;
    const total = blocks*(bw+gap)-gap;
    const x = ent.x + ent.w/2 - total/2;
    const y = ent.y - 12;

    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(x-3, y-3, total+6, bh+6);

    for (let i=0;i<blocks;i++){
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(x+i*(bw+gap), y, bw, bh);
      ctx.fillStyle = "rgba(0,0,0,.95)";
      ctx.fillRect(x+i*(bw+gap)+1, y+1, bw-2, bh-2);
      if (i < filled) {
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.fillRect(x+i*(bw+gap)+2, y+2, bw-4, bh-4);
      }
    }
  }

  function updatePlayerHpHud() {
    hpBlocksEl.innerHTML = "";
    for (let i=0;i<player.maxHp;i++){
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
    GAME.platforms.push({ x:0, y:GROUND_Y, w:worldW, h:PLATFORM_H });
  }

  function setTutorialChecks() {
    tutMove.classList.toggle("done", GAME.tutorial.move);
    tutJump.classList.toggle("done", GAME.tutorial.jump);
    tutThrow.classList.toggle("done", GAME.tutorial.throw);

    if (GAME.tutorial.move && GAME.tutorial.jump && GAME.tutorial.throw) {
      tutorialBox.classList.add("hidden");
    }
  }

  function stage1Tutorial() {
    clearWorld();
    GAME.worldW = 2600;

    addGround(GAME.worldW);

    // Easy stepping platforms above ground (but ground stays clear so exit is always reachable)
    const p1 = { x: 420, y: 520, w: 360, h: PLATFORM_H };
    const p2 = { x: 860, y: 440, w: 360, h: PLATFORM_H };
    const p3 = { x: 1320, y: 520, w: 360, h: PLATFORM_H };
    GAME.platforms.push(p1, p2, p3);

    // Coins
    for (let i=0;i<7;i++){
      GAME.pickups.push({ kind:"coin", x: 480 + i*120, y: 470 - (i%2)*38, w:24, h:24, value:1 });
    }

    // One basic enemy on p2
    const ePlat = p2;
    const e = makeEnemy("enemy1", ePlat.x + 140, ePlat.y - 70, false, ePlat);
    e.patrolMin = ePlat.x + 10;
    e.patrolMax = ePlat.x + ePlat.w - e.w - 10;
    GAME.enemies.push(e);

    // Exit on ground path and BIG
    GAME.exit = { x: GAME.worldW - 220, y: GROUND_Y - 140, w: 84, h: 140 };

    resetPlayer(120, GROUND_Y - player.h);

    GAME.tutorial = { move:false, jump:false, throw:false };
    tutorialBox.classList.remove("hidden");
    setTutorialChecks();
  }

  function stage2BossArena() {
    clearWorld();
    GAME.worldW = 2400;

    addGround(GAME.worldW);

    const p1 = { x: 520, y: 520, w: 380, h: PLATFORM_H };
    const p2 = { x: 980, y: 440, w: 380, h: PLATFORM_H };
    const p3 = { x: 1440, y: 520, w: 380, h: PLATFORM_H };
    GAME.platforms.push(p1, p2, p3);

    // Boss on ground (feels “boss fight”)
    const boss = makeEnemy("enemy2", 1600, GROUND_Y - 76, true, null);
    boss.patrolMin = 1200;
    boss.patrolMax = 2000;
    GAME.enemies.push(boss);

    GAME.exitLocked = true;
    GAME.exit = { x: GAME.worldW - 220, y: GROUND_Y - 140, w: 84, h: 140 };

    resetPlayer(160, GROUND_Y - player.h);

    tutorialBox.classList.add("hidden");
  }

  // Safe procedural: ground path always clear, platforms are optional rewards.
  function generateProcedural(stageNum) {
    clearWorld();

    const seed = (stageNum * 9973) ^ 0xA5A5A5A5;
    const rng = mulberry32(seed);

    GAME.worldW = 2600 + Math.min(1200, stageNum * 220);
    addGround(GAME.worldW);

    // Exit ALWAYS reachable by walking right on ground
    GAME.exit = { x: GAME.worldW - 220, y: GROUND_Y - 140, w: 84, h: 140 };
    GAME.exitLocked = false;

    // Optional platform “islands” above ground
    let x = 420;
    let y = 520;

    const islandCount = 6 + Math.min(7, stageNum);
    for (let i=0;i<islandCount;i++){
      const w = 320 + Math.floor(rng()*220);
      const dx = 220 + Math.floor(rng()*160);
      const dy = -80 + Math.floor(rng()*160);

      x += dx;
      y = clamp(y + dy, 280, 560);

      if (x + w > GAME.worldW - 380) break;

      const plat = { x, y, w, h: PLATFORM_H };
      GAME.platforms.push(plat);

      // coins
      const coinN = 2 + Math.floor(rng()*4);
      for (let c=0;c<coinN;c++){
        GAME.pickups.push({ kind:"coin", x: x + 40 + c*90, y: y - 46, w:24, h:24, value:1 });
      }

      // enemy sometimes on island, anchored to island
      if (rng() < 0.55) {
        const t = rng() < 0.55 ? "enemy1" : "enemy2";
        const e = makeEnemy(t, x + 90, y - (t==="enemy2"?76:70), false, plat);
        e.patrolMin = x + 10;
        e.patrolMax = x + w - e.w - 10;
        GAME.enemies.push(e);
      }
    }

    // A couple ground enemies (never block exit)
    const gCount = 1 + Math.min(3, Math.floor(stageNum/2));
    for (let i=0;i<gCount;i++){
      const gx = 700 + i*520 + Math.floor(rng()*160);
      const gt = rng() < 0.5 ? "enemy1" : "enemy2";
      const e = makeEnemy(gt, gx, GROUND_Y - (gt==="enemy2"?76:70), false, null);
      e.patrolMin = gx - 120;
      e.patrolMax = gx + 120;
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
    {
      id:"dash",
      name:"Unlock Dash",
      desc:"Press Shift to dash forward (short burst).",
      cost: 10,
      canBuy: () => !GAME.dashUnlocked,
      buy: () => (GAME.dashUnlocked = true)
    },
    {
      id:"speed",
      name:"Unlock Speedboost",
      desc:"Move faster permanently.",
      cost: 12,
      canBuy: () => !GAME.speedUnlocked,
      buy: () => (GAME.speedUnlocked = true)
    },
    {
      id:"hp",
      name:"+1 Max HP",
      desc:"Increases max HP by 1 (up to 12).",
      cost: 15,
      canBuy: () => player.maxHp < 12,
      buy: () => { player.maxHp += 1; player.hp = player.maxHp; }
    },
    {
      id:"heal",
      name:"Heal to Full",
      desc:"Restore HP to max.",
      cost: 6,
      canBuy: () => player.hp < player.maxHp,
      buy: () => { player.hp = player.maxHp; }
    }
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
    stageClearSub.textContent = GAME.shopUsedThisStage
      ? "Shop already used this stage."
      : "Shop available once (after clearing).";
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

  // ---------------- HUD ----------------
  function updateHud() {
    hudStage.textContent = `Level: ${GAME.stage}`;
    hudCoins.textContent = `Coins: ${GAME.coins}`;
    hudDash.textContent = GAME.dashUnlocked ? (player.dashCd > 0 ? "Dash: Cooling" : "Dash: Ready") : "Dash: Locked";
    hudSpeed.textContent = GAME.speedUnlocked ? "Speed: Boosted" : "Speed: Normal";
    hudThrow.textContent = player.throwCd > 0 ? "Throw: Cooling" : "Throw: Ready";
  }

  // ---------------- Character select ----------------
  // Edgar is shopkeeper only (NOT playable)
  const PLAYABLE = ["Gilly","Scott","Kevin","Nate"];
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
        [...charGridEl.querySelectorAll(".char-card")].forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        btnStart.disabled = false;
      };

      charGridEl.appendChild(card);
    }
  }

  // ---------------- Projectiles ----------------
  function throwWeapon() {
    if (player.throwCd > 0) return;
    player.throwCd = 0.35;

    GAME.projectiles.push({
      x: player.x + player.w/2 + player.facing*22,
      y: player.y + 18,
      w: 22, h: 22,
      vx: player.facing * 780,
      vy: -220,
      life: 1.6,
      dmg: 2
    });

    // tutorial check
    if (GAME.stage === 1 && !GAME.tutorial.throw) {
      GAME.tutorial.throw = true;
      setTutorialChecks();
    }
  }

  // ---------------- Damage ----------------
  function hurtPlayer(amount) {
    if (player.invuln > 0) return;
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = 0.6;
    updatePlayerHpHud();

    if (player.hp <= 0) {
      // restart stage on death
      loadStage(GAME.stage);
    }
  }

  // ---------------- AI (fix enemy tracking) ----------------
  function enemyThink(e, dt) {
    e.aiT += dt;

    // Keep them attached to their platform if they have one
    if (e.platform) {
      // clamp to platform bounds
      e.x = clamp(e.x, e.platform.x + 6, e.platform.x + e.platform.w - e.w - 6);
    }

    // “chase” only if player is close AND same vertical lane (prevents weird climbing/teleport vibes)
    const dx = (player.x + player.w/2) - (e.x + e.w/2);
    const absDx = Math.abs(dx);
    const laneOk = Math.abs((player.y + player.h) - (e.y + e.h)) < 30;

    let wantsChase = absDx < 320 && laneOk;

    // Boss is more aggressive
    if (e.isBoss && absDx < 520) wantsChase = true;

    const dir = dx < 0 ? -1 : 1;

    // Never let enemies walk off edges (this fixes the “not on platform” and “sliding” issues)
    if (wantsChase) {
      // only chase if it won't step into air
      if (!willStepOff(e, dir)) {
        e.vx = dir * e.speed;
        e.facing = dir;
      } else {
        // edge reached: stop and “guard”
        e.vx *= 0.2;
      }
    } else {
      // patrol
      if (e.x < e.patrolMin) e.facing = 1;
      if (e.x > e.patrolMax) e.facing = -1;

      if (!willStepOff(e, e.facing)) {
        e.vx = e.facing * e.speed * 0.75;
      } else {
        e.facing *= -1;
        e.vx = 0;
      }
    }

    // Small boss hop occasionally (keeps it spicy but not broken)
    if (e.isBoss) {
      e.jumpCd = Math.max(0, e.jumpCd - dt);
      if (e.jumpCd <= 0 && e.onGround && absDx < 420) {
        e.vy = -780;
        e.jumpCd = 2.2;
      }
    }
  }

  // ---------------- Update loop ----------------
  function update(dt) {
    if (GAME.mode === "paused" || GAME.mode === "menu") return;

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

    if (GAME.mode === "stageclear" || GAME.mode === "shop") return;

    // ----- Player cooldowns -----
    player.dashCd = Math.max(0, player.dashCd - dt);
    player.throwCd = Math.max(0, player.throwCd - dt);
    player.invuln = Math.max(0, player.invuln - dt);

    // ----- Movement input -----
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

    // Jump
    if ((down("Space") || down("ArrowUp")) && player.onGround) {
      player.vy = -PHYS.jump;
      player.onGround = false;

      if (GAME.stage === 1 && !GAME.tutorial.jump) {
        GAME.tutorial.jump = true;
        setTutorialChecks();
      }
    }

    // Dash
    if (GAME.dashUnlocked && down("ShiftLeft") && player.dashCd <= 0) {
      player.vx = player.facing * (maxSpeed * 2.2);
      player.dashCd = 1.0;
    }

    // Throw
    if (down("KeyF")) {
      if (player.throwCd <= 0) {
        throwWeapon();
      }
    }

    // Tutorial move check
    if (GAME.stage === 1 && !GAME.tutorial.move) {
      if (Math.abs(player.vx) > 40) {
        GAME.tutorial.move = true;
        setTutorialChecks();
      }
    }

    // ----- Gravity -----
    player.vy += PHYS.gravity * dt;

    // ----- Collisions -----
    resolvePlatformCollisions(player, dt);

    // ----- Pickups -----
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

    // ----- Enemies -----
    for (let i = GAME.enemies.length - 1; i >= 0; i--) {
      const e = GAME.enemies[i];

      // Think
      enemyThink(e, dt);

      // Physics
      e.vy += PHYS.gravity * dt;
      resolvePlatformCollisions(e, dt);

      // If anchored to a platform, lock their “ground” to that platform (prevents drift)
      if (e.platform) {
        // snap to platform top if close
        const desiredY = e.platform.y - e.h;
        if (Math.abs(e.y - desiredY) < 8) {
          e.y = desiredY;
          e.vy = 0;
          e.onGround = true;
        }
      }

      // Contact damage
      if (rectsOverlap(player, e)) {
        hurtPlayer(e.damage);
      }

      // Remove dead
      if (e.hp <= 0) {
        GAME.enemies.splice(i, 1);

        // If boss died, unlock exit
        if (GAME.exitLocked && GAME.enemies.every(en => !en.isBoss)) {
          GAME.exitLocked = false;
        }
      }
    }

    // ----- Projectiles -----
    for (let i = GAME.projectiles.length - 1; i >= 0; i--) {
      const pr = GAME.projectiles[i];
      pr.life -= dt;
      pr.vy += PHYS.gravity * 0.55 * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      // hit platforms => bounce a bit then die quickly
      let hitPlat = false;
      for (const p of GAME.platforms) {
        if (rectsOverlap(pr, p)) {
          hitPlat = true;
          break;
        }
      }
      if (hitPlat) {
        pr.vx *= 0.25;
        pr.vy *= -0.25;
        pr.life = Math.min(pr.life, 0.25);
      }

      // hit enemies
      for (const e of GAME.enemies) {
        if (rectsOverlap(pr, e)) {
          e.hp -= pr.dmg;
          pr.life = 0;
          break;
        }
      }

      if (pr.life <= 0) GAME.projectiles.splice(i, 1);
    }

    // ----- Exit -----
    if (GAME.exit && !GAME.exitLocked) {
      if (rectsOverlap(player, GAME.exit)) {
        // clear stage
        openStageClear();
      }
    }

    // ----- Camera -----
    const targetCam = clamp(player.x - VIEW_W * 0.35, 0, Math.max(0, GAME.worldW - VIEW_W));
    GAME.camX = lerp(GAME.camX, targetCam, 0.08);

    // HUD tick
    updateHud();
  }

  // ---------------- Render ----------------
  function render() {
    // Clear
    ctx.clearRect(0,0,VIEW_W,VIEW_H);

    // Camera
    ctx.save();
    ctx.translate(-GAME.camX, 0);

    // Background is drawn in screen space (no cam translate), so draw it before translate
    ctx.restore();
    drawBackground();
    ctx.save();
    ctx.translate(-GAME.camX, 0);

    // Platforms
    for (const p of GAME.platforms) drawPlatform(p);

    // Pickups
    for (const p of GAME.pickups) {
      if (p.kind === "coin") drawCoin(p);
    }

    // Exit
    if (GAME.exit) drawExit(GAME.exit);

    // Projectiles
    for (const pr of GAME.projectiles) {
      drawAnchored(imgs.Weapon, pr.x, pr.y, pr.w, pr.h, DRAW.weaponScale, 0);
    }

    // Enemies + HP
    for (const e of GAME.enemies) {
      const im = e.type === "enemy2" ? imgs.Enemy2 : imgs.Enemy1;
      drawAnchored(im, e.x, e.y, e.w, e.h, DRAW.enemyScale, 4);
      drawHPBlocks(e);
    }

    // Player (blink when invuln)
    const pIm = imgs[player.char];
    if (player.invuln <= 0 || Math.floor(nowMs()/90)%2===0) {
      drawAnchored(pIm, player.x, player.y, player.w, player.h, DRAW.playerScale, 6);
    }

    ctx.restore();
  }

  // ---------------- Loop ----------------
  let last = performance.now();
  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  // ---------------- UI wiring ----------------
  btnStart.addEventListener("click", () => {
    if (!selectedChar) return;
    loadStage(1);
  });

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

  // ---------------- Boot ----------------
  async function boot() {
    // Make sure overlays are correct at start (fixes “stuck on shop page”)
    hideAllOverlays();
    menuEl.classList.remove("hidden");
    tutorialBox.classList.add("hidden");

    try {
      await loadAllAssets();
    } catch (err) {
      console.error(err);
      alert("Asset load failed. Make sure files are in /assets and names match exactly.");
      return;
    }

    buildCharacterGrid();
    updateHud();
    updatePlayerHpHud();

    requestAnimationFrame(loop);
  }

  boot();
})();
