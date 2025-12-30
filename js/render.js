import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";

function drawTiledPlatform(ctx, img, x, y, w, h) {
  // tile Platform.png across width
  const tileW = CONFIG.TILE_W;
  const sx = 0, sy = 0;
  const sw = img.width, sh = img.height;

  const tiles = Math.max(1, Math.ceil(w / tileW));
  for (let i = 0; i < tiles; i++) {
    const dx = x + i * tileW;
    const dw = Math.min(tileW, x + w - dx);
    ctx.drawImage(img, sx, sy, sw, sh, dx, y, dw, h);
  }
}

export function rebuildStaticLayer(state) {
  const w = state.world;
  const imgs = state.assets.imgs;
  const c = document.createElement("canvas");
  c.width = CONFIG.CANVAS_W;
  c.height = CONFIG.CANVAS_H;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;

  // We cache only what’s visible per frame with camX, so static cache is built in render each frame.
  // Still, we can cache platform “texture strips” quickly by drawing platforms each frame onto main ctx
  // For now, mark as ready:
  w.staticCanvas = c;
  w.staticDirty = false;
}

function drawParallax(ctx, bg, camX) {
  // single-layer parallax repeat
  const w = CONFIG.CANVAS_W;
  const h = CONFIG.CANVAS_H;

  const scale = Math.max(w / bg.width, h / bg.height);
  const bw = bg.width * scale;
  const bh = bg.height * scale;

  // parallax factor
  const px = camX * 0.25;
  let start = -((px % bw + bw) % bw);

  for (let x = start; x < w + bw; x += bw) {
    ctx.drawImage(bg, x, 0, bw, bh);
  }
}

function drawHpBar(ctx, x, y, hp, hpMax, label = "HP") {
  const blocks = hpMax;
  const bw = 14;
  const gap = 4;
  const w = blocks * (bw + gap) + 50;
  const h = 26;

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.strokeStyle = "rgba(180,210,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.font = "bold 14px monospace";
  ctx.fillText(label, x + 10, y + 18);

  for (let i = 0; i < blocks; i++) {
    const bx = x + 44 + i * (bw + gap);
    const by = y + 6;
    ctx.fillStyle = i < hp ? "white" : "rgba(255,255,255,0.15)";
    ctx.fillRect(bx, by, bw, 14);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeRect(bx, by, bw, 14);
  }
  ctx.restore();
}

function bobY(step) {
  return Math.sin(step) * 2.2;
}

