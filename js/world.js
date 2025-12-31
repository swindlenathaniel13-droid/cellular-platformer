import { CONFIG } from "./config.js";
import { rand, randi } from "./utils.js";

export function buildLevel(level){
  const solids = [];
  const hazards = [];
  const pickups = [];

  const W = CONFIG.LEVEL_W;
  const floorY = CONFIG.FLOOR_Y;

  // Floor segments with gaps (harder as level increases)
  let x = 0;
  const gapMin = CONFIG.PLATFORM_MIN_GAP + Math.min(110, level*8);
  const gapMax = CONFIG.PLATFORM_MAX_GAP + Math.min(160, level*10);

  while(x < W){
    const segW = randi(260, 520);
    solids.push({ x, y: floorY, w: segW, h: 70, kind:"floor", solid:true });
    x += segW;

    const gap = randi(gapMin, gapMax);
    x += gap;
  }

  // Mid platforms
  const platformCount = 6 + Math.min(8, Math.floor(level/2));
  for(let i=0;i<platformCount;i++){
    const pw = randi(180, 360);
    const px = randi(120, W - pw - 160);
    const py = randi(220, 390);
    solids.push({ x:px, y:py, w:pw, h:28, kind:"plat", solid:true });
  }

  // Moving platforms later
  if(level >= CONFIG.MOVING_PLAT_FROM_LEVEL){
    const mw = randi(160, 260);
    const my = randi(240, 360);
    const mx0 = randi(180, W - mw - 200);
    solids.push({
      x: mx0, y: my, w: mw, h: 26, kind:"move", solid:true,
      move: { x0: mx0, x1: mx0 + randi(120, 240), t: Math.random()*10 }
    });
  }

  // Spikes hazard later
  if(level >= CONFIG.SPIKES_FROM_LEVEL){
    const spikeCount = 2 + Math.min(4, Math.floor(level/3));
    for(let i=0;i<spikeCount;i++){
      const hx = randi(220, W-260);
      hazards.push({ x:hx, y: floorY-10, w: 70, h: 14, kind:"spikes" });
    }
  }

  // Coins sprinkled
  const coinCount = 18 + Math.min(16, level*2);
  for(let i=0;i<coinCount;i++){
    const cx = randi(120, W-120);
    const cy = randi(150, 410);
    pickups.push({ x:cx, y:cy, w:18, h:18, kind:"coin", alive:true });
  }

  // Checkpoint flag (always visible, never behind door)
  const flag = { x: W - 520, y: floorY - 86, w: 40, h: 86, kind:"flag", solid:false };

  // Exit door on a platform (ensure it sits on ground)
  const door = { x: W - 170, y: floorY - 88, w: 60, h: 88, kind:"door", solid:false };

  return { W, floorY, solids, hazards, pickups, flag, door };
}
