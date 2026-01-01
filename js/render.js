// js/render.js
import { CONFIG } from "./config.js";

export function render(ctx, assets, world, player){
  // background
  const bg = assets.bg;
  if (bg){
    ctx.drawImage(bg, 0, 0, CONFIG.canvas.w, CONFIG.canvas.h);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,CONFIG.canvas.w, CONFIG.canvas.h);
  }

  // platforms
  const platImg = assets.platform;
  for (const p of world.platforms){
    if (platImg) ctx.drawImage(platImg, p.x, p.y, p.w, p.h);
    else {
      ctx.fillStyle = "#1c3a55";
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }

  // coins
  const coinImg = assets.coin;
  for (const c of world.coins){
    if (c.taken) continue;
    if (coinImg) ctx.drawImage(coinImg, c.x, c.y, c.w, c.h);
  }

  // spikes
  const spikeImg = assets.spike;
  for (const s of world.spikes){
    if (spikeImg) ctx.drawImage(spikeImg, s.x, s.y, s.w, s.h);
  }

  // checkpoint flag
  if (assets.flag){
    const f = world.checkpoint;
    ctx.drawImage(assets.flag, f.x, f.y, f.w, f.h);
  }

  // door
  if (assets.door){
    const d = world.door;
    ctx.save();
    if (!d.unlocked){
      ctx.globalAlpha = 0.55;
    }
    ctx.drawImage(assets.door, d.x, d.y, d.w, d.h);
    ctx.restore();
  }

  // enemies
  for (const e of world.enemies){
    const img = assets[e.kind];
    if (img) ctx.drawImage(img, e.x, e.y, e.w, e.h);
    else {
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(e.x,e.y,e.w,e.h);
    }
  }

  // projectiles (phone)
  const phone = assets.phone;
  for (const p of player.projectiles){
    if (phone) ctx.drawImage(phone, p.x, p.y, p.w, p.h);
    else {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(p.x,p.y,p.w,p.h);
    }
  }

  // player
  const pImg = assets[player.charKey];
  if (pImg) ctx.drawImage(pImg, player.x, player.y, player.w, player.h);
  else {
    ctx.fillStyle = "#58d6ff";
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  // invuln blink
  if (player.inv > 0){
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#fff";
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.restore();
  }
}
