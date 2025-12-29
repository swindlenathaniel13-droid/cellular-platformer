// levelgen.js
// Procedural level generator (seeded + beatable “staircase” platforms)
// Produces the SAME shape as your existing LEVEL objects.

(function () {
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // Seeded RNG (deterministic)
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function pick(rng, arr) {
    return arr[rInt(rng, 0, arr.length - 1)];
  }

  // Generates a level that matches your schema:
  // { name, spawn, exit, exitLocked, checkpoint, platforms, enemies, coins, pickups, boss }
  function generateLevel(seed, difficulty = 1, W = 960, H = 540) {
    const rng = mulberry32(seed >>> 0);

    const groundY = 460;
    const groundH = 80;

    const platforms = [
      { x: 0, y: groundY, w: W, h: groundH }, // ground
    ];

    // “Beatable staircase”: each platform is within safe jump-ish bounds
    const steps = clamp(6 + Math.floor(difficulty * 0.8), 6, 10);

    let x = 140;
    let y = 390;

    for (let i = 0; i < steps; i++) {
      const w = rInt(rng, 140, 220);
      const h = 28;

      // horizontal progress (safe gaps)
      x += rInt(rng, 95, 135);

      // vertical wobble (safe rise/fall)
      y = clamp(y + rInt(rng, -55, 45), 220, 410);

      // keep on-screen
      if (x + w > W - 40) x = (W - 40) - w;
      x = clamp(x, 40, W - w - 40);

      platforms.push({ x, y, w, h });
    }

    const spawn = { x: 70, y: 380 };

    // Exit on the last platform
    const lastPlat = platforms[platforms.length - 1];
    const exit = {
      x: clamp(Math.floor(lastPlat.x + lastPlat.w - 54), 40, W - 54),
      y: Math.floor(lastPlat.y - 56),
    };

    // Checkpoint near the middle platform
    const midPlat = platforms[Math.floor(platforms.length / 2)];
    const checkpoint = {
      x: Math.floor(midPlat.x + midPlat.w * 0.5),
      y: Math.floor(midPlat.y - 50),
    };

    // Coins: 1–3 per platform (excluding ground)
    const coins = [];
    platforms.slice(1).forEach((p, idx) => {
      const n = rInt(rng, 1, 3);
      for (let j = 0; j < n; j++) {
        const cx = Math.floor(p.x + (p.w / (n + 1)) * (j + 1) - 10);
        const cy = Math.floor(p.y - 34 - (idx % 2) * 6);
        coins.push({ x: cx, y: cy });
      }
    });

    // Pickups: Dash early, Speed later
    const pickups = [];
    if (platforms.length > 2) {
      const p = platforms[2];
      pickups.push({
        kind: "dash",
        x: Math.floor(p.x + p.w * 0.5),
        y: Math.floor(p.y - 35),
      });
    }
    if (platforms.length > 4) {
      const p = platforms[platforms.length - 3];
      pickups.push({
        kind: "speed",
        x: Math.floor(p.x + p.w * 0.5),
        y: Math.floor(p.y - 35),
      });
    }

    // Enemies: patrol on platforms (exclude first + last)
    const enemies = [];
    const enemyCount = clamp(1 + Math.floor(difficulty * 1.2), 1, 6);
    const patrolPlatforms = platforms.slice(2, -1);

    for (let i = 0; i < enemyCount; i++) {
      if (!patrolPlatforms.length) break;
      const p = pick(rng, patrolPlatforms);

      const type = rng() < 0.55 ? "enemy1" : "enemy2";
      const hpBase = type === "enemy1" ? 2 : 3;
      const hp = hpBase + Math.floor(difficulty / 2);

      const ex = Math.floor(p.x + rInt(rng, 10, Math.max(10, p.w - 56)));
      const ey = Math.floor(p.y - 40);

      enemies.push({
        type,
        x: ex,
        y: ey,
        left: Math.floor(p.x + 6),
        right: Math.floor(p.x + p.w - 46),
        hp,
      });
    }

    return {
      name: `Procedural ${difficulty}`,
      spawn,
      exit,
      exitLocked: false,
      checkpoint,
      platforms,
      enemies,
      coins,
      pickups,
      boss: null,
    };
  }

  window.LevelGen = { generateLevel };
})();

