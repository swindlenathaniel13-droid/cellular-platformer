(() => {
  "use strict";

  // =========================
  // Canvas / View
  // =========================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const VIEW_W = canvas.width;   // 1280
  const VIEW_H = canvas.height;  // 720

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

  // =========================
  // Input
  // =========================
  const keys = new Set();

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","ShiftLeft","KeyA","KeyD","KeyF","Escape"].includes(e.code)) {
      e.preventDefault();
    }
    keys.add(e.code);

    if (e.code === "Escape") togglePause();
  });

  window.addEventListener("keyup", (e) => keys.delete(e.code));

  function down(...codes) { return codes.some(c => keys.has(c)); }

  // =========================
  // Constants
  // =========================
  const GRAVITY = 2000;
  const FLOOR_Y = 640;
  const PLATFORM_H = 40;

  // smoother movement
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

    // baseline run stats
    baseMaxHp: 10,
    baseThrowDmg: 18,
  };

  const ENEMY = {
    w: 46,
    h: 56,
    drawW: 78,
    drawH: 78,
    speed1: 140,
    speed2: 170,
    aggro: 520,
    meleeRange: 40,
    meleeCd: 0.8,
  };

  // =========================
  // Game State
  // =========================
  const GAME = {
    mode: "BOOT", // BOOT, SELECT, PLAY, PAUSE, SHOP, TRANSITION
    level: 1,
    worldW: 2600,
    camX: 0,

    toastText: "",
    toastT: 0,

    exitLocked: true,
    stageCleared: false,
    shopAvailable: false,

    platforms: [],
    pickups: [],
    enemies: [],
    projectiles: [],

    exit: { x: 0, y: 0, w: 110, h: 160 },

    // tutorial persistence: once completed, never show again
    tutorialDone: (localStorage.getItem("cp_tutorialDone") === "1"),

    // death sequence
    deathPending: false,
    deathTimer: 0,

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
  let confirmOnCancel = null;

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
    confirmBody.style.lineHeight = "1.7";

    const row = document.createElement("div");
    row.className = "row";

    confirmCancel = document.createElement("button");
    confirmCancel.className = "btn ghost";
    confirmCancel.textContent = "Cancel";
    confirmCancel.addEventListener("click", () => {
      closeConfirm();
      confirmOnCancel?.();
    });

    confirmOk = document.createElement("button");
    confirmOk.className = "btn";
    confirmOk.textContent = "OK";
    confirmOk.addEventListener("click", () => {
      closeConfirm();
      confirmOnOk?.();
    });

    row.appendChild(confirmCancel);
    row.appendChild(confirmOk);

    panel.appendChild(confirmTitle);
    panel.appendChild(confirmBody);
    panel.appendChild(row);
    confirmOverlay.appendChild(panel);

    // put it over the stage if possible
    const stage = document.querySelector(".stage") || document.body;
    stage.appendChild(confirmOverlay);
  }

  function openConfirm({ title, body, okText = "OK", cancelText = "Cancel", showCancel = true, onOk, onCancel }) {
    ensureConfirmOverlay();
    confirmTitle.textContent = title;
    confirmBody.textContent = body;
    confirmOk.textContent = okText;
    confirmCancel.textContent = cancelText;
    confirmCancel.style.display = showCancel ? "" : "none";
    confirmOnOk = onOk || null;
    confirmOnCancel = onCancel || null;
    confirmOverlay.classList.add("show");
  }

  function closeConfirm() {
    confirmOverlay?.classList.remove("show");
    confirmOnOk = null;
    confirmOnCancel = null;
  }

  function isConfirmOpen() {
    return !!confirmOverlay && confirmOverlay.classList.contains("show");
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

  // Change label so it matches behavior (restart run)
  if (btnRestart) btnRestart.textContent = "Restart Run";

  btnRestart?.addEventListener("click", () => {
    if (GAME.mode !== "PAUSE") return;

    openConfirm({
      title: "RESTART RUN?",
      body: "This will send you back to Level 1 with FULL HEALTH.\n\nYou will LOSE all coins and ALL shop upgrades from this run.",
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
    // don't let ESC interfere with confirm/death sequences
    if (GAME.deathPending || isConfirmOpen()) return;

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
      { name: "+1 MAX HP", price: 10, desc: "Permanent extra HP block (this run).", buy: () => { GAME.player.maxHp += 1; GAME.player.hp = GAME.player.maxHp; } },
      { name: "+ JUMP", price: 10, desc: "Jump a bit higher (this run).", buy: () => { GAME.player.jumpMult = Math.min(1.25, GAME.player.jumpMult + 0.06); } },
      { name: "UNLOCK DASH", price: 12, desc: "Enable Shift dash (this run).", buy: () => { GAME.player.hasDash = true; } },
      { name: "DASH COOL↓", price: 12, desc: "Dash cools down faster.", buy: () => { GAME.player.dashCdMult = Math.max(0.7, GAME.player.dashCdMult - 0.08); } },
      { name: "THROW COOL↓", price: 12, desc: "Throw more often.", buy: () => { GAME.player.throwCdMult = Math.max(0.7, GAME.player.throwCdMult - 0.08); } },
      { name: "+ THROW DMG", price: 14, desc: "Home phone hits harder.", buy: () => { GAME.player.throwDmg += 5; } },
      { name: "COIN MAGNET", price: 14, desc: "Coins drift toward you.", buy: () => { GAME.player.magnet = true; } },
      { name: "ARMOR +1", price: 16, desc: "Reduce damage taken (min 1).", buy: () => { GAME.player.armor = Math.min(1, GAME.player.armor + 1); } },
      { name: "SPEED BOOST", price: 12, desc: "Faster movement (this stage).", buy: () => { GAME.player.speedMult = 1.18; } },
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

  function addGround(worldW) {
    GAME.platforms.push({ x: 0, y: FLOOR_Y, w: worldW, h: VIEW_H - FLOOR_Y });
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

  function stageGenerate(level) {
    clearWorld();
    const rng = mulberry32(1337 + level * 999);

    GAME.worldW = 2600 + Math.min(1400, level * 240);
    addGround(GAME.worldW);

    GAME.exit.w = 110;
    GAME.exit.h = 160;
    GAME.exit.x = GAME.worldW - 240;
    GAME.exit.y = FLOOR_Y - GAME.exit.h;

    // Always-completable stair path
    let x = 420;
    let y = 520;

    const minY = 380;
    const maxY = 540;

    const count = 9 + Math.min(6, level);
    const path = [];

    for (let i = 0; i < count; i++) {
      const w = 420 + Math.floor(rng() * 220);
      const dx = 240 + Math.floor(rng() * 80);
      const dy = -60 + Math.floor(rng() * 120);

      x += dx;
      y = clamp(y + dy, minY, maxY);

      if (x + w > GAME.worldW - 560) break;

      const plat = { x, y, w, h: PLATFORM_H };
      GAME.platforms.push(plat);
      path.push(plat);

      // Coins
      const cN = 2 + Math.floor(rng() * 4);
      for (let c = 0; c < cN; c++) {
        GAME.pickups.push({ kind: "coin", x: x + 60 + c * 90, y: y - 46, w: 24, h: 24, value: 1 });
      }

      // Enemies spawn on platform
      if (i > 0 && rng() < 0.55) {
        const type = rng() < 0.6 ? "enemy1" : "enemy2";
        GAME.enemies.push({
          kind: type,
          x: x + 90,
          y: y - ENEMY.h,
          w: ENEMY.w,
          h: ENEMY.h,
          vx: 0, vy: 0,
          onGround: true,
          hp: type === "enemy2" ? 40 : 30,
          maxHp: type === "enemy2" ? 40 : 30,
          face: rng() < 0.5 ? 1 : -1,
          patrolMin: x + 10,
          patrolMax: x + w - ENEMY.w - 10,
          meleeCd: 0,
        });
      }

      // powerups
      if (level >= 2 && rng() < 0.18) GAME.pickups.push({ kind: "dash", x: x + w * 0.5, y: y - 54, w: 36, h: 36 });
      if (level >= 3 && rng() < 0.16) GAME.pickups.push({ kind: "speed", x: x + w * 0.72, y: y - 54, w: 36, h: 36 });
    }

    // flag unlocks exit
    const last = path.length ? path[path.length - 1] : { x: 720, y: 520, w: 640, h: PLATFORM_H };
    if (!path.length) GAME.platforms.push(last);

    GAME.pickups.push({ kind: "flag", x: last.x + last.w - 90, y: last.y - 74, w: 48, h: 74 });

    GAME.exitLocked = true;
    setToast("Exit locked — grab the Signal Flag!", 2.0);

    resetPlayerPos(120, FLOOR_Y - BASE_PLAYER.h);

    // ✅ tutorial only shows once EVER (even when returning to level 1)
    if (tutorialOverlay) {
      if (level === 1 && !GAME.tutorialDone) tutorialOverlay.classList.remove("hidden");
      else tutorialOverlay.classList.add("hidden");
    }

    updateHUD();
  }

  // =========================
  // Run reset rules (NEW)
  // =========================
  function resetRunProgress() {
    const p = GAME.player;

    // keep chosen character + tutorialDone, wipe everything else
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

    // tutorial checks -> once completed, never again
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

    // falling damage (never kills instantly — but can)
    if (p.y > VIEW_H + 400) {
      const dmg = Math.max(1, 1 - p.armor);
      p.hp = Math.max(0, p.hp - dmg);
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

  function updateEnemies(dt) {
    const p = GAME.player;

    for (const e of GAME.enemies) {
      if (e.hp <= 0) continue;

      e.vy += GRAVITY * dt;
      e.meleeCd = Math.max(0, e.meleeCd - dt);

      const dx = (p.x + p.w/2) - (e.x + e.w/2);
      const dist = Math.abs(dx);
      e.face = dx >= 0 ? 1 : -1;

      const is2 = e.kind === "enemy2";
      const speed = is2 ? ENEMY.speed2 : ENEMY.speed1;

      let target = 0;
      if (dist < ENEMY.aggro) target = e.face * speed;
      else target = e.face * speed * 0.6;

      if (e.x < e.patrolMin) { e.x = e.patrolMin; e.face = 1; }
      if (e.x > e.patrolMax) { e.x = e.patrolMax; e.face = -1; }

      e.vx = approach(e.vx, target, 1800 * dt);

      if (dist < ENEMY.meleeRange && e.meleeCd <= 0 && rectsOverlap(e, p)) {
        const dmg = Math.max(1, 1 - p.armor);
        if (p.iT <= 0) {
          p.hp = Math.max(0, p.hp - dmg);
          p.iT = 0.6;
          setToast(`Ouch! -${dmg}`, 0.7);
          updateHUD();
        }
        e.meleeCd = ENEMY.meleeCd;
      }

      moveAndCollide(e, dt);

      e.x = clamp(e.x, 0, GAME.worldW - e.w);
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
      beginTransitionToNextLevel();
    }
  }

  // =========================
  // Next Stage Loading (existing)
  // =========================
  let transT = 0;
  const TRANS_PHASES = [
    { label: "Fading out", dur: 0.7 },
    { label: "Generating platforms", dur: 2.3 },
    { label: "Spawning enemies", dur: 1.7 },
    { label: "Final checks", dur: 1.0 },
    { label: "Syncing signal…", dur: 1.3 },
  ];

  let transPhase = 0;
  let phaseT = 0;
  let nextLevelPending = 0;
  let genDone = false;

  function beginTransitionToNextLevel() {
    setMode("TRANSITION");
    transT = 0;
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
    transT += dt;

    const totalDur = TRANS_PHASES.reduce((a, p) => a + p.dur, 0);
    let doneDur = 0;
    for (let i = 0; i < transPhase; i++) doneDur += TRANS_PHASES[i].dur;
    const phasePct = clamp(phaseT / phase.dur, 0, 1);
    const pct = clamp((doneDur + phasePct * phase.dur) / totalDur, 0, 1);

    const pctInt = Math.floor(pct * 100);
    if (transBar) transBar.style.width = `${pctInt}%`;
    if (transText) transText.textContent = `${pctInt}%`;

    // generate once overlay is up
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
  // Death behavior (NEW)
  // =========================
  function triggerDeathReset() {
    if (GAME.deathPending) return;

    GAME.deathPending = true;
    GAME.deathTimer = 2.2;

    // pause gameplay and show warning overlay
    setMode("PAUSE");

    openConfirm({
      title: "YOU DIED!",
      body: "Restarting to Level 1 with FULL HEALTH.\n\nYou will LOSE all coins and ALL shop upgrades.\n\nRestarting in 2 seconds…",
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

    const drawW = 150;
    const drawH = 210;

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

    for (let i = 1; i < GAME.platforms.length; i++) drawPlatformRect(GAME.platforms[i]);
    drawPlatformRect({ x: 0, y: FLOOR_Y, w: GAME.worldW, h: PLATFORM_H });

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

    // ✅ death countdown runs even while paused/confirm is up
    if (GAME.deathPending) {
      GAME.deathTimer -= dt;

      // update message countdown (nice touch)
      if (confirmBody) {
        const sec = Math.max(0, Math.ceil(GAME.deathTimer));
        confirmBody.textContent =
          "Restarting to Level 1 with FULL HEALTH.\n\n" +
          "You will LOSE all coins and ALL shop upgrades.\n\n" +
          `Restarting in ${sec} second${sec === 1 ? "" : "s"}…`;
      }

      if (GAME.deathTimer <= 0) {
        closeConfirm();
        restartRun("You died — back to Level 1");
        setMode("PLAY");
      }
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

    // ✅ NEW death rule: HP 0 = reset run to Level 1 (with warning)
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
    // tutorial flag persists; everything else resets
    restartRun("Run started");
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
