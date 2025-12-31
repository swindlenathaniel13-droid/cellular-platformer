import { CONFIG } from "./config.js";
import { randi, rand } from "./utils.js";

export function buildLevel(level){
  const platforms = [];
  const hazards = [];
  const coins = [];

  // Ground
  platforms.push({ x: -200, y: 470, w: 2000, h: 70, kind:"solid" });

  // Simple generated staircase with reachable gaps
  let x = 60;
  let y = 380;

  const chunks = 7 + Math.min(6, level);
  for (let i=0;i<chunks;i++){
    const w = randi(180, 320);
    const gap = randi(CONFIG.MIN_GAP, CONFIG.MAX_GAP);
    const stepUp = randi(-40, CONFIG.MAX_STEP_UP);

    platforms.push({ x, y, w, h: CONFIG.PLATFORM_H, kind:"solid" });

    // Coins above platform (some)
    if (Math.random() < 0.7){
      const ccount = randi(3, 6);
      for (let c=0;c<ccount;c++){
        coins.push({
          x: x + 20 + c*28,
          y: y - 42 - (c%2)*12,
          w: 18, h: 18, collected:false
        });
      }
    }

    // Spikes sometimes (ONLY on top of platforms)
    if (level >= 3 && Math.random() < 0.55){
      const spikeCount = randi(2, 4);
      for (let s=0;s<spikeCount;s++){
        const sx = x + rand(20, w - (CONFIG.SPIKE_W+20));
        const sy = y - CONFIG.SPIKE_H + 8; // sits on platform
        hazards.push({
          kind: "spike",
          x: sx,
          y: sy,
          w: CONFIG.SPIKE_W,
          h: CONFIG.SPIKE_H,
          damage: CONFIG.SPIKE_DAMAGE
        });
      }
    }

    x += w + gap;
    y = Math.max(150, Math.min(400, y - stepUp));
  }

  // Checkpoint + Exit (always on solid platforms)
  const checkpoint = { x: x - 520, y: 470 - 70 - 44, w: 22, h: 44, activated:false };
  const exitDoor = { x: x - 220, y: 470 - 70 - 72, w: 60, h: 72, open:false };

  // Ensure they're on the ground platform
  checkpoint.y = 470 - 70 - checkpoint.h;
  exitDoor.y = 470 - 70 - exitDoor.h;

  return {
    level,
    platforms,
    hazards,
    coins,
    checkpoint,
    exitDoor,
    stageTime: 0,
    stageCoins: 0,
    damageTaken: 0,
  };
}
