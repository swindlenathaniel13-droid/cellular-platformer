(() => {
  "use strict";

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const canvas = $("game") || $("gameCanvas");
  if (!canvas) {
    alert("Canvas not found. Make sure index.html has <canvas id='game'>.");
    return;
  }
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
  const shopCoins = $("shopCoins");
  const shopList = $("shopList");
  const btnShopBack = $("btnShopBack");

  const loadingOverlay = $("loadingOverlay");
  const loadingFill = $("loadingFill");

  // ---------- Utils ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------- Input ----------
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    if (e.code === "Escape") togglePause();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  const down = (code) => keys.has(code);

  // ---------- RNG ----------
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

  // ---------- Assets (root OR /assets) ----------
  const ASSETS = {
    background: ["Background_Pic.png"],
    platform: ["Platform.png"],
    exit: ["Exit_Door.png"],
    enemy1: ["Enemy1.png"],
    enemy2: ["Enemy2.png"],
    coin: ["Coin.png", "coin.png"],
    weapon: ["powerup_homephone.png"],
    dash: ["Powerup_Dash.png"],
    speed: ["Powerup_Speedboost.png", "Powerup_SpeedBoost.png"],
    characters: {
      Gilly: ["Gilly.png"],
      Scott: ["Scott.png"],
      Kevin: ["Kevin.png"],
      Nate: ["Nate.png"],
      Edgar: ["Edgar.png"]
    }
  };

  const imgs = { characters: {} };

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Failed: " + url));
      im.src = url;
    });
  }

  function candidateUrls(file) {
    return [file, `./${file}`, `assets/${file}`, `./assets/${file}`];
  }

  async function loadFirst(list) {
    for (const file of list) {
      for (const url of candidateUrls(file)) {
        try { return await loadImage(url); } catch (_) {}
      }
    }
    return null;
  }

  async function loadAllAssets() {
    imgs.background = await loadFirst(ASSETS.background);
    imgs.platform = await loadFirst(ASSETS.platform);
    imgs.exit = await loadFirst(ASSETS.exit);
    imgs.enemy1 = await loadFirst(ASSETS.enemy1);
    imgs.enemy2 = await loadFirst(ASSETS.enemy2);
    imgs.coin = await loadFirst(ASSETS.coin);
    imgs.weapon = await loadFirst(ASSETS.weapon);
    imgs.dash = await loadFirst(ASSETS.dash);
    imgs.speed = await loadFirst(ASSETS.speed);

    for (const [name, opts] of Object.entries(ASSETS.characters)) {
      imgs.characters[name] = await loadFirst(opts);
    }
  }

  // ---------- Game State ----------
  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;

  const GAME = {
    mode: "menu", // menu | play | paused | stageclear | shop | loading
    stage: 1,
    coins: 0,

    dashUnlocked: false,
    speedUnlocked: false,
    shopUsedThisStage: false,

    worldW: 2400,
    worldH: 720,
    camX: 0,

    platforms: [],
    pickups: [], // {kind, x,y,w,h, value?}
    enemies: [],
    projectiles: [],
    exit: null, // {x,y,w,h}
    exitLocked: false,

    loadingT: 0,
    loadingDur: 6.5,
    pendingStage: null,

    tutorial: { move:false, jump:false, throw:false }
  };

  // ---------- Entities ----------
  const PHYS = {
    gravity: 2200,
    accel: 3200,
    maxSpeed: 360,
    jump: 860,
    friction: 0.82
  };

  const player = {
    char: "Nate",
    x: 120, y: 520,
    w: 52, h: 78,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    hp: 8, maxHp: 8,
    dashCd: 0,
    throwCd: 0
  };

  function resetPlayer(x, y) {
    player.x = x; player.y = y;
    player.vx = 0; player.vy = 0;
    player.onGround = false;
    player.facing = 1;
    player.hp = player.maxHp;
    player.dashCd = 0;
    player.throwCd = 0;
  }

  function makeEnemy(type, x, y, isBoss=false) {
    const base = {
      type, x, y,
      w: type === "enemy2" ? 56 : 48,
      h: type === "enemy2" ? 72 : 64,
      vx: 0, vy: 0,
      onGround: false,
      facing: -1,
      speed: type === "enemy2" ? 170 : 150,
      hp: type === "enemy2" ? 6 : 4,
      maxHp: type === "enemy2" ? 6 : 4,
      damage: 1,
      patrolMin: x - 150,
      patrolMax: x + 150,
      isBoss,
      jumpCd: 0
    };
    if (isBoss) {
      base.hp = type === "enemy2" ? 14 : 10;
      base.maxHp = base.hp;
      base.speed += 40;
      base.damage = 2;
    }
    return base;
  }

  // ---------- Platform collision ----------
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

    ent.x = clamp(ent.x, -200, GAME.worldW - ent.w + 200);
    ent.y = clamp(ent.y, -800, GAME.worldH - ent.h + 400);
  }

  // ---------- Enemy tracking FIX helpers ----------
  function getSupportPlatform(ent) {
    if (!ent.onGround) return null;
    const footY = ent.y + ent.h;
    let best = null;
    for (const p of GAME.platforms) {
      if (Math.abs(footY - p.y) > 2) continue;
      const overlap = Math.min(ent.x + ent.w, p.x + p.w) - Math.max(ent.x, p.x);
      if (overlap <= 1) continue;
      if (!best || overlap > best.overlap) best = { p, overlap };
    }
    return best ? best.p : null;
  }

  function sameLane(a, b, tol = 26) {
    return Math.abs((a.y + a.h) - (b.y + b.h)) <= tol;
  }

  // ---------- Drawing ----------
  const PLATFORM_H = 36;
  const SPR_PLAYER = 1.55;
  const SPR_ENEMY = 1.55;
  const SPR_EXIT = 1.75;

  function drawBackground() {
    if (!imgs.background) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0,0,VIEW_W,VIEW_H);
      return;
    }
    // simple parallax tile
    const im = imgs.background;
    const scale = VIEW_H / im.height;
    const w = im.width * scale;
    const xOff = -((GAME.camX * 0.18) % w);
    for (let x = xOff; x < VIEW_W + w; x += w) {
      ctx.drawImage(im, x, 0, w, VIEW_H);
    }
  }

  function drawPlatform(p) {
    if (!imgs.platform) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      return;
    }
    const im = imgs.platform;
    const scale = PLATFORM_H / im.height;
    const tw = im.width * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, PLATFORM_H);
    ctx.clip();
    for (let x = p.x; x < p.x + p.w; x += tw) {
      ctx.drawImage(im, x, p.y, tw, PLATFORM_H);
    }
    ctx.restore();
  }

  function drawSpriteAnchored(im, x, y, w, h, scale=1.0) {
    if (!im) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x,y,w,h);
      return;
    }
    const dw = w * scale;
    const dh = h * scale;
    const dx = x + w/2 - dw/2;
    const dy = y + h - dh; // FEET anchored
    ctx.drawImage(im, dx, dy, dw, dh);
  }

  function drawHPBlocksScreen(x, y, blocks, filled) {
    const bw=14, bh=12, gap=3;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x-6, y-6, blocks*(bw+gap)+10, bh+12);
    for (let i=0;i<blocks;i++){
      ctx.fillStyle="rgba(255,255,255,0.9)";
      ctx.fillRect(x+i*(bw+gap), y, bw, bh);
      ctx.fillStyle="rgba(0,0,0,0.9)";
      ctx.fillRect(x+i*(bw+gap)+2, y+2, bw-4, bh-4);
      if (i < filled){
        ctx.fillStyle="rgba(255,255,255,0.95)";
        ctx.fillRect(x+i*(bw+gap)+3, y+3, bw-6, bh-6);
      }
    }
  }

  function drawHPBarWorld(ent) {
    const blocks = ent.maxHp;
    const filled = clamp(ent.hp, 0, ent.maxHp);
    const bw=10, bh=6, gap=2;
    const total = blocks*(bw+gap)-gap;
    const x = ent.x + ent.w/2 - total/2;
    const y = ent.y - 12;

    ctx.fillStyle="rgba(0,0,0,0.6)";
    ctx.fillRect(x-3,y-3,total+6,bh+6);
    for (let i=0;i<blocks;i++){
      ctx.fillStyle="rgba(255,255,255,0.85)";
      ctx.fillRect(x+i*(bw+gap), y, bw, bh);
      ctx.fillStyle="rgba(0,0,0,0.95)";
      ctx.fillRect(x+i*(bw+gap)+1, y+1, bw-2, bh-2);
      if (i<filled){
        ctx.fillStyle="rgba(255,255,255,0.95)";
        ctx.fillRect(x+i*(bw+gap)+2, y+2, bw-4, bh-4);
      }
    }
  }

  // ---------- Stage building ----------
  const GROUND_Y = 620;

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

  function stage1Tutorial() {
    clearWorld();
    GAME.worldW = 2400;
    addGround(GAME.worldW);

    // Easy steps
    GAME.platforms.push({ x:380, y:520, w:320, h:PLATFORM_H });
    GAME.platforms.push({ x:760, y:440, w:320, h:PLATFORM_H });
    GAME.platforms.push({ x:1180, y:520, w:320, h:PLATFORM_H });

    // Coins on path
    for (let i=0;i<6;i++){
      GAME.pickups.push({ kind:"coin", x: 420 + i*120, y: 480 - (i%2)*40, w:24, h:24, value:1 });
    }

    // One simple enemy
    GAME.enemies.push(makeEnemy("enemy1", 900, GROUND_Y-64));

    // Exit ALWAYS reachable on ground
    GAME.exit = { x: GAME.worldW - 160, y: GROUND_Y - 110, w: 70, h: 110 };

    resetPlayer(120, GROUND_Y - player.h);

    // Tutorial visible
    GAME.tutorial = { move:false, jump:false, throw:false };
    tutorialBox.classList.remove("hidden");
    setTutState();
  }

  function stage2BossArena() {
    clearWorld();
    GAME.worldW = 2100;
    addGround(GAME.worldW);

    // Arena platforms
    GAME.platforms.push({ x:420, y:520, w:360, h:PLATFORM_H });
    GAME.platforms.push({ x:860, y:440, w:360, h:PLATFORM_H });
    GAME.platforms.push({ x:1300, y:520, w:360, h:PLATFORM_H });

    // Boss
    const boss = makeEnemy("enemy2", 1500, GROUND_Y-72, true);
    GAME.enemies.push(boss);
    GAME.exitLocked = true;

    // Exit on ground but locked until boss dies
    GAME.exit = { x: GAME.worldW - 160, y: GROUND_Y - 110, w: 70, h: 110 };

    resetPlayer(120, GROUND_Y - player.h);
    tutorialBox.classList.add("hidden");
  }

  function generateProcedural(stage) {
    clearWorld();
    const seed = (Date.now() & 0xffffffff) ^ (stage * 99991);
    const rng = mulberry32(seed);

    GAME.worldW = 2400 + stage * 220;
    addGround(GAME.worldW);

    // SAFE: exit always on ground path
    GAME.exit = { x: GAME.worldW - 160, y: GROUND_Y - 110, w: 70, h: 110 };

    // Main “optional” platform path above ground (safe spacing)
    let x = 260;
    let y = 520;
    const count = 7 + Math.min(8, stage); // not too crazy
    for (let i=0;i<count;i++){
      const w = 260 + Math.floor(rng()*140);
      const dx = 180 + Math.floor(rng()*70);     // <= 250ish
      const dy = -90 + Math.floor(rng()*180);    // -90..+90
      x += dx;
      y = clamp(y + dy, 260, 560);
      if (x + w > GAME.worldW - 260) break;
      GAME.platforms.push({ x, y, w, h: PLATFORM_H });

      // coins above platform
      const coinN = 2 + Math.floor(rng()*3);
      for (let c=0;c<coinN;c++){
        GAME.pickups.push({ kind:"coin", x: x + 30 + c*70, y: y - 44, w:24, h:24, value:1 });
      }

      // enemy sometimes (patrol platform)
      if (rng() < 0.55) {
        const t = rng() < 0.5 ? "enemy1" : "enemy2";
        const e = makeEnemy(t, x + 70 + Math.floor(rng()*120), y - (t==="enemy2"?72:64), false);
        e.patrolMin = x + 10;
        e.patrolMax = x + w - e.w - 10;
        GAME.enemies.push(e);
      }
    }

    // occasional pickups
    if (!GAME.dashUnlocked && rng() < 0.6) {
      GAME.pickups.push({ kind:"dash", x: 700, y: 560, w: 28, h: 28 });
    }
    if (!GAME.speedUnlocked && rng() < 0.5) {
      GAME.pickups.push({ kind:"speed", x: 1300, y: 400, w: 28, h: 28 });
    }

    resetPlayer(120, GROUND_Y - player.h);
    tutorialBox.classList.add("hidden");
  }

  function loadStage(n) {
    GAME.stage = n;
    GAME.shopUsedThisStage = false;

    if (n === 1) stage1Tutorial();
    else if (n === 2) stage2BossArena();
    else generateProcedural(n);

    GAME.mode = "play";
    hideAllOverlays();
    // menu should be hidden once playing
    menuEl.classList.add("hidden");

    // camera reset
    GAME.camX = 0;
    updateHud();
  }

  // ---------- Tutorial UI ----------
  function setTutState() {
    tutMove.classList.toggle("done", GAME.tutorial.move);
    tutJump.classList.toggle("done", GAME.tutorial.jump);
    tutThrow.classList.toggle("done", GAME.tutorial.throw);
    if (GAME.tutorial.move && GAME.tutorial.jump && GAME.tutorial.throw) {
      tutorialBox.classList.add("hidden");
    }
  }

  // ---------- Shop ----------
  const SHOP_ITEMS = [
    {
      id:"dash",
      name:"Unlock Dash",
      desc:"Press Shift to dash forward.",
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
      desc:"Increases your max HP by 1.",
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
    shopCoins.textContent = String(GAME.coins);
    shopList.innerHTML = "";

    for (const item of SHOP_ITEMS) {
      const wrap = document.createElement("div");
      wrap.style.marginTop = "10px";
      wrap.style.padding = "10px";
      wrap.style.border = "1px solid rgba(255,255,255,.12)";
      wrap.style.borderRadius = "12px";
      wrap.style.background = "rgba(0,0,0,.18)";

      const title = document.createElement("div");
      title.style.fontWeight = "900";
      title.textContent = item.name;

      const desc = document.createElement("div");
      desc.style.fontSize = "12px";
      desc.style.color = "rgba(255,255,255,.68)";
      desc.style.marginTop = "4px";
      desc.textContent = item.desc;

      const meta = document.createElement("div");
      meta.style.display = "flex";
      meta.style.justifyContent = "space-between";
      meta.style.alignItems = "center";
      meta.style.marginTop = "8px";

      const price = document.createElement("div");
      price.style.fontFamily = '"Press Start 2P", monospace';
      price.style.fontSize = "11px";
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
      };

      meta.appendChild(price);
      meta.appendChild(btn);

      wrap.appendChild(title);
      wrap.appendChild(desc);
      wrap.appendChild(meta);
      shopList.appendChild(wrap);
    }
  }

  // ---------- Overlays ----------
  function hideAllOverlays() {
    pauseOverlay.classList.add("hidden");
    stageClearOverlay.classList.add("hidden");
    shopOverlay.classList.add("hidden");
    loadingOverlay.classList.add("hidden");
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

  // ---------- HUD ----------
  function updateHud() {
    hudStage.textContent = `Level: ${GAME.stage}`;
    hudCoins.textContent = `Coins: ${GAME.coins}`;
    hudDash.textContent = GAME.dashUnlocked ? (player.dashCd > 0 ? "Dash: Cooling" : "Dash: Ready") : "Dash: Locked";
    hudSpeed.textContent = GAME.speedUnlocked ? "Speed: Boosted" : "Speed: Normal";
    hudThrow.textContent = player.throwCd > 0 ? "Throw: Cooling" : "Throw: Ready";
  }

  // ---------- Character select ----------
  const PLAYABLE = ["Gilly","Scott","Kevin","Nate"];
  let selectedChar = null;

  function buildCharacterGrid() {
    charGridEl.innerHTML = "";

    for (const name of PLAYABLE) {
      const card = document.createElement("div");
      card.className = "char-card";
      const im = document.createElement("img");
      im.alt = name;
      im.src = (imgs.characters[name] && imgs.characters[name].src) ? imgs.characters[name].src : "";
      if (!im.src) im.style.background = "rgba(255,255,255,.08)";

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

  // ---------- Projectiles ----------
  function throwWeapon() {
    if (player.throwCd > 0) return;
    player.throwCd = 0.45;

    GAME.projectiles.push({
      x: player.x + player.w/2 + player.facing*18,
      y: player.y + 18,
      w: 22, h: 22,
      vx: player.facing * 720,
      vy: -160,
      life: 1.1,
      dmg: 2
    });

    if (GAME.stage === 1) { GAME.tutorial.throw = true; setTutState(); }
  }

  // ---------- Exit / Loading ----------
  function startLoadingNextStage(nextStage) {
    GAME.mode = "loading";
    loadingOverlay.classList.remove("hidden");
    GAME.loadingT = 0;
    GAME.pendingStage = nextStage;
    loadingFill.style.width = "0%";
  }

  // ---------- Update Loop ----------
  function update(dt) {
    // loading
    if (GAME.mode === "loading") {
      GAME.loadingT += dt;
      const p = clamp(GAME.loadingT / GAME.loadingDur, 0, 1);
      loadingFill.style.width = `${Math.floor(p*100)}%`;
      if (p >= 1) {
        loadingOverlay.classList.add("hidden");
        const n = GAME.pendingStage || (GAME.stage + 1);
        GAME.pendingStage = null;
        loadStage(n);
      }
      return;
    }

    if (GAME.mode !== "play") return;

    // cooldowns
    player.dashCd = Math.max(0, player.dashCd - dt);
    player.throwCd = Math.max(0, player.throwCd - dt);

    // movement
    const speedMax = GAME.speedUnlocked ? 460 : PHYS.maxSpeed;
    let ax = 0;
    if (down("ArrowLeft") || down("KeyA")) ax -= 1;
    if (down("ArrowRight") || down("KeyD")) ax += 1;

    if (ax !== 0) {
      player.facing = ax < 0 ? -1 : 1;
      player.vx += ax * PHYS.accel * dt;
      if (GAME.stage === 1) { GAME.tutorial.move = true; setTutState(); }
    } else if (player.onGround) {
      player.vx *= PHYS.friction;
      if (Math.abs(player.vx) < 10) player.vx = 0;
    }

    player.vx = clamp(player.vx, -speedMax, speedMax);

    // jump
    if ((down("Space") || down("ArrowUp")) && player.onGround) {
      player.vy = -PHYS.jump;
      player.onGround = false;
      if (GAME.stage === 1) { GAME.tutorial.jump = true; setTutState(); }
    }

    // dash
    if (GAME.dashUnlocked && player.dashCd <= 0 && (down("ShiftLeft") || down("ShiftRight"))) {
      player.vx = player.facing * 820;
      player.dashCd = 1.15;
    }

    // throw
    if (down("KeyF")) throwWeapon();

    // gravity
    player.vy += PHYS.gravity * dt;
    resolvePlatformCollisions(player, dt);

    // pickups
    for (const pk of GAME.pickups) {
      if (pk.collected) continue;
      if (rectsOverlap(player, pk)) {
        pk.collected = true;
        if (pk.kind === "coin") GAME.coins += (pk.value || 1);
        if (pk.kind === "dash") GAME.dashUnlocked = true;
        if (pk.kind === "speed") GAME.speedUnlocked = true;
        updateHud();
      }
    }

    // projectiles
    for (const pr of GAME.projectiles) {
      pr.life -= dt;
      pr.vy += PHYS.gravity * dt * 0.6;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      // hit platform => vanish
      for (const p of GAME.platforms) {
        if (rectsOverlap(pr, p)) {
          pr.life = -1;
          break;
        }
      }

      // hit enemies
      for (const e of GAME.enemies) {
        if (e.hp <= 0) continue;
        if (rectsOverlap(pr, e)) {
          e.hp -= pr.dmg;
          pr.life = -1;
          break;
        }
      }
    }
    GAME.projectiles = GAME.projectiles.filter(p => p.life > 0);

    // enemies AI (FIXED tracking)
    let bossAlive = false;

    for (const e of GAME.enemies) {
      if (e.hp <= 0) continue;

      if (e.isBoss) bossAlive = true;

      e.jumpCd = Math.max(0, (e.jumpCd || 0) - dt);

      const dist = (player.x + player.w/2) - (e.x + e.w/2);
      const abs = Math.abs(dist);

      const plat = getSupportPlatform(e);

      // edge safe
      if (plat) {
        const left = plat.x + 6;
        const right = plat.x + plat.w - e.w - 6;
        if (e.x <= left) e.facing = 1;
        if (e.x >= right) e.facing = -1;
      }

      if (e.isBoss) {
        e.vx = clamp(Math.sign(dist) * e.speed, -e.speed, e.speed);

        const playerAbove = (player.y + player.h) < (e.y + e.h - 40);
        if (playerAbove && abs < 340 && e.onGround && e.jumpCd <= 0) {
          e.vy = -900;
          e.jumpCd = 1.05;
        }
      } else {
        const canChase = abs < 320 && sameLane(player, e, 26);
        if (canChase) e.vx = Math.sign(dist) * e.speed;
        else {
          if (e.x < e.patrolMin) e.facing = 1;
          if (e.x > e.patrolMax) e.facing = -1;
          e.vx = e.facing * e.speed * 0.85;
        }
      }

      // clamp to support platform
      if (plat) {
        const minX = plat.x + 4;
        const maxX = plat.x + plat.w - e.w - 4;
        if (e.vx < 0 && e.x <= minX) e.vx = Math.abs(e.vx);
        if (e.vx > 0 && e.x >= maxX) e.vx = -Math.abs(e.vx);
      }

      e.vy += PHYS.gravity * dt;
      resolvePlatformCollisions(e, dt);

      // contact damage
      if (rectsOverlap(player, e)) {
        const knock = -Math.sign(dist || 1);
        player.hp -= e.damage;
        player.vx = knock * 380;
        player.vy = -420;

        if (player.hp <= 0) {
          // restart stage on death
          loadStage(GAME.stage);
          return;
        }
      }
    }

    // exit locking logic
    if (GAME.stage === 2) {
      GAME.exitLocked = bossAlive;
    } else {
      GAME.exitLocked = false;
    }

    // exit check
    if (GAME.exit && rectsOverlap(player, GAME.exit)) {
      if (!GAME.exitLocked) {
        openStageClear();
      }
    }

    // camera follow
    GAME.camX = clamp(player.x - VIEW_W * 0.35, 0, Math.max(0, GAME.worldW - VIEW_W));

    updateHud();
  }

  // ---------- Render ----------
  function render() {
    drawBackground();

    ctx.save();
    ctx.translate(-GAME.camX, 0);

    // platforms
    for (const p of GAME.platforms) drawPlatform(p);

    // exit
    if (GAME.exit) {
      const im = imgs.exit;
      drawSpriteAnchored(im, GAME.exit.x, GAME.exit.y, GAME.exit.w, GAME.exit.h, SPR_EXIT);
      if (GAME.exitLocked) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(GAME.exit.x, GAME.exit.y, GAME.exit.w, GAME.exit.h);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillText("LOCK", GAME.exit.x + 6, GAME.exit.y + 28);
      }
    }

    // pickups
    for (const pk of GAME.pickups) {
      if (pk.collected) continue;
      let im = null;
      if (pk.kind === "coin") im = imgs.coin;
      if (pk.kind === "dash") im = imgs.dash;
      if (pk.kind === "speed") im = imgs.speed;

      if (im) ctx.drawImage(im, pk.x, pk.y, pk.w, pk.h);
      else {
        ctx.fillStyle = pk.kind === "coin" ? "gold" : "cyan";
        ctx.beginPath(); ctx.arc(pk.x+pk.w/2, pk.y+pk.h/2, pk.w/2, 0, Math.PI*2); ctx.fill();
      }
    }

    // enemies
    for (const e of GAME.enemies) {
      if (e.hp <= 0) continue;
      const im = e.type === "enemy2" ? imgs.enemy2 : imgs.enemy1;
      drawSpriteAnchored(im, e.x, e.y, e.w, e.h, SPR_ENEMY);
      drawHPBarWorld(e);
    }

    // projectiles
    for (const pr of GAME.projectiles) {
      if (imgs.weapon) ctx.drawImage(imgs.weapon, pr.x, pr.y, pr.w, pr.h);
      else {
        ctx.fillStyle = "white";
        ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
      }
    }

    // player
    drawSpriteAnchored(imgs.characters[player.char], player.x, player.y, player.w, player.h, SPR_PLAYER);

    ctx.restore();

    // Player HP top-right
    drawHPBlocksScreen(VIEW_W - 8*17 - 20, 18, player.maxHp, player.hp);
  }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(t) {
    const dt = clamp((t - last) / 1000, 0, 0.033);
    last = t;

    update(dt);
    render();

    requestAnimationFrame(frame);
  }

  // ---------- Buttons ----------
  btnStart.addEventListener("click", () => {
    if (!selectedChar) return;
    loadStage(1);
  });

  btnResume.addEventListener("click", () => togglePause());
  btnRestart.addEventListener("click", () => loadStage(GAME.stage));
  btnBackMenu.addEventListener("click", () => {
    GAME.mode = "menu";
    hideAllOverlays();
    menuEl.classList.remove("hidden");
    btnStart.disabled = !selectedChar;
  });

  btnShop.addEventListener("click", () => {
    if (GAME.shopUsedThisStage) return;
    stageClearOverlay.classList.add("hidden");
    openShop();
  });

  btnShopBack.addEventListener("click", () => closeShopBackToClear());

  btnNextStage.addEventListener("click", () => {
    hideAllOverlays();
    stageClearOverlay.classList.add("hidden");
    startLoadingNextStage(GAME.stage + 1);
  });

  btnClearRestart.addEventListener("click", () => {
    hideAllOverlays();
    loadStage(GAME.stage);
  });

  // ---------- Boot ----------
  async function boot() {
    try {
      await loadAllAssets();
    } catch (e) {
      console.warn("Asset load had issues:", e);
    }

    buildCharacterGrid();
    menuEl.classList.remove("hidden"); // always show menu on boot
    btnStart.disabled = true;

    updateHud();
    requestAnimationFrame(frame);
  }

  boot();
})();
