// js/world.js
import { CONFIG } from "./config.js";
import { clamp, randRange } from "./utils.js";

export function generateLevel(level){
  const W = CONFIG.canvas.w;
  const H = CONFIG.canvas.h;

  // Phase 2 (difficulty bump) after level 5
  const phase2 = level >= 6;

  const gapMin = CONFIG.world.gapMin;
  const gapMax = phase2 ? Math.min(CONFIG.world.gapMax + 10, 135) : CONFIG.world.gapMax;
  const stepYMax = phase2 ? Math.min(CONFIG.world.stepYMax + 10, 135) : CONFIG.world.stepYMax;

  const spikeChance = phase2 ? Math.min(CONFIG.world.spikeChance + 0.08, 0.45) : CONFIG.world.spikeChance;
  const enemyChance = phase2 ? Math.min(CONFIG.world.enemyChance + 0.10, 0.55) : CONFIG.world.enemyChance;

  const platforms = [];
  const coins = [];
  const spikes = [];
  const enemies = [];

  // Start platform (not a full floor)
  let x = 40;
  let y = 410;
  let w = 260;

  platforms.push({ x, y, w, h: CONFIG.world.platformH });

  // Build forward
  const count = 8 + Math.min(level, 6); // more platforms later
  for (let i = 1; i < count; i++){
    const prev = platforms[platforms.length - 1];
    const gap = randRange(gapMin, gapMax);
    const pw = randRange(CONFIG.world.platformWMin, CONFIG.world.platformWMax);

    const dy = randRange(-stepYMax, stepYMax);
    let ny = clamp(prev.y + dy, 140, 430);

    const nx = prev.x + prev.w + gap;

    platforms.push({ x: nx, y: ny, w: pw, h: CONFIG.world.platformH });
  }

  // Place checkpoint on 2nd-to-last, door on last (ALWAYS on platforms)
  const pCheckpoint = platforms[Math.max(1, platforms.length - 2)];
  const pDoor = platforms[platforms.length - 1];

  const checkpoint = {
    x: pCheckpoint.x + pCheckpoint.w * 0.15,
    y: pCheckpoint.y - 46,
    w: 30,
    h: 46,
    active: false
  };

  const door = {
    x: pDoor.x + pDoor.w * 0.72,
    y: pDoor.y - 64,
    w: 44,
    h: 64,
    open: false
  };

  // Coins, spikes, enemies on platforms
  let coinId = 0;

  for (let i = 0; i < platforms.length; i++){
    const p = platforms[i];

    // coins
    const nCoins = Math.floor(randRange(CONFIG.world.coinsPerPlatformMin, CONFIG.world.coinsPerPlatformMax + 1));
    for (let c = 0; c < nCoins; c++){
      coins.push({
        id: `${level}-${coinId++}`,
        x: p.x + 26 + c * 26,
        y: p.y - 26,
        r: 10,
        collected: false
      });
    }

    // spikes (avoid start platform + avoid checkpoint/door platforms)
    const isSpecial = (p === pCheckpoint) || (p === pDoor) || i === 0;
    if (!isSpecial && Math.random() < spikeChance){
      // spike sits on platform
      spikes.push({
        x: p.x + p.w * randRange(0.25, 0.75),
        y: p.y - CONFIG.spike.drawH + 6, // slight embed
        w: CONFIG.spike.drawW,
        h: CONFIG.spike.drawH
      });
    }

    // enemies
    if (!isSpecial && Math.random() < enemyChance){
      enemies.push({
        x: p.x + p.w * randRange(0.25, 0.75),
        y: p.y - CONFIG.enemy.h,
        w: CONFIG.enemy.w,
        h: CONFIG.enemy.h,
        dir: Math.random() < 0.5 ? -1 : 1,
        patrolLeft: p.x + 10,
        patrolRight: p.x + p.w - CONFIG.enemy.w - 10,
        alive: true,
        shootCooldown: randRange(350, 900)
      });
    }
  }

  // Spawn on first platform
  const spawn = {
    x: platforms[0].x + 30,
    y: platforms[0].y - 48
  };

  return { platforms, coins, spikes, enemies, checkpoint, door, spawn, phase2 };
}
