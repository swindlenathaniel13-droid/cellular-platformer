// levelgen.js
// Procedural level generator (seeded, beatable staircase design)
// Returns the same object shape as STATIC levels in main.js.

(function(){
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  // deterministic RNG
  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rInt(rng, min, max){
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function pick(rng, arr){
    return arr[rInt(rng, 0, arr.length - 1)];
  }

  function generateLevel(seed, difficulty = 1, W = 960, H = 540){
    const rng = mulberry32(seed >>> 0);

    const groundY = 460;
    const platforms = [{ x: 0, y: groundY, w: W, h: 80 }];

    const steps = clamp(6 + Math.floor(difficulty * 0.8), 6, 10);
    let x = 140;
    let y = 390;

    for (let i=0;i<steps;i++){
      const w = rInt(rng, 160, 260);
      const h = 28;

      x += rInt(rng, 95, 145);
      y = clamp(y + rInt(rng, -60, 50), 220, 410);

      if (x + w > W - 40) x = (W - 40) - w;
      x = clamp(x, 40, W - w - 40);

      platforms.push({ x, y, w, h });
    }

    const spawn = { x: 70, y: 380 };

    const last = platforms[platforms.length - 1];
    const exit = { x: Math.floor(last.x + last.w - 54), y: Math.floor(last.y - 56) };

    const mid = platforms[Math.floor(platforms.length / 2)];
    const checkpoint = { x: Math.floor(mid.x + mid.w * 0.5), y: Math.floor(mid.y - 50) };

    // coins
    const coins = [];
    platforms.slice(1).forEach((p, idx) => {
      const n = rInt(rng, 1, 3);
      for (let j=0;j<n;j++){
        const cx = Math.floor(p.x + (p.w / (n+1))*(j+1) - 10);
        const cy = Math.floor(p.y - 34 - (idx % 2)*6);
        coins.push({ x: cx, y: cy });
      }
    });

    // pickups
    const pickups = [];
    if (platforms.length > 2){
      const p = platforms[2];
      pickups.push({ kind:"dash", x: Math.floor(p.x + p.w*0.5), y: Math.floor(p.y - 35) });
    }
    if (platforms.length > 4){
      const p = platforms[platforms.length - 3];
      pickups.push({ kind:"speed", x: Math.floor(p.x + p.w*0.5), y: Math.floor(p.y - 35) });
    }

    // enemies
    const enemies = [];
    const enemyCount = clamp(1 + Math.floor(difficulty * 1.2), 1, 6);
    const pats = platforms.slice(2, -1);

    for (let i=0;i<enemyCount;i++){
      if (!pats.length) break;
      const p = pick(rng, pats);

      const type = rng() < 0.55 ? "enemy1" : "enemy2";
      const hpBase = type === "enemy1" ? 2 : 3;
      const hp = hpBase + Math.floor(difficulty / 2);

      enemies.push({
        type,
        x: Math.floor(p.x + rInt(rng, 10, Math.max(10, p.w - 56))),
        y: Math.floor(p.y - 40),
        left: Math.floor(p.x + 6),
        right: Math.floor(p.x + p.w - 46),
        hp
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
      boss: null
    };
  }

  window.LevelGen = { generateLevel };
})();
