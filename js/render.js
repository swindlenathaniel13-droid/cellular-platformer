import { CONFIG } from "./config.js";

export function renderGame(ctx, assets, world, player, camera){
  ctx.clearRect(0,0,CONFIG.CANVAS_W, CONFIG.CANVAS_H);

  // Background
  if (assets.bg){
    ctx.drawImage(assets.bg, 0 - camera.x*0.15, 0, CONFIG.CANVAS_W + camera.x*0.15, CONFIG.CANVAS_H);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  }

  // Platforms
  for (const p of world.platforms){
    drawTiled(ctx, assets.platform, p.x - camera.x, p.y - camera.y, p.w, p.h);
  }

  // Spikes
  for (const s of world.hazards){
    drawSprite(ctx, assets.spike, s.x - camera.x, s.y - camera.y, s.w, s.h);
  }

  // Coins
  for (const c of world.coins){
    if (c.taken) continue;
    drawSprite(ctx, assets.coin, c.x - camera.x, c.y - camera.y, c.w, c.h);
  }

  // Checkpoint Flag
  if (world.checkpoint){
    drawSprite(ctx, assets.flag, world.checkpoint.x - camera.x, world.checkpoint.y - camera.y, world.checkpoint.w, world.checkpoint.h);
  }

  // Exit Door (dim if locked)
  if (world.exitDoor){
    if (!world.exitUnlocked){
      ctx.globalAlpha = 0.45;
      drawSprite(ctx, assets.door, world.exitDoor.x - camera.x, world.exitDoor.y - camera.y, world.exitDoor.w, world.exitDoor.h);
      ctx.globalAlpha = 1;
    } else {
      drawSprite(ctx, assets.door, world.exitDoor.x - camera.x, world.exitDoor.y - camera.y, world.exitDoor.w, world.exitDoor.h);
    }
  }

  // Enemies
  for (const e of world.enemies){
    if (e.hp <= 0) continue;
    const img = e.kind === "enemy2" ? assets.enemy2 : assets.enemy1;
    drawSprite(ctx, img, e.x - camera.x, e.y - camera.y, e.w, e.h);
  }

  // Player
  const pimg = assets[player.charKey] || assets.nate;
  drawSprite(ctx, pimg, player.x - camera.x, player.y - camera.y, player.w, player.h);
}

function drawSprite(ctx, img, x, y, w, h){
  x = Math.round(x);
  y = Math.round(y);
  if (!img){
    ctx.fillStyle = "#fff";
    ctx.fillRect(x,y,w,h);
    return;
  }
  ctx.drawImage(img, x, y, w, h);
}

// Tile platform art if you want cleaner fill (works even if the png isn't tile-perfect)
function drawTiled(ctx, img, x, y, w, h){
  x = Math.round(x);
  y = Math.round(y);

  if (!img){
    ctx.fillStyle = "#1e4";
    ctx.fillRect(x,y,w,h);
    return;
  }
  // Simple stretch (fast + consistent)
  ctx.drawImage(img, x, y, w, h);
}
