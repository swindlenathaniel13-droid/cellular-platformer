import { CONFIG } from "./config.js";

function tileHoriz(ctx, img, x, y, w, h) {
  const iw = img.width || 64;
  const ih = img.height || 64;
  for (let px = 0; px < w; px += iw) {
    ctx.drawImage(img, x + px, y, Math.min(iw, w - px), h);
  }
}

export function drawGame(ctx, state) {
  const { assets, world, player, camX, camY } = state;

  // Background
  ctx.clearRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
  if (assets.bg) {
    // simple parallax
    const bx = -camX * 0.25;
    ctx.drawImage(assets.bg, bx, 0, assets.bg.width, CONFIG.canvas.h);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
  }

  ctx.save();
  ctx.translate(-camX, -camY);

  // Platforms
  for (const p of world.platforms) {
    if (assets.platform) {
      tileHoriz(ctx, assets.platform, p.x, p.y, p.w, p.h);
    } else {
      ctx.fillStyle = "#234";
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }

  // Coins
  for (const c of world.coins) {
    if (c.taken) continue;
    if (assets.coin) ctx.drawImage(assets.coin, c.x, c.y, c.w, c.h);
    else { ctx.fillStyle = "gold"; ctx.fillRect(c.x, c.y, c.w, c.h); }
  }

  // Spikes (draw) — hitbox is handled elsewhere
  for (const s of world.spikes) {
    if (assets.spike) {
      ctx.drawImage(assets.spike, s.x, s.y, CONFIG.spike.drawW, CONFIG.spike.drawH);
    } else {
      ctx.fillStyle = "#c33";
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
  }

  // Checkpoint flag
  if (assets.flag) ctx.drawImage(assets.flag, world.checkpoint.x, world.checkpoint.y, world.checkpoint.w, world.checkpoint.h);
  else { ctx.fillStyle="#7ac7ff"; ctx.fillRect(world.checkpoint.x, world.checkpoint.y, world.checkpoint.w, world.checkpoint.h); }

  // Exit door (tint if locked)
  if (assets.door) {
    if (!world.exitUnlocked) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(assets.door, world.exit.x, world.exit.y, world.exit.w, world.exit.h);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(assets.door, world.exit.x, world.exit.y, world.exit.w, world.exit.h);
    }
  } else {
    ctx.fillStyle = world.exitUnlocked ? "#7f7" : "#777";
    ctx.fillRect(world.exit.x, world.exit.y, world.exit.w, world.exit.h);
  }

  // Enemies
  for (const e of world.enemies) {
    const img = e.type === 2 ? assets.enemy2 : assets.enemy1;
    if (img) ctx.drawImage(img, e.x, e.y, e.w, e.h);
    else { ctx.fillStyle="#f55"; ctx.fillRect(e.x, e.y, e.w, e.h); }
  }

  // Projectiles
  for (const b of state.bullets) {
    ctx.fillStyle = "#e9f0ff";
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // Player
  const pImg = assets[player.charKey];
  if (pImg) ctx.drawImage(pImg, player.x, player.y, player.w, player.h);
  else { ctx.fillStyle="#fff"; ctx.fillRect(player.x, player.y, player.w, player.h); }

  ctx.restore();
}
