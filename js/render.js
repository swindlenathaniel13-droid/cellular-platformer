import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";

function drawTiled(ctx, img, x, y, w, h) {
  const tw = img.width;
  const th = img.height;
  for (let yy = y; yy < y + h; yy += th) {
    for (let xx = x; xx < x + w; xx += tw) {
      ctx.drawImage(img, xx, yy, Math.min(tw, x + w - xx), Math.min(th, y + h - yy));
    }
  }
}

export function render(state, ctx) {
  const { images } = state.assets;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);

  // background parallax
  const bg = images.background;
  const cam = state.cameraX || 0;
  const par = cam * 0.25;

  // fill black behind background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);

  if (bg) {
    const bx = - (par % bg.width);
    ctx.drawImage(bg, bx, 0, bg.width, CONFIG.CANVAS_H);
    ctx.drawImage(bg, bx + bg.width, 0, bg.width, CONFIG.CANVAS_H);
  }

  // camera
  ctx.save();
  ctx.translate(-cam, 0);

  // platforms
  const platImg = images.platform;
  for (const p of state.world.platforms) {
    if (!platImg) {
      ctx.fillStyle = "#3d3d3d";
      ctx.fillRect(p.x, p.y, p.w, p.h);
    } else {
      drawTiled(ctx, platImg, p.x, p.y, p.w, p.h);
    }
  }

  // checkpoint (ensure it’s visible)
  if (state.world.checkpoint) {
    const cp = state.world.checkpoint;
    const img = images.checkpoint;
    if (img) ctx.drawImage(img, cp.x, cp.y, cp.w, cp.h);
  }

  // coins
  const coinImg = images.coin;
  for (const c of state.world.coins) {
    if (c.collected) continue;
    if (coinImg) ctx.drawImage(coinImg, c.x - 14, c.y - 14, 28, 28);
    else {
      ctx.fillStyle = "gold";
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // exit door (sits on goal platform)
  if (state.world.exit) {
    const ex = state.world.exit;
    const img = images.exit;
    if (img) ctx.drawImage(img, ex.x, ex.y, ex.w, ex.h);
    else {
      ctx.fillStyle = "#aaa";
      ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
    }
  }

  // projectiles
  for (const pr of state.projectiles) {
    ctx.fillStyle = "#cfe7ff";
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
  }
  for (const b of state.enemyProjectiles) {
    ctx.fillStyle = "#ffb2b2";
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // enemies
  for (const e of state.enemies) {
    const img =
      e.type === "Enemy1" ? images.Enemy1 :
      e.type === "Enemy2" ? images.Enemy2 :
      e.type === "Boss" ? images.Enemy2 : null;

    if (img) ctx.drawImage(img, e.x, e.y, e.w, e.h);
    else {
      ctx.fillStyle = "#ff6a6a";
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
  }

  // player
  const p = state.player;
  const pImg = images[p.charKey] || images.Nate;
  if (pImg) ctx.drawImage(pImg, p.x, p.y, p.w, p.h);
  else {
    ctx.fillStyle = "#7ad";
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  ctx.restore();
}
