// js/render.js
import { CONFIG } from "./config.js";

function drawSprite(ctx, img, x, y, w, h){
  ctx.drawImage(img, x, y, w, h);
}

function drawChar(ctx, img, p, tMs){
  if (!img){
    ctx.fillStyle = "#fff";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    return;
  }

  // Assume 4-frame horizontal sprite sheet (fallback to single frame)
  const frames = 4;
  const fw = Math.floor(img.width / frames);
  const fh = img.height;

  let frame = 0;
  const moving = Math.abs(p.vx) > 20;

  if (!p.onGround) frame = 2;
  else if (moving) frame = Math.floor((tMs / 90) % frames);
  else frame = 0;

  // if it’s not actually a sheet, fw may be wrong; safeguard:
  const useSheet = fw > 0 && fw * frames === img.width;

  if (!useSheet){
    ctx.drawImage(img, p.x, p.y, p.w, p.h);
    return;
  }

  ctx.drawImage(img, frame * fw, 0, fw, fh, p.x, p.y, p.w, p.h);
}

export function drawGame(ctx, state, tMs){
  const { assets, camX, camY } = state;

  ctx.clearRect(0,0,CONFIG.canvas.w,CONFIG.canvas.h);

  // background
  if (assets.bg){
    ctx.drawImage(assets.bg, -camX * 0.12, -camY * 0.06, assets.bg.width, assets.bg.height);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,CONFIG.canvas.w,CONFIG.canvas.h);
  }

  ctx.save();
  ctx.translate(-camX, -camY);

  // platforms
  for (const p of state.platforms){
    if (assets.platform){
      // tile platform image across width
      const tileW = assets.platform.width;
      const tileH = assets.platform.height;
      for (let x = p.x; x < p.x + p.w; x += tileW){
        ctx.drawImage(assets.platform, x, p.y, Math.min(tileW, p.x + p.w - x), p.h);
      }
    } else {
      ctx.fillStyle = "#2a8";
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }

  // coins
  for (const c of state.coins){
    if (c.collected) continue;
    if (assets.coin){
      ctx.drawImage(assets.coin, c.x - 12, c.y - 12, 24, 24);
    } else {
      ctx.fillStyle = "#fc0";
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill();
    }
  }

  // spikes
  for (const s of state.spikes){
    if (assets.spike){
      ctx.drawImage(assets.spike, s.x, s.y, CONFIG.spike.drawW, CONFIG.spike.drawH);
    } else {
      ctx.fillStyle = "#f55";
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
  }

  // checkpoint
  if (assets.flag){
    ctx.drawImage(assets.flag, state.checkpoint.x, state.checkpoint.y, state.checkpoint.w, state.checkpoint.h);
  }

  // door
  if (assets.door){
    ctx.globalAlpha = state.door.open ? 1 : 0.55;
    ctx.drawImage(assets.door, state.door.x, state.door.y, state.door.w, state.door.h);
    ctx.globalAlpha = 1;
  }

  // enemies
  for (const e of state.enemies){
    if (!e.alive) continue;
    const img = assets.enemy1 || assets.enemy2;
    if (img) ctx.drawImage(img, e.x, e.y, e.w, e.h);
    else {
      ctx.fillStyle = "#f44";
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
  }

  // bullets
  for (const b of state.bullets){
    if (b.from === "player" && assets.phone){
      ctx.drawImage(assets.phone, b.x - 10, b.y - 10, 20, 20);
    } else {
      ctx.fillStyle = b.from === "enemy" ? "#ff6" : "#9df";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    }
  }

  // player
  const charImg = assets[state.player.charKey];
  drawChar(ctx, charImg, state.player, tMs);

  ctx.restore();
}
