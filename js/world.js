import { CONFIG } from "./config.js";
import { clamp, mulberry32 } from "./utils.js";

function rect(x, y, w, h) {
  return { x, y, w, h };
}

export function createWorld(levelIndex, runSeed) {
  const rng = mulberry32((runSeed + levelIndex * 99991) >>> 0);

  const groundY = CONFIG.BASE_GROUND_Y;
  const length = CONFIG.LEVEL_LENGTH + (levelIndex - 1) * 260;

  // Ground (continuous)
  const platforms = [rect(0, groundY, length, 64)];

  // Build a “critical path” of platforms leading to the exit platform
  const path = [];
  let x = 260;
  let yTop = groundY - 90; // first step

  const yLevels = CONFIG.PATH_Y_LEVELS.slice();
  // as levels rise, prefer higher platforms a bit more
  const heightBias = clamp((levelIndex - 1) / 10, 0, 0.6);

  while (x < length - 620) {
    const step = CONFIG.PATH_STEP_X_MIN + rng() * (CONFIG.PATH_STEP_X_MAX - CONFIG.PATH_STEP_X_MIN);
    x += step;

    // choose yTop from levels
    const pickHigh = rng() < heightBias;
    const idx = pickHigh ? Math.floor(rng() * (yLevels.length - 1)) + 1 : Math.floor(rng() * 2);
    yTop = clamp(yLevels[idx], 280, groundY - 40);

    const w = 220 + Math.floor(rng() * 180);
    const plat = rect(x, yTop, w, 34);
    platforms.push(plat);
    path.push(plat);
  }

  // Goal platform near end (exit sits here)
  const goalPlat = rect(length - 520, groundY - 200, 360, 34);
  platforms.push(goalPlat);

  // Add 2-3 “stair” platforms so goal is always reachable
  platforms.push(rect(goalPlat.x - 260, groundY - 120, 200, 34));
  platforms.push(rect(goalPlat.x - 420, groundY - 60, 220, 34));

  // Coins sprinkled on some platforms
  const coins = [];
  for (let i = 0; i < Math.min(10 + levelIndex * 2, 28); i++) {
    const p = platforms[1 + Math.floor(rng() * (platforms.length - 1))];
    const cx = p.x + 30 + rng() * (p.w - 60);
    const cy = p.y - 26 - rng() * 16;
    coins.push({ x: cx, y: cy, r: 14, collected: false });
  }

  // Checkpoint flag (visible, not behind exit)
  const checkpoint = {
    x: goalPlat.x - 120,
    y: goalPlat.y - 72,
    w: 54,
    h: 72
  };

  // Exit door sits fully on goal platform
  const exitW = 92;
  const exitH = 140;
  const exit = {
    x: goalPlat.x + goalPlat.w - exitW - 18,
    y: goalPlat.y - exitH,
    w: exitW,
    h: exitH
  };

  // Spawn point
  const spawn = { x: 90, y: groundY - CONFIG.PLAYER_H - 4 };

  // Optional hazards (none for now; add later)
  const hazards = [];

  return {
    length,
    groundY,
    platforms,
    hazards,
    coins,
    checkpoint,
    exit,
    spawn,
    goalPlat,
  };
}
