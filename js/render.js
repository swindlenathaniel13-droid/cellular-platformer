import { clamp } from "./utils.js";

export function createRenderer(canvas){
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { ctx };
}

export function draw(game){
  const { ctx } = game.render;
  const { assets } = game;
  const { camX, camY } = game;

  // clear
  ctx.clearRect(0,0,game.W,game.H);

  // background parallax (tile)
  if(assets.bg){
    const img = assets.bg;
    const par = camX * 0.25;
    const y = -20;
    const tileW = img.width;
    const startX = -((par % tileW) + tileW);
    for(let x=startX; x<game.W+tileW; x+=tileW){
      ctx.drawImage(img, x, y, img.width, img.height);
    }
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,game.W,game.H);
  }

  ctx.save();
  ctx.translate(-camX, -camY);

  // platforms
  for(const s of game.world.solids){
    drawPlatform(ctx, assets, s);
  }

  // hazards (simple)
  for(const h of game.world.hazards){
    ctx.fillStyle = "rgba(255,120,120,0.65)";
    ctx.fillRect(h.x, h.y, h.w, h.h);
  }

  // pickups
  for(const p of game.world.pickups){
    if(!p.alive) continue;
    if(p.kind === "coin" && assets.coin){
      ctx.drawImage(assets.coin, p.x, p.y, p.w, p.h);
    }
  }

  // flag + door (flag drawn AFTER door to avoid hiding)
  if(assets.door){
    const d = game.world.door;
    ctx.drawImage(assets.door, d.x, d.y, d.w, d.h);
  }
  if(assets.flag){
    const f = game.world.flag;
    ctx.drawImage(assets.flag, f.x, f.y, f.w, f.h);
  }

  // projectiles
  for(const pr of game.projectiles){
    if(pr.kind === "phone" && assets.phone){
      ctx.drawImage(assets.phone, pr.x, pr.y, pr.w, pr.h);
    } else if(pr.kind === "enemyShot"){
      ctx.fillStyle = "rgba(255,200,120,0.9)";
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    }
  }

  // enemies
  for(const e of game.enemies){
    if(e.hp <= 0) continue;
    drawEnemy(ctx, assets, e);
  }

  // player
  drawPlayer(ctx, assets, game.player);

  // dash particles
  for(const fx of game.fx){
    ctx.globalAlpha = fx.a;
    ctx.fillStyle = "rgba(160,220,255,1)";
    ctx.fillRect(fx.x, fx.y, fx.w, fx.h);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawPlatform(ctx, assets, s){
  if(assets.platform){
    // tile platform image across width (pixel style)
    const img = assets.platform;
    const tileW = img.width;
    const tileH = img.height;
    const tiles = Math.max(1, Math.floor(s.w / tileW));
    for(let i=0;i<=tiles;i++){
      const x = s.x + i*tileW;
      const w = Math.min(tileW, s.x+s.w - x);
      if(w <= 0) continue;
      ctx.drawImage(img, 0, 0, w, tileH, x, s.y, w, s.h);
    }
  } else {
    ctx.fillStyle = "rgba(60,120,120,0.85)";
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
}

function drawPlayer(ctx, assets, p){
  const img = assets[p.charKey] || assets.nate;
  ctx.save();

  // tiny “animation” bob + squash
  const bob = Math.sin(p.animT*10) * (p.onGround ? 1.2 : 0.4);
  const squash = p.onGround ? (1 + Math.sin(p.animT*14)*0.02) : 1;
  const hurtShake = p.hurtT > 0 ? Math.sin(p.animT*60)*2 : 0;

  ctx.translate(p.x + p.w/2 + hurtShake, p.y + p.h/2 + bob);

  // flip
  ctx.scale(p.facing, 1);

  // dash tilt
  const tilt = (p.dashT > 0) ? (-0.12 * p.facing) : 0;
  ctx.rotate(tilt);

  // squash
  ctx.scale(1, squash);

  if(img){
    ctx.drawImage(img, -p.w/2, -p.h/2, p.w, p.h);
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
  }

  ctx.restore();
}

function drawEnemy(ctx, assets, e){
  const img = e.type === "enemy2" ? assets.enemy2 : assets.enemy1;
  ctx.save();

  const bob = Math.sin(e.animT*9) * 0.8;
  const shake = e.hurtT > 0 ? Math.sin(e.animT*60)*2 : 0;

  ctx.translate(e.x + e.w/2 + shake, e.y + e.h/2 + bob);
  ctx.scale(e.facing, 1);

  if(e.boss) ctx.scale(1.02, 1.02);

  if(img){
    ctx.drawImage(img, -e.w/2, -e.h/2, e.w, e.h);
  } else {
    ctx.fillStyle = "rgba(255,80,80,0.9)";
    ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
  }

  ctx.restore();
}
