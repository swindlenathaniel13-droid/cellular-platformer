import { CONFIG } from "./config.js";
import { randi } from "./utils.js";
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

  // ✅ NO bottom/ground platform
  // Instead: start platform
  const startPlat = makePlatform(60, floorY - 110, 260);
  platforms.push(startPlat);

  // chain platforms
  let x = startPlat.x + startPlat.w + 120;
  let y = startPlat.y - 40;

  const platformCount = 14 + level;

  for (let i = 0; i < platformCount; i++) {
    const w = randi(CONFIG.world.platformMinW, CONFIG.world.platformMaxW);
    const gap = randi(CONFIG.world.gapMin, CONFIG.world.gapMax);
    const dy = randi(-CONFIG.world.stepYMax, CONFIG.world.stepYMax);

    x += gap;
    y = Math.max(140, Math.min(floorY - 110, y + dy));

    const p = makePlatform(x, y, w);
    platforms.push(p);

    // coins
    if (Math.random() < CONFIG.world.coinChance) {
      const cCount = randi(1, 3);
      for (let k = 0; k < cCount; k++) {
        coins.push({
          x: x + randi(16, Math.max(16, w - 30)),
          y: y - randi(26, 62),
          w: 18,
          h: 18,
          taken: false,
        });
      }
    }

    // enemies (on top of platform)
    if (Math.random() < CONFIG.world.enemyChance) {
      const type = Math.random() < 0.35 ? 2 : 1;
      const e = spawnEnemy(type, x + randi(14, Math.max(14, w - 60)), y - 34);
      enemies.push(e);
    }

    // spikes (on top of platform, not on invisible ground)
    if (Math.random() < CONFIG.world.spikeChance && w > 90) {
      const sx = x + randi(14, Math.max(14, w - 60));
      const sy = y - 44;
      spikes.push({ x: sx, y: sy, w: 44, h: 44 });
    }

    x += w;
  }

  // place checkpoint + exit on real platforms near end
  const checkpointPlat = pickPlatformNear(platforms, W - 520);
  const exitPlat = pickPlatformNear(platforms, W - 260);

  const checkpoint = {
    x: checkpointPlat.x + Math.min(checkpointPlat.w - 34, Math.max(8, checkpointPlat.w * 0.35)),
    y: checkpointPlat.y - 56,
    w: 34,
    h: 56,
    reached: false,
  };

  const exit = {
    x: exitPlat.x + Math.min(exitPlat.w - 52, Math.max(8, exitPlat.w * 0.60)),
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

    // spawn point on the start platform
    spawn: {
      x: startPlat.x + 40,
      y: startPlat.y - CONFIG.player.h,
    },
  };
}