export function render(state, ctx) {
  const imgs = state.assets.imgs;
  const w = state.world;
  const p = state.player;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);

  // camera
  const camX = clamp(p.x - CONFIG.CANVAS_W * 0.35, 0, w.length - CONFIG.CANVAS_W);

  // background
  drawParallax(ctx, imgs.background, camX);

  // platforms + ground
  const platImg = imgs.platform;
  for (const s of w.solids) {
    if (s.kind === "ground" || s.kind === "platform") {
      const dx = Math.floor(s.x - camX);
      const dy = Math.floor(s.y);
      const dw = Math.floor(s.w);
      const dh = Math.floor(s.h);
      // only draw if on screen
      if (dx + dw < -40 || dx > CONFIG.CANVAS_W + 40) continue;
      drawTiledPlatform(ctx, platImg, dx, dy, dw, dh);
    } else if (s.kind === "gate") {
      const dx = Math.floor(s.x - camX);
      const dy = Math.floor(s.y);
      if (dx + s.w < -40 || dx > CONFIG.CANVAS_W + 40) continue;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#0a0f20";
      ctx.fillRect(dx, dy, s.w, s.h);
      ctx.strokeStyle = "rgba(100,170,255,0.45)";
      ctx.strokeRect(dx, dy, s.w, s.h);
      ctx.restore();
    }
  }

  // hazards (spikes)
  for (const hz of w.hazards) {
    const dx = hz.x - camX;
    if (dx + hz.w < -40 || dx > CONFIG.CANVAS_W + 40) continue;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(255,90,90,0.9)";
    for (let i = 0; i < 6; i++) {
      const sx = dx + i * (hz.w / 6);
      ctx.beginPath();
      ctx.moveTo(sx, hz.y + hz.h);
      ctx.lineTo(sx + hz.w / 12, hz.y);
      ctx.lineTo(sx + hz.w / 6, hz.y + hz.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // pickups
  for (const pu of w.pickups) {
    const dx = pu.x - camX;
    if (dx + pu.w < -40 || dx > CONFIG.CANVAS_W + 40) continue;
    const bob = Math.sin((state.time ?? 0) * 3 + pu.bob) * 3;

    let img = imgs.coin;
    if (pu.kind === "dash") img = imgs.powerupDash;
    if (pu.kind === "speed") img = imgs.powerupSpeed;

    ctx.drawImage(img, Math.floor(dx), Math.floor(pu.y + bob), pu.w, pu.h);
  }

  // exit + flag
  if (w.flag) {
    const fx = Math.floor(w.flag.x - camX);
    if (fx + w.flag.w > -40 && fx < CONFIG.CANVAS_W + 40) {
      ctx.drawImage(imgs.flag, fx, Math.floor(w.flag.y), w.flag.w, w.flag.h);
    }
  }
  if (w.exit) {
    const ex = Math.floor(w.exit.x - camX);
    if (ex + w.exit.w > -40 && ex < CONFIG.CANVAS_W + 40) {
      ctx.drawImage(imgs.exit, ex, Math.floor(w.exit.y), w.exit.w, w.exit.h);
    }
  }

  // enemy projectiles
  if (state.enemyProjectiles) {
    ctx.save();
    ctx.fillStyle = "rgba(180,240,255,0.95)";
    for (const b of state.enemyProjectiles) {
      const dx = b.x - camX;
      ctx.fillRect(dx, b.y, b.w, b.h);
    }
    ctx.restore();
  }

  // player projectiles
  if (state.projectiles) {
    for (const pr of state.projectiles) {
      const dx = pr.x - camX;
      if (dx + pr.w < -40 || dx > CONFIG.CANVAS_W + 40) continue;
      ctx.save();
      const cx = dx + pr.w / 2;
      const cy = pr.y + pr.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(pr.spin ?? 0);
      ctx.translate(-cx, -cy);
      ctx.drawImage(imgs.weapon, Math.floor(dx), Math.floor(pr.y), pr.w, pr.h);
      ctx.restore();
    }
  }

  // enemies
  for (const e of state.enemies ?? []) {
    const dx = e.x - camX;
    if (dx + e.w < -80 || dx > CONFIG.CANVAS_W + 80) continue;

    const img = e.type === "Enemy1" ? imgs.Enemy1 : imgs.Enemy2;
    const scale = e.type === "Boss" ? 1.2 : 1.05;

    ctx.save();
    // fake “walk” bob
    const by = bobY(e.animStep);
    if (e.hurtFlash > 0) ctx.globalAlpha = 0.7;

    // flip
    if (e.face < 0) {
      ctx.translate(Math.floor(dx + e.w / 2), 0);
      ctx.scale(-1, 1);
      ctx.translate(-Math.floor(dx + e.w / 2), 0);
    }

    ctx.drawImage(
      img,
      Math.floor(dx - (e.w * (scale - 1)) / 2),
      Math.floor(e.y + by - (e.h * (scale - 1))),
      Math.floor(e.w * scale),
      Math.floor(e.h * scale)
    );

    // tiny hp bar above
    const hpBlocks = Math.min(10, e.hpMax);
    const hp = clamp(e.hp, 0, hpBlocks);
    drawHpBar(ctx, Math.floor(dx), Math.floor(e.y - 32), hp, hpBlocks, "");
    ctx.restore();
  }

  // player
  {
    const dx = p.x - camX;
    const img = imgs[p.charKey] ?? imgs.Nate;
    const scale = 1.12; // makes the sprite feel less tiny while keeping hitbox sane
    const by = bobY(p.animStep);

    ctx.save();
    if (p.face < 0) {
      ctx.translate(Math.floor(dx + p.w / 2), 0);
      ctx.scale(-1, 1);
      ctx.translate(-Math.floor(dx + p.w / 2), 0);
    }
    if (p.hurtFlash > 0) ctx.globalAlpha = 0.75;

    ctx.drawImage(
      img,
      Math.floor(dx - (p.w * (scale - 1)) / 2),
      Math.floor(p.y + by - (p.h * (scale - 1))),
      Math.floor(p.w * scale),
      Math.floor(p.h * scale)
    );
    ctx.restore();
  }

  // particles
  if (state.particles) {
    ctx.save();
    ctx.fillStyle = "rgba(110,255,210,0.85)";
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= (state._dtForParticles ?? 0);
      pt.x += pt.vx * (state._dtForParticles ?? 0);
      pt.y += pt.vy * (state._dtForParticles ?? 0);
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      const dx = pt.x - camX;
      ctx.fillRect(dx, pt.y, 4, 4);
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    ctx.restore();
  }

  // HUD HP
  drawHpBar(ctx, CONFIG.CANVAS_W - 220, 18, p.hp, p.hpMax, "HP");
}

