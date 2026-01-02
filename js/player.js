// js/player.js
import { CONFIG } from "./config.js";
import { clamp, randRange } from "./utils.js";

export function createPlayer(charKey){
  return {
    charKey,
    x: 0, y: 0,
    w: CONFIG.player.w,
    h: CONFIG.player.h,
    vx: 0, vy: 0,
    dt: 0,
    onGround: false,

    // timers
    coyoteT: 0,
    jumpBufferT: 0,
    invulnT: 0,

    // dash
    dashUnlocked: false,
    dashT: 0,
    dashCooldownT: 0,

    // combat
    throwCooldownT: 0,

    // stats
    hpMax: 10,
    hp: 10
  };
}

export function damagePlayer(p, amount){
  if (p.invulnT > 0) return false;
  p.hp = Math.max(0, p.hp - amount);
  p.invulnT = CONFIG.player.invulnMs;
  return true;
}

export function healPlayer(p, amount){
  p.hp = Math.min(p.hpMax, p.hp + amount);
}

export function updatePlayer(p, input, dtMs){
  const dt = dtMs / 1000;
  p.dt = dt;

  // timers
  p.invulnT = Math.max(0, p.invulnT - dtMs);
  p.throwCooldownT = Math.max(0, p.throwCooldownT - dtMs);
  p.dashCooldownT = Math.max(0, p.dashCooldownT - dtMs);
  p.dashT = Math.max(0, p.dashT - dtMs);

  // jump buffers
  if (!p.onGround) p.coyoteT = Math.max(0, p.coyoteT - dtMs);
  if (p.onGround) p.coyoteT = CONFIG.player.coyoteMs;

  if (input.jump()) p.jumpBufferT = CONFIG.player.jumpBufferMs;
  else p.jumpBufferT = Math.max(0, p.jumpBufferT - dtMs);

  // dash
  const wantDash = input.dash();
  if (p.dashUnlocked && wantDash && p.dashCooldownT <= 0 && p.dashT <= 0){
    p.dashT = CONFIG.player.dashMs;
    p.dashCooldownT = CONFIG.player.dashCooldownMs;
  }

  // movement accel
  const left = input.left();
  const right = input.right();
  const dir = (right ? 1 : 0) - (left ? 1 : 0);

  const targetSpeed = (p.onGround ? CONFIG.player.moveSpeed : CONFIG.player.airSpeed) * dir;
  const accel = p.onGround ? CONFIG.player.accel : CONFIG.player.airAccel;

  if (dir !== 0){
    const dv = targetSpeed - p.vx;
    const step = clamp(dv, -accel * dt, accel * dt);
    p.vx += step;
  } else if (p.onGround){
    p.vx *= CONFIG.player.friction;
    if (Math.abs(p.vx) < 6) p.vx = 0;
  }

  // dash overrides vx briefly
  if (p.dashT > 0){
    const dashDir = dir !== 0 ? dir : (p.vx >= 0 ? 1 : -1);
    p.vx = dashDir * CONFIG.player.dashSpeed;
    p.vy *= 0.85;
  }

  // gravity
  p.vy += CONFIG.player.gravity * dt;

  // jump trigger (buffer + coyote)
  const canJump = (p.onGround || p.coyoteT > 0);
  if (p.jumpBufferT > 0 && canJump){
    p.vy = CONFIG.player.jumpVel;
    p.onGround = false;
    p.jumpBufferT = 0;
    p.coyoteT = 0;
  }

  // jump cut (release early)
  if (!input.jump() && p.vy < 0){
    const cut = CONFIG.player.jumpVel * CONFIG.player.jumpCutFactor; // negative
    if (p.vy < cut) p.vy = cut;
  }
}

export function tryThrow(p, facingDir){
  if (p.throwCooldownT > 0) return null;
  p.throwCooldownT = CONFIG.throw.cooldownMs;

  const baseSpeed = CONFIG.throw.speed;
  const speed = baseSpeed * (1 + randRange(-CONFIG.throw.speedJitter, CONFIG.throw.speedJitter));

  const spread = CONFIG.throw.spreadRad;
  const angle = randRange(-spread, spread) + (facingDir > 0 ? 0 : Math.PI);

  // Bias upward a bit so throws feel nicer
  const upBias = -0.18;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed + upBias * speed;

  return {
    x: p.x + p.w * 0.5,
    y: p.y + p.h * 0.35,
    vx,
    vy,
    r: CONFIG.throw.hitRadius,
    life: CONFIG.throw.lifetimeMs,
    from: "player"
  };
}
