import { CONFIG } from "./config.js";
import { rand, randi } from "./utils.js";
import { spawnEnemy } from "./enemies.js";

function makePlatform(x, y, w) {
  return { x, y, w, h: CONFIG.world.platformH, kind: "solid" };
}

function pickPlatformNear(platforms, xTarget) {
  let best = platforms[0];
  let bestD = Infinity;
  for (const p of platforms) {
    const cx = p.x + p.w * 0.5;
    const d = Math.abs(cx - xTarget);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export function generateLevel(level) {
  const floorY = CONFIG.world.floorY;
  const W = CONFIG.world.levelMinW + level * CONFIG.world.levelGrow;

  const platforms = [];
  const coins = [];
  const spikes = [];
  const enemies = [];

  // Big ground
  platforms.push(makePlatform(-200, floorY, W + 400));

  // Platform chain (jump-doable)
  let x = 120;
  let y = floorY - 140;

  for (let i = 0; i < 14 + level; i++) {
    const w = randi(CONFIG.world.platformMinW, CONFIG.world.platformMaxW);
    const gap = randi(CONFIG.world.gapMin, CONFIG.world.gapMax);
    const dy = randi(-CONFIG.world.stepYMax, CONFIG.world.stepYMax);

    x += w + gap;
    y = Math.max(140, Math.min(floorY - 110, y + dy));

    platforms.push(makePlatform(x, y, w));

    // Coins above some platforms
    if (Math.random() < CONFIG.world.coinChance) {
      const cCount = randi(1, 3);
      for (let k = 0; k < cCount; k++) {
        coins.push({
          x: x + randi(18, Math.max(18, w - 18)),
          y: y - randi(28, 64),
          w: 18,
          h: 18,
          taken: false,
        });
      }
    }

    // Enemies on some platforms
    if (Math.random() < CONFIG.world.enemyChance) {
      const type = Math.random() < 0.35 ? 2 : 1;
      enemies.push(spawnEnemy(type, x + randi(10, w - 50), y - 34));
    }

    // Spikes mostly on ground segments
    if (Math.random() < CONFIG.world.spikeChance) {
      const sx = x + randi(10, w - 54);
      const sy = floorY - 44; // on the ground top
      spikes.push({ x: sx, y: sy, w: 44, h: 44 });
    }
  }

  // Ensure checkpoint + exit are on platforms
  const checkpointPlat = pickPlatformNear(platforms, W - 520);
  const exitPlat = pickPlatformNear(platforms, W - 260);

  const checkpoint = {
    x: checkpointPlat.x + Math.min(checkpointPlat.w - 34, Math.max(8, checkpointPlat.w * 0.4)),
    y: checkpointPlat.y - 56,
    w: 34,
    h: 56,
    reached: false,
  };

  const exit = {
    x: exitPlat.x + Math.min(exitPlat.w - 52, Math.max(8, exitPlat.w * 0.55)),
    y: exitPlat.y - 72,
    w: 52,
    h: 72,
  };

  return {
    level,
    W,
    platforms,
    coins,
    spikes,
    enemies,
    checkpoint,
    exit,

    exitUnlocked: false,
  };
}
