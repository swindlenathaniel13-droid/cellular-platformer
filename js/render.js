import { CONFIG } from "./config.js";

function R(v){ return Math.round(v); }

function tileHoriz(ctx, img, x, y, w, h) {
  const iw = img.width || 64;
  const step = iw;
  for (let px = 0; px < w; px += step) {
    ctx.drawImage(img, R(x + px), R(y), Math.min(iw, w - px), h);
  }
}

function drawSprite(ctx, img, x, y, w, h, flip=false) {
  const rx = R(x), ry = R(y);
  if (!img) {
    ctx.fillRect(rx, ry, w, h);
    return;
  }
  if (!flip) {
    ctx.drawImage(img, rx, ry, w, h);
    return;
  }
  ctx.save();
  ctx.translate(rx + w, ry);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

export function drawGame(ctx, state) {
  const { assets, world, player, camX, camY } = state;

  ctx.clearRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
  ctx.imageSmoothingEnabled = false;

  // background
  if (assets.bg) {
    const bx = -camX * 0.25;
    ctx.drawImage(assets.bg, R(bx), 0, assets.bg.width, CONFIG.canvas.h);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
  }

  ctx.save();
  ctx.translate(-R(camX), -R(camY));

  // platforms
  for (const p of world.platforms) {
    if (assets.platform) {
      tileHoriz(ctx, assets.platform, p.x, p.y, p.w, p.h);
    } else {
      ctx.fillStyle = "#234";
      ctx.fillRect(R(p.x), R(p.y), p.w, p.h);
    }
  }

  // coins
  for (const c of world.coins) {
    if (c.taken) continue;
    if (assets.coin) ctx.drawImage(assets.coin, R(c.x), R(c.y), c.w, c.h);
    else { ctx.fillStyle = "gold"; ctx.fillRect(R(c.x), R(c.y), c.w, c.h); }
  }

  // spikes
  for (const s of world.spikes) {
    if (assets.spike) ctx.drawImage(assets.spike, R(s.x), R(s.y), CONFIG.spike.drawW, CONFIG.spike.drawH);
    else { ctx.fillStyle="#c33"; ctx.fillRect(R(s.x), R(s.y), s.w, s.h); }
  }

  // checkpoint
  drawSprite(ctx, assets.flag, world.checkpoint.x, world.checkpoint.y, world.checkpoint.w, world.checkpoint.h, false);

  // exit door (dim if locked)
  if (assets.door) {
    if (!world.exitUnlocked) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(assets.door, R(world.exit.x), R(world.exit.y), world.exit.w, world.exit.h);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(assets.door, R(world.exit.x), R(world.exit.y), world.exit.w, world.exit.h);
    }
  } else {
    ctx.fillStyle = world.exitUnlocked ? "#7f7" : "#777";
    ctx.fillRect(R(world.exit.x), R(world.exit.y), world.exit.w, world.exit.h);
  }

  // enemies
  for (const e of world.enemies) {
    const img = e.type === 2 ? assets.enemy2 : assets.enemy1;
    const flip = e.vx < 0;
    if (img) drawSprite(ctx, img, e.x, e.y, e.w, e.h, flip);
    else { ctx.fillStyle="#f55"; ctx.fillRect(R(e.x), R(e.y), e.w, e.h); }
  }

  // player bullets (phone icon)
  for (const b of state.bullets) {
    if (assets.phone) {
      const flip = b.vx < 0;
      drawSprite(ctx, assets.phone, b.x, b.y, b.w, b.h, flip);
    } else {
      ctx.fillStyle = "#e9f0ff";
      ctx.fillRect(R(b.x), R(b.y), b.w, b.h);
    }
  }

  // enemy bullets
  for (const b of state.enemyBullets) {
    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(R(b.x), R(b.y), b.w, b.h);
  }

  // player
  const pImg = assets[player.charKey];
  const pFlip = player.face < 0;
  if (pImg) drawSprite(ctx, pImg, player.x, player.y, player.w, player.h, pFlip);
  else { ctx.fillStyle="#fff"; ctx.fillRect(R(player.x), R(player.y), player.w, player.h); }

  ctx.restore();
}
