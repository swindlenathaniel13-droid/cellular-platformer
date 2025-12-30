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
  // DOM UI
  // =========================
  const bootOverlay = document.getElementById("bootOverlay");
  const bootBar = document.getElementById("bootBar");
  const bootPct = document.getElementById("bootPct");

  const selectOverlay = document.getElementById("selectOverlay");
  const charRow = document.getElementById("charRow");
  const btnStart = document.getElementById("btnStart");

  const tutorialOverlay = document.getElementById("tutorialOverlay");
  const tMove = document.getElementById("tMove");
  const tJump = document.getElementById("tJump");
  const tThrow = document.getElementById("tThrow");

  const pauseOverlay = document.getElementById("pauseOverlay");
  const btnResume = document.getElementById("btnResume");
  const btnRestart = document.getElementById("btnRestart");

  const shopOverlay = document.getElementById("shopOverlay");
  const shopCoins = document.getElementById("shopCoins");
  const shopList = document.getElementById("shopList");
  const btnShopContinue = document.getElementById("btnShopContinue");

  const transitionOverlay = document.getElementById("transitionOverlay");
  const transBar = document.getElementById("transBar");
  const transText = document.getElementById("transText");

  const hudLeft = document.getElementById("hudLeft");
  const hudRight = document.getElementById("hudRight");

  // =========================
  // Assets
  // =========================
  const ASSET_BASE = "assets/";

  // Names MUST match what's in your /assets folder (case sensitive)
  const FILES = {
    Background_Pic: "Background_Pic.png",
    Platform: "Platform.png",
    CheckpointFlag: "CheckpointFlag.png",
    Coin: "Coin.png",
    Edgar: "Edgar.png",
    Enemy1: "Enemy1.png",
    Enemy2: "Enemy2.png",
    Exit_Door: "Exit_Door.png",
    Gilly: "Gilly.png",
    Kevin: "Kevin.png",
    Nate: "Nate.png",
    Powerup_Dash: "Powerup_Dash.png",
    Powerup_Speedboost: "Powerup_Speedboost.png",
    Scott: "Scott.png",
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
          imgs[k] = img; // placeholder
          onProgress?.(done / entries.length);
          if (done === entries.length) resolve();
        };
      }
    });
  }

  // =========================
  // RNG (seeded)
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

  function down(...codes) {
    return codes.some(c => keys.has(c));
  }

  // =========================
  // Game State / Constants
  // =========================
  const GRAVITY = 2000;
  const FLOOR_Y = 640;     // ground top
  const PLATFORM_H = 40;

  const PLAYER = {
    w: 44,
    h: 64,
    drawW: 84,
    drawH: 84,
    speed: 310,
    jumpV: -930,
    dashV: 820,
    dashTime: 0.13,
    throwCd: 0.35,
  };

  const ENEMY = {
    baseW: 46,
    baseH: 56,
    drawW: 78,
    drawH: 78,
    speed1: 140,
    speed2: 170,
    jumpV1: -820,
    jumpV2: -880,
    aggro: 520,
    meleeRange: 40,
    meleeCd: 0.8,
  };

  const BOSS = {
    w: 80,
    h: 90,
    drawW: 130,
    drawH: 130,
    speed: 160,
    jumpV: -920,
    hpBase: 220,
  };

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

    nav: /** @type {number[][]} */ ([]),

    platforms: /** @type {Array<{x:number,y:number,w:number,h:number}>} */ ([]),
    pickups: /** @type {Array<any>} */ ([]),
    enemies: /** @type {Array<any>} */ ([]),
    projectiles: /** @type {Array<any>} */ ([]),
    bossShots: /** @type {Array<any>} */ ([]),

    exit: { x: 0, y: 0, w: 96, h: 140 },

    player: {
      // ✅ FIX #1: player must have w/h or physics + camera becomes NaN
      w: PLAYER.w,
      h: PLAYER.h,

      x: 120, y: FLOOR_Y - PLAYER.h,
      vx: 0, vy: 0,
      onGround: false,
      face: 1,

      hp: 10, maxHp: 10,
      iT: 0,

      coins: 0,
      hasDash: false,
      dashCd: 0,
      dashT: 0,
      dashDir: 1,

      speedMult: 1,
      throwCd: 0,
      throwDmg: 18,

      charKey: "Nate",
    }
  };

  // =========================
  // UI helpers
  // =========================
  function show(el) { el.classList.add("show"); }
  function hide(el) { el.classList.remove("show"); }

  function setToast(msg, t = 2.2) {
    GAME.toastText = msg;
    GAME.toastT = t;
  }

  function setMode(m) {
    GAME.mode = m;
    if (m === "BOOT") show(bootOverlay); else hide(bootOverlay);
    if (m === "SELECT") show(selectOverlay); else hide(selectOverlay);
    if (m === "PAUSE") show(pauseOverlay); else hide(pauseOverlay);
    if (m === "SHOP") show(shopOverlay); else hide(shopOverlay);
    if (m === "TRANSITION") show(transitionOverlay); else hide(transitionOverlay);
  }

  function pill(text) {
    const d = document.createElement("div");
    d.className = "pill";
    d.textContent = text;
    return d;
  }

  function updateHUD() {
    hudLeft.innerHTML = "";
    hudRight.innerHTML = "";

    hudLeft.appendChild(pill(`Level: ${GAME.level}`));
    hudLeft.appendChild(pill(`Coins: ${GAME.player.coins}`));
    hudLeft.appendChild(pill(`Dash: ${GAME.player.hasDash ? (GAME.player.dashCd > 0 ? "Cooling" : "Ready") : "Locked"}`));
    hudLeft.appendChild(pill(`Speed: ${GAME.player.speedMult > 1 ? "Boosted" : "Normal"}`));
    hudLeft.appendChild(pill(`Throw: ${GAME.player.throwCd > 0 ? "Cooling" : "Ready"}`));

    const hpStr = `${GAME.player.hp}/${GAME.player.maxHp}`;
    hudRight.appendChild(pill(`HP: ${hpStr}`));
  }

  // =========================
  // Character select
  // =========================
  const playable = ["Gilly","Scott","Kevin","Nate"];
  let selectedChar = "";

  function buildCharSelect() {
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

  btnStart.addEventListener("click", () => {
    if (!selectedChar) return;
    GAME.player.charKey = selectedChar;
    startNewRun();
  });

  // =========================
  // Pause / Restart
  // =========================
  btnResume.addEventListener("click", () => {
    if (GAME.mode === "PAUSE") setMode("PLAY");
  });
  btnRestart.addEventListener("click", () => {
    if (GAME.mode === "PAUSE") {
      restartLevel();
      setMode("PLAY");
    }
  });

  function togglePause() {
    if (GAME.mode === "PLAY") setMode("PAUSE");
    else if (GAME.mode === "PAUSE") setMode("PLAY");
  }

  // =========================
  // Shop
  // =========================
  btnShopContinue.addEventListener("click", () => {
    setMode("PLAY");
  });

  function openShop() {
    GAME.shopAvailable = false;
    setMode("SHOP");

    shopCoins.textContent = `Coins: ${GAME.player.coins}`;
    shopList.innerHTML = "";

    const items = [
      { name: "+1 MAX HP", price: 8, desc: "More blocks in your HP bar.", buy: () => { GAME.player.maxHp += 1; GAME.player.hp = GAME.player.maxHp; } },
      { name: "+ Throw Damage", price: 10, desc: "Home phone hits harder.", buy: () => { GAME.player.throwDmg += 4; } },
      { name: "Unlock Dash", price: 12, desc: "Enables Shift dash.", buy: () => { GAME.player.hasDash = true; } },
      { name: "Speed Boost", price: 10, desc: "Move faster for this stage.", buy: () => { GAME.player.speedMult = 1.18; } },
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
        shopCoins.textContent = `Coins: ${GAME.player.coins}`;
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
  // Geometry helpers
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

  function findSupportPlatform(ent) {
    const feet = { x: ent.x + 2, y: ent.y + ent.h + 2, w: ent.w - 4, h: 4 };
    for (let i = 0; i < GAME.platforms.length; i++) {
      if (rectsOverlap(feet, GAME.platforms[i])) return i;
    }
    return -1;
  }

  // =========================
  // Stage generation
  // =========================
  function clearWorld() {
    GAME.platforms.length = 0;
    GAME.pickups.length = 0;
    GAME.enemies.length = 0;
    GAME.projectiles.length = 0;
    GAME.bossShots.length = 0;
    GAME.stageCleared = false;
    GAME.exitLocked = true;
    GAME.toastText = "";
    GAME.toastT = 0;
  }

  function addGround(worldW) {
    GAME.platforms.push({ x: 0, y: FLOOR_Y, w: worldW, h: VIEW_H - FLOOR_Y });
  }

  function buildNavGraph() {
    const maxRise = 190;
    const maxDrop = 260;
    const maxDx = 320;

    const n = GAME.platforms.length;
    const nav = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      const a = GAME.platforms[i];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const b = GAME.platforms[j];

        const dxRight = b.x - (a.x + a.w);
        const dxLeft = a.x - (b.x + b.w);
        const dy = b.y - a.y;

        if (dxRight >= -40 && dxRight <= maxDx) {
          if (dy >= -maxRise && dy <= maxDrop) nav[i].push(j);
        }
        if (dxLeft >= -40 && dxLeft <= maxDx) {
          if (dy >= -maxRise && dy <= maxDrop) nav[i].push(j);
        }
      }
    }

    GAME.nav = nav;
  }

  function stageIsBoss(level) {
    return level % 5 === 0;
  }

  function resetPlayer(x, y) {
    const p = GAME.player;

    // ✅ FIX #2: enforce w/h every time we reset (prevents NaN ever returning)
    p.w = PLAYER.w;
    p.h = PLAYER.h;

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

  function makeEnemy(kind, platRect, isBoss = false) {
    if (isBoss) {
      return {
        kind: "boss",
        bossType: kind,
        x: platRect.x + platRect.w * 0.65,
        y: platRect.y - BOSS.h,
        w: BOSS.w, h: BOSS.h,
        vx: 0, vy: 0,
        onGround: false,
        hp: BOSS.hpBase + (GAME.level * 8),
        maxHp: BOSS.hpBase + (GAME.level * 8),
        face: -1,
        state: "idle",
        atkCd: 1.2,
        slamCd: 2.3,
        shootCd: 1.6,
      };
    }

    const is2 = kind === "enemy2";
    return {
      kind,
      x: platRect.x + 50,
      y: platRect.y - ENEMY.baseH,
      w: ENEMY.baseW,
      h: ENEMY.baseH,
      vx: 0, vy: 0,
      onGround: false,
      hp: is2 ? 40 : 30,
      maxHp: is2 ? 40 : 30,
      face: 1,
      patrolMin: platRect.x + 10,
      patrolMax: platRect.x + platRect.w - ENEMY.baseW - 10,
      platformId: -1,
      thinkT: 0,
      meleeCd: 0,
      targetPlat: -1,
      nextHop: -1,
    };
  }

  function stageGenerate(level) {
    clearWorld();

    const bossStage = stageIsBoss(level);
    const rng = mulberry32(12345 + level * 999);

    GAME.worldW = bossStage ? 2200 : (2600 + Math.min(1400, level * 220));
    addGround(GAME.worldW);

    GAME.exit.w = 96;
    GAME.exit.h = 150;
    GAME.exit.x = GAME.worldW - 220;
    GAME.exit.y = FLOOR_Y - GAME.exit.h;

    if (bossStage) {
      const arena = { x: 520, y: 520, w: 820, h: PLATFORM_H };
      const mid = { x: 880, y: 420, w: 420, h: PLATFORM_H };
      const left = { x: 300, y: 460, w: 360, h: PLATFORM_H };
      GAME.platforms.push(arena, mid, left);

      for (let i = 0; i < 10; i++) {
        GAME.pickups.push({ kind: "coin", x: 520 + i * 140, y: 320 + (i % 2) * 40, w: 24, h: 24, value: 1 });
      }

      const boss = makeEnemy(rng() < 0.5 ? "enemy1" : "enemy2", arena, true);
      GAME.enemies.push(boss);

      GAME.exitLocked = true;
      setToast("BOSS STAGE — defeat it to unlock the exit!", 3.0);

    } else {
      GAME.exitLocked = true;

      let x = 420;
      let y = 520;

      const minY = 360;
      const maxY = 540;

      const pathCount = 8 + Math.min(7, level);
      const path = [];

      for (let i = 0; i < pathCount; i++) {
        const w = 340 + Math.floor(rng() * 260);
        const dx = 230 + Math.floor(rng() * 70);
        const dy = -70 + Math.floor(rng() * 140);

        x += dx;
        y = clamp(y + dy, minY, maxY);

        if (x + w > GAME.worldW - 560) break;

        const plat = { x, y, w, h: PLATFORM_H };
        GAME.platforms.push(plat);
        path.push(plat);

        const cN = 2 + Math.floor(rng() * 3);
        for (let c = 0; c < cN; c++) {
          GAME.pickups.push({ kind: "coin", x: x + 50 + c * 90, y: y - 46, w: 24, h: 24, value: 1 });
        }

        if (i > 0 && rng() < 0.58) {
          const type = rng() < 0.6 ? "enemy1" : "enemy2";
          const e = makeEnemy(type, plat, false);
          e.x = x + 80;
          e.y = y - e.h;
          e.patrolMin = x + 10;
          e.patrolMax = x + w - e.w - 10;
          GAME.enemies.push(e);
        }

        if (level >= 2 && rng() < 0.18) {
          GAME.pickups.push({ kind: "dash", x: x + w * 0.5, y: y - 54, w: 36, h: 36 });
        }
        if (level >= 3 && rng() < 0.16) {
          GAME.pickups.push({ kind: "speed", x: x + w * 0.72, y: y - 54, w: 36, h: 36 });
        }
      }

      if (path.length === 0) {
        const plat = { x: 720, y: 520, w: 640, h: PLATFORM_H };
        GAME.platforms.push(plat);
        path.push(plat);
      }

      const last = path[path.length - 1];
      GAME.pickups.push({ kind: "flag", x: last.x + last.w - 90, y: last.y - 74, w: 48, h: 74 });

      setToast("Exit locked — grab the Signal Flag!", 2.6);
    }

    resetPlayer(120, FLOOR_Y - PLAYER.h);

    if (level === 1) {
      tutorialOverlay.classList.remove("hidden");
      tMove.checked = false;
      tJump.checked = false;
      tThrow.checked = false;
    } else {
      tutorialOverlay.classList.add("hidden");
    }

    buildNavGraph();
    updateHUD();
  }

  // =========================
  // Enemy / Boss / Player / Rendering / Loop
  // (unchanged from previous version)
  // =========================

  function bfsNextHop(start, goal) {
    if (start < 0 || goal < 0) return -1;
    if (start === goal) return start;

    const q = [start];
    const prev = new Map();
    prev.set(start, -1);

    while (q.length) {
      const cur = q.shift();
      for (const nx of GAME.nav[cur] || []) {
        if (prev.has(nx)) continue;
        prev.set(nx, cur);
        if (nx === goal) {
          let step = nx;
          let p = prev.get(step);
          while (p !== -1 && p !== start) {
            step = p;
            p = prev.get(step);
          }
          return step;
        }
        q.push(nx);
      }
    }
    return -1;
  }

  function updateEnemyAI(e, dt) {
    const p = GAME.player;

    e.vy += GRAVITY * dt;
    e.meleeCd = Math.max(0, (e.meleeCd || 0) - dt);
    e.thinkT = Math.max(0, (e.thinkT || 0) - dt);

    if (e.onGround) e.platformId = findSupportPlatform(e);
    const playerPlat = findSupportPlatform(p);

    const dxToPlayer = (p.x + p.w / 2) - (e.x + e.w / 2);
    const dist = Math.abs(dxToPlayer);

    const is2 = e.kind === "enemy2";
    const speed = is2 ? ENEMY.speed2 : ENEMY.speed1;
    const jumpV = is2 ? ENEMY.jumpV2 : ENEMY.jumpV1;

    if (e.platformId === playerPlat && e.platformId >= 0) {
      e.face = dxToPlayer >= 0 ? 1 : -1;
      e.vx = e.face * speed;

      if (dist < ENEMY.aggro && dist < ENEMY.meleeRange && e.meleeCd <= 0) {
        if (p.iT <= 0) {
          p.hp = Math.max(0, p.hp - 1);
          p.iT = 0.6;
          setToast("Ouch!", 0.7);
          updateHUD();
        }
        e.meleeCd = ENEMY.meleeCd;
      }
    } else {
      const shouldAggro = dist < ENEMY.aggro || GAME.level >= 4;

      if (!shouldAggro) {
        e.vx = e.face * speed * 0.7;
      } else {
        if (e.thinkT <= 0) {
          e.targetPlat = playerPlat;
          e.nextHop = bfsNextHop(e.platformId, playerPlat);
          e.thinkT = 0.35 + (is2 ? 0.12 : 0.18);
        }

        if (e.nextHop < 0 || e.platformId < 0) {
          e.vx = e.face * speed * 0.6;
        } else if (e.nextHop === e.platformId) {
          e.face = dxToPlayer >= 0 ? 1 : -1;
          e.vx = e.face * speed * 0.7;
        } else {
          const curPlat = GAME.platforms[e.platformId];
          const nextPlat = GAME.platforms[e.nextHop];

          const goRight = (nextPlat.x + nextPlat.w / 2) > (curPlat.x + curPlat.w / 2);
          e.face = goRight ? 1 : -1;

          const edgeX = goRight ? (curPlat.x + curPlat.w - e.w - 6) : (curPlat.x + 6);
          const distToEdge = Math.abs(e.x - edgeX);

          e.vx = e.face * speed;

          if (distToEdge > 8) {
            e.x = clamp(e.x, curPlat.x + 4, curPlat.x + curPlat.w - e.w - 4);
          } else {
            const dy = nextPlat.y - curPlat.y;
            const gap =
              goRight
                ? (nextPlat.x - (curPlat.x + curPlat.w))
                : (curPlat.x - (nextPlat.x + nextPlat.w));

            const needsJump = dy < -15 || gap > 20;

            if (needsJump && e.onGround) {
              e.vy = jumpV;
              e.onGround = false;
            }
          }
        }
      }

      if (e.onGround && e.platformId >= 0) {
        const plat = GAME.platforms[e.platformId];
        const minX = e.patrolMin ?? (plat.x + 10);
        const maxX = e.patrolMax ?? (plat.x + plat.w - e.w - 10);

        if (dist > ENEMY.aggro * 0.9) {
          if (e.x < minX) { e.x = minX; e.face = 1; }
          if (e.x > maxX) { e.x = maxX; e.face = -1; }
        }
      }
    }

    moveAndCollide(e, dt);

    if (e.onGround) {
      if (e.x <= (e.patrolMin ?? -Infinity) + 1) e.face = 1;
      if (e.x >= (e.patrolMax ?? Infinity) - 1) e.face = -1;
    }

    e.x = clamp(e.x, 0, GAME.worldW - e.w);
    if (e.y > VIEW_H + 300) {
      e.y = FLOOR_Y - e.h;
      e.vy = 0;
      e.onGround = true;
    }
  }

  function spawnBossShot(x, y, vx, vy) {
    GAME.bossShots.push({ x, y, vx, vy, w: 10, h: 10, t: 5.0 });
  }

  function updateBoss(b, dt) {
    const p = GAME.player;

    b.vy += GRAVITY * dt;

    b.atkCd = Math.max(0, b.atkCd - dt);
    b.slamCd = Math.max(0, b.slamCd - dt);
    b.shootCd = Math.max(0, b.shootCd - dt);

    const dx = (p.x + p.w/2) - (b.x + b.w/2);
    b.face = dx >= 0 ? 1 : -1;

    const dist = Math.abs(dx);
    b.vx = b.face * BOSS.speed * (dist > 240 ? 1 : 0.7);

    if (dist < 90 && b.atkCd <= 0) {
      b.vx = b.face * 520;
      b.atkCd = 1.0;

      if (rectsOverlap(b, p) && p.iT <= 0) {
        p.hp = Math.max(0, p.hp - 2);
        p.iT = 0.75;
        setToast("Boss hit!", 0.9);
        updateHUD();
      }
    }

    if (b.slamCd <= 0 && dist < 520 && b.onGround) {
      b.vy = BOSS.jumpV;
      b.slamCd = 2.4;
    }

    if (b.shootCd <= 0 && dist < 700) {
      const sx = b.x + b.w/2 + b.face * 30;
      const sy = b.y + b.h/2;
      spawnBossShot(sx, sy, b.face * 420, -40);
      spawnBossShot(sx, sy, b.face * 420, 0);
      spawnBossShot(sx, sy, b.face * 420, 40);
      b.shootCd = 1.8;
    }

    moveAndCollide(b, dt);

    if (rectsOverlap(b, p) && p.iT <= 0) {
      p.hp = Math.max(0, p.hp - 1);
      p.iT = 0.55;
      updateHUD();
    }

    b.x = clamp(b.x, 0, GAME.worldW - b.w);
  }

  function updatePlayer(dt) {
    const p = GAME.player;

    p.iT = Math.max(0, p.iT - dt);
    p.throwCd = Math.max(0, p.throwCd - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.dashT = Math.max(0, p.dashT - dt);

    if (GAME.level === 1 && !tutorialOverlay.classList.contains("hidden")) {
      if (down("ArrowLeft","ArrowRight","KeyA","KeyD")) tMove.checked = true;
      if (down("Space")) tJump.checked = true;
      if (down("KeyF")) tThrow.checked = true;
      if (tMove.checked && tJump.checked && tThrow.checked) tutorialOverlay.classList.add("hidden");
    }

    if (p.hasDash && p.dashCd <= 0 && down("ShiftLeft") && p.dashT <= 0) {
      p.dashT = PLAYER.dashTime;
      p.dashDir = p.face;
      p.dashCd = 1.0;
    }

    const moveDir = (down("ArrowRight","KeyD") ? 1 : 0) + (down("ArrowLeft","KeyA") ? -1 : 0);
    if (moveDir !== 0) p.face = moveDir;

    const baseSpeed = PLAYER.speed * p.speedMult;
    if (p.dashT > 0) {
      p.vx = p.dashDir * PLAYER.dashV;
    } else {
      p.vx = moveDir * baseSpeed;
    }

    p.vy += GRAVITY * dt;

    if (down("Space") && p.onGround) {
      p.vy = PLAYER.jumpV;
      p.onGround = false;
    }

    moveAndCollide(p, dt);

    p.x = clamp(p.x, 0, GAME.worldW - p.w);
    if (p.y > VIEW_H + 400) {
      p.hp = Math.max(1, p.hp - 1);
      resetPlayer(120, FLOOR_Y - PLAYER.h);
      setToast("Fell! -1 HP", 1.2);
      updateHUD();
    }

    if (down("KeyF") && p.throwCd <= 0) {
      p.throwCd = PLAYER.throwCd;
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

  function updateProjectiles(dt) {
    for (let i = GAME.projectiles.length - 1; i >= 0; i--) {
      const pr = GAME.projectiles[i];
      pr.t -= dt;
      pr.vy += GRAVITY * 0.35 * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      for (const plat of GAME.platforms) {
        if (rectsOverlap(pr, plat)) {
          pr.vx *= -0.25;
          pr.vy *= -0.25;
          pr.x += pr.vx * dt;
          pr.y += pr.vy * dt;
        }
      }

      for (const e of GAME.enemies) {
        if (e.hp <= 0) continue;
        if (rectsOverlap(pr, e)) {
          e.hp = Math.max(0, e.hp - pr.dmg);
          setToast(e.kind === "boss" ? "Boss hit!" : "Hit!", 0.5);
          GAME.projectiles.splice(i, 1);
          break;
        }
      }

      if (pr.t <= 0 || pr.x < -200 || pr.x > GAME.worldW + 200 || pr.y > VIEW_H + 300) {
        GAME.projectiles.splice(i, 1);
      }
    }

    for (let i = GAME.bossShots.length - 1; i >= 0; i--) {
      const s = GAME.bossShots[i];
      s.t -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (rectsOverlap(s, GAME.player) && GAME.player.iT <= 0) {
        GAME.player.hp = Math.max(0, GAME.player.hp - 1);
        GAME.player.iT = 0.6;
        updateHUD();
        GAME.bossShots.splice(i, 1);
        continue;
      }

      if (s.t <= 0 || s.x < -200 || s.x > GAME.worldW + 200 || s.y < -200 || s.y > VIEW_H + 300) {
        GAME.bossShots.splice(i, 1);
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
        setToast("Dash unlocked! (Shift)", 1.7);
        updateHUD();
        continue;
      }

      if (it.kind === "speed") {
        p.speedMult = 1.18;
        GAME.pickups.splice(i, 1);
        setToast("Speed boost!", 1.3);
        updateHUD();
        continue;
      }

      if (it.kind === "flag") {
        GAME.exitLocked = false;
        GAME.pickups.splice(i, 1);
        setToast("Signal acquired — Exit unlocked!", 2.0);
        continue;
      }
    }
  }

  function handleExit() {
    const p = GAME.player;
    if (!rectsOverlap(p, GAME.exit)) return;

    if (GAME.exitLocked) {
      setToast(stageIsBoss(GAME.level) ? "Exit locked — defeat the boss!" : "Exit locked — grab the Signal Flag!", 1.4);
      return;
    }

    if (!GAME.stageCleared) {
      GAME.stageCleared = true;
      beginTransitionToNextLevel();
    }
  }

  let transT = 0;
  let transDur = 5.0;
  let nextLevelPrepared = false;

  function beginTransitionToNextLevel() {
    setMode("TRANSITION");
    transT = 0;
    transDur = 5.0;
    nextLevelPrepared = false;
    transBar.style.width = "0%";
    transText.textContent = "0%";

    GAME.level += 1;
    stageGenerate(GAME.level);
    nextLevelPrepared = true;

    GAME.shopAvailable = true;
  }

  function updateTransition(dt) {
    transT += dt;
    const pct = clamp(transT / transDur, 0, 1);
    transBar.style.width = `${Math.floor(pct * 100)}%`;
    transText.textContent = `${Math.floor(pct * 100)}%`;

    if (pct >= 1) {
      if (GAME.shopAvailable) openShop();
      else setMode("PLAY");
    }
  }

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
    const scale = 1.65;

    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, x, y - 10, GAME.exit.w * scale, GAME.exit.h * scale);
    } else {
      ctx.fillStyle = "#ddd";
      ctx.fillRect(x, y, GAME.exit.w, GAME.exit.h);
    }

    if (GAME.exitLocked) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x, y - 28, 160, 22);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText("LOCKED", x + 6, y - 12);
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
      const scale = 1.4;
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, x, y, it.w * scale, it.h * scale);
      } else {
        ctx.fillStyle = "#fff";
        ctx.fillRect(x, y, it.w, it.h);
      }
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

  function drawHPBar(x, y, hp, maxHp, label = "") {
    const seg = 12;
    const gap = 3;
    const w = maxHp * (seg + gap) + 6;
    const h = 18;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.strokeRect(x, y, w, h);

    for (let i = 0; i < maxHp; i++) {
      const sx = x + 3 + i * (seg + gap);
      const sy = y + 3;
      ctx.fillStyle = (i < hp) ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.14)";
      ctx.fillRect(sx, sy, seg, 12);
    }

    if (label) {
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(label, x - 44, y + 13);
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
    GAME.camX = clamp(p.x + p.w / 2 - VIEW_W / 2, 0, Math.max(0, GAME.worldW - VIEW_W));

    drawBackground();

    for (let i = 1; i < GAME.platforms.length; i++) {
      drawPlatformRect(GAME.platforms[i]);
    }
    drawPlatformRect({ x: 0, y: FLOOR_Y, w: GAME.worldW, h: PLATFORM_H });

    for (const it of GAME.pickups) drawPickup(it, time);

    drawExit();

    for (const e of GAME.enemies) {
      if (e.hp <= 0) continue;

      if (e.kind === "boss") {
        drawEntitySprite(e.bossType === "enemy2" ? "Enemy2" : "Enemy1", e, BOSS.drawW, BOSS.drawH);
        drawHPBar(VIEW_W/2 - 90, 16, Math.ceil((e.hp / e.maxHp) * 10), 10, "BOSS");
      } else {
        const key = e.kind === "enemy2" ? "Enemy2" : "Enemy1";
        drawEntitySprite(key, e, ENEMY.drawW, ENEMY.drawH);

        const segs = 6;
        const hpSeg = Math.max(0, Math.ceil((e.hp / e.maxHp) * segs));
        drawHPBar((e.x - GAME.camX) - 8, e.y - 18, hpSeg, segs);
      }
    }

    drawEntitySprite(GAME.player.charKey, GAME.player, PLAYER.drawW, PLAYER.drawH);

    drawHPBar(VIEW_W - 190, VIEW_H - 50, GAME.player.hp, GAME.player.maxHp, "HP");

    for (const pr of GAME.projectiles) {
      const img = imgs.Weapon;
      const x = pr.x - GAME.camX;
      const y = pr.y;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, 32, 32);
      else { ctx.fillStyle="#fff"; ctx.fillRect(x,y,pr.w,pr.h); }
    }

    for (const s of GAME.bossShots) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(s.x - GAME.camX, s.y, s.w, s.h);
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

  let lastT = performance.now();

  function update(dt) {
    if (GAME.toastT > 0) GAME.toastT = Math.max(0, GAME.toastT - dt);

    if (GAME.mode === "TRANSITION") {
      updateTransition(dt);
      return;
    }
    if (GAME.mode !== "PLAY") return;

    updatePlayer(dt);

    for (let i = GAME.enemies.length - 1; i >= 0; i--) {
      const e = GAME.enemies[i];
      if (e.hp <= 0) {
        if (e.kind === "boss") {
          GAME.exitLocked = false;
          setToast("Boss defeated — Exit unlocked!", 2.2);
        }
        GAME.enemies.splice(i, 1);
        continue;
      }

      if (e.kind === "boss") updateBoss(e, dt);
      else updateEnemyAI(e, dt);
    }

    updateProjectiles(dt);
    handlePickups();
    handleExit();

    if (GAME.player.hp <= 0) {
      setToast("GAME OVER — restarting level", 2.0);
      restartLevel();
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

  function startNewRun() {
    GAME.level = 1;
    GAME.player.hp = GAME.player.maxHp;
    GAME.player.coins = 0;
    GAME.player.hasDash = false;
    GAME.player.throwDmg = 18;
    stageGenerate(GAME.level);
    setMode("PLAY");
  }

  function restartLevel() {
    const saved = {
      coins: GAME.player.coins,
      maxHp: GAME.player.maxHp,
      hp: Math.min(GAME.player.hp, GAME.player.maxHp),
      hasDash: GAME.player.hasDash,
      throwDmg: GAME.player.throwDmg
    };

    stageGenerate(GAME.level);

    GAME.player.coins = saved.coins;
    GAME.player.maxHp = saved.maxHp;
    GAME.player.hp = saved.hp;
    GAME.player.hasDash = saved.hasDash;
    GAME.player.throwDmg = saved.throwDmg;

    setToast("Level restarted", 1.0);
    updateHUD();
  }

  async function boot() {
    setMode("BOOT");
    await loadAllImages((p) => {
      const pct = Math.floor(p * 100);
      bootBar.style.width = `${pct}%`;
      bootPct.textContent = `${pct}%`;
    });

    buildCharSelect();
    setMode("SELECT");
  }

  boot();
  requestAnimationFrame(loop);

})();
