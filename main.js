(() => {
  "use strict";

  // =========================
  // Canvas / View
  // =========================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const VIEW_W = canvas.width;
  const VIEW_H = canvas.height;

  // =========================
  // Safe DOM getter
  // =========================
  const $ = (id) => document.getElementById(id);

  const bootOverlay = $("bootOverlay");
  const bootBar = $("bootBar");
  const bootPct = $("bootPct");

  const selectOverlay = $("selectOverlay");
  const charRow = $("charRow");
  const btnStart = $("btnStart");

  const tutorialOverlay = $("tutorialOverlay");
  const tMove = $("tMove");
  const tJump = $("tJump");
  const tThrow = $("tThrow");

  const pauseOverlay = $("pauseOverlay");
  const btnResume = $("btnResume");
  const btnRestart = $("btnRestart");

  const shopOverlay = $("shopOverlay");
  const shopCoins = $("shopCoins");
  const shopList = $("shopList");
  const btnShopContinue = $("btnShopContinue");

  const transitionOverlay = $("transitionOverlay");
  const transBar = $("transBar");
  const transText = $("transText");

  const hudLeft = $("hudLeft");
  const hudRight = $("hudRight");

  // =========================
  // Assets
  // =========================
  const ASSET_BASE = "assets/";
  const FILES = {
    Background_Pic: "Background_Pic.png",
    Platform: "Platform.png",
    CheckpointFlag: "CheckpointFlag.png",
    Coin: "Coin.png",
    Enemy1: "Enemy1.png",
    Enemy2: "Enemy2.png",
    Exit_Door: "Exit_Door.png",
    Gilly: "Gilly.png",
    Kevin: "Kevin.png",
    Nate: "Nate.png",
    Scott: "Scott.png",
    Edgar: "Edgar.png",
    Powerup_Dash: "Powerup_Dash.png",
    Powerup_Speedboost: "Powerup_Speedboost.png",
    Weapon: "powerup_homephone.png",
  };

  /** @type {Record<string,HTMLImageElement>} */
  const imgs = {};

  function loadAllImages(onProgress) {
    const entries = Object.entries(FILES);
    let done = 0;

    return new Promise((resolve) => {
      for (const [k, filename] of entries) {
        const img = new Image();
        img.src = ASSET_BASE + filename;
        img.onload = () => {
          done++;
          imgs[k] = img;
          onProgress?.(done / entries.length);
          if (done === entries.length) resolve();
        };
        img.onerror = () => {
          console.warn("Missing asset:", img.src);
          done++;
          imgs[k] = img;
          onProgress?.(done / entries.length);
          if (done === entries.length) resolve();
        };
      }
    });
  }

  // =========================
  // RNG
  // =========================
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function approach(cur, target, maxDelta) {
    if (cur < target) return Math.min(target, cur + maxDelta);
    return Math.max(target, cur - maxDelta);
  }

  function formatTimeSec(sec) {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec - Math.floor(sec)) * 10);
    return `${m}:${String(s).padStart(2, "0")}.${ms}`;
  }

  // =========================
  // Input
  // =========================
  const keys = new Set();

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","Enter","ShiftLeft","KeyA","KeyD","KeyF","Escape"].includes(e.code)) {
      e.preventDefault();
    }
    keys.add(e.code);

    if (GAME.mode === "STAGE_RESULTS" && (e.code === "Space" || e.code === "Enter")) {
      proceedFromStageResults();
      return;
    }

    if (e.code === "Escape") togglePause();
  });

  window.addEventListener("keyup", (e) => keys.delete(e.code));

  function down(...codes) { return codes.some(c => keys.has(c)); }

  // =========================
  // Constants / Difficulty Knobs
  // =========================
  const GRAVITY = 2000;
  const FLOOR_Y = 640;
  const PLATFORM_H = 40;

  // Platform difficulty knobs (tweak these safely)
  const DIFF = {
    // pits (ground gaps)
    pitsStartLevel: 2,
    pitCountBase: 2,
    pitCountPer2Levels: 1,         // +1 pit every 2 levels
    pitGapMin: 150,
    pitGapMax: 240,
    groundSegMin: 320,
    groundSegMax: 600,

    // critical path jumps (always doable)
    gapMin: 160,
    gapMaxCap: 270,                // keep < ~290 so it’s always doable
    riseMax: 170,
    dropMax: 220,
    platWMin: 320,
    platWMax: 560,

    // extra side challenge platforms
    sidePlatChance: 0.35,
  };

  const MOVE_ACCEL = 2600;
  const MOVE_DECEL = 3200;

  const BASE_PLAYER = {
    w: 44,
    h: 64,
    drawW: 84,
    drawH: 84,
    speed: 320,
    jumpV: -930,
    dashV: 860,
    dashTime: 0.13,
    throwCd: 0.35,
    baseMaxHp: 10,
    baseThrowDmg: 18,
  };

  const ENEMY = {
    w: 46,
    h: 56,
    drawW: 78,
    drawH: 78,
    speed1: 150,
    speed2: 180,

    aggro: 620,
    meleeRange: 40,
    meleeCd: 0.85,

    // platform-aware brain
    edgePad: 8,           // don’t walk right to the edge
    safeDropMax: 360,     // only drop if there’s a landing within this distance
    jumpUpMax: 190,       // only jump up to platforms within this rise
    jumpV: -760,          // enemy jump
    stuckTime: 1.1,       // if not making progress, try something else
  };

  // =========================
  // Game State
  // =========================
  const GAME = {
    mode: "BOOT",
    level: 1,
    worldW: 2600,
    camX: 0,

    toastText: "",
    toastT: 0,

    exitLocked: true,
    stageCleared: false,
    shopAvailable: false,

    platforms: [],   // {x,y,w,h, kind:'ground'|'plat'}
    pickups: [],
    enemies: [],
    projectiles: [],

    exit: { x: 0, y: 0, w: 120, h: 180 },

    tutorialDone: (localStorage.getItem("cp_tutorialDone") === "1"),

    // death sequence
    deathPending: false,
    deathTimer: 0,

    // per-stage stats
    stageStartMs: 0,
    stageCoinsStart: 0,
    stageDamageTaken: 0,

    // results screen
    resultsTimer: 0,
    resultsData: null,

    player: {
      w: BASE_PLAYER.w,
      h: BASE_PLAYER.h,
      x: 120, y: FLOOR_Y - BASE_PLAYER.h,
      vx: 0, vy: 0,
      onGround: false,
      face: 1,

      hp: BASE_PLAYER.baseMaxHp,
      maxHp: BASE_PLAYER.baseMaxHp,
      iT: 0,

      coins: 0,

      hasDash: false,
      dashCd: 0,
      dashT: 0,
      dashDir: 1,

      speedMult: 1,
      jumpMult: 1,
      armor: 0,
      magnet: false,
      dashCdMult: 1,
      throwCdMult: 1,
      throwDmg: BASE_PLAYER.baseThrowDmg,

      charKey: "Nate",
      throwCd: 0,
    }
  };

  // =========================
  // UI helpers
  // =========================
  function show(el) { el?.classList.add("show"); }
  function hide(el) { el?.classList.remove("show"); }

  function setToast(msg, t = 2.0) {
    GAME.toastText = msg;
    GAME.toastT = t;
  }

  function setMode(m) {
    GAME.mode = m;
    (m === "BOOT") ? show(bootOverlay) : hide(bootOverlay);
    (m === "SELECT") ? show(selectOverlay) : hide(selectOverlay);
    (m === "PAUSE") ? show(pauseOverlay) : hide(pauseOverlay);
    (m === "SHOP") ? show(shopOverlay) : hide(shopOverlay);
    (m === "TRANSITION") ? show(transitionOverlay) : hide(transitionOverlay);

    ensureStageResultsOverlay();
    (m === "STAGE_RESULTS") ? show(stageResultsOverlay) : hide(stageResultsOverlay);
  }

  function pill(text) {
    const d = document.createElement("div");
    d.className = "pill";
    d.textContent = text;
    return d;
  }

  function updateHUD() {
    if (!hudLeft || !hudRight) return;

    hudLeft.innerHTML = "";
    hudRight.innerHTML = "";

    hudLeft.appendChild(pill(`Level: ${GAME.level}`));
    hudLeft.appendChild(pill(`Coins: ${GAME.player.coins}`));
    hudLeft.appendChild(pill(`Dash: ${GAME.player.hasDash ? (GAME.player.dashCd > 0 ? "Cooling" : "Ready") : "Locked"}`));
    hudLeft.appendChild(pill(`Speed: ${GAME.player.speedMult > 1 ? "Boosted" : "Normal"}`));
    hudLeft.appendChild(pill(`Throw: ${GAME.player.throwCd > 0 ? "Cooling" : "Ready"}`));

    hudRight.appendChild(pill(`HP: ${GAME.player.hp}/${GAME.player.maxHp}`));
  }

  // =========================
  // Confirm Overlay (dynamic)
  // =========================
  let confirmOverlay = null;
  let confirmTitle = null;
  let confirmBody = null;
  let confirmOk = null;
  let confirmCancel = null;
  let confirmOnOk = null;

  function ensureConfirmOverlay() {
    if (confirmOverlay) return;

    confirmOverlay = document.createElement("div");
    confirmOverlay.className = "overlay";
    confirmOverlay.id = "confirmOverlay";

    const panel = document.createElement("div");
    panel.className = "panel";

    confirmTitle = document.createElement("div");
    confirmTitle.className = "panel-title big";
    confirmTitle.textContent = "CONFIRM";

    confirmBody = document.createElement("div");
    confirmBody.className = "panel-sub";
    confirmBody.style.marginTop = "10px";
    confirmBody.style.whiteSpace = "pre-line";
    confirmBody.style.lineHeight = "1.7";

    const row = document.createElement("div");
    row.className = "row";

    confirmCancel = document.createElement("button");
    confirmCancel.className = "btn ghost";
    confirmCancel.textContent = "Cancel";
    confirmCancel.addEventListener("click", () => {
      confirmOverlay.classList.remove("show");
    });

    confirmOk = document.createElement("button");
    confirmOk.className = "btn";
    confirmOk.textContent = "OK";
    confirmOk.addEventListener("click", () => {
      confirmOverlay.classList.remove("show");
      confirmOnOk?.();
      confirmOnOk = null;
    });

    row.appendChild(confirmCancel);
    row.appendChild(confirmOk);

    panel.appendChild(confirmTitle);
    panel.appendChild(confirmBody);
    panel.appendChild(row);
    confirmOverlay.appendChild(panel);

    const stage = document.querySelector(".stage") || document.body;
    stage.appendChild(confirmOverlay);
  }

  function openConfirm({ title, body, okText = "OK", cancelText = "Cancel", showCancel = true, onOk }) {
    ensureConfirmOverlay();
    confirmTitle.textContent = title;
    confirmBody.textContent = body;
    confirmOk.textContent = okText;
    confirmCancel.textContent = cancelText;
    confirmCancel.style.display = showCancel ? "" : "none";
    confirmOnOk = onOk || null;
    confirmOverlay.classList.add("show");
  }

  function isConfirmOpen() {
    return !!confirmOverlay && confirmOverlay.classList.contains("show");
  }

  // =========================
  // STAGE RESULTS Overlay (dynamic)
  // =========================
  let stageResultsOverlay = null;
  let srTitle = null;
  let srSub = null;
  let srGrid = null;
  let srHint = null;

  function ensureStageResultsOverlay() {
    if (stageResultsOverlay) return;

    stageResultsOverlay = document.createElement("div");
    stageResultsOverlay.className = "overlay";
    stageResultsOverlay.id = "stageResultsOverlay";

    const panel = document.createElement("div");
    panel.className = "panel";
    panel.style.maxWidth = "780px";

    srTitle = document.createElement("div");
    srTitle.className = "panel-title big";
    srTitle.textContent = "STAGE COMPLETE";

    srSub = document.createElement("div");
    srSub.className = "panel-sub";
    srSub.style.marginTop = "8px";
    srSub.style.whiteSpace = "pre-line";

    srGrid = document.createElement("div");
    srGrid.style.marginTop = "14px";
    srGrid.style.display = "grid";
    srGrid.style.gridTemplateColumns = "1fr 1fr 1fr";
    srGrid.style.gap = "10px";

    srHint = document.createElement("div");
    srHint.className = "panel-sub";
    srHint.style.marginTop = "14px";
    srHint.style.opacity = "0.9";
    srHint.textContent = "Press Space/Enter to continue";

    panel.appendChild(srTitle);
    panel.appendChild(srSub);
    panel.appendChild(srGrid);
    panel.appendChild(srHint);

    stageResultsOverlay.appendChild(panel);

    const stage = document.querySelector(".stage") || document.body;
    stage.appendChild(stageResultsOverlay);
  }

  function makeStatCard(label, value) {
    const box = document.createElement("div");
    box.style.border = "1px solid rgba(255,255,255,0.14)";
    box.style.borderRadius = "14px";
    box.style.padding = "12px 12px";
    box.style.background = "rgba(0,0,0,0.25)";

    const a = document.createElement("div");
    a.style.fontFamily = '"Press Start 2P", monospace';
    a.style.fontSize = "10px";
    a.style.opacity = "0.9";
    a.textContent = label;

    const b = document.createElement("div");
    b.style.marginTop = "10px";
    b.style.fontFamily = '"Press Start 2P", monospace';
    b.style.fontSize = "16px";
    b.textContent = value;

    box.appendChild(a);
    box.appendChild(b);
    return box;
  }

  function openStageResults() {
    ensureStageResultsOverlay();

    const now = performance.now();
    const timeSec = (now - GAME.stageStartMs) / 1000;
    const coinsStage = Math.max(0, GAME.player.coins - GAME.stageCoinsStart);
    const dmgStage = Math.max(0, GAME.stageDamageTaken);

    GAME.resultsData = { level: GAME.level, coins: coinsStage, dmg: dmgStage, timeSec };

    srTitle.textContent = `STAGE ${GAME.level} COMPLETE`;
    srSub.textContent = "Signal locked.\nPreparing next stage…";

    srGrid.innerHTML = "";
    srGrid.appendChild(makeStatCard("COINS", String(coinsStage)));
    srGrid.appendChild(makeStatCard("DAMAGE", String(dmgStage)));
    srGrid.appendChild(makeStatCard("TIME", formatTimeSec(timeSec)));

    srHint.textContent = "Press Space/Enter to continue";

    GAME.resultsTimer = 1.6;
    setMode("STAGE_RESULTS");
  }

  function proceedFromStageResults() {
    if (GAME.mode !== "STAGE_RESULTS") return;
    GAME.resultsTimer = 0;
    setMode("TRANSITION");
    beginTransitionToNextLevel();
  }

  // =========================
  // Character select
  // =========================
  const playable = ["Gilly","Scott","Kevin","Nate","Edgar"];
  let selectedChar = "";

  function buildCharSelect() {
    if (!charRow || !btnStart) return;

    charRow.innerHTML = "";
    selectedChar = "";
    btnStart.disabled = true;

    for (const key of playable) {
      const card = document.createElement("div");
      card.className = "charCard";

      const thumb = document.createElement("div");
      thumb.className = "charThumb";
      const im = document.createElement("img");
      im.src = imgs[key]?.src || (ASSET_BASE + FILES[key]);
      thumb.appendChild(im);

      const nm = document.createElement("div");
      nm.className = "charName";
      nm.textContent = key;

      card.appendChild(thumb);
      card.appendChild(nm);

      card.addEventListener("click", () => {
        selectedChar = key;
        [...charRow.querySelectorAll(".charCard")].forEach(x => x.classList.remove("selected"));
        card.classList.add("selected");
        btnStart.disabled = false;
      });

      charRow.appendChild(card);
    }
  }

  btnStart?.addEventListener("click", () => {
    if (!selectedChar) return;
    GAME.player.charKey = selectedChar;
    startNewRun();
  });

  // =========================
  // Pause
  // =========================
  btnResume?.addEventListener("click", () => {
    if (GAME.mode === "PAUSE") setMode("PLAY");
  });

  if (btnRestart) btnRestart.textContent = "Restart Run";

  btnRestart?.addEventListener("click", () => {
    if (GAME.mode !== "PAUSE") return;

    openConfirm({
      title: "RESTART RUN?",
      body: "Back to Level 1 with FULL HEALTH.\n\nYou will LOSE all coins and ALL shop upgrades.",
      okText: "Restart",
      cancelText: "Back",
      showCancel: true,
      onOk: () => {
        restartRun("Restarted run");
        setMode("PLAY");
      }
    });
  });

  function togglePause() {
    if (GAME.deathPending || isConfirmOpen() || GAME.mode === "STAGE_RESULTS" || GAME.mode === "TRANSITION") return;

    if (GAME.mode === "PLAY") setMode("PAUSE");
    else if (GAME.mode === "PAUSE") setMode("PLAY");
  }

  // =========================
  // Shop
  // =========================
  btnShopContinue?.addEventListener("click", () => setMode("PLAY"));

  function openShop() {
    GAME.shopAvailable = false;
    setMode("SHOP");

    if (shopCoins) shopCoins.textContent = `Coins: ${GAME.player.coins}`;
    if (!shopList) return;

    shopList.innerHTML = "";

    const items = [
      { name: "HEAL +3", price: 6, desc: "Restore up to 3 HP.", buy: () => { GAME.player.hp = Math.min(GAME.player.maxHp, GAME.player.hp + 3); } },
      { name: "+1 MAX HP", price: 10, desc: "Permanent extra HP (this run).", buy: () => { GAME.player.maxHp += 1; GAME.player.hp = GAME.player.maxHp; } },
      { name: "+ JUMP", price: 10, desc: "Jump a bit higher.", buy: () => { GAME.player.jumpMult = Math.min(1.25, GAME.player.jumpMult + 0.06); } },
      { name: "UNLOCK DASH", price: 12, desc: "Enable Shift dash.", buy: () => { GAME.player.hasDash = true; } },
      { name: "DASH COOL↓", price: 12, desc: "Dash cools faster.", buy: () => { GAME.player.dashCdMult = Math.max(0.7, GAME.player.dashCdMult - 0.08); } },
      { name: "THROW COOL↓", price: 12, desc: "Throw more often.", buy: () => { GAME.player.throwCdMult = Math.max(0.7, GAME.player.throwCdMult - 0.08); } },
      { name: "+ THROW DMG", price: 14, desc: "Home phone hits harder.", buy: () => { GAME.player.throwDmg += 5; } },
      { name: "COIN MAGNET", price: 14, desc: "Coins drift toward you.", buy: () => { GAME.player.magnet = true; } },
      { name: "ARMOR +1", price: 16, desc: "Reduce damage (min 1).", buy: () => { GAME.player.armor = Math.min(1, GAME.player.armor + 1); } },
      { name: "SPEED BOOST", price: 12, desc: "Faster movement (stage).", buy: () => { GAME.player.speedMult = 1.18; } },
    ];

    for (const it of items) {
      const box = document.createElement("div");
      box.className = "shopItem";

      const nm = document.createElement("div");
      nm.className = "name";
      nm.textContent = it.name;

      const ds = document.createElement("div");
      ds.className = "desc";
      ds.textContent = it.desc;

      const pr = document.createElement("div");
      pr.className = "price";
      pr.textContent = `Price: ${it.price}`;

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "BUY";
      btn.disabled = GAME.player.coins < it.price;

      btn.addEventListener("click", () => {
        if (GAME.player.coins < it.price) return;
        GAME.player.coins -= it.price;
        it.buy();
        if (shopCoins) shopCoins.textContent = `Coins: ${GAME.player.coins}`;
        updateHUD();

        [...shopList.querySelectorAll("button")].forEach((b, idx) => {
          b.disabled = GAME.player.coins < items[idx].price;
        });
      });

      box.appendChild(nm);
      box.appendChild(ds);
      box.appendChild(pr);
      box.appendChild(btn);
      shopList.appendChild(box);
    }
  }

  // =========================
  // Collision helpers
  // =========================
  function rectsOverlap(a, b) {
    return (a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y);
  }

  function findSupport(ent, epsilon = 4) {
    // Find platform directly under feet (top surface)
    const footY = ent.y + ent.h;
    let best = null;
    let bestDy = Infinity;

    for (const p of GAME.platforms) {
      // must be "standing on top"
      if (footY < p.y - epsilon || footY > p.y + epsilon) continue;
      // horizontal overlap
      if (ent.x + ent.w <= p.x + 2 || ent.x >= p.x + p.w - 2) continue;

      const dy = Math.abs(footY - p.y);
      if (dy < bestDy) { bestDy = dy; best = p; }
    }
    return best;
  }

  function findLandingBelow(x, fromY, maxDrop) {
    let best = null;
    let bestY = Infinity;
    for (const p of GAME.platforms) {
      if (p.y <= fromY + 8) continue;
      if (p.y > fromY + maxDrop) continue;
      if (x < p.x || x > p.x + p.w) continue;
      if (p.y < bestY) { bestY = p.y; best = p; }
    }
    return best;
  }

  function moveAndCollide(ent, dt) {
    ent.onGround = false;

    // X
    ent.x += ent.vx * dt;
    for (const p of GAME.platforms) {
      if (!rectsOverlap(ent, p)) continue;
      if (ent.vx > 0) ent.x = p.x - ent.w;
      else if (ent.vx < 0) ent.x = p.x + p.w;
      ent.vx = 0;
    }

    // Y
    ent.y += ent.vy * dt;
    for (const p of GAME.platforms) {
      if (!rectsOverlap(ent, p)) continue;
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

  // =========================
  // World / generation
  // =========================
  function clearWorld() {
    GAME.platforms.length = 0;
    GAME.pickups.length = 0;
    GAME.enemies.length = 0;
    GAME.projectiles.length = 0;
    GAME.stageCleared = false;
    GAME.exitLocked = true;
    GAME.toastText = "";
    GAME.toastT = 0;
  }

  function resetPlayerPos(x, y) {
    const p = GAME.player;
    p.w = BASE_PLAYER.w;
    p.h = BASE_PLAYER.h;
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0;
    p.onGround = false;
    p.face = 1;
    p.iT = 0;
    p.throwCd = 0;
    p.dashCd = 0;
    p.dashT = 0;
    p.speedMult = 1;
  }

  function addGroundWithPits(rng, level, worldW) {
    // Level 1: full ground (easy tutorial)
    if (level < DIFF.pitsStartLevel) {
      GAME.platforms.push({ x: 0, y: FLOOR_Y, w: worldW, h: VIEW_H - FLOOR_Y, kind: "ground" });
      return;
    }

    // Start segment safe
    let x = 0;
    const safeStart = 760;
    GAME.platforms.push({ x: 0, y: FLOOR_Y, w: safeStart, h: VIEW_H - FLOOR_Y, kind: "ground" });
    x = safeStart;

    const pitCount = clamp(DIFF.pitCountBase + Math.floor(level / 2) * DIFF.pitCountPer2Levels, 2, 9);

    for (let i = 0; i < pitCount; i++) {
      const segW = DIFF.groundSegMin + Math.floor(rng() * (DIFF.groundSegMax - DIFF.groundSegMin));
      const gapW = DIFF.pitGapMin + Math.floor(rng() * (DIFF.pitGapMax - DIFF.pitGapMin));

      // ground segment
      if (x + segW < worldW - 520) {
        GAME.platforms.push({ x, y: FLOOR_Y, w: segW, h: VIEW_H - FLOOR_Y, kind: "ground" });
      }
      x += segW;

      // pit (skip)
      x += gapW;

      if (x > worldW - 520) break;
    }

    // End segment safe
    if (x < worldW) {
      GAME.platforms.push({ x, y: FLOOR_Y, w: worldW - x, h: VIEW_H - FLOOR_Y, kind: "ground" });
    }
  }

  function stageGenerate(level) {
    clearWorld();
    const rng = mulberry32(1337 + level * 999);

    GAME.worldW = 2600 + Math.min(1600, level * 260);

    // ground, but broken (pits) after level 1
    addGroundWithPits(rng, level, GAME.worldW);

    // --- Critical path platforms (always jumpable) ---
    const minY = 380;
    const maxY = 540;

    // Increase challenge slowly but keep within caps
    const gapMax = Math.min(DIFF.gapMaxCap, 230 + Math.min(40, level * 6));
    const gapMin = DIFF.gapMin;

    let x = 520;
    let y = 520;

    const path = [];
    const count = 9 + Math.min(8, level);

    for (let i = 0; i < count; i++) {
      const w = DIFF.platWMin + Math.floor(rng() * (DIFF.platWMax - DIFF.platWMin));

      const dx = gapMin + Math.floor(rng() * (gapMax - gapMin));
      const dy = -DIFF.riseMax + Math.floor(rng() * (DIFF.riseMax + DIFF.dropMax));

      x += dx;
      y = clamp(y + dy, minY, maxY);

      if (x + w > GAME.worldW - 520) break;

      const plat = { x, y, w, h: PLATFORM_H, kind: "plat" };
      GAME.platforms.push(plat);
      path.push(plat);

      // coin trail on main path to guide player
      const cN = 3 + Math.floor(rng() * 4);
      for (let c = 0; c < cN; c++) {
        GAME.pickups.push({ kind: "coin", x: x + 60 + c * 90, y: y - 46, w: 24, h: 24, value: 1 });
      }

      // optional “side” platform for extra coins (challenge but optional)
      if (level >= 2 && rng() < DIFF.sidePlatChance) {
        const sideW = 220 + Math.floor(rng() * 220);
        const sideX = x + 40 + Math.floor(rng() * Math.max(10, w - sideW - 60));
        const sideY = clamp(y - (90 + Math.floor(rng() * 80)), minY, maxY);

        const side = { x: sideX, y: sideY, w: sideW, h: PLATFORM_H, kind: "plat" };
        GAME.platforms.push(side);

        // reward coins
        const sc = 2 + Math.floor(rng() * 4);
        for (let k = 0; k < sc; k++) {
          GAME.pickups.push({ kind: "coin", x: sideX + 40 + k * 70, y: sideY - 46, w: 24, h: 24, value: 1 });
        }
      }
    }

    // Ensure we always have a “final platform” for exit (prevents “just run to door”)
    const last = path.length ? path[path.length - 1] : { x: 900, y: 520, w: 720, h: PLATFORM_H };
    if (!path.length) {
      const fallback = { ...last, kind: "plat" };
      GAME.platforms.push(fallback);
      path.push(fallback);
    }

    // Final exit platform (bigger, safe)
    const exitPlat = {
      x: Math.min(GAME.worldW - 560, last.x + last.w + 180),
      y: clamp(last.y + (-60 + Math.floor(rng() * 100)), minY, maxY),
      w: 520,
      h: PLATFORM_H,
      kind: "plat"
    };
    GAME.platforms.push(exitPlat);

    // Checkpoint flag placed near end of critical path (unlocks exit)
    GAME.pickups.push({ kind: "flag", x: exitPlat.x + exitPlat.w - 120, y: exitPlat.y - 74, w: 48, h: 74 });

    // Exit placed ON the final platform, fully
    GAME.exit.w = 120;
    GAME.exit.h = 180;
    GAME.exit.x = exitPlat.x + exitPlat.w - 190;
    GAME.exit.y = exitPlat.y - GAME.exit.h;

    // Enemies: spawn ON platforms (not ground), platform-aware patrol bounds
    const enemyBudget = clamp(1 + Math.floor(level * 1.2), 1, 10);
    let spawned = 0;

    for (let i = 0; i < GAME.platforms.length && spawned < enemyBudget; i++) {
      const p = GAME.platforms[i];
      if (p.kind !== "plat") continue;
      if (p === exitPlat) continue;
      if (p.x < 700) continue;

      if (rng() < 0.38) {
        const type = rng() < 0.62 ? "enemy1" : "enemy2";
        const ex = p.x + 80 + Math.floor(rng() * Math.max(10, p.w - 160));
        const e = {
          kind: type,
          x: ex,
          y: p.y - ENEMY.h,
          w: ENEMY.w,
          h: ENEMY.h,
          vx: 0, vy: 0,
          onGround: true,
          hp: type === "enemy2" ? 44 : 34,
          maxHp: type === "enemy2" ? 44 : 34,
          face: rng() < 0.5 ? 1 : -1,
          meleeCd: 0,

          // AI state
          state: "PATROL",
          stuckT: 0,
          lastX: ex,

          // patrol bounds (stay on this platform)
          patrolMin: p.x + ENEMY.edgePad,
          patrolMax: p.x + p.w - ENEMY.w - ENEMY.edgePad,
        };
        GAME.enemies.push(e);
        spawned++;
      }
    }

    // powerups (still)
    if (level >= 2 && rng() < 0.22) {
      const pick = path[Math.floor(rng() * path.length)];
      GAME.pickups.push({ kind: "dash", x: pick.x + pick.w * 0.5, y: pick.y - 54, w: 36, h: 36 });
    }
    if (level >= 3 && rng() < 0.20) {
      const pick = path[Math.floor(rng() * path.length)];
      GAME.pickups.push({ kind: "speed", x: pick.x + pick.w * 0.72, y: pick.y - 54, w: 36, h: 36 });
    }

    GAME.exitLocked = true;
    setToast("Exit locked — grab the Signal Flag!", 2.0);

    resetPlayerPos(120, FLOOR_Y - BASE_PLAYER.h);

    if (tutorialOverlay) {
      if (level === 1 && !GAME.tutorialDone) tutorialOverlay.classList.remove("hidden");
      else tutorialOverlay.classList.add("hidden");
    }

    // stage stats
    GAME.stageStartMs = performance.now();
    GAME.stageCoinsStart = GAME.player.coins;
    GAME.stageDamageTaken = 0;

    updateHUD();
  }

  // =========================
  // Run reset rules
  // =========================
  function resetRunProgress() {
    const p = GAME.player;

    p.maxHp = BASE_PLAYER.baseMaxHp;
    p.hp = BASE_PLAYER.baseMaxHp;
    p.coins = 0;

    p.hasDash = false;
    p.throwDmg = BASE_PLAYER.baseThrowDmg;

    p.jumpMult = 1;
    p.armor = 0;
    p.magnet = false;
    p.dashCdMult = 1;
    p.throwCdMult = 1;

    p.throwCd = 0;
    p.dashCd = 0;
    p.dashT = 0;
    p.speedMult = 1;

    GAME.stageStartMs = performance.now();
    GAME.stageCoinsStart = 0;
    GAME.stageDamageTaken = 0;
  }

  function restartRun(toastMsg = "Run restarted") {
    GAME.deathPending = false;
    GAME.deathTimer = 0;

    resetRunProgress();
    GAME.level = 1;
    stageGenerate(1);
    setToast(toastMsg, 1.6);
    updateHUD();
  }

  // =========================
  // Player / gameplay
  // =========================
  function applyMagnet(dt) {
    if (!GAME.player.magnet) return;
    const p = GAME.player;
    const radius = 220;

    for (const it of GAME.pickups) {
      if (it.kind !== "coin") continue;
      const cx = it.x + it.w/2;
      const cy = it.y + it.h/2;
      const px = p.x + p.w/2;
      const py = p.y + p.h/2;
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      if (d < 1 || d > radius) continue;

      const pull = (1 - d / radius) * 380;
      it.x += (dx / d) * pull * dt;
      it.y += (dy / d) * pull * dt;
    }
  }

  function updatePlayer(dt) {
    const p = GAME.player;

    p.iT = Math.max(0, p.iT - dt);
    p.throwCd = Math.max(0, p.throwCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.dashT = Math.max(0, p.dashT - dt);

    // tutorial checks
    if (GAME.level === 1 && tutorialOverlay && !tutorialOverlay.classList.contains("hidden")) {
      if (down("ArrowLeft","ArrowRight","KeyA","KeyD")) tMove && (tMove.checked = true);
      if (down("Space")) tJump && (tJump.checked = true);
      if (down("KeyF")) tThrow && (tThrow.checked = true);

      if (tMove?.checked && tJump?.checked && tThrow?.checked) {
        tutorialOverlay.classList.add("hidden");
        GAME.tutorialDone = true;
        localStorage.setItem("cp_tutorialDone", "1");
      }
    }

    // dash
    if (p.hasDash && p.dashCd <= 0 && down("ShiftLeft") && p.dashT <= 0) {
      p.dashT = BASE_PLAYER.dashTime;
      p.dashDir = p.face;
      p.dashCd = 1.0 * p.dashCdMult;
    }

    const moveDir = (down("ArrowRight","KeyD") ? 1 : 0) + (down("ArrowLeft","KeyA") ? -1 : 0);
    if (moveDir !== 0) p.face = moveDir;

    const maxSpeed = BASE_PLAYER.speed * p.speedMult;
    const targetVx = (p.dashT > 0) ? (p.dashDir * BASE_PLAYER.dashV) : (moveDir * maxSpeed);

    const accel = (Math.abs(targetVx) > Math.abs(p.vx)) ? MOVE_ACCEL : MOVE_DECEL;
    p.vx = approach(p.vx, targetVx, accel * dt);

    p.vy += GRAVITY * dt;

    if (down("Space") && p.onGround) {
      p.vy = BASE_PLAYER.jumpV * p.jumpMult;
      p.onGround = false;
    }

    moveAndCollide(p, dt);
    p.x = clamp(p.x, 0, GAME.worldW - p.w);

    // falling reset + damage
    if (p.y > VIEW_H + 400) {
      const dmg = Math.max(1, 1 - p.armor);
      p.hp = Math.max(0, p.hp - dmg);
      GAME.stageDamageTaken += dmg;

      resetPlayerPos(120, FLOOR_Y - BASE_PLAYER.h);
      setToast(`Fell! -${dmg} HP`, 1.2);
      updateHUD();
    }

    // throw
    if (down("KeyF") && p.throwCd <= 0) {
      p.throwCd = BASE_PLAYER.throwCd * p.throwCdMult;
      const spd = 720;
      GAME.projectiles.push({
        x: p.x + p.w/2 + p.face * 18,
        y: p.y + 22,
        vx: p.face * spd,
        vy: -120,
        w: 28, h: 28,
        t: 1.8,
        dmg: p.throwDmg
      });
    }
  }

  // =========================
  // Enemy AI (platform-aware)
  // =========================
  function updateEnemies(dt) {
    const p = GAME.player;
    const pPlat = findSupport(p);

    for (const e of GAME.enemies) {
      if (e.hp <= 0) continue;

      e.vy += GRAVITY * dt;
      e.meleeCd = Math.max(0, e.meleeCd - dt);

      const dx = (p.x + p.w/2) - (e.x + e.w/2);
      const dist = Math.abs(dx);
      e.face = dx >= 0 ? 1 : -1;

      const is2 = e.kind === "enemy2";
      const speed = is2 ? ENEMY.speed2 : ENEMY.speed1;

      const ePlat = findSupport(e);

      // Stuck detection
      if (Math.abs(e.x - e.lastX) < 6) e.stuckT += dt;
      else e.stuckT = 0;
      e.lastX = e.x;

      const aggro = dist < ENEMY.aggro;

      // Decide state
      if (aggro) e.state = "CHASE";
      else e.state = "PATROL";

      let targetVx = 0;

      if (e.state === "PATROL") {
        // edge-aware patrol within bounds
        if (e.face > 0 && e.x >= e.patrolMax) e.face = -1;
        if (e.face < 0 && e.x <= e.patrolMin) e.face = 1;
        targetVx = e.face * speed * 0.6;

        // if no platform under and falling, stop forcing direction
        if (!ePlat && e.vy > 0) targetVx = 0;
      } else {
        // CHASE logic
        if (ePlat && pPlat && ePlat === pPlat) {
          // Same platform: chase directly
          targetVx = e.face * speed;
        } else if (ePlat && pPlat) {
          // Different platforms: try smart drop or smart jump
          const playerAbove = (pPlat.y + 2) < (ePlat.y);
          const playerBelow = (pPlat.y - 2) > (ePlat.y);

          if (playerBelow) {
            // Move toward an edge that can safely drop onto a platform below near player
            const leftEdgeX = ePlat.x + ENEMY.edgePad;
            const rightEdgeX = ePlat.x + ePlat.w - ENEMY.edgePad;

            const wantX = clamp(p.x + p.w/2, ePlat.x + 30, ePlat.x + ePlat.w - 30);
            const goDir = (wantX > (e.x + e.w/2)) ? 1 : -1;

            // If near edge in the direction, only step off if there's a landing
            const edgeX = (goDir > 0) ? (ePlat.x + ePlat.w - 2) : (ePlat.x + 2);
            const landing = findLandingBelow(edgeX, ePlat.y, ENEMY.safeDropMax);

            if (landing) {
              // safe to drop
              targetVx = goDir * speed;
            } else {
              // not safe: chase toward player x but stop before edge
              const stopMin = leftEdgeX;
              const stopMax = rightEdgeX - e.w;
              const desiredX = clamp(wantX - e.w/2, stopMin, stopMax);
              const dir = desiredX > e.x ? 1 : -1;
              targetVx = dir * speed * 0.85;
            }
          } else if (playerAbove) {
            // Try jump up to a reachable platform above
            const rise = ePlat.y - pPlat.y;
            if (rise <= ENEMY.jumpUpMax && e.onGround) {
              // Get under player's x (or nearest)
              const desiredX = clamp(p.x + p.w/2, ePlat.x + 40, ePlat.x + ePlat.w - 40);
              const dir = desiredX > (e.x + e.w/2) ? 1 : -1;
              targetVx = dir * speed * 0.85;

              // Jump when reasonably aligned
              if (Math.abs((e.x + e.w/2) - desiredX) < 22) {
                e.vy = ENEMY.jumpV;
              }
            } else {
              // can't jump that high: just patrol aggressively (don’t suicide)
              targetVx = e.face * speed * 0.6;
            }
          } else {
            // weird case: just move toward player x but don’t edge-dive
            const leftBound = ePlat.x + ENEMY.edgePad;
            const rightBound = ePlat.x + ePlat.w - e.w - ENEMY.edgePad;
            const desiredX = clamp(p.x, leftBound, rightBound);
            const dir = desiredX > e.x ? 1 : -1;
            targetVx = dir * speed * 0.85;
          }
        } else {
          // If we don't know platforms, default chase but less suicidal
          targetVx = e.face * speed * 0.8;
        }

        // Stuck fallback: flip direction (helps with corner traps)
        if (e.stuckT > ENEMY.stuckTime) {
          e.face *= -1;
          e.stuckT = 0;
          targetVx = e.face * speed * 0.85;
        }

        // Melee
        if (dist < ENEMY.meleeRange && e.meleeCd <= 0 && rectsOverlap(e, p)) {
          const dmg = Math.max(1, 1 - p.armor);
          if (p.iT <= 0) {
            p.hp = Math.max(0, p.hp - dmg);
            p.iT = 0.6;
            GAME.stageDamageTaken += dmg;
            setToast(`Ouch! -${dmg}`, 0.7);
            updateHUD();
          }
          e.meleeCd = ENEMY.meleeCd;
        }
      }

      // Smooth to target
      e.vx = approach(e.vx, targetVx, 1800 * dt);

      moveAndCollide(e, dt);
      e.x = clamp(e.x, 0, GAME.worldW - e.w);

      // If enemy falls off world, recover to ground
      if (e.y > VIEW_H + 300) {
        e.y = FLOOR_Y - e.h;
        e.vy = 0;
        e.onGround = true;
      }
    }
  }

  function updateProjectiles(dt) {
    for (let i = GAME.projectiles.length - 1; i >= 0; i--) {
      const pr = GAME.projectiles[i];
      pr.t -= dt;
      pr.vy += GRAVITY * 0.35 * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      for (const e of GAME.enemies) {
        if (e.hp <= 0) continue;
        if (rectsOverlap(pr, e)) {
          e.hp = Math.max(0, e.hp - pr.dmg);
          setToast("Hit!", 0.4);
          GAME.projectiles.splice(i, 1);
          break;
        }
      }

      if (pr.t <= 0 || pr.x < -200 || pr.x > GAME.worldW + 200 || pr.y > VIEW_H + 300) {
        GAME.projectiles.splice(i, 1);
      }
    }
  }

  function handlePickups() {
    const p = GAME.player;

    for (let i = GAME.pickups.length - 1; i >= 0; i--) {
      const it = GAME.pickups[i];
      if (!rectsOverlap(p, it)) continue;

      if (it.kind === "coin") {
        p.coins += it.value;
        GAME.pickups.splice(i, 1);
        updateHUD();
        continue;
      }

      if (it.kind === "dash") {
        p.hasDash = true;
        GAME.pickups.splice(i, 1);
        setToast("Dash unlocked! (Shift)", 1.6);
        updateHUD();
        continue;
      }

      if (it.kind === "speed") {
        p.speedMult = 1.18;
        GAME.pickups.splice(i, 1);
        setToast("Speed boost!", 1.2);
        updateHUD();
        continue;
      }

      if (it.kind === "flag") {
        GAME.exitLocked = false;
        GAME.pickups.splice(i, 1);
        setToast("Signal acquired — Exit unlocked!", 1.6);
        continue;
      }
    }
  }

  function handleExit() {
    const p = GAME.player;
    if (!rectsOverlap(p, GAME.exit)) return;

    if (GAME.exitLocked) {
      setToast("Exit locked — grab the Signal Flag!", 1.2);
      return;
    }

    if (!GAME.stageCleared) {
      GAME.stageCleared = true;
      openStageResults();
    }
  }

  // =========================
  // Next Stage Loading
  // =========================
  const TRANS_PHASES = [
    { label: "Fading out", dur: 0.7 },
    { label: "Generating platforms", dur: 2.2 },
    { label: "Spawning enemies", dur: 1.6 },
    { label: "Final checks", dur: 1.0 },
    { label: "Syncing signal…", dur: 1.2 },
  ];

  let transPhase = 0;
  let phaseT = 0;
  let nextLevelPending = 0;
  let genDone = false;

  function beginTransitionToNextLevel() {
    setMode("TRANSITION");
    transPhase = 0;
    phaseT = 0;
    genDone = false;
    nextLevelPending = GAME.level + 1;

    if (transBar) transBar.style.width = "0%";
    if (transText) transText.textContent = "0%";
  }

  function updateTransition(dt) {
    const phase = TRANS_PHASES[transPhase] || TRANS_PHASES[TRANS_PHASES.length - 1];
    phaseT += dt;

    const totalDur = TRANS_PHASES.reduce((a, p) => a + p.dur, 0);
    let doneDur = 0;
    for (let i = 0; i < transPhase; i++) doneDur += TRANS_PHASES[i].dur;
    const phasePct = clamp(phaseT / phase.dur, 0, 1);
    const pct = clamp((doneDur + phasePct * phase.dur) / totalDur, 0, 1);

    const pctInt = Math.floor(pct * 100);
    if (transBar) transBar.style.width = `${pctInt}%`;
    if (transText) transText.textContent = `${pctInt}%`;

    if (!genDone && transPhase >= 1) {
      genDone = true;
      GAME.level = nextLevelPending;
      stageGenerate(GAME.level);
      GAME.shopAvailable = true;
    }

    if (phaseT >= phase.dur) {
      transPhase++;
      phaseT = 0;
      if (transPhase >= TRANS_PHASES.length) {
        if (GAME.shopAvailable) openShop();
        else setMode("PLAY");
      }
    }
  }

  // =========================
  // Death behavior
  // =========================
  function triggerDeathReset() {
    if (GAME.deathPending) return;

    GAME.deathPending = true;
    GAME.deathTimer = 2.2;

    setMode("PAUSE");

    openConfirm({
      title: "YOU DIED!",
      body: "Back to Level 1 with FULL HEALTH.\n\nYou will LOSE all coins and ALL shop upgrades.\n\nRestarting in 2 seconds…",
      okText: "Restart Now",
      showCancel: false,
      onOk: () => {
        restartRun("You died — back to Level 1");
        setMode("PLAY");
      }
    });
  }

  // =========================
  // Rendering
  // =========================
  function drawBackground() {
    const bg = imgs.Background_Pic;
    if (bg && bg.complete && bg.naturalWidth) {
      const scale = Math.max(VIEW_W / bg.naturalWidth, VIEW_H / bg.naturalHeight);
      const dw = bg.naturalWidth * scale;
      const dh = bg.naturalHeight * scale;
      const dx = (VIEW_W - dw) / 2;
      const dy = (VIEW_H - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0,0,VIEW_W,VIEW_H);
    }
  }

  function drawPlatformRect(r) {
    const img = imgs.Platform;
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, r.x - GAME.camX, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(r.x - GAME.camX, r.y, r.w, r.h);
    }
  }

  function drawExit() {
    const img = imgs.Exit_Door;

    const x = GAME.exit.x - GAME.camX;
    const y = GAME.exit.y;

    const drawW = 160;
    const drawH = 220;

    const dx = x + (GAME.exit.w - drawW) / 2;
    const dy = (y + GAME.exit.h) - drawH;

    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, dx, dy, drawW, drawH);
    } else {
      ctx.fillStyle = "#ddd";
      ctx.fillRect(x, y, GAME.exit.w, GAME.exit.h);
    }

    if (GAME.exitLocked) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(dx, dy - 26, 170, 22);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText("LOCKED", dx + 8, dy - 10);
    }
  }

  function drawCoin(it, t) {
    const img = imgs.Coin;
    const bob = Math.sin(t * 6) * 3;
    const x = it.x - GAME.camX;
    const y = it.y + bob;

    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, x, y, 26, 26);
    } else {
      ctx.fillStyle = "gold";
      ctx.beginPath();
      ctx.arc(x + 12, y + 12, 12, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawPickup(it, t) {
    if (it.kind === "coin") return drawCoin(it, t);

    if (it.kind === "flag") {
      const img = imgs.CheckpointFlag;
      const x = it.x - GAME.camX;
      const y = it.y;
      const scale = 1.3;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, it.w * scale, it.h * scale);
      else { ctx.fillStyle="#fff"; ctx.fillRect(x,y,it.w,it.h); }
      return;
    }

    if (it.kind === "dash") {
      const img = imgs.Powerup_Dash;
      const x = it.x - GAME.camX;
      const y = it.y;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, 38, 38);
      else { ctx.fillStyle="#7aa2ff"; ctx.fillRect(x,y,36,36); }
      return;
    }

    if (it.kind === "speed") {
      const img = imgs.Powerup_Speedboost;
      const x = it.x - GAME.camX;
      const y = it.y;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, 38, 38);
      else { ctx.fillStyle="#55ffcc"; ctx.fillRect(x,y,36,36); }
      return;
    }
  }

  function drawEntitySprite(imgKey, ent, drawW, drawH) {
    const img = imgs[imgKey];
    const dx = ent.x - GAME.camX + (ent.w - drawW) / 2;
    const dy = ent.y + (ent.h - drawH);
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.translate(dx + drawW / 2, dy + drawH / 2);
      ctx.scale(ent.face >= 0 ? 1 : -1, 1);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      ctx.fillStyle = "#fff";
      ctx.fillRect(ent.x - GAME.camX, ent.y, ent.w, ent.h);
    }
  }

  function render(t) {
    const time = t / 1000;
    const p = GAME.player;

    GAME.camX = Math.round(clamp(p.x + p.w/2 - VIEW_W/2, 0, Math.max(0, GAME.worldW - VIEW_W)));

    drawBackground();

    for (const plat of GAME.platforms) drawPlatformRect(plat);

    for (const it of GAME.pickups) drawPickup(it, time);

    drawExit();

    for (const e of GAME.enemies) {
      if (e.hp <= 0) continue;
      const key = e.kind === "enemy2" ? "Enemy2" : "Enemy1";
      drawEntitySprite(key, e, ENEMY.drawW, ENEMY.drawH);
    }

    drawEntitySprite(GAME.player.charKey, GAME.player, BASE_PLAYER.drawW, BASE_PLAYER.drawH);

    for (const pr of GAME.projectiles) {
      const img = imgs.Weapon;
      const x = pr.x - GAME.camX;
      const y = pr.y;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, 32, 32);
      else { ctx.fillStyle="#fff"; ctx.fillRect(x,y,pr.w,pr.h); }
    }

    if (GAME.toastT > 0 && GAME.toastText) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 20, VIEW_W, 42);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText(GAME.toastText, VIEW_W / 2, 50);
      ctx.restore();
    }
  }

  // =========================
  // Loop
  // =========================
  let lastT = performance.now();

  function update(dt) {
    if (GAME.toastT > 0) GAME.toastT = Math.max(0, GAME.toastT - dt);

    if (GAME.deathPending) {
      GAME.deathTimer -= dt;
      if (GAME.deathTimer <= 0) {
        restartRun("You died — back to Level 1");
        setMode("PLAY");
      }
      return;
    }

    if (GAME.mode === "STAGE_RESULTS") {
      GAME.resultsTimer -= dt;
      if (GAME.resultsTimer <= 0) proceedFromStageResults();
      return;
    }

    if (GAME.mode === "TRANSITION") { updateTransition(dt); return; }
    if (GAME.mode !== "PLAY") return;

    applyMagnet(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    handlePickups();
    handleExit();

    if (GAME.player.hp <= 0) {
      triggerDeathReset();
      return;
    }

    updateHUD();
  }

  function loop(t) {
    const dt = clamp((t - lastT) / 1000, 0, 0.033);
    lastT = t;

    update(dt);
    render(t);

    requestAnimationFrame(loop);
  }

  // =========================
  // Run control
  // =========================
  function startNewRun() {
    restartRun("Run started");
    setMode("PLAY");
  }

  async function boot() {
    setMode("BOOT");
    await loadAllImages((p) => {
      const pct = Math.floor(p * 100);
      if (bootBar) bootBar.style.width = `${pct}%`;
      if (bootPct) bootPct.textContent = `${pct}%`;
    });

    buildCharSelect();
    setMode("SELECT");
    updateHUD();
  }

  // =========================
  // Start
  // =========================
  boot();
  requestAnimationFrame(loop);
})();
