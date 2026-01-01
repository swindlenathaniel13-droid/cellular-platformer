// js/world.js
import { CONFIG } from "./config.js";
import { mulberry32, rectsOverlap, clamp } from "./utils.js";

function makeRect(x,y,w,h){ return { x,y,w,h }; }

function spikeHitbox(spike){
  // FIX: hitbox smaller than sprite (your “one spike kills too easily” issue)
  // Only top-ish area hurts.
  const padX = spike.w * 0.18;
  const topY = spike.y + spike.h * 0.18;
  const hbH  = spike.h * 0.52;
  return { x: spike.x + padX, y: topY, w: spike.w - padX*2, h: hbH };
}

export function generateWorld(level, assets, seed = 1234){
  const rnd = mulberry32(seed + level * 999);

  const floorY = CONFIG.world.floorY;
  const levelLen = CONFIG.world.levelLen;

  const platforms = [];
  const coins = [];
  const spikes = [];
  const enemies = [];

  // Start + finish platforms (guaranteed safe)
  platforms.push(makeRect(0, floorY, 520, CONFIG.world.platformH));

  const finishX = levelLen - 560;
  platforms.push(makeRect(finishX, floorY, 560, CONFIG.world.platformH));

  // Mid platforms - keep gaps doable
  let x = 520 + 80;
  let y = floorY - 120;

  const count = 7 + Math.floor(rnd()*4);
  for (let i=0;i<count;i++){
    const w = 220 + Math.floor(rnd()*220);

    const gap = 80 + Math.floor(rnd() * (CONFIG.world.maxGap - 80));
    x += gap;

    const rise = (rnd() < 0.5 ? -1 : 1) * Math.floor(rnd() * CONFIG.world.maxRise);
    y = clamp(y + rise, floorY - 220, floorY - 80);

    platforms.push(makeRect(x, y, w, CONFIG.world.platformH));

    // Coins on platform
    const coinCount = 2 + Math.floor(rnd()*4);
    for (let c=0;c<coinCount;c++){
      const cx = x + 28 + c * 44;
      if (cx < x + w - 20){
        coins.push({ x: cx, y: y - 34, w: 20, h: 20, taken:false });
      }
    }

    // Spikes sometimes (on top of platform)
    if (rnd() < CONFIG.world.spikeChance){
      const spikeNum = 1 + Math.floor(rnd()*3);
      for (let s=0;s<spikeNum;s++){
        const sx = x + 24 + s * 44;
        if (sx < x + w - 32){
          spikes.push({ x: sx, y: y - 26, w: 26, h: 26 });
        }
      }
    }

    // Enemy sometimes
    if (rnd() < CONFIG.world.enemyChance){
      enemies.push({
        kind: (rnd() < 0.65 ? "enemy1" : "enemy2"),
        x: x + w*0.55,
        y: y - 46,
        w: 34,
        h: 46,
        vx: rnd()<0.5 ? -60 : 60,
        hp: (rnd()<0.65 ? 2 : 3),
        onGround:false,
        inv:0
      });
    }
  }

  // Checkpoint: always on a platform
  const checkpointPlatform = platforms[platforms.length - 2]; // near end but before finish
  const checkpoint = {
    x: checkpointPlatform.x + checkpointPlatform.w*0.25,
    y: checkpointPlatform.y - 54,
    w: 26,
    h: 54,
    reached: false
  };

  // Exit door: always on finish platform
  const door = {
    x: finishX + 420,
    y: floorY - 92,
    w: 52,
    h: 92,
    unlocked: false
  };

  return {
    levelLen,
    platforms,
    coins,
    spikes,
    enemies,
    checkpoint,
    door
  };
}

export function getSolids(world){
  return world.platforms;
}

export function collectCoins(world, playerRect){
  let got = 0;
  for (const c of world.coins){
    if (c.taken) continue;
    if (rectsOverlap(playerRect, c)){
      c.taken = true;
      got++;
    }
  }
  return got;
}

export function checkCheckpoint(world, playerRect){
  if (world.checkpoint.reached) return false;
  if (rectsOverlap(playerRect, world.checkpoint)){
    world.checkpoint.reached = true;

    // FIX: checkpoint unlocks exit door (does NOT advance stage)
    world.door.unlocked = true;
    return true;
  }
  return false;
}

export function checkExit(world, playerRect){
  if (!world.door.unlocked) return false;
  if (rectsOverlap(playerRect, world.door)) return true;
  return false;
}

export function spikeDamage(world, playerRect){
  for (const sp of world.spikes){
    const hb = spikeHitbox(sp);
    if (rectsOverlap(playerRect, hb)){
      return CONFIG.world.spikeDamage;
    }
  }
  return 0;
}
