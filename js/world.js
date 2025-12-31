import { CONFIG } from "./config.js";
import { rand, randi, clamp } from "./utils.js";

export function buildLevel(level){
  const solids = [];
  const hazards = [];
  const pickups = [];

  const W = CONFIG.LEVEL_W;
  const floorY = CONFIG.FLOOR_Y;

  // -----------------------------
  // 1) FLOOR: safer early segments
  // -----------------------------
  let x = 0;

  // Make Level 1 forgiving; scale difficulty slowly
  const gapMin = CONFIG.PLATFORM_MIN_GAP + Math.min(40, level * 4);
  const gapMax = CONFIG.PLATFORM_MAX_GAP + Math.min(80, level * 6);

  // Always give a safe start runway
  solids.push({ x: 0, y: floorY, w: 720, h: 70, kind:"floor", solid:true });
  x = 720;

  while(x < W){
    const segW = randi(300, 560);
    solids.push({ x, y: floorY, w: segW, h: 70, kind:"floor", solid:true });
    x += segW;

    const gap = randi(gapMin, gapMax);
    x += gap;
  }

  // -----------------------------
  // 2) MAIN ROUTE: guaranteed jumps
  // -----------------------------
  // We build a chain of platforms where horizontal gaps are always jumpable.
  const routeStartX = 520;
  let px = routeStartX;
  let py = randi(330, 380);

  const routeEndX = W - 760;
  const maxStep = 210 + Math.min(30, level * 2);   // safe horizontal progress per jump
  const minStep = 140;

  while(px < routeEndX){
    const pw = randi(180, 300);
    solids.push({ x: px, y: py, w: pw, h: 28, kind:"plat", solid:true });

    // Put a couple coins on the route
    if(Math.random() < 0.7){
      pickups.push({ x: px + pw*0.35, y: py - 40, w:18, h:18, kind:"coin", alive:true });
      pickups.push({ x: px + pw*0.70, y: py - 40, w:18, h:18, kind:"coin", alive:true });
    }

    const step = randi(minStep, maxStep);
    px += pw + step;

    // gentle vertical changes
    const dy = randi(-60, 60);
    py = clamp(py + dy, 230, 390);
  }

  // -----------------------------
  // 3) EXTRA RANDOM PLATFORMS (optional challenge)
  // -----------------------------
  const extraCount = 2 + Math.min(6, Math.floor(level/2));
  for(let i=0;i<extraCount;i++){
    const pw = randi(160, 300);
    const ex = randi(260, W - pw - 260);
    const ey = randi(220, 390);
    solids.push({ x:ex, y:ey, w:pw, h:28, kind:"plat", solid:true });

    if(Math.random() < 0.5){
      pickups.push({ x: ex + pw*0.5, y: ey - 38, w:18, h:18, kind:"coin", alive:true });
    }
  }

  // -----------------------------
  // 4) MOVING PLATFORM later
  // -----------------------------
  if(level >= CONFIG.MOVING_PLAT_FROM_LEVEL){
    const mw = randi(170, 260);
    const my = randi(260, 360);
    const mx0 = randi(520, W - mw - 520);
    solids.push({
      x: mx0, y: my, w: mw, h: 26, kind:"move", solid:true,
      move: { x0: mx0, x1: mx0 + randi(140, 260), t: Math.random()*10 }
    });
  }

  // -----------------------------
  // 5) SPIKES later
  // -----------------------------
  if(level >= CONFIG.SPIKES_FROM_LEVEL){
    const spikeCount = 2 + Math.min(4, Math.floor(level/3));
    for(let i=0;i<spikeCount;i++){
      const hx = randi(820, W-820);
      hazards.push({ x:hx, y: floorY-10, w: 70, h: 14, kind:"spikes" });
    }
  }

  // -----------------------------
  // 6) FLAG + DOOR placement (never behind)
  // -----------------------------
  const flag = {
    x: W - 640,
    y: floorY - 86,
    w: 40,
    h: 86,
    kind:"flag",
    solid:false
  };

  const door = {
    x: W - 200,
    y: floorY - 88,
    w: 60,
    h: 88,
    kind:"door",
    solid:false
  };

  return { W, floorY, solids, hazards, pickups, flag, door };
}
