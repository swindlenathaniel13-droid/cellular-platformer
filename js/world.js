import { CONFIG } from "./config.js";
import { clamp, randi, randf } from "./utils.js";

export function createWorld(level){
  const world = {
    level,
    width: 2600 + level * 160,
    height: 1200,

    platforms: [],
    coins: [],
    hazards: [],
    enemies: [],

    checkpoint: null,
    exitDoor: null,

    checkpointHit: false,
    exitUnlocked: false,

    exitPlatform: null
  };

  generatePlatforms(world);
  placeCheckpointAndExit(world);
  generateCoins(world);
  generateSpikes(world);

  return world;
}

function addPlatform(world, x, y, w){
  world.platforms.push({ x, y, w, h: CONFIG.PLATFORM_H });
}

function generatePlatforms(world){
  const yGround = 420;
  addPlatform(world, 0, yGround, 520);

  let x = 520;
  let y = yGround;
  const endX = world.width - 520;

  while (x < endX){
    const gap = randi(80, CONFIG.MAX_GAP);
    x += gap;

    const w = randi(CONFIG.MIN_PLATFORM_W, CONFIG.MAX_PLATFORM_W);

    // rise/fall but clamp so jumps stay doable
    const rise = randi(-70, CONFIG.MAX_RISE);
    y = clamp(y - rise, 220, 440);

    addPlatform(world, x, y, w);

    x += w;
  }

  // Ensure a big final platform for exit
  addPlatform(world, world.width - 520, 420, 520);
}

function pickPlatformNearX(world, targetX){
  let best = null;
  let bestD = 1e9;
  for (const p of world.platforms){
    const center = p.x + p.w/2;
    const d = Math.abs(center - targetX);
    if (d < bestD){
      bestD = d;
      best = p;
    }
  }
  return best;
}

function placeCheckpointAndExit(world){
  const cx = world.width * 0.62;
  const ex = world.width * 0.90;

  const cp = pickPlatformNearX(world, cx);
  const ep = pickPlatformNearX(world, ex);

  world.exitPlatform = ep;

  // Put flag and door ON the platform, centered, above the top surface
  world.checkpoint = {
    x: cp.x + cp.w * 0.30,
    y: cp.y - 46,
    w: 28,
    h: 46
  };

  world.exitDoor = {
    x: ep.x + ep.w * 0.70,
    y: ep.y - 64,
    w: 44,
    h: 64
  };

  // Safety: ensure they don't hang off edges
  world.checkpoint.x = clamp(world.checkpoint.x, cp.x + 10, cp.x + cp.w - world.checkpoint.w - 10);
  world.exitDoor.x = clamp(world.exitDoor.x, ep.x + 10, ep.x + ep.w - world.exitDoor.w - 10);
}

function generateCoins(world){
  world.coins = [];
  // A few coins above random platforms
  for (let i=0;i<18;i++){
    const p = world.platforms[(Math.random()*world.platforms.length)|0];
    const x = p.x + 20 + Math.random() * Math.max(10, p.w - 40);
    const y = p.y - 50 - Math.random() * 60;
    world.coins.push({ x, y, w: 20, h: 20, taken:false });
  }
}

function generateSpikes(world){
  world.hazards = [];
  const spikeCount = Math.min(2 + Math.floor(world.level * 0.6), 10);

  for (let i=0;i<spikeCount;i++){
    const p = world.platforms[(Math.random()*world.platforms.length)|0];
    if (!p) continue;

    // avoid start / checkpoint / exit zones
    if (p.x < 260) continue;
    if (Math.abs((p.x+p.w/2) - (world.checkpoint.x)) < 180) continue;
    if (Math.abs((p.x+p.w/2) - (world.exitDoor.x)) < 220) continue;

    const x = p.x + 20 + Math.random() * Math.max(10, p.w - 80);
    const y = p.y - CONFIG.SPIKE_H + 6;

    world.hazards.push({
      x, y,
      w: CONFIG.SPIKE_W,
      h: CONFIG.SPIKE_H,
      damage: CONFIG.SPIKE_DAMAGE
    });
  }
}

export function collectCoins(world, player){
  let got = 0;
  for (const c of world.coins){
    if (c.taken) continue;
    const hit = (
      player.x < c.x + c.w &&
      player.x + player.w > c.x &&
      player.y < c.y + c.h &&
      player.y + player.h > c.y
    );
    if (hit){
      c.taken = true;
      got++;
    }
  }
  return got;
}

export function touchCheckpoint(world, player){
  if (world.checkpointHit) return false;
  const f = world.checkpoint;
  const hit = (
    player.x < f.x + f.w &&
    player.x + player.w > f.x &&
    player.y < f.y + f.h &&
    player.y + player.h > f.y
  );
  if (hit){
    world.checkpointHit = true;
    world.exitUnlocked = true;
    return true;
  }
  return false;
}

export function touchExit(world, player){
  if (!world.exitUnlocked) return false;
  const d = world.exitDoor;
  const hit = (
    player.x < d.x + d.w &&
    player.x + player.w > d.x &&
    player.y < d.y + d.h &&
    player.y + player.h > d.y
  );
  return hit;
}
