import { CONFIG } from "./config.js";

export function render(ctx, assets, world, player, camX){
  ctx.clearRect(0,0,CONFIG.CANVAS_W,CONFIG.CANVAS_H);

  // Background
  if (assets.bg){
    ctx.drawImage(assets.bg, 0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,CONFIG.CANVAS_W,CONFIG.CANVAS_H);
  }

  // Platforms
  for (const p of world.platforms){
    if (assets.platform){
      // Tile-ish draw
      const tileW = 64, tileH = 32;
      for (let x=p.x; x<p.x+p.w; x+=tileW){
        ctx.drawImage(assets.platform, Math.floor(x - camX), Math.floor(p.y), tileW, tileH);
      }
    } else {
      ctx.fillStyle = "#2a6";
      ctx.fillRect(Math.floor(p.x-camX), p.y, p.w, p.h);
    }
  }

  // Spikes (NEW)
  for (const hz of world.hazards){
    if (hz.kind !== "spike") continue;
    if (assets.spike){
      ctx.drawImage(
        assets.spike,
        Math.floor(hz.x - camX),
        Math.floor(hz.y),
        hz.w,
        hz.h
      );
    } else {
      ctx.fillStyle = "#f44";
      ctx.fillRect(Math.floor(hz.x-camX), hz.y, hz.w, hz.h);
    }
  }

  // Coins
  for (const c of world.coins){
    if (c.collected) continue;
    if (assets.coin){
      ctx.drawImage(assets.coin, Math.floor(c.x-camX), Math.floor(c.y), c.w, c.h);
    } else {
      ctx.fillStyle="#fc0";
      ctx.fillRect(Math.floor(c.x-camX), c.y, c.w, c.h);
    }
  }

  // Checkpoint flag
  if (assets.flag){
    ctx.drawImage(assets.flag,
      Math.floor(world.checkpoint.x - camX),
      Math.floor(world.checkpoint.y),
      world.checkpoint.w,
      world.checkpoint.h
    );
  }

  // Exit door
  if (assets.door){
    ctx.globalAlpha = world.exitDoor.open ? 1 : 0.45;
    ctx.drawImage(assets.door,
      Math.floor(world.exitDoor.x - camX),
      Math.floor(world.exitDoor.y),
      world.exitDoor.w,
      world.exitDoor.h
    );
    ctx.globalAlpha = 1;
  }

  // Player sprite
  const spr = assets[player.charKey];
  if (spr){
    // Blink if invulnerable
    if (player.iframes > 0 && Math.floor(player.iframes*20)%2===0) {
      // skip draw every other tick
    } else {
      ctx.drawImage(spr,
        Math.floor(player.x - camX) - 10,
        Math.floor(player.y) - 10,
        64, 64
      );
    }
  } else {
    ctx.fillStyle="#fff";
    ctx.fillRect(Math.floor(player.x-camX), player.y, player.w, player.h);
  }
}
